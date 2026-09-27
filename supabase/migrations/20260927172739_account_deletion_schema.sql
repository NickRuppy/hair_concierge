-- Account deletion (iOS paywall Task 6): durable operation log, anonymous quiz archive,
-- anonymization tags on every retained table, and the FK/NOT NULL changes the
-- inventory (plans/ios-paywall/deletion-inventory.md) requires. The routine itself is
-- in the next migration.

-- One row per client-generated request. user_id is kept only while the deletion is in
-- progress (external cleanup still needs it) and cleared at external_cleanup_done.
CREATE TABLE private.account_deletion_operations (
  request_id uuid PRIMARY KEY,
  user_id uuid,
  email text,
  state text NOT NULL DEFAULT 'requested'
    CHECK (state IN ('requested', 'web_billing_cancelled', 'data_deleted', 'external_cleanup_done')),
  storage_paths text[] NOT NULL DEFAULT '{}',
  external_attempts integer NOT NULL DEFAULT 0 CHECK (external_attempts >= 0),
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  data_deleted_at timestamptz,
  completed_at timestamptz,
  CHECK ((state = 'external_cleanup_done') = (user_id IS NULL AND email IS NULL AND storage_paths = '{}')),
  CHECK (state IN ('requested', 'web_billing_cancelled') OR data_deleted_at IS NOT NULL)
);
CREATE UNIQUE INDEX account_deletion_operations_one_open_per_user
  ON private.account_deletion_operations (user_id) WHERE state IN ('requested', 'web_billing_cancelled');
CREATE INDEX account_deletion_operations_external_pending
  ON private.account_deletion_operations (updated_at) WHERE state = 'data_deleted';
ALTER TABLE private.account_deletion_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.account_deletion_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.account_deletion_operations TO service_role;

-- Anonymous copy of the quiz answers (D10): whitelisted canonical quiz keys, month, channel.
CREATE TABLE private.anonymous_quiz_answer_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_subject_id uuid NOT NULL,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  answered_month date NOT NULL CHECK (answered_month = date_trunc('month', answered_month)::date),
  channel text NOT NULL CHECK (channel IN ('app', 'web')),
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.anonymous_quiz_answer_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.anonymous_quiz_answer_archive FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.anonymous_quiz_answer_archive TO service_role;

-- Retention (A2) — the single source; src/lib/account-deletion/inventory.ts mirrors it.
CREATE FUNCTION private.account_deletion_retention(p_class text) RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_class
    WHEN 'billing' THEN interval '10 years'
    WHEN 'cancellation_evidence' THEN interval '3 years'
  END
$$;

-- Q3 (open with Nick): trial anti-abuse fingerprints are kept hashed ('keep_hashed') or
-- erased through public.apply_trial_identity_rights ('erase'). One-line switch.
CREATE FUNCTION private.account_deletion_policy() RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 'keep_hashed'::text $$;

-- Anonymization tags on every retained table.
DO $tags$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'public.leads', 'public.funnel_sessions', 'public.trial_enrollments',
    'public.billing_one_time_purchases', 'public.personal_plan_one_time_checkout_consents',
    'public.personal_plan_one_time_fulfillment_jobs', 'public.paypal_order_intents',
    'public.paypal_expired_order_reset_audit', 'public.paypal_checkout_intents',
    'public.trial_checkout_attempts', 'public.trial_identity_claims', 'public.payment_support_cases',
    'public.product_submissions', 'public.scan_resolve_events',
    'private.paypal_trial_checkout_attempts', 'private.paypal_trial_activation_evidence',
    'private.paypal_trial_management_requests', 'private.paypal_trial_plan_catalogs',
    'private.paypal_trial_paid_recovery_requests', 'private.stripe_paid_cancellation_operations',
    'private.stripe_trial_continuation_operations', 'private.stripe_trial_management_approvals',
    'private.stripe_trial_paid_recovery_requests', 'private.trial_analytics_contexts',
    'private.trial_cancellation_declarations', 'private.trial_cancellation_receipts',
    'private.trial_cancellation_provider_operations', 'private.trial_paid_cancellation_declarations',
    'private.trial_management_operations', 'private.trial_offer_revisions',
    'private.trial_management_agreement_bindings', 'private.trial_management_catalogs',
    'private.trial_management_state', 'private.trial_paid_continuations',
    'private.trial_paid_continuation_history', 'private.trial_payment_continuation_reconciliations',
    'private.trial_payment_events', 'private.trial_paid_recovery_operations',
    'private.trial_reminders', 'private.trial_required_notices',
    'private.public_contract_declarations', 'private.public_contract_declaration_receipts',
    'private.public_contract_declaration_completions', 'private.public_contract_declaration_reviews',
    'private.public_contract_declaration_matches', 'private.public_contract_declaration_applications',
    'private.trial_identity_sources'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ADD COLUMN anonymous_subject_id uuid, '
      'ADD COLUMN anonymized_at timestamptz, ADD COLUMN purge_after timestamptz', t);
    EXECUTE format('CREATE INDEX %I ON %s (purge_after) WHERE purge_after IS NOT NULL',
      split_part(t, '.', 2) || '_purge_after_idx', t);
  END LOOP;
