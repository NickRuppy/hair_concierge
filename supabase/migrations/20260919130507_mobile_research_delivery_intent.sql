-- A mobile research request is a durable property of the submission, not of
-- the user-clearable scan history. No existing web submission is backfilled.
ALTER TABLE public.product_submissions
  ADD COLUMN mobile_result_requested_at timestamptz;

CREATE TABLE private.mobile_research_delivery_candidates (
  submission_id uuid PRIMARY KEY REFERENCES public.product_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'complete', 'failed_terminal')),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX mobile_research_delivery_candidates_due
  ON private.mobile_research_delivery_candidates(next_attempt_at, submission_id)
  WHERE state = 'pending';
ALTER TABLE private.mobile_research_delivery_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.mobile_research_delivery_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON private.mobile_research_delivery_candidates TO service_role;

-- Invoked only by the authenticated mobile server using its service client.
-- The row lock and COALESCE make an app retry safe, including a concurrent
-- Product Intake approval racing with the original submit response.
CREATE FUNCTION public.mobile_research_request_result(p_user_id uuid, p_submission_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_submission_id IS NULL THEN RETURN false; END IF;
  UPDATE public.product_submissions s
    SET mobile_result_requested_at = COALESCE(s.mobile_result_requested_at, clock_timestamp())
    WHERE s.id = p_submission_id AND s.user_id = p_user_id AND s.source = 'scan'
      AND s.scanned_identifier_value IS NOT NULL
      AND s.status NOT IN ('rejected', 'cancelled_by_user')
    RETURNING s.id INTO v_id;
  RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.mobile_research_request_result(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_research_request_result(uuid, uuid)
  TO service_role;

-- The trigger records candidacy only; it never sends, approves or publishes.
-- It runs on both orderings: phone intent before approval and approval before
-- the intent marker. Downstream workers must revalidate public mobile usability.
CREATE FUNCTION private.enqueue_mobile_research_delivery_candidate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.source = 'scan' AND NEW.mobile_result_requested_at IS NOT NULL
    AND NEW.scanned_identifier_value IS NOT NULL
    AND NEW.status IN ('approved', 'matched_existing')
    AND NEW.approved_product_id IS NOT NULL THEN
    INSERT INTO private.mobile_research_delivery_candidates(submission_id, user_id)
      VALUES (NEW.id, NEW.user_id)
      ON CONFLICT (submission_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enqueue_mobile_research_delivery_candidate_insert
  AFTER INSERT ON public.product_submissions FOR EACH ROW
  EXECUTE FUNCTION private.enqueue_mobile_research_delivery_candidate();
CREATE TRIGGER enqueue_mobile_research_delivery_candidate_update
  AFTER UPDATE OF status, approved_product_id, mobile_result_requested_at
  ON public.product_submissions FOR EACH ROW
  EXECUTE FUNCTION private.enqueue_mobile_research_delivery_candidate();
REVOKE ALL ON FUNCTION private.enqueue_mobile_research_delivery_candidate()
  FROM PUBLIC, anon, authenticated;

-- Competing cron runs can claim disjoint rows. A worker must finish by lease
-- token; expired workers cannot overwrite a newer claim.
CREATE FUNCTION public.claim_mobile_research_delivery_candidates(p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'invalid mobile delivery batch'; END IF;
  WITH due AS (
    SELECT c.submission_id FROM private.mobile_research_delivery_candidates c
    WHERE c.state = 'pending' AND c.next_attempt_at <= clock_timestamp()
      AND (c.lease_until IS NULL OR c.lease_until < clock_timestamp())
    ORDER BY c.next_attempt_at, c.submission_id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE private.mobile_research_delivery_candidates c
      SET lease_token = gen_random_uuid(), lease_until = clock_timestamp() + interval '5 minutes',
        attempt_count = c.attempt_count + 1
      FROM due WHERE c.submission_id = due.submission_id RETURNING c.*
  ) SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_rows FROM claimed c;
  RETURN v_rows;
END $$;
CREATE FUNCTION public.finish_mobile_research_delivery_candidate(
  p_submission_id uuid, p_lease_token uuid, p_action text,
  p_next_attempt_at timestamptz DEFAULT NULL, p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('complete', 'retry', 'failed_terminal')
    OR (p_action = 'retry' AND (p_next_attempt_at IS NULL OR p_next_attempt_at <= clock_timestamp()))
    OR (p_action <> 'retry' AND p_next_attempt_at IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid mobile delivery transition';
  END IF;
  UPDATE private.mobile_research_delivery_candidates c
    SET state = CASE WHEN p_action = 'retry' THEN 'pending' ELSE p_action END,
      next_attempt_at = COALESCE(p_next_attempt_at, c.next_attempt_at),
      lease_token = NULL, lease_until = NULL, last_error = left(p_error, 500)
    WHERE c.submission_id = p_submission_id AND c.lease_token = p_lease_token
      AND c.lease_until > clock_timestamp() AND c.state = 'pending'
    RETURNING c.submission_id INTO v_id;
  RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_mobile_research_delivery_candidates(integer),
  public.finish_mobile_research_delivery_candidate(uuid, uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mobile_research_delivery_candidates(integer),
  public.finish_mobile_research_delivery_candidate(uuid, uuid, text, timestamptz, text)
  TO service_role;
