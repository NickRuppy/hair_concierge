# Personal-plan result email

## Outcome and source context

Deliver a dedicated Customer.io transactional result email for the `personal_plan` quiz that
matches the reviewed hard-paywall result/offer journey. The email must reuse the prepared public
offer model, expose no `lockedPlan` products or routine details, and leave the existing legacy quiz
email unchanged.

Reviewed mockups:

- Rich/mobile HTML:
  `/Users/nick/.codex/visualizations/2026/07/29/019faeea-7d70-7ae1-a7b6-45972ac92183/personal-plan-result-email-mobile-preview.html`
- Selected purple statement treatment:
  `/Users/nick/.codex/visualizations/2026/07/29/019faeea-7d70-7ae1-a7b6-45972ac92183/personal-plan-result-email-mobile-corrected-accents.png`
- Selected coral CTA:
  `/Users/nick/.codex/visualizations/2026/07/29/019faeea-7d70-7ae1-a7b6-45972ac92183/personal-plan-result-email-mobile-coral-cta.png`
- Final generic German greeting:
  `/Users/nick/.codex/visualizations/2026/07/29/019faeea-7d70-7ae1-a7b6-45972ac92183/personal-plan-result-email-mobile-german-greeting.png`
- Final compact, image-first opening:
  `/Users/nick/.codex/visualizations/2026/07/29/019faeea-7d70-7ae1-a7b6-45972ac92183/personal-plan-result-email-mobile-compact-header.png`

Current Customer.io state was verified read-only on 2026-07-29:

- workspace `219516`
- legacy active message/template `7/40`, name `quiz_result_artifact`
- legacy inactive draft message/template `8/41`, name `[Copy] quiz_result_artifact`
- no personal-plan transactional message exists
- the authenticated pinned management CLI is `@customerio/cli@0.0.19`

## Chosen direction

Create a new personal-plan transactional message by copying the verified inactive legacy draft.
This preserves the sender identity, EU workspace, layout `1`, legal footer, and conservative email
client settings without changing the legacy active message.

The prepared artifact remains the sole personalization authority:

- `publicOfferModel.diagnosticRows` supplies the exact same three dimensions, order, labels, and
  summaries used by the result page.
- `publicOfferModel.planFitStatement` supplies the exact result-page fit argument shown beneath the
  three dimensions.
- A backward-compatible `primaryMessage` field is computed in the same prepared-plan builder from
  the already-ranked central priority that produced `diagnosticRows[0]`.
- Customer.io renders supplied values only. It does not rank quiz answers or maintain a competing
  personalization model.

The email uses a single pre-rendered, email-safe before/after comparison image with the same crops,
spacing, labels, and centered purple arrow as the result page. The caption remains live text.

## Scope and non-goals

### In scope

- Add the prepared public `primaryMessage` contract and deterministic German copy.
- Add a dedicated personal-plan Customer.io payload builder and once-only delivery service.
- Trigger delivery from the result/reveal page after a personal-plan lead and prepared artifact have
  been atomically attached; a reload may safely retry the request.
- Keep lead capture and result navigation independent of Customer.io delivery success.
- Add canonical repository-managed HTML and plain-text templates.
- Add a guarded Customer.io operator flow for the new draft and record its generated IDs.
- Create and update the inactive Customer.io personal-plan draft through the pinned CLI.
- Verify responsive rendering, images-blocked readability, Liquid escaping, CTA attribution, and
  failure/deduplication behavior.

### Non-goals

- Do not modify active legacy message/template `7/40`.
- Do not retire the legacy quiz or legacy email.
- Do not expose products, product verdicts, application order, cadence, or other `lockedPlan` data.
- Do not add a name question to the quiz; the greeting is always `Hallo,`.
- Do not change priority ranking, hair-potential scoring, chart dimensions, pricing, checkout, or
  the result-page design.
- Do not activate the new Customer.io message, change production environment variables, deploy,
  merge, or send a production transaction in the implementation pass.

## Target map

- `src/lib/personal-plan-quiz/prepared-plan.ts`
  - compute `primaryMessage` alongside the three diagnostic rows from the same ranked priorities
- `src/lib/personal-plan-quiz/customerio.ts`
  - preserve identify behavior and add/reuse the personal-plan delivery integration seam
