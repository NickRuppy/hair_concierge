# Conversation and remaining leaf cutover

Status: applied; fifteen net declarations removed, bringing the total to 144 (11,892 → 11,748; 11,214 Node, 534 Playwright). Focused before/after: Node 127/127 → 123/123; Playwright contracts 29/29 → 18/18. Four deliberate owner mutations fail the intended keeper (asked-basics gate, positive pending answer, persisted primary-field omission and ordering); exact source bytes restored. Independent preservation review finds no gap. Typecheck passes. One new lint warning exposed an exclusive `uniqueLabels` callee; it was removed. Full proof/build/latest lint are pending. Original request
and production-reachability direction authorize removal of disconnected test-only
seams. Runtime behavior, operator capability, persisted compatibility and current
Compare/shadow implementations stay intact. No new consequential decision is open.

## Corrected layer and keepers

The read-only conversation ledger initially double-counted the test at :695 and
proposed whole-case deletion for four tests containing live predicate assertions.
Main rejects both errors. Fifteen unique original conversation declarations touch
the two orphan wrappers; four mixed declarations remain, and the unrelated-message
case at :394 is retargeted to the actual predicate. Only ten whole conversation
declarations are eligible, subject to before/after Playwright contract proof.

- Remove `applyConversationStateToClassification` and
  `computeConversationStateTransition`, then only their exclusive private helpers
  and imports. Production uses AgentV2 state; legacy Compare/shadow uses the distinct
  retained `resolveAgenticConversationStateTransition`. Keep normalization, storage
  and `shouldApplyPendingRoutineAnswerOverride` used by the shadow runner.
- Preserve :291 explicit-product/typo rejection, :329 stale assistant rejection,
  :362 answered-basics rejection and :426 stale-offer rejection. Remove disconnected
  classifier/transition portions only. In :426 use the exact resulting stale state
  as the predicate input rather than constructing it through the retired reducer.
- Retarget :394's three unrelated user messages to the actual predicate. Carry
  :230's positive short-answer input into the existing :264 predicate table. Delete
  only the remaining ten dead-wrapper cases (including shared :695 exactly once).
- Remove unused `projectAgenticToolLoopTraceForApp` and its exclusive summarization
  subtree, test fixture and one projection case. Preserve generic trace serialization,
  AgentV2 trace, sanitization and real legacy Compare traces. Historical plans naming
  the projection are superseded by the production switch, not operator entry points.
- Remove scalar lookup/precedence adapters
  `buildActiveResolvedProductContextFromLookup` and
  `buildNextActiveResolvedProductContext`, with two exclusive declarations. Preserve
  active stack builders/merge, trusted context conversion, production lookup outcomes
  and actual follow-up persistence proofs.
- Remove unused `summarizeAgentV2ConversationState` only. The mixed pipeline case
  remains and asserts the three-context cap **and actual normalized persisted
  `active_resolved_product_context.product_id`**, rather than a diagnostic summary.
  A deliberate mutation of that persisted derived field must fail this keeper.
- Remove unused loading-progress calculator and its one exclusive declaration;
  keep stage constants, real loading renderer/animation and public quiz flow.
- Remove orphan brand-conflict detector and its one exclusive declaration. Current
  `buildBrandResolutionCatalog` owns alias/canonical-brand/product-line conflict
  reporting and filtering, with existing independent cases at :113 and :182.
- Remove orphan field-test token comparator and nullable cockpit-copy wrapper.
  Their two mixed declarations remain. Retain token issuance/hash, campaign CLI,
  runtime resolver/cookie/auth/enabled/revoked/expired guards and actual non-null copy.
  No campaign command or provider operation is required.

Expected net: **15 declarations** (11 Playwright contract, four Node); recount with
the same syntax-tree inventory after edits. No declaration grouping is credited.
Source-only consolidations of consult lint/research readers are held separately;
the normative T20 function and all 16 corpus tests remain.

## Verification and review

1. Before edits, complete read-only Claude plan review and original focused runs:
   Node owner/sibling set plus the actual Playwright conversation/trace contract
   files under c8. These Playwright tests are pure contracts; no browser or provider
   fixture is used. Use a temporary equivalent contract config without dotenv to
   avoid loading credentials. Do not substitute Node coverage for Playwright proof.
2. Only after every runner has exited, apply the layer, format and inspect the
   complete diff. Recount declarations; run typecheck and dangling-call searches.
3. Repeat identical focused Node/Playwright c8 proof, preserving all named baseline
   failures. Independently compare deleted contracts to keepers.
4. Deliberately mutate the retained pending-override gate and actual persisted primary
   product derivation, confirm the intended keeper goes red, restore exact bytes.
5. Repeat full fixed-source Node coverage, local semantic coverage diagnostics and
   appropriate repository gates on the resulting tree. Keep raw metrics visible.

## Concrete targets and decision record

