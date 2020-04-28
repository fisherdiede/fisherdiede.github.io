var canvas;
let titleFont;
let remoteImg;
let descriptionString = "Real News is an interactive and ever-evolving exploration of modern news media. through the familiar interface of an on-screen TV remote, the user is presented with random samples of recent American news programming. more interaction brings more news, and eventually the user may find clarity amid the clamorous coverage. coming soon.";
var remoteCoords = {"top":0, "bottom":0, "left":0, "right":0}

var titleString = "Real News"
var titleFontSize = 0

let numNews = 0
var fontLoaded = false
let urlQueryAppend = "&autoplay=1&controls=0"
let urls = ["https://www.youtube.com/embed/xrAJuh9nM8w?start=22",
			"https://www.youtube.com/embed/2ZWtdFVU904?start=55",
			"https://www.youtube.com/embed/ROhR0FdMWdg?start=0",
			"https://www.youtube.com/embed/RWu3e4r1sXU?start=0",
			"https://www.youtube.com/embed/ug_Stzg_uis?start=25",
			"https://www.youtube.com/embed/qiHMU_t3CYU?start=0",
			"https://www.youtube.com/embed/a-wSArgKAR0?start=0",
			"https://www.youtube.com/embed/DoAvLnh0sEo?start=0",
			"https://www.youtube.com/embed/0Ac5u6hBkDA?start=0",
			"https://www.youtube.com/embed/Y0i6IK8wcAk?start=0"]

var vidIdxs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
var vidIdxOrder = []

// let urls = ["https://www.youtube.com/embed/ROhR0FdMWdg", "https://www.youtube.com/embed/RWu3e4r1sXU"]
var player;

function preload() {
	console.log("preload")
	remoteImg = loadImage('assets/img/remote.jpeg')
	titleFont = loadFont('assets/fonts/SpaceMono-Bold.ttf', fontCompletion)
}

function fontCompletion() {
	console.log("font completion")
	fontLoaded = true
}

function setup() {	
	console.log("thesis setup")
	canvas = createCanvas(windowWidth, windowHeight);

	while(vidIdxOrder.length < urls.length) {
		var r = int(Math.random() * float(vidIdxs.length))
		vidIdxOrder.push(vidIdxs.splice(r, 1))
	}
}

function draw() {
	console.log("draw")
	if (fontLoaded && numNews == 0) {
		// fill("#000000")
		// rect(0,0,windowWidth, windowHeight)
		// drawTitle();
	} else {
		// fill("FF0000", 0)
		// rect(0,0,windowWidth, windowHeight)
	}
	drawRemote();
	// drawDescription();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function calculateTitleSize() {
	titleFontSize = 400.0
	textSize(titleFontSize)
	while(textWidth(titleString) >= windowWidth) {
		titleFontSize -= 1
		textSize(titleFontSize)
	}
}

function drawTitle() {
	calculateTitleSize()
	textSize(titleFontSize)
	fill(0)
	textFont(titleFont)
	textAlign(LEFT);
	var titleRect = titleFont.textBounds(titleString, 0, 0, titleFontSize)
	// text(titleString, -titleRect.x, -titleRect.y, windowWidth*1.25, titleFontSize*2)
	text(titleString, 0, titleRect.y/2, windowWidth*1.5, titleFontSize*1.5)
	// console.log(titleRect)
}

function drawDescription() {
	fill(255)
	textSize(20)
	text(descriptionString, 10, 10, windowWidth-20, windowHeight-20)
}

function drawRemote() {
	var bottomPadding = 20//windowHeight/2

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
		if (numNews < urls.length) {
			let thisIdx = vidIdxOrder[numNews]
			var eltID = "yt_video" + String(thisIdx)
			
			document.getElementById(eltID).style.display = "block";
			
			let theSrc = urls[thisIdx] + urlQueryAppend
			console.log("queueing: ", theSrc);
			document.getElementById(eltID).src = theSrc
			
			numNews += 1

			if (numNews == 1) {
				document.getElementById(eltID).style.opacity = "100%"
				document.getElementById(eltID).style.zIndex = "-2"
			} else {
				document.getElementById(eltID).style.zIndex = "-1"
				adjustOpacity();
			}

			// document.getElementById("yt_video").position = 
			// player = select("#yt_video");
			// player.attribute('src', urls[numNews]);
			// player.position(0,0);
			
			
			console.log("remote clicks: ", String(numNews))
		}
		
	}
	
  	return false
}

function adjustOpacity() {
	var opacityValue = 1.0/numNews
	console.log(opacityValue)
	for (var i = 0; i < numNews; i++) {
		var eltID = "yt_video" + String(vidIdxOrder[i])
		document.getElementById(eltID).style.opacity = opacityValue
	}
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


//	https://www.youtube.com/embed/ROhR0FdMWdg"
//	https://www.youtube.com/watch?v=ROhR0FdMWdg"


