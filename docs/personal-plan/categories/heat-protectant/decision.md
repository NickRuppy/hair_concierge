---
category: heat_protectant
document_type: decision
status: confirmed
decision_version: 1
last_reviewed_at: 2026-08-06
current_runtime_revision_reviewed: 0007e10d852004a6fb18f86e76afd7591fba435d
evidence_file: docs/personal-plan/categories/heat-protectant/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/heat-protectant.ts
test_surface: tests/personal-plan/categories/heat-protectant.test.ts
---

# Personal Plan Heat Protectant decision

## Authority and checkpoint status

Nick has confirmed the complete category-local Stage 1, Stage 2, and Stage 3 product policy plus the catalog/data/implementation-readiness boundaries below. This makes the Heat Protectant checkpoint authoritative for the remaining Personal Plan planning work.

Confirmed planning readiness does not claim that catalog support, product rows, protocols, runtime, persistence, or UI already exist and does not authorize implementation, catalog publication, or activation.

No legacy recommendation, CareBalance, Routine, or Chat path becomes a second Personal Plan authority. After implementation, the dedicated plan-owned module and its deterministic tests become runtime authority.

## Intended user decision

The Personal Plan must tell the user:

- whether Heat Protection is `basis`, `optional`, or `not_needed` from their classified tool use;
- that the job occurs before every qualifying heat event rather than on a weekly cadence;
- whether a verified in-hand Leave-in, Oil, or standalone Heat Protectant already covers the job;
- which exact verified product fills an uncovered job;
- which verified carrier alternative is available when useful, without manufacturing a synthetic format alternative;
- when and how the confirmed exact product must be applied according to its verified instructions.

## Charter and boundaries

Heat Protectant owns one job and one semantic role:

- job: reduce thermal damage during qualifying heat-tool events;
- role: `pre_heat_protection`.

The role may be filled by a finished Leave-in, Oil, or standalone Heat Protectant only when explicit finished-product evidence verifies Heat Protection.

Explicit non-jobs:

- ordinary conditioning, repair, detangling, shine, anti-frizz, hold, shape, glossing, or coating;
- general Styling selection;
- temperature optimization or matching by a claimed maximum temperature;
- diagnosing hair damage or promising that existing damage is reversed;
- inferring protection from category name, format, marketing language, ingredients, or one ingredient.

Styling-led coating, glossing, anti-frizz-film, hold, and shape products remain outside V1 even if they also claim Heat Protection. They belong to the later Styling definition unless their primary routine job is independently classified as Leave-in, Oil, or standalone Heat Protection.

## Current-behavior treatment ledger

| Area | Current truth | Treatment | Gap/dependency |
|---|---|---|---|
| Lossless Personal Plan quiz | Hair/profile facts are preserved, but the paid quiz has no complete Heat-tool behavior model | `reuse` the lossless envelope; consume only materially necessary shared setup | `shared_dependency`: normalized Hair Tools exposure |
| Legacy onboarding | Captures tool use, Heat frequency, reported Heat Protection, and drying method | `adapt` only as setup/input prior art | It must not make frequency change the Heat tier |
| Hair Tools category plan | Classifies ordinary airflow, airflow shaping, and direct-contact heat | `reuse` as the exposure authority once normalized | Every supported tool must classify deterministically |
| Intervention/CareBalance frequency | Can add Heat Protection broadly and express weekly cadence | `reject` as Personal Plan authority | Heat cadence is event-based only |
| Legacy Leave-in selector | Can prefer Heat-capable Leave-ins and currently uses temperature-related logic | `adapt` the verified binary finished-product capability and one-product bias; `reject` temperature matching | Dedicated Personal Plan allocation owns the final carrier choice |
| Leave-in category decision | Prefers a suitable combined care/Heat product and permits a separate Heat Protectant | `reuse` | Leave-in retains its own fit authority |
| Oil category decision | May expose verified Heat Protection as a finished-product capability | `adapt` when canonical Oil facts exist | Oil retains its own fit authority |
| Standalone catalog support | Category identity exists but catalog/intake support and standalone specs are absent | `missing` | `catalog_data_gap`; confirmed delivery boundary is defined below |
| Product protocols | No canonical Heat-specific protocol rows exist | `missing` | `catalog_data_gap`; exact protocol is mandatory for execution |
| Dedicated Personal Plan runtime/tests | No `src/lib/personal-plan/**` category runtime exists yet | `missing` | shared implementation workstream |

