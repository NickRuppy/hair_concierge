# Account deletion inventory (Task 6)

Status: **implemented** with the rulings of 2026-09-27 (section 0). Source of truth for the classification is `src/lib/account-deletion/inventory.ts` (`ACCOUNT_DELETION_TABLE_CLASSES`, `ACCOUNT_DELETION_FK_EDGES`); `tests/account-deletion-postgres.test.ts` fails when a new FK into a covered parent is not listed there, when a listed edge disappears, or when a classified table is missing from this document.

## Source

- Schema: every repository migration (incl. `20260927133426` App Store and the Task 6 migrations `20260927172739_account_deletion_schema` + `20260927172741_account_deletion_routine`), replayed with the local legacy baseline (`scripts/mobile/local-migrations.mjs`) into a disposable `public.ecr.aws/supabase/postgres:17.6.1.106`. Latest definitions win. Production was not queried (repo rule).
- Covered parents: `auth.users`, `profiles`, `leads`, `funnel_sessions`, `trial_enrollments`, `billing_one_time_purchases`, `product_submissions`, followed transitively (112 child tables, 208 FK edges), plus the email/id-keyed tables without FK in section 3.

Match keys for one deletion: user `U`; account email `E` (`lower(btrim(auth.users.email))`); leads `L` = `user_id = U` or (`user_id IS NULL` and email = `E`); sessions = `user_id = U` or unowned sessions of `L`; enrollments = `trial_enrollments.user_id = U`; the rest follows those ids.

## 0. Rulings applied

- **Q1** Billing guards: one exception, `private.account_deletion_permits`, asked in the first line of each guard function (17 functions, latest bodies otherwise unchanged; the product-submission foundation check additionally tolerates owner-less personal-plan submissions). It permits an UPDATE only while `set_config('chaarlie.account_deletion', <request_id>, true)` names an in-progress operation (set only inside `private.delete_account`, SECURITY DEFINER, EXECUTE only for `service_role`), only for a row that still belongs to that operation's user (user links equal the operation's `user_id` or are already NULL), only when the row is tagged once (`anonymous_subject_id`, `anonymized_at`, `purge_after`) and every other changed column takes exactly its redacted value from `private.account_deletion_writable_columns` (NULL, `{}`, `[]`, the scrubbed JSON, or the subject id for a user-scoped `scope_id`). It permits a DELETE only inside `private.purge_anonymized_records` for anonymized rows past `purge_after`. No trigger is ever disabled. Tests prove the guards still reject the same writes without the flag, with an unknown request id, and non-anonymization changes with the flag.
- **Q2** `billing_subscriptions`, `billing_subscription_plan_changes`, `billing_analytics_outbox` (+ `billing_analytics_deliveries`, `slack_growth_edge_leases`) keep cascading. Stripe/PayPal hold the legally relevant invoices; our copies are operational. → T8 legal checklist line: "Subscription mirror rows are deleted with the account; invoices remain with Stripe/PayPal (merchant records)."
- **Q3 (open with Nick, switchable)** Trial anti-abuse fingerprints: `private.account_deletion_policy()` returns `keep_hashed` (default): hashed claims stay, unlinked, tagged, purge after 3 years. `erase` runs the existing `public.apply_trial_identity_rights(…, 'erase', …)` per source and drops the claims. Both branches are tested.
- **Q4** `payment_support_cases`: anonymized in place (user/lead link NULL, `resolution_note` NULL; codes, status, timestamps kept), purge after 3 years.
- **Q5** `profiles_backup_20260822` is production-only (not in migrations): **must be dropped or scrubbed before activation** (T8 runbook). Same for `billing_subscriptions_backup_20260822`.
- The operation row keeps the account's `email` next to `user_id` while the deletion is in progress (needed for the Customer.io email identifier); both are cleared at `external_cleanup_done`, enforced by a CHECK (controller ruling).
- Admin accounts (`profiles.is_admin`) are refused (`admin_account`): staff accounts are not self-service deletable; this also keeps `payment_support_cases.resolved_by` intact.

## Retention (A2)

`private.account_deletion_retention('billing')` = 10 years, `('cancellation_evidence')` = 3 years (mirrored as `ACCOUNT_DELETION_RETENTION`). The purge runs from the account-deletion cron (`/api/account-deletion/reconcile`) and deletes rows past `purge_after`, children before parents.

## 1. Cascade (deleted with `auth.users`)

