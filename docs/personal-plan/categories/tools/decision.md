---
category: tools
document_type: decision
status: confirmed
decision_version: 4
last_reviewed_at: 2026-08-25
version_note: "v4 (2026-08-25) — counterpart-review reconciliation: stale pre-ruling mirrors corrected and the D4-D7 contract seams written against the implemented WS1 contract."
current_runtime_revision_reviewed: 37319140
current_reconciliation_plan: plans/2026-08-12-personal-plan-hair-tools-current-shape.md
evidence_file: docs/personal-plan/categories/tools/evidence.md
product_spec_file: docs/personal-plan/categories/tools/product-spec.md
input_mapping_file: docs/personal-plan/categories/tools/input-mapping.md
fixture_file: docs/personal-plan/categories/tools/fixtures.md
rulings_file: plans/2026-08-24-hair-tools-d1-d9-rulings.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/tools.ts
test_surface: tests/personal-plan-tools.test.ts
---

# Personal Plan Hair Tools decision

## Authority and intended user decision

This document is the product-policy specification for Hair Tools. It follows `docs/personal-plan/categories/category-design-framework.md` and the implemented five-stage Personal Plan contract reviewed in draft PR #344.

Nick ruled the nine open spec gates `D1`-`D9` on **2026-08-24**; the ruling ledger is `plans/2026-08-24-hair-tools-d1-d9-rulings.md` and those rulings are recorded in place below. Every spec token in this document is read through `docs/personal-plan/categories/tools/input-mapping.md`; that file is the normative spec-token → production-field bridge, and `docs/personal-plan/categories/tools/fixtures.md` is the executable form of the fixture matrix at the end of this document.

### Five-stage terminology correction

The route and fixture decisions remain confirmed. Older labels in this document map to the implemented product as follows: broad ownership/refinement belongs to Stage 2, every older “exact Stage 2 card/example” means Stage 3 Produkte, routine placement belongs to Stage 4, and every older “Stage 3 guidance” means Stage 5 Anwendung. The refreshed implementation contract and target files live in `plans/2026-08-04-personal-plan-hair-tools-category.md`; that mapping supersedes older stage wording here.

Hair Tools is one visual and navigation section, not one lossy recommendation result. The plan must tell the user, per tool family:

- whether the family is `basis`, `optional`, or `not_needed`;
- which job and generic tool form or capability would cover it;
- whether a broadly reported route should be continued first;
- which one concrete catalog example can cover an otherwise missing route;
- which genuinely different viable alternative exists, when useful;
- how and when to use the confirmed route safely.

The category does not inventory, identify, compare, or issue a fit verdict on an exact tool the user already owns. Brand, model, attachment identity, and specifications are not onboarding inputs.

## V1 family charter

| Family | Recognizable forms | Legitimate jobs | Non-jobs |
|---|---|---|---|
| `airflow` | dryer, hot-air brush, multi-styler airflow; diffuser or concentrator capability | dry hair, direct airflow, preserve pattern, support root/shape work | repair, guaranteed anti-frizz, attachment compatibility inference |
| `heated_styling` | straightener, curling/waving iron, hot brush, heated rollers, heated multi-styler | straighten, curl/wave, create volume or shape | repair, universal damage prevention |
| `heatless_styling` | rollers, rods, ribbon/band, setting formers | curl/wave, create volume or shape without direct heat | guaranteed safer use regardless of tension |
| `brushes_combs` | wide-tooth comb, detangling brush, paddle/vent/round brush, Wildschweinborsten-Bürste (`boar_bristle`, restored 2026-08-24 under `R3`), pick, styling comb | detangle, distribute, smooth, shape, support airflow styling | diagnosis of technique from product form |
| `securing_sectioning` | soft ties, scrunchies, claw/sectioning clips, pins, headbands | hold, section, support a set or another plan step | independent mandatory ownership |
| `wash_application` | gentle scalp/shampoo brush, shower detangler, applicator bottle/comb, sectioning aid | controlled placement, distribution, wash-day access, optional comfort | growth, anti-shedding, medical treatment |
| `night_protection` | pillowcase, bonnet, loose securing, pineapple, length/tip accessory | low-friction option, containment, style preservation | repair, split-end reversal, growth |
| `drying_textiles` | ordinary towel, microfiber towel/wrap, cotton T-shirt | absorb or contain water, support gentle drying or shape | proof that one material universally prevents damage |

`Protection` is not a family. Heat protection, low-friction sleep handling, gentle securing, and gentle drying are capabilities or guidance within the relevant family.

Every user-facing product category may carry one broad primary purpose for orientation. The selected product type may carry the narrower primary purpose it serves in the user's plan, derived from the documented job/capability mapping. Neither purpose replaces the product-category or product-type name, creates a new input, or independently changes the need tier.

## Architecture and current-behavior treatment

| Area | Treatment |
|---|---|
| Shared `basis | optional | not_needed`, capability coverage, product lifecycle, and proposed-plan mechanics | `reuse` |
| `dryingRoutes`, `heatEvents[…].frequency`, `heatEvents[…].protectionConsistency`, `additionalHeatTools`, `toolForms`, `nightProtection`, `towel.material`, and `towel.technique` | `adapt` losslessly into plan-owned tool inputs. Amended 2026-08-24: the legacy `uses_heat_protection` boolean is `reject`ed outright per `D9a` |
| Nullable arrays where `null` means unknown/legacy, `[]` means explicitly none, and non-empty means reported use | `reuse` |
| Existing brush, Night Protection, heat, dryer, and towel technique copy | `adapt` only where supported by this decision and `evidence.md` |
| Existing `mechanicalLevel` as a Night Protection trigger | `reject`; it includes missing Night Protection and is circular |
| Existing instruction-only, `product_linkable: false` tool slots | `reject` as the future output contract |
| Exact owned-tool reconciliation, submissions, keep/replace verdicts, and attachment verification | category-specific `not_applicable` |
| Canonical multi-capability tool catalog and product-intake rules | `missing`; specified below for implementation |

## Inputs and grouped onboarding

The onboarding starts with one compact Tools overview built from **four section cards** — corrected on 2026-08-24 under `D3b`; the earlier "eight product-category names on the overview" description was wrong and is retired. The four cards are the reviewed and approved mockup. The persisted answer stays family-keyed over all eight families (`toolFamiliesWithSomething`); the four sections are presentation only. The overview then opens up to four related product-type drilldown pages only for categories selected on that overview:

1. `Haartrockner & Luftstyler`;
2. `Hitzestyling-Tools` plus `Heatless Styling & Setzen`;
3. `Bürsten & Kämme`, `Clips, Haargummis & Fixierhilfen`, and `Wasch- & Auftragshilfen`;
4. `Nachtschutz` plus `Handtücher & Trocknungsmaterialien`.

These are the four conditional page groups: Airflow; Heated + Heatless Styling; Handling & Helpers; and Protection & Drying. A page appears only if at least one category in that group was selected, and only selected category sections render inside it. The section headings remain product-category labels, not purpose headings. Each category contains recognizable product types; purposes/jobs are retained as recommendation mappings and explanation facts below the type.

The overview does not expose every product type at once. It captures selected families; each conditional drilldown then captures only broad, recognizable forms and permits multiple forms. It does not ask for brand, model, precise attachment inventory, wattage, temperature, weight, dimensions, or technique compliance. Existing behavior questions remain conditional and separate, including drying method, heat frequency, Heat-protection use, and towel technique.

The category consumes a normalized `reportedToolFormsByFamily` view derived losslessly from existing and newly required route-specific fields. Each nullable multi-select preserves:

- `null`: unknown or legacy, never silently treated as no;
- `[]`: user explicitly reports none in that group/family;
- non-empty: one or more broad forms are reported.

Submitting the family overview makes every unchecked family explicitly empty. A user who never saw or submitted the new overview—including a migrated profile—remains `null`; the implementation must never convert that unknown state to none during migration.

**`D3a`, ruled 2026-08-24 — an unticked overview card means „hat nichts".** For every family behind an unticked card the submitted overview persists explicit none, and there are no unknown families left after submit. Two conditions make that fair and are part of the ruling, not optional polish:

1. **Preselection.** The existing preselect helpers (`defaultToolSectionsFromCare` / `defaultToolFormsFromCare`) must be wired up, so everything the user's care answers already imply arrives pre-ticked. The user corrects a filled-in picture instead of building one from nothing.
2. **Honest lead copy.** The current promise „Was du auslässt, bleibt offen — wir behaupten nichts" is **withdrawn**; it states the opposite of the ruling. **Ratified 2026-08-25** — evidence review confirmed and user-journey sign-off obtained (Nick; mockup evidence `plans/mockups/ws4-2026-08-25/`, see the rulings ledger) — the final lead copy is:

   > „Wähle die Bereiche, aus denen du schon Produkte hast. Nicht gewählt = hast du nicht."

   The copy gate is closed; only the WS4 **implementation** of this copy is still pending.

**`D3c`, ruled 2026-08-24 — merge per form, never replace per family.** An answered Tool page **adds and confirms** forms; care-derived facts survive unless the Tool answer explicitly contradicts them. This precedence rule applies to **all eight families**, not only drying. Synthesized emptiness must never overwrite a reported care answer: a user who reported `additionalHeatTools` and then submits a heated-styling page keeps that evidence. The former drying-only sentence ("`drying_method` remains the source of the dominant drying behavior") is retired together with the dominant-drying-method concept — see the drying-routes ruling below.

