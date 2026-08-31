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
    // this.updatePreviewSectors();
    this.createNewNoteElements(currentTime);
    this.updateNotePositions(currentTime);
    this.cleanupFailedNotes(currentTime);
    // this.updateBeatMarkerScale(currentTime);
  }

  updateBeatMarkerScale(currentTime) {
    const beatsPerCycle = 2; 
    const cycleDuration = this.gameState.beatDuration * beatsPerCycle;
    const cycleProgress = (currentTime % cycleDuration) / cycleDuration;

    const beatInCycle = Math.floor((currentTime / this.gameState.beatDuration) % beatsPerCycle);

    if (beatInCycle === 0) {
      this.gameState.elements.bpmFrame.style.scale = (currentTime % this.gameState.beatDuration) / this.gameState.beatDuration;
    } else {
      this.gameState.elements.bpmFrame.style.scale = 1;
    }
  }

  updatePreviewSectors() {
    const sectors = [
      (Math.round(this.normalizeAngle(this.gameState.rotations[0] + 270) / 60) + 1) % CONFIG.PREVIEW_COUNT,
      (Math.round(this.normalizeAngle(this.gameState.rotations[1] + 270) / 60) + 1) % CONFIG.PREVIEW_COUNT
    ];

    this.gameState.sectors = sectors;

    for (let i = 0; i < CONFIG.PREVIEW_COUNT; i++) {
      const preview_segment = this.previewElements[i];
      if (!preview_segment) continue;

      const isHovered = (i === sectors[0] || i === sectors[1]);

      const isActive = (i === sectors[0] && this.gameState.keysPressed['w']) ||
        (i === sectors[1] && this.gameState.keysPressed['s']);
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
    let writeIndex = 0;
    for (let i = 0; i < this.gameState.displayedNotes.length; i++) {
      const note = this.gameState.displayedNotes[i];
      if (!(note.done && currentTime - CONFIG.NOTE_PREVIEW_DELAY >= note.time)) {
        this.gameState.displayedNotes[writeIndex++] = note;
      }
    }
    this.gameState.displayedNotes.length = writeIndex;
  }

  createNewNoteElements(currentTime) {
    const sheet = this.gameState.sheet;
    const previewDelay = CONFIG.NOTE_PREVIEW_DELAY;
    const scaleDuration = CONFIG.SCALE_DURATION;

    for (let i = 0; i < sheet.length; i++) {
      const note = sheet[i];
      if (note.element) continue;

      if (currentTime >= note.precalculatedStartAt) {
        this.createNoteElement(note);
      }
    }
  }

  createNoteElement(note) {
    const noteElement = document.createElement('div');
    noteElement.classList.add('item');

    const lane = document.createElement('div');
    lane.classList.add('lane');

    // const laneParent = document.createElement('div');
    // laneParent.classList.add('laneParent');

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

    // laneParent.appendChild(lane);
    this.gameState.elements.container.appendChild(lane);

    // Set note reference
    note.element = noteElement;
    noteElement.style.setProperty('--r', rotation + 'deg');

    this.recalculateNoteScaleTiming(note);
    this.gameState.displayedNotes.push(note);

  }

  assembleNote(note, elements) {
    let { noteElement, lane, noteContainer } = elements;

    // Create a fragment to batch DOM operations
    const fragment = document.createDocumentFragment();
    let speedMod = 1;
    if (note.timeSheet) {
      speedMod = note.timeSheet[0]?.speed != undefined ? note.timeSheet[0]?.speed : 1;
    }
    if (note.slider) {
      noteElement.classList.add('slider');
      const actualHeight = ((note.sliderEnd - note.time) / (CONFIG.NOTE_PREVIEW_DELAY / speedMod)) * (CONFIG.ADJUSTED_MAX_TRAVEL);
      noteElement.style.translate = `0px`;

      // noteElement.style.setProperty('--sliderHeight', `${actualHeight}px`);

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

      if (note.holdableStart) header2.classList.add('holdable_end');
      if (note.holdableEnd) header.classList.add('holdable_start');

      if (CONFIG.HINT_VISIBILITY != 0) {
        const hint = document.createElement('div');
        hint.classList.add('hint');
        header2.appendChild(hint);
        hint.style.transform = `scale(0)`;
        hint.style.opacity = CONFIG.HINT_VISIBILITY;
        note.hint = hint;

        const endHint = document.createElement('div');
        endHint.classList.add('hint');
        header.appendChild(endHint);
        endHint.style.transform = `scale(0)`;
        endHint.style.opacity = CONFIG.HINT_VISIBILITY;
        note.endHint = endHint;
      }

      note.endElement = header2;
      note.startElement = header;

      noteElement.appendChild(header2);

      noteContainer.appendChild(noteElement);
    } else {
      noteElement.style.translate = `0px`;

      const header = document.createElement('div');
      header.classList.add('header');
      noteElement.appendChild(header);
      header.style.zIndex = this.gameState.noteIndex;
      this.gameState.noteIndex = this.gameState.noteIndex - 1;


      if (CONFIG.HINT_VISIBILITY != 0) {
        const hint = document.createElement('div');
        hint.classList.add('hint');
        header.appendChild(hint);
        hint.style.transform = `scale(0)`;
        hint.style.opacity = CONFIG.HINT_VISIBILITY;
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
        traceParent.style.zIndex = this.gameState.noteIndex;
        this.gameState.noteIndex = this.gameState.noteIndex - 1;
        traceParent.classList.add('trace-parent');
        let wildCard = 0;
        if (note.halfSwipe) {
          let multiplier = note.direction == -1 ? -1 : 1;
          wildCard = 30 * multiplier
        }
        if (note.quarterSwipe) {
          let multiplier = note.direction == -1 ? 1 : -1;
          wildCard = (30 * multiplier);
        }
        // if (note.shortSwipe) {
        //   let multiplier = note.direction == -1 ? -1 : 1;
        //   wildCard = 30 * multiplier;
        // }
        traceParent.style.rotate = ((note.angle * CONFIG.ANGLE_MODIFIER) + 270 + wildCard) + 'deg';

        let traceType = 'trace-normal';
        let additionalClass = null;
        if (note.halfSwipe) traceType = 'trace-half';
        if (note.quarterSwipe) traceType = 'trace-quarter';
        if (note.shortSwipe) traceType = 'trace-short';
        if (note.direction == -1) additionalClass = 'trace-inverted';

        let tracePath = document.createElement('div');
        tracePath.classList.add('traceable', traceType);
        if (additionalClass) tracePath.classList.add(additionalClass);
        traceParent.appendChild(tracePath);
        note.traceParent = traceParent;
        note.tracePath = tracePath;


        noteElement.style.setProperty('--duration', `${note.swipeEnd - note.time}ms`)

        this.gameState.elements.container.appendChild(traceParent);
        noteElement.classList.add('flick_large_starter');
        if (!note.halfSwipe && !note.quarterSwipe & !note.shortSwipe) {
          note.desiredAngle = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + 180));
          if (note.desiredAngle == 6) {
            note.desiredAngle = 0;
          }
        } else {
          if (note.halfSwipe) {
            let modifier = -1;
            if (note.direction == -1) modifier = 1;
            let reachAngle1 = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + (CONFIG.ANGLE_MODIFIER * 1 * modifier)));
            let reachAngle2 = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + (CONFIG.ANGLE_MODIFIER * 2 * modifier)));
            let desiredAngle = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + (CONFIG.ANGLE_MODIFIER * 2 * modifier)));
            let preAngle = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) - (CONFIG.ANGLE_MODIFIER * 1 * modifier)));
            if (reachAngle1 == 6) reachAngle1 = 0;
            if (reachAngle2 == 6) reachAngle2 = 0;
            if (desiredAngle == 6) desiredAngle = 0;
            note.toReach = {
              [reachAngle2]: false,
              [reachAngle1]: false
            };
            note.desiredAngle = desiredAngle;
            note.preAngle = preAngle;
            let a1 = this.normalizeAngle(desiredAngle * CONFIG.ANGLE_MODIFIER);
            let a2 = this.normalizeAngle(note.angle * CONFIG.ANGLE_MODIFIER);
            if (note.direction == -1) {
              note.angleRange = [a2, a1];
            } else {
              note.angleRange = [a1, a2];
            }
          } else if (note.quarterSwipe) {
            let modifier = -1;
            if (note.direction == -1) modifier = 1;
            let desiredAngle = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + (CONFIG.ANGLE_MODIFIER * 1 * modifier)));
            if (desiredAngle == 6) desiredAngle = 0;
            note.desiredAngle = desiredAngle;
            note.toReach = {
              [note.desiredAngle]: false
            }
          } else if (note.shortSwipe) {
            let modifier = -1;
            if (note.direction == -1) modifier = 1;
            note.desiredAngle = this.inputSystem.getSegment(this.normalizeAngle((note.angle * CONFIG.ANGLE_MODIFIER) + (CONFIG.ANGLE_MODIFIER * 2 * modifier)));
            if (note.desiredAngle == 6) {
              note.desiredAngle = 0;
            }
          }
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

    if (note.holdable) {
      this.updateHoldableNote(note, currentTime)
    }

    this.updateRegularNotePosition(note, currentTime, noteTiming);
  }

  updateHoldableNote(note, time) {
    if (note.time > time || note.fake) return;
    for (let [pointID, point] of this.inputSystem.points) {
      let pointAngle = this.inputSystem.getSegment(point.angle);
      if (pointAngle == 6) pointAngle = 0;
      if (pointAngle == note.angle) {
        if (!CONFIG.TOUCHSCREEN && point.analog) continue
        return this.inputSystem.hitNote(note, pointID)
      }
    }
  }

  updateSwipeHint(note, time) {
    if (note.shouldBeDone && note.swipeEnd <= time) {
      return this.inputSystem.swipeNote(note, null)
    };
    if (note.time - time > (CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION)) return;
    if (note.time > time) {
      note.tracePath.style.opacity = getProgress(time, note.swipe_fadeInStart, note.swipe_fadeInEnd);
    }
    if (note.fadeInEnd <= time) {
      note.tracePath.style.opacity = 1;
    }

    let progress = Math.min(getProgress(time, note.time, note.swipeEnd), 1);
    let offset = Math.floor(progress * 100);

    if (false) {
      note.traceParent.style.maskImage = null;
      if (note.halfSwipe) {
        note.tracePath.style.transform = `rotate(${-offset * 1.8}deg)`;
      } else if (note.quarterSwipe) {
        note.tracePath.style.transform = `translate(0%, ${-offset / 2.3}%)`;
      } else {
        note.tracePath.style.transform = `translate(0%, ${-offset}%)`;
      }
    }


    if (note.halfSwipe) {
      if (CONFIG.TOUCHSCREEN) {
        this.updateComplexSwipeState(note);
      } else {
        this.updateRotationalSwipeState(note);
      }
    } else {
      this.updateSwipeState(note);
    }
  }

  angleDelta(from, to) {
    let d = ((to - from + 540) % 360) - 180;
    return d;
  }

  updateRotationalSwipeState(note) {
    if (note.time - game.gameState.currentTime > CONFIG.PERMISSIVE_SWIPE_PRECHECK) return;

    let angle1 = note.angleRange[0];
    let angle2 = note.angleRange[1];

    let foundNotePoints = note.points ? note.points : [];
    let finalNotePoints = {};

    for (let pointID in foundNotePoints) {
      let foundPoint = this.inputSystem.points.get(pointID);
      if (!foundPoint) continue

      if (foundPoint.distance > CONFIG.PERMISSIVE_SWIPE_TRESHOLD) {
        const delta = note.direction != -1 ? this.angleDelta(foundNotePoints[pointID].initialAngle, this.inputSystem.normalizeAngle(foundPoint.rawAngle)) : this.angleDelta(this.inputSystem.normalizeAngle(foundPoint.rawAngle), foundNotePoints[pointID].initialAngle);
        if ((note.direction != -1 && delta > CONFIG.HALF_SWIPE_MIN_MOVEMENT) || (note.direction == -1 && delta < -CONFIG.HALF_SWIPE_MIN_MOVEMENT)) {
          return this.inputSystem.swipeNote(note, foundPoint);
        }
      }

      finalNotePoints[pointID] = foundNotePoints[pointID];
    }

    for (let [pointID, point] of this.inputSystem.points) {
      if (finalNotePoints[pointID]) continue;

      if (!point || !point.analog) continue;
      let pointAngle = this.inputSystem.normalizeAngle(point.rawAngle);

      console.log(pointAngle, angle1, angle2, point.distance)
      const isInRange = this.inputSystem.isAngleBetween(pointAngle, angle1, angle2);

      if (isInRange && point.distance > CONFIG.PERMISSIVE_SWIPE_TRESHOLD) {
        finalNotePoints[pointID] = { id: pointID, initialAngle: pointAngle };
      }
    }

    note.points = finalNotePoints;
  }

  updateComplexSwipeState(note) {
    if (note.time - game.gameState.currentTime > CONFIG.PERMISSIVE_SWIPE_PRECHECK) return;

    let foundNotePoints = note.points ? note.points : [];
    let finalNotePoints = [];
    for (let i = 0; i < foundNotePoints.length; i++) {
      let point = this.inputSystem.points.get(foundNotePoints[i]);
      if (!point || !point.analog) continue;
      let pointAngle = this.inputSystem.getSegment(point.angle);
      if (pointAngle == 6) pointAngle = 0;

      if (point.distance > CONFIG.PERMISSIVE_SWIPE_TRESHOLD && note.toReach[pointAngle] == false) {
        note.toReach[pointAngle] = true;
      }

      if (note.toReach[pointAngle] && point.distance > CONFIG.PERMISSIVE_SWIPE_TRESHOLD) {
        let allTrue = true;
        for (let reachable in note.toReach) {
          if (!note.toReach[reachable]) allTrue = false;
        }
        if (allTrue && pointAngle == note.desiredAngle) return this.inputSystem.swipeNote(note, point);
      }

      finalNotePoints.push(foundNotePoints[i]);
    }

    for (let [pointID, point] of this.inputSystem.points) {
      if (finalNotePoints.indexOf(pointID) != -1) continue;
      let pointAngle = this.inputSystem.getSegment(point.angle);
      if (pointAngle == 6) pointAngle = 0;
      if (!point.associatedNote && point.analog && point.distance > CONFIG.PERMISSIVE_SWIPE_TRESHOLD) {
        finalNotePoints.push(pointID);
        if (note.toReach[pointAngle] == false) note.toReach[pointAngle] = true;
        if (!note.firstPointDetectedAt) note.firstPointDetectedAt = this.gameState.currentTime;
      }
    }

    note.points = finalNotePoints;
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
  getUnboundProgress(value, min, max) {
    return (value - min) / (max - min)
  }
  updateSliderPosition(note, actualCurrentTime, timing) {
    const previewDelay = timing?.speed ? CONFIG.NOTE_PREVIEW_DELAY / timing.speed : CONFIG.NOTE_PREVIEW_DELAY;
    const noteTime = note.time;
    let currentTime = actualCurrentTime;
    if (timing?.offset != undefined && timing?.offset) {
      currentTime = noteTime + timing.offset;
    }

    let scale = 1;
    if (currentTime > note.scaleStart && currentTime < note.scaleEnd) {
      scale = (currentTime - note.scaleStart) / note.scaleDuration;
    } else if (currentTime < note.scaleStart) {
      scale = 0;
    } else if (currentTime > note.scaleEnd) {
      scale = 1;
    }

    let opacityThreshold = note.sliderEnd + (CONFIG.ACCEPTANCE_THRESHOLD / 2);
    if (opacityThreshold <= currentTime) {
      let start = opacityThreshold;
      let end = note.sliderEnd + CONFIG.ACCEPTANCE_THRESHOLD;
      note.element.style.opacity = 1 - getProgress(currentTime, start, end);
    } else if (note.element.style.opacity != 1) {
      note.element.style.opacity = 1;
    }

    note.startElement.style.transform = `scale(${scale})`;
    note.endElement.style.transform = `scale(${scale})`;

    if (note.hint) {
      note.hint.style.transform = `scale(${Math.min(1.1, getProgress(currentTime + previewDelay, noteTime - CONFIG.HINT_START, noteTime + previewDelay))})`;
    }
    let progress = getProgress(currentTime + previewDelay, note.time, note.sliderEnd);
    let currentHeight = Math.min((progress * note.height), note.height);
    note.midframe.style.scale = `1 ${Math.max((currentHeight) / CONFIG.NOTE_RADIUS, 0)}`
    note.endElement.style.translate = `0px ${currentHeight - CONFIG.NOTE_RADIUS}px`

    let movement = ((progress * note.height) - currentHeight);
    note.element.style.translate = `0px ${movement - CONFIG.ADJUSTED_MAX_TRAVEL}px`;

    this.updateSliderHoldStatus(note);
  }

  updateSliderHoldStatus(note) {
    let isBeingHeld = false;
    for (let [pointID, point] of this.inputSystem.points) {
      if (CONFIG.TOUCHSCREEN) {
        if (this.inputSystem.getSegment(point.angle) == note.angle) isBeingHeld = true;
      } else {
        if (this.inputSystem.getSegment(point.angle) == note.angle && !point.analog) isBeingHeld = true;
      }
    }
    if (isBeingHeld) {
      if (note.holdableEnd && note.sliderEnd <= this.gameState.currentTime) {
        return this.inputSystem.releaseSlider(note);
      }
      if ((!note.isBeingHeld && note.wasEverHeld)) {
        this.inputSystem.holdSlider(note);
      }
    } else if (!isBeingHeld && note.isBeingHeld) {
      this.inputSystem.releaseSlider(note);
    }
  }

  updateRegularNotePosition(note, actualCurrentTime, timing) {
    const previewDelay = timing?.speed ? CONFIG.NOTE_PREVIEW_DELAY / timing.speed : CONFIG.NOTE_PREVIEW_DELAY;
    const noteTime = note.time;
    let currentTime = actualCurrentTime;
    if (timing?.offset) {
      currentTime = noteTime + timing.offset;
    }

    let scale = 1;
    if (currentTime > note.scaleStart && currentTime < note.scaleEnd) {
      scale = (currentTime - note.scaleStart) / note.scaleDuration;
    } else if (currentTime < note.scaleStart) {
      scale = 0;
    } else if (currentTime > note.scaleEnd) {
      scale = 1;
    }

    let opacityThreshold = noteTime + (CONFIG.ACCEPTANCE_THRESHOLD / 2);
    if (opacityThreshold <= currentTime) {
      let start = opacityThreshold;
      let end = noteTime + CONFIG.ACCEPTANCE_THRESHOLD;
      note.element.style.opacity = 1 - getProgress(currentTime, start, end);
    } else if (note.element.style.opacity != 1) {
      note.element.style.opacity = 1;
    }

    note.element.style.transform = `scale(${scale})`;

    if (note.hint) {
      note.hint.style.transform = `scale(${Math.min(1.1, getProgress(currentTime + previewDelay, noteTime - CONFIG.HINT_START, noteTime + previewDelay))})`;
    }

    let progress = getProgress(currentTime, note.time - previewDelay, note.time);
    note.element.style.translate = `0px ${(progress * CONFIG.ADJUSTED_MAX_TRAVEL) - CONFIG.ADJUSTED_MAX_TRAVEL}px`;
  }


  cleanupFailedNotes(currentTime) {
    for (let i = 0; i < this.gameState.sheet.length; i++) {
      const note = this.gameState.sheet[i];

      if ((note.element && !note.done && this.hasFailed(note, currentTime))) {
        if (!note.fake) {
          this.gameState.combo = 0;
          this.gameState.scoringSystem.updateScoreDisplays();
          this.gameState.scoringPad.miss.push(note.time - currentTime)
        }

        if (note.element) {
          note.element.parentElement.parentElement.remove();
        }
        if (note.traceParent) {
          note.traceParent.remove();
        }

        note.done = true;
      }
    }
  }

  hasFailed(note, currentTime) {
    if (note.slider) {
      let failed = currentTime > note.precalculatedFailTime;
      if (failed && !note.fake) {
        note.done = true;
        if (note.slider) this.inputSystem.releaseSlider(note, true);
      }
      return failed;
    }

    return currentTime > note.precalculatedFailTime;
  }

  createFailedHoldEffect(note) {

  }

  normalizeAngle(deg) {
    return ((parseFloat(deg) % 360) + 360) % 360;
  }

  recalculateNoteScaleTiming(note) {
    let modifier = 1;
    let mysticalAddition = 0;
    let adjustedPreviewDelay = CONFIG.NOTE_PREVIEW_DELAY;
    if (note.timeSheet && note.timeSheet[0]?.speed != undefined) {
      modifier = note.timeSheet[0].speed;

      adjustedPreviewDelay = CONFIG.NOTE_PREVIEW_DELAY / modifier;
      // how many px does it mean if i 
      mysticalAddition = ((CONFIG.NOTE_RADIUS / 2) / CONFIG.ADJUSTED_MAX_TRAVEL) * adjustedPreviewDelay;
    }

    const adjustedScaleDuration = CONFIG.SCALE_DURATION / modifier;

    note.scaleStart = note.time - (adjustedPreviewDelay + adjustedScaleDuration);
    note.scaleEnd = (note.time - adjustedPreviewDelay);
    note.scaleDuration = adjustedScaleDuration;
    note.mysticalAddition = mysticalAddition;

    if (modifier != 1) {
      note.startAt = (CONFIG.NOTE_PREVIEW_DELAY / modifier) * -1;
    }
  }
}