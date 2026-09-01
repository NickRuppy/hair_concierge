# Stage 3 bootstrap contract and honest recovery

## Outcome and source context

Fix the production Stage-2 products-module handoff so every successful Stage-3 entry response has one canonical, runtime-validated bootstrap shape. A valid journey must enter product capture; stale, transient, and internal contract failures must each offer only a recovery that can actually work.

Source evidence:

- Historical 28 August incident: the heat/refinement readiness defect was fixed by PR #485 and remains unchanged here.
- 1 September production replay: `POST /api/personal-plan/stage-3/optional-entry` returned `200` and persisted a valid draft, but its response omitted `authorityEvaluations`; the client then threw while building the bootstrap.
- Independent Claude diagnosis found the historical and current failures causally distinct.
- Explorer research favored a shared typed transport composer, runtime envelope parsing, recovery-led copy, privacy-safe diagnostics, route-to-client contract coverage, and authenticated production replay.

Planning contract:

- **Outcome:** products-first refinement reliably reaches Stage 3; recognized failures show the concise reviewed recovery state and execute its promised action.
- **Constraints:** preserve the PR #485 heat clarification behavior, persisted drafts, authority snapshots, accepted Routine, owner scoping, public 4xx/409 contracts, and field-test safety boundaries.
- **Non-goals:** no recommendation-policy change, no product-category expansion, no migration, no Routine redirect repair, no general redesign of every Personal Plan error state, no deep schema project for every existing authority/comparison element, and no automatic retry of a stateful POST.
- **Done when:** exact-head checks pass, the reviewed mobile states match production behavior, and—after separate deployment and production-test authorization—fresh authenticated heat-unresolved and no-heat journeys reach Stage 3 without a contract diagnostic. Until that production replay passes, the incident is not marked resolved.

## Chosen direction

1. Keep `Stage3DraftResponse` as the internal persistence/service shape.
2. Add a separate `Stage3BootstrapResponse` transport contract with required `authorityEvaluations` and `fitComparisons` arrays; `catalogThumbnails` remains optional.
3. Use one server-side bootstrap composer from both the normal GET and optional-entry POST routes. It owns review-bundle/evaluation projection and always emits both arrays, using `[]` only when they are not applicable.
4. Parse successful bootstrap HTTP envelopes at the network boundary: validate the existing draft and requirements schemas, required top-level arrays, and request/response identity. Do not add new deep schemas for every authority-evaluation or comparison element without evidence of nested corruption. A malformed `2xx` becomes a typed `Stage3BootstrapContractError`; the client never silently supplies missing authority data.
5. If the optional POST transport is malformed, record a privacy-safe diagnostic and perform exactly one forced normal GET for the same current plan/refined version. Never repeat the POST automatically. A valid GET continues into Stage 3; a second contract failure shows the terminal internal-recovery state. The shared composer is the incident fix; this GET fallback only protects route-specific transport/version skew.
6. Map failures by useful recovery:
   - stale checkpoint/authority -> load the current server state;
   - network/`503`/retryable availability -> user-initiated retry or return to Routine;
   - persistent invalid bootstrap -> no retry, return to Routine.
7. Show “Wir haben das Problem registriert” only when the bounded diagnostic was accepted by the client observability queue; otherwise use the same screen without that claim.

## Scope and non-goals

In scope:

- successful Stage-3 GET and optional POST transport parity;
- client runtime parsing and typed contract-failure classification;
- one bounded GET recovery after an invalid optional POST response;
- concise German recovery states in the current Stage-2→3 bridge and equivalent Stage-3 re-entry handling;
- privacy-safe operational diagnostics;
- deterministic, browser, production-persistence, and authenticated production verification.

Out of scope:

- changing when heat protection is recommended or skipped;
- changing Mask, Leave-in, Oil, or any other category authority;
- modifying existing Routine contents when Stage 3 cannot open;
- changing checkout, billing, entitlement, attribution, or analytics consent;
- solving the separate accepted-Routine undirected navigation issue;
- deployment, field-test activation, or any production write without its separate gate.

