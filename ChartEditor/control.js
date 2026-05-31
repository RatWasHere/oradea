const game = new RhythmGame(RenderingSystem);
selectMenuFactory.create({
  id: 'beatSnap',
  defaultValue: 4,
  onBeforeClose: (menu, value) => {
    snapDivisor = Number(value);
    generateSnapLines();
  },
});

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

function pickChart(menu, chart) {
  game.gameState.sheet.forEach(note => {
    try {
      freeNote(note)
    } catch (error) { }
  });
  freeSFX();
  let difficultyInit = fs.readFileSync(`${process.cwd()}/Beatmaps/${chart}/${charts.find(c => c.location == chart).information.difficulties[4]}`);
  game.gameState.sheet = JSON.parse(difficultyInit);
  document.querySelectorAll('.item').forEach(item => item.remove());
  document.querySelectorAll('.chart_editor_note').forEach(item => item.remove());

  let difficulties = charts.find(c => c.location == chart).information.difficulties;
  try {
    selectMenuFactory.destroy('difficultyPicker');
  } catch (error) { }


  game.gameState.precacheStartAtValues();
  game.gameState.initializeAudio(chart);
  updateNotes();
}


function refreshSegments() {

}


function updateSpeed(newSpeed) {
  scrollSpeed = newSpeed;
  updateTravelTime();
  refreshSegments(game.gameState.currentTime);
}

function updateZoom(newZoom) {
  zoomFactor = newZoom;
  updateTravelTime();
  createBeatSnaps(snaps);
  refreshSegments(game.gameState.currentTime);
  document.getElementById('zoomTextValue').innerHTML = ((20 - newZoom) * 5) + '%';
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


document.addEventListener('wheel', (event) => {
  if (surpressScrolling) return;
  let beatDuration = (60 / bpm);
  let progress = beatDuration;
  if (event.deltaY > 0) {
    progress = -beatDuration;
  }


  let newTime = game.gameState.currentTime + (progress * 1000);
  if (newTime < 0) newTime = 0;

  game.gameState.sheet.forEach(note => {
    freeNote(note);
  })

  document.querySelectorAll('.chart_editor_note').forEach(e => e.remove())

  freeSFX();
  game.gameState.seekToTime(newTime)


});

function freeNote(note) {
  try {
    if (note.element && note.element?.parentElement?.parentElement) {
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

function setPlaybackSpeed(value) {
  const newRate = Number(value);
  const oldRate = game.gameState.audioSource?.playbackRate?.value ?? 1;

  // Get current position in buffer before rate change
  const currentBufferPosition = (game.gameState.audioContext.currentTime - game.gameState.audioStartTime) * oldRate;

  // Change the playback rate
  game.gameState.audioSource.playbackRate.value = newRate;

  // Adjust audioStartTime to prevent position jump
  game.gameState.audioStartTime = game.gameState.audioContext.currentTime - (currentBufferPosition / newRate);

  console.log(`Speed changed to ${newRate}x`);
}

function changeBPM(newBpm) {
  bpm = newBpm;
  generateSnapLines();
}

game.init();

changeBPM(94);
pickChart(null, 'Purify');
