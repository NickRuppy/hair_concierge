# Approved scanner result email implementation — 2026-09-15

This controlling section supersedes the historical draft notes below.

## Outcome and scope
Wire the locked mobile result email into completed scanner quizzes. Persisted `scan_v1` attribution selects a dedicated Customer.io transactional message18/template158. Organic and Personal Plan emails stay unchanged. No marketing-consent or trial/subscription eligibility gate on the scanner result email. Marketing drip consent rules and activation remain a separate next area. No historical bulk send. Lead age is irrelevant: an older lead that now completes the scanner flow qualifies. Preserve existing once-per-lead result-email semantics (including duplicate submits and existing sent/failed receipts); do not reset receipts or resend prior completed results automatically.

## Decision coverage — confirmed
Confirmed with Nick: final variant-a-mobile including two trial buttons, real WhatsApp and reviews is locked; both buttons lead to recipient's own offer; all scanner completers receive this transactional result regardless of marketing consent. Latest explicit correction: “All of them get this result that's independent of the marketing consent because it's a transactional email.” His prior setup request remains execution authorization. The previously proposed consent and entitlement split is rejected and must not be implemented.
Inherited: quiz answers must be complete, server-persisted funnel identity controls selection, existing atomic claim excludes non-commercial/moderator-owned rows, checkout alone grants paid/trial access; lead email is not a verified trial-identity claim.
Implementation defaults: use existing legacy result-email route and store, dedicated payload builder, no schema migration; scanner template ID from CUSTOMERIO_SCANNER_RESULT_TRANSACTIONAL_MESSAGE_ID=18 checked before claiming, same sender and passthrough layout2; protect organic behavior with focused tests.
Open consequential assumptions: none affecting email1 implementation. Later marketing sequence, account messages and old onboarding event mismatch remain explicitly separate sequential areas already discussed with Nick.
Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: the design-lock/setup request plus cohort clarification and latest explicit consent-independent transactional instruction in this conversation, 2026-09-15.
Internal revalidation: supersedes all earlier consent, fallback-template, cohort-age and entitlement proposals below. Approved visual artifact `docs/mockups/scanner-emails/variant-a-approved.html` matches variant-a-mobile and provider template158 after replacing preview links with Liquid.

## Designed user journey — confirmed by explicit correction to presented split
Visitor completes the scanner quiz with an email address (new or pre-existing lead, either consent choice). They see their result on site and receive the approved result email once. The email shows completed-profile → scan → product-fit, photo, two trial invitations, customer quotes and WhatsApp. Either trial CTA opens their lead-bound personalized offer; opening an email does not activate trial or charge them. If their account later cannot start a trial, the existing offer/checkout behavior remains the authority. Organic visitors receive their existing email. Email problems do not block on-site results; existing failed/ambiguous send receipts are not retried blindly. Nick explicitly rejected introducing another email variant or marketing-consent gate after reviewing this journey.

## Implementation plan
1. Add scanner payload builder that uses configured message ID and `/result/<leadId>?entry=result_email` (without organic highlights focus). No user-controlled package override in URL or body.
2. Before claim, query the existing lead-linked funnel_sessions package_key (same latest-first ordering as the result page), independent of the analytics flag, with unavailable distinct from organic/no context. Missing scanner config or unavailable lookup returns a recoverable request error without consuming the once-only claim. Pass server-selected kind into existing service; validate complete stored quiz before either payload.
3. Retain current atomic claim/status handling and unchanged organic payload. No lead creation-date filter, marketing consent filter, entitlement lookup, bulk sender or receipt reset.
4. Provider message18: keep inactive during wiring; set send_to_unsubscribed=true for this transactional result, queue_drafts=false. Subject/layout/content preserved. HTML and plaintext same two result_url placeholders; real HTTPS image and unsubscribe link.
5. Tests before implementation: scanner selection, organic preservation, no-consent scanner, prior-created lead, unavailable lookup/config preclaim, ignores caller-forged package, concurrency/duplicates, missing answers, failures, payload URL and configuration. Validate canonical provider templates and readback.
6. Run focused tests, typecheck/lint and relevant project ready-check/review. Received Gmail visual test and personalized destination confirmation required before live activation. No implicit merge/deploy or mass send.