## Target map

- `src/lib/personal-plan/products/gateway.ts`
  - define the bootstrap-specific transport/client-port types without claiming that raw persistence results already include evaluations.
- `src/lib/personal-plan/products/bootstrap-response.ts` (new)
  - own the envelope runtime schema/parser, safe violation enum, and `Stage3BootstrapContractError`; reuse existing draft/requirement schemas and require both arrays without introducing parallel deep authority schemas.
- `src/lib/personal-plan/products/stage3-bootstrap-response-server.ts` (new, server-only)
  - compose the canonical response from the loaded draft plus review/evaluation capabilities; retain `stage3FitComparisonForTransport` projection.
- `src/app/api/personal-plan/stage-3/route.ts`
  - replace route-local response enrichment with the shared composer.
- `src/app/api/personal-plan/stage-3/optional-entry/route.ts`
  - compose the optional-entry result instead of returning the raw persistence shape.
- `src/lib/personal-plan/products/http-gateway.ts`
  - parse both bootstrap endpoints with the bootstrap schema; leave unrelated endpoint parsing/error contracts unchanged.
- `src/lib/personal-plan/products/stage2-entry-adapter.ts`
  - accept the required bootstrap transport type; retain plan/version/snapshot identity checks and remove impossible optional casts.
- `src/components/personal-plan-start/plan-start-flow.tsx`
  - perform the one forced baseline GET fallback after an optional-entry transport failure and preserve a typed recovery outcome for the UI; the fallback must bypass `optional_inventory` mode so it cannot re-POST.
- `src/components/personal-plan-refinement/refinement-flow.tsx`
  - retain the classified handoff failure rather than collapsing every exception into `handoffStatus: "error"`; render the reviewed recovery state.
- `src/lib/observability/personal-plan-stage3.ts` (new)
  - capture one synthetic allowlisted contract diagnostic through the existing deferred client queue, grouped by its stable safe error message, with no plan, refined, draft, product, answer, query, or payload data. Do not expand the shared queue with tags/fingerprint plumbing in this fix.
- Tests:
  - `tests/personal-plan-stage3-optional-entry-route.test.ts`
  - `tests/personal-plan-api-stage3.test.ts`
  - `tests/personal-plan-stage3-gateway.test.ts`
  - `tests/personal-plan-start-resume.test.tsx`
  - `tests/personal-plan/persistence/stage2-module-completion.test.ts`
  - `tests/personal-plan-stage2-stage3-adapter.test.ts`
  - `tests/personal-plan-journey-access-loader.test.ts`
  - `tests/personal-plan-start.spec.ts`
  - focused observability/UI tests added beside the owning modules.

## Designed user journey

Evidence review: **confirmed**. Nick reviewed the current-layout mobile mockup, asked for less text, fewer sections, fewer colors, and fewer type scales, then approved the simplified result.

User-journey sign-off: **confirmed on 2026-09-01 after the plain-language walkthrough**.

Actor and entry condition:

- A person has an accepted Routine, opens the products refinement module, answers it, and reaches the saved Stage-2→3 handoff.

Happy path:

1. The Feinschliff is saved once.
2. The client calls the optional-entry POST once.
3. The server opens/reuses the Stage-3 draft and returns the canonical bootstrap contract. `fitComparisons` is required for route parity, although its absence was not the production trigger; `authorityEvaluations` was.
4. The client validates plan/refined identity, requirements, snapshot, evaluations, and comparisons.
5. Stage 3 opens on the correct first product-capture state. Owned unresolved heat protection appears as “Hitzeschutz noch offen”; no-heat journeys enter normally.
6. The previously accepted Routine remains unchanged until Stage 3 is completed through its existing contract.

Recovery variants:

