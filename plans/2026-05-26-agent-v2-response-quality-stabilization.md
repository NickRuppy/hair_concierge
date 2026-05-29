# AgentV2 Response Quality Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentV2 preserve conversational context, avoid unrequested routine rebuilds, and produce clean German user-facing answers for the latest Compare Lab failures.

**Architecture:** Resolve semantic context once at the tool boundary, keep active routine follow-ups on the existing routine thread instead of rebuilding, and validate objective user-facing language leaks at the final-answer boundary. This keeps the model flexible while making the system responsible for facts, continuity, and non-negotiable presentation constraints.

**Tech Stack:** TypeScript, Next.js app code, AgentV2 Responses runtime, deterministic recommendation engine, Node test runner via `npx tsx --test`.

---

**Spec source:** Compare Lab manual feedback and systematic debugging from 2026-05-26. The relevant saved run log is `tmp/agent-compare-runs.jsonl`, especially recent runs 26, 27, 28, 30, and 31.

**User situation:** A reviewer is using `/labs/agent-compare` with real-ish stored profiles and multi-turn prompts. The failures are not isolated wording nits: they show boundary problems where the model loses prior user context, rebuilds routine state when the user asked for a summary, or renders internal machine labels and catalog classifications as if they were user copy.

**Promised end-state:** The same prompts can be rerun in Compare Lab and should no longer ask for already-provided oil purpose, no longer call routine rebuild for a pure summary follow-up, no longer leak raw labels like `Goals`, and no longer default to awkward `Ja -` openings or catalog-ish phrases such as "eingestuft" in normal user copy.

## Scope Boundaries

In scope:

- Multi-turn product follow-ups where the latest user message is referential, for example `Welches Produkt passt dann?` after the user clarified oil as finish.
- Active routine summary follow-ups, for example `fass mir das bitte kurz zusammen`.
- Objective user-facing language guardrails for raw internal labels, bare agreement openings, and catalog metadata phrasing.
- Guidance updates that describe natural German openings/endings and keep CTAs answerable with available product/context facts.
- Automated tests for each architectural boundary and a focused manual Compare Lab verification list.

Out of scope:

- Product database backfills for deep cleansing, dry shampoo residue, mild scalp products, or bondbuilder protocol metadata.
- New evidence rules for oil heat protection, scalp peeling versus deep cleansing, or color-treated reset suitability.
- A broad German copy rewrite engine.
- Replacing the Responses runtime or recommendation engine.
- Solving existing unrelated typecheck fixture drift on this branch.

## Target File Map

- Create `src/lib/agent-v2/compare/product-tool-context.ts`
  - Owns one job: build the text context passed from AgentV2 compare/runtime tool calls into deterministic `selectProducts` inference.
  - It must combine the latest user message with recent user-only context only when the latest message is referential.

- Modify `src/lib/agent-v2/compare/run-agent-v2.ts`
  - Use the product tool context resolver inside the `select_products` adapter.
  - Keep trace/tool arguments intact; only the deterministic recommendation engine message gets the resolved context.

- Modify `src/lib/agent-v2/runtime/responses-agent.ts`
  - Extend the existing unrequested routine rebuild blocking into a single active-routine follow-up guard.
  - Add pure summary detection and active-context instructions so summaries answer from `routineThreadContext` instead of calling `build_or_fix_routine`.

- Create `src/lib/agent-v2/validation/user-facing-language.ts`
  - Centralize objective text checks for raw internal labels, awkward bare agreement openings, and raw catalog phrasing.

