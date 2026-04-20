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

const MUNI_POLL_INTERVAL = 30000;  // ms — keep conservative for dev; tune for prod
const MUNI_HISTORY_MAX  = 20;     // snapshots retained per vehicle (~100s at 5s)
const MUNI_ZOOM_MIN     = 0.5;
const MUNI_ZOOM_MAX     = 20;

class MuniEngine {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this._interval = null;
		this._abortController = null;
		this._isLoading = true;
		this._vehicles = [];
		this._history = new Map(); // vehicleRef -> [{lat, lon, line}]
		this._lastUpdated = null;
		this._failCount = 0;

		// View transform: translate then scale
		this._view = { scale: 1, x: 0, y: 0 };

		// Drag/pinch interaction state
		this._drag  = null; // { startX, startY, startViewX, startViewY }
		this._pinch = null; // { startDist, startScale, startMidX, startMidY, startViewX, startViewY }

		// Bound handlers for clean removal
		this._onWheel      = this._onWheel.bind(this);
		this._onMouseDown  = this._onMouseDown.bind(this);
		this._onMouseMove  = this._onMouseMove.bind(this);
		this._onMouseUp    = this._onMouseUp.bind(this);
		this._onTouchStart = this._onTouchStart.bind(this);
		this._onTouchMove  = this._onTouchMove.bind(this);
		this._onTouchEnd   = this._onTouchEnd.bind(this);
	}

	start() {
		this._bindEvents();
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
		this._unbindEvents();
	}

	// ── Event binding ─────────────────────────────────────────────────────────

	_bindEvents() {
		const c = this.canvas;
		c.style.cursor = 'grab';
		c.addEventListener('wheel',      this._onWheel,      { passive: false });
		c.addEventListener('mousedown',  this._onMouseDown);
		window.addEventListener('mousemove', this._onMouseMove);
		window.addEventListener('mouseup',   this._onMouseUp);
		c.addEventListener('touchstart', this._onTouchStart, { passive: false });
		c.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
		c.addEventListener('touchend',   this._onTouchEnd);
	}

	_unbindEvents() {
		const c = this.canvas;
		c.removeEventListener('wheel',      this._onWheel);
		c.removeEventListener('mousedown',  this._onMouseDown);
		window.removeEventListener('mousemove', this._onMouseMove);
		window.removeEventListener('mouseup',   this._onMouseUp);
		c.removeEventListener('touchstart', this._onTouchStart);
		c.removeEventListener('touchmove',  this._onTouchMove);
		c.removeEventListener('touchend',   this._onTouchEnd);
	}

	// ── Interaction helpers ───────────────────────────────────────────────────

	// Convert client coords → canvas logical pixel coords
	_clientToCanvas(clientX, clientY) {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (clientX - rect.left) * (this.canvas.width  / rect.width),
			y: (clientY - rect.top)  * (this.canvas.height / rect.height)
		};
	}

	_pinchDist(touches) {
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// Zoom the view so that the canvas point (px, py) stays fixed on screen
	_applyZoom(px, py, factor) {
		const newScale = Math.max(MUNI_ZOOM_MIN, Math.min(MUNI_ZOOM_MAX, this._view.scale * factor));
		const ratio    = newScale / this._view.scale;
		this._view.x   = px - ratio * (px - this._view.x);
		this._view.y   = py - ratio * (py - this._view.y);
		this._view.scale = newScale;
	}

	// ── Mouse handlers ────────────────────────────────────────────────────────

	_onWheel(e) {
		e.preventDefault();
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
		this._applyZoom(x, y, e.deltaY < 0 ? 1.02 : 0.98);
		this._render();
	}

	_onMouseDown(e) {
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
		this._drag = { startX: x, startY: y, startViewX: this._view.x, startViewY: this._view.y };
		this.canvas.style.cursor = 'grabbing';
	}

	_onMouseMove(e) {
		if (!this._drag) return;
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
		this._view.x = this._drag.startViewX + (x - this._drag.startX);
		this._view.y = this._drag.startViewY + (y - this._drag.startY);
		this._render();
	}

	_onMouseUp() {
		this._drag = null;
		this.canvas.style.cursor = 'grab';
	}

	// ── Touch handlers ────────────────────────────────────────────────────────

	_onTouchStart(e) {
		e.preventDefault();
		if (e.touches.length === 2) {
			this._drag = null;
			const rect = this.canvas.getBoundingClientRect();
			const scaleX = this.canvas.width  / rect.width;
			const scaleY = this.canvas.height / rect.height;
			this._pinch = {
				startDist:  this._pinchDist(e.touches),
				startScale: this._view.scale,
				startMidX:  ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * scaleX,
				startMidY:  ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top)  * scaleY,
				startViewX: this._view.x,
				startViewY: this._view.y
			};
		} else if (e.touches.length === 1) {
			this._pinch = null;
			const { x, y } = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
			this._drag = { startX: x, startY: y, startViewX: this._view.x, startViewY: this._view.y };
		}
	}

	_onTouchMove(e) {
		e.preventDefault();
		if (e.touches.length === 2 && this._pinch) {
			const dist      = this._pinchDist(e.touches);
			const ratio     = dist / this._pinch.startDist;
			const newScale  = Math.max(MUNI_ZOOM_MIN, Math.min(MUNI_ZOOM_MAX, this._pinch.startScale * ratio));
			const actualRatio = newScale / this._pinch.startScale;

			const rect   = this.canvas.getBoundingClientRect();
			const scaleX = this.canvas.width  / rect.width;
			const scaleY = this.canvas.height / rect.height;
			const midX   = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * scaleX;
			const midY   = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top)  * scaleY;

			// Keep the world point under the pinch midpoint fixed, plus translate with midpoint drift
			this._view.x     = midX - actualRatio * (this._pinch.startMidX - this._pinch.startViewX);
			this._view.y     = midY - actualRatio * (this._pinch.startMidY - this._pinch.startViewY);
			this._view.scale = newScale;
			this._render();
		} else if (e.touches.length === 1 && this._drag) {
			const { x, y } = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
			this._view.x = this._drag.startViewX + (x - this._drag.startX);
			this._view.y = this._drag.startViewY + (y - this._drag.startY);
			this._render();
		}
	}

	_onTouchEnd(e) {
		if (e.touches.length === 0) {
			this._drag  = null;
			this._pinch = null;
		} else if (e.touches.length === 1) {
			// Transition from pinch back to single-finger pan
			this._pinch = null;
			const { x, y } = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
			this._drag = { startX: x, startY: y, startViewX: this._view.x, startViewY: this._view.y };
		}
	}

	// ── Data ──────────────────────────────────────────────────────────────────

	async _fetch() {
		const apiKey = window.MUNI_LOCAL_KEY ?? MUNI_API_KEY;

		if (apiKey === 'MUNI_API_KEY_PLACEHOLDER') {
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
			this._isLoading = false;
			this._failCount = 0;

			// Remove CSS spinner on first successful fetch
			const spinner = document.getElementById('muni-spinner');
			if (spinner) spinner.remove();
		} catch (e) {
			if (e.name !== 'AbortError') {
				this._failCount++;
				console.error('[MuniEngine] fetch failed:', e.name, e.message);
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

	// ── Projection ────────────────────────────────────────────────────────────

	// Maps lat/lon → canvas pixel coords in world space (unaffected by view transform)
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

	// ── Render ────────────────────────────────────────────────────────────────

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

		if (this._isLoading) return; // spinner is CSS, nothing to draw yet

		// ── World-space drawing (affected by pan/zoom) ──
		ctx.save();
		ctx.translate(this._view.x, this._view.y);
		ctx.scale(this._view.scale, this._view.scale);

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

		ctx.restore(); // ── End world-space transform ──

		// ── HUD — always fixed in screen-space corners ──
		ctx.font = '12px Courier New';
		ctx.textAlign = 'left';
		ctx.fillStyle = 'rgba(255,255,255,0.25)';
		ctx.fillText('MUNI', 16, h - 32);
		ctx.fillText(`${this._vehicles.length} vehicles`, 16, h - 16);

		if (this._lastUpdated) {
			ctx.textAlign = 'right';
			if (this._failCount > 0) {
				ctx.fillStyle = 'rgba(255,100,100,0.6)';
				ctx.fillText(`${this._failCount} failed`, w - 16, h - 32);
				ctx.fillStyle = 'rgba(255,255,255,0.25)';
			}
			ctx.fillText(`updated ${this._lastUpdated.toLocaleTimeString()}`, w - 16, h - 16);
		}
	}
}
