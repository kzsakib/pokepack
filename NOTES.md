# Reference notes — simeydotme/pokemon-cards-css

Source: https://github.com/simeydotme/pokemon-cards-css (GPL-3.0), cloned shallow into
`./reference` for study only. Nothing in `./reference` is edited or shipped.
Credits for the artwork/assets used by the reference: simeydotme, aschefield101
(Galaxy Holo), Vecteezy (backgrounds).

## Which CSS file is for which rarity / subtype

| Reference CSS | Effect | `data-rarity` / marker used in Pokepack |
| --- | --- | --- |
| `basic.css` | no foil, base glare only | `basic` (common, uncommon, plain rare, fallback) |
| `regular-holo.css` | classic rainbow scanline holo | `rare holo` (TCGdex "Holo Rare") |
| `reverse-holo.css` | reverse-foil (foil only outside art window) | `<rarity> reverse holo` (TCGdex reverse variant) |
| `cosmos-holo.css` | galaxy/cosmos foil with star field | `rare holo cosmos` (holo promos) |
| `v-regular.css` | V card sunpillar + grain | `rare holo v` |
| `v-full-art.css` | Ultra Rare / V full art / gallery V (illusion foil) | `rare ultra`, and `rare holo v` + `data-trainer-gallery="true"` |
| `v-max.css` | VMAX cloudy rainbow | `rare holo vmax` |
| `v-star.css` | VSTAR etched ancient pattern | `rare holo vstar` |
| `radiant-holo.css` | Radiant etched glitter + diagonal bars | `radiant rare` |
| `amazing-rare.css` | Amazing Rare glitter/soft-light burst | `amazing rare` |
| `secret-rare.css` | gold Secret Rare glitter | `rare secret` |
| `trainer-gallery-holo.css` | Trainer Gallery colour-dodge bands | `trainer gallery rare holo` (and `rare holo` + gallery marker) |
| `trainer-gallery-v-regular.css` | gallery V glare tweak (inherits V full art) | `rare holo v` + gallery marker |
| `trainer-gallery-v-max.css` | gallery VMAX glare tweak (inherits rainbow alt) | `rare holo vmax` + gallery marker |
| `rainbow-alt.css` | rainbow alt/trainer-gallery VMAX shine | `rare holo vmax` + `data-trainer-gallery="true"` |
| `shiny-*.css`, `rainbow-*.css`, `swsh-pikachu.css`, `trainer-*.css` | not ported (not needed for the supported rarities) | — |

