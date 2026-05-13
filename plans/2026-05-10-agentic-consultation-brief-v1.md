# Agentic Consultation Brief V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contextualize the Compare Lab `tool_loop` so it behaves like a knowledgeable consultant before choosing tools: educate on conceptual category interest, recommend on explicit product asks, stage broad routines, and keep deterministic product/routine tools authoritative.

**Architecture:** Add one compact pre-tool `consultation_brief` built from existing `data/agent-guidance` plus small always-on rules. The brief is candidate context, not an intent router: code loads likely-relevant guidance, while the model still decides whether to answer conceptually, call `select_products`, call `build_or_fix_routine`, or ask one blocker. Keep Composer non-default and do not wire production chat.

**Tech Stack:** Next.js App Router, TypeScript, OpenAI Chat Completions function calling, existing `data/agent-guidance`, existing `select_products` and `build_or_fix_routine`, Compare Lab.

---

## Decisions Locked In

- Explicit safe cosmetic product asks should be fulfilled, even if another lever is stronger.
- In those cases, answer with products plus a caveat/soft steer, not a hard redirect.
- Conceptual category curiosity should get education first, not product recommendations.
- Broad routine asks should use the existing layered flow: basics first, then goal-oriented or problem-oriented follow-up.
- V1 scope is routine, shampoo, conditioner, leave-in, mask, and relevant overlays.
- Oil, bondbuilder, deep cleansing, Eva/eval infrastructure, production chat wiring, and model-selected `load_guidance` are out of scope for this plan.

## File Map

- Create: `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
  - Builds the compact pre-tool brief from message, recent messages, user context, conversation state, overlays, and candidate category/routine guidance.
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - Adds `AgenticConsultationBrief` trace/param fields.
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Builds and injects `consultation_brief` into the first model request before tool choice.
- Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Tells the model how to use `consultation_brief` without treating it as a route.
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
  - Adds caveated recommendation guidance for explicit product asks where another lever is stronger.
- Modify: `src/lib/agent/tools/select-products.ts`
  - Adds `recommend_with_caveat` policy for safe explicit weak-lever product asks.
- Modify: `src/lib/agent/guidance/catalog.ts`
  - Registers category guidance for shampoo, conditioner, leave-in, and mask.
- Create:
  - `data/agent-guidance/topics/shampoo/core-fit.md`
  - `data/agent-guidance/topics/shampoo/response-playbook.md`
  - `data/agent-guidance/topics/conditioner/core-fit.md`
  - `data/agent-guidance/topics/conditioner/response-playbook.md`
  - `data/agent-guidance/topics/leave-in/core-fit.md`
  - `data/agent-guidance/topics/leave-in/response-playbook.md`
  - `data/agent-guidance/topics/mask/core-fit.md`
  - `data/agent-guidance/topics/mask/response-playbook.md`
- Modify: `tests/agent-guidance.spec.ts`
- Modify: `tests/agentic-tool-loop.spec.ts`
- Modify: `tests/agent-final-render-prompt.spec.ts`
- Modify: `tests/agent-select-products-tool.spec.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
  - Rename the default dropdown label from `Kontext inline` to `Beratungsbrief`.

## Task 1: Add Category Guidance To Existing Guidance System

**Files:**
- Create: `data/agent-guidance/topics/shampoo/core-fit.md`
- Create: `data/agent-guidance/topics/shampoo/response-playbook.md`
- Create: `data/agent-guidance/topics/conditioner/core-fit.md`
- Create: `data/agent-guidance/topics/conditioner/response-playbook.md`
- Create: `data/agent-guidance/topics/leave-in/core-fit.md`
- Create: `data/agent-guidance/topics/leave-in/response-playbook.md`
- Create: `data/agent-guidance/topics/mask/core-fit.md`
- Create: `data/agent-guidance/topics/mask/response-playbook.md`
- Modify: `src/lib/agent/guidance/catalog.ts`
- Test: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Write failing guidance catalog tests**

Add this test to `tests/agent-guidance.spec.ts`:

```ts
test("loadGuidance returns core product category topics for the agentic consultation brief", async () => {
  const result = await loadGuidance([
    "topic:shampoo",
    "topic:conditioner",
    "topic:leave_in",
    "topic:mask",
  ])

  assert.deepEqual(
    result.items.map((item) => [item.id, item.kind]),
    [
      ["topic:shampoo", "topic"],
      ["topic:conditioner", "topic"],
      ["topic:leave_in", "topic"],
      ["topic:mask", "topic"],
    ],
  )
  assert.match(result.items[0]?.content ?? "", /Shampoo/i)
  assert.match(result.items[1]?.content ?? "", /Conditioner/i)
  assert.match(result.items[2]?.content ?? "", /Leave-in/i)
  assert.match(result.items[3]?.content ?? "", /Maske|Mask/i)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: fails with `Unknown guidance id: topic:shampoo`.

- [ ] **Step 3: Add category guidance files**

Create `data/agent-guidance/topics/shampoo/core-fit.md`:

```md
# Shampoo: Core Fit

