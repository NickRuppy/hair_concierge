# Bondbuilder merge-gate chat repair

Outcome: complete the approved engine release with the three chat-evaluation findings repaired, then verified-head merge and the already-authorized runtime activation/guarded cleanup. Reuse the [activation plan](activation-2026-10-05.md); no research, catalogue promotion, migration or product-trust changes.

## Chosen repair and boundaries

The failed summary trace shows bounded repair asking for `build_or_fix_routine` although the latest summary request hard-denies rebuilding. Make repair planning honor that existing summary policy: omit the prohibited routine tool, retain any genuinely missing guidance load, then require a non-mutating `general_advice` summary with `routine_intent: none`, no routine step IDs and the existing active routine context. Do not loosen final validation or mutation authorization. If the model still returns an invalid answer, keep the existing safe fallback.

For evaluation, preserve literal `forbidden_keywords` behavior. Add opt-in `ContentHeuristics.forbidden_claims?: string[]`, move the damage fixture's three phrases (`wie neu`, `dauerhaft reparieren`, `heilt`) from `forbidden_keywords` into it, and leave every other fixture literal. Match complete words/phrases, not stems such as `verheilt`; normalize case and whitespace only. Ignore only an occurrence immediately preceded by `nicht`, `niemals` or `keinesfalls`, or immediately followed by one of those negators. Never ignore `nicht nur` or double negation; check a bounded three-word same-clause context for repeated negators. Unknown/nonlocal grammar remains a failure rather than a guessed exemption. Every occurrence is checked independently, so “Es kann nicht dauerhaft reparieren. Dieses Produkt kann dauerhaft reparieren.” fails. Concrete controls include the captured “Pflege kann sie glätten, aber nicht dauerhaft reparieren.” (pass), “Dieses Produkt kann dauerhaft reparieren.” (fail), “Nicht nur pflegen: Dieses Produkt heilt die Haare.” (fail), “Es kann nicht nicht dauerhaft reparieren.” (fail), and “Es heilt nicht nur, es pflegt.” (fail). The positive word-boundary `heilt` is checked without matching `verheilt`.

The sectioning repair is only `required_keywords: ["Sektionen", "Partien"]`, using the existing OR behavior. This is bounded pattern matching, not a semantic efficacy judge.

Targets: `src/lib/agent-v2/runtime/responses-agent.ts` and the existing repair-triggered runtime regression (original line 4854, not the separate direct-tool denial test at 4187); `scripts/eval-chat/{assertions,types,fixtures}.ts` and new `tests/eval-chat-assertions.test.ts`. At repair construction (around runtime line 740), prune `build_or_fix_routine` from the fresh repair allow-set when the existing `routineToolPolicy.hardDenyReason` is set. Existing `buildRepairState` will then omit it while retaining genuinely missing guidance. Pass that same authoritative policy to the repair instruction, explicitly steering summary-denied turns to non-mutating `general_advice` with no routine step IDs; don't change execution authorization or final-answer validation.

The independent CI failure is now diagnosed: all 11,027 top-level contracts completed without an assertion failure, but the quality-node 15-minute job budget expired before remaining required steps. Change only `.github/workflows/ci.yml` quality-node timeout to 25 minutes; retain every command, assertion and required gate. Prior same-branch successful lane lasted 14m36, so this is a timing-budget repair, not an accepted failing test. Any unrelated behavioral CI defect would still require a new scope decision; no opportunistic refactors.

## Decision coverage

Decision coverage: confirmed.
Confirmed with Nick: direct “do that, fix and inclide it - then we merge” approves the described summary recovery and two overly literal checks; earlier “Merge, activate, etc.” retains activation authority.
Inherited from contract: summaries do not mutate/rebuild routines; unsupported permanent-repair claims remain forbidden; original failed evaluations are retained; required CI cannot be bypassed.
Implementation defaults: extend the existing real runtime boundary test, use narrow explicit negation forms rather than global removal of words, and reuse the task worktree.
Open consequential assumptions: none.
Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: the direct request above following the exact observed reply/trace explanation; no new UI design or product decision is introduced.
Internal revalidation: owning policy, validation, runtime and fixtures match current main before this repair. A 27/30 original evaluation, single 10/10 diagnostic rerun and existing 1/1 owning regression are preserved separately; diagnostic success did not waive the full gate.

## Journey and proof

Existing journey, exact bug repair: user receives a routine, asks “Fass mir das bitte ganz kurz zusammen,” and gets a concise German recap of that existing routine without a new routine-tool execution or state mutation. Invalid model output still goes through validation and safe fallback. Separate mockup is not applicable to this exact recovery repair; the captured original reply and trace ground the approved correction.

1. Extend the existing runtime regression `AgentV2 runtime blocks repair-triggered routine rebuild for pure active routine summaries`, retaining the direct-tool denial test separately. Force the original invalid routine terminal answer, then provide a valid non-mutating summary without a rebuild; assert completed summary, zero routine-tool executions, no blocked repair call, and terminal-only repair when guidance is already loaded. Add missing-guidance variation to preserve required guidance loading. Observed RED: old code reports `missing_guidance_or_tools` instead of `terminal_only`; do not waive its validation failure. Then GREEN and adjacent runtime/policy/validator tests.
2. Prove assertion RED on the captured negated phrase and sectioning synonym, implement the narrow checks, and verify affirmative, mixed affirmative/negative, unrelated negation and unchanged literal checks fail appropriately.
3. Main integrates every result, typechecks/lints/builds, runs the full task-server chat evaluation and verifies temporary-record cleanup. Keep all prior reports. Recheck affected engine protections/frozen hashes and full branch fingerprint.
4. Read-only terminal Claude plan review before implementation and final whole-branch correctness/structural review before push; main adjudicates findings. Refresh verification/review receipts. Publish the exact bytes, wait for all required CI, perform exact-head merge, then the previously approved release switch and guarded worktree finish.

Artifacts: commit this plan and source/tests; archive original and new eval/debug/operational receipts plus counterpart reports before cleanup. Discard none. Done only with truthful gate results and separate merge/runtime/cleanup receipts; stop for a genuinely new consequential choice, not another ceremonial approval.

Counterpart plan review: `/tmp/bondbuilder-chat-plan-review-20261005.md`, read-only terminal Opus/high, “Approve with revisions.” Accepted: explicit runtime seam, negation API/anchoring/adversarial strings, fixture field move, one-line synonym repair and named guard file. Clarified reviewer misidentification: the existing repair-triggered test is at 4854 and was extended; the direct-tool test at 4187 stays unchanged. CI follow-up resolved by log-derived timeout-only repair. All revisions are technical details within Nick's approved repair; decision coverage remains confirmed, no new consequential choices.
