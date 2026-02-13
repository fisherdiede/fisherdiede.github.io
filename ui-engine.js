// ==================== UI ENGINE ====================
// Central coordinator for all UI interactions, routing commands to MediaController

class UIEngine {
	constructor(state, config, mediaController) {
		this.state = state;
		this.config = config;
		this.mediaController = mediaController;
	}

	/**
	 * Initialize UI - create DOM elements and event listeners
	 */
	initialize() {
		this._createCanvas();
		this._createCheckerboard();
		this._createToolbar();
		this._createPortfolio();
		this._createOverlay();
		this._createProfileBackgrounds();
		this._setupEventListeners();
	}

	/**
	 * Main render loop - called from p5.js draw()
	 */
	render() {
		clear();

		if (!this.state.ui.showProfile) {
			this._renderWelcomeScreen();
		} else {
			this._renderProfileScreen();
		}
	}

	/**
	 * Handle mouse clicks - route based on current state
	 */
	handleClick(x, y) {
		// Resume audio context on user interaction
		userStartAudio();

		// Welcome screen - check button click or spawn media
		if (!this.state.ui.showProfile && this.state.ui.fadeAmount === 0) {
			let buttonBounds = this._getButtonBounds();
			if (this._isMouseOverButton(buttonBounds, x, y)) {
				// Play welcome chord
				this.mediaController.playChord('welcome');
				// Start transition animation
				this.state.ui.welcomeTransitionStartTime = Date.now();
				this.state.ui.welcomeTransitionPhase = 'button-fade';
				return;
			}
		}

		// Don't spawn media if clicking in toolbar area
		if (this.state.ui.showProfile && y < 60) {
			return;
		}

		// Don't spawn media if portfolio section is showing
		if (this.state.ui.showProfile && this.state.ui.currentSection === 'portfolio') {
			return;
		}

		// Spawn media
		this.mediaController.spawnMedia(x, y);
	}

	/**
	 * Handle window resize
	 */
	handleResize(w, h) {
		resizeCanvas(w, h);
	}

	// ==================== PRIVATE METHODS - INITIALIZATION ====================

	_createCanvas() {
		this.state.dom.canvas = createCanvas(windowWidth, windowHeight);
		this.state.dom.canvas.position(0, 0);
		this.state.dom.canvas.style('z-index', '110');
		this.state.dom.canvas.style('transform', 'translateZ(0)');  // Force hardware acceleration
		this.state.dom.canvas.style('will-change', 'transform');    // Optimize for transforms
	}

	_createCheckerboard() {
		// Create checkerboard div (behind tickers)
		this.state.dom.checkerboardDiv = createDiv();
		this.state.dom.checkerboardDiv.position(0, 0);
		this.state.dom.checkerboardDiv.style('width', '100%');
		this.state.dom.checkerboardDiv.style('height', '100%');
		this.state.dom.checkerboardDiv.style('position', 'fixed');
		this.state.dom.checkerboardDiv.style('top', '0');
		this.state.dom.checkerboardDiv.style('left', '0');
		this.state.dom.checkerboardDiv.style('z-index', '90');
		this.state.dom.checkerboardDiv.style('pointer-events', 'none');
		this.state.dom.checkerboardDiv.style('opacity', '0');

		// Create precise checkerboard pattern - standard CSS approach
		let squareSize = this.config.CHECKERBOARD_SQUARE_SIZE;
		this.state.dom.checkerboardDiv.style('background-color', 'transparent');
		this.state.dom.checkerboardDiv.style('background-image',
			'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%), ' +
			'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%)');
		this.state.dom.checkerboardDiv.style('background-size', (squareSize * 2) + 'px ' + (squareSize * 2) + 'px');
		this.state.dom.checkerboardDiv.style('background-position', '0 0, ' + squareSize + 'px ' + squareSize + 'px');
	}

