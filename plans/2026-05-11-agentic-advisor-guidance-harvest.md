# Agentic Advisor Guidance Harvest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contextualize the one-call Compare Lab `tool_loop` with compact deterministic advisory guidance so it preserves multi-turn strengths while reusing the richer classic recommendation logic.

**Architecture:** Add a small advisor-guidance projection layer around the existing consultation brief and answer context. Pre-tool context guides tool choice for category/routine overview turns; post-tool context harvests deterministic tool outputs into answer-shape capsules without changing product/routine authority.

**Tech Stack:** Next.js/TypeScript, Node test runner via `npx tsx --test`, existing Hair Concierge agent tools and Compare Lab.

---

## Spec

Design spec: `docs/superpowers/specs/2026-05-11-agentic-advisor-guidance-harvest-design.md`

## User Situation

Recent Compare Lab feedback shows the agentic tool loop is winning on multi-turn continuity and tool use, but loses some answer quality against classic because classic still has richer deterministic render guidance. The next iteration should not add a second LLM call; it should harvest existing deterministic logic into lightweight, relevant context for the one-call loop.

## Promised End-State

The user can test Compare Lab with `tool_loop` + `Kontext Inline` as the primary new variant. It should be clear that this is the same one-call tool loop, now with richer advisor context. Classic remains the baseline comparator. Composer remains available as an experiment but is not the target.

## Target File Map

- Modify: `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
  - Detect broad category/routine-extension questions such as "andere Produkte zusaetzlich zu Shampoo?"
  - Load routine/category guidance for these turns before tool choice

- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
  - Add answer capsules for leave-in heat consolidation, conceptual category topology, routine category overview with natural transition phrasing, and oil purpose preservation
  - Derive capsules from `selected_products`, `routinePlan`, latest message, and tool calls

- Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Add one lean tool-choice rule for broad category overview: use `build_or_fix_routine` basics, not `select_products`
  - Add one lean answer rule telling the LLM to treat answer context as advisory facts, not a template

- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Normalize routine-basics state when `build_or_fix_routine` answers `layer: "basics"`
  - Keep this inside Compare Lab tool-loop path only

- Modify: `tests/agentic-tool-loop.spec.ts`
  - Add prompt/tool-loop tests for broad category overview, leave-in carry, conceptual category restraint, routine-basics state, and oil purpose preservation

- Modify: `tests/agent-final-render-prompt.spec.ts`
  - Add answer-context capsule tests for the new post-tool advisory facts

- Modify: `tests/agent-guidance.spec.ts`
  - Add guidance loading tests proving relevant topic/playbook snippets are available and compact

- Modify: `plans/2026-05-05-agentic-tool-loop-eval-seed.md`
  - Add a verification pack from the latest feedback cases so future testers know exactly what to run

## Scope Boundaries

- Do not wire production chat.
- Do not depend on `ConversationContextPacketV1`.
- Do not change `select_products` ranking, product order, or product claims.
- Do not change `build_or_fix_routine` priority selection rules.
- Do not add an LLM-callable guidance-loading tool.
- Do not make Composer the primary test path.
- Do not force oil use-case clarification for conceptual oil questions; preserve it only for concrete oil product recommendations.
- For broad "what else should I add?" questions, routine basics are the default, but the final answer must bridge naturally into that structure and then offer the next goal/problem layer.

## Implementation Tasks

### Task 1: Add Failing Tests For Advisor Context

**Files:**
- Modify: `tests/agent-final-render-prompt.spec.ts`

- [ ] Add a leave-in heat-consolidation capsule test.

```ts
test("agentic answer context surfaces leave-in heat consolidation when tool facts support it", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "was sind die besten leave ins fuer mich",
    selectedProducts: {
      category: "leave_in",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten.",
      profile_basis: [
        "Haardicke: Fein",
        "Nutzer hat bereits separaten Hitzeschutz.",
      ],
      category_guidance:
        "Leave-in kann hier als Booster genutzt werden; Hitzeschutz ist nicht zwingend, kann aber Pflege plus Foehnschutz buendeln.",
      products: [
        {
          rank: 1,
          product_id: "leave-in-heat",
          name: "Heat Leave-in",
          brand: "Test",
          price_eur: 4.99,
          currency: "EUR",
          fit_reason: "Idealer Treffer",
          caveat: null,
          supported_claims: [
            {
              field: "heat_protection",
              value: "yes",
              evidence: "product_spec",
              label: "Hitzeschutz: Ja",
            },
          ],
          unsupported_requested_signals: [],
        },
      ],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "leave_in" } }],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("category.leave_in.heat_consolidation"))
  assert.match(context.instructions.join("\n"), /ein Produkt weniger in der Routine/)
})
```

- [ ] Add a conceptual topology capsule test.

```ts
test("agentic answer context gives conceptual category answers a stable topology", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "waere es wichtig einen leave-in in meine routine zu integrieren?",
    selectedProducts: null,
    routinePlan: null,
    toolCalls: [],
    conversationState: { version: 1, active_topic: "leave_in", routine_layer: null, pending_offer: null, answered_slots: [], last_assistant_action: "answered_direct", last_product_category: "leave_in" },
  })

  assert.ok(context.capsule_ids.includes("category.conceptual_topology"))
  assert.match(context.instructions.join("\n"), /direkte Antwort/)
  assert.match(context.instructions.join("\n"), /Profilgrund/)
})
```

- [ ] Run the focused test and confirm it fails because the new capsule IDs do not exist yet.

Run:

```bash
npx tsx --test tests/agent-final-render-prompt.spec.ts
```

Expected: FAIL with TypeScript or assertion errors for missing capsule IDs.

### Task 2: Implement Post-Tool Advisor Capsules

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] Extend `AgenticAnswerCapsuleId`.

Add these union members:

```ts
  | "category.conceptual_topology"
  | "category.leave_in.heat_consolidation"
  | "routine.category_overview"
  | "category.oil.purpose_before_products"
