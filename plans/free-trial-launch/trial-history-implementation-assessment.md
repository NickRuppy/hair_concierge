# Trial-history implementation assessment

13 September 2026. Technical implementation proposal; controller validation and actual processing remain unapproved release evidence. The confirmed product rule remains one trial per customer, with no reset from ordinary account deletion or the passage of time.

## Purpose and narrower alternatives

Purpose: prevent repeated use of the same introductory offer while retaining a paid-signup and support path. Account ID alone fails after account recreation; verified email alone fails when an email changes. The approved reliable provider identifiers improve matching across accounts, with an acknowledged risk that legitimate household members share a payment method. IP, name, address and device tracking add intrusion and unreliable matches and are excluded.

This is a proposed legitimate-interest assessment, not evidence of measured abuse or a blanket entitlement to retain data forever. The [EDPB lawful-processing guide](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en) requires a valid basis and assessment of necessity and individual interests. Chaarlie must document its specific interest, why these identifiers are needed, the impact of mistaken matches and the effectiveness of the support correction path before processing real claims.

## Minimal technical contract

- Server-only, domain-separated HMAC claim for account ID, verified email, Stripe card fingerprint scoped to the merchant/environment, or PayPal payer ID. Keep key version, consumed timestamp, policy version and opaque enrollment linkage. No raw matching identifier in this relation, provider payload, profile/quiz data or analytics export. HMAC remains personal data.
- Do not attach the retained relation to a cascading profile deletion or use it to prevent profile deletion. Existing billing-record retention is a separate purpose and does not justify trial-history retention automatically.
- Claim admission atomically; only verified activation consumes a trial. Abandoned authorization may release a reservation; repeated callbacks cannot create another entitlement. An authoritative used claim blocks the free offer, not login, support or expressly accepted paid signup.
- Keep a correction, restriction and deletion path. Suppressed or erased claims must not be recreated by a late webhook or a retry from retained provider payloads. The operator must consider all linked claims and lawful exclusions, not delete one hash while another silently enforces the same denied processing.
- Key rotation must preserve permitted matching without retaining raw identities. A lost key cannot be described as an intentional eligibility reset; nor should raw identifiers be retained merely to avoid that operational risk.

## Retention and requests

No fixed statutory period has been established for these records. Proposed operational default: review necessity at least annually and when the offer, purpose or relevant law changes. A review date is not an automatic entitlement reset. Delete or irreversibly anonymize records when the documented purpose no longer justifies retention, and follow a valid erasure/objection outcome. The controller must record retention criteria and why continued matching remains proportionate; “one trial ever” alone is insufficient.

The [EDPB rights guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en) requires facilitating rights, transparent information and documented responses. Support verifies the requester proportionately, records the request and applicable decision, responds within the required period, and explains any justified refusal. No automatic refusal based solely on the commercial policy. Existing account deletion, active provider collection and statutory billing records must be reconciled separately.

## Remaining evidence

Before real processing: controller acceptance of the concrete necessity/balancing and review criteria, public disclosure of purpose/basis/categories/retention criteria/rights, and verified erasure/restriction handling. No source reviewed certifies indefinite retention. The reconciled Opus 5 review permits local empty schema/synthetic tests while retaining this gate before any real claim write, including backfills, webhooks and support imports. This draft has not passed the real-processing gate.
