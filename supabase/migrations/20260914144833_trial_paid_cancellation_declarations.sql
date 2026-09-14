-- Declaration acceptance is independent of provider execution; paid access is not shortened.
CREATE TABLE private.trial_paid_cancellation_declarations (
 id uuid PRIMARY KEY,
 enrollment_id uuid NOT NULL UNIQUE REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 provider text NOT NULL CHECK(provider IN ('stripe','paypal')),
 original_agreement_id text NOT NULL,
 agreement_id text NOT NULL,
 customer_id text NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 effective_end_at timestamptz NOT NULL CHECK(isfinite(effective_end_at)),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),
 lease_token uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.trial_paid_cancellation_declarations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_paid_cancellation_declarations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.trial_paid_cancellation_declarations TO service_role;
CREATE FUNCTION private.protect_paid_cancellation_declaration() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','lease_token','lease_until','next_attempt_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['status','lease_token','lease_until','next_attempt_at']) OR (OLD.status='confirmed' AND NEW.status<>'confirmed')
 THEN RAISE EXCEPTION 'Paid cancellation declaration is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_paid_cancellation_declaration BEFORE UPDATE ON private.trial_paid_cancellation_declarations
 FOR EACH ROW EXECUTE FUNCTION private.protect_paid_cancellation_declaration();
CREATE FUNCTION public.request_trial_paid_cancellation(p_request_id uuid,p_enrollment_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; o private.trial_paid_cancellation_declarations%ROWTYPE; c jsonb; customer text;
BEGIN
 IF p_request_id IS NULL OR p_authenticated_user_id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id AND user_id=p_authenticated_user_id FOR UPDATE;
 IF NOT FOUND OR e.admission_status<>'active' OR e.first_payment_succeeded_at IS NULL OR e.paid_through_at IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO o FROM private.trial_paid_cancellation_declarations WHERE enrollment_id=e.id;
 IF FOUND THEN RETURN to_jsonb(o); END IF;
 c:=public.read_trial_effective_contract(e.id);
 -- Year-two legal termination/refund remains with the public declaration flow.
 IF c->'accepted_offer'->>'interval'='year' AND e.paid_through_at>
 (((e.first_payment_succeeded_at AT TIME ZONE 'UTC')+interval '1 year') AT TIME ZONE 'UTC') THEN RETURN NULL; END IF;
 SELECT b.provider_customer_id INTO customer FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id
 AND b.user_id=e.user_id AND b.provider=e.provider AND b.provider_subscription_id=e.provider_agreement_id;
 IF customer IS NULL OR c->>'provider_agreement_id' IS NULL THEN RETURN NULL; END IF;
 UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=e.id;
 INSERT INTO private.trial_paid_cancellation_declarations(id,enrollment_id,user_id,provider,original_agreement_id,agreement_id,customer_id,effective_end_at)
 VALUES(p_request_id,e.id,e.user_id,e.provider,e.provider_agreement_id,c->>'provider_agreement_id',customer,e.paid_through_at)
 RETURNING * INTO o;
 RETURN to_jsonb(o);
END; $$;
CREATE FUNCTION public.claim_trial_paid_cancellations(p_limit integer DEFAULT 2,p_declaration_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Invalid paid cancellation batch'; END IF;
 WITH candidates AS (SELECT id FROM private.trial_paid_cancellation_declarations WHERE status='pending'
 AND (p_declaration_id IS NULL OR id=p_declaration_id) AND next_attempt_at<=clock_timestamp()
 AND (lease_until IS NULL OR lease_until<clock_timestamp()) ORDER BY next_attempt_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED),
 claimed AS (UPDATE private.trial_paid_cancellation_declarations o SET lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes'
 FROM candidates c WHERE o.id=c.id RETURNING o.*)
 SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) INTO result FROM claimed o;
 RETURN result;
END; $$;
CREATE FUNCTION public.finish_trial_paid_cancellation(p_declaration_id uuid,p_lease_token uuid,p_confirmed boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o private.trial_paid_cancellation_declarations%ROWTYPE; e public.trial_enrollments%ROWTYPE;
BEGIN
 SELECT * INTO o FROM private.trial_paid_cancellation_declarations WHERE id=p_declaration_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=o.enrollment_id FOR UPDATE;
 SELECT * INTO o FROM private.trial_paid_cancellation_declarations WHERE id=p_declaration_id AND lease_token=p_lease_token
 AND lease_until>clock_timestamp() AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_confirmed AND (e.user_id IS DISTINCT FROM o.user_id OR NOT e.cancel_at_period_end
 OR e.paid_through_at IS DISTINCT FROM o.effective_end_at
 OR public.read_trial_effective_contract(e.id)->>'provider_agreement_id' IS DISTINCT FROM o.agreement_id
 OR EXISTS(SELECT 1 FROM private.trial_paid_recovery_operations r WHERE r.enrollment_id=e.id AND r.status='pending')
 OR EXISTS(SELECT 1 FROM private.trial_management_operations r WHERE r.enrollment_id=e.id AND r.status='pending')
 OR EXISTS(SELECT 1 FROM private.stripe_trial_continuation_operations r WHERE r.enrollment_id=e.id AND r.status='pending' AND r.create_attempted_at IS NOT NULL))
 THEN p_confirmed:=false; END IF;
 UPDATE private.trial_paid_cancellation_declarations SET status=CASE WHEN p_confirmed THEN 'confirmed' ELSE 'pending' END,
 lease_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+interval '5 minutes' WHERE id=o.id;
 RETURN p_confirmed;
END; $$;
REVOKE ALL ON FUNCTION private.protect_paid_cancellation_declaration(),public.request_trial_paid_cancellation(uuid,uuid,uuid),
 public.claim_trial_paid_cancellations(integer,uuid),public.finish_trial_paid_cancellation(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_paid_cancellation_declaration(),public.request_trial_paid_cancellation(uuid,uuid,uuid),
 public.claim_trial_paid_cancellations(integer,uuid),public.finish_trial_paid_cancellation(uuid,uuid,boolean) TO service_role;
ALTER TABLE private.trial_required_notices DROP CONSTRAINT trial_required_notices_kind_check;
ALTER TABLE private.trial_required_notices ADD CONSTRAINT trial_required_notices_kind_check
 CHECK(kind IN ('contract_confirmation','contract_change','cancellation_receipt','paid_cancellation_receipt','payment_receipt','annual_renewal'));
CREATE FUNCTION private.enqueue_paid_cancellation_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE;
BEGIN
 SELECT * INTO STRICT e FROM public.trial_enrollments WHERE id=NEW.enrollment_id;
 INSERT INTO private.trial_required_notices(enrollment_id,user_id,event_key,kind,snapshot)
 VALUES(e.id,NEW.user_id,'paid-cancellation:'||NEW.id,'paid_cancellation_receipt',private.trial_notice_snapshot(e)||
 jsonb_build_object('declarationId',NEW.id,'submittedAt',NEW.submitted_at,'effectiveEndAt',NEW.effective_end_at,
 'paidThroughAt',NEW.effective_end_at,'providerStatus','pending')) ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END; $$;
CREATE TRIGGER enqueue_paid_cancellation_notice AFTER INSERT ON private.trial_paid_cancellation_declarations
 FOR EACH ROW EXECUTE FUNCTION private.enqueue_paid_cancellation_notice();
REVOKE ALL ON FUNCTION private.enqueue_paid_cancellation_notice() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.enqueue_paid_cancellation_notice() TO service_role;
