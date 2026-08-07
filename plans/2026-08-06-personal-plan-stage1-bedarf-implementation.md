# Personal Plan Stage 1 — Bedarfsplan implementation

**Status:** the A/B-first journey, quiz-led Shampoo cadence, revised Stage-1 mockup, Oil/Leave-in V3 vocabulary port, final counterpart revalidation, and narrated-journey sign-off are complete. The retained artifact uses quiz-only best-match packshots, a non-sequential fold-up, and the short transition approved by Nick on 2026-08-07. PR A's deterministic engine is implemented, its final counterpart findings are reconciled, and verification is complete. PR B/C intentionally wait for the separate Stage-2 specification task to implement the frozen exact-product preview-selector boundary.

**Outcome:** immediately after payment, an entitled Personal Plan buyer receives a deterministic, saved initial Bedarfsplan computed from the paid quiz facts already available. It explains which product categories and product types currently form the Basis, which are optional, their best-known occurrence rhythm, and why—before asking any further onboarding or current-product questions.

**Parent context:** [Personal Plan App V1 plan](./2026-08-02-personal-plan-app-implementation-v2.md) and [computation specification](./2026-08-02-personal-plan-computation-spec.md).

**Planning evidence:** [reviewed three-stage journey](./mockups/2026-07-30-promise-product-journey.html), whose Bedarfsplan → product refinement order is authoritative, and [confirmed Stage-1 density/state review](./mockups/2026-08-06-personal-plan-stage1-density-states.html), revised after Nick's 2026-08-07 card feedback and explicitly signed off on 2026-08-07. The former pre-plan usage-context artifact was rejected and removed.

## 1. Chosen direction

Build Stage 1 as a separately reviewable milestone behind the server-only `PERSONAL_PLAN_APP_V1_ENABLED` flag:

1. load the complete saved paid Personal Plan quiz envelope, never the lossy offer/profile projection;
2. normalize those quiz facts into one versioned partial `PlanProfile` and one shared `PlanNeedAssessment`, preserving later-only facts as explicit unknowns;
3. compute the initial quiz-only Bedarfsplan without blocking on post-plan onboarding;
4. compute category-local decisions in pure plan-owned modules;
5. run one narrow portfolio pass for confirmed cross-category ownership/arbitration;
6. save the exact initial result as an immutable `initial_need` snapshot;
7. render the proposal at `/plan-start` as a Basis results page followed by a separate Optional results page when optional categories exist;
8. end with the reviewed transition: `Deine Grundlage steht. Jetzt machen wir sie zu deiner.`;
9. leave post-plan onboarding, refined need recomputation, exact-product reconciliation, and day-type behavior to the subsequent Stage-2/3 work.

This is a dedicated deterministic `src/lib/personal-plan/` boundary. CareBalance and the legacy recommendation runtime are prior-art inputs, not runtime authorities or adapters for this surface.

## 2. Confirmed decisions

### Category boundary

Stage 1 is not exposed as the paid output until these category policies are confirmed and implemented:

- Shampoo;
- Conditioner;
- Leave-in;
- Mask;
- Oil;
- Deep Cleansing Shampoo;
- Dry Shampoo;
- Heat protectant;
- Bondbuilder;
- Scalp Care (`scalp_care` / `Kopfhautpflege`).

Styling remains explicitly outside V1. `scalp_exfoliant` is a role inside Scalp Care; do not introduce a separate Peeling category or card. Hair Tools remains a separate planning/implementation stream and is not part of the ten product-category outputs. Its normalized exposure classifier is, however, the shared input authority for Heat-protection need.

All ten category decision/evidence checkpoints are confirmed. Implementation may begin only after this integrated plan passes the final counterpart review and Nick explicitly confirms the designed journey. The flag remains off for paid users until all ten category modules, portfolio fixtures, catalog/protocol activation gates for the relevant later stage, and the reviewed Stage-1 journey pass.

### Persistence and confirmation

- A successful Stage-1 computation writes an immutable initial snapshot containing the exact quiz input and decision snapshot the user sees.
- Stage 1 asks no follow-up questions and does not create the first active confirmed Personal Plan.
- Post-plan onboarding may add, remove, retarget, or change the cadence of initial categories. The same deterministic need engine recomputes a separate refined need snapshot; it never edits the initial snapshot in place.
- After Stage 2, the user sees the refined category plan plus exact products. After Stage 3, the complete proposal includes executable routines; only that complete proposal can be confirmed as active.
- Once an active plan exists, later changes follow the already-confirmed successor/delta/confirmation policy.

### Card salience and copy boundary

Collapsed cards show only:

- the image of the current best exact-product match produced by the Stage-2 matching contract from the quiz facts known so far; never a fabricated bottle or category-letter placeholder;
- category name;
- target product type and any confirmed role/use-case pills;
- one concise purpose/personal-fit sentence tied to decisive quiz facts;
- cadence;
- Basis, Optional, or paused state.

The accessible fold-up spans the full card width and is styled as a non-sequential `Anforderungsprofil`, not an application process. It contains equal-weight fact blocks for `Worauf es beim Produkt ankommt`, `Warum das zu deinem Haar passt` with at most two decisive personal facts, and `Empfohlener Rhythmus`. Further evidence appears only when it materially clarifies the recommendation; the UI never numbers these blocks like an application sequence.

The page-level lead states once that this first plan is based on the quiz. Do not repeat `Quiz-Startpunkt`, `vorläufig`, or another disclaimer on each product card. The exact preview may change after post-plan onboarding adds exclusions, budget, current products, and preferences; this does not weaken the initial recommendation and is handled by the later refined-plan comparison.

Category modules return structured reason facts with stable IDs. Each fact is explicitly classified `primary`, `secondary`, or `detail`; presentation shows at most two primary facts and cannot change tier, target, cadence, role ownership, or safety state. No LLM is required for the deterministic German fallback.

Need tier and execution state are orthogonal. `basis | optional | not_needed` answers whether a resolved category belongs; `available | paused` answers whether an included category may currently be acted on. Visible combinations are Basis, Basis + paused, Optional, and Optional + paused. `not_needed` and deferred-only categories stay hidden. A malformed mandatory paid-quiz fact is an error; later post-plan clarifications remain deferred and never become a Stage-1 question or card state. The mockup's C and D selectors are review-only variants of A and B, not additional user pages.

Basis and Optional are separate result pages inside Stage 1. The first result page contains Basis categories only and frames them as Chaarlie's clear foundational requirements. A forward-arrow action opens the Optional page only when at least one optional category exists; that page frames its categories as additional support for the user's goals, not missing requirements. Otherwise the user continues directly to the `Deine Grundlage steht. Jetzt machen wir sie zu deiner.` transition. The Optional page provides a back arrow to the Basis page. A simple linear progress bar communicates movement through the Bedarfsplan; do not use segmented `Basis`/`Optional` navigation pills above the cards. No question appears before or inside these result pages.

Keep all Basis categories on one mobile page. The reviewed dense edge case permits up to eight compact Basis cards in a single scroll; do not paginate or carousel the Basis list. Optional categories stay on their one separate conditional page. If a future category expansion can produce more than eight Basis cards, reopen the density decision rather than silently adding navigation.

## 3. Source authorities

| Category | Decision authority | Stage-1 status |
|---|---|---|
| Shampoo | [`docs/personal-plan/categories/shampoo/decision.md`](../docs/personal-plan/categories/shampoo/decision.md) | confirmed |
| Conditioner | [`docs/personal-plan/categories/conditioner/decision.md`](../docs/personal-plan/categories/conditioner/decision.md) | confirmed |
| Leave-in | [`docs/personal-plan/categories/leave-in/decision.md`](../docs/personal-plan/categories/leave-in/decision.md) | confirmed for wash-day/heat-event need; between-wash care remains Stage 3 |
| Mask | [`docs/personal-plan/categories/mask/decision.md`](../docs/personal-plan/categories/mask/decision.md) | confirmed |
| Oil | [`docs/personal-plan/categories/oil/decision.md`](../docs/personal-plan/categories/oil/decision.md) | confirmed for role need; optional/non-wash placement remains Stage 3 |
| Deep Cleansing | [`docs/personal-plan/categories/deep-cleansing/decision.md`](../docs/personal-plan/categories/deep-cleansing/decision.md) | confirmed |
| Dry Shampoo | [`docs/personal-plan/categories/dry-shampoo/decision.md`](../docs/personal-plan/categories/dry-shampoo/decision.md) | confirmed |
| Heat protectant | [`docs/personal-plan/categories/heat-protectant/decision.md`](../docs/personal-plan/categories/heat-protectant/decision.md) | confirmed; exact carrier/catalog activation remains gated |
| Bondbuilder | [`docs/personal-plan/categories/bondbuilder/decision.md`](../docs/personal-plan/categories/bondbuilder/decision.md) | confirmed; Stage-3 protocol activation remains gated |
| Scalp Care | [`docs/personal-plan/categories/scalp-care/decision.md`](../docs/personal-plan/categories/scalp-care/decision.md) | confirmed, optional-only; shared identity/input/protocol migration remains gated |

The confirmed Oil and Leave-in authorities now use the V3-native vocabulary from current `origin/main`: `dry_lengths`, separate `breakage` and `split_ends`, and no no-op Oil `scalp_imbalance` concern. Oil treats breakage as the stronger corroboratable pre-wash signal while split ends remain supporting/optional and never imply repair. Historical V2 `breakage_or_split_ends` still normalizes conservatively to `split_ends` exactly once in the plan input adapter. Re-run the named and parameterized fixtures after porting these authorities into the fresh implementation worktree; the stale planning worktree is not runtime evidence.

The ten authorities define 300 named category fixtures—20 Shampoo, 17 Conditioner, 33 Leave-in, 44 Mask, 26 Oil, 22 Deep Cleansing, 30 Dry Shampoo, 26 Heat Protectant, 39 Bondbuilder, and 43 Scalp Care—plus Oil's parameterized rule rows and shared portfolio fixtures. Every implemented category test must cite its decision-rule and fixture IDs in test names or table fixtures. External evidence stays in each category's `evidence.md`; runtime code implements only the confirmed `decision.md` policy.

PR A implements the Stage-1 projection only. It must not build product reconciliation or recipe machinery merely because the same end-to-end category fixture later carries Stage-2/3 assertions. The exact PR-A subset is 137 named fixtures plus Oil's parameterized Stage-1 role rows. An implementation boundary audit moved Dry Shampoo's existing/current-use fixtures 1 and 14–19 to the Stage-2 refined-input producer rather than inventing owned-product facts in PR A:

| Category | PR-A Stage-1 fixture IDs | Count |
|---|---|---:|
| Shampoo | 1–6, 15–17 | 9 |
| Conditioner | 1–5 | 5 |
| Leave-in | 1–10, 14–24, 32 | 22 |
| Mask | 1–11, 29–38, 43–44 | 23 |
| Oil | 1–4, 15–16, 19–23, 25–26, plus every parameterized Stage-1 role-rule row | 13 named |
| Deep Cleansing | 1–15, 21 | 16 |
| Dry Shampoo | 2–4 | 3 |
| Heat Protectant | 1–7 | 7 |
| Bondbuilder | 1–18 | 18 |
| Scalp Care | `SC-01`–`SC-18`, `SC-21`, `SC-41`, `SC-43` | 21 |

For every referenced end-to-end category fixture, PR A executes and asserts only its Stage-1 slice: tier, roles, target, category-owned cadence state, reasons, deferred facts, and execution state. Owned-product verdicts, selection, product protocols, and day recipes inside the same fixture are explicitly not PR-A pass criteria. Before delegation, each category test table must copy the fixture's stable name plus the owning decision-rule IDs; bare ordinal numbers are planning shorthand, not implementation identifiers.

The remaining 163 named fixtures stay authoritative for the later Stage-2/3 plans. PR A additionally owns named portfolio fixtures for Shampoo/Deep-Cleansing substitution, Dry-Shampoo bridge preservation, non-coily Leave-in/Oil smoothing ownership, the coily two-layer exception, Heat need without carrier allocation, Mask/Bondbuilder same-fact non-addition, Conditioner retention, and Shampoo/Deep-Cleansing/Scalp-Care coverage suppression.

PR A also owns this quiz-only partial-knowledge matrix. These are additive contract fixtures, not replacements for the 137 confirmed category fixtures:

| Fixture ID | Quiz-only condition | Required initial behavior |
|---|---|---|
| `INITIAL-01` | Complete paid quiz; every post-plan fact unknown | Computation returns `ready`, never `needs_input`; resolved Basis/Optional cards render and all later-only facts remain auditable. |
| `INITIAL-02` | Shampoo need/target resolved; current wash frequency not collected yet | Shampoo renders the scalp route's preferred target as `quiz_starting_target`. The page-level lead makes clear that the first plan comes from the quiz; the card does not repeat a preliminary disclaimer. The refined snapshot compares the target with actual behavior and may retain it or propose the nearest suitable boundary. |
| `INITIAL-03` | Mask included; total wash frequency unknown | Mask keeps its category-owned time target (`1× pro Woche`, `alle 2 Wochen`, or `alle 3 Wochen` according to its confirmed rules). Only achievable placement on real wash days remains deferred. |
| `INITIAL-04` | Current product load/placement unknown | Load-triggered Deep Cleansing and scalp-buildup roles are deferred, not `not_needed` or optimistically included. Quiz-resolved oily-scalp optional reasoning may still render where its category policy permits it. |
| `INITIAL-05` | Hair Tools exposure unknown | Heat Protection is deferred, not `not_needed`; the initial plan still completes. |
| `INITIAL-06` | Dry Shampoo bridge preference/current ownership unknown | The preference-dependent bridge role is deferred without a pre-plan question. |
| `INITIAL-07` | `irritated` selected; irritation detail unknown | No treatment direction is invented. Any quiz-resolved Scalp Care card is safely paused with the missing-detail reason; otherwise the role is deferred. |
| `INITIAL-08` | Quiz-resolved Oil/Leave-in/repair needs; current ownership unknown | Inherent category/role decisions still render because ownership does not define need. |
| `INITIAL-09` | Later refined context supplies frequency, load, Heat, irritation, and current use | The same engine may add/remove/retarget/change cadence in a new refined snapshot while the initial snapshot stays byte-stable. |
| `INITIAL-10` | No resolved Optional category | Page B and its progress step are omitted; A proceeds directly to the transition. |
| `INITIAL-11` | Valid attached V2 envelope with no selected concerns and otherwise complete neutral facts | The V2 parser produces the exact minimal Stage-1 slice without inventing V3-only concerns; Shampoo and eligible Conditioner remain Basis, later-only facts remain deferred, and no concern-led repair or Scalp Care role appears. |
| `INITIAL-12` | Valid attached V2 envelope with `dry_dull_lengths` and `breakage_or_split_ends` | Normalize once to `dry_lengths` plus `split_ends`, never `breakage` or `hair_damage`; Leave-in/Oil/Mask follow their split-end supporting routes and no breakage-only Basis promotion occurs. |
| `INITIAL-13` | V3 `hair_loss_or_thinning` with no other category signal | Mask remains `not_needed`; Scalp Care may expose only its optional limited-evidence density role; the shared hair-loss boundary forbids diagnosis or treatment claims and records that red-flag detail is unassessed. |

### Shared assessment union

The plan owns a small named union of shared facts; it does not recreate CareBalance or introduce a configurable rule engine:

```ts
type PlanHairLossBoundaryAssessment =
  | { state: 'absent'; sourceFacts: [] }
  | {
      state: 'present'
      sourceFacts: ['hair_loss_or_thinning']
      redFlagDetail: 'unassessed'
      cosmeticClaimBoundary: 'limited_evidence_only'
    }

type PlanNeedAssessment = {
  damage: PlanDamageAssessment
  shampooCadence: PlanShampooCadenceAssessment
  resetLoad: PlanResetLoadAssessment
  scalpBuildup: PlanScalpBuildupAssessment
  heatExposure: PlanHeatExposureAssessment
  hairLossBoundary: PlanHairLossBoundaryAssessment
}
```

Every shared assessment exposes `knowledgeState: 'known' | 'partial' | 'unknown'` plus the source facts it actually used. Category rules may consume only known facts; partial assessments may support a conservative resolved output only where the owning decision explicitly allows it.

- `damage` retains raw structural, Heat, and mechanical drivers plus confidence/missing-input facts. It derives the one shared `repairPriority`; Conditioner, Leave-in, Mask, and Bondbuilder consume the same facts without adding their scores or re-counting raw drivers.
- `shampooCadence` owns the quiz-derived scalp-led target band and, after post-plan onboarding, the comparison to current frequency. The initial plan shows the preferred band while the page-level lead supplies the quiz-based framing; the refined snapshot retains an in-range current cadence or proposes the nearest suitable boundary. Deep Cleansing later substitutes inside the refined total, and Dry Shampoo never silently reduces it.
- `resetLoad` is the documented transparent Deep Cleansing computation. In the initial projection it may use quiz-resolvable signals but retains current-product load as unknown; it is not reused as a generic scalp score.
- `scalpBuildup` classifies only verified repeated scalp/root exposure and retains its source rows. Unknown usage is `unknown`, not `absent`; length-only load, ordinary cleansers, and oiliness alone do not become `present`.
- `heatExposure` contains the Hair Tools classifier's normalized `ordinary_airflow | airflow_shaping | direct_contact_heat | unclassified` event routes when known. It is `unknown` in the current paid quiz, so Heat Protection is deferred in the initial plan rather than classified `not_needed`.
- `hairLossBoundary` is `present` only when the quiz contains `hair_loss_or_thinning`. It never creates Mask/repair need or diagnoses a cause. It permits only Scalp Care's optional `density_claim_tonic` role with the confirmed limited-evidence copy, records `redFlagDetail = 'unassessed'`, and forbids the initial plan from characterizing the loss as gradual, diffuse, cosmetic-only, or treated. Any later red-flag clarification belongs to a separately approved health-context flow, not Stage 1.

Weight, care direction, functional needs, role inclusion, and category tier remain category-local outputs unless a confirmed decision explicitly names a shared fact. There is no generic category score, learned ranking, DSL, or second recommendation authority.

### Cross-category arbitration and coverage

Every category first computes its confirmed local or deferred result. The portfolio pass applies only these explicit rules to resolved facts and emits structured coverage facts; it cannot turn unknowns into false, invent a category, change a local threshold, or use catalog availability to rewrite inherent need.

| Job/overlap | Stage-1 authority | Portfolio rule |
|---|---|---|
| Wet-wash cleansing | Shampoo | Shampoo owns total wet-wash cadence. Deep Cleansing replaces a regular Shampoo occurrence inside that total. Dry Shampoo is an optional bridge and never replaces a necessary wet wash. |
| Scalp flakes, oiliness, and comfort | Shampoo plus optional Scalp Care | Targeted/gentle Shampoo stays primary. Scalp Care may retain its truthful optional role/reason, but Stage 2 creates no duplicate purchase when Shampoo already covers that job. Deep Cleansing is never treatment for flakes or irritation. |
| Hair loss or thinning | Shared hair-loss boundary plus optional Scalp Care | The concern never creates Mask or generic repair need. Scalp Care may expose only the optional `density_claim_tonic` role with adjacent limited-evidence copy; Stage 1 does not diagnose a cause or imply that red flags were assessed. |
| General product Reset versus scalp/root residue | Deep Cleansing plus Scalp Care | Deep Cleansing owns general hair/product Reset. `scalp_exfoliant` owns only an uncovered scalp/root-specific job. The same exposure fact may not create two purchases; coverage is recorded without deleting the Scalp Care explanation. |
| Regular, persistent, intensive, and specialized repair support | Conditioner, Leave-in, Mask, Bondbuilder | Conditioner remains regular baseline support; Leave-in is supporting only; Mask owns periodic ordinary intensive conditioning; Bondbuilder owns specialized structural protocol. The same raw damage facts may make Mask and Bondbuilder independently relevant, but scores never add and the categories are not mutually exclusive. Stage 3 separates incompatible intensive recipes. |
| Damp anti-frizz/smoothing | Leave-in or Oil | Broad persistent care routes to Leave-in. In the narrow uncomplicated, manageable, non-coily smoothing case, Oil may be the single Basis leave-on. For coily hair plus frizz, Leave-in and damp Oil both remain Basis as two distinct layers. |
| Immediate dry shine/flyaways | Oil | Oil owns the dry-finish job. A shine benefit elsewhere may support ranking but does not suppress a confirmed Oil role. |
| Heat Protection | Heat Protectant need plus a later carrier allocation | The Heat category owns `basis | optional | not_needed` and event cadence. Stage 2 retains a verified in-hand carrier, otherwise reuses a fitting already-needed Leave-in/Oil with verified binary Heat capability, otherwise recommends one standalone Heat Protectant. Integrated coverage annotates an existing occurrence and never duplicates use. |
| Very-short fine-hair rinse-out replacement | Conditioner and Leave-in | Conditioner stays baseline except for the confirmed fine + very-short + material-care case where a verified replacement-capable Leave-in may replace it. This exception is not generalized by the portfolio pass. |

