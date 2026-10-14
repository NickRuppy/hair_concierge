# Routine presentation: six ready consolidations from 75 complete callbacks

The inherited decision is to remove least-useful tests while preserving the campaign's global coverage constraint. This bounded proposal removes six repeated declarations by transferring their complete assertion unions into already-existing executions. It adds no input, owner call, render, table row or declaration. Production source is unchanged. Main owns review, execution, controls and final coverage; no runner or source mutation was executed in this investigation.

## Scope and receipt

Full test bodies, fixtures and local harnesses read: stage4-ui27, stage4-route-ui8, stage4-interaction-ui14, stage4-attention-ui1, portfolio-presentation10, routine-page-ui15 =75 current AST declarations. The full ledger classifies66R/6C/2F/1 conditionalD. The D is explicitly excluded from the staged six; F repairs are also unstaged. No earlier campaign removals receive credit.

- Ledger: `/tmp/test-audit-routine-presentation75-ledger.md`; exact titles/lines/body hashes: `-sites.json`; per-site decisions: `-judgments.json`.
- Whole donors and before/after keeper bodies: `-candidates.json`.
- Prospective diffs: `-transfer.diff`, `-cut.diff`.
- Main-only guarded editor: `-edit.cjs`; manifest `-manifest.json`; pinned before/transfer/cut bytes under `-snapshots/`.
- Fourteen actual-owner fault recipes: `-controls.json` (unexecuted).
- Manifest SHA256: `7e439850608d3d281fca335f20b27ec5826f2315e164ff1cbddc14fe004c8cb8`.

Static check parsed every prospective source/test snapshot with TypeScript's parser, checked all original callback hashes, preserved all untargeted callbacks, and found75→75→69 declarations. Three test files change; six files are guarded;20 actual owner files are hash-pinned. This is syntax/navigation validation, not typecheck or runtime proof. The build helper only writes /tmp; main should operate the pinned editor rather than regenerate evidence from a changed checkout.

## Exact union and operative-input evidence

### C1 — recovery forward CTA into the existing retry keeper

Donor `tests/personal-plan-stage4-route-ui.test.tsx:198`, “Routine unavailable recovery also offers a forward CTA out of the dead end”. Keeper same file:177, “Routine unavailable recovery offers an explicit reload action”. Both call `renderToStaticMarkup(RoutineUnavailableState({retryAction:createElement(RetryRefreshButtonView,{label:"Erneut laden",onRetry:()=>undefined})}))` with identical effective input. Transfer exact `<a href="/plan-start">Zum Plan</a>` regex. Donor retry-text regex already exists exactly in keeper. Existing keeper also invokes retry callback and checks actual router.refresh source binding. No extra render/callback is introduced.

Live route entry `src/app/routine/page.tsx` returns `RoutineUnavailableState` when resolver returns unavailable; the named component's forward destination is /plan-start. Read its complete route and retry-button implementation. Mutation: change actual recovery href to /routine, expect transferred exact-link assertion to fail. This is SSR+manual callback proof, not actual mounted navigation.

### C2 — strict portfolio query into existing authenticated GET

Donor `tests/personal-plan-portfolio-presentation.test.ts:57`, “loads a strict owner, plan, and portfolio-scoped v3 snapshot for downstream presentation”. Keeper same file:304, “profile presentation API authenticates, owner-scopes its active portfolio, and returns JSON-safe arrays”. Both supply the exact `v3Snapshot()` object and user-1/plan-1/portfolio-1. In the keeper, actual GET calls actual plan reader→actual active-version reader→actual portfolio reader. The fixture supplies storage rows, not a prepared presentation response.

Transfer schemaVersion===3 and exact ordered receipt `[["id",ids.portfolio],["user_id",ids.user],["personal_plan_id",ids.plan]]`. Observe only calls made while the real client `from(table)` selected personal_plan_portfolio_versions; this avoids confusing owner filters from the two preceding readers. Existing callback observations remain intact. Donor retainedOwnedProducts[0].displayName===Altes Shampoo is strictly contained by keeper's exact mapped array `["Altes Shampoo"]`. Existing200/no-store/decision-keys/auth receipt assertions stay unchanged. No direct helper invocation added.

