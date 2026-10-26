# Asset integration

`web/render/assets.js` owns image selection, pending production paths, validation, bounded loading and prototype fallback. Gameplay state and the journey clock do not depend on asset requests completing. No v2 art is fabricated or copied from v1.

## Production delivery status

Native-HD production art remains pending. A supplied `DreamDelivery_V2.zip` preview draft was discovered during implementation, checksummed and installed as an opt-in candidate. Default is v1; `?art=v2` enables the candidate. See [delivered refresh notes](ART-REFRESH-V2.md) for exact quality flags and rollback.

| Registry ID / role | Pending production path | Real prototype fallback |
| --- | --- | --- |
| `environment.post-office-interior`, background | `/assets/v2/environments/post-office-interior/background.webp` | `/assets/environments/post-office-interior/scene-native.png`, `scene-preview.webp` |
| `environment.moonfield`, background | `/assets/v2/environments/moonfield/background.webp` | `/assets/environments/moonfield/scene-native.png`, `scene-preview.webp` |
| `courier.momo.portrait` | `/assets/v2/couriers/momo/portrait.png` | `/assets/couriers/momo/portrait.png` |
| Momo walk animation | `/assets/v2/couriers/momo/animations/walk.png`, `manifest.json` | `/assets/couriers/momo/animations/walk.png`, `animations.json` |
| `ui.primary` | `/assets/v2/ui/button-primary.svg` | `/assets/ui/primary-button.svg` |
| `ui.secondary` | `/assets/v2/ui/button-secondary.svg` | `/assets/ui/secondary-button.svg` |
| `ui.panel` | `/assets/v2/ui/parchment-panel.svg` | `/assets/ui/parchment-panel.svg` |
| `ui.postcard` | `/assets/v2/ui/postcard-frame.svg` | `/assets/ui/postcard-frame.svg` |
| `ui.card` | `/assets/v2/ui/card.svg` | `/assets/ui/card-background.svg` |
| `ui.slot` | `/assets/v2/ui/inventory-slot.svg` | `/assets/ui/collection-slot.svg` |
| `ui.progress` | `/assets/v2/ui/progress-track.svg` | `/assets/ui/progress-track.svg` |

Other supplied environment IDs (`post-office-exterior`, `cloudpath`, `forest-of-whispers`, `starport`) resolve real v1 native/preview images. Lune and Pip portrait/animation paths remain v1. Unknown IDs do not silently substitute another route or courier.

Required pack sources consulted: pack `README.md`, `docs/AGENT-ASSET-RULES.md`, `data/asset-content-manifest.json`, relevant entries of `data/asset-inventory.json`, and shipped courier `animations.json`.

Quality labels remain honest:

- `scene-native.png`: **reference-derived** composite crops, not production backgrounds. Interior is 368×204; Moonfield is 159×154.
- `scene-preview.webp`: **prototype-upscaled**, 1600×900; larger dimensions do not add source detail.
- Courier portraits: **cutout-needs-qa**, 384×384, with limited source resolution and possible cream fringing.
- Courier atlases: **placeholder-animation**, 256×64; four reused-pose 64×64 walk frames at 7fps, normalized foot anchor `{x:0.5,y:0.85}`. Not polished animation.
- UI SVGs: **vector-ready**; real HTML retains text, semantics, controls and accessibility.

## Runtime APIs

```js
import { applyAssets, applyScene, preloadScene, loadCourier } from './render/assets.js';

await applyAssets(screen);               // default root: document; resolves data-asset bindings
await applyScene(image, 'moonfield');    // apply selected environment background to an existing IMG
await preloadScene('moonfield');         // resolves/cache-warms without changing the DOM
const courier = await loadCourier('momo');
// {src, frames, fps, frameWidth, frameHeight, anchor:{x,y}, degraded, status, reason}
```

`applyAssets(root)` includes `root` itself when it has `data-asset`. IMG bindings update `src` after a successful probe; decorative UI images also set the parent surface's `--skin-image` for nine-slice borders. Other elements receive `backgroundImage` and `--asset-image`. This preserves HTML/event handlers. `applyScene` mounts only explicitly registered extra layer images and removes old route layers. No layers are fabricated.

Results expose `status`, `reason`, `degraded`, selected `src` and natural `width`/`height`. DOM targets expose `data-asset-status` and `data-asset-reason`. Status is `v2`, `pending-v2` (valid v1 while replacement is missing/invalid), `fallback` (v1-only asset), or `unavailable`. The root receives `data-assets-status` (`ready`, `pending-v2`, `unavailable`) for its UI bindings. On total failure, no invalid URL replaces the existing DOM source. Stale async results cannot overwrite a later binding on the same element. Unknown courier IDs reject with `RangeError`; unavailable valid atlas rejects rather than returning invented art. Callers handle those failures visibly without stopping the journey clock.

