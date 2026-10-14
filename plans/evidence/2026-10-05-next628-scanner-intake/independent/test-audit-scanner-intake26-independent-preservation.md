# Independent preservation review: scanner intake26

Verdict: **CONDITIONAL PASS for C1–C4, 26 → 26 → 22**. No lost observable contract found in the proposed four consolidations. This accepts the frozen prospective bytes only; actual clean/fault/restored-clean proof remains main-only and unrun. No source cleanup or F repair is accepted or credited.

Reviewed manifest: `/tmp/test-audit-scanner-intake26/manifest.json`, SHA256 `d7d58df419edf371041212beb2159cb7f6b6d0282b3ecbd439b6de027ebbfc0e`. Actual root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; observed HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`. All 41 manifest artifact hashes and all 25 current readset hashes match. No packet metadata repinned.

## Independent reconstruction

The separate checker parsed all six snapshots using the installed TypeScript parser without importing any test/product owner. It derives declarations and assertion calls from source, checks exact candidate bodies against source, reconstructs transfer by replacing only the two original keepers, then reconstructs cut by removing only the four exact donor bodies and their adjacent blank separators. Both reconstructed full files match frozen snapshots byte-for-byte. All 20 unrelated declarations, including the held pending/back-disabled F, survive byte-for-byte.

| File | Declarations before / transfer / cut | Callback assertion calls before / transfer / cut |
|---|---|---|
| scan-unknown-flow-ui.test.tsx | 13 / 13 / 11 | 45 / 52 / 45 |
| scan-research-intake-form-ui.test.tsx | 13 / 13 / 11 | 29 / 36 / 29 |

All 14 donor assertions enter the keepers' exact assertion multiset union. C4 alone substitutes the already-bound `markup` for the identical `renderToStaticMarkup(tree.value)` expression. Unknown keeper goes from 2 assertions to 9; intake keeper from **5 to 12**, not six original assertions as the prose layer plan states. This is a documentation counting error, not a missing assertion. Original intake keeper declaration starts line136, C4 starts306; prose approximate138/305 are not the executable control line pins.

No new owner/render/event invocation, fixture input, table row or skip is introduced. The only extra nonassert call inside a keeper is C2's original pure `findAll(tree.value, element => element.type === "input")` observation. The checker verifies this exact call and verifies no other nonassert call additions. Full before/transfer/cut callback bodies and calls are embedded in the independent JSON.

## Operative contract judgment

**C1 and C2: accept into the existing bridge-order keeper.** Both donors and keeper call the same `renderFlow({ submitting: false, onSubmit: () => undefined })`. Helper construction produces the same EAN4006381333931, same complete category mapping, absent `identified`, errornull and fresh state false/false/null. `ScanUnknownFlow` lines62–70 selects the generic initial grid; lines104–124 produce the actual copy. The existing bridge ordering checks only prefixes and did not imply the complete sentences. Those three complete regex assertions are transferred verbatim. Likewise, the no-input assertion and all three prohibited-markup assertions transfer rather than being inferred from one-tap behavior.

The donor observed inputs before SSR; the keeper observes them after its existing SSR. This does not change the tested branch: the outer component has already returned a host-element tree, contains no render-time event calls/effects, and its generic child components are Lucide icons. The observed icon implementation creates SVG elements from props/context, without mutating the outer input tree. `Children.toArray` traverses/clones element keys for these ordinary elements; `findAll` never invokes component functions or event handlers. SSR ref handling ignores refs, and no DOM commit occurs. No hypothetical future stateful-child purity claim is needed or made.

**C3 and C4: accept into the existing autofocus keeper.** C3 and keeper explicitly pass blank brand/product values and the same inert submit shape. C4 passes errornull while omitting those fields. `renderForm` lines106–120 normalizes omitted fields to empty strings, error to null and submitting to false; it supplies inert callbacks with no identity-sensitive owner use. Actual owner `ScanResearchIntakeForm` lines141–290 uses the same false/null hook state and two null refs. No event/ref callback is invoked on any of these initial renders. All six C3 regexes and C4 absent-alert regex apply to the existing actual SSR result. They precede the original five autofocus/element assertions, so copy faults cannot qualify merely by a later missing-input assertion.

The C3 title mentions “heading”, but its original assertions only cover body labels, category prompt/helper, back text and retailer absence. Parent `ScanSearchSheet` owns the heading at lines829–835. No heading contract was removed or claimed added. The keeper proves declarative autoFocus targeting plus SSR autofocus attribute, not actual browser focus.

**Held F remains independent and unchanged.** Its pending trace selects mask, changes submitting, counts one busy label, checks mask absence, finds Shampoo and asserts back.disabled. It never inspects other category cards' disabled prop. Owner line249 could lose that prop without this callback failing; the retained duplicate-tap test independently checks the JavaScript guard at177. This gap is correctly held F, with no deletion or repair credit. All identified-product, alternate-category, failure-reset, raw-edit, validation, expansion, positive/negative error and actual callback contracts remain intact.

## Rejected alternatives and live boundaries

The larger `scan-flow-ui` copy callback at1767 uses a direct child with `productNameText="Ciment Thermique"` and a non-null error, then reads `textContent`, not SSR HTML. It cannot replace the blank/default/null HTML donors. Other parent intake callbacks deliberately retain the child as an element and inspect props. Neither is proof of equivalent child execution. They were not used for acceptance.

Live source callers remain: `ScanFlow` renders unknown flow at1143, submits category plus identifier at787 onward; `ScanSearchSheet` renders intake at853; `ScanFlow` enables/wires research intake at1222–1225 and its adapter posts name/category at860 onward. `/scan` passes props into ScanFlow at141. Discovery add sheet has a separate customized SearchSheet use at732 without these intake callback props. No owner retirement is inferred.

Current quality-node CI runs `npm run test:node` (`ci.yml`148–158), whose script includes both top-level `.test.tsx` files. The server-only preload only replaces the server-only marker; it does not manufacture rendered copy. Local history confirms bridge addition2a87014e and F17 repair255ffa87 with actual source/test diffs; ac021a5b added the intake test/owner, and current file history retains the separate generic/identified evolution. Task9 in `plans/scan-public-launch.md` expressly records signed-off one-tap copy and removal of brand/name fields.

## Source controls and minimum runtime proof

All 14 supplied mutants have unique actual-owner anchors, exact original/mutant hashes, complete syntactically valid TS/TSX, a uniquely selected retained keeper, and exact callback-scoped oracle text/line in both phases. All are source mutations, not harness substitutions. C1headline retains `Danke dir` so the prior bridge prefix check would not itself prove full-copy preservation. C3helper leaves the autofocus structure intact. C4's unconditional branch makes an empty alert at nullerror, directly reaching the transferred negative assertion.

Minimum **representative** set: four controls, one per accepted donor. This proves each transfer can detect a representative real-owner regression; it does not claim independent mutation coverage of every preserved clause.

| Control | Operator | First keeper frame transfer / cut | Message identity to require |
|---|---|---|---|
| C1-headline | match | unknown-flow test281 /273 | `The input did not match the regular expression` plus literal `/Danke dir – das ist neu für uns!/` |
| C2-input | deepStrictEqual | unknown-flow test285 /277 | `Expected values to be strictly deep-equal` plus the injected `audit field` in the compared value |
| C3-helper | match | intake-form test142 /130 | `The input did not match the regular expression` plus literal `/Tippe die Kategorie an – das reicht uns schon\./` |
| C4-alert | doesNotMatch | intake-form test146 /134 | `The input was expected to not match the regular expression` plus literal `/role="alert"/` |

The frozen descriptors specify operator, code and exact lines but **do not encode concrete message matchers**. Their prose says message verification is required. This is an operator-normalization prerequisite, not a preservation blocker. Main should encode these planned message identities without changing proposal assertions; actual Node output remains to be observed, and an unexpected message must fail closed rather than be retroactively accepted as any assertion failure. Require `ERR_ASSERTION`, intended operator, named selected keeper and its FIRST test-file stack frame at the stated line; finding a matching line later in a stack is insufficient. One selected clean pass → one intended fault → owned byte-exact restore → one clean pass. Import/setup/type failures, zero selection, skip/cancel/todo, timeout/signal/hang and unrelated assertions are not qualifying evidence.

Optional C2-brand and C3-retailer broaden proof to prohibited-step markup and retailer-word absence. They are not needed to claim the minimum representative set, but all14 may be run if main retains the original packet's broader plan. Do not characterize four or six runs as fourteen independently demonstrated clause mutations.

## Read limits and artifacts

Full semantic reads: both original tests (723 lines including all helpers, callbacks and literal rows), unknown owner200, search-sheet owner1065, product-thumb70, category-copy137, verdict-labels169, cn6; complete diffs and candidate donor/keeper bytes verified against parsed originals. Installed dependency slices: React268–464,515–530,774–789 (element/Children/dispatcher); ReactDOM server.node selector full and legacy development1155–1182,5042–5076,9850–9878 (SSR ref/autofocus/component entry); Lucide CJS1–123 (operative icon construction). Contracts1–145 contains the actual category array. Current caller slices: ScanFlow787–915,1130–1165,1178–1230; scan-page125–150; Discovery add720–756; relevant cross-layer copy body and caveat1720–1910. CI/script/preload/plan slices and bounded history described above. Hashing all25 readset files is not a claim to have semantically read their entire contents. No exhaustive dependency closure, production-mode vendor implementation, browser journey, live optimizer/network, API/DB behavior or broader scanner audit is claimed.

Only fresh `/tmp` files written:
- `/tmp/test-audit-scanner-intake26-independent-check.cjs`: readable static checker; no test/product imports or child spawning.
- `/tmp/test-audit-scanner-intake26-independent-static.json`: independent phase counts, exact bodies/call maps, unchanged checks, artifact/readset pins and control pins.
- This report.

Checker completed successfully. No repository writes, owner/test imports, test/fault runs, browser/network/provider/DB operations, or proposal repins occurred. The checker starts zero children. Runtime fault acceptance and campaign coverage validation belong to main.
