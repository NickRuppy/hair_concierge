# Generated hair portraits: Chapter 1 integration

## Status

Implemented and verified locally on 2026-07-23 in `codex/quiz-result-guided-story`. Nick approved the cleaned 21-image runtime library on 2026-07-22 after reviewing both the white product board and the final composed dark-background transparency board. The ready check and whole-branch review are complete; no commit, push, merge, or deployment is authorized by this status.

The earlier modular-SVG authoring plan is retired. The implementation uses the approved generated WebPs at `public/images/quiz/hair-portrait/`, with one small shared body SVG composed behind the hair-only assets.

## Outcome

Chapter 1 shows one polished portrait selected from the user's quiz-reported hair length and texture. Perm resolves to curly, chemical straightening resolves to straight, density does not change the illustration, and missing data resolves to the generic portrait. The existing three tappable analysis markers remain intact.

Done when the typed mapping and image renderer replace the procedural strands, preserve the three accessible analysis markers, and pass the automated and responsive browser checks below.

## Scope

In scope:

- commit the approved 21 runtime WebPs and retained portrait tooling;
- implement the texture × length mapping, treatment override, generic fallback, image composition, and existing markers.

Not in scope:

- rebuilding or hardening the complete generation pipeline;
- putting the 30MB full-resolution source archive into the runtime application;
- density-specific images, colour/bleach images, root-versus-treated-length composites, or runtime AI generation;
- changing the analysis copy, priorities, products, tracker, testimonials, pricing, or chapter gating.

## Runtime files versus source archive

The 21 files needed by the application are already in the correct project location:

`public/images/quiz/hair-portrait/*.webp`

Those are the files selected from quiz answers and downloaded by the user's browser. They are currently untracked and must be committed with the implementation. The approved set is 566,642 bytes total (about 27KB per file), and every file is a transparent 720×720 WebP.

The roughly 30MB archive under `/Users/nick/Desktop/chaarlie-portrait-originals/` contains higher-resolution PNG working sources. It is not required at runtime and does not block this work. It can remain outside the repository or be archived later; there is no storage decision Nick needs to make before implementation.

## Approved asset result

- `straight-very-short` and the coily medium/long/very-long sequence were regenerated and approved.
- Detached lower alpha/body residue was removed from `straight-short`, `straight-medium`, `wavy-short`, `wavy-medium`, `coily-very-short`, `coily-short`, and `coily-medium` without changing the approved hairstyles.
- The embedded shoulder lines in `straight-very-short`, `wavy-very-short`, and `curly-very-short` were normalized to `#8f84a8`.
- `wavy-very-short`'s malformed generated collar/body was removed and replaced with the exact shared body geometry behind the retained hair/head artwork.
- The other cells were retained unchanged.
- Automated asset checks confirmed 21 files, transparent 720×720 WebP output, exactly ten intended changed runtime files, and no remaining alpha below the approved hems in the seven cleanup cells.

## Locked mapping

| Quiz state                          | Portrait asset                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Natural/no shape-changing treatment | `natural texture × length`                                                        |
| Perm                                | `curly × length`                                                                  |
| Chemical straightening              | `straight × length`                                                               |
| Both perm and straightening         | natural texture × length                                                          |
| Density                             | remains required for a personalized config, but does not select or alter an asset |
| Colour or bleach                    | no visual change                                                                  |
| Missing/invalid length or texture   | `generic.webp`                                                                    |

The assistive summary must describe the simplified treated appearance honestly and must not claim that the image shows natural roots plus treated lengths.

## Designed user journey

1. A quiz completer reaches Chapter 1 of the guided-story offer and sees the existing personalized analysis introduction.
2. Before paint, the resolver selects one portrait from the user's normalized length and texture. A perm shows the curly cell at that length, chemical straightening shows the straight cell, conflicting shape treatments fall back to the natural texture, and incomplete axes show the generic portrait.
3. The portrait appears inside the existing white analysis card. Exactly one lilac neck/shoulder treatment is visible: embedded for the three `ownBody` pixies, otherwise the shared code-drawn body behind the hair image.
4. The user can tap each of the three existing marker buttons. The corresponding analysis card changes, the selected state remains visually and programmatically clear, and keyboard focus returns to the selected marker.
5. Density, colour, and bleaching do not silently alter the illustration. Screen-reader copy describes the simplified visible length/texture result without claiming unsupported root-versus-length detail.
6. If the selected image cannot load, the component replaces it with `generic.webp`; the analysis priorities and marker interaction remain available. If the generic image also fails, the hidden text and marker controls still preserve the analysis interaction without a broken-image icon.
7. After reviewing the three analysis priorities, the user continues through the already-approved Chapter 1 handoff to the routine section. No extra click, gate, or journey step is introduced by the portrait change.

