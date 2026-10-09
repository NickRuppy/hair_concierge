# Final-image handoff preservation review

## Verdict

**No preservation gap found for the two applied removals.** The deleted cockpit-only handoff module had no remaining executable, dynamic-import, barrel, CLI, or operator caller in the current scoped search. Its image upload, SHA verification, payload rewriting, category-spec hoisting, identifier normalization, and review mutation were unreachable support logic; deleting it leaves the live review/approval route and CLI boundaries intact.

## Evidence

- The current diff deletes only `apps/product-intake-review/app/api/submissions/[submissionId]/publish/final-image-handoff.ts` and two tests from `tests/product-intake-research-jobs.test.ts`. A scoped `rg` for the module path and its exported symbols returns no live source caller.
- HEAD's deleted module contained the unreachable side-effect implementation: `uploadFinalizedReviewImage` did local-file reads and storage download/upload/verification; `buildResearchedPayloadWithFinalImage` mutated approval payload/review/image/spec shapes. No retained route invokes either function.
- The retained publish/preflight architecture remains fail-closed: the research-jobs suite continues to assert the publish route leaves final writes to the CLI handoff, while `scripts/product-intake/approve-ready.ts:30-34` calls `validateSubmissionReady` and rejects `missingFields`. `src/lib/product-intake/expansion-apply.ts:512-517` separately applies the live approval validator before publication.
- The transferred malformed fixture calls the actual `validateProductIntakeApprovalPayload`, not a copied adapter. At `tests/product-intake-research-jobs.test.ts:715-781`, shampoo spec row `scalp_route: null` yields exactly `final.category_specs.product_shampoo_specs.0.scalp_route`. The live schema requires a scalp route and validates its bucket compatibility at `src/lib/product-intake/category-validators.ts:494-507`, with the shampoo approval path beginning at :845.
- Mutation receipt `/tmp/test-audit-next-owner-layers-mutations/receipt.json` contains 39 completed controls. Its final `retained-shampoo-null-route-coerced-to-dry` control changed the source behavior so the exact diagnostic advanced to `final.category_specs.product_application_protocols`; the retained direct-validator assertion went red, then source hash `e01c…b695d` was restored and the after control passed.
- Recorded focused receipts: before 62/62 pass, transfer 62/62 pass, after 60/60 pass. These are inspected evidence, not reruns by this review.

## Limits

This is static/captured-test evidence only. It does not perform Supabase storage, CLI publication, a native browser interaction, or a live worker operation. It establishes caller closure within checked-in source and preservation of the validator diagnostic, not live operational readiness.

