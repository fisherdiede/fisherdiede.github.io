var canvas;
let titleFont;
let remoteImg;
let descriptionString = "an interactive and ever-evolving exploration of modern news media. through the familiar interface of an on-screen TV remote, the user is presented with random samples of recent American news programming. more interaction brings more news, and eventually the user may find clarity amid the clamorous coverage.";
var remoteCoords = {"top":0, "bottom":0, "left":0, "right":0}

var titleString = "RealNews"
var titleFontSize = 0

let numNews = 0
let numRemoteClicks = 0
let numResets = 0

var fontLoaded = false
let urlBase = "https://www.youtube.com/embed/"
let urlQueryAppend = "&autoplay=1&controls=0&muted=1"

let mobile = false

let urls = ["xrAJuh9nM8w", //04.28.2020 President Trump on small business support amid coronavirus | USA TODAY
			"2ZWtdFVU904", //02.27.2020 Trump Gives 'Incoherent' Briefing On Coronavirus, Contradicts CDC - Day That Was | Rachel Maddow - MSNBC
			"ROhR0FdMWdg", //04.28.2020 Watch Full Coronavirus Coverage - April 28 | NBC News Now
			"RWu3e4r1sXU", //04.28.2020 Live: California Gov. Newsom Holds Coronavirus Briefing | NBC News
			"ug_Stzg_uis", //04.28.2020 Coronavirus News: The latest on the covid-19 virus
			"qiHMU_t3CYU", //04.28.2020 Cuomo Talks New York's Decreasing Coronavirus Numbers, Deaths: 'We Want To Reopen' | MSNBC
			"a-wSArgKAR0", //04.28.2020 Watch live coronavirus coverage from CBS News
			"0Ac5u6hBkDA", //04.28.2020 Gov. Andy Beshear April 28 5:00 pm Update | Coronavirus | KET
			"Y0i6IK8wcAk", //03.19.2020 Sebastian Gorka: The globalists, the Deep State, and the Coronavirus. With Breitbart's Matt Boyle
			"OY4xSz6yCMk", //04.28.2020 ER Doctors Reveal Disturbing COVID Truths Media Won’t Tell You | LevinTV
			"yz3hCMmgHxA", //01.31.2020 LOL: CNN's WORST Article On The Coronavirus Task Force | Ben Shapiro - Daily Wire
			"D8iPCTlzhuI", //04.29.2020 The U.S. Hits One Million Cases of Coronavirus | The Daily Social Distancing Show
			"H_MdykTbKT0", //04.28.2020 Coronavirus outbreak: B.C. confirms 55 new COVID-19 cases, 2 deaths
			"_W3S00O_jQ0", //04.09.2020 Free Speech Project: Confronting Viral Disinformation
			"FVIGhz3uwuQ", //04.01.2020 Coronavirus is not the flu. It's worse. | Vox
			"O-3Mlj3MQ_Q", //04.28.2020 How coronavirus charts can mislead us
			"Wj48q6j-Aa0", //04.30.2020 Economist Thomas Piketty: Coronavirus Pandemic Has Exposed the “Violence of Social Inequality"
			"yw0FYtqZte0", //04.30.2020 WHO Adviser on Meat Plants: If We’re at War, the Weapons We Need Are Tests and PPE, Not Pork
			"WJDydq4IRY4", //04.20.2020 WHITE HOUSE LIVE | New York Post
			"7dZL9rotsp0", //04.30.2020 Gov Cuomo Live | New York Post
			"aSsPN-a7jgQ", //04.30.2020 CBN NewsWatch PM
			"i5XFr77nm2c", //04.30.2020 CBN NewsWatch AM
			"sPrbGU0Wyh4", //04.28.2020 Tucker: Big Tech censors dissent over coronavirus lockdowns
			"XQJVBuYJ34M", //04.28.2020 Trump, Ivanka discuss supporting small businesses with government loans
			"VreJQCDQpb8", //04.27.2020 Sen. Graham has an urgent message for Dems regarding China
			"9ZUc1E_82YE", //04.27.2020 Steve Hilton: End the shutdown and save lives now
			"KPuunZliFWQ", //04.28.2020 One Reason Why The Coronavirus Is Good At Spreading | Short Wave | NPR
			"M3kDXuzTFwc", //04.24.2020 What It Takes To Get Masks | Planet Money | NPR
			"l8dT_jlP368", //04.23.2020 Six Tips For Safe Grocery Shopping During A Pandemic | Life Kit | NPR
			"f_Ej5XjYZqg", //04.11.2020 How The U.S. Is Dealing With A Medical Supply Shortage | NPR
			"4S3DXXtRZZg", //04.29.2020 How the Coronavirus Hijacks Your Cells | Bloomberg
			"iwomkOxHrVc", //04.24.2020 Why U.S. Hospitals are in Critical Condition | Bloomberg
			"MKfwPy3tR9o", //04.29.2020 White House roundtable on "Opening Up American Again" | USA TODAY
			"LF4Ieu4qO-0", //04.27.2020 Homelessness amongst the COVID-19 pandemic | Coronavirus Chronicles
			"OAtALdbLrBk", //04.30.2020 Covid-19 Treatment Hopes, Aerospace Survival Plans | WSJ
			"U-A-jo2r6KI", //04.27.2020 A Day In the Life of a Doctor Treating Chicago’s Homeless | WSJ
			"GvCcIMbFXCg", //04.29.2020 Respiratory Expert Says We're Leaving A Critical Tool Unused In Coronavirus Fight
			"0mYexxl9onA", //04.28.2020 Texas Sheriff Slams States That Released Inmates Over Coronavirus Concerns
			"YJI5JuUxDxI", //04.28.2020 GOP Strategist On Trump’s Big Reopening Plan
			"t1Kxcw65ioc", //04.26.2020 Dan Crewnshaw On Reopening America And PC Culture
			"cVyy8lzY76U", //04.26.2020 Jacobin Radio: Coronavirus; Warehouse Organizing
			"tUsSf0zKkF8", //04.30.2020 The Brief, with Markos Moulitsas: Episode 1
			"O9oqItV8FB8", //04.28.2020 Mehdi Hasan and Rev. Dr. William Barber II on Bailing Out People, Not Corporations
			"MaUoeVt5bHg", //04.29.2020 Trump's 100 Days of Deadly Coronavirus Denial
			"9xoirHfDgGE", //04.03.2020 Exclusive: Sen. Warren Untangles the Trillions at Stake with Coronavirus Bailout
			]

