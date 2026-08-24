# Hair Tools — spec hardening and remediation handoff

Status: **blocked on eight spec decisions.** Do not resume implementation before
the Decisions section is settled with Nick.

Branch `codex/personal-plan-hair-tools-current-shape`, commits `c5da1058`
(implementation) and `aa457023` (review verdict). Nothing pushed. Phase 1 is
feature-complete and **not merge-ready**: three independent review lanes returned
seven blocking defects, four high and a product decision. The full finding list
lives in `plans/2026-08-21-personal-plan-hair-tools-phase1-verification-receipt.md`
— this document is about _why_ they happened and what to fix first.

## Why this document exists

The findings are not mostly coding slips. Roughly two thirds trace to places where
the written spec did not actually decide something, so the implementer decided it
silently — and inconsistently across files. Fixing the code without fixing the spec
would reproduce the same class of defect.

Nick's read on 2026-08-21: the specs were hurried. Agreed.

## Root causes

**R1 — The spec is written against a quiz vocabulary that no longer ships.**
`decision.md` and the guidance matrix use `volume`, `less_volume`, `curl_definition`,
`blow_dry`, `blow_dry_diffuser`, `brush_type`, `styling_tools`. Production has
`volume_balance`, `shape_definition`, `dryingRoutes: [air_dry | ordinary_blow_dry |
diffuser_or_airflow_shaping]`, `additionalHeatTools`, `nightProtection`. There is no
authoritative mapping between them, so every single rule required the implementer to
invent a translation. Two of those inventions became blocking defects. This is the
largest single cause.

**R2 — 123 fixtures exist as prose; none is executable.** Rule IDs appear in the
spec and in `route.ruleIds`, but nothing asserts "this profile produces this rule ID
at this tier with this lead form". Every rule-fidelity defect survived a green suite.

**R3 — The spec names lead forms but never says where the lead is decided.** B02,
N02, W02 and C02 all specify which form leads. The implementation computed that in
`routes.ts` and then destroyed it in `assets.ts` by re-sorting into canonical family
order. No spec sentence was violated, because none existed.

**R4 — "One shared choice" has no representation.** `tools.styling.volume_basis`
requires one shared air/heated/heatless choice counted once. The contract only has
independent routes plus an `alternativeRouteKey` that no presentation layer reads, so
one need renders as two Basis cards.

**R5 — The spec uses one word for ownership and for coverage.** B04 says any
reported brush "suppresses another foundational recommendation" — that is _coverage_
(do we recommend acquiring?). The implementation expressed it as `owned_generic` —
that is _ownership_ (what did the user tell us?). Conflating them produced
„Nutze deins" for a form the user explicitly denied.

**R6 — Occurrence anchors do not match the real day sequence.** `ToolPlacement` has
five slots; a real wash day has roughly eight ordered positions. There is no slot
between `condition` and `leave_in`, so the towel step lands after leave-in and heat
protection. B12's texture-aware detangle timing has nowhere to live.

**R7 — Persisted-field and completion-semantics changes had no versioning
discipline.** A refinement answer key was renamed with no decoder, and the
completion predicate changed meaning for already-stored completed drafts. Result: a
completed journey can become unloadable after a rollout toggle.

## Decisions needed before any code (the gate)

Each needs an explicit ruling recorded in `decision.md` or the guidance matrix.

**D1 — Volume direction.** The quiz aliases both "mehr Volumen" and "weniger
Volumen" onto `volume_balance`. Nick instructed inferring direction from texture and
thickness. But H08 states: "Do not infer it from density, thickness, texture, frizz,
shine, `less_volume`." And a third disambiguator already ships in
`src/lib/quiz/normalization.ts` which also reads _density_ and disagrees — a
wavy/normal-thickness profile is `less_volume` there and "wants more volume" in
Tools. Options: (a) recommend nothing on the merged token, matching H08;
(b) keep the inference and amend H08, adopting `normalization.ts` as the single
predicate so all three agree; (c) restore directional intent at the quiz boundary.
This decision determines what the styling rules are, so it blocks WS2.

**D2 — `diffuser_or_airflow_shaping`.** One Feinschliff option covers two distinct
spec triggers (diffuser drying, and formender Luftstrom for volume). The code commits
to the diffuser reading unconditionally. Same shape as D1; decide both together.

**D3 — Feinschliff capture semantics.** Three things disagree today: `decision.md`
says the overview preserves all eight family names; the approved plan uses four
presentation sections; the on-screen copy promises „Was du auslässt, bleibt offen —
wir behaupten nichts" while the code writes explicit `[]` for un-ticked families.
Decide: section granularity, whether omission means unknown or none, and whether
known care answers preselect. The preselect helpers exist and are called by nothing.

**D4 — Split ownership from coverage.** Ratify two independent fields: what the user
reported, and whether the plan recommends acquiring anything. B04 sets coverage only.

**D5 — Shared choice groups.** Give "one shared choice counted once" a first-class
representation, and state how a group renders and how fulfilment is counted.

**D6 — Lead-form authority.** State that the route's form ordering is authoritative
and that every downstream dedup or projection must be order-stable.

**D7 — Canonical day anchor graph.** Define the wash-day position list once, shared
with the Application compiler, and place Tool occurrences into it.

**D8 — Versioning rule.** Any change to persisted refinement answers or to
completion semantics requires a path-version bump plus a decoder, and completed rows
must validate against their completion-time contract rather than today's.

## New spec artefacts to produce

