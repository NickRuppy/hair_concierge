# Agentic Overlay Guidance Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plug the harmonized overlay guidance into the agentic guidance/tool-loop path and make the next Compare Lab round target the three small quality gaps from the latest run: routine next-step framing, product-pick richness, and leave-in-vs-conditioner nuance.

**Architecture:** Keep deterministic product/routine tools authoritative. Import the standardized overlay markdown and register the new overlay IDs, then let the existing `load_advisor_guidance` and consultation brief paths select the right overlays through profile-aware, relevance-ranked logic. Do not add new agent tools or route rewrites in this pass.

**Tech Stack:** Next.js/TypeScript, local markdown guidance catalog, Node test runner via `tsx --test`, Compare Lab at `/labs/agent-compare`.

---

## Source Context

- Current worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer`
- Overlay source worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/overlay-guidance-standardization`
- Overlay source branch: `codex/overlay-guidance-standardization`
- Important caution: the overlay branch is older than this worktree in some agentic guidance files. Import overlay-specific files and overlay-specific contract/catalog/test ideas only. Do not wholesale copy `src/lib/agent/contracts.ts`, `src/lib/agent/guidance/catalog.ts`, or `tests/agent-guidance.spec.ts`.

## Promised End-State

- All standardized overlay markdown files from the overlay worktree are available through `loadGuidance`.
- The agent can request/use the new overlay focus values:
  - `low_density_weight_sensitive`
  - `frizz_control`
  - `tangling_detangling`
  - `protein_moisture_balance`
  - `chemical_or_color_treated`
  - `hair_loss_or_thinning_guardrail`
- Profile-derived overlays are richer but bounded by a relevance-ranked budget, not a naive first-three slice.
- Routine-basics answers end by steering to goals vs problems, not generic optional categories.
- Product recommendations are prompted to use supported claims/comparison facts more richly.
- Conditioner-vs-leave-in conceptual answers include the nuance that leave-in can sometimes replace conditioner, while keeping conditioner as the default baseline unless data/context supports replacement.

## Non-Goals

- Do not wire tool-loop into production chat.
- Do not add a new tool beyond `load_advisor_guidance`, `select_products`, and `build_or_fix_routine`.
- Do not make pair-specific category-comparison docs for every product pair.
- Do not loosen deterministic product ranking or claims rules.
- Do not import unrelated overlay-branch changes to topics/playbooks/routines unless explicitly required by the overlay docs.

## Target File Map

- Import/modify overlay markdown:
  - `data/agent-guidance/overlays/*.md`
- Register overlay IDs:
  - `src/lib/agent/contracts.ts`
  - `src/lib/agent/guidance/catalog.ts`
- Select and project overlays:
  - `src/lib/agent/tools/get-user-context.ts`
  - `src/lib/agent/tools/load-advisor-guidance.ts`
  - `src/lib/agent/orchestrator/tool-definitions.ts`
  - `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
- Small answer-quality fixes:
  - `src/lib/agent/orchestrator/agentic-answer-context.ts`
  - `data/agent-guidance/topics/leave-in/core-fit.md`
  - `data/agent-guidance/topics/conditioner/core-fit.md`
  - `data/agent-guidance/playbooks/category-comparison.md`
- Tests:
  - `tests/agent-guidance.spec.ts`
  - `tests/agentic-tool-loop.spec.ts`

---

### Task 1: Import Harmonized Overlay Docs And Catalog IDs

**Files:**
- Create/copy: `data/agent-guidance/overlays/chemical-or-color-treated.md`
- Create/copy: `data/agent-guidance/overlays/frizz-control.md`
- Create/copy: `data/agent-guidance/overlays/hair-loss-or-thinning-guardrail.md`
- Create/copy: `data/agent-guidance/overlays/low-density-weight-sensitive.md`
- Create/copy: `data/agent-guidance/overlays/protein-moisture-balance.md`
- Create/copy: `data/agent-guidance/overlays/tangling-detangling.md`
- Replace content from overlay source for existing overlay files under `data/agent-guidance/overlays/`
- Modify: `src/lib/agent/contracts.ts`
- Modify: `src/lib/agent/guidance/catalog.ts`
- Test: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Write failing catalog coverage tests**

Add or merge these assertions into `tests/agent-guidance.spec.ts` without removing the existing multi-category guidance tests:

```ts
const REQUIRED_OVERLAY_SECTIONS = [
  "Use when:",
  "Advisor interpretation:",
  "Category implications:",
  "- Shampoo:",
  "- Conditioner:",
  "- Leave-in:",
  "- Mask:",
  "- Oil:",
  "- Bondbuilder / repair:",
  "Routine implications:",
  "Avoid:",
  "Ask only if:",
  "Proactive next step:",
] as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

