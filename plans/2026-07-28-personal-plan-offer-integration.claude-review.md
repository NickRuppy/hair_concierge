**Verdict:** Approve with revisions — do not dispatch to subagents until the six blockers below are written into the plan and the two shape decisions are settled by the owner.

Gate status: mockup confirmed (2026-07-28); designed-journey sign-off still pending, so per `CLAUDE.md` `executing-plans` / `subagent-driven-development` remain blocked, and `branch-gate` runs first regardless.

---

## Lean shape

**Irreducible goal:** a paid-ad visitor completes the V2 quiz, sees a personalized-but-locked offer on a lead-bound route, buys the existing subscription, and lands in onboarding → Routine with their diagnostics attached to the account.

**Cut / narrow / defer candidates**

1. **The anonymous prepared-artifact table and its claim machinery.** This is the largest new mechanism in the plan (new table, hashed claim token, answer hash, expiry, revocation, atomic claim function, replay tests — Task 3 plus large parts of Tasks 4, 5, 7). Everything it stores is a *pure deterministic function* of answers that are already persisted on the lead: `leads.quiz_answers` holds the full V2 envelope, and `save_personal_plan_lead` already dedupes on exact `jsonb` answer equality under an advisory lock (`supabase/migrations/20260728120000_add_leads_quiz_kind.sql:37-52`). The plan itself says the post-payment plan is re-derived from `hair_profiles` + onboarding by the routine engine (lines 91-94), so the *locked* half has no pre-payment consumer at all. Storing a recomputable value **before** the row it belongs to exists is what forces the claim credential, the answer hash, the expiry, the revocation, and the "artifact belongs to this lead" proof into existence. Narrow: keep the loading-screen storytelling and the "no email step until computation succeeds" gate (a prepare endpoint that validates and returns `{ok:true}` with no storage gives you that), compute the public offer model server-side in `/result/[leadId]` from the lead's own answers, and — only if a frozen baseline is genuinely required — write it as a column at lead-save time, where identity is already settled.
2. **The `/plan-bereit` route as a separate page.** The 6–8s future-pacing screen adds a third post-payment state machine and forces edits across `welcome`, `checkout-success-redirect`, `set-checkout-password`, `send-magic-link`, `auth/confirm`, `auth/callback`, and `auth/actions` — which is precisely the risk the plan flags at line 602 ("all first-time auth return variants must converge or some buyers will skip it"). Every one of those paths *already* converges on `/onboarding` (`src/lib/billing/checkout-success-redirect.ts:4`). Rendering the three messages as the first step inside `onboarding-flow.tsx` deletes that risk instead of mitigating it.
3. **`/lp/[slug]/angebot` (lines 61, 284-286).** Never shipped (flag off, package `status: "placeholder"`), and the plan removes its only caller (`src/components/personal-plan-quiz/personal-plan-quiz.tsx:1354`). "Retain a safe fallback" is future-proofing for a URL with no traffic. Delete it.

**Hard tradeoff the plan is avoiding:** analytics parity vs. the locked-plan secrecy invariant. The plan asks for both "V2 result/offer/checkout analytics parity" (line 205) and "locked product names … absent from the browser payload" (journey step 8). `OfferTrackingProvider` cannot deliver both — see Blocker 5.

---

## Prior art

| Mechanism | Canonical shape | Verdict |
|---|---|---|
| Anonymous prepare → claim → attach | Claim-check / pre-registration token: single-use, hashed at rest, TTL, **idempotent** claim, GC for unclaimed rows | Has hashing/TTL/single-use/atomic claim. **Missing:** idempotent re-claim semantics and who deletes expired rows ("expiration" is named, deletion is not) |
| Lead dedupe | Serialize on business key inside one transaction | RPC already does advisory-lock + natural-key match ✓. The new attach must run **inside** the same RPC or the reuse branch isn't atomic; the plan splits it across route + "attach function" without saying which owns the transaction |
| Feature rollout | flag → kill-switch → independently revertible | `PERSONAL_PLAN_QUIZ_V1_ENABLED` exists ✓, but Task 9 (onboarding → `/routine`) and Task 7 (linker) change shared paths **outside** that flag with no rollback |
| Schema migration | expand → backfill → contract | New table is pure expand ✓. `leads.quiz_kind DEFAULT 'legacy'` + four `.eq("quiz_kind","legacy")` filters is the classic default-footgun; the plan addresses one of them |
| Typed event map + per-destination adapters | New surfaces enter the typed union and the ordering table | Not done — see Blocker 6 |

