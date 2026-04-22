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
	'J': '#e07820', // J-Church — amber orange
	'K': '#52b4c0', // K-Ingleside — teal
	'L': '#7b3fa8', // L-Taraval — purple
	'M': '#2a8a45', // M-Ocean View — forest green
	'N': '#1a607a', // N-Judah — dark slate teal
	'T': '#cc2828', // T-Third Street — red
	'F': '#c8a020', // F-Market — gold (historic streetcar)
	'default': '#ffffff'
};

// Category definitions — order matters (metro first, bus catch-all last)
const MUNI_CATEGORIES = [
	{ id: 'lightrail', label: 'METRO', prefixes: new Set(['F', 'J', 'K', 'L', 'M', 'N', 'T']) },
	{ id: 'bus',       label: 'BUS',   prefixes: null } // catch-all
];

// Map overlay categories — separate from live vehicle categories
const MUNI_OVERLAY_CATEGORIES = [
	{ id: 'stops', label: 'STOPS' }
];

const MUNI_POLL_INTERVAL   = 15000; // ms — SFMTA source refreshes every ~30s
const MUNI_ANIM_DURATION   = 15000; // ms — starting animation duration (adapts to real fetch interval)
const MUNI_RUSH_DURATION   =  3000; // ms — rush remaining animation when new data interrupts
const MUNI_HISTORY_MAX     = 6;     // snapshots retained per vehicle
const MUNI_ZOOM_MIN        = 1;
const MUNI_ZOOM_MAX        = 20;
const MUNI_PANEL_CAT_H  = 18; // category header row height px
const MUNI_PANEL_ITEM_H = 22; // route row height px

class MuniEngine {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this._interval = null;
		this._rafId = null;
		this._abortController = null;
		this._isLoading = true;
		this._vehicles = [];
		this._history = new Map(); // vehicleRef -> [{lat, lon, line}]
		this._lastUpdated = null;
		this._lastFetchTime = null;
		this._avgFetchInterval = MUNI_ANIM_DURATION; // ms, adapts via running average
		this._failCount = 0;

		// World dimensions — fixed at construction so _project is stable across resizes
		this._worldW = canvas.width;
		this._worldH = canvas.height;

		// Precompute uniform projection scale (xscale = yscale, with cos-lat correction)
		const _cosLat = Math.cos((MUNI_SF_BOUNDS.minLat + MUNI_SF_BOUNDS.maxLat) / 2 * Math.PI / 180);
		this._projScale  = Math.min(
			this._worldW / ((MUNI_SF_BOUNDS.maxLon - MUNI_SF_BOUNDS.minLon) * _cosLat),
			this._worldH /  (MUNI_SF_BOUNDS.maxLat - MUNI_SF_BOUNDS.minLat)
		);
		this._projCosLat = _cosLat;

		// View transform: translate then scale — zoom to fill screen, centered
		const _mapW = (MUNI_SF_BOUNDS.maxLon - MUNI_SF_BOUNDS.minLon) * _cosLat * this._projScale;
		const _mapH = (MUNI_SF_BOUNDS.maxLat - MUNI_SF_BOUNDS.minLat) * this._projScale;
		const _fillScale = Math.max(this._worldW / _mapW, this._worldH / _mapH);
		this._view = { scale: _fillScale, x: (this._worldW - _mapW * _fillScale) / 2, y: (this._worldH - _mapH * _fillScale) / 2 };

		// Drag/pinch interaction state
		this._drag       = null;  // { startX, startY, startViewX, startViewY }
		this._pinch      = null;  // { startDist, startScale, startMidX, startMidY, startViewX, startViewY }
		this._hasDragged = false; // true once pointer moves > 4px
		this._touchMoved = false;

		// Panel scroll state
		this._catScrollY      = { lightrail: 0, bus: 0 };
		this._catListH        = { lightrail: 0, bus: 0 }; // actual clip height — set each render
		this._panelRouteAreas = []; // rebuilt each _drawPanel — rects where wheel/drag scrolls
		this._panelScroll     = null; // { catId, startCanvasY, startScrollY } during drag-scroll

