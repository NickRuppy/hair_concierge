-- Original accepted_offer, authorization clock and provider_agreement_id stay immutable.
-- Provider calls live outside transactions; one unresolved operation owns the change.
CREATE SCHEMA IF NOT EXISTS private;
-- A single unique namespace covers original and replacement agreements. The
-- original-admission trigger and management commit share this constraint, so
-- concurrent cross-table binding cannot assign an agreement to two enrollments.
CREATE TABLE private.trial_management_agreement_bindings (
  provider text NOT NULL CHECK (provider IN ('stripe','paypal')),
  provider_agreement_id text NOT NULL,
  enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  PRIMARY KEY (provider,provider_agreement_id)
);
CREATE FUNCTION private.bind_original_trial_management_agreement() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.provider_agreement_id IS NOT NULL THEN
 INSERT INTO private.trial_management_agreement_bindings(provider,provider_agreement_id,enrollment_id)
 VALUES(NEW.provider,NEW.provider_agreement_id,NEW.id) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM private.trial_management_agreement_bindings
 WHERE provider=NEW.provider AND provider_agreement_id=NEW.provider_agreement_id AND enrollment_id=NEW.id) THEN
 RAISE EXCEPTION 'Trial agreement already belongs to another enrollment' USING ERRCODE='23505'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER bind_original_trial_management_agreement AFTER INSERT OR UPDATE OF provider_agreement_id ON public.trial_enrollments
 FOR EACH ROW EXECUTE FUNCTION private.bind_original_trial_management_agreement();
ALTER TABLE private.trial_management_agreement_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_management_agreement_bindings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.trial_management_agreement_bindings TO service_role;
REVOKE ALL ON FUNCTION private.bind_original_trial_management_agreement() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.bind_original_trial_management_agreement() TO service_role;