## Inputs and clarification behavior

Category-local Stage 1 consumes one normalized shared input: the Hair Tools exposure route for each tool/use event.

The category does not consume thickness, density, texture, length, damage, treatment, Heat frequency, claimed maximum temperature, or format preference to determine inclusion or tier. Those facts may affect another carrier category or shared explanation, but they do not change the Heat Protection job.

No Heat-specific conditional question is added. The shared setup must collect enough tool-use information to classify the event. An unclassified supported tool is a shared classifier/data blocker, not a new Heat Protectant question and not permission to guess.

Stage 2 additionally consumes:

- current ownership and exact product identity/pending state;
- product lifecycle, availability, budget, and shared exclusions;
- verified finished-product Heat Protection;
- product's home category;
- descriptive format;
- verified application protocol and source.

## Stage 1 — need, tier, target, and cadence

| Rule ID | Canonical condition | Output | Decisive reason fact |
|---|---|---|---|
| `heat_protectant.inclusion.direct_heat` | Hair Tools classifies at least one used event as direct-contact heat | `basis` | direct-contact heat is used |
| `heat_protectant.inclusion.airflow_shaping` | No direct-contact rule matches and Hair Tools classifies at least one used event as airflow shaping | `optional` | airflow shaping is used |
| `heat_protectant.inclusion.ordinary_airflow` | Only ordinary airflow drying is used | `not_needed` | no qualifying Heat Protection event |
| `heat_protectant.inclusion.no_heat_event` | No qualifying heat-tool event exists | `not_needed` | no qualifying Heat Protection event |
| `heat_protectant.inclusion.unclassified_tool` | A selected tool/use cannot be mapped by the shared Hair Tools classifier | typed unresolved dependency | tool classification missing; do not infer or add a Heat-specific question |

Precedence is direct-contact `basis`, then airflow-shaping `optional`, then `not_needed`. Frequency never promotes or demotes the tier. Product ownership never changes the underlying tier.

Included Stage 1 cards use:

- category: `Hitzeschutz`;
- target: `Hitzeschutz – integriert oder separat`;
- role: `Vor Hitze schützen`;
- cadence for `basis`: `Vor jedem Einsatz mit direkter Hitze`;
- cadence for `optional`: `Vor jedem Airflow-Styling`.

The collapsed card shows the generic target, event cadence, and tier. The expanded card preserves at most two decisive structured reasons, with the exact used Hair Tool route as the primary fact. `not_needed` produces no Heat Protectant card in Stage 1.

## Product capability and minimal fit axes

Heat Protection is a binary finished-product capability for V1:

- verified `true`: may cover the role;
- verified `false`: cannot cover the role;
- `null`, missing row, missing source, or unresolved identity: `unknown` / `noch in Prüfung`;
- the capability cannot be user-overridden from false or unknown to true.

Standalone Heat Protectant has only these category-local product axes:

1. verified binary Heat Protection;
2. verified application protocol;
3. descriptive format, constrained to `spray` for the scoped Drogerie V1.

There is no Heat-specific weight, suitable-thickness, claimed-temperature, strength, ingredient, care-direction, repair, or Styling axis. Format does not infer weight, protection, or suitability and has no deterministic ranking effect.

