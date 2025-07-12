const fs = require('fs');
let crossDetails = JSON.parse(fs.readFileSync('./crossdetails', 'utf8'));
let sheet = JSON.parse(fs.readFileSync(`./Beatmaps/${crossDetails.location}/${crossDetails.map}`, 'utf8'));
let timeSheet = [
  {
    time: 100,
    transition: 430,
    speed: 1,
    offset: 2
  }
]
var pad = undefined;
let keysPressed = {};
let comboDisplay = document.getElementById('comboDisplay');
let combo = 0;
let sector1 = 1;
let sector2 = 1;

function hasFailed(note) {
  let acceptanceTreshold = 500;
  if (((audio.currentTime * 1000) - (note.failTime || note.sliderEnd || note.time)) > acceptanceTreshold) {
    // console.log(Math.abs((note.hitBy || note.sliderEnd || note.time) - audio.currentTime * 1000), note.sliderEnd || note.time);
    return true;
  }
  return false;
}

// Snap toggle
let snapToInterval = true; // Set to false to disable snapping

function snapAngle(angle, interval = 45) {
  try {
    return norm(Math.round(angle / interval) * interval);
  } finally {
    // Efficiently light up preview arcs for both cursors
    const previewCount = 8;
    // FIX: Add +1 to sector calculation so sector matches cursor visually
    sector1 = (Math.round(norm(rotation1 + 270) / 45) + 1) % previewCount;
    sector2 = (Math.round(norm(rotation2 + 270) / 45) + 1) % previewCount;

    for (let i = 0; i < previewCount; i++) {
      // --- FIX: previewer IDs are 0-based in index.html, not 1-based ---
      let el = document.getElementById(`previewer${i}`);
      if (!el) continue;
      // Light up if either cursor is in this sector
      if (i === sector1 || i === sector2) {
        el.classList.add('hovered');
      } else {
        el.classList.remove('hovered');
        el.firstElementChild.classList.remove('hitKid');
      }
    }
  }
}

// let rotation;
let rotation1;
let rotation2;
let rotations = [0, 0];
let rawRotations = [0, 0];
const norm = deg => ((parseFloat(deg) % 360) + 360) % 360;

let container = document.getElementById('noteContainer');
let cursor1 = document.getElementById('cursor1');
let cursor2 = document.getElementById('cursor2');

let audio = (new Audio(`./Beatmaps/${crossDetails.location}/audio.mp3`));
audio.play();

// w = left trigger (cursor1)
// s = right trigger (cursor2)

document.onmousemove = (event) => {
  if (pad) return;
  let rect = container.getBoundingClientRect();
  let containerX = Math.floor(rect.x + (rect.width / 2));
  let containerY = Math.floor(rect.y + (rect.height / 2));

  let positionX = event.clientX;
  let positionY = event.clientY;
  let angle = Math.atan2(positionY - containerY, positionX - containerX);
  let angleDegrees = angle * (180 / Math.PI);
  rawRotations[0] = angleDegrees;
  rawRotations[1] = angleDegrees;

  // Snap angle if enabled
  let snappedAngle = snapToInterval ? snapAngle(angleDegrees, 45) : angleDegrees;

  // For demo: move both cursors to same position
  if (cursor1) cursor1.style.rotate = `${snappedAngle + 90}deg`;
  if (cursor2) cursor2.style.rotate = `${snappedAngle + 90}deg`;
  rotation1 = snappedAngle - 270;
  rotation2 = snappedAngle - 270;
  rotations[0] = rotation1;
  rotations[1] = rotation2;
}


let lraf = 0;
let displayedNotes = [];
let angleModifier = 45;
let noteArcAngle = 20; // degrees, how much of the circle the note arc spans

let notePreviewDelay = 1650; // ms before note time to show note
let containerRadius = 600; // px outward movement
let noteRadius = 75;

let isInArc = (note, rotation) => {
  // If rotation is not provided, pick the closest one automatically
  if (typeof rotation === 'undefined' || rotation === null) {
    rotation = getClosestRotation(note);
  }
  rotation = norm(rotation);
  if (typeof rotation != 'number') return;
  let noteStartingAngle = norm((note.angle * angleModifier) + 90 - (noteArcAngle / 2));
  let noteEndingAngle = norm(noteStartingAngle + noteArcAngle);
  if (noteStartingAngle < noteEndingAngle) {
    return rotation >= noteStartingAngle && rotation <= noteEndingAngle && !note.done;
  } else {
    return (rotation >= noteStartingAngle || rotation <= noteEndingAngle) && !note.done;
  }
};

