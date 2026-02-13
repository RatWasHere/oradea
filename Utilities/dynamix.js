const { webFrame } = require('electron');

let resizingScript = () => {
    if (window.outerWidth < 1000 || window.outerHeight < 800) {
        webFrame.setZoomFactor(0.7)
    } else {
        webFrame.setZoomFactor(1)
    }
};

window.onresize = () => {
    console.log("eeeeee")
}
window.addEventListener('resize', resizingScript);
window.addEventListener('change', requestAnimationFrame(resizingScript));

if (window.outerWidth < 1000 || window.outerHeight < 800) {
    webFrame.setZoomFactor(0.8)
} else {
    webFrame.setZoomFactor(1)
}
