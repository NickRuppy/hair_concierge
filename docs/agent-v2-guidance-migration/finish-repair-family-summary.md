# Finish / Repair Family Summary

## Categories
- `category.oil.v1`
- `category.bondbuilder.v1`

## What Changed
- Oil now separates finish/tips, pre-wash length protection, and cautious scalp comfort, with wash-out technique, weight/buildup caution, product-type separation, and growth/repair guardrails.
- Bondbuilder was aligned to the shared category backbone while preserving the pilot's narrow true-bondbuilder boundaries, lane decision logic, product-example caveat, evidence framing, and safety stop rules.
- Both categories now use the shared contract-safe hook pattern for type-vs-product asks, `product_detail`, routine explanation versus routine mutation, safety `care_category: none`, and product/routine grounding.
- Product-specific oil and bondbuilder claims remain grounded in `select_products` or curated product metadata; named-product detail checks explicitly require product-recommendation guidance.

## Source Treatment
Hair-oiling topic files, bond-builder topic files, damage/repair, chemical/color, dry-length, heat, hair-loss guardrails, sensitive scalp, usage/application, product recommendation, troubleshooting, and comparison playbook guidance were folded into the relevant category and base safety/product packages.

## Review Notes
- Phase 3 content itself is production-close: the remaining failures are runtime/contract threshold issues, not missing oil or bondbuilder behavioral content.
- Keep an eye on oil product-detail turns. Targeted reruns of `Kann ich das Moroccanoil Treatment als Hitzeschutz benutzen?` can load `base.product_recommendation.v1`, call `select_products` with `product_request_kind: product_detail`, and validate cleanly, but the latest full manual regression still recorded one intermittent skipped-`select_products` failure for that case.
- `Kommt Öl vor oder nach Leave-in?` is now confirmed clean in the latest full run as guidance-only routine explanation.
- `Maske oder Öl?` after "keine schwere Routine" is a strategic routine-threshold question: the answer can be valid as category comparison, but the current fixture expects `build_or_fix_routine`.
- The remaining shared-regression failures should feed Phase 4 base package consolidation, especially routine-tool threshold and deterministic product-detail tool use.

## Verification
- `npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-contracts.spec.ts` passed: 101/101.
- `npx tsx scripts/agent-v2/run-guidance-regression.ts` completed and wrote `tmp/agent-v2-guidance-regression-2026-05-21T13-16-15-659Z.md`: 0 pass, 40 review, 6 fail.
- Fresh full regression after final oil hook tightening wrote `tmp/agent-v2-guidance-regression-2026-05-21T14-42-17-669Z.md`: 0 pass, 41 review, 5 fail.
- `git diff --check` passed.
