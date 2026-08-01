# One-time payment recovery: read-only release checks

This is an operational gate for PR1. It authorizes neither a production migration, deployment, provider write, nor recovery apply.

## Read-only predeployment checks

1. Record the required release ordering: `20260731125000_one_time_payment_recovery_state.sql` must be applied before code that calls `get_personal_plan_one_time_access_state` or writes the new recovery state. This document does not authorize either action.
2. In a read-only production session, inspect/count existing delivered one-time consents before the migration. Any row with `delivered_at IS NOT NULL` but missing a required confirmation, generation, content-hash, delivery-provider, or delivery-reference field would violate the delivery-evidence constraint. Stop for data repair/review rather than weakening the constraint or guessing evidence.
3. In that same read-only session, count legacy paid purchases that the migration must enqueue because their canonical consent lacks complete confirmation, generation, or delivery evidence:

   ```sql
   SELECT count(*) AS paid_purchases_requiring_fulfillment_backfill
   FROM public.billing_one_time_purchases AS purchase
   JOIN public.personal_plan_one_time_checkout_consents AS consent
     ON (
       (purchase.provider = 'stripe' AND consent.stripe_checkout_session_id = purchase.provider_order_id)
       OR (
         purchase.provider = 'paypal'
         AND (
           consent.paypal_capture_id = purchase.provider_transaction_id
           OR consent.paypal_order_id = purchase.provider_order_id
         )
       )
     )
   WHERE purchase.product_kind = 'personal_plan_once'
     AND purchase.status = 'paid'
     AND NOT (
       consent.confirmation_status IN ('sent', 'delivered')
       AND consent.generation_started_at IS NOT NULL
       AND consent.generation_completed_at IS NOT NULL
       AND consent.generated_content_sha256 IS NOT NULL
       AND consent.delivery_provider IS NOT NULL
       AND consent.delivery_reference IS NOT NULL
       AND consent.delivered_at IS NOT NULL
     );
   ```

   Record the count for the postmigration comparison. Refunded, reversed, and disputed purchases are intentionally excluded and must not be queued.

4. Record that the new `ON DELETE RESTRICT` links deliberately retain payment and consent evidence. A profile/lead deletion may now be refused while linked billing evidence exists; the GDPR deletion/retention workflow needs an approved lawful retention, anonymization, or deletion procedure before such records are handled. Do not work around this with a direct delete.
5. Confirm the public gate remains `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED=false`. The signed QA path remains limited to internal testing and is not public assignment.
6. Keep `PERSONAL_PLAN_ONE_TIME_FULFILLMENT_RETRY_ENABLED` unset or `false` until the migration, code deployment, and postmigration checks below have completed. Then explicitly set it to `true` before relying on automatic recovery. This environment change is a separate production action and is not authorized by this document.

## Read-only postmigration checks, before recovery

- In a read-only service-role session, verify every incomplete paid purchase counted before the migration has exactly one pending fulfillment job, and that no complete, refunded, reversed, or disputed purchase was queued:

  ```sql
  WITH incomplete_paid_purchases AS (
    SELECT purchase.id
    FROM public.billing_one_time_purchases AS purchase
    JOIN public.personal_plan_one_time_checkout_consents AS consent
      ON consent.id = purchase.consent_id
    WHERE purchase.product_kind = 'personal_plan_once'
      AND purchase.status = 'paid'
      AND NOT (
        consent.confirmation_status IN ('sent', 'delivered')
        AND consent.generation_started_at IS NOT NULL
        AND consent.generation_completed_at IS NOT NULL
        AND consent.generated_content_sha256 IS NOT NULL
        AND consent.delivery_provider IS NOT NULL
        AND consent.delivery_reference IS NOT NULL
        AND consent.delivered_at IS NOT NULL
      )
  )
  SELECT
    count(*) AS incomplete_paid_purchases,
    count(job.id) FILTER (WHERE job.status = 'pending') AS queued_pending_jobs,
    count(*) FILTER (WHERE job.id IS NULL) AS missing_jobs,
    count(*) FILTER (WHERE job.status IS DISTINCT FROM 'pending') AS non_pending_jobs
  FROM incomplete_paid_purchases AS purchase
  LEFT JOIN public.personal_plan_one_time_fulfillment_jobs AS job
    ON job.purchase_id = purchase.id;
  ```

  Require `incomplete_paid_purchases` and `queued_pending_jobs` to equal the recorded predeployment count, with `missing_jobs = 0` and `non_pending_jobs = 0`. Then separately confirm there are no jobs outside that set:

  ```sql
  SELECT count(*) AS unexpected_fulfillment_jobs
  FROM public.personal_plan_one_time_fulfillment_jobs AS job
  JOIN public.billing_one_time_purchases AS purchase ON purchase.id = job.purchase_id
  JOIN public.personal_plan_one_time_checkout_consents AS consent ON consent.id = job.consent_id
  WHERE purchase.status <> 'paid'
     OR (
       consent.confirmation_status IN ('sent', 'delivered')
       AND consent.generation_started_at IS NOT NULL
       AND consent.generation_completed_at IS NOT NULL
       AND consent.generated_content_sha256 IS NOT NULL
       AND consent.delivery_provider IS NOT NULL
       AND consent.delivery_reference IS NOT NULL
       AND consent.delivered_at IS NOT NULL
     );
  ```

  Require `unexpected_fulfillment_jobs = 0`. These checks are evidence only; do not run a worker, recovery, or provider action from this runbook.

