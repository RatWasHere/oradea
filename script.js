const fs = require('fs');

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const CONFIG = {
  ACCEPTANCE_THRESHOLD: 500,
  SNAP_INTERVAL: 60, // Changed from 45 to 60 for 6 segments (360/6)
  ANGLE_MODIFIER: 60,
  NOTE_ARC_ANGLE: 60,
  NOTE_PREVIEW_DELAY: 600,
  ANGLE_START: 90,
  SCALE_DURATION: 300,
  APPEARANCE_HASTE: 0,
  CONTAINER_RADIUS: 660,
  SNAP_EXTENSION: 12,
  CONTAINER_REAL_RADIUS: 660,
  BASELINE_OFFSET: -100, // Only applies to visuals.
  NOTE_RADIUS: 150,
  PREVIEW_COUNT: 6, // Already set to 6
  GAMEPAD_DEADZONE: 0.1,
  HOLD_WINDOW: 500,
  FLICK_THRESHOLD: 10,
  ACCURACY_RANGES: {
    'perfect': [0, 100],
    'great': [100, 200],
    'good': [200, 300],
    'ok': [300, 400],
    'bad': [400, 500],
  },
  ACCURACY_SCORES: {
    'perfect': 100,
    'great': 80,
    'good': 60,
    'ok': 40,
    'bad': 20,
  }
};