When several included roles remain inside one category, compute each role independently, render one category card, retain the stable role order from its decision, and set the card tier to the strongest included role (`basis` before `optional`). `not_needed` remains internal evidence and does not render.

The plan-owned stable rendering order, filtered separately for the Basis and Optional pages, is:

```ts
const STAGE1_CATEGORY_ORDER = [
  'shampoo',
  'conditioner',
  'leave_in',
  'heat_protectant',
  'oil',
  'mask',
  'scalp_care',
  'dry_shampoo',
  'bondbuilder',
  'deep_cleansing_shampoo',
] as const
```

This preserves the live Routine page's established base/add-on order while inserting Heat Protection next to its common carrier and replacing the old standalone Peeling concept with Scalp Care. Relevance scores and catalog state never reorder the page. Dry Shampoo and Scalp Care are optional-only, while Heat Protection and several load-dependent roles normally defer in the quiz-only projection. The eight-card artifact is therefore a deliberate layout stress test, not a claim that the current quiz can resolve eight Basis categories.

Task 1 owns the explicit plan-domain definitions for `Stage1Category`, `PlanProductRole`, `PlanFrequencyTarget`, and `PlanHeatToolUseEvent`; no category invents a local substitute. These plan slugs deliberately differ from the legacy/catalog `SELECTABLE_PRODUCT_CATEGORIES` vocabulary: the plan has `scalp_care` and `heat_protectant` and does not expose legacy `peeling`. PR B must use an explicit adapter when reading catalog data rather than casting between vocabularies.

## 4. Scope

### In scope

- a review/test-only `/plan-start` entry for the gated audience while the production `/plan-bereit` CTA remains on the current onboarding path until Stage 2 owns continuation;
- Personal Plan access check combining current app entitlement with a linked/claimed Personal Plan prepared artifact;
- quiz-faithful, decision-relevant `PlanProfile` normalization from the full paid quiz envelope alone, with the validated source envelope retained separately;
- explicit `known | unknown` handling for washing frequency, current product load/placement, Hair Tools exposure, Dry Shampoo bridge preference, and irritation detail that are intentionally collected only after the initial plan;
- shared damage/repair and quiz-resolvable need assessments, plus conservative partial projections of Shampoo cadence, Reset load, scalp buildup, and Heat exposure;
- ten pure category modules and their complete deterministic fixture tables;
- deterministic initial-plan projection that distinguishes `not_needed` from `deferred_until_post_plan_onboarding` and never turns missing facts into a negative recommendation;
- a read-only exact-product preview per rendered category, selected from current eligible catalog rows by the shared Stage-2 matcher using only facts known in the initial projection; preview selection cannot change category need/tier/target/cadence;
- narrow primary/supporting capability ledger and only confirmed overlap/arbitration rules;
- immutable quiz-only `initial_need` snapshots;
- compact two-page Basis/Optional Bedarfsplan with Routine-inspired category tiles, disclosures, directional navigation, pause states, loading, conditional Optional-page omission, error, retry, and resume behavior;
- the reviewed transition from the Bedarfsplan into the later post-plan onboarding, with no Stage-2 input flow implemented in this milestone;
- privacy-safe analytics for entry, compute result, category tier counts, disclosure open, error, retry, and Stage-1 completion;
- responsive 375px and desktop containment verification;
- feature-flag rollback.

### Non-goals

- post-plan onboarding, current-product capture, conditional follow-up questions, budget, exclusions, or recommendation preferences;
- refined need recomputation and initial-versus-refined delta presentation;
- owned-product verdicts, ownership reconciliation, final catalog selection after new answers, or purchase actions; the initial exact-product image is a quiz-only preview of the current best match;
- product-spec/catalog migrations, including nullable thickness and category-specific product tables;
- multi-product-per-category persistence migration;
- shopping list, purchase links, acquisition, pending-product research, alternatives, or overrides;
- product application protocols;
- day-type recipes, schedule band, logging, tracker changes, `Heute`, or `Fortschritt`;
- active full-plan confirmation;
- Chat integration or Chat mutation authority;
- Styling, a separate Peeling category, or Hair Tools output;
- any question before the initial paid Bedarfsplan; missing later facts remain explicit unknowns and are handled conservatively.

## 5. Contracts

### Initial-plan input and partial knowledge

The need computation input is exactly one supported immutable paid Personal Plan quiz envelope: current V3 or explicitly normalized historical V2. It does not query `user_product_usage`, legacy onboarding, Hair Tools setup, or a mutable setup draft before showing the result. After need decisions resolve, the server may read the eligible catalog solely to attach the display-only exact-product previews defined below.

```ts
type PersonalPlanLegacyConcern =
  | 'dry_dull_lengths'
  | 'frizz_flyaways'
  | 'low_shine'
  | 'lost_shape'
  | 'low_volume_or_weighed_down'
  | 'breakage_or_split_ends'
  | 'tangling'
  | 'scalp_imbalance'

type SupportedPersonalPlanQuizEnvelope =
  | PersonalPlanQuizSubmissionEnvelope
  | {
      kind: 'personal_plan'
      version: 2
      answers: Omit<
        PersonalPlanQuizSubmissionEnvelope['answers'],
        'currentConcerns' | 'concernRecurrence'
      > & {
        currentConcerns?: PersonalPlanLegacyConcern[]
      }
    }
```

This union is a source-data boundary only. The plan-owned parser validates it and applies the confirmed conservative V2 migration without importing the Customer.io projection as authority. A read-only production aggregate on 2026-08-07 found 379 attached V2 artifacts and 458 attached V3 artifacts, so V2 compatibility is active data rather than speculative legacy scope; no user-level data was inspected.

```ts
type PlanKnowledge<T> =
  | { state: 'known'; value: T }
  | { state: 'unknown'; reason: PlanKnowledgeGapId }

type PlanMissingFactId =
  | 'shampoo_frequency'
  | 'current_product_load'
  | 'heat_tool_use'
  | 'dry_shampoo_bridge_preference'
  | 'scalp_irritation_detail'

type PlanKnowledgeGapId = PlanMissingFactId | 'concern_recurrence'

type PlanRoutineContext = {
  shampooFrequency: PlanKnowledge<ProductFrequency | 'does_not_wash'>
  heatToolUse: PlanKnowledge<PlanHeatToolUseEvent[]>
  dryShampooBridgePreference: PlanKnowledge<'accept' | 'decline'>
  scalpIrritationState: PlanKnowledge<
    'mild_sensitive_or_itchy' | 'burning_painful_or_inflamed'
  >
}
```

For the immediate quiz-only snapshot, every member above is `unknown` unless the paid quiz later gains the exact canonical field. Current-product use is not part of this Stage-1 context at all; Stage 2 owns that separate input contract. Unknown is not `false`, an empty list, `not_needed`, or permission to guess. `concern_recurrence` is a source-quality gap rather than a promised post-plan input: it may affect confidence/reason salience only and never enters snapshot `deferredFacts` or blocks a category. `PlanKnowledge` does not duplicate provenance; `PlanReasonFact.evidence` records whether a known value came from the quiz, post-plan onboarding, or an assessment.

`ProductFrequency` is imported from the shared stable vocabulary in `src/lib/vocabulary/frequencies.ts`; importing that value type does not call or adopt the legacy recommendation runtime.

Category rules follow three conservative partial-evaluation policies:

1. **Resolvable now:** if quiz facts fully establish tier and target, render the category normally.
2. **Resolvable category, later cadence:** preserve the category authority's own cadence when quiz facts resolve it. If the confirmed rule requires a later fact, render the resolved need/target without inventing a substitute cadence and label the rhythm as being refined next; never fabricate a weekly number or translate a time-based category rule into a wash-count rule.
3. **Later-only trigger:** when a category or role depends entirely on product load, Hair Tools exposure, bridge preference, or another unknown fact, store `deferred_until_post_plan_onboarding` internally and do not render it. This is distinct from `not_needed`. The refined run may add it later.

If quiz facts establish a safe pause but not an actionable recommendation—for example `irritated` without the later irritation detail—the category may render on its quiz-derived tier with `executionState = 'paused'` and a truthful pause reason. It must not invent treatment direction.

After the initial plan, the subsequent onboarding collects canonical Shampoo frequency, Hair Tools exposure, current-product categories/identity/use, Oil role, relevant placement/load facts, Dry Shampoo bridge preference, irritation detail, budget, and exclusions. Current-product use belongs to this Stage-2 input contract rather than `PlanRoutineContext`. That flow and its persistence are Stage 2 scope. It feeds the same need engine to create a separate refined snapshot before exact-product reconciliation.

### Quiz-faithful computation profile

`PlanProfile` preserves every decision-relevant Personal Plan quiz value in its native vocabulary. The immutable version row separately stores the validated source envelope, so this computation projection does not pretend that presentation-only or free-text quiz fields are category inputs. Define the aliases in `src/lib/personal-plan/types.ts` from the saved envelope rather than importing similarly named legacy-profile types:

```ts
type PlanHairTexture = NonNullable<PersonalPlanQuizAnswers['texture']>
type PlanHairThickness = NonNullable<PersonalPlanQuizAnswers['thickness']>
type PlanHairDensity = NonNullable<PersonalPlanQuizAnswers['density']>
type PlanHairLength = NonNullable<PersonalPlanQuizAnswers['hairLength']>
type PlanHairSurface = NonNullable<PersonalPlanQuizAnswers['hairSurface']>
type PlanElasticResponse = NonNullable<PersonalPlanQuizAnswers['elasticResponse']>
type PlanChemicalTreatment = NonNullable<PersonalPlanQuizAnswers['chemicalTreatments']>[number]
type PlanScalpOiliness = NonNullable<PersonalPlanQuizAnswers['scalpOiliness']>
type PlanScalpConcern = NonNullable<PersonalPlanQuizAnswers['scalpConcerns']>[number]
type PlanCurrentConcern = NonNullable<PersonalPlanQuizAnswers['currentConcerns']>[number]
type PlanConcernRecurrence = NonNullable<PersonalPlanQuizAnswers['concernRecurrence']>
```

