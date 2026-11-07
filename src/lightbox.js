/**
 * Click-to-focus lightbox.
 *
 * FLIP-style: measure the card where it sits, move it into the fixed lightbox
 * at those exact coordinates, then animate transform to the centre. Closing
 * runs the animation in reverse and puts the card back in its grid slot.
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

let active = null; // { instance, slot, animation }

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const cardTransform = (dx, dy, scale) =>
  `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;

function measureTarget(rect) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const scale = Math.min((vh * 0.8) / rect.height, (vw * 0.92) / rect.width);
  return {
    dx: vw / 2 - (rect.left + rect.width / 2),
    dy: vh / 2 - (rect.top + rect.height / 2),
    scale
  };
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
  const { dx, dy, scale } = measureTarget(rect);
  active.instance.el.style.transform = cardTransform(dx, dy, scale);
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
    transform: 'translate3d(0, 0, 0) scale(1)'
  });
  card.classList.add('is-focused');
  instance.state = 'focused';

  lightbox.hidden = false;
  lightbox.setAttribute('aria-label', `Card view: ${instance.data.name}`);
  lightbox.append(card);
  document.body.classList.add('is-locked');
  chrome.forEach((element) => element.setAttribute('inert', ''));

  const foil = instance.data.effectLabel ? ` · ${instance.data.effectLabel}` : '';
  caption.textContent = `${instance.data.name} · ${instance.data.rawRarity}${foil}`;
  requestAnimationFrame(() => lightbox.classList.add('is-open'));

  const { dx, dy, scale } = measureTarget(rect);
  const finalTransform = cardTransform(dx, dy, scale);

  let animation = null;
  if (!prefersReducedMotion()) {
    animation = card.animate(
      [
        { transform: 'translate3d(0, 0, 0) scale(1)' },
        { transform: finalTransform }
      ],
      { duration: 520, easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)', fill: 'forwards' }
    );
    animation.finished
      .then(() => {
        if (!active) return;
        card.style.transform = finalTransform;
        animation.cancel();
        animation = null;
      })
      .catch(() => {});
  } else {
    card.style.transform = finalTransform;
  }

  active = { instance, slot, animation };

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
  if (!active) return;
  const { instance, slot } = active;
  const card = instance.el;

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

  const reduced = prefersReducedMotion();
  const currentTransform = card.style.transform;

  const finish = () => {
    if (!active) return;
    card.classList.remove('is-focused');
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

  if (reduced) {
    card.style.transform = '';
    finish();
  } else {
    card
      .animate(
        [
          { transform: currentTransform || 'translate3d(0, 0, 0) scale(1)' },
          { transform: 'translate3d(0, 0, 0) scale(1)' }
        ],
        { duration: 360, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
      )
      .finished.then(finish)
      .catch(finish);
  }
}

export function isLightboxOpen() {
  return active !== null;
}
