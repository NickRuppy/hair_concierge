# Scanner launch readiness — 15 September 2026

## Outcome and context
Finish the launch dependencies of merged PR #554: a truthful pre-charge reminder in Customer.io, matching privacy wording, actual WhatsApp contact and independently checked captions. Root was refreshed to #555; worktree is `codex/scanner-launch-readiness` at `b4deccd8`. Production activation is explicitly the last step, not part of this preparation turn.

User authorization (15 September): “please set that reminder up”, use the already open Customer.io Chaarlie Chrome window, research best practices/examples, “let's adjust” privacy wording, supplied `https://wa.me/message/NIQW4GQHV7UTD1`, requested worker/explorer caption review, and confirmed production activation last. Prior revision-20 WhatsApp appearance and click-to-contact journey are already approved; supplying the destination resolves its sole open placeholder decision.

## Chosen direction
One concise, non-promotional German transactional email, sent from Chaarlie <info@chaarlie.de>. Chaarlie selects eligible enrollments and triggers Customer.io when due. Use verified trial/contract facts, not a delay from quiz completion or a marketing campaign profile attribute. Due time is the immutable trial end minus 48 hours (= verified authorization + five days for the current seven-day contract). Preserve existing mandatory notices. This extra reminder is not claimed to replace provider/card-network notices.

Customer.io draft created in existing workspace 219516: transactional message 15, content155, trigger `chaarlie_trial_ending_reminder_v1`. It is unactivated, queue-as-drafts is on, open/link tracking off, no sends requested. Draft queueing and disabled message retention are mutually exclusive in current UI: draft retention stays enabled for preparation; before live delivery switch to no draft queue + disabled message retention after verification. No real customer data is manually inserted; preview payload uses fictional contract values. Existing UI automatically chooses a sample profile; no email sent to that profile.

## Scope and non-goals
- Reminder renderer/template, private queue, controlled scheduling, cancellation guards, provider-neutral dispatch, matching current privacy/ops contract, and tests under the approved email journey.
- WhatsApp direct link implementation is independent and already authorized; no auto-open or send.
- Caption review is read-only; proposed timing improvement retains all words.
- No checkout/price/eligibility changes, trial extensions, provider credentials, charge, live test enrollment, backfill, or production activation. All new trials are explicitly in scope; existing-trial backfill remains out of scope.
- Do not edit frozen required-notice renderers, historic AGB snapshots or approved design snapshots.

## Target map
Existing authoritative sources: `public.trial_enrollments` (`20260914044650_trial_admission_foundation.sql`), `accepted_offer`, `original_trial_end_at`, `first_payment_succeeded_at`, cancellation/revocation and provider-binding status. `src/lib/stripe/trial-authorization.ts`, `src/lib/paypal/trial-account-admission.ts` already reconcile trial deadlines. `src/lib/billing/trial-required-notices-delivery.ts` and `src/lib/customerio/transactional.ts` supply verified-recipient, lease and transport patterns.

Proposed implementation: new migration/private `trial_reminders` outbox and service-only enqueue/claim/settle RPCs; `src/lib/billing/trial-reminders.ts`, `trial-reminders-delivery.ts`; `src/lib/customerio/trial-reminder.ts`; protected `src/app/api/billing/trial-reminders/reconcile/route.ts`, `vercel.json` and required route/proxy classification; targeted tests modeled on required notices. Keep optional reminder queue separate from frozen required notice kinds. This adds a migration, route and cron, justified because reminders must be suppressed on cancellation while contractual receipts must still be sent.

Existing WhatsApp component/styles/tests modified by bounded worker. Privacy surface `src/app/datenschutz/page.tsx`; ops docs `docs/trial-notices-and-claims-operations.md` gain an explicitly dated change, not a rewrite of historic policy. Draft data contract and email assets retained under this plan directory.

