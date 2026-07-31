# Hair-Portrait Asset Library — Handoff

Initially reviewed and approved by Nick on 2026-07-22 after the final white product
board and composed dark-background shoulder/transparency board. Nick approved the
uniform length-ladder revision on 2026-07-31. This documents everything an agent needs
to integrate or extend the library.

## Production assets

`public/images/quiz/hair-portrait/*.webp` — 21 files, 720×720, transparent background,
641,352 bytes total (~31KB/file). Naming: `{texture}-{length}.webp` with
`texture ∈ {straight, wavy, curly, coily}`, `length ∈ {very-short, short, medium, long, very-long}`,
plus `generic.webp` (fallback when quiz answers are missing/invalid).

Full-resolution archives are intentionally not in git. Keep their location outside the
repository and pass the relevant portable directory explicitly to generation commands.
The archive contains `finals-transparent/` (1024px processed PNGs) and
`masters-cream-bg/` (pre-processing masters; use these as API references for any
regeneration). The ten pre-cleanup transparent finals are preserved in a dated backup.

## Integration contract

- Most assets are **hair-only**. The component draws ONE standardized neck/shoulder line
  **behind** the hair image (z-order: body SVG, then hair `<img>`). Body spec
  (1024×1024 coordinate space, stroke `#8f84a8`, width 7, round caps):
  ```svg
  <path d="M448 560 C446 610 438 652 424 684"/>
  <path d="M576 560 C578 610 586 652 600 684"/>
  <path d="M424 684 C330 704 240 736 186 780 C160 802 140 836 128 880"/>
  <path d="M600 684 C694 704 784 736 838 780 C864 802 884 836 896 880"/>
  ```
- **Exception — `ownBody: true`** for `straight-very-short`, `wavy-very-short`,
  `curly-very-short`: these very-short cuts include their own drawn head/neck/shoulders
  (short hair exposes the neck). Do NOT render the code body for them.
- The three embedded body lines and the shared SVG use the same `#8f84a8` stroke.
- Display context: white card (`bg-white`), image ~340px wide on mobile. Palette is
  baked (accepted tradeoff): fill `#efe9f7`, shade `#e2d7f0`, ink `#312a4a`.
- Treatment states (perm / chemical straightening): v1 resolves to the treated-lengths
  texture (perm → curly asset, straightened → straight asset). A dedicated
  root/length split batch is explicit follow-up work.

## Quality gates that shipped this library (keep for future changes)

- **Length ladder measurement**: hair-fill endpoint Y on every 720px canvas is
  `416 / 480 / 544 / 608 / 672` for `very-short / short / medium / long / very-long`.
  Allow ±8px per endpoint and ±12px around each 64px adjacent gap. The pinned oracle
  is `measure-hair-fill.mjs`: alpha >200, BT.601 luminance strictly between 0.78 and
  0.985, and at least 18 qualifying pixels in a row.
- **Coily rules** (hard-won): same bumpy-cloud + C-mark texture across all five (never
  vertical ribbed strands), rounded organic outer contours, no parallel vertical walls or
  flat hems, and length grows downward without becoming a rectangular panel.
- Users only ever see ONE image, but returning users may see a neighbor state —
  per-row coherence matters more than pixel-identical style across rows.

## Regeneration pipeline (portable operator tooling)

These scripts are not build tooling. They operate only on an explicit local generation
workspace; do not point them at `public/images/` until a new candidate has passed visual
review. No script reads a key or source image from a machine-specific path.

1. `OPENAI_API_KEY=... node scripts/portrait/gen-batch.mjs <variant|--all> --masters <masters-dir> [--out <candidate-dir>]`
   — gpt-image-1 `images/edits` with `<masters-dir>/{straight,wavy,curly,coily}.png` attached
   as style references. `--env-file <file>` is available only when an operator explicitly
   opts into a local key file. Prompts embed the shared style block; use a flat cream
   background (never request transparency — the model paints fake gray mush instead).
2. `OPENAI_API_KEY=... node scripts/portrait/closed-loop-coily.mjs --work-dir <candidate-work-dir>`
   — roll→measure→accept/retry for coily long/very-long. The work directory must contain
   `out/coily-short.png` and `out/coily-medium.png`; candidates are written under
   `<candidate-work-dir>/candidates/`. `--env-file` and `--max-tries` are optional explicit
   inputs. Adapt acceptance bands only after visual review.
