import './styles/holo.css';
import './styles/app.css';
import { dealFive } from './data.js';
import { createCard, flipCard } from './card.js';
import { attachTilt } from './tilt.js';
import { openLightbox, isLightboxOpen } from './lightbox.js';
import { startSpriteWanderers } from './sprites.js';

const packEl = document.querySelector('#pack');
const statusEl = document.querySelector('#status');
const anotherBtn = document.querySelector('#another');

const state = {
  cards: [],
  dealing: false
};

function setStatus(message) {
  statusEl.textContent = message;
}

function revealedCount() {
  return state.cards.filter((card) => card.state !== 'down' && card.state !== 'flipping').length;
}

function updatePackStatus() {
  const total = state.cards.length;
  const revealed = revealedCount();
  if (revealed === total) {
    setStatus('Pack complete. Open another pack for a fresh deal.');
  } else if (revealed > 0) {
    setStatus(`${revealed} of ${total} cards revealed.`);
  } else {
    setStatus(`${total} cards dealt. Choose a card to flip it over.`);
  }
}

function wireCard(instance) {
  instance.tilt = attachTilt(instance);
  instance.button.addEventListener('click', () => {
    if (flipCard(instance)) {
      instance.tilt.refresh();
      // update the counter once the flip settles
      window.setTimeout(updatePackStatus, 760);
      return;
    }
    if (instance.state === 'revealed' && !isLightboxOpen()) {
      openLightbox(instance);
    }
  });
}

function renderSkeletons() {
  packEl.replaceChildren(
    ...Array.from({ length: 5 }, () => {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton';
      skeleton.setAttribute('aria-hidden', 'true');
      return skeleton;
    })
  );
}

function renderError(message) {
  const panel = document.createElement('div');
  panel.className = 'pack-error';

  const title = document.createElement('h2');
  title.textContent = 'The pack did not open';

  const body = document.createElement('p');
  body.textContent = message;

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => deal());

  panel.append(title, body, retry);
  packEl.replaceChildren(panel);
  setStatus('');
  anotherBtn.disabled = false;
}

async function deal() {
  if (state.dealing) return;
  state.dealing = true;
  state.cards = [];
  anotherBtn.disabled = true;
  packEl.setAttribute('aria-busy', 'true');
  renderSkeletons();
  setStatus('Shuffling the pack…');

  try {
    const cards = await dealFive();
    state.cards = cards.map((card, index) => createCard(card, index, cards.length));
    state.cards.forEach(wireCard);
    packEl.replaceChildren(...state.cards.map((card) => card.el));
    packEl.setAttribute('aria-busy', 'false');
    updatePackStatus();
  } catch (error) {
    console.error('[Pokepack] deal failed', error);
    renderError(
      'TCGdex could not be reached just now. Check your connection and give it another go.'
    );
  } finally {
    state.dealing = false;
    anotherBtn.disabled = false;
  }
}

anotherBtn.addEventListener('click', () => deal());

renderSkeletons();
deal();
startSpriteWanderers();
