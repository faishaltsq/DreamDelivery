# Dream Delivery — Build & Verification Notes

Two increments shipped:
1. Vertical slice: Post Office → Write Letter → Choose Momo → Moonfield Journey → Encounter → Story Postcard.
2. Expansion: 4 routes (Cloudpath, Forest of Whispers, Moonfield, Starport), all 3 couriers with per-courier walk atlases, per-route encounters + stamps, localStorage persistence, stamp album (9 slots), prototype SFX toggle.
3. Stability & gameplay foundation audit: journey timing rewrite, listener lifecycle, keyboard accessibility, asset-loading resilience, hybrid art rendering, committed regression suites.

## Run

```
cd web
node dev/server.cjs
# open http://127.0.0.1:8642/
```

## Reproduce the test suites

```
# Logic (no browser needed):
node --test tests/state.test.js

# Browser (two terminals):
node web/dev/server.cjs                                                        # waits for READY
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --remote-debugging-port=9333 about:blank
node --test tests/browser.test.cjs                                             # needs BOTH services up

# Visual QA capture (same two services up):
node tests/visual-qa.cjs        # writes shots/vqa/*.png at 390/768/1440
```

## Audit fixes (this increment)

### P0-1 Journey timing
- Root cause: the rAF tick dispatched **cumulative elapsed time** as `dt` while `ADVANCE_JOURNEY` treated it as per-frame; progress accelerated quadratically (measured: encounter at ~2s wall on an 8s route; bar 15% → 94% in one 800ms window).
- Fix: `web/game/journeyClock.js` — pure accumulator with per-frame clamp (`MAX_FRAME_STEP = 1s`); completion is a single `justCompleted` edge; main.js dispatches one final `ADVANCE_JOURNEY(route.duration)` on that edge only.
- Tab suspension: hidden-tab deltas clamp to 1s/frame, so progress is honest and completion lands on the timeline; `pagehide` cancels the pending rAF; stale-frame guard drops ticks after leaving the journey screen.
- Reduced motion: state timeline unchanged (stamps/letters identical); only the sprite loop freezes on frame 0 and the visible trot anim finishes immediately.
- Synchronization: progress bar renders from the same `clock.progress` that drives completion; the CSS trot duration is set inline to the route duration.

### P0-2 Listener lifecycle
- `bindContinue()` is idempotent (boolean guard, unbound after each use). Verified by 10 consecutive deliveries (`ten consecutive deliveries` test) plus double-click assertions per delivery; letters exactly 10, stamps exactly 4 distinct. State machine additionally rejects double `FINISH_DELIVERY` (`_delivered` flag set on first fire, cleared on `BEGIN_JOURNEY`).

### P0-3 Keyboard accessibility
- Roving tabindex: exactly one tabbable card at all times (`renderChoose` restores/assigns it across re-renders; first card tabbable when nothing selected).
- ArrowLeft/Right/Up/Down + Home + End, wrapping; selection follows focus; visible focus ring (gold `--dd-focus-ring`).
- Verified keyboard-only: seal → arrows/Home/End → Enter → route Enter → journey starts.

### P0-4 Asset-loading resilience
- `animations.json` fetch: HTTP failure/malformed JSON falls back to pack-contract metadata (64×64, 4-frame walk @7fps) with a `console.warn`; journey stays playable. Tested with a 500-intercepted fetch (browser test) + injected failures (logic tests).
- Sprite `<img>` error: canvas hidden, labeled status chip replaces it (`Waking <name>…` / `<name> travels unseen`); no unrelated art substituted; timeline completes.
- Mid-fetch navigation: `startJourney` aborts cleanly (no rAF leak).

### P1 Hybrid art rendering
- Removed `pixelated` from hand-painted environment scenes and the painted postcard photo and cutout portraits; kept nearest-neighbor on true pixel-art: courier canvas, wax stamps, route tiles, collectible stamps, effects.
- Palette audit vs `master-original.png` (16-step token buckets, ±30 tol): cream/midnight/navy/ink prevalence tracks the master within a few points on all three breakpoints; parchment panel + midnight palette untouched.

## Before/after timing (measured)

| Route | Config | Before (broken dt) | After (60fps sim) | After (browser CDP) |
|---|---|---|---|---|
| cloudpath | 8s | encounter ~2.0s | 8.017s | 8.7s incl. poll interval |
| forest-of-whispers | 10s | ~2.5s | 10.017s | 10.8s |
| moonfield | 12s | ~3s | 12.017s | 12.8s |
| starport | 14s | ~3.5s | 14.017s | 14.8s |

CDP numbers include the 250-300ms poll interval; tolerance in tests is ±2.5s. Logic-sim numbers are deterministic.

## Test results (actual, this working tree)

```
node --test tests/state.test.js   → tests 21, pass 21, fail 0
node --test tests/browser.test.cjs → tests 8, pass 8, fail 0
```

Coverage: valid/invalid transitions, all four route chains, journey timing (deterministic + suspension + clamp), repeat deliveries (10x), stamp collection + dedup, malformed/valid persistence recovery, metadata failure fallback, keyboard flow, no-page-errors assertion (suite fails if any console error fires).

## Known limitations

- 5 bonus stamps (castle, windmill, portal-forest, twilight-port, floating-city) render as `?`; no earn conditions yet.
- SFX are `synthetic-prototype-sfx` placeholders (off by default).
- Environments are low-res `reference-derived` crops; production needs high-res re-renders (see pack inventory statuses). `scene-wide-alt.png` used on album backdrop only.
- Postcard photos reuse the pack's 4 demo composites; per-route painted finals pending.
- Visual identity was verified programmatically (palette/token presence) because this build session has no image vision; human review of `shots/vqa/` + `shots/vqa-compare-1440.png` still recommended.
- Browser suite assumes Chrome headless on 9333 and the static server on 8642; it flakes if two drivers share the same CDP page (observed and documented: run suites exclusively).

## Production gaps (unchanged from pack inventory)

| Asset used | Status | Production replacement needed |
|---|---|---|
| environments/*/scene-native.png | reference-derived crops | High-res illustrations with parallax |
| couriers/*/animations/* | placeholder-animation | Hand-registered frames |
| couriers/*/portrait.png | cutout-needs-qa | Clean high-res portraits |
| postcards/*-sample.png | demo-composite | Print-res compositions |
| audio/prototype/*.wav | synthetic tones | Licensed soundscape |
| stamps/* | prototype-extracted | Consistent stamp passes |
