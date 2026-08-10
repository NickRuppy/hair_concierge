# Payment support reporting lifecycle

**Status:** Approved; implementation in progress with the UX delivery
**Worktree:** `.worktrees/payment-error-feedback`
**Delivery:** Same task branch, kept as a separately gated default-off capability
**Dependency:** [Truthful payment error feedback](./2026-08-10-payment-error-feedback-ux.md)

## 1. Outcome and source context

Add one-tap `Problem melden` to every explicit phase-1 checkout problem state. A report creates a durable service-only case, shows a stable `PAY-XXXXXXXX` code, emails a receipt to the already-known lead/account address, and remains open until Nick approves one concise case-specific resolution email.

The customer provides no email again and no free text. Supabase owns lifecycle state; Sentry provides privacy-safe diagnostic correlation; Customer.io sends requested transactional service messages. There is no admin page and no automatic resolution.

Sources:

- Approved final-state evidence: [payment feedback states](./mockups/2026-08-10-payment-feedback-states.html).
- [Payment monitoring runbook](../docs/operations/payment-failure-monitoring.md).
- [Customer.io data contract](../docs/customerio-data-contract.md).
- [Customer.io transactional email](https://docs.customer.io/messaging/send/transactional/email/).
- [Customer.io successful transactional response](https://docs.customer.io/messaging/send/transactional/api-common-api-errors/) — official 200 contract includes `delivery_id` and `queued_at`; reverify before Task 2 in case the external API changes.
- [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function security](https://supabase.com/docs/guides/database/functions).

## 2. Chosen direction

Extend the phase-1 `PaymentFeedbackKind` and shared card with:

- a strict `POST /api/billing/payment-support` endpoint;
- a service-role-only `payment_support_cases` table and atomic create/dedupe routines;
- privacy-safe Sentry correlation and fixed Customer.io receipt;
- dry-run-first list/resolve/delivery-check/cleanup commands;
- a fixed resolution wrapper plus one short German explanation explicitly approved by Nick.

The recurring Codex/Sentry checker is a separate post-deploy task. It may surface open cases and start an investigation, but never send or resolve without Nick's approval.

## 3. Scope and non-goals

### In scope

- Reporting on all eight explicit phase-1 feedback states, including ordinary bank declines, pending/paid-but-delayed support problems, and “existing access is wrong.” Neutral cancellation is not a feedback state.
- One tap, no form, no email field, no free text.
- Durable case/dedupe, abuse controls, receipt, Sentry correlation, operator resolution, retention cleanup, privacy/runbook updates.
- Feature flags so phase-1 feedback remains live while reporting stays default-off.

### Non-goals

- No admin/support dashboard.
- No report on neutral user cancellation.
- No raw provider error/reference, card detail, email, IP, URL, or customer free text in the browser payload, Sentry, or case table.
- No automatic resolution, automatic case-specific content, or blind retry after ambiguous email delivery.
- No recurring checker installation, Sentry workflow mutation, Customer.io template activation, production migration, deployment, feature activation, or merge without separate authorization.

## 4. Authoritative contracts

### API

```ts
type PaymentSupportRequest = {
  checkoutAttemptId: string
  checkoutContext: "result_membership" | "result_one_time" | "reactivation"
  feedbackKind: PaymentFeedbackKind
  provider: "stripe" | "paypal" | "unknown"
  method: "card" | "apple_pay" | "paypal" | "unknown"
}

type PaymentSupportResponse = {
  reportCode: string
}
```

Reject unknown keys/invalid lengths. Do not accept lead ID, email, user ID, provider error/message/reference, free text, or URL. For reactivation, require the authenticated Supabase user. For result membership/one-time, require and verify the existing HMAC-signed, HttpOnly `FUNNEL_SESSION_COOKIE`, then derive `lead_id` from the matching `funnel_sessions.id + visitor_id + package_key` row. Fail closed when that server-trusted binding is absent or does not own a lead; a UUID from the result URL is never sufficient to authorize email.

`REPORTABLE_PAYMENT_FEEDBACK_KINDS` is the exact closed array `access_already_active`, `checkout_not_loaded`, `details_invalid`, `card_declined`, `provider_temporarily_unavailable`, `payment_not_completed`, `payment_status_pending`, and `access_activation_delayed`. The latter two preserve `pending`/`succeeded` truth and mean “help with this unresolved state,” not “payment failed.” Reject any value outside this array.

For the anonymous reverse lookup, add a server-only query on `funnel_sessions` selecting `lead_id` where `id`, `visitor_id`, and `package_key` all match the decoded cookie. Require exactly one non-null `lead_id`. `FUNNEL_ATTRIBUTION_ENABLED=false`, missing `FUNNEL_COOKIE_SIGNING_SECRET`, invalid/expired cookie, no row, null lead, or inconsistent ownership all fail closed without creating a case or sending email.

Ordering:

1. Strictly parse the closed request, then charge the existing persistent RPC at 5 request attempts/10 minutes/IP before any identity/database lookup; return 429 with an accurate `Retry-After`.
2. Resolve identity from authenticated session or signed funnel cookie/database binding; never from request JSON.
3. In one transaction, take `pg_advisory_xact_lock(hashtextextended(identity_key, 0))`, where `identity_key` is prefixed `lead:` or `user:`. Under that lock, look up `(checkout_attempt_id, feedback_kind, provider, method)` first and return the existing same-owner case/code without identity allowance. Its receipt is never reset; only an existing `pending` receipt may be scheduled again and the atomic delivery claim still permits one sender.
4. For a genuinely new key, count this identity's case rows from the prior 24 hours, enforce at most 3, then `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING RETURNING ...`. If the insert returns no row, re-select the conflict and return it only when its identity matches; otherwise fail as an integrity error. The generic RPC does not approximate distinct cases.

Record the case before Sentry/email. If those fail, retain the row and delivery status. If the database write fails, keep payment recovery available and show a concise report failure/contact fallback.

### Persistence/security

Create `public.payment_support_cases` with:

- UUID primary key; unique `PAY-XXXXXXXX` using eight unambiguous base32 characters/40 random bits; regenerate on unique violation for at most three attempts;
- exactly one identity path: `lead_id` or `user_id`;
- customer-reported attempt/context/kind/provider/method/family/truth/retryability and unique dedupe key; name these columns/fields `reported_*` where ambiguity matters and never treat them as provider truth without correlation;
- `open | resolving | resolved` case lifecycle; receipt/resolution email fields carry delivery ambiguity without duplicating it at case level;
- Sentry `pending | delivered | failed` and event ID;
- receipt `pending | sending | sent | failed | delivery_uncertain`, deterministic attempt ID, Customer.io delivery ID, timestamps;
- resolution outcome/note plus equivalent email state/attempt/delivery ID, resolver, timestamps.

Store no email, IP, provider reference/error/message, card data, or free text. Resolve email at send time. Retain resolved cases for 90 days, then guarded cleanup; retain open cases until resolved/stale review. Privacy/legal must approve before activation.

Enable RLS; add no client policies; explicitly revoke table privileges from `anon`/`authenticated`. Public RPCs use `SECURITY INVOKER`, fixed `search_path`, revoke execute from `PUBLIC, anon, authenticated`, and grant only `service_role`. No `SECURITY DEFINER` function.

### Email ambiguity

Extend the shared Customer.io module with a receipt-returning function while preserving the existing `Promise<void>` wrapper for callers that do not need a receipt. The new function parses and validates the officially documented `{ delivery_id, queued_at }` 200 body, returns it, throws a typed definitive HTTP error on non-2xx, and throws a distinct ambiguous-delivery error for abort/network failure or a 200 without a valid delivery ID. Task 2 must re-open the official contract before implementation because it is external and can drift.

Persist a deterministic attempt ID and `sending` before each Customer.io call; include attempt ID/report code in `message_data`. A valid 200 stores `delivery_id`; a typed definitive non-2xx is `failed`. Abort/disconnect/invalid-success-body becomes `delivery_uncertain`. A process crash can leave `sending`; the operator routine treats any stale `sending` attempt as uncertain and transitions it before allowing further action. Neither uncertain state auto-retries because the send API has no documented caller idempotency key.

The operator verifies report/attempt in Customer.io, then explicitly finalizes delivered or re-arms with a duplicate-warning confirmation. Resolve only after a returned delivery ID or manual confirmation.

Message IDs:

- `CUSTOMERIO_PAYMENT_SUPPORT_RECEIPT_TRANSACTIONAL_MESSAGE_ID`
- `CUSTOMERIO_PAYMENT_SUPPORT_RESOLUTION_TRANSACTIONAL_MESSAGE_ID`

Reuse `src/lib/customerio/transactional.ts` so `send_to_unsubscribed` and disabled message retention remain single-sourced.

### Observability and flags

Add `customer_payment_issue_reported` to `PaymentSignal` with explicit `PAYMENT_LEVEL_BY_SIGNAL` value `warning`. It is an operator correlation alert, not evidence that the provider threw an exception. Sentry receives existing safe context plus `support.report_code` and delivery state. The report signal creates its own report fingerprint, separate from the original payment-failure fingerprint; it does not mutate or replace the failure event.

Default-off flags follow exact `"true"` convention:

- `PAYMENT_SUPPORT_ENABLED=true`
- `NEXT_PUBLIC_PAYMENT_SUPPORT_ENABLED=true`

Disabling reporting never removes phase-1 feedback/recovery.

## 5. Target map

- `supabase/migrations/<CLI-generated timestamp>_payment_support_cases.sql` — create via `supabase migration new payment_support_cases`.
- `src/app/api/billing/payment-support/route.ts` and `src/lib/billing/payment-support.ts` — strict route, identity, persistence/delivery orchestration.
- `src/lib/rate-limit.ts` — named IP limit; distinct-case logic stays in atomic case routine.
- `src/components/checkout/use-payment-support-report.ts` and phase-1 `payment-feedback-card.tsx` — client state/receipt/failure.
- checkout context owners from phase 1 — canonical attempt/context/lead inputs.
- `src/lib/customerio/payment-support.ts` and `src/lib/customerio/transactional.ts` — receipt/resolution plus typed delivery receipt/error result while preserving the existing sender API.
- `src/lib/observability/payment.ts` and `src/lib/observability/payment-client.ts` — signal/report-code context.
- `scripts/billing/payment-support-cases.ts` and `package.json` — list/resolve/delivery-check/cleanup.
- `src/app/datenschutz/page.tsx`, `docs/customerio-data-contract.md`, `docs/operations/payment-failure-monitoring.md` — disclosure and operations.

Tests:

- `tests/payment-support-route.test.ts`
- `tests/payment-support-persistence.test.ts`
- `tests/payment-support-email.test.ts`
- `tests/payment-support-command.test.ts`
- extend phase-1 component/browser fixtures for report loading/success/failure.

## 6. Designed customer/operator journey — confirmed

1. Every explicit feedback card shows `Problem melden`; neutral cancellation does not. Pending/succeeded cards retain their truthful payment state while asking for help with the unresolved outcome.
2. One tap disables/announces progress. No form/email question appears.
3. The route records the case and returns `{ reportCode }` immediately. It schedules the receipt through Next's repository-proven `after()` pattern; the durable `pending` row exists before scheduling, so dropped post-response work remains recoverable. The browser shows `✓ Problem gemeldet`, stable `PAY-XXXXXXXX`, and `Wir informieren dich per E-Mail.` Safe recovery remains available.
4. The `after()` task atomically claims `pending → sending`, then stores a valid Customer.io delivery ID or a typed failed/uncertain state. A missing task remains `pending` for the operator. Duplicate taps return the same code; they may reschedule only `pending`, and concurrent tasks cannot pass the single atomic claim.
5. Nick/Codex finds the open case, correlates Sentry/payment evidence, and drafts a concise explanation.
6. Dry run shows case truth, masked recipient, outcome, and exact final German email; nothing sends/closes.
7. Exact-code apply records the attempt, sends, stores the delivery ID, and resolves.
8. Definitive rejection reopens for retry. Ambiguous delivery requires Customer.io verification and explicit finalize/re-arm; no blind resend.

Completion means the customer has a durable code and, after human review, one approved resolution email. Creating a report never changes or replaces the card's `not_started | failed | pending | succeeded` payment truth. Nick explicitly confirmed this journey on 2026-08-10.

## 7. Planning evidence

- Artifact: [final-state mockup](./mockups/2026-08-10-payment-feedback-states.html).
- Decision answered: can reporting remain one low-friction line and show a clear receipt/email promise without bloating checkout?
- Selected: one-tap row replaced by code + email note.
- Evidence review: confirmed 2026-08-10.
- Journey sign-off: confirmed 2026-08-10.
- Disposition: reuse committed HTML; discard screenshots.

## 8. Ordered tasks

### Task 1 — Service-only case store and API

**Consumes:** phase-1 taxonomy/context and §4 API/security.
**Produces:** migration, atomic create/dedupe/limit, identity validation, route.

- Check `supabase --version`/help and current changelog; create migration via CLI.
- Test constraints, RLS, privilege revocation, invoker/search-path/execute grants, collision retry, advisory-lock serialization, `ON CONFLICT` same-owner recovery, dedupe-before-limit, concurrent identity limit, transitions, and no direct client access.
- Test exact reportable-kind validation; authenticated or decoded-cookie/new reverse-query ownership; every flag/secret/cookie/null-lead fail-closed path; rejection of request `leadId`; IP `Retry-After`; immediate minimal `{ reportCode }` response; new/pending-dedupe scheduling; and no scheduling for `sending | sent | failed | delivery_uncertain`.

**Complete when:** exactly one authorized case exists per dedupe key and the response exposes only the report code.

### Task 2 — Reporting UI, Sentry correlation, and receipt

**Consumes:** Task 1 case/code and phase-1 card.
**Produces:** flagged report affordance, receipt state/email, safe Sentry correlation.

- Add strict client hook; loading/success/failure/duplicate states.
- Add signal and privacy-safe payload snapshots.
- Extend the shared sender with typed delivery receipt/HTTP/ambiguous outcomes; test payload, valid/malformed 200, non-2xx, abort/network, missing/stale `pending` or `sending`, atomic claim, and prove the case row predates every scheduled/send attempt.

**Complete when:** one tap yields stable code and honest email status without exposing disallowed data.

### Task 3 — Guarded resolution and retention cleanup

**Consumes:** open cases and delivery states.
**Produces:** dry-run list/resolve/delivery-check/cleanup command.

- Copy the proven `runOneTimeRecoveryCommand` affordances from `scripts/billing/one-time-recover.ts`: default dry run, masked preview, and apply rejected unless `--confirm-code` exactly matches the target `PAY-…`.
- Require closed outcome and approved note; preview masked recipient/exact email.
- Test no-op dry run, confirmation failure, definitive/ambiguous send paths, manual finalize/re-arm, successful single closure, and 90-day cleanup dry run/apply.

**Complete when:** no send/closure/cleanup can occur without the matching explicit confirmation and uncertain delivery cannot auto-retry.

### Task 4 — Privacy, operations, rollout, separate checker brief

**Consumes:** Tasks 1–3.
**Produces:** German disclosure, data/email contract, operator runbook, activation/rollback, follow-up brief.

- Document purpose, exclusions, service emails, retention, rights, processor behavior; legal/privacy approval before activation.
- Document search/evidence/outcome/preview/apply/delivery ambiguity/stale case/cleanup/rollback. State that request-supplied `reported_*` fields are customer hints; provider/webhook/billing/access evidence determines resolution truth.
- Record separate recurring checker: poll open Supabase cases, correlate Sentry, start investigation, never send/resolve automatically.

**Complete when:** operations are executable from docs and every external/production mutation remains a named later gate.

## 9. Verification

Automated:

- Focused route/persistence/email/observability/component/command tests.
- `npm run ci:verify`.
- `implementation-loop` runs `ready-check` and whole-branch `request-code-review`.

Browser:

- Desktop/mobile report loading, success code/email note, duplicate tap, route failure with recovery still usable, and flag-off state.
- Keyboard/status announcements and stable layout.

External gates before activation, separately authorized:

- Apply/verify migration; run Supabase database advisors; prove RLS/routine/client denial.
- Configure/test both Customer.io templates to a controlled recipient.
- Generate a controlled report and verify Sentry search/privacy.
- Legal/privacy approve disclosure and 90-day retention.
- Install and verify the separately authorized recurring checker (or keep reporting flags off). It must alert on and safely claim/reconcile stale `pending`/`sending` receipts; it still cannot send a case-specific resolution or close a case without Nick.
- Prove flags off remove reporting while phase-1 UX remains.

## 10. Review and handoff

- Nick explicitly authorized implementing both phases on the same task branch on 2026-08-10. Phase 2 consumes the shared phase-1 taxonomy directly and remains default-off until its external gates pass.
- Before activation: migration, template, Sentry, privacy/legal, and rollback receipts must be confirmed.
- Publication/merge/deployment/production writes/flag activation are separate authorizations.
- Recurring checker installation remains a separate post-deploy task and a pre-activation requirement; deploying this code with flags off does not authorize that installation.
- Commit this plan and reuse the shared HTML. Discard transient review/screenshots; archive external approvals in rollout records.

## 11. Decisions and counterpart reconciliation

- Reporting on all eight explicit feedback states, one tap/no form, existing email, receipt + approved resolution — confirmed. Pending/succeeded states report an unresolved support problem without changing payment truth.
- Ordinary issuer declines remain reportable by explicit owner decision. This creates real manual case volume; no response-time SLA is promised, queue volume is monitored, and the reporting flags are the kill switch if load exceeds capacity.
- No admin page; guarded command — confirmed.
- Split from urgent UX — confirmed.
- Automation separate and never auto-resolve/send — confirmed.
- 90-day resolved retention — recommended default, activation blocked on privacy/legal approval.
- Full receipt delivery state machine and both IP/identity abuse limits stay in v1 because the UI promises email follow-up from an anonymous surface; best-effort delivery was rejected.
- Resolution copy remains one short case-specific explanation approved by Nick; reusable auto-resolutions were rejected.
- Accepted review findings: collision retry; dedupe before distinct-case limit; serialized new-case count; email `delivery_uncertain`; safe Supabase grants; exhaustive signal mapping.
- Final review corrections: server-trusted session/cookie identity plus explicit reverse lookup; exact reportable array; advisory-lock and `ON CONFLICT` concurrency; receipt-returning Customer.io sender with typed ambiguity; immediate response plus durable `after()` delivery; case lifecycle uncertainty collapsed into the email state.
- Visual evidence and designed journey — confirmed.
