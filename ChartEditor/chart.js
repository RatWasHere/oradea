let editorHeight = 636;
let chartLines = document.getElementById('chart_lines');
let existingSnaps = [];
let scrollDuration = 2000;
let pixelsPerMs = editorHeight / scrollDuration;
let selectedNoteIndices = new Set(); 
let selectedNotes = new Set(); 
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionEnd = { x: 0, y: 0 };
const selectionBox = document.createElement('div');
selectionBox.id = 'selection-box';
document.body.appendChild(selectionBox);
let hoveredTime = 0;
let dragStartCoords = { x: 0, y: 0 };
let dragStartTime = 0;
let dragStartLane = 0;
let surpressScrolling = false;
let isMovingNote = false;
let movedNoteObject = null; 

function updateScrollDuration(newDuration) {
  scrollDuration = newDuration;
  pixelsPerMs = editorHeight / scrollDuration;
  generateSnapLines();
}
function getProgress(value, min, max) {
  return Math.max(0, (value - min) / (max - min));
}
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50; // memory usage

function selectNote(note, clearOthers = true) {
  if (clearOthers) {
    selectedNotes.clear();
  }
  selectedNotes.add(note);
  if (note.chartElement) {
    note.chartElement.classList.add('selected');
  }

  refreshLocalEvents();
}

function deselectNote(note) {
  selectedNotes.delete(note);
  if (note.chartElement) {
    note.chartElement.classList.remove('selected');
  }
  refreshLocalEvents();
}

function clearSelection() {
  selectedNotes.forEach(note => {
    if (note.chartElement) {
      note.chartElement.classList.remove('selected');
    }
  });
  selectedNotes.clear();
  refreshLocalEvents();
}

function toggleNoteSelection(note, clearOthers = true) {
  if (selectedNotes.has(note)) {
    deselectNote(note);
  } else {
    selectNote(note, clearOthers);
  }
}

let angleMap = {
  "0": 4,
  "1": 3,
  "2": 2,
  "3": 1,
  "4": 0,
  "5": 5
}




let bpm = 120;
let snapDivisor = 1;
let offsetMs;
let calculatedSpacing = 0;
function generateSnapLines() {
  let msPerBeat = 60000 / bpm;
  let msPerSnap = msPerBeat / snapDivisor;
  calculatedSpacing = msPerSnap * pixelsPerMs;

  existingSnaps.forEach(snap => snap.remove());
  existingSnaps = [];

  let count = Math.ceil(editorHeight / calculatedSpacing) + 2;

  for (let i = 0; i < count; i++) {
    let snap = document.createElement('div');
    snap.className = 'snap-line';

    snap.dataset.offsetIndex = i;

    snap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentlySelectedNoteType == 4) return;

      let msPerSnap = (60000 / bpm) / snapDivisor;
      let currentSnapIndex = Math.floor((game.gameState.currentTime + offsetMs) / msPerSnap);
      let targetSnapIndex = currentSnapIndex + parseInt(snap.dataset.offsetIndex);
      let exactTime = targetSnapIndex * msPerSnap;

      let laneIndex = getLaneFromX(e.clientX);

      placeNote(exactTime, laneIndex);
    });

    snap.addEventListener('mousedown', (e) => {
      if (currentlySelectedNoteType != 4) return;
      e.stopPropagation();
      

      let msPerSnap = (60000 / bpm) / snapDivisor;
      let currentSnapIndex = Math.floor((game.gameState.currentTime + offsetMs) / msPerSnap);
      let targetSnapIndex = currentSnapIndex + parseInt(snap.dataset.offsetIndex);
      let exactTime = targetSnapIndex * msPerSnap;

      let laneIndex = getLaneFromX(e.clientX);

      let slider = placeNote(exactTime, laneIndex);

      requestAnimationFrame(() => {
        let sliderIndex = game.gameState.sheet.indexOf(slider);
        startDraggingSlider(sliderIndex);
      })
    });

    snap.onmouseenter = () => {
      let msPerSnap = (60000 / bpm) / snapDivisor;
      let currentSnapIndex = Math.floor((game.gameState.currentTime + offsetMs) / msPerSnap);
      let targetSnapIndex = currentSnapIndex + parseInt(snap.dataset.offsetIndex);
      hoveredTime = targetSnapIndex * msPerSnap;
    };

    chartLines.appendChild(snap);
    existingSnaps.push(snap);
  }
}

