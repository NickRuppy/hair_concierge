# Agentic Product-Evaluation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Compare Lab Product-Evaluation variant more structured, explanatory, profile-accurate, and advisor-like while preserving its one-loop architecture and multi-turn intent advantage.

**Architecture:** Keep Product-Evaluation as a one-loop agent. Fix facts at the tool/context boundary, then strengthen the answer-context editorial contract so the model renders richer answers without a Composer call. Compare Lab remains the test surface; production chat wiring is out of scope.

**Tech Stack:** Next.js / TypeScript, Node test runner via `tsx --test`, Playwright for existing browser/API specs, local Compare Lab at `/labs/agent-compare`.

---

## Spec

- Spec: `docs/superpowers/specs/2026-05-11-agentic-product-evaluation-polish-design.md`
- User situation: Latest Compare Lab Product-Evaluation runs show strong intent carry but weaker final advice polish.
- Promised end-state: Product-Evaluation keeps its 1-call candidate shape and produces more structured, helpful, profile-grounded answers in the next Compare Lab run.

## Target File Map

- Modify: `src/lib/agent/tools/load-advisor-guidance.ts`
  - Normalize and prioritize profile overlays so model-requested overlays cannot override actual profile context.
- Modify: `tests/agent-guidance.spec.ts`
  - Cover overlay priority, incompatible model-requested overlays, and derived profile overlays.
- Modify: `src/lib/agent/tools/select-products.ts`
  - Sanitize internal fallback vocabulary from agent-facing product payloads and expose richer safe comparison facts.
- Modify: `tests/agent-select-products-tool.spec.ts`
  - Cover no `Fallback` vocabulary in product projections and enough comparison facts for conditioner, leave-in, and mask payloads.
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
  - Strengthen answer-context capsules for product recommendations, product-plus-usage, conceptual add-ons, proactive next steps, and routine anchoring.
- Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Add concise global render rules for structure, thoroughness, one next step, no internal vocabulary, and avoiding redundant guidance calls after product tools.
- Modify: `tests/agentic-tool-loop.spec.ts`
  - Verify answer-context capsule selection and prompt contract for the tested failure modes.
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
  - Ensure routine plan projections clearly mark existing versus added steps in model-facing reasons when enough current routine data is present.
- Modify: `tests/agent-routine-tool.spec.ts`
  - Cover routine basics anchoring with a current shampoo-only routine.
- Optional modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
  - Add small per-run debug visibility for model step count and redundant guidance detection if not already clear from `analysis_snapshot`.

## Scope Boundaries

- Product-Evaluation is the candidate variant.
- Do not wire production chat.
- Do not add Composer back as the default.
- Do not change product ranking algorithms unless required to keep exposed facts internally consistent.
- Keep all user-facing copy German; keep code/comments ASCII.

---

### Task 1: Make advisor guidance profile overlays authoritative

**Files:**
- Modify: `tests/agent-guidance.spec.ts`
- Modify: `src/lib/agent/tools/load-advisor-guidance.ts`

- [ ] **Step 1: Add failing overlay-priority tests**

Add tests near the existing `resolveAdvisorGuidanceIds` tests:

```ts
test("resolveAdvisorGuidanceIds ignores incompatible model-requested overlays", () => {
  const userContext: UserContextProjection = {
    profile: {
      hair_texture: "straight",
      thickness: "coarse",
      concerns: [],
      scalp_type: "balanced",
      heat_styling: "daily",
      chemical_treatment: ["natural"],
      current_routine_products: ["shampoo"],
    } as NonNullable<UserContextProjection["profile"]>,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: ["Haardicke: Dick", "Kopfhaut: Ausgeglichen", "Waschrhythmus: Taeglich"],
    suggested_overlays: [],
    missing_profile: [],
  }

  assert.deepEqual(
    resolveAdvisorGuidanceIds({
      intent: "usage",
      category: "conditioner",
      profileFocus: [
        "fine_hair",
        "oily_scalp",
        "dry_lengths",
        "heat_styling",
        "damage_repair",
      ],
      message: "welcher conditioner und wie wende ich den an?",
      userContext,
      conversationState: null,
    }),
    ["playbook:usage_and_application", "topic:conditioner", "overlay:heat_styling"],
  )
})

test("resolveAdvisorGuidanceIds keeps matching suggested and derived overlays before requested extras", () => {
  const userContext: UserContextProjection = {
    profile: {
      hair_texture: "wavy",
      thickness: "normal",
      concerns: ["dryness", "frizz"],
      scalp_type: "balanced",
      heat_styling: "sometimes",
      chemical_treatment: ["colored"],
      current_routine_products: ["shampoo", "conditioner"],
    } as NonNullable<UserContextProjection["profile"]>,
    routine_inventory: [],
    relevant_memory: [],
    derived_signals: ["Trockene Laengen", "Frizzige Laengen"],
    suggested_overlays: ["overlay:dry_lengths"],
    missing_profile: [],
  }

  assert.deepEqual(
    resolveAdvisorGuidanceIds({
      intent: "category_explanation",
      category: "conditioner",
      profileFocus: ["fine_hair", "dry_lengths", "damage_repair"],
      message: "mein conditioner ist vielleicht zu schwer",
      userContext,
      conversationState: null,
    }),
    ["topic:conditioner", "overlay:dry_lengths", "overlay:damage_repair"],
  )
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: the new tests fail because overbroad `profileFocus` values are accepted before profile-derived overlays.

- [ ] **Step 3: Implement profile-compatible overlay resolution**

In `src/lib/agent/tools/load-advisor-guidance.ts`:

- Change overlay resolution order to:
  1. `deriveProfileOverlayIds(input.userContext)`
  2. `input.userContext.suggested_overlays`
  3. compatible model-requested `profileFocus`
- Add a compatibility check so a requested overlay is accepted only when it matches profile facts or no profile fact can contradict it.
- Keep `MAX_OVERLAYS = 3`.

Implementation shape:

```ts
const profileOverlayIds = unique([
  ...deriveProfileOverlayIds(input.userContext),
  ...input.userContext.suggested_overlays.filter((id) => id.startsWith("overlay:")),
  ...input.profileFocus
    .filter((focus) => isProfileFocusCompatible(focus, input.userContext))
    .map((focus) => PROFILE_FOCUS_OVERLAY_ID[focus]),
]).slice(0, MAX_OVERLAYS)
```

Add:

```ts
function isProfileFocusCompatible(
  focus: AdvisorProfileFocus,
  userContext: UserContextProjection,
): boolean {
  const profile = userContext.profile
  if (!profile) return true

  if (focus === "fine_hair") return profile.thickness === "fine"
  if (focus === "curly_hair") return profile.hair_texture === "curly"
  if (focus === "coily_hair") return profile.hair_texture === "coily"
  if (focus === "oily_scalp") return profile.scalp_type === "oily"
  if (focus === "dry_lengths") {
    return (profile.concerns ?? []).some((concern) =>
      ["dryness", "dry_lengths", "frizz"].includes(concern),
    )
  }
  if (focus === "heat_styling") {
    return ["daily", "several_weekly", "once_weekly"].includes(profile.heat_styling ?? "")
  }
  if (focus === "damage_repair") {
    return (profile.chemical_treatment ?? []).some((treatment) => treatment !== "natural") ||
      profile.cuticle_condition === "rough" ||
      profile.cuticle_condition === "slightly_rough"
  }
  if (focus === "sensitive_scalp") return profile.scalp_condition === "irritated"
  if (focus === "dandruff_scalp") return profile.scalp_condition === "dandruff"
  if (focus === "minimal_routine") {
    return profile.routine_preference === "minimal" ||
      /einfach|minimal|kurz/i.test(profile.additional_notes ?? "")
  }
  if (focus === "mechanical_stress") {
    return profile.towel_technique === "rubbeln" ||
      profile.brush_type === "classic_brush" ||
      profile.drying_method === "blow_dry"
  }
  if (focus === "buildup_risk") {
    return (profile.current_routine_products ?? []).includes("oil") ||
      /oel|gel|wachs|styling/i.test(profile.products_used ?? "")
  }

  return true
}
```

Update `deriveProfileOverlayIds` with the same profile-backed overlays so the first three overlays are the most factual.

- [ ] **Step 4: Verify guidance tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: all tests pass.

---

### Task 2: Sanitize internal vocabulary and enrich product comparison facts

**Files:**
- Modify: `tests/agent-select-products-tool.spec.ts`
- Modify: `src/lib/agent/tools/select-products.ts`

- [ ] **Step 1: Add failing tests for no internal fallback vocabulary**

Add tests that exercise a mismatch/fallback projection for at least leave-in and mask. The assertion should scan the full projected payload:

```ts
function assertNoInternalFallbackText(value: unknown) {
  const serialized = JSON.stringify(value)
  assert.doesNotMatch(serialized, /Fallback/i)
}
```

For existing product fixtures that produce mismatch/supportive options, assert:

```ts
assertNoInternalFallbackText(result)
```

Also assert that weaker options are still naturally visible:

```ts
assert.match(JSON.stringify(result), /schwaecher|nachgeordnet|unterstuetzend|weicht/i)
```

- [ ] **Step 2: Add comparison-fact richness tests**

For conditioner, leave-in, and mask recommendation projections, assert every product has at least two safe comparison facts when structured metadata is available:

```ts
for (const product of result.products) {
  const facts = result.comparison_facts?.[product.product_id] ?? []
  assert.ok(facts.length >= 2, `${product.name} should expose comparison facts`)
}
```

Keep exceptions for categories where the underlying data genuinely has fewer facts.

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts
```

