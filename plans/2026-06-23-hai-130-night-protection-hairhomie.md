# HAI-130 Night Protection HairHOMIE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a HairHOMIE-recognizable night-protection option as a generic length/tip accessory, remove `tight_hairstyles` from selectable night protection, make multi-select clearer, and teach the engine/agent when to proactively recommend night protection.

**Architecture:** `night_protection` remains a nullable array where onboarding normally produces either `[]` or one or more canonical values. The new value is generic (`length_tip_accessory`) while the German UI copy names HairHOMIE as the recognizable example. Recommendation/routine logic treats lack of night protection as a behavior gap, and AgentV2 gets a callable non-product topic package (`topic.night_protection.v1`) for option-fit guidance.

**Tech Stack:** Next.js/React, TypeScript, Zod validators, Supabase SQL migrations, AgentV2 guidance markdown/JSON packages, Node test runner, and Playwright contract tests.

---

## Source Spec

Linear: HAI-130, "Hairhomie als Nachtschutzoption ergänzen"

User situation:
- In onboarding question `Wie schützt du dein Haar nachts?`, a beta user missed HairHOMIE.
- The field is mandatory in onboarding, so a completed user should normally have `night_protection = []` or a non-empty array.
- `null` exists only as legacy/incomplete state and must not be treated like explicit lack of protection.
- Current options are satin/silk pillowcase, bonnet, loose tied hair, pineapple, and legacy `tight_hairstyles`.

Approved decisions:
- Add a generic schema value, not a brand value: `length_tip_accessory`.
- German UI option should make HairHOMIE recognizable, e.g. `Längen-/Spitzenschutz (z. B. HairHOMIE)`.
- Remove `tight_hairstyles` from `night_protection` canonical values and existing stored arrays.
- Keep tight hairstyles as a future mechanical-stress concept, but do not solve that home in this slice.
- Important implementation consequence: current code derives a mechanical-stress signal from `night_protection.includes("tight_hairstyles")`. This slice should intentionally remove that derivation from night protection, not re-home it into a new field. Add a follow-up/domain-review note only if the team wants a dedicated mechanical-stress capture later.
- Keep combinations possible because `night_protection` is already multi-select.
- Make multi-select clearer with German helper copy.
- Night protection may be proactively recommended as a routine/behavior guardrail when `night_protection: []` and matching concerns/goals/context exist.
- HairHOMIE-specific claims require product/vendor context; generic guidance may only treat it as a length/tip accessory.

Promised end-state:
- Users can select `Längen-/Spitzenschutz (z. B. HairHOMIE)` alongside pillowcase/bonnet/pineapple/loose tie.
- Users cannot newly select `tight_hairstyles`, and existing saved `tight_hairstyles` values are cleaned.
- The routine/recommendation layer can surface night protection proactively for breakage, anti-breakage/strengthening goals, split ends, hair damage, tangling, frizz, long hair, curl definition, or full-routine contexts when the user selected no protection.
- AgentV2 can load precise night-protection guidance through `topic.night_protection.v1`.

## Scope Boundaries

In scope:
- Vocabulary/schema/value updates for `night_protection`.
- Supabase migration to drop legacy `tight_hairstyles` from stored arrays.
- Onboarding/profile display copy for the new option and multi-select clarity.
- Conservative recommendation/routine behavior for explicit lack of night protection.
- AgentV2 and legacy guidance files for night-protection advice.
- Tests and local smoke guidance.

Out of scope:
- Building a separate mechanical-stress profile field for tight hairstyles.
- Product catalog entries or affiliate/product cards for HairHOMIE.
- Broad HAI-122 multi-select redesign beyond the night-protection helper copy.
- Product-specific HairHOMIE claims such as material, exact dimensions, durability, or promised outcomes.
- Medical/scalp/hair-loss routing changes.

## Target File Map

Vocabulary, schema, and labels:
- Modify `src/lib/vocabulary/onboarding-care.ts` to add `length_tip_accessory`, remove `tight_hairstyles`, update labels, and keep legacy normalization.
- Verify `src/lib/validators/index.ts` continues to consume `NIGHT_PROTECTIONS`; no direct edit is expected unless typecheck exposes an import/type mismatch.
- Verify `src/lib/vocabulary/profile-labels.ts` keeps tight hairstyles only as a mechanical-stress factor, not as a night-protection label.
- Modify `src/lib/profile/signal-derivations.ts` to remove direct `night_protection` checks for `tight_hairstyles`; this is required after the value leaves the `NightProtection` union.
- Modify `src/lib/types.ts` if routine topic IDs or priority lever IDs need extension.

Persistence:
- Create `supabase/migrations/20260623143000_remove_tight_hairstyles_night_protection.sql` to remove `tight_hairstyles` from existing `hair_profiles.night_protection` arrays.

Onboarding/profile UI:
- Modify `src/components/onboarding/onboarding-flow.tsx` to add the new icon mapping, remove UI-only `tight_hairstyles` filtering, and update night-protection subtitle/helper copy.
- Profile display should work through `NIGHT_PROTECTION_LABELS`; no direct edit to `src/lib/profile/section-config.ts` is expected, but its tests must cover the new label.

