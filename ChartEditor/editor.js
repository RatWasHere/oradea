class SelectMenuFactory {
  constructor() {
    this.menus = new Map();
  }

  create(config) {
    const {
      id,
      defaultValue,
      settingKey,
      showSearch = false,
      onOpen = null,
      onBeforeClose = null,
      onAfterClose = null,
      cssClasses = []
    } = config;

    const element = document.getElementById(id);
    if (!element) {
      console.error(`menu w/ id "${id}" not found`);
      return null;
    }

    const menu = new SlimSelect({
      select: `#${id}`,
      settings: {
        showSearch
      },
      events: {
        afterOpen: () => {
          menu.store.getDataOptions().forEach(option => {
            const optionEl = document.getElementById(option.id);
            optionEl?.classList.add('controller_selectable');
          });

          onOpen?.(menu, element.value);
        },
        beforeClose: () => {
          menu.store.getDataOptions().forEach(option => {
            const optionEl = document.getElementById(option.id);
            optionEl?.classList.remove('controller_selectable', 'selected');
          });

          onBeforeClose?.(menu, element.value);
        },
        afterClose: () => {
          if (settingKey) {
            settings[settingKey] = element.value;
            saveSettings();
          }

          onAfterClose?.(menu, element.value);
        }
      },
      cssClasses: {
        main: ['ss-main', 'controller_selectable', ...cssClasses]
      }
    });

    this.menus.set(id, menu);

    if (config.assureValueConsistency) {
      menu.setSelected(document.getElementById(id).value);
    }
    return menu;
  }

  get(id) {
    return this.menus.get(id);
  }

  destroy(id) {
    const menu = this.menus.get(id);
    if (menu) {
      menu.destroy();
      this.menus.delete(id);
    }
  }
}

const selectMenuFactory = new SelectMenuFactory();



let charts = [];
fs.readdirSync('./Beatmaps').forEach(dir => {
  let chartInfo = JSON.parse(fs.readFileSync(`${process.cwd()}/Beatmaps/${dir}/information.json`));
  if (chartInfo.difficulties) {
    charts.push({
      location: dir,
      information: chartInfo,
      name: chartInfo.name
    });
  }
});



let currentlySelectedNoteType = 1;


let noteTypeVectors = [
  "../Assets/Misc/duplicate.svg",
  "../Assets/Headers/geometrical/Note.svg",
  "../Assets/Headers/geometrical/Note Golden.svg",
  "../Assets/Headers/geometrical/Note Holdable.svg",
  "../Assets/Headers/geometrical/Frame.svg",
  "../Assets/Headers/Trace.svg",
  "../Assets/Headers/Trace Short.svg",
  "../Assets/Headers/Trace Curved 180deg.svg",
  "../Assets/Headers/Trace Bridge.svg"
]

function selectNoteType(type) {
  document.getElementById(`note-type-${currentlySelectedNoteType}`).classList.remove('activeLargeButton');
  document.getElementById(`note-type-${type}`).classList.add('activeLargeButton');
  currentlySelectedNoteType = type;

  document.getElementById('mouseAugumenter').style.backgroundImage = `url('${noteTypeVectors[currentlySelectedNoteType]}')`;
}
let noteTypeButtons = [0, 1, 2, 3, 4, 5, 6, 7].map(type => {
  let button = document.getElementById(`note-type-${type}`);
  button.addEventListener('click', () => selectNoteType(type))
});
selectNoteType(0)




let mouseAugumenter = document.getElementById('mouseAugumenter');
document.addEventListener('mousemove', (event) => {
  mouseAugumenter.style.left = Number(event.x) + 15;
  mouseAugumenter.style.top = Number(event.y) + 15;
})

let noteContainer = document.getElementById('noteContainer');

noteContainer.addEventListener('mouseenter', () => {
  mouseAugumenter.classList.add('hovering');
});

noteContainer.addEventListener('mouseleave', () => {
  mouseAugumenter.classList.remove('hovering');
});



studioUI.initializeTabs('tabs', [
  {
    label: 'Selection',
    associatedViewID: 'local',
    onclick: "refreshLocalEvents()"
  },
  {
    label: 'Global',
    associatedViewID: 'global'
  },
]);

let noteTypeMap = {
  0: 'Note',
  1: 'Golden Note',
  2: 'Holdable Note',
  3: 'Slide Note',
  4: 'Full Swipe',
  5: 'Half Swipe',
  6: 'Quarter Swipe',
}

