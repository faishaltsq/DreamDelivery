# Dream Delivery

Cozy delivery game prototype: a midnight dream post office, three pixel-art couriers, four dream routes. Built as a static web app from the DreamDelivery Art Pack v0.1 prototype assets.

![status](https://img.shields.io/badge/status-vertical--slice-orange)

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

Keyboard-only playable (WAI-ARIA radiogroup with arrow keys, visible gold focus ring), WCAG AA-checked pairings, ≥44px touch targets, `prefers-reduced-motion` support, responsive from 390px up.

## Development

`web/dev/server.cjs` is a throwaway static server for local play only. `web/BUILD-NOTES.md` documents verification evidence and known gaps.
