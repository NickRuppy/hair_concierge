# Offer / result CTA negative-layer review

Both complete candidate files were read. D=2, C=0, R=1.

| Disposition | Declaration | Evidence |
|---|---|---|
| D | `tests/offer-experiment.test.ts:8` `the retired guided-story experiment has no active assignment or runtime flag` | Only reads `flags.ts`/`server.ts` and asserts three absent identifiers. History shows rollout `3ada31e1` and attribution work `117ea376`; there is no current assignment/runtime consumer. It fails under harmless renaming or source movement and has no public/protocol byte authority. Delete the declaration and its `readFileSync` sources/import if then unused. |
| R | `tests/quiz-result-cta.test.ts:7` `the result CTA sends the reader into routine setup` | Directly owns current exported CTA copy consumed by `quiz-results.tsx` and `app/result/[leadId]/result-client.tsx`; keep as the positive user-facing copy contract. |
| D | `tests/quiz-result-cta.test.ts:13` `the retired three-step unlock CTA is gone, not merely unreachable` | Four source-string/non-branch greps (`PLAN FREISCHALTEN`, three-step copy, `canGoStraightToRoutine`) against a single constant module. History `89d6c9ae` and `2ae521b5` document retirement; current result routing/CTA consumers only import `QUIZ_RESULT_CTA`. The positive `:7` keeps the active CTA. Delete declaration plus now-unused `readFileSync` import. |

No source closure beyond the two test-only `readFileSync` imports. Native validation after edit: `node --import ./tests/server-only-register.cjs --import tsx --test tests/offer-experiment.test.ts tests/quiz-result-cta.test.ts`.
