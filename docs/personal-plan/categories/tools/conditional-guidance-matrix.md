---
category: tools
document_type: conditional_guidance_decision_tracker
status: confirmed
matrix_version: 2
last_updated_at: 2026-08-24
decision_file: docs/personal-plan/categories/tools/decision.md
product_spec_file: docs/personal-plan/categories/tools/product-spec.md
option_pool_file: docs/personal-plan/categories/tools/option-pool.md
input_mapping_file: docs/personal-plan/categories/tools/input-mapping.md
fixture_file: docs/personal-plan/categories/tools/fixtures.md
rulings_file: plans/2026-08-24-hair-tools-d1-d9-rulings.md
plan_file: plans/2026-08-12-personal-plan-hair-tools-current-shape.md
---

# Hair Tools conditional-guidance matrix — decision tracker

## Purpose

This is the working tracker for turning the confirmed Hair Tools structure into an engine-ready matrix. It records what has already been decided, what still needs a product decision, and the order in which Nick and Codex will settle the remaining details.

It does **not** replace the visible product hierarchy:

```text
Hair Tools
└── Product category
    └── Recognizable product type
        └── Exact product example
```

Jobs and routine events are internal mappings. They decide why, when, and how a product type appears; they never become user-facing category names.

`decision.md` remains the final policy authority. Confirmed results from this grilling pass must be reconciled into that document and its fixtures before implementation. This tracker remains the durable decision log and completeness checklist.

The implemented baseline now has five stages. Older matrix labels map as follows without changing any confirmed rule: broad ownership/refinement is Stage 2, exact examples are Stage 3, routine occurrences are Stage 4, and application guidance is Stage 5. The additive asset/occurrence contract needed for one-card multi-tool deduplication is authoritative in the Hair Tools implementation plan.

## Planning contract

### Outcome

For every enabled Hair Tools product route, the engine can deterministically answer:

1. Which product category and recognizable product type are relevant?
2. Which existing input or already-selected plan event activated it?
3. Is it `basis`, `optional`, or `not_needed`?
4. Does reported use prioritize an existing route, leave it unknown, or create a missing-route shopping example?
5. In which routine event does the tool appear, and how often does that event occur?
6. Which proactive application guidance is safe without assuming the user's current technique?
7. Which exact-product facts may override the generic guidance?
8. Which missing fact, safety condition, or cross-category dependency blocks execution?
9. Which reason facts and fixtures prove the result?

### Constraints

- Reuse current routine/profile inputs. Add no question merely to personalize copy or discover unobserved technique.
- Explicitly captured towel rubbing versus gentle handling remains the narrow behavior exception.
- Application guidance is proactive after the route is reported or the recommended product is explicitly acquired; it does not claim the user already follows it.
- Exact verified manufacturer protocol overrides a generic category fallback.
- Never invent temperature, duration, distance, pass count, dose, tension, compatibility, preference, curiosity, or ownership.
- Product category and product type remain visible; purpose is a mapped reason.
- One physical multi-capability tool is stored and shown once.
- Heated and heatless options stay neutral when both genuinely cover the same selected job.
- No implementation, Sheet editing, product publication, catalog write, or database change is authorized by this tracker.

### Completion condition

The matrix is ready for implementation only when:

- the shared decisions below are `confirmed` or explicitly `deferred`;
- every enabled category has a complete set of matrix entries at the chosen grain;
- each entry names activation, occurrence, guidance, product-fact readiness, unknown behavior, safety handling, and fixtures;
- cross-category ownership has no duplicate or uncovered guidance;
- the reviewed mockup and designed journey reflect the final behavior;
- `decision.md`, `product-spec.md`, and the main plan contain the reconciled result.

## Status legend

| Status | Meaning |
|---|---|
| `confirmed` | Nick has decided it; do not re-grill unless new evidence creates a contradiction |
| `proposed` | Codex has a recommended direction; Nick has not yet confirmed it |
| `open` | A consequential product decision remains |
| `partial` | The governing principle is confirmed, but category-level details remain |
| `deferred` | Deliberately moved to a named later stage with a safe V1 fallback |
| `not_applicable` | Explicitly excluded from V1 |
| `confirmed, amended <date>` | Still confirmed, but its wording was changed on that date; the amendment note states what changed |
| `confirmed, reversed <date>` | Nick reversed a previously confirmed decision on that date; the entry keeps its ID and records both the old and the new rule |

## Progress dashboard

| Workstream | Current state | Next decision |
|---|---|---|
| Shared contract | all 14 decisions confirmed | complete for current grilling pass |
| Haartrockner & Luftstyler | 3 route rows and 11 decisions confirmed/reconciled | complete for current grilling pass |
| Hitzestyling-Tools | 3 route rows and `H01-H17` confirmed/reconciled | complete for current grilling pass |
| Heatless Styling & Setzen | 2 route rows and shared decisions confirmed/reconciled | complete for current grilling pass |
| Bürsten & Kämme | 6 route rows and `B01-B13` confirmed/reconciled | complete for current grilling pass |
| Clips, Haargummis & Fixierhilfen | 1 minimal route confirmed/reconciled; one Stage 2 detail deferred | complete for current grilling pass |
| Wasch- & Auftragshilfen | 1 minimal route confirmed/reconciled | complete for current grilling pass |
| Nachtschutz | 1 route and `N01-N06` confirmed/reconciled | complete for current grilling pass |
| Handtücher & Trocknungsmaterialien | 2 routes and `T01-T06` confirmed/reconciled | complete for current grilling pass |
| Cross-category ownership | `D12` confirmed | complete for current grilling pass |
| Fixtures and walkthrough | route fixtures reconciled; refreshed P-A1-A2-B-C-D-E mockup and journey approved 2026-08-09 | complete; implementation authorization remains separate |

The dashboard is updated after every decision checkpoint. No final entry count is claimed until every route pass is complete.

## Shared decision register

| ID | Decision | Status | Current rule or choice |
|---|---|---|---|
| `D01` | What one matrix entry represents | `confirmed` | One **conditional product route**: a product category plus one product type/capability path inside a routine event. This is internal only; the visible hierarchy stays product-led. |
| `D02` | Visible hierarchy | `confirmed` | Product category -> recognizable product type -> exact product. Purpose/job is mapping and explanation only. |
| `D03` | Need-tier authority | `confirmed` | Existing deterministic need rules produce `basis | optional | not_needed`; catalog availability and ownership do not create need. |
| `D04` | Reported-use semantics | `confirmed` | `null = unknown`, `[] = explicitly none`, non-empty = broadly reported. Reported use changes priority/copy/reference-shopping state, not need tier. |
| `D05` | Input boundary | `confirmed` | Do not ask brand, model, exact attachment inventory, unobserved technique, preference, or curiosity. Reuse routine/profile inputs. |
| `D06` | Guidance activation | `confirmed` | Guidance becomes executable for a broadly reported route or after explicit acquisition. Optional routes also require opt-in. |
| `D07` | Occurrence source | `confirmed` | Compile occurrences from actual routine events; never guess a weekly cadence. Product allocation does not add events. |
| `D08` | Guidance precedence | `confirmed` | Verified exact-product protocol overrides the conservative category fallback. |
| `D09` | Precision and uncertainty | `confirmed` | Missing decision-critical facts remain `unknown`; omit unsafe precision and do not confidently recommend an unknown/mismatch product. |
| `D10` | Presentation salience | `confirmed` | Show every genuine basis result after deduplication; keep subordinate optional tools collapsed until opened. |
| `D11` | Multi-capability tools | `confirmed` | One physical product may cover several capabilities and appears once; a second product needs a distinct uncovered job. |
| `D12` | Cross-category ownership | `confirmed` | One physical product has one card and lifecycle but may serve several routes. Its product category remains form-led; triggering routes own the reason and occurrence. Deduplicate Heat protection, sectioning, detangling, Night ties, multi-tools, and textile guidance as specified below. |
| `D13` | Final matrix/output payload | `confirmed` | Use a lean eight-part route matrix linked by stable IDs to `decision.md`, typed product facts, protocol data, runtime reason payloads, and fixtures. Do not duplicate exact product rows or full guidance copy in the matrix. |
| `D14` | Readiness and fixture gate | `confirmed` | Every route names required facts, unknown/blocking behavior, and fixtures. If no exact candidate qualifies, preserve the valid generic Stage 1 recommendation and show a visible Stage 2 catalog gap; never hide the need or manufacture a closest match. |

## Decision order and checkpoint rhythm

1. Confirm the matrix-entry grain (`D01`). **Complete.**
2. Confirm the exact field set (`D13`) so later decisions are captured consistently. **Complete.**
3. Grill Haartrockner & Luftstyler. **Complete for the current pass.**
4. Grill Hitzestyling and Heatless Styling together where they are alternatives. **Active.**
5. Grill Bürsten & Kämme.
6. Grill Clips/ties, then Wasch-/Auftragshilfen as subordinate categories.
7. Grill Night Protection using the useful parts of the existing conditional logic.
8. Grill towels/materials, including the captured rubbing exception and `no_towel` state.
9. Resolve cross-category ownership (`D12`) and deduplicate products, occurrences, and guidance.
10. Add route-specific fixtures, update the mockup where behavior changed, and perform the final designed-journey walkthrough.

After each category, update its decisions, matrix entries, remaining questions, fixture list, and dashboard before moving on.

## Candidate matrix fields

Repository and schema review supports a lean core matrix. Other Personal Plan categories keep deterministic policy in focused rule tables, exact product properties in category spec data, and executable behavior in typed runtime code/tests. The database already separates product identity from category-specific product facts. Hair Tools should extend that separation instead of storing one wide duplicated rule/product/protocol record.

The recommended V1 ownership is:

