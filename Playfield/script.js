const steamworks = require('steamworks.js');
// let app = steamworks.init(3994990);
// app.input.init();
// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const CONFIG = {
  // ===== ANGLES =====
  ANGLE_OFFSET: 90,
  ANGLE_MODIFIER: 60,

  NOTE_ARC_ANGLE: 60,

  // ===== VISUAL MODIFIERS =====

  PREVIEW_COUNT: 6,
  SNAP_INTERVAL: 60, // 360/6 = 6 (Segments)
  SNAP_EXTENSION: 21, // Since controller input is jiggery, give it 4 more degrees before proceeding onto the next segment

  NOTE_RADIUS: 110,

  SCALE_DURATION: 300,

  NOTE_PREVIEW_DELAY: 400,
  CREATE_AT_DISTANCE_OF: 0,

  // ===== CONTAINERS =====
  CONTAINER_RADIUS: 220,
  // CONTAINER_REAL_RADIUS: 400,
  CONTAINER_REAL_RADIUS: 470, // WAS 630
  RAW_RADIUS: 740, // WAS 630
  ADJUSTED_MAX_TRAVEL: 0,
  START_OFFSET: 0,
  CREATION_ANTIDELAY: 5000,

  // TIMING & INPUT
  GAMEPAD_DEADZONE: 0.2,

  AUDIO_OFFSET: 0,

  FLICK_THRESHOLD: 13,
  FLICK_OFFSET: 20,
  SWIPE_OUTWARDS_PROGRESS_THRESHOLD: 0.95,
  SWIPE_INWARDS_THRESHOLD: 0.7,
  INITIAL_DELAY: 0,
  HINT_VISIBILITY: 0.5,
  SWIPE_PRECHECK: 100,

  // SCORING
  ACCEPTANCE_THRESHOLD: 300,
  FLICK_ACCEPTANCE_THRESHOLD: 400,
  SLIDER_RELEASE_THRESHOLD: 250,
  ACCURACY_RANGES: {
    'perfect': [0, 52.8],
    'great': [52.8, 90.8],
    'ok': [110, 150],
    'bad': [150, 160],
  },
  ACCURACY_SCORES: {
    'perfect': 200,
    'great': 170,
    'ok': 40,
    'bad': 20,
  },

  SHORT_ANIMATION: 100, // ms
  LONG_ANIMATION: 300,
  LONGER_ANIMATION: 500,

  DIFFICULTY_MAP: {
    1: "Easy",
    2: "Normal",
    3: "Hard",
    4: "Expert",
  },

  AUTOPLAY: false,
  BUTTONS: true,

  FLASHING_LIGHTS: 1,
  GIMMICKS: 1,
  VFX_CACHE_MULTIPLIER: 1
};

function getProgress(value, min, max) {
  return Math.max(0, (value - min) / (max - min));
}

var loadTime = 0;

// translateY(calc((var(--sr) + (var(--s) - var(--sr)) * 2) / 2))
// calc((var(--sr) / 2) - var(--tlr))
CONFIG.ADJUSTED_MAX_TRAVEL = (CONFIG.CONTAINER_REAL_RADIUS / 2);
var sheet = document.styleSheets[0];
// sheet.insertRule(`:root{--real-size: ${CONFIG.CONTAINER_REAL_RADIUS}px}`);

sheet.insertRule(`:root { --real-size: ${CONFIG.CONTAINER_REAL_RADIUS}px }`);
sheet.insertRule(`:root { --inner-container-note-distance: ${CONFIG.START_OFFSET}px }`);

// ============================================================================
// GAME STATE
// ============================================================================
class GameState {
  constructor() {
    this.crossDetails = JSON.parse(fs.readFileSync('./Core/crossdetails', 'utf8'));
    this.sheet = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/${this.crossDetails.map}`, 'utf8'));
    this.information = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/information.json`, 'utf8'));
    try {
      this.timeSheet = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/time_${this.crossDetails.map}`, 'utf8'));
    } catch (error) { }
    try {
      this.lightMap = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/light_${this.crossDetails.map}`, 'utf8'));
    } catch (error) { }
    document.getElementById('songArt').style.backgroundImage = `url('../Beatmaps/${this.crossDetails.location}/${this.information.cover}')`;
    document.getElementById('songName').innerHTML = this.information.name;
    document.getElementById('songArtist').innerHTML = this.information.artist;
    document.getElementById('difficulty').innerHTML = `${CONFIG.DIFFICULTY_MAP[this.crossDetails.difficulty]} - ${this.information.ratings[this.crossDetails.difficulty]}`;
    document.getElementById('difficultyTag').classList.add(CONFIG.DIFFICULTY_MAP[this.crossDetails.difficulty].toLowerCase());
    this.combo = 0;
    this.score = 0;

    CONFIG.AUDIO_OFFSET = getSetting('audio_offset', 0);
    CONFIG.HINT_VISIBILITY = getSetting('note_hint', 0.5);
    CONFIG.FLASHING_LIGHTS = getSetting('flashing_lights', 1);
    CONFIG.GIMMICKS = getSetting('gimmicks', 1);
    CONFIG.VFX_CACHE_MULTIPLIER = getSetting('vfx_cache', 3);

    let noteDesign = getSetting('noteDesign', 'geometrical');
    let holdNoteDesign = getSetting('holdNoteDesign', 'geometrical');
    let noteDesigns = {
      note: "Note",
      holdNote: "Note Holdable",
      goldenNote: "Note Golden",
    }
    let holdNoteDesigns = {
      sliderTop: "Top",
      sliderFrame: "Frame",
      sliderBottom: "Bottom",

      sliderTopGolden: "Top Golden",
      sliderFrameGolden: "Frame Golden",
      sliderBottomGolden: "Bottom Golden",

      sliderTopHoldable: "Top Holdable",
      sliderBottomHoldable: "Bottom Holdable",
    }
    for (let design in noteDesigns) {
      document.styleSheets[0].insertRule(`:root { --${design}: url('../Assets/Headers/${noteDesign}/${noteDesigns[design]}.svg') }`);
    }
    for (let design in holdNoteDesigns) {
      document.styleSheets[0].insertRule(`:root { --${design}: url('../Assets/Headers/${holdNoteDesign}/${holdNoteDesigns[design]}.svg') }`);
    }

    let lastNote = this.sheet[this.sheet.length - 1];
    let determinedTime = lastNote.time;
    if (lastNote.slider) {
      determinedTime = lastNote.sliderEnd;
    }
    if (lastNote.largeFlick) {
      determinedTime = lastNote.flickEnd;
    }
    this.endsAt = determinedTime + CONFIG.ACCEPTANCE_THRESHOLD;

    this.keysPressed = {};

    this.rotations = [0, 0];
    this.rawRotations = [0, 0];
    this.centerDistance = [0, 0];
    this.sectors = [1, 1];
    this.snapToInterval = true;

    this.displayedNotes = [];

    this.scoringPad = {
      perfect: [],
      great: [],
      ok: [],
      bad: [],
      miss: []
    }


    this.gamepad = null;

    this.lastFrameTime = 0;

    // Web Audio
    this.audioContext = new window.AudioContext();
    this.audioBuffer = null;
    this.audioSource = null;
    this.audioStartTime = 0; // audioContext.currentTime when playback started (seconds)
    this.audioPauseOffset = 0; // ms offset to apply if needed

    this.initializeDOM();
    // initializeAudio is now async and called from RhythmGame.init()
  }

  pauseAudio() {
    if (this.audioSource) {
      this.audioSource.stop();
    }
  }

  initializeDOM() {
    this.elements = {
      container: document.getElementById('noteContainer'),
      topLevelContainer: document.getElementById('topLevelContainer'),
      cursor1: document.getElementById('cursor1'),
      cursor2: document.getElementById('cursor2'),
      comboDisplay: document.getElementById('comboDisplay'),
      previewers: document.querySelectorAll('.previewer_parent'),
      noteContainerFrame: document.getElementById('noteContainerFrame'),
      perfectionIndicator: document.getElementById('perfectionIndicator'),
      pauseButton: document.getElementById('pauseButton'),
      scoreText: document.getElementById('scoreText'),
      scoreNumber: document.getElementById('scoreNumber'),
      songName: document.getElementById('songName'),
      songArtist: document.getElementById('songArtist'),
      songData: document.getElementById('songData'),
      songArt: document.getElementById('songArt'),
      backButton: document.getElementById('backButton'),
      restartButton: document.getElementById('restartButton'),
      controls: document.getElementById('controls'),
      overlay: document.getElementById('overlay'),
      flickers: [
        document.getElementById('lightshow_1'), document.getElementById('lightshow_2'),
        document.getElementById('lightshow_3'), document.getElementById('lightshow_4'),
        document.getElementById('lightshow_5'), document.getElementById('lightshow_6'),
        document.getElementById('lightshow_7'), document.getElementById('lightshow_8'),
      ],
      flickerStates: {
        0: false,
        1: false,
        2: false,
        3: false,
        4: false,
        5: false,
        6: false,
        7: false,
      }
    };

    CONFIG.NOTE_PREVIEW_DELAY = (5 / getSetting('note_speed', 6)) * 1000;

    this.elements.overlay.style.scale = getSetting('hexagon_size', 1);

    this.effectItems = []
    for (let i = 0; i < 4 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let particle_outwards = document.createElement('div');
      particle_outwards.classList.add('sfx_outwards_particle');
      parent.appendChild(particle_outwards);

      let particles_outwards = document.createElement('div');
      particles_outwards.classList.add('sfx_outwards_particles');
      parent.appendChild(particles_outwards);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: particle_outwards,
        particleElement: particles_outwards,
        inUse: false,
        type: 'particles'
      });
    }

    for (let i = 0; i < 4 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let particle_outwards = document.createElement('div');
      particle_outwards.classList.add('sfx_outwards_particle', 'sfx_constant_particle');
      parent.appendChild(particle_outwards);

      let particles_outwards = document.createElement('div');
      particles_outwards.classList.add('sfx_outwards_particles', 'sfx_constant_particles');
      parent.appendChild(particles_outwards);

      let particles_outwards_repeat = document.createElement('div');
      particles_outwards_repeat.classList.add('sfx_outwards_particles', 'sfx_constant_particles', 'sfx_constant_particles_repeat');
      parent.appendChild(particles_outwards_repeat);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: particle_outwards,
        particleElement: particles_outwards,
        particleElementRepeat: particles_outwards_repeat,
        inUse: false,
        type: 'particles_constant',
        constant: true
      });
    }

    for (let i = 0; i < 3 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let header = document.createElement('div');
      header.classList.add('sfx_header', 'note_header');
      parent.appendChild(header);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: header,
        inUse: false,
        type: 'header_burst'
      })
    }

    for (let i = 0; i < 1 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let header = document.createElement('div');
      header.classList.add('sfx_header', 'swipe_header');
      parent.appendChild(header);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: header,
        inUse: false,
        type: 'swipe_burst'
      })
    }

    for (let i = 0; i < 4 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let particle_outwards = document.createElement('div');
      particle_outwards.classList.add('sfx_outwards_particle', 'sfx_outwards_chevron');
      parent.appendChild(particle_outwards);

      let particles_outwards = document.createElement('div');
      particles_outwards.classList.add('sfx_outwards_particles');
      parent.appendChild(particles_outwards);

      let chevron_particles_outwards = document.createElement('div');
      chevron_particles_outwards.classList.add('sfx_outwards_chevrons');
      parent.appendChild(chevron_particles_outwards);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: particle_outwards,
        particleElement: particles_outwards,
        inUse: false,
        type: 'particles_swipe'
      });
    }

    for (let i = 0; i < 3 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let header = document.createElement('div');
      header.classList.add('sfx_header', 'slider_header');
      parent.appendChild(header);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: header,
        inUse: false,
        type: 'header_constant',
        constant: true
      })
    }


    const rect = this.elements.container.getBoundingClientRect();
    const centerX = rect.x + (rect.width / 2);
    const centerY = rect.y + (rect.height / 2);
    this.cachedRects = { rect, centerX, centerY };
    window.addEventListener('resize', () => {
      const rect = this.elements.container.getBoundingClientRect();
      const centerX = rect.x + (rect.width / 2);
      const centerY = rect.y + (rect.height / 2);
      this.cachedRects = { rect, centerX, centerY };
    });
  }

  async initializeAudio() {
    const filePath = `./Beatmaps/${this.crossDetails.location}/audio.mp3`;
    const fileBuf = fs.readFileSync(filePath);
    const arrayBuffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.length);
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    if (this.audioSource) {
      try { this.audioSource.stop(); } catch (e) { }
      this.audioSource.disconnect();
    }

    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.gainNode);
    this.audioSource.start(0);
    this.audioStartTime = this.audioContext.currentTime;
    this.paused = false;
    this.gainNode.gain.value = Number(getSetting('music_volume', 90)) / 100;
  }

  get currentTime() {
    if (!this.audioBuffer || !this.audioStartTime) return (Performance.now() - (loadTime + CONFIG.AUDIO_OFFSET));
    return ((this.audioContext.currentTime - this.audioStartTime) * 1000) - CONFIG.AUDIO_OFFSET
  }

  seekToTime(timeInMs) {
    if (!this.audioSource || !this.audioBuffer) return;

    this.audioSource.stop();
    this.audioSource.disconnect();

    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.audioContext.destination);

    const timeInSeconds = timeInMs / 1000;
    this.audioStartTime = this.audioContext.currentTime - timeInSeconds;

    this.audioSource.start(0, timeInSeconds);
  }
}
class TimingSystem {
  constructor() {
    this.globalTimingPoint = { speed: 1, offset: 0 };
  }

