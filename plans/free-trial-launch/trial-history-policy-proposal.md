# Trial-history policy proposal

14 September 2026. Prepared at Nick's request. Internal policy proposal, not an accepted retention policy, legal clearance or instruction to process real identities. Supplements the [implementation assessment](trial-history-implementation-assessment.md) and [independent findings](independent-launch-checks-2026-09-14.md). No production copy or behavior changes in this document.

## Recommendation and limits

Keep the already-approved minimal used-trial record after ordinary account deletion, subject to a documented necessity assessment and enforceable rights handling. Do not use account deletion to reset eligibility automatically; do not promise detection after a lawful complete erasure.

The proposed purpose is preventing repeated introductory access, not labeling a person fraudulent. The proposed basis is legitimate interests, requiring an actual necessity and balancing assessment. The commercial rule alone is not sufficient justification. [EDPB lawful-processing guidance](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en).

The missing consequential choice is how to bound continued retention. Two approaches remain for review:

| Approach | Concrete rule | Tradeoff |
| --- | --- | --- |
| A — criteria-based retention, closest to the approved product rule | Retain only while the same first-time trial program operates AND a current documented assessment supports continued matching for the affected records. Delete earlier when necessity ends or a valid rights outcome requires it. Program closure is an explicit deletion trigger. | Avoids an arbitrary time-based eligibility reset, but requires substantiated continuing necessity; an annual signature or permanent offer does not establish that necessity by itself. |
| B — fixed maximum retention | Adopt an evidence-supported maximum after trial use/account deletion, then erase the matching record even if the program remains available. The one-trial commercial rule remains, but cross-account detection becomes incomplete after erasure. | Simpler to operate and explain, but narrows enforcement compared with the original request. No arbitrary number of months is represented here as a legal requirement or an approved default. |

Recommend evaluating A first to preserve the agreed direction. If necessity cannot support it, return the specific maximum-retention tradeoff to Nick before implementing it. Current evidence does not establish abuse frequency, avoided cost, repeated-attempt age or a justified maximum; this draft does not invent those facts. Accordingly, neither approach is implementation-approved yet.

## Proposed operating rules

1. **Minimum data:** versioned HMACs of the verified account/email and reliable provider identity; provider/environment namespace; consumed timestamp; policy version; opaque grouping sufficient to act on all related claims. No card details, raw fingerprints, IP/device tracking, quiz content or marketing use. Access limited to the billing service and authorized support process.
2. **When used:** reserve during a verified attempt; consume only on successful authorization/admission. Failed or abandoned attempts remain unused and are released after provider reconciliation. Do not store a permanent blacklist entry for an unactivated attempt.
3. **Ordinary account deletion:** remove profile content through the existing deletion flow. Retain only justified used-trial claims under the disclosed policy. Account deletion remains possible. Provider collection and legally retained payment records are handled separately.
4. **Mistaken match:** support verifies the requester proportionately, checks the original activation and relevant linked claims, and corrects erroneous attribution. Sharing a payment method remains a disclosed limitation of the approved eligibility rule; it is not itself evidence of fraud. No automatic paid signup or charge follows a denial.
5. **Restriction or objection:** record the request and assess it through the rights procedure. Where processing is restricted, suspend the affected matching and reconstruction; do not replace it with another identity-based block. A permitted storage exception is not permission to continue eligibility matching. A legitimate-interest objection needs its own assessment. [EDPB rights guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).
6. **Accepted erasure:** remove all applicable linked claims and prevent late events, backfills, support imports or backup recovery from rebuilding them. Retain only separately justified minimal operation-level suppression when necessary; it must not identify the person for renewed eligibility denial. Completely erased identities may no longer be recognizable.
7. **Necessity review:** proposed accountable owner is the operator responsible for billing/privacy at Haarmony LLC; a named assignee must be recorded before processing. Review before launch, at least annually thereafter, and on program/purpose/legal changes or material mistaken-match evidence. Record affected data groups, credible benefit, rejected less-intrusive alternatives, impact, continuing justification and the next review. If justification is absent, stop affected matching and resolve deletion; do not silently renew retention.
8. **Deletion triggers:** accepted erasure, corrected erroneous records, documented loss of necessity, or permanent end of the relevant trial program. Disabling enrollment temporarily or changing a coupon does not by itself prove the program ended. Exact deletion execution and backup handling must be implemented and verified before real writes.

GDPR requires purpose-limited storage and transparent retention periods or determining criteria. This proposal does not claim that a lifetime commercial eligibility rule establishes lawful lifetime storage. [GDPR Articles 5 and 13](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).

## Implementation handoff and verification

Targets: `trial_identity_claims`/`trial_enrollments`, the server-only identity/admission helpers, existing account deletion and support handling, all future provider/webhook/replay writers, and `/datenschutz`. Public wording will be shown in its existing layout before publication; this internal proposal is not that UI evidence.

Before real processing, complete the necessity/retention decision, name the responsible operator, implement all-claim correction/restriction/erasure and replay suppression, and test deletion/recreation, shared-method mistakes, key rotation, late callback/backfill, restricted matching and backup restoration. Do not rely on an off checkout flag to protect unrelated writers.

Decision coverage: **pending only for the retention/rights handoff**. The original commercial and offer journey decisions stay confirmed. Nick authorized preparation on 14 September; he has not accepted a retention approach, designated an operator or approved new disclosure wording. No new undiscussed assumption is being implemented. Counterpart review and any required public-copy evidence remain before implementation handoff. Retain this proposal with the eventual PR and replace alternatives with the chosen policy once resolved.
