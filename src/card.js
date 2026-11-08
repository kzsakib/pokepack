import './styles/card.css';

let cardUid = 0;

/**
 * Build one card element, face down.
 * The reference markup expects .card__shine / .card__glare inside the front
 * face, so those layers are always present; effects are switched by data attrs.
 */
export function createCard(card, index, total) {
  const el = document.createElement('article');
  // `interactive` disables base.css's static hover fallback (it uses !important
  // custom properties) so the JS tilt springs own the card.
  el.className = 'card interactive';
  el.setAttribute('role', 'listitem');
  // data-rarity selects the ported foil treatment; the real rarity stays in
  // the card data for the accessible label and lightbox caption.
  el.dataset.rarity = card.foilRarity || card.rarity;
  el.dataset.actualRarity = card.rarity;
  el.dataset.foil = card.effect || '';
  el.dataset.supertype = card.supertype;
  el.dataset.subtypes = card.subtypes;
  // The effect is rolled independently of the printed rarity. Keep the
  // gallery-specific CSS variants from layering on top of that effect; the
  // standalone `trainer gallery rare holo` selector handles the gallery look.
  el.dataset.trainerGallery = 'false';
  el.dataset.set = card.set;
  el.dataset.number = card.number;
  el.classList.add(...card.types.map((type) => type.toLowerCase()));
  el.style.setProperty('--seedx', Math.random().toFixed(4));
  el.style.setProperty('--seedy', Math.random().toFixed(4));
  el.style.setProperty('--cosmosbg', `${Math.floor(Math.random() * 734)}px ${Math.floor(Math.random() * 1024)}px`);
  el.style.setProperty('--deal-i', index);

  cardUid = (cardUid + 1) % 1000;
  const frontId = `card-front-${cardUid}`;

  const translater = document.createElement('div');
  translater.className = 'card__translater';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card__rotator';
  button.dataset.cardId = card.id;
  button.setAttribute('aria-label', `Card ${index + 1} of ${total}, face down. Activate to flip.`);

  const flipper = document.createElement('span');
  flipper.className = 'card__flipper';

  // Back face
  const backFace = document.createElement('span');
  backFace.className = 'card__face card__face--back';
  backFace.setAttribute('aria-hidden', 'true');
  const backImg = document.createElement('img');
  backImg.className = 'card__back-img';
  // BASE_URL keeps this working both at the site root and under a GitHub
  // Pages project path such as /pokepack/.
  backImg.src = `${import.meta.env.BASE_URL}img/card-back.jpg`;
  backImg.alt = '';
  backImg.width = 660;
  backImg.height = 921;
  backImg.draggable = false;
  backFace.append(backImg);

  // Front face
  const frontFace = document.createElement('span');
  frontFace.className = 'card__face card__face--front';
  frontFace.id = frontId;

  const placeholder = document.createElement('span');
  placeholder.className = 'card__placeholder';
  placeholder.setAttribute('aria-hidden', 'true');

  const frontImg = document.createElement('img');
  frontImg.className = 'card__card-img';
  frontImg.src = card.image;
  frontImg.alt = `${card.name} trading card`;
  frontImg.width = 660;
  frontImg.height = 921;
  frontImg.decoding = 'async';
  frontImg.draggable = false;
  frontImg.loading = 'eager';

  frontImg.addEventListener('load', () => {
    el.classList.add('is-loaded');
  });
  frontImg.addEventListener('error', () => {
    if (card.imageFallback && frontImg.src !== card.imageFallback) {
      frontImg.src = card.imageFallback;
      return;
    }
    el.classList.add('is-image-error');
  });

  const shine = document.createElement('span');
  shine.className = 'card__shine';
  shine.setAttribute('aria-hidden', 'true');

  const glare = document.createElement('span');
  glare.className = 'card__glare';
  glare.setAttribute('aria-hidden', 'true');

  frontFace.append(placeholder, frontImg, shine, glare);
  flipper.append(backFace, frontFace);
  button.append(flipper);
  translater.append(button);
  el.append(translater);

  return {
    el,
    button,
    frontImg,
    data: card,
    index,
    state: 'down' // down → flipping → revealed → focused
  };
}

/** Flip a face-down card once; the CSS handles the 3D animation. */
export function flipCard(instance) {
  if (instance.state !== 'down') return false;
  instance.state = 'flipping';
  instance.el.classList.add('is-revealed', 'is-flipping');
  describeCard(instance);

  window.setTimeout(() => {
    instance.state = 'revealed';
    instance.el.classList.remove('is-flipping');
  }, 740);
  return true;
}

/** Update the accessible name after a flip. */
export function describeCard(instance) {
  const { data, index } = instance;
  const foil = data.effectLabel ? `, ${data.effectLabel}` : '';
  instance.button.setAttribute(
    'aria-label',
    `Card ${index + 1}: ${data.name}, ${data.rawRarity}${foil}. Activate to view it larger.`
  );
}
