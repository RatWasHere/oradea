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
            // gamepad.vibrationActuator.playEffect("dual-rumble", { startDelay: 0, duration: Math.min(distanceUntilNextNote, 1500) - 50, weakMagnitude: 0.3, strongMagnitude: 0.3 })

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

let currentPopover;
function createPopup(content) {
  let popover = document.createElement('div');
  popover.classList.add('popover');
  document.body.appendChild(popover);
  popover.innerHTML = content;
  currentPopover = popover;
}

let elementsRemovedForTutorial = [];

if (!isDismissed("welcome")) {
  let elements = document.querySelectorAll('.controller_selectable').forEach((el) => {el.classList.remove('controller_selectable'); elementsRemovedForTutorial.push(el)});
  document.getElementById('play-button').classList.remove('selected')
  audio.pause();
  createPopup(`
  <btextm style="width: 100%; text-align: center; display: block; font-family: 'Modern'; font-size: 30px;">Welcome to ORADEA</btextm>
  <div style="width: 100%; text-align: center; display: block;">Please connect your controller and then click any button to proceed! If you don't have one, check back on a public build.</div>
  <video width="300" height="187.5" autoplay="true" loop="true" style="margin: auto; display: block;
  border-radius: 10px;
  mask: linear-gradient(to top, 
  rgba(0,0,0, 1) 0,   rgba(0,0,0, 1) 40%, 
  rgba(0,0,0, 0) 95%, rgba(0,0,0, 0) 0
  ) 100% 50% / 100% 100% repeat-x;
  ">
  <source src="../Assets/Glyphs/connectController.mp4">
  </video>
  <div style="width: 100%; text-align: center; display: block; font-size: 12px; opacity: 0.5; margin-top: 10px;">The tutorial will continue when a button is pressed. You may not proceed to play at this time.</div>
  `);
  window.addEventListener('gamepadconnected', () => {
    console.log('hey!')
    currentPopover.innerHTML = `
    <btextm style="width: 100%; text-align: center; display: block; font-family: 'Modern'; font-size: 30px;">Audio Delay Calibration Currently Unavailable</btextm>
    <div style="width: 100%; text-align: center; display: block;">Check back later. We had some issues measuring your input device's latency.</div>
    <div style="width: 100%; text-align: center; display: block; font-size: 12px; opacity: 0.5; margin-top: 5px;">non-jargon translation: this game is unfinished and i didnt bother adding audio calibration yet, i sure hope you aren't using bluetooth heaphones <br> the audio engine has insanely good latency, depending on your refresh rate, you can even get ~3ms accuracy (120hz figure)</div>
    <btn style="margin-top: 10px;" class="controller_selectable" onclick="showTutorial(true);">I didn't even need it to begin with, show me how to play!</btn>
    `
  });
  setTimeout(() => {
    // showTutorial();
  }, 100);
}

function showTutorial() {
  currentPopover.style.transform = 'translateY(-190px)'
  currentPopover.innerHTML = `
  <btextm style="width: 100%; text-align: center; display: block; font-family: 'Modern'; font-size: 30px;">Introducing... the hexagon!</btextm>
    <div class="flexbox" style="margin-top: 20px; position: absolute; width: 100%;">
    <div style="width: 400px; height: 400px; margin: auto; margin-top: 10px; margin-bottom: 10px; background: url('../Assets/Playfield/frame.svg'); background-size: cover;">
    </div>
    </div>
    <div style="width: 100%; text-align: center; display: block; margin-top: 450px;">We split your judgement bar into six segments. Notes come in from the center to the outside.<br>
    To hit them, point your joystick at them and hit one of the shoulder buttons on the same side as the trigger.</div>
    <btn style="margin-top: 10px; width: fit-content; margin: auto; margin-top: 20px;" class="controller_selectable" id="tutorialProceedButton" onclick="startShowingNotes();">Tell me more..</btn>
  `
}