Two merge refinements (WS2, 2026-08-25, entailed): a **behaviour stand-in** — a form projected as a generic placeholder for a behaviour rather than named by the user (today only `dryingRoutes → hair_dryer`) — is superseded when the user's own family answer names a form; named derivations (`additionalHeatTools`, `nightProtection`, `towel.material`) always union (fixture 124 vs fixtures 22/38). And an explicit family-wide „Nichts davon" on a Tool page is an explicit contradiction of projections for that family and wins over them.

The drilldowns list product types, never exact catalog products. Selecting a type already means `I use a product of this type`; there is no vague family-wide `other` option. For Clips/Ties, Wash/Application aids, and Drying Textiles, the selected simple product type may inherit its documented generic capabilities. For Brushes/Combs, Night Protection, airflow, heated, and heatless tools, reported type ownership does not fill route-critical exact capability gaps; compatibility and guidance stay conditional where the route requires them.

Only later, on an exact Stage 2 recommendation card in one of the three simple families, the action `Ich nutze bereits ein anderes Produkt dieser Art` may mark the named generic product type/capability as covered. It never copies exact-SKU claims or exact instructions. Other families do not receive this shortcut because their exact capability or protocol can materially differ within a broad type.

The grouped page may persist to several route-specific fields; one page does not require one database array. Implementation must migrate or reuse existing answers without asking the same fact twice. Precedence between a care answer and a Tool page answer follows the merge-per-form rule in `D3c` above; there is no dominant-drying-method override.

### Heat-protection coverage (`D9a`, ruled 2026-08-24 — reverses the legacy-boolean exception)

The former `uses_heat_protection` legacy-boolean compatibility exception (confirmed 2026-08-05 as `I01`) is **reversed**. No Personal Plan module reads that boolean, and it stays unread: it is not imported, not migrated, and not a reason fact.

The single source of truth for heat-protection coverage is `heatEvents["heat:<source>"].protectionConsistency`, judged **per heat event**:

| `protectionConsistency` | Coverage | Output |
|---|---|---|
| `always` | covered | dependency satisfied for that event; no duplicate Heat-protection recommendation |
| `sometimes` | not covered | consistency nudge, tier `empfohlen` — copy in the register of „mach's konsequent", never an accusation |
| `no` | not covered | recommend Heat protection for that event |
| `unsure` | not covered | recommend Heat protection for that event |

Coverage is per heat event, so a user may be covered for the flat iron and uncovered for the Warmluftbürste; the portfolio result is the union of the uncovered events. `protectionConsistency` is required for `airflow_shaping` and `direct_contact_heat` sources and forbidden for `ordinary_airflow`, so an unanswered coverage state cannot arise for a completed heat-event question.

**`R1`, ruled 2026-08-24 (second round):** because the legacy `diffuser_or_airflow_shaping` answer is read as diffuser drying (`D2a`, tier `not_needed`), the Stage-2 heat-protection question for that source is **dropped now**, not kept. `protectionConsistency` becomes forbidden for the diffuser source, like `ordinary_airflow`. Per `D8` this is a completion-semantics change: it requires a path-version bump plus a decode rule — stored `protectionConsistency` values for that source are ignored on read, and rows completed under the old contract stay complete.

Evidence honesty (from the delegated research lane): heat-protectant copy stays at „empfohlen/sinnvoll" and never becomes „nötig, sonst Schaden" — a measured benefit exists only at flat-iron temperatures.

Fixtures 122 and 123 are **retired as impossible**: production never defaults `protectionConsistency`, so neither "trust the stored `false`" nor "treat the database-default `false` as unknown" describes a reachable situation.

This is a regrouping/replacement of scattered tool-form capture, not permission to append duplicate onboarding pages. New broad forms may be added inside the grouped section. Existing behavior questions remain where they already materially change a rule. Implementation must preserve onboarding completion instrumentation and compare entry, completion, and drop-off for the grouped Tools step during rollout.

| Input | Decisions it may change |
|---|---|
| `dryingRoutes` (the drying-route **set**) | airflow need tier, route copy, occurrence — per ticked member, see the drying-routes ruling below |
| `styling_tools` / normalized heated forms | reported heated route, not underlying need |
| normalized heatless forms | reported heatless route, not underlying need |
| `heatEvents[…].frequency` | heated occurrence cadence, per heat event |
| `heatEvents[…].protectionConsistency` | heat-protection coverage per event and application/safety guidance (`D9a`) |
| `brush_type` / normalized brush forms, including „Nur Finger" | conditional use-first route and exact generic form (`D9b`) |
| normalized securing and wash/application forms | conditional use-first copy for an already-relevant optional aid |
| `night_protection` | reported option priority; never need tier |
| `towel_material`, `towel_technique` | optional material route and firm technique correction |
| `hair_length`, `hair_texture`, `hair_thickness` | brush inclusion boundary, form/application fit, and the inferred volume direction (`D1`) |
| `concerns`, `goals` | named styling jobs, structural vulnerability, and optional Night Protection relevance |
| `concerns` contains `low_volume_or_weighed_down` | triggers the volume routes on its own and overrides the inferred direction (`D1`) |
| `goals` contains `manageability_styling` | Night-Protection optional relevance (`D9c`) |
| cross-category planned occurrences | whether an application or sectioning aid has a real supporting event |

Removed on 2026-08-24 (correction, no decision needed): `hair.surface` (cuticle fact), `hair.elasticity` (pull fact) and `hair.chemicalTreatments` (treatment facts) were listed here as inputs that may change a Tool decision. No rule reads them and `ToolProfileFacts` does not carry them; the claim was aspirational and is deleted rather than left standing.

No new question is allowed solely to personalize explanatory copy. Missing reported-use data yields conditional wording, not an invented ownership state or mandatory clarification.

When reported ownership covers a real plan need, the recommendation remains visible in the normal plan order with `Nutze deins`/covered presentation and no shopping action. It is not hidden or moved to a separate owned-products section; ownership covers acquisition, not the reason or routine step.

### Ownership is not coverage (`D4`, ruled 2026-08-24)

A route carries **two independent facts**, never one field doing both jobs:

- `reportedOwnership` — what the user actually told us. It is written only from an actual user answer, or written and marked **`derived`** when it is projected from a care behaviour rather than stated.
- `coverage` — does the plan still recommend acquiring something for this route?

`B04` (any reported physical brush/comb suppresses another foundational purchase) sets **coverage only**. „Nutze deins" is gated on reported or derived ownership **of the actual form**, never on coverage alone; a corrected foundation the user does not own must never render as „Nutze deins".

**The card names THEIR tool.** A user who reported a Paddle-Bürste while the ideal form is a Detangling-Bürste sees „Nutze deine Paddle-Bürste" with the guidance adapted to that form. The ideal form may appear as an optional note; while the route is covered it never becomes a purchase push.

Care-derived facts are kept — the ruling does not create new unknowns — but presentation may phrase them behaviourally rather than as an ownership assertion: „Du föhnst — nutze deinen Föhn" instead of „Du besitzt einen Föhn". Terry-towel (`towel.material = frottee`) and `loose_tied` / `pineapple` reports are stored as **what the user actually said** — a towel material and a nightly technique — and never as "owns no drying textile" or "owns a soft tie".

**When both a derived and a reported fact exist for the same route, `provenance` records the stronger `reported`, and `forms` is the union of both** — the derived evidence is never deleted by the arrival of an answer (`D3c`).

#### The implemented contract (WS1, `src/lib/personal-plan/tools/contracts.ts`)

The two facts are these exact shapes. Every fixture's `D4` notation uses these value domains and no others:

```ts
reportedOwnership {
  state: ToolOwnershipState        // unknown | explicit_none | owned_generic
                                   // | selected_exact | owned_exact | catalog_gap
  provenance: "reported" | "derived" | null   // null iff state is unknown
  forms: ToolProductType[]         // empty iff unknown or explicit_none;
                                   // every form inside the route's own family
}

coverage {
  state: "uncovered" | "covered_by_report" | "covered_by_derived"
       | "covered_by_selection" | "not_applicable"
  capabilityVerified: boolean
}
```

- `provenance` is `null` **exactly** when `state` is `unknown`; a resolved state always names its source.
- `forms` is empty **exactly** when the state is `unknown` or `explicit_none` — an absent ownership cannot name a form — and every named form belongs to the route's family.
- A `behavior_only` route has `reportedOwnership.state = unknown` **and** `coverage.state = not_applicable`: there is nothing to own and nothing to acquire. Conversely, a product route may never carry `not_applicable`.
- `capabilityVerified` is the reason half of coverage: a form accepted only through `B04` duplicate suppression covers the purchase without proving it can perform the route, so it stays `false` and its guidance stays conditional.

**Which form the card leads with.** The card leads with the **first eligible reported form in the route's binding `recommendedProductTypes` order** — "eligible" meaning the form appears in that array. A reported form outside the eligible set **never leads**; it acts through `coverage` only (`B04`). When no reported form is eligible, the route's own recommended forms lead in their own order. Example: a straight profile reporting `paddle_brush` and `round_brush` on `detangling_foundation` (recommended order `detangling_brush, wide_tooth_comb, paddle_brush`) leads with `paddle_brush`; the `round_brush` is not a foundation form and only suppresses the purchase (fixture 9).

