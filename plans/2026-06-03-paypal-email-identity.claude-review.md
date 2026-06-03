I have enough grounding across all 8 tasks. Memory pre-check: `MEMORY.md` records the hard-paywall/subscription direction and the just-shipped manual access grants, but nothing that settles or contradicts PayPal identity decisions — no conflict. Here is the verdict.

---

**Verdict:** Approve with revisions — the architecture is correctly shaped, but **3 blockers must be fixed before this goes to a subagent**. Executed verbatim today it would (a) leave a real activation path on the wrong identity, (b) fail `npm run test:node`, and (c) write a conflicting auth prop against code that already does the job.

---

**Lean shape**

- **Irreducible goal:** PayPal activation creates/links the app account under the *Chaarlie* email (intent/lead), stores the PayPal email as provider metadata only, and blocks duplicate checkout by Chaarlie identity (not PayPal email) with a modal + login link.
- **Cut or defer:**
  - **Task 4 (Auth Prefill) is ~90% already built.** `AuthForm` already accepts `defaultEmail` (`src/components/auth/auth-form.tsx:11,75`) and `src/app/auth/page.tsx:130` already passes `defaultEmail={searchParams.get("email") ?? undefined}` with no auto-send (magic link requires a button click, `auth-form.tsx:309-315`). Collapse Task 4 to "add a regression test" — do **not** add the new `initialEmail` prop or a server `searchParams` read (the page is a `"use client"` component using `useSearchParams()`, so the plan's Step 2/3 are wrong and would create a duplicate, conflicting prop).
  - **Task 7 (audit/backfill scripts)** is already marked optional and is off the critical path — defer to a fast-follow.
  - **Task 6 (admin visibility)** is a support nice-to-have and is under-specified ("Decide display surface during implementation") — trim or defer; it shouldn't gate the identity fix.
- **Hard tradeoff the plan is avoiding:** PayPal activation has **two** entry points — the token path (`ensurePayPalCheckoutAccountForToken`) *and* the webhook (`webhook-handlers.ts:206`). The plan only addresses the token path. Threading the Chaarlie email through both callers is the actual hard part, and it's silently skipped.

**Prior art**

- **Provider-identity separation** (app identity vs payment-provider identity): matches the canonical shape — keep app login on `profiles.email`/Auth, store provider email as separate metadata. Grounded and correct.
- **Duplicate prevention keyed on stable app identity, not provider-supplied identifier:** correct direction. **Missing invariant:** the key must be applied *consistently* across all three guard sites — `findPayPalCheckoutDuplicateReason` (`duplicate-guard.ts:32`), the activation-time guard `assertNoDifferentCurrentSubscription` (`checkout-activation.ts:175`), and the webhook (`webhook-handlers.ts:186`). The plan only names the first.
- **Schema migration = additive expand:** nullable column, no backfill-then-contract needed, reversible. No feature flag required for an additive nullable column. Migration filename `20260603120000_…` correctly sorts after the latest (`20260602120000_…`). Good.
- **Controlled dialog overlay:** `src/components/ui/dialog.tsx` exports `Dialog/DialogContent/DialogFooter/DialogTitle/DialogClose` with `open`/`onOpenChange` — the plan's `ActiveSubscriptionDialogProps` matches exactly. Grounded.

**Blockers** (will fail or regress as written)

1. **Webhook activation path is omitted — defeats the core goal on a real path.** `webhook-handlers.ts:206` calls `ensurePayPalCheckoutAccount(subscription, …)` directly (not the token wrapper) and can be the *first* to create the account if `BILLING.SUBSCRIPTION.ACTIVATED` lands before the user returns to `/welcome`. The plan's Target File Map and Tasks 2/3 never list `src/lib/paypal/webhook-handlers.ts`, so webhook-activated accounts would still be created under the PayPal email. **Fix:** add `src/lib/paypal/webhook-handlers.ts` to scope; set the Chaarlie account email from `boundIntent?.email` at the `:206` call site.

2. **The identity snippet references a variable that isn't in scope.** Plan Task 2 Step 3 shows `const accountEmail = intent.email ?? valid.email` placed inside `ensurePayPalCheckoutAccount` — but `intent` does not exist there; only `subscription` + `deps` (`PayPalCheckoutActivationDeps`, `checkout-activation.ts:19-28`) are in scope. A subagent pasting this gets a compile error, or "fixes" it by only editing the token wrapper. **Fix:** add `accountEmail?: string | null` to `PayPalCheckoutActivationDeps`, set it in *both* `ensurePayPalCheckoutAccountForToken` (from `intent.email`, `:92`) and the webhook (from `boundIntent?.email`), then `const accountEmail = deps.accountEmail ?? valid.email` inside `ensurePayPalCheckoutAccount`.

3. **Removing the PayPal-email duplicate branch breaks existing passing tests, and the plan never updates them.** Task 3 Step 2 deletes the `paypal_email_already_has_access` branch (`duplicate-guard.ts:46-53`), but `tests/billing-paypal-server.test.ts:809-816` explicitly asserts that reason (`"PayPal duplicate guard checks intent user, intent email, and provider email"`), with the literal reused at lines 839/854/868/875/882/888. Task 8 runs `npm run test:node`, which will fail. **Fix:** add `tests/billing-paypal-server.test.ts` to Task 3's file list and update/remove those assertions.

**High-confidence issues** (correctness, not preference)

- **The Stripe-side modal is in the wrong owner and is "Possibly edit," not optional.** The Stripe 409 is detected inside `fetchClientSecret`, which lives in **both** parents — `pricing-cards.tsx:76-79` and `result-offer-pricing.tsx:87-90` — each currently does `setCheckoutError(generic); throw`. `PaymentMethodCheckout` only receives `fetchClientSecret` as a prop and can't see the 409. So "prefer owning modal state in `PaymentMethodCheckout`" (Task 3 Step 5) can't capture the Stripe path without new callback plumbing from both parents. Both files are **required** edits, not "possibly," and each needs to parse `409 + body.email` and lift modal state. Also: with PayPal enabled the embedded card checkout is collapsed by default (`payment-method-checkout.tsx:55-56`), so the Stripe modal only fires after the user expands "Karte, SEPA & weitere" — call out that trigger timing.
- **PayPal duplicate has two UX outcomes that the plan doesn't reconcile.** On approval-time duplicate, `paypal-subscription-button.tsx:89` currently `window.location.assign(buildPayPalWelcomeUrl(token))` → the full-page "Abo bereits aktiv" screen (`welcome-client.tsx:210-227`). Task 3 wants a modal instead. The plan must say whether the approval-duplicate redirect is replaced by the modal or kept; otherwise you ship two conflicting duplicate UIs. Also, neither `createSubscriptionIntent` (throws on 409, `:127`) nor `approveSubscriptionIntent` (`:151`) surfaces `body.email` today — both must parse it for the modal's `/auth?email=` link.
- **Stripe 409 body has no `email` and the route exposes it inconsistently.** `create-checkout-session/route.ts` returns `{ error: "checkout_access_already_exists" }` with no email (`:143,:168`). To honor the mockup's email link you must add email at both conflict sites — but the user-id conflict (`:53`) only has `user.email`, while the lead conflict (`:76`) has `customerEmail`. Spell out which email each branch returns (matches the plan's "only context-known email" rule, but the code split isn't noted).
- **`assertNoDifferentCurrentSubscription` already enforces Chaarlie-identity blocking but is never mentioned and is now mislabeled.** After the identity change it keys on the Chaarlie-email account's `userId` (`checkout-activation.ts:144,148,180`) — which is exactly the desired semantics — yet its error text says "PayPal subscriber email already has a current subscription" (`:186`). Note it in scope and fix the message, or the plan's claim that duplicate semantics move to Chaarlie identity is only half-true.

**Smaller / nice-to-haves**

- **`provider_subscriber_email` can be nulled out by later webhooks.** Task 2 Step 2 always emits `… ?? null`, so a `CANCELLED`/`EXPIRED` webhook whose payload lacks `subscriber.email_address` would overwrite a stored value (the merge-preserve in `upsertBillingSubscription:36-45` only helps when the *key is absent*, and it never will be). Either omit the key when null, or preserve `existing?.provider_subscriber_email` explicitly.
- **`assertActivePayPalSubscription` hard-requires the PayPal email** (`checkout-activation.ts:211-217`), which contradicts the plan framing PayPal email as an optional "last fallback." Fine in practice (PayPal always sends it), but note the inconsistency so no one designs around an optional PayPal email.
- **Task 6 admin query** currently selects `profiles, hair_profiles(*)` only (`api/admin/users/route.ts:32-34`); embedding `billing_subscriptions(...)` requires the PostgREST relationship to resolve. Specify the embed rather than "extend admin query."
- **Task 1 Step 4 is accurate but worth pinning:** `findVisibleBillingSubscriptionForUser` uses an *explicit* select string (`subscriptions.ts:105-107`) so the new column must be added there; `findCurrentBillingSubscriptionForUser` uses `select("*")` (`:79`) and needs no change. The plan gets this right — keep it.
- **i18n:** all new copy (modal, `Chaarlie-E-Mail`/`PayPal-E-Mail`, "Verlängerung gekündigt, Zugang bis …") is German and consistent with existing strings. Good.

**Bottom line**

The shape is right and most claims are well-grounded — but don't hand it to a subagent yet. Fix the three blockers first: (1) bring `webhook-handlers.ts` into scope and thread the Chaarlie email through it, (2) rewrite the identity snippet to pass `accountEmail` via `deps` from both callers instead of referencing an out-of-scope `intent`, and (3) add `tests/billing-paypal-server.test.ts` to the duplicate-guard task so `npm run test:node` stays green. Then tighten the Stripe/PayPal modal wiring (both parent components are required, reconcile the approval-duplicate redirect vs modal, add `email` to the 409 bodies) and collapse Task 4 to a verify-plus-test since the prefill already exists. With those, it's ready.

Want me to spec the leaner Task 2/Task 4 counter-proposal (deps-threaded `accountEmail` across both activation callers, and the reduced auth-prefill task) so you can drop it straight into the plan?