3. Post-processing order per new image: `strip-skin.mjs` (flesh-tone flood removal) →
   `normalize.mjs` (fill-hue lock + stroke unify) → flatten to `#efe9f7` (band L 0.80–0.965,
   preserves texture marks; NEVER use a lower bound of 0.74 — it erases coil marks) →
   `strip-body.mjs` for code-body cells / `recolor-body.mjs` for ownBody cells →
   `process-images.mjs` (edge flood-fill background→alpha; protects the shine crescent).
   These post-processing scripts use the folder-local `out/` and `out-final/` only. Run
   them from a disposable copy of candidates and back up `out/` before destructive passes.
4. Export reviewed candidates as 720px WebP q85 into `public/images/quiz/hair-portrait/`.
5. `node scripts/portrait/measure-bounds.mjs [--assets <directory>]` measures the alpha
   bounds and percentages of the exact 21 runtime WebPs. With no flag it uses the
   repo-relative production asset directory.
6. For a naturally regenerated candidate that is visually approved but misses its
   final endpoint by a small amount, use
   `node scripts/portrait/normalize-hair-endpoint.mjs --input <candidate> --output <final> --target <px> --width <px>`.
   This is an offline asset-finalization step, not a runtime transform. Preserve the
   original cell's measured maximum width, and re-review the complete row afterward;
   never use the utility to rescue a visibly distorted generation.

`regen-round4.mjs` was an unreproducible historical one-off and has intentionally been
removed. Do not restore it; use `gen-batch.mjs` or `closed-loop-coily.mjs` with explicit
inputs instead.

## Known accepted nits

- Minor per-cell hue variance within the lilac family remains; users never see two
  images side by side.

## Final repair record

- Regenerated: `straight-very-short`, `coily-medium`, `coily-long`, and
  `coily-very-long`.
- Removed stray lower alpha/body residue without redrawing the hairstyle:
  `straight-short`, `straight-medium`, `wavy-short`, `wavy-medium`,
  `coily-very-short`, `coily-short`, and `coily-medium`.
- Recoloured the embedded body lines in the three `ownBody` cells to `#8f84a8`.
- Rebuilt the malformed lower body in `wavy-very-short` from the exact shared SVG
  geometry, then retained it as an `ownBody` asset.
- Final automated check: 21 transparent 720×720 WebPs, exactly ten intended runtime
  files changed by the repair pass, and zero alpha below the approved hem in all seven
  cleanup cells.

## 2026-07-31 uniform length-ladder revision

- Regenerated and reviewed 14 out-of-tolerance cells: straight
  `very-short/short/medium/long`; wavy `short/medium/very-long`; curly
  `short/medium/long/very-long`; and coily `short/medium/long`.
- Preserved the six personalized cells already within tolerance: straight `very-long`,
  wavy `very-short/long`, curly `very-short`, and coily `very-short/very-long`.
- Removed the two personal-plan-only `very-long` files and resolver override. Every
  portrait surface now uses `PORTRAIT_ASSET_MANIFEST`.
- Repaired the `coily-short` outer contour after the final product-size review exposed
  dotted resampling artifacts on both sides. The replacement keeps the approved short
  geometry (`64–483px`, max width `445px`) with a continuous antialiased outline.
- Repaired the matching `coily-very-short` outer contour after the overview review exposed
  the same dotted edge failure. Its compact geometry remains `106–416px` with `330px`
  maximum width and a continuous antialiased outline.
- Re-authored `coily-medium`, `coily-long`, and `coily-very-long` together after the final
  overview exposed parallel sides and flat hems. The approved replacements use rounded
  cloud/bell silhouettes, progressively elongated proportions, gentle inward taper, and
  curved scalloped hems. Their measured geometry is `65–543px / 410px`,
  `42–609px / 420px`, and `41–676px / 399px` (top–bottom / maximum width).
- Endpoint and adjacent-gap behavior is enforced by
  `tests/hair-portrait-length-progression.test.ts`.
