# First iOS build — existing-account scanner

> **Approved scope update — 2026-09-11:** First iOS smart-scanner version has **no Merkliste**. Keep the approved result design, complete alternatives and explanations. Remove Hinzufügen/save/remove actions; retain Kaufen ↗ per product, omitting the main footer if its shop link is missing. [Approved CTA evidence](evidence/scan-ergebnis/smart-scanner.html) and [decision record](decisions.md) are authoritative for this release. Save-related implementation tasks have been removed from this release; this note does not authorize broader scope or web entitlement changes.

Revision 5, 2026-09-12. Development milestone approved by Nick: “Sounds good as a first starting point” in response to the six-step existing-test-account journey. Parent: [implementation plan](implementation-plan.md). This is a development build, not a public release or scope reduction of v1.

## Outcome and source context

An existing completed test account can sign in, scan/search, read the approved personalized assessment and alternatives, view its hair answers and recover from camera/network/unavailable-result states. Reuse the chosen SwiftUI design and TypeScript assessment authority. The [co-founder questions](cofounder-questions.md) remain parked; no unapproved retention periods or representative appointment.

Worktree: `.worktrees/ios-scanner-plan`, branch `codex/ios-scanner-plan`; inspected HEAD `7bfec1dc`, original parent code baseline `2a87014e`; merged-backend audit baseline `469d41f5e81f44702c94829c0ed312e732b01172` ([audit](merged-backend-audit.md)). Before production implementation, use the repository worktree workflow and reconcile current shared-service changes. Do not copy paid-access assumptions from a stale baseline or overwrite concurrent freemium work. Keep this plan/evidence with the implementation PR.

## Chosen direction and scope

Native Swift/SwiftUI, iOS 18+, two tabs Scan and Profile, shared account identity and server-side assessment. Existing-account email code and login-link support, bearer bootstrap, completed-profile admission, barcode/manual search, result/explanation/carousel, buy-link opening, read-only profile, logout/session recovery.

Non-goals in this milestone: new-user quiz/lead capture, profile edits, new product research submission/delivery, APNs, email changes, account deletion/retention jobs, dormant-account expiry, legal publication, marketing enrollment, organic acquisition changes, App Store distribution. They remain in the parent v1 plan. Profile does not show nonfunctional edit/delete controls in this development build; do not ship that restriction as the public app.

## Decision coverage — confirmed

- **Confirmed with Nick:** the six-step development journey in this task; existing completed test account first; SwiftUI/iOS 18+; scanner result design; purchase-only actions with full alternatives and no native Merkliste; read-only existing hair profile for this first milestone; camera/manual fallback and unavailable/network recovery. These approval anchors precede this scoped written plan.
- **Inherited from evidence or contract:** parent auth/context/assessment/alternative contracts; real per-category authority; existing web entitlement boundaries, routine ownership and paid context provenance; server-owner authorization and profile-read failures distinguished from missing profile.
- **Implementation defaults:** versioned bearer facade, Keychain, synthetic fixture accounts/catalog in a local Supabase database, local email capture, no production credentials or live messaging used for test writes; isolated runtime settings checked before migrations or account creation. Same local backend powers native and web integration tests. Simulator fixtures exercise scanning until authorized real-device QA. Build standard Xcode project and committed dependency locks; inspect package/runtime compatibility before installing dependencies.
- **Confirmed access policy (E3):** Nick accepts full free iOS alternatives while web retains premium rules. **Confirmed E4 direction:** use merged backend with web freemium still disabled. **B0 source audit complete:** required native adaptations are documented; isolated integration verification remains B2 work. The parallel web freemium plan premium-gates full alternative identities and profile edits, while this task approves a free native experience. Preserve both existing decisions in their respective plans under Nick’s confirmed temporary platform-access decision; no shared production entitlement change. The first isolated test build can model the accepted native journey without deciding public web entitlements. Full-app policy/consent/procurement/deletion work is explicitly parked outside this scope by Nick. Test fixtures must not be mistaken for existing production users. If an implementation requires production accounts, a new provider project, a paid service or a change to shared paid access, surface that scope change rather than infer authorization.
- **Coverage acknowledgement:** Nick explicitly accepted the six-step first-build journey on 2026-09-11. Nick subsequently approved the no-Merkliste scanner and purchase-only mockups. Revision 3 reconciled that correction; revision 5 records Nick’s connected-walkthrough approval on 2026-09-12 and the complete design handoff. Prior technical review remains recorded. Do not ask for the same milestone approval again absent a material change.
- The cross-platform access question E3 and flag-off integration direction E4 are confirmed by Nick; B0 has identified the technical adaptations needed to preserve them. Do not claim a complete production integration handoff. Scanner/action evidence and connected login/profile/recovery walkthrough are approved. The existing-account first milestone remains the initial portion of the same public app.