  /**
   * Get interpolated timing point for a given time
   * @param {number} time - Current time in milliseconds
   * @param {Array} timingSheet - Array of timing points
   * @param {Object} defaultPoint - Default timing values
   * @returns {Object} Interpolated timing point with speed and offset
   */

  getTiming(note, time) {
    const timingPoint = note.timeSheet ? this.getTimingPointAt(time, note.timeSheet, note.time) : null;
    if (!timingPoint) return undefined;
    if (timingPoint.style) {
      this.applyNoteStyles(timingPoint, note);
    }
    return timingPoint;
  }

  getTimingPointAt(time, timingSheet, relativeTime = 0) {
    if (!timingSheet?.length) return { speed: 1, offset: null };


    let activePoint = null;
    let activeIndex = -1;

    for (let i = 0; i < timingSheet.length; i++) {
      const point = timingSheet[i];

      if (point.applied) break;

      let pointTime;
      if (typeof point.time === 'object') {
        pointTime = this.fromSpecial(point.time);
      } else {
        pointTime = parseFloat(point.time);
      }

      if (typeof point.offset == 'object') {
        point.offset = this.fromSpecial(point.offset);
      }

      if (typeof point.transition)

        if (point.from && point.from.offset && typeof point.from.offset === 'object') {
          point.from.offset = this.fromSpecial(point.from.offset);
        }

      const pointStartTime = pointTime;

      if ((pointStartTime + relativeTime) <= time) {
        activePoint = point;
        activeIndex = i;
      } else break;
    }

    if (!activePoint) return { speed: 1, offset: null };
    return activePoint;
  }

  updateGlobalTimingPoint(sheet, time) {
    const timingPoint = this.getTimingPointAt(time, sheet);
    this.globalTimingPoint = timingPoint;
    if (game.gameState?.timeSheet?.[timingPoint?.index]?.applied) return;
    if (timingPoint.segments) {
      this.applySegmentStyles(timingPoint);
    }
    if (timingPoint.flickers) {
      this.applyFlickers(timingPoint)
    }
    if (timingPoint.playfield) {
      this.applyPlayfieldStyles(timingPoint)
    }
    if (game.gameState.timeSheet?.[timingPoint?.index]) game.gameState.timeSheet[timingPoint.index].applied = true;
  }

