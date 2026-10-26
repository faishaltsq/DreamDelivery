# Art Refresh v2 candidate integration

During reconstruction, `DreamDelivery_V2.zip` became available in the workspace. Its own README describes a **Preview + UI Production Draft**, not a professional native-HD pack. The supplied `FILE-INVENTORY.json` SHA-256 values were verified before copying 48 actual runtime files into `public/assets/v2/`; `pack-manifest.json` preserves the original quality flags. The source ZIP, generated boards and raster UI previews are not duplicated into runtime assets.

## Preview / rollback

- Default and `?art=v1`: approved v1 fallback art with refined layouts.
- `http://127.0.0.1:8642/?art=v2`: opt-in delivered candidate environments, Momo and SVG skins.
- Rollback: remove `art=v2` and reload. No save migration or game-rule changes.

The query flag controls registry selection; files are never copied over v1 paths. Missing/corrupt v2 candidates still resolve to v1. Production-ready HD remains pending even though preview candidate files now exist.

## Differences from proposed paths

| Role | Supplied file / geometry |
| --- | --- |
| Interior, Moonfield | `background.webp` 2560×1440; `background-1280.webp` 1280×720; explicitly upscaled previews |
| Momo `sprite.png` | Single 64×64 pose, **not** the animation atlas |
| Momo walk | Manifest `animations.walk` points to `animations/walk.png`, 4×64×64 at 7fps; `recommendedAnchor` retained |
| Primary / secondary buttons | `button-primary.svg`, `button-secondary.svg`, 320×90 |
| Panel | `parchment-panel.svg`, 720×510 |
| Card | `card.svg`, 320×380 |
| Collection slot | `inventory-slot.svg`, 120×120 |
| Postcard / progress | `postcard-frame.svg` 900×570; `progress-track.svg` 520×38 |

Registry maps these actual names instead of fabricating renamed files. It also retains the earlier flat manifest contract `{frames,fps,frameWidth,frameHeight,anchor}` for a future horizontal `sprite.png` atlas.

## Quality and comparison

- Background original detail: Interior 516×245, Moonfield 319×155, resampled to the declared integration canvases. Native independent HD art still required.
- Momo is aligned prototype-source reuse, not hand-registered animation.
- SVG kit is scalable draft artwork requiring visual approval. Nine-slice borders avoid nonuniform distortion of corner art.
- Candidate screenshot review: Interior provides a clear empty desk/window composition; Moonfield provides a clearer field/bridge than v1's floating islands. Both remain visibly soft on desktop. Pip remains v1 and retains its blue extraction fragment.

Reproduce both sets:

```sh
node tests/reconstruction.cjs
node tests/reconstruction.cjs --v2
```

Each run passed all layout/lifecycle checks and captured 32 images. Compare `qa/art-comparison.html`, `qa/reconstruction/comparison.html`, and `qa/reconstruction-v2/comparison.html` against the included master. Passing dimensions, colors or screenshot geometry is not artistic approval.
