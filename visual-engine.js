// ==================== VISUAL ENGINE ====================
// Handles all visual spawning, animations, tickers, and cleanup

class VisualEngine {
	constructor(state, config, audioEngine) {
		this.state = state;
		this.config = config;
		this.audioEngine = audioEngine;
		this.activeAnimations = []; // Track all active visual animations for cleanup
	}

	/**
	 * Spawn media (image or video) based on configuration
	 */
	spawnMedia(x, y) {
		// Block spawning if a video is currently playing
		if (this.state.visual.videoIsPlaying) {
			return;
		}

		// Mark that media has been spawned (for audio notice fade)
		this.state.ui.hasSpawnedMedia = true;

		// Check if both images and videos are loaded
		let canSpawnImage = this.state.assets.imagesLoaded && this.state.assets.spawnerImages.length > 0;
		let canSpawnVideo = this.state.assets.videosLoaded && this.state.assets.spawnerVideos.length > 0;

		if (!canSpawnImage && !canSpawnVideo) {
			return;
		}

		// Video can only spawn if at least SPAWN_MIN_IMAGES_BEFORE_VIDEO images have been spawned since last video
		let shouldConsiderVideo = canSpawnVideo && this.state.visual.imagesSinceLastVideo >= this.config.SPAWN_MIN_IMAGES_BEFORE_VIDEO;

		if (shouldConsiderVideo) {
			// SPAWN_VIDEO_PROBABILITY chance to spawn video
			if (random() < this.config.SPAWN_VIDEO_PROBABILITY) {
				this.spawnVideo(x, y, null, null); // No videoData, no config
				this.state.visual.imagesSinceLastVideo = 0; // Reset counter after spawning video
			} else {
				this.spawnImage(x, y);
				this.state.visual.imagesSinceLastVideo++;
			}
		} else {
			// Always spawn image if video conditions not met
			this.spawnImage(x, y);
			this.state.visual.imagesSinceLastVideo++;
		}
	}