  applyPlayfieldStyles(timingPoint) {
    const entries = Object.entries(timingPoint.playfield);
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      game.gameState.elements.container.style[key] = value;
    }
  }

  applyFlickers(timingPoint) {
    for (let i = 0; i < timingPoint.flickers.length; i++) {
      let modifier = timingPoint.flickers[i];
      const flicker = game.gameState.elements.flickers[modifier.source];
      let duration = modifier.duration || 0;
      flicker.style.transition = `opacity ${duration}ms ease`
      if (game.gameState.elements.flickerStates[modifier.source]) {
        game.gameState.elements.flickerStates[modifier.source] = false;
        flicker.style.opacity = '0';
      } else {
        game.gameState.elements.flickerStates[modifier.source] = true;
        flicker.style.opacity = modifier.strength || '1';
      }
    }
  }

  applyNoteStyles(timingPoint, note) {
    if (!note?.element || !timingPoint.style) {
      return;
    }

    // Only apply styles once per timing point
    if (note.setStyle === timingPoint.time) {
      return;
    }

    note.setStyle = timingPoint.time;
    const noteElement = note.element;

    // Apply parent styles
    if (timingPoint.style.parent) {
      const parentElement = noteElement.parentElement.parentElement;
      const parentEntries = Object.entries(timingPoint.style.parent);
      for (let i = 0; i < parentEntries.length; i++) {
        const [key, value] = parentEntries[i];
        parentElement.style[key] = value;
      }
    }

    // Apply child styles
    if (timingPoint.style.child) {
      const childElement = noteElement.parentElement;
      const childEntries = Object.entries(timingPoint.style.child);
      for (let i = 0; i < childEntries.length; i++) {
        const [key, value] = childEntries[i];
        childElement.style[key] = value;
      }
    }

    if (timingPoint.style.header) {
      const childElement = noteElement;
      const headerEntries = Object.entries(timingPoint.style.header);
      for (let i = 0; i < headerEntries.length; i++) {
        const [key, value] = headerEntries[i];
        childElement.style[key] = value;
      }
    }
  }

  applySegmentStyles(timingPoint) {
    if (timingPoint.segments) {
      let previewers = game.gameState.elements.previewers;
      for (let i = 0; i < previewers.length; i++) {
        const previewer = previewers[i];
        const segmentStyle = timingPoint.segments[i];
        if (!segmentStyle) continue;
        const entries = Object.entries(segmentStyle);
        for (let j = 0; j < entries.length; j++) {
          const [key, value] = entries[j];
          previewer.style[key] = value;
        }
      }
    }
  }

  interpolateTimingPoint(time, activePoint, defaultPoint) {
    const startTime = parseFloat(this.fromSpecial(activePoint.time));
    const transition = parseFloat(this.fromSpecial(activePoint.transition) || 0);
    if (!transition) {
      return {
        speed: parseFloat(activePoint?.speed ?? defaultPoint?.speed),
        offset: parseFloat(activePoint?.offset ?? defaultPoint?.offset)
      };
    }

    const endTime = startTime + transition;

    let speedFrom = defaultPoint?.speed, offsetFrom = defaultPoint?.offset;

    if (activePoint.from) {
      speedFrom = parseFloat(activePoint.from?.speed ?? defaultPoint?.speed);
      offsetFrom = parseFloat(this.fromSpecial(activePoint.from?.offset) ?? defaultPoint?.offset);
    } else {
      return {
        speed: parseFloat(activePoint?.speed ?? defaultPoint?.speed),
        offset: parseFloat(activePoint?.offset ?? defaultPoint?.offset)
      }
    }

    const speedTo = parseFloat(activePoint?.speed ?? defaultPoint?.speed);
    const offsetTo = parseFloat(this.fromSpecial(activePoint?.offset) ?? defaultPoint?.offset);

    if (time >= endTime) {
      return {
        speed: speedTo,
        offset: offsetTo
      };
    }

    if (time < startTime) {
      return {
        speed: speedFrom,
        offset: offsetFrom
      };
    }

    const progress = (time - startTime) / transition;
    const easedProgress = this.applyEasing(progress, activePoint.easing);
    console.log(startTime, transition)
    return {
      speed: this.lerp(speedFrom, speedTo, easedProgress),
      offset: this.lerp(offsetFrom, offsetTo, easedProgress)
    };
  }

  findPreviousTimingPoint(currentTime, timingSheet) {
    let prevPoint = null;
    for (let i = 0; i < timingSheet.length; i++) {
      const point = timingSheet[i];
      if (parseFloat(point.time) < currentTime) {
        prevPoint = point;
      } else {
        break;
      }
    }
    return prevPoint;
  }

  applyEasing(progress, easingType = 'linear') {
    switch (easingType) {
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - (1 - progress) * (1 - progress);
      case 'ease-in-out':
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      default:
        if (typeof easingType == 'object' && easingType.cubicBezier) {
          const [p1, p2, p3, p4] = easingType.cubicBezier;
          // Cubic Bezier easing function
          return this.cubicBezier(progress, p1, p2, p3, p4);
        }
        return progress;
    }
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  fromSpecial(value) {
    if (typeof value === 'object') {
      let endValue = CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION;
      for (let i = 0; i < value.length; i++) {
        endValue = this.processSpecialItem(value[i], endValue);
      }
      return endValue;
    } else {
      return value;
    }
  }

  cubicBezier(t, x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    const sampleCurveX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleCurveY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleCurveDerivativeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

    let currentTime = t;
    for (let i = 0; i < 8; i++) {
      const currentX = sampleCurveX(currentTime) - t;
      if (Math.abs(currentX) < 1e-7) {
        return sampleCurveY(currentTime);
      }
      const currentSlope = sampleCurveDerivativeX(currentTime);
      if (Math.abs(currentSlope) < 1e-7) {
        break;
      }
      currentTime -= currentX / currentSlope;
    }

    let aT = 0;
    let bT = 1;
    currentTime = t;

    if (currentTime < aT) return sampleCurveY(aT);
    if (currentTime > bT) return sampleCurveY(bT);

    while (aT < bT) {
      const currentX = sampleCurveX(currentTime);
      if (Math.abs(currentX - t) < 1e-7) {
        return sampleCurveY(currentTime);
      }
      if (t > currentX) {
        aT = currentTime;
      } else {
        bT = currentTime;
      }
      currentTime = (bT - aT) * 0.5 + aT;
    }

    return sampleCurveY(currentTime);
  }

  processSpecialItem(iteration, currentValue) {
    if (iteration.operation == 'multiply') return currentValue * iteration.operand;
    if (iteration.operation == 'divide') return currentValue / iteration.operand;
    if (iteration.operation == 'addition') return currentValue + iteration.operand;
    if (iteration.operation == 'subtraction') return currentValue - iteration.operand;
    if (iteration.operation == 'percentage') return (currentValue / 100) * iteration.operand;
  }
}
// ============================================================================
// INPUT SYSTEM
// ============================================================================
class InputSystem {
  constructor(gameState, timingSystem) {
    this.gameState = gameState;
    this.timingSystem = timingSystem;
    this.points = new Map();
    this.pointIDs = 0;
    this.setupEventListeners();
  }

  /**
 * Creates a new input point with the specified options
 * @param {Object} options - The options for creating a point
 * @param {Object} options.source - The source of the input point
 * @param {number} options.angle - The angle of the input point in degrees
 * @param {number} options.rawAngle - The raw unprocessed angle in degrees
 * @param {number|null} [options.distance] - The distance from center (defaults to 1)
 * @param {(string|number|null)} [options.type] - The type of input point (defaults to 'button')
 * @param {Object} [options.associatedNote] - The note object associated with this point
 * @returns {void}
 */
  createPoint(options) {
    this.pointIDs++;
    const point = {
      source: options.source,
      angle: options.angle,
      rawAngle: options.rawAngle,
      distance: options.distance || 1,
      type: options.type || 'button',
      startedAt: this.gameState.currentTime,
      associatedNote: options.associatedNote || null,
      analog: options.analog || false,
    };

    this.points.set(point.type, point);
    if (!point.analog) this.hit(point.angle)
  }

  hit(angle) {
    const matchingNotes = this.findMatchingNotes(angle);
    const closestNote = this.findClosestNote(matchingNotes);
    if (closestNote) {
      if (closestNote.slider) {
        if (!(closestNote.holdableStart ? game.gameState.currentTime <= closestNote.time : true)) return;
        return this.holdSlider(closestNote);
      }
      this.hitNote(closestNote);
    }
  }

  swipeNote(note, point) {
    const noteStartAverage = (note.firstPointDetectedAt + note.time) / 2;
    const noteEndAverage = (game.gameState.currentTime + note.swipeEnd) / 2;

    point.associatedNote = note;
    note.done = true;
    this.gameState.scoringSystem.judge(noteStartAverage, true, note, note.firstPointDetectedAt);
    this.gameState.scoringSystem.judge(noteEndAverage, true);


    this.createNoteAura(note).then(() => {
      note.traceParent.remove();
      note.element.parentElement.parentElement.parentElement.remove();
    })
  }

  updatePoint(id, options = {
    angle: Number,
    rawAngle: Number,
    distance: Number
  }) {
    let point = this.points.get(id);
    point.angle = options.angle;
    point.rawAngle = options.rawAngle;
    point.distance = options.distance;
  }

  releasePoint(id) {
    this.points.delete(id)
  }