END
$tags$;

-- NOT NULL + RESTRICT user links on retained cancellation/management evidence block the
-- auth-user delete: nullable + ON DELETE SET NULL (D12). No other FK behaviour changes.
ALTER TABLE private.trial_cancellation_declarations ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT trial_cancellation_declarations_user_id_fkey,
  ADD CONSTRAINT trial_cancellation_declarations_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE private.trial_cancellation_receipts ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT trial_cancellation_receipts_user_id_fkey,
  ADD CONSTRAINT trial_cancellation_receipts_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE private.trial_management_operations ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT trial_management_operations_user_id_fkey,
  ADD CONSTRAINT trial_management_operations_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE private.trial_paid_cancellation_declarations ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT trial_paid_cancellation_declarations_user_id_fkey,
  ADD CONSTRAINT trial_paid_cancellation_declarations_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE private.trial_paid_recovery_operations ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT trial_paid_recovery_operations_user_id_fkey,
  ADD CONSTRAINT trial_paid_recovery_operations_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL;
-- Retained rows whose user column has no FK or cascades: the routine nulls it first.
ALTER TABLE private.paypal_trial_paid_recovery_requests ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE private.stripe_paid_cancellation_operations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.product_submissions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.scan_resolve_events ALTER COLUMN user_id DROP NOT NULL;

-- Anonymized rows lose their owner link; the owner invariants hold for live rows only.
ALTER TABLE public.payment_support_cases DROP CONSTRAINT payment_support_cases_check,
  ADD CONSTRAINT payment_support_cases_check
    CHECK (((lead_id IS NULL) <> (user_id IS NULL)) OR (anonymized_at IS NOT NULL AND lead_id IS NULL AND user_id IS NULL));
ALTER TABLE public.product_submissions DROP CONSTRAINT product_submissions_association_path_check,
  ADD CONSTRAINT product_submissions_association_path_check CHECK (
    NOT (user_product_usage_id IS NOT NULL AND user_product_id IS NOT NULL)
    AND (source <> 'personal_plan' OR (user_product_id IS NOT NULL AND user_product_usage_id IS NULL)
      OR (anonymized_at IS NOT NULL AND user_id IS NULL AND user_product_id IS NULL)));