In particular, the plan profile preserves `lightened`; it does not silently relabel it `bleached`. A plan-owned assessment may map `lightened` to the existing `bleached_hair` damage-driver meaning when copying proven arithmetic, but the source profile and snapshot remain quiz-native and every such derived mapping is table-tested.

```ts
type PlanProfile = {
  source: {
    quizVersion: number
    artifactId: string
    projection: 'initial_quiz' | 'refined_post_plan'
  }
  hair: {
    texture: PlanHairTexture
    thickness: PlanHairThickness
    density: PlanHairDensity
    length: PlanHairLength
    surface: PlanHairSurface
    elasticity: PlanElasticResponse
    chemicalTreatments: PlanChemicalTreatment[]
  }
  scalp: {
    oiliness: PlanScalpOiliness
    concerns: PlanScalpConcern[]
    irritationState: PlanRoutineContext['scalpIrritationState']
  }
  goals: PersonalPlanQuizGoal[]
  concerns: PlanCurrentConcern[]
  concernRecurrence: PlanKnowledge<PlanConcernRecurrence>
  routine: PlanRoutineContext
}
```

The input boundary is an explicit versioned union of supported paid quiz envelopes, not the current V3 type masquerading as historical data. V3 is validated natively. Historical V2 is normalized once through a plan-owned adapter with its documented concern migration and `concernRecurrence = unknown`; unsupported or malformed versions return typed incomplete input. Initial normalization never delays the result for later-only routine facts and never defaults missing scalp, thickness, or multi-select concern facts from the offer adapter. Later-only facts remain typed unknowns.

### Shared category output

```ts
type PlanNeedTier = 'basis' | 'optional' | 'not_needed'
type PlanReasonSalience = 'primary' | 'secondary' | 'detail'

type PlanReasonFact = {
  id: string
  salience: PlanReasonSalience
  evidence: Array<{ source: 'quiz' | 'post_plan_onboarding' | 'assessment'; key: string }>
  values: Record<string, string | number | boolean>
}

type PlanCategoryDecision = {
  category: Stage1Category
  resolution: 'resolved' | 'partially_resolved' | 'deferred_until_post_plan_onboarding'
  needTier: PlanNeedTier | null
  roles: PlanProductRole[]
  target: PlanCategoryTarget
  frequency: PlanFrequencyTarget | null
  reasons: PlanReasonFact[]
  executionState: 'available' | 'paused'
  executionPauseReason: PlanReasonFact | null
  deferredFacts: PlanMissingFactId[]
}
```

Exact preview selection is a separate read-only projection layered after the category decision:

```ts
type InitialProductPreview =
  | {
      category: Stage1Category
      state: 'selected'
      productId: string
      productName: string
      imageUrl: string
      previewRole: PlanProductRole | null
      verdict: 'ideal'
      selectionRuleIds: string[]
      selectionVersion: string
    }
  | {
      category: Stage1Category
      state: 'absent'
      reason: 'deferred_fit' | 'no_ideal_match' | 'catalog_data_gap' | 'image_missing'
      selectionRuleIds: string[]
      selectionVersion: string
    }
```

The selector consumes the category target plus the quiz-known profile, uses the same hard gates and stable ordering that Stage 2 will own, and persists exactly one selected-or-absent result per rendered category. A merely `supportive` candidate is not presented as the perfect example on this confident Stage-1 card; Stage 2 may later show it with its limitation. `state = 'absent'` collapses the image slot; the UI never substitutes a drawn bottle, fake pack, or category-letter icon. `previewRole` records the representative role for a multi-role category without claiming that one packshot covers every later assignment. This projection is display-only: it cannot change the category decision and is recomputed in the refined plan when later answers materially affect fit.

The Stage-2 specification owns the selector implementation and category-specific product-fit adapters. It must expose the small read-only preview boundary above before PR B begins; Stage 1 must not recreate product matching simply to populate an image. PR A therefore proceeds independently, while PR B and PR C wait for that frozen selector contract. The broader Stage-2/3 product reconciliation, onboarding, confirmation, shopping, and recipe work remains a separate planning and implementation stream.

`not_needed` is emitted only when available facts resolve a genuine negative. `deferred_until_post_plan_onboarding` is a separate internal state and may later become Basis, Optional, or `not_needed`. A partially resolved multi-role category renders its resolved included roles while retaining deferred roles/facts in the snapshot. Deferred-only and `not_needed` categories do not render. Category modules never emit German presentation copy as authority.

`PlanCategoryTarget` is a discriminated union owned by the ten category decisions, not a lowest-common-denominator property bag. In particular, the Mask member carries `weight`, `careDirection`, `repairSupportLevel`, and `functionalNeeds`; Scalp Care carries a stable role set plus role-keyed product-directed cadence; Heat Protection carries event-based coverage rather than a weekly frequency. In the initial projection, Mask preserves its category-owned time target even when Shampoo cadence is unknown; only achievable wash-day placement remains deferred. Other wash-linked categories preserve only the cadence their own confirmed authority can resolve. The refined projection adds achievable placement after post-plan onboarding.

### Initial Stage-1 snapshot

```ts
type InitialNeedPlanSnapshot = {
  schemaVersion: 1
  snapshotKind: 'initial_need'
  computationVersion: string
  inputHash: string
  createdAt: string
  sourceQuiz: SupportedPersonalPlanQuizEnvelope
  profile: PlanProfile
  assessments: PlanNeedAssessment
  decisions: PlanCategoryDecision[]
  productPreviews: InitialProductPreview[]
  renderedOrder: Stage1Category[]
  deferredFacts: PlanMissingFactId[]
}
```

The serialized snapshot is deterministic apart from `createdAt`; tests compare a canonical payload that excludes generated IDs/timestamps.

## 6. Persistence model

Create the smallest immutable initial-snapshot model used by this milestone:

### `personal_plans`

- logical owner per user;
- copied source artifact identity/hash plus an optional prepared-artifact reference using `ON DELETE SET NULL`; the plan must survive prepared-artifact expiry or purge;
- timestamps;
- uniqueness that prevents two logical plans for one source artifact.

Keep this table in Stage 1: it is the stable identity that owns the immutable initial snapshot and later refined/complete successors without coupling the living plan to an expiring prepared-result capability. The initial version copies the validated paid source envelope before rendering; every later reload reads the saved plan/version and does not require the prepared artifact to still exist. Stage 1 creates no mutable setup draft.

### `personal_plan_versions`

- immutable row per computed quiz-only initial Bedarfsplan;
- logical plan foreign key and monotonic sequence;
- `scope = 'initial_need'` for this milestone;
- `status = 'proposed' | 'superseded'`;
- validated source-envelope, computation-profile, assessment, and decision JSON snapshots plus computation/schema versions;
- created and superseded timestamps;
- owner-scoped reads, server-controlled inserts/status transitions;
- database guards preventing mutation of snapshot/version fields after insert;
- unique `(personal_plan_id, input_hash)` for request idempotency;
- partial unique `(personal_plan_id, scope) where status = 'proposed'` so concurrent requests cannot create two current initial snapshots.

The compute endpoint derives `inputHash` from the validated paid quiz envelope alone and uses it as its idempotency key. A retry with the same hash returns the existing initial snapshot. If the paid quiz artifact itself is legitimately replaced, one transaction locks the logical plan, supersedes the previous current initial snapshot, and inserts the new unique snapshot. Never mutate the old snapshot. Purging a prepared artifact may null only its optional reference; it cannot delete or invalidate the plan or its copied source input. The later post-plan onboarding owns its mutable draft and creates a separate refined successor; Stages 2–3 own complete-plan active/rejected lifecycle fields.

## 7. Target map

### New domain files

- `src/lib/personal-plan/types.ts`
- `src/lib/personal-plan/input.ts`
- `src/lib/personal-plan/needs.ts`
- `src/lib/personal-plan/compute-stage1.ts`
- `src/lib/personal-plan/reasons.ts`
- `src/lib/personal-plan/product-preview.ts` as a thin projection over the shared Stage-2 exact-product matcher; it must not own independent fit rules;
- `src/lib/personal-plan/persistence.ts`
- `src/lib/personal-plan/categories/shampoo.ts`
- `src/lib/personal-plan/categories/conditioner.ts`
- `src/lib/personal-plan/categories/leave-in.ts`
- `src/lib/personal-plan/categories/mask.ts`
- `src/lib/personal-plan/categories/oil.ts`
- `src/lib/personal-plan/categories/deep-cleansing.ts`
- `src/lib/personal-plan/categories/dry-shampoo.ts`
- `src/lib/personal-plan/categories/heat-protectant.ts`
- `src/lib/personal-plan/categories/bondbuilder.ts`
- `src/lib/personal-plan/categories/scalp-care.ts`

### New persistence/API files

- one uniquely versioned Supabase migration for `personal_plans`, `personal_plan_versions`, and their RLS/immutability guards;
- generated database types;
- `src/app/api/personal-plan/stage-1/route.ts` for read/compute;
- server-side access and prepared-artifact ownership helpers under `src/lib/personal-plan/`;
- `scripts/test-personal-plan-db.sh` plus a focused `personal-plan-db-contract` job in `.github/workflows/ci.yml` that starts the local Supabase stack, applies migrations, runs the Stage-1 database assertions, and stops the stack even on failure.

### New UI files

- `src/app/plan-start/page.tsx`
- `src/components/personal-plan-start/plan-start-flow.tsx`
- `src/components/personal-plan-start/need-plan-screen.tsx`
- `src/components/personal-plan-start/need-card.tsx`

Keep the transition, progress bar, expanded detail, loading, and error UI local to these three components until reuse is proven. Do not create one-file abstractions for each small state.

### Existing files to extend

