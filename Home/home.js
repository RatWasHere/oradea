const fs = require('fs');

let levels = [];

let files = fs.readdirSync('./Beatmaps/');

for (let i in files) {
  try {
    let information = JSON.parse(fs.readFileSync(`./Beatmaps/${files[i]}/information.json`));
    let beatmaps = {};
    for (let index in information.difficulties) {
      beatmaps[index] = JSON.parse(fs.readFileSync(`./Beatmaps/${files[i]}/${information.difficulties[index]}`));
    }
    if (information.ratings) {
      levels.push({
        beatmaps,
        information: information,
        location: files[i]
      })
    }
  } catch (error) { console.log(error) }
}

// choose a random level
const randomLevel = levels[Math.floor(Math.random() * levels.length)];
// const randomLevel = levels[5];
const basePath = `${process.cwd().replaceAll('\\', '/')}/Beatmaps/${randomLevel.location}`;
document.body.style.backgroundImage = `url('${basePath}/${randomLevel.information.cover}')`;


let reactiveCore = document.getElementById('reactive_core');
let reactiveNoteCore = document.getElementById('reactive_note_core');
let killModifications = false;
// create an audio and then make the reactive core react to the volume
let audio = new Audio(`../Beatmaps/${randomLevel.location}/audio.mp3`);
audio.addEventListener('play', () => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(audio);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  let velocity = 0;
  let lastTransform = 0;
  let lastTime = 0;
  let lastScale = 1;
  function animate(elapsedTime) {
    if (killModifications) return;
    if (isNaN(lastTransform)) lastTransform = 0;
    analyser.getByteFrequencyData(dataArray);
    // Calculate average volume
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    // Scale between 1 and 2 (adjust as needed)
    const scale = Math.min(1 + avg / 100, avg / 100);
    let scaleAmount = Math.max(scale * 1.1, 0.7);
    lastScale = scaleAmount;
    reactiveCore.style.transform = `scaleX(${scaleAmount})`;
    reactiveNoteCore.style.transform = `scaleX(${scaleAmount})`;
    try {
      let gamepad = navigator.getGamepads()[0];
      // gamepad.vibrationActuator.playEffect("dual-rumble", { startDelay: 0, duration: 100, weakMagnitude: Math.min(scaleAmount / 5, 1), strongMagnitude: 0 })
    } catch (error) { }
    // let supposedNewTransform = lastTransform + (((elapsedTime - lastTime) * scale * 5));
    // if (supposedNewTransform - lastTransform > 100) {
    //   lastTransform = supposedNewTransform;
    // } else if (supposedNewTransform - lastTransform > 50) {
    //   lastTransform = lastTransform + (((elapsedTime - lastTime) * scale * 2));
    // } else {
    //   lastTransform = lastTransform + (elapsedTime - lastTime) * 0.1;
    // }
    // document.body.style.backgroundPosition = `${lastTransform}px 0px`;
    lastTime = elapsedTime;

    requestAnimationFrame(animate);
  }

  let notes = Object.values(randomLevel.beatmaps)[Object.keys(randomLevel.beatmaps).length - 1];
  // animate based on note times too
  function animateNotes() {
    if (killModifications) return;
    try {
      const currentTime = audio.currentTime;
      for (let noteIndex in notes) {
        let note = notes[noteIndex];
        if (!note.done && note.time - 30 <= currentTime * 1000) {
          let distanceUntilNextNote = (notes[Number(noteIndex) + 1].time - note.time) || 0;
          // console.log(distanceUntilNextNote)/
          note.done = true;
          reactiveNoteCore.style.transition = `all 30ms cubic-bezier(1,.11,1,.97)`;
          reactiveNoteCore.style.scale = `1 2`;
          setTimeout(() => {
            reactiveNoteCore.style.transition = `all ${Math.min(distanceUntilNextNote, 250)}ms ease`;
            reactiveNoteCore.style.scale = `${lastScale * ((Math.random() + 1.5) / 2)} 1`;
            let gamepad = navigator.getGamepads()[0];
            gamepad.vibrationActuator.playEffect("dual-rumble", { startDelay: 0, duration: Math.min(distanceUntilNextNote, 1500) - 50, weakMagnitude: 0.3, strongMagnitude: 0.3 })

          }, 30);
        }
      }
    } catch (error) {
      console.error('Error in animateNotes:', error);
    }
    requestAnimationFrame(animateNotes);
  }

  animateNotes();
  animate();
});

audio.play();


function fadeThisOut() {
  killModifications = true;
  reactiveCore.classList.add('exiting');
  reactiveNoteCore.classList.add('exiting');
  let buttons = document.getElementsByTagName('btn');
  for (let b in buttons) {
    try {
      let button = buttons[b];
      if (button) {
        button.className += ' exiting';
        button.style.transitionDuration = `${(Number(b) + 1) / 2}s`
      }
    } catch (error) { }
  }
  document.body.style.transition = 'all 0.8s cubic-bezier(1,-0.01,.16,1.06)';

  setTimeout(() => {
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundPositionY = '100vh';
    audio.volume = 0.5;
  }, 1000);
  setTimeout(() => {
    audio.volume = 0.3;
  }, 1200);
  setTimeout(() => {
    audio.volume = 0.2;
  }, 1300);
  setTimeout(() => {
    audio.volume = 0.1;
  }, 1400);
  setTimeout(() => {
    audio.volume = 0;
  }, 1500);
  setTimeout(() => {
    document.getElementById('bg-overlay').style.opacity = '0'
  }, 1800);


  setTimeout(() => {
    window.location.href = '../Picker/LevelPicker.html';
  }, 1800);
}