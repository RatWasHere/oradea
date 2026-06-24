const { mkdirSync } = require('original-fs');

const CONFIG = {
  // ===== ANGLES =====
  ANGLE_OFFSET: 90,
  ANGLE_MODIFIER: 60,

  NOTE_ARC_ANGLE: 60,

  // ===== VISUAL MODIFIERS =====

  PREVIEW_COUNT: 6,
  SNAP_INTERVAL: 60, // 360/6 = 6 (segments)
  SNAP_EXTENSION: 21, // we probably arent going to need this 

  NOTE_RADIUS: 110,

  SCALE_DURATION: 300,

  NOTE_PREVIEW_DELAY: 400,
  CREATE_AT_DISTANCE_OF: 0,

  // ===== CONTAINERS =====
  CONTAINER_RADIUS: 220,
  // CONTAINER_REAL_RADIUS: 400,
  CONTAINER_REAL_RADIUS: 470, // WAS 630
  RAW_RADIUS: 470, // WAS 630
  ADJUSTED_MAX_TRAVEL: 200,
  START_OFFSET: 0,
  CREATION_ANTIDELAY: 1600,

  // TIMING & INPUT
  GAMEPAD_DEADZONE: 0.2,

  AUDIO_OFFSET: 0,
  AUDIO_START_DELAY: 10, // ms delay before audio starts 

  FLICK_THRESHOLD: 13,
  FLICK_OFFSET: 20,
  SWIPE_OUTWARDS_PROGRESS_THRESHOLD: 0.60,
  SWIPE_INWARDS_THRESHOLD: 0.7,
  PERMISSIVE_SWIPE_TRESHOLD: 0.2,
  INITIAL_DELAY: 1000,
  HINT_VISIBILITY: 0.5,
  SWIPE_PRECHECK: 100,
  PERMISSIVE_SWIPE_PRECHECK: 230,
  PERMISSIVE_SWIPE_TIMEFRAME: 370,
  HALF_SWIPE_MIN_MOVEMENT: 70, // these are degrees stop looking like this as if you dont know what they are. DEGREES. FUCK FARENHEIT BTW.
  // SCORING
  ACCEPTANCE_THRESHOLD: 300,
  FLICK_ACCEPTANCE_THRESHOLD: 400,
  SLIDER_RELEASE_THRESHOLD: 250,
  ACCURACY_RANGES: {
    'perfect': [0, 52.8],
    'great': [52.8, 90.8],
    'ok': [90.8, 169],
    'bad': [169, 242.0],
  },
  ACCURACY_SCORES: {
    'perfect': 200,
    'great': 170,
    'ok': 40,
    'bad': 20,
  },

  SHORT_ANIMATION: 100, // ms
  LONG_ANIMATION: 300,
  LONGER_ANIMATION: 500,

  SCORING_INDICATORS: false,

  DIFFICULTY_MAP: {
    1: "Easy",
    2: "Medium",
    3: "Hard",
    4: "Expert",
  },

  AUTOPLAY: false,
  BUTTONS: false,
  TOUCHSCREEN: false,

  FLASHING_LIGHTS: 1,
  GIMMICKS: 1,
  VFX_CACHE_MULTIPLIER: 1,
  VFX_DURATION: 1,
  SLIDER_OFFSET: 0
};


