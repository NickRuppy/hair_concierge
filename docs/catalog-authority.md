# Catalogue authority

## Contract

Chaarlie has one logical catalogue backed by normalized relational storage. `products` is the identity, category, lifecycle, presentation, and commerce spine. Category fit is not owned by `products`; it is owned by typed category relations and, after the eligibility migration, normalized thickness and concern relations.

All supported runtime readers must ultimately use the versioned catalogue-authority boundary. All supported curated multi-table writers must ultimately use the transactional publication boundary. Direct storage-table access is compatibility debt and must not be added to new code.

The current contract version is `1`. The ten supported product categories are:

- `shampoo`
- `conditioner`
- `leave_in`
- `heat_protectant`
- `oil`
- `mask`
- `scalp_care`
- `dry_shampoo`
- `bondbuilder`
- `deep_cleansing_shampoo`

## Property ownership

| Fact                                                                                                     | Owner                                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| product identity, canonical `category_key`, lifecycle, recommendation visibility, presentation, commerce | `products` and existing identity relations                                                                             |
| thickness eligibility                                                                                    | `product_thickness_eligibility` after migration; legacy array is compatibility-only                                    |
| concern eligibility                                                                                      | `product_concern_eligibility` after migration; legacy array is compatibility-only                                      |
| Shampoo contextual fit                                                                                   | `product_shampoo_specs`                                                                                                |
| Conditioner contextual fit and rerank facts                                                              | `product_conditioner_specs`, `product_conditioner_rerank_specs`                                                        |
| Leave-in characteristics, conditioner relationship, and contextual eligibility                           | `product_leave_in_specs`, `product_leave_in_eligibility`; `conditioner_relationship` is derived from canonical `roles` |
| Heat-protectant facts                                                                                    | `product_heat_protectant_specs`                                                                                        |
| Oil characteristics and contextual eligibility                                                           | `product_oil_specs`, `product_oil_eligibility`                                                                         |
| Mask facts                                                                                               | `product_mask_specs`                                                                                                   |
| Scalp-care facts                                                                                         | `product_scalp_care_specs`                                                                                             |
| Dry-shampoo facts                                                                                        | `product_dry_shampoo_specs`                                                                                            |
| Bondbuilder facts and relationships                                                                      | `product_bondbuilder_specs`, `product_relationships`                                                                   |
| Deep-cleansing facts                                                                                     | `product_deep_cleansing_shampoo_specs`                                                                                 |
| exact-product application and cadence                                                                    | `product_application_protocols`                                                                                        |
| family-level application guidance                                                                        | `application_guidance_protocols` with `scope_kind = 'application_family'`                                              |
| fact provenance and content fingerprints                                                                 | `personal_plan_catalog_fact_evidence` and the applied-item ledger                                                      |

`product_leave_in_fit_specs`, product-scoped `application_guidance_protocols`, `products.category`, `products.suitable_thicknesses`, and `products.suitable_concerns` are legacy compatibility surfaces. They must not become new authorities.

The legacy Leave-in fit table uses an older, narrower `care_benefits` vocabulary. That column is not semantically interchangeable with `product_leave_in_specs.care_benefits`. During compatibility, the audit compares only the genuinely shared semantics (`weight` and the conditioner relationship derived from canonical `roles`) and reports a conflict when those diverge.

## Publication completeness

An active curated product or any explicitly recommended product is publication-gated unless it has a `personal_plan_product_search_dispositions` row. User-submitted, non-recommended products may remain incomplete and owner-scoped while intake is pending.

A publication-complete product has:

1. a supported canonical category;
2. the category's required singleton facts and complete contextual matrix;
3. non-empty thickness eligibility except for Heat Protectant, Dry Shampoo, and Scalp Care, where thickness is not an applicability requirement;
4. every exact product protocol implied by its category facts;
5. protocol payload scope matching indexed product/category values;
6. source text, URL, and matching payload evidence;
7. catalogue fact provenance and a content fingerprint.

