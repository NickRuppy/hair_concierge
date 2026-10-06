# Test-owned scanner rule seams and duplicated shell proof

Outcome: remove seven declarations that exercise disconnected rule scaffolding,
plus one shell rendering duplicate after transferring both assertions. The 20%
global target remains unchanged and unmet. Current verified net is 87; this layer
would bring it to 95, without combining distinct Oil/Leave-in cases for count.

Authorization/decision coverage: Nick explicitly requested least-useful test
pruning within 2% coverage, then instructed Codex to investigate production
reachability. No new product, routing, access, payment or rollout decision is
required: actual scanner gates and Stage3 save behavior remain unchanged. Main
owns integration and final proof; read-only agent discovery and main caller/
assertion review completed. Publication/deployment remain unauthorized.

## Exact cutover

| Original declaration / line                                                | Mark | Owner evidence / remaining proof                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scan-trigger-rules:36 classification: four user-initiated / four proactive | D    | SCAN_TRIGGER_CLASS and ScanTriggerClass have no runtime consumers. The literal map is not consulted by actual fatigue/trigger decisions; remove map/type and its sole equality test. Keep the ID union and real proactive/gated/fatigue tests. |
| :51 first-mismatch fires with free reveal                                  | D    | firesErsterPasstNicht is test-only; actual Flow uses server verdict shape/reveal CTA, with scan-flow-ui:2718/2729/2784 real masked/reveal/spent-credit and gate-context proof.                                                                 |
| :63 later-mismatch complement                                              | D    | firesWasPasstStattdessen is test-only; actual spent-credit response is covered at scan-flow-ui:2784/2806, the real reveal/gate UI boundary.                                                                                                    |
| :103 locked bookmark predicate                                             | D    | firesMerkenTap only echoes a boolean for tests; current Flow owns header/footer lock routing and actual Merkliste context.                                                                                                                     |
| :110 unknown product constant false                                        | D    | firesUnbekanntesProdukt always returns false and has no runtime caller. Unknown/pending do not select/spend triggers in the actual reducer, independently tested with qualifying conditions in scan-flow-state:1120/1140.                      |
| :316 Merken trigger-context mapping                                        | D    | The registry entry is unused: Flow deliberately uses scan:verdict for this gate, not trigger:merken-tap. Remove only this obsolete mapping entry; keep scan-flow-ui:2845 (actual Merkliste gate context) and :2874 (verified purchase unlock). |
| :336 unknown trigger-context null                                          | D    | No runtime caller asks this mapper for unknown; the real unknown admission/trigger-budget guard remains at its reducer/UI owner.                                                                                                               |
| stage3-flow:269 local header label without server-save claim               | C    | Move its positive supplied-local-label and negative >Gespeichert< assertions into stage3-components:111, the existing real Stage3Shell save-state matrix. Remove only the narrower declaration.                                                |

Also remove the unused first-mismatch registry entry and its assertion from the
retained mapping test; that test still covers the live two-scans entry. Remove
the fake Merken predicate assertion from the retained fatigue case; its actual
two-scans predicate remains. The freemium-cutover journey's supposed gate step
calls only this disconnected scaffold: remove that step/import and correct its
title/comments, retaining actual registration/navigation/route decisions. No
test-owned seam is added as replacement. scanTriggerSheetContext stays live for
two-scans and proactive cards; classification/ID taxonomy is otherwise untouched.

Current module comments explicitly document that T9 shipped the first-mismatch
and Merken surfaces with scan:verdict and no production caller uses those two
registry entries. Current/deployed source searches and imports independently
confirm the test-only helpers. The current deployed SHA checked is
3abfe00a7843882f01009de701affa7b1dff697f; this is reachability evidence, not a new
coverage baseline or fresh-main release proof.

Rejected Stage3 candidates: keep responsive/sticky safe-area classes, lab guard,
production no-fixture/no-client-authored decision topology, composed clearance,
and CSS-variable validity. These retain independent real contracts. Also keep
distinct helper cases/label rows; grouping them would only reduce declarations.

## Verification and stop contract

Finish all current runners before edits. Selected six-file baseline: 313/313
cases, source-mapped c8 covering all original source paths. Apply this exact
layer, run formatter/diff check, then the same focused set. Compare surviving
owners and conservative original-denominator global coverage; <=2pp remains the
acceptance gate, and removed source is charged as uncovered. Mutation: make local
save status falsely render Gespeichert; transferred shell assertions must fail,
then restore owner bytes exactly. No mutation is necessary for a literal
test-only helper with no remaining runtime contract.

Run typecheck/lint/build for the source deletion and complete full Node proof;
failure names must equal the retained 26 baseline Supabase-mock failures. Review
the final delta read-only via the counterpart lane and verify its findings.
Restore a cut if it loses a live contract or breaches coverage. Continue to
record global-target shortfall accurately; do not relabel this layer as a 20%
result. Before any later publication, reconcile current main according to the
campaign merge policy and reverify that head. Durable receipt/ledgers stay under
plans/evidence; raw logs/tools/reviewer outputs stay in /tmp.

The selected six-file baseline is tests/scan-trigger-rules.test.ts, tests/freemium-cutover-journey.test.ts, tests/scan-flow-ui.test.tsx, tests/scan-flow-state.test.ts, tests/personal-plan-stage3-components.test.tsx, and tests/personal-plan-stage3-flow.test.tsx. Counterpart review verified reachability and found no hard defect. Its request for a new approval to remove deliberately authored but uncalled T10 scaffolding is advisory: the existing user request plus the test-audit edit-shape rule already authorizes deleting test-only source. No runtime gate, product choice or access contract changes. Exact keeper citations and baseline manifest corrections were accepted.