CREATE TABLE private.trial_management_catalogs (
  enrollment_id uuid PRIMARY KEY REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  catalog jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.trial_management_state (
  enrollment_id uuid PRIMARY KEY REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  cancellation_version bigint NOT NULL DEFAULT 0 CHECK (cancellation_version >= 0)
);
CREATE TABLE private.trial_management_operations (
  id uuid PRIMARY KEY,
  enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('switch','restore')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','committed','abandoned')),
  expected_revision integer NOT NULL,
  cancellation_version bigint NOT NULL,
  provider text NOT NULL CHECK (provider IN ('stripe','paypal')),
  provider_customer_id text NOT NULL,
  original_agreement_id text NOT NULL,
  source_agreement_id text NOT NULL,
  original_trial_end_at timestamptz NOT NULL,
  source_offer jsonb NOT NULL,
  target_offer jsonb NOT NULL,
  source_cancel_at_period_end boolean NOT NULL,
  cancel_at_period_end boolean NOT NULL,
  target_agreement_id text,
  evidence jsonb,
  reconciliation_reference text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CHECK ((status = 'pending') = (completed_at IS NULL))
);
CREATE UNIQUE INDEX trial_management_one_pending ON private.trial_management_operations(enrollment_id) WHERE status='pending';
CREATE TABLE private.trial_offer_revisions (
  enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  operation_id uuid NOT NULL UNIQUE REFERENCES private.trial_management_operations(id) ON DELETE RESTRICT,
  accepted_offer jsonb NOT NULL,
  provider text NOT NULL CHECK (provider IN ('stripe','paypal')),
  provider_agreement_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (enrollment_id, revision)
);

CREATE FUNCTION private.reject_trial_management_immutable_write() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  RAISE EXCEPTION 'Trial management history is immutable' USING ERRCODE='23514';
END; $$;
CREATE TRIGGER trial_management_catalog_immutable BEFORE UPDATE OR DELETE ON private.trial_management_catalogs
 FOR EACH ROW EXECUTE FUNCTION private.reject_trial_management_immutable_write();
CREATE TRIGGER trial_management_agreement_binding_immutable BEFORE UPDATE OR DELETE ON private.trial_management_agreement_bindings
 FOR EACH ROW EXECUTE FUNCTION private.reject_trial_management_immutable_write();
CREATE TRIGGER trial_offer_revision_immutable BEFORE UPDATE OR DELETE ON private.trial_offer_revisions
 FOR EACH ROW EXECUTE FUNCTION private.reject_trial_management_immutable_write();

-- A cancellation declaration made while already canceled must invalidate a restore too.
CREATE FUNCTION private.invalidate_trial_management_on_cancellation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF TG_TABLE_NAME = 'trial_cancellation_declarations' THEN
    PERFORM 1 FROM public.trial_enrollments WHERE id=NEW.enrollment_id FOR UPDATE;
    UPDATE private.trial_management_state SET cancellation_version=cancellation_version+1 WHERE enrollment_id=NEW.enrollment_id;
  ELSIF NEW.cancel_at_period_end IS DISTINCT FROM OLD.cancel_at_period_end OR NEW.access_revoked IS DISTINCT FROM OLD.access_revoked THEN
    UPDATE private.trial_management_state SET cancellation_version=cancellation_version+1 WHERE enrollment_id=NEW.id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trial_management_cancellation_change AFTER UPDATE ON public.trial_enrollments
 FOR EACH ROW EXECUTE FUNCTION private.invalidate_trial_management_on_cancellation();
CREATE TRIGGER trial_management_cancellation_declaration AFTER INSERT ON private.trial_cancellation_declarations
 FOR EACH ROW EXECUTE FUNCTION private.invalidate_trial_management_on_cancellation();

CREATE FUNCTION private.valid_trial_management_offer(p_offer jsonb, p_interval text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_typeof(p_offer)='object' AND p_offer->>'cohort'='trial_v1'
   AND p_offer->>'offerVersion'='trial_launch_v1' AND p_offer->>'interval'=p_interval
   AND p_offer->>'currency'='EUR' AND p_offer->'trialDays'='7'::jsonb
   AND p_offer->>'taxBehavior'='inclusive'
   AND length(p_offer->>'stripePriceId') BETWEEN 1 AND 255 AND p_offer->>'stripePriceId' !~ '[[:space:]]'
   AND (p_offer->'stripeCouponId'='null'::jsonb OR (jsonb_typeof(p_offer->'stripeCouponId')='string'
     AND length(p_offer->>'stripeCouponId') BETWEEN 1 AND 255 AND p_offer->>'stripeCouponId' !~ '[[:space:]]'))
   AND CASE p_interval WHEN 'month' THEN p_offer->'stripeCouponId'='null'::jsonb
     AND p_offer->'firstAmountMinor'='999'::jsonb AND p_offer->'renewalAmountMinor'='999'::jsonb
   WHEN 'year' THEN p_offer->'renewalAmountMinor'='9999'::jsonb
     AND p_offer->'firstAmountMinor'=CASE WHEN p_offer->'stripeCouponId'='null'::jsonb THEN '9999'::jsonb ELSE '6999'::jsonb END
   ELSE false END, false);
$$;
CREATE FUNCTION public.freeze_trial_management_catalog(p_enrollment_id uuid,p_catalog jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; c jsonb;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT catalog INTO c FROM private.trial_management_catalogs WHERE enrollment_id=e.id;
 IF FOUND THEN RETURN c=p_catalog; END IF;
 IF e.admission_status<>'reserved' OR e.authorization_succeeded_at IS NOT NULL
   OR NOT private.valid_trial_management_offer(p_catalog->'month','month')
   OR NOT private.valid_trial_management_offer(p_catalog->'year','year')
   OR p_catalog->'month'->>'stripePriceId'=p_catalog->'year'->>'stripePriceId'
   OR e.accepted_offer IS DISTINCT FROM p_catalog->(e.accepted_offer->>'interval')
 THEN RETURN false; END IF;
 INSERT INTO private.trial_management_catalogs(enrollment_id,catalog) VALUES(e.id,p_catalog);
 INSERT INTO private.trial_management_state(enrollment_id) VALUES(e.id);
 RETURN true;
END; $$;
CREATE FUNCTION public.load_trial_management_state(p_enrollment_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('enrollmentId',e.id,'revision',s.revision,
   'effectiveOffer',coalesce(r.accepted_offer,e.accepted_offer),
   'originalAgreementId',e.provider_agreement_id,'currentAgreementId',coalesce(r.provider_agreement_id,e.provider_agreement_id))
 FROM public.trial_enrollments e JOIN private.trial_management_state s ON s.enrollment_id=e.id
 LEFT JOIN private.trial_offer_revisions r ON r.enrollment_id=e.id AND r.revision=s.revision
 WHERE e.id=p_enrollment_id AND e.user_id=p_authenticated_user_id;
$$;
CREATE FUNCTION private.trial_management_operation_json(o private.trial_management_operations) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',o.id,'enrollmentId',o.enrollment_id,'userId',o.user_id,'kind',o.kind,'status',o.status,
 'expectedRevision',o.expected_revision,'cancellationVersion',o.cancellation_version,'provider',o.provider,
 'providerCustomerId',o.provider_customer_id,'originalAgreementId',o.original_agreement_id,'sourceAgreementId',o.source_agreement_id,
 'originalTrialEndAt',o.original_trial_end_at,'sourceOffer',o.source_offer,'targetOffer',o.target_offer,
 'cancelAtPeriodEnd',o.cancel_at_period_end,'targetAgreementId',o.target_agreement_id);
$$;
CREATE FUNCTION public.load_trial_management_operation(p_operation_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.trial_management_operation_json(o) FROM private.trial_management_operations o
 JOIN public.trial_enrollments e ON e.id=o.enrollment_id
 WHERE o.id=p_operation_id AND o.user_id=p_authenticated_user_id AND e.user_id=p_authenticated_user_id;
$$;
CREATE FUNCTION public.begin_trial_management_operation(p_operation_id uuid,p_enrollment_id uuid,
 p_authenticated_user_id uuid,p_kind text,p_expected_revision integer,p_target_interval text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; s private.trial_management_state%ROWTYPE;
 o private.trial_management_operations%ROWTYPE; c jsonb; effective jsonb; source_agreement text; customer text;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND OR e.user_id IS DISTINCT FROM p_authenticated_user_id OR p_authenticated_user_id IS NULL THEN
   RAISE EXCEPTION 'Trial management unavailable'; END IF;
 SELECT * INTO o FROM private.trial_management_operations WHERE id=p_operation_id;
 IF FOUND THEN
   IF o.enrollment_id<>e.id OR o.user_id<>p_authenticated_user_id OR o.kind IS DISTINCT FROM p_kind
    OR o.expected_revision IS DISTINCT FROM p_expected_revision OR o.target_offer->>'interval' IS DISTINCT FROM p_target_interval THEN
    RAISE EXCEPTION 'Trial management operation conflict'; END IF;
   RETURN private.trial_management_operation_json(o);
 END IF;
 SELECT * INTO s FROM private.trial_management_state WHERE enrollment_id=e.id FOR UPDATE;
 IF NOT FOUND OR s.revision IS DISTINCT FROM p_expected_revision OR p_kind IS NULL OR p_kind NOT IN ('switch','restore')
  OR p_target_interval IS NULL OR p_target_interval NOT IN ('month','year')
  OR e.admission_status<>'active' OR e.access_revoked OR e.neutralization_required
  OR e.authorization_succeeded_at IS NULL OR e.authorization_succeeded_at>clock_timestamp()
  OR e.original_trial_end_at<=clock_timestamp() OR e.first_payment_succeeded_at IS NOT NULL
  OR (p_kind='restore' AND NOT e.cancel_at_period_end)
  OR EXISTS(SELECT 1 FROM private.trial_cancellation_declarations d JOIN private.trial_cancellation_provider_operations x ON x.declaration_id=d.id
    WHERE d.enrollment_id=e.id AND x.status<>'confirmed')
 THEN RAISE EXCEPTION 'Trial management unavailable'; END IF;
 SELECT catalog INTO c FROM private.trial_management_catalogs WHERE enrollment_id=e.id;
 IF s.revision>0 AND NOT EXISTS(SELECT 1 FROM private.trial_offer_revisions WHERE enrollment_id=e.id AND revision=s.revision) THEN
 RAISE EXCEPTION 'Trial selected revision requires reconciliation'; END IF;
 SELECT coalesce(r.accepted_offer,e.accepted_offer),coalesce(r.provider_agreement_id,e.provider_agreement_id)
 INTO effective,source_agreement FROM (SELECT 1) seed LEFT JOIN private.trial_offer_revisions r ON r.enrollment_id=e.id AND r.revision=s.revision;
 IF (p_kind='switch' AND effective->>'interval'=p_target_interval) OR (p_kind='restore' AND effective->>'interval'<>p_target_interval)
 THEN RAISE EXCEPTION 'Trial management interval conflict'; END IF;
 SELECT b.provider_customer_id INTO customer FROM public.billing_subscriptions b
 WHERE b.trial_enrollment_id=e.id AND b.user_id=e.user_id AND b.provider=e.provider
   AND b.provider_subscription_id=e.provider_agreement_id;
 IF customer IS NULL OR c->p_target_interval IS NULL THEN RAISE EXCEPTION 'Trial management binding unavailable'; END IF;
 INSERT INTO private.trial_management_operations(id,enrollment_id,user_id,kind,expected_revision,cancellation_version,
 provider,provider_customer_id,original_agreement_id,source_agreement_id,original_trial_end_at,source_offer,target_offer,
 source_cancel_at_period_end,cancel_at_period_end)
 VALUES(p_operation_id,e.id,e.user_id,p_kind,s.revision,s.cancellation_version,e.provider,customer,e.provider_agreement_id,
 source_agreement,e.original_trial_end_at,effective,c->p_target_interval,e.cancel_at_period_end,
 CASE WHEN p_kind='restore' THEN false ELSE e.cancel_at_period_end END) RETURNING * INTO o;
 RETURN private.trial_management_operation_json(o);
END; $$;

-- Service RPC is a provider-attestation boundary, not evidence that a browser approved.
CREATE FUNCTION public.commit_trial_management_operation(p_operation_id uuid,p_authenticated_user_id uuid,p_evidence jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; s private.trial_management_state%ROWTYPE;
 o private.trial_management_operations%ROWTYPE; target text; current_agreement text;
BEGIN
 SELECT * INTO o FROM private.trial_management_operations WHERE id=p_operation_id;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM p_authenticated_user_id OR p_authenticated_user_id IS NULL THEN RETURN false; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=o.enrollment_id FOR UPDATE;
 IF e.user_id IS DISTINCT FROM p_authenticated_user_id THEN RETURN false; END IF;
 SELECT * INTO s FROM private.trial_management_state WHERE enrollment_id=e.id FOR UPDATE;
 SELECT * INTO o FROM private.trial_management_operations WHERE id=p_operation_id FOR UPDATE;
 IF o.status='committed' THEN RETURN o.evidence=p_evidence; END IF;
 target:=p_evidence->>'targetAgreementId';
 IF o.status<>'pending' OR s.revision<>o.expected_revision OR s.cancellation_version<>o.cancellation_version
   OR e.cancel_at_period_end<>o.source_cancel_at_period_end OR e.access_revoked OR e.neutralization_required
   OR e.admission_status<>'active' OR e.first_payment_succeeded_at IS NOT NULL OR e.original_trial_end_at<=clock_timestamp()
   OR p_evidence->>'provider' IS DISTINCT FROM o.provider
   OR p_evidence->>'providerCustomerId' IS DISTINCT FROM o.provider_customer_id
   OR p_evidence->>'sourceAgreementId' IS DISTINCT FROM o.source_agreement_id
   OR p_evidence->'offer' IS DISTINCT FROM o.target_offer
   OR p_evidence->'cancelAtPeriodEnd' IS DISTINCT FROM to_jsonb(o.cancel_at_period_end)
   OR p_evidence->'noImmediatePayment' IS DISTINCT FROM 'true'::jsonb
   OR coalesce(length(target),0) NOT BETWEEN 1 AND 255 OR target ~ '[[:space:]]'
   OR coalesce(length(btrim(p_evidence->>'reference')),0) NOT BETWEEN 1 AND 255
   OR p_evidence->>'originalTrialEndAt' IS NULL
 THEN RETURN false; END IF;
 IF (p_evidence->>'originalTrialEndAt')::timestamptz IS DISTINCT FROM o.original_trial_end_at THEN RETURN false; END IF;
 IF target<>o.source_agreement_id AND p_evidence->'sourceAgreementNeutralized' IS DISTINCT FROM 'true'::jsonb THEN RETURN false; END IF;
 SELECT coalesce(r.provider_agreement_id,e.provider_agreement_id) INTO current_agreement FROM (SELECT 1) seed
 LEFT JOIN private.trial_offer_revisions r ON r.enrollment_id=e.id AND r.revision=s.revision;
 IF s.revision>0 AND NOT EXISTS(SELECT 1 FROM private.trial_management_agreement_bindings
 WHERE provider=e.provider AND provider_agreement_id=current_agreement AND enrollment_id=e.id) THEN RETURN false; END IF;
 IF current_agreement IS DISTINCT FROM o.source_agreement_id OR NOT EXISTS(
   SELECT 1 FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id AND b.user_id=e.user_id
   AND b.provider=e.provider AND b.provider_subscription_id=e.provider_agreement_id AND b.provider_customer_id=o.provider_customer_id)
 THEN RETURN false; END IF;
 -- Lock target identity even when no binding exists yet; prevent cross-enrollment reuse.
 PERFORM pg_advisory_xact_lock(hashtextextended(o.provider||':'||target,92813));
 IF EXISTS(SELECT 1 FROM public.trial_enrollments x WHERE x.provider=o.provider AND x.provider_agreement_id=target AND x.id<>e.id)
 OR EXISTS(SELECT 1 FROM private.trial_offer_revisions r WHERE r.provider=o.provider AND r.provider_agreement_id=target AND r.enrollment_id<>e.id)
 OR EXISTS(SELECT 1 FROM public.billing_subscriptions b WHERE b.provider=o.provider AND b.provider_subscription_id=target
   AND (b.trial_enrollment_id IS DISTINCT FROM e.id OR b.user_id IS DISTINCT FROM e.user_id OR b.provider_customer_id IS DISTINCT FROM o.provider_customer_id))
 THEN RETURN false; END IF;
 INSERT INTO private.trial_management_agreement_bindings(provider,provider_agreement_id,enrollment_id)
 VALUES(o.provider,target,e.id) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM private.trial_management_agreement_bindings
 WHERE provider=o.provider AND provider_agreement_id=target AND enrollment_id=e.id) THEN RETURN false; END IF;
 INSERT INTO private.trial_offer_revisions(enrollment_id,revision,operation_id,accepted_offer,provider,provider_agreement_id)
 VALUES(e.id,s.revision+1,o.id,o.target_offer,o.provider,target);
 UPDATE private.trial_management_state SET revision=revision+1 WHERE enrollment_id=e.id;
 UPDATE public.trial_enrollments SET cancel_at_period_end=o.cancel_at_period_end WHERE id=e.id;
 UPDATE private.trial_management_operations SET status='committed',target_agreement_id=target,evidence=p_evidence,completed_at=clock_timestamp() WHERE id=o.id;
 RETURN true;
END; $$;
CREATE FUNCTION public.abandon_trial_management_operation(p_operation_id uuid,p_authenticated_user_id uuid,p_reconciliation_reference text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o private.trial_management_operations%ROWTYPE;
BEGIN
 IF coalesce(length(btrim(p_reconciliation_reference)),0) NOT BETWEEN 1 AND 255 THEN RETURN false; END IF;
 SELECT * INTO o FROM private.trial_management_operations WHERE id=p_operation_id FOR UPDATE;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM p_authenticated_user_id OR p_authenticated_user_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.trial_enrollments e WHERE e.id=o.enrollment_id AND e.user_id=p_authenticated_user_id)
 THEN RETURN false; END IF;
 IF o.status='abandoned' THEN RETURN o.reconciliation_reference=p_reconciliation_reference; END IF;
 IF o.status<>'pending' THEN RETURN false; END IF;
 UPDATE private.trial_management_operations SET status='abandoned',reconciliation_reference=p_reconciliation_reference,
 completed_at=clock_timestamp() WHERE id=o.id;
 RETURN true;
END; $$;

ALTER TABLE private.trial_management_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_management_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_management_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_offer_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_management_catalogs,private.trial_management_state,private.trial_management_operations,private.trial_offer_revisions FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT,INSERT ON private.trial_management_catalogs,private.trial_offer_revisions TO service_role;
GRANT SELECT,INSERT,UPDATE ON private.trial_management_state,private.trial_management_operations TO service_role;
REVOKE ALL ON FUNCTION private.reject_trial_management_immutable_write(),private.invalidate_trial_management_on_cancellation(),
 private.valid_trial_management_offer(jsonb,text),private.trial_management_operation_json(private.trial_management_operations),
 public.freeze_trial_management_catalog(uuid,jsonb),public.load_trial_management_state(uuid,uuid),
 public.begin_trial_management_operation(uuid,uuid,uuid,text,integer,text),public.load_trial_management_operation(uuid,uuid),
 public.commit_trial_management_operation(uuid,uuid,jsonb),public.abandon_trial_management_operation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.reject_trial_management_immutable_write(),private.invalidate_trial_management_on_cancellation(),
 private.valid_trial_management_offer(jsonb,text),private.trial_management_operation_json(private.trial_management_operations),
 public.freeze_trial_management_catalog(uuid,jsonb),public.load_trial_management_state(uuid,uuid),
 public.begin_trial_management_operation(uuid,uuid,uuid,text,integer,text),public.load_trial_management_operation(uuid,uuid),
 public.commit_trial_management_operation(uuid,uuid,jsonb),public.abandon_trial_management_operation(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.guard_trial_management_operation(p_operation_id uuid,p_authenticated_user_id uuid) RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.trial_management_operations o
 JOIN public.trial_enrollments e ON e.id=o.enrollment_id
 JOIN private.trial_management_state s ON s.enrollment_id=e.id
 WHERE o.id=p_operation_id AND o.user_id=p_authenticated_user_id AND e.user_id=p_authenticated_user_id
 AND o.status='pending' AND e.admission_status='active' AND NOT e.access_revoked AND NOT e.neutralization_required
 AND e.first_payment_succeeded_at IS NULL AND e.original_trial_end_at>clock_timestamp()
 AND s.revision=o.expected_revision AND s.cancellation_version=o.cancellation_version
 AND e.cancel_at_period_end=o.source_cancel_at_period_end);
$$;
CREATE FUNCTION public.load_frozen_trial_management_catalog(p_enrollment_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT catalog FROM private.trial_management_catalogs WHERE enrollment_id=p_enrollment_id;
$$;
REVOKE ALL ON FUNCTION public.guard_trial_management_operation(uuid,uuid),public.load_frozen_trial_management_catalog(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_trial_management_operation(uuid,uuid),public.load_frozen_trial_management_catalog(uuid) TO service_role;

CREATE FUNCTION private.protect_trial_management_operation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','target_agreement_id','evidence','reconciliation_reference','completed_at'])
 IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','target_agreement_id','evidence','reconciliation_reference','completed_at'])
 OR (OLD.status<>'pending' AND NEW IS DISTINCT FROM OLD) THEN
 RAISE EXCEPTION 'Trial management operation is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_trial_management_operation BEFORE UPDATE ON private.trial_management_operations
 FOR EACH ROW EXECUTE FUNCTION private.protect_trial_management_operation();
REVOKE ALL ON FUNCTION private.protect_trial_management_operation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_trial_management_operation() TO service_role;

CREATE FUNCTION public.read_trial_effective_contract(p_enrollment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; s private.trial_management_state%ROWTYPE; r private.trial_offer_revisions%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO s FROM private.trial_management_state WHERE enrollment_id=e.id;
 IF NOT FOUND OR s.revision=0 THEN
 RETURN jsonb_build_object('accepted_offer',e.accepted_offer,'provider',e.provider,'provider_agreement_id',e.provider_agreement_id,'revision',0);
 END IF;
 SELECT * INTO r FROM private.trial_offer_revisions WHERE enrollment_id=e.id AND revision=s.revision;
 IF NOT FOUND OR r.provider<>e.provider OR NOT private.valid_trial_management_offer(r.accepted_offer,r.accepted_offer->>'interval') THEN
 RAISE EXCEPTION 'Trial effective contract requires reconciliation'; END IF;
 RETURN jsonb_build_object('accepted_offer',r.accepted_offer,'provider',r.provider,'provider_agreement_id',r.provider_agreement_id,'revision',r.revision);
END; $$;
REVOKE ALL ON FUNCTION public.read_trial_effective_contract(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_trial_effective_contract(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.load_trial_management_state(p_enrollment_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('enrollmentId',e.id,'revision',c->'revision',
   'effectiveOffer',c->'accepted_offer','originalAgreementId',e.provider_agreement_id,
   'currentAgreementId',c->'provider_agreement_id')
 FROM public.trial_enrollments e JOIN private.trial_management_state s ON s.enrollment_id=e.id
 CROSS JOIN LATERAL public.read_trial_effective_contract(e.id) c
 WHERE e.id=p_enrollment_id AND e.user_id=p_authenticated_user_id;
$$;

CREATE FUNCTION public.load_pending_trial_management_operation(p_enrollment_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.trial_management_operation_json(o) FROM private.trial_management_operations o
 JOIN public.trial_enrollments e ON e.id=o.enrollment_id
 WHERE o.enrollment_id=p_enrollment_id AND o.user_id=p_authenticated_user_id
 AND e.user_id=p_authenticated_user_id AND o.status='pending';
$$;
REVOKE ALL ON FUNCTION public.load_pending_trial_management_operation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.load_pending_trial_management_operation(uuid,uuid) TO service_role;

-- One statement snapshot prevents confirmation from mixing a prior cancellation
-- flag with a newly selected revision across separately issued REST reads.
CREATE FUNCTION public.load_trial_management_public_view(p_enrollment_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('enrollmentId',e.id,'revision',s.revision,
 'interval',CASE WHEN s.revision=0 THEN e.accepted_offer->'interval' ELSE r.accepted_offer->'interval' END,
 'originalTrialEndAt',e.original_trial_end_at,'cancelAtPeriodEnd',e.cancel_at_period_end,
 'canManage',e.admission_status='active' AND NOT e.access_revoked AND NOT e.neutralization_required
   AND e.authorization_succeeded_at<=clock_timestamp() AND e.original_trial_end_at>clock_timestamp()
   AND e.first_payment_succeeded_at IS NULL,
 'offers',jsonb_build_object(
   'month',jsonb_build_object('interval','month','currency',c.catalog->'month'->'currency',
    'firstAmountMinor',c.catalog->'month'->'firstAmountMinor','renewalAmountMinor',c.catalog->'month'->'renewalAmountMinor'),
   'year',jsonb_build_object('interval','year','currency',c.catalog->'year'->'currency',
    'firstAmountMinor',c.catalog->'year'->'firstAmountMinor','renewalAmountMinor',c.catalog->'year'->'renewalAmountMinor')),
 'pendingOperation',(SELECT jsonb_build_object('operationId',o.id,'kind',o.kind,'targetInterval',o.target_offer->'interval')
   FROM private.trial_management_operations o WHERE o.enrollment_id=e.id AND o.user_id=e.user_id AND o.status='pending'))
 FROM public.trial_enrollments e
 JOIN private.trial_management_state s ON s.enrollment_id=e.id
 JOIN private.trial_management_catalogs c ON c.enrollment_id=e.id
 LEFT JOIN private.trial_offer_revisions r ON r.enrollment_id=e.id AND r.revision=s.revision
 WHERE e.id=p_enrollment_id AND e.user_id=p_authenticated_user_id AND e.admission_status='active'
 AND (s.revision=0 OR (r.revision IS NOT NULL AND r.provider=e.provider));
$$;
REVOKE ALL ON FUNCTION public.load_trial_management_public_view(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.load_trial_management_public_view(uuid,uuid) TO service_role;
