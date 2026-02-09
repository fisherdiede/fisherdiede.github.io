// ==================== GLOBAL STATE ====================
var canvas;
var showProfile = false;
var fadeAmount = 0;
var profileImg;
var spawnerImages = [];
var spawnerVideos = [];
var imageOrder = [];
var videoOrder = [];
var currentImageIndex = 0;
var currentVideoIndex = 0;
var imagesSinceLastVideo = 0;
var videoIsPlaying = false;
var imagesLoaded = false;
var videosLoaded = false;
var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
var wasHovering = false;
var isHoveringWelcome = false;
var checkerboardOpacity = 0;
var checkerboardTargetOpacity = 0;
var lastPlayedNote = -1;
var activeOscillators = [];
var reverb;
var reverbBus;
var subtleReverb; // Always-on subtle reverb
var audioUpdateCounter = 0;
var minFrequency; // Calculated from EB_MAJOR_NOTES during setup
var maxFrequency; // Calculated from EB_MAJOR_NOTES during setup

// ==================== CONFIGURATION ====================
// Animation settings
var ANIMATION_DURATION = 10; // Total animation time in seconds
var FADE_START_TIME = 3; // When to start fading out
var PAGE_FADE_DURATION = 4; // seconds - how long page transitions take
var SCALE_GROWTH = 2; // How much to grow (1 = no growth, 2 = double size)
var SPEED_MIN = 0.05;
var SPEED_MAX = 0.1;
var SIZE_MIN = 100;
var SIZE_MAX = 200;

// UI settings
var BUTTON_WIDTH = 200;
var BUTTON_HEIGHT = 60;
var BUTTON_RADIUS = 10;
var BUTTON_FADE_DURATION = 0.25; // seconds - how long welcome button fades when clicked
var CHECKERBOARD_SQUARE_SIZE = 7;
var CHECKERBOARD_OPACITY = 84;
var CHECKERBOARD_FADE_TIME = 0.6; // seconds - how long to fade in checkerboard on hover

// Audio settings
var ENABLE_VIBRATO = true; // Set to true to enable vibrato effect on hover
var VIBRATO_RATE_MIN = 0.5; // Hz - minimum vibrato speed
var VIBRATO_RATE_MAX = 10; // Hz - maximum vibrato speed
var VIBRATO_DEPTH_MIN = 0.25; // Hz - minimum vibrato amount
var VIBRATO_DEPTH_MAX = 1.5; // Hz - maximum vibrato amount
var VIBRATO_RAMP_TIME = 0.1; // seconds - ramp time for vibrato frequency changes
var FILTER_CUTOFF_MIN; // Hz - filter cutoff at screen edges (calculated from highest note)
var FILTER_CUTOFF_MAX = 5000; // Hz - filter cutoff at screen center
var FILTER_RAMP_TIME = 0.02; // seconds - ramp time for filter frequency changes
var FILTER_HOLD_RAMP_TIME = 0.2; // seconds - ramp time when holding filter at max
var AUDIO_FADE_IN_TIME = 0.1; // seconds - oscillator fade in time
var AUDIO_FADE_OUT_TIME = 0.1; // seconds - oscillator fade out time
var AUDIO_AMPLITUDE = 0.3; // oscillator amplitude
var SUBTLE_REVERB_DURATION = 2; // seconds - subtle reverb duration
var SUBTLE_REVERB_DECAY = 2; // decay rate for subtle reverb
var SUBTLE_REVERB_DRYWET = 0.2; // 20% wet, 80% dry
var REVERB_FADE_IN_TIME = 0.0; // seconds - fade in time for reverb bus send
var REVERB_FADE_OUT_TIME = 10.0; // seconds - fade out time for reverb bus send
var REVERB_DURATION = 6; // seconds - reverb duration
var REVERB_DECAY = 3; // decay rate (higher = more intense)
var REVERB_DRYWET = 1; // 0 = fully dry, 1 = fully wet
var AUDIO_UPDATE_THROTTLE = 3; // Update vibrato every N frames
var AMPLITUDE_FADE_THROTTLE = 3; // Update amplitude fade every N frames

// Video audio effects settings
var VIDEO_FILTER_FREQ = 4000; // Hz - lowpass filter cutoff frequency
var VIDEO_REVERB_DURATION = 8; // seconds - reverb duration (increased for intensity)
var VIDEO_REVERB_DECAY = 3; // decay rate (increased for intensity)
var VIDEO_AUDIO_FADE_DURATION = 1; // seconds - how long before end to start fading video audio
var MIN_IMAGES_BEFORE_VIDEO = 4; // minimum number of images to spawn before allowing a video
var VIDEO_SPAWN_PROBABILITY = 0.1; // probability (0-1) of spawning a video when eligible

