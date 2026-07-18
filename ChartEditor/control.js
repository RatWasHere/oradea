const game = new RhythmGame(RenderingSystem);


let segments = [];
for (let i = 0; i < 6; i++) {
  const container = document.getElementById('highlight_container');

  let layer = document.createElement('glow_layer');
  layer.style.setProperty('--i', i);
  container.appendChild(layer);
  segments.push(layer)
}


let previewTypeVectors = [
  "../Assets/Misc/duplicate.svg",
  "../Assets/Headers/geometrical/Note.svg",
  "../Assets/Headers/geometrical/Note Golden.svg",
  "../Assets/Headers/geometrical/Note Holdable.svg",
  "../Assets/Headers/geometrical/Frame.svg",
  "../Assets/Headers/Trace.svg",
  "../Assets/Headers/Trace Short.svg",
  "../Assets/Headers/Trace Curved 180deg.svg",
  "../Assets/Headers/Trace Bridge.svg"
]

function previewElementPlacement(element) {
  let elementToPreview = document.createElement('div');
  elementToPreview.classList.add('item');
  elementToPreview.style.backgroundImage = `url('${previewTypeVectors[currentlySelectedNoteType]}')`;
  elementToPreview.style.scale = 1;
  elementToPreview.style.transform = `scale(1)`;
  element.appendChild(elementToPreview);
}

function reviewElementPlacement(element) {
  element.lastChild.remove();
}

game.startGameLoop();

let baseline = 0;

let difficultyMap = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
  4: "Expert",
}

let selectedDifficulty = 4;

async function pickChart(menu, chart) {
  game.gameState.sheet.forEach(note => {
    try {
      freeNote(note)
    } catch (error) { }
  });
  freeSFX();
  let difficultyInit = fs.readFileSync(`${process.cwd()}/Beatmaps/${chart}/${charts.find(c => c.location == chart).information.difficulties[selectedDifficulty]}`);
  game.gameState.sheet = JSON.parse(difficultyInit);
  document.querySelectorAll('.item').forEach(item => item.remove());
  document.querySelectorAll('.chart_editor_note').forEach(item => item.remove());

  let difficulties = charts.find(c => c.location == chart).information.difficulties;
  try {
    selectMenuFactory.destroy('difficultyPicker');
  } catch (error) { }


  await game.gameState.precacheStartAtValues();
  await game.gameState.initializeAudio(chart);
  updateNotes();
  return difficultyInit;
}


function refreshSegments() {

}


function updateSpeed(newSpeed) {
  scrollSpeed = newSpeed;
  updateTravelTime();
  refreshSegments(game.gameState.currentTime);
}

function updateZoom(newZoom) {
  updateScrollDuration(2000 * newZoom);
  document.getElementById('zoomTextValue').innerHTML = (newZoom * 100) + '%';
}




function createRangeListener() {
  let element = document.getElementById('timeRange');
  game.gameState.stopUpdatingRange = true;
  document.onmouseup = () => {
    game.gameState.stopUpdatingRange = false;
    game.gameState.seekToTime(element.value);
    document.querySelectorAll('.chart_editor_note').forEach(e => e.remove())
    game.gameState.sheet.forEach(note => {
      freeNote(note)
    });
    freeSFX();
    updateNotes();
  }

}

document.addEventListener('keydown', (event) => {
  if (document.activeElement.tagName.toLowerCase() == 'input') return;
  if (event.key == ' ') {
    console.log(game.gameState.paused)
    if (game.gameState.paused) {
      game.gameState.unpauseAudio();
    } else {
      game.gameState.pauseAudio();
    }
  }
})


