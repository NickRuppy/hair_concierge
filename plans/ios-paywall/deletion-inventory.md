# Account deletion inventory (Task 6)

Status: **draft, blocked on §0 rulings.** Every table is classified; §0 lists the places where the D10/D12 rules collide with existing billing guards or leave a legal choice open.

## Source

- Schema: all 340 repository migrations at branch head `3f6aa858` (incl. Task 1 `20260927133426`), replayed with the local legacy baseline (`scripts/mobile/local-migrations.mjs`, the same preparation the isolated mobile stack uses) into a disposable `public.ecr.aws/supabase/postgres:17.6.1.106` container. Latest definitions win.
- FK graph: every FK whose parent is `auth.users`, `profiles`, `leads`, `funnel_sessions`, `trial_enrollments`, `billing_one_time_purchases`, `product_submissions`, followed transitively (112 child tables, 208 FK edges). Columns and non-internal triggers from the same schema.
- Production was not queried (repo rule). Tables that exist only in production are listed in §4.

## Legend

| Class | Meaning |
|---|---|
| CASCADE | Removed by FK cascade when the `auth.users` row is deleted. |
| DELETE | Deleted explicitly by the routine (FK is RESTRICT/NO ACTION/SET NULL, or no FK, and the row holds personal data or blocks the delete). |
| ANON | Retained. User link → NULL, listed PII columns cleared or replaced with placeholders, tagged `anonymous_subject_id`, `anonymized_at`, `purge_after`. |
| NONE | No personal data of its own; follows its parent. |

Match keys for one deletion: user id `U`; account email `E` (`lower(btrim(auth.users.email))`); leads `L` = `user_id = U` or `lower(btrim(email)) = E`; sessions `S` = `user_id = U` or `lead_id ∈ L`; enrollments `T` = `trial_enrollments.user_id = U`.

FK actions below: c = cascade, n = set null, r = restrict, a = no action; `!` = NOT NULL column.

## 0. Rulings needed before the routine is built

**Q1 — Immutability guards block anonymizing retained billing evidence.** Removing only the user link (the minimum D12 requires) raises in these existing guard triggers:

| Table | Guard | What raises |
|---|---|---|
| `private.trial_cancellation_declarations` | `protect_trial_cancellation_declaration` | any change (`NEW IS DISTINCT FROM OLD`) |
| `private.trial_management_operations` | `protect_trial_management_operation` | any change outside status/evidence columns |
| `private.trial_paid_cancellation_declarations` | `protect_paid_cancellation_declaration` | any change outside status/lease columns |
| `private.trial_paid_recovery_operations` | `protect_trial_paid_recovery_operation` | any change outside status/evidence columns |
| `private.paypal_trial_paid_recovery_requests` | `prevent_paypal_trial_paid_recovery_request_rewrite` | any change outside request/approval columns; `user_id!` has no FK |
| `public.personal_plan_one_time_checkout_consents` | `enforce_personal_plan_one_time_consent_immutability` | `user_id` → NULL |
| `public.billing_one_time_purchases` | `enforce_billing_one_time_purchase_consent_match` | `user_id` → NULL |

PII redaction additionally raises in:

| Table | Guard | PII held |
|---|---|---|
| `private.trial_analytics_contexts` | `protect_trial_analytics_context` (fully immutable) | `meta_context`: `fbp`, `fbc`, `client_user_agent` |
| `public.trial_checkout_attempts` | `prevent_trial_checkout_attempt_rewrite` (`stripe_params` frozen once set) | `stripe_params.customer_email` (`src/lib/stripe/checkout-session-params.ts:67`) |