  setupEventListeners() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
  }

  handleKeyDown(event) {
    if (event.repeat) return;

    const key = event.key.toLowerCase();
    this.gameState.keysPressed[key] = true;

    if (key === 'w' || key === 's') {
      this.processNoteHold(key);
    }
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    this.gameState.keysPressed[key] = false;
    if (key === 'w' || key === 's') {
      this.processNoteRelease(key);
    }
  }

  handleMouseMove(event) {
    if (this.gameState.gamepad) return;

    const rect = this.gameState.cachedRects.rect;
    const centerX = this.gameState.cachedRects.centerX;
    const centerY = this.gameState.cachedRects.centerY;

    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const angleDegrees = angle * (180 / Math.PI);
    const distanceFromCenter = Math.sqrt(Math.pow(event.clientX - centerX, 2) + Math.pow(event.clientY - centerY, 2));

    const normalized = Math.min(distanceFromCenter / (CONFIG.ADJUSTED_MAX_TRAVEL || 1), 1);

    this.gameState.centerDistance[0] = normalized;
    this.gameState.centerDistance[1] = normalized;

    this.updateRotations(angleDegrees, angleDegrees);
  }

  handleAutoplay(currentTime) {
    let relevantNotes = this.gameState.sheet.filter(note => {
      return note.time <= currentTime && !note.done;
    });

    // Process each relevant note
    relevantNotes.forEach(note => {
      if (note.slider && !note.isBeingHeld) {
        note.blockRelease = true;
        this.holdSlider(note);
      } else if (note.slider && note.isBeingHeld && currentTime > note.sliderEnd) {
        this.releaseSlider(note);
      } else if (note.flick && !note.done) {
        if (note.input == undefined) {
          this.startFlick(note);
          note.rotations = (note.angle * (CONFIG.ANGLE_MODIFIER)) + CONFIG.ANGLE_OFFSET;
        }

        if (!note.largeFlick) {
          note.done = true;
          this.releaseFlick(note);
        } else if (note.largeFlick && note.flickEnd <= currentTime) {
          note.done = true;
          this.releaseFlick(note);
        }
      } else if (!note.slider && !note.flick && !note.largeFlick && !note.done) {
        this.hitNote(note, 1);
      }
    });
  }

  handleGamepadConnected(event) {
    if (this.gameState.phone) return
    let gamepads = navigator.getGamepads()
    this.gameState.gamepad = gamepads.find(gp => !!gp);
  }

  updateGamepadInput() {
    const gamepad = navigator.getGamepads()[0];
    if (!gamepad) return;

    let stickStates = this.getJoystickStates(gamepad);
    const leftTrigger = gamepad.buttons[6]?.pressed || gamepad.buttons[4]?.pressed;
    const rightTrigger = gamepad.buttons[7]?.pressed || gamepad.buttons[5]?.pressed;
    if (CONFIG.BUTTONS) {
      let stuffToHold = {
        Y_Held: 3,
        B_Held: 1,
        A_Held: 0,

        UP_Held: 12,
        LEFT_Held: 14,
        DOWN_Held: 13
      }

      let pointAngleMappings = {
        Y_Held: 300,
        B_Held: 0,
        A_Held: 60,
        DOWN_Held: 120,
        LEFT_Held: 180,
        UP_Held: 240,
      }

      for (let pointID in stuffToHold) {
        if (!this.points.get(pointID) && gamepad.buttons[stuffToHold[pointID]]?.pressed) {
          this.createPoint({
            angle: pointAngleMappings[pointID],
            rawAngle: pointAngleMappings[pointID],
            distance: 1,
            type: pointID,
            source: pointID
          });
        } else if (this.points.get(pointID) && !gamepad.buttons[stuffToHold[pointID]]?.pressed) {
          this.releasePoint(pointID);
        }
      }

      let leftStickPoint = this.points.get('cursor1');
      let rightStickPoint = this.points.get('cursor2');
      if (leftStickPoint) {
        leftStickPoint.angle = stickStates.snappedRotations[0];
        leftStickPoint.rawAngle = stickStates.rawRotations[0];
        leftStickPoint.distance = stickStates.distances[0];
        if (leftStickPoint.associatedNote) {
          let pointSegment = this.getSegment(leftStickPoint.angle);
          if (pointSegment == 6) pointSegment = 0;
          if (pointSegment != leftStickPoint.associatedNote.desiredAngle || leftStickPoint.distance < CONFIG.GAMEPAD_DEADZONE) {
            leftStickPoint.associatedNote = null;
          }
        }
      } else if (stickStates.distances[0] > CONFIG.SWIPE_INWARDS_THRESHOLD) {
        this.createPoint({
          angle: stickStates.snappedRotations[0],
          rawAngle: stickStates.rawRotations[0],
          distance: stickStates.distances[0],
          type: 'cursor1',
          source: 'cursor1',
          analog: true
        });
      }

      if (rightStickPoint) {
        rightStickPoint.angle = stickStates.snappedRotations[1];
        rightStickPoint.rawAngle = stickStates.rawRotations[1];
        rightStickPoint.distance = stickStates.distances[1];
        if (rightStickPoint.associatedNote) {
          let pointSegment = this.getSegment(rightStickPoint.angle);
          if (pointSegment == 6) pointSegment = 0;
          if (pointSegment != rightStickPoint.associatedNote.desiredAngle || rightStickPoint.distance < CONFIG.GAMEPAD_DEADZONE) {
            rightStickPoint.associatedNote = null;
          }
        }
      } else if (stickStates.distances[1] > CONFIG.SWIPE_INWARDS_THRESHOLD) {
        this.createPoint({
          angle: stickStates.snappedRotations[1],
          rawAngle: stickStates.rawRotations[1],
          distance: stickStates.distances[1],
          type: 'cursor2',
          source: 'cursor2',
          analog: true
        });
      }
    }

    this.updateGamepadButtons(gamepad);
  }

  getJoystickStates(gamepad) {
    // Left stick is cursor1
    const x1 = gamepad.axes[0];
    const y1 = gamepad.axes[1];
    const angle1 = Math.atan2(y1, x1) * (180 / Math.PI);

    var distance1 = Math.sqrt(x1 * x1 + y1 * y1)

    // Right stick is cursor2
    const x2 = gamepad.axes[2];
    const y2 = gamepad.axes[3];
    const angle2 = Math.atan2(y2, x2) * (180 / Math.PI);

    var distance2 = Math.sqrt(x2 * x2 + y2 * y2)


    return { snappedRotations: [this.snapAngle(angle1), this.snapAngle(angle2)], rawRotations: [angle1, angle2], distances: [distance1, distance2] };
  }

  updateGamepadButtons(gamepad) {
    const leftTrigger = gamepad.buttons[6]?.pressed || gamepad.buttons[4]?.pressed;
    const rightTrigger = gamepad.buttons[7]?.pressed || gamepad.buttons[5]?.pressed;

    if (CONFIG.BUTTONS) {
      return this.updateButtonInput(gamepad)
    }
    this.updateTriggerState('w', leftTrigger, 0);
    this.updateTriggerState('s', rightTrigger, 1);
  }

  updateButtonInput() { }

  updateTriggerState(key, pressed, cursorIndex) {
    if (pressed && !this.gameState.keysPressed[key]) {
      this.gameState.keysPressed[key] = true;
      this.scaleCursor(cursorIndex, '2');
    } else if (!pressed && this.gameState.keysPressed[key]) {
      this.gameState.keysPressed[key] = false;
      this.scaleCursor(cursorIndex, '1');
    }
  }

  scaleCursor(index, scale) {
    const cursor = index === 0 ? this.gameState.elements.cursor1 : this.gameState.elements.cursor2;
    if (cursor?.firstElementChild) {
      cursor.firstElementChild.style.scale = scale;
    }
  }

  updateRotations(angle1, angle2) {
    angle1 = this.normalizeAngle(angle1);
    angle2 = this.normalizeAngle(angle2);
    let minRotationToSnapToPreviousAngleForAngle1 = this.normalizeAngle(this.gameState.rotations[0] - (CONFIG.SNAP_EXTENSION + (CONFIG.SNAP_INTERVAL / 2)));
    let minRotationToSnapToNextAngleForAngle1 = this.normalizeAngle(this.gameState.rotations[0] + (CONFIG.SNAP_EXTENSION + (CONFIG.SNAP_INTERVAL / 2)));


    this.gameState.rawRotations[0] = this.normalizeAngle(angle1 - 270);
    this.gameState.rawRotations[1] = this.normalizeAngle(angle2 - 270);


    // let prevAngleConditionMet = !(this.gameState.rawRotations[0] > minRotationToSnapToPreviousAngleForAngle1);
    // let nextAngleConditionMet = !(this.gameState.rawRotations[0] < minRotationToSnapToNextAngleForAngle1);

    // if (!prevAngleConditionMet && !nextAngleConditionMet) return
    // console.log(this.angleDiff(this.gameState.rawRotations[0], minRotationToSnapToNextAngleForAngle1), this.angleDiff(this.gameState.rawRotations[0], minRotationToSnapToPreviousAngleForAngle1))
    if (!this.isAngleBetween(
      this.gameState.rawRotations[0],
      minRotationToSnapToNextAngleForAngle1,
      minRotationToSnapToPreviousAngleForAngle1
    )) return
    const snapped1 = this.gameState.snapToInterval ? this.snapAngle(angle1) : angle1;
    const snapped2 = this.gameState.snapToInterval ? this.snapAngle(angle2) : angle2;

    this.updateCursorRotation(0, snapped1);
    this.updateCursorRotation(1, snapped2);
  }

  angleDiff(a, b) {
    a = this.normalizeAngle(a);
    b = this.normalizeAngle(b);
    let d = a - b;
    d = (d + 180) % 360 - 180;
    return d;
  }

  isAngleBetween(angle, start, end) {
    angle = (angle + 360) % 360;
    start = (start + 360) % 360;
    end = (end + 360) % 360;

    if (start <= end) {
      // Normal interval
      return angle >= start && angle <= end;
    } else {
      // Wrapped interval (e.g. 350 -> 10)
      return angle >= start || angle <= end;
    }
  }

  updateCursorRotation(index, angle) {
    const cursor = index === 0 ? this.gameState.elements.cursor1 : this.gameState.elements.cursor2;
    if (cursor) {
      cursor.style.rotate = `${angle + CONFIG.ANGLE_OFFSET}deg`;
    }
  }

  snapAngle(angle) {
    return this.normalizeAngle(Math.round(angle / CONFIG.SNAP_INTERVAL) * CONFIG.SNAP_INTERVAL);
  }

  normalizeAngle(deg) {
    return ((parseFloat(deg) % 360) + 360) % 360;
  }

  findMatchingNotes(rotation) {
    return this.gameState.sheet.filter(note => {
      if (!note.element || note.done) return false;
      const matchesTime = (note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD;
      if (!matchesTime) return false; // avoid running the function if it doesn't match, save even the tiniest microsecond
      return this.isInArc(note, rotation);
    })
  }


  getSegment(rotation) {
    return rotation / CONFIG.ANGLE_MODIFIER
  }

  findClosestNote(notes) {
    return notes
      .filter(note => {
        if (note.swipe) return false;
        if (note.slider) {
          if (note.isBeingHeld || note.done || note.wasEverHeld) return false;
          if (note.sliderEnd < this.gameState.currentTime) return false;
          return Math.abs(note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD
        } else {
          if (note.done) return false;
          return Math.abs(note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD
        }
      }).sort((a, b) => a.time - b.time)[0];
  }

  holdSlider(note) {
    note.isBeingHeld = true;
    note.wasEverHeld = true;
    this.createNoteAura(note);
    this.gameState.scoringSystem.judge(note.time);
  }

  releaseSlider(note) {
    if (note.blockRelease && note.sliderEnd >= this.gameState.currentTime) return;
    note.isBeingHeld = false;
    const timeDiff = note.sliderEnd - (this.gameState.currentTime);
    note.element.parentElement.classList.remove('actively_pressed_in');
    if (timeDiff <= CONFIG.SLIDER_RELEASE_THRESHOLD) {
      note.done = true;
      this.gameState.scoringSystem.judge(note.sliderEnd, true, note);
      this.vibrate(2);
      this.createHoldEffect(note);
      note.element.parentElement.parentElement.parentElement.remove();
    } else {
      note.element.style.opacity = '0.5';
      note.element.style.scale = '1';
    }

    this.removeNoteAura(note);
  }

  hitNote(note, pointID) {
    this.gameState.scoringSystem.judge(note.time, true, note);

    if (note.flick || note.largeFlick) {
      this.startFlick(note);
      return;
    }

    note.done = true;

    if (note.hold && note.time < this.gameState.currentTime) {
      this.vibrate(3);
    } else {
      this.vibrate(2);
      this.createHoldEffect(note);
    }

    this.createNoteAura(note).then(() => {
      note.element.parentElement.parentElement.parentElement.remove();
    });
  }

  consumeEffect(type, angle, effectOffset = 0) {
    let consumable = this.gameState.effectItems.find(i => i.type === type && !i.inUse);
    if (!consumable) consumable = this.gameState.effectItems.find(i => i.type === type);
    consumable.inUse = true;
    consumable.parent.style.display = 'block';
    consumable.parent.style.rotate = `${(angle * CONFIG.SNAP_INTERVAL) + 90 + effectOffset}deg`;
    consumable.element.style.animationName = 'none';
    if (consumable.particleElement) {
      consumable.particleElement.style.animationName = 'none';
    }
    if (consumable.particleElementRepeat) {
      consumable.particleElementRepeat.style.animationName = 'none';
    }
    requestAnimationFrame(() => {
      consumable.element.style.animationName = '';
      if (consumable.particleElement) {
        consumable.particleElement.style.animationName = '';
      }
      if (consumable.particleElementRepeat) {
        consumable.particleElementRepeat.style.animationName = '';
      }
    });
    if (consumable.constant) return consumable;
    setTimeout(() => {
      consumable.parent.style.display = 'none';
      consumable.inUse = false;
    }, 900);
  }

  releaseEffect(effect) {
    if (effect.type == 'particles_constant') {
      effect.parent.style.opacity = '0';
      setTimeout(() => {
        effect.parent.style.display = 'none';
        effect.parent.style.opacity = null;
        effect.inUse = false;
      }, 250);
      return
    }
    effect.parent.style.display = 'none';
    effect.inUse = false;
  }

  createNoteAura(note) {
    return new Promise(res => {
      if (!note.slider && !note.swipe) {
        this.consumeEffect('particles', note.angle);
        this.consumeEffect('header_burst', note.angle);
      } else if (note.slider) {
        note.playingEffect = this.consumeEffect('header_constant', note.angle);
        note.playingEffects = this.consumeEffect('particles_constant', note.angle);
        note.element.classList.add('sfx_slider_hold');
      } else if (note.swipe) {
        this.consumeEffect('particles_swipe', note.angle, 180);
        this.consumeEffect('swipe_burst', note.angle, 180);
      }
      res(true);
    })
  }


  removeNoteAura(note) {
    if (note.playingEffect) {
      this.releaseEffect(note.playingEffect);
    }
    if (note.playingEffects) {
      this.releaseEffect(note.playingEffects);
    }
  }

  startFlick(note) {
    note.started = true;
    note.startedAt = this.gameState.currentTime;
    let relevantPoints = [];
    for (let [pointID, point] of this.points) {
      if (this.getSegment(point.angle) == note.angle) relevantPoints.push({
        id: pointID,
        rawAngle: point.rawAngle
      });
    }
    note.points = relevantPoints;
    if (note.largeFlick) {
      note.traceParent.style.opacity = 1;
    }
  }

  releaseFlick(note) {
    if (note.done) {
      this.createNoteAura(note)
      // note.element.classList.remove('flick1', 'flick2');
      note.element.parentElement.parentElement.classList.add('flicked_p');
      note.element.classList.add('flicked');
      note.element.parentElement.parentElement.style.rotate = `${(note.angle * CONFIG.ANGLE_MODIFIER) + (note.flickDirection == "2" ? -50 : 50) + 270}deg`;
      game.gameState.scoringSystem.judge(note.time, true, note);
      if (note.largeFlick) {
        game.gameState.scoringSystem.judge(note.flickEnd);
        note.traceParent.remove();
      }

      setTimeout(() => {
        note.element.parentElement.parentElement.parentElement.remove();
      }, 500);
      return;
    }
  }

  isInArc(note, rotation) {
    return note.angle == this.getSegment(rotation);
  }

  canBeHeld(note) {
    const currentTime = this.gameState.currentTime;
    if (note.slider) {
      return note.time - CONFIG.ACCEPTANCE_THRESHOLD < currentTime && currentTime <= note.sliderEnd;
    }
    return note.time - CONFIG.ACCEPTANCE_THRESHOLD < currentTime;
  }

  createHoldEffect(note, failed = false) {
    if (failed) {
    } else if (note.flickDirection) {
      note.element.style.setProperty('--t', `${Math.max(100, this.gameState.currentTime - note.flickMoment)}ms`);
      note.element.classList.add('flicked');
      if (this.gameState.gamepad) {
        this.vibrate(2);
      }
      setTimeout(() => {
        note.element.parentElement.parentElement.parentElement.remove();
      }, 500);
    }

  }

  vibrate(kind) {
    return
  }
}

// ============================================================================
// RENDERING SYSTEM
// ============================================================================
class RenderingSystem {
  constructor(gameState, timingSystem, inputSystem) {
    this.gameState = gameState;
    this.timingSystem = timingSystem;
    this.inputSystem = inputSystem;

    this.previewElements = [];
    this.cachePreviewElements();

    this.lastUpdateTime = 0;
    this.frameCount = 0;
  }

  cachePreviewElements() {
    for (let i = 0; i < CONFIG.PREVIEW_COUNT; i++) {
      this.previewElements[i] = document.getElementById(`previewer${i}`);
    }
  }


  update(currentTime) {
    this.updateNoteVisibility(currentTime);
    this.updatePreviewSectors();
    this.createNewNoteElements(currentTime);
    this.updateNotePositions(currentTime);
    this.cleanupFailedNotes(currentTime);
  }

  updatePreviewSectors() {
    const sectors = [
      (Math.round(this.normalizeAngle(this.gameState.rotations[0] + 270) / 60) + 1) % CONFIG.PREVIEW_COUNT,
      (Math.round(this.normalizeAngle(this.gameState.rotations[1] + 270) / 60) + 1) % CONFIG.PREVIEW_COUNT
    ];

    this.gameState.sectors = sectors;

    // Update both hover highlighting AND active press effects
    for (let i = 0; i < CONFIG.PREVIEW_COUNT; i++) {
      const preview_segment = this.previewElements[i];
      if (!preview_segment) continue;

      // Check if either cursor is in this sector (hover effect)
      const isHovered = (i === sectors[0] || i === sectors[1]);

      // Check if this sector is being actively pressed
      const isActive = (i === sectors[0] && this.gameState.keysPressed['w']) ||
        (i === sectors[1] && this.gameState.keysPressed['s']);
      // Apply hover effect
      if (isHovered) {
        preview_segment.classList.add('selected');
      } else {
        preview_segment.classList.remove('selected');
      }

      // Apply active press effect
      if (isActive) {
        preview_segment.classList.add('effect');
      } else {
        preview_segment.classList.remove('effect');
      }
    }
  }
  updateNoteVisibility(currentTime) {
    this.gameState.displayedNotes = this.gameState.displayedNotes.filter(
      note => !(note.done && currentTime - CONFIG.NOTE_PREVIEW_DELAY >= note.time)
    );
  }

  createNewNoteElements(currentTime) {
    const relevantNotes = this.gameState.sheet.filter(note => ((currentTime >= (note.startAt || note.time) - (CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION + CONFIG.CREATION_ANTIDELAY)) && !note.element));

    for (let i = 0; i < relevantNotes.length; i++) {
      const note = relevantNotes[i];
      if (!note.element) {
        this.createNoteElement(note);
      }
    }
  }

  createNoteElement(note) {
    const noteElement = document.createElement('div');
    noteElement.classList.add('item');

    const lane = document.createElement('div');
    lane.classList.add('lane');

    const laneParent = document.createElement('div');
    laneParent.classList.add('laneParent');

    const noteContainer = document.createElement('div');
    noteContainer.classList.add('noteContainer')

    const rotation = (note.angle * CONFIG.ANGLE_MODIFIER) + 270;
    lane.style.rotate = `${rotation}deg`;

    // Configure note type
    this.assembleNote(note, {
      noteElement,
      lane,
      noteContainer
    });

    laneParent.appendChild(lane);
    this.gameState.elements.container.appendChild(laneParent);

    // Set note reference
    note.element = noteElement;
    noteElement.style.setProperty('--r', rotation + 'deg');

    this.gameState.displayedNotes.push(note);
  }

  assembleNote(note, elements) {
    let { noteElement, lane, noteContainer } = elements;

    // Create a fragment to batch DOM operations
    const fragment = document.createDocumentFragment();

    if (note.slider) {
      noteElement.classList.add('slider');
      const actualHeight = ((note.sliderEnd - note.time) / CONFIG.NOTE_PREVIEW_DELAY) * (CONFIG.CONTAINER_REAL_RADIUS / 2);

      // noteElement.style.height = `${actualHeight + CONFIG.NOTE_RADIUS}px`;
      noteElement.style.translate = `0px`;

      noteElement.style.setProperty('--sliderHeight', `${actualHeight}px`);

      note.height = actualHeight;

      const header = document.createElement('div');
      header.classList.add('header', 'start');
      noteElement.appendChild(header);

      const frame = document.createElement('div');
      frame.classList.add('header', 'midframe');
      noteElement.appendChild(frame);
      note.midframe = frame;

      const header2 = document.createElement('div');
      header2.classList.add('header', 'end');
      if (note.holdableStart) {
        header2.classList.add('holdable_end');
      }
      if (note.holdableEnd) {
        if (note.flickableAway) {
          header.classList.add('flickable_away');
        } else {
          header.classList.add('holdable_start');
        }
      }

      const hint = document.createElement('div');
      hint.classList.add('hint');
      header2.appendChild(hint);
      hint.style.scale = 0;

      note.endElement = header2;
      note.startElement = header;
      note.hint = hint;

      noteElement.appendChild(header2);

      noteContainer.appendChild(noteElement);
    } else {
      noteElement.style.translate = `0px`;

      const header = document.createElement('div');
      if (!note.flick) {
        header.classList.add('header');
      } else {
        header.classList.add('flick_arrows');
        if (note.fromSlider) {
          header.classList.add('from_slider');
        }
      }
      noteElement.appendChild(header);

      if (!note.swipe) {
        const hint = document.createElement('div');
        hint.classList.add('hint');

        header.appendChild(hint);
        note.hint = hint;
      }

      if (note.holdable) {
        noteElement.classList.add('holdable');
      }
      if (note.golden) {
        noteElement.classList.add('golden');
      }

      if (note.swipe) {

        let traceParent = document.createElement('div');
        traceParent.classList.add('trace-parent');
        traceParent.style.rotate = ((note.angle * CONFIG.ANGLE_MODIFIER) + 300 + 150) + 'deg';

        let tracePath = document.createElement('div');
        tracePath.classList.add('traceable', `trace-normal`);
        traceParent.appendChild(tracePath);
        note.traceParent = traceParent;
        note.tracePath = tracePath;

        noteElement.style.setProperty('--duration', `${note.swipeEnd - note.time}ms`)

        this.gameState.elements.container.appendChild(traceParent);
        noteElement.classList.add('flick_large_starter');
        note.desiredAngle = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + 180));
        if (note.desiredAngle == 6) {
          note.desiredAngle = 0;
        }
      }

      noteContainer.appendChild(noteElement);
    }

    // Add noteContainer to fragment
    fragment.appendChild(noteContainer);

    // Append fragment into lane in one go
    lane.appendChild(fragment);
  }

  updateNotePositions(currentTime) {
    const sheet = this.gameState.sheet;
    for (let i = 0; i < sheet.length; i++) {
      const note = sheet[i];
      if (!note.done && note.element) {
        this.updateNote(note, currentTime);
      }
    }
  }

  updateNote(note, currentTime) {
    let noteTiming = this.timingSystem.getTiming(note, currentTime);
    var noteOffset = noteTiming?.offset;

    if (noteOffset != undefined && noteTiming?.from) {
      noteTiming = this.timingSystem.interpolateTimingPoint(currentTime - note.time, noteTiming, noteTiming.from)
    }


    if (note.slider) {
      return this.updateSliderPosition(note, currentTime, noteTiming);
    }

    if (note.swipe && !note.done) {
      this.updateSwipeHint(note, currentTime);
    }
    // rest in peace flicks, you won't be missed
    // else if (note.flick && !note.largeFlick) {
    //   this.updateFlickState(note, currentTime);
    // } else if (note.largeFlick) {
    //   this.updateLargeFlickState(note, currentTime);
    //   let duration = note.flickEnd - note.time;

    //   const elapsed = currentTime - note.time;

    //   const progress = Math.min(Math.max(elapsed / duration, 0), 1);
    //   duration = Math.max(duration, CONFIG.NOTE_PREVIEW_DELAY);
    //   const preprogress = Math.min(Math.max((elapsed + duration) / duration, 0), 1);
    //   note.traceParent.style.opacity = preprogress;
    //   note.traceParent.style.setProperty('--progression', 1 - progress);
    //   note.lastProgress = progress;
    // } else if (note.holdable && note.time < currentTime) {
    //   let isInArc0 = this.inputSystem.isInArc(note, this.gameState.rotations[0]);
    //   let isInArc1 = this.inputSystem.isInArc(note, this.gameState.rotations[1]);
    //   if ((isInArc0 && this.gameState.keysPressed['w']) || (isInArc1 && this.gameState.keysPressed['s'])) {
    //     this.inputSystem.hitNote(note, isInArc0 ? 0 : 1);
    //   }
    // }
    this.updateRegularNotePosition(note, currentTime, noteTiming);
  }

  updateSwipeHint(note, time) {
    if (note.time - time > (CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION)) return;
    if (note.time > time) {
      let noteAppearanceDuration = Math.max(note.swipeEnd - note.time, CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION);
      let noteAppearanceProgress = getProgress(time, note.time - noteAppearanceDuration, note.time);
      note.tracePath.style.opacity = noteAppearanceProgress;
    }
    if (note.time <= time) {
      note.tracePath.style.opacity = 1;
    }

    let progress = Math.min(getProgress(time, note.time, note.swipeEnd), 1);
    let offset = Math.floor(progress * 100);

    note.tracePath.style.translate = `0% ${-offset}%`;
    this.updateSwipeState(note);
  }

  updateSwipeState(note) {
    if (note.time - game.gameState.currentTime > CONFIG.SWIPE_PRECHECK) return;

    let foundNotePoints = note.points ? note.points : [];
    let finalNotePoints = [];
    for (let i = 0; i < foundNotePoints.length; i++) {
      let point = this.inputSystem.points.get(foundNotePoints[i]);
      if (!point) continue;
      let pointAngle = this.inputSystem.getSegment(point.angle);
      if (pointAngle == 6) pointAngle = 0;

      if (pointAngle == note.desiredAngle && point.distance > CONFIG.SWIPE_OUTWARDS_PROGRESS_THRESHOLD) {
        return this.inputSystem.swipeNote(note, point);
      }
      finalNotePoints.push(foundNotePoints[i]);
    }

    for (let [pointID, point] of this.inputSystem.points) {
      let pointAngle = this.inputSystem.getSegment(point.angle);
      if (pointAngle == 6) pointAngle = 0;
      if (!point.associatedNote && point.analog && (pointAngle == note.angle || pointAngle == note.desiredAngle)) {
        if (finalNotePoints.indexOf(pointID) == -1) finalNotePoints.push(pointID);
        if (!note.firstPointDetectedAt) note.firstPointDetectedAt = this.gameState.currentTime;
      }
    }

    note.points = finalNotePoints;
  }


  updateFlickState(note) {
    if (!(note.holdable || note.started)) return;

    let flickPoints = note.points ? note.points : [];
    let relevantPoints = [];
    for (let [pointID, point] of this.inputSystem.points) {
      let foundPoint = flickPoints.find(point => point.id == pointID);
      if (foundPoint) {
        relevantPoints.push({
          id: pointID,
          rawAngle: foundPoint.rawAngle
        });
        if (Math.abs(foundPoint.rawAngle - point.rawAngle) >= CONFIG.FLICK_THRESHOLD) {
          note.done = true;
          this.inputSystem.releaseFlick(note);
        }
      } else if (this.inputSystem.getSegment(point.angle) == note.angle) {
        relevantPoints.push({
          id: pointID,
          rawAngle: point.rawAngle
        })
      }
    }
    note.points = relevantPoints;
  }

  updateLargeFlickState(note) {
    if (!(note.holdable || note.started)) return;

    let flickPoints = note.points ? note.points : [];
    let relevantPoints = [];
    let desiredNoteSegment = this.inputSystem.getSegment(this.normalizeAngle((Number(note.angle) + Number(note.direction)) * CONFIG.ANGLE_MODIFIER));
    for (let [pointID, point] of this.inputSystem.points) {
      let foundPoint = flickPoints.find(point => point.id == pointID);
      if (foundPoint) {
        relevantPoints.push({
          id: pointID,
          startSegment: note.angle
        });
        if (this.inputSystem.getSegment(point.angle) == desiredNoteSegment && point.distance > CONFIG.LARGE_FLICK_OUTWARDS_PROGRESS_THRESHOLD) {
          note.done = true;
          this.inputSystem.releaseFlick(note);
        }
      } else if (this.inputSystem.getSegment(point.angle) == note.angle) {
        relevantPoints.push({
          id: pointID,
          startSegment: note.angle
        })
      }
    }
    note.points = relevantPoints;
  }

  updateSliderPosition(note, currentTime, timing) {
    const sliderMaxHeight = CONFIG.ADJUSTED_MAX_TRAVEL;
    const previewDelay = CONFIG.NOTE_PREVIEW_DELAY / (timing?.speed || 1);
    const offset = timing?.offset;
    const sliderEnd = note.sliderEnd;
    const sliderStart = note.time;
    if (offset) {
      currentTime = sliderStart + offset;
    }



    let scale = 1; // default once scaling is done
    let scaleStart = (sliderStart) - ((CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION));
    let scaleEnd = (sliderStart) - CONFIG.NOTE_PREVIEW_DELAY;
    if (!note.endedScale && currentTime >= scaleStart && currentTime <= scaleEnd) {
      // progress from 0 → 1 during the scale duration
      let progress = (currentTime - scaleStart) / CONFIG.SCALE_DURATION;
      scale = game.timingSystem.applyEasing(progress, '[0.49,0.14,0.74,0.96]');
    } else if (currentTime < scaleStart) {
      scale = 0;
    } else if (!note.endedScale && currentTime > scaleEnd) {
      scale = 1;
    }

    if ((Number(note.sliderEnd) + (CONFIG.ACCEPTANCE_THRESHOLD / 2)) <= currentTime) {
      let start = Number(note.sliderEnd) + Number(CONFIG.ACCEPTANCE_THRESHOLD / 2);
      let end = Number(note.sliderEnd) + Number(CONFIG.ACCEPTANCE_THRESHOLD);
      note.element.style.opacity = 1 - getProgress(currentTime, start, end);
    } else if (note.element.style.opacity != 1) {
      note.element.style.opacity = 1;
    }

    note.startElement.style.transform = `scale(${scale})`;
    note.endElement.style.transform = `scale(${scale})`;

    const maxHeight = ((sliderEnd - sliderStart) / previewDelay) * sliderMaxHeight;
    const progress = getProgress(currentTime + previewDelay, sliderStart, sliderEnd);
    if (note.hint) {
      note.hint.style.scale = getProgress(currentTime, sliderStart - previewDelay, sliderStart);
    }
    let currentHeight = progress * maxHeight;
    if ((currentTime + previewDelay) <= sliderEnd) {
      note.midframe.style.scale = `1 ${(currentHeight) / CONFIG.NOTE_RADIUS}`;
      note.element.style.translate = `0px ${sliderMaxHeight * -1}px`;
      note.endElement.style.translate = `0px ${currentHeight - (CONFIG.NOTE_RADIUS)}px`;
    } else {
      note.element.style.translate = `0px ${(currentHeight) - (maxHeight - (sliderMaxHeight * -1))}px`;
    }

    this.updateSliderHoldStatus(note);
    return
  }

  updateSliderHoldStatus(note) {
    let isBeingHeld = false;
    for (let [pointID, point] of this.inputSystem.points) {
      if (this.inputSystem.getSegment(point.angle) == note.angle && !point.analog) isBeingHeld = true;
    }
    if (isBeingHeld) {
      if ((note.holdableStart && !note.isBeingHeld && this.gameState.currentTime >= note.time) || (!note.isBeingHeld && note.wasEverHeld)) {
        this.inputSystem.holdSlider(note);
      }
    } else if (!isBeingHeld && note.isBeingHeld) {
      this.inputSystem.releaseSlider(note);
    }
  }

  updateRegularNotePosition(note, actualCurrentTime, timing) {
    const previewDelay = CONFIG.NOTE_PREVIEW_DELAY;
    const noteTime = note.time;
    let timeIntoPreview;
    let currentTime = actualCurrentTime;
    if (timing?.offset != undefined) {
      currentTime = noteTime + timing.offset;
    }

    const noteTravelMax = CONFIG.ADJUSTED_MAX_TRAVEL;  // Use CONTAINER_REAL_RADIUS
    let scale = 1; // default once scaling is done
    let scaleStart = (noteTime) - ((CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION));
    let scaleEnd = (noteTime) - CONFIG.NOTE_PREVIEW_DELAY;
    if (!note.endedScale && currentTime >= scaleStart && currentTime <= scaleEnd) {
      let progress = (currentTime - scaleStart) / CONFIG.SCALE_DURATION;
      scale = game.timingSystem.applyEasing(progress, '[0.49,0.14,0.74,0.96]');
    } else if (currentTime < scaleStart) {
      scale = 0;
    } else if (!note.endedScale && currentTime > scaleEnd) {
      scale = 1;
    }

    if ((Number(note.time) + (CONFIG.ACCEPTANCE_THRESHOLD / 2)) <= currentTime) {
      let start = Number(note.time) + Number(CONFIG.ACCEPTANCE_THRESHOLD / 2);
      let end = Number(note.time) + Number(CONFIG.ACCEPTANCE_THRESHOLD);
      note.element.style.opacity = 1 - getProgress(currentTime, start, end);
    } else if (note.element.style.opacity != 1) {
      note.element.style.opacity = 1;
    }

    note.element.style.transform = `scale(${scale})`;


    timeIntoPreview = Math.min(
      ((noteTime - currentTime) / previewDelay) * noteTravelMax,
      noteTravelMax
    );

    if (note.hint) {
      note.hint.style.scale = getProgress(currentTime + previewDelay, noteTime, noteTime + previewDelay);
    }

    const newTranslate = `0px ${timeIntoPreview * -1}px`;
    if (note.element.style.translate !== newTranslate) {
      note.element.style.translate = newTranslate;
    }
  }

  cleanupFailedNotes(currentTime) {
    for (let i = 0; i < this.gameState.sheet.length; i++) {
      const note = this.gameState.sheet[i];

      if (note.element && !note.done && note.time < currentTime && this.hasFailed(note, currentTime)) {
        if (note.element) {
          note.element.parentElement.parentElement.parentElement.remove();
        }
        if (note.traceParent) {
          note.traceParent.remove();
        }

        note.done = true;

        this.gameState.combo = 0;
        this.gameState.scoringSystem.updateComboDisplay();

        this.createFailedHoldEffect(note);
      }
    }
  }

  hasFailed(note, currentTime) {
    if (note.done) return false;

    if (note.slider || note.traceParent) {
      let failed = currentTime > ((note.sliderEnd || note.swipeEnd) + CONFIG.SLIDER_RELEASE_THRESHOLD);
      if (failed) {
        if (note.slider) this.inputSystem.releaseSlider(note);
        note.done = true;
      }
      return failed;
    }

    const failTime = note.flickEnd || note.failTime || note.time;
    let acceptance = CONFIG.ACCEPTANCE_THRESHOLD;
    if (note.flick) acceptance = CONFIG.FLICK_ACCEPTANCE_THRESHOLD;
    return (currentTime - failTime) > acceptance;
  }

  createFailedHoldEffect(note) {

  }

  normalizeAngle(deg) {
    return ((parseFloat(deg) % 360) + 360) % 360;
  }
}