## Artifacts and review
Commit canonical HTML/plaintext, approved screenshot/layout evidence, implementation plan and tests. Earlier mockups retained as historical decision evidence. Temporary provider request JSON and reviewer output under /tmp are transient. Existing provider draft18/158 is intentionally retained pending cutover.
Counterpart plan review completed at /tmp/scanner-email-confirmed-plan-review.md. Technical findings integrated: explicit env name/value, per-kind config, deployment order, and analytics-flag independence. Existing configuration-error semantics already return503 before claim; preserve that behavior for the selected kind, never silently substitute the wrong email. Activation ordering: finish QA, activate provider18 and set its env value, then deploy code together; this avoids deploying a sender pointed to a draft. Without correct configuration, do not consume claims. No new kill-switch/fallback content is requested. Current live provider readback now confirms send_to_unsubscribed=true; historical false readback below is superseded.
Review disposition: accept technical findings above and focused preclaim tests. Reject re-asking consent permission: Nick just explicitly resolved the exact audience/content question; reviewer legal characterization is advisory, not permission authority, and this implementation does not certify legal classification. No new neutral email or silent fallback. WebP received-client QA remains a release limitation, not design approval blocker. Tests: node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-result-artifact-route.test.ts tests/quiz-result-artifact-email.test.ts tests/customerio-transactional.test.ts plus new scanner fixtures.

## Authorized release and final review
Nick explicitly requested all remaining test, review, merge, deploy and activation steps (“do these steps, why are you stopping”). No renewed approval needed for this bounded release. Refreshed to origin/main ca176e7d; ci:verify and 44 focused tests passed. Claude whole-tree review at /tmp/scanner-email-release-review.md found no blockers; parent inspected the diff and accepted the technical review. No functional edits after that review; this receipt update records evidence only. Gmail desktop delivery, full image, both matching result links and lower CTA/WhatsApp rendering passed. Provider18 is active with send_to_unsubscribed=true and queue_drafts=false; production env=18 configured before code merge. Live scanner completion will be verified after deployment.

---
# Historical planning notes (superseded where inconsistent)

# Scanner email refinement — sequential review

## Outcome and source context
Nick requested on 2026-09-15: update the result email, existing follow-ups and login/confirmation emails one by one, and connect the scanner sequence. The email1 mobile design was explicitly locked by Nick on 2026-09-15. Delivery rules remain pending confirmation; later email areas remain separate.

Live audit: workspace 219516 message 9 serves the shared result email. Trial reminder 15 and required notices 16 were repaired in PR560. Automations 9/v4 and 10/v5 run; scanner automation 11/v6 is still an unstarted draft. The old purchase onboarding listens to `purchase`, whereas current billing emits `purchase_completed`.

Correction to initial audit: scan_v1 uses the legacy quiz, whose result-artifact service delegates to the Personal Plan-shaped email payload (message9). Its legacy quiz_completed_at can qualify it for old automation segment15. It is not a Personal Plan quiz lead qualifying through segment21. The shared-email and old-marketing-overlap findings still stand.

## Proposed direction
Review area 1 first: keep a compact personal profile and one meaningful quiz priority, then explain that the scanner can compare products against that profile. CTA `Mein Ergebnis ansehen` returns to the lead's result page. Remove the symbolic before/after picture and the long duplicate sales sections in this proposal. No claim that a product has already been scanned. The copy does not assert a trial is active or scanner access is already unlocked.

## Scope and non-goals
Current artifact is an email1 mockup only. Proposed production scope is a scanner-specific email selected from trustworthy persisted attribution, preserving organic email behavior. No production code, provider templates, subscribers, sending rules or billing flags have been changed. Following areas remain in this task for sequential decisions, not implicitly approved for activation: scanner v6 timing/copy/entry and exit, migration of existing scanner leads, account messages, onboarding event mismatch.

## Target map
- src/components/quiz/quiz-preparation.tsx: current /api/quiz/result-artifact call.
- src/app/api/quiz/result-artifact/route.ts and src/lib/customerio/result-artifact-service.ts: one-time legacy lead claim and send.
- src/lib/customerio/quiz-result-artifact.ts and personal-plan-result-artifact.ts: shared payload; currently no cohort discriminator.
- src/lib/funnel/server.ts: persisted lead-linked funnel identity.
- src/app/result/[leadId]/page.tsx: lead-bound result context rehydration.
- Customer.io message9: shared organic/legacy template, must not blindly replace globally.
- Customer.io automations9/10/11: next review area.

