const fs = require('fs');

let levels = [];

let files = fs.readdirSync('./Beatmaps/');

for (let i in files) {
  try {
    let information = JSON.parse(fs.readFileSync(`./Beatmaps/${files[i]}/information.json`));
    let beatmaps = {};
    for (let index in information.difficulties) {
      beatmaps[index] = JSON.parse(fs.readFileSync(`./Beatmaps/${files[i]}/${information.difficulties[index]}`));
    }
    levels.push({
      beatmaps,
      information: information,
      location: files[i]
    })
  } catch (error) { console.log(error) }
}

let chosenSong = 0;
let levelsDisplay = document.getElementById('levels')

document.getElementById('amount').innerHTML = `${levels.length} Charts`;

let difficultyMap = {
  1: "Easy",
  2: "Normal",
  3: "Hard",
  4: "Expert"
}

levelsDisplay.innerHTML = `
<div style="height: 400px;"></div>
`

levels.forEach((level, index) => {
  let difficulties = ``;
  for (let i in level.information.difficulties) {
    difficulties += `<btext style="padding: 2px; padding-left: 10px; padding-right: 10px; background: var(--difficulty-${i}); border-radius: 100px;">${difficultyMap[i]} - ${Math.round(level.information.duration / level.beatmaps[i]?.length * 10) / 10}NPS</btext> `;
  }
  let item = document.createElement('div');
  item.className = 'songTile flexbox'
  item.id = `level-${index}`
  level.difficulties = difficulties;
  item.innerHTML = `
  <div>
  <btextm>${level.information.name} <span class="small">${level.information.romanizedName || ""}</span></btextm><br>
  <btext>${level.information.artist}</btext><br>
  <div style="margin-bottom:  0px; width: auto;">${difficulties}</div>
  </div>
  <div class="image" style="background-image: url('${process.cwd().replaceAll('\\', '/')}/Beatmaps/${level.location}/${level.information.cover}')"></div>
  `
  levelsDisplay.appendChild(item)
});
  levelsDisplay.innerHTML += `
  <div style="height: 400px;"></div>
  `


let currentAudio = null;
let currentAudioStopTimer = null;

async function highlightSong(index) {
  // Remove highlight from previous song
  document.getElementById('level-' + chosenSong)?.classList.remove('highlighted');
  // Add highlight to new song
  document.getElementById('level-' + index)?.classList.add('highlighted');
  document.getElementById('levels').scrollTo({
    top: (document.getElementById('level-' + index).offsetTop - document.getElementById('level-' + index).getBoundingClientRect().height) - 50,
    left: 0,
    behavior: 'smooth'
  })
  console.log(document.getElementById('level-' + index).scrollTop)

  chosenSong = index;

  const level = levels[chosenSong];
  const basePath = `${process.cwd().replaceAll('\\', '/')}/Beatmaps/${level.location}`;

  // Update UI elements
  // document.getElementById('song').style.backgroundImage = `url('${basePath}/${level.information.cover}')`;
  document.getElementById('song-cover').style.backgroundImage = `url('${basePath}/${level.information.cover}')`;
  document.getElementById('song-cover').style.scale = '1';
  document.getElementById('song-cover').style.opacity = '1';
  document.getElementById('song-name').innerHTML = level.information.name;
  document.getElementById('song-author').innerHTML = level.information.artist;
  document.getElementById('song-difficulties').innerHTML = level.difficulties;

  // Stop previous audio preview and cleanup
  stopCurrentPreview();

  // Create new audio
  const audio = new Audio(`../Beatmaps/${level.location}/audio.mp3`);
  currentAudio = audio;

  // Set up play handler
  const playPreview = () => {
    // Ensure this is still the current audio (user hasn't clicked another song)
    if (audio !== currentAudio) return;

    // Play from the middle
    if (audio.duration) {
      audio.currentTime = Math.min(Math.floor(audio.duration / 2), audio.duration - 15);
    } else {
      // Fallback if duration isn't available yet
      audio.currentTime = 30;
    }

    audio.play().catch(e => console.error("Audio play failed:", e));

    // Set timeout to stop after 15 seconds
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
  document.getElementById('song').style.transform = 'translateX(50vw)';
  document.getElementById('songs').style.transform = 'translateX(-50vw)';
  document.getElementById('level-' + chosenSong).classList.remove('highlighted');

  setTimeout(() => {
    fs.writeFileSync('./crossdetails', JSON.stringify({ location: levels[chosenSong].location, difficulty: 2, map: levels[chosenSong].information.difficulties[2] }, null, 2));
    location.href = '../index.html'
  }, 400);
}

document.addEventListener('wheel', event => {
  event.preventDefault();
  if (event.deltaY > 0) {
    highlightSong((chosenSong + 1) % levels.length);
  } else if (event.deltaY < 0) {
    highlightSong((chosenSong + levels.length - 1) % levels.length);
  }
}, { passive: false });