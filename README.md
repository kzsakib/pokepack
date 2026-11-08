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
- Three Pokémon Mystery Dungeon sprites wander the page. Each slot picks a
  random species, gait and one of eight directions, crosses the viewport, then
  waits a random moment before returning. Sprites are decorative (`aria-hidden`,
  `pointer-events: none`) and render above the pack but below the header, footer
  and focus view, so they cannot disappear behind the cards.
- A small **Sprites on/off** control in the header follows
  `prefers-reduced-motion`: reduced-motion users start paused and can opt in with
  one click. The first three sprites appear at the viewport edge immediately, not
  after a delayed walk in from outside the screen.
- Roughly a third of cards (at least one per pack) get one of four randomised
  signature foils on top of their rarity: **iridescent**, **pixel**, **prism** or
  **frost**. The treatment is chosen per deal and named in the focus-view caption.
- Clicking a flipped card opens a focus view: a FLIP-style measure → transform →
  animate move to the centre over a dimmed, blurred backdrop, scaled to 80% of the
  viewport height. Tilt and holo keep working while it is open.
- Close with the close button, a backdrop click, or `Esc`. Focus is trapped between
  the card and the close button; the rest of the page is `inert` while open; scroll
  is locked. Only one card can be open.
- "Open another pack" deals a fresh hand.
- Keyboard accessible: cards are real buttons with visible focus rings and labels;
  Enter/Space work natively.
- `prefers-reduced-motion` swaps the 3D flip for a short cross-fade and disables
  pointer tilt; the focus view opens without the scale animation.
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

Three slots run independently. On load all three appear at the viewport edge and
start walking immediately; after a sprite leaves the viewport, its slot waits
0.7–1.8 s, rerolls the species, gait and direction, and sends another one across.
The twelve species are Bulbasaur,
Charmander, Squirtle, Pikachu, Jigglypuff, Psyduck, Gengar, Eevee, Snorlax,
Mudkip, Gardevoir and Lucario.

SpriteCollab supplies overworld walk cycles rather than separate run cycles, so
“run” uses the same eight-way walk sheet at a faster frame rate and a faster
crossing speed. The sheets are self-hosted in `public/sprites` (about 160 KB) and
the frame metadata lives in `public/sprites/index.json`; there is no runtime
GitHub request. Regenerate them with:

```bash
python3 scripts/fetch-sprites.py
```

`prefers-reduced-motion: reduce` starts the wanderers paused rather than hiding
the feature permanently; the header toggle is the explicit opt-in. Turning it off
removes the layer and all animation timers, so it is also a normal pause control.

### Signature foils

These are Pokepack additions, not part of the reference port. They replace only the
shine/glare layers, so the card art stays readable and the rarity still drives the
base glow. Each pack rolls independently; nothing is persisted.

| `data-effect` | Look |
| --- | --- |
| `iridescent` | pearl rainbow conic sweep that rolls with the pointer |
| `pixel` | hard checkerboard foil under a CRT pixel grid |
| `prism` | angular crystal shards and a moving spectrum |
| `frost` | icy etched-glass sheen and fine crystal scratches |

### Deal weighting

The five slots come from five different sets. Trainer/Galarian Gallery sets are
weighted 3× so packs usually include textured hits instead of only commons. The
Shining Fates Shiny Vault (`swsh4.5sv`) is excluded because its shiny-specific foil
art was not ported (see below).

### Rarity → effect mapping

The reference CSS was written for the pokemontcg.io rarity names, so TCGdex values
are normalised in `src/data.js`:

| TCGdex rarity / marker | `data-rarity` | Effect |
| --- | --- | --- |
| Common, Uncommon, Rare (no reverse) | `basic` | subtle glare only |
| Common/Uncommon/Rare with a reverse print | `<rarity> reverse holo` | reverse holo, foil outside the art window |
| Holo Rare | `rare holo` | regular rainbow holo |
| Promo with `variants.holo` | `rare holo cosmos` | cosmos holo (SWSH holo promos) |
| Holo Rare V, V-UNION | `rare holo v` | V sunpillar + grain |
| Ultra Rare (V full art) | `rare ultra` | V full-art illusion foil |
| Holo Rare VMAX | `rare holo vmax` | VMAX rainbow cloud |
| Holo Rare VSTAR | `rare holo vstar` | VSTAR etched ancient pattern |
| Radiant Rare | `radiant rare` | radiant etched glitter/bars |
| Amazing Rare | `amazing rare` | amazing-rare glitter burst |
| Secret Rare | `rare secret` | gold secret glitter |
| Trainer/Galarian Gallery normal | `trainer gallery rare holo` | gallery colour bands |
| Gallery V / VMAX | `rare holo v` / `rare holo vmax` + `data-trainer-gallery="true"` | gallery V / rainbow alt |
| anything unmapped | `basic` | falls back to the subtle glare |

Reverse holo is a print variant rather than a TCGdex rarity. Eligible cards (those
whose `variants.reverse` is true) are shown as reverse holo 45% of the time. Cosmos
holo is assigned to holo promos because TCGdex has no "Holo Rare Cosmos" value.

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
- Pointer listeners live on the card button (the only hit-testable element) rather
  than the `pointer-events: none` article, and the foil is initialised from the
  pointer's entry coordinates. This keeps hover working in Safari/Firefox and after
  a click-to-flip without requiring extra pointer movement.
- The GitHub Pages build uses a `/pokepack/` base; Vite rebases the CSS textures and
  `import.meta.env.BASE_URL` handles the card back.
- No localStorage, sessionStorage, cookies or server state are used.

## Checks

- Layout verified in a real browser at 360 px (2 columns, fifth card centred),
  768 px (3 + 2 centred) and 1440 px (5 across). No horizontal overflow.
- Real-pointer test: hovering a revealed card adds `is-hovering`, sets the foil
  opacity to 1 and writes non-zero tilt variables; the 720 ms flip transition and
  the focus view (open, caption, close, focus return) were exercised on the built
  site.
- Sprite test: three `.wanderer` elements spawned immediately, changed frame and
  computed position over time, and sat above `main` but below the header/footer.
  The header toggle removed and recreated all three sprites cleanly.
