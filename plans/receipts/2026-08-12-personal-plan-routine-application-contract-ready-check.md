# Personal Plan Routine and Anwendung Contract — Ready Check

**Date:** 2026-08-12
**Branch:** `codex/personal-plan-routine-application-contract`
**Base:** `origin/main` at merged Routine PR #378, `19e05f4c6330a7e805db26e028830dc2d664a275`
**Scope fingerprint:** `5b8e1a9b9a10dae81ba2cf7cbe704529c5bc5900874229ef47116ad637ccd3bb`
**Fingerprint scope:** 40 modified or untracked task paths relative to the base; receipt files excluded to avoid self-reference.

## Promised outcomes observed

- V2 selects exactly one contract generation for the accepted Routine product pointers and family templates; V1 manufacturer prose is not a V2 fallback.
- Ordinary products render one reviewed shared category/application-family technique. The 273-row pinned artifact contains no ordinary exact visible steps.
- OGX regular shampoo resolves to the canonical scalp-focused shampoo template with no Conditioner or bespoke-product wording.
- Only five reviewed composite workflows may own exact steps. The artifact contains exactly those five workflow identities.
- Typed contact time, amount, heat state, rinse mode, Conditioner policy, cautions, and companion requirements are validated before composition.
- One bad or missing product pointer becomes a bounded unresolved product card. Valid products and unrelated days remain usable, including repeated independent anchor conflicts and unresolved-only days.
- V2 is independently default-off and the additive migration leaves V1 active/readable.
- Production-shaped catalog preflight is read-only and matched 273 product-role rows across 224 products, 23 templates, five exact workflows, 272 composable rows, and one explicit blocker.
- OLAPLEX No.0 remains explicitly blocked until its actual No.3 companion is verified; the implementation does not substitute No.3PLUS.
- The authenticated Stage 1 → Stage 2 → Stage 3 → Routine → Anwendung flow persisted and rendered exact Shampoo and Conditioner products, and Stage 5 navigation did not mutate the accepted Routine pointer.

## Fresh verification

- `npm run test:personal-plan-stage5` — PASS, 186/186 after stacking on the Routine reliability slice.
- `npm run personal-plan:application-audit` — PASS, 273 reviewed rows; 272 composable; one explicit blocker.
- `npm run test:personal-plan` — PASS, 1,254/1,254 after stacking.
- `npm run test:personal-plan-db` — PASS, 18 files and 411 assertions after stacking; both additive migrations applied only to the isolated local database.
- `npm run test:playwright:personal-plan-stage1-5` — PASS, 2/2 persisted browser journeys.
- `npm run test:playwright:personal-plan-stage5` — PASS, 2/2; 320 px, 390 px, and 1440 px evidence captured.
- `npm run ci:verify` — PASS: typecheck, lint with four pre-existing warnings and zero errors, production build.
- `git diff --check` — PASS.
- `npm run bench:personal-plan-transitions -- --iterations=3 --latency-ms=1` — V2 compiler median 31.19 ms over all 273 product-role rows; this is a local compiler regression check, not the release latency proof.
- Live production-shaped V2 preflight — PASS and read-only; no catalog row or migration was written.

## Browser and qualitative evidence

- Mobile overview clearly labels partial days and explains that known steps remain usable.
- The Wash Day detail shows the canonical Shampoo sequence, a usable provisional Conditioner, and an isolated unresolved Leave-in card in correct order.
- Bottom navigation does not cover the final instruction at 390 px.
- Desktop overview preserves hierarchy and keeps partial-state copy readable.
- Simulated-user lens, persona Lea: no blocking clarity, recommendation-fit, trust, or usability finding. The partial-state explanation is calm and honest; `Vorläufig` and `Produkt noch offen` distinguish known technique from missing authority without inventing guidance.

## Artifact disposition

- **Commit with the task:** plan, reviewed instruction evidence, mockup, V2 migration, deterministic V2 artifact, generator/preflight tooling, runtime code, tests, and these receipts.
- **Discard:** Claude's temporary review file and ignored Playwright screenshots after handoff; neither is product authority.
- **Retain outside activation:** V1 data and resolver path for rollback.

## Skipped or blocked release proof

- The approved 30-navigation preview p95 run was not executed because no preview deployment containing this uncommitted tree exists and deployment was not authorized. The updated read-only sampler now defaults to 30 fresh contexts, requires the diagnostic compute marker, aborts writes, and fails above 1.5 s internal-compute p95 or 2 s meaningful-content p95.
- No migration, V2 family row, V2 product payload, deployment, environment flag, or production activation was applied.

## Bottom line

The local tree is review-ready with no blocking correctness finding. Publication remains a separate gate, and V2 activation remains blocked on the guarded data apply plus the exact-preview 30-sample latency receipt.
