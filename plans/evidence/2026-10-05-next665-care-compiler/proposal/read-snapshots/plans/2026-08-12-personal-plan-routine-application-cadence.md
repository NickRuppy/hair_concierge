# Personal Plan: confirmed Routine cadence in Anwendung

## 1. Outcome and source context

Implement the already approved **option 2** architecture for Personal Plan cadence:

- Stage 4 resolves the effective cadence from the category recommendation, the selected exact product's verified protocol when the category delegates cadence to that protocol, and any confirmed user override.
- The resolved cadence is frozen inside the immutable accepted Routine.
- Stage 5 Anwendung only projects and displays that frozen value; it does not query product cadence or create a second recommendation authority.

Visual authority: [`plans/mockups/2026-08-08-personal-plan-stage5-complete-application-flow.html`](../plans/mockups/2026-08-08-personal-plan-stage5-complete-application-flow.html). Nick already approved its cadence placement: on each overview card and again beside the opened day title. This plan activates those existing slots without redesigning the page.

Current source facts:

- `RoutineItem.cadence` already freezes `recommended`, `userOverride`, and `displayKey` in `src/lib/personal-plan/routine/contracts.ts`.
- `product_application_protocols.cadence` already stores reviewed exact-product cadence; no database schema change is needed.
- Stage 4 currently renders category cadence locally and falls back to `Nach Herstellerangabe` for product-directed categories.
- Stage 5 already supports `cadenceByDay`, but `/anwendung` never supplies it.

## 2. Chosen direction

### One cadence authority

Add one optional, versioned resolved value to the existing Routine item cadence:

```ts
type ResolvedRoutineCadence = {
  copyDe: string
  source:
    | "category"
    | "exact_product_protocol"
    | "category_fallback"
    | "safe_generic_fallback"
  gapCode?: "exact_product_cadence_unavailable"
}
```

`RoutineItem.cadence` becomes:

```ts
{
  recommended: PlanCategoryDecision["frequency"]
  userOverride: ProductFrequency | null
  displayKey: string
  resolved?: ResolvedRoutineCadence
}
```

The optional member keeps existing immutable Routine payloads readable. The compiler version advances to `personal-plan-routine-compiler.v2`; the outer Routine payload remains schema version 1 because this is a backward-compatible additive field.

The effective display precedence is:

1. confirmed `userOverride`;
2. frozen `resolved.copyDe`;
3. the existing deterministic legacy formatter for an older Routine without `resolved`.

### Resolution rules

The category recommendation remains the default authority.

| Category cadence kind | Resolution |
|---|---|
| `product_protocol_course` | Use the selected exact product's verified cadence copy. This makes Bondbuilder courses precise. |
| `role_keyed_product_protocol` | Use the selected exact product's verified role cadence. When the product's otherwise complete Scalp Care protocol intentionally uses the approved category fallback, freeze `Bei Bedarf` with source `category_fallback`. |
| Every other cadence kind | Keep the current category-owned cadence. Manufacturer suitability or a more frequent label schedule must not increase Mask, Deep Cleansing, Shampoo, Conditioner, Leave-in, Oil, Dry Shampoo, or Heat cadence. |

Only canonical protocol cadence objects with a supported `kind`, non-empty `copy_de`, and matching product/category/role may enter Routine compilation. The V1 accepted vocabulary is deliberately narrower than the catalog's descriptive vocabulary:

- Bondbuilder delegated cadence: `label_course`, `label_schedule`, `frequency`, `weekly_range`, `wash_event`;
- Scalp Care delegated cadence: `daily`, `daily_or_twice_daily_as_needed`, `weekly_range`, `as_needed`, `label_schedule`.

Suitability/timing-only kinds such as `label_suitability`, `label_daily_suitable`, and `label_timing` never become a repeat schedule. Legacy Scalp Care `type` objects are normalized only for `daily`, `weekly_range`, and `as_needed` through an explicit tested adapter with fixed German copy; arbitrary JSON and free text never become cadence authority.

The resolved cadence object is already part of the Routine item and therefore participates in the existing semantic/source hash without a redundant inner hash or version. A later selected-product change produces a successor Routine proposal rather than mutating an accepted Routine. Protocol-data changes alone do not silently rewrite an accepted Routine; they take effect during the next explicit Routine compilation/reconciliation event.

### Stage 5 projection

