# Co-founder discussion: privacy representation and app retention

Prepared 11 September 2026. **Parked for Nick and Jonas to discuss later. No answer needed now.** Nick explicitly asked that these questions not block independent scanner planning. Recommendations below are proposals, not approved policy, purchases or appointments.

## Already settled — no need to reopen

- Haarmony is a two-member US LLC with partnership taxation, as confirmed by Nick.
- Nick is registered in Switzerland; Jonas is not registered in Germany. Jonas's actual place of operation has not been established here.
- The iOS scanner is free. Web and app share the account and hair profile. The first iOS version has no Merkliste; existing web lists remain covered by shared-account deletion.
- Account deletion removes personal app data and ends future web subscription renewals; it does not automatically refund purchases.
- An open payment-support case must not keep the hair profile or Merkliste alive. Retain only necessary case/contact information; delete resolved cases after the existing 90-day period.
- Stop marketing and scan notifications on deletion. Necessary case/deletion-completion messages remain possible.

## Questions to decide together

### 1. Shall we use an external EU privacy-representative service?

**Recommendation:** use a specialist service if the Article 27 requirement applies, rather than assign the role to a founder without an appropriate EU establishment. A founder is not required. Headspace and Calm both publicly name external representatives.

Agree who will compare/select the provider, the acceptable quoted cost, and who signs the written mandate for Haarmony. Provide a short processing description and publish the provider's approved contact details after appointment. Confirm the applicable establishment position before signing; Swiss registration alone does not establish an EU representative.

Decision: ______  Owner: ______  Provider / budget: ______

### 2. What deletion deadlines should we promise?

**Recommendation:** delete ordinary personal data from live systems promptly, with an operational maximum target of **30 days**; expire deleted copies from backups within **90 days after live deletion**. Disable normal use and notifications when deletion begins. This is not a 30-day waiting period.

These are proposed service targets, not generic statutory deadlines. Verify provider backup settings before making the promise. Required financial records and minimal unresolved support-case records remain separate; uncertain subscription cancellation follows the agreed recovery process.

Decision: ______

### 3. Should unused free accounts eventually expire?

**Recommendation:** after **24 months without authenticated activity across app or web**, give **30 days' advance notice** and delete if the user does not return. Exclude accounts with paid access or purchased-content rights; their continuing purpose needs separate review.

This is a new proposed product behavior, not a current feature. Alternative: defer automatic expiry and explicitly review dormant accounts until an expiry policy is settled. Neither alternative authorizes indefinite retention without purpose review.

Decision: ______

### 4. Are these limits appropriate for the scanner's technical data?

**Recommendation:** adopt the following proposed limits, subject to implementation checks:

| Data | Proposed treatment |
|---|---|
| Camera feed | Decode barcodes on-device; no saved/uploaded camera feed. |
| Ordinary scanner diagnostic records | Delete within **30 days**; minimize identifiers and exclude full hair answers. Preserve the existing shorter web-server-log policy. |
| Personal product-research request association | Keep while needed for the open request, then remove within **90 days after completion/closure**; account deletion overrides this. Review unresolved requests at six months. Public product facts can remain without submitter identity. |
| Push device association | Revoke/remove on logout, account switch or deletion; stop sends when deletion is requested. |

The existing **90-day policy for quiz answers without an account** remains the starting contract. No scan-history feature is introduced.

Decision / exceptions: ______

### 5. Who will settle the required-record schedule?

**Recommendation:** assign one founder to obtain a bounded US/EU tax-record review or equivalent reliable evidence. The deliverable is a short list of required invoice/payment/contract fields, applicable retention periods and when each period starts, including whether VAT OSS applies. Ownership and partnership taxation are already confirmed; do not reopen them as a prerequisite.

This is not a choice between arbitrary three-, eight- or ten-year periods. Keep financial evidence separate from app data. Also resolve the minimum proof of marketing consent and unsubscribe suppression with the relevant privacy review; unsubscribed users must not be re-enrolled by later imports.

Owner: ______  Target date: ______

## What can proceed while these are parked?

Continue independent scanner planning, approved scanner/result design, API contracts, assessment logic, camera UX, account/profile journeys and ordinary dependency checks. Subsequent implementation of a separable slice still needs its own confirmed scope and journey; these parked items do not globally block such a slice.

Do not silently implement proposed deadlines, dormant-account deletion, changed consent collection or legally sensitive retained-field transformations. Representative procurement, final public legal wording, affected data cleanup and production release remain dependent on their specific answers/evidence. Account deletion remains required release scope; it has not been dropped from v1.

**Technical checks for Codex, not another founder questionnaire:** verify DOI enforcement, actual data/SDK flows and backup limits; assess existing consent/legal-basis inconsistencies and potential health-related scalp data before changing onboarding or publishing claims. Report only resulting consequential choices to Nick.

## Return the answers

1. External representative: ___; owner/provider/budget: ___
2. Live deletion 30 days / backups 90 days after live deletion: ___
3. Free-account inactivity 24 months + 30-day notice: ___
4. Scanner technical-data limits / exceptions: ___
5. Required-record review owner / target date: ___

## Supporting material

- [Full proposed retention schedule](legal/retention-proposal.md)
- [Updated legal drafts and unresolved facts](legal/README.md)
- [Technical deletion map](deletion-data-map.md)
- External representative examples: [Headspace](https://www.headspace.com/privacy-policy), [Calm](https://www.calm.com/privacy-policy).
- Rules/background: [EDPB territorial-scope guidance](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf), [Irish DPC on retention](https://www.dataprotection.ie/en/faqs/responsibilities-data-controllers/how-long-should-personal-data-be-held-meet-obligations-imposed-gdpr), [EU Commission OSS records](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop/record-keeping-and-audits-oss_en).
