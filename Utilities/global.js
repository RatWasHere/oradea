const fs = require('fs');
function dismissContent(content) {
  if (!fs.existsSync('./Dismissed Content')) {
    fs.mkdirSync('./Dismissed Content')
  }

  fs.writeFileSync(`./Dismissed Content/${content}`, '1')
}
function isDismissed(content) {
  return fs.existsSync(`./Dismissed Content/${content}`, () => { })
}

window.onresize = () => {
  window.innerWidth;
  window.innerHeight;
}

document.addEventListener('keydown', (e) => {
  if (e.key == 'Tab') return e.preventDefault();
})

const ipcRenderer = require('electron').ipcRenderer;

let hideTimeout;

function hideCursor() {
  document.body.style.cursor = 'none';
}

function showCursor() {
  document.body.style.cursor = 'default';
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(hideCursor, 5000); // 5 seconds of inactivity
}

// any mouse movement resets the timer
window.addEventListener('mousemove', showCursor);

// start the countdown right away
hideTimeout = setTimeout(hideCursor, 3000);

var settings = {};

try {
  settings = JSON.parse(fs.readFileSync('./Config/settings', 'utf8'))
} catch (error) {
  fs.writeFileSync('./Config/settings', `{}`)
}

function saveSettings() {
  fs.writeFileSync('./Config/settings', JSON.stringify(settings, null, 2))
}

function getSetting(label, defaultValue) {
  return (settings[label] != undefined ? settings[label] : defaultValue);
}