var canvas;
var showProfile = false;
var fadeAmount = 0;
var profileImg;
var spawnerImages = [];
var imageOrder = [];
var currentImageIndex = 0;
var imagesLoaded = false;
var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Animation settings
var ANIMATION_DURATION = 8; // Total animation time in seconds
var FADE_START_TIME = 4; // When to start fading out
var SCALE_GROWTH = 1.5; // How much to grow (1 = no growth, 2 = double size)
var SPEED_MIN = 0.05;
var SPEED_MAX = 0.4;
var SIZE_MIN = 100;
var SIZE_MAX = 200;

function setup() {
	console.log("homepage setup");
	canvas = createCanvas(windowWidth, windowHeight);
	canvas.position(0, 0);
	canvas.style('z-index', '100');

	// Load profile image
	profileImg = loadImage('assets/img/fisher_diede_portrait.jpeg');

	// Load spawner images from manifest
	loadStrings('assets/img/spawner/manifest.txt', onManifestLoaded);
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
		let brightness = exponentialFactor * 255;

		return brightness * (1 - fadeAmount);
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

	// Use hover appearance for touch devices or when hovering
	let useHoverAppearance = isTouchDevice || isHovering;

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
	if (!imagesLoaded || spawnerImages.length === 0) return;

	// Get next image in shuffled order
	let imgIndex = imageOrder[currentImageIndex];
	currentImageIndex = (currentImageIndex + 1) % imageOrder.length;

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

	function animate() {
		let elapsed = (Date.now() - startTime) / 1000;

		if (elapsed < ANIMATION_DURATION) {
			// Move
			let newX = x + vx * elapsed * 60;
			let newY = y + vy * elapsed * 60;
			img.style.left = newX + 'px';
			img.style.top = newY + 'px';

			// Expand gradually
			let scale = 1 + (elapsed / ANIMATION_DURATION) * SCALE_GROWTH;
			img.style.transform = `translate(-50%, -50%) scale(${scale})`;

			// Fade out in last second
			if (elapsed > FADE_START_TIME) {
				img.style.opacity = 1 - (elapsed - FADE_START_TIME) / (ANIMATION_DURATION - FADE_START_TIME);
			}

			animationFrame = requestAnimationFrame(animate);
		} else {
			// Remove element
			document.body.removeChild(img);
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