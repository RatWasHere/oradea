const fs = require('fs');
const path = require('path');

const folderSelect = document.getElementById('folderSelect');
const difficultySelect = document.getElementById('difficultySelect');
const loadBtn = document.getElementById('loadBtn');
const saveBtn = document.getElementById('saveBtn');
const playBtn = document.getElementById('playBtn');
const status = document.getElementById('status');
const audio = document.getElementById('audio');

const timeline = document.getElementById('timeline');
const ctx = timeline.getContext('2d');
const notesList = document.getElementById('notesList');
const clearNotes = document.getElementById('clearNotes');

const BEATMAPS_DIR = path.join(process.cwd(), 'Beatmaps');
let currentFolder = null;
let currentDifficultyFile = null;
let mapData = null;
let notes = [];
let audioDuration = 60;
let playing = false;
let playInterval = null;
let bpm = 120;
let snapFraction = '1/4';
let noteType = 'tap';

function setStatus(t){ status.innerText = t }

function scanFolders(){
  folderSelect.innerHTML = '';
  try{
    const items = fs.readdirSync(BEATMAPS_DIR, { withFileTypes: true });
    const folders = items.filter(i => i.isDirectory()).map(i=>i.name).sort();
    folders.forEach(f => {
      const opt = document.createElement('option'); opt.value = f; opt.innerText = f; folderSelect.appendChild(opt);
    });
  }catch(e){ setStatus('No Beatmaps folder found') }
}

function populateDifficulties(folder){
  difficultySelect.innerHTML = '';
  const infoPath = path.join(BEATMAPS_DIR, folder, 'information.json');
  if (!fs.existsSync(infoPath)) return;
  try{
    const info = JSON.parse(fs.readFileSync(infoPath));
    for (let i in info.difficulties){
      const opt = document.createElement('option'); opt.value = info.difficulties[i]; opt.innerText = info.difficulties[i]; difficultySelect.appendChild(opt);
    }
    // try to read default bpm from information.json if available
    if (info.bpm) {
      bpm = Number(info.bpm) || bpm;
      document.getElementById('bpmInput').value = bpm;
    }
  }catch(e){ console.error(e) }
}

folderSelect.addEventListener('change', ()=>{
  populateDifficulties(folderSelect.value);
});

loadBtn.addEventListener('click', ()=>{
  currentFolder = folderSelect.value;
  const diffFile = difficultySelect.value;
  if (!currentFolder || !diffFile) { setStatus('Select a folder and difficulty'); return }
  const mapPath = path.join(BEATMAPS_DIR, currentFolder, diffFile);
  try{
    mapData = JSON.parse(fs.readFileSync(mapPath));
    currentDifficultyFile = mapPath;
    notes = mapData.notes || [];
    renderNotesList();
    loadAudioForFolder(currentFolder);
    drawTimeline();
    setStatus('Loaded ' + diffFile);
  }catch(e){ console.error(e); setStatus('Failed to load map') }
});

// UI element bindings
const bpmInput = document.getElementById('bpmInput');
const snapSelect = document.getElementById('snapSelect');
const noteTypeSelect = document.getElementById('noteTypeSelect');

bpmInput.addEventListener('change', ()=>{ bpm = Number(bpmInput.value) || bpm; drawTimeline(); });
snapSelect.addEventListener('change', ()=>{ snapFraction = snapSelect.value; });
noteTypeSelect.addEventListener('change', ()=>{ noteType = noteTypeSelect.value; });

function loadAudioForFolder(folder){
  const candidate = path.join(BEATMAPS_DIR, folder, 'audio.mp3');
  if (fs.existsSync(candidate)){
    audio.src = candidate;
    audio.load();
    audio.addEventListener('loadedmetadata', ()=>{
      audioDuration = audio.duration || 60;
      drawTimeline();
    }, { once: true });
  } else {
    audio.src = '';
    audioDuration = 60;
  }
}

saveBtn.addEventListener('click', ()=>{
  if (!currentDifficultyFile || !mapData) { setStatus('No map loaded'); return }
  mapData.notes = notes;
  try{
    fs.writeFileSync(currentDifficultyFile, JSON.stringify(mapData, null, 2));
    setStatus('Saved to ' + path.basename(currentDifficultyFile));
  }catch(e){ console.error(e); setStatus('Save failed') }
});

playBtn.addEventListener('click', ()=>{
  if (!audio.src) { setStatus('No audio'); return }
  if (!playing){ audio.play(); playing = true; playBtn.innerText = 'Pause'; setStatus('Playing'); }
  else { audio.pause(); playing = false; playBtn.innerText = 'Play'; setStatus('Paused'); }
});