- Modify `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Call the user-facing language validator after existing structural/trust validators.
  - Treat internal-label leaks and disallowed bare openings as block-level repair triggers.
  - Treat catalog classification phrasing as a warning first unless it exposes raw internals; this avoids repair-loop latency for borderline prose while still surfacing the issue.

- Modify `data/agent-v2/guidance/base/tone-and-format.md`
- Modify `data/agent-v2/guidance/base/tone-and-format.json`
  - Tighten natural German opening/closing guidance.
  - Ban raw internal labels and unanswerable CTAs.

- Modify `data/agent-v2/guidance/base/product-recommendation.md`
- Modify `data/agent-v2/guidance/base/product-recommendation.json`
  - Add comparison wording rules for tied product facts: say there is no meaningful difference on this axis instead of rendering metadata classes.

- Modify `data/agent-v2/guidance/base/routine-building.md`
- Modify `data/agent-v2/guidance/base/routine-building.json`
  - Clarify pure summary follow-ups inside active routine threads.
  - Map internal routine layer names to user-facing German concepts.

- Create `tests/agent-v2-product-tool-context.spec.ts`
  - Unit tests for referential product context resolution.

- Modify `tests/agent-v2-responses-runtime.spec.ts`
  - Add a pure routine summary follow-up test that proves `build_or_fix_routine` is blocked and the final answer can be grounded in the active thread.

- Modify `tests/agent-v2-final-answer-validator.spec.ts`
  - Add objective user-facing language validation tests.

- Modify `tests/agent-v2-guidance-compiler.spec.ts`
  - Assert the updated guidance includes the new contract language.

## Root Cause Model

The implementation should treat these failures as three boundary bugs, not forty-six independent prompt bugs.

1. **Tool context boundary:** `select_products` receives only the latest message. For referential follow-ups, the deterministic request context cannot infer slots that the model understood from the conversation, such as oil purpose.
2. **Routine thread boundary:** Active routine context exists, but pure summaries do not have a first-class non-mutating path. If the model labels the answer as routine, validators push it toward `build_or_fix_routine`.
3. **Rendering boundary:** The final answer validator checks schema and grounding, but it does not yet block obvious user-facing copy leaks such as `Goals` or unnatural default openings.

The fix is to strengthen those boundaries once.

## Generalization Contract

The observed Compare Lab failures are regression probes, not the design surface. Do not implement this plan by matching only the exact examples from the run log.

For each change, implement the smallest general rule that explains the whole failure class:

- **Referential follow-up context:** Detect whether the latest user message depends on prior user turns, then pass a compact user-only context window to deterministic inference. This should work for oil, leave-in, mask, conditioner, bondbuilder, and future categories without category-specific branches unless a category has a truly different required slot.
- **Routine non-mutation:** Separate "answer about the active routine" from "change the routine." Summary, recap, placement, and product-choice follow-ups should reuse active routine context. Only explicit add/remove/replace/simplify/rebalance requests should rebuild.
- **User-facing copy quality:** Validate objective leaks and awkward structural patterns, not individual disliked strings. The validator should catch raw internal labels, metadata phrasing, and bare agreement openings as classes. Guidance should teach natural German composition and feasible CTAs rather than banning a long list of words.
- **Product metadata phrasing:** Product facts may drive reasoning, but raw metadata classes should not become copy. If products tie on a metadata axis, explain the practical consequence; if the system lacks a property, phrase the limitation in user language.

Anti-patterns to avoid:

- Adding `if latestMessage.includes("Welches Produkt passt dann")` style fixes.
- Adding one-off bans for every awkward phrase found in manual review.
- Adding category-specific prompt text when the same rule belongs in base guidance or the tool boundary.
- Moving more responsibility into the model when the system can resolve it deterministically.

Acceptance standard: a new example with the same underlying shape should pass even if it uses different words, profile, or category.

## Task 1: Add Product Tool Context Resolution

**Files:**

- Create: `src/lib/agent-v2/compare/product-tool-context.ts`
- Create: `tests/agent-v2-product-tool-context.spec.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/agent-v2-product-tool-context.spec.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
  buildAgentV2ProductToolMessage,
  isReferentialProductFollowup,
} from "../src/lib/agent-v2/compare/product-tool-context"
import { inferOilPurposeFromMessage } from "../src/lib/recommendation-engine/request-context"

test("AgentV2 product tool context keeps direct product messages unchanged", () => {
  const message = buildAgentV2ProductToolMessage({
    latestMessage: "Welches Leave-in passt zu feinem Haar?",
    recentMessages: [
      { role: "user", content: "Ich will meine Routine einfacher machen." },
      { role: "assistant", content: "Dann starten wir leicht." },
    ],
  })

  assert.equal(message, "Welches Leave-in passt zu feinem Haar?")
})

