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
	 * @returns {Object} Audio config for potential reversal
	 */
	playPortfolioItem(adsr = null, frequencies = null, depth = 0) {
		return this.audioEngine.playPortfolioItem(adsr, frequencies, depth);
	}

	/**
	 * Play portfolio submenu audio feedback (deprecated - use playPortfolioItem with depth)
	 * @deprecated Use playPortfolioItem(adsr, frequencies, depth) instead
	 */
	playPortfolioSubmenu(adsr = null, frequencies = null) {
		return this.audioEngine.playPortfolioSubmenu(adsr, frequencies);
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
}

// Make MediaController available globally for p5.js
window.MediaController = MediaController;