// Eb major scale frequencies (across multiple octaves)
var EB_MAJOR_NOTES = [
	77.78,  // Eb2
    77.78,  // Eb2
    77.78,  // Eb2
    77.78,  // Eb2
	87.31,  // F2
	98.00,  // G2
	103.83, // Ab2
	116.54, // Bb2
	130.81, // C3
	146.83, // D3
	155.56, // Eb3
    155.56, // Eb3
    155.56, // Eb3
	174.61, // F3
	196.00, // G3
	207.65, // Ab3
	233.08, // Bb3
	261.63, // C4
	293.66, // D4
	311.13, // Eb4
	349.23, // F4
	392.00, // G4
	415.30, // Ab4
	466.16, // Bb4
	523.25, // C5
	587.33, // D5
	622.25, // Eb5
    622.25, // Eb5
	698.46, // F5
	783.99, // G5
	830.61, // Ab5
	932.33, // Bb5
	1046.50, // C6
	1174.66, // D6
	1244.51  // Eb6
];

// ==================== SETUP & INITIALIZATION ====================
function setup() {
	console.log("homepage setup");
	canvas = createCanvas(windowWidth, windowHeight);
	canvas.position(0, 0);
	canvas.style('z-index', '100');

	// Enable audio on user interaction (required for mobile browsers)
	userStartAudio();

	// Calculate frequency range for amplitude scaling and filter cutoff
	minFrequency = Math.min(...EB_MAJOR_NOTES);
	maxFrequency = Math.max(...EB_MAJOR_NOTES);
	FILTER_CUTOFF_MIN = maxFrequency; // Set minimum filter cutoff to highest note frequency

	// Load profile image
	profileImg = loadImage('assets/img/fisher_diede_portrait.jpeg');

	// Load spawner images from manifest
	loadStrings('assets/img/spawner/manifest.txt', onManifestLoaded);

	// Load spawner videos from manifest
	loadStrings('assets/img/spawner/movie/manifest.txt', onVideoManifestLoaded);

	// Initialize subtle reverb for always-on ambient effect
	subtleReverb = new p5.Reverb();
	subtleReverb.set(SUBTLE_REVERB_DURATION, SUBTLE_REVERB_DECAY);
	subtleReverb.drywet(SUBTLE_REVERB_DRYWET);

	// Initialize reverb bus and effect for hover/profile effect
	reverbBus = new p5.Gain();
	reverbBus.amp(0); // Start with no send

	reverb = new p5.Reverb();
	reverb.process(reverbBus, REVERB_DURATION, REVERB_DECAY);
	reverb.drywet(REVERB_DRYWET);
}

function onManifestLoaded(manifest) {
	for (let i = 0; i < manifest.length; i++) {
		let filename = manifest[i].trim();
		if (filename) {
			spawnerImages.push('assets/img/spawner/' + filename);
		}
	}

	// Create randomized order
	for (let i = 0; i < spawnerImages.length; i++) {
		imageOrder.push(i);
	}
	shuffleArray(imageOrder);
	imagesLoaded = true;
	console.log('Spawner images loaded:', spawnerImages.length, 'images');
}

function onVideoManifestLoaded(manifest) {
	for (let i = 0; i < manifest.length; i++) {
		let filename = manifest[i].trim();
		if (filename) {
			spawnerVideos.push('assets/img/spawner/movie/' + filename);
		}
	}

	// Create randomized order
	for (let i = 0; i < spawnerVideos.length; i++) {
		videoOrder.push(i);
	}
	shuffleArray(videoOrder);
	videosLoaded = true;
	console.log('Spawner videos loaded:', spawnerVideos.length, 'videos');
}

// ==================== HELPER FUNCTIONS ====================
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function getButtonBounds() {
	let centerX = windowWidth / 2;
	let centerY = windowHeight / 2;
	return {
		x: centerX - BUTTON_WIDTH / 2,
		y: centerY - BUTTON_HEIGHT / 2,
		width: BUTTON_WIDTH,
		height: BUTTON_HEIGHT
	};
}

function isMouseOverButton(bounds) {
	return mouseX > bounds.x && mouseX < bounds.x + bounds.width &&
		mouseY > bounds.y && mouseY < bounds.y + bounds.height;
}

