# Öl-Prüfung: Ein Screen statt drei — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the three near-identical Stage-3 Öl review screens into one grouped screen with pre-checked use cases; deselected use cases surface as individually scoped follow-up screens.

**Architecture:** Pure UI-grouping change. The engine keeps one decision subject per (category, role, product) — `deriveStage3DecisionSubjects` (src/lib/personal-plan/products/contracts.ts:1111) and the batch submit remain untouched. A new pure grouping helper collects all pending oil subjects when the review reaches the first one; the grouped screen records the SAME local-choice mechanics (`rememberLocalReviewChoice`) once per checked subject — each subject committing its OWN recommended candidate. Unchecked subjects stay pending and render as today's single screen with scoped copy.

**Tech Stack:** React client flow (`stage3-products-flow.tsx`), pure helpers in `src/lib/personal-plan/products/`, node:test via `node --import ./tests/server-only-register.cjs --import tsx --test <file>`.

**Spec / Evidence:** `plans/2026-08-16-oil-single-review/approved-mockups.html` — final mockups (Screen 1 with inline checkbox use-cases, Screen 2 scoped follow-up). **Evidence + journey gates: CONFIRMED by Nick 2026-08-16** ("all of this works now") after two review rounds (inline deselection replaced the slide-up sheet at his direction; follow-up screen walked through step 1-2-3).

## Global Constraints

- German/du. Exact strings from the approved mockups:
  - Section intro: "Deine Einsätze aus dem Feinschliff — antippen zum Abwählen:"
  - Use-case rows (title / subtitle): "Vor der Haarwäsche" / "Als Pflege vor dem Waschen"; "Im feuchten Haar" / "Nach dem Waschen, bleibt im Haar"; "Im trockenen Haar" / "Für Glanz und Finish".
  - CTA: `Für alle ${n} Einsätze einplanen` (all checked) / `Für ${n} Einsätze einplanen` (subset, n≥2) / `Für diesen Einsatz einplanen` (n=1). Diverging recommendations: `Empfehlungen für alle ${n} einplanen`.
  - Follow-up heading: `Wähle dein Öl ${roleScopePhrase}` with map: pre-wash role → "für die Vorwäsche"; damp role → "fürs feuchte Haar"; dry role → "fürs trockene Haar".
  - Follow-up context line: `✓ ${productName} eingeplant für: ${labels · joined}`.
  - Kicker becomes "Öl · Prüfung X von Y" on the grouped screen, "Öl · <Einsatz> · Prüfung X von Y" on follow-ups.
- Engine untouched: no changes to `deriveStage3DecisionSubjects`, decision keys, batch submit, authority evaluation. Verify via existing engine tests staying green unmodified.
- Grouping applies ONLY to category `oil` and ONLY to `captured_product`/`uncovered_role` review subjects of the SAME kind sharing the same screen context; inventory dispositions are excluded.
- TDD for the pure helpers; component behavior covered in `tests/personal-plan-stage3-flow.test.tsx` following its existing harness.
- Pipefail on every piped test command. Pre-commit runs typecheck. Commits end with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
- Worktree: `.worktrees/oil-single-review` (`codex/oil-single-review`).

---

### Task 1: Pure grouping helper + position counting

**Files:**
- Create: `src/lib/personal-plan/products/oil-review-group.ts`
- Modify: (none yet)
- Test: `tests/personal-plan-oil-review-group.test.ts` (new)

