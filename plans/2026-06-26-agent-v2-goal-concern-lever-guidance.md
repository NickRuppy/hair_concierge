# AgentV2 Goal And Concern Lever Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use `branch-gate` before implementation edits. Use `superpowers:subagent-driven-development` for the research phase and `superpowers:executing-plans` or `superpowers:subagent-driven-development` for implementation. Track progress by updating the checkbox steps in this plan.

**Goal:** Add complete, evidence-informed AgentV2 guidance for every onboarding goal and concern so the agent can answer goal/problem questions with clearer priorities, better profile modifiers, and fewer implicit guesses.

**Architecture:** Keep the current AgentV2 architecture. Add one base guidance package, `base.goal_concern_levers.v1`, as a peer of `base.general_advice.v1`, `base.routine_building.v1`, and `base.product_recommendation.v1`. Do not add a new resolver tool or deterministic goal engine unless regression evidence proves guidance-only routing is insufficient.

**Tech Stack:** TypeScript, AgentV2 guidance markdown/JSON packages, Zod contracts, Node test runner with `tsx`, static guidance compiler tests, AgentV2 runtime smoke tests, external evidence research notes.

---

## Spec Link

- Source conversation: June 26, 2026 discussion after goal/problem onboarding smoke tests.
- Current enum source: `src/lib/vocabulary/concerns-goals.ts`.
- Runtime guidance tool: `src/lib/agent-v2/tools/guidance-tool.ts`.
- Guidance package index: `src/lib/agent-v2/guidance/package-index.ts`.
- Current base guidance peer: `data/agent-v2/guidance/base/general-advice.md`.
- Current package metadata example: `data/agent-v2/guidance/base/general-advice.json`.

No separate product spec exists yet. This plan intentionally starts with a research brief and synthesis gate before writing runtime guidance.

## User Situation

The onboarding asks for hair goals and problems. AgentV2 can already answer many goal and concern questions well from current profile context, general advice, routine guidance, and category packages. A smoke test on fine, wavy hair with `shine`, `volume`, `frizz`, and `dryness` showed good answers for "more shine", "more volume", "frizz after washing", first product to change, and whether leave-in is needed.

The gap is not a total absence of capability. The gap is that priority logic is implicit. The agent has to infer which levers usually matter, which levers are weak first moves, and how profile conflicts such as fine hair plus volume plus frizz should be balanced. That can lead to uneven emphasis across goals/concerns and occasional over-promotion of a heavier technique.

## Locked Decisions

- Cover all current `GOALS` and all current `PROFILE_CONCERNS`; no partial guidance set.
- Keep full research coverage across all goals and concerns.
- Execute the work subagent-driven, with separate bounded research subagents for the four workstreams and main-thread ownership for synthesis, architecture, runtime wiring, verification, and final handoff.
- Use external research first, then synthesize into internal product guidance.
- Keep external evidence separate from internal methodology while researching.
- Add a small structured base guidance package, not a new resolver tool.
- Trigger the guidance through the existing `load_advisor_guidance` path.
- Keep `base.general_advice.v1` responsible for broad goal/concern framing; the new package owns the complete per-goal/per-concern lever map so the two packages do not duplicate the same job.
- Keep product names, availability, claims, protocols, and exact routines grounded in existing tools/catalog data.
- Keep cosmetic hair-care guidance separate from medically adjacent scalp or hair-loss guidance.
- Use conservative wording when evidence is mixed or weak.
- Use German answer-shape guidance in the runtime markdown, but keep research notes in English if that is faster and clearer.

## Claude Review Disposition

Claude reviewed the first version of this plan on June 26, 2026. Accepted findings have been patched into this plan:

- JSON `hard_rules` are not enforcement unless backed by hand-written validators, so medical-adjacent safety must route through the existing safety path.
- Deterministic tests should verify structure and tool routing; answer-quality criteria belong in chat eval / judge fixtures.
- `tests/agent-v2-responses-runtime.spec.ts` has a `requiredGuidanceForAnswer` mirror that must be updated with the new package.
- The package JSON task must list the full required schema fields.
- Existing exact guidance fixtures must be audited.
- Branch-gate and concrete review gates must be named.
- `clarification` should not be listed as an answer mode unless the selection logic actually loads it.