- **Current checkpoint changed:** show “Dein Feinschliff wurde aktualisiert.” and “Deine Antworten sind gespeichert.” “Aktuellen Stand laden” reloads the current server frontier; “Zur Routine” opens the valid existing Routine.
- **Temporary transport/service failure:** show “Die Produktauswahl ist gerade nicht verfügbar.” and “Deine Antworten sind gespeichert.” “Erneut versuchen” performs a user-initiated retry; “Zur Routine” exits safely. No automatic POST retry occurs.
- **Malformed optional transport response:** capture a safe diagnostic, then perform exactly one forced normal Stage-3 GET. This protects route-specific serialization/version skew, not a deterministic shared-composer defect. If it validates, continue without showing an error. If it does not, show “Die Produktauswahl kann gerade nicht geöffnet werden.” The body confirms saved answers and mentions registration only when capture was queued. The only action is “Zur Routine.”
- **Ordinary Stage-3 re-entry without an existing Routine:** use the same classifications, but keep the existing safe Profile/Support destination rather than claiming that a Routine exists.

Completion state:

- Success means the user sees the correct Stage-3 product screen, not merely a `200` or a persisted draft.
- Failure means the user retains their saved Feinschliff and existing Routine and receives no action that deterministically repeats the same failure.

## Planning evidence

- Reviewed rendered comparison: [mockups/2026-09-01-stage3-preparation-recovery.html](./mockups/2026-09-01-stage3-preparation-recovery.html)
- Rendered screenshot: `plans/mockups/2026-09-01-stage3-preparation-recovery.png`
- Question answered: how to distinguish stale, temporary, and internal failures while keeping the screen concise and every action truthful.
- Selected direction: one plum accent, one headline scale, one body scale, no internal annotations, minimal saved-work assurance, and recovery-specific actions.
- Feedback incorporated: removed the eyebrow, warning box, explanatory footnotes, coral/green accents, secondary button chrome, and repeated explanatory copy.
- Artifact disposition: HTML and screenshot **commit**; transient Claude report **discard** after reconciliation.

## Ordered tasks

### 1. Establish the canonical bootstrap transport

Consumes:

- raw `Stage3DraftResponse` from persistence;
- existing review/evaluation gateway capabilities;
- existing `stage3FitComparisonForTransport` projection.

Produces:

- `Stage3BootstrapResponse` with required `authorityEvaluations` and `fitComparisons`;
- one shared async server composer used by both successful Stage-3 entry routes;
- one client parser that rejects malformed successful responses with a safe violation enum.

Implementation checks:

- keep raw persistence and transport types separate;
- require arrays in both static and runtime envelope contracts; reuse the current typed authority/comparison consumers rather than adding deep parallel schemas;
- preserve optional `catalogThumbnails`;
- preserve GET review-bundle/evaluation semantics rather than fabricating non-empty evaluations in product capture;
- preserve existing 4xx/409/error-body handling.

Completion criterion:

- removing either required array from either route fails a type, route-contract, or parser test before UI code runs.

### 2. Add bounded recovery and privacy-safe diagnostics

Consumes:

- typed bootstrap parser result;
- source enum `normal_get | optional_entry`;
- existing Stage-3 error codes and server-frontier reload behavior.

Produces:

- recovery classification `checkpoint_changed | transient | contract_violation`;
- exactly one forced normal GET fallback after optional-entry transport-envelope corruption;
- no automatic POST replay;
- one synthetic diagnostic grouped by a stable safe error message through the existing bounded queue.

Allowed diagnostic data:

- endpoint source and violation enum encoded only from fixed allowlists in the synthetic error message; HTTP status class and contract version when already available without extending shared Sentry plumbing; deployment/release remains Sentry-supplied.

Forbidden diagnostic data:

- user, plan, refined version, draft, product, category, search, answer, URL query, request/response body, or caught Zod/database error.

Completion criterion:

- negative tests prove one capture at most, no raw payload/ID leakage, no POST retry, one GET fallback, and terminal recovery after a second malformed response.

