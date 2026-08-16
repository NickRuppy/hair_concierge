# Personal Plan Mask v4 independent release

Status: **implementation complete; exact-tree release checks and final counterpart review pass**

Release base: current `main@f214e3a050098dd4b1b54cf0d7949e901fa90941` plus the migration-free K18 Stage 1 commit `180fa9ae4bbec111d943c6cb296d8161d2581190`, canonical K18 content fingerprint `b76d19cc3c73054319dbb99f0a12d6a3984742e9f96f685be116a954c2169a45`.

This release must remain independently deployable before Scalp v3. It may change only Mask authority/version behavior, Mask Stage 1 projection, the Mask-compatible active-draft refresh transition, and their verification artifacts. It must accept Scalp Care v2 and the supported dormant Shampoo v3 subset. It must not contain Scalp v3 behavior.

## Confirmed product contract

- Optional Mask: category-owned ideal, then best verified supportive candidate; limitation is disclosed in Stage 3.
- Basis Mask: ideal only. A displayed Basis Mask must have the same source-bound, verified, image-backed product path in Bedarf and Stage 3.
- `recommendation_or_unavailable` is a failure for a reachable Basis target.
- No global fallback, no first-12 catalogue scan, no generic example pool, and no production catalogue writes in this implementation gate.

## Release units

1. **K18 presentation unit** — exact base `f214e3a0`, commit `180fa9ae`, content fingerprint `b76d19cc…`, no migration, no authority-version change, and no Stage 3 selection effect.
2. **Mask v4** — logical base is that exact K18 unit on `f214e3a0`; implements Nick's approved refined ideal-fit policy. Its migration accepts Scalp v2 and proves Mask v3→v4 with both Shampoo v4 and a dormant Shampoo v3 subset.
3. **Scalp v3** — not present in this release. Its separate release must be based on the eventual exact Mask v4 tree identity, preserve Mask v4 and supported dormant subsets, and own only role-specific Scalp complement/suppression behavior.

Separate commits in one simultaneously activated tree do not satisfy these boundaries.

## Basis Mask reachability audit

The previous audit checked one hand-written target and accepted explicit unavailability. The corrected audit now:

- enumerates the complete equivalence partitions consumed by the deterministic Mask need/decision engine;
- deduplicates the resulting target plus hair-thickness authority inputs;
- loads the complete normalized Mask catalogue, not the legacy 12-row preview subset;
- requires an ideal uncovered recommendation, exact recommendation fingerprint, re-evaluation as ideal, and a non-empty image on that same product;
- fails every unavailable result;
- emits exact uncovered matrices and their nearest candidates with failed/unknown/caution criteria.

Read-only live result on 2026-08-15:

- 2,280 distinct reachable display-target/thickness variants;
- 544 have an ideal image-backed path;
- 1,736 fail closed;
- those failures collapse to 79 distinct authority matrices when unused `needStrength`, supporting benefits, and function priorities are removed;
- 34 active, recommendable Mask products were loaded, all with images and populated Mask authority facts;
- the nearest candidates have known evaluations. The gaps are exact weight, care-direction, repair-support, thickness, and/or required-function mismatches, not query admission or a missing image URL.

The exact 79 uncovered matrices and their three nearest candidates are recorded in [`artifacts/2026-08-15-mask-basis-live-coverage.json`](./artifacts/2026-08-15-mask-basis-live-coverage.json), content SHA-256 `97459d6084dd56aa9b1c5ec37723423a230b71f800d6f4ca5c000534f5b52054`.

## Root-cause classification

| Candidate cause | Finding |
|---|---|
| Candidate subset / pagination | Rejected: complete catalogue returned 34 candidates. |
| Category admission | Rejected for these gaps: active recommendable candidates are admitted and evaluated. |
| Missing image | Rejected: all 34 loaded products have images. |
| Unknown normalized facts | Rejected for nearest candidates: evaluations are known; the live spec rows contain weight, balance direction, repair support, functional benefits, and thickness eligibility. |
| Incorrect catalogue facts | Not established. The normalized facts are populated and internally valid; changing their semantics requires product-specific evidence and production-data authorization. |
| Genuinely absent verified product | Confirmed under current catalogue authority for each uncovered matrix: no candidate evaluates ideal. |
| Target generation / fit strictness | Contributing by design: the engine generates exact personalized axes that the current catalogue does not fully span. Forcing those targets onto available products would change the signed-off Basis fit contract. |

## Approved decision and implemented fit boundary

Nick selected **refine ideal fit** rather than production catalogue writes or narrowing category generation. Mask v4 therefore distinguishes hard eligibility from formulation preferences:

