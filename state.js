// ==================== CENTRALIZED STATE ====================

// Make appState available globally for p5.js
window.appState = {
  // UI-owned state
  ui: {
    currentSection: 'profile', // 'profile' or 'portfolio'
    showProfile: false,
    fadeAmount: 0,
    profileContentScale: 1.0,
    profileContentScaleTarget: 1.0,
    checkerboardOpacity: 0,
    checkerboardTargetOpacity: 0,
    isHoveringWelcome: false,
    audioNoticeOpacity: 1.0,
    hasSpawnedMedia: false,
    portfolioStack: [], // Stack-based portfolio navigation
    portfolioContainerCounter: 0,
    // Menu auto-hide
    menuAutoHideTimer: null,
    menuVisible: true,
    // Welcome button transition
    buttonScale: 1.0,
    welcomeTransitionStartTime: null,
    welcomeTransitionPhase: 'idle', // 'idle', 'button-fade', 'delay', 'profile-fade', 'complete'
    profileFadeStart: 0,
    profileFadeDuration: 0
  },

  // Audio-owned state
  audio: {
    activeOscillators: [],
    lastPlayedNote: -1,
    wasHovering: false,
    audioUpdateCounter: 0,
    minFrequency: null,
    maxFrequency: null,
    weightedNoteArray: null,
    reverb: null,
    reverbBus: null,
    subtleReverb: null
  },

  // Visual-owned state
  visual: {
    activeTickers: [],
    videoIsPlaying: false,
    imagesSinceLastVideo: 0
  },

  // Spawner mode state
  spawner: {
    mode: 'navigation', // 'navigation' or 'spawner'
    config: null
  },

  // Asset/preload state
  assets: {
    spawnerImages: [],
    spawnerVideos: [],
    bieblVideos: [],
    vaultSongs: {}, // Map of folder name -> array of songs
    imageOrder: [],
    videoOrder: [],
    currentImageIndex: 0,
    currentVideoIndex: 0,
    preloadedImage: null,
    preloadedVideo: null,
    preloadedSpawnerVideo: null,  // For preloading spawner mode videos
    imagesLoaded: false,
    videosLoaded: false
  },

  // Device detection
  device: {
    isTouchDevice: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  },

  // DOM references (set during initialization)
  dom: {
    canvas: null,
    checkerboardDiv: null,
    toolbarDiv: null,
    profileImg: null,
    youtubePlayer: null, // YouTube IFrame Player instance
    overlay: null, // General-purpose overlay for UI content and mouse capture
    audioPlayer: null, // HTML5 audio element for playing songs
    nameBackground: null, // Profile name background with blur
    bioTitleBackground: null, // Profile bio title background with blur
    emailBackground: null // Profile email background with blur
  },

  // YouTube video state
  youtube: {
    sevenLastWordsTimestamp: 0 // Stored timestamp for resuming
  },

  // Portfolio configuration
  portfolioItems: ['multicapo', 'pulling strings', 'music', 'singing bowl', 'pachinko', 'space charmer', 'temp-o-whirl', 'maestro', 'dynamic tv backlight', 'rhodes'],

  portfolioSections: {
    'music': ['the vault', 'the friars', 'ummgc', 'reference section'],
    'the friars': ['biebl', 'streaming'],
    'ummgc': ['seven last words of the unarmed'],
    'the vault': ['08112025'],
    '08112025': [] // Will be populated dynamically from vaultSongs['08112025']
  }
};
