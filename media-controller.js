// ==================== MEDIA CONTROLLER ====================
// Coordinates audio and visual feedback, managing spawner mode state

class MediaController {
	constructor(state, config, audioEngine, visualEngine) {
		this.state = state;
		this.config = config;
		this.audioEngine = audioEngine;
		this.visualEngine = visualEngine;
	}

	/**
	 * Spawn media based on current mode (spawner vs navigation)
	 */
	spawnMedia(x, y) {
		if (this.state.spawner.mode === 'spawner' && this.state.spawner.config) {
			this.visualEngine.spawnVideoFromConfig(x, y, this.state.spawner.config);
		} else {
			this.visualEngine.spawnMedia(x, y);
		}
	}

	/**
	 * Play tab navigation chord
	 */
	playChord(tabName) {
		this.audioEngine.playChord(tabName);
	}

	/**
	 * Play portfolio item audio feedback
	 * @param {Object} adsr - Optional ADSR envelope
	 * @param {Array} frequencies - Optional pre-generated frequencies
	 * @param {number} depth - Menu depth level (0, 1, 2)
	 * @param {boolean} isActionable - Whether item opens submenu or triggers special mode
	 * @returns {Object} Audio config for potential reversal
	 */
	playPortfolioItem(adsr = null, frequencies = null, depth = 0, isActionable = true) {
		return this.audioEngine.playPortfolioItem(adsr, frequencies, depth, isActionable);
	}

	/**
	 * Play reversed audio (for navigating back)
	 * @param {Object} audioConfig - Audio config to reverse
	 */
	playReversed(audioConfig) {
		this.audioEngine.playReversed(audioConfig);
	}

	/**
	 * Play hover audio (same notes 1 octave down)
	 * @param {Object} audioConfig - Audio config with frequencies
	 * @returns {Array} Array of oscillator data for cleanup
	 */
	playHoverAudio(audioConfig) {
		return this.audioEngine.playHoverAudio(audioConfig);
	}

	/**
	 * Stop hover audio oscillators
	 * @param {Array} oscDataArray - Array of oscillator data
	 */
	stopHoverAudio(oscDataArray) {
		this.audioEngine.stopHoverAudio(oscDataArray);
	}

	/**
	 * Stop all active hover audio
	 */
	stopAllHoverAudio() {
		this.audioEngine.stopAllHoverAudio();
	}

	/**
	 * Update audio effects based on hover state
	 */
	updateEffects(isHovering) {
		this.audioEngine.updateEffects(isHovering);
	}

	/**
	 * Coordinate graceful shutdown of all active feedback
	 * @param {boolean} useBackgroundFade - If true, use CSS+setTimeout fade (for window blur)
	 * @param {number} fadeDuration - Fade duration in milliseconds (default 2000)
	 */
	stopAll(useBackgroundFade = false, fadeDuration = 2000) {
		// Trigger fade-out on visuals
		// Use CSS transitions + setTimeout when window loses focus (works in background tabs)
		// Use RAF-based fade for normal navigation (smoother but gets throttled in background)
		this.visualEngine.stopAll(useBackgroundFade, fadeDuration);

		// Start audio fade-out (2 second fade for both modes)
		this.audioEngine.stopAll();
	}

	/**
	 * Enter spawner mode with configuration
	 */
	enterSpawnerMode(config) {
		this.state.spawner.mode = 'spawner';
		this.state.spawner.config = config;
	}

	/**
	 * Exit spawner mode and return to navigation
	 */
	exitSpawnerMode() {
		this.state.spawner.mode = 'navigation';
		this.state.spawner.config = null;
	}

	/**
	 * Check if currently in spawner mode
	 */
	isInSpawnerMode() {
		return this.state.spawner.mode === 'spawner';
	}

	/**
	 * Activate biebl spawner mode
	 * If not in mode, enters mode and spawns first video
	 * If already in mode and no video playing, spawns next video
	 */
	activateBieblMode() {
		// Check if already in biebl mode
		const alreadyInBieblMode = this.state.spawner.mode === 'spawner' &&
		                           this.state.spawner.config &&
		                           this.state.spawner.config.name === 'biebl';

		if (!alreadyInBieblMode) {
			// First time activating - enter spawner mode
			const config = {
				name: 'biebl',
				videoSet: this.state.assets.bieblVideos,
				playbackMode: 'sequential',
				speed: 'normal',
				duration: 'full',
				fixedDuration: 10,
				fadeInTime: 3,
				fadeStartTime: 3,
				showTicker: false,
				hasOscillator: false,
				size: 'fullscreen',
				movement: 'subtle',
				scaleGrowth: 1.01,
				currentIndex: 0
			};

			this.enterSpawnerMode(config);

			// Auto-spawn first video centered
			this.spawnMedia(windowWidth / 2, windowHeight / 2);
		} else {
			// Already in biebl mode - spawn next video if not playing
			if (!this.state.visual.videoIsPlaying) {
				this.spawnMedia(windowWidth / 2, windowHeight / 2);
			}
		}
	}