**Interfaces:**
- Produces:
```ts
export type OilReviewGroup = {
  /** The subject whose screen anchors the group (first pending oil subject). */
  anchor: Stage3DecisionSubject
  /** All pending oil subjects of the same subjectKind, anchor included, in review order. */
  members: Stage3DecisionSubject[]
  /** True when members share one recommended/captured product proposition; false → "Empfehlungen für alle N einplanen" copy. */
  uniformProposition: boolean
}
export function deriveOilReviewGroup(
  subjects: Stage3DecisionSubject[],
  pendingDecisionKeys: ReadonlySet<string>,
  anchorKey: string,
  propositionByDecisionKey: ReadonlyMap<string, string | null>,
): OilReviewGroup | null
export function groupedReviewCounts(
  subjects: Stage3DecisionSubject[],
  decisionKey: string,
  groupedOilKeys: ReadonlySet<string>,
): { position: number; total: number }
```
- `deriveOilReviewGroup` returns null when the anchor is not category "oil", is an inventory_disposition, or fewer than 2 pending oil members exist (single oil use case keeps today's screen untouched).
- `propositionByDecisionKey` maps each subject to an identifier of its proposed product (recommended candidate id or captured product id) — the caller builds it from the authority bundles; the helper only compares.
- `groupedReviewCounts` collapses all members of the oil group into ONE counted step (the follow-ups of deselected members count individually once they leave the group — the caller passes the CURRENT group membership).

- [ ] **Step 1: Write failing tests** (fixtures: hand-built `Stage3DecisionSubject[]` arrays; no draft needed since the helper takes subjects directly):

```ts
test("three pending oil subjects group under the first as anchor", () => {
  const group = deriveOilReviewGroup(subjects3Oil, allPending, key(subjects3Oil[0]), uniformProps)
  assert.equal(group?.members.length, 3)
  assert.equal(group?.uniformProposition, true)
})
test("a decided oil subject is excluded from the group", () => { /* pendingDecisionKeys without one member → members.length 2 */ })
test("non-oil anchor returns null", () => {})
test("single pending oil subject returns null (keeps classic screen)", () => {})
test("diverging propositions set uniformProposition false", () => {})
test("inventory dispositions never group", () => {})
test("grouped counts collapse the group to one step", () => {
  // subjects: shampoo, conditioner, 3×oil (grouped), mask → oil anchor is position 3 of 4
  const { position, total } = groupedReviewCounts(subjects, oilAnchorKey, groupKeys)
  assert.equal(position, 3); assert.equal(total, 4)
})
test("a follow-up (ungrouped) oil subject counts as its own step", () => { /* groupKeys without it → total 5 */ })
```

- [ ] **Step 2:** Run `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-oil-review-group.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement the two functions (pure, no imports beyond contracts types).
- [ ] **Step 4:** Re-run → PASS. `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(stage3): pure oil review grouping helpers`.

### Task 2: Grouped Öl screen (Screen 1)

**Files:**
- Create: `src/components/personal-plan-products/oil-group-review.tsx` (use-case checklist section + CTA wrapper composed around the existing `ProductFitComparison` presentation for the anchor)
- Modify: `src/components/personal-plan-products/stage3-products-flow.tsx` (decisions phase render: when `deriveOilReviewGroup(...)` returns a group for `displayedReviewSubject`, render the grouped screen; commit path)
- Test: `tests/personal-plan-stage3-flow.test.tsx` (extend, existing harness)

**Interfaces:**
- Consumes Task 1's `OilReviewGroup` + `groupedReviewCounts`.
- Produces component props:
```ts
export function OilGroupReview(props: {
  group: { role: string; roleTitle: string; roleSubtitle: string; decisionKey: string; productName: string | null }[]
  uniformProposition: boolean
  checkedKeys: ReadonlySet<string>
  onToggle: (decisionKey: string) => void
  onCommit: () => void   // commits all CHECKED members
  disabled?: boolean
  children: ReactNode    // the anchor's existing comparison content
}): ReactElement
```
- Role copy map (new, in `stage3-product-copy.ts`): per oil role → `{ title, subtitle, scopePhrase }` with the exact German strings from Global Constraints (titles "Vor der Haarwäsche"/"Im feuchten Haar"/"Im trockenen Haar", subtitles as specified, scopePhrase "für die Vorwäsche"/"fürs feuchte Haar"/"fürs trockene Haar"). Read the actual oil role identifiers from `getCategoryRolePolicy("oil").allowedRoles` / ROLE_COPY before writing the map — do not guess role keys.

- [ ] **Step 1: Write failing flow tests** (harness style of the surrounding tests — fake gateway with a 3-oil-role draft; the lab fixtures already exercise multi-purpose oil):

```tsx
test("three oil use cases render as one grouped screen with pre-checked cases", async () => {
  … reach decisions phase with shampoo decided, 3 oil subjects pending …
  await screen.findByText("Deine Einsätze aus dem Feinschliff — antippen zum Abwählen:")
  assert.equal(checkboxes.length, 3)           // all pre-checked
  await screen.findByText("Für alle 3 Einsätze einplanen")
})
test("committing the full group records one local choice per member and advances past all oil subjects", async () => {
  … tap CTA …
  // next screen is the mask/bondbuilder subject — no second oil screen
  // and the local review choices contain all three oil decision keys
})
test("deselecting one case commits two and surfaces the third as a scoped follow-up", async () => {
  … untick "Im trockenen Haar", CTA now "Für 2 Einsätze einplanen", tap …
  await screen.findByText("Wähle dein Öl fürs trockene Haar")
  await screen.findByText(/eingeplant für: Vorwäsche/)
})
test("diverging recommendations relabel the CTA", async () => {
  … propositions differ → await screen.findByText("Empfehlungen für alle 3 einplanen") …
})
```

- [ ] **Step 2:** Run the flow test file → FAIL.
- [ ] **Step 3: Implement.** In the decisions phase (stage3-products-flow.tsx ~:1065-1145): before the per-subject render, build the group via Task 1 helper (pending = subjects without a `localReviewChoices` entry; propositions from the authority bundle's recommended candidate per subject — reuse whatever the current per-subject screen uses as its preselected recommendation). Maintain `checkedKeys` state (default: all members). `onCommit` loops the CHECKED members calling the existing `rememberLocalReviewChoice(subject, itsOwnProposedCandidate)` — exactly the same call the single screen makes, once per member; unchecked members simply remain pending. The auto-submit effect and batch machinery stay untouched (guards unchanged from PR #424 — do NOT touch the timeout/recovery paths).
- [ ] **Step 4:** Wire `groupedReviewCounts` into the `reviewPosition`/`reviewTotal` props (:1138) and the analytics position payloads (:669, :2398, :2447) so the group counts as one step; follow-ups count individually.
- [ ] **Step 5:** Run flow tests + Task 1 tests → PASS. `set -o pipefail && npm run test:personal-plan 2>&1 | tail -3`.
- [ ] **Step 6: Commit** `feat(stage3): grouped oil review screen with use-case deselection`.

### Task 3: Scoped follow-up screen copy (Screen 2)

**Files:**
- Modify: `src/components/personal-plan-products/stage3-products-flow.tsx` (props for oil follow-up subjects), `src/components/personal-plan-products/product-fit-comparison.tsx` (optional `scopeContextLine?: string` + heading override prop), `stage3-product-copy.ts` (scopePhrase already added in Task 2)
- Test: `tests/personal-plan-stage3-flow.test.tsx`

- [ ] **Step 1: Failing assertions** (extend Task 2's third test or add one): follow-up shows kicker `Öl · Im trockenen Haar · Prüfung 5 von 6`-shaped context (`roleLabel` slot already exists in the kicker — assert the role appears), heading `Wähle dein Öl fürs trockene Haar`, green context line `✓ NANOIL Avocadoöl eingeplant für: Vorwäsche · Feuchtes Haar`, CTA `Für diesen Einsatz einplanen`.
- [ ] **Step 2:** Implement: when rendering an oil subject that was deselected from a committed group (pending oil subject while other oil subjects have local choices), pass heading override + context line (built from the committed members' role titles + product display name) + CTA label into the review component. Keep non-oil categories byte-identical.
- [ ] **Step 3:** Tests PASS; commit `feat(stage3): scoped follow-up screen for split oil choices`.

### Task 4: Verification + ship

- [ ] **Step 1:** `set -o pipefail` runs: focused files, `npm run test:personal-plan`, `npm run ci:verify`. Zero new eslint warnings on touched files.
- [ ] **Step 2:** Manual/lab walkthrough: `npm run dev:worktree` → `/labs/personal-plan/stage-3`, capture an oil with ALL THREE use-case checkboxes in the capture step, reach the review → verify grouped screen (one screen, 3 checked cases, CTA counts), full-commit path, and the deselect→follow-up path. Screenshots at 375px for the PR (before-screenshots: audit findings + approved-mockups.html in this plan dir).
- [ ] **Step 3:** Codex whole-branch review per repo protocol (read-only, `--effort xhigh`), fix real findings.
- [ ] **Step 4:** Push + PR (include this plan dir as evidence). Ship confirmation with Nick before merge per workflow.

## Self-review notes

- Engine invariants: no file under `src/lib/personal-plan/products/authority/` or the persistence gateways is modified; decision keys and batch submission untouched — the PR diff must show this.
- Deliberate scope cuts: no grouping for other multi-role categories (only oil has the audited repetition); no changes to the Feinschliff oil-purpose question; single-oil-use users see today's screen unchanged (helper returns null).
- Risk: position counting feeds analytics payloads — Task 2 Step 4 lists all three call sites; the reviewer should verify no payload shape changes, only values.
