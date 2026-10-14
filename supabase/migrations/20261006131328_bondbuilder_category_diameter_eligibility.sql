-- Nick's 2026-10-06 category rule: all in-scope Bondbuilders are eligible
-- for fine, normal and coarse hair. Original research fit remains unchanged.
-- No row updates, owner-default promotion, protocol waiver or ACL changes.
BEGIN;
DO $category_diameter$
DECLARE
  target regprocedure := 'public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure;
  body text;
  definition text;
  digest text;
  old_fit text := $$ OR jsonb_array_length(profile#>'{holds,fit}')>0$$;
  old_eligibility text := $$ OR cardinality(product.suitable_thicknesses)=0
 OR EXISTS(SELECT 1 FROM unnest(product.suitable_thicknesses) thickness WHERE thickness NOT IN ('fine','normal','coarse') OR profile#>>ARRAY['fit',thickness,'value'] IS DISTINCT FROM 'true')$$;
  new_eligibility text := $$ OR cardinality(product.suitable_thicknesses) IS DISTINCT FROM 3
 OR NOT (product.suitable_thicknesses @> ARRAY['fine','normal','coarse']::text[])$$;
BEGIN
  SELECT prosrc, pg_get_functiondef(oid) INTO body, definition
    FROM pg_proc WHERE oid = target;
  digest := encode(sha256(convert_to(body, 'UTF8')), 'hex');
  IF digest = '16dd604125bfe70bba78cb0d6c956a140d6c14775b8c3e308132ac6e6d39ba24' THEN
    RETURN; -- Exact replay of this policy, not an unknown subsequent revision.
  END IF;
  IF digest IS DISTINCT FROM '3f79b54003fe4026ef458a7c06a5b17a8ac3bf886cce93a3b96ee4728fff7bdd'
     OR (length(body) - length(replace(body, old_fit, ''))) / length(old_fit) <> 1
     OR (length(body) - length(replace(body, old_eligibility, ''))) / length(old_eligibility) <> 1
     OR strpos(definition, body) = 0 THEN
    RAISE EXCEPTION 'Bondbuilder recommendation diameter predicate lineage changed';
  END IF;
  EXECUTE replace(definition, body, replace(replace(body, old_fit, ''), old_eligibility, new_eligibility));
END $category_diameter$;
COMMIT;
