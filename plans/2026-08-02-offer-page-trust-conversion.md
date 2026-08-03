# Offer-page trust and conversion: approved direction

## Outcome and authority

Turn the useful ideas from co-founder PR [#311](https://github.com/NickRuppy/hair_concierge/pull/311) into a separate implementation PR, incorporating Nick's line-by-line product decisions rather than implementing the handover verbatim.

- PR #311 source head reviewed: `7a03fb5e4d4244c9517ccf4d1b81a7376a1b0e2e`.
- This plan is based on `origin/main` `6692cc6b`, after payment lifecycle PRs #312 and #313.
- In scope: `personal-plan-one-time-v1`, `personal-plan-membership-v1`, and the fallback `personal-plan-v1`. The fallback shares the membership presentation so an experiment rollback does not restore contradictory copy; `/labs/offer-page` follows the same shared surface.
- Out of scope: legacy offer families, activation, deployment, production writes, new cancellation infrastructure, a founder letter, and customer photos.
- The reviewed prototype is [offer-page-trust-conversion.html](./mockups/2026-08-02-offer-page-trust-conversion.html).

## Approved product direction

### Shared offer-page trust

- Keep the main pricing CTA coral. Plum remains the selected-plan and sticky-navigation color.
- Move the existing `Entwickelt gemeinsam mit Friseurmeistern` proof from the lower diagnostics card to directly beneath the hero on both arms. Do not duplicate it and do not add stars beside this proof.
- Move `Das sagen Kundinnen über Chaarlie` directly below pricing on both arms.
- Keep stars on the testimonial cards. Add ages, hair types, and longer source-backed quote versions from the accepted PR #311 handover material; do not invent missing details and do not add photos.
- In the method/product-selection section, add: `Unabhängig und passend zu deinem Haar ausgewählt. Kauflinks können Affiliate-Links sein.`
- Keep the current final CTA and button, including `Dein Plan zu schöneren Haaren in 30 Tagen.` and `Plan sichern`.
- Add a compact offer footer with Haarmony LLC, `Impressum`, `Datenschutz`, `AGB`, `Widerruf`, `Kontakt`, `info@chaarlie.de`, and the existing cookie-settings trigger. Reuse the canonical footer link definitions/behavior rather than creating a second incomplete legal map.
- Do not add a public `Verträge hier kündigen` footer link in this scope.

### One-time offer

- Show the planned regular/list price of 49.99 crossed out beside the current 29.99 launch price. This is a launch-price anchor, not a claim that 49.99 was previously charged. Apply it in the pricing card, sticky price, and checkout summary where layout allows. Use each surface's existing euro-position convention (`€49,99` beside `€29,99`; `49,99 €` beside `29,99 €`) rather than broadening scope into a formatting cleanup. The legally significant order button continues to state only the amount actually due (`Zahlungspflichtig bestellen — €29,99`). Nick explicitly accepts the reference-price business risk.
- Keep the existing coral CTA copy and its current price-formatting convention unchanged.
- Directly below it show `14 Tage Geld-zurück-Garantie · Einmalzahlung · Kein Abo`.
- Then show PayPal, Apple Pay when supported, Visa, and Mastercard.
- End the trust stack with: `Zahlungsdaten verarbeitet dein gewählter Anbieter. Mehr zum Datenschutz.` Do not add the redundant `Sicher bezahlen über deinen gewählten Zahlungsanbieter.` line.
- Remove the express-consent checkbox and withdrawal-waiver copy from checkout. Nick explicitly accepts that the statutory 14-day withdrawal/refund right remains available after immediate delivery; the marketing guarantee may be friendlier but must not narrow that unconditional legal right.
- In checkout, lead with `14 Tage Geld-zurück-Garantie` and: `Wenn Chaarlie für dich nicht hilfreich ist, erhältst du eine vollständige Rückerstattung.`
- Payment methods mount immediately when the overlay opens; remove the `Nach Einwilligung verfügbar` placeholder branch. Preserve `offer_payment_option_viewed` semantics by emitting it only when a real, ready payment option is visible.
- Preserve payment, idempotency, fulfillment, and entitlement integrity without sending a fake `consentAccepted: true`. Change the client plus Stripe claim schema plus PayPal schema atomically. The legacy database table remains a backward-compatible purchase/delivery identity anchor, with a new explicit `purchase_context_refund_v1` copy-version discriminator and neutral snapshot text: `Für den persönlichen Haarplan gilt ein 14-tägiges Widerrufsrecht. Innerhalb dieses Zeitraums wird der vollständige Kaufpreis auf Wunsch erstattet.` Historical waiver rows remain immutable and distinguishable. For new discriminator rows, legacy `accepted_at` means the server-created purchase-context timestamp, not an explicit user acceptance. Update the table comment and any confirmation/template labeling so new records are never represented as explicit-waiver evidence; the legacy `accepted_at` and `consent_text` column names remain documented compatibility debt.

### Membership offer

- Keep the existing crossed-out comparison prices, `Launch-Rabatt sichern` badge, and selected-plan styling; the badge remains the concise explanation for those prices.
- Remove `Dein Launch-Preis bleibt bis zur Kündigung erhalten. Regulär ab 14,99 €.`
- Directly below the CTA show `14 Tage Geld-zurück-Garantie · Jederzeit kündbar`.
- Keep the larger lower-page guarantee block as well, but remove the salesy `OHNE RISIKO` eyebrow.
- Use the heading `14 Tage Geld-zurück-Garantie` and body `Wenn Chaarlie für dich nicht hilfreich ist, erhältst du eine vollständige Rückerstattung.`
- Keep cancellation guidance in the CTA microcopy and membership FAQ, not in a new footer flow.

### Payment overlay and recovery states

- Verify the already-implemented product-and-amount summary in the overlay header; do not rewrite it unless current-head reproduction shows a regression.
- One-time checkout begins with the guarantee rather than a consent box, followed by actual available payment methods, the concise privacy line, and legal/contact links.
- A valid fresh overlay displays no red error.
- A real preparation failure has exactly one visible alert and one retry action.
- An attempt already locked to PayPal shows a neutral `PayPal ist bereits ausgewählt` state, not an error.
- Recheck these behaviors on the post-#313 head before changing error ownership; do not rewrite already-correct lifecycle handling merely because PR #311 described an older symptom.
- The payment overlay heading `Sicher bezahlen` remains unchanged as its accessible dialog title. Only the redundant sentence `Sicher bezahlen über deinen gewählten Zahlungsanbieter.` is excluded.

### Approved testimonial source table

| Person/context | Approved quote | Treatment |
| --- | --- | --- |
| `Kim · Endlich verstehe ich meine Haare` plus `34 · feines, welliges, blondiertes Haar` as secondary context | `Der Fragebogen ist echt gut und leicht verständlich. Im Chat hat das Antworten super geklappt. Auch die Produktempfehlung fand ich gut.` | Keep testimonial stars, benefit framing, and the available age/hair context. |
| `Kerstin · Echte Antworten bekommen` | `Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen.` | Keep testimonial stars; do not invent age or hair type. |
| `Sarah · Nie wieder googeln vorm Regal` | `Bei den Produkten stehen Preis und Anwendung dabei – und warum sie empfohlen werden. So muss ich nicht erst googeln.` | Keep testimonial stars; do not invent age or hair type. |

No photos are added. If implementation evidence shows a quote differs from the accepted PR #311 source, stop on that card rather than silently rewriting it.

## Final FAQ catalogues

The one-time arm has seven questions. The membership arm reuses those seven and adds two membership-specific questions.

### Shared questions and answers

1. **Warum reicht nicht einfach ein neues Shampoo?**
   Ein einzelnes Produkt kann nur einen Teil beeinflussen. Dein Plan verbindet Reinigung, Pflege, Styling und Anwendung, damit die Schritte zu deinem Haar und zueinander passen.
2. **Ist der Plan wirklich auf mein Haar abgestimmt?**
   Deine Haarstruktur, Dicke, Dichte, Länge, Oberfläche, Elastizität, Kopfhaut und Ziele bestimmen, wie dein Plan aufgebaut wird.
3. **Was bekomme ich – und was passiert nach dem Kauf?**
   Du erhältst eine vollständige Routine mit passenden Produkten, der richtigen Reihenfolge sowie klarer Anwendung und Häufigkeit. Chat und Haartagebuch sind ergänzend enthalten. Nach dem Kauf ergänzt du noch deine vorhandenen Produkte und Gewohnheiten; anschließend öffnet sich dein Routinebereich.
4. **Muss ich neue oder teure Produkte kaufen?**
   Nein. Wir empfehlen in unterschiedlichen Preisklassen. Du entscheidest, was du kaufst, und passende Produkte, die du bereits hast, können in deinen Plan übernommen werden.
5. **Was, wenn Chaarlie für mich nicht hilfreich ist?**
   Wenn Chaarlie für dich nicht hilfreich ist, erhältst du innerhalb der ersten 14 Tage eine vollständige Rückerstattung.
6. **Woher weiß ich, dass das echt ist?**
   Bei Chaarlie siehst du, warum eine Empfehlung zu deinem Haar passt. Unsere Produktdaten basieren auf nachvollziehbaren Quellen, und dein Plan wurde gemeinsam mit Friseurmeistern entwickelt. Wenn Chaarlie für dich nicht hilfreich ist, erhältst du innerhalb von 14 Tagen eine Rückerstattung.
7. **Wie lange, bis ich etwas merke?**
   Ob die Routine zu dir passt, merkst du oft schon nach den ersten Anwendungen: Sie sollte verständlich sein und sich gut in deinen Alltag einfügen. Wann sich dein Haar sichtbar oder spürbar verändert, ist individuell. Manche Veränderungen zeigen sich schnell, andere brauchen mehrere Wochen konsequente Pflege. Wir versprechen deshalb keinen festen Zeitpunkt – geben dir aber einen klaren Plan und eine 14-Tage-Geld-zurück-Garantie.

### Membership-only questions and answers

8. **Warum ist Chaarlie ein Abo?**
   Dein Haar und deine Bedürfnisse können sich verändern – etwa durch Jahreszeiten, äußere Einflüsse, Färben, neue Ziele oder wenn du neue Produkte ausprobierst. Deshalb bleibt Chaarlie an deiner Seite: Deine Routine kann angepasst werden und du erhältst Unterstützung, wenn sich etwas verändert. So bleibt dein Plan keine Momentaufnahme, sondern entwickelt sich mit dir weiter.
9. **Wie und wann kann ich kündigen?**
   Du kannst deine Mitgliedschaft jederzeit beenden. Sie läuft bis zum Ende der bereits bezahlten Abrechnungsperiode weiter; danach entstehen keine weiteren Kosten.

There is no `Warum kostet Chaarlie etwas?` FAQ and no separate `Ist das ein Abo?` FAQ on the one-time arm because the CTA already states `Einmalzahlung · Kein Abo`.

### FAQ analytics identity

The old `personal-plan-1` through `personal-plan-5` identifiers are positional and are retired at the new offer revision; they are not silently reused. The new catalogue introduces stable slugs:

| Old positional question | New stable slug |
| --- | --- |
| `personal-plan-1` — neues Shampoo | `new-shampoo-not-enough` |
| `personal-plan-2` — wirklich abgestimmt | `personalized-plan` |
| `personal-plan-3` + `personal-plan-5` — Inhalt + nach Kauf | `included-and-after-purchase` |
| `personal-plan-4` — bisherige Produkte | `new-or-expensive-products` |
| new | `not-helpful-refund` |
| new | `recommendation-credibility` |
| new | `time-to-notice` |
| membership only | `why-subscription` |
| membership only | `cancellation-timing` |

The revision boundary preserves historical interpretation of the old positional IDs while all new events use the stable slugs.

## Designed user journeys

### One-time arm

1. A quiz completer opens a valid personal-plan result and sees the personalized diagnosis plus `Entwickelt gemeinsam mit Friseurmeistern` beneath the hero.
2. At pricing, `49,99 €` is crossed out, `29,99 €` is presented as the launch price, and the coral CTA offers the one-time plan.
3. Immediately beneath the CTA, the user sees the 14-day guarantee/no-subscription boundary, payment methods, and the neutral privacy link.
4. Testimonials follow pricing, using the approved longer quotes and available age/hair-type context without photos.
5. The method section explains independent selection and transparently identifies possible affiliate links.
6. Opening checkout shows the exact product/price, the generous refund promise, available payment methods, the privacy link, and legal/contact routes. There is no consent checkbox.
7. Fresh, failure, retry, and PayPal-lock states behave as described above; the buyer completes the existing Stripe or PayPal flow without changes to entitlement or fulfillment semantics.
8. A buyer who continues down the page sees the seven one-time FAQs, the existing final CTA, and the compact legal footer.

### Membership arm

1. The same hero proof appears on the assigned membership result.
2. Pricing retains the crossed-out comparison prices and plum selected-plan state; the extra launch-price-persistence sentence is absent.
3. The coral CTA is followed by `14 Tage Geld-zurück-Garantie · Jederzeit kündbar`, payment methods, and the privacy link.
4. Testimonials and method transparency follow in the same positions as the one-time arm.
5. Checkout preserves the existing membership provider flow and adds the same legal/contact destinations and concise trust treatment where shared.
6. Farther down the page, the larger guarantee block remains with the approved non-salesy heading and refund sentence.
7. The membership FAQ contains the seven shared questions plus why Chaarlie is ongoing and how cancellation takes effect.
8. The existing final CTA and compact legal footer close the page; there is no new public cancellation link.

### Error and recovery completion

- Fresh checkout: payment methods load without an error.
- Preparation failure: one alert and one retry.
- Retry: clears the alert and starts one fresh preparation generation.
- Provider lock: neutral PayPal status, no duplicate alert or duplicate Sentry capture.
- Completion: existing provider confirmation, purchase activation, fulfillment, and recovery remain intact.

## Target map

- `src/components/personal-plan-offer/personal-plan-offer.tsx`: hero proof, arm-specific FAQ catalogues, testimonial placement/content, method disclosure, unchanged final CTA, compact footer.
- `src/components/quiz/result-offer-pricing.tsx`: one-time crossed-out price and trust stack.
- `src/lib/billing/offer-products.ts` (or the nearest existing one-time product catalogue): add a single numeric 49.99 planned regular/list-price constant; do not scatter display literals.
- `src/components/checkout/subscription-plan-selector.tsx`: membership microcopy and removal of launch-persistence sentence.
- `src/components/checkout/offer-payment-overlay.tsx`: guarantee-first one-time composition plus privacy/legal links.
- `src/components/checkout/personal-plan-one-time-checkout.tsx` and `src/components/checkout/paypal-one-time-button.tsx`: remove the UI/client consent gate without weakening provider locking or retry behavior.
- `src/app/api/stripe/create-checkout-session/route.ts`, `src/app/api/paypal/create-order-intent/route.ts`, `src/lib/billing/personal-plan-one-time-consent-copy.ts`, and `src/lib/billing/personal-plan-one-time-consents.ts`: atomically remove the Stripe claim and PayPal literal-consent requirements and introduce the honest server-owned purchase-context/refund-policy snapshot while preserving existing prepare/claim discriminators and identity references.
- A forward-only migration updates the legacy table comment for mixed historical-waiver/new-purchase-context semantics; immutable historical rows are untouched.
- Extract the canonical footer destinations/cookie trigger from `src/components/landing/site-footer.tsx` for reuse by a compact offer presentation; include `info@chaarlie.de` explicitly because it is not in the current canonical footer.
- `src/lib/analytics/offer-section-order.ts`, the new stable FAQ identifiers, related tests, a new `scripts/analytics/personal-plan-offer-v4-dashboard.ts`, a new `scripts/posthog/update-personal-plan-offer-v4-dashboards.ts`, and a new package script/test: reflect the approved testimonial move without mutating the pinned v3 declaration.
- `src/app/widerruf/page.tsx` and `src/app/agb/page.tsx`: replace the explicit sentence denying a one-time guarantee and align the one-time commercial promise. Retain the generally correct conditional §356(5) explanation; it simply no longer triggers in this flow. `src/app/impressum/page.tsx` is touched only for the separately approved obsolete EU OS-platform cleanup, not for consent wording.
- Existing focused unit/component/E2E tests for the touched surfaces and checkout lifecycle.

## Ordered implementation and verification

1. Replace (do not duplicate) the old consent/placeholder assertions, then add failing assertions for the reviewed copy, 7/9 FAQ split, stable FAQ slugs, new section order/revision, one-time launch-price display, absent consent UI/client fields, guarantee-first overlay, membership copy, footer/cookie links, and preserved final CTA. Explicitly update `tests/personal-plan-one-time-checkout.test.tsx`, `tests/personal-plan-offer-motion.spec.ts`, and `tests/offer-section-order.test.ts` where they assert the old state.
2. In one atomic payment-contract change, remove the client gate and both API literal-consent requirements; mount payment methods immediately; add the `purchase_context_refund_v1` discriminator and migration comment; and synchronize `/widerruf`/terms with the unconditional 14-day right. Preserve existing IDs and historical-row compatibility. Run `tests/personal-plan-one-time-consents.test.ts`, `tests/stripe-checkout-session-route-contract.test.ts`, `tests/paypal-orders.test.ts`, `tests/personal-plan-one-time-activation.test.ts`, and `tests/billing-one-time-purchases.test.ts`. **Stop before visual work if either provider, activation, fulfillment, or historical access is not green.**
3. Implement the shared hero, text payment-method labels (`Apple Pay` qualified as device-dependent), trust stack, compact canonical footer, one-time price, membership copy, and overlay treatment. No new payment-brand asset system or availability detector is introduced.
4. Implement the reviewed testimonial placement/content, method disclosure, FAQ catalogues, and lower membership guarantee copy.
5. Update the offer section-order contract, FAQ slugs, offer revision, new v4 dashboard declaration/applier/tests/package script, and the imprint cleanup; do not modify live PostHog state in this task.
6. On current main, reproduce fresh/error/retry/PayPal-lock checkout states and change error ownership only if a gap still exists after PRs #312/#313.
7. Run focused tests, the relevant one-time payment and entitlement suites, `npm run test:node`, and `npm run ci:verify` under the supported Node version. Separately run `npx playwright test tests/offer-payment-overlay.spec.ts tests/personal-plan-offer-motion.spec.ts` because those changed flows are not included by `test:node` or `test:playwright:contracts`.
8. Inspect all three variants at narrow mobile and desktop widths, including pricing, testimonials, method copy, FAQs, footer/cookie settings, payment modal, and recovery states.
9. Run the available personal `ready-check` and `request-code-review` skills, including one read-only Claude whole-branch review at `high`; verify findings locally and rerun affected checks.
10. Stop at a review-ready handoff. Do not commit, push, open a PR, merge, activate, deploy, mutate PostHog, or write production state without explicit authorization.

Rollback/containment: this remains one implementation PR, split into payment-contract and visual/analytics commits. The forward-only comment migration is backward-compatible. If checkout verification fails before visual work, stop at the payment gate. After release, the existing pricing-experiment switch can stop new one-time assignments; a guarded code revert restores existing assigned sessions without reverting historical rows. No extra runtime flag is introduced.

## Acceptance checks

- Exact approved copy and 7/9 FAQ counts render on the intended arms; fallback `personal-plan-v1` intentionally follows membership copy.
- Coral/plum semantics and the existing final CTA remain unchanged.
- One-time price consistently shows `49,99 €` crossed out and `29,99 €` as the launch price.
- No consent checkbox, withdrawal-waiver text, or fake `consentAccepted: true` remains in the one-time customer flow.
- Stripe and PayPal schemas accept the new contract atomically; new rows use the explicit purchase-context discriminator while historical consent evidence remains untouched.
- Stripe and PayPal identity, provider locking, idempotency, purchase activation, fulfillment, and historical purchase access remain green.
- Trust order is guarantee → payment methods → neutral privacy link; the redundant safe-payment line is absent.
- Testimonial cards keep stars, use only accepted source details, have no photos, and sit directly below pricing.
- Stable FAQ slugs, a new offer revision, updated section-order tests, and updated dashboard source make the measurement break explicit and reviewable.
- Membership retains its lower guarantee block without `OHNE RISIKO`; launch-price-persistence copy is absent.
- No founder letter, why-it-costs FAQ, cancellation footer link, new cancellation backend, activation, deployment, or production write enters the diff.
- Before any later activation, capture a read-only v3 baseline window and annotate the v4 boundary; this implementation task prepares the dashboard source but does not mutate live PostHog.

## Review status and stop boundary

- Mockup review: **approved by Nick on 3 August 2026**, including privacy option B and removal of the redundant safe-payment line.
- FAQ catalogues and designed journeys: **approved by Nick on 3 August 2026; implementation authorized with sub-agent workers/explorers**.
- Publication status: **not authorized**.
- Durable PR artifacts: this plan and its HTML prototype.
- Stop point: complete implementation, verification, and local review, then hand off the review-ready branch without publication actions.