Role: Shampoo is primarily a scalp and cleansing product. It can support freshness, root feel, buildup control, and scalp comfort, but it is rarely the strongest lever for shine, frizz, dry lengths, or split ends.

Profile variables that matter:
- scalp_type and scalp_condition drive the cleansing lane
- thickness influences how heavy or stripping the wash should feel
- wash_frequency changes tolerance for stronger cleansing
- concerns like oily roots, flakes, irritation, dry lengths, frizz, and shine decide whether shampoo is the main lever or a supporting lever

Top-level advice:
- apply shampoo mainly to the scalp
- let rinse-down handle lengths unless there is heavy product residue
- do not frame shampoo as a length-repair product
- for explicit safe product asks, recommend the best shampoo fit but caveat when conditioner, leave-in, mask, or styling is the stronger lever
```

Create `data/agent-guidance/topics/shampoo/response-playbook.md`:

```md
# Shampoo: Response Playbook

Conceptual answer shape:
- start with what shampoo can and cannot do for the user's goal
- if the goal is shine, frizz, or dry lengths, say shampoo can support a clean base but is usually not the strongest lever
- steer softly toward conditioner, leave-in, mask, or technique when those are more relevant
- no product names unless the user explicitly asks for products

Explicit product ask shape:
- call select_products for shampoo
- recommend the returned products in order when policy allows products
- include one clear caveat if another lever is stronger
- end with a short usage note: shampoo mainly on the scalp, rinse well

Avoid:
- do not claim shine, color protection, sensitive-scalp support, or repair from product names
- do not make shampoo the main answer for split ends, dry lengths, or frizz unless there is also a scalp/root signal
```

Create `data/agent-guidance/topics/conditioner/core-fit.md`:

```md
# Conditioner: Core Fit

Role: Conditioner is the routine's core length-care anchor after washing. It supports slip, surface feel, softness, reduced friction, and care balance in lengths and ends.

Profile variables that matter:
- thickness and density influence weight tolerance
- protein_moisture_balance influences protein versus moisture direction
- cuticle_condition, chemical_treatment, heat_styling, breakage, frizz, dryness, and tangling influence care intensity
- scalp state matters mostly as a placement guardrail: conditioner usually belongs in lengths and ends, not scalp

Top-level advice:
- conditioner is usually more central than mask for routine basics
- fine hair often needs lighter weight and careful placement
- conditioner can make split ends feel smoother, but cannot permanently repair split ends
```

Create `data/agent-guidance/topics/conditioner/response-playbook.md`:

```md
# Conditioner: Response Playbook

Conceptual answer shape:
- explain conditioner as the baseline length-care step
- connect weight and care intensity to the user's profile
- answer role and usage before recommending products
- no product names unless the user explicitly asks which conditioner to choose

Explicit product ask shape:
- call select_products for conditioner
- explain the product type first, then name products in tool order
- use only supported_claims for weight, balance, intensity, and fit

Avoid:
- do not present conditioner as a scalp treatment
- do not claim permanent split-end repair
- do not infer claims from product names
```

Create `data/agent-guidance/topics/leave-in/core-fit.md`:

```md
# Leave-in: Core Fit

Role: Leave-in is an after-wash booster for lengths and ends. It can support smoother feel, frizz control, light conditioning, styling prep, and sometimes heat-protection consolidation when product data supports it.

Profile variables that matter:
- thickness and density drive weight and dose
- texture and styling routine influence format and role
- heat_styling, drying_method, styling_tools, and uses_heat_protection influence whether heat protection matters
- dryness, frizz, rough cuticle, shine goals, and current_routine_products influence whether leave-in is the next best extra lever

Top-level advice:
- leave-in is usually a booster, not automatically a conditioner replacement
- for fine hair, prefer light and sparing use
- apply to lengths and ends, not scalp
- no product names unless the user explicitly asks for recommendations
```

Create `data/agent-guidance/topics/leave-in/response-playbook.md`:

```md
# Leave-in: Response Playbook

Conceptual answer shape:
- answer whether leave-in is useful for this user
- explain the role in the current routine
- include one practical usage note: after washing, sparingly, lengths and ends
- if relevant, say it can be the third lever after shampoo and conditioner
- offer product picks as a next step instead of dumping products immediately

Explicit product ask shape:
- call select_products for leave_in
- compare returned products by supported format, weight, role, heat protection, care focus, balance, and fit
- do not claim exact heat-protection temperatures

Avoid:
- do not frame leave-in as scalp care
- do not force it as mandatory
- do not recommend rich layering for fine hair without a caveat
```

Create `data/agent-guidance/topics/mask/core-fit.md`:

```md
# Mask: Core Fit

