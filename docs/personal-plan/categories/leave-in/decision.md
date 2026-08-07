---
category: leave_in
document_type: decision
status: confirmed
decision_version: 4
last_reviewed_at: 2026-08-07
current_runtime_revision_reviewed: 6e2a0c55
evidence_file: docs/personal-plan/categories/leave-in/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/leave-in.ts
test_surface: tests/personal-plan/categories/leave-in.test.ts
---

# Personal Plan Leave-in decision

## Authority

This document is the confirmed implementation specification for wash-day and heat-event Leave-in behavior. It follows `docs/personal-plan/categories/category-design-framework.md`. Between-wash refresh remains a named but deliberately deferred event whose inclusion, product boundary, and application rules will be specified with the later day-type system.

The current recommendation engine and product tables informed this work but are not future runtime authority. The Personal Plan copies useful deterministic assessment rules into its plan-owned domain and consumes verified product facts through one canonical Leave-in specification.

## Intended user decision

The Personal Plan must tell the user:

- whether Leave-in belongs in the Bedarfsplan as `basis`, `optional`, or `not_needed`;
- which care, heat-preparation, or narrow Conditioner-replacement job it should perform;
- what formula weight, care direction, repair support, functions, heat capability, and application stages suit them;
- when the primary and any secondary Leave-in are used;
- whether each owned product fits its assigned role, has limitations, should be changed, or is still being reviewed;
- which one exact product fills an uncovered role and which valid format alternative is available when useful;
- how to apply each confirmed product inside the relevant routine event.

## Architecture and current-behavior treatment

Current runtime layers disagree on Leave-in inclusion: the intervention planner is broad, CareBalance adds an absent Leave-in only for frizz or tangling, Chat can make the category relevant from an explicit request, and `/routine` follows the narrower CareBalance result. The Personal Plan replaces this divergence with one direct category computation over canonical inputs.

| Area | Treatment |
|---|---|
| Canonical lossless profile, shared functional priority, plan coverage, product state, and four-state fit mechanics | `reuse` |
| Current `DamageAssessment` structural/heat/mechanical lanes, repair priority, balance context, drivers, missing inputs, and confidence | `adapt` into shared plan-owned `PlanDamageAssessment`; no runtime dependency |
| Existing heat-tool detection and definition context | `adapt` after mapping only lossless inputs |
| `product_leave_in_specs` format, weight, roles, heat facts, benefits, ingredient flags, and application stages | `reuse/adapt` as the canonical product-spec starting point |
| Axis-level fit facts and useful existing regression cases | `adapt` into the layered role-relative verdict |
| CareBalance frizz/tangling-only inclusion, Chat-request relevance, blended ranking bonuses, and strict legacy eligibility triples | `reject` as Personal Plan authority |
| `fine OR low density = replacement_capable` | `reject`; use the confirmed narrow fine-and-very-short exception |
| Missing thickness data still permitting an ideal verdict | `reject`; missing required suitability is `unknown` |

## Inputs and missing-data behavior

Consume canonical source answers directly for:

- texture, thickness, density, length, surface, and elasticity;
- chemical treatments;
- current concerns: dry lengths, frizz/flyaways, low shine, damage, split ends, breakage, lost shape, low volume/weighed down, and tangling;
- goals: moisture, surface/frizz, strength/ends, shine, volume balance, shape/definition, and manageability/styling;
- heat tools, heat frequency, Heat-protection use, and drying method;
- current product ownership, identity or pending state, and coarse frequency;
- shared `PlanDamageAssessment` and plan-wide function coverage.

Do not add a mandatory format-preference onboarding question. Format is a product comparison axis in Stage 2. Add a conditional clarification only when an existing answer cannot determine a material inclusion, safety, or application decision.

Shared `suitable_thicknesses = null` cannot produce a confident exact recommendation. A non-empty verified array containing the user's thickness passes; a non-empty array excluding it is a mismatch. Empty arrays are invalid for active recommendable products, and legacy empty arrays remain `unknown` until researched. Missing elasticity follows the shared Conditioner clarification policy because care direction must not be diagnosed from weaker proxies. Missing product heat or replacement evidence produces a role-specific `unknown`, not optimistic fit.

