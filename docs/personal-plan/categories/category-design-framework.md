# Personal Plan category design framework

## Purpose

Use this framework to grill and document one Personal Plan product category at a time. It turns current runtime behavior, product data, external evidence, and Nick-confirmed product decisions into one deterministic category specification without making the legacy recommendation engine a runtime dependency.

The framework is a planning checklist, not a category DSL or a code generator. A category is complete only when its `decision.md` answers every applicable category-owned question below and explicitly marks non-applicable questions as such.

## Architecture boundary

The Personal Plan has one plan-owned computation pipeline. Existing CareBalance, routine, recommendation, and catalog logic may provide proven rules or pure helpers, but each confirmed rule is implemented once inside the clean Personal Plan boundary.

Classify every current behavior before reusing it:

| Classification | Meaning | Action |
|---|---|---|
| `reuse` | Explicit, deterministic behavior with suitable inputs and tests | Copy or reuse the pure helper with parity tests. |
| `adapt` | Useful logic whose vocabulary, inputs, or output shape does not fit the Personal Plan | Rewrite it inside the category module and document the change. |
| `reject` | Accidental fallback, lossy adapter, Chat-specific constraint, stale assumption, or unsupported hard rule | Do not carry it into the Personal Plan. |
| `missing` | The current product does not answer the question | Grill the decision; research externally only when evidence is needed. |

External evidence and current internal behavior remain separate inputs. Neither becomes product policy until the category `decision.md` records the chosen rule.

## Shared mechanics versus category-owned decisions

Define shared mechanics once. A category specification records only its use of those mechanics and any justified exception.

| Shared Personal Plan mechanics | Category-owned decisions |
|---|---|
| Canonical lossless profile and clarification mechanism | Whether and why the category is `basis`, `optional`, or `not_needed` |
| Need-tier vocabulary and functional-need priority scale | Semantic jobs or roles within the category |
| Product inventory, pending review, shopping, acquisition, and override states | Target-profile axes and deterministic profile mappings |
| Versioned proposed/confirmed plan lifecycle | Category cadence and event triggers |
| Generic four-state fit vocabulary | Category-specific strict gates, fit axes, and thresholds |
| Plan-wide coverage ledger and later ownership matrix | Functions the category can serve as primary or supporting care |
| Generic exact-product reconciliation flow | Multiple-product and allocation behavior within the category |
| Product-protocol override mechanism and day compiler shell | Category application fallback, ordering, replacement, and recipe rules |
| Shared reason payload and later card-salience presentation pass | Category reason facts, uncertainty, and safety boundaries |

Do not introduce a category-local copy of shopping, versioning, confirmation, pending-product, or logging behavior.

## Required artifacts

Each category uses the same authority chain:

1. `evidence.md` records external sources, evidence strength, limitations, conflicts, and rejected overclaims.
2. `decision.md` records confirmed product policy, deterministic mappings, precedence, fallbacks, reason facts, and fixture intent.
3. The shared computation specification records only cross-category contracts and mechanics.
4. After implementation, the plan-owned category module, tests, and verified product/catalog protocols become runtime authority.

Current-engine exploration may remain transient when it merely locates code. Preserve an internal-behavior finding in `decision.md` only when it affects a reuse, adaptation, rejection, or missing-decision choice.

## Category grilling sequence

Work through these sections in order. Ask one consequential question at a time; checkpoint decisions after every few questions.

### 1. Category charter and user decision

Define:

- the category's precise job and non-jobs;
- what Stage 1 must tell the user about the need and product type;
- what Stage 2 must decide about owned, pending, and recommended products;
- what Stage 3 must compile into executable day instructions;
- adjacent categories whose responsibilities may overlap.

Completion test: a user can understand what decision this category resolves without naming a product.

### 2. Inputs and conditional clarifications

Inventory every input that may materially change a result:

- canonical hair, scalp, concern, goal, treatment, behavior, preference, budget, and exclusion fields;
- product ownership and verified product facts;
- shared assessments that may be copied or adapted;
- conditional follow-up questions required only for affected users.

For every input, record which decision it can change. Do not ask for or depend on an input that changes only explanatory copy. Define missing-input behavior explicitly: valid empty answer, deterministic fallback, reduced confidence, or typed clarification.

