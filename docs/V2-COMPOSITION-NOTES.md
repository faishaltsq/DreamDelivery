# V2 composition decisions

Scope: which supplied v2 candidates each screen mounts, and why. Quality labels are unchanged —
every candidate remains `UPSCALED_PREVIEW_NOT_NATIVE_HD`, `POSE_REUSE_NOT_FINAL` or `SCALABLE_SVG_V2_DRAFT`.
Nothing here claims production or HD quality.

## Post Office interior: furnished `background.webp` (chosen over `empty-background`)

| Candidate | Why it loses / wins |
| --- | --- |
| `background.webp` (furnished, with the clerk writing) | **Chosen.** Already tells the activity: a lit desk, lamp, window and wall of letters. Write/Choose screens place the parchment sheet on the *right* third, over shelving and the arch window, so the focal cluster (clerk, cat, lamp, desk) stays visible on the left. The scene reads as "a magical post office where you write", which is the spec's requirement. |
| `empty-background.webp` | Registered as `layers['interior-alt']`, **not mounted by default**. It removes the clerk and the writing props, leaving a furnished room with no focal subject; with a panel over it the screen reads as an empty shop, and the player has nothing to "join". Keeping it as a named layer lets a future scene (album wall, stamp kiosk) opt in via `data-environment-layers` without inventing art. |

Composition rules used: panel max width `--dd-width-narrow` (470px) at ≥1100px, right-aligned with
6vw inset; `object-position: center` so the desk art is not cropped away; the sheet is a normal-flow
parchment panel, never a fixed-position overlay. Below 1100px the panel centres and the interior is
cropped symmetrically (`object-position: center`), which still keeps the desk and window in frame.

## Mobile vs desktop: one scene, placement fixed instead of art swapped

At 1440x900 `object-fit: cover` shows the full furnished composition (clerk + cat centred on the
desk, lamp above, two arch windows). At 390x844 the vertical crop keeps the clerk, cat, desk and
window but drops the map and shelves. The empty room crops to a side wall: window, lamp and door,
**no subject**, so it loses even on mobile. Chosen scene is therefore the furnished interior at
every width — a breakpoint art swap would misreport which art is active.

Placement instead of art swap: mobile mounts the sheet as a bottom sheet (`padding-top: 42vh`,
`align-items: flex-end`) so the clerk/lamp/window stay visible above it; at >=1100px the sheet moves
to the right (`justify-content: flex-end`, 6vw inset) over shelving only and the desk art stays
whole. `object-position: center 42%` (mobile) / `center 38%` (desktop) keeps the lamp and window in
frame rather than the ceiling.

## Album: keeps the real v1 `scene-wide-alt.png`

Measured: the album panel is 700px and its grid of nine slots needs the full width. The v2 interior
has no wide variant and would be cropped to a strip behind it, so the album stays on v1 — a genuine
file of its own, not a fallback pretending to be v2.

## Prototype FX tiles are never mounted

Every `public/assets/effects/*.png` is a 43-50px contact-sheet crop, several with burned-in caption
text (`moonburst.png` is 44x35 and reads "Particles"). Mounted at 100-128px they rendered as grey
boxes with floating words. They are not upscaled or retouched; `enc.effectAsset` stays data only and
`UNMOUNTED_EFFECTS` in the registry records the decision. Real FX needs clean transparent sprites.

## Postcard frame and seal

`.postcard` paints its frame with exactly one `border-image` source: the v2 `postcard-frame.svg`
under `?art=v2`, the v1 frame otherwise. The old decorative `<img>` was removed and `ui.postcard`
unregistered so no second layer can ghost behind the sheet. The seal is the real 32x32
`wax-stamp.png` bitmap in both variants (`.pc-seal .wax-stamp`), never a skin-painted surface.

## Postcard stamp plate: documented pack-art defect

`postcard-frame.svg` bakes a lavender stamp plate into its **frame fill** (rendered by `border-image`
at 100x105 inside a 900x570 board). Because the plate is painted at a fixed place in the frame's
coordinate space while the sheet's own box changes height (mobile stacks, desktop splits), the plate
lands at a different offset relative to the content at each width. Registering the real stamp onto it
would need per-breakpoint magic pixels, which break again at the next content length.

Decision: the stamp is a normal flow item at the top of the right column in both variants, so it is
never floating unattached and never overlaps text. At 390 the painted plate is left visible and
unused; at 1440 the stamp column starts the right side, next to the plate's band, though not
pixel-registered to it. A correct fix belongs in the pack: publish an empty plate-free frame, or a
separate plate asset that the layout can position.

## Journey progress

One track per variant: v1's SVG supplies the groove and moon badge, so CSS only draws the fill; v2's
compact outlined track is sized from its own aspect ratio and CSS supplies the `--dd-navy` groove
with a `--dd-gold` inset outline. The fill is `var(--dd-gold)` in both.

## Moonfield: `background.webp` (flowered field) with `river-background.webp` as an opt-in layer

| Candidate | Decision |
| --- | --- |
| `background.webp` | **Mounted for journeys.** The luminous flower band across the lower third is a real walkable ground plane, so the courier's path sits *on* something (`ground = 0.68` of scene height) and progress reads as travel. The moon and castle stay in the upper centre, behind the title. |
| `river-background.webp` | Registered as `layers.river`, off by default. Water replaces the flower band; a courier anchored at 0.68 would appear to swim. If a scene opts in, `renderJourney` re-aims the path to 0.78 where the near bank is. It is a *different composition*, not a parallax depth layer, so it is never stacked behind the field image. |

## Parallax hook (documented, not faked)

`ASSETS['environment.<id>'].layers` is the only place extra images may live. `applyScene` mounts a
layer only when the scene IMG declares it: `data-environment-layers="river mist"`. Unlisted layers are
never rendered, so a missed opt-in cannot silently change composition. Real parallax needs genuine
independently painted layers (sky / mid / foreground with alpha); the loader will mount them exactly
as registered and the CSS already stacks `.scene-layer` behind content. A single flat background is
never split, warped or masked into fake depth.

## v2 UI slots actually mounted

`ui.panel`, `ui.primary`, `ui.secondary`, `ui.postcard`, `ui.card`, `ui.slot`, `ui.progress` (existing);
plus `ui.route` (route cards), `ui.input` / `ui.textarea` (letter fields, nine-slice skins over native
controls; textarea falls back to a native border), `ui.divider` (journey HUD rule), `ui.moon` (journey
title mark), `ui.seal` (sealed-letter badge on Write and Choose). `ui.tab` exists for a framed active
surface; `modal-frame`, `notification` and `tab-inactive` have no honest slot and stay documented in
`UNUSED_V2_UI`.

## Remaining visual gaps needing native-HD art

1. Both interiors and both moonfields are resampled from small crops; they are soft at 1440/1920.
2. Momo is pose-reuse frames, not hand-animated; the encounter reaction and coda sleep reads are the
   same four poses retimed.
3. The moonfield has no separated parallax layers, so the journey is a single still painting.
4. Pip's portrait still carries its blue extraction fragment (v1, untouched by instruction).
