/**
 * Ambient Pokémon Mystery Dungeon sprites.
 *
 * Three wanderers spawn at random times, pick a random species, gait and
 * direction, then cross the viewport behind the page content. The walk sheets
 * are 8 rows of frames, one row per facing direction (S, SE, E, NE, N, NW, W,
 * SW); see scripts/fetch-sprites.py.
 *
 * Purely decorative: the layer is aria-hidden, pointer-events: none, and the
 * whole feature is skipped for prefers-reduced-motion.
 */

const BASE = import.meta.env.BASE_URL;
const DIRS = [
  { dx: 0, dy: 1 }, // S
  { dx: Math.SQRT1_2, dy: Math.SQRT1_2 }, // SE
  { dx: 1, dy: 0 }, // E
  { dx: Math.SQRT1_2, dy: -Math.SQRT1_2 }, // NE
  { dx: 0, dy: -1 }, // N
  { dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 }, // NW
  { dx: -1, dy: 0 }, // W
  { dx: -Math.SQRT1_2, dy: Math.SQRT1_2 } // SW
];

const SLOTS = 3;
const TICK_MS = 1000 / 60;
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export async function startSpriteWanderers() {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  if (document.querySelector('.wanderers')) return; // dev HMR / double boot

  let sprites;
  try {
    const response = await fetch(`${BASE}sprites/index.json`);
    if (!response.ok) throw new Error(`sprite metadata ${response.status}`);
    sprites = await response.json();
  } catch (error) {
    // Decoration only — a failed fetch must not affect the pack.
    console.info('[Pokepack] sprite wanderers unavailable.', error);
    return;
  }
  if (!Array.isArray(sprites) || sprites.length === 0) return;

  const layer = document.createElement('div');
  layer.className = 'wanderers';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  let running = true;
  let bag = [];
  const slots = Array.from({ length: SLOTS }, () => ({
    timer: null,
    el: null,
    raf: null,
    active: false
  }));

  function nextSprite() {
    if (bag.length === 0) {
      bag = [...sprites];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function schedule(slot, delay) {
    if (!running) return;
    slot.timer = window.setTimeout(() => spawn(slot), delay);
  }

  function spawn(slot) {
    if (!running || slot.active) return;
    const meta = nextSprite();
    const direction = Math.floor(Math.random() * DIRS.length);
    const { dx, dy } = DIRS[direction];
    const runningGait = Math.random() < 0.45;

    // Keep the pixel art legible on a phone without letting it dominate a
    // desktop viewport.
    const targetHeight = clamp(document.documentElement.clientWidth * 0.11, 92, 140);
    const scale = clamp(targetHeight / meta.frameHeight, 1.4, 3.4);
    const width = meta.frameWidth * scale;
    const height = meta.frameHeight * scale;

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const margin = Math.max(width, height) + 60;
    let x = Math.random() * vw;
    let y = Math.random() * vh;
    if (dx > 0) x = -margin;
    else if (dx < 0) x = vw + margin;
    if (dy > 0) y = -margin;
    else if (dy < 0) y = vh + margin;

    const travel = Math.hypot(vw, vh) + margin * 2;
    const endX = x + dx * travel;
    const endY = y + dy * travel;
    const speed = runningGait ? rand(210, 300) : rand(80, 130);
    const duration = clamp(Math.hypot(endX - x, endY - y) / speed, 3.5, 24);

    const walker = document.createElement('div');
    walker.className = 'wanderer';
    walker.dataset.species = meta.name;
    walker.style.width = `${width}px`;
    walker.style.height = `${height}px`;
    walker.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    const sprite = document.createElement('div');
    sprite.className = 'wanderer__sprite';
    sprite.style.width = `${width}px`;
    sprite.style.height = `${height}px`;
    sprite.style.backgroundImage = `url("${BASE}sprites/${meta.file}")`;
    sprite.style.backgroundSize = `${width * meta.columns}px ${height * 8}px`;

    walker.append(sprite);
    layer.append(walker);
    slot.el = walker;
    slot.active = true;

    // Draw the first frame and start the walk cycle.
    let column = 0;
    let frameClock = 0;
    let last = performance.now();
    const frameRate = runningGait ? 0.72 : 1.35;
    const frameDurations = meta.durations.map((ticks) =>
      Math.max(2, ticks) * TICK_MS * frameRate
    );

    function drawFrame() {
      sprite.style.backgroundPosition = `${-column * width}px ${-direction * height}px`;
    }

    function tick(now) {
      if (!slot.active) return;
      const delta = Math.min(100, now - last);
      last = now;
      frameClock += delta;
      let guard = 0;
      while (frameClock >= frameDurations[column] && guard < 60) {
        frameClock -= frameDurations[column];
        column = (column + 1) % meta.columns;
        drawFrame();
        guard += 1;
      }
      slot.raf = requestAnimationFrame(tick);
    }

    drawFrame();
    slot.raf = requestAnimationFrame(tick);

    let done = false;
    function cleanup() {
      if (done) return;
      done = true;
      slot.active = false;
      if (slot.raf !== null) cancelAnimationFrame(slot.raf);
      slot.raf = null;
      slot.el = null;
      walker.remove();
      schedule(slot, rand(700, 1800));
    }

    walker.addEventListener('transitionend', cleanup, { once: true });
    // Fallback for a missed transitionend (background tab, interrupted frame).
    window.setTimeout(cleanup, (duration + 2) * 1000);

    requestAnimationFrame(() => {
      walker.style.transition = `transform ${duration.toFixed(2)}s linear`;
      requestAnimationFrame(() => {
        if (slot.active) {
          walker.style.transform = `translate3d(${endX}px, ${endY}px, 0)`;
        }
      });
    });
  }

  function stop() {
    running = false;
    motion.removeEventListener('change', onMotionChange);
    for (const slot of slots) {
      if (slot.timer) clearTimeout(slot.timer);
      if (slot.raf !== null) cancelAnimationFrame(slot.raf);
      if (slot.el) slot.el.remove();
    }
    layer.remove();
  }

  function onMotionChange(event) {
    if (event.matches) stop();
  }
  motion.addEventListener('change', onMotionChange);

  slots.forEach((slot, index) => {
    schedule(slot, 250 + index * 350 + rand(0, 350));
  });
}
