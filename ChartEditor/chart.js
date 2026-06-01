let editorHeight = 636;
let chartLines = document.getElementById('chart_lines');
let existingSnaps = [];
let scrollDuration = 2000;
let pixelsPerMs = editorHeight / scrollDuration;
let selectedNoteIndices = new Set(); // Stores indices of selected notes
let selectedNotes = new Set(); // Now stores the note objects, not indices
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
let movedNoteObject = null; // Store the object, not the index
function getProgress(value, min, max) {
  return Math.max(0, (value - min) / (max - min));
}
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50; // Limit memory usage

// ===== Note Selection Functions =====
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
// ===== End Note Selection Functions =====

let angleMap = {
  "0": 4,
  "1": 3,
  "2": 2,
  "3": 1,
  "4": 0,
  "5": 5
}


// Rhythm Variables
let bpm = 120;
let snapDivisor = 1; // 1 = 1/1 (beats), 4 = 1/4 (sixteenths), etc.
let calculatedSpacing = 0; // We will store the pixel distance here
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

    // Store the offset index on the element
    snap.dataset.offsetIndex = i;

    // Add the click event
    snap.addEventListener('click', (e) => {
      e.stopPropagation();

      let msPerSnap = (60000 / bpm) / snapDivisor;
      let currentSnapIndex = Math.floor(game.gameState.currentTime / msPerSnap);
      let targetSnapIndex = currentSnapIndex + parseInt(snap.dataset.offsetIndex);
      let exactTime = targetSnapIndex * msPerSnap;

      // Calculate lane based on X position
      let laneIndex = getLaneFromX(e.clientX);

      placeNote(exactTime, laneIndex);
    });

    snap.onmouseenter = () => {
      let msPerSnap = (60000 / bpm) / snapDivisor;
      let currentSnapIndex = Math.floor(game.gameState.currentTime / msPerSnap);
      let targetSnapIndex = currentSnapIndex + parseInt(snap.dataset.offsetIndex);
      hoveredTime = targetSnapIndex * msPerSnap;
    };

    chartLines.appendChild(snap);
    existingSnaps.push(snap);
  }
}

