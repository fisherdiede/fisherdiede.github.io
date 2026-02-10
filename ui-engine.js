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
		// Create toolbar (initially hidden)
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
		this.state.dom.toolbarDiv.style('gap', '40px');
		this.state.dom.toolbarDiv.style('opacity', '0');
		this.state.dom.toolbarDiv.style('pointer-events', 'none');
		this.state.dom.toolbarDiv.style('transition', 'opacity 0.5s ease');

		// Create Profile tab
		let profileTab = createDiv('Profile');
		profileTab.style('font-family', 'Courier New');
		profileTab.style('font-size', '18px');
		profileTab.style('color', 'white');
		profileTab.style('cursor', 'pointer');
		profileTab.style('padding', '10px 20px');
		profileTab.style('border-bottom', '2px solid white');
		profileTab.style('transition', 'transform 0.15s ease-out');
		profileTab.id('profile-tab');
		profileTab.mousePressed(() => {
			this._handleProfileTab();
			return false; // Prevent global mousePressed
		});
		this.state.dom.toolbarDiv.child(profileTab);

		// Create Portfolio tab
		let portfolioTab = createDiv('Portfolio');
		portfolioTab.style('font-family', 'Courier New');
		portfolioTab.style('font-size', '18px');
		portfolioTab.style('color', 'rgba(255, 255, 255, 0.5)');
		portfolioTab.style('cursor', 'pointer');
		portfolioTab.style('padding', '10px 20px');
		portfolioTab.style('transition', 'transform 0.15s ease-out');
		portfolioTab.id('portfolio-tab');
		portfolioTab.mousePressed(() => {
			this._handlePortfolioTab();
			return false; // Prevent global mousePressed
		});
		this.state.dom.toolbarDiv.child(portfolioTab);
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
		portfolioList.style('display', 'none');
		portfolioList.style('opacity', '0');
		portfolioList.style('padding', '40px 20px');
		portfolioList.style('flex-direction', 'column');
		portfolioList.style('align-items', 'center');

		// Add portfolio items
		this.state.portfolioItems.forEach((item) => {
			let itemDiv = this._createPortfolioItemElement(
				item,
				'portfolio-item',
				(event) => {
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
					const adsr = hasSubmenu ? this.config.ADSR_PORTFOLIO : this.config.ADSR_TAB;

					// Use stored audio config from hover if available
					const storedConfig = event.target._storedAudioConfig;
					const frequencies = storedConfig ? storedConfig.frequencies : null;
					const depth = storedConfig ? storedConfig.depth : 0;
					const audioConfig = this.mediaController.playPortfolioItem(adsr, frequencies, depth);

					// Open sub-section if this item has one
					if (hasSubmenu) {
						this._openPortfolioSection(item, audioConfig);
					}
				},
				true, // Add margin
				item, // itemName for audio determination
				0 // depth (top-level items are depth 0)
			);

			itemDiv.attribute('data-item', item);
			portfolioList.child(itemDiv);
		});
	}

	_setupEventListeners() {
		// Add keyboard listener for closing sub-sections
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && this.state.ui.portfolioStack.length > 0) {
				this._closePortfolioSection();
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
	}

	// ==================== PRIVATE METHODS - RENDERING ====================

	_renderWelcomeScreen() {
		let centerX = windowWidth / 2;
		let centerY = windowHeight / 2;
		let brightness = this._calculateWelcomeBrightness();

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

		// Always show both during transition, crossfade between them
		if (this.state.ui.fadeAmount < 1) {
			// During transition
			if (this.state.ui.currentSection === 'portfolio') {
				// Fading into portfolio
				portfolioList.style('display', 'flex');
				portfolioList.style('opacity', this.state.ui.fadeAmount.toString());
				portfolioList.style('pointer-events', 'auto');
				this.state.dom.canvas.style('pointer-events', 'none');
			} else {
				// Fading into profile - keep portfolio hidden
				portfolioList.style('display', 'none');
				portfolioList.style('opacity', '0');
				portfolioList.style('pointer-events', 'none');
				this.state.dom.canvas.style('pointer-events', 'auto');
			}
		} else {
			// Transition complete
			if (this.state.ui.currentSection === 'portfolio') {
				portfolioList.style('display', 'flex');
				portfolioList.style('opacity', '1');
				portfolioList.style('pointer-events', 'auto');
				this.state.dom.canvas.style('pointer-events', 'none');
				// Don't draw profile content on canvas
				clear();
				this._drawCheckerboard(this.config.CHECKERBOARD_OPACITY);
				return;
			} else {
				portfolioList.style('display', 'none');
				portfolioList.style('opacity', '0');
				portfolioList.style('pointer-events', 'none');
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

		// Draw gradient background behind name
		let nameW = 280;
		let nameH = 50;
		let nameX = centerX - nameW/2;
		let nameY = centerY - 145;
		this._drawGradientRect(nameX, nameY, nameW, nameH, 15, this.state.ui.fadeAmount * 0.33);

		fill(255, alpha);
		textFont("Courier New");

		// Name
		textSize(32);
		textAlign(CENTER);
		text("Fisher Diede", centerX, centerY - 120);

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

		// Draw gradient background behind bio and email
		let bioW = 280;
		let bioH = 70;
		let bioX = centerX - bioW/2;
		let bioY = centerY + 40;
		this._drawGradientRect(bioX, bioY, bioW, bioH, 15, this.state.ui.fadeAmount * 0.33);

		// Bio
		strokeWeight(1);
		fill(255, alpha);
		textSize(16);
		textAlign(CENTER);
		text("Creative Technologist", centerX, centerY + 60);

		// Contact info
		textSize(14);
		text("fisherdiede@icloud.com", centerX, centerY + 100);

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

		// Calculate depth: if stack is empty, we're going from depth 0 to depth 1, otherwise increment
		const currentDepth = this.state.ui.portfolioStack.length === 0 ? 1 : this.state.ui.portfolioStack[this.state.ui.portfolioStack.length - 1].depth + 1;

		// Determine parent container
		let parentContainer;
		if (this.state.ui.portfolioStack.length === 0) {
			parentContainer = select('#portfolio-list');
		} else {
			let parentStackEntry = this.state.ui.portfolioStack[this.state.ui.portfolioStack.length - 1];
			parentContainer = parentStackEntry.container;
		}

		// Find clicked item position
		let clickedItem = null;
		let clickedItemCenterY = windowHeight / 2;

		if (parentContainer) {
			let items = parentContainer.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
			for (let i = 0; i < items.length; i++) {
				if (items[i].textContent === itemName) {
					clickedItem = items[i];
					let rect = clickedItem.getBoundingClientRect();
					clickedItemCenterY = rect.top + rect.height / 2;
					break;
				}
			}
		}

		// Dim all items in parent container except the clicked one (visual only)
		if (parentContainer) {
			parentContainer.style('overflow-y', 'hidden');
			this._updateContainerItemsOpacity(parentContainer, 0.2, clickedItem);

			// Mark all items in parent as "parent level" for back navigation (functional)
			let items = parentContainer.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
			for (let i = 0; i < items.length; i++) {
				items[i].setAttribute('data-parent-level', 'true');
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
			newContainer.style('transition', 'opacity 0.3s, transform 0.3s');
			newContainer.style('padding', '40px 20px');
			newContainer.style('flex-direction', 'column');
			newContainer.style('align-items', 'center');
			newContainer.style('justify-content', 'flex-start');
			newContainer.style('padding-top', (clickedItemCenterY - 60) + 'px');
			newContainer.style('overflow-y', 'auto');
			newContainer.style('-webkit-overflow-scrolling', 'touch');

			// Create wrapper for items
			let itemsWrapper = createDiv();
			itemsWrapper.style('display', 'flex');
			itemsWrapper.style('flex-direction', 'column');
			itemsWrapper.style('align-items', 'center');
			itemsWrapper.style('gap', '10px');
			itemsWrapper.style('transform', 'translateY(-50%)');
			itemsWrapper.style('pointer-events', 'none'); // Let clicks pass through to dimmed items

			// Create items
			subItems.forEach((subItem) => {
				let itemDiv = this._createPortfolioItemElement(
					subItem,
					'portfolio-nav-item',
					(event) => {
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
						// Special case: biebl uses longer ADSR even though it enters spawner mode
						const adsr = (hasSubmenu || subItem === 'biebl') ? this.config.ADSR_PORTFOLIO : this.config.ADSR_TAB;

						// Use stored audio config from hover if available
						const storedConfig = event.target._storedAudioConfig;
						const frequencies = storedConfig ? storedConfig.frequencies : null;
						const depth = storedConfig ? storedConfig.depth : currentDepth;
						const audioConfig = this.mediaController.playPortfolioItem(adsr, frequencies, depth);

						// Check if this is "biebl" - open as null menu then activate biebl mode
						if (subItem === 'biebl') {
							// Open null menu (animation/audio without container)
							this._openPortfolioSection(subItem, audioConfig, true); // true = isNullMenu
							// Activate biebl mode after brief delay for animation to start
							setTimeout(() => {
								this.mediaController.activateBieblMode();
							}, 100);
							return;
						}

						// If this item has subsections, open them
						if (hasSubmenu) {
							this._openPortfolioSection(subItem, audioConfig);
						}
					},
					false, // No margin
					subItem, // itemName for audio determination
					currentDepth // depth for audio configuration
				);

				itemsWrapper.child(itemDiv);
			});

			newContainer.child(itemsWrapper);
		}

		// Add to stack BEFORE shifting
		this.state.ui.portfolioStack.push({
			container: newContainer, // null for null menus
			itemName: itemName,
			parentContainer: parentContainer,
			clickedItemY: clickedItemCenterY,
			audioConfig: audioConfig,  // Store for reversal on close
			depth: currentDepth,  // Store depth for nested navigation
			isNullMenu: isNullMenu // Flag for close handling
		});

		// Shift all containers
		this._shiftVisibleContainers();

		// Show the new container (skip for null menus)
		if (newContainer) {
			setTimeout(() => {
				newContainer.style('opacity', '1');
				newContainer.style('pointer-events', 'none'); // Let clicks pass through to dimmed items
			}, 50);
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

		// Restore opacity and scrolling in parent container
		if (parentContainer) {
			parentContainer.style('overflow-y', 'auto');
			this._updateContainerItemsOpacity(parentContainer, 1);

			// Remove parent-level markers from items since they're now current level
			let items = parentContainer.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
			for (let i = 0; i < items.length; i++) {
				items[i].removeAttribute('data-parent-level');
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
	}

	// ==================== PRIVATE METHODS - HELPERS ====================

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
		itemDiv.style('font-size', '20px');
		itemDiv.style('color', 'white');
		itemDiv.style('padding', '15px 30px');
		itemDiv.style('cursor', 'pointer');
		itemDiv.style('transition', 'background-color 0.2s, filter 0.2s, opacity 0.3s');
		itemDiv.style('text-align', 'center');
		itemDiv.style('width', 'fit-content');
		itemDiv.style('background-color', 'rgba(0, 0, 0, 0.3)');
		itemDiv.style('border-radius', '5px');
		itemDiv.style('pointer-events', 'auto');

		if (addMargin) {
			itemDiv.style('margin-bottom', '10px');
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
			const adsr = hasSubmenu ? this.config.ADSR_PORTFOLIO : this.config.ADSR_TAB;

			// Get audio config for this depth
			const depthKey = `depth${depth}`;
			const menuAudioConfig = this.config.MENU_AUDIO[depthKey];

			// Generate random frequency between min and max for this depth
			const minFreq = this.mediaController.audioEngine.noteMap[menuAudioConfig.minNote];
			const maxFreq = this.mediaController.audioEngine.noteMap[menuAudioConfig.maxNote];
			const freq1 = minFreq + Math.random() * (maxFreq - minFreq);

			// Second note at the interval ratio for this depth
			const freq2 = freq1 * menuAudioConfig.intervalRatio;

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

		return itemDiv;
	}

	/**
	 * Update opacity of all portfolio items in a container
	 * @param {p5.Element} container - The container element
	 * @param {number} opacity - Opacity value (0-1)
	 * @param {HTMLElement} exceptItem - Optional item to exclude from the update
	 */
	_updateContainerItemsOpacity(container, opacity, exceptItem = null) {
		if (!container) return;

		let items = container.elt.querySelectorAll('.portfolio-item, .portfolio-nav-item');
		for (let i = 0; i < items.length; i++) {
			if (items[i] === exceptItem) {
				items[i].style.opacity = '1';
			} else {
				items[i].style.opacity = opacity.toString();
			}
		}
	}

	/**
	 * Calculate portfolio container transform values
	 * @param {number} depth - Stack depth (0 = topmost)
	 * @param {number} clickedY - Y position of clicked item
	 * @returns {Object} Transform values: {shiftAmount, scale, yCompensation}
	 */
	_calculatePortfolioTransform(depth, clickedY) {
		let scale = 1 - (depth * 0.125);  // Gentler 12.5% scale reduction per depth level
		let shiftAmount = depth * this.config.PORTFOLIO_SHIFT_AMOUNT;  // Linear shift per depth level
		let containerCenterY = windowHeight / 2;
		let yCompensation = (clickedY - containerCenterY) * (1 - scale);

		return { shiftAmount, scale, yCompensation };
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
		// If stack is not empty, also shift and scale the portfolio list
		if (this.state.ui.portfolioStack.length > 0) {
			let portfolioList = select('#portfolio-list');
			let clickedY = this.state.ui.portfolioStack[0].clickedItemY;
			let transform = this._calculatePortfolioTransform(this.state.ui.portfolioStack.length, clickedY);

			portfolioList.style('transform',
				`translateX(${transform.shiftAmount}px) translateY(${transform.yCompensation}px) scale(${transform.scale})`);
			portfolioList.style('transition', 'transform 0.3s ease-out');
		}

		// Shift and scale all containers in the stack
		for (let i = 0; i < this.state.ui.portfolioStack.length; i++) {
			let stackEntry = this.state.ui.portfolioStack[i];
			let depth = this.state.ui.portfolioStack.length - 1 - i;
			let transform = this._calculatePortfolioTransform(depth, stackEntry.clickedItemY);

			// Skip null menu entries (they don't have containers to transform)
			if (stackEntry.container) {
				stackEntry.container.style('transform',
					`translateX(${transform.shiftAmount}px) translateY(${transform.yCompensation}px) scale(${transform.scale})`);
				stackEntry.container.style('transition', 'transform 0.3s ease-out');
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

		// Stop all active audio and visuals
		this.mediaController.stopAll();
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
