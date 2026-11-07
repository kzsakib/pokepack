/**
 * Data layer — TCGdex (https://tcgdex.dev), free and keyless.
 *
 * Only Sword & Shield era cards are dealt (TCGdex set ids start with "swsh"),
 * because the ported holo CSS was designed for that era.
 *
 * TCGdex image URLs are extension-less bases; the high-quality files live at
 * `<image>/high.webp` (with `/high.png` as a fallback on error).
 */

const API = 'https://api.tcgdex.net/v2/en';

// Verified against GET https://api.tcgdex.net/v2/en/sets (all start with "swsh").
// Used only if the sets endpoint is unreachable, so a network hiccup doesn't
// blank the whole page.
const FALLBACK_SET_IDS = [
  'swsh1', 'swsh2', 'swsh3', 'swsh3.5', 'swsh4', 'swsh4.5', 'swsh5', 'swsh6',
  'swsh7', 'swsh8', 'swsh9', 'swsh10', 'swsh10.5', 'swsh11', 'swsh12',
  'swsh12.5', 'swshp', 'swsh9tg', 'swsh10tg', 'swsh11tg', 'swsh12tg',
  'swsh12.5gg'
];

// Gallery sets are full of textured hits, so the pack leans towards them a
// little while still dealing from the main sets. Chosen after checking the
// real set list above.
const GALLERY_SETS = new Set(['swsh9tg', 'swsh10tg', 'swsh11tg', 'swsh12tg', 'swsh12.5gg']);

// Shiny Vault uses shiny-specific foil art that was not ported, so those cards
// are left out rather than shown with a mismatched effect.
const SKIP_SETS = new Set(['swsh4.5sv']);

// In-memory set list cache (per page load; nothing persisted to storage).
let setListPromise = null;

// Extra foil treatments that can appear on any card, regardless of rarity.
// The ids match the [data-effect] rules in styles/holo.css.
const SPECIAL_EFFECTS = [
  { id: 'iridescent', label: 'Iridescent foil' },
  { id: 'pixel', label: 'Pixel holo' },
  { id: 'prism', label: 'Prism foil' },
  { id: 'frost', label: 'Frost foil' }
];

function assignEffect(card, used) {
  const available = SPECIAL_EFFECTS.filter((effect) => !used.has(effect.id));
  if (available.length === 0) return;
  const effect = available[Math.floor(Math.random() * available.length)];
  card.effect = effect.id;
  card.effectLabel = effect.label;
  used.add(effect.id);
}