## Mockup evidence

- Selected visual direction: generated lilac portrait library with a shared minimalist body line and three existing tappable analysis markers.
- [Approved white product board](../scripts/portrait/review/approved-product-board.webp): confirms the full 21-file library on the actual white product background.
- [Approved composed dark-background board](../scripts/portrait/review/approved-composite-dark-board.webp): confirms transparency and exactly one visible shoulder treatment for every state. It supersedes the earlier raw-hair-only diagnostic board that misleadingly omitted the shared SVG shoulders.
- Feedback incorporated: cleaned detached alpha/body pixels, normalized embedded-body colour, regenerated the rejected straight pixie and coily length sequence, and rebuilt the malformed wavy pixie body.
- Mockup review: confirmed by Nick on 2026-07-22. The surrounding Chapter 1 layout, marker interaction, and guided-story journey were already reviewed and remain unchanged.

## Target map

- `public/images/quiz/hair-portrait/*.webp`: approved 21-file runtime library.
- `scripts/portrait/README.md` and its sibling scripts: retained source/pipeline handoff; make every script repository-relative before committing and add `measure-bounds.mjs` for repeatable marker seeding. None are imported by the application.
- `src/lib/quiz/hair-portrait-assets.ts` (new): exhaustive `Record<texture-length, asset>` manifest, asset URL, `ownBody`, three per-asset 0–100 marker-button anchors, resolver, shared-body view box, and generic fallback.
- `src/components/quiz/hair-portrait.tsx`: replace procedural strand SVGs with the selected WebP and shared body SVG while preserving marker interaction and accessible summaries.
- `src/components/quiz/hair-portrait-art.ts`: delete after the image renderer has no callers.
- `src/lib/quiz/portrait-config.ts`: preserve the current deterministic quiz normalization and `treatedLengthPattern`; remove the now-dead procedural `markerPreset` field/type only.
- `tests/hair-portrait-assets.test.ts` (new), `tests/portrait-config.test.ts`, `tests/hair-portrait.test.tsx`, and `tests/guided-story-analysis.test.tsx`: add manifest/resolver coverage, remove dead marker-preset/procedural assertions, and preserve renderer/integration expectations.
- `src/app/labs/portrait/page.tsx` (new): protected production-renderer gallery for the 20 personalized cells plus generic, reusing the existing lab-access guard and remaining unreachable in production.

## Ordered tasks

### 1. Add the manifest and resolver test-first

- Define every natural `texture × length` cell and `generic.webp` as a same-origin URL using a compile-time exhaustive `Record` plus a runtime file-completeness test.
- Record `ownBody: true` only for `straight-very-short`, `wavy-very-short`, and `curly-very-short`.
- Resolve the personalized asset from `config.treatedLengthPattern × config.length`; do not duplicate the perm, straightening, or conflicting-treatment rules already owned by `derivePortraitConfig`.
- Keep density as the existing personalization gate, while keeping density, colour, and bleaching out of cell selection.
- Keep the shared body path in its documented square 1024×1024 SVG view box; it scales over the same square portrait plane without converting asset pixels or marker percentages.

Complete when new tests cover texture×length filename resolution, exactly 21 files on disk, the three `ownBody` exceptions, and generic `ownBody: false`. Existing treatment/conflict/density-gate tests stay intact rather than being rewritten.

### 2. Author and review the per-asset marker anchors

