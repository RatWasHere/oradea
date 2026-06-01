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
    let segment = this.getSegment(options.angle);
    if (segment == 6) segment = 0;

    const point = {
      source: options.source,
      angle: options.angle,
      initialAngle: options.angle,
      rawAngle: options.rawAngle,
      distance: options.distance || 1,
      type: options.type || 'button',
      segment: segment,
      startedAt: this.gameState.currentTime,
      associatedNote: options.associatedNote || null,
      analog: options.analog || false,
    };
    let segmentElement = this.gameState.effectItems.find(i => i.type == 'segment_highlight_' + segment);
    if (!point.analog && segmentElement) {
      segmentElement.element.style.transition = '';
      segmentElement.element.style.opacity = 1;
    }

    this.points.set(point.type, point);
    // if (point.distance > 0.5) 
    this.hit(point.angle, point)
  }

  hit(angle, point) {
    const matchingNotes = this.findMatchingNotes(angle);
    const closestNote = this.findClosestNote(matchingNotes);
    if (closestNote && !closestNote.swipe) {
      if (closestNote.slider) {
        if (!(closestNote.holdableStart ? game.gameState.currentTime <= closestNote.time : true)) return;
        return this.holdSlider(closestNote);
      }
      this.hitNote(closestNote, point);
    }
  }

  swipeNote(note, point) {
    if (point) {
      point.associatedNote = note;
    }
    if ((note.swipeEnd - CONFIG.PERMISSIVE_SWIPE_TIMEFRAME) > game.gameState.currentTime) {
      note.tracePath.classList.add('permissive-swipe');
      note.shouldBeDone = true;
    }
    if (CONFIG.PERMISSIVE_SWIPE_TIMEFRAME > (note.swipeEnd - note.time)) {
      this.gameState.scoringSystem.judge(note.time, true);
    } else {
      this.gameState.scoringSystem.judge(note.swipeEnd, true);
    }
    note.done = true;
    this.createNoteAura(note).then(() => {
      note.traceParent.remove();
      note.element.parentElement.remove();
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
    this.gameState.effectItems.find(i => i.type == 'segment_highlight_' + this.points.get(id).segment).element.style.transition = 'opacity 0.15s ease';
    this.gameState.effectItems.find(i => i.type == 'segment_highlight_' + this.points.get(id).segment).element.style.opacity = 0;
    this.points.delete(id);
  }


  setupEventListeners() {
    window.addEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
    if (!CONFIG.TOUCHSCREEN) {
      document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    } else {
      document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
      document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
      document.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
    }
  }

  computeTouchPoint(clientX, clientY) {
    const rect = this.gameState.cachedRects?.rect;
    const centerX = this.gameState.cachedRects?.centerX;
    const centerY = this.gameState.cachedRects?.centerY;

    const angle = Math.atan2(clientY - centerY, clientX - centerX);
    const angleDegrees = angle * (180 / Math.PI);
    const distanceFromCenter = Math.hypot(clientX - centerX, clientY - centerY);
    const normalized = Math.min(distanceFromCenter / (CONFIG.ADJUSTED_MAX_TRAVEL || 1), 1);
    return { angleDeg: angleDegrees, rawAngle: this.normalizeAngle(angleDegrees - 270), normalized };
  }

  handleTouchStart(e) {
    if (!CONFIG.TOUCHSCREEN) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const id = `touch_${t.identifier}`;
      const pt = this.computeTouchPoint(t.clientX, t.clientY);
      this.createPoint({
        angle: this.snapAngle(pt.angleDeg),
        rawAngle: pt.rawAngle,
        distance: pt.normalized,
        type: id,
        source: 'touch',
        analog: true
      });
    }
  }

  handleTouchMove(e) {
    if (!CONFIG.TOUCHSCREEN) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const id = `touch_${t.identifier}`;
      const pt = this.computeTouchPoint(t.clientX, t.clientY);
      if (this.points.get(id)?.associatedNote) {
        let point = this.points.get(id);
        let pointSegment = this.getSegment(point.angle);
        if (pointSegment == 6) pointSegment = 0;
        if (pointSegment != point.associatedNote.desiredAngle || point.distance < CONFIG.GAMEPAD_DEADZONE) {
          point.associatedNote = null;
        }
      }
      this.updatePoint(id, { angle: this.snapAngle(pt.angleDeg), rawAngle: pt.rawAngle, distance: pt.normalized });
    }
  }

  handleTouchEnd(e) {
    if (!CONFIG.TOUCHSCREEN) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const id = `touch_${t.identifier}`;
      this.releasePoint(id);
    }
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
    return
    if (this.gameState.gamepad) return;

    // const rect = this.gameState.cachedRects.rect;
    // const centerX = this.gameState.cachedRects.centerX;
    // const centerY = this.gameState.cachedRects.centerY;

    // const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    // const angleDegrees = angle * (180 / Math.PI);
    // const distanceFromCenter = Math.sqrt(Math.pow(event.clientX - centerX, 2) + Math.pow(event.clientY - centerY, 2));

    // const normalized = Math.min(distanceFromCenter / (CONFIG.ADJUSTED_MAX_TRAVEL || 1), 1);

    // this.gameState.centerDistance[0] = normalized;
    // this.gameState.centerDistance[1] = normalized;

    this.updateRotations(angleDegrees, angleDegrees);
  }

  handleAutoplay(currentTime) {
    let relevantNotes = this.gameState.sheet.filter(note => {
      return note.time <= currentTime && !note.done;
    });

    relevantNotes.forEach(note => {
      if (note.slider) {
        // Hold slider if we haven't started and haven't passed the start time
        if (!note.wasEverHeld && currentTime >= note.time) {
          note.blockRelease = true;
          this.holdSlider(note);
        }
        // Release slider when we pass the end time
        else if (note.isBeingHeld && currentTime >= note.sliderEnd) {
          note.blockRelease = false;
          this.releaseSlider(note);
        }
      } else if (note.swipe) {
        this.swipeNote(note);
      } else {
        this.hitNote(note);
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

    if (gamepad.buttons[9]?.pressed) return this.gameState.pauseGame();
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
        if (rightStickPoint.distance > CONFIG.PERMISSIVE_SWIPE_TRESHOLD) {
          // this.gameState.elements.cursor2.style.rotate = `${rightStickPoint.angle + 30}deg`;
        }
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
    } else if (!pressed && this.gameState.keysPressed[key]) {
      this.gameState.keysPressed[key] = false;
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

  snapAngle(angle) {
    return this.normalizeAngle(Math.round(angle / CONFIG.SNAP_INTERVAL) * CONFIG.SNAP_INTERVAL);
  }

  normalizeAngle(deg) {
    return ((parseFloat(deg) % 360) + 360) % 360;
  }

  // findMatchingNotes(rotation) {
  //   return this.gameState.sheet.filter(note => {
  //     if (!note.element || note.done) return false;
  //     const matchesTime = (note.time - this.gameState.currentTime) <= CONFIG.ACCEPTANCE_THRESHOLD;
  //     if (!matchesTime) return false;
  //     return this.isInArc(note, rotation);
  //   })
  // }

  findMatchingNotes(rotation) {
    const matches = [];
    const sheet = this.gameState.sheet;
    const currentTime = this.gameState.currentTime;
    const threshold = CONFIG.ACCEPTANCE_THRESHOLD;

    for (let i = 0; i < sheet.length; i++) {
      const note = sheet[i];

      // 1. Cheapest checks first: Booleans and existence
      if (!note.element || note.done) continue;

      // 2. Simple Math: Time difference
      // We check if the note is within the "hit window"
      const timeDiff = note.time - currentTime;

      // If the note is already in the past (beyond threshold), skip it
      // If the note is too far in the future, skip it
      if (Math.abs(timeDiff) > threshold) continue;

      // 3. Most expensive check last: Trigonometry/Arc calculation
      // This only runs for the 1 or 2 notes that passed the time check
      if (this.isInArc(note, rotation)) {
        matches.push(note);
      }
    }
    return matches;
  }
  getSegment(rotation) {
    return rotation / CONFIG.ANGLE_MODIFIER
  }

  findClosestNote(notes) {
    let closest = null;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.swipe) continue;

      if (note.slider) {
        if (note.isBeingHeld || note.done || note.wasEverHeld) continue;
        if (note.sliderEnd < this.gameState.currentTime) continue;
        if (Math.abs(note.time - this.gameState.currentTime) > CONFIG.ACCEPTANCE_THRESHOLD) continue;
      } else {
        if (note.done) continue;
        if (Math.abs(note.time - this.gameState.currentTime) > CONFIG.ACCEPTANCE_THRESHOLD) continue;
      }

      if (!closest || note.time < closest.time) {
        closest = note;
      }
    }

    return closest;
  }

  holdSlider(note) {
    note.isBeingHeld = true;
    this.createNoteAura(note);
    if (note.hint) {
      note.hint.remove();
      note.hint = null;
    }
    if (!note.wasEverHeld) {
      note.wasEverHeld = true;
      this.gameState.scoringSystem.judge(note.time);
    }
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
      note.element.parentElement.parentElement.remove();
    } else {
      note.element.style.opacity = '0.5';
      note.element.style.scale = '1';
    }

    this.removeNoteAura(note);
  }

  hitNote(note, point) {
    this.gameState.scoringSystem.judge(note.time, true, note);

    note.done = true;

    if (note.hold && note.time < this.gameState.currentTime) {
      this.vibrate(3);
    } else {
      this.vibrate(2);
      this.createHoldEffect(note);
    }

    this.createNoteAura(note).then(() => {
      note.element.parentElement.remove();
    });

    if (point) {
      requestAnimationFrame(() => {
        this.gameState.effectItems.find(i => i.type == 'segment_highlight_' + point.segment).element.style.transition = 'opacity 0.25s ease';
        this.gameState.effectItems.find(i => i.type == 'segment_highlight_' + point.segment).element.style.opacity = 0;
      })
    }
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
    }, 700);
  }

  releaseEffect(effect) {
    if (effect.type == 'particles_constant') {
      effect.parent.style.opacity = '0';
      setTimeout(() => {
        effect.inUse = false;
        effect.parent.style.display = 'none';
        effect.parent.style.opacity = null;
      }, 250);
      return
    }
    if (effect.parent && effect.parent?.style) {
      effect.parent.style.display = 'none';
    }
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
        let offset = 180;
        if (note.shortSwipe) {
          let multiplier = note.direction == -1 ? -1 : 1;
          offset = 240 * multiplier;
        }
        if (note.quarterSwipe) {
          let multiplier = note.direction == -1 ? 1 : -1;
          offset = 60 * multiplier;
        }
        this.consumeEffect('particles_swipe', note.angle, offset);
        this.consumeEffect('swipe_burst', note.angle, offset);
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



  isInArc(note, rotation) {
    return note.angle == this.getSegment(rotation);
  }


  createHoldEffect(note, failed = false) {
    if (failed) {
    }
  }

  vibrate(kind) {
    return
    let settings = {
      w: 1,
      s: 1,
      d: 35
    };
    let effectType = "dual-rumble";

    if (kind == "HOLDING") {
      settings.d = 10;
      settings.w = 0.1;
      settings.s = 0.1;
    }


    this.gameState.gamepad.vibrationActuator.playEffect(effectType, {
      startDelay: 0,
      duration: settings.d,
      weakMagnitude: settings.w,
      strongMagnitude: settings.s,
    });
  }
}