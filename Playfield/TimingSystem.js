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
    if (timingPoint.visuals) {
      this.updateNoteVisuals(note, time, timingPoint);
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
  applyStyleToTarget(target, key, value) {
    if (!target) return;
    if (target instanceof NodeList || Array.isArray(target)) {
      for (let i = 0; i < target.length; i++) {
        target[i].style[key] = value;
      }
    } else {
      target.style[key] = value;
    }
  }
  updateNoteVisuals(note, currentTime, timingPoint) {
    if (!note?.element || !note.timeSheet) return;

    const activePoint = timingPoint ? timingPoint : this.getTimingPointAt(currentTime, note.timeSheet, note.time);
    if (!activePoint || !activePoint.visuals) return;

    const visualsConfig = activePoint.visuals;

    // --- FIX 1: Calculate the absolute start time using the note's relative timeline offset ---
    const rawPointTime = parseFloat(this.fromSpecial(activePoint.time));
    const noteRelativeOffset = parseFloat(note.time || 0);
    const absoluteStartTime = rawPointTime + noteRelativeOffset;

    const targetMap = {
      parent: note.element.parentElement,
      note: note.element,
      header: note.element,
      hint: note.hint,
      endHint: note.element.querySelectorAll('.endHint')
    };

    // --- FIX 2: Removed duplicate helper definition block entirely to utilize class scope ---

    const targets = ['parent', 'note', 'header', 'hint', 'endHint'];
    for (let i = 0; i < targets.length; i++) {
      const targetKey = targets[i];
      const styleBlock = visualsConfig[targetKey];
      if (!styleBlock) continue;

      const properties = Object.keys(styleBlock);
      for (let j = 0; j < properties.length; j++) {
        const propKey = properties[j];
        const propValue = styleBlock[propKey];

        if (propValue && typeof propValue === 'object' && 'value' in propValue) {
          const duration = propValue.duration || 1000;

          // --- FIX 3: Base elapsed calculations on the true, offset absolute timeline ---
          const elapsed = currentTime - absoluteStartTime;

          const progress = Math.min(Math.max(elapsed / duration, 0), 1);

          const interpolatedStyle = this.interpolateCSSProperty(
            progress,
            propValue,
            visualsConfig
          );

          this.applyStyleToTarget(targetMap[targetKey], propKey, interpolatedStyle);
        } else {
          this.applyStyleToTarget(targetMap[targetKey], propKey, propValue);
        }
      }
    }
  }

  interpolateCSSProperty(progress, propConfig, globalConfig) {
    const { from, to, value, easing } = propConfig;
    const easedProgress = this.applyEasing(progress, easing);

    // Start with the raw string template (e.g., "translate(#1px, #2px)")
    let finalStyleString = value;

    // Loop through all elements in the "from" array
    for (let i = 0; i < from.length; i++) {
      const startVal = parseFloat(from[i]);
      const endVal = parseFloat(to[i]);

      // Handle fallback if "to" array is missing a matching element
      const currentVal = startVal + ((isNaN(endVal) ? startVal : endVal) - startVal) * easedProgress;

      // Dynamically replace '#1', '#2', '#3', etc.
      const placeholder = `#${i + 1}`;
      finalStyleString = finalStyleString.replace(placeholder, currentVal);
    }

    return finalStyleString;
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
      flicker.style.transition = `opacity ${duration}ms ${modifier.easing || 'ease'}`;
      flicker.style.opacity = modifier.opacity;
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
      const parentElement = noteElement.parentElement;
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
        if (typeof easingType == 'object' && easingType.cubicBezier && easingType.cubicBezier.length == 4) {
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