test("AgentV2 product tool context adds recent user context for referential product followups", () => {
  const message = buildAgentV2ProductToolMessage({
    latestMessage: "Welches Produkt passt dann?",
    recentMessages: [
      { role: "user", content: "Soll ich Oel eher vor dem Waschen oder als Finish nutzen?" },
      { role: "assistant", content: "Bei dir eher als Finish." },
      { role: "user", content: "Ich meine Oel eher als Finish, nicht auf die Kopfhaut." },
    ],
  })

  assert.match(message, /Finish/i)
  assert.match(message, /Welches Produkt passt dann\?/i)
  assert.equal(inferOilPurposeFromMessage(message), "styling_finish")
})

test("AgentV2 product tool context does not include assistant text in deterministic product inference", () => {
  const message = buildAgentV2ProductToolMessage({
    latestMessage: "Welches Produkt passt dann?",
    recentMessages: [
      { role: "assistant", content: "Nimm ein Finish-Oel." },
      { role: "user", content: "Welches Produkt passt dann?" },
    ],
  })

  assert.doesNotMatch(message, /Nimm ein Finish-Oel/i)
  assert.equal(inferOilPurposeFromMessage(message), null)
})

test("AgentV2 product tool context recognizes German referential product followups", () => {
  assert.equal(isReferentialProductFollowup("Welches Produkt passt dann?"), true)
  assert.equal(isReferentialProductFollowup("Welche davon waere leichter?"), true)
  assert.equal(isReferentialProductFollowup("Und welches passt dazu?"), true)
  assert.equal(isReferentialProductFollowup("Welches Shampoo soll ich nehmen?"), false)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --test tests/agent-v2-product-tool-context.spec.ts
```

Expected: fail because `src/lib/agent-v2/compare/product-tool-context.ts` does not exist yet.

- [ ] **Step 3: Implement the resolver**

Create `src/lib/agent-v2/compare/product-tool-context.ts`:

```ts
const REFERENTIAL_PRODUCT_FOLLOWUP =
  /\b(dann|dazu|dafuer|dafür|davon|welche davon|welches davon|welcher davon|passt dann|passt dazu|produkt passt|welches produkt)\b/i

const DIRECT_CATEGORY_ASK =
  /\b(welches|welche|welcher)\s+(shampoo|conditioner|spuelung|spülung|maske|leave-?in|oel|öl|trockenshampoo|peeling|bondbuilder)\b/i

const MAX_RECENT_USER_MESSAGES = 2

export function isReferentialProductFollowup(message: string): boolean {
  const normalized = message.trim()
  if (!normalized) return false
  if (DIRECT_CATEGORY_ASK.test(normalized)) return false
  return REFERENTIAL_PRODUCT_FOLLOWUP.test(normalized)
}

export function buildAgentV2ProductToolMessage(params: {
  latestMessage: string
  recentMessages: Array<{ role: string; content: string }>
}): string {
  const latestMessage = params.latestMessage.trim()
  if (!isReferentialProductFollowup(latestMessage)) return latestMessage

  const recentUserMessages = params.recentMessages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0 && content !== latestMessage)
    .slice(-MAX_RECENT_USER_MESSAGES)

  if (recentUserMessages.length === 0) return latestMessage

  return [...recentUserMessages, latestMessage].join("\n")
}
```

This helper is intentionally category-neutral. If a future product category needs a resolved slot, the helper should already provide the recent user evidence needed by `request-context.ts`; do not add category branches here unless the deterministic engine has a category-specific slot that cannot be inferred from shared context.

- [ ] **Step 4: Wire the resolver into the compare adapter**

In `src/lib/agent-v2/compare/run-agent-v2.ts`, import the helper:

```ts
import { buildAgentV2ProductToolMessage } from "@/lib/agent-v2/compare/product-tool-context"
```

Inside the `select_products` tool adapter, replace the raw latest-message argument passed to `selectProducts` with the resolved tool message:

```ts
const productToolMessage = buildAgentV2ProductToolMessage({
  latestMessage: message,
  recentMessages,
})
```

Then pass `productToolMessage` only to the deterministic product selector:

```ts
const result = await selectProducts({
  userId,
  supabase,
  category: input.category,
  message: productToolMessage,
  hairProfile,
  routineInventory,
})
```

Do not rewrite `input.user_request`, `input.evidence_quote`, trace records, or the visible final answer. The model's semantic tool arguments should remain inspectable exactly as produced.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npx tsx --test tests/agent-v2-product-tool-context.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-select-products-tool.spec.ts
```

Expected: pass. The oil follow-up helper test must prove `inferOilPurposeFromMessage(...) === "styling_finish"`.

## Task 2: Make Active Routine Follow-Ups Non-Mutating

**Files:**

- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`
- Modify: `data/agent-v2/guidance/base/routine-building.md`
- Modify: `data/agent-v2/guidance/base/routine-building.json`

- [ ] **Step 1: Add the failing runtime test**

Append to `tests/agent-v2-responses-runtime.spec.ts` near the existing active routine follow-up tests:

```ts
test("AgentV2 runtime blocks routine rebuilds for pure active routine summaries", async () => {
  const client = fakeResponsesClientWithOutputs([
    guidanceCall("call_1", {
      answer_mode_hint: "general_advice",
      categories: [],
      routine_layer: "basics",
    }),
    functionCall("call_2", "build_or_fix_routine", {
      objective: "summarize_routine",
      requested_layer: "basics",
      requested_category: "none",
      reason: "User asked to summarize the active routine",
      routine_intent: "modify",
      mutation_kind: "none",
      evidence_quote: "fass mir das bitte kurz zusammen",
    }),
    terminalCall("call_3", {
      ...terminalGeneralAdviceArguments(),
      interpreted_intent: "Aktive Routine kurz zusammenfassen",
      request_interpretation: requestInterpretation({
          primary_intent: "routine_explanation",
          product_request_kind: "none",
          care_category: "none",
          requested_product_count: null,
          count_policy: "none",
          routine_intent: "none",
          confidence: 0.9,
          evidence_quote: "fass mir das bitte kurz zusammen",
      }),
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: "none",
        return_path: ["routine"],
      },
      tool_grounding: {
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
        used_product_tool: false,
        used_routine_tool: false,
        product_ids: [],
        routine_step_ids: ["wash", "conditioner"],
        hard_rule_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Kurz zusammengefasst: Shampoo bleibt deine Basis, Conditioner schuetzt die Laengen. Als naechster Zusatz passt ein leichter Leave-in-Schritt.",
        category_or_topic: "routine_summary",
        key_points_de: [
          "Shampoo fuer die Reinigung.",
          "Conditioner fuer die Laengen.",
          "Leave-in als naechster leichter Zusatz.",
        ],
        next_step_offer_de: "Ich kann dir daraus direkt eine sehr kurze Wasch-Checkliste machen.",
      },
    }),
  ])

  let routineToolCalls = 0
  const result = await runAgentV2ResponsesTurn({
    client,
    message: "fass mir das bitte kurz zusammen",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "routine",
      last_routine_categories: ["shampoo", "conditioner", "leave_in"],
      last_user_goal: "Routine leichter machen",
      summary_de: "Shampoo, Conditioner und als naechster Zusatz ein leichter Leave-in-Schritt.",
      visible_steps: [
        { step_id: "wash", title_de: "Shampoo", category: "shampoo", position_de: "Waschen" },
        { step_id: "conditioner", title_de: "Conditioner", category: "conditioner", position_de: "Laengen" },
      ],
    },
    tools: {
      load_advisor_guidance: async () => ({ package_ids: ["base.routine_building.v1"] }),
      select_products: async () => ({ valid_product_ids: [] }),
      build_or_fix_routine: async () => {
        routineToolCalls += 1
        return { visible_steps: [] }
      },
    },
  })

  assert.equal(routineToolCalls, 0)
  assert.equal(result.trace.blocked_tool_calls.at(-1)?.name, "build_or_fix_routine")
  assert.equal(
    result.trace.blocked_tool_calls.at(-1)?.reason,
    "routine_summary_rebuild_not_requested",
  )
  assert.equal(result.final_answer.answer_mode, "general_advice")
  assert.match(result.final_answer.payload.user_facing_answer_de, /Kurz zusammengefasst/i)
})
```

- [ ] **Step 2: Run the failing runtime test**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts --test-name-pattern "pure active routine summaries"
```

