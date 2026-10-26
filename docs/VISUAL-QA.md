# Visual reconstruction QA

## Evidence

Baseline reviewed: `ea91d30` on `main`, matching origin/main at work start. Reference: `DreamDelivery_AssetPack_Prototype_v1/DreamDelivery_ArtPack_v0.1/references/master-original.png`.

Run `node tests/reconstruction.cjs`. The committed runner produces `qa/reconstruction/comparison.html`, the master-reference comparison file, 32 PNG screenshots and machine-readable findings in `results.json`. Four viewport sizes: 390×844, 768×1024, 1440×900, 1920×1080. Eight states: Office, Write, Courier, Route, Journey, Encounter, Postcard, Album. Screenshots are review evidence, not production asset exports.

The supplied `DreamDelivery_V2.zip` preview draft arrived during implementation. Its checksummed runtime files are integrated behind `?art=v2`; `node tests/reconstruction.cjs --v2` produces another 32 screenshots in `qa/reconstruction-v2`. `qa/art-comparison.html` displays v1 versus v2 beside the approved master. Both variants passed the same layout/lifecycle checks.

## Findings fixed in this change

| Issue observed in browser | Repair | Evidence |
| --- | --- | --- |
| Oversized/fixed parchment skin did not follow content; SVG image letterboxed inside tall content | Existing SVG becomes nine-slice border decoration; normal-flow HTML controls | Mobile Office/Write/Courier/Postcard screenshots |
| Route labels escaped their tiny decorative card | Content-sized card with nine-slice frame | 390 Route screenshot |
| Portrait frame could obscure courier art | Explicit stacking and semantic card content | Courier screenshots at four widths |
| Courier path used separate CSS timing and did not restart | Integer left/top from the same JourneyClock/state as the bar; no CSS trot | Clock/bar/x-position assertions; repeated deliveries |
| Successful sprite load kept the loading label | Remove label on ready; guard destroyed/stale callbacks | Runner waits for canvas with no status label |
| Repeated Continue accumulated closures/SFX | One handler, one claim/finish commit, state guard | Ten cycles with two clicks each: one letter, one stamp/arrival pair |
| Radio Tab stop followed old focus rather than selected option | Checked option has priority after rendering | Native keyboard Tab/Home/End/Enter scenario |

## Remaining art issues

1. Both v1 and delivered v2 backgrounds remain visibly soft on desktop: v2 itself labels the exports `UPSCALED_PREVIEW_NOT_NATIVE_HD`. Native independent-HD backgrounds are still required.
2. Pip portrait contains a horizontal blue extraction fragment above the head. Kept original artwork; replacement needs cutout QA.
3. Some paths read as aerial travel because the approved prototype environment has no continuous walkable ground plane. Pixel anchor/timing is correct; production scene/route registration remains an art task.
4. Postcard samples include their own frame and small baked text. The new editable HTML letter wraps correctly, but production postcard art should separate illustration from UI/text.
5. Supplied v2 SVG draft skins are integrated under the preview switch; production art approval is pending. Default v1 is retained for rollback. V2's compact track removes the v1 baked-in mid-track badge; corners are preserved through nine-slice decoration.

## Verification result

- Deterministic suites: 44 passed, 0 failed, including actual delivered manifest/variant/rollback tests.
- Legacy real-browser suite: 8 passed, 0 failed; all four configured route durations, ten deliveries, keyboard flow and malformed save recovery.
- Reconstruction runner: 32 screenshots per variant, 64 total; no detected clipped button text, overlapping controls, broken visible image bindings, horizontal overflow or sub-44px controls. Long unbroken message tested on the postcard.
- Missing metadata and atlas: visible text fallback, journey completes. Reduced-motion courier stays centered and uses static sprite frame.
- Antislop contrast plugin: muted text 5.75:1; delivered button hover's lightest checked stop `#6b67a7` with white text 5.09:1. Candidate SVG bright stop initially failed at 4.43:1; dimming was corrected rather than ignoring the failure.

These checks do not establish pixel-equivalence with a concept sheet. Side-by-side review shows v2's field/bridge scene reads more clearly as a courier route, but source softness, pose reuse and Pip's extraction fragment remain. Final fidelity requires native-HD art and human approval. No palette-only fidelity claim is made.

## Antislop delivery gate

- Hard gate PASS: supplied artwork only; real native controls; recorded click/keyboard path; no detected overflow or dead controls; fallback status visible.
- Purpose gate PASS: midnight world, cream parchment, lavender actions come from the approved pack; serif headings support storybook hierarchy; motion is restricted to actual courier progress.
- Liveliness PASS: compact office-side panel, centered selection, open journey and facing-page postcard provide deliberate composition; artwork stays the focal environment.
- Craftsmanship PASS: content-aware panels, consistent control spacing, safe-area scrolling and checked keyboard focus; production art gaps explicitly labeled.
