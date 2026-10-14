# Independent preservation review of prior cuts

Verdict: NO CONCRETE LOST CONTRACT FOUND IN THIS BOUNDED SAMPLE. No restoration recommended. This is not whole-branch readiness or approval of all 493 cuts.

Reviewed checkout: /Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning
Base HEAD: 21e0e41fa996ec6a725c258ab3766971f0edb94d
Comparison: current working tree versus HEAD. Read-only; no tests, runners, imports of owners, mutations, environment/provider/DB operations, external reviewers, commits or publication. Only this report and its /tmp inventory were written.

Scope: 39 removed direct test callbacks across five donor files: final-render prompt 25, agent guidance 1, Oil authority 3, Stage2 fixture 2, scan triggers 8. The additional removed first-mismatch mapping assertion in a retained scanner callback was also checked. Other diffs were navigation only. Excluded the restored AgentV2 base-Markdown callback and unapplied welcome/routine proposals.

## Preservation evidence and rejected false positives

1. Classic prompt clauses: 21 callbacks transfer their independent regex literals to actual orchestrator-delivered prompt arguments. tests/agentic-tool-loop.spec.ts:503 captures runStep input (six donors), :2726 captures composeFinalAnswer input (one donor), tests/agent-shadow.spec.ts:16 captures renderFinalAnswer input (14 donors). Read complete keeper callbacks and FakeModelClient/inline fake implementations. The fake records params and supplies a separate answer; it does not construct the asserted systemPrompt. Actual source passes the same exported constants at run-agentic-tool-turn.ts:129,801 and run-shadow-agent-turn.ts:439. This is unlike a compiler contract transferred to an unrelated runtime literal: deleting a required clause from these exported prompt sections changes the captured subject itself. All donor regex clauses, including forbidden conversation_context, pre-wash scalp prohibition, product ordering, profile deviation, and dry-shampoo guardrails, remain in those captures. The two additional deleted section-hierarchy callbacks protected private heading organization only; substantive clauses remain guarded. No model adherence, hosted Langfuse prompt, or SDK transport proof is claimed by either donor or keeper.

2. Two dynamic answer-context callbacks: retained inline conditioner keeper at agentic-tool-loop.spec.ts:1739 reaches buildAgenticAnswerContext via the actual loop after select_products and asserts exact first-three capsule order, no proactive followup, and both donor wording expressions. Its populated conditioner products differ from donor products=[], but the operative conditioner path in agentic-answer-context.ts:203–347 reads selected category/policy, latest userJob/message, routine/state, not product count. The retained parity-category callback also still exercises recommended empty projections for six categories. No observed independent empty-conditioner contract warrants restoration merely because an artificial future special-case could distinguish inputs. Retained advisor keeper at :1208 reaches the conceptual branch and asserts capsule membership plus decisive wording from actual serialized context. HEAD donor says exactly 'Soll ich eine Maske oder ein Oel nehmen?' and keeper omits 'ein'; hasConceptualCategoryIntent at :516 uses independent category/question token matches, not adjacency. Both have the same mask/oil/question tokens, null state and selectedProducts. The fake guidance does not supply the capsule wording. A narrowed phrase matcher is speculative, not a concrete present branch loss. Older next385 ledger's R disposition for these two was not used as semantic proof either way.

3. Stage2 fixture recompute pair: tests/personal-plan-stage2-module-entry.test.tsx:299 drives the actual createStage2FixtureGateway through categories[], weekly_2x, products completion, four habits answers and closing habits completion. It asserts products has no recompute and habits equals {outcome:'applied'}. The two extra rejecting calls fail before mutation in completeModule/assertRevision. :951 constructs actual habits-only answers/revision4, calls the real fixture gateway, then the actual applyStage2ModuleCompletion dispatcher; recordingEffects only records the received payload. It asserts in_progress and the carried recompute object. Source fixture-gateway.ts:129–169 has separate closing/nonclosing return branches and both are reached; refinement-flow.ts:963–1008 forwards the real completion object. No fake manufactures the asserted outcome downstream. This protects the supported fixture simulation, not actual production recomputation.