Expected: fail because `build_or_fix_routine` is still allowed for a pure summary follow-up.

- [ ] **Step 3: Add summary follow-up detection**

In `src/lib/agent-v2/runtime/responses-agent.ts`, add:

```ts
function isPureRoutineSummaryFollowup(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return false

  const asksForSummary =
    /\b(fass|fasse|zusammenfassung|kurz zusammen|nochmal kurz|noch mal kurz|tl;?dr|ueberblick|überblick)\b/i.test(
      normalized,
    )
  const asksForMutation =
    /\b(aendern|ändern|ersetzen|tauschen|weg|weglassen|hinzufuegen|hinzufügen|ergaenzen|ergänzen|neuer schritt|produkt dazu|bauen|erstelle)\b/i.test(
      normalized,
    )

  return asksForSummary && !asksForMutation
}
```

This predicate covers the summary/recap subset of a broader routine-thread rule: answer about the active routine without rebuilding unless the user asks to mutate routine state.

- [ ] **Step 4: Generalize the existing routine rebuild block**

Find the existing product-follow-up guard that blocks `build_or_fix_routine`. Replace the narrow predicate with a single helper:

```ts
function shouldBlockUnrequestedRoutineRebuild(params: {
  toolInput: Record<string, unknown>
  message: string
  routineThreadContext: AgentV2RoutineThreadContext | null
}): { blocked: boolean; reason: string } {
  if (!params.routineThreadContext?.active) return { blocked: false, reason: "" }

  if (isPureRoutineSummaryFollowup(params.message)) {
    return { blocked: true, reason: "routine_summary_rebuild_not_requested" }
  }

  if (shouldBlockRoutineRebuildForProductFollowup(params.toolInput, params.routineThreadContext)) {
    return { blocked: true, reason: "routine_product_followup_rebuild_not_requested" }
  }

  return { blocked: false, reason: "" }
}
```

