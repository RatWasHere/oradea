/**
 * DualSense Controller API
 * Simple functions for controlling PS5 DualSense features via USB
 * Requires: npm install node-hid
 * 
 * Usage:
 *   const ds = require('./dualsense-api');
 *   const device = ds.connect();
 *   ds.setTrigger(device, 'right', 1, [0, 255]);
 *   ds.setLED(device, 255, 0, 0);
 *   ds.disconnect(device);
 */

const HID = require('node-hid');

/**
 * Connect to DualSense controller (USB only)
 * @returns {object|null} HID device or null if not found
 */
function connect() {
  try {
    const devices = HID.devices();
    const dualsense = devices.find(d => 
      d.vendorId === 1356 && d.productId === 3302
    );
    
    if (!dualsense) {
      console.error('DualSense not found');
      return null;
    }
    
    const device = new HID.HID(dualsense.path);
    console.log('DualSense connected');
    return device;
  } catch (error) {
    console.error('Connection failed:', error.message);
    return null;
  }
}

/**
 * Disconnect from controller
 * @param {object} device - HID device
 */
function disconnect(device) {
  if (device) {
    reset(device);
    device.close();
    console.log('DualSense disconnected');
  }
}

/**
 * Set trigger resistance
 * @param {object} device - HID device
 * @param {string} trigger - 'left' or 'right'
 * @param {number} mode - 0=off, 1=continuous, 2=section
 * @param {number[]} params - Parameters based on mode
 * 
 * Mode 0 (off): []
 * Mode 1 (continuous): [startPosition, force]
 *   - startPosition: 0-255 (where resistance starts)
 *   - force: 0-255 (strength, 255=max)
 * Mode 2 (section): [startPosition, endPosition, force]
 *   - Creates a "wall" between start and end positions
 * 
 * Examples:
 *   setTrigger(device, 'right', 0, []);              // Off
 *   setTrigger(device, 'right', 1, [0, 255]);        // Max resistance
 *   setTrigger(device, 'right', 1, [0, 128]);        // Medium resistance
 *   setTrigger(device, 'right', 2, [48, 255, 255]);  // Gun trigger click
 */
function setTrigger(device, trigger, mode, params = []) {
  if (!device) return false;

  const report = Buffer.alloc(48);
  report[0] = 2;   // Report ID
  report[1] = 255; // Enable flags
  report[2] = 247; // More flags

  const offset = trigger === 'left' ? 11 : 22;
  report[offset] = mode;
  
  for (let i = 0; i < params.length && i < 10; i++) {
    report[offset + 1 + i] = params[i];
  }

  try {
    device.write(Array.from(report));
    return true;
  } catch (error) {
    console.error('Write failed:', error.message);
    return false;
  }
}

/**
 * Set lightbar color
 * @param {object} device - HID device
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * 
 * Examples:
 *   setLED(device, 255, 0, 0);    // Red
 *   setLED(device, 0, 255, 0);    // Green
 *   setLED(device, 0, 0, 255);    // Blue
 *   setLED(device, 255, 255, 0);  // Yellow
 *   setLED(device, 255, 0, 255);  // Magenta
 */
function setLED(device, r, g, b) {
  if (!device) return false;

  const report = Buffer.alloc(48);
  report[0] = 2;
  report[1] = 255;
  report[2] = 247;
  
  // LED colors at bytes 45, 46, 47
  report[45] = Math.max(0, Math.min(255, r));
  report[46] = Math.max(0, Math.min(255, g));
  report[47] = Math.max(0, Math.min(255, b));

  try {
    device.write(Array.from(report));
    return true;
  } catch (error) {
    console.error('Write failed:', error.message);
    return false;
  }
}

/**
 * Set player indicator LEDs (5 white LEDs around touchpad)
 * @param {object} device - HID device
 * @param {number} pattern - Bitmask (0-31)
 * 
 * Bit values: 1=leftmost, 2=2nd, 4=center, 8=4th, 16=rightmost
 * 
 * Examples:
 *   setPlayerLEDs(device, 0);   // All off
 *   setPlayerLEDs(device, 1);   // Left only
 *   setPlayerLEDs(device, 4);   // Center only
 *   setPlayerLEDs(device, 31);  // All on (1+2+4+8+16)
 *   setPlayerLEDs(device, 17);  // Left + Right (1+16)
 *   setPlayerLEDs(device, 21);  // Left + Center + Right (1+4+16)
 */
function setPlayerLEDs(device, pattern) {
  if (!device) return false;

  const report = Buffer.alloc(48);
  report[0] = 2;
  report[1] = 255;
  report[2] = 247;
  
  // Player LEDs at byte 44
  report[44] = Math.max(0, Math.min(31, pattern));

  try {
    device.write(Array.from(report));
    return true;
  } catch (error) {
    console.error('Write failed:', error.message);
    return false;
  }
}

/**
 * Reset controller to default state (clear all effects)
 * @param {object} device - HID device
 */
function reset(device) {
  if (!device) return false;
  
  // Reset triggers
  setTrigger(device, 'left', 0, []);
  setTrigger(device, 'right', 0, []);
  
  // Reset LEDs to default blue
  setLED(device, 0, 0, 255);
  setPlayerLEDs(device, 0);
  
  return true;
}

// Export functions
module.exports = {
  connect,
  disconnect,
  setTrigger,
  setLED,
  setPlayerLEDs,
  reset
};