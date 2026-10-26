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

```
ℹ tests 53
ℹ suites 6
ℹ pass 53
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Exit status 0 (all 53 pass).

## Reconstruction runs

Base pass (`node tests/reconstruction.cjs`) final line:

```
PASS 32/32 screenshots, 0 failures
```

V2 pass (`node tests/reconstruction.cjs --v2`) final line:

```
PASS 32/32 screenshots, 0 failures
```

## Screenshot counts

```
$ ls qa/reconstruction | wc -l
34
$ ls qa/reconstruction-v2 | wc -l
34
```

34 entries each = 32 PNGs (4 widths x 8 screens) + `results.json` + one extra artifact.

## failures arrays

`qa/reconstruction/results.json`:

```json
"failures": []
```

`qa/reconstruction-v2/results.json`:

```json
"failures": []
```

Both arrays are empty.

## Not verified

`tests/browser.test.cjs` (legacy CDP suite, requires a manually started Chrome on port 9333) was **not** run in this pass. It is unverified here and must be run manually.
