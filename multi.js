var canvas;
var trackIndent = 5
var numTracks = 7
var trackNames = [" Vox A", " Vox B", " Samples", " Guitar", " Rhodes", " Bass", " Drums"]
var filenames = ["v1", "v2", "s", "g", "r", "b", "d"]
var volumes = []
var trackFontSize = 20
var trackFontColor = "#000000"
var trackFillColor = "#101010"
var trackEmptyColor = "#303030"
var trackWidth = 125

var isPlaying = false
var audio = []
var fft = []
var startTime = -1
var resumeDur = 0
var sliderAlpha = 220
var sliderColors = []
var colors = []//[ "#ff9933", "#ffcc33", "#ffff66", "#ccff00", "#66ff66", "#aaf0d1", "#50bfe6"]
// var colors = ["#FF8000", "#FFFF00", "#80FF00", "#00FF80", "#00FFFF", "#0000FF", "#8000FF"]

var trackIdx = [5, 6, 0, 1, 2, 3, 4]

function preload() {
	console.log("audio init")
	for (var i = 0; i < numTracks; i++) {
		audio[i] = new p5.SoundFile("audio/yr_" + filenames[i] + ".wav", loadedCallback)
	}
}

var loaded = false
var loadedCount = 0
function loadedCallback() {
	loadedCount += 1
	if (loadedCount == numTracks) {
		console.log("done loading")
		initFFT()
		startTime = millis() + 500
		playAudio()
	} else {
		console.log("loaded " + str(loadedCount))
	}
}

function initFFT() {
	for (var i = 0; i < numTracks; i++) {
		fft[i] = new p5.FFT();	
		fft[i].setInput(audio[i])
		// audio[i].connect(fft[i])
	}
	loaded = true
}

function setup() {	
	console.log("start setup")
	canvas = createCanvas(windowWidth, windowHeight);
	initUI()
	// for (var i = 0; i < numTracks; i++) {
	// 	audio[i].loop()
	// 	audio[i].pause()
		
	// }
	// Set text characteristics
	textFont("Courier New");
	textSize(trackFontSize);
	textAlign(CENTER, CENTER);
	console.log("end setup")
}

function draw() {
	background(0);
	drawTracks();
	if (loaded) {
		// drawPlaybackControls();
		getVisuals();
	}
}

function initUI() {
	for (var i = 0; i < numTracks; i++) {
		volumes[i] = 1
	}
	colorMode(RGB, 255)

	colors.push(color(255, 96, 55, 255));
	sliderColors.push(color(255, 96, 55, sliderAlpha));	

	colors.push(color(255, 153, 51, 255));
	sliderColors.push(color(255, 153, 51, sliderAlpha));	

	colors.push(color(255, 204, 51, 255));
	sliderColors.push(color(255, 204, 51, sliderAlpha));	

	colors.push(color(255, 255, 102, 255));
	sliderColors.push(color(255, 255, 102, sliderAlpha));	

	colors.push(color(204, 255, 0, 255));
	sliderColors.push(color(204, 255, 0, sliderAlpha));	

	colors.push(color(102, 255, 102, 255));
	sliderColors.push(color(102, 255, 102, sliderAlpha));	

	colors.push(color(170, 240, 209, 255));
	sliderColors.push(color(170, 240, 209, sliderAlpha));	

	// colors.push(color(80, 191, 230, 255));
	// sliderColors.push(color(80, 191, 230, sliderAlpha));	
}

window.onresize = function() {
	var w = windowWidth;
	var h = windowHeight;  
	canvas.size(w,h);
	width = w;
	height = h;
};

function drawTracks() {
	for (var i = 0; i < numFirstCol(); i++) {

		var trackTop = trackIndent + (windowHeight-(trackIndent*2))/numFirstCol()*i
		
		strokeWeight(0)
		fill(trackEmptyColor)
		stroke(trackFontColor)
		rect(trackIndent, trackTop, trackWidth, firstColTrackHeight(), 5);
		
		// fill(trackFillColor)
		fill(sliderColors[i])
		rect(trackIndent, trackTop + ((1-volumes[i]) * firstColTrackHeight()) , trackWidth, volumes[i] * firstColTrackHeight(), 5);
		
		strokeWeight(1)
		fill(20, 60, 120, 0)
		rect(trackIndent, trackTop, trackWidth, firstColTrackHeight(), 5);
		
		
		fill(trackFontColor)
		text(trackNames[i], trackIndent, trackTop + (firstColTrackHeight()/2) - (trackFontSize/2), trackWidth, trackFontSize)
	}
	for (var i = 0; i < numSecondCol(); i++) {
		var trackTop = trackIndent + (windowHeight-(trackIndent*2))/numSecondCol()*i
		var trackLeft = trackIndent+trackWidth
		
		strokeWeight(0)
		fill(trackEmptyColor)
		rect(trackLeft, trackTop, trackWidth, secondColTrackHeight(), 5);
		
		// fill(trackFillColor)
		fill(sliderColors[i + 3])
		rect(trackLeft, trackTop + ((1-volumes[numFirstCol()+i]) * secondColTrackHeight()) , trackWidth, volumes[numFirstCol()+i] * secondColTrackHeight(), 5);
		
		strokeWeight(1)
		fill(20, 60, 120, 0)
		rect(trackLeft, trackTop, trackWidth, secondColTrackHeight(), 5);
		
		stroke(trackFontColor)
		fill(trackFontColor)
		text(trackNames[numFirstCol()+i], trackLeft, trackTop + (secondColTrackHeight()/2) - (trackFontSize/2), trackWidth, trackFontSize)
	}
}

