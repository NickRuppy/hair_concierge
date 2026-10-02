# Bondbuilder storage contract proposal

Date: 2026-10-02. **Direction approved by Nick; not an implemented schema or insert-ready payload.**

This specifies the direction in the [integration handoff](validation-integration-handoff-2026-10-01.md). The [implementation plan](implementation-plan-2026-10-02.md) owns execution order and gates. No migration, database write, recommendation promotion or engine activation is authorized by this file.

Approval: Nick's “yess but check pls also the adapters…” confirms this additive approach and requires retention of every researched property, with an adapter for narrower usable fields. The [adapter grounding](adapter-grounding-2026-10-02.md) records the checked Leave-in/Conditioner/Shampoo precedent and exact completeness requirement. Implementation approval is not live-action approval.

## Chosen shape

Extend `product_bondbuilder_specs`; do not create another product catalogue. Add four nullable columns with no automatic backfill/default:

| Column | Type / allowed values | Purpose |
| --- | --- | --- |
| `technology_family` | text: `sulfur_targeting_dimaleate`, `designed_peptide`, `maleate_ester`, `acid_calcium_management`, `gluconamide_gluconate` | Recognized researched approach; not the old repair axis. |
| `claim_trust_level` | text: `high`, `medium`, `low` | Nick's exact reviewed rating or the new-submission low default. |
| `trust_basis` | text: `owner_anchor`, `owner_calibration`, `owner_default` | Makes the provenance of the rating explicit. |
| `research_profile` | strict JSONB, version `bondbuilder-research-profile-v1` | Source/version binding, application facts, evidence, comparison, fit and explicit unknowns. |

Null new columns mean no compatible new assessment, not low trust. Only a resolved `in_scope` assessment may become a Bondbuilder spec row. Exclusions, unresolved identity and unfamiliar technology remain research artifacts/holds, not final Bondbuilder facts. All four new columns must be present together for a new-contract row. A malformed non-null profile fails; it never falls back to a legacy interpretation.

The compact Lab/database comparison remains five properties, without duplicating timing into a prose database column. This is not a new customer-facing badge, comparison column or Routine Plan layout:

| Reviewed property | Stored owner / query path |
| --- | --- |
| Trust | `claim_trust_level`, with `trust_basis` |
| Technology | `technology_family`, with `research_profile.technology_reference` |
| Routine placement | `research_profile.application.placement`; existing `application_mode` only where the mapping is truthful |
| Applied format | `research_profile.application.applied_format`; existing `product_format` where compatible |
| Contact / wait time | `research_profile.application.timing`; executable projection in the exact product protocol |

Keys/enums, canonical research explanations and numeric units are English. Customer explanations have an explicitly named German copy block; they are not mixed into enum values. Existing German customer surfaces remain unchanged.

## Strict product-level profile

The future schema in `src/lib/bondbuilder-research/contracts.ts` rejects unknown keys at every object boundary. The profile retains **all product-level researched properties**, not only the smaller usable projection or five compact comparison fields. Every field in the current method's property/application set has a typed destination, preserving its confidence, rationale, source scope, limitations, uncertainty and candidate-to-final reasoning. Full original research, search receipts and lane outputs remain immutable artifacts; the complete product-level profile is not a substitute for those raw artifacts. An unsupported current DB enum or protocol never removes its underlying research fact from the profile.

