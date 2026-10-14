# Scanner unknown/name intake UI26 — conditional same-render consolidation

Scope is exactly `tests/scan-unknown-flow-ui.test.tsx` (13 registrations,414 lines) and `tests/scan-research-intake-form-ui.test.tsx` (13 registrations,309 lines), at HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`. All723 test/helper lines and both actual component implementations were read. This is a complete26-site semantic ledger, not a reread of the previous98/220 scanner cohorts. Baseline/runtime/fault proof is not run by this worker.

Chosen direction:21R,1heldF,4conditionalC,0D. Prospective phases26→26→22; two strengthened keepers, four donors removed only after transfer proof,20 unrelated callbacks byte-exact. Six complete phase files are frozen under snapshots. Both helpers, fixtures and imports stay unchanged. No product source, test-only export or production seam is deleted: ScanUnknownFlow is live at scan-flow.tsx:1143; ScanResearchIntakeForm is live at scan-search-sheet.tsx:853. One existing pure tree-inspection call is carried with C2; no owner/render/event/fixture call, input case or row is added.

## C1 and C2: generic unknown initial render

Keeper: `ScanUnknownFlow: the bridge line sits under the headline, above the subline`, before line278. It already executes exactly the same `renderFlow({ submitting: false, onSubmit: () => undefined })` as both donors, then exactly one `renderToStaticMarkup(tree.value)`.

C1 donor line265 carries all three complete literal regex assertions: signed-off headline, subline and question. C2 donor line289 carries the `findAll(...type === "input")` observation/declaration, its deep empty-array assertion and all three negative markup assertions (Marke, Produktname, Zur Prüfung einreichen). All seven assertions move verbatim into the keeper immediately after its existing markup binding; both original bridge assertions and index ordering remain. Donor bodies remain exact during transfer.

Effective fixture: same fresh unknownResult EAN4006381333931, category keys/labels from the same constants, no identified object, submittingfalse,errornull,no-op callback. Fresh hook slots are showAllfalse,showCategoryGridfalse,tappedCategorynull. Operative branch is owner lines62–70 and104–124; no callback, network, timer, ref or effect runs. Moving the pure findAll read to after SSR does not mutate the original returned tree or state. React.Children.toArray maps children; our helper only recursively reads element props. Both calls use the actual React server renderer and actual component output.

The stronger keeper's original index-prefix ordering does not already cover the complete C1 literal sentences or C2 prohibited fields/text. They are explicitly transferred, not inferred from the heading. C1's three owner constant faults preserve the original index prefixes where relevant and fail the new complete-copy assertion. C2's four faults independently add a host input or each prohibited visible text inside the actual component root. No harness/mock fault is used.

## C3 and C4: empty/default name intake render

Keeper: `ScanResearchIntakeForm: entering the intake state moves focus to the Marke field (task 6 a11y)`, before line138. C3 donor line124 and keeper already have identical explicit blank brand/product and no-op onSubmit. C4 donor line305 supplies errornull while omitting blank fields; renderForm normalizes both omitted fields to empty, omitted submitting tofalse and null/omitted error tonull. All other callback defaults are same inert functions. Hook slots false/null plus two null refs are identical; neither callback nor ref is invoked.

C3 moves all six body-markup assertions verbatim: Marke, Produktname, Was ist es?, helper sentence, Zurück, no word-boundary dm. C4 moves its absent-alert assertion onto the keeper's existing `markup` value, replacing only the redundant expression `renderToStaticMarkup(tree.value)` with `markup`. No new render call. These seven observations precede the original six focus/element assertions; their relative original order remains intact. This makes a copy fault fail at the copied copy oracle instead of an indirectly related input lookup. Entire assertion multisets were reconstructed, with only the stated C4 expression normalization.

The focus keeper proves declarative autoFocus targeting and SSR autofocus serialization, not actual browser focus. ReactDOM's server renderer maps autoFocus to a boolean lowercase attribute; no DOM commit occurs in this suite. The new union does not broaden this claim. The original donor title's “heading” describes body labels only: the actual heading belongs to ScanSearchSheet's header and remains independently covered by its parent tests.

C3 has six separate actual constant faults, including appending standalone dm while preserving other expected text. C4 changes only the form's `error ?` branch to unconditional true, producing an empty alert at the same null input. Actual fault runs are pending.

## Rejected cross-layer substitutions

`tests/scan-flow-ui.test.tsx:1889–1896` explicitly retains nested components as element props without invoking the child. The parent can prove forwarding, prefill, trim, request ownership and lifecycle; it cannot absorb actual child button blocking, expansion, suggestion exclusion, stateful pending/failure recovery or focus prop selection. All these child tests remain.

The larger copy test at1767 directly invokes ScanResearchIntakeForm at1859, but uses productNameText="Ciment Thermique" and a non-null error. It obtains `textContent(intakeTree)` at1872; this is an element-tree text walk, **not SSR HTML**, despite the navigation report's shorthand. Its different input/error branch and readset cannot replace either default-null HTML donor. It remains unchanged and outside the26-site declaration count.

Unknown identified uppercase/no-suggestion/secondary override branches remain distinct from generic empty renders. Pending/mask label and failed/oil styling tests use different state traces. Their apparent repeated labels do not establish whole-input equivalence. The thumbnail test remains a real owner callback regression; it does not prove live optimizer/network behavior.

## Held F, no removal or repair credit

`tests/scan-research-intake-form-ui.test.tsx:237` claims other cards disable while submitting. Its actual assertions count one busy label, check mask label absent, retain the Shampoo label and assert only back.disabled. Setting the category-map button's disabled tofalse at owner line249 would leave those assertions green; the independent duplicate-tap test checks the JavaScript submitting guard at177, not DOM disabled. Retain this exact callback and mark the missing disabled assertion as a follow-up. Do not add a case or repair it in this proposal. No hardware/browser focus gap is claimed repaired by static tests.

## Evidence and controls

`complete-ledger.{md,json}` and `judgments.json` enumerate every original declaration, exact body/assertions/calls/hash, actual detectable regression, owner evidence and limits. `candidates.json` carries complete donor/keeper bodies and whole keeper union. `controls.json` contains14 unique actual-owner anchors, whole source/mutant hashes, exact keeper selections, phase oracle lines and assertion text; prospective-mutants holds syntax-parsed copies, never applied. `static-check.json` and parser-check.log record26/26/22, six phase parses,20 exact unrelated callbacks and one exact heldF. No tests/modules were run/imported; no child processes are launched by the parser/check scripts.

History read: signed-off one-tap Task9 in plans/scan-public-launch.md:94–96, bridge owner/test change2a87014e, F17 owner/test repair255ffa87, current identified tests introduced7072124b, name-intake owner additionac021a5b. Current consumers, relevant overlapping parent tests/helpers, CI quality-node routing and installed React/ReactDOM/Next callback/SSR slices are pinned in read-scope.json. Every hash is a drift guard; only the recorded full/slice reads receive semantic read credit. No full vendor closure, broader scanner audit, network/provider/DB, browser focus or native-runtime proof is claimed.

Main must inspect the full packet and obtain independent preservation review, run before26 and transfer26 green, then execute all14 actual faults serially with exact1 keeper, intended ERR_ASSERTION/operator/message/first frame, zero skip/cancel/todo, byte-exact restore and clean green. Cut22 follows only current transfer fault proof. Applicable repository/campaign validation remains with main. There is no apply/control runner in this packet.
