(function() {
    const THRESHOLD = 0.5; // Stick sensitivity
    let prevState = { up: false, down: false, left: false, right: false };

    function emitEvent(name) {
        window.dispatchEvent(new CustomEvent(name));
    }

    function pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let gp of gamepads) {
            if (!gp) continue;

            // D-pad
            let up = gp.buttons[12]?.pressed;
            let down = gp.buttons[13]?.pressed;
            let left = gp.buttons[14]?.pressed;
            let right = gp.buttons[15]?.pressed;

            // Left stick (axes)
            if (gp.axes) {
                if (gp.axes[1] < -THRESHOLD) up = true;
                if (gp.axes[1] > THRESHOLD) down = true;
                if (gp.axes[0] < -THRESHOLD) left = true;
                if (gp.axes[0] > THRESHOLD) right = true;
            }

            // Emit events on edge (pressed, not held)
            if (up && !prevState.up) emitEvent('scrollup');
            if (down && !prevState.down) emitEvent('scrolldown');
            if (left && !prevState.left) emitEvent('scrollleft');
            if (right && !prevState.right) emitEvent('scrollright');

            prevState = { up, down, left, right };
        }
        requestAnimationFrame(pollGamepads);
    }

    window.addEventListener('gamepadconnected', pollGamepads);

    // Optionally, start polling immediately
    pollGamepads();
})();