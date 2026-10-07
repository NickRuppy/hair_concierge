# Restore readable trial emails

## Outcome and approved scope

Nick reported the 15 September 2026 contract-confirmation email showing encoded
text in Gmail and answered **“do it”** to correcting the escaping and verifying
an actual delivered email. Restore the existing intended presentation, including
the trial reminder's dates, prices and navigation links. Preserve copy, accepted
terms, layout, scheduling, recipient selection and delivery/privacy flags.

This is a bounded transport-rendering repair, with no new journey or design choice.
No footer redesign, production template change, deploy, backfill or bulk resend.
Explicitly labeled tests of both affected emails and a literal-HTML safety probe
to Nick are within verification. A separate inactive test-only copy is used when
the App API key is unavailable; production templates remain untouched.

## Evidence and direction

The original HTML body's text was percent-encoded. Decoding it matched the plain
alternative exactly. Customer.io documents `escape` with percent-encoded output;
`htmlencode` escapes HTML entities instead:
https://docs.customer.io/messaging/liquid/tag-list/

Use `htmlencode` for the fixed Liquid trigger substitutions in both send builders.
Keep user-provided text as trigger data; do not interpolate it into Liquid source.
The intended appearance is the already-existing local preview. Its prior test
double incorrectly treated `escape` as HTML escaping; correct that assumption.

## Decision coverage

- Status: confirmed for the bounded repair explicitly requested above.
- Confirmed with Nick: fix unreadable text, check the reminder, verify delivery.
- Inherited: existing German wording, layouts, dates, amounts and destinations.
- Implementation defaults: provider-specific filter, focused regression guards.
- Open consequential assumptions: none.
- Undiscussed consequential assumptions affecting this handoff: none.
- Coverage acknowledgement: Nick's “do it”, 15 September 2026, following diagnosis.
- Internal revalidation: current main reproduces the same filter defect in both
  builders; the reminder's locally simulated provider behavior is also incorrect.
- No new mockup/journey acknowledgement is claimed; the instruction authorizes
  restoring the existing presentation, not proposing a new experience.

## Target map and tasks

1. Correct the provider test double and add consumer-output assertions in
   `tests/billing-trial-required-notices.test.ts` and
   `tests/customerio-trial-reminder.test.ts`. Prove both fail on current code.
2. Replace the filter in `src/lib/customerio/trial-required-notices.ts` and
   `src/lib/customerio/trial-reminder.ts`; align the operations payload example.
3. Check readable German text, newlines, escaped HTML, literal Liquid in user data,
   reminder link destinations, unchanged plain text and privacy flags.
4. Send explicitly labeled tests to Nick through Customer.io, if authenticated
   access is available; inspect delivered MIME and rendered output. Report an
   access blocker honestly rather than treating local simulation as live proof.

## Verification and handoff

- Red: both existing builders fail consumer-readable rendering assertions.
- Green: focused notice/reminder, delivery, route and transport tests.
- Repository: TypeScript, focused ESLint, diff whitespace check.
- Read-only review: full task diff including untracked test helper and this plan.
- No migration, payment-state or billing-price changes.
- Stop before commit/push/merge/deployment; report real-delivery evidence separately.
- Commit disposition: source, tests, helper, operations doc and this plan.
- Transient logs, test payloads, previews and reviewer report: outside repository;
  discard credentials immediately after verification attempts.

## Verification receipt (15 September 2026)

- Branch: `codex/trial-email-encoding`; base `c3a61d3a` (`origin/main` at creation).
- Original acknowledgement and implementation scope remain unchanged.
- Red: 10 pass / 2 fail on the original builders, specifically unreadable encoded
  confirmation text and encoded reminder date; recorded before the filter edit.
- Green: 32 focused tests pass across required notices, reminders, reminder delivery
  and reconcile route, and generic Customer.io transactional transport.
- `npm run typecheck`: pass. Focused ESLint: source passes; tests are excluded by
  repository ESLint configuration. `git diff --check`: pass.
