/**
 * Touch + keyboard input for flippers and plunger.
 */

export function createInputState() {
  return {
    left: false,
    right: false,
    mini: false,
    plungerPulling: false,
    plungerStartY: 0,
    plungerCurrentY: 0,
    plungerPull: 0,
    keys: new Set(),
  };
}

export function bindInput(canvas, input, opts = {}) {
  const maxPull = opts.maxPullPx || 120;
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    if (!src) return null;
    return {
      x: ((src.clientX - rect.left) / rect.width) * canvas.width,
      y: ((src.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onDown = (e) => {
    if (e.cancelable) e.preventDefault();
    const p = getPos(e);
    if (!p) return;
    const mid = canvas.width / 2;
    // Plunger zone: right edge lower third
    const inPlunger =
      p.x > canvas.width * 0.82 && p.y > canvas.height * 0.55;
    if (inPlunger) {
      input.plungerPulling = true;
      input.plungerStartY = p.y;
      input.plungerCurrentY = p.y;
      input.plungerPull = 0;
      return;
    }
    if (p.x < mid) input.left = true;
    else input.right = true;
  };

  const onMove = (e) => {
    if (!input.plungerPulling) return;
    if (e.cancelable) e.preventDefault();
    const p = getPos(e);
    if (!p) return;
    input.plungerCurrentY = p.y;
    const dy = Math.max(0, p.y - input.plungerStartY);
    input.plungerPull = Math.max(0, Math.min(1, dy / maxPull));
  };

  const onUp = (e) => {
    if (e.cancelable) e.preventDefault();
    if (input.plungerPulling) {
      input.plungerPulling = false;
      // leave plungerPull for game to consume as launch
      input._launch = input.plungerPull;
      return;
    }
    // release both on any up for simplicity with multi-touch tracking
    if (e.touches && e.touches.length > 0) {
      // still touching — recompute
      input.left = false;
      input.right = false;
      for (let i = 0; i < e.touches.length; i++) {
        const rect = canvas.getBoundingClientRect();
        const t = e.touches[i];
        const x = ((t.clientX - rect.left) / rect.width) * canvas.width;
        if (x < canvas.width / 2) input.left = true;
        else input.right = true;
      }
    } else {
      input.left = false;
      input.right = false;
    }
  };

  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp, { passive: false });
  canvas.addEventListener('touchcancel', onUp, { passive: false });
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    input.keys.add(k);
    if (k === 'z' || k === 'arrowleft') input.left = true;
    if (k === '/' || k === 'arrowright' || k === 'shift') input.right = true;
    if (k === 'x' || k === 'arrowup') input.mini = true;
    if (k === ' ' || k === 'enter') {
      if (!input.plungerPulling) {
        input.plungerPulling = true;
        input.plungerPull = 0;
      }
      input.plungerPull = Math.min(1, input.plungerPull + 0.04);
    }
  };
  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    input.keys.delete(k);
    if (k === 'z' || k === 'arrowleft') input.left = false;
    if (k === '/' || k === 'arrowright' || k === 'shift') input.right = false;
    if (k === 'x' || k === 'arrowup') input.mini = false;
    if (k === ' ' || k === 'enter') {
      input.plungerPulling = false;
      input._launch = input.plungerPull;
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    canvas.removeEventListener('touchstart', onDown);
    canvas.removeEventListener('touchmove', onMove);
    canvas.removeEventListener('touchend', onUp);
    canvas.removeEventListener('touchcancel', onUp);
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

export function consumeLaunch(input) {
  if (input._launch == null) return null;
  const v = input._launch;
  input._launch = null;
  input.plungerPull = 0;
  return v;
}
