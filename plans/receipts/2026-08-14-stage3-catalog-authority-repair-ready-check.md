# Stage 3 catalogue authority repair — ready-check receipt

## Identity

- Branch: `codex/stage3-catalog-authority-repair`
- Worktree: `.worktrees/stage3-catalog-authority-repair`
- Base: `53c15176`
- Canonical content fingerprint: `f3ebf5d36d0dac6bbb664dd432e0099a4008054990e2a498566e6be37cddbf7a`
- Fingerprint scope: 22 task-owned implementation, test, plan, and approved mockup files. Receipts and the manifest are excluded from their own recursive fingerprint.
- Manifest: `plans/receipts/2026-08-14-stage3-catalog-authority-repair-manifest.sha256`

## Promised outcomes observed

- Complete mode hydrates every active recommendable product in the requested category before ranking; the three-alternative limit is applied only after authority evaluation and deterministic ranking.
- The rollback flag keeps the legacy 12-row loader and legacy Shampoo route vocabulary unchanged.
- Shampoo need semantics now translate to the stored specification vocabulary before selection and comparison. The everyday table exposes the three signed targets: cleansing intensity, scalp route, and suitable thickness.
- Supportive Shampoo, Mask, adjacent-weight Oil, and add-on Bondbuilder alternatives require an owned-product comparison context and retain exact category, role, product ID, authority rule, and fact fingerprint.
- A supportive Shampoo remains keepable, and an intensity-adjacent Shampoo may appear as a disclosed fallback; an Oil more than one weight step from target is excluded.
- The approved table remains `Prüfpunkt | Deins | Ziel | Alternative`; the Alternative column disappears only when no verified ideal or authorized supportive product exists.
- The production coverage audit fails closed on empty catalogues, empty alternatives, wrong category/role, zero target coverage, identity mismatch, missing fingerprints, and query errors.

## Verification

- Test-first comparison red proof: four intended failures for complete Shampoo targets and supportive Mask/Oil/Bondbuilder alternatives before implementation.
- Focused authority, comparison, persistence, and audit suites: 227/227 passed before the final supportive-Shampoo delta; final focused Shampoo authority/comparison suite: 137/137 passed.
- `npm run test:personal-plan` — 1573/1573 passed on the final tree.
- Complete-mode Stage 3 Playwright lane — 16/16 passed (3 Labs + 13 production-journey scenarios).
- Flag-off `npm run ci:verify` — typecheck, lint, and production build passed; 127 routes generated.
- Final `npm run typecheck` — passed.
- Final `npm run lint` — zero errors and five unrelated existing warnings.
- `git diff --check` — passed.
- Production-shaped benchmark — warm p95 202.65 ms, 57,106-byte response, 45/45 catalogue queries completed.
- Live read-only coverage audit — every supported category/role and five Shampoo contexts passed with at least one verified alternative. Observed candidate counts include Shampoo 49, Conditioner 43, Leave-in 42, Oil 41, Mask 34, and specialist catalogues 3–10.
- Live Shampoo property audit — 57 stored rows: `normal/balanced` 20, `irritationen/irritated` 10, `dehydriert-fettig/oily` 10, `trocken/dry` 8, `schuppen/dandruff` 9; no live `dry_flakes` row exists.

## Artifact disposition and residual risk

- Commit: implementation, tests, approved plan, HTML mockup, rendered PNG, manifest, and receipts.
- Transient Claude reports remain outside the repository.
- No schema migration or catalogue write is required. Production activation remains guarded by `PERSONAL_PLAN_STAGE3_COMPLETE_CATALOG` and must deploy off first, pass the live audit, then deploy on and pass the same audit again.
- The validator permits the secondary `dry_flakes` route for a future dandruff record, while the current complete selection uses the deterministic primary `dandruff` route. There is no live affected record; supporting multiple alternative route rows in the set-based assessment RPC is a separate schema-contract change, not hidden in this release.

## Bottom line

The full-catalogue authority and comparison path is verified and ready for guarded publication and activation.