Expected: at least one test fails because labels such as `Fallback-Treffer`, `Fallback-Abweichung`, `Caveat: Fallback`, or `Fallback: ja/nein` are exposed.

- [ ] **Step 4: Replace exposed fallback labels with user-safe labels**

In `src/lib/agent/tools/select-products.ts`, update label maps and comparison fact builders:

- Replace exposed `Fallback-Treffer` with `Schwaecherer Treffer`.
- Replace exposed `Fallback-Abweichung` with `weicht etwas ab`.
- Remove `Fallback: ja/nein` from comparison facts.
- Replace `Caveat: Fallback` with `Nachgeordnet: nicht ganz so passend`.

Concrete edits:

```ts
mismatch: "Schwaecherer Treffer"
```

and:

```ts
mismatch: "weicht etwas ab"
```

For `buildShampooComparisonFacts`, remove the `Fallback: ...` entry entirely.

For category comparison facts, keep enough useful non-internal facts by increasing category-specific slices from `slice(0, 2)` to `slice(0, 3)` where the facts are safe.

- [ ] **Step 5: Verify product tool tests**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts
```

Expected: all tests pass and no serialized result contains `Fallback`.

---

### Task 3: Strengthen answer-context rendering contracts

**Files:**
- Modify: `tests/agentic-tool-loop.spec.ts`
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`

- [ ] **Step 1: Add failing tests for richer capsules**

Add tests near `tool-loop injects answer context after product tools in inline mode`:

```ts
test("answer context asks product-plus-usage turns to answer both parts", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "select_products",
          input: { category: "conditioner", userJob: "product_pick" },
        },
      ],
    },
    {
      type: "final",
      answer: "Produkt plus Anwendung.",
      statePatch: {
        active_topic: "conditioner",
        last_product_category: "conditioner",
        topic_relation: "same_topic",
      },
    },
  ])

  await runAgenticToolTurn({
    message: "welcher conditioner ist gut und wie wende ich den an?",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  const serializedMessages = JSON.stringify(modelClient.requests.at(-1)?.messages)
  assert.match(serializedMessages, /product\\.usage_shape/)
  assert.match(serializedMessages, /welche Option passt/i)
  assert.match(serializedMessages, /wie du sie verwendest/i)
})
```

Add another prompt contract test:

```ts
test("agentic tool-loop prompt requires structured helpful rendering", () => {
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /kurze Einordnung/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /klar struktur/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /genau einen.*naechsten Schritt/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /Fallback.*nie/i)
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected: new tests fail because the current capsules/prompt do not consistently require product-plus-usage and structured helpful rendering.

- [ ] **Step 3: Update answer-context capsules**

In `src/lib/agent/orchestrator/agentic-answer-context.ts`:

- Make `product.recommendation_shape` more explicit:
  - short profile reason first
  - then distinct options
  - each option gets a concrete reason/tradeoff from tool facts
  - finish with one application/next-step sentence if relevant
- Change `addProductCapsules` so usage intent does not early-return when `selectedProducts` exists. Instead, add `product.usage_shape` and still add category recommendation capsules.
- Add language to `category.conditioner.recommend` that a conditioner answer should compare weight, balance, intensity, and first-choice rationale when supported.
- Add language to `category.mask.optional_decision` that conceptual mask add-ons should answer "optional, when useful, how it fits, offer picks".
- Keep `followup.proactive_next_step`, but make it say exactly one next step and avoid generic "let me know".

Implementation shape:

```ts
const hasUsage = params.latestUserJob === "usage" || hasUsageIntent(params.latestUserMessage)
if (hasUsage) {
  addCapsule(capsuleIds, "product.usage_shape")
  if (selectedProducts.category === "leave_in") {
    addCapsule(capsuleIds, "category.leave_in.usage")
  }
}

