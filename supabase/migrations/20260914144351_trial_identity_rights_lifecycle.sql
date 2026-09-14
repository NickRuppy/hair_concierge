-- Service-only rights control. Sources identify old operations, never a person for denial.
CREATE TABLE private.trial_identity_sources (
 kind text NOT NULL CHECK(kind IN ('enrollment','stripe','paypal')), source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 255),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','restricted','erased')),
 excluded_identity_groups jsonb NOT NULL DEFAULT '[]'::jsonb, rights_reference text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,source_id)
);
CREATE TABLE private.trial_identity_source_claims (
 source_kind text NOT NULL, source_id text NOT NULL, kind text NOT NULL, key_version integer NOT NULL,
 namespace text NOT NULL, claim_digest text NOT NULL,
 PRIMARY KEY(source_kind,source_id,kind,key_version,namespace,claim_digest),
 FOREIGN KEY(source_kind,source_id) REFERENCES private.trial_identity_sources(kind,source_id) ON DELETE CASCADE
);
CREATE INDEX trial_identity_source_claims_lookup ON private.trial_identity_source_claims(kind,key_version,namespace,claim_digest);
CREATE TABLE private.trial_identity_restrictions (
 kind text NOT NULL,key_version integer NOT NULL,namespace text NOT NULL,claim_digest text NOT NULL,
 enrollment_id uuid REFERENCES public.trial_enrollments(id) ON DELETE SET NULL,consumed_at timestamptz,
 rights_reference text NOT NULL, PRIMARY KEY(kind,key_version,namespace,claim_digest)
);
CREATE TABLE private.trial_identity_rights_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_kind text NOT NULL,source_id text NOT NULL,action text NOT NULL,kinds text[] NOT NULL,reference text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.trial_identity_rights_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_identity_rights_actions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON private.trial_identity_rights_actions TO service_role;
CREATE TABLE private.trial_identity_key_versions(version integer PRIMARY KEY CHECK(version BETWEEN 1 AND 999999999));
-- Associate already-present claims before the first rights request, without raw identities.
INSERT INTO private.trial_identity_sources(kind,source_id)
 SELECT DISTINCT 'enrollment',enrollment_id::text FROM public.trial_identity_claims WHERE enrollment_id IS NOT NULL;
INSERT INTO private.trial_identity_source_claims SELECT 'enrollment',enrollment_id::text,kind,key_version,namespace,claim_digest
 FROM public.trial_identity_claims WHERE enrollment_id IS NOT NULL;
INSERT INTO private.trial_identity_sources(kind,source_id)
 SELECT DISTINCT e.provider,e.provider_agreement_id FROM public.trial_enrollments e
 JOIN public.trial_identity_claims c ON c.enrollment_id=e.id WHERE e.provider_agreement_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO private.trial_identity_source_claims
 SELECT e.provider,e.provider_agreement_id,c.kind,c.key_version,c.namespace,c.claim_digest FROM public.trial_enrollments e
 JOIN public.trial_identity_claims c ON c.enrollment_id=e.id WHERE e.provider_agreement_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO private.trial_identity_key_versions SELECT DISTINCT key_version FROM public.trial_identity_claims;
-- Pre-registry historical NULL claims cannot be attributed retrospectively to a payment.
-- They must be reviewed/removed before rollout rather than inventing a source binding.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.trial_identity_claims WHERE enrollment_id IS NULL) THEN
 RAISE EXCEPTION 'Unattributed historical claims require migration reconciliation'; END IF; END $$;
ALTER TABLE private.trial_identity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_identity_source_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_identity_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_identity_key_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_identity_sources,private.trial_identity_source_claims,private.trial_identity_restrictions,private.trial_identity_key_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.trial_identity_sources,private.trial_identity_source_claims,private.trial_identity_restrictions,private.trial_identity_key_versions TO service_role;