```

- [ ] Add capsule copy to `CAPSULES`.

Use this exact guidance:

```ts
  "category.conceptual_topology": {
    instruction:
      "Bei konzeptuellen Kategoriefragen diese Reihenfolge nutzen: direkte Antwort, Rolle der Kategorie, Profilgrund, praktische Anwendung oder Grenze, genau ein naechster Schritt. Nicht sofort Produktlisten starten.",
  },
  "category.leave_in.heat_consolidation": {
    instruction:
      "Wenn Leave-in-Tooldaten Hitzeschutz stuetzen und das Profil schon separaten Hitzeschutz kennt: direkt anerkennen, dass der separate Hitzeschutz bleiben kann. Danach die Zwei-in-eins-Route mit der Formulierung \"ein Produkt weniger in der Routine\" erklaeren: Leave-in-Pflege plus Foehnschutz in einem Produkt.",
  },
  "routine.category_overview": {
    instruction:
      "Bei breiten Fragen nach weiteren Produktkategorien die Routine-Basics als Ordnung nutzen, aber als natuerlichen Uebergang formulieren: 'Dann schauen wir zuerst auf die Basis.' Shampoo als Reinigung, Conditioner als Pflegeanker nach jeder Waesche, dann genau den autoritativen priority_context-Hebel als groessten Zusatzhebel. Am Ende fragen, ob die Nutzerin als naechstes nach Zielen oder Problemen weitergehen moechte.",
  },
  "category.oil.purpose_before_products": {
    instruction:
      "Bei konkreten Oel-Produktempfehlungen muss der Zweck klar sein: Finish/Glanz in Spitzen, Pre-Wash-Laengenschutz oder Kopfhaut-nahe Anwendung. Wenn selected_products needs_more_info fuer Oel-Zweck liefert, genau danach fragen.",
  },