4. Oil data contract: tests/catalog-authority-oil-repair.test.ts:41 retains a fixed independent EXPECTED_FINGERPRINT and hashes the parsed manifest plus inspectOilAuthorityRepair output. repair.ts:79–87 fingerprints schemaVersion, slice and complete entries, including expectedCurrentAuthority and intendedAuthority; it does not derive the expected hash from the current manifest. oil-repair.ts:155–159 returns the parsed manifest without replacing intended values; validateOilManifest additionally checks identity/thickness, protocol scopes/roles, purpose and heat constraints. The removed three callbacks only asserted fields from this same fixed data, not rejection of edited manifests. A changed OGX/Garnier weight/role/eligibility, provenance, thickness or scope changes the fixed fingerprint even when individual fingerprints are refreshed. Existing structural-mutation callback remains. Thus the keeper genuinely reads the data artifact and catches donor-observable data changes. No DB/migration correctness claim inferred from this hash.

5. Scanner predicate seams: git grep on HEAD src/scripts found only definitions for SCAN_TRIGGER_CLASS and firesErsterPasstNicht/firesWasPasstStattdessen/firesMerkenTap/firesUnbekanntesProdukt. Their deletion therefore cannot remove an independent live predicate guard. Current ScanFlow passes EMPFEHLUNGEN_GATE/MERKLISTE_GATE with scan:verdict directly at :1019,1086,1108, rather than calling the removed mapper entries; scanTriggerSheetContext remains used for two-scans and actual proactive IDs. Read complete retained reveal/spent-credit/Merken callbacks at scan-flow-ui.test.tsx:2615–2753: they invoke real component callbacks and inspect resulting sheet context. Unknown/pending keeper callbacks at scan-flow-state.test.ts:905–933 invoke the actual reducer; source scan-flow-state.ts:339–373 limits proactive evaluation to real result steps. The old fatigue callback never passed a fatigue flag and only repeated the direct predicates; the two-scans true case remains in its direct test. No live first-mismatch/Merken mapping or unknown result rule depends on deleted helpers.

6. Separated hair-loss wording: tests/agent-guidance.spec.ts:676 retains actual loadAdvisorGuidance with the separated 'fallen ... Haare aus' wording and no model focus; its literal overlay ID and parsed avoid-content assertion remain. load-advisor-guidance.ts:228–239 unions current-turn safety overlays before profileFocus, and :476–490 applies the same case-insensitive normalized separated regex to both donor and keeper wording. The donor's hair-loss focus is redundant because the same hasHairLossOrThinningSignal predicate gates it, and its dry_lengths focus duplicates the stored dryness-derived overlay. The retained keeper therefore actually loads/parses the guidance source and reaches the operative branch; it does not merely test an ID supplied by a fake.

## Read limits and verification

Read complete deleted callback bodies from git diff; complete specifically cited keeper callbacks and their operative helper/fake bodies. Read full scanner trigger owner and Stage2 fixture gateway; full Oil manifest validation/fingerprint functions; full answer-context conceptual/product/next-step predicate paths relevant to these two cuts; relevant guidance overlay union/compatibility/hair-loss matching and caller; prompt sections and actual fixed-argument delivery sites. Read scanner component and reducer portions for the cited live routing only. Did not read every line of the 4k-line loop, ScanFlow UI suite, model client, full recommendation engine, or broader 493-cut cohort. No fresh runtime or mutation testing: parent's frozen full runner was respected. Native test results, coverage tolerance and whole-branch release judgment remain parent-owned. No restoration-ready callback body is included because no restoration is justified.

Decision: keep this sample's cuts. Rejected alternatives: restoring every static/data test solely because it is static, accepting fake answer quality as prompt proof, demanding new input rows solely to preserve different fixture shapes, or treating prior green coverage/review as semantic proof.

## Exact removed title inventory

### tests/agent-final-render-prompt.spec.ts — 25

