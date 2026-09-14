# iOS scanner — decision notes

## Current implementation scope — iOS first

- Nick confirmed in the final planning interview: implement the adapted iOS app first. The web scanner redesign is a separate follow-up, outside this implementation plan.
- Include shared backend changes required by native onboarding, authentication, assessments, Merkliste and notifications; preserve existing web behavior. Shared design documentation is not authorization to implement the web redesign in this release.
- The latest result-screen walkthrough was accepted ("ok looks good"). Full implementation-plan review and complete app-journey sign-off remain pending.
- Nick confirmed one shared, account-owned Merkliste across iOS and web. Saves and removals on either surface affect the same list; existing entries remain available after app login or reinstall. iOS saving/removal must leave existing web routines untouched. This supersedes the earlier wishlist exclusion and settles cross-platform list ownership.

Revision: 6, 2026-09-10. Status: discovery notes; not an approved implementation plan.
Source: Nick's decisions in the iOS planning conversation. Repository evidence checked at `2a87014e426b47d24f07cdbe52e8a1e051fbe3f0`.
Worktree: `.worktrees/ios-scanner-plan`, branch `codex/ios-scanner-plan`.

## Planning contract

Outcome: publicly launch a useful, free iOS scanner with personalized product assessments, supported by the regular quiz and a minimal profile.
Constraints: ship mobile first; preserve current product eligibility and assessment semantics; qualify scanner access using verified email plus completed quiz; minimize onboarding friction.
Non-goals: scan history, routines UI, chat, Personal Plan UI, subscription/paywall, synthesized hair analysis, quiz report, web component consolidation or scanner redesign, Android launch, or a KPI-definition project. The shared Merkliste is in scope under the later confirmed rulings.
Done when: remaining consequential decisions are resolved, real repository dependencies mapped, current screen evidence reviewed, executable plan reviewed by Claude, and the complete designed journey explicitly confirmed by Nick.
This turn records decisions and open questions only. No application implementation or publication is authorized by these notes.

## Decision coverage — pending

### Confirmed with Nick

1. Nick explicitly selected Swift + SwiftUI for the initial iPhone app, prioritizing direct Apple-platform development and accepting a separate Android client later if needed. This supersedes React Native/Expo for the mobile client. Preserve the existing TypeScript backend and its assessment/research authority; integrate through deliberately authenticated mobile APIs. Xcode is the iOS build/debug/simulator/signing toolchain. No implementation or tool installation is authorized by framework selection.
2. Build native mobile screens from the current regular, shorter quiz. Separate question definitions, validation and flow from platform rendering where practical. Do not migrate the web quiz now; retain the ability to consolidate later.
3. Support both direct app acquisition and website quiz -> app acquisition. Marketing can continue testing multiple web funnels.
4. New app users complete the quiz before entering/verifying email. Website users fully submit quiz and email before the app handoff. Partial or unsaved submissions do not qualify.
5. Send the personal login email after successful website quiz submission. Include both a login link and a code. Using either verifies inbox access and signs in; no separate registration/password step.
6. App login always exposes email entry -> send code -> enter code, including opening directly from the App Store. Prefill email when reliable context exists. No requirement to reopen the website.
7. If a link is opened before installation, offer the download; afterwards the user reopens the link on the phone or uses app email/code login. Do not promise automatic transfer through installation.
8. Login links/codes expire and are single use; the pair for one attempt must not remain independently reusable after successful login. Keep drafts during correction, resend, expiry and network errors.
9. Scanner admission requires verified email AND a completed quiz/profile. Authentication and profile-linking failures are distinct; technical lookup failure must not pretend the quiz is missing or force a retake.
10. Returning users stay signed in. Another account's link must not silently merge or overwrite the current account's data. Confirm account switching. New quiz answers encountered during login must not silently replace existing answers.
11. After onboarding/login, go directly to Scan. No quiz-result page, generic onboarding banner or synthesized hair analysis. No follow-up quiz report by email.
12. Exactly two app areas: Scan and Profile. The shared Merkliste opens via the Scan header bookmark, with no third tab. No scan history, routine integration or chat. The original wishlist exclusion was superseded by Q8 and the shared-list confirmation.
13. Scan activates the camera immediately on entry. Request iOS permission on first use; after permission is granted, subsequent entries activate directly. Pause camera when obscured/inactive. Denial retains manual search and Settings recovery.
14. Barcode scan, manual product search/barcode fallback, personalized assessment, existing alternatives when available, shop links, and minimal unknown-product submission are in scope.
15. Preserve current product eligibility. Nick's clarification: products without sufficient assessment data are not scannable. Do not invent a new partial-assessment UX; map the actual existing eligibility/submission boundary.
16. Unknown-product submission follows the current minimal category-selection path using the scanned barcode. Research runs asynchronously. Nick explicitly chose native push notifications for research completion in the parallel interview; this supersedes the former no-push scope. Tapping opens the relevant assessment, preserving the destination through login if necessary. Notify only when a usable assessment is publicly available under existing eligibility/review/publication gates. Nick confirmed both push and email for now, with a contextual notification-permission request after successful unknown-product submission. Send the result email regardless of push permission/delivery; denied permission must not block submission or result access. Transport and technical retry/deduplication details require planning. No inbox or scan history is approved.
17. Product result must have substance: individualized assessment, product-versus-target dimensions/explanations, alternatives when available and shop access. Richer result mockup direction accepted with 'yeah better'. Illustrative mock data is not domain authority.
18. Profile shows quiz responses rather than synthesized analysis. 'Haarangaben aktualisieren' reopens the regular quiz with previous answers preselected.
19. Successfully completing an explicit profile edit replaces the old answers immediately; subsequent assessments use the updated profile. Unsaved/abandoned edits must not partially replace it.
20. Basic profile/account controls accepted: email change, support, sign out and account deletion. Shared-account deletion and cancellation of future web renewals are confirmed in Q3; provider behavior and recovery still require verification.
21. Public App Store launch from the start. No invited beta as the product rollout. Release verification still includes real-device and store-submission checks.
22. Purpose: useful free scans and repeated use, then build further app value later. Do not reopen monetization or demand success-metric thresholds for this plan.
23. Website-to-app acquisition starts with the organic funnel only. Other marketing/sales funnels retain their current destinations for this launch. Direct App Store onboarding remains in scope.
24. One email/account/hair profile across app and web is explicitly confirmed. No separate app identity or profile. Account deletion and existing-subscription handling are resolved in Q3, subject to technical verification.
25. Existing customers reuse their completed compatible profiles, including Personal Plan users; no repeated regular quiz solely to enter iOS.
26. Nick challenged the need to change current contact/consent collection. Preserve its established behavior as the proposed baseline; explain required copy/destination adaptation, and inspect campaign effects instead of treating an email-only redesign as selected.
27. No Apple Developer Program membership exists yet. Preferred publishing entity: Nick's existing US LLC, through organization enrollment. Do not enroll personally or create/purchase membership without an explicit action request. Exact legal entity name and enrollment readiness remain unverified.
28. Nick subsequently explicitly requested hands-on enrollment setup using the browser. Opened Apple's enrollment page and reached Apple Account sign-in; awaiting the user's account selection/sign-in. No enrollment form, agreement, D-U-N-S request or payment submitted. The public Chaarlie impressum identifies Haarmony LLC (Delaware) and a Dover address; verify these are the intended/current entity details before submitting, and distinguish registered/mailing address from headquarters if Apple/D&B requests it. No D-U-N-S number found or verified yet. Do not treat the public EIN as a D-U-N-S number.
29. Enrollment progress update: user signed in with the existing private Apple Account; `info@chaarlie.de` is available as the intended organization contact. Skipped optional developer-interest questionnaire using 'Remind me later' and selected web enrollment. Current page is `/enroll/identity/edit`, asking for the human Account Holder's legal name, phone and residential address; region displays Germany and must match actual residence. Awaiting user entry of those details. Name becomes non-editable after Continue per the page. No personal identity form submitted by the assistant; organization selection, D-U-N-S lookup, agreement/payment and enrollment completion remain outstanding.
30. Latest enrollment state: user completed personal identity step. Assistant selected Company / Organization and advanced to `/enroll/organization/details/edit/legal-entity`, which requires legal entity name plus D-U-N-S and CAPTCHA. Opened authenticated D-U-N-S lookup in a second tab and entered known company/contact fields. No lookup submitted: headquarters region/address and phone details are still missing, as is CAPTCHA completion. Public exact-name D-U-N-S search returned no results, which does not establish absence of a record. Need to clarify whether the public Dover address is actual headquarters or only registered-agent/mail service before supplying headquarters data. Both browser tabs retained for continuation. No agreement acceptance or payment performed by assistant.
31. Current lookup state supersedes 28-30: direct D&B lookup at `my.dnb.com/lookup` returned 'No matching results found' for Haarmony LLC / ZIP 19904. User then supplied an Atlas company screenshot establishing the exact spelling **Haarmony, LLC**, Delaware LLC, and company address/phone. Repeated direct lookup with the exact comma spelling and ZIP: still no matching result. This is scoped search evidence, not proof no D-U-N-S exists. Prepared Apple's `/enroll/duns-lookup/#!/search` form using those supplied company details as lookup criteria, current Account Holder as contact and `info@chaarlie.de`. Awaiting user CAPTCHA and Continue for the Apple lookup. No new D&B record/request has been submitted. Before a new registration, confirm headquarters versus registered/mailing address and the enrolling person's authority; the Atlas named representative is a different person from the Apple Account Holder. Keep tax identifiers out of the lookup and out of these notes.
32. Apple lookup completed by user and now displays 'Your organization was not found' at `/enroll/duns-lookup/#!/request`. Request is populated with the supplied Atlas company address under the explicit 'Headquarters Address' label. Its submission checkbox authorizes Apple to share personal/contact and organization data with D&B under both privacy policies; it remains unchecked. No request submitted. Clarify actual headquarters versus registered/mail address before creating the record; screenshot's generic 'Company address' label alone does not establish headquarters.