function getAdequateAngle(note) {
  let wValid = keysPressed['w'] && (!note.requiredInput || note.requiredInput == 1) && isInArc(note, rotations[0]);
  let sValid = keysPressed['s'] && (!note.requiredInput || note.requiredInput == 2) && isInArc(note, rotations[1]);
  if (wValid) return rotations[0];
  if (sValid) return rotations[1];
  return null;
}


function hold(note, fail) {
  judge(note, true)
  let holdNote = document.createElement('div');
  holdNote.classList.add('arc');
  holdNote.classList.add('held');
  holdNote.style.rotate = `${(note.angle * angleModifier) + 270}deg`;
  if (fail) {
    holdNote.style.boxShadow = `red 0px -10px 1px 0px inset`
  } else if (note.flickDirection) {
    note.element.style.setProperty('--t', `${Math.max(100, (audio.currentTime * 1000) - note.flickMoment)}ms`);
    note.element.classList.add(`flicked`);
    if (pad) {
      vibrate(2)
    }
    setTimeout(() => {
      note.element.parentElement.parentElement.remove();
    }, 500);
  }
  container.append(holdNote);
  setTimeout(() => {
    holdNote.remove();
  }, 500);
}

let delay;
let timingPoint = { speed: 1, transition: 0, time: 0, offset: 0 };
let speed = 1;
let offset = 1; // it's a multiplier.

// Helper: interpolate between two numbers
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Returns {speed, offset} for a given time and timing sheet
function getTimingPointAt(t, timingSheet, defaultPoint = { speed: 1, offset: 0 }) {
  // Find the latest timing point whose time <= t
  let tp = null;
  for (let i = 0; i < timingSheet.length; i++) {
    if (parseFloat(timingSheet[i].time) + parseFloat(timingSheet[i].transition || 0) <= t) {
      tp = timingSheet[i];
    } else {
      break;
    }
  }
  if (!tp) return { ...defaultPoint };
  if (defaultPoint.note && defaultPoint.note.element && tp.style && defaultPoint.note.setStyle != tp.time) {
    console.log('went thru', tp.style.parent)
    defaultPoint.note.setStyle = tp.time;
    if (tp.style.parent) {
      for (let i in tp.style.parent) {
        console.log('got it')
        defaultPoint.note.element.parentElement.parentElement.style.setProperty(i, tp.style.parent[i]);
      }
    }
    if (tp.style.child) {
      for (let i in tp.style.child) {
        console.log("got the -kid too")
        defaultPoint.note.element.parentElement.style.setProperty(i, tp.style.child[i]);
      }
    }
  }

  // Calculate the starting speed and offset based on the note time
  let transition = parseFloat(tp.transition || 0);
  let startTime = parseFloat(tp.time);
  let endTime = startTime + transition;
  let speedFrom = parseFloat(tp.speed ?? defaultPoint.speed);
  let speedTo = parseFloat(tp.speed ?? defaultPoint.speed);
  let offsetFrom = parseFloat(tp.offset ?? defaultPoint.offset);
  let offsetTo = parseFloat(tp.offset ?? defaultPoint.offset);

  if (tp.from) {
    speedFrom = parseFloat(tp.from.speed);
    offsetFrom = parseFloat(tp.from.offset);
  }


  let noteProg = (t - startTime) / transition;
  noteProg = Math.min(Math.abs(1 - noteProg), 1);
  speedFrom = lerp(speedFrom, speedTo, noteProg);
  offsetFrom = lerp(offsetFrom, offsetTo, noteProg);



  if (transition === 0 || t >= endTime) {
    return { speed: speedTo, offset: offsetFrom * notePreviewDelay };
  }


  return {
    speed: speedFrom,
    offset: offsetFrom * notePreviewDelay
  };
}

