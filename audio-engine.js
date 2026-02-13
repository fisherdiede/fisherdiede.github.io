// ==================== AUDIO ENGINE ====================
// Handles all audio synthesis, oscillators, reverb, and effects

class AudioEngine {
  constructor(state, config) {
    this.state = state;
    this.config = config;
    this.hoverOscillators = []; // Track all active hover audio oscillators

    // Note name to frequency mapping
    this.noteMap = {
      'Eb2': 77.78,
      'F2': 87.31,
      'G2': 98.00,
      'Ab2': 103.83,
      'Bb2': 116.54,
      'C3': 130.81,
      'D3': 146.83,
      'Eb3': 155.56,
      'F3': 174.61,
      'G3': 196.00,
      'Ab3': 207.65,
      'Bb3': 233.08,
      'C4': 261.63,
      'D4': 293.66,
      'Eb4': 311.13,
      'F4': 349.23,
      'G4': 392.00,
      'Ab4': 415.30,
      'Bb4': 466.16,
      'C5': 523.25,
      'D5': 587.33,
      'Eb5': 622.25,
      'F5': 698.46,
      'G5': 783.99,
      'Ab5': 830.61,
      'Bb5': 932.33,
      'C6': 1046.50,
      'Db6': 1108.73,
      'D6': 1174.66,
      'Eb6': 1244.51,
      'Ab6': 1661.22
    };
  }

  /**
   * Initialize audio system - setup reverbs and calculate frequency ranges
   */
  initialize() {
    // Initialize subtle reverb for always-on ambient effect
    this.state.audio.subtleReverb = new p5.Reverb();
    this.state.audio.subtleReverb.set(
      this.config.AUDIO_SUBTLE_REVERB_DURATION,
      this.config.AUDIO_SUBTLE_REVERB_DECAY
    );
    this.state.audio.subtleReverb.drywet(this.config.AUDIO_SUBTLE_REVERB_DRYWET);

    // Initialize reverb bus and effect for hover/profile effect
    this.state.audio.reverbBus = new p5.Gain();
    this.state.audio.reverbBus.amp(0); // Start with no send

    this.state.audio.reverb = new p5.Reverb();
    this.state.audio.reverb.process(
      this.state.audio.reverbBus,
      this.config.AUDIO_REVERB_DURATION,
      this.config.AUDIO_REVERB_DECAY
    );
    this.state.audio.reverb.drywet(this.config.AUDIO_REVERB_DRYWET);

    // Calculate min/max frequencies for amplitude scaling
    const unweightedScale = this._getUnweightedScale();
    this.state.audio.minFrequency = Math.min(...unweightedScale);
    this.state.audio.maxFrequency = Math.max(...unweightedScale);

    // Pre-compute flattened weighted array for O(1) random selection
    this.state.audio.weightedNoteArray = this._buildWeightedNoteArray();

    // Setup audio context resume handlers
    this._setupAudioContextResume();
  }

