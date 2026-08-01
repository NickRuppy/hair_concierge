CREATE TABLE IF NOT EXISTS public.customerio_profile_sync_outbox (
  lead_id uuid PRIMARY KEY REFERENCES public.leads (id) ON DELETE CASCADE,
  profile_revision integer NOT NULL DEFAULT 1 CHECK (profile_revision > 0),
  completion_event_eligible boolean NOT NULL DEFAULT false,
  send_completion_event boolean NOT NULL DEFAULT false,
  completion_event_delivered_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'delivered', 'failed', 'failed_permanent')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  processing_started_at timestamptz,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customerio_profile_sync_outbox_status_due_idx
  ON public.customerio_profile_sync_outbox (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS customerio_profile_sync_outbox_processing_started_idx
  ON public.customerio_profile_sync_outbox (status, processing_started_at);

ALTER TABLE public.customerio_profile_sync_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.request_customerio_profile_sync(
  p_lead_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.enqueue_personal_plan_customerio_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS leads_enqueue_customerio_profile_sync ON public.leads;
CREATE TRIGGER leads_enqueue_customerio_profile_sync
AFTER INSERT OR UPDATE OF email, marketing_consent, quiz_answers
ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_personal_plan_customerio_profile_sync();

REVOKE ALL ON TABLE public.customerio_profile_sync_outbox
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_customerio_profile_sync(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_personal_plan_customerio_profile_sync()
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.customerio_profile_sync_outbox TO service_role;
GRANT EXECUTE ON FUNCTION public.request_customerio_profile_sync(uuid)
  TO service_role;

COMMENT ON TABLE public.customerio_profile_sync_outbox IS
  'Retry state for projecting Personal Plan leads from Supabase into Customer.io. Profile data remains in leads.';
