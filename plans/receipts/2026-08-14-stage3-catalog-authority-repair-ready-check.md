# Stage 3 catalogue authority repair — ready-check receipt

## Identity

- Branch: `codex/stage3-catalog-authority-repair`
- Worktree: `.worktrees/stage3-catalog-authority-repair`
- Base: `0b5945f3`
- Canonical content fingerprint: `4b01055057fb229837371b86bb0b357ba7b01ad1105d1577b74f3f273df94fbd`
- Fingerprint scope: 24 task-owned implementation, test, workflow, plan, and approved mockup files. Receipts and the manifest are excluded from their own recursive fingerprint.
- Manifest: `plans/receipts/2026-08-14-stage3-catalog-authority-repair-manifest.sha256`

## Promised outcomes observed

- Complete mode hydrates every active recommendable product in the requested category before ranking; the three-alternative limit is applied only after authority evaluation and deterministic ranking.
- The rollback flag keeps the legacy 12-row loader and legacy Shampoo route vocabulary unchanged.
- Shampoo need semantics now translate to the stored specification vocabulary before selection and comparison. The everyday table exposes the three signed targets: cleansing intensity, scalp route, and suitable thickness.
- Supportive Shampoo, Mask, adjacent-weight Oil, and add-on Bondbuilder alternatives require an owned-product comparison context and retain exact category, role, product ID, authority rule, and fact fingerprint.
- Mask and Bondbuilder candidates must include the confirmed hair thickness in their verified suitable-thickness set; merely having a non-empty set is no longer accepted.
- A supportive Shampoo remains keepable, and an intensity-adjacent Shampoo may appear as a disclosed fallback; an Oil more than one weight step from target is excluded.
- The approved table remains `Prüfpunkt | Deins | Ziel | Alternative`; the Alternative column disappears only when no verified ideal or authorized supportive product exists.
- The production coverage audit fails closed on empty catalogues, empty alternatives, wrong category/role, zero target coverage, identity mismatch, missing fingerprints, and query errors.

## Verification

- Test-first comparison red proof: four intended failures for complete Shampoo targets and supportive Mask/Oil/Bondbuilder alternatives before implementation.
- Focused authority, comparison, persistence, and audit suites: 227/227 passed before the final supportive-Shampoo delta; final focused Shampoo authority/comparison suite: 137/137 passed.
- Recommendation/chat isolation suite — 164/164 passed; CI scope reports `chat_eval=false`, and the recommendation-engine Shampoo file is byte-identical to `origin/main`.
- `npm run test:personal-plan` — 1575/1575 passed on the final tree.
- Complete-mode Stage 3 Playwright lane — 16/16 passed (3 Labs + 13 production-journey scenarios).
- Flag-off `npm run ci:verify` — typecheck, lint, and production build passed; 127 routes generated.
- Final `npm run typecheck` — passed.
- Final `npm run lint` — zero errors and five unrelated existing warnings.
- `git diff --check` — passed.
- CI orchestration regression — red before the workflow change because the development journey job and aggregate dependency were absent; green 12/12 after splitting production and development browser modes onto separate runners.
- CI contract suite — 29/29 passed across workflow orchestration, job-result aggregation, and path classification.
- Final authority/comparison regression suite — 139/139 passed, including wrong-thickness rejection for Mask and Bondbuilder.
- Production-shaped benchmark — warm p95 200 ms, 57,106-byte response, 45/45 catalogue queries completed.
- Live read-only coverage audit — every supported category/role and five Shampoo contexts passed with at least one verified alternative. Observed candidate counts include Shampoo 49, Conditioner 43, Leave-in 42, Oil 41, Mask 34, and specialist catalogues 3–10.
- Live Shampoo property audit — 57 stored rows: `normal/balanced` 20, `irritationen/irritated` 10, `dehydriert-fettig/oily` 10, `trocken/dry` 8, `schuppen/dandruff` 9; no live `dry_flakes` row exists.

## Artifact disposition and residual risk

- Commit: implementation, tests, approved plan, HTML mockup, rendered PNG, manifest, and receipts.
- The exact-head Claude rerun was unavailable because the reviewer account reached its weekly limit. The prior whole-branch review findings remain resolved; the final CI delta was reviewed locally and is limited to isolating production and development browser modes without weakening the required aggregate.
- No schema migration or catalogue write is required. Production activation remains guarded by `PERSONAL_PLAN_STAGE3_COMPLETE_CATALOG` and must deploy off first, pass the live audit, then deploy on and pass the same audit again.
- The validator permits the secondary `dry_flakes` route for a future dandruff record, while the current complete selection uses the deterministic primary `dandruff` route. There is no live affected record; supporting multiple alternative route rows in the set-based assessment RPC is a separate schema-contract change, not hidden in this release.

## Bottom line

The full-catalogue authority and comparison path is verified and ready for guarded publication and activation.