| Root key | Required contents and validation |
| --- | --- |
| `version` | Literal `bondbuilder-research-profile-v1`. Storage version is separate from the research method version. |
| `method` | Method ID/version, SHA-256 of standard, runbook, prompt, blind guide and reference registry; immutable run/artifact reference and output digest. Validate against the adapter's approved pins, not a model-supplied allowlist. |
| `identity` | Stable research key, exact product name, brand, market, selected source-version/size, nullable GTIN and resolved identity status. Bind a persisted profile to its actual `product_id` at publication; bind intake envelopes to the real submission ID. No invented GTIN or supplied-pack verification. |
| `formula` | Complete raw INCI, ordered normalized ingredients, raw and normalized SHA-256, selected source IDs, retained conflict references and literal candidate marker observations/trace. Recompute integrity; never splice variants. |
| `assessment` | `boundary_status=in_scope`, technology, trust and basis matching the three scalar columns; record and per-property classification confidence, limiting factors, rationale/assumptions and exact owner-decision or default-policy reference. Reasoning keys are closed to the versioned property set. Grade provenance is not scientific certainty. |
| `technology_reference` | The comparison contract below; no efficacy/rating inheritance. |
| `application` | The typed source-backed facts below, with selected direction source IDs and source-market applicability. |
| `evidence` | Bounded English benefit/summary/detail; separate scientific and practical supporting/counter-source ID arrays and limitations. Product, technology, system, predecessor and practice attribution stay distinct. |
| `explanations_de` | `concise` and `deeper`: bounded approved German explanations for existing chat, not commands or a guarantee of efficacy. |
| `sources` | Unique ID, original URL, checked date, authority/type, scope, inspected access level, author/affiliation/commercial context where known, and limitations. Every factual reference must resolve within this registry. An uninspected creator lead is not an opinion. |
| `fit` | Independent `fine`, `normal`, `coarse` values: source-supported compatibility true/false, or null with reasons when unestablished; evidence and confidence retained separately. Existing approved eligibility is preserved by the write contract, not recreated from these nulls. |
| `holds` | Separate identity/boundary/claim-trust/protocol/fit reasons, including structured reasons for null application facts. A hold on one fact does not erase other established facts. |
| `review` | Checked/reviewed dates, exact reviewed profile digest, and internal decision references. Owner review authority comes from trusted review metadata/registry, never an LLM's `reviewed=true` claim. |

Bounds: complete raw INCI <=32,000 characters; <=300 normalized ingredients, each <=200 characters; <=100 sources; source-ID arrays <=30 distinct entries; source notes/limitations <=1,000 characters each; summary <=1,000, detail <=6,000; German concise <=1,000, deeper <=6,000; <=30 hold reasons per group and <=30 application steps. Identifiers/keys <=200, URLs <=2,048, SHA-256 lowercase 64 hex characters; dates/timestamps parsed. Also cap the UTF-8 serialized profile at 256 KiB. Refuse oversized records with a visible reason rather than truncating evidence silently. These are routine serialization limits, not product ratings.

