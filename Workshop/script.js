let search_sorting = new SlimSelect({
  select: '#filter',
  settings: {
    showSearch: false
  },
  events: {
    afterOpen: () => {
      search_sorting.store.getDataOptions().forEach(element => {
        document.querySelector(`[data-id="${element.id}"]`).classList.add('controller_selectable')
      })
    },
    beforeClose: () => {
      search_sorting.store.getDataOptions().forEach(element => {
        document.querySelector(`[data-id="${element.id}"]`).classList.remove('controller_selectable', 'selected')
      })
    },
  },
  cssClasses: {
    main: ['ss-main', 'controller_selectable']
  }
});

console.log(search_sorting)

const steamworks = require('steamworks.js');
var client = steamworks.init(3994990);
var workshop = client.workshop;

function createWorkshopItem(details) {
  return `
    <div class="workshopItem flexbox controller_selectable">
      <div class="worskhopItemPreview" style="background-image: url('${details.previewUrl}')"></div>
      <div class="workshopItemDetails">
        <btext class="workshopItemName">${details.title}</btext><br>
        <btext class="workshopItemDescription">${details.description || "No description"}</btext>
      </div>
      <div class="workshopItemControls">
      <btn class="glyph_select">Download</btn>
      <btn class="glyph_deselect" onclick="previewWorkshopItem('${details.publishedFileId}', this)">Preview</btn>
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
  console.log('')
  button.classList.add('buffering')
  workshop.download(BigInt(publishedFileId), true);
  let getItemProgress = () => {
    let current = workshop.downloadInfo(BigInt(publishedFileId)).current;
    let total = workshop.downloadInfo(BigInt(publishedFileId)).total;
    let exists = fs.existsSync(`${workshopPath}/${publishedFileId}/audio.mp3`);
    if (current == total && exists) {
      if (currentlyPlayingPreviewAudio) { currentlyPlayingPreviewAudio.pause(); currentlyPlayingPreviewAudio.remove() };
      let audio = new Audio(`${workshopPath}/${publishedFileId}/audio.mp3`);
      currentlyPlayingPreviewAudio = audio;
      setTimeout(() => {
        audio.play().then(() => {
          audio.currentTime = Math.round(audio.duration / 2);
        });
      }, 300);
    button.classList.remove('buffering');
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

globalControllerActions.bTrigger = () => {
  ipcRenderer.send('closeWorkshop');
}

globalControllerActions.aTrigger = () => {
  if (currentEl.className.includes("workshopItem")) {
    currentEl.querySelector('.glyph_select').click();
  }
}

globalControllerActions.xTrigger = () => {
  if (currentEl.className.includes("workshopItem")) {
    currentEl.querySelector('.glyph_deselect').click();
  }
}