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
		this._drag     = null;  // { startX, startY, startViewX, startViewY }
		this._pinch    = null;  // { startDist, startScale, startMidX, startMidY, startViewX, startViewY }
		this._hasMoved = false; // true once pointer moves > 4px (shared across mouse and touch)

		// Animated view transition (e.g. fit-to-route)
		this._viewAnim = null; // { from: {scale,x,y}, to: {scale,x,y}, startTime, duration }

		// Route strip panel state
		this._stripHitTargets    = [];
		this._routeStripScrollY  = 0;
		this._stripPanelScroll   = null;
		this._stripScrollArea    = null;

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
		this._stopPoints        = new Map();  // stopId -> { lat, lon, name, lines: Set<lineRef> }
		this._routeDestinations = new Map();  // `${lineRef}:${direction}` -> headsign string
		this._lineShapes   = new Map();  // lineRef -> [[{lat,lon},...]] lazy cache, fetched on select
		this._lineShapeTs  = new Map();  // lineRef -> precomputed cumulative-t array for canonical shape
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

		this._animCache = null; // per-frame cache for _animatedPos, reset each render
		this._spinner   = document.getElementById('muni-spinner');
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

	get _apiKey() {
		const key = window.MUNI_LOCAL_KEY ?? MUNI_API_KEY;
		return key === 'MUNI_API_KEY_PLACEHOLDER' ? null : key;
	}

	_animLoop() {
		this._advancePending();
		if (this._viewAnim) {
			const t = Math.min(1, (Date.now() - this._viewAnim.startTime) / this._viewAnim.duration);
			const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
			this._view.scale = this._viewAnim.from.scale + (this._viewAnim.to.scale - this._viewAnim.from.scale) * e;
			this._view.x     = this._viewAnim.from.x     + (this._viewAnim.to.x     - this._viewAnim.from.x) * e;
			this._view.y     = this._viewAnim.from.y     + (this._viewAnim.to.y     - this._viewAnim.from.y) * e;
			if (t >= 1) this._viewAnim = null;
		}
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
		return this._panelRouteAreas.find(a => this._pointInBounds(x, y, a)) ?? null;
	}

	// ── Mouse handlers ────────────────────────────────────────────────────────

	_onWheel(e) {
		e.preventDefault();
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
		if (this._inStripScrollArea(x, y)) {
			this._scrollStrip(e.deltaY * 0.4);
			return;
		}
		const area = this._inPanelRouteArea(x, y);
		if (area) {
			this._scrollCat(area.catId, e.deltaY * 0.4);
		} else {
			this._viewAnim = null;
			this._applyZoom(x, y, e.deltaY < 0 ? 1.02 : 0.98);
			this._render();
		}
	}

	_onMouseDown(e) {
		this._viewAnim = null;
		this._hasMoved = false;
		const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
		if (this._inStripScrollArea(x, y)) {
			this._stripPanelScroll = { startCanvasY: y, startScrollY: this._routeStripScrollY };
			return;
		}
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

		if (this._stripPanelScroll) {
			const dy = y - this._stripPanelScroll.startCanvasY;
			if (!this._hasMoved && Math.abs(dy) > 4) this._hasMoved = true;
			this._scrollStripTo(this._stripPanelScroll.startScrollY - dy);
			return;
		}

		if (this._panelScroll) {
			const dy = y - this._panelScroll.startCanvasY;
			if (!this._hasMoved && Math.abs(dy) > 4) this._hasMoved = true;
			this._scrollCatTo(this._panelScroll.catId, this._panelScroll.startScrollY - dy);
			return;
		}

		if (!this._drag) return;
		const dx = x - this._drag.startX;
		const dy = y - this._drag.startY;
		if (!this._hasMoved && (dx * dx + dy * dy > 16)) this._hasMoved = true;
		this._view.x = this._drag.startViewX + dx;
		this._view.y = this._drag.startViewY + dy;
		this._render();
	}

	_onMouseUp(e) {
		if (this._stripPanelScroll) {
			if (!this._hasMoved) {
				const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
				this._handleClick(x, y);
			}
			this._stripPanelScroll = null;
			this._hasMoved = false;
			return;
		}
		if (this._panelScroll) {
			if (!this._hasMoved) {
				const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
				this._handleClick(x, y);
			}
			this._panelScroll = null;
			this._hasMoved = false;
			return;
		}
		if (this._drag && !this._hasMoved) {
			const { x, y } = this._clientToCanvas(e.clientX, e.clientY);
			this._handleClick(x, y);
		}
		this._drag = null;
		this._hasMoved = false;
		this.canvas.style.cursor = 'grab';
	}

	// ── Touch handlers ────────────────────────────────────────────────────────

	_onTouchStart(e) {
		e.preventDefault();
		this._viewAnim = null;
		if (e.touches.length === 2) {
			this._drag        = null;
			this._panelScroll = null;
			this._hasMoved  = false;
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
			this._hasMoved = false;
			const { x, y }  = this._clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
			if (this._inStripScrollArea(x, y)) {
				this._stripPanelScroll = { startCanvasY: y, startScrollY: this._routeStripScrollY };
			} else {
				const area = this._inPanelRouteArea(x, y);
				if (area) {
					this._panelScroll = { catId: area.catId, startCanvasY: y, startScrollY: this._catScrollY[area.catId] };
				} else {
					this._drag = { startX: x, startY: y, startViewX: this._view.x, startViewY: this._view.y };
				}
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
			if (this._stripPanelScroll) {
				const dy = y - this._stripPanelScroll.startCanvasY;
				if (!this._hasMoved && Math.abs(dy) > 4) this._hasMoved = true;
				this._scrollStripTo(this._stripPanelScroll.startScrollY - dy);
				return;
			}
			if (this._panelScroll) {
				const dy = y - this._panelScroll.startCanvasY;
				if (!this._hasMoved && Math.abs(dy) > 4) this._hasMoved = true;
				this._scrollCatTo(this._panelScroll.catId, this._panelScroll.startScrollY - dy);
				return;
			}
			if (this._drag) {
				const dx = x - this._drag.startX;
				const dy = y - this._drag.startY;
				if (!this._hasMoved && (dx * dx + dy * dy > 16)) this._hasMoved = true;
				this._view.x = this._drag.startViewX + dx;
				this._view.y = this._drag.startViewY + dy;
				this._render();
			}
		}
	}

	_onTouchEnd(e) {
		if (e.touches.length === 0) {
			if (this._stripPanelScroll) {
				if (!this._hasMoved) {
					const t = e.changedTouches[0];
					const { x, y } = this._clientToCanvas(t.clientX, t.clientY);
					this._handleClick(x, y);
				}
				this._stripPanelScroll = null;
				this._hasMoved       = false;
				return;
			}
			if (this._panelScroll) {
				if (!this._hasMoved) {
					const t = e.changedTouches[0];
					const { x, y } = this._clientToCanvas(t.clientX, t.clientY);
					this._handleClick(x, y);
				}
				this._panelScroll = null;
				this._hasMoved  = false;
				return;
			}
			if (this._drag && !this._hasMoved) {
				const t = e.changedTouches[0];
				const { x, y } = this._clientToCanvas(t.clientX, t.clientY);
				this._handleClick(x, y);
			}
			this._drag       = null;
			this._pinch      = null;
			this._hasMoved = false;
		} else if (e.touches.length === 1) {
			this._stripPanelScroll = null;
			this._panelScroll = null;
			this._pinch       = null;
			this._hasMoved  = false;
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
		const newVal = Math.max(0, Math.min(this._catListMaxScroll(catId), this._catScrollY[catId] + delta));
		if (newVal === this._catScrollY[catId]) return;
		this._catScrollY[catId] = newVal;
		this._render();
	}

	// Scroll to absolute value
	_scrollCatTo(catId, value) {
		const newVal = Math.max(0, Math.min(this._catListMaxScroll(catId), value));
		if (newVal === this._catScrollY[catId]) return;
		this._catScrollY[catId] = newVal;
		this._render();
	}

	_scrollStrip(delta) {
		if (!this._stripScrollArea) return;
		const newVal = Math.max(0, Math.min(this._stripScrollArea.maxScroll, this._routeStripScrollY + delta));
		if (newVal === this._routeStripScrollY) return;
		this._routeStripScrollY = newVal;
		this._render();
	}

	_scrollStripTo(value) {
		if (!this._stripScrollArea) return;
		const newVal = Math.max(0, Math.min(this._stripScrollArea.maxScroll, value));
		if (newVal === this._routeStripScrollY) return;
		this._routeStripScrollY = newVal;
		this._render();
	}

	_inStripScrollArea(x, y) {
		return this._stripScrollArea ? this._pointInBounds(x, y, this._stripScrollArea) : false;
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
		this._selectedRoute      = lineRef;
		this._routeStripScrollY  = 0;
		this._stripScrollArea    = null;
		if (this._lineShapes.has(lineRef)) {
			this._fitToRoute(lineRef);
		} else {
			this._fetchLinePattern(lineRef); // _fitToRoute called after load
		}
		this._render();
	}

	// ── Panel hit testing ─────────────────────────────────────────────────────

	_handleClick(cx, cy) {
		for (const t of this._stripHitTargets) {
			if (this._pointInBounds(cx, cy, t)) { t.action(); return; }
		}
		for (const t of this._hitTargets) {
			if (this._pointInBounds(cx, cy, t)) { t.action(); return; }
		}
	}

	// ── Data ──────────────────────────────────────────────────────────────────

	async _fetchStatic() {
		const apiKey = this._apiKey;
		if (!apiKey) return;
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
		const apiKey = this._apiKey;
		if (!apiKey) return;
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
			const canon = shapes.length > 0 ? shapes.reduce((a, b) => b.length > a.length ? b : a) : null;
			this._lineShapeTs.set(lineRef, canon ? this._computeShapeTs(canon) : []);
			this._render();
			if (this._selectedRoute === lineRef) this._fitToRoute(lineRef);
		} catch (e) {
			console.error(`[MuniEngine] pattern fetch failed for ${lineRef}:`, e);
		}
	}

	async _fetch() {
		const apiKey = this._apiKey;

		if (!apiKey) {
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

			// Capture headsigns for route strip destination labels
			for (const a of activities) {
				const j = a?.MonitoredVehicleJourney;
				if (!j?.LineRef || !j?.DirectionRef) continue;
				const raw  = j.DestinationName;
				const name = ((typeof raw === 'object' ? raw?.value : raw) ?? '').toString().trim().toUpperCase();
				if (name) this._routeDestinations.set(`${j.LineRef}:${j.DirectionRef}`, name);
			}

			this._vehicles = activities
				.map(a => a?.MonitoredVehicleJourney)
				.filter(j => j?.VehicleLocation?.Latitude && j?.VehicleLocation?.Longitude)
				.map(j => {
					const lat  = parseFloat(j.VehicleLocation.Latitude);
					const lon  = parseFloat(j.VehicleLocation.Longitude);
					const prev = j.VehicleRef ? prevById.get(j.VehicleRef) : null;
					const base = { ref: j.VehicleRef ?? null, lat, lon, line: j.LineRef || 'OOS', direction: j.DirectionRef ?? null };

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

			if (this._spinner) { this._spinner.remove(); this._spinner = null; }
		} catch (e) {
			if (e.name !== 'AbortError') {
				this._failCount++;
				console.error('[MuniEngine] fetch failed:', e.name, e.message);
			}
		}

		this._render();
	}

	_updateHistory(vehicles) {
		const activeRefs = new Set();
		for (const v of vehicles) {
			this._registerRoute(v.line);

			if (!v.ref) continue;
			activeRefs.add(v.ref);
			const trail = this._history.get(v.ref) ?? [];
			const last = trail[trail.length - 1];
			// Record where the dot was when this data arrived (fromLat/fromLon),
			// not the destination — the animated head covers the live segment
			if (last && last.lat === v.fromLat && last.lon === v.fromLon) continue;
			trail.push({ lat: v.fromLat, lon: v.fromLon, line: v.line, t: Date.now() });
			if (trail.length > MUNI_HISTORY_MAX) trail.shift();
			this._history.set(v.ref, trail);
		}

		for (const ref of this._history.keys()) {
			if (!activeRefs.has(ref)) this._history.delete(ref);
		}
	}

	// ── Projection ────────────────────────────────────────────────────────────

	_pointInBounds(x, y, b) {
		return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
	}

	_drawVehicleDot(ctx, x, y, color) {
		ctx.beginPath();
		ctx.arc(x, y, 2, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();
	}

	_toHex(a) {
		return Math.round(Math.max(0, a) * 255).toString(16).padStart(2, '0');
	}

	_project(lat, lon) {
		const x = (lon - MUNI_SF_BOUNDS.minLon) * this._projCosLat * this._projScale;
		const y = (MUNI_SF_BOUNDS.maxLat - lat) * this._projScale;
		return { x, y };
	}

	_drawHeart(ctx, cx, cy, r) {
		ctx.beginPath();
		ctx.moveTo(cx, cy + r * 0.9);
		ctx.bezierCurveTo(cx - r * 1.0, cy + r * 0.4, cx - r * 1.0, cy - r * 0.8, cx, cy - r * 0.2);
		ctx.bezierCurveTo(cx + r * 1.0, cy - r * 0.8, cx + r * 1.0, cy + r * 0.4, cx, cy + r * 0.9);
		ctx.closePath();
	}

	_isHeartStop(name) {
		return name && /28th/i.test(name) && /church/i.test(name);
	}

	_animatedPos(v) {
		if (!v.animStart) return { lat: v.lat, lon: v.lon };
		if (v.ref && this._animCache?.has(v.ref)) return this._animCache.get(v.ref);
		const duration = v.animDuration ?? this._avgFetchInterval;
		const t     = Math.min(1, (Date.now() - v.animStart) / duration);
		const eased = t * t * (3 - 2 * t); // smoothstep ease-in/ease-out
		const result = {
			lat: v.fromLat + (v.lat - v.fromLat) * eased,
			lon: v.fromLon + (v.lon - v.fromLon) * eased
		};
		if (v.ref && this._animCache) this._animCache.set(v.ref, result);
		return result;
	}

	_routeColor(line) {
		const prefix = (line || '').replace(/[^A-Za-z]/, '').toUpperCase().charAt(0);
		return MUNI_ROUTE_COLORS[prefix] ?? MUNI_ROUTE_COLORS['default'];
	}

	_animateToView(target, duration = 700) {
		this._viewAnim = { from: { ...this._view }, to: target, startTime: Date.now(), duration };
	}

	_getRouteStats(lineRef) {
		const rv = this._vehicles.filter(v => v.line === lineRef);
		return {
			total:    rv.length,
			inbound:  rv.filter(v => v.direction === 'IB').length,
			outbound: rv.filter(v => v.direction === 'OB').length
		};
	}

	_computeRouteBounds(lineRef) {
		const segments = this._lineShapes.get(lineRef);
		if (!segments || segments.length === 0) return null;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const seg of segments)
			for (const pt of seg) {
				const { x, y } = this._project(pt.lat, pt.lon);
				if (x < minX) minX = x; if (x > maxX) maxX = x;
				if (y < minY) minY = y; if (y > maxY) maxY = y;
			}
		return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
	}

	_fitToRoute(lineRef) {
		const bounds = this._computeRouteBounds(lineRef);
		if (!bounds) return;
		const w = this.canvas.width, h = this.canvas.height, pad = 80;
		const worldW = bounds.maxX - bounds.minX, worldH = bounds.maxY - bounds.minY;
		if (worldW < 1 || worldH < 1) return;
		const scale = Math.max(MUNI_ZOOM_MIN, Math.min(MUNI_ZOOM_MAX,
			Math.min((w - 2 * pad) / worldW, (h - 2 * pad) / worldH)));
		const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2;
		this._animateToView({ scale, x: w / 2 - cx * scale, y: h / 2 - cy * scale });
	}

	_computeShapeTs(shape) {
		if (!shape || shape.length === 0) return [];
		if (shape.length === 1) return [{ stopId: shape[0].stopId, t: 0 }];
		let totalLen = 0;
		const cumDists = [0];
		for (let i = 1; i < shape.length; i++) {
			const p0 = this._project(shape[i - 1].lat, shape[i - 1].lon);
			const p1 = this._project(shape[i].lat, shape[i].lon);
			totalLen += Math.hypot(p1.x - p0.x, p1.y - p0.y);
			cumDists.push(totalLen);
		}
		if (totalLen === 0) return shape.map((pt, i) => ({ stopId: pt.stopId, t: i / (shape.length - 1) }));
		return shape.map((pt, i) => ({ stopId: pt.stopId, t: cumDists[i] / totalLen }));
	}

	_projectOntoShape(lat, lon, shape) {
		if (!shape || shape.length < 2) return 0.5;
		let totalLen = 0;
		const segs = [];
		for (let i = 1; i < shape.length; i++) {
			const p0 = this._project(shape[i - 1].lat, shape[i - 1].lon);
			const p1 = this._project(shape[i].lat, shape[i].lon);
			const dx = p1.x - p0.x, dy = p1.y - p0.y;
			const len = Math.hypot(dx, dy);
			segs.push({ p0, dx, dy, len, start: totalLen });
			totalLen += len;
		}
		if (totalLen === 0) return 0.5;
		const pv = this._project(lat, lon);
		let bestParam = 0, bestDist = Infinity;
		for (const s of segs) {
			if (s.len === 0) continue;
			const t  = Math.max(0, Math.min(1, ((pv.x - s.p0.x) * s.dx + (pv.y - s.p0.y) * s.dy) / (s.len * s.len)));
			const cx = s.p0.x + t * s.dx, cy = s.p0.y + t * s.dy;
			const dist = Math.hypot(pv.x - cx, pv.y - cy);
			if (dist < bestDist) { bestDist = dist; bestParam = (s.start + t * s.len) / totalLen; }
		}
		return bestParam;
	}

	_drawRouteStrip(ctx, lineRef) {
		const color  = this._routeColor(lineRef);
		const shapes = this._lineShapes.get(lineRef) ?? [];
		const canon  = shapes.length > 0 ? shapes.reduce((a, b) => b.length > a.length ? b : a) : null;

		// Terminal destination labels — used for first/last stop in the list
		const ibDest = (this._routeDestinations.get(`${lineRef}:IB`)
			?? this._stopPoints.get(canon?.[0]?.stopId)?.name
			?? 'INBOUND').toUpperCase();
		const obDest = (this._routeDestinations.get(`${lineRef}:OB`)
			?? this._stopPoints.get(canon?.[canon?.length - 1]?.stopId)?.name
			?? 'OUTBOUND').toUpperCase();
		this._stripHitTargets = [];
		const panelLeft = 8;

		// ── Expanded view ─────────────────────────────────────────────────────────
		const outerPad  = 18;
		const headerH   = 56;
		const footerH   = 8;

		const stopTs   = this._lineShapeTs.get(lineRef) ?? [];
		const numSegs  = Math.max(1, stopTs.length - 1);
		const availH   = this.canvas.height - 16 - headerH - footerH;
		const rowH         = 18;
		const nameFontSz   = Math.max(8, Math.min(12, rowH - 4));
		const isScrollMode = rowH * numSegs > availH;

		// Measure all names first to derive panel width
		let maxNameW = 0;
		ctx.font = `${nameFontSz}px Courier New`;
		for (const { stopId } of stopTs) {
			const name = this._stopPoints.get(stopId)?.name ?? '';
			if (name) maxNameW = Math.max(maxNameW, ctx.measureText(name).width);
		}
		maxNameW = Math.max(maxNameW, ctx.measureText(ibDest).width, ctx.measureText(obDest).width);
		ctx.font = 'bold 18px Courier New';
		maxNameW = Math.max(maxNameW, ctx.measureText(lineRef).width);

		const panelW   = Math.max(160, Math.min(400, Math.ceil(maxNameW) + outerPad * 2 + 8));
		const xIB      = panelLeft + outerPad;
		const xOB      = panelLeft + panelW - outerPad;
		const xCenter  = panelLeft + panelW / 2;
		const stripH   = rowH * numSegs;
		const viewH    = isScrollMode ? availH : stripH;
		const stripTop = 8 + headerH;
		const panelH   = headerH + viewH + footerH;

		if (isScrollMode) {
			const maxScroll = Math.max(0, stripH - viewH + 22);
			this._routeStripScrollY = Math.max(0, Math.min(maxScroll, this._routeStripScrollY));
			this._stripScrollArea = { x: panelLeft, y: stripTop, w: panelW, h: viewH, maxScroll };
		} else {
			this._stripScrollArea = null;
			this._routeStripScrollY = 0;
		}

		ctx.fillStyle = 'rgba(0,0,0,0.6)';
		ctx.fillRect(panelLeft, 8, panelW, panelH);

		const textColor = '#fff';

		// Route name + vehicle count
		const stats = this._getRouteStats(lineRef);
		ctx.textAlign = 'center';
		ctx.font = 'bold 18px Courier New';
		ctx.fillStyle = color;
		ctx.fillText(lineRef, xCenter, 26);
		ctx.font = '11px Courier New';
		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.fillText(`${stats.total} vehicles online`, xCenter, 42);

		// ── Clipped strip content ──
		ctx.save();
		if (isScrollMode) {
			ctx.beginPath();
			ctx.rect(panelLeft, stripTop, panelW, viewH);
			ctx.clip();
			ctx.translate(0, 8 - this._routeStripScrollY);
		}

		// Vertical track lines
		ctx.strokeStyle = 'rgba(255,255,255,0.5)';
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(xIB, stripTop); ctx.lineTo(xIB, stripTop + stripH); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(xOB, stripTop); ctx.lineTo(xOB, stripTop + stripH); ctx.stroke();

		// Stop ticks and names
		const showNames = rowH >= 9;
		if (showNames) ctx.font = `${nameFontSz}px Courier New`;

		for (let si = 0; si < stopTs.length; si++) {
			const { stopId } = stopTs[si];
			const sy = stripTop + (si / numSegs) * stripH;
			ctx.fillStyle = 'rgba(255,255,255,0.4)';
			ctx.beginPath();
			ctx.moveTo(xIB,     sy - 3);
			ctx.lineTo(xIB - 3, sy + 2);
			ctx.lineTo(xIB + 3, sy + 2);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(xOB,     sy + 3);
			ctx.lineTo(xOB - 3, sy - 2);
			ctx.lineTo(xOB + 3, sy - 2);
			ctx.closePath();
			ctx.fill();
			if (showNames) {
				const name = si === 0 ? ibDest
				           : si === numSegs ? obDest
				           : (this._stopPoints.get(stopId)?.name ?? '');
				if (name) {
					ctx.textAlign = 'center';
					ctx.fillStyle = textColor;
					ctx.fillText(name, xCenter, sy + nameFontSz * 0.35);
				}
			}
		}

		if (!canon) {
			ctx.font = '10px Courier New';
			ctx.textAlign = 'center';
			ctx.fillStyle = textColor;
			ctx.fillText('loading…', xCenter, stripTop + 14);
		}

		// Vehicle markers projected onto the canonical shape
		if (canon) {
			for (const v of this._vehicles) {
				if (v.line !== lineRef) continue;
				const pos = this._animatedPos(v);
				const dt  = this._projectOntoShape(pos.lat, pos.lon, canon);
				let ut = dt;
				if (stopTs.length >= 2) {
					for (let i = 1; i < stopTs.length; i++) {
						if (dt <= stopTs[i].t || i === stopTs.length - 1) {
							const s0 = stopTs[i - 1].t, s1 = stopTs[i].t;
							const frac = s1 > s0 ? Math.max(0, Math.min(1, (dt - s0) / (s1 - s0))) : 0;
							ut = (i - 1 + frac) / numSegs;
							break;
						}
					}
				}
				const vy  = stripTop + ut * stripH;
				const vx  = v.direction === 'IB' ? xOB : xIB;
				this._drawVehicleDot(ctx, vx, vy, color);
			}
		}

		ctx.restore(); // end clip

		// Scroll indicator bar
		if (isScrollMode) {
			const barTrackH = viewH - 4;
			const barH = Math.max(20, (viewH / stripH) * barTrackH);
			const barY = stripTop + 2 + (this._routeStripScrollY / this._stripScrollArea.maxScroll) * (barTrackH - barH);
			ctx.fillStyle = 'rgba(255,255,255,0.3)';
			ctx.fillRect(panelLeft + panelW - 4, barY, 3, barH);
		}
	}

	// ── Render ────────────────────────────────────────────────────────────────

	_render() {
		const ctx = this.ctx;
		const w = this.canvas.width;
		const h = this.canvas.height;

		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, w, h);

		if (!this._apiKey) {
			ctx.fillStyle = 'rgba(255,255,255,0.4)';
			ctx.font = '14px Courier New';
			ctx.textAlign = 'center';
			ctx.fillText('MUNI_API_KEY not configured', w / 2, h / 2);
			return;
		}

		if (this._isLoading) return;

		this._animCache = new Map();

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
			ctx.lineWidth   = 0.25;
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
				if (this._isHeartStop(stop.name) && stop.lines.has('J')) {
					this._drawHeart(ctx, x, y, 0.95);
					ctx.fillStyle = onSelected ? this._routeColor(sel) : 'rgba(255,255,255,0.5)';
				} else {
					ctx.beginPath();
					ctx.arc(x, y, 0.66, 0, Math.PI * 2);
					ctx.fillStyle = onSelected ? this._routeColor(sel) : 'rgba(255,255,255,0.5)';
				}
				ctx.fill();
			}
		}

		const vehicleByRef = new Map(this._vehicles.map(v => [v.ref, v]));

		const trailNow    = Date.now();
		const trailMaxAge = this._avgFetchInterval * MUNI_HISTORY_MAX;

		for (const [ref, trail] of this._history) {
			if (trail.length < 1) continue;
			if (!this._isVisible(trail[trail.length - 1].line)) continue;

			const color = this._routeColor(trail[trail.length - 1].line);

			// Append current animated position as the trail head so it follows the dot live
			const v    = vehicleByRef.get(ref);
			const head = v ? this._animatedPos(v) : { lat: trail[trail.length - 1].lat, lon: trail[trail.length - 1].lon };
			const pts  = [
				...trail.map(p => ({ ...this._project(p.lat, p.lon), t: p.t ?? trailNow })),
				{ ...this._project(head.lat, head.lon), t: trailNow }
			];

			ctx.lineWidth = 2;
			for (let i = 1; i < pts.length; i++) {
				const a0 = (1 - (trailNow - pts[i - 1].t) / trailMaxAge) * 0.75;
				const a1 = (1 - (trailNow - pts[i].t)     / trailMaxAge) * 0.75;
				const grad = ctx.createLinearGradient(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
				grad.addColorStop(0, color + this._toHex(a0));
				grad.addColorStop(1, color + this._toHex(a1));
				ctx.beginPath();
				ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
				ctx.lineTo(pts[i].x, pts[i].y);
				ctx.strokeStyle = grad;
				ctx.stroke();
			}
		}

		for (const v of this._vehicles) {
			if (!this._isVisible(v.line)) continue;
			const pos = this._animatedPos(v);
			const { x, y } = this._project(pos.lat, pos.lon);
			const color = this._routeColor(v.line);
			this._drawVehicleDot(ctx, x, y, color);
		}

		ctx.restore(); // ── End world-space transform ──

		// ── Route strip panel — top-left, shown when route selected ──
		if (this._selectedRoute) this._drawRouteStrip(ctx, this._selectedRoute);

		// ── HUD — bottom-right ──
		ctx.font = '14px Courier New';
		ctx.textAlign = 'right';
		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.fillText('MUNI', w - 16, h - 48);
		ctx.fillText(`${this._vehicles.length} vehicles online`, w - 16, h - 32);
		if (this._lastUpdated) {
			if (this._failCount > 0) {
				ctx.fillStyle = 'rgba(255,100,100,0.8)';
				ctx.fillText(`${this._failCount} failed`, w - 16, h - 16);
			} else {
				ctx.fillText(`updated ${this._lastUpdated.toLocaleTimeString()}`, w - 16, h - 16);
			}
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