Pump, aerosol, mist, and two-phase products all normalize to standalone format `spray`. Their delivery, shaking, distance, ventilation, and flammability facts belong to packaging/protocol instructions rather than fit. Do not add speculative standalone `cream`, `gel`, `serum`, `foam`, `balm`, `lotion`, `milk`, `oil`, or `other` values in V1. A future protection-first non-spray product requires primary-job review and a deliberate enum expansion.

Leave-in and Oil remain in their home categories. Their home-category evaluators own care/formula fit; Heat Protectant consumes only their verified capability and exact protocol after they pass that home-category evaluation.

### Home-category capability authority

Keep one canonical Heat Protection fact in each product's home-category specification:

- `product_leave_in_specs.provides_heat_protection` for care-first Leave-ins;
- the planned canonical `product_oil_specs.provides_heat_protection` for Oils;
- `product_heat_protectant_specs.provides_heat_protection` for protection-first standalone products.

All three use identical tri-state semantics: `true` is verified protection, `false` is verified no protection, and `null` is not yet verified. A missing spec row or pending identity remains `unknown` rather than being coerced to false.

The Personal Plan normalizes these home-category facts into one internal `HeatProtectionCarrier` shape only at the engine boundary. That normalized type is not another database authority. Do not add a generic cross-category capability table for V1.

The current Leave-in column is non-null with a false default and therefore conflates unreviewed with verified-no. Catalog parity requires a guarded nullable migration, consumer audit, and backfill that preserves known verified values. The planned canonical Oil spec must use the same tri-state contract from its first migration.

## Cross-category allocation and replacement

Apply this exact non-redundancy hierarchy:

1. retain a fitting, confirmed in-hand product with verified Heat Protection;
2. otherwise reuse a fitting Leave-in or Oil already selected for its primary job when its Heat Protection is verified;
3. recommend a standalone Heat Protectant only when neither existing nor already-needed products provide coverage.

Product minimization is permitted only after full job coverage and home-category fit pass. A separate suitable in-hand Heat Protectant is valid and is not replaced merely to consolidate products.

One confirmed product may cover several categories/roles, but the Heat allocation must not cause duplicate use. Integrated coverage annotates the carrier's existing occurrence. It does not create an extra application unless the exact protocol requires reapplication.

## Stage 2 — exact product reconciliation

### Role-relative fit

- `ideal` / `passt sehr gut`: identity resolved, verified Heat Protection is true, exact protocol is verified, shared safety/exclusion gates pass, and the product is available for the assigned event;
- `supportive`: unused for Heat-specific fit in V1; format preference does not create a lesser fit;
- `mismatch`: verified Heat Protection is false for the assigned role;
- `unknown` / `noch in Prüfung`: identity, capability, or protocol is missing/unverified.

The global `wechseln empfohlen` presentation is not used merely because another format exists or another verified product is available. A product that does not verify Heat Protection simply does not cover this role; the verified alternative remains available. False or unknown capability and missing protocol cannot be retained as informed Heat-coverage overrides.

### Owned-product comparison

When a user reports owning Heat Protection:

1. show one ideal verified recommendation;
2. ask the user to identify their exact product;
3. place the owned product and ideal recommendation beside one another once identity resolves;
4. evaluate the owned product against binary capability and protocol only, while its home category owns any other fit;
5. let the user choose `Mein Produkt behalten` or put the alternative on the shopping list;
6. after confirmation, remove the unselected alternative from the active comparison state.

If the owned identity remains unresolved, keep asking for exact identification while the ideal verified alternative remains visible. Neither the unidentified product nor an unacquired alternative enters executable Stage 3 steps.

Do not promise a different-format standalone alternative in V1: verified mainstream standalone candidates are sprays. A different carrier format may appear only when a Leave-in or Oil independently passes its home-category fit and the confirmed non-redundancy hierarchy makes it a valid carrier. Do not derive that carrier choice from thickness or manufacture an inferior alternative merely to create format choice.

### Selection and lifecycle

Candidate filtering first applies:

1. resolved identity and active lifecycle;
2. shared safety and strong exclusions;
3. verified Heat Protection = true;
4. verified protocol;
5. carrier hierarchy and home-category fit;
6. shared budget and availability;
7. stable saved choice and shared tie-breakers.

Format remains neutral. Do not manufacture a different-format choice with an inferior or unverified product.

Reuse the shared owned, pending, recommended, shopping, acquired, declined, and confirmed-plan lifecycle. Affiliate-link opening never means acquisition. Only user-confirmed acquisition moves a shopping product into in-hand inventory, and only a confirmed in-hand product can compile into Stage 3.

If no verified product is available, return the honest uncovered/no-valid-match state. Never promote a false, unknown, or protocol-incomplete product as the recommendation.

## Stage 3 — occurrence, order, and protocol

Heat Protectant attaches to every qualifying Hair Tools event. It does not create a separate weekly cadence or day type.

Normalized protocol application states are:

- `damp`: apply to damp/towel-dried hair before the relevant drying/heat sequence;
- `dry`: apply to dry hair before the relevant direct-heat sequence;
- `either`: the verified product supports either state.

This same Heat-application contract applies identically whether the carrier is a standalone Heat Protectant spray, a Leave-in, or an Oil. The carrier's home category does not change the meaning of damp, dry, or either. The implementation may normalize existing category fields into the shared role-specific protocol store, but that storage choice is not a separate product-policy decision.

Use a separate reapplication fact:

- `required`;
- `optional`;
- `not_stated`.

Verified instruction modifiers may include shaking, spray distance, even distribution, sectioning, comb-through, no-rinse behavior, and an instruction to ensure hair is dry before direct-contact heat. These are modifiers, not additional protocol types. Preserve the original verified label/source text for traceability.

Occurrence compilation:

- standalone product: insert one step immediately before the relevant heat stage, using the product's damp/dry state and modifiers;
- integrated Leave-in/Oil: merge Heat coverage into that product's existing application step;
- reapplication: add a second step only when the exact product protocol says it is required;
- no exact confirmed in-hand product: keep the Heat event visibly uncovered/pending and do not compile a fake product step;
- missing protocol: product remains `noch in Prüfung`, cannot be newly recommended, and cannot compile into an executable step. Show `Nach Produktangabe` as interim guidance rather than inventing timing.

Never invent sprays/pumps, amount, wait time, temperature, activation, section count, or reapplication. Exact verified product directions control these details but cannot override the binary Heat Protection requirement or silently add non-Heat Styling jobs.

## Safety, uncertainty, and reasoning

- Burning, itching, rash, swelling, breathing discomfort, eye exposure, or other material adverse reactions trigger stop-use/product-label or professional guidance rather than optimization.
- Follow aerosol flammability and ventilation warnings from the exact product label.
- Never claim that Heat Protection prevents all damage, repairs existing damage, or makes unlimited/frequent heat harmless.
- Weak sensory advice remains preference guidance, never a hard thickness-based match.

The structured payload preserves:

- Hair Tools route and inclusion tier;
- event cadence and decisive reason facts;
- generic integrated-or-separate target;
- selected carrier category and non-redundancy decision;
- identity, binary capability, protocol verification, format, and exact source;
- owned/recommended comparison and confirmed action;
- pending, shopping, acquired, and uncovered states;
- merged versus standalone occurrence and any verified reapplication;
- uncertainties, non-overridable gaps, and safety boundaries.

Shared presentation owns final German reason templates and card-fact salience; it may not change deterministic outcomes.

## Deterministic fixture matrix

