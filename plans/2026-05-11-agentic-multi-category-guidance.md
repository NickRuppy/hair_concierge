# Agentic Multi-Category Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Compare Lab Product-Evaluation tool loop load richer, section-aware category guidance for conceptual comparisons such as "Maske oder Oel?" without adding a Composer call or hard-coded pair matrices.

**Architecture:** Keep the assistant model-native: the LLM chooses advisory/product/routine tools, while deterministic code validates tool input, guarantees explicitly mentioned categories are available, caps context size, and preserves product/routine authority. Category docs remain human-editable Markdown with standardized headings and runtime-variable sections. `load_advisor_guidance` returns a compact, section-aware projection instead of dumping full files into the model.

**Tech Stack:** Next.js/TypeScript, OpenAI strict function tools, existing `data/agent-guidance` Markdown catalog, Node test runner via `npx tsx --test`, Compare Lab at `/labs/agent-compare`.

---

## Alignment Decisions

- Build tool support for all advisor categories, but editorially polish the core comparison set first: `shampoo`, `conditioner`, `leave_in`, `mask`, `oil`, `deep_cleansing`.
- Primary category input is `categories[]`; `category` remains a required nullable schema field because the tool uses `strict: true`, and the resolver collapses `category` into `categories[]` for convenience.
- The resolver auto-adds categories explicitly named in the user message, capped at 3, so "Maske oder Oel?" cannot accidentally load only `general_haircare`.
- Add one generic comparison playbook/rubric; do not create exhaustive pair-specific guidance.
- Oil guidance becomes "oil roles": finish/tips as the common default, pre-wash oiling when explicitly signaled, and scalp oiling as rare/conservative. The LLM uses this in prose; no new deterministic `oil_role` router is added in this iteration.
- Markdown docs declare `## Runtime Variables`; the tool does not invent product facts.
- Keep `select_products` and `build_or_fix_routine` authoritative for concrete products and routine steps.

## Non-Goals

- Do not wire production chat.
- Do not add a second LLM call.
- Do not add a separate `compare_categories` tool for this iteration.
- Do not create a pairwise matrix of every possible product-category comparison.
- Do not change product ranking, product claims, or routine priority logic.
- Do not depend on `ConversationContextPacketV1`.

## Architecture Verdict

The desired shape is model-native enough: deterministic code supplies clean context plumbing and authority boundaries, while the LLM owns synthesis, tradeoffs, and profile-aware explanation. The main risk is content quality, not routing. Therefore this plan invests in comparable category context and lightweight resolver guarantees instead of adding more routers.

## Target File Map

- Modify: `src/lib/agent/contracts.ts`
  - Add `playbook:category_comparison` to `GUIDANCE_IDS`.
- Create: `data/agent-guidance/playbooks/category-comparison.md`
  - Generic comparison rubric for category-vs-category decisions.
- Modify: `src/lib/agent/guidance/catalog.ts`
  - Register the generic category-comparison playbook.
- Modify: `src/lib/agent/tools/load-advisor-guidance.ts`
  - Add required `categories[]`, explicit category inference, capped multi-category guidance IDs, canonical category normalization, and section-aware projection fields.
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
  - Add required `categories` to the strict `load_advisor_guidance` schema.
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Normalize the new `categories[]` argument before invoking the tool.
- Modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
  - Pass normalized `categories[]` through the Compare Lab runtime tool shim.
- Modify: core topic docs under `data/agent-guidance/topics/{shampoo,conditioner,leave-in,mask,hair-oiling,deep-cleansing}/`
  - Add standardized headings and runtime variables. This is a real editorial task, not a cosmetic rename.
- Modify: `data/agent-guidance/playbooks/compare-or-decide.md`
  - Point category comparisons toward multi-category docs plus the generic rubric.
- Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Tell the model to request all explicitly compared categories in `categories[]` and prefer `category_sections` when available.
- Modify: `tests/agent-guidance.spec.ts`
  - Cover multi-category loading, explicit category inference, fallback prevention, section-aware projection, heading consistency, and canonical category normalization.
- Modify: `tests/agentic-tool-loop.spec.ts`
  - Cover tool schema and model-facing prompt contract.