1. **`docs/personal-plan/categories/tools/input-mapping.md`** — spec token →
   production field → exact allowed values → what information the production
   vocabulary loses, and the ruling for each loss. Closes R1.
2. **`docs/personal-plan/categories/tools/fixtures.md`** — one row per rule ID:
   concrete profile, expected tier, expected lead form, expected rule IDs. Becomes a
   table-driven test. Closes R2.
3. Amendments to `decision.md` and `conditional-guidance-matrix.md` recording D1-D8.

## Workstreams

Ordered by dependency. WS5 is independent and can start immediately.

| WS      | Scope                                                                                                                      | Depends on       |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **WS0** | Spec hardening: D1-D8, the three artefacts above                                                                           | Nick             |
| **WS1** | Contract: coverage/ownership split, choice groups, order-stable dedup                                                      | WS0 D4-D6        |
| **WS2** | Rule fidelity: rewrite `routes.ts` + `assets.ts` against the fixture table                                                 | WS0, WS1         |
| **WS3** | Missing routes: plopping, night continue-yours, refresh spray bottle, root-volume clip, definition brush, pick, Stielkamm  | WS0              |
| **WS4** | Feinschliff capture: preselection wiring, `[]` semantics, page-2 „Nichts davon"                                            | WS0 D3           |
| **WS5** | Availability and compatibility: completed-draft loadability, old-key decoder, path versioning                              | none — start now |
| **WS6** | Anwendung sequencing: day anchor graph, towel placement, B12 timing, heated-tool instructions and heat-protection ordering | WS0 D7           |
| **WS7** | Hygiene: dead guards, duplicate label maps, persist `careProvenance`, `evidence.md` terry correction, regenerate receipt   | none             |

## Finding → workstream map

Nothing from the review may be dropped silently.

- C1 lead-form re-sort → WS1 (D6) + WS2
- C2 synthesized `[]` overrides reported answers; preselect dead → WS4 (D3)
- C3 B04 coverage laundered into ownership → WS1 (D4) + WS2
- C4 heated and heatless both Basis → WS1 (D5) + WS2
- C5 owned heatless reported as missing → WS2
- C6 completed draft unloadable after rollout toggle → **WS5**
- C7 no decoder for old `toolSections` key → **WS5**
- Diffuser capability unverified from a behaviour answer → WS2 (D2)
- Heated/heatless steps render no instructions; no heat-protection ordering → WS6
- Night Protection N02 form map absent → WS2
- Night soft-tie duplicate Clips/Ties card → WS2
- Towel step after leave-in; B12 timing → WS6 (D7)
- Reported styling route shows no opposite-family alternative → WS2
- Plain Föhn counted as verified `air_shape` → WS2
- Missing routes → WS3
- „Nichts davon" pressed on unseen page 2 → WS4
- `conditionalReason` precedence; `behavior_only` false `explicit_none` → WS1
- Dead guards, duplicate label maps, `careProvenance` not persisted → WS7
- `evidence.md` terry over-claim; stale receipt → WS7

## Test discipline change (non-negotiable for WS2)

77/77 focused tests passed against every defect above. Required changes:

- **Table-driven rule-ID fixtures** from the new `fixtures.md`. A rule is not
  implemented until its fixture row passes.
- **Assert the rendered output, not only the route.** C1 survived because B02 was
  tested at the route layer, before the projection reordered it.
- **A test that asserts call sites, not return values.** The preselect test proved
  the helpers compute correctly while the product never called them.
- **Never let one author's test be the only check on that author's rule.** Every
  rule-fidelity change goes through an adversarial lane briefed that agreeing tests
  are not evidence.

## Do not change — confirmed sound by all three lanes

Closed care-product enums untouched; Routine V1/V2 discriminated union and every
reader; durable-asset boundary (no cadence, reorder, commerce, acquisition);
fail-closed rollout gate; direct-accept provenance (`assumed` never becomes
ownership); `withToolSteps` index arithmetic; heat protection always precedes heated
Tool use; nightly always last; styling day coverage; the Phase-2 cross-family
identity deferral. Treat these as regression surface, not as work.

## Entry instructions for the next session

1. Read this document, then the verification receipt for the finding detail.
2. Run `branch-gate`. Reuse this worktree; the branch already carries both commits.
3. Enter `plan-hardening-loop` for WS0 — this is spec work, not implementation.
   Present D1-D8 as decisions with options and consequences; do not choose for Nick.
   `$wayfinder` is available if the decision map turns out to be more tangled than
   D1-D8 suggests.
4. WS5 may proceed in parallel: it is a correctness and data-availability fix that
   no spec decision blocks.
5. Only after WS0 is ratified: WS1 → WS2 → WS3/WS4/WS6 → WS7, each ending in
   `ready-check` plus one adversarial lane.
6. Images remain outstanding and orthogonal: ~31 to generate, 11 of 42 already exist
   on branch `c1e04df3` with the style block in its `plans/tool-bildkarten.md`.

## Standing stop contract

No push, no PR, no merge, no migration, no catalog publication, no rollout
activation without separate explicit authorization from Nick.

---

# WS0 decisions brief — D1 to D8

Added 2026-08-24 by the WS0 spec-hardening pass, alongside
`docs/personal-plan/categories/tools/input-mapping.md` and
`docs/personal-plan/categories/tools/fixtures.md`.

**Nothing below is decided.** Each entry states what production can and cannot
express, two or three concrete options with what each makes easier and harder,
the residual risk, and a recommendation. Several are product calls that are
Nick's alone. Where a decision contradicts written policy, the policy is quoted.
Where shipped code already implies an answer, that is surfaced as evidence, not
as authority.

