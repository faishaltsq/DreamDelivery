# Dream Delivery — Build Notes

Two increments shipped:
1. Vertical slice: Post Office → Write Letter → Choose Momo → Moonfield Journey → Encounter → Story Postcard.
2. Expansion: 4 routes (Cloudpath, Forest of Whispers, Moonfield, Starport), all 3 couriers with per-courier walk atlases, per-route encounters + stamps, localStorage persistence, stamp album (9 slots), prototype SFX toggle.

Playable slice: Dream Post Office → Write Letter → Choose Momo → Moonfield Journey → Encounter → Story Postcard.

## Run

```
cd web
node dev/server.cjs
# open http://127.0.0.1:8642/
```

No build step. Static ES modules.

## Structure

```
web/
  index.html          semantic HTML, all 6 screens
  styles/tokens.css   copied pack tokens (assets/ui/dream-delivery-tokens.css)
  styles/main.css     layout, responsive, a11y overrides
  game/state.js       pure logic: state, COURIERS, ROUTES, ENCOUNTERS, dispatch()
  render/screens.js   DOM projection of state (no game rules)
  render/sprites.js   SpriteAnimator: atlas blitter driven by animations.json metadata
  main.js             wiring: DOM events -> dispatch -> render
  dev/server.cjs      throwaway static server (not shipped)
public/assets/        full copy of pack assets (239 files), manifest at public/assets/manifest.json
shots/                smoke screenshots + contact sheet + compare-vs-master.png
```

Game rules live only in `web/game/state.js`. Rendering reads state; DOM events dispatch actions.

## Asset usage

- Environments use `scene-native.png` (reference-derived crops) rendered `image-rendering: pixelated`.
- UI panels/buttons/inputs use the pack's `vector-ready` SVG skins with real HTML text on top.
- Courier portraits: `portrait.png` (cutout-needs-qa) on `card-background.svg`.
- Journey animation: `momo/animations/walk.png` atlas, 4 frames @ 7 fps, metadata from `animations.json`.
- Encounter effect: `effects/moonburst.png`. Postcard: `postcards/moonfield-sample.png`, `stamps/moonrise.png`, `mail/wax-stamp.png`.

## Accessibility / responsive

- Keyboard operable end to end (verified via CDP walk). `:focus-visible` gold ring from tokens.
- Contrast verified by WCAG formula: button label dimmed skin 5.03:1 worst stop, placeholders #736A5B 4.94:1, hints #565A73 5.75:1, panel text 10+:1.
- Inputs/buttons ≥44px touch height; mobile 390px reflow verified, zero horizontal scroll.
- `prefers-reduced-motion`: CSS kills transitions/trot; animator draws static frame, journey compresses to 0.8s.

## Verification

- Logic: headless state-machine tests (LOGIC_OK, LOGIC_V2_OK, STATE_V2_OK): empty-seal rejection, all 4 route/encounter/stamp chains, album open/back, reset keeps stamps+letters.
- Browser: CDP smoke walk (headless Chrome): all 4 routes delivered with Lune/Pip/Momo, per-route postcard photo+stamp+byline render from state, stamp album 4-of-9 after reload, welcome-back line, audio toggle aria-pressed, mobile 390px no horizontal scroll, `NO_PAGE_ERRORS`.
- Fixed during verification: journey re-entry restart bug, continue-button single-fire bug, ADVANCE_JOURNEY dt scaling bug (progress hit 1 in 3 frames).
- Screenshots in `shots/`; `shots/compare-vs-master.png` = master reference beside built screens.
- Limitation: this session had no image vision; visual identity check is programmatic (palette-token presence within 3% of master, dominant color buckets match). Human review of `shots/` recommended.

## Bonus stamps (not earnable yet)

Album shows all 9 pack stamps; castle/windmill/portal-forest/twilight-port/floating-city render as `?` until earn conditions exist (e.g., perfect-run rewards). Route stamps (crescent, dream-forest, moonrise, starry-night) come from deliveries.

## Production gaps (from inventory statuses)

| Asset used in slice | Status | Production replacement needed |
|---|---|---|
| environments/*/scene-native.png | reference-derived (1536x1024 sheet crops, 159-417px wide) | High-res independent route illustrations with parallax layers; drop in at same manifest paths |
| couriers/*/animations/*.png | placeholder-animation (pose reuse, 1px movement) | Hand-registered walk/idle/fly/reaction frames |
| couriers/*/portrait.png | cutout-needs-qa (x4 upscaled, cream fringing) | Clean high-res portraits |
| postcards/moonfield-sample.png | demo-composite | Real per-route postcard compositions at print resolution |
| branding/logo-illustrated-raster.png | reference-derived | Vector logo; raster only for prototype |
| effects/moonburst.png | prototype-extracted thumbnail | Full-res FX with alpha |
| stamps/moonrise.png | prototype-extracted | Consistent stamp set passes |
