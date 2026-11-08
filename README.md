# Pokepack

Five random Pokémon TCG cards from the Sword & Shield era, dealt face down. Flip
them, tilt them under your pointer, and open a card full-screen to see its foil.

**Stack:** Vite + plain JavaScript (ES modules), vanilla CSS holo effects.

**Live:** https://kzsakib.github.io/pokepack/  
**Source:** https://github.com/kzsakib/pokepack  
**Mirror:** https://site-d541c6672242479bb1e8e10a5a719096.freebuff.page/

## Run it

```bash
npm install
npm run dev         # http://localhost:5173
npm run build       # production build in dist/
npm run build:pages # /pokepack/ build for GitHub Pages in dist-pages/
npm run preview     # serve the production build
```

No API key, no backend, no persistence. Everything (set list, dealt hand) lives in
memory and is re-dealt on every page load.

## What it does

- Deals five unique random cards from TCGdex sets whose ids start with `swsh`
  (Sword & Shield era only).
- Cards start face down; clicking flips once with a 3D `rotateY` animation. A
  placeholder shimmer covers the art until the image has loaded.
- Hovering a flipped card springs it toward the pointer (vanilla spring, RAF) and
  moves the holo shine and glare with it. Face-down cards only get a small lift.
- Three Pokémon Mystery Dungeon sprites roam near the pack. Each slot picks a
  random species, walks a short segment, sometimes pauses to look around and
  change facing, then chooses another direction. They avoid the header and footer
  text, are decorative (`aria-hidden`, `pointer-events: none`), and render above
  the cards but below the header, footer and focus view.
- A small **Sprites on/off** control in the header is a manual pause. Sprites are
  on by default for every visitor, regardless of the operating system's
  reduced-motion setting.
- Every card receives a different foil treatment drawn from the complete ported
  reference set — holo, cosmos, reverse, V, full-art, VMAX, VSTAR, radiant,
  amazing, gold secret, gallery or rainbow. The treatment is rolled per deal and
  named in the focus-view caption, independently of the card's printed rarity.
- Clicking a flipped card opens a focus view: a FLIP-style measure → transform →
  animate move to the centre over a dimmed, blurred backdrop, sized to 82% of the
  viewport height. After the animation the card is laid out at its real enlarged
  size, so the artwork is rasterised at that size rather than upscaled from the
  small grid bitmap. Tilt and holo keep working while it is open.
- Close with the close button, a backdrop click, or `Esc`. Focus is trapped between
  the card and the close button; the rest of the page is `inert` while open; scroll
  is locked. Only one card can be open.
- "Open another pack" deals a fresh hand.
- Keyboard accessible: cards are real buttons with visible focus rings and labels;
  Enter/Space work natively.
- Animations (deal, flip, tilt, lightbox and sprites) run by default even when the
  operating system requests reduced motion; this is an animation-led fan project.
- Touch: tap flips/opens. Pointer tilt ignores touch pointers and the card uses
  `touch-action: pan-y`, so vertical scrolling is never blocked.

## Card data and images

