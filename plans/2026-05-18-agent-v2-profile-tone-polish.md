# AgentV2 Profile And Tone Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentV2 answers surface materially relevant profile facts more consistently and use a calmer, cleaner German answer frame without adding deterministic intent routing.

**Architecture:** Keep AgentV2 as one Responses loop with typed tools and terminal validation. Improve the model-facing context and guidance so profile facts are easier to use, and add regression tests that protect the guidance shape without forcing semantic routing through regexes. No new terminal payload fields for this pass.

**Tech Stack:** TypeScript, Node test runner with `tsx`, AgentV2 guidance markdown, Responses runtime prompt construction, Compare Lab tests.

---

## Spec Link

- Source conversation/design: latest Compare Lab analysis from saved runs #16-#19 in `tmp/agent-compare-runs.jsonl`.
- Existing stabilization plan context: `plans/2026-05-18-agent-v2-manual-test-stabilization.md`.

## User Situation

Manual Compare Lab testing shows AgentV2 is mostly choosing the right tools and handling follow-ups better, but:

- routine answers sometimes underuse important profile context, such as wash rhythm, drying method, styling/heat, fine hair, scalp, current routine, or concerns;
- usage frequency answers should state when they are derived from profile facts like wash rhythm;
- prose can feel busy because of too many bold mini-headings or bullet stacks;
- the model sometimes implies uncollected preferences, such as “dein Wunsch nach einer einfachen Routine,” when the user did not say that.

## Promised End-State

AgentV2 keeps semantic interpretation inside the model, but the model receives clearer outcome-level guidance:

- use 2-3 materially relevant profile facts when they affect the recommendation;
- explicitly anchor frequency guidance to wash rhythm when used;
- do not phrase inferred convenience as a stored user preference;
- use a calmer answer shape: direct answer first, short profile-linked why, then compact steps/options only when useful.

## Target File Map

- Modify `src/lib/agent-v2/runtime/responses-agent.ts`
  - Add stable runtime guidance for profile fact use, wash-rhythm anchoring, and calmer answer structure.
  - Keep this prompt outcome-level; do not add category/intent regexes.
- Modify `data/agent-v2/guidance/base/tone-and-format.md`
  - Add calmer structure guidance and unsupported-preference wording rules.
- Modify `data/agent-v2/guidance/base/routine-building.md`
  - Add routine-specific profile fact guidance.
- Modify `data/agent-v2/guidance/base/product-recommendation.md`
  - Add product-answer profile grounding guidance, especially for usage/frequency when profile facts are used.
- Test `tests/agent-v2-responses-runtime.spec.ts`
  - Assert runtime prompt includes the new stable profile/tone guidance.
- Test `tests/agent-v2-guidance-compiler.spec.ts`
  - Assert loaded base guidance includes profile fact and unsupported-preference guidance.

## Scope Boundaries

In scope:

- Prompt/guidance changes.
- Regression tests for prompt/guidance presence.
- Manual-test-facing improvements only for AgentV2.

Out of scope:

- New terminal schema fields such as `profile_facts_used`.
- New validators that parse German semantics or block style words at runtime.
- Changes to old tool-loop production logic.
- Product ranking, routine planner, or profile data model changes.
- Re-litigating run #19 turn 3; treating mask-vs-oil ambiguity as acceptable.

## Compact Handoff

If context compacts before execution, continue from this file. The intended path is:

1. Add failing tests for runtime/guidance text.
2. Update AgentV2 runtime and guidance markdown.
3. Re-run focused AgentV2 tests, typecheck, lint, and `npm run test:agent`.
4. Keep implementation lightweight and avoid deterministic intent routing.

## Task 1: Runtime Prompt Guidance

**Files:**
- Modify: `tests/agent-v2-responses-runtime.spec.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`

- [x] **Step 1: Write the failing runtime guidance test**

Add a test near `AgentV2 runtime injects terminal payload field guidance`:

```ts
test("AgentV2 runtime injects profile-grounded answer quality guidance", async () => {
  const client = fakeResponsesClientWithOutputs([terminalGeneralAdvice("call_1")])

  await runAgentV2ResponsesTurn({
    client,
    message: "was ist die beste routine für mich",
    recentMessages: [],
    userContext: {
      hairProfile: {
        hair_texture: "straight",
        thickness: "fine",
        wash_frequency: "every_2_3_days",
        drying_method: "air_dry",
      },
      routineInventory: [],
      derivedSignals: ["Haardicke: Fein", "Waschrhythmus: Alle 2-3 Tage"],
      sessionMemory: [],
    },
    tools: fakeAgentV2Tools(),
  })

  const firstInput = getInputItems(client.requests[0])
  const qualityItem = firstInput
    .map(asRecord)
    .find((item) => String(item?.content ?? "").includes("AgentV2 answer quality guidance"))
  const content = String(qualityItem?.content ?? "")
  assert.match(content, /2-3 materially relevant profile facts/)
  assert.match(content, /wash rhythm/)
  assert.match(content, /do not invent a user preference/)
  assert.match(content, /calm answer shape/)
})
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: the new test fails because no “AgentV2 answer quality guidance” input item exists.

- [x] **Step 3: Implement minimal runtime guidance**

In `src/lib/agent-v2/runtime/responses-agent.ts`, add a system item in `buildInputItems()` after the terminal contract item:

```ts
{
  role: "system",
  content: buildAnswerQualityGuidance(),
}
```

Add:

```ts
function buildAnswerQualityGuidance(): string {
  return [
    "AgentV2 answer quality guidance.",
    "Use 2-3 materially relevant profile facts when they affect the answer, such as hair texture, thickness, wash rhythm, drying method, heat/styling behavior, scalp, current routine, goals, or concerns.",
    "When you give frequency or usage cadence and it is based on profile context, name the anchor plainly, for example: Bei deinem Waschrhythmus alle 2-3 Tage.",
    "Do not invent a user preference. Do not say the user wants an easy/minimal/simple routine unless the latest message, recent context, memory, or profile explicitly says that.",
    "If convenience is only a product property, phrase it as product-level convenience, such as unkompliziert in der Anwendung, not as a stored user preference.",
    "Use a calm answer shape: direct answer first, one short profile-linked why, then compact steps or options only when useful.",
    "Avoid stacking many bold subheaders. Use bold mostly for product names, step labels, or one or two anchors that improve scanning.",
  ].join(\"\\n\")
}
```

- [x] **Step 4: Run focused runtime test**

Run:

```bash
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

## Task 2: Guidance Package Polish

**Files:**
- Modify: `tests/agent-v2-guidance-compiler.spec.ts`
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Modify: `data/agent-v2/guidance/base/routine-building.md`
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`

- [x] **Step 1: Write the failing guidance compiler test**

Add a test in `tests/agent-v2-guidance-compiler.spec.ts`:

```ts
test("AgentV2 base guidance preserves profile grounding and calm structure guidance", () => {
  const tone = readFileSync("data/agent-v2/guidance/base/tone-and-format.md", "utf8")
  const routine = readFileSync("data/agent-v2/guidance/base/routine-building.md", "utf8")
  const product = readFileSync("data/agent-v2/guidance/base/product-recommendation.md", "utf8")

  assert.match(tone, /Do not invent a user preference/)
  assert.match(tone, /Avoid stacking many bold subheaders/)
  assert.match(routine, /profile facts/)
  assert.match(routine, /drying method/)
  assert.match(product, /wash rhythm/)
  assert.match(product, /usage cadence/)
})
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
node --import tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected: FAIL until the markdown guidance includes these exact concepts.

- [x] **Step 3: Update tone guidance**

In `data/agent-v2/guidance/base/tone-and-format.md`, add a section:

```md
## Profile Grounding And Inferred Preferences
Use profile facts when they materially change the answer, but do not invent a user preference.
Do not say the user wants an easy, minimal, or simple routine unless the user, memory, or profile explicitly says so.
If a product is convenient, say it is uncomplicated in use; do not frame that as a stored preference.

## Calm Structure
Prefer a direct answer, one short profile-linked why, then compact steps or options only when useful.
Avoid stacking many bold subheaders. Bold should mostly mark product names, step labels, or one or two useful anchors.
```

- [x] **Step 4: Update routine guidance**

In `data/agent-v2/guidance/base/routine-building.md`, add:

```md
## Routine Profile Facts
For routine answers, use 2-3 profile facts when they materially affect the routine: hair texture, thickness, wash rhythm, drying method, heat/styling behavior, scalp, current routine, goals, or concerns.
Prefer facts that change the practical advice. For example, fine hair affects product weight, wash rhythm affects cadence, and drying method affects whether leave-in/finish advice should mention air-drying or heat.
```

- [x] **Step 5: Update product guidance**

In `data/agent-v2/guidance/base/product-recommendation.md`, add:

```md
## Product Profile Anchoring
When explaining why a product fits, connect the fit to the most relevant profile facts, not every available fact.
When giving usage cadence, anchor it to wash rhythm or routine context if that is the basis. If the cadence is general category guidance, phrase it as a starting point rather than a profile-derived fact.
```

- [x] **Step 6: Run focused guidance test**

Run:

```bash
node --import tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected: PASS.

## Task 3: Verification

**Files:**
- Existing tests only.

- [x] **Step 1: Run focused AgentV2 tests**

Run:

```bash
node --import tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-compare-runner.spec.ts
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 3: Run agent test surface**

Run:

```bash
npm run test:agent
```

Expected: PASS with the existing skipped built-artifact test only.

- [x] **Step 4: Run lint and diff check**

Run:

```bash
npm run lint
git diff --check
```

Expected: lint has no new errors; known repo warnings may remain. `git diff --check` passes.

## Manual Compare Lab Check

Use `http://localhost:3283/labs/agent-compare` after restart.

Recommended prompts:

1. Nick: `was ist die beste routine für mich`
   - Expected: mentions fine/straight hair, wash rhythm, dry scalp or drying/styling when available; no invented “you want easy routine” preference.
2. Nick multi-turn:
   - `Welches Leave-in passt zu meinem feinen Haar?`
   - `welches davon ist leichter?`
   - `wie oft soll ich es verwenden?`
   - Expected: frequency answer anchors to wash rhythm if it says 2-4x/week.
3. Lea:
   - `Sollte ich eher Oel oder Maske gegen trockene Spitzen nehmen?`
   - `Ich meine Oel eher als Finish, nicht auf die Kopfhaut.`
   - `Welches Produkt passt dann?`
   - `glanz vor allem`
   - Expected: defensible mask/oil handling; no invented simple-routine preference; calmer structure.

## Ready-Check Note

Because this touches recommendation copy and trust-facing answer behavior, use `ready-check` before shipping or creating a PR for production-facing work. For now this remains Compare Lab / AgentV2 migration work.