## Need-tier rules

Ownership never creates or removes the underlying need. Aggregate each family independently; then group included results visually.

| Rule ID | Trigger | Output | Precedence and reason facts |
|---|---|---|---|
| `tools.airflow.basis` | `dryingRoutes` contains any blow-dry member (`ordinary_blow_dry` or `diffuser_or_airflow_shaping`) | one drying path = `basis` | choose standard or diffuser path below; wins over optional; every ticked member counts (`D2`) |
| `tools.airflow.diffuser_path` | `dryingRoutes` contains `diffuser_or_airflow_shaping`, or contains `ordinary_blow_dry` plus `hair_texture in {wavy, curly, coily}` and `goals` contains `shape_definition` | diffuser-drying path with required `diffuse_airflow` capability | replaces the standard path for that drying job; texture alone never triggers it; the behaviour answer never proves the capability (`A06`, `D2a`) |
| `tools.airflow.air_shape_basis` | `dryingRoutes` contains a blow-dry member and the volume direction resolves to volume_up (see the volume-direction ruling) | air-shaping approach inside the shared volume/set `basis` | may coexist with the separate drying path; once volume/set is covered, do not add heated/heatless requirements; deduplicate one device that covers both |
| `tools.airflow.optional_goal` | `dryingRoutes = ["air_dry"]` (air-dry only, no blow-dry member) **and** either (`goals` contains `shape_definition` **and** `hair_texture in {wavy, curly, coily}`) or the volume direction resolves to volume_up | matching diffuser or air-shaping path = `optional` | never imply the user should stop air-drying; preserve optional styling support. **Amended 2026-08-24 (`R2`):** the definition disjunct carries the texture gate — `straight` plus `shape_definition` activates no tool route from the definition goal (fixture 4b). The volume disjunct is ungated: a `straight` profile whose direction resolves to volume_up still reaches this rule (fixture 48) |
| `tools.airflow.none` | no airflow basis/optional rule | `not_needed` | ordinary air-drying does not create a dryer purchase |
| `tools.styling.volume_basis` | volume direction resolves to volume_up (inferred predicate, or `concerns` contains `low_volume_or_weighed_down`) | one shared air/heated/heatless volume-set choice = `basis` | present eligible approaches neutrally, prioritize a reported viable route, and count fulfillment once |
| `tools.styling.reported_straighten` | `styling_tools` reports an inherent straightening form | owned product need = `not_needed`; preserve an optional-use routine branch and safe guidance | no proactive straightening shopping or inference from texture, frizz, shine, or a control-resolved volume direction (`D1`, 2026-08-24) |
| `tools.styling.reported_curl_wave` | heated/heatless ownership reports an inherent created curl/wave form | owned product need = `not_needed`; preserve use guidance and one opposite-family optional alternative | `curl_definition` remains natural-pattern support and never activates created-curl tools |
| `tools.styling.none` | volume direction does not resolve to volume_up and no reported inherent straightening/created-style form | heated and heatless = `not_needed` | no supporting route from frizz, shine, density, health, repair, damage, or breakage. **Amended 2026-08-24 (`D1`):** `texture` is struck from this exclusion list — texture and thickness are exactly the two signals the ratified volume-direction predicate reads |
| `tools.brush.foundation` | every profile | one suitable hair-handling method = `basis` | `very_short` may be fully covered by fingers; `short | medium | long | very_long` requires one compatible physical comb/brush and a finger-only answer does not close the product need. The finger case is expressed by the „Nur Finger" option (`D9b`), not by „Nichts davon" |
| `tools.brush.reported_coverage` | any physical brush/comb is broadly reported and no mismatch signal exists | foundation treated as covered; no second product recommendation | this is duplicate suppression, not a verified claim that the form supports every detangling use state |
| `tools.brush.mismatch` | `tangling` or a separately derived friction-heavy brush fact exists | texture-aware core detangling form reopens as the corrected `basis` | existing reported brush may remain for a distinct secondary job; correction wins over broad reported coverage |
| `tools.brush.specialized_optional` | a concrete styling, definition, airflow-shaping, parting, or sectioning job remains uncovered | matching specialized brush/comb = `optional` | never duplicate the foundational method or turn every possible function into another tool requirement |
| `tools.securing.optional` | an included styling, setting, sectioning, application, or Night Protection route has an explicit holding/sectioning step | `optional` | subordinate aid only; otherwise `not_needed` |
| `tools.wash_application.optional` | another confirmed plan occurrence has a real controlled-placement, distribution, shower-detangling, or sectioning job | `optional` | density or length alone never triggers it; otherwise `not_needed` |
| `tools.night.optional_strong` | `concerns` contains `breakage` **or `split_ends`** (`R4`, extended 2026-08-24 for V2 reachability) plus `towel_technique = rough_rubbing` or a separately derived friction-heavy brush fact | `optional` with high relevance | never `basis`; exclude Night Protection ownership from the corroborating stress fact |
| `tools.night.optional_other` | long/very-long hair; concern `breakage | split_ends | hair_damage | tangling | frizz_flyaways`; or goal `frizz_surface | shape_definition | strength_ends | manageability_styling` | `optional` | preserve broad existing reach; reason must use the actual signal and never call it an observed overnight symptom. **Amended 2026-08-24 (`D9c`):** `manageability_styling` joins the trigger set, treated as frizz-adjacent, consistent with the rest of the app. The four legacy goals `healthier_hair | anti_breakage | strengthen | less_split_ends` are one production token, `strength_ends` |
| `tools.night.none` | no named optional signal | `not_needed` | reported ownership still remains visible as a nightly continue-yours routine step but creates no recommendation card |
| `tools.towel.optional_material` | `towel_material = frottee` | `drying_textiles = optional` for microfiber/T-shirt route | technique is more decisive than material |
| `tools.towel.technique` | `towel_technique = rough_rubbing` | firm guidance: press/scrunch gently instead of rubbing | guidance fact, not a mandatory product purchase or `basis` tier |
| `tools.towel.none` | no material-upgrade rule | `not_needed` | still provide ordinary safe drying guidance when relevant |

If a rule depends on a missing required source field, return the conservative lower tier and a missing-input reason fact unless the documented rule states otherwise. Do not combine arbitrary optional signals into `basis`.

### Volume direction (`D1`, ruled 2026-08-24 — formal reversal of a confirmed decision)

This **reverses** `H08` as confirmed on 2026-08-05 and the "no supporting route from … texture …" clause of `tools.styling.none`. It is recorded as a reversal, not a clarification.

- The stored goal token stays merged. The quiz aliases both „mehr Volumen" and „weniger Volumen" onto `volume_balance`, and no migration can recover the direction for existing rows. `volume_balance` is **not** split at the quiz boundary in Phase 1.
- Direction is **inferred in-plan**. The shipped predicate `src/lib/personal-plan/volume-direction.ts` is the app-wide single source of truth and is ratified **exactly as implemented**: `curly | coily | coarse | (wavy with a definition signal)` ⇒ control; everything else ⇒ volume_up. It has **no abstain state** — there is no `null` direction.
- Direction is inferred from **texture and thickness and from nothing else**. Density, surface, elasticity, chemical treatments, frizz, shine, damage, breakage, and mere ownership of a compatible tool remain forbidden as direction signals.
- Every route that reaches its tier through the inference carries the rule ID `tools.styling.volume_direction_inferred` and **says so in its reason payload**. An inferred direction is never presented as something the user stated.
- The concern `low_volume_or_weighed_down` **triggers the volume routes on its own and overrides the inference**: when it is present the direction is lighter / volume_up regardless of texture and thickness. Explicit signal beats inference. This is the same directional reading five shipped care categories already use.
- The two upstream predicates (`src/lib/quiz/normalization.ts`, `src/lib/personal-plan-quiz/offer-adapter.ts`) sit outside the plan, read `density`, and are documented as a separate non-plan concern. Aligning them is explicitly out of scope for Phase 1.
- Restoring directional intent at the quiz boundary is queued as a separate later feature, not part of this decision.

### Drying routes (`D2`, ruled 2026-08-24)

`dryingRoutes` is a **set**, not a dominant method. The "dominant drying method" concept is **retired from this specification**; no rule may ask which drying method dominates.

- **Every ticked route counts.** Each member triggers its own guidance, and heat rules fire if any member carries heat. `["air_dry", "ordinary_blow_dry"]` is a user who does both: the air-dry guidance and the blow-dry route are both real, and the profile is a blow-drying profile for every rule keyed on a blow-dry member.
- **The empty set is removed as an answer.** „Nichts davon" is dropped from the drying question and at least one selection is required. This is a small UI change and goes through the WS4 mockup pass.
- **Legacy stored `[]` is treated as unanswered.** It never falls into the air-dry branch, and it supports no drying-based assumption in either direction.
- **`D2a` — the legacy reading of `diffuser_or_airflow_shaping` is diffuser drying.** Few users are affected and the case was ruled explicitly. `A05` therefore keeps its trigger. Two consequences: `A11`'s diffuser tier (heat protection `not_needed`) applies to this source, so the Stage-2 heat-protection question raised for `diffuser_airflow_shaping` must be aligned with the diffuser tier and reconciled with `D9a`; and the `A06` fix stands regardless — **the behaviour answer never proves diffuser capability**, so `capabilityVerified` must not be set from it and the copy stays conditional.
- **`D2b` — restructuring the option is queued post-Phase-1.** The target design, from the research lane: the option becomes „Mit Diffusor" (Untertitel „Aufsatz für Locken/Wellen"); „Gewöhnlich föhnen" gains the Untertitel „auch mit Rundbürste"; and a follow-up question „Welche Temperaturstufe nutzt du meistens?" (Kalt / Mittel / Heiß) maps to the heat-protection tiers not-needed / optional / empfohlen. It rides the `D8` versioning discipline. Warmluftbürste and Airstyler users stay captured by `additionalHeatTools`.
- Evidence-honesty rule, applying to every drying and heat route: heat-protectant copy stays at „empfohlen/sinnvoll" and never becomes „nötig, sonst Schaden".