function updateSnapPositions() {
  let currentTime = game.gameState.currentTime + offsetMs;
  let msPerBeat = 60000 / bpm;
  let msPerSnap = msPerBeat / snapDivisor;

  let currentSnapIndex = Math.floor(currentTime / msPerSnap);
  let snapFraction = (currentTime % msPerSnap) / msPerSnap;

  let count = existingSnaps.length;

  for (let i = 0; i < count; i++) {
    let snap = existingSnaps[i];

    let absoluteSnapIndex = currentSnapIndex + i;

    let isPrimary = absoluteSnapIndex % snapDivisor === 0;
    snap.classList.toggle('primary', isPrimary);

    let yPos = editorHeight - ((1 - snapFraction) * calculatedSpacing) - (i * calculatedSpacing);

    snap.style.transform = `translateY(${yPos}px)`;
    snap.style.display = yPos >= -2 && yPos <= editorHeight + 2 ? 'block' : 'none';
    snap.style.height = `${calculatedSpacing}px`;
  }
}


function createNoteElement(sheetEntryIndex) {
  let note = game.gameState.sheet[sheetEntryIndex];

  let noteRelevantLane = note.angle;
  if (noteRelevantLane == 6) noteRelevantLane = 0;
  noteRelevantLane = angleMap[noteRelevantLane];

  const noteElement = document.createElement('div');
  noteElement.classList.add('chart_editor_note');
  if (selectedNoteIndices.has(sheetEntryIndex)) {
    noteElement.classList.add('selected');
  }
  let noteType = 0;

  if (note.swipe) {
    noteType = 1;
  } else if (note.slider) {
    noteType = 2;
  } else if (note.holdable) {
    noteType = 3;
  } else if (note.golden) {
    noteType = 4;
  }

  let typeClassMaps = {
    1: 'chart_editor_swipeHeader',
    2: 'chart_editor_sliderNote',
    3: 'chart_editor_holdableHeader',
    4: 'chart_editor_goldenHeader',
  }
  if (noteType) noteElement.classList.add(typeClassMaps[noteType]);

  noteElement.onmousedown = (e) => {
    e.stopPropagation();

    if (!selectedNotes.has(note)) {
      selectNote(note, !e.shiftKey);
    } else if (e.shiftKey) {
      deselectNote(note);
    }

    if (!e.target.classList.contains('slider-drag-handle')) {
      saveState();
      startMovingNote(note);
    }
  };
  noteElement.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    deleteNote(note);
  };
  if (note.slider) {
    noteElement.classList.add('chart_editor_sliderNote', 'chart_editor_hold');
    const handle = document.createElement('div');
    handle.className = 'slider-drag-handle';

    handle.onmousedown = (e) => {
      e.stopPropagation();
      startDraggingSlider(sheetEntryIndex);
    };
    noteElement.appendChild(handle);
  }


  document.getElementById(`chart-lane-${noteRelevantLane}`).appendChild(noteElement);
  return noteElement;
}

let isDraggingSlider = false;
let draggedNoteIndex = null;

function startDraggingSlider(index) {
  isDraggingSlider = true;
  draggedNoteIndex = index;

  window.addEventListener('mousemove', handleSliderDrag);
  window.addEventListener('mouseup', stopDraggingSlider);
  document.body.style.cursor = 'ns-resize';
}

function handleSliderDrag(e) {
  if (!isDraggingSlider || draggedNoteIndex === null) return;

  let note = game.gameState.sheet[draggedNoteIndex];
  let chartContainer = document.getElementById('chart_lines').getBoundingClientRect();

  let mouseY = e.clientY - chartContainer.top;
  let clampedY = Math.max(1, Math.min(editorHeight, mouseY));

  let timeFromBottom = (editorHeight - clampedY) / pixelsPerMs;
  let absoluteTimeAtMouse = game.gameState.currentTime + timeFromBottom;

  let msPerSnap = (60000 / bpm) / snapDivisor;
  let snappedTime = Math.round(absoluteTimeAtMouse / msPerSnap) * msPerSnap;

  if (snappedTime <= note.time) {
    snappedTime = note.time + msPerSnap;
  }


  
  if ((snappedTime - Number(offsetMs)) - note.time < 0.1) {
    console.log('recalcing', note.time, Number(note.time) + ((60 / bpm) / beatSnapping))
    note.sliderEnd = Number(note.time) + (((60 / bpm) / beatSnapping) * 1000);
  } else {
    note.sliderEnd = snappedTime - Number(offsetMs);
  }
}

