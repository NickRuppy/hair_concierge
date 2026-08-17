# Per-Role Tier Placement for Stage-1 Cards + Routine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each Stage-1 role card (and each routine item) is placed and labeled by its **own** role tier instead of the category's aggregate tier; multiple roles of a category in the same tier group into one shared-shell card (Variante B).

**Architecture:** The engine already computes per-role tiers (`decision.target.roleTargets[].tier`, oil only today) and ships them in the snapshot — only presentation ignores them. We thread role tiers into the plan-start view model, re-partition role entries across the Basis/Optional screens during preview application, render same-tier groups in one shell, and use the role's tier in the routine compiler. No engine, trigger, acceptance-contract, or schema changes.

**Tech Stack:** Next.js/React client components, node:test + assert (existing harnesses), Tailwind utility classes copied from existing card.

**Spec:** `plans/2026-08-17-role-tier-cards/mockups.html` (Variante B approved by Nick 2026-08-17; journey signed off in session).

## Global Constraints

- All UI text German. New cadence strings (exact): `vor jeder passenden Haarwäsche`, `nach jeder passenden Haarwäsche`, `als Finish nach jeder Haarwäsche`, `nach Bedarf` (unchanged fallback).
- Do NOT change: oil trigger logic (`src/lib/personal-plan/categories/oil.ts`), `arbitrateDampSmoothing`, direct-acceptance code (`src/lib/personal-plan/direct-acceptance/*`), snapshot schema (`schemaVersion: 1` stays).
- `seenRoles` derivation (`derivePlanForkPreviewState`) must remain untouched — it reads the raw previews response, not card placement.
- Existing `data-plan-start-card` attributes must keep firing once per role entry (e2e selectors depend on them).
- Categories without per-role tiers (all except oil) must keep their current screen placement; their only visible change is same-tier grouping (approved: shampoo Gegenprobe in mockups).
- No new dependencies. Run tests with `npx tsx --test tests/<file>` (repo pattern); full gate is `npm run ci:verify`.

---

### Task 1: Role tones + role cadence copy + cross-screen partitioning (adapter logic)

**Files:**
- Modify: `src/lib/personal-plan/decision-presentation.ts` (add `roleFrequencyLabel`)
- Modify: `src/components/personal-plan-start/snapshot-adapter.ts`
- Modify: `src/components/personal-plan-start/need-card.tsx` (view-model types only in this task)
- Test: `tests/personal-plan-start-ui.test.tsx` (extend existing harness; reuse its snapshot/preview builders)

**Interfaces:**
- Produces for Task 2:
  - `type NeedCardGroupViewModel = { kind: "group"; id: string; category: Stage1Category; tone: NeedCardTone; categoryLabel: string; statusLabel: "Basis" | "Optional" | "Pausiert"; members: NeedCardViewModel[] }` (exported from `need-card.tsx`)
  - `type PlanStartCardViewModel = NeedCardViewModel | NeedCardGroupViewModel` and guard `isNeedCardGroup(card): card is NeedCardGroupViewModel` (exported from `need-card.tsx`)
  - `NeedPlanScreenViewModel.cards` becomes `PlanStartCardViewModel[]`
  - `NeedCardViewModel` gains optional `roleTones?: Record<string, NeedCardTone>` (category card carries it until expansion; harmless to renderer)
- Produces for Task 3: nothing (independent).

- [ ] **Step 1: Read the exact role-frequency types.** Open `src/lib/personal-plan/types.ts` and copy the exact union member names for the oil role cadences (`before_every_compatible_wash`, `after_every_compatible_wash`, `finish_after_every_compatible_wash`, `optional_allocation_deferred_to_day_type` — verify spelling) and the `role_based_wash_linked` frequency shape. Do not guess.

- [ ] **Step 2: Write failing tests for `roleFrequencyLabel`** in `tests/personal-plan-start-ui.test.tsx` (or the file where `frequencyLabel` is already tested if one exists — search first):