		// Route visibility state
		this._catVisible   = { lightrail: true, bus: true };
		this._catExpanded  = { lightrail: false, bus: false };
		this._routeVisible = new Map([['OOS', false]]);  // lineRef -> bool (absent = true)
		this._knownRoutes  = new Map();  // lineRef -> catId
		this._sortedRoutes = { lightrail: [], bus: [] };
		this._hitTargets   = [];         // rebuilt each _drawPanel call

		// Static map overlay data (fetched once on start)
		this._stopPoints     = new Map();  // stopId -> { lat, lon, name, lines: Set<lineRef> }
		this._lineShapes     = new Map();  // lineRef -> [[{lat,lon},...]] lazy cache, fetched on select
		this._overlayVisible = { stops: true };

		// Selected route — shows shape + highlighted stops
		this._selectedRoute  = null;

		// Bound handlers for clean removal
		this._onWheel      = this._onWheel.bind(this);
		this._onMouseDown  = this._onMouseDown.bind(this);
		this._onMouseMove  = this._onMouseMove.bind(this);
		this._onMouseUp    = this._onMouseUp.bind(this);
		this._onTouchStart = this._onTouchStart.bind(this);
		this._onTouchMove  = this._onTouchMove.bind(this);
		this._onTouchEnd   = this._onTouchEnd.bind(this);
		this._onResize     = this._onResize.bind(this);
		this._animLoop     = this._animLoop.bind(this);
	}

	start() {
		this._bindEvents();
		this._fetchStatic();
		this._fetch();
		this._interval = setInterval(() => this._fetch(), MUNI_POLL_INTERVAL);
		this._rafId = requestAnimationFrame(this._animLoop);
	}

	stop() {
		clearInterval(this._interval);
		this._interval = null;
		if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
		if (this._abortController) {
			this._abortController.abort();
			this._abortController = null;
		}
		this._unbindEvents();
	}

	_animLoop() {
		this._advancePending();
		this._render();
		this._rafId = requestAnimationFrame(this._animLoop);
	}

	_advancePending() {
		const now = Date.now();
		for (const v of this._vehicles) {
			if (v.pendingLat === undefined) continue;
			const duration = v.animDuration ?? this._avgFetchInterval;
			if ((now - v.animStart) / duration < 1) continue;
			// Rush complete — promote pending to active animation
			v.fromLat = v.lat;
			v.fromLon = v.lon;
			v.lat = v.pendingLat;
			v.lon = v.pendingLon;
			v.animStart = now;
			delete v.animDuration;
			delete v.pendingLat;
			delete v.pendingLon;
		}
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
		window.addEventListener('resize', this._onResize);
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
		window.removeEventListener('resize', this._onResize);
	}

	// ── Interaction helpers ───────────────────────────────────────────────────

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

	_applyZoom(px, py, factor) {
		const newScale = Math.max(MUNI_ZOOM_MIN, Math.min(MUNI_ZOOM_MAX, this._view.scale * factor));
		const ratio    = newScale / this._view.scale;
		this._view.x   = px - ratio * (px - this._view.x);
		this._view.y   = py - ratio * (py - this._view.y);
		this._view.scale = newScale;
	}

	_onResize() {
		this.canvas.width  = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this._render();
	}

	_inPanelRouteArea(x, y) {
		return this._panelRouteAreas.find(a =>
			x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) ?? null;
	}

	// ── Mouse handlers ────────────────────────────────────────────────────────

	_onWheel(e) {
		e.preventDefault();
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
		const area = this._inPanelRouteArea(x, y);
		if (area) {
			this._scrollCat(area.catId, e.deltaY * 0.4);
		} else {
			this._applyZoom(x, y, e.deltaY < 0 ? 1.02 : 0.98);
			this._render();
		}
	}

	_onMouseDown(e) {
		this._hasDragged = false;
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
		const area = this._inPanelRouteArea(x, y);
		if (area) {
			this._panelScroll = { catId: area.catId, startCanvasY: y, startScrollY: this._catScrollY[area.catId] };
		} else {
			this._drag = { startX: x, startY: y, startViewX: this._view.x, startViewY: this._view.y };
			this.canvas.style.cursor = 'grabbing';
		}
	}

	_onMouseMove(e) {
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);

		if (this._panelScroll) {
			const dy = y - this._panelScroll.startCanvasY;
			if (!this._hasDragged && Math.abs(dy) > 4) this._hasDragged = true;
			this._scrollCatTo(this._panelScroll.catId, this._panelScroll.startScrollY - dy);
			return;
		}

		if (!this._drag) return;
		const dx = x - this._drag.startX;
		const dy = y - this._drag.startY;
		if (!this._hasDragged && (dx * dx + dy * dy > 16)) this._hasDragged = true;
		this._view.x = this._drag.startViewX + dx;
		this._view.y = this._drag.startViewY + dy;
		this._render();
	}

	_onMouseUp(e) {
		if (this._panelScroll) {
			if (!this._hasDragged) {
				const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
				this._handleClick(x, y);
			}
			this._panelScroll = null;
			this._hasDragged = false;
			return;
		}
		if (this._drag && !this._hasDragged) {
			const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
			this._handleClick(x, y);
		}
		this._drag = null;
		this._hasDragged = false;
		this.canvas.style.cursor = 'grab';
	}

	// ── Touch handlers ────────────────────────────────────────────────────────

	_onTouchStart(e) {
		e.preventDefault();
		if (e.touches.length === 2) {
			this._drag        = null;
			this._panelScroll = null;
			this._touchMoved  = false;
			const rect   = this.canvas.getBoundingClientRect();
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
			this._pinch      = null;
			this._touchMoved = false;
			const { x, y }  = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
			const area = this._inPanelRouteArea(x, y);
			if (area) {
				this._panelScroll = { catId: area.catId, startCanvasY: y, startScrollY: this._catScrollY[area.catId] };
			} else {
				this._drag = { startX: x, startY: y, startViewX: this._view.x, startViewY: this._view.y };
			}
		}
	}

	_onTouchMove(e) {
		e.preventDefault();
		if (e.touches.length === 2 && this._pinch) {
			const dist        = this._pinchDist(e.touches);
			const ratio       = dist / this._pinch.startDist;
			const newScale    = Math.max(MUNI_ZOOM_MIN, Math.min(MUNI_ZOOM_MAX, this._pinch.startScale * ratio));
			const actualRatio = newScale / this._pinch.startScale;
			const rect   = this.canvas.getBoundingClientRect();
			const scaleX = this.canvas.width  / rect.width;
			const scaleY = this.canvas.height / rect.height;
			const midX   = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * scaleX;
			const midY   = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top)  * scaleY;
			this._view.x     = midX - actualRatio * (this._pinch.startMidX - this._pinch.startViewX);
			this._view.y     = midY - actualRatio * (this._pinch.startMidY - this._pinch.startViewY);
			this._view.scale = newScale;
			this._render();
		} else if (e.touches.length === 1) {
			const { x, y } = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
			if (this._panelScroll) {
				const dy = y - this._panelScroll.startCanvasY;
				if (!this._touchMoved && Math.abs(dy) > 4) this._touchMoved = true;
				this._scrollCatTo(this._panelScroll.catId, this._panelScroll.startScrollY - dy);
				return;
			}
			if (this._drag) {
				const dx = x - this._drag.startX;
				const dy = y - this._drag.startY;
				if (!this._touchMoved && (dx * dx + dy * dy > 16)) this._touchMoved = true;
				this._view.x = this._drag.startViewX + dx;
				this._view.y = this._drag.startViewY + dy;
				this._render();
			}
		}
	}

	_onTouchEnd(e) {
		if (e.touches.length === 0) {
			if (this._panelScroll) {
				if (!this._touchMoved) {
					const t = e.changedTouches[0];
					const { x, y } = this._clientToCanvas(t.clientX, t.clientY);
					this._handleClick(x, y);
				}
				this._panelScroll = null;
				this._touchMoved  = false;
				return;
			}
			if (this._drag && !this._touchMoved) {
				const t = e.changedTouches[0];
				const { x, y } = this._clientToCanvas(t.clientX, t.clientY);
				this._handleClick(x, y);
			}
			this._drag       = null;
			this._pinch      = null;
			this._touchMoved = false;
		} else if (e.touches.length === 1) {
			this._panelScroll = null;
			this._pinch       = null;
			this._touchMoved  = false;
			const { x, y }   = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
			this._drag = { startX: x, startY: y, startViewX: this._view.x, startViewY: this._view.y };
		}
	}

	// ── Panel scroll helpers ──────────────────────────────────────────────────

	_catListMaxScroll(catId) {
		const routes = this._sortedRoutes[catId] || [];
		return Math.max(0, routes.length * MUNI_PANEL_ITEM_H - this._catListH[catId]);
	}

	// Scroll by delta (relative)
	_scrollCat(catId, delta) {
		this._catScrollY[catId] = Math.max(0, Math.min(this._catListMaxScroll(catId), this._catScrollY[catId] + delta));
		this._render();
	}

	// Scroll to absolute value
	_scrollCatTo(catId, value) {
		this._catScrollY[catId] = Math.max(0, Math.min(this._catListMaxScroll(catId), value));
		this._render();
	}

	// ── Route visibility ──────────────────────────────────────────────────────

	_classifyRoute(lineRef) {
		const prefix = (lineRef || '').replace(/[^A-Za-z]/g, '').toUpperCase().charAt(0);
		for (const cat of MUNI_CATEGORIES) {
			if (cat.prefixes && cat.prefixes.has(prefix)) return cat.id;
		}
		return 'bus';
	}

	_isVisible(lineRef) {
		const catId = this._classifyRoute(lineRef);
		if (!this._catVisible[catId]) return false;
		return this._routeVisible.get(lineRef) !== false;
	}

	_registerRoute(lineRef) {
		if (!lineRef || this._knownRoutes.has(lineRef)) return;
		const catId = this._classifyRoute(lineRef);
		this._knownRoutes.set(lineRef, catId);
		this._sortedRoutes[catId].push(lineRef);
		this._sortRoutes(catId);
	}

	_sortRoutes(catId) {
		const cat = MUNI_CATEGORIES.find(c => c.id === catId);
		this._sortedRoutes[catId].sort((a, b) => {
			if (a === 'OOS') return 1;  // OOS always last
			if (b === 'OOS') return -1;
			if (cat.prefixes) return a.localeCompare(b);
			const an = parseInt(a), bn = parseInt(b);
			if (!isNaN(an) && !isNaN(bn)) return an - bn;
			if (!isNaN(an)) return -1;
			if (!isNaN(bn)) return 1;
			return a.localeCompare(b);
		});
	}

	_toggleCategory(catId) {
		this._catVisible[catId] = !this._catVisible[catId];
		this._render();
	}

	_toggleExpand(catId) {
		this._catExpanded[catId] = !this._catExpanded[catId];
		this._render();
	}

	_toggleRoute(lineRef) {
		this._routeVisible.set(lineRef, this._routeVisible.get(lineRef) === false);
		this._render();
	}

	_toggleOverlay(id) {
		this._overlayVisible[id] = !this._overlayVisible[id];
		this._render();
	}

	_selectRoute(lineRef) {
		if (this._selectedRoute === lineRef) {
			this._selectedRoute = null;
			this._render();
			return;
		}
		this._selectedRoute = lineRef;
		this._render();
		// Fetch pattern lazily on first selection
		if (!this._lineShapes.has(lineRef)) this._fetchLinePattern(lineRef);
	}

	// ── Panel hit testing ─────────────────────────────────────────────────────

	_handleClick(cx, cy) {
		for (const t of this._hitTargets) {
			if (cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.h) {
				t.action();
				return;
			}
		}
	}

	// ── Data ──────────────────────────────────────────────────────────────────

	async _fetchStatic() {
		const apiKey = window.MUNI_LOCAL_KEY ?? MUNI_API_KEY;
		if (apiKey === 'MUNI_API_KEY_PLACEHOLDER') return;
		await this._fetchStops(apiKey);
		this._render();
	}

	async _fetchStops(apiKey) {
		try {
			const url = `https://api.511.org/transit/stops?api_key=${apiKey}&operator_id=SF&format=json`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();

			const raw = data?.Contents?.dataObjects?.ScheduledStopPoint
			         ?? data?.stopPoints
			         ?? [];
			for (const stop of raw) {
				const id  = stop.id  ?? stop.Id;
				const lat = parseFloat(stop.Location?.Latitude  ?? stop.lat ?? 0);
				const lon = parseFloat(stop.Location?.Longitude ?? stop.lon ?? 0);
				const name = stop.Name ?? stop.name ?? '';
				if (!id || !lat || !lon) continue;
				this._stopPoints.set(String(id), { lat, lon, name, lines: new Set() });
			}
		} catch (e) {
			console.error('[MuniEngine] stops fetch failed:', e);
		}
	}

	async _fetchLinePattern(lineRef) {
		const apiKey = window.MUNI_LOCAL_KEY ?? MUNI_API_KEY;
		if (apiKey === 'MUNI_API_KEY_PLACEHOLDER') return;
		try {
			const url = `https://api.511.org/transit/patterns?api_key=${apiKey}&operator_id=SF&line_id=${encodeURIComponent(lineRef)}&format=json`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();

			const patterns = data.journeyPatterns ?? data.JourneyPatterns ?? [];
			const shapes = [];
			for (const pattern of patterns) {
				const rawSeq = pattern.PointsInSequence?.StopPointInJourneyPattern
				            ?? pattern.pointsInSequence?.StopPointInJourneyPattern;
				if (!rawSeq) continue;
				const stopsInSeq = Array.isArray(rawSeq) ? rawSeq : [rawSeq];
				const sorted = [...stopsInSeq].sort((a, b) =>
					(a.Order ?? a.order ?? 0) - (b.Order ?? b.order ?? 0)
				);
				const coords = [];
				for (const sp of sorted) {
					const stopId = String(sp.ScheduledStopPointRef ?? sp.scheduledStopPointRef ?? '');
					const stop   = this._stopPoints.get(stopId);
					if (!stop) continue;
					stop.lines.add(lineRef);
					coords.push({ lat: stop.lat, lon: stop.lon, stopId });
				}
				if (coords.length >= 2) shapes.push(coords);
			}
			this._lineShapes.set(lineRef, shapes);
			this._render();
		} catch (e) {
			console.error(`[MuniEngine] pattern fetch failed for ${lineRef}:`, e);
		}
	}

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
			const prevById = new Map(this._vehicles.map(v => [v.ref, v]));
			const now = Date.now();

			// Update running average of real fetch interval (clamped to avoid tab-background spikes)
			if (this._lastFetchTime) {
				const dt = Math.max(5000, Math.min(60000, now - this._lastFetchTime));
				this._avgFetchInterval = 0.25 * dt + 0.75 * this._avgFetchInterval;
			}
			this._lastFetchTime = now;

			this._vehicles = activities
				.map(a => a?.MonitoredVehicleJourney)
				.filter(j => j?.VehicleLocation?.Latitude && j?.VehicleLocation?.Longitude)
				.map(j => {
					const lat  = parseFloat(j.VehicleLocation.Latitude);
					const lon  = parseFloat(j.VehicleLocation.Longitude);
					const prev = j.VehicleRef ? prevById.get(j.VehicleRef) : null;
					const base = { ref: j.VehicleRef ?? null, lat, lon, line: j.LineRef || 'OOS' };

					if (!prev) {
						// New vehicle — appear immediately at reported position
						return { ...base, fromLat: lat, fromLon: lon, animStart: now - this._avgFetchInterval };
					}

					const elapsed  = now - prev.animStart;
					const duration = prev.animDuration ?? this._avgFetchInterval;
					if (elapsed >= duration) {
						// Previous animation already complete — start fresh from destination
						return { ...base, fromLat: prev.lat, fromLon: prev.lon, animStart: now };
					}

					// Mid-animation — rush current leg to completion, then start new animation
					const animPos = this._animatedPos(prev);
					return {
						...base,
						lat:          prev.lat,       // finish rushing to the old destination
						lon:          prev.lon,
						fromLat:      animPos.lat,    // from wherever the dot is right now
						fromLon:      animPos.lon,
						animStart:    now,
						animDuration: MUNI_RUSH_DURATION,
						pendingLat:   lat,            // new destination waits its turn
						pendingLon:   lon
					};
				});

			this._updateHistory(this._vehicles);
			this._lastUpdated = new Date();
			this._isLoading = false;
			this._failCount = 0;

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
			this._registerRoute(v.line);

			if (!v.ref) continue;
			const trail = this._history.get(v.ref) ?? [];
			const last = trail[trail.length - 1];
			// Record where the dot was when this data arrived (fromLat/fromLon),
			// not the destination — the animated head covers the live segment
			if (last && last.lat === v.fromLat && last.lon === v.fromLon) continue;
			trail.push({ lat: v.fromLat, lon: v.fromLon, line: v.line });
			if (trail.length > MUNI_HISTORY_MAX) trail.shift();
			this._history.set(v.ref, trail);
		}

		const activeRefs = new Set(vehicles.map(v => v.ref).filter(Boolean));
		for (const ref of this._history.keys()) {
			if (!activeRefs.has(ref)) this._history.delete(ref);
		}
	}

	// ── Projection ────────────────────────────────────────────────────────────

	_project(lat, lon) {
		const x = (lon - MUNI_SF_BOUNDS.minLon) * this._projCosLat * this._projScale;
		const y = (MUNI_SF_BOUNDS.maxLat - lat) * this._projScale;
		return { x, y };
	}

	_animatedPos(v) {
		if (!v.animStart) return { lat: v.lat, lon: v.lon };
		const duration = v.animDuration ?? this._avgFetchInterval;
		const t     = Math.min(1, (Date.now() - v.animStart) / duration);
		const eased = t * t * (3 - 2 * t); // smoothstep ease-in/ease-out
		return {
			lat: v.fromLat + (v.lat - v.fromLat) * eased,
			lon: v.fromLon + (v.lon - v.fromLon) * eased
		};
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

		if (this._isLoading) return;

		// ── World-space drawing (affected by pan/zoom) ──
		ctx.save();
		ctx.translate(this._view.x, this._view.y);
		ctx.scale(this._view.scale, this._view.scale);

		ctx.lineJoin = 'round';
		ctx.lineCap  = 'round';

		// ── Selected route shape (behind trails) ──
		if (this._selectedRoute) {
			const segments = this._lineShapes.get(this._selectedRoute) ?? [];
			const color    = this._routeColor(this._selectedRoute);
			ctx.strokeStyle = color;
			ctx.lineWidth   = 2.5;
			ctx.globalAlpha = 0.7;
			for (const seg of segments) {
				if (seg.length < 2) continue;
				ctx.beginPath();
				const p0 = this._project(seg[0].lat, seg[0].lon);
				ctx.moveTo(p0.x, p0.y);
				for (let i = 1; i < seg.length; i++) {
					const p = this._project(seg[i].lat, seg[i].lon);
					ctx.lineTo(p.x, p.y);
				}
				ctx.stroke();
			}
			ctx.globalAlpha = 1.0;
		}

		// ── Stop overlays ──
		if (this._overlayVisible.stops && this._stopPoints.size > 0) {
			const sel = this._selectedRoute;
			for (const [, stop] of this._stopPoints) {
				if (stop.lines.size > 0 && ![...stop.lines].some(l => this._isVisible(l))) continue;
				const onSelected = sel && stop.lines.has(sel);
				const { x, y } = this._project(stop.lat, stop.lon);
				ctx.beginPath();
				if (onSelected) {
					ctx.arc(x, y, 2.5, 0, Math.PI * 2);
					ctx.fillStyle = this._routeColor(sel);
				} else {
					ctx.arc(x, y, 0.66, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255,255,255,0.5)';
				}
				ctx.fill();
			}
		}

		const vehicleByRef = new Map(this._vehicles.map(v => [v.ref, v]));

		for (const [ref, trail] of this._history) {
			if (trail.length < 1) continue;
			if (!this._isVisible(trail[trail.length - 1].line)) continue;

			const color = this._routeColor(trail[trail.length - 1].line);

			// Append current animated position as the trail head so it follows the dot live
			const v    = vehicleByRef.get(ref);
			const head = v ? this._animatedPos(v) : { lat: trail[trail.length - 1].lat, lon: trail[trail.length - 1].lon };
			const pts  = [
				...trail.map(p => this._project(p.lat, p.lon)),
				this._project(head.lat, head.lon)
			];
			const first = pts[0];
			const last  = pts[pts.length - 1];

			// Gradient aligned to overall travel direction (transparent tail → opaque head)
			const grad = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
			grad.addColorStop(0, color + '00');
			grad.addColorStop(1, color + 'bf');

			ctx.beginPath();
			ctx.moveTo(first.x, first.y);
			for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

			ctx.strokeStyle = grad;
			ctx.lineWidth   = 2;
			ctx.stroke();
		}

		for (const v of this._vehicles) {
			if (!this._isVisible(v.line)) continue;
			const pos = this._animatedPos(v);
			const { x, y } = this._project(pos.lat, pos.lon);
			const color = this._routeColor(v.line);
			ctx.beginPath();
			ctx.arc(x, y, 4, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		}

		ctx.restore(); // ── End world-space transform ──

		// ── HUD — fixed screen-space corners ──
		ctx.font = '14px Courier New';
		ctx.textAlign = 'left';
		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.fillText('MUNI', 16, h - 32);
		ctx.fillText(`${this._vehicles.length} active vehicles`, 16, h - 16);

		if (this._lastUpdated) {
			ctx.textAlign = 'right';
			if (this._failCount > 0) {
				ctx.fillStyle = 'rgba(255,100,100,0.8)';
				ctx.fillText(`${this._failCount} failed`, w - 16, h - 32);
				ctx.fillStyle = 'rgba(255,255,255,0.55)';
			}
			ctx.fillText(`updated ${this._lastUpdated.toLocaleTimeString()}`, w - 16, h - 16);
		}

		// ── Route visibility panel (top-right) ──
		this._drawPanel();
	}

	// ── Panel ─────────────────────────────────────────────────────────────────

	_drawPanel() {
		const ctx   = this.ctx;
		const w     = this.canvas.width;
		const dotX  = w - 16;  // visibility dot right edge
		const lblX  = w - 32;  // label text right edge (gap before dot)
		let y = 26;

		this._hitTargets      = [];
		this._panelRouteAreas = [];

		// Pre-pass: compute panel height and minimum left edge for backdrop
		ctx.font = '16px Courier New';
		let scanY = 26;
		let minX  = lblX; // will be pushed left by widest text
		let lastContentBottom = 30; // fallback: first row baseline + descender
		for (const cat of MUNI_CATEGORIES) {
			const catLabelW = ctx.measureText(`▸ ${cat.label}`).width;
			minX = Math.min(minX, lblX - catLabelW);
			lastContentBottom = scanY + 4; // header baseline + descender
			scanY += MUNI_PANEL_CAT_H;
			if (this._catExpanded[cat.id]) {
				const routes = this._sortedRoutes[cat.id] || [];
				for (const lineRef of routes) {
					minX = Math.min(minX, lblX - ctx.measureText(lineRef).width);
				}
				const totalH = routes.length * MUNI_PANEL_ITEM_H;
				const clipH  = Math.min(totalH, this.canvas.height - scanY - 52);
				lastContentBottom = scanY + Math.max(0, clipH); // clip visual bottom
				scanY += Math.max(0, clipH) + 14;
			}
			scanY += 16;
		}

		// Overlay categories (STOPS, ROUTES) — simple rows, no expand
		scanY += 6;
		for (const cat of MUNI_OVERLAY_CATEGORIES) {
			minX = Math.min(minX, lblX - ctx.measureText(cat.label).width);
			lastContentBottom = scanY + 4;
			scanY += MUNI_PANEL_CAT_H + 16;
		}

		// Backdrop — snug around content, symmetric top/bottom padding (8px)
		const backdropL = minX - 10;
		ctx.fillStyle = 'rgba(0,0,0,0.5)';
		ctx.fillRect(backdropL, 8, w - 10 - backdropL, lastContentBottom);

		ctx.textAlign = 'right';
		ctx.font = '16px Courier New';

		for (const cat of MUNI_CATEGORIES) {
			const visible  = this._catVisible[cat.id];
			const expanded = this._catExpanded[cat.id];

			// Visibility dot
			ctx.fillStyle = visible ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)';
			ctx.fillText(visible ? '●' : '○', dotX, y);

			// Arrow + label
			ctx.fillStyle = visible ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
			ctx.fillText(`${expanded ? '▾' : '▸'} ${cat.label}`, lblX, y);

			// Hit: dot → toggle category visibility
			this._hitTargets.push({ x: w - 28, y: y - 14, w: 20, h: 18,
				action: () => this._toggleCategory(cat.id) });
			// Hit: label + arrow → toggle expansion
			this._hitTargets.push({ x: w - 185, y: y - 14, w: 151, h: 18,
				action: () => this._toggleExpand(cat.id) });

			y += MUNI_PANEL_CAT_H;

			if (expanded) {
				const routes  = this._sortedRoutes[cat.id] || [];
				const totalH  = routes.length * MUNI_PANEL_ITEM_H;
				const clipTop = y;
				const clipH   = Math.min(totalH, this.canvas.height - clipTop - 52);
				this._catListH[cat.id] = clipH;
				const scroll  = this._catScrollY[cat.id];
				const clipBot = y + clipH;

				// Register area for scroll interaction routing
				this._panelRouteAreas.push({ catId: cat.id, x: w - 188, y: clipTop, w: 175, h: clipH });

				ctx.save();
				ctx.beginPath();
				ctx.rect(w - 188, clipTop, 175, clipH);
				ctx.clip();

				for (let i = 0; i < routes.length; i++) {
					const rowTop  = clipTop + i * MUNI_PANEL_ITEM_H - scroll;
					const rowBot  = rowTop + MUNI_PANEL_ITEM_H;
					if (rowBot <= clipTop || rowTop >= clipBot) continue;

					const baseline  = rowTop + MUNI_PANEL_ITEM_H - 5;
					const lineRef   = routes[i];
					const routeOn   = this._routeVisible.get(lineRef) !== false;
					const effective = visible && routeOn;
					const selected  = this._selectedRoute === lineRef;
					const color     = this._routeColor(lineRef);

					// Dot — toggles visibility
					ctx.fillStyle = effective ? color : color + '3a';
					ctx.fillText(routeOn ? '●' : '○', dotX, baseline);

					// Label — highlighted when route is selected
					ctx.fillStyle = selected  ? color
					              : effective ? 'rgba(255,255,255,0.7)'
					              :             'rgba(255,255,255,0.25)';
					ctx.fillText(lineRef, lblX, baseline);

					if (rowTop >= clipTop && rowBot <= clipBot) {
						// Dot hit: toggle visibility
						this._hitTargets.push({
							x: w - 28, y: rowTop, w: 20, h: MUNI_PANEL_ITEM_H,
							action: () => this._toggleRoute(lineRef)
						});
						// Label hit: select/deselect route (show shape + stops)
						this._hitTargets.push({
							x: w - 160, y: rowTop, w: 130, h: MUNI_PANEL_ITEM_H,
							action: () => this._selectRoute(lineRef)
						});
					}
				}

				ctx.restore();

				// Scroll indicator — thin bar flush with the right edge of the backdrop
				if (totalH > clipH) {
					const maxScroll  = totalH - clipH;
					const barH       = Math.max(20, (clipH / totalH) * clipH);
					const barY       = clipTop + (scroll / maxScroll) * (clipH - barH);
					ctx.fillStyle    = 'rgba(255,255,255,0.2)';
					ctx.fillRect(w - 10, barY, 2, barH);
				}

				y += clipH + 14;
			}

			y += 16; // gap between categories
		}

		// ── Overlay categories (STOPS, ROUTES) — simple toggles, no expand ──
		y += 6; // extra gap between vehicle and overlay groups
		for (const cat of MUNI_OVERLAY_CATEGORIES) {
			const visible = this._overlayVisible[cat.id];

			ctx.fillStyle = visible ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)';
			ctx.fillText(visible ? '●' : '○', dotX, y);

			ctx.fillStyle = visible ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
			ctx.fillText(cat.label, lblX, y);

			this._hitTargets.push({ x: w - 185, y: y - 14, w: 171, h: 18,
				action: () => this._toggleOverlay(cat.id) });

			y += MUNI_PANEL_CAT_H + 16;
		}
	}
}