Recommendation/routine logic:
- Verify `src/lib/recommendation-engine/assessments/damage.ts` keeps the approved `[]`/non-empty/`null` semantics; no direct edit is expected if existing code already matches.
- Verify `src/lib/recommendation-engine/planner/intervention.ts` keeps `insufficient_night_protection` as behavior reason for explicit `[]`; no direct edit is expected if existing code already matches.
- Modify `src/lib/routines/planner.ts` and `src/lib/types.ts` to add a non-product night-protection routine topic/slot for proactive routine output.

Guidance:
- Modify or create `data/agent-v2/guidance/topics/night-protection.md`.
- Modify or create `data/agent-v2/guidance/topics/night-protection.json`.
- Modify `src/lib/agent-v2/guidance/package-index.ts` to register `topic.night_protection.v1`.
- Modify `src/lib/agent-v2/tools/guidance-tool.ts` to add `topics: ["night_protection"]`.
- Modify `src/lib/agent-v2/tools/tool-definitions.ts` to tell AgentV2 when to load the topic.
- Modify or create legacy files under `data/agent-guidance/topics/night-protection/`.
- Modify `src/lib/agent/contracts.ts`, `src/lib/agent/guidance/catalog.ts`, and `src/lib/agent/tools/load-advisor-guidance.ts` to expose legacy `topic:night_protection`.

Tests:
- Modify `tests/onboarding-care-vocabulary.test.ts`.
- Modify `tests/profile-section-config.test.ts`.
- Modify `tests/recommendation-engine-foundation.test.ts`.
- Modify `tests/recommendation-engine-planner.test.ts`.
- Modify `tests/routine-planner.spec.ts`.
- Modify `tests/agent-v2-guidance-compiler.spec.ts`.
- Modify `tests/agent-guidance.spec.ts`.
- Modify `tests/agent-v2-responses-runtime.spec.ts` if the fake guidance tool needs a `topics` passthrough.

## Task 1: Vocabulary, Normalization, And Migration

**Files:**
- Modify: `src/lib/vocabulary/onboarding-care.ts`
- Modify: `src/lib/vocabulary/profile-labels.ts`
- Modify: `src/lib/profile/signal-derivations.ts`
- Create: `supabase/migrations/20260623143000_remove_tight_hairstyles_night_protection.sql`
- Test: `tests/onboarding-care-vocabulary.test.ts`
- Test: `tests/routine-planner.spec.ts` for any existing fixture that still passes `night_protection: ["tight_hairstyles"]`

- [x] **Step 1: Write vocabulary tests first**

Add assertions that the canonical list includes `length_tip_accessory`, excludes `tight_hairstyles`, and drops legacy `tight_hairstyles` during normalization.

```ts
test("night protection options include length tip accessory and remove tight hairstyles", () => {
  assert.deepEqual(NIGHT_PROTECTIONS, [
    "silk_satin_pillow",
    "silk_satin_bonnet",
    "loose_tied",
    "pineapple",
    "length_tip_accessory",
  ])
  assert.ok(!NIGHT_PROTECTIONS.includes("tight_hairstyles" as never))
})

test("night protection normalization drops legacy tight hairstyles", () => {
  assert.deepEqual(normalizeNightProtectionValues(["tight_hairstyles"]), [])
  assert.deepEqual(normalizeNightProtectionValues(["silk_satin_pillow", "tight_hairstyles"]), [
    "silk_satin_pillow",
  ])
})
```

- [x] **Step 2: Run the focused vocabulary test and verify it fails**

Run:

```bash
npx tsx --test tests/onboarding-care-vocabulary.test.ts
```

Expected: FAIL because `length_tip_accessory` is missing and `tight_hairstyles` is still canonical.

- [x] **Step 3: Update canonical night-protection values and labels**

In `src/lib/vocabulary/onboarding-care.ts`, change the section to:

```ts
export const NIGHT_PROTECTIONS = [
  "silk_satin_pillow",
  "silk_satin_bonnet",
  "loose_tied",
  "pineapple",
  "length_tip_accessory",
] as const
export type NightProtection = (typeof NIGHT_PROTECTIONS)[number]

export const NIGHT_PROTECTION_LABELS = {
  silk_satin_pillow: "Seidenkissenbezug",
  silk_satin_bonnet: "Seidenhaube / Bonnet",
  loose_tied: "Locker zusammengebunden",
  pineapple: "Pineapple (hoher lockerer Dutt)",
  length_tip_accessory: "Längen-/Spitzenschutz (z. B. HairHOMIE)",
} as const satisfies Record<NightProtection, string>
```

Keep the existing `normalizeNightProtectionValues()` shape. Because `tight_hairstyles` is no longer canonical, it will be filtered out automatically.

- [x] **Step 4: Verify tight hairstyles is no longer night-protection-facing**

In `src/lib/vocabulary/profile-labels.ts`, leave `MECHANICAL_STRESS_FACTORS` alone because tight hairstyles remains a future mechanical-stress concept. Confirm there is no separate night-protection-facing label map in this file. If typecheck exposes a dependency on the old `NightProtection` enum, decouple it with its own string union and leave a short comment:

```ts
// Tight hairstyles remain a mechanical-stress concept, but they are no longer a night-protection option.
```