Because `ON DELETE SET NULL` runs as an UPDATE that fires these triggers, the planned FK change alone fails for the first five. The `to_jsonb(NEW) - [allowed]` guards also reject setting the new `anonymous_subject_id`/`anonymized_at`/`purge_after` columns, so the retained rows cannot even be tagged. Options:
- **(a) Deletion-scoped exception in each guard** — `CREATE OR REPLACE` the nine guard functions (latest bodies) with one early branch that permits exactly the anonymization transition (user link → NULL, listed PII → placeholder, subject/purge columns set once) while a transaction-local flag set only by `private.delete_account` is present. Guards stay active for every other writer; no lock escalation. Touches nine billing guard functions.
- **(b) Disable the named triggers inside the RPC transaction** (`ALTER TABLE … DISABLE TRIGGER`, re-enabled before commit) — no guard function changes, but takes ACCESS EXCLUSIVE locks on ~10 billing tables for the deletion transaction and leaves those tables unguarded while it runs.
- (c) Keep the user link on these rows — contradicts D12.

Recommendation: (a). This changes billing-integrity code, so it needs a ruling.

**Q2 — Subscription records cascade today.** `billing_subscriptions` (`user_id!` c; also holds `provider_subscriber_email`), `billing_subscription_plan_changes`, `billing_analytics_outbox` (+ `billing_analytics_deliveries`, `private.slack_growth_edge_leases`), `membership_reactivation_checkout_reservations` and `checkout_activation_claims` are deleted by cascade today. D10 says legally required billing records are anonymized and retained. Retaining them needs `user_id` nullable + `ON DELETE SET NULL`, which the "no other FK behavior changes" rule forbids. Stripe/PayPal stay the system of record for invoices. Recommendation: keep CASCADE for these tables and retain only the trial/one-time evidence that is already RESTRICT-protected. Confirm which one applies.

**Q3 — Trial anti-abuse identity digests.** `public.trial_identity_claims` and `private.trial_identity_sources`/`_source_claims`/`_restrictions` hold HMAC digests of account id, verified email, card fingerprint and PayPal payer id. They are not plaintext (the full-schema text scan passes), but they are pseudonymous personal data used to refuse a second free trial. Options: keep them for trial-abuse prevention (legitimate interest) with the enrollment's retention, or call the existing `public.apply_trial_identity_rights(…,'erase', all kinds, reference)` per enrollment source. Erasing means the person can start another free trial after re-registering. This is a legal call.

**Q4 — `payment_support_cases`.** `lead_id` and `user_id` are NO ACTION FKs, so these rows block the delete. They hold checkout context, Customer.io delivery ids and a free-text `resolution_note`. Delete them, or anonymize and retain them as commercial correspondence (for how long)?

**Q5 — Production-only tables (§4).** `profiles_backup_20260822` and `billing_subscriptions_backup_20260822` exist in production but not in migrations (seen in `scripts/lib/moderator-account-reset-inventory.ts`). The backup of `profiles` holds emails, so the routine cannot delete completely while it exists. Drop the backups, or add them to the routine?

## 1. Covered parents

| Table | Class | Rule / PII columns |
|---|---|---|
| `auth.users` | DELETE | Deleted last; cascades below. `auth.identities`/sessions/refresh tokens cascade in the real GoTrue schema. |
| `auth.audit_log_entries` (no FK) | DELETE | `payload` holds actor id + email; delete where `payload->>'actor_id' = U`. |
| `public.profiles` | CASCADE | `email`, `full_name`, `avatar_url`, `stripe_customer_id`. |
| `public.leads` (`user_id` n) | ANON | Rows `L`. Replace `name!` and `email!` with placeholders; NULL `quiz_answers` → `{}`, `ai_insight`, `share_quote`, `artifact_email_error`, `user_id`, `partner_access_invitation_id` (unblocks invitation delete). The UPDATE fires `leads_enqueue_customerio_profile_sync`, so its outbox row is deleted afterwards in the same transaction. |
| `public.funnel_sessions` (`user_id` n, `lead_id` n) | ANON | Rows `S`. Clear `entry_url`, `entry_path`, `referrer`, `first_touch` → `{}`, `purchase_reference`; `visitor_id!` (device cookie) → subject id; NULL `user_id`, `partner_access_invitation_id`. |
| `public.trial_enrollments` (`user_id` n) | ANON | Rows `T`. NULL `user_id`, `neutralization_evidence`. Guards allow this; `capture_trial_analytics` skips NULL-user enrollments, so late provider events produce no analytics. |
| `public.billing_one_time_purchases` (`user_id` r, nullable) | ANON (Q1) | NULL `user_id`, `provider_customer_id`; `metadata` → strip customer/email keys. Retention 10 y. |
| `public.product_submissions` (`user_id!` c) | ANON | Kept per D10. Needs `user_id` DROP NOT NULL (FK stays CASCADE, the routine nulls it first). Product text (`brand_text`, `product_name_text`) is kept; clear `review_notes`, `user_facing_*`, `intake_history` user entries, `front_image_path`, `barcode_image_path` (collect paths first; storage objects deleted by the service), `*_validation_metadata` → `{}`, `source_conversation_id`, `user_product_usage_id`, `user_product_id`. Retention: none (no purge). |

