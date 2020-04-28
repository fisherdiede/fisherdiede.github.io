var canvas;
let font;
let remoteImg;
let descriptionString = "Real News is an interactive and ever-evolving exploration of modern news media. through the familiar interface of an on-screen TV remote, the user is presented with random samples of recent American news programming. more interaction brings more news, and eventually the user may find clarity amid the clamorous coverage. coming soon.";
var remoteCoords = {"top":0, "bottom":0, "left":0, "right":0}

var titleString = "Real News"
var titleFontSize;

var numNews = 0

function preload() {
	remoteImg = loadImage('assets/img/remote.jpeg')
	font = loadFont('https://www.fontsquirrel.com/fonts/download/space-mono/SpaceMono-BoldItalic.ttf')
}

function setup() {	
	console.log("thesis setup")
	console.log(font)
	canvas = createCanvas(windowWidth, windowHeight);
	initUI()
}

function draw() {
	background(0);
	drawTitle();
	drawRemote();
	// drawDescription();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateTitleSize();

}

function initUI() {
	// textFont("Courier New");
	textAlign(CENTER);
	calculateTitleSize();
}

function calculateTitleSize() {
	titleFontSize = 400
	textSize(titleFontSize)
	console.log("calculating title font size")
	while(textWidth(titleString) >= windowWidth) {
		titleFontSize -= 1
		textSize(titleFontSize)
	}
	console.log("calculated: ", String(titleFontSize))
}

function drawTitle() {
	fill(255)
	textSize(titleFontSize)
	textAlign(CENTER);
	var titleRect = font.textBounds(titleString, 0, 0, titleFontSize)
	// text(titleString, -titleRect.x, -titleRect.y, titleRect.w, titleRect.h)
	text(titleString, 0, 0, windowWidth*1.25, titleFontSize*1.5)
}

function drawDescription() {
	fill(255)
	textSize(20)
	text(descriptionString, 10, 10, windowWidth-20, windowHeight-20)
}

function drawRemote() {
	var bottomPadding = 20

	var remoteHeight = windowHeight/3.0
	var remoteScale = remoteHeight/remoteImg.height
	var scaledWidth = remoteImg.width*remoteScale
	var scaledHeight = remoteImg.height*remoteScale

	remoteCoords["bottom"] =  windowHeight - bottomPadding
	remoteCoords["top"] = remoteCoords["bottom"] - scaledHeight
	remoteCoords["left"] = windowWidth/2 - scaledWidth/2
	remoteCoords["right"] = remoteCoords["left"] + scaledWidth

	image(remoteImg, remoteCoords["left"], remoteCoords["top"], scaledWidth, scaledHeight);
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

	if (mouseX >= remoteCoords["left"] && 
		mouseX <= remoteCoords["right"] &&
		mouseY >= remoteCoords["top"] &&
		mouseY <= remoteCoords["bottom"]) {
		numNews += 1
		console.log("remote clicks: ", String(numNews))
	}
	
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