Then use this helper before executing `build_or_fix_routine`:

```ts
const routineRebuildGuard = shouldBlockUnrequestedRoutineRebuild({
  toolInput: parsedArguments,
  message: params.message,
  routineThreadContext,
})

if (routineRebuildGuard.blocked) {
  trace.blocked_tool_calls.push({
    name: "build_or_fix_routine",
    reason: routineRebuildGuard.reason,
  })
  inputItems.push(
    buildFunctionCallOutput(call.call_id, {
      error: routineRebuildGuard.reason,
      instruction:
        "Do not rebuild the active routine for this follow-up. Answer from routineThreadContext as general_advice with routine_context.active=true.",
    }),
  )
  continue
}
```

Preserve the existing product follow-up behavior and trace reason if tests currently assert it. If a test asserts the exact old reason, update only that assertion to the new reason.

Do not add a guard that only recognizes `fass mir das bitte kurz zusammen`. The guard must protect the active routine from unrequested rebuilds whenever the latest turn is explanatory, recap-like, placement-like, or product-choice-like. If another non-mutating follow-up type is added later, extend `shouldBlockUnrequestedRoutineRebuild` with a named reason instead of scattering checks elsewhere in the runtime.

- [ ] **Step 5: Update routine guidance**

In `data/agent-v2/guidance/base/routine-building.md`, add this rule near the active routine section:

```md
For pure summary follow-ups inside an active routine thread (`fass kurz zusammen`, `gib mir nochmal den Ueberblick`, `kurz recap`), do not call `build_or_fix_routine`. Use the visible routine context and answer as `general_advice` with `routine_context.active: true`, `primary_intent: routine_explanation`, and `routine_intent: none`. Only rebuild when the user asks to change, add, remove, replace, simplify further, or rebalance the routine.
```

Also add:

```md
Never render raw routine layer labels such as `goals`, `problems`, or `deep_dive` to the user. Say `Ziele`, `konkrete Probleme`, or `genauer anschauen` depending on the sentence.
```

Mirror both rules in `data/agent-v2/guidance/base/routine-building.json` as rule entries using the existing JSON shape.

- [ ] **Step 6: Run the focused runtime tests**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts --test-name-pattern "routine follow-up|pure active routine summaries"
```

Expected: pass, including the existing product follow-up routine guard tests.

## Task 3: Add User-Facing Language Validation

**Files:**

- Create: `src/lib/agent-v2/validation/user-facing-language.ts`
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Add validator tests**

Append to `tests/agent-v2-final-answer-validator.spec.ts`:

```ts
test("final answer validator blocks raw internal routine labels in user copy", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Was ist der naechste Schritt?",
      "Als naechstes schauen wir auf **Goals** und danach auf deine Laengen.",
    ),
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "user_facing_internal_label"))
})