const logRarities = (cards) => {
  const seen = new Map();
  for (const card of cards) {
    const key = `${card.rawRarity} → ${card.rarity}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  console.info('[Pokepack] rarity values in this deal:');
  for (const [key, count] of seen) console.info(`  ${count}× ${key}`);
};

async function fetchJson(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`TCGdex responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch + cache the SWSH set list in memory. */
export async function getSwshSets() {
  if (!setListPromise) {
    setListPromise = fetchJson(`${API}/sets`)
      .then((sets) =>
        sets
          .filter((set) => set.id.startsWith('swsh') && !SKIP_SETS.has(set.id))
          .map((set) => ({ id: set.id, name: set.name }))
      )
      .catch((error) => {
        console.warn('[Pokepack] set list unavailable, using verified fallback ids.', error);
        return FALLBACK_SET_IDS.map((id) => ({ id, name: id }));
      });
  }
  return setListPromise;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pick `count` distinct set ids, weighting gallery sets a little higher. */
function pickSets(sets, count) {
  const pool = [];
  for (const set of sets) {
    const weight = GALLERY_SETS.has(set.id) ? 3 : 1;
    for (let i = 0; i < weight; i += 1) pool.push(set);
  }
  const picked = [];
  const used = new Set();
  for (const set of shuffle(pool)) {
    if (used.has(set.id)) continue;
    used.add(set.id);
    picked.push(set);
    if (picked.length === count) break;
  }
  return picked;
}

/** Map a TCGdex card to the rarity strings the ported reference CSS expects. */
function mapRarity(card, isGallery) {
  const raw = (card.rarity || 'Unknown').trim();
  const low = raw.toLowerCase();
  const suffix = (card.suffix || '').toUpperCase();
  const stage = (card.stage || '').toUpperCase();
  const isV = suffix === 'V' || stage === 'V';
  const isVmax = suffix === 'VMAX' || stage === 'VMAX' || low.includes('vmax');
  const isVstar = suffix === 'VSTAR' || stage === 'VSTAR' || low.includes('vstar');
  const isRadiant = suffix === 'RADIANT' || low === 'radiant rare' || stage === 'RADIANT';

  if (isGallery) {
    if (isVmax) return 'rare holo vmax';
    if (isVstar) return 'rare holo vstar';
    if (low === 'secret rare') return 'rare secret';
    if (low === 'ultra rare') return 'rare ultra';
    if (isV) return 'rare holo v';
    return 'trainer gallery rare holo';
  }

  switch (low) {
    case 'holo rare': return 'rare holo';
    case 'holo rare v': return 'rare holo v';
    case 'holo rare vmax': return 'rare holo vmax';
    case 'holo rare vstar': return 'rare holo vstar';
    case 'ultra rare': return 'rare ultra';
    case 'secret rare': return 'rare secret';
    case 'amazing rare': return 'amazing rare';
    case 'radiant rare': return 'radiant rare';
    case 'promo':
      if (isVmax) return 'rare holo vmax';
      if (isVstar) return 'rare holo vstar';
      if (isV) return 'rare holo v';
      if (isRadiant) return 'radiant rare';
      // SWSH promo holos are cosmos holos.
      if (card.variants?.holo) return 'rare holo cosmos';
      return 'basic';
    default: return 'basic';
  }
}

function buildSubtypes(card) {
  const stage = (card.stage || '').toUpperCase();
  const suffix = (card.suffix || '').toUpperCase();
  if (stage === 'V-UNION' || suffix === 'V-UNION') return 'v-union';

  const parts = [];
  if (card.trainerType) parts.push(card.trainerType.toLowerCase());
  if (card.stage) parts.push(card.stage.toLowerCase().replace(/\s+/g, ''));
  if (card.suffix) parts.push(card.suffix.toLowerCase());
  if (card.energyType) parts.push(card.energyType.toLowerCase());
  return parts.join(' ');
}

function mapCard(card) {
  const isGallery =
    card.set.id.endsWith('tg') ||
    card.set.id.endsWith('gg') ||
    /^(tg|gg)/i.test(card.localId || '');

  let rarity = mapRarity(card, isGallery);

  // Reverse holo is a print variant, not a TCGdex rarity. Show it on a portion
  // of eligible cards whose print run actually had reverse holos.
  const lowRaw = (card.rarity || '').toLowerCase();
  const canReverse =
    !isGallery &&
    ['common', 'uncommon', 'rare'].includes(lowRaw) &&
    card.variants?.reverse === true;
  if (canReverse && Math.random() < 0.45) rarity = `${lowRaw} reverse holo`;

  return {
    id: card.id,
    name: card.name,
    rawRarity: card.rarity || 'Unknown',
    rarity,
    supertype: card.category === 'Pokemon' ? 'pokémon' : (card.category || '').toLowerCase(),
    subtypes: buildSubtypes(card),
    types: card.types || [],
    typesClass: (card.types || []).join(' ').toLowerCase(),
    image: card.image ? `${card.image}/high.webp` : null,
    imageFallback: card.image ? `${card.image}/high.png` : null,
    set: card.set.id,
    setName: card.set.name,
    number: (card.localId || '').toLowerCase(),
    isGallery,
    effect: null,
    effectLabel: null
  };
}

/**
 * Give roughly a third of the cards a signature foil, and make sure every
 * pack contains at least one so the variants are discoverable. Purely
 * in-memory randomness — a new deal rolls again.
 */
function addSpecialEffects(cards) {
  const used = new Set();
  for (const card of cards) {
    if (Math.random() < 0.3) assignEffect(card, used);
  }
  if (!cards.some((card) => card.effect)) {
    assignEffect(cards[Math.floor(Math.random() * cards.length)], used);
  }
  return cards;
}

/**
 * Deal five unique random SWSH cards that have an image.
 * Throws a friendly Error when the network/API fails.
 */
export async function dealFive() {
  const sets = await getSwshSets();
  const chosenSets = pickSets(sets, 5);

  const setResults = await Promise.allSettled(
    chosenSets.map((set) => fetchJson(`${API}/sets/${set.id}`))
  );

  const briefs = [];
  setResults.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    for (const brief of result.value.cards || []) {
      if (brief.image) briefs.push(brief);
    }
  });

  if (briefs.length < 5) throw new Error('Not enough cards came back from TCGdex.');

  const queue = shuffle(briefs);
  const cards = [];
  const usedIds = new Set();

  while (cards.length < 5 && queue.length > 0) {
    const brief = queue.shift();
    if (usedIds.has(brief.id)) continue;
    usedIds.add(brief.id);
    try {
      const detail = await fetchJson(`${API}/cards/${brief.id}`);
      const mapped = mapCard(detail);
      if (mapped.image) cards.push(mapped);
    } catch (error) {
      console.warn(`[Pokepack] skipping ${brief.id}`, error);
    }
  }

  if (cards.length < 5) throw new Error('Could not load a full pack from TCGdex.');

  addSpecialEffects(cards);
  logRarities(cards);
  for (const card of cards) {
    if (card.effect) console.info(`[Pokepack] ${card.name}: ${card.effectLabel}`);
  }
  return cards;
}
