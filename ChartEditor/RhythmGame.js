let globalLoopID = 0;
let updateSkips = 0;
class RhythmGame {
  constructor() {
    this.gameState = new GameState();
    this.timingSystem = new TimingSystem();
    this.inputSystem = new InputSystem(this.gameState, this.timingSystem);
    this.renderingSystem = new RenderingSystem(this.gameState, this.timingSystem, this.inputSystem);
    this.scoringSystem = new ScoringSystem(this.gameState);

    this.gameState.timingSystem = this.timingSystem;
    this.gameState.scoringSystem = this.scoringSystem;

    // hit sound buffers
    this.gameState.hitBuffer = [];
  }
  async init() {
    if (this.gameState?.ready) await this.gameState.ready;

    let audioPaths = {
      'hit': './Assets/hit_normal.mp3',
      'golden': './Assets/hit_golden.mp3',
      'holdable': './Assets/hit_holdable.mp3'
    };

    this.gameState.loadedAudios = {};
    for (let type in audioPaths) {
      const data = fs.readFileSync(audioPaths[type]);
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      let hitSoundBuffer = await game.gameState.audioContext.decodeAudioData(arrayBuffer);
      this.gameState.loadedAudios[type] = hitSoundBuffer;
    }

    // Start game loop now that audio is ready
    this.gameState.playHitSound = this.playHitSound.bind(this);

    setTimeout(async () => {
      this.startGameLoop();
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

  updateTimestamps(time) {
    updateSkips++;
    if (updateSkips != 10) return;
    updateSkips = 0;
    let currentTime = Math.round(time);
    let timeLength = `${currentTime}`.length;
    document.getElementById('timestamp').innerText = `${'0'.repeat(this.gameState.zerosInMS - timeLength)}${currentTime}`;

    currentTime = time / 1000;
    let minutes = Math.floor(currentTime / 60);
    let seconds = Math.floor(currentTime - minutes * 60);
    let milliseconds = Math.floor((currentTime - minutes * 60 - seconds) * 1000);
    document.getElementById('humanformat').innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}:${milliseconds < 10 ? '0' : ''}${milliseconds.toString().slice(0, 2)}`;
  
    if (this.gameState.stopUpdatingRange) return;
    document.getElementById('timeRange').value = time;
  }

  startGameLoop() {
    let loopID = globalLoopID + 1;
    globalLoopID = loopID;
    const gameLoop = (timestamp) => {
      if (globalLoopID != loopID) return;
      const currentTime = this.gameState.currentTime;
      if ((currentTime) > this.gameState.endsAt) return this.endGame();

      this.renderingSystem.update(currentTime);
      this.updateTimestamps(currentTime);

      this.timingSystem.updateGlobalTimingPoint(this.gameState.timeSheet, currentTime);

      game.inputSystem.handleAutoplay(currentTime)

      refreshSegments(currentTime)

      requestAnimationFrame(gameLoop);
      updateSnapPositions();
      updateNotes();
    };

    requestAnimationFrame(gameLoop);
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