# Post-Payment Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two post-payment blockers (Anwendung dead end + Chat lockout, spurious "Nicht gespeichert"), the audited styling defects, and the profile data-sync gap — as three sequential PRs.

**Architecture:** PR 1 hardens the Stage-5 resolver (degrade per product instead of failing the page), unlocks `/chat` in the middleware guards, and reroutes the Stage-3 finalization timeout into the existing auto-reconcile path. PR 2 is a batch of small, verified CSS/copy corrections. PR 3 overlays `/profile`'s legacy read paths with personal-plan data (read-path fix, no backfill).

**Tech Stack:** Next.js (App Router), Supabase, Tailwind, node:test via `node --import ./tests/server-only-register.cjs --import tsx --test <file>`.

**Spec:** `plans/2026-08-15-post-payment-fixes/blockers-investigation.md` (root causes, file:line evidence), `styling-fixes.md` (per-issue fixes), `report.md` (UX audit + screenshot references). All file:line refs were verified against `main` @ `91f38915`.

**Evidence gate (CLAUDE.md):** Current-surface evidence = audit screenshots (2026-08-15, reviewed by Nick); Nick approved fixing the blockers, activating Chat, updating the profile page, and requested styling solutions. Excluded from scope: Idealplan example-image placeholders (Nick is handling). Tasks 2.6 and 2.7 change layout visibly beyond bug-restoration → each contains a **screenshot checkpoint for Nick before commit**. All other tasks restore intended behavior/design (bugfix scope); journeys are unchanged.

## Global Constraints

- All user-facing text is German, informal "du".
- Vocabulary: `hair_texture` = pattern, `thickness` = diameter.
- No over-engineering; smallest fix that removes the defect.
- TDD for deterministic logic (`src/lib/**`); UI tasks verify via existing test suites + screenshots.
- Every PR: `npm run ci:verify` green before Codex review; squash-merge.
- Worktree: `.worktrees/post-payment-fixes` (`codex/post-payment-fixes`). PR 2 and PR 3 branch from updated `main` after the previous PR merges (`npm run worktree:new -- post-payment-styling`, `-- profile-plan-overlay`).
- Test runner (single file): `node --import ./tests/server-only-register.cjs --import tsx --test tests/<file>`.

---

# PR 1 — Hotfixes: Anwendung, Chat, Stage-3-Timeout (branch `codex/post-payment-fixes`)

### Task 1.1: Confirm the production culprit (diagnosis, no code)

**Files:** none (read-only).

- [ ] **Step 1:** In Sentry (`haircare-fw/hair-concierge`), open issue `personal_plan_application_unavailable` and read tag `personal_plan.failure_reason` for events from 2026-08-15 ~11:41–11:45 UTC. `schema_contract` ⇒ imageUrl/Zod path; `unknown` ⇒ `accepted_routine_product_unavailable`.
- [ ] **Step 2:** Via Supabase (project `pqdkhefxsxkyeqelqegq`), run the audit SQL from `blockers-investigation.md` (routine products of lead `971a66ec-…`): check `image_url !~ '^https?://'`, `category_key` vs. slot, `lifecycle_status`.
- [ ] **Step 3:** Record the finding at the top of the PR description. Both fix paths (Tasks 1.2, 1.3) ship regardless — this step only confirms which one fired and whether catalog data also needs cleanup (if so, file a follow-up, do not block this PR).

### Task 1.2: imageUrl must never kill the Anwendung page

**Files:**
- Modify: `src/lib/personal-plan/routine/application-adapter.ts:256`
- Modify: `src/lib/routines/personal-plan/application/contracts.ts:126`
- Test: `tests/personal-plan-stage5-application-adapter.test.ts`

**Interfaces:** Produces `sanitizeImageUrl(value: unknown): string | null` (module-local in application-adapter.ts).