Completion test: the category consumes the lossless source answers and does not depend on a lossy legacy adapter.

### 3. Inclusion and need tier

Define deterministic thresholds for:

- `basis`: a confident category recommendation;
- `optional`: useful support without a strong enough universal need;
- `not_needed`: omitted from the ideal plan.

Specify precedence, signal deduplication, missing-data behavior, and edge cases. Product ownership never creates or removes the underlying category need.

Completion test: every representative profile receives one explainable need tier.

### 4. Semantic roles and target profile

Decide whether the category has one job or several semantic roles. Roles describe distinct purposes inside a catalog category; they are not new inventory categories. One verified product may cover several roles.

For each role, define:

- a stable role and purpose key;
- target-profile axes and allowed values;
- the exact input-to-target mapping;
- precedence when signals conflict;
- conservative fallback and confidence behavior;
- what the target must not claim or diagnose.

Keep axes independent when they answer different questions. For example, formula weight, care direction, repair support, and functional benefits must not be collapsed merely because one product can provide several of them.

Completion test: the target profile is sufficiently structured to judge a product without using free-form LLM reasoning.

### 5. Functional needs and plan-wide coverage

List the legitimate functions the category can perform. Map current problems and goals onto those functions using the shared priority scale:

- `3`: current problem plus matching goal;
- `2`: current problem only;
- `1`: goal only.

For each function, state whether the category can provide primary coverage, supporting coverage, or neither. During category grilling this may remain provisional; the final ownership matrix is locked only after adjacent categories are complete.

Core category fit takes precedence over counting functional benefits. Do not choose a fundamentally unsuitable product merely because it advertises more goals.

Completion test: the category exposes what it can cover without forcing itself to solve the person's whole plan.

### 6. Frequency, event trigger, and total cadence

Define:

- what creates one category occurrence;
- total frequency or range and its source inputs;
- whether the category follows another event, substitutes inside an event budget, or creates a separate day type;
- acute, maintenance, as-needed, or product-directed phases where applicable;
- what happens when exact product protocol data is unavailable;
- whether a response check or reassessment is required.

The category owns its total cadence. Product allocation distributes that total and never increases it implicitly. Current reported product frequency and recommended plan frequency remain separate facts.

Completion test: the same inputs always produce the same total category occurrences.

### 7. Multiple products and allocation

Define:

- whether one product normally covers the category;
- when distinct roles justify multiple recommended products;
- whether several suitable owned products are interchangeable or require a planned rotation;
- how primary/secondary placement is derived, if applicable;
- whether the same product can cover several roles;
- how unassigned, inactive, pending, shopping, and override products remain visible;
- what user confirmation is required when allocation changes.

Do not invent a per-product frequency split when products are simply interchangeable. Do not force a second purchase when one verified product covers every role.

Completion test: active product assignments cover the total cadence exactly, with no duplicate or missing occurrences.

### 8. Product facts, fit, and exact selection

First define the product facts required to judge the category:

- strict eligibility and exclusions;
- core target axes;
- verified functional benefits;
- exact application protocol facts;
- availability and budget facts used only after suitability.

Then define the category-specific layered fit model:

1. strict suitability and safety;
2. core formula or role fit;
3. need and functional coverage;
4. aggregate verdict and precedence.

Use the shared user-facing verdicts consistently:

- `ideal` → `passt sehr gut`;
- `supportive` → `passt mit Einschränkung`;
- `mismatch` → `wechseln empfohlen`;
- `unknown` → `noch in Prüfung`.

Specify how missing product metadata differs from a verified mismatch. Evaluate every owned product independently. Prefer an ideal exact recommendation; allow a supportive new recommendation only when no ideal candidate exists and its limitation is explicit. Never recommend a mismatch or unknown product confidently.

Completion test: candidate ordering, tie-breaking, and the no-valid-match state are deterministic.

### 9. Reconciliation and plan lifecycle

For every verdict, define the user choice and saved state:

- keep a fitting owned product;
- keep a mismatch as an informed non-blocking override;
- add an exact recommendation to the shopping list while the current product remains active;
- keep a submitted product pending until review;
- mark a product acquired and preview the affected assignments and recipes;
- remove or decline a recommendation.

Opening an affiliate link never means the product was bought. Any material change creates a proposed successor plan; the active plan remains unchanged until confirmation.