- Add a portable `scripts/portrait/measure-bounds.mjs` that imports `sharp` by package name, discovers the repository root/current asset directory without absolute worktree paths, and prints the alpha bounding box for each 720×720 WebP.
- Store only three marker-button centers per asset (126 numeric values total) in a 0–100 square plane. Derive the short decorative leader endpoint at runtime as a fixed seven-unit ray from the button toward the portrait centre; do not store a second coordinate pair.
- For the 18 hair-only cells, seed scalp above the horizontal centre/top edge, lengths outside the right edge at 52% of hair height, and ends outside the left edge at 92% of hair height. Clamp button centres to a mobile-safe 18–82 range, then visually tune collisions.
- Do not use the full alpha bounds for the three `ownBody` pixies because they include shoulders. Hand-author their three anchors against the visible hair/head region above the neck join.
- Add `/labs/portrait` behind the existing development/preview-only lab-access guard and render all 20 personalized cells plus generic through the production `HairPortrait` composition with markers.
- Keep this protected gallery permanently as the regression surface for later asset or marker changes.

Complete when every manifest entry has three in-range anchors, the gallery shows no marker/button overlapping a key hair feature or leaving the card, and a 320px viewport has no horizontal overflow. Block the implementation handoff for missing/doubled shoulders, non-monotonic length progression, or unreadable marker placement; accept the already-documented small hue/line-style differences and shoulder-height variance between `ownBody` cells.

### 3. Replace the renderer and its obsolete tests

- Render the selected WebP through `next/image` with `width={720}`, `height={720}`, `alt=""`, `priority`, `unoptimized`, and `className="relative z-10 block h-auto w-full"`. `priority` preloads the single above-fold selection; `unoptimized` serves the approved source pixels unchanged. Do not add an inert `sizes` contract while `unoptimized` disables responsive variants.
- Give the relative wrapper an isolated stacking context and use four explicit layers: body SVG `absolute inset-0 z-0`; responsive image `relative z-10`; decorative leader/dot SVG `absolute inset-0 z-20` with `aria-hidden="true"` and `viewBox="0 0 100 100"`; native marker buttons `absolute z-30`. Render the shared body only when the current asset has `ownBody: false`.
- Preserve the three native marker buttons, `aria-pressed`, focus return, 44px targets, hidden profile summary, and the existing priority-derived marker labels.
- Position overlay leader lines/dots and HTML buttons from the current asset's manifest entry; do not reuse the retired length-only 360×440 presets.
- Update both `getSummary` and `getTreatmentCopy`/`TREATMENT_COPY` inside `hair-portrait.tsx` to describe the actually rendered `treatedLengthPattern` and length, omit density from the visible-art description, and remove claims about separately rendered natural roots and treated lengths.
- Keep the visual image decorative with `alt=""` because the two hidden paragraphs already provide the complete non-visual equivalent; do not double-announce it as an image.
- Handle image failure through both `onError` and a mount-time image-ref check for `complete && naturalWidth === 0`, because a prioritized request can fail before hydration. Switch once to the complete generic manifest entry, re-deriving `ownBody: false` and generic marker anchors without changing the analysis priorities. If generic fails, stop rendering the image/body visual so no broken icon or loop remains, while leaving hidden text and markers usable.
- Preserve the surrounding responsive width, but explicitly accept the square artwork's shorter block relative to the old 360×440 SVG only after 320/375/desktop before/after checks show no harmful fold or spacing regression.
- Remove `markerPreset` from `PortraitConfig` in the same change as the renderer stops consuming it; remove its two assertions from `tests/portrait-config.test.ts` so intermediate commits remain green.
- In `tests/hair-portrait.test.tsx`, remove the obsolete 360×440 view-box, strand-count, density-strand, and procedural stroke-token assertions in this task; replace them with selected source, responsive/decorative image, exact layer order, `ownBody`, marker-overlay, assistive-copy, pre-hydration failure, and terminal fallback contracts. Keep `tests/guided-story-analysis.test.tsx`'s three-marker integration guard.

Complete when the updated test suite is green and all 20 personalized cells plus generic render with one visible shoulder treatment, three unobscured markers/leader lines, honest assistive copy, responsive image sizing, and a one-shot terminal failure fallback.

### 4. Remove the procedural renderer and make the retained tooling portable

- Delete `hair-portrait-art.ts` once no imports remain.
- Replace every absolute worktree, `.env.local`, Claude scratchpad, and image-cache path in `scripts/portrait/*.mjs` with repository-relative paths, package imports, explicit CLI arguments, or `PORTRAIT_WORK_DIR`. Scripts that still cannot run from a fresh checkout are not committed as a supported pipeline.
- Keep generation and cleanup tooling isolated under `scripts/portrait/`; no scripts or full-resolution masters enter the browser bundle. Update the README commands to match the portable interfaces.

