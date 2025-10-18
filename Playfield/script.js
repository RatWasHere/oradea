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

  NOTE_RADIUS: 150,

  SCALE_DURATION: 0,

  NOTE_PREVIEW_DELAY: 530,
  CREATE_AT_DISTANCE_OF: 0,

  // ===== CONTAINERS =====
  CONTAINER_RADIUS: 220,
  // CONTAINER_REAL_RADIUS: 400,
  CONTAINER_REAL_RADIUS: 630,
  ADJUSTED_MAX_TRAVEL: 0,
  START_OFFSET: 0,
  CREATION_ANTIDELAY: 5000,

  // TIMING & INPUT
  GAMEPAD_DEADZONE: 0.1,

  FLICK_THRESHOLD: 20,
  FLICK_OFFSET: 20,
  LARGE_FLICK_OUTWARDS_PROGRESS_THRESHOLD: 0.99,

  // SCORING
  ACCEPTANCE_THRESHOLD: 500,
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

  AUTOPLAY: true
};
// translateY(calc((var(--sr) + (var(--s) - var(--sr)) * 2) / 2))
// calc((var(--sr) / 2) - var(--tlr))
CONFIG.CONTAINER_REAL_RADIUS = CONFIG.CONTAINER_REAL_RADIUS
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

    let lastNote = this.sheet[this.sheet.length - 1];
    this.endsAt = lastNote.time + (lastNote.duration || (lastNote.time - lastNote.flickEnd) || (lastNote.time - lastNote.endsAt) || 0) + CONFIG.ACCEPTANCE_THRESHOLD;

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
    };

    this.effectItems = []
    for (let i = 0; i < 8; i++) {
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
    for (let i = 0; i < 6; i++) {
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

    for (let i = 0; i < 4; i++) {
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

    for (let i = 0; i < 4; i++) {
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

    for (let i = 0; i < 4; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let header = document.createElement('div');
      header.classList.add('sfx_flick_particle');
      parent.appendChild(header);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: header,
        inUse: false,
        type: 'flick_particles'
      });
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
    // Load beatmap audio into an AudioBuffer and start playback via AudioContext
    const filePath = `./Beatmaps/${this.crossDetails.location}/audio.mp3`;
    const fileBuf = fs.readFileSync(filePath);
    const arrayBuffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.length);
    // decodeAudioData returns a Promise on modern browsers; handle both signatures
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    // Create a source and start immediately
    if (this.audioSource) {
      try { this.audioSource.stop(); } catch (e) { }
      this.audioSource.disconnect();
    }
    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.audioContext.destination);
    this.audioSource.start(0);
    this.audioStartTime = this.audioContext.currentTime;
    this.paused = false;
  }

  get currentTime() {
    if (!this.audioBuffer || !this.audioStartTime) return 0;
    return ((this.audioContext.currentTime - this.audioStartTime) * 1000)
  }
}
// ============================================================================
// TIMING SYSTEM - FIXED VERSION
// ============================================================================
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
    const timingPoint = note.timeSheet ? this.getTimingPointAt(time, note.timeSheet, note) : this.globalTimingPoint;
    if (timingPoint.style) {
      this.applyNoteStyles(timingPoint, note);
    }
    if (note.timeSheet) {
      timingPoint.default = false;
    } else {
      timingPoint.default = true;
    }
    return timingPoint;
  }

  updateGlobalTimingPoint(sheet, time) {
    const timingPoint = this.getTimingPointAt(time, sheet, { speed: 1, offset: 0 });
    this.globalTimingPoint = timingPoint;
    if (timingPoint.style) {
      this.applySegmentStyles(timingPoint);
    }
    if (timingPoint.flickers) {
      this.applyFlickers(timingPoint)
    }
  }

  getTimingPointAt(time, timingSheet, defaultPoint = { speed: 1, offset: 0 }) {
    if (!timingSheet) return defaultPoint;

    let activePoint = {};

    for (let i = 0; i < timingSheet.length; i++) {
      const point = timingSheet[i];
      if (typeof point.time == 'object') {
        point.time = this.fromSpecial(point.time);
      }
      const pointStartTime = parseFloat(point.time) + (defaultPoint.time ? parseFloat(defaultPoint.time) : 0);

      if (pointStartTime <= time) {
        activePoint.offset = this.fromSpecial(point.offset);
        activePoint.speed = point.speed;
        activePoint.time = pointStartTime;
        activePoint.transition = this.fromSpecial(point.transition);
        activePoint.easing = point.easing || 'linear';
        activePoint.style = point.style || {};
        activePoint.from = point.from || {};
        activePoint.note = point.note || null;

        if (activePoint.from?.offset) {
          activePoint.from.offset = this.fromSpecial(activePoint.from.offset);
        }
      }
    }

    if (activePoint.time == undefined) return defaultPoint;

    const timing = this.interpolateTimingPoint(time, activePoint, defaultPoint);
    activePoint.speed = timing.speed;
    activePoint.offset = timing.offset;
    return activePoint;
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
      Object.entries(timingPoint.style.parent).forEach(([key, value]) => {
        parentElement.style.setProperty(key, value);
      });
    }

    // Apply child styles
    if (timingPoint.style.child) {
      const childElement = noteElement.parentElement;
      Object.entries(timingPoint.style.child).forEach(([key, value]) => {
        childElement.style.setProperty(key, value);
      });
    }

    if (timingPoint.style.header) {
      const childElement = noteElement;
      Object.entries(timingPoint.style.header).forEach(([key, value]) => {
        childElement.style.setProperty(key, value);
      });
    }
  }

  applySegmentStyles(timingPoint) {
    if (timingPoint.style.segments) {
      let previewers = game.gameState.elements.previewers;
      previewers.forEach((previewer, index) => {
        const segmentStyle = timingPoint.style.segments[index];
        if (segmentStyle) {
          Object.entries(segmentStyle).forEach(([key, value]) => {
            previewer.style.setProperty(key, value);
          });
        }
      });
    }
  }

  interpolateTimingPoint(time, activePoint, defaultPoint) {
    const startTime = parseFloat(activePoint.time);
    // console.log(startTime, activePoint.time, defaultPoint?.time)
    const transition = parseFloat(activePoint.transition || 0);

    // If no transition, return the active point values
    if (!transition) {
      return {
        speed: parseFloat(activePoint.speed ?? defaultPoint.speed),
        offset: parseFloat(activePoint.offset ?? defaultPoint.offset)
      };
    }

    const endTime = startTime + transition;

    let speedFrom = defaultPoint.speed, offsetFrom = defaultPoint.offset;

    if (activePoint.from) {
      speedFrom = parseFloat(activePoint.from.speed ?? defaultPoint.speed);
      offsetFrom = parseFloat(activePoint.from.offset ?? defaultPoint.offset);
    } else {
      return {
        speed: parseFloat(activePoint.speed ?? defaultPoint.speed),
        offset: parseFloat(activePoint.offset ?? defaultPoint.offset)
      }
    }

    const speedTo = parseFloat(activePoint.speed ?? defaultPoint.speed);
    const offsetTo = parseFloat(activePoint.offset ?? defaultPoint.offset);

    // If we're past the transition end, return end values
    if (time >= endTime) {
      return {
        speed: speedTo,
        offset: offsetTo
      };
    }

    // If we're before the transition start, return start values
    if (time < startTime) {
      return {
        speed: speedFrom,
        offset: offsetFrom
      };
    }

    // Calculate interpolation progress (0 to 1)
    const progress = (time - startTime) / transition;
    // Apply easing function if specified
    const easedProgress = this.applyEasing(progress, activePoint.easing);

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
      let endValue = CONFIG.NOTE_PREVIEW_DELAY;
      value.forEach((item) => {
        endValue = this.processSpecialItem(item, endValue);
      });
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
    this.setupEventListeners();
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
        console.log(note.sliderEnd, currentTime)
        this.releaseSlider(note);
      } else if (note.flick && !note.done) {
        if (note.input == undefined) {
          this.startFlick(note, 1);
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
    if (this.gameState.phone) return;

    const gamepad = navigator.getGamepads()[0];
    if (!gamepad) return;

    this.updateGamepadRotations(gamepad);
    this.updateGamepadButtons(gamepad);
  }

  updateGamepadRotations(gamepad) {
    // Left stick is cursor1
    const x1 = gamepad.axes[0];
    const y1 = gamepad.axes[1];
    if (Math.abs(x1) > CONFIG.GAMEPAD_DEADZONE || Math.abs(y1) > CONFIG.GAMEPAD_DEADZONE) {
      const angle1 = Math.atan2(y1, x1) * (180 / Math.PI);

      const mag1 = Math.min(Math.sqrt(x1 * x1 + y1 * y1), 1);
      this.gameState.centerDistance[0] = mag1;

      const extendedSnap1 = this.extendedSnapAngle(angle1, 0);
      if (extendedSnap1 !== null) {
        this.gameState.rawRotations[0] = angle1;
        this.updateCursorRotation(0, extendedSnap1);
      }
    }

    // Right stick is cursor2
    const x2 = gamepad.axes[2];
    const y2 = gamepad.axes[3];
    if (Math.abs(x2) > CONFIG.GAMEPAD_DEADZONE || Math.abs(y2) > CONFIG.GAMEPAD_DEADZONE) {
      const angle2 = Math.atan2(y2, x2) * (180 / Math.PI);

      const mag2 = Math.min(Math.sqrt(x2 * x2 + y2 * y2), 1);
      this.gameState.centerDistance[1] = mag2;

      const extendedSnap2 = this.extendedSnapAngle(angle2, 1);
      if (extendedSnap2 !== null) {
        this.gameState.rawRotations[1] = angle2;
        this.updateCursorRotation(1, extendedSnap2);
      }
    }
  }

  /**
   * Extended snapping for controller segments.
   * Only snaps if the angle is within the extended segment range.
   * Returns snapped angle or null if not in extended range.
   */
  extendedSnapAngle(angle, cursorIndex) {
    // Segment size is SNAP_INTERVAL (e.g., 45deg)
    const segmentSize = CONFIG.SNAP_INTERVAL;
    const extension = CONFIG.SNAP_EXTENSION; // degrees to extend on both sides

    // Calculate which segment the cursor is currently in
    const baseAngle = this.snapAngle(angle);
    const normalizedAngle = this.normalizeAngle(angle);

    // Find the segment center
    const segmentCenter = Math.round(normalizedAngle / segmentSize) * segmentSize;

    // Extended segment range
    const start = this.normalizeAngle(segmentCenter - (segmentSize / 2) - extension);
    const end = this.normalizeAngle(segmentCenter + (segmentSize / 2) + extension);

    // Check if angle is within extended segment
    // Handle wrap-around
    let inSegment;
    if (start < end) {
      inSegment = normalizedAngle >= start && normalizedAngle <= end;
    } else {
      inSegment = normalizedAngle >= start || normalizedAngle <= end;
    }

    if (inSegment) {
      return segmentCenter;
    }
    return null;
  }

  updateGamepadButtons(gamepad) {
    const leftTrigger = gamepad.buttons[6]?.pressed || gamepad.buttons[4]?.pressed;
    const rightTrigger = gamepad.buttons[7]?.pressed || gamepad.buttons[5]?.pressed;

    this.updateTriggerState('w', leftTrigger, 0);
    this.updateTriggerState('s', rightTrigger, 1);
  }

  updateTriggerState(key, pressed, cursorIndex) {
    if (pressed && !this.gameState.keysPressed[key]) {
      this.gameState.keysPressed[key] = true;
      this.processNoteHold(key);
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

    this.gameState.rotations[index] = this.normalizeAngle(angle - 270);
  }

  snapAngle(angle) {
    return this.normalizeAngle(Math.round(angle / CONFIG.SNAP_INTERVAL) * CONFIG.SNAP_INTERVAL);
  }

  normalizeAngle(deg) {
    return ((parseFloat(deg) % 360) + 360) % 360;
  }

  processNoteHold(key) {
    const isW = key === 'w';
    const laneIndex = isW ? 0 : 1;
    const rotation = this.gameState.rotations[laneIndex];

    const matchingNotes = this.findMatchingNotes(laneIndex, rotation);

    // Handle sliders first
    const closestNote = this.findClosestNote(matchingNotes, rotation);
    if (closestNote) {
      if (closestNote.slider) {
        if (!(closestNote.holdableStart ? game.gameState.currentTime >= closestNote.time : true)) return;
        this.holdSlider(closestNote);
        return
      }
      this.hitNote(closestNote, laneIndex);
    }
  }

  processNoteRelease(key) {
    const isW = key === 'w';
    const laneIndex = isW ? 0 : 1;
    const rotation = this.gameState.rotations[laneIndex];

    const matchingNotes = this.findMatchingNotes(laneIndex, rotation);
    for (let i = 0; i < matchingNotes.length; i++) {
      const note = matchingNotes[i];
      if (note.flickStart && note.input === laneIndex && !note.done) {
        this.releaseFlick(note);
      }
      if (note.slider && note.isBeingHeld && !(
        this.isInArc(note, this.gameState.rotations[isW ? 1 : 0]) && this.gameState.keysPressed[isW ? 's' : 'w']
      )) {
        this.releaseSlider(note);
      }
    }
  }

  findMatchingNotes(laneIndex, rotation) {
    return this.gameState.sheet.filter(note => {
      if (!note.element || note.done) return false;

      const matchesInput = !note.requiredInput || note.requiredInput === (laneIndex + 1);
      const matchesTime = (note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD;
      const inArc = this.isInArc(note, rotation);

      return matchesInput && inArc;
    });
  }


  findClosestNote(notes) {
    return notes
      .filter(note => note.slider ?
        (!note.isBeingHeld && !note.done && ((Math.abs(note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD) || note.sliderEnd > this.gameState.currentTime))
        : (Math.abs(note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD))
      .sort((a, b) => a.time - b.time)[0];
  }

  holdSlider(note) {
    note.isBeingHeld = true;
    note.wasEverHeld = true;
    this.createNoteAura(note)
  }

  releaseSlider(note) {
    if (note.blockRelease && note.sliderEnd >= this.gameState.currentTime) return;
    note.isBeingHeld = false;
    const timeDiff = Math.abs(note.sliderEnd - (this.gameState.currentTime));
    note.element.parentElement.classList.remove('actively_pressed_in');
    if (Math.abs(timeDiff) <= CONFIG.ACCEPTANCE_THRESHOLD) {
      note.done = true;
      this.gameState.scoringSystem.judge(note.sliderEnd);
      this.vibrate(2);
      this.createHoldEffect(note);
      note.element.parentElement.parentElement.parentElement.remove();
    } else {
      note.element.style.opacity = '0.5';
      note.element.style.scale = '1';
    }

    this.removeNoteAura(note);
  }

  hitNote(note, laneIndex) {
    this.gameState.scoringSystem.judge(note.time);

    if (note.flick || note.startLargeFlick || note.largeFlick) {
      this.startFlick(note, laneIndex);
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

  consumeEffect(type, angle) {
    let consumable = this.gameState.effectItems.find(i => i.type === type && !i.inUse);
    if (!consumable) consumable = this.gameState.effectItems.find(i => i.type === type);
    consumable.inUse = true;
    consumable.parent.style.display = 'block';
    consumable.parent.style.rotate = `${(angle * CONFIG.SNAP_INTERVAL) + 90}deg`;
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
    }, 1000);
  }

  releaseEffect(effect) {
    effect.parent.style.display = 'none';
    effect.inUse = false;
  }

  createNoteAura(note) {
    return new Promise(res => {
      if (!note.slider && !note.flick && !note.largeFlick) {
        this.consumeEffect('particles', note.angle);
        this.consumeEffect('header_burst', note.angle);
      } else if (note.slider) {
        note.playingEffect = this.consumeEffect('header_constant', note.angle);
        note.playingEffect = this.consumeEffect('particles_constant', note.angle);
        note.element.classList.add('sfx_slider_hold');
      }
      res(true);
    })
  }


  removeNoteAura(note) {
    if (note.currentEffect) {
      this.releaseEffect(note.currentEffect);
    }
  }

  startFlick(note, laneIndex) {
    note.flickStart = this.gameState.rawRotations[laneIndex];
    note.input = laneIndex;
    note.flickMoment = this.gameState.currentTime;
    note.rotations = this.gameState.rawRotations;
    this.vibrate(4);
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
      game.gameState.scoringSystem.judge(note.time);
      if (note.largeFlick) {
        game.gameState.scoringSystem.judge(note.flickEnd);
        note.traceParent.remove();
      }

      setTimeout(() => {
        note.element.parentElement.parentElement.parentElement.remove();
      }, 500);
      return;
    }
    note.flickStart = null;
    note.flickMoment = null;
    note.input = null;
  }

  isInArc(note, rotation) {
    const normalizedRotation = this.normalizeAngle(rotation);
    const noteStartAngle = this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + CONFIG.ANGLE_OFFSET - (CONFIG.NOTE_ARC_ANGLE / 2));
    const noteEndAngle = this.normalizeAngle(noteStartAngle + CONFIG.NOTE_ARC_ANGLE);

    if (noteStartAngle < noteEndAngle) {
      return normalizedRotation >= noteStartAngle && normalizedRotation <= noteEndAngle && !note.done;
    } else {
      return (normalizedRotation >= noteStartAngle || normalizedRotation <= noteEndAngle) && !note.done;
    }
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
    if (!this.gameState.gamepad?.vibrationActuator) return;
    const vibrationSettings = {
      1: { startDelay: 0, duration: 100, weakMagnitude: 0.5, strongMagnitude: 0.7, leftTrigger: 1, rightTrigger: 1 },
      2: { startDelay: 0, duration: 50, weakMagnitude: 1, strongMagnitude: 1, leftTrigger: 1, rightTrigger: 1 },
      3: { startDelay: 0, duration: 150, weakMagnitude: 1, strongMagnitude: 1 },
      4: { startDelay: 0, duration: 50, weakMagnitude: 0, strongMagnitude: 0.1 }
    };

    const settings = vibrationSettings[kind];
    if (!settings) return;

    if (kind === 3) {
      this.gameState.gamepad.vibrationActuator.playEffect("dual-rumble", settings);
      setTimeout(() => {
        this.gameState.gamepad.vibrationActuator.playEffect("trigger-rumble", {
          startDelay: 0, duration: 50, weakMagnitude: 0.5, strongMagnitude: 1,
          leftTrigger: 0.5, rightTrigger: 0.5
        });
      }, 50);
    } else {
      const effectType = kind === 4 ? "dual-rumble" : "trigger-rumble";
      this.gameState.gamepad.vibrationActuator.playEffect(effectType, settings);
    }
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

      // Build sub-elements in memory
      const header = document.createElement('div');
      header.classList.add('header', 'start');
      noteElement.appendChild(header);


      const frame = document.createElement('div');
      frame.classList.add('header', 'midframe');
      noteElement.appendChild(frame);

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
      noteElement.appendChild(header2);

      // Put assembled noteElement inside noteContainer
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

      if (note.holdable) {
        noteElement.classList.add('holdable');
      }
      if (note.flick && !note.largeFlick) {
        if (note.holdable) {
          noteElement.classList.add(`flick${note.flickDirection}`, 'holdable_flick');
        } else {
          noteElement.classList.add(`flick${note.flickDirection}`);
        }
      }
      if (note.golden) {
        noteElement.classList.add('golden');
      }

      if (note.largeFlick) {
        let traceParent = document.createElement('div');
        traceParent.classList.add('trace-parent');
        traceParent.style.rotate = ((note.angle * CONFIG.ANGLE_MODIFIER) + 300 + 120) + 'deg';
        let tracePath = document.createElement('div');
        let traceType = Math.abs(note.direction);
        tracePath.classList.add('traceable', `trace-${Number(note.direction) > 0 ? "positive" : "negative"}`, `trace-${traceType}`);
        tracePath.style.setProperty('--duration', `${note.flickEnd - note.time}ms`)
        traceParent.appendChild(tracePath)
        note.traceParent = traceParent;
        note.tracePath = tracePath;
        this.gameState.elements.container.appendChild(traceParent);
        noteElement.classList.add('flick_large_starter')
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
    const noteTiming = this.timingSystem.getTiming(note, currentTime);

    if (note.slider) {
      return this.updateSliderPosition(note, currentTime, noteTiming);
    } else if (note.flick || note.largeFlick) {
      if (note.largeFlick && note.tracePath) {
        let duration = note.flickEnd - note.time;

        // time passed since the flick started
        const elapsed = currentTime - note.time;

        // clamp between 0 and 1
        const progress = Math.min(Math.max(elapsed / duration, 0), 1);
        duration = Math.max(duration, CONFIG.NOTE_PREVIEW_DELAY);
        const preprogress = Math.min(Math.max((elapsed + duration) / duration, 0), 1);
        note.traceParent.style.opacity = preprogress;
        note.traceParent.style.setProperty('--progression', 1 - progress);
        note.lastProgress = progress;
      }

      if (note.rotations) {
        if (note.largeFlick) {
          let desiredRotation = this.inputSystem.normalizeAngle(((Number(note.angle) + Number(note.direction)) * CONFIG.ANGLE_MODIFIER) + CONFIG.ANGLE_OFFSET);
          let currentRotation = this.gameState.rotations[note.input];
          if (currentRotation == desiredRotation && this.gameState.centerDistance[note.input] > CONFIG.LARGE_FLICK_OUTWARDS_PROGRESS_THRESHOLD) {
            note.done = true;
            this.inputSystem.releaseFlick(note);
          }
        } else {
          const input = note.input;
          const desiredFlickOffset = (CONFIG.FLICK_OFFSET * (note.flickDirection == "2" ? 1 : -1));
          const desiredAngle = note.flickStart + desiredFlickOffset;
          const currentAngle = this.gameState.rawRotations[input];
          const flickDiff = currentAngle - desiredAngle;
          const desiredThreshold = CONFIG.FLICK_THRESHOLD;

          if (Math.abs(flickDiff) > desiredThreshold) {
            note.done = true;
            this.inputSystem.releaseFlick(note);
          }
        }
      } else {
        if (note.holdable) {
          if ((this.gameState.keysPressed['w'] && this.inputSystem.isInArc(note, this.gameState.rotations[0])) ||
            (this.gameState.keysPressed['s'] && this.inputSystem.isInArc(note, this.gameState.rotations[1]))) {
            const laneIndex = this.gameState.keysPressed['w'] ? 0 : 1;
            this.inputSystem.startFlick(note, laneIndex);
          }
        }
      }
    } else if (note.holdable && note.time < currentTime) {
      let isInArc0 = this.inputSystem.isInArc(note, this.gameState.rotations[0]);
      let isInArc1 = this.inputSystem.isInArc(note, this.gameState.rotations[1]);
      if ((isInArc0 && this.gameState.keysPressed['w']) || (isInArc1 && this.gameState.keysPressed['s'])) {
        this.inputSystem.hitNote(note, isInArc0 ? 0 : 1);
      }
    }
    this.updateRegularNotePosition(note, currentTime, noteTiming);
  }

  updateSliderPosition(note, currentTime, timing) {
    const sliderMaxHeight = CONFIG.ADJUSTED_MAX_TRAVEL;

    const previewDelay = CONFIG.NOTE_PREVIEW_DELAY / (timing.speed || 1);
    const offset = timing.offset;

    const sliderEnd = note.sliderEnd;
    const sliderStart = note.time;

    let spentHeight;

    function getProgress(value, min, max) {
      return Math.max(0, (value - min) / (max - min));
    }


    if (!offset) {
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


      note.element.getElementsByClassName('start')[0].style.transform = `scale(${scale})`;
      note.element.getElementsByClassName('end')[0].style.transform = `scale(${scale})`;
      // noteTravelMax - (((CONFIG.APPEARANCE_HASTE) / previewDelay) * noteTravelMax)
      // ((noteTime - currentTime) / previewDelay) * noteTravelMax,

      const maxHeight = (((sliderEnd - (sliderStart)) / previewDelay) * (sliderMaxHeight));
      // ((note.sliderEnd - note.time) / CONFIG.NOTE_PREVIEW_DELAY) * (CONFIG.CONTAINER_REAL_RADIUS / 2)

      if ((currentTime + previewDelay) <= sliderEnd) {
        let currentHeight = getProgress(currentTime + previewDelay, sliderStart, sliderEnd) * maxHeight;
        note.element.style.setProperty('--sliderHeight', `${currentHeight}px`);
        spentHeight = sliderMaxHeight;
      } else {
        note.element.style.setProperty('--sliderHeight', `${maxHeight}px`);
        spentHeight = ((sliderEnd - (currentTime)) / previewDelay) * sliderMaxHeight;
      }

      // spentHeight = (((sliderEnd - currentTime)) / previewDelay) * sliderMaxHeight; 
    } else {
      spentHeight = (((sliderEnd - (sliderStart + offset))) / previewDelay) * sliderMaxHeight;
    }
    const newTranslate = `0px ${(spentHeight) * -1}px`;
    if (note.element.style.translate !== newTranslate) {
      note.element.style.translate = newTranslate;
    }

    if (note.isBeingHeld || currentTime <= note.sliderEnd) {
      this.updateSliderHoldStatus(note);
    }
  }


  updateSliderHoldStatus(note) {
    if (note.isBeingHeld || (note.holdableStart && this.gameState.currentTime >= note.time)) {
      let determinedLane = (this.gameState.keysPressed['w'] ? (this.inputSystem.findMatchingNotes(0, this.gameState.rotations[0]).indexOf(note) != -1) : false) || (this.gameState.keysPressed['s'] ? (this.inputSystem.findMatchingNotes(1, this.gameState.rotations[1]).indexOf(note) != -1) : false);

      if (!determinedLane && note.isBeingHeld) {
        this.inputSystem.releaseSlider(note);
        return;
      }
      if (!note.isBeingHeld && note.holdableStart && (determinedLane != false)) {
        this.inputSystem.holdSlider(note);
      }
    } else {
      if (!note.wasEverHeld && this.gameState.currentTime - note.currentTime > CONFIG.ACCEPTANCE_THRESHOLD) {
        this.gameState.combo = 0;
        this.gameState.scoringSystem.updateComboDisplay();
        this.createFailedHoldEffect(note)
      }
      if (note.wasEverHeld && !note.done) {
        let determinedLane = (this.gameState.keysPressed['w'] ? (this.inputSystem.findMatchingNotes(0, this.gameState.rotations[0]).indexOf(note) != -1) : false) || (this.gameState.keysPressed['s'] ? (this.inputSystem.findMatchingNotes(1, this.gameState.rotations[1]).indexOf(note) != -1) : false);
        if (determinedLane) {
          note.isBeingHeld = true;
        }
      }
    }
  }

  updateRegularNotePosition(note, currentTime, timing) {
    const previewDelay = CONFIG.NOTE_PREVIEW_DELAY;
    const offset = timing.offset || 0;
    const noteTime = note.time;

    const noteTravelMax = CONFIG.ADJUSTED_MAX_TRAVEL;  // Use CONTAINER_REAL_RADIUS

    let timeIntoPreview;
    if (!offset) {
      let scale = 1; // default once scaling is done
      let scaleStart = (noteTime) - ((CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION));
      let scaleEnd = (noteTime) - CONFIG.NOTE_PREVIEW_DELAY;
      if (!note.endedScale && currentTime >= scaleStart && currentTime <= scaleEnd) {
        // progress from 0 → 1 during the scale duration
        let progress = (currentTime - scaleStart) / CONFIG.SCALE_DURATION;
        scale = game.timingSystem.applyEasing(progress, '[0.49,0.14,0.74,0.96]');
      } else if (currentTime < scaleStart) {
        scale = 0;
      } else if (!note.endedScale && currentTime > scaleEnd) {
        scale = 1;
      }
      note.element.style.transform = `scale(${scale})`;


      timeIntoPreview = Math.min(
        ((noteTime - currentTime) / previewDelay) * noteTravelMax,
        noteTravelMax
      );
    } else {
      timeIntoPreview = (-offset / previewDelay) * noteTravelMax;
    }

    const newTranslate = `0px ${timeIntoPreview * -1}px`;
    if (note.element.style.translate !== newTranslate) {
      note.element.style.translate = newTranslate;
    }
  }

  cleanupFailedNotes(currentTime) {
    for (let i = 0; i < this.gameState.sheet.length; i++) {
      const note = this.gameState.sheet[i];

      if (note.element && !note.done && this.hasFailed(note, currentTime)) {
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
    // Don't fail notes that are already done or haven't started yet
    if (note.done) return false;

    // For sliders, they only fail if they end without being held
    if (note.slider || note.traceParent) {
      let failed = currentTime > ((note.sliderEnd || note.flickEnd) + CONFIG.ACCEPTANCE_THRESHOLD);
      if (failed) {
        this.inputSystem.releaseSlider(note);
      }
      return failed;
    }

    // For regular notes, check if they've passed the acceptance window
    const failTime = note.flickEnd || note.failTime || note.time;
    return (currentTime - failTime) > CONFIG.ACCEPTANCE_THRESHOLD;
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

  judge(noteTime, affectCombo = true) {
    const currentTime = this.gameState.currentTime;
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
      if (difference > 150 || isNaN(difference)) {
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
    this.init();
  }

  async init() {
    // Ensure audio for the beatmap is decoded and playing
    await this.gameState.initializeAudio();

    // Load hit sound(s) once
    const hitPath = './Assets/hit_normal.mp3';
    try {
      const hitFile = fs.readFileSync(hitPath);
      const hitArray = hitFile.buffer.slice(hitFile.byteOffset, hitFile.byteOffset + hitFile.length);
      const buf = await this.gameState.audioContext.decodeAudioData(hitArray);
      this.gameState.hitBuffer = buf;
    } catch (err) {
      console.warn('Failed to load hit sound', err);
      this.gameState.hitBuffer = undefined;
    }

    // Start game loop now that audio is ready
    this.gameState.playHitSound = this.playHitSound.bind(this);
    this.startGameLoop();
  }

  playHitSound() {
    if (!this.gameState.hitBuffer) return;
    const ctx = this.gameState.audioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.gameState.hitBuffer;
    src.connect(ctx.destination);
    src.start(0);
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
    this.gameState.elements.songData.style.scale = 2;
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
    return
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
      this.gameState.elements.songArt.classList.add('viewing');
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
        <div class="scoreIndicator perfect"><span>PERFECT</span>${this.gameState.scoringPad.perfect.length} </div>
        <div class="scoreIndicator great"><span>GREAT</span>${this.gameState.scoringPad.great.length} <span>${this.gameState.scoringPad.great.filter(note => note < 0).length} early, ${this.gameState.scoringPad.great.filter(note => note > 0).length} late</span></div>
        <div class="scoreIndicator okay"><span>OKAY</span>${this.gameState.scoringPad.ok.length} <span>${this.gameState.scoringPad.ok.filter(note => note < 0).length} early, ${this.gameState.scoringPad.ok.filter(note => note > 0).length} late</span></div>
        <div class="scoreIndicator bad"><span>BAD</span>${this.gameState.scoringPad.bad.length} <span>${this.gameState.scoringPad.bad.filter(note => note < 0).length} early, ${this.gameState.scoringPad.bad.filter(note => note > 0).length} late</span></div>
        <div class="scoreIndicator miss"><span>MISS</span>${this.gameState.scoringPad.miss.length}</div>
      `
      document.getElementById('grade').innerHTML = `
      <btext><span>Max Combo</span> Unknown</btext><br>
      <btext><span>${(totalNotesHit / totalNotes) * 100}%</span> ${totalNotesHit}/${totalNotes}</btext>
      <btextm style="color: var(--perfect); border-color: var(--perfect);">A</btextm>
      `

      document.getElementById('songProcedureControls').innerHTML = `
      <btn class="controller_selectable">Replay</btn>
      <btn class="controller_selectable selected" onclick="location.href = '../Picker/LevelPicker.html'">Home</btn>
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