function refreshLocalEvents() {
  let local = document.getElementById('local');
  local.innerHTML = '';

  if (!selectedNotes.size) {
    local.innerHTML = 'Select one or more notes. Options for them will appear here';
    return;
  }
  let endTabs = [];
  let endHTML = `
      <div id="local-tabs" class="studio-tabs"></div>
    `;

  if (selectedNotes.size == 1) {
    let note = selectedNotes.values().next().value;
    let noteType = 0;

    if (note.golden) noteType = 1;
    else if (note.holdable) noteType = 2;
    else if (note.slider) noteType = 3;
    else if (note.shortSwipe) noteType = 5;
    else if (note.quarterSwipe) noteType = 6;
    else if (note.swipe) noteType = 4;

    endHTML += `
    <div class="contentContainer-tabs" id="properties">
    <btext style="font-family: 'Modern'; font-size: 30px; font-weight: 100; line-height: 30px;">${noteTypeMap[noteType]} (#${game.gameState.sheet.indexOf(note)})</btext>
    `
    endHTML += `
      <div class="separator"></div>

    <btext id="noteStartTime">start time ms</btext>
    <input style="width: 480px; margin: auto;" class="ss-main" value="${note.time}">
    
    <div style="height: 5px;"></div>

    <btext id="noteStartTime">render start ms</btext>
    <input 
    oninput="game.gameState.sheet[${game.gameState.sheet.indexOf(note)}].rawStartAt = this.value ? this.value : undefined; game.gameState.precacheStartAtValues();"
    style="margin: auto;" placeholder="leave empty for auto..." class="ss-main" value="${note.rawStartAt || ""}">
    `

    endTabs.push(
      {
        label: "Events",
        associatedViewID: "events"
      },
      {
        label: "Properties",
        associatedViewID: "properties"
      },
    )
    if (note.slider) {
      endHTML += `
    <div style="height: 5px;"></div>
    <btext id="noteStartTime">end time ms</btext>
    <input style="width: 480px; margin: auto;" class="ss-main" value="${note.sliderEnd}">
    <div style="height: 5px;"></div>
    <btext style="font-family: 'Mono'; font-weight: 100; letter-spacing: -0.9px;"><span style="opacity: 0.5; ">Duration:</span> ${note.sliderEnd - note.time}</btext>
    <div class="separator"></div>
    <btext id="noteStartTime">end note render at ms</btext>
    <input 
    oninput="game.gameState.sheet[${game.gameState.sheet.indexOf(note)}].rawEndAt = this.value ? this.value : undefined; game.gameState.precacheStartAtValues();"
    style="margin: auto;" placeholder="leave empty for auto..." class="ss-main" value="${note.rawEndAt || ""}">
    `
    }
    if (note.swipe) {
      endHTML += studioUI.toggle({
        name: "Direction",
        false: "Negative",
        true: "Positive",
        style: "width: 475px;",
        state: note.direction != -1
      }, `saveState(); game.gameState.sheet[${game.gameState.sheet.indexOf(note)}].direction = ${note.direction == -1 ? 1 : -1}; refreshLocalEvents(); freeNote(game.gameState.sheet[${game.gameState.sheet.indexOf(note)}]); freeSFX(game.gameState.sheet[${game.gameState.sheet.indexOf(note)}]);`);
    } else {
      endHTML += studioUI.toggle({
        name: "Fake Note",
        false: "No",
        true: "Yes",
        style: "width: 475px;",
        state: note.fake == true
      }, `saveState(); game.gameState.sheet[${game.gameState.sheet.indexOf(note)}].fake = ${!note.fake ? true : false};`);
    }

    endHTML += `</div>
    <div class="contentContainer-tabs" id="events">
    <div class="eventControls">
      <div id="noteEvents">
      </div>
    <btn onclick="createNoteEvent();" style="width: 50px; height: 50px; padding: 0px !important;" class="flexbox"><div class="image" id="createIcon"></div></btn>
    </div>
    </div>
    `
  }


  local.innerHTML = endHTML;

  requestAnimationFrame(() => {
    studioUI.initializeTabs('local-tabs', endTabs);
    updateNoteEvents();
  })

}

function createNoteEvent() {
  let note = selectedNotes.values().next().value;
  if (!note.timeSheet) note.timeSheet = [];
  note.timeSheet.push({ time: 0, speed: 1 });
  updateNoteEvents();
}

