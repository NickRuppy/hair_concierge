-- Test-only schema baseline captured read-only from production on 2026-08-08.
-- Contains schema definitions only: no production rows or customer data.
-- This file lives outside supabase/migrations and must never be pushed as a
-- production migration. It lets the Personal Plan database contract exercise
-- the real deployment transition without replaying unrelated historical gaps.

CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."membership_reactivation_checkout_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "checkout_attempt_id" "uuid" NOT NULL,
    "interval" "text" NOT NULL,
    "return_destination" "text" DEFAULT '/chat'::"text" NOT NULL,
    "provider" "text",
    "provider_reference" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "membership_reactivation_checkout_reservations_interval_check" CHECK (("interval" = ANY (ARRAY['month'::"text", 'quarter'::"text", 'year'::"text"]))),
    CONSTRAINT "membership_reactivation_checkout_reservations_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paypal'::"text"]))),
    CONSTRAINT "membership_reactivation_checkout_reservations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'provider_selected'::"text", 'provider_created'::"text", 'completed'::"text", 'expired'::"text", 'reconciliation_required'::"text"])))
);


ALTER TABLE "public"."membership_reactivation_checkout_reservations" OWNER TO "postgres";


COMMENT ON TABLE "public"."membership_reactivation_checkout_reservations" IS 'Atomic per-user guard and provider reconciliation ledger for expired-member checkout.';



CREATE OR REPLACE FUNCTION "public"."acquire_membership_reactivation_checkout"("p_user_id" "uuid", "p_checkout_attempt_id" "uuid", "p_interval" "text", "p_return_destination" "text") RETURNS "public"."membership_reactivation_checkout_reservations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  reservation membership_reactivation_checkout_reservations;
BEGIN
  IF p_interval NOT IN ('month', 'quarter', 'year') THEN
    RAISE EXCEPTION 'invalid reactivation interval' USING ERRCODE = '22023';
  END IF;

  UPDATE membership_reactivation_checkout_reservations
  SET status = 'expired', updated_at = now()
  WHERE user_id = p_user_id
    AND status IN ('open', 'provider_selected', 'provider_created')
    AND expires_at <= now();

  SELECT * INTO reservation
  FROM membership_reactivation_checkout_reservations
  WHERE user_id = p_user_id
    AND checkout_attempt_id = p_checkout_attempt_id;

  IF FOUND THEN
    IF reservation.status IN ('expired', 'completed') THEN
      RAISE EXCEPTION 'reactivation checkout attempt is closed' USING ERRCODE = 'P0001';
    END IF;
    IF reservation.interval <> p_interval OR reservation.return_destination <> p_return_destination THEN
      RAISE EXCEPTION 'reactivation checkout attempt parameters changed' USING ERRCODE = 'P0001';
    END IF;
    RETURN reservation;
  END IF;

  SELECT * INTO reservation
  FROM membership_reactivation_checkout_reservations
  WHERE user_id = p_user_id
    AND status IN ('open', 'provider_selected', 'provider_created', 'reconciliation_required')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF reservation.interval <> p_interval OR reservation.return_destination <> p_return_destination THEN
      RAISE EXCEPTION 'membership reactivation checkout already in progress'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN reservation;
  END IF;

  BEGIN
    INSERT INTO membership_reactivation_checkout_reservations (
      user_id,
      checkout_attempt_id,
      interval,
      return_destination
    ) VALUES (
      p_user_id,
      p_checkout_attempt_id,
      p_interval,
      p_return_destination
    )
    RETURNING * INTO reservation;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO reservation
    FROM membership_reactivation_checkout_reservations
    WHERE user_id = p_user_id
      AND status IN ('open', 'provider_selected', 'provider_created', 'reconciliation_required')
    ORDER BY created_at ASC
    LIMIT 1;

    IF FOUND THEN
      IF reservation.interval <> p_interval OR reservation.return_destination <> p_return_destination THEN
        RAISE EXCEPTION 'membership reactivation checkout already in progress'
          USING ERRCODE = 'P0001';
      END IF;
      RETURN reservation;
    END IF;

    RAISE EXCEPTION 'membership reactivation checkout already in progress'
      USING ERRCODE = 'P0001';
  END;

  RETURN reservation;
END;
$$;


ALTER FUNCTION "public"."acquire_membership_reactivation_checkout"("p_user_id" "uuid", "p_checkout_attempt_id" "uuid", "p_interval" "text", "p_return_destination" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_subscription_plan_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_id" "uuid" NOT NULL,
    "billing_subscription_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "current_interval" "text" NOT NULL,
    "target_interval" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "provider_resource_id" "text",
    "provider_target_id" "text",
    "approved_at" timestamp with time zone,
    "applied_at" timestamp with time zone,
    "failure_code" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_subscription_plan_changes_check" CHECK (("current_interval" <> "target_interval")),
    CONSTRAINT "billing_subscription_plan_changes_current_interval_check" CHECK (("current_interval" = ANY (ARRAY['month'::"text", 'quarter'::"text", 'year'::"text"]))),
    CONSTRAINT "billing_subscription_plan_changes_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paypal'::"text"]))),
    CONSTRAINT "billing_subscription_plan_changes_status_check" CHECK (("status" = ANY (ARRAY['pending_provider'::"text", 'pending_approval'::"text", 'scheduled'::"text", 'reconciling'::"text", 'applied'::"text", 'failed'::"text"]))),
    CONSTRAINT "billing_subscription_plan_changes_target_interval_check" CHECK (("target_interval" = ANY (ARRAY['month'::"text", 'quarter'::"text", 'year'::"text"])))
);


ALTER TABLE "public"."billing_subscription_plan_changes" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_subscription_plan_changes" IS 'Atomic idempotency and reconciliation ledger for next-renewal provider plan changes.';



