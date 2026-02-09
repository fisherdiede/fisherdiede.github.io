var canvas;
var showProfile = false;
var fadeAmount = 0;
var profileImg;
var spawnerImages = [];
var imageOrder = [];
var currentImageIndex = 0;
var imagesLoaded = false;
var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
var wasHovering = false;
var isHoveringWelcome = false; // Track if hovering over welcome button
var lastPlayedNote = -1;
var activeOscillators = []; // Track all active oscillators for vibrato effect
var reverb; // Global reverb effect
var reverbBus; // Reverb bus/aux send
var audioUpdateCounter = 0; // Throttle audio updates

// Animation settings
var ANIMATION_DURATION = 10; // Total animation time in seconds
var FADE_START_TIME = 4; // When to start fading out
var SCALE_GROWTH = 2; // How much to grow (1 = no growth, 2 = double size)
var SPEED_MIN = 0.05;
var SPEED_MAX = 0.1;
var SIZE_MIN = 100;
var SIZE_MAX = 200;

// Audio settings
var ENABLE_VIBRATO = true; // Set to true to enable vibrato effect on hover
var VIBRATO_RATE_MIN = 0.5; // Hz - minimum vibrato speed
var VIBRATO_RATE_MAX = 10; // Hz - maximum vibrato speed
var VIBRATO_DEPTH_MIN = 0.25; // Hz - minimum vibrato amount
var VIBRATO_DEPTH_MAX = 1.5; // Hz - maximum vibrato amount
var FILTER_CUTOFF_MIN = 1000; // Hz - filter cutoff at screen edges
var FILTER_CUTOFF_MAX = 12000; // Hz - filter cutoff at screen center
var REVERB_FADE_TIME = 0.0; // seconds - fade time for reverb bus send
var REVERB_DURATION = 6; // seconds - reverb duration
var REVERB_DECAY = 3; // decay rate (higher = more intense)
var REVERB_DRYWET = 1; // 0 = fully dry, 1 = fully wet

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