## 2. FK children

### Deleted with the account (CASCADE unless marked DELETE)

| Table | FK | Notes |
|---|---|---|
| `app_store_subscription_status`, `app_store_transactions` | profiles c | Apple is merchant of record; no retention. |
| `beta_feedback` | auth.users n | **DELETE** — `message`, `user_agent`, `posthog_session_id`. |
| `checkout_activation_claims` | auth.users c | Q2. |
| `conversations` → `messages`, `conversation_states`, `conversation_turn_traces` | profiles c | Chat content. |
| `customerio_profile_sync_outbox` | leads c | **DELETE** for `L` (leads are retained). |
| `discovery_enrollments` | profiles r (`claimed_user_id`) | **DELETE** where `claimed_user_id = U` or `normalized_email = E`; cascades `discovery_intakes` → `discovery_intake_items` → `discovery_call_decisions`. PII: `display_name`, `normalized_email`, item free text. |
| `discovery_intakes` | profiles c | as above. |
| `dismissed_suggestions`, `tracker_nudge_dismissals`, `user_memory_settings` | profiles c | |
| `freemium_plan_admissions` | auth.users c; leads r | Cascades from the user; the leads RESTRICT is satisfied because leads are retained. |
| `funnel_events` | funnel_sessions c; leads n | **DELETE** for `S` — `properties` jsonb. |
| `hair_profiles` | profiles c | Archived first (anonymous quiz archive). Free text: `products_used`, `additional_notes`, `conversation_memory`. |
| `manual_access_grants` | profiles c | **DELETE** also email-bound rows (`email = E`) after test enrollments. |
| `membership_reactivation_checkout_reservations` | profiles c | Q2. `paypal_checkout_intents.reactivation_reservation_id` is n. |
| `mobile_registration_enrollments` | profiles c | `email`. Read for the archive `channel` first. |
| `mobile_registration_publication_receipts` | profiles c | `consent`, `result`. |
| `mobile_scan_history` | profiles c | |
| `openai_ads_contexts` (private) | funnel_sessions c | **DELETE** for `S` — `source_url`, `oppref`, `obref`. |
| `mobile_push_installations` (private) | profiles c | `apns_token`, `installation_id`. |
| `mobile_research_deliveries`, `mobile_research_delivery_candidates` (private) | profiles c; product_submissions c | Cascade by user. |
| `partner_access_invitations` | profiles r (`claimed_user_id`), n (`created_by_user_id`); leads r; funnel_sessions r | **DELETE** where `claimed_user_id = U` or `normalized_email = E`, after nulling `leads/funnel_sessions/manual_access_grants.partner_access_invitation_id`; cascades `partner_access_email_changes`. Admin-created invitations for others keep `created_by_user_id` → NULL. |
| `personal_plan_migration_enrollments` | profiles c; leads r | |
| `personal_plans`, `personal_plan_need_versions`, `_portfolio_versions`, `_product_drafts`, `_refinement_drafts`, `_routine_proposals`, `_routine_versions`, `_routine_source_change_outbox` | profiles c (+ RESTRICT edges among themselves) | The internal composite RESTRICT edges may reject a single cascade; the routine deletes these explicitly in dependency order (moderator reset order) if the test shows it. |
| `personal_plan_prepared_artifacts` | auth.users n; leads c | **DELETE** for `U` or `L` — `quiz_answers`, `canonical_profile`. After test enrollments (RESTRICT). |
| `personal_plan_quiz_drafts` | funnel_sessions r | **DELETE** for `S` — `draft`. |
| `personal_plan_result_returns`, `quiz_email_return_links` | leads c | **DELETE** for `L` (leads retained). |
| `personal_plan_test_enrollments`, `personal_plan_test_members`, `regular_quiz_test_enrollments` | auth.users r! ; leads/funnel_sessions/grants r | **DELETE** explicitly (members, then enrollments) before the user delete; field-test state, not billing. |
| `personal_plan_ui_lifecycle_marks`, `scan_free_reveals`, `scan_wishlist` | auth.users c | |
| `routine_logs` → `routine_log_products` | profiles c | |
| `scan_resolve_events` | auth.users c (`user_id!`) | **ANON, no purge** per D10: `user_id` DROP NOT NULL, NULL it, tag subject id. `raw_value` is a scanned barcode (no PII). |
| `scanner_context_heads`, `_sources`, `_versions`, `scanner_paid_source_bindings`, `scanner_profile_edit_receipts`, `scanner_profile_edits` | profiles c | Profile snapshots. |
| `user_memory_entries` | profiles c | Chat memory. |
| `user_product_usage` | profiles c | `front_image_path` → service deletes the storage object. |
| `user_products` | profiles c | `product_submissions.(user_id,category,user_product_id)` is r; the routine nulls the submission link first. |
| `product_intake_research_jobs`, `_artifacts`, `_review_decisions` | product_submissions c | NONE (product research); `review_decisions.comment` is reviewer text. |
| `discovery_intake_items.product_submission_id`, `mobile_scan_history.submission_id`, `user_product_usage.product_submission_id` | product_submissions n | NONE. |

