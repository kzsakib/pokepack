/**
 * Pointer tilt + glare — ported from simeydotme/pokemon-cards-css (GPL-3.0),
 * src/lib/components/Card.svelte.
 *
 * The Svelte `spring` stores have been replaced with a tiny frame-driven spring:
 *   velocity = velocity * (1 - damping) + (target - value) * stiffness
 *   value += velocity
 * using the reference interaction settings (stiffness 0.066, damping 0.25).
 *
 * A single requestAnimationFrame loop per card writes the CSS custom properties
 * the ported CSS consumes; the loop stops once everything is at rest.
 */

const INTERACT = { stiffness: 0.066, damping: 0.25 };
const RETURN = { stiffness: 0.01, damping: 0.06 };

const clamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const adjust = (value, fromMin, fromMax, toMin, toMax) =>
  toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin);

function createScalar(value, settings) {
  return { value, target: value, velocity: 0, stiffness: settings.stiffness, damping: settings.damping };
}

/** Step one scalar; returns true when it has settled. */
function stepScalar(s) {
  s.velocity = s.velocity * (1 - s.damping) + (s.target - s.value) * s.stiffness;
  s.value += s.velocity;
  if (Math.abs(s.velocity) < 0.0008 && Math.abs(s.target - s.value) < 0.002) {
    s.value = s.target;
    s.velocity = 0;
    return true;
  }
  return false;
}