CREATE FUNCTION public.configure_trial_identity_key_versions(p_versions integer[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 IF p_versions IS NULL OR cardinality(p_versions) NOT BETWEEN 1 AND 8 OR EXISTS(SELECT 1 FROM unnest(p_versions) v WHERE v IS NULL OR v NOT BETWEEN 1 AND 999999999)
 OR cardinality(p_versions)<>(SELECT count(DISTINCT v) FROM unnest(p_versions) v) THEN RAISE EXCEPTION 'Invalid identity key registry'; END IF;
 IF EXISTS(SELECT 1 FROM private.trial_identity_restrictions WHERE NOT(key_version=ANY(p_versions)))
 OR EXISTS(SELECT 1 FROM public.trial_identity_claims WHERE NOT(key_version=ANY(p_versions))) THEN RAISE EXCEPTION 'Retained claims require key overlap'; END IF;
 DELETE FROM private.trial_identity_key_versions;
 INSERT INTO private.trial_identity_key_versions SELECT unnest(p_versions);
END $$;

CREATE FUNCTION private.prepare_trial_identity_source(p_kind text,p_source_id text,p_claims jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_claim jsonb; filtered jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 IF p_kind IS NULL OR p_kind NOT IN ('enrollment','stripe','paypal') OR p_source_id IS NULL OR length(btrim(p_source_id)) NOT BETWEEN 1 AND 255
 OR p_claims IS NULL OR jsonb_typeof(p_claims)<>'array' OR jsonb_array_length(p_claims) NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'Invalid identity source'; END IF;
 FOR v_claim IN SELECT value FROM jsonb_array_elements(p_claims) LOOP
 IF jsonb_typeof(v_claim)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(v_claim))<>4 OR NOT(v_claim ?& ARRAY['kind','keyVersion','namespace','value'])
 OR coalesce(v_claim->>'kind','') NOT IN ('account','verified_email','stripe_card','paypal_payer')
 OR jsonb_typeof(v_claim->'keyVersion')<>'number' OR coalesce(v_claim->>'keyVersion','') !~ '^[1-9][0-9]{0,8}$'
 OR jsonb_typeof(v_claim->'namespace')<>'string' OR coalesce(length(btrim(v_claim->>'namespace')),0) NOT BETWEEN 1 AND 255
 OR jsonb_typeof(v_claim->'value')<>'string' OR coalesce(v_claim->>'value','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid identity claim'; END IF;
 END LOOP;
 INSERT INTO private.trial_identity_sources(kind,source_id) VALUES(p_kind,p_source_id) ON CONFLICT DO NOTHING;
 -- Trial replacements/revisions remain part of an erased enrollment's old
 -- operation family, even when their first payment was not imported before erasure.
 IF p_kind IN ('stripe','paypal') THEN
 INSERT INTO private.trial_identity_sources(kind,source_id,status,rights_reference)
 SELECT p_kind,p_source_id,'erased',es.rights_reference FROM private.trial_identity_sources es
 WHERE es.kind='enrollment' AND es.status='erased' AND (
 EXISTS(SELECT 1 FROM public.trial_enrollments e WHERE e.id::text=es.source_id AND e.provider=p_kind AND e.provider_agreement_id=p_source_id)
 OR EXISTS(SELECT 1 FROM public.billing_subscriptions b WHERE b.trial_enrollment_id::text=es.source_id AND b.provider=p_kind AND b.provider_subscription_id=p_source_id)
 OR EXISTS(SELECT 1 FROM private.trial_offer_revisions r WHERE r.enrollment_id::text=es.source_id AND r.provider=p_kind AND r.provider_agreement_id=p_source_id))
 LIMIT 1 ON CONFLICT(kind,source_id) DO UPDATE SET status='erased',rights_reference=excluded.rights_reference;
 END IF;
 PERFORM set_config('app.trial_identity_source_kind',p_kind,true); PERFORM set_config('app.trial_identity_source_id',p_source_id,true);
 IF EXISTS(SELECT 1 FROM private.trial_identity_sources WHERE kind=p_kind AND source_id=p_source_id AND status<>'active') THEN RETURN '[]'::jsonb; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.trial_identity_key_versions) THEN RAISE EXCEPTION 'Identity key registry must be configured'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_claims) c WHERE NOT EXISTS(SELECT 1 FROM private.trial_identity_key_versions k WHERE k.version=(c->>'keyVersion')::integer))
 OR EXISTS(SELECT 1 FROM (SELECT DISTINCT c->>'kind' kind,c->>'namespace' namespace FROM jsonb_array_elements(p_claims) c) identities
 CROSS JOIN private.trial_identity_key_versions k WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_claims) c
 WHERE c->>'kind'=identities.kind AND c->>'namespace'=identities.namespace AND (c->>'keyVersion')::integer=k.version)) THEN RAISE EXCEPTION 'Identity key registry mismatch'; END IF;
 -- Exemption belongs to this operation, not to a person. A trial admitted
 -- during restriction must remain replayable after the original claims return.
 UPDATE private.trial_identity_sources s SET excluded_identity_groups=(
 SELECT coalesce(jsonb_agg(DISTINCT g),'[]'::jsonb) FROM (
 SELECT value g FROM jsonb_array_elements(s.excluded_identity_groups)
 UNION SELECT jsonb_build_object('kind',c->>'kind','namespace',c->>'namespace') g
 FROM jsonb_array_elements(p_claims) c JOIN private.trial_identity_restrictions r ON r.kind=c->>'kind'
 AND r.key_version=(c->>'keyVersion')::integer AND r.namespace=c->>'namespace' AND r.claim_digest=c->>'value') groups)
 WHERE s.kind=p_kind AND s.source_id=p_source_id;
 -- Any restricted matching version excludes every version of that identity group.
 SELECT coalesce(jsonb_agg(c),'[]'::jsonb) INTO filtered FROM jsonb_array_elements(p_claims) c WHERE NOT EXISTS(
 SELECT 1 FROM private.trial_identity_sources s CROSS JOIN jsonb_array_elements(s.excluded_identity_groups) g WHERE s.kind=p_kind AND s.source_id=p_source_id AND g->>'kind'=c->>'kind' AND g->>'namespace'=c->>'namespace') AND NOT EXISTS(
 SELECT 1 FROM jsonb_array_elements(p_claims) peer JOIN private.trial_identity_restrictions r
 ON r.kind=peer->>'kind' AND r.key_version=(peer->>'keyVersion')::integer AND r.namespace=peer->>'namespace' AND r.claim_digest=peer->>'value'
 WHERE peer->>'kind'=c->>'kind' AND peer->>'namespace'=c->>'namespace');
 INSERT INTO private.trial_identity_source_claims(source_kind,source_id,kind,key_version,namespace,claim_digest)
 SELECT DISTINCT p_kind,p_source_id,c->>'kind',(c->>'keyVersion')::integer,c->>'namespace',c->>'value' FROM jsonb_array_elements(filtered) c ON CONFLICT DO NOTHING;
 PERFORM set_config('app.trial_identity_source_kind',p_kind,true); PERFORM set_config('app.trial_identity_source_id',p_source_id,true);
 RETURN filtered;