## Decision coverage
Status: confirmed.
- Confirmed with Nick: all new Chaarlie trials (Stripe and PayPal, both intervals), day-5 reminder, approved email/privacy preview at http://127.0.0.1:8794/, unchanged WhatsApp destination/placement, activation last.
- Coverage acknowledgement: after viewing the preview Nick said “Okay yeah, I think it's good. Can you set this up with those emails”; when asked the sole remaining audience choice he answered “all trials!”. These approve the presented email/privacy and designed journey for all new trials.
- Inherited: authoritative seven-day enrollment deadline, accepted contract amounts, confirmed account-owner email, cancellation/revocation/prior payment suppression, required notices and payment authority unchanged.
- Implementation defaults: five-minute cron, unique enrollment/version, bounded fenced lease, no tracking, validated German date/amount rendering, fail closed on missing configuration, park ambiguous delivery rather than blind resend, rollout cutoff without historic backfill.
- Open consequential assumptions: none. Undiscussed consequential assumptions affecting this handoff: none.
- Internal revalidation: current worktree b4deccd8, approved draft artifacts, Claude plan-review revisions incorporated. All-trial selection removes the attribution dependency. No new product choices introduced.
- Recovery approved with presented journey: late cron may send with absolute dates only before expiry; cancellation/paid/revocation suppress; ambiguous provider outcomes require support.

## Designed user journey
1. A new eligible customer completes verified Stripe or PayPal trial authorization. Existing contract confirmation and trial access remain unchanged.
2. Five days later, if their same seven-day trial remains active, uncancelled and unpaid, they receive one email: trial end date/time, scheduled first charge amount/date, selected interval/renewal amount, “Mein Abo ansehen”, and visible “Vor Testende kündigen”. No upsell or urgency sequence.
3. Account link opens existing profile management (normal login if needed). Cancellation link opens existing public `/kuendigen`; no emailed link silently cancels anything. Existing confirmation controls remain authoritative.
4. Cancellation before dispatch suppresses reminder. A cancellation/plan-change concurrent with provider acceptance cannot retract mail already accepted externally; retain truthful snapshot and latest cancellation/change confirmation authority. Copy should acknowledge “Falls du inzwischen gekündigt hast, gilt deine Kündigungsbestätigung.”
5. Failed delivery does not alter trial access, payment dates or cancellation rights. Provider-ambiguous outcomes go to support; late reminders are not sent after expiry.
6. The scanner page WhatsApp bubble opens the supplied contact only after user click. Nothing sends automatically. Existing sticky CTAs and image zoom remain unchanged.
Journey sign-off: reminder confirmed by preview acceptance and all-trials response; WhatsApp inherited from locked v20 + explicit supplied destination.

## Planning evidence
- `reminder-template.html`, `.txt`: proposed dynamic content; `reminder-preview.html`: fictional annual example, not customer data or a pricing authority.
- `privacy-preview.html`: before/after in current legal component layout (generated from source), approved conditional wording covering every new trial where the reminder is announced.
- Customer.io template15/content155: saved editable draft with fictional preview variables. Current shared Empty Layout appends legal/unsubscribe footer. Duplicate per-message legal links were removed from customerio-content.html and the saved UI draft; standalone previews include their own legal links. Workspace-wide layout unchanged.
- Caption review `/tmp/scanner-caption-review.md`: offline ASR matches words; Chromium/WebKit320/390 no clipping. ASR is not a human listening check. Proposed combine cues9–10 at22.840–26.720, extend final to29.550. No wording rewrite.
Evidence review: confirmed for new email/privacy; prior UI v20 remains approved.