Role: Mask is optional extra length care. It can support more intensive conditioning for lengths and ends, but it is not a required baseline step for every user.

Profile variables that matter:
- thickness, density, protein_moisture_balance, chemical_treatment, cuticle_condition, dryness, frizz, breakage, and damage history influence whether a mask is useful
- current routine complexity and fine hair influence whether a mask should stay optional
- scalp symptoms should route away from mask as the main lever

Top-level advice:
- mask is not a conditioner replacement by default
- use after shampoo and before conditioner unless product directions say otherwise
- apply to lengths and ends, avoid scalp
- cadence should be occasional or need-based, not universal
```

Create `data/agent-guidance/topics/mask/response-playbook.md`:

```md
# Mask: Response Playbook

Conceptual answer shape:
- answer mandatory versus optional clearly
- explain when a mask is worth adding and when the routine can stay simpler
- connect protein/moisture direction to the user's profile when known
- offer product picks as a next step if the user wants a concrete mask

Explicit product ask shape:
- call select_products for mask
- name products in tool order
- use only supported_claims for weight, balance, intensity, and fit
- keep application brief: after shampoo, before conditioner, lengths and ends, rinse well

Avoid:
- do not present masks as scalp treatment
- do not claim split ends can be permanently repaired
- do not make masks mandatory in a minimal routine
```

- [ ] **Step 4: Register the new guidance IDs**

Add these entries to `guidanceCatalog` in `src/lib/agent/guidance/catalog.ts` near the existing topics:

```ts
  "topic:shampoo": {
    kind: "topic",
    title: "Shampoo",
    paths: [
      "data/agent-guidance/topics/shampoo/core-fit.md",
      "data/agent-guidance/topics/shampoo/response-playbook.md",
    ],
  },
  "topic:conditioner": {
    kind: "topic",
    title: "Conditioner",
    paths: [
      "data/agent-guidance/topics/conditioner/core-fit.md",
      "data/agent-guidance/topics/conditioner/response-playbook.md",
    ],
  },
  "topic:leave_in": {
    kind: "topic",
    title: "Leave-in",
    paths: [
      "data/agent-guidance/topics/leave-in/core-fit.md",
      "data/agent-guidance/topics/leave-in/response-playbook.md",
    ],
  },
  "topic:mask": {
    kind: "topic",
    title: "Maske",
    paths: [
      "data/agent-guidance/topics/mask/core-fit.md",
      "data/agent-guidance/topics/mask/response-playbook.md",
    ],
  },
```

In `src/lib/agent/contracts.ts`, add the new IDs to `GUIDANCE_IDS`:

```ts
  | "topic:shampoo"
  | "topic:conditioner"
  | "topic:leave_in"
  | "topic:mask"
```

- [ ] **Step 5: Run guidance tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: passes.

## Task 2: Add Consultation Brief Builder

**Files:**
- Create: `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Add failing unit tests for the brief builder**

Add imports to `tests/agentic-tool-loop.spec.ts`:

```ts
import {
  buildAgenticConsultationBrief,
} from "../src/lib/agent/orchestrator/agentic-consultation-brief"
```

Add these tests:

```ts
test("consultation brief distinguishes conceptual leave-in interest from product selection", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "ja ich habe gehoert leave in soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    userContext: createUserContext({
      profile: {
        hair_texture: "straight",
        thickness: "fine",
        goals: ["shine"],
        current_routine_products: ["shampoo", "conditioner"],
      } as NonNullable<UserContextProjection["profile"]>,
      suggested_overlays: ["overlay:fine_hair"],
    }),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
  })

  const serialized = JSON.stringify(brief)
  assert.match(serialized, /educate before recommending/i)
  assert.match(serialized, /Conceptual category interest/i)
  assert.match(serialized, /topic:leave_in/)
  assert.match(serialized, /overlay:fine_hair/)
  assert.doesNotMatch(serialized, /call select_products for this turn/i)
})

test("consultation brief includes routine staging for broad routine requests", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "ich moechte meine routine anpassen",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: null,
  })

  const serialized = JSON.stringify(brief)
  assert.match(serialized, /shampoo/i)
  assert.match(serialized, /conditioner/i)
  assert.match(serialized, /one highest-impact extra lever/i)
  assert.match(serialized, /goals or problems/i)
})

test("consultation brief includes shampoo candidate context for explicit shampoo asks", async () => {
  const brief = await buildAgenticConsultationBrief({
    message: "welches shampoo kannst du fuer mehr glanz empfehlen",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: null,
  })

  const serialized = JSON.stringify(brief)
  assert.match(serialized, /topic:shampoo/)
  assert.match(serialized, /recommend with caveat/i)
  assert.match(serialized, /Explicit product ask/i)
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected: fails because `agentic-consultation-brief` does not exist.

- [ ] **Step 3: Implement the brief builder**

Create `src/lib/agent/orchestrator/agentic-consultation-brief.ts`:

```ts
import { loadGuidance } from "@/lib/agent/guidance/load-guidance"
import type { GuidanceId, GuidanceKind } from "@/lib/agent/contracts"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import type { ConversationState } from "@/lib/types"