END $$;

CREATE FUNCTION private.guard_trial_identity_write() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 IF EXISTS(SELECT 1 FROM private.trial_identity_restrictions WHERE kind=NEW.kind AND key_version=NEW.key_version AND namespace=NEW.namespace AND claim_digest=NEW.claim_digest) THEN RETURN NULL; END IF;
 IF current_setting('app.trial_identity_rights_restore',true)='yes' THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM private.trial_identity_sources WHERE kind=current_setting('app.trial_identity_source_kind',true) AND source_id=current_setting('app.trial_identity_source_id',true) AND status<>'active') THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.trial_identity_sources s JOIN private.trial_identity_source_claims c ON c.source_kind=s.kind AND c.source_id=s.source_id
 WHERE s.kind=current_setting('app.trial_identity_source_kind',true) AND s.source_id=current_setting('app.trial_identity_source_id',true) AND s.status='active'
 AND c.kind=NEW.kind AND c.key_version=NEW.key_version AND c.namespace=NEW.namespace AND c.claim_digest=NEW.claim_digest) THEN RAISE EXCEPTION 'Identity source write is not authorized'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_trial_identity_write BEFORE INSERT OR UPDATE ON public.trial_identity_claims FOR EACH ROW EXECUTE FUNCTION private.guard_trial_identity_write();