- Live Customer.io UI test sends using exact HTML emitted by the fixed builders:
  confirmation at 06:14:12 UTC; reminder at 06:15:46 UTC; safety at 06:17:24 UTC.
  Gmail IDs: `1a0a3b39fe4f9b60`, `1a0a3b50c56b3c69`, `1a0a3b68ca5ccb5c`.
- Delivered HTML confirms readable German, full confirmation terms and deadline,
  accepted amounts, and exact HTTPS reminder account/cancellation destinations.
  Safety probe confirms tags, both quote types and ampersands are entity-escaped;
  literal `{{ customer.email }}` stays literal; existing entities are escaped again.
- Rendered delivered reminder inspected in-browser. No link was activated.
- Boundary: these are provider UI test sends with synthetic data, not a production
  webhook/API send from the changed application. The App API key was unavailable
  in the Vercel export. Exported credentials were removed after inspection.
- External artifact: Customer.io message **17**, **TEST ONLY — Trial email encoding
  — 2026-09-15**, retained as an inactive setup draft, containing the safety probe.
  No production trigger/template was changed; no audience campaign was activated.
- Root main was kept clean; no commit, push, PR, merge or deployment performed.

### Review disposition

Read-only Claude review ran at `high`; Codex inspected the entire task diff.
Structural review was unnecessary for a localized filter repair.

1. **Rejected:** claim that `htmlencode` is undocumented/unsupported. The official
   tag list explicitly includes it (HTML entities), and the delivered safety test
   independently proves the required escaping behavior.
2. **Accepted limitation, verified separately:** the local test double alone cannot
   prove Customer.io behavior. Three actual Gmail deliveries provide additional
   evidence; the production API path remains a release verification checkpoint.
3. **Rejected:** alleged incorrect documentation citation, for the same primary
   source evidence. No substitute `escape_once` change was made.

No blocking code findings remain after verification. The transient reviewer report
is archived outside the repository with the verification logs; the canonical
content fingerprint is in the external final receipt. All task source/docs/tests
are intended for the eventual PR.

## Approved continuation: Gmail wrapper repair and release

On 15 September Nick linked this repair from the scanner-launch task and answered
**“Do it”** to: release the encoding fix, clean up wrapper/footer formatting, and
verify received tests in desktop Gmail. This supersedes the earlier no-release
and no-footer-change boundaries above; that original receipt remains historical.
Nick separately approved one labelled test to info@chaarlie.de for the connected
Gmail desktop inbox; nickrupprechter+trial3@gmail.com remains the primary test inbox.

- Keep existing wording, rates, deadlines, destinations and privacy flags.
- Keep full-document API bodies. Assign a new dedicated classic Customer.io layout
  containing only `{{content}}` to messages 16 and 15; never edit shared Empty Layout.
- Put the existing Abmelden/Impressum/Datenschutz links inside each API HTML document,
  centered within the content width, with explicit Arial and readable #655471 text.
  Preserve the provider unsubscribe URL variable; do not turn it into cancellation.
- Use explicit table-cell font/color/background styles so Gmail does not depend on
  the body element. Center the required-notice text in a padded, readable column.
- Test the exact builder body with the dedicated layout in inactive message 17,
  inspect received MIME plus desktop Gmail. UI test delivery is not an API E2E claim.
- Run focused tests, typecheck, source lint and one refreshed Claude branch review.
- Release this bounded repair through PR, verified-head merge and production
  deployment. Preserve reminder rollout cutoff 2026-09-15T06:06:29Z and enrollment.
- No customer resend, backfill, billing mutation or unrelated campaign changes.
- Internal revalidation: single-document composition and footer alignment restore
  the accepted email presentation; no new product journey or consequential choice.

### Continuation coverage and release order

Status: confirmed. Original acknowledgements remain above. Explicitly confirmed:
repair unreadable Gmail formatting, align the existing footer, release the repair,
and send a labelled desktop-Gmail test. Inherited: approved reminder design, all
contract text, amounts, links, subscriptions and privacy settings. Routine defaults:
content-only dedicated layout, explicit inline typography, existing links centered
in the same readable column. Open/undiscussed consequential choices: none.
Internal revalidation: this is a corrective rendering pass within Nick's existing
email-layout approval and direct request to fix formatting, not a new journey.
Verification evidence will show the real rendered message before provider rollout.

