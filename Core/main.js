const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const app = electron.app;
const steamworks = require('steamworks.js');
var client;
var workshop;
try {
  var client = steamworks.init(3994990);
  var workshop = client.workshop;
  // client.utils.showFloatingGamepadTextInput(client.utils.FloatingGamepadTextInputMode.SingleLine, 'Search Workshop', '', 256, false);
} catch (error) { }

let window;
app.on('ready', () => {
  window = new BrowserWindow({
    width: 1000,
    height: 800,
    minHeight: 800,
    minWidth: 1000,
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false,
    },
  });
  window.setMenuBarVisibility(false);
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
      movable: false,
      center: true,
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
    setTimeout(() => {
      workshop.focus();
    }, 100);
    electron.ipcMain.once('closeWorkshop', () => {
      window.focus()
      workshop.destroy();
    });

    electron.ipcMain.on('show_workshop_keyboard', () => {
      let position = workshop.getBounds();
      client.utils.showFloatingGamepadTextInput(client.utils.FloatingGamepadTextInputMode.SingleLine, position.x, position.y, position.width, position.height / 2);
    })
  });

    electron.ipcMain.on('openSettings', () => {
    let width = 900;
    let height = 600;
    let settings = new BrowserWindow({
      width: width,
      height: height,
      maxWidth: width,
      maxHeight: height,
      minWidth: width,
      minHeight: height,
      resizable: false,
      movable: false,
      center: true,
      frame: false,
      modal: true,
      parent: window,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        spellcheck: false
      }
    });
    let hexapreview = new BrowserWindow({
      width: width,
      height: height,
      resizable: false,
      movable: false,
      center: true,
      frame: false,
      transparent: true,
      thickFrame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        spellcheck: false
      },
      hiddenInMissionControl: true,
      fullscreen: true
    });
    hexapreview.loadFile('./Settings/hexapreview.html');
    hexapreview.setIgnoreMouseEvents(true);
    hexapreview.hide();
    electron.ipcMain.on('updateHexagon', (c, v) => {
      hexapreview.webContents.send('updateHexagon', v);
      hexapreview.focusOnWebView();
      hexapreview.show();
    });
    electron.ipcMain.on('doneUpdatingHexagon', () => {
      hexapreview.hide();
    });
    settings.loadFile('./Settings/settings.html');
    setTimeout(() => {
      settings.focus();
    }, 100);
    electron.ipcMain.once('closeSettings', () => {
      window.focus()
      settings.destroy();
      hexapreview.destroy();
    });

    electron.ipcMain.on('show_settings_keyboard', () => {
      let position = settings.getBounds();
      client.utils.showFloatingGamepadTextInput(client.utils.FloatingGamepadTextInputMode.SingleLine, position.x, position.y, position.width, position.height / 2);
    })
  });



  window.loadFile('./Home/homescreen.html');

  window.once('ready-to-show', () => {
    // window.webContents.openDevTools();
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
});


// const ds = require('../Utilities/dualsense.js');

// setTimeout(() => {
//     const device = ds.connect();
// if (device) {
//   // Max resistance on right trigger
//   ds.setTrigger(device, 'right', 1, [0, 255]);

//   // Red lightbar
//   ds.setLED(device, 255, 0, 0);

//   // Show player 1 LED
//   ds.setPlayerLEDs(device, 1);

// }

// }, 2000);
// setTimeout(() => {
//   const HID = require('node-hid');
//   console.log('Finding DualSense...');

//   function findAllDualSense() {
//     const devices = HID.devices();
//     return devices.filter(d =>
//       d.vendorId === 0x054C &&
//       (d.productId === 0x0CE6 || d.productId === 0x0DF2)
//     );
//   }

//   function setTriggerResistance(device, trigger, mode, params) {
//     const report = Buffer.alloc(48);
//     report[0] = 0x02;
//     report[1] = 0xFF;
//     report[2] = 0xF7;

//     const offset = trigger === 'left' ? 11 : 22;
//     report[offset] = mode;
//     for (let i = 0; i < params.length; i++) {
//       report[offset + 1 + i] = params[i];
//     }

//     console.log('Attempting write with .write()...');
//     try {
//       device.write(Array.from(report));
//       console.log('✅ .write() successful!');
//       return true;
//     } catch (e1) {
//       console.log('❌ .write() failed:', e1.message);

//       console.log('Attempting with .sendFeatureReport()...');
//       try {
//         device.sendFeatureReport(Array.from(report));
//         console.log('✅ .sendFeatureReport() successful!');
//         return true;
//       } catch (e2) {
//         console.log('❌ .sendFeatureReport() failed:', e2.message);

//         // Try without report ID
//         console.log('Attempting without report ID...');
//         try {
//           device.sendFeatureReport(Array.from(report.slice(1)));
//           console.log('✅ Write without ID successful!');
//           return true;
//         } catch (e3) {
//           console.log('❌ All methods failed');
//           throw e1;
//         }
//       }
//     }
//   }

//   setTimeout(() => {
//     const devices = findAllDualSense();
//     console.log(`Found ${devices.length} DualSense device(s)`);

//     if (devices.length === 0) {
//       console.error('No DualSense found!');
//       return;
//     }

//     // Log all devices
//     devices.forEach((d, i) => {
//       console.log(`\nDevice ${i}:`);
//       console.log('  Path:', d.path);
//       console.log('  Interface:', d.interface);
//       console.log('  Usage:', d.usage);
//       console.log('  UsagePage:', d.usagePage);
//       console.log('  Product:', d.product);
//     });

//     // Try EACH device path
//     let workingDevice = null;

//     for (let i = 0; i < devices.length; i++) {
//       const deviceInfo = devices[i];
//       console.log(`\n--- Trying device ${i} (${deviceInfo.path}) ---`);

//       try {
//         const device = new HID.HID(deviceInfo.path);
//         console.log('Device opened successfully');

//         // Try to write
//         if (setTriggerResistance(device, 'right', 0x01, [0x00, 0xFF])) {
//           console.log('🎉 THIS DEVICE WORKS!');
//           workingDevice = device;

//           // Keep it active for 5 seconds

//           break; // Stop trying other devices
//         } else {
//           device.close();
//         }

//       } catch (error) {
//         console.log(`Failed to open device ${i}:`, error.message);
//       }
//     }

//     if (!workingDevice) {
//       console.error('\n❌ No working device found!');
//       console.error('Possible issues:');
//       console.error('  1. Another program is using the controller (Steam, DS4Windows, etc)');
//       console.error('  2. Need to run as Administrator (Windows)');
//       console.error('  3. Controller is in Bluetooth mode (try USB cable)');
//     }

//   }, 2000);

// }, 1000);

// steamworks.electronEnableSteamOverlay();