CREATE OR REPLACE FUNCTION "public"."advance_billing_subscription_plan_change"("p_operation_id" "uuid", "p_expected_status" "text", "p_status" "text", "p_provider_resource_id" "text" DEFAULT NULL::"text", "p_provider_target_id" "text" DEFAULT NULL::"text", "p_effective_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_failure_code" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."billing_subscription_plan_changes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  operation billing_subscription_plan_changes;
BEGIN
  IF p_status NOT IN ('pending_provider', 'pending_approval', 'scheduled', 'reconciling', 'applied', 'failed') THEN
    RAISE EXCEPTION 'invalid plan change status' USING ERRCODE = '22023';
  END IF;

  UPDATE billing_subscription_plan_changes
  SET status = p_status,
      provider_resource_id = COALESCE(p_provider_resource_id, provider_resource_id),
      provider_target_id = COALESCE(p_provider_target_id, provider_target_id),
      effective_at = COALESCE(p_effective_at, effective_at),
      approved_at = CASE
        WHEN p_status IN ('scheduled', 'reconciling', 'applied') THEN COALESCE(approved_at, now())
        ELSE approved_at
      END,
      applied_at = CASE WHEN p_status = 'applied' THEN COALESCE(applied_at, now()) ELSE applied_at END,
      failure_code = CASE
        WHEN p_status IN ('failed', 'reconciling') THEN p_failure_code
        ELSE failure_code
      END,
      metadata = metadata || COALESCE(p_metadata, '{}'::jsonb),
      updated_at = now()
  WHERE operation_id = p_operation_id
    AND status = p_expected_status
  RETURNING * INTO operation;

  IF FOUND THEN RETURN operation; END IF;

  SELECT * INTO operation
  FROM billing_subscription_plan_changes
  WHERE operation_id = p_operation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan change operation not found' USING ERRCODE = 'P0001';
  END IF;

  IF operation.status = p_status THEN RETURN operation; END IF;
  RAISE EXCEPTION 'plan change operation status conflict' USING ERRCODE = 'P0001';
END;
$$;


ALTER FUNCTION "public"."advance_billing_subscription_plan_change"("p_operation_id" "uuid", "p_expected_status" "text", "p_status" "text", "p_provider_resource_id" "text", "p_provider_target_id" "text", "p_effective_at" timestamp with time zone, "p_failure_code" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_personal_plan_one_time_qa"("p_lead_id" "uuid", "p_session_id" "uuid", "p_package_key" "text", "p_arm" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_package_key <> 'meta_personal_plan_v1' OR p_arm <> 'personal-plan-one-time-v1' THEN
    RETURN false;
  END IF;

  UPDATE public.funnel_sessions AS sessions
  SET offer_variant = p_arm,
      is_internal_test = true
  WHERE sessions.id = p_session_id
    AND sessions.lead_id = p_lead_id
    AND sessions.package_key = p_package_key
    AND sessions.quiz_variant = 'personal-plan-quiz-v1'
    AND sessions.offer_viewed_at IS NULL
    AND sessions.checkout_started_at IS NULL;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."assign_personal_plan_one_time_qa"("p_lead_id" "uuid", "p_session_id" "uuid", "p_package_key" "text", "p_arm" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_one_time_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "provider" "text" NOT NULL,
    "product_kind" "text" NOT NULL,
    "provider_transaction_id" "text" NOT NULL,
    "provider_customer_id" "text",
    "provider_order_id" "text",
    "amount_minor" integer NOT NULL,
    "currency" "text" NOT NULL,
    "refunded_amount_minor" integer DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "paid_at" timestamp with time zone NOT NULL,
    "refunded_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consent_id" "uuid" NOT NULL,
    CONSTRAINT "billing_one_time_purchases_amount_minor_check" CHECK (("amount_minor" = 2999)),
    CONSTRAINT "billing_one_time_purchases_check" CHECK ((("refunded_amount_minor" >= 0) AND ("refunded_amount_minor" <= "amount_minor"))),
    CONSTRAINT "billing_one_time_purchases_currency_check" CHECK (("currency" = 'eur'::"text")),
    CONSTRAINT "billing_one_time_purchases_product_kind_check" CHECK (("product_kind" = 'personal_plan_once'::"text")),
    CONSTRAINT "billing_one_time_purchases_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paypal'::"text"]))),
    CONSTRAINT "billing_one_time_purchases_status_check" CHECK (("status" = ANY (ARRAY['paid'::"text", 'refunded'::"text", 'reversed'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."billing_one_time_purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_one_time_purchases" IS 'Durable one-time €29.99 personal-plan provider transactions and entitlement state.';



CREATE OR REPLACE FUNCTION "public"."bind_personal_plan_one_time_purchase_user"("p_consent_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid") RETURNS "public"."billing_one_time_purchases"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  consent_row public.personal_plan_one_time_checkout_consents%ROWTYPE;
  purchase_row public.billing_one_time_purchases%ROWTYPE;
BEGIN
  SELECT *
  INTO consent_row
  FROM public.personal_plan_one_time_checkout_consents
  WHERE id = p_consent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'one-time consent not found' USING ERRCODE = '22000';
  END IF;

  SELECT *
  INTO purchase_row
  FROM public.billing_one_time_purchases
  WHERE id = p_purchase_id AND consent_id = p_consent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'one-time purchase not found for consent' USING ERRCODE = '22000';
  END IF;

  IF consent_row.user_id IS NOT NULL AND consent_row.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'one-time consent already belongs to another user' USING ERRCODE = '22000';
  END IF;

  IF purchase_row.user_id IS NOT NULL AND purchase_row.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'one-time purchase already belongs to another user' USING ERRCODE = '22000';
  END IF;

  UPDATE public.personal_plan_one_time_checkout_consents
  SET user_id = p_user_id
  WHERE id = p_consent_id
    AND (user_id IS NULL OR user_id = p_user_id);

  UPDATE public.billing_one_time_purchases
  SET user_id = p_user_id
  WHERE id = p_purchase_id
    AND consent_id = p_consent_id
    AND (user_id IS NULL OR user_id = p_user_id)
  RETURNING * INTO purchase_row;

  RETURN purchase_row;
END;
$$;


ALTER FUNCTION "public"."bind_personal_plan_one_time_purchase_user"("p_consent_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" bigint) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_window_id  text;
  v_now        timestamptz := now();
  v_expires_at timestamptz;
  v_count      integer;
BEGIN
  v_window_id := to_char(
    to_timestamp(
      floor(extract(epoch from v_now) / (p_window_ms / 1000.0)) * (p_window_ms / 1000.0)
    ),
    'YYYY-MM-DD"T"HH24:MI:SS'
  );
  v_expires_at := to_timestamp(
    (floor(extract(epoch from v_now) / (p_window_ms / 1000.0)) + 1) * (p_window_ms / 1000.0)
  );

  INSERT INTO public.rate_limits (key, window_id, count, expires_at)
  VALUES (p_key, v_window_id, 1, v_expires_at)
  ON CONFLICT (key, window_id) DO UPDATE
    SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_billing_subscription_plan_change"("p_operation_id" "uuid", "p_billing_subscription_id" "uuid", "p_user_id" "uuid", "p_provider" "text", "p_current_interval" "text", "p_target_interval" "text", "p_effective_at" timestamp with time zone) RETURNS "public"."billing_subscription_plan_changes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  operation billing_subscription_plan_changes;
BEGIN
  IF p_provider NOT IN ('stripe', 'paypal')
     OR p_current_interval NOT IN ('month', 'quarter', 'year')
     OR p_target_interval NOT IN ('month', 'quarter', 'year')
     OR p_current_interval = p_target_interval THEN
    RAISE EXCEPTION 'invalid subscription plan change' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO operation
  FROM billing_subscription_plan_changes
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF operation.billing_subscription_id <> p_billing_subscription_id
       OR operation.user_id <> p_user_id
       OR operation.provider <> p_provider
       OR operation.current_interval <> p_current_interval
       OR operation.target_interval <> p_target_interval THEN
      RAISE EXCEPTION 'plan change operation parameters changed' USING ERRCODE = 'P0001';
    END IF;
    RETURN operation;
  END IF;

  BEGIN
    INSERT INTO billing_subscription_plan_changes (
      operation_id,
      billing_subscription_id,
      user_id,
      provider,
      current_interval,
      target_interval,
      effective_at,
      status
    ) VALUES (
      p_operation_id,
      p_billing_subscription_id,
      p_user_id,
      p_provider,
      p_current_interval,
      p_target_interval,
      p_effective_at,
      'pending_provider'
    ) RETURNING * INTO operation;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO operation
    FROM billing_subscription_plan_changes
    WHERE operation_id = p_operation_id;

    IF FOUND THEN RETURN operation; END IF;
    RAISE EXCEPTION 'another subscription plan change is already pending' USING ERRCODE = 'P0001';
  END;

  RETURN operation;
END;
$$;


ALTER FUNCTION "public"."claim_billing_subscription_plan_change"("p_operation_id" "uuid", "p_billing_subscription_id" "uuid", "p_user_id" "uuid", "p_provider" "text", "p_current_interval" "text", "p_target_interval" "text", "p_effective_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_membership_reactivation_checkout_provider"("p_reservation_id" "uuid", "p_user_id" "uuid", "p_provider" "text") RETURNS "public"."membership_reactivation_checkout_reservations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  reservation membership_reactivation_checkout_reservations;
BEGIN
  IF p_provider NOT IN ('stripe', 'paypal') THEN
    RAISE EXCEPTION 'invalid reactivation provider' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO reservation
  FROM membership_reactivation_checkout_reservations
  WHERE id = p_reservation_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR (
    reservation.status <> 'reconciliation_required'
    AND reservation.expires_at <= now()
  ) THEN
    RAISE EXCEPTION 'reactivation checkout reservation expired' USING ERRCODE = 'P0001';
  END IF;
  IF reservation.status = 'reconciliation_required' AND reservation.provider IS NULL THEN
    RAISE EXCEPTION 'reactivation checkout reconciliation provider missing' USING ERRCODE = 'P0001';
  END IF;
  IF reservation.provider IS NOT NULL AND reservation.provider <> p_provider THEN
    RAISE EXCEPTION 'reactivation checkout provider already selected' USING ERRCODE = 'P0001';
  END IF;

  UPDATE membership_reactivation_checkout_reservations
  SET provider = p_provider,
      status = CASE WHEN status = 'open' THEN 'provider_selected' ELSE status END,
      updated_at = now()
  WHERE id = p_reservation_id
  RETURNING * INTO reservation;

  RETURN reservation;
END;
$$;


ALTER FUNCTION "public"."claim_membership_reactivation_checkout_provider"("p_reservation_id" "uuid", "p_user_id" "uuid", "p_provider" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_plan_one_time_fulfillment_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone,
    "processing_started_at" timestamp with time zone,
    "last_error" "text",
    "delivery_provider" "text",
    "delivery_reference" "text",
    "canonical_content_sha256" "text",
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "personal_plan_one_time_fulfillme_canonical_content_sha256_check" CHECK ((("canonical_content_sha256" IS NULL) OR ("canonical_content_sha256" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "personal_plan_one_time_fulfillment_jobs_attempts_check" CHECK ((("attempts" >= 0) AND ("attempts" <= 5))),
    CONSTRAINT "personal_plan_one_time_fulfillment_jobs_check" CHECK ((("status" = 'processing'::"text") = ("processing_started_at" IS NOT NULL))),
    CONSTRAINT "personal_plan_one_time_fulfillment_jobs_check1" CHECK ((("status" <> 'completed'::"text") OR (("delivery_provider" IS NOT NULL) AND ("delivery_reference" IS NOT NULL) AND ("canonical_content_sha256" IS NOT NULL) AND ("delivered_at" IS NOT NULL)))),
    CONSTRAINT "personal_plan_one_time_fulfillment_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'failed_permanent'::"text"])))
);


ALTER TABLE "public"."personal_plan_one_time_fulfillment_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."personal_plan_one_time_fulfillment_jobs" IS 'Private service-role fulfillment queue for one-time personal-plan confirmation, finalization, and delivery retry state.';



CREATE OR REPLACE FUNCTION "public"."claim_personal_plan_one_time_fulfillment_job"("p_job_id" "uuid", "p_stale_after_minutes" integer DEFAULT 15) RETURNS "public"."personal_plan_one_time_fulfillment_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  claimed public.personal_plan_one_time_fulfillment_jobs%ROWTYPE;
BEGIN
  WITH due AS (
    SELECT id
    FROM public.personal_plan_one_time_fulfillment_jobs
    WHERE id = p_job_id
      AND status IN ('pending', 'failed', 'processing')
      AND attempts < 5
      AND (
        status = 'pending'
        OR (
          status = 'failed'
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        )
        OR (
          status = 'processing'
          AND processing_started_at <= now() - make_interval(mins => p_stale_after_minutes)
        )
      )
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.personal_plan_one_time_fulfillment_jobs job
  SET status = 'processing',
      processing_started_at = now(),
      updated_at = now()
  FROM due
  WHERE job.id = due.id
  RETURNING job.* INTO claimed;

  RETURN claimed;
END;
$$;


ALTER FUNCTION "public"."claim_personal_plan_one_time_fulfillment_job"("p_job_id" "uuid", "p_stale_after_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_personal_plan_one_time_fulfillment_jobs"("p_limit" integer DEFAULT 10, "p_stale_after_minutes" integer DEFAULT 15) RETURNS SETOF "public"."personal_plan_one_time_fulfillment_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM public.personal_plan_one_time_fulfillment_jobs
    WHERE status IN ('pending', 'failed', 'processing')
      AND attempts < 5
      AND (
        status = 'pending'
        OR (
          status = 'failed'
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        )
        OR (
          status = 'processing'
          AND processing_started_at <= now() - make_interval(mins => p_stale_after_minutes)
        )
      )
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.personal_plan_one_time_fulfillment_jobs job
  SET status = 'processing',
      processing_started_at = now(),
      updated_at = now()
  FROM due
  WHERE job.id = due.id
  RETURNING job.*;
END;
$$;


ALTER FUNCTION "public"."claim_personal_plan_one_time_fulfillment_jobs"("p_limit" integer, "p_stale_after_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_rate_limits"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.rate_limits WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_waitlist_survey"("p_survey_token_hash" "text", "p_survey_response_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_id uuid;
BEGIN
  UPDATE public.waitlist_signups
     SET survey_response_id = p_survey_response_id,
         survey_completed_at = COALESCE(survey_completed_at, now()),
         updated_at = now()
   WHERE survey_token_hash = p_survey_token_hash
     AND (survey_response_id IS NULL OR survey_response_id = p_survey_response_id)
  RETURNING id INTO target_id;

  IF target_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.waitlist_customerio_outbox (signup_id, event_type, message_id)
  VALUES (target_id, 'waitlist_survey_completed', 'waitlist-survey-completed:' || target_id::text)
  ON CONFLICT (signup_id, event_type) DO NOTHING;
  RETURN target_id;
END;
$$;


ALTER FUNCTION "public"."complete_waitlist_survey"("p_survey_token_hash" "text", "p_survey_response_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_personal_plan_quiz_draft"("p_funnel_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_resume_token_hash" "text", "p_draft" "jsonb") RETURNS TABLE("draft_id" "uuid", "revision" integer, "browser_generation" integer, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE saved public.personal_plan_quiz_drafts%ROWTYPE;
BEGIN
  IF p_resume_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid draft credential' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.funnel_sessions s WHERE s.id = p_funnel_session_id AND s.visitor_id = p_visitor_id AND s.package_key = p_package_key) THEN
    RAISE EXCEPTION 'trusted funnel session unavailable' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.personal_plan_quiz_drafts (resume_token_hash, funnel_session_id, draft, expires_at)
  VALUES (p_resume_token_hash, p_funnel_session_id, p_draft, LEAST(now() + interval '24 hours', now() + interval '7 days'))
  RETURNING * INTO saved;
  RETURN QUERY SELECT saved.id, saved.revision, saved.browser_generation, saved.expires_at;
END; $_$;


ALTER FUNCTION "public"."create_personal_plan_quiz_draft"("p_funnel_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_resume_token_hash" "text", "p_draft" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_waitlist_signup"("p_campaign" "text", "p_normalized_email" "text", "p_first_name" "text", "p_marketing_consent" boolean, "p_attribution" "jsonb", "p_survey_token_hash" "text") RETURNS TABLE("signup_id" "uuid", "created" boolean, "survey_already_completed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_id uuid;
  was_created boolean;
BEGIN
  INSERT INTO public.waitlist_signups AS signup (
    campaign, normalized_email, first_name, marketing_consent, attribution, survey_token_hash
  ) VALUES (
    p_campaign, p_normalized_email, p_first_name, p_marketing_consent,
    COALESCE(p_attribution, '{}'::jsonb), p_survey_token_hash
  )
  ON CONFLICT (campaign, normalized_email) DO UPDATE
     SET updated_at = signup.updated_at
  RETURNING signup.id, (xmax = 0) INTO target_id, was_created;

  INSERT INTO public.waitlist_customerio_outbox (signup_id, event_type, message_id)
  VALUES (target_id, 'waitlist_signup', 'waitlist-signup:' || target_id::text)
  ON CONFLICT ON CONSTRAINT waitlist_customerio_outbox_signup_event_key
  DO NOTHING;

  RETURN QUERY
  SELECT target_id, was_created, signup.survey_completed_at IS NOT NULL
  FROM public.waitlist_signups AS signup
  WHERE signup.id = target_id;
END;
$$;


ALTER FUNCTION "public"."create_waitlist_signup"("p_campaign" "text", "p_normalized_email" "text", "p_first_name" "text", "p_marketing_consent" boolean, "p_attribution" "jsonb", "p_survey_token_hash" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_waitlist_signup"("p_campaign" "text", "p_normalized_email" "text", "p_first_name" "text", "p_marketing_consent" boolean, "p_attribution" "jsonb", "p_survey_token_hash" "text") IS 'Creates an authoritative waitlist signup and its Customer.io outbox event atomically.';



CREATE OR REPLACE FUNCTION "public"."delete_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_client_session_id" "uuid", "p_client_revision" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_user_id uuid := p_user_id; v_log public.routine_logs%ROWTYPE; v_day jsonb; v_inserted_rows integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'server_boundary_user_required', 'error', 'Server user context is required.');
  END IF;
  IF p_logged_on IS NULL OR p_timezone IS NULL OR p_client_session_id IS NULL OR p_client_revision IS NULL OR p_client_revision < 1 OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) OR p_logged_on > (now() AT TIME ZONE p_timezone)::date OR p_logged_on < (now() AT TIME ZONE p_timezone)::date - 7 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_date', 'error', 'Ungültiges Datum.');
  END IF;
  INSERT INTO public.routine_logs (user_id, logged_on, timezone, day_type, client_session_id, client_revision, deleted_at)
  VALUES (v_user_id, p_logged_on, p_timezone, 'none', p_client_session_id, p_client_revision, now()) ON CONFLICT (user_id, logged_on) DO NOTHING;
  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  SELECT * INTO v_log FROM public.routine_logs WHERE user_id = v_user_id AND logged_on = p_logged_on FOR UPDATE;
  IF v_inserted_rows > 0 THEN RETURN jsonb_build_object('ok', true, 'code', 'deleted', 'day', jsonb_build_object('loggedOn', v_log.logged_on, 'deletedAt', v_log.deleted_at)); END IF;
  IF v_log.client_session_id = p_client_session_id AND v_log.client_revision >= p_client_revision THEN RETURN jsonb_build_object('ok', true, 'code', 'stale_revision', 'day', jsonb_build_object('loggedOn', v_log.logged_on, 'deletedAt', v_log.deleted_at)); END IF;
  UPDATE public.routine_logs SET deleted_at = now(), client_session_id = p_client_session_id, client_revision = p_client_revision WHERE id = v_log.id RETURNING jsonb_build_object('loggedOn', logged_on, 'dayType', day_type, 'customActivityName', custom_activity_name, 'deletedAt', deleted_at, 'products', '[]'::jsonb) INTO v_day;
  DELETE FROM public.routine_log_products WHERE routine_log_id = v_log.id;
  RETURN jsonb_build_object('ok', true, 'code', 'deleted', 'day', v_day);
END;
$$;


ALTER FUNCTION "public"."delete_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_client_session_id" "uuid", "p_client_revision" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deny_paypal_expired_order_reset_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'PayPal expired-order reset audit is append-only' USING ERRCODE = '22000';
END;
$$;


ALTER FUNCTION "public"."deny_paypal_expired_order_reset_audit_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_billing_one_time_purchase_consent_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  consent_user_id uuid;
  consent_product_kind text;
BEGIN
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
$$;


ALTER FUNCTION "public"."enforce_billing_one_time_purchase_consent_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_personal_plan_one_time_consent_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  reset_audit_id uuid;
  new_reset_intent_id uuid;
BEGIN
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
$$;


ALTER FUNCTION "public"."enforce_personal_plan_one_time_consent_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_personal_plan_customerio_profile_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.quiz_kind IS DISTINCT FROM 'personal_plan' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.customerio_profile_sync_outbox (
      lead_id,
      completion_event_eligible,
      send_completion_event
    )
    VALUES (
      NEW.id,
      true,
      NEW.marketing_consent IS TRUE
    );
  ELSE
    UPDATE public.customerio_profile_sync_outbox
       SET profile_revision = profile_revision + 1,
           send_completion_event = completion_event_eligible
                                   AND NEW.marketing_consent IS TRUE
                                   AND completion_event_delivered_at IS NULL,
           status = 'pending',
           attempts = 0,
           processing_started_at = NULL,
           next_attempt_at = NULL,
           delivered_at = NULL,
           last_error = NULL,
           updated_at = now()
     WHERE lead_id = NEW.id;

    IF NOT FOUND THEN
      -- The lead predates this outbox. Historical rows are always profile-only.
      INSERT INTO public.customerio_profile_sync_outbox (lead_id)
      VALUES (NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enqueue_personal_plan_customerio_profile_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exchange_personal_plan_quiz_draft"("p_resume_token_hash" "text", "p_replacement_token_hash" "text") RETURNS TABLE("draft_id" "uuid", "draft" "jsonb", "revision" integer, "browser_generation" integer, "expires_at" timestamp with time zone, "visitor_id" "uuid", "session_id" "uuid", "package_key" "text", "funnel_issued_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE saved public.personal_plan_quiz_drafts%ROWTYPE;
BEGIN
  IF p_resume_token_hash !~ '^[0-9a-f]{64}$' OR p_replacement_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
  SELECT * INTO saved FROM public.personal_plan_quiz_drafts d WHERE d.resume_token_hash = p_resume_token_hash
    AND d.status = 'active' AND d.expires_at > now() FOR UPDATE;
  IF saved.id IS NULL THEN RETURN; END IF;
  UPDATE public.personal_plan_quiz_drafts SET resume_token_hash = p_replacement_token_hash,
    browser_generation = saved.browser_generation + 1, revision = saved.revision + 1, updated_at = now(),
    expires_at = LEAST(saved.created_at + interval '7 days', now() + interval '24 hours') WHERE id = saved.id RETURNING * INTO saved;
  RETURN QUERY SELECT saved.id, saved.draft, saved.revision, saved.browser_generation, saved.expires_at,
    s.visitor_id, s.id, s.package_key, s.first_seen_at FROM public.funnel_sessions s WHERE s.id = saved.funnel_session_id;
END; $_$;


ALTER FUNCTION "public"."exchange_personal_plan_quiz_draft"("p_resume_token_hash" "text", "p_replacement_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expand_conditioner_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) RETURNS TABLE("thickness" "text", "protein_moisture_balance" "text")
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  t text;
  c text;
  emitted boolean;
BEGIN
  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    emitted := false;

    FOREACH c IN ARRAY COALESCE(p_concerns, ARRAY[]::text[]) LOOP
      IF c = 'feuchtigkeit' THEN
        thickness := t;
        protein_moisture_balance := 'snaps';
        RETURN NEXT;
        emitted := true;
      ELSIF c = 'protein' THEN
        thickness := t;
        protein_moisture_balance := 'stretches_stays';
        RETURN NEXT;
        emitted := true;
      ELSIF c = 'performance' THEN
        thickness := t;
        protein_moisture_balance := 'stretches_bounces';
        RETURN NEXT;
        emitted := true;
      END IF;
    END LOOP;

    -- Fallback: if concerns are missing/unknown, keep product eligible
    -- for all balances at this thickness.
    IF NOT emitted THEN
      thickness := t;
      protein_moisture_balance := 'snaps';
      RETURN NEXT;

      thickness := t;
      protein_moisture_balance := 'stretches_bounces';
      RETURN NEXT;

      thickness := t;
      protein_moisture_balance := 'stretches_stays';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."expand_conditioner_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expand_leave_in_eligibility"("p_thicknesses" "text"[], "p_roles" "text"[], "p_care_benefits" "text"[], "p_application_stage" "text"[], "p_provides_heat_protection" boolean, "p_heat_activation_required" boolean) RETURNS TABLE("thickness" "text", "need_bucket" "text", "styling_context" "text")
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  t text;
  bucket text;
  context text;
  buckets text[] := ARRAY[]::text[];
  contexts text[] := ARRAY[]::text[];
BEGIN
  IF p_heat_activation_required OR p_provides_heat_protection THEN
    buckets := array_append(buckets, 'heat_protect');
  END IF;

  IF 'curl_definition' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'curl_definition');
  END IF;

  IF
    'repair' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'protein' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'repair');
  END IF;

  IF
    'moisture' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'anti_frizz' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'detangling' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'moisture_anti_frizz');
  END IF;

  IF 'shine' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'shine_protect');
  END IF;

  IF p_heat_activation_required THEN
    contexts := ARRAY['heat_style'];
  ELSE
    IF
      p_provides_heat_protection
      OR 'pre_heat' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'heat_style');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'air_dry');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'post_style' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'styling_prep' = ANY(COALESCE(p_roles, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'non_heat_style');
    END IF;
  END IF;

  IF array_length(contexts, 1) IS NULL THEN
    contexts := ARRAY['air_dry', 'non_heat_style'];
  END IF;

  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    FOREACH bucket IN ARRAY buckets LOOP
      IF bucket = 'heat_protect' THEN
        thickness := t;
        need_bucket := bucket;
        styling_context := 'heat_style';
        RETURN NEXT;
        CONTINUE;
      END IF;

      FOREACH context IN ARRAY contexts LOOP
        IF context = 'heat_style' THEN
          CONTINUE;
        END IF;

        thickness := t;
        need_bucket := bucket;
        styling_context := context;
        RETURN NEXT;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."expand_leave_in_eligibility"("p_thicknesses" "text"[], "p_roles" "text"[], "p_care_benefits" "text"[], "p_application_stage" "text"[], "p_provides_heat_protection" boolean, "p_heat_activation_required" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expand_oil_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) RETURNS TABLE("thickness" "text", "oil_subtype" "text")
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  t text;
  c text;
BEGIN
  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    FOREACH c IN ARRAY COALESCE(p_concerns, ARRAY[]::text[]) LOOP
      IF c IN ('natuerliches-oel', 'styling-oel', 'trocken-oel') THEN
        thickness := t;
        oil_subtype := c;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."expand_oil_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_personal_plan_one_time_access_state"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  purchase_row public.billing_one_time_purchases%ROWTYPE;
  consent_row public.personal_plan_one_time_checkout_consents%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role'
    AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized to read one-time access state' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO purchase_row
  FROM public.billing_one_time_purchases
  WHERE user_id = p_user_id
    AND product_kind = 'personal_plan_once'
  ORDER BY (status = 'paid') DESC, updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'none';
  END IF;

  SELECT *
  INTO consent_row
  FROM public.personal_plan_one_time_checkout_consents
  WHERE id = purchase_row.consent_id;

  IF purchase_row.status <> 'paid' THEN
    RETURN 'revoked';
  END IF;

  IF consent_row.id IS NULL
    OR purchase_row.user_id IS NULL
    OR consent_row.user_id IS NULL
    OR purchase_row.user_id IS DISTINCT FROM consent_row.user_id
    OR purchase_row.consent_id IS DISTINCT FROM consent_row.id
    OR consent_row.product_kind <> 'personal_plan_once'
    OR consent_row.confirmation_status NOT IN ('sent', 'delivered')
    OR consent_row.generation_started_at IS NULL
    OR consent_row.generation_completed_at IS NULL
    OR consent_row.generated_content_sha256 IS NULL
    OR consent_row.delivery_provider IS NULL
    OR consent_row.delivery_reference IS NULL
    OR consent_row.delivered_at IS NULL THEN
    RETURN 'paid_pending';
  END IF;

  RETURN 'active';
END;
$$;


ALTER FUNCTION "public"."get_personal_plan_one_time_access_state"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_personal_plan_artifact_to_user"("p_lead_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("artifact_id" "uuid", "canonical_profile" "jsonb", "fallback_metadata" "jsonb", "locked_plan" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  artifact public.personal_plan_prepared_artifacts%ROWTYPE;
BEGIN
  SELECT artifacts.*
    INTO artifact
    FROM public.personal_plan_prepared_artifacts AS artifacts
   WHERE artifacts.lead_id = p_lead_id
     AND artifacts.status = 'attached'
   FOR UPDATE;

  IF artifact.id IS NULL THEN
    RAISE EXCEPTION 'personal-plan artifact not found for lead' USING ERRCODE = 'P0002';
  END IF;
  IF artifact.user_id IS NOT NULL AND artifact.user_id <> p_user_id THEN
    RAISE EXCEPTION 'personal-plan artifact belongs to another user' USING ERRCODE = '23505';
  END IF;

  IF artifact.user_id IS NULL THEN
    UPDATE public.personal_plan_prepared_artifacts
       SET user_id = p_user_id,
           user_attached_at = now()
     WHERE id = artifact.id;
  END IF;

  RETURN QUERY
    SELECT artifact.id, artifact.canonical_profile, artifact.fallback_metadata, artifact.locked_plan;
END;
$$;


ALTER FUNCTION "public"."link_personal_plan_artifact_to_user"("p_lead_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_conditioner_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_protein_moisture_balance" "text", "match_count" integer DEFAULT 5, "category_filter" "text"[] DEFAULT ARRAY['Conditioner'::"text", 'Conditioner Profi'::"text", 'Conditioner (Drogerie)'::"text"]) RETURNS TABLE("id" "uuid", "name" "text", "brand" "text", "description" "text", "short_description" "text", "tom_take" "text", "category" "text", "affiliate_link" "text", "image_url" "text", "price_eur" numeric, "tags" "text"[], "suitable_thicknesses" "text"[], "suitable_concerns" "text"[], "is_active" boolean, "sort_order" integer, "similarity" double precision, "profile_score" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF user_thickness IS NULL OR user_protein_moisture_balance IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.brand,
    p.description,
    p.short_description,
    p.tom_take,
    p.category,
    p.affiliate_link,
    p.image_url,
    p.price_eur,
    p.tags,
    p.suitable_thicknesses,
    p.suitable_concerns,
    p.is_active,
    p.sort_order,
    (1 - (p.embedding <=> query_embedding))::float AS similarity,
    1.0::float AS profile_score,
    (1 - (p.embedding <=> query_embedding))::float AS combined_score
  FROM public.products p
  JOIN public.product_conditioner_specs c
    ON c.product_id = p.id
   AND c.thickness = user_thickness
   AND c.protein_moisture_balance = user_protein_moisture_balance
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.sort_order ASC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_conditioner_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_protein_moisture_balance" "text", "match_count" integer, "category_filter" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_content_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 5, "source_filter" "text" DEFAULT NULL::"text", "metadata_filter" "jsonb" DEFAULT NULL::"jsonb", "source_types" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "source_type" "text", "source_name" "text", "chunk_index" integer, "content" "text", "metadata" "jsonb", "similarity" double precision, "weighted_similarity" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        cc.id,
        cc.source_type,
        cc.source_name,
        cc.chunk_index,
        cc.content,
        cc.metadata,
        (1 - (cc.embedding <=> query_embedding))::float AS similarity,
        (
            (1 - (cc.embedding <=> query_embedding))
            * CASE cc.source_type
                WHEN 'book'          THEN 1.4
                WHEN 'product_list'  THEN 1.4
                WHEN 'qa'            THEN 1.0
                WHEN 'narrative'     THEN 1.0
                WHEN 'community_qa'  THEN 1.0
                WHEN 'transcript'    THEN 0.8
                WHEN 'live_call'     THEN 0.8
                WHEN 'product_links' THEN 0.8
                ELSE 1.0
              END
        )::float AS weighted_similarity
    FROM content_chunks cc
    WHERE
        cc.embedding IS NOT NULL
        AND (1 - (cc.embedding <=> query_embedding)) >= match_threshold
        AND (source_filter IS NULL OR cc.source_type = source_filter)
        AND (metadata_filter IS NULL OR cc.metadata @> metadata_filter)
        AND (source_types IS NULL OR cc.source_type = ANY(source_types))
    ORDER BY weighted_similarity DESC
    LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_content_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_content_chunks_lexical"("query_text" "text", "match_count" integer DEFAULT 20, "source_filter" "text" DEFAULT NULL::"text", "metadata_filter" "jsonb" DEFAULT NULL::"jsonb", "source_types" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "source_type" "text", "source_name" "text", "chunk_index" integer, "content" "text", "metadata" "jsonb", "rank" double precision, "weighted_rank" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    tsq tsquery;
BEGIN
    -- Build tsquery from plain text using German config
    -- plainto_tsquery handles multi-word input safely
    tsq := plainto_tsquery('german', query_text);

    -- If the query produces an empty tsquery, try simple config as fallback
    -- (handles INCI names, brand names, English terms that German dict strips)
    IF tsq = ''::tsquery THEN
        tsq := plainto_tsquery('simple', query_text);
    END IF;

    -- Still empty → no results
    IF tsq = ''::tsquery THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        cc.id,
        cc.source_type,
        cc.source_name,
        cc.chunk_index,
        cc.content,
        cc.metadata,
        ts_rank_cd(cc.search_vector, tsq, 1)::float AS rank,
        (
            ts_rank_cd(cc.search_vector, tsq, 1)
            * CASE cc.source_type
                WHEN 'book'          THEN 1.4
                WHEN 'product_list'  THEN 1.4
                WHEN 'qa'            THEN 1.0
                WHEN 'narrative'     THEN 1.0
                WHEN 'community_qa'  THEN 1.0
                WHEN 'transcript'    THEN 0.8
                WHEN 'live_call'     THEN 0.8
                WHEN 'product_links' THEN 0.8
                ELSE 1.0
              END
        )::float AS weighted_rank
    FROM content_chunks cc
    WHERE
        cc.search_vector @@ tsq
        AND (source_filter IS NULL OR cc.source_type = source_filter)
        AND (metadata_filter IS NULL OR cc.metadata @> metadata_filter)
        AND (source_types IS NULL OR cc.source_type = ANY(source_types))
    ORDER BY weighted_rank DESC
    LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_content_chunks_lexical"("query_text" "text", "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_leave_in_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_need_bucket" "text", "user_styling_context" "text", "match_count" integer DEFAULT 10, "category_filter" "text"[] DEFAULT ARRAY['Leave-in'::"text", 'Leave-In'::"text", 'Leave in'::"text", 'leave_in'::"text"]) RETURNS TABLE("id" "uuid", "name" "text", "brand" "text", "description" "text", "short_description" "text", "tom_take" "text", "category" "text", "affiliate_link" "text", "image_url" "text", "price_eur" numeric, "tags" "text"[], "suitable_thicknesses" "text"[], "suitable_concerns" "text"[], "is_active" boolean, "sort_order" integer, "similarity" double precision, "profile_score" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF user_thickness IS NULL OR user_need_bucket IS NULL OR user_styling_context IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.brand,
    p.description,
    p.short_description,
    p.tom_take,
    p.category,
    p.affiliate_link,
    p.image_url,
    p.price_eur,
    p.tags,
    p.suitable_thicknesses,
    p.suitable_concerns,
    p.is_active,
    p.sort_order,
    (1 - (p.embedding <=> query_embedding))::float AS similarity,
    1.0::float AS profile_score,
    (1 - (p.embedding <=> query_embedding))::float AS combined_score
  FROM public.products p
  JOIN public.product_leave_in_eligibility e
    ON e.product_id = p.id
   AND e.thickness = user_thickness
   AND e.need_bucket = user_need_bucket
   AND e.styling_context = user_styling_context
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.price_eur ASC NULLS LAST
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_leave_in_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_need_bucket" "text", "user_styling_context" "text", "match_count" integer, "category_filter" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "user_hair_texture" "text" DEFAULT NULL::"text", "user_concerns" "text"[] DEFAULT '{}'::"text"[], "match_count" integer DEFAULT 5, "category_filter" "text"[] DEFAULT NULL::"text"[], "user_thickness" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "brand" "text", "description" "text", "short_description" "text", "tom_take" "text", "category" "text", "affiliate_link" "text", "image_url" "text", "price_eur" numeric, "currency" "text", "tags" "text"[], "suitable_thicknesses" "text"[], "suitable_concerns" "text"[], "is_active" boolean, "lifecycle_status" "text", "sort_order" integer, "similarity" double precision, "profile_score" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    effective_thickness text := COALESCE(user_thickness, user_hair_texture);
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.brand,
        p.description,
        p.short_description,
        p.tom_take,
        p.category,
        p.affiliate_link,
        p.image_url,
        p.price_eur,
        p.currency,
        p.tags,
        p.suitable_thicknesses,
        p.suitable_concerns,
        p.is_active,
        p.lifecycle_status,
        p.sort_order,
        (1 - (p.embedding <=> query_embedding))::float AS similarity,
        (
            COALESCE(
                CASE
                    WHEN effective_thickness IS NOT NULL
                         AND array_length(p.suitable_thicknesses, 1) > 0
                         AND effective_thickness = ANY(p.suitable_thicknesses)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS profile_score,
        (
            0.6 * (1 - (p.embedding <=> query_embedding))::float
            +
            0.4 * COALESCE(
                CASE
                    WHEN effective_thickness IS NOT NULL
                         AND array_length(p.suitable_thicknesses, 1) > 0
                         AND effective_thickness = ANY(p.suitable_thicknesses)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS combined_score
    FROM products p
    WHERE
        p.is_active = true
        AND p.is_chaarlie_recommended = true
        AND p.lifecycle_status = 'active'
        AND p.embedding IS NOT NULL
        AND (category_filter IS NULL OR p.category = ANY(category_filter))
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "user_hair_texture" "text", "user_concerns" "text"[], "match_count" integer, "category_filter" "text"[], "user_thickness" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_shampoo_bucket" "text", "match_count" integer DEFAULT 5, "category_filter" "text"[] DEFAULT ARRAY['Shampoo'::"text", 'Shampoo Profi'::"text"]) RETURNS TABLE("id" "uuid", "name" "text", "brand" "text", "description" "text", "short_description" "text", "tom_take" "text", "category" "text", "affiliate_link" "text", "image_url" "text", "price_eur" numeric, "tags" "text"[], "suitable_thicknesses" "text"[], "suitable_concerns" "text"[], "is_active" boolean, "sort_order" integer, "similarity" double precision, "profile_score" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF user_thickness IS NULL OR user_shampoo_bucket IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.brand,
    p.description,
    p.short_description,
    p.tom_take,
    p.category,
    p.affiliate_link,
    p.image_url,
    p.price_eur,
    p.tags,
    p.suitable_thicknesses,
    p.suitable_concerns,
    p.is_active,
    p.sort_order,
    (1 - (p.embedding <=> query_embedding))::float AS similarity,
    1.0::float AS profile_score,
    (1 - (p.embedding <=> query_embedding))::float AS combined_score
  FROM public.products p
  JOIN public.product_shampoo_specs s
    ON s.product_id = p.id
   AND s.thickness = user_thickness
   AND s.shampoo_bucket = user_shampoo_bucket
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.price_eur ASC NULLS LAST
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_shampoo_bucket" "text", "match_count" integer, "category_filter" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_scalp_type" "text", "user_scalp_condition" "text", "match_count" integer DEFAULT 5, "category_filter" "text"[] DEFAULT ARRAY['Shampoo'::"text", 'Shampoo Profi'::"text"]) RETURNS TABLE("id" "uuid", "name" "text", "brand" "text", "description" "text", "short_description" "text", "tom_take" "text", "category" "text", "affiliate_link" "text", "image_url" "text", "price_eur" numeric, "tags" "text"[], "suitable_thicknesses" "text"[], "suitable_concerns" "text"[], "is_active" boolean, "sort_order" integer, "similarity" double precision, "profile_score" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  derived_bucket text;
BEGIN
  IF user_scalp_condition IS NOT NULL AND user_scalp_condition <> 'none' THEN
    IF user_scalp_condition = 'dandruff' THEN
      derived_bucket := 'schuppen';
    ELSIF user_scalp_condition = 'irritated' THEN
      derived_bucket := 'irritationen';
    ELSIF user_scalp_condition = 'dry_flakes' THEN
      derived_bucket := 'trocken';
    END IF;
  END IF;

  IF derived_bucket IS NULL THEN
    IF user_scalp_type = 'balanced' THEN
      derived_bucket := 'normal';
    ELSIF user_scalp_type = 'oily' THEN
      derived_bucket := 'dehydriert-fettig';
    ELSIF user_scalp_type = 'dry' THEN
      derived_bucket := 'trocken';
    END IF;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.match_shampoo_products(
    query_embedding := query_embedding,
    user_thickness := user_thickness,
    user_shampoo_bucket := derived_bucket,
    match_count := match_count,
    category_filter := category_filter
  );
END;
$$;


ALTER FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_scalp_type" "text", "user_scalp_condition" "text", "match_count" integer, "category_filter" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_approve_reviewed_product"("p_submission_id" "uuid", "p_final_payload" "jsonb", "p_spec_operations" "jsonb", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone DEFAULT "now"(), "p_review_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
  product_payload jsonb := p_final_payload -> 'product';
  v_brand_id uuid;
  v_line_id uuid;
  v_category_label text;
  new_product_id uuid;
  operation jsonb;
  operation_table text;
  identifier_row jsonb;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status <> 'ready_for_review' THEN
    RAISE EXCEPTION 'approval requires ready_for_review submission';
  END IF;

  IF product_payload ->> 'category_key' IS DISTINCT FROM submission_row.category THEN
    RAISE EXCEPTION 'approved product category must match submission category';
  END IF;

  v_brand_id := public.product_intake_get_or_create_brand(product_payload ->> 'canonical_brand');
  v_line_id := public.product_intake_get_or_create_product_line(v_brand_id, product_payload ->> 'product_line');

  SELECT display_name_de
  INTO v_category_label
  FROM public.product_categories
  WHERE key = submission_row.category
    AND is_intake_supported = true;

  IF v_category_label IS NULL THEN
    RAISE EXCEPTION 'unsupported product intake category';
  END IF;

	  IF EXISTS (
	    SELECT 1
	    FROM public.products product
	    WHERE product.is_active = true
	      AND product.category_key = submission_row.category
	      AND product.brand_id = v_brand_id
	      AND product.product_line_id IS NOT DISTINCT FROM v_line_id
	      AND public.product_intake_review_normalize_identity_text(product.name)
	        IN (
	          public.product_intake_review_normalize_identity_text(product_payload ->> 'clean_name'),
	          public.product_intake_review_normalize_identity_text(
	            concat_ws(' ', product_payload ->> 'canonical_brand', product_payload ->> 'clean_name')
	          ),
	          public.product_intake_review_normalize_identity_text(
	            concat_ws(
	              ' ',
	              product_payload ->> 'canonical_brand',
	              product_payload ->> 'product_line',
	              product_payload ->> 'clean_name'
	            )
	          ),
	          public.product_intake_review_normalize_identity_text(
	            concat_ws(' ', product_payload ->> 'product_line', product_payload ->> 'clean_name')
	          )
	        )
	  ) THEN
	    RAISE EXCEPTION 'exact product already exists; use link-existing';
	  END IF;

  IF EXISTS (
    SELECT 1
	    FROM jsonb_array_elements(COALESCE(p_final_payload -> 'identifiers', '[]'::jsonb)) AS incoming(identifier)
	    JOIN public.product_identifiers existing
	      ON (
	        existing.identifier_type = incoming.identifier ->> 'type'
	        OR (
	          existing.identifier_type IN ('ean', 'gtin', 'barcode')
	          AND incoming.identifier ->> 'type' IN ('ean', 'gtin', 'barcode')
	        )
	      )
	     AND existing.normalized_identifier_value =
	       public.product_intake_review_normalize_identifier_value(
	         incoming.identifier ->> 'type',
	         incoming.identifier ->> 'value'
	       )
    JOIN public.products product
      ON product.id = existing.product_id
    WHERE product.is_active = true
  ) THEN
    RAISE EXCEPTION 'identifier already exists; use link-existing';
  END IF;

  INSERT INTO public.products (
    name,
    brand,
    category,
    affiliate_link,
    image_url,
    price_eur,
    currency,
    tags,
    suitable_thicknesses,
    suitable_concerns,
    is_active,
    lifecycle_status,
    category_key,
    brand_id,
    product_line_id,
    origin,
    is_chaarlie_recommended,
    purchase_link_status,
    purchase_link_checked_at,
    price_checked_at
	  )
	  VALUES (
	    concat_ws(
	      ' ',
	      product_payload ->> 'canonical_brand',
	      product_payload ->> 'product_line',
	      product_payload ->> 'clean_name'
	    ),
	    product_payload ->> 'canonical_brand',
    v_category_label,
    product_payload ->> 'affiliate_link',
    product_payload ->> 'image_url',
    (product_payload ->> 'price_eur')::numeric,
    COALESCE(product_payload ->> 'currency', 'EUR'),
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    true,
    'active',
    submission_row.category,
    v_brand_id,
    v_line_id,
    'user_submitted',
    false,
    product_payload ->> 'purchase_link_status',
    (product_payload ->> 'purchase_link_checked_at')::timestamptz,
    (product_payload ->> 'price_checked_at')::timestamptz
  )
  RETURNING id INTO new_product_id;

  FOR operation IN SELECT * FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb)) LOOP
    operation_table := operation ->> 'table';

    IF operation_table = 'product_shampoo_specs' THEN
      INSERT INTO public.product_shampoo_specs (
        product_id,
        thickness,
        shampoo_bucket,
        scalp_route,
        cleansing_intensity
      )
      SELECT
        new_product_id,
        row_data.thickness,
        row_data.shampoo_bucket,
        row_data.scalp_route,
        row_data.cleansing_intensity
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        shampoo_bucket text,
        scalp_route text,
        cleansing_intensity text
      )
      ON CONFLICT (product_id, thickness, shampoo_bucket) DO UPDATE
        SET scalp_route = EXCLUDED.scalp_route,
            cleansing_intensity = EXCLUDED.cleansing_intensity,
            updated_at = now();
    ELSIF operation_table = 'product_conditioner_specs' THEN
      INSERT INTO public.product_conditioner_specs (
        product_id,
        thickness,
        protein_moisture_balance
      )
      SELECT new_product_id, row_data.thickness, row_data.protein_moisture_balance
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        protein_moisture_balance text
      )
      ON CONFLICT (product_id, thickness, protein_moisture_balance) DO NOTHING;
    ELSIF operation_table = 'product_conditioner_rerank_specs' THEN
      INSERT INTO public.product_conditioner_rerank_specs (
        product_id,
        weight,
        repair_level,
        balance_direction,
        ingredient_flags
      )
      SELECT
        new_product_id,
        row_data.weight,
        row_data.repair_level,
        row_data.balance_direction,
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        weight text,
        repair_level text,
        balance_direction text,
        ingredient_flags text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET weight = EXCLUDED.weight,
            repair_level = EXCLUDED.repair_level,
            balance_direction = EXCLUDED.balance_direction,
            ingredient_flags = EXCLUDED.ingredient_flags,
            updated_at = now();
    ELSIF operation_table = 'product_mask_specs' THEN
      INSERT INTO public.product_mask_specs (
        product_id,
        weight,
        concentration,
        balance_direction,
        ingredient_flags
      )
      SELECT
        new_product_id,
        row_data.weight,
        row_data.concentration,
        row_data.balance_direction,
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        weight text,
        concentration text,
        balance_direction text,
        ingredient_flags text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET weight = EXCLUDED.weight,
            concentration = EXCLUDED.concentration,
            balance_direction = EXCLUDED.balance_direction,
            ingredient_flags = EXCLUDED.ingredient_flags,
            updated_at = now();
    ELSIF operation_table = 'product_leave_in_specs' THEN
      INSERT INTO public.product_leave_in_specs (
        product_id,
        format,
        weight,
        roles,
        provides_heat_protection,
        heat_protection_max_c,
        heat_activation_required,
        care_benefits,
        ingredient_flags,
        application_stage
      )
      SELECT
        new_product_id,
        row_data.format,
        row_data.weight,
        COALESCE(row_data.roles, ARRAY[]::text[]),
        row_data.provides_heat_protection,
        row_data.heat_protection_max_c,
        row_data.heat_activation_required,
        COALESCE(row_data.care_benefits, ARRAY[]::text[]),
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[]),
        COALESCE(row_data.application_stage, ARRAY['towel_dry']::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        format text,
        weight text,
        roles text[],
        provides_heat_protection boolean,
        heat_protection_max_c integer,
        heat_activation_required boolean,
        care_benefits text[],
        ingredient_flags text[],
        application_stage text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET format = EXCLUDED.format,
            weight = EXCLUDED.weight,
            roles = EXCLUDED.roles,
            provides_heat_protection = EXCLUDED.provides_heat_protection,
            heat_protection_max_c = EXCLUDED.heat_protection_max_c,
            heat_activation_required = EXCLUDED.heat_activation_required,
            care_benefits = EXCLUDED.care_benefits,
            ingredient_flags = EXCLUDED.ingredient_flags,
            application_stage = EXCLUDED.application_stage,
            updated_at = now();
    ELSIF operation_table = 'product_leave_in_fit_specs' THEN
      INSERT INTO public.product_leave_in_fit_specs (
        product_id,
        weight,
        conditioner_relationship,
        care_benefits
      )
      SELECT
        new_product_id,
        row_data.weight,
        row_data.conditioner_relationship,
        COALESCE(row_data.care_benefits, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        weight text,
        conditioner_relationship text,
        care_benefits text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET weight = EXCLUDED.weight,
            conditioner_relationship = EXCLUDED.conditioner_relationship,
            care_benefits = EXCLUDED.care_benefits,
            updated_at = now();
    ELSIF operation_table = 'product_leave_in_eligibility' THEN
      INSERT INTO public.product_leave_in_eligibility (
        product_id,
        thickness,
        need_bucket,
        styling_context
      )
      SELECT new_product_id, row_data.thickness, row_data.need_bucket, row_data.styling_context
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        need_bucket text,
        styling_context text
      )
      ON CONFLICT (product_id, thickness, need_bucket, styling_context) DO NOTHING;
    ELSIF operation_table = 'product_oil_eligibility' THEN
      INSERT INTO public.product_oil_eligibility (
        product_id,
        thickness,
        oil_subtype,
        oil_purpose,
        ingredient_flags
      )
      SELECT
        new_product_id,
        row_data.thickness,
        row_data.oil_subtype,
        row_data.oil_purpose,
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        oil_subtype text,
        oil_purpose text,
        ingredient_flags text[]
      )
      ON CONFLICT (product_id, thickness, oil_subtype) DO UPDATE
        SET oil_purpose = EXCLUDED.oil_purpose,
            ingredient_flags = EXCLUDED.ingredient_flags,
            updated_at = now();
    ELSIF operation_table = 'product_dry_shampoo_specs' THEN
      INSERT INTO public.product_dry_shampoo_specs (
        product_id,
        primary_effect,
        hair_color_fit,
        scalp_sensitivity_fit,
        format
      )
      SELECT
        new_product_id,
        row_data.primary_effect,
        row_data.hair_color_fit,
        row_data.scalp_sensitivity_fit,
        row_data.format
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        primary_effect text,
        hair_color_fit text,
        scalp_sensitivity_fit text,
        format text
      )
      ON CONFLICT (product_id) DO UPDATE
        SET primary_effect = EXCLUDED.primary_effect,
            hair_color_fit = EXCLUDED.hair_color_fit,
            scalp_sensitivity_fit = EXCLUDED.scalp_sensitivity_fit,
            format = EXCLUDED.format,
            updated_at = now();
    ELSIF operation_table = 'product_deep_cleansing_shampoo_specs' THEN
      INSERT INTO public.product_deep_cleansing_shampoo_specs (
        product_id,
        scalp_type_focus,
        reset_intensity,
        reset_focus,
        color_treated_suitability
      )
      SELECT
        new_product_id,
        row_data.scalp_type_focus,
        row_data.reset_intensity,
        row_data.reset_focus,
        row_data.color_treated_suitability
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        scalp_type_focus text,
        reset_intensity text,
        reset_focus text,
        color_treated_suitability text
      )
      ON CONFLICT (product_id) DO UPDATE
        SET scalp_type_focus = EXCLUDED.scalp_type_focus,
            reset_intensity = EXCLUDED.reset_intensity,
            reset_focus = EXCLUDED.reset_focus,
            color_treated_suitability = EXCLUDED.color_treated_suitability,
            updated_at = now();
    ELSIF operation_table = 'product_bondbuilder_specs' THEN
      INSERT INTO public.product_bondbuilder_specs (
        product_id,
        bond_repair_intensity,
        application_mode,
        bond_repair_axis,
        treatment_mode,
        product_format,
        usage_protocol
      )
      SELECT
        new_product_id,
        row_data.bond_repair_intensity,
        row_data.application_mode,
        row_data.bond_repair_axis,
        row_data.treatment_mode,
        row_data.product_format,
        row_data.usage_protocol
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        bond_repair_intensity text,
        application_mode text,
        bond_repair_axis text,
        treatment_mode text,
        product_format text,
        usage_protocol text
      )
      ON CONFLICT (product_id) DO UPDATE
        SET bond_repair_intensity = EXCLUDED.bond_repair_intensity,
            application_mode = EXCLUDED.application_mode,
            bond_repair_axis = EXCLUDED.bond_repair_axis,
            treatment_mode = EXCLUDED.treatment_mode,
            product_format = EXCLUDED.product_format,
            usage_protocol = EXCLUDED.usage_protocol,
            updated_at = now();
    ELSE
      RAISE EXCEPTION 'unsupported product intake spec operation table: %', operation_table;
    END IF;
  END LOOP;

  FOR identifier_row IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_final_payload -> 'identifiers', '[]'::jsonb))
  LOOP
    INSERT INTO public.product_identifiers (
      product_id,
      identifier_type,
      identifier_value,
      source
    )
    VALUES (
      new_product_id,
      identifier_row ->> 'type',
      identifier_row ->> 'value',
      COALESCE(identifier_row ->> 'source', 'user_submitted')
    )
    ON CONFLICT (product_id, identifier_type, normalized_identifier_value) DO NOTHING;
  END LOOP;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    FOR UPDATE;
  END IF;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = NULL,
        product_submission_id = NULL,
        match_status = 'text_only',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id;
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'approved',
	      approved_product_id = new_product_id,
	      researched_payload = jsonb_set(researched_payload, '{final}', p_final_payload, true),
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      notification_sent_at = NULL,
	      updated_at = p_reviewed_at
  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = new_product_id,
        product_submission_id = submission_row.id,
        match_status = 'matched',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id
    RETURNING * INTO usage_row;
  END IF;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'usage', CASE WHEN usage_row.id IS NULL THEN NULL ELSE to_jsonb(usage_row) END,
    'product_id', new_product_id,
    'brand_id', v_brand_id,
    'product_line_id', v_line_id
  );
END;
$$;


ALTER FUNCTION "public"."product_intake_approve_reviewed_product"("p_submission_id" "uuid", "p_final_payload" "jsonb", "p_spec_operations" "jsonb", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_auto_enqueue_research_job"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending_review' THEN
    PERFORM public.product_intake_enqueue_research_job(NEW.id, 'source_research');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."product_intake_auto_enqueue_research_job"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_cancel_usage_for_category"("p_user_id" "uuid", "p_category" "text", "p_updated_at" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("category" "text", "usage_id" "uuid", "submission_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  usage_row public.user_product_usage%ROWTYPE;
BEGIN
  SELECT *
  INTO usage_row
  FROM public.user_product_usage AS usage
  WHERE usage.user_id = p_user_id
    AND usage.category = p_category
  FOR UPDATE;

  category := p_category;
  usage_id := usage_row.id;
  submission_id := usage_row.product_submission_id;

  IF usage_row.id IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF submission_id IS NOT NULL THEN
    PERFORM 1
    FROM public.product_submissions AS submission
    WHERE submission.id = submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
    FOR UPDATE;
  END IF;

  DELETE FROM public.user_product_usage
  WHERE id = usage_row.id;

  IF submission_id IS NOT NULL THEN
    UPDATE public.product_submissions AS submission
    SET status = 'cancelled_by_user',
        user_product_usage_id = NULL,
        cleanup_after = COALESCE(cleanup_after, p_updated_at + interval '30 days'),
        updated_at = p_updated_at
    WHERE submission.id = submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
      AND submission.status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
  END IF;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."product_intake_cancel_usage_for_category"("p_user_id" "uuid", "p_category" "text", "p_updated_at" timestamp with time zone) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_intake_research_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "stage" "text" DEFAULT 'identity'::"text" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "locked_by" "text",
    "locked_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "next_run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_error" "text",
    "progress" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_intake_research_jobs_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "product_intake_research_jobs_lock_check" CHECK (((("locked_by" IS NULL) AND ("locked_at" IS NULL)) OR (("locked_by" IS NOT NULL) AND ("locked_at" IS NOT NULL)))),
    CONSTRAINT "product_intake_research_jobs_max_attempts_check" CHECK (("max_attempts" > 0)),
    CONSTRAINT "product_intake_research_jobs_stage_check" CHECK (("stage" = ANY (ARRAY['identity'::"text", 'source_research'::"text", 'property_research'::"text", 'image_search'::"text", 'image_judging'::"text", 'preview_build'::"text", 'rework'::"text", 'publish_preflight'::"text", 'publish'::"text", 'notify'::"text"]))),
    CONSTRAINT "product_intake_research_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'waiting_for_review'::"text", 'waiting_for_rework'::"text", 'publish_preflight'::"text", 'publishing'::"text", 'blocked'::"text", 'failed'::"text", 'done'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."product_intake_research_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_claim_research_jobs"("worker_id" "text", "claim_limit" integer DEFAULT 2, "stale_after" interval DEFAULT '00:10:00'::interval) RETURNS SETOF "public"."product_intake_research_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF worker_id IS NULL OR btrim(worker_id) = '' THEN
    RAISE EXCEPTION 'worker_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF claim_limit IS NULL OR claim_limit < 1 THEN
    RAISE EXCEPTION 'claim_limit must be at least 1'
      USING ERRCODE = '22023';
  END IF;

  IF stale_after IS NULL OR stale_after <= interval '0 seconds' THEN
    RAISE EXCEPTION 'stale_after must be positive'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidate_jobs AS (
    SELECT jobs.id
    FROM public.product_intake_research_jobs AS jobs
    WHERE jobs.next_run_at <= now()
      AND jobs.attempt_count < jobs.max_attempts
      AND (
        jobs.status IN ('queued', 'waiting_for_rework')
        OR (
          jobs.status = 'running'
          AND (
            jobs.locked_at IS NULL
            OR jobs.locked_at <= now() - stale_after
          )
        )
      )
    ORDER BY jobs.priority DESC, jobs.next_run_at ASC, jobs.created_at ASC
    LIMIT claim_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.product_intake_research_jobs AS jobs
  SET status = 'running',
      locked_by = worker_id,
      locked_at = now(),
      started_at = COALESCE(jobs.started_at, now()),
      completed_at = NULL,
      attempt_count = jobs.attempt_count + 1,
      last_error = NULL
  FROM candidate_jobs
  WHERE jobs.id = candidate_jobs.id
  RETURNING jobs.*;
END;
$$;


ALTER FUNCTION "public"."product_intake_claim_research_jobs"("worker_id" "text", "claim_limit" integer, "stale_after" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_enqueue_research_job"("target_submission_id" "uuid", "requested_stage" "text" DEFAULT 'identity'::"text") RETURNS "public"."product_intake_research_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  job_row public.product_intake_research_jobs;
  submission_status text;
BEGIN
  IF requested_stage NOT IN (
    'identity',
    'source_research',
    'property_research',
    'image_search',
    'image_judging',
    'preview_build',
    'rework',
    'publish_preflight',
    'publish',
    'notify'
  ) THEN
    RAISE EXCEPTION 'Invalid product intake research stage: %', requested_stage
      USING ERRCODE = '22023';
  END IF;

  SELECT status
  INTO submission_status
  FROM public.product_submissions
  WHERE id = target_submission_id;

  IF submission_status IS NULL THEN
    RAISE EXCEPTION 'Product submission % does not exist', target_submission_id
      USING ERRCODE = '23503';
  END IF;

  IF submission_status NOT IN (
    'pending_review',
    'researching',
    'ready_for_review',
    'needs_more_info'
  ) THEN
    RAISE EXCEPTION 'Product submission % is not open for research: %', target_submission_id, submission_status
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO job_row
  FROM public.product_intake_research_jobs AS jobs
  WHERE jobs.submission_id = target_submission_id
    AND jobs.status IN (
      'queued',
      'running',
      'waiting_for_review',
      'waiting_for_rework',
      'publish_preflight',
      'publishing',
      'blocked',
      'failed'
    )
  FOR UPDATE;

  IF job_row.id IS NOT NULL THEN
    RETURN job_row;
  END IF;

  INSERT INTO public.product_intake_research_jobs AS jobs (
    submission_id,
    status,
    stage,
    next_run_at,
    last_error
  )
  VALUES (
    target_submission_id,
    'queued',
    requested_stage,
    now(),
    NULL
  )
  RETURNING *
  INTO job_row;

  RETURN job_row;
END;
$$;


ALTER FUNCTION "public"."product_intake_enqueue_research_job"("target_submission_id" "uuid", "requested_stage" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_get_or_create_brand"("p_canonical_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  normalized text := public.product_intake_review_normalize_identity_text(p_canonical_name);
  brand_id uuid;
BEGIN
  IF normalized = '' THEN
    RAISE EXCEPTION 'canonical brand is required';
  END IF;

  INSERT INTO public.brands (canonical_name, normalized_name)
  VALUES (btrim(p_canonical_name), normalized)
  ON CONFLICT (normalized_name) DO UPDATE
    SET canonical_name = EXCLUDED.canonical_name,
        updated_at = now()
  RETURNING id INTO brand_id;

  RETURN brand_id;
END;
$$;


ALTER FUNCTION "public"."product_intake_get_or_create_brand"("p_canonical_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_get_or_create_product_line"("p_brand_id" "uuid", "p_canonical_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  normalized text := public.product_intake_review_normalize_identity_text(p_canonical_name);
  line_id uuid;
BEGIN
  IF p_canonical_name IS NULL OR normalized = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.product_lines (brand_id, canonical_name, normalized_name)
  VALUES (p_brand_id, btrim(p_canonical_name), normalized)
  ON CONFLICT (brand_id, normalized_name) DO UPDATE
    SET canonical_name = EXCLUDED.canonical_name,
        updated_at = now()
  RETURNING id INTO line_id;

  RETURN line_id;
END;
$$;


ALTER FUNCTION "public"."product_intake_get_or_create_product_line"("p_brand_id" "uuid", "p_canonical_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_link_existing_product"("p_submission_id" "uuid", "p_product_id" "uuid", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone DEFAULT "now"(), "p_review_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission is not open for link-existing action';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products product
    WHERE product.id = p_product_id
      AND product.category_key = submission_row.category
      AND product.is_active = true
      AND product.lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'existing product must be active and match submission category';
  END IF;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    FOR UPDATE;
  END IF;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = NULL,
        product_submission_id = NULL,
        match_status = 'text_only',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id;
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'matched_existing',
	      approved_product_id = p_product_id,
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      notification_sent_at = NULL,
	      updated_at = p_reviewed_at
	  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = p_product_id,
        product_submission_id = submission_row.id,
        match_status = 'matched',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id
    RETURNING * INTO usage_row;
  END IF;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'usage', CASE WHEN usage_row.id IS NULL THEN NULL ELSE to_jsonb(usage_row) END
  );
END;
$$;


ALTER FUNCTION "public"."product_intake_link_existing_product"("p_submission_id" "uuid", "p_product_id" "uuid", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_reject_submission"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text" DEFAULT NULL::"text", "p_reviewed_at" timestamp with time zone DEFAULT "now"(), "p_review_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
  deleted_usage_id uuid;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission is not open for rejection';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'user-facing rejection reason is required';
  END IF;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    FOR UPDATE;
  END IF;

  IF usage_row.id IS NOT NULL AND usage_row.product_id IS NULL THEN
    deleted_usage_id := usage_row.id;
    DELETE FROM public.user_product_usage
    WHERE id = usage_row.id;
  ELSIF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_submission_id = NULL,
        match_status = CASE WHEN product_id IS NULL THEN 'text_only' ELSE 'matched' END,
        updated_at = p_reviewed_at
    WHERE id = usage_row.id;
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'rejected',
	      user_product_usage_id = NULL,
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      user_facing_resolution_reason = p_reason,
	      user_facing_next_step = p_next_step,
	      notification_sent_at = NULL,
	      cleanup_after = COALESCE(cleanup_after, p_reviewed_at + interval '30 days'),
	      updated_at = p_reviewed_at
  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'deleted_usage_id', deleted_usage_id
  );
END;
$$;


ALTER FUNCTION "public"."product_intake_reject_submission"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_replace_usage_with_matched_product"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_product_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_updated_at" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  usage_row public.user_product_usage%ROWTYPE;
  old_submission_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = p_product_id
      AND product.category_key = p_category
  ) THEN
    RAISE EXCEPTION 'matched product must belong to usage category';
  END IF;

  IF p_existing_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage AS usage
    WHERE usage.id = p_existing_usage_id
      AND usage.user_id = p_user_id
      AND usage.category = p_category
    FOR UPDATE;

    IF usage_row.id IS NULL THEN
      RAISE EXCEPTION 'existing product usage not found for matched replacement';
    END IF;

    old_submission_id := usage_row.product_submission_id;

    UPDATE public.user_product_usage AS usage
    SET product_name = p_product_name,
        frequency_range = p_frequency_range,
        brand_text = p_brand_text,
        product_id = p_product_id,
        product_submission_id = NULL,
        match_status = 'matched',
        intake_method = p_intake_method,
        source = p_source,
        front_image_path = NULL,
        updated_at = p_updated_at
    WHERE usage.id = usage_row.id
    RETURNING * INTO usage_row;
  ELSE
    INSERT INTO public.user_product_usage (
      user_id,
      category,
      product_name,
      frequency_range,
      brand_text,
      product_id,
      product_submission_id,
      match_status,
      intake_method,
      source,
      front_image_path,
      updated_at
    )
    VALUES (
      p_user_id,
      p_category,
      p_product_name,
      p_frequency_range,
      p_brand_text,
      p_product_id,
      NULL,
      'matched',
      p_intake_method,
      p_source,
      NULL,
      p_updated_at
    )
    RETURNING * INTO usage_row;
  END IF;

  IF old_submission_id IS NOT NULL THEN
    UPDATE public.product_submissions AS submission
    SET status = 'cancelled_by_user',
        user_product_usage_id = NULL,
        cleanup_after = COALESCE(cleanup_after, p_updated_at + interval '30 days'),
        updated_at = p_updated_at
    WHERE submission.id = old_submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
      AND submission.status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
  END IF;

  RETURN to_jsonb(usage_row);
END;
$$;


ALTER FUNCTION "public"."product_intake_replace_usage_with_matched_product"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_product_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_updated_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_replace_usage_with_pending_submission"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_submission_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_front_image_path" "text", "p_updated_at" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  usage_row public.user_product_usage%ROWTYPE;
  submission_row public.product_submissions%ROWTYPE;
  old_submission_id uuid;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions AS submission
  WHERE submission.id = p_submission_id
    AND submission.user_id = p_user_id
    AND submission.category = p_category
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'pending product submission not found for usage replacement';
  END IF;

  IF submission_row.status <> 'pending_review' THEN
    RAISE EXCEPTION 'usage replacement requires a pending product submission';
  END IF;

  IF p_existing_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage AS usage
    WHERE usage.id = p_existing_usage_id
      AND usage.user_id = p_user_id
      AND usage.category = p_category
    FOR UPDATE;

    IF usage_row.id IS NULL THEN
      RAISE EXCEPTION 'existing product usage not found for pending replacement';
    END IF;

    old_submission_id := usage_row.product_submission_id;

    UPDATE public.user_product_usage AS usage
    SET product_name = p_product_name,
        frequency_range = p_frequency_range,
        brand_text = p_brand_text,
        product_id = NULL,
        product_submission_id = p_submission_id,
        match_status = 'pending_review',
        intake_method = p_intake_method,
        source = p_source,
        front_image_path = p_front_image_path,
        updated_at = p_updated_at
    WHERE usage.id = usage_row.id
    RETURNING * INTO usage_row;
  ELSE
    INSERT INTO public.user_product_usage (
      user_id,
      category,
      product_name,
      frequency_range,
      brand_text,
      product_id,
      product_submission_id,
      match_status,
      intake_method,
      source,
      front_image_path,
      updated_at
    )
    VALUES (
      p_user_id,
      p_category,
      p_product_name,
      p_frequency_range,
      p_brand_text,
      NULL,
      p_submission_id,
      'pending_review',
      p_intake_method,
      p_source,
      p_front_image_path,
      p_updated_at
    )
    RETURNING * INTO usage_row;
  END IF;

  IF old_submission_id IS NOT NULL
      AND old_submission_id IS DISTINCT FROM p_submission_id THEN
    UPDATE public.product_submissions AS submission
    SET status = 'cancelled_by_user',
        user_product_usage_id = NULL,
        cleanup_after = COALESCE(cleanup_after, p_updated_at + interval '30 days'),
        updated_at = p_updated_at
    WHERE submission.id = old_submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
      AND submission.status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
  END IF;

  UPDATE public.product_submissions AS submission
  SET user_product_usage_id = usage_row.id,
      updated_at = p_updated_at
  WHERE submission.id = p_submission_id
    AND submission.user_id = p_user_id
    AND submission.category = p_category
  RETURNING * INTO submission_row;

  RETURN jsonb_build_object(
    'usage', to_jsonb(usage_row),
    'submission', to_jsonb(submission_row)
  );
END;
$$;


ALTER FUNCTION "public"."product_intake_replace_usage_with_pending_submission"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_submission_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_front_image_path" "text", "p_updated_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_request_more_info"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text", "p_missing_fields" "jsonb" DEFAULT '[]'::"jsonb", "p_reviewed_at" timestamp with time zone DEFAULT "now"(), "p_review_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission is not open for request-info action';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'user-facing reason is required';
  END IF;

  IF p_next_step IS NULL OR btrim(p_next_step) = '' THEN
    RAISE EXCEPTION 'user-facing next step is required';
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'needs_more_info',
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      user_facing_resolution_reason = p_reason,
	      user_facing_next_step = p_next_step,
	      user_facing_missing_fields = COALESCE(p_missing_fields, '[]'::jsonb),
	      notification_sent_at = NULL,
	      updated_at = p_reviewed_at
	  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET match_status = 'needs_more_info',
        product_id = NULL,
        product_submission_id = submission_row.id,
        updated_at = p_reviewed_at
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    RETURNING * INTO usage_row;
  END IF;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'usage', CASE WHEN usage_row.id IS NULL THEN NULL ELSE to_jsonb(usage_row) END
  );
END;
$$;


ALTER FUNCTION "public"."product_intake_request_more_info"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text", "p_missing_fields" "jsonb", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_request_rework_job"("target_submission_id" "uuid", "rework_progress" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."product_intake_research_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  job_row public.product_intake_research_jobs;
BEGIN
  SELECT *
  INTO job_row
  FROM public.product_intake_research_jobs AS jobs
  WHERE jobs.submission_id = target_submission_id
    AND jobs.status IN ('waiting_for_review', 'waiting_for_rework', 'blocked', 'failed')
  ORDER BY jobs.updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF job_row.id IS NULL THEN
    RAISE EXCEPTION 'No review-ready, blocked, or failed research job exists for submission %', target_submission_id
      USING ERRCODE = '02000';
  END IF;

  UPDATE public.product_intake_research_jobs AS jobs
  SET status = 'waiting_for_rework',
      stage = 'rework',
      attempt_count = 0,
      progress = CASE
        WHEN rework_progress IS NULL THEN jobs.progress
        ELSE jobs.progress || rework_progress
      END,
      last_error = NULL,
      locked_by = NULL,
      locked_at = NULL,
      completed_at = NULL,
      next_run_at = now()
  WHERE jobs.id = job_row.id
  RETURNING *
  INTO job_row;

  RETURN job_row;
END;
$$;


ALTER FUNCTION "public"."product_intake_request_rework_job"("target_submission_id" "uuid", "rework_progress" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_retry_research_job"("target_job_id" "uuid", "retry_progress" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."product_intake_research_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_job_stage text;
  current_job_status text;
  submission_status text;
  job_row public.product_intake_research_jobs;
BEGIN
  SELECT jobs.status, jobs.stage, submissions.status
  INTO current_job_status, current_job_stage, submission_status
  FROM public.product_intake_research_jobs AS jobs
  INNER JOIN public.product_submissions AS submissions
    ON submissions.id = jobs.submission_id
  WHERE jobs.id = target_job_id
  FOR UPDATE OF jobs;

  IF current_job_status IS NULL THEN
    RAISE EXCEPTION 'Product intake research job % does not exist', target_job_id
      USING ERRCODE = '02000';
  END IF;

  IF submission_status NOT IN (
    'pending_review',
    'researching',
    'ready_for_review',
    'needs_more_info'
  ) THEN
    RAISE EXCEPTION 'Product submission for job % is not open for research: %', target_job_id, submission_status
      USING ERRCODE = '23514';
  END IF;

  IF current_job_status NOT IN ('blocked', 'failed') THEN
    RAISE EXCEPTION 'Product intake research job % is not retryable from status %', target_job_id, current_job_status
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.product_intake_research_jobs AS jobs
  SET status = 'queued',
      stage = current_job_stage,
      progress = CASE
        WHEN retry_progress IS NULL THEN jobs.progress
        ELSE jobs.progress || retry_progress
      END,
      last_error = NULL,
      locked_by = NULL,
      locked_at = NULL,
      started_at = NULL,
      completed_at = NULL,
      next_run_at = now()
  WHERE jobs.id = target_job_id
  RETURNING *
  INTO job_row;

  RETURN job_row;
END;
$$;


ALTER FUNCTION "public"."product_intake_retry_research_job"("target_job_id" "uuid", "retry_progress" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_review_normalize_identifier_value"("p_type" "text", "p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN lower(btrim(coalesce(p_type, ''))) IN ('ean', 'gtin', 'barcode')
      THEN lower(regexp_replace(btrim(coalesce(p_value, '')), '[^[:alnum:]]+', '', 'g'))
    ELSE lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', '', 'g'))
  END;
$$;


ALTER FUNCTION "public"."product_intake_review_normalize_identifier_value"("p_type" "text", "p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_review_normalize_identity_text"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;


ALTER FUNCTION "public"."product_intake_review_normalize_identity_text"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_intake_update_research_job"("target_job_id" "uuid", "next_status" "text", "next_stage" "text", "next_progress" "jsonb" DEFAULT NULL::"jsonb", "next_last_error" "text" DEFAULT NULL::"text", "expected_locked_by" "text" DEFAULT NULL::"text", "expected_locked_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."product_intake_research_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  job_row public.product_intake_research_jobs;
BEGIN
  IF next_status NOT IN (
    'queued',
    'running',
    'waiting_for_review',
    'waiting_for_rework',
    'publish_preflight',
    'publishing',
    'blocked',
    'failed',
    'done',
    'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid product intake research status: %', next_status
      USING ERRCODE = '22023';
  END IF;

  IF next_stage NOT IN (
    'identity',
    'source_research',
    'property_research',
    'image_search',
    'image_judging',
    'preview_build',
    'rework',
    'publish_preflight',
    'publish',
    'notify'
  ) THEN
    RAISE EXCEPTION 'Invalid product intake research stage: %', next_stage
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_intake_research_jobs AS jobs
  SET status = next_status,
      stage = next_stage,
      progress = COALESCE(next_progress, jobs.progress),
      last_error = next_last_error,
      locked_by = CASE WHEN next_status = 'running' THEN jobs.locked_by ELSE NULL END,
      locked_at = CASE WHEN next_status = 'running' THEN now() ELSE NULL END,
      started_at = CASE
        WHEN next_status = 'running' THEN COALESCE(jobs.started_at, now())
        ELSE jobs.started_at
      END,
      completed_at = CASE
        WHEN next_status IN ('done', 'cancelled') THEN COALESCE(jobs.completed_at, now())
        ELSE NULL
      END,
      next_run_at = CASE
        WHEN next_status = 'queued' THEN now()
        ELSE jobs.next_run_at
      END
  WHERE jobs.id = target_job_id
    AND (
      expected_locked_by IS NULL
      OR (
        jobs.locked_by = expected_locked_by
        AND jobs.locked_at = expected_locked_at
      )
    )
  RETURNING *
  INTO job_row;

  IF job_row.id IS NULL THEN
    RAISE EXCEPTION 'Product intake research job % does not exist or lock no longer matches', target_job_id
      USING ERRCODE = '02000';
  END IF;

  RETURN job_row;
END;
$$;


ALTER FUNCTION "public"."product_intake_update_research_job"("target_job_id" "uuid", "next_status" "text", "next_stage" "text", "next_progress" "jsonb", "next_last_error" "text", "expected_locked_by" "text", "expected_locked_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_user_product_usage_review_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  IF auth.role() = 'service_role'
      OR coalesce(current_setting('request.jwt.claims', true), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
  INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.brand_text IS NOT NULL
        OR NEW.product_id IS NOT NULL
        OR NEW.product_submission_id IS NOT NULL
        OR NEW.match_status IS DISTINCT FROM 'text_only'
        OR NEW.intake_method IS NOT NULL
        OR NEW.source IS NOT NULL
        OR NEW.front_image_path IS NOT NULL THEN
      RAISE EXCEPTION 'review-managed product usage fields require service or admin access';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.brand_text IS DISTINCT FROM OLD.brand_text
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.product_submission_id IS DISTINCT FROM OLD.product_submission_id
      OR NEW.match_status IS DISTINCT FROM OLD.match_status
      OR NEW.intake_method IS DISTINCT FROM OLD.intake_method
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.front_image_path IS DISTINCT FROM OLD.front_image_path THEN
    RAISE EXCEPTION 'review-managed product usage fields require service or admin access';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_user_product_usage_review_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_product_image_asset"("p_product_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_public_url" "text", "p_source_page_url" "text", "p_source_image_url" "text", "p_source_type" "text", "p_quality_confidence" "text", "p_processing_method" "text", "p_asset_sha256" "text", "p_manifest_batch_id" "text", "p_user_approved" boolean, "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.products
  SET image_url = p_public_url
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  INSERT INTO public.product_image_assets (
    product_id,
    storage_bucket,
    storage_path,
    public_url,
    source_page_url,
    source_image_url,
    source_type,
    quality_confidence,
    processing_method,
    asset_sha256,
    manifest_batch_id,
    user_approved,
    notes
  )
  VALUES (
    p_product_id,
    p_storage_bucket,
    p_storage_path,
    p_public_url,
    p_source_page_url,
    p_source_image_url,
    p_source_type,
    p_quality_confidence,
    p_processing_method,
    p_asset_sha256,
    p_manifest_batch_id,
    p_user_approved,
    p_notes
  )
  ON CONFLICT (product_id) DO UPDATE
  SET
    storage_bucket = EXCLUDED.storage_bucket,
    storage_path = EXCLUDED.storage_path,
    public_url = EXCLUDED.public_url,
    source_page_url = EXCLUDED.source_page_url,
    source_image_url = EXCLUDED.source_image_url,
    source_type = EXCLUDED.source_type,
    quality_confidence = EXCLUDED.quality_confidence,
    processing_method = EXCLUDED.processing_method,
    asset_sha256 = EXCLUDED.asset_sha256,
    manifest_batch_id = EXCLUDED.manifest_batch_id,
    user_approved = EXCLUDED.user_approved,
    notes = EXCLUDED.notes;
END;
$$;


ALTER FUNCTION "public"."publish_product_image_asset"("p_product_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_public_url" "text", "p_source_page_url" "text", "p_source_image_url" "text", "p_source_type" "text", "p_quality_confidence" "text", "p_processing_method" "text", "p_asset_sha256" "text", "p_manifest_batch_id" "text", "p_user_approved" boolean, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_personal_plan_artifacts"("p_limit" integer DEFAULT 100) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH candidates AS (
    SELECT artifacts.id
      FROM public.personal_plan_prepared_artifacts AS artifacts
     WHERE (
       artifacts.status = 'prepared'
       AND artifacts.expires_at < now()
     ) OR (
       artifacts.status = 'superseded'
       AND artifacts.attached_at < now() - interval '1 day'
     )
     ORDER BY artifacts.expires_at ASC
     LIMIT LEAST(GREATEST(p_limit, 1), 500)
     FOR UPDATE SKIP LOCKED
  ),
  deleted AS (
    DELETE FROM public.personal_plan_prepared_artifacts AS artifacts
     USING candidates
     WHERE artifacts.id = candidates.id
     RETURNING artifacts.id
  )
  SELECT count(*)::integer INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."purge_expired_personal_plan_artifacts"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_personal_plan_quiz_drafts"("p_limit" integer DEFAULT 100) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE deleted_count integer;
BEGIN
  WITH candidates AS (
    SELECT id FROM public.personal_plan_quiz_drafts
    WHERE expires_at < now() OR (status = 'completed' AND completed_at < now() - interval '1 day')
    ORDER BY expires_at ASC LIMIT LEAST(GREATEST(p_limit, 1), 500) FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.personal_plan_quiz_drafts d USING candidates c WHERE d.id = c.id RETURNING d.id
  ) SELECT count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END; $$;


ALTER FUNCTION "public"."purge_expired_personal_plan_quiz_drafts"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."read_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) RETURNS TABLE("draft" "jsonb", "revision" integer, "browser_generation" integer, "expires_at" timestamp with time zone, "resume_token_hash" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT d.draft, d.revision, d.browser_generation, d.expires_at, d.resume_token_hash
    FROM public.personal_plan_quiz_drafts d
   WHERE d.id = p_draft_id AND d.browser_generation = p_browser_generation AND d.status = 'active' AND d.expires_at > now();
END; $$;


ALTER FUNCTION "public"."read_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_product_leave_in_eligibility"("p_product_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  product_row public.products%ROWTYPE;
  spec_row public.product_leave_in_specs%ROWTYPE;
BEGIN
  DELETE FROM public.product_leave_in_eligibility
  WHERE product_id = p_product_id;

  SELECT *
  INTO product_row
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF lower(trim(COALESCE(product_row.category, ''))) NOT IN ('leave-in', 'leave in', 'leave_in') THEN
    RETURN;
  END IF;

  SELECT *
  INTO spec_row
  FROM public.product_leave_in_specs
  WHERE product_id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.product_leave_in_eligibility (
    product_id,
    thickness,
    need_bucket,
    styling_context
  )
  SELECT p_product_id, e.thickness, e.need_bucket, e.styling_context
  FROM public.expand_leave_in_eligibility(
    product_row.suitable_thicknesses,
    spec_row.roles,
    spec_row.care_benefits,
    spec_row.application_stage,
    spec_row.provides_heat_protection,
    spec_row.heat_activation_required
  ) AS e
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."rebuild_product_leave_in_eligibility"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_funnel_event"("p_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_channel" "text", "p_event_id" "text", "p_event_name" "text", "p_landing_slug" "text" DEFAULT NULL::"text", "p_landing_variant" "text" DEFAULT 'default'::"text", "p_offer_variant" "text" DEFAULT 'default'::"text", "p_quiz_variant" "text" DEFAULT NULL::"text", "p_entry_path" "text" DEFAULT NULL::"text", "p_entry_url" "text" DEFAULT NULL::"text", "p_referrer" "text" DEFAULT NULL::"text", "p_first_touch" "jsonb" DEFAULT '{}'::"jsonb", "p_first_seen_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_occurred_at" timestamp with time zone DEFAULT "now"(), "p_lead_id" "uuid" DEFAULT NULL::"uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_checkout_provider" "text" DEFAULT NULL::"text", "p_checkout_reference" "text" DEFAULT NULL::"text", "p_properties" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("inserted" boolean, "funnel_session_id" "uuid", "funnel_package_key" "text", "lead_id" "uuid", "user_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE existing_event public.funnel_events%ROWTYPE; session_row public.funnel_sessions%ROWTYPE;
BEGIN
  IF p_event_name IS NULL OR p_event_name NOT IN ('landing_viewed','quiz_started','quiz_completed','lead_captured','offer_viewed','checkout_started','purchase_completed') THEN RAISE EXCEPTION 'unsupported funnel event name: %', p_event_name USING ERRCODE = '22023'; END IF;
  IF p_event_id IS NULL OR btrim(p_event_id) = '' THEN RAISE EXCEPTION 'funnel event_id is required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id, 0));
  SELECT events.* INTO existing_event FROM public.funnel_events AS events WHERE events.event_id = p_event_id;
  IF existing_event.event_id IS NOT NULL THEN
    SELECT sessions.* INTO session_row FROM public.funnel_sessions AS sessions WHERE sessions.id = existing_event.funnel_session_id;
    RETURN QUERY SELECT false, existing_event.funnel_session_id, existing_event.package_key, existing_event.lead_id, session_row.user_id; RETURN;
  END IF;
  INSERT INTO public.funnel_sessions AS sessions (id,visitor_id,package_key,landing_slug,channel,landing_variant,offer_variant,quiz_variant,entry_path,entry_url,referrer,first_touch,first_seen_at,last_seen_at,lead_id,user_id)
  VALUES (p_session_id,p_visitor_id,p_package_key,p_landing_slug,p_channel,p_landing_variant,p_offer_variant,CASE WHEN p_quiz_variant IS NOT NULL THEN p_quiz_variant WHEN p_package_key = 'meta_personal_plan_v1' THEN 'personal-plan-quiz-v1' ELSE 'legacy-quiz-v1' END,p_entry_path,p_entry_url,p_referrer,COALESCE(p_first_touch,'{}'::jsonb),COALESCE(p_first_seen_at,p_occurred_at),p_occurred_at,p_lead_id,p_user_id)
  ON CONFLICT (id) DO UPDATE SET last_seen_at=GREATEST(sessions.last_seen_at,EXCLUDED.last_seen_at),landing_slug=COALESCE(sessions.landing_slug,EXCLUDED.landing_slug),entry_path=COALESCE(sessions.entry_path,EXCLUDED.entry_path),entry_url=COALESCE(sessions.entry_url,EXCLUDED.entry_url),referrer=COALESCE(sessions.referrer,EXCLUDED.referrer),first_touch=CASE WHEN sessions.first_touch='{}'::jsonb THEN EXCLUDED.first_touch ELSE sessions.first_touch END,lead_id=COALESCE(sessions.lead_id,EXCLUDED.lead_id),user_id=COALESCE(sessions.user_id,EXCLUDED.user_id)
  RETURNING * INTO session_row;
  INSERT INTO public.funnel_events (event_id,funnel_session_id,package_key,event_name,occurred_at,lead_id,checkout_provider,checkout_reference,properties)
  VALUES (p_event_id,session_row.id,session_row.package_key,p_event_name,p_occurred_at,p_lead_id,p_checkout_provider,p_checkout_reference,jsonb_set(COALESCE(p_properties,'{}'::jsonb),'{offer_variant}',to_jsonb(session_row.offer_variant),true));
  UPDATE public.funnel_sessions AS sessions SET
    landing_viewed_at=CASE WHEN p_event_name='landing_viewed' THEN COALESCE(sessions.landing_viewed_at,p_occurred_at) ELSE sessions.landing_viewed_at END,
    quiz_started_at=CASE WHEN p_event_name='quiz_started' THEN COALESCE(sessions.quiz_started_at,p_occurred_at) ELSE sessions.quiz_started_at END,
    quiz_completed_at=CASE WHEN p_event_name='quiz_completed' THEN COALESCE(sessions.quiz_completed_at,p_occurred_at) ELSE sessions.quiz_completed_at END,
    lead_captured_at=CASE WHEN p_event_name='lead_captured' THEN COALESCE(sessions.lead_captured_at,p_occurred_at) ELSE sessions.lead_captured_at END,
    offer_viewed_at=CASE WHEN p_event_name='offer_viewed' THEN COALESCE(sessions.offer_viewed_at,p_occurred_at) ELSE sessions.offer_viewed_at END,
    checkout_started_at=CASE WHEN p_event_name='checkout_started' THEN COALESCE(sessions.checkout_started_at,p_occurred_at) ELSE sessions.checkout_started_at END,
    purchase_completed_at=CASE WHEN p_event_name='purchase_completed' THEN COALESCE(sessions.purchase_completed_at,p_occurred_at) ELSE sessions.purchase_completed_at END,
    lead_id=COALESCE(sessions.lead_id,p_lead_id), user_id=COALESCE(sessions.user_id,p_user_id),
    purchase_provider=CASE WHEN p_event_name='purchase_completed' THEN COALESCE(sessions.purchase_provider,p_checkout_provider) ELSE sessions.purchase_provider END,
    purchase_reference=CASE WHEN p_event_name='purchase_completed' THEN COALESCE(sessions.purchase_reference,p_checkout_reference) ELSE sessions.purchase_reference END
  WHERE sessions.id=session_row.id RETURNING * INTO session_row;
  RETURN QUERY SELECT true, session_row.id, session_row.package_key, session_row.lead_id, session_row.user_id;
END;
$$;


ALTER FUNCTION "public"."record_funnel_event"("p_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_channel" "text", "p_event_id" "text", "p_event_name" "text", "p_landing_slug" "text", "p_landing_variant" "text", "p_offer_variant" "text", "p_quiz_variant" "text", "p_entry_path" "text", "p_entry_url" "text", "p_referrer" "text", "p_first_touch" "jsonb", "p_first_seen_at" timestamp with time zone, "p_occurred_at" timestamp with time zone, "p_lead_id" "uuid", "p_user_id" "uuid", "p_checkout_provider" "text", "p_checkout_reference" "text", "p_properties" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_day_type" "text", "p_custom_activity_name" "text", "p_products" "jsonb", "p_client_session_id" "uuid", "p_client_revision" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_user_id uuid := p_user_id;
  v_log public.routine_logs%ROWTYPE;
  v_day jsonb;
  v_inserted boolean := false;
  v_inserted_rows integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'server_boundary_user_required', 'error', 'Server user context is required.');
  END IF;
  IF p_logged_on IS NULL OR p_timezone IS NULL OR p_day_type IS NULL OR p_client_session_id IS NULL OR p_client_revision IS NULL OR p_client_revision < 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_date', 'error', 'Ungültige Eintrag-Daten.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone)
     OR p_logged_on > (now() AT TIME ZONE p_timezone)::date
     OR p_logged_on < (now() AT TIME ZONE p_timezone)::date - 7 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_date', 'error', 'Ungültiges Datum.');
  END IF;
  IF jsonb_typeof(coalesce(p_products, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_products, '[]'::jsonb)) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_products', 'error', 'Ungültige Produktdaten.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) AS p(value)
    WHERE jsonb_typeof(p.value) <> 'object'
       OR jsonb_typeof(p.value -> 'category') <> 'string'
       OR (p.value -> 'product_name' IS NOT NULL AND jsonb_typeof(p.value -> 'product_name') NOT IN ('string', 'null'))
       OR (p.value -> 'product_name' IS NOT NULL AND jsonb_typeof(p.value -> 'product_name') = 'string' AND char_length(p.value ->> 'product_name') > 200)
       OR (p.value -> 'user_product_usage_id' IS NOT NULL AND jsonb_typeof(p.value -> 'user_product_usage_id') NOT IN ('string', 'null'))
       OR (jsonb_typeof(p.value -> 'user_product_usage_id') = 'string' AND p.value ->> 'user_product_usage_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_products', 'error', 'Ungültige Produktdaten.'); END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) AS p(value)
    GROUP BY CASE WHEN p.value ->> 'user_product_usage_id' IS NOT NULL THEN 'usage:' || (p.value ->> 'user_product_usage_id') ELSE 'manual:' || (p.value ->> 'category') || ':' || coalesce(p.value ->> 'product_name', '') END
    HAVING count(*) > 1
  ) THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_products', 'error', 'Ungültige Produktdaten.'); END IF;
  IF p_day_type NOT IN ('wash', 'clarifying', 'treatment_only', 'styling_only', 'none', 'custom')
     OR (p_day_type = 'custom' AND char_length(btrim(coalesce(p_custom_activity_name, ''))) NOT BETWEEN 1 AND 60)
     OR (p_day_type <> 'custom' AND p_custom_activity_name IS NOT NULL)
     OR (p_day_type = 'none' AND jsonb_array_length(coalesce(p_products, '[]'::jsonb)) <> 0) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_activity', 'error', 'Ungültige Eintrag-Daten.');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) AS p(category text, user_product_usage_id uuid) WHERE p.category IS NULL OR NOT EXISTS (SELECT 1 FROM public.product_categories c WHERE c.key = p.category)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unknown_category', 'error', 'Unbekannte Kategorie.');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) AS p(category text, user_product_usage_id uuid) WHERE p.user_product_usage_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_product_usage u WHERE u.id = p.user_product_usage_id AND u.user_id = v_user_id AND u.category = p.category)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'foreign_product', 'error', 'Ungültige Produktreferenz.');
  END IF;
  INSERT INTO public.routine_logs (user_id, logged_on, timezone, day_type, custom_activity_name, client_session_id, client_revision)
  VALUES (v_user_id, p_logged_on, p_timezone, p_day_type, CASE WHEN p_day_type = 'custom' THEN btrim(p_custom_activity_name) END, p_client_session_id, p_client_revision)
  ON CONFLICT (user_id, logged_on) DO NOTHING;
  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  v_inserted := v_inserted_rows > 0;
  SELECT * INTO v_log FROM public.routine_logs WHERE user_id = v_user_id AND logged_on = p_logged_on FOR UPDATE;
  IF NOT v_inserted AND v_log.client_session_id = p_client_session_id AND v_log.client_revision >= p_client_revision THEN
    SELECT jsonb_build_object('loggedOn', v_log.logged_on, 'dayType', v_log.day_type, 'customActivityName', v_log.custom_activity_name, 'deletedAt', v_log.deleted_at, 'products', coalesce(jsonb_agg(jsonb_build_object('category', p.category, 'productName', p.product_name, 'userProductUsageId', p.user_product_usage_id)), '[]'::jsonb)) INTO v_day FROM public.routine_log_products p WHERE p.routine_log_id = v_log.id;
    RETURN jsonb_build_object('ok', true, 'code', 'stale_revision', 'day', v_day);
  END IF;
  UPDATE public.routine_logs SET timezone = p_timezone, day_type = p_day_type, custom_activity_name = CASE WHEN p_day_type = 'custom' THEN btrim(p_custom_activity_name) END, client_session_id = p_client_session_id, client_revision = p_client_revision, deleted_at = NULL WHERE id = v_log.id;
  DELETE FROM public.routine_log_products WHERE routine_log_id = v_log.id;
  INSERT INTO public.routine_log_products (routine_log_id, category, product_name, user_product_usage_id) SELECT v_log.id, p.category, p.product_name, p.user_product_usage_id FROM jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) AS p(category text, product_name text, user_product_usage_id uuid);
  SELECT jsonb_build_object('loggedOn', l.logged_on, 'dayType', l.day_type, 'customActivityName', l.custom_activity_name, 'deletedAt', l.deleted_at, 'products', coalesce(jsonb_agg(jsonb_build_object('category', p.category, 'productName', p.product_name, 'userProductUsageId', p.user_product_usage_id)) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb)) INTO v_day FROM public.routine_logs l LEFT JOIN public.routine_log_products p ON p.routine_log_id = l.id WHERE l.id = v_log.id GROUP BY l.id;
  RETURN jsonb_build_object('ok', true, 'code', 'saved', 'day', v_day);
END;
$_$;


ALTER FUNCTION "public"."replace_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_day_type" "text", "p_custom_activity_name" "text", "p_products" "jsonb", "p_client_session_id" "uuid", "p_client_revision" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_customerio_profile_sync"("p_lead_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_kind text;
BEGIN
  SELECT quiz_kind
    INTO target_kind
    FROM public.leads
   WHERE id = p_lead_id;

  IF target_kind IS DISTINCT FROM 'personal_plan' THEN
    RAISE EXCEPTION 'Customer.io profile sync requires a personal-plan lead'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.customerio_profile_sync_outbox AS existing (
    lead_id
  )
  VALUES (p_lead_id)
  ON CONFLICT (lead_id) DO UPDATE
     SET status = 'pending',
         profile_revision = existing.profile_revision + 1,
         attempts = 0,
         processing_started_at = NULL,
         next_attempt_at = NULL,
         delivered_at = NULL,
         last_error = NULL,
         completion_event_delivered_at = existing.completion_event_delivered_at,
         updated_at = now();
END;
$$;


ALTER FUNCTION "public"."request_customerio_profile_sync"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_expired_uncaptured_paypal_order"("p_provider_order_id" "text", "p_provider_state" "text", "p_provider_verified_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  intent public.paypal_order_intents%ROWTYPE;
  consent public.personal_plan_one_time_checkout_consents%ROWTYPE;
  audit_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for PayPal order reset' USING ERRCODE = '42501';
  END IF;
  IF p_provider_order_id IS NULL OR length(trim(p_provider_order_id)) = 0 THEN
    RAISE EXCEPTION 'provider order is required' USING ERRCODE = '22023';
  END IF;
  IF p_provider_state <> 'voided'
    OR p_provider_verified_at IS NULL
    OR p_provider_verified_at < now() - interval '5 minutes'
    OR p_provider_verified_at > now() + interval '30 seconds' THEN
    RAISE EXCEPTION 'fresh terminal provider verification is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intent
  FROM public.paypal_order_intents
  WHERE provider_order_id = p_provider_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PayPal order intent is not resettable' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO consent
  FROM public.personal_plan_one_time_checkout_consents
  WHERE id = intent.consent_id
  FOR UPDATE;
  IF NOT FOUND
    OR consent.paypal_order_id IS DISTINCT FROM p_provider_order_id
    OR consent.stripe_checkout_session_id IS NOT NULL
    OR intent.status <> 'created'
    OR intent.expires_at > now()
    OR intent.provider_capture_id IS NOT NULL THEN
    RAISE EXCEPTION 'PayPal order intent is not resettable' USING ERRCODE = '22000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_one_time_purchases purchase
    WHERE purchase.consent_id = intent.consent_id
       OR purchase.provider_order_id = p_provider_order_id
  ) THEN
    RAISE EXCEPTION 'PayPal order intent has purchase evidence' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.paypal_expired_order_reset_audit (
    consent_id,
    intent_id,
    prior_provider_order_id,
    provider_state,
    provider_verified_at
  ) VALUES (
    consent.id,
    intent.id,
    p_provider_order_id,
    p_provider_state,
    p_provider_verified_at
  ) RETURNING id INTO audit_id;

  PERFORM set_config('app.personal_plan_one_time_paypal_reset_audit_id', audit_id::text, true);

  UPDATE public.paypal_order_intents
  SET provider_order_id = NULL,
      expires_at = now() + interval '24 hours',
      status = 'created'
  WHERE id = intent.id
    AND provider_order_id = p_provider_order_id;

  UPDATE public.personal_plan_one_time_checkout_consents
  SET paypal_order_id = NULL
  WHERE id = consent.id
    AND paypal_order_id = p_provider_order_id;
END;
$$;


ALTER FUNCTION "public"."reset_expired_uncaptured_paypal_order"("p_provider_order_id" "text", "p_provider_state" "text", "p_provider_verified_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.personal_plan_quiz_drafts SET status = 'completed', completed_at = now(), updated_at = now()
   WHERE id = p_draft_id AND browser_generation = p_browser_generation AND status = 'active';
  RETURN FOUND;
END; $$;


ALTER FUNCTION "public"."revoke_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_personal_plan_lead_with_artifact"("p_email" "text", "p_marketing_consent" boolean, "p_quiz_answers" "jsonb", "p_artifact_id" "uuid", "p_claim_token_hash" "text", "p_answer_hash" "text") RETURNS TABLE("lead_id" "uuid", "reused" boolean, "artifact_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  claimed_artifact public.personal_plan_prepared_artifacts%ROWTYPE;
  canonical_artifact_id uuid;
  matched_lead_id uuid;
  lead_was_reused boolean := false;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('personal_plan:' || lower(btrim(p_email)), 0)
  );

  SELECT artifacts.*
    INTO claimed_artifact
    FROM public.personal_plan_prepared_artifacts AS artifacts
   WHERE artifacts.id = p_artifact_id
     AND artifacts.claim_token_hash = p_claim_token_hash
   FOR UPDATE;

  IF claimed_artifact.id IS NULL THEN
    RAISE EXCEPTION 'invalid personal-plan artifact claim' USING ERRCODE = '22023';
  END IF;
  IF claimed_artifact.answer_hash <> p_answer_hash
     OR claimed_artifact.quiz_answers <> p_quiz_answers THEN
    RAISE EXCEPTION 'personal-plan answer hash mismatch' USING ERRCODE = '22023';
  END IF;
  IF claimed_artifact.status = 'prepared' AND claimed_artifact.expires_at <= now() THEN
    RAISE EXCEPTION 'personal-plan artifact claim expired' USING ERRCODE = '22023';
  END IF;

  IF claimed_artifact.status IN ('attached', 'superseded') THEN
    SELECT leads.id
      INTO matched_lead_id
      FROM public.leads
     WHERE leads.id = claimed_artifact.lead_id
       AND leads.quiz_kind = 'personal_plan'
       AND leads.email = lower(btrim(p_email))
       AND leads.quiz_answers = p_quiz_answers
     FOR UPDATE;

    IF matched_lead_id IS NULL THEN
      RAISE EXCEPTION 'personal-plan artifact already belongs to another lead'
        USING ERRCODE = '23505';
    END IF;

    UPDATE public.leads
       SET marketing_consent = p_marketing_consent
     WHERE leads.id = matched_lead_id
       AND leads.marketing_consent IS DISTINCT FROM p_marketing_consent;

    RETURN QUERY
      SELECT matched_lead_id,
             true,
             CASE
               WHEN claimed_artifact.status = 'superseded'
                 THEN claimed_artifact.superseded_by
               ELSE claimed_artifact.id
             END;
    RETURN;
  END IF;

  SELECT leads.id
    INTO matched_lead_id
    FROM public.leads
   WHERE leads.quiz_kind = 'personal_plan'
     AND leads.email = lower(btrim(p_email))
     AND leads.created_at >= now() - interval '15 minutes'
     AND leads.quiz_answers = p_quiz_answers
   ORDER BY leads.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF matched_lead_id IS NULL THEN
    INSERT INTO public.leads (
      name,
      email,
      marketing_consent,
      quiz_answers,
      quiz_kind,
      status
    )
    VALUES (
      '',
      lower(btrim(p_email)),
      p_marketing_consent,
      p_quiz_answers,
      'personal_plan',
      'captured'
    )
    RETURNING leads.id INTO matched_lead_id;
  ELSE
    lead_was_reused := true;
    UPDATE public.leads
       SET marketing_consent = p_marketing_consent
     WHERE leads.id = matched_lead_id
       AND leads.marketing_consent IS DISTINCT FROM p_marketing_consent;
  END IF;

  SELECT artifacts.id
    INTO canonical_artifact_id
    FROM public.personal_plan_prepared_artifacts AS artifacts
   WHERE artifacts.lead_id = matched_lead_id
     AND artifacts.answer_hash = p_answer_hash
     AND artifacts.status = 'attached'
   ORDER BY artifacts.attached_at ASC, artifacts.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF canonical_artifact_id IS NOT NULL THEN
    UPDATE public.personal_plan_prepared_artifacts
       SET status = 'superseded',
           lead_id = matched_lead_id,
           attached_at = now(),
           superseded_by = canonical_artifact_id
     WHERE id = claimed_artifact.id;
    RETURN QUERY SELECT matched_lead_id, true, canonical_artifact_id;
    RETURN;
  END IF;

  UPDATE public.personal_plan_prepared_artifacts
     SET status = 'attached',
         lead_id = matched_lead_id,
         attached_at = now()
   WHERE id = claimed_artifact.id;

  RETURN QUERY SELECT matched_lead_id, lead_was_reused, claimed_artifact.id;
END;
$$;


ALTER FUNCTION "public"."save_personal_plan_lead_with_artifact"("p_email" "text", "p_marketing_consent" boolean, "p_quiz_answers" "jsonb", "p_artifact_id" "uuid", "p_claim_token_hash" "text", "p_answer_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_product_conditioner_specs_from_products"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  DELETE FROM public.product_conditioner_specs
  WHERE product_id = NEW.id;

  IF lower(coalesce(NEW.category, '')) LIKE 'conditioner%' THEN
    INSERT INTO public.product_conditioner_specs (product_id, thickness, protein_moisture_balance)
    SELECT NEW.id, e.thickness, e.protein_moisture_balance
    FROM public.expand_conditioner_eligibility(NEW.suitable_thicknesses, NEW.suitable_concerns) AS e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_product_conditioner_specs_from_products"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_product_leave_in_eligibility_from_products"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  PERFORM public.rebuild_product_leave_in_eligibility(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_product_leave_in_eligibility_from_products"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_product_leave_in_eligibility_from_specs"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  PERFORM public.rebuild_product_leave_in_eligibility(COALESCE(NEW.product_id, OLD.product_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."sync_product_leave_in_eligibility_from_specs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_product_oil_eligibility_from_products"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  DELETE FROM public.product_oil_eligibility
  WHERE product_id = NEW.id;

  IF NEW.category = 'Öle' THEN
    INSERT INTO public.product_oil_eligibility (product_id, thickness, oil_subtype)
    SELECT NEW.id, e.thickness, e.oil_subtype
    FROM public.expand_oil_eligibility(NEW.suitable_thicknesses, NEW.suitable_concerns) AS e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_product_oil_eligibility_from_products"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer, "p_expected_revision" integer, "p_draft" "jsonb", "p_allow_revision_catchup" boolean DEFAULT false) RETURNS TABLE("revision" integer, "browser_generation" integer, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE saved public.personal_plan_quiz_drafts%ROWTYPE;
BEGIN
  UPDATE public.personal_plan_quiz_drafts d SET draft = p_draft, revision = d.revision + 1,
    updated_at = now(), expires_at = LEAST(d.created_at + interval '7 days', now() + interval '24 hours')
   WHERE d.id = p_draft_id AND d.browser_generation = p_browser_generation
     AND (
       d.revision = p_expected_revision OR
       (p_allow_revision_catchup IS TRUE AND d.revision = p_expected_revision + 1)
     )
     AND d.status = 'active' AND d.expires_at > now() RETURNING * INTO saved;
  IF saved.id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT saved.revision, saved.browser_generation, saved.expires_at;
END; $$;


ALTER FUNCTION "public"."update_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer, "p_expected_revision" integer, "p_draft" "jsonb", "p_allow_revision_catchup" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_paypal_order_intent_binding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personal_plan_one_time_checkout_consents c WHERE c.id = NEW.consent_id AND c.lead_id = NEW.lead_id AND c.funnel_session_id = NEW.funnel_session_id AND c.product_kind = NEW.product_kind) THEN
    RAISE EXCEPTION 'PayPal order intent must bind its canonical consent, lead, and session' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_paypal_order_intent_binding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_personal_plan_one_time_consent_binding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.funnel_sessions
    WHERE id = NEW.funnel_session_id AND lead_id = NEW.lead_id
  ) THEN
    RAISE EXCEPTION 'checkout consent lead and funnel session must match' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_personal_plan_one_time_consent_binding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_product_submission_foundation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  category_supported boolean;
  user_prefix text := NEW.user_id::text || '/';
  tmp_prefix text := 'tmp/' || NEW.user_id::text || '/';
BEGIN
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

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_product_submission_foundation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_product_submission_status_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status IN ('rejected', 'cancelled_by_user')
      AND EXISTS (
        SELECT 1
        FROM public.user_product_usage usage
        WHERE usage.product_submission_id = NEW.id
      ) THEN
    RAISE EXCEPTION 'unsuccessful product submissions must be unlinked from user_product_usage before closing';
  END IF;

  IF NEW.status IN ('approved', 'matched_existing') AND NEW.approved_product_id IS NULL THEN
    RAISE EXCEPTION 'successful product submissions require approved_product_id';
  END IF;

  IF NEW.status IN ('approved', 'matched_existing') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.products
      WHERE id = NEW.approved_product_id
        AND category_key = NEW.category
    ) THEN
      RAISE EXCEPTION 'successful product submissions require approved_product_id to match submission category';
    END IF;
  END IF;

  IF NEW.status IN ('approved', 'matched_existing')
      AND EXISTS (
        SELECT 1
        FROM public.user_product_usage usage
        WHERE usage.product_submission_id = NEW.id
          AND usage.product_id IS DISTINCT FROM NEW.approved_product_id
      ) THEN
    RAISE EXCEPTION 'successful product submissions must link user_product_usage.product_id to approved_product_id before closing';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_product_submission_status_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_user_product_usage_submission_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  linked_status text;
  linked_approved_product_id uuid;
BEGIN
  IF NEW.product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.products
        WHERE id = NEW.product_id
          AND category_key = NEW.category
      ) THEN
    RAISE EXCEPTION 'user_product_usage.product_id must match usage category';
  END IF;

  IF NEW.product_submission_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, approved_product_id
  INTO linked_status, linked_approved_product_id
  FROM public.product_submissions
  WHERE id = NEW.product_submission_id
    AND user_id = NEW.user_id
    AND category = NEW.category;

  IF linked_status IS NULL THEN
    RAISE EXCEPTION 'product_submission_id must belong to the same user and category';
  END IF;

  IF linked_status IN ('rejected', 'cancelled_by_user') THEN
    RAISE EXCEPTION 'closed unsuccessful product submissions cannot remain linked to user_product_usage';
  END IF;

  IF NEW.match_status = 'matched'
      AND linked_status NOT IN ('approved', 'matched_existing') THEN
    RAISE EXCEPTION 'matched user_product_usage links require a successful product submission';
  END IF;

  IF linked_status IN ('approved', 'matched_existing')
      AND linked_approved_product_id IS NULL THEN
    RAISE EXCEPTION 'successful closed product submissions require approved_product_id';
  END IF;

  IF linked_status IN ('approved', 'matched_existing')
      AND NEW.product_id IS DISTINCT FROM linked_approved_product_id THEN
    RAISE EXCEPTION 'successful closed product submissions require user_product_usage.product_id to equal approved_product_id';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_user_product_usage_submission_link"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text",
    "body" "text",
    "cover_image_url" "text",
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "author_name" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "message" "text" NOT NULL,
    "page_url" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posthog_session_id" "text",
    CONSTRAINT "beta_feedback_message_check" CHECK ((("length"("message") >= 1) AND ("length"("message") <= 4000))),
    CONSTRAINT "beta_feedback_page_url_check" CHECK ((("page_url" IS NULL) OR ("length"("page_url") <= 2048))),
    CONSTRAINT "beta_feedback_posthog_session_id_check" CHECK ((("posthog_session_id" IS NULL) OR ("length"("posthog_session_id") <= 128))),
    CONSTRAINT "beta_feedback_user_agent_check" CHECK ((("user_agent" IS NULL) OR ("length"("user_agent") <= 512)))
);


ALTER TABLE "public"."beta_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_analytics_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "outbox_id" "uuid" NOT NULL,
    "destination" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "processing_started_at" timestamp with time zone,
    "next_attempt_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "last_error" "text",
    "provider_request_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_analytics_deliveries_destination_check" CHECK (("destination" = ANY (ARRAY['customerio'::"text", 'meta'::"text", 'posthog'::"text", 'funnel'::"text"]))),
    CONSTRAINT "billing_analytics_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'delivered'::"text", 'failed'::"text", 'failed_permanent'::"text"])))
);


ALTER TABLE "public"."billing_analytics_deliveries" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_analytics_deliveries" IS 'Per-destination delivery state for billing analytics events.';



CREATE TABLE IF NOT EXISTS "public"."billing_analytics_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_key" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_customer_id" "text",
    "provider_subscription_id" "text",
    "source_event_id" "text",
    "source_object_id" "text",
    "occurred_at" timestamp with time zone NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_analytics_outbox_event_name_check" CHECK (("event_name" = ANY (ARRAY['purchase_completed'::"text", 'payment_completed'::"text", 'subscription_started'::"text", 'subscription_updated'::"text", 'subscription_cancelled'::"text", 'subscription_expired'::"text", 'payment_failed'::"text", 'refund_completed'::"text"]))),
    CONSTRAINT "billing_analytics_outbox_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paypal'::"text"])))
);


ALTER TABLE "public"."billing_analytics_outbox" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_analytics_outbox" IS 'Provider-neutral billing analytics events created after Supabase billing truth is written.';



CREATE TABLE IF NOT EXISTS "public"."billing_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_customer_id" "text",
    "provider_subscription_id" "text" NOT NULL,
    "provider_status" "text" NOT NULL,
    "entitlement_status" "text" NOT NULL,
    "interval" "text",
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "cancelled_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_subscriber_email" "text",
    "cancel_scheduled_at" timestamp with time zone,
    CONSTRAINT "billing_subscriptions_entitlement_status_check" CHECK (("entitlement_status" = ANY (ARRAY['active'::"text", 'past_due'::"text", 'canceled'::"text", 'incomplete'::"text"]))),
    CONSTRAINT "billing_subscriptions_interval_check" CHECK (("interval" = ANY (ARRAY['month'::"text", 'quarter'::"text", 'year'::"text"]))),
    CONSTRAINT "billing_subscriptions_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paypal'::"text"])))
);


ALTER TABLE "public"."billing_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_subscriptions" IS 'Provider-neutral external subscription state for Stripe and PayPal.';



COMMENT ON COLUMN "public"."billing_subscriptions"."provider_subscriber_email" IS 'Payment-provider subscriber/customer email for support reference only. Chaarlie login/contact email remains profiles.email.';



COMMENT ON COLUMN "public"."billing_subscriptions"."cancel_scheduled_at" IS 'Provider-confirmed or safely derived timestamp when renewal/access is scheduled to stop.';



CREATE TABLE IF NOT EXISTS "public"."billing_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "provider_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_webhook_events_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paypal'::"text"])))
);


ALTER TABLE "public"."billing_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_webhook_events" IS 'Insert-first idempotency ledger for payment-provider webhooks.';



CREATE TABLE IF NOT EXISTS "public"."brand_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "product_line_id" "uuid",
    "alias" "text" NOT NULL,
    "normalized_alias" "text" NOT NULL,
    "source" "text" DEFAULT 'curated'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "canonical_name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkout_activation_claims" (
    "session_hash" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "method" "text" NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "checkout_activation_claims_method_check" CHECK (("method" = ANY (ARRAY['password'::"text", 'passwordless'::"text"])))
);


ALTER TABLE "public"."checkout_activation_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_chunks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_name" "text",
    "chunk_index" integer,
    "content" "text" NOT NULL,
    "token_count" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "extensions"."vector"(384),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"german"'::"regconfig", COALESCE("content", ''::"text"))) STORED,
    CONSTRAINT "content_chunks_source_type_check" CHECK (("source_type" = ANY (ARRAY['book'::"text", 'transcript'::"text", 'qa'::"text", 'live_call'::"text", 'product_links'::"text", 'narrative'::"text", 'product_list'::"text", 'community_qa'::"text"])))
);


ALTER TABLE "public"."content_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_states" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "state_version" integer DEFAULT 1 NOT NULL,
    "state" "jsonb" DEFAULT '{"version": 1, "active_topic": null, "pending_offer": null, "routine_layer": null, "answered_slots": [], "last_assistant_action": null, "last_product_category": null}'::"jsonb" NOT NULL,
    "last_transition" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_turn_traces" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "user_message_id" "uuid",
    "assistant_message_id" "uuid",
    "status" "text" NOT NULL,
    "trace" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "langfuse_trace_id" "text",
    "langfuse_trace_url" "text",
    CONSTRAINT "conversation_turn_traces_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."conversation_turn_traces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "is_active" boolean DEFAULT true,
    "message_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "memory_extracted_at_count" integer DEFAULT 0
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customerio_profile_sync_outbox" (
    "lead_id" "uuid" NOT NULL,
    "profile_revision" integer DEFAULT 1 NOT NULL,
    "completion_event_eligible" boolean DEFAULT false NOT NULL,
    "send_completion_event" boolean DEFAULT false NOT NULL,
    "completion_event_delivered_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "processing_started_at" timestamp with time zone,
    "next_attempt_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customerio_profile_sync_outbox_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "customerio_profile_sync_outbox_profile_revision_check" CHECK (("profile_revision" > 0)),
    CONSTRAINT "customerio_profile_sync_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'delivered'::"text", 'failed'::"text", 'failed_permanent'::"text"])))
);


ALTER TABLE "public"."customerio_profile_sync_outbox" OWNER TO "postgres";


COMMENT ON TABLE "public"."customerio_profile_sync_outbox" IS 'Retry state for projecting Personal Plan leads from Supabase into Customer.io. Profile data remains in leads.';



CREATE TABLE IF NOT EXISTS "public"."daily_quotes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "quote_text" "text" NOT NULL,
    "author" "text",
    "display_date" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dismissed_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "dismissed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reappear_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."dismissed_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funnel_events" (
    "event_id" "text" NOT NULL,
    "funnel_session_id" "uuid" NOT NULL,
    "package_key" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lead_id" "uuid",
    "checkout_provider" "text",
    "checkout_reference" "text",
    "properties" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."funnel_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."funnel_events" IS 'Append-only first-party funnel actions. event_id is the stable idempotency and downstream forwarding key.';



COMMENT ON COLUMN "public"."funnel_events"."event_id" IS 'Producer-supplied stable event identifier; retries must reuse it and genuine repeated actions must use a new value.';



COMMENT ON COLUMN "public"."funnel_events"."package_key" IS 'Compact immutable package identifier copied from the recorded event context.';



COMMENT ON COLUMN "public"."funnel_events"."properties" IS 'Append-only event-specific operational metadata; full package snapshot remains on funnel_sessions.';



CREATE TABLE IF NOT EXISTS "public"."funnel_sessions" (
    "id" "uuid" NOT NULL,
    "visitor_id" "uuid" NOT NULL,
    "package_key" "text" NOT NULL,
    "landing_slug" "text",
    "channel" "text" NOT NULL,
    "landing_variant" "text" DEFAULT 'default'::"text" NOT NULL,
    "offer_variant" "text" DEFAULT 'default'::"text" NOT NULL,
    "entry_path" "text",
    "entry_url" "text",
    "referrer" "text",
    "first_touch" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "landing_viewed_at" timestamp with time zone,
    "quiz_started_at" timestamp with time zone,
    "quiz_completed_at" timestamp with time zone,
    "lead_captured_at" timestamp with time zone,
    "offer_viewed_at" timestamp with time zone,
    "checkout_started_at" timestamp with time zone,
    "purchase_completed_at" timestamp with time zone,
    "lead_id" "uuid",
    "user_id" "uuid",
    "purchase_provider" "text",
    "purchase_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quiz_variant" "text" NOT NULL,
    "is_internal_test" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."funnel_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."funnel_sessions" IS 'First-party operational attribution snapshots for package-specific browser journeys.';



COMMENT ON COLUMN "public"."funnel_sessions"."visitor_id" IS 'Stable first-party browser identifier linking multiple package journeys.';



COMMENT ON COLUMN "public"."funnel_sessions"."landing_variant" IS 'Historical landing variant shown for this journey, retained independently from offer_variant.';



COMMENT ON COLUMN "public"."funnel_sessions"."offer_variant" IS 'Historical offer variant shown for this journey, retained independently from landing_variant.';



COMMENT ON COLUMN "public"."funnel_sessions"."first_touch" IS 'Compact first-touch reporting metadata captured when this package journey began; never overwritten by later events.';



COMMENT ON COLUMN "public"."funnel_sessions"."purchase_reference" IS 'Provider-specific reference for the first confirmed purchase recorded for this journey.';



COMMENT ON COLUMN "public"."funnel_sessions"."quiz_variant" IS 'Immutable registered quiz experience shown for this journey.';



COMMENT ON COLUMN "public"."funnel_sessions"."is_internal_test" IS 'True only for a server-authorized production QA assignment; excluded from experiment reporting.';



CREATE TABLE IF NOT EXISTS "public"."hair_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hair_texture" "text",
    "thickness" "text",
    "concerns" "text"[] DEFAULT '{}'::"text"[],
    "products_used" "text",
    "heat_styling" "text",
    "styling_tools" "text"[],
    "goals" "text"[] DEFAULT '{}'::"text"[],
    "additional_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "conversation_memory" "text",
    "cuticle_condition" "text",
    "protein_moisture_balance" "text",
    "scalp_type" "text",
    "chemical_treatment" "text"[] DEFAULT '{}'::"text"[],
    "scalp_condition" "text",
    "routine_preference" "text",
    "desired_volume" "text",
    "density" "text",
    "towel_material" "text",
    "towel_technique" "text",
    "drying_method" "text",
    "brush_type" "text"[],
    "night_protection" "text"[],
    "uses_heat_protection" boolean DEFAULT false NOT NULL,
    "hair_length" "text",
    CONSTRAINT "hair_profiles_brush_type_check" CHECK ((("brush_type" IS NULL) OR ("brush_type" <@ ARRAY['wide_tooth_comb'::"text", 'detangling'::"text", 'paddle'::"text", 'round'::"text", 'boar_bristle'::"text", 'fingers'::"text"]))),
    CONSTRAINT "hair_profiles_density_check" CHECK ((("density" IS NULL) OR ("density" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))),
    CONSTRAINT "hair_profiles_desired_volume_check" CHECK ((("desired_volume" IS NULL) OR ("desired_volume" = ANY (ARRAY['less'::"text", 'balanced'::"text", 'more'::"text"])))),
    CONSTRAINT "hair_profiles_drying_method_valid" CHECK ((("drying_method" IS NULL) OR ("drying_method" = ANY (ARRAY['air_dry'::"text", 'blow_dry'::"text", 'blow_dry_diffuser'::"text"])))),
    CONSTRAINT "hair_profiles_hair_length_check" CHECK ((("hair_length" IS NULL) OR ("hair_length" = ANY (ARRAY['very_short'::"text", 'short'::"text", 'medium'::"text", 'long'::"text", 'very_long'::"text"])))),
    CONSTRAINT "hair_profiles_hair_texture_check" CHECK ((("hair_texture" IS NULL) OR ("hair_texture" = ANY (ARRAY['straight'::"text", 'wavy'::"text", 'curly'::"text", 'coily'::"text"])))),
    CONSTRAINT "hair_profiles_routine_preference_valid" CHECK ((("routine_preference" IS NULL) OR ("routine_preference" = ANY (ARRAY['minimal'::"text", 'balanced'::"text", 'advanced'::"text"])))),
    CONSTRAINT "hair_profiles_thickness_check" CHECK (("thickness" = ANY (ARRAY['fine'::"text", 'normal'::"text", 'coarse'::"text"]))),
    CONSTRAINT "hair_profiles_towel_material_check" CHECK ((("towel_material" IS NULL) OR ("towel_material" = ANY (ARRAY['frottee'::"text", 'mikrofaser'::"text", 'tshirt'::"text", 'turban_mikrofaser'::"text", 'no_towel'::"text"])))),
    CONSTRAINT "hair_profiles_towel_technique_check" CHECK (("towel_technique" = ANY (ARRAY['rough_rubbing'::"text", 'gentle_press'::"text"])))
);


ALTER TABLE "public"."hair_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "marketing_consent" boolean DEFAULT false,
    "quiz_answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_insight" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "share_quote" "text",
    "status" "text" DEFAULT 'captured'::"text" NOT NULL,
    "artifact_email_status" "text",
    "artifact_email_claimed_at" timestamp with time zone,
    "artifact_email_sent_at" timestamp with time zone,
    "artifact_email_failed_at" timestamp with time zone,
    "artifact_email_error" "text",
    "quiz_kind" "text" DEFAULT 'legacy'::"text" NOT NULL,
    CONSTRAINT "leads_artifact_email_status_check" CHECK ((("artifact_email_status" IS NULL) OR ("artifact_email_status" = ANY (ARRAY['sending'::"text", 'sent'::"text", 'failed'::"text"])))),
    CONSTRAINT "leads_quiz_kind_check" CHECK (("quiz_kind" = ANY (ARRAY['legacy'::"text", 'personal_plan'::"text"]))),
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['captured'::"text", 'analyzed'::"text", 'linked'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manual_access_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "reason" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "manual_access_grants_check" CHECK ((("user_id" IS NOT NULL) OR ("email" IS NOT NULL))),
    CONSTRAINT "manual_access_grants_check1" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "created_at"))),
    CONSTRAINT "manual_access_grants_email_check" CHECK ((("email" IS NULL) OR ("email" = "lower"("email")))),
    CONSTRAINT "manual_access_grants_reason_check" CHECK (("reason" = ANY (ARRAY['friend'::"text", 'tester'::"text", 'admin'::"text", 'support'::"text"])))
);


ALTER TABLE "public"."manual_access_grants" OWNER TO "postgres";


COMMENT ON TABLE "public"."manual_access_grants" IS 'Internal non-payment Premium access grants for friends, testers, support, and admin use.';



COMMENT ON COLUMN "public"."manual_access_grants"."email" IS 'Lowercase email address. Allows granting access before the profile row is linked.';



COMMENT ON COLUMN "public"."manual_access_grants"."expires_at" IS 'Null means indefinite-time manual access. Set revoked_at to remove access immediately.';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text",
    "product_recommendations" "jsonb",
    "rag_context" "jsonb",
    "token_usage" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "langfuse_trace_id" "text",
    "langfuse_trace_url" "text",
    "user_feedback_score" smallint,
    "user_feedback_at" timestamp with time zone,
    "message_context" "jsonb",
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"]))),
    CONSTRAINT "messages_user_feedback_score_check" CHECK (("user_feedback_score" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."messages"."message_context" IS 'Assistant message workflow and decision metadata. Replaces legacy rag_context after expand-and-contract migration.';



CREATE TABLE IF NOT EXISTS "public"."paypal_checkout_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "interval" "text" NOT NULL,
    "source" "text" NOT NULL,
    "lead_id" "uuid",
    "email" "text",
    "user_id" "uuid",
    "provider_subscription_id" "text",
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "duplicate_reason" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reactivation_reservation_id" "uuid",
    CONSTRAINT "paypal_checkout_intents_interval_check" CHECK (("interval" = ANY (ARRAY['month'::"text", 'quarter'::"text", 'year'::"text"]))),
    CONSTRAINT "paypal_checkout_intents_source_check" CHECK (("source" = ANY (ARRAY['pricing_page'::"text", 'quiz_result_offer'::"text"]))),
    CONSTRAINT "paypal_checkout_intents_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'approved'::"text", 'duplicate'::"text", 'activated'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."paypal_checkout_intents" OWNER TO "postgres";


COMMENT ON TABLE "public"."paypal_checkout_intents" IS 'Short-lived PayPal checkout tokens used before post-payment account activation.';



COMMENT ON COLUMN "public"."paypal_checkout_intents"."reactivation_reservation_id" IS 'Canonical membership reactivation reservation; at most one PayPal checkout intent may own it.';



CREATE TABLE IF NOT EXISTS "public"."paypal_expired_order_reset_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "intent_id" "uuid" NOT NULL,
    "prior_provider_order_id" "text" NOT NULL,
    "provider_state" "text" NOT NULL,
    "provider_verified_at" timestamp with time zone NOT NULL,
    "reset_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requested_by" "text" DEFAULT CURRENT_USER NOT NULL,
    CONSTRAINT "paypal_expired_order_reset_audit_prior_provider_order_id_check" CHECK (("length"(TRIM(BOTH FROM "prior_provider_order_id")) > 0)),
    CONSTRAINT "paypal_expired_order_reset_audit_provider_state_check" CHECK (("provider_state" = 'voided'::"text"))
);


ALTER TABLE "public"."paypal_expired_order_reset_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."paypal_expired_order_reset_audit" IS 'Append-only service-only audit for narrowly resetting expired PayPal orders proven uncaptured externally.';



CREATE TABLE IF NOT EXISTS "public"."paypal_order_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "user_id" "uuid",
    "lead_id" "uuid" NOT NULL,
    "funnel_session_id" "uuid" NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "checkout_attempt_id" "uuid" NOT NULL,
    "product_kind" "text" NOT NULL,
    "provider_order_id" "text",
    "provider_capture_id" "text",
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "paypal_order_intents_check" CHECK ((("provider_capture_id" IS NULL) OR ("status" = 'captured'::"text"))),
    CONSTRAINT "paypal_order_intents_email_check" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "paypal_order_intents_product_kind_check" CHECK (("product_kind" = 'personal_plan_once'::"text")),
    CONSTRAINT "paypal_order_intents_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'approved'::"text", 'captured'::"text", 'duplicate'::"text", 'failed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."paypal_order_intents" OWNER TO "postgres";


COMMENT ON TABLE "public"."paypal_order_intents" IS 'Service-owned opaque PayPal Orders v2 recovery records bound to canonical consent.';



CREATE TABLE IF NOT EXISTS "public"."personal_plan_one_time_checkout_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "funnel_session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "product_kind" "text" NOT NULL,
    "offer_variant" "text" NOT NULL,
    "copy_version" "text" NOT NULL,
    "consent_text" "text" NOT NULL,
    "consent_text_sha256" "text" NOT NULL,
    "accepted_at" timestamp with time zone NOT NULL,
    "stripe_checkout_session_id" "text",
    "paypal_order_id" "text",
    "paypal_capture_id" "text",
    "confirmation_provider" "text",
    "confirmation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "confirmation_reference" "text",
    "confirmation_sent_at" timestamp with time zone,
    "confirmation_delivered_at" timestamp with time zone,
    "generation_started_at" timestamp with time zone,
    "generation_completed_at" timestamp with time zone,
    "generated_content_sha256" "text",
    "delivery_provider" "text",
    "delivery_reference" "text",
    "delivered_at" timestamp with time zone,
    "first_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "personal_plan_one_time_checkout__generated_content_sha256_check" CHECK ((("generated_content_sha256" IS NULL) OR ("generated_content_sha256" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "personal_plan_one_time_checkout_conse_confirmation_status_check" CHECK (("confirmation_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'failed'::"text"]))),
    CONSTRAINT "personal_plan_one_time_checkout_conse_consent_text_sha256_check" CHECK (("consent_text_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "personal_plan_one_time_checkout_consents_check" CHECK ((NOT (("stripe_checkout_session_id" IS NOT NULL) AND ("paypal_order_id" IS NOT NULL)))),
    CONSTRAINT "personal_plan_one_time_checkout_consents_check1" CHECK (((("confirmation_status" = 'pending'::"text") AND ("confirmation_provider" IS NULL) AND ("confirmation_reference" IS NULL) AND ("confirmation_sent_at" IS NULL) AND ("confirmation_delivered_at" IS NULL)) OR (("confirmation_status" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'failed'::"text"])) AND ("confirmation_provider" IS NOT NULL) AND ("confirmation_reference" IS NOT NULL) AND ("confirmation_sent_at" IS NOT NULL)))),
    CONSTRAINT "personal_plan_one_time_checkout_consents_check2" CHECK ((("confirmation_delivered_at" IS NULL) OR ("confirmation_status" = 'delivered'::"text"))),
    CONSTRAINT "personal_plan_one_time_checkout_consents_check4" CHECK ((("generation_completed_at" IS NULL) OR ("generation_started_at" IS NOT NULL))),
    CONSTRAINT "personal_plan_one_time_checkout_consents_check5" CHECK ((("delivered_at" IS NULL) OR ("generation_completed_at" IS NOT NULL))),
    CONSTRAINT "personal_plan_one_time_checkout_consents_check6" CHECK ((("first_accessed_at" IS NULL) OR ("delivered_at" IS NOT NULL))),
    CONSTRAINT "personal_plan_one_time_checkout_consents_product_kind_check" CHECK (("product_kind" = 'personal_plan_once'::"text")),
    CONSTRAINT "personal_plan_one_time_delivery_evidence_complete" CHECK ((("delivered_at" IS NULL) OR (("generation_started_at" IS NOT NULL) AND ("generation_completed_at" IS NOT NULL) AND ("generated_content_sha256" IS NOT NULL) AND ("delivery_provider" IS NOT NULL) AND ("delivery_reference" IS NOT NULL)))),
    CONSTRAINT "personal_plan_one_time_generation_requires_confirmation_sent" CHECK ((("generation_started_at" IS NULL) OR ("confirmation_status" = ANY (ARRAY['sent'::"text", 'delivered'::"text"]))))
);


