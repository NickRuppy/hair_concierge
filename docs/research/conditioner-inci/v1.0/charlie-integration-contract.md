# Conditioner research integration contract

The locked v1.6 research artifacts remain the full Conditioner authority. New-product Product Intake may now consume that authority through the separately versioned Conditioner Production Adapter v1; the adapter does not change the research classifications or authorize a database write.

## Inputs

- exact catalog product UUID;
- exact-market identity and formula source;
- raw INCI and formula fingerprint;
- locked Conditioner v1.6 standard;
- optional finished-product evidence;
- authoritative application directions for protocol metadata.

## Outputs

- identity/formula status;
- formula observations;
- route candidates and shared mechanisms;
- direct properties with evidence/counter-signals;
- complete nine-property comparison profile with lean behavior, focus, care direction, repair support, and thickness/damage/texture priors;
- exact application, frequency, amount, contact-time, and rinse directions as separate protocol metadata;
- concise `uncertain_fields` and assumption notes;
- optional contextual derived fit remains a later user-profile layer;
- review state and fingerprints.

Field fingerprints are property-scoped and omit the global standard-version salt. The whole-profile fingerprint and stored review metadata remain versioned. The Lab recognizes a legacy salted field hash only when the current field value and complete evidence payload still reproduce it. At v1.6, existing unchanged seven-field approvals survive; the newly introduced `care_direction` and `repair_support_level` fields are unreviewed and must be accepted either individually or through the atomic nine-field whole-product action before the product is considered approved.

## Prohibited dependencies

Current Conditioner weight, repair, balance, thickness/protein-moisture rows and ingredient flags may appear only in comparison output. They are historical comparison data and cannot influence analysis, key, ranking, or tie-breaking. A researched `care_direction` is a product-level formula direction, not a user deficiency; any later conversion into user-balance compatibility is a separately approved production policy.

The research profile is one complete product prior. It is not a direct recommendation, a universal suitability promise, or a finished-product performance test. Historical 16-property agreement and revised full-profile agreement remain separate metrics.

## Publication boundary

For a new Conditioner, Product Intake must retain the complete `conditioner-research-envelope-v1.6` in a `property_synthesis` artifact. `conditioner-production-adapter-v1` may then derive only:

- `suitable_thicknesses` and current Conditioner compatibility rows;
- `weight`, `repair_level`, `balance_direction`, and presence-only `ingredient_flags`;
- the name of the required `conditioner_rinse_out` protocol role.

The adapter does not derive exact application instructions. Manufacturer/source directions remain the authority for protocol values. `conditioning_level`, focus hierarchy, `damage_fit`, and `texture_fit` remain preserved research-only values until a later schema expansion explicitly adopts them.

Adapter output may prefill Product Intake review, but it is not catalog-intake readiness, global-recommendation readiness, or publish approval. Exact identifier collision preflight, image review, protocol review, payload validation, and Nick's explicit final handoff remain required before any Supabase write.

Operational contract: `docs/product-intake-conditioner-production-adapter.md`.
