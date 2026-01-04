const isAndroid = /Android/i.test(navigator.userAgent);

if (isAndroid) {
  var settings = {
    hexagon_size: 0.5,
    note_speed: 14.5,
    input_mode: "touch"
  }

  function getSetting(key, dflt) {
    if (key in settings) {
      return settings[key]
    } else {
      return dflt
    }
  }


  window.addEventListener('touchend', () => {
    var elem = document.body;
    elem.requestFullscreen();
  })

  if (isAndroid) {
    document.body.style.zoom = 0.5;
  }
}