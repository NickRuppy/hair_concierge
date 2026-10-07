# Scanner intake UI26 semantic ledger

26 registrations in two files:21R,1heldF,4conditionalC,0D. Full assertion/call AST bodies in complete-ledger.json; no runtime or mutation executed.

### 1. R — dm thumbnail: a failed optimizer image becomes the accessible placeholder

`tests/scan-unknown-flow-ui.test.tsx:140`

Contract: Actual ScanProductThumb proxied image onError changes same-image state to accessible fallback role/img and label.

Detectable regression: Remove onError state update or fallback aria-label.

Owner: `src/components/scan/scan-product-thumb.tsx:31-69`. Direct callback test; no network or real optimizer failure proved.

### 2. R — identified unknown: renders identity and one-tap confirmation without creating a submission on view

`tests/scan-unknown-flow-ui.test.tsx:155`

Contract: Identified shampoo default copy, brand case conversion, absent generic grid, no submission on view, exact category plus one_tap on confirmation.

Detectable regression: Submit eagerly, show generic copy, or emit grid/incorrect category.

Owner: `src/components/scan/scan-unknown-flow.tsx:62-145`. Live identified branch differs from generic donor inputs.

### 3. R — identified unknown: other reveals grid without submitting, then allows a category override

`tests/scan-unknown-flow-ui.test.tsx:175`

Contract: Other reveals generic grid without submitting, removes primary suggestion, override conditioner emits grid.

Detectable regression: Submit while expanding, retain shampoo suggestion or send prior suggestion.

Owner: `src/components/scan/scan-unknown-flow.tsx:63-78,138-144`. State transition and override retained.

### 4. R — identified unknown: expanding alternative categories also excludes a secondary suggestion

`tests/scan-unknown-flow-ui.test.tsx:200`

Contract: Secondary heat-protectant suggestion also excluded after two expansions; scalp-care tap emits grid.

Detectable regression: Filter only primary suggestions or fail secondary expansion.

Owner: `src/components/scan/scan-unknown-flow.tsx:65-70,175-184`. Different category/expanded-state branch.

### 5. R — identified unknown: ambiguous category uses the normal grid and mixed-case brand stays unchanged

`tests/scan-unknown-flow-ui.test.tsx:229`

Contract: Null suggestion enters grid, mixed-case brand unchanged, confirmation controls absent and Shampoo present.

Detectable regression: Treat null as suggestion or force title case on mixed-case brand.

Owner: `src/components/scan/scan-unknown-flow.tsx:63-64;src/lib/scan/verdict-labels.ts:86-91`. Not equivalent to uppercase positive identified fixture.

### 6. R — identified unknown: failed confirmation restores its label and keeps recovery available

`tests/scan-unknown-flow-ui.test.tsx:242`

Contract: One confirmation callback before pending; pending direct callback blocked and alternate control disabled; failed prop state restores enabled label and alert.

Detectable regression: Remove submitting guard or fail label/disabled/error reset.

Owner: `src/components/scan/scan-unknown-flow.tsx:72-79,128-145,193-197`. Does not prove actual network, retry response or browser focus.

### 7. C — ScanUnknownFlow: renders the signed-off headline and question verbatim

`tests/scan-unknown-flow-ui.test.tsx:265`

Contract: Exact signed-off generic headline, subline and question.

Detectable regression: Change any complete literal while preserving bridge order prefixes.

Owner: `src/lib/scan/verdict-labels.ts:69-77;src/components/scan/scan-unknown-flow.tsx:104-124`. C1 into existing identical bridge render; three assertions verbatim.

### 8. R — ScanUnknownFlow: the bridge line sits under the headline, above the subline

`tests/scan-unknown-flow-ui.test.tsx:278`

Contract: Complete bridge copy and headline→bridge→subline order.

Detectable regression: Drop or move bridge relative to existing text.

Owner: `src/components/scan/scan-unknown-flow.tsx:104-118`. Canonical generic initial-render keeper, absorbs C1/C2.