- new `src/lib/customerio/personal-plan-result-artifact.ts`
  - build the transactional payload from the stored prepared artifact
- new or extended Customer.io result delivery service under `src/lib/customerio/`
  - claim once, load the attached artifact, send, and mark sent/failed
- new `src/app/api/quiz/personal-plan-result-artifact/route.ts`
  - accept only `personal_plan` leads and invoke the once-only delivery service
- `src/app/result/[leadId]/reveal/personal-plan-result-reveal.tsx`
  - request email delivery with `keepalive` without delaying or blocking the reveal
- `src/app/api/quiz/result-artifact/route.ts`
  - legacy behavior remains unchanged and explicitly legacy-only
- `docs/customerio/personal-plan-result-artifact-template.html`
  - canonical email-safe HTML fragment
- `docs/customerio/personal-plan-result-artifact-plain-text-template.txt`
  - complete MIME plain-text alternative
- `docs/customerio/personal-plan-result-artifact.md`
  - IDs, Liquid contract, preview/apply/rollback and later activation procedure
- `public/images/emails/personal-plan-before-after.jpg`
  - pre-rendered comparison figure for broad email-client support
- new or generalized script under `scripts/customerio-*.ts`
  - pinned CLI, exact target identity, full-template replacement, drift guard, backup, rollback and
    read-back verification for the new personal-plan draft
- focused tests under `tests/`
  - prepared copy, payload privacy, send deduplication/failure, lead-route scheduling, template
    contract, and management-script guards

No database migration is expected. Existing `leads.artifact_email_status` fields provide the
once-only claim, and the attached `personal_plan_prepared_artifacts` row already stores
`priorities` and `public_offer_model`.

## Prepared personalization contract

`primaryMessage` is additive to the existing public offer model:

```ts
type PersonalPlanPrimaryMessage = {
  kind: "concern" | "goal" | "positive"
  label: string
}
```

Rules:

1. Use the priority marked `isCentral`; it corresponds to `diagnosticRows[0]`.
2. `tier === "positive"` or a positive fallback becomes `kind: "positive"`.
3. Tier 1/2 priorities and priorities with matched concerns become `kind: "concern"`.
4. Remaining goal-led tier 3 priorities become `kind: "goal"`.
5. Use the already-controlled central priority `title` as the complete fallback label. A small,
   explicit email override map may make reviewed variants more direct (for example the reviewed
   surface-frizz label `Frizz und viele abstehende Haare`); every unmapped and merged variant
   remains safe because it falls back to the existing controlled title.
6. When several concerns belong to the central dimension, use one combined label.
7. Concerns represented by dimensions two and three remain visible in the three-row section but
   are not repeated in the loud callout.
8. Newly prepared artifacts persist `primaryMessage`. The email payload parser derives the same
   value from the stored central priority for older compatible artifacts, but no historical email
   replay is performed as part of this change.

Customer.io message data:

```text
lead_id
profile_line
comparison_image_url
primary_message       { kind, label }
diagnostic_rows[]     { id, title, today_label, summary }
plan_fit_statement
cta_label
result_url
```

The payload must not contain `locked_plan`, products, order, frequency, quiz free text, email
consent, claim tokens, or diagnostic scores that are not rendered.

## Designed user journey

Status: **explicitly confirmed by Nick on 2026-07-30**

1. A visitor completes the personal-plan quiz and submits their email address.
2. Chaarlie atomically stores/reuses the lead and attaches the already-prepared artifact. The
   browser continues immediately to the personalized result/reveal; email delivery does not delay
   or block this transition.
3. The reveal page starts a non-blocking `keepalive` request to the dedicated personal-plan email
   endpoint. The endpoint requires `quiz_kind = personal_plan` and atomically claims the result
   email. A reload can recover a request that never reached the server, while repeated requests for
   the same attached lead cannot send a second copy. Customer.io identification remains separate.
4. The visitor receives the dedicated personal-plan email:
   - subject: `Dein persönlicher Haarplan ist bereit`
   - compact single-line `chaarlie` wordmark without a separate brand subtitle
   - generic greeting: `Hallo,`
   - one-sentence analysis introduction so the complete comparison image is visible in the initial
     mobile email viewport
   - exact result-page before/after comparison with the live disclaimer
   - one loud, controlled statement for the central chart dimension
   - solid purple `Nicht deine Haare sind das Problem …` bridge
   - the exact three result-page diagnostic dimensions in the same order
   - the exact result-page `planFitStatement`
   - static hard-paywall pitch and coral `Meinen Plan freischalten` CTA