function stopDraggingSlider() {
  game.gameState.precacheStartAtValues();
  if (isDraggingSlider) saveState();
  draggedNoteIndex = null;
  window.removeEventListener('mousemove', handleSliderDrag);
  window.removeEventListener('mouseup', stopDraggingSlider);
  document.body.style.cursor = 'default';
}

function updateNotes() {
  let currentTime = game.gameState.currentTime;
  let chartEnd = currentTime + scrollDuration;

  for (let i = 0; i < game.gameState.sheet.length; i++) {
    let note = game.gameState.sheet[i];
    let noteEndTime = note.slider ? note.sliderEnd : note.time;

    let isVisible = noteEndTime >= currentTime && note.time <= chartEnd;

    if (isVisible) {
      if (!note.chartElement) {
        note.chartElement = createNoteElement(i);
      }

      let progress = getProgress(note.time, currentTime, chartEnd);

      const el = note.chartElement;
      const visualLane = angleMap[note.angle];
      const targetParent = document.getElementById(`chart-lane-${visualLane}`);

      if (el.parentElement !== targetParent) {
        targetParent.appendChild(el);
      }
      if (note.slider) {
        let noteDuration = note.sliderEnd - note.time;
        let holdHeight = (noteDuration / scrollDuration) * editorHeight;

        el.style.height = `${holdHeight}px`;
        el.classList.add('chart_editor_hold');

        let endProgress = getProgress(note.sliderEnd, currentTime, chartEnd);
        let yPosBottom = editorHeight - (endProgress * editorHeight);

        el.style.transform = `translate3d(0, ${yPosBottom}px, 0)`;
        el.style.transformOrigin = 'bottom';
      } else {
        let noteHeight = 50;
        let yPos = (1 - progress) * editorHeight - noteHeight;
        el.style.transform = `translate3d(0, ${yPos}px, 0)`;
      }

      note.chartElement.classList.toggle('selected', selectedNotes.has(note));
    } else {
      if (note.chartElement) {
        note.chartElement.remove();
        note.chartElement = null;
      }

      if (note.time > chartEnd) break;
    }
  }
}

function getLaneFromX(mouseX) {
  for (let i = 0; i < 6; i++) {
    const lane = document.getElementById(`chart-lane-${i}`);
    if (lane) {
      const rect = lane.getBoundingClientRect();
      if (mouseX >= rect.left && mouseX <= rect.right) {
        return i;
      }
    }
  }
  return 0; 
}

const reverseAngleMap = {
  4: 0,
  3: 1,
  2: 2,
  1: 3,
  0: 4,
  5: 5
};

function placeNote(time, laneIndex) {
  time = Number(time) - Number(offsetMs);
  if (currentlySelectedNoteType == 0) return;
  saveState();
  let insertIndex = game.gameState.sheet.findIndex(n => n.time > time);
  if (insertIndex === -1) insertIndex = game.gameState.sheet.length;

  let additionalOptions = {};
  if (typeof currentlySelectedNoteType !== 'undefined') {
    if (currentlySelectedNoteType == 2) additionalOptions = { golden: true };
    else if (currentlySelectedNoteType == 3) additionalOptions = { holdable: true };
    else if (currentlySelectedNoteType == 4) additionalOptions = { slider: true, sliderEnd: (Number(time) + (((60 / bpm) / beatSnapping) * 1000)) };
    else if (currentlySelectedNoteType == 5) additionalOptions = { swipe: true, swipeEnd: time + 100 };
    else if (currentlySelectedNoteType == 6) additionalOptions = { swipe: true, shortSwipe: true, direction: 1, swipeEnd: time + 100 };
    else if (currentlySelectedNoteType == 7) additionalOptions = { swipe: true, quarterSwipe: true, direction: 1, swipeEnd: time + 100 };
  }

  const angle = reverseAngleMap[laneIndex] ?? 0;

  const newNote = {
    time,
    angle: angle,
    ...additionalOptions
  };

  game.gameState.sheet.splice(insertIndex, 0, newNote);

  game.gameState.sheet.forEach((note, index) => note.index = index);

  game.gameState.precacheStartAtValues();
  clearSelection();

  return newNote;
}

let movedNoteIndex = null;

