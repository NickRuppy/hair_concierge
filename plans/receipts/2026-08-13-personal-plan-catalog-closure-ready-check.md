# Personal Plan catalog closure — Ready Check

**Date:** 2026-08-13
**Branch:** `codex/personal-plan-catalog-closure`
**Base:** `origin/main` at `d0a4ca8cc2b25c3d0beb1d8456817c613a967fd6`
**Scope fingerprint:** `e8aaaaccaa5104e50f050200f998c237b190b919e7389778a585ee8e668a2598`
**Fingerprint scope:** 42 modified or untracked task paths relative to the local branch head; this self-referential ready-check receipt and the later code-review receipt are excluded.

## Promised outcomes observed

- Product Intake derives and validates one V2 application pointer from the reviewed V1 protocol and typed product facts before the approval transaction.
- Internally curated, owner-only user-submitted, and later user-submitted-to-curated paths retain distinct publication boundaries while requiring complete V2 guidance in the official handoff.
- The regenerated artifact contains 272 product-role pointers across 223 products, 23 canonical family templates, four exact workflows, and zero runtime blockers.
- OLAPLEX No.0 is removed from the generated/runtime contract while its evidence and relationship remain represented for guarded soft retirement. The retirement/enforcement migration is prepared but has not been applied.
- The grouped instruction review exposes each canonical family once and all four exact workflows separately. Nick reviewed and approved the content.
- The approved example Waschtag keeps the general day summary and cadence above canonical category cards and product-independent transitions. A canonical Shampoo preparation now appears once: the compiler suppresses only the redundant generated wetting transition when the product protocol already carries the semantic `wet` preparation. An exact Shampoo workflow without that preparation still receives the compiler fallback.
- The 30-by-2 exact-preview benchmark was run without writes or retained credentials. Its result remains an honest failure against the agreed p95 thresholds and is not reclassified as passing.

## Fresh verification

- Focused red proof: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage5-compiler-v2.test.ts` — expected failure showed both `Haare gründlich mit Wasser anfeuchten.` and `Haare und Kopfhaut vollständig anfeuchten.` for the ordinary OGX day; the exact-workflow fallback test passed.
- Focused green proof: compiler V1/V2 plus view-adapter tests — PASS, 28/28.
- Approved detail-header red/green proof: the focused rendering test first failed because the selected Waschtag omitted `summaryDe`; after the component change, the focused German-copy/compiler/adapter set passed 16/16 with summary and cadence both present.
- `npm run test:personal-plan-stage5` — PASS, 202/202 on the rebased tree.
- `npm run test:personal-plan` — PASS, 1,380/1,380 on the rebased tree.
- `npm run test:node` — PASS, 3,695/3,695 on the rebased tree.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS with zero errors and four pre-existing warnings.
- `npm run build` with the root `.env.local` loaded without printing values — PASS. The first attempt compiled and typechecked but failed at Supabase-backed prerendering because the worktree process lacked those local environment values; this was an environment setup failure, not a product-code failure.
- `git diff --check` — PASS.
- `npm exec -- prettier --check plans/receipts/2026-08-13-stage5-example-day-mockup.html` — PASS.

## Browser and review evidence

- Nick reviewed `plans/receipts/2026-08-13-stage5-instruction-review.html` and approved the grouped canonical/exact instruction content.
- Nick reviewed `plans/receipts/2026-08-13-stage5-example-day-mockup.html` in the in-app browser and explicitly approved the hierarchy: general day summary and cadence, canonical product-category cards, and separate product-independent transitions.
- The prototype-only layer labels and toggle remain review evidence and are not promoted into the production components.

## Artifact disposition

- **Commit with the task after publication approval:** plan, catalog/research inputs, deterministic V2 artifact and builder, Product Intake integration, guarded migration, runtime/compiler changes, tests, grouped instruction review, example-day decision evidence, performance summary, and verification/review receipts.
- **Discard/transient:** Claude's temporary review output and local fingerprint manifests; neither is product authority.
- **Already destroyed:** disposable benchmark identity details, storage state, bypass token, raw per-sample report, and helper scripts.

## Skipped or blocked release proof

- Supabase migration `20260813085151` and the No.0 retirement were not applied; surrounding migrations `20260813060630` and `20260813091352` are applied remotely. Exact production preflight and post-apply readback remain release gates.
- The branch has not been committed, pushed, deployed, or merged.
- The exact-preview benchmark failed: `/anwendung` internal p95 was 2,057.95 ms and meaningful-content p95 was 4,046.28 ms. The remaining tail requires a separate access/data-path performance decision before claiming that SLO.
- The task commit was rebased cleanly onto current `origin/main`; the upstream retained-portfolio Stage 5 route regression remains present and the affected Personal Plan checks were refreshed.

## Bottom line

The local content and compiler behavior are review-ready, with no known correctness blocker in the approved instruction composition. Production activation remains blocked by the unapplied guarded migration and the failed preview latency SLO; publication remains a separate authorization.