export interface AgenticConsultationBriefItem {
  id: GuidanceId
  kind: GuidanceKind
  title: string
  content: string
}

export interface AgenticConsultationBrief {
  charter: string[]
  routine_staging: string[]
  product_vs_education: string[]
  profile_overlays: AgenticConsultationBriefItem[]
  candidate_guidance: AgenticConsultationBriefItem[]
}

export interface BuildAgenticConsultationBriefParams {
  message: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  userContext: UserContextProjection
  conversationState?: ConversationState | null
}

const CHARTER = [
  "Be a knowledgeable, warm hair-care advisor.",
  "Answer the current user delta first.",
  "Educate before recommending products when the user shows conceptual curiosity.",
  "When the user explicitly asks for safe cosmetic products, fulfill the request and steer softly if another lever is stronger.",
  "Keep deterministic tool outputs authoritative for product names, ranking, claims, routine steps, and hard safety policies.",
  "Ask at most one blocking follow-up.",
  "Do not expose internal tool, trace, state, policy, or guidance labels to the user.",
] as const

const ROUTINE_STAGING = [
  "For broad routine asks, start with basics: shampoo, conditioner, and one highest-impact extra lever.",
  "After basics, ask whether the user wants to go toward goals or problems.",
  "For goal-oriented routine turns, show only the top goal levers.",
  "For problem-oriented routine turns, show only the top problem levers.",
  "For category follow-ups inside a routine thread, explain the category role first unless the user explicitly asks for concrete products.",
] as const

const PRODUCT_VS_EDUCATION = [
  "Conceptual category interest: answer educationally without select_products. Examples: 'ist Leave-in gut?', 'brauche ich eine Maske?', 'was bringt Conditioner?'",
  "Explicit product ask: call select_products. Examples: 'welches Produkt?', 'kannst du etwas empfehlen?', 'was soll ich kaufen?', 'A oder B?'",
  "Explicit safe weak-lever category ask: call select_products and recommend with caveat. Example: shampoo for shine can get shampoo picks plus a soft steer toward conditioner or leave-in as stronger shine levers.",
  "Usage ask: answer application, dosage, order, and technique before considering a new product selection.",
] as const

const CATEGORY_TOPIC_BY_KEYWORD: Array<{
  id: GuidanceId
  patterns: RegExp[]
}> = [
  { id: "topic:shampoo", patterns: [/\bshampoo\b/i] },
  { id: "topic:conditioner", patterns: [/\bconditioner\b/i, /\bspuelung\b/i, /\bspulung\b/i] },
  { id: "topic:leave_in", patterns: [/\bleave[- ]?in\b/i, /\bleavein\b/i] },
  { id: "topic:mask", patterns: [/\bmaske\b/i, /\bkur\b/i] },
]

const ROUTINE_RE = /\b(routine|basis|basics|anpassen|umstellen|vereinfach|aufbauen|schritte?)\b/i
const MAX_GUIDANCE_CHARS = 1200

export async function buildAgenticConsultationBrief(
  params: BuildAgenticConsultationBriefParams,
): Promise<AgenticConsultationBrief> {
  const profileOverlayIds = params.userContext.suggested_overlays.filter(isSupportedBriefGuidanceId)
  const candidateIds = deriveCandidateGuidanceIds(params)
  const [profileOverlays, candidateGuidance] = await Promise.all([
    loadGuidance(profileOverlayIds),
    loadGuidance(candidateIds),
  ])

  return {
    charter: [...CHARTER],
    routine_staging: [...ROUTINE_STAGING],
    product_vs_education: [...PRODUCT_VS_EDUCATION],
    profile_overlays: profileOverlays.items.map(compactGuidanceItem),
    candidate_guidance: candidateGuidance.items.map(compactGuidanceItem),
  }
}

function deriveCandidateGuidanceIds(params: BuildAgenticConsultationBriefParams): GuidanceId[] {
  const ids: GuidanceId[] = []
  const text = [
    params.message,
    params.conversationState?.active_topic ?? "",
    params.conversationState?.routine_layer ?? "",
  ].join("\n")

  if (ROUTINE_RE.test(text) || params.conversationState?.active_topic === "routine") {
    ids.push("playbook:build_or_fix_routine")
  }

  for (const topic of CATEGORY_TOPIC_BY_KEYWORD) {
    if (topic.patterns.some((pattern) => pattern.test(text))) {
      ids.push(topic.id)
    }
  }

  return unique(ids)
}

function compactGuidanceItem(item: {
  id: GuidanceId
  kind: GuidanceKind
  title: string
  content: string
}): AgenticConsultationBriefItem {
  return {
    ...item,
    content: item.content.trim().slice(0, MAX_GUIDANCE_CHARS),
  }
}