  /**
   * Spawn an oscillator with spatial positioning and effects
   * @param {Object} params - Oscillator parameters
   * @param {string} params.waveform - 'sine' or 'sawtooth'
   * @param {Object} params.position - {x, y} coordinates for panning
   * @param {number} params.frequency - Optional specific frequency (if not provided, selects random from scale)
   * @param {Object} params.adsr - Optional ADSR envelope { attack, decay, sustain, release }
   * @param {number} params.amplitudeMultiplier - Optional amplitude multiplier (default 1.0)
   * @returns {Object} Oscillator data object for cleanup
   */
  spawnOscillator(params) {
    const { waveform, position, frequency: specifiedFrequency, adsr, amplitudeMultiplier = 1.0 } = params;

    // Use provided ADSR or default to welcome screen envelope
    const envelope = adsr || this.config.ADSR_WELCOME;

    // Select frequency (use specified or weighted random with anti-repetition logic)
    let frequency;
    if (specifiedFrequency !== undefined) {
      frequency = specifiedFrequency;
    } else if (this.config.EB_MAJOR_NOTES.length > 1) {
      do {
        frequency = this._selectWeightedRandomNote();
      } while (frequency === this.state.audio.lastPlayedNote);
      this.state.audio.lastPlayedNote = frequency;
    } else {
      frequency = this._selectWeightedRandomNote();
      this.state.audio.lastPlayedNote = frequency;
    }

    // Create oscillator with lowpass filter
    let osc = new p5.Oscillator(waveform);
    osc.freq(frequency);
    osc.amp(0);

    // Create lowpass filter
    let filter = new p5.LowPass();
    osc.disconnect();
    osc.connect(filter);
    filter.freq(this.config.AUDIO_FILTER_CUTOFF_MAX);

    // Create stereo panner
    let audioContext = getAudioContext();
    let panner = audioContext.createStereoPanner();

    // Connect routing
    filter.disconnect();
    filter.connect(panner);
    panner.connect(this.state.audio.subtleReverb.input);
    panner.connect(this.state.audio.reverbBus);

    osc.start();

    // Calculate amplitude
    let targetAmplitude = this._getAmplitudeForFrequency(frequency) * amplitudeMultiplier;

    // Attack: fade in to peak amplitude
    osc.amp(targetAmplitude, envelope.attack);

    // Decay: after attack completes, decay to sustain level
    let sustainAmplitude = targetAmplitude * envelope.sustain;
    setTimeout(() => {
      // Check if oscillator still exists before applying decay
      if (this.state.audio.activeOscillators.some(o => o.osc === osc)) {
        osc.amp(sustainAmplitude, envelope.decay);
      }
    }, envelope.attack * 1000);

    // Create oscillator data
    let oscData = {
      osc: osc,
      baseFreq: frequency,
      filter: filter,
      panner: panner,
      amplitude: targetAmplitude,
      sustainAmplitude: sustainAmplitude, // Store sustain level for later use
      envelope: envelope, // Store envelope for potential use
      vibratoRate: random(this.config.AUDIO_VIBRATO_RATE_MIN, this.config.AUDIO_VIBRATO_RATE_MAX),
      vibratoDepth: random(this.config.AUDIO_VIBRATO_DEPTH_MIN, this.config.AUDIO_VIBRATO_DEPTH_MAX),
      enableVibrato: waveform === 'sawtooth' // Only for welcome screen
    };

    this.state.audio.activeOscillators.push(oscData);

    // Set initial pan position
    this._updatePanning(oscData, position);

    return oscData;
  }

  /**
   * Select 2 adjacent notes from the top half of the scale for video chord
   * @returns {Array} Array of 2 frequencies [note1, note2]
   * @private
   */
  _selectAdjacentNotes() {
    const scale = this.config.EB_MAJOR_NOTES;
    const topHalfStartIndex = Math.floor(scale.length / 2);

    // Pick random index from top half
    const randomIndex = topHalfStartIndex + Math.floor(Math.random() * (scale.length - topHalfStartIndex));
    const note1 = scale[randomIndex][0]; // Extract frequency from [frequency, weight]

    // Go backwards to find a different note
    let note2Index = randomIndex - 1;
    while (note2Index >= 0 && scale[note2Index][0] === note1) {
      note2Index--;
    }

    // If we didn't find a different note going backwards, use the same note
    const note2 = (note2Index >= 0) ? scale[note2Index][0] : note1;

    return [note1, note2];
  }

  /**
   * Stop an oscillator with fade-out
   * @param {Object} oscData - Oscillator data object to stop
   * @param {boolean} immediate - If true, stop immediately without fade
   */
  stopOscillator(oscData, immediate = false) {
    if (immediate) {
      // Stop immediately without fade
      this._disposeOscillator(oscData);
    } else {
      // Fade out using envelope's release time
      const releaseTime = oscData.envelope ? oscData.envelope.release : 0.1;

      // Cancel any pending ramps by getting the current output level
      // and ramping to it over a very short time
      const audioContext = getAudioContext();
      const now = audioContext.currentTime;

      // Use Web Audio API to cancel scheduled values and lock in current level
      try {
        // Access the underlying Web Audio gain node through p5.sound
        if (oscData.osc.output && oscData.osc.output.gain) {
          oscData.osc.output.gain.cancelScheduledValues(now);
          oscData.osc.output.gain.setValueAtTime(oscData.osc.output.gain.value, now);
          oscData.osc.output.gain.linearRampToValueAtTime(0, now + releaseTime);
        } else {
          // Fallback to p5.sound method
          oscData.osc.amp(0, releaseTime);
        }
      } catch (e) {
        // Fallback to p5.sound method if Web Audio access fails
        oscData.osc.amp(0, releaseTime);
      }

      // Add small buffer to disposal time to ensure fade completes
      setTimeout(() => {
        this._disposeOscillator(oscData);
      }, (releaseTime + 0.05) * 1000);
    }
  }

