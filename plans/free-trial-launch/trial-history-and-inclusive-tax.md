# Trial-use history and inclusive pricing

Confirmed by Nick, 13 September 2026. This supplements revision 0.50 of [the plan](plan.md); it records intended behavior and verification obligations, not a live configuration change.

## Trial-use history

One trial per customer remains the rule. Keep a minimal server-only used-trial list independently of the deletable customer profile. Account deletion/recreation, cancellation and the passage of time do not automatically reset eligibility. Deny another trial on the approved strong evidence: account, verified email, reliable Stripe card fingerprint or PayPal payer identity. Preserve existing paid-customer ineligibility. Do not block on IP, device or name alone. A denied free trial may still lead to an explicitly chosen paid subscription or support.

Keep versioned HMAC matching claims, consumed status and only the supporting timestamp/policy information needed to enforce and explain the decision. Do not store raw card numbers, hair profiles, scan history or unnecessary provider payloads in this list. Abandoned/unactivated authorizations are not consumed trials. Profile deletion must not cascade into automatic deletion of consumed eligibility claims. Test that composition explicitly, including later recreation and payment-method matching. Cross-provider identities are not assumed equivalent without verified linkage; a changed/unrecognized identity cannot be guaranteed detectable.

Business-policy confirmation does not establish unlimited lawful retention. Before the dependent data lifecycle ships, document the fraud-prevention necessity/balancing assessment, retention criteria and review/deletion procedure, privacy disclosure, restricted access and erasure/objection handling. No routine expiry is approved as a way to reset eligibility. If lawful erasure or a required limit conflicts with that rule, report the specific conflict rather than silently changing the rule or retaining data unlawfully. HMAC remains pseudonymous personal data.

The [EDPB data-protection basics](https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_en) requires minimisation and retention limits justified by the purpose. It does not establish a specific lawful period for this trial list. The product decision is settled; that assessment remains an evidence obligation.

## Final-price invariant

Customer totals on both providers: seven-day trial EUR 0; monthly EUR 9.99; first paid annual year EUR 69.99 while the launch offer applies; subsequent annual billing EUR 99.99. Any applicable tax is contained in those totals. Never add VAT on top or reduce the EUR 30 launch discount through an inconsistent tax calculation. Existing customer agreements are not changed.

### Stripe

Use explicit `tax_behavior=inclusive` for each new-cohort price, including any inline recovery price. Stripe documents that inclusive behavior keeps the buyer total constant whether calculated tax is zero or positive. Inspect the actual live price and checkout configuration rather than inferring the result from an account-wide default. Verify full-price annual EUR 99.99 minus the EUR 30 once coupon totals EUR 69.99, with no duplicate/additive manual or automatic tax path. Verify monthly and subsequent renewal totals and receipt breakdowns as well.

Source: [Stripe product tax codes and price tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior). The installed Stripe CLI does not support `stripe docs`; official web documentation was used as fallback.

### PayPal

The Subscriptions API supports a plan `taxes` object with a percentage and `inclusive` boolean. Where tax applies, set `inclusive: true` with the verified applicable percentage. Do not treat this flag as an automatic jurisdiction/rate determination service or invent a percentage merely to populate it. Inspect plan and effective subscription details, including approved overrides and every priced phase, so trial, first paid year and renewal preserve the agreed totals. The recovery setup-fee candidate needs separate total/tax verification; plan-tax support alone does not prove that path behaves correctly.

Source: [PayPal subscription plan definition](https://developer.paypal.com/api/subscriptions/v1/definitions/plan_collection/).

### Evidence still required before activation

Codex owns checking provider settings and available merchant facts. Nick reports no VAT registration; this alone does not determine exemption, registration obligations, customer-location treatment or a correct invoice tax label. Inclusive pricing is confirmed regardless. Preserve the cofounder/tax backlog for any necessary business facts that cannot be verified from the accounts. Do not manufacture a registration, apply an assumed VAT rate, or claim an inclusive-price setting settles tax obligations.

This pass verified documented provider capability only. It did not inspect current authenticated live tax settings, change provider resources, enable collection, publish policy text, or execute a payment. Exact checkout/receipt totals and provider mechanisms remain implementation/activation checks under the existing authorization boundaries.