[TCGdex](https://tcgdex.dev) REST API v2, free and keyless:

- `GET /v2/en/sets` — set list, cached in memory for the session.
- `GET /v2/en/sets/{id}` — card briefs for randomly chosen sets.
- `GET /v2/en/cards/{id}` — rarity/subtypes/details.
- Images: `<image>/high.webp`, falling back to `<image>/high.png`.

The set list is looked up at runtime; a verified fallback list of SWSH set ids is
used only if the sets endpoint is unreachable. If the deal fails, the page shows a
friendly retry panel instead of a broken grid.

### Ambient overworld sprites

Three slots run independently and use a shuffled bag of the twelve species, so a
page load shows three different Pokémon before any repeats. Each one fades in at
a random point around the pack, walks a short segment, sometimes pauses for
0.8–2.3 s to look around and change facing, then picks another direction. Gait
(walk/run), speed and the number of segments are rolled per sprite. After a few
moves it fades out and the slot waits 0.7–1.8 s before drawing the next species.
The twelve species are Bulbasaur, Charmander, Squirtle, Pikachu, Jigglypuff,
Psyduck, Gengar, Eevee, Snorlax, Mudkip, Gardevoir and Lucario.

SpriteCollab supplies overworld walk cycles rather than separate run cycles, so
“run” uses the same eight-way walk sheet at a faster frame rate. The sheets are
self-hosted in `public/sprites` (about 124 KB) and the frame metadata lives in
`public/sprites/index.json`; there is no runtime GitHub request. Regenerate them
with:

```bash
python3 scripts/fetch-sprites.py
```

The header **Sprites on/off** button pauses the layer and clears all animation
timers. Sprites are on by default even when the system preference is reduced
motion.

### Randomized reference foils

Every deal gives each card a different treatment from the reference styles, so a
pack shows up to five distinct effects. The selection is purely in memory and
rerolls with every deal. Some treatments (V full-art, VMAX, VSTAR) need the
Pokémon foil assets and are only assigned to Pokémon; the rest work on Trainers
and Energy too.

| Label | `data-rarity` selector | Reference file |
| --- | --- | --- |
| Holo foil | `rare holo` | `regular-holo.css` |
| Reverse holo | `reverse holo` | `reverse-holo.css` |
| Cosmos holo | `rare holo cosmos` | `cosmos-holo.css` |
| V foil | `rare holo v` | `v-regular.css` |
| Full-art foil | `rare ultra` | `v-full-art.css` |
| VMAX foil | `rare holo vmax` | `v-max.css` |
| VSTAR foil | `rare holo vstar` | `v-star.css` |
| Radiant foil | `radiant rare` | `radiant-holo.css` |
| Amazing foil | `amazing rare` | `amazing-rare.css` |
| Gold secret foil | `rare secret` | `secret-rare.css` |
| Gallery foil | `trainer gallery rare holo` | `trainer-gallery-holo.css` |
| Rainbow foil | `rare rainbow alt` | `rainbow-alt.css` |

### Deal weighting

The five slots come from five different sets. Trainer/Galarian Gallery sets are
weighted 3× so packs usually include textured hits instead of only commons. The
Shining Fates Shiny Vault (`swsh4.5sv`) is excluded because its shiny-specific foil
art was not ported (see below).

### How the foil is chosen

`src/data.js` keeps the actual TCGdex rarity for the caption and puts the rolled
treatment's selector into `data-rarity`. `data-actual-rarity` keeps the printed
rarity for debugging, and `data-foil` keeps the treatment id. The bag is shuffled
and each card takes the first compatible unused entry, so a pack never repeats a
treatment unless the card type forces it.

## Credits and licence

- Holo effect, foil/glare layer CSS and the card art textures are ported from
  [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css),
  licensed **GPL-3.0**. The full licence is in [LICENSE](LICENSE) (also served at
  `/LICENSE`). The study copy in `./reference` is never shipped.
- Galaxy Holo texture by **aschefield101**. Background textures by **Vecteezy**.
  Both are credited in the reference project and here.
- Overworld sprites: [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab),
  licensed **CC BY-NC 4.0**. The licence text is at `public/sprites/LICENSE.md`
  and the repository's per-sprite credits are reproduced in
  `public/sprites/CREDITS.md` (also linked from the footer). The site is a
  non-commercial fan project.
- Card data and images: [TCGdex](https://tcgdex.dev).
- Card back: `https://tcg.pokemon.com/assets/img/global/tcg-card-back-2x.jpg`,
  downloaded to `public/img/card-back.jpg` (not hotlinked).
- Pokémon and Pokémon TCG card images are trademarks of Nintendo, Creatures Inc.
  and GAME FREAK. This is an **unofficial fan project**, not affiliated with or
  endorsed by them.

## Assumptions and changes

- The reference normally loads per-card foil and mask art from its own CDN
  (`/foils/...`, `/masks/...`); that art is not in the public repository. Pokepack
  therefore never marks a card `masked` and uses each CSS file's built-in
  `:not(.masked)` fallback textures. This is noted at the top of `src/styles/holo.css`.
- Shiny Vault cards are excluded rather than shown with an approximate effect.
- The reference's Svelte springs were re-implemented as frame-driven springs with
  the same stiffness/damping values; `--pointer-*`, `--rotate-*`, `--background-*`,
  `--card-opacity`, `--card-scale` and `--translate-*` are written directly to each
  card element. See `NOTES.md`.
- The reference's webcam/device-orientation tilt, showcase loop and analytics calls
  were dropped.
- Holo blend layers are `visibility: hidden` while a card is at rest to avoid idle
  compositing, and `will-change` is only applied while hovering/focused.
- The focus view animates with a FLIP transform, then swaps to the real enlarged
  layout box and drops `will-change`, so the browser rasterises at the target size.
- Pointer listeners live on the card button (the only hit-testable element) rather
  than the `pointer-events: none` article, and the foil is initialised from the
  pointer's entry coordinates. This keeps hover working in Safari/Firefox and after
  a click-to-flip without requiring extra pointer movement.
- The GitHub Pages build uses a `/pokepack/` base; Vite rebases the CSS textures and
  `import.meta.env.BASE_URL` handles the card back and sprites.
- No localStorage, sessionStorage, cookies or server state are used.

## Checks

- Layout verified in a real browser at 360 px (2 columns, fifth card centred),
  768 px (3 + 2 centred) and 1440 px (5 across). No horizontal overflow.
- Real-pointer test: hovering a revealed card adds `is-hovering`, sets the foil
  opacity to 1 and writes non-zero tilt variables; the 720 ms flip transition and
  the focus view (open, caption, close, focus return) were exercised on the built
  site.
- Lightbox test: after the 520 ms FLIP the card is 501 × 702 CSS px on a 1440 × 900
  viewport, with `transform: none`, `will-change: auto`, and the 600 × 825 source
  image rendered at ~508 × 693. Closing returns the same card to its original grid
  slot with no leftover transform.
- Sprite test: three `.wanderer` elements spawned immediately at different species,
  stayed inside the pack's vertical band, changed frame and facing over time, and
  paused for a look-around before changing direction. The header toggle removed
  and recreated all three sprites cleanly.