### 3. Render the approved concise recovery states

Consumes:

- classified recovery outcome and diagnostic-queued boolean;
- current bridge/header layout;
- valid exit destination derived from the journey context.

Produces:

- the three approved mobile states with the exact copy/action hierarchy in the mockup;
- `role="alert"`/live-region behavior that announces the changed state once without repeated assertive announcements;
- a real Routine exit only when a valid accepted Routine exists; otherwise the existing Profile/Support fallback.

Completion criterion:

- component tests assert exact copy, action availability, action destination, no retry in the contract state, and accessible announcement behavior; mobile browser evidence matches the approved mockup.

### 4. Close the original and current regression seams

Consumes:

- the canonical transport, recovery behavior, and existing PR #485 heat rules.

Produces:

- a route→HTTP parser→`buildStage3Bootstrap` contract test using the actual optional-entry `200` JSON;
- GET/POST semantic parity coverage;
- real optional POST browser coverage;
- historical heat/readiness guard coverage.

Required scenarios:

1. owned heat protection + habits incomplete -> unresolved heat, Stage 3 opens;
2. no heat protection + habits incomplete -> Stage 3 opens;
3. known qualifying heat use -> required role has non-empty routes and still fails closed without them;
4. existing Routine + new products-module completion -> current refined/draft linkage, Stage 3 available, old Routine unchanged;
5. transport-corrupted optional `200` + valid GET -> silent recovery into Stage 3; inject the corruption after the shared composer so the scenario is honest;
6. malformed optional `200` + malformed GET -> terminal contract state, Routine exit only;
7. network/`503` -> manual retry state; no automatic POST replay;
8. stale checkpoint -> current-state action, not transport retry.

Completion criterion:

- the exact seam that failed in production is red without the fix and green with it; focused server/UI tests, exact POST browser journey, and exact-head CI pass.

## Verification

Automated:

- focused Node/TSX tests for bootstrap schema/composer, both routes, gateway parsing, adapter identity checks, recovery classification, observability, bridge UI, heat projection, and journey access;
- `npm run typecheck`;
- scoped ESLint/diff check;
- affected Personal Plan CI lanes, including server-shim and browser contracts—not `ci:verify` alone;
- exact-head Claude code review through `request-code-review` inside the implementation loop.

Manual/browser:

- 375 px mobile evidence for all three recovery states;
- happy-path products-module handoff asserts the browser sends one optional POST and lands on the first Stage-3 product screen;
- accessibility check for visible focus, action labels, saved-work copy, and one announced error/status change;
- failure trace/screenshot retained only when a browser check fails.

Live-state/release gate:

- no migration;
- deployment remains a separate authorization;
- after deployment and separate field-test activation approval, create two fresh authenticated field-test sessions: heat-owned/habits-incomplete and no-heat control;
- record deployment SHA, request method/status, visible Stage-3 state, and privacy-safe refined/draft authority linkage only;
- do not retry a failed production scenario until its evidence is diagnosed;
- confirm zero `stage3_bootstrap_contract_violation` events for both journeys;
- revoke and inspect the exact field-test campaign after the run;
- only then mark the incident resolved.

## Review and handoff

- Worktree: `.worktrees/stage3-bootstrap-recovery`
- Branch: `codex/stage3-bootstrap-recovery`, based on current `origin/main`.
- Planning evidence review: **confirmed**.
- User-journey sign-off: **confirmed on 2026-09-01 after the plain-language walkthrough**.
- Claude plan review: **completed with revisions**, reconciled below.
- Implementation gate: use `implementation-loop`; it owns test-first execution, `ready-check`, and `request-code-review`.
- Publication gate: no commit/push/PR until explicit `ship-it` authorization.
- Merge, deployment, field-test activation, production replay, and cleanup remain separate gates.
- Residual risk: envelope validation does not newly validate every nested authority/comparison element. Existing typed consumers remain unchanged; deep runtime schemas are a separate follow-up only if nested-corruption evidence appears.
- Artifact disposition: plan, HTML, the reviewed planning screenshot, and the three rendered recovery-state screenshots **commit at the ship gate**; transient research/review output **discard** after reconciliation.