// ============================================================================
// SCORING SYSTEM
// ============================================================================
class ScoringSystem {
  constructor(gameState) {
    this.gameState = gameState;
  }

  increaseScore(amount) {
    this.gameState.score += Number(amount) * Math.max(Math.min(8, this.gameState.combo), 1);
  }

  judge(noteTime, affectCombo = true, note, timeOverwrite = null) {
    if (!timeOverwrite) timeOverwrite = this.gameState.currentTime;
    if (note?.slider) return
    const currentTime = timeOverwrite;
    const difference = Math.abs(noteTime - currentTime);

    let accuracy = 'miss';
    for (const [key, range] of Object.entries(CONFIG.ACCURACY_RANGES)) {
      if (difference >= range[0] && difference < range[1]) {
        accuracy = key;
        break;
      }
    }

    let score = CONFIG.ACCURACY_SCORES[accuracy] || 0;
    this.increaseScore(score);
    if (affectCombo) {
      if (difference > 200 || isNaN(difference)) {
        this.gameState.combo = 0;
      } else {
        this.gameState.combo++;
      }
      this.updateComboDisplay();
    }

    this.gameState.elements.perfectionIndicator.style.backgroundImage = `url('./Assets/Scoring/${accuracy}.svg')`;
    this.gameState.elements.perfectionIndicator.style.animationName = 'none'
    requestAnimationFrame(() => { this.gameState.elements.perfectionIndicator.style.animationName = null });
    this.gameState.scoringPad[accuracy].push(noteTime - currentTime);
    try {
      this.gameState.playHitSound(note)
    } catch (error) { console.log(error) }
    return accuracy;
  }