## Decision coverage
Status: pending.
Confirmed with Nick: review first three email areas one by one and connect scanner sequence.
Inherited: German copy; concise tone; no quiz-based product assessment; live trial terms and reminder remain established; runtime routes must respect persisted funnel identity and existing one-send claim.
Implementation defaults: local static HTML mockups; realistic sample values labelled as examples; inline email layout; no live sends for this review.
Open consequential assumptions (resolve before handoff): proposed copy, reduced profile detail, image removal and CTA; scanner-only target selection and behavior when attribution lookup fails; shared message conditional versus dedicated scanner template; handling recipients who activate a trial before opening this email. For subsequent areas, sequence timing/content, first-entry cutoff versus existing-lead migration, trial-start exit and unsubscribed handling need review. These later areas are not abandoned or activated.
Coverage acknowledgement: user's 2026-09-15 request above; no evidence review or journey sign-off yet.
Internal revalidation: initial quiz-kind mapping corrected against scan_v1 registry and actual legacy sender. Underlying shared message9 and old campaign overlap remain verified.
Undiscussed consequential assumptions affecting this handoff: listed above; there is no implementation handoff yet.

## Designed user journey — proposal for area 1
A scanner visitor completes the quiz. The existing asynchronous, once-only result send delivers a personal profile summary. They see what their quiz answers mean and how a product scanner can use the profile. Clicking the email opens their own result page; payment/eligibility remains on that page. Repeated page visits do not create repeat emails. Existing members and trial recipients must receive an accurate CTA destination without a false new-trial promise. Organic visitors retain their current email. Image blocking cannot remove any meaning from the proposed email. Email failure cannot block the on-site result.

## Planning evidence
Commit: docs/mockups/scanner-emails/index.html, current.html, proposed.html, before-after.jpg.
Current copy/layout reconstructed from repository source and live Customer.io9 read on 2026-09-15; current live closing paragraph substituted because repository canonical differs. Sample profile/diagnostic values are synthetic and labelled; this is not a delivered-message screenshot. Proposed email is a static mockup, not a provider-ready template. Decision: whether the shorter profile-to-scanner structure is preferred. Evidence review pending.

## Ordered tasks
1. Review email1 comparison and incorporate Nick's feedback. Done: final copy and hierarchy selected.
2. Complete area1 cohort/delivery design and counterpart review after meaningful choices are settled. Pending: delivery-rule decision and final complete journey; design and personalized offer destination are approved.
3. Implement approved area1 using existing one-send semantics and scanner attribution. Verify generic/organic, scanner, unavailable context, unauthorized cohort input and already-claimed fixtures. Render in desktop/mobile Gmail using approved test recipients before production operator cutover.
4. Review v6 draft as next independent area. Map consent, scanner cohort, trial conversion exit and removal from old9/10; choose rollout scope before activation. Preserve organic campaigns.
5. Review login/confirmation wording in real templates and callback context; preserve account security, link lifetime and provider contracts. Then assess onboarding trigger discrepancy in its own bounded scope.

## Verification and review
Local: compare copy to live source, load images, check 375px/desktop containment and CTA readability. This is browser-preview evidence only, not Gmail delivery proof.
Production implementation: meaningful deterministic tests for cohort and once-only sending, exact lead-bound CTA/browser result verification, MIME plaintext/HTML and desktop Gmail receipt checks, template readback/rollback evidence. No changes to live billing/reminder schedule.
Counterpart: read-only Claude review of this working draft, with pending decisions explicitly excluded from readiness. Journey sign-off pending. Retain durable mockup and plan with eventual PR; transient review output stays /tmp. No publication in this planning stage.


## Feedback round 2 — 2026-09-15
Nick: the first draft does not explain the profile-to-scan purpose clearly enough; requests at least one visual and three additional proposals grounded in scanner landing/funnel. No version selected yet. Earlier image-removal/reduced-detail idea remains unapproved and is superseded as the only proposal.

Evidence: live /lp/scan redirects to /quiz (read-only browser visit resumed an existing quiz at the name step; no answers entered). `src/components/quiz/quiz-info-strip.tsx:33` explains product matching to the hair profile. `src/funnels/landing/scan-regal.tsx:84` carries the 200-shampoos shelf promise; current enabled refinement redirects past that older landing. `src/components/scan-regal-offer/scanner-refined-offer.tsx:233` says the profile is ready and the scanner shows matching products. Its production result screenshot and shelf photo are reused unchanged.

Three additional mockups (commit): `docs/mockups/scanner-emails/variants.html`, `variant-a.html`, `variant-b.html`, `variant-c.html`, `scanner-shelf.webp`, `scan-result.jpg`, `shelf-person.webp`.
- A: completed profile → scan a barcode → understand product fit; shelf scanning photo.
- B: example profile → actual production example result in a phone frame. Example profile hair thickness and scalp status match the screenshot; label discloses that this is not an individual recipient result.
- C: shelf choice → profile as matching basis; existing landing photo.
- All: a single result/scanner CTA; no claim that the recipient has already scanned a product, unlocked scanner access or activated a trial. URLs remain inert in previews.
Visual checks: all three fit the 375px outer mobile frame (373px inner body, equal scroll width); C and B screenshot inspected, A layout inspected, images sourced from local approved funnel assets. This is browser HTML evidence, not received Gmail MIME proof. No production changes.