```ts
test("roleFrequencyLabel renders role cadence for role_based_wash_linked", () => {
  const frequency = {
    kind: "role_based_wash_linked" as const,
    roleFrequencies: [
      { role: "pre_wash_fibre_treatment", tier: "basis", cadence: "before_every_compatible_wash" },
      { role: "leave_on_fibre_conditioning", tier: "basis", cadence: "after_every_compatible_wash" },
      { role: "dry_finish", tier: "basis", cadence: "finish_after_every_compatible_wash" },
      { role: "dry_finish_optional_example", tier: "optional", cadence: "optional_allocation_deferred_to_day_type" },
    ],
  }
  assert.equal(roleFrequencyLabel(frequency, "pre_wash_fibre_treatment", false), "vor jeder passenden Haarwäsche")
  assert.equal(roleFrequencyLabel(frequency, "leave_on_fibre_conditioning", false), "nach jeder passenden Haarwäsche")
  assert.equal(roleFrequencyLabel(frequency, "dry_finish", false), "als Finish nach jeder Haarwäsche")
  assert.equal(roleFrequencyLabel(frequency, "dry_finish_optional_example", false), "nach Bedarf")
  assert.equal(roleFrequencyLabel(frequency, "unknown_role", false), "nach Bedarf") // falls back to category label
  assert.equal(roleFrequencyLabel(null, "dry_finish", true), "später: nach Klärung")
})
```

Adapt the fixture to the real type shapes from Step 1 (the `roleFrequencies` entries may not carry `tier` for optional — copy the real shape from `cadence()` in `src/lib/personal-plan/categories/oil.ts:268`).

- [ ] **Step 3: Run to verify failure.** `npx tsx --test tests/personal-plan-start-ui.test.tsx` → FAIL (`roleFrequencyLabel` not exported).

- [ ] **Step 4: Implement `roleFrequencyLabel`** in `decision-presentation.ts` next to `frequencyLabel`:

```ts
const ROLE_CADENCE_LABELS: Record<string, string> = {
  before_every_compatible_wash: "vor jeder passenden Haarwäsche",
  after_every_compatible_wash: "nach jeder passenden Haarwäsche",
  finish_after_every_compatible_wash: "als Finish nach jeder Haarwäsche",
  optional_allocation_deferred_to_day_type: "nach Bedarf",
}

/** Role-scoped cadence copy; falls back to the category-level label. */
export function roleFrequencyLabel(
  frequency: PlanFrequencyTarget | null,
  role: string,
  paused: boolean,
): string {
  if (frequency?.kind === "role_based_wash_linked") {
    const entry = frequency.roleFrequencies.find((candidate) => candidate.role === role)
    const label = entry ? ROLE_CADENCE_LABELS[entry.cadence] : undefined
    if (label) return `${paused ? "später: " : ""}${label}`
  }
  return frequencyLabel(frequency, paused)
}
```

- [ ] **Step 5: Run tests → PASS.** Commit: `feat(plan-start): role-scoped cadence labels`

- [ ] **Step 6: Write failing tests for role tones + partitioning.** Extend the existing harness (it already has an oil plan builder and `previewResponse(...)`). Required cases — build a snapshot whose oil decision has `roleTargets` tiers `pre_wash_fibre_treatment: "basis"`, `leave_on_fibre_conditioning: "optional"`, `dry_finish: "optional"` and category `needTier: "basis"`, plus at least one other basis category and one optional category; previews carry a recommendation per oil role:

```ts
test("oil role entries split across screens by their own tier", () => {
  const applied = applyStage1ProductExamplePreviews(planWithMixedOilTiers, previewsForAllThreeOilRoles)
  const basisOil = applied.basis.cards.filter((card) => card.category === "oil")
  assert.equal(basisOil.length, 1)
  assert.ok(!isNeedCardGroup(basisOil[0])) // single entry → standalone card, no group
  assert.equal((basisOil[0] as NeedCardViewModel).frequency, "vor jeder passenden Haarwäsche")
  const optionalOil = applied.optional!.cards.filter((card) => card.category === "oil")
  assert.equal(optionalOil.length, 1)
  assert.ok(isNeedCardGroup(optionalOil[0]))
  assert.equal((optionalOil[0] as NeedCardGroupViewModel).members.length, 2)
  assert.equal((optionalOil[0] as NeedCardGroupViewModel).statusLabel, "Optional")
})

test("optional screen is created when it did not exist but optional-tier roles do", () => {
  // plan built from a snapshot with NO optional categories, oil aggregate basis with one optional role
  const applied = applyStage1ProductExamplePreviews(planWithoutOptionalPage, previews)
  assert.ok(applied.optional)
  assert.equal(applied.basis.progress, 50)
  assert.equal(applied.optional!.countLabel, "1 Vorschlag")
})

test("same-tier multi-role category groups into one card", () => {
  // shampoo with roles shampoo_everyday + shampoo_dandruff, both category tier basis
  const applied = applyStage1ProductExamplePreviews(dandruffPlan, dandruffPreviews)
  const shampooCards = applied.basis.cards.filter((card) => card.category === "shampoo")
  assert.equal(shampooCards.length, 1)
  assert.ok(isNeedCardGroup(shampooCards[0]))
  assert.equal((shampooCards[0] as NeedCardGroupViewModel).members.length, 2)
})

test("optional count label counts group members individually", () => {
  // 2 optional oil roles grouped + 1 optional dry_shampoo → "3 Vorschläge"
  assert.equal(applied.optional!.countLabel, "3 Vorschläge")
})

test("fallback previews keep the category card on the aggregate-tier screen", () => {
  // oil previews all kind: "fallback" → single category card on basis, no group, fallbackNote set
})

test("single-role categories are byte-identical to before", () => {
  // conditioner with one role: card unchanged vs. current expectations (existing tests must keep passing)
})
```