## Implementation receipt

- Test-first evidence: the first focused runs failed on the missing bootstrap parser/composer, missing POST evaluation array, absent bounded fallback, absent terminal recovery, and the later review-edge classifications; each named seam passed after its owning change.
- Canonical transport: both successful entry routes now use one server-only composer and the HTTP client validates the envelope, identity, snapshot, requirements, and required top-level arrays before Stage 3 consumes it.
- Recovery: malformed optional POST -> one safe diagnostic -> exactly one normal GET; no automatic POST replay. Stale refined or authority state reloads the current frontier; a persistent invalid contract has no retry.
- UI evidence: the rendered checkpoint, transient, and contract states match the reviewed concise mobile hierarchy. A simulated Lea pass found no blocker; the duplicate green saved indicator was removed.
- Counterpart code review: Claude Opus 4.8, high effort, read-only, found no blocking correctness, security, or privacy defect. Its supported consistency findings were fixed and regression-tested; the transient report remains outside the repository.
- Final verification on `ddc553f6`: 2,564/2,564 Personal Plan tests, typecheck, diff check, production build, 7/7 built-app Stage-3 checks, and 37/37 journey checks passed. ESLint has five unrelated pre-existing warnings and no task-file errors.
- Release boundary: authenticated production heat-unresolved and no-heat replay remains pending separate deployment and field-test authorization. The incident remains open until that replay passes without a contract diagnostic.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | tradeoff | No existing Zod schemas cover the deep authority/comparison unions; the incident was a missing top-level array. | accepted | Limit runtime parsing to the envelope plus existing draft/requirement schemas and identity checks. | Negative envelope tests; no deep-schema fixture churn. |
| C2 | tradeoff | The deferred Sentry queue carries only error/mechanism; adding tags and fingerprint changes the global path. | accepted | Use one stable synthetic safe error through the existing queue; show registration copy only when queued. | Observability test asserts one event and no forbidden data. |
| C3 | defect | A GET fallback cannot rescue deterministic corruption emitted by the same shared composer. | accepted | State that the composer fixes the incident; force baseline GET fallback only for post-composer transport/version skew and inject that seam in tests. | Verify one GET and zero repeated POSTs. |
| C4 | clarification | Missing `fitComparisons` did not trigger production; it is required for transport parity. | accepted | Record parity rationale without making it part of the root-cause claim. | GET/POST envelope parity test. |
| C5 | defect claim | Reviewer reported PR #486 open and requested merge-order alignment. | rejected | GitHub reports PR #486 merged at `4029faf0`; that commit is an ancestor of this branch and the plan was refreshed to current `origin/main`. | `gh pr view 486`; `git merge-base --is-ancestor 4029faf0 HEAD`. |
| C6 | consistency | Runtime parsing preempted the existing mid-flow identity guard with a different error type. | accepted | Normalize only plan/version identity contract errors back to the existing stale-source recovery during canonical mid-flow reloads. | Focused Stage-3 flow regression plus full suite. |
| C7 | robustness | A future handoff caller without an exit handler could lose visible error feedback. | accepted | Render the recovery panel for every classified handoff failure; hide only unavailable actions. | Component regression without an exit action. |
| C8 | consistency | Stale authority state belonged to the signed checkpoint recovery but direct re-entry classified only stale refined state. | accepted | Classify both stale codes as current-frontier recovery; the bridge action performs a true reload. | Direct and bridge classification regressions. |
| C9 | artifact | Reviewed PNG evidence is ignored by the repository pattern. | accepted | Force-add only the four task-owned PNGs at the later ship gate. | Artifact manifest before publication. |
