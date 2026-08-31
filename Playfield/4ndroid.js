var isAndroid = /Android/i.test(navigator.userAgent);
const SERVER_URL = 'http://192.168.1.50:8080/';

if (isAndroid) {
  var settings = {
    // hexagon_size: 0.5,
    note_speed: 14.5,
    input_mode: "touch",
    perfection_indicator: 0
  }

  function getSetting(key, dflt) {
    if (key in settings) {
      return settings[key]
    } else {
      return dflt
    }
  }


  let requestedFs = false;
  window.addEventListener('touchend', () => {
    var elem = document.body;
    if (!requestedFs) {
      elem.requestFullscreen();
      requestedFs = true;
    }
  })

  if (isAndroid) {
    document.body.style.zoom = 0.5;
  }
}