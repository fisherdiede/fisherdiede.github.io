var canvas;
let titleFont;
let remoteImg;
let descriptionString = "an interactive and ever-evolving exploration of modern news media. through the familiar interface of an on-screen TV remote, the user is presented with random samples of recent American news programming. more interaction brings more news, and eventually the user may find clarity amid the clamorous coverage.";
var remoteCoords = {"top":0, "bottom":0, "left":0, "right":0}

var titleString = "Real News"
var titleFontSize = 0

let numNews = 0
let numRemoteClicks = 0
let numResets = 0

var fontLoaded = false
let urlQueryAppend = "&autoplay=1&controls=0&muted=1"
let urls = ["https://www.youtube.com/embed/xrAJuh9nM8w",
			"https://www.youtube.com/embed/2ZWtdFVU904",
			"https://www.youtube.com/embed/ROhR0FdMWdg",
			"https://www.youtube.com/embed/RWu3e4r1sXU",
			"https://www.youtube.com/embed/ug_Stzg_uis",
			"https://www.youtube.com/embed/qiHMU_t3CYU",
			"https://www.youtube.com/embed/a-wSArgKAR0",
			"https://www.youtube.com/embed/0Ac5u6hBkDA",
			"https://www.youtube.com/embed/Y0i6IK8wcAk"]

let videoStartRanges = [[22,2520],
						[0, 55],
						[0,12600],
						[0,3300],
						[25,3600],
						[0,20],
						[0,11820],
						[78,3300],
						[0,4]]

var vidIdxs = []
var vidIdxOrder = []

// let urls = ["https://www.youtube.com/embed/ROhR0FdMWdg", "https://www.youtube.com/embed/RWu3e4r1sXU"]
var player;

function preload() {
	console.log("preload")
	remoteImg = loadImage('assets/img/remote.png')
	titleFont = loadFont('assets/fonts/SpaceMono-Bold.ttf', fontCompletion)
}

function fontCompletion() {
	console.log("font completion")
	fontLoaded = true
}

function setup() {	
	console.log("thesis setup")
	canvas = createCanvas(windowWidth, windowHeight);
	randomizeVideoOrder();
	background(0)
}

function draw() {
	console.log("draw")
	if (numNews == 0) {
		background(0);
		if (fontLoaded) {
			drawTitle();
		}
	}
	drawRemote();	
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
	fill(255)
	textFont(titleFont)
	textAlign(LEFT);
	calculateTitleSize()
	textSize(titleFontSize)
	var titleRect = titleFont.textBounds(titleString, 0, 0, titleFontSize)
	text(titleString, 0, titleRect.y/2, windowWidth*1.5, titleFontSize*1.5)
	if (numResets == 0) {
		textSize(20)
		text(descriptionString, 10, titleRect.h+25 , windowWidth-20, windowHeight-titleRect.h+25)
	}
	// console.log(titleRect)
}


function drawRemote() {
	var bottomPadding = 20//windowHeight/2

	var remoteHeight = windowHeight/2.0
	var remoteScale = remoteHeight/remoteImg.height
	var scaledWidth = remoteImg.width*remoteScale
	var scaledHeight = remoteImg.height*remoteScale

	remoteCoords["bottom"] =  windowHeight - bottomPadding
	remoteCoords["top"] = remoteCoords["bottom"] - scaledHeight
	remoteCoords["left"] = windowWidth/2 - scaledWidth/2
	remoteCoords["right"] = remoteCoords["left"] + scaledWidth

	image(remoteImg, remoteCoords["left"], remoteCoords["top"], scaledWidth, scaledHeight);
}

function resetVideos() {
	console.log("resetting videos")
	for (var i = 0; i < numNews; i++) {
		let thisIdx = vidIdxOrder[i]
		var eltID = "yt_video" + String(thisIdx)
		
		document.getElementById(eltID).style.display = "none"
		document.getElementById(eltID).src = ""
	}
}

function randomizeVideoOrder() {
	for (var i = 0; i < urls.length; i++) {
		vidIdxs.push(i);
	}
	vidIdxOrder = []
	while(vidIdxOrder.length < urls.length) {
		var r = int(Math.random() * float(vidIdxs.length))
		vidIdxOrder.push(vidIdxs.splice(r, 1))
	}
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// window.onresize = function() {
// 	var w = windowWidth;
// 	var h = windowHeight;  
// 	canvas.size(w,h);
// 	width = w;
// 	height = h;
// };

function mousePressed() {
	if (mouseX >= remoteCoords["left"] && 
		mouseX <= remoteCoords["right"] &&
		mouseY >= remoteCoords["top"] &&
		mouseY <= remoteCoords["bottom"]) {
		numRemoteClicks += 1
		if ((Math.random() < Math.pow(0.5, numResets+1)) && numNews > 0) {
			resetVideos()
			randomizeVideoOrder()
			numNews = 0
			numResets += 1
			sleep(2000)
		} else if (numNews < urls.length) {
			let thisIdx = vidIdxOrder[numNews]
			var eltID = "yt_video" + String(thisIdx)
			
			document.getElementById(eltID).style.display = "block";
			let vidStartTime = getRandomInt(videoStartRanges[thisIdx][0],videoStartRanges[thisIdx][1])
			let theSrc = urls[thisIdx] + "?start=" + String(vidStartTime) + urlQueryAppend
			console.log("queueing: ", theSrc);
			document.getElementById(eltID).src = theSrc
			
			numNews += 1

			if (numNews == 1) {
				canvas = createCanvas(windowWidth, windowHeight);
				document.getElementById(eltID).style.opacity = "100%"
				document.getElementById(eltID).style.zIndex = "-2"
			} else {
				document.getElementById(eltID).style.zIndex = "-1"
				adjustOpacity();
			}
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