let videoStartRanges = [[22,2520],
						[0, 55],
						[0,12600],
						[0,3300],
						[25,3600],
						[0,20],
						[0,11820],
						[78,3300],
						[0,4],
						[0,20],
						[0,7],
						[0,11],
						[29,2040],
						[0,2820],
						[0,26],
						[0,23],
						[0,1020],
						[0,100],
						[0,6600],
						[0,3000],
						[0,1080],
						[0,1080],
						[0,300],
						[45,2520],
						[0,240],
						[0,60],
						[0,5],
						[0,14],
						[0,15],
						[0,20],
						[0,60],
						[0,180],
						[0,60],
						[0,30],
						[0,30],
						[0,60],
						[0,180],
						[0,180],
						[0,180],
						[30,1080],
						[0,2760],
						[15,900],
						[0,1200],
						[0,60],
						[0,660],
						]

var vidIdxs = []
var vidIdxOrder = []

// let urls = ["https://www.youtube.com/embed/ROhR0FdMWdg", "https://www.youtube.com/embed/RWu3e4r1sXU"]
var player;

let offSample;

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
	offSample = loadSound('assets/audio/tv_off.wav');
	background(0)
	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
 		mobile = true
 		console.log("on mobile")
	} else {
		mobile = false
		console.log("not on mobile")
	}
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
	while(textWidth(titleString) >= windowWidth + titleFontSize/6) {
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
	text(titleString, -titleFontSize/16, titleRect.y/2 - titleFontSize/16, windowWidth*1.5, titleFontSize*1.5)
	if (numResets == 0) {
		textAlign(CENTER);
		textSize(20)
		text(descriptionString, 0, titleRect.h+20 , windowWidth, windowHeight-titleRect.h+25)
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
	// for (var i = 0; i < numNews; i++) {
	// 	let thisIdx = vidIdxOrder[i]
	// 	var eltID = "yt_video" + String(thisIdx)
		
	// 	document.getElementById(eltID).style.display = "none"
	// 	document.getElementById(eltID).src = ""
	// }
	var videos = document.getElementById("videos");
	videos.innerHTML = ""
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
	if (!mobile) {
		if (mouseX >= remoteCoords["left"] && 
			mouseX <= remoteCoords["right"] &&
			mouseY >= remoteCoords["top"] &&
			mouseY <= remoteCoords["bottom"]) {
			numRemoteClicks += 1
			if ((Math.random() < Math.pow(0.5, numResets)) && numNews > 0) {
				resetVideos()
				randomizeVideoOrder()
				numNews = 0
				numResets += 1
				offSample.play()
				sleep(3000)
			} else if (numNews < urls.length) {
				spawnVideo()
				numNews++
			}
		}
	}
	
  	return false
}

function adjustOpacity() {
	var opacityValue = 1.0/(numNews+1)
	console.log(opacityValue)
	for (var i = 0; i < numNews; i++) {
		var eltID = "video" + String(vidIdxOrder[i])
		document.getElementById(eltID).style.opacity = opacityValue
	}
}

function spawnVideo() {
	var newElt = document.createElement("iframe");

	let thisIdx = vidIdxOrder[numNews]
	var eltID = "video" + String(thisIdx)
	newElt.id = eltID
	let vidStartTime = getRandomInt(videoStartRanges[thisIdx][0],videoStartRanges[thisIdx][1])
	let videoSrc = urlBase + urls[thisIdx] + "?start=" + String(vidStartTime) + urlQueryAppend
	newElt.setAttribute("src", videoSrc);
	console.log("queueing: ", newElt.src);

	// newElt.style.width = 
	newElt.style.cssText = "position: fixed; display: block; width: 100%; height: 100%; top: 0; left: 0;right: 0; bottom: 0; background-color: rgba(0,0,0,0); "

	var videos = document.getElementById("videos");
	// var template = "<iframe id=\"" + eltID + "\" style=\"" + styleString + "\" allow=\"autoplay\" src=\"" + videoSrc +  "\"></iframe>"	
	videos.appendChild(newElt);

	if (numNews == 0) {
		canvas = createCanvas(windowWidth, windowHeight);
		newElt.style.cssText += "opacity: 100%; "
		newElt.style.cssText += "z-index: -2; "
	} else {
		newElt.style.cssText += "opacity: " + String(100.0/(numNews+1)) + "%; "
		newElt.style.cssText += "z-index: -1; "
		// adjustOpacity();
	}

	
	// let thisIdx = vidIdxOrder[numNews]
	// var eltID = "video" + String(thisIdx)
	
	// let vidStartTime = getRandomInt(videoStartRanges[thisIdx][0],videoStartRanges[thisIdx][1])
	// let videoSrc = urlBase + urls[thisIdx] + "?start=" + String(vidStartTime) + urlQueryAppend
	// console.log("queueing: ", videoSrc);

	// var styleString = "position: fixed; display: block; width: 100%; height: 100%; top: 0; left: 0;right: 0; bottom: 0; background-color: rgba(0,0,0,0); "
	// // elt.style.cssText =
	// if (numNews == 0) {
	// 	canvas = createCanvas(windowWidth, windowHeight);
	// 	styleString += "opacity: 100%; "
	// 	styleString += "z-index: -2; "
	// } else {
	// 	styleString += "z-index: -1; "
	// 	adjustOpacity();
	// }
	
	// var videos = document.getElementById("videos");
	// var template = "<iframe id=\"" + eltID + "\" style=\"" + styleString + "\" allow=\"autoplay\" src=\"" + videoSrc +  "\"></iframe>"
	// console.log("template:\n", template)
	// videos.innerHTML = videos.innerHTML + template;
	// console.log("inner:\n", videos.innerHTML)
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