Completion test: every Stage 2 action has one explicit state transition and no silent plan mutation.

### 10. Application and day-type compilation

Define the conservative category fallback for:

- application stage and order;
- wet/damp/dry state;
- hair/scalp placement;
- distribution or sectioning;
- rinse versus leave-in behavior;
- amount, active time, and wait time;
- interactions, exclusions, replacement, and same-day ordering with adjacent categories.

Verified exact-product directions override category defaults. If exact amount or timing is unknown, do not fabricate precision. State which day types may contain the category and whether it can create a new day type.

Completion test: every confirmed in-hand product can compile into a safe ordered step or a visible protocol-data gap.

### 11. Safety, uncertainty, and overclaim boundaries

Define:

- hard product exclusions and stop-use signals;
- medically adjacent escalation boundaries;
- claims the product may and may not make;
- weak evidence that must remain optional or confidence-reducing;
- when optimization is suppressed entirely.

Completion test: safety precedes fit and the category never converts a quiz observation into an unsupported diagnosis.

### 12. Structured reasoning payload

The deterministic module must preserve enough facts to explain:

- inclusion and decisive inputs;
- target axes, roles, functions, and frequency source;
- product-level exact matches, limitations, mismatches, and unknowns;
- cross-category coverage and relevant user overrides;
- uncertainty and safety boundaries.

Do not decide the final two or three card-level facts category by category. Preserve all deterministic reason facts now; lock shared reason salience and German presentation templates after all categories are specified. An LLM may verbalize those facts later but may not change the decision.

Completion test: a deterministic template can explain the result without reconstructing hidden logic.

### 13. Fixture matrix and regression boundary

Before confirmation, list fixtures for:

- normal basis, optional, and not-needed cases where applicable;
- each role and target boundary;
- conflicting inputs and precedence;
- missing required input;
- ideal, supportive, mismatch, and unknown products;
- one product covering several roles;
- several owned products and cadence allocation;
- pending product, shopping recommendation, acquisition, and owned override;
- product-specific protocol override;
- safety suppression and no-valid-candidate state;
- deterministic recomputation and proposed-plan delta.

Name the intended runtime module and test surface. Implementation uses test-first development at that seam.

Completion test: every confirmed rule has at least one normal or boundary fixture, and every fallback has a regression fixture.

### 14. Deferred dependencies and confirmation

Separate three kinds of unfinished work:

- category blocker: must be decided before this category can be confirmed;
- catalog/data gap: category policy is clear, but product facts or a migration are missing;
- shared cross-category dependency: intentionally decided after adjacent categories.

Mark `decision.md` as `confirmed` only when no category blocker remains. A catalog implementation gap or deliberately deferred shared presentation/ownership decision does not invalidate an otherwise complete category policy when it is clearly recorded.

## Rule-level documentation standard

Every deterministic rule should be expressible as:

| Field | Required content |
|---|---|
| Rule ID | Stable category-prefixed identifier |
| Inputs | Exact canonical fields or product facts |
| Trigger | Testable condition, including empty/missing behavior |
| Output | Need tier, target value, cadence, fit fact, guidance, or safety state |
| Precedence | What wins when this rule conflicts with another |
| Confidence | Whether evidence/data is sufficient for a hard rule |
| Reason facts | Structured facts preserved for explanation |
| Fixture | At least one normal, boundary, or fallback example |

Prose may explain why, but it must not be the only representation of behavior.

## Category confirmation checklist

- [ ] Current behavior is classified as reuse, adapt, reject, or missing.
- [ ] Every consumed user input can change a documented decision.
- [ ] Inclusion, roles, target axes, mappings, precedence, and fallbacks are explicit.
- [ ] Functional coverage and adjacent-category boundaries are recorded.
- [ ] Total cadence and multiple-product allocation are deterministic.
- [ ] Required product facts and all four fit verdicts are defined.
- [ ] Owned, pending, shopping, acquired, override, and no-match states are covered.
- [ ] Application defaults and exact-product override boundaries are safe and precise.
- [ ] Safety, uncertainty, and overclaim boundaries are explicit.
- [ ] Structured reason facts and representative fixtures are complete.
- [ ] Category blockers, catalog gaps, and cross-category deferrals are separated.
- [ ] Nick has confirmed the category policy before the checkpoint commit.
