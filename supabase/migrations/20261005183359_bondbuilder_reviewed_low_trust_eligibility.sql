-- Owner-approved low-trust treatments may be recommendation candidates.
-- Trust is not efficacy, suitability, protocol readiness or promotion authority.
-- No product rows, method pins, default submission policy or permissions change.
BEGIN;
DO $reviewed_trust$
DECLARE
  target regprocedure := 'public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure;
  body text;
  definition text;
  digest text;
  old_clause text := $$NOT IN ('medium','high')$$;
  new_clause text := $$NOT IN ('low','medium','high')$$;
BEGIN
  SELECT prosrc, pg_get_functiondef(oid) INTO body, definition
    FROM pg_proc WHERE oid = target;
  digest := encode(sha256(convert_to(body, 'UTF8')), 'hex');
  -- Both hashes bind the deployed prosrc, not a migration-file digest.
  IF digest = '3f79b54003fe4026ef458a7c06a5b17a8ac3bf886cce93a3b96ee4728fff7bdd' THEN
    RETURN; -- Exact replay only; a merely similar later function must refuse.
  END IF;
  IF digest IS DISTINCT FROM 'c651d2c5f94374b303d6650725d2f871277f1072d1fa95d75e5a92ef0ad04f1f'
     OR (length(body) - length(replace(body, old_clause, ''))) / length(old_clause) <> 1
     OR strpos(definition, body) = 0 THEN
    RAISE EXCEPTION 'Bondbuilder recommendation trust predicate lineage changed';
  END IF;
  -- pg_get_functiondef preserves STABLE, empty search_path, invoker semantics
  -- and the rest of the function body. CREATE OR REPLACE retains its ACL/owner.
  EXECUTE replace(definition, body, replace(body, old_clause, new_clause));
END $reviewed_trust$;
COMMIT;