### 9. C — ScanUnknownFlow: renders no brand or product-name inputs (step 2 is gone)

`tests/scan-unknown-flow-ui.test.tsx:289`

Contract: No input elements, no Marke, Produktname or submit-step CTA in generic one-tap branch.

Detectable regression: Reintroduce a field or textual second-step affordance.

Owner: `src/components/scan/scan-unknown-flow.tsx:81-200`. C2 into identical bridge tree/markup; no new product call.

### 10. R — ScanUnknownFlow: tapping a category card submits exactly { category } once, no Absenden step

`tests/scan-unknown-flow-ui.test.tsx:299`

Contract: Enabled shampoo card emits one category-only payload and no Weiter control.

Detectable regression: Require second step, send wrong shape/category or leave card disabled.

Owner: `src/components/scan/scan-unknown-flow.tsx:72-79,149-174`. Callback/event distinct from static copies; no inferred exactly-once network.

### 11. R — ScanUnknownFlow: cards are disabled while submitting and a second tap does not resubmit

`tests/scan-unknown-flow-ui.test.tsx:319`

Contract: Pending conditioner card DOM disabled plus direct duplicate taps suppressed and expander disabled.

Detectable regression: Remove DOM disabled or handleTap submitting guard.

Owner: `src/components/scan/scan-unknown-flow.tsx:76,159,179`. Independent DOM attribute and event-handler guard.

### 12. R — ScanUnknownFlow: the tapped card alone shows the submitting label while others stay put

`tests/scan-unknown-flow-ui.test.tsx:346`

Contract: After mask tap plus parent pending, exactly one submitting card, no mask label and other four labels retained.

Detectable regression: Relabel all cards or lose selected-card state across rerender.

Owner: `src/components/scan/scan-unknown-flow.tsx:60,149-174`. Different transition from failed oil-reset regression.

### 13. R — ScanUnknownFlow: a failed submission clears the in-flight highlight next to the error (F17)

`tests/scan-unknown-flow-ui.test.tsx:381`

Contract: Oil pending then failure clears loading text, restores error, aria-pressed false and no selected plum style.

Detectable regression: Use tappedCategory without submitting in isTapped.

Owner: `src/components/scan/scan-unknown-flow.tsx:149-174`. Historical F17 regression from255ffa87; retain actual stateful test.

### 14. C — ScanResearchIntakeForm: renders the signed-off heading copy, Marke/Produktname fields, and the category helper

`tests/scan-research-intake-form-ui.test.tsx:124`

Contract: Body labels, category question/helper, back text and no standalone retailer dm.

Detectable regression: Change a rendered body literal or leak retailer brand.

Owner: `src/components/scan/scan-search-sheet.tsx:92-103,190-278`. C3 into identical empty/default autofocus tree/markup; title heading belongs to parent, no new heading claim.

### 15. R — ScanResearchIntakeForm: entering the intake state moves focus to the Marke field (task 6 a11y)

`tests/scan-research-intake-form-ui.test.tsx:136`

Contract: SSR autofocus present; Marke input alone receives autoFocus true, Produktname does not.

Detectable regression: Remove or move declarative autoFocus.

Owner: `src/components/scan/scan-search-sheet.tsx:202-233`. Structural focus contract; no browser commit, DOM focus or ref focus proved. Keeper absorbs C3/C4.

### 16. R — ScanResearchIntakeForm: a category tap is blocked while Marke is empty, even with a filled Produktname

`tests/scan-research-intake-form-ui.test.tsx:151`

Contract: Empty brand with filled product prevents category callback.

Detectable regression: Remove brandValid guard.

Owner: `src/components/scan/scan-search-sheet.tsx:165-180`. Refs remain null; focus redirection is not asserted.

### 17. R — ScanResearchIntakeForm: a category tap is blocked while Produktname is empty, even with a filled Marke

`tests/scan-research-intake-form-ui.test.tsx:162`

Contract: Empty product with filled brand prevents category callback.

Detectable regression: Remove productNameValid guard.