Ordered execution and proof:
1. Update both reminder HTML twins (billing preview and Customer.io API builder)
   and both required-notice twins (preview and builder). Preserve equality tests.
2. Add structural and link checks to the two existing affected tests; run all six
   notice/reminder/transport test files, source lint and TypeScript.
3. Create layout 2, exactly `{{content}}`, without assigning production messages.
   Use it on inactive message 17 for actual received HTML and Gmail inspection.
4. Review/publish/merge/deploy body-with-footer first. The old shared layout may
   briefly duplicate footer links, but none disappear. Verify deployed source SHA.
5. Assign the dedicated layout separately to 16 and 15 and read back both choices.
   Save the exact API body as each template fallback, preserving envelope/settings.
6. On layout failure, restore that message's Empty Layout (id 1); do not edit the
   shared layout. On code rollback, restore both assignments to id 1 FIRST, then
   roll back application code. Preserve enrollment and immutable cutoff as live
   operational state, not a source-code assertion.

Claude plan-review disposition: accepted dual-source/equality and release-order/
rollback findings (included above). Rejected a second product-approval request:
Nick explicitly approved this corrective scope after the rendered email was
reviewed, and then authorized the labelled Gmail test. No wording or journey
change is proposed. Provider unsubscribe resolution inside the body remains a
required delivered-HTML check; UI delivery is explicitly not runtime API proof.

Delivered probe revealed that `{{unsubscribe_url}}` renders empty inside the body.
Use Customer.io's documented `{% unsubscribe_url %}` tag instead; verify the next
Nick-only delivered test contains a real provider URL. Gmail desktop visual check
of the same HTML structure completed in the one authorized business-inbox test.
Source: https://docs.customer.io/messaging/liquid/tag-list/#unsubscribe_url

### Continuation verification receipt

- Parent reran all six focused suites: 32/32 pass, source ESLint and full TypeScript
  pass. Updated the old 'no Impressum in body' assertion to the exact approved link
  set now that the footer belongs to the body. No billing behavior changed.
- Worker limited to the named source/test files; parent inspected the full diff.
- Claude high whole-branch correctness review: no blocking code findings. Structural
  lane not triggered (three source files, localized rendering changes). Its broader
  508-test result is supplementary; parent independently ran the six affected suites.
- Accepted operational sequencing and provider-rendering limitations. The existing
  transactional send-to-unsubscribed behavior is preserved; Abmelden was already in
  the shared footer and is not a cancellation control.
- One approved info@chaarlie.de test was visually inspected in desktop Gmail:
  centered 560px card, Arial body, readable colors, centered address/footer. Initial
  test caught blank unsubscribe href; corrected to the documented provider tag.
- Final reminder received in Nick's trial3 inbox, ID `1a0a3cf10a9142c6`, 06:44:11 UTC:
  one html/body, one footer, no unresolved Liquid or percent-encoded copy, exact
  account/cancellation/legal destinations and generated HTTPS unsubscribe URL.
- These are actual received messages sent through the provider UI using exact API
  builder bodies and synthetic data. No application webhook/API send is claimed.
- Publication artifacts: all changed source/tests/docs and this plan are committed.
  Review logs, synthetic payloads and browser evidence are transient /tmp artifacts.
  Customer.io layout 2 is retained as operational configuration; message17 inactive
  test copy is retained for future verification. No credentials were created.
- Final confirmation received in trial3, ID `1a0a3d08b1d79a08`, 06:45:48 UTC:
  one html/body, one footer, real unsubscribe/legal URLs and no unresolved Liquid.
  Decoded receipt content equals the generated receipt byte-for-byte (all terms
  and newlines). Delivered HTML inspected in browser in its centered padded column.

Live preflight correction: required notices are auto-created message **16**, trigger
`chaarlie_required_contract_notice_v1` (no production environment override); message
14 is `partner_access_account_ready` and is only historical sender evidence. It
must remain untouched. Message 16 needs its exact API body saved as a Code-editor
fallback before assigning layout 2; keep API-owned subject/data and privacy flags.
The earlier assumed message ID was corrected before any live message mutation.
