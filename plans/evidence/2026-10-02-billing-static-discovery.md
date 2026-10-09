# Billing/auth static-layer audit — read-only

Checkout: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning` at
`21e0e41fa996ec6a725c258ab3766971f0edb94d` (base supplied by parent).  No
repository file, runner, provider, database, or network action was changed.

## Scope and truthful read accounting

Discovery inventory: 365 test files contain `readFile*`; the billing/auth search
returned the current payment, checkout, PayPal, Stripe, and auth files.  I
title-inventoried 166 declarations in these bounded payment/auth owner suites:

* `tests/paypal-orders.test.ts` 43
* `tests/billing-plan-change.test.ts` 35
* `tests/stripe-checkout-session-route-contract.test.ts` 34
* `tests/auth-post-checkout-routes.spec.ts` 54

That is an inventory only, **not** a complete declaration-by-declaration body
audit, so it must not be used to delete any of those 166 declarations.  Full
body/source/caller/history review completed for 11 declarations in the three
small static-layer files below, plus the exact source assertions sampled in the
four large owner suites.  This falls short of the requested 150–250 complete
declaration batch; the safe outcome of this pass is therefore no deletion plan,
not a bulk layer plan.

CI routing: `package.json:49` includes Node `tests/*.test.ts[x]`; `package.json:69`
explicitly includes `tests/auth-post-checkout-routes.spec.ts` in Chromium
contracts.  Browser evidence is not substituted with Node coverage.

## Complete small-file ledger

| Mark | declaration and location | actual failure / owner / keeper or transfer | history and action |
| --- | --- | --- | --- |
| R | `tests/payment-server-observability.test.ts:26` `server payment reporter keeps a guarded Node-only SDK boundary` | Catches a server-only import boundary being replaced with the browser SDK. Owner is `src/lib/observability/payment-server.ts`; its `server-only` byte and SDK choice prevent browser/runtime leakage. No real consumer boundary verifies this package boundary. | Keep. A source inspection is the cheapest independent package/runtime guard. |
| R | `:95` `lazily initializes…before capture` | Executes `captureServerPaymentFailure` with a fake Sentry and observes init/capture. Owner `payment-server-core.ts`. | Keep: behavior, not a source pin. |
| R | `:111` `check-ins upsert stable local and daily monitor schedules` | Executes check-in scheduling and observes interval/crontab, timezone and thresholds. Production monitor contract. | Keep. |
| R | `:164` `fails closed when no runtime DSN…` | Executes missing-DSN path and observes no init/capture/flush false. Failure avoids unconfigured telemetry side effects. | Keep. |
| R | `:174` `kill switch does not suppress payment truth signals` | Executes truth/degradation distinction. Loss could suppress payment evidence. | Keep. |
| R | `:208` `reuses an initialized client…` | Executes initialized/flush behavior. | Keep. |
| R (held) | `tests/profile-account-logout.test.ts:18` `Profile Account card offers native server-action logout without explanatory copy` | It is source-coupled, but the proposed Playwright keeper is not a credential-free local proof: `tests/profile-editorial-v3.spec.ts` provisions/updates auth, profile and billing state in `beforeAll`. It also does **not** preserve the avatar/name/email observations. | Retain. No local stronger keeper or complete assertion transfer is established. Commit `6b6ad789` introduced it with profile recovery. |
| R | `tests/partner-access-auth-continuation.test.ts:8` `only the fixed partner continuation is accepted` | Executes public return-path parser against allowed/disallowed paths. Owner `src/lib/auth/partner-access-return.ts`; prevents open redirect/incorrect continuation. | Keep. |
| R | `:16` `partner mailbox proof returns to claim continuation…` | Executes auth-confirm handoff and verifies no generic quiz linkage. Owner `src/app/auth/confirm/route.ts`; authorization/data-link boundary. | Keep. |
| R | `:39` `partner continuation retries with the in-memory handoff…` | Static, but no actual component/lifecycle keeper was found. It protects removal of the fragment-to-memory handoff and accidental page reload after credential removal. | Keep pending an executable component-boundary replacement; no deletion proof. Introduced `97e7da780`. |
| R (held) | `:46` `partner continuation clears a stale quiz draft only on a fresh-start claim` | The proposed duplicate path was wrong: `tests/partner-access-ui.test.tsx`, not `.ts`, reads a different caller (`invitation-client.tsx`). Predicate cases cannot catch continuation wiring or its clear-before-navigation ordering. | Retain. No actual continuation component keeper or transferred order assertion exists. Added by `5a3e33f1`. |

## Large-suite static candidates: retain / no cut from this pass

The 166-title inventory sorts into PayPal capture/webhook/entitlement/retry (43),
plan-change provider/migration/security/reconciliation (35), Stripe checkout
authorization/idempotency/telemetry/claim (34), and post-checkout auth recovery
and side-effect control (54). These are active money or access producer
boundaries, not retired feature inventories. The remaining body-level audit is
required before any declaration-specific mark; no aggregate `R` is a
declaration ledger or permission to prune.

* `tests/paypal-orders.test.ts:115` checks `Prefer: return=representation` in
  `src/lib/paypal/order-intents.ts:274-279`. It is implementation-shaped, but
  no retained test observes the outgoing provider request header. The value is
  needed to obtain authoritative capture representation; retain until an
  injected-fetch owner-boundary test replaces it. Introduced `2518d54eb`.
* `paypal-orders.test.ts:848,930,941,1121,1165,1453,1465` each guards capture
  persistence-before-activation, non-charging recovery/retry, canonical
  one-time delivery or legacy route exclusion. Several are source assertions,
  but no keeper was proven to retain their exact no-charge/order guarantees;
  retain. The surrounding behavioral declarations have distinct provider,
  persistence, webhook, entitlement and retry observations.
* `tests/billing-plan-change.test.ts:423`, `:465`, `:485`, `:497`, and the
  profile-source portion at `:291` are mixed migration/security/route-order
  contracts. Do not split or delete: the migration has no equivalent runtime
  database proof in the selected suite, and route provider-before-analytics is
  a payment side-effect ordering contract.
* `tests/stripe-checkout-session-route-contract.test.ts:234` includes two
  private route-source greps at `:274-280`, but the same declaration also
  asserts idempotency keys. The exact funnel identity behavior is separately
  exercised at `:283-418`; however no edit plan transfers just the route-entry
  wiring assertion, so classify **F/R pending** rather than delete the mixed
  declaration. `6692cc6b` introduced it after the Apple-Pay checkout lifecycle
  fix.
* `tests/auth-post-checkout-routes.spec.ts:342` combines executable redirect
  construction with an `auth-form.tsx` call-site source regexp. Keep pending a
  component-level submit-path keeper. `:1656` is a private welcome JSX/copy
  inventory; no independent active checkout browser keeper was verified here.
  `:1671` pins the Supabase magic-link template redirect placeholder, an
  external provider template contract; retain.

## Production topology checks

* Profile: `src/app/profile/page.tsx:7,2312-2318` imports `signOutAction` and
  renders the form. The browser keeper above reaches its signed-out recovery.
* Partner continuation: `src/app/partner/weiter/partner-access-continuation.tsx:9-43`
  stores the fragment handoff in a ref, claims it, clears only on
  `shouldClearQuizDraft(body)`, then navigates. `src/app/auth/confirm/route.ts`
  is exercised by the retained mailbox proof.
* Stripe route: `src/app/api/stripe/create-checkout-session/route.ts:374-387`
  owns exact signed-session matching. Its pure resolver has behavior tests at
  `tests/stripe-checkout-session-route-contract.test.ts:283-418`; source
  greps only pin caller wiring.
* PayPal capture request: `src/lib/paypal/order-intents.ts:274-279` supplies
  the `Prefer` header. Active callers include `captureAndActivatePayPalOrder`
  in `src/lib/paypal/order-activation.ts:110+`; no runtime fake-fetch assertion
  of the header was found.

## Disposition after correction

No declaration is ready for deletion from this completed small-file layer.
No production seam is unlocked. A future cut needs a credential-free local
profile interaction keeper carrying avatar/name/email/logout observations, or
an executable continuation component keeper that proves fresh-start draft
clearance and navigation ordering.

Focused native commands after an authorized edit (not run):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/profile-account-logout.test.ts tests/partner-access-auth-continuation.test.ts tests/partner-access-ui.test.ts
npx playwright test tests/profile-editorial-v3.spec.ts --project=chromium
git diff --check
```

The Playwright command requires the repository's normal browser/server setup;
it was intentionally not run in this read-only evidence pass. No coverage
claim follows from this inspection.

## Correction receipt

The initial report incorrectly treated a different invitation component as a
duplicate and treated an external-state Playwright suite as a local keeper.
Both entries above are corrected to `R (held)`. No repository change was ever
applied from this report.