CREATE OR REPLACE FUNCTION public.admit_trial_enrollment(
  p_enrollment_id uuid,
  p_claims jsonb,
  p_authorized_at timestamptz DEFAULT NULL,
  p_provider_agreement_id text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  enrollment public.trial_enrollments%ROWTYPE;
  claim jsonb;
  conflict_reason text;
  identity_lock bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(74144351);
  IF p_claims IS NULL OR jsonb_typeof(p_claims) <> 'array' THEN
    RAISE EXCEPTION 'Verified identity claims required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_claims) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Invalid identity claim count' USING ERRCODE = '22023';
  END IF;
  FOR claim IN SELECT value FROM jsonb_array_elements(p_claims) LOOP
    IF jsonb_typeof(claim) IS DISTINCT FROM 'object'
      OR jsonb_typeof(claim->'kind') IS DISTINCT FROM 'string'
      OR coalesce(claim->>'kind', '') NOT IN ('account', 'verified_email', 'stripe_card', 'paypal_payer')
      OR jsonb_typeof(claim->'keyVersion') IS DISTINCT FROM 'number'
      OR coalesce(claim->>'keyVersion', '') !~ '^[1-9][0-9]{0,8}$'
      OR jsonb_typeof(claim->'namespace') IS DISTINCT FROM 'string'
      OR coalesce(length(btrim(claim->>'namespace')), 0) NOT BETWEEN 1 AND 255
      OR jsonb_typeof(claim->'value') IS DISTINCT FROM 'string'
      OR coalesce(claim->>'value', '') !~ '^[0-9a-f]{64}$'
    THEN
      RAISE EXCEPTION 'Invalid verified identity claim' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF (p_authorized_at IS NULL) <> (p_provider_agreement_id IS NULL)
    OR (p_authorized_at IS NOT NULL AND (
      NOT isfinite(p_authorized_at) OR p_authorized_at > clock_timestamp()
      OR length(btrim(p_provider_agreement_id)) NOT BETWEEN 1 AND 255
    ))
  THEN
    RAISE EXCEPTION 'Invalid verified authorization' USING ERRCODE = '22023';
  END IF;

  p_claims := private.prepare_trial_identity_source('enrollment',p_enrollment_id::text,p_claims);
  SELECT * INTO enrollment FROM public.trial_enrollments
    WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid_state'; END IF;
  IF coalesce(enrollment.provider_agreement_id,p_provider_agreement_id) IS NOT NULL THEN
    INSERT INTO private.trial_identity_sources(kind,source_id,status,rights_reference)
    SELECT enrollment.provider,coalesce(enrollment.provider_agreement_id,p_provider_agreement_id),'erased',rights_reference
    FROM private.trial_identity_sources WHERE kind='enrollment' AND source_id=p_enrollment_id::text AND status='erased'
    ON CONFLICT(kind,source_id) DO UPDATE SET status='erased',rights_reference=excluded.rights_reference;
  END IF;
  IF coalesce(enrollment.provider_agreement_id,p_provider_agreement_id) IS NOT NULL AND jsonb_array_length(p_claims)>0 THEN
    p_claims := private.prepare_trial_identity_source(enrollment.provider,coalesce(enrollment.provider_agreement_id,p_provider_agreement_id),p_claims);
    INSERT INTO private.trial_identity_source_claims(source_kind,source_id,kind,key_version,namespace,claim_digest)
    SELECT enrollment.provider,coalesce(enrollment.provider_agreement_id,p_provider_agreement_id),c.kind,c.key_version,c.namespace,c.claim_digest
    FROM private.trial_identity_source_claims c JOIN private.trial_identity_sources s ON s.kind=enrollment.provider AND s.source_id=coalesce(enrollment.provider_agreement_id,p_provider_agreement_id)
    WHERE c.source_kind='enrollment' AND c.source_id=p_enrollment_id::text AND s.status='active' ON CONFLICT DO NOTHING;
  END IF;
  IF enrollment.provider_agreement_id IS NOT NULL
    AND p_provider_agreement_id IS NOT NULL
    AND enrollment.provider_agreement_id <> p_provider_agreement_id
  THEN RETURN 'invalid_state'; END IF;

  IF enrollment.admission_status IN ('blocked', 'released') THEN
    -- Approval may arrive after an earlier denial or reconciled abandonment.
    -- Persist the agreement for reconciliation; never resurrect the entitlement.
    IF p_authorized_at IS NOT NULL THEN
      UPDATE public.trial_enrollments SET provider_agreement_id = p_provider_agreement_id,
        neutralization_required = true WHERE id = p_enrollment_id;
    END IF;
    RETURN CASE WHEN enrollment.admission_status = 'blocked'
      THEN coalesce(enrollment.admission_denial_reason, 'invalid_state') ELSE 'invalid_state' END;
  END IF;

  IF enrollment.admission_status = 'active' THEN
    IF p_authorized_at IS DISTINCT FROM enrollment.authorization_succeeded_at
      OR p_provider_agreement_id IS DISTINCT FROM enrollment.provider_agreement_id
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_claims) c
        WHERE NOT EXISTS (
          SELECT 1 FROM public.trial_identity_claims t
          WHERE t.kind = c->>'kind' AND t.key_version = (c->>'keyVersion')::integer
            AND t.namespace = c->>'namespace' AND t.claim_digest = c->>'value'
            AND t.enrollment_id = p_enrollment_id AND t.consumed_at IS NOT NULL
        )
      )
    THEN RETURN 'invalid_state'; END IF;
    RETURN 'active';
  END IF;

  -- Lock the same identity tuple in canonical order, including absent rows.
  -- Unique keys remain the final guard; advisory hash collisions only serialize work.
  FOR identity_lock IN SELECT lock_key FROM (
    SELECT DISTINCT hashtextextended(jsonb_build_array(
      c->>'kind', (c->>'keyVersion')::integer, c->>'namespace', c->>'value'
    )::text, 7319) AS lock_key FROM jsonb_array_elements(p_claims) c
  ) locks ORDER BY lock_key LOOP
    PERFORM pg_advisory_xact_lock(identity_lock);
  END LOOP;

  SELECT CASE WHEN bool_or(t.consumed_at IS NOT NULL) THEN 'trial_used' ELSE 'claim_reserved' END
    INTO conflict_reason
    FROM public.trial_identity_claims t JOIN jsonb_array_elements(p_claims) c
      ON t.kind = c->>'kind' AND t.key_version = (c->>'keyVersion')::integer
      AND t.namespace = c->>'namespace' AND t.claim_digest = c->>'value'
    WHERE t.enrollment_id IS DISTINCT FROM p_enrollment_id
    HAVING count(*) > 0;
  IF conflict_reason IS NOT NULL THEN
    UPDATE public.trial_enrollments SET admission_status = 'blocked', admission_denial_reason = conflict_reason,
      provider_agreement_id = coalesce(p_provider_agreement_id, provider_agreement_id),
      neutralization_required = (coalesce(p_provider_agreement_id, provider_agreement_id) IS NOT NULL)
      WHERE id = p_enrollment_id;
    RETURN conflict_reason;
  END IF;

  INSERT INTO public.trial_identity_claims(kind, key_version, namespace, claim_digest, enrollment_id)
    SELECT DISTINCT c->>'kind', (c->>'keyVersion')::integer, c->>'namespace', c->>'value', p_enrollment_id
    FROM jsonb_array_elements(p_claims) c
    ON CONFLICT (kind, key_version, namespace, claim_digest) DO NOTHING;
  -- Fail closed if a separate trusted writer bypassed our advisory-lock protocol.
  IF EXISTS (
    SELECT 1 FROM public.trial_identity_claims t JOIN jsonb_array_elements(p_claims) c
      ON t.kind = c->>'kind' AND t.key_version = (c->>'keyVersion')::integer
      AND t.namespace = c->>'namespace' AND t.claim_digest = c->>'value'
    WHERE t.enrollment_id IS DISTINCT FROM p_enrollment_id
  ) THEN
    RAISE EXCEPTION 'Trial identity ownership changed; retry reconciliation' USING ERRCODE = '40001';
  END IF;
  IF p_authorized_at IS NULL THEN RETURN 'reserved'; END IF;

  UPDATE public.trial_identity_claims SET consumed_at = p_authorized_at
    WHERE enrollment_id = p_enrollment_id AND consumed_at IS NULL;
  UPDATE public.trial_enrollments SET admission_status = 'active',
    provider_agreement_id = p_provider_agreement_id,
    authorization_succeeded_at = p_authorized_at,
    original_trial_end_at = p_authorized_at + interval '604800 seconds'
    WHERE id = p_enrollment_id;
  RETURN 'active';