### Inherited from evidence or contract

- German UI. `hair_texture` means pattern; `thickness` means diameter. Current deterministic assessment authority remains the source of truth.
- `src/lib/quiz/questions.ts`: existing regular question definitions are reusable inputs; browser persistence/UI requires a native implementation.
- `src/lib/auth/authenticated-app-route-access.ts:44`: current Scan access independently requires authenticated user and completed diagnostics; no subscription predicate here.
- `src/lib/quiz/completion.ts`: eligibility currently uses populated diagnostic fields, not just an email or account record.
- `src/lib/quiz/link-to-profile.ts:116`: authentication/profile linking are separate; explicit lead path supports legacy/personal-plan records, email fallback currently selects newest unlinked legacy lead. Native onboarding must not assume web callbacks run automatically.
- `src/app/api/scan/resolve/route.ts` and `src/app/api/profile/route.ts`: existing route handlers use web cookie-authenticated clients. Mobile requires a deliberately authenticated API boundary; keep assessment logic server-side.
- `src/lib/email-deliverability.ts:90`: existing format/domain checks are not proof of inbox ownership or mailbox existence.
- `src/components/quiz/quiz-lead-capture.tsx:143`: current lead capture includes name, email and a separate marketing-consent choice before saving.
- `src/components/quiz/quiz-consent-sheet.tsx`: current copy promises an assessment email/result, which conflicts with the agreed app journey and must be adapted for app acquisition.
- `src/lib/customerio/quiz-sync.ts`: quiz submissions sync traits and events into Customer.io. Repository code alone does not establish which live campaigns will send email to an app-acquired lead.
- `src/app/api/profile/route.ts:32`: profile updates write shared `hair_profiles` by authenticated user ID. Shared-account edits may affect web experiences.
- `src/lib/scan/profile-context.ts:35`: verdict evaluation actually loads a derived snapshot from `personal_plans` / `personal_plan_need_versions`, preferring refined over initial context. Merely writing `hair_profiles` is insufficient. Native onboarding must create the eligible derived context; profile edits must refresh it without silently discarding existing advanced answers or leaving stale refined results. Trace existing bootstrap/update services before designing a new path. Personal Plan UI/payment is not required by this dependency.
- `src/app/api/scan/resolve/route.ts:306`: quarantined barcode hits follow the existing unknown/pending-submission path. `src/components/scan/scan-unknown-flow.tsx` submits category only. Preserve this established behavior rather than add a catalog-withheld explanation.
- `src/lib/product-intake/notifications.ts:304,453` and `scripts/product-intake/notify-pending.ts`: existing notifications target chat, with a command for dispatching pending notifications. Approved/matched-existing results require a product ID and verified specs. The agreed email/result-link channel requires implementation; research-ready-for-review is not public-result-ready and needs no new product vote.

### Implementation defaults (proposed, not extra product decisions)

- One actual accessible code input supporting paste, appropriate keyboard and platform autofill where supported.
- Secure native session persistence, background/foreground refresh, and camera lifecycle handling.
- Keep incomplete quiz drafts during recoverable failures; retry profile linking idempotently before scanner admission.
- Treat deep-link input as untrusted; use opaque expiring references, verified user ownership and validated destinations.
- Verify auth templates/configuration so code length, expiry, resend behavior and client validation agree. Do not hardcode six digits based only on generic docs.
- Do not replace global web authentication templates blindly; inventory existing web consumers before changing them.
- Existing web flows, paid access and email campaigns are regression surfaces even though their UI is outside app scope.
- No unverified research turnaround promise, and no notification until the product actually passes assessment eligibility.

### Open consequential assumptions — resolve before handoff

Q1. **Resolved: organic acquisition only initially.** Apply the app handoff to the organic funnel; preserve other campaign/sales destinations. Map the exact organic route/configuration in the implementation plan rather than assume every regular quiz entry is organic.

Q2. **Contact behavior: preserve baseline; campaign compatibility to verify.** Nick asked what is wrong with the current flow and whether adaptation is needed. No defect in name/email/optional consent has been established. Revised recommendation: retain those fields and optional consent; adapt assessment/report promises and destinations to the approved scanner flow. The earlier email-only suggestion is not selected. Inspect current Customer.io sequences read-only to identify any actual result-page, offer, or report conflict before asking for a campaign decision. Do not silently remove marketing or enroll users in a new sequence. Screen evidence must make the minimal copy changes reviewable.

Q3. **Shared identity and deletion behavior resolved.** Nick confirmed one email, one account and one hair profile, then approved the recommended deletion behavior on 2026-09-10 subject to best-practice verification. Provide an accessible in-app deletion entry, a clear confirmation that deletion affects app and website and ends shared access, and verification of the requester when appropriate. Delete the shared account, hair profile and associated personal data, except records required to be retained under the applicable retention policy. Cancel future renewals of existing web subscriptions as part of the deletion workflow. This is implementation-scope approval, not authorization to delete any real user or cancel any live subscription during planning. Provider sequencing, retries and retention must be verified before implementation; never report deletion/cancellation success prematurely or lose billing linkage while cancellation remains unresolved. Deletion does not itself authorize automatic refunds. No paid-plan UI or Apple in-app subscription purchase is added to v1.

