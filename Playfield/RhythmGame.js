class RhythmGame {
  constructor() {
    this.gameState = new GameState();
    this.timingSystem = new TimingSystem();
    this.inputSystem = new InputSystem(this.gameState, this.timingSystem);
    this.renderingSystem = new RenderingSystem(this.gameState, this.timingSystem, this.inputSystem);
    this.scoringSystem = new ScoringSystem(this.gameState);

    // Add references to gameState
    this.gameState.scoringSystem = this.scoringSystem;
    this.gameState.timingSystem = this.timingSystem;

    // hit sound buffers
    this.gameState.hitBuffer = [];


    // initialize audio and then start loop
    requestAnimationFrame(() => {
      this.init();
    });
  }

  async init() {
    if (this.gameState?.ready) await this.gameState.ready;

    let audioPaths = {
      'hit': './Assets/hit_normal.mp3',
      'golden': './Assets/hit_golden.mp3',
      'holdable': './Assets/hit_holdable.mp3'
    };

    this.gameState.loadedAudios = {};
    if (!isAndroid) {
      // Desktop: Read from file system
      for (let type in audioPaths) {
        const data = fs.readFileSync(audioPaths[type]);
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        let hitSoundBuffer = await game.gameState.audioContext.decodeAudioData(arrayBuffer);
        this.gameState.loadedAudios[type] = hitSoundBuffer;
      }
    } else {
      // Android: Fetch from server
      for (let type in audioPaths) {
        try {
          // build correct URL (audioPaths like "./Assets/hit_normal.mp3")
          const url = `${SERVER_URL}/${audioPaths[type].replace(/^\.?\//, '')}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();
          try {
            const hitSoundBuffer = await game.gameState.audioContext.decodeAudioData(arrayBuffer);
            this.gameState.loadedAudios[type] = hitSoundBuffer;
          } catch (decodeErr) {
            console.error(`decodeAudioData failed for ${type}:`, decodeErr);
          }
        } catch (error) {
          console.error(`Failed to fetch ${type} sound:`, error);
        }
      }
    }

    // Start game loop now that audio is ready
    this.gameState.playHitSound = this.playHitSound.bind(this);

    await new Promise((res) => {
      setTimeout(() => {
        res()
      }, CONFIG.INITIAL_DELAY);
    })
    loadTime = performance.now();
    await new Promise((res) => {
      const img = new Image();
      img.src = '../Assets/HUD/ScoreOverlay.svg';
      img.onload = () => {
        this.gameState.scoreOverlayImage = img;
        res();
      }
    })

    setTimeout(async () => {
      await this.gameState.initializeAudio();
      this.startGameLoop();
      this.gameState.pauseGame = this.pauseGame.bind(this);
    }, 1500);


  }

  playHitSound(note) {
    const source = this.gameState.audioContext.createBufferSource();
    let determinedBuffer = this.gameState.loadedAudios['hit'];
    if (note?.golden) {
      determinedBuffer = this.gameState.loadedAudios['golden']
    }
    if (note?.holdable) {
      determinedBuffer = this.gameState.loadedAudios['holdable']
    }
    source.buffer = determinedBuffer;
    source.connect(this.gameState.sfxGainNode);
    source.start();
  }

  startGameLoop() {
    const gameLoop = (timestamp) => {
      if (this.gameState.paused || this.gameState.ended) return;
      const currentTime = this.gameState.currentTime;
      if ((currentTime) > this.gameState.endsAt) return this.endGame();

      // Update gamepad input
      this.inputSystem.updateGamepadInput();

      // Update rendering
      this.renderingSystem.update(currentTime);

      // (Global) Update global timing point
      this.timingSystem.updateGlobalTimingPoint(this.gameState.timeSheet, currentTime);

      if (CONFIG.AUTOPLAY && game.inputSystem) {
        game.inputSystem.handleAutoplay(currentTime)
      }

      // Continue loop
      requestAnimationFrame(gameLoop);
    };

    // return this.endGame();
    requestAnimationFrame(gameLoop);
  }

  pauseGame() {
    if (this.gameState.paused) return this.unpauseGame();
    try {
      cancelPolling = false;
    } catch (e) { }
    this.gameState.audioContext.suspend();
    this.gameState.paused = true;
    // return;
    this.gameState.elements.noteContainerFrame.parentElement.parentElement.style.opacity = 0;
    this.gameState.elements.noteContainerFrame.parentElement.style.scale = 0.9;
    this.gameState.elements.pauseButton.firstElementChild.classList.remove('pause');
    this.gameState.elements.pauseButton.firstElementChild.classList.add('play');
    this.gameState.elements.songData.classList.add('viewing');
    this.gameState.elements.songArt.classList.add('viewing');
    this.gameState.elements.backButton.classList.remove('hiddenButton');
    this.gameState.elements.restartButton.classList.remove('hiddenButton');
    document.getElementById('overlay').style.backgroundImage = 'unset';
    document.getElementById('pauseButton').classList.add('controller_selectable', 'selected');
    document.getElementById('restartButton').classList.add('controller_selectable');
    document.getElementById('backButton').classList.add('controller_selectable');
    let cc = document.createElement('script');
    cc.src = '../Utilities/controller-control.js'
    document.head.appendChild(cc);
    cc.onload = () => {
      this.gameState.pauseScript = cc;
    }
  }

  unpauseGame(force) {
    document.getElementById('pauseButton').classList.remove('controller_selectable', 'selected');
    document.getElementById('restartButton').classList.remove('controller_selectable', 'selected');
    document.getElementById('backButton').classList.remove('controller_selectable', 'selected');
    if (!force && this.gameState.ended) return;
    this.gameState.elements.noteContainerFrame.parentElement.parentElement.style.opacity = 1;
    this.gameState.elements.noteContainerFrame.parentElement.style.scale = 1;
    this.gameState.elements.pauseButton.firstElementChild.classList.remove('play');
    this.gameState.elements.pauseButton.firstElementChild.classList.add('pause');
    this.gameState.elements.songData.classList.remove('viewing');
    this.gameState.elements.songArt.classList.remove('viewing');
    document.getElementById('overlay').style.backgroundImage = null;
    this.gameState.elements.backButton.classList.add('hiddenButton');
    this.gameState.elements.restartButton.classList.add('hiddenButton');
    this.gameState.pauseScript.remove();
    cancelPolling = true;

    setTimeout(() => {
      // perfectionIndicator.innerHTML = ''
    }, 1000);
    setTimeout(() => {
      this.gameState.playHitSound()
    }, 3000);

    setTimeout(() => {
      this.startGameLoop();
      if (typeof currentPlaybackSpeed !== 'undefined') {
        this.gameState.audioSource.playbackRate.value = currentPlaybackSpeed;
      }
      this.gameState.audioContext.resume();
      this.gameState.paused = false;
      pollGamepads = null;

    }, 2000);
  }

  endGame() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './scorescreen.css';
    document.getElementById('overlay').style.backgroundImage = 'unset';
    document.head.appendChild(link);

    try {
      cancelPolling = false;
    } catch (e) { }

    this.gameState.elements.controls.style.opacity = 0;
    this.gameState.elements.controls.style.scale = 0.9;
    this.gameState.ended = true;
    this.gameState.elements.noteContainerFrame.parentElement.parentElement.style.opacity = 0;
    let cc = document.createElement('script');
    cc.src = '../Utilities/controller-control.js'
    document.head.appendChild(cc);
    document.getElementById('scoreHUD').classList.add('end_scoreHUD');

    setTimeout(() => {
      document.getElementById('buttons').remove();
      this.gameState.elements.controls.classList.add('end_controls');
      document.getElementById('gradeParent').classList.add('end_gradeParent');
      document.getElementById('gradeParent').innerHTML = `
        <div id="scoreCard">
        <div id="grade"></div>
        <btextm id="scoreText">SCORE</btextm>
        <btextm id="scoreNumber" class="flexbox"></btextm>
        <btextm id="scoreComparison"></btext>
      </div>
      <div id="lowerScoreContainer">

        <br>
        <div id="scoreStats"></div>
        <br>
        <div id="songProcedureControls"></div>
      </div>`
    }, CONFIG.LONG_ANIMATION);
    setTimeout(() => {

      this.gameState.elements.controls.style.opacity = 1;
      this.gameState.elements.controls.style.scale = 1;
      document.getElementById('scoreText').classList.add('end_scoreText');
      document.getElementById('scoreNumber').classList.add('end_scoreNumber');
      let scoreStats = document.getElementById('scoreStats');

      let score = this.gameState.score;
      // score += this.gameState.scoringPad.perfect.length * 1000;
      // score += this.gameState.scoringPad.great.length * 500;
      // score += this.gameState.scoringPad.ok.length * 100;
      // score += this.gameState.scoringPad.bad.length * 50;
      // score += this.gameState.scoringPad.miss.length * 0;
      // this.gameState.score = score;

      let toCount = [];
      for (let i = 0; this.gameState.scoringPad.perfect[i]; i++) toCount.push(100);
      for (let i = 0; this.gameState.scoringPad.great[i]; i++) toCount.push(90);
      for (let i = 0; this.gameState.scoringPad.ok[i]; i++) toCount.push(50);
      for (let i = 0; this.gameState.scoringPad.bad[i]; i++) toCount.push(10);
      for (let i = 0; this.gameState.scoringPad.miss[i]; i++) toCount.push(0);

      let sum = 0; for (let i = 0; i < toCount.length; i++) { sum += toCount[i]; }
      let accuracy = Math.round(sum / toCount.length);

      let grade;
      if (accuracy == 100) {
        grade = 'FC'
      } else if (accuracy > 97) {
        grade = 'SS+'
      } else if (accuracy > 92) {
        grade = 'SS'
      } else if (accuracy > 85) {
        grade = 'S'
      } else if (accuracy > 75) {
        grade = 'A'
      } else if (accuracy > 70) {
        grade = 'B'
      } else if (accuracy > 40) {
        grade = 'C'
      } else if (accuracy > 10) {
        grade = 'D'
      } else {
        grade = 'F'
      }
      let existingScore = [0, 0, 0, 'X', 'REC=']
      if (fs.existsSync('./Config/Records/' + this.gameState.crossDetails.location)) {
        existingScore = fs.readFileSync('./Config/Records/' + this.gameState.crossDetails.location, 'utf8').split('\n');
      }
      if (existingScore[1] < this.gameState.score) {
        existingScore[1] = this.gameState.score;
        existingScore[2] = this.gameState.maxCombo;
        existingScore[3] = grade;
        fs.writeFileSync('./Config/Records/' + this.gameState.crossDetails.location, existingScore.join('\n'));
      }

      scoreStats.innerHTML = `
      <btext id="hitCounts"><span>${`${accuracy}` == "NaN" ? "0" : `${accuracy}`}%</span></btext> • 
      <btext id="maxCombo"><span>Max Combo</span> <span>${this.gameState.maxCombo}</span></btext>
      <br>
        <div class="scoreIndicator flexbox perfect"><div class="label">PERFECT</div><div class="count">${this.gameState.scoringPad.perfect.length}</div></div>
        <div class="scoreIndicator flexbox great"><div class="label">GREAT</div><div class="count">${this.gameState.scoringPad.great.length}</div></div>
        <div class="scoreIndicator flexbox okay"><div class="label">OKAY</div><div class="count">${this.gameState.scoringPad.ok.length}</div></div>
        <div class="scoreIndicator flexbox bad"><div class="label">BAD</div><div class="count">${this.gameState.scoringPad.bad.length}</div></div>
        <div class="scoreIndicator flexbox miss"><div class="label">MISS</div><div class="count">${this.gameState.scoringPad.miss.length}</div></div>
      `

      let scoreLength = `${score}`.length;
      let characters = 18;
      let emptyCharacters = characters - scoreLength;
      document.getElementById('scoreNumber').innerHTML = `
          <div id="unusedScoreNumbers">${'0'.repeat(emptyCharacters)}</div>
          <div id="usedScoreNumbers">${score}</div>
      `

      let highScore = `${Math.floor(Math.random() * 100) + 10}💀`;
      if (fs.existsSync(`./Config/Records/${this.gameState.crossDetails.location}/${this.gameState.crossDetails.map}`)) {
        let highScoreFile = fs.readFileSync(`./Config/Records/${this.gameState.crossDetails.location}/${this.gameState.crossDetails.map}`, 'utf8');
        highScore = highScoreFile.toString();
      }
      let magicNumber = highScore.slice(0, 2);
      highScore = highScore.slice(2, highScore.length);
      let encryption = {
        "💀": 0,
        "$‸": 1,
        "(^///^) ~ 💗": 2,
        "DS": 3,
        "SHA": 4,
        [magicNumber]: 5,
        "C0": 6,
        "HEX": 7,
        "INT": 8,
        "192": 9,
      }

      for (let identifier in encryption) {
        if (highScore.includes(identifier)) {
          highScore = highScore.replaceAll(identifier, encryption[identifier]);
        }
      }

      let scoreComparison = document.getElementById('scoreComparison');
      let scoreDiff = Math.abs(score - highScore);
      if (highScore > score && highScore != 0) {
        scoreComparison.innerHTML = ``
      }

      document.getElementById('grade').style.backgroundImage = `url('../Assets/Scoring/${grade}.svg')`;

      document.getElementById('scoreCard').innerHTML += `
            <btn class="controller_selectable" onclick="location.reload();">Replay</btn>
      `
      document.getElementById('songProcedureControls').innerHTML = `
      <btn class="controller_selectable" onclick="location.href = '../Picker/LevelPicker.html'">Home</btn>
      `
    }, CONFIG.LONG_ANIMATION * 2);
  }

  uninitializeGame(callback) {
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundColor = 'black';
    document.body.style.backgroundPositionY = '100vh';
    this.gameState.elements.controls.style.opacity = 0;
    document.body.style.animation = 'none';
    setTimeout(() => {
      if (callback) callback();
      window.location.href = '../Picker/LevelPicker.html'
    }, 500);
  }

}