# Stage 3 cutover — independently checked, not applied

2026-10-02; worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Input: `/tmp/test-audit-stage3-layer-judgment.md`. This is the bounded second judgment on its five proposals, not a fresh ledger of every Stage 3 test.

**Decision: support five removals (one D, four C after transfers) and repair both F assertions. No whole file, production export or runtime seam is retired.** No repository edits, tests, mutations, providers or network calls were performed. The parent's frozen full-172 run is active: do not apply this plan or run its commands until the parent releases that window.

## Inherited decision contract

The user's authorized campaign target is removal of the least-useful 20% of the baseline 11,892 declarations (2,379), with global coverage within two percentage points. This slice removes only independently demonstrated repetition; it does not settle the campaign quota or infer coverage from line counts. Product behavior, architecture, authority policy, authentication, ownership, persistence semantics, runtime flags and publication are unchanged. Main owns integration, counterpart review where required, execution and final coverage proof. No new product decision or confirmation is needed for these bounded test-only edits after the runner freeze ends.

Prospective edit scope is exactly four existing test files: `personal-plan-stage3-flow.test.tsx`, `personal-plan-stage3-components.test.tsx`, `personal-plan-stage3-state-machine.test.ts`, and `personal-plan/products/production-persistence-gateway.test.ts`. Preserve the existing campaign edits. Do not count earlier local-label/helper cuts, F repairs, or assertion moves as additional removals.

## Exact removals and transfers

Line references describe the current pre-cut files; edit by exact declaration name.

| ID / delete | Keeper and exact prerequisite | Why the transfer is sufficient |
|---|---|---|
| C1 — Flow:3361 `global no-owned-category review suppresses duplicate confirmation while staying on server state` | Flow:3290 `global inventory review keeps server-authored no-owned gaps local without client mutation`: add a local correctionCalls counter, pass onProductKindsCorrection incrementing it, then perform a second renderSettled and assert zero calls. Assert both ProductKindReviewScreen and ProductCaptureScreen absent and recordedMutationTypes empty on that final tree; retain the existing first-render checks. | Both bodies build the same known-empty Heat ownership via the actual createStage3Draft. The deleted body's optional onContinue calls do nothing because its review is absent. The counter preserves its actual negative callback assertion; this is not evidence of duplicate-click suppression. Real pending duplicate-finalization cases remain. |
| D1 — Flow:5236 `an explicit products module completion lands on the Routine directly` | Flow:5173 `multiple individual reviews progress to one direct Routine handoff`, unchanged. | Identical two-Oil-role entry, gateway, capture, assignment, two choices, handoff/copy/analytics and rerender uniqueness assertions. Keeper additionally asserts review-completed analytics. There is no module-entry discriminator in either input or the current prop contract. |
| C2 — Flow:5767 `the anchor's own screen carries no follow-up overrides` | Flow:5662 `three oil use cases render as one grouped screen with pre-checked cases`: after its existing assert.ok(anchor), assert headingOverride, scopeContextLine and primaryActionLabelOverride are each undefined. | Both reach the same initial three-use Oil anchor with zero committed group keys. The keeper already positively requires the group and anchor, exact cases/counts and role label. No negative can pass merely because the anchor disappeared. |
| C3 — Components:92 `stage 3 shell retires the 5-stage journey bar but keeps Back and the wordmark (Task 2.7)` | Components:68 `stage 3 shell reuses onboarding language without internal numbering`: add onBack={() => {}} to its existing render and append /aria-label="Zurück"/ and />chaarlie</ matches. | Same shell/header render. Existing no-progressbar, language, heading, font and live/save-status assertions remain. The adjacent save-state matrix still exercises the no-Back input. This does not claim Back callback interaction or browser layout proof. |
| C4 — State:1636 `atomic category replacement clears and reassigns two-product Shampoo ownership` | Gateway:1807 `production gateway persists complete category assignments atomically and rejects incomplete replacement`: apply the exact initial ownership, persistence and rejection transfer below first. | The current keeper is insufficient: it starts with no assignment, so B-only output cannot establish removal of A. After transfer it reaches the actual production gateway, reducer and save boundary without preconstructing expected output. |

No newly grouped declarations, extra test rows, replacement test declarations, fixtures computing expected results, or runtime instrumentation are required.

## C4: canonical input and reachable invalid branch

Keep the two captured Shampoo products and required exclusive shampoo_everyday role. Immediately after the two captures, seed the **loaded input**, without calling replaceCategoryRoleAssignments or assignProductRoles:

```ts
shampooDraft = {
  ...shampooDraft,
  roleAssignments: [{
    capturedProductId: "shampoo-a",
    category: "shampoo",
    roles: ["shampoo_everyday"],
  }],
}
```