| Concern | Owner |
|---|---|
| Conditional route resolution and reason facts | Version-controlled Personal Plan Tools module plus tests |
| Product identity, price, image, and lifecycle | Shared `products` authority |
| Tool types, capabilities, attachments, route-critical physical facts | Typed `product_tool_specs` contract |
| Exact product directions that change safe fallback | Verified application protocol/fact data |
| External evidence and limitations | `evidence.md` and fact provenance |
| User choice, shopping, acquisition, and proposed-plan state | Shared Personal Plan lifecycle |
| Cross-authority completeness during planning | This lean route matrix |

This means the matrix keeps only decision-changing references and outcomes. It does not become a category DSL, database table, code generator, product catalog, or copy repository in V1.

### Confirmed entry grain

One entry represents:

```text
product category + recognizable product type/capability path + routine event
```

Example: `Haartrockner & Luftstyler + Föhn requiring diffuse_airflow + diffuser-drying event`.

This is not a new visible subcategory. Several exact products may qualify for one entry, and one exact multi-tool may qualify for several entries. Product/card deduplication happens after route resolution so the same physical device still appears once.

### Lean core entry — proposed `D13` shape

1. `route_id` and status;
2. visible product category plus eligible product type/capability references;
3. activation: need-rule IDs, tier, decisive inputs, missing-input behavior, and reported-use effect;
4. routine compilation: event, occurrence source, hair state, placement, and dependencies;
5. guidance policy: generic fallback key, exact-protocol override key, unknown behavior, and safety suppression;
6. exact-product readiness: required fact-set key and candidate eligibility requirement;
7. output/lifecycle: choice group, deduplication key, reference/shopping/acquired behavior, and reason facts;
8. proof: fixture IDs and decision-log reference.

The more granular fields below remain the completeness checklist used to populate those eight logical groups; they do not each require a separate visible database or Markdown column.

### Product identity and purpose

- stable matrix/route ID;
- user-facing product category;
- recognizable product type or valid product-type set;
- required capabilities or attachment facts;
- narrow primary purpose in this plan;
- secondary supported jobs.

### Activation and choice

- governing need-rule IDs;
- decisive canonical inputs and missing inputs;
- reported-use source and effect;
- `basis | optional | not_needed` result;
- optional opt-in requirement;
- alternative/choice-group relationship;
- reported-route priority and capability condition.

### Routine compilation

- source routine event;
- occurrence expression;
- relevant hair state (`wet | damp | dry | not_state_sensitive`);
- placement within the event;
- generic guidance key;
- cross-category dependencies and ordering;
- whether the entry is executable now, conditional, or reference-only.

### Exact-product readiness

- route-critical product facts;
- verified protocol override fields;
- candidate state (`ideal | supportive | mismatch | unknown`);
- behavior when a required fact is missing;
- safe generic fallback;
- safety suppression or escalation conditions.

### Output and proof

- default card facts;
- shopping/acquisition state;
- reasoning facts and rejected inferences;
- product and guidance deduplication key;
- positive, negative, unknown, and safety fixture IDs;
- decision status and decision-log reference.

## Category grilling inventory

The lists below are completeness checklists, not confirmed matrix entries. They ensure no smaller decision disappears between conversations.

### 1. Haartrockner & Luftstyler

- **`A01` confirmed:** use three internal paths: standard drying, diffuser drying, and air shaping/drying.
- **`A02` confirmed:** air shaping may create an independent `basis` recommendation; it is not limited to reported use or capability consolidation.
- **`A03` confirmed, amended 2026-08-24 (`R2`):** only `volume` plus a planned blow-dry route is strong enough to create independent air-shaping `basis`. `curl_definition` remains the diffuser path; frizz/shine cannot create this device need. **Texture gate:** the definition-driven diffuser path activates only for `wavy | curly | coily`; `straight` plus `shape_definition` is a legal profile and activates no tool route from the definition goal (fixture 4b).
- **`A04` confirmed after research, extended by `B08`:** prioritize a broadly reported viable air-shaping approach conditionally. The choice may be Warmluftbürste, Air Multi-Styler, or conventional Föhn plus Rundbürste. When none is reported, compare the eligible recognizable approaches neutrally inside the same shared volume `basis`; add no profile-derived default or preference question.
- **`A05` confirmed, amended 2026-08-24 (`D2a`):** require diffuser capability for reported diffuser drying, or for wavy/curly/coily hair with `shape_definition` plus a planned blow-dry route. The stored Feinschliff option `diffuser_or_airflow_shaping` is read as **diffuser drying** — Nick ruled the legacy reading explicitly, accepting that few users are affected — so `A05` keeps its trigger. The amendment is what the answer does **not** prove: reporting the behaviour is not evidence of a diffuser-capable device, so `capabilityVerified` must **not** be set from it and the copy stays conditional per `A06`. Restructuring the option into „Mit Diffusor" plus a separate formender-Luftstrom choice is queued post-Phase-1 (`D2b`) under the `D8` versioning discipline.
- **`A06` confirmed:** if a dryer is broadly reported but diffuser compatibility is unknown, do not ask another question. Use conditional existing-first wording and keep one verified diffuser-capable example as reference only; unknown compatibility does not create shopping.
- **`A07` confirmed:** a missing ordinary drying route recommends a conventional Föhn. A reported Warmluftbürste or Air Multi-Styler may cover it conditionally only if the actual device supports full drying.
- **`A08` confirmed:** treat a concentrator as a normal, non-critical conventional-dryer accessory. It is not a route, need trigger, or readiness gate. Generic guidance may say to use it if available; an exact card claims package inclusion only when verified.
- **`A09` confirmed after research and clarification:** represent pre-drying and air shaping as two linked tool occurrences/steps inside one styling session. They share one cadence and ordered dependency; they are not independently scheduled. Exact protocol decides the starting state and how each occurrence is fulfilled.
- **`A10` confirmed:** the linked pre-dry occurrence requires verified pre-dry capability, not a separate conventional Föhn. One Multi-Styler may cover both linked uses; recommend two physical products only when no one verified product covers both.
- **`A11` confirmed after research, amended 2026-08-24 (`D2a` + `D9a`):** Heat-protection product tier is `not_needed` for ordinary dryer/diffuser, `optional` for airflow shaping including Föhn plus Rundbürste, and `basis` for direct-contact high-heat tools. Exposure-minimization guidance still applies to airflow. An exact verified protocol can promote coverage to `basis`. Two reconciliations:
  - **Source tiering.** Because `diffuser_or_airflow_shaping` is read as diffuser drying (`D2a`), the **diffuser tier `not_needed` applies to that source**. **Ruled 2026-08-24 (`R1`): the Stage-2 heat-protection question that `heat-events.ts` raises for `diffuser_airflow_shaping` is dropped now.** `protectionConsistency` becomes forbidden for that source; per `D8` this completion-semantics change carries a path-version bump plus a decode rule — stored values for the source are ignored on read, and rows completed under the old contract stay complete.
  - **Coverage evaluation.** The tier says whether protection is *needed*; whether it is already *covered* is read per heat event from `protectionConsistency` (`D9a`), never from the legacy `uses_heat_protection` boolean.
- All airflow checklist decisions are resolved for the current pass. Route-critical facts and fixtures are reconciled into `product-spec.md` and `decision.md`.

