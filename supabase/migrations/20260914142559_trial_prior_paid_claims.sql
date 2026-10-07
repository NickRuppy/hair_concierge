-- Verified prior paid memberships use the same minimal consumed-claim namespace.
-- This does not create a trial enrollment or change legacy billing/access.
CREATE FUNCTION public.record_prior_paid_trial_claims(p_claims jsonb, p_paid_at timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; lock_key bigint; affected integer;
BEGIN
 IF p_claims IS NULL OR jsonb_typeof(p_claims)<>'array' OR jsonb_array_length(p_claims) NOT BETWEEN 1 AND 64
   OR p_paid_at IS NULL OR NOT isfinite(p_paid_at) THEN RAISE EXCEPTION 'Invalid paid history'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(p_claims) LOOP
   IF jsonb_typeof(c)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(c))<>4
     OR NOT(c ?& ARRAY['kind','keyVersion','namespace','value'])
     OR coalesce(c->>'kind','') NOT IN ('account','verified_email','stripe_card','paypal_payer')
     OR jsonb_typeof(c->'keyVersion')<>'number' OR coalesce(c->>'keyVersion','') !~ '^[1-9][0-9]{0,8}$'
     OR jsonb_typeof(c->'namespace')<>'string' OR coalesce(length(btrim(c->>'namespace')),0) NOT BETWEEN 1 AND 255
     OR jsonb_typeof(c->'value')<>'string' OR coalesce(c->>'value','') !~ '^[0-9a-f]{64}$'
   THEN RAISE EXCEPTION 'Invalid paid history claim'; END IF;
 END LOOP;
 FOR lock_key IN SELECT DISTINCT hashtextextended(jsonb_build_array(
   value->>'kind',(value->>'keyVersion')::integer,value->>'namespace',value->>'value')::text,7319)
   FROM jsonb_array_elements(p_claims) ORDER BY 1 LOOP
   PERFORM pg_advisory_xact_lock(lock_key);
 END LOOP;
 INSERT INTO public.trial_identity_claims(kind,key_version,namespace,claim_digest,enrollment_id,consumed_at)
 SELECT DISTINCT value->>'kind',(value->>'keyVersion')::integer,value->>'namespace',value->>'value',NULL::uuid,p_paid_at
 FROM jsonb_array_elements(p_claims)
 ON CONFLICT(kind,key_version,namespace,claim_digest) DO UPDATE SET
   enrollment_id=CASE WHEN trial_identity_claims.consumed_at IS NULL THEN NULL ELSE trial_identity_claims.enrollment_id END,
   consumed_at=least(trial_identity_claims.consumed_at,excluded.consumed_at);
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected;
END; $$;
REVOKE ALL ON FUNCTION public.record_prior_paid_trial_claims(jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_prior_paid_trial_claims(jsonb,timestamptz) TO service_role;