  updateComboDisplay() {
    const comboText = `${this.gameState.combo}`;
    if (this.gameState.elements.comboDisplay.innerHTML !== comboText) {
      this.gameState.elements.comboDisplay.style.animation = 'none';
      this.gameState.elements.comboDisplay.innerHTML = comboText;
      setTimeout(() => {
        this.gameState.elements.comboDisplay.style.animation = null;
      }, 20);
    }
  }
}

// ============================================================================
// MAIN GAME CLASS
// ============================================================================
class RhythmGame {
  constructor() {
    this.gameState = new GameState();
    this.timingSystem = new TimingSystem();
    this.inputSystem = new InputSystem(this.gameState, this.timingSystem);
    this.renderingSystem = new RenderingSystem(this.gameState, this.timingSystem, this.inputSystem);
    this.scoringSystem = new ScoringSystem(this.gameState);

    // Add references to gameState
    this.gameState.scoringSystem = this.scoringSystem;
    this.gameState.timingSystem = this.timingSystem;

    // hit sound buffers
    this.gameState.hitBuffer = [];


    // initialize audio and then start loop
    requestAnimationFrame(() => {
      this.init();
    })
  }

  async init() {
    let audioPaths = {
      'hit': './Assets/hit_normal.mp3',
      'flick': './Assets/flick.mp3',
      'golden': './Assets/golden_hit.mp3',
      'holdable': './Assets/hit_holdable.mp3'
    };

    this.gameState.loadedAudios = {};
    for (let type in audioPaths) {
      const data = fs.readFileSync(audioPaths[type]);
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      let hitSoundBuffer = await game.gameState.audioContext.decodeAudioData(arrayBuffer);
      this.gameState.loadedAudios[type] = hitSoundBuffer;
    }

    // Start game loop now that audio is ready
    this.gameState.playHitSound = this.playHitSound.bind(this);

    await new Promise((res) => {
      setTimeout(() => {
        res()
      }, CONFIG.INITIAL_DELAY);
    })
    loadTime = performance.now();

    await this.gameState.initializeAudio();

    this.startGameLoop();
  }

