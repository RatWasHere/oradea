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
      console.error(`Element with id "${id}" not found`);
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
            const optionEl = document.querySelector(`[data-id="${option.id}"]`);
            optionEl?.classList.add('controller_selectable');
          });

          onOpen?.(menu, element.value);
        },
        beforeClose: () => {
          menu.store.getDataOptions().forEach(option => {
            const optionEl = document.querySelector(`[data-id="${option.id}"]`);
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
    label: 'Global',
    associatedViewID: 'global'
  },
  {
    label: 'Selection',
    associatedViewID: 'local',
    onclick: "refreshLocalEvents()"
  }
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
    <btext style="font-family: 'Modern'; font-size: 30px; font-weight: 100; line-height: 30px;">${noteTypeMap[noteType]}</btext>`
    endHTML += `
    <btext id="noteStartTime">start time ms</btext>
    <input style="width: 480px; margin: auto;" class="ss-main" value="${note.time}">
    `

    endTabs.push({
      label: "Note",
      associatedViewID: "properties"
    },
      {
        label: "Events",
        associatedViewID: "events"
      }

    )

    if (note.swipe) {
      endHTML += studioUI.toggle({
        name: "Direction",
        false: "Negative",
        true: "Positive",
        style: "width: 475px;",
        state: note.direction != -1
      }, `saveState(); game.gameState.sheet[${game.gameState.sheet.indexOf(note)}].direction = ${note.direction == -1 ? 1 : -1}; refreshLocalEvents(); freeNote(game.gameState.sheet[${game.gameState.sheet.indexOf(note)}]); freeSFX(game.gameState.sheet[${game.gameState.sheet.indexOf(note)}]); console.log('hello', game.gameState.sheet[${game.gameState.sheet.indexOf(note)}])`);
    }
    if (note.slider) {
      endHTML += `
    <div style="height: 5px;"></div>
    <btext id="noteStartTime">end time ms</btext>
    <input style="width: 480px; margin: auto;" class="ss-main" value="${note.sliderEnd}">
    <div style="height: 5px;"></div>
    <btext style="font-family: 'Mono'; font-weight: 100; letter-spacing: -0.9px;"><span style="opacity: 0.5; ">Duration:</span> ${note.sliderEnd - note.time}</btext>
    `
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

      endHTML += `<div class="noteEvent" onmouseenter="surpressScrolling = true" onmouseleave="surpressScrolling = false">
      <btext id="noteStartTime">time</btext>
      <input style="width: 490px; margin: auto;" class="ss-main" value="${event.time}">
    <div style="height: 5px;"></div>

      <btext id="noteStartTime">speed</btext>
      <input style="width: 490px; margin: auto;" class="ss-main" value="${event.speed == undefined ? 1 : event.speed}">
    <div style="height: 5px;"></div>

      <btext id="noteStartTime">offset</btext>
      <input style="width: 490px; margin: auto;" class="ss-main" value="${event.offset == undefined ? 0 : event.offset}">

      <div class="separator"></div>

      <btext id="noteStartTime">transition</btext>
      <input style="width: 490px; margin: auto;" class="ss-main" value="${event.offset == undefined ? 0 : event.offset}">
    <div style="height: 5px;"></div>
    <btn onclick="createNoteEvent();" style="width: 30px; height: 30px; padding: 0px !important;" class="flexbox"><div class="image" id="deleteIcon"></div></btn>
      
      </div>`
    }

    document.getElementById('noteEvents').innerHTML = endHTML
  } catch (error) { console.log('error', error) }

}