Counterpart result: /tmp/scanner-email-refinement-plan-review.md approved the draft only for review; no implementation readiness claimed. Accepted: disambiguate transactional message9 from automation9, and make persisted attribution/error behavior concrete before handoff. The review's claim about a live legacy-cutover flag came from its memory, not fresh evidence; do not treat that flag assertion as verified. CTA destination variants remain open for implementation validation. No repeat review needed for these copy/layout mockups before a direction is selected.


## Feedback round 3 — 2026-09-15
Nick selected A as clearest and asked for stronger sales motivation to start the trial. Confirmed: A's profile → scan → fit structure, with visual. This confirms the structure only, not the newly written copy or the final implementation journey.

New review artifact (commit): `docs/mockups/scanner-emails/variant-a-trial.html`; gallery A now shows this version, and links to unchanged original A. Copy makes the first action tangible (scan your bathroom shampoo), retains profile as the matching basis, adds the seven-day trial invitation and CTA `7 Tage kostenlos testen →`. Beneath CTA: automatic paid subscription at chosen tariff, and cancellation before trial end means no charge. The email click still leads to the offer, not direct enrollment; actual trial availability must remain checked before checkout. No payment or trial is activated by clicking an email.

Implementation consequence, resolve before handoff: the new explicit trial-promotion copy must not be put blindly into message9's send-to-unsubscribed transactional path. Decide eligible marketing recipients and utility-only result fallback alongside sequence entry/exit rules. Marketing consent and an active trial/paid entitlement cannot be ignored. Existing trial terms and all live messages remain unchanged. Proposed copy review remains pending.


## Feedback round 4 — 2026-09-15
Nick approved the sales-oriented A proposal ("Yeah I think that's good") and requested customer reviews and WhatsApp in the bottom section to build trust. Confirmed: existing A sales copy/structure, add actual funnel testimonials and existing WhatsApp contact. Final rendered trust-section review and full implementation journey remain pending.

Mockup updated: `variant-a-trial.html`; previous version preserved as `variant-a-trial-before-trust.html` (commit). Two exact quotes from `src/components/scan-regal-offer/scanner-refined-offer.tsx:44`: Sarah on recommendation explanations and Kim on the quiz/product recommendation. No invented stars, reviewer photos, verification badge, or scanner-specific claim attributed to a review about the wider service. Quotes use ordinary text, not oversized decorative quotation marks.

Below the reviews: a quiet green contact card, `Noch eine Frage?`, and `Auf WhatsApp schreiben →`. The exact founder-provided contact is https://wa.me/message/NIQW4GQHV7UTD1. No message sent, no response-time promise. WhatsApp is a real outbound link in the mockup; the trial CTA remains inert. Gallery note distinguishes those actions. Trial CTA and terms remain above trust section. Live provider templates, cohorts and sends remain unchanged.


## Feedback round 5 — 2026-09-15
Nick approved the review/WhatsApp version: "we can lock this in"; requested research-led mobile optimization including whether to show a visual in the opening. Scope authorization: optimize existing email content/layout, preserving the selected elements. Baseline frozen as `variant-a-locked.html`.

Applied the mobile draft and provided `mobile-comparison.html`, with retained baseline beside it. Research and measured browser geometry are in `docs/mockups/scanner-emails/mobile-research.md`. Image moved directly below headline; trial CTA/terms precede the three-step explanation; duplicate opening copy shortened. Reviews and WhatsApp retained. New artifacts mobile HTML, plaintext, research and comparison are commit dispositions. Transient build scripts stay /tmp (discard disposition). Baseline content approved; research-driven mobile layout evidence is now provided for review. Final delivery journey and consent/cohort decisions still pending; no live provider change or send occurred.


## Feedback round 6 — 2026-09-15
Nick accepted the mobile refinement ("Sounds good") and requested another CTA at the bottom above WhatsApp, pointing to the personalized offer. Added the same `7 Tage kostenlos testen →` button after the reviews and directly before WhatsApp, with matching trial-to-paid terms. Both buttons have one destination in production: recipient-specific result/offer URL resolved from the lead, preserving scanner attribution. They do not create an enrollment or directly charge/start a trial. Local mockup links remain inert; never invent a production lead URL. This settles the desired destination and duplicate-CTA placement; entitlement/error behavior and consent gating still require the implementation decisions already recorded.

