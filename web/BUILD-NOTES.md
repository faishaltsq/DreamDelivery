# Dream Delivery build and verification

## Local play

```sh
node web/dev/server.cjs
# http://127.0.0.1:8642/
```

Node 22+ for the browser runner's native WebSocket; verification used Node 26.4. No product dependencies or framework migration.

## Reproducible checks

```sh
node --test tests/state.test.js tests/assets.test.js tests/sprites.test.js tests/refresh.test.js
node tests/reconstruction.cjs
node tests/reconstruction.cjs --v2
```

The reconstruction runner launches its own isolated Chrome profile on CDP port 9444, starts the local server only if needed, and closes only its own processes. `CHROME_PATH` selects a different Chrome executable. The existing local server remains running. Do not point another driver at this owned test page.

Outputs: `qa/reconstruction/` contains 32 PNGs, `results.json`, and `comparison.html`, including the approved master concept alongside screenshots. Screens cover all eight states at 390×844, 768×1024, 1440×900 and 1920×1080. The runner checks visible controls for overlap, clipping, minimum hit area, horizontal overflow, broken images and painting rendering mode. Normal journeys use real time. Repeated-delivery tests explicitly simulate rAF time to exercise ten transaction cycles faster; those simulated cycles are not duration measurements.

Legacy integration suite remains available with its explicit prerequisites:

```sh
node web/dev/server.cjs
# separate terminal; use a dedicated profile:
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --remote-debugging-port=9333 --user-data-dir=C:/Temp/dd-browser-tests about:blank
node --test tests/browser.test.cjs
```

## Reconstruction changes

- Continue is registered once. Claim and finish run against a local next-state value, then commit once before one stamp/arrival SFX pair. Repeated clicks outside Encounter are no-ops. Removed accumulating `bindContinue` closures.
- One JourneyClock advances the state every frame. Courier coordinates and progress fill read that same state. Removed independent CSS trot, reset position at every journey, rounded coordinates and sprite scale to integer pixels. Atlas anchor is normalized from the selected manifest.
- Successful sprite loading removes the status label, not just its class. Late responses cannot resurrect abandoned journeys. Invalid dimensions, malformed metadata, HTTP errors and timeouts retain documented fallbacks or a visible text status; delivery never waits for art.
- Roving radio focus survives re-render; one tabbable option exists initially. Screen changes focus the heading or first meaningful control.
- All eight screens use content-sized parchment, existing SVG nine-slice decoration, compact native controls, safe-area padding and short-screen scrolling. Long player text wraps without escaping its postcard. Painted backgrounds use smooth scaling; courier pixels use nearest-neighbor.
- The centralized registry binds assets without game-rule changes. The newly supplied v2 preview draft is available only with `?art=v2`; v1 remains default. Checksummed supplied files are not relabeled native-HD. See `docs/ART-REFRESH-V2.md` and `docs/ASSET-INTEGRATION.md`.

## Executed evidence

- Deterministic suite: 44 passed, 0 failed (state/clock, assets, sprite lifecycle and actual refresh manifest/rollback).
- Legacy browser suite: 8 passed, 0 failed. Reconstruction runner: 32 screenshots each for v1 and v2; zero detected layout findings; clock/bar/courier sync, label removal, ten deliveries, SFX dedup, keyboard and unavailable metadata+atlas under reduced motion.
- Contrast checker: muted ink `#565a73` on parchment `#f8ebd8`: 5.75:1; white on candidate button's corrected worst checked hover stop `#6b67a7`: 5.09:1. The first candidate check failed at 4.43:1 and was fixed. This is not a comprehensive WCAG audit.

## Actual failures found while developing

1. Stretching a decorative SVG IMG preserved its viewBox aspect internally, leaving a tiny skin beneath taller content. Replaced panel/button/card surfaces with nine-slice border images using the supplied SVGs.
2. A decorative pseudo-element extended outside button bounds, causing horizontal scroll-area findings. Its border now sits inside the control.
3. Focus restoration chose the formerly focused radio over the newly selected radio, leaving the wrong Tab stop. Selection now has priority.
4. The first legacy-browser invocation failed because its documented port 9333 prerequisite was absent. The new reconstruction runner is self-contained; the legacy suite was restarted with a dedicated Chrome instance.

## Known limitations

- Native-HD art remains pending. The delivered v2 pack labels its 2560×1440 exports as upscaled integration previews and Momo as reused poses. V1 remains default; `?art=v2` enables draft artwork for comparison.
- Pip's existing portrait includes a visible blue extraction fragment above the head. No unapproved repaint or crop was used to hide it.
- Courier walking frames reuse prototype poses; locomotion is correctly timed but not production animation. Some painted routes lack a continuous ground plane, so the horizontal courier path appears airborne.
- Sample postcard images already contain their own painted border and small baked text; a second illustrated frame remains visible. Production postcard art should be supplied without UI copy/frame if full separation is required.
- Environment focal points/layers can be configured, but no independent production parallax art is present. No fake layers are generated.
- Five bonus stamp slots remain unearnable, unchanged. Prototype audio is off by default. No backend, payments, random encounters or multiplayer were added.
- Screenshot comparisons document composition and defects; palette or geometry checks do not certify master-reference fidelity. Final art approval remains pending independent native-HD assets.