## Ordered tasks and contracts
1. Complete email/privacy preview and Customer.io draft. API data fields: `trial_end_date`, `first_charge_date`, `first_charge_amount`, `plan_label`, `renewal_amount`, `billing_interval_label`, `management_url`, `cancellation_url`. Validate every required field before dispatch; no blank-price or invented amount fallback. Sender matches existing verified identity. Both monthly and annual previews required. Done: reviewed matching content/settings, no send.
2. Implement candidate selection and queue for all new enrollments directly; no funnel attribution filter. Add version+rollout cutoff guards. Snapshot current accepted terms only when stable, once per enrollment; no reminders for cancelled/revoked/paid/expired/unowned/unresolved contracts. Check freshness again immediately before provider call. Done: clock, suppression, source, permissions and replay tests pass.
3. Add dispatch and reconcile route. Resolve confirmed owner email at dispatch; lease90s, provider timeout10s; route60s. Claim/settle with token fencing; queued means Customer.io accepted, not delivered. Validate receipt id; timeout, malformed ack, network ambiguity or post-send DB failure parks/requires support. Do not automatically resend. Protected cron and required env/config check must fail before claim. Send only after explicit activation, no real send in unit/browser fixtures. Done: meaningful success/error/lease/auth tests.
4. Apply reviewed privacy wording and dated ops update. Describe recipient email, trial deadline/selected contract amounts and delivery status for announced pre-charge reminder, no advertising or open/click tracking. Keep prior legal bases tied to actual purpose, not blanket certification. No change to unrelated privacy sections. Done: rendered before/after matches approved scope and tests no longer encode “no reminder” for the future slice.
5. Integrate independent WhatsApp worker result, caption report and only authorized timing corrections. Done: component5/5 + Chromium/WebKit10/10 and visual layout unchanged; exact destination protected with noopener.
6. Run ready-check and whole-branch counterpart review before any future publication. Merge/deploy/activation not inferred from this setup request. Final launch requires template activation with retention off/queue off, deployed code+applied migration+cron/env readiness, controlled delivery proof to an explicitly approved recipient, production checkout flow check and Nick's final activation instruction.

## Verification
Node22/PGlite deterministic clock (`node --import ./tests/server-only-register.cjs --import tsx --test ...`), unique enqueue, ownership, cancellation/revocation/paid/expiry suppression, both intervals/providers, stable terms and monetary formatting, replay, stale lease/fencing, late worker and uncertain network outcome; route401/503 behavior and no writes while disabled. Test table permissions and safe nullable provenance. Browser actual WhatsApp href/layout and email320/390/desktop no overflow; plaintext parity, no duplicate footer, no blank variable fallback. Activation verification names migration version, exact deployed SHA and provider/date parity; no provider writes or live recipients used without authorized concrete test.

## Review and handoff
Main owns decisions and readiness. The prior Claude read-only plan review is retained as advisory evidence; audience and journey are now explicitly approved. Later meaningful whole-branch review after implementation. Retain plan/email/privacy mockups and concise caption summary in PR; transient raw ASR/browser/reviewer artifacts stay /tmp. Implementation may now proceed; production activation remains a separate final step.

## Research
- Customer.io trial expiration recipe: https://docs.customer.io/messaging/send/recipes/trial-expiration-reminders/ — schedule from expiry timestamp, filter no-longer-eligible users.
- Customer.io transactional setup: https://docs.customer.io/messaging/send/transactional/email/ — trigger data, draft queue, retention/tracking switches. UI verifies queue_draft cannot coexist with disabled retention.
- Customer.io transactional design guidance: https://customer.io/learn/lifecycle-marketing/password-reset-emails — recognizable branding, one purpose, no promotional add-ons; applied by analogy to billing reminder.
- Slack example: https://reallygoodemails.com/emails/rges-free-trial-of-slack-pro-ends-in-7-days — visually inspected reference for a prominent deadline and explicit end-of-trial consequences. Slack returns to a free plan rather than automatically charging, so only the information hierarchy is borrowed; no claimed conversion uplift.
- Stripe: https://docs.stripe.com/billing/subscriptions/trials — trial_will_end is three days before deadline, so direct event send cannot implement48h promise. Existing mandatory communications are separate; don't disable provider reminders as part of this slice.