#### Confirmed lean airflow matrix

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.airflow.standard_dry` | Föhn with `dry_hair`; reported alternative airflow form only if it can fully dry | `tools.airflow.basis` with ordinary `blow_dry`; reported route first, otherwise conventional Föhn | one standard-drying occurrence per planned blow-dry event | lower/moderate heat, keep moving, no universal distance; Heat protection `not_needed` | verified identity, `hair_dryer`, `dry_hair`, source/image/price; concentrator is no gate | reported = conditional reference; explicit none = exact Föhn shopping candidate; unknown = conditional/no silent shopping | decision fixtures 1, 23-25, 41; `confirmed` |
| `tools.airflow.diffuse_dry` | Föhn/eligible device with verified diffuser and `diffuse_airflow` | reported diffuser drying, or goal-matched wavy/curly/coily blow-drying; air-dry + definition remains optional | one diffuser-drying occurrence per selected diffuser event | compatible attachment only, lower/moderate heat, avoid stationary exposure; Heat protection `not_needed` | verified included/compatible diffuser for the exact product; missing compatibility = `unknown` | reported dryer = use if compatible plus reference example; no question; unknown attachment never enters shopping | decision fixtures 2, 4, 32-33; `confirmed` |
| `tools.airflow.air_shape` | Warmluftbürste, Air Multi-Styler, or Föhn plus Rundbürste with verified `air_shape + create_volume`; pre-dry capability may live on the same or another device | `volume + planned blow-dry` = one approach inside the shared volume `basis`; reported viable approach first; otherwise neutral Stage 2 comparison; air-dry + volume = optional | linked `pre_dry` then `air_shape` occurrences inside one styling session and shared cadence | exact starting state/sequence overrides; no universal dryness percentage; Heat protection `optional`, exact required protocol promotes to `basis` | verified volume head/round-brush geometry and capability, supported use state, pre-dry fulfillment, attachments/heat suitability, sequence, safety/provenance | deduplicate Föhn/device across drying and shaping; add another product only for uncovered pre-dry/shape capability; optional coverage requires opt-in/acquisition | decision fixtures 34-40, 47, 55; `confirmed` |

The routes are internal compilation paths. The user still sees `Haartrockner & Luftstyler` and the selected recognizable product type.

### 2. Hitzestyling-Tools

- **`H01` confirmed:** preserve a product-type-first architecture. Each recognizable product type has a `jobs[]`/`capabilities[]` mapping; jobs do not become internal or visible subcategories.
- **`H01` confirmed job directions:** straighten/smooth; create curls/waves; create volume/set. Retain the atomic capabilities `straighten`, `smooth`, `curl`, `wave`, `create_volume`, and `set_style` so one product type or exact multi-tool can expose several.
- **`H02` confirmed:** each product type has an allowed job set for Stage 1; each exact product stores the verified capability subset used for Stage 2 eligibility. Never assume every SKU of a type supports every allowed job.
- **`H03` confirmed:** keep one recognizable `heated_brush` / `Heizbürste` product type. Its allowed job set may span straighten/smooth and volume/set, but every exact product must independently verify its supported subset; the engine must not infer a brush form or job from the broad label.
- **`H04` confirmed:** use a conservative Stage 1 allowed-job map. The type describes its inherent jobs; technique-dependent secondary tricks never become generic type claims. Exact-product capability verification remains mandatory.
- **`H05` confirmed:** V1 does not infer a straightening/smoothing desire and does not add an onboarding question. A reported `flat_iron` proves an existing behavior and activates owned-tool guidance, but it creates no proactive product/shopping need. If it is the only reported heat tool, the shared heat frequency can describe its cadence; with several reported heat tools, guidance stays occasion-bound (`when you straighten`) and never assigns the aggregate frequency to the flat iron alone.
- **`H06` confirmed:** V1 also does not infer a desire to create curls/waves and does not overload `curl_definition`. That goal remains about supporting the natural pattern through routes such as diffuser drying/definition support. A reported curl/wave-creation tool proves an existing created-style behavior and may reveal a neutral heated/heatless alternative, but non-users receive no proactive curl-creation product need.
- **`H07` confirmed:** `create_volume`/`set_style` is one cross-category need, not one need per Tools category. Air shaping, direct heated setting, and heatless setting are fulfillment approaches. A reported viable approach is prioritized; otherwise eligible approaches are compared neutrally. Ordinary drying may remain a separate need, but once the volume/set job is covered, other approaches are alternatives rather than additional required purchases.
- **`H08` confirmed 2026-08-05, reversed 2026-08-24 (`D1`).** This is a formal reversal of a confirmed decision, not a clarification.
  - **Old rule (withdrawn):** only the canonical explicit `volume` goal creates a proactive shared volume/set need; do not infer it from density, thickness, texture, frizz, shine, `less_volume`, or mere ownership/use of a compatible tool.
  - **New rule:** the stored goal token `volume_balance` is directionless — the quiz aliases both „mehr Volumen" and „weniger Volumen" onto it — so direction **is inferred in-plan**, from **texture and thickness and from nothing else**, via the ratified predicate `src/lib/personal-plan/volume-direction.ts`. That predicate is the app-wide single source of truth, ratified exactly as implemented (`curly | coily | coarse | wavy-with-a-definition-signal` ⇒ control; everything else ⇒ volume_up), and it has **no abstain state**. It already ships for Conditioner weight, so this is one predicate, not a Tools invention.
  - **Still forbidden as direction signals:** density, surface, elasticity, chemical treatments, frizz, shine, damage, breakage, and mere ownership/use of a compatible tool. Reported tools may prioritize or preserve a route but never manufacture the goal.
  - **Marking is mandatory:** every route that reaches its tier through the inference carries `tools.styling.volume_direction_inferred` and says so in its reason payload. An inferred direction is never presented as a stated one.
  - **`low_volume_or_weighed_down` triggers AND overrides.** The concern triggers the volume routes on its own, and when present it sets the direction to lighter / volume_up regardless of texture and thickness — explicit signal beats inference. Five shipped care categories already read it this way.
  - Upstream predicates in `quiz/normalization.ts` and `offer-adapter.ts` read `density`, sit outside the plan, and are documented as a separate non-plan concern; aligning them is out of scope for Phase 1. Splitting the goal card at the quiz boundary is queued as a separate later feature.
- **`H09` confirmed:** preserve current drying behavior without treating it as a permanent preference. With planned blow-drying, air shaping, direct heated setting, and heatless setting are eligible approaches. With current air-drying, heated and heatless are the main neutral choices; air shaping remains optional because it would introduce a new blow-drying behavior.
- **`H10` confirmed:** when a broadly reported tool could cover the selected job but its exact capability/attachment is unknown, use conditional ownership-first language (`use yours if it supports X`). Do not ask another inventory question, assume coverage, or create a duplicate shopping recommendation. A verified qualifying example may remain a reference until missing coverage is established.
- **`H11` confirmed:** extend the existing styling-tool ownership intake with broad heatless-tool forms, potentially across several pages for readability. This observes current ownership/use; it is not a new desired-style question. Exact heatless product type/capability still belongs to Stage 2 qualification.
- **`H12` confirmed, amended 2026-08-24 (correction, no decision needed):** use progressive ownership disclosure. The first styling-ownership step selects the broad heated and/or heatless family; only selected families open a product-type drilldown. The Heatless drilldown distinguishes **five** recognizable form groups, adopting the production set: Heatless-Lockenband (`heatless_curling_band`), Lockenwickler/Roller (`setting_roller`), **Schaumstoffwickler (`foam_roller`)**, Papilloten/Flexi-Rods (`flexi_rod`), and other Heatless-Former (`setting_former`). The earlier four-group list omitted `foam_roller`; it is added as its own group rather than merged into `setting_roller`. Exact German microcopy/page composition remains a mockup decision, not a route-logic dependency.
- **`H13` confirmed:** exact heatless recommendation eligibility uses a route-critical minimum, not an exhaustive comparison schema. Require verified supported job(s), supported hair use state, setup/securing and required pieces, applicable sequence or duration, and geometry/size only when it changes route/result. Always apply generic comfortable-tension/stop-if-pain guidance; never invent overnight use or material benefits.
- **`H14` confirmed:** exact heated-tool eligibility uses a safety-critical minimum: verified supported job(s), supported hair use state, heat-control behavior/range, required geometry/attachment, and any exact protocol that changes safe use. Keep shared identity/price/card facts, but do not recreate a wattage/material/ionic/feature scorecard. Unknown safety-critical facts block confident exact recommendation.
- **`H15` confirmed 2026-08-05, rewritten 2026-08-24 (`D9a`).** The old rule was written against `uses_heat_protection`, a two-state legacy boolean **no Personal Plan module reads**. It stays unread — not imported, not migrated, not a reason fact.
  - **Source of truth:** `heatEvents["heat:<source>"].protectionConsistency ∈ {always, sometimes, no, unsure}`, judged **per heat event**. It is required for `airflow_shaping` and `direct_contact_heat` sources and forbidden for `ordinary_airflow`, so no unanswered coverage state can arise on a completed heat-event question.
  - **Only `always` counts as covered.** The dependency is satisfied for that event and no duplicate Heat-protection product is recommended. This remains trusted profile coverage, not verified technical metadata: invent no exact temperature or protection claim.
  - **`sometimes` is not coverage.** It receives a consistency nudge at tier „empfohlen", in the register of „mach's konsequent" — never an accusation.
  - **`no` and `unsure`** leave the dependency uncovered for that event and produce the recommendation.
  - **Coverage is per event, so the portfolio result is the union of the uncovered events**; a user may be covered for the Glätteisen and uncovered for the Warmluftbürste.
  - Copy stays at „empfohlen/sinnvoll" and never becomes „nötig, sonst Schaden" — the measured benefit exists only at flat-iron temperatures.
  - Fixtures 122 and 123 are **retired as impossible**: production never defaults `protectionConsistency`.
- **`H16` confirmed:** place the selected styling approach after every wash as an explicitly optional routine branch (`when you want to style today / have time`). This makes guidance reachable without claiming the user performs it every wash or inventing a weekly per-tool cadence. Recorded heat frequency remains profile/risk context rather than mandatory step completion.
- **`H17` confirmed:** the generic heated-tool fallback governs tool operation, not Heat-protection product application. For continuous-pass/gliding tools, say to keep the tool moving steadily and not pause on one section. For stationary-by-design curl/set tools, follow the verified hold/set-and-release protocol and never extend contact beyond it. In both cases default to dry hair unless exact wet-to-dry support is verified, order Heat protection first, use the lowest effective available setting without inventing a universal temperature, and allow stricter exact-product directions to override.

| Recognizable product type | Allowed Stage 1 jobs | Important limit |
|---|---|---|
| `flat_iron` | `straighten`, `smooth` | Curling with a flat iron is not a generic type claim. |
| `curling_iron`, `curling_wand` | `curl`, `wave` | Exact geometry and protocol still decide the actual result range. |
| `wave_iron` | `wave` | Do not broaden to generic curl creation. |
| `automatic_curler` | `curl` | Wave capability requires exact-product proof. |
| `heated_rollers` | `curl`, `wave`, `create_volume`, `set_style` | Exact diameter/use state still gates Stage 2 eligibility. |
| `heated_brush` | `straighten`, `smooth`, `create_volume`, `set_style` | The broad label proves none of these for an exact product; its verified subset controls eligibility. |
| `heated_multi_styler` | all six atomic styling jobs | Every selected job requires a verified exact attachment/capability. |

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.heated.reported_straighten` | `flat_iron`; `heated_brush`/`heated_multi_styler` only with verified `straighten` or `smooth` | specific reported straightening form only; no goal/texture/frizz inference; reported product need remains `not_needed` | optional post-wash styling branch on every wash; recorded heat cadence is context, not compulsory completion | Heat protection `basis`; dry-hair default; continuous-pass tools move steadily; exact protocol overrides | supported job/use state/control behavior/contact mode and decision-changing geometry/attachment | use owned tool; broad capability unknown = conditional use-yours; no proactive shopping/replacement | fixtures 42-44, 50-52; `confirmed` |
| `tools.heated.reported_curl_wave` | `curling_iron`, `curling_wand`, `wave_iron`, `automatic_curler`, eligible `heated_rollers`/multi-tool | created curl/wave behavior only from a reported inherent form; `curl_definition` never activates it | optional post-wash styling branch on every wash | Heat protection `basis`; dry default; stationary tools require verified hold/set-and-release protocol | supported job/use state/control/contact mode; geometry where result-changing; exact attachments for multi-tool | reported form first/use yours; heatless route may appear below as optional alternative; no proactive heated shopping for non-users | fixtures 44-46, 50-52; `confirmed` |
| `tools.heated.volume_set` | eligible `heated_rollers`, `heated_brush`, or `heated_multi_styler` with verified `create_volume`/`set_style` | explicit canonical `volume` only; one approach inside the shared volume/set `basis`; reported viable form is prioritized | selected approach appears as optional post-wash branch on every wash | Heat protection `basis`; contact-mode fallback and exact-product override | verified volume/set capability plus safety-critical fact minimum | one choice member, not another need; selected/acquired product activates exact guidance; ambiguous owned coverage remains conditional | fixtures 6, 47-54; `confirmed` |