5. If the central dimension is concern-led, the callout says what currently concerns the visitor.
   If it is goal-led, it names the goal without calling it a problem. If it is positive, it names
   the good starting point.
6. If images are blocked, all meaning, the disclaimer, the three dimensions and the CTA remain
   readable as live text. A client selecting plain text receives the same content in document
   order.
7. The CTA opens `/result/<leadId>?entry=result_email#pricing`, uses the existing personal-plan
   pricing anchor, and retains the existing result-email attribution.
8. If Customer.io is unavailable or misconfigured, result access still succeeds. The send is
   marked failed with a sanitized error for controlled replay. As with the legacy email, an
   in-progress claim that is interrupted after the database claim remains an operational manual
   recovery case; this change does not introduce a blind automatic reaper.
9. The journey completes when the visitor reopens their result and can choose whether to unlock
   the paid personal plan. No paid routine or product recommendation is disclosed in the email.
10. Legacy quiz visitors continue receiving legacy message `7/40` unchanged.

## Mockup evidence

Status: **confirmed**

Nick reviewed and corrected the HTML mockup through multiple passes. Incorporated feedback:

- emotional, pitch-led direction instead of the value-heavy legacy result email
- same before/after image treatment as the result page, central and early in the email
- mobile typography and spacing
- reduced typeface/color count
- louder purple concern treatment
- solid purple `Nicht deine Haare …` statement
- coral CTA
- generic German `Hallo,` greeting because the personal-plan quiz captures no name
- compact wordmark and one-sentence opening so the complete comparison image appears without an
  initial scroll on the reviewed 390 px viewport
- exact three result-page diagnostic dimensions plus the existing plan-fit statement
- HTML-lite/images-blocked and plain-text alternatives

Selected artifact:
`/Users/nick/.codex/visualizations/2026/07/29/019faeea-7d70-7ae1-a7b6-45972ac92183/personal-plan-result-email-mobile-preview.html`

## Ordered tasks

1. **Lock the prepared personalization contract with tests.**
   - Add fixtures for concern-led, merged-concern, goal-led and positive central priorities.
   - Assert `primaryMessage` is controlled copy, corresponds to the first diagnostic dimension,
     and never contains raw quiz free text.
   - Completion: focused prepared-plan tests fail before and pass after the additive model change.

2. **Create the personal-plan transactional payload and delivery service.**
   - Load the attached artifact by lead, parse the public model and priorities, and reject missing
     or malformed required data.
   - Build only the approved message-data fields and attributed result URL.
   - Atomically claim `artifact_email_status IS NULL` while filtering
     `quiz_kind = personal_plan`, send once, mark sent, or mark failed with the existing
     sanitized-error rules.
   - Capture and validate `siteUrl` before entering the asynchronous send path.
   - Completion: tests cover success, repeated/concurrent calls, prior sent/failed status, missing
     artifact, Customer.io failure, URL attribution and locked-data exclusion.

3. **Wire non-blocking, recoverable delivery to the personal-plan reveal.**
   - Add a dedicated personal-plan result-artifact route and call it from the reveal component with
     `keepalive` after the lead/artifact already exists.
   - Do not await the email request before showing or completing the reveal.
   - Keep Meta/funnel behavior, lead response shape and legacy result-artifact route unchanged.
   - Require both the App API key and personal-plan transactional message ID for sends; missing
     configuration returns/logs a sanitized operational failure without failing result access.
   - Completion: route and reveal tests prove personal-plan kind filtering, non-blocking behavior,
     reload-safe retry and atomic send deduplication.

4. **Produce the email-safe before/after asset and canonical templates.**
   - Render one approximately 2x composite JPEG from the existing source, with the same two crops,
     spacing, labels and centered purple arrow as the result page.
   - Implement the reviewed hierarchy with conservative table markup and inline styles.
   - Escape all dynamic HTML values with `xml_escape`; keep the text alternative unescaped but
     controlled.
   - Condition the primary callout label by `kind` without changing its supplied wording.
   - Completion: template tests prove required fields, one result URL, complete image-blocked text,
     no locked fields, legal-layout ownership and full plain-text parity.

