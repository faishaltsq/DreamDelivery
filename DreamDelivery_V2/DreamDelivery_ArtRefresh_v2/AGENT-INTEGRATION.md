# Art Refresh v2 — Agent Handoff

## What is included
- Two environment candidates at `/assets/v2/environments/post-office-interior/background.webp` and `/assets/v2/environments/moonfield/background.webp` (2560x1440 **upscaled integration previews**, not native HD illustrations)
- Empty Post Office and Moonfield River alternative candidates.
- Momo prototype artwork with normalized 64x64 frames and pose-reuse animation atlases.
- Original scalable SVG parchment UI kit with readable CSS tokens.
- Master visual reference and original generated v2 boards.
- `manifest.json` with source quality flags.

## Install
Copy `assets/v2/` into your repo's `public/assets/v2/`, and keep `manifest.json` for asset registry mapping.
Do not copy new demo backgrounds over v1 production paths. Prefer a feature flag and compare candidate art in screenshots.

## Strong implementation constraints
1. Never label the upscaled preview backgrounds as native HD or production-ready.
2. Do not use `image-rendering: pixelated` on hand-painted scene images.
3. Render Momo via nearest-neighbor integer scaling; use courier/manifest.json metadata.
4. Do not bake text inside images; put actual HTML text atop SVG skins.
5. Avoid stretching SVG frames non-uniformly; use CSS border-image / nine-slice where appropriate.
6. Implement responsive art safe areas (desktop/mobile) and fallbacks.
7. Compare screenshot results with `reference/master-original.png` visually (not only colors).
8. Keep old assets in place, integrate behind a toggle, and rollback if candidate backgrounds look worse.
9. For authentic production HD, replace the backgrounds with independently created 2560×1440 artwork without changing registry keys.
10. Don't claim sprite atlas is hand-animated; source is reused pose artwork.

## Suggested registry
```js
export const V2 = {
 postOffice: '/assets/v2/environments/post-office-interior/background.webp',
 moonfield: '/assets/v2/environments/moonfield/background.webp',
 momo: '/assets/v2/couriers/momo/manifest.json',
 panel: '/assets/v2/ui/parchment-panel.svg',
 button: '/assets/v2/ui/button-primary.svg',
};
```
