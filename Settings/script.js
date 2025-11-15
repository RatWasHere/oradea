const CategoryManager = {
  categories: [],
  currentCategory: null,

  init() {
    const categoryElements = document.querySelectorAll('.category_contents');

    categoryElements.forEach((element, index) => {
      this.categories.push({
        name: element.dataset.category,
        association: element,
        index
      });

      this.setupCategoryElement(element, index);
    });

    if (this.categories.length > 0) {
      this.selectCategory(0);
    }
  },

  setupCategoryElement(element, index) {
    element.firstElementChild.innerHTML = `
      <btextm style="padding-bottom: 5px; padding-left: 5px; display: block; font-family: 'Modern'">
        ${element.dataset.category}
      </btextm>
    `;

    const selectorContainer = document.getElementById(element.dataset.associate);
    if (selectorContainer) {
      const selector = document.createElement('div');
      selector.className = 'category_selector controller_selectable';
      selector.id = `category_${element.dataset.associate}+${element.dataset.id}`;
      selector.textContent = element.dataset.category;
      selector.onclick = () => this.selectCategory(index);
      selectorContainer.appendChild(selector);
    }

    element.style.display = 'none';
    element.style.scale = '0';
  },

  selectCategory(index) {
    if (this.currentCategory) {
      const { association } = this.currentCategory;
      association.style.display = 'none';
      association.style.scale = '0';

      const categoryTag = document.getElementById(
        `category_${association.dataset.associate}+${association.dataset.id}`
      );
      categoryTag?.classList.remove('category_selected');
    }

    this.currentCategory = this.categories[index];
    const { association } = this.currentCategory;

    const categoryTag = document.getElementById(
      `category_${association.dataset.associate}+${association.dataset.id}`
    );
    categoryTag?.classList.add('category_selected');

    association.style.display = 'block';
    association.style.scale = '1';

    if (association.dataset.function) {
      eval(association.dataset.function);
    }
  }
};


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

    if (settingKey) {
      element.value = getSetting(settingKey, defaultValue);
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

          onOpen?.(menu);
        },
        beforeClose: () => {
          menu.store.getDataOptions().forEach(option => {
            const optionEl = document.querySelector(`[data-id="${option.id}"]`);
            optionEl?.classList.remove('controller_selectable', 'selected');
          });

          onBeforeClose?.(menu);
        },
        afterClose: () => {
          if (settingKey) {
            settings[settingKey] = element.value;
            saveSettings();
          }

          onAfterClose?.(menu);
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

const InputModeManager = {
  gamepadMode: 'XB',
  inputModeMenu: null,

  init() {
    this.inputModeMenu = selectMenuFactory.create({
      id: 'inputMode',
      settingKey: 'input_mode',
      defaultValue: 'buttons',
      onBeforeClose: () => this.updateInputExplanations(),
      onAfterClose: () => this.updateInputExplanations()
    });

    this.updateInputExplanations();
    this.detectInputDevices();
    this.setupGamepadListeners();
  },

  detectInputDevices() {
    const detectedInput = document.getElementById('detectedInput');
    const inputs = ['Keyboard', 'Mouse'];
    const gamepads = navigator.getGamepads();

    gamepads.forEach(gamepad => {
      if (gamepad) {
        const vendorID = gamepad.id.toLowerCase();
        const gamepadVendor = this.identifyGamepadVendor(vendorID);
        inputs.push(`${gamepadVendor} Controller (#${gamepad.index + 1})`);

        if (gamepadVendor === 'Xbox') this.gamepadMode = 'XB';
        else if (gamepadVendor === 'Playstation') this.gamepadMode = 'PS';
      }
    });

    if (detectedInput) {
      detectedInput.textContent = inputs.join(', ');
    }
  },

  identifyGamepadVendor(vendorID) {
    const vendors = [
      { keywords: ['xbox', 'xinput', 'microsoft', '045e'], name: 'Xbox' },
      { keywords: ['playstation', 'sony', '054c'], name: 'Playstation' }
    ];

    for (const vendor of vendors) {
      if (vendor.keywords.some(keyword => vendorID.includes(keyword))) {
        return vendor.name;
      }
    }

    return 'Unknown';
  },

  setupGamepadListeners() {
    window.addEventListener('gamepadconnected', () => this.detectInputDevices());
    window.addEventListener('gamepaddisconnected', () => this.detectInputDevices());
  },

  updateInputExplanations() {
    const inputType = document.getElementById('inputMode').value;
    const explanationContainer = document.getElementById('input_explanation');

    if (!explanationContainer) return;

    const explanations = {
      joysticks: this.getJoysticksExplanation(),
      buttons: this.getButtonsExplanation()
    };

    explanationContainer.innerHTML = explanations[inputType] || '';
  },

  getJoysticksExplanation() {
    return `
      <video class="explanationVideo" src="../Assets/Misc/UNIVERSAL_JOYSTICKS_EXPLANATION.mp4" autoplay loop></video>
      <btext style="opacity: 0.5; font-size: 15px;">
        Use either of your joysticks to aim. To hit a note that a joystick is aimed at, 
        hit one of the shoulder buttons on the same physical side as the joystick. 
        Each joystick represents a segment.<br>
        See the video above for an example
      </btext>
      <div style="height: 10px;"></div><br>
      <btext>
        Joystick Segment Snap Extension 
        <span style="opacity: 0.5;" id="snap_extension_preview">(${getSetting('snap_extension', 21)})</span>
      </btext>
      <input 
        data-unscrollable="true" 
        type="range" 
        min="0" 
        max="30" 
        step="1" 
        oninput="PlayfieldConfig.updateSnapExtension(this.value)"
        id="snap_extension"
        value="${getSetting('snap_extension', 21)}"
        class="range_slider controller_selectable">
      <btext style="font-size: 15px; opacity: 0.5;">
        Since controller input is inaccurate, we extend selected segments. Default is best.
      </btext>
    `;
  },

  getButtonsExplanation() {
    return `
      <video class="explanationVideo" src="../Assets/Misc/${this.gamepadMode}_FB_EXPLANATION.mp4" autoplay loop></video>
      <btext style="opacity: 0.5; font-size: 15px;">
        Your controller's face buttons are each assigned a segment. 
        Press the button assigned to the segment to hit notes in that segment.<br>
        Hold the button assigned to the segment to hold notes in that segment. Release when the hold note is over<br>
        See the video above for your controller's mapping
      </btext>
    `;
  }
};


const PlayfieldConfig = {
  init() {
    this.updateNoteSpeed();
    this.updateHexagonSize();
    this.updateSnapExtension();
    InputModeManager.updateInputExplanations();
  },

  updateNoteSpeed() {
    const configuredNotespeed = getSetting('note_speed', 6);
    const noteSpeedEl = document.getElementById('note_speed');
    const noteSpeedPreviewEl = document.getElementById('note_speed_preview');
    const demonstrationNote = document.getElementById('noteForDemonstration');

    if (noteSpeedEl) noteSpeedEl.textContent = `(${configuredNotespeed})`;
    if (noteSpeedPreviewEl) noteSpeedPreviewEl.textContent = configuredNotespeed;
    if (demonstrationNote) {
      demonstrationNote.style.animationDuration = `${5 / configuredNotespeed}s`;
    }
  },

  addToNoteSpeed(delta) {
    const currentSpeed = getSetting('note_speed', 6);
    const newSpeed = Math.round((parseFloat(currentSpeed) + parseFloat(delta)) * 10) / 10;

    if (newSpeed < 1 || newSpeed > 30) return;

    settings.note_speed = newSpeed;
    this.updateNoteSpeed();
    saveSettings();
  },

  updateSnapExtension(newValue) {
    if (newValue !== undefined) {
      settings.snap_extension = newValue;
      saveSettings();
    }

    const configuredSnapExtension = getSetting('snap_extension', 21);
    const snapExtensionEl = document.getElementById('snap_extension');
    const snapExtensionPreviewEl = document.getElementById('snap_extension_preview');

    if (snapExtensionEl) snapExtensionEl.value = configuredSnapExtension;
    if (snapExtensionPreviewEl) {
      snapExtensionPreviewEl.textContent = `(${configuredSnapExtension})`;
    }
  },

  updateHexagonSize(newValue) {
    if (newValue !== undefined) {
      settings.hexagon_size = newValue;
      saveSettings();
    }

    const configuredSize = getSetting('hexagon_size', 1);
    const hexagonSizeEl = document.getElementById('hexagon_size');
    const hexagonSizePreviewEl = document.getElementById('hexagon_size_preview');

    if (hexagonSizePreviewEl) hexagonSizePreviewEl.textContent = `(${configuredSize})`;
    if (hexagonSizeEl) hexagonSizeEl.value = configuredSize;

    if (newValue !== undefined) {
      require('electron').ipcRenderer.send('updateHexagon', `${newValue}`);
    }
  },

  startHoldingHexagon() {
    const ipcRenderer = require('electron').ipcRenderer;
    ipcRenderer.send('updateHexagon', `${settings.hexagon_size}`);

    const mouseUpListener = () => {
      ipcRenderer.send('doneUpdatingHexagon');
      document.removeEventListener('mouseup', mouseUpListener);
      document.getElementById('hexagon_size').onmouseup = null;
    };

    document.addEventListener('mouseup', mouseUpListener);
    document.getElementById('hexagon_size').onmouseup = mouseUpListener;
  }
};

const DisplayConfig = {
  init() {
    this.defaultScreenState = selectMenuFactory.create({
      id: 'defaultScreenState',
      settingKey: 'screen_state',
      defaultValue: 'full',
      onAfterClose: () => this.sendScreenStateToMain()
    });
    this.frameCap = selectMenuFactory.create({
      id: 'frameCap',
      settingKey: 'frame_cap',
      defaultValue: 'auto'
    });
  },

  sendScreenStateToMain() {
    ipcRenderer.send('updateScreenState', getSetting('screen_state'));
  }
}

const AudioConfig = {
  async init() {
    this.updateOffsetAmount();
    this.updateSFXVolume();
    this.updateMusicVolume();
    
    // Initialize audio context and buffer
    this.audioContext = new window.AudioContext();
    const data = fs.readFileSync('./Assets/hit_normal.mp3');
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
  },

  playTestSound(volume) {
    if (!this.audioBuffer) return;
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume / 100;
    
    source.buffer = this.audioBuffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start(0);
  },

  updateOffsetAmount(newValue) {
    if (newValue !== undefined) {
      settings.audio_offset = newValue;
      saveSettings();
    }
    const offsetPreviewEl = document.getElementById('audio_offset_preview');
    if (offsetPreviewEl) offsetPreviewEl.innerText = `(${getSetting('audio_offset', 0)}ms)`;
    if (offsetPreviewEl) document.getElementById('audio_offset').value = getSetting('audio_offset', 0);
  },
  updateSFXVolume(newValue) {
    if (newValue !== undefined) {
      settings.sfx_volume = newValue;
      saveSettings();
      this.playTestSound(newValue);
    }
    const offsetPreviewEl = document.getElementById('sfx_volume_preview');
    if (offsetPreviewEl) offsetPreviewEl.innerText = `(${getSetting('sfx_volume', 100)}%)`;
    if (offsetPreviewEl) document.getElementById('sfx_volume').value = getSetting('sfx_volume', 0);
  },
  updateMusicVolume(newValue) {
    if (newValue !== undefined) {
      settings.music_volume = newValue;
      saveSettings();
      this.playTestSound(newValue);
    }
    const offsetPreviewEl = document.getElementById('music_volume_preview');
    if (offsetPreviewEl) offsetPreviewEl.innerText = `(${getSetting('music_volume', 100)}%)`;
    if (offsetPreviewEl) document.getElementById('music_volume').value = getSetting('music_volume', 0);
  }
}

function initialize() {
  CategoryManager.init();
  InputModeManager.init();
  DisplayConfig.init();
  PlayfieldConfig.init();
  AudioConfig.init();

  const closeButton = document.getElementById('close-button');
  if (closeButton && globalControllerActions) {
    globalControllerActions.bTrigger = closeButton.onclick;
  }
}

window.selectCategory = (index) => CategoryManager.selectCategory(index);
window.initInputMode = () => InputModeManager.detectInputDevices();
window.initDisplayConfig = () => InputModeManager.detectInputDevices();
window.updateInputExplanations = () => InputModeManager.updateInputExplanations();
window.initPlayfieldConfig = () => PlayfieldConfig.init();
window.updateNS = () => PlayfieldConfig.updateNoteSpeed();
window.addToNS = (val) => PlayfieldConfig.addToNoteSpeed(val);
window.updateSE = () => PlayfieldConfig.updateSnapExtension();
window.updateHexagonSize = (val) => PlayfieldConfig.updateHexagonSize(val);
window.startHoldingHexagon = () => PlayfieldConfig.startHoldingHexagon();
window.updateOffsetAmount = (val) => AudioConfig.updateOffsetAmount(val);
window.updateSFXVolume = (val) => AudioConfig.updateSFXVolume(val);
window.updateMusicVolume = (val) => AudioConfig.updateMusicVolume(val);
window.initDisplay = () => DisplayConfig.init();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}