## Inclusion and category ownership

Leave-in is not a universal baseline. Product ownership never changes the underlying need tier.

### Exact tier mapping

| Rule ID | Canonical condition | Tier | Decisive job |
|---|---|---|---|
| `leave_in.inclusion.detangling` | `currentConcerns` contains `tangling` | `basis` | persistent post-wash detangling |
| `leave_in.inclusion.dry_rough` | `currentConcerns` contains `dry_lengths` and `hairSurface = rough` | `basis` | ongoing moisture, softness, and surface care |
| `leave_in.inclusion.dry_moisture_goal` | `currentConcerns` contains `dry_lengths` and `goals` contains `moisture` | `basis` | current dryness plus intended moisture outcome |
| `leave_in.inclusion.dry_tangling` | `currentConcerns` contains both `dry_lengths` and `tangling` | `basis` | moisture plus detangling; deduplicate with the direct tangling rule |
| `leave_in.inclusion.care_frizz` | `currentConcerns` contains `frizz_flyaways` plus `dry_lengths`, `hairSurface = rough`, or `tangling` | `basis` | care-led smoothing/anti-frizz |
| `leave_in.inclusion.intensive_treatment_care` | `chemicalTreatments` contains `lightened`, `permed`, or `chemically_straightened` | `basis` | ongoing leave-on care/protection for materially treated lengths, not primary repair ownership |
| `leave_in.inclusion.coily_texture` | `texture = coily` | `basis` | regular moisture retention and manageability support |
| `leave_in.inclusion.recurring_heat_care` | `heatFrequency` is `daily`, `several_weekly`, or `once_weekly`, and at least one qualifying Leave-in care signal below exists | `basis` | combined ongoing care plus event-based heat preparation |
| `leave_in.inclusion.single_care_signal` | only one of `dry_lengths`, `hairSurface = rough`, `goals` contains `moisture`, care-ambiguous `frizz_flyaways`, or `texture = curly` exists and no basis rule matches | `optional` | useful support without enough evidence for a confident baseline |
| `leave_in.inclusion.colored_only` | `chemicalTreatments` contains `colored` but no stronger treatment or basis signal | `optional` | incremental leave-on support for color-treated lengths |
| `leave_in.inclusion.definition_only` | `texture` is `wavy` or `curly` and `goals` contains `shape_definition` or concerns contain `lost_shape`, without a care-led basis signal | `optional` | care/shape preparation; Styling owns lasting definition and hold |
| `leave_in.inclusion.shine_only` | `goals` contains `shine` or concerns contain `low_shine`, without a care-led basis signal | `optional` | incremental shine support |
| `leave_in.inclusion.repair_only` | concerns contain `breakage` or `split_ends`, or goals contain `strength_ends`, without a stronger treatment or care-led basis signal | `optional` | repair support only; Conditioner, Mask, or Bondbuilder owns primary repair |
| `leave_in.inclusion.manageability_goal_only` | goals contain `manageability_styling` without actual tangling or another basis signal | `optional` | general ease of styling without a confirmed detangling problem |
| `leave_in.inclusion.no_job` | no basis or optional rule matches | `not_needed` | no confirmed Leave-in-relevant job |

Qualifying signals for `leave_in.inclusion.recurring_heat_care` are `dry_lengths`, `hairSurface = rough`, `goals` contains `moisture`, a corroborated care-frizz route, `texture` is `curly` or `coily`, `chemicalTreatments` contains `lightened`, `permed`, or `chemically_straightened`, or a material shared repair-support need. A material shared repair-support need means `PlanDamageAssessment.repairPriority` is `medium` or `high` and at least one structural or mechanical driver is present; a priority elevated by heat alone cannot corroborate the same heat rule. Tangling and several of these signals already produce `basis`; the heat rule mainly upgrades an otherwise optional care signal. Definition or shine alone does not qualify. Frizz alone remains ambiguous and does not qualify. Heat alone routes to Heat protectant.

Aggregate deterministically:

1. if any explicit `basis` rule matches, return `basis`;
2. otherwise, if any explicit `optional` rule matches, return `optional`;
3. otherwise return `not_needed`;
4. do not promote arbitrary pairs of optional signals—only the named corroborating combinations and recurring-heat rule may promote them;
5. product ownership never changes the need tier;
6. thickness, density, and length normally change target fit, amount, and distribution rather than inclusion. The separately defined fine-and-very-short Conditioner-replacement case still requires a material Leave-in job.

Confirmed ownership boundaries:

- persistent post-wash tangling/detangling is a primary Leave-in job;
- distributed dry/rough/flyaway frizz can be a primary Leave-in job when dryness, rough surface, or tangling corroborates the care interpretation;
- humidity/shape-retention frizz, durable definition, hold, and cast belong primarily to Styling;
- localized dry-end polish and immediate finishing shine may belong more directly to Oil/serum;
- moisture/softness without an unresolved post-wash problem is normally supporting because Conditioner is the baseline;
- verified heat protection may be combined into Leave-in when a compatible care job exists; heat need alone routes to a dedicated Heat protectant rather than creating Leave-in need;
- coily texture alone makes Leave-in `basis`; curly texture alone makes it `optional`; wavy texture alone does not create Leave-in need;
- a definition goal without a conditioning/manageability problem makes Leave-in `optional`; Styling owns lasting definition;
- a shine goal alone makes Leave-in `optional`;
- damage/repair alone makes Leave-in at most `optional`. Leave-in is always supporting for repair and never the primary repair owner;
- the fine-and-very-short Conditioner-replacement capability does not create Leave-in need by itself. A material conditioning or other Leave-in job must still exist.

Inference for frizz:

- `frizz_flyaways` plus dry lengths, tangling, or rough surface supports the care route;
- `frizz_flyaways` plus lost shape or a definition-led pattern supports the Styling route unless a separate care signal is also present;
- frizz without corroborating context is ambiguous and cannot by itself justify a confident Leave-in `basis` decision.

Definition and shape follow the same ownership boundary: wavy or curly texture plus a definition goal/lost-shape concern is `optional` when no care need exists. Adding dryness, roughness, tangling, or care-led frizz makes Leave-in `basis` for care and shape preparation, while Styling may still be required for durable hold. Coily hair is already `basis` from its regular care need; do not claim that Leave-in alone creates a lasting cast.

Damage follows two distinct routes. Lightening, perming, or chemical straightening creates `basis` for ongoing care/protection even without another concern, but Leave-in remains supporting rather than primary for repair. Color alone, breakage/split ends, a strength/ends goal, or generic repair need is only `optional` unless another care-led basis trigger exists. Never describe this as permanent repair or split-end reversal.

## Target profile

Leave-in target fit uses independent axes. A product must not become richer merely because it offers repair or more benefits.

### Weight

Thickness is the anchor:

- fine = `light`;
- normal = `medium`;
- coarse = `rich`.

Explicit low-volume/weighed-down sensitivity may shift the target one level lighter, clamped at `light`. Density and length affect amount and distribution rather than formula weight by themselves. Dryness, damage, texture, and elasticity alter care direction, functions, repair support, and application—not the weight target directly.

### Care direction

Reuse the shared contextual elasticity assessment confirmed for Conditioner:

- `stretches_stays` anchors protein-oriented;
- `snaps` anchors moisture-oriented;
- `stretches_bounces` anchors balanced.

Chemical treatment, surface, dryness, roughness, tangling, breakage, and goals may reinforce or neutralize the anchor but do not create a diagnostic deficiency claim. The product target is `moisture | balanced | protein`.

### Repair support

Reuse `PlanDamageAssessment.repairPriority`; do not compute a second `repairNeed`. Verified products expose `repairSupportLevel: low | medium | high`.

Leave-in repair is always plan-wide `supporting` coverage:

- it never triggers `basis` by itself;
- it never becomes the primary repair owner;
- its level ranks otherwise suitable products when repair need exists;
- absence of repair support does not invalidate a product that covers all assigned primary Leave-in jobs;
- Conditioner provides regular baseline repair care, while Mask or Bondbuilder owns intensive or specialized repair.

Two medium-support products are not arithmetically upgraded to high coverage. The portfolio records complementary ownership rather than adding uncalibrated scores.