function startMovingNote(note) {
  if (!note || !note.chartElement) return;

  const rect = note.chartElement.getBoundingClientRect();
  const mouseX = window.event.clientX;
  const mouseY = window.event.clientY;

  // Ensure cursor is WITHIN the specific note bounds
  if (mouseX < rect.left || mouseX > rect.right || mouseY < rect.top || mouseY > rect.bottom) {
    return;
  }

  isMovingNote = true;
  movedNoteObject = note; // Anchor the specific object

  dragStartCoords = { x: mouseX, y: mouseY };
  dragStartTime = note.time;
  dragStartLane = getLaneFromX(mouseX);

  window.addEventListener('mousemove', handleBulkMove);
  window.addEventListener('mouseup', stopMovingNote);
  document.body.style.cursor = 'grabbing';
}

function handleNoteMove(e) {
  if (!isMovingNote || movedNoteIndex === null) return;

  let note = game.gameState.sheet[movedNoteIndex];
  let chartContainer = document.getElementById('chart_lines').getBoundingClientRect();

  // 1. Get Snapped Time at Mouse Position
  let mouseY = e.clientY - chartContainer.top;
  let clampedY = Math.max(0, Math.min(editorHeight, mouseY));
  let timeFromBottom = (editorHeight - clampedY) / pixelsPerMs;
  let absoluteTimeAtMouse = game.gameState.currentTime + timeFromBottom;

  let msPerSnap = (60000 / bpm) / snapDivisor;
  let snappedNewTime = Math.round(absoluteTimeAtMouse / msPerSnap) * msPerSnap;

  // 2. Calculate the difference (so we can move sliderEnd relatively)
  if (snappedNewTime !== note.time) {
    let timeDelta = snappedNewTime - note.time;

    // 3. Update note
    note.time = snappedNewTime;

    if (note.slider) {
      note.sliderEnd += timeDelta;
    }
  }
}

function stopMovingNote() {
  isMovingNote = false;
  movedNoteObject = null; // Clear object reference

  game.gameState.sheet.sort((a, b) => a.time - b.time);
  game.gameState.sheet.forEach((n, i) => n.index = i);

  window.removeEventListener('mousemove', handleBulkMove);
  window.removeEventListener('mouseup', stopMovingNote);
  document.body.style.cursor = 'default';
}

window.onmouseup = (e) => {
  if (isSelecting) {
    isSelecting = false;
    selectionBox.style.display = 'none';

    const dist = Math.hypot(selectionEnd.x - selectionStart.x, selectionEnd.y - selectionStart.y);
    if (dist < 5) {
      if (!e.shiftKey) clearSelection();
    }
  } else if (!isMovingNote && e.target.className.includes('snap-line')) {
    clearSelection();
  } else {
    return stopMovingNote();
  }

};
const horizontalFlipMap = {
  0: 3,
  1: 2,
  2: 1,
  3: 0,
  4: 5,
  5: 4
};

const chartContainer = document.getElementById('chart_lines');
let hasDragged = false;

chartContainer.onmousedown = (e) => {
  // If clicking a note, don't start box selection logic
  if (e.target !== chartContainer && !e.target.classList.contains('snap-line')) return;

  isSelecting = true;
  hasDragged = false; // Reset for new click
  selectionStart = { x: e.clientX, y: e.clientY };
  selectionEnd = { x: e.clientX, y: e.clientY };

  // Note: We DO NOT clear the set here anymore. 
  // We clear it only if we start a NEW drag or click away.
};

window.onmousemove = (e) => {
  if (isSelecting) {
    selectionEnd = { x: e.clientX, y: e.clientY };

    // Determine if the user actually moved the mouse enough to call it a "drag"
    const dist = Math.hypot(selectionEnd.x - selectionStart.x, selectionEnd.y - selectionStart.y);
    if (dist > 5) {
      if (!hasDragged && !e.shiftKey) {
        clearSelection(); // Only clear once at the start of a fresh drag
      }
      hasDragged = true;
      selectionBox.style.display = 'block';
      updateSelectionBox();
      checkIntersections();
    }
  } else if (isMovingNote) {
    handleBulkMove(e);
  }
};


function updateSelectionBox() {
  const left = Math.min(selectionStart.x, selectionEnd.x);
  const top = Math.min(selectionStart.y, selectionEnd.y);
  const width = Math.abs(selectionStart.x - selectionEnd.x);
  const height = Math.abs(selectionStart.y - selectionEnd.y);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}