| Source owner | Test owner | Declaration effect |
| --- | --- | ---: |
| `src/lib/chat-runtime/conversation-state.ts:169,207` | `tests/conversation-state.spec.ts:181-739` | ten deletions; five mixed/retarget cases retained |
| `src/lib/chat-runtime/debug-trace.ts:344` | `tests/chat-debug-trace.spec.ts:723` | one deletion |
| `src/lib/agent-v2/resolved-product-selection-adapter.ts:172,356` | `tests/agent-v2-resolved-product-selection-adapter.spec.ts:161,196` | two deletions |
| `src/lib/agent-v2/production/persisted-session-state.ts:109` | `tests/agent-v2-production-chat-pipeline.spec.ts:777` | retained, actual persisted-field assertion |
| `src/lib/personal-plan-quiz/loading-timeline.ts:17` | `tests/personal-plan-quiz.test.ts:416` | one deletion |
| `src/lib/product-identity/brand-resolution.ts:201` | `tests/product-identity-resolution.test.ts:245` | one deletion |
| `src/lib/personal-plan-field-test/token.ts:12` | `tests/personal-plan-field-test-primitives.test.ts:24` | retained entropy/hash proof |
| `src/lib/discovery/cockpit-copy.ts:265` | `tests/discovery-cockpit-copy.test.ts:148` | retained actual copy proof |

Conversation deletion titles: routine request opens routine basics state; complete
first routine answer stays on routine basics and offers next layers; short answer
to pending routine basics keeps route in routine context; standalone support-category
recommendation switches conversation topic; goal follow-up after routine basics
advances to goal layer; problem follow-up after routine basics advances to problem
layer; combined goal and problem follow-up after routine basics offers deep dive
next; explicit category mention inside routine becomes routine deep dive; vague
category mention after routine basics becomes routine deep dive; explicit product
request inside routine switches to product category. Remaining declaration titles
and full source/entry/history evidence are retained in the linked durable lane inputs.

For :394, loop over the original three messages and assert the real predicate is
false. For :426 preserve `version:1, active_topic:"routine", routine_layer:"basics",
pending_offer:null, answered_slots:[], last_assistant_action:"answered_direct",
last_product_category:null`; with user message `ja`, assert false. Keep every private
helper referenced by any retained owner; typecheck must stay green.

Confirmed: Nick's original 20%/coverage request and later explicit production
reachability direction, recorded in [parent contract](../2026-10-01-test-audit-pruning.md).
Inherited: skill preservation/mutation/review and repository native runners.
Defaults: same source roots/Node version/c8 configuration, exact AST denominator,
temporary no-dotenv Playwright contract config. Open consequential choices: none.
Coverage acknowledgement: original request; the per-file numeric diagnostic was an
extra internal default, not a user or CI gate. Main replaces that misleading raw
diagnostic with surviving-source attribution while retaining both the actual global
and conservative original-path 2pp gates. Internal revalidation: source calls,
superseding production switch, complete mixed cases, all shared helpers and review
findings checked on this tree. No new product/runtime/operator tradeoff is adopted.

Native repository validation commands (imported OpenClaw runner names do not apply):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-resolved-product-selection-adapter.spec.ts tests/personal-plan-quiz.test.ts tests/personal-plan-field-test-primitives.test.ts tests/personal-plan-field-test-server.test.ts tests/personal-plan-field-test-entry-route.test.ts tests/personal-plan-field-test-activation-route.test.ts tests/personal-plan-field-test-campaign-command.test.ts tests/product-identity-resolution.test.ts tests/discovery-cockpit-copy.test.ts
npx playwright test tests/conversation-state.spec.ts tests/chat-debug-trace.spec.ts --project=chromium --workers=1
npm run typecheck
npm run lint
npm run build
git diff --check
```

The exact c8 before/after commands are captured by
`node /tmp/test-audit-conversation-node.cjs before|after` and
`node /tmp/test-audit-conversation-playwright.cjs before|after`, using c8 10.1.3,
`--merge-async --all --src src --src scripts --src apps --src packages`, matching
include/exclude roots from the parent harness and JSON-summary/JSON reports.
The temporary Playwright config is equivalent for these two pure contract files:
`testDir=<worktree>/tests`, matching exactly the two files, `workers:1`, `retries:0`,
one project `chromium`; it imports `tests/server-only-register.cjs`, with no dotenv
or browser fixture. Before proof completed **127/127 Node, 29/29 Playwright**.

Claude review: accepted source reachability; concrete target/fixture/native-command
clarifications above address valid findings. Reject its claim that persisted
`active_resolved_product_context` does not exist: the interface declares it at
`persisted-session-state.ts:29`, and the actual builder assigns
`buildPrimaryResolvedProductContext(activeProductContexts)` at :169. The planned
assertion tests that **stored derived field**, a stronger boundary than invoking
the helper again. Mutation proof is still required before claiming preservation.

The completed 129 checkpoint meets the user's global 2pp tolerance and the stricter
original-denominator global comparison. Raw per-file percentages have structural
declines above 2pp after deleting fully covered orphan functions, plus a synthetic
esbuild export getter count change. These are being inspected independently against
surviving source execution; do not claim the original raw per-file default passed.
Any actual lost live contract must be restored at its owner. Keeping dead functions
only to improve percentages would undermine the requested cleanup.

Durable lane inputs: [conversation ledger](2026-10-02-conversation-leaves-ledger.md) and
[small leaf ledger](2026-10-02-small-orphan-leaves-ledger.md). Corrected counts and native
commands in this cutover supersede the lane drafts. [Independent preservation review](2026-10-02-conversation-preservation-review.md). Transient reviewer/coverage evidence
stays under /tmp; this corrected cutover is durable. Target remains 2,379 removals,
not replaced by this layer. No publication, deployment or production write.
