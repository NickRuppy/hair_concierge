# Hair-Portrait Asset Library — Handoff

Reviewed and approved by Nick on 2026-07-22 after the final white product board and
composed dark-background shoulder/transparency board. This documents everything an
agent needs to integrate or extend the library.

## Production assets

`public/images/quiz/hair-portrait/*.webp` — 21 files, 720×720, transparent background,
566,642 bytes total (~27KB/file). Naming: `{texture}-{length}.webp` with
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

- **Length ladder measurement**: hem-bottom Y on the 1024 canvas per column —
  straight/wavy/curly target vs≈590 s≈670 m≈740 l≈830 vl≈940 (±45), coily compressed
  (594/705/817/926/968 as approved). Measure = lowest row with ≥25 hair-fill pixels
  (light cool pixels, alpha>200).
- **Coily rules** (hard-won): same bumpy-cloud + C-mark texture across all five (never
  vertical ribbed strands), constant ~64% max width, length grows downward.
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

`regen-round4.mjs` was an unreproducible historical one-off and has intentionally been
removed. Do not restore it; use `gen-batch.mjs` or `closed-loop-coily.mjs` with explicit
inputs instead.

## Known accepted nits

- `coily-very-long` was widened 15% programmatically (best-of-4 candidates were all too
  narrow); slight top-corner boxiness at full zoom, invisible at product size.
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