Two structural findings up front:

- **D1 option (b) as written in the gate above is malformed.** It proposes
  adopting `normalization.ts` "as the single predicate so all three agree". That
  predicate lives _upstream of the plan_, keys on `density`, and can abstain.
  The in-plan predicate keys on `thickness` and never abstains. Adopting
  `normalization.ts` would change **Conditioner**, a shipped care category — not
  only Tools. See D1.
- **Three candidates for a ninth decision** are listed after D8. At least the
  first (heat-protection field identity) is not optional: five fixtures and one
  confirmed matrix decision (`H15`) are written against a field the Personal
  Plan does not consume.

---

## D1 — Volume direction

### What production can express

- `PlanProfile.goals` may contain `volume_balance`. Nothing else. The quiz
  aliases **both** `volume` and `less_volume` onto that one token
  (`VISIBLE_GOAL_ALIASES`, `src/lib/quiz/diagnostic-input.ts`), and the alias is
  applied at draft-resume time, so the direction is gone before the plan sees it.
- `PlanProfile.concerns` may contain `low_volume_or_weighed_down` — a **separate,
  directional, un-inferred** signal that already ships.
- `ToolProfileFacts` exposes `texture`, `thickness`, `length`, `goals`,
  `concerns`. It does **not** expose `density`.

### What production cannot express

The user's stated direction. There is no field, and no migration can recover it
for existing rows.

### The four predicates that exist today

| #   | Where                                                                               | Reads                                                                 | Abstains?            | Result for `wavy` / `normal` / `medium`, no definition goal |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| 1   | `src/lib/personal-plan/volume-direction.ts` (used by **Conditioner** and **Tools**) | `texture`, `thickness`, `shape_definition` goal, `lost_shape` concern | no                   | **more volume**                                             |
| 2   | `src/lib/quiz/normalization.ts:298-318` (legacy-vocabulary projection)              | `thickness`, `density`, `structure`                                   | yes (emits neither)  | **less volume**                                             |
| 3   | `src/lib/personal-plan-quiz/offer-adapter.ts:172` `volumeGoal()`                    | `thickness`, `density`, `texture`                                     | yes (returns `null`) | **less volume**                                             |
| 4   | `decision.md` / `H08`                                                               | nothing — inference forbidden                                         | n/a                  | **no recommendation**                                       |

Predicate 3 is new information: the gate above named three, there are four.

### The policy contradiction, quoted

`conditional-guidance-matrix.md`, `H08`, status `confirmed`:

> only the canonical explicit `volume` goal creates a proactive shared volume/set
> need. Do not infer it from density, thickness, texture, frizz, shine,
> `less_volume`, or mere ownership/use of a compatible tool.

The shipped Tools implementation infers direction from **texture and thickness**.
That is a direct contradiction of a confirmed matrix decision, not a gap.
`decision.md`'s `tools.styling.none` repeats it: "no supporting route from frizz,
shine, texture, density, health, repair, damage, or breakage."

### Evidence from shipped code

- Predicate 1 is **not new on this branch.** It ships on `origin/main` inline at
  `src/lib/personal-plan/categories/conditioner.ts:122-132`; this branch only
  extracted it into a shared module. Its semantics are unchanged. So "infer
  direction from texture and thickness" is **already live in production** for
  Conditioner weight.
- **Only Conditioner** resolves direction. `grep volume_balance` over
  `src/lib/personal-plan/` hits exactly three files: `volume-direction.ts`,
  `tools/routes.ts`, `categories/conditioner.ts`.
- `density` is read by **zero** care categories. Every weight decision in the
  plan keys on `thickness`.
- **Five** categories already read `low_volume_or_weighed_down` directionally, as
  unconditional "one step lighter", with no texture or thickness gate:
  `conditioner.ts:116`, `leave-in.ts:38`, `mask.ts:75-77`, `oil.ts:71-74`,
  `deep-cleansing.ts:43-54`.

### Options

**(a) Recommend nothing on the merged token — honour `H08` as written.**
`volume_balance` alone never creates a styling need. Reported tools still get use
guidance.
_Easier:_ no inference anywhere; H08 stands untouched; the strongest honesty
position — we never tell someone who asked for _less_ volume to buy a volumising
tool; 14 fixtures resolve to "no route".
_Harder:_ `tools.styling.volume_basis`, `tools.airflow.air_shape_basis`,
`tools.brush.pick_optional`, `tools.brush.manual_air_shape` and the root-volume
clip become **dead rules** — the whole shared-volume architecture (`A02`–`A04`,
`H07`, `B08`) has no trigger. Also **inconsistent with shipped Conditioner**,
which does infer. Fixtures 6, 34, 35, 36, 47, 48, 55, 65, 67, 73 all become
"no route".

**(b) Adopt the shipped in-plan predicate and amend `H08`.**
Use `volume-direction.ts` — the predicate Conditioner already ships — as the one
source of truth, and rewrite `H08` to say direction _is_ inferred from texture and
thickness, listing exactly which signals are and are not permitted.
_Easier:_ one predicate across the whole plan, already covered by a 24-combination
parity test; no shipped behaviour changes; the volume architecture stays alive.
_Harder:_ requires amending a `confirmed` matrix decision, which is a real
product reversal and must be recorded as such. Every inferred route must carry
`tools.styling.volume_direction_inferred` and say so in its reason payload. Does
**not** make predicates 2 and 3 agree — they live upstream and read `density`;
they would have to be documented as a separate, non-plan concern or aligned
separately.

