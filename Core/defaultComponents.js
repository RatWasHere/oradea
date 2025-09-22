let studioUI = {
  toggle: (options, onclick) => {
    return `
    <div class="toggle ${options.additionalClasses || ""} ${(Boolean(options.state) && ownSettings.highlightToggles == 'On') ? "selected " : ""}" id="${options.id}" data-state="${options.state}" onclick="if (this.dataset.stop == 'true') {return}; studioUI.toggleSwitch(this); ${onclick}" style="${options.style || ""}">
    <btext style="margin-left: 11.5px;">${options.name}</btext>
    <secondaryText style="margin-top: auto; margin-bottom: auto; opacity: 50%;">${options.false ? options.false : "No"}</secondaryText>
    <div class="toggle_bar"><div class="toggle_tail ${options.state != true ? "toggle_button_true_pre toggle_button_true" : "toggle_button_false_pre toggle_button_false"}" style="transition: all 0.${editorSettings.fastAnimation}s ease;"></div></div>
    <secondaryText style="margin-right: 10px; margin-left: 0px !important; opacity: 50%; margin-top: auto; margin-bottom: auto;">${options.true ? options.true : "Yes"}</secondaryText>
    </div>
    `
  },


  toggleSwitch: (element) => {
    let toggle = element.getElementsByClassName('toggle_bar')[0].getElementsByClassName('toggle_tail')[0]
    toggle.style.transition = `all 0.${editorSettings.commonAnimation}s ease`;
    toggle.parentElement.style.transition = `all 0.${editorSettings.commonAnimation}s ease`;

    if (element.dataset.state == 'false') {
      element.dataset.state = 'true'

      if (ownSettings.highlightToggles == 'On') {
        element.classList.add('selected')
      }

      toggle.classList.add('toggle_button_animation_false_to_true');
      toggle.classList.add('toggle_button_false_pre');
      toggle.classList.remove('toggle_button_true_pre');
      toggle.classList.remove('toggle_button_true');
      toggle.parentElement.classList.add('toggle_tail_animation_true_to_false');

      setTimeout(() => {
        toggle.classList.remove('toggle_button_animation_false_to_true');
        toggle.parentElement.classList.remove('toggle_tail_animation_true_to_false');
        toggle.classList.add('toggle_button_false');
      }, editorSettings.commonAnimation * 50);

    } else {
      element.dataset.state = 'false'

      toggle.classList.remove('toggle_button_false_pre');
      toggle.classList.remove('toggle_button_false');
      toggle.classList.add('toggle_button_true_pre');
      toggle.parentElement.classList.add('toggle_tail_animation_false_to_true');
      element.classList.remove('selected');

      toggle.classList.add('toggle_button_animation_true_to_false');

      setTimeout(() => {
        toggle.classList.remove('toggle_button_animation_true_to_false');
        toggle.classList.add('toggle_button_true');
        toggle.parentElement.classList.remove('toggle_tail_animation_false_to_true');
      }, editorSettings.commonAnimation * 50);
    }
  },

  dropdown: (options) => {
    let choices = options.options;
    let foundChoice;
    choices.forEach(choice => {
      if (choice.value == options.currentChoice) {
        foundChoice = choice;
      }
    });

    if (!foundChoice) {
      foundChoice = choices[0];
    }

    return `<div id="${options.id}" class="flexbox" data-options='${JSON.stringify(choices)}' data-chosen="${foundChoice.value}" style='${options.style || ""}; margin-left: auto; margin-right: auto; ${!options.forcePush ? 'height: 30.8px' : ""};'>
    <div onclick="studioUI.openDropdown(this, () => {${options.onclick}})" class="dropdown" style="width: 100%; display: block; font-size: 20px; margin-left: auto; margin-right: auto; padding-right: 0px; padding-left: 12px; transition: all 0.3s ease;">${foundChoice.name}</div>
    </div>`
  },

  openDropdown: (element, bound) => {
    element.style.zIndex = '1000'
    element.parentElement.style.zIndex = '1000'

    element.onclick = () => {
      studioUI.closeTypedDropdown(element, bound)
    }

    let types = JSON.parse(element.parentElement.dataset.options)

    for (let translation of types) {
      if (translation.value != element.parentElement.dataset.chosen) {
        let option = document.createElement('div')
        option.style = ''
        option.className = 'dropdown_option'
        option.onclick = () => {
          studioUI.selectDropdownOption(element, bound, translation);
        }
        option.innerHTML = translation.name;
        element.appendChild(option);
      }
    }
  },

  selectDropdownOption: (element, bound, translation) => {
    element.parentElement.dataset.chosen = translation.value;

    bound();
  },

  closeTypedDropdown: (element, bound) => {
    element.style.animationName = "";
    const innerHeight = element.clientHeight;
    element.style.animationDuration = "";
    element.style.setProperty("--inner-height", innerHeight + "px");
    element.style.animationName = "shrink";
    element.style.animationDuration = "300ms";
    element.style.zIndex = ''
    element.parentElement.style.zIndex = ''

    setTimeout(() => {
      element.onclick = () => {
        studioUI.openDropdown(element, bound)
      };
      element.innerHTML = JSON.parse(element.parentElement.dataset.options).find(opt => opt.value == element.parentElement.dataset.chosen).name;
    }, 70);
  },

  getColors: () => {
    return ["rgb(255, 255, 255)", "rgb(255, 0, 0)", "rgb(255, 106, 0)", "rgb(255, 200, 0)", "rgb(187, 255, 0)", "rgb(51, 255, 0)", "rgb(0, 255, 213)", "rgb(0, 132, 255)", "rgb(0, 90, 255)", "rgb(72, 0, 255)", "rgb(119, 0, 255)", "rgb(195, 0, 255)", "rgb(255, 0, 225)"]
  },

  colorPicker: (style, onclick, rgb, realStyle) => {
    return `
    <div data-r="${rgb.r}" data-g="${rgb.g}" data-b="${rgb.b}" style="${realStyle}">
    <div class="flexbox" style="width: 33px; overflow: hidden; height: 33px; margin: auto; transition: all var(--commonAnimation) var(--ease-strong);" onclick="studioUI.togglePicker(this)">
    <btn class="flexbox" style="width: 33px; height: 33px; padding: 0px; margin: auto; ${style || ""}">
      <div class="image editAction"></div>
    </btn>

    ${studioUI.getColors().map((color) => {
      return `<div class="palette" style="background: ${color};" onclick="this.parentElement.dataset.r = ${color.replaceAll('rgb(', '').replaceAll(')', '').split(', ')[0]}; this.parentElement.dataset.g = ${color.replaceAll('rgb(', '').replaceAll(')', '').split(', ')[1]}; this.parentElement.dataset.b = ${color.replaceAll('rgb(', '').replaceAll(')', '').split(', ')[2]}; ${onclick}"></div>`
    }).join('')}
    </div>
    `
  },

  colorSlider: (options, style) => {
    return `
    <input type="range" onchange="${options.onclick[1]}" style="--chosenColor: hsl(${options.hsl}, 100%, ${options.brightness}); ${style[0]}" class="slider" value="${options.hsl}" step="0.001" max="360" min="0" oninput="studioUI.colorChange(this); ${options.onclick[0]}">
    ${options.inbetween || ""}
    <input type="range" onchange="${options.onclick[2]}" style="--chosenColor: rgb(${opposite(options.brightness) * 255}, ${opposite(options.brightness) * 255}, ${opposite(options.brightness) * 255}); ${style[1]}" class="slider bw" value="${options.brightness}" step="0.001" max="1" min="0" oninput="studioUI.colorChange(this.previousElementSibling); this.previousElementSibling.oninput(); this.previousElementSibling.onchange();">
    `
  },


  colorChange: (slider) => {
    var val = slider.value;
    var val2 = slider.nextElementSibling.value;
    slider.style.setProperty('--chosenColor', `hsl(${val}, 100%, ${val2 * 100}%)`)
    slider.nextElementSibling.style.setProperty('--chosenColor', `rgb(${opposite(val2) * 255}, ${opposite(val2) * 255}, ${opposite(val2) * 255})`)
  },

  togglePicker: (element) => {
    let sibling = element;
    if (sibling.style.width == '33px') {
      sibling.style.width = '518.4px'
      setTimeout(() => {
        sibling.style.overflow = 'visible'
      }, editorSettings.commonAnimation * 100);
    } else {
      sibling.style.width = '33px'
      sibling.style.overflow = 'hidden'
    }
  },

  colorPickerToggle: (id, constant) => {
    document.getElementById(`${constant}red`).style.width = '0%'
    document.getElementById(`${constant}red`).style.opacity = '0%'
    document.getElementById(`${constant}red`).style.height = '0px'
    document.getElementById(`${constant}green`).style.width = '0%'
    document.getElementById(`${constant}green`).style.opacity = '0%'
    document.getElementById(`${constant}green`).style.height = '0px'
    document.getElementById(`${constant}blue`).style.width = '0%'
    document.getElementById(`${constant}blue`).style.opacity = '0%'
    document.getElementById(`${constant}blue`).style.height = '0px'

    setTimeout(() => {
      if (resolvedToggles[constant] != id) {
        document.getElementById(id).style.width = '100%'
        document.getElementById(id).style.opacity = '1'
        document.getElementById(id).style.height = '30px'
        resolvedToggles[constant] = id;
      } else {
        resolvedToggles[constant] = undefined;
      }
    }, resolvedToggles[constant] ? editorSettings.commonAnimation * 100 : 1);
  },
}