class GameState {
  constructor() {
    (async () => {
      this.ready = new Promise((res) => { this._readyResolve = res });

      if (!isAndroid) {
        this.crossDetails = JSON.parse(fs.readFileSync('./Core/crossdetails', 'utf8'));
        this.sheet = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/${this.crossDetails.map}`, 'utf8'));
        this.information = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/information.json`, 'utf8'));
        try {
          this.timeSheet = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/time_${this.crossDetails.map}`, 'utf8'));
        } catch (error) { }
        try {
          this.lightMap = JSON.parse(fs.readFileSync(`./Beatmaps/${this.crossDetails.location}/light_${this.crossDetails.map}`, 'utf8'));
        } catch (error) { };
      } else {
        const SERVER_URL = 'http://192.168.100.11:5500';
        try {
          const crossResponse = await fetch(`${SERVER_URL}/Core/crossdetails`);
          this.crossDetails = await crossResponse.json();

          const sheetResponse = await fetch(`${SERVER_URL}/Beatmaps/${this.crossDetails.location}/${this.crossDetails.map}`);
          this.sheet = await sheetResponse.json();

          const infoResponse = await fetch(`${SERVER_URL}/Beatmaps/${this.crossDetails.location}/information.json`);
          this.information = await infoResponse.json();

          try {
            const timeResponse = await fetch(`${SERVER_URL}/Beatmaps/${this.crossDetails.location}/time_${this.crossDetails.map}`);
            this.timeSheet = await timeResponse.json();
          } catch (error) { }

          try {
            const lightResponse = await fetch(`${SERVER_URL}/Beatmaps/${this.crossDetails.location}/light_${this.crossDetails.map}`);
            this.lightMap = await lightResponse.json();
          } catch (error) { }
        } catch (error) {
          console.error('Failed to fetch game data from server:', error);
        }
      }

      this.bpm = this.information.bpm;

      document.getElementById('songArt').style.backgroundImage = `url('../Beatmaps/${this.crossDetails.location}/${this.information.cover}')`;
      document.body.style.backgroundImage = `url('../Beatmaps/${this.crossDetails.location}/${this.information.cover}')`;
      document.getElementById('songName').innerHTML = this.information.name;
      document.getElementById('songArtist').innerHTML = this.information.artist;
      document.getElementById('difficulty').innerHTML = `${CONFIG.DIFFICULTY_MAP[this.crossDetails.difficulty]} - ${this.information.ratings[this.crossDetails.difficulty]}`;
      document.getElementById('difficultyTag').classList.add(CONFIG.DIFFICULTY_MAP[this.crossDetails.difficulty].toLowerCase());
      this.combo = 0;
      this.maxCombo = 0;
      this.score = 0;
      this.noteIndex = 2147483647;

      CONFIG.AUDIO_OFFSET = getSetting('audio_offset', 0);
      CONFIG.HINT_VISIBILITY = getSetting('note_hint', 0);
      CONFIG.FLASHING_LIGHTS = getSetting('flashing_lights', 1);
      CONFIG.GIMMICKS = getSetting('gimmicks', 1);
      CONFIG.VFX_CACHE_MULTIPLIER = getSetting('vfx_cache', 2);
      CONFIG.INPUT_MODE = getSetting('input_mode', 'buttons');
      CONFIG.VFX_DURATION = getSetting('vfx_duration', 600);
      let noteSpeed = getSetting('note_speed', 6) * 40;
      CONFIG.SCORING_INDICATORS = Number(getSetting('perfection_indicator', 1));

      if (getSetting('bgdust', 1) != 1) {
        document.getElementsByClassName('dust')[0].remove()
      }
      // 185% is a beat
      let bpm = this.information.bpm || 100;
      let beatDuration = (60 / bpm) * noteSpeed;
      let fullDuration = (beatDuration / 100)
      CONFIG.NOTE_PREVIEW_DELAY = (5 / getSetting('note_speed', 6)) * 1000;
      CONFIG.SCALE_DURATION = (CONFIG.NOTE_PREVIEW_DELAY / 100) * 85;
      if (!CONFIG.SCORING_INDICATORS) {
        document.getElementById('perfectionIndicator').remove();
      }
      CONFIG.HINT_START = CONFIG.NOTE_PREVIEW_DELAY / 2.5;
      this.beatDuration = (CONFIG.NOTE_PREVIEW_DELAY + CONFIG.HINT_START);
      if (CONFIG.INPUT_MODE == "buttons") {
        CONFIG.BUTTONS = true;
      } else if (CONFIG.INPUT_MODE == "touch" || isAndroid) {
        CONFIG.TOUCHSCREEN = true;
      }
      document.styleSheets[1].insertRule(`:root { --vfx-duration: ${CONFIG.VFX_DURATION}ms;
        --secondary-vfx-duration: ${CONFIG.VFX_DURATION - 100}ms;
        --tertiary-vfx-duration: ${Math.floor(CONFIG.VFX_DURATION / 3)}ms;
        --quaternary-vfx-duration: ${Math.floor(CONFIG.VFX_DURATION / 4)}ms; }`);

      CONFIG.SLIDER_OFFSET = ((CONFIG.NOTE_PREVIEW_DELAY / CONFIG.CONTAINER_RADIUS) * CONFIG.NOTE_RADIUS * 0.5);
      let noteDesign = getSetting('noteDesign', 'geometrical');
      let holdNoteDesign = getSetting('holdNoteDesign', 'geometrical');
      let noteDesigns = {
        note: "Note",
        holdNote: "Note Holdable",
        goldenNote: "Note Golden",
        starterNote: "Starter",
      }
      let holdNoteDesigns = {
        sliderTop: "Top",
        sliderFrame: "Frame",
        sliderBottom: "Bottom",

        sliderTopGolden: "Top Golden",
        sliderFrameGolden: "Frame Golden",
        sliderBottomGolden: "Bottom Golden",

        sliderTopHoldable: "Top Holdable",
        sliderBottomHoldable: "Bottom Holdable",
      }
      for (let design in noteDesigns) {
        document.styleSheets[0].insertRule(`:root { --${design}: url('../Assets/Headers/${noteDesign}/${noteDesigns[design]}.svg') }`);
      }
      for (let design in holdNoteDesigns) {
        document.styleSheets[0].insertRule(`:root { --${design}: url('../Assets/Headers/${holdNoteDesign}/${holdNoteDesigns[design]}.svg') }`);
      }

      this.precacheStartAtValues();

      let lastNote = this.sheet[this.sheet.length - 1];
      let determinedTime = lastNote.time;
      if (lastNote.slider) {
        determinedTime = lastNote.sliderEnd;
      }
      this.endsAt = determinedTime + CONFIG.ACCEPTANCE_THRESHOLD;

      this.keysPressed = {};

      this.rotations = [0, 0];
      this.rawRotations = [0, 0];
      this.centerDistance = [0, 0];
      this.sectors = [1, 1];
      this.snapToInterval = true;

      this.displayedNotes = [];

      this.scoringPad = {
        perfect: [],
        great: [],
        ok: [],
        bad: [],
        miss: []
      }


      this.gamepad = null;

      this.lastFrameTime = 0;

      this.audioContext = new window.AudioContext();
      this.audioBuffer = null;
      this.audioSource = null;
      this.audioStartTime = 0; // audioContext.currentTime when playback started (s)
      this.audioPauseOffset = 0; // ms

      await this.initializeDOM();
      this._readyResolve();
    })()
  }
  pauseAudio() {
    if (this.audioSource) {
      this.audioSource.stop();
    }
  }

  precacheStartAtValues() {
    for (let i = 0; i < this.sheet.length; i++) {
      const note = this.sheet[i];
      if (typeof note.startAt == 'string') {
        note.startAt = eval(note.startAt.replaceAll(`#0`, CONFIG.NOTE_PREVIEW_DELAY));
        note._cachedStartAt = note.startAt;
      } else if (typeof note.startAt == 'object') {
        note._cachedStartAt = this.timingSystem ?
          this.timingSystem.fromSpecial(note.startAt) :
          note.time;
      }

      if (typeof note.rawStartAt == 'string') {
        note.startAt = eval(note.rawStartAt.replaceAll(`#0`, CONFIG.NOTE_PREVIEW_DELAY));
        note._cachedStartAt = note.startAt;
      }

      if (typeof note.rawEndAt == 'string') {
        note.endAt = eval(note.rawEndAt.replaceAll(`#0`, CONFIG.NOTE_PREVIEW_DELAY));
      }

      if (note.timeSheet) {
        let totalPreviewDuration = CONFIG.NOTE_PREVIEW_DELAY + CONFIG.SCALE_DURATION;
        let relevant = {
          rawTime: "time",
          rawOffset: "offset",
          rawTransition: "transition"
        };


        for (let timeSheetIndex = 0; timeSheetIndex < note.timeSheet.length; timeSheetIndex++) {
          const timeSheet = note.timeSheet[timeSheetIndex];

          for (let rawValueKey in relevant) {
            let value = timeSheet[rawValueKey];
            if (!value) continue;
            if (typeof value == 'string' && value.includes('#')) {
              timeSheet[relevant[rawValueKey]] = eval(timeSheet[rawValueKey].replaceAll(`#0`, totalPreviewDuration));
            } else {
              timeSheet[relevant[rawValueKey]] = Number(timeSheet[rawValueKey]);
            }
          }

          if (timeSheet.from) {
            for (let rawValueKey in relevant) {
              let value = timeSheet.from[rawValueKey];
              if (!value) continue;
              if (typeof value == 'string' && value.includes('#')) {
                timeSheet.from[relevant[rawValueKey]] = eval(timeSheet.from[rawValueKey].replaceAll(`#0`, totalPreviewDuration));
              } else {
                timeSheet.from[relevant[rawValueKey]] = Number(timeSheet.from[rawValueKey]);
              }
            }
          }

          if (timeSheet.visuals) {
            for (let visualCategory in timeSheet.visuals) {
              let visualModifiers = timeSheet.visuals[visualCategory];
              if (!visualModifiers) continue
              for (let visualModifierKey in visualModifiers) {
                let visualModifier = visualModifiers[visualModifierKey]
                if (typeof visualModifier.rawDuration == 'string' && visualModifier.rawDuration.includes('#')) {
                  visualModifier.duration = eval(visualModifier.duration.replaceAll(`#0`, totalPreviewDuration))
                } else if (typeof visualModifier.rawDuration == 'string') {
                  visualModifier.duration = Number(visualModifier.rawDuration);
                }
              }
            }
          }
        }
      }
      try {
        this.recalculateNoteScaleTiming(note);
      } catch (error) { console.error(error) }
    }
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

    note.precalculatedStartAt = note.scaleStart - CONFIG.CREATION_ANTIDELAY;
    if (note.startAt) {
      note.precalculatedStartAt = note.time + Number(note.startAt);
    }
  
    if (note.slider) {
      note.precalculatedFailTime = Number(note.sliderEnd) + CONFIG.SLIDER_RELEASE_THRESHOLD
    } else {
      note.precalculatedFailTime = Number(note.time) + CONFIG.ACCEPTANCE_THRESHOLD;
    }

    if (note.endAt) {
      note.precalculatedFailTime = (note.sliderEnd || note.time) + note.endAt;
    }
  }