function unique(ids: GuidanceId[]): GuidanceId[] {
  return Array.from(new Set(ids))
}

function isSupportedBriefGuidanceId(id: GuidanceId): boolean {
  return id.startsWith("overlay:")
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-guidance.spec.ts
```

Expected: passes.

## Task 3: Inject Consultation Brief Before Tool Choice

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Test: `tests/agentic-tool-loop.spec.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] **Step 1: Write failing integration test for first model request**

Add this test to `tests/agentic-tool-loop.spec.ts`:

```ts
test("tool-loop sends consultation brief before the model chooses tools", async () => {
  const modelClient = new FakeModelClient([
    {
      type: "final",
      answer:
        "Ja, Leave-in kann sinnvoll sein, aber ich wuerde es bei feinem Haar leicht und sparsam testen.",
      statePatch: {
        active_topic: "routine",
        routine_layer: "deep_dive",
        topic_relation: "same_topic",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ja ich habe gehoert leave in soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    modelClient,
    tools: {
      select_products: async () => createLeaveInProjection(),
      build_or_fix_routine: async () => ({
        objective: null,
        steps: [],
        missing_info: [],
        confidence: 0,
      }),
    },
    userContext: createUserContext({
      profile: {
        thickness: "fine",
        goals: ["shine"],
        current_routine_products: ["shampoo", "conditioner"],
      } as NonNullable<UserContextProjection["profile"]>,
      suggested_overlays: ["overlay:fine_hair"],
    }),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
    answerCompositionMode: "inline_context",
  })

  const firstRequest = modelClient.requests[0]
  assert.ok(firstRequest)
  const serialized = JSON.stringify(firstRequest.messages)
  assert.match(serialized, /consultation_brief/)
  assert.match(serialized, /Educate before recommending products/i)
  assert.match(serialized, /topic:leave_in/)
  assert.match(serialized, /overlay:fine_hair/)
  assert.equal(result.tool_calls.length, 0)
  assert.match(JSON.stringify(result.trace.consultation_brief), /topic:leave_in/)
})
```

If `createLeaveInProjection` does not exist in the test file, add:

```ts
function createLeaveInProjection(): SelectedProductsProjection {
  return {
    category: "leave_in",
    decision: "recommended",
    product_response_policy: "recommend",
    policy_reason: "Leave-in passt als Booster.",
    profile_basis: ["Haardicke: Fein", "Leave-in-Rolle im Profil: Nur als Booster"],
    category_guidance: "Leave-in ist ein Booster fuer Laengen und Spitzen.",
    products: [],
    comparison_facts: null,
    missing_info: [],
    unsupported_requested_signals: [],
  }
}
```

- [ ] **Step 2: Add prompt contract test**

Add to `tests/agent-final-render-prompt.spec.ts`:

```ts
test("agentic tool-loop prompt treats consultation brief as candidate context", () => {
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /consultation_brief/)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /candidate context/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /not a route/i)
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts
```

Expected: fails because the brief is not in params, trace, or prompt.

- [ ] **Step 4: Add types**

Modify `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`:

```ts
import type { AgenticConsultationBrief } from "@/lib/agent/orchestrator/agentic-consultation-brief"
```

Add to `AgenticToolLoopTrace`:

```ts
  consultation_brief: AgenticConsultationBrief | null
```

Add to `AgenticToolTurnParams`:

```ts
  consultationBrief?: AgenticConsultationBrief | null
```

- [ ] **Step 5: Build the brief before `buildInitialMessages`**

Modify `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`:

```ts
import {
  buildAgenticConsultationBrief,
  type AgenticConsultationBrief,
} from "@/lib/agent/orchestrator/agentic-consultation-brief"
```

At the start of `runAgenticToolTurn`, before `buildInitialMessages`:

```ts
  const consultationBrief =
    params.consultationBrief === undefined
      ? await buildAgenticConsultationBrief({
          message: params.message,
          recentMessages: params.recentMessages,
          userContext: params.userContext,
          conversationState: params.conversationState,
        })
      : params.consultationBrief
  const modelMessages = buildInitialMessages(params, consultationBrief)
```

Replace the existing line:

```ts
  const modelMessages = buildInitialMessages(params)
```

- [ ] **Step 6: Include the brief in the first user payload**

Change `buildInitialMessages` signature:

```ts
function buildInitialMessages(
  params: Pick<AgenticToolTurnParams, "message" | "recentMessages" | "userContext" | "conversationState">,
  consultationBrief: AgenticConsultationBrief | null,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
```

Add `consultation_brief` to the JSON payload:

```ts
        consultation_brief: consultationBrief,
```

- [ ] **Step 7: Trace the brief**

Pass `consultationBrief` through every `buildResult` call:

```ts
          consultationBrief,
```

Add `consultationBrief` to `buildResult` params:

```ts
  consultationBrief: AgenticConsultationBrief | null
```

Set trace field:

```ts
      consultation_brief: params.consultationBrief,
```

- [ ] **Step 8: Add prompt line**

Modify `AGENTIC_TOOL_LOOP_PROMPT` in `src/lib/agent/orchestrator/prompt.ts`:

```text
- Wenn consultation_brief vorhanden ist, nutze es als candidate context fuer Beratung, Tool-Wahl und Antwortfokus. Es ist not a route: Die aktuelle Nutzerfrage entscheidet, ob du erklaerst, select_products nutzt, build_or_fix_routine nutzt oder eine Rueckfrage stellst.
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts
```

Expected: passes.

## Task 4: Add Recommend-With-Caveat Product Policy

**Files:**
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Test: `tests/agent-select-products-tool.spec.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] **Step 1: Write failing product policy tests**

In `tests/agent-select-products-tool.spec.ts`, change the shampoo weak-lever policy expectations for explicit safe product asks:

```ts
const shampooPolicyCases = [
  {
    label: "dry lengths",
    concerns: ["dry_lengths"],
    requestedGoal: null,
    expectedPolicy: "recommend_with_caveat",
  },
  {
    label: "shine",
    concerns: [],
    requestedGoal: "shine",
    expectedPolicy: "recommend_with_caveat",
  },
  {
    label: "frizz",
    concerns: ["frizz"],
    requestedGoal: null,
    expectedPolicy: "recommend_with_caveat",
  },
  {
    label: "flakes irritation",
    concerns: ["dandruff_or_flakes", "irritation"],
    requestedGoal: null,
    expectedPolicy: "caution_without_products",
  },
] as const
```

Change the assertion inside the loop:

```ts
    if (entry.expectedPolicy === "recommend_with_caveat") {
      assert.equal(result.decision, "recommended")
      assert.equal(result.products.length, 1)
      assert.match(result.category_guidance, /nicht der staerkste Hebel|nicht der stärkste Hebel|staerkerer Hebel/i)
    } else {
      assert.equal(result.decision, "not_recommended")
      assert.equal(result.products.length, 0)
    }
    assert.equal(result.product_response_policy, entry.expectedPolicy)
```

Add a separate conceptual/non-product guard test:

```ts
test("projectSelectedProducts still redirects weak-lever shampoo when the user is not explicitly asking for products", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "troubleshoot",
      concerns: ["frizz"],
      requestedGoal: null,
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.equal(result.products.length, 0)
})
```

- [ ] **Step 2: Add render prompt test**

Add to `tests/agent-final-render-prompt.spec.ts`:

```ts
test("final render prompt supports recommend-with-caveat policy", () => {
  assert.match(AGENT_FINAL_RENDER_PROMPT, /recommend_with_caveat/)
  assert.match(AGENT_FINAL_RENDER_PROMPT, /Produkte.*nennen.*Caveat|Caveat.*Produkte/i)
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts tests/agent-final-render-prompt.spec.ts
```

Expected: fails because `recommend_with_caveat` is not in the policy union or render prompt.

- [ ] **Step 4: Add policy type**

Modify `ProductResponsePolicy` in `src/lib/agent/tools/select-products.ts`:

```ts
export type ProductResponsePolicy =
  | "recommend"
  | "recommend_with_caveat"
  | "explain_then_recommend"
  | "redirect_to_better_lever"
  | "caution_without_products"
  | "needs_more_info"
  | "no_catalog_match"
```

- [ ] **Step 5: Preserve explicit safe weak-lever products**

Add helper functions near the existing shampoo route-context helpers:

```ts
function isExplicitProductSelectionJob(routeContext?: SelectProductsRouteContext | null): boolean {
  return routeContext?.userJob === "product_pick" || routeContext?.userJob === "compare_or_decide"
}

function isSafeWeakLeverShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext?: SelectProductsRouteContext | null,
): boolean {
  return (
    category === "shampoo" &&
    !isScalpSymptomShampooQuestion(category, routeContext) &&
    (isDryLengthOnlyShampooQuestion(category, routeContext) ||
      isShineShampooQuestion(category, routeContext) ||
      isFrizzShampooQuestion(category, routeContext))
  )
}
```

Modify `deriveDecision` so the safe weak-lever shampoo early return only redirects when the user did not explicitly ask for product selection:

```ts
  if (
    isSafeWeakLeverShampooQuestion(category, routeContext) &&
    !isExplicitProductSelectionJob(routeContext)
  ) {
    return "not_recommended"
  }
```

Keep scalp symptom, scalp-only conditioner, scalp-only mask, oil suppression, and deep-cleansing scalp-treatment returns unchanged.

- [ ] **Step 6: Return `recommend_with_caveat` policy**

In `buildProductResponsePolicy`, replace the shampoo weak-lever block with:

```ts
  if (isSafeWeakLeverShampooQuestion(category, routeContext)) {
    if (isExplicitProductSelectionJob(routeContext) && decision === "recommended") {
      return {
        product_response_policy: "recommend_with_caveat",
        policy_reason:
          "Der Nutzer fragt explizit nach Shampoo-Produkten; empfehle passende Shampoo-Optionen, aber erklaere knapp, dass Conditioner, Leave-in, Maske oder Technik fuer dieses Ziel oft der staerkere Hebel sind.",
      }
    }

    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Anfrage betrifft vor allem Laengen, Haaroberflaeche oder Stylingtechnik; Shampoo ist nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist.",
    }
  }
