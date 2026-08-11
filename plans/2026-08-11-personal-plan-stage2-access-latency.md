# Personal Plan Stage 2 authorization latency

Status: backend access slice and approved between-question continuity locally implemented and verified; Nick explicitly requested the delays and all refinement save interstitials be removed on 2026-08-11; counterpart review revisions incorporated.

## Outcome and source context

Reduce the server-side authorization cost paid by every Stage 2 load/save/completion, and remove the full-screen wait that made this cost block the whole refinement experience. Preserve entitlement freshness, owner scoping, source validation, compare-and-swap behavior, and durable final completion.

Production evidence from deployment `dpl_Ag9AJS7fNT7JjgyxduFPNYwTUzaD` showed total answer requests of 2.76-4.13 seconds. The `journey` phase alone took 1.48-3.02 seconds, while the actual operation took 0.58-0.96 seconds. Repository inspection confirms the full journey loader reads current refined need and Stage 3 product draft even though Stage 2 routes only ask whether `allowed.stage2` is true.

## Chosen direction

Add a server-only, fail-closed Stage 2 access loader that shares the current rollout, entitlement, cohort, prepared-artifact, owner-plan, and current-initial-source rules but stops before Stage 3 authority and Stage 5 work. Use it only in the Stage 2 load/save and standalone completion routes. Preserve per-request entitlement enforcement; do not introduce a browser capability, signed seed, authorization cache window, or concurrent saves.

The loader returns a minimal server fact, not a full journey snapshot:

```ts
type PersonalPlanStage2Access = { allowed: boolean }
```

## Scope and non-goals

In scope:

- extract and reuse one shared authorization prefix for the current app-rollout, entitlement/cohort, attached-artifact, owner-plan, and initial-pointer checks so Stage 2 and later stages cannot drift;
- stop Stage 2 authorization before refined-need/product-draft/Stage 5 reads;
- use the minimal result in both Stage 2 route handlers;
- keep failures unavailable rather than converting them into access denial;
- add comparable `Server-Timing` coverage to standalone completion;
- measure before/after query invocation count and production phase timing.

Non-goals:

- changing Stage 2 question order or product/heat copy beyond the separately reviewed UX plan;
- parallel saves, an offline queue, or allowing a second submit before the current CAS write settles;
- changing entitlement revocation freshness;
- consolidating authorization and persistence into a new SQL RPC;
- changing Stage 3/4/5 navigation or authority;
- migrations, deployment, activation, or production writes.

## Target map

- `src/lib/personal-plan/journey-access-loader.ts`: minimal Stage 2 access type, dependency seam, fail-closed loader, and production Supabase binding.
- `src/app/api/personal-plan/stage-2/route.ts`: replace the full-journey dependency with the minimal Stage 2 access dependency while preserving response codes and timing phases.
- `src/app/api/personal-plan/stage-2/complete/route.ts`: use the same dependency and emit comparable phase timing.
- `tests/personal-plan-journey-access-loader.test.ts`: extend the existing suite to prove exact allow/deny/unavailable behavior, preserve the app-rollout internal-user gate, and exclude refined/draft/Stage-5 reads.
- `tests/personal-plan-api-stage2.test.ts`: extend the existing suite to prove routes do not call the gateway before authorization and retain 401/409/503/422 contracts.

## Designed integration journey

The backend access slice has no surface change. The approved continuity slice changes only how an ordinary save wait is presented:

1. An authenticated user sends a Stage 2 request.
2. The server checks the current rollout and active owner entitlement on that request.
3. It verifies the qualified cohort, attached prepared artifact, owner plan, and non-null current initial need pointer.
4. It does not load current refined need, product draft, Stage 3 authority, or Stage 5 eligibility.
5. If allowed, the existing Stage 2 gateway performs the same owner/source/CAS persistence operation.
6. Missing access returns the existing `stage_not_ready`; unavailable/malformed authorization reads remain fail-closed as `temporarily_unavailable`.
7. The question advances locally as soon as its answer passes the same canonical validation; save state remains compact and inline while the request is pending.
8. Back and duplicate submit stay locked during that write. On failure, the submitted question and selected answer are restored with retry; on conflict, canonical server progress is reloaded.
9. The final answer still waits for durable save+completion before Stage 3 authority is opened.
10. The response exposes phase timing so production p50/p95 can be compared to the current baseline.

Completion: visible Stage 2 behavior is byte-for-byte equivalent at the contract level, with fewer irrelevant authorization reads and a shorter `journey` critical path.

## Planning evidence

The backend change required no mockup. The continuity behavior was explicitly approved through Nick's repeated instruction to remove every between-question saving screen and match the new quiz flow. The rejected heat/context redesign remains outside this slice.