Auto shutoff and other convenience facts may be displayed when verified, but they are not route gates. The category has no proactive V1 straightening or created-curl purchase route because the current profile has no matching desired-style input.

### 3. Heatless Styling & Setzen

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.heatless.reported_curl_wave` | Heatless-Lockenband, Lockenwickler/Roller, Schaumstoffwickler, Papilloten/Flexi-Rods, or other verified former with `curl`/`wave` | created curl/wave behavior revealed by a reported heated or heatless inherent form; `curl_definition` never activates it | optional post-wash styling branch on every wash | exact use state/setup/duration override; otherwise comfortable tension and stop/adjust on pulling or pain; never invent overnight use | verified job, use state, securing/required pieces, applicable sequence/duration, result-changing geometry | reported heatless form = primary use-yours; reported heated form = optional heatless alternative; selection/acquisition precedes exact executable guidance | fixtures 44-46, 53-54; `confirmed` |
| `tools.heatless.volume_set` | eligible band, roller, rod, or former with verified `create_volume`/`set_style` | explicit canonical `volume`; one approach inside the shared volume/set `basis`; reported viable heatless form is prioritized | selected approach appears as optional post-wash branch on every wash | same exact-protocol precedence and tension fallback; clips/ties may be subordinate optional aids, never a second basis requirement | route-critical fact minimum; unknown use state or setup blocks the exact candidate | one choice member, not another need; user selects approach, then product lifecycle owns shopping/acquisition/guidance activation | fixtures 6, 47-49, 53-54; `confirmed` |

The ownership flow is family-first. Selecting Heatless opens the five-form drilldown (`H12`, amended 2026-08-24); selecting neither does not add a follow-up. Heatless and heated approaches are neutral choices where both can fulfill the same known job, but the plan never claims identical technique, time, or result.

### 4. Bürsten & Kämme

- **`B01` confirmed, corrected:** every user receives one foundational hair-handling method. For `very_short` hair, a reported/default finger method may fully cover the foundation without a shopping card. From `short` upward, the foundation requires one compatible physical comb or brush; a finger-only answer does not close that product need. Extra physical tools still require a distinct uncovered job. **Amended 2026-08-24 (`D9b`):** the finger case is now a real answer. The `Bürsten & Kämme` page gains an explicit „Nur Finger" non-product option, so „Nichts davon" stops doing double duty and „ich benutze nur meine Finger" and „ich habe keine Bürste" are stored as different claims. This makes the `B01`/`B03`/`B04` finger exceptions expressible for the first time; the answer shape rides `D8` and the card goes through the WS4 mockup pass.
- **`B02` confirmed:** choose a conservative texture-aware default for an uncovered physical foundation: `straight -> detangling_brush`; `curly | coily -> wide_tooth_comb`; `wavy + curl_definition -> wide_tooth_comb`; other `wavy -> detangling_brush`; missing texture -> neutral choice. A reported compatible alternative remains eligible and receives priority; the map does not require both forms.
- **`B03` confirmed:** for `short | medium | long | very_long`, the foundational physical tool must cover `detangle`. Smoothing, oil/product distribution, airflow styling, parting, and shaping are secondary jobs; they do not close the foundation unless the same exact/reported form also supports detangling. The `very_short` finger exception remains.
- **`B04` confirmed:** as an ownership-minimization rule, any reported physical brush or comb normally suppresses another foundational product recommendation, even when its primary job is styling/smoothing. This does not grant an unverified `detangle` capability or permit incompatible application guidance. Fingers still close the foundation only for `very_short`. **Amended 2026-08-24 (`D4`):** `B04` sets **coverage only**, never reported ownership. „Nutze deins" is gated on reported or derived ownership of the actual form, and the card names **their** tool — a Paddle-Bürste owner whose ideal form is a Detangling-Bürste reads „Nutze deine Paddle-Bürste" with guidance adapted to that form, and the ideal form may appear as an optional note but never as a purchase push while the route is covered.
- **`B05` confirmed:** explicit tangling or a friction-heavy reported brush pattern reopens the detangling gap. Recommend the texture-aware core form as the corrected foundation; the existing brush may remain for its legitimate secondary job rather than being treated as universally wrong.
- **`B06` confirmed:** generic foundational application guidance is pattern-aware and proactive, never a claim about current technique. Curly/coily and definition-led wavy routes use wet/damp hair with Conditioner/Leave-in slip; straight and other wavy routes follow verified tool use state or a gentle partly-dry fallback rather than a universal wet rule. All start at the ends, work upward, use adaptive sections, reduce force/stop on snagging, and yield to stricter exact-product directions.
- **`B07` confirmed:** keep one visible foundation. Specialized brushes/combs are job-bound, subordinate options in the collapsed optional area; texture alone never creates them and alternatives never become simultaneous purchases.
- **`B08` confirmed:** `Föhn + Rundbürste` is an eligible manual air-shaping approach inside the existing shared explicit-volume need. It does not create a new volume need beside Warmluftbürste, Air Multi-Styler, direct heated, or Heatless approaches; one chosen approach covers the job.
- **`B09` confirmed specialized mappings, amended 2026-08-24 (`R2`, `R3`):** `curl_definition -> Definitionsbürste` optional **for `wavy | curly | coily` only** (`R2` texture gate — straight hair activates nothing from the definition goal); `volume + curly/coily -> Pick` optional; Paddle-/Vent-/Pneumatikbürste only when reported or chosen for a concrete dry-styling/blow-dry job; Stielkamm only for a selected parting/sectioning parent event. Pneumatik is an exact construction/property of a qualifying brush form, not another top-level product type. **`R3`:** `boar_bristle` („Wildschweinborsten-Bürste") joins the `brushes_combs` product types and the Feinschliff Bürsten-page — it exists in the legacy onboarding enum (`BRUSH_TYPES`) and was dropped when the Tools form list was rebuilt; Nick ruled its inclusion. Reported boar-bristle coverage flows through `B04` as usual; no proactive boar-bristle shopping from texture alone.
- **`B10` confirmed ownership boundary:** scalp brush, applicator bottle/comb, and water spray bottle do not live in Brushes & Combs. They move to Wasch- & Auftragshilfen, where a real scalp-product, wash, or between-wash refresh event may make them optional.
- **`B11` confirmed, simplified:** Brushes & Combs is not a detailed tool-comparison platform. Exact qualification requires shared identity/image/price/source, product type and supported job, `supportedUseStates` only when the route is state-sensitive, and verified blow-dry/heat use only for a heat-assisted route. Do not require or canonicalize exact tooth spacing, round-brush diameter, bristle lengths/flexibility, nubs, cushion construction, or material taxonomy in V1.
- **`B12` confirmed:** place foundational handling once per wash routine with texture-aware timing. Curly/coily and definition-led wavy detangle in the conditioned wet/damp phase; straight and other wavy detangle after partial drying unless exact use state says otherwise. Very-short finger handling is integrated into existing application/arranging guidance rather than another brush step. No daily cadence is invented.
- **`B13` confirmed:** extend and group the existing Brushes/Combs ownership drilldown. Keep common foundation forms first; add Ventbürste, Definitionsbürste, Pick, and Stielkamm under further styling tools. This is one grouped ownership input, not separate pages or new product goals.

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.brush.foundation` | `very_short -> fingers`; `straight -> detangling_brush`; `curly/coily -> wide_tooth_comb`; definition-led `wavy -> wide_tooth_comb`; other `wavy -> detangling_brush` | every profile; any reported physical brush/comb normally suppresses another purchase; explicit tangling/friction reopens the texture-aware correction | curly/coily/definition-led wavy in conditioned wet/damp phase; straight/other wavy after partial drying; very-short finger handling integrated | ends upward, low force, adaptive sections, slip for wet/damp pattern route; exact use state overrides | identity/type/`detangle`; relevant use state only; no detailed geometry/material gate | reported physical form = covered/use yours; `[]` = saved default may shop; `null` = conditional/reference, no silent shopping; fingers close only very-short | fixtures 9-11, 56-64; `confirmed` |
| `tools.brush.manual_air_shape` | `round_brush + hair_dryer` with `airflow_shape/create_volume` | explicit `volume + planned blow-dry`, and this shared-volume approach is reported or selected | linked to the existing pre-dry then air-shape session; no second cadence | keep airflow moving, controlled tension, Heat protection `optional`; exact directions override | round-brush type/job, relevant use state, `blowDryUseVerified`; dryer capability separately verified | one member of shared volume choice; reuse/deduplicate reported dryer and brush; never another volume need | fixtures 47, 55, 65; `confirmed` |
| `tools.brush.definition_optional` | `styling_brush` with `define_pattern` | explicit `curl_definition`; reported form first; texture alone is insufficient | optional in the conditioned/post-Leave-in definition event | exact use state overrides; low tension and stop on snagging; do not promise definition | type/job and relevant use state | collapsed optional; selection/acquisition before exact executable guidance; never duplicates the foundation unless it adds the uncovered definition job | fixtures 66, 70; `confirmed` |
| `tools.brush.pick_optional` | `hair_pick` with `create_volume` | explicit `volume + curly/coily`; reported form first | optional finishing/root-volume event, not another weekly cadence | lift gently without scraping/pulling; no growth or guaranteed volume claim | type/job and relevant use state only | collapsed optional/lightweight approach; never another shared-volume requirement | fixtures 67, 70; `confirmed` |
| `tools.brush.reported_dry_style` | Paddle-, Vent-, or qualifying Pneumatik construction mapped to its real product type/job | reported form or a selected concrete dry-styling/blow-dry parent route; never texture alone | attach to the selected parent event; reported ownership alone adds no new cadence | use-state/heat-compatibility guidance only; no universal `dry-only` rule | type/job; relevant use state; `blowDryUseVerified` for heat-assisted use | use yours/reference; no proactive extra purchase without an uncovered parent job | fixtures 68, 70; `confirmed` |
| `tools.brush.sectioning_optional` | `sectioning_comb` with `section_hair` | selected styling/application event explicitly needs parting/sectioning | subordinate occurrence inside the parent event | adaptive sections, no fixed count; no detangling claim | identity/type/job; no extra geometry gate | collapsed optional and deduplicated with Wash/Application; no standalone need | fixtures 69-70; `confirmed` |

