new SlimSelect({
  select: '#filter',
  settings: {
    showSearch: false
  }
});

const steamworks = require('steamworks.js');
var client = steamworks.init(3994990);
var workshop = client.workshop;

function createWorkshopItem(details) {
  return `
    <div class="workshopItem flexbox">
      <div class="worskhopItemPreview" style="background-image: url('${details.previewUrl}')"></div>
      <div class="workshopItemDetails">
        <btext class="workshopItemName">${details.title}</btext><br>
        <btext class="workshopItemDescription">${details.description || "No description"}</btext>
      </div>
      <div class="workshopItemControls">
      <btn>DOWN</btn>
      <btn onclick="previewWorkshopItem('${details.publishedFileId}', this)">PREV</btn>
      </div>
    </div>
  `
}


let workshopPath = `${process.cwd()}/../../workshop/content/3994990/`
if (!fs.existsSync(workshopPath)) {
  workshopPath = `C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\3994990`
}

let currentlyPlayingPreviewAudio;

function previewWorkshopItem(publishedFileId, button) {
  button.classList.add('buffering')
  workshop.download(BigInt(publishedFileId), true);
  let getItemProgress = () => {
    let current = workshop.downloadInfo(BigInt(publishedFileId)).current;
    let total = workshop.downloadInfo(BigInt(publishedFileId)).total;
    console.log(current, total)
    if (current == total) {
      if (currentlyPlayingPreviewAudio) {currentlyPlayingPreviewAudio.pause(); currentlyPlayingPreviewAudio.remove()};
      let audio = new Audio(`${workshopPath}/${publishedFileId}/audio.mp3`);
      currentlyPlayingPreviewAudio = audio;
      audio.play().then(() => {
        audio.currentTime = Math.round(audio.duration / 2);
      });
    } else setTimeout(() => {
      getItemProgress();
    }, 100);
  }
  getItemProgress();
}

// workshop.getItems(null, {

// }).then((result) => {
//   result.items.forEach(element => {
//     element.previewUrl
//   });
// })


workshop.getAllItems(1, workshop.UGCQueryType.RankedByPublicationDate, workshop.UGCType.All, 3994990, 3994990, {
  cachedResponseMaxAge: 0
}).then((paginatedResult) => {
  console.log(paginatedResult)
  paginatedResult.items.forEach(element => {
    element.publishedFileId
    document.getElementById('results').innerHTML += createWorkshopItem(element);
  })
})

function startUpload() {
  ipcRenderer.send('uploadFolder');
}