ALTER TABLE "public"."personal_plan_one_time_checkout_consents" OWNER TO "postgres";


COMMENT ON TABLE "public"."personal_plan_one_time_checkout_consents" IS 'Service-written immutable purchase-context and fulfillment identity records. Legacy copy versions retain historical explicit-waiver evidence. Rows with copy_version purchase_context_refund_v1 store a server-created purchase-context and refund-policy snapshot; for those rows accepted_at is the server-created purchase-context timestamp, not user acceptance. consent_text and consent_text_sha256 are compatibility column names. Confirmation, generation, delivery, and first-access fields remain lifecycle evidence.';



COMMENT ON COLUMN "public"."personal_plan_one_time_checkout_consents"."consent_text" IS 'Compatibility column name containing historical waiver text or the neutral purchase-context snapshot selected by copy_version.';



COMMENT ON COLUMN "public"."personal_plan_one_time_checkout_consents"."consent_text_sha256" IS 'SHA-256 of consent_text; compatibility column name retained for immutable historical and purchase-context rows.';



COMMENT ON COLUMN "public"."personal_plan_one_time_checkout_consents"."accepted_at" IS 'Compatibility column: explicit acceptance time for historical waiver versions; server-created purchase-context timestamp for purchase_context_refund_v1.';



COMMENT ON CONSTRAINT "personal_plan_one_time_generation_requires_confirmation_sent" ON "public"."personal_plan_one_time_checkout_consents" IS 'Plan generation may begin after the required durable-medium confirmation was accepted by the transactional email provider.';