### Format

Retain verified product formats `spray | milk | lotion | cream | serum`. Format and weight are independent product facts; do not infer weight from format or name.

Format is not an onboarding input or core fit requirement. Stage 2 may show one primary recommendation and one genuinely suitable format alternative. Both must pass strict suitability, weight, assigned functions, and heat requirements. The comparison states shared fit first and then the meaningful trade-off, such as lightweight spray distribution versus targeted lightweight cream application.

### Functional capabilities

V1 plan functions are:

- `detangle`;
- `moisture_softness`;
- `smooth_anti_frizz`;
- `heat_protect`;
- `repair_support`;
- `curl_shape_support`;
- `shine_support`.

`volume` is not a primary Leave-in job. Lightweight fit may preserve volume, but root lift and material volume creation belong to Styling. Genuine hold/cast is not a Leave-in capability unless a verified hybrid is also classified for Styling. `between_wash_care_refresh` is reserved and deferred.

Map matched concern/goal pairs through the shared priority scale:

- `3`: current problem plus matching goal;
- `2`: current problem only;
- `1`: goal only.

Examples include tangling plus manageability/styling for priority `3`, tangling alone for `2`, and shine goal alone for `1`. Priority ranks material needs; shared plan ownership determines whether a capability is `required` or `supporting` for this category. Missing an assigned required capability is a mismatch; missing a supporting benefit is only a ranking/explanation limitation when the plan covers the job elsewhere.

## Heat ownership and product minimization

Use a strong one-product bias:

- recurring heat means `daily`, `several_weekly`, or `once_weekly`; `rarely` does not upgrade the regular Leave-in tier;
- recurring heat plus a qualifying Leave-in care signal makes Leave-in `basis` and creates an event-based heat-protection requirement at portfolio level;
- prefer one product combining verified heat protection with the required care functions when it passes all core fit gates;
- the care job may be mild, but strict thickness, weight, care, and application fit still pass;
- an already-owned or otherwise suitable care Leave-in plus a separate suitable Heat protectant is equally valid coverage and does not require replacement merely to consolidate products;
- if no suitable combined product exists, use a care Leave-in plus a dedicated Heat protectant;
- heat need without a legitimate Leave-in care job routes directly to Heat protectant;
- a Leave-in counts as Heat protection only from explicit verified product evidence. Heat-compatible directions, ingredients, format, or `styling_prep` alone do not qualify it;
- follow the exact product's verified damp/dry/either application and reapplication instructions. A claimed maximum temperature never ranks, gates, or strengthens Heat-protection fit.

Stage 1 keeps one Leave-in category card and shows the applicable use-case pills:

- `Pflege nach der Wäsche` for the post-wash care role;
- `Hitzeschutz vor dem Styling` only when recurring Heat plus a legitimate Leave-in care need creates the separate portfolio-level Heat-protection requirement.

Moisture, detangling, smoothing, definition, shine, and repair support remain product functions or target axes; they do not create separate Leave-in use cases or purchases. Conditioner replacement is a special mode of the post-wash role, not another simultaneous role. Between-wash refresh remains deferred.

Stage 2 first accepts any already-suitable combined or two-product setup. It prefers one verified Leave-in that covers both included roles, but may assign a care Leave-in plus another Heat-protective Leave-in or a dedicated Heat protectant when necessary. Stage 2 recommends a new product only for an uncovered role. The user confirms every proposed portfolio change.

## Conditioner relationship

Conditioner remains the normal baseline. Leave-in may replace it only in the narrow `thickness = fine` and `hair_length = very_short` profile when a material conditioning/Leave-in need exists and the verified product is `replacement_capable`.

Low density alone is not replacement eligibility. Fine but medium/long hair continues to receive a lightweight rinse-out Conditioner through the lengths. The replacement Leave-in is used after shampoo without rinse-out Conditioner. Bondbuilder treatment protocols such as K18 remain separate category behavior and are not Leave-in replacement evidence.

## Occurrences, frequency, and day allocation

Confirmed occurrence types:

- `post_wash_leave_in`;
- `pre_heat_application`;
- `between_wash_care_refresh` — reserved now; inclusion, product boundary, and cadence deferred to the day-type work.