function updateTravelTime() {
  const msPerBeat = 60000 / bpm;
  const travelTimeMs = (msPerBeat * zoomFactor) / scrollSpeed;

  CONFIG.NOTE_PREVIEW_DELAY = travelTimeMs;
  CONFIG.SCALE_DURATION = (CONFIG.NOTE_PREVIEW_DELAY / 100) * 85
  CONFIG.HINT_START = CONFIG.NOTE_PREVIEW_DELAY / 2.5;
  this.beatDuration = (CONFIG.NOTE_PREVIEW_DELAY + CONFIG.HINT_START);
  CONFIG.SLIDER_OFFSET = ((CONFIG.NOTE_PREVIEW_DELAY / CONFIG.CONTAINER_RADIUS) * CONFIG.NOTE_RADIUS * 0.5);

  return travelTimeMs;
}

function freeEmptyLanes() {
  const elements = document.querySelectorAll('.lane:not(:has(*))');
  elements.forEach((e) => {
    e.remove();
  })
}

document.addEventListener('wheel', (event) => {
  if (surpressScrolling) return;
  let beatDuration = (60 / bpm);
  if (!event.ctrlKey) beatDuration = beatDuration / snapDivisor;
  let progress = beatDuration;
  if (event.deltaY > 0) {
    progress = -beatDuration;
  }


  let newTime = game.gameState.currentTime + (progress * 1000);
  if (newTime < 0) newTime = 0;

  game.gameState.sheet.forEach(note => {
    freeNote(note);
  })

  
  freeEmptyLanes();
  freeSFX();
  game.gameState.seekToTime(newTime)
});

function freeNote(note) {
  try {
    if (!note.element.parentElement.parentElement.className.includes('lane')) { console.log(note, note.element.parentElement.parentElement) }
    if (note.element?.parentElement?.parentElement) {
      note.element.parentElement.parentElement.remove();
    }
  } catch (error) { }

  try {
    if (note.traceParent) {
      note.traceParent.remove();
    }
  } catch (error) { }

  try {
    if (note.chartElement) {
      note.chartElement.remove();
    }
  } catch (error) { }

  note.element = null;
  note.isBeingHeld = false;
  note.wasEverHeld = false;
  note.done = false;
  note.chartElement = null;
}

function freeSFX() {
  game.gameState.effectItems.filter(i => (i.type === 'particles_constant' || i.type === 'header_constant') && i.inUse).forEach(element => {
    game.inputSystem.releaseEffect(element);
  })
}

let currentPlaybackSpeed = 1;

function setPlaybackSpeed(value) {
  const newRate = Number(value);
  currentPlaybackSpeed = newRate;

  const oldRate = game.gameState.audioSource?.playbackRate?.value ?? 1;
  const currentBufferPosition = (game.gameState.audioContext.currentTime - game.gameState.audioStartTime) * oldRate;

  game.gameState.audioSource.playbackRate.value = newRate;
  game.gameState.audioStartTime = game.gameState.audioContext.currentTime - (currentBufferPosition / newRate);

  document.getElementById('speedFactor').value = newRate;
  document.getElementById('speedTextValue').textContent = newRate.toFixed(1);

  console.log(`Speed changed to ${newRate}x`);
}

function changeBPM(newBpm) {
  bpm = newBpm;
  generateSnapLines();
  try {
    information.bpm = newBpm;
  } catch (error) { }
}

game.init();

(async () => {
  let crossDetails = JSON.parse(fs.readFileSync('./Core/crossdetails', 'utf8'));

  selectedDifficulty = crossDetails.difficulty;
  await pickChart(null, crossDetails.location);
  let bpm = information.bpm;
  beatSnapping = information.snapping || 1;
  changeBPM(bpm);
  document.getElementById('beatsPerMinute').value = bpm;
  snapDivisor = beatSnapping;
  generateSnapLines();
  document.getElementById('beatSnap').querySelector(`option[value="${beatSnapping}"]`).selected = true;
  changeOffsetMs(information.offsetMs || 0)
  selectMenuFactory.create({
    id: 'beatSnap',
    defaultValue: 4,
    onBeforeClose: (menu, value) => {
      snapDivisor = Number(value);
      generateSnapLines();
      information.snapping = value;
    },
  });
})();