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
- `scalp-candidates/` preserves the eight previously reviewed Scalp Care
  manifests from draft PR #345. They are preparation evidence, not live rows;
  commercial state, identities, assets and fingerprints must be refreshed
  before a Scalp-only guarded apply is proposed.

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

## Apply boundary

Each batch must follow `docs/product-intake-research-ops.md`. Research, manifests,
dry-run preflight and review may be prepared in code. A catalog apply, asset
upload, migration, deploy, or rollout change requires its own explicit approval.
