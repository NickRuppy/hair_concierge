# Downstream journey evidence

13 September 2026. Reviewed planning evidence; Nick accepted the displayed initial flow on 13 September, explicitly cancellation. No production interaction, payment, cancellation or email was executed.

- Review: `journey-review.html` at http://localhost:8769/journey-review.html . One preview, grouped selector, previous/next and mobile/desktop controls. The 18 entries are alternative states, not 18 sequential customer screens.
- Customer markup: `journey/*.html`; inventory: `journey/states.json`. Forms and customer actions are static, with fixture identities/dates. Do not implement from these buttons as production code.
- Profile frames reuse `profile-trial-production.html`, inspected production CSS and downloaded font files in `profile-assets/`. Actual live profile/source inspection is recorded in `profile-production-evidence.md`.
- Recovery frames use the existing reactivation source structure, header, typography and buttons; product preview/navigation is absent when access is locked. This is source-grounded; no live failed-payment account was inspected.
- Public cancellation and withdrawal are proposed required paths using the same typography/buttons. They are not evidence of a previously existing live flow. Public frames use `Anmelden`, not a misleading signed-in `Abmelden`.

## Checks performed

Loaded the regenerated 18-state selector in the browser. Visually inspected cancellation confirmation, locked first-payment recovery and public cancellation at the 390px outer mobile frame, and the trial interval selector at mobile and desktop widths. Trial-change DOM body had no horizontal overflow (388px inner mobile width, 1238px desktop). Inspected customer terms/CTA and separate review annotations; no provider-hosted PayPal UI is fabricated.

Retained captures:
- `journey-cancel-mobile.png`
- `journey-switch-mobile.png`
- `journey-switch-desktop.png`
- `journey-payment-mobile.png`

These checks establish the proposed hierarchy and representative responsive layouts, not a functional checkout, accessible production form or full 360px/browser-matrix verification. Implementation must validate real keyboard/focus behavior, validation/errors, provider status transitions and mobile widths under T5. Fonts and production button treatments were reused, not redesigned.

## State contracts

Cancellation: one confirmation; confirmed termination; durable-save failure; accepted declaration with provider reconciliation pending; restoration terms; abandoned PayPal approval. The pending state requires no second cancellation.

Plan change: monthly and annual choice; uncertain provider response; verified completion. Original trial deadline never moves. Only PayPal shows its reapproval note.

Payment: failed first payment with explicitly chosen paid checkout; ambiguous/processing payment with no second checkout; successful recovery with a full period from payment; return after expired trial without another free trial.

Legal: public cancellation declaration and receipt, online withdrawal declaration and receipt. Receipt acknowledges submission; unknown contract matching does not expose account facts, and withdrawal receipt does not predetermine refund entitlement. Classification/privacy gates remain in the plan.

The approved scanner offer (`mobile.html`, `cal-ai.html`, `scanner-hero.webp`) is unchanged. Earlier `lifecycle-states.html` and older membership screenshots are historical, not the final implementation reference.

## User acknowledgement — 13 September 2026

Nick says “the flow, I checked. That looks okay if you quit it like this.” The displayed initial flow is visually accepted, with cancellation explicitly confirmed. Earlier “awaiting review” statements above are historical and superseded for these unchanged frames. This does not approve unshown year-two states or later substantive policy/UI changes. Preserve the acknowledgement rather than asking again.