function checkIntersections() {
  if (!isSelecting) return;
  const boxRect = selectionBox.getBoundingClientRect();

  if (!window.event?.shiftKey) clearSelection();

  game.gameState.sheet.forEach((note) => {
    if (note.chartElement) {
      const noteRect = note.chartElement.getBoundingClientRect();
      const isInside = !(
        noteRect.right < boxRect.left ||
        noteRect.left > boxRect.right ||
        noteRect.bottom < boxRect.top ||
        noteRect.top > boxRect.bottom
      );

      if (isInside) {
        selectNote(note, false); // Add to selection without clearing others
      }
    }
  });
}

function handleBulkMove(e) {
  if (!isMovingNote || !movedNoteObject) return;

  const msPerSnap = (60000 / bpm) / snapDivisor;
  const angleToLane = { 0: 4, 1: 3, 2: 2, 3: 1, 4: 0, 5: 5 };

  // 1. Calculate Deltas
  const pixelDeltaY = dragStartCoords.y - e.clientY;
  const snappedTimeDelta = Math.round((pixelDeltaY / pixelsPerMs) / msPerSnap) * msPerSnap;

  const currentLane = getLaneFromX(e.clientX);
  const laneDelta = currentLane - dragStartLane;

  if (snappedTimeDelta !== 0 || laneDelta !== 0) {
    selectedNotes.forEach(note => {
      note.time += snappedTimeDelta;
      if (note.slider) note.sliderEnd += snappedTimeDelta;

      let visualLane = angleToLane[note.angle];
      let newLane = Math.max(0, Math.min(5, visualLane + laneDelta));
      note.angle = reverseAngleMap[newLane];

      freeNote(note); freeSFX(note);
    });

    // Update anchors for the next frame
    dragStartCoords.y = e.clientY;
    dragStartLane = currentLane;
  }

}

function deleteNote(noteObject) {
  saveState();
  // 1. Find the index of this specific object in the sheet
  const index = game.gameState.sheet.indexOf(noteObject);

  if (index !== -1) {
    freeNote(noteObject);
    // 2. Remove the note from the data array
    game.gameState.sheet.splice(index, 0); // Wait, use .splice(index, 1) to remove

    // Correction:
    game.gameState.sheet.splice(index, 1);

    // 3. Remove from selection if it was selected
    deselectNote(noteObject);

    // 4. Clean up the DOM element
    if (noteObject.chartElement) {
      noteObject.chartElement.remove();
      noteObject.chartElement = null;
    }

    // 5. Re-sync indices if your game logic requires them
    game.gameState.sheet.forEach((n, i) => n.index = i);

    console.log("Note deleted");

    freeSFX();
  }
}

function flipSelectedNotesHorizontally() {
  if (selectedNotes.size === 0) return;
  
  saveState();
  
  selectedNotes.forEach(note => {
    note.angle = horizontalFlipMap[note.angle];
    if (note.shortSwipe || note.quarterSwipe) {
      if (note.direction == -1) { note.direction = 1 } else { note.direction = -1 }
    }
    freeNote(note); freeSFX(note);
  });
  
  updateNotes();
}

let isShiftActive = false;

window.addEventListener('keyup', (e) => {
  if (!e.shiftKey) isShiftActive = false;
})

