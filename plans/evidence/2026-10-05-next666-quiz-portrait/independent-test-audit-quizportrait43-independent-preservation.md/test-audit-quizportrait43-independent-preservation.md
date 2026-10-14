# Independent preservation review: quiz portrait43

**CONDITIONAL PASS for C1; no blocking semantic gap found.** This is a static preservation verdict, not runtime acceptance or removal credit. Main must establish clean transfer/cut execution and the three intended assertion failures. No repository edits, owner imports, tests, browser, native image decoding, mutation execution, provider or database work occurred in this review.

Frozen packet: `/tmp/test-audit-quiz-portrait43-ygKLUS`. Manifest SHA256 `e8b4b24f8006005cee2ef25496b2ed9f8a78f171bf50883fd2fb84f765b1cff7`; HANDOFF SHA256 `6ebe6bf1eca77f494bba1879bca98caa206f6fbd47854d02b04fd0a36eb59ffe`. Original 82 readset hashes all matched their frozen snapshots and current files during the independent check. No drift was adopted or silently repinned.

## C1: complete assertion union and consumed inputs

Donor: `tests/hair-length-option-card.test.tsx:24`, “shared hair-length card keeps the complete decorative portrait composition inside one fixed media frame.” Keeper: `tests/quiz-option-card.test.tsx:70`, “grid portrait cards fit the complete silhouette to the fixed media height.” Both complete callbacks and their fixtures were read. The donor calls React SSR on the actual shared card; the keeper calls React SSR on the actual wrapper, which reaches that same card and figure. Neither is a manually expanded or mocked React tree.

`src/components/quiz/quiz-option-card.tsx:85–106` enters grid/portrait and passes the existing label, description, config, disabled state, selected state and default priority to `HairLengthOptionCard`, fixing selectionVariant to regular. `hair-length-option-card.tsx:59–145` uses no texture-dependent class, accessibility, selection or frame predicate. Both cases have label “Sehr lang”, description “Taille oder länger.”, false selected state, unspecified disabled/ariaLabel, and default false priority. The wrapper adds an animation div and consumes two IDs; the donor never asserted their values or an outer root topology. There is no second described button in this branch that could satisfy the transferred association assertion.

The actual config difference is coily/coily versus wavy/wavy. Length very_long, density medium, treatment none and personalized kind are identical. `hair-portrait-assets.ts` maps each texture to a different real filename and marker values; both very-long records have ownBody=false. `HairPortraitFigure:27–63` consumes src and ownBody only. Marker coordinates are not read by this figure. Thus the observed body/image topology, dimensions, decorative attributes and selection are the same current operative branch. This is not a claim that the two full HTML strings or raster images are equal.

All ten donor assertions remain at the keeper:

| Donor observation | Preservation |
|---|---|
| Combined hair-length-card=true and selection-variant=regular bytes | Added verbatim, keeper line103 |
| 184px outer frame | Added verbatim,104 |
| 140px media frame | Added verbatim,105 |
| max-height700px responsive152px frame | Added verbatim,106 |
| data-hair-portrait-media=true | Existing keeper assertion |
| Exact flex/h-full/w-full/center/scale0.9 composition and art marker | Existing keeper assertion |
| SVG aria-hidden=true | Added verbatim,107 |
| img alt empty | Added verbatim,108 |
| aria-pressed=false | Added verbatim,109 |
| Nonempty aria-describedby | Added verbatim,110 |

All six original keeper assertions also remain. There are eight added assertion calls, no newly added render, input, callback invocation, table row or fixture. The stronger image-specific `<img alt=""` check is preserved even though the keeper already had a broader empty-alt check. No duplicated identical assertion was added.

The rejected reason to retain this donor is texture wording alone: no donor oracle identifies coily pixels or its URL. Independently retained asset tests still assert every 4×5 exact filename, exact ownBody exceptions (only straight/wavy/curly very-short), physical inventory, and every marker record. The physical length-progression test still measures all20 real assets. The direct very-short own-body figure test remains because it exercises the opposite figure branch. The Personal Plan selected-variant test remains because it exercises another selection variant and state. History #483 describes a shared full-card/fixed-frame fix across both quizzes, while #284 records canonical texture raster calibration; this proposal preserves the latter rather than treating all texture observations as interchangeable.

## Static snapshot and count verification

The independent checker reconstructs the entire transfer file by replacing only the old keeper callback with its frozen after body. It reconstructs the donor cut by removing only that exact callback. All other bytes, including imports, fixtures, whitespace outside that deletion, and seven wholly unchanged files, remain equal to the appropriate phase. All41 unrelated callbacks are byte-identical in both transfer and cut. The two held F callbacks are among those41.

Nine full suites: hair-length-option-card3; hair-portrait-assets5; hair-portrait-gallery2; hair-portrait-length-progression1; hair-portrait12; portrait-config6; quiz-option-card9; quiz-motion-tokens3 declaration sites; personal-plan-option-card-layout2. Counts are43→43→42 AST; the four literal source-path loop registrations in motion make46→46→45 prospective native registrations. This is static registration expansion, not observed runtime execution. Callback assertion sites189→197→187: original donor10 is removed only after its full union is retained. Classification40R/2heldF/1C remains a proposal classification; no source seam or export is removed.