**(c) Restore directional intent at the quiz boundary.**
Split the goal card back into two, or add a one-tap follow-up when
`volume_balance` is chosen. New rows carry the direction; old rows stay merged
and fall back to (a) or (b).
_Easier:_ removes the inference entirely for new users; H08 survives verbatim for
them; the honest answer to a genuinely ambiguous question.
_Harder:_ a quiz change — new screen or new option, new German copy, a persisted
answer shape, a migration path for stored drafts, and a funnel-conversion risk on
a screen that is already in the paid path. Also does not resolve existing rows,
so (a) or (b) is still needed as the legacy fallback. Slowest by far.

### Residual risk

- Under (a): the product silently drops a whole family of recommendations users
  may reasonably expect, and Conditioner and Tools read the same profile
  differently — the exact failure `volume-direction.ts` was extracted to prevent.
- Under (b): a `wavy` / `normal` / `medium` user who meant "weniger Volumen" is
  told to buy a volumising tool. This is the concrete harm `H08` was written to
  prevent, and it is currently live.
- Under (c): conversion risk on a paid-funnel screen, for a goal only some users
  hold.

### Recommendation

**(b) for existing rows, with (c) queued as a separate, later quiz change.**
Rationale: (b) changes no shipped behaviour and keeps one predicate; (a) would
create a Conditioner/Tools split and kill four confirmed route decisions. But (b)
is a reversal of a `confirmed` decision and must be recorded as one, not slipped
in. **Two sub-questions must be answered with it:**

1. Does `low_volume_or_weighed_down` — the un-inferred directional concern five
   categories already read — also trigger the volume routes? If yes, a large
   share of volume cases stop depending on inference at all.
2. Does the shipped predicate need a `null` state so that a genuinely ambiguous
   profile recommends nothing, matching predicates 2 and 3? Today it never
   abstains: every profile that is not "control" is "wants more volume".

---

## D2 — `diffuser_or_airflow_shaping`, and the shape of `dryingRoutes`

### What production can express

`care.dryingRoutes: DryingRoute[] | null`, a **multi-select** over `air_dry`,
`ordinary_blow_dry`, `diffuser_or_airflow_shaping`. `[]` is a valid completed
answer. `null` is unknown.

### What production cannot express

- Which of the two spec triggers — diffuser drying (`A05`) or formender Luftstrom
  / air shaping (`A03`, `A04`) — the user meant when they picked
  `diffuser_or_airflow_shaping`. One option, two meanings.
- A single "dominant" drying method. `decision.md` assumes one
  (`drying_method in {air_dry, blow_dry, blow_dry_diffuser}`); production stores
  a set. Mixed sets and the empty set have **no spec rule at all**.

### Evidence from shipped code — two modules already disagree

`src/lib/personal-plan/refinement/heat-events.ts` maps the same stored answer:

```
diffuser_airflow_shaping: { tool: "hair_dryer", route: "airflow_shaping" }
```

and `requiresStage2HeatProtection` therefore **asks the user a heat-protection
question** for it. The Tools code (`routes.ts`) reads the identical answer as
diffuser drying only, and `A11` tiers heat protection differently for the two:
`not_needed` for diffuser, `optional` for airflow shaping. Production's own
refinement path has already committed to the airflow-shaping reading.

Second consequence, already on the findings list: the code treats the behaviour
answer as proof of a `diffuse_airflow` **capability** (`capabilityVerified=true`),
which `A06` forbids — "if diffuser compatibility is unknown, do not claim
compatibility".

### Options

**(a) Read the option as airflow-shaping, matching `heat-events.ts`.**
Diffuser drying becomes an unproven sub-case; the diffuser route requires a
separately reported diffuser-capable device.
_Easier:_ one consistent reading across the two shipped modules; `A11`'s
`optional` heat-protection tier applies coherently; `A06` is honoured.
_Harder:_ `A05` ("require diffuser capability for reported diffuser drying")
loses its trigger; curly users who do diffuse are no longer recognised from the
drying answer alone.

**(b) Read it as diffuser drying, matching the current Tool code.**
_Easier:_ no Tool code change; `A05` keeps its trigger.
_Harder:_ contradicts `heat-events.ts`, which already asks a heat-protection
question the diffuser reading says is `not_needed`. Two shipped modules stay in
conflict. Still needs the `capabilityVerified` fix.

**(c) Split the Feinschliff option into two.**
"Föhnen mit Diffusor" and "Föhnen mit formendem Luftstrom / Rundbürste" as
separate choices.
_Easier:_ both spec triggers become directly expressible; `A03`, `A05` and `A11`
all work as written; the heat-protection tiering becomes correct per option.
_Harder:_ a persisted-answer change with a decoder and a path-version bump (see
**D8**); new German copy; `getSelectedStage2HeatEventSources` and
`STAGE2_HEAT_EVENT_DEFINITIONS` both change; existing completed drafts need a
migration rule.

### The three sub-rulings production forces regardless of (a)/(b)/(c)

1. Does **any** blow-dry member make the profile "blow-drying"? (Today: yes.)
2. What is `["air_dry", "ordinary_blow_dry"]`? The blow-dry branch, the air-dry
   branch, or both? (Today: the blow-dry branch, silently.)
3. What is `dryingRoutes = []` — an explicit "none of these"? It is **not**
   `air_dry`, yet today it lands in the `air_dry` optional branch.

### Residual risk