- [x] **Step 5: Remove direct mechanical-stress derivation from night protection**

In `src/lib/profile/signal-derivations.ts`, remove `tight_hairstyles` checks from `nightProtection?.includes(...)` branches. Once `tight_hairstyles` leaves the `NightProtection` union, these checks will otherwise fail typecheck.

This is an intentional behavior change for this slice: legacy night-protection data should no longer be used as the source of the tight-hairstyle mechanical-stress signal. Do not create a new mechanical-stress profile field here.

Also update any existing routine-planner fixtures that still pass:

```ts
night_protection: ["tight_hairstyles"]
```

Replace them with the real driver that test meant to exercise, or remove the field if the test was only using it as historical night-protection data. The implementation must not keep `"tight_hairstyles"` assignable to `HairProfile["night_protection"]`.

- [x] **Step 6: Add migration to clean existing saved arrays**

Create `supabase/migrations/20260623143000_remove_tight_hairstyles_night_protection.sql`:

```sql
UPDATE hair_profiles
SET night_protection = (
  SELECT COALESCE(array_agg(value ORDER BY ord), ARRAY[]::text[])
  FROM unnest(night_protection) WITH ORDINALITY AS item(value, ord)
  WHERE value IS DISTINCT FROM 'tight_hairstyles'
)
WHERE night_protection && ARRAY['tight_hairstyles']::text[];
```

Do not convert empty arrays to `null`; `[]` means the user explicitly selected no night protection.

- Before finalizing the migration, confirm the deployed column is still `hair_profiles.night_protection text[]` via Supabase MCP or the current schema snapshot. The SQL below assumes `text[]` and preserves array order with `WITH ORDINALITY`.

- [x] **Step 7: Run vocabulary test**

Run:

```bash
npx tsx --test tests/onboarding-care-vocabulary.test.ts
```

Expected: PASS.

## Task 2: Onboarding And Profile UI Copy

**Files:**
- Modify: `src/components/onboarding/onboarding-flow.tsx`
- Test: `tests/mobile-ux.spec.ts` if it snapshots options
- Test: `tests/profile-section-config.test.ts`

- [x] **Step 1: Write profile display test**

In `tests/profile-section-config.test.ts`, add a profile case that verifies the profile card renders the new value label.

```ts
const nightProtectionField = PROFILE_FIELD_CONFIG.find(
  (field) => field.key === "night_protection",
)

assert.ok(nightProtectionField)
assert.equal(
  nightProtectionField.getValue(makeProfile({ night_protection: ["length_tip_accessory"] })),
  "Längen-/Spitzenschutz (z. B. HairHOMIE)",
)
```

- [x] **Step 2: Update onboarding night option icon map**

In `src/components/onboarding/onboarding-flow.tsx`, add:

```ts
const NIGHT_PROTECTION_ICONS: Record<string, IconName> = {
  silk_satin_pillow: "night-silk-pillow",
  silk_satin_bonnet: "night-silk-bonnet",
  loose_tied: "night-loose-braid",
  pineapple: "night-pineapple",
  length_tip_accessory: "night-loose-braid",
}
```

Do not add a new icon unless design explicitly asks; reuse the existing low-risk night accessory icon.

- [x] **Step 3: Remove UI-only filtering of tight hairstyles**

Replace:

```ts
const nightProtectionWithIcon = NIGHT_PROTECTION_OPTIONS.filter(
  (o) => o.value !== "tight_hairstyles",
).map((o) => ({
  ...o,
  icon: NIGHT_PROTECTION_ICONS[o.value] ?? fallbackIcon,
}))
```

with:

```ts
const nightProtectionWithIcon = NIGHT_PROTECTION_OPTIONS.map((o) => ({
  ...o,
  icon: NIGHT_PROTECTION_ICONS[o.value] ?? fallbackIcon,
}))
```

The canonical vocabulary now owns removal of `tight_hairstyles`; UI should not keep a shadow filter.

- [x] **Step 4: Clarify multi-select in German copy**

Change the night-protection screen subtitle from the current moisture claim to a direct multi-select instruction:

```tsx
<MultiSelectScreen
  title="Wie schützt du dein Haar nachts?"
  subtitle="Mehrfachauswahl möglich. Wähle alles aus, was du nachts nutzt."
  options={nightProtectionWithIcon}
  selected={store.nightProtection}
  onToggle={toggleNightProtection}
  ...
/>
```

Keep `noneLabel` as currently implemented.

- [x] **Step 5: Run profile/UI-adjacent tests**

Run:

```bash
npx tsx --test tests/profile-section-config.test.ts
```

If `tests/mobile-ux.spec.ts` covers the option list, run it too:

```bash
npx tsx --test tests/mobile-ux.spec.ts
```

Expected: PASS. If the mobile test is browser-dependent and not runnable locally, record that in the handoff.

## Task 3: Recommendation Engine Behavior For Explicit No Night Protection

**Files:**
- Verify: `src/lib/recommendation-engine/assessments/damage.ts`
- Verify: `src/lib/recommendation-engine/planner/intervention.ts`
- Test: `tests/recommendation-engine-foundation.test.ts`
- Test: `tests/recommendation-engine-planner.test.ts`