1. `heat-protectant-no-heat`: no qualifying event = `not_needed`, no card.
2. `heat-protectant-ordinary-blow-dry`: ordinary airflow only = `not_needed`, no card.
3. `heat-protectant-airflow-shaping`: airflow shaping = `optional`, occurrence before every airflow-shaping event.
4. `heat-protectant-direct-heat-rare`: rare direct-contact heat = `basis`; frequency does not demote.
5. `heat-protectant-direct-heat-frequent`: frequent direct-contact heat = same `basis` rule and event cadence; frequency does not promote further.
6. `heat-protectant-direct-plus-airflow`: direct heat wins tier precedence; event allocation still covers every qualifying event exactly.
7. `heat-protectant-unclassified-tool`: typed unresolved shared classifier dependency; no guessed tier and no Heat-specific question.
8. `heat-protectant-owned-standalone`: verified in-hand standalone covers the role; no redundant recommendation after confirmation.
9. `heat-protectant-integrated-leave-in`: fitting Leave-in with verified Heat Protection covers the job and merges into its existing step.
10. `heat-protectant-integrated-oil`: fitting Oil with verified Heat Protection covers the job and merges into its existing step.
11. `heat-protectant-no-integrated-carrier`: no fitting combined carrier; one verified standalone recommendation is supplied.
12. `heat-protectant-owned-identity-pending`: ideal alternative remains visible; unidentified owned product and unacquired alternative stay out of executable steps.
13. `heat-protectant-capability-false`: product cannot cover the role and cannot be overridden; verified alternative remains available.
14. `heat-protectant-capability-unknown`: product is `noch in Prüfung` and cannot be confidently recommended or compiled.
15. `heat-protectant-protocol-missing`: verified capability without verified protocol remains `noch in Prüfung`; show label guidance only.
16. `heat-protectant-protocol-damp`: standalone step uses damp/towel-dried state.
17. `heat-protectant-protocol-dry`: standalone step uses dry state.
18. `heat-protectant-protocol-either`: exact product may compile in either supported state.
19. `heat-protectant-reapplication-required`: integrated or standalone product gets a second pre-direct-heat step only from verified instructions.
20. `heat-protectant-no-reapplication`: no duplicate step when reapplication is optional or not stated.
21. `heat-protectant-no-synthetic-format-alternative`: standalone V1 candidates are sprays; no inferior or out-of-category product is shown merely to create format choice.
22. `heat-protectant-styling-led-hybrid`: Styling-primary gloss/hold/coating product is excluded from V1 Heat recommendation scope.
23. `heat-protectant-shopping-not-acquired`: shopping alternative is visible but absent from executable steps.
24. `heat-protectant-acquired-confirmed`: confirmed acquisition previews and, after plan confirmation, fills the event occurrences.
25. `heat-protectant-stable-choice`: unchanged inputs/catalog preserve the saved confirmed product rather than reranking unnecessarily.
26. `heat-protectant-no-valid-candidate`: role remains honestly uncovered; no false/unknown fallback is promoted.

Every fixture must assert the decisive rule IDs, Stage 1 tier/cadence, Stage 2 carrier/product state, Stage 3 occurrence/step, and any unresolved/shared/data gate.

## Confirmed shared dependencies

- Hair Tools owns deterministic classification of every supported tool/use into ordinary airflow, airflow shaping, or direct-contact heat.
- The portfolio allocator owns cross-category functional coverage and exact carrier assignment while preserving Heat's total event cadence.
- Shared lifecycle owns pending, shopping, acquisition, proposal, confirmation, and immutable active-plan transitions.
- Shared protocol infrastructure owns verified source storage and loading; Heat owns its application-state interpretation and reapplication behavior.
- Shared presentation owns German templates and two-fact salience.
- The global Personal Plan feature flag, analytics/privacy, rollback, and release verification remain shared implementation concerns.

## Confirmed data and implementation readiness

The following implementation gaps remain and are governed by the confirmed readiness plan below:

- `heat_protectant` is known by product identity but is not a supported catalog/intake category;
- there is no canonical standalone Heat Protectant spec table or required intake mapping; the confirmed direction is a minimal home-category table rather than a generic capability table;
- there are no standalone Heat Protectant rows in the audited live catalog;
- Leave-in has a non-null Heat flag that requires tri-state migration/backfill; the future canonical Oil spec and standalone spec must use the same semantics; the cross-carrier adapter exists only at the Personal Plan engine boundary;
- no canonical Heat protocol rows exist;
- the dedicated Personal Plan module, selector, protocol compiler, persistence, and UI do not yet exist for any category in this planning stream.