Missing or conflicting data fails closed. The audit reports facts; it never repairs, infers, publishes, hides, or recategorizes a product.

A product that is the source of an explicit `product_relationships.relationship_type = 'replaced_by'` edge is a retained identity tombstone, not a second publishable catalogue item. Its category identity and relationship remain auditable, but it does not need duplicate category facts, protocols, or provenance. The canonical target remains subject to the full contract.

This is the target-state contract, not merely a transcription of the legacy publication function. It deliberately tightens Mask completeness with `balance_direction`, Deep Cleansing with scalp/color suitability, Leave-in with its contextual eligibility matrix, and contextual-row uniqueness for Shampoo and Conditioner. Those findings are migration debt until the canonical publication boundary replaces the legacy assertion; they must not be described as violations of the currently deployed gate.

## Read-only audit

Run the data audit against live Supabase:

```bash
npm run catalog:authority:audit -- --pretty --allow-issues
```

The command loads every page of every declared catalogue relation in stable order. Its receipt includes `countsByCategory` and raw `countsByRelation`, so a live run can be reconciled against independent direct counts without exposing product details. It outputs one machine-readable JSON receipt to stdout and a one-line summary to stderr. It exposes no insert, update, upsert, delete, or RPC capability.

For complete schema evidence, run `scripts/catalog-authority/schema-audit.sql` through an authenticated read-only SQL console, save its JSON result, then pass it without modification:

```bash
npm run catalog:authority:audit -- --schema-input /absolute/path/schema-receipt.json --pretty --allow-issues
```

Without `--schema-input`, the receipt deliberately includes `schema_inspection_missing`; a data-only run cannot claim the database constraints are clean. Omit `--allow-issues` in CI or a release gate so any issue produces a non-zero exit.

A sanitized snapshot can be replayed without Supabase credentials:

```bash
npm run catalog:authority:audit -- --input /absolute/path/snapshot.json --pretty
```

## Stable issue codes

The source of truth is `CATALOG_AUTHORITY_AUDIT_ISSUE_CODES` in `src/lib/catalog-authority/contracts.ts`. Codes distinguish invalid origin/category, contradictory recommendation/lifecycle state, wrong-category facts, missing or duplicate specs, incomplete contextual matrices, legacy divergence, missing or mis-scoped exact protocols, overlapping authorities, missing provenance, incomplete publication, orphan rows, and missing/unvalidated schema objects.

After Task 2, the audit reads normalized thickness eligibility directly for every category where thickness applies. Heat Protectant, Dry Shampoo, and Scalp Care deliberately return non-applicable thickness rather than an empty defect. Normalized concern rows remain an expand-phase projection until reviewed repair and the transactional publication boundary make them independent authority, so the audit does not claim legacy concern parity yet. The multi-relation live read proves an exact count for every relation but is not a transactionally consistent database snapshot; rerun a finding before using it in a repair manifest.

Completeness, exact-protocol, and provenance requirements apply only to rows that the publication contract treats as published: an active curated product or any product explicitly marked recommendable, excluding an approved search disposition. Archived, inactive, non-recommendable rows still receive identity, orphan, wrong-category, and compatibility checks, but the audit does not invent missing recommendation facts for products that cannot be selected.

## Historical repair manifests

Every evidence-sensitive historical repair is a category-bounded manifest. Each entry carries the product ID and category, an exact fingerprint of the current authority bundle, the intended canonical bundle, at least one dated source, and the expected new fingerprint. Execution must fail for duplicate products, missing or changed current state, category drift, a changed intended bundle, a stale review fingerprint, or an unapproved manifest.

The manifest guard lives in `src/lib/catalog-authority/repair.ts`. Draft manifests are review artifacts only. They do not authorize a Supabase write, and no repair runner may infer reviewer identity or approval from a general implementation request.

Audit receipts contain product IDs and catalogue metadata only. They must never include quiz answers, user profiles, emails, submission notes, or other user data.