All Brushes/Combs decisions are resolved for the current pass. Shower detangling, scalp tools, applicators, and water refresh remain owned by the next Wash/Application pass so they cannot duplicate these rows.

### 5. Clips, Haargummis & Fixierhilfen

- **`C01` confirmed:** this family is never standalone or `basis`. Only four existing parent events may make a securing aid optional: sectioning for selected styling/application; holding/support required by a selected heated/Heatless set; a selected Night Protection method; or root-volume clipping for the explicit `volume` goal. Length, density, texture, catalog presence, or ordinary reported securing alone never create the need.
- **`C02` confirmed:** resolve each included parent to one minimal recognizable form and prioritize a compatible reported form: Sectioning-Clip for sectioning/application; exact required included/compatible pin or clip for set support; soft tie/Scrunchie for Night Protection; Root-Volume-Clip for the root-volume approach. Do not show a bundle or treat a universal claw clip as verified for every job.
- **`C03` confirmed:** add Clips/Ties to the shared family-first tool-ownership flow. Only users selecting the family see the compact form drilldown for soft tie/Scrunchie, claw clip, sectioning clips/pins, root-volume clips, and headband. Do not infer ownership from a hairstyle or Night Protection method.
- **`C04` confirmed:** whenever a securing route is selected, add the simple application fallback `only as tight as needed; loosen/reposition/remove if it pulls or hurts`. This is proactive guidance, not an inference about current use. Sectioning aids end with their parent step; exact set or Night Protection protocol takes precedence.
- **`C05` deferred to Stage 2:** current exact styling-set protocols are not defined deeply enough to decide whether required clips/pins must be included or may be supplied separately. Until that product-level decision exists, Clips/Ties remains optional, no separate mandatory accessory is emitted, and a parent exact set with unresolved required securing pieces is not considered fully executable.
- **`C06` confirmed, deliberately minimal:** exact product data is limited to shared identity/image/price/link plus recognizable type and supported job. No dimensions, hold-strength scoring, coating, seams, contact material, quantity, or fit schema in V1.
- **`C07` confirmed presentation:** Stage 1 merges all active supporting reasons into at most one collapsed optional `Clips, Haargummis & Fixierhilfen` result. No form-comparison grid is shown. Stage 2 links at most one concrete optional example selected from the internally relevant minimal form; the category remains low salience.

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.securing.support_optional` | parent selects one generic form: Sectioning-Clip; Root-Volume-Clip; soft tie/Scrunchie owned by Night Protection; exact set-support form remains deferred | any named parent from `C01`; compatible reported form first; no parent = `not_needed`; length/density/texture never activate | subordinate occurrence inside the parent event; never adds cadence; sectioning aid ends with its step | only as tight as needed; loosen/reposition/remove if it pulls or hurts; exact parent protocol wins | shared identity/image/price/link plus recognized type and supported job only | merge all active reasons into one collapsed optional Stage 1 result; one Stage 2 example; unreported requires opt-in then acquisition; Night-owned product/card deduplicates | fixtures 12, 71-79; `confirmed` except exact set-support compatibility `deferred` |

All currently answerable Clips/Ties decisions are complete. The deferred set-support inclusion question reopens only when Stage 2 styling-product protocols are concrete enough to answer it.

### 6. Wasch- & Auftragshilfen

- **`W01` confirmed:** only two proactive parent events exist: a verified targeted scalp-product application may make an applicator optional; a selected between-wash curl/wave refresh step may make a water spray bottle optional. A scalp/shampoo brush is reported-use-only. Oily scalp, dandruff, density, length, hair loss, or catalog presence do not activate a tool. Shower detangling reuses Brushes/Combs; sectioning reuses the selected Stielkamm/Sectioning-Clip route.
- **`W02` confirmed:** targeted scalp application defaults to one generic applicator bottle; a reported applicator comb may take priority. Selected refresh defaults to one ordinary water spray bottle. A reported scalp brush remains use-yours only. Remove `shower_detangler` as a separate Wash/Application product type; a wet-capable Detangling-Bürste remains owned by Brushes/Combs.
- **`W03` confirmed:** add a tiny Wash/Application family drilldown to the shared progressive ownership flow: scalp brush, applicator bottle/comb, and water spray bottle. Users not selecting the family see no detail question; do not infer ownership from a scalp product or refresh event.
- **`W04` confirmed:** merge all active reasons into at most one collapsed optional Stage 1 result and at most one Stage 2 example. Priority is targeted scalp application (reported applicator comb first, otherwise applicator bottle), then refresh (water spray bottle); reported scalp brush adds use-yours guidance only. Exact qualification is shared identity/image/price/link plus type/job—no dedicated fit/property schema.

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.wash_application.support_optional` | priority path: reported `applicator_comb`, otherwise `applicator_bottle`; else `water_spray_bottle`; reported `scalp_brush` is use-yours only | targeted scalp-product application; selected between-wash curl/wave refresh; or reported scalp brush; scalp condition/length/density alone = none | subordinate to the existing scalp-product, refresh, or wash event; never adds cadence | place scalp product sparingly where intended; dampen for refresh without invented technique; use reported scalp brush gently; no growth/anti-shedding claim | shared identity/image/price/link plus recognized type and supported job only | merge to one collapsed optional card and one example; application wins example priority; unreported example requires opt-in/acquisition; detangling/sectioning deduplicates to other owners | fixtures 13-14, 80-90; `confirmed` |

All Wash/Application decisions are complete for the current pass. No shower-detangler type, detailed applicator comparison, scalp-condition trigger, or multi-product kit remains.

### 7. Nachtschutz

