var canvas
let titleFont
let remoteImg
let descriptionString = "an interactive exploration of the most popular live American news media"
var remoteCoords = {"top":0, "bottom":0, "left":0, "right":0}

var titleString = "RealNews"
var titleFontSize = 0

let numNews = 0
let numRemoteClicks = 0
let numResets = 0

var fontLoaded = false
let urlBase = "https://www.youtube.com/embed/"
let urlQueryAppend = "?&autoplay=1&controls=0"

let mobile = false
let urls

var vidIdxs = []
var vidIdxOrder = []

var player

let offSample

function preload() {
	remoteImg = loadImage('assets/img/remote.png')
	titleFont = loadFont('assets/fonts/SpaceMono-Bold.ttf', fontCompletion)
}

function fontCompletion() {
	fontLoaded = true
}

function setup() {	
	canvas = createCanvas(windowWidth, windowHeight)
	gapi.load("client", loadClient);

	offSample = loadSound('assets/audio/tv_off.wav')
	background(0)
	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
 		mobile = true
 		descriptionString += "\n\n\nthis experience is not currently supported on mobile devices"
	} else {
		mobile = false
	}
}

function loadClient() {
    gapi.client.setApiKey("AIzaSyBFgigQ_DV4-78tEUUmsRwSB-bM7jrhSk8");
    return gapi.client.load("https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest")
        .then(function() {
        	console.log("GAPI client loaded for API");
        	fetchVideoURLS()
         }, function(err) { console.error("Error loading GAPI client for API", err); });
}
 
// Make sure the client is loaded before calling this method.
function fetchVideoURLS() {
    var arr_search = {
        "part": 'snippet',
        "type": 'video',
        "eventType": 'live',
        // "order": 'viewCount',
        "order": 'relevance',
        "maxResults": '25',
        "q": 'coronavirus',
        "regionCode": 'US',
        // "relevanceLanguage": 'EN',
        "videoCategoryId": '25', //News & Politics
        "videoEmbeddable": 'true'
    };
 
    return gapi.client.youtube.search.list(arr_search)
    .then(function(response) {
        // Handle the results here (response.result has the parsed body).
        const listItems = response.result.items;
        if (listItems) {
            urls = []
 
            listItems.forEach(item => {
                const videoId = item.id.videoId;
                const videoTitle = item.snippet.title;
                urls.push(videoId)
            });
        }
        // console.log("fetched:")
        // console.log(urls)
        randomizeVideoOrder()
    },
    function(err) { console.error("Execute error", err); });
}

function draw() {
	if (numNews == 0) {
		background(0)
		if (fontLoaded) {
			drawTitle()
		}
	}
	if (!mobile) {
		drawRemote()
	}
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
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
	textAlign(LEFT)
	calculateTitleSize()
	textSize(titleFontSize)
	var titleRect = titleFont.textBounds(titleString, 0, 0, titleFontSize)
	text(titleString, -titleFontSize/16, titleRect.y/2 - titleFontSize/16, windowWidth*1.5, titleFontSize*1.5)
	if (numResets == 0) {
		textAlign(CENTER)
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

	image(remoteImg, remoteCoords["left"], remoteCoords["top"], scaledWidth, scaledHeight)
}

function resetVideos() {
	var videos = document.getElementById("videos")
	videos.innerHTML = ""

	fetchVideoURLS();
}

function randomizeVideoOrder() {
	for (var i = 0; i < urls.length; i++) {
		vidIdxs.push(i)
	}
	vidIdxOrder = []
	while(vidIdxOrder.length < urls.length) {
		var r = int(Math.random() * float(vidIdxs.length))
		vidIdxOrder.push(vidIdxs.splice(r, 1))
	}
}

function getRandomInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mousePressed() {
	if (!mobile) {
		if (mouseX >= remoteCoords["left"] && 
			mouseX <= remoteCoords["right"] &&
			mouseY >= remoteCoords["top"] &&
			mouseY <= remoteCoords["bottom"]) {
			numRemoteClicks += 1
			if ((Math.random() < Math.pow(0.5, numResets)) && numNews > 0) {
				resetVideos()
				numNews = 0
				if (numResets < 4) {
					numResets += 1
				}
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
	var newElt = document.createElement("iframe")

	let thisIdx = vidIdxOrder[numNews]
	var eltID = "video" + String(thisIdx)
	newElt.id = eltID
	
	let videoSrc = urlBase + urls[thisIdx] + urlQueryAppend
	newElt.setAttribute("src", videoSrc)
	// console.log("queueing: ", newElt.src)

	newElt.style.cssText = "position: fixed; display: block; width: 100%; height: 100%; top: 0; left: 0;right: 0; bottom: 0; background-color: rgba(0,0,0,0); "

	var videos = document.getElementById("videos")
	videos.appendChild(newElt)

	if (numNews == 0) {
		canvas = createCanvas(windowWidth, windowHeight)
		newElt.style.cssText += "opacity: 100%; "
		newElt.style.cssText += "z-index: -2; "
	} else {
		newElt.style.cssText += "opacity: " + String(100.0/(numNews+1)) + "%; "
		newElt.style.cssText += "z-index: -1; "
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
	return false
}