| Table | Notes |
|---|---|
| `profiles` | email, full_name, avatar_url, stripe ids |
| `app_store_transactions`, `app_store_subscription_status` | Apple is merchant of record |
| `billing_subscriptions`, `billing_subscription_plan_changes`, `billing_analytics_outbox`, `billing_analytics_deliveries`, `slack_growth_edge_leases` | Q2 |
| `checkout_activation_claims`, `membership_reactivation_checkout_reservations`, `freemium_plan_admissions` | |
| `conversations`, `messages`, `conversation_states`, `conversation_turn_traces`, `user_memory_entries`, `user_memory_settings` | chat |
| `discovery_intakes`, `discovery_intake_items`, `discovery_call_decisions` | also cascade from deleted `discovery_enrollments` |
| `dismissed_suggestions`, `tracker_nudge_dismissals`, `personal_plan_ui_lifecycle_marks` | |
| `hair_profiles` | archived first to `private.anonymous_quiz_answer_archive` |
| `mobile_registration_enrollments`, `mobile_registration_publication_receipts`, `mobile_scan_history`, `mobile_push_installations`, `mobile_research_deliveries`, `mobile_research_delivery_candidates` | app |
| `personal_plans`, `personal_plan_need_versions`, `personal_plan_portfolio_versions`, `personal_plan_product_drafts`, `personal_plan_refinement_drafts`, `personal_plan_routine_proposals`, `personal_plan_routine_versions`, `personal_plan_routine_source_change_outbox`, `personal_plan_migration_enrollments` | version guards accept via the existing `app.personal_plan_erasure_user_id` |
| `partner_access_email_changes` | with its invitation |
| `routine_logs`, `routine_log_products` | |
| `scan_free_reveals`, `scan_wishlist` | |
| `scanner_context_heads`, `scanner_context_sources`, `scanner_context_versions`, `scanner_paid_source_bindings`, `scanner_profile_edit_receipts`, `scanner_profile_edits` | |
| `user_products` | |
| `waitlist_customerio_outbox` | with its waitlist signup |

## 2. Deleted explicitly by the routine

| Table | Why / match |
|---|---|
| `personal_plan_test_members`, `personal_plan_test_enrollments`, `regular_quiz_test_enrollments` | RESTRICT → `auth.users`; field-test state |
| `personal_plan_prepared_artifacts` | SET NULL; quiz answers — `U` or `L` |
| `personal_plan_quiz_drafts`, `funnel_events`, `openai_ads_contexts` | children of retained sessions |
| `personal_plan_result_returns`, `quiz_email_return_links`, `customerio_profile_sync_outbox` | children of retained leads (the lead update re-enqueues a sync; deleted in the same transaction) |
| `beta_feedback` | SET NULL; message, user agent |
| `discovery_enrollments` | RESTRICT; `claimed_user_id = U` or email `E` |
| `partner_access_invitations` | RESTRICT; after unlinking leads/sessions/grants |
| `manual_access_grants` | incl. email-bound unclaimed grants |
| `user_product_usage` | before submissions lose their owner; photo path collected |
| `mobile_auth_attempts`, `mobile_registration_intents`, `waitlist_signups`, `rate_limits` | no FK; email / id |
| `auth.audit_log_entries`, `auth.refresh_tokens`, `auth.flow_state`, `auth.users` | GoTrue rows keyed by user id/email without a cascading FK (`flow_state` only where present); then the user |
| Storage `product-intake` objects | submission + usage photo paths and the `U/`, `tmp/U/` prefixes, removed by the service after the transaction |

## 3. Anonymized in place — billing (10 years)

| Table | Cleared / replaced |
|---|---|
| `leads` | user_id, name, email (→ ''), quiz_answers (→ {}), ai_insight, share_quote, artifact_email_error, partner link |
| `funnel_sessions` | user_id, visitor_id (→ subject id), entry_url, entry_path, referrer, first_touch, partner link |
| `trial_enrollments` | user_id |
| `billing_one_time_purchases` | user_id; metadata identity keys (Q1 guard) |
| `personal_plan_one_time_checkout_consents` | user_id (Q1 guard) |
| `personal_plan_one_time_fulfillment_jobs` | last_error |
| `paypal_order_intents` | user_id, email (→ ''), metadata identity keys |
| `paypal_expired_order_reset_audit` | tags only (append-only guard) |
| `paypal_checkout_intents` | user_id, email, lead_id, metadata identity keys; also email-matched unowned intents |
| `trial_checkout_attempts` | scope_id (user scope → subject id), stripe_params customer_email + identity metadata |
| `paypal_trial_checkout_attempts`, `paypal_trial_activation_evidence`, `paypal_trial_management_requests`, `paypal_trial_plan_catalogs` | scope_id (user scope); tags |
| `paypal_trial_paid_recovery_requests` | user_id (no FK; NOT NULL dropped) |
| `stripe_trial_continuation_operations`, `stripe_trial_management_approvals`, `stripe_trial_paid_recovery_requests` | session/subscription params customer_email + identity metadata |
| `trial_analytics_contexts` | meta_context (fbp, fbc, client_user_agent) → {} |
| `trial_management_operations`, `trial_paid_recovery_operations` | user_id (FK → nullable, SET NULL) |
| `trial_offer_revisions`, `trial_management_agreement_bindings`, `trial_management_catalogs`, `trial_management_state`, `trial_paid_continuations`, `trial_paid_continuation_history`, `trial_payment_continuation_reconciliations`, `trial_payment_events` | tags only (provider ids, amounts) |