  async initializeDOM() {
    this.elements = {
      container: document.getElementById('noteContainer'),
      centerContainer: document.getElementById('centerContainer'),
      topLevelContainer: document.getElementById('topLevelContainer'),
      comboDisplay: document.getElementById('comboDisplay'),
      previewers: document.querySelectorAll('.previewer_parent'),
      noteContainerFrame: document.getElementById('noteContainerFrame'),
      perfectionIndicator: document.getElementById('perfectionIndicator'),
      pauseButton: document.getElementById('pauseButton'),
      scoreText: document.getElementById('scoreText'),
      scoreNumber: document.getElementById('scoreNumber'),
      songName: document.getElementById('songName'),
      songArtist: document.getElementById('songArtist'),
      songData: document.getElementById('songData'),
      songArt: document.getElementById('songArt'),
      backButton: document.getElementById('backButton'),
      restartButton: document.getElementById('restartButton'),
      controls: document.getElementById('controls'),
      tunnel_vision: document.getElementById('tunnel_vision'),
      overlay: document.getElementById('overlay'),
      bpmFrame: document.getElementById('bpmFrame'),
      usedScoreNumber: document.getElementById('usedScore'),
      unusedScoreNumber: document.getElementById('unusedScore'),
      flickers: [
        document.getElementById('lightshow_8'), document.getElementById('lightshow_1'),
        document.getElementById('lightshow_2'),
        document.getElementById('lightshow_3'), document.getElementById('lightshow_4'),
        document.getElementById('lightshow_5'), document.getElementById('lightshow_6'),
        document.getElementById('lightshow_7')
      ],
      flickerStates: {
        0: false,
        1: false,
        2: false,
        3: false,
        4: false,
        5: false,
        6: false,
        7: false,
      },
      scoringIndicators: {
        'perfect': document.getElementById('perfect'),
        'great': document.getElementById('great'),
        'ok': document.getElementById('okay'),
        'bad': document.getElementById('bad'),
        'miss': document.getElementById('miss')
      },
      angleHighlighters: {
        0: document.getElementById('angleHighlighter_0'),
        1: document.getElementById('angleHighlighter_1'),
      },
      lanes: {
        0: document.getElementById('lane_0'),
        1: document.getElementById('lane_1'),
        2: document.getElementById('lane_2'),
        3: document.getElementById('lane_3'),
        4: document.getElementById('lane_4'),
        5: document.getElementById('lane_5'),
      }
    };
    this.lastScoringIndicatorDisplayed = null;

    this.elements.topLevelContainer.style.scale = getSetting('hexagon_size', 1);

    this.effectItems = []
    for (let i = 0; i < 4 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let particle_outwards = document.createElement('div');
      particle_outwards.classList.add('sfx_outwards_particle');
      parent.appendChild(particle_outwards);

      let particles_outwards = document.createElement('div');
      particles_outwards.classList.add('sfx_outwards_particles');
      parent.appendChild(particles_outwards);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: particle_outwards,
        particleElement: particles_outwards,
        inUse: false,
        type: 'particles'
      });
    }

    for (let i = 0; i < 4 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let particle_outwards = document.createElement('div');
      particle_outwards.classList.add('sfx_outwards_particle', 'sfx_constant_particle');
      parent.appendChild(particle_outwards);

      let particles_outwards = document.createElement('div');
      particles_outwards.classList.add('sfx_outwards_particles', 'sfx_constant_particles');
      parent.appendChild(particles_outwards);

      let particles_outwards_repeat = document.createElement('div');
      particles_outwards_repeat.classList.add('sfx_outwards_particles', 'sfx_constant_particles', 'sfx_constant_particles_repeat');
      parent.appendChild(particles_outwards_repeat);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: particle_outwards,
        particleElement: particles_outwards,
        particleElementRepeat: particles_outwards_repeat,
        inUse: false,
        type: 'particles_constant',
        constant: true
      });
    }

    for (let i = 0; i < 3 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let header = document.createElement('div');
      header.classList.add('sfx_header', 'note_header');
      parent.appendChild(header);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: header,
        inUse: false,
        type: 'header_burst'
      })
    }

    for (let i = 0; i < 1 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let header = document.createElement('div');
      header.classList.add('sfx_header', 'swipe_header');
      parent.appendChild(header);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: header,
        inUse: false,
        type: 'swipe_burst'
      })
    }

    for (let i = 0; i < 4 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let particle_outwards = document.createElement('div');
      particle_outwards.classList.add('sfx_outwards_particle', 'sfx_outwards_chevron');
      parent.appendChild(particle_outwards);

      let particles_outwards = document.createElement('div');
      particles_outwards.classList.add('sfx_outwards_particles');
      parent.appendChild(particles_outwards);

      let chevron_particles_outwards = document.createElement('div');
      chevron_particles_outwards.classList.add('sfx_outwards_chevrons');
      parent.appendChild(chevron_particles_outwards);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: particle_outwards,
        particleElement: particles_outwards,
        inUse: false,
        type: 'particles_swipe'
      });
    }

    for (let i = 0; i < 3 * CONFIG.VFX_CACHE_MULTIPLIER; i++) {
      let parent = document.createElement('div');
      parent.classList.add('sfx_container');
      parent.style.display = 'none';

      let header = document.createElement('div');
      header.classList.add('sfx_header', 'slider_header');
      parent.appendChild(header);

      this.elements.container.appendChild(parent);
      this.effectItems.push({
        parent,
        element: header,
        inUse: false,
        type: 'header_constant',
        constant: true
      })
    }


    const baseDuration = CONFIG.NOTE_PREVIEW_DELAY / 1000;
    const glowWidth = 0.4;
    const totalDuration = baseDuration * (1 + (glowWidth * 2));
    console.log(`Visible Speed: ${baseDuration}s | Total Timeline: ${totalDuration}s`);

    for (let i = 0; i < 6; i++) {
      // const container = document.getElementById('highlight_container');

      let angleMap = { 0: 5, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
      let item = document.createElement('highlight_plane');
      item.style.setProperty('--i', i);
      this.elements.container.appendChild(item);

      this.effectItems.push({
        parent: null,
        element: item,
        inUse: false,
        type: 'segment_highlight_' + angleMap[i],
        constant: false
      });
    }

    for (let i = 0; i < 6; i++) {
      const container = document.getElementById('highlight_container');

      let item = document.createElement('highlight_plane');
      item.style.setProperty('--i', i);
      container.appendChild(item);

      let extraItem = document.createElement('glow_layer');
      extraItem.style.setProperty('--i', i);

      const baseDuration = CONFIG.NOTE_PREVIEW_DELAY / 1000;
      const glowWidth = 0.4;
      const totalDuration = baseDuration * (1 + (glowWidth * 2));

      console.log(`Visible Speed: ${baseDuration}s | Total Timeline: ${totalDuration}s`);

      extraItem.innerHTML = `
    <svg width="370" height="245" viewBox="0 0 370 245" fill="none">
      <defs>
        <linearGradient id="grad-${i}" x1="0" y1="1" x2="0" y2="0">
          <stop id="edge-bottom-${i}" offset="1" stop-color="black">
            <animate attributeName="offset" from="${-(glowWidth * 2)}" to="1" dur="${totalDuration}s" repeatCount="indefinite" />
          </stop>
          <stop id="glow-center-${i}" offset="1" stop-color="white">
            <animate attributeName="offset" from="${-glowWidth}" to="${1 + glowWidth}" dur="${totalDuration}s" repeatCount="indefinite" />
          </stop>
          <stop id="edge-top-${i}" offset="1" stop-color="black">
            <animate attributeName="offset" from="0" to="${1 + (glowWidth * 2)}" dur="${totalDuration}s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        <mask id="mask-${i}"><rect width="100%" height="100%" fill="url(#grad-${i})" /></mask>
      </defs>
      <g mask="url(#mask-${i})">
        <path d="M231.637 244.5H136.856L-0.499981 -0.5L369.5 -0.5L231.637 244.5Z" fill="white" fill-opacity="0.9"/>
      </g>
    </svg>
  `;

      container.appendChild(extraItem);

      let angleMap = { 0: 5, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
      this.effectItems.push({
        parent: null,
        element: item,
        inUse: false,
        type: 'segment_highlight_' + angleMap[i],
        constant: false
      });
    }


    var rect = this.elements.container.getBoundingClientRect();
    var centerX = rect.x + (rect.width / 2);
    var centerY = rect.y + (rect.height / 2);
    this.cachedRects = { rect, centerX, centerY };
    setTimeout(() => {
      var rect = this.elements.container.getBoundingClientRect();
      var centerX = rect.x + (rect.width / 2);
      var centerY = rect.y + (rect.height / 2);
      this.cachedRects = { rect, centerX, centerY };

    }, 3000);
    window.addEventListener('resize', () => {
      var rect = this.elements.container.getBoundingClientRect();
      var centerX = rect.x + (rect.width / 2);
      var centerY = rect.y + (rect.height / 2);
      this.cachedRects = { rect, centerX, centerY };
    });
  }

  async initializeAudio() {
    let filePath;

    if (!isAndroid) {
      filePath = `./Beatmaps/${this.crossDetails.location}/audio.mp3`;
      const fileBuf = fs.readFileSync(filePath);
      const arrayBuffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.length);
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } else {
      const SERVER_URL = 'http://192.168.100.11:5500';
      filePath = `${SERVER_URL}/Beatmaps/${this.crossDetails.location}/audio.mp3`;

      try {
        const response = await fetch(filePath);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (error) {
        console.error('Failed to fetch audio:', error);
        return;
      }
    }

    if (this.audioSource) {
      try { this.audioSource.stop(); } catch (e) { }
      this.audioSource.disconnect();
    }

    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    this.sfxGainNode = this.audioContext.createGain();
    this.sfxGainNode.connect(this.audioContext.destination);
    this.sfxGainNode.gain.value = Number(getSetting('sfx_volume', 90)) / 100;

    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.gainNode);
    const audioDelaySeconds = CONFIG.AUDIO_START_DELAY / 1000;
    const startTime = this.audioContext.currentTime + audioDelaySeconds;

    this.audioSource.start(startTime);

    this.audioStartTime = startTime;
    this.paused = false;
  }

  get currentTime() {
    return (this.audioContext.currentTime - this.audioStartTime) * 1000;
  }

  seekToTime(timeInMs) {
    if (!this.audioSource || !this.audioBuffer) return;

    this.audioSource.stop();
    this.audioSource.disconnect();

    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.gainNode);

    const timeInSeconds = timeInMs / 1000;
    this.audioStartTime = this.audioContext.currentTime - timeInSeconds;

    this.audioSource.start(this.audioContext.currentTime, timeInSeconds);
  }
}