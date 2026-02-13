// ==================== ENGINES ====================
let audioEngine;
let visualEngine;
let mediaController;
let uiEngine;

// ==================== SETUP & INITIALIZATION ====================
function setup() {
	// Initialize audio engine
	audioEngine = new AudioEngine(appState, CONFIG);
	audioEngine.initialize();

	// Initialize visual engine
	visualEngine = new VisualEngine(appState, CONFIG, audioEngine);

	// Initialize media controller (coordinates audio and visual feedback)
	mediaController = new MediaController(appState, CONFIG, audioEngine, visualEngine);

	// Initialize UI engine
	uiEngine = new UIEngine(appState, CONFIG, mediaController);
	uiEngine.initialize();

	// Setup visibility/focus handlers to stop audio and visuals when navigating away
	document.addEventListener('visibilitychange', function() {
		if (!document.hidden) {
			audioEngine.resumeContext();
		} else {
			// Fade out all feedback when page becomes hidden
			// Use CSS transitions which work reliably even when RAF is throttled
			mediaController.stopAll(true);
		}
	});

	window.addEventListener('focus', function() {
		audioEngine.resumeContext();
	});

	window.addEventListener('blur', function() {
		// Fade out all feedback when window loses focus
		// Use CSS transitions which work reliably even when RAF is throttled
		mediaController.stopAll(true);
	});

	// Load profile image
	appState.dom.profileImg = loadImage('assets/visual/fisher_diede_portrait.jpeg');

	// Load spawner images from manifest
	loadStrings('assets/visual/welcome/manifest.txt', onManifestLoaded);

	// Load spawner videos from manifest
	loadStrings('assets/visual/welcome/movie/manifest.txt', onVideoManifestLoaded);

	// Load biebl videos from manifest
	loadStrings('assets/visual/biebl/manifest.txt', onBieblVideoManifestLoaded);

	// Load vault/08112025 songs from manifest
	loadStrings('assets/audio/vault/08112025/manifest.txt', on08112025ManifestLoaded);
}

// ==================== HELPER FUNCTIONS ====================

function loadManifest(manifest, assetArrayKey, basePath, options = {}) {
	const { skipComments = false, createOrder = false, orderKey = null, loadedKey = null, preloadCallback = null } = options;

	for (let i = 0; i < manifest.length; i++) {
		let line = manifest[i].trim();

		// Skip empty lines and optionally skip comments
		if (!line || (skipComments && line.startsWith('#'))) continue;

		// Check if line contains a caption (format: filename | caption | time | place)
		if (line.includes(' | ')) {
			let parts = line.split(' | ');
			let filename = parts[0].trim();
			let caption = parts[1].trim();
			let time = parts[2] ? parts[2].trim() : null;
			let place = parts[3] ? parts[3].trim() : null;
			appState.assets[assetArrayKey].push({
				path: basePath + filename,
				caption: caption,
				time: time,
				place: place
			});
		} else {
			// No caption provided, use filename-based caption
			appState.assets[assetArrayKey].push({
				path: basePath + line,
				caption: generateCaption(line),
				time: null,
				place: null
			});
		}
	}

	// Create randomized order if requested
	if (createOrder && orderKey) {
		for (let i = 0; i < appState.assets[assetArrayKey].length; i++) {
			appState.assets[orderKey].push(i);
		}
		shuffleArray(appState.assets[orderKey]);
	}

	// Mark as loaded if requested
	if (loadedKey) {
		appState.assets[loadedKey] = true;
	}

	// Call preload callback if provided
	if (preloadCallback) {
		preloadCallback();
	}
}

function onManifestLoaded(manifest) {
	loadManifest(manifest, 'spawnerImages', 'assets/visual/welcome/', {
		createOrder: true,
		orderKey: 'imageOrder',
		loadedKey: 'imagesLoaded',
		preloadCallback: () => visualEngine.preloadNextImage()
	});
}

function onVideoManifestLoaded(manifest) {
	loadManifest(manifest, 'spawnerVideos', 'assets/visual/welcome/movie/', {
		createOrder: true,
		orderKey: 'videoOrder',
		loadedKey: 'videosLoaded',
		preloadCallback: () => visualEngine.preloadNextVideo()
	});
}

function onBieblVideoManifestLoaded(manifest) {
	loadManifest(manifest, 'bieblVideos', 'assets/visual/biebl/', {
		skipComments: true
	});
}

function on08112025ManifestLoaded(manifest) {
	// Initialize the array for this vault folder
	appState.assets.vaultSongs['08112025'] = [];

	// Load songs into the vault folder
	for (let i = 0; i < manifest.length; i++) {
		let line = manifest[i].trim();
		if (!line) continue;

		if (line.includes(' | ')) {
			let parts = line.split(' | ');
			let filename = parts[0].trim();
			let caption = parts[1].trim();
			appState.assets.vaultSongs['08112025'].push({
				path: 'assets/audio/vault/08112025/' + filename,
				caption: caption
			});
		} else {
			appState.assets.vaultSongs['08112025'].push({
				path: 'assets/audio/vault/08112025/' + line,
				caption: generateCaption(line)
			});
		}
	}

	// Portfolio section is now hardcoded in state.js, no need to populate it here
}

function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function generateCaption(filename) {
	// Remove file extension and path
	let name = filename.split('/').pop().split('.')[0];

	// Replace underscores with spaces and capitalize words
	return name.split('_').map(word => {
		return word.charAt(0).toUpperCase() + word.slice(1);
	}).join(' ');
}

// ==================== P5.JS CORE FUNCTIONS ====================
function draw() {
	uiEngine.render();
}

function windowResized() {
	uiEngine.handleResize(windowWidth, windowHeight);
}

function mousePressed() {
	uiEngine.handleClick(mouseX, mouseY);
}

function touchStarted() {
	// Prevent both touch and mouse events from firing on mobile
	uiEngine.handleClick(mouseX, mouseY);
	return false; // Prevent default and stop mousePressed from also firing
}