## Ordered tasks

1. Extract the shared authorization prefix and add the minimal fail-closed Stage 2 access loader.
   - Consumes: existing journey-loader dependencies and exact Stage 2 readiness rules.
   - Produces: `PersonalPlanStage2Access` with owner plan and current initial pointer only on success.
   - Extend the existing red-capable suite for missing user, rollout denial, inactive/revoked/pending entitlement, old cohort, unattached/missing artifact, missing plan/current initial pointer, dependency error, and the allowed case.
   - Invocation assertions prove allowed Stage 2 access never calls `loadCurrentRefinedNeed`, `loadCurrentProductDraft`, Stage 3 flags/authority, Stage 4 flags, or Stage 5 rollout/internal checks beyond the mandatory app-rollout internal-user gate.
   - Completion criterion: all current Stage 2 authorization invariants remain, and Stage 3/5 dependencies are unreachable on the allowed path.

2. Bind both Stage 2 routes to the narrow loader and align timing.
   - Consumes: `PersonalPlanStage2Access` from task 1.
   - Produces: unchanged HTTP authorization/error contracts plus `auth`, `journey`, and `operation` timing on successful normal and standalone-completion requests.
   - Red route tests prove the full journey shape is no longer required and the gateway remains uncalled on denied/unavailable access.
   - Completion criterion: GET/PATCH/POST use the narrow dependency, existing validation/CAS tests pass, and completion timing is comparable.

3. Verify performance truthfully.
   - Consumes: final local tree and phase headers.
   - Produces: a before/after receipt with dependency invocation counts and, only after publication authorization, production p50/p95 for total/auth/journey/operation.
   - Completion criterion: local tests prove fewer calls; returning/edit-flow users with an existing refined version are the measurement cohort; no sub-second production claim is made without live measurements.

## Verification

Automated:

- focused journey-loader and Stage 2 API tests with red/green proof;
- the existing Personal Plan Stage 2 gateway/session/question-path suite;
- scoped lint and TypeScript checks;
- repository Personal Plan ready-check gate before review-ready handoff.

Manual/integration:

- local allowed, denied, and dependency-failure fixtures;
- confirm normal save and final completion preserve revisions and response bodies;
- confirm no browser-visible markup/copy changes.

Live-state:

- read-only production timing comparison only after publication/deployment is separately authorized;
- no data mutation, migration, deployment, or feature-flag action in this plan.

## Review and handoff

- Worktree: `.worktrees/personal-plan-debug-polish` on `codex/personal-plan-debug-polish`.
- This backend integration journey is approved by Nick's explicit request to resolve the diagnosed delays while retaining current access rules.
- One read-only Claude plan review is required before implementation.
- Claude approved the direction with revisions on 2026-08-11. Incorporated: a shared-prefix extraction, bare `{ allowed }` result, explicit app-rollout internal-gate coverage, extension of existing tests, and returning-user measurement scope.
- Rollback is revert-only: restore the two Stage 2 route dependency bindings to the unchanged full journey loader. No schema, flag, or data rollback is involved.
- After implementation, `implementation-loop` owns `ready-check` and `request-code-review` on the complete tree.
- Stop before commit, push, PR, deployment, or production timing claims without separate authorization.
- Artifact disposition: plan `commit`; transient counterpart output `discard`; read-only timing/query evidence summarized in receipts then `discard`.

## Local implementation receipt — 2026-08-11

- Both Stage 2 route families now use a shared, fail-closed `{ allowed }` loader that preserves app rollout/internal, current entitlement, cohort, attached artifact, owner plan, current initial pointer, and Stage 2 flag checks.
- The Stage 2 path does not invoke refined-need, product-draft, Stage 3/4 flags, or Stage 5 rollout/internal work. Returning/edit-flow requests therefore skip two irrelevant database reads plus later-stage computation.
- Standalone completion now exposes comparable `auth`, `journey`, and `operation` `Server-Timing` phases.
- Fresh proof: loader/API focused tests, 1,019/1,019 Personal Plan tests, 15/15 Stage 3 browser scenarios, scoped ESLint, Prettier, TypeScript, and `git diff --check`.
- `SavingTransitionShell` and the `saving` page mode are removed. Ordinary answers advance immediately with inline `saving`/`saved` status; failed saves restore the submitted question and answer; conflict recovery reloads canonical progress; final completion remains durable-before-handoff.
- Fresh browser proof: 9/9 Stage 2 scenarios, including ordinary save, failure, and conflict, show no full-screen saving interstitial.
- No claim is made that production is now instant: the code is not deployed, and Stage 3 still has its own generic journey-access cost under separate investigation. Production p50/p95 comparison requires a separately authorized deployment.
