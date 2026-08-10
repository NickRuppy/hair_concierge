# Personal Plan Stage 5 catalog and protocol program

This directory is the current, sanitized authority for the remaining Stage 5
catalog/protocol work. It does not publish products, upload assets, apply
migrations, or change feature exposure.

## Files

- `current-cohorts.json` freezes the active, recommended production cohort read
  on 2026-08-10. Product IDs and names are catalog identities, not user data.
- `batch-registry.json` converts the category decisions into bounded batches and
  records which paths may use an application-family fallback versus which need
  exact product protocols.
- `protocol-research.schema.json` and `protocol-research/*.json` preserve exact
  product evidence separately from executable canonical guidance. Verified rows
  can enter the guarded existing-product protocol batch; blocked rows cannot.
- `deep-cleansing-candidates.json` records five verified protocol templates for
  products that do not exist in the catalog yet. It deliberately stops before
  identity, price, image and insertion readiness.
- `scalp-candidates/` preserves the eight previously reviewed Scalp Care
  manifests from draft PR #345. They are preparation evidence, not live rows;
  commercial state, identities, assets and fingerprints must be refreshed
  before a Scalp-only guarded apply is proposed.
- `scalp-refresh.json` records the current refresh result: seven directly
  reachable pages, one anti-bot response, and zero of the eight reviewed image
  assets present in this worktree.

## Important distinction

Zero exact product protocols does not automatically mean a category is unusable.
Production already has conservative application-family protocols for ordinary
Shampoo, Conditioner and Leave-in. Conditioner explicitly permits this fallback;
ordinary Shampoo does too. Exact protocols remain mandatory when directions
materially affect safety, sequence, timing, compatibility, or treatment cadence.

Heat Protection is already exact for all five active recommended products.
Scalp Care and Deep Cleansing currently have no active recommended products.
The remaining priority-one batches therefore focus on specialized protocol gaps
and missing launch cohorts rather than re-researching the complete catalog.

## Current research result

- Mask: 5 of 35 exact protocols are executable. Thirty labels omit or do not
  resolve the Conditioner relationship; a shared fallback decision is required.
- Targeted dandruff Shampoo: 7 of 8 exact protocols are executable. The current
  DERMAXPRO page does not expose a product-specific application direction.
- Bondbuilder: all four reviewed primary/companion protocols are executable.
- Oil: OLAPLEX No.7 provides verified damp and dry routes. The sampled live
  pre-wash cohort consists of products whose exact sales pages do not authorize
  a hair pre-wash protocol, so the existing eligibility rows are not treated as
  exact guidance.
- Dry Shampoo: 9 of 10 exact protocols are executable; the got2b
  Liquid-to-Dry identity/commercial route needs refresh.
- Deep Cleansing: all five application templates are researched; complete
  Product Intake packages remain outstanding.
- Scalp Care: all eight reviewed payloads remain preserved; the reviewed image
  assets must be recovered and reverified before a Scalp-only batch can apply.

## Apply boundary

Each batch must follow `docs/product-intake-research-ops.md`. Research, manifests,
dry-run preflight and review may be prepared in code. A catalog apply, asset
upload, migration, deploy, or rollout change requires its own explicit approval.

For existing products, the dry-run entry point is:

```bash
npm run products:intake:stage5-protocol:preflight -- --batch S5-03-targeted-dandruff-shampoo
```

The apply command additionally requires the exact reviewed commit and batch
fingerprint plus `--apply --confirm`. Do not run it without Nick's approval for
that named batch.