function updateNoteEvents() {
  try {
    let note = selectedNotes.values().next().value;
    let events = note.timeSheet;
    let endHTML = ``

    for (let eventIndex in note.timeSheet) {
      let event = events[eventIndex];
      let index = game.gameState.sheet.indexOf(note);

      endHTML += `<div class="noteEvent" onmouseenter="surpressScrolling = true" onmouseleave="surpressScrolling = false">
      <btext id="genericValueLabel">time</btext>
      <input style="margin: auto;" class="ss-main" value="${event.rawTime != undefined ? event.rawTime : 0}" oninput="game.gameState.sheet[${game.gameState.sheet.indexOf(note)}].timeSheet[${eventIndex}].rawTime = this.value; game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[${game.gameState.sheet.indexOf(note)}]); game.gameState.precacheStartAtValues();">
    <div style="height: 5px;"></div>
    <div class="expandableEventDetails">
    <div style="height: 5px;"></div>


      <div class="separator"></div>

    
    <div style="height: 5px;"></div>

      </div>
    <div style="height: 5px;"></div>
      <flexbox>
        <btn onclick="toggleEventView(this.parentElement.parentElement);" style="width: 30px; height: 30px; padding: 0px !important; margin-right: 5px !important;" class="flexbox"><div class="image" id="expandIcon"></div></btn>
        <btn onclick="copyEvent(${index}, ${eventIndex});" style="width: 30px; height: 30px; padding: 0px !important; margin-right: 5px !important;" class="flexbox"><div class="image" id="copyIcon"></div></btn>
        <btn onclick="displayEventSpecifics(${index}, ${eventIndex}, this);" style="width: 30px; height: 30px; padding: 0px !important; margin-right: auto !important;" class="flexbox"><div class="image" id="extendIcon"></div></btn>
        <btn onclick="deleteNoteEvent(${index}, ${eventIndex});" style="width: 30px; height: 30px; padding: 0px !important;" class="flexbox"><div class="image" id="deleteIcon"></div></btn>
      </flexbox>
      </div>`
    }

    document.getElementById('noteEvents').innerHTML = endHTML
  } catch (error) { console.log('error', error) }

}

async function copyEvent(noteIndex, eventIndex) {
  if (isShiftActive) {
    let clipboardText = await new Promise(async (res) => {
      let text = await navigator.clipboard.readText();
      res(text);
    });
    try {
      let clipboardJSON = JSON.parse(clipboardText);
      if (Array.isArray(clipboardJSON) && clipboardJSON[0].rawTime != undefined) {
        clipboardJSON.push(game.gameState.sheet[noteIndex].timeSheet[eventIndex]);
        return navigator.clipboard.writeText(
          JSON.stringify(
            clipboardJSON
          )
        );
      }
    } catch (error) { console.log(error) }
  }

  navigator.clipboard.writeText(JSON.stringify([game.gameState.sheet[noteIndex].timeSheet[eventIndex]]));
}

function deleteNoteEvent(noteIndex, eventIndex) {
  let note = game.gameState.sheet[noteIndex];
  note.timeSheet.splice(eventIndex, 1);
  updateNoteEvents();

  requestAnimationFrame(() => {
    surpressScrolling = false;
  })
}