	/**
	 * Activate MUNI real-time transit map
	 */
	activateMuniMode() {
		// Create fullscreen overlay
		const overlay = document.createElement('div');
		overlay.id = 'muni-overlay';
		overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:120;background:#000;opacity:0;transition:opacity 0.4s ease;';
		document.body.appendChild(overlay);

		// CSS loading spinner — removed by MuniEngine on first data
		const style = document.createElement('style');
		style.id = 'muni-spinner-style';
		style.textContent = '@keyframes muni-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}#muni-spinner{position:absolute;top:50%;left:50%;width:32px;height:32px;transform:translate(-50%,-50%);border:1.5px solid rgba(255,255,255,0.15);border-top-color:rgba(255,255,255,0.6);border-radius:50%;animation:muni-spin 1.2s linear infinite;}';
		document.head.appendChild(style);

		const spinner = document.createElement('div');
		spinner.id = 'muni-spinner';
		overlay.appendChild(spinner);

		// Create canvas
		const canvas = document.createElement('canvas');
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		canvas.style.cssText = 'display:block;width:100%;height:100%;';
		overlay.appendChild(canvas);

		// Fade in
		requestAnimationFrame(() => { overlay.style.opacity = '1'; });

		this._muniOverlay = overlay;
		this._muniEngine = new MuniEngine(canvas, this);
		this._muniEngine.start();
	}

	/**
	 * Activate GGR Charts fullscreen image scroll
	 */
	activateGGRChartsMode() {
		const images = [
			'1 - great green room:bandit.jpeg',
			'2 - muddy rIver.jpeg',
			'3 - extras.jpeg',
			'4 - episodes.jpeg',
			'5 - reruns.jpeg',
			'6 - washed in white.jpeg',
			'7 - yellow roses.jpeg',
			'8 - new moon:goodnight moon.png',
			'close to you.jpeg'
		].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

		const overlay = document.createElement('div');
		overlay.id = 'ggr-charts-overlay';
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.zIndex = '100';
		overlay.style.backgroundColor = '#000';
		overlay.style.overflowY = 'auto';
		overlay.style.webkitOverflowScrolling = 'touch';
		overlay.style.opacity = '0';
		overlay.style.transition = 'opacity 0.4s ease';

		const basePath = 'assets/visual/' + encodeURIComponent('ggr charts') + '/';
		images.forEach(filename => {
			const img = document.createElement('img');
			img.src = basePath + encodeURIComponent(filename);
			img.style.display = 'block';
			img.style.width = '100%';
			img.style.height = 'auto';
			overlay.appendChild(img);
		});

		document.body.appendChild(overlay);
		requestAnimationFrame(() => { overlay.style.opacity = '1'; });
		this._ggrChartsOverlay = overlay;
	}

	/**
	 * Deactivate GGR Charts mode and clean up
	 */
	deactivateGGRChartsMode() {
		if (!this._ggrChartsOverlay) return;
		const overlay = this._ggrChartsOverlay;
		overlay.style.transition = 'opacity 0.4s ease';
		overlay.style.opacity = '0';
		setTimeout(() => { overlay.remove(); }, 400);
		this._ggrChartsOverlay = null;
	}

