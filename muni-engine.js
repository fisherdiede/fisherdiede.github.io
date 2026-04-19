// ==================== MUNI ENGINE ====================
// Real-time SFMTA vehicle visualization using 511 SF Bay API

const MUNI_API_KEY = 'MUNI_API_KEY_PLACEHOLDER'; // replaced at build time; overridden locally via window.MUNI_LOCAL_KEY

// San Francisco bounding box
const MUNI_SF_BOUNDS = {
	minLat: 37.7034,
	maxLat: 37.8324,
	minLon: -122.5271,
	maxLon: -122.3571
};

// Route color palette — keyed by LineRef prefix
const MUNI_ROUTE_COLORS = {
	'J': '#d4a017',
	'K': '#5b9bd5',
	'L': '#7db66e',
	'M': '#e07b39',
	'N': '#5b5b9e',
	'T': '#c45b5b',
	'F': '#e0c03a',
	'default': '#ffffff'
};

const MUNI_POLL_INTERVAL = 5000;  // ms
const MUNI_HISTORY_MAX  = 20;     // snapshots retained per vehicle (~100s at 5s)

class MuniEngine {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this._interval = null;
		this._abortController = null;
		this._vehicles = [];
		this._history = new Map(); // vehicleRef -> [{lat, lon, line}]
		this._lastUpdated = null;
		this._error = null;
	}

	start() {
		this._fetch();
		this._interval = setInterval(() => this._fetch(), MUNI_POLL_INTERVAL);
	}

	stop() {
		clearInterval(this._interval);
		this._interval = null;
		if (this._abortController) {
			this._abortController.abort();
			this._abortController = null;
		}
	}

	async _fetch() {
		const apiKey = window.MUNI_LOCAL_KEY ?? MUNI_API_KEY;

		if (apiKey === 'MUNI_API_KEY_PLACEHOLDER') {
			this._error = 'no api key';
			this._render();
			return;
		}

		if (this._abortController) {
			this._abortController.abort();
		}
		this._abortController = new AbortController();

		try {
			const url = `https://api.511.org/transit/VehicleMonitoring?api_key=${apiKey}&agency=SF&format=json`;
			const res = await fetch(url, { signal: this._abortController.signal });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();

			const activities = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.VehicleActivity ?? [];
			this._vehicles = activities
				.map(a => a?.MonitoredVehicleJourney)
				.filter(j => j?.VehicleLocation?.Latitude && j?.VehicleLocation?.Longitude)
				.map(j => ({
					ref: j.VehicleRef ?? null,
					lat: parseFloat(j.VehicleLocation.Latitude),
					lon: parseFloat(j.VehicleLocation.Longitude),
					line: j.LineRef ?? '',
					direction: j.DirectionRef ?? ''
				}));

			this._updateHistory(this._vehicles);
			this._lastUpdated = new Date();
			this._error = null;
		} catch (e) {
			if (e.name !== 'AbortError') {
				this._error = 'fetch failed';
			}
		}

		this._render();
	}

	_updateHistory(vehicles) {
		for (const v of vehicles) {
			if (!v.ref) continue;
			const trail = this._history.get(v.ref) ?? [];
			const last = trail[trail.length - 1];
			if (last && last.lat === v.lat && last.lon === v.lon) continue; // no movement, skip
			trail.push({ lat: v.lat, lon: v.lon, line: v.line });
			if (trail.length > MUNI_HISTORY_MAX) trail.shift();
			this._history.set(v.ref, trail);
		}

		// Remove history for vehicles no longer reporting
		const activeRefs = new Set(vehicles.map(v => v.ref).filter(Boolean));
		for (const ref of this._history.keys()) {
			if (!activeRefs.has(ref)) this._history.delete(ref);
		}
	}

	_project(lat, lon) {
		const { minLat, maxLat, minLon, maxLon } = MUNI_SF_BOUNDS;
		const x = ((lon - minLon) / (maxLon - minLon)) * this.canvas.width;
		const y = (1 - (lat - minLat) / (maxLat - minLat)) * this.canvas.height;
		return { x, y };
	}

	_routeColor(line) {
		const prefix = (line || '').replace(/[^A-Za-z]/, '').toUpperCase().charAt(0);
		return MUNI_ROUTE_COLORS[prefix] ?? MUNI_ROUTE_COLORS['default'];
	}

	_render() {
		const ctx = this.ctx;
		const w = this.canvas.width;
		const h = this.canvas.height;

		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, w, h);

		if (MUNI_API_KEY === 'MUNI_API_KEY_PLACEHOLDER' && !window.MUNI_LOCAL_KEY) {
			ctx.fillStyle = 'rgba(255,255,255,0.4)';
			ctx.font = '14px Courier New';
			ctx.textAlign = 'center';
			ctx.fillText('MUNI_API_KEY not configured', w / 2, h / 2);
			return;
		}

		if (this._error) {
			ctx.fillStyle = 'rgba(255,255,255,0.4)';
			ctx.font = '14px Courier New';
			ctx.textAlign = 'center';
			ctx.fillText(this._error, w / 2, h / 2);
			return;
		}

		// Draw history trails as tapered, fading line segments
		for (const [, trail] of this._history) {
			if (trail.length < 2) continue;
			const color = this._routeColor(trail[trail.length - 1].line);

			for (let i = 1; i < trail.length; i++) {
				const tPrev = (i - 1) / (trail.length - 1); // 0 = oldest
				const tCurr = i       / (trail.length - 1); // 1 = newest

				const prev = this._project(trail[i - 1].lat, trail[i - 1].lon);
				const curr = this._project(trail[i].lat,     trail[i].lon);

				const dx = curr.x - prev.x;
				const dy = curr.y - prev.y;
				const len = Math.sqrt(dx * dx + dy * dy) || 1;
				const nx = -dy / len; // perpendicular
				const ny =  dx / len;

				const wPrev = 0.25 + tPrev * 2;
				const wCurr = 0.25 + tCurr * 2;

				const toHex = t => Math.round(t * 0.75 * 255).toString(16).padStart(2, '0');
				const grad = ctx.createLinearGradient(prev.x, prev.y, curr.x, curr.y);
				grad.addColorStop(0, color + toHex(tPrev));
				grad.addColorStop(1, color + toHex(tCurr));

				ctx.beginPath();
				ctx.moveTo(prev.x + nx * wPrev, prev.y + ny * wPrev);
				ctx.lineTo(curr.x + nx * wCurr, curr.y + ny * wCurr);
				ctx.lineTo(curr.x - nx * wCurr, curr.y - ny * wCurr);
				ctx.lineTo(prev.x - nx * wPrev, prev.y - ny * wPrev);
				ctx.closePath();
				ctx.fillStyle = grad;
				ctx.fill();
			}
		}

		// Draw current vehicle positions
		for (const v of this._vehicles) {
			const { x, y } = this._project(v.lat, v.lon);
			const color = this._routeColor(v.line);
			ctx.beginPath();
			ctx.arc(x, y, 4, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		}

		// HUD
		ctx.textAlign = 'left';
		ctx.fillStyle = 'rgba(255,255,255,0.25)';
		ctx.font = '12px Courier New';
		ctx.fillText('MUNI', 16, h - 32);
		ctx.fillText(`${this._vehicles.length} vehicles`, 16, h - 16);

		if (this._lastUpdated) {
			const timeStr = this._lastUpdated.toLocaleTimeString();
			ctx.textAlign = 'right';
			ctx.fillText(`updated ${timeStr}`, w - 16, h - 16);
		}
	}
}