`base.css` holds the shared layout, shine/glare layers, masking, clip paths, and the
per-Pokémon-type `--card-glow` colours. `cards.css` holds shared variables + the
`will-change` on shine/glare (overridden in Pokepack's own CSS for performance).

## CSS custom properties the effect depends on, and where JS sets them

Set on `.card` by the ported tilt module (`src/tilt.js`), every animation frame:

- `--pointer-x`, `--pointer-y` — glare/foil centre, 0–100%
- `--pointer-from-center` — 0–1 distance from centre (drives brightness/opacity)
- `--pointer-from-top`, `--pointer-from-left` — 0–1 (background position maths)
- `--card-opacity` — 0–1 master shine/glare opacity (0 at rest)
- `--rotate-x`, `--rotate-y` — tilt in degrees (rotateY / rotateX)
- `--background-x`, `--background-y` — 37–63% / 33–67% remapped pointer for foil parallax
- `--card-scale` — spring scale (1 at rest; Pokepack does the popup scale on an outer
  element, so this stays 1 and is still written for parity)
- `--translate-x`, `--translate-y` — px spring translation (Pokepack keeps them at 0;
  the popup FLIP lives on the outer `.card` element)

Set inline per card (static):

- `--seedx`, `--seedy` — random 0–1 seeds (used by the reference for random effects)
- `--cosmosbg` — random pixel offset for the cosmos holo background

Set by CSS, consumed by effects:

- `--mask`, `--foil` — per-card foil/mask image URLs. **The reference loads these per-card
  from its own CDN (`/foils/...`, `/masks/...`), which is not part of the repo.** Pokepack
  therefore never adds the `masked` class and relies on each CSS file's `:not(.masked)`
  fallback, which uses the repo's own foil textures in `public/img`.
- `--grain`, `--glitter`, `--glittersize`, `--space`, `--angle`, `--imgsize`,
  `--card-aspect`, `--card-radius`, `--clip*`, `--sunpillar-*`, `--red/--yellow/...`,
  `--card-glow` — static tokens from `base.css` / `cards.css`.

## Foil and mask images needed per effect

| Effect | Images |
| --- | --- |
| basic / regular holo / reverse holo | none (pure gradients); reverse holo uses `--foil` only when masked — unmasked uses `clip-path` |
| cosmos holo | `cosmos-bottom.png`, `cosmos-middle-trans.png`, `cosmos-top-trans.png` |
| V regular | `grain.webp` |
| V full art / gallery V (unmasked) | `illusion.png` (as a 33% repeating mask/foil) |
| VMAX (unmasked) | `vmaxbg.jpg` |
| VSTAR (unmasked) | `ancient.png` |
| Radiant | `glitter.png`, `trainerbg.png` |
| Amazing Rare | `glitter.png`; local `--foil` fallback supplied by Pokepack (`galaxy.jpg`) |
| Secret Rare (unmasked) | `glitter.png`, `geometric.png` |
| Trainer Gallery holo | none (gradients) |
| Gallery VMAX | `rainbow-alt.css` + `glitter.png`; `--foil: none` unmasked |
| Shared base | `grain.webp`, `glitter.png` |

Copied into `public/img/`: `grain.webp`, `glitter.png`, `cosmos-bottom.png`,
`cosmos-middle-trans.png`, `cosmos-top-trans.png`, `vmaxbg.jpg`, `ancient.png`,
`illusion.png`, `trainerbg.png`, `geometric.png`, `cosmos.png` (amazing-rare foil).

The card back (`tcg-card-back-2x.jpg`, 660×921) is downloaded to
`public/img/card-back.jpg`, not hotlinked.

## What in Card.svelte is Svelte-specific and had to be rewritten

- `import { spring } from "svelte/motion"` — replaced with a tiny frame-driven spring
  (`createSpring`) in `src/tilt.js`: `velocity = velocity * (1 - damping) +
  (target - current) * stiffness; current += velocity`, matching the reference's
  `stiffness: 0.066 / damping: 0.25` interaction and `0.033 / 0.45` popup settings.
- Reactive `dynamicStyles` string / `$:` blocks — replaced by writing the CSS custom
  properties directly to the card element in the RAF loop.
- `onMount`, `svelte:window on:scroll={reposition}`, `document.visibilitychange`,
  `setTimeout`-based `interactEnd` — replaced by pointer enter/leave handlers, a single
  RAF loop per card, `visibilitychange` reset, and a timeout that releases the spring
  to rest.
- `bind:this`, `class:active`, `class:interacting`, `class:loading` — replaced with
  explicit class toggles (`is-hovering`, `is-flipped`, `is-focused`).
- Props (`rarity`, `subtypes`, `supertype`, `types`, `foil`, `mask`, `showcase`) — now
  data attributes on the card element supplied by the TCGdex mapping.
- The global `$activeCard` store + popover/retreat springs + `gtag` — replaced by the
  FLIP-style lightbox in `src/lightbox.js` (measure, transform, animate); the tilt
  springs keep running on the enlarged card.
- `firstPop` spin-on-open, showcase loop, and the orientation (device tilt) feature
  were dropped as out of scope.
- The reference's `.card__back` / `.loading` flip mechanics were replaced with an
  explicit `preserve-3d` flipper (front hidden at 180°, back at 0°) so cards start
  face down and flip once.