```

- [ ] **Step 7: Add category guidance for caveated shampoo picks**

In `buildCategoryGuidance`, replace the shine/frizz/dry-length shampoo branches with versions that account for explicit product asks:

```ts
    if (isDryLengthOnlyShampooQuestion(category, routeContext)) {
      return isExplicitProductSelectionJob(routeContext)
        ? "Du kannst Shampoo-Produkte empfehlen, weil der Nutzer explizit danach fragt. Caveat: Trockene Laengen werden meist staerker ueber Conditioner, Leave-in oder Maske beeinflusst; Shampoo bleibt vor allem Kopfhaut-/Reinigungshebel."
        : "Trockene Laengen sind meist kein Shampoo-first Problem. Shampoo sollte vor allem die Kopfhaut reinigen; die Laengen brauchen eher Schutz, Conditioner oder Leave-in."
    }

    if (isShineShampooQuestion(category, routeContext)) {
      return isExplicitProductSelectionJob(routeContext)
        ? "Du kannst Shampoo-Produkte empfehlen, weil der Nutzer explizit danach fragt. Caveat: Mehr Glanz entsteht meist staerker ueber Pflege, Oberflaeche und Stylingtechnik als ueber Shampoo."
        : "Mehr Glanz entsteht meist ueber Pflege, Oberflaeche und Stylingtechnik. Shampoo ist dafuer nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }

    if (isFrizzShampooQuestion(category, routeContext)) {
      return isExplicitProductSelectionJob(routeContext)
        ? "Du kannst Shampoo-Produkte empfehlen, weil der Nutzer explizit danach fragt. Caveat: Frizz ist meist ein Laengen-, Pflege- oder Stylingthema; Shampoo bleibt vor allem Kopfhaut-/Reinigungshebel."
        : "Frizz ist meist ein Laengen-, Pflege- oder Stylingthema. Shampoo ist dafuer nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }
```

- [ ] **Step 8: Update prompts**

In `AGENT_FINAL_RENDER_PROMPT`, add:

```text
- product_response_policy=recommend_with_caveat: Produkte in Tool-Reihenfolge nennen, aber zuerst oder unmittelbar danach klar sagen, dass diese Kategorie fuer das Ziel nicht der staerkste Hebel ist. Danach weich zum staerkeren Hebel fuehren.
```

In `AGENTIC_TOOL_LOOP_PROMPT`, add:

```text
- Wenn selected_products.product_response_policy=recommend_with_caveat ist, erfuellst du die explizite Produktfrage und gibst danach eine kurze fachliche Einordnung zum besseren Hebel.
```

- [ ] **Step 9: Add answer-context capsule**

In `src/lib/agent/orchestrator/agentic-answer-context.ts`, add capsule ID:

```ts
  | "product.recommend_with_caveat"
```

Add capsule:

```ts
  "product.recommend_with_caveat": {
    instruction:
      "Bei expliziten Produktfragen mit Caveat: erst den Wunsch respektieren und die Tool-Produkte nennen; dann knapp erklaeren, welcher Hebel fuer das Ziel wahrscheinlich staerker ist. Nicht wie eine Ablehnung formulieren.",
  },
```

In `addProductCapsules`, before redirect handling:

```ts
  if (selectedProducts.product_response_policy === "recommend_with_caveat") {
    addCapsule(capsuleIds, "product.recommend_with_caveat")
    addCapsule(capsuleIds, "product.recommendation_shape")
    if (selectedProducts.category === "shampoo") {
      addCapsule(capsuleIds, "category.shampoo.redirect")
    }
    return
  }
```

- [ ] **Step 10: Run focused tests**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts tests/agent-final-render-prompt.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: passes.

## Task 5: Compare Lab Plumbing And UX Label

**Files:**
- Modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: `tests/agent-compare-api.spec.ts`
- Test: `tests/agent-compare-runner.spec.ts`

- [ ] **Step 1: Verify Compare Lab uses inline context as the recommended mode**

Inspect `src/lib/agent/compare/run-agentic-tool-loop.ts`. The `inline_context` variant should call `runAgenticToolTurn` with:

```ts
answerCompositionMode: "inline_context",
```

No new variant is required for V1 because `consultation_brief` is now part of `inline_context`.

- [ ] **Step 2: Update the dropdown label**

In `src/components/labs/agent-compare-lab.tsx`, change:

```tsx
<option value="inline_context">Kontext inline</option>
```

to:

```tsx
<option value="inline_context">Beratungsbrief</option>
```

Keep:

```tsx
<option value="composer_context">Composer</option>
<option value="baseline">Ohne Kontext</option>
```

- [ ] **Step 3: Add API trace assertion**

In `tests/agent-compare-api.spec.ts`, extend the inline context test result trace fixture to include:

```ts
tool_loop_trace: {
  consultation_brief: {
    charter: ["Educate before recommending products when the user shows conceptual curiosity."],
    routine_staging: [],
    product_vs_education: [],
    profile_overlays: [],
    candidate_guidance: [],
  },
  tool_calls: [{ name: "select_products" }],
},
```

Assert the API preserves it:

```ts
assert.match(JSON.stringify(body.results), /consultation_brief/)
```

- [ ] **Step 4: Run Compare Lab tests**

Run:

```bash
npx tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: passes.

## Task 6: Manual Compare Lab Test Pack

**Files:**
- Modify: `plans/2026-05-05-agentic-tool-loop-eval-seed.md`

- [ ] **Step 1: Add the consultation-brief smoke pack**

Append this section to `plans/2026-05-05-agentic-tool-loop-eval-seed.md`:

```md
## Agentic Consultation Brief V1 Smoke Pack

Run in `/labs/agent-compare` with tool-loop variant `Beratungsbrief` / `inline_context`.

1. Broad routine staging
   - `ich möchte meine routine anpassen`
   - Expected tool_loop shape: starts with shampoo, conditioner, and one highest-impact extra lever; does not dump every optional module; asks whether to go toward goals or problems.

2. Conceptual leave-in follow-up
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `ja ich habe gehört leave in soll gut sein`
   - Expected tool_loop shape: educates on leave-in as a light booster; no product list unless user asks for products.

3. Explicit leave-in product ask
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `ja ich habe gehört leave in soll gut sein`
   - Turn 3: `ok welches leave in kannst du empfehlen`
   - Expected tool_loop shape: calls `select_products(leave_in)` and names products using supported claims.

4. Explicit shampoo ask with better-lever caveat
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `ja ich habe gehört leave in soll gut sein`
   - Turn 3: `ja oder ich änder erstmal mein shampoo, welches kannst du empfehlen`
   - Expected tool_loop shape: recommends shampoo products if available, then caveats that shine/frizz/dry lengths usually respond more to conditioner, leave-in, mask, or technique.

5. Conceptual mask necessity
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `eine maske brauche ich also nicht?`
   - Expected tool_loop shape: says mask is optional extra length care; no product list unless asked.
```

- [ ] **Step 2: Run markdown diff check**

Run:

```bash
git diff --check -- plans/2026-05-05-agentic-tool-loop-eval-seed.md
```

Expected: no whitespace errors.

## Task 7: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts tests/agent-select-products-tool.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: all pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: passes or shows only the known pre-existing warnings:

```text
src/components/layout/header.tsx unused Menu
src/components/ui/avatar.tsx img warning
src/lib/rag/mask-reranker.ts unused spec
src/lib/routines/brush-tools.ts unused context
```

- [ ] **Step 4: Run diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Manual Compare Lab verification**

Use the in-app browser at:

```text
http://localhost:3274/labs/agent-compare
```

Run the five prompts from `Agentic Consultation Brief V1 Smoke Pack`.

Expected:
- conceptual leave-in and mask turns educate first and avoid product dumps
- explicit leave-in asks call `select_products`
- explicit shampoo asks recommend products with a soft better-lever caveat
- broad routine answers stay on basics plus one priority lever
- `tool_loop_trace.consultation_brief` is visible in the debug payload

## Non-Goals For This Plan

- Do not expose `load_guidance` as a model-selected tool.
- Do not add a second LLM call.
- Do not make Composer default.
- Do not wire production chat.
- Do not implement oil, bondbuilder, or deep-cleansing sourcebooks in V1.
- Do not create a new guidance abstraction separate from `data/agent-guidance`.
- Do not change product ranking or routine planning logic except for the explicit safe weak-lever response policy.

## Self-Review

- Spec coverage: the plan covers the five brief layers, existing guidance reuse, Compare Lab-only scope, one-call default, product/routine tool authority, and the explicit safe category ask policy.
- Placeholder scan: no unresolved placeholder markers or unspecified test steps are used.
- Type consistency: `AgenticConsultationBrief`, `consultation_brief`, `recommend_with_caveat`, and existing `inline_context` variant names are used consistently.
- Hard tradeoff preserved: deterministic code curates candidate context, but it does not decide the user's intent or force a tool call.