export function attachTilt(instance) {
  const el = instance.el;

  const springs = {
    rotateX: createScalar(0, INTERACT),
    rotateY: createScalar(0, INTERACT),
    glareX: createScalar(50, INTERACT),
    glareY: createScalar(50, INTERACT),
    glareO: createScalar(0, INTERACT),
    bgX: createScalar(50, INTERACT),
    bgY: createScalar(50, INTERACT),
    scale: createScalar(1, INTERACT),
    translateX: createScalar(0, INTERACT),
    translateY: createScalar(0, INTERACT)
  };

  let hovering = false;
  let rafId = null;
  let releaseTimer = null;
  let lastPoint = null;

  function writeVars() {
    const glareX = springs.glareX.value;
    const glareY = springs.glareY.value;
    const fromCenter = clamp(
      Math.sqrt((glareY - 50) ** 2 + (glareX - 50) ** 2) / 50,
      0,
      1
    );

    el.style.setProperty('--pointer-x', `${glareX}%`);
    el.style.setProperty('--pointer-y', `${glareY}%`);
    el.style.setProperty('--pointer-from-center', fromCenter.toFixed(3));
    el.style.setProperty('--pointer-from-top', (glareY / 100).toFixed(3));
    el.style.setProperty('--pointer-from-left', (glareX / 100).toFixed(3));
    el.style.setProperty('--card-opacity', springs.glareO.value.toFixed(3));
    el.style.setProperty('--rotate-x', `${springs.rotateX.value.toFixed(2)}deg`);
    el.style.setProperty('--rotate-y', `${springs.rotateY.value.toFixed(2)}deg`);
    el.style.setProperty('--background-x', `${springs.bgX.value}%`);
    el.style.setProperty('--background-y', `${springs.bgY.value}%`);
    el.style.setProperty('--card-scale', springs.scale.value.toFixed(3));
    el.style.setProperty('--translate-x', `${springs.translateX.value.toFixed(2)}px`);
    el.style.setProperty('--translate-y', `${springs.translateY.value.toFixed(2)}px`);
  }

  function frame() {
    let settled = true;
    for (const spring of Object.values(springs)) {
      if (!stepScalar(spring)) settled = false;
    }
    writeVars();
    rafId = settled && !hovering ? null : requestAnimationFrame(frame);
  }

  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }

  function setMode(spring, mode) {
    spring.stiffness = mode.stiffness;
    spring.damping = mode.damping;
  }

  function applyRest() {
    for (const spring of Object.values(springs)) setMode(spring, RETURN);
    springs.rotateX.target = 0;
    springs.rotateY.target = 0;
    springs.glareO.target = 0;
    springs.bgX.target = 50;
    springs.bgY.target = 50;
    springs.scale.target = 1;
    springs.translateX.target = 0;
    springs.translateY.target = 0;
    startLoop();
  }

  function isRevealed() {
    return el.classList.contains('is-revealed');
  }

  function isFocused() {
    return el.closest('.lightbox') !== null;
  }

  /** Point the foil/rotation at a pointer position. */
  function updateFromPoint(event) {
    if (!isRevealed()) return;
    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;

    const rect = instance.button.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const absolute = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    const percent = {
      x: clamp((100 / rect.width) * absolute.x),
      y: clamp((100 / rect.height) * absolute.y)
    };
    const center = { x: percent.x - 50, y: percent.y - 50 };

    setMode(springs.rotateX, INTERACT);
    setMode(springs.rotateY, INTERACT);
    setMode(springs.glareX, INTERACT);
    setMode(springs.glareY, INTERACT);
    setMode(springs.glareO, INTERACT);
    setMode(springs.bgX, INTERACT);
    setMode(springs.bgY, INTERACT);

    springs.bgX.target = adjust(percent.x, 0, 100, 37, 63);
    springs.bgY.target = adjust(percent.y, 0, 100, 33, 67);
    springs.rotateX.target = -(center.x / 3.5);
    springs.rotateY.target = center.y / 3.5;
    springs.glareX.target = percent.x;
    springs.glareY.target = percent.y;
    springs.glareO.target = 1;
    startLoop();
  }

  function onPointerEnter(event) {
    if (event.pointerType === 'touch') return;
    if (typeof event.clientX === 'number') {
      lastPoint = { clientX: event.clientX, clientY: event.clientY };
    }
    clearTimeout(releaseTimer);
    hovering = true;
    el.classList.add('is-hovering');
    for (const spring of Object.values(springs)) setMode(spring, INTERACT);

    if (isRevealed()) {
      springs.scale.target = isFocused() ? 1 : 1.035;
      springs.translateY.target = isFocused() ? 0 : -8;
      // Reveal the foil immediately, even if the pointer never moves again
      // (for example: hover, click to flip, then stop moving).
      springs.glareO.target = 1;
      updateFromPoint(event);
    } else {
      // face-down cards only get a gentle lift
      springs.scale.target = 1.022;
      springs.translateY.target = -6;
    }
    startLoop();
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch') return;
    if (typeof event.clientX === 'number') {
      lastPoint = { clientX: event.clientX, clientY: event.clientY };
    }
    if (!isRevealed()) return;
    // Some browsers only deliver pointermove on the hit target; treat the
    // first move as an enter so the foil always wakes up.
    if (!hovering) onPointerEnter(event);
    updateFromPoint(event);
  }

  function onPointerLeave() {
    if (!hovering) return;
    hovering = false;
    el.classList.remove('is-hovering');
    clearTimeout(releaseTimer);
    // matches the reference's delayed release so a quick re-enter stays smooth
    releaseTimer = window.setTimeout(applyRest, 60);
  }

  // Listen on the button (the only hit-testable element) rather than the
  // article: .card has pointer-events: none, and Safari can skip dispatch to
  // a non-hit-testable ancestor. The button moves into the lightbox with the
  // card, so the same listeners keep working while focused.
  instance.button.addEventListener('pointerenter', onPointerEnter);
  instance.button.addEventListener('pointermove', onPointerMove);
  instance.button.addEventListener('pointerleave', onPointerLeave);
  instance.button.addEventListener('pointercancel', onPointerLeave);

  function refresh() {
    if (hovering) {
      el.classList.add('is-hovering');
      onPointerEnter({ pointerType: 'mouse', ...(lastPoint || {}) });
    }
  }

  function destroy() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    clearTimeout(releaseTimer);
    instance.button.removeEventListener('pointerenter', onPointerEnter);
    instance.button.removeEventListener('pointermove', onPointerMove);
    instance.button.removeEventListener('pointerleave', onPointerLeave);
    instance.button.removeEventListener('pointercancel', onPointerLeave);
  }

  return { refresh, destroy };
}
