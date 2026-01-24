let levels = [];
const Clusterize = require('clusterize.js');
let files = fs.readdirSync('./Beatmaps/');

for (let i in files) {
  try {
    let information = JSON.parse(fs.readFileSync(`./Beatmaps/${files[i]}/information.json`));
    let beatmaps = {};
    for (let index in information.difficulties) {
      beatmaps[index] = JSON.parse(fs.readFileSync(`./Beatmaps/${files[i]}/${information.difficulties[index]}`));
    }
    if (information.ratings) {
      levels.push({
        beatmaps,
        information: information,
        location: files[i]
      })
    }
  } catch (error) { console.log(error) }
}

let chosenSong = 0;
let levelsDisplay = document.getElementById('levels')

document.getElementById('amount').innerHTML = `${levels.length} Songs`;

let difficultyMap = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
  4: "Expert"
}

let mappedLevels = levels.map((level, index) => {
  try {
    let difficulties = ``;
    for (let i in level.information.difficulties) {
      difficulties += `<div class="difficulty-dot flexbox ${difficultyMap[i].toLowerCase()}"><difficulty>${level.information.ratings[i]}</difficulty></div>`;
    }
    level.difficulties = difficulties;
    return `
    <div class="songTile flexbox" onclick="highlightSong(${index})" id="level-${index}" data-index="${index}" data-name="${level.information.name.toLowerCase()}" data-artist="${level.information.artist.toLowerCase()}">  
      <div class="song-cover" style="background-image: url('${process.cwd().replaceAll('\\', '/')}/Beatmaps/${level.location}/${level.information.cover}')">
      </div>
      <div class="song-details">
          <btextm class="song_name">${level.information.name} <span class="small">${level.information.romanizedName || ""}</span></btextm>
          <btextm class="song_artist" style="margin-bottom: auto;">${level.information.artist}</btextm>
        <div class="flexbox difficulties-preview">${difficulties}</div>
      </div>
    </div>
    `

    levelsDisplay.appendChild(item);
  } catch (error) { }
});
var clusterize = new Clusterize({
  rows: mappedLevels,
  scrollId: "levels",
  contentId: "levelsContent",
  rows_in_block: 5,
  blocks_in_cluster: 4,
})


let currentAudio = null;
let currentAudioStopTimer = null;
let lastSelectedDifficulty = getSetting('preferredDifficulty', 1);

async function highlightSong(index, scrollOffset = 0) {
  // if (levels[index].element.style.display == 'none') {
  //   return;
  // };

  document.getElementById('level-' + chosenSong)?.classList.remove('highlighted');
  document.getElementById('level-' + index)?.classList.add('highlighted');
  const levelsContainer = document.getElementById('levels');
  const selectedTile = document.getElementById('level-' + index);
  const containerRect = levelsContainer.getBoundingClientRect();
  const tileRect = selectedTile.getBoundingClientRect();
  const scrollTop = (selectedTile.offsetTop - levelsContainer.offsetTop) - (containerRect.height / 2) + (tileRect.height / 2);


  document.getElementById('levels').scrollTo({
    top: scrollTop,
    behavior: 'smooth'
  });

  chosenSong = index;

  const level = levels[chosenSong];
  const basePath = `${process.cwd().replaceAll('\\', '/')}/Beatmaps/${level.location}`;

  // Update UI elements
  document.getElementById('song-cover').style.backgroundImage = `url('${basePath}/${level.information.cover}')`;
  document.getElementById('songs').style.backgroundImage = `url('${basePath}/${level.information.cover}')`;
  document.getElementById('song-cover').style.scale = '1';
  document.getElementById('song-cover').style.opacity = '1';
  document.getElementById('song-title').innerText = level.information.name;
  document.getElementById('song-credits').innerHTML = level.information.credits || "Unknown credits";
  // document.getElementById('song-author').innerText = level.information.artist;
  let difficulties = ``;
  let difficulties_ = level.information.difficulties;
  if (lastSelectedDifficulty != `${settings.preferredDifficulty}` && difficulties_[`${settings.preferredDifficulty}`]) {lastSelectedDifficulty = `${settings.preferredDifficulty}`} else
  if (!difficulties_[lastSelectedDifficulty] && difficulties_[settings.preferredDifficulty]) {lastSelectedDifficulty = `${settings.preferredDifficulty}`}
  else if (!difficulties_[lastSelectedDifficulty]) lastSelectedDifficulty = Object.keys(level.information.difficulties)[0];

  for (let i in level.information.difficulties) {
    difficulties += `<div id="difficulty-${i}" onclick="selectDifficulty(${i})" class="difficulty-dot flexbox clickable ${difficultyMap[i].toLowerCase()} ${i == lastSelectedDifficulty ? 'highlighted' : ''}"><div class="dotParent"><difficulty-name>${difficultyMap[i]}</difficulty-name> <difficulty-level>${level.information.ratings[i]}</difficulty-level></div></div>`;
  }
  document.getElementById('song-difficulties').innerHTML = difficulties;
  stopCurrentPreview();

  const audio = new Audio(`../Beatmaps/${level.location}/audio.mp3`);
  currentAudio = audio;

  const playPreview = () => {
    if (audio !== currentAudio) return;
    audio.volume = 0

    setTimeout(() => {
      audio.volume = 0.1
    }, 120);
    setTimeout(() => {
      audio.volume = 0.2;
    }, 150);
    setTimeout(() => {
      audio.volume = 0.5;
    }, 190);
    setTimeout(() => {
      audio.volume = 0.7;
    }, 210);
    setTimeout(() => {
      audio.volume = 1;
    }, 250);

    if (audio.duration) {
      audio.currentTime = Math.min(Math.floor(audio.duration / 2), audio.duration - 15);
    } else {
      audio.currentTime = 30;
    }

    audio.play().catch(e => console.error("Audio play failed:", e));

    currentAudioStopTimer = setTimeout(() => {
      if (audio === currentAudio) {
        stopCurrentPreview();
      }
    }, 15000);
  };

  // Try to play when ready
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    playPreview();
  } else {
    audio.addEventListener('canplay', playPreview, { once: true });
  }

  // Cleanup if audio fails
  audio.addEventListener('error', () => {
    if (audio === currentAudio) {
      stopCurrentPreview();
    }
  });
}

