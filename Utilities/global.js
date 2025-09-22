const fs = require('fs');
function dismissContent(content) {
  if (!settingsFS.existsSync('./Dismissed Content')) {
    settingsFS.mkdirSync('./Dismissed Content')
  }

  settingsFS.writeFileSync(`./Dismissed Content/${content}`, '1')
}
function isDismissed(content) {
  return settingsFS.existsSync(`./Dismissed Content/${content}`, () => { })
}

window.onresize = () => {
  window.innerWidth;
  window.innerHeight;
}

document.addEventListener('keydown', (e) => {
  if (e.key == 'Tab') return e.preventDefault();
})

const ipcRenderer = require('electron').ipcRenderer;