- [x] **Step 1: Verify or add tests for approved state semantics**

Add or update tests to lock:
- `night_protection: []` produces `missing_night_protection`.
- `night_protection: null` does not produce `missing_night_protection`.
- `night_protection: ["length_tip_accessory"]` produces `night_protection_present`.
- Planner emits `insufficient_night_protection` for explicit `[]`.

Example planner assertion:

```ts
test("planner emits night protection behavior gap for explicit no protection", () => {
  const normalized = normalizeRecommendationInput({
    ...baseInput,
    concerns: ["breakage", "tangling"],
    night_protection: [],
  })
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "behavior" &&
        step.action === "behavior_change_only" &&
        step.reasonCodes.includes("insufficient_night_protection"),
    ),
  )
})
```

- [x] **Step 2: Run focused recommendation tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-planner.test.ts
```

Expected before Task 1 is complete: may FAIL because `length_tip_accessory` is not canonical yet. Expected after Task 1: PASS unless a missing assertion needs to be added.

- [x] **Step 3: Keep engine semantics conservative**

Current code may already handle these states. Do not over-edit it. The desired behavior remains:

```ts
if (isExplicitNoneArray(profile.nightProtection)) {
  mechanicalScore += 1
  activeDamageDrivers.push("missing_night_protection")
} else if ((profile.nightProtection?.length ?? 0) > 0) {
  activeProtectiveFactors.push("night_protection_present")
} else {
  missingInputs.push("night_protection")
}
```

Do not add option-specific scoring in v1. `length_tip_accessory` counts as present protection just like pillowcase/bonnet/pineapple.

- [x] **Step 4: Keep planner behavior reason deterministic**

Keep or add:

```ts
if (isExplicitNoneArray(profile.nightProtection)) {
  behaviorReasons.push("insufficient_night_protection")
}
```

Do not make emotional stress, hair-loss, or scalp symptoms trigger night protection.

- [x] **Step 5: Run recommendation tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-planner.test.ts
```

Expected: PASS.

## Task 4: Routine Planner Proactive Night-Protection Guardrail

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/routines/planner.ts`
- Test: `tests/routine-planner.spec.ts`

- [x] **Step 1: Add failing routine planner tests**

Add tests that prove night protection becomes visible only when appropriate.

```ts
test("routine plan adds night protection guardrail for explicit no protection and breakage or tangling", () => {
  const plan = buildRoutinePlan(
    createProfile({
      hair_texture: "wavy",
      hair_length: "long",
      concerns: ["breakage", "tangling"],
      goals: ["less_frizz"],
      night_protection: [],
      current_routine_products: ["shampoo", "conditioner"],
    }),
    "Welche Routine passt zu mir?",
  )

  const slotIds = plan.sections.flatMap((section) => section.slots.map((slot) => slot.id))
  expect(slotIds).toContain("maintenance-night-protection")
})

test("routine plan does not add night protection guardrail when protection is already present", () => {
  const plan = buildRoutinePlan(
    createProfile({
      hair_texture: "wavy",
      hair_length: "long",
      concerns: ["breakage", "tangling"],
      night_protection: ["length_tip_accessory"],
      current_routine_products: ["shampoo", "conditioner"],
    }),
    "Welche Routine passt zu mir?",
  )

  const slotIds = plan.sections.flatMap((section) => section.slots.map((slot) => slot.id))
  expect(slotIds).not.toContain("maintenance-night-protection")
})

test("routine plan treats null night protection as legacy missing input, not explicit no protection", () => {
  const plan = buildRoutinePlan(
    createProfile({
      hair_texture: "wavy",
      hair_length: "long",
      concerns: ["breakage"],
      night_protection: null,
      current_routine_products: ["shampoo", "conditioner"],
    }),
    "Welche Routine passt zu mir?",
  )

  const slotIds = plan.sections.flatMap((section) => section.slots.map((slot) => slot.id))
  expect(slotIds).not.toContain("maintenance-night-protection")
})
```

- [x] **Step 2: Run routine planner test and verify it fails**

Run:

```bash
npx playwright test tests/routine-planner.spec.ts --project=chromium
```

Expected: FAIL because the slot/topic does not exist.

Do not assert that `maintenance-night-protection` appears in `plan.layer_projections.problems.visible_slot_ids`. That projection is capped to three visible slots and sorted against other valid problem-directed slots such as leave-in, mask, or oil; a visible-slot assertion would be brittle. Assert section membership and topic/slot semantics instead.

- [x] **Step 3: Add routine topic ID and label**

In `src/lib/types.ts`, add:

```ts
  | "night_protection"