- **`N01` confirmed, amended 2026-08-24 (`D9c`):** preserve the broad existing optional trigger set, restated in production tokens. Night Protection may be optional for long/very-long hair; concerns `breakage`, `split_ends`, `hair_damage`, `tangling`, or `frizz_flyaways`; and goals `frizz_surface`, `shape_definition`, `strength_ends`, or **`manageability_styling`**. `manageability_styling` joins the set as frizz-adjacent, consistent with the rest of the app — the legacy projection already treats it as `less_frizz`, and it was excluded only by omission. Note that the four legacy goals `healthier_hair`, `anti_breakage`, `strengthen` and `less_split_ends` collapse into the single token `strength_ends`, which widens reach; that widening is accepted, not a defect. Breakage plus an independent friction signal may raise ordering/relevance inside the optional section, but never changes the tier to `basis`. Reported ownership alone still does not create relevance.
- **`N02` confirmed:** when no form is reported, select one reason-based main form. Long/very-long plus breakage, split ends, or tangling -> length/tip sleeve; otherwise wavy/curly/coily plus `curl_definition` -> bonnet; all other eligible cases -> pillowcase. A soft Night tie/Scrunchie is subordinate to a selected loose-securing method and never another card.
- **`N03` confirmed:** a reported broad Night Protection method remains primary. Show the reason-based mapped form only as one optional alternative when it offers a genuinely different function; never show more than one alternative, replace the reported form automatically, or claim exact fit/material quality.
- **`N04` confirmed:** preserve any reported Night Protection method as a nightly `continue yours` routine step even when no relevance trigger exists, because it is real current behavior. It creates no optional need or shopping card by ownership alone and still receives the loose/non-painful application fallback. For an unreported optional route, a nightly occurrence starts only after opt-in and acquisition/selection.
- **`N05` confirmed:** exact-product readiness requires shared identity/image/price/link, product type, intended coverage (`pillow_surface | whole_hair | lengths_ends`), material, and closure/adjustability only for worn bonnet/sleeve forms. Do not require personal measurements, detailed dimensions, thread count, fabric grading, or fit scoring.
- **`N06` confirmed:** generic guidance says to cover the intended area comfortably, keep worn forms/ties loose at the hairline, and loosen/reposition/remove on pulling or pain. Describe only lower-friction containment or style preservation; do not claim repair, growth, split-end reversal, or guaranteed breakage prevention. Exact directions may be stricter.

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.night.protection_optional` | reported method first; otherwise long/very-long plus breakage/split ends/tangling -> length/tip sleeve; else pattern plus `curl_definition` -> bonnet; else pillowcase; soft tie subordinate | broad `N01` trigger set creates `optional`; breakage + independent friction raises optional order; reported method without trigger preserves routine only; at most one different mapped alternative | nightly when reported; unreported option becomes nightly only after opt-in and acquisition/selection | comfortable coverage, loose hairline fit, loosen/remove on pulling; friction/containment/style-preservation claims only | identity/image/price/link, product type, intended coverage, material, and worn-form closure/adjustability | `null` ownership = conditional/reference/no silent shopping; `[]` = optional example may shop after opt-in; reported = use yours plus at most one functional alternative; soft tie/card deduplicates to Night owner | fixtures 15-19, 91-103; `confirmed` |

All Night Protection decisions are complete for the current pass. The route intentionally preserves the existing broad optional reach while making product form, ownership, and lifecycle deterministic.

### 8. Handtücher & Trocknungsmaterialien

- **`T01` confirmed:** when `frottee` creates an optional textile upgrade, microfiber towel, smooth cotton cloth/T-shirt, and microfiber wrap/turban are one neutral practical choice group. Prioritize a reported form; no texture/profile input proves one material/form superior.
- **`T02` confirmed from the earlier guidance decision:** `rough_rubbing` always emits firm behavior guidance to press/scrunch gently instead, regardless of material; it never creates a mandatory product. `frottee` alone may create the optional upgrade. `no_towel` creates no textile recommendation and no invented rubbing behavior. A reported microfiber/cotton/wrap form is use-yours, not another purchase.
- **`T03` confirmed:** for wavy/curly/coily hair with `curl_definition`, plopping is a default wash-routine technique rather than a collapsed optional tip. It uses a suitable T-shirt/wrap, does not imply the user already performs it, and yields to the explicit `no_towel` state, which keeps no plopping and no textile recommendation.
- **`T04` confirmed:** plopping is a required technique step for its route, but a dedicated wrap product remains optional. An existing suitable T-shirt/wrap may execute it; the plan neither assumes ownership nor converts the technique into a basis purchase. One concrete wrap may appear only as an optional convenience example.
- **`T05` confirmed:** place default plopping after relevant Leave-in/styling-product application and before the selected air-drying or diffuser-drying occurrence. Guidance says to gather/scrunch gently rather than rub or twist tightly; duration remains adaptive instead of one universal prescribed time.
- **`T06` confirmed:** exact examples use shared identity/card data plus a recognized product type and supported job only. Do not create a textile-comparison schema for material quality, absorbency, dimensions, weight, thickness, or closure. The type names the practical option (`microfiber_towel | smooth_cotton_cloth | drying_wrap`); no stored property ranks one option above another.
- Keep an ordinary towel as reported context rather than a catalog recommendation.
- Preserve `frottee` as an optional material-upgrade trigger, not a hard need.
- Preserve rough rubbing as firm technique guidance independent of a purchase.
- Preserve `no_towel` as no product recommendation and no invented rubbing behavior.

| Route | Product path | Activation and reported use | Routine compilation | Guidance and dependency | Exact-product readiness | Output/lifecycle | Proof/status |
|---|---|---|---|---|---|---|---|
| `tools.textile.upgrade_optional` | one neutral group: `microfiber_towel`, `smooth_cotton_cloth`, or `drying_wrap`; reported suitable form first | `frottee` creates `optional`; reported suitable form is use-yours; `rough_rubbing` changes guidance only; `no_towel` suppresses product output | attach to the existing post-wash drying event; no separate cadence | always correct reported rubbing to gentle press/scrunch; no material-superiority claim | shared identity/image/price/link plus recognized type and supported job only | one collapsed optional group; after user choice, at most one example; reported form prevents duplicate purchase; opt-in/acquisition precedes exact executable use | fixtures 20-21, 104-107, 113-115; `confirmed` |
| `tools.textile.plop` | an existing suitable T-shirt/wrap can execute; one `drying_wrap` may appear as optional convenience only | wavy/curly/coily plus `curl_definition`; explicit `no_towel` is the override; never assume existing technique or textile ownership | after relevant Leave-in/styling application and before air or diffuser drying; required technique on the active route, no universal duration | gather/scrunch gently; do not rub or twist tightly; exact verified directions override | no exact product is required; optional example needs only shared card data plus type/job | technique remains executable with a suitable ordinary T-shirt; reported suitable textile is use-yours; optional wrap never becomes a basis product | fixtures 108-112; `confirmed` |

All drying-textile decisions are complete for the current pass. The category separates behavior guidance from product need: rough rubbing can require correction without a purchase, and plopping can be a default routine technique without requiring a dedicated wrap.

## Cross-category reconciliation checklist

- **`D12` confirmed:** adopt this checklist as one global ownership package. One physical product appears on one card with one shopping/acquisition state and may list several supported product types/capabilities. Triggering routes supply their reasons and routine occurrences without cloning the product card.
- Heat protection is covered once at the portfolio level for every heated occurrence, through a verified Leave-in capability or a separate Heat-protection product; Tools must not silently duplicate the product.
- A sectioning aid is owned by its product category but attached to the parent styling/wash/application event that creates the need.
- A shower detangler and foundational brush/comb cannot create duplicate detangling requirements.
- A soft tie used overnight cannot create duplicate Clips/ties and Night Protection cards for the same physical product.
- An air multi-styler covering drying and styling appears once while contributing to both relevant occurrences.
- Gentle towel handling remains guidance even when no textile purchase is recommended.
- Optional-product opt-in and acquisition are prerequisites for executable occurrences; reference cards and shop-link clicks are not acquisition.

## Decision log

| Date | ID | Decision | Status | Consequence |
|---|---|---|---|---|
| 2026-08-04 | `D01` | One entry represents a conditional product route: category + product type/capability path + routine event. | `confirmed` | Guidance and fixtures can vary by event while visible category/product labels and exact-product deduplication stay intact. |
| 2026-08-04 | `D13` | Use a lean eight-part route matrix linked to separate runtime, product-spec, protocol, evidence, and lifecycle authorities. | `confirmed` | The matrix remains reviewable and complete without duplicating product rows, protocol facts, or full copy. |
| 2026-08-04 | `A01` | Haartrockner & Luftstyler has three internal paths: standard drying, diffuser drying, and air shaping/drying. | `confirmed` | Föhn, Warmluftbürste, and Air Multi-Styler remain product types; diffuser/concentrator do not become categories. |
| 2026-08-05 | `A02` | Air shaping may create an independent `basis` recommendation. | `confirmed` | A matching profile may receive a Warmluftbürste/Air Multi-Styler route in addition to the ordinary drying route; product deduplication still applies. |
| 2026-08-05 | `A03` | Independent air shaping requires `volume` plus a planned blow-dry route. | `confirmed` | Curl definition maps to diffuser drying; frizz/shine do not create another device need; air-drying volume support stays optional. |
| 2026-08-05 | `A04` | Prioritize a reported viable air-shaping approach; otherwise compare Warmluftbürste, Air Multi-Styler, and—after `B08`—Föhn plus Rundbürste neutrally. | `confirmed` | No invented profile selector or new question; exact examples still require verified volume capability and protocol facts. |
| 2026-08-05 | `A05` | Require diffuser capability for reported diffuser drying, or wavy/curly/coily hair with `curl_definition` plus a planned blow-dry route. | `confirmed` | Goal-matched users may receive an improved diffuser path without implying they already use the technique; users without the goal are not routed by texture alone. |
| 2026-08-05 | `A06` | Do not ask a diffuser-inventory question for a broadly reported dryer; stay conditional and keep the verified fallback as reference. | `confirmed` | Unknown attachment compatibility never becomes a confident claim or an automatic shopping item. |
| 2026-08-05 | `A07` | A missing standard-drying route recommends a conventional Föhn. | `confirmed` | Basic drying does not produce a three-form choice; reported alternative airflow forms count only conditionally when their device supports full drying. |
| 2026-08-05 | `A08` | Treat the concentrator as an assumed normal accessory for route logic, not as a verified readiness requirement. | `confirmed` | No separate route or data gate; exact package inclusion is displayed only when verified, avoiding an unnecessary invented product claim. |
| 2026-08-05 | `A09` | Model pre-drying and air shaping as two linked tool occurrences inside one styling session and shared cadence. | `confirmed` | The UI/compiler may preserve two distinct tool steps without double-counting weekly frequency; exact protocol decides device/mode, starting state, and sequence details. |
| 2026-08-05 | `A10` | Require pre-dry capability rather than a separate Föhn product. | `confirmed` | A verified Multi-Styler can fill both linked occurrences; otherwise a Föhn and focused air-shaping product may both be required. |
| 2026-08-05 | `A11` | Map Heat-protection product tier by tool exposure: ordinary/diffuser `not_needed`, air shaping `optional`, direct-contact high heat `basis`. | `confirmed` | Tools emits the dependency tier while portfolio ownership resolves a verified Leave-in or separate Heat protectant; behavioral safety guidance remains independent of product inclusion. |
| 2026-08-05 | `H01` | Hitzestyling remains product-type first; three job directions map to atomic capability arrays on product types/exact products. | `confirmed` | Jobs drive matching but never replace Glätteisen, Lockenstab, Thermoroller, Heizbürste, or Multi-Styler as the visible product identity. |
| 2026-08-05 | `H02` | Store allowed jobs at product-type level and verified capabilities at exact-product level. | `confirmed` | Stage 1 can name a generic type; Stage 2 requires exact evidence and does not inherit every potential type capability optimistically. |
| 2026-08-05 | `H03` | Keep one broad `Heizbürste` product type rather than splitting straightening and heated round-brush forms. | `confirmed` | The exact product owns the supported job subset, so the broad type label never proves straighten, smooth, volume, or setting capability by itself. |
| 2026-08-05 | `H04` | Use the conservative allowed-job map for heated product types. | `confirmed` | Stage 1 stays recognizable and product-led; technique-dependent secondary tricks require exact-product proof and do not widen the generic type. |
| 2026-08-05 | `H05` | Use reported Glätteisen use as the only V1 straightening-intent signal; add no question and infer nothing from adjacent goals. | `confirmed` | Existing users receive owned-tool application/safety guidance without a shopping need; non-users are not offered straightening tools. Aggregate heat frequency is used only when attribution is safe. |
| 2026-08-05 | `H06` | Trigger created curl/wave styling only from reported tool use; keep `curl_definition` about the natural pattern. | `confirmed` | Lockenstab/Welleneisen/Thermoroller users retain relevant guidance and may see the neutral alternative; the engine does not recommend curl-creation tools to non-users from natural definition alone. |
| 2026-08-05 | `H07` | Resolve volume/set once across Airflow, heated, and heatless approaches. | `confirmed` | A user may compare viable approaches, but the plan never turns one volume goal into three simultaneous product requirements. Standard drying remains distinct. |
| 2026-08-05 | `H08` | Use only the explicit canonical `volume` goal to create the proactive volume/set need. | `confirmed` | Structural/cosmetic signals and reported ownership never invent a styling goal; existing users can still retain compatible tools and guidance. |
| 2026-08-05 | `H09` | Preserve the current drying behavior when presenting volume/set approaches. | `confirmed` | Air shaping is co-equal when blow-drying is planned and optional for air-dryers; heated and heatless setting remain neutral choices rather than inferred preferences. |
| 2026-08-05 | `H10` | Keep ambiguous reported-tool coverage conditional and ownership-first. | `confirmed` | Unknown exact capability yields `use yours if compatible` plus reference coverage, never a fabricated claim or automatic duplicate purchase. |
| 2026-08-05 | `H11` | Extend the existing tool-ownership input to include heatless styling forms. | `confirmed` | Ownership-first priority works symmetrically for heated and heatless approaches without inventing a goal or relying on acquisition as the first ownership signal. |
| 2026-08-05 | `H12` | Collect styling-tool ownership family-first, then conditionally drill into four heatless form groups. | `confirmed` | The initial screen stays light while route resolution receives recognizable product-type information; users who do not select Heatless see no unnecessary drilldown. |
| 2026-08-05 | `H13` | Gate exact heatless products on the route-critical protocol minimum. | `confirmed` | Product guidance is executable without requiring an exhaustive feature catalog; missing use-state/setup facts remain unknown and block confident exact recommendation. |
| 2026-08-05 | `H14` | Gate exact heated tools on the safety-critical protocol minimum rather than a full feature comparison. | `confirmed` | Recommendations remain minimal and elegant while still supporting correct use-state, control, attachment, and product-specific guidance. |
| 2026-08-05 | `H15` | Treat reported Heat-protection use as full dependency coverage. | `confirmed` | The plan trusts the user, does not recommend a duplicate protectant, and avoids adding compatibility caveats; unsupported exact protection temperatures still remain unstated. |
| 2026-08-05 | `H16` | Offer the selected styling method after every wash as an optional branch. | `confirmed` | Application guidance has a stable routine location while the UI explicitly avoids asserting that styling happens on every wash day; heat frequency stays contextual. |
| 2026-08-05 | `H17` | Split heated-tool fallback by contact mode and keep it separate from Heat-protection application. | `confirmed` | Gliding tools explicitly stay in motion; curling/setting tools use verified hold-and-release timing. Generic guidance never invents one universal temperature or pass count. |
| 2026-08-05 | `B01` | Give every user one foundational handling method; fingers fully cover it only for `very_short`, while `short+` requires one compatible physical comb/brush. | `confirmed` | The engine avoids a meaningless very-short purchase but still guarantees a physical foundation once there is enough length for detangling/distribution. |
| 2026-08-05 | `B02` | Use the conservative texture-aware Grobzinkiger-Kamm versus Detangling-Bürste foundation map. | `confirmed` | Curly/coily and definition-led wavy profiles default to the comb; straight and other wavy profiles to the detangling brush; compatible reported alternatives remain valid. |
| 2026-08-05 | `B03` | Make `detangle` the required short-or-longer foundational capability. | `confirmed` | Specialized smoothing/distribution/styling forms remain useful but cannot falsely close the basic detangling requirement. |
| 2026-08-05 | `B04` | Let any reported physical brush/comb normally suppress another foundational purchase. | `confirmed` | The plan stays minimal and respects ownership without fabricating wet-detangling or other capabilities for a broad form. |
| 2026-08-05 | `B05` | Reopen the texture-aware detangling recommendation for explicit tangling or a friction-heavy reported form. | `confirmed` | Concrete mismatch evidence can correct the foundation while preserving the reported brush for a legitimate secondary job. |
| 2026-08-05 | `B06` | Use pattern-aware wet/damp/partly-dry fallback guidance for foundational detangling. | `confirmed` | Application guidance is useful without pretending the user's current technique is observed; verified exact-product use state remains authoritative. |
| 2026-08-05 | `B07` | Keep specialized brushes/combs subordinate and job-bound in the collapsed optional area. | `confirmed` | The plan shows one foundation and does not turn every texture or possible function into a multi-brush kit. |
| 2026-08-05 | `B08` | Add Föhn plus Rundbürste as a manual approach inside the shared volume need. | `confirmed` | It competes with other air/heated/heatless approaches and counts once; it is never an additional volume requirement. |
| 2026-08-05 | `B09` | Map Definitionsbürste, Pick, dry-styling brushes, and Stielkamm to explicit parent jobs. | `confirmed` | Complete product-type coverage remains available without automatic purchases from texture alone. |
| 2026-08-05 | `B10` | Move scalp brushes, applicators, and water spray bottles to Wash/Application ownership. | `confirmed` | These tools resolve from actual scalp-product, wash, or refresh events rather than bloating the Brushes/Combs foundation. |
| 2026-08-05 | `B11` | Keep exact brush/comb qualification minimal: type/job, relevant use state, and heat compatibility only. | `confirmed` | Stage 2 recommends a suitable tool type and concrete example without becoming a detailed geometry/material comparison platform. |
| 2026-08-05 | `B12` | Place foundational handling in the texture-appropriate wash-routine phase. | `confirmed` | Curly/coily/definition-led wavy use the conditioned wet/damp phase; straight/other wavy use a partly-dry phase; very-short fingers do not create another step. |
| 2026-08-05 | `B13` | Extend and group the ownership input with specialized recognizable brush/comb forms. | `confirmed` | Use-yours priority can recognize Vent-, Definitionsbürste, Pick, and Stielkamm without adding separate onboarding pages or new goals. |
| 2026-08-05 | `C01` | Allow securing aids only under four named parent events, always optional. | `confirmed` | Sectioning/application, selected set support, selected Night Protection, and explicit-volume root clipping may activate the family; structure alone and catalog presence cannot. |
| 2026-08-05 | `C02` | Resolve each eligible parent to one minimal securing form and suppress bundles. | `confirmed` | Owned compatible forms get priority; Sectioning-Clip, exact set-support piece, soft Night tie/Scrunchie, or Root-Volume-Clip remains job-specific. |
| 2026-08-05 | `C03` | Collect broad securing ownership through the progressive family-first tool drilldown. | `confirmed` | Use-yours priority works without exposing irrelevant questions or inferring ownership from behavior. |
| 2026-08-05 | `C04` | Always provide the short low-tension/loosen-if-it-pulls application fallback. | `confirmed` | Users receive concrete safe-use guidance without the engine pretending to observe their technique; exact parent protocol may be stricter. |
| 2026-08-05 | `C05` | Defer required set-support inclusion/compatibility until exact styling products are defined in Stage 2. | `deferred` | V1 does not manufacture a mandatory clip purchase; unresolved required securing pieces keep the parent exact route unready. |
| 2026-08-05 | `C06` | Require only identity/link plus type/job for exact Clips/Ties examples. | `confirmed` | The supporting category does not receive a detailed fit, dimensions, material, or hold-strength model. |
| 2026-08-05 | `C07` | Merge active securing support into one collapsed optional Stage 1 result and one linked Stage 2 example. | `confirmed` | Internal parent context remains correct while the user never sees a comparison grid or several low-impact accessory cards. |
| 2026-08-05 | `W01` | Limit proactive Wash/Application aids to targeted scalp-product application and selected curl/wave refresh; keep scalp brush reported-use-only. | `confirmed` | Scalp signals do not manufacture a tool need, and shower detangling/sectioning are deduplicated to their existing owners. |
| 2026-08-05 | `W02` | Use one simple generic form per allowed event: applicator bottle or water spray bottle; keep reported scalp brush only. | `confirmed` | The category avoids unnecessary comparisons and removes the duplicate shower-detangler type. |
| 2026-08-05 | `W03` | Collect Wash/Application ownership through one tiny conditional family drilldown. | `confirmed` | Use-yours priority can work for scalp brushes, applicators, and spray bottles without lengthening onboarding for everyone. |
| 2026-08-05 | `W04` | Merge Wash/Application into one collapsed optional result and one simple Stage 2 example. | `confirmed` | Targeted application wins example priority over refresh; exact products need only identity/link plus type/job; the category stays low salience. |
| 2026-08-05 | `N01` | Preserve the broad existing Night Protection optional triggers, including generic healthier/strengthening goals. | `confirmed` | Long hair, named concerns, curl/frizz goals, and broad health/strength goals may show the option; breakage plus independent friction only changes optional priority. |
| 2026-08-05 | `N02` | Select one reason-based main Night Protection form when none is reported. | `confirmed` | Length/end problems map to a sleeve, pattern-definition to a bonnet, and other cases to a pillowcase; soft ties remain subordinate. |
| 2026-08-05 | `N03` | Prioritize a reported Night Protection method and allow at most one genuinely different mapped alternative. | `confirmed` | Existing behavior is respected without a four-product bundle or unsupported claim that the owned broad form is wrong. |
| 2026-08-05 | `N04` | Preserve a reported Night Protection method in the nightly routine even without another trigger, but create no need/card from ownership alone. | `confirmed` | Current behavior remains visible; unreported options require opt-in/acquisition before a nightly occurrence becomes executable. |
| 2026-08-05 | `N05` | Use minimal functional exact-product facts for Night Protection. | `confirmed` | Type, coverage, material, and worn-form closure are enough; the category avoids detailed textile/measurement comparisons and unsupported outcome claims. |
| 2026-08-05 | `N06` | Use comfortable-coverage/loose-fit guidance and modest friction/containment claims. | `confirmed` | Exact forms remain executable without implying repair, growth, or guaranteed breakage prevention. |
| 2026-08-05 | `T01` | Present microfiber towel, smooth cotton/T-shirt, and wrap/turban as one neutral optional upgrade group. | `confirmed` | Existing inputs do not select a superior material/form; a reported form is prioritized and the user never receives three product requirements. |
| 2026-08-05 | `T02` | Keep rubbing correction independent from material/product need and preserve `no_towel`. | `confirmed` | Rubbeln always receives firm press/scrunch guidance; Frottee may be optional; no towel creates neither a purchase nor an invented technique. |
| 2026-08-05 | `T03` | Make plopping the default wash-routine technique for curl-definition patterns. | `confirmed` | Wavy/curly/coily plus `curl_definition` receives the step; explicit `no_towel` remains the override and no current-technique compliance is assumed. |
| 2026-08-05 | `T04` | Require the plopping technique but keep a dedicated wrap product optional. | `confirmed` | A suitable existing T-shirt/wrap can execute the route; one linked wrap is convenience, not a mandatory purchase. |
| 2026-08-05 | `T05` | Place default plopping after relevant product application and before air or diffuser drying. | `confirmed` | The technique becomes an executable routine step without inventing one universal duration; guidance stays gentle and avoids tight twisting. |
| 2026-08-05 | `T06` | Use product type/job only for optional exact drying-textile examples. | `confirmed` | The engine can show a recognizable example without ranking textiles by unverified quality, absorbency, dimensions, weight, thickness, or closure. |
| 2026-08-05 | `D12` | Adopt one global cross-category owner and deduplication package. | `confirmed` | One physical product/card and lifecycle may support several capabilities and occurrences; route reasons do not duplicate cards, products, or shopping state. |
| 2026-08-05 | `D14` | Preserve a valid generic recommendation when no exact product qualifies. | `confirmed` | Stage 2 shows a visible catalog gap and never hides the need or promotes a candidate with unknown required facts. |
| 2026-08-05 | `U01` | Use one family overview plus conditional product-type drilldowns. | `confirmed` | The onboarding stays compact and users see details only for families they report using. |
| 2026-08-05 | `U02` | Treat unchecked families as explicitly unused only after overview submission. | `confirmed` | Proactive recommendations can distinguish none from migrated/unanswered unknown without eight separate none controls. |
| 2026-08-05 | `U03` | Restrict generic capability inheritance to named simple product types in three families. | `confirmed` | A selected Clips/Ties, Wash/Application, or Drying Textile type may carry its generic job; there is no family-wide other option, and the later exact-card shortcut is limited to these three families. |
| 2026-08-05 | `U04` | Keep a need covered by reported ownership visible as `use yours`. | `confirmed` | The plan remains complete and actionable while suppressing shopping instead of hiding the recommendation. |
| 2026-08-05 | `U05` | Use four conditional related-category drilldown pages after the overview. | `confirmed` | Airflow; Heated + Heatless; Handling & Helpers; and Protection & Drying appear only when at least one contained category was selected. |
| 2026-08-05 | `I01` | Trust stored Heat-protection false for completed profiles; keep incomplete pre-question false unknown. | `confirmed, reversed 2026-08-24` | Reversed by gate `D9a`: no Personal Plan module reads `uses_heat_protection`, so the boolean stays unread and coverage is read per heat event from `protectionConsistency`. |

### 2026-08-24 gate rulings (`D1`-`D9`)

These are the nine spec gates Nick ruled on 2026-08-24; the ledger is `plans/2026-08-24-hair-tools-d1-d9-rulings.md`. **Namespace note:** the gate IDs `D1`-`D9` are a different namespace from the shared decision register `D01`-`D14` above; they are never the same decision.

| Date | ID | Decision | Status | Consequence |
|---|---|---|---|---|
| 2026-08-24 | `D1` | `volume_balance` stays merged; direction is inferred in-plan from texture and thickness via the ratified `volume-direction.ts` predicate, and `low_volume_or_weighed_down` triggers the volume routes and overrides the inference. | `confirmed` | Reverses `H08`. The shared-volume architecture (`A02`-`A04`, `H07`, `B08`) keeps a trigger and one predicate serves the whole plan; every inferred route must carry `tools.styling.volume_direction_inferred`. |
| 2026-08-24 | `D2` | Every ticked drying route counts; the dominant-drying-method concept is retired; „Nichts davon" is removed from the drying question and legacy `[]` is unanswered. `D2a`: `diffuser_or_airflow_shaping` is read as diffuser drying. `D2b`: the option restructure is queued post-Phase-1. | `confirmed` | Amends `A05` and `A11`; mixed sets and the empty set finally have rules; the behaviour answer never sets `capabilityVerified`. |
| 2026-08-24 | `D3` | `D3a` unticked overview card = „hat nichts", made fair by wiring the preselect helpers and rewriting the lead copy. `D3b` keep four section cards. `D3c` merge per form, never replace per family, for all eight families. | `confirmed` | `decision.md`'s eight-name overview description is corrected; the „wir behaupten nichts" promise is withdrawn; care-derived facts can no longer be silently overwritten by an answered Tool page. |
| 2026-08-24 | `D4` | Split `reportedOwnership` (with a `derived` marker) from `coverage` on `PlanToolRoute`; the card names their tool. | `confirmed` | `B04` sets coverage only; „Nutze deins" can no longer render for a form the user denied; terry-towel and `loose_tied` reports are stored as what the user said. |
| 2026-08-24 | `D5` | First-class `ToolChoiceGroup`: one card per need, members listed neutrally, fulfilled when any member is covered, reported member leads. | `confirmed` | Satisfies `A04`'s three-way choice, `H07` and `B08`; subsumes the ad-hoc neutral drying-textile group instead of keeping a special case. |
| 2026-08-24 | `D6` | The route's `recommendedProductTypes` order is authoritative; no downstream dedup, merge or projection may reorder it. | `confirmed` | Makes `B02`, `N02`, `W02` and `C02` testable; enforced by rendered-output tests plus an order-stability assertion in `buildToolPlan`. |
| 2026-08-24 | `D7` | Adopt `APPLICATION_SEQUENCE_ANCHORS` as the shared day graph and derive `ToolPlacement` from it; add `nightly` and `styling_session` after `dry_finish`. | `confirmed` | `T05`, `B12` and `A09` get real positions; tool and product steps interleave by construction instead of by two drifting orderings. |
| 2026-08-24 | `D8` | Standing rule: any change to a persisted refinement answer key or to the completion predicate's meaning requires a path-version bump plus a decoder; completed rows validate against their completion-time contract. | `confirmed` | Enforced by a schema-snapshot test. Governs the „Nur Finger" option, the drying-question change and the `D2b` restructure. |
| 2026-08-24 | `D9a` | Heat-protection coverage is `heatEvents[…].protectionConsistency`, per event; only `always` is covered. | `confirmed` | Rewrites `H15`, amends `A11`, retires fixtures 122 and 123 as impossible, leaves the legacy boolean unread. |
| 2026-08-24 | `D9b` | Add an explicit „Nur Finger" non-product option to `Bürsten & Kämme`. | `confirmed` | „Nichts davon" stops doing double duty; the `B01`/`B03`/`B04` finger exceptions become expressible. |
| 2026-08-24 | `D9c` | `manageability_styling` joins the `N01` Night-Protection trigger set. | `confirmed` | Treated as frizz-adjacent, consistent with the rest of the app; ends a silent exclusion by omission. |
| 2026-08-24 | `R1` | Drop the Stage-2 heat-protection question for the `diffuser_airflow_shaping` source now. | `confirmed` | Second-round ruling. `protectionConsistency` becomes forbidden for the source; `D8` applies: path-version bump + decode rule (stored values ignored on read, completed rows stay complete). |
| 2026-08-24 | `R2` | The definition-driven diffuser path and Definitionsbürste are gated to `wavy \| curly \| coily`. | `confirmed` | Second-round ruling. Straight + `shape_definition` activates no tool route from the definition goal; resolves fixture 4b. Amends `A03` and `B09`. |
| 2026-08-24 | `R3` | `boar_bristle` („Wildschweinborsten-Bürste") joins the `brushes_combs` product types and the Bürsten-page. | `confirmed` | Second-round ruling. Restores a legacy-onboarding brush form the new Tools page dropped; fixture 60 keeps its boar-bristle expectation. |
| 2026-08-24 | `R4` | `tools.night.optional_strong` trigger extends to `split_ends`. | `confirmed` | Second-round ruling. Restores V2 reachability of the strong Nachtschutz tier; fixture 15 gets a V2 variant. |

## Current checkpoint

The conditional-guidance matrix and additive asset/occurrence direction remain complete. PR #344 and the full five-stage Personal Plan are now merged and released. The production-current reconciliation and reconciled counterpart findings live in `plans/2026-08-12-personal-plan-hair-tools-current-shape.md`.

As of 2026-08-24 the nine spec gates `D1`-`D9` are ruled and amended into this tracker, `decision.md`, `input-mapping.md` and `fixtures.md`. What remains before implementation is unchanged in kind: the WS4 mockup pass for the `D3a` lead copy, the drying-question change and the „Nur Finger" card, plus Nick's final journey sign-off. Implementation authorization remains separate from this tracker.