- Verify from the service-role server client that `get_personal_plan_one_time_access_state(p_user_id)` can read a target user even when `auth.uid()` is null. This confirms the migration's `auth.role() = 'service_role'` authorization path.
- Verify an authenticated caller can read only its own user ID and receives `42501` for another user ID. Do not expose consent or purchase evidence directly to the browser as part of this check.
- Re-read the migration result and application health before invoking the recovery script. The recovery script's dry-run remains read-only; `--apply` still requires separate explicit authorization for the exact provider target.

## Automatic retry cadence

The existing Vercel reconciliation cron runs once daily at `02:15` (`15 2 * * *`). After the retry flag is enabled it can recover queued one-time fulfillment jobs on that cadence; it is not a minute-scale recovery guarantee. During the dark release, use the exact-target dry-run and separately approved apply command when faster verification is needed. Do not increase the cron frequency or enable public assignment as part of this recovery release without a separate decision.

## Confirmation and duplicate-payment residuals

- The current transactional Customer.io integration has no implemented provider idempotency key and no acknowledgement persistence atomic with our database status write. If Customer.io accepts a send but the later database write fails, a retry can send a duplicate confirmation. This is deliberately an at-least-once boundary: do not suppress the retry, because doing so could withhold the required durable confirmation. Investigate using the deterministic `confirmation_reference` and the provider payment reference; do not infer any stronger Customer.io API guarantee from this implementation.
- Once the duplicate-payment hardening is deployed, both conflict directions are permanent and receive no fulfillment: one provider transaction cannot resolve to a different consent, and one consent cannot bind to a second provider transaction. Stop automation and reconcile the extra provider charge for manual resolution/refund rather than trying another consent or retry target.

## Expired uncaptured PayPal-order reset

This is a separate, service-role-only operator action for an order that is provably impossible to capture. It never captures, voids, refunds, or otherwise changes anything at PayPal. It only makes the existing local checkout attempt eligible to create one replacement order after the provider and database guards agree.

1. First run the default dry-run, with the exact PayPal order ID supplied only in the operator shell. The JSON receipt deliberately excludes it:

   ```sh
   npm run billing:one-time:recover -- \
     --reset-expired-paypal-order \
     --paypal-order=REDACTED
   ```

2. The script always performs a read-only PayPal `GET /v2/checkout/orders/{id}` before inspecting local eligibility. It permits reset only when PayPal returns the exact order for the configured merchant as `VOIDED` with no captures. A `404` is not enough evidence because it can also indicate the wrong PayPal environment or merchant account; stop and audit the operator credentials instead. All other status, capture, authentication, network, or response-shape outcomes also fail closed.
3. The local preflight and the transactional RPC each require the same bound consent, an expired `created` intent, no capture, no Stripe binding, and no purchase evidence. A race or any mismatch fails closed.
4. Only after separately authorized release review, use `--apply` and repeat the exact order ID in `--confirm-paypal-order`. Never copy either identifier into a ticket, chat, screenshot, or command output:

   ```sh
   npm run billing:one-time:recover -- \
     --reset-expired-paypal-order \
     --paypal-order=REDACTED \
     --apply \
     --confirm-paypal-order=REDACTED
   ```

The RPC writes an append-only audit row, clears only the obsolete local PayPal order reference, and renews that intent's expiry. It preserves the consent, user/lead identity, token, and all other evidence. Capture persistence is conditionally bound to the exact current order, so a stale in-flight capture cannot claim a reset/replacement intent. There is no automatic reset path and no public endpoint.

## Local verification status

Focused source-level migration tests cover the authorization contract. Disposable-database migration execution remains pending locally because Docker is unavailable; no local or production migration has been applied from this worktree.