test("overlay guidance uses normalized advisor sections", async () => {
  const overlayIds = GUIDANCE_IDS.filter((id): id is GuidanceId => id.startsWith("overlay:"))
  const result = await loadGuidance(overlayIds)

  assert.equal(result.items.length, overlayIds.length)

  for (const item of result.items) {
    assert.equal(item.kind, "overlay", item.id)
    assert.match(item.content, /^# \S.+/m, item.id)

    for (const section of REQUIRED_OVERLAY_SECTIONS) {
      assert.match(item.content, new RegExp(`^${escapeRegExp(section)}`, "m"), item.id)
    }
  }
})
```

Also extend the existing “loads every callable v1 guidance kind” test with the six new overlay IDs.

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: fail because the new overlay IDs are not registered or files do not exist in this worktree yet.

- [ ] **Step 3: Import overlay markdown only**

Copy the markdown files from:

```text
/Users/nick/AI_work/hair_conscierge/.worktrees/overlay-guidance-standardization/data/agent-guidance/overlays/
```

into:

```text
/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/data/agent-guidance/overlays/
```

Do not copy playbooks/topics/routines from the overlay branch in this task.

- [ ] **Step 4: Register the six new overlay IDs**

Add these to `GUIDANCE_IDS` in `src/lib/agent/contracts.ts`:

```ts
"overlay:low_density_weight_sensitive",
"overlay:frizz_control",
"overlay:tangling_detangling",
"overlay:protein_moisture_balance",
"overlay:chemical_or_color_treated",
"overlay:hair_loss_or_thinning_guardrail",
```

Add matching entries in `src/lib/agent/guidance/catalog.ts`:

```ts
"overlay:low_density_weight_sensitive": {
  kind: "overlay",
  title: "Low Density / Weight Sensitive",
  path: "data/agent-guidance/overlays/low-density-weight-sensitive.md",
},
"overlay:frizz_control": {
  kind: "overlay",
  title: "Frizz Control",
  path: "data/agent-guidance/overlays/frizz-control.md",
},
"overlay:tangling_detangling": {
  kind: "overlay",
  title: "Tangling / Detangling",
  path: "data/agent-guidance/overlays/tangling-detangling.md",
},
"overlay:protein_moisture_balance": {
  kind: "overlay",
  title: "Protein / Moisture Balance",
  path: "data/agent-guidance/overlays/protein-moisture-balance.md",
},
"overlay:chemical_or_color_treated": {
  kind: "overlay",
  title: "Chemical Or Color Treated",
  path: "data/agent-guidance/overlays/chemical-or-color-treated.md",
},
"overlay:hair_loss_or_thinning_guardrail": {
  kind: "overlay",
  title: "Hair Loss Or Thinning Guardrail",
  path: "data/agent-guidance/overlays/hair-loss-or-thinning-guardrail.md",
},
```

- [ ] **Step 5: Re-run overlay coverage**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: pass for catalog/markdown coverage, or fail only on tests that need resolver updates in Task 2.

---

### Task 2: Wire Overlay Selection With A Relevance Budget

**Files:**
- Modify: `src/lib/agent/tools/get-user-context.ts`
- Modify: `src/lib/agent/tools/load-advisor-guidance.ts`
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
- Modify: `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
- Test: `tests/agent-guidance.spec.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Write failing resolver tests**

Add tests proving profile overlays are selected and budgeted intentionally:

```ts
test("loadAdvisorGuidance derives harmonized overlays from profile signals", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "category_explanation",
    category: "conditioner",
    categories: [],
    profileFocus: [],
    message: "was brauche ich gegen frizz und trockene laengen?",
    userContext: createUserContext({
      profile: createHairProfile({
        hair_texture: "wavy",
        thickness: "fine",
        density: "low",
        concerns: ["dryness", "frizz", "tangling"],
        goals: ["less_frizz"],
        protein_moisture_balance: "stretches_stays",
        chemical_treatment: ["colored"],
        scalp_type: "balanced",
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("overlay:dry_lengths"))
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:frizz_control"))
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:fine_hair"))
  assert.ok(guidance.loaded_guidance_ids.length <= 1 + 4) // topic + overlay budget
})

test("hair loss guardrail overlay is prioritized over cosmetic overlays", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "problem_context",
    category: "general_haircare",
    categories: [],
    profileFocus: ["hair_loss_or_thinning_guardrail", "frizz_control", "dry_lengths"],
    message: "ich habe ploetzlich haarausfall und frizz, was tun?",
    userContext: createUserContext({
      profile: createHairProfile({
        thickness: "fine",
        density: "low",
        concerns: ["hair_loss", "dryness", "frizz", "tangling"],
        scalp_condition: "irritated",
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("overlay:hair_loss_or_thinning_guardrail"))
  assert.ok(guidance.avoid.some((line) => /diagnose|regrowth|hair-loss/i.test(line)))
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: fail because the new overlay focus enum, schema enum, and derived overlay logic are not wired yet.

- [ ] **Step 3: Add the new profile focus values**

In `src/lib/agent/tools/load-advisor-guidance.ts`, extend `ADVISOR_PROFILE_FOCUS` and `PROFILE_FOCUS_OVERLAY_ID` with:

```ts
"low_density_weight_sensitive",
"frizz_control",
"tangling_detangling",
"protein_moisture_balance",
"chemical_or_color_treated",
"hair_loss_or_thinning_guardrail",
```

In `src/lib/agent/orchestrator/tool-definitions.ts`, extend the `load_advisor_guidance.profileFocus` enum with the same values.

- [ ] **Step 4: Add profile-aware compatibility rules**

Update `isProfileFocusCompatible` and `deriveProfileOverlayIds` so these conditions work:

```ts
low_density_weight_sensitive:
  profile.density === "low"

frizz_control:
  profile.concerns.includes("frizz") || profile.goals.includes("less_frizz")

tangling_detangling:
  profile.concerns.includes("tangling")

protein_moisture_balance:
  Boolean(profile.protein_moisture_balance)

chemical_or_color_treated:
  (profile.chemical_treatment ?? []).some((treatment) => treatment !== "natural") ||
  profile.goals.includes("color_protection")

hair_loss_or_thinning_guardrail:
  profile.concerns.includes("hair_loss") || profile.concerns.includes("thinning")
```

Also broaden existing overlay derivation:

```ts
damage_repair:
  chemical treatment OR hair_damage OR breakage OR split_ends

heat_styling:
  profile.heat_styling && profile.heat_styling !== "never"

mechanical_stress:
  heat styling OR styling tools OR brush/drying friction signals
```

- [ ] **Step 5: Replace naive overlay cap with ranked budget**

Keep a compact context budget, but make it priority-aware. Recommended shape:

```ts
const MAX_OVERLAYS = 4

const OVERLAY_PRIORITY: Record<GuidanceId, number> = {
  "overlay:hair_loss_or_thinning_guardrail": 100,
  "overlay:dandruff_scalp": 95,
  "overlay:sensitive_scalp": 90,
  "overlay:oily_scalp": 80,
  "overlay:dry_lengths": 75,
  "overlay:frizz_control": 74,
  "overlay:tangling_detangling": 72,
  "overlay:fine_hair": 70,
  "overlay:low_density_weight_sensitive": 69,
  "overlay:curly_hair": 65,
  "overlay:coily_hair": 65,
  "overlay:heat_styling": 60,
  "overlay:mechanical_stress": 58,
  "overlay:buildup_risk": 56,
  "overlay:chemical_or_color_treated": 54,
  "overlay:damage_repair": 52,
  "overlay:protein_moisture_balance": 50,
  "overlay:minimal_routine": 45,
}
```

Use stable sorting: higher priority first, original insertion order as tie-breaker. Do not globally sort `loaded_guidance_ids`; only rank the overlay subset before appending.

- [ ] **Step 6: Let consultation brief see the richer suggested overlays**

Update `deriveSuggestedOverlays` in `src/lib/agent/tools/get-user-context.ts` with the same profile-derived overlay set. Keep the consultation brief compact by continuing to load only `suggested_overlays`, but rely on the ranked output from the source function.

- [ ] **Step 7: Re-run focused tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: pass.

---

### Task 3: Tighten The Three Small Answer-Quality Gaps

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Modify: `data/agent-guidance/topics/leave-in/core-fit.md`
- Modify: `data/agent-guidance/topics/conditioner/core-fit.md`
- Modify: `data/agent-guidance/playbooks/category-comparison.md`
- Test: `tests/agentic-tool-loop.spec.ts`
- Test: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Add failing prompt/context tests**

Add tests that verify the context/prompt surface, not a brittle model answer:

```ts
test("routine basics answer context preserves goals-or-problems next step", async () => {
  const result = await runAgenticToolTurn({
    message: "Ich moechte meine Routine anpassen.",
    recentMessages: [],
    modelClient: createScriptedToolLoopModelClient([
      { type: "tool_calls", calls: [{ name: "build_or_fix_routine", input: { objective: "build_routine", layer: "basics" } }] },
      { type: "tool_calls", calls: [{ name: "submit_final_answer", input: { answer: "Routine answer.", state_patch: { active_topic: "routine", routine_layer: "basics", pending_offer: "routine_goals_or_problems", last_assistant_action: "answered_routine_basics" } } }] },
    ]),
    tools: createStubTools(),
    userContext: createUserContext(),
    consultationBrief: null,
    conversationState: null,
  })

  assert.match(JSON.stringify(result.tool_loop_trace), /goals|problems|Ziele|Probleme/i)
})
```

If the existing test helpers differ, adapt to local helper names in `tests/agentic-tool-loop.spec.ts`; the point is to assert that the answer context sent to the model contains explicit goals/problems closing guidance for routine basics.

Add a product-richness assertion around existing conditioner/leave-in product tests:

```ts
assert.match(serializedMessages, /supported_claims|comparison_facts|profile_basis|category_guidance/)
assert.match(serializedMessages, /echte Unterschiede|belegte.*Unterschiede|aehnlich/i)
```

Add a guidance test for conditioner-vs-leave-in nuance:

```ts
test("conditioner and leave-in guidance preserves replacement nuance", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "compare_or_decide",
    category: null,
    categories: ["conditioner", "leave_in"],
    profileFocus: ["dry_lengths"],
    message: "warum keinen leave in statt conditioner?",
    userContext: createUserContext(),
    conversationState: null,
  })

  const text = [
    ...guidance.key_advice_points,
    ...guidance.category_sections.flatMap((section) => section.key_points),
  ].join("\n")

  assert.match(text, /replace|ersetzen|replacement/i)
  assert.match(text, /baseline|Basis|Pflegeanker/i)
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: fail on the newly added assertions.

- [ ] **Step 3: Strengthen routine-basics answer context**

In `src/lib/agent/orchestrator/agentic-answer-context.ts`, add a dedicated capsule or strengthen `routine.layered_answer` so routine basics always says:

```text
Bei routine_layer=basics: Nach Shampoo, Conditioner und dem autoritativen dritten Hebel nicht generisch weitere Kategorien anbieten. Schliesse mit genau der Entscheidung: ob die Nutzerin als Naechstes eher in Richtung Ziele oder konkrete Probleme weitergehen will.
```

Prefer adding a small capsule such as `routine.basics_next_choice` that is only included when `routinePlan` exists and the latest routine layer is `basics`.

- [ ] **Step 4: Strengthen product recommendation context**

Update the `product.recommendation_shape` capsule to explicitly name the data the model should use:

```text
Nutze selected_products.profile_basis fuer den Profilanker, selected_products.products[*].supported_claims fuer belegte Produktgruende, comparison_facts fuer Unterschiede, und category_guidance fuer die Kategorieeinordnung. Wenn die Tool-Fakten kaum Unterschiede zeigen, sage das offen statt Unterschiede zu erfinden.
```

Do not add new product facts or deterministic product sorting.

- [ ] **Step 5: Add leave-in replacement nuance to category guidance**

Update `data/agent-guidance/topics/leave-in/core-fit.md` and `data/agent-guidance/topics/conditioner/core-fit.md` with the nuance:

```text
Leave-in can replace conditioner only in some cases: when the selected product data supports a replacement-capable role, the user's routine preference supports simplification, and the hair tolerates leave-on care. Default explanation: conditioner remains the baseline rinse-out length-care anchor; leave-in is usually a booster or simplification candidate, not an automatic replacement.
```

Add a short line to `data/agent-guidance/playbooks/category-comparison.md` under decision axes or guardrails:

```text
For replacement questions, distinguish default category role from conditional replacement capability.
```

- [ ] **Step 6: Re-run focused tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: pass.

---

### Task 4: Full Verification And Compare Lab Smoke Run

**Files:**
- No new files expected.

- [ ] **Step 1: Run TypeScript and diff checks**

Run:

```bash
npm run typecheck
git diff --check
```

Expected: both pass.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: all pass.

- [ ] **Step 3: Optional broader regression tests**

Run if time permits:

```bash
npx tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts tests/agent-select-products-tool.spec.ts tests/agent-routine-tool.spec.ts
```

Expected: pass. If unrelated pre-existing failures appear, document them with exact failing test names.

- [ ] **Step 4: Restart Compare Lab**

Run:

```bash
npm run dev:worktree
```

Open:

```text
http://localhost:3274/labs/agent-compare
```

- [ ] **Step 5: Manual smoke prompts**

Use `Produkt-Evaluation` / `guidance_tool`, blinded if desired:

```text
Ich möchte meine Routine anpassen.
ok und welcher conditioner passt
ok und warum keinen leave in statt conditioner?
ok und wann würde ich maske oder öl nutzen
```

Expected:
- routine basics closes with goals/problems direction;
- conditioner answer gives richer product reasons without inventing claims;
- leave-in-vs-conditioner says leave-in can sometimes replace conditioner but conditioner is the default baseline;
- mask-vs-oil still loads both category docs and explains roles;
- debug/advisor guidance includes relevant overlays such as `dry_lengths`, `frizz_control`, `chemical_or_color_treated`, or `protein_moisture_balance` where profile-compatible.

Also smoke a safety case:

```text
Ich habe plötzlich Haarausfall und meine Haare werden dünner, welches Öl hilft?
```

Expected:
- no regrowth promise;
- cosmetic advice stays bounded;
- hair-loss guardrail language appears softly and safely;
- no scalp-oil treatment framing.

---

## Execution Handoff

Recommended execution: `superpowers:subagent-driven-development`.

Suggested worker split:
- Worker 1: Task 1 overlay import/catalog/tests.
- Worker 2: Task 2 overlay resolver/schema/context plumbing.
- Worker 3: Task 3 answer-quality prompt/content tweaks.

Run review after Task 2 and after Task 3 because those touch behavior the Compare Lab is meant to judge.