The accepted-Routine adapter carries the effective frozen cadence into its normalized items. A pure day-cadence projector selects the defining confirmed Routine role for each day:

| Day | Defining role / label |
|---|---|
| `wash_day` | `cleanse` |
| `intensive_care_day` | `intensive_care` |
| `bond_repair_day` | `bond_repair` |
| `clarifying_wash_day` | `reset_cleanse` |
| `refresh_day` | `refresh`, otherwise the day trigger `Bei Bedarf` |
| `between_wash_care_day` | event trigger `Bei Bedarf`; do not invent a weekly quota from Leave-in or Oil |
| `styling_day` | `heat_protection` / event cadence, displayed as `Beim Stylen` |
| `rest_day` | static state `Immer möglich` |

The projector reads only the accepted Routine projection and canonical day semantics. It never reads catalog protocols or recomputes product/category recommendations.

## 3. Scope and non-goals

### In scope

- typed parsing and normalization of reviewed product cadence facts;
- deterministic category-versus-product cadence resolution during Routine compilation;
- additive Routine contract and compiler-version update;
- one shared effective-cadence formatter for Stage 4 and Stage 5;
- Stage 4 precise product-directed cadence instead of generic `Nach Herstellerangabe`;
- Stage 4 → Stage 5 cadence handoff and deterministic day-level projection;
- overview-card and opened-day cadence rendering through the existing UI slots;
- backward-compatible rendering for accepted v1 Routines without `resolved`;
- cadence re-resolution in the acquisition/source-reconciliation successor path;
- regression, integration, and responsive browser verification.

### Non-goals

- no weekday calendar, date scheduling, reminders, tracker cadence, or logging changes;
- no cadence editing inside Anwendung;
- no new category recommendation rules or frequency research;
- no parsing of German manufacturer prose into numeric schedules;
- no change to exact application steps or day composition;
- no destructive rewrite of already accepted Routine versions;
- no product-protocol data batch, database migration, feature-flag change, deployment, or production write;
- no automatic successor proposal solely to enrich an old accepted Routine. Older Routines keep the safe existing formatter until another confirmed initial/successor Routine is created.

## 4. Target map

| Surface | Expected files |
|---|---|
| Cadence contracts and resolver | `src/lib/personal-plan/routine/contracts.ts`, new `src/lib/personal-plan/routine/cadence.ts` |
| Exact-product cadence read adapter | new `src/lib/personal-plan/routine/cadence-authority.ts`, `src/app/api/personal-plan/stage-3/complete/route.ts` |
| Routine compilation and editing | `src/lib/personal-plan/routine-candidate-compiler.ts`, `src/lib/personal-plan/routine/editor.ts`, semantic hash/diff tests as affected |
| Routine compiler port/composition | `src/lib/personal-plan/routine-proposal-stager.ts`, `src/app/api/personal-plan/stage-3/complete/route.ts` |
| Successor reconciliation | `src/lib/personal-plan/routine/source-reconciler.ts`, `src/lib/personal-plan/routine/source-sync-service.ts`, `src/lib/personal-plan/routine/acquisition.ts`, `src/app/api/personal-plan/routine/sync/route.ts` |
| Stage 4 presentation | `src/components/routine/personal-plan/routine-item-card.tsx`, `src/components/routine/personal-plan/routine-editor.tsx` only if label reuse requires it |
| Stage 4 → 5 bridge | `src/lib/personal-plan/routine/application-adapter.ts`, `src/lib/routines/personal-plan/application/contracts.ts` |
| Stage 5 day projection | new `src/lib/routines/personal-plan/application/cadence-projector.ts`, `src/app/anwendung/page.tsx` |
| Existing Stage 5 view slots | `src/components/application/application-view-adapter.ts` (wiring only; visual structure stays unchanged) |
| Verification | focused `tests/personal-plan-*cadence*.test.ts` plus existing Stage 4 compiler/UI, Stage 5 adapter/view/route, and Playwright journey suites |

## 5. Designed user journey

**Actor and entry condition:** a paid Personal Plan user has completed exact-product selection and accepted a Stage 4 Routine.

