# Product Review admin alerts

Status, 2026-10-15: **outbox implemented locally; dedicated provider template created and one real outbox test received in Nick’s inbox; automatic alerts remain disabled**. Nick confirmed the sole alert recipient in
this chat and confirmed that no template exists. The address is private runtime
configuration, not committed source. This is an internal review alert; customer
notification remains part of the separately approved exact product handoff.

Authority: [Product Intake operations](../product-intake-research-ops.md),
[approved Admin journey](../../plans/product-intake-cloud-research/review-proposal/journey.md)
and [email/outbox slice](../../plans/product-intake-cloud-research/plan.md#slice-4b--email-per-product-worktree-intake-review-email--after-s3).
The prior approval covers this email's product/category/outcome, at most three
questions and authenticated Admin link; no new audience or marketing flow.

## Dedicated Customer.io template

- Name/trigger: `product_intake_admin_review_v1`; transactional message **20**, template **190**, workspace **219516**.
- [Provider template](https://fly.customer.io/workspaces/219516/journeys/transactional/20). Created as a draft, then enabled for explicit API calls. No automatic caller is enabled.
- Sender: `Chaarlie <info@chaarlie.de>`, using the existing verified sender.
- Subject: `{% if trigger.is_test %}[TEST] {% endif %}Produktprüfung: {{ trigger.outcome_label }}`.
- HTML: [canonical template](product-intake-admin-review-template.html).
- Plain-text reference: [expected semantic content](product-intake-admin-review-plain-text-template.txt). Customer.io’s current code editor automatically generates the text alternative from HTML; the received MIME text was verified against this content.
- Use a passthrough layout; do not add a second header/footer around the HTML.
- Disable open/link tracking. The deep link requires normal Admin login; it
  contains no login token, user identity, signed image URL or research attachment.
- Save as a draft first; obtain the real transactional message ID. Never reuse
  another email's ID or invent a fallback ID.

The template uses the repository's established Customer.io `htmlencode` filter
for every dynamic HTML value, including the URL. HTML escaping is not URL
validation: the producer must construct the exact HTTPS Admin URL itself.

## Producer contract

All text fields are strings; `is_test` is a boolean. `trigger` is populated from `message_data` by the existing
Customer.io transactional transport:

| Field            | Required value                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| `product_name`   | Reviewed public product identity; never raw chat/user text                      |
| `category_label` | Server-owned German category label                                              |
| `outcome_label`  | Exactly `Bereit zur Prüfung` or `Entscheidung nötig`                            |
| `question_1`     | First product-specific open question, or empty string                           |
| `question_2`     | Second question, or empty string                                                |
| `question_3`     | Third question, or empty string                                                 |
| `is_test`        | Always `false` for production; only the explicitly isolated test sets `true`    |
| `review_url`     | Server-constructed `https://chaarlie.de/admin/produkt-intake/<submission UUID>` |

Questions describe product-research decisions. Never include customer names,
emails, profile/medical facts, conversation/user IDs, raw prompts, logs, secrets
or the complete payload. Pack questions consecutively from `question_1`; ready
packages without questions use three empty strings. No alert for intermediate
automatic rework rounds. Operational failures use the existing ops-monitoring
lane, rather than this inbox.

## Runtime configuration and activation

```dotenv
PRODUCT_INTAKE_REVIEW_EMAILS=false
PRODUCT_INTAKE_REVIEW_ALERT_EMAIL=<Nick's confirmed address, private configuration>
CUSTOMERIO_PRODUCT_INTAKE_REVIEW_TRANSACTIONAL_MESSAGE_ID=20
```

These names are consumed by the local implementation; the updated sender is not deployed. The local worktree stores Nick’s recipient, dedicated message ID and approved dedicated sending key in ignored mode-0600 `.env.local`, with alerts disabled. The
Hetzner worker environment and running services were not changed by this step.

The completion RPC now atomically saves the final preview, job outcome and
immutable outbox snapshot. It extends the existing lease fence and resolves only
captured rework decisions. Research continuing to image processing enqueues no
alert; research and image final outcomes use the same RPC. The dispatcher checks
the disabled-by-default switch before any claim, then claims one fenced row,
sends through the existing Customer.io receipt transport and settles its receipt.
Every admin alert also sends `tracked:false`, independently of template settings; existing callers retain their defaults. Safe error codes never contain provider error bodies. Nick selected hold for
reconciliation on 2026-10-15: ambiguous sends and expired sending leases become
`needs_reconciliation` and cannot be claimed again. Only definite 429 rejections
retry with backoff, up to five total attempts. HTTP 408/5xx, transport failures and
missing receipts are conservatively uncertain. No historical rows are backfilled.

The new migration is `20261015200636_product_intake_admin_notifications.sql`.
Applied surgically as production version `20261015200636`; its table and three
RPCs are service-only, with RLS verified and zero outbox rows. The running old
worker is unchanged. Deploy the new worker only after reviewed release/CI gates.
The Admin queue/detail must be live before automatic alerts are enabled. Full S3
judge/budget/automatic-rework integration is still a separate parent task; it must
continue to use `continue` for intermediate rounds and only enqueue final review
outcomes. Technical worker exceptions use ops monitoring, not this email lane.

The explicit test command uses the real migrations in an isolated local PGlite
ledger and synthetic submission; it never claims the Supabase backlog or creates
a live product/customer. It marks the email `[TEST]`, uses the existing Admin
home link, and refuses to repeat the same test-run after any uncertain outcome:

```bash
node --conditions=react-server --import tsx scripts/product-intake/admin-review-alert.ts \
  --test --confirm --test-run=<unique-authorized-run>
```

It requires the private recipient, real dedicated template ID, sending key and
`PRODUCT_INTAKE_REVIEW_EMAILS=false`. Its private receipt/ledger stays under
ignored `tmp/product-intake-admin-alert-tests/`. A transport-stub run verified the
entire local persistence/send/receipt path; it is **not** a real delivered email.
The test banner explains that the new review route is not live; real submission
alerts retain their exact detail links once deployed. The legacy customer
`notify-pending.ts` lane is separate and untouched.

Before enabling alerts: inspect pending outbox rows created while delivery was
disabled against the latest job/outcome and current submission state. Present
any stale/pre-activation dispositions to Nick before changing them; never mark an
unsent row as sent or blindly flush the backlog. Only the approved fresh cohort
may be activated. Then create/read back the actual provider draft, verify both ready and
decision-needed renders (including zero/three questions and escaped text), then
perform an explicitly authorized delivery test to the confirmed inbox. Record
provider receipt and received-email verification separately. Activate only the
approved bounded cohort after migration/release gates pass.

The signed-in business Chrome session restored provider access. The dedicated
`product_intake_admin_alerts` App API key was created with Nick’s explicit approval;
existing keys were untouched. Management CLI authentication remains broken but
is no longer blocking this template or sending test.

Both ready/zero-question and decision/three-question variants rendered without
provider errors; literal angle brackets and ampersands stayed text. One real
isolated-ledger outbox invocation (`customerio-real-20261015-01`) returned a
provider receipt, and the matching `[TEST] Produktprüfung: Bereit zur Prüfung`
message reached Nick’s inbox at **19:40:58 UTC**. Received HTML and plain text
contain the test disclosure, product and direct Admin-home link; no empty question
section. Received headers confirm open/click tracking both `false`, with SPF,
DKIM and DMARC passing. See the [sanitized delivery receipt](../../plans/product-intake-cloud-research/receipts/admin-alert-delivery-2026-10-15.json).

Automatic alerts remain `false`; the key/recipient have not been copied to the
worker. The additive migration is applied and verified; deployment, pending-row
reconciliation and Nick’s review of the received test remain activation gates. The hold-for-reconciliation policy is settled.
No live database rows or customer notifications were created by this test.

Provider field reference: [Customer.io transactional email API](https://docs.customer.io/messaging/send/transactional/email/) (`tracked:false` disables opens and link clicks).

## Held-delivery reconciliation

Run this read-only query with operator/service access after migration:

```sql
SELECT id, submission_id, status, attempts, error, provider_delivery_id,
       provider_queued_at, created_at, locked_at
FROM public.product_intake_admin_notifications
WHERE status IN ('needs_reconciliation', 'failed')
ORDER BY created_at;
```

For `needs_reconciliation`, compare the exact submission/outcome, recipient and
time with Customer.io’s activity before deciding whether anything should be sent.
The internal transition key prevents duplicate outbox rows; it does not deduplicate
provider sends after an uncertain response. A crash after provider acceptance but
before receipt settlement therefore stays held. Product review remains available
independently of the alert. Do not reset a held row or mark it sent without
verified provider evidence and Nick’s approval of that exact disposition. There is
no automatic resend or administrative retry endpoint for held rows. Expired leases
are quarantined without increasing attempts; later pending alerts can progress.

Customer.io documents a successful request as HTTP 200 with a delivery receipt
and a rate-limit rejection as HTTP 429; other uncertain server/transport outcomes
are held conservatively rather than assuming they were rejected before acceptance:
[transactional errors](https://docs.customer.io/messaging/send/transactional/api-common-api-errors/),
[rate limits](https://docs.customer.io/integrations/api/customerio-apis/).

The post-migration security advisor reports only the expected informational
[RLS without client policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
notice for this table. It is service-only by design; anon/authenticated table and
RPC privileges were explicitly verified denied. No public policy is added.
