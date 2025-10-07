function getSelectableRects() {
  return Array.from(document.querySelectorAll(".controller_selectable")).map(el => ({
    el,
    rect: el.getBoundingClientRect()
  }));
}
let currentEl = null;
let globalControllerActions = {
  rightTrigger: () => {
    console.log('tt!!!')
  },
  leftTrigger: () => {
    console.log('ll!!!')
  }
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
  console.log(lastDirection, direction, Date.now() - lastDirectionTime)
  if (lastDirection == direction && Date.now() - lastDirectionTime < 220) return;
  lastDirection = `${direction}`;
  lastDirectionTime = Date.now();
  const selectables = getSelectableRects();
  if (!currentEl && selectables.length > 0) {
    setSelection(selectables[0].el);
    return;
  }

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
  if (currentEl || document.getElementsByClassName('selected').length > 0) {
    let element = (currentEl || document.getElementsByClassName('selected')[0]);
    console.log(element.dataset.hitc)
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

function pollGamepads() {
  const pads = navigator.getGamepads();
  let sheet = document.styleSheets[0];
  if (pads.filter(pad => !!pad).length === 0) {

    // insert a rule at the end (second arg is the index)
    sheet?.insertRule(":root { --controller-display-state: none; }", sheet.cssRules.length);
    return
  } else {
    sheet?.insertRule(":root { --controller-display-state: block; }", sheet.cssRules.length);
  };

  for (const pad of pads) {
    if (!pad) continue;

    // Compute D-pad booleans
    const dpadUp = !!pad.buttons[12]?.pressed;
    const dpadDown = !!pad.buttons[13]?.pressed;
    const dpadLeft = !!pad.buttons[14]?.pressed;
    const dpadRight = !!pad.buttons[15]?.pressed;

    // Analog stick (handle releases too)
    const x = pad.axes[0];
    const y = pad.axes[1];

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

    // Save current as last for next poll (including shoulders)
    lastControllerState.left = currentLeft;
    lastControllerState.right = currentRight;
    lastControllerState.up = currentUp;
    lastControllerState.down = currentDown;
    lastControllerState.shoulderLeft = shoulderLeft;
    lastControllerState.shoulderRight = shoulderRight;

  }
}


setInterval(pollGamepads, 50); // poll every 100ms