	activateYellowRosesStemsMode() {
		const TRACKS = [
			{ name: 'bass',    file: 'bass.m4a',              color: '#FF6600' },
			{ name: 'drums',   file: 'drums and cymbals.m4a', color: '#FFE600' },
			{ name: 'guitar',  file: 'guitar.m4a',            color: '#AA00FF' },
			{ name: 'rhodes',  file: 'rhodes.m4a',            color: '#0099FF' },
			{ name: 'visuals', file: 'visuals.m4a',           color: '#FF0000' },
			{ name: 'vox A',   file: 'vox A.m4a',            color: '#00E600' },
			{ name: 'vox B',   file: 'vox B.m4a',            color: '#FF69B4' },
		];

		const BASE_PATH = 'assets/audio/' +
			encodeURIComponent('reference section') + '/' +
			encodeURIComponent('yellow roses stems') + '/';

		const MIXER_HEIGHT = 130;

		// FFT canvas — below menu (z 99), own background so nothing bleeds through
		const canvas = document.createElement('canvas');
		Object.assign(canvas.style, {
			position: 'fixed', top: '0', left: '0', width: '100%',
			height: `calc(100% - ${MIXER_HEIGHT}px)`,
			zIndex: '99', display: 'block',
			opacity: '0', transition: 'opacity 0.4s ease', pointerEvents: 'none',
		});

		// Loading label — below menu (z 99)
		const loadingLabel = document.createElement('div');
		Object.assign(loadingLabel.style, {
			position: 'fixed', top: '50%', left: '50%',
			transform: 'translate(-50%, -50%)',
			zIndex: '99', color: 'rgba(255,255,255,0.35)', fontSize: '11px',
			letterSpacing: '0.15em', textTransform: 'uppercase',
			fontFamily: 'monospace', pointerEvents: 'none',
			opacity: '0', transition: 'opacity 0.4s ease',
		});
		loadingLabel.textContent = `loading 0 / ${TRACKS.length}`;

		// Mixer bar — above menu (z 110)
		const mixerBar = document.createElement('div');
		Object.assign(mixerBar.style, {
			position: 'fixed', bottom: '0', left: '0', width: '100%',
			height: `${MIXER_HEIGHT}px`, zIndex: '110',
			display: 'flex', flexDirection: 'row',
			background: '#0f0f0f', borderTop: '1px solid #1a1a1a', fontFamily: 'monospace',
			opacity: '0', transition: 'opacity 0.4s ease',
		});

		document.body.appendChild(canvas);
		document.body.appendChild(loadingLabel);
		document.body.appendChild(mixerBar);
		requestAnimationFrame(() => {
			canvas.style.opacity = '1';
			loadingLabel.style.opacity = '1';
			mixerBar.style.opacity = '1';
		});

		const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		const gainNodes = [];
		const analysers = [];
		const dataArrays = [];

		TRACKS.forEach((track) => {
			const gainNode = audioCtx.createGain();
			gainNode.gain.value = 1.0;
			const analyser = audioCtx.createAnalyser();
			analyser.fftSize = 4096;
			analyser.smoothingTimeConstant = 0.8;
			gainNode.connect(analyser);
			analyser.connect(audioCtx.destination);
			gainNodes.push(gainNode);
			analysers.push(analyser);
			dataArrays.push(new Uint8Array(analyser.frequencyBinCount));

			const channel = document.createElement('div');
			Object.assign(channel.style, {
				flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center',
				padding: '10px 6px 8px', borderRight: '1px solid #1a1a1a',
				minWidth: '0', boxSizing: 'border-box',
			});

			const strip = document.createElement('div');
			Object.assign(strip.style, {
				width: '100%', height: '3px', background: track.color,
				borderRadius: '2px', marginBottom: '6px', flexShrink: '0',
			});

			const label = document.createElement('div');
			label.textContent = track.name;
			Object.assign(label.style, {
				color: track.color, fontSize: '9px', textTransform: 'uppercase',
				letterSpacing: '0.08em', marginBottom: '8px', textAlign: 'center',
				overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
				width: '100%', flexShrink: '0',
			});

			const sliderOuter = document.createElement('div');
			Object.assign(sliderOuter.style, {
				flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
				width: '100%',
			});

			const slider = document.createElement('input');
			slider.type = 'range';
			slider.min = '0'; slider.max = '1'; slider.step = '0.01'; slider.value = '1';
			Object.assign(slider.style, {
				transform: 'rotate(-90deg)',
				width: '60px',
				cursor: 'pointer', accentColor: track.color, margin: '0', padding: '0',
				display: 'block', flexShrink: '0',
			});
			slider.addEventListener('input', () => { gainNode.gain.value = parseFloat(slider.value); });

			sliderOuter.appendChild(slider);
			channel.appendChild(strip);
			channel.appendChild(label);
			channel.appendChild(sliderOuter);
			mixerBar.appendChild(channel);
		});

		const dpr = window.devicePixelRatio || 1;
		const TRAIL_LENGTH = 28;
		const fftHistory = [];

		const resizeCanvas = () => {
			canvas.width = window.innerWidth * dpr;
			canvas.height = (window.innerHeight - MIXER_HEIGHT) * dpr;
		};
		resizeCanvas();
		window.addEventListener('resize', resizeCanvas);

		const ctx2d = canvas.getContext('2d');
		const animRef = { id: null };
		const MIN_FREQ = 20;
		const MAX_FREQ = 20000;

		const drawFFT = () => {
			animRef.id = requestAnimationFrame(drawFFT);
			const W = canvas.width;
			const H = canvas.height;
			const logRange = Math.log(MAX_FREQ / MIN_FREQ);
			const nyquist = audioCtx.sampleRate / 2;

			// Capture current FFT snapshot with pre-computed points
			const snap = TRACKS.map((_, i) => {
				const data = new Uint8Array(dataArrays[i].length);
				analysers[i].getByteFrequencyData(data);
				const vol = gainNodes[i].gain.value;
				const pts = [];
				let lastX = -1;
				for (let bin = 1; bin < data.length; bin++) {
					const freq = (bin / data.length) * nyquist;
					if (freq < MIN_FREQ) continue;
					if (freq > MAX_FREQ) break;
					const x = (Math.log(freq / MIN_FREQ) / logRange) * W;
					if (x - lastX < 1) continue;
					lastX = x;
					pts.push([x, H - (data[bin] / 255) * vol * H * 0.95 - 2]);
				}
				return pts;
			});
			fftHistory.push(snap);
			if (fftHistory.length > TRAIL_LENGTH) fftHistory.shift();

			// Pure black background every frame — no residue possible
			ctx2d.globalCompositeOperation = 'source-over';
			ctx2d.globalAlpha = 1;
			ctx2d.fillStyle = '#000';
			ctx2d.fillRect(0, 0, W, H);

			// Draw each historical frame, newest on top
			ctx2d.lineWidth = 2 * dpr;
			fftHistory.forEach((snapshot, histIdx) => {
				const age = fftHistory.length - 1 - histIdx;
				const alpha = (1 - age / TRAIL_LENGTH) * 0.85;
				if (alpha < 0.005) return;

				snapshot.forEach((pts, i) => {
					if (pts.length < 2) return;
					ctx2d.strokeStyle = TRACKS[i].color;
					ctx2d.globalAlpha = alpha;
					ctx2d.beginPath();
					ctx2d.moveTo(pts[0][0], pts[0][1]);
					for (let j = 1; j < pts.length - 1; j++) {
						ctx2d.quadraticCurveTo(pts[j][0], pts[j][1], (pts[j][0] + pts[j + 1][0]) / 2, (pts[j][1] + pts[j + 1][1]) / 2);
					}
					ctx2d.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
					ctx2d.stroke();
				});
			});

			ctx2d.globalAlpha = 1;
		};

		let loadedCount = 0;
		audioCtx.resume().then(() => {
			Promise.all(TRACKS.map((track, i) =>
				fetch(BASE_PATH + encodeURIComponent(track.file))
					.then(r => r.arrayBuffer())
					.then(buf => audioCtx.decodeAudioData(buf))
					.then(audioBuffer => {
						loadedCount++;
						loadingLabel.textContent = `loading ${loadedCount} / ${TRACKS.length}`;
						return { audioBuffer, index: i };
					})
			)).then(loaded => {
				loadingLabel.remove();
				const commonDuration = Math.min(...loaded.map(({ audioBuffer }) => audioBuffer.duration));
				const startTime = audioCtx.currentTime + 0.05;
				const sources = [];
				loaded.forEach(({ audioBuffer, index }) => {
					const source = audioCtx.createBufferSource();
					source.buffer = audioBuffer;
					source.loop = true;
					source.loopEnd = commonDuration;
					source.connect(gainNodes[index]);
					source.start(startTime);
					sources.push(source);
				});
				this._yellowRosesStemsSourceNodes = sources;
				drawFFT();
			}).catch(err => {
				loadingLabel.textContent = 'error loading audio';
				console.error('Yellow Roses Stems load error:', err);
			});
		});

		this._yellowRosesStemsCanvas = canvas;
		this._yellowRosesStemsMixerBar = mixerBar;
		this._yellowRosesStemsAudioCtx = audioCtx;
		this._yellowRosesStemsGainNodes = gainNodes;
		this._yellowRosesStemsSourceNodes = [];
		this._yellowRosesStemsAnimRef = animRef;
		this._yellowRosesStemsResizeHandler = resizeCanvas;
	}

