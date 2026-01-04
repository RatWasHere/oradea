function getSelectableRects() {
  return Array.from(document.querySelectorAll(".controller_selectable")).filter(el => (el.getBoundingClientRect().width > 0)).map(el => ({
    el,
    rect: el.getBoundingClientRect()
  }));
}
let currentEl = null;
let globalControllerActions = {
  rightTrigger: () => { },
  leftTrigger: () => { },
  playTrigger: () => { },
  aTrigger: () => { },
  bTrigger: () => { },
  xTrigger: () => { },
  yTrigger: () => { }
}
function setSelection(el) {
  if (currentEl) currentEl.classList.remove("selected");
  currentEl = el;
  if (currentEl) currentEl.classList.add("selected");
  eval(currentEl.dataset.highlight)
}

var lastDirection = null;
var lastDirectionTime = 0;

function moveSelection(direction) {
  if (!document.hasFocus()) return
  if (lastDirection == direction && Date.now() - lastDirectionTime < 220) return;
  lastDirection = `${direction}`;
  lastDirectionTime = Date.now();
  if (currentEl?.type == 'range' && (direction == 'left' || direction == 'right')) {
    currentEl.value = Number(currentEl.value) + (direction == 'left' ? -Number(currentEl.step || 1) : Number(currentEl.step || 1));
    currentEl.oninput(currentEl.value);
    currentEl.onmousedown();
    setTimeout(() => {
      currentEl.onmouseup();
      // window.focus();
    }, 500);
    return
  }
  const selectables = getSelectableRects();
  if (!currentEl && selectables.length > 0) {
    setSelection(selectables[0].el);
    return;
  }
  let scrollToElement = currentEl;
  while (scrollToElement.dataset.unscrollable == 'true') {
    scrollToElement = scrollToElement.parentElement;
  }
  console.log('crollin g', scrollToElement.offsetTop)
  scrollToElement.parentElement.scrollTo({
    top: scrollToElement.offsetTop,
    behavior: 'smooth'
  })

  const currentRect = currentEl.getBoundingClientRect();

  // Filter candidates based on direction
  let candidates = selectables.filter(({ el, rect }) => {
    if (el === currentEl) return false;

    switch (direction) {
      case "up": return rect.bottom <= currentRect.top;
      case "down": return rect.top >= currentRect.bottom;
      case "left": return rect.right <= currentRect.left;
      case "right": return rect.left >= currentRect.right;
    }
  });

  // Score candidates: distance from center of current
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;

  candidates = candidates.map(({ el, rect }) => {
    const rx = rect.left + rect.width / 2;
    const ry = rect.top + rect.height / 2;
    const dx = rx - cx;
    const dy = ry - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return { el, dist, dx, dy };
  });

  // Sort by distance
  candidates.sort((a, b) => a.dist - b.dist);

  if (candidates.length > 0) {
    setSelection(candidates[0].el);
  }
}

function activateSelection() {
  if (!document.hasFocus()) return
  if (currentEl || document.getElementsByClassName('selected').length > 0) {
    let element = (currentEl || document.getElementsByClassName('selected')[0]);
    if (element.dataset.hitc) eval(element.dataset.hitc);
    element.click(); // or trigger custom behavior
  }
}

window.addEventListener("keydown", e => {
  if (e.key === "ArrowUp") moveSelection("up");
  if (e.key === "ArrowDown") moveSelection("down");
  if (e.key === "ArrowLeft") moveSelection("left");
  if (e.key === "ArrowRight") moveSelection("right");
  if (e.key === "Enter") activateSelection();
});

