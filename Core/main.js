const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const app = electron.app;

app.on('ready', () => {
  let window = new BrowserWindow({
    width: 1000,
    height: 800,
    minHeight: 800,
    minWidth: 1000,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  window.loadFile('./Playfield/playfield.html');
  
  window.once('ready-to-show', () => {
    window.webContents.openDevTools();
  });
});