1. The accepted Routine shows a concise German cadence for each included product role.
2. A category-owned cadence remains the plan's value, for example `Etwa alle 2 Wochen` for a Mask even if its product page says it is suitable more often.
3. A product-directed role shows the exact verified course, for example `Alle ein bis drei Haarwäschen anwenden` for a Bondbuilder, rather than `Nach Herstellerangabe`.
4. A confirmed user override remains the visible value and wins over both category and product cadence.
5. On `/anwendung`, each day-type overview card shows its resolved rhythm or trigger.
6. Opening the card repeats the identical wording beside the day title and shows the existing ordered application instructions below it.
7. `Bei Bedarf` day types remain event-driven; no weekday or fabricated weekly number appears.
8. An older accepted Routine without the new resolved field remains usable and renders the current deterministic fallback instead of failing.
9. If an exact protocol cadence changes later, the accepted Routine does not change in place. A later Routine compilation creates the successor state that must follow the existing confirmation flow.

**Recovery states:**

- Malformed, mismatched, or unsupported protocol cadence is ignored as authority and cannot leak raw JSON/copy to the user.
- A product-directed role without an approved exact/fallback cadence preserves the safe legacy label `Nach Herstellerangabe` and records a typed cadence-data gap. It never blocks the whole plan or invents a schedule.
- Stage 5 remains available for legacy Routine payloads through the existing formatter fallback.

**Completion:** Routine and Anwendung display the same accepted cadence wording, while application steps and day composition remain unchanged.

User-journey sign-off: **confirmed by Nick on 2026-08-12 after the reconciled walkthrough**.

## 6. Planning evidence

- Reviewed artifact: [`plans/mockups/2026-08-08-personal-plan-stage5-complete-application-flow.html`](../plans/mockups/2026-08-08-personal-plan-stage5-complete-application-flow.html).
- Question answered: where cadence belongs in Anwendung without turning the experience into a calendar.
- Selected direction: a concise cadence/trigger on the overview card and the identical value in the opened day header.
- Incorporated feedback: day-type library rather than calendar-first scheduling; precise instructions remain inside each opened day; Routine owns the cadence and Anwendung is display-only.
- Evidence-review status: **confirmed by Nick**.
- Artifact disposition: **commit**; the pre-existing mockup remains the visual authority and needs no modification for this task.

## 7. Ordered tasks

### Task 1 — Define and test the frozen cadence authority

Create the canonical exact-product cadence parser, explicit supported-kind vocabulary, category delegation policy, effective-cadence formatter, and backward-compatible Routine schema member. Add the optional member to both the strict Zod object and the compiler's TypeScript Routine item type.

Consumes:

- `PlanCategoryDecision.frequency`;
- `product_application_protocols.cadence` plus product/category/role identity;
- existing `ProductFrequency` user override.

Produces:

- `ResolvedRoutineCadence` plus the one typed `exact_product_cadence_unavailable` gap;
- a pure `resolveRoutineCadence(...)` function;
- a pure `effectiveRoutineCadenceCopyDe(...)` function used by both stages.

Tests must cover every existing category cadence kind, every accepted delegated protocol kind, rejected suitability/timing kinds, legacy `daily | weekly_range | as_needed` normalization, exact Bondbuilder course, exact Scalp Care schedule, approved Scalp Care fallback, malformed/mismatched protocol rejection, graceful generic fallback, manufacturer schedule ignored for category-owned Mask/Deep Cleansing, and override precedence.

Completion: the resolver is exhaustive, deterministic, and test-first; no component owns its own cadence switch table.

### Task 2 — Freeze exact cadence during every new Routine compilation

Add a service-role, read-only cadence-authority adapter that batch-loads only the selected product IDs and relevant roles. The async composition root fetches these facts first and passes them through `RoutineCandidateCompilerInput`; the pure compiler continues to perform no database access. Update the compiler port/factory explicitly, include normalized facts in the compiler input and the resulting resolved cadence in the semantic preimage, advance the compiler version, and store the resolved value on each item.

Consumes:

- Task 1 parser/resolver;
- selected owned/planned exact product IDs from the server-owned Stage 3 portfolio;
- reviewed protocol rows from `product_application_protocols`.

Produces:

- compiler v2 Routine items with optional `cadence.resolved` populated;
- a source fingerprint that changes when a relevant exact cadence fact changes;
- a typed cadence-data gap plus the safe generic label when a delegated role has no valid cadence authority.

Keep the existing single staging RPC and immutable versioning path. Routine edits preserve `resolved`; cadence override edits alter only `userOverride` and therefore effective presentation. Product changes must enter through existing successor compilation/reconciliation rather than a component-side rewrite.