let raf = (t) => {
  t = audio.currentTime * 1000;
  lraf = t;

  // Use new timing function for global timing
  // let globalTiming = getTimingPointAt(t, timeSheet, { speed: 1, offset: 0 });
  let globalTiming = { speed: 1, offset: 0 };
  speed = globalTiming.speed;
  offset = globalTiming.offset;

  // Cache gamepad state once per frame
  let padCache = pad ? navigator.getGamepads()[0] : null;
  if (padCache) {
    // Use left stick: axes[0] (x), axes[1] (y) for cursor1
    let x1 = padCache.axes[0];
    let y1 = padCache.axes[1];
    if (Math.abs(x1) > 0.1 || Math.abs(y1) > 0.1) {
      let angle1 = Math.atan2(y1, x1);
      let angleDegrees1 = angle1 * (180 / Math.PI);
      rawRotations[0] = angleDegrees1;
      let snappedAngle1 = snapToInterval ? snapAngle(angleDegrees1, 45) : angleDegrees1;
      if (cursor1 && cursor1.style.rotate !== `${snappedAngle1 + 90}deg`)
        cursor1.style.rotate = `${snappedAngle1 + 90}deg`;
      if (rotation1 != snappedAngle1 - 270) vibrate(4);
      rotation1 = snappedAngle1 - 270;
    }
    // Use right stick: axes[2] (x), axes[3] (y) for cursor2
    let x2 = padCache.axes[2];
    let y2 = padCache.axes[3];
    if (Math.abs(x2) > 0.1 || Math.abs(y2) > 0.1) {
      let angle2 = Math.atan2(y2, x2);
      let angleDegrees2 = angle2 * (180 / Math.PI);
      rawRotations[1] = angleDegrees2;
      let snappedAngle2 = snapToInterval ? snapAngle(angleDegrees2, 45) : angleDegrees2;
      if (cursor2 && cursor2.style.rotate !== `${snappedAngle2 + 90}deg`)
        cursor2.style.rotate = `${snappedAngle2 + 90}deg`;
      if (rotation2 != snappedAngle2 - 270) vibrate(4);
      rotation2 = snappedAngle2 - 270;
    }

    // Triggers: leftTrigger (button 6) for 'w'/cursor1, rightTrigger (button 7) for 's'/cursor2
    let leftTrigger = padCache.buttons[6]?.pressed;
    let rightTrigger = padCache.buttons[7]?.pressed;
    if (leftTrigger) {
      if (!keysPressed['w']) {
        keysPressed['w'] = true;
        document.onkeydown({ key: 'w', repeat: false });
        cursor1.firstElementChild.style.scale = '2';
      }
    } else {
      if (keysPressed['w']) {
        keysPressed['w'] = false;
        cursor1.firstElementChild.style.scale = '1';
        // Optionally, call onkeyup if needed
      }
    }

    if (rightTrigger) {
      if (!keysPressed['s']) {
        keysPressed['s'] = true;
        document.onkeydown({ key: 's', repeat: false });
        cursor2.firstElementChild.style.scale = '2';
      }
    } else {
      if (keysPressed['s']) {
        keysPressed['s'] = false;
        cursor2.firstElementChild.style.scale = '1';
        // Optionally, call onkeyup if needed
      }
    }

    rotations[0] = rotation1;
    rotations[1] = rotation2;
  }

  const previewCount = 8;
  // FIX: Add +1 to sector calculation so sector matches cursor visually
  sector1 = (Math.round(norm(rotation1 + 270) / 45) + 1) % previewCount;
  sector2 = (Math.round(norm(rotation2 + 270) / 45) + 1) % previewCount;

  for (let i = 0; i < previewCount; i++) {
    // --- FIX: previewer IDs are 0-based in index.html, not 1-based ---
    let el = document.getElementById(`previewer${i}`);
    if (!el) continue;
    // Light up if either cursor is in this sector
    if ((i === sector1 && keysPressed['w']) || (i === sector2 && keysPressed['s'])) {
      el.firstElementChild.classList.add('hitKid');
    } else {
      el.firstElementChild.classList.remove('hitKid');
    }
  }

  // Only update displayedNotes if needed
  if (displayedNotes.length > 0) {
    displayedNotes = displayedNotes.filter(n => !(n.done && t - notePreviewDelay >= n.time));
  }

  // Precompute interestSheet only if needed
  let interestSheet = sheet.map((n, i) => { return { ...n, i } })
    .filter(n => t >= n.startAt || n.time - notePreviewDelay);


  let noteTravelMax = containerRadius / 2;
  let sliderMaxHeight = noteTravelMax;

  // Use for (let i = 0; ...) instead of for...of
  for (let i = 0; i < interestSheet.length; i++) {
    const n = interestSheet[i];
    if (!n.element) {
      let note = document.createElement('div');
      note.classList.add('item');
      let lane = document.createElement('div');
      lane.classList.add('lane');
      let laneParent = document.createElement('div');
      laneParent.classList.add('laneParent');
      lane.style.rotate = `${(n.angle * angleModifier) + 270}deg`;
      let noteContainer = document.createElement('div');
      noteContainer.className = 'sliderContainer';

      if (n.hold) note.classList.add('hold');
      if (n.slider) {
        note.classList.add('slider');
        let actualHeight = (n.sliderEnd - n.time) / notePreviewDelay * sliderMaxHeight;
        note.style.height = `${actualHeight}px`;
        n.height = actualHeight;
        sheet[n.i].height = actualHeight;
        note.style.translate = `0px`;

        noteContainer.appendChild(note);
        lane.appendChild(noteContainer);
      } else {
        if (n.flickDirection) note.classList.add(`flick${n.flickDirection}`);
        noteContainer.appendChild(note)
        lane.appendChild(noteContainer);
      };

      let header = document.createElement('div');
      header.classList.add('header');
      note.appendChild(header);

      laneParent.appendChild(lane);
      container.appendChild(laneParent);

      n.element = note;
      sheet[n.i].element = note;
      // Only set style if changed
      let rotation = (n.angle * angleModifier) + 270;
      if (n.element) {
        n.element.style.setProperty('--r', rotation + 'deg');
      }
    }
  }

  // Use for (let i = 0; ...) instead of for...of for sheet
  for (let i = 0; i < sheet.length; i++) {
    const note = sheet[i];

    // choose which rotation to use based on the note's angle and the proximity of the angle
    if (!note.done && note.element) {
      // console.log('we finna call gtpa, the time is ', t)
      // Use new timing function for per-note timing
      var noteTiming = note.timeSheet
        ? getTimingPointAt(t, note.timeSheet, { speed, offset, note }) // <-- offset in ms, not divided
        : { speed, offset };
      noteTiming.offset = noteTiming.offset;

      // choose which rotation to use based on the note's angle and the proximity of the angle
      let rotation = getClosestRotation(note, true);
      let noteRotation = norm(rotation);
      let diff = Math.abs(noteRotation - note.angle * angleModifier);
      let threshold = 10; // degrees

      if (diff <= threshold) {
        // If the note is within the threshold, use its angle
        rotation = note.angle * angleModifier;
      } else {
        // Otherwise, use the calculated rotation
        rotation = rotation;
      }

      let noteProgress = t - note.time;
      // let noteScale = Math.max(Math.min(1 + noteProgress / notePreviewDelay, 1), 0);
      // Updated calculation to ensure noteTravel keeps going after note.time
      // Inside the raf function where noteTravel is calculated
      let previewDelay = notePreviewDelay / noteTiming.speed;
      let noteTime = note.time + (noteTiming.offset || 0);
      let noteTravelMax = containerRadius / 2;
      let noteTravel = Math.max(((t + (noteTiming.offset || 0)) - (note.time - previewDelay)) / previewDelay, 0) * noteTravelMax;

      if (note.slider) {
        let duration = note.sliderEnd - noteTime;
        let progression = (t + (noteTiming.offset || 0)) - noteTime;

        let spentHeight = ((duration - progression) / previewDelay) * sliderMaxHeight;
        let actualHeight = (note.sliderEnd - note.time) / previewDelay * sliderMaxHeight;

        let noteTranslate = `0px ${spentHeight * -1}px`;
        if (note.element.style.translate !== noteTranslate) {
          note.element.style.translate = noteTranslate;
        }

        if (note.element.style.height !== `${actualHeight}px` && !note.heightUnchanged) {
          note.element.style.height = `${actualHeight}px`;
        }
      } else {
        let newTranslate = `0px ${noteTravel}px`;
        if (note.element.style.translate !== newTranslate) {
          note.element.style.translate = newTranslate;
        }
      }
      if (hasFailed(note)) {
        note.element.parentElement.parentElement.remove();
        note.done = true;
        hold(note, true);
      }
    }
  }

  requestAnimationFrame(raf);
}