let lastInputTime = 0;
let lastControllerState = null;
let gamepadButtonStates = {
  up: false,
  down: false,
  left: false,
  right: false
};
let areGlyphsHidden = null;
function pollGamepads() {
  const pads = navigator.getGamepads();
  let sheet = document.styleSheets[0];
  let isZero = pads.filter(pad => !!pad).length === 0;
  if (isZero && !areGlyphsHidden) {
    areGlyphsHidden = true;
    // insert a rule at the end (second arg is the index)
    sheet?.insertRule(":root { --controller-display-state: none; }", sheet.cssRules.length);
    return
  } else if (!isZero && areGlyphsHidden == true) {
    areGlyphsHidden = false;
    sheet?.insertRule(":root { --controller-display-state: block; }", sheet.cssRules.length);
  };

  for (const pad of pads) {
    if (!pad) continue;

    // Compute D-pad booleans
    const dpadUp = !!pad.buttons[12]?.pressed;
    const dpadDown = !!pad.buttons[13]?.pressed;
    const dpadLeft = !!pad.buttons[14]?.pressed;
    const dpadRight = !!pad.buttons[15]?.pressed;

    // Analog stick (handle releases too) - with deadzone fallback to right stick
    const DEADZONE = 0.2;
    let x = pad.axes[0];
    let y = pad.axes[1];

    // If left stick is in deadzone, use right stick
    if (Math.abs(x) < DEADZONE && Math.abs(y) < DEADZONE) {
      x = pad.axes[2];
      y = pad.axes[3];
    }

    const analogUp = y < -0.5;
    const analogDown = y > 0.5;
    const analogLeft = x < -0.5;
    const analogRight = x > 0.5;

    // Derive current directional pressed state (either D-pad or analog)
    const currentUp = dpadUp || analogUp;
    const currentDown = dpadDown || analogDown;
    const currentLeft = dpadLeft || analogLeft;
    const currentRight = dpadRight || analogRight;

    // NEW: Shoulder button detection (typical mapping: 4 = LB, 5 = RB)
    const shoulderLeft = !!pad.buttons[4]?.pressed;
    const shoulderRight = !!pad.buttons[5]?.pressed;

    // Update the public-ish gamepadButtonStates (keeps existing code compatible)
    gamepadButtonStates.up = currentUp;
    gamepadButtonStates.down = currentDown;
    gamepadButtonStates.left = currentLeft;
    gamepadButtonStates.right = currentRight;

    // Ensure lastControllerState exists and has shoulder fields
    if (!lastControllerState) {
      lastControllerState = { up: false, down: false, left: false, right: false, shoulderLeft: false, shoulderRight: false };
    } else {
      // ensure fields exist if lastControllerState was created earlier without shoulder fields
      lastControllerState.shoulderLeft = lastControllerState.shoulderLeft || false;
      lastControllerState.shoulderRight = lastControllerState.shoulderRight || false;
    }

    // Edge detection for shoulder buttons: trigger only when button becomes pressed (wasn't pressed last poll)
    if (shoulderLeft && !lastControllerState.shoulderLeft) {
      if (typeof globalControllerActions !== 'undefined' && typeof globalControllerActions.leftTrigger === 'function') {
        try { globalControllerActions.leftTrigger(); } catch (e) { console.error(e); }
      }
    }

    if (shoulderRight && !lastControllerState.shoulderRight) {
      if (typeof globalControllerActions !== 'undefined' && typeof globalControllerActions.rightTrigger === 'function') {
        try { globalControllerActions.rightTrigger(); } catch (e) { console.error(e); }
      }
    }

    // Read face buttons and Start/Play
    const btnA = !!pad.buttons[0]?.pressed;
    const btnB = !!pad.buttons[1]?.pressed;
    const btnX = !!pad.buttons[2]?.pressed;
    const btnY = !!pad.buttons[3]?.pressed;
    const btnPlay = !!pad.buttons[9]?.pressed; // Start / Play

    // Ensure lastControllerState exists and has button fields
    if (!lastControllerState) {
      lastControllerState = {
        up: false, down: false, left: false, right: false,
        shoulderLeft: false, shoulderRight: false,
        a: false, b: false, x: false, y: false, play: false
      };
    } else {
      lastControllerState.a = lastControllerState.a || false;
      lastControllerState.b = lastControllerState.b || false;
      lastControllerState.x = lastControllerState.x || false;
      lastControllerState.y = lastControllerState.y || false;
      lastControllerState.play = lastControllerState.play || false;
    }

    // Edge detection for face buttons and play/start
    if (btnA && !lastControllerState.a) {
      if (typeof globalControllerActions !== 'undefined' && typeof globalControllerActions.aTrigger === 'function') {
        try { globalControllerActions.aTrigger(); } catch (e) { console.error(e); }
      }
    }
    if (btnB && !lastControllerState.b) {
      if (typeof globalControllerActions !== 'undefined' && typeof globalControllerActions.bTrigger === 'function') {
        try { globalControllerActions.bTrigger(); } catch (e) { console.error(e); }
      }
    }
    if (btnX && !lastControllerState.x) {
      if (typeof globalControllerActions !== 'undefined' && typeof globalControllerActions.xTrigger === 'function') {
        try { globalControllerActions.xTrigger(); } catch (e) { console.error(e); }
      }
    }
    if (btnY && !lastControllerState.y) {
      if (typeof globalControllerActions !== 'undefined' && typeof globalControllerActions.yTrigger === 'function') {
        try { globalControllerActions.yTrigger(); } catch (e) { console.error(e); }
      }
    }
    if (btnPlay && !lastControllerState.play) {
      if (typeof globalControllerActions !== 'undefined' && typeof globalControllerActions.playTrigger === 'function') {
        try { globalControllerActions.playTrigger(); } catch (e) { console.error(e); }
      }
    }

    // D-pad / analog movement (still allow holding to move selection based on existing behavior)
    if (currentUp) moveSelection("up");
    if (currentDown) moveSelection("down");
    if (currentLeft) moveSelection("left");
    if (currentRight) moveSelection("right");

    // A button (unchanged)
    if (pad.buttons[0].pressed) {
      const currentTime = Date.now();
      if (currentTime - lastInputTime > 500) {
        activateSelection();
        lastInputTime = currentTime;
      }
    }

    // Save current as last for next poll (including shoulders and face buttons)
    lastControllerState.left = currentLeft;
    lastControllerState.right = currentRight;
    lastControllerState.up = currentUp;
    lastControllerState.down = currentDown;
    lastControllerState.shoulderLeft = shoulderLeft;
    lastControllerState.shoulderRight = shoulderRight;
    lastControllerState.a = btnA;
    lastControllerState.b = btnB;
    lastControllerState.x = btnX;
    lastControllerState.y = btnY;
    lastControllerState.play = btnPlay;
  }
}


setInterval(pollGamepads, 50); // poll every 100ms