Q4. **Resolved: reuse existing completed profiles.** Existing real customers, including Personal Plan users, need not retake the regular quiz. Verify compatibility and derive any required scanner context internally. Temporary test/partner identities must not silently receive broader lifetime access; trace their existing contracts before surfacing a concrete exception.

Q5. **Publisher direction selected; configuration continues.** Enroll Nick's US LLC as an organization; no membership currently exists. Verify legal entity name, D-U-N-S record, enrolling person's legal authority, organization-domain email, public organization-associated website and Apple Account with two-factor authentication. Apple identifies the legal organization as seller; the human Account Holder still uses their own legal identity. Apple's published membership price is USD 99/year, subject to region pricing; no purchase authorized. App Store display name, initial storefront countries, and iPhone-only versus explicit iPad support remain to discuss. German is inherited; do not infer storefront geography from language. Recommended app-name/device direction remains Chaarlie, iPhone-first.

Evidence reconciliation before handoff: `src/lib/scan/resolve-verdict.ts:252` contains an `in_catalog` / `unknown` verdict with no evaluable dimensions when roles/facts cannot be evaluated. This is distinct from barcode `unknown_product` and means the broad statement 'incomplete assessments never happen' is not yet proven by code. Build a concrete fixture/caller trace to distinguish intended uncertainty, unreachable guarded state, and a real eligibility defect. Do not silently suppress this verdict, invent a new screen, or reopen a generic incomplete-assessment question without that evidence. If a material semantic conflict remains, present the exact trigger and alternatives to Nick before implementation.

Q6. **Framework resolved: Swift + SwiftUI.** Nick explicitly chose native Apple development and accepts a separate Android client later if needed. Keep the existing TypeScript backend; shared question definitions may need a platform-neutral representation rather than direct TypeScript imports. Determine that implementation detail during technical planning without migrating the web UI. SwiftUI is not evidence of guaranteed polish, performance, faster delivery, or a native-only performance requirement. Expo and EAS are no longer the proposed mobile foundation. Native tool integrations remain optional and uninstalled.

Q7. **Research-completion channels resolved: push and email.** Nick confirmed both channels for v1, revisitable later. Request push permission after successful unknown-product submission, when the purpose is clear. Send an email with the result link independently of push availability; send push to eligible registered devices when permitted. Both open the relevant assessment with authentication and destination recovery as needed. Denied permission does not block research submission. Token/account ownership, transport, retries and deduplication are technical planning work. Do not add inbox/history or notify before public assessment eligibility.

No full implementation handoff exists yet. Known consequential assumptions are the questions and reconciliation above; the dependency audit may add evidence-backed questions before final coverage confirmation.
Coverage acknowledgement: Nick answered the five decision groups after reviewing the revision-1 summary: Q1 organic only; Q3 one shared identity/profile; Q4 reuse existing profiles; Q2 asks to justify changes to current behavior; Q5 to discuss together. Revision 3 additionally records no current developer membership and preference to publish through the US LLC. Consolidated final coverage, deletion consequences, remaining release configuration and final journey remain pending.

## Candidate journey to make concrete

- Direct install -> regular native quiz -> selected contact/consent step (Q2) -> link/code verification -> persist/link profile -> immediate camera permission/Scan.
- Organic website funnel -> full quiz submission -> login email plus download page -> reopen personal link or enter email/code in app -> link completed quiz -> Scan. Other campaign destinations are preserved.
- Existing eligible account with its completed profile -> login link/code -> Scan; ordinary return -> Scan with persisted session.
- Scan eligible product -> substantive current assessment -> alternatives/shop links or dismiss and scan again.
- Unknown/ineligible barcode -> inherited submission behavior -> asynchronous research -> native push -> result, with login destination preserved when required. Email is also sent independently of push delivery; denied permission does not block submission. Transport/retry details remain to be specified.
- Profile -> prefilled regular quiz -> finish -> replace shared answers subject to Q3; signout/email change/deletion follow the resolved shared-account contract.
- Recoverable network, stale-link, denied-camera and profile-link failures preserve user work and offer a concrete retry/fallback. No offline assessment engine is proposed.

## Planning evidence and remaining work

Retain `evidence/ios-product-sheet-rich.html` from the conversation: accepted rich-result direction, illustrative products; not a final approved complete app journey. `evidence/ios-scan-and-profile.html` records the two-tab direction; its thin result presentation was superseded. These are copied planning artifacts, not production components. Other incidental interactions/copy in them are not automatically approved scope.

Next planning steps: discuss publishing account, store name, storefronts and device support one at a time; verify contact/campaign compatibility and resolve shared-account deletion consequences; complete targeted auth/scanner/notification dependency checks; render the final onboarding, Scan and Profile recovery states; write the implementation plan with checkable deliverables and regression boundaries; run one read-only Claude counterpart review; reconcile findings and obtain final journey/coverage sign-off.

Evidence review: partial (two-tab/rich-result direction only). Final screen evidence and full user-journey sign-off: pending.
Counterpart implementation-plan review: not run; this is a decision record, and unresolved consequential choices precede the implementation plan.
Artifact disposition: decision notes and retained mockups are intended for the future planning/implementation PR. No commit, push, release or production write performed.

## External research retained from discussion