Updated artifacts: variant-a-mobile.html and plaintext companion. Mobile browser verifies the bottom CTA order, WhatsApp destination and containment. Live Customer.io unchanged.


## Feedback round 7 — design locked and provider draft prepared, 2026-09-15
Nick: “Okay good. Let's lock this design in. I like it. Can you set it up please? Are any decisions needed from my side?” This explicitly approves the latest mobile design including the second CTA and authorizes setup. Frozen snapshot: `docs/mockups/scanner-emails/variant-a-approved.html`. It supersedes earlier open copy/image/layout questions; they are resolved. The initial proposed-direction text above is historical and superseded by feedback rounds3–7.

Prepared dedicated Customer.io message18/template158 `scanner_profile_ready_v1` in workspace219516 as an inactive draft. Canonical provider HTML/plaintext under docs/customerio/scanner-profile-ready-* uses both `trigger.result_url` links, actual unsubscribe tag and the existing HTTPS scanner shelf image. Uses verified passthrough layout2 and sender identity1 to avoid duplicate email wrapping. Existing organic message9 is untouched. No actual send, activation or application routing performed. WebP client compatibility and received Gmail rendering still require delivery QA before activation.

One delivery-rule question is pending: new consented scanner leads only, once, no historical resend; known trial/paid customers receive utility result content; final trial admission remains on checkout. The neutral fallback is not yet an approved new template: existing message9 also contains sales copy, so do not claim it has already been made neutral. Later sequence activation remains outside this first email cutover.

Read-only implementation map found that eligibility cannot be guaranteed from an unauthenticated lead email. There is no has_ever_trialed field; authenticated account/verified-email history and checkout payment-identity claims govern admission. Exclude known used-trial/paid accounts where trustworthy linkage exists; confirm invitation handling for unknown prospects before routing implementation. No silent use of an unverified email as a verified identity claim.

Existing once-only claim covers sent/failed leads, but by itself does not exclude historical never-sent leads; the no-history rollout requires an explicit creation-time cutoff. Attribution errors must be distinguished from organic classification. Existing failed status is terminal and ambiguous sends must not acquire blind retries.

Decision coverage: pending for delivery integration only. Evidence review: confirmed for final mobile design. CTA destination: confirmed personalized offer, no direct activation/payment. User-facing production journey: pending completion of the delivery rule. Independent setup permitted by current user request; provider draft remains inactive.

Provider readback verified: message18 remains draft, send_to_unsubscribed=false, queue_drafts=false; template158 matches canonical HTML/plaintext/subject/preheader/layout/sender exactly. HTML SHA256 b24351f283982c7aad10ad686b0ef72b62044b68b319bb83c236abd45b9ede41. No sends occurred.


## Implementation verification — transactional scope, 2026-09-15
Implemented route preclaim persisted package lookup, per-kind configuration guard, scanner payload and existing once-per-lead lifecycle. No age, marketing-consent, trial-history or subscription filter was added. Dedicated scanner env has no organic fallback. Organic and Personal Plan builders are unchanged.

Parent verification: 44/44 focused tests passed across scanner/legacy/Personal Plan payloads, routes, client trigger and transactional sender. Typecheck passed. Whole-project lint: zero errors, five pre-existing warnings in unrelated files; changed runtime-file lint clean; tests are excluded by the existing ESLint ignore configuration and were checked by TypeScript and the test runner. Worker red proof: five failures before implementation; parent mutation probe removing the attribution error guard produced the expected failed rejection assertion, then passed after exact restoration.

Read-only production query verified latest package selection against an existing scanner-linked lead and returned scan_v1; no customer identifiers or profile fields were retrieved. Provider HTML/plaintext Liquid render has no errors or unresolved variables, both CTA targets match, and settings readback confirms message18 remains draft with send_to_unsubscribed=true and queue_drafts=false.

Review: main-session correctness and proportional structural pass inspected full runtime diff, tests, provider content and mapped callers. No blocking implementation findings; per-kind configuration/failure checks are before claim and claim filters are unchanged. External plan review findings were reconciled above. Counterpart whole-branch review remains required before any future push.

Remaining release work: received Gmail test with an approved recipient, actual personalized offer navigation, provider activation + deployed env/code cutover. No email was sent, no code was committed/pushed/deployed, and this draft is not live. No further audience/design choice is pending.