- the existing entitlement and prepared-artifact ownership primitives currently used by `src/app/plan-bereit/readiness.ts`; do not inherit its completed-`hair_profiles` prerequisite for this pre-onboarding result;
- `src/lib/auth/route-classification.ts`
- `src/lib/funnel/flags.ts`
- the existing Personal Plan quiz envelope reader only where needed to preserve and validate the paid source artifact without mutation;
- `src/lib/analytics/events.ts`, `src/lib/analytics/routes.ts`, `src/lib/analytics/track-app-event.ts`, the existing cookie-consent reader, and destination adapters; the client records the code-owned compute outcome only after analytics consent when it receives the typed server result, while the server endpoint never imports the browser router;
- `src/app/globals.css` only for reusable tokens/primitives not expressible locally;
- `package.json` to make nested `tests/personal-plan/categories/*.test.ts` discoverable.

### Visual reuse boundary

Reuse the live routine page's brand tokens, tile geometry, status colour language, frequency meter, and badge language where they remain semantically correct. Do not reuse `RoutineUiCard`, CareBalance card kinds, concrete-product actions, frequency mutations, Chat actions, or the routine drawer. Extract genuinely presentational primitives only when both old and new consumers stay semantically clear; otherwise implement the small Stage-1 presentation directly.

On mobile, adapt rather than copy the live card's full dimensions: keep the same visual grammar but use a smaller category tile, tighter spacing, a two-line purpose clamp, compact property pills, and a contained frequency row. The reviewed decision is one scrollable Basis page for up to eight categories; do not prebuild internal pagination.

## 8. Designed user journey

**Status:** mockup evidence and the complete narrated journey were explicitly confirmed by Nick on 2026-08-07.

1. In a review/test environment, an authenticated Personal Plan buyer enters `/plan-start` explicitly. Paid production buyers remain on the current `/plan-bereit` → onboarding path until Stage 2 supplies the next step.
2. The server checks current app entitlement and verifies that the user owns or has claimed the linked Personal Plan prepared artifact. It deliberately does not require an already-completed `hair_profiles` diagnostic, because this result is shown before post-plan onboarding. Other subscribers and unlinked users cannot enter through entitlement alone.
3. `/plan-start` loads the complete saved paid quiz envelope and immediately computes or resumes its immutable quiz-only `initial_need` snapshot. No current-product, frequency, Heat, budget, exclusion, or conditional follow-up question appears first.
4. The engine preserves post-plan-only facts as typed unknowns. It renders every category and role the quiz resolves, shows only cadence the owning category can resolve truthfully, and retains later-only cadence/triggers as deferred evidence rather than fabricating a rhythm or falsely classifying them `not_needed`.
5. The server saves the exact initial snapshot before rendering it; reload reopens that same snapshot.
6. The first result page is `Deine Basis`, contains only categories classified `basis`, and explains that these are Chaarlie's clear foundational requirements.
7. Each collapsed card borrows the live Routine page's tile/status/frequency/chevron language and shows the current best exact-product packshot from the shared Stage-2 matcher, category, target type, one concise personal-fit/purpose sentence, at most two calm property/use-case pills, and one separate rhythm row. The page lead says once that this first result is based on the quiz; cards carry no repeated preliminary disclaimer. Opening a card uses the full width and presents a non-sequential `Anforderungsprofil`—never an application instruction, question, Chat action, or choice.
8. When optional categories exist, a forward-arrow action opens the separate `Zusätzlich sinnvoll` page. It explains that these categories can further support the user's goals while the Basis is already complete, and provides a back arrow to Basis. A linear progress bar advances from Basis to Optional; there are no segmented page pills. When no optional category exists, no empty Optional page or step appears and the user continues directly toward Stage 2.
9. A paused included category remains visible on its tier page with its pause reason and no current-use implication. Scalp Care remains optional-only; multiple Scalp Care roles render on one `Kopfhautpflege` card. `not_needed` categories do not render.
10. If loading or computation fails, the paid quiz artifact remains intact and the user can retry or safely continue later.
11. After A/B, the user sees one very short transition: `Deine Grundlage steht. Jetzt machen wir sie zu deiner.` plus `Als Nächstes gleichen wir den Plan mit deinen Produkten ab.`
12. During this milestone the global flag remains off for paid users; local/review environments may stop at that transition. Stage 1 does not set `onboarding_completed`, redirect to Chat/Routine, or implement the following onboarding until Stage 2 owns continuation.
13. Later post-plan onboarding feeds the same need engine to create a separate refined need snapshot. Stage 2 presents that refined category plan together with exact products; Stage 3 adds executable routines. Only the complete final proposal can become active.

Meaningful variants covered by the review artifact:

- dense Basis page with directional navigation to a separate Optional page;
- Basis only with no empty Optional page or step; this is a review state of the Basis page, not another page;
- multiple roles inside one category card;
- long detail explanation without copy-heavy overview;
- paused category on the Optional page; this demonstrates the layered execution state, not another page;
- quiz-only deferred facts that do not block or appear as false negative cards;
- A/B to `Deine Grundlage steht. Jetzt machen wir sie zu deiner.` transition;
- retryable load/compute error.

## 9. Ordered implementation tasks

### Execution and PR boundaries

After final counterpart review and journey sign-off, implement Stage 1 as three dependent, reviewable PRs from fresh worktrees based on current `origin/main`. Each PR keeps `PERSONAL_PLAN_APP_V1_ENABLED` off by default and must pass its own focused verification before the next PR is opened against it.

#### PR A — Deterministic Bedarfsplan engine

**Owns:** Tasks 1–7.

**Produces:** the complete versioned quiz-input contract, shared assessments, all ten category modules, portfolio arbitration, reason salience, and deterministic golden fixtures. It has no database, route, React, catalog, or analytics dependency.

**Merge/review boundary:** all ten category authorities are confirmed; the explicit 137-fixture Stage-1 subset, Oil Stage-1 rule rows, named portfolio fixtures, and a new quiz-only partial-knowledge matrix pass; representative initial and refined computations are deterministic and have no network, database, catalog, LLM, or legacy-runtime call. The other 163 end-to-end category fixtures remain later-stage gates and cannot expand PR A's scope.

PR A is one review unit, not one giant worker brief. Freeze Task-1 contracts first, then implement disjoint category lanes against them: scalp/cleansing (`shampoo`, `deep-cleansing`, `dry-shampoo`, `scalp-care`), regular care (`conditioner`, `leave-in`, `oil`), intensive repair (`mask`, `bondbuilder`), and Heat (`heat-protectant` plus the plan-owned exposure adapter). Each lane owns only its category files/tests and may not edit shared types after the freeze. The orchestrating session owns input/assessments, portfolio arbitration, integration, full-diff review, and aggregate verification.

#### PR B — Initial snapshot persistence/API

**Owns:** Tasks 8–9.

**Consumes:** the reviewed PR-A contracts without redefining category policy.

**Produces:** additive database tables/guards, owner-scoped persistence, audience access, immutable quiz-only initial-snapshot compute/read endpoints, display-only exact-product previews from the shared matcher, and route/database tests.

**Merge/review boundary:** authorization, artifact ownership, idempotency, snapshot immutability, and feature-flag behavior are proven independently of the UI.

#### PR C — Immediate Bedarfsplan UI

**Owns:** Tasks 10–12.

**Consumes:** the reviewed PR-B API—including saved exact-product previews—and the approved Stage-1 density/state artifact.

**Produces:** `/plan-start`, separate Basis/Optional result pages, Routine-inspired compact cards, the `Deine Grundlage steht. Jetzt machen wir sie zu deiner.` transition, error/recovery/resume behavior, analytics, screenshots, and the end-to-end review receipt.

**Merge/review boundary:** the reviewed journey works at 375px and desktop, matches the approved artifact, preserves the flag-off legacy path, and passes the repository readiness/review loop.

The PR split is an execution boundary, not three architectures: types and category policy remain owned by PR A; PR B may not reinterpret decisions; PR C may not recompute them client-side. Stage 2/3 specification may proceed in parallel after PR A contracts are stable, but its code must not be folded into these PRs.

#### Shared cross-category enrichment follow-up — separate from Stage 1

After the shared schema/runtime groundwork exists, run one coordinated enrichment PR rather than several category-specific migrations. It is not a dependency for the catalog-independent PR-A Stage-1 computation, but its relevant rows must pass before Stage-2 reconciliation or Stage-3 recommendation/application activation:

- Heat Protectant: verify and enrich the six confirmed active exact packages; retain the pending Balea package as ineligible until review completes;
- Mask: execute the safe `concentration` to nullable `repair_support_level` expand/backfill/contract migration across the legacy engine, approval `SECURITY DEFINER` RPCs, generated types, admin/intake JSON/validators/selectors/tests, and every script writer; then verify critical protocol packages for all 35 active recommended Masks;
- Deep Cleansing: verify/backfill canonical role and scalp-target rows for the five launch products;
- Dry Shampoo: verify the minimal canonical spec for all 10 active recommended products;
- Conditioner: no enrichment shortage; preserve its existing verified facts through shared migrations.

The follow-up reports exact coverage counts, missing facts, source provenance, consumer verification, and stable value fingerprints. It never activates a category before that category's documented catalog/protocol gate passes. Scalp Care's larger identity/intake/protocol migration remains governed by its own confirmed sequence and may share infrastructure without being collapsed into an unsafe partial launch.

### Completed category checkpoint integration

Heat Protectant, Bondbuilder, and Scalp Care now have confirmed decision/evidence authorities alongside the original seven categories. The shared plan consumes them without creating category-local substitutes. Their catalog, schema, and protocol work remains an explicit later-stage activation gate rather than blocking the pure Stage-1 engine.

### Task 1 — Create Stage-1 contracts and fixture harness test-first

**Consumes:** all ten confirmed category decisions and the contracts in §5.

**Produces:** `types.ts`, full/partial-knowledge fixture builders, stable rule/reason ID constants, and aggregate test discovery.

- Add the directory, one sentinel test, and `tests/personal-plan/categories/*.test.ts` to the Node test command in the same commit so the literal glob never points at an empty directory. Keep the category suite in the CI contract-test job; `npm run ci:verify` alone does not execute it.
- Encode category, tier, role, target, cadence, reason, deferred-fact, resolution, and execution-state types without importing legacy recommendation-runtime decision types.
- Add builders for a complete paid quiz envelope, initial quiz-only unknown routine context, later refined context, and a deterministic snapshot comparator.

**Complete when:** type/serialization tests prove stable canonical payloads and the aggregate test command executes a nested sentinel category test.

### Task 2 — Build quiz-faithful input and shared assessments

**Consumes:** prepared-artifact `quiz_answers` plus optional post-plan context for parity fixtures; current pure assessment prior art.

