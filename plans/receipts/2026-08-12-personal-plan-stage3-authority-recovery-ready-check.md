# Personal Plan Stage 3 authority-projection repair — ready-check receipt

## Identity

- Branch: `codex/personal-plan-stage3-authority-recovery`
- Base: `origin/main` at `6e518751d60c963704e14a480c7ac61be4f1abcb`
- Canonical content fingerprint: `4d2517a5fc56756c88b6409277e0b7f5451096586391e1883b6dab03fe5a39d6`
- Fingerprint scope: approved plan plus five changed source/test files; this receipt is excluded from its own recursive fingerprint.

## Promised outcomes observed

- A valid Stage 3 draft containing the production-shaped four-category base plus a derived `deep_cleansing_shampoo` overlay is authorized for Stage 3.
- A product-load resolution that upgrades an already-present base category retains the canonical base order and is authorized rather than falsely rejected.
- Changing the saved Leave-in frequency without refreshing the overlay remains fail-closed at Stage 2.
- A production-shaped Supabase draft row preserves `productLoadResolution`, `products`, and `roleAssignments` through the real read projection and shared authority validator.
- The authority validator now accepts a compiler-enforced seven-field draft subset; the unsafe `as never` bridge is removed.
- Existing current-refined-source, snapshot, overlay, authority-version, and revision-conflict protections remain unchanged.
- No database query count, persisted row shape, API response, UI, copy, migration, or production data changed.

## Test-first proof

- Before implementation: `tests/personal-plan-journey-access-loader.test.ts` — 21 passed, 1 failed. The valid overlay incorrectly produced frontier `stage2`; the semantically stale overlay control passed and remained denied.
- After the projection fix: the same file — 22/22 passed.
- Counterpart review identified a valid overlapping base/overlay category shape. A second regression failed before the ordering correction (22 passed, 1 failed), then the final focused file passed 23/23.

## Verification

- Focused journey, authority state-machine, and production persistence command — 85/85 passed.
- `npm run test:personal-plan` — 1,191/1,191 passed.
- `npm run bench:personal-plan-transitions` — passed; request-count contracts unchanged.
- `npm run ci:verify` — typecheck passed, lint passed with four pre-existing warnings outside this diff, production build passed.
- `npm run test:playwright:personal-plan-stage1-5` — 2/2 passed against isolated local Supabase plus a Next production build; Stage 3 warm p75 251 ms, p95 252 ms, one client read per navigation.
- `npm run test:playwright:personal-plan-stage3` — 15/15 passed.
- `git diff --check` — passed.

## Artifact disposition and residual risk

- Commit: approved plan, implementation, regression test, and readiness/review receipts.
- Discarded: superseded saved-state recovery mockup and transient counterpart-review output.
- Skipped: database pgTAP because there is no SQL, RPC, migration, persisted-shape, or database-contract change.
- Not authorized/run: commit, push, PR, deploy, production write, or authenticated production replay.
- Residual release risk: local proof exercises the real mapping and a production-shaped journey, but the production deployment remains unchanged until separately published and deployed.
