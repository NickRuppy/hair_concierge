# PayPal deferred trial-plan builder seam closure — read-only

## Finding

**Supported conditional D: 3 AST declaration sites plus the complete unused source module.**

`src/lib/paypal/trial-plan-shape.ts:76` exports `buildPayPalDeferredTrialPlanRequest`, a private fixed-price request generator. Its exact-name graph closes at the source definition and four test files: one direct three-declaration test file plus three retained billing test fixture consumers. There is no non-test named import, alias/barrel export, dynamic literal import, script/package root, or current runbook command for this builder. The workspace root package is private and publishes no SDK export for it.

The former plan-creation premise is obsolete. `src/app/api/paypal/create-subscription-intent/route.ts:163` validates an already-stored configured `paypal_plan_id`, and its checkout path at `:439+` selects a configured catalog ID and validates its interval/catalog. `docs/free-trial-launch-runbook.md:32–39` names the three active pre-created schedules and explicitly says they were created/retrieved ACTIVE. Current provider transitions use those IDs and their `price_overrides`/subscription state, not a body from this generator.

## Exact direct declarations

| Mark | File:line | Lost observation | D closure |
|---|---|---|---|
| D | `tests/paypal-trial-plan-shape.test.ts:6` | obsolete monthly creation-body schedule | no checkout/operator creator invokes it |
| D | `tests/paypal-trial-plan-shape.test.ts:21` | obsolete annual creation-body schedule | same closure |
| D | `tests/paypal-trial-plan-shape.test.ts:40` | obsolete tax/input validation for creation body | same closure |

All three bodies were read in full with the source (168 lines captured at `/tmp/test-audit-paypal-deferred-plan-direct-bodies-read.txt`). The test file is the only direct behavior oracle and may be deleted together with the module. This is **not** a claim to remove any trial-management, activation, checkout-attempt, webhook, or provider-recovery declaration.

## Mixed fixture consumers retained independently

Three meaningful provider suites import the builder only to construct `subscription.plan` fixture data: management (four calls), activation (three), and checkout attempt (one). Their actual contracts remain independent of source creation: management asserts outgoing annual request prices at `tests/paypal-trial-management.test.ts:369–370`; activation mutates/validates foreign plan product identity at `tests/paypal-trial-activation.test.ts:1184`; and all retain subscription ID/custom ID/timing/admission/recovery logic.

Conditional edit: replace these eight calls with an independently authored literal test fixture, with no new test declarations and no production helper. It must preserve the provider payload fields each consumer reads. This is fixture decoupling only, zero additional credit; it prevents a deleted source helper from serving as the fixture oracle. Read scope was captured in the three fixture excerpts (1,890 lines total).

## History, controls, and limits

The generator dates to the original trial launch (`318cf157`/`c8e28a46`); the immutable schedule fix was `b1d0de34` and `d16951aa`. Its historical creation role does not prove a current caller. Suggested, unrun focused command is documented in `/tmp/test-audit-paypal-deferred-trial-plan-source-control.md`. I did not contact PayPal, load configuration, run tests, or inspect live provider state. The checked-in runbook and current configured-ID checkout path support code/test retirement; main retains billing/product-risk decision authority.