  /**
   * Play video audio with reverb and spatial effects
   * @param {string} videoPath - Path to video file
   * @param {Object} position - {x, y} coordinates for initial panning
   * @param {number} initialGain - Initial gain value (0 for fade-in, 1 for immediate)
   * @returns {Object} Audio nodes object for manipulation
   */
  playVideoAudio(videoPath, position, initialGain = 1.0) {
    let audioContext = getAudioContext();
    let videoAudioNodes = {};

    // Fetch and decode audio from video file
    fetch(videoPath)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
      .then(buffer => {
        // Create buffer source
        let audioSource = audioContext.createBufferSource();
        audioSource.buffer = buffer;

        // Create lowpass filter
        let videoFilter = audioContext.createBiquadFilter();
        videoFilter.type = 'lowpass';
        videoFilter.frequency.value = this.config.AUDIO_VIDEO_FILTER_FREQ;

        // Create reverb using p5.Reverb
        let videoReverb = new p5.Reverb();
        videoReverb.set(this.config.AUDIO_VIDEO_REVERB_DURATION, this.config.AUDIO_VIDEO_REVERB_DECAY);
        videoReverb.drywet(0.8); // 80% wet/dry mix for intense reverb

        // Create gain node for volume control (for fading)
        let videoGain = audioContext.createGain();
        videoGain.gain.value = initialGain;

        // Create stereo panner for spatial audio
        let videoPanner = audioContext.createStereoPanner();

        // Set initial pan position
        let panValue = map(position.x, 0, width, -1, 1);
        videoPanner.pan.value = panValue;

        // Connect the chain: audioSource -> filter -> gain -> panner -> reverb -> output
        audioSource.connect(videoFilter);
        videoFilter.connect(videoGain);
        videoGain.connect(videoPanner);
        videoPanner.connect(videoReverb.input);

        // Store references
        videoAudioNodes.source = audioSource;
        videoAudioNodes.filter = videoFilter;
        videoAudioNodes.reverb = videoReverb;
        videoAudioNodes.gain = videoGain;
        videoAudioNodes.panner = videoPanner;

        // Start audio playback
        audioSource.start();
      })
      .catch(err => {
        console.warn('Error loading video audio:', err);
      });

    return videoAudioNodes;
  }

  /**
   * Stop video audio with reverb tail
   * @param {Object} videoAudioNodes - Audio nodes object from playVideoAudio
   */
  stopVideoAudio(videoAudioNodes) {
    // Stop the source and disconnect from reverb input, but keep reverb connected
    // to let the tail play out naturally
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

    // Delay reverb disposal to let the tail finish naturally
    if (videoAudioNodes.reverb) {
      setTimeout(() => {
        videoAudioNodes.reverb.dispose();
      }, this.config.AUDIO_VIDEO_REVERB_DURATION * 1000);
    }
  }

  /**
   * Update audio effects (vibrato, filter, reverb) based on hover state
   * @param {boolean} isHovering - Whether mouse is hovering over interactive area
   */
  updateEffects(isHovering) {
    this.state.audio.audioUpdateCounter++;
    let shouldUpdateAudio = this.state.audio.audioUpdateCounter % this.config.AUDIO_UPDATE_THROTTLE === 0;

    // Apply vibrato and reverb when hovering or when profile is showing
    if ((isHovering && !this.state.ui.showProfile) || this.state.ui.showProfile) {
      // Vibrato effect - only apply to oscillators with vibrato enabled
      if (this.config.AUDIO_ENABLE_VIBRATO && shouldUpdateAudio) {
        for (let oscData of this.state.audio.activeOscillators) {
          if (oscData.enableVibrato) {
            let lfo = sin(frameCount * 0.1 * oscData.vibratoRate) * oscData.vibratoDepth;
            oscData.osc.freq(oscData.baseFreq + lfo, this.config.AUDIO_VIBRATO_RAMP_TIME);
          }
        }
      }

      // NOTE: Filter modulation is now handled in individual animation loops for better responsiveness
      // Each spawned element modulates its own oscillator's filter based on mouse distance

      // Activate reverb bus send
      this.state.audio.reverbBus.amp(1, this.config.AUDIO_REVERB_FADE_IN_TIME);
    } else {
      // Reset to base frequency when not hovering and not on profile
      if (this.config.AUDIO_ENABLE_VIBRATO && this.state.audio.wasHovering) {
        for (let oscData of this.state.audio.activeOscillators) {
          if (oscData.enableVibrato) {
            oscData.osc.freq(oscData.baseFreq, this.config.AUDIO_FILTER_HOLD_RAMP_TIME);
          }
        }
      }

      // Deactivate reverb bus send
      this.state.audio.reverbBus.amp(0, this.config.AUDIO_REVERB_FADE_OUT_TIME);
    }

    this.state.audio.wasHovering = isHovering;
  }