**Produces:** `buildPlanProfile(...)`, `buildPlanNeedAssessment(...)`, and typed partial-knowledge/deferred facts.

- Preserve every goal, concern, scalp answer, treatment, and mandatory physical fact without passing through `canonical_profile` or `offer-adapter.ts`.
- Implement exactly the named assessment union in §3; do not recreate CareBalance as a generic score layer.
- Copy/rewrite proven arithmetic into plan-owned pure helpers with category fixture parity where intentional.
- Validate mandatory paid-quiz thickness and exact multi-select scalp concerns; never guess or collapse them. Represent washing frequency, current-product load, Hair Tools exposure, Dry Shampoo preference, recurrence, and irritation detail as typed unknowns in the initial projection.
- Normalize historical V2 values once in the plan-owned adapter: `dry_dull_lengths -> dry_lengths`; `breakage_or_split_ends -> split_ends` as the confirmed conservative Personal Plan interpretation; and generic `scalp_imbalance` creates no V3 concern while the envelope's specific `scalpOiliness`/`scalpConcerns` facts remain authoritative. This deliberately differs from the current Customer.io compatibility projection that expands the combined breakage value to both concerns; do not reuse that projection as Personal Plan authority. Preserve V3 `hair_damage`, `breakage`, and `split_ends` as separate facts everywhere. If a legacy profile lacks the specific mandatory scalp facts, return typed incomplete input rather than silently dropping the only scalp signal.

**Complete when:** table tests cover complete paid quiz, malformed mandatory quiz, initial unknown later facts, refined known facts, deliberate initial-versus-refined differences, and hash stability, and prove the lossy offer projection is never read.

### Task 3 — Implement cleansing-family category modules

**Consumes:** `PlanProfile`, `PlanNeedAssessment`, Shampoo/Deep Cleansing/Dry Shampoo decisions.

**Produces:** three pure category modules and their full documented fixture matrices.

- Shampoo owns total wet-wash cadence and its confirmed roles.
- In the initial projection, Shampoo emits the scalp-led preferred target as `shampoo.cadence.quiz_starting_target`; this internal mode remains auditable but does not add a card-level preliminary label. In the refined projection, current behavior replaces that mode through the confirmed retain/nearest-boundary rules.
- Deep Cleansing substitutes inside that cadence and consumes only confirmed Reset-load facts.
- Dry Shampoo stays Optional-only. A bridge role that depends on the missing post-plan preference is deferred rather than requested or classified negatively in the initial plan.

**Complete when:** every documented fixture passes and total wash cadence cannot be increased by the Reset category.

### Task 4 — Implement baseline-care category modules

**Consumes:** shared inputs/assessments and Conditioner/Leave-in decisions.

**Produces:** pure Conditioner and Leave-in modules plus fixture coverage.

- Preserve the very-short Conditioner exception and narrow replacement boundary.
- Preserve all confirmed Leave-in Basis/Optional corroboration, use-case roles, and repair-support limitation.
- Do not schedule between-wash refresh or choose exact combined Heat products.

**Complete when:** category tests cover every decision fixture and no Leave-in rule claims primary structural repair or standalone Heat coverage outside the confirmed Heat decision.

### Task 5 — Implement intensive/finish category modules

**Consumes:** shared inputs/assessments and Mask/Oil decisions.

**Produces:** pure Mask and Oil modules plus fixture coverage.

- Preserve Mask inclusion independently from target repair support and keep optional masks unscheduled.
- Evaluate all three Oil roles, render one category, and retain role-level Basis/Optional facts.
- Do not create optional/non-wash occurrences in Stage 1.

**Complete when:** every documented category and interaction fixture passes, including multiple Oil roles without duplicate category cards.

### Task 6 — Implement Heat Protectant, Bondbuilder, and Scalp Care modules

**Consumes:** the three newly integrated category decisions and shared assessments.

**Produces:** pure Heat Protectant, Bondbuilder, and Scalp Care decisions plus all required fixtures.

**Complete when:** known Heat events and structural-repair profiles resolve to explicit categories; unknown initial Hair Tools exposure defers Heat Protection without a false `not_needed`; compatible carriers do not duplicate Heat use in refined fixtures; damage facts are not double-counted across Mask/Bondbuilder; Scalp Care remains optional-only; and all applicable `SC-*` coverage/safety fixtures pass with irritation detail safely deferred or paused in the initial projection.

### Task 7 — Compose the Stage-1 portfolio and reason salience

**Consumes:** all ten category outputs.

**Produces:** `computeNeedPlan(...)` for both initial and later refined projections, capability ledger, rendered order, selected reason facts, deferred-fact ledger, and plan-wide golden fixtures.

- Apply only confirmed primary/supporting ownership and named arbitration rules.
- Keep the non-coily Leave-in/Oil anti-frizz rule and explicit coily two-layer exception.
- Add Heat/Leave-in and repair/Mask/Bondbuilder arbitration exactly as their confirmed policies specify.
- Add Shampoo/Deep Cleansing/Scalp Care coverage suppression without hiding truthful optional Scalp Care reasons.
- Use the fixed `STAGE1_CATEGORY_ORDER`; never sort by score, catalog availability, or explanation salience.
- Prefer fewer categories only between equally complete, equally fitting portfolios; never let product ownership or later catalog availability rewrite Stage-1 need.
- Select at most two primary reason facts per card and retain all other evidence for detail/audit.
- Never use unknown later-only facts as false, empty, or `not_needed`. Store deferred roles/categories in the snapshot and omit only their unresolved UI cards from the initial plan.

**Complete when:** representative straight/wavy/curly/coily, scalp, Heat, treatment, damage, minimal, dense, Optional-only, multi-role, and quiz-only partial-knowledge fixtures produce byte-stable canonical snapshots, including at least one expected initial-versus-refined delta.

### Task 8 — Add immutable initial-plan persistence

**Consumes:** paid quiz artifact identity and canonical `InitialNeedPlanSnapshot`.

**Produces:** guarded migration, generated DB types, persistence helpers, and database/API tests.

- Preflight migration version uniqueness against current `origin/main` and parallel migration work.
- Before implementation, check the current Supabase changelog/docs and discover the installed CLI commands with `supabase --help`; do not assume a stale local command shape.
- Implement owner-scoped reads and server-controlled writes.
- Insert replacement initial snapshots transactionally only when the paid quiz artifact itself legitimately changes, and preserve every previous snapshot.
- Derive the initial hash only from the immutable paid quiz envelope and computation/schema version; no post-plan setup answer participates.
- Preserve the existing paid quiz envelope/version/hash exactly. Irritation detail and other later questions are not retrofitted into the quiz artifact by this milestone.
- Treat valid prepared-artifact identity/claim material as bearer-style capability data; never expose it in analytics or client logs.
- Add the repository's first focused Personal Plan migration integration check against a local Supabase/Postgres instance: apply the migration, exercise owner/non-owner reads, forbidden client writes, snapshot immutability, same-hash retry, changed-paid-artifact replacement, and parallel-current-initial uniqueness. Keep fast SQL-text/pure-helper assertions as supplementary tests; they do not count as proof that RLS or constraints execute correctly.
- Wire that check into the dedicated CI job rather than relying on a one-time local receipt. The job is the continuing regression gate for RLS, immutability, and one-current-initial uniqueness; the implementation receipt records its passing run and migration fingerprint.

**Complete when:** the local database integration receipt plus automated tests prove ownership isolation, immutable snapshots, retry safety, one-current-initial uniqueness, deterministic recomputation, and that Stage 1 exposes only proposed/superseded initial states.

### Task 9 — Add the protected Stage-1 API and audience gate

**Consumes:** entitlement primitive, linked prepared artifact, persistence helpers, computation.

**Produces:** server-only Stage-1 read/compute endpoint and typed client responses.

- Require both current app access and a linked Personal Plan artifact/current plan.
- Add `/plan-start` and `/api/personal-plan/**` explicitly to the authenticated route classifier; test through middleware as well as route handlers.
- Add the missing server-owned `isPersonalPlanAppV1Enabled()` reader for `PERSONAL_PLAN_APP_V1_ENABLED`, default false, and resolve it before protected data loading.
- Return a typed state: `computing`, `ready`, or `retryable_error`; Stage 1 never returns `needs_input` for post-plan facts.
- Never send raw source quiz answers or protected artifact credentials back to the client.
- Keep the global flag off by default and apply it server-side before protected data loading.
- Use the canonical input hash as the compute idempotency key; concurrent/retried requests either return the same row or transactionally create one replacement proposal.
- After need computation, call the shared Stage-2 matcher once per rendered category and persist its selected-or-absent `InitialProductPreview`; reload must reproduce both the exact packshot shown and any honest no-preview state.

**Complete when:** route tests cover unauthenticated, wrong audience, missing/malformed paid artifact, successful quiz-only compute with deferred facts, retry/idempotency, disabled-flag behavior, a persisted `selected` preview, and each typed `absent` preview reason without changing the category decision.

### Task 10 — Build the immediate paid-result shell and transition

**Consumes:** the protected quiz-only Stage-1 read/compute endpoint.

**Produces:** `/plan-start` shell, loading/retry behavior, and the post-result `Deine Grundlage steht. Jetzt machen wir sie zu deiner.` transition.

- Build the gated `/plan-start` entry and review path, but leave the production `/plan-bereit` CTA on its current onboarding destination until Stage 2 supplies a valid continuation. Review/test environments may opt into the route explicitly.
- Reuse the existing entitlement and artifact-ownership primitives, but compose a plan-result gate that does not require the legacy completed-`hair_profiles` onboarding state. Do not create a second buyer lookup or reuse the full legacy readiness predicate unchanged.
- Begin with computation/loading and then show A/B immediately. Never insert a questionnaire, confirmation overview, or current-product step before the paid result.
- After A/B, show the dedicated transition with the reviewed promise: the user already has a useful ideal plan, and the following Stage-2 onboarding will make it truly theirs by considering current products and missing context.
- In this milestone the transition CTA stops in a clearly labelled review state. Do not send the user to legacy onboarding, Chat, Routine, or a half-built Stage-2 flow.

**Complete when:** component tests and browser fixtures prove the first paid output is always A/B, no question appears before it, reload reopens the same initial snapshot, Optional is skipped when empty, and the final A/B action reaches the dedicated transition without entering an unfinished onboarding.

### Task 11 — Build the Bedarfsplan surface