function displayEventSpecifics(noteIndex, eventIndex) {
  let note = game.gameState.sheet[noteIndex];
  let event = note.timeSheet[eventIndex];

  let specificDisplay = document.createElement('div');
  specificDisplay.classList.add('specificsModal');

  document.body.appendChild(specificDisplay);
  specificDisplay.innerHTML = `
    <btext style="font-family: 'Modern'; font-size: 30px; font-weight: 100; line-height: 30px;">Properties</btext>
    <btn style="position: absolute; right: 10; top: 10; border-radius: 2px;" onclick="
    this.parentElement.classList.remove('engagedSpecificsModal');
    setTimeout(() => {this.parentElement.remove(); surpressScrolling = false;}, 200);
    ">Exit</btn>
    <div style="height: 5px;"></div>
  
    <div class="flexbox" style="width: 100%;">
      <div style="width: calc(50% - 5px); margin-right: 5px;">
        <btext id="genericValueLabel">transition duration (ms)</btext>
        <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].rawTransition = this.value; game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[${game.gameState.sheet.indexOf(note)}]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.initial_transition != undefined ? event.initial_transition : (event.transition == undefined ? 0 : event.transition)}">
      </div>

      <div style="width: 50%;">
        <btext id="genericValueLabel">bezier</btext>
        <input placeholder="optional, comma separated" oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].easing = this.value ? { cubicBezier: this.value.split(',') } : undefined; game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[${noteIndex}]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.easing?.cubicBezier != undefined ? event.easing.cubicBezier?.join(',') : 0}">
      </div>
    </div>


    <div style="height: 5px;"></div>
    
    <div class="flexbox" style="width: 100%;">
      <div style="width: calc(50% - 5px); margin-right: 5px;">
        <btext id="genericValueLabel">speed</btext>
        <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].speed = this.value; game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[${noteIndex}]); game.gameState.precacheStartAtValues();"class="ss-main" value="${event.speed != undefined ? event.speed : 1}">
      </div>
      <div style="width: 50%;">
        <btext id="genericValueLabel">from speed</btext>
        <input oninput="updateNoteEventTransitionFromValue('speed', this.value, ${noteIndex}, ${eventIndex}); game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[${noteIndex}]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.from?.speed != undefined ? event.from.speed : 0}">
      </div>
    </div>

    <div style="height: 5px;"></div>


    <div class="flexbox" style="width: 100%;">
      <div style="width: calc(50% - 5px); margin-right: 5px;">
        <btext id="genericValueLabel">offset (ms)</btext>
        <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].rawOffset = this.value; game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[${noteIndex}]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.rawOffset != undefined ? event.rawOffset : 0}">
      </div>

      <div style="width: 50%;">
        <btext id="genericValueLabel">from offset (ms)</btext>
        <input oninput="updateNoteEventTransitionFromValue('rawOffset', this.value, ${noteIndex}, ${eventIndex}); game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[${noteIndex}]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.from?.rawOffset != undefined ? event.from.rawOffset : 0}">
      </div>
    </div>

    </div>
    <div class="separator" style="width: 100%;"></div>

    
      <btext id="genericValueLabel">styles</btext>
      <div class="specificStyles" id="stylesList" onmouseenter="surpressScrolling = true" onmouseleave="surpressScrolling = true"></div>
      <flexbox class="eventControls" >
      <btn onclick="createNoteEventStyleProperty(${noteIndex}, ${eventIndex});" style="width: 50px; height: 50px; padding: 0px !important;" class="flexbox"><div class="image" id="createIcon"></div></btn>
      <btn onclick="pasteNoteEventStyleProperties(${noteIndex}, ${eventIndex});" style="width: 50px; height: 50px; padding: 0px !important; margin-right: auto; margin-left: 5px;" class="flexbox"><div class="image" id="pasteIcon"></div></btn>
      
      </flexbox>

  `
  requestAnimationFrame(() => {
    specificDisplay.classList.add('engagedSpecificsModal');
    refreshNoteEventStyleProperties(noteIndex, eventIndex);
  })
}

let availableStyleProperties = ['scale', 'opacity', 'transform', 'filter', 'rotate', 'unset']


async function pasteNoteEventStyleProperties(noteIndex, eventIndex) {
  let clipboard = await navigator.clipboard.readText();
  let parsed = JSON.parse(clipboard);
  console.log(parsed);
  if (!Array.isArray(parsed) || !parsed[0].location) return;

  // if anyone snooping through the code looking for a reason to call me lazy, feel free to call me out for this forEach
  parsed.forEach((style) => {
    let deserializedStyle = JSON.parse(JSON.stringify(style));
    delete deserializedStyle.property;
    delete deserializedStyle.location;
    game.gameState.sheet[noteIndex].timeSheet[eventIndex].visuals[style.location][style.property] = deserializedStyle;
    console.log(game.gameState.sheet[noteIndex].timeSheet[eventIndex].visuals[style.location][style.property], game.gameState.sheet[noteIndex].timeSheet[eventIndex].visuals)
    console.log('ayte')
  });

  requestAnimationFrame(() => {
    refreshNoteEventStyleProperties(noteIndex, eventIndex);
  })
}

function createNoteEventStyleProperty(noteIndex, eventIndex) {
  let event = game.gameState.sheet[noteIndex].timeSheet[eventIndex];
  saveState();
  if (!event.visuals) {
    event.visuals = {
      note: {},
      parent: {},
      hint: {},
      tracePath: {},
      traceParent: {}
    };
  }

  event.visuals.note.unset = {
    value: "#1px",
    from: [0],
    to: [100],
    duration: 100,
    easing: { cubicBezier: [] }
  }

  refreshNoteEventStyleProperties(noteIndex, eventIndex);
};