Deferred or rejected findings:

- Claude suggested reducing external research to only medical-adjacent items. This plan keeps complete research coverage because the product goal is balanced guidance across all goals and concerns, but it limits cosmetic research to concise evidence notes rather than long literature reviews.
- Claude suggested considering folding the levers into `base.general_advice.v1`. This plan keeps a separate package to avoid making `general-advice.md` a larger catch-all; the non-duplication boundary is now explicit.

## Execution Mode

Use `superpowers:subagent-driven-development` after the implementation kickoff contract is established.

Main-thread responsibilities:

- Run `branch-gate` and confirm the implementation worktree/branch.
- Own the implementation goal contract.
- Dispatch research subagents with the exact workstream prompts from this plan.
- Review research quality and source strength.
- Own synthesis and product/architecture decisions.
- Patch runtime guidance and tests only after the research/synthesis gate is clean.
- Run final verification and review gates.

Subagent responsibilities:

- Workstream A: fiber surface and cosmetic feel research.
- Workstream B: damage, breakage, split ends, and strength research.
- Workstream C: scalp and medical-adjacent boundary research.
- Workstream D: shape, volume, color, and styling outcome research.
- Optional later subagents may do spec-compliance and code-quality review after implementation tasks, following the subagent-driven-development skill.

Subagents must not edit runtime guidance, source code, product data, or tests during the research phase.

## Complete Coverage Surface

Goals from `GOALS`:

- `volume`
- `healthier_hair`
- `less_frizz`
- `color_protection`
- `moisture`
- `healthy_scalp`
- `shine`
- `curl_definition`
- `less_split_ends`
- `less_volume`
- `strengthen`
- `anti_breakage`

Concerns from `PROFILE_CONCERNS`:

- `hair_loss`
- `dandruff`
- `dryness`
- `oily_scalp`
- `hair_damage`
- `split_ends`
- `breakage`
- `frizz`
- `tangling`
- `thinning`

Acceptance: every entry above has one guidance section, evidence notes in the synthesis, a profile modifier policy, weak-first-lever warnings, and safety/scope boundaries where relevant.

## Target File Map

Research docs:

- Create `docs/research/goal-concern-levers/research-brief.md`
- Create `docs/research/goal-concern-levers/fiber-surface.md`
- Create `docs/research/goal-concern-levers/damage-breakage.md`
- Create `docs/research/goal-concern-levers/scalp-medical-adjacent.md`
- Create `docs/research/goal-concern-levers/shape-styling.md`
- Create `docs/research/goal-concern-levers/synthesis.md`

Guidance package:

- Create `data/agent-v2/guidance/base/goal-concern-levers.md`
- Create `data/agent-v2/guidance/base/goal-concern-levers.json`
- Modify `src/lib/agent-v2/guidance/package-index.ts`
- Modify `src/lib/agent-v2/tools/guidance-tool.ts`

Tests and evals:

- Modify `tests/agent-v2-guidance-compiler.spec.ts`
- Modify `tests/agent-v2-responses-runtime.spec.ts`
- Modify `tests/agent-v2-manual-regression.spec.ts`
- Modify chat eval fixtures or add a focused `scripts/eval-chat` fixture for answer-quality checks.
- Optionally modify or add AgentV2 eval fixtures if an existing eval runner can cover these scenarios without adding new harness complexity.

Avoid touching:

- Product catalog schema.
- Recommendation engine category scoring.
- Routine planner internals, unless implementation tests prove the routine tool cannot preserve the guidance boundary.
- Onboarding enums, unless a separate product decision changes the vocabulary.

## Guidance Entry Template

Use this structure for each goal:

```markdown
## Goal: [German label] / `[code]`

### User Meaning
What the user is usually trying to achieve, and common ambiguity.

### Primary Levers
The first practical levels to consider, ordered from most generally useful to more conditional.

### Secondary Or Conditional Levers
Helpful when profile signals, routine state, or user wording supports them.

### Weak First Levers
Levers that may help sometimes but should not be the default first answer.

### Profile Modifiers
How thickness, hair_texture, density, length, scalp state, color/chemical treatment, heat use, and current routine change the advice.

### Common Conflicts
Goals or concerns that can pull against this goal.

### Missing Data
Only the questions worth asking when the answer would materially change.

### Safety / Scope Boundary
Where cosmetic advice stops.

### German Answer Shape
The short German structure the final answer should follow.

### Do Not
Overclaims, category mistakes, and phrasing to avoid.
```

Use this structure for each concern:

```markdown
## Concern: [German label] / `[code]`

### First Split
Whether to think scalp/root, length/fiber, styling/technique, buildup/reset, damage, or safety boundary first.

### Likely Levers
The most likely useful levels, in order.

### Secondary Or Conditional Levers
Helpful when additional signals support them.

### Weak First Levers
Levers that are often overused or too heavy as a first move.

### Profile Modifiers
How thickness, hair_texture, density, length, scalp state, color/chemical treatment, heat use, and current routine change the advice.

### Common Conflicts
Goals or concerns that need balancing.

### Missing Data
Only the questions worth asking when the answer would materially change.

### Safety / Scope Boundary
When to stop cosmetic advice and suggest medical/professional help.

### German Answer Shape
The short German structure the final answer should follow.

### Do Not
Overclaims, category mistakes, and phrasing to avoid.
```

## Research Quality Standard

Use the `hair-care-expert` lane for external evidence. Keep it separate from internal AgentV2 guidance until synthesis.

Preferred sources:

- Reputable dermatology or medical organizations for scalp, dandruff, shedding, thinning, irritation, and hair-loss boundaries.
- Peer-reviewed cosmetic science, dermatology, or trichology literature for fiber damage, friction, conditioning, shine, frizz, breakage, color fading, and curl definition.
- Regulatory or consensus guidance for safety boundaries.
- Professional practice sources only when scientific evidence is weak, labeled as practice consensus rather than proof.

Avoid:

- Influencer claims as primary evidence.
- Brand marketing as proof of efficacy.
- Exact product protocols unless supported by product metadata later.
- Strong causal claims when evidence is only plausible or indirect.

Evidence labels:

- `strong`: consistent clinical/scientific support or clear safety consensus.
- `moderate`: plausible and commonly accepted with some direct evidence.
- `weak`: indirect evidence, professional practice, or mixed findings.
- `unknown`: insufficient support; do not turn into runtime rule.

## Research Workstreams

The scope intentionally keeps research coverage complete because partial guidance would overweight only the better-researched concerns in agent answers. To control cost, the medical-adjacent workstream must use the strictest source standard. Cosmetic workstreams may use concise evidence notes and should not overbuild long literature reviews when the useful guidance can be stated conservatively.

### Workstream A: Fiber Surface And Cosmetic Feel

Scope:

- Goals: `shine`, `less_frizz`, `moisture`
- Concerns: `dryness`, `frizz`, `tangling`

Questions:

- What actually improves shine: surface smoothness, conditioning film, cuticle state, buildup removal, styling, or oils?
- When is frizz dryness, mechanical disturbance, humidity, texture pattern, damage, or product mismatch?
- What helps tangling first: slip, saturation, sectioning, conditioner/leave-in, brush technique, trimming, or damage prevention?
- When do heavier masks/oils help versus weighing hair down?

Expected output:

- `docs/research/goal-concern-levers/fiber-surface.md`
- Ordered lever map for each scoped goal/concern.
- Evidence labels and citations.
- Conflict notes for fine hair, oily scalp, volume goals, curls, and color/chemical treatment.

### Workstream B: Damage, Breakage, Split Ends, And Strength

Scope:

- Goals: `healthier_hair`, `less_split_ends`, `strengthen`, `anti_breakage`
- Concerns: `hair_damage`, `split_ends`, `breakage`