Tests extend `tests/personal-plan-routine-candidate-compiler.test.ts` and the Stage 3 complete route/gateway contracts. Prove one batched read before the pure compile, matching-role selection, deterministic hashes, old-payload parsing, graceful degradation, and no extra write/RPC.

Completion: a newly accepted Routine contains the exact stable cadence it will display when verified data exists, without a schema migration, client-provided authority, or whole-plan failure for one cadence-data gap.

### Task 3 — Re-resolve cadence for successor Routine proposals

Keep `reconcileRoutineUserProductSource` pure. After a batch of source changes has produced the full successor candidate, `source-sync-service` batch-loads cadence authorities for the candidate's selected product IDs, runs the same pure Routine cadence resolver from Task 1 across the candidate, and only then computes the final semantic hash/delta and stages the existing confirmation proposal.

Consumes:

- the post-reconciliation successor payload;
- the Task 1 resolver;
- the same read-only authority port used by initial compilation.

Produces:

- successor items whose resolved cadence matches their new exact product;
- unchanged accepted active Routine until the user accepts the existing proposal;
- deterministic no-change behavior when cadence remains semantically identical.

Tests extend source reconciler/service/acquisition/API coverage for planned-to-owned replacement, exact-cadence change, unavailable cadence graceful fallback, hash/delta stability, and confirmation-before-activation.

Completion: initial and successor Routine paths obey the same frozen-cadence invariant; neither component-side reads nor silent active-Routine mutation exist.

### Task 4 — Make Stage 4 use the shared effective cadence

Replace `routine-item-card.tsx`'s local cadence decision tree with the Task 1 formatter. Keep current visible copy for category-owned kinds and user overrides; product-directed roles become precise when `resolved` exists. The editor uses the same frequency vocabulary and must not overwrite the frozen resolved fact.

Consumes: accepted Routine item from Task 2 or Task 3.

Produces: one Stage 4 cadence string shared with downstream application projection.

Tests extend Stage 4 UI and interaction coverage for exact course, category-owned Mask, override, and legacy fallback.

Completion: no generic `Nach Herstellerangabe` is shown when a new accepted delegated cadence exists, and existing Routine cards do not regress.

### Task 5 — Carry accepted cadence into Stage 5 and project day labels

Add the effective cadence string to `NormalizedRoutineItem`, populate it in `adaptAcceptedActiveRoutineForApplication`, and implement the explicit defining-role/day-trigger table from Section 2. Pass the resulting `cadenceByDay` into the existing view adapter.

Consumes:

- accepted Routine payload only;
- canonical day definitions and compiled day membership already used by Stage 5.

Produces:

- `Partial<Record<ApplicationDayTypeKey, string>>`;
- matching `cadenceDe` on overview and detail views.

Tests cover all eight day types, same-copy overview/detail rendering, multiple supporting products without cadence collision, exact Bondbuilder/Scalp cadence, `Bei Bedarf` bridge days, `Beim Stylen`, `Immer möglich`, and legacy Routine fallback.

Completion: `/anwendung` supplies the existing cadence slots without reading `product_application_protocols` as a cadence authority.

### Task 6 — Verify the integrated journey and retain only durable artifacts

Run focused tests first, then Personal Plan suites, type/lint/build, and responsive browser verification at mobile and desktop widths. Exercise one new Routine with category-owned and exact-product cadences plus one legacy Routine fixture.

Consumes: Tasks 1–5 and the signed-off mockup.

Produces: a review-ready branch plus updated test evidence in the implementation handoff.

Completion: the journey in Section 5 passes, no calendar/editing UI appears, and every task-owned artifact is classified:

- plan: **commit**;
- existing mockup: **commit unchanged**;
- implementation/tests: **commit**;
- screenshots/review transcripts: **discard unless intentionally promoted to durable evidence**.

## 8. Verification

### Automated

- focused cadence resolver/authority tests;
- `tests/personal-plan-routine-candidate-compiler.test.ts`;
- Stage 3 completion route/gateway tests affected by the injected authority reader;
- Stage 4 schema, compiler, editor, persistence, UI, and interaction tests;
- Stage 5 application adapter, compiler, view adapter, route, and page tests;
- the relevant Personal Plan Playwright journey;
- `npm run test:personal-plan`;
- `npm run typecheck`;
- `npm run lint`;
- feature-flag-off production build and repository-ready checks required by `implementation-loop`.