Frequency is compiled from occurrences rather than a separate weekly Leave-in guess:

- basis care Leave-in: once after every eligible wash;
- Conditioner replacement: once after every eligible wash in place of Conditioner;
- combined care plus heat product: post-wash according to its care role and before the associated heat event according to verified directions;
- heat protection is event-based and must be handled before every later heat exposure; a prior wash-day application is not assumed to protect a separate non-wash heat event;
- definition support: on wash-day types where waves/curls are intentionally defined;
- optional products enter executable recipes only after the user confirms them;
- verified product-specific protocol overrides the category fallback.

Meaningful between-wash use exists for some Leave-ins and Oils and may act as shared bridge care between wash days. Do not exclude it or assign a universal numeric cadence. Define its category ownership, eligible products, triggers, and instructions together with the later non-wash day types.

## Multiple products

Reuse shared cross-category roles:

- `primary`: the suitable active product used most frequently or confirmed as the default;
- `secondary`: another active product used less frequently, for a narrower occurrence, or interchangeably by confirmed preference;
- owned inactive: retained and evaluated in the library but not compiled into the routine.

Most users receive only a primary Leave-in. Prefer one product that covers every required occurrence. If several owned products are equivalent, do not invent a usage split. If only one has verified heat protection, only it may cover `pre_heat_application`. Primary is normally the product with the most planned occurrences; equal frequency uses the user's confirmed default. Changing primary/secondary requires confirmation.

Occurrence assignment explains when primary and secondary products appear; it does not replace their shared labels.

## Product-data authority

Use one canonical Leave-in product specification. Start from `product_leave_in_specs` and extend it only for confirmed gaps. The plan evaluator consumes verified product facts once and derives role-relative fit facts.

Required canonical facts are:

- product identity, lifecycle, safety/exclusions, and verified suitable thicknesses;
- `format` and `weight`;
- `careDirection: moisture | balanced | protein`;
- `repairSupportLevel: low | medium | high`;
- Conditioner relationship/roles;
- granular functional capabilities;
- nullable verified `provides_heat_protection` with tri-state semantics: `true` verified yes, `false` verified no, `null` unverified;
- multiple supported application stages;
- verified product protocol where available.

For Personal Plan Heat coverage, the capability is deliberately binary. The current non-null false default conflates unreviewed with verified-no and therefore requires a guarded nullable migration and consumer backfill. The legacy `heat_activation_required` field and claimed maximum-temperature values are not Personal Plan fit or ranking axes. Any material activation, application-state, or reapplication instruction belongs to the exact verified product protocol.

Do not retain `product_leave_in_fit_specs` or strict eligibility triples as independently editable authorities. Any compatibility projection is derived from the canonical specification. Do not add refresh-specific product fields until the deferred event is specified.

## Role-relative fit

Use the shared four-state vocabulary:

- `ideal` = `passt sehr gut`;
- `supportive` = `passt mit Einschränkung`;
- `mismatch` = `wechseln empfohlen`;
- `unknown` = `noch in Prüfung`.

### Global gates

Apply before any role:

- resolved identity and non-pending review;
- safety and strong exclusions;
- verified suitable thicknesses containing the user's thickness.

Missing strict suitability is `unknown`; a verified exclusion is `mismatch`.

### Core axes

- same weight level = exact;
- one level lighter/richer = supportive;
- two levels apart = mismatch;
- same care direction = exact;
- `balanced` bridging a moisture/protein target or product = supportive;
- direct moisture/protein opposition = mismatch when care direction is assigned as required;
- format never rescues or breaks core fit.

### Assigned-role requirements

- `post_wash_leave_in`: weight, care direction, assigned required functions, and compatible damp/wet stage;
- `pre_heat_application`: `provides_heat_protection = true` plus a verified protocol that supports the required damp, dry, or either application state for that occurrence;
- Conditioner replacement: verified replacement capability, suitable conditioning profile, and replacement protocol.

A product can be ideal for care and a mismatch for heat. The UI must say this directly, for example: “Passt sehr gut für deine Pflege nach dem Waschen. Nicht als Hitzeschutz geeignet.” If a secondary product covers heat, the primary care product does not need replacement. If the role remains uncovered, recommend a valid combined replacement or a separate Heat protectant.

