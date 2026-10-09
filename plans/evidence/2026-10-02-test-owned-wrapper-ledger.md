# Test-only wrapper semantic ledger — read-only

Scope: `codex/test-audit-pruning`, current deployed reference `3abfe00a`.
Classification keys: **R** = keeper already at a live owner boundary; **retarget** = preserve the live invariant but call the real production owner; **C** = delete the named test-only source wrapper; **D** = delete the wrapper-only assertion/test. No tests or providers were run.

## AST inventory

TypeScript AST parse found exactly **8 `FunctionDeclaration`s** (one declaration per supplied candidate, no overload/alias declarations):

| Source declaration                                                | Exact AST title                                                    | Test-only refs | Decision                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | -------------: | ------------------------------------------------------------------------------- |
| `src/components/personal-plan-refinement/refinement-flow.tsx:140` | `FunctionDeclaration deriveRefinementEntryMode`                    |              3 | C; D direct assertions                                                          |
| `src/components/personal-plan-start/plan-start-flow.tsx:268`      | `FunctionDeclaration planStartSuppressesChapterCeremony`           |             15 | C; D direct assertions                                                          |
| `src/lib/personal-plan/refinement/answer-provenance.ts:78`        | `FunctionDeclaration effectiveAnsweredQuestionIds`                 |              6 | C; D two identity assertions                                                    |
| `src/lib/personal-plan/direct-acceptance/defaults.ts:59`          | `FunctionDeclaration directAcceptanceAssumptions`                  |              4 | C; D three label/list tests                                                     |
| `src/lib/personal-plan/types.ts:547`                              | `FunctionDeclaration canonicalizeInitialSnapshotPayload`           |              5 | C; D types unit test; retarget compute determinism test                         |
| `src/lib/recommendation-engine/chat.ts:290`                       | `FunctionDeclaration getShampooProfileCompleteness`                |              3 | C; retarget/drop score assertions, R missing-field behavior                     |
| `src/lib/tracking/types.ts:40`                                    | `FunctionDeclaration hasValidTrackerDayTypeDetails`                |              6 | C; retarget custom-name assertion to `isValidCustomActivityName`                |
| `src/lib/chat/product-lookup-selection-ui.ts:171`                 | `FunctionDeclaration findResolvedProductLookupSelectionForMessage` |              2 | C; retarget selection test to `buildProductLookupClarificationStateByMessageId` |

## Semantic/caller ledger

### deriveRefinementEntryMode — C + D; R existing rendered-flow proof

The wrapper is a one-line forwarding export to `deriveStage2EntryMode` (`refinement-flow.tsx:140-144`). It has no non-test caller in the worktree or `3abfe00a`. The actual production owner is `deriveStage2EntryMode` (`src/lib/personal-plan/refinement/module-scope.ts:221-224`), called by the live initial-view resolver at `module-scope.ts:204-213`, which `RefinementFlow` consumes. Delete the wrapper and its three direct assertions in `tests/personal-plan-start-resume.test.tsx:412-421`; retain the same file's first-paint/refinement flow render test (`:424+`) as the stronger owner-path protection. History: introduced/reworked by `1d105a84` / `822a547c` during retired chapter removal.

### planStartSuppressesChapterCeremony — C + D; R integrated module-entry render

This is only `isExplicitModuleRefinementEntry(initialJourney)` (`plan-start-flow.tsx:268-272`) and has no production caller in current or `3abfe00a`; the ceremony it describes was removed in `1d105a84`. Delete its import and all direct predicate assertions in `tests/personal-plan-module1-stage3-resume.test.tsx` and `tests/personal-plan-stage2-module-entry.test.tsx` (including the standalone `:1177-1198` test). Keep the integrated explicit-module journey resolution/render proof at `tests/personal-plan-stage2-module-entry.test.tsx:479-522`, notably `doesNotMatch(/Stufen im Personal Plan/)`, plus owner path `stage2ModuleCompletionRoutingProps` (`plan-start-flow.tsx:241-248`) that is spread into the live flow.

### effectiveAnsweredQuestionIds — C + D