// ============================================================================
// GAME STATE
// ============================================================================
class GameState {
  constructor() {
    this.crossDetails = JSON.parse(fs.readFileSync('./crossdetails', 'utf8'));
    this.sheet = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/${this.crossDetails.map}`, 'utf8'));
    try {
      this.timeSheet = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/time_${this.crossDetails.map}`, 'utf8'));
    } catch (error) { }

    this.combo = 0;
    this.score = 0;

    this.keysPressed = {};

    this.rotations = [0, 0];
    this.rawRotations = [0, 0];
    this.sectors = [1, 1];
    this.snapToInterval = true;

    this.displayedNotes = [];

    this.gamepad = null;

    this.lastFrameTime = 0;

    this.initializeDOM();
    this.initializeAudio();
  }

  initializeDOM() {
    this.elements = {
      container: document.getElementById('noteContainer'),
      cursor1: document.getElementById('cursor1'),
      cursor2: document.getElementById('cursor2'),
      comboDisplay: document.getElementById('comboDisplay'),
      previewers: document.querySelectorAll('.previewer_parent')
    };
  }

  initializeAudio() {
    this.audio = new Audio(`./Beatmaps/${this.crossDetails.location}/audio.mp3`);
    this.audio.playbackRate = 0.5;
    this.audio.play();
  }

  get currentTime() {
    return this.audio.currentTime * 1000;
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

    const rect = this.gameState.elements.container.getBoundingClientRect();
    const centerX = rect.x + (rect.width / 2);
    const centerY = rect.y + (rect.height / 2);

    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const angleDegrees = angle * (180 / Math.PI);

    this.updateRotations(angleDegrees, angleDegrees);
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

      // Extended snapping for controllers
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
    const leftTrigger = gamepad.buttons[6]?.pressed;
    const rightTrigger = gamepad.buttons[7]?.pressed;

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
    this.gameState.rawRotations[0] = angle1;
    this.gameState.rawRotations[1] = angle2;

    const snapped1 = this.gameState.snapToInterval ? this.snapAngle(angle1) : angle1;
    const snapped2 = this.gameState.snapToInterval ? this.snapAngle(angle2) : angle2;

    this.updateCursorRotation(0, snapped1);
    this.updateCursorRotation(1, snapped2);
  }

  updateCursorRotation(index, angle) {
    const cursor = index === 0 ? this.gameState.elements.cursor1 : this.gameState.elements.cursor2;
    if (cursor) {
      cursor.style.rotate = `${angle + CONFIG.ANGLE_START}deg`;
    }

    this.gameState.rotations[index] = angle - 270;
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
      const inArc = this.isInArc(note, rotation);

      return matchesInput && inArc;
    });
  }


  findClosestNote(notes) {
    return notes
      .filter(note => note.slider ?
        (((Math.abs(note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD) || note.sliderEnd > this.gameState.currentTime) && !note.isBeingHeld && !note.done)
        : (Math.abs(note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD) && !note.done)
      .sort((a, b) => a.time - b.time)[0];
  }

  holdSlider(note) {
    note.isBeingHeld = true;
    note.wasEverHeld = true;
    note.element.parentElement.classList.add('actively_pressed_in');
    this.createNoteAura(note)
  }

  releaseSlider(note) {
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

    if (note.flick) {
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
  createNoteAura(note) {
    new Audio('./Assets/hit.mp3').play().catch(() => { });
    return new Promise((resolve) => {
      const frag = document.createDocumentFragment();

      // Main indicator parent
      const indicator_parent = document.createElement('div');
      indicator_parent.classList.add('indicator_parent');
      indicator_parent.style.rotate = `${(note.angle * CONFIG.ANGLE_MODIFIER) + 135}deg`;

      const indicator = document.createElement('div');
      indicator.classList.add('indicator', note.slider ? 'actively_pressed' : 'was_hit');
      indicator_parent.appendChild(indicator);

      const indicator2 = document.createElement('div');
      indicator2.classList.add('indicator', note.slider ? 'actively_pressed2' : 'was_hit2');
      indicator_parent.appendChild(indicator2);

      // Optional slider header
      if (note.slider) {
        const header_parent = document.createElement('div');
        header_parent.classList.add('indicator_parent', 'dist');
        header_parent.style.rotate = `${(note.angle * CONFIG.ANGLE_MODIFIER) + 135}deg`;

        const header = document.createElement('div');
        header.classList.add('header', 'end', 'from_aura');
        header_parent.appendChild(header);

        frag.appendChild(header_parent);
        note.aura_header = header_parent;
      }

      frag.appendChild(indicator_parent);

      // Append everything in one go
      this.gameState.elements.container.appendChild(frag);

      note.aura = indicator_parent;

      if (!note.slider) {
        note.element.classList.add('aura');
        setTimeout(() => {
          indicator_parent.remove();
          resolve();
        }, 500);
      }
    });
  }


  removeNoteAura(note) {
    if (note.aura_header) {
      note.aura_header.remove();
      note.aura_header = null;
    }

    if (!note.aura) return;
    note.aura.querySelectorAll('.indicator').forEach(indicator => {
      indicator.style.scale = '0';
      indicator.style.opacity = '0';
    });

    let noteAura = note.aura;
    note.aura = null;

    setTimeout(() => {
      noteAura.remove();
    }, 300);
  }

  startFlick(note, laneIndex) {
    note.flickStart = this.gameState.rawRotations[laneIndex];
    note.input = laneIndex;
    note.flickMoment = this.gameState.currentTime;
    note.rotations = this.gameState.rawRotations;
    this.vibrate(4);
  }

  releaseFlick(note) {
    if (note.done) {
      this.createNoteAura(note)
      // note.element.classList.remove('flick1', 'flick2');
      note.element.parentElement.parentElement.classList.add('flicked_p');
      note.element.classList.add('flicked');
      note.element.parentElement.parentElement.style.rotate = `${(note.angle * CONFIG.ANGLE_MODIFIER) + (note.flickDirection == "2" ? -50 : 50) + 270}deg`;
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
    const noteStartAngle = this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + CONFIG.ANGLE_START - (CONFIG.NOTE_ARC_ANGLE / 2));
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
      return note.time - CONFIG.HOLD_WINDOW < currentTime && currentTime <= note.sliderEnd;
    }
    return note.time - CONFIG.HOLD_WINDOW < currentTime;
  }

  createHoldEffect(note, failed = false) {
    const holdNote = document.createElement('div');
    holdNote.classList.add('arc', 'held');
    holdNote.style.rotate = `${(note.angle * CONFIG.ANGLE_MODIFIER) + 270}deg`;

    if (failed) {
      holdNote.style.boxShadow = 'red 0px -10px 1px 0px inset';
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

    this.gameState.elements.container.append(holdNote);
    setTimeout(() => holdNote.remove(), 500);
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
        preview_segment.firstElementChild?.classList.add('effect');
      } else {
        preview_segment.firstElementChild?.classList.remove('effect');
      }
    }
  }
  updateNoteVisibility(currentTime) {
    this.gameState.displayedNotes = this.gameState.displayedNotes.filter(
      note => !(note.done && currentTime - CONFIG.NOTE_PREVIEW_DELAY >= note.time)
    );
  }

  createNewNoteElements(currentTime) {
    const relevantNotes = this.gameState.sheet.filter(note => ((currentTime >= (note.startAt || note.time) - (CONFIG.NOTE_PREVIEW_DELAY + CONFIG.APPEARANCE_HASTE + CONFIG.SCALE_DURATION)) && !note.element));

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
  }

  assembleNote(note, elements) {
    let { noteElement, lane, noteContainer } = elements;

    // Create a fragment to batch DOM operations
    const fragment = document.createDocumentFragment();

    if (note.slider) {
      noteElement.classList.add('slider');
      const actualHeight = ((note.sliderEnd - note.time) / CONFIG.NOTE_PREVIEW_DELAY) * (CONFIG.CONTAINER_REAL_RADIUS / 2);

      noteElement.style.height = `${actualHeight + (CONFIG.NOTE_RADIUS / 2)}px`;
      noteElement.style.translate = `0px`;

      noteElement.style.setProperty('--sliderHeight', `${actualHeight}px`);

      note.height = actualHeight;

      // Build sub-elements in memory
      const header = document.createElement('div');
      header.classList.add('header', note.holdableStart ? 'holdable_start' : 'start');
      noteElement.appendChild(header);

      const frame = document.createElement('div');
      frame.classList.add('header', 'midframe');
      noteElement.appendChild(frame);

      const header2 = document.createElement('div');
      header2.classList.add('header', note.holdableEnd ? 'holdable_end' : 'end');
      noteElement.appendChild(header2);

      // Put assembled noteElement inside noteContainer
      noteContainer.appendChild(noteElement);
    } else {
      noteElement.style.translate = `0px`;

      const header = document.createElement('div');
      if (!note.flick) {
        header.classList.add('header');
      } else {
        header.classList.add('flick_arrows')
      }
      noteElement.appendChild(header);

      if (note.holdable) {
        noteElement.classList.add('holdable');
      }
      if (note.flick) {
        noteElement.classList.add(`flick${note.flickDirection}`);
      }
      if (note.golden) {
        noteElement.classList.add('golden');
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
    } else if (note.flick) {
      if (note.rotations) {
        const input = note.input;
        const flickDiff = Math.abs(note.flickStart - this.gameState.rawRotations[input]);

        if (!note.lastFlickCheck || this.gameState.currentTime - note.lastFlickCheck > 16) {
          note.lastFlickCheck = this.gameState.currentTime;

          if (flickDiff > CONFIG.FLICK_THRESHOLD) {
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
    const sliderMaxHeight = CONFIG.CONTAINER_REAL_RADIUS / 2;

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
      let scaleStart = (sliderStart + CONFIG.APPEARANCE_HASTE) - ((CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION));
      let scaleEnd = (sliderStart + CONFIG.APPEARANCE_HASTE) - CONFIG.NOTE_PREVIEW_DELAY;
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

      const maxHeight = ((sliderEnd - (sliderStart)) / previewDelay) * (sliderMaxHeight);
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

    const noteTravelMax = CONFIG.CONTAINER_REAL_RADIUS / 2;  // Use CONTAINER_REAL_RADIUS

    let timeIntoPreview;
    if (!offset) {
      let scale = 1; // default once scaling is done
      let scaleStart = (noteTime + CONFIG.APPEARANCE_HASTE) - ((CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION));
      let scaleEnd = (noteTime + CONFIG.APPEARANCE_HASTE) - CONFIG.NOTE_PREVIEW_DELAY;
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
        noteTravelMax - (((CONFIG.APPEARANCE_HASTE) / previewDelay) * noteTravelMax)
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
    if (note.slider) {
      let failed = currentTime > (note.sliderEnd + CONFIG.ACCEPTANCE_THRESHOLD);
      if (failed) {
        this.inputSystem.releaseSlider(note);
      }
      return failed;
    }

    // For regular notes, check if they've passed the acceptance window
    const failTime = note.failTime || note.time;
    return (currentTime - failTime) > CONFIG.ACCEPTANCE_THRESHOLD;
  }

  createFailedHoldEffect(note) {
    const holdNote = document.createElement('div');
    holdNote.classList.add('arc', 'held');
    holdNote.style.rotate = `${(note.angle * CONFIG.ANGLE_MODIFIER) + 270}deg`;
    holdNote.style.boxShadow = 'red 0px -10px 1px 0px inset';

    this.gameState.elements.container.append(holdNote);
    setTimeout(() => holdNote.remove(), 500);
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
    console.log(difference)
    if (affectCombo) {
      if (difference > 300 || isNaN(difference)) {
        this.gameState.combo = 0;
      } else {
        this.gameState.combo++;
      }
      this.updateComboDisplay();
    }

    return accuracy;
  }

  updateComboDisplay() {
    const comboText = `${this.gameState.combo}`;
    if (this.gameState.elements.comboDisplay.innerText !== comboText) {
      this.gameState.elements.comboDisplay.innerText = comboText;
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

    this.startGameLoop();
  }

  startGameLoop() {
    const gameLoop = (timestamp) => {
      const currentTime = this.gameState.currentTime;

      // Update gamepad input
      this.inputSystem.updateGamepadInput();

      // Update rendering
      this.renderingSystem.update(currentTime);

      // (Global) Update global timing point
      this.timingSystem.updateGlobalTimingPoint(this.gameState.timeSheet, currentTime);
      // Continue loop
      requestAnimationFrame(gameLoop);
    };

    requestAnimationFrame(gameLoop);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
const game = new RhythmGame();