	deactivateYellowRosesStemsMode() {
		if (!this._yellowRosesStemsCanvas) return;

		if (this._yellowRosesStemsAnimRef) {
			cancelAnimationFrame(this._yellowRosesStemsAnimRef.id);
			this._yellowRosesStemsAnimRef = null;
		}

		if (this._yellowRosesStemsSourceNodes) {
			this._yellowRosesStemsSourceNodes.forEach(source => { try { source.stop(); } catch (e) {} });
			this._yellowRosesStemsSourceNodes = null;
		}

		if (this._yellowRosesStemsAudioCtx) {
			this._yellowRosesStemsAudioCtx.close();
			this._yellowRosesStemsAudioCtx = null;
		}

		if (this._yellowRosesStemsResizeHandler) {
			window.removeEventListener('resize', this._yellowRosesStemsResizeHandler);
			this._yellowRosesStemsResizeHandler = null;
		}

		[this._yellowRosesStemsCanvas, this._yellowRosesStemsMixerBar].forEach(el => {
			if (!el) return;
			el.style.transition = 'opacity 0.4s ease';
			el.style.opacity = '0';
			setTimeout(() => { el.remove(); }, 400);
		});
		this._yellowRosesStemsCanvas = null;
		this._yellowRosesStemsMixerBar = null;
		this._yellowRosesStemsGainNodes = null;
	}

	/**
	 * Deactivate MUNI mode and clean up
	 */
	deactivateMuniMode() {
		if (!this._muniOverlay) return;
		if (this._muniEngine) {
			this._muniEngine.stop();
			this._muniEngine = null;
		}
		const style = document.getElementById('muni-spinner-style');
		if (style) style.remove();
		const overlay = this._muniOverlay;
		overlay.style.transition = 'opacity 0.5s ease';
		overlay.style.opacity = '0';
		setTimeout(() => { overlay.remove(); }, 500);
		this._muniOverlay = null;
	}

