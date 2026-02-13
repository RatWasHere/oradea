// ==================== Utility Functions ====================

/**
 * Check if a note is a hold/slider
 */
function isHoldOrSlider(note) {
  return note.slider === true || note.sliderEnd !== undefined;
}

/**
 * Check if a note is a normal note (not a hold/slider and not a swipe)
 */
function isNormalNote(note) {
  return !isHoldOrSlider(note) && !isSwipeNote(note) && !note.golden;
}

/**
 * Check if a note is holdable (has holdable properties)
 */
function isHoldableNote(note) {
  return (
    note.holdable === true ||
    note.holdableStart === true ||
    note.holdableEnd === true
  );
}

/**
 * Check if a note is a swipe note
 */
function isSwipeNote(note) {
  return note.swipe === true || note.swipeEnd !== undefined;
}

/**
 * Check if a note matches the selected filters
 */
function matchesFilters(note, filters) {
  // If no filters are selected, include the note
  if (
    !filters.holds &&
    !filters.normal &&
    !filters.holdable &&
    !filters.swipe
  ) {
    return true;
  }

  let matches = false;

  if (filters.holds && isHoldOrSlider(note)) {
    matches = true;
  }
  if (filters.normal && isNormalNote(note)) {
    matches = true;
  }
  if (filters.holdable && isHoldableNote(note)) {
    matches = true;
  }
  if (filters.swipe && isSwipeNote(note)) {
    matches = true;
  }
  if (filters.golden && note?.golden) {
    matches = true;
  }

  return matches;
}

// ==================== Main Processing ====================

/**
 * Apply filters and replacements to the beatmap data
 */
function applyFilterAndReplace() {
  // Get the JSON input
  const jsonInput = document.getElementById('jsonInput').value.trim();

  if (!jsonInput) {
    showError('Please enter a JSON template');
    return;
  }

  // Parse the JSON template
  let template;
  try {
    template = JSON.parse(jsonInput);
  } catch (e) {
    showError(`Invalid JSON template: ${e.message}`);
    return;
  }

  // Get filter settings
  const filters = {
    holds: document.getElementById('filterHolds').checked,
    normal: document.getElementById('filterNormal').checked,
    holdable: document.getElementById('filterHoldable').checked,
    swipe: document.getElementById('filterSwipe').checked,
    golden: document.getElementById('filterGolden').checked,
  };

  // Get time range
  const timeStart = parseInt(document.getElementById('timeStart').value) || 0;
  const timeEnd =
    parseInt(document.getElementById('timeEnd').value) || 999999;

  if (timeStart > timeEnd) {
    showError('Start time cannot be greater than end time');
    return;
  }

  // Get the map.json data
  getMapData((mapData) => {
    if (!mapData || mapData.length === 0) {
      showError('No beatmap data loaded');
      return;
    }

    // Process the beatmap
    const result = processBeamapData(
      mapData,
      template,
      filters,
      timeStart,
      timeEnd
    );

    // Display the output
    displayOutput(result);

    // Store for download
    window.lastProcessedData = result;
  });
}

/**
 * Process beatmap data with filters and replacements
 */
function processBeamapData(mapData, template, filters, timeStart, timeEnd) {
  // Find the first note time
  const firstNoteTime = mapData.length > 0 ? mapData[0].time : 0;

  // Track the most recent note time among filtered notes
  let mostRecentNoteTime = firstNoteTime;

  // Keep a copy of the original map
  const results = JSON.parse(JSON.stringify(mapData));

  // Track which notes matched and their most recent time
  let lastMatchedIndex = -1;

  for (let i = 0; i < results.length; i++) {
    const note = results[i];

    // Check time range
    if (note.time < timeStart || note.time > timeEnd) {
      continue;
    }

    // Check filters
    if (!matchesFilters(note, filters)) {
      continue;
    }

    // Update most recent note time for the next matching note
    if (lastMatchedIndex !== -1) {
      mostRecentNoteTime = results[lastMatchedIndex].time;
    }

    // Calculate differences
    const diffFromFirstNote = note.time - firstNoteTime;
    const diffFromMostRecentNote = note.time - mostRecentNoteTime;

    // Replace variables in template
    const processedTemplate = replaceVariables(
      JSON.parse(JSON.stringify(template)),
      diffFromFirstNote,
      diffFromMostRecentNote
    );

    // Merge with original note
    results[i] = { ...note, ...processedTemplate };

    // Track this as the last matched note
    lastMatchedIndex = i;
  }

  return results;
}

/**
 * Replace variables in an object recursively
 */
function replaceVariables(obj, diffFromFirst, diffFromMostRecent) {
  if (typeof obj === 'string') {
    return obj
      .replace(/\$DIFFERENCE_FROM_FIRST_NOTE\$/g, diffFromFirst.toString())
      .replace(
        /\$DIFFERENCE_FROM_MOST_RECENT_NOTE\$/g,
        diffFromMostRecent.toString()
      );
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      replaceVariables(item, diffFromFirst, diffFromMostRecent)
    );
  }

  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = replaceVariables(
          obj[key],
          diffFromFirst,
          diffFromMostRecent
        );
      }
    }
    return result;
  }

  return obj;
}

/**
 * Get beatmap data from map.json or load from file
 */
function getMapData(callback) {
  // Try to load from local file
  if (typeof require !== 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const mapPath = path.join(__dirname, 'map.json');

      if (fs.existsSync(mapPath)) {
        const data = fs.readFileSync(mapPath, 'utf8');
        const mapData = JSON.parse(data);
        callback(mapData);
        return;
      }
    } catch (e) {
      console.log('Could not load from file system:', e);
    }
  }

  // Fallback: prompt user to paste JSON or use fetch
  callback(null);
}

// ==================== Display and Download ====================

/**
 * Display the output in the output container
 */
function displayOutput(data) {
  const outputContainer = document.getElementById('outputContainer');

  if (data.length === 0) {
    outputContainer.innerHTML = '<p class="placeholder">No notes match the filters</p>';
    return;
  }

  // Display formatted JSON
  const formattedJSON = JSON.stringify(data, null, 2);
  outputContainer.textContent = formattedJSON;
}

/**
 * Download the processed JSON
 */
function downloadJSON() {
  if (!window.lastProcessedData) {
    showError('No data to download. Please apply a filter first.');
    return;
  }

  const data = JSON.stringify(window.lastProcessedData, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timesheets_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clear all inputs and outputs
 */
function clearAll() {
  document.getElementById('filterHolds').checked = false;
  document.getElementById('filterNormal').checked = false;
  document.getElementById('filterHoldable').checked = false;
  document.getElementById('filterSwipe').checked = false;
  document.getElementById('timeStart').value = '0';
  document.getElementById('timeEnd').value = '999999';
  document.getElementById('jsonInput').value = '';
  document.getElementById('outputContainer').innerHTML =
    '<p class="placeholder">Output will appear here...</p>';
  window.lastProcessedData = null;
}

/**
 * Show error message
 */
function showError(message) {
  alert('Error: ' + message);
}

// ==================== Event Listeners ====================

document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('applyButton')
    .addEventListener('click', applyFilterAndReplace);
  document
    .getElementById('downloadButton')
    .addEventListener('click', downloadJSON);
  document.getElementById('clearButton').addEventListener('click', clearAll);
});
