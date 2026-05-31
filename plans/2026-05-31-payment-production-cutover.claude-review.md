I now have full, definitive grounding (after correcting an early mis-probe — my first checks hit a made-up path `src/lib/payments/` and the sparse root checkout; the **worktree** holds the complete code and every file the plan names exists). Here is the review.

---

**Verdict:** Approve with revisions — the plan is accurate and well-grounded against the code; fix the items below before handing off, and strongly consider staging Stripe-live before PayPal-live.

> Grounding note: every file, env var, npm script, and webhook-event claim in the plan was verified against the worktree. The plan's "Current Production State" and "File Map" are accurate — unusually so. Findings below are about *sequencing, gaps, and a few gotchas*, not fabricated references.

---

**Lean shape**
- **Irreducible goal:** Flip production Stripe (test→live) and PayPal (sandbox→live) without breaking the checkout → webhook → entitlement-activation path, with a tested rollback.
- **Cut/defer:**
  - **Stage the two providers instead of a big-bang dual cutover.** Stripe has three contract specs (`stripe-gating`, `stripe-intervals`, `stripe-webhook-handlers` in `package.json:34`); PayPal has **zero** in any test script. PayPal already ships behind a kill-flag (`NEXT_PUBLIC_PAYPAL_ENABLED`, verified at `src/components/checkout/payment-method-checkout.tsx:24` and `src/app/api/paypal/create-subscription-intent/route.ts:24`). Leanest path: cut Stripe live, verify in prod, *then* flip PayPal — keeping PayPal `=false` until Stripe-live is proven. This halves the blast radius on the money path at no cost.
  - Otherwise the plan is **not over-engineered** — it reuses existing scripts/flags/handlers rather than inventing abstractions. Little to delete.
- **Hard tradeoff the plan avoids:** There is no fast Stripe kill-switch — rollback is "restore old env + redeploy" (Task 8 Step 4), which is slow and can't disable Stripe without breaking checkout entirely. The plan acknowledges already-created live subs need manual refund but doesn't weigh the redeploy-latency window. PayPal's flag is clean; Stripe's is not — say so explicitly.

**Prior art** (billing live-cutover patterns)
- **Test/live env isolation** — matches canonical. Task 5 Step 5 keeps Preview/Dev on test/sandbox. ✅
- **Per-endpoint webhook signing secret** — matches. Task 2 Step 5 creates a live endpoint + copies `whsec`; handler reads `STRIPE_WEBHOOK_SECRET` (`src/app/api/stripe/webhook/route.ts:240`). ✅
- **`NEXT_PUBLIC_*` baked into the client bundle → redeploy** — matches; explicitly called out (Cutover Rules + Task 6 Step 2). ✅ The bundle-assertion script (Task 6 Step 3) is a genuinely good grounded check.
- **Webhook idempotency / replay-safety** — **missing invariant.** Live webhooks retry aggressively. The plan only *observes* dashboards for "no repeated retries" (Task 7 Step 3). It never verifies handlers are idempotent on redelivery. PayPal already has `src/lib/paypal/duplicate-guard.ts`; the plan should verify a redelivered event doesn't double-activate (and confirm the Stripe side is upsert-safe).
- **SCA/3DS in live mode (EU)** — not addressed. German €-subscriptions enforce 3DS in live mode that test mode rarely exercises. Embedded Checkout (`ui_mode: "embedded_page"`, `route.ts:107`) handles 3DS automatically, so this is likely fine, but Task 7 Step 1 should explicitly run a card that triggers a 3DS challenge.

**Blockers** (will fail or regress as written)
1. **Stripe quarterly price recurrence must be `interval=month, interval_count=3`** — `src/lib/stripe/intervals.ts:8-13` *throws* `Unsupported price recurrence` for anything else, and `priceIdToInterval` (`src/lib/stripe/client.ts:20-23`) depends on it during live activation. Task 2 Step 2 only says "recurring every 3 months" — make the exact recurrence explicit, or live quarterly subs will fail activation/webhook handling.
2. **Task 2 Step 3's "preferred" path (remove coupon, set Prices to final 7.49/17.49/49.99) silently makes the marketing page lie.** `src/lib/stripe/pricing-plans.ts:6-9,20-46` hard-codes an anchor price (€14,99/€34,99/€99,99, struck through) and a `discountedPrice` labeled *"Price actually charged (50% off via the Stripe discount coupon)."* Drop the coupon and `/pricing` still advertises a 50%-off deal that Checkout no longer reflects — a German price-indication (UWG/PAngV) problem the Task 4 legal gate does **not** cover. Either keep the coupon path, or add a task to strip the anchor/strikethrough framing from `pricing-plans.ts`.

**High-confidence issues** (correctness, not preference)
- **"executing-plans / subagent" framing oversells automatability.** The header says a subagent should execute task-by-task, but Tasks 2, 3, 5, 7 require Stripe/PayPal/Vercel dashboard actions, live secrets, and *real payments* — which a subagent cannot and must not perform. This is a **human operator runbook**; only Task 1 (preflight), Task 4 (German copy edits), and Task 6 Step 3 (bundle assertion) are subagent-appropriate. Relabel accordingly so a GPT-5.4 subagent doesn't hallucinate dashboard steps.
- **No verification that Customer.io lifecycle events propagate with live data.** The Stripe webhook fires Customer.io syncs (`src/app/api/stripe/webhook/route.ts:121-227` via `buildCustomerIo*Sync`). If Customer.io has its own test/prod split, live activation emails could vanish. Add a Task 7/8 check that the live event reached Customer.io.
- **Task 1 Step 3 calls `test:playwright:contracts` "payment-adjacent," but it contains only Stripe specs** (`package.json:34`) — no PayPal coverage. A green run is not PayPal validation; note this so it isn't over-trusted.

**Smaller / nice-to-haves**
- Task 4 Step 3 uses `typecheck` + `lint`; the project's standard finish is `npm run ci:verify` (adds `build`, `package.json:12`). Use it for parity with CI/CLAUDE.md.
- Memory flagged a pricing question (€14.99/€34.99/€99.99 from 2026-04-19) — **resolved, no action**: those are the anchors; live charged prices are 7.49/17.49/49.99 via coupon. PayPal plan shapes match exactly (`src/lib/paypal/plans.ts:18-22`). Both confirmed accurate.
- Plan omits the existing `src/app/api/stripe/session/route.ts` from "Current Production State" — harmless (not webhook-related), just noting the inventory isn't exhaustive.
- PayPal webhook handler (`src/lib/paypal/webhook-handlers.ts:52-64`) registers more events than Task 3 Step 2's dry-run list implies it handles — the superset is fine, but confirm the live webhook is created with the full event set the handler switches on.

**Bottom line**
This is a solid, accurately-grounded cutover runbook — rare in that its file/env/script/event claims all check out. It's safe to execute by a **human operator** after: (1) pinning the Stripe quarterly recurrence to month×3, (2) resolving the coupon-vs-pricing-page inconsistency, (3) relabeling it as an operator runbook rather than subagent-executable, and (4) adding idempotency + Customer.io propagation checks to the smoke tests. The single highest-leverage change is **sequencing Stripe-live before PayPal-live** rather than a simultaneous big-bang — PayPal is the less-tested path and already sits behind a verified kill-flag, so there's no reason to take both risks at once.

Want me to spec the leaner staged-cutover counter-proposal (Stripe-live first, PayPal-live as a gated follow-up) so you can compare side-by-side?