### Manual/browser

- At mobile and desktop widths, compare overview and detail cadence placement against the approved mockup.
- Verify identical copy between Routine, Anwendung overview, and opened day.
- Verify Mask/Deep Cleansing category cadence is not raised by product label wording.
- Verify Bondbuilder/Scalp Care shows exact copy where the category delegates.
- Verify old Routine payload loads without error and shows the safe legacy label.
- Verify no weekday, calendar, reminder, or Anwendung cadence editor is introduced.

### Migration/live state

- No migration is expected.
- Before implementation handoff, run a read-only shape audit of active `product_application_protocols.cadence` values used by delegated categories. Unsupported shapes must be reported as launch data gaps, not normalized speculatively.
- No production write or feature activation is authorized by this plan.

## 9. Review and handoff

- Worktree: `.worktrees/personal-plan-routine-application-cadence`
- Branch: `codex/personal-plan-routine-application-cadence`
- Planning counterpart review: **completed and reconciled on 2026-08-12**. The review's supported findings were incorporated: cadence gaps now degrade safely instead of blocking the plan; the successor reconciliation path is in scope; the exact supported protocol-kind vocabulary and async composition seam are explicit; redundant inner version/hash fields were removed. No second counterpart pass is required.
- Evidence review: confirmed.
- Designed-user-journey sign-off: **confirmed on 2026-08-12**.
- Implementation is authorized against this reviewed plan.
- Implementation must use `implementation-loop`, including its `ready-check` and one whole-branch `request-code-review` before any publication handoff.
- Publication, merge, deployment, protocol data changes, and production activation remain separate explicit gates.

## 10. Implementation receipt — 2026-08-12

Status: **review-ready, uncommitted**.

- Initial and successor Routine compilation freeze the same deterministic effective cadence; a failed authority read fails closed before an immutable value is written.
- Stage 4 uses the shared effective-cadence formatter. Stage 5 carries only accepted Routine cadence and projects it onto compiler-confirmed days.
- Legacy accepted Routines retain their previous fallback wording, and enrichment during a later product acquisition is not presented as a change to otherwise untouched Routine items.
- Focused integration verification: 94/94 passed after review fixes.
- Full Personal Plan verification: 1,181/1,181 passed after review fixes.
- Typecheck passed; ESLint passed with no task errors; feature-flag-off production build passed.
- Isolated rendered browser verification passed for Stage 4 (1/1) and Stage 5 (2/2) at desktop and 390px mobile. Routine, Anwendung overview, and opened day showed identical cadence copy.
- Read-only production audit: all four active recommended Bondbuilders have supported non-empty cadence copy. Scalp Care has five schedule-bearing supported rows; three null rows and one timing-only row intentionally remain safe generic fallbacks.
- Whole-tree Claude review: no blocking findings. Its two supported behavioral findings—legacy fallback copy drift and noisy v1 successor deltas—were fixed and covered by focused regression tests. Maintainability nits were also reconciled.
- No migration, catalog write, feature activation, commit, push, PR, deploy, or production mutation was performed.

### PR review hardening — 2026-08-12

- Rebased conflict-free onto `b86ac2a8` after the adjacent frequency and product-selection work merged; the 24-path implementation fingerprint remained `085005475f2e95eefba4cad7f269bceb9dc8f444f86ec7992e051437323a5868` before review hardening.
- Final PR review exposed two supported gaps. The editor proposal path now re-resolves cadence after exact-product or role changes before hashing, diffing, and staging. Stage 5 now projects dynamic cadence only from accepted owned, executable items; planned guidance keeps the approved event-driven fallback.
- TDD red proof: the focused Stage 4/5 regression command failed 2/9 with the old exact-product cadence and planned-item cadence visible. After the fix it passed 9/9.
- The required final counterpart review found one additional supported transitional issue: exact cadence enrichment on untouched legacy items could appear as consequential editor changes. The editor now uses the same legacy-delta alignment as source sync, and the focused legacy fixture proves one unchanged item remains unchanged.
- Final verification after alignment: the focused regression suite passed 10/10; Personal Plan passed 1,188/1,188; typecheck passed; ESLint passed with zero errors and four pre-existing warnings; feature-flag-off production build passed. The final review delta was inspected with no blocking finding remaining.
- No migration, catalog write, feature activation, deployment, or production mutation was added by the hardening.
