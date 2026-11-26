// Keyboard + mouse + wheel input for the Skylark.
// Keys are read as a live state object; the game loop polls it every tick, so
// holding a key feels continuous and tapping one feels responsive.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitchUp: false,   // W / ArrowUp — nose up, climb
    pitchDown: false, // S / ArrowDown — nose down, descend
    bankLeft: false,  // A / ArrowLeft
    bankRight: false, // D / ArrowRight
    throttleUp: false,   // Shift
    throttleDown: false, // Control
    boost: false,     // Space (held = boost while fuel lasts)
    pointerX: 0.5,    // 0..1 across the canvas — mouse steering
    pointerActive: false,
    wheelDelta: 0,    // accumulated wheel steps since last tick
    paused: false,
    muted: false,
  };

  // One-shot actions the main loop consumes (edge triggered, not held).
  const pressed = new Set();

  const KEYMAP = {
    KeyW: 'pitchUp', ArrowUp: 'pitchUp',
    KeyS: 'pitchDown', ArrowDown: 'pitchDown',
    KeyA: 'bankLeft', ArrowLeft: 'bankLeft',
    KeyD: 'bankRight', ArrowRight: 'bankRight',
    ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
    ControlLeft: 'throttleDown', ControlRight: 'throttleDown',
    Space: 'boost',
  };

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
    const field = KEYMAP[e.code];
    if (field) state[field] = true;
    if (e.code === 'KeyP') state.paused = !state.paused;
    if (e.code === 'KeyM') state.muted = !state.muted;
    if (e.code === 'KeyR') pressed.add('restart');
  }

  function onKeyUp(e) {
    keys.delete(e.code);
    const field = KEYMAP[e.code];
    if (field) state[field] = false;
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    state.pointerX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.pointerActive = true;
  }

  function onPointerLeave() {
    state.pointerActive = false;
  }

  function onWheel(e) {
    e.preventDefault();
    state.wheelDelta += e.deltaY < 0 ? 1 : -1;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    state,
    // True once for the tick after the key went down, then cleared.
    wasPressed(code) {
      return pressed.has(code);
    },
    // Mouse steering: -1 (full left) .. +1 (full right) from pointer position.
    steerAmount() {
      if (!state.pointerActive) return 0;
      return (state.pointerX - 0.5) * 2;
    },
    // Wheel steps since last call; resets to zero.
    takeWheel() {
      const d = state.wheelDelta;
      state.wheelDelta = 0;
      return d;
    },
    endTick() {
      pressed.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