  playHitSound(note) {
    const source = this.gameState.audioContext.createBufferSource();
    let determinedBuffer = this.gameState.loadedAudios['hit'];
    if (note?.flick) {
      determinedBuffer = this.gameState.loadedAudios['flick'];
    }
    if (note?.golden) {
      determinedBuffer = this.gameState.loadedAudios['golden']
    }
    if (note?.holdable) {
      determinedBuffer = this.gameState.loadedAudios['holdable']
    }
    source.buffer = determinedBuffer;
    source.connect(this.gameState.audioContext.destination);
    source.start();
  }

  startGameLoop() {
    const gameLoop = (timestamp) => {
      if (this.gameState.paused || this.gameState.ended) return;
      const currentTime = this.gameState.currentTime;
      if ((currentTime) > this.gameState.endsAt) return this.endGame();

      // Update gamepad input
      this.inputSystem.updateGamepadInput();

      // Update rendering
      this.renderingSystem.update(currentTime);

      // (Global) Update global timing point
      this.timingSystem.updateGlobalTimingPoint(this.gameState.timeSheet, currentTime);

      if (CONFIG.AUTOPLAY && game.inputSystem) {
        game.inputSystem.handleAutoplay(currentTime)
      }

      // Continue loop
      requestAnimationFrame(gameLoop);
    };

    requestAnimationFrame(gameLoop);
  }

