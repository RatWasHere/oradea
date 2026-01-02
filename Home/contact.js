let currentStage = 0;

let stages = [
  {
    text: `
      Before continuing, please consult the terms below.
    `,
    subtext: "This game contains flashing lights. Epilepsy warning.",
    options: [
      {
        text: 'Terms of Service',
        onclick: () => { ipcRenderer.send('tos'); }
      },
      {
        text: 'Privacy Policy',
        onclick: () => { ipcRenderer.send('privacy'); }
      },
      {
        text: 'Agree and Continue',
        onclick: () => { showStage(1); }
      }
    ]
  },
  {
    text: "Welcome",
    subtext: "Before you play, we recommend you go through this intro.<br><span style='font-size: 15px'>The game is a new concept, but we've explained it shortly (~2min).</span>",
    options: [
      {
        text: 'Skip',
        onclick: () => { location.href = './homescreen.html' }
      },
      {
        text: 'Continue',
        onclick: () => { showStage(2); }
      }
    ]
  },
  {
    text: `How do you want to play?`,
    subtext: `We'll adjust your settings based on this. This can be changed anytime later on.`,
    options: [
      {
        text: 'Keyboard',
        onclick: () => {
          settings.input_mode = 'keyboard';
          location.href = './homescreen.html'
          saveSettings();
          showStage(3);
        }
      },
      {
        text: 'Controller (Recommended)',
        onclick: () => {
          settings.input_mode = 'buttons';
          saveSettings();
          showStage(3);
        }
      },
      {
        text: 'Touchscreen (Recommended)',
        onclick: () => {
          settings.input_mode = 'touch';
          saveSettings();
          showStage(3);
        }
      }
    ]
  },
  {
    text: `Tutorial`,
    subtext: `Please watch the following video`,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(2); }
      },
      {
        text: 'Next',
        onclick: () => {
          if (settings.input_mode == 'buttons') {
            showStage(4);
          } else {
            showStage(5);
          }
        }
      }
    ],
    get additionalHTML() {
      return `
        <video src="./${settings.input_mode}_tutorial.mp4" style="max-width: 1000px; width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto;" autoplay="true"></video>
      `
    }
  },
  {
    text: `Interacting with the interface`,
    subtext: `via Controller`,
    additionalHTML: `
      <video src="./controller_nav.mp4" style="max-width: 1000px; width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto;" autoplay="true"></video>
    `,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(3); }
      },
      {
        text: 'Next',
        onclick: () => {
          showStage(5);
        }
      }
    ]
  },
  {
    text: `Do you like hit sounds?`,
    subtext: `These are the sounds played when you interact with notes. They typically help new players time hits better.`,
    options: [
      {
        text: 'No',
        onclick: () => {
          settings.sfx_volume = 0;
          saveSettings();
          showStage(6);
        }
      },
      {
        text: 'Somewhat',
        onclick: () => {
          settings.sfx_volume = 50;
          showStage(6);
        }
      },
      {
        text: 'Absolutely',
        onclick: () => {
          settings.sfx_volume = 100;
          showStage(6);
        }
      }
    ]
  },
  {
    text: `How experienced are you in rhythm games?`,
    subtext: `Your choice will affect note speed. It can be changed anytime later on in settings.`,
    options: [
      {
        text: 'Beginner',
        onclick: () => {
          settings.note_speed = 6;
          saveSettings();
          showStage(7);
        }
      },
      {
        text: 'Intermediate',
        onclick: () => {
          settings.note_speed = 8;
          showStage(7);
        }
      },
      {
        text: 'Expert',
        onclick: () => {
          settings.note_speed = 11;
          showStage(7);
        }
      }
    ]
  },
  {
    text: `Would you like to calibrate your timing?`,
    subtext: `We highly recommend you do. You can do this anytime later on in settings.`,
    options: [
      {
        text: 'No',
        onclick: () => {
          showStage(8);
        }
      },
      {
        text: 'Yes',
        onclick: () => {
          ipcRenderer.send('openSettings', { calibrate: true });
          showStage(8);
        }
      }
    ]
  },
  {
    text: `Choose your design`,
    subtext: `We offer more note designs in settings.`,
    additionalHTML: `
    <br>
    <div class="flexbox">
      <div class="flexbox" style="margin-right: 10px;">
        <div>
          <div style="width: 75px; height: 75px; background: url('../Assets/Headers/geometrical/Note.svg'); background-size: cover;"></div>
          <div style="width: 75px; height: 75px; background: url('../Assets/Headers/geometrical/Note Holdable.svg'); background-size: cover;"></div>
          <div style="width: 75px; height: 75px; background: url('../Assets/Headers/geometrical/Note Golden.svg'); background-size: cover;"></div>
        </div>
        <div>
          <div style="width: 75px; height: 37.5px; background: url('../Assets/Headers/geometrical/Top.svg'); background-size: cover;"></div>
          <div style="width: 75px; height: 150px; background: url('../Assets/Headers/geometrical/Frame.svg'); background-size: 75px 75px;"></div>
          <div style="width: 75px; height: 37.5px; background: url('../Assets/Headers/geometrical/Bottom.svg'); background-size: cover;"></div>
        </div>
      </div>

      <div class="flexbox" style="margin-left: 70px;">
        <div>
          <div style="width: 75px; height: 75px; background: url('../Assets/Headers/thin/Note.svg'); background-size: cover;"></div>
          <div style="width: 75px; height: 75px; background: url('../Assets/Headers/thin/Note Holdable.svg'); background-size: cover;"></div>
          <div style="width: 75px; height: 75px; background: url('../Assets/Headers/thin/Note Golden.svg'); background-size: cover;"></div>
        </div>
        <div style="margin-left: 30px;">
          <div style="width: 75px; height: 37.5px; background: url('../Assets/Headers/thin/Top.svg'); background-size: cover;"></div>
          <div style="width: 75px; height: 149.5px; background: url('../Assets/Headers/thin/Frame.svg'); background-size: 75px 75px;"></div>
          <div style="width: 75px; height: 37.5px; background: url('../Assets/Headers/thin/Bottom.svg'); background-size: cover;"></div>
        </div>
      </div>
    </div>
    `,
    options: [
      {
        text: 'Geometrical',
        customStyle: `margin-right: 100px; translate: -45px 0px;`,
        onclick: () => {
          settings.noteDesign = 'geometrical';
          settings.holdNoteDesign = 'geometrical';
          saveSettings();
          showStage(9);
        }
      },
      {
        text: 'Thin',
        onclick: () => {
          settings.noteDesign = 'thin';
          settings.holdNoteDesign = 'thin';
          saveSettings();
          showStage(9);
        }
      }
    ]
  },
  {
    text: `Did you understand everything so far?`,
    subtext: `If you haven't, we'll restart the tutorial.`,
    options: [
      {
        text: 'No',
        onclick: () => {
          showStage(0);
        }
      },
      {
        text: 'Yes',
        onclick: () => {
          location.href = './homescreen.html'
        }
      }
    ]
  }
]