Aggregate precedence follows unresolved/pending identity, safety/exclusions, strict thickness, hard assigned-role mismatch, missing required data, supportive deviations, then ideal. Retain every axis fact for expanded explanation.

## Reconciliation and exact recommendation

Reuse the shared owned, pending, shopping, acquired, and informed-override lifecycle. Evaluate every owned product independently. A pending product stays visible but cannot enter an executable recipe. The plan supplies one exact verified recommendation for any uncovered required role.

When a valid format alternative exists, present one clear primary recommendation and one labelled alternative, compare their shared fit and their actual format/application trade-off, and let the user's choice become the confirmed living plan. Never manufacture choice by showing an inferior product.

## Application fallback

Verified product directions always override category guidance. For an ordinary care Leave-in without detailed stored directions:

1. Apply after shampoo and rinse-out Conditioner to towel-damp hair.
2. Start with a small amount.
3. Distribute through lengths and ends, concentrating on the areas that need it.
4. Avoid the scalp unless the product explicitly supports scalp use.
5. Do not rinse.
6. Continue with Styling or drying.

Profile/application adaptations:

- fine, short, or volume-sensitive hair uses less product and lighter distribution;
- coarse, long, dense, dry, tangled, or definition-led curly/coily hair receives conditional sectioning guidance;
- sectioning copy remains adaptive: divide the hair in half or into as many smaller sections as make even distribution comfortable; divide the intended total dose across sections rather than multiplying it;
- comb or rake for distribution/detangling; scrunch when supporting wave/curl formation;
- hold-producing Styling follows Leave-in;
- Conditioner replacement follows shampoo without rinse-out Conditioner;
- pre-heat dry/damp timing must follow verified product instructions.

Never invent pumps, sprays, waiting time, temperature, heat activation, or reapplication. The generic fallback is sufficient for ordinary care. Missing critical Heat-application, replacement, or special-treatment protocol remains role-specific `unknown`.

## Safety and overclaim boundaries

- Default to lengths/ends; scalp use requires explicit product support.
- Burning, itching, rash, swelling, or persistent irritation triggers stop-use guidance and suppresses optimization.
- Credit Heat protection only from explicit verified evidence and respect its limits.
- Do not promise permanent split-end repair, structural reversal, or elimination of existing damage.
- Repair language stays at verified support, reduced further breakage, improved manageability, or cosmetic surface improvement.
- If hair becomes heavy, coated, or sticky, first adjust amount, occurrence frequency, or product weight. Do not automatically prescribe stronger cleansing.
- Pending/unidentified products remain visible but out of executable recipes.

## Structured reasoning payload

Preserve:

- inclusion tier and decisive evidence;
- inferred care-versus-style frizz route and uncertainty;
- target weight, care direction, and their supporting inputs;
- functional needs, `3 / 2 / 1` priority, and required/supporting ownership;
- repair priority and Leave-in's supporting contribution;
- Heat and Conditioner relationship facts;
- occurrence/frequency source and primary/secondary allocation;
- product-level global gates, role fits, limitations, mismatches, and unknowns;
- verified protocol or category fallback facts;
- plan-wide coverage, proposed changes, overrides, and safety boundaries.

The later shared presentation pass chooses the two or three card-level facts. It must not discard the complete structured explanation.

## Confirmed fixture matrix