---

## Blockers (hard technical defects — will fail or regress as written)

1. **`calculateHairPotential` returns `null` for exactly the "unknown" answers V2 offers.** `src/lib/quiz/hair-potential.ts:249` gates on `isCompleteSupportedAnswers` (`:55-79`), which requires `pulltest ∈ {stretches_bounces, stretches_stays, snaps}` and `scalp_type ∈ {fettig, ausgeglichen, trocken}`. V2 lets users pick `elasticResponse: "unknown"` ("Ich bin mir nicht sicher") and `scalpOiliness: "unknown"` ("Ich kann das schwer einschätzen") — `src/lib/personal-plan-quiz/persistence.ts:37,42`, `src/components/personal-plan-quiz/quiz-data.ts:408,433`. Plan line 252 ("record neutral fallbacks rather than fabricate precision") is fuzzy exactly where the code is binary: leave the field unset and there are **zero** diagnostic rows, so the offer's core section is empty. *Fix:* name the concrete substitutions (e.g. `unknown → stretches_bounces`, `unknown → ausgeglichen`) plus the recorded fallback flag, and make each a row in Task 1's matrix.
2. **The same `unknown` values break post-payment intake state.** `hasCompletedQuizDiagnostics` requires non-empty `protein_moisture_balance`, `scalp_type`, `density`, `cuticle_condition`, `hair_texture`, `thickness`, non-empty `chemical_treatment`, and a `concerns` array (`src/lib/quiz/completion.ts:24-40`). Null those out and `resolveIntakeState` returns `needs_quiz` (`src/lib/auth/intake-state.ts:24-28`), which redirects a **paying** V2 customer from `/routine` or `/chat` into the **legacy** `/quiz` (`intake-state.ts:53`). Task 7's criterion "V2 becomes `needs_onboarding`" (line 488) is correct but the plan never says the fallbacks are what makes it true.
3. **`linkQuizToProfile` has 7 call sites; the target map lists 4 and omits the password path.** Missing: `src/app/api/auth/set-checkout-password/route.ts:210,237,246` (this *is* Task 8's "password creation"), `src/app/api/auth/callback/route.ts:22`, `src/app/auth/actions.ts:19`. Each one left legacy-only silently no-ops for a V2 lead, because the function filters `quiz_kind === "legacy"` in all three lookup branches (`src/lib/quiz/link-to-profile.ts:119,130,139`) and returns without error.
4. **`offer_engaged` also filters legacy.** `src/app/api/analytics/offer-engaged/route.ts:137` has the same `.eq("quiz_kind","legacy")` guard as `meta-offer-view/route.ts:213`, but only the latter is in the plan's analytics map. V2 engagement will 404 into Customer.io silently. (`src/app/api/quiz/result-artifact/route.ts:164` and `src/lib/customerio/result-artifact-service.ts:73` carry the same filter — covered by the V2-email non-goal, but say so explicitly so it reads as intent, not oversight.)
5. **`OfferTrackingProvider` puts product identity into the browser payload.** It *requires* `trackingIdentity: {conditionerModuleId, needLane, shampooModuleId, suggestedCategory}` (`src/components/quiz/offer-tracking-provider.tsx:42-47,79-113`), and that context is spread into every emitted event and the React context. Passing real module IDs leaks the locked selection to devtools, contradicting journey step 8 and the manual check at line 545. Passing nulls satisfies secrecy but drops `needLane` — the dimension the existing funnel dashboards slice on. The plan must state which loses.
6. **New offer sections/CTAs won't typecheck, and their indices will be wrong.** `OfferSectionId` and `OfferCtaId` are closed unions (`src/lib/analytics/events.ts:34-60`), and `resolveOfferSectionIndex` falls back to `DEFAULT_SECTION_ORDER` for an unrecognized variant, returning `order.length` for any section not in it (`src/lib/analytics/offer-section-order.ts:58-68`). The V2 offer's sections (before/after pair, diagnostic rows, value stack, method, survey proof) need union entries plus a `PERSONAL_PLAN_SECTION_ORDER`. Neither file appears in the plan.

---

## High-confidence issues (correctness, not preference)

7. **The concern/goal reduction is a taxonomy translation, not a "limit".** `sortConcerns` keeps the first 3 in **`QUIZ_CONCERN_VALUES` order, not user order** (`src/lib/quiz/normalization.ts:65-73`); `normalizeGoals` caps at 5 and re-emits in `GOALS` order with a `volume`/`less_volume` mutual exclusion (`:83-105`). And the vocabularies are not nested: 4 of 8 V2 concerns — `low_shine`, `lost_shape`, `low_volume_or_weighed_down`, `scalp_imbalance` — have **no** legacy concern at all (`normalization.ts:15-22`), so they can only enter the engine through goals; `volume_balance` maps ambiguously onto the mutually exclusive `volume`/`less_volume`. Plan line 251 ("rank/reduce … deliberately") hides a ~20-row mapping table that belongs *in* the plan, not in a subagent's judgment — this choice directly determines which three priorities the user sees.
8. **Task 9 changes `/chat` → `/routine` for every user, not just V2**, at `src/components/onboarding/onboarding-flow.tsx:534` and `src/app/onboarding/page.tsx:176`, with no flag and no rollback (the V2 flag doesn't cover it). It also leaves `getAuthenticatedAppRedirect` sending "ready" users at `/auth` to `/chat` (`src/lib/auth/intake-state.ts:43`), so the destination becomes inconsistent.
9. **Scope contradiction on the transition route.** Line 166 says "**All** first-time successful purchase paths converge"; Task 8 line 492 says "first-time **V2** purchasers". A subagent can implement either, and the global reading silently changes legacy post-payment behavior. Related: `getAuthenticatedCheckoutSuccessRedirect(onboardingCompleted, reactivationReturnDestination)` (`src/lib/billing/checkout-success-redirect.ts:1-7`) has no lead or quiz-kind input — the plan never says how it learns the purchase was V2.
10. **Deferred linking is real and the readiness screen must survive it.** The Stripe webhook path runs with `profileLinkMode: "defer"` (`src/app/api/stripe/webhook/route.ts:292,332`). The "still settling" state is the right instinct; name deferral as the cause and define poll interval, timeout, and what happens *after* the timeout (currently only "retry").
11. **Idempotent re-claim is unspecified.** `save_personal_plan_lead` reuses a lead for identical answers within 15 minutes. After the plan's one automatic retry, the browser may hold a second claim credential for an equivalent artifact while the lead already has one attached. First-wins vs last-wins isn't stated; a naive unique-constraint attach turns a normal retry into a 500 on a route the plan requires to stay retryable (line 237).
12. **`durableAnswersSchema` is not exported** (`src/lib/personal-plan-quiz/persistence.ts:25`), and the prepare endpoint needs it. State that the answer hash is computed over `canonicalizePersonalPlanAnswers` output (`persistence.ts:104-122`) on **both** endpoints — otherwise the Node-side hash and the RPC's `jsonb` equality dedupe can disagree on optional keys (`scalpDetail`).
13. **Overlay flag not accounted for.** `isOfferPaymentOverlayEnabled()` reads `NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED` (`src/lib/funnel/flags.ts:23`); with it off, `openCheckout` renders inline and calls `scrollInlineCheckoutIntoView()` (`src/components/quiz/result-offer-pricing.tsx:264-269`). Journey step 9 ("opens the same payment overlay … without scrolling") assumes it on. Either declare the flag a precondition or specify sticky-CTA behavior when it's off.
14. **`src/funnels/packages.json` is not in the target map.** `meta_personal_plan_v1` is `"status": "placeholder"` with `"offerVariant": "default"` (`:27-32`). Since V2 deliberately bypasses the offers registry, say that `offerVariant` stays inert, whether `status` flips at publication, and that `npm run funnel:check` still passes.
15. **Nothing on this branch is committed.** `git rev-list --left-right --count origin/main...HEAD` → `3 0`: three commits behind, zero ahead, with the entire accepted quiz implementation sitting in the working tree. `git diff origin/main...HEAD` — the mandated whole-branch Codex review in `CLAUDE.md` — is **empty**, and there is no rollback point behind "preserve them" (line 579). Commit the accepted quiz work before any task dispatch.

---

## Smaller / nice-to-haves

- Line 260 lists `src/lib/quiz/offer-preview.ts` as reused, but none of the four named functions live there — `deriveGuidedStoryNeedProfile` is `src/lib/quiz/guided-story-products.ts:70`. Either drop it or name `buildQuizOfferPreview` (`offer-preview.ts:241`).
- `buildGuidedStoryProductCards` (`guided-story-products.ts:229`) returns cards carrying `name` and `imageUrl`. Make Task 1's serialization test assert on the actual HTTP response body and rendered HTML, not just the TypeScript type.
- The band table covers `HairPotentialValue` (40…100 step 5) exactly ✓. But "Dein Potenzial" is implicitly always 3/3 — worth stating, since it's a claim shown to a user whose today-value is 40.
- `npm run test:node` = `tsx --test tests/*.test.ts tests/*.test.tsx` ✓. The "V2 happy-path browser fixture" needs a Playwright-visible name: `playwright.config.ts:20-21` uses `testDir: ./tests` with `testIgnore` on `*.test.ts(x)`, so it must be `tests/<name>.spec.ts`.
- Memory cross-check: `project-offer-page-redesign` records "NO score (dropped, don't reintroduce)" — the thirds-without-an-overall design honors that ✓. `feedback-coral-usage-rule` applies to the new component: coral for CTA/pill accents only, plum for selected option-card states.

---

## Decisions the owner must make (not choices I should make for you)

| # | Decision | Options | Consequence |
|---|---|---|---|
| A | Does the plan need to be frozen **before** email capture? | Keep the anonymous artifact / recompute from `leads.quiz_answers` at render | Keeping it costs a table, claim tokens, hashes, expiry, revocation, replay tests and ~1.5 tasks. Dropping it removes the entire security surface but loses a literal "prepared before you gave us your email" snapshot |
| B | Separate `/plan-bereit` route, or first step inside onboarding? | Route / in-flow step | The route needs 7 auth-return call sites to converge (Blocker 3's file list); the in-flow step needs zero |
| C | Analytics identity vs. locked-plan secrecy (Blocker 5) | Real module IDs / nulls / a coarse non-reversible lane label | Real IDs break the plan's own secrecy invariant; nulls break existing funnel segmentation |
| D | Is `/chat` → `/routine` global or V2-only? | Global product change / flag-gated V2-only | Global also changes every legacy customer's onboarding exit with no kill-switch |
| E | Does the transition apply to **all** first-time buyers or only V2? (lines 166 vs 492) | All / V2-only | Determines whether `checkout-success-redirect` needs a quiz-kind input at all |
| F | V2 concern/goal → legacy mapping table, incl. `volume_balance` → `volume` vs `less_volume` and where the 4 unmapped V2 concerns land | Owner-authored table in the plan | This choice picks which three diagnostic rows the user sees — it is a product decision, not an implementation detail |

---

## Bottom line

The architecture is sound: one canonical result route with an explicit `quiz_kind` dispatch, reuse of the deterministic gold standard, and no new payment surface are all the right calls, and the plan's own risk list is unusually honest. But it is not yet safe to hand to subagents. Six blockers are hard defects against the current code — two of them (`unknown` elasticity/scalp killing both the diagnostic rows and the intake state) would ship a paying customer into the legacy quiz, and one (`OfferTrackingProvider`'s required product identity) is an unresolved conflict between two of the plan's own stated invariants. Write those six into the plan with the concrete values and file lists above, settle decisions A–F, commit the working tree so the branch is reviewable and revertible, and this becomes executable. Decision A is the one worth ten minutes before anything else: if the artifact doesn't need to predate the lead, roughly a third of this plan disappears.

Want me to spec the leaner counter-proposal (no anonymous artifact, transition folded into onboarding) so you can compare it side-by-side before the journey walkthrough?