### „Nur Finger" (`D9b`, ruled 2026-08-24)

The `Bürsten & Kämme` page gets an explicit **„Nur Finger"** non-product option now, while the feature is unshipped and the migration cost is zero. `D8` discipline applies to the answer shape.

- „Nichts davon" stops doing double duty. „Ich benutze nur meine Finger" and „Ich habe keine Bürste" are different users and are stored as different answers.
- The finger exceptions in `B01`, `B03` and `B04` become expressible: for `very_short` hair „Nur Finger" fully covers the handling foundation and produces no product card; from `short` upward it does **not** close the physical detangling need.
- The card goes through the WS4 mockup pass (mockup review and journey sign-off obtained 2026-08-25; implementation pending).
- **Persisted token, fixed 2026-08-25 (implementation ruling under `D9b` + `D8`): the token is `fingers`.** It matches the value the legacy onboarding enum already uses (`BRUSH_TYPES` in `src/lib/vocabulary/onboarding-care.ts`, label „Nur Finger"), so no second spelling of the same answer exists. It is allowed **only** inside the reported `brushes_combs` set (`toolForms.brushes_combs`). It is **not** a `ToolProductType`: it never appears in `TOOL_PRODUCT_TYPES_BY_FAMILY`, never in a route's `recommendedProductTypes`, never as an asset lead form — it is never recommendable. Adding the key rides the `D8` path-version discipline.

## Route, capability, and reported-use behavior

Stage 1 recommends a job and generic form/capability. A generic recommendation such as `Grobzinkiger Kamm` is valid without an SKU.

When heated and heatless routes can both satisfy the same direct goal:

- show them neutrally in one choice group;
- explain only verified differences such as direct heat, set time, tension/comfort, and practical speed;
- prioritize the broadly reported route, if one exists;
- keep the other route as a genuine alternative;
- ask no preliminary heated-versus-heatless preference question;
- require no one to own both.

### Choice groups are first class (`D5`, ruled 2026-08-24)

A shared need with several eligible approaches is represented by a first-class `ToolChoiceGroup`, not by two competing cards and not by an implicit link between two routes.

- **One card per need.** Members are listed neutrally under a lead like „Eine davon reicht: …".
- **Fulfilled when ANY member is covered.** There is no partial fulfilment: one covered member fulfils the whole group.
- **A reported member always leads** (`D4`), and the group renders with the lead member's ownership state.
- The group mechanism **subsumes** the ad-hoc neutral drying-textile group; that special case is removed rather than kept beside it.

#### The implemented contract (WS1, `contracts.ts` / `assets.ts`)

```ts
ToolChoiceGroup {
  groupKey: `group:${target}`
  target: "volume_set" | "drying_textile"
  tier: "basis" | "optional" | "not_needed"   // the strongest member tier
  memberRouteKeys: ToolRouteKey[]             // ordered: the group's reading order
  fulfilledBy: ToolRouteKey | null            // a member whose coverage is covered
}
```

- **Tier** is the strongest member tier, `basis > optional > not_needed`. A group with one `basis` member is a `basis` group even when its other members are optional.
- **Members** are listed in `memberRouteKeys` reading order; `behavior_only` routes are excluded from every group, and **a route belongs to at most one group** (a route counted in two groups would be counted twice).
- **`fulfilledBy`** is either a member whose `coverage.state` is covered, or `null`. It may never name an uncovered member.
- **Volume group** (`volume_set`) members, in order: `air_shaping_volume`, `heated_volume_set`, `heatless_volume_set`.
- **Textile group** (`drying_textile`) has exactly one member, the `drying_textile_upgrade` route. Its three forms (`microfiber_towel`, `smooth_cotton_cloth`, `drying_wrap`) stay **inside** that route, neutral, in route order — the group does not spread them across members.

**Lead rule.** The lead is `fulfilledBy` when it is set. When `fulfilledBy` is `null` the group renders **neutrally, with no ownership claim at all** — no member leads and no „Nutze deins" (fixtures 35, 47). Among several covered members the order is `covered_by_report` > `covered_by_derived` > `covered_by_selection`; ties inside one coverage state break by member order.

**Precedence against `D6`.** „A reported member leads" operates at **group level** — it selects `fulfilledBy` and therefore the leading member — and it **never reorders any route's `recommendedProductTypes`**. Inside a route, reported forms lead by **filtering**, not by sorting: when at least one eligible reported form exists, only reported forms render, and their order remains the route's own. The rendered form list is always a subsequence of `recommendedProductTypes`.

### Lead-form order is binding (`D6`, ruled 2026-08-24)

The route's `recommendedProductTypes` **order is authoritative**. No downstream dedup, merge, or projection may reorder it — in particular `assetFormsFor` must preserve route order instead of re-sorting through the canonical family order. This is the rule that makes `B02`, `N02`, `W02` and `C02` statable at all; none of them had a governing sentence before.

Enforcement is a rendered-output test per lead-form rule — `B02` fixtures 57 and fixture 59 variant (b), `W02` fixtures 14 and 81, `N02` fixtures 95 and 96, and `C02` fixture 75 — plus an order-stability assertion inside `buildToolPlan`. Route-layer assertions are not sufficient: the reordering defect survived a green suite precisely because it was only tested at the route layer.

**Merged order across routes (`assets.ts`).** Two routes' assets merge into one physical Tool **only when family and lead form are both identical**; different leads never merge. On a merge the **first-emitted route's form order is the base**, and the later route's remaining forms append in their own order (first-occurrence dedup, so no form appears twice and no existing position moves). Route emission order is the fixed deterministic builder sequence, not a per-profile ordering, so the merged result is stable for a given profile.

A diffuser or concentrator is a capability/attachment, not a family. If a user broadly reports a dryer, say to use it if it has the needed capability. If diffuser compatibility is unknown, do not claim compatibility, do not add another question, and do not add a fallback to shopping. Show one concrete verified diffuser-capable example as reference only until the missing route is established. A reported diffuser-drying **behaviour** is not compatibility evidence (`D2a`): it selects the diffuser route but leaves the capability unverified.

A concentrator is a normal, non-critical dryer accessory for route logic. It never creates a route or blocks an otherwise valid standard dryer. Generic guidance may say to use it if available; an exact product card claims package inclusion only when verified.

For the `volume + planned blow-dry` air-shaping path:

- prioritize a broadly reported viable Warmluftbürste, Air Multi-Styler, or Föhn-plus-Rundbürste approach conditionally;
- if none is reported, present the eligible recognizable approaches neutrally inside the shared volume `basis` choice and let the user choose in Stage 2;
- add no hidden profile selector and no new preference question;
- require exact verified `air_shape` and `create_volume` capability before an SKU qualifies;
- one product may cover the linked pre-dry and shaping occurrences; a separate Föhn is needed only when no selected device supplies the required pre-dry capability.

One physical multi-tool may cover several capabilities and appears once. A second product is justified only by a distinct uncovered job, not by the number of product families in the taxonomy.

There is no hard cap on independently relevant `basis` decisions. Render every basis decision after product/capability deduplication. Keep optional families in one collapsed `Optional für dich` section until the user opens it; optional items must never compete visually with the basis list by default.

## Occurrences and application events

| Family | Total occurrence source |
|---|---|
| `airflow` | standard/diffuser drying follows its planned drying events; air shaping compiles a linked `pre_dry` occurrence followed by an `air_shape` occurrence inside one styling session and one shared cadence |
| `heated_styling` | every chosen heated-styling event; `heat_styling` remains the current cadence source |
| `heatless_styling` | each chosen setting event; no numeric weekly cadence is invented |
| `brushes_combs` | relevant detangling/distribution events; optional styling form only inside its styling event |
| `securing_sectioning` | only inside its selected supporting event |
| `wash_application` | only inside the supported wash, scalp-product, or sectioned-application event |
| `night_protection` | nightly only after the form is reported or a saved example is explicitly acquired |
| `drying_textiles` | every wash-drying event; technique guidance remains independent of purchase |

Product allocation never increases event frequency. Optional routes enter executable instructions only after explicit opt-in and, when a product is needed, explicit acquisition.

### Shared day-anchor graph (`D7`, ruled 2026-08-24)

Tool occurrences anchor onto the shared wash-day graph `APPLICATION_SEQUENCE_ANCHORS` — the same ordering the Application compiler already uses — in its **extended 11-position** form. `ToolPlacement` is **derived** from that graph rather than defined separately, so tool steps and product steps interleave correctly by construction instead of being ordered by two mechanisms that drift.

**The effective graph is the extended 11-position graph:** the nine application anchors, extended by `styling_session` and then `nightly`, in that order after `dry_finish`. `nightly` is always last — an existing confirmed invariant. They are explicit members of the one shared graph, not a second parallel ordering. This document, the matrix and the fixtures call it the **extended 11-position graph** consistently:

```text
pre_wash → wet_cleanse → post_cleanse_rinse_off → post_rinse_towel_dry
→ timed_treatment → damp_leave_on → dry_pre_heat → heat_tool → dry_finish
→ styling_session → nightly
```

Ratified per rule:

| Rule | Anchor |
|---|---|
| towel / drying-textile step (the drying-textile occurrence, `T05`'s textile half) | `post_rinse_towel_dry` |
| `T05` plopping | after `damp_leave_on` (i.e. after Leave-in/styling application) and before the drying occurrence (`dry_pre_heat` / `dry_finish`) |
| `B12` detangle, conditioned wet/damp phase (curly/coily and definition-led wavy) | `post_cleanse_rinse_off` |
| `B12` detangle, after partial drying (straight and other wavy) | `post_rinse_towel_dry` |
| `A09` linked pre-dry → air-shape pair | `dry_pre_heat` → `heat_tool` |

**Correction 2026-08-25:** `T05` plopping does **not** anchor at `post_rinse_towel_dry`. That anchor belongs to the towel step (the drying-textile occurrence). Plopping sits after the damp product application and before drying, matching the matrix `T05` row and fixture 112.

**Anchor → `ToolPlacement` derivation.** `ToolPlacement` is not defined separately; it is this projection of the extended graph:

| Anchor | `ToolPlacement` |
|---|---|
| `pre_wash`, `wet_cleanse`, `post_cleanse_rinse_off` | `wash` |
| `post_rinse_towel_dry`, `timed_treatment`, `damp_leave_on` | `post_wash` |
| `dry_pre_heat`, `heat_tool`, `dry_finish` | `drying` |
| `styling_session` | `styling` |
| `nightly` | `nightly` |

The linked air-shaping occurrences remain distinct tool steps but are never counted as independent weekly schedules. Exact product protocol decides starting state and whether pre-drying uses a conventional Föhn, the same device mode/attachment, or a direct dry-and-shape workflow.

**`A09` session contract.** The linked pre-dry and air-shape occurrences share **one parent styling session** through a shared session key and carry **one cadence**; their ordering inside that session comes from the graph (`dry_pre_heat` → `heat_tool`), not from a separate sequence field. WS6 implements the session key on occurrences. That is the whole contract — nothing further about session identity is specified here.

## Multiple products and minimization

- Prefer one product that covers every required capability in the chosen route.
- A single multi-capability product may satisfy airflow and one or more styling capabilities without duplicate cards or shopping entries.
- Pre-drying requires a verified capability, not a separate product identity. Recommend a Föhn plus an air-shaping device only when no one selected product can cover both linked occurrences.
- Show one clear example per missing route/capability.
- Show one alternative only when it represents a genuinely different valid route or practical trade-off, such as heated versus heatless.
- Do not show a grid of similar devices merely to create choice.
- One foundational detangling/distribution tool is enough. Additional styling brushes remain optional.
- Clips, ties, wash/application aids, Night Protection, towel upgrades, and secondary brush roles do not enter shopping until the user explicitly chooses the optional route.

## Canonical product facts and exact example selection

Dryer, heated-tool, air-styler, heatless, brush, accessory, Night Protection, and textile sources feed one canonical tool-product authority. The same physical product has one identity and may expose arrays.

The exact canonical schema and route-level readiness gates live in `product-spec.md`. Required core facts are:

- stable product identity, brand/model, image, source URL, and current price fact;
- `productTypes[]` and `capabilities[]`;
- included or compatible `attachments[]` only when verified;
- route-relevant application protocol and use state (`wet | damp | dry`) when material;
- safety/exclusion facts and hard stop conditions;
- evidence/source provenance and verification state for every decision-changing fact.

Family-specific facts are retained only when they change eligibility, safety, application, or a real user trade-off. Examples include verified temperature control, wet-to-dry compatibility, tension/fit or dimensions, and material/construction. Wattage, ion/ceramic labels, weight, temperature maximum, marketing features, and availability do not automatically become ranking inputs merely because a sheet contains them.

Default card facts are limited to:

1. product identity;
2. job-relevant capabilities or attachments;
3. price.

A verified safety or protocol fact appears on the card only when it changes use. Other verified detail may live in the detail drawer. Availability is not a fit requirement.

Candidate qualification uses the shared four states internally even though owned-tool verdicts are not shown:

- `ideal`: verified required product type/capability, no safety conflict, and compatible required protocol;
- `supportive`: performs the job with one explicit non-critical trade-off;
- `mismatch`: lacks a required capability, conflicts with the required use state, or has a verified exclusion;
- `unknown`: a required capability, compatibility, or safety/protocol fact is missing.

Choose an `ideal` candidate before `supportive`. Never recommend `mismatch` or `unknown` confidently. Among otherwise valid candidates, prefer the broadly reported route, then capability consolidation and lower ownership complexity. Price is shown for choice but does not rank without a confirmed budget input. Missing availability never converts fit.

If no valid example exists, preserve the generic Stage 1 recommendation and show a visible catalog gap. Do not manufacture a product match.

## Stage 2 persistence, shopping, and lifecycle

Persist the chosen exact catalog example with a first-class `capability_example` semantic. It is stable and replaceable, but it is not an owned-product fit verdict, a purchase, or an acquisition claim.

- If the broad route is reported, the example remains reference content on the tool card and stays off the shopping list.
- If the route is explicitly absent, the example may enter the consolidated shopping list.
- If reported use is `null`, keep wording conditional and do not silently add or suppress a shopping item.
- Saving a plan or opening a shop link never means acquired.
- A missing-route example enters executable Stage 3 instructions only after explicit acquisition.
- An optional route enters shopping/acquisition only after explicit opt-in.
- If the saved example later becomes invalid, unavailable by explicit catalog policy, or is replaced by a better verified match, create a proposed successor plan; do not silently mutate the confirmed plan.

Exact owned-tool submissions, pending review, keep, replace, and informed-override flows are not applicable to V1 Hair Tools. Broad reported use remains profile context only.

### Versioning of persisted refinement answers (`D8`, ruled 2026-08-24 — standing rule)

**Any change to a persisted refinement answer key, or to the meaning of the completion predicate, requires a path-version bump plus a decoder. Completed rows validate against their completion-time contract, never against today's.**

This is a standing rule for the whole refinement surface, not a Tools-local convention. It governs every answer-shape change this document queues — the „Nur Finger" option (`D9b`), the removal of „Nichts davon" from the drying question (`D2`), and the `D2b` drying restructure.

Enforcement is a **schema-snapshot test that fails when a persisted key is added, renamed, or removed without a version bump**. A rule with no enforcement is how the key rename and the completion-predicate change both slipped through. WS5 has already encoded the load-time half.

## Conservative application fallbacks

Verified exact-product directions override the category fallback. Never invent temperature, time, distance, pass count, dose, compatibility, or tension.

### Airflow

- Use the chosen attachment/capability only when compatible with the device.
- Prefer lower or moderate heat and avoid prolonged heat on one area.
- Do not fabricate a universal dryer distance or airflow setting.
- A diffuser route may preserve pattern/shape, but does not guarantee damage prevention or anti-frizz.
- For air shaping, preserve two linked tool steps but follow the exact product's starting-state, pre-dry, attachment, and sequence directions; never invent a universal dryness percentage.
- Heat-protection tier is `not_needed` for ordinary dryer/diffuser use and `optional` for airflow shaping, including Föhn plus Rundbürste. Exposure-minimization guidance still applies. An exact verified protocol that requires Heat protection promotes coverage to `basis`. **Amended 2026-08-24 (`D9a`):** the tier is evaluated **per heat event**, and whether the dependency is already covered is read from that event's `protectionConsistency` — only `always` counts as covered.

### Heated styling

- Apply suitable Heat protection according to its verified directions. Coverage is judged per heat event from `protectionConsistency` (`D9a`); a `sometimes` answer receives a consistency nudge in the register of „mach's konsequent" at tier „empfohlen", never an accusation and never „nötig, sonst Schaden".
- Use on dry hair unless the exact device is verified and directed for another state.
- Prefer the lowest effective verified setting and avoid unnecessary repeated passes or prolonged contact.
- Stop for burning, pain, scalp irritation, or device malfunction.

### Heatless styling and securing

- Keep the set secure but not painful or persistently tight.
- Avoid repeated pulling at the hairline.
- More wear time or tighter tension is not automatically better.

### Brushes and combs

- Detangle and distribute gently; do not infer technique from the selected product form.
- Do not impose one universal wet/dry rule: tightly curled or textured hair may require wet detangling, while other profiles may benefit from reduced wet handling.
- Section only as much as needed for even, comfortable work.

### Wash/application tools

- Use gently and only for the supported placement/distribution job.
- Do not use hard or abrasive scalp tools on irritated, inflamed, wounded, pustular, or persistently symptomatic scalp.
- Do not promise growth, anti-shedding, or medical treatment.

### Night Protection

- Present as optional low-friction, containment, comfort, or style-preservation support.
- Keep roots and hairline loose and pain-free; do not stack several products by default.
- Never claim repair, split-end reversal, growth, or prevention of all breakage.

### Towels and drying textiles

- Press, blot, or scrunch gently instead of rubbing.
- Microfiber or a T-shirt is an optional aid, not a universal requirement.
- Technique guidance remains active even when no new textile is recommended.

## Safety and uncertainty boundaries

Safety precedes fit and product consolidation.

- Persistent pain, tightness, stinging, crusting, visible hairline breakage, patches, or progressive recession suppress optimization and require appropriate medical guidance.
- Sudden shedding, patchy loss, inflammation, wounds, pustules, or persistent scalp symptoms are outside cosmetic tool optimization.
- `Heatless` never means risk-free when the route creates tension.
- Wet-to-dry use requires verified product-specific directions.
- No tool may be described as repairing existing structural damage or reversing split ends.
- Ion, ceramic, wattage, material, or marketing labels do not prove anti-frizz or damage prevention without verified evidence.
- Microneedling, laser/LED growth devices, scalp-cooling systems, cutting tools, extensions/wigs, and water-treatment devices are outside V1.

Weak or missing evidence lowers claim strength or keeps a route optional; it never becomes a hard rule through marketing language.

## Structured reasoning payload

Preserve, per family:

- need tier and matched rule IDs;
- decisive canonical inputs and missing inputs;
- job, generic form, required capabilities, and route alternatives;
- `reportedOwnership` (including whether it is `derived` from a care behaviour) and `coverage`, kept as two separate facts (`D4`);
- reported-use state and its conditional effect on route priority/copy;
- when the volume direction was inferred, the marker `tools.styling.volume_direction_inferred` and the signals it used (`D1`);
- choice-group membership and which member fulfilled the group (`D5`);
- occurrence source, shared day anchor, and chosen event (`D7`);
- saved `capability_example`, shopping/acquisition state, and any catalog gap;
- candidate eligibility, limitations, mismatches, unknown facts, and evidence provenance;
- application fallback or exact-product protocol source;
- uncertainty, rejected inferences, safety boundaries, and relevant cross-category coverage.

The default card displays the confirmed minimal subset. Expanded explanation may expose additional reason facts, but an LLM may only verbalize them and may not change the deterministic result.

## Confirmed fixture matrix

1. `tools-airflow-blow-dry`: `drying_method = blow_dry` -> airflow `basis`; reported dryer yields conditional use-first copy.
2. `tools-airflow-diffuser`: `drying_method = blow_dry_diffuser` -> airflow `basis`; diffuser is a required capability, not a separate family.
3. `tools-airflow-air-dry`: ordinary `air_dry`, no styling goal -> `not_needed`.
4. `tools-airflow-air-dry-definition`: `air_dry + shape_definition` **plus `hair_texture in {wavy, curly, coily}`** (`R2` texture gate) -> airflow `optional`, never a forced dryer purchase. Fixture 4b is the negative: `straight + shape_definition + air_dry` activates no tool route from the definition goal — no diffuser path and no Definitionsbürste.
5. `tools-styling-natural-definition-boundary`: `curl_definition` -> no heated/heatless curl-creation need; natural-pattern support stays with diffuser/definition routes.
6. `tools-styling-volume-choice`: `goals` contains `volume_balance` and the direction **resolves to volume_up** (inferred predicate per `D1`, or `concerns` contains `low_volume_or_weighed_down`, which triggers on its own and overrides the inference) -> one shared `basis` choice group across eligible air-shaping, heated, and heatless approaches; fulfillment once suppresses additional required tools.
7. `tools-styling-control-direction-negative`: `volume_balance` resolving to `control` (e.g. curly/normal, no definition goal, no weighed-down concern) -> no `volume_basis` route, no Basis card (rewritten 2026-08-24 under `D1`).
8. `tools-styling-reported-without-goal`: reported curling iron but no explicit desired-style goal -> owned product need remains `not_needed`; preserve use guidance and show a heatless alternative only as optional.
9. `tools-brush-foundation`: `hair_length = medium` -> one physical detangling `basis`; two reported physical forms normally suppress another purchase and never create two basis cards.
10. `tools-brush-very-short-fingers`: `very_short`, no concrete mismatch -> universal handling foundation is covered by fingers with no product card.
11. `tools-brush-very-short-job`: `very_short + tangling` -> reopen a texture-aware physical detangling correction; fingers do not silently cover the concrete mismatch.
12. `tools-accessory-subordinate`: heatless setting route -> clips/ties may be `optional`, never `basis`.
13. `tools-wash-aid-no-job`: high density/long hair without a plan occurrence needing placement -> `not_needed`.
14. `tools-wash-aid-supported`: confirmed sectioned scalp-product application -> wash/application aid `optional`.
15. `tools-night-strong-optional`: `breakage + rough_rubbing + night_protection = []` -> high-relevance `optional`, never `basis`.
16. `tools-night-long-only`: long hair alone -> weak `optional` with no invented overnight symptom.
17. `tools-night-no-signal`: no named signal -> `not_needed` even if reported use remains visible.
18. `tools-night-null`: relevant signal plus `night_protection = null` -> same need tier with unknown-use conditional copy.
19. `tools-night-reported`: relevant signal plus reported bonnet -> prioritize bonnet conditionally; no exact fit claim or second product by default.
20. `tools-towel-rub`: rough rubbing -> firm technique correction; no mandatory purchase.
21. `tools-towel-terry`: `frottee` -> microfiber/T-shirt `optional`; no universal superiority claim.
22. `tools-multicapability-once`: one multi-styler covers airflow and curl capabilities -> one catalog identity/card.
23. `tools-route-reported-reference`: broad dryer route reported -> saved example is reference only, not shopping.
24. `tools-route-explicit-none-shopping`: broad route explicitly absent -> one saved example may enter shopping; not active until acquired.
25. `tools-route-unknown`: reported-use `null` -> no invented ownership and no silent shopping transition.
26. `tools-optional-opt-in`: optional Night Protection example enters shopping only after explicit selection.
27. `tools-example-no-match`: all candidates mismatch or unknown -> generic recommendation plus visible catalog gap.
28. `tools-safety-tension`: pain/tightness warning -> suppress tension-bearing optimization and show safety boundary.
29. `tools-safety-wet-heat`: heated device lacks verified wet-use protocol -> dry-use fallback; no wet-to-dry claim.
30. `tools-recompute`: changing broad reported use changes route priority/reference-shopping state but not the family need tier.
31. `tools-salience-many`: a profile with airflow, styling, and brush basis results shows all three after deduplication; optional Night Protection, clips, and towel upgrade remain in one collapsed section.
32. `tools-airflow-goal-diffuser`: `blow_dry + wavy/curly/coily + curl_definition` -> diffuser path `basis`; no claim that the user already diffuses.
33. `tools-airflow-diffuser-unknown-owned`: reported dryer plus required diffuser with unknown compatibility -> conditional use-first copy and verified reference example, no question and no shopping item.
34. `tools-airflow-volume-basis`: `volume_balance` resolving to volume_up (inferred per `D1`, or via the `low_volume_or_weighed_down` override) plus a planned blow-dry route -> independent air-shaping `basis`; frizz/shine do not trigger it.
35. `tools-airflow-shape-unreported-choice`: no viable air-shaping approach reported -> neutral Stage 2 choice among eligible Warmluftbürste, Air Multi-Styler, and Föhn-plus-Rundbürste approaches, no profile-derived default.
36. `tools-airflow-shape-reported`: one air-shaping form reported -> prioritize it conditionally without judging the exact unidentified device.
37. `tools-airflow-linked-occurrences`: pre-dry and air-shape are two ordered occurrences with one parent styling-session cadence, never two inferred weekly schedules.
38. `tools-airflow-one-device-two-uses`: verified Air Multi-Styler covers pre-dry and volume shaping -> one product identity/card fills both linked occurrences.
39. `tools-airflow-two-device-gap`: focused Warmluftbürste cannot cover required pre-dry and no Föhn is reported -> recommend the minimal second pre-dry product/capability.
40. `tools-airflow-heat-protection-tiers`: standard/diffuser -> Heat protection `not_needed`; air shaping -> `optional`; an exact required protocol promotes coverage to `basis`.
41. `tools-airflow-concentrator-nongate`: otherwise valid Föhn without a verified concentrator fact remains eligible; the card does not claim package inclusion.
42. `tools-heated-reported-flat-iron`: reported Glätteisen -> owned-tool guidance and optional post-wash branch; no proactive product/shopping need.
43. `tools-heated-no-straightening-intent`: no reported Glätteisen -> no straightening/smoothing tool route, even with frizz, shine, a control-resolved volume direction, or straight texture (restated 2026-08-24 under `D1`).
44. `tools-created-curl-definition-boundary`: `curl_definition` without a reported curl-creation tool -> no Lockenstab or Heatless-Lockenband recommendation.
45. `tools-created-curl-reported-heated`: reported Lockenstab/Welleneisen -> use the owned form first and show one heatless approach below as optional; do not assign an invented cadence.
46. `tools-created-curl-reported-heatless`: reported heatless form -> prioritize it and keep the heated form as an optional alternative; the family drilldown never creates a new goal.
47. `tools-volume-blow-dry-approaches`: `volume_balance` resolving to volume_up (inferred, or via the `low_volume_or_weighed_down` override) plus a planned blow-dry route -> one shared need may compare air shaping, heated setting, and heatless setting; only one must be fulfilled.
48. `tools-volume-air-dry-approaches`: `volume_balance` resolving to volume_up (inferred, or via the `low_volume_or_weighed_down` override) plus air-dry only -> heated and heatless are main neutral approaches; air shaping stays optional because it would add blow-drying.
49. `tools-styling-ambiguous-owned-capability`: broadly reported Multi-Styler/Heizbürste with unknown exact volume capability -> conditional use-yours plus verified reference, never assumed coverage or duplicate shopping.
50. `tools-direct-heat-protection-covered`: selected direct-contact heated route whose event reports `protectionConsistency = always` -> dependency fully covered for that event and no duplicate Heat-protection recommendation; no exact protection-temperature claim. (Rewritten 2026-08-24 per `D9a`.)
51. `tools-direct-heat-protection-missing`: selected direct-contact heated route whose event reports `protectionConsistency = no` or `unsure` -> Heat protection remains an uncovered `basis` dependency for that event; `sometimes` instead yields the consistency nudge at tier „empfohlen". (Rewritten 2026-08-24 per `D9a`.)
52. `tools-heated-contact-mode`: continuous-pass tool -> explicit keep-moving guidance; stationary-by-design tool -> verified hold/set-and-release guidance instead.
53. `tools-heatless-protocol-unknown`: exact heatless candidate missing supported use state, securing/setup, or applicable sequence/duration -> candidate remains `unknown` and cannot be confidently recommended.
54. `tools-styling-optional-every-wash`: selected styling method appears after every wash as an explicitly optional branch; its presence never asserts completion on every wash day.
55. `tools-airflow-manual-round-brush`: `volume_balance` resolving to volume_up (inferred, or via the `low_volume_or_weighed_down` override) plus a planned blow-dry route, with a reported Föhn and compatible Rundbürste -> prioritize the manual approach, reuse the Föhn for drying, and do not add another volume tool requirement.
56. `tools-brush-short-fingers-only`: `short+` plus reported fingers and no physical brush/comb -> physical detangling foundation remains uncovered.
57. `tools-brush-straight-default`: straight `short+` with explicitly no brush -> Detangling-Bürste is the one saved foundational form.
58. `tools-brush-curly-coily-default`: curly/coily `short+` with explicitly no brush -> Grobzinkiger Kamm is the one saved foundational form.
59. `tools-brush-wavy-map`: wavy plus `curl_definition` -> Grobzinkiger Kamm; other wavy -> Detangling-Bürste; never require both.
60. `tools-brush-any-reported-physical`: reported Round-, Paddle-, boar-bristle, Detangling-Bürste, or comb without mismatch -> suppress another foundational purchase without granting unverified detangling/use-state claims.
61. `tools-brush-reported-mismatch`: reported styling/smoothing brush plus tangling or friction-heavy brush fact -> reopen texture-aware detangling correction while preserving the original tool for its legitimate job.
62. `tools-brush-unknown-ownership`: `brush_type = null` -> foundation need remains, but ownership/shopping stays conditional and no silent purchase transition occurs.
63. `tools-brush-explicit-none`: `brush_type = []` for `short+` -> the saved texture-aware foundation may enter shopping; guidance becomes exact only after acquisition.
64. `tools-brush-routine-placement`: curly/coily/definition-led wavy detangle in conditioned wet/damp phase; straight/other wavy after partial drying; very-short fingers create no separate step.
65. `tools-brush-round-volume`: selected Föhn-plus-Rundbürste volume approach -> link to the shared pre-dry/air-shape session, reuse the dryer, and do not add another volume need.
66. `tools-brush-definition-optional`: `shape_definition` **plus `hair_texture in {wavy, curly, coily}`** (`R2` texture gate) -> Definitionsbürste may appear collapsed as optional; texture alone and catalog presence never activate it, and `straight + shape_definition` activates nothing.
67. `tools-brush-pick-optional`: under `D1` `curly`/`coily` resolve to **control**, so the surviving trigger is `concerns` contains `low_volume_or_weighed_down` (which overrides the inference) plus `curly`/`coily` -> Pick may appear as one collapsed optional root-volume approach, not another required volume product.
68. `tools-brush-reported-dry-style`: reported Paddle-/Vent-/Pneumatik form with no selected parent job -> use-yours/reference guidance only, no new purchase or cadence.
69. `tools-brush-sectioning-parent`: selected styling/application event with a real parting step -> Stielkamm optional inside that event; no standalone need or fixed section count.
70. `tools-brush-minimal-facts`: exact brush lacks a route-relevant use-state or verified blow-dry use when heat-assisted -> `unknown`; missing geometry/material/bristle measurements do not block V1.
71. `tools-securing-no-parent`: long/dense hair or reported catalog availability without a named parent event -> Clips/Ties `not_needed`.
72. `tools-securing-sectioning-parent`: selected styling/application step needs sectioning -> one Sectioning-Clip route is collapsed optional; no bundle.
73. `tools-securing-root-volume-parent`: `volume_balance` resolving to volume_up (inferred, or via the `low_volume_or_weighed_down` override) plus a selected root-clipping approach -> one Root-Volume-Clip route is collapsed optional, never another volume basis.
74. `tools-securing-night-owner`: selected Night Protection loose-tie route -> soft tie/Scrunchie is owned by Night Protection and cannot produce a duplicate Clips/Ties card.
75. `tools-securing-many-parents`: several eligible parent events -> one merged collapsed Clips/Ties result and at most one Stage 2 example.
76. `tools-securing-reported-compatible`: compatible broad securing form reported -> use-yours guidance; no additional example/purchase unless a distinct uncovered parent form remains selected.
77. `tools-securing-optional-lifecycle`: unreported optional example -> no executable occurrence or active guidance until explicit opt-in and acquisition.
78. `tools-securing-tension-fallback`: selected clip/tie route -> only-as-tight-as-needed guidance; pulling or pain tells the user to loosen/reposition/remove, without assuming current misuse.
79. `tools-securing-set-support-deferred`: parent styling set has unresolved required clip/pin behavior -> no mandatory accessory output and parent exact route remains unready pending Stage 2 protocol decision.
80. `tools-wash-no-parent`: long/dense hair, oily scalp, dandruff, or hair-loss signal without an allowed parent event -> Wash/Application `not_needed`.
81. `tools-wash-targeted-application`: selected targeted scalp-product application with no reported applicator -> one applicator-bottle route is collapsed optional.
82. `tools-wash-reported-applicator-comb`: targeted application plus reported applicator comb -> use it first; no bottle recommendation.
83. `tools-wash-refresh`: selected between-wash curl/wave refresh -> water spray bottle may be the one collapsed optional example.
84. `tools-wash-many-parents`: targeted application plus refresh -> one merged card; applicator example wins priority and spray remains generic guidance.
85. `tools-wash-reported-scalp-brush`: reported scalp brush without a proactive parent -> use-yours gentle guidance only, no new purchase or growth claim.
86. `tools-wash-scalp-signal-no-brush`: irritated/oily/flaky scalp without reported scalp brush -> no proactive scalp-brush recommendation.
87. `tools-wash-shower-detangler-dedup`: wet detangling need -> Brushes/Combs foundation owns the product and occurrence; Wash/Application emits nothing.
88. `tools-wash-sectioning-dedup`: scalp-product application already covered by Stielkamm/Sectioning-Clip -> no duplicate sectioning aid.
89. `tools-wash-optional-lifecycle`: unreported optional applicator/spray example -> no executable occurrence until opt-in and acquisition.
90. `tools-wash-minimal-facts`: exact example with identity/type/job but no material/cleaning/geometry details remains eligible; wrong/unknown job remains ineligible.
91. `tools-night-broad-health-goal`: `healthier_hair`, `strengthen`, or `anti_breakage` alone -> Night Protection may appear optional, never basis.
92. `tools-night-high-order`: breakage plus independent rough-rubbing/friction-heavy brush signal -> same optional tier, ordered/explained with higher relevance.
93. `tools-night-no-signal-unreported`: no trigger and no reported method -> `not_needed`, no card or routine occurrence.
94. `tools-night-no-signal-reported`: no trigger plus reported pillow/bonnet/sleeve/method -> preserve nightly continue-yours step, no optional need or shopping card.
95. `tools-night-default-sleeve`: long/very-long plus breakage/split ends/tangling and no reported form -> length/tip sleeve is the one main form.
96. `tools-night-default-bonnet`: wavy/curly/coily plus `curl_definition`, without higher-priority length/end case or reported form -> bonnet is the one main form.
97. `tools-night-default-pillow`: any other eligible unreported case -> pillowcase is the one simplest main form.
98. `tools-night-reported-alternative`: reported form remains primary; one mapped form may appear only when it provides a genuinely different function.
99. `tools-night-null-ownership`: trigger plus `night_protection = null` -> optional relevance remains, but ownership and shopping stay conditional/reference-only.
100. `tools-night-explicit-none`: trigger plus `night_protection = []` -> one optional example may enter shopping after opt-in; nightly occurrence waits for acquisition.
101. `tools-night-exact-facts`: missing material, intended coverage, or worn-form closure/adjustability where required -> exact candidate `unknown`; detailed dimensions/thread count are not required.
102. `tools-night-soft-tie-dedup`: selected loose-securing method -> one soft tie/Scrunchie is subordinate and owned by Night Protection, never a second Clips/Ties card.
103. `tools-night-guidance-boundary`: selected form -> comfortable coverage and loosen/remove-on-pulling guidance; no repair, growth, split-end reversal, or guaranteed prevention claim.
104. `tools-textile-frottee-choice`: `frottee` -> one neutral optional group containing microfiber towel, smooth cotton cloth/T-shirt, and drying wrap; no texture-derived ranking.
105. `tools-textile-rubbing-any-material`: `rough_rubbing` with any reported material -> firm press/scrunch guidance only; no mandatory product.
106. `tools-textile-reported-suitable`: reported microfiber towel, smooth cotton cloth/T-shirt, or wrap -> use yours and no duplicate purchase.
107. `tools-textile-no-towel`: `no_towel` -> no textile product, no rubbing assumption, and no plopping route.
108. `tools-textile-plop-default`: wavy/curly/coily plus `curl_definition` -> plopping is a default wash-routine technique.
109. `tools-textile-plop-no-towel-override`: the same definition profile plus explicit `no_towel` -> no plopping step or textile recommendation.
110. `tools-textile-plop-owned`: active plopping route plus reported suitable T-shirt/wrap -> execute with the owned form and recommend no product.
111. `tools-textile-plop-unreported`: active plopping route with unknown/no suitable form -> technique remains executable with an ordinary suitable T-shirt; one wrap may appear only as optional convenience.
112. `tools-textile-plop-placement`: active plopping route -> after relevant Leave-in/styling application and before air- or diffuser-drying; no universal duration.
113. `tools-textile-neutral-options`: multiple eligible textile forms -> no profile input ranks material/form quality; reported form wins, otherwise the user chooses.
114. `tools-textile-null-ownership`: optional upgrade plus unknown ownership -> conditional/reference output and no silent shopping transition.
115. `tools-textile-minimal-facts`: exact example with identity/type/job remains eligible without dimensions, absorbency, weight, thickness, fabric grading, or closure facts.
116. `tools-onboarding-submitted-unchecked`: submitted family overview with an unchecked family -> persist explicit none/empty for that family.
117. `tools-onboarding-unanswered`: migrated or newly eligible user who never submitted the overview -> preserve `null`, never infer none.
118. `tools-onboarding-simple-type`: selected Clips/Ties, Wash/Application, or Drying Textiles product type -> inherit that simple type's generic capabilities but no exact-product claims/protocol.
119. `tools-onboarding-complex-type`: selected Brushes/Combs, Night Protection, airflow, heated, or heatless product type -> preserve reported ownership, while route-critical exact capability remains unknown and conditional where required.
120. `tools-owned-visible`: a real included need covered by reported ownership -> keep the card in normal plan order as `Nutze deins`, with no shopping action and the relevant routine occurrence preserved.
121. `tools-simple-card-other-product`: exact Stage 2 recommendation inside Clips/Ties, Wash/Application, or Drying Textiles plus `I use another product of this type` -> mark the named generic type/capability covered; never inherit exact-SKU claims or instructions.
122. **RETIRED 2026-08-24 (`D9a`)** — `tools-heat-protection-completed-false` described an impossible situation: production never defaults `protectionConsistency`, and the legacy `uses_heat_protection` boolean is not read.
123. **RETIRED 2026-08-24 (`D9a`)** — `tools-heat-protection-incomplete-default`, same reason.

The executable form of this matrix, in production field names and values, is `docs/personal-plan/categories/tools/fixtures.md`. Rulings of 2026-08-24 that change expected outcomes above: `D1` (fixtures 6, 34-36, 47, 48, 55, 65, 67, 73 gain the ratified predicate plus the `low_volume_or_weighed_down` trigger/override), `D2a` and the mixed-set/empty-set rules (fixtures 1-4, 32), `D3a` (fixture 116 — unticked stays explicit none, now with preselection), `D6` (lead forms in fixtures 57, fixture 59 variant (b), 14, 81, 95, 96 and — for `C02` — 75 are rule-specified and binding), and `D9b` (fixtures 10, 11, 56, 64 become expressible through the „Nur Finger" option, whose persisted token is `fingers`).

Three fixture numbers were added on 2026-08-25 during the counterpart-review reconciliation; they live in `fixtures.md` with the rest of the executable table, and numbers are never reused or renumbered:

124. `tools-onboarding-merge-per-form`: a care-reported `straightener` plus an answered heated-styling Tool page reporting `curling_iron` -> the family's forms are the **union**, the care-derived straightener evidence survives, nothing is deleted (`D3c`), and provenance records the stronger `reported` (`D4`).
125. `tools-heat-protection-legacy-diffuser-value-ignored`: a completed Stage-2 row whose `heatEvents` still carry `protectionConsistency` for the diffuser source loads **complete**, the stored value is **ignored**, and no recommendation derives from it (`R1` + `D8`).
126. `tools-night-manageability-trigger`: `goals = ["manageability_styling"]` with no other Night trigger -> `optional` on `night_protection` with `tools.night.optional_other` and the `N02` lead form (`D9c`).

Implementation must add regression coverage showing Shampoo, Conditioner, Leave-in, shared coverage, shopping, acquisition, and proposed-plan mechanics remain unchanged.

## Deferred dependencies and confirmation

Category blockers:

- all eight category passes and cross-category ownership/readiness rules are complete;
- the WS4 evidence review and user-journey sign-off were **obtained on 2026-08-25** (mockup evidence `plans/mockups/ws4-2026-08-25/`); the lead copy, the drying-question change and the „Nur Finger" / Wildschweinborsten cards are ratified and only their **implementation** is pending;
- the production-current Stage 1/direct-accept placement requires current mockup review and journey sign-off;
- the production-current plan requires final counterpart review before implementation.

Catalog/data gaps:

- implement one canonical multi-capability tool product specification and intake path;
- ingest verified product types, capabilities, attachments, price, decision-changing safety/application facts, and provenance;
- combine current dryer and heat/multi-tool research sheets without duplicating product identity;
- enable an exact Stage-3 card only when a verified valid example exists; a deterministic generic refined route may remain visible with the confirmed catalog-gap state.

Shared cross-category dependencies:

- final plan-wide function ownership and optional-card salience;
- final database shape for grouped route-specific reported-use answers;
- shared proposed-plan delta and example-replacement mechanics.

Confirmation status:

- the original category policy and mockup directions were confirmed by Nick;
- airflow route decisions `A01` through `A11` were confirmed and reconciled on 2026-08-05;
- heated/heatless route decisions `H01` through `H17` were confirmed and reconciled on 2026-08-05;
- Brushes/Combs route decisions `B01` through `B13` were confirmed and reconciled on 2026-08-05;
- Clips/Ties decisions `C01-C04` and `C06-C07` were confirmed and reconciled on 2026-08-05; exact set-support compatibility `C05` is deferred to Stage 2;
- Wash/Application decisions `W01-W04` were confirmed and reconciled on 2026-08-05;
- Night Protection decisions `N01-N06` were confirmed and reconciled on 2026-08-05;
- drying-textile decisions `T01-T06` were confirmed and reconciled on 2026-08-05;
- shared ownership/readiness decisions `D12` and `D14` were confirmed and reconciled on 2026-08-05;
- legacy Heat-protection compatibility was explicitly resolved on 2026-08-05 (completed false trusted, incomplete pre-question false unknown) and **reversed on 2026-08-24 by `D9a`**: the legacy boolean stays unread and coverage is read per heat event from `protectionConsistency`;
- Nick ruled the nine open spec gates `D1`-`D9` on 2026-08-24; the ledger is `plans/2026-08-24-hair-tools-d1-d9-rulings.md`. Two of them are **formal reversals of previously confirmed decisions**: `D1` reverses `H08`'s "never infer volume direction", and `D9a` reverses the `I01` legacy-boolean exception. The remaining rulings (`D2`-`D8`, `D9b`, `D9c`) settle gaps rather than reverse decisions;
- the user-facing gates for WS4 are **cleared**: the `D3a` lead copy („Wähle die Bereiche, aus denen du schon Produkte hast. Nicht gewählt = hast du nicht."), the removal of „Nichts davon" from the drying question, and the „Nur Finger" plus Wildschweinborsten cards passed evidence review and journey sign-off on 2026-08-25; their implementation is still outstanding. Any **further** Stage-1 card change still needs its own mockup review plus journey sign-off before implementation;
- the refreshed A1-A2-B-C-D mockup and full designed journey were approved by Nick on 2026-08-05;
- the delegated external evidence review supporting airflow and Heat-protection decisions is complete for the current planning scope;
- the original complete-matrix counterpart review and the 2026-08-20 production-shape plan review were reconciled; the current Phase-1/Phase-2 scope choice remains with Nick;
- Nick explicitly confirmed the complete onboarding -> Stage 1 -> Stage 2 -> Stage 3 designed journey on 2026-08-04;
- the progressive ownership drilldown and optional every-wash styling branch remain confirmed;
- implementation readiness: the WS4 mockup review and journey sign-off are **done (2026-08-25)** and the counterpart-review reconciliation of this document set is complete; what remains is the WS4 implementation itself and the production-shape reconciliation tracked in `plans/2026-08-12-personal-plan-hair-tools-current-shape.md`.