```

to `RoutineTopicId`.

In `src/lib/routines/planner.ts`, add:

```ts
night_protection: "Nachtschutz",
```

to `ROUTINE_TOPIC_LABELS`.

- [x] **Step 4: Add explicit night-protection terms**

In `src/lib/routines/planner.ts`, add a term list near other topic terms:

```ts
const NIGHT_PROTECTION_TERMS = [
  "nachtschutz",
  "schlafen",
  "schlaffrisur",
  "seidenkissen",
  "satinkissen",
  "seidenhaube",
  "bonnet",
  "pineapple",
  "hairhomie",
  "hair homie",
  "laengenschutz",
  "längenschutz",
  "spitzenschutz",
]
```

Update `getExplicitTopicIds()`:

```ts
if (includesAny(normalizedMessage, NIGHT_PROTECTION_TERMS)) topics.push("night_protection")
```

- [x] **Step 5: Add deterministic fit helpers**

Add helpers near other routine need helpers:

```ts
function hasExplicitNoNightProtection(profile: HairProfile | null): boolean {
  return Array.isArray(profile?.night_protection) && profile.night_protection.length === 0
}

function hasNightProtectionConcernOrGoalFit(context: RoutineContext): boolean {
  return (
    context.concerns.includes("breakage") ||
    context.concerns.includes("split_ends") ||
    context.concerns.includes("hair_damage") ||
    context.concerns.includes("tangling") ||
    context.concerns.includes("frizz") ||
    context.goals.includes("less_frizz") ||
    context.goals.includes("curl_definition") ||
    context.goals.includes("healthier_hair") ||
    context.goals.includes("anti_breakage") ||
    context.goals.includes("strengthen") ||
    context.goals.includes("less_split_ends")
  )
}

function hasLongHairNightProtectionFit(profile: HairProfile | null): boolean {
  return profile?.hair_length === "long" || profile?.hair_length === "very_long"
}