  pauseGame() {
    if (this.gameState.paused) return this.unpauseGame();
    this.gameState.audioContext.suspend();
    this.gameState.paused = true;
    this.gameState.elements.noteContainerFrame.parentElement.parentElement.style.opacity = 0;
    this.gameState.elements.noteContainerFrame.parentElement.style.scale = 0.9;
    this.gameState.elements.pauseButton.firstElementChild.classList.remove('pause');
    this.gameState.elements.pauseButton.firstElementChild.classList.add('play');
    this.gameState.elements.songData.style.scale = 1.2;
    this.gameState.elements.songArt.classList.add('viewing');
    this.gameState.elements.backButton.classList.remove('hiddenButton');
    this.gameState.elements.restartButton.classList.remove('hiddenButton');
    document.getElementById('pauseButton').classList.add('controller_selectable', 'selected');
    document.getElementById('restartButton').classList.add('controller_selectable');
    document.getElementById('backButton').classList.add('controller_selectable');
    let cc = document.createElement('script');
    cc.src = '../Utilities/controller-control.js'
    document.head.appendChild(cc);
    this.gameState.pauseScript = cc;
  }

  unpauseGame(force) {
    document.getElementById('pauseButton').classList.remove('controller_selectable', 'selected');
    document.getElementById('restartButton').classList.remove('controller_selectable', 'selected');
    document.getElementById('backButton').classList.remove('controller_selectable', 'selected');
    if (!force && this.gameState.ended) return;
    this.gameState.audioContext.resume();
    this.gameState.paused = false;
    this.gameState.elements.noteContainerFrame.parentElement.parentElement.style.opacity = 1;
    this.gameState.elements.noteContainerFrame.parentElement.style.scale = 1;
    this.gameState.elements.pauseButton.firstElementChild.classList.remove('play');
    this.gameState.elements.pauseButton.firstElementChild.classList.add('pause');
    this.gameState.elements.songData.style.scale = 1;
    this.gameState.elements.songArt.classList.remove('viewing');
    this.gameState.elements.backButton.classList.add('hiddenButton');
    this.gameState.elements.restartButton.classList.add('hiddenButton');
    this.gameState.pauseScript.remove();
    this.startGameLoop();
    pollGamepads = null;
  }

  endGame() {
    this.gameState.elements.controls.style.opacity = 0;
    this.gameState.elements.controls.style.scale = 0.9;
    this.gameState.ended = true;
    this.gameState.elements.noteContainerFrame.parentElement.parentElement.style.opacity = 0;
    let cc = document.createElement('script');
    cc.src = '../Utilities/controller-control.js'
    document.head.appendChild(cc);
    setTimeout(() => {
      document.getElementById('buttons').remove();
      this.gameState.elements.controls.classList.add('end_controls');
      document.getElementById('gradeParent').classList.add('end_gradeParent');
    }, CONFIG.LONG_ANIMATION);
    setTimeout(() => {
      this.gameState.elements.controls.style.opacity = 1;
      this.gameState.elements.controls.style.scale = 1;
      this.gameState.elements.scoreText.classList.add('end_scoreText');
      this.gameState.elements.scoreNumber.classList.add('end_scoreNumber');
      let scoreStats = document.getElementById('scoreStats');
      let totalNotesHit = this.gameState.scoringPad.perfect.length + this.gameState.scoringPad.great.length + this.gameState.scoringPad.ok.length + this.gameState.scoringPad.bad.length;
      let totalNotes = this.gameState.sheet.length;
      scoreStats.innerHTML = `
      <btext id="hitCounts"><span>${(totalNotesHit / totalNotes) * 100}%</span> <span>${totalNotesHit}/${totalNotes}</span></btext> • 
      <btext id="maxCombo"><span>Max Combo</span> <span>Unknown</span></btext>
      <br>
        <div class="scoreIndicator flexbox perfect"><div class="label">PERFECT</div><div class="count">${this.gameState.scoringPad.perfect.length}</div></div>
        <div class="scoreIndicator flexbox great"><div class="label">GREAT</div><div class="count">${this.gameState.scoringPad.great.length}</div></div>
        <div class="scoreIndicator flexbox okay"><div class="label">OKAY</div><div class="count">${this.gameState.scoringPad.ok.length}</div></div>
        <div class="scoreIndicator flexbox bad"><div class="label">BAD</div><div class="count">${this.gameState.scoringPad.bad.length}</div></div>
        <div class="scoreIndicator flexbox miss"><div class="label">MISS</div><div class="count">${this.gameState.scoringPad.miss.length}</div></div>
      `
      document.getElementById('grade').innerHTML = `
      <btextm style="color: var(--perfect); border-color: var(--perfect);">A</btextm>
      `

      document.getElementById('songProcedureControls').innerHTML = `
      <btn class="controller_selectable">Replay</btn>
      <btn class="controller_selectable" onclick="location.href = '../Picker/LevelPicker.html'">Home</btn>
      `
    }, CONFIG.LONG_ANIMATION * 2);
  }

  uninitializeGame(callback) {
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundColor = 'black';
    document.body.style.backgroundPositionY = '100vh';
    this.gameState.elements.controls.style.opacity = 0;
    document.body.style.animation = 'none';
    setTimeout(() => {
      if (callback) callback();
      window.location.href = '../Picker/LevelPicker.html'
    }, 500);
  }

}
// ============================================================================
// INITIALIZATION
// ============================================================================
const game = new RhythmGame();