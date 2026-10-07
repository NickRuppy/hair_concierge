-- Preserve registered keys in place; production safe-update enforcement rejects
-- unqualified DELETE even in service-only functions. Retention guards are unchanged.
CREATE OR REPLACE FUNCTION public.configure_trial_identity_key_versions(p_versions integer[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 IF p_versions IS NULL OR cardinality(p_versions) NOT BETWEEN 1 AND 8 OR EXISTS(SELECT 1 FROM unnest(p_versions) v WHERE v IS NULL OR v NOT BETWEEN 1 AND 999999999)
 OR cardinality(p_versions)<>(SELECT count(DISTINCT v) FROM unnest(p_versions) v) THEN RAISE EXCEPTION 'Invalid identity key registry'; END IF;
 IF EXISTS(SELECT 1 FROM private.trial_identity_restrictions WHERE NOT(key_version=ANY(p_versions)))
 OR EXISTS(SELECT 1 FROM public.trial_identity_claims WHERE NOT(key_version=ANY(p_versions))) THEN RAISE EXCEPTION 'Retained claims require key overlap'; END IF;
 DELETE FROM private.trial_identity_key_versions WHERE NOT(version=ANY(p_versions));
 INSERT INTO private.trial_identity_key_versions SELECT unnest(p_versions) ON CONFLICT(version) DO NOTHING;
END $$;