```

- [ ] Add helper functions.

```ts
function hasConceptualCategoryIntent(message: string): boolean {
  const normalized = normalizeText(message)
  return /\b(wichtig|sinnvoll|gut|brauche|noetig|notig|integrier\w*|hilft|stattdessen|unterschied)\b/.test(normalized) &&
    /\b(leave[-_ ]?in|leavein|conditioner|spuelung|spulung|maske|kur|shampoo|oel|ol)\b/.test(normalized)
}

function hasBroadCategoryOverviewIntent(message: string): boolean {
  const normalized = normalizeText(message)
  return /\b(andere|weiter\w*|zusaetzlich|zusatzlich|noch|ergaenz\w*|erganz\w*)\b/.test(normalized) &&
    /\b(produkt\w*|kategorie\w*|shampoo|routine)\b/.test(normalized)
}

function hasSupportedHeatProtection(products: SelectedProductsProjection): boolean {
  return products.products.some((product) =>
    product.supported_claims.some((claim) => claim.field === "heat_protection"),
  )
}

function mentionsSeparateHeatProtection(products: SelectedProductsProjection): boolean {
  const text = [...products.profile_basis, products.category_guidance].join("\n")
  return /\b(separat\w*\s+hitzeschutz|bereits\s+hitzeschutz|eigener\s+hitzeschutz)\b/i.test(text)
}
```

- [ ] Wire the helpers into `buildAgenticAnswerContext`.

Rules:

- add `category.conceptual_topology` when there is no `selectedProducts` and `hasConceptualCategoryIntent(latestUserMessage)` is true
- add `routine.category_overview` when `routinePlan` exists and `hasBroadCategoryOverviewIntent(latestUserMessage)` is true
- ensure `routine.category_overview` answers do not sound like a full routine restart; they should bridge from the user's "what else?" wording into basics and then offer the goal/problem next layer
- add `category.leave_in.heat_consolidation` when `selectedProducts.category === "leave_in"`, `hasSupportedHeatProtection(selectedProducts)`, and `mentionsSeparateHeatProtection(selectedProducts)`
- add `category.oil.purpose_before_products` when `selectedProducts.category === "oil"` and `selectedProducts.decision === "needs_more_info"`

- [ ] Run the focused test.

Run:

```bash
npx tsx --test tests/agent-final-render-prompt.spec.ts
```

Expected: PASS.

### Task 3: Teach The Pre-Tool Brief About Broad Category Overview

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Add a failing test for broad category overview guidance.

```ts
test("consultation brief treats broad additional-products questions as routine basics context", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "andere produkte zusaetzlich zu shampoo?",
    recentMessages: [],
    userContext: createUserContext({
      profile: {
        hair_texture: "straight",
        thickness: "fine",
        current_routine_products: ["shampoo"],
      },
    }),
    conversationState: null,
  })

  assert.ok(brief.candidate_guidance.some((item) => item.id === "playbook:build_or_fix_routine"))
  assert.ok(brief.routine_staging.some((line) => /conditioner/i.test(line)))
})
```

- [ ] Add detection to `deriveCandidateGuidanceIds`.

```ts
const BROAD_CATEGORY_OVERVIEW_RE =
  /\b(andere|weiter\w*|zusaetzlich|zusatzlich|noch|ergaenz\w*|erganz\w*)\b.*\b(produkt\w*|kategorie\w*|shampoo|routine)\b/i