Complete when repository search finds no procedural strand imports, dead `markerPreset` field, or machine/session-specific paths under `scripts/portrait/`, and the documented measurement command runs against the committed 21-file library.

## Verification

- exact 21-file manifest completeness plus exhaustive 20-combination, treatment, conflict, density-gate, `ownBody`, marker-metadata, and fallback tests;
- updated portrait and guided-story component tests;
- browser checks for one-shot image failure fallback, marker interaction/focus, single-shoulder composition, and 320/375/desktop layout/fold changes;
- visual gallery review of all 20 personalized cells plus generic on both the white product background and a dark diagnostic background, explicitly checking curly medium versus long differentiation and the accepted shoulder-height variance across the three `ownBody` pixies;
- run browser checks through `localhost` after restarting the development server following `src/lib/quiz/` changes; at 320px assert there is no horizontal overflow, and reproduce selected/generic failure by blocking the request before hydration;
- `npm run test:node`;
- `npm run ci:verify`;
- `git diff --check`.

## Rollout note

PR #238 is this branch and already switches `default_organic` and `meta_routine_v1` to `guided-story`, so merging it exposes this flow to all traffic in those two packages rather than a percentage rollout. The portrait gallery, full guided-story browser review, and whole-branch review therefore gate that PR's merge. A portrait-specific runtime kill-switch and separate rollback unit are intentionally not added: after the procedural renderer is deleted, recovery would require a guarded revert of the complete guided-story PR #238. Nick accepted replacing/deprecating the old experience; this plan makes that coupled rollback explicit. No merge or deployment is authorized by this plan.

## Review and handoff

- Asset inventory, cleanup, regeneration, and metadata verification: complete.
- Final white product-board review: confirmed by Nick on 2026-07-22.
- Final composed dark-background transparency/shoulder review: confirmed by Nick on 2026-07-22 after correcting the first raw-layer-only QA board.
- Existing Chapter 1 composition and marker journey: previously reviewed and unchanged; the approved asset board replaces only the portrait artwork.
- Designed-user-journey sign-off: confirmed; the portrait remains a personalized visual with three tappable analysis markers and does not add a new step or decision.
- Counterpart plan review: complete; accepted findings are reconciled in the ledger below.
- Implementation: complete locally. The generated library now drives the production `HairPortrait`, the obsolete procedural renderer is removed, and `/labs/portrait` permanently covers all 20 personalized states plus generic behind the existing development/Preview guard.
- Responsive browser review: complete at desktop, 375px, and 320px. All marker targets remain inside the card and the page has no horizontal overflow.
- Failure browser review: complete. Blocking only the selected asset produces the generic portrait; blocking selected plus generic suppresses the image/body without a broken icon while preserving all three marker controls.
- Generic-initial failure review: complete. Blocking `generic.webp` before hydration in the generic gallery cell suppresses the image/body without a broken icon while preserving its three marker controls.
- Diagnostic-gallery correction: the dark toggle now removes the inner white product background so transparency and single-shoulder composition can actually be inspected.
- Preview-access review: complete. `/labs/portrait` is allowlisted exactly alongside `/labs/offer-page` in Vercel Preview, remains protected in production, and does not widen access to other `/labs/*` routes.
- Automated verification: 49 focused portrait, guided-story, gallery, config, and route tests passed; the complete Node suite passed 1,730 tests; `npm run ci:verify` passed typecheck, lint with four pre-existing warnings and zero errors, and the 84-page production build; `git diff --check` passed.
- Whole-branch review: complete with no remaining high- or medium-severity findings. The two supported review findings—generic-as-initial-source failure and Preview access consistency—were fixed and reverified.
- Implementation continues only in `/Users/nick/AI_work/hair_conscierge/.worktrees/quiz-result-guided-story` on `codex/quiz-result-guided-story`; preserve the branch's existing guided-story changes.
- Use `implementation-loop`, including its ready check and whole-branch review, before any push. Stop at a local review-ready handoff unless Nick separately authorizes publication.
- Residual visual risk: generated cells retain small hue/line-style differences when viewed as a matrix, although users see only one. The protected production-renderer gallery and responsive browser review are the regression gate.

## Counterpart review ledger

