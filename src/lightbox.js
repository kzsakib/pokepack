/**
 * Click-to-focus lightbox.
 *
 * FLIP-style: measure the card where it sits, move it into the fixed lightbox
 * at those exact coordinates, then animate transform to the centre. Once the
 * animation lands, the card keeps the same visual position but is resized to
 * the enlarged layout size. That lets the browser rasterize the artwork at
 * full size instead of upscaling the small grid bitmap (the old blur).
 *
 * The card keeps its own tilt/holo instance while enlarged. Page chrome is
 * made inert while open and focus cycles between the card and the close button.
 */

const lightbox = document.querySelector('#lightbox');
const backdrop = lightbox.querySelector('.lightbox__backdrop');
const closeButton = lightbox.querySelector('.lightbox__close');
const caption = document.querySelector('#lightbox-caption');
const chrome = [
  document.querySelector('.site-header'),
  document.querySelector('main'),
  document.querySelector('.site-footer')
].filter(Boolean);

let active = null; // { instance, slot, animation, target, settled, closing }

const cardTransform = (dx, dy, scale) =>
  `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;

function measureTarget(rect) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const scale = Math.min((vh * 0.82) / rect.height, (vw * 0.92) / rect.width);
  const width = rect.width * scale;
  const height = rect.height * scale;
  return {
    width,
    height,
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    scale,
    dx: vw / 2 - (rect.left + rect.width / 2),
    dy: vh / 2 - (rect.top + rect.height / 2)
  };
}

function applyBox(card, target) {
  card.style.left = `${target.left}px`;
  card.style.top = `${target.top}px`;
  card.style.width = `${target.width}px`;
  card.style.height = `${target.height}px`;
  card.style.transform = 'none';
}

function settleCard() {
  if (!active || active.closing) return;
  const { instance, target } = active;
  if (active.animation) {
    active.animation.cancel();
    active.animation = null;
  }
  // The layout box changes in the same frame the transform is dropped, so
  // there is no visible jump: both describe the same final rectangle.
  applyBox(instance.el, target);
  active.settled = true;
  instance.el.classList.add('is-settled');
}

function trapKeydown(event) {
  if (!active) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeLightbox();
    return;
  }
  if (event.key !== 'Tab') return;

  // The card is appended after the close button, so it is last in DOM order.
  const cardButton = active.instance.button;
  const focused = document.activeElement;
  if (!focused || !lightbox.contains(focused)) {
    event.preventDefault();
    closeButton.focus();
  } else if (!event.shiftKey && focused === cardButton) {
    event.preventDefault();
    closeButton.focus();
  } else if (event.shiftKey && focused === closeButton) {
    event.preventDefault();
    cardButton.focus();
  }
}

function onBackdropClick(event) {
  if (event.target.closest('[data-close]')) closeLightbox();
}

function onResize() {
  if (!active) return;
  const rect = active.slot.getBoundingClientRect();
  if (!rect.width) return;

  const target = measureTarget(rect);
  active.target = target;

  if (active.animation) {
    active.animation.cancel();
    active.animation = null;
  }
  applyBox(active.instance.el, target);
  active.settled = true;
  active.instance.el.classList.add('is-settled');
}

export function openLightbox(instance) {
  if (active) return;

  const card = instance.el;
  const rect = card.getBoundingClientRect();
  if (!rect.width) return;

  const slot = document.createElement('div');
  slot.className = 'card-slot';
  slot.setAttribute('aria-hidden', 'true');
  slot.style.width = `${rect.width}px`;
  slot.style.height = `${rect.height}px`;
  const cardStyle = getComputedStyle(card);
  slot.style.gridColumn = cardStyle.gridColumn;
  slot.style.gridRow = cardStyle.gridRow;
  slot.style.justifySelf = cardStyle.justifySelf;

  card.parentNode.insertBefore(slot, card);

  // Fixed-position the card where it currently sits, before animating.
  Object.assign(card.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '2',
    transform: 'none'
  });
  card.classList.add('is-focused');
  card.classList.remove('is-settled');
  instance.state = 'focused';

  lightbox.hidden = false;
  lightbox.setAttribute('aria-label', `Card view: ${instance.data.name}`);
  lightbox.append(card);
  document.body.classList.add('is-locked');
  chrome.forEach((element) => element.setAttribute('inert', ''));

  const foil = instance.data.effectLabel ? ` · ${instance.data.effectLabel}` : '';
  caption.textContent = `${instance.data.name} · ${instance.data.rawRarity}${foil}`;

  const target = measureTarget(rect);
  active = { instance, slot, animation: null, target, settled: false, closing: false };

  requestAnimationFrame(() => lightbox.classList.add('is-open'));

  const finalTransform = cardTransform(target.dx, target.dy, target.scale);
  const animation = card.animate(
    [
      { transform: 'translate3d(0, 0, 0) scale(1)' },
      { transform: finalTransform }
    ],
    { duration: 520, easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)', fill: 'forwards' }
  );
  active.animation = animation;

  animation.finished
    .then(() => {
      if (!active || active.animation !== animation) return;
      settleCard();
    })
    .catch(() => {});

  // The card was moved in the DOM, so restore focus to it.
  instance.button.focus({ preventScroll: true });
  if (instance.tilt) instance.tilt.refresh();

  lightbox.addEventListener('keydown', trapKeydown);
  backdrop.addEventListener('click', onBackdropClick);
  closeButton.addEventListener('click', onBackdropClick);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

export function closeLightbox() {
  if (!active || active.closing) return;
  const { instance, slot } = active;
  const card = instance.el;
  active.closing = true;

  if (active.animation) {
    active.animation.cancel();
    active.animation = null;
  }

  lightbox.classList.remove('is-open');
  lightbox.removeEventListener('keydown', trapKeydown);
  backdrop.removeEventListener('click', onBackdropClick);
  closeButton.removeEventListener('click', onBackdropClick);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('orientationchange', onResize);

  const currentTransform = getComputedStyle(card).transform;
  const target = active.target;
  const settled = active.settled;

  const finish = () => {
    if (!active) return;
    card.classList.remove('is-focused', 'is-settled');
    card.style.position = '';
    card.style.left = '';
    card.style.top = '';
    card.style.width = '';
    card.style.height = '';
    card.style.margin = '';
    card.style.zIndex = '';
    card.style.transform = '';
    if (slot.parentNode) slot.replaceWith(card);
    lightbox.hidden = true;
    document.body.classList.remove('is-locked');
    chrome.forEach((element) => element.removeAttribute('inert'));
    instance.state = 'revealed';
    active = null;
    instance.button.focus({ preventScroll: true });
    if (instance.tilt) instance.tilt.refresh();
  };

  const duration = 360;
  const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

  if (settled) {
    // The card is laid out at full size. Shrink it back to the waiting slot
    // centre, then restore the grid layout in finish().
    const slotRect = slot.getBoundingClientRect();
    if (!slotRect.width) {
      finish();
      return;
    }
    const dx = slotRect.left + slotRect.width / 2 - (target.left + target.width / 2);
    const dy = slotRect.top + slotRect.height / 2 - (target.top + target.height / 2);
    const scale = slotRect.width / target.width;

    card.classList.remove('is-settled');
    const closeAnimation = card.animate(
      [
        { transform: 'none' },
        { transform: cardTransform(dx, dy, scale) }
      ],
      { duration, easing, fill: 'forwards' }
    );
    const done = () => {
      closeAnimation.cancel();
      finish();
    };
    closeAnimation.finished.then(done, done);
    return;
  }

  const closeAnimation = card.animate(
    [
      { transform: currentTransform || 'translate3d(0, 0, 0) scale(1)' },
      { transform: 'translate3d(0, 0, 0) scale(1)' }
    ],
    { duration, easing, fill: 'forwards' }
  );
  const done = () => {
    closeAnimation.cancel();
    finish();
  };
  closeAnimation.finished.then(done, done);
}

export function isLightboxOpen() {
  return active !== null;
}