test("final answer validator blocks bare Ja opening for non-confirmation prompts", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich will meine Routine einfacher machen.",
      "Ja - ich wuerde deine Routine leichter halten.",
    ),
    {
      ...baseValidationContext,
      latestUserMessage: "Ich will meine Routine einfacher machen.",
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "user_facing_bare_agreement"))
})

test("final answer validator allows Ja opening after explicit confirmation", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ja genau, mach das bitte.",
      "Ja, genau - dann bleibt es bei einem leichten Leave-in.",
    ),
    {
      ...baseValidationContext,
      latestUserMessage: "Ja genau, mach das bitte.",
    },
  )

  assert.equal(result.ok, true)
})

test("final answer validator warns on catalog classification phrasing", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "Alle drei sind als leichte Lotionen eingestuft, deshalb sind sie praktisch gleich.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, true)
  assert.ok(result.warnings.some((warning) => warning.validator_id === "user_facing_catalog_phrase"))
})
```

If the local fixtures use different helper names, use the existing valid answer factory pattern in the file. Keep the expected validator IDs.

- [ ] **Step 2: Run the failing validator tests**

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts --test-name-pattern "user copy|Ja opening|catalog classification"
```

Expected: fail because the new validator does not exist.

- [ ] **Step 3: Implement the language validator**

Create `src/lib/agent-v2/validation/user-facing-language.ts`:

```ts
import type { AgentV2TerminalAnswer, AgentV2ValidationError } from "@/lib/agent-v2/contracts"
import type { AgentV2FinalAnswerValidationContext } from "@/lib/agent-v2/validation/final-answer-validator"

const INTERNAL_LABEL_PATTERNS = [
  /\*\*\s*(Goals|Problems|Deep[_ -]?Dive)\s*\*\*/i,
  /\b(goals|problems|deep_dive|next_layer_options|routine_layer)\b/i,
]

const CATALOG_CLASSIFICATION_PATTERNS = [
  /\b(eingestuft|klassifiziert|im katalog|laut katalog|claim hinterlegt)\b/i,
]

export function validateUserFacingLanguage(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  findings: AgentV2ValidationError[],
): void {
  const text = collectUserFacingText(answer).join("\n")

  if (INTERNAL_LABEL_PATTERNS.some((pattern) => pattern.test(text))) {
    findings.push({
      validator_id: "user_facing_internal_label",
      message: "Final answer leaks internal routine or metadata labels to the user.",
      severity: "block",
    })
  }

  if (startsWithBareAgreement(text) && !latestUserMessageIsConfirmation(context.latestUserMessage)) {
    findings.push({
      validator_id: "user_facing_bare_agreement",
      message: "Final answer starts with a bare agreement even though the user did not confirm a yes/no proposition.",
      severity: "block",
    })
  }

  if (CATALOG_CLASSIFICATION_PATTERNS.some((pattern) => pattern.test(text))) {
    findings.push({
      validator_id: "user_facing_catalog_phrase",
      message: "Final answer uses catalog or metadata phrasing instead of user-facing wording.",
      severity: "warn",
    })
  }
}

function collectUserFacingText(answer: AgentV2TerminalAnswer): string[] {
  const payload = answer.payload
  const values: string[] = []

  for (const value of Object.values(payload)) {
    if (typeof value === "string") values.push(value)
    if (Array.isArray(value)) {
      values.push(
        ...value.flatMap((item) => {
          if (typeof item === "string") return [item]
          if (!item || typeof item !== "object" || Array.isArray(item)) return []
          return Object.values(item).flatMap((nested) => (typeof nested === "string" ? [nested] : []))
        }),
      )
    }
  }

  return values
}

function startsWithBareAgreement(text: string): boolean {
  return /^\s*ja\s*(?:[-–—]|,\s*(?:ich|dann|das|bei|wenn)\b)/i.test(text)
}

function latestUserMessageIsConfirmation(message: string): boolean {
  return /^\s*(ja|jap|yes|genau|okay|ok|passt|mach das|bitte so)\b/i.test(message)
}
```

