# Shampoo Protocol Applicability

## Outcome

Product Intake accepts a Shampoo when every role supported by its reviewed
`product_shampoo_specs` rows has an exact verified application protocol. A
treatment-only anti-dandruff Shampoo is complete with `shampoo_dandruff`; an
ordinary-use Shampoo is complete with `shampoo_everyday`; a product supported
for both jobs requires both.

## Scope

- Make Product Intake derive Shampoo protocol roles from every stored Shampoo
  bucket, matching the Stage 5 catalog-enrichment and catalog-authority audit
  contracts.
- Update the canonical Product Intake runbook and Codex research-worker prompt
  so operators do not manufacture `shampoo_everyday` guidance for a
  `schuppen`-only product.
- Add regression coverage for treatment-only, ordinary-only, and dual-role
  Shampoo payloads.
- Reject extra Shampoo protocols that are not supported by any reviewed bucket.
- Remove the prepared S5-22 batch. All eight current targets are `schuppen`-only
  and therefore cannot reach `shampoo_everyday` under the current selection
  authority. A future dual-use approval must first add independently reviewed
  non-`schuppen` Shampoo facts and then provide both exact protocols.
- Make the guarded Stage 5 protocol preflight reject a Shampoo role that is not
  derived from the product's current canonical Shampoo buckets.

## Operator journey

1. Research records only source-supported `product_shampoo_specs` rows.
2. Every `schuppen` row contributes `shampoo_dandruff`; every canonical
   non-`schuppen` Shampoo bucket contributes `shampoo_everyday`.
3. The intake payload must contain an exact protocol for each derived role.
4. A missing non-applicable role does not block readiness. A missing applicable
   role remains a blocker, and an unsupported extra role is rejected.
5. Scanner barcode ownership, GTIN manifests, recommendation selection, and
   production data remain unchanged.

## Verification

- Red/green Product Intake validation tests covering all three Shampoo shapes.
- Research-worker contract test for fact-derived role instructions.
- Stage 5 preflight regression proving a protocol-only batch cannot attach an
  unsupported Shampoo role.
- `npm run test:node` and `npm run ci:verify`, plus affected focused tests.
- Read-only whole-branch review.

## Boundaries

No database apply, barcode or GTIN mutation, commit, push, PR, merge,
deployment, or production activation is included.

This is a backend/operator-contract change only. It changes no customer-facing
surface, copy, timing, or feedback, so no UI mockup is required.

## Review closure

- Read-only production verification found all eight targeted anti-dandruff rows
  are `schuppen`-only and carry only `shampoo_dandruff`; no unsupported
  `shampoo_everyday` row needs cleanup.
- One separate active curated Shampoo, `Balea 2 in 1 Urea 5%`, has a `trocken`
  bucket but no `shampoo_everyday` protocol. It remains a legitimate
  source-research gap and is not filled by this policy change.
- Whole-diff review found no hard defect. Follow-up hardening made canonical
  Shampoo buckets mandatory in Stage 5 reads, rejected unknown bucket drift,
  and added direct derivation plus missing/invalid-fact coverage.

## Implementation order

1. Add red Product Intake tests in
   `tests/product-intake-review-workflow.test.ts` for ordinary-only,
   treatment-only, dual-role, and unsupported-extra-role payloads.
2. Add the shared bucket-to-role derivation and use it from
   `src/lib/product-intake/category-validators.ts`,
   `src/lib/product-intake/catalog-enrichment/stage5-protocols.ts`, and
   `src/lib/catalog-authority/audit-reader.ts`.
3. Update `scripts/product-intake/codex-research-worker.ts` and
   `docs/product-intake-research-ops.md` to describe the same fact-derived rule.
4. Add the Stage 5 role/fact preflight invariant and its test.
5. Remove every S5-22-only artifact and generator exception.
6. Run focused tests, `npm run test:node`, `npm run ci:verify`, ready-check, and
   the read-only whole-branch review.