function shouldAddNightProtectionSlot(
  profile: HairProfile | null,
  context: RoutineContext,
): boolean {
  if (!hasExplicitNoNightProtection(profile)) return false
  return (
    context.explicit_topic_ids.includes("night_protection") ||
    hasNightProtectionConcernOrGoalFit(context) ||
    hasLongHairNightProtectionFit(profile)
  )
}
```

- [x] **Step 6: Add a non-product instruction slot**

Add:

```ts
function buildNightProtectionSlot(profile: HairProfile | null, context: RoutineContext): RoutineSlotAdvice {
  const longHair = hasLongHairNightProtectionFit(profile)
  const curlOrWave =
    context.hair_texture === "wavy" || context.hair_texture === "curly" || context.hair_texture === "coily"

  return {
    id: "maintenance-night-protection",
    kind: "instruction",
    phase: "maintenance",
    label: "Nachtschutz",
    action: "add",
    category: null,
    cadence: "nachts",
    rationale: [
      "Du hast aktuell keinen Nachtschutz ausgewählt; das ist ein kleiner, aber sinnvoller Reibungshebel.",
      longHair
        ? "Bei langen Haaren ist ein Längen-/Spitzenschutz (z. B. HairHOMIE) oder lockeres Fixieren oft praktischer als nur offen schlafen."
        : curlOrWave
          ? "Bei Wellen oder Locken kann ein Bonnet, Pineapple oder Satin-/Seidenkissenbezug helfen, die Form über Nacht ruhiger zu halten."
          : "Ein Satin-/Seidenkissenbezug ist die niedrigste Einstiegshürde, wenn du keine Haube oder Fixierung magst.",
    ],
    caveats: [
      "Das ist kein Repair-Schritt und kein Muss; es reduziert vor allem Reibung, Verknoten und Morgen-Frizz.",
      "Alles sollte locker sitzen und nicht am Haaransatz ziehen.",
    ],
    topic_ids: ["night_protection"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 45,
  }
}
```

Keep all UI-facing copy German.

Use a moderate priority because this is a low-friction behavior guardrail, not an emergency repair step. Do not make it the `priority_lever`; the user should see it in the routine, but it should not automatically outrank stronger product or care-structure interventions in capped projections.

- [x] **Step 7: Push the slot into maintenance when appropriate**

Inside `buildRoutineSlots()`, after `pushRoutineSlot` is defined and before product-heavy optional slots, add:

```ts
if (shouldAddNightProtectionSlot(profile, context)) {
  pushRoutineSlot(buildNightProtectionSlot(profile, context))
}
```

- [x] **Step 8: Make projections recognize the slot**

Update `isGoalDirectedSlot()`:

```ts
if (
  slot.topic_ids.includes("night_protection") &&
  ["less_frizz", "curl_definition", "healthier_hair", "anti_breakage", "strengthen", "less_split_ends"].some(
    (goal) => goalCodes.has(goal),
  )
) {
  return true
}
```

Update `isProblemDirectedSlot()`:

```ts
if (
  slot.topic_ids.includes("night_protection") &&
  ["breakage", "split_ends", "hair_damage", "tangling", "frizz"].some((concern) =>
    concernCodes.has(concern),
  )
) {
  return true
}
```

- [x] **Step 9: Run routine planner tests**

Run:

```bash
npx playwright test tests/routine-planner.spec.ts --project=chromium
```

Expected: PASS.

## Task 5: AgentV2 Callable Guidance Topic

**Files:**
- Create/modify: `data/agent-v2/guidance/topics/night-protection.md`
- Create/modify: `data/agent-v2/guidance/topics/night-protection.json`
- Modify: `src/lib/agent-v2/guidance/package-index.ts`
- Modify: `src/lib/agent-v2/tools/guidance-tool.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [x] **Step 1: Verify or patch guidance compiler tests**

This worktree may already contain draft AgentV2 topic registration, guidance files, and tests. Treat this task as "verify and refine the existing draft" rather than greenfield red-green TDD. If a test or registration already exists, patch it to match the final plan instead of duplicating it.

In `tests/agent-v2-guidance-compiler.spec.ts`, add tests for:
- `topic.night_protection.v1` is in the package index.
- Loading the package includes HairHOMIE as a length/tip accessory.
- Guidance text includes proactive triggers for `night_protection: []` plus matching concerns/goals.
- `selectGuidancePackageIds()` includes the topic when `topics: ["night_protection"]`.

Use assertions like:

```ts
assert.match(brief, /night_protection.*\[\]/i)
assert.match(brief, /breakage|split ends|hair damage|tangling|frizz/i)
assert.match(brief, /length\/tip accessory/i)
assert.match(brief, /HairHOMIE/i)
```

- [x] **Step 2: Run guidance compiler test**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected: PASS if the existing draft already satisfies the final trigger copy; otherwise FAIL only on the missing or mismatched pieces that need refinement.

- [x] **Step 3: Register topic package**

In `src/lib/agent-v2/guidance/package-index.ts`, add:

```ts
"topic.night_protection.v1",
```

to `AGENT_V2_GUIDANCE_PACKAGE_IDS`.

Add a `topicEntry()` helper:

```ts
function topicEntry(slug: string): AgentV2GuidancePackageEntry {
  const id = topicIdFromSlug(slug)
  return {
    id,
    metadataPath: `data/agent-v2/guidance/topics/${slug}.json`,
    markdownPath: `data/agent-v2/guidance/topics/${slug}.md`,
  }
}

function topicIdFromSlug(slug: string): AgentV2GuidancePackageId {
  return `topic.${slug.replaceAll("-", "_")}.v1` as AgentV2GuidancePackageId
}
```

Add package entry:

```ts
"topic.night_protection.v1": topicEntry("night-protection"),
```

- [x] **Step 4: Add topics input to guidance tool**

In `src/lib/agent-v2/tools/guidance-tool.ts`, add:

```ts
export const AgentV2GuidanceTopicSchema = z.enum(["night_protection"])
export type AgentV2GuidanceTopic = z.infer<typeof AgentV2GuidanceTopicSchema>
```

Add field:

```ts
topics: z
  .array(AgentV2GuidanceTopicSchema)
  .default([])
  .describe(
    "Non-product advisory topics to load. Use night_protection for sleep-friction, satin/silk pillowcase, bonnet, pineapple, loose night hairstyle, HairHOMIE, or length/tip accessory questions.",
  ),
```

Update `selectGuidancePackageIds()` to accept optional topics in tests and push:

```ts
for (const topic of input.topics ?? []) {
  ids.push(`topic.${topic}.v1` as AgentV2GuidancePackageId)
}
```

- [x] **Step 5: Update AgentV2 tool description**

In `src/lib/agent-v2/tools/tool-definitions.ts`, extend `load_advisor_guidance` description with:

```txt
For sleep-friction, satin/silk pillowcase, bonnet, pineapple, loose night hairstyle, HairHOMIE, or length/tip accessory questions, load topic night_protection.
```

- [x] **Step 6: Patch runtime fake helper**

In `tests/agent-v2-responses-runtime.spec.ts`, when fake tools call `selectGuidancePackageIds`, pass topics through:

```ts
topics: Array.isArray(input.topics)
  ? (input.topics as Parameters<typeof selectGuidancePackageIds>[0]["topics"])
  : [],
```

- [x] **Step 7: Write final AgentV2 topic markdown**

Ensure `data/agent-v2/guidance/topics/night-protection.md` contains these sections:
- Role in Hair Concierge.
- Use when.
- Proactive routine trigger matrix.
- Realistic benefit.
- Option fit logic.
- Recommendation logic.
- Agent interpretation hooks.
- Required grounding.
- Safety boundary.

The proactive section must include:

```md
## Proactive Routine Triggers
Treat `night_protection: []` as the meaningful "no night protection" signal. In completed onboarding, `night_protection: null` is legacy/missing state, not a normal user choice.

Mention night protection proactively when `night_protection: []` combines with at least one of:
- breakage, split ends, hair damage, tangling, frizz, rough ends, or morning tangles
- goals such as less_frizz, curl_definition, healthier_hair, anti_breakage, strengthen, or less_split_ends
- long or very long hair where lengths or ends tangle overnight
- a full routine request where behavior guardrails are appropriate

Do not derail unrelated product-detail answers with night protection unless the user's problem framing is about mechanical friction, sleep, morning frizz, curl collapse, tangling, or breakage.
```

The option logic must include:

```md
Length/tip accessory, including HairHOMIE-like options:
- Best for long or very long hair when lengths or ends tangle overnight.
- Treat HairHOMIE as a recognizable example of the accessory type, not as the schema value.
- Do not claim product-specific material, fit, dimensions, availability, price, durability, or outcomes unless grounded in product/vendor context.
```

- [x] **Step 8: Write final AgentV2 topic JSON metadata**

Ensure `data/agent-v2/guidance/topics/night-protection.json` uses:

```json
{
  "package_id": "topic.night_protection.v1",
  "version": 1,
  "scope": {
    "answer_modes": ["general_advice", "routine", "constraint_blocked", "safety_boundary"],
    "categories": [],
    "routine_layers": ["goals", "problems", "deep_dive"],
    "safety_modes": ["normal", "restricted"]
  }
}
```

Hard rules must include:
- low-friction behavior, not repair/growth/medical care
- no tight styles as night protection
- no universal best option
- named product claims need product/vendor context
- do not stack more options by default if one is already selected

Soft rubrics must include:
- option fit matrix
- proactive routine trigger matrix
- combination without overprescribing
- HairHOMIE as length/tip accessory example

Grounding entries should use existing callable tool names only:
- `select_products` for concrete catalog-backed product recommendations/comparisons
- `build_or_fix_routine` for saved/current routine changes

- [x] **Step 9: Run AgentV2 guidance tests**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

## Task 6: Legacy Advisor Guidance Topic

**Files:**
- Create/modify: `data/agent-guidance/topics/night-protection/core-fit.md`
- Create/modify: `data/agent-guidance/topics/night-protection/response-playbook.md`
- Create/modify: `data/agent-guidance/topics/night-protection/guardrails.md`
- Modify: `src/lib/agent/contracts.ts`
- Modify: `src/lib/agent/guidance/catalog.ts`
- Modify: `src/lib/agent/tools/load-advisor-guidance.ts`
- Test: `tests/agent-guidance.spec.ts`

- [x] **Step 1: Verify or patch legacy guidance test**

This worktree may already contain draft legacy topic registration, files, and tests. Treat this task as "verify and refine the existing draft" rather than greenfield red-green TDD.

In `tests/agent-guidance.spec.ts`, add:

```ts
test("loadAdvisorGuidance loads night protection topic guidance", async () => {
  const guidance = await loadAdvisorGuidance({
    intent: "problem_context",
    category: "night_protection",
    categories: [],
    profileFocus: ["mechanical_stress", "tangling_detangling"],
    message: "Meine Haare verknoten nachts stark. Was hilft beim Schlafen?",
    userContext: createUserContext({
      profile: createHairProfile({
        hair_length: "long",
        concerns: ["tangling"],
        night_protection: [],
      }),
    }),
    conversationState: null,
  })

  assert.ok(guidance.loaded_guidance_ids.includes("topic:night_protection"))
  assert.match(guidance.category_implications.join("\n"), /HairHOMIE|Längen|Spitzen/i)
})
```

- [x] **Step 2: Run legacy guidance test**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: PASS if the existing draft already registers `topic:night_protection`; otherwise FAIL only on the missing or mismatched pieces that need refinement.

- [x] **Step 3: Register legacy guidance ID**

In `src/lib/agent/contracts.ts`, add:

```ts
"topic:night_protection",
```

In `src/lib/agent/guidance/catalog.ts`, add:

```ts
"topic:night_protection": {
  kind: "topic",
  title: "Night Protection",
  paths: [
    "data/agent-guidance/topics/night-protection/core-fit.md",
    "data/agent-guidance/topics/night-protection/response-playbook.md",
    "data/agent-guidance/topics/night-protection/guardrails.md",
  ],
},
```

In `src/lib/agent/tools/load-advisor-guidance.ts`, add `night_protection` to `ADVISOR_GUIDANCE_CATEGORIES` and map:

```ts
night_protection: "topic:night_protection",
```

- [x] **Step 4: Write legacy topic files**

Create concise legacy guidance mirroring AgentV2:
- `core-fit.md`: role, best fit, weak fit, realistic ceiling.
- `response-playbook.md`: default answer shape, option selection, one-follow-up policy, German safe phrases.
- `guardrails.md`: no repair/growth/medical claims, no tight styles, no universal best option, product claims need context.

- [x] **Step 5: Run legacy guidance test**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: PASS.

## Task 7: Full Verification And Review Gates

**Files:**
- All modified files.

- [x] **Step 1: Run focused tests**

Run:

```bash
npx tsx --test tests/onboarding-care-vocabulary.test.ts
npx tsx --test tests/profile-section-config.test.ts
npx tsx --test tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-planner.test.ts
npx playwright test tests/routine-planner.spec.ts --project=chromium
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: PASS.

- [x] **Step 2: Run full repo verification**

Run:

```bash
npm run ci:verify
```

Expected: PASS. If `ci:verify` is too slow or environment-blocked, run `npm run typecheck` at minimum and record exactly which broader checks were skipped.

- [x] **Step 3: Run onboarding/profile smoke if practical**

If local browser smoke is available:
- Open onboarding night-protection step.
- Confirm visible options include `Längen-/Spitzenschutz (z. B. HairHOMIE)`.
- Confirm `Enge Frisuren` is not visible.
- Confirm multiple selections can be toggled at once.
- Confirm `Nichts davon` persists `[]`.
- Confirm profile Nachtschutz display shows the new label.

If browser smoke is not practical, state that in the handoff and rely on focused tests.

- [x] **Step 4: Run ready-check before shipping**

Because this touches onboarding, recommendation logic, copy, and trust-sensitive guidance, run the repo `ready-check` skill before any `ship-it` flow.

- [x] **Step 5: Run autoreview before shipping**

After implementation and checks pass, run `autoreview`. Fix accepted findings, rerun relevant tests, then rerun review if the diff materially changes.

## Manual Acceptance Criteria

- Onboarding question remains German and clearly multi-select.
- `Längen-/Spitzenschutz (z. B. HairHOMIE)` appears as an option.
- Users can combine it with Seidenkissenbezug, Bonnet, locker zusammengebunden, or Pineapple.
- `tight_hairstyles` is not in canonical night-protection schema/options and is removed from persisted `night_protection` arrays.
- Existing legacy `loose_braid` and `loose_bun` values still normalize to `loose_tied`.
- `night_protection: []` is the explicit no-protection signal.
- `night_protection: null` is legacy/missing and does not by itself trigger a recommendation.
- Routine/recommendation logic can proactively mention night protection when explicit no-protection combines with breakage, anti-breakage/strengthening goals, split ends, hair damage, tangling, frizz, long/very-long hair, curl definition, or full-routine requests.
- Agent guidance frames night protection as low-friction behavior/style preservation, not repair, growth, hair-loss prevention, or medical care.
- HairHOMIE is treated as a recognizable example of a length/tip accessory, not as the schema value and not as an ungrounded product claim.

## Known Draft Reconciliation Notes

The current `codex/hai-130-night-protection-guidance` worktree may already contain draft guidance files from an earlier premature implementation. Do not treat those files as approved as-is. Patch them to match this plan, especially:
- add the proactive trigger matrix for `night_protection: []`
- state that `null` is legacy/missing because onboarding is mandatory
- keep grounding entries on existing callable tool names
- ensure HairHOMIE is only an example of `length_tip_accessory`
- reframe guidance tasks as verification/refinement of the existing draft rather than duplicate greenfield implementation

Claude plan review was run on 2026-06-23; the temporary review artifact was removed before final handoff. Accepted findings patched into this plan:
- add `src/lib/profile/signal-derivations.ts` and existing routine-planner fixtures to the `tight_hairstyles` removal path
- make the current mechanical-stress-signal loss explicit and intentional for this slice
- avoid brittle assertions against capped `layer_projections.problems.visible_slot_ids`
- use `npm run ci:verify` as the final full verification command
- treat existing guidance files/tests in this worktree as drafts to refine, not as missing greenfield work

## Execution Handoff

Plan complete and saved to `plans/2026-06-23-hai-130-night-protection-hairhomie.md`.

Recommended next skill: `superpowers:subagent-driven-development`, because the tasks are separable into vocabulary/migration, UI copy, routine logic, and guidance lanes with review checkpoints.

## Implementation Status

Implemented on 2026-06-23 in worktree `codex/hai-130-night-protection-guidance`.

Post-review patches completed:
- Legacy guidance discovery now exposes `topic:night_protection` in the route prompt and consultation brief keyword map.
- Routine planning now supports an `adjust` Nachtschutz slot for already-protected users on explicit asks or narrow strong-fit cases, without mutating profile data or defaulting to stacked options.
- Stored deep-dive projections only force `night_protection` when the actual `maintenance-night-protection` slot exists, preserving `null` as legacy/missing.
- Migration predicate now uses `IS DISTINCT FROM 'tight_hairstyles'` to remove only the legacy value.
- Inert AgentV2 `validator_id` metadata was removed.
- Temporary local Claude code-review artifact was removed and is not part of the handoff.

Verification completed:
- `npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-guidance.spec.ts tests/agent-v2-responses-runtime.spec.ts` PASS, 266 subtests.
- `npx playwright test tests/routine-planner.spec.ts --project=chromium` PASS, 86 tests.
- `npx tsx --test tests/onboarding-care-vocabulary.test.ts tests/profile-section-config.test.ts tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-planner.test.ts` PASS, 33 subtests.
- `npm run ci:verify` PASS: typecheck, lint, and production build completed.
- `git diff --check` PASS.

Notes:
- `npm run ci:verify` reported three lint warnings outside this HAI-130 change: unused `Menu` in `src/components/layout/header.tsx`, `<img>` warning in `src/components/ui/avatar.tsx`, and unused `AGENTIC_TOOL_LOOP_PROMPT` in `src/lib/agent/orchestrator/model-client.ts`.
- `tests/mobile-ux.spec.ts` was inspected and does not assert the night-protection option list/copy, so it was not run as an additional targeted check.
- `npm run clawpatch:review` was attempted but blocked because this worktree is not initialized for Clawpatch (`error: not initialized; run clawpatch init`).
- Ready-check browser smoke was partially blocked: `npm run dev:worktree` served `http://localhost:3111`, unauthenticated `/onboarding` redirected to `/auth?next=%2Fonboarding`, dev login redirected the seeded local user to `/quiz`, and the Node REPL Playwright path could not launch Chromium because the local browser executable is not installed. No manual browser claim is made.
- Claude code review and Superpowers code review were both run. Accepted findings were patched, then a final full-scope review approved the work with no Critical, Important, or Minor findings. The remaining practical risk is migration deployment/order because the SQL was reviewed locally but not applied in this session.