Keep this validator objective and structural. It should not become a subjective style blacklist. Block only patterns that are clearly system leakage or conversation-shape violations; use warnings for softer catalog phrasing so the runtime does not enter unnecessary repair loops.

- [ ] **Step 4: Call the validator**

In `src/lib/agent-v2/validation/final-answer-validator.ts`, import:

```ts
import { validateUserFacingLanguage } from "@/lib/agent-v2/validation/user-facing-language"
```

Then call it after `validateInternalLeakage(...)`:

```ts
validateUserFacingLanguage(terminalAnswer, context, findings)
```

- [ ] **Step 5: Run validator tests**

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: pass. If existing tests intentionally include `Ja -`, update those fixtures to use a natural opening instead of weakening the validator.

## Task 4: Tighten Guidance Around Natural Openings, CTAs, and Product Metadata

**Files:**

- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
- Modify: `data/agent-v2/guidance/base/product-recommendation.json`
- Modify: `tests/agent-v2-guidance-compiler.spec.ts`

- [ ] **Step 1: Add guidance compiler assertions**

Add tests to `tests/agent-v2-guidance-compiler.spec.ts` near the existing tone/product guidance assertions:

```ts
test("tone guidance requires natural German openings and answerable endings", () => {
  const tone = readFileSync("data/agent-v2/guidance/base/tone-and-format.md", "utf8")

  assert.match(tone, /natural German opening/i)
  assert.match(tone, /Do not start with bare `Ja/i)
  assert.match(tone, /only offer a next step the system can answer/i)
})

test("product guidance rejects catalog metadata phrasing in comparisons", () => {
  const product = readFileSync("data/agent-v2/guidance/base/product-recommendation.md", "utf8")

  assert.match(product, /Do not say products are `eingestuft` or `klassifiziert`/i)
  assert.match(product, /no meaningful difference on this axis/i)
})
```

- [ ] **Step 2: Run the failing guidance tests**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts --test-name-pattern "natural German openings|catalog metadata"
```

Expected: fail until the guidance text is updated.

- [ ] **Step 3: Update tone guidance**

In `data/agent-v2/guidance/base/tone-and-format.md`, add or replace the opening/ending section with:

```md
Use a natural German opening that directly picks up the user's wording. Do not start with bare `Ja -`, `Ja —`, `Dann`, or a generic agreement unless the user explicitly confirmed something in the previous message. Good openings sound like a person listened: `Bei deiner feinen Haarstruktur waere ich vorsichtig mit ...`, `Fuer deine Routine ist der naechste sinnvolle Schritt ...`, `Wenn du es einfacher halten willst, ...`.

Endings should keep the conversation open without pretending to know or do something unavailable. Only offer a next step the system can answer from current profile, routine context, supported product facts, or an explicit follow-up question. Do not offer to choose between options the answer already chose. Do not offer to inspect photos, links, ingredient backsides, no-white-cast claims, color safety, chelating status, heat protection, or exact protocols unless a tool surfaced those facts for this turn.

Do not render raw internal labels or metadata in user-facing German. Replace `Goals` with `Ziele`, `problems` with `konkrete Probleme`, and `deep_dive` with `genauer anschauen` when the concept is useful. Avoid phrases like `im Katalog`, `Claim hinterlegt`, `eingestuft`, or `klassifiziert` in normal user copy.
```

Mirror this content in the existing JSON rule format in `data/agent-v2/guidance/base/tone-and-format.json`.

The guidance should teach the principle, not an exhaustive banned-word list: open from the user's actual ask, end with an answerable continuation, and translate system concepts into natural German before rendering.

- [ ] **Step 4: Update product recommendation guidance**

In `data/agent-v2/guidance/base/product-recommendation.md`, add:

```md
When product metadata ties on an axis, explain the practical implication instead of exposing the class label. Do not say products are `eingestuft` or `klassifiziert` as light lotions, rich creams, residue-safe, or similar. Say `Bei der Leichtigkeit gibt es aus den vorliegenden Produktinfos keinen klaren Unterschied` or `Der Unterschied liegt hier eher bei ...`, then name the supported differentiator.
```

Mirror this in `data/agent-v2/guidance/base/product-recommendation.json`.