- [ ] **Step 7: Run to verify failures.** `npx tsx --test tests/personal-plan-start-ui.test.tsx`

- [ ] **Step 8: Implement in `snapshot-adapter.ts`.** Outline (follow existing code style; keep every existing helper):

1. In `cardFromDecision`, attach role tones: `roleTones: Object.fromEntries((decision.target && "roleTargets" in decision.target ? decision.target.roleTargets ?? [] : []).flatMap((t) => ("tier" in t && t.tier ? [[t.role, t.tier === "basis" ? "basis" : "optional"]] : [])))` — categories without per-role tiers get `{}`.
2. Add types + guard in `need-card.tsx`:

```ts
export type NeedCardGroupViewModel = {
  kind: "group"
  id: string
  category: Stage1Category
  tone: NeedCardTone
  categoryLabel: string
  statusLabel: "Basis" | "Optional" | "Pausiert"
  members: NeedCardViewModel[]
}
export type PlanStartCardViewModel = NeedCardViewModel | NeedCardGroupViewModel
export function isNeedCardGroup(card: PlanStartCardViewModel): card is NeedCardGroupViewModel {
  return "members" in card && (card as NeedCardGroupViewModel).kind === "group"
}
```

3. Rewrite `applyStage1ProductExamplePreviews`:
   - Build role entries exactly as today (`withRecommendation` for the lead, `secondaryRoleCard` for others), but: give EVERY entry of a multi-role category role-level copy (`targetType: routinePurposeLabel(role)`, `purpose: routineRolePurposeDescription(role) ?? card.purpose`, single role pill) — the lead no longer wears category copy when siblings exist in ANY tier; single-role categories keep today's category copy path.
   - Set each entry's `frequency` (and its frequency detail block body) via `roleFrequencyLabel(decisionFrequencyFor(category), role, card.paused)`. The decision frequency is not on the view model today: extend `cardFromDecision` to also stash `frequencyTarget` (the raw `decision.frequency`) on the category card (optional field, like `roleTones`).
   - Tag each entry with `tone = card.roleTones?.[role] ?? card.tone` and matching `statusLabel` (`"Basis"`/`"Optional"`, `"Pausiert"` wins if `card.paused`).
   - Partition entries into `basisEntries`/`optionalEntries` across BOTH input screens. Fallback-lead categories contribute their (un-expanded) category card to their original screen unchanged.
   - Per screen and category, in the original `renderedOrder`-derived order: 1 entry → push it as-is; 2+ → push a `NeedCardGroupViewModel` (`id: \`${category}:group:${tone}\``, tone-appropriate `statusLabel`, members in role order).
   - Rebuild screens: keep header/lead/sectionTitle fields; recompute optional `countLabel` counting `isNeedCardGroup(c) ? c.members.length : 1`; if `plan.optional` is null and `optionalEntries.length > 0`, create it with the exact literals used in `screenFor("optional", …)` and set `basis.progress = 50`. Paused-merge (`pausedOnlyOptional`) cards stay where `adaptInitialNeedSnapshotToPlanStartViewModel` put them.
4. Update `planStartProductDisclaimer` in `need-plan-screen.tsx` to flatten groups: `cards.flatMap((c) => isNeedCardGroup(c) ? c.members : [c])` (type change only here; rendering is Task 2 — cast where needed to keep this task compiling, and note it).

- [ ] **Step 9: Run the new tests AND the whole existing file → all PASS.** `npx tsx --test tests/personal-plan-start-ui.test.tsx`. Some existing assertions about lead-card copy for multi-role categories will legitimately change (role copy instead of category copy, groups instead of sibling cards) — update those assertions to the new contract; do not weaken unrelated ones.