window.addEventListener('keydown', (e) => {
  if (e.shiftKey) isShiftActive = true;
  if (document.activeElement.tagName.toLowerCase() == 'input') return;
  if ((e.key.toLowerCase() === 'delete' || e.key.toLowerCase() === 'backspace') && selectedNotes.size > 0) {
    saveState();
    game.gameState.sheet = game.gameState.sheet.filter(note => {
      if (selectedNotes.has(note)) {
        freeNote(note);
        if (note.chartElement) note.chartElement.remove();
        return false; // remove
      }
      return true; // keep
    });

    clearSelection();

    game.gameState.sheet.forEach((n, i) => n.index = i);
    updateNotes();
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'v') {
    saveState();
    navigator.clipboard.readText().then(text => {
      try {
        const cleanText = text.trim();
        const savedClipboard = JSON.parse(cleanText);

        if (!Array.isArray(savedClipboard)) {
          console.warn("Clipboard does not contain a note array.");
          return;
        }

        clearSelection();

        savedClipboard.forEach(clipNote => {
          let rel = clipNote.relativeTime || 0;
          let newTime = hoveredTime + rel - Number(offsetMs);

          let pastedNote = { ...clipNote };
          delete pastedNote.relativeTime;
          delete pastedNote.sliderDuration;
          delete pastedNote.chartElement;
          delete pastedNote.index;
          delete pastedNote.element;
          delete pastedNote.chartElement;
          delete pastedNote.traceParent;

          pastedNote.time = newTime;
          if (pastedNote.slider) {
            let duration = clipNote.sliderDuration || (clipNote.sliderEnd - clipNote.time) || 1000;
            pastedNote.sliderEnd = newTime + duration;
          }

          pastedNote.chartElement = null;

          let insertIndex = game.gameState.sheet.findIndex(n => n.time > pastedNote.time);
          if (insertIndex === -1) insertIndex = game.gameState.sheet.length;

          game.gameState.sheet.splice(insertIndex, 0, pastedNote);
          selectNote(pastedNote, false);
        });

        game.gameState.sheet.sort((a, b) => a.time - b.time);
        game.gameState.sheet.forEach((n, i) => n.index = i);

        console.log(`Successfully pasted ${savedClipboard.length} notes.`);

        requestAnimationFrame(() => {
          game.gameState.precacheStartAtValues();
        })
      } catch (err) {
        console.error("Paste failed. Real Error:", err.message);
        alert("Clipboard content is not valid JSON or the editor crashed during paste.");
      }
    }).catch(err => {
      console.error('Failed to read clipboard: ', err);
    });
    updateNotes();
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    if (selectedNotes.size === 0) return;

    let minTime = Math.min(...Array.from(selectedNotes).map(n => n.time));

    const clipboardData = Array.from(selectedNotes).map(note => {
      let clip = { ...note };
      clip.relativeTime = note.time - minTime;
      clip.sliderDuration = note.slider ? (note.sliderEnd - note.time) : 0;

      delete clip.chartElement;
      return clip;
    });

    const jsonString = JSON.stringify(clipboardData);
    navigator.clipboard.writeText(jsonString).then(() => {
      console.log(`Copied ${clipboardData.length} notes to system clipboard.`);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }

  if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault();
    redo();
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    flipSelectedNotesHorizontally();
  }
});


function saveState() {
  const snapshot = JSON.stringify(game.gameState.sheet);

  undoStack.push(snapshot);

  redoStack = [];

  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  updateNotes();
}

function undo() {
  if (undoStack.length === 0) return;

  redoStack.push(JSON.stringify(game.gameState.sheet));

  const lastState = undoStack.pop();
  applyState(lastState);
}

function redo() {
  if (redoStack.length === 0) return;

  undoStack.push(JSON.stringify(game.gameState.sheet));

  const nextState = redoStack.pop();
  applyState(nextState);
}

function applyState(jsonState) {
  game.gameState.sheet.forEach((note) => {
    freeNote(note);
    freeSFX(note);
  });

  game.gameState.sheet = JSON.parse(jsonState);

  game.gameState.sheet.forEach((note) => {
    freeNote(note);
    freeSFX(note);
  });


  clearSelection();

  console.log("State restored.");
}

function saveChartDetails() {
  let endNotes = game.gameState.sheet.map((serializedNote) => {
    let note = { ...serializedNote };

    try {
      delete note.playingEffects;
      delete note.playingEffect;
      delete note.playedHitSound;
      delete note.blockRelease;
      delete note.done;
      delete note.chartElement;
      delete note.midframe;
      delete note.endElement;
      delete note.startElement;
      delete note.element;
      delete note.scaleStart;
      delete note.scaleEnd;
      delete note.scaleDuration;
      delete note.index;
      delete note.height;
      delete note.wasEverHeld;
      delete note.isBeingHeld;
      delete note.traceParent;
      delete note.fadeInEnd;
      delete note.fadeInStart;
      delete note.points;
      delete note.tracePath;
      delete note.mysticalAddition;
      delete note.startAt;
      delete note._cachedStartAt;
      delete note.endAt;
    } catch (error) {}

    return note;
  });

  let chartSheet = game.gameState.sheet.sort((a, b) => {
    a - b;
  });

  fs.writeFileSync(`${process.cwd()}/Beatmaps/${information.location}/${information.difficulties[selectedDifficulty]}`, JSON.stringify(endNotes, null, 2));
  fs.writeFileSync(`${process.cwd()}/Beatmaps/${information.location}/information.json`, JSON.stringify(information, null, 2));
  updateNotes();
}


function changeOffsetMs(ms) {
  offsetMs = Number(ms);
  information.offsetMs = offsetMs;

  generateSnapLines();
}