This is a literal persisted precondition, not a receipt fixture. It leaves an active product_capture draft with its Shampoo cursor and incomplete capture; no cursor repair should save. Capture every persistence.save input in a local typed array, while returning `{outcome: "saved", draft: input.draft}` unchanged. Keep loadDraft returning that initial draft and loadRequirements returning the Shampoo requirements. Use `persistence(shampooDraft)` rather than the unrelated default Conditioner fixture for inherited current-source behavior; do not inject authority evaluations or prepared replacement output.

Call the existing B-only mutation with `expectedRevision: shampooDraft.revision`. Require saved status positively (assert.ok narrows the union), then:

- exactly one save;
- the save input's expectedRevision equals the loaded revision;
- exact saved input roleAssignments is the one B assignment (no A);
- exact returned roleAssignments is also that B assignment;
- returned revision equals the loaded revision + 1. The old removed test did not assert this, but it is the canonical CAS precondition for the subsequent invalid requests.

Use **the same gateway**, now caching the committed draft, for both invalid mutations. Supply `expectedRevision: result.draft.revision` and its exact draftId. First request two assignments with distinct existing capturedProductIds A and B, each containing the single required role `shampoo_everyday`; require rejection matching `/role shampoo_everyday already assigned/` and save input count still one. Then preserve the existing empty-assignment rejection `/required role shampoo_everyday is uncovered/`, again using that same committed revision and asserting count remains one. Remove the now-unnecessary second invalidGateway/invalidSaves setup. A valid request is not sent between the two invalid requests, so the canonical revision stays unchanged.

Guard trace: gateway.current loads/caches the real input; active status and current refined source pass; applyMutation dispatches `replace_category_role_assignments` into the actual reducer; schema/category/product identity, distinct product IDs and required-role checks pass for the A+B proposal; roleCounts reaches two and the exclusive-role guard throws. The gateway's revision check occurs **after applyMutation**, not before it. A stale revision could therefore still throw the expected duplicate error; deliberately using the committed revision is necessary to make this a valid negative request. The rejection regex must be specific, not a generic rejection/status assertion. The unchanged save count proves no write reached persistence.

Runtime reachability remains real: Stage 3 PATCH accepts the nonempty A+B assignment array, creates the production gateway, and the Labs fixture gateway also dispatches this reducer. The modern UI's different replace_capture_category mutation is not being substituted for this still-supported protocol. The preserved empty-array gateway test is an internal boundary contract; the HTTP schema rejects an empty array earlier, and this plan does not claim it reaches the route.

Keep the separate atomic Oil reducer test: its multiple roles, retained siblings and exact +1 revision are not established by Shampoo. Keep mixed gap finalization, descendant pruning, invalid-subject and request/version/owner tests.

## Two F repairs: exact valid oracle established from current source

At State:1561 `multiple captured Oils do not inherit category-level purpose frequency load` and State:1610 `captured weekly Oil without scalp or dry-finish purpose does not create product-load overlay`, retain the current undefined legacy-field assertion if desired, but add a positively present authority and exact current result:

```ts
const authority = draft.inventoryAuthority
assert.ok(authority)
assert.equal(authority.status, "not_needed")
assert.equal(authority.proposedOutputSnapshot, null)
assert.deepEqual(authority.materialDelta, [])
```

Do not compute expected output using resolveStage3InventoryAuthority or compare the draft with an authority fixture generated by the same helper.

These are source-established expected values, not guessed names:

- Both helpers use an authority snapshot matching refined-v1, balanced scalp, shampoo twice weekly, no weighed-down signal, no base included Deep Cleansing/Scalp Care, and no dry-shampoo or leave-in product. Their Oil requirement has no roles, so completing capture reaches applyProductLoadResolution.
- The multiple-Oil case has two Oil products (daily and weekly), purposes dry_finish+scalp, and no product-specific role assignment. `capturedLoadFacts` and `scalpLoadFacts` independently require exactly one Oil before inheriting category purposes. Both frequencies stay null; Deep Cleansing resetLoad is zero and Scalp Care has no load signal.
- The single weekly Oil case has an empty purposes array and no dry_finish assignment. It also produces neither frequency despite having exactly one Oil.
- Both decisions therefore return null; resolveStage3ProductLoadResolution returns undefined; buildStage3ProposedRefinedSnapshot returns null; resolveStage3InventoryAuthority returns a **present not_needed envelope** with proposedOutputSnapshot=null and materialDelta=[]. applyProductLoadResolution stores it. Both pending and not-needed branches set the legacy productLoadResolution field undefined, explaining the original false pass.

Keep State:1548's positive scalp-purpose test, which actually requires the proposed Scalp Care/scalp_exfoliant decision. It catches suppressing all proposals as a purported negative repair. No product policy change or new fixture frequency is needed. These remain two F repairs with zero removal credit; native green and expected-red controls are still required before claiming repaired.

## Native execution, after the frozen run ends

Pin the parent's pre-edit file/source hashes. Run this exact four-file command before transfers, after transfers/F repairs, and after the five deletions:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-flow.test.tsx tests/personal-plan-stage3-components.test.tsx tests/personal-plan-stage3-state-machine.test.ts tests/personal-plan/products/production-persistence-gateway.test.ts
```

For isolated controls use the native name filter before the file:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='production gateway persists complete category assignments atomically' tests/personal-plan/products/production-persistence-gateway.test.ts
```

