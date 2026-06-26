> Final handoff note: this is Claude's original review of the first plan draft. Accepted findings were patched into the implementation plan before execution. The later read-only fallback implementation review found no blocking issues and one medium test-hardening item, which was fixed by adding enum-driven coverage assertions for all goal/concern sections.

I have enough grounding. The companion `.claude-review.md` is empty (0 lines) — no prior review to build on. Here is the verdict.

---

**Verdict:** Approve with revisions (fix the verification-coverage and hard-rule misconceptions before handing to a subagent)

The plan's *mechanism* is sound and faithfully mirrors the existing guidance-package pattern. The problems are (a) it claims a safety enforcement guarantee the architecture doesn't provide, (b) its verification phase can't actually check the quality criteria it lists, and (c) it under-specifies two test-side mirrors and the JSON schema, so a literal executor will hit avoidable failures. It's also heavier than the stated gap requires.

---

**Lean shape**

- **Irreducible goal:** Make AgentV2's goal/concern answers prioritize the right first lever and stop over-promoting heavy techniques (oil/mask/OWC) on weight-sensitive hair — by adding explicit lever-priority guidance loaded through the existing `load_advisor_guidance` path.
- **Cut or defer:**
  - The plan's own *User Situation* (plan lines 26–28) says answers are *already* good across shine/volume/frizz; the gap is "priority logic is implicit." That's a refinement, not a missing capability — yet the plan spins up **4 parallel research subagents + 6 evidence docs + a quality gate + a synthesis + a human checkpoint** before writing one markdown file. For well-established cosmetic levers (shine, frizz, slip, weight), write the compact lever map directly with conservative wording. **Reserve the external-evidence research apparatus for the genuinely medical-adjacent items** (`hair_loss`, `thinning`, `dandruff`, `oily_scalp`, `healthy_scalp`) where the safety boundary is the actual risk. That deletes roughly Workstreams A/B/D's heavyweight citation requirements.
  - `base.general_advice.v1` already carries `advice.goal_logic` and `advice.concern_logic` rubrics (`data/agent-v2/guidance/base/general-advice.json:39-49`). The plan's Non-Goals explicitly keep these *and* add a new package — so goal/concern guidance now lives in two places. Either fold the new levers into the existing rubrics, or state how the two stay non-duplicative (the plan does neither).
- **Hard tradeoff the plan is avoiding:** Whether priority logic belongs in *prose guidance the model self-applies* vs. *enforced validators*. The plan leans on "hard rules" for safety (Known Risks, Acceptance) without confronting that JSON hard rules in this codebase are **not enforced** unless paired with a hand-written validator (see Blocker 1).

---

**Prior art**

- **Guidance package loaded by answer-mode** → matches the canonical shape exactly. `baseEntry("goal-concern-levers")` → `base.goal_concern_levers.v1` via `package-index.ts:100-102`; selection mirrors the `base.general_advice.v1` block in `guidance-tool.ts:84-90`. ✅ Correct, no deviation.
- **Safety boundary for medical-adjacent concerns** → canonical shape here is the existing `base.safety_boundaries.v1` + `safety_mode` routing (hard short-circuit emits `safety.no_diagnosis` / `safety.no_treatment_claims`, `responses-agent.ts:3158`). The plan invents *new* hard rules in the goal-concern package instead of routing through the proven safety package — and the new package isn't even loaded in `safety_boundary` mode (`guidance-tool.ts:69` loads only `safety_boundaries.v1`). **Missing invariant:** medical-adjacent guard belongs on the safety path, not on a package that only loads for general_advice/product_recommendation/routine.

---

**Blockers** (will fail or regress as written)

1. **"Add hard rules … for medical overclaim boundaries" does not enforce anything.** — `src/lib/agent-v2/contracts.ts:401-407` makes `validator_id` optional, and the runtime only collects hard-rule ids into `knownHardRuleIds` so the model may *cite* them (`responses-agent.ts:1846-1865`). There is **no dispatch from `validator_id` → validator**. Proof: `general-advice.json:14` declares `validator_id: "no_unasked_product_recommendation"`, but the actual enforced validator is the hand-coded `category_advice_no_unasked_products` in `final-answer-validator.ts:692`. So a "hard rule" added per the plan is prompt text + a citable id, *not* a gate. **Fix:** either drop the safety claim to "soft rubric + markdown guidance," or add an explicit task to write a real validator in `final-answer-validator.ts` — and route medical-adjacent concerns through `base.safety_boundaries.v1`. As written, Acceptance criterion "No answer encourages medically inappropriate self-treatment" is unbacked.