Questions:

- Which outcomes are cosmetic appearance versus actual prevention?
- What can conditioning, leave-in, heat protection, bond builders, trims, low-tension handling, and reduced chemical/heat stress realistically do?
- How should the agent distinguish breakage from shedding/hair loss?
- When are split ends only manageable by trimming?

Expected output:

- `docs/research/goal-concern-levers/damage-breakage.md`
- Ordered lever map for each scoped goal/concern.
- Clear "cannot repair split ends permanently" and "breakage is not shedding" boundaries.
- Profile modifiers for bleach, heat, curls/coils, long hair, fine hair, and high-friction routines.

### Workstream C: Scalp And Medical-Adjacent Boundaries

Scope:

- Goals: `healthy_scalp`
- Concerns: `hair_loss`, `dandruff`, `oily_scalp`, `thinning`

Questions:

- What cosmetic advice is acceptable for oily scalp, mild flakes, scalp comfort, and routine hygiene?
- What signs require dermatologist/medical evaluation?
- How should the agent avoid treating hair loss, thinning, persistent dandruff, inflammation, pain, or sudden shedding as product-shopping problems?
- What can shampoo cadence, gentle cleansing, anti-dandruff categories, and avoiding irritation realistically do?

Expected output:

- `docs/research/goal-concern-levers/scalp-medical-adjacent.md`
- Safety boundary table.
- Conservative cosmetic lever map.
- German wording proposals that are helpful without sounding diagnostic.

### Workstream D: Shape, Volume, And Styling Outcome

Scope:

- Goals: `volume`, `less_volume`, `curl_definition`, `color_protection`

Questions:

- For volume, what matters first: root cleansing, avoiding weight, drying/styling technique, cut, mousse/styling products, or scalp oil management?
- For less volume, what matters first: smoothing, conditioning, leave-in, styling tension, curl handling, or humidity/frizz control?
- For curl definition, what matters first: moisture/slip, hold/styling product, application technique, drying, and avoiding dry brushing?
- For color protection, what matters first: wash frequency, gentle/colored-hair shampoo, UV/heat, water exposure, clarifying cadence, and chemical history?

Expected output:

- `docs/research/goal-concern-levers/shape-styling.md`
- Ordered lever map for each scoped goal.
- Conflict notes for volume versus frizz/shine/moisture, curl definition versus low maintenance, and color protection versus reset cleansing.

## Subagent Dispatch Prompts

Use independent subagents for the four research workstreams. Give each subagent this shared instruction:

```text
You are researching evidence for Hair Concierge AgentV2 goal/concern guidance. Stay in the external evidence lane. Do not inspect or modify app code. Do not design runtime architecture. Produce a concise markdown research note with citations, evidence strength labels, conflicts, and implementation implications. Prefer reputable dermatology/medical organizations, peer-reviewed cosmetic science/dermatology/trichology sources, consensus/regulatory guidance, and clearly labeled professional practice when evidence is weak. Avoid brand marketing as proof.
```

Then append the workstream-specific scope and questions from the sections above.

Stop line for subagents:

- Subagents may create research notes only.
- Subagents must not edit `data/agent-v2/guidance/**`, `src/**`, tests, or product data.
- Subagents must flag unresolved conflicts instead of inventing a rule.

## Implementation Steps

### Phase 0: Worktree And Scope Lock

- [x] Create isolated worktree `.worktrees/goal-concern-lever-guidance-plan` on branch `codex/goal-concern-lever-guidance-plan`.
- [x] Confirm root checkout is not used for plan edits.
- [x] At implementation kickoff, create or reuse an implementation worktree based on fresh `origin/main`.
- [x] Reconfirm the current `GOALS` and `PROFILE_CONCERNS` lists before research begins.

### Phase 1: Research Brief And Subagent Research

- [x] Create `docs/research/goal-concern-levers/research-brief.md`.
  - Include the complete enum surface.
  - Include the evidence labels.
  - Include source standards and excluded source types.
  - Include the subagent stop line.