The product guidance should generalize beyond leave-ins. Any category comparison that ties on a metadata axis should use practical user language instead of exposing the raw class name.

- [ ] **Step 5: Run guidance tests**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected: pass.

## Task 5: Focused Regression Verification

**Files:**

- Modify if needed: `tests/agent-v2-manual-regression.spec.ts`
- No production file changes unless a prior task exposes a missed boundary.

- [ ] **Step 1: Run the boundary test suite**

Run:

```bash
npx tsx --test \
  tests/agent-v2-product-tool-context.spec.ts \
  tests/agent-v2-responses-runtime.spec.ts \
  tests/agent-v2-final-answer-validator.spec.ts \
  tests/agent-v2-guidance-compiler.spec.ts \
  tests/agent-v2-compare-runner.spec.ts \
  tests/agent-select-products-tool.spec.ts
```

Expected: pass.

- [ ] **Step 2: Run Compare Lab API/runtime smoke tests**

Run:

```bash
npx tsx --test \
  tests/agent-compare-api.spec.ts \
  tests/agent-compare-product-trace.spec.ts \
  tests/agent-compare-runner.spec.ts \
  tests/agent-v2-compare-runner.spec.ts
```

Expected: pass.

- [ ] **Step 3: Run formatting check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Document known typecheck status**

Run:

```bash
npm run typecheck
```

Expected for this branch today: may still fail on pre-existing AgentV2 fixture drift unrelated to this plan, including stale fixture fields such as `care_category` versus `category`, `call_id` in partial model step fixtures, and removed `action_de` fields in routine visible steps. Do not claim full typecheck is green unless these are fixed or no longer appear.

- [ ] **Step 5: Manual Compare Lab verification**

Use `/labs/agent-compare` in AgentV2-only mode. Run these focused prompts:

1. Profile: Nick Rupprechter, prompt: `was waere der naechste beste schritt fuer meine routine`
   - Pass if answer has no raw `Goals`, no internal English headings, and CTA does not offer the same decision again.

2. Profile: Phil, multi-turn:
   - `Ich will meine Routine einfacher machen.`
   - `Soll ich dann eher Oel oder Maske nehmen?`
   - `Ich meine Oel eher als Finish, nicht auf die Kopfhaut.`
   - `Welches Produkt passt dann?`
   - Pass if the fourth turn does not ask again whether the oil is for scalp/pre-wash/finish and either recommends products or explains a product-data limitation cleanly.

3. Profile: Phil, multi-turn:
   - `Ich will meine Routine einfacher machen.`
   - `Okay, welcher Zusatz zuerst?`
   - `fass mir das bitte kurz zusammen`
   - Pass if the summary does not call/rebuild `build_or_fix_routine`, stays concise, and summarizes the visible routine context.

4. Profile: Jonas, prompt: leave-in comparison from the latest saved run
   - Pass if it does not say products are `eingestuft` or `klassifiziert`; it should phrase tied metadata as no meaningful practical difference on that axis.

5. Profile: Jonas, prompt: deep cleansing prompt from the latest saved run
   - Pass if the answer remains good and the closing offer is answerable from current facts.

- [ ] **Step 6: Run ready-check before shipping**

Because this touches recommendations, copy, and trust, run the repo skill `ready-check` after implementation and before any PR handoff. The check should explicitly inspect:

- product context continuity,
- routine summary non-mutation,
- final-answer copy guardrails,
- Compare Lab save/review flow still working.

## Execution Notes

Use `superpowers:subagent-driven-development` for implementation. Suggested split:

1. Subagent A: Task 1 product context resolver and tests.
2. Subagent B: Task 2 active routine summary guard and tests.
3. Subagent C: Tasks 3 and 4 language validator plus guidance tests.
4. Main agent: Task 5 verification, Compare Lab manual run review, and ready-check.

Do not create category-specific micro-patches while executing this plan. If a new failure appears, first decide which boundary owns it:

- deterministic facts/context before tools,
- active thread state before routine mutation,
- final user-facing copy before display,
- or product catalog data outside this plan.

Only add a new rule when it belongs to one of those boundaries.

When reviewing implementation, reject fixes whose only proof is "the exact saved prompt now passes." Require at least one nearby paraphrase or adjacent category to pass for each boundary change.