function selectDifficulty(difficulty) {
  let difficulties = document.getElementById('song-difficulties');
  difficulties.querySelectorAll('.difficulty-dot').forEach(dot => dot.classList.remove('highlighted'));
  difficulties.querySelector(`#difficulty-${difficulty}`).classList.add('highlighted');
  lastSelectedDifficulty = difficulty;
  settings.preferredDifficulty = difficulty;
  saveSettings();
}



function stopCurrentPreview() {
  if (currentAudioStopTimer) {
    clearTimeout(currentAudioStopTimer);
    currentAudioStopTimer = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.removeAttribute('src');
    currentAudio.load();
    currentAudio = null;
  }
}
highlightSong(0);

document.onkeydown = (event) => {
  if (event.key == 'ArrowDown') {
    highlightSong((chosenSong + 1) % levels.length);
  } else if (event.key == 'ArrowUp') {
    highlightSong((chosenSong + levels.length - 1) % levels.length);
  } else if (event.key == 'Enter') {
    play();
  }
}

function play() {
  document.getElementById('song').style.transform = 'translateX(500px)';
  document.getElementById('songs').style.transform = 'translateX(-100vw)';

  setTimeout(() => {
    fs.writeFileSync('./Core/crossdetails', JSON.stringify({ location: levels[chosenSong].location, difficulty: lastSelectedDifficulty, map: levels[chosenSong].information.difficulties[lastSelectedDifficulty] }, null, 2));
    location.href = '../Playfield/playfield.html'
  }, 400);
}

let wheelEvent = (event) => {
  event.preventDefault();
  if (event.deltaY > 0) {
    if (chosenSong == levels.length - 1) return;
    highlightSong((chosenSong + 1));
  } else if (event.deltaY < 0) {
    if (chosenSong == 0) return;
    highlightSong((chosenSong + levels.length - 1) % levels.length);
  }
}

globalControllerActions.downMove = () => {
  if (chosenSong == levels.length - 1) return;
  highlightSong((chosenSong + 1));
}

globalControllerActions.upMove = () => {
  if (chosenSong == 0) return;
  highlightSong((chosenSong + levels.length - 1) % levels.length);
}
globalControllerActions.upMoveTakenDown = true;
globalControllerActions.downMoveTakenDown = true;


document.addEventListener('wheel', wheelEvent, { passive: false });

globalControllerActions.leftTrigger = () => {
  let supposedDifficulty = lastSelectedDifficulty - 1
  let difficultyElement = document.getElementById(`difficulty-${supposedDifficulty}`);
  if (!difficultyElement) return

  selectDifficulty(supposedDifficulty);
}


globalControllerActions.rightTrigger = () => {
  let supposedDifficulty = Number(lastSelectedDifficulty) + 1
  let difficultyElement = document.getElementById(`difficulty-${supposedDifficulty}`);
  if (!difficultyElement) return

  selectDifficulty(supposedDifficulty);
}

globalControllerActions.aTrigger = () => {
  play();
}

let mouseDownStarted = null;
document.addEventListener('mousedown', (event) => {
  console.log('md')
  mouseDownStarted = { x: event.x };
});
document.addEventListener('mouseup', () => {
  mouseDownStarted = null;
})

// document.addEventListener('mousemove', (event) => {
//   if (mouseDownStarted) {
//     let movement = Math.abs(event.y - mouseDownStarted.y);
//     let addition = -1;
//     if (event.y < mouseDownStarted.y) {
//       addition = 1;
//     }
//     if (movement > 90) {
//       wheelEvent({ deltaY: addition, preventDefault: () => { } });
//       mouseDownStarted = { y: event.y };
//     }
//   }
// })

function startSearch(query) {
  let possibleMatches = document.querySelectorAll('.songTile');
  let firstSelected = null;
  for (let i = 0; i < possibleMatches.length; i++) {
    console.log(possibleMatches[i].dataset.name)
    if ((possibleMatches[i].dataset.name?.includes(query.toLowerCase()) || query == "")) {
      if (firstSelected == null) {
        firstSelected = i - 1;
      }
      possibleMatches[i].style.display = 'block';
      possibleMatches[i].style.scale = '1';
    } else if (i != 0) {
      possibleMatches[i].style.display = 'none';
      possibleMatches[i].style.scale = '0';
    }
  }
  if (firstSelected != null) {
    highlightSong(firstSelected);
  }
}

setInterval(() => {
  try {
    if (!document.getElementById('level-' + chosenSong).classList.contains('highlighted')) {
      document.getElementById('level-' + chosenSong).classList.add('highlighted');
    }
  } catch (error) { console.log(error) }
}, 50)