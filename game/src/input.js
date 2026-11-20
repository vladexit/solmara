// Keyboard + mouse input. Movement is reported as a wish on the screen axes
// (x = strafe, y = forward); the caller rotates it by the camera yaw into the
// world. One-shot presses are queued as bit flags and taken once by the loop.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_DANCE = 16;
export const ACTION_RADIO = 32;
export const ACTION_MUTE = 64;
export const ACTION_CONTINUE = 128;
export const ACTION_HORN = 256;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_PUNCH,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_DANCE,
  KeyR: ACTION_RADIO,
  KeyM: ACTION_MUTE,
  KeyC: ACTION_CONTINUE,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyH: ACTION_HORN,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragDx = 0;
  let dragDy = 0;
  let wheel = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (KEY_ACTIONS[event.code]) {
      actions |= KEY_ACTIONS[event.code];
      if (event.code === 'Space' || event.code === 'Enter') event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onPointerDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onPointerMove(event) {
    if (!dragging) return;
    dragDx += event.clientX - lastX;
    dragDy += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onPointerUp() {
    dragging = false;
  }
  function onWheel(event) {
    wheel += Math.sign(event.deltaY);
    event.preventDefault();
  }
  function onBlur() {
    keys.clear();
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // WASD / arrows as a -1..1 wish on the screen axes.
  function moveWish() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }
  function takeDrag() {
    const d = { dx: dragDx, dy: dragDy, wheel };
    dragDx = 0;
    dragDy = 0;
    wheel = 0;
    return d;
  }

  return { moveWish, takeActions, takeDrag };
}