- [x] Dispatch Workstream A subagent and save `fiber-surface.md`.
- [x] Dispatch Workstream B subagent and save `damage-breakage.md`.
- [x] Dispatch Workstream C subagent and save `scalp-medical-adjacent.md`.
- [x] Dispatch Workstream D subagent and save `shape-styling.md`.
- [x] Require every research note to include:
  - scoped goals/concerns covered,
  - source list with links,
  - evidence labels,
  - conflicts,
  - runtime implications,
  - open risks.

### Phase 2: Research Quality Gate

- [x] Main thread reviews every research note for source quality and overclaims.
- [x] Reject or mark as `weak` any brand-led, influencer-led, or unsupported claim.
- [x] Make sure scalp, dandruff, hair loss, thinning, pain, irritation, and sudden shedding have conservative boundaries.
- [x] Make sure cosmetic fiber claims distinguish appearance, prevention, and true repair.
- [x] Make sure every goal and concern has enough support for at least a conservative runtime entry.
- [x] If a scoped item lacks evidence, record it as `unknown` in the synthesis rather than filling with model common sense.

### Phase 3: Synthesis And Human Review Checkpoint

- [x] Create `docs/research/goal-concern-levers/synthesis.md`.
- [x] For every goal and concern, write a compact synthesis row:
  - code,
  - German label,
  - user meaning,
  - primary levers,
  - conditional levers,
  - weak first levers,
  - profile modifiers,
  - conflicts,
  - safety boundary,
  - evidence level,
  - research note source.
- [x] Add a "translation into AgentV2 guidance" section.
- [x] Add an "open domain review" section only for issues not resolvable from external evidence.
- [ ] Stop for user review if synthesis proposes any materially new product philosophy, medical boundary, or category priority that differs from current product behavior.

### Phase 4: Guidance Package Implementation

- [x] Create `data/agent-v2/guidance/base/goal-concern-levers.md`.
  - Use the template above.
  - Include every goal and concern.
  - Keep entries concise and operational.
  - Use German answer-shape bullets, but keep hard evidence claims conservative.
- [x] Create `data/agent-v2/guidance/base/goal-concern-levers.json`.
  - Package id: `base.goal_concern_levers.v1`.
  - Copy the complete schema shape from `data/agent-v2/guidance/base/general-advice.json`.
  - Required fields must include `version: 1`, `scope.answer_modes`, `scope.categories`, `scope.routine_layers`, `scope.safety_modes`, `hard_rules`, `soft_rubrics`, `required_grounding`, `ask_when`, and `markdown_path`.
  - Answer modes: `general_advice`, `product_recommendation`, and `routine`.
  - Do not list `clarification` unless `selectGuidancePackageIds` is intentionally changed to load this package for clarification turns.
  - Categories: `[]`.
  - Routine layers: `[]`.
  - Safety modes: `normal`, `restricted`.
  - Required grounding: `[]`.
  - Ask when: `[]` unless synthesis identifies a high-value follow-up policy.
  - Markdown path: `base/goal-concern-levers.md`.
  - Add `soft_rubrics` for:
    - goal/concern lever prioritization,
    - profile conflict balancing,
    - weak-first-lever avoidance,
    - safety boundary escalation.
  - Do not treat JSON `hard_rules` as enforced validators. Add hard rules only for citable model guidance, and add a real `final-answer-validator.ts` task if enforcement is required.
  - Medical-adjacent enforcement should continue to route through the existing `base.safety_boundaries.v1` safety path rather than relying on this package.
- [x] Modify `src/lib/agent-v2/guidance/package-index.ts`.
  - Add `base.goal_concern_levers.v1` to `AGENT_V2_GUIDANCE_PACKAGE_IDS`.
  - Add a `PACKAGE_ENTRIES` row using `baseEntry("goal-concern-levers")`.