document.addEventListener('keydown', (event) => {
  keysPressed[event.key.toLowerCase()] = true;
})
document.addEventListener('keyup', (event) => {
  keysPressed[event.key.toLowerCase()] = false;
})

function vibrate(kind) {
  if (!pad) return
  if (kind == 1) {
    pad.vibrationActuator.playEffect("trigger-rumble", {
      startDelay: 0,
      duration: 100,
      weakMagnitude: 0.5,
      strongMagnitude: 0.7,
      leftTrigger: 1,
      rightTrigger: 1
    })
  } else if (kind == 2) {
    pad.vibrationActuator.playEffect("trigger-rumble", {
      startDelay: 0,
      duration: 50,
      weakMagnitude: 1,
      strongMagnitude: 1,
      leftTrigger: 1,
      rightTrigger: 1
    })
  } else if (kind == 3) {
    pad.vibrationActuator.playEffect("dual-rumble", {
      startDelay: 0,
      duration: 150,
      weakMagnitude: 1,
      strongMagnitude: 1,
    });
    pad.vibrationActuator.playEffect("trigger-rumble", {
      startDelay: 50,
      duration: 50,
      weakMagnitude: 0.5,
      strongMagnitude: 1,
      leftTrigger: 0.5,
      rightTrigger: 0.5
    });
  } else if (kind == 4) {
    pad.vibrationActuator.playEffect("dual-rumble", {
      startDelay: 0,
      duration: 50,
      weakMagnitude: 0,
      strongMagnitude: 0.1,
    });
  }

}