2. **The named test files cannot verify the smoke-case acceptance criteria.** — Phase 5/6 put quality criteria ("names a practical first lever," "does not overstate weak evidence," "fine/volume-sensitive hair does not default to heavy oil/mask/OWC") under `tests/agent-v2-manual-regression.spec.ts` and `agent-v2-responses-runtime.spec.ts`. Those are **deterministic, fixture-driven contract tests**: manual-regression only checks intent/tool routing and token membership in `answer_quality_criteria` (`manual-regression.spec.ts:210-216`) against `data/agent-v2/evals/guidance-migration-regression.json` — there is no model output to judge. Answer *quality* lives in the separate LLM-judge harness `scripts/eval-chat/` (`npm run test:chat` / `test:chat:judge`), which the plan never references. **Fix:** assert only the structural facts deterministically (package loads for the mode, correct tool routing, no product names without `select_products`), and move the qualitative criteria to `scripts/eval-chat` fixtures via `npm run test:chat:judge`. This also aligns with the recorded workflow rule to run chat eval and add fixtures when bad responses appear.

3. **`requiredGuidanceForAnswer` test mirror will break ~35 assertions if not updated in lockstep.** — Changing `selectGuidancePackageIds` to add `base.goal_concern_levers.v1` for general_advice/product_recommendation/routine desyncs the test-side mirror `requiredGuidanceForAnswer` (`responses-runtime.spec.ts:317-340`, mapping at line 321), which is referenced in ~35 expected-value assertions across the file. The plan's generic "update responses-runtime.spec.ts" won't tell a subagent where the single-line fix goes; it will instead see a wall of failures. **Fix:** name the mirror explicitly — add the new id inside `requiredGuidanceForAnswer` for those three modes.

---

**High-confidence issues** (correctness, not preference)

- **Phase 4 JSON spec is missing required schema fields.** `AgentV2GuidancePackageSchema` (`contracts.ts:435-449`) requires `version`, `scope.routine_layers`, `required_grounding`, `ask_when`, and `markdown_path` — all non-optional. The plan lists only package id / answer modes / categories / safety modes / soft_rubrics / hard_rules. A subagent following the bullets literally produces a JSON that throws in `loadAgentV2GuidancePackages`. **Fix:** instruct "copy the `general-advice.json` shape" and set `version: 1`, `routine_layers: []`, `required_grounding: []`, an `ask_when` entry (or `[]`), and `markdown_path: "base/goal-concern-levers.md"` (the compiler hard-checks this exact string, `compiler.ts:23-26`).
- **Existing `guidance-migration-regression.json` fixtures may regress.** Any existing case whose mode is general_advice/routine/product_recommendation will now also load the new package; if `expected_guidance` is asserted as an exact set, those fixtures need updating too. The plan doesn't mention auditing existing fixtures.
- **Phase 5 "assert the package compiles" is not auto-covered.** No test iterates all of `AGENT_V2_GUIDANCE_PACKAGE_IDS`; the compiler spec checks named lists only (`guidance-compiler.spec.ts:24-59`). The new id must be added to the "index includes all required base packages" test plus a `loadAgentV2GuidancePackages(["base.goal_concern_levers.v1"])` load test — good that the plan wants this, but state it concretely.

---

**Smaller / nice-to-haves**

- **Process gates the plan omits (CLAUDE.md-mandated):** the `branch-gate` skill is mandatory *before* `executing-plans`/`subagent-driven-development` — the plan's header skips it. Phase 7's "run the repo's autoreview if available" should name the required `codex:codex-rescue` agent on `git diff main...HEAD` before push.
- **`clarification` in scope.answer_modes is decorative.** `selectGuidancePackageIds` never loads general_advice-class packages for `clarification` (`guidance-tool.ts:84-90`); listing it implies loading that won't happen.
- **German smoke prompts use ASCII digraphs** ("fuer", "ploetzlich", "schuetze"). Fine as input test strings, but the package's *German Answer Shape* content must use real umlauts (ü/ö/ä/ß) — there's a `agent-v2-german-orthography.spec.ts` quality bar for user-facing output.
- **Context-bloat risk is real and unmeasured.** The new package loads alongside `base.general_advice.v1` for the three most common modes, i.e. effectively always-on for advice. The plan says "test loaded package size" but gives no budget/number. Add a concrete cap or a measured assertion.

---

**Bottom line**

Don't ship to a subagent as-is, but it's close. The package wiring is correct and well-grounded. Three things must change first: (1) stop treating JSON "hard rules" as enforcement — route medical-adjacent safety through `base.safety_boundaries.v1` or write a real validator; (2) split verification — structural facts in the deterministic specs, the listed answer-quality criteria in `scripts/eval-chat` (`npm run test:chat:judge`); (3) name the `requiredGuidanceForAnswer` mirror and the full required-JSON-field set so the executor doesn't hit avoidable failures. Separately, consider the lean cut: the research apparatus is heavy for a refinement whose own evidence says answers are already good — reserve external research for the medical-adjacent concerns and write the cosmetic lever map directly.

Want me to spec the leaner counter-proposal (direct lever map + safety-path routing, research scoped to medical-adjacent only) so you can compare side-by-side?
