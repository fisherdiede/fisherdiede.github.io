var canvas;
let remoteImg;

function preload() {
	remoteImg = loadImage('assets/img/remote.jpeg')
}

function setup() {	
	console.log("thesis setup")
	canvas = createCanvas(windowWidth, windowHeight);
	initUI()
}

function draw() {
	background(0);
	
	drawRemote();

	fill(255);
	textFont("Courier New");
	textSize(24);
	textAlign(CENTER, CENTER);
	text("coming soon", 0, (windowHeight/3), windowWidth, 24)
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function initUI() {
	
}

function drawRemote() {
	var remoteHeight = windowHeight/3.0
	var remoteScale = remoteHeight/remoteImg.height
	var scaledWidth = remoteImg.width*remoteScale
	var scaledHeight = remoteImg.height*remoteScale
	image(remoteImg, windowWidth/2 - scaledWidth/2, windowHeight - scaledHeight - 5, scaledWidth, scaledHeight);
	
}

// window.onresize = function() {
// 	var w = windowWidth;
// 	var h = windowHeight;  
// 	canvas.size(w,h);
// 	width = w;
// 	height = h;
// };

function mousePressed() {
	// if (loadedCount == numTracks) {
	// 	if (isPlaying) {
	// 		resumeDur = millis() - startTime + resumeDur
	//    	pauseAudio()
	//    	background(255, 255, 255);
	//    	isPlaying = false;
	// 	} else {
	// 		startTime = millis() + 1000
	//    	playAudio()
	//    	background(0, 0, 0);
	//    	isPlaying = true;
	//    }
	// } else {
	// 	console.log("not all audio has loaded yet")
	// }
	

	// Check if mouse is inside the circle
	// let d = dist(mouseX, mouseY, width/2, height/2);
	// if (d < 100) {
	// 	// Pick new random color values
	// 	circleColor = colors[Math.random(colors.length)];
	// }
	
  	return false
}

function mouseWheel(event) {
	// if (mouseX > trackIndent) {
	// 	if (mouseX < trackWidth + trackIndent) {
	// 		var bin = int(mouseY/windowHeight * float(numFirstCol()))
	// 		updateVolume(bin, event.delta)
	// 	}
	// 	else if (mouseX < trackWidth*2 + trackIndent) {
	// 		var bin = int(mouseY/windowHeight * float(numSecondCol()))
	// 		updateVolume(numFirstCol()+bin, event.delta)    
	// 	}
	// }
	return false;
}