-- Columns a guarded anonymization write may change, per table: 'null' columns must become
-- NULL (user links), 'scrub' columns may be redacted. Tag columns are always allowed.
CREATE FUNCTION private.account_deletion_writable_columns(p_table text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(('{
    "public.billing_one_time_purchases": {"null": ["user_id"], "scrub": ["metadata"]},
    "public.personal_plan_one_time_checkout_consents": {"null": ["user_id"], "scrub": []},
    "public.trial_checkout_attempts": {"null": [], "scrub": ["scope_id", "stripe_params"]},
    "private.paypal_trial_checkout_attempts": {"null": [], "scrub": ["scope_id"]},
    "private.trial_analytics_contexts": {"null": [], "scrub": ["meta_context"]},
    "private.trial_cancellation_declarations": {"null": ["user_id"], "scrub": []},
    "private.trial_management_operations": {"null": ["user_id"], "scrub": []},
    "private.trial_paid_cancellation_declarations": {"null": ["user_id"], "scrub": []},
    "private.trial_paid_recovery_operations": {"null": ["user_id"], "scrub": []},
    "private.paypal_trial_paid_recovery_requests": {"null": ["user_id"], "scrub": []},
    "private.public_contract_declaration_matches": {"null": ["user_id"], "scrub": []},
    "public.product_submissions": {"null": ["user_id", "user_product_id", "user_product_usage_id", "source_conversation_id"],
      "scrub": ["front_image_path", "barcode_image_path", "front_image_validation_metadata", "barcode_image_validation_metadata",
        "review_notes", "user_facing_resolution_reason", "user_facing_next_step", "intake_history",
        "personal_plan_request_fingerprint", "updated_at"]}
  }'::jsonb) -> p_table, '{"null": [], "scrub": []}'::jsonb)
$$;

-- The one exception the billing guards make (Q1). It permits exactly:
--  * UPDATE inside private.delete_account (transaction-local flag naming an in-progress
--    operation) that sets the tags once, nulls the listed user links, redacts the listed
--    PII columns and changes nothing else;
--  * DELETE inside private.purge_anonymized_records of a row past its purge_after.
CREATE FUNCTION private.account_deletion_permits(
  p_op text, p_schema text, p_table text, p_old jsonb, p_new jsonb
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  flag text := current_setting('chaarlie.account_deletion', true);
  writable jsonb;
  k text;
BEGIN
  IF p_op = 'DELETE' THEN
    RETURN current_setting('chaarlie.account_purge', true) = 'on'
      AND p_old IS NOT NULL AND (p_old->>'purge_after') IS NOT NULL
      AND (p_old->>'purge_after')::timestamptz <= now();
  END IF;
  IF p_op <> 'UPDATE' OR p_old IS NULL OR p_new IS NULL OR coalesce(flag, '') = '' THEN
    RETURN false;
  END IF;
  IF flag !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NOT EXISTS (
    SELECT 1 FROM private.account_deletion_operations
    WHERE request_id = flag::uuid AND state IN ('requested', 'web_billing_cancelled')
  ) THEN
    RETURN false;
  END IF;
  IF p_old->>'anonymized_at' IS NOT NULL OR p_new->>'anonymized_at' IS NULL
    OR p_new->>'anonymous_subject_id' IS NULL THEN
    RETURN false;
  END IF;
  writable := private.account_deletion_writable_columns(p_schema || '.' || p_table);
  FOR k IN SELECT jsonb_object_keys(p_old || p_new) LOOP
    CONTINUE WHEN (p_old -> k) IS NOT DISTINCT FROM (p_new -> k);
    CONTINUE WHEN k IN ('anonymous_subject_id', 'anonymized_at', 'purge_after');
    CONTINUE WHEN writable->'null' ? k AND p_new -> k = 'null'::jsonb;
    CONTINUE WHEN writable->'scrub' ? k;
    RETURN false;
  END LOOP;
  RETURN true;
END
$$;
REVOKE ALL ON FUNCTION private.account_deletion_permits(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.account_deletion_permits(text, text, text, jsonb, jsonb) TO service_role;
REVOKE ALL ON FUNCTION private.account_deletion_retention(text), private.account_deletion_policy(),
  private.account_deletion_writable_columns(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.account_deletion_retention(text), private.account_deletion_policy(),
  private.account_deletion_writable_columns(text) TO service_role;

-- GUARDS (generated from the latest definitions; the only change in each is the first line
-- after BEGIN that asks private.account_deletion_permits). The product-submission foundation
-- check is included because kept submissions lose their owner (D10).
CREATE OR REPLACE FUNCTION private.guard_public_declaration_review_resolution()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 IF OLD.status='resolved' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Declaration review is already resolved'; END IF;
 IF NEW.status='pending' AND OLD.status<>'pending' THEN RAISE EXCEPTION 'Declaration review cannot regress'; END IF;
 IF NEW.status='in_review' AND NOT EXISTS(SELECT 1 FROM private.public_contract_declaration_matches m WHERE m.declaration_id=NEW.declaration_id) THEN
 RAISE EXCEPTION 'Verified match required for review transition'; END IF;
 IF NEW.status='resolved' AND NOT EXISTS(SELECT 1 FROM private.public_contract_declaration_completions c
 WHERE c.declaration_id=NEW.declaration_id AND c.evidence->>'completionReference'=NEW.resolution_reference) THEN
 RAISE EXCEPTION 'Completion evidence required for resolution'; END IF;
 RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION private.guard_trial_identity_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 PERFORM pg_advisory_xact_lock(74144351);
 IF EXISTS(SELECT 1 FROM private.trial_identity_restrictions WHERE kind=NEW.kind AND key_version=NEW.key_version AND namespace=NEW.namespace AND claim_digest=NEW.claim_digest) THEN RETURN NULL; END IF;
 IF current_setting('app.trial_identity_rights_restore',true)='yes' THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM private.trial_identity_sources WHERE kind=current_setting('app.trial_identity_source_kind',true) AND source_id=current_setting('app.trial_identity_source_id',true) AND status<>'active') THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.trial_identity_sources s JOIN private.trial_identity_source_claims c ON c.source_kind=s.kind AND c.source_id=s.source_id
 WHERE s.kind=current_setting('app.trial_identity_source_kind',true) AND s.source_id=current_setting('app.trial_identity_source_id',true) AND s.status='active'
 AND c.kind=NEW.kind AND c.key_version=NEW.key_version AND c.namespace=NEW.namespace AND c.claim_digest=NEW.claim_digest) THEN RAISE EXCEPTION 'Identity source write is not authorized'; END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION private.prevent_paypal_trial_activation_evidence_rewrite()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
 RAISE EXCEPTION 'PayPal verified activation observation immutable'; END $function$
;

CREATE OR REPLACE FUNCTION private.prevent_paypal_trial_paid_recovery_request_rewrite()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 IF (to_jsonb(NEW)-ARRAY['request_sent_at','target_agreement_id','approval_url','source_neutralization_requested_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['request_sent_at','target_agreement_id','approval_url','source_neutralization_requested_at'])
 OR (OLD.source_neutralization_requested_at IS NOT NULL AND NEW.source_neutralization_requested_at IS DISTINCT FROM OLD.source_neutralization_requested_at)
 OR (OLD.request_sent_at IS NOT NULL AND NEW.request_sent_at IS DISTINCT FROM OLD.request_sent_at)
 OR (OLD.target_agreement_id IS NOT NULL AND NEW.target_agreement_id IS DISTINCT FROM OLD.target_agreement_id)
 OR (OLD.approval_url IS NOT NULL AND NEW.approval_url IS DISTINCT FROM OLD.approval_url)
 THEN RAISE EXCEPTION 'PayPal paid recovery request immutable'; END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION private.protect_paid_cancellation_declaration()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 IF (to_jsonb(NEW)-ARRAY['status','lease_token','lease_until','next_attempt_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['status','lease_token','lease_until','next_attempt_at']) OR (OLD.status='confirmed' AND NEW.status<>'confirmed')
 THEN RAISE EXCEPTION 'Paid cancellation declaration is immutable'; END IF;
 RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION private.protect_public_declaration_resolution_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 IF TG_TABLE_NAME='public_contract_declaration_matches' AND
   (to_jsonb(NEW)-ARRAY['user_id','enrollment_id'])=(to_jsonb(OLD)-ARRAY['user_id','enrollment_id'])
   AND (NEW.user_id IS NOT DISTINCT FROM OLD.user_id OR NEW.user_id IS NULL)
   AND (NEW.enrollment_id IS NOT DISTINCT FROM OLD.enrollment_id OR NEW.enrollment_id IS NULL) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Declaration resolution record is immutable';
END; $function$
;

CREATE OR REPLACE FUNCTION private.protect_trial_analytics_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
 RAISE EXCEPTION 'Original trial analytics context is immutable'; END $function$
;

CREATE OR REPLACE FUNCTION private.protect_trial_cancellation_declaration()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Trial cancellation declaration is immutable';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.protect_trial_management_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 IF (to_jsonb(NEW)-ARRAY['status','target_agreement_id','evidence','reconciliation_reference','completed_at'])
 IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','target_agreement_id','evidence','reconciliation_reference','completed_at'])
 OR (OLD.status<>'pending' AND NEW IS DISTINCT FROM OLD) THEN
 RAISE EXCEPTION 'Trial management operation is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION private.protect_trial_paid_recovery_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 IF (to_jsonb(NEW)-ARRAY['status','target_agreement_id','provider_verified_at','evidence','payment','reconciliation_reference','completed_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['status','target_agreement_id','provider_verified_at','evidence','payment','reconciliation_reference','completed_at'])
 OR (OLD.status<>'pending' AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Paid recovery acceptance is immutable'; END IF;
 RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION private.reject_trial_management_immutable_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Trial management history is immutable' USING ERRCODE='23514';
END; $function$
;

CREATE OR REPLACE FUNCTION public.deny_paypal_expired_order_reset_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PayPal expired-order reset audit is append-only' USING ERRCODE = '22000';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_billing_one_time_purchase_consent_match()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  consent_user_id uuid;
  consent_product_kind text;
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT user_id, product_kind
  INTO consent_user_id, consent_product_kind
  FROM public.personal_plan_one_time_checkout_consents
  WHERE id = NEW.consent_id;

  IF consent_product_kind IS DISTINCT FROM NEW.product_kind THEN
    RAISE EXCEPTION 'one-time purchase consent product mismatch' USING ERRCODE = '23514';
  END IF;

  IF NEW.user_id IS NOT NULL
    AND consent_user_id IS NULL THEN
    RAISE EXCEPTION 'one-time purchase user must be bound through consent RPC' USING ERRCODE = '23514';
  END IF;

  IF NEW.user_id IS NOT NULL
    AND consent_user_id IS NOT NULL
    AND NEW.user_id IS DISTINCT FROM consent_user_id THEN
    RAISE EXCEPTION 'one-time purchase user must match consent user' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.consent_id IS DISTINCT FROM OLD.consent_id
      OR NEW.provider IS DISTINCT FROM OLD.provider
      OR NEW.provider_transaction_id IS DISTINCT FROM OLD.provider_transaction_id
      OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
      OR (OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      RAISE EXCEPTION 'one-time purchase identity is immutable' USING ERRCODE = '22000';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_personal_plan_one_time_consent_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  reset_audit_id uuid;
  new_reset_intent_id uuid;
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.funnel_sessions
    WHERE id = NEW.funnel_session_id AND lead_id = NEW.lead_id
  ) THEN
    RAISE EXCEPTION 'checkout consent lead and funnel session must match' USING ERRCODE = '23514';
  END IF;

  IF NEW.lead_id IS DISTINCT FROM OLD.lead_id
    OR NEW.funnel_session_id IS DISTINCT FROM OLD.funnel_session_id
    OR (
      NEW.user_id IS DISTINCT FROM OLD.user_id
      AND NOT (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL)
    )
    OR NEW.product_kind IS DISTINCT FROM OLD.product_kind
    OR NEW.offer_variant IS DISTINCT FROM OLD.offer_variant
    OR NEW.copy_version IS DISTINCT FROM OLD.copy_version
    OR NEW.consent_text IS DISTINCT FROM OLD.consent_text
    OR NEW.consent_text_sha256 IS DISTINCT FROM OLD.consent_text_sha256
    OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'accepted checkout consent evidence is immutable' USING ERRCODE = '22000';
  END IF;

  reset_audit_id := nullif(current_setting('app.personal_plan_one_time_paypal_reset_audit_id', true), '')::uuid;
  SELECT intent_id INTO new_reset_intent_id
  FROM public.paypal_expired_order_reset_audit
  WHERE id = reset_audit_id
    AND consent_id = OLD.id
    AND prior_provider_order_id = OLD.paypal_order_id;

  IF (
      OLD.stripe_checkout_session_id IS NOT NULL
      AND NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
      AND (
        NEW.stripe_checkout_session_id IS NULL
        OR OLD.paypal_order_id IS NOT NULL
        OR NEW.paypal_order_id IS NOT NULL
        OR OLD.paypal_capture_id IS NOT NULL
        OR NEW.paypal_capture_id IS NOT NULL
      )
    )
    OR (
      OLD.paypal_order_id IS NOT NULL
      AND NEW.paypal_order_id IS DISTINCT FROM OLD.paypal_order_id
      AND NOT (
        NEW.paypal_order_id IS NULL
        AND OLD.paypal_capture_id IS NULL
        AND NEW.paypal_capture_id IS NULL
        AND OLD.stripe_checkout_session_id IS NULL
        AND NEW.stripe_checkout_session_id IS NULL
        AND new_reset_intent_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.paypal_order_intents reset_intent
          WHERE reset_intent.id = new_reset_intent_id
            AND reset_intent.consent_id = OLD.id
            AND reset_intent.provider_order_id IS NULL
            AND reset_intent.provider_capture_id IS NULL
            AND reset_intent.status = 'created'
        )
      )
    )
    OR (
      OLD.paypal_capture_id IS NOT NULL
      AND NEW.paypal_capture_id IS DISTINCT FROM OLD.paypal_capture_id
    ) THEN
    RAISE EXCEPTION 'provider references violate one-provider recovery rules' USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_trial_checkout_attempt_rewrite()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF NEW.scope_kind IS DISTINCT FROM OLD.scope_kind OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR NEW.client_attempt_id IS DISTINCT FROM OLD.client_attempt_id OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.accepted_offer IS DISTINCT FROM OLD.accepted_offer OR NEW.provider IS DISTINCT FROM OLD.provider OR (OLD.stripe_params IS NOT NULL AND (NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id OR NEW.stripe_livemode IS DISTINCT FROM OLD.stripe_livemode OR NEW.stripe_params IS DISTINCT FROM OLD.stripe_params OR NEW.expires_at IS DISTINCT FROM OLD.expires_at)) OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference) THEN
    RAISE EXCEPTION 'trial checkout attempt immutable';
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION private.prevent_paypal_trial_checkout_attempt_rewrite()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

 IF (NEW.trial_end_at IS NULL) <> (NEW.provider_start_time IS NULL)
  OR (NEW.trial_end_at IS NOT NULL AND (NOT isfinite(NEW.trial_end_at) OR NOT isfinite(NEW.provider_start_time)))
  OR (NEW.trial_end_at IS NOT NULL AND (NEW.provider_start_time<>NEW.trial_end_at+interval '12 hours' OR NEW.trial_end_at<>private.paypal_trial_frozen_start(NEW.request_expires_at)))
  OR (OLD.trial_end_at IS NOT NULL AND (NEW.trial_end_at IS DISTINCT FROM OLD.trial_end_at OR NEW.provider_start_time IS DISTINCT FROM OLD.provider_start_time))
  OR (OLD.trial_end_at IS NULL AND NEW.trial_end_at IS NOT NULL AND (OLD.request_id IS NOT NULL OR NEW.request_id !~ '^paypal-trial:[0-9a-f-]{36}:v2$' OR NEW.status<>'frozen'))
  OR NEW.scope_kind IS DISTINCT FROM OLD.scope_kind OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR NEW.client_attempt_id IS DISTINCT FROM OLD.client_attempt_id OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.intent_id IS DISTINCT FROM OLD.intent_id OR NEW.accepted_offer IS DISTINCT FROM OLD.accepted_offer
  OR (OLD.paypal_app_id IS NOT NULL AND NEW.paypal_app_id IS DISTINCT FROM OLD.paypal_app_id)
  OR (OLD.paypal_product_id IS NOT NULL AND NEW.paypal_product_id IS DISTINCT FROM OLD.paypal_product_id)
  OR (OLD.paypal_plan_id IS NOT NULL AND NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id)
  OR (OLD.request_id IS NOT NULL AND NEW.request_id IS DISTINCT FROM OLD.request_id)
  OR (OLD.request_expires_at IS NOT NULL AND NEW.request_expires_at IS DISTINCT FROM OLD.request_expires_at)
  OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
 THEN RAISE EXCEPTION 'PayPal trial checkout attempt immutable'; END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.validate_product_submission_foundation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  category_supported boolean;
  user_prefix text := NEW.user_id::text || '/';
  tmp_prefix text := 'tmp/' || NEW.user_id::text || '/';
BEGIN
  IF private.account_deletion_permits(TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT is_intake_supported
  INTO category_supported
  FROM public.product_categories
  WHERE key = NEW.category;

  IF category_supported IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Product intake category % is not supported', NEW.category;
  END IF;

  IF NEW.front_image_path IS NOT NULL
      AND NEW.front_image_path NOT LIKE user_prefix || NEW.id::text || '/%'
      AND NEW.front_image_path NOT LIKE tmp_prefix || '%' THEN
    RAISE EXCEPTION 'front_image_path does not belong to product submission owner/path';
  END IF;

  IF NEW.barcode_image_path IS NOT NULL
      AND NEW.barcode_image_path NOT LIKE user_prefix || NEW.id::text || '/%'
      AND NEW.barcode_image_path NOT LIKE tmp_prefix || '%' THEN
    RAISE EXCEPTION 'barcode_image_path does not belong to product submission owner/path';
  END IF;

  IF NEW.user_product_usage_id IS NOT NULL AND NEW.user_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'product submission must use exactly one association path';
  END IF;

  IF NEW.source = 'personal_plan'
      AND (NEW.user_product_id IS NULL OR NEW.user_product_usage_id IS NOT NULL) THEN
    RAISE EXCEPTION 'personal_plan submissions require only user_product_id';
  END IF;

  IF NEW.user_product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_products AS user_product
        WHERE user_product.id = NEW.user_product_id
          AND user_product.user_id = NEW.user_id
          AND user_product.category = NEW.category
      ) THEN
    RAISE EXCEPTION 'user_product_id must belong to the same user and category';
  END IF;

  RETURN NEW;
END;
$function$
;