```

Then treat this like a routine guidance request:

```ts
if (
  ROUTINE_RE.test(normalizedText) ||
  BROAD_CATEGORY_OVERVIEW_RE.test(normalizedText) ||
  params.conversationState?.active_topic === "routine"
) {
  ids.push("playbook:build_or_fix_routine")
}
```

- [ ] Add one tool-choice rule to `AGENTIC_TOOL_LOOP_PROMPT`.

```ts
- Bei breiten Fragen nach weiteren Produktkategorien oder "was noch zusaetzlich zu Shampoo?" nutze build_or_fix_routine mit layer="basics"; leite natuerlich ueber ("dann schauen wir zuerst auf die Basis"), nenne Kategorien/Schritte, keine konkreten Produkte, ausser die Nutzerin fragt explizit nach Produkten.
```

- [ ] Add one answer-context rule to the same prompt.

```ts
- answer_context kann konkrete Beratungstopologien und geerntete Tool-Fakten enthalten; nutze diese als relevante Beratungshilfe, aber erfinde keine Fakten ausserhalb der Tool-Ausgaben.
```

- [ ] Run focused tests.

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-guidance.spec.ts
```

Expected: PASS after implementation.

### Task 4: Normalize Routine-Basics State In Tool Loop

**Files:**
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Add a failing test that a broad routine basics answer sets the classic layered next state.

```ts
test("tool loop normalizes routine basics state after build_or_fix_routine basics", async () => {
  const modelClient = createScriptedAgenticModelClient([
    { type: "tool_calls", calls: [{ name: "build_or_fix_routine", input: { objective: "fix_routine", layer: "basics" } }] },
    { type: "tool_calls", calls: [{ name: "submit_final_answer", input: { answer: "Basisantwort.", state_patch: { active_topic: "routine" } } }] },
  ])

  const result = await runAgenticToolTurn(createToolLoopParams({
    message: "wie kann ich meine routine verbessern",
    modelClient,
    answerCompositionMode: "inline_context",
  }))

  assert.equal(result.state_transition.next_state.active_topic, "routine")
  assert.equal(result.state_transition.next_state.routine_layer, "basics")
  assert.equal(result.state_transition.next_state.pending_offer, "routine_goals_or_problems")
  assert.equal(result.state_transition.next_state.last_assistant_action, "answered_routine_basics")
})
```

- [ ] Add a local helper near `buildResult` inputs or state-transition handling.

```ts
function normalizeTerminalStatePatchForToolFacts(params: {
  terminalStatePatch: AgenticTerminalAnswer["state_patch"] | null
  toolCalls: AgenticExecutedToolCall[]
}): AgenticTerminalAnswer["state_patch"] | null {
  const latestRoutineCall = [...params.toolCalls].reverse().find(
    (call) => call.name === "build_or_fix_routine",
  )
  const layer = latestRoutineCall?.input?.layer
  if (layer !== "basics") return params.terminalStatePatch

  return {
    ...(params.terminalStatePatch ?? {}),
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }
}
```

- [ ] Pass the normalized patch into `buildResult`.

Change the successful terminal return path to compute:

```ts
const normalizedStatePatch = normalizeTerminalStatePatchForToolFacts({
  terminalStatePatch: terminalAnswer.state_patch,
  toolCalls,
})
```

Then pass `terminalStatePatch: normalizedStatePatch`.

- [ ] Run focused tests.

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/conversation-state.spec.ts
```

Expected: PASS.

### Task 5: Add Feedback-Case Prompt Verification Pack

**Files:**
- Modify: `plans/2026-05-05-agentic-tool-loop-eval-seed.md`

- [ ] Add a section named `May 11 Advisor Guidance Verification`.

Include these cases:

```md
## May 11 Advisor Guidance Verification

Primary setting:
- Compare Lab: `/labs/agent-compare`
- Variant under test: `tool_loop` with `Kontext Inline`
- Baseline: Classic/current system
- Composer: available for experiment only; not required for this verification

Cases:

1. Leave-in best picks with existing heat protection
   - Prompt: `was sind die besten leave ins fuer mich`
   - Expected tool_loop: calls `select_products(leave_in)`, preserves product order, explains whether a heat-protecting leave-in can mean "ein Produkt weniger in der Routine" when supported, and says separate heat protection can also stay.