function drawPlaybackControls() {
	strokeWeight(2);
	stroke(255);
	fill(circleColor);
	ellipse(width/2, height/2, 200, 200);
}

// var circleColor= Math.random(colors.length);

function numFirstCol() {
	return int(numTracks / 2);
}

function numSecondCol() {
	return numTracks - numFirstCol();
}

function firstColTrackHeight() {
	return (windowHeight-(trackIndent*2))/numFirstCol();
}

function secondColTrackHeight() {
	return (windowHeight-(trackIndent*2))/numSecondCol();
}

function playAudio() {
	for (var i = 0; i < numTracks; i++) {
 		audio[i].jump(resumeDur/1000)
 		audio[i].play((startTime-millis())/1000)
	}
}

function pauseAudio() {
	for (var i = 0; i < numTracks; i++) {
 		audio[i].pause()
	}
}

// var scrollScale = 0.5
let maxVolume = 1.0
let minVolume = 0.0

function updateVolume(idx, delta) {
	volumes[idx] += float(delta) * 0.01
	if (volumes[idx] > maxVolume) {volumes[idx] = maxVolume}
	if (volumes[idx] < minVolume) {volumes[idx] = minVolume}
	audio[idx].setVolume(volumes[idx]);	
}

function getVisuals() {
	var vizLeft = (trackWidth*2) + (trackIndent*2)
	var vizWidth = windowWidth - vizLeft - trackIndent
	var vizHeight = windowHeight - (2*trackIndent)
	for (var i = 0; i < numTracks; i++) {
		var idx = trackIdx[i]
		// console.log("viz " + str(i))
		var spectrum = fft[idx].analyze();
	  	noStroke();
	  	fill(colors[idx]);
	  	var minSteps = 100.0
	  	var maxSteps = 2000.0
	  	var numSpectrumSteps = 550.0 //(mouseY / height) * (maxSteps - minSteps) + minSteps
	  	// console.log(numSpectrumSteps)
	  	for (var j = 0; j < numSpectrumSteps; j++){
	  		var ratio = 1.0 - (Math.log(j+1) / Math.log(numSpectrumSteps))
		   	var full = ratio * spectrum.length
		   	var freq_x = Math.floor(full)
		   	var split = full - freq_x
		   	// console.log("ratio: ", ratio, " idx: ", freq_x, " len: ", spectrum.length)
		   	var x = vizWidth - (j / numSpectrumSteps * vizWidth)
		   	// Math.log(map(j, 0, spectrum.length, 0, vizWidth)) / Math.log(vizWidth) * vizWidth;
		   	// let x2 = j == spectrum.length - 1 ? vizWidth : Math.log(map(j+1, 0, spectrum.length, 0, vizWidth)) / Math.log(vizWidth) * vizWidth;
		   	var h1 = map(spectrum[freq_x], 0, 255, 0.05, vizHeight);
		   	var h2 = map(spectrum[freq_x + 1], 0, 255, 0.05, vizHeight);

		   	var h = (h1 * (1.0 - split)) + (h2 * split)
		   	var w = vizWidth/numSpectrumSteps * 0.4
		   	rect(vizLeft + x - w, trackIndent + vizHeight, w, -h);
		}
	}
}




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
	if (mouseX > trackIndent) {
		if (mouseX < trackWidth + trackIndent) {
			var bin = int(mouseY/windowHeight * float(numFirstCol()))
			updateVolume(bin, event.delta)
		}
		else if (mouseX < trackWidth*2 + trackIndent) {
			var bin = int(mouseY/windowHeight * float(numSecondCol()))
			updateVolume(numFirstCol()+bin, event.delta)    
		}
	}
	return false;
}


