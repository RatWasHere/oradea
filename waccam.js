const socket = new WebSocket('ws://192.168.100.235:3000/');

socket.onopen = () => {
  socket.send(JSON.stringify({
    w: window.innerWidth,
    h: window.innerHeight
  }));
};

socket.onmessage = (event) => {
  console.log('Received from PC:', event.data);
};

let handleTouch = (event) => {
  event.preventDefault();

  socket.send(JSON.stringify({
    x0: event.touches[0]?.clientX,
    y0: event.touches[0]?.clientY,
    x1: event.touches[1]?.clientX,
    y1: event.touches[1]?.clientY
  }))
}

let releaseTouch = (event) => {
  event.preventDefault();

  socket.send(JSON.stringify({
    x0: event.touches[0]?.clientX,
    y0: event.touches[0]?.clientY,
    x1: event.touches[1]?.clientX,
    y1: event.touches[1]?.clientY
  }))
}


document.body.addEventListener('touchstart', handleTouch, false);
document.body.addEventListener('touchmove', handleTouch, false);
document.body.addEventListener('touchend', releaseTouch, false);