- [ ] **Step 10: Commit.** `feat(plan-start): place role cards by their own tier and group same-tier roles`

### Task 2: Variante-B rendering (grouped shell, screen, flow wiring)

**Files:**
- Modify: `src/components/personal-plan-start/need-card.tsx`
- Modify: `src/components/personal-plan-start/need-plan-screen.tsx`
- Modify: `src/components/personal-plan-start/plan-start-flow.tsx` (image prefetch flattening only)
- Test: `tests/personal-plan-start-ui.test.tsx` (rendering assertions, existing react harness)

**Interfaces:**
- Consumes from Task 1: `PlanStartCardViewModel`, `NeedCardGroupViewModel`, `isNeedCardGroup`.
- Produces: `NeedCardGroup` component (internal to plan-start; no external consumers).

- [ ] **Step 1: Write failing rendering tests** (same harness/style as existing UI tests in the file):

```ts
test("group renders one shell with a single kicker and full member anatomy", () => {
  // render <NeedPlanScreen> with a screen containing one NeedCardGroupViewModel of 2 members
  // assert: exactly one element with data-plan-start-card-group="oil:group:optional"
  // assert: kicker text "Haaröl" appears once within the group, status pill "Optional" once
  // assert: two elements with data-plan-start-card (one per member, ids "oil:leave_on_fibre_conditioning", "oil:dry_finish")
  // assert: both member names and price sublines render; a divider element sits between members
})

test("each group member opens its own detail sheet", () => {
  // click first member button → sheet with member 1 detail blocks; close; click second → sheet 2
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Refactor `need-card.tsx`.** Extract the current `<button>` + `ProductDetailSheet` pair into `NeedCardEntry({ card, showKicker }: { card: NeedCardViewModel; showKicker: boolean })` holding its own `open` state. `NeedCard` becomes: category-shell `<article>` wrapping `<NeedCardEntry card showKicker />` (behavior byte-identical). Add:

```tsx
export function NeedCardGroup({ group }: { group: NeedCardGroupViewModel }) {
  const categoryStyle = CATEGORY_CARD_STYLES[group.category] ?? NEUTRAL_CARD_STYLE
  return (
    <article
      className={cn("overflow-hidden rounded-[19px] border shadow-[0_3px_11px_rgba(43,26,67,0.035)]", categoryStyle.shellClassName)}
      data-plan-start-card-group={group.id}
      data-plan-start-card-tone={group.tone}
    >
      <div className="flex items-center gap-1.5 px-3 pt-3 text-[8.5px] font-extrabold uppercase tracking-[0.11em] text-[#6B50A0]">
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", categoryStyle.dotClassName)} />
        <span className="truncate">{group.categoryLabel}</span>
        {group.statusLabel !== "Basis" ? (
          <span className="shrink-0 rounded-full bg-[rgba(107,80,160,0.14)] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#6B50A0]">
            {group.statusLabel}
          </span>
        ) : null}
      </div>
      {group.members.map((member, index) => (
        <div key={member.id}>
          {index > 0 ? <div className="mx-3 border-t border-[rgba(67,55,48,0.12)]" /> : null}
          <NeedCardEntry card={member} showKicker={false} />
        </div>
      ))}
    </article>
  )
}
```

  Member entries keep `data-plan-start-card={member.id}` on their button/article hook exactly as today (move the data attributes onto the entry). When `showKicker` is false, the kicker row is omitted and the top padding tightened (`pt-2` on the grid) per mockup.

- [ ] **Step 4: Render switch in `need-plan-screen.tsx`:**

```tsx
{screen.cards.map((card) =>
  isNeedCardGroup(card) ? <NeedCardGroup key={card.id} group={card} /> : <NeedCard key={card.id} card={card} />,
)}
```

  Remove any Task-1 casts; `planStartProductDisclaimer` flattening from Task 1 stays.

- [ ] **Step 5: Flow wiring.** In `plan-start-flow.tsx` line ~904, flatten groups for `optionalImageUrls`: `cards.flatMap((card) => isNeedCardGroup(card) ? card.members.flatMap((m) => (m.imageUrl ? [m.imageUrl] : [])) : card.imageUrl ? [card.imageUrl] : [])`. Search the file for any other `.cards` iteration assuming `NeedCardViewModel` and flatten the same way.

- [ ] **Step 6: Run tests → PASS.** Also `npx tsc --noEmit` (or `npm run typecheck` if defined) to catch missed `.cards` consumers.

- [ ] **Step 7: Commit.** `feat(plan-start): Variante-B grouped card rendering`

### Task 3: Routine compiler uses the role's tier

**Files:**
- Modify: `src/lib/personal-plan/routine-candidate-compiler.ts:227` (function `assessment`) and its call site at `:316`
- Test: `tests/personal-plan-routine-candidate-compiler.test.ts`

**Interfaces:** Consumes nothing from Tasks 1-2 (fully independent; parallel-safe — disjoint files).

- [ ] **Step 1: Write failing test** in the existing harness style (it already builds decisions/resolutions — reuse its fixtures):

```ts
test("routine items take the role tier, not the category aggregate", () => {
  // oil decision: needTier "basis"; roleTargets pre_wash tier "basis", dry_finish tier "optional"
  // compile items for both roles
  assert.equal(itemFor("pre_wash_fibre_treatment").state.systemAssessment, "basis")
  assert.equal(itemFor("dry_finish").state.systemAssessment, "optional")
})

