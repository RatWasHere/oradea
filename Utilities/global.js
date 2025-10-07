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