## Authoritative interfaces and behavior

Use parent contracts in `implementation-plan.md`, narrowed as follows:

1. Existing-account auth start/verify uses one attempt for code and link, one-use/expiry controls, neutral anonymous responses and no public account enumeration. Do not create missing accounts: enforce provider no-signup behavior and verify it in tests. No onboarding lead creation, consent update or Customer.io identity/campaign calls in this slice. Missing account/profile is an access-restricted development case, not a fabricated default profile.
2. `bootstrap` returns `ready | profile_required | temporarily_unavailable` for the verified owner; logout remains available. A failed read/compute must offer retry and never masquerade as missing answers. An incomplete test account sees a factual unavailable message and can return to login; no new quiz is implied. No new grant of paid/web access.
3. A scanner-only store is needed on the inspected baseline because existing snapshots require `personal_plans`; do not create paid plan records to evaluate a free user. The completed B0 audit found that the parked free-snapshot writer is unsuitable for this no-paid-mutation contract. Reuse the legacy-quiz source adapter and calculation; implement the planned scanner-context publication persistence with one shared scanner loader. Avoid two independent authoritative projections. Provision a scanner context only from complete, owner-bound persisted source answers, reusing valid compatible detailed sources where available. Use parent source-version/engine/hash precedence. No profile editing or paid-plan/routine mutation. A context derived from a read snapshot must recheck that snapshot revision before publishing; stale or unversioned source ambiguity returns retry rather than guessing. Read-time reconciliation covers existing web-side changes, without requiring the later native-edit feature.
4. Resolve/search accept only barcode or catalog product identity; server derives UID/context. Expose all approved comparison rows, safe shop URL and native max-five verdict→price alternatives. Preserve web defaults. Existing not-needed and unsupported target outcomes remain semantically distinct. Known products with an unevaluable personal target retain exact approved D3 headline `Noch nicht einschätzbar`; they must not be sent to research. Missing product facts show `Für dieses Produkt liegt noch keine Einschätzung vor.` with close/continue in this development slice; do not pretend a research submission or notification occurred. The full v1 research flow is deferred, not removed. This interim close/continue copy is development-only; public-release acceptance must exercise the T3/T5 category-submission and notification flow instead.
5. Profile GET exposes saved answers only. Logout clears local session, personal cache and in-flight work. No draft edits, sensitive sample logs, lifecycle marketing events or dormant cleanup. Retained SDK logs must not acquire unapproved broad personal payloads.

## Designed user journey — the accepted first milestone

1. Existing completed **test** user enters email, receives a local test email containing code/link and verifies either. Reopening an authenticated app resumes the account. Expired/wrong codes offer retry/resend; a loading failure keeps the account and offers retry. Missing completed answers does not admit the scanner.
2. Scan asks for camera permission on first entry and activates on subsequent entries. Denial keeps product search/manual barcode entry usable. Offline/read failures preserve the requested barcode for retry. Returning from background resumes only when Scan is visible.
3. Product image/name/brand, verdict, mismatch summary and all comparison rows appear in the approved sheet. Definitions and alternatives remain available. While a sheet is open, detection cannot replace the result. Dismissal re-arms scanning. Missing shop link hides buy; buy opens the supplied safe partner URL without purchasing anything automatically.
4. Profile shows the saved answers and provides logout. Editing and destructive account actions belong to later milestones. Switching accounts never shows another person's cached results/profile.
5. Network failure, denied camera, unknown product and unavailable personal assessment all have a visible way back to scanning/search or retry; no fabricated assessment or submission success.