528 independent checks pass: packet artifact hashes;82 frozen/current readset hashes;27 phase hashes and TS/TSX parses; exact callback bodies/hashes; assertion union; original non-assert keeper call tree equality; phase reconstruction; unrelated callback preservation; full-source mutation hashes and unique anchors; selected title cardinality and intended line/text pins. The checker reads only builtins and the TypeScript parser. It has zero filesystem writes and zero child-process calls; stdout was saved separately to the independent JSON receipt. The first draft checker incorrectly required an `as const` suffix on the existing literal motion array; that checker-only assumption was corrected without touching any proposal file. Final receipt is PASS.

## Three actual-owner fault recipes: static assessment

All three source replacements are unique, reconstruct their frozen complete mutant files byte-for-byte, and parse as TSX. They select exactly one existing keeper by anchored title in its one native test file. No owner code was executed by this review.

1. **Fixed frame** changes both h-[184px] and sm:min-h-[184px] to183 in the shared card. Both substitutions are necessary because the donor/keeper regex also matches the suffix of min-h. Earlier keeper media/art/object-contain assertions do not inspect that height. The first intended transferred failure is `assert.match(html, /h-\[184px\]/)` at104, operator match. The full HTML must actually contain183 and lack184; a setup failure is not proof.
2. **Description association** changes the real card aria-describedby binding to undefined while leaving the nonempty description rendered. There is only this button in the portrait delegate path; the wrapper emits no association. Earlier added state/decorative/layout assertions should remain true. First intended match failure is110. This tests attribute presence, as the original did; it does not newly prove exact label-ID matching or browser accessibility behavior.
3. **Decorative body** changes the figure's sole aria-hidden=true SVG prop to false. Both source configs select ownBody=false. The selection-indicator SVG is inside an aria-hidden span but has no aria-hidden attribute itself, so it cannot accidentally satisfy `<svg aria-hidden="true"`. First intended match failure is107. This is genuine rendered source sensitivity, not a manufactured expected-output fixture.

The expected RegExp serializes as an empty object in Node diagnostics; compare the decoded literal message/header plus ERR_ASSERTION, operator match, actual HTML predicate, and FIRST keeper assertion stack frame. Line104/110/107 and exact assertion text match both frozen transfer and cut phases. These are three representative contract controls, not an exhaustive fault proof of all ten donor assertions. Actual clean1→intended red1→byte-restored clean1 remains main-owned.

## Retained contracts and held findings

All43 original callbacks and their support/table bodies were read, including the 60 config combinations, asset20 matrix, physical geometry ladder, all fallback transitions and the motion registration loop. The retained tests still distinguish config validation/treatments, selected asset versus generic fallback, own-body versus shared body, stale/duplicate image failures, terminal hidden state, source URL origin/path checks, marker accessibility/percentages, legacy labels, row/grid/thumbnail/tool layouts, default/disabled animation and pending selection. Assertions are not promoted to mounted interaction proof: most UI tests are actual SSR, and fallback tests call the real state-transition owner directly.

F1 remains unchanged: the SingleSelect source grep can match a helper declaration even if Back ceases to call it. F2 remains unchanged: whole-card selected tint regex can match unconditional media tint. The live variant/pressed/size assertions in F2 are preserved. Neither finding was repaired or counted as a deletion.

## Reachability, history, dependencies and read limits

Fresh complete source reads for the proposed union: QuizOptionCard, HairLengthOptionCard, HairPortraitFigure, hair-portrait-assets, portrait-config, legacy-quiz-visuals, utils; also full HairPortrait and its gallery, QuizQuestion, portrait lab route/access helper. Direct caller search locates regular QuizQuestion via `getLegacyQuizOptionVisual`, Personal Plan OptionCard shared-card branch and midpoint figure, and multiple unrelated live QuizOptionCard consumers. Relevant Personal Plan OptionCard494–687 and midpoint1150–1200 were read, not the full3124-line component. No deletion or new-retirement conclusion is based on unrelated consumers.

Read all four frozen history excerpts (#483 shared card; #238 portrait/gallery introduction; #284 canonical calibration; #280 motion) and the complete proposal ledger/diff/control descriptors. CI quality-node runs package `test:node`, whose top-level ts/tsx globs include all nine suites. Read CI146–164/276–311 and package command routing. The optional browser smoke lane is not claimed as equivalent native proof.

Dependency reading was bounded: actual Next ImageElement135–205 forwarding alt/class/src, React server export routing and useId9722–9748, complete clsx and local cn. Full dependency files, TypeScript, binary WebPs, and other82-readset supports are byte-pinned, not claimed fully semantically audited or executed. All nine tests were fully read; no claim that every original readset owner, normalization rule, browser effect, renderer dependency or raster pixel was independently re-audited. The retained geometry suite and its Sharp path were inspected as test contracts, not run. History files are frozen local evidence; no new Git/provider requests were made. These limits do not weaken the C1 union, whose actual render chain was read in full.

No blocker or additional scope request. Conditional acceptance is limited to this one exact merge and frozen assertion union.
