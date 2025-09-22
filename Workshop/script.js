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
    </div>
  `
}

// workshop.getItems(null, {

// }).then((result) => {
//   result.items.forEach(element => {
//     element.previewUrl
//   });
// })

  let workshopPath = `${process.cwd()}/../../workshop/content/3994990/`
  if (!fs.existsSync(workshopPath)) {
    workshopPath = `C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\3994990`
  }

workshop.getAllItems(1, workshop.UGCQueryType.RankedByPublicationDate, workshop.UGCType.All, 3994990, 3994990, {
  cachedResponseMaxAge: 0
}).then((paginatedResult) => {
  console.log(paginatedResult)
  paginatedResult.items.forEach(element => {
    document.getElementById('results').innerHTML += createWorkshopItem(element);
  })
})

function startUpload() {
  ipcRenderer.send('uploadFolder');
}