CREATE TABLE IF NOT EXISTS "public"."personal_plan_prepared_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "answer_hash" "text" NOT NULL,
    "claim_token_hash" "text" NOT NULL,
    "quiz_answers" "jsonb" NOT NULL,
    "canonical_profile" "jsonb" NOT NULL,
    "fallback_metadata" "jsonb" NOT NULL,
    "priorities" "jsonb" NOT NULL,
    "diagnostic_scores" "jsonb" NOT NULL,
    "public_offer_model" "jsonb" NOT NULL,
    "locked_plan" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'prepared'::"text" NOT NULL,
    "lead_id" "uuid",
    "user_id" "uuid",
    "superseded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attached_at" timestamp with time zone,
    "user_attached_at" timestamp with time zone,
    CONSTRAINT "personal_plan_prepared_artifact_attachment_check" CHECK (((("status" = 'prepared'::"text") AND ("lead_id" IS NULL) AND ("attached_at" IS NULL) AND ("superseded_by" IS NULL)) OR (("status" = 'attached'::"text") AND ("lead_id" IS NOT NULL) AND ("attached_at" IS NOT NULL) AND ("superseded_by" IS NULL)) OR (("status" = 'superseded'::"text") AND ("lead_id" IS NOT NULL) AND ("attached_at" IS NOT NULL) AND ("superseded_by" IS NOT NULL)))),
    CONSTRAINT "personal_plan_prepared_artifacts_answer_hash_check" CHECK (("answer_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "personal_plan_prepared_artifacts_claim_token_hash_check" CHECK (("claim_token_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "personal_plan_prepared_artifacts_status_check" CHECK (("status" = ANY (ARRAY['prepared'::"text", 'attached'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."personal_plan_prepared_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_plan_quiz_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resume_token_hash" "text" NOT NULL,
    "funnel_session_id" "uuid" NOT NULL,
    "browser_generation" integer DEFAULT 1 NOT NULL,
    "revision" integer DEFAULT 1 NOT NULL,
    "draft" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "personal_plan_quiz_drafts_browser_generation_check" CHECK (("browser_generation" >= 1)),
    CONSTRAINT "personal_plan_quiz_drafts_expiry_bound" CHECK (("expires_at" <= ("created_at" + '7 days'::interval))),
    CONSTRAINT "personal_plan_quiz_drafts_resume_token_hash_check" CHECK (("resume_token_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "personal_plan_quiz_drafts_revision_check" CHECK (("revision" >= 1)),
    CONSTRAINT "personal_plan_quiz_drafts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."personal_plan_quiz_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_bondbuilder_specs" (
    "product_id" "uuid" NOT NULL,
    "bond_repair_intensity" "text" NOT NULL,
    "application_mode" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bond_repair_axis" "text" NOT NULL,
    "treatment_mode" "text" NOT NULL,
    "product_format" "text" NOT NULL,
    "usage_protocol" "text" NOT NULL,
    CONSTRAINT "product_bondbuilder_specs_application_mode_check" CHECK (("application_mode" = ANY (ARRAY['pre_shampoo'::"text", 'post_wash_leave_in'::"text"]))),
    CONSTRAINT "product_bondbuilder_specs_bond_repair_axis_check" CHECK (("bond_repair_axis" = ANY (ARRAY['disulfide_crosslink'::"text", 'peptide_chain'::"text"]))),
    CONSTRAINT "product_bondbuilder_specs_bond_repair_intensity_check" CHECK (("bond_repair_intensity" = ANY (ARRAY['maintenance'::"text", 'intensive'::"text"]))),
    CONSTRAINT "product_bondbuilder_specs_product_format_check" CHECK (("product_format" = ANY (ARRAY['cream_treatment'::"text", 'primer_treatment'::"text", 'leave_in_mask'::"text", 'spray_treatment'::"text"]))),
    CONSTRAINT "product_bondbuilder_specs_treatment_mode_check" CHECK (("treatment_mode" = ANY (ARRAY['rinse_out'::"text", 'leave_in'::"text"]))),
    CONSTRAINT "product_bondbuilder_specs_usage_protocol_check" CHECK (("usage_protocol" = ANY (ARRAY['olaplex_3plus'::"text", 'olaplex_0_booster'::"text", 'olaplex_3_legacy'::"text", 'k18_leave_in'::"text", 'epres_spray'::"text"])))
);


ALTER TABLE "public"."product_bondbuilder_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_categories" (
    "key" "text" NOT NULL,
    "display_name_de" "text" NOT NULL,
    "is_catalog_supported" boolean DEFAULT false NOT NULL,
    "is_intake_supported" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_conditioner_rerank_specs" (
    "product_id" "uuid" NOT NULL,
    "weight" "text" NOT NULL,
    "repair_level" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "balance_direction" "text",
    "ingredient_flags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "product_conditioner_rerank_specs_balance_direction_check" CHECK ((("balance_direction" IS NULL) OR ("balance_direction" = ANY (ARRAY['protein'::"text", 'moisture'::"text", 'balanced'::"text"])))),
    CONSTRAINT "product_conditioner_rerank_specs_ingredient_flags_check" CHECK (("ingredient_flags" <@ ARRAY['silicones'::"text", 'polymers'::"text", 'oils'::"text", 'proteins'::"text", 'humectants'::"text"])),
    CONSTRAINT "product_conditioner_rerank_specs_repair_level_check" CHECK (("repair_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "product_conditioner_rerank_specs_weight_check" CHECK (("weight" = ANY (ARRAY['light'::"text", 'medium'::"text", 'rich'::"text"])))
);


ALTER TABLE "public"."product_conditioner_rerank_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_conditioner_specs" (
    "product_id" "uuid" NOT NULL,
    "thickness" "text" NOT NULL,
    "protein_moisture_balance" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_conditioner_specs_protein_moisture_balance_check" CHECK (("protein_moisture_balance" = ANY (ARRAY['snaps'::"text", 'stretches_bounces'::"text", 'stretches_stays'::"text"]))),
    CONSTRAINT "product_conditioner_specs_thickness_check" CHECK (("thickness" = ANY (ARRAY['fine'::"text", 'normal'::"text", 'coarse'::"text"])))
);


ALTER TABLE "public"."product_conditioner_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_deep_cleansing_shampoo_specs" (
    "product_id" "uuid" NOT NULL,
    "scalp_type_focus" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reset_intensity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "reset_focus" "text" DEFAULT 'product_sebum_buildup'::"text" NOT NULL,
    "color_treated_suitability" "text" DEFAULT 'unsuitable_or_unknown'::"text" NOT NULL,
    CONSTRAINT "product_deep_cleansing_shampoo_specs_color_treated_suitability_" CHECK (("color_treated_suitability" = ANY (ARRAY['suitable'::"text", 'unsuitable_or_unknown'::"text"]))),
    CONSTRAINT "product_deep_cleansing_shampoo_specs_reset_focus_check" CHECK (("reset_focus" = ANY (ARRAY['product_sebum_buildup'::"text", 'metal_mineral_hard_water'::"text", 'broad_spectrum_detox'::"text"]))),
    CONSTRAINT "product_deep_cleansing_shampoo_specs_reset_intensity_check" CHECK (("reset_intensity" = ANY (ARRAY['gentle'::"text", 'medium'::"text", 'strong'::"text"]))),
    CONSTRAINT "product_deep_cleansing_shampoo_specs_scalp_type_focus_check" CHECK (("scalp_type_focus" = ANY (ARRAY['oily'::"text", 'balanced'::"text", 'dry'::"text"])))
);


ALTER TABLE "public"."product_deep_cleansing_shampoo_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_dry_shampoo_specs" (
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "primary_effect" "text" NOT NULL,
    "hair_color_fit" "text" NOT NULL,
    "scalp_sensitivity_fit" "text" NOT NULL,
    "format" "text" NOT NULL,
    CONSTRAINT "product_dry_shampoo_specs_format_check" CHECK (("format" = ANY (ARRAY['aerosol_spray'::"text", 'powder'::"text", 'foam_or_liquid'::"text"]))),
    CONSTRAINT "product_dry_shampoo_specs_hair_color_fit_check" CHECK (("hair_color_fit" = ANY (ARRAY['universal'::"text", 'blonde_light'::"text", 'brown'::"text", 'dark'::"text"]))),
    CONSTRAINT "product_dry_shampoo_specs_primary_effect_check" CHECK (("primary_effect" = ANY (ARRAY['classic_refresh'::"text", 'volume_texture'::"text", 'sensitive_refresh'::"text"]))),
    CONSTRAINT "product_dry_shampoo_specs_scalp_sensitivity_fit_check" CHECK (("scalp_sensitivity_fit" = ANY (ARRAY['sensitive_ok'::"text", 'normal_only'::"text"])))
);


ALTER TABLE "public"."product_dry_shampoo_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_identifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "identifier_type" "text" NOT NULL,
    "identifier_value" "text" NOT NULL,
    "source" "text" DEFAULT 'curated'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "normalized_identifier_value" "text" GENERATED ALWAYS AS ("public"."product_intake_review_normalize_identifier_value"("identifier_type", "identifier_value")) STORED,
    CONSTRAINT "product_identifiers_type_check" CHECK (("identifier_type" = ANY (ARRAY['ean'::"text", 'gtin'::"text", 'barcode'::"text", 'retailer_sku'::"text", 'retailer_url'::"text"])))
);


ALTER TABLE "public"."product_identifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_image_assets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'product-images'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "source_page_url" "text" NOT NULL,
    "source_image_url" "text",
    "source_type" "text" NOT NULL,
    "quality_confidence" "text" NOT NULL,
    "processing_method" "text" NOT NULL,
    "asset_sha256" "text" NOT NULL,
    "manifest_batch_id" "text" NOT NULL,
    "user_approved" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_image_assets_asset_sha256_check" CHECK (("asset_sha256" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "product_image_assets_processing_method_check" CHECK (("processing_method" = ANY (ARRAY['local'::"text", 'third_party'::"text", 'manual'::"text"]))),
    CONSTRAINT "product_image_assets_quality_confidence_check" CHECK (("quality_confidence" = ANY (ARRAY['high'::"text", 'medium'::"text"]))),
    CONSTRAINT "product_image_assets_source_type_check" CHECK (("source_type" = ANY (ARRAY['brand'::"text", 'retailer'::"text", 'marketplace'::"text", 'search_result'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."product_image_assets" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_image_assets" IS 'Flat provenance table for approved published product image assets. Messy candidate research stays local.';



CREATE TABLE IF NOT EXISTS "public"."product_intake_research_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "submission_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confidence" numeric,
    "source_urls" "text"[],
    "model" "text",
    "prompt_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_intake_research_artifacts_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))),
    CONSTRAINT "product_intake_research_artifacts_kind_check" CHECK (("kind" = ANY (ARRAY['identity_candidate'::"text", 'existing_product_match'::"text", 'source_page'::"text", 'property_extract'::"text", 'property_synthesis'::"text", 'image_candidate'::"text", 'image_judgment'::"text", 'processed_image'::"text", 'publication_preview'::"text", 'publish_result'::"text"])))
);


ALTER TABLE "public"."product_intake_research_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_intake_review_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "field_path" "text" NOT NULL,
    "decision" "text" NOT NULL,
    "proposed_value" "jsonb",
    "reviewer_value" "jsonb",
    "comment" "text",
    "reviewed_by" "text" NOT NULL,
    "reviewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_intake_review_decisions_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'change_requested'::"text", 'image_approved'::"text", 'image_rejected'::"text", 'publish_approved'::"text", 'needs_more_info'::"text", 'reject'::"text"])))
);


ALTER TABLE "public"."product_intake_review_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_leave_in_eligibility" (
    "product_id" "uuid" NOT NULL,
    "thickness" "text" NOT NULL,
    "need_bucket" "text" NOT NULL,
    "styling_context" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_leave_in_eligibility_need_bucket_check" CHECK (("need_bucket" = ANY (ARRAY['heat_protect'::"text", 'curl_definition'::"text", 'repair'::"text", 'moisture_anti_frizz'::"text", 'shine_protect'::"text"]))),
    CONSTRAINT "product_leave_in_eligibility_styling_context_check" CHECK (("styling_context" = ANY (ARRAY['air_dry'::"text", 'non_heat_style'::"text", 'heat_style'::"text"]))),
    CONSTRAINT "product_leave_in_eligibility_thickness_check" CHECK (("thickness" = ANY (ARRAY['fine'::"text", 'normal'::"text", 'coarse'::"text"])))
);


ALTER TABLE "public"."product_leave_in_eligibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_leave_in_fit_specs" (
    "product_id" "uuid" NOT NULL,
    "weight" "text" NOT NULL,
    "conditioner_relationship" "text" NOT NULL,
    "care_benefits" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_leave_in_fit_specs_care_benefits_check" CHECK (("care_benefits" <@ ARRAY['heat_protect'::"text", 'curl_definition'::"text", 'repair'::"text", 'detangle_smooth'::"text"])),
    CONSTRAINT "product_leave_in_fit_specs_conditioner_relationship_check" CHECK (("conditioner_relationship" = ANY (ARRAY['replacement_capable'::"text", 'booster_only'::"text"]))),
    CONSTRAINT "product_leave_in_fit_specs_weight_check" CHECK (("weight" = ANY (ARRAY['light'::"text", 'medium'::"text", 'rich'::"text"])))
);


ALTER TABLE "public"."product_leave_in_fit_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_leave_in_specs" (
    "product_id" "uuid" NOT NULL,
    "format" "text" NOT NULL,
    "weight" "text" NOT NULL,
    "roles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "provides_heat_protection" boolean DEFAULT false NOT NULL,
    "heat_protection_max_c" integer,
    "heat_activation_required" boolean DEFAULT false NOT NULL,
    "care_benefits" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ingredient_flags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "application_stage" "text"[] DEFAULT '{towel_dry}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_leave_in_specs_application_stage_check" CHECK (("application_stage" <@ ARRAY['towel_dry'::"text", 'dry_hair'::"text", 'pre_heat'::"text", 'post_style'::"text"])),
    CONSTRAINT "product_leave_in_specs_care_benefits_check" CHECK (("care_benefits" <@ ARRAY['moisture'::"text", 'protein'::"text", 'repair'::"text", 'detangling'::"text", 'anti_frizz'::"text", 'shine'::"text", 'curl_definition'::"text", 'volume'::"text"])),
    CONSTRAINT "product_leave_in_specs_format_check" CHECK (("format" = ANY (ARRAY['spray'::"text", 'milk'::"text", 'lotion'::"text", 'cream'::"text", 'serum'::"text"]))),
    CONSTRAINT "product_leave_in_specs_heat_activation_requires_styling_role" CHECK ((("heat_activation_required" = false) OR ("roles" @> ARRAY['styling_prep'::"text"]))),
    CONSTRAINT "product_leave_in_specs_heat_protection_temp_requires_flag" CHECK ((("heat_protection_max_c" IS NULL) OR ("provides_heat_protection" = true))),
    CONSTRAINT "product_leave_in_specs_ingredient_flags_check" CHECK (("ingredient_flags" <@ ARRAY['silicones'::"text", 'polymers'::"text", 'oils'::"text", 'proteins'::"text", 'humectants'::"text"])),
    CONSTRAINT "product_leave_in_specs_roles_check" CHECK (("roles" <@ ARRAY['replacement_conditioner'::"text", 'extension_conditioner'::"text", 'styling_prep'::"text", 'oil_replacement'::"text"])),
    CONSTRAINT "product_leave_in_specs_weight_check" CHECK (("weight" = ANY (ARRAY['light'::"text", 'medium'::"text", 'rich'::"text"])))
);


ALTER TABLE "public"."product_leave_in_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "canonical_name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_mask_specs" (
    "product_id" "uuid" NOT NULL,
    "weight" "text" NOT NULL,
    "concentration" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "balance_direction" "text",
    "ingredient_flags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "product_mask_specs_balance_direction_check" CHECK ((("balance_direction" IS NULL) OR ("balance_direction" = ANY (ARRAY['protein'::"text", 'moisture'::"text", 'balanced'::"text"])))),
    CONSTRAINT "product_mask_specs_concentration_check" CHECK (("concentration" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "product_mask_specs_ingredient_flags_check" CHECK (("ingredient_flags" <@ ARRAY['silicones'::"text", 'polymers'::"text", 'oils'::"text", 'proteins'::"text", 'humectants'::"text"])),
    CONSTRAINT "product_mask_specs_weight_check" CHECK (("weight" = ANY (ARRAY['light'::"text", 'medium'::"text", 'rich'::"text"])))
);


ALTER TABLE "public"."product_mask_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_oil_eligibility" (
    "product_id" "uuid" NOT NULL,
    "thickness" "text" NOT NULL,
    "oil_subtype" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "oil_purpose" "text",
    "ingredient_flags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "product_oil_eligibility_ingredient_flags_check" CHECK (("ingredient_flags" <@ ARRAY['silicones'::"text", 'polymers'::"text", 'oils'::"text", 'proteins'::"text", 'humectants'::"text"])),
    CONSTRAINT "product_oil_eligibility_oil_purpose_check" CHECK ((("oil_purpose" IS NULL) OR ("oil_purpose" = ANY (ARRAY['pre_wash_oiling'::"text", 'styling_finish'::"text", 'light_finish'::"text"])))),
    CONSTRAINT "product_oil_eligibility_oil_subtype_check" CHECK (("oil_subtype" = ANY (ARRAY['natuerliches-oel'::"text", 'styling-oel'::"text", 'trocken-oel'::"text"]))),
    CONSTRAINT "product_oil_eligibility_thickness_check" CHECK (("thickness" = ANY (ARRAY['fine'::"text", 'normal'::"text", 'coarse'::"text"])))
);


ALTER TABLE "public"."product_oil_eligibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_peeling_specs" (
    "product_id" "uuid" NOT NULL,
    "scalp_type_focus" "text" NOT NULL,
    "peeling_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_peeling_specs_peeling_type_check" CHECK (("peeling_type" = ANY (ARRAY['acid_serum'::"text", 'physical_scrub'::"text"]))),
    CONSTRAINT "product_peeling_specs_scalp_type_focus_check" CHECK (("scalp_type_focus" = ANY (ARRAY['oily'::"text", 'balanced'::"text", 'dry'::"text"])))
);


ALTER TABLE "public"."product_peeling_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_relationships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_product_id" "uuid" NOT NULL,
    "target_product_id" "uuid" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_relationships_check" CHECK (("source_product_id" <> "target_product_id")),
    CONSTRAINT "product_relationships_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['replaced_by'::"text", 'add_on_for'::"text"])))
);


ALTER TABLE "public"."product_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_shampoo_specs" (
    "product_id" "uuid" NOT NULL,
    "thickness" "text" NOT NULL,
    "shampoo_bucket" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scalp_route" "text",
    "cleansing_intensity" "text",
    CONSTRAINT "product_shampoo_specs_cleansing_intensity_check" CHECK ((("cleansing_intensity" IS NULL) OR ("cleansing_intensity" = ANY (ARRAY['gentle'::"text", 'regular'::"text", 'clarifying'::"text"])))),
    CONSTRAINT "product_shampoo_specs_scalp_route_check" CHECK ((("scalp_route" IS NULL) OR ("scalp_route" = ANY (ARRAY['oily'::"text", 'balanced'::"text", 'dry'::"text", 'dandruff'::"text", 'dry_flakes'::"text", 'irritated'::"text"])))),
    CONSTRAINT "product_shampoo_specs_shampoo_bucket_check" CHECK (("shampoo_bucket" = ANY (ARRAY['schuppen'::"text", 'irritationen'::"text", 'normal'::"text", 'dehydriert-fettig'::"text", 'trocken'::"text"]))),
    CONSTRAINT "product_shampoo_specs_thickness_check" CHECK (("thickness" = ANY (ARRAY['fine'::"text", 'normal'::"text", 'coarse'::"text"])))
);


ALTER TABLE "public"."product_shampoo_specs" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_shampoo_specs" IS 'Canonical shampoo eligibility pairs managed via source data ingest.';



CREATE TABLE IF NOT EXISTS "public"."product_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_product_usage_id" "uuid",
    "source" "text" NOT NULL,
    "source_conversation_id" "uuid",
    "intake_method" "text" NOT NULL,
    "category" "text" NOT NULL,
    "brand_text" "text",
    "product_name_text" "text",
    "frequency_range" "text" NOT NULL,
    "front_image_path" "text",
    "barcode_image_path" "text",
    "front_image_validation_status" "text",
    "front_image_validation_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "barcode_image_validation_status" "text",
    "barcode_image_validation_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "previous_product_id" "uuid",
    "previous_product_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "researched_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "intake_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "approved_product_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "text",
    "review_notes" "text",
    "user_facing_resolution_reason" "text",
    "user_facing_next_step" "text",
    "user_facing_missing_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notification_sent_at" timestamp with time zone,
    "cleanup_after" timestamp with time zone,
    "photos_deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_submissions_barcode_image_validation_status_check" CHECK ((("barcode_image_validation_status" IS NULL) OR ("barcode_image_validation_status" = ANY (ARRAY['valid_barcode'::"text", 'uncertain'::"text", 'not_a_product_photo'::"text", 'unsafe_or_inappropriate'::"text"])))),
    CONSTRAINT "product_submissions_frequency_range_check" CHECK (("frequency_range" = ANY (ARRAY['less_than_monthly'::"text", 'monthly_1x'::"text", 'biweekly_1x'::"text", 'weekly_1x'::"text", 'weekly_2x'::"text", 'weekly_3_4x'::"text", 'weekly_5_6x'::"text", 'daily_1x'::"text"]))),
    CONSTRAINT "product_submissions_front_image_validation_status_check" CHECK ((("front_image_validation_status" IS NULL) OR ("front_image_validation_status" = ANY (ARRAY['valid_product_front'::"text", 'uncertain'::"text", 'not_a_product_photo'::"text", 'unsafe_or_inappropriate'::"text"])))),
    CONSTRAINT "product_submissions_intake_method_check" CHECK (("intake_method" = ANY (ARRAY['manual'::"text", 'photo'::"text"]))),
    CONSTRAINT "product_submissions_source_check" CHECK (("source" = ANY (ARRAY['onboarding'::"text", 'chat'::"text"]))),
    CONSTRAINT "product_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'researching'::"text", 'ready_for_review'::"text", 'needs_more_info'::"text", 'matched_existing'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled_by_user'::"text"]))),
    CONSTRAINT "product_submissions_success_product_check" CHECK ((("status" <> ALL (ARRAY['approved'::"text", 'matched_existing'::"text"])) OR ("approved_product_id" IS NOT NULL)))
);


ALTER TABLE "public"."product_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "description" "text",
    "category" "text",
    "affiliate_link" "text",
    "image_url" "text",
    "price_eur" numeric(10,2),
    "currency" "text" DEFAULT 'EUR'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "suitable_thicknesses" "text"[] DEFAULT '{}'::"text"[],
    "suitable_concerns" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "embedding" "extensions"."vector"(384),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_description" "text",
    "tom_take" "text",
    "lifecycle_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "purchase_link_status" "text",
    "purchase_link_checked_at" timestamp with time zone,
    "price_checked_at" timestamp with time zone,
    "category_key" "text",
    "brand_id" "uuid",
    "product_line_id" "uuid",
    "origin" "text" DEFAULT 'curated'::"text" NOT NULL,
    "is_chaarlie_recommended" boolean DEFAULT true NOT NULL,
    CONSTRAINT "products_lifecycle_status_check" CHECK (("lifecycle_status" = ANY (ARRAY['active'::"text", 'discontinued'::"text"]))),
    CONSTRAINT "products_purchase_link_status_check" CHECK ((("purchase_link_status" IS NULL) OR ("purchase_link_status" = ANY (ARRAY['available'::"text", 'unavailable'::"text"]))))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "is_admin" boolean DEFAULT false,
    "locale" "text" DEFAULT 'de'::"text",
    "subscription_tier_id" "uuid",
    "message_count_this_month" integer DEFAULT 0,
    "message_count_reset_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "onboarding_step" "text" DEFAULT 'welcome'::"text",
    "has_seen_completion_popup" boolean DEFAULT false NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_status" "text",
    "subscription_interval" "text",
    "current_period_end" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."subscription_status" IS 'active | past_due | canceled | incomplete | NULL';



COMMENT ON COLUMN "public"."profiles"."subscription_interval" IS 'month | quarter | year';



CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "window_id" "text" NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routine_log_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "routine_log_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "user_product_usage_id" "uuid",
    "product_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."routine_log_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routine_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "logged_on" "date" NOT NULL,
    "timezone" "text" NOT NULL,
    "day_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_activity_name" "text",
    "client_session_id" "uuid",
    "client_revision" bigint,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "routine_logs_custom_activity_check" CHECK (((("day_type" = 'custom'::"text") AND (("char_length"("btrim"(COALESCE("custom_activity_name", ''::"text"))) >= 1) AND ("char_length"("btrim"(COALESCE("custom_activity_name", ''::"text"))) <= 60))) OR (("day_type" <> 'custom'::"text") AND ("custom_activity_name" IS NULL)))),
    CONSTRAINT "routine_logs_day_type_check" CHECK (("day_type" = ANY (ARRAY['wash'::"text", 'clarifying'::"text", 'treatment_only'::"text", 'styling_only'::"text", 'none'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."routine_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_tiers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "monthly_message_limit" integer DEFAULT 50,
    "can_access_history" boolean DEFAULT true,
    "max_conversations" integer DEFAULT 20,
    "price_eur_monthly" numeric(10,2),
    "price_eur_yearly" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tracker_nudge_dismissals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "dismissed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reappear_at" timestamp with time zone NOT NULL,
    CONSTRAINT "tracker_nudge_dismissals_direction_check" CHECK (("direction" = ANY (ARRAY['increase'::"text", 'decrease'::"text"])))
);


ALTER TABLE "public"."tracker_nudge_dismissals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_product_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "product_name" "text",
    "frequency_range" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "brand_text" "text",
    "product_id" "uuid",
    "product_submission_id" "uuid",
    "match_status" "text" DEFAULT 'text_only'::"text" NOT NULL,
    "intake_method" "text",
    "source" "text",
    "front_image_path" "text",
    CONSTRAINT "user_product_usage_added_product_frequency_check" CHECK ((("frequency_range" IS NOT NULL) OR (("product_name" IS NULL) AND ("brand_text" IS NULL) AND ("product_id" IS NULL) AND ("product_submission_id" IS NULL) AND ("intake_method" IS NULL) AND ("source" IS NULL) AND ("front_image_path" IS NULL)))),
    CONSTRAINT "user_product_usage_frequency_range_check" CHECK ((("frequency_range" IS NULL) OR ("frequency_range" = ANY (ARRAY['less_than_monthly'::"text", 'monthly_1x'::"text", 'biweekly_1x'::"text", 'weekly_1x'::"text", 'weekly_2x'::"text", 'weekly_3_4x'::"text", 'weekly_5_6x'::"text", 'daily_1x'::"text"])))),
    CONSTRAINT "user_product_usage_intake_method_check" CHECK ((("intake_method" IS NULL) OR ("intake_method" = ANY (ARRAY['manual'::"text", 'photo'::"text"])))),
    CONSTRAINT "user_product_usage_match_status_check" CHECK (("match_status" = ANY (ARRAY['text_only'::"text", 'matched'::"text", 'pending_review'::"text", 'needs_more_info'::"text"]))),
    CONSTRAINT "user_product_usage_match_status_link_check" CHECK (((("match_status" = 'text_only'::"text") AND ("product_id" IS NULL) AND ("product_submission_id" IS NULL)) OR (("match_status" = ANY (ARRAY['pending_review'::"text", 'needs_more_info'::"text"])) AND ("product_id" IS NULL) AND ("product_submission_id" IS NOT NULL)) OR (("match_status" = 'matched'::"text") AND ("product_id" IS NOT NULL)))),
    CONSTRAINT "user_product_usage_source_check" CHECK ((("source" IS NULL) OR ("source" = ANY (ARRAY['onboarding'::"text", 'chat'::"text", 'profile'::"text", 'script'::"text"]))))
);


ALTER TABLE "public"."user_product_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist_customerio_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signup_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "message_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "processing_started_at" timestamp with time zone,
    "next_attempt_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "waitlist_customerio_outbox_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "waitlist_customerio_outbox_event_type_check" CHECK (("event_type" = ANY (ARRAY['waitlist_signup'::"text", 'waitlist_survey_completed'::"text"]))),
    CONSTRAINT "waitlist_customerio_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'delivered'::"text", 'failed'::"text", 'failed_permanent'::"text"])))
);


ALTER TABLE "public"."waitlist_customerio_outbox" OWNER TO "postgres";


COMMENT ON TABLE "public"."waitlist_customerio_outbox" IS 'Retry state for asynchronously projecting waitlist registrations to Customer.io.';



CREATE TABLE IF NOT EXISTS "public"."waitlist_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign" "text" NOT NULL,
    "normalized_email" "text" NOT NULL,
    "first_name" "text",
    "marketing_consent" boolean DEFAULT false NOT NULL,
    "attribution" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "survey_token_hash" "text" NOT NULL,
    "survey_response_id" "text",
    "survey_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "waitlist_signups_survey_completion_consistency" CHECK (((("survey_response_id" IS NULL) AND ("survey_completed_at" IS NULL)) OR (("survey_response_id" IS NOT NULL) AND ("survey_completed_at" IS NOT NULL))))
);


ALTER TABLE "public"."waitlist_signups" OWNER TO "postgres";


COMMENT ON TABLE "public"."waitlist_signups" IS 'Authoritative waitlist registrations. Survey completion is client-attested and grants no entitlement. Direct browser access is denied by RLS.';



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."beta_feedback"
    ADD CONSTRAINT "beta_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_analytics_deliveries"
    ADD CONSTRAINT "billing_analytics_deliveries_outbox_id_destination_key" UNIQUE ("outbox_id", "destination");



ALTER TABLE ONLY "public"."billing_analytics_deliveries"
    ADD CONSTRAINT "billing_analytics_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_analytics_outbox"
    ADD CONSTRAINT "billing_analytics_outbox_event_key_key" UNIQUE ("event_key");



ALTER TABLE ONLY "public"."billing_analytics_outbox"
    ADD CONSTRAINT "billing_analytics_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_one_time_purchases"
    ADD CONSTRAINT "billing_one_time_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_one_time_purchases"
    ADD CONSTRAINT "billing_one_time_purchases_provider_provider_transaction_id_key" UNIQUE ("provider", "provider_transaction_id");



ALTER TABLE ONLY "public"."billing_subscription_plan_changes"
    ADD CONSTRAINT "billing_subscription_plan_changes_operation_id_key" UNIQUE ("operation_id");



ALTER TABLE ONLY "public"."billing_subscription_plan_changes"
    ADD CONSTRAINT "billing_subscription_plan_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_provider_provider_subscription_id_key" UNIQUE ("provider", "provider_subscription_id");



ALTER TABLE ONLY "public"."billing_webhook_events"
    ADD CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_webhook_events"
    ADD CONSTRAINT "billing_webhook_events_provider_provider_event_id_key" UNIQUE ("provider", "provider_event_id");



ALTER TABLE ONLY "public"."brand_aliases"
    ADD CONSTRAINT "brand_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_activation_claims"
    ADD CONSTRAINT "checkout_activation_claims_pkey" PRIMARY KEY ("session_hash");



ALTER TABLE ONLY "public"."content_chunks"
    ADD CONSTRAINT "content_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_states"
    ADD CONSTRAINT "conversation_states_pkey" PRIMARY KEY ("conversation_id");



ALTER TABLE ONLY "public"."conversation_turn_traces"
    ADD CONSTRAINT "conversation_turn_traces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_id_user_id_unique" UNIQUE ("id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customerio_profile_sync_outbox"
    ADD CONSTRAINT "customerio_profile_sync_outbox_pkey" PRIMARY KEY ("lead_id");



ALTER TABLE ONLY "public"."daily_quotes"
    ADD CONSTRAINT "daily_quotes_display_date_key" UNIQUE ("display_date");



ALTER TABLE ONLY "public"."daily_quotes"
    ADD CONSTRAINT "daily_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dismissed_suggestions"
    ADD CONSTRAINT "dismissed_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dismissed_suggestions"
    ADD CONSTRAINT "dismissed_suggestions_user_id_category_key" UNIQUE ("user_id", "category");



ALTER TABLE ONLY "public"."funnel_events"
    ADD CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."funnel_sessions"
    ADD CONSTRAINT "funnel_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hair_profiles"
    ADD CONSTRAINT "hair_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hair_profiles"
    ADD CONSTRAINT "hair_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manual_access_grants"
    ADD CONSTRAINT "manual_access_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_reactivation_checkout_reservations"
    ADD CONSTRAINT "membership_reactivation_checkou_user_id_checkout_attempt_id_key" UNIQUE ("user_id", "checkout_attempt_id");



ALTER TABLE ONLY "public"."membership_reactivation_checkout_reservations"
    ADD CONSTRAINT "membership_reactivation_checkout_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paypal_checkout_intents"
    ADD CONSTRAINT "paypal_checkout_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paypal_checkout_intents"
    ADD CONSTRAINT "paypal_checkout_intents_provider_subscription_id_key" UNIQUE ("provider_subscription_id");



ALTER TABLE ONLY "public"."paypal_checkout_intents"
    ADD CONSTRAINT "paypal_checkout_intents_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."paypal_expired_order_reset_audit"
    ADD CONSTRAINT "paypal_expired_order_reset_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paypal_expired_order_reset_audit"
    ADD CONSTRAINT "paypal_expired_order_reset_audit_prior_provider_order_id_key" UNIQUE ("prior_provider_order_id");



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_checkout_attempt_id_key" UNIQUE ("checkout_attempt_id");



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_consent_id_key" UNIQUE ("consent_id");



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_provider_capture_id_key" UNIQUE ("provider_capture_id");



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_provider_order_id_key" UNIQUE ("provider_order_id");



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."personal_plan_one_time_checkout_consents"
    ADD CONSTRAINT "personal_plan_one_time_checkout__stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");



ALTER TABLE ONLY "public"."personal_plan_one_time_checkout_consents"
    ADD CONSTRAINT "personal_plan_one_time_checkout_consents_paypal_capture_id_key" UNIQUE ("paypal_capture_id");



ALTER TABLE ONLY "public"."personal_plan_one_time_checkout_consents"
    ADD CONSTRAINT "personal_plan_one_time_checkout_consents_paypal_order_id_key" UNIQUE ("paypal_order_id");



ALTER TABLE ONLY "public"."personal_plan_one_time_checkout_consents"
    ADD CONSTRAINT "personal_plan_one_time_checkout_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_plan_one_time_fulfillment_jobs"
    ADD CONSTRAINT "personal_plan_one_time_fulfillment_jobs_consent_id_key" UNIQUE ("consent_id");



ALTER TABLE ONLY "public"."personal_plan_one_time_fulfillment_jobs"
    ADD CONSTRAINT "personal_plan_one_time_fulfillment_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_plan_one_time_fulfillment_jobs"
    ADD CONSTRAINT "personal_plan_one_time_fulfillment_jobs_purchase_id_key" UNIQUE ("purchase_id");



ALTER TABLE ONLY "public"."personal_plan_prepared_artifacts"
    ADD CONSTRAINT "personal_plan_prepared_artifacts_claim_token_hash_key" UNIQUE ("claim_token_hash");



ALTER TABLE ONLY "public"."personal_plan_prepared_artifacts"
    ADD CONSTRAINT "personal_plan_prepared_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_plan_quiz_drafts"
    ADD CONSTRAINT "personal_plan_quiz_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_plan_quiz_drafts"
    ADD CONSTRAINT "personal_plan_quiz_drafts_resume_token_hash_key" UNIQUE ("resume_token_hash");



ALTER TABLE ONLY "public"."product_bondbuilder_specs"
    ADD CONSTRAINT "product_bondbuilder_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."product_conditioner_rerank_specs"
    ADD CONSTRAINT "product_conditioner_rerank_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_conditioner_specs"
    ADD CONSTRAINT "product_conditioner_specs_pkey" PRIMARY KEY ("product_id", "thickness", "protein_moisture_balance");



ALTER TABLE ONLY "public"."product_deep_cleansing_shampoo_specs"
    ADD CONSTRAINT "product_deep_cleansing_shampoo_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_dry_shampoo_specs"
    ADD CONSTRAINT "product_dry_shampoo_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_identifiers"
    ADD CONSTRAINT "product_identifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_image_assets"
    ADD CONSTRAINT "product_image_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_intake_research_artifacts"
    ADD CONSTRAINT "product_intake_research_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_intake_research_jobs"
    ADD CONSTRAINT "product_intake_research_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_intake_review_decisions"
    ADD CONSTRAINT "product_intake_review_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_leave_in_eligibility"
    ADD CONSTRAINT "product_leave_in_eligibility_pkey" PRIMARY KEY ("product_id", "thickness", "need_bucket", "styling_context");



ALTER TABLE ONLY "public"."product_leave_in_fit_specs"
    ADD CONSTRAINT "product_leave_in_fit_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_leave_in_specs"
    ADD CONSTRAINT "product_leave_in_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_lines"
    ADD CONSTRAINT "product_lines_brand_id_normalized_name_key" UNIQUE ("brand_id", "normalized_name");



ALTER TABLE ONLY "public"."product_lines"
    ADD CONSTRAINT "product_lines_id_brand_id_key" UNIQUE ("id", "brand_id");



ALTER TABLE ONLY "public"."product_lines"
    ADD CONSTRAINT "product_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_mask_specs"
    ADD CONSTRAINT "product_mask_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_oil_eligibility"
    ADD CONSTRAINT "product_oil_eligibility_pkey" PRIMARY KEY ("product_id", "thickness", "oil_subtype");



ALTER TABLE ONLY "public"."product_peeling_specs"
    ADD CONSTRAINT "product_peeling_specs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_relationships"
    ADD CONSTRAINT "product_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_relationships"
    ADD CONSTRAINT "product_relationships_source_product_id_target_product_id_r_key" UNIQUE ("source_product_id", "target_product_id", "relationship_type");



ALTER TABLE ONLY "public"."product_shampoo_specs"
    ADD CONSTRAINT "product_shampoo_specs_pkey" PRIMARY KEY ("product_id", "thickness", "shampoo_bucket");



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_id_user_id_category_unique" UNIQUE ("id", "user_id", "category");



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_name_category_unique" UNIQUE ("name", "category");



ALTER TABLE "public"."products"
    ADD CONSTRAINT "products_origin_check" CHECK (("origin" = ANY (ARRAY['curated'::"text", 'user_submitted'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key", "window_id");



ALTER TABLE ONLY "public"."routine_log_products"
    ADD CONSTRAINT "routine_log_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routine_logs"
    ADD CONSTRAINT "routine_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routine_logs"
    ADD CONSTRAINT "routine_logs_user_id_logged_on_key" UNIQUE ("user_id", "logged_on");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tracker_nudge_dismissals"
    ADD CONSTRAINT "tracker_nudge_dismissals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tracker_nudge_dismissals"
    ADD CONSTRAINT "tracker_nudge_dismissals_user_id_category_direction_key" UNIQUE ("user_id", "category", "direction");



ALTER TABLE ONLY "public"."user_product_usage"
    ADD CONSTRAINT "user_product_usage_id_user_id_category_unique" UNIQUE ("id", "user_id", "category");



ALTER TABLE ONLY "public"."user_product_usage"
    ADD CONSTRAINT "user_product_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_product_usage"
    ADD CONSTRAINT "user_product_usage_user_id_category_key" UNIQUE ("user_id", "category");



ALTER TABLE ONLY "public"."waitlist_customerio_outbox"
    ADD CONSTRAINT "waitlist_customerio_outbox_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."waitlist_customerio_outbox"
    ADD CONSTRAINT "waitlist_customerio_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_customerio_outbox"
    ADD CONSTRAINT "waitlist_customerio_outbox_signup_event_key" UNIQUE ("signup_id", "event_type");



ALTER TABLE ONLY "public"."waitlist_signups"
    ADD CONSTRAINT "waitlist_signups_campaign_normalized_email_key" UNIQUE ("campaign", "normalized_email");



ALTER TABLE ONLY "public"."waitlist_signups"
    ADD CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_signups"
    ADD CONSTRAINT "waitlist_signups_survey_response_id_key" UNIQUE ("survey_response_id");



CREATE INDEX "beta_feedback_created_at_idx" ON "public"."beta_feedback" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "billing_one_time_purchases_consent_id_key" ON "public"."billing_one_time_purchases" USING "btree" ("consent_id");



CREATE UNIQUE INDEX "billing_one_time_purchases_one_paid_per_user_product" ON "public"."billing_one_time_purchases" USING "btree" ("user_id", "product_kind") WHERE (("status" = 'paid'::"text") AND ("user_id" IS NOT NULL));



CREATE INDEX "billing_one_time_purchases_provider_order_idx" ON "public"."billing_one_time_purchases" USING "btree" ("provider", "provider_order_id") WHERE ("provider_order_id" IS NOT NULL);



CREATE INDEX "billing_one_time_purchases_user_product_status_idx" ON "public"."billing_one_time_purchases" USING "btree" ("user_id", "product_kind", "status");



CREATE UNIQUE INDEX "billing_plan_change_one_open_per_subscription" ON "public"."billing_subscription_plan_changes" USING "btree" ("billing_subscription_id") WHERE ("status" = ANY (ARRAY['pending_provider'::"text", 'pending_approval'::"text", 'scheduled'::"text", 'reconciling'::"text"]));



CREATE INDEX "billing_plan_change_user_created" ON "public"."billing_subscription_plan_changes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "customerio_profile_sync_outbox_processing_started_idx" ON "public"."customerio_profile_sync_outbox" USING "btree" ("status", "processing_started_at");



CREATE INDEX "customerio_profile_sync_outbox_status_due_idx" ON "public"."customerio_profile_sync_outbox" USING "btree" ("status", "next_attempt_at", "created_at");



CREATE INDEX "funnel_events_checkout_reference_idx" ON "public"."funnel_events" USING "btree" ("checkout_provider", "checkout_reference");



CREATE INDEX "funnel_events_lead_id_idx" ON "public"."funnel_events" USING "btree" ("lead_id");



CREATE INDEX "funnel_events_package_occurred_at_idx" ON "public"."funnel_events" USING "btree" ("package_key", "occurred_at" DESC);



CREATE INDEX "funnel_events_session_occurred_at_idx" ON "public"."funnel_events" USING "btree" ("funnel_session_id", "occurred_at");



CREATE INDEX "funnel_sessions_lead_id_idx" ON "public"."funnel_sessions" USING "btree" ("lead_id");



CREATE INDEX "funnel_sessions_package_first_seen_idx" ON "public"."funnel_sessions" USING "btree" ("package_key", "first_seen_at" DESC);



CREATE INDEX "funnel_sessions_personal_plan_pricing_report_idx" ON "public"."funnel_sessions" USING "btree" ("offer_variant", "first_seen_at" DESC) WHERE (("package_key" = 'meta_personal_plan_v1'::"text") AND (NOT "is_internal_test"));



CREATE INDEX "funnel_sessions_purchase_reference_idx" ON "public"."funnel_sessions" USING "btree" ("purchase_provider", "purchase_reference");



CREATE INDEX "funnel_sessions_user_id_idx" ON "public"."funnel_sessions" USING "btree" ("user_id");



CREATE INDEX "funnel_sessions_visitor_first_seen_idx" ON "public"."funnel_sessions" USING "btree" ("visitor_id", "first_seen_at");



CREATE INDEX "idx_billing_analytics_deliveries_destination_status_due" ON "public"."billing_analytics_deliveries" USING "btree" ("destination", "status", "next_attempt_at");



CREATE INDEX "idx_billing_analytics_deliveries_processing_started" ON "public"."billing_analytics_deliveries" USING "btree" ("status", "processing_started_at");



CREATE INDEX "idx_billing_analytics_deliveries_status_due" ON "public"."billing_analytics_deliveries" USING "btree" ("status", "next_attempt_at");



CREATE UNIQUE INDEX "idx_billing_analytics_outbox_event_key" ON "public"."billing_analytics_outbox" USING "btree" ("event_key");



CREATE INDEX "idx_billing_analytics_outbox_event_time" ON "public"."billing_analytics_outbox" USING "btree" ("event_name", "occurred_at" DESC);



CREATE INDEX "idx_billing_analytics_outbox_provider_object" ON "public"."billing_analytics_outbox" USING "btree" ("provider", "source_object_id");



CREATE INDEX "idx_billing_analytics_outbox_user_time" ON "public"."billing_analytics_outbox" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "idx_billing_subscriptions_entitlement_expiry" ON "public"."billing_subscriptions" USING "btree" ("entitlement_status", "current_period_end");



CREATE INDEX "idx_billing_subscriptions_provider_lookup" ON "public"."billing_subscriptions" USING "btree" ("provider", "provider_subscription_id");



CREATE INDEX "idx_billing_subscriptions_user_id" ON "public"."billing_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_brand_aliases_brand_id" ON "public"."brand_aliases" USING "btree" ("brand_id");



CREATE UNIQUE INDEX "idx_brand_aliases_normalized_alias" ON "public"."brand_aliases" USING "btree" ("normalized_alias");



CREATE UNIQUE INDEX "idx_brands_normalized_name" ON "public"."brands" USING "btree" ("normalized_name");



CREATE INDEX "idx_checkout_activation_claims_user_id" ON "public"."checkout_activation_claims" USING "btree" ("user_id");



CREATE INDEX "idx_content_chunks_embedding" ON "public"."content_chunks" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "idx_content_chunks_metadata" ON "public"."content_chunks" USING "gin" ("metadata");



CREATE INDEX "idx_content_chunks_search_vector" ON "public"."content_chunks" USING "gin" ("search_vector");



CREATE INDEX "idx_content_chunks_source_name" ON "public"."content_chunks" USING "btree" ("source_name");



CREATE INDEX "idx_content_chunks_source_type" ON "public"."content_chunks" USING "btree" ("source_type");



CREATE INDEX "idx_conversation_states_user_id" ON "public"."conversation_states" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_conversation_turn_traces_assistant_message_id" ON "public"."conversation_turn_traces" USING "btree" ("assistant_message_id");



CREATE INDEX "idx_conversation_turn_traces_conversation_id" ON "public"."conversation_turn_traces" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_conversation_turn_traces_langfuse_trace_id" ON "public"."conversation_turn_traces" USING "btree" ("langfuse_trace_id") WHERE ("langfuse_trace_id" IS NOT NULL);



CREATE INDEX "idx_conversation_turn_traces_user_id" ON "public"."conversation_turn_traces" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_dismissed_suggestions_user_id" ON "public"."dismissed_suggestions" USING "btree" ("user_id");



CREATE INDEX "idx_dismissed_suggestions_user_reappear_at" ON "public"."dismissed_suggestions" USING "btree" ("user_id", "reappear_at");



CREATE INDEX "idx_leads_email" ON "public"."leads" USING "btree" ("email");



CREATE INDEX "idx_leads_user_id" ON "public"."leads" USING "btree" ("user_id");



CREATE INDEX "idx_manual_access_grants_email" ON "public"."manual_access_grants" USING "btree" ("email") WHERE (("email" IS NOT NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "idx_manual_access_grants_user_id" ON "public"."manual_access_grants" USING "btree" ("user_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_langfuse_trace_id" ON "public"."messages" USING "btree" ("langfuse_trace_id") WHERE ("langfuse_trace_id" IS NOT NULL);



CREATE INDEX "idx_paypal_checkout_intents_provider_subscription_id" ON "public"."paypal_checkout_intents" USING "btree" ("provider_subscription_id");



CREATE INDEX "idx_paypal_checkout_intents_token" ON "public"."paypal_checkout_intents" USING "btree" ("token");



CREATE INDEX "idx_product_bondbuilder_specs_application_mode" ON "public"."product_bondbuilder_specs" USING "btree" ("application_mode");



CREATE INDEX "idx_product_bondbuilder_specs_axis" ON "public"."product_bondbuilder_specs" USING "btree" ("bond_repair_axis");



CREATE INDEX "idx_product_bondbuilder_specs_intensity" ON "public"."product_bondbuilder_specs" USING "btree" ("bond_repair_intensity");



CREATE INDEX "idx_product_bondbuilder_specs_treatment_mode" ON "public"."product_bondbuilder_specs" USING "btree" ("treatment_mode");



CREATE INDEX "idx_product_bondbuilder_specs_usage_protocol" ON "public"."product_bondbuilder_specs" USING "btree" ("usage_protocol");



CREATE INDEX "idx_product_conditioner_rerank_specs_balance" ON "public"."product_conditioner_rerank_specs" USING "btree" ("balance_direction");



CREATE INDEX "idx_product_conditioner_rerank_specs_ingredient_flags" ON "public"."product_conditioner_rerank_specs" USING "gin" ("ingredient_flags");



CREATE INDEX "idx_product_conditioner_rerank_specs_repair_level" ON "public"."product_conditioner_rerank_specs" USING "btree" ("repair_level");



CREATE INDEX "idx_product_conditioner_rerank_specs_weight" ON "public"."product_conditioner_rerank_specs" USING "btree" ("weight");



CREATE INDEX "idx_product_conditioner_specs_lookup" ON "public"."product_conditioner_specs" USING "btree" ("thickness", "protein_moisture_balance");



CREATE INDEX "idx_product_conditioner_specs_product_id" ON "public"."product_conditioner_specs" USING "btree" ("product_id");



CREATE INDEX "idx_product_deep_cleansing_shampoo_specs_color_treated" ON "public"."product_deep_cleansing_shampoo_specs" USING "btree" ("color_treated_suitability");



CREATE INDEX "idx_product_deep_cleansing_shampoo_specs_reset_focus" ON "public"."product_deep_cleansing_shampoo_specs" USING "btree" ("reset_focus");



CREATE INDEX "idx_product_deep_cleansing_shampoo_specs_reset_intensity" ON "public"."product_deep_cleansing_shampoo_specs" USING "btree" ("reset_intensity");



CREATE INDEX "idx_product_deep_cleansing_shampoo_specs_scalp_type_focus" ON "public"."product_deep_cleansing_shampoo_specs" USING "btree" ("scalp_type_focus");



CREATE INDEX "idx_product_dry_shampoo_specs_format" ON "public"."product_dry_shampoo_specs" USING "btree" ("format");



CREATE INDEX "idx_product_dry_shampoo_specs_hair_color_fit" ON "public"."product_dry_shampoo_specs" USING "btree" ("hair_color_fit");



CREATE INDEX "idx_product_dry_shampoo_specs_primary_effect" ON "public"."product_dry_shampoo_specs" USING "btree" ("primary_effect");



CREATE INDEX "idx_product_dry_shampoo_specs_scalp_sensitivity_fit" ON "public"."product_dry_shampoo_specs" USING "btree" ("scalp_sensitivity_fit");



CREATE INDEX "idx_product_identifiers_lookup" ON "public"."product_identifiers" USING "btree" ("identifier_type", "normalized_identifier_value");



CREATE INDEX "idx_product_identifiers_product_id" ON "public"."product_identifiers" USING "btree" ("product_id");



CREATE UNIQUE INDEX "idx_product_identifiers_product_type_value" ON "public"."product_identifiers" USING "btree" ("product_id", "identifier_type", "normalized_identifier_value");



CREATE INDEX "idx_product_intake_research_artifacts_job_kind" ON "public"."product_intake_research_artifacts" USING "btree" ("job_id", "kind");



CREATE INDEX "idx_product_intake_research_artifacts_submission_created" ON "public"."product_intake_research_artifacts" USING "btree" ("submission_id", "created_at" DESC);



CREATE INDEX "idx_product_intake_research_jobs_locked_at" ON "public"."product_intake_research_jobs" USING "btree" ("locked_at");



CREATE INDEX "idx_product_intake_research_jobs_status_queue" ON "public"."product_intake_research_jobs" USING "btree" ("status", "priority" DESC, "next_run_at", "created_at");



CREATE INDEX "idx_product_intake_research_jobs_submission_id" ON "public"."product_intake_research_jobs" USING "btree" ("submission_id");



CREATE INDEX "idx_product_intake_review_decisions_submission_created" ON "public"."product_intake_review_decisions" USING "btree" ("submission_id", "created_at" DESC);



CREATE INDEX "idx_product_intake_review_decisions_unresolved" ON "public"."product_intake_review_decisions" USING "btree" ("submission_id", "decision", "resolved_at") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_product_leave_in_eligibility_lookup" ON "public"."product_leave_in_eligibility" USING "btree" ("thickness", "need_bucket", "styling_context");



CREATE INDEX "idx_product_leave_in_eligibility_product_id" ON "public"."product_leave_in_eligibility" USING "btree" ("product_id");



CREATE INDEX "idx_product_leave_in_fit_specs_care_benefits" ON "public"."product_leave_in_fit_specs" USING "gin" ("care_benefits");



CREATE INDEX "idx_product_leave_in_fit_specs_conditioner_relationship" ON "public"."product_leave_in_fit_specs" USING "btree" ("conditioner_relationship");



CREATE INDEX "idx_product_leave_in_fit_specs_weight" ON "public"."product_leave_in_fit_specs" USING "btree" ("weight");



CREATE INDEX "idx_product_leave_in_specs_application_stage" ON "public"."product_leave_in_specs" USING "gin" ("application_stage");



CREATE INDEX "idx_product_leave_in_specs_care_benefits" ON "public"."product_leave_in_specs" USING "gin" ("care_benefits");



CREATE INDEX "idx_product_leave_in_specs_heat_activation_required" ON "public"."product_leave_in_specs" USING "btree" ("product_id") WHERE ("heat_activation_required" = true);



CREATE INDEX "idx_product_leave_in_specs_ingredient_flags" ON "public"."product_leave_in_specs" USING "gin" ("ingredient_flags");



CREATE INDEX "idx_product_leave_in_specs_roles" ON "public"."product_leave_in_specs" USING "gin" ("roles");



CREATE INDEX "idx_product_leave_in_specs_weight" ON "public"."product_leave_in_specs" USING "btree" ("weight");



CREATE INDEX "idx_product_lines_brand_id" ON "public"."product_lines" USING "btree" ("brand_id");



CREATE UNIQUE INDEX "idx_product_lines_brand_normalized_name" ON "public"."product_lines" USING "btree" ("brand_id", "normalized_name");



CREATE INDEX "idx_product_mask_specs_balance" ON "public"."product_mask_specs" USING "btree" ("balance_direction");



CREATE INDEX "idx_product_mask_specs_concentration" ON "public"."product_mask_specs" USING "btree" ("concentration");



CREATE INDEX "idx_product_mask_specs_ingredient_flags" ON "public"."product_mask_specs" USING "gin" ("ingredient_flags");



CREATE INDEX "idx_product_mask_specs_weight" ON "public"."product_mask_specs" USING "btree" ("weight");



CREATE INDEX "idx_product_oil_eligibility_ingredient_flags" ON "public"."product_oil_eligibility" USING "gin" ("ingredient_flags");



CREATE INDEX "idx_product_oil_eligibility_lookup" ON "public"."product_oil_eligibility" USING "btree" ("thickness", "oil_subtype");



CREATE INDEX "idx_product_oil_eligibility_oil_purpose" ON "public"."product_oil_eligibility" USING "btree" ("oil_purpose");



CREATE INDEX "idx_product_oil_eligibility_product_id" ON "public"."product_oil_eligibility" USING "btree" ("product_id");



CREATE INDEX "idx_product_peeling_specs_peeling_type" ON "public"."product_peeling_specs" USING "btree" ("peeling_type");



CREATE INDEX "idx_product_peeling_specs_scalp_type_focus" ON "public"."product_peeling_specs" USING "btree" ("scalp_type_focus");



CREATE INDEX "idx_product_relationships_source_type" ON "public"."product_relationships" USING "btree" ("source_product_id", "relationship_type");



CREATE INDEX "idx_product_relationships_target_type" ON "public"."product_relationships" USING "btree" ("target_product_id", "relationship_type");



CREATE INDEX "idx_product_shampoo_specs_cleansing_intensity" ON "public"."product_shampoo_specs" USING "btree" ("cleansing_intensity");



CREATE INDEX "idx_product_shampoo_specs_lookup" ON "public"."product_shampoo_specs" USING "btree" ("thickness", "shampoo_bucket");



CREATE INDEX "idx_product_shampoo_specs_product_id" ON "public"."product_shampoo_specs" USING "btree" ("product_id");



CREATE INDEX "idx_product_shampoo_specs_scalp_route" ON "public"."product_shampoo_specs" USING "btree" ("scalp_route");



CREATE INDEX "idx_product_submissions_approved_product_id" ON "public"."product_submissions" USING "btree" ("approved_product_id");



CREATE UNIQUE INDEX "idx_product_submissions_one_open_per_usage" ON "public"."product_submissions" USING "btree" ("user_product_usage_id") WHERE (("user_product_usage_id" IS NOT NULL) AND ("status" = ANY (ARRAY['pending_review'::"text", 'researching'::"text", 'ready_for_review'::"text", 'needs_more_info'::"text"])));



CREATE INDEX "idx_product_submissions_source_conversation_id" ON "public"."product_submissions" USING "btree" ("source_conversation_id");



CREATE INDEX "idx_product_submissions_status_created_at" ON "public"."product_submissions" USING "btree" ("status", "created_at");



CREATE INDEX "idx_product_submissions_user_created_at" ON "public"."product_submissions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_product_submissions_user_product_usage_id" ON "public"."product_submissions" USING "btree" ("user_product_usage_id");



CREATE INDEX "idx_products_brand_id" ON "public"."products" USING "btree" ("brand_id");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category");



CREATE INDEX "idx_products_category_key" ON "public"."products" USING "btree" ("category_key");



CREATE INDEX "idx_products_chaarlie_recommended" ON "public"."products" USING "btree" ("is_chaarlie_recommended") WHERE ("is_chaarlie_recommended" = true);



CREATE INDEX "idx_products_embedding" ON "public"."products" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "idx_products_name_trgm" ON "public"."products" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_products_origin" ON "public"."products" USING "btree" ("origin");



CREATE INDEX "idx_products_product_line_id" ON "public"."products" USING "btree" ("product_line_id");



CREATE INDEX "idx_products_suitable_concerns" ON "public"."products" USING "gin" ("suitable_concerns");



CREATE INDEX "idx_products_suitable_hair_textures" ON "public"."products" USING "gin" ("suitable_thicknesses");



CREATE INDEX "idx_products_tags" ON "public"."products" USING "gin" ("tags");



CREATE INDEX "idx_profiles_stripe_customer_id" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_profiles_subscription_tier_id" ON "public"."profiles" USING "btree" ("subscription_tier_id");



CREATE INDEX "idx_rate_limits_expires_at" ON "public"."rate_limits" USING "btree" ("expires_at");



CREATE INDEX "idx_routine_log_products_log_id" ON "public"."routine_log_products" USING "btree" ("routine_log_id");



CREATE INDEX "idx_routine_logs_user_logged_on" ON "public"."routine_logs" USING "btree" ("user_id", "logged_on" DESC);



CREATE INDEX "idx_tracker_nudge_dismissals_user_reappear_at" ON "public"."tracker_nudge_dismissals" USING "btree" ("user_id", "reappear_at");



CREATE INDEX "idx_user_product_usage_product_id" ON "public"."user_product_usage" USING "btree" ("product_id");



CREATE INDEX "idx_user_product_usage_product_submission_id" ON "public"."user_product_usage" USING "btree" ("product_submission_id");



CREATE INDEX "leads_quiz_kind_email_created_at_idx" ON "public"."leads" USING "btree" ("quiz_kind", "email", "created_at" DESC);



CREATE UNIQUE INDEX "membership_reactivation_one_open_per_user" ON "public"."membership_reactivation_checkout_reservations" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['open'::"text", 'provider_selected'::"text", 'provider_created'::"text", 'reconciliation_required'::"text"]));



CREATE INDEX "membership_reactivation_reservation_expiry" ON "public"."membership_reactivation_checkout_reservations" USING "btree" ("expires_at") WHERE ("status" = ANY (ARRAY['open'::"text", 'provider_selected'::"text", 'provider_created'::"text"]));



CREATE UNIQUE INDEX "paypal_checkout_intents_one_per_reactivation_reservation" ON "public"."paypal_checkout_intents" USING "btree" ("reactivation_reservation_id") WHERE ("reactivation_reservation_id" IS NOT NULL);



CREATE INDEX "paypal_order_intents_lead_session_idx" ON "public"."paypal_order_intents" USING "btree" ("lead_id", "funnel_session_id");



CREATE INDEX "paypal_order_intents_user_status_idx" ON "public"."paypal_order_intents" USING "btree" ("user_id", "status");



CREATE UNIQUE INDEX "personal_plan_one_time_checkout_consents_lead_session_product_i" ON "public"."personal_plan_one_time_checkout_consents" USING "btree" ("lead_id", "funnel_session_id", "product_kind");



CREATE INDEX "personal_plan_one_time_checkout_consents_user_idx" ON "public"."personal_plan_one_time_checkout_consents" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE UNIQUE INDEX "personal_plan_one_time_fulfillment_jobs_active_purchase_idx" ON "public"."personal_plan_one_time_fulfillment_jobs" USING "btree" ("purchase_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'failed'::"text"]));



CREATE INDEX "personal_plan_one_time_fulfillment_jobs_due_idx" ON "public"."personal_plan_one_time_fulfillment_jobs" USING "btree" ("status", "next_attempt_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text", 'processing'::"text"]));



CREATE INDEX "personal_plan_prepared_artifacts_answer_hash_idx" ON "public"."personal_plan_prepared_artifacts" USING "btree" ("answer_hash", "created_at");



CREATE UNIQUE INDEX "personal_plan_prepared_artifacts_attached_lead_idx" ON "public"."personal_plan_prepared_artifacts" USING "btree" ("lead_id") WHERE ("status" = 'attached'::"text");



CREATE INDEX "personal_plan_prepared_artifacts_expiry_idx" ON "public"."personal_plan_prepared_artifacts" USING "btree" ("expires_at") WHERE ("status" = 'prepared'::"text");



CREATE INDEX "personal_plan_quiz_drafts_active_expiry_idx" ON "public"."personal_plan_quiz_drafts" USING "btree" ("expires_at") WHERE ("status" = 'active'::"text");



CREATE INDEX "personal_plan_quiz_drafts_funnel_session_idx" ON "public"."personal_plan_quiz_drafts" USING "btree" ("funnel_session_id");



CREATE INDEX "product_image_assets_manifest_batch_id_idx" ON "public"."product_image_assets" USING "btree" ("manifest_batch_id");



CREATE UNIQUE INDEX "product_image_assets_product_id_idx" ON "public"."product_image_assets" USING "btree" ("product_id");



CREATE UNIQUE INDEX "product_image_assets_storage_path_idx" ON "public"."product_image_assets" USING "btree" ("storage_path");



CREATE UNIQUE INDEX "product_intake_research_jobs_one_open_per_submission" ON "public"."product_intake_research_jobs" USING "btree" ("submission_id") WHERE ("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'waiting_for_review'::"text", 'waiting_for_rework'::"text", 'publish_preflight'::"text", 'publishing'::"text", 'blocked'::"text", 'failed'::"text"]));



CREATE UNIQUE INDEX "uniq_billing_one_open_subscription_per_user" ON "public"."billing_subscriptions" USING "btree" ("user_id") WHERE ("entitlement_status" = ANY (ARRAY['active'::"text", 'past_due'::"text"]));



CREATE INDEX "user_product_usage_user_product_matched_idx" ON "public"."user_product_usage" USING "btree" ("user_id", "product_id") WHERE (("match_status" = 'matched'::"text") AND ("product_id" IS NOT NULL));



CREATE INDEX "waitlist_customerio_outbox_processing_started_idx" ON "public"."waitlist_customerio_outbox" USING "btree" ("status", "processing_started_at");



CREATE INDEX "waitlist_customerio_outbox_status_due_idx" ON "public"."waitlist_customerio_outbox" USING "btree" ("status", "next_attempt_at", "created_at");



CREATE INDEX "waitlist_signups_campaign_created_at_idx" ON "public"."waitlist_signups" USING "btree" ("campaign", "created_at");



CREATE OR REPLACE TRIGGER "deny_paypal_expired_order_reset_audit_mutation" BEFORE DELETE OR UPDATE ON "public"."paypal_expired_order_reset_audit" FOR EACH ROW EXECUTE FUNCTION "public"."deny_paypal_expired_order_reset_audit_mutation"();



CREATE OR REPLACE TRIGGER "enforce_billing_one_time_purchase_consent_match" BEFORE INSERT OR UPDATE ON "public"."billing_one_time_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_billing_one_time_purchase_consent_match"();



CREATE OR REPLACE TRIGGER "enforce_personal_plan_one_time_consent_immutability" BEFORE UPDATE ON "public"."personal_plan_one_time_checkout_consents" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_personal_plan_one_time_consent_immutability"();



CREATE OR REPLACE TRIGGER "leads_enqueue_customerio_profile_sync" AFTER INSERT OR UPDATE OF "email", "marketing_consent", "quiz_answers" ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_personal_plan_customerio_profile_sync"();



CREATE OR REPLACE TRIGGER "product_intake_auto_enqueue_research_job" AFTER INSERT OR UPDATE OF "status" ON "public"."product_submissions" FOR EACH ROW WHEN (("new"."status" = 'pending_review'::"text")) EXECUTE FUNCTION "public"."product_intake_auto_enqueue_research_job"();



CREATE OR REPLACE TRIGGER "protect_user_product_usage_review_fields" BEFORE INSERT OR UPDATE OF "brand_text", "product_id", "product_submission_id", "match_status", "intake_method", "source", "front_image_path" ON "public"."user_product_usage" FOR EACH ROW EXECUTE FUNCTION "public"."protect_user_product_usage_review_fields"();



CREATE OR REPLACE TRIGGER "set_updated_at_articles" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_billing_one_time_purchases" BEFORE UPDATE ON "public"."billing_one_time_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_brand_aliases" BEFORE UPDATE ON "public"."brand_aliases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_brands" BEFORE UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_conversation_states" BEFORE UPDATE ON "public"."conversation_states" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_conversation_turn_traces" BEFORE UPDATE ON "public"."conversation_turn_traces" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_conversations" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_funnel_sessions" BEFORE UPDATE ON "public"."funnel_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_hair_profiles" BEFORE UPDATE ON "public"."hair_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_manual_access_grants" BEFORE UPDATE ON "public"."manual_access_grants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_paypal_order_intents" BEFORE UPDATE ON "public"."paypal_order_intents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_personal_plan_one_time_checkout_consents" BEFORE UPDATE ON "public"."personal_plan_one_time_checkout_consents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_personal_plan_one_time_fulfillment_jobs" BEFORE UPDATE ON "public"."personal_plan_one_time_fulfillment_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_bondbuilder_specs" BEFORE UPDATE ON "public"."product_bondbuilder_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_categories" BEFORE UPDATE ON "public"."product_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_conditioner_rerank_specs" BEFORE UPDATE ON "public"."product_conditioner_rerank_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_deep_cleansing_shampoo_specs" BEFORE UPDATE ON "public"."product_deep_cleansing_shampoo_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_dry_shampoo_specs" BEFORE UPDATE ON "public"."product_dry_shampoo_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_identifiers" BEFORE UPDATE ON "public"."product_identifiers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_image_assets" BEFORE UPDATE ON "public"."product_image_assets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_intake_research_jobs" BEFORE UPDATE ON "public"."product_intake_research_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_leave_in_fit_specs" BEFORE UPDATE ON "public"."product_leave_in_fit_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_leave_in_specs" BEFORE UPDATE ON "public"."product_leave_in_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_lines" BEFORE UPDATE ON "public"."product_lines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_mask_specs" BEFORE UPDATE ON "public"."product_mask_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_peeling_specs" BEFORE UPDATE ON "public"."product_peeling_specs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_relationships" BEFORE UPDATE ON "public"."product_relationships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_product_submissions" BEFORE UPDATE ON "public"."product_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_products" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_routine_logs" BEFORE UPDATE ON "public"."routine_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sync_product_conditioner_specs" AFTER INSERT OR UPDATE OF "category", "suitable_thicknesses", "suitable_concerns" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."sync_product_conditioner_specs_from_products"();



CREATE OR REPLACE TRIGGER "trg_sync_product_leave_in_eligibility_from_products" AFTER INSERT OR UPDATE OF "category", "suitable_thicknesses" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."sync_product_leave_in_eligibility_from_products"();



CREATE OR REPLACE TRIGGER "trg_sync_product_leave_in_eligibility_from_specs" AFTER INSERT OR DELETE OR UPDATE ON "public"."product_leave_in_specs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_product_leave_in_eligibility_from_specs"();



CREATE OR REPLACE TRIGGER "trg_sync_product_oil_eligibility" AFTER INSERT OR UPDATE OF "category", "suitable_thicknesses", "suitable_concerns" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."sync_product_oil_eligibility_from_products"();



CREATE OR REPLACE TRIGGER "validate_paypal_order_intent_binding" BEFORE INSERT OR UPDATE ON "public"."paypal_order_intents" FOR EACH ROW EXECUTE FUNCTION "public"."validate_paypal_order_intent_binding"();



CREATE OR REPLACE TRIGGER "validate_personal_plan_one_time_consent_binding" BEFORE INSERT ON "public"."personal_plan_one_time_checkout_consents" FOR EACH ROW EXECUTE FUNCTION "public"."validate_personal_plan_one_time_consent_binding"();



CREATE OR REPLACE TRIGGER "validate_product_submission_foundation" BEFORE INSERT OR UPDATE OF "user_id", "category", "front_image_path", "barcode_image_path" ON "public"."product_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_product_submission_foundation"();



CREATE OR REPLACE TRIGGER "validate_product_submission_status_link" BEFORE INSERT OR UPDATE OF "status", "approved_product_id", "user_product_usage_id", "category" ON "public"."product_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_product_submission_status_link"();



CREATE OR REPLACE TRIGGER "validate_user_product_usage_submission_link" BEFORE INSERT OR UPDATE OF "product_submission_id", "user_id", "category", "product_id", "match_status" ON "public"."user_product_usage" FOR EACH ROW EXECUTE FUNCTION "public"."validate_user_product_usage_submission_link"();



ALTER TABLE ONLY "public"."beta_feedback"
    ADD CONSTRAINT "beta_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_analytics_deliveries"
    ADD CONSTRAINT "billing_analytics_deliveries_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "public"."billing_analytics_outbox"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_analytics_outbox"
    ADD CONSTRAINT "billing_analytics_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_one_time_purchases"
    ADD CONSTRAINT "billing_one_time_purchases_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."personal_plan_one_time_checkout_consents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."billing_one_time_purchases"
    ADD CONSTRAINT "billing_one_time_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."billing_subscription_plan_changes"
    ADD CONSTRAINT "billing_subscription_plan_changes_billing_subscription_id_fkey" FOREIGN KEY ("billing_subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_subscription_plan_changes"
    ADD CONSTRAINT "billing_subscription_plan_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_aliases"
    ADD CONSTRAINT "brand_aliases_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_aliases"
    ADD CONSTRAINT "brand_aliases_product_line_id_brand_id_fkey" FOREIGN KEY ("product_line_id", "brand_id") REFERENCES "public"."product_lines"("id", "brand_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_activation_claims"
    ADD CONSTRAINT "checkout_activation_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_states"
    ADD CONSTRAINT "conversation_states_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_states"
    ADD CONSTRAINT "conversation_states_conversation_user_id_fk" FOREIGN KEY ("conversation_id", "user_id") REFERENCES "public"."conversations"("id", "user_id");



ALTER TABLE ONLY "public"."conversation_states"
    ADD CONSTRAINT "conversation_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_turn_traces"
    ADD CONSTRAINT "conversation_turn_traces_assistant_message_id_fkey" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_turn_traces"
    ADD CONSTRAINT "conversation_turn_traces_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_turn_traces"
    ADD CONSTRAINT "conversation_turn_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_turn_traces"
    ADD CONSTRAINT "conversation_turn_traces_user_message_id_fkey" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customerio_profile_sync_outbox"
    ADD CONSTRAINT "customerio_profile_sync_outbox_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dismissed_suggestions"
    ADD CONSTRAINT "dismissed_suggestions_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."product_categories"("key") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."dismissed_suggestions"
    ADD CONSTRAINT "dismissed_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funnel_events"
    ADD CONSTRAINT "funnel_events_funnel_session_id_fkey" FOREIGN KEY ("funnel_session_id") REFERENCES "public"."funnel_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funnel_events"
    ADD CONSTRAINT "funnel_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."funnel_sessions"
    ADD CONSTRAINT "funnel_sessions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."funnel_sessions"
    ADD CONSTRAINT "funnel_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hair_profiles"
    ADD CONSTRAINT "hair_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manual_access_grants"
    ADD CONSTRAINT "manual_access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membership_reactivation_checkout_reservations"
    ADD CONSTRAINT "membership_reactivation_checkout_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."paypal_checkout_intents"
    ADD CONSTRAINT "paypal_checkout_intents_reactivation_reservation_id_fkey" FOREIGN KEY ("reactivation_reservation_id") REFERENCES "public"."membership_reactivation_checkout_reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."paypal_checkout_intents"
    ADD CONSTRAINT "paypal_checkout_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."paypal_expired_order_reset_audit"
    ADD CONSTRAINT "paypal_expired_order_reset_audit_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."personal_plan_one_time_checkout_consents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."paypal_expired_order_reset_audit"
    ADD CONSTRAINT "paypal_expired_order_reset_audit_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "public"."paypal_order_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."personal_plan_one_time_checkout_consents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_funnel_session_id_fkey" FOREIGN KEY ("funnel_session_id") REFERENCES "public"."funnel_sessions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."paypal_order_intents"
    ADD CONSTRAINT "paypal_order_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."personal_plan_one_time_checkout_consents"
    ADD CONSTRAINT "personal_plan_one_time_checkout_consents_funnel_session_id_fkey" FOREIGN KEY ("funnel_session_id") REFERENCES "public"."funnel_sessions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."personal_plan_one_time_checkout_consents"
    ADD CONSTRAINT "personal_plan_one_time_checkout_consents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."personal_plan_one_time_checkout_consents"
    ADD CONSTRAINT "personal_plan_one_time_checkout_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."personal_plan_one_time_fulfillment_jobs"
    ADD CONSTRAINT "personal_plan_one_time_fulfillment_jobs_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."personal_plan_one_time_checkout_consents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."personal_plan_one_time_fulfillment_jobs"
    ADD CONSTRAINT "personal_plan_one_time_fulfillment_jobs_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."billing_one_time_purchases"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."personal_plan_prepared_artifacts"
    ADD CONSTRAINT "personal_plan_prepared_artifacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_plan_prepared_artifacts"
    ADD CONSTRAINT "personal_plan_prepared_artifacts_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."personal_plan_prepared_artifacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."personal_plan_prepared_artifacts"
    ADD CONSTRAINT "personal_plan_prepared_artifacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."personal_plan_quiz_drafts"
    ADD CONSTRAINT "personal_plan_quiz_drafts_funnel_session_id_fkey" FOREIGN KEY ("funnel_session_id") REFERENCES "public"."funnel_sessions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_bondbuilder_specs"
    ADD CONSTRAINT "product_bondbuilder_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_conditioner_rerank_specs"
    ADD CONSTRAINT "product_conditioner_rerank_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_conditioner_specs"
    ADD CONSTRAINT "product_conditioner_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_deep_cleansing_shampoo_specs"
    ADD CONSTRAINT "product_deep_cleansing_shampoo_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_dry_shampoo_specs"
    ADD CONSTRAINT "product_dry_shampoo_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_identifiers"
    ADD CONSTRAINT "product_identifiers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_image_assets"
    ADD CONSTRAINT "product_image_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_intake_research_artifacts"
    ADD CONSTRAINT "product_intake_research_artifacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."product_intake_research_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_intake_research_artifacts"
    ADD CONSTRAINT "product_intake_research_artifacts_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."product_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_intake_research_jobs"
    ADD CONSTRAINT "product_intake_research_jobs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."product_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_intake_review_decisions"
    ADD CONSTRAINT "product_intake_review_decisions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."product_intake_research_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_intake_review_decisions"
    ADD CONSTRAINT "product_intake_review_decisions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."product_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_leave_in_eligibility"
    ADD CONSTRAINT "product_leave_in_eligibility_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_leave_in_fit_specs"
    ADD CONSTRAINT "product_leave_in_fit_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_leave_in_specs"
    ADD CONSTRAINT "product_leave_in_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_lines"
    ADD CONSTRAINT "product_lines_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_mask_specs"
    ADD CONSTRAINT "product_mask_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_oil_eligibility"
    ADD CONSTRAINT "product_oil_eligibility_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_peeling_specs"
    ADD CONSTRAINT "product_peeling_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_relationships"
    ADD CONSTRAINT "product_relationships_source_product_id_fkey" FOREIGN KEY ("source_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_relationships"
    ADD CONSTRAINT "product_relationships_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_shampoo_specs"
    ADD CONSTRAINT "product_shampoo_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_approved_product_id_fkey" FOREIGN KEY ("approved_product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."product_categories"("key") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_previous_product_id_fkey" FOREIGN KEY ("previous_product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_source_conversation_fkey" FOREIGN KEY ("source_conversation_id", "user_id") REFERENCES "public"."conversations"("id", "user_id") ON DELETE SET NULL ("source_conversation_id");



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_submissions"
    ADD CONSTRAINT "product_submissions_user_product_usage_fkey" FOREIGN KEY ("user_product_usage_id", "user_id", "category") REFERENCES "public"."user_product_usage"("id", "user_id", "category") ON DELETE SET NULL ("user_product_usage_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_key_fkey" FOREIGN KEY ("category_key") REFERENCES "public"."product_categories"("key") ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_product_line_matches_brand" FOREIGN KEY ("product_line_id", "brand_id") REFERENCES "public"."product_lines"("id", "brand_id") ON UPDATE CASCADE ON DELETE SET NULL ("product_line_id") NOT VALID;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_subscription_tier_id_fkey" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routine_log_products"
    ADD CONSTRAINT "routine_log_products_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."product_categories"("key") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."routine_log_products"
    ADD CONSTRAINT "routine_log_products_routine_log_id_fkey" FOREIGN KEY ("routine_log_id") REFERENCES "public"."routine_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routine_log_products"
    ADD CONSTRAINT "routine_log_products_user_product_usage_id_fkey" FOREIGN KEY ("user_product_usage_id") REFERENCES "public"."user_product_usage"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routine_logs"
    ADD CONSTRAINT "routine_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracker_nudge_dismissals"
    ADD CONSTRAINT "tracker_nudge_dismissals_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."product_categories"("key") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tracker_nudge_dismissals"
    ADD CONSTRAINT "tracker_nudge_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_product_usage"
    ADD CONSTRAINT "user_product_usage_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."product_categories"("key") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_product_usage"
    ADD CONSTRAINT "user_product_usage_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_product_usage"
    ADD CONSTRAINT "user_product_usage_product_submission_id_fkey" FOREIGN KEY ("product_submission_id", "user_id", "category") REFERENCES "public"."product_submissions"("id", "user_id", "category") ON DELETE SET NULL ("product_submission_id");



ALTER TABLE ONLY "public"."user_product_usage"
    ADD CONSTRAINT "user_product_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist_customerio_outbox"
    ADD CONSTRAINT "waitlist_customerio_outbox_signup_id_fkey" FOREIGN KEY ("signup_id") REFERENCES "public"."waitlist_signups"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own product usage" ON "public"."user_product_usage" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own product usage" ON "public"."user_product_usage" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own billing subscriptions" ON "public"."billing_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own conversation states" ON "public"."conversation_states" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own manual access grants" ON "public"."manual_access_grants" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (("email" IS NOT NULL) AND ("lower"(("auth"."jwt"() ->> 'email'::"text")) = "email"))));



CREATE POLICY "Users can read own product usage" ON "public"."user_product_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own product usage" ON "public"."user_product_usage" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "articles_admin_delete" ON "public"."articles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "articles_admin_insert" ON "public"."articles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "articles_admin_update" ON "public"."articles" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "articles_select" ON "public"."articles" FOR SELECT USING (((("is_published" = true) AND (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")) OR "public"."is_admin"()));



ALTER TABLE "public"."beta_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_analytics_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_analytics_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_one_time_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_one_time_purchases_select_own" ON "public"."billing_one_time_purchases" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."billing_subscription_plan_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_select_public" ON "public"."brands" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."checkout_activation_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_chunks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_chunks_admin_delete" ON "public"."content_chunks" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "content_chunks_admin_insert" ON "public"."content_chunks" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "content_chunks_admin_update" ON "public"."content_chunks" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "content_chunks_select_authenticated" ON "public"."content_chunks" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."conversation_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_turn_traces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_delete_own" ON "public"."conversations" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "conversations_insert_own" ON "public"."conversations" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "conversations_select_own" ON "public"."conversations" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "conversations_update_own" ON "public"."conversations" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."customerio_profile_sync_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_quotes_admin_delete" ON "public"."daily_quotes" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "daily_quotes_admin_insert" ON "public"."daily_quotes" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "daily_quotes_admin_update" ON "public"."daily_quotes" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "daily_quotes_select" ON "public"."daily_quotes" FOR SELECT USING (((("is_active" = true) AND (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")) OR "public"."is_admin"()));



ALTER TABLE "public"."dismissed_suggestions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dismissed_suggestions_delete_own" ON "public"."dismissed_suggestions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "dismissed_suggestions_insert_own" ON "public"."dismissed_suggestions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "dismissed_suggestions_select_own" ON "public"."dismissed_suggestions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "dismissed_suggestions_update_own" ON "public"."dismissed_suggestions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."funnel_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funnel_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hair_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hair_profiles_insert_own" ON "public"."hair_profiles" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "hair_profiles_select" ON "public"."hair_profiles" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "hair_profiles_update_own" ON "public"."hair_profiles" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_admin_select" ON "public"."leads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "leads_service_insert" ON "public"."leads" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."manual_access_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."membership_reactivation_checkout_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_own" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "messages_select_own" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."paypal_checkout_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."paypal_expired_order_reset_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."paypal_order_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_plan_one_time_checkout_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_plan_one_time_fulfillment_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_plan_prepared_artifacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_plan_quiz_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_bondbuilder_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_bondbuilder_specs_admin_delete" ON "public"."product_bondbuilder_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_bondbuilder_specs_admin_insert" ON "public"."product_bondbuilder_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_bondbuilder_specs_admin_select" ON "public"."product_bondbuilder_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_bondbuilder_specs_admin_update" ON "public"."product_bondbuilder_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_categories_select_public" ON "public"."product_categories" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."product_conditioner_rerank_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_conditioner_rerank_specs_admin_delete" ON "public"."product_conditioner_rerank_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_conditioner_rerank_specs_admin_insert" ON "public"."product_conditioner_rerank_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_conditioner_rerank_specs_admin_select" ON "public"."product_conditioner_rerank_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_conditioner_rerank_specs_admin_update" ON "public"."product_conditioner_rerank_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_conditioner_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_conditioner_specs_admin_delete" ON "public"."product_conditioner_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_conditioner_specs_admin_insert" ON "public"."product_conditioner_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_conditioner_specs_admin_select" ON "public"."product_conditioner_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_conditioner_specs_admin_update" ON "public"."product_conditioner_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_deep_cleansing_shampoo_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_deep_cleansing_shampoo_specs_admin_delete" ON "public"."product_deep_cleansing_shampoo_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_deep_cleansing_shampoo_specs_admin_insert" ON "public"."product_deep_cleansing_shampoo_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_deep_cleansing_shampoo_specs_admin_select" ON "public"."product_deep_cleansing_shampoo_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_deep_cleansing_shampoo_specs_admin_update" ON "public"."product_deep_cleansing_shampoo_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_dry_shampoo_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_dry_shampoo_specs_admin_delete" ON "public"."product_dry_shampoo_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_dry_shampoo_specs_admin_insert" ON "public"."product_dry_shampoo_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_dry_shampoo_specs_admin_select" ON "public"."product_dry_shampoo_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_dry_shampoo_specs_admin_update" ON "public"."product_dry_shampoo_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_identifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_image_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_intake_research_artifacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_intake_research_artifacts_service_role_all" ON "public"."product_intake_research_artifacts" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."product_intake_research_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_intake_research_jobs_service_role_all" ON "public"."product_intake_research_jobs" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."product_intake_review_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_intake_review_decisions_service_role_all" ON "public"."product_intake_review_decisions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."product_leave_in_eligibility" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_leave_in_eligibility_admin_select" ON "public"."product_leave_in_eligibility" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_leave_in_fit_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_leave_in_fit_specs_admin_delete" ON "public"."product_leave_in_fit_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_leave_in_fit_specs_admin_insert" ON "public"."product_leave_in_fit_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_leave_in_fit_specs_admin_select" ON "public"."product_leave_in_fit_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_leave_in_fit_specs_admin_update" ON "public"."product_leave_in_fit_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_leave_in_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_leave_in_specs_admin_delete" ON "public"."product_leave_in_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_leave_in_specs_admin_insert" ON "public"."product_leave_in_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_leave_in_specs_admin_select" ON "public"."product_leave_in_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_leave_in_specs_admin_update" ON "public"."product_leave_in_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_lines_select_public" ON "public"."product_lines" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."product_mask_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_mask_specs_admin_delete" ON "public"."product_mask_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_mask_specs_admin_insert" ON "public"."product_mask_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_mask_specs_admin_select" ON "public"."product_mask_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_mask_specs_admin_update" ON "public"."product_mask_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_oil_eligibility" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_peeling_specs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_peeling_specs_admin_delete" ON "public"."product_peeling_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_peeling_specs_admin_insert" ON "public"."product_peeling_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_peeling_specs_admin_select" ON "public"."product_peeling_specs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_peeling_specs_admin_update" ON "public"."product_peeling_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_relationships_admin_delete" ON "public"."product_relationships" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_relationships_admin_insert" ON "public"."product_relationships" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_relationships_admin_select" ON "public"."product_relationships" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_relationships_admin_update" ON "public"."product_relationships" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."product_shampoo_specs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_submissions_admin_select" ON "public"."product_submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_submissions_admin_update" ON "public"."product_submissions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "product_submissions_service_role_all" ON "public"."product_submissions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_admin_delete" ON "public"."products" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "products_admin_insert" ON "public"."products" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "products_admin_update" ON "public"."products" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "products_select_active" ON "public"."products" FOR SELECT TO "authenticated" USING ((("is_active" = true) AND ("lifecycle_status" = 'active'::"text") AND ("is_chaarlie_recommended" = true) AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "products_select_owned_matched" ON "public"."products" FOR SELECT TO "authenticated" USING ((("is_active" = true) AND ("lifecycle_status" = 'active'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_product_usage" "usage"
  WHERE (("usage"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("usage"."product_id" = "products"."id") AND ("usage"."match_status" = 'matched'::"text"))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR "public"."is_admin"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routine_log_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "routine_log_products_select_own" ON "public"."routine_log_products" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."routine_logs" "l"
  WHERE (("l"."id" = "routine_log_products"."routine_log_id") AND ("l"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."routine_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "routine_logs_select_own" ON "public"."routine_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."subscription_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_tiers_admin_delete" ON "public"."subscription_tiers" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "subscription_tiers_admin_insert" ON "public"."subscription_tiers" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "subscription_tiers_admin_update" ON "public"."subscription_tiers" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "subscription_tiers_select" ON "public"."subscription_tiers" FOR SELECT USING (((("is_active" = true) AND (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")) OR "public"."is_admin"()));



ALTER TABLE "public"."tracker_nudge_dismissals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tracker_nudge_dismissals_delete_own" ON "public"."tracker_nudge_dismissals" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tracker_nudge_dismissals_insert_own" ON "public"."tracker_nudge_dismissals" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "tracker_nudge_dismissals_select_own" ON "public"."tracker_nudge_dismissals" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tracker_nudge_dismissals_update_own" ON "public"."tracker_nudge_dismissals" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_product_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users insert own feedback" ON "public"."beta_feedback" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."waitlist_customerio_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist_signups" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."membership_reactivation_checkout_reservations" TO "anon";
GRANT ALL ON TABLE "public"."membership_reactivation_checkout_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_reactivation_checkout_reservations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."acquire_membership_reactivation_checkout"("p_user_id" "uuid", "p_checkout_attempt_id" "uuid", "p_interval" "text", "p_return_destination" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."acquire_membership_reactivation_checkout"("p_user_id" "uuid", "p_checkout_attempt_id" "uuid", "p_interval" "text", "p_return_destination" "text") TO "service_role";



GRANT ALL ON TABLE "public"."billing_subscription_plan_changes" TO "anon";
GRANT ALL ON TABLE "public"."billing_subscription_plan_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_subscription_plan_changes" TO "service_role";



REVOKE ALL ON FUNCTION "public"."advance_billing_subscription_plan_change"("p_operation_id" "uuid", "p_expected_status" "text", "p_status" "text", "p_provider_resource_id" "text", "p_provider_target_id" "text", "p_effective_at" timestamp with time zone, "p_failure_code" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_billing_subscription_plan_change"("p_operation_id" "uuid", "p_expected_status" "text", "p_status" "text", "p_provider_resource_id" "text", "p_provider_target_id" "text", "p_effective_at" timestamp with time zone, "p_failure_code" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assign_personal_plan_one_time_qa"("p_lead_id" "uuid", "p_session_id" "uuid", "p_package_key" "text", "p_arm" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_personal_plan_one_time_qa"("p_lead_id" "uuid", "p_session_id" "uuid", "p_package_key" "text", "p_arm" "text") TO "service_role";



GRANT ALL ON TABLE "public"."billing_one_time_purchases" TO "service_role";
GRANT SELECT ON TABLE "public"."billing_one_time_purchases" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."bind_personal_plan_one_time_purchase_user"("p_consent_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bind_personal_plan_one_time_purchase_user"("p_consent_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_limit" integer, "p_window_ms" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_billing_subscription_plan_change"("p_operation_id" "uuid", "p_billing_subscription_id" "uuid", "p_user_id" "uuid", "p_provider" "text", "p_current_interval" "text", "p_target_interval" "text", "p_effective_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_billing_subscription_plan_change"("p_operation_id" "uuid", "p_billing_subscription_id" "uuid", "p_user_id" "uuid", "p_provider" "text", "p_current_interval" "text", "p_target_interval" "text", "p_effective_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_membership_reactivation_checkout_provider"("p_reservation_id" "uuid", "p_user_id" "uuid", "p_provider" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_membership_reactivation_checkout_provider"("p_reservation_id" "uuid", "p_user_id" "uuid", "p_provider" "text") TO "service_role";



GRANT ALL ON TABLE "public"."personal_plan_one_time_fulfillment_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_personal_plan_one_time_fulfillment_job"("p_job_id" "uuid", "p_stale_after_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_personal_plan_one_time_fulfillment_job"("p_job_id" "uuid", "p_stale_after_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_personal_plan_one_time_fulfillment_jobs"("p_limit" integer, "p_stale_after_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_personal_plan_one_time_fulfillment_jobs"("p_limit" integer, "p_stale_after_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_rate_limits"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_waitlist_survey"("p_survey_token_hash" "text", "p_survey_response_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_waitlist_survey"("p_survey_token_hash" "text", "p_survey_response_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_personal_plan_quiz_draft"("p_funnel_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_resume_token_hash" "text", "p_draft" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_personal_plan_quiz_draft"("p_funnel_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_resume_token_hash" "text", "p_draft" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_waitlist_signup"("p_campaign" "text", "p_normalized_email" "text", "p_first_name" "text", "p_marketing_consent" boolean, "p_attribution" "jsonb", "p_survey_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_waitlist_signup"("p_campaign" "text", "p_normalized_email" "text", "p_first_name" "text", "p_marketing_consent" boolean, "p_attribution" "jsonb", "p_survey_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_client_session_id" "uuid", "p_client_revision" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_client_session_id" "uuid", "p_client_revision" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."deny_paypal_expired_order_reset_audit_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deny_paypal_expired_order_reset_audit_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."deny_paypal_expired_order_reset_audit_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."deny_paypal_expired_order_reset_audit_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_billing_one_time_purchase_consent_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_billing_one_time_purchase_consent_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_billing_one_time_purchase_consent_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_personal_plan_one_time_consent_immutability"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_personal_plan_one_time_consent_immutability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_personal_plan_one_time_consent_immutability"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_personal_plan_customerio_profile_sync"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_personal_plan_customerio_profile_sync"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."exchange_personal_plan_quiz_draft"("p_resume_token_hash" "text", "p_replacement_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."exchange_personal_plan_quiz_draft"("p_resume_token_hash" "text", "p_replacement_token_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."expand_conditioner_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."expand_conditioner_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expand_conditioner_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."expand_leave_in_eligibility"("p_thicknesses" "text"[], "p_roles" "text"[], "p_care_benefits" "text"[], "p_application_stage" "text"[], "p_provides_heat_protection" boolean, "p_heat_activation_required" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."expand_leave_in_eligibility"("p_thicknesses" "text"[], "p_roles" "text"[], "p_care_benefits" "text"[], "p_application_stage" "text"[], "p_provides_heat_protection" boolean, "p_heat_activation_required" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expand_leave_in_eligibility"("p_thicknesses" "text"[], "p_roles" "text"[], "p_care_benefits" "text"[], "p_application_stage" "text"[], "p_provides_heat_protection" boolean, "p_heat_activation_required" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."expand_oil_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."expand_oil_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expand_oil_eligibility"("p_thicknesses" "text"[], "p_concerns" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_personal_plan_one_time_access_state"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_personal_plan_one_time_access_state"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_personal_plan_one_time_access_state"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."link_personal_plan_artifact_to_user"("p_lead_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_personal_plan_artifact_to_user"("p_lead_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_conditioner_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_protein_moisture_balance" "text", "match_count" integer, "category_filter" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_conditioner_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_protein_moisture_balance" "text", "match_count" integer, "category_filter" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_conditioner_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_protein_moisture_balance" "text", "match_count" integer, "category_filter" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_content_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_content_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_content_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_content_chunks_lexical"("query_text" "text", "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_content_chunks_lexical"("query_text" "text", "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_content_chunks_lexical"("query_text" "text", "match_count" integer, "source_filter" "text", "metadata_filter" "jsonb", "source_types" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_leave_in_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_need_bucket" "text", "user_styling_context" "text", "match_count" integer, "category_filter" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_leave_in_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_need_bucket" "text", "user_styling_context" "text", "match_count" integer, "category_filter" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_leave_in_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_need_bucket" "text", "user_styling_context" "text", "match_count" integer, "category_filter" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "user_hair_texture" "text", "user_concerns" "text"[], "match_count" integer, "category_filter" "text"[], "user_thickness" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "user_hair_texture" "text", "user_concerns" "text"[], "match_count" integer, "category_filter" "text"[], "user_thickness" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "user_hair_texture" "text", "user_concerns" "text"[], "match_count" integer, "category_filter" "text"[], "user_thickness" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_shampoo_bucket" "text", "match_count" integer, "category_filter" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_shampoo_bucket" "text", "match_count" integer, "category_filter" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_shampoo_bucket" "text", "match_count" integer, "category_filter" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_scalp_type" "text", "user_scalp_condition" "text", "match_count" integer, "category_filter" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_scalp_type" "text", "user_scalp_condition" "text", "match_count" integer, "category_filter" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_shampoo_products"("query_embedding" "extensions"."vector", "user_thickness" "text", "user_scalp_type" "text", "user_scalp_condition" "text", "match_count" integer, "category_filter" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_approve_reviewed_product"("p_submission_id" "uuid", "p_final_payload" "jsonb", "p_spec_operations" "jsonb", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_approve_reviewed_product"("p_submission_id" "uuid", "p_final_payload" "jsonb", "p_spec_operations" "jsonb", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_auto_enqueue_research_job"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_auto_enqueue_research_job"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_cancel_usage_for_category"("p_user_id" "uuid", "p_category" "text", "p_updated_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_cancel_usage_for_category"("p_user_id" "uuid", "p_category" "text", "p_updated_at" timestamp with time zone) TO "service_role";



GRANT ALL ON TABLE "public"."product_intake_research_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_claim_research_jobs"("worker_id" "text", "claim_limit" integer, "stale_after" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_claim_research_jobs"("worker_id" "text", "claim_limit" integer, "stale_after" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_enqueue_research_job"("target_submission_id" "uuid", "requested_stage" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_enqueue_research_job"("target_submission_id" "uuid", "requested_stage" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_get_or_create_brand"("p_canonical_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_get_or_create_brand"("p_canonical_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_get_or_create_product_line"("p_brand_id" "uuid", "p_canonical_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_get_or_create_product_line"("p_brand_id" "uuid", "p_canonical_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_link_existing_product"("p_submission_id" "uuid", "p_product_id" "uuid", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_link_existing_product"("p_submission_id" "uuid", "p_product_id" "uuid", "p_reviewed_by" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_reject_submission"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_reject_submission"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_replace_usage_with_matched_product"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_product_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_updated_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_replace_usage_with_matched_product"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_product_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_updated_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_replace_usage_with_pending_submission"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_submission_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_front_image_path" "text", "p_updated_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_replace_usage_with_pending_submission"("p_user_id" "uuid", "p_category" "text", "p_existing_usage_id" "uuid", "p_submission_id" "uuid", "p_product_name" "text", "p_frequency_range" "text", "p_brand_text" "text", "p_intake_method" "text", "p_source" "text", "p_front_image_path" "text", "p_updated_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_request_more_info"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text", "p_missing_fields" "jsonb", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_request_more_info"("p_submission_id" "uuid", "p_reviewed_by" "text", "p_reason" "text", "p_next_step" "text", "p_missing_fields" "jsonb", "p_reviewed_at" timestamp with time zone, "p_review_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_request_rework_job"("target_submission_id" "uuid", "rework_progress" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_request_rework_job"("target_submission_id" "uuid", "rework_progress" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_retry_research_job"("target_job_id" "uuid", "retry_progress" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_retry_research_job"("target_job_id" "uuid", "retry_progress" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."product_intake_review_normalize_identifier_value"("p_type" "text", "p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."product_intake_review_normalize_identifier_value"("p_type" "text", "p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_intake_review_normalize_identifier_value"("p_type" "text", "p_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_review_normalize_identity_text"("p_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_review_normalize_identity_text"("p_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."product_intake_update_research_job"("target_job_id" "uuid", "next_status" "text", "next_stage" "text", "next_progress" "jsonb", "next_last_error" "text", "expected_locked_by" "text", "expected_locked_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."product_intake_update_research_job"("target_job_id" "uuid", "next_status" "text", "next_stage" "text", "next_progress" "jsonb", "next_last_error" "text", "expected_locked_by" "text", "expected_locked_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_user_product_usage_review_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_user_product_usage_review_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_user_product_usage_review_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_product_image_asset"("p_product_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_public_url" "text", "p_source_page_url" "text", "p_source_image_url" "text", "p_source_type" "text", "p_quality_confidence" "text", "p_processing_method" "text", "p_asset_sha256" "text", "p_manifest_batch_id" "text", "p_user_approved" boolean, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."publish_product_image_asset"("p_product_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_public_url" "text", "p_source_page_url" "text", "p_source_image_url" "text", "p_source_type" "text", "p_quality_confidence" "text", "p_processing_method" "text", "p_asset_sha256" "text", "p_manifest_batch_id" "text", "p_user_approved" boolean, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_product_image_asset"("p_product_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_public_url" "text", "p_source_page_url" "text", "p_source_image_url" "text", "p_source_type" "text", "p_quality_confidence" "text", "p_processing_method" "text", "p_asset_sha256" "text", "p_manifest_batch_id" "text", "p_user_approved" boolean, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_expired_personal_plan_artifacts"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_expired_personal_plan_artifacts"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_expired_personal_plan_quiz_drafts"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_expired_personal_plan_quiz_drafts"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."read_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."read_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_product_leave_in_eligibility"("p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_product_leave_in_eligibility"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_product_leave_in_eligibility"("p_product_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_funnel_event"("p_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_channel" "text", "p_event_id" "text", "p_event_name" "text", "p_landing_slug" "text", "p_landing_variant" "text", "p_offer_variant" "text", "p_quiz_variant" "text", "p_entry_path" "text", "p_entry_url" "text", "p_referrer" "text", "p_first_touch" "jsonb", "p_first_seen_at" timestamp with time zone, "p_occurred_at" timestamp with time zone, "p_lead_id" "uuid", "p_user_id" "uuid", "p_checkout_provider" "text", "p_checkout_reference" "text", "p_properties" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_funnel_event"("p_session_id" "uuid", "p_visitor_id" "uuid", "p_package_key" "text", "p_channel" "text", "p_event_id" "text", "p_event_name" "text", "p_landing_slug" "text", "p_landing_variant" "text", "p_offer_variant" "text", "p_quiz_variant" "text", "p_entry_path" "text", "p_entry_url" "text", "p_referrer" "text", "p_first_touch" "jsonb", "p_first_seen_at" timestamp with time zone, "p_occurred_at" timestamp with time zone, "p_lead_id" "uuid", "p_user_id" "uuid", "p_checkout_provider" "text", "p_checkout_reference" "text", "p_properties" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_day_type" "text", "p_custom_activity_name" "text", "p_products" "jsonb", "p_client_session_id" "uuid", "p_client_revision" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_routine_log"("p_user_id" "uuid", "p_logged_on" "date", "p_timezone" "text", "p_day_type" "text", "p_custom_activity_name" "text", "p_products" "jsonb", "p_client_session_id" "uuid", "p_client_revision" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_customerio_profile_sync"("p_lead_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_customerio_profile_sync"("p_lead_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_expired_uncaptured_paypal_order"("p_provider_order_id" "text", "p_provider_state" "text", "p_provider_verified_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_expired_uncaptured_paypal_order"("p_provider_order_id" "text", "p_provider_state" "text", "p_provider_verified_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."reset_expired_uncaptured_paypal_order"("p_provider_order_id" "text", "p_provider_state" "text", "p_provider_verified_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_expired_uncaptured_paypal_order"("p_provider_order_id" "text", "p_provider_state" "text", "p_provider_verified_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_personal_plan_lead_with_artifact"("p_email" "text", "p_marketing_consent" boolean, "p_quiz_answers" "jsonb", "p_artifact_id" "uuid", "p_claim_token_hash" "text", "p_answer_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_personal_plan_lead_with_artifact"("p_email" "text", "p_marketing_consent" boolean, "p_quiz_answers" "jsonb", "p_artifact_id" "uuid", "p_claim_token_hash" "text", "p_answer_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_product_conditioner_specs_from_products"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_product_conditioner_specs_from_products"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_product_conditioner_specs_from_products"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_product_leave_in_eligibility_from_products"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_product_leave_in_eligibility_from_products"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_product_leave_in_eligibility_from_products"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_product_leave_in_eligibility_from_specs"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_product_leave_in_eligibility_from_specs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_product_leave_in_eligibility_from_specs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_product_oil_eligibility_from_products"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_product_oil_eligibility_from_products"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_product_oil_eligibility_from_products"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer, "p_expected_revision" integer, "p_draft" "jsonb", "p_allow_revision_catchup" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_personal_plan_quiz_draft"("p_draft_id" "uuid", "p_browser_generation" integer, "p_expected_revision" integer, "p_draft" "jsonb", "p_allow_revision_catchup" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_paypal_order_intent_binding"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_paypal_order_intent_binding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_paypal_order_intent_binding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_personal_plan_one_time_consent_binding"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_personal_plan_one_time_consent_binding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_personal_plan_one_time_consent_binding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_product_submission_foundation"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_product_submission_foundation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_product_submission_foundation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_product_submission_status_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_product_submission_status_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_product_submission_status_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_user_product_usage_submission_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_user_product_usage_submission_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_user_product_usage_submission_link"() TO "service_role";



GRANT ALL ON TABLE "public"."articles" TO "anon";
GRANT ALL ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";



GRANT ALL ON TABLE "public"."beta_feedback" TO "anon";
GRANT ALL ON TABLE "public"."beta_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."billing_analytics_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."billing_analytics_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_analytics_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."billing_analytics_outbox" TO "anon";
GRANT ALL ON TABLE "public"."billing_analytics_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_analytics_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."billing_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."billing_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."billing_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."billing_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."brand_aliases" TO "anon";
GRANT ALL ON TABLE "public"."brand_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."checkout_activation_claims" TO "anon";
GRANT ALL ON TABLE "public"."checkout_activation_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."checkout_activation_claims" TO "service_role";



GRANT ALL ON TABLE "public"."content_chunks" TO "anon";
GRANT ALL ON TABLE "public"."content_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."content_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_states" TO "anon";
GRANT ALL ON TABLE "public"."conversation_states" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_states" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_turn_traces" TO "anon";
GRANT ALL ON TABLE "public"."conversation_turn_traces" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_turn_traces" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."customerio_profile_sync_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."daily_quotes" TO "anon";
GRANT ALL ON TABLE "public"."daily_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."dismissed_suggestions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."dismissed_suggestions" TO "authenticated";



GRANT ALL ON TABLE "public"."funnel_events" TO "anon";
GRANT ALL ON TABLE "public"."funnel_events" TO "authenticated";
GRANT ALL ON TABLE "public"."funnel_events" TO "service_role";



GRANT ALL ON TABLE "public"."funnel_sessions" TO "anon";
GRANT ALL ON TABLE "public"."funnel_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."funnel_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."hair_profiles" TO "anon";
GRANT ALL ON TABLE "public"."hair_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."hair_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."manual_access_grants" TO "anon";
GRANT ALL ON TABLE "public"."manual_access_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."manual_access_grants" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."paypal_checkout_intents" TO "anon";
GRANT ALL ON TABLE "public"."paypal_checkout_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."paypal_checkout_intents" TO "service_role";



GRANT ALL ON TABLE "public"."paypal_expired_order_reset_audit" TO "service_role";



GRANT ALL ON TABLE "public"."paypal_order_intents" TO "service_role";



GRANT ALL ON TABLE "public"."personal_plan_one_time_checkout_consents" TO "service_role";



GRANT ALL ON TABLE "public"."personal_plan_prepared_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."personal_plan_quiz_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."product_bondbuilder_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_bondbuilder_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_bondbuilder_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_categories" TO "anon";
GRANT ALL ON TABLE "public"."product_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."product_categories" TO "service_role";



GRANT ALL ON TABLE "public"."product_conditioner_rerank_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_conditioner_rerank_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_conditioner_rerank_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_conditioner_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_conditioner_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_conditioner_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_deep_cleansing_shampoo_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_deep_cleansing_shampoo_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_deep_cleansing_shampoo_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_dry_shampoo_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_dry_shampoo_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_dry_shampoo_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_identifiers" TO "anon";
GRANT ALL ON TABLE "public"."product_identifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."product_identifiers" TO "service_role";



GRANT ALL ON TABLE "public"."product_image_assets" TO "anon";
GRANT ALL ON TABLE "public"."product_image_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."product_image_assets" TO "service_role";



GRANT ALL ON TABLE "public"."product_intake_research_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."product_intake_review_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."product_leave_in_eligibility" TO "anon";
GRANT ALL ON TABLE "public"."product_leave_in_eligibility" TO "authenticated";
GRANT ALL ON TABLE "public"."product_leave_in_eligibility" TO "service_role";



GRANT ALL ON TABLE "public"."product_leave_in_fit_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_leave_in_fit_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_leave_in_fit_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_leave_in_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_leave_in_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_leave_in_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_lines" TO "anon";
GRANT ALL ON TABLE "public"."product_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."product_lines" TO "service_role";



GRANT ALL ON TABLE "public"."product_mask_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_mask_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_mask_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_oil_eligibility" TO "anon";
GRANT ALL ON TABLE "public"."product_oil_eligibility" TO "authenticated";
GRANT ALL ON TABLE "public"."product_oil_eligibility" TO "service_role";



GRANT ALL ON TABLE "public"."product_peeling_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_peeling_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_peeling_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_relationships" TO "anon";
GRANT ALL ON TABLE "public"."product_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."product_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."product_shampoo_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_shampoo_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_shampoo_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_submissions" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."product_submissions" TO "authenticated";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."routine_log_products" TO "service_role";



GRANT ALL ON TABLE "public"."routine_logs" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tiers" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."tracker_nudge_dismissals" TO "service_role";



GRANT ALL ON TABLE "public"."user_product_usage" TO "anon";
GRANT ALL ON TABLE "public"."user_product_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."user_product_usage" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_customerio_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_signups" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- pg_dump --schema public cannot include a trigger attached to auth.users.
-- This is the exact custom production trigger definition observed read-only
-- alongside this snapshot.
DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();