Do not add an arbitrary SKU-count requirement beyond the confirmed cohort, create a Heat-only feature flag, or reinterpret these implementation gaps as permission to omit the category silently.

### Confirmed complete initial Drogerie seed cohort

Nick confirmed the following six products as the complete active standalone seed cohort:

1. Balea Hitzeschutzspray Ultralight;
2. Jean&Len Hitzeschutzspray Beat the Heat;
3. Taft Aloe Boost Hydra Protect Hitzeschutz Spray;
4. got2b Hitzeschutzspray Schutzengel;
5. Taft x Gliss Lovely Long Hitzeschutz-Spray;
6. L'Oréal Paris Elvital Dream Length Defeat the Heat Hitzeschutzspray.

The complete cohort also retains one verified pending candidate:

7. Balea Hitzeschutzspray 2-Phasen, dm article `1460813`, EAN `4070765073546`: retain the official German identity URL with `temporarily_unavailable`; do not expose the Austrian URL or an unverified marketplace/import listing as a German purchase link. It becomes eligible for an active recommendation only after German availability is reconfirmed.

This is a research/intake cohort, not an approved database write. Product Intake must still verify each row's complete exact-product package and receive normal product-level approval before any catalog write. Availability is rechecked at approval time. A read-only duplicate check found no existing matching rows for the researched cohort products in the current catalog.

### Confirmed delivery and activation boundary

Category support and its empty data structures may ship before catalog enrichment. The core implementation may deploy the standalone category identity, canonical spec schema, shared protocol schema support, typed adapters, deterministic selectors, persistence/API support, and UI wiring without inserting the cohort's product facts.

The six active product packages and the pending Balea package belong to the separately reviewed, shared cross-category follow-up enrichment PR. Its Heat Protectant workstream owns the exact catalog rows, verified binary capability values, application protocols, approved images and links, lifecycle/availability state, and product-level Product Intake approvals; it must not introduce or reinterpret category policy or runtime selection logic.

Deployment of inert schema/runtime support is not category activation. User-facing launch remains blocked until the shared cross-category follow-up enrichment PR is merged and all six active seed products pass exact-product and protocol verification. The pending Balea row does not block launch and must remain ineligible while German availability is unresolved.

Before enrichment, an empty standalone catalog fails closed. Stage 1 must preserve the truthful need/tier/cadence, while Stage 2 returns the typed `catalog_data_gap` state for an uncovered role. The runtime must not hide the category, infer capability, or manufacture an exact recommendation. A fitting verified in-hand Leave-in or Oil may still cover the role through the normal confirmed carrier hierarchy.

Explicit exclusions from the supplied Drogerie orientation sheet:

- Bali Curls Curl Defining Spray: exclude because curl definition/Styling is the primary job and Heat Protection is ancillary;
- NEQI Moisture Mystery Leave-In Cream, Bali Curls Bonding Repair Leave-In Cream, and Pantene Moisture Boost Heat & Glow: keep in Leave-in because care is the primary job, even where Heat Protection is verified.

## Handoff and stop gates

The Heat Protectant category-local definition stop gate is cleared: Stage 1/2/3 policy, fixtures, initial seed-cohort boundary, enrichment separation, empty-catalog behavior, and launch dependency are confirmed.

This checkpoint does not clear the parent implementation stop gate by itself. Stage-1 implementation remains subject to the shared living plan's parallel-category confirmation and fresh-worktree requirements. Heat Protectant user-facing activation separately remains blocked until the Heat Protectant workstream of the shared cross-category follow-up enrichment PR provides all six active exact-product packages and verified protocols. No database write, runtime change, shared-plan edit, framework/index edit, or commit is authorized by this checkpoint.