**Consumes:** ready `InitialNeedPlanSnapshot` and the reviewed density/state artifact.

**Produces:** compact category-level view models and accessible UI components.

- Render a Basis-only first result page. Render a separate Optional result page only when at least one optional category exists; otherwise omit the page, progress step, and navigation entirely.
- Keep up to eight Basis categories in one ordered mobile list; do not split them across internal pages or a carousel.
- Provide explicit forward/back arrow navigation between Basis and Optional while preserving disclosure state and scroll behavior predictably.
- Use one slim linear progress bar above the category list rather than segmented `Basis`/`Optional` navigation pills.
- Render each category once; use role/use-case pills inside the card.
- When the saved `InitialProductPreview.state` is `selected`, show its `imageUrl`, target type, one concise purpose/personal-fit sentence, no more than two calm property/use-case pills, and cadence in a separate rhythm row. The UI never hard-codes catalog URLs or draws a substitute bottle; `state = 'absent'` collapses the image column cleanly and preserves the typed absence reason for audit/tests.
- The server-side preview projection must call the shared Stage-2 matcher and return only a verified eligible, image-backed current candidate. It may not create separate Stage-1 fit rules or feed its product availability back into category need.
- Make the expanded content span the full card width. Present it as an `Anforderungsprofil` with three visually distinct, non-numbered fact blocks: `Worauf es beim Produkt ankommt`, `Warum das zu deinem Haar passt`, and `Empfohlener Rhythmus`; render fewer blocks only when the category state legitimately has fewer facts.
- On mobile use the compact Routine-derived card variant from the approved artifact; clamp the overview purpose to two lines and keep all essential target, property, and cadence information visible without opening the card.
- Keep all questions and choices out of Stage 1; disclosures are read-only explanations and contain no Chat or product-selection action.
- Keep paused included categories visible and make `not_needed` absent.
- Use button/`aria-expanded` disclosure semantics and keyboard coverage.
- Reuse routine-card visual language without reusing `RoutineUiCard`, CareBalance semantics, concrete-product actions, or Chat actions.

**Complete when:** component, accessibility, navigation, and 375px visual tests cover every state listed in §8, including selected and absent-preview card geometry, and match the reviewed artifact after Nick's feedback.

### Task 12 — Add analytics, rollback, and end-to-end verification

**Consumes:** existing analytics facade, feature flag, complete Stage-1 journey.

**Produces:** privacy-safe typed events, browser test, QA receipt, and implementation handoff.

- Track code-owned category/tier/count/reason IDs only; never raw answers, free text, user/product identity, artifact tokens, or German copy.
- Do not widen the existing analytics-consent gap: new Stage-1 client events route to PostHog or another non-essential destination only when `loadConsent()?.analytics === true`, and consent withdrawal stops subsequent sends. If the shared facade cannot enforce that invariant safely in this PR, leave the new destination route disabled rather than emitting before consent.
- Verify the global flag disables the route without changing the current production CTA/onboarding behavior. The Stage-1 milestone does not set `onboarding_completed`; that transition belongs to the complete Stage-2/3 journey.
- Treat the migration as additive and forward-compatible. Operational rollback is feature-flag disablement plus application rollback while retaining inert tables and immutable proposal rows; do not use a destructive down migration against production data.
- Run focused category tests, `npm run test:contracts`, the dedicated Personal Plan database-contract script/job, `npm run ci:verify`, and the repo ready/review loop.
- Compare implementation screenshots at 375px with the approved planning artifact and test desktop containment.

**Complete when:** the feature-flagged journey is reproducible end to end, all automated checks pass, no unresolved category fixture remains, and no paid-user exposure has occurred.

## 10. Verification

### Automated

- the explicit 137-fixture Stage-1 subset plus Oil's parameterized Stage-1 role rows in `tests/personal-plan/categories/*.test.ts`; the remaining 163 fixtures are retained for Stage-2/3 execution plans rather than falsely gated here;
- plan input/assessment and explicit cross-category coverage/arbitration golden fixtures;
- canonical initial-snapshot stability, reason-salience, and explicit partial-knowledge tests that distinguish deferred from `not_needed`;
- a representative in-process fixture benchmark with p95 pure Stage-1 computation below 50 ms on the development machine, recorded as a regression signal rather than a cross-machine SLA;
- migration SQL-text/pure-helper tests plus the CI-backed local Supabase/Postgres integration check for RLS, immutability, idempotency, concurrent-current-initial uniqueness, and legitimate paid-artifact replacement;
- API auth/audience/artifact/flag tests;
- UI component, disclosure accessibility, Basis/Optional navigation, optional-page omission, pause, error, and retry tests;
- paid quiz envelope compatibility tests proving Stage 1 neither mutates nor upgrades the source artifact;
- global flag rollback tests;
- Playwright golden path from the gated review/test `/plan-start` entry directly through Basis, conditional Optional, and the `Deine Grundlage steht. Jetzt machen wir sie zu deiner.` transition, plus a flag-off assertion that `/plan-bereit` retains the legacy production CTA;
- existing Personal Plan quiz, offer, readiness, routine, auth, entitlement, and analytics regressions;
- `npm run ci:verify`.

The pure need engine must perform no LLM, catalog, database, or external-network work. The server endpoint may perform one bounded eligible-catalog read after need computation to attach previews; it must not call an LLM or external network. In local integration verification, a warm Stage-1 compute, preview-select, and save request should complete below one second; record the environment and result in the PR-B receipt rather than encoding a flaky wall-clock CI assertion.

### Manual/browser

- 375px and 320px: eight-card compact Basis edge case on one scrollable page, separate Optional page, Basis only, multi-role Oil, multi-role optional Scalp Care, long detail, paused Dry Shampoo/Scalp Care, error/retry, no horizontal overflow, and reachable sticky navigation;
- desktop: narrow app flow remains centered and does not inherit legacy split onboarding;
- refresh/back/resume reopens the same immutable quiz-only initial snapshot without asking a question;
- flag off preserves the existing production path;
- unrelated subscribers and unlinked users cannot enter;
- German copy is compact and makes the displayed packshot a quiz-only best-match preview rather than a confirmed final product; it does not imply observed progress, medical treatment, or a complete active plan.

### Evidence-sensitive

- verify each rule cited by category tests still matches all ten owning `decision.md` authorities;
- reject any implementation shortcut that calls CareBalance/legacy runtime as Stage-1 authority;
- verify no Stage-2 catalog constraint is accidentally used to decide inherent Stage-1 need.
- verify Mask and Bondbuilder consume the same raw damage facts independently without adding scores or suppressing one another.
- verify Heat capability remains binary tri-state, Deep Cleansing omits colour-treated compatibility, Dry Shampoo keeps its minimal schema, and Mask has no legacy dual-write alias after the safe migration completes.

## 11. Review and handoff

### Counterpart findings ledger

The final read-only Claude/Opus-high review ran after the ten-category integration. Its transient report remains outside the repository and is discarded after reconciliation.