## Context Budget

Budget rule for multi-category guidance:

- Max categories: 3.
- Max profile overlays: 3.
- `category_sections`: each category gets its own compact section, max 4 key points.
- For 2+ category sections, `key_advice_points` should contain playbook-level guidance only; category-specific advice lives in `category_sections`.
- For 2+ category sections, `category_implications` should be empty or a tiny summary, not a truncated aggregate of all category docs.
- Prompt must tell the model to prefer `category_sections` over aggregate `key_advice_points` when present.

This avoids the current hidden failure mode where 3 topics compete for a global `MAX_KEY_POINTS = 8` and the third category silently loses context.

## Task 1: Add The New Guidance ID And Playbook First

**Files:**
- Modify: `src/lib/agent/contracts.ts`
- Create: `data/agent-guidance/playbooks/category-comparison.md`
- Modify: `src/lib/agent/guidance/catalog.ts`

- [ ] **Step 1: Add the new guidance ID**

In `src/lib/agent/contracts.ts`, add the new ID directly after `playbook:compare_or_decide`:

```ts
export const GUIDANCE_IDS = [
  "playbook:recommend_products",
  "playbook:build_or_fix_routine",
  "playbook:troubleshoot_hair_issue",
  "playbook:compare_or_decide",
  "playbook:category_comparison",
  "playbook:usage_and_application",
  // ...
] as const
```

- [ ] **Step 2: Create the generic category comparison playbook**

Create `data/agent-guidance/playbooks/category-comparison.md`:

```md
# Category Comparison

Use when the user asks which care category is more useful, necessary, or higher priority.

## Comparison Method
- First compare category roles, not products.
- Prefer the category that best matches the user's current problem, routine gap, and profile risk.
- If both categories can help, state the order of introduction instead of recommending both at once.
- If the user asks for concrete products, use `select_products`; this playbook does not authorize product names.

## Decision Axes
- `role`: cleansing, baseline conditioning, leave-in protection, periodic treatment, cosmetic finish, reset
- `routine_position`: every wash, after wash, between washes, occasional, pre-wash
- `speed_of_visible_effect`: immediate feel/shine, wash-cycle improvement, long-term prevention
- `weight_risk`: low, medium, high for fine, oily, low-volume, or buildup-prone profiles
- `problem_fit`: dry lengths, frizz, oily roots, buildup, damage, split ends, curl definition
- `ask_followup_when`: the answer changes based on missing purpose, severity, or current routine

## Answer Shape
1. Direct tendency: "Ich wuerde eher mit X starten."
2. Why: map the user problem/profile to category role.
3. Contrast: one useful difference per category.
4. Practical next step: introduce one category first, then reassess.

## Guardrails
- Do not invent hard pair rules when category docs are enough.
- Do not imply oils moisturize hair like water-based conditioning.
- Do not present masks, oils, or conditioner as scalp treatments.
- Do not recommend multiple new categories in parallel unless the user explicitly wants a bigger routine.
```

- [ ] **Step 3: Register the playbook**

Add to `src/lib/agent/guidance/catalog.ts`:

```ts
"playbook:category_comparison": {
  kind: "playbook",
  title: "Kategorien vergleichen",
  path: "data/agent-guidance/playbooks/category-comparison.md",
},
```

- [ ] **Step 4: Run the guidance smoke test**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: PASS or fail only because later tests have not been added yet. There should be no `GuidanceId` type error for `playbook:category_comparison`.

## Task 2: Add Failing Tests For Multi-Category Guidance

**Files:**
- Modify: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Import the new normalizer**

Update the import from `@/lib/agent/tools/load-advisor-guidance`:

```ts
import {
  loadAdvisorGuidance,
  normalizeAdvisorGuidanceCategories,
  resolveAdvisorGuidanceIds,
} from "@/lib/agent/tools/load-advisor-guidance"
```

- [ ] **Step 2: Update existing direct `loadAdvisorGuidance` calls**

Every direct `loadAdvisorGuidance({ ... })` call in this test file must include `categories: []` unless the test is specifically exercising multi-category behavior.

Example:

```ts
const guidance = await loadAdvisorGuidance({
  intent: "usage",
  category: "leave_in",
  categories: [],
  profileFocus: ["dry_lengths", "fine_hair"],
  message: "wann wuerde ich leave-in verwenden?",
  userContext,
  conversationState: null,
})
```

- [ ] **Step 3: Add a test proving explicit category mentions are guaranteed**

Add this test after the existing semantic usage test:

```ts
test("loadAdvisorGuidance loads explicitly compared categories and comparison playbook", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "compare_or_decide",
    category: null,
    categories: ["mask"],
    profileFocus: ["dry_lengths", "fine_hair"],
    message: "Ist bei trockenen Spitzen eine Maske oder Oel sinnvoller?",
    userContext: createUserContext({
      profile: createHairProfile({
        hair_texture: "straight",
        thickness: "fine",
        concerns: ["dryness"],
        scalp_type: "balanced",
      }),
    }),
    conversationState: null,
  })

  // Prefix assertion is intentional: profile overlays are appended after playbooks/topics.
  assert.deepEqual(guidance.loaded_guidance_ids.slice(0, 4), [
    "playbook:compare_or_decide",
    "playbook:category_comparison",
    "topic:mask",
    "topic:hair_oiling",
  ])
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:dry_lengths"))
  assert.ok(guidance.loaded_guidance_ids.includes("overlay:fine_hair"))
  assert.ok(guidance.category_sections.some((section) => section.category === "mask"))
  assert.ok(guidance.category_sections.some((section) => section.category === "oil"))
  assert.equal(guidance.category_implications.length, 0)
  assert.match(guidance.direct_answer_frame, /Compare the practical roles first/i)
})
```

- [ ] **Step 4: Add the regression test for no `general_haircare` fallback**

```ts
test("loadAdvisorGuidance infers compared categories without falling back to general guidance", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "compare_or_decide",
    category: null,
    categories: [],
    profileFocus: [],
    message: "Maske oder Oel fuer trockene Spitzen?",
    userContext: createUserContext(),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("playbook:category_comparison"))
  assert.ok(guidance.loaded_guidance_ids.includes("topic:mask"))
  assert.ok(guidance.loaded_guidance_ids.includes("topic:hair_oiling"))
  assert.ok(!guidance.loaded_guidance_ids.includes("topic:general_haircare"))
})
```

- [ ] **Step 5: Add a test for category normalization, synonym merge, and cap**

```ts
test("normalizeAdvisorGuidanceCategories canonicalizes, deduplicates, and caps categories", () => {
  assert.deepEqual(
    normalizeAdvisorGuidanceCategories([
      "mask",
      "oil",
      "conditioner",
      "mask",
      "bondbuilder",
      "unknown",
    ]),
    ["mask", "oil", "conditioner"],
  )

  assert.deepEqual(normalizeAdvisorGuidanceCategories(["bondbuilder"]), ["bond_builder"])
})
```

- [ ] **Step 6: Add a heading consistency test for polished topics**

This intentionally makes the editorial content work visible. Each polished topic must expose the same comparable headings somewhere in its concatenated catalog content.

```ts
test("polished category guidance exposes comparable markdown headings", async () => {
  const requiredHeadings = [
    "## Runtime Variables",
    "## Category Role",
    "## Best Fit",
    "## Weak Fit",
    "## Decision Axes",
    "## Profile Interplay",
    "## Compare Against Other Categories",
    "## Answer Guidance",
    "## Guardrails",
  ]

  for (const id of [
    "topic:shampoo",
    "topic:conditioner",
    "topic:leave_in",
    "topic:mask",
    "topic:hair_oiling",
    "topic:deep_cleansing",
  ] as const) {
    const result = await loadGuidance([id])
    const content = result.items[0]?.content ?? ""
    for (const heading of requiredHeadings) {
      assert.match(content, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), id)
    }
  }
})
```

- [ ] **Step 7: Run the focused test and confirm failure**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: FAIL because `categories`, `category_sections`, canonical category normalization, and standardized headings do not exist yet.

## Task 3: Implement Multi-Category Input, Resolver, And Projection Budget

**Files:**
- Modify: `src/lib/agent/tools/load-advisor-guidance.ts`
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
- Test: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Extend the tool input and projection types**