function startShowingNotes() {
  currentPopover.style.transform = 'translateY(-250px)'
  currentPopover.innerHTML = `
    <div class="flexbox" style="margin-top: 76px;">
    <div style="width: 400px; height: 400px; margin: auto; margin-top: 10px; margin-bottom: 10px; background: url('../Assets/Playfield/frame.svg'); background-size: cover;">
      <div style="width: 100px; height: 100%; margin: auto; rotate: 30deg;">
        <div id="noteForDemonstration" style="width: 100%; height: 100%; background-image: url('../Assets/Headers/Note.svg'); background-repeat: no-repeat; animation: noteDemonstration infinite 2s linear;"></div>
      </div>
    </div>
    <div class="flexbox" style="position: absolute; animation: infinite 2s linear; translate: 0px 100px; width: 200px; height: 200px; border: solid 10px white; border-radius: 100%; opacity: 0.5; margin-top: auto; margin-bottom: auto;"><div id="stickForDemonstration" style="width: 160px; height: 160px; background: #FFFFFF60; border-radius: 100%; margin: auto; animation: noteDemonstrationStick infinite 2s linear;" class="flexbox"><btextm style="display: block; margin: auto; text-align: center;">Right<br>Stick</btextm></div></div>
    <div class="flexbox" id="triggerForDemonstration" style="position: absolute; animation: noteDemonstrationTrigger infinite 2s linear; backdrop-filter: blur(12px); z-index: 100; translate: 110px -20px; rotate: 30deg; width: 230px; height: 50px; border: solid 10px white; border-radius: 10px; opacity: 0.7; margin-top: auto; margin-bottom: auto;"><btextm style="display: block; margin: auto; text-align: center;">Right Button</btextm></div>
    </div>
    <btextm style="width: 100%; text-align: center; display: block; font-family: 'Modern'; font-size: 30px;" id="noteType">Standard Notes</btextm>
    <div id="noteTypeExplanation" style="width: 100%; text-align: center; display: block;">To hit a <b>standard</b> note, point one of your joysticks at it and hit one of the shoulder buttons on the same side as your stick of choice. Make sure to time the hit with the beat as its judgement lies on that. <br>If you have no sense of rhythm yet, look out for the moment when the note reaches the hexagon's rim.</div>
    <btn style="margin-top: 10px; width: fit-content; margin: auto; margin-top: 20px;" class="controller_selectable" id="tutorialProceedButton" onclick="proceedTutorialFromHexagon();">Anything else?</btn>
  `
}

function proceedTutorialFromHexagon() {
  document.getElementById('tutorialProceedButton').innerHTML = "Can I go now?";
  document.getElementById('tutorialProceedButton').onclick = () => {
    proceedTutorialFromFlick()
  }

  document.getElementById('noteForDemonstration').style.backgroundImage = "url('../Assets/Headers/Flick Negative.svg')";
  document.getElementById('noteForDemonstration').style.animationName = "noteDemonstrationFlick";
  document.getElementById('stickForDemonstration').style.animationName = "stickDemonstrationFlick";
  document.getElementById('triggerForDemonstration').style.animationName = "flickDemonstrationTrigger";

  document.getElementById('noteType').innerHTML = "Flick Notes";
  document.getElementById('noteTypeExplanation').innerHTML = `
  To hit a <b>flick</b> note, point one of your joysticks at it and hit one of the shoulder buttons on the same side as your stick of choice - afterwards, rotate the stick to the direction the note is pointing in. Its judgement lies on how fast you flick and when you start flicking - rest assured, it isn't harsh!
  `;

}

function proceedTutorialFromFlick() {
  document.getElementById('tutorialProceedButton').innerHTML = "LEAVE ME ALONE";
  document.getElementById('tutorialProceedButton').onclick = () => {
    currentPopover.remove();
    elementsRemovedForTutorial.forEach((el) => el.classList.add('controller_selectable'));
  }

  document.getElementById('noteForDemonstration').style.backgroundImage = "url('../Assets/Headers/Frame.svg')";
  document.getElementById('noteForDemonstration').style.animationName = "holdDemonstration";
  
  document.getElementById('triggerForDemonstration').style.animationName = "holdDemonstrationTrigger";
  
  document.getElementById('stickForDemonstration').style.animationName = "noteDemonstrationStick";

  document.getElementById('noteType').innerHTML = "Hold Notes";
  document.getElementById('noteTypeExplanation').innerHTML = `
  To hold a <b>hold</b> note, point one of your joysticks at it and hold one of the shoulder buttons on the same side as your stick of choice - afterwards, release it when the note reaches its end. Its judgement lies on when you start and end holding it - try not to release it or move your stick too much while you are.
  `;
}