Actual owner `src/lib/personal-plan/routine/portfolio-presentation.ts:38–89` selects id/snapshot, applies three equality filters, validates row/snapshot identity, runs strict v1–v4 parser and projects JSON. Current consumers are `/routine`, profile GET and client refresh; public GET export remains wired to real auth/admin dependencies. This test uses its current dependency factory, not the production auth/admin provider. Proposed scope controls corrupt each actual filter value independently; fixture still returns valid storage so intended failure must be the new observed receipt. A separate schema-delivery fault preserves successful JSON but changes version to2. Controls do not claim DB/RLS execution.

### C3+C4 — initial no-banner duplicate SSR

Donors `stage4-ui:1149` dismissed/null and `:1159` all-done/omitted. Existing keeper `:1180`, “Task 2.6: the plan-updated toast is absent without the signal”, already renders `withoutFlag` with exact same `activeViewFor(payload([item()]))` and no other props. The RoutinePage parameter default at:89 maps omitted refinementBanner to null, so both donors have the same operative values. Transfer negative products title, habits title, dismiss aria text, and /von 4/ to `withoutFlag`. Duplicate no-dismiss assertion appears once. Keeper's explicit-false-toast and missing-dismiss-handler renders remain unchanged; no new calls.

Important limit: neither donor executes an actual dismissal/completion and both omit banner callbacks. All three banner gates (model, dismiss callback, refine callback) are false. They never independently proved the null-model guard with valid callbacks. The consolidation preserves their real rendered absence contract, not the lifecycle implied by titles. Fault recipes inject each forbidden visible fragment at the actual no-banner branch; they do not claim that removing only the model guard is detected.

### C5+C6 — individual toast/banner display into existing coexistence SSR

Donors `stage4-ui:1168` positive toast and `:1129` habits3/4 banner. Keeper `:1200`, “Task 2.6: the plan-updated toast and the refinement banner can render on the same visit”, already uses the exact same active default payload and callback/no-op values, with both features enabled. `RoutinePage` constructs independent sibling slots: toast reads showPlanUpdatedToast/onDismissPlanUpdatedToast; banner reads model and its two callbacks. Toast component receives only onDismiss. Banner receives identical habits/3/4 values. Neither subtree reads whether the other exists. The common layout always places these slots before Basis.

C5 union: Plan aktualisiert positive already exists; transfer role=status and toast-index<Basis-index. C6 union: exact habits title already exists; transfer `>3 von 4<`, `Weiter · 3 Min.`, and habits-index<Basis-index. Preserve original toast-before-banner positive. Added assert.ok diagnostics are explicit. No extra render or re-invocation is needed.

Faults change actual toast role, move both slots after Basis while preserving the old toast-before-banner assertion, move only banner after Basis, change actual progress interpolation, and change habits CTA duration. These target the transferred assertions rather than an unrelated exception. Static parsing passed, but reachability/intended red still requires main execution. Toast auto-dismiss and cleanup effects are not exercised by SSR and no coverage is claimed for them.

## Separate dormant seam — not staged or credited

`routinePresentationLabels(...).plannedLabelFor` has only test callers; real RoutineItemCard calls only fitLabelFor. Source/path/symbol searches across current src/scripts/other non-test code found no method use, namespace alias or current dynamic accessor. `plannedPurchaseDecisionKeys` is separately a live API field and must remain. The method is not a public package SDK export.

