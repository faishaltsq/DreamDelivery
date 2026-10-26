# Dream Delivery

Cozy delivery game prototype: a midnight dream post office, three pixel-art couriers, four dream routes. Built as a static web app from the DreamDelivery Art Pack v0.1 prototype assets.


## Play

```
cd web
node dev/server.cjs
# open http://127.0.0.1:8642/
```

No build step, no dependencies. Static ES modules only.

## The loop

Dream Post Office → write and seal a letter → choose a courier (Momo / Lune / Pip) → pick a route (Cloudpath / Forest of Whispers / Moonfield / Starport) → watch the pixel journey → story encounter per route → postcard postmarked with the route stamp. Deliveries persist; collect all route stamps in the album.

## Code layout

```
web/game/state.js     pure game logic (state machine, routes, encounters, stamps)
web/render/           DOM projections + sprite atlas animator + SFX (no rules)
web/main.js           event wiring only
web/index.html        real HTML text over pack SVG skins
public/assets/        DreamDelivery Art Pack v0.1 (game rules never live here)
```

Logic and rendering are strictly separated: rendering reads state, DOM events dispatch actions, all game rules sit in one module.

## Asset pack quality labels

The pack is a prototype kit. In-slice assets and what production needs to replace them:

| Asset | Status | Production replacement |
|---|---|---|
| `environments/*/scene-native.png` | reference-derived crops | High-res illustrations + parallax layers |
| `couriers/*/animations/*` | placeholder-animation | Hand-registered frame animation |
| `couriers/*/portrait.png` | cutout-needs-qa | Cleaned high-res portraits |
| `postcards/*-sample.png` | demo-composite | Print-res postcard compositions |
| `branding/logo-illustrated-raster.png` | reference-derived | Vector logo |
| `audio/prototype/*.wav` | synthetic tones | Licensed soundscape |

Full inventory: `DreamDelivery_AssetPack_Prototype_v1/DreamDelivery_ArtPack_v0.1/data/asset-inventory.json`.

## Accessibility

Native keyboard controls, a roving courier radio group, visible focus, at least 44px touch targets, safe-area-aware layouts, and reduced-motion handling. Checked text pairs meet AA; a comprehensive accessibility audit is not claimed.

## Development

`web/dev/server.cjs` serves local play. `web/BUILD-NOTES.md` records tests and limitations.

```sh
node --test tests/state.test.js tests/assets.test.js tests/sprites.test.js tests/refresh.test.js
node tests/reconstruction.cjs
node tests/reconstruction.cjs --v2
```

The screenshot runner launches an isolated Chrome profile. Set `CHROME_PATH` if Chrome is not at its default Windows path. It captures every screen at 390, 768, 1440 and 1920 widths into `qa/reconstruction/`, including `comparison.html` alongside the master concept.

## Art Refresh Pack v2

The supplied v2 pack is a preview draft, not native-HD production artwork. Its checksummed assets are available at `http://127.0.0.1:8642/?art=v2`; v1 stays default. [Refresh delivery and rollback](docs/ART-REFRESH-V2.md), [registry contracts](docs/ASSET-INTEGRATION.md), and [side-by-side screenshots](qa/art-comparison.html).

Actual screenshot findings, defects fixed and production art limitations: [visual QA](docs/VISUAL-QA.md).