- [Supabase passwordless login](https://supabase.com/docs/guides/auth/auth-email-passwordless): code and magic-link support.
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates): link-prefetch risks and template behavior.
- [Apple Universal Links](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html): installed-app routing versus website fallback; not automatic deferred login through installation.
- [Branch NativeLink](https://help.branch.io/developer-hub/docs/nativelink-deferred-deep-linking): optional deferred linking has additional integration/user interaction tradeoffs; no new vendor selected.
- [Apple organization enrollment](https://developer.apple.com/programs/enroll/) and [D-U-N-S requirements](https://developer.apple.com/help/account/membership/D-U-N-S/): publisher enrollment dependencies, checked 2026-09-09; no enrollment performed.
- [Chaarlie public impressum](https://chaarlie.de/impressum): candidate publisher entity details found for enrollment setup on 2026-09-09; user confirmation and D&B verification pending.

## Enrollment update — 2026-09-10

- Nick remains the intended Apple Account Holder; Jonas Eidenschink is the confirmed D&B verification contact. Nick confirmed the Dover company address is headquarters.
- The signed Atlas LLC Operating Agreement names both Jonas and Nick as Members and Managers. Jonas was entered as Managing Member in D&B. The two working owners are the only personnel; no additional employees. D&B rejected zero, so the form headcount was entered as two, including working owners.
- D&B account access for the organization email is working after user-completed password setup and successful email-code verification.
- Case DFC-674388 was opened as an existing application and advanced to supporting documents (step 5/6); no documents uploaded and no final application submission made by Codex. Do not continue it or create another request without reconciling the cofounder's active case.
- Nick reports the cofounder has already submitted an application and asks to proceed with other iOS work while awaiting the number. Current open company email from research@iresearch.dnb.com, received September 10 at 09:19 Europe/Berlin, references case 10957167 and requests a completed BIR_FORM_USA.docx plus company-name/address documentation within 72 hours. Receipt of the cofounder's response has not been verified; this is not yet evidence that only processing remains. No email sent by Codex.
- Atlas's approved formation certificate lists the Newark registered office. Its file labelled 147c Letter/Approved SS-4 is an IRS fax explicitly stating it is not the official EIN verification document and contains no company address. No official CP575/147C was found by a focused company-inbox search.
- Resume app configuration and planning while the cofounder handles D&B. App display name, storefronts, and device support remain unresolved; public launch and the agreed Scan/Profile scope stay confirmed.

## App configuration decision — 2026-09-10

- Nick confirmed **Chaarlie** as the iOS app display name. This records the naming decision; App Store name availability has not yet been checked or reserved. Haarmony, LLC remains the intended legal publisher.
- Next decision: initial App Store storefront countries. German language does not by itself settle geographic availability.

## Storefront decision — 2026-09-10

- Nick authorizes Germany, Austria, and Switzerland if adding the countries is straightforward store configuration; Germany-only is the fallback if material extra work emerges. Apple documentation confirms specific countries/regions are selected in App Store Connect. Plan initial availability in all three using the same German-language app. This does not authorize additional translations, country-specific shop integrations, or expanded commerce scope. Surface any concrete additional launch requirement rather than silently widening scope.
- Source checked: https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store
- Device scope remains next: recommend iPhone-first, with no dedicated iPad layouts in v1; not yet confirmed.

## Device scope decision — 2026-09-10

- Nick confirmed iPhone-first for v1, without dedicated iPad layouts. This is a device/layout scope decision, not a promise to block iPhone-app compatibility on iPad.
- Next consequential decision: shared-account deletion and treatment of existing web subscriptions. No deletion or billing behavior has been newly authorized by the device decision.

## Account deletion decision — 2026-09-10

- Confirmed the recommended shared-account deletion and web-renewal cancellation behavior, with straightforward confirmation and legally required data-retention exceptions. Apple guidance verified at https://developer.apple.com/support/offering-account-deletion-in-your-app/. Apple requires in-app initiation and meaningful full account deletion; it does not mandate our particular automatic web-subscription cancellation design.
- Future Apple-billed subscriptions would require Apple subscription-management handling; do not apply the web-provider cancellation assumption to them. They remain outside v1 scope.
- This resolves the previously open product decision on deletion. Existing provider behavior, failure recovery, retention policy, and final user-facing evidence still require verification and review.

## Parallel interview reconciliation — 2026-09-10

Source: user-authorized handoff from task 01a08793-9633-7f32-9af5-ed61ae2eb330. This task remains the central iOS planning record; avoid duplicate discovery questions.

- Confirmed: automatic camera barcode detection, database lookup, properties and personalized fit against the shared authenticated profile. Direct users do the quiz; eligible web users reuse their account/profile.
- New assessments require internet. Preserve a detected barcode when lookup fails so the user can retry without rescanning. No offline assessment engine in v1.
- Native research-completion push is newly confirmed, superseding the original exclusion. Email fallback and delivery recovery remain open; no My Scans inbox/history was approved. Free scanner/no paywall and Scan/Profile scope remain intact.
- Nick's estimated 50–70% iOS audience is an unverified estimate, not analytics evidence.
- SwiftUI versus React Native/Expo is the next strategic decision; no final framework choice should be inferred from prior recommendations. Shared backend remains regardless; Swift affects direct reuse of TypeScript client/question logic and later Android client maintenance.
- If Expo is selected, development builds are proposed. EAS is optional hosted tooling, not required for Expo. Xcode/local simulator and real-iPhone camera validation apply to the iOS workflow. Tooling candidates (Expo integrations, Xcode integrations, Maestro) remain unselected and uninstalled.
- Planning only: no app implementation, software installation, publication or production writes authorized by this handoff.
- Primary references checked: https://developer.apple.com/swiftui/ and https://docs.expo.dev/develop/development-builds/introduction/ .

## Final framework selection — 2026-09-10

- User-authorized update from task 01a08793-9633-7f32-9af5-ed61ae2eb330: Nick explicitly chose Swift + SwiftUI and accepts a separate Android client later if the product warrants it. This supersedes the earlier framework comparison and Expo recommendations. Do not repeat the framework interview.
- Existing TypeScript backend, assessment authority, shared identity/profile, asynchronous research, native push completion alerts, deep links, account deletion and online barcode-preserving retry remain in scope. No history/inbox was approved.
- Xcode supplies the native build/debug/simulator/signing toolchain. Do not install skills, MCPs, SDKs or other software just because the stack is selected.
- Direct Apple development is the accepted preference; neither comparative delivery time nor total effort has been established. Mockup review, journey sign-off, dependency verification and counterpart plan review remain necessary before implementation.

## Research-result notifications — 2026-09-10

- Nick approved both native push and email for now, with possible consolidation to one channel later. Email is not conditional on detecting push failure; both are intended channels.
- The preceding proposal's contextual permission request after unknown-product submission is accepted. Both messages deep-link to the specific usable assessment; preserve destination through login. No inbox/history added.
- This resolves the channel choice; notification transport, consent/settings integration, ownership, idempotency and delivery recovery still need technical verification.

## Flow mockup for review — 2026-09-10

- Evidence: [iOS flow review](evidence/ios-flow-review.html), a self-contained German HTML screen-navigation mockup. It carries forward the richer product sheet into the agreed Scan/Profile app, with quiz/email/code entry, manual search, unknown-product category submission, contextual push request, result notification and profile/account views.
- Inspected the current live `/quiz` surface (Haardichte, question 3/10) and existing question definitions before drawing the native layout. Quiz screens are representative excerpts, not a reduction from ten questions. The prior product-sheet artifact supplied the accepted hierarchy; MIRA products and verdicts remain illustrative.
- Recovery examples include invalid code, profile-loading failure versus missing quiz, account mismatch, camera denial, barcode-preserving network retry, failed submission, and unresolved subscription cancellation during deletion.
- Verified browser rendering and navigation between product categories and submission, chapter navigation, and quiz/product/Profile layouts. Checked narrow 390px rendering. The first browser render exposed a global `top` name collision; isolated the script and verified successful rendering afterward.
- This is design evidence only. No real auth, research, notifications, camera, account mutations, purchases or native implementation. Support/privacy destinations, email-change verification and subscription/deletion recovery are explicitly marked as unresolved technical contracts in review annotations. Marketing-email sequence compatibility remains to be audited.
- Status: ready for Nick's design review; feedback and explicit final journey sign-off are pending. This artifact does not constitute an approved executable implementation plan or resolve outstanding backend dependencies.

## Production design alignment — 2026-09-10

- Nick requested that the iOS mockup inherit the current production scanner and product-check experience. Inspected authenticated live `/scan`, its fallback search sheet, and Elvital/Alterra result sheets. Source mapping confirmed Plus Jakarta Sans, Playfair wordmark, plum/lavender colors, coral purchase action, 3:4 camera, three category-specific dimension rows, explanation card, alternatives and pinned footer.
- Revised `evidence/ios-flow-review.html` through local `web-alignment.css` and `web-alignment.js`, with fonts copied from the existing repository. Scope remains Scan/Profile; no save/watchlist action. The Alterra example mirrors the observed 3/3 live presentation; it is snapshot evidence, not a new assessment of the mockup account. Product artwork remains schematic.
- The live Elvital example displayed a positive verdict with 0/3 target matches. Recorded as an observed inconsistency requiring separate investigation; not silently made into a new native assessment rule.
- Production inspection activated the existing web camera; after Nick reported a computer crash, further camera inspection was stopped. Causality was not established. Continue validation only against the local camera-free mockup.
- Meaning of the user's “Prüfe page” remains to be clarified if it refers to a surface beyond the scanner assessment. Design review and final journey sign-off remain pending.

## Mobile design refinement — 2026-09-10

- Nick requested a more polished iOS treatment while preserving the live web app's identity and scanner functionality. Added `evidence/mobile-polish.css` and refined screen markup: clearer product identity, larger verdict, more legible comparison sections and legend, calmer spacing, rounded sheet controls, pinned purchase action, stronger search affordance, consistent Profile/quiz controls, and an original-size preview toggle. Native functionality remains simulated.
- Nick reopened the question of a saved list. Earlier explicit removal still controls the current mockup; asked whether to restore it via a Scan bookmark (recommended), as a third tab, or leave it excluded. No answer yet. A saved list would park products for reopening assessments/buying/removal, not certify product safety or influence routines. Decision coverage remains pending for this scope change.
- Local scanner and result screens visually inspected without live camera use. Design review remains pending; this is not an approved final implementation design.

## Readability correction — 2026-09-10

- Nick rejected the refined mockup's small typography. Corrected actual app typography: 17px primary body and actions, 16px supporting descriptions, 14px minimum chart labels and legends, 21–22px product/verdict headings. Increased secondary-text contrast, enabled label wrapping, and allowed more vertical scrolling instead of shrinking content. Removed automatic phone-preview scaling and its fit toggle; preview now renders at full CSS size. This supersedes the earlier compact 9–13px mobile labels.
- Saved-list decision remains open. No scope change introduced in this readability pass.

## Compact assessment hierarchy — 2026-09-10

- Nick rejected the large text blocks, excessive whitespace and long scroll on Scan03. Revised this mockup into a compact first view: product identity, fit verdict, three criterion values, expandable reasoning, and an alternatives entry. Removed permanent section heading, legend, scale labels and explanation panel from the collapsed view. Full dimension comparisons remain within native HTML disclosure controls. Alternatives open a separate review screen. Purchase and rescan stay in a pinned action row.
- The full-size default assessment was measured at 601px visible/content height with no internal scrolling. Browser-verified criterion expansion and alternatives navigation. Expanded details may scroll. Readability thresholds from the previous correction remain in effect.
- This is a proposed hierarchy for design review, not approval to change the production UI or assessment semantics. Non-matching verdicts must receive equally visible exception treatment in later final journey evidence. Saved-list scope remains unresolved.

## Always-visible fit evidence — 2026-09-10

- Nick explicitly rejected collapsing the main properties: users must understand immediately why a product fits or does not fit. Supersedes the preceding accordion design.
- All three properties now show a visible product-vs-target track, labeled product value and personal target, and a text/symbol fit result. Removed the separate collapsed reasoning control. A mismatch also states the specific difference in the verdict. Alternatives remain a separate view.
- Added a clearly annotated fictional MIRA mixed-fit example alongside the observed Alterra fit example; this does not redefine production verdict logic. Checked both live-rendered local views. No production or camera access. Final design sign-off still pending.

## Five assessment design directions — 2026-09-10

- Nick requested five bold, modern alternatives with high signal and low noise. Evidence: [five assessment directions](evidence/five-assessment-directions.html). All use the same fictional MIRA mask, one Pflegegewicht mismatch and two matching properties, with explicit product values and personal targets. Main reasons never collapse; alternatives open separately. No saved-list scope decision is implied.
- Directions: `#verdict` uses an editorial verdict card; `#matrix` compares product and target in two columns; `#instrument` uses a dark surface with labeled scales; `#split` leads with the mismatch and groups matching properties; `#overlay` presents an opaque result sheet above a simulated scanner strip. Current recommendations for review are matrix for direct comparison and split for quick mixed-fit decisions. None is approved yet.
- Current Apple guidance consulted: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) and [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines?lang=en). Applied clear content/control hierarchy and restrained material effects. Visual styling and the alternative-first action emphasis are proposals, not new assessment rules or validated usability findings.
- Visually inspected all five at full phone size. Checked matrix at a 390px browser viewport, larger-text rendering, and alternatives/back navigation. Larger text permits vertical scrolling; measured no horizontal document or content overflow in the desktop large-text comparison view. This HTML simulation is not a native Dynamic Type or accessibility audit. No camera, production data, account mutations, or real purchases were used.
- Chosen direction, final evidence review and journey sign-off remain pending. Native implementation remains out of scope for this design pass.

## Refined option 02 and bottom actions — 2026-09-10

- Nick selected option 02 as the preferred direction, with the product image, brand and name retained at the top. Requested a clearer table and alternatives below the assessment. Clarified that “David design” meant “table design.” Final layout and bottom calls to action remain open.
- New review evidence: [refined assessment](evidence/assessment-refined.html). Each property forms one group with the fit state beside its name, and locally labeled Product / Your target values aligned in two consistent columns. Only the mismatch receives an amber background; symbols/text also convey status. Product image remains schematic fictional MIRA artwork.
- Alternatives follow all three properties, with a first product preview and access to all two fictional alternatives. The fixed footer has two reviewable variants: A prioritizes “Weiter scannen” with “Zum Shop” secondary; B prioritizes the shop with scanning secondary. A is recommended based on the agreed repeated-scanning purpose; neither CTA hierarchy is approved. Saved-list decision remains open and excluded here.
- Research: [NN/g mobile tables](https://www.nngroup.com/articles/mobile-tables/) and [comparison decisions](https://www.nngroup.com/articles/compensatory-noncompensatory-decisions/) support keeping comparable attributes together, consistently aligned and concise; [Apple buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) informed action hierarchy. These principles inform the proposal, not a claim of user-tested superiority.
- Inspected the normal full-size phone render and 390px viewport with 20px comparison values. No horizontal page/content overflow in the large-text check; content scrolls vertically without collapsing properties. Verified both CTA selectors and alternatives/back navigation. No live camera, purchases or production changes. Final design review and journey sign-off remain pending.

## Assessment sheet design of record — 2026-09-10 (Claude session, handed in by Nick)

Source: Nick's scan-result redesign session (Claude), 17 mockup rounds plus a clickable prototype, each round reviewed by a design critic on rendered screenshots; Yuka/Vivino/CodeCheck action patterns researched for the CTA verb. Nick locked the design ("lock those designs in") and asked for it to be documented here for implementation.

Evidence: `evidence/scan-ergebnis/referenz.html` (design page from real prototype frames, with the action table), `evidence/scan-ergebnis/prototyp.html` (clickable, camera-free), `evidence/scan-ergebnis/frames/` (12 states at 375 px + production screenshot). Specification and implementation instructions: `plans/ios-scanner/design-spec.md`.

This supersedes, as the assessment design, `evidence/assessment-refined.html`, `evidence/five-assessment-directions.html` and the Scan03 assessment in `evidence/ios-flow-review.html`; those stay as historical reference. Preserved from the earlier direction: product image, brand, name, and fit/mismatch reasons always visible; alternatives below the assessment.

### Confirmed with Nick (assessment sheet)

1. Reasoning is a table: one row per property, header PRODUKT / DEIN ZIEL once, values as words, no tracks or dots. Five fixed columns, 52 px rows, values never wrap; the "i" at the row end, whole row tappable.
2. Per-row traffic light as row fill (green / amber / red), product word in the status colour, exactly one glyph (✓ ! ✕) per row. Verdict headline amber only for "Passt mit Einschränkung", ink otherwise.
3. One consequence sentence under the verdict replaces "N von M Zielbereichen"; cadence wording only where a copy table backs it.
4. Explanation per property on row tap: card above the sheet with camera dimmed, definition + "woher dein Ziel kommt" + scale; closes via X, tap beside, swipe. No "Verstanden" button. Seven definitions approved as proposed (design-spec §3).
5. Set-valued properties (Kopfhaut, Haardicke): match shows only the user's stop; miss shows the product's stops stacked inside the 52 px row; "jede" only on full catalog coverage; never a distance on unordered stops.
6. No "Unbekannt" row state: a product without complete values gets no verdict (catalog completeness gate).
7. Alternatives below the assessment on every verdict where they exist, as a carousel: one card, next peeks ~12 %, dots; heading "Alternativen" in the display serif with subline "Passen gleich gut oder besser · N" / "Passen auch zu deinem Haar · N". Best fit first, then price, max 5.
8. Default view stays light: only packshot band and name of the first card peek; verdict, sentence, price, table with header and buttons appear when the sheet is scrolled. Each card mirrors the scanned product's structure. Card image and name do nothing; rows open explanations.
9. Footer on every verdict: "Kaufen ↗" (plum outline, affiliate link) + "Hinzufügen" (coral). **No "Trotzdem"** anywhere; no "Alternativen" button; no "Nochmal scannen" (X, swipe down, tap on camera). "Hinzufügen" opens "Wohin damit?" with "Routine" / "Merkliste"; afterwards the slot becomes the chip "✓ In deiner Routine" / "✓ Gemerkt", and tapping the chip reopens the sheet with the choice marked plus "Entfernen".
10. Primary verb research: Yuka "Zu den Favoriten hinzufügen", Vivino Actions → Add to Cellar / Wishlist, CodeCheck "Merkliste" → save verb, not a judgment verb; "Passt für mich" was rejected.

### Open consequential assumptions from this design (iOS)

Q8. **Footer versus iOS scope.** Confirmed items 11/12 exclude wishlist, saved products and routine integration from the iOS v1, and the saved-list question (Mobile design refinement, 2026-09-10) is still open. The locked footer's "Hinzufügen → Routine / Merkliste" therefore cannot ship on iOS as-is. Options to put to Nick: (a) iOS footer = "Kaufen ↗" only, full-width, no save; (b) restore a saved list for iOS (his earlier reopened question) and ship "Hinzufügen → Merkliste" only; (c) widen iOS scope to routines. Nick's handoff note says bottom actions still need agreement; do not implement a footer on iOS before this is ruled. Web keeps the locked footer.

Q9. **Incomplete assessment path.** The design removes the unknown-value row state; `src/lib/scan/resolve-verdict.ts:252` still produces an `in_catalog` / `unknown` verdict with no dimensions. The existing reconciliation item above applies: trace the trigger and present what the user sees before implementation.

Q10. **Copy layers.** Consequence sentence per property × result, "woher dein Ziel kommt" per category, and the seven definitions must be written and reviewed before implementation; the engine's current `explanation` strings are QA-protocol wording and must not reach users.

Q11. **Data contract for alternatives.** Each alternative needs the same rows in the same order, its Stage-3 verdict (already produced), a consequence sentence, price and `purchaseUrl`. Verify the mobile API boundary exposes these.

Q12. **Analytics.** Events for Kaufen, Hinzufügen (Routine / Merkliste / Entfernen), carousel swipe and explanation open are not yet defined; consent gating as for existing scan events.

Evidence review for the assessment sheet: confirmed by Nick on 2026-09-10. Journey sign-off for the full iOS app: still pending (see earlier sections). No implementation authorized by this section.

## Assessment sheet — rulings on the open questions — 2026-09-10

- **Q8 resolved: wishlist only on iOS.** Nick: "keep it quite simple and only add a wish list." iOS footer = "Kaufen ↗" + "Hinzufügen". Because there is a single destination, "Hinzufügen" saves straight to the Merkliste (no "Wohin damit?" sheet) and the slot becomes "✓ Gemerkt"; tapping the chip offers "Von der Merkliste entfernen". Same on alternative cards. No routine integration on iOS. This partially reopens confirmed item 12 (no wishlist) in favour of a Merkliste; the earlier saved-list question (Mobile design refinement) is thereby answered. The Merkliste needs a home in the two-area app: proposed entry = bookmark icon in the Scan header, mirroring the live web `/scan` header; its list screen still needs a mockup before journey sign-off. Web keeps Routine + Merkliste as locked.
- **Q9 resolved: scannable is binary.** Nick: a product is either scannable, then it has all values, or not scannable, then it goes through the existing "add to database" path. Consequence: the `in_catalog` / `unknown` verdict (`src/lib/scan/resolve-verdict.ts:252`) must never render as an assessment; if it is reachable, route the scan into the unknown-product submission flow already confirmed in items 14 and 16 (category selection, asynchronous research, push + email). The trace requested in the earlier reconciliation note remains an implementation task to confirm the trigger and, ideally, close it at the eligibility gate so the case never occurs.
- **Q10 in progress:** copy drafts written for review in `plans/ios-scanner/copy-drafts.md` (consequence sentences per property × result, target-origin sentences per category, definitions). Nick reviews afterwards.
- **Q11 is not a product question.** It is an implementation check: the API that feeds the sheet must return, per alternative, the same rows in the same order, the verdict, a consequence sentence, price and `purchaseUrl`. Moved to implementation planning.
- **Q12 deferred.** Analytics events are defined after the build, per Nick.

## Merkliste screen — 2026-09-10

- Nick approved the Merkliste mockup (`evidence/scan-ergebnis/merkliste.html`, frame `frames/13-merkliste.png`): entry via a bookmark icon with count in the Scan header (no third tab); list ordered most recently saved first; each row shows image, name, `Kategorie · Preis` and the product's verdict line with glyph; tapping a row opens that product's result sheet; swipe left reveals "Entfernen"; empty state "Noch nichts gemerkt" with a hint to "Hinzufügen". Implementation note: the verdict line per row means the list stores or recomputes the verdict against the current profile at load time; profile edits therefore change list verdicts.
- With this, the assessment-sheet evidence for iOS is complete: result sheet (all verdicts), explanation, alternatives carousel, Hinzufügen → Merkliste, Merkliste screen. Still pending before journey sign-off: copy-draft review (Q10, expert audit in progress) and the trace closing the unclear verdict (Q9).

## Copy simplification — 2026-09-10

- Nick: do not overcomplicate the copy; the production approach is fine. No consequence sentence per property × result (the "Seltener anwenden, etwa alle zwei Wochen" layer is dropped; D2 is withdrawn). It is fine to state why it does not fit, generated from the deviating row, not authored per case.
- Line under the verdict, generated: for each deviating row `{Eigenschaft}: {Produktwert} statt {Ziel}` (set axis: covered stops listed, e.g. „Kopfhaut: trocken, gereizt statt fettig“); several deviations joined with „ · “; all green → „Alles im Ziel.“ No frequency, no advice.
- Explanation card: definitions (section C of `copy-drafts.md`) stay; the second sentence reuses the existing per-category `fit` sentence from `src/lib/personal-plan/decision-presentation.ts` instead of a new per-axis origin table (section B dropped). Q10 is thereby closed; only the seven definitions need sign-off, and the expert audit's findings apply to those alone.
- Alternative cards use the same generated line.

## Info-box wording, scalp caveat, scalp headline — 2026-09-10

- **Definitions (info box only):** Nick chose the expert wording for the seven properties plus Verträglichkeit; final texts in `design-spec.md` §3 and `copy-drafts.md` §C. The table itself is unchanged (name, glyph, product value, target).
- **Scalp caveat:** Nick declined a dermatology deferral line on the result sheet ("keep the sheet free of caveats"). The quiz keeps its existing line; the sheet stays pure product-fit.
- **Scalp headline:** stays "Passt nicht zu deiner Kopfhaut"; the expert's "… zu deinem Kopfhaut-Ziel" was rejected.
- Copy for the assessment sheet is thereby closed (Q10). Remaining before journey sign-off: the unclear-verdict trace (Q9, implementation).

## Implementation dependency audit — 2026-09-10

The current implementation draft is [implementation-plan.md](implementation-plan.md); the audit and review status are in [review-findings.md](review-findings.md). These qualify the earlier chronological notes; no implementation kickoff or final whole-app sign-off is recorded yet.

- Latest scope confirmations: iOS first, with shared backend changes; the Merkliste is shared with the website. Native add/remove never changes a routine. Web scanner visual redesign remains separate.
- Q9 trace found that a complete catalog product can lack a usable **user target** (for example unknown heat exposure or an existing paused scalp decision). The earlier blanket instruction to send every unknown verdict into product research cannot safely cover these cases. D3 proposes a short unavailable state for this distinct cause, pending Nick's decision. Genuine missing product facts still follow research. Existing not-needed/deferred responses also remain distinct.
- D1 (minimum iOS), D2 (detailed-user profile editing), D3 (unavailable assessment presentation), E1 (live Customer.io reconciliation) and E2 (exact deletion retention map) are explicitly open in the implementation draft. Do not interpret their proposed defaults as approval.
- The iOS adaptation at `evidence/scan-ergebnis/ios-abnahme.html` keeps the approved result layout and implements direct Merkliste saving in the mockup. Original web interaction evidence keeps its historical destination selector. Final definitions come from `copy-drafts.md` and `design-spec.md`, not the older screenshot copy.
- Required read-only Claude review was attempted but failed because Claude Code is signed out (`Not logged in · Please run /login`). No review verdict exists. Live Customer.io CLI is also unauthenticated. Neither provider's current configuration has been inferred from local source.
- Next handoff: settle the open decisions/evidence, complete counterpart review, then review the integrated native journey once and record explicit final confirmation. No application code or production state changed in this planning pass.

## Authentication restoration and review reconciliation — 2026-09-10

- Customer.io and Claude Code sign-ins are restored; the earlier authentication blockers are historical. Read-only Customer.io checks confirmed sender identity 1, active login message 2/template 30, active quiz-result message 7/template 40, and running Haarplan campaigns 9/10. Full scoped findings: `customerio-live-check.md`. No provider state was changed.
- Campaign enrollment observes profile attributes, not only the quiz event. Proposed minimal app-acquisition treatment is recorded for final journey acknowledgement: app login/download and requested research results, without new Haarplan-sequence enrollment from scanner onboarding; preserve pre-existing journeys and other funnels. Actual marketing-consent/subscription mapping must be verified before activation.
- Claude's read-only review completed after login; its incomplete first report required a bounded same-lane follow-up for the two missing blocker details. `review-findings.md` records verified findings, rejected overclaims and disposition. A shared context does not bypass the existing web middleware's separate paid-access gate; those guards remain intact.
- Implementation-plan revision 3 corrects the dependency map, specifies proposed D2 source precedence, and freezes the already-reviewed native alternatives rule (green before yellow, then price; max5) separately from unchanged web ranking/max3. Existing comparison evidence must be exposed in the native API.
- The deletion schema audit is captured in `deletion-data-map.md`. Cascade/removal targets and FK blockers are known; exact retained financial/support/partner fields and identity-disconnection rules remain E2. No new legal retention period is inferred.
- D1, D2 and D3 still await Nick's answers. Integrated evidence review and full journey sign-off are still pending; authentication restoration and reviewer completion do not authorize implementation.

## D1 and D2 confirmed — 2026-09-10

Nick: “Yes to the first two. Explain to me the third question once more.”

- D1 confirmed: iOS 18 and newer.
- D2 confirmed: quiz/profile edits refresh scanner assessments in app and web, preserve applicable detailed answers, and leave routines unchanged.
- D3 remains pending clarification; no-assessment presentation is not yet approved. Final full-app journey sign-off and E1/E2 remain separate.

## D3 fallback confirmed — 2026-09-10

Nick accepted a simple fallback for unavailable assessment, citing expected rare heat-protectant scanning. V1 shows „Noch nicht einschätzbar“ plus a short factual reason and allows dismissal/continued scanning. No additional-question flow. This qualifies the earlier binary Q9 rule: missing personal information is not a product-research task. The expected low scan frequency is an assumption, not analytics evidence. D1–D3 are now confirmed; E1/E2 and final integrated journey sign-off remain open.

## E1 shared email flow confirmed — 2026-09-10

Nick chose coherence across funnels/users: scanner sign-ups should join the existing email flow; do not add a scanner-only exclusion or a separate marketing sequence. Current emails are accepted as an interim state. Shared email content and retargeting will be redesigned later as people use the free scanner.

- Preserve existing marketing consent, unsubscribe, buyer-exit, cohort and campaign-state rules; signup eligibility is not permission to restart campaigns on every login/profile edit.
- Login/download and requested research-result notifications remain transactional and work without marketing opt-in. The approved app-acquisition handoff still replaces the standalone quiz-result-artifact email; this decision preserves the broader marketing sequence rather than restoring a quiz report page.
- This supersedes the earlier proposed E1 scanner exclusion. No live Customer.io settings were changed. D1–D3 and E1 are confirmed; E2 retention disposition and final integrated journey sign-off remain open.

## Open support case during deletion — confirmed 2026-09-11

Nick accepted the proposed handling: delete hair profile, Merkliste and other private app data without waiting for an outstanding support case to close; stop marketing and scan notifications. Retain only information/contact necessary to resolve the case plus records covered by required retention. Emails strictly about that case or completing deletion remain allowed. The retained case must not keep the full app account alive or re-enroll the person into marketing. This does not waive the separately agreed safe cancellation/reconciliation of future web renewals. Exact financial/consent/partner evidence disposition and final integrated journey review remain outstanding.


## Live footer audit and draft additions — 2026-09-11

Nick asked to use the current web footer pages as evidence and assess needed additions. All five pages were checked live. Existing 90-day quiz/support periods are recorded; the blanket invoice-ten-year statement is not sufficient proof of applicable record-specific obligations. E2 remains open. [Audit](footer-pages-audit.md) records L1–L8, including shared deletion/scanner/push disclosure gaps, free-service AGB scope, EU-representative placeholder and unverified marketing DOI enforcement. [Copy draft](footer-copy-draft.md) and [page-layout preview](evidence/footer-pages-review.html) are proposals for review, not approved legal text or production changes. Plan revision 5 assigns the bounded privacy/AGB integration to T7; implementation and final journey sign-off remain pending.


## Vollständige Footer-Arbeitsfassungen — 2026-09-11

Nick autorisiert aktualisierte Dokumente mit gemeinsamer Klärung kritischer Punkte. [Vollständige Fassungen und Redaktionsstatus](legal/README.md) ersetzen die selektiven Ergänzungen als Arbeitsgrundlage. Nick bestätigt ausdrücklich: keine EU-Niederlassung und keine EU-Vertretung eingerichtet. R1 bleibt vor Veröffentlichung zu klären; keine Bestellung oder Zahlung autorisiert. R2–R6 trennen anwendbare Aufbewahrung, DOI-Nachweis, tatsächliche Verarbeitung, Rechtsgrundlagen und AGB-Einbeziehung. Keine Veröffentlichung oder neue Einwilligungs-/Vertragslogik aus der Redaktionsarbeit ableiten.


## Research qualification of R1/R2 — 2026-09-11

No formal EU setup is user-confirmed; actual GDPR establishment remains a factual/legal assessment based on operations. OSS use may require ten-year transaction records, but is unverified. See [research clarification](legal/README.md). No representative or adviser selected or appointed.


## Founder facts and concrete retention proposal — 2026-09-11

Nick confirms two members and US LLC partnership taxation; do not repeatedly reopen classification. Nick states registration in Switzerland; Jonas is not registered in Germany (his actual location remains unspecified). An EU representative need not be a founder; external firms are a practical option, not yet appointed. [Retention proposal](legal/retention-proposal.md) makes app periods concrete for confirmation, including deletion deadline, dormant free accounts, diagnostic records and backup expiry. These new choices remain proposed; existing support and notification decisions stand.


## Co-founder discussion explicitly parked — 2026-09-11

Nick requested documentation as questions for a later discussion with Jonas and explicitly asked that these not block progress now. [Co-founder brief](cofounder-questions.md) captures recommendations, five questions and answer fields. This is approval to defer, not approval of the proposed durations, inactivity deletion or external service appointment. Plan revision 6 separates independent scanner planning / subsequently scoped execution from affected retention transformations, deadlines, consent changes, procurement and legal publication. Full release still includes working account deletion and resolved policy facts. No immediate answer is requested.


## First development milestone approved — 2026-09-11

Nick: “Sounds good as a first starting point” in response to the existing-test-account login → scan/search → approved assessment/alternatives → shared save/remove → view profile → recovery journey. [Scoped first-build plan](first-build-plan.md) records this development milestone. New-user onboarding, profile editing, research notifications and account-management/legal release work stay in the parent v1 scope for later milestones. No repeat scope question is needed unless a material new choice emerges. Local test fixtures are not production accounts; no publication authorized.


## First-build review reconciliation — 2026-09-11

[Focused review disposition](first-build-review-findings.md) records a verified integration question with the separate web freemium plan: web premium-gates wishlist/full alternatives, while the approved iOS experience is free. Do not silently overrule either program or publish a shared entitlement change. This question affects production integration; isolated first-build work preserves the accepted native journey. Research deferral is development-only and does not change full-v1 research scope. Corrected D3 status, source paths and task granularity.


## Smart-scanner scope correction and CTA review — 2026-09-11

Nick chose the first iOS smart-scanner version without Merkliste. He explicitly rejected removing alternatives or redesigning the approved mockups: preserve the documented sheet style, product identity, comparison, explanations and full alternatives. Only the affected save CTA/destination changes. The resulting review proposal removes “Hinzufügen” from the result footer and alternative cards, retaining “Kaufen ↗” with its product-specific shop destination. No native save/remove sheet remains. This supersedes earlier inclusion of Merkliste for this first release; it does not change existing web entitlements or web lists.

[CTA mockups](evidence/scan-ergebnis/smart-scanner.html) directly adapt the approved `ios-abnahme.html`. Switches expose result, alternatives, explanation, green/red verdict variants and absent main-product shop link. [Evidence record](evidence/scan-ergebnis/smart-scanner-README.md) distinguishes confirmed scope from pending visual approval. The old first-build navigator and earlier plans retain historical save references; reconcile them after this narrow visual review. No broader scope reductions or new CTA wording are approved.


## First smart-scanner scope and CTA mockups approved — 2026-09-11

Nick: “Okay yeah, that works. It's very basic in scope but as a first version it should be fine.” Approval followed review of `smart-scanner.html`, with `#no-link` open. Confirmed: first iOS version without Merkliste; preserve the approved result design, full alternatives, tables and explanations; remove Hinzufügen/save/remove actions; retain each product's Kaufen ↗ destination. Omit the main-product footer when its shop link is absent. The scoped visual review is complete; do not reopen it without a material change.

The earlier Merkliste implementation tasks and save-flow evidence are superseded for this release. This approval does not remove onboarding, basic Profile or previously retained scanner behavior, change web monetization, authorize publication, or settle the previously recorded shared-service entitlement integration question. Remaining implementation-plan reconciliation is separate from this confirmed product/design decision.


## Implementation-plan reconciliation — 2026-09-11

At Nick's request, parent revision 7 and first-build revision 3 remove native Merkliste contracts, tasks, screens and tests; retain approved full alternatives, profile editing, product research and push/email for public v1. [Final-decision brief](final-decisions.md) isolates E3 (native free alternatives/editing versus web premium rules), the final joined journey checkpoint, parked co-founder matters and routine setup checks. No new product choice is silently confirmed. Shared account deletion still accounts for pre-existing web lists.


## E3 confirmed: temporary free native access — 2026-09-11

Nick answered yes to keeping full alternatives and answer editing free in the first iOS app while web retains its premium rules: “We will test a bit … the small version right now, and then we will add the other functionalities hopefully.” E3 is confirmed. Preserve shared identity/profile/assessment and existing web pricing; no native paywall or masking. This is the deliberate temporary access difference explained in the prior checkpoint, not authorization to change web monetization or rely on a forgeable platform flag. E4 sequencing remains under clarification: Nick asked whether the dependency refers to the premium/freemium worktree. No merge or prerequisite extraction authorized by that question.


## E4 confirmed: merged but inactive freemium; one post-531 audit

Nick clarified that the freemium program is being merged but not activated in production: it stays behind the feature flag. iOS should reuse needed backend functionality and may adapt narrow integration parts, without activating the web product. Nick asks for one audit after PR #531, identified as the final parking step, merges. The one actual status read returned OPEN with no merge timestamp; the full backend audit therefore has not run. Watch #531 merge status, perform one bounded source/flag/schema/reuse audit after merge, retain findings, then stop. No repeated broad audit or flag/config/production write. E4 product direction is settled; evidence and final joined journey remain pending.


## Post-531 audit completed — 2026-09-11

PR #531 merged at `469d41f5e81f44702c94829c0ed312e732b01172`. The requested [one-time audit](merged-backend-audit.md) is complete and the watcher is paused. Parent revision 8 / first-build revision 4 replace the pending audit dependency with concrete implementation seams. Shared computation and regular-quiz normalization are reusable with web freemium disabled. The parked free-snapshot writer is not a universal native bootstrap/edit path: it expects a prepared artifact and its RPC can affect enrollment/refined state. The existing plan's safe scanner-context publication and shared loader must implement D2 without paid-plan/routine mutation; no parallel profile or copied calculation engine.

19 targeted unit tests passed. Source evidence is current at the pinned merge; live flag/deployment/schema state was not independently rechecked beyond the parking memo. No production changes or app implementation occurred. Final joined journey reconciliation remains; E3/E4 and approved scanner design are not reopened.


## Connected walkthrough requested and delivered — 2026-09-12

Nick asked to stitch the approved mockups into a clickable prototype before building, while keeping parked co-founder decisions outside the initial build. [Walkthrough](evidence/walkthrough.html) and [record](evidence/walkthrough-README.md) preserve the approved smart-scanner result and connect quiz/login, scan/search, result/shop/dismissal, research/messages and Profile. Actions use local fixtures; exact privacy/retention policy is not approved by this prototype. Journey review remains pending Nick’s use and feedback. No native implementation or production change.


## Connected journey approved; implementation plan finalized — 2026-09-12

Nick reviewed the connected walkthrough (open at `#answers`) and said on 2026-09-12: “Okay I think we can start with this. Yeah sounds good. Can we do the implementation plan then, including all the designs that we had from before?” This confirms the connected journey and requests the finalized plan. Earlier result/CTA approvals remain in force. It does not approve parked policy details, fixed fixture assessments as domain truth, or production publication.

Parent revision 9 / first-build revision 5 record confirmed first-build decision coverage and public-v1 functional journey approval. [Handoff overview](README.md) maps build order; [design handoff](design-handoff.md) includes every prior artifact with current/historical/provisional status. E2/R1–R6 remain parked outside affected work; no full-release policy approval is inferred. No product or architecture vote reopened, no app/production changes.

Final bounded handoff review completed: no material defects. Clarified T4 UI/device-verification ownership and the development-only missing-product fallback. [Verified receipt](handoff-review.md). Confirmed coverage/journey status retained; no new consequential choice.
