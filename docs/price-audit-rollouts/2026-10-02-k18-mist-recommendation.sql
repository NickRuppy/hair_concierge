-- Nick clarified: signature mask = Bondbuilder; mist = regular Leave-in.
-- Restore the mist's previous recommendation eligibility after its temporary pause.
-- Commercial offer, identifiers, category and exact Leave-in protocols stay intact.
DO $k18_mist_restore$
DECLARE
  v_id constant uuid := '8f84eae5-222d-4bbf-9ab0-f30361882a95';
  v_fingerprint constant text := '3eb5f0502730f74cad96799cad8dace4';
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_identifiers jsonb;
  v_gtins text[];
BEGIN
  SELECT * INTO STRICT v_before FROM public.products WHERE id=v_id FOR UPDATE;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id),
         array_agg(i.canonical_gtin14 ORDER BY i.canonical_gtin14)
    INTO v_identifiers,v_gtins FROM public.product_identifiers i WHERE i.product_id=v_id;
  IF v_before.name IS DISTINCT FROM 'K18 Hair Professional Molecular Repair Hair Mist'
      OR v_before.category IS DISTINCT FROM 'Leave-in'
      OR v_before.category_key IS DISTINCT FROM 'leave_in'
      OR v_before.is_active IS DISTINCT FROM true
      OR v_before.lifecycle_status IS DISTINCT FROM 'active'
      OR v_before.is_chaarlie_recommended IS NULL
      OR md5((to_jsonb(v_before)-ARRAY['is_chaarlie_recommended','updated_at'])::text)
         IS DISTINCT FROM v_fingerprint
      OR v_gtins IS DISTINCT FROM ARRAY['00858511001142','00858511001463']::text[]
      OR EXISTS(SELECT 1 FROM public.personal_plan_product_search_dispositions WHERE product_id=v_id) THEN
    RAISE EXCEPTION 'K18 mist reinstatement baseline changed';
  END IF;
  PERFORM public.assert_personal_plan_curated_publication(v_id);
  IF v_before.is_chaarlie_recommended THEN
    RETURN;
  END IF;
  UPDATE public.products SET is_chaarlie_recommended=true
    WHERE id=v_id AND is_chaarlie_recommended=false
    RETURNING * INTO STRICT v_after;
  PERFORM public.assert_personal_plan_curated_publication(v_id);
  IF v_after.is_chaarlie_recommended IS DISTINCT FROM true
      OR (to_jsonb(v_before)-ARRAY['is_chaarlie_recommended','updated_at'])
        IS DISTINCT FROM (to_jsonb(v_after)-ARRAY['is_chaarlie_recommended','updated_at'])
      OR (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)
          FROM public.product_identifiers i WHERE i.product_id=v_id)
        IS DISTINCT FROM v_identifiers THEN
    RAISE EXCEPTION 'K18 mist reinstatement or preservation verification failed';
  END IF;
END
$k18_mist_restore$;
SELECT p.id,p.name,p.category,p.category_key,p.is_chaarlie_recommended,
       p.price_eur,p.net_content_value,p.net_content_unit,p.affiliate_link,p.updated_at
FROM public.products p WHERE p.id='8f84eae5-222d-4bbf-9ab0-f30361882a95';
