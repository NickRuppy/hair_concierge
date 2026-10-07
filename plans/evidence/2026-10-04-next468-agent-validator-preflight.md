# Independent preflight: Agent context7 and validator192 prepared batches

Read-only review on 2026-10-04. Repository files were not written and no runner, compiler, provider, DB, or mutation control was executed.

## Verdict

**No blocking issue found.** The seven context candidates and all six validator candidates have a supported same-owner assertion union, subject to their existing hash/AST/control gates. This report initially held context D3; the corrected reassessment below withdraws that hold after tracing the schema parse in the actual runtime keeper.

## Reassessment of context D3 (hold withdrawn)

- The donor at `tests/agent-v2-contracts.spec.ts:255` directly parses a `product_assessment` / `fit` answer containing one nonempty assessed ID, a string answer, null pending action, and empty memory writes.
- The runtime keeper at `tests/agent-v2-responses-runtime.spec.ts:2192` submits that same discriminated payload family twice through the real `submit_final_answer` provider-tool path. `runAgentV2ResponsesTurn` calls `validateAgentV2FinalAnswer(terminal.value, ...)` at `src/lib/agent-v2/runtime/responses-agent.ts:646`; its first operation is `AgentV2TerminalAnswerSchema.safeParse` at `src/lib/agent-v2/validation/final-answer-validator.ts:90-106`.
- The first runtime payload reaches a `product_assessment_grounding` finding, not `terminal_schema`; therefore its `product_assessment`/`fit` schema branch has already parsed. The repaired terminal reaches a final `product_assessment` with `failure_stage === null`. A break in assessment discriminator, `fit` enum, one-ID minimum/maximum, answer string, null pending action, or memory array would instead stop at schema admission and could not yield the asserted grounding error/final success. The product schema defines precisely those payload constraints in `src/lib/agent-v2/contracts.ts:305-325`; the terminal union selects it at `:388-396`.
- Donor-only value differences are not additional schema branches: shampoo versus conditioner uses the same care-category enum; `exact/1` versus `none/null` follows the same request-interpretation schema members; confidence remains an in-range number; IDs and prose are unrestricted nonempty strings. Existing contract tests retain the negative multi-product assessment constraint immediately after the donor (`tests/agent-v2-contracts.spec.ts:283`).
- Main's planned reject-fit control at the runtime keeper is the appropriate final sensitivity proof. No new input or duplicate direct-schema callback is needed.

## Verified-clean candidate unions

### Agent context

- C1/C2/C4: `tests/chat-product-mentions.test.tsx` transfers are into the same rendered `ProductIntakeCard` state. The proposed diff adds the donor status/copy/control assertions to persisted-pending (`:677`) and approved (`:701`) renderers, and serializes the same initial default offer in the existing submit-lifecycle keeper (`:451`). `src/components/chat/product-intake-card.tsx:ProductIntakeSubmittedState` is the direct owner. The prepared controls target the transferred status/copy/forbidden controls, not fixture bookkeeping.
- C3: transfer of missing-image assertion into the existing `ChatMessage` structured selection renderer uses the same `createProductLookupClarification` candidate and parent renderer; the diff adds only `doesNotMatch(<img>)`. It remains a real output assertion.
- D1: `isPendingRoutineMutation` reads only `action?.kind`; the retained policy test exercises both routine-mutation and nonmutation kind projections through the actual policy. No omitted field is read by the helper.
- D2: both messages enter the positive direct-object guard in `src/lib/agent-v2/runtime/product-tool-context.ts`; the named-object/referential keeper also covers the donor’s no-rewrite outcome.

### Validator192

- D1: donor’s exact `baseAnswer/baseValidationContext` call is already the first call of keeper `:6161`; transferring/retaining `one.ok === true` observes absence of every blocker, including `product_lookup_required`.
- C1: keeper `:2315` keeps the donor’s same exact shampoo result/call and adds an unrelated conditioner `not_found`. `validateProductLookupResultClaims` filters different-category unresolved result for a `specific_products` answer (`src/lib/agent-v2/validation/final-answer-validator.ts:2160-2188`). The planned `ok` transfer is needed and its source fault targets exact-result classification.
- D2: keeper `:2642` has the same alternatives answer/context as donor `:2553` plus an unknown hard-rule ID. `applyValidatorDietPolicy` only softens when **every** blocker is one of three metadata findings (`:230-283`); lookup failure is not softenable. The keeper’s `ok` and hard-rule warning therefore retain the lookup exemption.
- D3: keeper `:3500` is a valid same semantic post-sanitization check. `sanitizeHiddenPendingFollowupAction` parses an identical answer with `pending_followup_action: null` and recollects findings (`:308-337`); the keeper asserts `ok`, null sanitized action, zero errors, and the sanitizer warning. Its planned fault changes `hasConfirmableOffer` gating and is specific to this revalidation.
- D4: strengthened keeper `:5764` observes the omitted `Second Shampoo` name through `validateVisiblePayloadRendered`; planned fault targets the `unrenderedProductNames` branch. It is a specific output fault, not a generic process failure.
- D5: the retained base call in `:6161` has one named product and natural non-property prose. Its planned fault targets `validateProductAnswerShape`; this catches broad positive-prose overblocking. The donor's alternate wording adds no separately-read feature.
- Soft-warning/evidence sanitization remains independently retained at `tests/agent-v2-final-answer-validator.spec.ts:5544` and `:5593`. `sanitizeHarmlessEvidenceQuote` requires normal safety mode, no tools or IDs, no specific product candidate, no product/routine mode (`final-answer-validator.ts:420-464`), and `sanitizeRepairableEvidenceQuote` is only attempted under those constraints. Nothing proposed removes those assertions.

## Execution-path and CI checks

`src/app/api/chat/route.ts` reaches `src/lib/agent-v2/production/chat-pipeline.ts:1312`, which calls `runAgentV2ResponsesTurn`; terminal admission is enforced in `src/lib/agent-v2/runtime/responses-agent.ts:646` through the validator above. `package.json:68` and `.github/workflows/ci.yml:164` run the validator file under `test:agent`.

The context suite additionally includes `.spec` files that are not named by `test:agent` (as the supplied handback notes); integration must run the prepared focused native commands for those files. This is a validation-scope caveat, not a deletion objection.

## Limits

I read the supplied candidate bodies, transfer/cut diffs and controls, the named owner functions, runtime admission path, selected full keeper/donor ranges, and current package/CI declarations. I did not run controls or tests, parse prospective edits, inspect unrelated callbacks, or certify any stale staging hash after main integration.