Under (a) and (b) alike, one stored answer keeps carrying two meanings and every
future reader must re-derive which one applies. Under (c), a persisted-shape
change lands on the same branch that already has the versioning problem D8
describes.

### Recommendation

**(a) now, (c) queued** — align Tools with `heat-events.ts`, which already
shipped the airflow-shaping reading and already asks a heat-protection question
for it. Rewrite `A05` to require a separately reported diffuser-capable device
rather than inferring capability from a behaviour. Answer the three sub-rulings
explicitly in `decision.md`; sub-ruling 3 in particular is a silent wrong answer
today. **Decide D1 and D2 together** — they share the same shape, and `A03`'s
air-shaping trigger needs both.

---

## D3 — Feinschliff capture semantics

### What production can express

- `toolFamiliesWithSomething: ToolFamily[]` — the overview answer, **family-keyed**
  (eight families).
- `toolForms: Partial<Record<ToolFamily, ToolProductType[]>>` — absent = unknown,
  `[]` = explicit none, non-empty = reported.
- The four overview **sections** (`TOOL_OVERVIEW_SECTIONS`) are presentation-only
  and are never persisted. That part is settled and correct.

### What production cannot express

A third state on the overview: "I saw this section and deliberately said nothing
about it." Submitting the overview writes `[]` for every unchecked family.

### The three-way contradiction, quoted

- `decision.md`: "one compact Tools family overview preserving all eight
  product-category names". **Production ships four section cards.**
- `decision.md`: "Submitting the family overview makes every unchecked family
  explicitly empty."
- The on-screen German copy (`stage2.ts`, `TOOL_OVERVIEW_LEAD`): „Wähle die
  Bereiche, in denen du schon etwas hast. **Was du auslässt, bleibt offen — wir
  behaupten nichts.**"

The copy promises the opposite of what the code does and what `decision.md` says.
One of the three must change.

### Also inside D3

`defaultToolSectionsFromCare` and `defaultToolFormsFromCare` compute correct
preselections and **are called by nothing** (finding C2). And
`{...projectToolInventoryFromCareFacts(care), ...inventory}` in `computeToolRoutes`
lets an answered Tool page **replace the whole family**, silently discarding
`additionalHeatTools` evidence. `decision.md` states a precedence rule for drying
only ("`drying_method` remains the source of the dominant drying behavior") and is
silent for heat tools.

### Options

**(a) Omission means "none". Change the copy.**
Rewrite the lead to say what the code does, e.g. that unselected areas are
recorded as "nothing there".
_Easier:_ one code path; `[]` everywhere; `tools-onboarding-submitted-unchecked`
(fixture 116) passes as written; ownership is maximally resolved.
_Harder:_ it is a stronger claim than the user made. A user skimming four cards
has now "explicitly denied" seven families. This is the same over-claiming that
produced finding C1 of the direct-accept path.

**(b) Omission means "unknown". Only ticked families are resolved.**
Unchecked families stay absent; the drilldown's „Nichts davon" is the only way to
say none.
_Easier:_ the copy stays true; matches the `D04` semantics the spec is proud of
("`null` never silently treated as no").
_Harder:_ far more `unknown` ownership, so more cards read „Bestand im Feinschliff
prüfen" and fewer read „Nutze deins". Fixture 116 must be rewritten. B04 coverage
suppression fires less often, so more acquisition recommendations appear.

**(c) Section granularity: keep four, or go to eight.**
This is a separate axis and must be answered too. Four large image cards is the
reviewed and approved mockup; eight is what `decision.md` describes.

### Residual risk

Under (a), the plan states ownership facts the user never asserted, and that
state is persisted. Under (b), the Stage-1 Tool block is dominated by "check in
Feinschliff", which weakens the section's usefulness on first view.

### Recommendation

**(b) plus keep four sections, and correct `decision.md`.** The copy is the
promise the user actually read; the code and the document should move to it, not
the other way round. Then wire the preselect helpers (they exist and are tested),
which recovers most of the resolution (b) costs. Separately, **state the
care-fact vs Tool-answer precedence rule for all eight families**, not just
drying — merging per form rather than replacing per family is the likely answer,
but it is a decision.

---

## D4 — Split ownership from coverage

### What production can express

`PlanToolRoute.ownership: ToolOwnershipState` — one field, six values, carrying
both meanings today. `capabilityVerified: boolean` is a partial, ad-hoc patch on
the same problem.

### What production cannot express

Two independent facts:

1. **What the user reported** — did they tell us they have one?
2. **Whether the plan recommends acquiring anything** — is this route covered?

`B04`, quoted: "any reported physical brush or comb normally suppresses another
foundational product recommendation, even when its primary job is
styling/smoothing. **This does not grant an unverified `detangle` capability.**"
That is a coverage statement. The implementation writes `owned_generic`, which is
an ownership statement, and `presentationStateFor` turns it into „Nutze deins" —
for a form the user may have explicitly denied.

### Three more places the same conflation bites

- `towel.material = "frottee"` ⇒ `inventory.drying_textiles = []` ⇒
  `ownership = "explicit_none"`. The user said they own a terry towel. The plan
  records that they own no textile.
- `dryingRoutes ∋ ordinary_blow_dry` ⇒ `inventory.airflow = ["hair_dryer"]` ⇒
  `ownership = "owned_generic"`. The user described a behaviour. The plan records
  a device.
- `nightProtection ∋ loose_tied` ⇒ `inventory.night_protection =
["soft_night_tie"]`. The user described a technique. The plan records a product.

None of these three is stated in `decision.md`.

### Options