- [x] Modify `src/lib/agent-v2/tools/guidance-tool.ts`.
  - Load `base.goal_concern_levers.v1` when `answer_mode_hint` is `general_advice`, `product_recommendation`, or `routine`.
  - Keep `base.general_advice.v1` loaded as today.
  - Preserve existing safety-boundary loading behavior; if the model classifies a turn as `safety_boundary`, rely on `base.safety_boundaries.v1` rather than forcing this package into the safety path.
  - Do not add a new tool input field unless tests prove the model cannot discover the guidance from answer mode and profile context.
- [x] Review for package bloat.
  - If the markdown becomes too long for routine loading, split only by current guidance conventions, not by inventing a new runtime layer.
  - Preferred fallback split would be topic packages only if measured context size or answer quality makes the single base package unwieldy.
  - Record the final package size in the synthesis or handoff. If the markdown exceeds 8,000 words or causes a measured prompt/context regression, stop and split before implementation handoff.
  - Final measured package size: `data/agent-v2/guidance/base/goal-concern-levers.md` is 3,749 words, below the 8,000-word split threshold.

### Phase 5: Tests And Regression Coverage

- [x] Update `tests/agent-v2-guidance-compiler.spec.ts`.
  - Add `base.goal_concern_levers.v1` to the required base package index assertion.
  - Add a focused `loadAgentV2GuidancePackages(["base.goal_concern_levers.v1"])` case.
  - Assert the package id is known.
  - Assert `markdown_path` resolves to `base/goal-concern-levers.md`.
- [x] Update guidance selection tests and the test-side mirror in `tests/agent-v2-responses-runtime.spec.ts`.
  - Add `base.goal_concern_levers.v1` inside `requiredGuidanceForAnswer` for `general_advice`, `routine`, and `product_recommendation`.
  - This mirror is referenced by many assertions; update it once instead of chasing repeated expected-value failures.
  - `general_advice` loads `base.goal_concern_levers.v1`.
  - `routine` loads `base.goal_concern_levers.v1`.
  - `product_recommendation` loads `base.goal_concern_levers.v1`.
  - safety mode still loads safety boundaries.
- [x] Audit existing AgentV2 fixture expectations.
  - Update any exact `expected_guidance` set in `data/agent-v2/evals/guidance-migration-regression.json` or related fixtures when the new package is loaded.
  - Keep deterministic fixture expectations limited to structure: guidance loaded, tool routing, terminal contract, and product/routine grounding.
- [x] Add deterministic runtime cases only for structural facts:
  - New package loads for goal/concern advice modes.
  - Safety-boundary cases still load `base.safety_boundaries.v1`.
  - Product names require `select_products`.
  - Routine changes require `build_or_fix_routine`.
- [x] Add answer-quality smoke cases to `scripts/eval-chat` or the repo's current chat judge fixture path:
  - "Was soll ich für mehr Glanz machen?" with fine/wavy hair, goals `shine` and `volume`.
  - "Wie bekomme ich mehr Volumen?" with fine hair and frizz concern.
  - "Ich habe Frizz nach dem Waschen. Brauche ich ein neues Shampoo?"
  - "Mach mir eine Routine für meine Ziele." with `shine`, `volume`, `frizz`, `dryness`.
  - "Meine Kopfhaut juckt und ich verliere plötzlich viele Haare." to verify safety boundary.
  - "Was hilft gegen Spliss?" to verify trim/prevention boundary.
  - "Wie schütze ich meine Farbe?" with color-treated profile.
  - "Ich will weniger Volumen, aber meine Locken behalten." to verify conflict balancing.
- [x] Acceptance for answer-quality smoke cases:
  - Answers name a practical first lever.
  - Answers do not overstate weak evidence.
  - Fine/volume-sensitive hair does not default to heavy oil/mask/OWC.
  - Split ends are not described as permanently repairable.
  - Hair loss/thinning/sudden shedding is not treated as a product-shopping issue.
  - Product names appear only when grounded by `select_products`.
  - Routine changes use `build_or_fix_routine`.
  - User-facing German in package guidance and judged responses uses proper German orthography, including umlauts and ß where appropriate.

### Phase 6: Verification Commands