function capitalizeFirstLetter(string) {
  return (String(string[0]).toUpperCase() + String(string).slice(1));
}


function refreshNoteEventStyleProperties(noteIndex, eventIndex) {
  let note = game.gameState.sheet[noteIndex];
  let event = game.gameState.sheet[noteIndex].timeSheet[eventIndex];

  let selectsPendingInitiation = [];
  let endHTML = '';

  let generateOptions = (currentValue) => {
    let optionsHTML = '';

    for (let option of availableStyleProperties) {
      optionsHTML += `<option ${currentValue == option ? "selected" : ""} value="${option}">${capitalizeFirstLetter(option)}</option>`
    }

    return optionsHTML;
  }

  let generateItem = (property, value, location) => {
    selectsPendingInitiation.push({
      id: `${location}-${property}-on-${noteIndex}-${eventIndex}`,
      onAfterClose: (m, value) => {
        let deserializedCurrentValue = JSON.parse(JSON.stringify(event.visuals[location][property]))
        delete event.visuals[location][property];
        event.visuals[value][property] = deserializedCurrentValue;

        refreshNoteEventStyleProperties(noteIndex, eventIndex);
      }
    })

    selectsPendingInitiation.push({
      id: `${location}-${property}-on-${noteIndex}-${eventIndex}-property`,
      onAfterClose: (m, value) => {
        let deserializedCurrentValue = JSON.parse(JSON.stringify(event.visuals[location][property]))
        delete event.visuals[location][property];
        event.visuals[location][value] = deserializedCurrentValue;
        refreshNoteEventStyleProperties(noteIndex, eventIndex);
      }
    })

    if (event.visuals[location][property].easing?.cubicBezier == undefined) {
      event.visuals[location][property].easing = {
        cubicBezier: []
      }
    }

    return `
    <div class="noteEvent">

      <div class="flexbox" style="width: 100%;">
        <div style="width: calc(50% - 5px); margin-right: 5px;">
          <btext id="genericValueLabel">property</btext>

          <select id="${location}-${property}-on-${noteIndex}-${eventIndex}-property">
          ${generateOptions(property)}
          </select>
        </div>

        <div style="width: 50%;">
          <btext id="genericValueLabel">apply to</btext>
          <select id="${location}-${property}-on-${noteIndex}-${eventIndex}">
            <option ${location == 'note' ? 'selected' : ''} value="note">Note</option>
            <option ${location == 'path' ? 'selected' : ''} value="parent">Path</option>
            <option ${location == 'hint' ? 'selected' : ''} value="hint">Hint</option>
            ${note.swipe ? `
              <option ${location == 'tracePath' ? 'selected' : ''} value="tracePath">Trace</option>
              <option ${location == 'traceParent' ? 'selected' : ''} value="traceParent">Trace Parent</option>
            ` : ''}
          </select>
        </div>
      </div>
      
    <div style="height: 5px;"></div>

      <div class="flexbox" style="width: 100%;">
        <div style="width: calc(50% - 5px); margin-right: 5px;">
          <btext id="genericValueLabel">duration (ms)</btext>
          <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].visuals['${location}']['${property}'].duration = this.value; game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].visuals['${location}']['${property}'].rawDuration = this.value; game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[index]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.visuals[location][property].rawDuration != undefined ? event.visuals[location][property].rawDuration : 0}">
        </div>
        <div style="width: 50%;">
          <btext id="genericValueLabel">bezier</btext>
          <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].visuals['${location}']['${property}'].easing.cubicBezier = this.value.split(','); game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[index]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.visuals[location][property].easing?.cubicBezier != undefined ? event.visuals[location][property].easing?.cubicBezier.join(',') : ''}">
        </div>
      </div>
    <div style="height: 5px;"></div>


      <div class="flexbox" style="width: 100%;">
        <div style="width: calc(50% - 5px); margin-right: 5px;">
          <btext id="genericValueLabel">value</btext>
          <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].visuals['${location}']['${property}'].value = this.value; game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[index]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.visuals[location][property].value != undefined ? event.visuals[location][property].value : 0}">
          
        </div>
        <div style="width: calc(25% - 5px); margin-right: 5px;">
          <btext id="genericValueLabel">from value(s)</btext>
          <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].visuals['${location}']['${property}'].from = this.value.split(','); game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[index]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.visuals[location][property].from != undefined ? event.visuals[location][property].from.join(',') : ''}">
        </div>
        <div style="width: 25%;">
          <btext id="genericValueLabel">to value(s)</btext>
          <input oninput="game.gameState.sheet[${noteIndex}].timeSheet[${eventIndex}].visuals['${location}']['${property}'].to = this.value.split(','); game.gameState.recalculateNoteScaleTiming(game.gameState.sheet[index]); game.gameState.precacheStartAtValues();" class="ss-main" value="${event.visuals[location][property].to != undefined ? event.visuals[location][property].to.join(',') : ''}">
        </div>
      </div>

    <div class="separator" style="width: 100%; opacity: 0.5;"></div>

      <flexbox>
        <btn onclick="copyStyle(${noteIndex}, ${eventIndex}, '${location}', '${property}');" style="width: 30px; height: 30px; padding: 0px !important; margin-right: 5px !important;" class="flexbox"><div class="image" id="copyIcon"></div></btn>
        <btn onclick="deleteNoteStyle(${noteIndex}, ${eventIndex}, '${location}', '${property}');" style="width: 30px; height: 30px; padding: 0px !important;" class="flexbox"><div class="image" id="deleteIcon"></div></btn>
      </flexbox>
    </div>
    `
  }

  for (let value in event.visuals) {
    let styling = event.visuals[value];
    for (let property in styling) {
      endHTML += generateItem(property, styling[property], value)
    }
  }

  document.getElementById('stylesList').innerHTML = endHTML + "<div style='height: 20px;'></div>";

  requestAnimationFrame(() => {
    selectsPendingInitiation.forEach((item) => {
      selectMenuFactory.create({ id: item.id, assureValueConsistency: true, onAfterClose: item.onAfterClose });
    })
  })
}