function updateSnapPositions() {
  let currentTime = game.gameState.currentTime;
  let msPerBeat = 60000 / bpm;
  let msPerSnap = msPerBeat / snapDivisor;

  // Which snap interval are we currently inside?
  let currentSnapIndex = Math.floor(currentTime / msPerSnap);
  // How far into the current snap interval (0..1)
  let snapFraction = (currentTime % msPerSnap) / msPerSnap;

  let count = existingSnaps.length;

  for (let i = 0; i < count; i++) {
    let snap = existingSnaps[i];

    // This line represents beat at currentSnapIndex + i
    let absoluteSnapIndex = currentSnapIndex + i;

    // Is this a primary (beat) line?
    let isPrimary = absoluteSnapIndex % snapDivisor === 0;
    snap.classList.toggle('primary', isPrimary);

    // Position: line i=0 is snapFraction ahead of the bottom,
    // each subsequent line is one calculatedSpacing higher
    // snapFraction=0 → line is exactly at bottom; snapFraction=1 → line is one spacing above bottom
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

  // Inside createNoteElement
  noteElement.onmousedown = (e) => {
    e.stopPropagation();

    // Selection logic: use the note object
    if (!selectedNotes.has(note)) {
      selectNote(note, !e.shiftKey);
    }

    if (!e.target.classList.contains('slider-drag-handle')) {
      saveState();
      startMovingNote(note); // Pass 'note' instead of 'sheetEntryIndex'
    }
  };
  noteElement.oncontextmenu = (e) => {
    e.preventDefault(); // Stop the browser menu from appearing
    e.stopPropagation(); // Stop the click from placing a new note or selecting

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

  // Add global listeners so dragging works even if the mouse leaves the handle
  window.addEventListener('mousemove', handleSliderDrag);
  window.addEventListener('mouseup', stopDraggingSlider);
  document.body.style.cursor = 'ns-resize';
}

function handleSliderDrag(e) {
  if (!isDraggingSlider || draggedNoteIndex === null) return;

  let note = game.gameState.sheet[draggedNoteIndex];
  let chartContainer = document.getElementById('chart_lines').getBoundingClientRect();

  // 1. Calculate Y relative to chart bottom
  let mouseY = e.clientY - chartContainer.top;
  let clampedY = Math.max(0, Math.min(editorHeight, mouseY));

  // 2. Convert Y to Time
  // Use your pixelsPerMs ratio: (editorHeight - y) / pixelsPerMs = relative time
  let timeFromBottom = (editorHeight - clampedY) / pixelsPerMs;
  let absoluteTimeAtMouse = game.gameState.currentTime + timeFromBottom;

  // 3. Snapping logic
  let msPerSnap = (60000 / bpm) / snapDivisor;
  let snappedTime = Math.round(absoluteTimeAtMouse / msPerSnap) * msPerSnap;

  // 4. Constraints: Cannot be shorter than 1 snap interval
  // Assuming sliderEnd is the "top" of the note in your visualizer
  if (snappedTime <= note.time) {
    snappedTime = note.time + msPerSnap;
  }

  note.sliderEnd = snappedTime;
}

function stopDraggingSlider() {
  if (isDraggingSlider) saveState(); // Add this  isDraggingSlider = false;
  draggedNoteIndex = null;
  window.removeEventListener('mousemove', handleSliderDrag);
  window.removeEventListener('mouseup', stopDraggingSlider);
  document.body.style.cursor = 'default';
}

function updateNotes() {
  let currentTime = game.gameState.currentTime;
  let chartEnd = currentTime + scrollDuration;

  // OPTIMIZATION: If sheet is sorted, we can use a more efficient loop
  for (let i = 0; i < game.gameState.sheet.length; i++) {
    let note = game.gameState.sheet[i];
    let noteEndTime = note.slider ? note.sliderEnd : note.time;

    // Check visibility
    let isVisible = noteEndTime >= currentTime && note.time <= chartEnd;

    if (isVisible) {
      // FIX: Ensure element exists before we try to style it
      if (!note.chartElement) {
        note.chartElement = createNoteElement(i);
      }

      let progress = getProgress(note.time, currentTime, chartEnd);

      // Use cached element reference to avoid repeated lookups
      const el = note.chartElement;
      const visualLane = angleMap[note.angle];
      const targetParent = document.getElementById(`chart-lane-${visualLane}`);

      // Move the element to the correct lane div if it's in the wrong one
      if (el.parentElement !== targetParent) {
        targetParent.appendChild(el);
      }
      if (note.slider) {
        let noteDuration = note.sliderEnd - note.time;
        let holdHeight = (noteDuration / scrollDuration) * editorHeight;

        // Update Height and Slider class
        el.style.height = `${holdHeight}px`;
        el.classList.add('chart_editor_hold');

        let endProgress = getProgress(note.sliderEnd, currentTime, chartEnd);
        let yPosBottom = editorHeight - (endProgress * editorHeight);

        // Use translate3d for GPU acceleration (performance boost)
        el.style.transform = `translate3d(0, ${yPosBottom}px, 0)`;
        el.style.transformOrigin = 'bottom';
      } else {
        let noteHeight = 50;
        let yPos = (1 - progress) * editorHeight - noteHeight;
        el.style.transform = `translate3d(0, ${yPos}px, 0)`;
      }

      note.chartElement.classList.toggle('selected', selectedNotes.has(note));
    } else {
      // Clean up notes that moved off screen
      if (note.chartElement) {
        note.chartElement.remove();
        note.chartElement = null;
      }

      // OPTIMIZATION: If the sheet is sorted by time and this note 
      // is already past the chartEnd, we can stop the loop early.
      if (note.time > chartEnd) break;
    }
  }
}

function getLaneFromX(mouseX) {
  // We check all 6 lanes to see which one contains the mouse X coordinate
  for (let i = 0; i < 6; i++) {
    const lane = document.getElementById(`chart-lane-${i}`);
    if (lane) {
      const rect = lane.getBoundingClientRect();
      if (mouseX >= rect.left && mouseX <= rect.right) {
        return i;
      }
    }
  }
  return 0; // Fallback to lane 0
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
  if (currentlySelectedNoteType == 0) return;
  saveState();
  // Keep the sheet sorted by time for performance optimizations
  let insertIndex = game.gameState.sheet.findIndex(n => n.time > time);
  if (insertIndex === -1) insertIndex = game.gameState.sheet.length;

  let additionalOptions = {};
  if (typeof currentlySelectedNoteType !== 'undefined') {
    if (currentlySelectedNoteType == 2) additionalOptions = { golden: true };
    else if (currentlySelectedNoteType == 3) additionalOptions = { holdable: true };
    else if (currentlySelectedNoteType == 4) additionalOptions = { slider: true, sliderEnd: time + 1000 };
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

  // Re-sync internal indices
  game.gameState.sheet.forEach((note, index) => note.index = index);

  // Clear selection after placing a new note
  clearSelection();
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

window.addEventListener('keydown', (e) => {
  // If 'Delete' or 'Backspace' is pressed and notes are selected
  if ((e.key.toLowerCase() === 'Delete' || e.key.toLowerCase() === 'Backspace') && selectedNotes.size > 0) {

    // We filter the sheet to remove all objects present in the selectedNotes Set
    game.gameState.sheet = game.gameState.sheet.filter(note => {
      if (selectedNotes.has(note)) {
        freeNote(note);
        if (note.chartElement) note.chartElement.remove();
        return false; // Remove from array
      }
      return true; // Keep in array
    });

    // Clear the selection set
    clearSelection();

    // Re-sync indices
    game.gameState.sheet.forEach((n, i) => n.index = i);
  }
  // PASTE: Ctrl + V
  if (e.ctrlKey && e.key.toLowerCase() === 'v') {
    saveState();
    navigator.clipboard.readText().then(text => {
      try {
        // 1. Clean the text (remove accidental spaces or newlines)
        const cleanText = text.trim();
        const savedClipboard = JSON.parse(cleanText);

        if (!Array.isArray(savedClipboard)) {
          console.warn("Clipboard does not contain a note array.");
          return;
        }

        clearSelection();

        savedClipboard.forEach(clipNote => {
          // Use || 0 as a fallback for relativeTime
          let rel = clipNote.relativeTime || 0;
          let newTime = hoveredTime + rel;

          let pastedNote = { ...clipNote };
          // Clean up properties we don't want to duplicate directly
          delete pastedNote.relativeTime;
          delete pastedNote.sliderDuration;
          delete pastedNote.chartElement;
          delete pastedNote.index;
          delete pastedNote.element;
          delete pastedNote.chartElement;
          delete pastedNote.traceParent;

          pastedNote.time = newTime;
          if (pastedNote.slider) {
            // Re-calculate sliderEnd based on the duration it had when copied
            let duration = clipNote.sliderDuration || (clipNote.sliderEnd - clipNote.time) || 1000;
            pastedNote.sliderEnd = newTime + duration;
          }

          pastedNote.chartElement = null;

          // Find insertion point
          let insertIndex = game.gameState.sheet.findIndex(n => n.time > pastedNote.time);
          if (insertIndex === -1) insertIndex = game.gameState.sheet.length;

          game.gameState.sheet.splice(insertIndex, 0, pastedNote);
          selectNote(pastedNote, false); // Add to selection without clearing others
        });

        // Re-sort and re-index the sheet
        game.gameState.sheet.sort((a, b) => a.time - b.time);
        game.gameState.sheet.forEach((n, i) => n.index = i);

        console.log(`Successfully pasted ${savedClipboard.length} notes.`);
      } catch (err) {
        // This will now tell you exactly what went wrong
        console.error("Paste failed. Real Error:", err.message);
        alert("Clipboard content is not valid JSON or the editor crashed during paste.");
      }
    }).catch(err => {
      console.error('Failed to read clipboard: ', err);
    });
    updateNotes();
  }

  // COPY: Ctrl + C
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    if (selectedNotes.size === 0) return;

    // 1. Find the anchor (earliest time)
    let minTime = Math.min(...Array.from(selectedNotes).map(n => n.time));

    // 2. Map notes to a clean data format
    const clipboardData = Array.from(selectedNotes).map(note => {
      let clip = { ...note };
      clip.relativeTime = note.time - minTime;
      clip.sliderDuration = note.slider ? (note.sliderEnd - note.time) : 0;

      // Remove circular references
      delete clip.chartElement;
      return clip;
    });

    // 3. Write to the SYSTEM clipboard
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

  // REDO: Ctrl + Y or Ctrl + Shift + Z
  if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault();
    redo();
  }
});


function saveState() {
  // 1. Convert current sheet to a string for a clean snapshot
  const snapshot = JSON.stringify(game.gameState.sheet);

  // 2. Add to undo stack
  undoStack.push(snapshot);

  // 3. Clear redo stack whenever a new action is taken
  redoStack = [];

  // 4. Keep stack size manageable
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  updateNotes();
}

function undo() {
  if (undoStack.length === 0) return;

  // Save current state to redo stack before moving back
  redoStack.push(JSON.stringify(game.gameState.sheet));

  // Restore the last snapshot
  const lastState = undoStack.pop();
  applyState(lastState);
}

function redo() {
  if (redoStack.length === 0) return;

  // Save current state to undo stack before moving forward
  undoStack.push(JSON.stringify(game.gameState.sheet));

  const nextState = redoStack.pop();
  applyState(nextState);
}

function applyState(jsonState) {
  // 1. Clear current visual elements to prevent ghosting
  game.gameState.sheet.forEach((note) => {
    freeNote(note);
    freeSFX(note);
  });

  // 2. Parse and assign the new data
  game.gameState.sheet = JSON.parse(jsonState);

  game.gameState.sheet.forEach((note) => {
    freeNote(note);
    freeSFX(note);
  });


  // 3. Clear selection to prevent reference errors to old objects
  clearSelection();

  console.log("State restored.");
}

function saveChartDetails() {
  game.gameState.sheet.forEach((note) => {
    freeNote(note);
    freeSFX(note);
  });

  let chartSheet = game.gameState.sheet;

  fs.writeFileSync(`${process.cwd()}/Beatmaps/${information.location}/${information.difficulties[selectedDifficulty]}`, JSON.stringify(chartSheet));
  console.log("Chart details saved.");

  updateNotes();
}

