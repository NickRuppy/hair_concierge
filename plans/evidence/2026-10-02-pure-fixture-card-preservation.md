# Pure-fixture and product-card final preservation review

## Verdict

**No preservation gap found in the applied snapshot.** The one analytics declaration and five Phase-2 fabricated Router declarations are removed; the product-card transfer now observes rendered semantics at the card boundary. This review did not treat the deleted synthetic objects as router coverage.

- `tests/personal-plan-stage3-analytics.test.ts:100` invokes the real `postHogDestination.track`, captures `posthog.capture`, and now includes both `personal_plan_stage3_handoff` values `ready_with_pending` and `ready_with_gap` alongside `ready_for_routine`. The exact captured array asserts the snake-case mapping and the subsequent property-key check retains the privacy exclusion for query/product/image/free_text/criteria/profile. This reaches the actual owner at `src/lib/analytics/destinations/posthog.ts:456`, which maps that typed `AppEventMap` payload to `{ outcome }`; it is stronger than the removed local union array.
- The five deleted Phase-2 tests in `tests/e2e-smoke.spec.ts` instantiated private TypeScript shapes, hard-coded thresholds/slot keys, and calculated their own slot counts without importing a router, classifier, or question-template owner. Their deletion does not remove an executable Router path. The five actual Core Playwright flows remain byte-identical: the exact title census is unchanged at lines 4, 27, 32, 41, and 107, and the applied receipt records 10 → 5 sites.
- `tests/product-card-rendering.test.tsx:64` renders `ProductCard` and checks the complete button `textContent`, including identity, the exact three facts in order (`Leave-in`, `Lotion`, `Hitzeschutz`), the ordinary-space price, and the accessible action. This reaches `ProductCard`'s fact render loop in `src/components/chat/product-card.tsx:51–86`, as well as real fact derivation in `src/components/chat/product-display-model.ts:123–152`; it detects omission, format/heat change, category-first ordering, duplicates, a fourth weight, and an unexpected extra chip. A markup-only inner-span refactor preserving button text does not fail that contract.
- Price checks use `>18,51 €<`, which requires the direct text node and ordinary space. The image-path case changes `currency` to an invalid value and still expects that Euro rendering, exercising the `formatProductPrice` fallback rather than merely matching a fixture default.

## Recorded evidence

- `/tmp/test-audit-pure-fixture-{before,transfer,after}.log` records native 23 before/transfer and 22 after. The Playwright receipts list five pre-cut Phase-2 callback tests as passing; the retained Core list contains only the original five.
- `/tmp/test-audit-card-semantic-mutations/receipt.json` records eleven actual-owner controls: each red run failed the intended assertion, each source hash restored, and each after run passed. Controls include category/format/heat omission, fact reordering/duplication/fourth and unexpected chips, Card render omission, locale and NBSP price output, and invalid-currency fallback.
- `git diff --check` on the three changed tests is clean. The stated before/after C8 result (same 1,909 source paths) and the corrected six-file card run are execution evidence owned by the main session; I did not rerun or independently validate them.

## Limits

Static/receipt review only. It does not establish live PostHog delivery, browser interaction beyond the recorded Playwright runs, router correctness, or global coverage. The card check deliberately specifies user-visible aggregate button text, so it does not preserve private span structure or React keys.

Main receipt correction: analytics native TAP paths are `/tmp/test-audit-pure-analytics-{before,transfer,after}.tap` (23→23→22), rather than the similarly named Playwright/log artifacts. Type controls comprise six total canonical compiler invocations: four green and two intended red. Main independently read both actual TS2322 diagnostics and source restoration receipts.