	/**
	 * Spawn an image with animation
	 */
	spawnImage(x, y) {
		if (!this.state.assets.imagesLoaded || this.state.assets.spawnerImages.length === 0) {
			return;
		}

		// Get next image in shuffled order
		let imgIndex = this.state.assets.imageOrder[this.state.assets.currentImageIndex];
		this.state.assets.currentImageIndex = (this.state.assets.currentImageIndex + 1) % this.state.assets.imageOrder.length;

		// Spawn oscillator via audio engine using pattern
		const pattern = [{ time: 0, note: 'random' }];
		let oscData = this.audioEngine.spawnPattern(pattern, { x, y });

		// Create img element
		let img = document.createElement('img');
		img.src = this.state.assets.spawnerImages[imgIndex].path;
		img.style.position = 'absolute';
		img.style.left = x + 'px';
		img.style.top = y + 'px';
		img.style.maxWidth = random(this.config.MEDIA_SIZE_MIN, this.config.MEDIA_SIZE_MAX) + 'px';
		img.style.maxHeight = random(this.config.MEDIA_SIZE_MIN, this.config.MEDIA_SIZE_MAX) + 'px';
		img.style.objectFit = 'contain';
		img.style.pointerEvents = 'none';
		img.style.zIndex = '10';
		img.style.transform = 'translate(-50%, -50%)';
		img.style.transition = 'opacity 1s ease-out';
		// Apply transparency vignette via mask - square vignette on all edges
		img.style.webkitMaskImage = 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)';
		img.style.maskImage = 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)';
		img.style.webkitMaskComposite = 'source-in';
		img.style.maskComposite = 'intersect';
		img.style.webkitMaskSize = '100% 100%';
		img.style.maskSize = '100% 100%';
		img.style.webkitMaskRepeat = 'no-repeat';
		img.style.maskRepeat = 'no-repeat';
		img.style.webkitMaskPosition = 'center';
		img.style.maskPosition = 'center';

		document.body.appendChild(img);

		// Create ticker element
		let ticker = this._createTickerFromData(this.state.assets.spawnerImages[imgIndex]);
		document.body.appendChild(ticker);

		// Add to activeTickers array at the beginning (so it appears at bottom)
		let tickerData = {
			element: ticker,
			startTime: Date.now()
		};
		this.state.visual.activeTickers.unshift(tickerData);

		// Update positions of all tickers
		this._updateTickerPositions();

		// Preload next image for better responsiveness
		this.preloadNextImage();

		// Start animation
		this._startImageAnimation(img, ticker, oscData, x, y);
	}

	/**
	 * Spawn a video with animation
	 */
	spawnVideo(x, y, videoData = null, spawnerConfig = null) {
		// Use spawner config if provided, otherwise use welcome screen default
		let config = spawnerConfig || {
			// Default welcome screen config
			playbackMode: 'random',
			speed: 'stretched',
			duration: 'fixed',
			fixedDuration: this.config.ANIMATION_DURATION,
			fadeStartTime: this.config.ANIMATION_FADE_START_TIME,
			showTicker: true,
			hasOscillator: true,
			size: 'random',
			movement: 'normal',
			scaleGrowth: this.config.ANIMATION_SCALE_GROWTH
		};

		// If no videoData provided, get from welcome screen shuffled videos
		if (!videoData) {
			if (!this.state.assets.videosLoaded || this.state.assets.spawnerVideos.length === 0) {
				return;
			}
			// Get next video in shuffled order
			let videoIndex = this.state.assets.videoOrder[this.state.assets.currentVideoIndex];
			this.state.assets.currentVideoIndex = (this.state.assets.currentVideoIndex + 1) % this.state.assets.videoOrder.length;
			videoData = this.state.assets.spawnerVideos[videoIndex];
		}

		// Set flag to block other spawns while video is playing
		this.state.visual.videoIsPlaying = true;

		// Only create oscillator if config specifies it
		let oscData = null;
		let audioContext = getAudioContext();

		if (config.hasOscillator) {
			// For welcome screen videos (no spawnerConfig), spawn 2-note chord
			// For spawner mode videos, spawn a single oscillator
			if (!spawnerConfig) {
				// Welcome screen: spawn 2 adjacent notes from top half of scale
				const [freq1, freq2] = this.audioEngine._selectAdjacentNotes();
				const pattern = [
					{ time: 0, note: freq1 },
					{ time: 0, note: freq2 }
				];
				oscData = this.audioEngine.spawnPattern(pattern, { x, y });
			} else {
				// Spawner mode: spawn single random oscillator
				const pattern = [{ time: 0, note: 'random' }];
				oscData = this.audioEngine.spawnPattern(pattern, { x, y });
			}
		}

		// Create video element
		let video = document.createElement('video');
		video.src = videoData.path;
		video.style.position = 'absolute';
		video.style.left = x + 'px';
		video.style.top = y + 'px';

		// Set video size based on config
		// Special case: if config.size is 'fullscreen' but we're on 2nd+ video (currentIndex > 1), use max instead
		let effectiveSize = config.size;
		if (config.size === 'fullscreen' && config.currentIndex && config.currentIndex > 1) {
			effectiveSize = 'max';
		}

		if (effectiveSize === 'fullscreen') {
			// Fill the viewport
			video.style.maxWidth = windowWidth + 'px';
			video.style.maxHeight = windowHeight + 'px';
		} else if (effectiveSize === 'max') {
			video.style.maxWidth = this.config.MEDIA_SIZE_MAX + 'px';
			video.style.maxHeight = this.config.MEDIA_SIZE_MAX + 'px';
		} else {
			// Random size between MEDIA_SIZE_MIN and MEDIA_SIZE_MAX
			let randomSize = random(this.config.MEDIA_SIZE_MIN, this.config.MEDIA_SIZE_MAX);
			video.style.maxWidth = randomSize + 'px';
			video.style.maxHeight = randomSize + 'px';
		}

		video.style.objectFit = 'contain';
		video.style.pointerEvents = 'none';
		video.style.zIndex = '10';
		video.style.transform = 'translate(-50%, -50%)';
		video.style.transition = 'opacity 1s ease-out';
		// Apply transparency vignette via mask - square vignette on all edges
		video.style.webkitMaskImage = 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)';
		video.style.maskImage = 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)';
		video.style.webkitMaskComposite = 'source-in';
		video.style.maskComposite = 'intersect';
		video.style.webkitMaskSize = '100% 100%';
		video.style.maskSize = '100% 100%';
		video.style.webkitMaskRepeat = 'no-repeat';
		video.style.maskRepeat = 'no-repeat';
		video.style.webkitMaskPosition = 'center';
		video.style.maskPosition = 'center';
		video.muted = true; // Mute video element, we'll play audio separately
		video.loop = false;
		video.playsInline = true; // For iOS compatibility
		video.preload = 'auto'; // Preload video for smoother playback

		// Set initial opacity based on whether fade-in is configured
		if (config.fadeInTime && config.fadeInTime > 0) {
			video.style.opacity = '0';
		}

		// Store actual video duration
		let actualVideoDuration = config.fixedDuration;
		let metadataLoaded = false;

		// Adjust playback rate based on config
		const handleMetadata = () => {
			actualVideoDuration = video.duration;
			metadataLoaded = true;
			if (config.speed === 'stretched') {
				// Time-stretch video to fit fixed duration
				video.playbackRate = video.duration / config.fixedDuration;
			} else {
				// Play at normal speed
				video.playbackRate = 1.0;
				// Update actual duration for animation
				if (config.duration === 'full') {
					actualVideoDuration = video.duration;
				}
			}

			// Start animation after metadata is loaded for full-duration videos
			if (config.duration === 'full' && config.speed === 'normal') {
				this._startVideoAnimation(video, ticker, oscData, x, y, config, actualVideoDuration, videoData);
			}
		};

		video.addEventListener('loadedmetadata', handleMetadata, { once: true });

		document.body.appendChild(video);

		// Prevent video from pausing when audio devices change (e.g., removing AirPods)
		video.addEventListener('pause', function() {
			// Only resume if video hasn't ended naturally
			if (!video.ended) {
				video.play().catch(err => {
					// Silently ignore play errors
				});
			}
		});

		// Explicitly play video for mobile compatibility
		video.play().catch(err => {
			// Video play error (silently ignore)
		});

		// Create ticker element (only if config specifies)
		let ticker = null;
		if (config.showTicker) {
			ticker = this._createTickerFromData(videoData);
			document.body.appendChild(ticker);

			// Add to activeTickers array at the beginning (so it appears at bottom)
			let tickerData = {
				element: ticker,
				startTime: Date.now()
			};
			this.state.visual.activeTickers.unshift(tickerData);

			// Update positions of all tickers
			this._updateTickerPositions();
		}

		// Preload next video for better responsiveness (only for welcome screen)
		if (!spawnerConfig) {
			this.preloadNextVideo();
		}

		// Start animation
		// For full-duration normal-speed videos, animation is started in the loadedmetadata handler
		// For other videos, start immediately
		if (!(config.duration === 'full' && config.speed === 'normal')) {
			this._startVideoAnimation(video, ticker, oscData, x, y, config, actualVideoDuration, videoData);
		}
	}

	/**
	 * Spawn video from spawner config
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {Object} spawnerConfig - Spawner configuration object
	 */
	spawnVideoFromConfig(x, y, spawnerConfig) {
		if (!spawnerConfig || !spawnerConfig.videoSet || spawnerConfig.videoSet.length === 0) {
			return;
		}

		// Select video based on playback mode
		let videoIndex;
		if (spawnerConfig.playbackMode === 'sequential') {
			videoIndex = spawnerConfig.currentIndex;
			spawnerConfig.currentIndex = (spawnerConfig.currentIndex + 1) % spawnerConfig.videoSet.length;
		} else {
			videoIndex = Math.floor(Math.random() * spawnerConfig.videoSet.length);
		}

		let videoData = spawnerConfig.videoSet[videoIndex];

		if (!videoData || !videoData.path) {
			return;
		}

		// Call spawnVideo with the specific video data and config
		this.spawnVideo(x, y, videoData, spawnerConfig);
	}

	/**
	 * Stop all active visual animations with fade-out
	 * @param {boolean} useBackgroundFade - If true, use CSS transitions + setTimeout instead of RAF
	 * @param {number} fadeDuration - Fade duration in milliseconds (default 2000)
	 */
	stopAll(useBackgroundFade = false, fadeDuration = 2000) {
		// Always use CSS transitions for reliable, immediate fades
		// Make a copy since we'll be modifying the array during iteration
		const animations = [...this.activeAnimations];

		animations.forEach(animState => {
			// Cancel animation frame immediately to prevent RAF loop interference
			if (animState.animationFrame) {
				cancelAnimationFrame(animState.animationFrame);
				animState.animationFrame = null;
			}

			// Apply CSS fade-out to visual elements
			if (animState.element) {
				animState.element.style.transition = `opacity ${fadeDuration}ms ease-out`;
				animState.element.style.opacity = '0';
			}
			if (animState.ticker) {
				animState.ticker.style.transition = `opacity ${fadeDuration}ms ease-out`;
				animState.ticker.style.opacity = '0';
			}

			// Fade out oscillators
			const oscDataArray = animState.oscData ? (Array.isArray(animState.oscData) ? animState.oscData : [animState.oscData]) : [];
			oscDataArray.forEach(osc => {
				if (osc && osc.osc) {
					osc.osc.amp(0, fadeDuration / 1000);
				}
			});

			// Fade out video audio
			if (animState.videoAudioNodes && animState.videoAudioNodes.gain) {
				const audioContext = getAudioContext();
				const fadeTime = fadeDuration / 1000;
				animState.videoAudioNodes.gain.gain.setTargetAtTime(0, audioContext.currentTime, fadeTime / 3);
			}

			// Schedule cleanup after fade completes
			setTimeout(() => {
				this._cleanupAnimationDom(animState);
			}, fadeDuration);
		});

		// Clear the animations array immediately since cleanup is scheduled
		this.activeAnimations = [];
	}

	/**
	 * Clean up a single animation's DOM elements and state
	 * @private
	 */
	_cleanupAnimationDom(animState) {
		// Remove visual element
		if (animState.element && animState.element.parentNode) {
			animState.element.parentNode.removeChild(animState.element);
		}

		// Remove ticker
		if (animState.ticker && animState.ticker.parentNode) {
			animState.ticker.parentNode.removeChild(animState.ticker);
			const tickerIndex = this.state.visual.activeTickers.findIndex(
				item => item.element === animState.ticker
			);
			if (tickerIndex !== -1) {
				this.state.visual.activeTickers.splice(tickerIndex, 1);
			}
		}

		// Stop video audio (oscillator already stopped by stopOscillator call)
		if (animState.videoAudioNodes && Object.keys(animState.videoAudioNodes).length > 0) {
			this.audioEngine.stopVideoAudio(animState.videoAudioNodes);
		}

		// Clear video playing flag
		if (animState.isVideo) {
			this.state.visual.videoIsPlaying = false;
		}

		// Cancel any pending animation frame
		if (animState.animationFrame) {
			cancelAnimationFrame(animState.animationFrame);
		}
	}

	/**
	 * Preload next image (called after manifest loads)
	 */
	preloadNextImage() {
		if (!this.state.assets.imagesLoaded || this.state.assets.spawnerImages.length === 0) return;

		let nextImgIndex = this.state.assets.imageOrder[this.state.assets.currentImageIndex];
		let img = new Image();
		img.src = this.state.assets.spawnerImages[nextImgIndex].path;
		this.state.assets.preloadedImage = img;
	}

	/**
	 * Preload next video (called after manifest loads)
	 */
	preloadNextVideo() {
		if (!this.state.assets.videosLoaded || this.state.assets.spawnerVideos.length === 0) return;

		let nextVideoIndex = this.state.assets.videoOrder[this.state.assets.currentVideoIndex];
		let video = document.createElement('video');
		video.src = this.state.assets.spawnerVideos[nextVideoIndex].path;
		video.preload = 'auto';
		this.state.assets.preloadedVideo = video;
	}

	// ==================== PRIVATE METHODS ====================

	/**
	 * Create a ticker element from media data
	 * @param {Object} data - Media data with caption, time, and place
	 * @returns {HTMLElement} The ticker element
	 */
	_createTickerFromData(data) {
		let ticker = document.createElement('div');

		// Build ticker content
		let tickerContent = data.caption;
		if (data.time || data.place) {
			tickerContent += '\n';
			if (data.time) tickerContent += data.time;
			if (data.time && data.place) tickerContent += ' | ';
			if (data.place) tickerContent += data.place;
		}

		ticker.textContent = tickerContent;
		ticker.style.position = 'fixed';
		ticker.style.left = this.config.TICKER_LEFT_MARGIN + 'px';
		ticker.style.bottom = this.config.TICKER_BOTTOM_MARGIN + 'px';
		ticker.style.padding = this.config.TICKER_PADDING + 'px';
		ticker.style.background = 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.33) 0%, rgba(0, 0, 0, 0.165) 70%, rgba(0, 0, 0, 0) 100%)';
		ticker.style.color = 'white';
		ticker.style.fontFamily = 'Courier New';
		ticker.style.fontSize = this.config.TICKER_FONT_SIZE + 'px';
		ticker.style.border = 'none';
		ticker.style.borderRadius = '5px';
		ticker.style.zIndex = '100';
		ticker.style.transition = 'bottom 0.3s ease-out';
		ticker.style.pointerEvents = 'none';
		ticker.style.wordWrap = 'break-word';
		ticker.style.whiteSpace = 'pre-line';
		ticker.style.width = 'fit-content';
		ticker.style.maxWidth = 'calc(100vw - ' + (this.config.TICKER_LEFT_MARGIN + this.config.TICKER_RIGHT_MARGIN) + 'px)';

		return ticker;
	}

	_updateTickerPositions() {
		// Move all tickers to their new positions
		let currentBottom = this.config.TICKER_BOTTOM_MARGIN;

		for (let i = 0; i < this.state.visual.activeTickers.length; i++) {
			let ticker = this.state.visual.activeTickers[i];
			ticker.element.style.bottom = currentBottom + 'px';
			currentBottom += ticker.element.offsetHeight + this.config.TICKER_SPACING;
		}
	}

	/**
	 * Unified animation loop for both images and videos
	 * @param {Object} params - Animation configuration
	 * @param {HTMLElement} params.element - The img or video element to animate
	 * @param {HTMLElement} params.ticker - Optional ticker element
	 * @param {Object} params.oscData - Optional oscillator data from AudioEngine
	 * @param {Object} params.videoAudioNodes - Optional video audio nodes (for video only)
	 * @param {number} params.startX - Starting X position
	 * @param {number} params.startY - Starting Y position
	 * @param {Object} params.config - Animation configuration (movement, duration, fadeInTime, etc.)
	 * @param {boolean} params.isVideo - Whether this is a video (for cleanup logic)
	 */
	_startAnimation(params) {
		const { element, ticker, oscData, videoAudioNodes, startX, startY, config, isVideo } = params;

		// Calculate movement based on config
		let angle = random(TWO_PI);
		let speed;

		if (config && config.movement === 'subtle' && config.currentIndex === 1) {
			// First video in sequence - no movement
			speed = 0;
		} else if (config && config.movement === 'subtle') {
			// Subtle drift
			speed = 0.001;
		} else if (config && config.movement === 'none') {
			// No movement
			speed = 0;
		} else {
			// Normal random movement (default for images)
			speed = random(this.config.ANIMATION_SPEED_MIN, this.config.ANIMATION_SPEED_MAX);
		}
		let vx = cos(angle) * speed;
		let vy = sin(angle) * speed;

		// Calculate animation duration
		const animDuration = (config && config.actualVideoDuration)
			? config.actualVideoDuration
			: (config && config.duration === 'full' && isVideo && element.duration)
				? element.duration
				: (config && config.fixedDuration)
					? config.fixedDuration
					: this.config.ANIMATION_DURATION;

		const fadeStartTime = (config && config.fadeStartTime)
			? config.fadeStartTime
			: this.config.ANIMATION_FADE_START_TIME;

		const fadeInTime = (config && config.fadeInTime) || 0;

		const scaleGrowth = (config && config.scaleGrowth) || this.config.ANIMATION_SCALE_GROWTH;

		// Animation state tracking
		let startTime = Date.now();
		let animationFrame;
		let frameCounter = 0;

		let animationState = {
			element: element,
			ticker: ticker,
			oscData: oscData,
			videoAudioNodes: videoAudioNodes || {},
			isVideo: isVideo,
			animationFrame: null,
			forceStartFadeOut: false,
			fadeOutStartTime: null,
			releaseTriggered: false // Track if ADSR release has been triggered
		};
		this.activeAnimations.push(animationState);

		const animate = () => {
			let elapsed = (Date.now() - startTime) / 1000;
			frameCounter++;

			// Normalize oscData to array for consistent handling (chord = array, single = array of 1)
			const oscDataArray = oscData ? (Array.isArray(oscData) ? oscData : [oscData]) : [];

			// Check for forced early fade-out
			if (animationState.forceStartFadeOut && animationState.fadeOutStartTime === null) {
				animationState.fadeOutStartTime = Date.now();
			}

			// Calculate effective elapsed time for fade-out
			let fadeElapsed = elapsed;
			if (animationState.fadeOutStartTime !== null) {
				let fadeStartFromEnd = animDuration - fadeStartTime;
				fadeElapsed = fadeStartFromEnd + (Date.now() - animationState.fadeOutStartTime) / 1000;
			}

			if (fadeElapsed < animDuration) {
				// === Mouse proximity filter modulation (shared code) ===
				if (oscDataArray.length > 0 && !this.state.device.isTouchDevice &&
					!this.state.ui.isHoveringWelcome && !this.state.ui.showProfile) {
					let centerX = windowWidth / 2;
					let centerY = windowHeight / 2;
					let d = dist(mouseX, mouseY, centerX, centerY);
					let maxDist = dist(0, 0, centerX, centerY);
					let normalizedDist = constrain(d / maxDist, 0, 1);
					let exponentialFactor = pow(1 - normalizedDist, 3);
					let cutoffFreq = this.state.audio.maxFrequency +
						(exponentialFactor * (this.config.AUDIO_FILTER_CUTOFF_MAX - this.state.audio.maxFrequency));

					// Apply filter modulation to all oscillators in the chord
					oscDataArray.forEach(osc => {
						if (osc.filter) {
							osc.filter.freq(cutoffFreq, this.config.AUDIO_FILTER_RAMP_TIME);
						}
					});
				}

				// === Movement (shared code) ===
				let newX = startX + vx * elapsed * 60;
				let newY = startY + vy * elapsed * 60;
				element.style.left = newX + 'px';
				element.style.top = newY + 'px';

				// === Audio panning (shared code) ===
				if (oscDataArray.length > 0) {
					let panValue = (newX / windowWidth) * 2 - 1;
					panValue = constrain(panValue, -1, 1);
					// Apply panning to all oscillators in the chord
					oscDataArray.forEach(osc => {
						if (osc.panner) {
							osc.panner.pan.value = panValue;
						}
					});
				}
				if (videoAudioNodes && videoAudioNodes.panner) {
					let panValue = (newX / windowWidth) * 2 - 1;
					panValue = constrain(panValue, -1, 1);
					videoAudioNodes.panner.pan.value = panValue;
				}

				// === Scaling (shared code) ===
				let scale = 1 + (elapsed / animDuration) * scaleGrowth;
				element.style.transform = `translate(-50%, -50%) scale(${scale})`;

				// === Fade-in logic (video only) ===
				if (fadeInTime > 0 && elapsed < fadeInTime) {
					let fadeInProgress = elapsed / fadeInTime;
					let easedProgress = fadeInProgress * fadeInProgress * (3 - 2 * fadeInProgress);
					let visualOpacity = easedProgress;
					element.style.opacity = visualOpacity;
					if (ticker) ticker.style.opacity = visualOpacity;

					// Audio fade-in for all oscillators
					let audioOpacity = pow(fadeInProgress, 0.5);
					if (frameCounter % this.config.AUDIO_AMPLITUDE_FADE_THROTTLE === 0) {
						oscDataArray.forEach(osc => {
							if (osc && osc.envelope) {
								osc.osc.amp(osc.amplitude * audioOpacity, osc.envelope.attack);
							}
						});
						if (videoAudioNodes && videoAudioNodes.gain) {
							videoAudioNodes.gain.gain.value = audioOpacity;
						}
					}
				}
				// === Sustain period (video only) ===
				else if (fadeInTime > 0 && elapsed >= fadeInTime && elapsed < animDuration - fadeStartTime) {
					element.style.opacity = 1;
					if (ticker) ticker.style.opacity = 1;
					if (frameCounter % this.config.AUDIO_AMPLITUDE_FADE_THROTTLE === 0) {
						oscDataArray.forEach(osc => {
							if (osc && osc.envelope) {
								osc.osc.amp(osc.amplitude, osc.envelope.attack);
							}
						});
						if (videoAudioNodes && videoAudioNodes.gain) {
							videoAudioNodes.gain.gain.value = 1.0;
						}
					}
				}

				// === Fade-out logic (shared structure) ===
				let fadeOutStartTime = animDuration - fadeStartTime;
				if (elapsed > fadeOutStartTime) {
					let fadeProgress = (elapsed - fadeOutStartTime) / (animDuration - fadeOutStartTime);

					// Trigger ADSR release once when fade-out starts
					if (!animationState.releaseTriggered) {
						oscDataArray.forEach(osc => {
							if (osc && osc.envelope) {
								this.audioEngine.stopOscillator(osc); // Trigger ADSR release
							}
						});
						animationState.releaseTriggered = true;
					}

					// Visual fade
					let easedProgress = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
					let visualOpacity = 1 - easedProgress;
					element.style.opacity = visualOpacity;
					if (ticker) ticker.style.opacity = visualOpacity;

					// Video audio fade (manual, since it doesn't use ADSR)
					if (videoAudioNodes && videoAudioNodes.gain) {
						let audioOpacity = pow(1 - fadeProgress, 6);
						videoAudioNodes.gain.gain.value = audioOpacity;
					}
				}

				animationFrame = requestAnimationFrame(animate);
				animationState.animationFrame = animationFrame;
			} else {
				// === Cleanup (type-specific) ===
				document.body.removeChild(element);

				// Stop all oscillators (handles both single and array)
				// Use immediate=true since ADSR release was already triggered during fade-out
				oscDataArray.forEach(osc => {
					if (osc) {
						this.audioEngine.stopOscillator(osc, true);
					}
				});

				if (videoAudioNodes && Object.keys(videoAudioNodes).length > 0) {
					this.audioEngine.stopVideoAudio(videoAudioNodes);
				}

				if (ticker) {
					document.body.removeChild(ticker);
					let tickerIndex = this.state.visual.activeTickers.findIndex(item => item.element === ticker);
					if (tickerIndex !== -1) {
						this.state.visual.activeTickers.splice(tickerIndex, 1);
					}
				}

				if (isVideo) {
					this.state.visual.videoIsPlaying = false;
				}

				let animIndex = this.activeAnimations.indexOf(animationState);
				if (animIndex !== -1) {
					this.activeAnimations.splice(animIndex, 1);
				}

				cancelAnimationFrame(animationFrame);
			}
		};

		animate();
	}

	_startImageAnimation(img, ticker, oscData, startX, startY) {
		this._startAnimation({
			element: img,
			ticker: ticker,
			oscData: oscData,
			videoAudioNodes: null,
			startX: startX,
			startY: startY,
			config: null, // Use defaults
			isVideo: false
		});
	}

	_startVideoAnimation(video, ticker, oscData, startX, startY, config, actualVideoDuration, videoData) {
		// Setup video audio through audio engine
		let initialGain = (config.fadeInTime && config.fadeInTime > 0) ? 0 : 1.0;
		let videoAudioNodes = this.audioEngine.playVideoAudio(videoData.path, { x: startX, y: startY }, initialGain);

		// Pass actualVideoDuration through config so it's available in _startAnimation
		const animConfig = { ...config };
		if (config.duration === 'full' && config.speed === 'normal') {
			// For full-duration normal-speed videos, use actualVideoDuration
			animConfig.actualVideoDuration = actualVideoDuration;
		}

		this._startAnimation({
			element: video,
			ticker: ticker,
			oscData: oscData,
			videoAudioNodes: videoAudioNodes,
			startX: startX,
			startY: startY,
			config: animConfig,
			isVideo: true
		});
	}
}

// Make VisualEngine available globally for p5.js
window.VisualEngine = VisualEngine;