## Planning evidence

- [Approved smart-scanner result/actions](evidence/scan-ergebnis/smart-scanner.html): table/explanation/carousel and purchase-only actions, no Merkliste; Nick approved 2026-09-11. [Record](evidence/scan-ergebnis/smart-scanner-README.md).
- [Existing login/recovery/Profile mockups](evidence/ios-flow-review.html#login): reference for those surfaces only; old scanner/result screens are superseded. Its new-quiz/edit/deletion controls and launch claims are outside this milestone, not implementation requirements for the development build.
- [Earlier first-build walkthrough](evidence/first-build-review.html): historical login/profile/recovery reference; its Merkliste navigation and result image are superseded and must not be implemented. Use the approved smart-scanner link above for results. Final joined walkthrough must remove those historical links.
- Evidence status: scanner/actions explicitly approved; prior milestone accepted, now reduced only by removing Merkliste. B0 source audit is complete; the joined login/profile/recovery walkthrough was confirmed on 2026-09-12, completing the scoped user-facing handoff.

## Target map and ordered tasks

B0's one-time source audit is complete at the merged #531 baseline. [Findings](merged-backend-audit.md) establish reusable calculation and source adapters, plus required native admission and safe scanner-context publication. Web freemium stays flag-off; do not call the null-enrollment paid-plan RPC or create a second profile/assessment authority. B2 owns implementation and real isolated integration verification.

### B1 — Repeatable local native/auth setup

Consumes: existing quiz vocabulary/profile schema, isolated local backend, selected runtime. Produces: `ios/Chaarlie/{App,Auth,Networking}`, authenticated client/bootstrap contract, two completed synthetic accounts (one free, one with a compatible detailed source), one incomplete account, nonpersonal catalog fixtures and local mail capture. Create `src/lib/mobile/{contracts,auth}.ts`, `src/app/api/mobile/v1/auth/**`, bootstrap route and a dedicated local seed/check script under `scripts/mobile/`.

Xcode 26.6 is installed. Only iOS 17.2 simulator runtime was found on 2026-09-11; install a compatible runtime for the iOS 18+ target during setup. Do not boot many simulators or activate a camera during planning. Inspect existing local database/container tooling; if unavailable, complete the isolated setup before DB/auth integration. Do not repurpose `.env.local` merely because a local web server can start: it may point at production. `docs/local-qa-access.md` dev login seeds paid access and is not proof of free-native admission.

Done when: native compiles, local test email/code flow creates a real authenticated session for an existing fixture, unknown account creates no auth row, wrong/expired/replayed code/link fail, first user cannot claim second user's source, and web password/reset/link behavior is unchanged. No live Customer.io hook or analytics egress from the test backend.

### B2 — Read-only completed-profile context and mobile results

Consumes: B1 verified UID, local catalog/source fixtures. Produces: `src/lib/mobile/{profile-service,scan-service}.ts`, shared scanner-context publication persistence/migration following the completed B0 audit, pure result adapter and mobile profile/resolve/search routes. Extract shared services from the existing web resolver; do not invoke paid HTTP routes or paid Stage-1 admission just to evaluate a free account. Full profile-edit transaction remains parent T2 follow-up; this task owns safe idempotent read-time context provisioning and stale-source rejection.

Done when: free completed fixture produces an authoritative result; incomplete user is denied; failed reads retry; compatible paid/detail fixture preserves the relevant targets; concurrent source change cannot publish stale context; native rows/alternatives match authority and approved order; no profile/paid plan/routine/billing mutation. Fresh local migrations and current web route/entitlement regressions pass. Check migration timestamp/version uniqueness against the refreshed integration base and run the repository migration-order guard before applying locally.

### B3 — Native scanner and assessment

Consumes B2 DTO/context and B1 auth. Deliver AVFoundation scan/manual-search → approved result/explanations/alternatives → resume, with generation-bound retry and camera-denial fallback. Done when this loop passes native fixtures before the separate Profile UI checkpoint; preserve a compiling checkpoint.

### B4 — Read-only profile and account-safe recovery

Consumes: B3 scanner/result client, B2 profile DTO, B1 auth. Produces: `ios/Chaarlie/Profile`, read-only profile and logout/session recovery integrated with Scan. No wishlist service, route, screen or save UI. The parent T6 milestone adds edits/email changes/deletion before public launch; a read-only development build does not change that promise.

Done when: saved fixture answers render correctly; logout, account switch and expired session clear personal cache and reject late completions; the five-step journey works against the isolated backend; free-native fixture never gains paid web access. Read-only profile omits deferred controls. Dynamic Type/VoiceOver/safe areas checked against the approved design. No web list/routine mutation from scans or purchase actions.

## Verification

- Automated: Swift decoding/unit/UI fixtures; existing and new auth/owner/resolve tests; pure deterministic context/presentation tests first; real local Postgres migrations, RLS, concurrency and unchanged routine-row assertions. Do not call fixture equivalence alone proof of server integration.
- Manual: one simulator at a time, code/link login through captured email, source-preserving retry, full approved scanner/result/alternative/shop/dismissal journey, read-only profile/logout, large text and VoiceOver. Simulator-generated barcodes are not physical camera proof.
- Physical device: verify scan/permission/foreground recovery when a suitable iPhone and signing path are available. Distribution/signing/Universal Link association facts are explicit prerequisites for their actual device tests; simulator/core work may proceed. Do not claim Universal Links verified using a plain URL handler or mock.
- No production migrations, writes, live customer email, marketing enrollment, partner purchases, App Store submission or deployment in this handoff. Before shared-code publication, refresh against current main and review any changed contracts.

## Review and handoff

Revision 2 read-only counterpart review completed; revision 3 removes list scope and makes E3 explicit; [local disposition](first-build-review-findings.md) records accepted fixes, the surfaced cross-platform question and rejection of reopening the explicitly approved development-only scope. Review covered this plan, focusing on auth (no accidental signup), local environment isolation, free vs paid source authority, purchase actions and whether narrowed tasks still depend on deferred consent/deletion work. Prior full-plan review/dispositions are in [review findings](review-findings.md); do not repeat unrelated policy debates. Reviewer must not edit files, run mutating/live commands or dispatch another reviewer; return terminal findings with code evidence.

Nick confirmed the connected walkthrough on 2026-09-12, retaining the previously accepted development milestone. [Design handoff](design-handoff.md) includes all approved designs and explicitly historical alternatives. No repeat milestone approval is needed unless implementation exposes a new consequential choice. Implement through `implementation-loop`; it owns ready-check and whole-branch code review. Commit/push/publication remains separately authorized.

Artifact disposition: commit this plan, relevant shared design/evidence and durable reviewer dispositions with eventual PR; transient raw reviewer output stays in `/tmp` and is discarded after its findings are captured. Never discard other agents' designs or the parent's later-release work.

Decision coverage: confirmed for B1–B4. Nick reviewed the connected walkthrough (open at `#answers`) and said on 2026-09-12: “Okay I think we can start with this. Yeah sounds good. Can we do the implementation plan then, including all the designs that we had from before?” This confirms the connected journey and requests the finalized plan. Earlier result/CTA approvals remain in force. It does not approve parked policy details, fixed fixture assessments as domain truth, or production publication. Undiscussed consequential assumptions affecting this handoff: none. Co-founder policy work remains explicitly outside this milestone.


## Connected journey evidence — 2026-09-12

[Clickable walkthrough](evidence/walkthrough.html) stitches entry, approved result, research/notification and Profile/recovery routes together. [Evidence and limitations](evidence/walkthrough-README.md). This is the public-v1 journey; the existing-test-account first development milestone remains the initial implementation slice. Nick reviewed and confirmed this artifact on 2026-09-12, subject to its documented fixture/provider/policy limitations. Co-founder policy decisions remain parked outside their dependent work. No repeat backend audit or new product fork.


B1–B4 implement the initial portions of parent T1–T4/T6. Reuse these modules in subsequent milestones; do not build a second app or duplicate services. [Build order](README.md) and [design acceptance map](design-handoff.md) are part of this handoff.


Final consistency review: [handoff-review.md](handoff-review.md). No material defects; B1–B4 handoff confirmed. T4 scanner/result UI is complete in this milestone; its physical-device release verification remains T7.