## Image and layer contract

`ASSETS` is the centralized declaration. Image entries contain `v2` and `fallback` variant arrays. Each variant has `{src,width,height,exact}`. Environment entries instead contain `layers: {background: {v2, fallback}}`. Add only paths to genuine delivered files. Register optional foreground/midground layers explicitly; the loader never guesses filenames or presents concept strips as finished parallax layers.

Selection ranks metadata **before** fetch/decode: smallest image sufficient for both rendered dimensions × device pixel ratio (capped at 3). If none is sufficient, largest available is attempted first. Corrupt/missing candidates continue through the remaining variants, then v1. Only the attempted variant is decoded, not every size. Preloading uses viewport dimensions; visible bindings use their content-box dimensions.

Natural dimensions must be positive integers. V1 files and delivered preview variants match registered dimensions exactly (background candidates 1280×720 or 2560×1440). Future genuine production variants can declare other validated dimensions/aspect. Momo portrait is 384×384. Delivered UI SVGs use their actual canvas dimensions. Dimensions certify compatibility, never artistic quality.

Requests fetch the bytes before creating an off-DOM image from a temporary blob URL. Missing v2 URLs therefore never become broken IMG sources. Blob URLs are revoked after decoding/abort. HTTP servers/browser developer tools may still display failed **fetch** requests; no `console.error` is emitted by this module. HTTP errors, malformed JSON, decode failures, natural-dimension mismatches and timeouts are data in fallback results.

Both image and metadata caches hold in-flight promises and failed/successful outcomes, sharing repeated probes. Each cache is bounded to 96 entries (oldest insertion evicted); failed pending assets are not retried each render. Reload the page after delivering replacement art. Each fetch/body/decode wait has a 1500ms deadline and an abort signal. Normal missing local files fail immediately; a hung Momo v2 manifest/sprite and v1 metadata/image sequence has at most four deadline waits. Selection remains independent of gameplay timing.

## Momo manifest

For a future horizontal atlas in `sprite.png`, use the flat schema below. The delivered preview instead has nested `animations.walk` and `recommendedAnchor`; the registry reads that real manifest and loads `animations/walk.png`. Its `sprite.png` is a single 64×64 pose, not an atlas.

```json
{
  "frames": 8,
  "fps": 12,
  "frameWidth": 96,
  "frameHeight": 96,
  "anchor": { "x": 0.5, "y": 0.85 }
}
```

This is a schema example, not a shipped manifest or a claim about art. Frames must be integers 1–256, fps finite and greater than 0 through 60, frame dimensions integers 1–2048; total atlas width cannot exceed 16384. Both normalized anchor coordinates must be finite in `[0,1]`. The decoded image must be exactly `frames*frameWidth` wide and `frameHeight` tall, one horizontal row. Multi-row atlases require an explicit renderer/contract change; they do not silently animate incorrectly.

Missing/invalid v2 metadata or atlas uses the existing `loadJourneyMeta` v1 helper and its validation/defaults, not a second v1 parsing convention. V1 metadata/defaults are also validated against decoded atlas dimensions before returning a descriptor. Render sprites with `image-rendering: pixelated`; retain reduced-motion handling in the animator.

## Regression checks

`tests/assets.test.js` uses `node:test` and injected `fetchImpl`/`probeImage` boundaries. It covers missing/corrupt production assets, natural dimensions/aspect, smallest sufficient variant, explicit layers, courier metadata/atlas compatibility, v1 defaults, bounded cached probes, metadata/image timeouts, stale scene races, DOM status and fetch-before-IMG behavior. `createAssetRegistry({assets,fetchImpl,probeImage,timeoutMs,cacheLimit})`, `validateImageDimensions` and `validateCourierManifest` are exported for deterministic checks.

Run from the repository root with the project's Node ES-module configuration, for example:

```sh
node --test tests/assets.test.js tests/state.test.js tests/sprites.test.js tests/refresh.test.js
```

Executed verification: 44 deterministic tests passed, 8 legacy browser tests passed, and both default and `--v2` reconstruction runs produced 32 screenshots each with clock-position, ten-delivery, SFX, keyboard, missing-atlas and reduced-motion checks. See `docs/VISUAL-QA.md`.
