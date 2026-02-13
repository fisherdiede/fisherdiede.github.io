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
