/**
 * Ambient Pokémon Mystery Dungeon sprites.
 *
 * Three wanderers pick a random species from a shuffled bag, roam in short
 * steps, pause and look around, then change direction. They fade out after a
 * few moves and the slot draws a new species. The walk sheets are 8 rows of
 * frames, one row per facing direction (S, SE, E, NE, N, NW, W, SW); see
 * scripts/fetch-sprites.py.
 *
 * Motion is on by default. The header toggle is a manual pause, not a
 * reduced-motion gate. The layer is decorative: aria-hidden, pointer-events:
 * none.
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

function directionFromVector(dx, dy) {
  let best = 0;
  let bestDot = -Infinity;
  DIRS.forEach((dir, index) => {
    const dot = dir.dx * dx + dir.dy * dy;
    if (dot > bestDot) {
      bestDot = dot;
      best = index;
    }
  });
  return best;
}

function shuffled(items) {
  const bag = [...items];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function startSpriteWanderers() {
  if (booted) return;
  booted = true;

  const button = document.querySelector('#motion-toggle');
  if (button?.dataset.spriteController === 'true') return;
  if (button) button.dataset.spriteController = 'true';
  const forced = new URLSearchParams(window.location.search).get('motion');

  let enabled = forced !== 'off';
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
      : 'Turn the wandering Pokémon sprites on';
    const label = button.querySelector('[data-label]');
    if (label) label.textContent = enabled ? 'Sprites on' : 'Sprites off';
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
      enabled = !enabled;
      if (enabled) {
        updateButton();
        enable();
      } else {
        disable();
      }
    });
  }

  updateButton();
  console.info('[Pokepack] sprite motion', { enabled, source: forced || 'default' });
  if (enabled) enable();

  /**
   * Build the layer and run three independent roaming slots.
   * Returns a stop function that removes the layer and all timers.
   */
  function run(sprites) {
    const layer = document.createElement('div');
    layer.className = 'wanderers';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);

    let running = true;
    let bag = [];

    const slots = Array.from({ length: SLOTS }, () => ({
      timer: null,
      el: null,
      meta: null,
      raf: null,
      timeouts: new Set(),
      active: false
    }));

    function later(slot, fn, delay) {
      const id = window.setTimeout(() => {
        slot.timeouts.delete(id);
        if (running && slot.active) fn();
      }, delay);
      slot.timeouts.add(id);
      return id;
    }

    /** Draw a species that is not already on screen, using a shuffled bag. */
    function nextSprite() {
      const current = new Set(slots.map((slot) => slot.meta?.name).filter(Boolean));
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (bag.length === 0) bag = shuffled(sprites);
        const index = bag.findIndex((meta) => !current.has(meta.name));
        if (index !== -1) return bag.splice(index, 1)[0];
        bag = shuffled(sprites);
      }
      return sprites[Math.floor(Math.random() * sprites.length)];
    }

    function schedule(slot, delay) {
      if (!running) return;
      slot.timer = window.setTimeout(() => {
        slot.timer = null;
        spawn(slot);
      }, delay);
    }

    function spawn(slot) {
      if (!running || slot.active) return;
      const meta = nextSprite();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;

      // Big enough to read, small enough not to take over the page.
      const targetHeight = clamp(vw * 0.11, 92, 140);
      const scale = clamp(targetHeight / meta.frameHeight, 1.4, 3.4);
      const width = meta.frameWidth * scale;
      const height = meta.frameHeight * scale;

      // Keep the roam zone around the pack. That avoids covering the header
      // and footer text while still letting the sprites cross the cards.
      const packRect = document.querySelector('#pack')?.getBoundingClientRect();
      let zoneLeft = 10;
      let zoneRight = Math.max(10, vw - width - 10);
      let zoneTop = 10;
      let zoneBottom = Math.max(10, vh - height - 10);
      if (packRect && packRect.height > 80) {
        zoneLeft = Math.max(zoneLeft, packRect.left + 8);
        zoneRight = Math.min(zoneRight, packRect.right - width - 8);
        zoneTop = Math.max(zoneTop, packRect.top + 8);
        zoneBottom = Math.min(zoneBottom, packRect.bottom - height - 8);
        if (zoneRight < zoneLeft + width * 0.5 || zoneBottom < zoneTop + height * 0.5) {
          zoneLeft = 10;
          zoneRight = Math.max(10, vw - width - 10);
          zoneTop = 10;
          zoneBottom = Math.max(10, vh - height - 10);
        }
      }

      const x = rand(zoneLeft, Math.max(zoneLeft, zoneRight));
      const y = rand(zoneTop, Math.max(zoneTop, zoneBottom));

      const walker = document.createElement('div');
      walker.className = 'wanderer';
      walker.dataset.species = meta.name;
      walker.style.width = `${width}px`;
      walker.style.height = `${height}px`;
      walker.style.opacity = '0';
      walker.style.transition = 'none';
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
      slot.meta = meta;
      slot.active = true;

      let facing = Math.floor(Math.random() * DIRS.length);
      let column = 0;
      let frameClock = 0;
      let last = performance.now();
      let posX = x;
      let posY = y;
      let segments = 0;
      let moving = false;

      const runningGait = Math.random() < 0.4;
      const speed = runningGait ? rand(170, 250) : rand(58, 95);
      const frameRate = runningGait ? 0.72 : 1.35;
      const frameDurations = meta.durations.map(
        (ticks) => Math.max(2, ticks) * TICK_MS * frameRate
      );
      const maxSegments = 4 + Math.floor(Math.random() * 4);

      function drawFrame() {
        sprite.style.backgroundPosition = `${-column * width}px ${-facing * height}px`;
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

      // Fade in immediately. Everyone starts fully inside the viewport, so a
      // visitor never has to wait for a walk-in from outside the screen.
      requestAnimationFrame(() => {
        if (!slot.active) return;
        walker.style.transition = 'opacity 0.45s ease';
        walker.style.opacity = '0.92';
      });

      function lookAround() {
        if (!slot.active) return;
        const looks = 1 + Math.floor(Math.random() * 3);
        let count = 0;
        const turn = () => {
          if (!slot.active) return;
          facing = (facing + [-2, -1, 1, 2, 3][Math.floor(Math.random() * 5)] + 8) % 8;
          drawFrame();
          count += 1;
          if (count < looks) later(slot, turn, rand(240, 440));
        };
        turn();
        later(slot, step, rand(850, 2300));
      }

      function leave() {
        if (!slot.active) return;
        walker.style.transition = 'opacity 0.5s ease';
        walker.style.opacity = '0';
        later(slot, cleanup, 520);
      }

      function step() {
        if (!slot.active || moving) return;

        // Aim for another point inside the viewport. If that would push the
        // sprite out, pick the opposite direction instead.
        let dir = Math.floor(Math.random() * DIRS.length);
        let { dx, dy } = DIRS[dir];
        if ((posX < zoneLeft + width * 0.25 && dx < 0) || (posX > zoneRight - width * 0.25 && dx > 0)) {
          dx = -dx;
        }
        if ((posY < zoneTop + height * 0.25 && dy < 0) || (posY > zoneBottom - height * 0.25 && dy > 0)) {
          dy = -dy;
        }

        const distance = rand(110, Math.min(vw, vh) * 0.32);
        const tx = clamp(posX + dx * distance, zoneLeft, Math.max(zoneLeft, zoneRight));
        const ty = clamp(posY + dy * distance, zoneTop, Math.max(zoneTop, zoneBottom));
        const moveX = tx - posX;
        const moveY = ty - posY;
        if (Math.hypot(moveX, moveY) < 45) {
          // Too close to an edge; try again on the next frame.
          later(slot, step, 120);
          return;
        }

        facing = directionFromVector(moveX, moveY);
        drawFrame();
        const duration = clamp(Math.hypot(moveX, moveY) / speed, 0.8, 4.5);
        moving = true;
        walker.style.transition = `transform ${duration}s linear`;
        walker.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

        let fallback = null;
        const done = () => {
          if (!slot.active) return;
          moving = false;
          walker.removeEventListener('transitionend', onEnd);
          if (fallback) clearTimeout(fallback);
          posX = tx;
          posY = ty;
          segments += 1;
          if (segments >= maxSegments) {
            leave();
          } else if (Math.random() < 0.55) {
            lookAround();
          } else {
            step();
          }
        };
        const onEnd = (event) => {
          if (event.propertyName === 'transform') done();
        };
        walker.addEventListener('transitionend', onEnd);
        fallback = later(slot, done, duration * 1000 + 220);
      }

      later(slot, step, rand(240, 600));

      function cleanup() {
        if (!slot.active) return;
        slot.active = false;
        if (slot.raf !== null) cancelAnimationFrame(slot.raf);
        slot.raf = null;
        for (const id of slot.timeouts) clearTimeout(id);
        slot.timeouts.clear();
        walker.remove();
        slot.el = null;
        slot.meta = null;
        schedule(slot, rand(700, 1800));
      }
    }

    slots.forEach((slot, index) => {
      schedule(slot, 120 + index * 220 + rand(0, 180));
    });

    return function stopLayer() {
      running = false;
      for (const slot of slots) {
        if (slot.timer) clearTimeout(slot.timer);
        if (slot.raf !== null) cancelAnimationFrame(slot.raf);
        for (const id of slot.timeouts) clearTimeout(id);
        slot.timeouts.clear();
        if (slot.el) slot.el.remove();
      }
      layer.remove();
    };
  }
}
