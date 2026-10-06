# Stage 3 layer judgment — read-only handback

Reviewed worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, with the parent's existing uncommitted campaign edits. No repository edits, tests, providers, migrations, or mutations were run. Only this `/tmp` report was written. Existing removal of the local-label test is excluded from every recommendation/count here.

## Decision

Do **not** retire any of the three assigned files or the state-machine layer wholesale. There is a small, defensible cutover of five repeated declarations, four requiring assertion transfers first. The large reducer suite is mostly an independently valuable producer boundary: it constructs authority proposals, captures/roles, and descendant pruning. Most flow tests either preconstruct those outputs or use the Labs gateway with inventory authority disabled. They cannot replace that evidence.

Ready list: **1 D + 4 C = five declaration removals after transfers**. This is not a quota proposal. Rough deleted blocks total 270 lines before additions (exact future net diff remains unmeasured). No production LOC or runtime seam deletion is unlocked. Two separate F findings should be repaired, without deletion credit.

## Ready candidates

### C1 — obsolete no-owned confirmation replay

- **Delete after transfer:** `tests/personal-plan-stage3-flow.test.tsx:3361–3443`, `global no-owned-category review suppresses duplicate confirmation while staying on server state`.
- **Actually detects:** on an empty-ownership bootstrap, no correction callback happens and no capture screen appears. It does **not** prove duplicate-confirmation suppression: `review` is absent, and both `review?.props.onContinue()` calls at 3437–3438 are no-ops.
- **Keeper:** immediately preceding `global inventory review keeps server-authored no-owned gaps local without client mutation` at 3290–3359. This builds the same Heat requirement, empty `ownedCategories`, and draft via the real `createStage3Draft`, then positively asserts that ProductKindReviewScreen and ProductCaptureScreen are absent and no mutation is emitted.
- **Transfer first:** supply `onProductKindsCorrection` with a counter in that keeper and assert zero calls after a second settled render. Retain its existing no-review/no-capture/no-mutation assertions. No duplicate clicks or new declaration required.
- **Runtime proof:** state-machine.ts:379–437 creates the known-empty draft in `product_decisions`; flow.tsx:145–149 maps it to decisions, :371 initializes reviewed-product-kinds true, :1033 requires `phase === "product_kinds" && !reviewedProductKinds` to render the review. A user correction can only be reached from the capture action at :1202. The absent-screen counter scenario is shared with the keeper.
- **Non-test callers:** `src/components/personal-plan-start/plan-start-flow.tsx:1251` supplies the actual correction handler to Stage3ProductsFlow; Labs callers also render the same flow.
- **History:** test title/counter/optional clicks come from `8a99abd1d` (#363, progression/product clarity and duplicate-save recovery). Subsequent direct capture/decision entry left the optional clicks inert. History explains intent; current body does not exercise it.
- **Unlocked cleanup:** only the duplicate test and local passthrough mutate wrapper. No runtime guard removal.
- **Risk:** low after transfer. Preserve real duplicate-finalization tests (flow:2651, 4255, 4339); they actually hold a request pending and invoke callbacks twice.

### D1 — removed entry-mode distinction leaves exact handoff replay

- **Delete:** `tests/personal-plan-stage3-flow.test.tsx:5236–5300`, `an explicit products module completion lands on the Routine directly`.
- **Actually detects:** two Oil role choices complete to one Routine callback, emit routine-opened analytics, show `Deine Routine wird geöffnet.`, and do not navigate twice on another render.
- **Stronger keeper:** `multiple individual reviews progress to one direct Routine handoff` at 5173–5234. Same two Oil roles, same fixture authority gateway, same props, same capture/assign/two keep-owned actions, same callback/analytics assertions and extra `personal_plan_stage3_review_completed` assertion. Only identity strings and old explanatory comments differ.
- **Transfer:** none. There is no explicit-module flag/prop in either invocation or in the current Stage3ProductsFlow prop contract (flow source:284–314). The inputs do not exercise different branches.
- **Runtime owner/callers:** flow source `openRoutine` :1854–1880 validates the typed handoff and guards navigation; `completeFlow` :3312 onward records completion. Production host plan-start-flow.tsx:1251 supplies `onOpenRoutine`; Labs also invoke the same flow. No module-specific handoff branch survives.
- **History:** second scenario introduced for the 26 August field test in `97c7f731a` (#471). `822a547c7` (#481, unify paid post-payment journey) unified the handoff and updated both names; the second test's own comment now says every post-payment entry uses the same direct handoff.
- **Unlocked cleanup:** duplicate declaration/setup only; no runtime seam.
- **Risk:** low. Keep bare-completed resume (2769), committed-receipt recovery (2844), timeout and zero-decision completion scenarios; they reach different producers and lifecycle branches.

### C2 — same initial grouped-Oil render invoked twice

- **Delete after transfer:** `tests/personal-plan-stage3-flow.test.tsx:5767–5783`, `the anchor's own screen carries no follow-up overrides`.
- **Actually detects:** the first grouped Oil anchor does not receive headingOverride, scopeContextLine, or primaryActionLabelOverride.
- **Keeper:** `three oil use cases render as one grouped screen with pre-checked cases` at 5662–5691. Same gateway, same three-use entry builder, same `reachOilReview`, same anchor lookup; it already asserts group members, checked count, proposition, step count and null role label.
- **Transfer first:** append all three exact undefined assertions to that existing anchor object. No additional render, fixture row, or test declaration.
- **Owner/callers:** flow source:1376–1419 derives follow-up copy only with committed keys and an uncommitted next subject. The production host and Labs call the flow. OilGroupReview composes the anchor but does not calculate these overrides.
- **History:** both tests introduced by `938cc8fb1` (#436, grouped Öl review), which added follow-up overrides with default-off behavior. They are two observations of one initial state, not distinct scenarios.
- **Unlocked cleanup:** duplicate full capture/setup invocation only.
- **Risk:** low. Keep the separate Back-on-committed-member scenario at 6347, pending-only follow-up at 6310, and deselection transition at 5720: their committed-key state is different.

### C3 — duplicate Stage3Shell header snapshot

- **Delete after transfer:** `tests/personal-plan-stage3-components.test.tsx:92–109`, `stage 3 shell retires the 5-stage journey bar but keeps Back and the wordmark (Task 2.7)`.
- **Actually detects:** no progressbar, a Back control with `Zurück`, and the wordmark.
- **Keeper:** `stage 3 shell reuses onboarding language without internal numbering` at 68–90 already renders the same shell/save status and heading, tests no progressbar/no internal stage numbering and meaningful German content.
- **Transfer first:** give that existing render `onBack={() => {}}`, append its two missing assertions (`aria-label="Zurück"`, `>chaarlie<`). Retain the existing content/font/live-status assertions. The no-Back rendering branch still receives exercise from the supplied-save-state matrix at 111.
- **Owner/callers:** `src/components/personal-plan-products/index.tsx:71–123` delegates to `PersonalPlanJourneyHeader`; `src/components/personal-plan-journey/journey-header.tsx` renders the Back button and wordmark, and only renders a progressbar when `moduleProgress` is supplied. Stage3Shell's actual caller is Stage3ProductsFlow.
- **History:** #471 (`97c7f731a`) introduced the dedicated retirement test. Current first test already carries the retirement assertion, so one combined rendered-shell contract is sufficient.
- **Unlocked cleanup:** duplicate static render only. Preserve the save-state matrix, including positive `Auswahl gemerkt` and negative `Gespeichert` assertions. This is not another count of the already-deleted local-label helper test.
- **Risk:** low after transfer; no CSS/layout assertion is discarded.

### C4 — atomic Shampoo reducer replay moves to actual production gateway

- **Delete after transfer:** `tests/personal-plan-stage3-state-machine.test.ts:1636–1720`, `atomic category replacement clears and reassigns two-product Shampoo ownership`.
- **Actually detects:** replacing A's exclusive shampoo role with B removes A; assigning the same exclusive role to both products rejects.
- **Keeper:** `tests/personal-plan/products/production-persistence-gateway.test.ts:1807–1906`, `production gateway persists complete category assignments atomically and rejects incomplete replacement`.
- **Current keeper gap (must fix first):** it starts with zero assignments and requests B; it proves initial assignment and empty replacement rejection, but cannot currently catch failure to clear A or duplicate ownership. It is not sufficient unchanged.
- **Exact transfer:** seed the gateway's loaded shampoo draft with A owning `shampoo_everyday` (literal fixture data, not the replacement helper under test). Run the existing mutation assigning B, preserve the exact roleAssignments assertion and one-save assertion. Add a rejected mutation proposing both A and B for `shampoo_everyday`, assert `/role shampoo_everyday already assigned/`, and assert the save counter does not increase. Preserve the existing empty-assignments rejection and its zero-write assertion. Keep revision values canonical if using the same cached gateway; a fresh invalid gateway rooted at the committed draft is also valid.
- **Stronger seam:** real `createProductionStage3ProductsGateway().mutate` → current owned draft → current-refined-source check → applyMutation's `replace_category_role_assignments` switch (production gateway:1580) → actual reducer (state-machine:561–627) → revision guard → actual `persistence.save` invocation (gateway:885). The fake persistence must observe input.draft rather than produce the expected assignments. Existing keeper already does this.
- **Non-test callers:** Stage 3 PATCH discriminated union at `src/app/api/personal-plan/stage-3/route.ts:128` still accepts this mutation; real route creates the production gateway at :571. Labs fixture gateway also dispatches the reducer at fixture-gateway.ts:1010. Modern UI uses `replace_capture_category` instead, so the UI's Shampoo test cannot replace this legacy mutation's direct protocol proof by itself.
- **History:** reducer and gateway atomic tests introduced by `126192477` (#344), whose change explicitly fixed multi-product ownership and atomic category finalization. This is preservation at the stronger real handler/persistence seam, not removal of the atomic contract.
- **Unlocked cleanup:** delete the one test; no export deletion: replaceCategoryRoleAssignments remains runtime-used by both gateways and by the retained Oil reducer test.
- **Risk:** moderate until transferred and mutation-checked; low afterward. An invalid test must reach the duplicate-role check, not fail on stale expectedRevision or a different guard.

## Rejected broader cuts / retained contracts

- **Atomic Oil replacement (state:1722) stays R.** The current gateway Shampoo keeper does not exercise moving one of several roles while preserving the other role on each Oil. A broken implementation that replaces all roles with the moved one would escape its single-role case. It also lacks the Oil exact +1 revision assertion. Adding an independent Oil gateway row is relocation, not established redundant-test deletion credit.
- **Mixed finalization (state:1813) stays R.** Gateway:1908 has no products/assignments and one unique gap; reducer test mixes a dry-finish assignment with two distinct not-ready roles and duplicates one gap. It catches gap deduplication plus mixed assigned/uncovered roles. Existing keeper cannot catch those failures unchanged. Do not claim generic one-CAS coverage subsumes them.
- **State:52,96 ownership bootstrap cases stay R.** They generate known-empty/mixed ownership cursors and gap roles. Flow resume tests often supply completedCaptureCategories/categoryCursor directly and cannot prove that producer.
- **State:166 two Conditioners / :261 explicit gap / :287 cursor progression stay R.** They call the reducer and computeStage3PathState's exact unresolved keys. Flow uses its own subject/navigation projections; a passing DOM flow does not establish the server path's unresolved-key ordering.
- **State:508–1615 proposal/accept/reject/product-load tests stay R or F below.** Flow:1284 supplies `pendingDraft`/`acceptedDraft`, proposedOutputSnapshot=null, and a mock resolveNeedRevision. It proves checkpoint UX and request choice, not persisted decision mapping. Flow:1390 supplies dispositions. These are not substitutes for generating inventory authority, preserving base refined payload, scoring loads, material deltas, rejection/acceptance, immutable source, and safe heat clarification.
- **State:1868–2299 role subsets, exclusivity, invalid subjects, stale version, reopen/remove/reassign/uncover pruning stay R.** Each protects a selective descendant or validation invariant; inspected UI tests do not assert all retained siblings and decision keys after those operations.
- **Flow helpers at 5302 and 5317 remain R for now.** They are export-only tests of updateStage3RoleAssignments; runtime caller is toggleRole at flow source:2030. Existing multi-product UI tests only select an initially empty role. None reassigns an already-owned role between two products while preserving another role. Removing either solely because UI capture succeeds is unsupported. A future handler callback→state→DOM/payload replacement could make the helper private, but that is not an existing keeper and is outside this ready batch.
- **Canonical reload-normalizer test:82 stays R.** The actual recovery tests commonly inject an already-typed Stage3ProductsGatewayError. They do not all exercise a Stage3BootstrapContractError passing through normalization. Similar recovery screens do not mean the producer seams are equivalent.
- **Pending/clear-fit/batch finalization, request-generation races, bootstrap/resume, persisted local draft, conflicts, rate limits, auth/owner, and completed receipts remain R.** Single vs plural semantic request production and committed vs uncommitted server state are material differences; do not prune on titles or common end screen.
- **All viewport-sticky, disabled control, German heading/label, CSS variable validity, lab isolation, and source-authority guards are retained.** No visual/security assertion is traded for raw props-only coverage. Some source guards may deserve future owner-boundary replacements; none is justified for deletion here.

## Two F findings (no deletion credit)

1. State:1561 `multiple captured Oils do not inherit category-level purpose frequency load` only asserts `draft.productLoadResolution === undefined`.
2. State:1610 `captured weekly Oil without scalp or dry-finish purpose does not create product-load overlay` makes the same assertion.

The current completeCaptureCategory path calls applyProductLoadResolution, and both pending and not-needed inventory-authority branches set productLoadResolution to undefined (state-machine:110–130). A wrong positive inventory proposal therefore still passes these assertions. Preserve the intended contracts by asserting the current authority result (not_needed/null proposed snapshot for these fixtures), and preferably use the adjacent positive scalp-purpose case :1548 as a control. Verify the exact fixtures before choosing the final oracle. These tests are not redundant evidence; their current negative assertion is stale. No mutation/test run was permitted in this pass, so this is source-derived, not a demonstrated mutation result.

## Read scope and verification limits

- Read all declaration bodies, fixtures and literal parameter values in the three assigned files: flow (85 current declarations), state-machine (36), components (16). Read state-machine.ts in full; read flow's harness, fixture adapters, initialization, render phase gates, role callback, group/follow-up construction, submission and handoff paths relevant to the decisions. Read the full header/shell owners relevant to C3.
- Read the exact nested production gateway keepers, shared persistence fixture, and real mutation dispatch/save path. Inspected surrounding nested test inventory and gateway callers. Did not claim a fresh full review of all 3,864 lines of the nested gateway test file, all 4,183 lines of flow production, every component implementation, or SQL/storage implementations. Those uninspected areas are not deletion candidates here.
- Inspected dependency source `node_modules/react/cjs/react.development.js`: React hooks delegate to ReactSharedInternals.H. The flow harness installs its own dispatcher. Its tests exercise callbacks/state and element trees; they are not real React reconciliation, unmount, browser layout, or DB persistence proof. Static render assertions are meaningful DOM serialization, not browser viewport verification.
- CI: package.json `test:node` runs top-level .test.ts/.test.tsx with Node + tsx/server-only-register. `.github/workflows/ci.yml:158–160` runs top-level contracts and recursive nested Personal Plan runner. `scripts/ci/run-personal-plan-nested.mjs` recursively includes the nested keeper. No CI registration change is needed.
- Parent's frozen full c8 run was not disturbed. No pass/fail or coverage claim is made from this read-only pass. Global <=2% coverage delta remains the parent's measured gate, not inferred from these recommendations.
- Git history was read for the identified candidates; historical commit verification claims were not rerun or adopted as current results.

## Runnable verification after the parent releases the frozen window

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-flow.test.tsx tests/personal-plan-stage3-components.test.tsx tests/personal-plan-stage3-state-machine.test.ts tests/personal-plan/products/production-persistence-gateway.test.ts
```

For an individual keeper:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='production gateway persists complete category assignments atomically' tests/personal-plan/products/production-persistence-gateway.test.ts
```

Preservation mutations, only after the parent authorizes/releases the test window: make replacement append old category assignments (C4 keeper must fail); remove duplicate-exclusive-role rejection (C4 keeper must reject the regression through the intended guard); force follow-up overrides on an initial Oil anchor (C2 keeper must fail); suppress Back/wordmark or add a Stage 3 progressbar (C3 keeper must fail). Restore production source byte-for-byte. D1 and C1 preserve existing owner paths without new runtime assertions needing changed production seams.

Then run the campaign's existing focused/full Node and c8 commands, formatting and diff checks under the main session's ownership. Do not use the generic skill's Vitest/OpenClaw commands: this repository's observed runner is Node, and no such migration of runner is in scope.
