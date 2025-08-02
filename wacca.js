const http = require('http');
http.createServer((req, res) => {
  res('hello!')
})

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });
let stateH = 0;
let stateW = 0;

let is0Pressed = false;
let is1Pressed = false;

wss.on('connection', ws => {
  console.log('Client connected');
  ws.on('message', msg => {
    let message = JSON.parse(msg.toString())
    if (message.w && message.h) {
      game.gameState.phone = message;
      game.gameState.gamepad = message;
      stateH = message.h;
      stateW = message.w;
      return
    }
    if (message.x0 && !is0Pressed) {
      is0Pressed = true;
      game.inputSystem.handleKeyDown({ key: 'w' });
    } else if (!message.x0) {
      is0Pressed = false;
      game.inputSystem.handleKeyUp({ key: 'w' });
    }
    if (message.x1 && !is1Pressed) {
      is1Pressed = true;
      game.inputSystem.handleKeyDown({ key: 's' });
    } else if (!message.x1) {
      is1Pressed = false;
      game.inputSystem.handleKeyUp({ key: 's' });
    }

    if (stateH) {
      const centerX = stateW / 2;
      const centerY = stateH / 2;

      const angle0 = Math.atan2(message.y0 - centerY, message.x0 - centerX);
      const angleDegrees0 = angle0 * (180 / Math.PI);

      const angle1 = message.y1 ? Math.atan2(message.y1 - centerY, message.x1 - centerX) : angle0;
      const angleDegrees1 = angle1 * (180 / Math.PI);

      game.inputSystem.updateRotations(angleDegrees0, angleDegrees1);
    }

    // console.log('Received:', message, stateH, stateW);
  });
});