**(a) Two fields on `PlanToolRoute`: `reportedOwnership` and `coverage`.**
`reportedOwnership ∈ {unknown, explicit_none, owned_generic, …}` is written only
from an actual user answer. `coverage ∈ {uncovered, covered_by_report,
covered_by_selection}` is what suppresses acquisition. `B04` sets coverage only.
_Easier:_ every rule above becomes statable without lying; „Nutze deins" is gated
on `reportedOwnership`, acquisition on `coverage`; `capabilityVerified` can
probably be folded into `coverage`'s reason.
_Harder:_ a contract change rippling through `assets.ts`, `presentation.ts`,
`application.ts` and every Tool test; `ToolAsset.ownership` and
`presentationState` both need rework.

**(b) Keep one field, add a `coverageReason` enum.**
`ownership` stays, plus `coverageReason ∈ {reported_exact_form,
reported_other_form_b04, derived_from_care_answer, none}`.
_Easier:_ smaller diff; presentation can branch on the reason.
_Harder:_ the field still says "ownership" while sometimes meaning coverage. The
next reader re-invents the conflation. Does not fix the three derived-inventory
lies above, only labels them.

**(c) Stop deriving inventory from care answers entirely.**
`projectToolInventoryFromCareFacts` returns `{}`; only explicit Tool answers set
ownership. Care answers still drive _routes_.
_Easier:_ ownership becomes truthful by construction; the three lies vanish.
_Harder:_ every user who has not done the Tool trip has `unknown` everywhere, so
almost nothing reads „Nutze deins"; and it asks the user for facts the drying and
towel questions arguably already gave. Interacts directly with D3(b).

### Residual risk

Under (b), the conflation survives in a nicer wrapper. Under (c), the product
loses most of its ownership recognition — the feature's main promise.

### Recommendation

**(a), and treat the three derived-inventory rules above as part of the same
decision.** The split is the only option that makes `B04`, the terry-towel case
and the `loose_tied` case all statable. A defensible middle path is (a) plus
keeping the care derivations, but marking them `derived` rather than `reported`
so presentation can say „Du föhnst — nutze deinen Föhn" instead of asserting
ownership.

---

## D5 — Shared choice groups

### What production can express

`PlanToolRoute.alternativeRouteKey: string | null`. It is written by
`stylingRoutes` and **read by no presentation layer**. `presentation.ts` groups
by `ToolAsset`, so two routes in two families produce two assets and two cards.

### What production cannot express

"One need, several eligible approaches, fulfilment counted once." This is the
core of `tools.styling.volume_basis`, `A04`, `H07` and `B08`:

> `tools.styling.volume_basis` … one shared air/heated/heatless volume-set choice
> = `basis` … present eligible approaches neutrally, prioritize a reported viable
> route, and count fulfillment once

Today one need renders as two Basis cards (finding C4).

### Options

**(a) A first-class `ToolChoiceGroup` in the plan contract.**
`{ groupKey, tier, memberRouteKeys[], fulfilledBy: routeKey | null }`. Stage 1
renders one card per group; the group is fulfilled when any member is covered.
_Easier:_ directly models what four confirmed decisions require; the neutral
drying-textile group could use the same mechanism instead of the ad-hoc
`TOOL_NEUTRAL_GROUP_LABELS` map; fulfilment counting becomes explicit and
testable.
_Harder:_ a new top-level object in `planToolPlanSchema`; every consumer
(Stage 1, Stage 3, Routine, Anwendung) needs a group-aware path; asset
deduplication now happens inside groups.

**(b) Make `alternativeRouteKey` load-bearing.**
Presentation follows the link, renders the leading route and puts the peer in the
existing „Alternative: …" line.
_Easier:_ smallest diff; the field and the copy helper already exist.
_Harder:_ a two-member chain only; `A04`'s three-way choice (Warmluftbürste /
Air Multi-Styler / Föhn + Rundbürste) does not fit; "which one leads" becomes an
implicit ordering rather than a stated rule; asymmetric links can disagree.

**(c) Collapse the choice into one route with a wider `recommendedProductTypes`.**
One `volume_set` route listing heated and heatless forms together.
_Easier:_ one card falls out for free; no contract change.
_Harder:_ breaks `TOOL_ROUTE_TARGET_FAMILY` — one route would span
`heated_styling` and `heatless_styling`, and `toolRouteSchema` currently rejects
a product type outside the route's family. Also destroys the per-family reason
and guidance, which genuinely differ (direct heat vs tension).

### Residual risk

Under (b), `A04`'s three-way case stays unimplementable and will resurface.
Under (c), the family invariant that `contracts.ts` enforces has to be relaxed,
which weakens a boundary all three review lanes confirmed as sound.

### Recommendation

**(a).** It is the only option that satisfies `A04`, and it also subsumes the
neutral drying-textile group, so it removes a special case rather than adding
one. Specify with it: how a group renders when members have different ownership
states, and whether a group can be partially fulfilled.

---

## D6 — Lead-form authority

### What production can express

`PlanToolRoute.recommendedProductTypes: ToolProductType[]` — an ordered array.
The order **is** the lead-form decision that `B02`, `N02`, `W02` and `C02` each
specify.

### What production destroys

`assetFormsFor` in `assets.ts` re-sorts through
`TOOL_PRODUCT_TYPES_BY_FAMILY[family]`:

```
return canonical.filter((form) => source.includes(form))
```