function setup() {
	console.log("homepage setup");
	canvas = createCanvas(windowWidth, windowHeight);
	canvas.position(0, 0);
	canvas.style('z-index', '100');

	// Load profile image
	profileImg = loadImage('assets/img/fisher_diede_portrait.jpeg');

	// Load spawner images from manifest
	loadStrings('assets/img/spawner/manifest.txt', onManifestLoaded);

	// Initialize reverb bus and effect
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

function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function draw() {
	clear();

	if (!showProfile) {
		drawWelcomeScreen();
	} else {
		drawProfileScreen();
	}
}

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

function drawCheckerboard() {
	let squareSize = 7;

	noStroke();
	for (let x = 0; x < windowWidth; x += squareSize) {
		for (let y = 0; y < windowHeight; y += squareSize) {
			// Alternate between black and transparent
			if ((x / squareSize + y / squareSize) % 2 === 0) {
				fill(0, 84);
				rect(x, y, squareSize, squareSize);
			}
		}
	}
}

function drawWelcomeScreen() {
	let centerX = windowWidth / 2;
	let centerY = windowHeight / 2;
	let brightness = calculateWelcomeBrightness();

	// Calculate button bounds
	let rectW = 200;
	let rectH = 60;
	let rectX = centerX - rectW/2;
	let rectY = centerY - rectH/2;

	// Check if mouse is hovering over button
	let isHovering = !isTouchDevice &&
		mouseX > rectX && mouseX < rectX + rectW &&
		mouseY > rectY && mouseY < rectY + rectH;

	isHoveringWelcome = isHovering; // Update global hover state

	// Throttle audio updates to every 3rd frame for better performance
	audioUpdateCounter++;
	let shouldUpdateAudio = audioUpdateCounter % 3 === 0;

	// Apply vibrato and reverb when hovering
	if (isHovering && !showProfile) {
		// Vibrato effect (if enabled) - throttled for performance
		if (ENABLE_VIBRATO && shouldUpdateAudio) {
			for (let oscData of activeOscillators) {
				let lfo = sin(frameCount * 0.1 * oscData.vibratoRate) * oscData.vibratoDepth;
				oscData.osc.freq(oscData.baseFreq + lfo, 0.1);
			}
		}

		// Hold filter at maximum cutoff - only on hover state change
		if (!wasHovering) {
			for (let oscData of activeOscillators) {
				oscData.filter.freq(FILTER_CUTOFF_MAX, 0.2);
			}
		}

		// Activate reverb bus send
		reverbBus.amp(1, REVERB_FADE_TIME);
	} else {
		// Reset to base frequency when not hovering - only on state change
		if (ENABLE_VIBRATO && wasHovering) {
			for (let oscData of activeOscillators) {
				oscData.osc.freq(oscData.baseFreq, 0.2);
			}
		}

		// Deactivate reverb bus send
		reverbBus.amp(0, REVERB_FADE_TIME);
	}

	// Update wasHovering state after processing
	wasHovering = isHovering;

	// Use hover appearance for touch devices or when hovering
	let useHoverAppearance = isTouchDevice || isHovering;

	// Draw checkerboard behind button on hover
	if (isHovering) {
		drawCheckerboard();
	}

	// Draw background for button (dark grey and opaque on hover/touch, black with brightness opacity otherwise)
	if (useHoverAppearance) {
		fill(15, 255);
	} else {
		fill(0, brightness);
	}
	noStroke();
	rect(rectX, rectY, rectW, rectH, 10);

	// Draw rounded rectangle border
	noFill();
	if (useHoverAppearance) {
		stroke(255);
	} else {
		stroke(Math.floor(brightness));
	}
	strokeWeight(2);
	rect(rectX, rectY, rectW, rectH, 10);

	// Draw welcome text
	if (useHoverAppearance) {
		fill(255);
	} else {
		fill(Math.floor(brightness));
	}
	noStroke();
	textFont("Courier New");
	textSize(24);
	textAlign(CENTER, CENTER);
	text("welcome", centerX, centerY);

	// Animate fade
	if (fadeAmount > 0) {
		fadeAmount += 0.05;
		if (fadeAmount >= 1) {
			showProfile = true;
			fadeAmount = 0;
		}
	}
}

function drawProfileScreen() {
	isHoveringWelcome = false; // Reset hover state when profile is showing
	fadeAmount = min(fadeAmount + 0.05, 1);
	let alpha = 255 * fadeAmount;

	let centerX = windowWidth / 2;
	let centerY = windowHeight / 2;

	// Draw black background behind name
	fill(0, alpha * 0.2);
	noStroke();
	let nameW = 280;
	let nameH = 50;
	let nameX = centerX - nameW/2;
	let nameY = centerY - 145;
	rect(nameX, nameY, nameW, nameH, 15);

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

	// Circle border
	noFill();
	stroke(255, alpha);
	strokeWeight(2);
	circle(centerX, centerY - 30, 100);

	// Draw black background behind bio and email
	fill(0, alpha * 0.2);
	noStroke();
	let bioW = 280;
	let bioH = 70;
	let bioX = centerX - bioW/2;
	let bioY = centerY + 40;
	rect(bioX, bioY, bioW, bioH, 15);

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

function windowResized() {
  	resizeCanvas(windowWidth, windowHeight);
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
	filter.freq(FILTER_CUTOFF_MIN); // Start with cutoff at minimum

	// Connect filter to main output and reverb bus
	filter.connect(); // Main output (dry signal)
	filter.connect(reverbBus); // Reverb bus (wet signal)

	osc.start();

	// Fade in quickly
	osc.amp(0.3, 0.1);

	// Track oscillator and filter for effects with randomized vibrato parameters
	let oscData = {
		osc: osc,
		baseFreq: baseFrequency,
		filter: filter,
		vibratoRate: random(VIBRATO_RATE_MIN, VIBRATO_RATE_MAX),
		vibratoDepth: random(VIBRATO_DEPTH_MIN, VIBRATO_DEPTH_MAX)
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
			// Calculate mouse proximity for filter modulation (throttled to every 5th frame)
			if (!isTouchDevice && !isHoveringWelcome && frameCounter % 5 === 0) {
				let centerX = windowWidth / 2;
				let centerY = windowHeight / 2;
				let d = dist(mouseX, mouseY, centerX, centerY);
				let maxDist = dist(0, 0, centerX, centerY);
				let normalizedDist = constrain(d / maxDist, 0, 1);

				// Apply subtle exponential curve (inverse so closer = higher cutoff)
				let exponentialFactor = pow(1 - normalizedDist, 3);

				// Map cutoff from min (edges) to max (center)
				let cutoffFreq = FILTER_CUTOFF_MIN + (exponentialFactor * (FILTER_CUTOFF_MAX - FILTER_CUTOFF_MIN));
				filter.freq(cutoffFreq, 0.15); // Longer ramp for smoothness
			}

			// Move
			let newX = x + vx * elapsed * 60;
			let newY = y + vy * elapsed * 60;
			img.style.left = newX + 'px';
			img.style.top = newY + 'px';

			// Expand gradually
			let scale = 1 + (elapsed / ANIMATION_DURATION) * SCALE_GROWTH;
			img.style.transform = `translate(-50%, -50%) scale(${scale})`;

			// Fade out visuals and audio
			if (elapsed > FADE_START_TIME) {
				let opacity = 1 - (elapsed - FADE_START_TIME) / (ANIMATION_DURATION - FADE_START_TIME);
				img.style.opacity = opacity;

				// Sync audio fade with visual fade (throttled to every 3rd frame)
				if (frameCounter % 3 === 0) {
					let audioAmp = 0.3 * opacity;
					osc.amp(audioAmp, 0.1); // Longer ramp for smoothness
				}
			}

			animationFrame = requestAnimationFrame(animate);
		} else {
			// Remove element and stop audio
			document.body.removeChild(img);
			osc.amp(0, 0.1);
			osc.stop(0.2);

			// Dispose of filter to free resources
			filter.dispose();

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

function mousePressed() {
	if (!showProfile && fadeAmount === 0) {
		let centerX = windowWidth / 2;
		let centerY = windowHeight / 2;
		let rectW = 200;
		let rectH = 60;
		let rectX = centerX - rectW/2;
		let rectY = centerY - rectH/2;

		if (mouseX > rectX && mouseX < rectX + rectW &&
		    mouseY > rectY && mouseY < rectY + rectH) {
			fadeAmount = 0.01;
			return false;
		}
	}

	spawnImage(mouseX, mouseY);
}
