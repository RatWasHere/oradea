const { BrowserWindow, app, screen, ipcMain, dialog, globalShortcut } = require('electron');
const fs = require('fs');

// Configure app command line switches
[
  'no-sandbox',
  'disable-setuid-sandbox',
  'disable-http-cache',
  'disable-background-timer-throttling',
  'disable-renderer-backgrounding',
  'disable-component-extensions-with-background-pages',
  'disable-backgrounding-occluded-windows'
].forEach(switchName => app.commandLine.appendSwitch(switchName));


app.commandLine.appendSwitch('js-flags', '--expose-gc');

// Global variables
let mainWindow;
let settingsWindow;
let hexapreviewWindow;
let client;
let workshop;

// Steamworks initialization (disabled for now)
try {
  // const steamworks = require('steamworks.js');
  // client = steamworks.init(3994990);
  // workshop = client.workshop;
} catch (error) { }

// ==================== Window Management ====================

/**
 * Creates and manages a new window with common settings
 * @param {Object} config Configuration object
 * @returns {BrowserWindow} The created window
 */
function createWindow(config) {
  const {
    file,
    width = 900,
    height = 600,
    minHeight = 100,
    minWidth = 100,
    resizable = false,
    modal = false,
    parent = mainWindow,
    transparent = false,
    alwaysOnTop = false,
    frame = false,
    movable = false,
    onClose = null,
    onReady = null
  } = config;

  const windowConfig = {
    width,
    height,
    resizable,
    movable,
    center: true,
    frame,
    modal,
    minWidth,
    minHeight,
    transparent,
    alwaysOnTop,
    ...(parent && { parent }),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false,
      sandbox: false
    }
  };

  if (!resizable) {
    windowConfig.maxWidth = width;
    windowConfig.maxHeight = height;
    windowConfig.minWidth = width;
    windowConfig.minHeight = height;
  }

  const newWindow = new BrowserWindow(windowConfig);

  if (file) {
    newWindow.loadFile(file);
  }

  if (onReady) {
    newWindow.once('ready-to-show', onReady);
  }

  if (onClose) {
    newWindow.on('close', onClose);
  }

  return newWindow;
}