function getAmplitudeForFrequency(freq) {
	// Scale amplitude based on frequency to compensate for equal-loudness perception
	// Lower frequencies need more amplitude to sound equally loud as higher frequencies
	// Using a power curve to map frequency range to amplitude multiplier

	// Normalize frequency to 0-1 range using pre-calculated min/max
	let normalizedFreq = (freq - minFrequency) / (maxFrequency - minFrequency);

	// Apply inverse power curve - low freq gets higher multiplier
	let multiplier = 1 - (pow(normalizedFreq, 0.6) * 0.5); // Range: 1.0 (low) to 0.5 (high)

	return AUDIO_AMPLITUDE * multiplier;
}

function updateAudioEffects(isHovering) {
	audioUpdateCounter++;
	let shouldUpdateAudio = audioUpdateCounter % AUDIO_UPDATE_THROTTLE === 0;

	// Apply vibrato and reverb when hovering or when profile is showing
	if ((isHovering && !showProfile) || showProfile) {
		// Vibrato effect - only apply to oscillators with vibrato enabled
		if (ENABLE_VIBRATO && shouldUpdateAudio) {
			for (let oscData of activeOscillators) {
				if (oscData.enableVibrato) {
					let lfo = sin(frameCount * 0.1 * oscData.vibratoRate) * oscData.vibratoDepth;
					oscData.osc.freq(oscData.baseFreq + lfo, VIBRATO_RAMP_TIME);
				}
			}
		}

		// Hold filter at maximum cutoff - only on hover state change (welcome screen only)
		if (!wasHovering && !showProfile) {
			for (let oscData of activeOscillators) {
				oscData.filter.freq(FILTER_CUTOFF_MAX, FILTER_HOLD_RAMP_TIME);
			}
		}

		// Activate reverb bus send
		reverbBus.amp(1, REVERB_FADE_IN_TIME);
	} else {
		// Reset to base frequency when not hovering and not on profile
		if (ENABLE_VIBRATO && wasHovering) {
			for (let oscData of activeOscillators) {
				if (oscData.enableVibrato) {
					oscData.osc.freq(oscData.baseFreq, FILTER_HOLD_RAMP_TIME);
				}
			}
		}

		// Deactivate reverb bus send
		reverbBus.amp(0, REVERB_FADE_OUT_TIME);
	}

	wasHovering = isHovering;
}

// ==================== P5.JS CORE FUNCTIONS ====================
function draw() {
	clear();

	if (!showProfile) {
		drawWelcomeScreen();
	} else {
		drawProfileScreen();
	}
}

// ==================== DRAWING FUNCTIONS ====================
function calculateWelcomeBrightness() {
	let centerX = windowWidth / 2;
	let centerY = windowHeight / 2;

	if (isTouchDevice) {
		// On touch devices, always show at full brightness
		return 255 * (1 - fadeAmount);
	} else {
		// On cursor devices, calculate distance from mouse to center
		let d = dist(mouseX, mouseY, centerX, centerY);
		let maxDist = dist(0, 0, centerX, centerY);
		let normalizedDist = constrain(d / maxDist, 0, 1);

		// Apply exponential curve (inverse so closer = brighter)
		let exponentialFactor = pow(1 - normalizedDist, 3);
		let brightness = exponentialFactor * 255 * 0.8; // Max 80% brightness

		return brightness * (1 - fadeAmount);
	}
}

function drawCheckerboard(opacity) {
	noStroke();
	for (let x = 0; x < windowWidth; x += CHECKERBOARD_SQUARE_SIZE) {
		for (let y = 0; y < windowHeight; y += CHECKERBOARD_SQUARE_SIZE) {
			// Alternate between black and transparent
			if ((x / CHECKERBOARD_SQUARE_SIZE + y / CHECKERBOARD_SQUARE_SIZE) % 2 === 0) {
				fill(0, opacity);
				rect(x, y, CHECKERBOARD_SQUARE_SIZE, CHECKERBOARD_SQUARE_SIZE);
			}
		}
	}
}