	_createToolbar() {
		// Create toolbar container (initially hidden)
		this.state.dom.toolbarDiv = createDiv();
		this.state.dom.toolbarDiv.position(0, 0);
		this.state.dom.toolbarDiv.style('width', '100%');
		this.state.dom.toolbarDiv.style('height', '60px');
		this.state.dom.toolbarDiv.style('position', 'fixed');
		this.state.dom.toolbarDiv.style('top', '0');
		this.state.dom.toolbarDiv.style('left', '0');
		this.state.dom.toolbarDiv.style('z-index', '120');
		this.state.dom.toolbarDiv.style('display', 'flex');
		this.state.dom.toolbarDiv.style('justify-content', 'center');
		this.state.dom.toolbarDiv.style('align-items', 'center');
		this.state.dom.toolbarDiv.style('opacity', '0');
		this.state.dom.toolbarDiv.style('pointer-events', 'none');
		this.state.dom.toolbarDiv.style('transition', 'opacity 0.5s ease');

		// Create inner wrapper for tabs with background
		let tabsWrapper = createDiv();
		tabsWrapper.style('display', 'flex');
		tabsWrapper.style('align-items', 'center');
		tabsWrapper.style('gap', '40px');
		tabsWrapper.style('padding', '10px 20px');
		tabsWrapper.style('background', 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)');
		tabsWrapper.style('backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		tabsWrapper.style('-webkit-backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		tabsWrapper.style('border-radius', '5px');
		// Add edge fade mask (fade on bottom and sides)
		tabsWrapper.style('mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, black, black calc(100% - 20px), transparent)');
		tabsWrapper.style('-webkit-mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, black, black calc(100% - 20px), transparent)');
		tabsWrapper.style('mask-composite', 'intersect');
		tabsWrapper.style('-webkit-mask-composite', 'source-in');

		// Create Profile tab
		let profileTab = createDiv('Profile');
		profileTab.style('font-family', 'Courier New');
		profileTab.style('font-size', '18px');
		profileTab.style('color', 'white');
		profileTab.style('cursor', 'pointer');
		profileTab.style('padding', '10px 20px');
		profileTab.style('min-width', '44px'); // iOS minimum touch target
		profileTab.style('min-height', '44px'); // iOS minimum touch target
		profileTab.style('display', 'flex');
		profileTab.style('align-items', 'center');
		profileTab.style('justify-content', 'center');
		profileTab.style('border-bottom', '2px solid white');
		profileTab.style('transition', 'transform 0.15s ease-out');
		profileTab.style('-webkit-tap-highlight-color', 'transparent');
		profileTab.style('user-select', 'none');
		profileTab.style('-webkit-user-select', 'none');
		profileTab.id('profile-tab');

		// Add touch and mouse support
		profileTab.mousePressed(() => {
			this._handleProfileTab();
			return false;
		});
		profileTab.touchStarted(() => {
			this._handleProfileTab();
			return false;
		});

		tabsWrapper.child(profileTab);

		// Create Portfolio tab
		let portfolioTab = createDiv('Portfolio');
		portfolioTab.style('font-family', 'Courier New');
		portfolioTab.style('font-size', '18px');
		portfolioTab.style('color', 'rgba(255, 255, 255, 0.5)');
		portfolioTab.style('cursor', 'pointer');
		portfolioTab.style('padding', '10px 20px');
		portfolioTab.style('min-width', '44px'); // iOS minimum touch target
		portfolioTab.style('min-height', '44px'); // iOS minimum touch target
		portfolioTab.style('display', 'flex');
		portfolioTab.style('align-items', 'center');
		portfolioTab.style('justify-content', 'center');
		portfolioTab.style('transition', 'transform 0.15s ease-out');
		portfolioTab.style('-webkit-tap-highlight-color', 'transparent');
		portfolioTab.style('user-select', 'none');
		portfolioTab.style('-webkit-user-select', 'none');
		portfolioTab.id('portfolio-tab');

		// Add touch and mouse support
		portfolioTab.mousePressed(() => {
			this._handlePortfolioTab();
			return false;
		});
		portfolioTab.touchStarted(() => {
			this._handlePortfolioTab();
			return false;
		});

		tabsWrapper.child(portfolioTab);

		// Add wrapper to toolbar
		this.state.dom.toolbarDiv.child(tabsWrapper);
	}

	_createPortfolio() {
		// Create portfolio list view (initially hidden)
		let portfolioList = createDiv();
		portfolioList.id('portfolio-list');
		portfolioList.position(0, 60); // Below toolbar
		portfolioList.style('width', '100%');
		portfolioList.style('height', 'calc(100vh - 60px)');
		portfolioList.style('position', 'fixed');
		portfolioList.style('top', '60px');
		portfolioList.style('left', '0');
		portfolioList.style('z-index', '105');
		portfolioList.style('overflow-y', 'scroll');
		portfolioList.style('overflow-x', 'hidden');
		portfolioList.style('-webkit-overflow-scrolling', 'touch');
		portfolioList.style('transform', 'translateX(0) translateY(0) scale(1) translateZ(0)');  // Initial position
		portfolioList.style('transition', 'transform 0.3s ease-out');  // Add transition
		portfolioList.style('will-change', 'transform');  // Optimize for transforms
		portfolioList.style('display', 'none');
		portfolioList.style('opacity', '0');
		portfolioList.style('pointer-events', 'none'); // Let clicks pass through - items have pointer-events: auto
		portfolioList.style('padding', '40px 20px');
		portfolioList.style('flex-direction', 'column');
		portfolioList.style('align-items', 'center');
		portfolioList.style('justify-content', 'flex-start');
		portfolioList.style('overflow-y', 'auto');
		portfolioList.style('-webkit-overflow-scrolling', 'touch');

		// Create items wrapper with top-level portfolio items
		let itemsWrapper = this._createPortfolioItemsWrapper(
			this.state.portfolioItems,
			'portfolio-item',
			0, // depth
			false // No margin - use gap only
		);

		// Add wrapper to portfolio list
		portfolioList.child(itemsWrapper);
	}

	_createOverlay() {
		// Create general-purpose overlay for UI content and mouse capture
		// This sits above the YouTube iframe to detect mouse movement
		this.state.dom.overlay = createDiv();
		this.state.dom.overlay.position(0, 0);
		this.state.dom.overlay.style('width', '100%');
		this.state.dom.overlay.style('height', '100%');
		this.state.dom.overlay.style('position', 'fixed');
		this.state.dom.overlay.style('top', '0');
		this.state.dom.overlay.style('left', '0');
		this.state.dom.overlay.style('z-index', '101'); // Above YouTube (100), below toolbar (120) and menus (105+)
		this.state.dom.overlay.style('pointer-events', 'none'); // Let clicks pass through
		this.state.dom.overlay.style('display', 'none'); // Initially hidden
	}

	_createProfileBackgrounds() {
		// Create background for name
		this.state.dom.nameBackground = createDiv();
		this.state.dom.nameBackground.position(0, 0);
		this.state.dom.nameBackground.style('position', 'fixed');
		this.state.dom.nameBackground.style('z-index', '102'); // Above overlay (101), below toolbar (120)
		this.state.dom.nameBackground.style('pointer-events', 'none');
		this.state.dom.nameBackground.style('background', 'radial-gradient(circle, rgba(0,0,0,0.33) 0%, rgba(0,0,0,0.165) 70%, rgba(0,0,0,0) 100%)');
		this.state.dom.nameBackground.style('backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		this.state.dom.nameBackground.style('-webkit-backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		this.state.dom.nameBackground.style('border-radius', '15px');
		// Add edge fade mask (fade on all sides)
		this.state.dom.nameBackground.style('mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)');
		this.state.dom.nameBackground.style('-webkit-mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)');
		this.state.dom.nameBackground.style('mask-composite', 'intersect');
		this.state.dom.nameBackground.style('-webkit-mask-composite', 'source-in');
		this.state.dom.nameBackground.style('opacity', '0');
		this.state.dom.nameBackground.style('transition', 'opacity 0.25s ease');

		// Create background for bio title
		this.state.dom.bioTitleBackground = createDiv();
		this.state.dom.bioTitleBackground.position(0, 0);
		this.state.dom.bioTitleBackground.style('position', 'fixed');
		this.state.dom.bioTitleBackground.style('z-index', '102'); // Above overlay (101), below toolbar (120)
		this.state.dom.bioTitleBackground.style('pointer-events', 'none');
		this.state.dom.bioTitleBackground.style('background', 'radial-gradient(circle, rgba(0,0,0,0.33) 0%, rgba(0,0,0,0.165) 70%, rgba(0,0,0,0) 100%)');
		this.state.dom.bioTitleBackground.style('backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		this.state.dom.bioTitleBackground.style('-webkit-backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		this.state.dom.bioTitleBackground.style('border-radius', '15px');
		// Add edge fade mask (fade on all sides)
		this.state.dom.bioTitleBackground.style('mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)');
		this.state.dom.bioTitleBackground.style('-webkit-mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)');
		this.state.dom.bioTitleBackground.style('mask-composite', 'intersect');
		this.state.dom.bioTitleBackground.style('-webkit-mask-composite', 'source-in');
		this.state.dom.bioTitleBackground.style('opacity', '0');
		this.state.dom.bioTitleBackground.style('transition', 'opacity 0.25s ease');

		// Create background for email
		this.state.dom.emailBackground = createDiv();
		this.state.dom.emailBackground.position(0, 0);
		this.state.dom.emailBackground.style('position', 'fixed');
		this.state.dom.emailBackground.style('z-index', '102'); // Above overlay (101), below toolbar (120)
		this.state.dom.emailBackground.style('pointer-events', 'none');
		this.state.dom.emailBackground.style('background', 'radial-gradient(circle, rgba(0,0,0,0.33) 0%, rgba(0,0,0,0.165) 70%, rgba(0,0,0,0) 100%)');
		this.state.dom.emailBackground.style('backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		this.state.dom.emailBackground.style('-webkit-backdrop-filter', `blur(${this.config.BACKDROP_BLUR}px)`);
		this.state.dom.emailBackground.style('border-radius', '15px');
		// Add edge fade mask (fade on all sides)
		this.state.dom.emailBackground.style('mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)');
		this.state.dom.emailBackground.style('-webkit-mask-image',
			'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), ' +
			'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)');
		this.state.dom.emailBackground.style('mask-composite', 'intersect');
		this.state.dom.emailBackground.style('-webkit-mask-composite', 'source-in');
		this.state.dom.emailBackground.style('opacity', '0');
		this.state.dom.emailBackground.style('transition', 'opacity 0.25s ease');
	}

	_setupEventListeners() {
		// Add keyboard listener for closing sub-sections
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				// Don't handle ESC if YouTube video is in fullscreen
				if (document.fullscreenElement || document.webkitFullscreenElement) {
					return;
				}

				// Only handle ESC when menu is visible and there's a portfolio stack
				if (this.state.ui.menuVisible && this.state.ui.portfolioStack.length > 0) {
					this._closePortfolioSection();
				}
			}
		});

		// Global click handler for spawner mode
		document.addEventListener('click', (event) => {
			// If actively in spawner mode, spawn a video on click
			if (this.mediaController.isInSpawnerMode()) {
				// Block spawning if a video is currently playing
				if (this.state.visual.videoIsPlaying) {
					return;
				}
				this.mediaController.spawnMedia(event.clientX, event.clientY);
				return;
			}
		});

		// Menu auto-hide on inactivity (mouse and touch)
		const resetMenuAutoHide = () => {
			// Show menu if it's hidden
			if (!this.state.ui.menuVisible) {
				this._showMenu();
			}

			// Only apply auto-hide timer when YouTube video is playing
			if (this.state.dom.youtubePlayer) {
				this._resetMenuAutoHideTimer();
			}
		};

		document.addEventListener('mousemove', resetMenuAutoHide);
		document.addEventListener('touchstart', resetMenuAutoHide);
		document.addEventListener('touchmove', resetMenuAutoHide);

		// Also listen on the mouse overlay (captures movement over YouTube iframe)
		this.state.dom.overlay.elt.addEventListener('mousemove', resetMenuAutoHide);
		this.state.dom.overlay.elt.addEventListener('touchstart', resetMenuAutoHide);
		this.state.dom.overlay.elt.addEventListener('touchmove', resetMenuAutoHide);
	}

	// ==================== PRIVATE METHODS - RENDERING ====================

	_renderWelcomeScreen() {
		let centerX = windowWidth / 2;
		let centerY = windowHeight / 2;
		let brightness = this._calculateWelcomeBrightness();

		// Hide profile backgrounds on welcome screen
		this.state.dom.nameBackground.style('opacity', '0');
		this.state.dom.bioTitleBackground.style('opacity', '0');
		this.state.dom.emailBackground.style('opacity', '0');

		// Welcome transition timing (adjust these for different animation feel)
		const BUTTON_FADE_DURATION = 0.5;  // How long button takes to fade out
		const BUTTON_SHRINK_AMOUNT = 1;  // How much button shrinks (0.2 = 80% size)
		const TRANSITION_DELAY = 0.25;      // Pause between button fade and profile fade
		const PROFILE_FADE_DURATION = 0.25; // How long profile takes to fade in

		// Handle welcome transition animation
		if (this.state.ui.welcomeTransitionPhase !== 'idle') {
			let elapsed = (Date.now() - this.state.ui.welcomeTransitionStartTime) / 1000;

			if (this.state.ui.welcomeTransitionPhase === 'button-fade') {
				// Phase 1: Button shrinks and fades
				let progress = Math.min(elapsed / BUTTON_FADE_DURATION, 1);
				this.state.ui.fadeAmount = progress;
				// Ease-in for shrink (accelerates as it shrinks)
				let easedProgress = progress * progress;
				this.state.ui.buttonScale = 1 - (easedProgress * BUTTON_SHRINK_AMOUNT);

				if (progress >= 1) {
					this.state.ui.welcomeTransitionPhase = 'delay';
				}
			} else if (this.state.ui.welcomeTransitionPhase === 'delay') {
				// Phase 2: Delay with button invisible
				this.state.ui.fadeAmount = 1;
				this.state.ui.buttonScale = 1 - BUTTON_SHRINK_AMOUNT;

				if (elapsed >= BUTTON_FADE_DURATION + TRANSITION_DELAY) {
					this.state.ui.welcomeTransitionPhase = 'profile-fade';
					this.state.ui.showProfile = true;
					this.state.ui.fadeAmount = 0; // Reset for profile fade-in
					// Store timing for profile fade
					this.state.ui.profileFadeStart = BUTTON_FADE_DURATION + TRANSITION_DELAY;
					this.state.ui.profileFadeDuration = PROFILE_FADE_DURATION;
					// Show toolbar when entering profile/portfolio view
					this.state.dom.toolbarDiv.style('opacity', '1');
					this.state.dom.toolbarDiv.style('pointer-events', 'auto');
					// Enable canvas pointer events for profile (default section)
					this.state.dom.canvas.style('pointer-events', 'auto');
				}
			}
		}

		// Get button bounds and check hover state
		let buttonBounds = this._getButtonBounds();
		let isHovering = !this.state.device.isTouchDevice && this._isMouseOverButton(buttonBounds, mouseX, mouseY);
		let isTransitioning = this.state.ui.welcomeTransitionPhase !== 'idle';
		let shouldApplyEffects = isHovering || (this.state.device.isTouchDevice && isTransitioning);
		this.state.ui.isHoveringWelcome = shouldApplyEffects;

		// Update audio effects
		this.mediaController.updateEffects(shouldApplyEffects);

		// Animate checkerboard opacity on hover or during transition
		if (isHovering || isTransitioning) {
			this.state.ui.checkerboardTargetOpacity = this.config.CHECKERBOARD_OPACITY;
		} else {
			this.state.ui.checkerboardTargetOpacity = 0;
		}

		// Smooth transition using lerp
		let fadeSpeed = deltaTime / (this.config.CHECKERBOARD_FADE_TIME * 1000);
		this.state.ui.checkerboardOpacity = lerp(this.state.ui.checkerboardOpacity, this.state.ui.checkerboardTargetOpacity, fadeSpeed);

		// Use hover appearance for touch devices or when hovering
		let useHoverAppearance = this.state.device.isTouchDevice || isHovering;

		// Calculate button opacity based on fade state
		let buttonOpacity = 1 - this.state.ui.fadeAmount;

		// Draw checkerboard behind button
		this._drawCheckerboard(this.state.ui.checkerboardOpacity);

		// Apply button scale transform
		push();
		translate(centerX, centerY);
		scale(this.state.ui.buttonScale);
		translate(-centerX, -centerY);

		// Draw button background
		if (useHoverAppearance) {
			fill(15, 255 * buttonOpacity);
		} else {
			fill(0, brightness * buttonOpacity);
		}
		noStroke();
		rect(buttonBounds.x, buttonBounds.y, buttonBounds.width, buttonBounds.height, this.config.BUTTON_RADIUS);

		// Draw button border
		noFill();
		if (useHoverAppearance) {
			stroke(255, 255 * buttonOpacity);
		} else {
			stroke(Math.floor(brightness), 255 * buttonOpacity);
		}
		strokeWeight(2);
		rect(buttonBounds.x, buttonBounds.y, buttonBounds.width, buttonBounds.height, this.config.BUTTON_RADIUS);

		// Draw "all are" text above button
		fill(0, 255 * buttonOpacity);
		noStroke();
		textFont("Courier New");
		textSize(24);
		textAlign(CENTER, CENTER);
		text("all are", centerX, centerY - 50);

		// Draw welcome text
		if (useHoverAppearance) {
			fill(255, 255 * buttonOpacity);
		} else {
			fill(Math.floor(brightness), 255 * buttonOpacity);
		}
		noStroke();
		textFont("Courier New");
		textSize(24);
		textAlign(CENTER, CENTER);
		text("welcome", centerX, centerY);

		pop(); // End button scale transform

		// iOS silent mode notice
		if (this.state.device.isIOS && this.state.ui.audioNoticeOpacity > 0.01) {
			fill(255, 127.5 * buttonOpacity * this.state.ui.audioNoticeOpacity);
			noStroke();
			textFont("Courier New");
			textSize(12);
			textAlign(CENTER, CENTER);
			text("turn off silent mode for audio", centerX, centerY + 60);
		}

		// Fade out audio notice after first spawn
		if (this.state.ui.hasSpawnedMedia && this.state.ui.audioNoticeOpacity > 0) {
			this.state.ui.audioNoticeOpacity = max(this.state.ui.audioNoticeOpacity - (deltaTime / 1000), 0);
		}
	}

	_renderProfileScreen() {
		this.state.ui.isHoveringWelcome = false;

		// Handle profile fade-in animation (first time showing profile)
		if (this.state.ui.welcomeTransitionPhase === 'profile-fade') {
			let elapsed = (Date.now() - this.state.ui.welcomeTransitionStartTime) / 1000;
			let fadeInStart = this.state.ui.profileFadeStart;
			let fadeInDuration = this.state.ui.profileFadeDuration;
			let fadeInProgress = Math.min((elapsed - fadeInStart) / fadeInDuration, 1);
			this.state.ui.fadeAmount = fadeInProgress;

			if (fadeInProgress >= 1) {
				this.state.ui.welcomeTransitionPhase = 'complete';
			}
		}
		// Use faster fade for tab transitions
		else if (this.state.ui.welcomeTransitionPhase === 'complete' && this.state.ui.fadeAmount < 1) {
			let fadeIncrement = deltaTime / (0.5 * 1000);
			this.state.ui.fadeAmount = min(this.state.ui.fadeAmount + fadeIncrement, 1);
		}

		let alpha = 255 * this.state.ui.fadeAmount;

		// Smooth scale animation for profile content
		this.state.ui.profileContentScale = lerp(this.state.ui.profileContentScale, this.state.ui.profileContentScaleTarget, 0.2);

		// Continue updating audio effects for active oscillators
		this.mediaController.updateEffects(false);

		// Draw checkerboard background at full opacity
		this._drawCheckerboard(this.config.CHECKERBOARD_OPACITY);

		// Handle section transitions
		let portfolioList = select('#portfolio-list');

		// Don't show portfolio during initial welcome transition
		let isInitialTransition = this.state.ui.welcomeTransitionPhase === 'profile-fade';

		// Always show both during transition, crossfade between them
		if (this.state.ui.fadeAmount < 1 && !isInitialTransition) {
			// During tab transition (not initial welcome transition)
			if (this.state.ui.currentSection === 'portfolio') {
				// Fading into portfolio
				portfolioList.style('display', 'flex');
				// Respect menuVisible state - use min of fadeAmount and menuVisible
				let targetOpacity = this.state.ui.menuVisible ? this.state.ui.fadeAmount : 0;
				portfolioList.style('opacity', targetOpacity.toString());
				this.state.dom.canvas.style('pointer-events', 'none');
			} else {
				// Fading into profile - fade out portfolio
				portfolioList.style('display', 'flex');
				portfolioList.style('opacity', (1 - this.state.ui.fadeAmount).toString());
				this.state.dom.canvas.style('pointer-events', 'auto');
			}
		} else if (isInitialTransition) {
			// During initial transition from welcome, keep portfolio hidden
			portfolioList.style('display', 'none');
			portfolioList.style('opacity', '0');
			this.state.dom.canvas.style('pointer-events', 'auto');
		} else {
			// Transition complete - don't touch opacity, let CSS transitions handle auto-hide
			if (this.state.ui.currentSection === 'portfolio') {
				portfolioList.style('display', 'flex');
				this.state.dom.canvas.style('pointer-events', 'none');
				// Don't draw profile content on canvas
				clear();
				this._drawCheckerboard(this.config.CHECKERBOARD_OPACITY);
				return;
			} else {
				portfolioList.style('display', 'none');
				this.state.dom.canvas.style('pointer-events', 'auto');
			}
		}

		let centerX = windowWidth / 2;
		let centerY = windowHeight / 2;

		// Calculate alpha for profile content based on current section
		if (this.state.ui.fadeAmount < 1) {
			// During transition
			if (this.state.ui.currentSection === 'profile') {
				// Fading into profile
				alpha = 255 * this.state.ui.fadeAmount;
			} else {
				// Fading out of profile (into portfolio)
				alpha = 255 * (1 - this.state.ui.fadeAmount);
			}
		} else {
			// Fully visible after transition complete
			alpha = 255;
		}

		// Apply scale animation to profile content
		push();
		translate(centerX, centerY);
		scale(this.state.ui.profileContentScale);
		translate(-centerX, -centerY);

		// Position and show name background
		let nameW = 280;
		let nameH = 50;
		let nameTextY = centerY - 120; // Text position
		let nameX = centerX - nameW/2;
		let nameY = nameTextY - nameH/2; // Center background around text
		this.state.dom.nameBackground.position(nameX, nameY);
		this.state.dom.nameBackground.style('width', nameW + 'px');
		this.state.dom.nameBackground.style('height', nameH + 'px');
		this.state.dom.nameBackground.style('opacity', this.state.ui.fadeAmount.toString());
		this.state.dom.nameBackground.style('transform', `scale(${this.state.ui.profileContentScale})`);
		this.state.dom.nameBackground.style('transform-origin', `${centerX - nameX}px ${centerY - nameY}px`);

		fill(255, alpha);
		textFont("Courier New");

		// Name
		textSize(32);
		textAlign(CENTER, CENTER);
		text("Fisher Diede", centerX, nameTextY);

		// Profile image with circular mask
		let circleDiameter = this.state.device.isTouchDevice ? 80 : 100;
		push();
		drawingContext.save();
		drawingContext.beginPath();
		drawingContext.arc(centerX, centerY - 30, circleDiameter / 2, 0, Math.PI * 2);
		drawingContext.closePath();
		drawingContext.clip();

		// Draw image maintaining aspect ratio, cropped to fill circle
		let imgAspect = this.state.dom.profileImg.width / this.state.dom.profileImg.height;
		let imgW, imgH;

		if (imgAspect > 1) {
			imgH = circleDiameter;
			imgW = circleDiameter * imgAspect;
		} else {
			imgW = circleDiameter;
			imgH = circleDiameter / imgAspect;
		}

		tint(255, alpha);
		imageMode(CENTER);
		image(this.state.dom.profileImg, centerX, centerY - 30, imgW, imgH);
		noTint();
		drawingContext.restore();
		pop();

		// Circle borders - black outer, white inner
		noFill();
		stroke(0, alpha * 0.33);
		strokeWeight(2);
		circle(centerX, centerY - 30, circleDiameter + 4);
		stroke(255, alpha);
		strokeWeight(2);
		circle(centerX, centerY - 30, circleDiameter);

		// Position and show bio title background
		let bioTitleW = 280;
		let bioTitleH = 40;
		let bioTitleTextY = centerY + 60;
		let bioTitleX = centerX - bioTitleW/2;
		let bioTitleY = bioTitleTextY - bioTitleH/2;
		this.state.dom.bioTitleBackground.position(bioTitleX, bioTitleY);
		this.state.dom.bioTitleBackground.style('width', bioTitleW + 'px');
		this.state.dom.bioTitleBackground.style('height', bioTitleH + 'px');
		this.state.dom.bioTitleBackground.style('opacity', this.state.ui.fadeAmount.toString());
		this.state.dom.bioTitleBackground.style('transform', `scale(${this.state.ui.profileContentScale})`);
		this.state.dom.bioTitleBackground.style('transform-origin', `${centerX - bioTitleX}px ${centerY - bioTitleY}px`);

		// Position and show email background
		let emailW = 280;
		let emailH = 35;
		let emailTextY = centerY + 100;
		let emailX = centerX - emailW/2;
		let emailY = emailTextY - emailH/2;
		this.state.dom.emailBackground.position(emailX, emailY);
		this.state.dom.emailBackground.style('width', emailW + 'px');
		this.state.dom.emailBackground.style('height', emailH + 'px');
		this.state.dom.emailBackground.style('opacity', this.state.ui.fadeAmount.toString());
		this.state.dom.emailBackground.style('transform', `scale(${this.state.ui.profileContentScale})`);
		this.state.dom.emailBackground.style('transform-origin', `${centerX - emailX}px ${centerY - emailY}px`);

		// Bio
		strokeWeight(1);
		fill(255, alpha);
		textSize(16);
		textAlign(CENTER, CENTER);
		text("Creative Technologist", centerX, bioTitleTextY);

		// Contact info
		textSize(14);
		textAlign(CENTER, CENTER);
		text("fisherdiede@icloud.com", centerX, emailTextY);

		pop(); // End scale animation
	}

	// ==================== PRIVATE METHODS - TAB HANDLERS ====================

	_handleProfileTab() {
		this.mediaController.playChord('profile');
		this._pulseTab(select('#profile-tab'));

		// Only switch sections if not already on profile
		if (this.state.ui.currentSection !== 'profile') {
			// Clean up portfolio UI when switching away
			this._cleanupPortfolioState();

			// Stop menu auto-hide timer
			this._stopMenuAutoHideTimer();
			// Ensure menu is visible when leaving portfolio
			this._showMenu();

			// Immediately enable canvas pointer events for profile
			this.state.dom.canvas.style('pointer-events', 'auto');

			this._animateProfileContent();
			this._switchSection('profile');
		}
	}

	_handlePortfolioTab() {
		this.mediaController.playChord('portfolio');
		this._pulseTab(select('#portfolio-tab'));

		// Only switch sections if not already on portfolio
		if (this.state.ui.currentSection !== 'portfolio') {
			// Stop any active audio/visuals from welcome screen or profile
			this.mediaController.stopAll();

			// Immediately disable canvas pointer events for portfolio
			this.state.dom.canvas.style('pointer-events', 'none');

			this._animatePortfolioContent();
			this._switchSection('portfolio');
		}
	}

	// ==================== PRIVATE METHODS - PORTFOLIO NAVIGATION ====================

	_openPortfolioSection(itemName, audioConfig, isNullMenu = false) {
		// For null menus, we don't need actual subitems
		if (!isNullMenu && !this.state.portfolioSections[itemName]) return;

		let subItems = isNullMenu ? [] : this.state.portfolioSections[itemName];

		// Calculate depth based on stack length
		const currentDepth = this.state.ui.portfolioStack.length + 1;

		// Get parent container
		let parentContainer = this.state.ui.portfolioStack.length === 0
			? select('#portfolio-list')
			: this.state.ui.portfolioStack[this.state.ui.portfolioStack.length - 1].container;

		// Dim all items in parent container except clicked one
		if (parentContainer) {
			parentContainer.style('overflow-y', 'hidden');

			// Find clicked item and mark all items as parent level in one pass
			let clickedItem = null;
			let clickedItemIndex = -1;
			let items = parentContainer.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
			for (let i = 0; i < items.length; i++) {
				if (items[i].textContent === itemName) {
					clickedItem = items[i];
					clickedItemIndex = i;
				}
				items[i].setAttribute('data-parent-level', 'true');
			}

			// Apply collapse animation if enabled
			if (this.config.MENU_COLLAPSE_ANIMATION && clickedItem) {
				// Get container's top padding (source of truth for item positioning)
				const containerPaddingTop = 40; // matches padding: '40px 20px'

				// Get first item's current position relative to container
				const containerRect = parentContainer.elt.getBoundingClientRect();
				const firstItemRect = items[0].getBoundingClientRect();
				const firstItemOffsetFromContainerTop = firstItemRect.top - containerRect.top;

				// Calculate item height
				const firstItemHeight = items[0].offsetHeight;
				const itemHeight = firstItemHeight + this.config.MENU_ITEM_GAP;

				// Calculate how much to shift all items to align first item with container padding
				const alignmentShift = containerPaddingTop - firstItemOffsetFromContainerTop;

				// Calculate clicked item's target: align with first position + its index offset
				const clickedItemCollapseAmount = alignmentShift - (clickedItemIndex * itemHeight);

				// Animate non-selected items to collapse toward the top
				for (let i = 0; i < items.length; i++) {
					if (items[i] !== clickedItem) {
						// Calculate collapse distance (move toward top/first position)
						const collapseAmount = alignmentShift - (i * itemHeight);

						items[i].style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
						items[i].style.transform = `translateY(${collapseAmount}px)`;
						items[i].style.opacity = '0';
					} else {
						// Move clicked item to align with first item position
						clickedItem.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
						clickedItem.style.transform = `translateY(${clickedItemCollapseAmount}px)`;
						clickedItem.style.opacity = this.config.MENU_SELECTED_OPACITY.toString();
					}
				}
			} else {
				// Original behavior: just dim all items
				this._updateContainerItemsOpacity(parentContainer, this.config.MENU_DIMMED_OPACITY, clickedItem, this.config.MENU_SELECTED_OPACITY);
			}
		}

		// Create new container (skip for null menus)
		let newContainer = null;
		if (!isNullMenu) {
			newContainer = createDiv();
			this.state.ui.portfolioContainerCounter++;
			newContainer.id('portfolio-container-' + this.state.ui.portfolioContainerCounter);
			newContainer.position(0, 60);
			newContainer.style('width', '100%');
			newContainer.style('height', 'calc(100vh - 60px)');
			newContainer.style('position', 'fixed');
			newContainer.style('top', '60px');
			newContainer.style('left', '0');
			newContainer.style('z-index', (106 + this.state.ui.portfolioStack.length).toString());
			newContainer.style('display', 'flex');
			newContainer.style('opacity', '0');
			newContainer.style('pointer-events', 'none');
			newContainer.style('transition', 'opacity 0.3s ease-out, transform 0.3s ease-out');
			// Start position: down and to the right, slightly smaller
			newContainer.style('transform', 'translate(100px, 100px) scale(0.9) translateZ(0)');
			newContainer.style('will-change', 'transform, opacity');  // Optimize for animation
			newContainer.style('padding', '40px 20px');
			newContainer.style('flex-direction', 'column');
			newContainer.style('align-items', 'center');
			newContainer.style('justify-content', 'flex-start');
			newContainer.style('overflow-y', 'auto');
			newContainer.style('-webkit-overflow-scrolling', 'touch');

			// Create items wrapper with submenu items
			let itemsWrapper = this._createPortfolioItemsWrapper(
				subItems,
				'portfolio-nav-item',
				currentDepth,
				false, // No margin
				(subItem) => this._createSubmenuClickHandler(subItem, currentDepth)
			);

			newContainer.child(itemsWrapper);
		}

		// Add to stack FIRST
		this.state.ui.portfolioStack.push({
			container: newContainer, // null for null menus
			itemName: itemName,
			parentContainer: parentContainer,
			audioConfig: audioConfig,  // Store for reversal on close
			depth: currentDepth,  // Store depth for nested navigation
			isNullMenu: isNullMenu // Flag for close handling
		});

		// Shift all containers (including the new container to position 0, and parents get shifted)
		this._shiftVisibleContainers();

		// Now animate the new container entrance (skip for null menus)
		if (newContainer) {
			// First, set it to the entrance position (override the shift)
			newContainer.style('transform', 'translate(100px, 100px) scale(0.9) translateZ(0)');

			setTimeout(() => {
				newContainer.style('opacity', '1');
				newContainer.style('pointer-events', 'none'); // Let clicks pass through to dimmed items
				// Animate to final centered position
				newContainer.style('transform', 'translate(0, 0) scale(1) translateZ(0)');
			}, 50);
		}

		// Only reset auto-hide timer if YouTube video is playing
		if (this.state.dom.youtubePlayer) {
			this._resetMenuAutoHideTimer();
		}
	}

	_closePortfolioSection() {
		if (this.state.ui.portfolioStack.length === 0) return;

		// Pop the last entry from stack (works the same for null menus)
		let closingEntry = this.state.ui.portfolioStack.pop();
		let closingContainer = closingEntry.container;
		let parentContainer = closingEntry.parentContainer;

		// Play reversed audio if config exists
		if (closingEntry.audioConfig) {
			this.mediaController.playReversed(closingEntry.audioConfig);
		}

		// Remove YouTube video if it exists
		this.mediaController.removeYouTubeVideo();

		// Remove audio player if it exists
		this.mediaController.removeAudioPlayer();

		// Hide overlay and clear click handler
		if (this.state.dom.overlay) {
			this.state.dom.overlay.style('display', 'none');
			this.state.dom.overlay.style('pointer-events', 'none');
			this.state.dom.overlay.elt.onclick = null;
		}

		// Stop auto-hide timer and ensure menu is visible
		this._stopMenuAutoHideTimer();
		this._showMenu();

		// Restore opacity and scrolling in parent container
		if (parentContainer) {
			parentContainer.style('overflow-y', 'auto');

			// Remove parent-level markers from items since they're now current level
			let items = parentContainer.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
			for (let i = 0; i < items.length; i++) {
				items[i].removeAttribute('data-parent-level');

				// Reverse collapse animation if enabled
				if (this.config.MENU_COLLAPSE_ANIMATION) {
					items[i].style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
					items[i].style.transform = 'translateY(0)';
					items[i].style.opacity = '1';
				} else {
					items[i].style.opacity = '1';
				}
			}

			// If not using collapse animation, use the old method
			if (!this.config.MENU_COLLAPSE_ANIMATION) {
				this._updateContainerItemsOpacity(parentContainer, 1);
			}
		}

		// Exit spawner mode and trigger early fade-out
		this.mediaController.exitSpawnerMode();
		this.mediaController.stopAll();

		// Hide and remove the closing container (null for null menus, so this is skipped)
		if (closingContainer) {
			closingContainer.style('opacity', '0');
			closingContainer.style('pointer-events', 'none');
			setTimeout(() => {
				closingContainer.remove();
			}, 300);
		}

		// Shift remaining containers
		this._shiftVisibleContainers();

		// If stack is empty, reset portfolio list position
		if (this.state.ui.portfolioStack.length === 0) {
			let portfolioList = select('#portfolio-list');
			portfolioList.style('transform', 'translateX(0) translateY(0) scale(1)');
		}

		// Only reset auto-hide timer if YouTube video is playing
		if (this.state.dom.youtubePlayer) {
			this._resetMenuAutoHideTimer();
		}
	}

	// ==================== PRIVATE METHODS - HELPERS ====================

	/**
	 * Create a portfolio items wrapper with items and spacer
	 * @param {Array} items - Array of item names to create
	 * @param {string} className - CSS class for items ('portfolio-item' or 'portfolio-nav-item')
	 * @param {number} depth - Menu depth level
	 * @param {boolean} addMargin - Whether to add bottom margin to items
	 * @param {function} clickHandlerFactory - Function that creates click handler for each item
	 * @returns {p5.Element} The styled wrapper element with items and spacer
	 */
	_createPortfolioItemsWrapper(items, className, depth, addMargin, clickHandlerFactory) {
		// Create wrapper for items
		let itemsWrapper = createDiv();
		itemsWrapper.style('display', 'flex');
		itemsWrapper.style('flex-direction', 'column');
		itemsWrapper.style('align-items', 'center');
		itemsWrapper.style('gap', this.config.MENU_ITEM_GAP + 'px');
		itemsWrapper.style('pointer-events', 'none'); // Let clicks pass through to items

		// Create items
		items.forEach((item) => {
			let clickHandler = clickHandlerFactory ? clickHandlerFactory(item) : this._createDefaultClickHandler(item, depth);
			let itemDiv = this._createPortfolioItemElement(
				item,
				className,
				clickHandler,
				addMargin,
				item, // itemName for audio determination
				depth // depth for audio configuration
			);

			itemDiv.attribute('data-item', item);
			itemsWrapper.child(itemDiv);
		});

		// Add spacer at the end to allow scrolling items higher
		let spacer = createDiv();
		spacer.style('height', '400px');
		spacer.style('width', '100%');
		itemsWrapper.child(spacer);

		return itemsWrapper;
	}

	/**
	 * Create default click handler for portfolio items
	 */
	_createDefaultClickHandler(item, depth) {
		return (event) => {
			event.preventDefault();
			event.stopPropagation();

			// Check if this item is marked as parent level
			if (event.target.hasAttribute('data-parent-level') && this.state.ui.portfolioStack.length > 0) {
				// Item is in parent level, close one level
				this._closePortfolioSection();
				return;
			}

			// Check if this will open a submenu
			const hasSubmenu = this.state.portfolioSections[item];

			// Only reset hover state and stop audio/visuals if opening a submenu
			if (hasSubmenu) {
				event.target.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
				event.target.style.filter = 'brightness(1)';
				this.mediaController.stopAllHoverAudio();
				this.mediaController.stopAll(true, 500);
			}

			// Play portfolio item audio
			// Use short ADSR for leaf items, wah-like ADSR for items with submenus
			const isActionable = hasSubmenu;
			const adsr = isActionable ? this.config.ADSR_PORTFOLIO : this.config.ADSR_TAB;

			// Use stored audio config from hover if available
			const storedConfig = event.target._storedAudioConfig;
			const frequencies = storedConfig ? storedConfig.frequencies : null;
			const depth_param = storedConfig ? storedConfig.depth : depth;
			const audioConfig = this.mediaController.playPortfolioItem(adsr, frequencies, depth_param, isActionable);

			// Open sub-section if this item has one
			if (hasSubmenu) {
				this._openPortfolioSection(item, audioConfig);
			}
		};
	}

	/**
	 * Create click handler for submenu items (includes special handling for biebl, seven last words, vault songs)
	 */
	_createSubmenuClickHandler(subItem, currentDepth) {
		return (event) => {
			event.stopPropagation();
			event.preventDefault();

			// Check if this item is marked as parent level
			if (event.target.hasAttribute('data-parent-level') && this.state.ui.portfolioStack.length > 0) {
				// Item is in parent level, close one level
				this._closePortfolioSection();
				return;
			}

			// Check if this will open a submenu
			const hasSubmenu = this.state.portfolioSections[subItem];

			// Only reset hover state and stop audio/visuals if opening a submenu
			if (hasSubmenu) {
				event.target.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
				event.target.style.filter = 'brightness(1)';
				this.mediaController.stopAllHoverAudio();
				this.mediaController.stopAll(true, 500);
			}

			// Play portfolio submenu audio (one octave higher, 16/9 ratio)
			// Use short ADSR for leaf items, wah-like ADSR for items with submenus
			// Actionable items open submenus or trigger special modes (biebl, seven last words, vault songs)

			// Check if this is a vault song
			let isVaultSong = false;
			for (let folderName in this.state.assets.vaultSongs) {
				if (this.state.assets.vaultSongs[folderName].find(song => song.caption === subItem)) {
					isVaultSong = true;
					break;
				}
			}

			const isActionable = hasSubmenu || subItem === 'biebl' || subItem === 'seven last words of the unarmed' || isVaultSong;
			const adsr = isActionable ? this.config.ADSR_PORTFOLIO : this.config.ADSR_TAB;

			// Use stored audio config from hover if available
			const storedConfig = event.target._storedAudioConfig;
			const frequencies = storedConfig ? storedConfig.frequencies : null;
			const depth = storedConfig ? storedConfig.depth : currentDepth;
			const audioConfig = this.mediaController.playPortfolioItem(adsr, frequencies, depth, isActionable);

			// Check if this is "biebl" - open as null menu then activate biebl mode
			if (subItem === 'biebl') {
				// Open null menu (animation/audio without container)
				this._openPortfolioSection(subItem, audioConfig, true); // true = isNullMenu
				// Activate biebl mode immediately (video already preloaded)
				this.mediaController.activateBieblMode();
				return;
			}

			// Check if this is "seven last words of the unarmed" - open as null menu then play YouTube video
			if (subItem === 'seven last words of the unarmed') {
				// Open null menu (animation/audio without container)
				this._openPortfolioSection(subItem, audioConfig, true); // true = isNullMenu
				// Play YouTube video
				this.mediaController.playYouTubeVideo('https://www.youtube.com/watch?v=od6DMd3sP4s&list=RDod6DMd3sP4s&start_radio=1');
				// Start menu auto-hide timer
				this._resetMenuAutoHideTimer();
				return;
			}

			// Check if this is a song from "the vault" - play audio
			// Search through all vault folders for this song
			let songData = null;
			for (let folderName in this.state.assets.vaultSongs) {
				songData = this.state.assets.vaultSongs[folderName].find(song => song.caption === subItem);
				if (songData) break;
			}
			if (songData) {
				// Open null menu (animation/audio without container)
				this._openPortfolioSection(subItem, audioConfig, true); // true = isNullMenu
				// Play audio with UI
				this.mediaController.playAudioWithUI(songData.caption, songData.path);

				// Setup overlay to dismiss audio player (and close portfolio section)
				if (this.state.dom.overlay) {
					this.state.dom.overlay.style('display', 'block');
					this.state.dom.overlay.style('pointer-events', 'auto');
					this.state.dom.overlay.elt.onclick = (e) => {
						e.stopPropagation();
						this._closePortfolioSection();
					};
				}
				return;
			}

			// If this item has subsections, open them
			if (hasSubmenu) {
				this._openPortfolioSection(subItem, audioConfig);
			}
		};
	}

	// ==================== PRIVATE METHODS - HELPERS (CONTINUED) ====================

	/**
	 * Create a styled portfolio item element
	 * @param {string} text - The item text
	 * @param {string} className - CSS class ('portfolio-item' or 'portfolio-nav-item')
	 * @param {function} clickHandler - Click event handler
	 * @param {boolean} addMargin - Whether to add bottom margin
	 * @param {string} itemName - The item name for audio determination
	 * @param {number} depth - Menu depth level (0, 1, 2)
	 * @returns {p5.Element} The styled item element
	 */
	_createPortfolioItemElement(text, className, clickHandler, addMargin = false, itemName = text, depth = 0) {
		let itemDiv = createDiv(text);
		itemDiv.addClass(className);
		itemDiv.style('font-family', 'Courier New');
		itemDiv.style('font-size', this.config.MENU_ITEM_FONT_SIZE + 'px');
		itemDiv.style('color', 'white');
		itemDiv.style('padding', `${this.config.MENU_ITEM_PADDING_VERTICAL}px ${this.config.MENU_ITEM_PADDING_HORIZONTAL}px`);
		itemDiv.style('min-width', this.config.MENU_ITEM_MIN_TOUCH_SIZE + 'px'); // iOS minimum touch target
		itemDiv.style('min-height', this.config.MENU_ITEM_MIN_TOUCH_SIZE + 'px'); // iOS minimum touch target
		itemDiv.style('cursor', 'pointer');
		itemDiv.style('transform', 'translateZ(0)');
		itemDiv.style('will-change', 'background-color, filter, opacity');
		itemDiv.style('transition', 'background-color 0.2s, filter 0.2s, opacity 0.3s');
		itemDiv.style('display', 'flex');
		itemDiv.style('align-items', 'center');
		itemDiv.style('justify-content', 'center');
		itemDiv.style('text-align', 'center');
		itemDiv.style('user-select', 'none');
		itemDiv.style('-webkit-user-select', 'none');
		itemDiv.style('-webkit-tap-highlight-color', 'transparent');
		itemDiv.style('width', 'fit-content');
		itemDiv.style('background-color', 'rgba(0, 0, 0, 0.3)');
		itemDiv.style('border-radius', this.config.MENU_ITEM_BORDER_RADIUS + 'px');
		itemDiv.style('pointer-events', 'auto');

		if (addMargin) {
			itemDiv.style('margin-bottom', this.config.MENU_ITEM_GAP + 'px');
		}

		// Store hover audio oscillators on the element
		let hoverOscillators = null;
		let storedAudioConfig = null; // Store frequencies generated on hover

		itemDiv.mouseOver(() => {
			// Visual hover effect
			itemDiv.style('background-color', 'rgba(255, 255, 255, 0.1)');
			itemDiv.style('filter', 'brightness(1.3)');

			// Audio hover effect - generate and play hover audio
			const hasSubmenu = this.state.portfolioSections[itemName];

			// Check if this is a vault song
			let isVaultSong = false;
			for (let folderName in this.state.assets.vaultSongs) {
				if (this.state.assets.vaultSongs[folderName].find(song => song.caption === itemName)) {
					isVaultSong = true;
					break;
				}
			}

			// Actionable items open submenus or trigger special modes (biebl, seven last words, vault songs)
			const isActionable = hasSubmenu || itemName === 'biebl' || itemName === 'seven last words of the unarmed' || isVaultSong;
			const adsr = isActionable ? this.config.ADSR_PORTFOLIO : this.config.ADSR_TAB;

			// Get audio config for this depth
			const depthKey = `depth${depth}`;
			const menuAudioConfig = this.config.MENU_AUDIO[depthKey];

			// Use fixed root frequency for this depth
			const freq1 = menuAudioConfig.rootFrequency;

			// Choose interval ratio: 5/4 for actionable items, 16/9 for leaf items
			const intervalRatio = isActionable ? (5 / 4) : (16 / 9);

			// Second note at the interval ratio
			const freq2 = freq1 * intervalRatio;

			const audioConfig = { frequencies: [freq1, freq2], adsr, depth };

			// Store the audio config for use in click handler
			storedAudioConfig = audioConfig;
			itemDiv.elt._storedAudioConfig = audioConfig;

			// Play hover audio (1 octave down)
			hoverOscillators = this.mediaController.playHoverAudio(audioConfig);
		});

		itemDiv.mouseOut(() => {
			// Visual hover effect
			itemDiv.style('background-color', 'rgba(0, 0, 0, 0.3)');
			itemDiv.style('filter', 'brightness(1)');

			// Stop hover audio
			if (hoverOscillators) {
				this.mediaController.stopHoverAudio(hoverOscillators);
				hoverOscillators = null;
			}

			// Clear stored audio config
			storedAudioConfig = null;
			itemDiv.elt._storedAudioConfig = null;
		});

		itemDiv.elt.addEventListener('click', clickHandler);
		itemDiv.elt.addEventListener('touchend', (e) => {
			e.preventDefault(); // Prevent 300ms delay on mobile
			clickHandler(e);
		}, { passive: false });

		return itemDiv;
	}

	/**
	 * Update opacity of all portfolio items in a container
	 * @param {p5.Element} container - The container element
	 * @param {number} opacity - Opacity value (0-1)
	 * @param {HTMLElement} exceptItem - Optional item to keep at different opacity
	 * @param {number} exceptOpacity - Opacity for the exception item (default: 1)
	 */
	_updateContainerItemsOpacity(container, opacity, exceptItem = null, exceptOpacity = 1) {
		if (!container) return;

		let items = container.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
		for (let i = 0; i < items.length; i++) {
			if (items[i] === exceptItem) {
				items[i].style.opacity = exceptOpacity.toString();
			} else {
				items[i].style.opacity = opacity.toString();
			}
		}
	}

	/**
	 * Calculate portfolio container transform values
	 * @param {number} depth - Stack depth (0 = topmost)
	 * @returns {Object} Transform values: {shiftAmount, scale, upwardShift}
	 */
	_calculatePortfolioTransform(depth) {
		let scale = 1 - (depth * this.config.MENU_SCALE_REDUCTION);  // Scale reduction per depth level
		let shiftAmount = depth * this.config.MENU_SHIFT_HORIZONTAL;  // Horizontal shift per depth level
		let upwardShift = -depth * this.config.MENU_SHIFT_VERTICAL;  // Vertical shift per depth level (negated so positive config = up in CSS)

		return { shiftAmount, scale, upwardShift };
	}

	_pulseTab(tab) {
		tab.style('transform', 'scale(1.1)');
		setTimeout(() => {
			tab.style('transform', 'scale(1)');
		}, (this.config.ADSR_TAB.attack + this.config.ADSR_TAB.decay) * 1000);
	}

	_animateProfileContent() {
		this.state.ui.profileContentScaleTarget = 1.05;
		setTimeout(() => {
			this.state.ui.profileContentScaleTarget = 1.0;
		}, 200);
	}

	_animatePortfolioContent() {
		let portfolioList = select('#portfolio-list');
		if (portfolioList) {
			portfolioList.style('transition', 'transform 200ms ease-out');
			portfolioList.style('transform', 'scale(1.02)');
			setTimeout(() => {
				portfolioList.style('transform', 'scale(1)');
			}, 200);
		}
	}

	_shiftVisibleContainers() {
		// Apply transforms to all menu containers based on current stack depth
		// portfolioList (depth 0) shifts based on stack length
		// Stack containers shift based on their position from the top

		let portfolioList = select('#portfolio-list');
		if (portfolioList && this.state.ui.portfolioStack.length > 0) {
			// portfolioList shifts based on stack depth
			let transform = this._calculatePortfolioTransform(this.state.ui.portfolioStack.length);
			portfolioList.style('transform',
				`translateX(${transform.shiftAmount}px) translateY(${transform.upwardShift}px) scale(${transform.scale}) translateZ(0)`);
		}

		// Shift and scale all containers in the stack
		// Depth calculation: topmost container has depth 0, next has depth 1, etc.
		for (let i = 0; i < this.state.ui.portfolioStack.length; i++) {
			let stackEntry = this.state.ui.portfolioStack[i];
			let depthFromTop = this.state.ui.portfolioStack.length - 1 - i;
			let transform = this._calculatePortfolioTransform(depthFromTop);

			// Skip null menu entries (they don't have containers to transform)
			if (stackEntry.container) {
				stackEntry.container.style('transform',
					`translateX(${transform.shiftAmount}px) translateY(${transform.upwardShift}px) scale(${transform.scale}) translateZ(0)`);
			}
		}
	}

	_cleanupPortfolioState() {
		// Close all portfolio submenus and remove containers
		while (this.state.ui.portfolioStack.length > 0) {
			let closingEntry = this.state.ui.portfolioStack.pop();
			if (closingEntry.container) {
				closingEntry.container.remove();
			}
		}

		// Clear stored audio configs from all portfolio items
		let portfolioList = select('#portfolio-list');
		if (portfolioList) {
			// Reset portfolio list position and transition
			portfolioList.style('transform', 'translateX(0) translateY(0) scale(1)');
			portfolioList.style('transition', 'transform 0.3s ease-out');

			// Restore opacity and scrolling for portfolio list
			portfolioList.style('overflow-y', 'scroll');
			this._updateContainerItemsOpacity(portfolioList, 1);

			// Clear stored audio configs from portfolio items
			let allItems = portfolioList.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
			allItems.forEach(item => {
				if (item._storedAudioConfig) {
					item._storedAudioConfig = null;
				}
			});
		}

		// Exit spawner mode
		this.mediaController.exitSpawnerMode();

		// Remove YouTube video if it exists
		this.mediaController.removeYouTubeVideo();

		// Remove audio player if it exists
		this.mediaController.removeAudioPlayer();

		// Hide overlay and clear click handler
		if (this.state.dom.overlay) {
			this.state.dom.overlay.style('display', 'none');
			this.state.dom.overlay.style('pointer-events', 'none');
			this.state.dom.overlay.elt.onclick = null;
		}

		// Stop auto-hide timer and ensure menu is visible
		this._stopMenuAutoHideTimer();
		this._showMenu();

		// Stop all active audio and visuals
		this.mediaController.stopAll();
	}

	/**
	 * Get all menu containers (portfolioList at depth 0 + all stack containers)
	 * @returns {Array} Array of container objects with {container, depth}
	 */
	_getAllMenuContainers() {
		let containers = [];

		// Add portfolioList as depth 0
		let portfolioList = select('#portfolio-list');
		if (portfolioList) {
			containers.push({ container: portfolioList, depth: 0 });
		}

		// Add all stack containers with their depths
		this.state.ui.portfolioStack.forEach((stackEntry, index) => {
			if (stackEntry.container) {
				containers.push({
					container: stackEntry.container,
					depth: index + 1
				});
			}
		});

		return containers;
	}

	/**
	 * Show the menu (toolbar and portfolio containers)
	 */
	_showMenu() {
		if (this.state.ui.menuVisible) return;

		this.state.ui.menuVisible = true;

		const transitionTime = this.config.MENU_AUTOHIDE_TRANSITION / 1000;

		// Fade in toolbar
		if (this.state.dom.toolbarDiv) {
			this.state.dom.toolbarDiv.style('transition', `opacity ${transitionTime}s ease`);
			this.state.dom.toolbarDiv.style('opacity', '1');
		}

		// Only fade menu containers when in portfolio section
		// Preserve transform transition (0.3s) while setting opacity transition (2.5s)
		if (this.state.ui.currentSection === 'portfolio') {
			this._getAllMenuContainers().forEach(({ container }) => {
				container.style('transition', `opacity ${transitionTime}s ease, transform 0.3s ease-out`);
				container.style('opacity', '1');
			});
		}

		// Hide the mouse overlay when menu is visible
		if (this.state.dom.overlay) {
			this.state.dom.overlay.style('display', 'none');
			this.state.dom.overlay.style('pointer-events', 'none'); // Disable mouse event capture
		}
	}

	/**
	 * Hide the menu (toolbar and portfolio containers)
	 */
	_hideMenu() {
		if (!this.state.ui.menuVisible) return;

		this.state.ui.menuVisible = false;

		const transitionTime = this.config.MENU_AUTOHIDE_TRANSITION / 1000;

		// Fade out toolbar
		if (this.state.dom.toolbarDiv) {
			this.state.dom.toolbarDiv.style('transition', `opacity ${transitionTime}s ease`);
			this.state.dom.toolbarDiv.style('opacity', '0');
		}

		// Only fade menu containers when in portfolio section
		// Preserve transform transition (0.3s) while setting opacity transition (2.5s)
		if (this.state.ui.currentSection === 'portfolio') {
			this._getAllMenuContainers().forEach(({ container }) => {
				container.style('transition', `opacity ${transitionTime}s ease, transform 0.3s ease-out`);
				container.style('opacity', '0');
			});
		}

		// Show the mouse overlay when menu is hidden (captures mouse movement over iframe)
		if (this.state.dom.overlay) {
			this.state.dom.overlay.style('display', 'block');
			this.state.dom.overlay.style('pointer-events', 'auto'); // Enable mouse event capture
		}
	}

	/**
	 * Reset the auto-hide timer
	 */
	_resetMenuAutoHideTimer() {
		// Clear existing timer
		if (this.state.ui.menuAutoHideTimer) {
			clearTimeout(this.state.ui.menuAutoHideTimer);
		}

		// Set new timer
		this.state.ui.menuAutoHideTimer = setTimeout(() => {
			this._hideMenu();
		}, this.config.MENU_AUTOHIDE_DELAY);
	}

	/**
	 * Stop the auto-hide timer
	 */
	_stopMenuAutoHideTimer() {
		if (this.state.ui.menuAutoHideTimer) {
			clearTimeout(this.state.ui.menuAutoHideTimer);
			this.state.ui.menuAutoHideTimer = null;
		}
	}

	_switchSection(section) {
		if (this.state.ui.currentSection === section) return;

		this.state.ui.currentSection = section;

		// Update tab styles
		let profileTab = select('#profile-tab');
		let portfolioTab = select('#portfolio-tab');

		if (section === 'profile') {
			profileTab.style('color', 'white');
			profileTab.style('border-bottom', '2px solid white');
			portfolioTab.style('color', 'rgba(255, 255, 255, 0.5)');
			portfolioTab.style('border-bottom', 'none');
		} else {
			profileTab.style('color', 'rgba(255, 255, 255, 0.5)');
			profileTab.style('border-bottom', 'none');
			portfolioTab.style('color', 'white');
			portfolioTab.style('border-bottom', '2px solid white');
		}

		// Reset fade amount to trigger fade transition
		this.state.ui.fadeAmount = 0;
	}

	_calculateWelcomeBrightness() {
		let centerX = windowWidth / 2;
		let centerY = windowHeight / 2;

		if (this.state.device.isTouchDevice) {
			return 255 * (1 - this.state.ui.fadeAmount);
		} else {
			let d = dist(mouseX, mouseY, centerX, centerY);
			let maxDist = dist(0, 0, centerX, centerY);
			let normalizedDist = constrain(d / maxDist, 0, 1);
			let exponentialFactor = pow(1 - normalizedDist, 3);
			let brightness = exponentialFactor * 255 * 0.8;
			return brightness * (1 - this.state.ui.fadeAmount);
		}
	}

	_drawCheckerboard(opacity) {
		this.state.dom.checkerboardDiv.style('opacity', (opacity / 255).toString());
	}

	_drawGradientRect(x, y, w, h, radius, centerAlpha) {
		push();
		drawingContext.save();

		let gradient = drawingContext.createRadialGradient(
			x + w / 2, y + h / 2, 0,
			x + w / 2, y + h / 2, Math.max(w, h) / 2
		);
		gradient.addColorStop(0, `rgba(0, 0, 0, ${centerAlpha})`);
		gradient.addColorStop(0.7, `rgba(0, 0, 0, ${centerAlpha * 0.5})`);
		gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

		drawingContext.fillStyle = gradient;
		drawingContext.beginPath();
		drawingContext.roundRect(x, y, w, h, radius);
		drawingContext.fill();

		drawingContext.restore();
		pop();
	}

	_getButtonBounds() {
		let centerX = windowWidth / 2;
		let centerY = windowHeight / 2;
		return {
			x: centerX - this.config.BUTTON_WIDTH / 2,
			y: centerY - this.config.BUTTON_HEIGHT / 2,
			width: this.config.BUTTON_WIDTH,
			height: this.config.BUTTON_HEIGHT
		};
	}

	_isMouseOverButton(bounds, x, y) {
		return x > bounds.x && x < bounds.x + bounds.width &&
			y > bounds.y && y < bounds.y + bounds.height;
	}
}

// Make UIEngine available globally for p5.js
window.UIEngine = UIEngine;
