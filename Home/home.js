let reactiveCore = document.getElementById('reactive_core');
let reactiveNoteCore = document.getElementById('reactive_note_core');
let killModifications = false;
// create an audio and then make the reactive core react to the volume
let audio = new Audio(`../Assets/Misc/Ethereal.mp3`);
audio.play();


function fadeThisOut() {
  killModifications = true;
  document.getElementById('buttons-container').style.opacity = '0'
  document.body.style.transition = 'all 0.6s cubic-bezier(1,-0.01,.16,1.06)';

  setTimeout(() => {
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundPositionY = '100vh';
    audio.volume = 0.5;
  }, 300);
  setTimeout(() => {
    audio.volume = 0.3;
  }, 400);
  setTimeout(() => {
    audio.volume = 0.2;
  }, 500);
  setTimeout(() => {
    audio.volume = 0.1;
  }, 600);
  setTimeout(() => {
    audio.volume = 0;
    document.getElementById('bg-overlay').style.opacity = '0'
  }, 650);


  setTimeout(() => {
    window.location.href = '../Picker/LevelPicker.html';
  }, 900);
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

function playTutorial() {
  document.getElementById('buttons-container').style.opacity = '0'
  document.getElementById('logo').style.opacity = '0'
  let elements = document.querySelectorAll('.controller_selectable').forEach((el) => { el.classList.remove('controller_selectable'); elementsRemovedForTutorial.push(el) });
  document.getElementById('play-button').classList.remove('selected');
  createPopup(`
  <btextm style="width: 100%; text-align: center; display: block; font-family: 'Modern'; font-size: 30px;">Welcome to ORADEA</btextm>
  <div style="width: 100%; text-align: center; display: block;">Please connect your controller and then click any button to proceed! If you don't have one, come back later!</div>
  <video width="300" height="187.5" autoplay="true" loop="true" style="margin: auto; display: block;
  border-radius: 10px;
  mask: linear-gradient(to top, 
  rgba(0,0,0, 1) 0,   rgba(0,0,0, 1) 40%, 
  rgba(0,0,0, 0) 95%, rgba(0,0,0, 0) 0
  ) 100% 50% / 100% 100% repeat-x;
  ">
  <source src="../Assets/Glyphs/connectController.mp4">
  </video>
  <btn style="margin-top: 10px;" class="controller_selectable" onclick="showTutorial(true);">I don't have a controller yet.</btn>
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
  currentPopover.style.transform = 'translateY(-60px)'
}

function hideShowPopover() {
  return new Promise((res) => {
    currentPopover.style.scale = '0.9';
    currentPopover.style.opacity = '0';
    setTimeout(() => {
      res();
      currentPopover.style.scale = '1';
      currentPopover.style.opacity = '1';
    }, 200);
  })
}

async function showTutorial() {
  currentPopover.style.transform = 'translateY(-210px)'
  await hideShowPopover();
  currentPopover.innerHTML = `
  <btextm style="width: 100%; text-align: center; display: block; font-family: 'Modern'; font-size: 30px;">Introducing... the hexagon!</btextm>
    <div class="flexbox" style="margin-top: 20px; position: absolute; width: 100%;">
    <div style="width: 400px; height: 400px; margin: auto; margin-top: 10px; margin-bottom: 10px; background: url('../Assets/Playfield/frame.svg'); background-size: cover;">
    </div>
    </div>
    <div style="width: 100%; text-align: center; display: block; margin-top: 450px;">We split your judgement bar into six segments. Notes come in from the center to the outside.<br>
    To hit them, point your right or left joystick at them and hit one of the shoulder buttons on the same side as the stick</div>
    <btn style="margin-top: 10px; width: fit-content; margin: auto; margin-top: 20px;" class="controller_selectable" id="tutorialProceedButton" onclick="startShowingNotes();">Tell me more..</btn>
  `
}

async function startShowingNotes() {
  currentPopover.style.transform = 'translateY(-240px)';
  await hideShowPopover();
  currentPopover.innerHTML = `
    <div class="flexbox" style="margin-top: 76px;">
    <div style="width: 400px; height: 400px; margin: auto; margin-top: 10px; margin-bottom: 10px; background: url('../Assets/Playfield/frame.svg'); background-size: cover;">
      <div style="width: 100px; height: 100%; margin: auto; rotate: 30deg;">
        <div id="noteForDemonstration" style="width: 100%; height: 100%; background-image: url('../Assets/Headers/Note.svg'); background-repeat: no-repeat; animation: noteDemonstration infinite 2s linear;"></div>
      </div>
    </div>
    <div class="flexbox" style="position: absolute; animation: infinite 2s linear; translate: 0px 100px; width: 200px; height: 200px; border: solid 10px white; border-radius: 100%; opacity: 0.5; margin-top: auto; margin-bottom: auto;"><div id="stickForDemonstration" style="width: 160px; height: 160px; background: #FFFFFF60; border-radius: 100%; margin: auto; animation: noteDemonstrationStick infinite 2s linear;" class="flexbox"><btextm style="display: block; margin: auto; text-align: center;">L/R<br>Stick</btextm></div></div>
    <div class="flexbox" id="triggerForDemonstration" style="position: absolute; animation: noteDemonstrationTrigger infinite 2s linear; backdrop-filter: blur(12px); z-index: 100; translate: 110px -20px; rotate: 30deg; width: 230px; height: 50px; border: solid 10px white; border-radius: 10px; opacity: 0.7; margin-top: auto; margin-bottom: auto;"><btextm style="display: block; margin: auto; text-align: center;">RB/RT/LB/LT</btextm></div>
    </div>
    <btextm style="width: 100%; text-align: center; display: block; font-family: 'Modern'; font-size: 30px;" id="noteType">Standard Notes</btextm>
    <div id="noteTypeExplanation" style="width: 100%; text-align: center; display: block;">To hit a note, point one of your joysticks at it and hit the shoulder button on the same side as the stick.<br>
    Check settings for mouse & keyboard config.
    
    </div>
    <btn class="controller_selectable" id="tutorialProceedButton" onclick="proceedTutorialFromHexagon();">Next</btn>
  `
}

async function proceedTutorialFromHexagon() {
  await hideShowPopover();
  document.getElementById('tutorialProceedButton').onclick = () => {
    proceedTutorialFromFlick()
  }

  document.getElementById('noteForDemonstration').style.backgroundImage = "url('../Assets/Headers/Flick Negative.svg')";
  document.getElementById('noteForDemonstration').style.animationName = "noteDemonstrationFlick";
  document.getElementById('stickForDemonstration').style.animationName = "stickDemonstrationFlick";
  document.getElementById('triggerForDemonstration').style.animationName = "flickDemonstrationTrigger";

  document.getElementById('noteType').innerHTML = "Flick Notes";
  document.getElementById('noteTypeExplanation').innerHTML = `
  To flick a note, point one of your joysticks at it and hold the shoulder button on the same side as the stick. Follow its direction once held.
  `;

}

async function proceedTutorialFromFlick() {
  await hideShowPopover();
  document.getElementById('tutorialProceedButton').onclick = async () => {
    await hideShowPopover();
    currentPopover.remove();
    elementsRemovedForTutorial.forEach((el) => el.classList.add('controller_selectable'));
    document.getElementById('buttons-container').style.opacity = ''
    document.getElementById('logo').style.opacity = ''
    dismissContent("welcome");
  }

  document.getElementById('noteForDemonstration').style.backgroundImage = "url('../Assets/Headers/Frame.svg')";
  document.getElementById('noteForDemonstration').style.animationName = "holdDemonstration";

  document.getElementById('triggerForDemonstration').style.animationName = "holdDemonstrationTrigger";

  document.getElementById('stickForDemonstration').style.animationName = "noteDemonstrationStick";

  document.getElementById('noteType').innerHTML = "Hold Notes";
  document.getElementById('noteTypeExplanation').innerHTML = `
  To hold a note, point one of your joysticks at it and hold the shoulder button on the same side as your stick of choice. Release when it reaches its end.
  `;
}

function openSettings() {
  require('electron').ipcRenderer.send('openSettings');
}

if (!isDismissed("welcome")) playTutorial();