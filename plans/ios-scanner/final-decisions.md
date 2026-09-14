# Final implementation-plan decisions

2026-09-11 · implementation plan revision 9 / first-build revision 5.
Status: first-build handoff confirmed; public-v1 functional journey and designs confirmed; dependent release policy work remains parked.

## Settled — no new vote

- Native SwiftUI, iPhone, iOS 18+, German, public free scanner launch.
- Same account and hair profile as web; regular quiz before email; code + login link; existing completed users skip quiz.
- Scan and Profile; automatic camera with search fallback; approved assessment, complete alternatives, explanations and product-specific Kaufen ↗ actions.
- No native Merkliste, routine, chat, paywall or payment implementation. Existing web features remain.
- Profile answer editing; missing-product category submission with email + optional push when ready; shared account-management/deletion behavior retained for public release.
- The initial existing-test-account development milestone is build order, not a different public product. No scanner design restart.

## 1. Product-policy alignment before connected integration — E3

**Confirmed by Nick:** keep full alternatives and hair-answer editing free in this first iOS release; retain existing web premium rules. Nick explicitly accepts the temporary difference for the small-app test, with broader app features later. E3 no longer needs a decision. Shared identity/profile/calculations stay one; this does not authorize production changes or web premium access grants.

No removal/masking of approved alternatives, no native paywall or edit restriction is proposed. Those would reverse the settled user instruction.

Implementation must not call a platform string an authorization boundary. A native facade is available to eligible authenticated users; therefore native full-result delivery cannot also promise that those same users can never retrieve these details outside the iPhone UI. Verify actual current merged freemium contracts before modifying shared services. This question settles intended product access, not permission to use an insecure check or change production now.

## 2. Shared-backend sequencing — E4

**Confirmed with Nick, updated:** the freemium program is to be merged but remain inactive behind its feature flag. Reuse the merged application backend for iOS without activating the web freemium product. Add or adapt the narrow native admission/auth/profile integration where existing entry points are flag-gated; reuse deterministic calculations and persistence where compatible. Do not infer that merged code, deployed code, applied migrations and enabled behavior are the same thing.

**Audit complete:** [PR #531](https://github.com/NickRuppy/hair_concierge/pull/531) merged at `469d41f5e81f44702c94829c0ed312e732b01172`. The [one-time backend audit](merged-backend-audit.md) records reuse boundaries and 19 passing unit tests; the watcher is paused. Production flag/migration/deployment status is reported by the parking memo, not freshly provider-verified.

Reuse deterministic calculations, ordinary-quiz source adapters and catalog/results. Native bearer admission, quiz binding and safe scanner-context publication remain implementation tasks. The parked free writer requires a prepared artifact and can affect paid-plan state; do not use it as the native profile-edit writer. Preserve the shared profile/calculation authority and paid routines. No new product decision, flag activation or production write follows from this finding.

## Final journey checkpoint — confirmed 2026-09-12

Nick reviewed the connected walkthrough (open at `#answers`) and said on 2026-09-12: “Okay I think we can start with this. Yeah sounds good. Can we do the implementation plan then, including all the designs that we had from before?” This confirms the connected journey and requests the finalized plan. Earlier result/CTA approvals remain in force. It does not approve parked policy details, fixed fixture assessments as domain truth, or production publication.

[Implementation handoff](README.md) and [all designs](design-handoff.md) govern execution. No repeated journey approval is needed absent a material change.

## Parked co-founder work — no answer requested now

[Co-founder questions](cofounder-questions.md): representative, retention/backup deadlines, dormant accounts, technical-data limits and required-record owner. They block their dependent cleanup/legal/public-release work, not the isolated scanner development milestone. No candidate duration/vendor is approved. Consent/basis/contract evidence checks in `legal/README.md` remain assigned to Codex; surface resulting material decisions only after checking the existing implementation, without inventing new onboarding steps.

## Setup checks owned by Codex

Integrate the pinned backend audit findings and validate changed dependencies; isolated local backend and test email; compatible simulator; app bundle/team/domain configuration; current DUNS/membership state; real-device code/link/camera/push verification; sender/consent mappings and public listing. These are operational prerequisites to verify in their tasks, not another feature questionnaire. Ask only for missing account facts or actions that actually require the owner.

Artifact disposition: keep with the plan and eventual PR; no production changes or publication in this planning pass.


## Connected journey evidence — 2026-09-12

[Clickable walkthrough](evidence/walkthrough.html) stitches entry, approved result, research/notification and Profile/recovery routes together. [Evidence and limitations](evidence/walkthrough-README.md). This is the public-v1 journey; the existing-test-account first development milestone remains the initial implementation slice. Nick reviewed and confirmed this artifact on 2026-09-12 within its documented limitations. Co-founder policy decisions remain parked outside their dependent work. No repeat backend audit or new product fork.