END;
$$;

DROP FUNCTION public.record_prior_paid_trial_claims(jsonb,timestamptz);
CREATE FUNCTION public.record_prior_paid_trial_claims(p_claims jsonb,p_paid_at timestamptz,p_provider text,p_agreement_id text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer; lock_key bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 IF p_provider NOT IN ('stripe','paypal') OR p_paid_at IS NULL OR NOT isfinite(p_paid_at) OR p_paid_at>clock_timestamp() THEN RAISE EXCEPTION 'Invalid paid history'; END IF;
 p_claims := private.prepare_trial_identity_source(p_provider,p_agreement_id,p_claims);
 FOR lock_key IN SELECT DISTINCT hashtextextended(jsonb_build_array(c->>'kind',(c->>'keyVersion')::integer,c->>'namespace',c->>'value')::text,7319)
 FROM jsonb_array_elements(p_claims) c ORDER BY 1 LOOP PERFORM pg_advisory_xact_lock(lock_key); END LOOP;
 INSERT INTO public.trial_identity_claims(kind,key_version,namespace,claim_digest,enrollment_id,consumed_at)
 SELECT DISTINCT c->>'kind',(c->>'keyVersion')::integer,c->>'namespace',c->>'value',NULL::uuid,p_paid_at FROM jsonb_array_elements(p_claims) c
 ON CONFLICT(kind,key_version,namespace,claim_digest) DO UPDATE SET
 enrollment_id=CASE WHEN trial_identity_claims.consumed_at IS NULL THEN NULL ELSE trial_identity_claims.enrollment_id END,
 consumed_at=least(trial_identity_claims.consumed_at,excluded.consumed_at);
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

CREATE FUNCTION public.apply_trial_identity_rights(p_source_kind text,p_source_id text,p_action text,p_kinds text[],p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE selected jsonb; n integer; restore_claim jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 IF p_action IS NULL OR p_action NOT IN ('restrict','release','erase','correct') OR p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 1 AND 255
 OR p_kinds IS NULL OR cardinality(p_kinds) NOT BETWEEN 1 AND 4 OR EXISTS(SELECT 1 FROM unnest(p_kinds) k WHERE k IS NULL OR k NOT IN ('account','verified_email','stripe_card','paypal_payer'))
 THEN RAISE EXCEPTION 'Invalid rights operation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.trial_identity_sources WHERE kind=p_source_kind AND source_id=p_source_id) THEN RAISE EXCEPTION 'Unknown identity source'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO selected FROM private.trial_identity_source_claims c WHERE source_kind=p_source_kind AND source_id=p_source_id AND kind=ANY(p_kinds);
 IF p_action='release' THEN
   IF EXISTS(SELECT 1 FROM private.trial_identity_restrictions r JOIN jsonb_array_elements(selected) c ON r.kind=c->>'kind' AND r.key_version=(c->>'key_version')::integer AND r.namespace=c->>'namespace' AND r.claim_digest=c->>'claim_digest' WHERE r.rights_reference<>p_reference) THEN RAISE EXCEPTION 'Restriction case reference mismatch'; END IF;
   IF EXISTS(SELECT 1 FROM private.trial_identity_sources WHERE kind=p_source_kind AND source_id=p_source_id AND status='erased') THEN RAISE EXCEPTION 'Erased source cannot be restored'; END IF;
   PERFORM set_config('app.trial_identity_rights_restore','yes',true);
   FOR restore_claim IN SELECT value FROM jsonb_array_elements(selected) LOOP
     WITH removed AS (DELETE FROM private.trial_identity_restrictions r WHERE r.kind=restore_claim->>'kind' AND r.key_version=(restore_claim->>'key_version')::integer AND r.namespace=restore_claim->>'namespace' AND r.claim_digest=restore_claim->>'claim_digest' AND r.rights_reference=p_reference RETURNING *)
     INSERT INTO public.trial_identity_claims(kind,key_version,namespace,claim_digest,enrollment_id,consumed_at)
     SELECT kind,key_version,namespace,claim_digest,enrollment_id,consumed_at FROM removed WHERE consumed_at IS NOT NULL OR enrollment_id IS NOT NULL ON CONFLICT DO NOTHING;
   END LOOP;
   PERFORM set_config('app.trial_identity_rights_restore','no',true);
   UPDATE private.trial_identity_sources SET status='active',updated_at=now() WHERE status='restricted' AND rights_reference=p_reference;
 ELSE
   IF p_action='restrict' THEN
     INSERT INTO private.trial_identity_restrictions(kind,key_version,namespace,claim_digest,enrollment_id,consumed_at,rights_reference)
     SELECT t.kind,t.key_version,t.namespace,t.claim_digest,t.enrollment_id,t.consumed_at,p_reference FROM public.trial_identity_claims t
     WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(selected) c WHERE t.kind=c->>'kind' AND t.key_version=(c->>'key_version')::integer AND t.namespace=c->>'namespace' AND t.claim_digest=c->>'claim_digest') ON CONFLICT DO NOTHING;
   END IF;
   DELETE FROM public.trial_identity_claims t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(selected) c WHERE t.kind=c->>'kind' AND t.key_version=(c->>'key_version')::integer AND t.namespace=c->>'namespace' AND t.claim_digest=c->>'claim_digest');
   IF p_action IN ('erase','correct') THEN
     -- Invalidate every known historical source of the erased group, including
     -- provider agreements: unseen old invoices cannot create a new source path.
     UPDATE private.trial_identity_sources s SET status='erased',excluded_identity_groups='[]'::jsonb,rights_reference=p_reference,updated_at=now()
     WHERE (s.kind=p_source_kind AND s.source_id=p_source_id) OR EXISTS(SELECT 1 FROM private.trial_identity_source_claims t JOIN jsonb_array_elements(selected) c
     ON t.kind=c->>'kind' AND t.key_version=(c->>'key_version')::integer AND t.namespace=c->>'namespace' AND t.claim_digest=c->>'claim_digest' WHERE t.source_kind=s.kind AND t.source_id=s.source_id);
     DELETE FROM private.trial_identity_restrictions t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(selected) c WHERE t.kind=c->>'kind' AND t.key_version=(c->>'key_version')::integer AND t.namespace=c->>'namespace' AND t.claim_digest=c->>'claim_digest');
     DELETE FROM private.trial_identity_source_claims t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(selected) c WHERE t.kind=c->>'kind' AND t.key_version=(c->>'key_version')::integer AND t.namespace=c->>'namespace' AND t.claim_digest=c->>'claim_digest');
   END IF;
 END IF;
 INSERT INTO private.trial_identity_rights_actions(source_kind,source_id,action,kinds,reference) VALUES(p_source_kind,p_source_id,p_action,p_kinds,p_reference);
 n=jsonb_array_length(selected);
 RETURN jsonb_build_object('action',p_action,'affectedClaims',n,'sourceKind',p_source_kind,'sourceId',p_source_id);