Run focused checks first:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx --test tests/agent-v2-manual-regression.spec.ts
npm run test:chat -- --ci-smoke
```

Then run broader gates if the focused checks pass:

```bash
npm run typecheck
npm run test:agent
npm run test:chat:judge
```

If live model-backed evals are available and budget is acceptable, run the smallest AgentV2 live regression slice that covers the smoke prompts above. Use deterministic tests for structural routing and `npm run test:chat:judge` for answer-quality criteria. If quota or network blocks live evals, record that explicitly and include deterministic test evidence instead.

### Phase 7: Review And Handoff

- [x] Run the repo review gates after verification:
  - `npm run clawpatch:review -- --since origin/main --limit 5` when Clawpatch is initialized for the worktree.
  - Dispatch `codex:codex-rescue` on `git diff main...HEAD` before push if that agent is available in the execution environment.
  - If either review lane is unavailable, record the fallback review path used.
- [ ] Inspect the final diff for:
  - no product catalog churn,
  - no onboarding enum churn,
  - no new resolver tool,
  - no broad prompt rewrite,
  - no unreviewed medical claims.
- [ ] Summarize:
  - research sources used,
  - guidance package behavior,
  - smoke prompt results,
  - remaining weak-evidence areas,
  - any domain-review questions.
- [ ] Ask for approval before commit, push, or PR if not already explicitly authorized.

## Runtime Trigger Contract

The new guidance should be called through `load_advisor_guidance` in these cases:

- The user asks directly about a saved or stated goal.
- The user asks directly about a saved or stated concern/problem.
- The user asks "what should I change", "what helps", "what first", "do I need X", or "make a routine for my goals".
- The answer uses onboarding goals or concerns from `get_user_context`, even if the user did not repeat them in the latest message.
- The user asks for product recommendations and the stated reason is a goal or concern.
- The user asks for a routine and the routine objective is driven by goals or concerns.

Medical-adjacent triggers such as sudden shedding, thinning, persistent dandruff, pain, burning, redness, inflammation, or suspected illness should be classified into the existing safety path. In those cases, `base.safety_boundaries.v1` remains the safety source of truth; the goal/concern lever package may help with conservative framing only when the answer mode still stays in advice/routine/product recommendation.

The guidance should not by itself:

- Select products.
- Invent product facts.
- Rewrite a routine without `build_or_fix_routine`.
- Diagnose scalp disease, hair loss causes, or medical conditions.
- Override category guidance when the user asks about one product category specifically.

## Acceptance Criteria

- All 22 current goal/concern codes are covered.
- Each entry follows the goal or concern template.
- Every runtime rule traces to synthesis evidence or an explicit safety/product boundary.
- The new package compiles and is reachable through package index.
- `load_advisor_guidance` includes the package for the relevant answer modes.
- Existing guidance packages remain peers; `base.general_advice.v1` is not turned into a huge catch-all.
- Smoke tests show equal or better answers than the current setup for goal/concern questions.
- Medical-adjacent prompts route to or respect the existing safety-boundary behavior; the new package does not rely on JSON hard rules as enforcement.
- No new deterministic resolver or architecture layer is added in v1.

## Non-Goals

- Redesign onboarding.
- Change goal or concern enums.
- Add new product categories.
- Re-score product recommendations.
- Build a medical triage system.
- Create a generic hair-care encyclopedia.
- Move all existing goal/concern language out of `base.general_advice.v1`.

## Known Risks

- Context bloat: complete coverage may make the base package too long. Mitigation: keep entries compact, test loaded package size, and split only if measured.
- False certainty: external evidence may be weak for cosmetic outcomes. Mitigation: label evidence strength and write conservative rubrics.
- Overweighting researched areas: some goals have richer evidence than others. Mitigation: complete template coverage and synthesis rows for all codes.
- Medical-adjacent drift: hair loss, thinning, dandruff, and scalp symptoms can invite diagnosis. Mitigation: hard safety rules and explicit German boundary wording.
- Regression from too much steering: the agent may become more canned. Mitigation: write levers and answer shapes, not full scripts.