This copies its array argument (`answer-provenance.ts:78-82`) and has no caller outside its two test cases. It cannot observe provenance and does not protect the real split: `userAnsweredQuestionIds` is consumed by production module-status, Stage-2 persistence, and scan context (`module-status.ts:41-50`, `stage2-refinement-service.ts:303-310`, `scanner-context.ts:500-524`). Delete the function and `tests/personal-plan/refinement/answer-provenance.test.ts:126-137`; retain the surrounding user/assumed/legacy-provenance cases.

### directAcceptanceAssumptions — C + D

Its own comment states no surface renders the German display rows (`defaults.ts:54-58`); current and `3abfe00a` have no production caller. Delete it and the three label/membership test blocks at `tests/personal-plan-direct-acceptance.test.ts:206-255`. R: retain the defaults-to-real-refinement computation/role tests in that suite and the live `buildDirectAcceptanceStage2Defaults` consumer at `direct-acceptance/accept.ts:384-388`. Operator/planning reference `plans/feinschliff-einstieg.md:32` is stale after deletion and should be removed/updated in the integrating edit.

### canonicalizeInitialSnapshotPayload — C; D one unit test; retarget one live invariant

The wrapper only returns `{ ...snapshot, createdAt: undefined }` (`types.ts:547-549`); it has no production caller in current or `3abfe00a`. Delete source and `tests/personal-plan/types.test.ts:41-62`. Retarget `tests/personal-plan/compute-stage1.test.ts:46-62` to destructure/omit `createdAt` locally when comparing two actual `computeNeedPlan` results; this preserves the useful output-level determinism invariant without a production export. Its history is Stage-1 compute (`6b911e52`).

### getShampooProfileCompleteness — C; retarget/R missing-data behavior

This unused score projection derives solely from live `getShampooMissingProfileFields` (`chat.ts:290-304`). Delete the score helper and its score-object assertions at `tests/recommendation-engine-chat.test.ts:54-58,69-73`; retain the adjacent missing-field assertions (`:53`, `:68`). That lower-level function is used by live chat clarification construction (`chat.ts:101-106,363-365`) and agent product selection (`src/lib/agent/tools/select-products.ts:2105-2107`). The score function persists only as a stale April boundary-extraction plan mention (`docs/superpowers/plans/2026-04-12-phase1-boundary-extraction.md:263`), which should be corrected if this source is removed.

### hasValidTrackerDayTypeDetails — C; retarget/R custom-name validation

The wrapper (`tracking/types.ts:40-46`) has no production caller in current or `3abfe00a`. The real live UI invariant is custom-name validity: `TrackerPageClient` gates autosave, close, and done on `isValidCustomActivityName` at `src/components/tracker/tracker-page-client.tsx:209-214,294-327,459`. Delete wrapper and the non-custom-extra-name assertions in `tests/tracker-trust-gate.test.ts:71-81`; retarget the custom whitespace/trim behavior to `isValidCustomActivityName` (and retain normalizer assertions) if the test remains. Keep the independent trust-gate exclusion proof at `:84-97`, backed by production `getTrustGateQualifyingLogDates` and `tracking-insights.ts:52-55`.

### findResolvedProductLookupSelectionForMessage — C; retarget/R ChatContainer state map

This function only allocates a filtered map and reads one key (`product-lookup-selection-ui.ts:171-176`); neither it nor the intermediate `buildResolvedProductLookupSelectionByMessageId` has a production caller. The real UI calls `buildProductLookupClarificationStateByMessageId(messages)` in `src/components/chat/chat-container.tsx:92-95` and passes the per-message state to `ChatMessage` at `:775-784`. Delete the wrapper; retarget `tests/chat-product-mentions.test.tsx:332-372` to obtain `resolvedSelection` from the live state map (`.get(clarificationMessage.id)?.resolvedSelection`) before rendering the card. That preserves the selection-lock user invariant and detects a reverse-scan/candidate-ID regression. History: product-intake consolidation `b4fb21f4`.

## Reachability and documentation conclusion

`git grep` against `3abfe00a` and the current tree found no non-test code callers for any of the eight exact wrapper symbols. The `3abfe00a` object contains the same eight wrapper declarations and only the listed tests/docs references. Current branch `codex/test-audit-pruning` is behind `main` by one commit, so the deployed-reference inspection is an object-level reachability check, not an ancestry claim. No framework default export or fixture-reset helper appears in the candidate set.
