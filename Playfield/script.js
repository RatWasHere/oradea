// const steamworks = require('steamworks.js');
// let app = steamworks.init(3994990);
// app.input.init();
// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
function getProgress(value, min, max) {
  return Math.max(0, (value - min) / (max - min));
}

var loadTime = 0;

// translateY(calc((var(--sr) + (var(--s) - var(--sr)) * 2) / 2))
// calc((var(--sr) / 2) - var(--tlr))
var sheet = document.styleSheets[0];
// sheet.insertRule(`:root{--real-size: ${CONFIG.CONTAINER_REAL_RADIUS}px}`);

sheet.insertRule(`:root { --real-size: ${CONFIG.CONTAINER_REAL_RADIUS}px }`);
sheet.insertRule(`:root { --inner-container-note-distance: ${CONFIG.START_OFFSET}px }`);



// ============================================================================
// INPUT SYSTEM
// ============================================================================


// ============================================================================
// RENDERING SYSTEM
// ============================================================================

// ============================================================================
// INITIALIZATION
// ============================================================================
const game = new RhythmGame();


function updatePerspective(value) {
  document.documentElement.style.setProperty('--perspective', `${value}px`);
}
function updateRotate(value) {
  document.documentElement.style.setProperty('--rotateX', `${value}deg`);
}

function updateHeight(value) {
  document.documentElement.style.setProperty('--hBaseLane', `${value}px`);
  CONFIG.ADJUSTED_MAX_TRAVEL = value;
}
function updateWidth(value) {
  document.documentElement.style.setProperty('--wBaseLane', `${value}px`);
  document.documentElement.style.setProperty('--mlBaseLane', `${(740 - value) / 2}px`);
}

function updateTranslate1(value) {
  document.documentElement.style.setProperty('--translate1', `${value}px`);
}

function updateTranslate2(value) {
  document.documentElement.style.setProperty('--translate2', `${value}px`);
}

function updateMarginTop(value) {
  document.documentElement.style.setProperty('--marginTop', `${value}px`);
}