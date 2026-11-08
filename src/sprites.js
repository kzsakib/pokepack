/**
 * Ambient Pokémon Mystery Dungeon sprites.
 *
 * Three wanderers pick a random species, gait and direction, cross the
 * viewport behind the page content, then respawn. The walk sheets are 8 rows
 * of frames, one row per facing direction (S, SE, E, NE, N, NW, W, SW); see
 * scripts/fetch-sprites.py.
 *
 * Motion follows prefers-reduced-motion by default, but the header toggle
 * lets anyone opt in (or pause the sprites). The layer is decorative:
 * aria-hidden, pointer-events: none.
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

let booted = false;

export function startSpriteWanderers() {
  if (booted) return;
  booted = true;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.querySelector('#motion-toggle');
  if (button?.dataset.spriteController === 'true') return;
  if (button) button.dataset.spriteController = 'true';
  const forced = new URLSearchParams(window.location.search).get('motion');

  let enabled =
    forced === 'on' ? true : forced === 'off' ? false : !motion.matches;
  let manual = forced === 'on' || forced === 'off';
  let stop = null;
  let starting = false;
  let dataPromise = null;

  function updateButton() {
    if (!button) return;
    button.hidden = false;
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute(
      'aria-label',
      enabled
        ? 'Background sprites are on. Activate to pause them.'
        : 'Background sprites are off. Activate to turn them on.'
    );
    button.title = enabled
      ? 'Pause the wandering Pokémon sprites'
      : motion.matches
        ? 'Your system prefers reduced motion. Turn the wandering sprites on here.'
        : 'Turn the wandering Pokémon sprites on';
    const label = button.querySelector('[data-label]');
    if (label) label.textContent = enabled ? 'Sprites on' : 'Sprites off';
    button.dataset.reduced = String(!enabled && motion.matches);
  }

  function load() {
    if (!dataPromise) {
      dataPromise = fetch(`${BASE}sprites/index.json`)
        .then((response) => {
          if (!response.ok) throw new Error(`sprite metadata ${response.status}`);
          return response.json();
        })
        .catch((error) => {
          console.info('[Pokepack] sprite wanderers unavailable.', error);
          return null;
        });
    }
    return dataPromise;
  }

  async function enable() {
    if (stop || starting) return;
    starting = true;
    const sprites = await load();
    starting = false;
    if (!enabled || stop) return;
    if (!Array.isArray(sprites) || sprites.length === 0) {
      if (button) button.hidden = true;
      return;
    }
    stop = run(sprites);
  }

  function disable() {
    enabled = false;
    if (stop) stop();
    stop = null;
    updateButton();
  }

  if (button) {
    button.addEventListener('click', () => {
      manual = true;
      enabled = !enabled;
      if (enabled) {
        updateButton();
        enable();
      } else {
        disable();
      }
    });
  }

  motion.addEventListener('change', (event) => {
    if (manual) return;
    enabled = !event.matches;
    if (enabled) {
      updateButton();
      enable();
    } else {
      disable();
    }
  });

  updateButton();
  console.info('[Pokepack] sprite motion', {
    reducedMotion: motion.matches,
    enabled,
    source: forced ? 'query' : 'preference'
  });
  if (enabled) enable();

  /**
   * Build the layer and run three independent crossing slots.
   * Returns a stop function that removes the layer and all timers.
   */
  function run(sprites) {
    const layer = document.createElement('div');
    layer.className = 'wanderers';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);

    let running = true;
    let spawnCount = 0;
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
      const firstWave = spawnCount < SLOTS;
      spawnCount += 1;

      // Big enough to read, small enough not to take over the page.
      const targetHeight = clamp(document.documentElement.clientWidth * 0.11, 92, 140);
      const scale = clamp(targetHeight / meta.frameHeight, 1.4, 3.4);
      const width = meta.frameWidth * scale;
      const height = meta.frameHeight * scale;

      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const margin = Math.max(width, height) + 60;
      let x = Math.random() * vw;
      let y = Math.random() * vh;

      if (firstWave) {
        // Start fully visible at the edge the sprite is walking away from,
        // so the feature is obvious immediately instead of after a long walk
        // in from outside the viewport.
        if (dx > 0) x = 0;
        else if (dx < 0) x = Math.max(0, vw - width);
        if (dy > 0) y = 0;
        else if (dy < 0) y = Math.max(0, vh - height);
      } else {
        if (dx > 0) x = -margin;
        else if (dx < 0) x = vw + margin;
        if (dy > 0) y = -margin;
        else if (dy < 0) y = vh + margin;
      }

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

      let column = 0;
      let frameClock = 0;
      let last = performance.now();
      const frameRate = runningGait ? 0.72 : 1.35;
      const frameDurations = meta.durations.map(
        (ticks) => Math.max(2, ticks) * TICK_MS * frameRate
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

    slots.forEach((slot, index) => {
      schedule(slot, 120 + index * 220 + rand(0, 180));
    });

    return function stopLayer() {
      running = false;
      for (const slot of slots) {
        if (slot.timer) clearTimeout(slot.timer);
        if (slot.raf !== null) cancelAnimationFrame(slot.raf);
        if (slot.el) slot.el.remove();
      }
      layer.remove();
    };
  }
}
