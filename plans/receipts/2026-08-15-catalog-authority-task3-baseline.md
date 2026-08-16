# Catalogue authority Task 3 baseline

Status: implementation in progress. The approved 19-product lifecycle repair was applied transactionally to production; no product facts, protocols, provenance, structural Task 3 migration, or constraint validation has been applied.

## Activation receipt

- `PERSONAL_PLAN_STAGE3_COMPLETE_CATALOG=true` in the Vercel production environment.
- Production deployment `dpl_FDHHkJZks35JWQAUarFuBwstacnd` is Ready and aliases `chaarlie.de`.
- Deployed Git commit: `fc3cee0c87677aba932bfc5b8b6365a74b358ba3`.
- The exhaustive Stage 3 coverage audit passed all 21 category/role targets with no failures.
- Vercel reported no runtime-error clusters in the activation window.

## Audit-oracle corrections

The initial live Task 3 data-only audit reported 701 issues. Two audit assumptions were false:

1. The reader fetched `product_thickness_eligibility` but derived canonical thickness only from Shampoo facts. Conditioner, Leave-in, Oil, Mask, Bondbuilder, and Deep Cleansing were therefore reported as empty even when normalized rows existed.
2. It treated every legacy Leave-in fit row and every retained `replaced_by` tombstone as duplicate authority debt. Live comparison showed zero Leave-in weight mismatches and zero conditioner-relationship mismatches; the two `care_benefits` columns use intentionally different vocabularies.

Before the approved lifecycle repair, the corrected audit reported 321 overlapping issues and made 19 contradictory lifecycle flags explicit instead of hiding them inside downstream completeness failures. The exact repair cleared those flags, set the already-discontinued OLAPLEX row inactive, marked six reviewed duplicates discontinued, and added six `replaced_by` edges. A retired OLAPLEX No.0 protocol intentionally has no V2 runtime pointer and no longer counts as a published-protocol defect. The post-repair production audit reports 236 issues:

| Issue                                     | Count |
| ----------------------------------------- | ----: |
| Missing provenance                        |   117 |
| Publication incomplete                    |   117 |
| Legacy thickness divergence               |     1 |
| Schema receipt omitted from data-only run |     1 |

Counts overlap by product and must not be summed as unique product counts.

## OGX reproduction finding

The screenshot product ID `f41badc9-16e3-41c1-ab6c-23541fffade0` is a discontinued user-submitted duplicate. Production already contains an explicit `replaced_by` edge to canonical product `2ecd3c9d-90f6-45a3-a72c-daefed50be10`. A fresh privacy-safe preflight found no remaining identifiers, owner links, approved submissions, or active Stage 3 draft references on the duplicate.

The canonical product has the verified facts used by Stage 3:

- thickness: `normal`
- Shampoo bucket: `normal`
- scalp route: `balanced`
- cleansing intensity: `gentle`
- exact role: `shampoo_everyday`

Manufacturer evidence: `https://www.ogxbeauty.com/products/renewing-argan-oil-of-morocco-hair-restoring-strengthening-shampoo`. The current page identifies the product for medium hair and describes dry/damaged hair claims; it does not establish a dry-scalp claim. No OGX production repair is required.

## Implemented Task 3 guardrails

- Repair manifests are fingerprint-bound to exact current and intended authority bundles.
- Draft, stale, duplicate-product, missing-current-state, and category-conflict manifests fail closed.
- A Task 3 structural migration adds the four demonstrated contextual-FK indexes and derives canonical Leave-in conditioner relationship from canonical `roles`.
- The migration deliberately does not validate Task 2 historical constraints or apply product facts while the live evidence audit remains unclean.

## Remaining evidence work

The lifecycle slice is complete. The user-facing complete-category loader already excluded all 19 source rows, so the repair aligned stored publication intent without removing a selectable recommendation candidate. The remaining real debt requires product-specific review packages rather than defaults:

- one active Oil compatibility divergence;
- 117 active/recommended catalogue products without a complete fact-evidence fingerprint.

Every product repair remains a separate, reviewable manifest. Conflicting identity or evidence stops the slice; it is not resolved by last-write-wins or category defaults.

Post-repair production coverage remained green for all 21 category/role targets. Every target returned at least one verified alternative (one to three depending on the target), with no coverage failures.