- hard and fail-closed: active/recommendable lifecycle, image-backed source identity, exact hair-thickness eligibility, exact role protocol, and every required functional benefit;
- ideal-compatible preferences: exact or adjacent weight, any known care direction, and repair support at the target, above it, or one step below it;
- supportive only: the extreme light↔rich weight gap or repair support two steps below target;
- unknown/mismatch: missing canonical facts, excluded thickness, missing protocol, unsafe lifecycle state, or a missing required function.

Basis remains ideal-only. Optional Mask alone may select the best verified image-backed supportive candidate, and Stage 3 retains the limitation and the leave-open action. No other category inherits this fallback.

After this policy change, the same exhaustive read-only live audit covers **2,280/2,280** reachable Basis Mask target/thickness variants with an ideal, source-bound, image-backed recommendation; uncovered count is zero. The pre-policy 79-matrix evidence remains retained above so the policy decision and its effect stay reviewable.

## Verification receipt

- Regression guard first failed because unavailable Basis Mask was treated as `alternative_empty`; after correction it passes with the two explicit Basis failures.
- Reachability guard passes and proves standard/high strength, all three weights, all three care directions, all three repair levels, smoothing and detangling required functions, and uniqueness of each target/thickness matrix.
- Focused command: `npx tsx --test tests/personal-plan/products/stage3-production-coverage-audit.test.ts` — 5/5 pass.
- Pre-policy read-only live audit: `npx tsx scripts/personal-plan/audit-stage3-production-coverage.ts` — exited 1 with 1,736 uncovered variants and no non-Basis audit failures.
- Post-policy read-only live audit: the same command exits 0 with 2,280 reachable, 2,280 covered, zero uncovered, and no non-Basis failures. Full transient result SHA-256: `f0d8812dfd78aff48598f9c0d2b9159c962f2b23d6ad2d81ca0f51408e893402`.
- Mask v4 refresh tests prove the exact Shampoo v3→v4 and Mask v3→v4 subset while Scalp remains v2; unrecognized version drift and coverage drift fail closed; completed plans remain immutable; existing product assignments and capture state survive an active-draft refresh while product decisions reopen.
- The committed PGlite PostgreSQL/PLpgSQL test executes the actual migration file. Its preceding-runtime case sends the old client's destructive fresh seed shape (empty capture, recomputed pass/cursor, and no load-resolution object) while the database preserves the stored products, roles, and cursor state; its current-runtime case advances Mask to v4. It also proves completed immutability, `revision_conflict`, invalid-source rejection for premature Scalp v3, service-role execution, denial for `anon` and `authenticated`, and Scalp v2 preservation.
- Full Personal Plan suite: `npm run test:personal-plan` — 1,632/1,632 pass on the refreshed stack.
- Nested Personal Plan suite: `npm run test:personal-plan:nested` — 519/519 pass.
- Production build: `npm run build` — pass using the worktree's normal local environment.
- Stage 3 browser gate: 5/5 server-mode lab checks and 19/19 five-stage development-journey checks pass on the refreshed stack.
- Task-owned source lint and `git diff --check` pass. Repository-wide lint remains red only on pre-existing unrelated UI-hook debt.
- Repository-wide `npx tsc --noEmit` passes.
- Claude Opus/high found three hard issues in the refreshed branch: merchandising order was discarded for otherwise tied Mask candidates, repair-support copy misstated stronger-than-required products, and the migration/code handoff was incompatible with the preceding runtime. Its first delta pass confirmed the first two fixes but showed the migration proof still modeled the new client rather than the actual old fresh-seed payload; it also found an unrelated weakened ordered-category fail-closed guard. The migration now handles the old seed server-side without discarding stored capture state, that exact scenario is a committed executable regression, and the guard is restored. The final focused delta re-review returned GO with no hard defects.
- No commit, push, PR, remote migration, deploy, flag activation, or production write occurred.

## Review and handoff

The refreshed ready-check, exact-tree local correctness review, structural review, and release-boundary verification are complete. The separate Scalp v3 release will record the final Mask manifest as its logical base.

The migration is forward-only and must be applied immediately before the Mask v4 code deploy. It remains backward-compatible with the preceding runtime's Shampoo-only refresh while Mask is still v3, closing the migration-first deployment window. Before remote application, rollback is omission of this independent release. After the code deploy, active drafts may have advanced to Mask v4 and must be repaired by a new forward-fix migration/code release; completed plans stay immutable. Scalp v3 is not present in this unit and cannot activate with it.