addCapsule(capsuleIds, "product.recommendation_shape")
```

Do not return early after adding `product.usage_shape`.

- [ ] **Step 4: Update global prompt contract**

In `src/lib/agent/orchestrator/prompt.ts`, add concise rules to `AGENTIC_TOOL_LOOP_PROMPT`:

```text
- Fuer nicht-triviale Beratungsantworten nutze eine klare, knappe Struktur: kurze Einordnung, dann konkrete Empfehlung/Optionen, dann Anwendung oder genau ein naechster Schritt.
- Sei lieber leicht erklaerender als zu knapp, solange die Antwort beim aktuellen Nutzer-Delta bleibt.
- Bei Produktantworten muss jedes genannte Produkt einen unterscheidbaren, belegten Grund oder Tradeoff haben.
- Bei kombinierten Fragen wie "welcher X und wie anwenden?" beantworte beides in derselben Antwort.
- Interne Woerter wie "Fallback", "Policy", "Tool", "Trace", "Capsule" oder "Guidance" nie ausgeben.
- Nach einem select_products-Tool nur dann zusaetzlich load_advisor_guidance aufrufen, wenn die Nutzerfrage eine separate Konzept-/Anwendungsentscheidung enthaelt, die nicht aus answer_context und Produktdaten beantwortbar ist.
```

- [ ] **Step 5: Verify agentic tool-loop tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected: all tests pass.

---

### Task 4: Anchor routine basics on existing user routine

**Files:**
- Modify: `tests/agent-routine-tool.spec.ts`
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`

- [ ] **Step 1: Add failing routine-anchor test**

In `tests/agent-routine-tool.spec.ts`, add:

```ts
test("projectRoutinePlan marks existing shampoo as keep and additions as next steps", () => {
  const result = projectRoutinePlan({
    objective: "build_routine",
    layer: "basics",
    message: "wie mache ich meine haare schoener",
    hairProfile: createProfile({
      hair_texture: "straight",
      thickness: "coarse",
      current_routine_products: ["shampoo"],
      products_used: "Shampoo",
      heat_styling: "daily",
      goals: ["less_split_ends"],
      concerns: [],
    }),
  })

  const shampooStep = result.steps.find((step) => step.category === "shampoo")
  const conditionerStep = result.steps.find((step) => step.category === "conditioner")

  assert.equal(shampooStep?.action, "keep")
  assert.match(shampooStep?.reasons.join(" ") ?? "", /bereits|schon|vorhanden|Startpunkt/i)
  assert.equal(conditionerStep?.action, "add")
  assert.match(conditionerStep?.reasons.join(" ") ?? "", /naechst|hinzufuegen|ergänzen|ergaenzen/i)
})
```

- [ ] **Step 2: Add answer-context routine-anchor test**

In `tests/agentic-tool-loop.spec.ts`, add:

```ts
test("answer context asks routine basics to anchor existing steps", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          name: "build_or_fix_routine",
          input: { objective: "build_routine", layer: "basics" },
        },
      ],
    },
    {
      type: "final",
      answer: "Routineantwort.",
      statePatch: { active_topic: "routine", routine_layer: "basics" },
    },
  ])

  await runAgenticToolTurn({
    message: "wie mache ich meine haare schoener",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({
        objective: "build_routine",
        steps: [
          {
            id: "base-shampoo",
            label: "Shampoo",
            necessity: "core",
            action: "keep",
            category: "shampoo",
            frequency: "Taeglich",
            reasons: ["Nutzer verwendet bereits Shampoo."],
            caveats: [],
            fillable: false,
          },
          {
            id: "base-conditioner",
            label: "Conditioner",
            necessity: "core",
            action: "add",
            category: "conditioner",
            frequency: "Nach jeder Waesche",
            reasons: ["Naechster Pflegeanker."],
            caveats: [],
            fillable: true,
          },
        ],
        missing_info: [],
        confidence: 1,
        priority_context: null,
      }),
    },
    userContext: createUserContext({
      profile: {
        current_routine_products: ["shampoo"],
      } as NonNullable<UserContextProjection["profile"]>,
    }),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  const serializedMessages = JSON.stringify(modelClient.requests.at(-1)?.messages)
  assert.match(serializedMessages, /routine\\.existing_steps_anchor/)
  assert.match(serializedMessages, /bereits/i)
})
```

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
npx tsx --test tests/agent-routine-tool.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: new routine-anchor assertions fail until reasons and capsules are added.

- [ ] **Step 4: Implement routine anchor support**

In `build-or-fix-routine.ts`:

- Ensure `action: "keep"` steps include a reason that says the user already has/uses this step when current routine data supports it.
- Ensure `action: "add"` core steps include a reason that frames them as the next addition.
- Do not change step ranking.

In `agentic-answer-context.ts`:

- Add capsule id `routine.existing_steps_anchor`.
- Add it when `routinePlan.steps.some((step) => step.action === "keep")`.
- Capsule instruction:

```text
Bei Routine-Basics zuerst anerkennen, was der Nutzer bereits macht. Schritte mit action=keep als vorhandenen Startpunkt formulieren; Schritte mit action=add als naechste sinnvolle Ergaenzung formulieren.
```

- [ ] **Step 5: Verify routine tests**

Run:

```bash
npx tsx --test tests/agent-routine-tool.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: all tests pass.

---

### Task 5: Add latency guardrails without changing the architecture

**Files:**
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Modify: `tests/agentic-tool-loop.spec.ts`
- Optional modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`

- [ ] **Step 1: Add prompt test for avoiding redundant guidance calls**

In `tests/agentic-tool-loop.spec.ts`, extend the prompt contract test:

```ts
assert.match(AGENTIC_TOOL_LOOP_PROMPT, /Nach einem select_products-Tool/i)
assert.match(AGENTIC_TOOL_LOOP_PROMPT, /nicht.*zusaetzlich.*load_advisor_guidance/i)
```

- [ ] **Step 2: Add lightweight trace flag if needed**

If the current `analysis_snapshot` is enough, skip code changes here. If implementation review says it is still hard to see redundant calls, add a debug line in `src/lib/agent/compare/run-agentic-tool-loop.ts`:

```ts
if (toolNames.includes("select_products") && toolNames.includes("load_advisor_guidance")) {
  lines.push("latency_note: product_and_guidance_same_turn")
}
```

- [ ] **Step 3: Verify no extra architecture was added**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: tests pass, Product-Evaluation still uses one model loop and no Composer call.

---

### Task 6: Regression verification and Compare Lab replay

**Files:**
- No production files unless previous tasks required optional debug-line changes.

- [ ] **Step 1: Run focused automated tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agent-select-products-tool.spec.ts tests/agent-routine-tool.spec.ts tests/agentic-tool-loop.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full safety checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected:

- Typecheck passes.
- Lint has no new errors. Existing unrelated warnings may remain.
- `git diff --check` passes.

- [ ] **Step 3: Restart the worktree dev server if needed**

Run if the current server is stale:

```bash
npm run dev:worktree
```

Expected: Compare Lab is available at the assigned local port, currently `http://localhost:3274/labs/agent-compare` when the existing server is running.

- [ ] **Step 4: Replay the latest failure-shaped prompts in Compare Lab**

Use Tool-Loop option `Produkt-Evaluation`, blinded on:

1. Lea:
   - `meine ahare sind heute fettig, was kann ich am besten machen`
   - `hmm vielleicht brauche ich mal einen neuen conditioner, vielleciht ist er zu schwer`
   - `ja welcher passt gut zu mir?`
2. Phil:
   - `ich will meine routine erneuern`
   - `ok und welcher leave-in denn?`
   - `mittlere dichte`
3. Dan:
   - `wie mache ich meine haare schöner`
   - `oh stimmt welcher conditioner ist denn gut und wie wende ich den an?`
   - `ok und dazu auch eine maske?`
   - `ja gerne zeig mir eine gute`

Expected manual signals:

- No user-facing `Fallback`.
- No clearly wrong profile overlays in Analyse-Snapshot guidance IDs.
- Product answers explain real differences instead of repeating the same line.
- Product-plus-usage answers cover recommendation and application.
- Routine opener mentions existing routine before additions.
- Conceptual mask add-on explains role before offering products.
- Latency is noted if same-turn product and guidance calls still occur.

- [ ] **Step 5: Request code review before another test batch**

Use:

```text
superpowers:requesting-code-review
```

Required review focus:

- no profile-incompatible overlays
- no internal vocabulary leakage
- no unsupported product claims introduced while enriching answers
- Product-Evaluation still does not depend on Composer

---

## Self-Review

- Spec coverage: all six user-observed issues map to Tasks 1-5; verification maps to Task 6.
- Scope: Compare Lab/Product-Evaluation only; production chat is excluded.
- Simplicity: no new tool, no new model call, no new deterministic renderer.
- Main risk: stronger render guidance could make answers slightly longer. This is intentional and should be checked in Compare Lab against the user's preference for more thorough explanations.

## Execution Handoff

Recommended next skill: `superpowers:subagent-driven-development`.

Use one worker for Task 1, one worker for Task 2, and one worker for Tasks 3-4 if write scopes can be kept coordinated. Keep Task 6 local in the parent session so verification and Compare Lab interpretation stay centralized.