5. **Create and guard the inactive Customer.io draft.**
   - Through pinned CLI `@customerio/cli@0.0.19`, call
     `POST /v1/environments/219516/transactional_messages/8/copy` with
     `{ "copy_to_env": 219516 }`; do not copy or modify active `7`.
   - Rename/document the generated message and template as the personal-plan draft.
   - Add a dedicated personal-plan operator script with exact
     workspace/message/template/name/layout/state assertions, schema drift checks, dry-run
     validation, backup, rollback and read-back. Do not broaden the legacy active-email script.
   - Set and verify the new subject `Dein persönlicher Haarplan ist bereit` and a repository-owned
     preheader `Wir haben dein Haarprofil analysiert. Dein persönlicher Plan wartet auf dich.`
     alongside the canonical HTML and plain text.
   - Preview, review, then apply only the canonical HTML/plain text to the new inactive draft.
   - Completion: documentation records generated IDs and checksums; read-back matches repository
     sources; legacy `7/40` and `8/41` fingerprints remain unchanged.

6. **Run focused and repository verification.**
   - Run focused node tests for prepared artifacts, payload/service, lead persistence, templates and
     Customer.io operator guards.
   - Run the repository gate `npm run ci:verify`, including its production build.
   - Render 390 px and 600 px fixtures for concern, goal and positive variants.
   - Inspect images blocked and plain text.
   - Completion: all checks pass on the exact branch fingerprint and the Customer.io draft remains
     inactive.

7. **Run final readiness and code review.**
   - Use `ready-check`, then `request-code-review` including the required read-only counterpart
     whole-branch review.
   - Reconcile verified findings and refresh stale checks after changes.
   - Completion: no verified blocking findings remain and receipts match the same content.

## Verification

### Automated

- Focused prepared-plan, personal-plan lead, Customer.io payload/service, template and operator
  script tests
- `npm run ci:verify`
- Customer.io CLI schema validation and read-only fingerprints

### Manual/browser

- 390 px mobile and 600 px desktop render
- concern, merged concern, goal and positive callout variants
- images blocked
- link and button both resolve to the same attributed result URL
- no horizontal overflow or clipped CTA
- visually compare the composite image, purple bridge and coral CTA with the approved mockup

### Live-state

- Before create/apply: read and fingerprint legacy `7/40` and `8/41`
- Create only a new inactive personal-plan draft
- After apply: verify draft state, message-template pairing, layout `1`, sender/reply identities,
  legal footer, body checksums and plain-text checksum
- Do not send a test transaction to any inbox without a separately named recipient and approval
- Do not activate, configure Vercel, deploy, or mutate production application state

## Review and handoff

- Branch/worktree: `codex/personal-plan-result-email` in
  `.worktrees/personal-plan-result-email`, based on fresh `origin/main`
- Plan counterpart review: required before journey sign-off
- Mockup review: **confirmed**
- Designed user-journey sign-off: **confirmed 2026-07-30**
- Implementation authorized 2026-07-30
- Implementation stop point: verified review-ready branch plus an inactive, read-back-verified
  Customer.io draft
- Final acceptance also requires complete tracking, HTML/images-blocked/plain-text coverage, and a
  user-style quiz walkthrough through delivery and review of the resulting email.
- Nick requested the new email live. Publication may proceed after verification, but the guarded
  repository process still requires a separate verified-head `merge it` authorization before
  merge/deployment. The Customer.io message must not be activated ahead of deployed application
  code.

Residual risks:

- Customer.io HTML rendering differs by client; the acceptance bar is readable order and complete
  meaning, not pixel identity.
- Existing prepared artifacts lack `primaryMessage`; the payload parser uses the stored controlled
  central-priority title as its compatibility fallback. Historical sends are not replayed.
- A process interruption after the atomic email claim can leave a lead in `sending`, matching the
  existing legacy recovery limitation. Recovery remains an explicit operator action rather than an
  automatic retry that could duplicate a send.
- The copied Customer.io object receives generated IDs that must be recorded only after the guarded
  external create succeeds.
