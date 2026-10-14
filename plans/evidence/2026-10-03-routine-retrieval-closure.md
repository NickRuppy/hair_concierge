# Routine retrieval helper closure — 2026-10-03

## Corrected verdict

**D1 callback; zero C/F.** The earlier deferral was stale. Both
`buildRoutineRetrievalSubqueries` and `getRoutineAutofillSlots` have no resolved
non-test caller, re-export, dynamic literal edge, operator command, or current
document-backed capability. Their only references are the planner test imports
and calls listed below. They were introduced for the pre-June retrieval flow;
history `dccff6f7` / `8980fe4f` explicitly retired legacy RAG runtime.

## Exact cut set

- **D test declaration:** `tests/routine-planner.spec.ts:1024`, `retrieval hints
  keep exact topic names and autofill only add or upgrade slots`.
  Its `buildRoutinePlan(...)` value is consumed solely by the two dead helpers;
  its three assertions all inspect `subqueries`/`autofillSlots`, never `plan`.
  Remove this whole callback.
- **D source:** `src/lib/routines/planner.ts:2540-2567`
  `buildRoutineRetrievalSubqueries`; and `:2569-2575`
  `getRoutineAutofillSlots`. Source LOC/function cleanup has no test quota.
- **Retained mixed callback:** `tests/routine-planner.spec.ts:907`, `comparison
  requests set compare mode and still personalize to one variant`. Keep its
  plan construction and the three plan assertions (`compare_cwc_owc`, OWC
  included, CWC absent). Remove only the dead `subqueries` declaration and its
  two CWC/OWC assertions; this is no declaration credit.
- **Retained mixed callback:** `tests/routine-planner.spec.ts:55`, `hair length
  helper maps length zones and care intensity conservatively`. Keep the six
  `getLengthCareIntensity` and six `suppressLengthOnlyCare` assertions. Remove
  the six `hasLengthEndsZone` assertions and its test import; delete
  `src/lib/recommendation-engine/hair-length.ts:11-13`. No declaration credit.

## Closure and controls

Literal/census search over `src`, `apps`, `scripts`, `packages`,
`supabase/functions`, and `tests` finds exactly:

- subqueries import `routine-planner.spec.ts:5`, calls `:916`, `:1034`;
- autofill import `:8`, call `:1038`;
- length-zone import `:13`, calls `:56-61`.

No source caller exists. `package.json:69` retains the routine Playwright
contract lane, but these callbacks are pure data tests and use no browser page;
its presence proves no retrieval consumer. Historical April planning documents
refer to former query decomposition only. The dated evidence file deferring the
cut was execution scheduling, not a supported current contract.

Main verification under existing campaign authorization: run the focused routine
Playwright spec and inspect that the remaining callback count drops by one;
use a source fault that restores either deleted planner helper and confirms no
current code imports it is not sufficient behavioral proof, so use static
closure plus retained planner output assertions. No runner or source edit was
performed in this review.

Limits: this is a checked-in static closure; computed external loaders or an
untracked SDK consumer would be a hold. No such checked-in registry/operator
entry was found.

## Main execution contract

Routine bounded removal of one dead-helper-only callback and three uncalled helpers. Existing explicit audit/obsolete-source authorization applies; no supported behavior, product, payment, persistence or operator decision changes. The historical deferred status was scheduling, not retention authority. Main preserves all three comparison-plan and12 live length-helper assertions, all other87 callback bodies. Stage/parse all three outputs, exact snapshots, pure Playwright88 before→87after with no page fixture/browser launch, diffcheck/format/CI/fullnativecoverage on finalintegratedtree. Zero replacement declarations. Publication remains outside scope. Current source universe and original coverage denominator retained; no sourceLOCcredit.

## Applied checkpoint

Main applied the exact guarded cut set. See [312 focused receipt](2026-10-03-final312-focused-receipt.md) for actual non-skipped before/after proof, corrected full native cohort, AST count and remaining whole-suite gates. Historical proposal/pending statements above describe pre-cut state.