Owner: `src/components/scan/scan-search-sheet.tsx:166-184`. Different short-circuit branch; refs null no focus proof.

### 18. R — ScanResearchIntakeForm: a category tap submits exactly the tapped category once both fields are filled

`tests/scan-research-intake-form-ui.test.tsx:173`

Contract: Filled exact brand/product permit conditioner callback once.

Detectable regression: Always deny or send wrong category.

Owner: `src/components/scan/scan-search-sheet.tsx:176-187`. Distinct positive validation boundary.

### 19. R — ScanResearchIntakeForm: whitespace-only text still counts as empty (blocks submit)

`tests/scan-research-intake-form-ui.test.tsx:184`

Contract: Both whitespace-only fields block submit.

Detectable regression: Accept raw nonempty whitespace in both validation guards.

Owner: `src/components/scan/scan-search-sheet.tsx:165-166`. Does not independently detect only one removed trim; retains existing input.

### 20. R — ScanResearchIntakeForm: edits call onBrandTextChange/onProductNameTextChange with the raw typed value

`tests/scan-research-intake-form-ui.test.tsx:195`

Contract: Exactly two inputs forward raw typed brand/name to corresponding controlled callbacks.

Detectable regression: Swap callbacks, trim/transform value or omit an input.

Owner: `src/components/scan/scan-search-sheet.tsx:206-230`. Direct onChange calls; no DOM input-event claim.

### 21. R — ScanResearchIntakeForm: shows the five primary categories only, with a 'Mehr …' expander for the rest

`tests/scan-research-intake-form-ui.test.tsx:211`

Contract: Five primary controls initially visible, heat absent; expander reveals all five secondary controls.

Detectable regression: Omit primary/secondary category or break expansion state.

Owner: `src/components/scan/scan-search-sheet.tsx:169-174,265-274`. Shared CATEGORY_COPY used only for labels; independent explicit keys cover visibility.

### 22. F — ScanResearchIntakeForm: the tapped card alone shows the submitting label while others and the back affordance disable

`tests/scan-research-intake-form-ui.test.tsx:237`

Contract: Mask selection then pending shows one busy label, removes mask label, keeps Shampoo label and disables back.

Detectable regression: Lose tapped state/selected label or back disabled; other cards disabled attribute can regress undetected.

Owner: `src/components/scan/scan-search-sheet.tsx:195,243-260`. Held unchanged: title promises other controls disable but never asserts their disabled attributes; no F repair/deletion credit.

### 23. R — ScanResearchIntakeForm: a second tap while submitting does not resubmit

`tests/scan-research-intake-form-ui.test.tsx:270`

Contract: Filled-form direct duplicate category taps while submitting emit no callbacks.

Detectable regression: Remove handleTap submitting guard.

Owner: `src/components/scan/scan-search-sheet.tsx:177`. Independent from pending presentation and DOM disabled attribute.

### 24. R — ScanResearchIntakeForm: onBack fires exactly on the back affordance

`tests/scan-research-intake-form-ui.test.tsx:283`

Contract: Back affordance exists and invokes onBack once.

Detectable regression: Omit or disconnect back action.

Owner: `src/components/scan/scan-search-sheet.tsx:192-199`. Does not assert back is blocked during pending; other test covers back disabled.

### 25. R — ScanResearchIntakeForm: renders the standard error copy inside an alert role with a polite live region (task 6 a11y)

`tests/scan-research-intake-form-ui.test.tsx:295`

Contract: Supplied error renders escaped standard copy, alert role and polite live region.

Detectable regression: Drop alert/live attr or error content.

Owner: `src/components/scan/scan-search-sheet.tsx:282-285`. Non-null error branch retained; differs from empty donor/keeper.

### 26. C — ScanResearchIntakeForm: no error renders no alert

`tests/scan-research-intake-form-ui.test.tsx:306`

Contract: Null/default error renders no alert.

Detectable regression: Render error container unconditionally.

Owner: `src/components/scan/scan-search-sheet.tsx:282-285`. C4 into existing default-null autofocus markup; eliminates redundant SSR call only.
