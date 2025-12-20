let currentStage = 0;

let stages = [
  {
    text: `
      T
    `,
    options: [
      {
        text: 'Terms of Service',
        onclick: () => { }
      },
      {
        text: 'Privacy Policy',
        onclick: () => { }
      },
      {
        text: 'Agree and Continue',
        onclick: () => { showStage(1); }
      }
    ]
  },
  {
    text: `How do you want to play?`,
    subtext: `We'll adjust your settings based on this. This can be changed anytime later on. The tutorial shown will depend on this.`,
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
          showStage(2);
        }
      },
      {
        text: 'Touchscreen (Recommended)',
        onclick: () => {
          settings.input_mode = 'touch';
          saveSettings();
          showStage(2);
        }
      }
    ]
  },
  {
    text: `Tutorial`,
    options: [
      {
        text: 'Understood',
        onclick: () => { showStage(4); }
      }
    ],
    get additionalHTML() {
      return `
        <video src="./${settings.input_mode}_tutorial.mp4" style="max-width: 1000px; width: 80vw; aspect-ratio: 16/9; display: block; border-radius: 10px; margin: auto;" autoplay="true"></video>
      `
    }
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
    button.onclick = () => {
      option.onclick();
    }
    options.appendChild(button);
  });

  if (stages[number].additionalHTML) {
    document.getElementById('additional').innerHTML = stages[number].additionalHTML;
  }

  text.innerHTML = stages[number].text;

  if (stages[number].subtext) {
    document.getElementById('subtext').innerHTML = stages[number].subtext;
  } else {
    document.getElementById('subtext').innerHTML = '';
  }

  document.getElementById('https://discord.com/channels/1247604511107715182/1247611086882996408/1450999425370689627').style.opacity = 1
}

showStage(1)