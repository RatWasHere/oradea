const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const app = electron.app;
const steamworks = require('steamworks.js');
var client;
var workshop;
try {
  var client = steamworks.init(3994990);
  var workshop = client.workshop;
} catch (error) { }

let window;
app.on('ready', () => {
  window = new BrowserWindow({
    width: 1000,
    height: 800,
    minHeight: 800,
    minWidth: 1000,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false
    },
  });

  electron.ipcMain.on('openWorkshop', () => {
    let width = 900;
    let height = 600;
    let workshop = new BrowserWindow({
      width: width,
      height: height,
      maxWidth: width,
      maxHeight: height,
      minWidth: width,
      minHeight: height,
      resizable: false,
      frame: false,
      modal: true,
      parent: window,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        spellcheck: false
      }
    });
    workshop.loadFile('./Workshop/workshop.html');
    workshop.focus();
  })


  window.loadFile('./Playfield/playfield.html');

  window.once('ready-to-show', () => {
    window.webContents.openDevTools();
  });
});
const { dialog } = require('electron')

electron.ipcMain.on('uploadFolder', () => {
  electron.dialog.showOpenDialog(window, {
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths[0]) {
      console.log(result.filePaths[0])
      workshop.createItem(3994990).then((item) => {
        console.log("item created", {
          changeNote: "Add in cotent",
          visibility: workshop.UgcItemVisibility.Public,
          previewPath: result.filePaths[0] + '\\cover.jpg',
          contentPath: result.filePaths[0],
          title: "Item",
          description: "No description has been provided for this item",
        })
        workshop.updateItem(item.itemId, {
          changeNote: "Add in cotent",
          visibility: workshop.UgcItemVisibility.Public,
          previewPath: result.filePaths[0].replaceAll('\\', '/') + '/cover.jpg',
          contentPath: result.filePaths[0].replaceAll('\\', '/'),
          title: "Item",
          description: "No description has been provided for this item",
        }).then((i) => {
          console.log(i.itemId)
        }).catch(console.error);
      }).catch(console.error);
      console.log(result.filePaths[0]);
      window.webContents.send('uploadFolder', result.filePaths[0]);
    }
  })
})