test("categories without per-role tiers keep the category assessment", () => {
  // scalp_care roleTargets have no tier field → systemAssessment === decision.needTier
})
```

- [ ] **Step 2: Run → FAIL.** `npx tsx --test tests/personal-plan-routine-candidate-compiler.test.ts`

- [ ] **Step 3: Implement:**

```ts
function assessment(decision: PlanCategoryDecision, role: string): RoutineSystemAssessment {
  const roleTargets =
    decision.target && "roleTargets" in decision.target ? (decision.target.roleTargets ?? []) : []
  const roleTarget = roleTargets.find(
    (candidate) => candidate.role === role && "tier" in candidate && candidate.tier,
  ) as { tier?: PlanNeedTier } | undefined
  const tier = roleTarget?.tier ?? decision.needTier
  if (tier === "basis" || tier === "optional") return tier
  if (tier === "not_needed") return "not_recommended"
  throw new Error(`routine_candidate_unresolved_refined_decision:${decision.category}`)
}
```

  Call site `:316` becomes `systemAssessment: assessment(decision, resolution.role)`. Grep the file for other `assessment(` call sites and pass the role there too.

- [ ] **Step 4: Run the file's full test suite → PASS**, plus `npx tsx --test tests/personal-plan-stage4-compiler.test.ts` (stage-4 consumers of `systemAssessment`) — fix any assertions that legitimately change (an optional-role oil item moving to the routine's Optional section is the intended change; anything else is a regression).

- [ ] **Step 5: Commit.** `feat(routine): per-role system assessment for multi-role categories`

### Task 4: Integration verification (main session)

**Files:** none (verification only; evidence into `plans/2026-08-17-role-tier-cards/`)

- [ ] **Step 1:** `npm run ci:verify` in the worktree → green.
- [ ] **Step 2:** Full test run of the three touched suites.
- [ ] **Step 3:** Drive the flow: `npm run dev:worktree`, load a profile with mixed oil tiers (damaged dry lengths + frizz), verify: Basis page shows one standalone Vorwäsche card with "vor jeder passenden Haarwäsche"; Optional page shows the grouped oil card (kicker once, two members, "Optional" pill) + correct "N Vorschläge"; detail sheets open per member; direct accept still works; routine after accept shows optional oils in the routine "Optional" section. Screenshot Basis + Optional + routine into the plan folder.
- [ ] **Step 4:** Internal review pass (Codex lane unavailable until Sep 15): `code-reviewer` agent on the full branch diff, read-only. Fix real findings.
- [ ] **Step 5:** Report to Nick; `/ship` on approval.

## Self-Review Notes

- Spec coverage: placement/split (T1), Variante-B anatomy (T2), cadence copy (T1), routine leg (T3), Gegenprobe/shampoo grouping (T1 test), fallback + optional-screen-creation edges (T1 tests), disclaimer/count labels (T1/T2). Journey error path (previews fail → unexpanded cards) is preserved by construction — apply() only runs on a successful response; covered by existing tests.
- Type consistency: `PlanStartCardViewModel`/`isNeedCardGroup`/`NeedCardEntry` names used identically across tasks.
- Known intentional behavior changes beyond oil: multi-role same-tier categories (shampoo dandruff case) now group into one shell — approved via mockup Gegenprobe.
