// ==================== CONFIGURATION ====================

// Chakra/Solfeggio frequency scale
const CHAKRA_SCALE = [396, 417, 528, 639, 741, 852, 963];

// Make CONFIG available globally for p5.js
window.CONFIG = {
  // ==================== VISUAL SETTINGS - MEDIA ====================

  ANIMATION_DURATION: 10, // Total animation time in seconds
  ANIMATION_FADE_START_TIME: 6, // Fade duration (4s sustain + 6s fade = 10s total)
  ANIMATION_SCALE_GROWTH: 2, // How much to grow (1 = no growth, 2 = double size)
  ANIMATION_SPEED_MIN: 0.05,
  ANIMATION_SPEED_MAX: 0.1,
  MEDIA_SIZE_MIN: 150,
  MEDIA_SIZE_MAX: 300,
  SPAWN_MIN_IMAGES_BEFORE_VIDEO: 4, // minimum number of images to spawn before allowing a video
  SPAWN_VIDEO_PROBABILITY: 0.1, // probability (0-1) of spawning a video when eligible

  // ==================== VISUAL SETTINGS - UI (WELCOME/PROFILE) ====================

  BUTTON_WIDTH: 200,
  BUTTON_HEIGHT: 60,
  BUTTON_RADIUS: 10,
  BUTTON_FADE_DURATION: 0.25, // seconds - how long welcome button fades when clicked
  CHECKERBOARD_SQUARE_SIZE: 4,
  CHECKERBOARD_OPACITY: 84,
  CHECKERBOARD_FADE_TIME: 0.6, // seconds - how long to fade in checkerboard on hover
  BACKDROP_BLUR: 3, // pixels - backdrop filter blur amount for UI elements

  // ==================== VISUAL SETTINGS - TICKER ====================

  TICKER_LEFT_MARGIN: 20, // pixels from left edge
  TICKER_RIGHT_MARGIN: 20, // pixels from right edge
  TICKER_BOTTOM_MARGIN: 20, // pixels from bottom edge
  TICKER_PADDING: 10, // pixels padding inside ticker box
  TICKER_SPACING: 10, // pixels between ticker boxes
  TICKER_FONT_SIZE: 14,

  // ==================== VISUAL SETTINGS - MENU/PORTFOLIO ====================

  // Menu item appearance
  MENU_ITEM_FONT_SIZE: 20, // Font size in pixels
  MENU_ITEM_PADDING_VERTICAL: 15, // Top/bottom padding in pixels
  MENU_ITEM_PADDING_HORIZONTAL: 30, // Left/right padding in pixels
  MENU_ITEM_GAP: 10, // Space between menu items in pixels
  MENU_ITEM_BORDER_RADIUS: 5, // Border radius in pixels
  MENU_ITEM_MIN_TOUCH_SIZE: 44, // Minimum touch target size for iOS (pixels)

  // Menu animation/positioning
  MENU_SHIFT_HORIZONTAL: -105,  // Horizontal shift in pixels per depth (positive = right, negative = left)
  MENU_SHIFT_VERTICAL: 35,  // Vertical shift in pixels per depth (positive = up, negative = down)
  MENU_SCALE_REDUCTION: 0,  // Scale reduction per depth level (0.125 = 12.5% smaller per level)
  MENU_COLLAPSE_ANIMATION: true,  // Whether to collapse non-selected items when opening submenu

  // Menu opacity when navigating deeper
  MENU_DIMMED_OPACITY: 0.2,  // Opacity for non-selected items when submenu opens
  MENU_SELECTED_OPACITY: 0.6,  // Opacity for the selected item when submenu opens

  // Menu auto-hide on inactivity
  MENU_AUTOHIDE_DELAY: 2500,  // Milliseconds of inactivity before menu fades out
  MENU_AUTOHIDE_TRANSITION: 2500,  // Milliseconds for fade transition

  // YouTube video transitions
  YOUTUBE_FADE_IN_TIME: 1000,  // Milliseconds for video/audio fade in
  YOUTUBE_FADE_OUT_TIME: 500,  // Milliseconds for video/audio fade out

  // ==================== AUDIO SETTINGS - EFFECTS ====================

  AUDIO_ENABLE_VIBRATO: true, // Set to true to enable vibrato effect on hover
  AUDIO_VIBRATO_RATE_MIN: 0.5, // Hz - minimum vibrato speed
  AUDIO_VIBRATO_RATE_MAX: 10, // Hz - maximum vibrato speed
  AUDIO_VIBRATO_DEPTH_MIN: 0.25, // Hz - minimum vibrato amount
  AUDIO_VIBRATO_DEPTH_MAX: 1.5, // Hz - maximum vibrato amount
  AUDIO_VIBRATO_RAMP_TIME: 0.1, // seconds - ramp time for vibrato frequency changes
  AUDIO_FILTER_CUTOFF_MAX: 5000, // Hz - filter cutoff at screen center
  AUDIO_FILTER_RAMP_TIME: 0.02, // seconds - ramp time for filter frequency changes
  AUDIO_FILTER_HOLD_RAMP_TIME: 0.2, // seconds - ramp time when holding filter at max
  AUDIO_AMPLITUDE: 0.3, // oscillator amplitude
  AUDIO_HOVER_AMPLITUDE_MULTIPLIER: 0.1, // hover audio quieter than normal (25% of click volume)
  AUDIO_UPDATE_THROTTLE: 3, // Update vibrato every N frames
  AUDIO_AMPLITUDE_FADE_THROTTLE: 3, // Update amplitude fade every N frames

  // Reverb settings
  AUDIO_SUBTLE_REVERB_DURATION: 2, // seconds - subtle reverb duration
  AUDIO_SUBTLE_REVERB_DECAY: 2, // decay rate for subtle reverb
  AUDIO_SUBTLE_REVERB_DRYWET: 0.2, // 20% wet, 80% dry
  AUDIO_REVERB_FADE_IN_TIME: 0.0, // seconds - fade in time for reverb bus send
  AUDIO_REVERB_FADE_OUT_TIME: 10.0, // seconds - fade out time for reverb bus send
  AUDIO_REVERB_DURATION: 6, // seconds - reverb duration
  AUDIO_REVERB_DECAY: 3, // decay rate (higher = more intense)
  AUDIO_REVERB_DRYWET: 1, // 0 = fully dry, 1 = fully wet

  // Video audio effects
  AUDIO_VIDEO_FILTER_FREQ: 4000, // Hz - lowpass filter cutoff frequency
  AUDIO_VIDEO_REVERB_DURATION: 8, // seconds - reverb duration (increased for intensity)
  AUDIO_VIDEO_REVERB_DECAY: 3, // decay rate (increased for intensity)

  // ==================== AUDIO SETTINGS - ENVELOPES (ADSR) ====================

  ADSR_WELCOME: {
    attack: 0.1,      // seconds - fade in time
    decay: 0.3,       // seconds - decay to sustain level
    sustain: 0.7,     // level as fraction of peak (0.7 = 70%)
    release: 6.0      // seconds - fade out time (matches visual fade duration)
  },
  ADSR_TAB: {
    attack: 0.01,     // seconds - very fast attack
    decay: 0.05,      // seconds - quick decay
    sustain: 0.0,     // no sustain - full decay to silence
    release: 0.1      // seconds - fade out time
  },
  ADSR_PORTFOLIO: {
    attack: 0.01,     // seconds - very fast attack like tab chords
    decay: 0.5,       // seconds - long decay for wah effect
    sustain: 0.0,     // no sustain - full decay to silence
    release: 0.1      // seconds - fade out time (if stopped early)
  },
  ADSR_HOVER: {
    attack: 0.2,      // seconds - slow fade in for smooth hover
    decay: 0.3,       // seconds - decay to sustain level
    sustain: 0.6,     // hold at 60% amplitude while hovering
    release: 0.5      // seconds - slow fade out on mouse leave
  },
  ADSR_BACK_NAV: {
    attack: 0.01,     // seconds - very fast attack for vortex suck
    decay: 0.03,      // seconds - quick decay
    sustain: 0.0,     // no sustain - immediate fade
    release: 0.01     // seconds - very fast release
  },

  // ==================== AUDIO SETTINGS - MUSICAL/NOTES ====================

  TAB_CHORD_SPACING: 0.06, // seconds - delay between each note in tab chord

  // Chord definitions (note names)
  CHORD_TAB_PROFILE: ['Eb5', 'F5', 'G5', 'Ab5', 'Bb5'],
  CHORD_TAB_PORTFOLIO: ['F5', 'C6', 'Db6', 'Ab6'],

  // Eb major scale frequencies (across multiple octaves)
  // Format: [frequency, weight] - higher weight = more likely to be selected
  EB_MAJOR_NOTES: [
    [77.78, 4],    // Eb2
    [87.31, 1],    // F2
    [98.00, 1],    // G2
    [103.83, 1],   // Ab2
    [116.54, 1],   // Bb2
    [130.81, 1],   // C3
    [146.83, 1],   // D3
    [155.56, 3],   // Eb3
    [174.61, 1],   // F3
    [196.00, 1],   // G3
    [207.65, 1],   // Ab3
    [233.08, 1],   // Bb3
    [261.63, 1],   // C4
    [293.66, 1],   // D4
    [311.13, 1],   // Eb4
    [349.23, 1],   // F4
    [392.00, 1],   // G4
    [415.30, 1],   // Ab4
    [466.16, 1],   // Bb4
    [523.25, 1],   // C5
    [587.33, 1],   // D5
    [622.25, 2],   // Eb5
    [698.46, 1],   // F5
    [783.99, 1],   // G5
    [830.61, 1],   // Ab5
    [932.33, 1],   // Bb5
    [1046.50, 1],  // C6
    [1174.66, 1],  // D6
    [1244.51, 1]   // Eb6
  ],

  // Chakra/Solfeggio frequencies
  CHAKRA_NOTES: CHAKRA_SCALE,

  // Portfolio menu audio feedback configuration by depth
  // Interval ratios: 5/4 (major third) for actionable items, 16/9 (minor seventh) for leaf items
  // Dynamically generated from CHAKRA_SCALE
  MENU_AUDIO: (() => {
    const config = {};
    CHAKRA_SCALE.forEach((freq, index) => {
      config[`depth${index}`] = { rootFrequency: freq };
    });
    return config;
  })()
};
