let categories = [];
let categoryElements = document.querySelectorAll('.category_contents');
categoryElements.forEach((element, index) => {
  categories.push({
    name: element.dataset.category,
    association: element
  });
  element.firstElementChild.innerHTML = `
  <btextm style="padding-bottom: 5px; padding-left: 5px; display: block; font-family: 'Modern'">${element.dataset.category}</btextm>
  `
  document.getElementById(element.dataset.associate).innerHTML += `
  <div class="category_selector controller_selectable" onclick="selectCategory(${index})" id="category_${element.dataset.associate}">${element.dataset.category}</div>
  `
  element.style.display = 'none';
});
categoryElements[0].style.display = 'block';
let currentCategory;
function selectCategory(category) {
  if (currentCategory) {
    currentCategory.association.style.display = 'none';
    document.getElementById(`category_${currentCategory.association.dataset.associate}`).classList.remove('selected');
   };
  currentCategory = categories[category];
  let categoryTag = document.getElementById(`category_${currentCategory.association.dataset.associate}`);
  categoryTag.classList.add('selected');
  currentCategory.association.style.display = 'block';
}
selectCategory(0);

function initPlayfieldConfig() {
  updateNS();
  document.getElementById('hexagon_size_preview').innerText = `(${getSetting('hexagon_size', 1)})`;
  document.getElementById('hexagon_size').value = getSetting('hexagon_size', 1);
  document.getElementById('snap_extension').value = getSetting('snap_extension', 21);
  document.getElementById('snap_extension_preview').innerText = `(${getSetting('snap_extension', 21)})`;
}
function updateNS() {
  let configuredNotespeed = getSetting('note_speed', 6);
  document.getElementById('note_speed').innerText = `(${configuredNotespeed})`;
  document.getElementById('note_speed_preview').innerText = configuredNotespeed;
  document.getElementById('noteForDemonstration').style.animationDuration = (5 / configuredNotespeed) + 's'

}
function addToNS(val) {
  let configuredNotespeed = getSetting('note_speed', 6);
  let supposedNS = Math.round((parseFloat(configuredNotespeed) + parseFloat(val)) * 10) / 10;
  if (supposedNS < 1 || supposedNS > 30) return
  settings.note_speed = supposedNS;
  updateNS();
  saveSettings();
}
function updateHexagonSize(newValue) {
  settings.hexagon_size = newValue;
  saveSettings();
  document.getElementById('hexagon_size_preview').innerText = `(${getSetting('hexagon_size', 1)})`;

  console.log(newValue)
  require('electron').ipcRenderer.send('updateHexagon', `${newValue}`);
}
function startHoldingHexagon() {
    require('electron').ipcRenderer.send('updateHexagon', `${settings.hexagon_size}`);
  let mouseUpListener = () => {
    require('electron').ipcRenderer.send('doneUpdatingHexagon');
    document.removeEventListener('mouseup', mouseUpListener);
  }
  document.addEventListener('mouseup', mouseUpListener);
}

initPlayfieldConfig();