Applicable other keeper filters are `global inventory review keeps server-authored`, `three oil use cases render`, `stage 3 shell reuses onboarding language`, `multiple captured Oils`, and `captured weekly Oil without`. Use their owning file, and run the adjacent positive scalp-purpose keeper with the two repaired Oil negatives after restoration. CI already runs the top-level contracts and recursively discovers the nested gateway test via scripts/ci/run-personal-plan-nested.mjs. No registration change is needed. Follow with required formatting/diff/typecheck and the parent's native full coverage proof; do not use the generic skill's unrelated OpenClaw/Vitest commands in this Node repository.

## Actual-owner controls, one mutation at a time

Each control must fail for the named assertion/behavior, then restore every source byte and verify hashes before another control. Do not mutate test fixtures or the fake save result. No controls were run by this reviewer.

| Preserved assertion | Actual owner mutation and expected failure |
|---|---|
| C1 no correction callback after known-empty bootstrap | In a Flow mount/effect path, deliberately invoke onProductKindsCorrection?.([]) only for the present known-empty ownedCategories input. Keeper's external zero counter must fail after its second settle. This is an injected contract fault, not a claim that duplicate clicks currently occur. |
| C2 initial anchor lacks follow-up props | In Flow's ProductFitComparison props, temporarily provide a nonempty fallback for one of headingOverride/scopeContextLine/primaryActionLabelOverride when oilFollowUp is absent; repeat per transferred property if proving all three independently. The respective undefined assertion fails on the positively required anchor. Merely relaxing the committed-key condition may still return null from oilFollowUpCopy and is an inadequate control. |
| C3 Back and wordmark | Separately stop Stage3Shell forwarding onBack, and pass showWordmark=false to the real PersonalPlanJourneyHeader. The relevant transferred rendered-markup assertion fails. Existing progressbar assertion remains; no new mutation is necessary for an unchanged assertion. |
| C4 replacement clears A | In replaceCategoryRoleAssignments candidate construction, retain the old category assignments before appending parsedAssignments. Valid B replacement then fails (duplicate validation or exact save payload), whereas the old unassigned keeper could pass. |
| C4 duplicate exclusive role must reject | Temporarily change the actual shampoo roleMultiplicity.shampoo_everyday policy from single to multiple_products_per_role. Both the reducer and draft validator now allow the otherwise-valid A+B request; the keeper must fail its expected rejection (and the request would save). **Do not claim a control from deleting only the reducer's count>1 throw:** cloneWithRevision invokes validateStage3Draft, which independently emits the same `role shampoo_everyday already assigned` error. Such a mutation can remain green correctly. |
| F multiple Oils cannot inherit category purposes | Separately force useCategoryLevelOilPurpose=true in capturedLoadFacts and in scalpLoadFacts. Either genuine authority proposal must make the new not_needed/null assertion fail. Restoring only one function after a combined mutation would be insufficient. |
| F a weekly Oil with no purpose cannot create either load | Separately remove the dry_finish-purpose requirement in capturedLoadFacts (preserving the single-Oil condition), and the scalp-purpose requirement in scalpLoadFacts. Either produces a real proposal for oilOnlyDraft([]) and must fail the new authority oracle. |

D1 needs no assertion transfer: the actual identical handoff keeper already contains every removed observation. These controls validate preservation; they do not authorize changing any production policy.

## Evidence and limits

Independently read the complete five proposed deleted bodies, every named keeper, both complete F fixtures/helpers, the actual callback/state/render/save owners and their relevant guards, the shared persistence fixture, complete role-replacement function, cloneWithRevision and validator duplicate enforcement, authority multiplicity policy, Oil fact/decision/proposal/envelope paths, route dispatch, real host props, harness and relevant CI routing. No scoped AGENTS.md was found under the affected src/tests trees; root agreements and test-audit/CAMPAIGN apply. The React harness installs the real dependency dispatcher; it tests component callbacks/element props, not browser lifecycle/layout or child rendering. C3 uses actual server-side markup rendering. C4 uses real gateway/reducer code with observed fake persistence, not a database transaction.

History cross-checks match the layer report: C1 #363 (8a99abd1), handoff convergence #481 (822a547c), Oil grouping #436 (938cc8fb), shell retirement #471 (97c7f731), atomic replacement and both original Oil contracts #344 (12619247). This pass did not reread every test in the three whole files or the full 3,864-line gateway suite; the earlier full ledger/read accounting belongs to the separate layer reviewer. No old CI pass is adopted as current proof.

Only `/tmp/test-audit-stage3-cutover.md` was written. Final prospective net declaration reduction: **five**, contingent on the transfers and preservation proof above. Both F oracles are established from source and remain unexecuted. No unresolved product/architecture choice was found.
