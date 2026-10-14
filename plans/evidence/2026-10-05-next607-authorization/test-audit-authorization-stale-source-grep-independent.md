# Independent stale source assertion check

**PASS for exactly the four-line `assert.match` at `tests/personal-plan-one-time-checkout.test.tsx:173–176`; retain the declaration and all 13 other assertions. Zero declaration reduction.** This is a source-retirement follow-up, not permission to retire the PayPal UI, decoder, capture/recovery, or compatibility behavior.

Exact removed bytes:
```ts
  assert.match(
    stripeCheckoutRouteSource,
    /error: "payment provider already selected", provider_locked: "paypal"/,
  )
```

Current test SHA256 `2cfa7a5fb8a637799c158f78d586bb593d7355eeb7b26f392032a0e779fb2efc`. Prospective minimal-file SHA256 `e0fb1b22b85e959ff0c9f3bc7a82a1568386b2a2e84a73c9de00b77c97c18bfe`. Callback-before `a609aa071a2967ccfde74d48fc66b84dfa217b47d3163dc45d447eab37e4f824`; callback-after `8e6460d45b5a8e9a2fdda1b4ea486ac650e2767d6e76e8724f9710719078575c`. Companion JSON contains complete original/prospective callback bodies and seven current file pins. String reconstruction confirms every byte outside this one occurrence, including source reads and all other callbacks, is unchanged. No repository edit or runtime validation performed.

## Why this sole clause is obsolete

The original approved route snapshot contains this exact response inside the one-time branch being removed. Actual POST derives a const `isOneTimePurchase` from schema-normalized `purchaseKind === PERSONAL_PLAN_ONCE_KIND`, then returns `one_time_purchase_retired`/410 before identity/account/provider work for that predicate. No action/default/client state can make the later branch reachable for the same const. The current route differs from the approved cut snapshot only by formatting: the retained consent-binding import is single-line and two blank/whitespace-only lines were removed; complete diff inspection found no changed token or literal. Current route SHA is pinned separately in the JSON, not falsely treated as packet byte identity. This assertion observes only a source spelling in the dead block; it does not invoke or preserve a current provider conflict response. Its deletion therefore follows the already accepted narrow closure; it supplies no additional source-retirement authority.

The retained actual-owner test `tests/stripe-checkout-session-route-contract.test.ts:95`, “retired one-time purchase requests stop before account or provider work”, constructs schema-valid prepare and claim requests, calls actual POST, and asserts response.status 410 at117 and exact retirement JSON at118. This review read the entire callback. It is retained unchanged. The approved 410→409 representative owner control targets that assertion; main owns its execution/results, and this check does not claim a new pass.

## Why every other callback clause stays

`personal-plan-one-time-checkout.tsx:431–490` posts prepare with literal `purchaseKind: personal_plan_once`, decodes the actual response with `resolvePreparedStripeCheckoutState`, protects against stale unclaimed Stripe responses after PayPal ownership, and updates parent provider state. Claim at622–655 posts the same purchase kind and handles a 409 PayPal ownership response. These are extant compatibility paths, not evidence that new one-time route creation is enabled.

The complete `prepared-stripe-checkout-state.ts` was read: a409 provider-locked control outcome maps to Stripe or PayPal parent state; duplicate access, unavailable, valid prepared/recovered responses and unexpected response null remain separate. The remaining test clauses preserve specific parent state, German recovery messages, and mounting constraints; none is removed.

`PayPalOneTimeButton` create-order callback posts to `/api/paypal/create-order-intent`, validates response/orderId/token, assigns `intentTokenRef.current = body.token`, then invokes `onProviderSelected`. Parent handler at787–792 sets the PayPal ref/state, clears Stripe selection/error. The SDK `onCancel` handler at742–749 also invokes that callback when an existing intent token survives. Current create-order-intent POST returns410 for new orders while explicitly preserving existing capture/fulfillment routes. No new-order success is claimed here; callback compatibility/recovery is retained.

The unchanged parent `paypalOwnedAttempt`/suppression predicates, PayPal option, stable slot at847, unavailable card at912, and primary body at966 establish the actual rendering relationship guarded by the other assertions: one stable PayPal slot, disabled card option, specific fallback if PayPal cannot load, no duplicated secondary PayPal mount. The final render still places primary body then the slot. Keeping these assertions preserves their current static oracle even though this bounded check is not a browser proof.

## Verification/read limit

Read complete contested callback, full prepared-state owner, full PayPal create-order route, full retained actual410 callback, and the operative component/request/render slices above. Original closure packet is reused for the already approved helper/type/deadblock retirement; no broader flow audit is asserted. Runtime/source mutation remains exclusively main-owned after the full607 freeze closes. Suggested focused native follow-up: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-one-time-checkout.test.tsx tests/stripe-checkout-session-route-contract.test.ts`; then main's required fresh whole-suite/coverage gate. No new inputs/cases/skips or source behavior changes are proposed.
