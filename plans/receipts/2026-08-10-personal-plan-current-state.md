# Personal Plan current-state reconciliation — 2026-08-10

**Authority date:** 2026-08-10 Europe/Berlin

This receipt records current truth without rewriting the point-in-time plans and
receipts created during implementation.

## Code and deployment

- Current `main` at audit start: `506bd05b84f2eebd5eece3c726a30163a146e3c6`.
- PR #356, the reusable post-payment QA owner, is merged with all required checks
  green.
- `https://chaarlie.de` resolved to ready production deployment
  `dpl_ExYSEdDQ4gcR1MD7a3vDa3Pt8G8U` during this audit.
- The five-stage code path is deployed. Exposure remains a separate rollout
  concern from code presence.

## Production protocol authority

Active application-family protocols:

- Shampoo / `standard_rinse_out_cleanse`;
- Conditioner / `standard_rinse_out_conditioning`;
- Leave-in / `post_wash_booster`.

Eight active day-type definitions exist: Waschtag, Intensiv-Pflegetag,
Bond-Repair-Tag, Klär-Waschtag, Auffrisch-Tag, Pflegetag ohne Wäsche,
Styling-Tag and Pausentag.

## Active recommended catalog coverage

| Category | Products | Products with exact protocol | Current interpretation |
|---|---:|---:|---|
| Shampoo | 49 | 0 | Ordinary path has safe family guidance; eight dandruff products need exact targeted protocols. |
| Conditioner | 43 | 0 | Launch-capable family fallback; integrity preservation only unless a product materially differs. |
| Leave-in | 42 | 0 | Post-wash booster family guidance exists; specialized product behavior still needs exact authority. |
| Heat Protectant | 5 | 5 | Complete current exact cohort. |
| Oil | 41 | 0 | Role-coverage cohort and role-specific protocols required. |
| Mask | 35 | 0 | All 35 need critical timing/sequence protocols under the confirmed Mask gate. |
| Dry Shampoo | 10 | 0 | Canonical spec check plus supported format-family guidance required. |
| Bondbuilder | 4 | 0 | Three primary protocols required; No.0 remains companion-only. |
| Scalp Care | 0 | 0 | Eight reviewed candidate manifests exist but no live launch cohort. |
| Deep Cleansing | 0 | 0 | Five agreed Drogerie candidates still need complete launch manifests. |

The exact frozen product list is in
`data/catalog-enrichment/personal-plan-stage5-v1/current-cohorts.json`.

## Exact research completed in this PR

| Batch | Verified executable rows | Explicitly blocked | Remaining gate |
|---|---:|---:|---|
| Mask | 5 | 30 | Decide the default Mask/Conditioner relationship when the label is silent. |
| Targeted dandruff Shampoo | 7 | 1 | Refresh DERMAXPRO exact directions or keep it unresolved. |
| Bondbuilder | 4 | 0 | Named-batch apply approval only. |
| Oil smallest cohort | 2 role rows / 1 product | 4 sampled products | Verify a genuine pre-wash hair product and coarse leave-on/finish route. |
| Dry Shampoo | 9 | 1 | Refresh got2b Liquid-to-Dry identity/commercial source. |
| Deep Cleansing | 5 protocol templates | 5 intake packages | Complete identity, price, image and guarded new-product packages. |
| Scalp Care | 8 preserved reviewed manifests | 8 missing local assets | Recover/reverify images and construct a new Scalp-only fingerprint. |

The three additive migrations and guarded CLI path pass the production-shaped
local database harness, including exact apply, idempotent replay and role
security. The versioned family-guidance migration also closes the previously
narrow ordinary Shampoo/Conditioner day coverage required by composite routines.
They are not applied to production by this PR. The existing-product
executor cannot create products, change categories, or write on behalf of
browser roles. Production preflight follows migration application; no
production protocol batch has been preflighted or applied here.

## Reconciliation against older plans

- The original five-stage architecture, persistence, QA owner and core Stage 5
  surface are implemented; historical `pending`, `local only`, and
  `NO_ACTIVATION` lines are stale status, not current blockers.
- The old ten-category readiness receipt is stale for Heat: Heat is now live and
  exact. Its warning about incomplete specialized catalog/protocol authority
  remains materially correct for the categories above.
- Draft PR #345 is not safe to apply unchanged. It mixes an already-live Heat
  cohort with Scalp candidates and is based on an obsolete stack. Its reviewed
  Scalp manifests are preserved here as source evidence for a new Scalp-only
  package.
- Earlier concepts such as a standalone progress tracker/calendar, separate
  shopping-list page and Styling category remain outside the signed five-stage
  launch scope rather than regressions in this program.

## Rollout decision

**Broad Stage 5 rollout: NO-GO.**

**Internal/field testing: continue.**

Reasons:

1. Nick's latest walkthrough found bugs that are being handled in another task;
   this receipt does not claim those fixes are deployed or retested.
2. Scalp Care and Deep Cleansing have no live recommended products.
3. Specialized treatment categories still lack the exact protocol authority
   required by their confirmed policies.

The next authorized action from this branch is review and draft-PR publication.
Catalog apply, deployment and exposure changes remain separate approvals.