1. `leave-in-no-job`: normal straight profile, no relevant concern/goal/heat = `not_needed`.
2. `leave-in-replacement-eligible-no-job`: fine and very short, but no material job = `not_needed`; capability does not create need.
3. `leave-in-fine-short-replacement`: fine, very short, material dry/rough conditioning need = `basis`; light verified replacement-capable product can be ideal.
4. `leave-in-tangling-manageability`: fine, long, tangling plus manageability goal = `basis`; light detangling target, priority `3`.
5. `leave-in-care-heat-combined`: fine, dry lengths plus `once_weekly` blow-dry = `basis`; target one light combined care/heat product when no suitable protection is already owned.
6. `leave-in-care-plus-owned-heat-protectant`: owned care product is ideal post-wash and a separate owned Heat protectant fits the heat event; both roles are covered and no consolidation switch is proposed.
7. `leave-in-definition-goal-only`: wavy, definition goal, no care problem = `optional`; Styling owns hold.
8. `leave-in-coarse-curly-multi-need`: coarse, curly, rough/frizzy/lost-shape plus definition goal = `basis`; rich care/curl-support target; otherwise valid medium product is supportive.
9. `leave-in-lightened-care`: lightened hair without another concern = `basis` for ongoing care/protection; Leave-in remains supporting for repair.
10. `leave-in-repair-only`: breakage/split ends or strength goal without stronger treatment/care signal = `optional`; Conditioner plus Mask/Bondbuilder own repair.
11. `leave-in-pending-product`: category basis but owned identity pending = product `unknown`, excluded from recipes, exact verified alternative supplied.
12. `leave-in-primary-secondary`: three washes and one heat-styling wash; care product primary on normal washes, verified heat-capable secondary on heat wash.
13. `leave-in-one-product-all-occurrences`: one product fits care and heat; primary covers every applicable occurrence without another purchase.
14. `leave-in-dry-alone`: `dry_lengths` without corroboration = `optional`.
15. `leave-in-dry-rough`: `dry_lengths` plus `hairSurface = rough` = `basis`.
16. `leave-in-shine-only`: low-shine concern or shine goal alone = `optional`; Oil ownership remains deferred.
17. `leave-in-coily-alone`: coily texture without another signal = `basis`.
18. `leave-in-curly-alone`: curly texture without another signal = `optional`.
19. `leave-in-wavy-alone`: wavy texture without a relevant concern/goal = `not_needed`.
20. `leave-in-recurring-heat-care`: optional care signal plus `daily`, `several_weekly`, or `once_weekly` heat = `basis`.
21. `leave-in-rare-heat-care`: optional care signal plus `rarely` heat remains `optional`; protection is event-specific but does not reshape the regular Leave-in plan.
22. `leave-in-heat-only`: recurring heat without a Leave-in care signal = Leave-in `not_needed`; Heat protectant owns the job.
23. `leave-in-definition-only`: wavy/curly definition or lost shape without care signal = `optional`; Styling owns hold.
24. `leave-in-care-plus-definition`: patterned hair plus definition and care-led basis signal = Leave-in `basis` for care/shape preparation; no cast claim.
25. `leave-in-strict-thickness-mismatch`: otherwise attractive product excludes the user's thickness = mismatch.
26. `leave-in-weight-near-match`: strict gate passes, target rich/product medium = supportive.
27. `leave-in-missing-heat-proof`: product marketed for styling but explicit heat proof absent = unknown for pre-heat, still evaluated for care.
28. `leave-in-owned-override`: mismatch product kept by user remains executable with role-specific non-blocking advice.
29. `leave-in-sectioning-guidance`: long/dense/tangled or definition-led profile gets adaptive sectioning without invented section counts.
30. `leave-in-product-protocol`: verified directions override the category fallback.
31. `leave-in-no-valid-candidate`: no mismatch/unknown recommendation is promoted; plan exposes the uncovered role.
32. `leave-in-between-wash-deferred`: no automatic numeric refresh cadence is compiled in V1.
33. `leave-in-claimed-temperature-ignored`: two otherwise equivalent verified Heat-protecting Leave-ins with different claimed maximum temperatures remain equal on Heat capability; selection uses home-category fit, protocol compatibility, and stable shared tie-breakers rather than the temperature claim.

This fixture set is intentionally broad and does not predict production verdict distribution. Before implementation readiness, run the completed rules against representative profile combinations and the live verified catalog to detect excessive `supportive`/`unknown` results and catalog coverage gaps.

## Deferred shared dependencies

- `between_wash_care_refresh` inclusion, product boundary, cadence, and day recipe;
- final ownership matrix across Conditioner, Leave-in, Mask, Oil, Heat protectant, Bondbuilder, and later Styling;
- shared two-to-three-fact card salience and German presentation templates;
- live catalog completeness and migration/backfill plan for canonical Leave-in facts.