function deleteNoteStyle(noteIndex, eventIndex, location, property) {
  delete game.gameState.sheet[noteIndex].timeSheet[eventIndex].visuals[location][property];

  refreshNoteEventStyleProperties(noteIndex, eventIndex)
}

async function copyStyle(noteIndex, eventIndex, location, property) {
  if (isShiftActive) {
    let clipboardText = await new Promise(async (res) => {
      let text = await navigator.clipboard.readText();
      res(text);
    });
    try {
      let clipboardJSON = JSON.parse(clipboardText);
      if (Array.isArray(clipboardJSON) && clipboardJSON[0].rawTime != undefined) {
        clipboardJSON.push({ ...game.gameState.sheet[noteIndex].timeSheet[eventIndex].visuals[location][property], location, property });
        return navigator.clipboard.writeText(
          JSON.stringify(
            clipboardJSON
          )
        );
      }
    } catch (error) { console.log(error) }
  }

  navigator.clipboard.writeText(JSON.stringify([{ ...game.gameState.sheet[noteIndex].timeSheet[eventIndex].visuals[location][property], location, property }]));
}

function updateNoteEventTransitionFromValue(entry, value, noteIndex, eventIndex) {
  let event = game.gameState.sheet[noteIndex].timeSheet[eventIndex];

  if (value != '') {
    if (!event.from) event.from = {};
    event.from[entry] = value;
    event.from[`raw${capitalizeFirstLetter(entry)}`] = value;

  } else {
    delete event.from[entry];
  }

  if (event.from.keys().length == 0) delete event.from;
}

/**
 * 
 * @param {HTMLDivElement} element 
 */
function toggleEventView(element) {
  let expandableElement = element.getElementsByClassName('expandableEventDetails')[0];
  if (element.dataset.expanded != 'false') {
    element.classList.remove('expanded');
    expandableElement.style.height = 0;
    element.dataset.expanded = false;
  } else {
    let simulatedHeight = 0;
    let copyForExpansion = expandableElement.cloneNode(true);
    copyForExpansion.style.opacity = 0;
    copyForExpansion.style.height = 'fit-content'
    document.body.appendChild(copyForExpansion);
    requestAnimationFrame(() => {
      element.classList.add('expanded');
      simulatedHeight = copyForExpansion.getBoundingClientRect().height + 15;
      copyForExpansion.remove();

      element.dataset.expanded = true;
      expandableElement.style.height = simulatedHeight;
    });
  }
}

setTimeout(() => {
  document.getElementById('transitionOverlay').remove();
}, 2000)