| ID | Type | Evidence | Decision | Plan change/revalidation |
|---|---|---|---|---|
| `R1` | defect | The 300 category fixtures include Stage-2/3 product/protocol assertions outside PR A | accepted and later refined by `R39` | PR A now gates on an explicit 137-fixture Stage-1 subset plus named portfolio fixtures; the other 163 remain later-stage authorities. |
| `R2` | scope/product decision | `Stage1ReportedProductUse` had no producer in the new path | superseded by Nick's 2026-08-07 journey correction | Stage 1 no longer contains a current-product-use field. Post-plan onboarding and Stage 2 own that separate producer/contract. |
| `R3` | defect | Redirecting the live CTA before Stage 2 would strand users and leave `onboarding_completed` unset | accepted | Stage 1 keeps the production CTA/legacy onboarding unchanged; `/plan-start` is review/test-only until Stage 2 owns continuation. |
| `R4` | defect | Concurrent compute could create two current proposals | accepted | Added same-hash idempotency, unique input hash, partial one-current constraint, plan lock, and local DB integration proof. |
| `R5` | tradeoff | Envelope v4 creates version/hash/outbox compatibility work | removed from Stage 1 | The immediate plan preserves the existing paid quiz artifact unchanged. Irritation detail is collected after the plan and does not force a Stage-1 quiz-envelope migration. |
| `R6` | tradeoff | Plan-owned V2 concern migration differs from current Customer.io compatibility projection | accepted as already confirmed category policy | Documented the deliberate conservative mapping and all legacy values; forbade reuse of the lossy Customer.io projection. |
| `R7` | defect | Protected route/API prefixes were only implied | accepted | Task 9 now names middleware classification and tests. |
| `R8` | defect | Input flag was unreadable from the client as written | superseded for Stage 1 | There is no pre-plan irritation input or input-specific flag in this milestone. The later onboarding plan must define its own server/client flag boundary. |
| `R9` | defect | Global Personal Plan app flag reader did not exist | accepted | Task 9 now creates the server-owned reader before data loading. |
| `R10` | defect | Paused categories lacked a structured pause reason | accepted | Added `executionPauseReason` to the category output contract. |
| `R11` | defect | Database behavior exceeded the existing test harness | accepted | Task 8 now adds a focused local Supabase/Postgres integration check; SQL-text tests are supplementary only. |
| `R12` | defect | Analytics surfaces/server-client boundary were under-specified | accepted | Target map names router files/adapters and records compute outcome after the typed result reaches the client. |
| `R13` | tradeoff | Removing `personal_plans` would reduce the initial table count | rejected | The stable living-plan identity is already a confirmed product architecture and prevents coupling mutable drafts/versions to a prepared-result capability. Removed the redundant draft hash and supersedes back-pointer instead. |
| `R14` | scheduling risk | Reviewer cited a commerce/access incident outside this plan's current evidence set | deferred to activation preflight | It does not block off-flag implementation. Verify current checkout, entitlement, and artifact-linking health from live sources before any paid-user activation; do not treat the transient review claim as confirmed-current. |
| `R15` | defect | Oil/Leave-in authorities still contained historical V2 concern tokens while current main emits separate V3 concerns | accepted and completed | Ported both authorities to `dry_lengths`, separate `breakage`/`split_ends`, and removed Oil's obsolete `scalp_imbalance` boundary. The historical combined value keeps its conservative one-time mapping to `split_ends`; focused rule fixtures remain the implementation proof. |
| `R16` | product decision | Shampoo's refined cadence compares a scalp-led band with current frequency, which the paid quiz does not collect | resolved by Nick | Stage 1 shows the preferred scalp-led band as a labelled quiz starting recommendation; post-plan onboarding supplies current behavior for the refined retain/adjust decision. |
| `R17` | defect | `INITIAL-03` converted Mask's time-based cadence into an unsupported every-third-wash rule | accepted | Restored the category-owned weekly/every-two/every-three-week target; only achievable wash placement defers. |
| `R18` | defect | `concernRecurrence` dropped its `concernId` | accepted | The profile now preserves the complete `{ concernId, frequency }` fact. |
| `R19` | defect | The source contract named only V3 while the repository retains valid V2 paid envelopes | accepted | Added an explicit supported V2/V3 source union and one plan-owned historical adapter. |
| `R20` | defect | A prepared artifact may be purged after replacement, invalidating a plan that continued to depend on it | accepted | The initial version copies its validated source input; the optional artifact FK uses `ON DELETE SET NULL`, and reload reads the saved version. |
| `R21` | tradeoff | Delete PR B and recompute the initial plan on every view | rejected | Initial-versus-refined lineage, confirmation, reproducibility, and what-the-buyer-saw auditing justify the small two-table immutable model. |
| `R22` | tradeoff | Omit Heat and other initially deferred modules from PR A | rejected | One shared engine must recompute the refined snapshot without a second authority. Initially unknown categories remain deferred, but all ten category modules stay in the deterministic engine. |
| `R23` | defect | Reusing the full legacy readiness predicate would require completed `hair_profiles` before a deliberately pre-onboarding result | accepted | Reuse entitlement/artifact primitives only and compose a dedicated plan-result gate without that prerequisite. |
| `R24` | complexity | Nine UI files over-split a two-page result and transition | accepted | Reduced the target to the route plus three focused components; small states stay local until reuse is proven. |
| `R25` | user-facing architecture | Interim mockup used invented category art although Stage 1 should preview the product the exact matcher currently considers best | resolved by Nick | Cards now use saved exact-product previews from the shared Stage-2 matcher. The preview is display-only and cannot become a second need authority; PR B waits for that matcher contract while PR A remains independently implementable. |
| `R26` | defect | `PlanKnowledge` could not represent missing optional `concernRecurrence` without misclassifying it as a promised post-plan fact | accepted | Added `PlanKnowledgeGapId`; `concern_recurrence` affects confidence/reason salience only and never enters snapshot `deferredFacts`. |
| `R27` | defect | Preview absence reasons were described but unrepresentable and would be lost on reload | accepted | `InitialProductPreview` is now a persisted selected-or-absent discriminated union with one result per rendered category. |
| `R28` | defect | Shampoo authority still required a repeated preliminary card label that contradicted the signed-off page-level framing | accepted | Updated the Shampoo authority: the internal mode stays auditable while the Stage-1 page lead supplies the single user-facing quiz label. |
| `R29` | defect | `hair_loss_or_thinning` triggered Scalp Care and Mask safety behavior without a shared Stage-1 owner | accepted | Added `PlanHairLossBoundaryAssessment`, explicit portfolio ownership, and `INITIAL-13`; it permits only limited-evidence optional Scalp Care and never creates repair need or a diagnosis. |
| `R30` | defect | The supported V2 branch had no complete Stage-1 fixtures and referenced an undefined legacy concern type | accepted | Inlined the eight-value V2 union and added `INITIAL-11`/`INITIAL-12`. A read-only production aggregate confirmed 379 attached V2 artifacts, so compatibility remains required. |
| `R31` | tradeoff | Remove packshots to make PR B/C independent of Stage 2 | rejected by confirmed user decision | The signed-off mockup requires actual current-best packshots. PR A proceeds independently; PR B/C explicitly wait for the separate Stage-2 selector implementation. |
| `R32` | defect | The RLS/immutability database integration proof had no continuing CI home | accepted | Added a focused database-contract script and CI job as the regression gate, not a one-time local receipt. |
| `R33` | complexity | Tasks 1–7 were too large for one undifferentiated implementation brief | accepted | PR A remains one review unit but now freezes shared contracts first and executes four disjoint category lanes before orchestrator-owned portfolio integration. |
| `R34` | defect | Target map named `personal-plan-ready-client.tsx` although the flag-off live path must remain unchanged | accepted | Removed the file from Stage-1 edits; only its existing readiness primitives are inspected/reused selectively. |
| `R35` | privacy risk | New client events could widen the existing analytics-consent gap | accepted | Stage-1 non-essential events require affirmative analytics consent; otherwise their destination route stays disabled. |
| `R36` | consistency | Basis-only review state used a different heading from the canonical Basis page | accepted | Corrected the retained mockup to `Deine Basis`; C remains only a review variant, never another user page. |
| `R37` | clarity | Shared frequency and plan/catalog vocabularies could be mistaken for legacy-runtime reuse or cast-compatible slugs | accepted | Named the stable frequency-vocabulary import and required explicit plan-to-catalog adapters for divergent category keys. |
| `R38` | defect | Quiz-only product load was required to remain deferred, but `PlanMissingFactId` had no representable ID for it | accepted during implementation | Added `current_product_load`; Reset and Deep-Cleansing decisions can now preserve unknown load without collapsing it into `not_needed`. |
| `R39` | scope defect | Dry Shampoo current-use fixtures were assigned to PR A although current product usage explicitly belongs to the separate Stage-2 input contract | accepted during implementation | Moved fixtures 1 and 14–19 to Stage 2, corrected the PR-A boundary to 137 named fixtures, and kept only quiz/preference-resolvable Dry Shampoo rules in PR A. |
| `R40` | logic defect | Initial implementations collapsed unknown load into negative Deep Cleansing/Scalp Care verdicts and treated any Heat event as material repair exposure | accepted during implementation | Added explicit deferred load states plus shared structural/Heat/mechanical damage levels; rare Heat no longer promotes Mask, while material Heat can raise shared repair support. |
| `R41` | policy/code drift | Four category modules normalized reason salience locally while six exposed every matching fact as `primary` | accepted in final code review | Moved the at-most-two-primary rule to the shared portfolio pass and added an end-to-end all-category regression fixture; all evidence facts remain available as secondary/detail. |
| `R42` | partial-knowledge defect | A refined plan with known Shampoo frequency still reported `shampoo_frequency` as deferred inside Reset load | accepted in final code review | Reset assessment now preserves the known frequency as a source fact and defers only `current_product_load`; focused assessment and full-compute regressions cover the boundary. |

### Required gates before implementation handoff

1. **Completed:** Heat Protectant policy is confirmed; its final decision/evidence files are present in the planning worktree and await explicit authorization to join the final planning commit.
2. **Completed:** Bondbuilder and final Mask policy are committed at `40b2d67b` and `9c6200d7`.
3. **Completed:** Scalp Care policy is confirmed and integrated unchanged from reviewed source commit `37c6217c` as local commit `7c3d116a`.
4. **Completed and signed off 2026-08-07:** Nick approved the linear progress bar, one Basis page for up to eight categories, separate conditional Optional page, actual current-best exact-product packshots, page-level quiz framing without card disclaimers, a non-sequential `Anforderungsprofil`, and the shortened G transition.
5. **Completed in this integration pass:** update the plan/index to ten categories, the shared assessment/input union, explicit portfolio matrix, 300 named fixtures, and later-stage activation gates.
6. **Completed and revalidated 2026-08-07:** the required Claude/Opus-high review was rerun after the ten-category and visual integration; every material finding is classified in `R26`–`R37` and reconciled above.
7. **Completed 2026-08-07:** Nick corrected the order to immediate quiz-only A/B, followed by `Deine Grundlage steht. Jetzt machen wir sie zu deiner.`, post-plan onboarding, and a later refined Stage-2 product plan. The rejected pre-plan usage-context artifact was removed.
8. **Completed 2026-08-07:** Nick re-reviewed and signed off the revised A/B cards and transition state in the retained Stage-1 mockup.
9. **Completed with findings:** the focused counterpart revalidation confirmed the A/B-first journey and partial-knowledge model, and identified findings `R15`–`R24`; `R16` is now resolved and the remaining vocabulary port is tracked in gate 11.
10. **Completed:** Nick chose the quiz-led preliminary Shampoo recommendation; the authority, initial fixture, and page-level quiz framing preserve the distinction between recommendation and observed behavior without repeating a card disclaimer.
11. **Boundary frozen; implementation deliberately external:** this plan defines the persisted selected-or-absent preview contract. The separate Stage-2 task owns category-specific selector implementation before PR B; PR A remains catalog-independent and may proceed separately. The quiz-only nature of the preview is explained once at page level, never repeated as a product-card disclaimer.
12. **Authority port completed:** Oil and Leave-in now use V3-native concerns. PR A must implement and run their focused named/parameterized fixtures as the executable proof.
13. **Completed 2026-08-07:** Nick explicitly confirmed the complete corrected Stage-1 journey and authorized Stage-1 implementation.
14. **PR A implementation complete and review-ready:** the confirmed planning package and deterministic runtime are present in the fresh Stage-1 implementation worktree. The final code-review findings are reconciled and all verification gates pass. Changes remain uncommitted until Nick explicitly authorizes a commit.

### Worktree

Implementation runs in the fresh synchronized worktree `.worktrees/personal-plan-stage1-implementation` on `codex/personal-plan-stage1-implementation`. The older planning worktree remains preserved and untouched because it contains separate Hair Tools artifacts.

### Artifact disposition

- this Stage-1 implementation plan: **commit after final review/sign-off**;
- Stage-1 density/state mockup: **commit as the confirmed Stage-1 visual authority**;
- rejected pre-plan current-routine context mockup: **removed; do not retain or commit**;
- existing category evidence/decisions and parent specs: **retain as committed authority**;
- Heat Protectant, Bondbuilder, Mask, and Scalp Care evidence/decisions: **retain as confirmed authorities; include any still-uncommitted confirmed files only after explicit commit authorization**;
- transient explorer and counterpart-review reports: **discard after findings are reconciled**;
- separate Hair Tools artifacts: **untouched by this plan**.

### Stop point

Implementation stops at a verified, feature-flagged, review-ready Stage-1 handoff. This plan does not authorize commit, push, PR, merge, deployment, feature activation, or paid-user exposure. Use `implementation-loop` only after every gate above is confirmed.
