const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const app = electron.app;

app.on('ready', () => {
  let window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  window.loadFile('index.html');
  
  window.once('ready-to-show', () => {
    window.webContents.openDevTools();
  });
});