function drawGradientRect(x, y, w, h, radius, centerAlpha) {
	// Draw rounded rectangle with gradient edges that fade to transparent
	push();
	drawingContext.save();

	// Create radial gradient from center to edges
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

function drawWelcomeScreen() {
	let centerX = windowWidth / 2;
	let centerY = windowHeight / 2;
	let brightness = calculateWelcomeBrightness();

	// Get button bounds and check hover state (hover only on non-touch devices)
	let buttonBounds = getButtonBounds();
	let isHovering = !isTouchDevice && isMouseOverButton(buttonBounds);
	// On touch devices, treat button press/transition as "hovering" for audio effects
	let isTransitioning = fadeAmount > 0;
	let shouldApplyEffects = isHovering || (isTouchDevice && isTransitioning);
	isHoveringWelcome = shouldApplyEffects;

	// Update audio effects
	updateAudioEffects(shouldApplyEffects);

	// Animate checkerboard opacity on hover or during transition
	if (isHovering || isTransitioning) {
		checkerboardTargetOpacity = CHECKERBOARD_OPACITY;
	} else {
		checkerboardTargetOpacity = 0;
	}

	// Smooth transition using lerp (60fps = ~0.0167s per frame)
	let fadeSpeed = deltaTime / (CHECKERBOARD_FADE_TIME * 1000);
	checkerboardOpacity = lerp(checkerboardOpacity, checkerboardTargetOpacity, fadeSpeed);

	// Use hover appearance for touch devices or when hovering
	let useHoverAppearance = isTouchDevice || isHovering;

	// Calculate button opacity based on fade state
	let buttonOpacity = 1 - fadeAmount;

	// Draw checkerboard behind button (always, but with animated opacity)
	// Checkerboard fades independently - not affected by button fade
	if (checkerboardOpacity > 0.1) {
		drawCheckerboard(checkerboardOpacity);
	}

	// Draw button background
	if (useHoverAppearance) {
		fill(15, 255 * buttonOpacity);
	} else {
		fill(0, brightness * buttonOpacity);
	}
	noStroke();
	rect(buttonBounds.x, buttonBounds.y, buttonBounds.width, buttonBounds.height, BUTTON_RADIUS);

	// Draw button border
	noFill();
	if (useHoverAppearance) {
		stroke(255, 255 * buttonOpacity);
	} else {
		stroke(Math.floor(brightness), 255 * buttonOpacity);
	}
	strokeWeight(2);
	rect(buttonBounds.x, buttonBounds.y, buttonBounds.width, buttonBounds.height, BUTTON_RADIUS);

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

	// Animate fade transition
	if (fadeAmount > 0) {
		let fadeIncrement = deltaTime / (BUTTON_FADE_DURATION * 1000);
		fadeAmount += fadeIncrement;
		if (fadeAmount >= 1) {
			showProfile = true;
			fadeAmount = 0;
		}
	}
}

function drawProfileScreen() {
	isHoveringWelcome = false;
	let fadeIncrement = deltaTime / (PAGE_FADE_DURATION * 1000);
	fadeAmount = min(fadeAmount + fadeIncrement, 1);
	let alpha = 255 * fadeAmount;

	// Continue updating audio effects for active oscillators
	updateAudioEffects(false);

	// Draw checkerboard background at full opacity
	drawCheckerboard(CHECKERBOARD_OPACITY);

	let centerX = windowWidth / 2;
	let centerY = windowHeight / 2;

	// Draw gradient background behind name
	let nameW = 280;
	let nameH = 50;
	let nameX = centerX - nameW/2;
	let nameY = centerY - 145;
	drawGradientRect(nameX, nameY, nameW, nameH, 15, fadeAmount * 0.33);

	fill(255, alpha);
	textFont("Courier New");

	// Name
	textSize(32);
	textAlign(CENTER);
	text("Fisher Diede", centerX, centerY - 120);

	// Profile image with circular mask
	push();
	drawingContext.save();
	drawingContext.beginPath();
	drawingContext.arc(centerX, centerY - 30, 50, 0, Math.PI * 2);
	drawingContext.closePath();
	drawingContext.clip();

	// Draw image maintaining aspect ratio, cropped to fill circle
	let circleDiameter = 100;
	let imgAspect = profileImg.width / profileImg.height;
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
	image(profileImg, centerX, centerY - 30, imgW, imgH);
	noTint();
	drawingContext.restore();
	pop();

	// Circle borders - black outer, white inner
	noFill();
	// Black outer border (subtle, matches background opacity)
	stroke(0, alpha * 0.33);
	strokeWeight(2);
	circle(centerX, centerY - 30, 104);
	// White inner border
	stroke(255, alpha);
	strokeWeight(2);
	circle(centerX, centerY - 30, 100);

	// Draw gradient background behind bio and email
	let bioW = 280;
	let bioH = 70;
	let bioX = centerX - bioW/2;
	let bioY = centerY + 40;
	drawGradientRect(bioX, bioY, bioW, bioH, 15, fadeAmount * 0.33);

	// Bio
	strokeWeight(1);
	fill(255, alpha);
	textSize(16);
	textAlign(CENTER);
	text("Creative Technologist", centerX, centerY + 60);

	// Contact info
	textSize(14);
	text("fisherdiede@icloud.com", centerX, centerY + 100);
}

// ==================== EVENT HANDLERS ====================
function windowResized() {
  	resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
	if (!showProfile && fadeAmount === 0) {
		let buttonBounds = getButtonBounds();
		if (isMouseOverButton(buttonBounds)) {
			fadeAmount = 0.01;
			return false;
		}
	}

	spawnMedia(mouseX, mouseY);
}

// ==================== IMAGE SPAWNING & AUDIO ====================
function spawnMedia(x, y) {
	// Block spawning if a video is currently playing
	if (videoIsPlaying) {
		console.log('Spawn blocked - video is playing');
		return;
	}

	// Check if both images and videos are loaded
	let canSpawnImage = imagesLoaded && spawnerImages.length > 0;
	let canSpawnVideo = videosLoaded && spawnerVideos.length > 0;

	if (!canSpawnImage && !canSpawnVideo) {
		console.log('Spawn blocked - no media loaded');
		return;
	}

	// Video can only spawn if at least MIN_IMAGES_BEFORE_VIDEO images have been spawned since last video
	let shouldConsiderVideo = canSpawnVideo && imagesSinceLastVideo >= MIN_IMAGES_BEFORE_VIDEO;

	if (shouldConsiderVideo) {
		// VIDEO_SPAWN_PROBABILITY chance to spawn video
		if (random() < VIDEO_SPAWN_PROBABILITY) {
			spawnVideo(x, y);
			imagesSinceLastVideo = 0; // Reset counter after spawning video
		} else {
			spawnImage(x, y);
			imagesSinceLastVideo++;
		}
	} else {
		// Always spawn image if video conditions not met
		spawnImage(x, y);
		imagesSinceLastVideo++;
	}
}

function spawnImage(x, y) {
	if (!imagesLoaded || spawnerImages.length === 0) {
		console.log('Spawn blocked - imagesLoaded:', imagesLoaded, 'spawnerImages.length:', spawnerImages.length);
		return;
	}

	// Get next image in shuffled order
	let imgIndex = imageOrder[currentImageIndex];
	currentImageIndex = (currentImageIndex + 1) % imageOrder.length;

	// Select random note from Eb major scale (avoid repeating the last note)
	let frequency;
	if (EB_MAJOR_NOTES.length > 1) {
		do {
			frequency = random(EB_MAJOR_NOTES);
		} while (frequency === lastPlayedNote);
	} else {
		frequency = random(EB_MAJOR_NOTES);
	}
	lastPlayedNote = frequency;

	// Create oscillator with lowpass filter
	// Use sine wave if profile is showing, sawtooth otherwise
	let oscType = showProfile ? 'sine' : 'sawtooth';
	let osc = new p5.Oscillator(oscType);
	let baseFrequency = frequency; // Store base frequency
	osc.freq(baseFrequency);
	osc.amp(0);

	// Create lowpass filter
	let filter = new p5.LowPass();
	osc.disconnect();
	osc.connect(filter);
	filter.freq(FILTER_CUTOFF_MAX);

	// Create stereo panner for spatial audio
	let audioContext = getAudioContext();
	let panner = audioContext.createStereoPanner();

	// Connect filter to outputs through panner
	filter.disconnect();
	filter.connect(panner);

	// Route through subtle reverb (always-on, outputs to master with dry/wet mix)
	panner.connect(subtleReverb.input);
	// Also connect to reverb bus for intense hover/profile effect
	panner.connect(reverbBus);

	osc.start();

	// Calculate frequency-based amplitude for perceptual balance
	let targetAmplitude = getAmplitudeForFrequency(baseFrequency);

	// Fade in
	osc.amp(targetAmplitude, AUDIO_FADE_IN_TIME);

	// Track oscillator and filter for effects with randomized vibrato parameters
	let oscData = {
		osc: osc,
		baseFreq: baseFrequency,
		filter: filter,
		panner: panner,
		amplitude: targetAmplitude, // Store frequency-adjusted amplitude
		vibratoRate: random(VIBRATO_RATE_MIN, VIBRATO_RATE_MAX),
		vibratoDepth: random(VIBRATO_DEPTH_MIN, VIBRATO_DEPTH_MAX),
		enableVibrato: !showProfile // Only enable vibrato for sawtooth oscillators (welcome screen)
	};
	activeOscillators.push(oscData);

	// Create img element
	let img = document.createElement('img');
	img.src = spawnerImages[imgIndex];
	img.style.position = 'absolute';
	img.style.left = x + 'px';
	img.style.top = y + 'px';
	img.style.maxWidth = random(SIZE_MIN, SIZE_MAX) + 'px';
	img.style.maxHeight = random(SIZE_MIN, SIZE_MAX) + 'px';
	img.style.objectFit = 'contain';
	img.style.pointerEvents = 'none';
	img.style.zIndex = '10';
	img.style.transform = 'translate(-50%, -50%)';
	img.style.transition = 'opacity 1s ease-out';

	document.body.appendChild(img);

	// Random movement
	let angle = random(TWO_PI);
	let speed = random(SPEED_MIN, SPEED_MAX);
	let vx = cos(angle) * speed;
	let vy = sin(angle) * speed;

	// Animate movement
	let startTime = Date.now();
	let animationFrame;
	let frameCounter = 0; // Throttle filter updates

	function animate() {
		let elapsed = (Date.now() - startTime) / 1000;
		frameCounter++;

		if (elapsed < ANIMATION_DURATION) {
			// Calculate mouse proximity for filter modulation
			// Only respond to cursor on welcome screen, not on profile screen
			if (!isTouchDevice && !isHoveringWelcome && !showProfile) {
				let centerX = windowWidth / 2;
				let centerY = windowHeight / 2;
				let d = dist(mouseX, mouseY, centerX, centerY);
				let maxDist = dist(0, 0, centerX, centerY);
				let normalizedDist = constrain(d / maxDist, 0, 1);

				// Apply exponential curve (inverse so closer = higher cutoff)
				let exponentialFactor = pow(1 - normalizedDist, 3);

				// Map cutoff from min (edges) to max (center)
				let cutoffFreq = FILTER_CUTOFF_MIN + (exponentialFactor * (FILTER_CUTOFF_MAX - FILTER_CUTOFF_MIN));
				filter.freq(cutoffFreq, FILTER_RAMP_TIME);
			}

			// Move
			let newX = x + vx * elapsed * 60;
			let newY = y + vy * elapsed * 60;
			img.style.left = newX + 'px';
			img.style.top = newY + 'px';

			// Update stereo panning based on position
			// Map x position to pan value: -1 (left) to 1 (right)
			let panValue = (newX / windowWidth) * 2 - 1;
			panValue = constrain(panValue, -1, 1);
			panner.pan.value = panValue;

			// Expand gradually
			let scale = 1 + (elapsed / ANIMATION_DURATION) * SCALE_GROWTH;
			img.style.transform = `translate(-50%, -50%) scale(${scale})`;

			// Fade out visuals and audio
			if (elapsed > FADE_START_TIME) {
				let fadeProgress = (elapsed - FADE_START_TIME) / (ANIMATION_DURATION - FADE_START_TIME);
				// Apply ease-in-ease-out curve (smoothstep)
				let easedProgress = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
				let opacity = 1 - easedProgress;
				img.style.opacity = opacity;

				// Sync audio fade with visual fade (throttled for performance)
				// Apply exponential curve for more natural-sounding audio fade
				if (frameCounter % AMPLITUDE_FADE_THROTTLE === 0) {
					let audioOpacity = pow(opacity, 2); // Exponential fade curve
					let audioAmp = oscData.amplitude * audioOpacity;
					osc.amp(audioAmp, AUDIO_FADE_OUT_TIME);
				}
			}

			animationFrame = requestAnimationFrame(animate);
		} else {
			// Remove element and stop audio
			document.body.removeChild(img);
			osc.amp(0, AUDIO_FADE_OUT_TIME);
			osc.stop(0.2);

			// Dispose of audio nodes to free resources
			filter.dispose();
			panner.disconnect();

			// Remove from active oscillators array
			let index = activeOscillators.findIndex(item => item.osc === osc);
			if (index !== -1) {
				activeOscillators.splice(index, 1);
			}

			cancelAnimationFrame(animationFrame);
		}
	}

	animate();
}

function spawnVideo(x, y) {
	if (!videosLoaded || spawnerVideos.length === 0) {
		console.log('Spawn blocked - videosLoaded:', videosLoaded, 'spawnerVideos.length:', spawnerVideos.length);
		return;
	}

	// Set flag to block other spawns while video is playing
	videoIsPlaying = true;

	// Get next video in shuffled order
	let videoIndex = videoOrder[currentVideoIndex];
	currentVideoIndex = (currentVideoIndex + 1) % videoOrder.length;

	// Select random note from Eb major scale (avoid repeating the last note)
	let frequency;
	if (EB_MAJOR_NOTES.length > 1) {
		do {
			frequency = random(EB_MAJOR_NOTES);
		} while (frequency === lastPlayedNote);
	} else {
		frequency = random(EB_MAJOR_NOTES);
	}
	lastPlayedNote = frequency;

	// Create oscillator with lowpass filter
	// Use sine wave if profile is showing, sawtooth otherwise
	let oscType = showProfile ? 'sine' : 'sawtooth';
	let osc = new p5.Oscillator(oscType);
	let baseFrequency = frequency; // Store base frequency
	osc.freq(baseFrequency);
	osc.amp(0);

	// Create lowpass filter
	let filter = new p5.LowPass();
	osc.disconnect();
	osc.connect(filter);
	filter.freq(FILTER_CUTOFF_MAX);

	// Create stereo panner for spatial audio
	let audioContext = getAudioContext();
	let panner = audioContext.createStereoPanner();

	// Connect filter to outputs through panner
	filter.disconnect();
	filter.connect(panner);

	// Route through subtle reverb (always-on, outputs to master with dry/wet mix)
	panner.connect(subtleReverb.input);
	// Also connect to reverb bus for intense hover/profile effect
	panner.connect(reverbBus);

	osc.start();

	// Calculate frequency-based amplitude for perceptual balance
	let targetAmplitude = getAmplitudeForFrequency(baseFrequency);

	// Fade in
	osc.amp(targetAmplitude, AUDIO_FADE_IN_TIME);

	// Track oscillator and filter for effects with randomized vibrato parameters
	let oscData = {
		osc: osc,
		baseFreq: baseFrequency,
		filter: filter,
		panner: panner,
		amplitude: targetAmplitude, // Store frequency-adjusted amplitude
		vibratoRate: random(VIBRATO_RATE_MIN, VIBRATO_RATE_MAX),
		vibratoDepth: random(VIBRATO_DEPTH_MIN, VIBRATO_DEPTH_MAX),
		enableVibrato: !showProfile // Only enable vibrato for sawtooth oscillators (welcome screen)
	};
	activeOscillators.push(oscData);

	// Create video element
	let video = document.createElement('video');
	video.src = spawnerVideos[videoIndex];
	video.style.position = 'absolute';
	video.style.left = x + 'px';
	video.style.top = y + 'px';
	video.style.maxWidth = SIZE_MAX + 'px';
	video.style.maxHeight = SIZE_MAX + 'px';
	video.style.objectFit = 'contain';
	video.style.pointerEvents = 'none';
	video.style.zIndex = '10';
	video.style.transform = 'translate(-50%, -50%)';
	video.style.transition = 'opacity 1s ease-out';
	video.autoplay = true;
	video.muted = true; // Mute video element, we'll play audio separately
	video.loop = false;
	video.playsInline = true; // For iOS compatibility

	// Adjust playback rate to stretch video to fill animation duration
	video.addEventListener('loadedmetadata', function() {
		video.playbackRate = video.duration / ANIMATION_DURATION;
	});

	document.body.appendChild(video);

	// Load and play audio separately at normal speed to avoid choppy playback
	let audioSource = null;
	let audioBuffer = null;

	// Initialize storage object for audio nodes
	let videoAudioNodes = {};

	// Fetch and decode audio from video file
	fetch(spawnerVideos[videoIndex])
		.then(response => response.arrayBuffer())
		.then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
		.then(buffer => {
			audioBuffer = buffer;

			// Create buffer source
			audioSource = audioContext.createBufferSource();
			audioSource.buffer = audioBuffer;

			// Create lowpass filter
			let videoFilter = audioContext.createBiquadFilter();
			videoFilter.type = 'lowpass';
			videoFilter.frequency.value = VIDEO_FILTER_FREQ;

			// Create reverb using p5.Reverb
			let videoReverb = new p5.Reverb();
			videoReverb.set(VIDEO_REVERB_DURATION, VIDEO_REVERB_DECAY);
			videoReverb.drywet(0.8); // 80% wet/dry mix for intense reverb

			// Create gain node for volume control (for fading)
			let videoGain = audioContext.createGain();
			videoGain.gain.value = 1.0;

			// Create stereo panner for spatial audio
			let videoPanner = audioContext.createStereoPanner();

			// Connect the chain: audioSource -> filter -> gain -> panner -> reverb -> output
			audioSource.connect(videoFilter);
			videoFilter.connect(videoGain);
			videoGain.connect(videoPanner);
			videoPanner.connect(videoReverb.input);

			// Store references for cleanup
			videoAudioNodes.source = audioSource;
			videoAudioNodes.filter = videoFilter;
			videoAudioNodes.reverb = videoReverb;
			videoAudioNodes.gain = videoGain;
			videoAudioNodes.panner = videoPanner;

			// Start audio playback
			audioSource.start();
		})
		.catch(err => {
			console.log('Error loading video audio:', err);
		});

	// Random movement
	let angle = random(TWO_PI);
	let speed = random(SPEED_MIN, SPEED_MAX);
	let vx = cos(angle) * speed;
	let vy = sin(angle) * speed;

	// Animate movement
	let startTime = Date.now();
	let animationFrame;
	let frameCounter = 0; // Throttle filter updates

	function animate() {
		let elapsed = (Date.now() - startTime) / 1000;
		frameCounter++;

		if (elapsed < ANIMATION_DURATION) {
			// Calculate mouse proximity for filter modulation
			// Only respond to cursor on welcome screen, not on profile screen
			if (!isTouchDevice && !isHoveringWelcome && !showProfile) {
				let centerX = windowWidth / 2;
				let centerY = windowHeight / 2;
				let d = dist(mouseX, mouseY, centerX, centerY);
				let maxDist = dist(0, 0, centerX, centerY);
				let normalizedDist = constrain(d / maxDist, 0, 1);

				// Apply exponential curve (inverse so closer = higher cutoff)
				let exponentialFactor = pow(1 - normalizedDist, 3);

				// Map cutoff from min (edges) to max (center)
				let cutoffFreq = FILTER_CUTOFF_MIN + (exponentialFactor * (FILTER_CUTOFF_MAX - FILTER_CUTOFF_MIN));
				filter.freq(cutoffFreq, FILTER_RAMP_TIME);
			}

			// Move
			let newX = x + vx * elapsed * 60;
			let newY = y + vy * elapsed * 60;
			video.style.left = newX + 'px';
			video.style.top = newY + 'px';

			// Update stereo panning based on position
			// Map x position to pan value: -1 (left) to 1 (right)
			if (videoAudioNodes.panner) {
				let panValue = (newX / windowWidth) * 2 - 1;
				panValue = constrain(panValue, -1, 1);
				videoAudioNodes.panner.pan.value = panValue;
			}

			// Expand gradually
			let scale = 1 + (elapsed / ANIMATION_DURATION) * SCALE_GROWTH;
			video.style.transform = `translate(-50%, -50%) scale(${scale})`;

			// Fade out visuals and audio
			if (elapsed > FADE_START_TIME) {
				let fadeProgress = (elapsed - FADE_START_TIME) / (ANIMATION_DURATION - FADE_START_TIME);
				// Apply ease-in-ease-out curve (smoothstep)
				let easedProgress = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
				let opacity = 1 - easedProgress;
				video.style.opacity = opacity;

				// Sync audio fade with visual fade (throttled for performance)
				// Apply exponential curve for more natural-sounding audio fade
				if (frameCounter % AMPLITUDE_FADE_THROTTLE === 0) {
					let audioOpacity = pow(opacity, 2); // Exponential fade curve
					let audioAmp = oscData.amplitude * audioOpacity;
					osc.amp(audioAmp, AUDIO_FADE_OUT_TIME);

					// Fade video audio only in the last VIDEO_AUDIO_FADE_DURATION seconds
					if (elapsed > ANIMATION_DURATION - VIDEO_AUDIO_FADE_DURATION) {
						let videoAudioOpacity = (ANIMATION_DURATION - elapsed) / VIDEO_AUDIO_FADE_DURATION;
						videoAudioOpacity = pow(videoAudioOpacity, 2); // Exponential fade curve
						if (videoAudioNodes.gain) {
							videoAudioNodes.gain.gain.value = videoAudioOpacity;
						}
					}
				}
			}

			animationFrame = requestAnimationFrame(animate);
		} else {
			// Remove element and stop audio
			document.body.removeChild(video);
			osc.amp(0, AUDIO_FADE_OUT_TIME);
			osc.stop(0.2);

			// Dispose of filter to free resources
			filter.dispose();

			// Clean up video audio nodes
			if (videoAudioNodes.source) {
				videoAudioNodes.source.stop();
				videoAudioNodes.source.disconnect();
			}
			if (videoAudioNodes.filter) {
				videoAudioNodes.filter.disconnect();
			}
			if (videoAudioNodes.gain) {
				videoAudioNodes.gain.disconnect();
			}
			if (videoAudioNodes.panner) {
				videoAudioNodes.panner.disconnect();
			}
			if (videoAudioNodes.reverb) {
				videoAudioNodes.reverb.dispose();
			}

			// Remove from active oscillators array
			let index = activeOscillators.findIndex(item => item.osc === osc);
			if (index !== -1) {
				activeOscillators.splice(index, 1);
			}

			// Reset flag to allow spawning again
			videoIsPlaying = false;

			cancelAnimationFrame(animationFrame);
		}
	}

	animate();
}
