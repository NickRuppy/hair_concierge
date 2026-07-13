Grounding complete — every file, script, and contract the plan cites has been read. Here is the verdict report.

---

**Verdict:** Approve with revisions — no re-shape needed; fix the listed items before handing to an executor.

**Lean shape**

- Irreducible goal: stop shipping vendor SDK + Supabase auth code in the first-load JS of public pages; capture events in a short-lived memory queue and flush after first paint, with zero change to event contracts.
- Cut or defer: nothing significant. The plan already deletes well (no tag manager, no storage-backed outbox, no Partytown, legal pages removed from the workstream after verification). The new public-context module (Phase 1) and per-destination FIFOs (Phase 2) are each justified by a verified current defect — `FunnelContextBootstrap` imports the PostHog singleton (`src/providers/funnel-context-bootstrap.tsx:5`) whose module init is a side effect (`src/providers/posthog-provider.tsx:12-19`).
- Hard tradeoff the plan is avoiding: rollback. There is no kill-switch and no stated rollback strategy anywhere in the plan (see Blockers #3).

**Prior art**

- Queue-until-SDK-ready: matches the canonical snippet/stub queue pattern (`fbq.queue`, analytics.js buffering) and explicitly reuses the in-repo Meta implementation (`src/lib/meta-pixel.ts:154-182`) — OK. One factual error: the plan calls Meta's existing queue "bounded" (Target Architecture, Meta bullet); it is unbounded (`meta-pixel.ts:160-166` pushes with no cap). Harmless in practice, but correct the wording so the executor doesn't hunt for a bound that isn't there.
- Multi-destination event router: typed event map ✓ (`src/lib/analytics/events.ts`), per-destination adapter ✓ (`src/lib/analytics/destinations/`), per-destination filtering ✓ (`src/lib/analytics/routes.ts:9-23`), consent gate per destination ✓, idempotency on revenue events ✓ (Meta purchase `eventID` + sessionStorage dedupe, `meta-pixel.ts:437-476`), sync fire-and-forget API ✓ (`track-app-event.ts:27`). Missing invariant vs. the canonical funnel-rollout shape: **kill-switch / feature flag** — despite an established in-repo flag pattern (`src/lib/funnel/flags.ts`).

**Blockers** (would cause silent metric drift or arbitrary executor choices — not crashes)

1. **Goal statement contradicts Agreed Decision 2.** The goal says "without intentionally changing tracking coverage," but Phase 1 removes PostHog `$pageview`, Meta PageView, and Customer.io page tracking from Methodik and 404 — both currently emit all three via `EditorialShell` → `LandingTracking` (`src/components/editorial/editorial-shell.tsx:5,10` → `src/providers/route-providers.tsx:57-67`). The decision itself is fine (it's explicitly agreed), but the goal line will mislead both the executor and the Phase 4 step 7 post-deploy volume check, where `/methodik` pageview volume dropping to zero would read as a regression. Fix: reword the goal and add the expected volume deltas to the post-deploy checklist.
2. **`landing_viewed` on Methodik is ambiguous, and an executor will resolve it arbitrarily.** `LandingTracking` hardcodes the `landing` prop (`route-providers.tsx:62`), so today every Methodik view *and every 404* POSTs a `landing_viewed` funnel milestone (`funnel-context-bootstrap.tsx:10` → `src/lib/funnel/client.ts:34-47`), inflating the funnel denominator. "Lightweight first-party funnel continuity" (Decision 2) vs. "preserve continuity where already applicable" (Phase 1 task 3) doesn't say whether Methodik keeps recording that milestone. Either answer changes a metric: keep it and only the 404 pollution disappears; drop it and landing→quiz conversion improves artificially. The plan must state the choice explicitly (owner decision — see Tradeoffs).
3. **No rollback/kill-switch statement.** Phases gate each other pre-merge, but once deployed there is no way to restore eager loading other than git revert + redeploy. Either add an env flag using the existing `src/lib/funnel/flags.ts` pattern, or state explicitly that revert-only rollback is accepted. Silence is the only wrong option on a revenue-attribution path.

**High-confidence issues** (correctness, not preference)

- **The PostHog proxy must queue, not no-op.** `$pageview` is captured directly via the singleton (`posthog-provider.tsx:29`), not via `trackAppEvent`, so Phase 2 task 1's FIFO ("behind `trackAppEvent(...)`") does not cover it. Task 9's "readiness/proxy contract" could legally be implemented as no-op-until-ready, silently dropping pre-ready pageviews, `identify`, and `register` calls. Make explicit: the proxy queues `capture`/`identify`/`register`; only `get_session_id` may return undefined pre-ready (the feedback widget already tolerates that, `src/components/feedback/feedback-widget.tsx:105-108`). The Phase 0 runtime tests should name `$pageview` in the protected event matrix.
- **Phase 0's baseline run will exit 1 and look broken.** `scripts/perf/mobile-lighthouse.mjs:113-115` exits non-zero when thresholds fail, and the 2500ms default (`:19`) is guaranteed to fail at the current 5-7s LCP. The plan says "record raw values" but doesn't mention `LH_FAIL_ON_THRESHOLD=0` (`:15`). One line saves an executor a confused debugging detour.
- **"Reachable offer/result surface" has no recipe.** Result routes require a real `leadId` (`src/app/result/[leadId]/page.tsx`); the plan never says how to obtain one for bundle/Lighthouse measurement (complete a quiz first? seeded lead?). Specify the exact procedure or the executor will skip the surface.
- Useful context for task 8 (breaking the `useAuth` chain): the `!context` guard never fires — `createContext` receives a full default (`src/providers/auth-provider.tsx:17-23`), so outside `AuthProvider`, `useAuth` silently returns `loading: true` forever. Public-page identify components are already no-ops; removing the import chain won't surface hidden runtime errors, but the Supabase bundle chain is real (`auth-provider.tsx:3-4` imports Supabase client + server action at module level).

**Verified as correct** (claims I expected to be wrong but weren't)

- `.next/diagnostics/route-bundle-stats.json` is a real Next 16.2 build artifact, written unconditionally (`node_modules/next/dist/esm/build/index.js:2541`). The stale root `.next` lacks it only because no full build ran there recently.
- Legal pages (`datenschutz`, `agb`, `impressum`, `kontakt`, `widerruf`) are genuinely tracking-free — no shell/provider imports.
- `purchase_completed` → Customer.io is intentionally routed off (`routes.ts:16`), matching Phase 3 task 4's warning; the dead mapping in `destinations/customerio.ts:32-42` is unreachable via routing.
- `ready-check` / `request-code-review` are defined workflow lanes in `AGENTS.md:10-16`, with an explicit fallback rule (`AGENTS.md:5`) if the personal skill is absent.
- All 30+ cited file paths, all four test files, and all three npm scripts exist; `analytics-tracking.test.ts` is destination-spy based and `acquisition-funnel-tracking.test.ts` is 100% source-regex (`tests/acquisition-funnel-tracking.test.ts:9-40`), exactly as the plan characterizes them. `tests/editorial-pages.test.tsx:42` asserts `<LandingTracking />` stays in the editorial shell and will correctly fail in Phase 1 — the plan lists that file.

**Tradeoffs — decisions the owner (Nick) must make, not the executor**

1. **Methodik `landing_viewed`** (Blocker 2): keep recording the milestone on Methodik (status quo, inflated denominator) or drop it (cleaner funnel, but landing→quiz conversion visibly improves for a non-product reason — annotate dashboards). Pick one and write it into the plan.
2. **Rollback posture** (Blocker 3): env-flag kill-switch vs. revert-only. Flag costs ~an hour and matches `funnel/flags.ts` precedent; revert-only is defensible given phase gating, but must be stated.
3. **Sentry scope.** `instrumentation-client.ts` ships Sentry on every public page; the plan attributes its bytes (Phase 0 step 5) but takes no action. If attribution shows Sentry is a top-2 contributor, is trimming/lazy-loading it in scope or a follow-up? Decide before Phase 0, or the 25% target may be un-hittable for reasons the plan pre-declared out of scope.
4. **PostHog stays consent-ungated** (Decision 9 / Rejected list). Consistent with the recorded backlog position (TTDSG § 25 risk tracked separately since May 2026) — no change requested, just confirming this remains a deliberate, still-open risk.
5. **Offer-page redesign collision.** Per project memory, the offer-page redesign (3 mockup variants, July 2026) is pending a variant decision and touches the same result/offer surfaces as Phase 3. Decide sequencing so two branches don't rewrite `result-offer-pricing`/offer variants concurrently.

**Smaller / nice-to-haves**

- Correct "bounded queue" → "unbounded queue" in the Meta prior-art bullet (see Prior art).
- Phase 3's likely-files list omits `src/app/pricing/` even though task 3 verifies pricing/checkout-start events; add it or note pricing is verification-only.
- Mention that browser smoke via dev server needs a restart after deep-lib changes (known stale-hot-reload issue in this repo); production-build verification is unaffected.
- Phase 2 gate "medians materially improve" is the one fuzzy criterion in an otherwise contract-grade plan; consider borrowing Phase 4's numbers (e.g., "vendor chunks absent + ≥15% first-load reduction on `/`").

**Bottom line**

This is an unusually well-grounded plan — every load-bearing code claim checked out, the queue mechanism matches canonical prior art it correctly identifies in-repo, and the phase gates are real contracts. It is not ready to hand to a fresh executor yet for three reasons: the goal statement denies a coverage change that Decision 2 makes, the Methodik `landing_viewed` question will be resolved arbitrarily by whoever implements Phase 1, and there is no stated rollback posture. Fix those three (plus the PostHog proxy-must-queue clarification and the two Phase 0 executor traps), and this ships as-is.