Database validation must enforce the version, allowed keys/types/bounds, scalar equality, source-reference closure and applicability-critical invariants too. Application/API validation is not the only guard on an admin or SQL write. Reuse existing privileges/RLS; no new client write grant or security-definer permission workaround. [Supabase's grants/RLS contract](https://supabase.com/docs/guides/database/postgres/row-level-security) remains applicable; inspect actual privileges before deployment rather than infer them from column additions.

Formula normalization reuses the established complete ordered-list hashing contract, including a comma between digits inside `1,2-Hexanediol` rather than as a separator. Pin the normalization version and recompute raw/list digests. A normalization mismatch refuses projection rather than silently replacing a frozen list.

The adapter emits an exhaustive property coverage receipt with profile destination and usable status (`direct`, `mapped`, `retained_only`, `held`). This receipt stays with the reviewed projection artifact. `retained_only` is not deletion: the full fact remains in the persisted profile. Missing typed coverage refuses projection. Worker allowlists, every writer and catalogue readback must retain the complete profile, including facts unsupported by today's executable protocol. Never reconstruct or overwrite that profile from the reduced projection.

## Application facts, not long frequency strings

| Field | Closed representation / meaning |
| --- | --- |
| `placement` | `pre_shampoo`, `post_shampoo`, `between_washes`, or null. An unsupported/ambiguous placement remains null; bedtime is separate, not inferred post-wash placement. |
| `applied_format` | `cream`, `gel_cream`, `liquid_spray`, `serum`, or null; record prepared application format, not merely the product's marketing role. Unknown physical texture stays null. |
| `treatment_role` | `pre_shampoo_treatment`, `leave_in_treatment`, or null; a leave-in mask label can be known while physical texture remains unestablished. |
| `hair_state`, `state_modifiers` | Sourced wet/damp/dry/either/pre-wash-dry state; modifiers such as thoroughly towel-dried/unwashed. No conversion from ingredients. |
| `application_area`, `distribution` | Sourced area and bounded distribution facts; null when unstated. Do not turn full saturation into a guessed scalp instruction. |
| `timing` | Null, or kind `exact_seconds`, `range_seconds`, `minimum_seconds`, `overnight`, `no_extra_wait`. Numeric keys are `seconds`, `minimum_seconds`, `maximum_seconds` as appropriate, integer and nonnegative; ranges are ordered. Each fact has purpose `contact`, `wait_before_next_step`, or `working_time`. Working the product through hair is not an additional dwell. |
| `longer_wear` | Source-backed overnight permission and nullable maximum. A minimum ten minutes has no invented maximum or fixed ten-minute-only instruction. |
| `amount` | Null, qualitative coverage, numeric amount with source unit, or starting dose plus `add_as_needed`. K18's one starting pump is not a fixed 1–3-pump maximum. |
| `dilution` | Nullable source-backed concentrate quantity, finished volume, intended container and method. epres: one vial to 150 ml finished mixture, not 150 ml water plus concentrate. |
| `conditioner` | Separate before permission, after requirement/recommendation/optionalness, minimum wait and source references; distinct Chaarlie guidance reference where Nick's choice supplements the producer. |
| `sequence` | Ordered typed actions with source IDs, optionalness and timing references; retain shampoo-before-rinse versus rinse-before-shampoo. Not arbitrary executable instructions. |
| `rinse` | Treatment rinse mode plus standalone-treatment-rinse fact; a later conditioner rinse does not become a separate K18 rinse. |
| `cadence` | Status `source_stated`, `source_stated_conditional`, `not_stated`, or `conflicting`; nullable initial/maintenance clauses, conditional branches and source IDs. Clause types: consecutive washes, every-N-washes range, times-per-week range. Preserve Aveda's overlapping branches and Curlsmith's porosity branches, without choosing a universal schedule. |
| `partners` | Source-backed required/recommended/optional companions. Brand recommendation is not proven exclusivity. |

Every non-null fact is source-backed; null reasons and cross-market complements are explicit. Contact/wait seconds <=604,800 is a parser bound, never a recommendation to wear a product that long. Unstated local cadence stays null. Rich research cadence is not automatically a valid runtime cadence: the protocol adapter returns a typed compatibility hold when it cannot represent it truthfully.

## Existing technology references

Use a small version/hash-pinned reference registry, not a tier lookup table. Initial representatives are existing reviewed research targets; catalogue IDs remain null until exact reconciliation. These references identify a comparable approach, not identical concentration, formulation or effect.

| Family | Representative reviewed research key |
| --- | --- |
| `sulfur_targeting_dimaleate` | P01 — OLAPLEX No.3PLUS |
| `designed_peptide` | P02 — K18 mask |
| `maleate_ester` | P03 — epres |
| `acid_calcium_management` | P04 — selected Elvital Plus |
| `gluconamide_gluconate` | P06 — selected OGX serum |

`technology_reference` has `status=matched|no_existing_match|not_assessed`, nullable reference research key/catalogue ID/formula digest, literal shared markers, supporting source IDs and a bounded English limitation. A match requires a compatible finalized family and reference formula/source binding. It never proves a branded supplier, dose or efficacy. `no_existing_match` is explicit rather than forcing an analogy; unrecognized technology still routes to category review.

Curlsmith's reference is OGX. Its low rating remains the owner-default submission policy, not a conclusion that every gluconamide/gluconate product performs poorly. The agreed rough orientation does not make the registry a deterministic high/medium/low map. An OLAPLEX-like clue does not promote an unknown product. Research original exact product practice and evidence fully; only Nick can change the product's rating and separately its recommendation status.

## Illustrative database values

These are **fragments for review**, not complete validated inserts. Actual product IDs, final method pins and profile digests must come from the later reconciled package.

| Value | K18 reviewed source-version | Curlsmith new-submission test |
| --- | --- | --- |
| `technology_family` | `designed_peptide` | `gluconamide_gluconate` |
| `claim_trust_level` | `high` | `low` |
| `trust_basis` | `owner_anchor` | `owner_default` |
| `application_mode` | `post_wash_leave_in` | `pre_shampoo` |
| Existing `product_format` | `leave_in_mask` | null unless separately verified/mappable |
| `treatment_mode` | `leave_in` | `rinse_out` |
| Profile timing | `{kind: exact_seconds, seconds: 240, purpose: wait_before_next_step}` | Three sourced contact branches: 900 / 1200 / 1800 seconds |
| Profile cadence | initial: 4 consecutive washes; maintenance: every fourth wash, DE variant only | Conditional every 4–5 / 3–4 / 2–3 washes, matching the three source porosity branches |
| Technology reference | P02, the reviewed K18 reference | P06, OGX |
| Recommendation flag | Preserve existing state; not written by research | false for a genuinely new submission |

Curlsmith is a validation example, **not a ninth owner-approved enrichment target**. The eight original pilot grades and enrichment scope are unchanged. K18's four-minute optional-after sequence follows [the approved application review](application-review-2026-09-30.md); the Curlsmith values come from the [sealed four-product findings](../../data/research/bondbuilder-inci/v1.0/validation-2026-10-02-v0.4/findings.md).

## Legacy compatibility and write ownership

1. Preserve all six existing field domains and all existing values. For profile-free legacy rows, enforce the original complete six-field contract after removing physical NOT NULL constraints. For valid new-profile rows, legacy intensity/axis and unmappable placement/format/protocol can be null; any supplied legacy value must still belong to its existing domain. Do not fabricate intensity or map gluconamide to disulfide repair. A non-null invalid profile cannot bypass the legacy checks.
2. A research-only update has an explicit owned field set: new research fields, and only separately reviewed exact protocol changes. It must not null old fields by omission or change identity, origin, lifecycle, eligibility, relationships or recommendation flags. Existing SQL currently assigns every legacy field from `EXCLUDED`; conditional nullability alone would turn omissions into data loss. Implement omission-aware ownership, not a blanket `COALESCE` that prevents intentional reviewed corrections.
3. Introduce `verified_product_protocol` as a compatibility selector only when the exact product/role protocol is valid. Keep old named selectors on existing rows unless separately reviewed. The new selector must never fall back to a competitor's named instructions. If protocol projection is unavailable, store the researched application facts with a hold; don't emit this selector as though it were runnable.
4. Derive approval mode from trusted operation context. A narrowly versioned owner-scoped new-intake path may retain unresolved executable protocol/fit, forces non-recommended state, and is not usable by curated publication. It does not loosen other categories or legacy submissions. Exact existing-match linking remains separate.
5. A new-contract curated/promotion path requires owner-reviewed medium/high, verified normalized thickness, executable source-bound exact protocol, valid profile/provenance, and existing lifecycle/image/commercial checks. Nullable obsolete intensity/axis alone must not permanently exclude a reviewed product. Adding old enum values does not allow a low/default new product to bypass this gate.
6. Preserve existing approved rows/flags even when newly researched fit is null. Gate new activation/promotion separately from a profile-only enrichment of an already approved legacy bundle; test a reviewed baseline rather than assuming today's catalogue state. If reconciliation exposes conflicting existing authority, hold only that item for explicit review—do not demote it silently.
7. Use transactional publication/enrichment owners, source/content fingerprints and a reviewed exact preimage. Update the actual effective SQL writer and all supported TS/admin readers/writers together. Database replay must reject wrong identity, digest drift, invented owner promotion, partial writes and lost-response inconsistencies.
8. Expand schema first, deploy compatible readers/writers second, and only then prepare the reviewed eight-product batch. Application rollback retains additive columns/profile data and new nullable rows; do not restore incompatible NOT NULL constraints or run the historical guessed-axis backfill. A destructive schema downgrade is not part of this plan.

Implementation direction approved with the full-property retention clarification above; no new trust/application interview is needed. Method lock, product packages, production migration/apply and intake activation remain separate gates.
