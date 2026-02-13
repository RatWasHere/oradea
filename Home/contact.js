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
        onclick: () => { dismissContent('welcome'); showStage(15); }
      }
    ]
  },
  {
    text: "Welcome",
    subtext: "Before you play, we recommend you go through this intro.<br><span style='font-size: 15px'>The game is a new concept, but we've explained it shortly (~3min).</span>",
    options: [
      {
        text: 'Skip',
        onclick: () => {
          document.getElementById('https://discord.com/channels/1247604511107715182/1247611086882996408/1450999425370689627').style.opacity = '0'; setTimeout(() => {
            location.href = './homescreen.html'
          }, 400);
        }
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
    text: ``,
    subtext: ``,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(2); }
      },
      {
        text: 'Next',
        onclick: () => {
            showStage(4);
        }
      }
    ],
    get additionalHTML() {
      return `
        <div src="" style="max-width: 1000px; background: url('../Assets/Tutorial/${settings.input_mode} step 1.png'); width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto; background-size: cover;"></div>
      `
    }
  },
    {
    text: ``,
    subtext: ``,
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
    ],
    get additionalHTML() {
      return `
        <div src="" style="max-width: 1000px; background: url('../Assets/Tutorial/${settings.input_mode} step 2.png'); width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto; background-size: cover;"></div>
      `
    }
  },
    {
    text: ``,
    subtext: ``,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(4); }
      },
      {
        text: 'Next',
        onclick: () => {
            showStage(6);
        }
      }
    ],
    get additionalHTML() {
      return `
        <div src="" style="max-width: 1000px; background: url('../Assets/Tutorial/${settings.input_mode} step 3.png'); width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto; background-size: cover;"></div>
      `
    }
  },
    {
    text: ``,
    subtext: ``,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(5); }
      },
      {
        text: 'Next',
        onclick: () => {
            showStage(7);
        }
      }
    ],
    get additionalHTML() {
      return `
        <div src="" style="max-width: 1000px; background: url('../Assets/Tutorial/${settings.input_mode} step 4.png'); width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto; background-size: cover;"></div>
      `
    }
  },
    {
    text: ``,
    subtext: ``,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(6); }
      },
      {
        text: 'Next',
        onclick: () => {
            showStage(8);
        }
      }
    ],
    get additionalHTML() {
      return `
        <div src="" style="max-width: 1000px; background: url('../Assets/Tutorial/${settings.input_mode} step 5.png'); width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto; background-size: cover;"></div>
      `
    }
  },
    {
    text: ``,
    subtext: ``,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(7); }
      },
      {
        text: 'Next',
        onclick: () => {
          if (settings.input_mode == 'buttons') {
            showStage(9);
          } else {
            showStage(10);
          }
        }
      }
    ],
    get additionalHTML() {
      return `
        <div src="" style="max-width: 1000px; background: url('../Assets/Tutorial/${settings.input_mode} step 6.png'); width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto; background-size: cover;"></div>
      `
    }
  },
  {
    text: ``,
    subtext: ``,
    additionalHTML: `
      <video src="./controller_nav.webm" style="max-width: 1000px; width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto;" autoplay="true"></video>
    `,
    options: [
      {
        text: 'Back',
        onclick: () => { showStage(8); }
      },
      {
        text: 'Next',
        onclick: () => {
          showStage(10);
        }
      }
    ]
  },
  {
    text: `Do you like hit sounds?`,
    subtext: `These are the sounds played when you interact with notes. They typically help players time hits better.`,
    options: [
      {
        text: 'Preview',
        onclick: () => {
          let audio = new Audio('../Assets/hit_normal.mp3');
          audio.play();
        }
      },
      {
        text: 'No',
        onclick: () => {
          settings.sfx_volume = 0;
          saveSettings();
          showStage(11);
        }
      },
      {
        text: 'Somewhat',
        onclick: () => {
          settings.sfx_volume = 50;
          showStage(11);
        }
      },
      {
        text: 'Absolutely',
        onclick: () => {
          settings.sfx_volume = 100;
          showStage(11);
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
          showStage(12);
        }
      },
      {
        text: 'Intermediate',
        onclick: () => {
          settings.note_speed = 10;
          showStage(12);
        }
      },
      {
        text: 'Expert',
        onclick: () => {
          settings.note_speed = 12.5;
          showStage(12);
        }
      },
      {
        text: 'Insane',
        onclick: () => {
          settings.note_speed = 16;
          showStage(12);
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
          showStage(13);
        }
      },
      {
        text: 'Yes',
        onclick: () => {
          ipcRenderer.send('openSettings', { calibrate: true });
          showStage(13);
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
          showStage(14);
        }
      },
      {
        text: 'Thin',
        onclick: () => {
          settings.noteDesign = 'thin';
          settings.holdNoteDesign = 'thin';
          saveSettings();
          showStage(14);
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
          document.getElementById('https://discord.com/channels/1247604511107715182/1247611086882996408/1450999425370689627').style.opacity = '0'; setTimeout(() => {
            location.href = './homescreen.html'
          }, 400);
        }
      }
    ]
  },
  {
    text: "Message from the developer",
    subtext: `Hi! Thank you for downloading the demo. This is just a small bit of the full game.<br>
    The full game will have a lot more content. We will be adding new songs to the demo occasionally!<br>
    `,
    options: [
      {
        text: 'Continue',
        onclick: () => { showStage(1); }
      },
    ]
  },
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