In `src/lib/agent/tools/load-advisor-guidance.ts`, update the interfaces:

```ts
export interface LoadAdvisorGuidanceInput {
  intent: AdvisorGuidanceIntent | null
  category: AdvisorGuidanceCategory | null
  categories: AdvisorGuidanceCategory[]
  profileFocus: AdvisorProfileFocus[]
  message: string
  userContext: UserContextProjection
  conversationState?: ConversationState | null
}

export interface AdvisorGuidanceCategorySection {
  category: AdvisorGuidanceCategory
  guidance_id: GuidanceId
  key_points: string[]
}

export interface AdvisorGuidanceProjection {
  loaded_guidance_ids: GuidanceId[]
  direct_answer_frame: string
  key_advice_points: string[]
  profile_interpretation: string[]
  category_implications: string[]
  category_sections: AdvisorGuidanceCategorySection[]
  avoid: string[]
  proactive_next_step_options: string[]
}
```

- [ ] **Step 2: Add a category normalizer and explicit mention inference**

Add near the existing normalizers:

```ts
const MAX_GUIDANCE_CATEGORIES = 3
const MAX_CATEGORY_SECTION_POINTS = 4

export function normalizeAdvisorGuidanceCategories(value: unknown): AdvisorGuidanceCategory[] {
  if (!Array.isArray(value)) return []

  return unique(
    value
      .map((item) => normalizeAdvisorGuidanceCategory(item))
      .map((item) => (item === "bondbuilder" ? "bond_builder" : item))
      .filter((item): item is AdvisorGuidanceCategory => item !== null),
  ).slice(0, MAX_GUIDANCE_CATEGORIES)
}

function inferMentionedCategories(message: string): AdvisorGuidanceCategory[] {
  const normalized = normalizeText(message)
  const categories: AdvisorGuidanceCategory[] = []

  if (/\b(?:shampoo|waschgel|reinigungsshampoo)\b/.test(normalized)) categories.push("shampoo")
  if (/\b(?:conditioner|spuelung|spulung)\b/.test(normalized)) categories.push("conditioner")
  if (/\b(?:leave[-_ ]?in|leavein)\b/.test(normalized)) categories.push("leave_in")
  if (/\b(?:maske|kur|haarkur)\b/.test(normalized)) categories.push("mask")
  if (/\b(?:oel|ol|oil|haarol|haaroel)\b/.test(normalized)) categories.push("oil")
  if (/\b(?:tiefenreinigung|deep cleansing|clarifying|reset)\b/.test(normalized)) {
    categories.push("deep_cleansing")
  }
  if (/\b(?:bondbuilder|bond builder|k18|olaplex|epres)\b/.test(normalized)) {
    categories.push("bond_builder")
  }

  return unique(categories).slice(0, MAX_GUIDANCE_CATEGORIES)
}
```

The `ol` alternative is bounded as a whole word after `normalizeText`, so it catches German `Oel/Oel` normalization without matching substrings inside words.

- [ ] **Step 3: Resolve category IDs from model input plus explicit mentions**

Replace the single-category block in `resolveAdvisorGuidanceIds` with:

```ts
const resolvedCategories = resolveAdvisorCategories(input)
if (intent === "compare_or_decide" && resolvedCategories.length >= 2) {
  ids.push("playbook:category_comparison")
}

for (const category of resolvedCategories) {
  ids.push(CATEGORY_GUIDANCE_ID[category])
}
```

Add:

```ts
function resolveAdvisorCategories(input: LoadAdvisorGuidanceInput): AdvisorGuidanceCategory[] {
  return unique([
    ...normalizeAdvisorGuidanceCategories(input.categories),
    ...(input.category ? normalizeAdvisorGuidanceCategories([input.category]) : []),
    ...inferMentionedCategories(input.message),
  ]).slice(0, MAX_GUIDANCE_CATEGORIES)
}
```

- [ ] **Step 4: Preserve section labels without silently truncating categories**

In `normalizeAdvisorGuidanceProjection`, add category sections before the return:

```ts
const categorySections = topicItems
  .map((item) => {
    const category = mapGuidanceIdToAdvisorCategory(item.id)
    if (!category) return null
    return {
      category,
      guidance_id: item.id,
      key_points: compactLines([item], MAX_CATEGORY_SECTION_POINTS),
    }
  })
  .filter((item): item is AdvisorGuidanceCategorySection => item !== null)
const hasMultipleCategorySections = categorySections.length > 1
```

Update the return:

```ts
return {
  loaded_guidance_ids: params.items.map((item) => item.id),
  direct_answer_frame: buildDirectAnswerFrame(params.intent, params.category),
  key_advice_points: compactLines(
    hasMultipleCategorySections ? playbookItems : allNonOverlayItems,
    MAX_KEY_POINTS,
  ),
  profile_interpretation: compactLines(overlayItems, MAX_PROFILE_POINTS),
  category_implications: hasMultipleCategorySections
    ? []
    : compactLines(topicItems, MAX_KEY_POINTS),
  category_sections: categorySections,
  avoid: compactAvoidLines(params.items, MAX_AVOID_POINTS),
  proactive_next_step_options: buildProactiveNextSteps(params.intent),
}
```

Add the mapper using explicit category order:

```ts
function mapGuidanceIdToAdvisorCategory(id: GuidanceId): AdvisorGuidanceCategory | null {
  for (const category of ADVISOR_GUIDANCE_CATEGORIES) {
    if (category === "bondbuilder") continue
    if (CATEGORY_GUIDANCE_ID[category] === id) return category
  }
  return null
}
```

- [ ] **Step 5: Update the strict tool schema**

In `src/lib/agent/orchestrator/tool-definitions.ts`, change the `load_advisor_guidance` schema to require `categories`:

```ts
required: ["intent", "category", "categories", "profileFocus"],
properties: {
  intent: {
    type: ["string", "null"],
    enum: [...ADVISOR_GUIDANCE_INTENTS, null],
  },
  category: {
    type: ["string", "null"],
    enum: [...ADVISOR_GUIDANCE_CATEGORIES, null],
  },
  categories: {
    type: "array",
    items: {
      type: "string",
      enum: ADVISOR_GUIDANCE_CATEGORIES,
    },
  },
  profileFocus: {
    type: "array",
    items: {
      type: "string",
      enum: ADVISOR_PROFILE_FOCUS,
    },
  },
},
```

- [ ] **Step 6: Normalize `categories[]` in both runtime paths**

In `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`, update `buildAdvisorGuidanceInput`:

```ts
return {
  intent: normalizeAdvisorGuidanceIntent(input.intent),
  category: normalizeAdvisorGuidanceCategory(input.category),
  categories: normalizeAdvisorGuidanceCategories(input.categories),
  profileFocus: normalizeAdvisorProfileFocus(input.profileFocus),
  message: params.message,
  userContext: params.userContext,
  conversationState: params.conversationState ?? null,
}
```

In `src/lib/agent/compare/run-agentic-tool-loop.ts`, pass the same field into `loadAdvisorGuidance`.

- [ ] **Step 7: Run focused guidance tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: FAIL only on the heading consistency test until Task 4 completes.

## Task 4: Standardize The Core Category Markdown

**Files:**
- Modify: `data/agent-guidance/topics/shampoo/core-fit.md`
- Modify: `data/agent-guidance/topics/conditioner/core-fit.md`
- Modify: `data/agent-guidance/topics/leave-in/core-fit.md`
- Modify: `data/agent-guidance/topics/mask/core-fit.md`
- Modify: `data/agent-guidance/topics/hair-oiling/core-fit.md`
- Modify: `data/agent-guidance/topics/deep-cleansing/core-fit.md`
- Modify as needed: matching `response-playbook.md`, `guardrails.md`, and `confusions.md` files in the same folders.
- Test: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Apply the standardized heading skeleton to each polished topic**

Each topic's concatenated catalog content must include:

```md
## Runtime Variables
## Category Role
## Best Fit
## Weak Fit
## Decision Axes
## Profile Interplay
## Compare Against Other Categories
## Answer Guidance
## Guardrails
```

