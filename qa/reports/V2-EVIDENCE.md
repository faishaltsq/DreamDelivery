# V2 Evidence

Date: 2026-10-27
Branch: main
Target: art refresh v2 integration (`web/`, `tests/`, `qa/`, `docs/V2-COMPOSITION-NOTES.md`, `DreamDelivery_V2/`)

## Commands

```sh
node --test tests/state.test.js tests/assets.test.js tests/sprites.test.js tests/refresh.test.js
node tests/reconstruction.cjs
node tests/reconstruction.cjs --v2
```

## Unit tests

Observed this pass:

```
ℹ tests 53
ℹ suites 6
ℹ pass 53
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Exit status 0 (53/53 pass).

## Reconstruction runs

### Base pass — `node tests/reconstruction.cjs`

Run in this pass. Observed output (tail):

```
Captured eight screens at 390x844
Captured eight screens at 768x1024
Captured eight screens at 1440x900
Captured eight screens at 1920x1080
PASS: 32 screenshots; layout, clock-position sync, 10 deliveries, SFX dedup, keyboard.
```

### V2 pass — `node tests/reconstruction.cjs --v2`

Run in this pass. Observed output (tail):

```
Captured eight screens at 1920x1080
PASS: 32 screenshots; layout, clock-position sync, 10 deliveries, SFX dedup, keyboard.
```

Both passes ran in the same regeneration sequence; wall time 139.94 s total.

Recorded result read from `qa/reconstruction-v2/results.json` after the run:

- `"failures": []`
- `checks` array length: 35 (32 screen/width entries, each `issues: []`, e.g. `{"name":"post-office","width":390,"issues":[]}`)
- `screenshots` array length: 32

## Screenshot directory counts

```
$ ls qa/reconstruction | wc -l
34
$ ls qa/reconstruction-v2 | wc -l
34
```

Each directory holds 32 PNGs (4 widths x 8 screens) plus these two non-PNG files:

- `results.json`
- `comparison.html`

## failures arrays

`qa/reconstruction/results.json`:

```json
"failures": []
```

`qa/reconstruction-v2/results.json`:

```json
"failures": []
```

Both empty.

## Not verified

`tests/browser.test.cjs` (legacy CDP suite, requires a manually started Chrome on port 9333) was **not** run in this pass. It requires manual setup and remains unverified.