app.on('ready', () => {
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync('./Config/settings', 'utf8'));
  } catch (error) {
    settings = {};
  }
  // globalShortcut.register('Control+Shift+I', () => {
  //   // When the user presses Ctrl + Shift + I, this function will get called
  //   // You can modify this function to do other things, but if you just want
  //   // to disable the shortcut, you can just return false
  //   return false;
  // });

  // Create main window
  mainWindow = createWindow({
    file: './Home/photoepilepsy.html',
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    frame: true,
    parent: null
  });

  ipcMain.on('quit_app', () => {
    app.quit();
  })

  const iconPath = './Assets/Glyphs/Logo.png';
  try {
    mainWindow.setIcon(iconPath);
  } catch (error) { }

  mainWindow.webContents.setFrameRate(getFrameRate(settings.frame_cap));
  mainWindow.setMenuBarVisibility(false);
  updateScreenState(settings?.screen_state, mainWindow);

  // ==================== Screen State Management ====================

  function getFrameRate(frameCap) {
    if (frameCap === 'auto' || frameCap === undefined) {
      return 60;
    } else if (frameCap === 'unlimited') {
      return 240;
    }
    return Number(frameCap);
  }

  function updateScreenState(state) {
    if (state === 'full' || state === undefined) {
      mainWindow.setFullScreen(true);
    } else if (state === 'maximized') {
      mainWindow.setFullScreen(false);
      mainWindow.maximize();
    } else if (state === 'windowed') {
      mainWindow.setFullScreen(false);
      mainWindow.unmaximize();
    }
  }

  ipcMain.on('updateScreenState', (event, state) => {
    updateScreenState(state);
  });
  // ==================== Workshop Window ====================

  ipcMain.on('openWorkshop', () => {
    let workshopWindow = createWindow({
      file: './Workshop/workshop.html',
      width: 900,
      height: 600,
      resizable: false,
      modal: true,
      frame: false,
      parent: mainWindow,
      onReady: () => workshopWindow.focus()
    });

    ipcMain.once('closeWorkshop', () => {
      mainWindow.focus();
      workshopWindow.destroy();
    });

    ipcMain.on('show_workshop_keyboard', () => {
      if (!client) return;
      const position = workshopWindow.getBounds();
      client.utils.showFloatingGamepadTextInput(
        client.utils.FloatingGamepadTextInputMode.SingleLine,
        position.x,
        position.y,
        position.width,
        position.height / 2
      );
    });
  });

  // ==================== Hexapreview Window ====================

  function createHexaPreview(force = false) {
    if (hexapreviewWindow && !force) return;

    const display = screen.getPrimaryDisplay();

    hexapreviewWindow = createWindow({
      file: './Settings/hexapreview.html',
      width: display.workArea.width,
      height: display.workArea.height,
      resizable: false,
      transparent: true,
      alwaysOnTop: true,
      frame: false,
      movable: false,
      parent: null
    });

    hexapreviewWindow.setIgnoreMouseEvents(true);
    hexapreviewWindow.hide();

    ipcMain.on('updateHexagon', (event, value) => {
      if (!hexapreviewWindow) createHexaPreview(true);
      try {
        hexapreviewWindow.webContents.send('updateHexagon', value);
        hexapreviewWindow.focusOnWebView();
        hexapreviewWindow.show();
      } catch (error) { }
    });

    ipcMain.on('doneUpdatingHexagon', () => {
      hexapreviewWindow.hide();
      mainWindow.focus();
    });
  }

  // ==================== Settings Window ====================

  ipcMain.on('openSettings', (event, options) => {
    try {
      settingsWindow = createWindow({
        file: options?.calibrate ? './Settings/calibration.html' : './Settings/settings.html',
        width: 900,
        height: 600,
        resizable: false,
        modal: true,
        alwaysOnTop: true,
        frame: false,
        parent: mainWindow,
        onReady: () => {
          settingsWindow.webContents.send('');
          settingsWindow.focus();
        },
        onClose: () => {
          try {
            hexapreviewWindow?.close();
          } catch (error) { }
          settingsWindow = null;
          hexapreviewWindow = null;
        }
      });

      settingsWindow.on('blur', () => {
        try {
          settingsWindow.focus(true);
        } catch (error) { }
      });

      createHexaPreview();

      ipcMain.once('closeSettings', () => {
        try {
          mainWindow.focus();
          settingsWindow.close();
          hexapreviewWindow?.close();
        } catch (error) { }
      });
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  });
});


ipcMain.on('performanceFix', () => {
  if (global.gc) {
    global.gc();
  }
})

// ==================== Legal Windows ====================

ipcMain.on('privacy', () => {
  const privacyWindow = createWindow({
    file: './Legal/privacy.html',
    width: 600,
    height: 600,
    resizable: false,
    modal: true,
    frame: false,
    parent: mainWindow
  });

  ipcMain.once('closePrivacy', () => {
    privacyWindow.close();
  });
});

ipcMain.on('tos', () => {
  const termsWindow = createWindow({
    file: './Legal/terms.html',
    width: 600,
    height: 600,
    resizable: false,
    modal: true,
    frame: false,
    parent: mainWindow
  });

  ipcMain.once('closeTerms', () => {
    termsWindow.close();
  });
});

// ==================== File Uploads ====================

ipcMain.on('uploadFolder', () => {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths[0]) {
      const folderPath = result.filePaths[0];

      if (workshop) {
        workshop.createItem(3994990)
          .then((item) => {
            workshop.updateItem(item.itemId, {
              changeNote: "Add in content",
              visibility: workshop.UgcItemVisibility.Public,
              previewPath: folderPath.replaceAll('\\', '/') + '/cover.jpg',
              contentPath: folderPath.replaceAll('\\', '/'),
              title: "Item",
              description: "No description has been provided for this item",
            }).then((updatedItem) => {
              console.log('Workshop item updated:', updatedItem.itemId);
            }).catch(console.error);
          }).catch(console.error);
      }

      mainWindow.webContents.send('uploadFolder', folderPath);
    }
  });
});

// ==================== DualSense Controller (Disabled) ====================
// Uncomment below to enable DualSense controller support

// const ds = require('../Utilities/dualsense.js');
// const HID = require('node-hid');
//
// setTimeout(() => {
//   const device = ds.connect();
//   if (device) {
//     ds.setTrigger(device, 'right', 1, [0, 255]);
//     ds.setLED(device, 255, 0, 0);
//     ds.setPlayerLEDs(device, 1);
//   }
// }, 2000);