- `test("agentic tool-loop prompt lets current intent win over prior state", () => {`
- `test("agentic tool-loop prompt requires tool-sourced products and terminal answers", () => {`
- `test("agentic tool-loop prompt hides internal labels", () => {`
- `test("agentic tool-loop prompt treats answer context as composition guidance", () => {`
- `test("agentic tool-loop prompt treats consultation brief as candidate context", () => {`
- `test("agentic tool-loop prompt is organized by priority sections", () => {`
- `test("agentic tool-loop prompt prioritizes conversational fit before guidance", () => {`
- `test("agentic contextual composer prompt preserves tool authority", () => {`
- `test("agentic answer context selects conditioner recommendation capsules", () => {`
- `test("agentic answer context asks conceptual comparisons to end decisively", () => {`
- `test("production final render prompt does not require the conversation context packet", () => {`
- `test("final render prompt uses the rewritten section hierarchy", () => {`
- `test("production final render prompt keeps internal labels hidden without context-packet labels", () => {`
- `test("final render prompt supports recommend-with-caveat policy", () => {`
- `test("final render prompt requires concrete endings and sharper scalp followups", () => {`
- `test("final render prompt keeps pre-wash oil away from scalp-treatment claims", () => {`
- `test("final render prompt ties conceptual oil comparisons back to the user", () => {`
- `test("final render prompt preserves all selected product options in order", () => {`
- `test("final render prompt hides internal fallback markers from users", () => {`
- `test("final render prompt preserves spray versus cream leave-in comparisons", () => {`
- `test("final render prompt explains the one-less-product value of integrated leave-in heat protection", () => {`
- `test("final render prompt requires profile deviation notices up front", () => {`
- `test("final render prompt gives conceptual split-end mask answers enough substance", () => {`
- `test("final render prompt keeps dry shampoo as a narrow bridge with hard-no guardrails", () => {`
- `test("final render prompt deduplicates the mandatory dry-shampoo caveat", () => {`

### tests/agent-guidance.spec.ts — 1

- `test("current-turn separated hair-loss wording can load safety overlay", async () => {`

### tests/catalog-authority-oil-repair.test.ts — 3

- `test("OGX and Garnier carry only the explicitly recommended finished-product authority", () => {`
- `test("sheet thickness is immutable and all other oils retain conservative pre-wash purpose", () => {`
- `test("fact provenance excludes protocol-only internal authority and protocols are product-scoped", () => {`

### tests/personal-plan-stage2-fixture-gateway.test.ts — 2

- `test("completeModule emulates an applied recompute outcome for habits, never for products", async () => {`
- `test("completeModule emulates an applied recompute outcome for a NON-closing habits completion too", async () => {`

### tests/scan-trigger-rules.test.ts — 8

- `test("classification: 4 user-initiated gates never fatigue-limited, 4 proactive pitches are", () => {`
- `test("erster_passt_nicht fires exactly on a mismatch verdict with the free reveal still available", () => {`
- `test('"was passt stattdessen" is the exact complement for a later passt-nicht', () => {`
- `test("merken_tap fires exactly when the bookmark is locked", () => {`
- `test("unbekanntes_produkt never pitches, for every input including one that looks pitchable", () => {`
- `test("fatigue does not touch user-initiated gates: they fire regardless of alreadyFiredThisSession", () => {`
- `test("scanTriggerSheetContext maps Merken to merkliste", () => {`
- `test("scanTriggerSheetContext is null for unbekanntes_produkt (never pitches, no sheet)", () => {`

## Reviewed file fingerprints

- tests/agent-final-render-prompt.spec.ts: acab16904532aadc19ef8dcea3bae66191bea59f6236dcee56241552c68e0689
- tests/agent-guidance.spec.ts: 63f8dcda9eebe1df8b509e78e09625d7232f1ab0d277a9ea068b3ba5465e8e24
- tests/catalog-authority-oil-repair.test.ts: d3b46c00701e8dc881aa9d00284e5539a5c4e7f64c992250a6d3db19def3fde7
- tests/personal-plan-stage2-fixture-gateway.test.ts: 633cf32c1594ee5304aa161de11180c1bf5e650648fc3d2f9275dbe3d8458f0b
- tests/scan-trigger-rules.test.ts: f1c77e3fb743a0cb2f1b5961fa6fb56415fb102069de9652bb23f253ce42e903
- tests/agentic-tool-loop.spec.ts: beed4b4c511c2c681248b3291b50f279d11153b3b71c16b5cd3a53cf2ca2248c
- tests/agent-shadow.spec.ts: 06e6e64262b740a2a8439537ed366ebf74305ba1675408d35e5348439aac137c
- tests/personal-plan-stage2-module-entry.test.tsx: a5e0b9758e70d09619019cbe375143c6433f238b8bdc24a8883290a154b302bc
- tests/scan-flow-ui.test.tsx: f5484cc86b14501866f9fb1aecb78904ab7d27a6ea9cee55ec2fa93558122122
- tests/scan-flow-state.test.ts: c0e9cc2bdcb1e3fdc53c337c28a7c8e7dbe9bdcc7157a8a57750b589c79904da
