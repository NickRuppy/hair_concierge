# Stage3 applied-cut preservation review

Read-only independent review of the applied five deletions, four assertion transfers, and two repaired assertions. No tests, mutations, providers, or repository edits were run. Original owner evidence was read from HEAD where concurrent mutation work made live-source judgment unsafe.

## Verdict

No lost contract or vacuous transferred assertion found in this bounded 5+2 scope.

| Applied change | Preservation evidence |
|---|---|
| Flow known-empty duplicate-confirmation deletion | The retained Flow test at tests/personal-plan-stage3-flow.test.tsx:3290 constructs the known-empty Heat ownership with createStage3Draft and actual Stage3ProductsFlow. It now records gateway mutations, supplies onProductKindsCorrection, settles twice, and asserts zero callback calls, no review/capture screen, and no mutation. This reaches the intended known-empty state; it is not a missing-screen-only negative. |
| Flow direct Routine-handoff deletion | Retained Flow:5103 uses the same two-role Oil capture, assignment, review and single-shot re-render path and additionally asserts review-completed analytics. The removed test had no module-entry-specific input or prop, so no distinct entry contract was lost. |
| Flow grouped-Oil anchor deletion | Retained Flow:5526 positively requires the three-member group and anchor before asserting headingOverride, scopeContextLine, and primaryActionLabelOverride are undefined. The positive anchor/group assertions prevent the three undefined checks from passing because the component was absent. |
| Stage3 shell deletion | Components:68 now renders the same Stage3Shell with onBack, then checks no progress bar plus rendered Back aria label and wordmark. This is actual server-side markup, not a private prop check. The separate save-state matrix still covers the no-onBack input. |
| Shampoo A-to-B replacement deletion | Gateway:1807 seeds loaded persisted A ownership, mutates B through the real production gateway, captures the save input, and asserts CAS revision, exact B-only persisted/returned roles, and revision increment. It then sends A+B and empty proposals at the committed revision and asserts the specific duplicate/uncovered errors with no second save. HEAD gateway dispatches replace_category_role_assignments into replaceCategoryRoleAssignments (production-persistence-gateway.ts:1580-1588); the test therefore reaches reducer and persistence rather than a fixture-produced result. |
| F: multiple Oils negative | State:1561 retains productLoadResolution undefined and now positively requires a present inventoryAuthority envelope, status not_needed, null proposedOutputSnapshot, and empty materialDelta. This closes the former absent-field false pass. |
| F: single no-purpose weekly Oil negative | State:1615 has the same positive authority envelope. The neighboring State:1548 positive scalp-purpose case still requires an actual Scalp Care proposal, so the repaired negatives cannot be satisfied by suppressing all authority output. |

## Source and routing checks

- The route/default flow forwards the correction callback at src/components/personal-plan-start/plan-start-flow.tsx:1274; the retained test supplies and observes that public callback.
- The Compare-like grouped screen still uses actual ProductFitComparison props; the transferred undefined properties are asserted only after a positive rendered anchor.
- HEAD production gateway first applies the requested mutation and uses the provided expected revision in its persistence boundary. Its replacement case delegates to replaceCategoryRoleAssignments, so an A+B request at the committed revision is capable of testing exclusive-role validation; a stale revision would not be an equivalent negative.
- The F oracle is appropriately about inventoryAuthority, rather than only legacy productLoadResolution. The original tests' undefined field could pass for the wrong absence reason; the applied assertions require the no-change authority outcome.

The applied diff is net negative in the four scoped files (90 additions, 314 deletions); it contains exactly the named removals and transfers plus the two F repairs. This review does not make a coverage claim or assess the wider Stage3 suite.