	/**
	 * Fade YouTube player volume over time
	 * @param {Object} player - YouTube player instance
	 * @param {number} startVolume - Starting volume (0-100)
	 * @param {number} endVolume - Ending volume (0-100)
	 * @param {number} duration - Duration in milliseconds
	 */
	_fadeYouTubeVolume(player, startVolume, endVolume, duration) {
		return new Promise((resolve) => {
			const startTime = Date.now();

			const fade = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / duration, 1);

				// Ease-in-out for smooth volume transition
				const easedProgress = progress < 0.5
					? 2 * progress * progress
					: 1 - Math.pow(-2 * progress + 2, 2) / 2;

				const currentVolume = startVolume + (endVolume - startVolume) * easedProgress;

				try {
					player.setVolume(currentVolume);
				} catch (e) {
					// Player might be destroyed, stop fading
					resolve();
					return;
				}

				if (progress < 1) {
					requestAnimationFrame(fade);
				} else {
					resolve();
				}
			};

			fade();
		});
	}

	/**
	 * Load YouTube IFrame API if not already loaded
	 */
	_loadYouTubeAPI() {
		// Check if API is already loaded
		if (window.YT && window.YT.Player) {
			return Promise.resolve();
		}

		// Check if script is already loading
		if (window.youtubeAPILoading) {
			return window.youtubeAPILoading;
		}

		// Load the API
		window.youtubeAPILoading = new Promise((resolve) => {
			// Set up callback for when API is ready
			window.onYouTubeIframeAPIReady = () => {
				delete window.youtubeAPILoading;
				resolve();
			};

			// Load the script
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			const firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
		});

		return window.youtubeAPILoading;
	}

	/**
	 * Play a YouTube video in an iframe
	 * @param {string} youtubeUrl - The YouTube video URL
	 */
	async playYouTubeVideo(youtubeUrl) {
		// Load YouTube API first
		await this._loadYouTubeAPI();

		// Extract video ID from URL
		let videoId = '';
		const urlPatterns = [
			/youtube\.com\/watch\?v=([^&]+)/,
			/youtu\.be\/([^?]+)/,
			/youtube\.com\/embed\/([^?]+)/
		];

		for (let pattern of urlPatterns) {
			const match = youtubeUrl.match(pattern);
			if (match) {
				videoId = match[1];
				break;
			}
		}

		if (!videoId) {
			console.error('Could not extract video ID from URL:', youtubeUrl);
			return;
		}

		// Remove any existing YouTube player
		const existingWrapper = document.getElementById('youtube-wrapper');
		if (existingWrapper) {
			existingWrapper.remove();
		}

		// Calculate largest possible size maintaining 16:9 aspect ratio
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		const aspectRatio = 16 / 9;
		const margin = 40; // Margin from window edges in pixels

		let width, height;

		// Try fitting width first
		const maxWidth = windowWidth - (margin * 2);
		const heightForMaxWidth = maxWidth / aspectRatio;

		if (heightForMaxWidth <= windowHeight - (margin * 2)) {
			// Width-constrained: fits with max width
			width = maxWidth;
			height = heightForMaxWidth;
		} else {
			// Height-constrained: scale down to fit height
			height = windowHeight - (margin * 2);
			width = height * aspectRatio;
		}

		// Create wrapper for fade effect
		const wrapperDiv = document.createElement('div');
		wrapperDiv.id = 'youtube-wrapper';
		wrapperDiv.style.position = 'fixed';
		wrapperDiv.style.top = '50%';
		wrapperDiv.style.left = '50%';
		wrapperDiv.style.transform = 'translate(-50%, -50%)';
		wrapperDiv.style.width = width + 'px';
		wrapperDiv.style.height = height + 'px';
		wrapperDiv.style.zIndex = '100';
		wrapperDiv.style.boxShadow = '0 0 50px rgba(0, 0, 0, 0.5)';
		wrapperDiv.style.opacity = '0';
		wrapperDiv.style.transition = `opacity ${this.config.YOUTUBE_FADE_IN_TIME / 1000}s ease`;

		// Create div element for player (will be replaced by iframe)
		const playerDiv = document.createElement('div');
		playerDiv.id = 'youtube-player';

		// Add player to wrapper, wrapper to document
		wrapperDiv.appendChild(playerDiv);
		document.body.appendChild(wrapperDiv);

		// Get stored timestamp for "7LW"
		const startSeconds = this.state.youtube.sevenLastWordsTimestamp || 0;

		// Create YouTube player
		this.state.dom.youtubePlayer = new YT.Player('youtube-player', {
			width: width,
			height: height,
			videoId: videoId,
			playerVars: {
				autoplay: 1,
				start: Math.floor(startSeconds)
			},
			events: {
				onReady: (event) => {
					// Set volume to 0 initially for fade-in
					event.target.setVolume(0);

					// If we have a precise timestamp with decimals, seek to it
					if (startSeconds > 0) {
						event.target.seekTo(startSeconds, true);
					}

					// Fade in video and audio
					setTimeout(() => {
						wrapperDiv.style.opacity = '1';
						this._fadeYouTubeVolume(event.target, 0, 100, this.config.YOUTUBE_FADE_IN_TIME);
					}, 50);
				}
			}
		});
	}

	/**
	 * Remove YouTube video iframe and save timestamp (with fade out)
	 */
	async removeYouTubeVideo() {
		const wrapperDiv = document.getElementById('youtube-wrapper');

		// Fade out video and audio
		if (this.state.dom.youtubePlayer && wrapperDiv) {
			// Start visual fade
			wrapperDiv.style.transition = `opacity ${this.config.YOUTUBE_FADE_OUT_TIME / 1000}s ease`;
			wrapperDiv.style.opacity = '0';

			// Start audio fade
			const volumeFadePromise = this._fadeYouTubeVolume(
				this.state.dom.youtubePlayer,
				100,
				0,
				this.config.YOUTUBE_FADE_OUT_TIME
			);

			// Wait for both fades to complete
			await Promise.all([
				volumeFadePromise,
				new Promise(resolve => setTimeout(resolve, this.config.YOUTUBE_FADE_OUT_TIME))
			]);
		}

		// Save current timestamp if player exists
		if (this.state.dom.youtubePlayer && this.state.dom.youtubePlayer.getCurrentTime) {
			try {
				const currentTime = this.state.dom.youtubePlayer.getCurrentTime();
				this.state.youtube.sevenLastWordsTimestamp = currentTime;
			} catch (e) {
				console.error('Could not get current time from YouTube player:', e);
			}

			// Destroy the player
			try {
				this.state.dom.youtubePlayer.destroy();
			} catch (e) {
				console.error('Could not destroy YouTube player:', e);
			}
		}

		// Remove the wrapper element
		if (wrapperDiv) {
			wrapperDiv.remove();
		}

		// Clear reference
		this.state.dom.youtubePlayer = null;
	}

	/**
	 * Play an audio file with simple UI
	 * @param {string} songTitle - The display title of the song
	 * @param {string} audioPath - Path to the audio file
	 */
	playAudioWithUI(songTitle, audioPath) {
		// Remove any existing audio player
		this.removeAudioPlayer();

		// Remove YouTube video if it exists
		this.removeYouTubeVideo();

		// Create HTML5 audio element
		const audio = document.createElement('audio');
		audio.src = audioPath;
		audio.preload = 'auto';
		this.state.dom.audioPlayer = audio;

		// Create UI container
		const uiContainer = document.createElement('div');
		uiContainer.id = 'audio-player-ui';
		uiContainer.style.position = 'fixed';
		uiContainer.style.top = '50%';
		uiContainer.style.left = '50%';
		uiContainer.style.transform = 'translate(-50%, -50%)';
		uiContainer.style.zIndex = '130'; // Above toolbar (120) and portfolio containers (105+)
		uiContainer.style.display = 'flex';
		uiContainer.style.flexDirection = 'column';
		uiContainer.style.alignItems = 'center';
		uiContainer.style.gap = '30px';
		uiContainer.style.padding = '40px';
		uiContainer.style.backgroundColor = 'transparent';
		uiContainer.style.borderRadius = '10px';
		uiContainer.style.backdropFilter = `blur(${this.config.BACKDROP_BLUR}px)`;
		uiContainer.style.webkitBackdropFilter = `blur(${this.config.BACKDROP_BLUR}px)`;
		// Add edge fade mask (fade on all sides)
		uiContainer.style.maskImage =
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)';
		uiContainer.style.webkitMaskImage =
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)';
		uiContainer.style.maskComposite = 'intersect';
		uiContainer.style.webkitMaskComposite = 'source-in';
		uiContainer.style.opacity = '0';
		uiContainer.style.transition = 'opacity 0.3s ease';
		uiContainer.style.pointerEvents = 'auto'; // Enable pointer events on container

		// Prevent clicks on container from bubbling
		uiContainer.addEventListener('click', (e) => {
			e.stopPropagation();
		});
		uiContainer.addEventListener('touchend', (e) => {
			e.stopPropagation();
		});

		// Button container (horizontal layout for skip/play/skip)
		const buttonContainer = document.createElement('div');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.alignItems = 'center';
		buttonContainer.style.gap = '20px';

		// Skip backward button
		const skipBackButton = document.createElement('div');
		skipBackButton.textContent = '−15';
		skipBackButton.style.fontFamily = 'Courier New';
		skipBackButton.style.fontSize = '20px';
		skipBackButton.style.color = 'white';
		skipBackButton.style.cursor = 'pointer';
		skipBackButton.style.width = '60px';
		skipBackButton.style.height = '60px';
		skipBackButton.style.display = 'flex';
		skipBackButton.style.alignItems = 'center';
		skipBackButton.style.justifyContent = 'center';
		skipBackButton.style.border = '2px solid white';
		skipBackButton.style.borderRadius = '50%';
		skipBackButton.style.transition = 'transform 0.1s ease';
		skipBackButton.style.userSelect = 'none';
		skipBackButton.style.webkitUserSelect = 'none';
		skipBackButton.style.webkitTapHighlightColor = 'transparent';
		skipBackButton.style.pointerEvents = 'auto';

		skipBackButton.addEventListener('click', (e) => {
			e.stopPropagation();
			audio.currentTime = Math.max(0, audio.currentTime - 15);
		});
		skipBackButton.addEventListener('touchend', (e) => {
			e.preventDefault();
			e.stopPropagation();
			audio.currentTime = Math.max(0, audio.currentTime - 15);
		});
		skipBackButton.addEventListener('mouseenter', () => {
			skipBackButton.style.transform = 'scale(1.1)';
			skipBackButton.style.filter = 'brightness(1.3)';
		});
		skipBackButton.addEventListener('mouseleave', () => {
			skipBackButton.style.transform = 'scale(1)';
			skipBackButton.style.filter = 'brightness(1)';
		});

		// Play/Pause button
		const playButton = document.createElement('div');
		playButton.textContent = '▶';
		playButton.style.fontFamily = 'Courier New';
		playButton.style.fontSize = '48px';
		playButton.style.color = 'white';
		playButton.style.cursor = 'pointer';
		playButton.style.width = '80px';
		playButton.style.height = '80px';
		playButton.style.display = 'flex';
		playButton.style.alignItems = 'center';
		playButton.style.justifyContent = 'center';
		playButton.style.border = '2px solid white';
		playButton.style.borderRadius = '50%';
		playButton.style.transition = 'transform 0.1s ease';
		playButton.style.userSelect = 'none';
		playButton.style.webkitUserSelect = 'none';
		playButton.style.webkitTapHighlightColor = 'transparent';
		playButton.style.pointerEvents = 'auto'; // Enable clicks on button
		playButton.style.paddingLeft = '6px'; // Initial visual centering for play triangle
		playButton.style.paddingRight = '0px';
		playButton.style.paddingTop = '0px';
		playButton.style.paddingBottom = '4px'; // Move play icon up

		// Play/Pause functionality
		let isPlaying = false;
		const togglePlay = () => {
			if (isPlaying) {
				audio.pause();
				playButton.textContent = '▶';
				playButton.style.paddingLeft = '6px'; // Visual centering for play triangle
				playButton.style.paddingRight = '0px';
				playButton.style.paddingTop = '0px';
				playButton.style.paddingBottom = '4px'; // Move play icon up
				isPlaying = false;
			} else {
				audio.play().then(() => {
					// Audio playing successfully
				}).catch(err => {
					console.error('Error playing audio:', err);
				});
				playButton.textContent = '⏸';
				playButton.style.paddingLeft = '0px'; // Reset padding for pause
				playButton.style.paddingRight = '0px';
				playButton.style.paddingTop = '4px'; // Move pause icon down
				playButton.style.paddingBottom = '0px';
				isPlaying = true;
			}
		};

		playButton.addEventListener('click', (e) => {
			e.stopPropagation(); // Prevent click from bubbling to parent elements
			togglePlay();
		});
		playButton.addEventListener('touchend', (e) => {
			e.preventDefault();
			e.stopPropagation(); // Prevent click from bubbling to parent elements
			togglePlay();
		});

		// Hover effects
		playButton.addEventListener('mouseenter', () => {
			playButton.style.transform = 'scale(1.1)';
			playButton.style.filter = 'brightness(1.3)';
		});
		playButton.addEventListener('mouseleave', () => {
			playButton.style.transform = 'scale(1)';
			playButton.style.filter = 'brightness(1)';
		});

		// Auto-update button when audio ends
		audio.addEventListener('ended', () => {
			playButton.textContent = '▶';
			playButton.style.paddingLeft = '6px'; // Visual centering for play triangle
			playButton.style.paddingRight = '0px';
			playButton.style.paddingTop = '0px';
			playButton.style.paddingBottom = '4px'; // Move play icon up
			isPlaying = false;
		});

		// Skip forward button
		const skipForwardButton = document.createElement('div');
		skipForwardButton.textContent = '+15';
		skipForwardButton.style.fontFamily = 'Courier New';
		skipForwardButton.style.fontSize = '20px';
		skipForwardButton.style.color = 'white';
		skipForwardButton.style.cursor = 'pointer';
		skipForwardButton.style.width = '60px';
		skipForwardButton.style.height = '60px';
		skipForwardButton.style.display = 'flex';
		skipForwardButton.style.alignItems = 'center';
		skipForwardButton.style.justifyContent = 'center';
		skipForwardButton.style.border = '2px solid white';
		skipForwardButton.style.borderRadius = '50%';
		skipForwardButton.style.transition = 'transform 0.1s ease';
		skipForwardButton.style.userSelect = 'none';
		skipForwardButton.style.webkitUserSelect = 'none';
		skipForwardButton.style.webkitTapHighlightColor = 'transparent';
		skipForwardButton.style.pointerEvents = 'auto';

		skipForwardButton.addEventListener('click', (e) => {
			e.stopPropagation();
			audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
		});
		skipForwardButton.addEventListener('touchend', (e) => {
			e.preventDefault();
			e.stopPropagation();
			audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
		});
		skipForwardButton.addEventListener('mouseenter', () => {
			skipForwardButton.style.transform = 'scale(1.1)';
			skipForwardButton.style.filter = 'brightness(1.3)';
		});
		skipForwardButton.addEventListener('mouseleave', () => {
			skipForwardButton.style.transform = 'scale(1)';
			skipForwardButton.style.filter = 'brightness(1)';
		});

		// Assemble buttons
		buttonContainer.appendChild(skipBackButton);
		buttonContainer.appendChild(playButton);
		buttonContainer.appendChild(skipForwardButton);

		// Progress bar container
		const progressContainer = document.createElement('div');
		progressContainer.style.width = '100%';
		progressContainer.style.maxWidth = '400px';
		progressContainer.style.display = 'flex';
		progressContainer.style.flexDirection = 'column';
		progressContainer.style.gap = '8px';

		// Time display (current / total)
		const timeDisplay = document.createElement('div');
		timeDisplay.textContent = '0:00 / 0:00';
		timeDisplay.style.fontFamily = 'Courier New';
		timeDisplay.style.fontSize = '14px';
		timeDisplay.style.color = 'white';
		timeDisplay.style.textAlign = 'center';
		timeDisplay.style.userSelect = 'none';
		timeDisplay.style.webkitUserSelect = 'none';

		// Progress bar track
		const progressTrack = document.createElement('div');
		progressTrack.style.width = '100%';
		progressTrack.style.height = '6px';
		progressTrack.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
		progressTrack.style.borderRadius = '3px';
		progressTrack.style.cursor = 'pointer';
		progressTrack.style.position = 'relative';
		progressTrack.style.overflow = 'hidden';

		// Progress bar fill
		const progressFill = document.createElement('div');
		progressFill.style.width = '0%';
		progressFill.style.height = '100%';
		progressFill.style.backgroundColor = 'white';
		progressFill.style.borderRadius = '3px';

		progressTrack.appendChild(progressFill);

		// Format time as M:SS
		const formatTime = (seconds) => {
			if (isNaN(seconds)) return '0:00';
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins}:${secs.toString().padStart(2, '0')}`;
		};

		// Click and drag to seek with visual preview
		let isDragging = false;
		let dragStartWasPlaying = false;

		// Update progress bar
		const updateProgress = () => {
			// Don't update visual progress while user is dragging
			if (!isDragging) {
				const currentTime = audio.currentTime;
				const duration = audio.duration || 0;
				const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
				progressFill.style.width = progress + '%';
				timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
			}
		};

		// Update progress on timeupdate
		audio.addEventListener('timeupdate', updateProgress);
		audio.addEventListener('loadedmetadata', updateProgress);

		const updateVisualProgress = (clientX) => {
			const rect = progressTrack.getBoundingClientRect();
			const clickX = clientX - rect.left;
			const percent = Math.max(0, Math.min(1, clickX / rect.width));
			progressFill.style.width = (percent * 100) + '%';
			const previewTime = percent * audio.duration;
			timeDisplay.textContent = `${formatTime(previewTime)} / ${formatTime(audio.duration)}`;
			return percent;
		};

		progressTrack.addEventListener('mousedown', (e) => {
			e.stopPropagation();
			isDragging = true;
			dragStartWasPlaying = !audio.paused;
			updateVisualProgress(e.clientX);
		});

		document.addEventListener('mousemove', (e) => {
			if (isDragging) {
				updateVisualProgress(e.clientX);
			}
		});

		document.addEventListener('mouseup', (e) => {
			if (isDragging) {
				const percent = updateVisualProgress(e.clientX);
				audio.currentTime = percent * audio.duration;

				// Ensure it keeps playing if it was playing
				if (dragStartWasPlaying) {
					audio.play();
				}
				isDragging = false;
			}
		});

		// Touch support
		progressTrack.addEventListener('touchstart', (e) => {
			e.stopPropagation();
			isDragging = true;
			dragStartWasPlaying = !audio.paused;
			const touch = e.touches[0];
			updateVisualProgress(touch.clientX);
		});

		progressTrack.addEventListener('touchmove', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const touch = e.touches[0];
			updateVisualProgress(touch.clientX);
		});

		progressTrack.addEventListener('touchend', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const touch = e.changedTouches[0];
			const percent = updateVisualProgress(touch.clientX);
			const wasPlaying = dragStartWasPlaying;

			audio.currentTime = percent * audio.duration;

			if (wasPlaying) {
				audio.play();
			}
			isDragging = false;
		});

		// Assemble progress bar
		progressContainer.appendChild(timeDisplay);
		progressContainer.appendChild(progressTrack);

		// Assemble UI
		uiContainer.appendChild(buttonContainer);
		uiContainer.appendChild(progressContainer);
		document.body.appendChild(uiContainer); // Append directly to body, not overlay

		// Keyboard shortcuts
		const keyboardHandler = (event) => {
			// Only handle if audio player is visible
			if (!this.state.dom.audioPlayer) return;

			if (event.code === 'Space') {
				event.preventDefault();
				togglePlay();
				// Animate play button
				playButton.style.transform = 'scale(1.2)';
				playButton.style.filter = 'brightness(1.3)';
				setTimeout(() => {
					playButton.style.transform = 'scale(1)';
					playButton.style.filter = 'brightness(1)';
				}, 100);
			} else if (event.code === 'ArrowLeft') {
				event.preventDefault();
				audio.currentTime = Math.max(0, audio.currentTime - 15);
				// Animate skip back button
				skipBackButton.style.transform = 'scale(1.2)';
				skipBackButton.style.filter = 'brightness(1.3)';
				setTimeout(() => {
					skipBackButton.style.transform = 'scale(1)';
					skipBackButton.style.filter = 'brightness(1)';
				}, 100);
			} else if (event.code === 'ArrowRight') {
				event.preventDefault();
				audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
				// Animate skip forward button
				skipForwardButton.style.transform = 'scale(1.2)';
				skipForwardButton.style.filter = 'brightness(1.3)';
				setTimeout(() => {
					skipForwardButton.style.transform = 'scale(1)';
					skipForwardButton.style.filter = 'brightness(1)';
				}, 100);
			}
		};

		document.addEventListener('keydown', keyboardHandler);
		// Store handler reference for cleanup
		uiContainer._keyboardHandler = keyboardHandler;

		// Fade in
		setTimeout(() => {
			uiContainer.style.opacity = '1';
		}, 50);

		// Auto-play
		audio.play();
		playButton.textContent = '⏸';
		playButton.style.paddingLeft = '0px'; // Reset padding for pause icon
		playButton.style.paddingRight = '0px';
		playButton.style.paddingTop = '4px'; // Move pause icon down
		playButton.style.paddingBottom = '0px';
		isPlaying = true;
	}

	/**
	 * Activate Simon project page — centered video (7LW-style) with scrollable description
	 */
	activateSimonMode() {
		const margin = 40;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		const overlay = document.createElement('div');
		overlay.id = 'simon-overlay';
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.zIndex = '100';
		overlay.style.overflowY = 'auto';
		overlay.style.webkitOverflowScrolling = 'touch';
		overlay.style.opacity = '0';
		overlay.style.transition = `opacity ${this.config.YOUTUBE_FADE_IN_TIME / 1000}s ease`;

		const content = document.createElement('div');
		content.style.display = 'flex';
		content.style.flexDirection = 'column';
		content.style.alignItems = 'center';
		content.style.padding = `160px ${margin}px ${margin}px`;
		content.style.boxSizing = 'border-box';
		content.style.minHeight = '100%';

		const videoWrapper = document.createElement('div');
		videoWrapper.style.width = '100%';
		videoWrapper.style.maxWidth = (vw - margin * 2) + 'px';
		videoWrapper.style.boxShadow = '0 0 50px rgba(0, 0, 0, 0.5)';

		const video = document.createElement('video');
		video.src = 'assets/visual/simon/Arduino Simon.mp4';
		video.controls = true;
		video.playsInline = true;
		video.autoplay = true;
		video.muted = true;
		video.style.display = 'block';
		video.style.width = '100%';
		video.style.maxHeight = (vh - margin * 2) + 'px';

		videoWrapper.appendChild(video);

		const description = document.createElement('div');
		description.style.fontFamily = 'Courier New';
		description.style.fontSize = '16px';
		description.style.color = 'white';
		description.style.lineHeight = '1.7';
		description.style.marginBottom = '40px';
		description.style.width = '100%';
		description.style.maxWidth = '800px';
		description.innerHTML = `<p style="margin:0">one of my first arduino projects exploring primitive i/o hardware through a state-based interactive game. includes custom sound and visual design for 4 difficulty levels, some of which feature timing components and generative elements.</p>`;

		content.appendChild(description);
		content.appendChild(videoWrapper);
		overlay.appendChild(content);
		document.body.appendChild(overlay);

		setTimeout(() => { overlay.style.opacity = '1'; }, 50);
		this._simonOverlay = overlay;
	}

	/**
	 * Deactivate Simon mode and clean up
	 */
	deactivateSimonMode() {
		if (!this._simonOverlay) return;
		const overlay = this._simonOverlay;
		const video = overlay.querySelector('video');
		if (video) video.pause();
		overlay.style.transition = `opacity ${this.config.YOUTUBE_FADE_OUT_TIME / 1000}s ease`;
		overlay.style.opacity = '0';
		setTimeout(() => { overlay.remove(); }, this.config.YOUTUBE_FADE_OUT_TIME);
		this._simonOverlay = null;
	}

	/**
	 * Remove audio player and UI
	 */
	removeAudioPlayer() {
		// Remove keyboard handler
		const uiContainer = document.getElementById('audio-player-ui');
		if (uiContainer && uiContainer._keyboardHandler) {
			document.removeEventListener('keydown', uiContainer._keyboardHandler);
		}

		// Stop and remove audio element
		if (this.state.dom.audioPlayer) {
			this.state.dom.audioPlayer.pause();
			this.state.dom.audioPlayer = null;
		}

		// Remove UI
		if (uiContainer) {
			uiContainer.style.opacity = '0';
			setTimeout(() => {
				uiContainer.remove();
			}, 300);
		}
	}
}

// Make MediaController available globally for p5.js
window.MediaController = MediaController;