2. Leave-in importance after product context
   - Prompt: `ok waere es wichtig einen in meine routine zu integrieren?`
   - Expected tool_loop: no new product list; direct answer, category role, profile reason, practical use/limit, one next step.

3. More products besides shampoo
   - Prompt: `andere produkte zusaetzlich zu shampoo?`
   - Expected tool_loop: uses `build_or_fix_routine` basics; answer transitions naturally into the basics, is category-level with Shampoo, Conditioner, and the authoritative priority lever, asks whether to continue by goals or problems, and does not include concrete product picks.

4. Mask instead of leave-in
   - Prompt: `aber maske nicht stattdessen?`
   - Expected tool_loop: conceptual comparison; no mask product picks unless explicitly requested; clear mask is optional Zusatzpflege and leave-in is everyday/finish support when profile says so.

5. Oil product follow-up
   - Prompt sequence: `ok also haaroel hilft nicht?` -> `ok und welches passt dann zu mir` -> `ich wills fuer mehr glanz und feuchtigkeit in den spitzen verwenden`
   - Expected tool_loop: first turn educational; second asks for oil purpose if missing; third recommends oil products in tool order.
```

- [ ] Run a grep check for the new section.

Run:

```bash
rg -n "May 11 Advisor Guidance Verification|ein Produkt weniger|andere produkte zusaetzlich" plans/2026-05-05-agentic-tool-loop-eval-seed.md
```

Expected: all three strings are found.

### Task 6: Full Focused Verification

**Files:**
- No code changes unless tests expose a real issue.

- [ ] Run the focused agent/recommendation bundle.

Run:

```bash
npx tsx --test tests/agent-routine-tool.spec.ts tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts tests/agent-select-products-tool.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: PASS.

- [ ] Run typecheck.

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] Run lint.

Run:

```bash
npm run lint
```

Expected: PASS or only the known unrelated warnings:

- `src/components/layout/header.tsx` unused `Menu`
- `src/components/ui/avatar.tsx` `<img>` warning
- `src/lib/rag/mask-reranker.ts` unused `spec`
- `src/lib/routines/brush-tools.ts` unused `context`

- [ ] Run whitespace check.

Run:

```bash
git diff --check
```

Expected: no output.

### Task 7: Manual Compare Lab Verification

**Files:**
- No required code changes.

- [ ] Restart the worktree dev server if needed.

Run:

```bash
npm run dev:worktree
```

Expected: dev server URL includes `/labs/agent-compare`.

- [ ] Test with Compare Lab settings:

Use:

- Page: `http://localhost:3274/labs/agent-compare`
- Baseline: Classic/current system
- New variant: `tool_loop`
- Tool-loop option: `Kontext Inline`
- Composer: off/not selected for the primary result

- [ ] Run the five cases from `May 11 Advisor Guidance Verification`.

Expected:

- tool loop keeps multi-turn continuity
- broad category overview uses routine basics rather than product picks and transitions naturally into the goal/problem next layer
- leave-in recommendations surface the heat-protection consolidation concept only when supported
- conceptual category questions do not trigger unnecessary product picks
- oil product selection still asks for purpose before recommending

## Ready Check

This change affects recommendation quality, advisor copy, and Compare Lab trust signals. Before shipping beyond Compare Lab, run `ready-check`.

## Self-Review Checklist

- [ ] The plan does not change production chat.
- [ ] The plan does not introduce `ConversationContextPacketV1`.
- [ ] The plan keeps `select_products` and `build_or_fix_routine` authoritative.
- [ ] The plan improves the one-call `Kontext Inline` path, not Composer.
- [ ] The plan includes automated prompt/context tests and manual Compare Lab verification.
- [ ] No placeholder markers remain in the plan.

## Execution Handoff

Recommended next skill: `superpowers:subagent-driven-development`.

Use one worker for Tasks 1-3 and one worker for Tasks 4-5 if executing in parallel. Task 6 and Task 7 should be reviewed by the parent agent after integration.