### Retained, anonymized (ANON)

Retention per A2: billing 10 years, cancellation evidence 3 years. Parents (`leads`, `funnel_sessions`, `trial_enrollments`) take the longest retention of their retained children.

| Table | FK | Retention | Anonymization |
|---|---|---|---|
| `personal_plan_one_time_checkout_consents` | profiles r; leads r!; funnel_sessions r! | 10 y | NULL `user_id` (Q1). `consent_text` is the legal text (no PII). |
| `personal_plan_one_time_fulfillment_jobs` | billing_one_time_purchases r; consents r | 10 y | NONE; `last_error` cleared. |
| `paypal_order_intents` | leads r!; funnel_sessions r!; consents r!; profiles n | 10 y | `email!` → placeholder, NULL `user_id`, `metadata` strip payer keys. |
| `paypal_expired_order_reset_audit` | paypal_order_intents r; consents r | 10 y | NONE (append-only; `requested_by` is an operator label). |
| `paypal_checkout_intents` (web PayPal subscription intents) | profiles n; `lead_id`, `email` without FK | 10 y | Rows `user_id = U` or `email = E` or `lead_id ∈ L`: NULL `email`, `user_id`, `lead_id`; `metadata` strip payer keys. |
| `private.paypal_trial_checkout_attempts` → `paypal_trial_activation_evidence` | paypal_checkout_intents r; trial_enrollments r | 10 y | NONE. |
| `private.paypal_trial_management_requests`, `_plan_catalogs` | trial_enrollments r | 10 y | NONE. |
| `private.paypal_trial_paid_recovery_requests` | trial_enrollments r | 10 y | `user_id!` (no FK) DROP NOT NULL, NULL (Q1). |
| `private.stripe_paid_cancellation_operations` | trial_enrollments r | 3 y | `user_id!` (no FK) DROP NOT NULL, NULL. |
| `private.stripe_trial_continuation_operations`, `stripe_trial_management_approvals`, `stripe_trial_paid_recovery_requests` | trial_enrollments / operations r | 10 y | NONE (provider ids). |
| `private.trial_analytics_contexts` | trial_enrollments c | 10 y | `meta_context` → `{}` (Q1). |
| `private.trial_cancellation_declarations` | profiles r!; trial_enrollments r | 3 y | FK → nullable + SET NULL; NULL `user_id` (Q1). |
| `private.trial_cancellation_receipts` | profiles r!; declarations r | 3 y | FK → nullable + SET NULL; NULL `user_id`. |
| `private.trial_cancellation_provider_operations` | declarations r | 3 y | NONE. |
| `private.trial_paid_cancellation_declarations` | profiles r!; trial_enrollments r | 3 y | FK → nullable + SET NULL (Q1). |
| `private.trial_management_operations` → `stripe_trial_management_approvals`, `trial_offer_revisions` | profiles r!; trial_enrollments r | 10 y | FK → nullable + SET NULL (Q1). |
| `private.trial_paid_recovery_operations` → `stripe_trial_paid_recovery_requests` | profiles r!; trial_enrollments r | 10 y | FK → nullable + SET NULL (Q1). |
| `private.trial_management_agreement_bindings`, `_catalogs`, `_state`, `trial_offer_revisions`, `trial_paid_continuations`, `trial_paid_continuation_history`, `trial_payment_continuation_reconciliations`, `trial_payment_events` | trial_enrollments r | 10 y | NONE. |
| `private.trial_reminders`, `private.trial_required_notices` | profiles n; trial_enrollments r / n; declarations n | 3 y | NULL `user_id` (guards allow). Snapshots hold contract terms only; the text carries a blank withdrawal form, no recipient data. |
| `private.public_contract_declaration_matches` | profiles n; trial_enrollments n | 3 y | NULL `user_id` (guard allows). |
| `private.public_contract_declaration_applications` | trial_cancellation_declarations r | 3 y | NONE. |
| `private.public_contract_declarations` (no FK) + `_receipts`, `_completions`, `_reviews` | — | 3 y | Rows matched to `U`/`T` or `payload->>'email' = E`: `payload.name`/`email`/`contract`/`reason` → placeholders (a CHECK requires non-empty strings); `receipts.receipt_payload.declaration.*` likewise. |
| `private.trial_identity_restrictions`, `public.trial_identity_claims` | trial_enrollments n | Q3 | Digests only. |
| `trial_checkout_attempts` | trial_enrollments r | 10 y | `stripe_params.customer_email` → removed (Q1). |
| `billing_subscriptions` (+ plan changes, analytics outbox) | profiles c | Q2 | `provider_subscriber_email`, `metadata`. |
| `payment_support_cases` | leads a; profiles a | Q4 | `resolution_note`, `reported_checkout_context`. |