function drawTimeline(){
  const w = timeline.width; const h = timeline.height;
  ctx.clearRect(0,0,w,h);
  // background
  ctx.fillStyle = '#070707'; ctx.fillRect(0,0,w,h);
  // time markers
  ctx.fillStyle = '#333';
  for (let i=0;i<=10;i++){
    const x = (i/10)*w; ctx.fillRect(x,0,1,h);
    ctx.fillStyle = '#666'; ctx.font='12px Arial'; ctx.fillText(Math.round((i/10)*audioDuration)+'s', x+4, 12);
    ctx.fillStyle = '#333';
  }
  // draw notes with different visuals by type
  notes.forEach((n, idx) => {
    const x = (n.time/audioDuration)*w;
    const lane = n.lane || 0;
    const y = 20 + lane*20;
    const type = n.type || 'tap';
    if (type === 'tap') {
      ctx.fillStyle = '#ff6'; ctx.fillRect(x-4,y,8,16);
    } else if (type === 'hold') {
      ctx.fillStyle = '#6cf';
      const len = (n.len || 1);
      const lenSec = n.lenInBeats ? (len * (60/bpm)) : len;
      const x2 = ((n.time + lenSec)/audioDuration)*w;
      ctx.fillRect(x, y+4, Math.max(6, x2-x), 8);
    } else if (type === 'slide') {
      ctx.fillStyle = '#f96'; ctx.beginPath(); ctx.arc(x, y+8, 6, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#000'; ctx.fillText(idx, x+6, y+12);
  });
}

timeline.addEventListener('click', (e)=>{
  if (!mapData) return;
  const rect = timeline.getBoundingClientRect();
  const x = e.clientX - rect.left;
  let t = (x / timeline.width) * audioDuration;
  // apply snapping (based on BPM and snapFraction)
  const beatDuration = 60 / bpm; // quarter-note duration
  const parts = snapFraction.split('/');
  let numer = Number(parts[0]) || 1; let denom = Number(parts[1]) || 4;
  // fraction is 1/denom of a whole note; whole note = 4 beats
  const snapSeconds = (4 * beatDuration) * (numer/denom);
  if (snapSeconds > 0) {
    t = Math.round(t / snapSeconds) * snapSeconds;
  }
  // default lane calculation: based on y coordinate
  const y = e.clientY - rect.top;
  const lane = Math.max(0, Math.floor((y-20)/20));
  const n = { time: Number(t.toFixed(3)), lane, type: noteType };
  if (noteType === 'hold') {
    // default length: 1 beat
    n.len = 1; n.lenInBeats = true;
  }
  notes.push(n);
  renderNotesList();
  drawTimeline();
});

function renderNotesList(){
  notesList.innerHTML = '';
  notes.forEach((n, i)=>{
    const li = document.createElement('li');
    const type = n.type || 'tap';
    const lenDisplay = (type==='hold') ? ` len:${n.len}${n.lenInBeats? ' (beats)':'s'}` : '';
    li.innerHTML = `<div><b>#${i}</b> t:${n.time}s lane:${n.lane||0} type:${type}${lenDisplay}</div>`;
    const editBtn = document.createElement('button'); editBtn.innerText = 'Edit';
    editBtn.addEventListener('click', ()=>{ editNoteDialog(i); });
    const rm = document.createElement('button'); rm.innerText = 'Remove'; rm.addEventListener('click', ()=>{ notes.splice(i,1); renderNotesList(); drawTimeline(); });
    li.appendChild(editBtn);
    li.appendChild(rm);
    notesList.appendChild(li);
  });
}

function editNoteDialog(index){
  const n = notes[index];
  const newType = prompt('Type (tap, hold, slide):', n.type||'tap');
  if (!newType) return;
  n.type = newType;
  if (newType === 'hold'){
    const len = prompt('Length in beats (e.g. 1) or seconds (append s):', n.lenInBeats? String(n.len): (n.len+'s'));
    if (!len) return;
    if (len.endsWith && len.endsWith('s')){
      n.len = Number(len.slice(0,-1)) || 1; n.lenInBeats = false;
    } else {
      n.len = Number(len) || 1; n.lenInBeats = true;
    }
  }
  renderNotesList(); drawTimeline();
}

clearNotes.addEventListener('click', ()=>{ notes = []; renderNotesList(); drawTimeline(); });

// initial
scanFolders();
if (folderSelect.options.length>0){ folderSelect.selectedIndex = 0; populateDifficulties(folderSelect.value); }
setStatus('Ready');

// Expose for debugging in console
window._chartEditor = { scanFolders, drawTimeline };