Provider ids (Stripe customer/subscription, PayPal agreement/order/capture ids) stay: they link to the invoice the provider retains.

## 4. Anonymized in place — cancellation evidence (3 years)

| Table | Cleared / replaced |
|---|---|
| `trial_cancellation_declarations`, `trial_cancellation_receipts`, `trial_paid_cancellation_declarations` | user_id (FK → nullable, SET NULL) |
| `trial_cancellation_provider_operations` | tags |
| `stripe_paid_cancellation_operations` | user_id (no FK; NOT NULL dropped) |
| `trial_reminders`, `trial_required_notices` | user_id; snapshots hold contract terms only, the text carries a blank withdrawal form |
| `public_contract_declarations`, `public_contract_declaration_receipts` | payload/receipt name, email, contract, reason → "anonymisiert" (CHECK needs non-empty strings) |
| `public_contract_declaration_matches` | user_id |
| `public_contract_declaration_applications`, `public_contract_declaration_completions`, `public_contract_declaration_reviews` | tags |
| `payment_support_cases` | user_id, lead_id, resolution_note (Q4) |
| `trial_identity_claims`, `trial_identity_sources` | Q3: hashed digests kept (`keep_hashed`) or erased (`erase`) |

## 5. Kept anonymous, no purge (D10)

| Table | Cleared |
|---|---|
| `product_submissions` | user_id (NOT NULL dropped; FK still CASCADE), user_product_id, user_product_usage_id, source_conversation_id, photo paths, validation metadata, review_notes, user-facing text, intake_history, request fingerprint, mobile_result_requested_at (no app delivery without an owner); product text + barcode kept. Operator review keeps working: owner-less submissions skip the user notification. |
| `scan_resolve_events` | user_id (NOT NULL dropped) |

## 6. No personal data

`product_intake_research_jobs`, `product_intake_research_artifacts`, `product_intake_review_decisions` (children of kept submissions), `trial_identity_restrictions` (rights-case records), `billing_webhook_events` (provider event ids).

## 7. External systems (service, after the transaction)

Storage objects, Customer.io person (`User Deleted` for the user id and the email identifier), PostHog person + events (`persons/bulk_delete` with `delete_events`). Failures leave the operation `data_deleted`; the cron retries until `external_cleanup_done` and reports to Sentry from the 5th failed attempt. Needs `POSTHOG_PERSONAL_API_KEY` (+ `POSTHOG_PROJECT_ID`, default 126788) in the server env (T8 runbook).

Provider webhooks after deletion: a PayPal event whose anonymized checkout intent has no billing row, or a Stripe checkout/subscription event whose `lead_id` / `trial_enrollment_id` metadata points at an anonymized row, is acknowledged without activation. A still billable subscription (PayPal `ACTIVE`/`SUSPENDED`, Stripe not `canceled`/`incomplete_expired`) is cancelled immediately (A1, no proration) and reported to Sentry (provider + event type only); ended ones are a pure no-op.

## 8. Production apply (T8 runbook)

- The schema migration sets `lock_timeout = '5s'` and alters billing tables: apply it in a quiet window; a lock timeout aborts cleanly and can be retried.
- Before production, verify on a Supabase branch: the `postgres` role's DELETE privilege on `auth.audit_log_entries`, `auth.refresh_tokens` and `auth.flow_state` in the hosted GoTrue schema, and the cost of the routine's payload scans (`auth.audit_log_entries`, `rate_limits`) at production size.
- Concurrency: `account_deletion_begin` and `private.delete_account` share a per-account advisory lock; the cron's `account_deletion_close_orphans` moves open operations whose account disappeared by another path (dashboard/admin deletion) into external cleanup, which clears the stored user id and email.
- Purge runs per table in its own subtransaction and only deletes anonymized rows (`anonymized_at IS NOT NULL AND purge_after < now()`); failed tables are reported to Sentry by the cron.

## 9. Production-only tables (not in migrations)

- `public.profiles_backup_20260822`, `public.billing_subscriptions_backup_20260822`: production-only manual tables; must be dropped or scrubbed before activation (Q5, T8 runbook). Any other live-only table is invisible to this replay — a read-only live column check belongs to activation.