- [ ] **Step 1: Write the failing test.** In the existing adapter test file, add cases (reuse the file's existing fixture builders for routine version + product rows — follow the pattern of neighboring tests):

```ts
test("relative image_url is sanitized to null instead of failing", async () => {
  // product row with image_url: "/images/foo.png" — otherwise valid
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithProductImage("/images/foo.png"))
  assert.equal(result.routineItems[0]?.imageUrl, null)
})
test("empty image_url is sanitized to null", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithProductImage(""))
  assert.equal(result.routineItems[0]?.imageUrl, null)
})
test("absolute image_url passes through", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithProductImage("https://cdn.example/x.png"))
  assert.equal(result.routineItems[0]?.imageUrl, "https://cdn.example/x.png")
})
```

- [ ] **Step 2:** Run: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage5-application-adapter.test.ts` → new tests FAIL (relative URL currently passes through raw and later explodes in the compiler contract).
- [ ] **Step 3: Implement.** In `application-adapter.ts`, add above the adapter function:

```ts
function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}
```

and change line 256 `imageUrl: product.image_url,` → `imageUrl: sanitizeImageUrl(product.image_url),`.

- [ ] **Step 4: Belt-and-braces at the contract.** `contracts.ts:126`: `imageUrl: z.string().url().nullable().optional(),` → `imageUrl: z.string().url().nullable().optional().catch(null),` (a presentation-only field must never fail the compile; the comment above it already says so).
- [ ] **Step 5:** Re-run the test file → PASS.
- [ ] **Step 6: Commit** `fix(anwendung): sanitize product image_url instead of failing the page`.

### Task 1.3: Demote unavailable catalog products to unresolved items instead of throwing

**Files:**
- Modify: `src/lib/personal-plan/routine/application-adapter.ts:208-223` (the `candidates.map` block)
- Modify: `src/app/anwendung/page.tsx` (resolver body, near the `catch` at :176-183)
- Modify: `src/lib/observability/personal-plan-application.ts:67-70`
- Test: `tests/personal-plan-stage5-application-adapter.test.ts`

**Interfaces:** Adapter return type gains `degradedItems: Array<{ productId: string; category: string; issue: "catalog_identity_mismatch" }>`; demoted items are ALSO appended to the existing `unresolvedRoutineItems` (shape `NormalizedUnresolvedRoutineItem`, see adapter :164-172).

- [ ] **Step 1: Write the failing tests:**

```ts
test("inactive product demotes its item instead of failing the page", async () => {
  // fixture: 2 items; product A lifecycle_status "discontinued", product B valid
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithInactiveProductA())
  assert.equal(result.routineItems.length, 1)              // B survives
  assert.equal(result.unresolvedRoutineItems.length, 1)    // A demoted
  assert.deepEqual(result.degradedItems, [
    { productId: PRODUCT_A_ID, category: "shampoo", issue: "catalog_identity_mismatch" },
  ])
})
test("category_key mismatch demotes instead of failing", async () => { /* same pattern, category_key: "mask" on a bondbuilder slot */ })
test("all items demoted fails closed", async () => {
  // spec decision: a page with zero surviving products must NOT render as ready
  await assert.rejects(
    () => adaptAcceptedActiveRoutineForApplication(inputWhereAllProductsInactive()),
    /accepted_routine_product_unavailable/,
  )
})
test("demoted item carries reason catalog_unavailable", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithInactiveProductA())
  assert.equal(result.unresolvedRoutineItems[0]?.reason, "catalog_unavailable")
})
```

- [ ] **Step 2:** Run the file → FAIL (currently throws `accepted_routine_product_unavailable`).
- [ ] **Step 3: Implement.** Replace the `candidates.map(...)` (:208) with a loop that pushes to `routineItems` / `demotes`: keep the two `accepted_routine_product_identity_unavailable` throws (:209-213, truly malformed payload), but replace the `throw new Error("accepted_routine_product_unavailable")` (:216-223) with:

```ts
degradedItems.push({ productId, category: item.category, issue: "catalog_identity_mismatch" })
unresolvedRoutineItems.push({
  itemId: item.itemKey,
  category: item.category,
  role: semanticRoleByRoutineRole[item.role],
  routineOrder,
  applicationInstanceKey: item.assignmentKey,
})
continue
```

(convert the `.map` to a `for … of` over `candidates`; declare `const degradedItems: … = []` next to `unresolvedRoutineItems`). Add `degradedItems` to both `return` sites (:184-192 early return → `degradedItems: []`). **Fail-closed policy:** after the loop, `if (routineItems.length === 0 && degradedItems.length > 0) throw new Error("accepted_routine_product_unavailable")` — a page with zero surviving products must not render as ready (spec §Blocker 1 fix 2).

- [ ] **Step 3b: Reason-aware unresolved copy.** Extend `NormalizedUnresolvedRoutineItem` with `reason?: "no_product_chosen" | "catalog_unavailable"` (default `"no_product_chosen"`; demoted items set `"catalog_unavailable"`). In `src/components/application/unresolved-product-block.tsx:23` the current copy ("Produkt noch offen" / no confirmed product) is FALSE for a demoted confirmed product — branch on the reason: `catalog_unavailable` → title "Produkt gerade nicht verfügbar", body "Dein gewähltes Produkt ist im Katalog gerade nicht verfügbar. Deine Routine bleibt gespeichert." Thread the field through whatever schema/view types sit between the adapter and that component (follow the type errors).
- [ ] **Step 4:** In `src/app/anwendung/page.tsx`, where the adapter result is consumed (before the success return): for **each** entry of `adapterResult.degradedItems`, call `deps.reportFailure` once, using the existing `PersonalPlanApplicationFailureDetails` contract (`src/lib/observability/personal-plan-application.ts:11` — it supports singular `productId` and `issueCode`; read the exact shape before coding): same `failureContext` spread as the catch at :176-183, `reason: "product_guidance_unresolved"`, `productId: item.productId`, `issueCode: "catalog_identity_mismatch"` — and **still return the ready view**. Extend the `reason` union/`failureReason` helper (:62-70) if the type requires it.
- [ ] **Step 5: Diagnosability.** In the resolver's `catch` in `src/app/anwendung/page.tsx:176-183` (where the thrown `error` IS in scope, unlike inside `capturePersonalPlanApplicationFailure`): add `failureCode: error instanceof Error ? error.message.slice(0, 64) : "unknown"` to the reported details; in `personal-plan-application.ts` add optional `failureCode?: string` to `PersonalPlanApplicationFailureDetails` and `scope.setTag("personal_plan.failure_code", details.failureCode ?? "unknown")` next to the existing reason tag (:67). The message is one of our own stable codes, not user data.
- [ ] **Step 5b: Resolver test.** Add/extend a page-resolver test proving the view stays `ready` while per-item warnings are emitted when one product degrades (stub `deps.reportFailure`, assert it was called once with `issueCode: "catalog_identity_mismatch"`).
- [ ] **Step 6:** Run adapter test file → PASS. Run `npm run test:personal-plan-stage5` → PASS.
- [ ] **Step 7: Commit** `fix(anwendung): degrade unavailable catalog products per item instead of failing the page`.

### Task 1.4: Honest recovery UI for the `unavailable` state

**Files:**
- Modify: `src/components/application/application-state.tsx:33-39, 73-82`

- [ ] **Step 1:** Change `STATE_COPY.unavailable` to
  `description: "Deine Routine ist unverändert. Du kannst es erneut versuchen oder zurück zu deiner Routine gehen."` (drop the false promise "sobald die Anleitung wieder erreichbar ist").
- [ ] **Step 2:** For the `unavailable` branch render BOTH actions: keep `ApplicationRetryButton` ("Erneut laden") and add beneath it a secondary link to `/routine` labeled "Zur Routine" (same `Link` styling as the other states but `variant`-toned down: `mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[12px] border-[1.5px] border-primary px-5 text-sm font-semibold text-primary hover:bg-muted`). Simplest: add `secondaryHref?: string; secondaryLabel?: string` to the copy record for `unavailable` and render when present.
- [ ] **Step 3:** `npm run ci:verify` (typecheck catches the record-type change). Manual check: temporarily unreachable state not required — screenshot in Task 1.7 walkthrough.
- [ ] **Step 4: Commit** `fix(anwendung): give the unavailable state an honest retry + routine exit`.

### Task 1.5: Unlock /chat from the frontier redirect

**Files:**
- Modify: `src/lib/personal-plan/frontier-routing.ts:50, 63-70`
- Modify: `src/lib/auth/intake-state.ts:74-90`
- Modify: `src/lib/supabase/middleware.ts:433-438`
- Test: `tests/personal-plan-frontier-routing.test.ts` (assertions at :79, :89), `tests/auth-intake-state.test.ts`, `tests/auth-middleware-personal-plan-routine.test.ts` (existing integration cases at :273 area encode the old chat redirect — Stage 1, recovery, frontier-outage — rewrite them to the new oracle)

**Intended oracle (explicit product decision):** `/chat` is NEVER frontier-redirected — at any stage, including recovery and pre-Stage-3. Access control for chat is solely the intake gate: entitled users with a pending or active routine bypass legacy onboarding; users without entitlement/routine keep today's behavior (`needs_quiz` → `/quiz`, `needs_onboarding` without bypass → `/onboarding`). No redirect loop exists: paywall runs first and the bypass requires entitlement + routine.

**Interfaces:** Produces `isPersonalPlanOnboardingBypassRoute(pathname: string): boolean` exported from `intake-state.ts` (= `/routine | /anwendung | /chat` prefixes).

- [ ] **Step 1: Write the failing tests.** In `tests/personal-plan-frontier-routing.test.ts`, update/add:

```ts
test("chat is never frontier-redirected for personal-plan users", () => {
  assert.equal(getPersonalPlanFrontierRedirect("/chat", stage5Frontier()), null)
  assert.equal(getPersonalPlanFrontierRedirect("/chat", stage3Frontier()), null)
  assert.equal(getPersonalPlanFrontierRedirect("/chat", { kind: "recovery", nextHref: "/plan-bereit" }), null)
})
```

In `tests/auth-intake-state.test.ts`:

```ts
test("chat bypasses legacy onboarding with pending or active routine", () => {
  assert.equal(
    canBypassLegacyOnboardingForPersonalPlanRoutine("/chat", {
      hasActivePersonalPlanEntitlement: true,
      pendingRoutineProposalId: null,
      activeRoutineVersionId: "v1",
    }),
    true,
  )
  assert.equal(canBypassLegacyOnboardingForPersonalPlanRoutine("/chat", undefined), false)
})
```

- [ ] **Step 2:** Run both test files → FAIL (existing assertions at frontier-routing.test.ts:79/89 that expect the chat redirect now conflict — rewrite them to the new oracle, they encode the bug).
- [ ] **Step 3: Implement** (3 guard edits):
  1. `frontier-routing.ts:50` → `if (pathname === "/auth") return frontier.nextHref` and remove `isRoute(pathname, "/chat")` from `isFrontierControlledRoute` (:66).
  2. `intake-state.ts`: add `export function isPersonalPlanOnboardingBypassRoute(pathname: string): boolean { return isPersonalPlanRoutineRoute(pathname) || isRoute(pathname, "/chat") }`; in `canBypassLegacyOnboardingForPersonalPlanRoutine` (:78-90) add before the final `return false`: `if (isRoute(pathname, "/chat")) return hasPendingOrActiveRoutine`.
  3. `middleware.ts:437`: replace `isPersonalPlanRoutineRoute(pathname)` with `isPersonalPlanOnboardingBypassRoute(pathname)` (import it) so the `personalPlanRoutineAccess` pre-load also runs for `/chat` and the bypass doesn't fail closed.
- [ ] **Step 4: Middleware matrix.** In `tests/auth-middleware-personal-plan-routine.test.ts`, cover `/chat` across: active routine (→ pass through), pending routine (→ pass through), entitled but no routine pointer (→ `/onboarding`), `needs_quiz` (→ `/quiz`), no entitlement (→ `/onboarding`), recovery frontier (→ pass through, intake gate still applies), frontier load failure (→ existing 503/fallback behavior unchanged for chat).
- [ ] **Step 5:** Run all three test files + `npm run test:personal-plan-stage5` (includes `auth-intake-state` and nav tests) → PASS.
- [ ] **Step 6: Commit** `fix(chat): stop frontier-redirecting chat for personal-plan users`.

### Task 1.6: Stage-3 finalization timeout → auto-reconcile, truthful badge, bigger budget

**Files:**
- Modify: `src/components/personal-plan-products/stage3-products-flow.tsx:249, 713-748, 2666-2669, 2830-2833`
- Modify: `src/components/personal-plan-products/index.tsx:91-95` (Stage3Shell)
- Modify: `src/components/personal-plan-journey/journey-header.tsx:18-32, 76`
- Modify: `src/app/api/personal-plan/stage-3/route.ts`, `src/app/api/personal-plan/stage-3/complete/route.ts` (add `export const maxDuration = 60`)
- Test: `tests/personal-plan-stage3-flow.test.tsx` (rewrite the block at :4077-4145)

**Interfaces:** `PersonalPlanJourneyHeader` gains optional prop `saveLabel?: string` (overrides `SAVE_COPY[saveStatus]` when non-empty); `Stage3Shell` passes `saveState.label` through.

- [ ] **Step 1: Rewrite the failing test.** The test "an unconfirmed final request leaves the loader for a durable recovery action" (:4077-4145) asserts the dead end. New oracle, same fixture (tiny injected `finalizationTimeoutMs`):

```tsx
test("a finalization timeout auto-reconciles and reaches the handoff", async () => {
  // gateway stub: resolveAuthorityDecisions hangs past the injected timeout,
  // but the draft reload behind recoverPendingIntent reports the decisions as applied
  // (classifyRecoveredDesiredState → "satisfied")
  … render, choose all subjects, advance timers …
  await screen.findByText("Speicherstatus wird geprüft.")   // transient, not the manual screen
  await screen.findByText("Deine Produktauswahl steht.")    // handoff reached with zero clicks
  assert.equal(gatewayStub.resolveAuthorityDecisions.callCount, 1) // NOT resubmitted by the auto-submit effect
  assert.ok(gatewayStub.complete.callCount <= 1)                    // no duplicate completion
})
test("manual screen appears only when the reconcile also fails", async () => {
  // gateway stub: submission times out AND the recovery reload rejects
  … await screen.findByText("Speicherstatus noch offen.") …
})
```

Mirror the stubbing style of the surrounding tests in that file (they already fake the gateway + storage).

- [ ] **Step 2:** Run `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-flow.test.tsx` → new tests FAIL.
- [ ] **Step 3: Implement the reroute.** Both timeout special-cases currently bypass the auto-recovery that every other error gets. In `submitReviewedDecisions` (:2666-2669) replace

```ts
if (error instanceof Stage3FinalizationTimeoutError) {
  finishDecisionSubmission()
  setPendingRecoveryMode("manual")
  return
}
```

with

```ts
if (error instanceof Stage3FinalizationTimeoutError) {
  setPendingRecoveryMode("checking") // BEFORE releasing any guard — closes the auto-resubmit window
  finishDecisionSubmission()
  Sentry.captureMessage("personal_plan_stage3_finalization_timeout", "warning")
  await delay(2_000) // let the still-running request commit server-side
  await handlePendingRecoveryError(error, sourceDraft)
  return
}
```

**Ordering is load-bearing:** the auto-submit effect (:688-711) re-fires the whole batch whenever `decisionSubmitStatus` returns to idle while `pendingRecoveryMode` is null — `setPendingRecoveryMode("checking")` must run BEFORE `finishDecisionSubmission()`. Same in `completeFlow` (:2830-2833): set `"checking"` first, THEN `completionInFlight.current = false` + `finishDecisionSubmission()`, then the same Sentry + delay + `handlePendingRecoveryError` sequence. `handlePendingRecoveryError` (:1839-1882) already does exactly the right thing for non-gateway errors: reads the pending intent, keeps "checking", reconciles, falls back to "manual" only on a second failure.

**Telemetry channel (deliberate):** use Sentry `captureMessage` (payload-free, import per the repo's existing `@sentry/nextjs` usage), NOT `analytics.track` — `"finalization_timeout"` is not in `PersonalPlanStage3SaveOutcome` (`src/lib/analytics/events.ts:187`) and production Stage-3 analytics allowlists only the consent-gated payload-free baseline (`src/lib/personal-plan/products/stage3-analytics.ts:56` drops both save- and recovery-outcome events). We do not touch that privacy allowlist.

- [ ] **Step 4: Budget.** `:249` `finalizationTimeoutMs = 12_000` → `finalizationTimeoutMs = 30_000`. Add `export const maxDuration = 60` to both stage-3 API routes.
- [ ] **Step 5: Badge truthfulness.** `journey-header.tsx`: add `saveLabel` prop, render `{saveLabel ?? SAVE_COPY[saveStatus]}` at :76 (`saveLabel` also drives the `aria-live` text). `index.tsx:95`: `<PersonalPlanJourneyHeader currentStage={3} saveStatus={saveStatus} saveLabel={saveState.label || undefined} onBack={onBack} />`. In `stage3-products-flow.tsx:737-741` make the label match the mode: `pendingRecoveryMode === "checking" ? "Speicherstatus wird geprüft" : pendingRecoveryMode === "manual" ? "Speicherstatus offen" : …` (never "Nicht gespeichert" while the save may have succeeded).
- [ ] **Step 6:** Run the stage-3 test file → PASS. Run `npm run test:personal-plan` → PASS.
- [ ] **Step 7: Commit** `fix(personal-plan): auto-reconcile stage-3 finalization timeouts instead of dead-ending`.

### Task 1.7: PR 1 verification + ship

- [ ] **Step 1:** `npm run ci:verify`.
- [ ] **Step 2:** Manual walkthrough against prod-like data: re-run the test-quiz flow (`/test/quiz/<token>`) in a fresh Playwright profile through all 5 stages; confirm `/anwendung` renders (or degrades to items-with-gaps, not the dead end), `/chat` loads directly, and the final "einplanen" reaches the handoff without the manual screen. Screenshot `/anwendung` + `/chat` for the PR.
- [ ] **Step 3:** Codex whole-branch review per CLAUDE.md (agent `codex:codex-rescue`, `git diff origin/main...HEAD`, read-only brief, `--effort xhigh`). Fix real findings.
- [ ] **Step 4:** `/ship` (includes confirm-with-user gate). After deploy: Sentry check for new errors (last hour) and confirm `personal_plan_application_unavailable` stops for the field-test account; re-check `/anwendung` for lead `971a66ec…`.

---

# PR 2 — Styling batch (branch `codex/post-payment-styling`, from updated main)

Spec for every task: `plans/2026-08-15-post-payment-fixes/styling-fixes.md` (verified root causes). Verification for each: before/after screenshot at 375×812 and 1440×900 via Playwright against `npm run dev:worktree`; before-screenshots exist in the audit folder.

### Task 2.1: Comparison table — spacing + German hyphenation

**Files:** Modify `src/components/personal-plan-products/product-fit-comparison.tsx:1062-1143` (4-col) and the 3-col variant at :1305-1368.

- [ ] **Step 1:** `<section>` (:1062): add `lang="de"`.
- [ ] **Step 2:** Row-header `th` (:1101): `px-2` → `pl-2 pr-3`, add `[hyphens:auto]`; header `th` (:1075) `px-2` → `pl-2 pr-3`.
- [ ] **Step 3:** All body `td` (:1117, :1123, :1126): `px-1` → `px-1.5`, add `[hyphens:auto]` next to the existing `break-words`.
- [ ] **Step 4:** Apply the same changes to the 3-col variant block.
- [ ] **Step 5:** Screenshot check at 375px on a comparison page: "Reinigungsintensität" no longer touches "sanft"; "ausgeglichen" breaks with hyphen or fits. Compare against `report.md` screenshot 15.
- [ ] **Step 6: Commit** `fix(stage3): comparison table spacing and German hyphenation on small screens`.

### Task 2.2: Idealplan footer CTA overflow

**Files:** Modify `src/components/personal-plan-start/need-plan-screen.tsx:54-93`.

- [ ] **Step 1:** Shorten the label (:59): `"Jetzt auf meine Produkte abstimmen"` → `"Auf meine Produkte abstimmen"`.
- [ ] **Step 2:** On the CTA `<Button variant="funnelCta">` (:84-93) add `className="min-w-0 flex-1 whitespace-normal px-4"` (defeats the base `whitespace-nowrap` from `button.tsx:9` + `w-full` from `:19`; two-line wrap fits the `min-h-14` pill).
- [ ] **Step 3:** Screenshot at 375px on the "Optionale Empfehlungen" page: button fully inside viewport incl. chevron (audit measured 68px overflow before). Compare screenshot 08.
- [ ] **Step 4: Commit** `fix(idealplan): footer CTA no longer overflows small viewports`.

### Task 2.3: Kicker orphan + "trotzdem behalten" affordance

**Files:** Modify `src/components/personal-plan-products/product-fit-comparison.tsx:132 (+ ReviewHeader :331-356), :274-284`.

- [ ] **Step 1:** Replace the single `contextLabel` string with JSX in `ReviewHeader`: `{categoryLabel} · {roleLabel} · <span className="whitespace-nowrap">Produkt {reviewPosition} von {reviewTotal}</span>` (keep a plain-string variant for any aria usage).
- [ ] **Step 2:** Quiet actions (:279): className → `"h-auto justify-start whitespace-normal rounded-[12px] border border-border bg-muted/30 px-3 py-3 text-left text-foreground/80 hover:bg-muted/60"` (keeps hierarchy below the coral CTA, reads as tappable).
- [ ] **Step 3:** Screenshots at 375px; compare 13/14.
- [ ] **Step 4: Commit** `fix(stage3): unbreakable review counter and tappable keep-product action`.

### Task 2.4: Grammar — per-category add-more labels

**Files:** Modify `src/components/personal-plan-products/index.tsx:680-697` (+ the call sites passing `categoryLabel`).

- [ ] **Step 1:** Add to the module a map and use it at :696 instead of the template:

```ts
const ADD_MORE_LABELS: Record<string, string> = {
  Shampoo: "Weiteres Shampoo hinzufügen",
  Conditioner: "Weiteren Conditioner hinzufügen",
  "Leave-in": "Weiteres Leave-in hinzufügen",
  Öl: "Weiteres Öl hinzufügen",
  Maske: "Weitere Maske hinzufügen",
  Bondbuilder: "Weiteren Bondbuilder hinzufügen",
}
// … {ADD_MORE_LABELS[categoryLabel] ?? `Mehr hinzufügen (${categoryLabel})`}
```

- [ ] **Step 2:** Grep for other `Weiteres ${` templates in the repo; fix identically if found.
- [ ] **Step 3: Commit** `fix(stage3): grammatically correct add-more labels per category`.

### Task 2.5: Copy — dev-speak + routine header count

**Files:** Modify `src/lib/personal-plan/routine/product-detail-service.ts:72, 79`; `src/components/personal-plan-products/product-fit-comparison.tsx:667`; `src/components/routine/personal-plan/routine-page.tsx:102-104, 135`.

- [ ] **Step 1:** Both `limitationLabel` literals: `"Die Eignung stammt aus dem eingefrorenen Routine-Stand."` → `"Die Bewertung basiert auf deiner bestätigten Routine."`
- [ ] **Step 2:** `:667`: drop the trailing clause → `"…oder fahre vorerst ohne Produkt fort."`
- [ ] **Step 3:** Routine header: add `const includedProductCount = [...basisItems, ...optionalItems].filter(i => i.state.inclusion === "included").length` next to `activeProductCount` (:102-104). Replace the sentence at :135 with:

```ts
: includedProductCount === 0
  ? "Deine Routine ist bereit."
  : activeProductCount > 0
    ? `Deine Routine mit ${includedProductCount} Produkten – ${activeProductCount} davon hast du schon.`
    : `Deine Routine mit ${includedProductCount} Produkten.`
```

(handle `includedProductCount === 1` → "1 Produkt"; `activeProductCount === 1` reads correctly as "1 davon").

- [ ] **Step 4:** `npm run test:personal-plan` (routine tests may assert the old copy — update failing literals to the new oracle).
- [ ] **Step 5: Commit** `fix(routine): honest product count and user-facing copy`.

### Task 2.6: Collapse the double header on /routine and /anwendung — **Nick checkpoint**

**Files:** Modify `src/components/personal-plan-journey/journey-header.tsx:18-78`; `src/components/routine/personal-plan/routine-page.tsx:110`; `src/components/application/application-page.tsx:178`; `src/components/routine/personal-plan/personal-plan-routine-client.tsx:516`.

- [ ] **Step 1:** Add prop `showWordmark = true` to `PersonalPlanJourneyHeader`. When `false`: skip the wordmark `<span>` (:62-64) and switch the grid (:42-48) to `grid-cols-[minmax(0,1fr)_7rem]` (back-button slot only renders when `onBack` is set — keep `44px` first column only in that case: `onBack ? "grid-cols-[44px_minmax(0,1fr)_7rem]" : "grid-cols-[minmax(0,1fr)_7rem]"`). Progressbar block unchanged.
- [ ] **Step 2:** Pass `showWordmark={false}` at the three call sites on /routine and /anwendung (pages that render inside the app shell). Wizard call sites (`/plan-start`) untouched.
- [ ] **Step 3: Checkpoint:** screenshot /routine at 375px + 1440px, post both to Nick, wait for 👍 before committing (visible layout change beyond bug-restoration).
- [ ] **Step 4: Commit** `fix(personal-plan): single brand header on routine and anwendung`.

### Task 2.7: Desktop navigation — header links, tab bar mobile-only — **Nick checkpoint**

**Files:** Modify `src/components/layout/personal-plan-navigation.tsx:29-77`; `src/components/layout/authenticated-app-shell.tsx:23-46`.

- [ ] **Step 1:** In the app header row (:32-44), after the wordmark `Link`, render the nav items inline for md+: `<nav aria-label="Personal-Plan-Navigation" className="hidden md:flex items-center gap-1">` with each item as a `Link` `px-3 py-2 rounded-[10px] text-sm font-semibold` + active state `text-primary bg-[var(--brand-plum-ice)]` / inactive `text-muted-foreground hover:bg-accent` (reuse the existing `active` computation; keep the `RoutineAttentionIndicator` on the Routine item).
- [ ] **Step 2:** Bottom tab bar `<nav>` (:47-49): add `md:hidden`; change its `aria-label` to `"Personal-Plan-Navigation (mobil)"` to keep labels unique.
- [ ] **Step 3:** In `authenticated-app-shell.tsx:23-46`, make the bottom padding compensation mobile-only (`pb-[…] md:pb-0` pattern on the same classes).
- [ ] **Step 4:** Run `npm run test:node -- ` routine-routing-nav test (`tests/routine-routing-nav.test.ts`) — update selectors if they target the nav by aria-label.
- [ ] **Step 5: Checkpoint:** screenshots /routine + /profile at 1440px and 375px to Nick, wait for 👍 before committing.
- [ ] **Step 6: Commit** `fix(nav): desktop header navigation, tab bar mobile-only`.

### Task 2.8: PR 2 verification + ship

- [ ] **Step 1:** `npm run ci:verify`; `npm run test:personal-plan`.
- [ ] **Step 2:** Full screenshot pass of the touched surfaces at 375px + 1440px; attach before/after pairs to the PR (before = audit screenshots).
- [ ] **Step 3:** Codex whole-branch review (same protocol as Task 1.7), fix real findings, `/ship`.

---

# PR 3 — Profile reads personal-plan data (branch `codex/profile-plan-overlay`, from updated main)

Read-path overlay, no backfill (two live systems keep writing independently — see spec §Profil-Sync). Precedence rule: **legacy value wins if present, plan value fills the gap** — so existing edit flows (which write legacy `hair_profiles`) stay consistent.

### Task 3.1: API — expose completed refinement answers

**Files:**
- Create: `src/app/api/personal-plan/refinement-presentation/route.ts`
- Test: `tests/personal-plan-refinement-presentation-route.test.ts`

**Interfaces:** `GET` → `{ answers: PersonalPlanRefinementAnswersV1 | null, completedQuestionIds: string[], routineProducts: RoutineProductSummary[] | null }` where `RoutineProductSummary = { categoryLabel: string; name: string; purposeLabel: string; state: "owned" | "planned"; cadenceLabel: string | null }`.

- **Answers authority (not "latest by updated_at"):** resolve the draft by binding `personal_plan_refinement_drafts.result_refined_need_version_id` to the plan's `current_refined_need_version_id` (completion updates that pointer atomically — `supabase/migrations/20260808062602_personal_plan_stage1_3_foundation.sql:310`). No matching complete draft → `answers: null`.
- **routineProducts:** the included items of the ACTIVE routine version — this is the data /profile's Produkte section will render (Task 3.3). Reuse the server loader that feeds `src/components/routine/personal-plan/routine-page.tsx` its `view` prop (follow its import from `src/app/routine/`); map basis + optional items with `state.inclusion === "included"` to the summary shape (`state: "owned"` when `item.product.kind === "owned"`, `"planned"` for planned; skip `pending_review`/`none`). `null` when there is no active routine version. Do NOT source products from `PortfolioPresentation` — it only exposes planned-purchase decision keys and `not_used` retained products (`src/lib/personal-plan/routine/portfolio-presentation.ts:15`), not the in-routine products.
- Auth + client acquisition: mirror `src/app/api/personal-plan/portfolio-presentation/route.ts` exactly (same session handling, same 401 shape, `Cache-Control: no-store`).

- [ ] **Step 1: Write the failing test** (node runner; stub the Supabase client the same way the neighboring personal-plan route tests do — copy the harness from the portfolio-presentation route test if one exists, else from `tests/product-intake-personal-plan-route.test.ts`):

```ts
test("returns the refinement answers bound to the current refined need version", async () => {
  // seeded stub: plan.current_refined_need_version_id = "rv1"; draft { result_refined_need_version_id: "rv1",
  //   answers: { towel: { material: "frottee", technique: "gentle_press" }, nightProtection: [] }, … }
  //   plus a NEWER stale draft with result_refined_need_version_id: "rv0" that must NOT win
  const res = await GET(request())
  const body = await res.json()
  assert.equal(body.answers.towel.material, "frottee")
  assert.deepEqual(body.answers.nightProtection, [])
})
test("returns null answers when no complete draft matches the pointer", async () => { /* → { answers: null, completedQuestionIds: [], routineProducts: … } */ })
test("returns included routine products of the active version", async () => {
  // stub active routine with an owned conditioner + planned shampoo + a pending_review item (excluded)
  const body = await (await GET(request())).json()
  assert.equal(body.routineProducts.length, 2)
  assert.equal(body.routineProducts.find(p => p.state === "owned").name, "Gliss Kur Aqua Revive Conditioner")
})
test("routineProducts is null without an active routine", async () => { /* … */ })
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement the route (select `answers,completed_question_ids,updated_at`, `.eq("status","complete").order("updated_at",{ascending:false}).limit(1).maybeSingle()` scoped to the user's plan via the same plan-lookup the portfolio route uses). **Step 4:** Run → PASS. **Step 5: Commit** `feat(profile): API for completed refinement answers`.

### Task 3.2: Overlay Alltag/Styling values in section-config

**Files:**
- Modify: `src/lib/profile/section-config.ts:227-327` (fields `styling_tools`, `heat_styling`, `towel_material`, `towel_technique`, `drying_method`, `night_protection`)
- Test: `tests/profile-plan-overlay.test.ts` (new)

**Interfaces:** Every field config's `getValue(profile)` becomes `getValue(profile, plan?: PersonalPlanRefinementAnswersV1 | null)`. Import the type from `@/lib/personal-plan/refinement/types`.

**Label maps — verified against the real enums:** `TowelMaterial`, `TowelTechnique`, `NightProtection` are RE-EXPORTED from `@/lib/vocabulary/onboarding-care` (values `frottee | mikrofaser | tshirt | turban_mikrofaser | no_towel`, `rough_rubbing | gentle_press`, `silk_satin_pillow | silk_satin_bonnet | loose_tied | pineapple | length_tip_accessory`) — the SAME vocabulary the legacy labels in section-config already map (`TOWEL_MATERIAL_LABELS`, `TOWEL_TECHNIQUE_LABELS`, `NIGHT_PROTECTION_LABELS`). **Reuse those maps directly; no new towel/night maps.** Only two NEW maps are needed (types verified at `src/lib/personal-plan/refinement/types.ts:37-50`):

```ts
const PLAN_DRYING_ROUTE_LABELS: Record<DryingRoute, string> = {
  air_dry: "Lufttrocknen",
  ordinary_blow_dry: "Gewöhnlich föhnen",
  diffuser_or_airflow_shaping: "Diffusor oder formender Luftstrom",
}
const PLAN_HEAT_TOOL_LABELS: Record<AdditionalHeatTool, string> = {
  dryer_brush: "Föhnbürste",
  hot_air_styler: "Heißluft-Multistyler",
  straightener: "Glätteisen",
  curling_or_wave_iron: "Lockenstab oder Welleneisen",
  thermal_rollers: "Thermo-Wickler",
}
```

- [ ] **Step 1: Write the failing tests** (plain unit tests over the exported field configs):

```ts
test("towel material falls back to plan answer", () => {
  const value = towelMaterialField.getValue(null, { towel: { material: "frottee" } })
  assert.equal(value, "Frottee-Handtuch")
})
test("legacy value wins over plan answer", () => {
  const value = towelMaterialField.getValue({ towel_material: "mikrofaser" } as HairProfile, { towel: { material: "frottee" } })
  assert.equal(value, "Mikrofaser-Handtuch")
})
test("empty additionalHeatTools reads as answered none", () => {
  assert.equal(stylingToolsField.getValue(null, { additionalHeatTools: [] }), "Keine Hitzetools")
})
test("empty nightProtection reads as answered none", () => {
  assert.equal(nightProtectionField.getValue(null, { nightProtection: [] }), "Nichts davon")
})
test("drying routes join labels", () => {
  assert.equal(dryingMethodField.getValue(null, { dryingRoutes: ["air_dry"] }), "Lufttrocknen")
})
```

(export the individual field configs or a `getFieldByKey` helper for testability if not already exported).

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per field: `legacyValue ?? planValue ?? null`, where planValue distinguishes `undefined` (unanswered → null) from `[]` (answered "none" → the "Keine …"/"Nichts davon" label). Fields WITHOUT a plan source (`brush_type`, `heat_styling`/Styling-Frequenz — no direct Feinschliff equivalent) keep their current body unchanged apart from the widened signature. **Step 4:** Run → PASS. **Step 5: Commit** `feat(profile): overlay plan refinement answers in Alltag/Styling sections`.

### Task 3.3: Wire the overlay into the profile page + Produkte section

**Files:**
- Modify: `src/app/profile/page.tsx` (:516-584 area — add a `refinementAnswers` state + fetch effect mirroring `loadPortfolioPresentation` at :560-584; pass the answers into every `getValue` call site; Produkte section rendering near :658-666)

- [ ] **Step 1:** Add `const [refinementAnswers, setRefinementAnswers] = useState<PersonalPlanRefinementAnswersV1 | null>(null)` + an effect fetching `/api/personal-plan/refinement-presentation` (`cache: "no-store"`, silent-null on failure — copy the portfolio effect verbatim, only URL/state differ).
- [ ] **Step 2:** Update the section rendering to call `field.getValue(hairProfile, refinementAnswers)`.
- [ ] **Step 3: Produkte section:** where the empty state "Noch keine Produktangaben vorhanden" renders (grid fed by `user_product_usage`, :658-666): when `user_product_usage` is empty AND the new API's `routineProducts` is non-null, render those rows instead of the empty state — `{categoryLabel} · {name} · {purposeLabel}` with a state chip (`owned` → "Vorhanden", `planned` → "Noch kaufen") and `cadenceLabel` as sub-line; change the section badge from "Offen" to "Aus deinem Personal Plan". Do NOT source this from `portfolioPresentation` — it only carries `not_used` retained products, which the separate "Nicht verwendete Produkte" block (`src/components/profile/retained-personal-plan-products.tsx:20`) already renders; rendering it twice would duplicate that list and still miss the in-routine products.
- [ ] **Step 4:** Also update the two "Vollständig/Offen" badge computations for Alltag/Styling so overlay-filled fields count as answered.
- [ ] **Step 5:** Manual verification with the field-test account (or a fresh test-quiz run): Alltag shows Frottee/sanft ausdrücken/Lufttrocknen, Hitzetools "Keine Hitzetools", Nachtschutz "Nichts davon", Produkte no longer claims "keine Angaben". Screenshot for the PR.
- [ ] **Step 6: Commit** `feat(profile): profile reflects personal-plan answers and products`.

### Task 3.4: PR 3 verification + ship

- [ ] **Step 1:** `npm run ci:verify` + `npm run test:node` (new tests included) + `npm run test:personal-plan`.
- [ ] **Step 2:** Screenshot pass of /profile (375px + 1440px), attach to PR with the audit's before-screenshot 25.
- [ ] **Step 3:** Codex whole-branch review, fix real findings, `/ship`.

---

## Explicit non-goals (deliberate follow-ups, NOT this plan)

Accepted as out of scope by Nick / deferred with reasons:

1. **Idealplan example-image placeholders** — Nick is fixing this himself.
2. **Bondbuilder engine jargon** ("Rollenbeziehung", "Kritisches Protokoll") — needs a product decision on user-facing Prüfpunkt labels; audit finding stands, own follow-up.
3. **Triple Öl review consolidation** (3 near-identical screens) — flow redesign with its own mockup gate.
4. **Shampoo catalog coverage gaps** (Gliss/Elvital/Olaplex return no shampoo hits) — content/ingestion work, not code.
5. **Catalog data cleanup** if Task 1.1 finds bad rows (relative `image_url`s, wrong `category_key`) — data follow-up; PR 1 makes the app robust against them regardless.
6. **Profile `editTarget` rerouting to Feinschliff flows** — spec suggests it; this plan keeps legacy onboarding targets, which is consistent with the legacy-wins precedence rule. Needs explicit product sign-off before changing.
7. **Styling-Frequenz / Bürste-Kamm overlay** — no plan-side data source exists; stays legacy.

## Self-review notes

- Spec coverage: blockers-investigation §Blocker 1 → Tasks 1.2–1.4 (+1.1 diagnosis); §Chat → 1.5; §Blocker 2 → 1.6; styling-fixes #1–#8 → 2.1–2.7; §Profil-Sync → 3.1–3.3; remaining audit findings → Non-goals above.
- Codex plan review (2026-08-15, effort xhigh) incorporated: 1.6 guard-ordering race + telemetry channel, 1.3 observability contract + fail-closed policy + reason-aware unresolved copy, 1.5 middleware test matrix + explicit oracle, 3.1 pointer-bound draft authority + routineProducts source, 3.2 real enum keys (shared vocabulary reuse).
- Risk: Task 1.3 changes an adapter return type — `npm run test:personal-plan-stage5` covers the consumers; Task 2.7 touches shared shell padding — verify /chat too during its screenshot pass.