## Counterpart review disposition
Claude Opus 4.8/high read-only review returned approve with revisions; report retained transiently at /tmp/scanner-launch-plan-review.md. Locally verified the separate queue rationale, no enrollment attribution column, and existing transport retention flags. Incorporated audience/privacy dependency and five-minute cadence.

Launch invariant: verify live reminder infrastructure before SCANNER_FUNNEL_REFINEMENT_ENABLED exposes the reminder promise to any real new enrollment. A rollout cutoff with no backfill must not create a promise-before-scheduler gap. Production state must be refreshed before activation; this plan does not claim a live flag inspection. Current seven-day DB constraint (604800 seconds) is what makes trial end minus 48 hours equal day 5; changing duration requires revisiting both copy and scheduling.

## Preparation receipt
- Customer.io draft15/content155 saved with no editor errors; sender Chaarlie <info@chaarlie.de>, no send or activation. Duplicate legal footer removed and cancellation-in-flight line added. customerio-content.html is the message body; the workspace shared layout supplies its footer. Plaintext file is a proposal, not yet imported/verified in Customer.io.
- Annual browser preview at320px and monthly at390px: document width equals viewport (no horizontal overflow). Desktop preview visually inspected. This is browser rendering evidence, not Gmail/Outlook delivery proof.
- Main inspected WhatsApp diff and reran5/5 component tests; worker reported10/10 Chromium/WebKit checks. git diff --check clean. Changes remain local/uncommitted.
- At preparation time audience and journey approval were pending; now resolved by the user responses recorded above. No backend scheduler, migration or source privacy wording change existed at that preparation point; current implementation is described below. No production activation performed.

## Implementation progress
All new Stripe and PayPal trial enrollments are eligible after the explicit fixed rollout cutoff; no attribution join is needed. Implemented the Customer.io renderer/wrapper, independently permissioned reminder outbox, service-authenticated five-minute reconcile route, disabled-by-default runtime switch, middleware bypass for cron auth, approved privacy wording and dated operations addendum. Message ID must be explicitly configured; the known draft trigger is documented, never silently created. Each cycle claims at most three rows (90-second leases, sequential 10-second provider calls, 60-second route). A final database send gate validates current owner, terms, expiry and cancellation state; ambiguous delivery is not retried. This version implements preparation and code only; no live provider sends, migrations, deployment or activation.

Source preview evidence: implemented-email-preview.html is generated by the actual renderer from fictional canonical annual terms, and implemented-privacy-preview.html is rendered from the edited React page. Original approved mockups remain retained separately. Browser email verified at390px with viewport/document width390 and no overflow. The API overrides the email body with reviewed renderer content; Customer.io shared layout supplies legal links. Actual mailbox/footer rendering still requires controlled delivery verification before launch.

Regression proof: inert dispatcher produced five intended failures (missing queue/send/suppression/settlement). Restored implementation passes. Temporarily removing route authentication produced200 instead of expected401; removing cron middleware bypass attempted browser Auth; restored tests pass. Renderer mutation firstAmount=0 failed actual first-price assertions, then restored. SQL mutation proof removed cutoff ->2instead1queued; removed one-time preparation guard -> replayreturned1instead0. Both restored; final migration hash02023d1db19fd62394420d4a9e82683806d83b062440711e618c549cecc78ae5. No destructive or external test calls used.

Checks so far:30 focused tests including existing mandatory-notice and scanner component regressions pass; typecheck passes; lint has no errors and five pre-existing warnings; production build passes. SQL corrections are complete: temporary holds remain pending; enrollment owner is rechecked; claim locks only queue rows. Final SQL suite has10 tests including49h timing boundary and actual dispatcher/PGlite integration; main rerun follows. Full final verification receipt supersedes this checkpoint.

Final browser regression: main reran npm run test:playwright:scanner-refinement;10/10 passed in Chromium/WebKit. Caption source remains unchanged; requested independent review is retained above, optional timing edits not included. All task source/docs/plan/mockup files are intended for commit; transient reviewer logs, mutation output and raw ASR remain outside the repository.