async function showStage(number) {
  currentStage = number;
  let text = document.getElementById('text');
  let options = document.getElementById('options');
  await new Promise((res) => {
    document.getElementById('https://discord.com/channels/1247604511107715182/1247611086882996408/1450999425370689627').style.opacity = '0'
    setTimeout(() => {
      res()
    }, 450);
  })
  options.innerHTML = ``;

  stages[number].options.forEach((option, index) => {
    let button = document.createElement('btn');
    button.classList.add('button', 'controller_selectable');
    button.innerHTML = option.text;
    currentEl = button;
    button.onclick = () => {
      option.onclick();
    }
    if (option.customStyle) {
      button.style = option.customStyle;
    }
    options.appendChild(button);
  });

  if (stages[number].additionalHTML) {
    document.getElementById('additional').innerHTML = stages[number].additionalHTML;
  } else {
    document.getElementById('additional').innerHTML = '';
  }

  text.innerHTML = stages[number].text;

  if (stages[number].subtext) {
    document.getElementById('subtext').innerHTML = stages[number].subtext;
  } else {
    document.getElementById('subtext').innerHTML = '';
  }

  document.getElementById('https://discord.com/channels/1247604511107715182/1247611086882996408/1450999425370689627').style.opacity = 1
}

showStage(0);
let audio = new Audio(`../Assets/Misc/Ethereal.mp3`);
audio.play();
audio.play().then(() => audio.volume = 0.05);