History is consequential: commit0bec2b93 (#439), “selected products are instantly full routine members”, intentionally removed all provisional/acquisition presentation. Its message and `plans/2026-08-16-selected-is-ready/plan.md:86` explicitly retained acquire plumbing, plannedLabelFor **and their tests** as a future reconnect point. That is evidence of current unreachability, but retirement would supersede a documented prior scope decision. It is disclosed as conditionalD1 rather than silently bundled with six equivalence cuts. No new Nick approval gate is inferred; main can settle it under the campaign's established cleanup scope.

If adopted separately: delete only the plannedLabelFor object method; delete the complete pending-source Noch-kaufen-only declaration at portfolio-presentation:154; remove only obsolete plannedLabelFor assertions at:85,:99,:185. Keep live fitLabelFor v3/null assertions, v4 retained inventory, and no-owned-source JSON decision-key assertion. The pending donor's only terminal oracle concerns the dormant label; categoryResolutions is structurally parsed but never consulted by the presentation label. It is not an independent owner-acquisition or unknown-to-ready business-state regression. Preserve strict parser and all other current category cases. No acquire API, storage schema, plannedPurchaseDecisionKeys or label fit behavior is included in this proposal.

## Two zero-credit F findings, both unstaged

F1 `stage4-interaction-ui:557` says it blocks duplicate requests but only renders a submitting button and checks disabled/progress text. Removing client request guard while preserving submitted props can pass. Narrow the title to the actual busy-button contract; a mounted duplicate-submission regression needs separate authorization/execution if desired, not deletion credit.

F2 `routine-page-ui:258` claims BOTH server branches receive the flag, but the final unscoped flag regex can match the legacy or keepsake branch when the ordinary PersonalPlanRoutineClient prop is absent. The actual owner has several PersonalPlanRoutineClient callsites. A narrow repair should observe the ordinary final returned JSX callsite plus the legacy callsite, preserving the same server flag expression, with an old-green/new-red actual omission control. No speculative blanket source-guard removal is proposed.

## Retained boundaries, evidence and read limits

- Full bodies of all75 selected callbacks and fixture/harness code were read. Selected tests are native node:test; package.json test:node includes both *.test.ts and *.test.tsx, CI quality-node calls it at .github/workflows/ci.yml:158. No browser/CI cadence is exchanged by these transfers.
- Full Stage4 RoutinePage, PersonalPlanRoutineClient, section/card/status/editor/proposal/detail/refinement/toast/attention owners; full portfolio reader/API; full route; complete cadence and legacy model/frequency-control owners were read. Repository plan/version readers and strict portfolio schema/parse functions were read in scope. GemerktSection was read completely; legacy page and chat owners were read at their tested caller/handler/prop regions, not as a full unrelated chat audit. Shared React/Next/Button/BottomSheet runtime internals and every unrelated parser contract were not audited.
- Existing manual hook dispatcher skips effects. Neither its callbacks nor SSR prove mounted React lifecycle, timers, media, actual browser navigation or provider calls. These interaction/data boundaries remain retained; no proposed transfer crosses into a mock-manufactured outcome.
- Retain current planned-null vs chosen-product, source catalog fact overrides, Oil capability, v3/v4 retained products, per-reason deferral, zero-product, current override cadence, auth401/no-client, strict malformed schema, owner/plan identity, proposal source, access frontier, request recovery and commerce actions. The per-declaration ledger explains the concrete escaping regression and why the nearest other fixture does not establish it.
- History checked:0bec2b93 product decision;3e5018eb Oil capability;f61a7c64 scanner/Gemerkt public launch;4029faf0 modular Feinschliff completion. These are supporting local history, not substitutes for current caller reads. No deployed settings/provider state was queried.

## Main execution recipe and stop conditions

From exact worktree root:

```
node /tmp/test-audit-routine-presentation75-edit.cjs --check
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage4-ui.test.tsx tests/personal-plan-stage4-route-ui.test.tsx tests/personal-plan-stage4-interaction-ui.test.tsx tests/personal-plan-stage4-attention-ui.test.tsx tests/personal-plan-portfolio-presentation.test.ts tests/routine-page-ui.test.tsx
```

After baseline/main review and released writer window, main may run `edit.cjs transfer`, same native command, then14 individually selected real-owner fault controls with source restoration before every next runner. Intended result is assertion mismatch, not import/parse/type/harness failure. Each recipe names exact selected keeper and expected assertion. Baseline/restore green and source byte hashes remain required. Only after proof should main run `edit.cjs cut` and same native command expecting69 declarations. The editor stages/parses ALL prospective files in memory, validates snapshots/callback hashes, rechecks every cohort/source hash before first write, snapshots current bytes to a fresh /tmp receipt and writes only the three changed test files. Source guard drift is a stop, not permission to repin a transient mutant.

The source recipes are proposals only. No actual baseline, fault-red, restored-green, type/lint or global coverage result is claimed here. Main's complete campaign proof remains separate.