Prefer putting `Runtime Variables`, `Category Role`, `Best Fit`, `Weak Fit`, `Decision Axes`, `Profile Interplay`, and `Compare Against Other Categories` in `core-fit.md`. Keep answer phrasing in `response-playbook.md` and safety boundaries in `guardrails.md` when those files already exist.

- [ ] **Step 2: Standardize `shampoo`**

Use existing shampoo facts only. Important constraints:

- Shampoo is primarily scalp/root cleansing.
- Profile variables: `profile.thickness`, `profile.scalp_type`, `profile.scalp_condition`, `profile.concerns`, `current_routine_products`.
- It is weak for dry lengths, frizz, shine, and split-end repair unless the user explicitly asks for shampoo while being softly steered toward better levers.

- [ ] **Step 3: Standardize `conditioner`**

Use existing conditioner facts only. Important constraints:

- Conditioner is the baseline length-care anchor after washing.
- Profile variables: `profile.thickness`, `profile.hair_texture`, `profile.concerns`, `profile.protein_moisture_balance`, `current_routine_products`.
- It belongs in lengths/ends, not scalp.

- [ ] **Step 4: Standardize `leave_in`**

Use existing leave-in facts only. Important constraints:

- Leave-in is a post-wash booster/protection/styling-prep category.
- Profile variables: `profile.thickness`, `profile.hair_texture`, `profile.heat_styling`, `profile.concerns`, `uses_heat_protection`, `current_routine_products`.
- It can sometimes reduce routine complexity when it combines care plus supported heat protection, but exact product claims still require `select_products`.

- [ ] **Step 5: Standardize `mask`**

Use existing mask facts only. Important constraints:

- Mask is periodic extra care for lengths and ends, not a baseline product or scalp treatment.
- Profile variables: `profile.thickness`, `profile.hair_texture`, `profile.chemical_treatment`, `profile.protein_moisture_balance`, `profile.concerns`.
- It can soften/condition and support rough-feeling lengths, but does not permanently repair split ends.

- [ ] **Step 6: Standardize `hair-oiling` as oil roles**

Use existing oil facts and product-purpose vocabulary only. Important constraints:

```md
## Category Role
Oil has three advisory roles. In normal chat, "Oel fuer trockene Spitzen" usually means a finish/tips role; "vor dem Waschen", "einwirken", "Massage", or carrier-oil language means pre-wash oiling; scalp oiling is a cautious niche case and not the default.

## Decision Axes
- `oil_role`: finish/tips, pre-wash length protection, cautious scalp comfort
- `weight_risk`: especially important for fine, oily, flat, or buildup-prone hair
- `problem_fit`: shine/frizz/tips feel for finish oil; wash roughness/dry porous lengths for pre-wash oiling; dry/tight non-inflamed scalp for cautious scalp comfort
- `not_for`: true moisture replacement, split-end repair, growth promises, medical scalp treatment
```

- [ ] **Step 7: Standardize `deep_cleansing`**

Use existing deep-cleansing facts only. Important constraints:

- Deep cleansing is an occasional reset, not daily cleansing and not scalp-disease treatment.
- Profile variables: `profile.scalp_type`, `profile.concerns`, `products_used`, `current_routine_products`, buildup/reset signals.
- It can be valid for buildup, product residue, heavy/oily feel, or routine reset; it should be used cautiously with dry, fine, curly, color-treated, or sensitive profiles.

- [ ] **Step 8: Run heading and guidance tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: PASS.

## Task 5: Update Prompt Contract And Tool Schema Tests

**Files:**
- Modify: `data/agent-guidance/playbooks/compare-or-decide.md`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Modify: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Update compare-or-decide to reference category sections**

Add to `data/agent-guidance/playbooks/compare-or-decide.md` near the category-comparison rules:

```md
For category-vs-category questions, use the category docs and `playbook:category_comparison` first. Compare the roles and profile fit from the loaded category sections; do not invent pair-specific rules when the category docs are enough.
```

- [ ] **Step 2: Add prompt instruction for multi-category advisory calls**

In `AGENTIC_TOOL_LOOP_PROMPT`, add this as its own Tool-Regeln bullet:

```ts
- Bei Vergleichsfragen wie "Maske oder Oel?", "Leave-in oder Conditioner?" oder "X statt Y?" nutze load_advisor_guidance mit categories[] fuer alle explizit genannten Kategorien (max. 3). Nutze select_products erst, wenn konkrete Produktnamen oder Produktpicks gefragt sind.
```

Add this to the advisor-guidance answer rule:

```ts
- Wenn advisor_guidance.category_sections vorhanden ist, nutze diese sections als primaeren Kategorie-Kontext und key_advice_points nur als uebergreifendes Playbook-Briefing.
```

- [ ] **Step 3: Add a prompt/schema test**

In `tests/agentic-tool-loop.spec.ts`, near the existing prompt contract tests, add:

```ts
test("agentic prompt asks for multi-category guidance on category comparisons", () => {
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /categories\[\].*alle explizit genannten Kategorien/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /advisor_guidance\.category_sections/i)
  assert.match(AGENTIC_TOOL_LOOP_PROMPT, /Maske oder Oel/i)
})
```

If a tool-definition test already inspects `load_advisor_guidance`, extend it to assert `categories` is required. Otherwise add:

```ts
test("load advisor guidance tool exposes required categories array", () => {
  const definition = buildAgenticToolDefinitions({ includeAdvisorGuidance: true }).find(
    (tool) => tool.function.name === "load_advisor_guidance",
  )
  const parameters = definition?.function.parameters as {
    required?: string[]
    properties?: Record<string, unknown>
  }

  assert.ok(parameters.required?.includes("categories"))
  assert.ok(parameters.properties?.categories)
})
```

- [ ] **Step 4: Run agentic tool-loop tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected: PASS.

## Task 6: Verification

**Files:**
- No required source files.
- Optional update: `plans/2026-05-05-agentic-tool-loop-eval-seed.md`

- [ ] **Step 1: Run static verification**

Run:

```bash
npm run typecheck
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Optional Compare Lab smoke test before PR**

Use the Product-Evaluation setting and a real profile context. Test this chain:

```txt
Welche Routine passt, wenn mein Ansatz schnell fettet und die Spitzen trocken sind?
Mein Ansatz fettet schnell, welches Shampoo soll ich nehmen?
Meine Laengen sind trocken, brauche ich ein anderes Shampoo?
Brauche ich Leave-in oder reicht ein guter Conditioner?
Ist bei trockenem Haar eine Maske oder Oel sinnvoller?
```

Expected trace behavior:

- Turn 1: `build_or_fix_routine`
- Turn 2: `select_products` with category `shampoo`
- Turn 3: `load_advisor_guidance`, not product picks unless explicitly requested
- Turn 4: `load_advisor_guidance` with `conditioner + leave_in`
- Turn 5: `load_advisor_guidance` with `mask + oil + playbook:category_comparison`

Expected answer behavior:

- Directly answers the user's comparison before suggesting adjacent next steps.
- Uses the user's profile and routine gap.
- Explains category role differences in a structured but natural way.
- Does not invent product names.
- Does not say internal words such as "Tool", "Guidance", "Fallback", or "Capsule".

- [ ] **Step 3: Observational latency note**

Record elapsed milliseconds from Compare Lab for the final comparison turn. This is not a CI pass/fail threshold because live LLM latency is noisy. It should, however, confirm the trace still uses one model turn and one `load_advisor_guidance` tool call; if a second LLM call appears, that is a regression.

## Implementation Order

1. Task 1 guidance ID/playbook registration first, so later type checks fail for the right reasons.
2. Task 2 tests.
3. Task 3 runtime/schema/projection budget.
4. Task 4 category docs.
5. Task 5 prompt contract.
6. Task 6 verification and optional smoke test.

## Success Criteria

- `load_advisor_guidance` can load 2-3 relevant categories in one tool call.
- Explicit comparison messages load the named category docs and the generic comparison playbook.
- "Maske oder Oel?" no longer falls back to `topic:general_haircare`.
- The final mask-vs-oil answer is more decisive and contextual without pair-specific code.
- Product recommendations still only come from `select_products`.
- Routine structure still only comes from `build_or_fix_routine`.
- Compare Lab clearly tests current production/classic baseline against Product-Evaluation one-call tool loop with richer context.
