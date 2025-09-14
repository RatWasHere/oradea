const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
let settingsWindow;

function openSettings() {
  settingsWindow = document.createElement('div');
  settingsWindow.classList.add('settings');
  document.body.appendChild(settingsWindow)
}