| Finding                                                                                                          | Type     | Decision | Plan change / rationale                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old markers use an incompatible 360×440 coordinate system and length-only presets do not fit the new silhouettes | defect   | accepted | Use per-asset percentage anchors and leader endpoints over the square portrait plane; review all states through the production renderer.                              |
| Treatment mapping would be duplicated in the asset resolver                                                      | defect   | accepted | Resolver consumes `PortraitConfig.treatedLengthPattern`; `portrait-config.ts` remains the single rule owner.                                                          |
| Accessibility-copy target was wrong                                                                              | defect   | accepted | Copy changes are assigned to `hair-portrait.tsx` and describe the rendered treated pattern.                                                                           |
| Image fallback lacked a loop guard and the image mechanism was unspecified                                       | defect   | accepted | Use prioritized, unoptimized `next/image` with a one-shot generic fallback.                                                                                           |
| Density wording could imply it is no longer a personalization gate                                               | defect   | accepted | Missing/invalid density still produces generic, but valid density does not select an asset.                                                                           |
| Review PNGs were ignored by Git                                                                                  | defect   | accepted | Durable approved boards are stored as tracked WebPs under `scripts/portrait/review/`.                                                                                 |
| Existing labs gallery was described as though it already existed                                                 | defect   | accepted | Task now explicitly creates a protected portrait-gallery mode.                                                                                                        |
| Leader lines/dots would sit behind the opaque image                                                              | defect   | accepted | Body stays in a 1024-unit SVG below the image; leader lines/dots use a separate 0–100 SVG above it, with native buttons on top.                                       |
| Responsive image and decorative-alt contracts were underspecified                                                | defect   | accepted | `next/image` now has exact intrinsic dimensions, responsive classes/sizes, `priority`, `unoptimized`, and `alt=""`.                                                   |
| Generic fallback could inherit the failed asset's `ownBody`                                                      | defect   | accepted | Fallback swaps to the full generic manifest entry and terminates cleanly if that asset also fails.                                                                    |
| Marker authoring hid 126 numeric values without a derivation rule                                                | defect   | accepted | Task 2 now specifies measured seeds for hair-only cells, manual pixie anchors, mobile-safe clamping, and gallery-only collision tuning.                               |
| Portrait has no independent rollback unit inside PR #238                                                         | tradeoff | accepted | Rollback is explicitly the whole guided-story PR; no second renderer or kill-switch is introduced.                                                                    |
| `ownBody` alpha bounds include shoulders and corrupt automatic anchors                                           | defect   | accepted | The three pixies receive hand-authored anchors against the hair/head region; only hair-only cells use measured bounds.                                                |
| Body/image/leader stacking could invert                                                                          | defect   | accepted | Task 3 specifies an isolated wrapper and exact z-0/z-10/z-20/z-30 composition.                                                                                        |
| Priority image can fail before React hydrates                                                                    | defect   | accepted | Fallback observes both `onError` and the mounted image's completed-zero-width state.                                                                                  |
| Mobile clamp did not account for translated label width                                                          | defect   | accepted | Seed clamp moves to 18–82 and the 320px gallery/browser gate explicitly rejects horizontal overflow.                                                                  |
| Retained portrait scripts contain worktree/session-specific absolute paths                                       | defect   | accepted | Task 4 makes them portable or excludes unsupported scripts from the committed pipeline.                                                                               |
| Review gallery lifetime                                                                                          | tradeoff | accepted | Keep `/labs/portrait` permanently behind the existing development/preview guard.                                                                                      |
| `unoptimized` disables responsive `sizes`/`srcSet`                                                               | tradeoff | accepted | Keep byte-identical lightweight source WebPs and responsive CSS; remove the inert `sizes` requirement.                                                                |
| Keep the procedural renderer behind a new kill-switch                                                            | tradeoff | rejected | Nick already approved deprecating the old experience; a second renderer adds drift and contradicts the chosen simplification. Recovery remains a reviewed Git revert. |
| `implementation-loop` is unavailable                                                                             | defect   | rejected | It is an available Codex project skill in the implementation environment; Claude's isolated skill inventory is not authoritative for Codex.                           |
| Full-resolution Desktop masters have single-machine backup risk                                                  | tradeoff | deferred | Runtime and implementation do not depend on them. The dated pre-cleanup backup is preserved locally; durable archival is a separate operations decision.              |