## 3. Email- or id-keyed tables without FK

| Table | Class | Match |
|---|---|---|
| `mobile_auth_attempts` | DELETE | `email = E` |
| `mobile_registration_intents` | DELETE | `email = E` or `verified_user_id = U` or `provider_user_id = U` |
| `waitlist_signups` → `waitlist_customerio_outbox` | DELETE | `normalized_email = E` |
| `rate_limits` | DELETE | `key` containing `U` or `E` (short-lived) |
| `private.public_contract_declarations` | ANON | see §2 |
| `paypal_checkout_intents` | ANON | see §2 |
| `billing_webhook_events` | NONE | provider event ids only |
| `private.trial_identity_*` | Q3 | digests |
| `private.openai_ads_consents`, `scan_submit_dm_lookup_events`, `scan_*_daily_aggregates` | NONE | no person key |
| Customer.io person, PostHog person + events | external | service after the RPC |
| Storage `product-intake` objects | external | submission + usage photo paths collected by the RPC |

## 4. Production-only tables (not in migrations)

- `public.profiles_backup_20260822`, `public.billing_subscriptions_backup_20260822` (Q5). A live read-only column/FK check is needed before activation; any other live-only table is invisible to this replay.

## 5. Guard test contract

The Task 6 guard test enumerates FKs into the covered parents from the migrated schema and fails on any `(child, columns, parent)` edge missing from the shared classification constant that also generates §2.