  /**
   * Stop all active oscillators with 2-second fade-out
   */
  stopAll() {
    // Make a copy of the array since _disposeOscillator modifies it
    const oscillators = [...this.state.audio.activeOscillators];
    oscillators.forEach(oscData => {
      // Fade out over 2 seconds
      oscData.osc.amp(0, 2.0);
      setTimeout(() => {
        this._disposeOscillator(oscData);
      }, 2000);
    });
  }

  /**
   * Resume audio context (for browser autoplay policies)
   */
  resumeContext() {
    userStartAudio();
    const audioContext = getAudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  /**
   * Spawn a pattern of notes with timing
   * Pattern format: array of { time, note }
   * - time: seconds from start to spawn note
   * - note: note name (e.g., 'F5') or frequency (Hz), or 'random' for weighted random
   *
   * @param {Array} pattern - Array of note events
   * @param {Object} position - {x, y} coordinates for panning
   * @param {Object} options - { waveform?: string, adsr?: object, amplitudeMultiplier?: number }
   * @returns {Array|Object} Oscillator data for cleanup (array for multiple notes, object for single)
   */
  spawnPattern(pattern, position, options = {}) {
    const oscDataArray = [];
    const timeouts = [];

    pattern.forEach(event => {
      const spawnNote = () => {
        // Resolve note to frequency
        let frequency;
        if (event.note === 'random') {
          frequency = this._selectWeightedRandomNote();
        } else if (typeof event.note === 'string') {
          frequency = this.noteMap[event.note];
          if (!frequency) {
            console.warn(`Unknown note: ${event.note}`);
            return;
          }
        } else {
          frequency = event.note; // Already a frequency
        }

        // Spawn oscillator with ADSR
        const oscData = this.spawnOscillator({
          waveform: options.waveform || (this.state.ui.showProfile ? 'sine' : 'sawtooth'),
          position,
          frequency,
          adsr: options.adsr, // Pass through ADSR envelope
          amplitudeMultiplier: options.amplitudeMultiplier // Pass through amplitude multiplier
        });

        oscDataArray.push(oscData);
      };

      // Schedule spawn at specified time
      if (event.time === 0) {
        spawnNote();
      } else {
        const spawnTimeout = setTimeout(spawnNote, event.time * 1000);
        timeouts.push(spawnTimeout);
      }
    });

    // Store timeouts for cleanup
    if (timeouts.length > 0) {
      oscDataArray.timeouts = timeouts;
    }

    // Return single oscData for single-note patterns, array for multi-note
    return oscDataArray.length === 1 ? oscDataArray[0] : oscDataArray;
  }

  /**
   * Play a chord progression for tab navigation
   * @param {string} chordName - 'profile', 'portfolio', or 'welcome'
   */
  playChord(chordName) {
    // Special handling for welcome chord with custom pattern
    if (chordName === 'welcome') {
      this._playWelcomeChord();
      return;
    }

    const chords = {
      'profile': this.config.CHORD_TAB_PROFILE,
      'portfolio': this.config.CHORD_TAB_PORTFOLIO
    };

    const noteNames = chords[chordName];
    if (!noteNames) return;

    // Build pattern from chord note names
    const pattern = noteNames.map((noteName, index) => ({
      time: index * this.config.TAB_CHORD_SPACING,
      note: noteName
    }));

    // Spawn pattern with tab ADSR (self-decaying)
    this.spawnPattern(pattern, { x: width / 2, y: height / 2 }, {
      waveform: 'sine',
      adsr: this.config.ADSR_TAB
    });
  }

  /**
   * Play welcome chord with custom timing and durations
   * Pattern: (0, G4, 2.5), (0.5, Bb4, 2), (1.5, G5, 1), (1.5, Bb5, 1)
   * @private
   */
  _playWelcomeChord() {
    const pattern = [
      { time: 0, note: 'G4', duration: 0.4 },
      { time: 0, note: 'Bb4', duration: 0.4 },
      { time: 0.750, note: 'G5', duration: 0.75 },
      { time: 0.750, note: 'Bb5', duration: 0.75 }
    ];

    const position = { x: width / 2, y: height / 2 };

    pattern.forEach(({ time, note, duration }) => {
      const spawnNote = () => {
        const frequency = this.noteMap[note];
        if (!frequency) {
          console.warn(`Unknown note: ${note}`);
          return;
        }

        // Create custom ADSR with low sustain level and long release for welcome chord
        const customADSR = {
          attack: 0.1,
          decay: 0.3,
          sustain: 0.4,
          release: 1.0
        };

        const oscData = this.spawnOscillator({
          waveform: 'sine',
          position,
          frequency,
          adsr: customADSR
        });

        // Stop oscillator after specified duration
        setTimeout(() => {
          this.stopOscillator(oscData);
        }, duration * 1000);
      };

      if (time === 0) {
        spawnNote();
      } else {
        setTimeout(spawnNote, time * 1000);
      }
    });
  }

  /**
   * Play portfolio item audio feedback
   * Two-note harmony with configurable ADSR
   * @param {Object} adsr - Optional ADSR envelope (defaults to ADSR_PORTFOLIO)
   * @param {Array} frequencies - Optional pre-generated frequencies [freq1, freq2]
   * @param {number} depth - Menu depth level (0, 1, 2) for audio characteristics
   * @param {boolean} isActionable - Whether item opens submenu or triggers special mode (affects interval ratio)
   * @returns {Object} Audio config { frequencies: [freq1, freq2], adsr: envelope, depth: depth }
   */
  playPortfolioItem(adsr = null, frequencies = null, depth = 0, isActionable = true) {
    // Use provided ADSR or default to portfolio wah-like envelope
    const envelope = adsr || this.config.ADSR_PORTFOLIO;

    // Get audio config for this depth
    const depthKey = `depth${depth}`;
    const audioConfig = this.config.MENU_AUDIO[depthKey];

    if (!audioConfig) {
      console.warn(`No audio config for depth ${depth}, using depth0`);
      audioConfig = this.config.MENU_AUDIO.depth0;
    }

    let freq1, freq2;
    if (frequencies && frequencies.length === 2) {
      // Use provided frequencies
      freq1 = frequencies[0];
      freq2 = frequencies[1];
    } else {
      // Use fixed root frequency for this depth
      freq1 = audioConfig.rootFrequency;

      // Choose interval ratio: 5/4 for actionable items, 16/9 for leaf items
      const intervalRatio = isActionable ? (5 / 4) : (16 / 9);

      // Second note at the interval ratio
      freq2 = freq1 * intervalRatio;
    }

    // Two notes at time 0 (harmony)
    const pattern = [
      { time: 0, note: freq1 },
      { time: 0, note: freq2 }
    ];

    // Spawn pattern with specified ADSR
    this.spawnPattern(pattern, { x: width / 2, y: height / 2 }, {
      waveform: 'sine',
      adsr: envelope
    });

    // Return config for potential reversal and hover audio
    return {
      frequencies: [freq1, freq2],
      adsr: envelope,
      depth: depth
    };
  }

  /**
   * Play reversed audio (for navigating back up menu hierarchy)
   * Reverses the ADSR envelope from forward navigation (swap attack and release)
   * @param {Object} audioConfig - The audio config from forward navigation { frequencies, adsr }
   */
  playReversed(audioConfig) {
    if (!audioConfig || !audioConfig.frequencies || !audioConfig.adsr) {
      return;
    }

    // Reverse the ADSR envelope: swap attack and release
    const reversedADSR = {
      attack: audioConfig.adsr.release,
      decay: audioConfig.adsr.decay,
      sustain: audioConfig.adsr.sustain,
      release: audioConfig.adsr.attack
    };

    // Play the same frequencies with reversed envelope
    const pattern = audioConfig.frequencies.map(freq => ({
      time: 0,
      note: freq
    }));

    this.spawnPattern(pattern, { x: width / 2, y: height / 2 }, {
      waveform: 'sine',
      adsr: reversedADSR
    });
  }

  /**
   * Play hover audio (same notes 1 octave down with quieter amplitude)
   * @param {Object} audioConfig - Audio config with frequencies array
   * @returns {Array} Array of oscillator data for cleanup
   */
  playHoverAudio(audioConfig) {
    if (!audioConfig || !audioConfig.frequencies) {
      return [];
    }

    // Play same frequencies 1 octave down (divide by 2)
    const hoverFrequencies = audioConfig.frequencies.map(freq => freq / 2);

    const pattern = hoverFrequencies.map(freq => ({
      time: 0,
      note: freq
    }));

    const oscDataArray = this.spawnPattern(pattern, { x: width / 2, y: height / 2 }, {
      waveform: 'sine',
      adsr: this.config.ADSR_HOVER,
      amplitudeMultiplier: this.config.AUDIO_HOVER_AMPLITUDE_MULTIPLIER
    });

    // Return as array for consistent handling
    const resultArray = Array.isArray(oscDataArray) ? oscDataArray : [oscDataArray];

    // Track hover oscillators
    this.hoverOscillators.push(resultArray);

    return resultArray;
  }

  /**
   * Stop hover audio oscillators
   * @param {Array} oscDataArray - Array of oscillator data
   */
  stopHoverAudio(oscDataArray) {
    if (!oscDataArray || !Array.isArray(oscDataArray)) {
      return;
    }

    oscDataArray.forEach(oscData => {
      if (oscData) {
        this.stopOscillator(oscData);
      }
    });

    // Remove from tracking
    const index = this.hoverOscillators.indexOf(oscDataArray);
    if (index > -1) {
      this.hoverOscillators.splice(index, 1);
    }
  }

  /**
   * Stop all active hover audio
   */
  stopAllHoverAudio() {
    // Make a copy since stopHoverAudio modifies the array
    const allHoverOscs = [...this.hoverOscillators];
    allHoverOscs.forEach(oscArray => {
      this.stopHoverAudio(oscArray);
    });
  }

  /**
   * Update panning for an oscillator based on position
   * @param {Object} oscData - Oscillator data
   * @param {Object} position - {x, y} coordinates
   */
  updateOscillatorPanning(oscData, position) {
    this._updatePanning(oscData, position);
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Calculate amplitude based on frequency for perceptual loudness balance
   * @private
   */
  _getAmplitudeForFrequency(frequency) {
    const normalizedFreq = map(
      frequency,
      this.state.audio.minFrequency,
      this.state.audio.maxFrequency,
      0,
      1
    );
    const multiplier = 1 - Math.pow(normalizedFreq, 0.6) * 0.5;
    return this.config.AUDIO_AMPLITUDE * multiplier;
  }

  /**
   * Update stereo panning based on x position
   * @private
   */
  _updatePanning(oscData, position) {
    const panValue = map(position.x, 0, width, -1, 1);
    oscData.panner.pan.value = panValue;
  }

  /**
   * Setup audio context resume handlers for iOS
   * @private
   */
  _setupAudioContextResume() {
    if (this.state.device.isIOS) {
      document.addEventListener('touchstart', () => {
        this.resumeContext();
      }, { once: false, passive: true });
    }
  }

  /**
   * Dispose of an oscillator and remove from active array
   * @param {Object} oscData - Oscillator data to dispose
   * @private
   */
  _disposeOscillator(oscData) {
    oscData.osc.stop();
    oscData.osc.dispose();
    oscData.filter.dispose();

    // Remove from active array
    const index = this.state.audio.activeOscillators.indexOf(oscData);
    if (index > -1) {
      this.state.audio.activeOscillators.splice(index, 1);
    }
  }

  /**
   * Get unweighted scale (just frequencies, no weights)
   * @returns {Array} Array of frequencies
   * @private
   */
  _getUnweightedScale() {
    return this.config.EB_MAJOR_NOTES.map(note => note[0]);
  }

  /**
   * Build flattened weighted array for O(1) random selection
   * Example: [[77.78, 4], [87.31, 1]] becomes [77.78, 77.78, 77.78, 77.78, 87.31]
   * @returns {Array} Flattened array of frequencies
   * @private
   */
  _buildWeightedNoteArray() {
    const result = [];
    for (let i = 0; i < this.config.EB_MAJOR_NOTES.length; i++) {
      const [frequency, weight] = this.config.EB_MAJOR_NOTES[i];
      for (let j = 0; j < weight; j++) {
        result.push(frequency);
      }
    }
    return result;
  }

  /**
   * Select a random note from the scale considering weights (O(1))
   * @returns {number} Selected frequency
   * @private
   */
  _selectWeightedRandomNote() {
    const array = this.state.audio.weightedNoteArray;
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }
}

// Make AudioEngine available globally for p5.js
window.AudioEngine = AudioEngine;