END $$;
CREATE FUNCTION public.inspect_trial_identity_rights(p_source_kind text,p_source_id text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('source',to_jsonb(s),'restrictedClaims',(SELECT count(*) FROM private.trial_identity_source_claims c JOIN private.trial_identity_restrictions r ON r.kind=c.kind AND r.key_version=c.key_version AND r.namespace=c.namespace AND r.claim_digest=c.claim_digest WHERE c.source_kind=s.kind AND c.source_id=s.source_id),'claims',
 (SELECT coalesce(jsonb_agg(groups),'[]'::jsonb) FROM (SELECT kind,key_version,count(*) FROM private.trial_identity_source_claims WHERE source_kind=s.kind AND source_id=s.source_id GROUP BY kind,key_version) groups))
 FROM private.trial_identity_sources s WHERE s.kind=p_source_kind AND s.source_id=p_source_id $$;
REVOKE ALL ON FUNCTION private.prepare_trial_identity_source(text,text,jsonb),private.guard_trial_identity_write(),public.configure_trial_identity_key_versions(integer[]),public.record_prior_paid_trial_claims(jsonb,timestamptz,text,text),public.apply_trial_identity_rights(text,text,text,text[],text),public.inspect_trial_identity_rights(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.prepare_trial_identity_source(text,text,jsonb),private.guard_trial_identity_write(),public.configure_trial_identity_key_versions(integer[]),public.record_prior_paid_trial_claims(jsonb,timestamptz,text,text),public.apply_trial_identity_rights(text,text,text,text[],text),public.inspect_trial_identity_rights(text,text) TO service_role;

-- Abandoned reservations are transient, including their private source associations.
CREATE FUNCTION private.release_trial_identity_source_associations() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 IF NEW.admission_status='released' AND NEW.authorization_succeeded_at IS NULL AND NOT NEW.neutralization_required THEN
 DELETE FROM private.trial_identity_sources WHERE status='active' AND
 ((kind='enrollment' AND source_id=NEW.id::text) OR (kind=NEW.provider AND source_id=NEW.provider_agreement_id))
 AND NOT EXISTS(SELECT 1 FROM private.trial_identity_source_claims c JOIN public.trial_identity_claims t
 ON t.kind=c.kind AND t.key_version=c.key_version AND t.namespace=c.namespace AND t.claim_digest=c.claim_digest
 WHERE c.source_kind=trial_identity_sources.kind AND c.source_id=trial_identity_sources.source_id AND t.consumed_at IS NOT NULL);
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.release_trial_identity_source_associations() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.release_trial_identity_source_associations() TO service_role;
CREATE TRIGGER release_trial_identity_source_associations AFTER UPDATE OF admission_status,neutralization_required ON public.trial_enrollments
 FOR EACH ROW WHEN (NEW.admission_status='released') EXECUTE FUNCTION private.release_trial_identity_source_associations();

-- Lock order matches admission before touching the enrollment row.
CREATE OR REPLACE FUNCTION public.release_trial_enrollment(p_enrollment_id uuid, p_neutralization_evidence text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE enrollment public.trial_enrollments%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(74144351);
  IF p_neutralization_evidence IS NULL OR length(btrim(p_neutralization_evidence)) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'Provider reconciliation evidence required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO enrollment FROM public.trial_enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF FOUND AND enrollment.admission_status = 'released' AND NOT enrollment.neutralization_required THEN
    -- A lost expiry/cancellation response replays the same confirmed release;
    -- unrelated evidence cannot reset consumed identity history.
    RETURN enrollment.neutralization_evidence = p_neutralization_evidence;
  END IF;
  IF NOT FOUND OR (enrollment.admission_status NOT IN ('reserved', 'blocked')
    AND NOT (enrollment.admission_status = 'released' AND enrollment.neutralization_required))
  THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.trial_identity_claims WHERE enrollment_id = p_enrollment_id AND consumed_at IS NOT NULL)
  THEN RETURN false; END IF;
  DELETE FROM public.trial_identity_claims WHERE enrollment_id = p_enrollment_id AND consumed_at IS NULL;
  UPDATE public.trial_enrollments SET admission_status = 'released', neutralization_required = false,
    neutralization_evidence = p_neutralization_evidence WHERE id = p_enrollment_id;
  RETURN true;
END;
$$;