Route order is discarded. Concretely: `B02` says a `straight` profile leads with
`detangling_brush`; the canonical family order starts with `wide_tooth_comb`, so
that is what renders. `W02` says the applicator bottle is the default; the
canonical order starts with `scalp_brush`. Both are wrong today (fixtures 57,
59b, 14, 81). `N02`'s map is not implemented at all, so fixtures 95 and 96 are
wrong for a second reason.

No spec sentence was violated, because none existed. That is the whole of R3.

### Options

**(a) Declare route order authoritative and make every projection order-stable.**
Add one sentence to `decision.md` and change `assetFormsFor` to preserve
`recommendedProductTypes` order, deduplicating in place.
_Easier:_ one small change; makes `B02`, `N02`, `W02` and `C02` all statable and
testable; the neutral-group case still works because those routes list their
forms in the order the group should read.
_Harder:_ the canonical order currently guarantees stable asset identity for the
same facts. Route order must therefore be deterministic — it already is, since
every `DraftRoute` builds its array from a pure function of the profile, but that
must become a stated invariant with a test.

**(b) Add an explicit `leadProductType` field.**
Keep the array unordered; name the lead separately.
_Easier:_ unambiguous; impossible to lose in a re-sort; `assetKeyFor` already
takes a `leadProductType`.
_Harder:_ two sources of truth to keep consistent; a rule must also decide the
order of the _remaining_ forms, which `N03` ("at most one alternative") and the
„Alternative: …" copy both depend on.

### Residual risk

Under (a), any future projection that re-sorts silently reintroduces the bug.
Mitigate with an assertion in `buildToolPlan` and rendered-output tests, not
route-level tests — the C1 defect survived a green suite precisely because it was
tested at the route layer.

### Recommendation

**(a) with a rendered-output test per lead-form rule** (fixtures 57, 59b, 14, 81,
95, 96 in `fixtures.md`). It is smaller than (b) and matches the shape the rules
are already written in. State the invariant explicitly: _the route's
`recommendedProductTypes` order is authoritative; no downstream dedup, merge or
projection may reorder it._

---

## D7 — Canonical day anchor graph

### What production can express

Three separate, unreconciled orderings:

| Layer                          | Positions                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ToolOccurrenceAnchor`         | `{wash_day, phase ∈ wash \| post_wash \| drying \| styling}`, `{after_step}`, `{before_step}`, `{nightly}`, `{styling_session}`                                            |
| `ToolPlacement` (rendered)     | `wash`, `post_wash`, `drying`, `styling`, `nightly` — **5 slots**                                                                                                          |
| `APPLICATION_SEQUENCE_ANCHORS` | `pre_wash`, `wet_cleanse`, `post_cleanse_rinse_off`, `post_rinse_towel_dry`, `timed_treatment`, `damp_leave_on`, `dry_pre_heat`, `heat_tool`, `dry_finish` — **9 anchors** |

`placementFor` collapses both `after_step` and `before_step` onto `post_wash`, so
the step-relative anchors carry no information at all once rendered.

### What production cannot express

- A position between conditioning and leave-in. The towel step therefore renders
  **after** leave-in and heat protection.
- `B12`'s texture-aware detangle timing: "curly/coily and definition-led wavy
  detangle in the conditioned wet/damp phase; straight and other wavy after
  partial drying".
- `A09`'s ordered `pre_dry` → `air_shape` pair. Both land on one
  `styling_session` anchor with no sequence field.
- `T05`'s plopping placement: "after relevant Leave-in/styling application and
  before the selected air- or diffuser-drying occurrence".

### Options

**(a) Adopt `APPLICATION_SEQUENCE_ANCHORS` as the single shared day graph.**
Tool occurrences anchor to the same nine positions the Application compiler
already uses; `ToolPlacement` is derived from it rather than defined separately.
_Easier:_ one ordering for products and Tools, so interleaving is correct by
construction; `post_rinse_towel_dry` already exists and is exactly where the towel
step belongs; `dry_pre_heat` and `heat_tool` already model the pre-dry/heat
sequence.
_Harder:_ the nine anchors were designed for products, not Tools — `B12`'s
"conditioned wet/damp phase" maps to `post_cleanse_rinse_off` and "after partial
drying" to `post_rinse_towel_dry`, which is workable but needs ratifying per
rule. `nightly` and `styling_session` have no member in the list and must be
added or kept separate.

**(b) Extend `ToolPlacement` to the ~8 positions a real wash day has, keeping it
Tool-owned.**
_Easier:_ smaller blast radius; no change to the shipped Application contract.
_Harder:_ a second ordering that must be kept in sync with the first forever.
This is how the current mismatch arose.

**(c) Keep five slots; add an explicit `sequenceWithinSlot: number`.**
_Easier:_ smallest change; fixes `A09`'s ordered pair and the towel-vs-leave-in
order **within** a slot.
_Harder:_ does not fix cross-slot problems — the towel step is in the wrong slot
relative to _product_ steps, and no intra-slot integer helps, because products
are not in `ToolPlacement` at all.

### Residual risk

Under (b) and (c), Tool steps and product steps are ordered by two different
mechanisms and the interleaving stays approximate. Under (a), the Application
contract gains a Tool consumer, which constrains its future evolution.

### Recommendation

**(a).** `T05`, `B12` and `A09` all describe positions _relative to product
steps_, so any Tool-only ordering will keep guessing. Define the graph once,
shared with the Application compiler, and derive `ToolPlacement` from it. Note
that finding 4 (Tool steps spliced before the first `finish` product) was already
a manual patch on this exact problem — a second one is a signal, not a fix.

---

## D8 — Versioning rule for persisted refinement answers

### What production can express

- `PersonalPlanRefinementAnswersV1` — the name carries a version, but there is
  no version **field** on the stored payload and no decoder registry.
- `Stage2PathState.prunedAnswerKeys` and `completedQuestionIds` — completion is
  recomputed from _today's_ question path, not from the path in force when the
  row was written.

### What production cannot express

- "This row was written under contract version N." There is no marker.
- "Validate this completed row against its completion-time contract." The
  predicate always uses today's.

### What went wrong on this branch

- A refinement answer key was renamed (`toolSections` → `toolFamiliesWithSomething`)
  with no decoder — finding C7.
- The completion predicate changed meaning for already-stored completed drafts —
  finding C6: a completed journey can become unloadable after a rollout toggle.

Both are in **WS5**, which the handoff correctly says is unblocked and can start
now. D8 is the _rule_ that prevents the next occurrence.

### Options

**(a) Add `answersVersion: number` to the persisted payload plus a decoder
chain.**
Every read runs the payload through decoders from its stored version to current.
Completed rows validate against the contract recorded at completion time.
_Easier:_ the standard, well-understood shape; makes renames safe; makes the
rollout toggle safe by construction.
_Harder:_ a schema change to a live table; every existing row needs a backfilled
version (defaulting to 1 is safe if the current shape _is_ 1, which needs
checking); one more thing to remember on every future answer change.

**(b) Never rename or re-mean a persisted key; only add.**
Deprecated keys are read forever; completion semantics are additive only.
_Easier:_ no schema change; enforceable by a lint rule or a schema-snapshot test.
_Harder:_ accumulates dead keys; does not solve C6, because completion semantics
changed without any key changing — a new _required_ question re-opened old rows.

**(c) Snapshot the completion contract onto the row.**
Store `completedQuestionIds` and the required set at completion time; loading
validates against the snapshot.
_Easier:_ directly fixes C6, the more dangerous of the two.
_Harder:_ does not fix C7 (key renames) on its own.

### Residual risk

Under (b) alone, C6 recurs the next time a question becomes required. Under (c)
alone, C7 recurs the next time a key is renamed. They are different failures and
(b) and (c) each cover only one.

### Recommendation

**(a), which subsumes (b) and (c)**, stated as a standing rule in `decision.md`:
_any change to a persisted refinement answer key, or to the meaning of the
completion predicate, requires a path-version bump plus a decoder; completed rows
validate against their completion-time contract._ Add a schema-snapshot test that
fails when a persisted key is added, renamed or removed without a version bump —
a rule with no enforcement is how both findings happened.

---

## Candidates for a ninth decision

### D9a — Which field is `uses_heat_protection`? (not optional)

`H15` is `confirmed`, and fixtures 40, 50, 51, 122 and 123 all turn on
`uses_heat_protection`, a boolean. **The Personal Plan does not consume that
field.** It lives in `src/lib/types.ts` as a legacy onboarding profile column;
no `src/lib/personal-plan/**` module reads it.

What production has instead:
`heatEvents["heat:<source>"].protectionConsistency ∈ {always, sometimes, no,
unsure}` — **per heat event**, required for `airflow_shaping` and
`direct_contact_heat` sources, forbidden for `ordinary_airflow`.

Three sub-questions: which of the four states counts as coverage (is `sometimes`
covered?); is coverage per heat event or portfolio-wide; and is the legacy boolean
imported at all. Fixtures 122 and 123 are additionally **moot** — production never
defaults `protectionConsistency`, so "trust the stored `false`" and "treat the
DB-default `false` as unknown" describe a situation that cannot arise. They
should be retired or rewritten.

Note the precedent: `heat-protectant.ts` is the shipped category that owns heat
protection, and it reads `assessments.heatExposure` only — it reads no profile
field at all. Whatever D9a rules should be consistent with it.

### D9b — The missing `fingers` answer

`B01`, `B03`, `B04` and fixtures 10, 11, 56 and 64 turn on a **`fingers`**
answer. `fingers` was a value of the legacy `BRUSH_TYPES` enum; it is **not** a
`ToolProductType`. `toolForms.brushes_combs = []` means „Nichts davon", which is
a different claim: "I use only my fingers" and "I have no brush" are not the same
user. `boar_bristle`, named in fixture 60, likewise has no production form.

Options: add `fingers` as an explicit non-product option on the brush page;
redefine `[]` to mean "fingers only" and change the copy; or delete the finger
exception from `B01`/`B03`/`B04` and rely on the `very_short` length rule alone
(which is what ships today, and which passes fixtures 10 and 11 but not 56).

### D9c — `manageability_styling`

A shipped goal token with **no spec token and no Tool rule**. The legacy
projection treats it as `less_frizz`, and `N01`'s trigger list contains
`less_frizz` — so a user who chose "Haare sollen leichter zu bändigen sein" is
arguably inside the Night-Protection trigger set and is silently excluded today.
Cheap to decide; currently decided by omission.

### Also to retire or correct in `decision.md`, no decision needed

- `hair.surface`, `hair.elasticity` and `chemicalTreatments` are listed as inputs
  that may change Tool decisions. No rule reads them and `ToolProfileFacts` does
  not carry them. Delete the claim or add the fields.
- `decision.md` describes an eight-checkbox overview; production ships four
  section cards (see D3).
- `H12` names four heatless form groups; production ships five (`foam_roller` is
  the extra one).
- `evidence.md` describes the Carvalho 2023 comparator as "terry (looped bath
  towel)"; the paper says only "cotton towel". Already tracked in **WS7**.
