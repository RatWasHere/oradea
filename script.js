const fs = require('fs');

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const CONFIG = {
  ACCEPTANCE_THRESHOLD: 500,
  SNAP_INTERVAL: 45,
  ANGLE_MODIFIER: 45,
  NOTE_ARC_ANGLE: 20,
  NOTE_PREVIEW_DELAY: 750,
  CONTAINER_RADIUS: 670,
  CONTAINER_REAL_RADIUS: 590,
  NOTE_RADIUS: 75,
  PREVIEW_COUNT: 8,
  GAMEPAD_DEADZONE: 0.1,
  HOLD_WINDOW: 300,
  FLICK_THRESHOLD: 10,
  ACCURACY_RANGES: {
    'perfect': [0, 100],
    'great': [100, 200],
    'good': [200, 300],
    'ok': [300, 400],
    'bad': [400, 500],
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
    this.keysPressed = {};
    this.rotations = [0, 0];
    this.rawRotations = [0, 0];
    this.sectors = [1, 1];
    this.displayedNotes = [];
    this.gamepad = null;
    this.snapToInterval = true;
    this.lastFrameTime = 0;

    this.initializeDOM();
    this.initializeAudio();
  }

  initializeDOM() {
    this.elements = {
      container: document.getElementById('noteContainer'),
      cursor1: document.getElementById('cursor1'),
      cursor2: document.getElementById('cursor2'),
      comboDisplay: document.getElementById('comboDisplay')
    };
  }

  initializeAudio() {
    this.audio = new Audio(`./Beatmaps/${this.crossDetails.location}/audio.mp3`);
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
      const pointStartTime = parseFloat(point.time) + (defaultPoint.time ? parseFloat(defaultPoint.time) : 0);

      if (pointStartTime <= time) {
        activePoint.offset = this.fromSpecial(point.offset);
        activePoint.speed = point.speed;
        activePoint.time = pointStartTime;
        activePoint.transition = point.transition;
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
  }

  applySegmentStyles(timingPoint) {
    if (timingPoint.style.segments) {
      let previewers = document.querySelectorAll('.previewer_parent');
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
    const startTime = parseFloat(activePoint.time) + (defaultPoint.time ? parseFloat(defaultPoint.time) : 0);
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
    const extension = 15; // degrees to extend on both sides

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
    console.log(angle1)
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
      cursor.style.rotate = `${angle + 90}deg`;
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
    const sliderNote = this.findSliderToHold(matchingNotes);
    if (sliderNote) {
      this.holdSlider(sliderNote);
      return;
    }

    // Handle regular notes
    const closestNote = this.findClosestNote(matchingNotes, rotation);
    if (closestNote) {
      this.hitNote(closestNote, laneIndex);
    }
  }

  processNoteRelease(key) {
    const isW = key === 'w';
    const laneIndex = isW ? 0 : 1;
    const rotation = this.gameState.rotations[laneIndex];

    const matchingNotes = this.findMatchingNotes(laneIndex, rotation);
    matchingNotes.forEach(note => {
      if (note.flickStart && note.input === laneIndex && !note.done) {
        this.releaseFlick(note);
      }
    })
    // Handle sliders first - look for currently held sliders
    const sliderNote = this.findSliderToRelease(matchingNotes, false);
    if (sliderNote) {
      this.releaseSlider(sliderNote);
      return;
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

  findSliderToHold(notes) {
    return notes.find(note => {
      if (!note.slider) return false;
      return !note.isBeingHeld && this.canBeHeld(note);
    });
  }

  findSliderToRelease(notes) {
    return notes.find(note => {
      if (!note.slider) return false;
      return note.isBeingHeld;
    });
  }

  findClosestNote(notes, rotation) {
    return notes
      .filter(note => !note.slider)
      .sort((a, b) => {
        const distA = Math.abs(this.normalizeAngle(a.angle * CONFIG.ANGLE_MODIFIER) - this.normalizeAngle(rotation));
        const distB = Math.abs(this.normalizeAngle(b.angle * CONFIG.ANGLE_MODIFIER) - this.normalizeAngle(rotation));
        return distA - distB;
      })
      .sort((a, b) => a.time - b.time)[0];
  }

  holdSlider(note) {
    note.isBeingHeld = true;
    note.wasEverHeld = true;
    note.element.style.opacity = '1';
  }

  releaseSlider(note) {
    note.isBeingHeld = false;
    const timeDiff = Math.abs(this.gameState.currentTime - note.sliderEnd);

    if (timeDiff <= CONFIG.ACCEPTANCE_THRESHOLD) {
      note.done = true;
      const accuracy = this.gameState.scoringSystem.judge(note.sliderEnd);
      if (accuracy !== 'miss') {
        this.vibrate(2);
        this.createHoldEffect(note);
        note.element.parentElement.parentElement.parentElement.remove();
      }
    } else {
      note.element.style.opacity = '0.5';
      note.element.style.scale = '1';
      note.element.parentElement.parentElement.parentElement.remove();
    }
  }

  hitNote(note, laneIndex) {
    if (note.flick) {
      this.startFlick(note, laneIndex);
      return;
    }

    note.done = true;
    note.element.parentElement.parentElement.remove();

    if (note.hold && note.time < this.gameState.currentTime) {
      this.vibrate(3);
    } else {
      this.vibrate(2);
      this.createHoldEffect(note);
    }

    this.createNoteAura(note);
  }

  createNoteAura(note) {
    let indicator_parent = document.createElement('div');
    indicator_parent.classList.add('indicator_parent');
    indicator_parent.style.rotate = `${(note.angle * CONFIG.ANGLE_MODIFIER) + 135}deg`;
    let indicator = document.createElement('div');
    indicator.classList.add('indicator', note.slider ? 'hold' : 'hit');
    indicator_parent.appendChild(indicator);
    this.gameState.elements.container.appendChild(indicator_parent);
    if (!note.slider) {
      setTimeout(() => {
        indicator_parent.remove();
      }, 300);
    }
  }

  startFlick(note, laneIndex) {
    note.flickStart = this.gameState.rawRotations[laneIndex];
    note.input = laneIndex;
    note.flickMoment = this.gameState.currentTime;
    this.vibrate(4);
  }

  releaseFlick(note) {
    if (note.done) {
      note.element.classList.remove('flick1', 'flick2');
      note.element.classList.add('flicked');
      setTimeout(() => {
        note.element.parentElement.parentElement.remove();
      }, 250);
    }
    note.flickStart = null;
    note.flickMoment = null;
    note.input = null;
  }

  isInArc(note, rotation) {
    const normalizedRotation = this.normalizeAngle(rotation);
    const noteStartAngle = this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + 90 - (CONFIG.NOTE_ARC_ANGLE / 2));
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
      const start = note.time;
      const end = note.sliderEnd;

      // Allow holding from a bit before the slider starts until it ends
      const earlyWindow = 200; // milliseconds before slider starts
      return currentTime >= (start - earlyWindow) && currentTime <= end;
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
    this.lastUpdateTime = 0;
    this.frameCount = 0;
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
      (Math.round(this.normalizeAngle(this.gameState.rotations[0] + 270) / 45) + 1) % CONFIG.PREVIEW_COUNT,
      (Math.round(this.normalizeAngle(this.gameState.rotations[1] + 270) / 45) + 1) % CONFIG.PREVIEW_COUNT
    ];

    this.gameState.sectors = sectors;

    // Update both hover highlighting AND active press effects
    for (let i = 0; i < CONFIG.PREVIEW_COUNT; i++) {
      const el = document.getElementById(`previewer${i}`);
      if (!el) continue;

      // Check if either cursor is in this sector (hover effect)
      const isHovered = (i === sectors[0] || i === sectors[1]);

      // Check if this sector is being actively pressed
      const isActive = (i === sectors[0] && this.gameState.keysPressed['w']) ||
        (i === sectors[1] && this.gameState.keysPressed['s']);

      // Apply hover effect
      if (isHovered) {
        el.classList.add('hovered');
      } else {
        el.classList.remove('hovered');
      }

      // Apply active press effect
      if (isActive) {
        el.firstElementChild?.classList.add('hitKid');
      } else {
        el.firstElementChild?.classList.remove('hitKid');
      }
    }
  }
  updateNoteVisibility(currentTime) {
    this.gameState.displayedNotes = this.gameState.displayedNotes.filter(
      note => !(note.done && currentTime - CONFIG.NOTE_PREVIEW_DELAY >= note.time)
    );
  }

  createNewNoteElements(currentTime) {
    const relevantNotes = this.gameState.sheet.filter(note => ((currentTime >= (note.startAt || note.time) - CONFIG.NOTE_PREVIEW_DELAY) && !note.element));

    relevantNotes.forEach(note => {
      if (note.slider) {
      }
      if (!note.element) {
        this.createNoteElement(note);
      }
    });
  }

  createNoteElement(note) {
    const noteElement = document.createElement('div');
    noteElement.classList.add('item');

    const lane = document.createElement('div');
    lane.classList.add('lane');

    const laneParent = document.createElement('div');
    laneParent.classList.add('laneParent');

    const noteContainer = document.createElement('div');
    noteContainer.className = 'noteContainer';

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
    let { noteElement, lane, noteContainer } = elements
    if (note.hold) {
      noteElement.classList.add('hold');
      noteContainer.appendChild(lane);
      lane.appendChild(noteElement);
    } else if (note.slider) {
      noteElement.classList.add('slider');
      const actualHeight = (note.sliderEnd - note.time) / CONFIG.NOTE_PREVIEW_DELAY * (CONFIG.CONTAINER_RADIUS / 2);

      noteElement.style.height = `${actualHeight}px`;
      noteElement.style.translate = `0px`;

      note.height = actualHeight;

      noteContainer.appendChild(noteElement);
      lane.appendChild(noteContainer);
      const header = document.createElement('div');
      header.classList.add('header');
      noteElement.appendChild(header);
    } else if (note.flick) {
      noteElement.classList.add(`flick${note.flickDirection}`);
      noteContainer.appendChild(lane);
      lane.appendChild(noteElement);
    } else {
      noteContainer.appendChild(lane);
      lane.appendChild(noteElement);
      const header = document.createElement('div');
      header.classList.add('header');
      noteElement.appendChild(header);
    }

    // The header is just the note in itself
  }

  updateNotePositions(currentTime) {
    this.gameState.sheet.forEach(note => {
      if (!note.done && note.element) {
        this.updateNote(note, currentTime);
      }
    });
  }

  updateNote(note, currentTime) {
    const noteTiming = this.timingSystem.getTiming(note, currentTime);

    if (note.slider) {
      return this.updateSliderPosition(note, currentTime, noteTiming);
    } else if (note.flick) {
      let rotations = note.rotations || [0, 0];

      if (this.gameState.keysPressed['w'] && this.inputSystem.isInArc(note, this.gameState.rotations[0]) && !rotations[0]) {
        rotations[0] = this.gameState.rawRotations[0];
        if (Math.abs(rotations[0] - this.gameState.rawRotations[0]) > CONFIG.FLICK_THRESHOLD) {
          note.done = true;
          this.inputSystem.releaseFlick(note);
        }
      } else if (!this.gameState.keysPressed['w'] && rotations[0]) {
        rotations[0] = null;
        if (Math.abs(rotations[1] - this.gameState.rawRotations[1]) > CONFIG.FLICK_THRESHOLD) {
          note.done = true;
          this.inputSystem.releaseFlick(note);
        }
      }

      if (this.gameState.keysPressed['s'] && this.inputSystem.isInArc(note, this.gameState.rotations[1]) && !rotations[1]) {
        rotations[1] = this.gameState.rawRotations[1];
      } else if (!this.gameState.keysPressed['s'] && rotations[1]) {
        rotations[1] = null;
      }

      note.rotations = rotations;
    }
    this.updateRegularNotePosition(note, currentTime, noteTiming);
  }

  updateSliderPosition(note, currentTime, timing) {
    const sliderMaxHeight = CONFIG.CONTAINER_REAL_RADIUS / 2;

    const previewDelay = CONFIG.NOTE_PREVIEW_DELAY / timing.speed;
    const offset = timing.offset;

    const sliderStart = note.time;
    const sliderEnd = note.sliderEnd;

    let spentHeight;

    if (timing.default) {
      spentHeight = (((sliderEnd - currentTime)) / previewDelay) * sliderMaxHeight;
    } else {
      spentHeight = (((sliderEnd - (sliderStart + offset))) / previewDelay) * sliderMaxHeight;
    }

    const newTranslate = `0px ${spentHeight * -1}px`;
    if (note.element.style.translate !== newTranslate) {
      note.element.style.translate = newTranslate;
    }

    if (note.isBeingHeld || currentTime <= note.sliderEnd) {
      this.updateSliderHoldStatus(note);
    }
  }


  updateSliderHoldStatus(note) {
    // Check if we're within the slider's active time
    if (note.isBeingHeld) {
      note.element.style.opacity = '1';
      note.element.style.scale = '1';
    } else {
      note.element.style.opacity = '0.5';
      note.element.style.scale = '1';
    }
  }

  updateRegularNotePosition(note, currentTime, timing) {
    const previewDelay = CONFIG.NOTE_PREVIEW_DELAY / (timing.speed || 1);
    const offset = timing.offset || 0;
    const noteTime = note.time;

    const noteTravelMax = CONFIG.CONTAINER_REAL_RADIUS / 2;

    // Calculate travel distance based on how far we are into the preview window
    let timeIntoPreview;
    if (!offset) {
      timeIntoPreview = currentTime - (noteTime - previewDelay);
    } else {
      timeIntoPreview = (noteTime - offset) - (noteTime - previewDelay);
    }

    const noteTravel = Math.max(timeIntoPreview / previewDelay, 0) * noteTravelMax;
    console.log(timeIntoPreview, noteTime, offset, noteTravel)

    const newTranslate = `0px ${noteTravel}px`;
    // console.log(newTranslate)
    if (note.element.style.translate !== newTranslate) {
      note.element.style.translate = newTranslate;
    }
  }

  cleanupFailedNotes(currentTime) {
    this.gameState.sheet.forEach(note => {
      if (note.element && !note.done && this.hasFailed(note, currentTime)) {
        note.element.parentElement.parentElement.remove();
        note.done = true;

        this.createFailedHoldEffect(note);
      }
    });
  }

  hasFailed(note, currentTime) {
    // Don't fail notes that are already done or haven't started yet
    if (note.done || note.isBeingHeld) return false;

    // For sliders, they only fail if they end without being held
    if (note.slider) {
      // Only fail if the slider has completely ended and was never held
      return currentTime > note.sliderEnd && !note.wasEverHeld;
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