document.onkeydown = (event) => {
  if (event.repeat) return;
  let isW = event.key.toLowerCase() == 'w';
  let isS = event.key.toLowerCase() == 's';
  let laneIndex = isW ? 0 : 1;
  let normRotation = norm(rotations[laneIndex]);
  if (isW || isS) {
    let matchingNotes = sheet.filter(note => {
      if (!note.element) return false;
      if (note.wasHeld === true || note.done === true) return false;

      // Check if note matches the current input (1 = W, 2 = S, or null = either)
      const matchesInput = !note.requiredInput || note.requiredInput === (laneIndex + 1);
      const inCorrectArc = isInArc(note, rotations[laneIndex]);
      return matchesInput && inCorrectArc;
    });



    // Filter again for valid (non-slider) flickable or hold notes
    let closestNote = matchingNotes
      .filter(note => !note.slider)
      .sort((a, b) => {
        const normA = norm(parseFloat(a.angle) * angleModifier);
        const normB = norm(parseFloat(b.angle) * angleModifier);
        return Math.abs(normA - normRotation) - Math.abs(normB - normRotation);
      })
      .sort((a, b) => a.time - b.time)[0];

    for (const note of matchingNotes) {
      if (note.slider && !note.wasHeld && canBeHeld(note)) {
        if (note.time >= closestNote?.time) continue;
        note.wasHeld = true;
        note.wasEverHeld = true;
        note.element.style.opacity = '1';
        return
      }
    }

    if (closestNote) {
      if (closestNote.flickDirection) {
        let rawRotation = isW ? rawRotations[0] : rawRotations[1];
        closestNote.flickStart = rawRotation;
        closestNote.input = laneIndex;
        closestNote.flickMoment = audio.currentTime * 1000;
        if (pad) vibrate(4);
        return;
      }

      if (closestNote.hold && closestNote.time < audio.currentTime * 1000) {
        closestNote.done = true;
        closestNote.element.parentElement.parentElement.remove();
        vibrate(3);
      } else {
        closestNote.done = true;
        closestNote.element.parentElement.parentElement.remove();
        vibrate(2);
        hold(closestNote);
      }
      return
    }
  }
}


window.addEventListener('gamepadconnected', (event) => {
  pad = navigator.getGamepads()[0];
})

requestAnimationFrame(raf)

function getClosestRotation(note, provideNumbers) {
  // Ensure rotations are numbers
  const rot0 = typeof rotations[0] === 'number' ? rotations[0] : 0;
  const rot1 = typeof rotations[1] === 'number' ? rotations[1] : 0;

  if (note.requiredInput === 1) return norm(rot0);
  if (note.requiredInput === 2) return norm(rot1);

  if (keysPressed['w'] && !keysPressed['s']) return norm(rot0);
  if (keysPressed['s'] && !keysPressed['w']) return norm(rot1);

  const noteDeg = norm(note.angle * angleModifier);
  const diff0 = Math.abs(noteDeg - rot0);
  const diff1 = Math.abs(noteDeg - rot1);
  return norm(diff0 < diff1 ? rot0 : rot1);
}



function canBeHeld(note) {
  let windowSize = 300;
  if (note.slider) {
    return note.time - windowSize < audio.currentTime * 1000 || note.time + windowSize > audio.currentTime * 1000;
  } else {
    return note.time - windowSize < audio.currentTime * 1000;
  }
}

function judge(note, affectCombo = true) {
  let difference = Math.abs(note - audio.currentTime * 1000);
  let accuracyRanges = {
    'perfect': [0, 100],
    'great': [100, 200],
    'good': [200, 300],
    'ok': [300, 400],
    'bad': [400, 500],
  }

  let accuracy = 'miss';
  for (let key in accuracyRanges) {
    let range = accuracyRanges[key];
    if (difference >= range[0] && difference < range[1]) {
      accuracy = key;
      break;
    }
  }

  if (affectCombo) {
    if (difference > 300 || difference.toString() == 'NaN') {
      combo = 0;
    } else {
      combo++;
    }
  }

  updateComboDisplay()

  return accuracy;
}

function updateComboDisplay() {
  if (comboDisplay.innerText != combo) {
    comboDisplay.innerText = `${combo}`;
  }
}