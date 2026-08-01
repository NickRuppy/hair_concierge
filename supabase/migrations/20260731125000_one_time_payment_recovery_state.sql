DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.billing_one_time_purchases
    WHERE provider_order_id IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot migrate one-time purchases without provider order/session reference';
  END IF;
END;
$$;

ALTER TABLE public.billing_one_time_purchases
  ADD COLUMN IF NOT EXISTS consent_id uuid;

UPDATE public.billing_one_time_purchases purchase
SET consent_id = consent.id
FROM public.personal_plan_one_time_checkout_consents consent
WHERE purchase.consent_id IS NULL
  AND (
    (purchase.provider = 'stripe' AND consent.stripe_checkout_session_id = purchase.provider_order_id)
    OR (
      purchase.provider = 'paypal'
      AND (
        consent.paypal_capture_id = purchase.provider_transaction_id
        OR consent.paypal_order_id = purchase.provider_order_id
      )
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.billing_one_time_purchases
    WHERE consent_id IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot migrate one-time purchase without canonical consent_id';
  END IF;
END;
$$;

ALTER TABLE public.billing_one_time_purchases
  DROP CONSTRAINT IF EXISTS billing_one_time_purchases_user_id_fkey,
  ADD CONSTRAINT billing_one_time_purchases_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT billing_one_time_purchases_consent_id_fkey
    FOREIGN KEY (consent_id)
    REFERENCES public.personal_plan_one_time_checkout_consents(id)
    ON DELETE RESTRICT,
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN consent_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_one_time_purchases_consent_id_key
  ON public.billing_one_time_purchases (consent_id);

DROP INDEX IF EXISTS billing_one_time_purchases_one_paid_per_user_product;
CREATE UNIQUE INDEX billing_one_time_purchases_one_paid_per_user_product
  ON public.billing_one_time_purchases (user_id, product_kind)
  WHERE status = 'paid' AND user_id IS NOT NULL;

DROP POLICY IF EXISTS billing_one_time_purchases_select_own
  ON public.billing_one_time_purchases;
CREATE POLICY billing_one_time_purchases_select_own
  ON public.billing_one_time_purchases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.personal_plan_one_time_checkout_consents
  DROP CONSTRAINT IF EXISTS personal_plan_one_time_checkout_consents_user_id_fkey,
  ADD CONSTRAINT personal_plan_one_time_checkout_consents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.personal_plan_one_time_checkout_consents
  ADD CONSTRAINT personal_plan_one_time_delivery_evidence_complete
  CHECK (
    delivered_at IS NULL
    OR (
      generation_started_at IS NOT NULL
      AND generation_completed_at IS NOT NULL
      AND generated_content_sha256 IS NOT NULL
      AND delivery_provider IS NOT NULL
      AND delivery_reference IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_personal_plan_one_time_consent_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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

CREATE OR REPLACE FUNCTION public.enforce_billing_one_time_purchase_consent_match()
RETURNS trigger
LANGUAGE plpgsql
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

UPDATE public.personal_plan_one_time_checkout_consents consent
SET user_id = purchase.user_id
FROM public.billing_one_time_purchases purchase
WHERE consent.id = purchase.consent_id
  AND consent.user_id IS NULL
  AND purchase.user_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.billing_one_time_purchases purchase
    JOIN public.personal_plan_one_time_checkout_consents consent
      ON consent.id = purchase.consent_id
    WHERE purchase.user_id IS NOT NULL
      AND (
        consent.user_id IS NULL
        OR consent.user_id IS DISTINCT FROM purchase.user_id
      )
  ) THEN
    RAISE EXCEPTION 'one-time purchase and consent user bindings must match before enforcing trigger';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS enforce_billing_one_time_purchase_consent_match
  ON public.billing_one_time_purchases;
CREATE TRIGGER enforce_billing_one_time_purchase_consent_match
  BEFORE INSERT OR UPDATE ON public.billing_one_time_purchases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_billing_one_time_purchase_consent_match();

CREATE OR REPLACE FUNCTION public.bind_personal_plan_one_time_purchase_user(
  p_consent_id uuid,
  p_purchase_id uuid,
  p_user_id uuid
)
RETURNS public.billing_one_time_purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.bind_personal_plan_one_time_purchase_user(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_personal_plan_one_time_purchase_user(uuid, uuid, uuid)
  TO service_role;

CREATE TABLE public.personal_plan_one_time_fulfillment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.billing_one_time_purchases(id) ON DELETE RESTRICT,
  consent_id uuid NOT NULL UNIQUE REFERENCES public.personal_plan_one_time_checkout_consents(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'failed_permanent')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  next_attempt_at timestamptz,
  processing_started_at timestamptz,
  last_error text,
  delivery_provider text,
  delivery_reference text,
  canonical_content_sha256 text CHECK (
    canonical_content_sha256 IS NULL OR canonical_content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'processing') = (processing_started_at IS NOT NULL)),
  CHECK (status <> 'completed' OR (
    delivery_provider IS NOT NULL
    AND delivery_reference IS NOT NULL
    AND canonical_content_sha256 IS NOT NULL
    AND delivered_at IS NOT NULL
  ))
);

CREATE UNIQUE INDEX personal_plan_one_time_fulfillment_jobs_active_purchase_idx
  ON public.personal_plan_one_time_fulfillment_jobs (purchase_id)
  WHERE status IN ('pending', 'processing', 'failed');

CREATE INDEX personal_plan_one_time_fulfillment_jobs_due_idx
  ON public.personal_plan_one_time_fulfillment_jobs (status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed', 'processing');

ALTER TABLE public.personal_plan_one_time_fulfillment_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_one_time_fulfillment_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.personal_plan_one_time_fulfillment_jobs TO service_role;

-- Legacy paid purchases predate the fulfillment worker and therefore have no
-- delivery evidence. Queue only incomplete, non-revoked purchases so the
-- normal service-role worker can establish that evidence idempotently.
INSERT INTO public.personal_plan_one_time_fulfillment_jobs (purchase_id, consent_id, status)
SELECT purchase.id, consent.id, 'pending'
FROM public.billing_one_time_purchases purchase
JOIN public.personal_plan_one_time_checkout_consents consent
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
ON CONFLICT (purchase_id) DO NOTHING;

CREATE TRIGGER set_updated_at_personal_plan_one_time_fulfillment_jobs
  BEFORE UPDATE ON public.personal_plan_one_time_fulfillment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_personal_plan_one_time_fulfillment_jobs(
  p_limit integer DEFAULT 10,
  p_stale_after_minutes integer DEFAULT 15
)
RETURNS SETOF public.personal_plan_one_time_fulfillment_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.claim_personal_plan_one_time_fulfillment_jobs(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_personal_plan_one_time_fulfillment_jobs(integer, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_personal_plan_one_time_fulfillment_job(
  p_job_id uuid,
  p_stale_after_minutes integer DEFAULT 15
)
RETURNS public.personal_plan_one_time_fulfillment_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.claim_personal_plan_one_time_fulfillment_job(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_personal_plan_one_time_fulfillment_job(uuid, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_personal_plan_one_time_access_state(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_personal_plan_one_time_access_state(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_plan_one_time_access_state(uuid)
  TO authenticated, service_role;

COMMENT ON TABLE public.personal_plan_one_time_fulfillment_jobs IS
  'Private service-role fulfillment queue for one-time personal-plan confirmation, finalization, and delivery retry state.';
