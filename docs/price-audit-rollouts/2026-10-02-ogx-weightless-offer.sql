-- Nick approved the exact Hagel offer: OGX Weightless Reviving Dry Oil,
-- matching EAN 3574661563350, 118 ml, EUR 8.95. The numeric price is unchanged.
-- Operator DML receipt; no schema change, identifier change, or worker change.
DO $ogx_weightless_offer$
DECLARE
  v_id constant uuid := 'aa349c07-1add-44d4-9161-d99190182e5c';
  v_stamp constant timestamptz := '2026-10-02T13:36:01.722Z'::timestamptz;
  v_url constant text := 'https://www.hagel-shop.de/ogx-renewing-argan-oil-of-morocco-oil-weightless-reviving-dry-oil-118-ml.html';
  v_fingerprint constant text := 'd62a0c0be49a1b1a95579baebcfcca8b';
  v_expected_identifiers constant jsonb := '[{"id":"5f8cb22d-e6f1-4af4-b1c8-5ca7d5243177","source":"scanner-catalog-coverage-2026-08-26","created_at":"2026-09-01T06:33:35.923066+00:00","product_id":"aa349c07-1add-44d4-9161-d99190182e5c","updated_at":"2026-09-01T06:33:35.923066+00:00","identifier_type":"ean","canonical_gtin14":"03574661563350","identifier_value":"3574661563350","normalized_identifier_value":"3574661563350"}]'::jsonb;
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_identifiers jsonb;
  v_related_before jsonb;
  v_related_after jsonb;
BEGIN
  SELECT * INTO STRICT v_before FROM public.products WHERE id=v_id FOR UPDATE;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO v_identifiers
    FROM public.product_identifiers i WHERE product_id=v_id;
  IF v_before.name IS DISTINCT FROM 'OGX Argan weightless Öl'
      OR v_before.brand IS DISTINCT FROM 'OGX'
      OR v_before.category_key IS DISTINCT FROM 'oil'
      OR v_before.price_eur IS DISTINCT FROM 8.95
      OR v_before.purchase_link_status::text IS DISTINCT FROM 'available'
      OR v_before.is_active IS DISTINCT FROM true
      OR v_before.is_chaarlie_recommended IS DISTINCT FROM true
      OR md5((to_jsonb(v_before)-ARRAY['affiliate_link','price_checked_at',
          'purchase_link_checked_at','net_content_value','net_content_unit','updated_at'])::text)
         IS DISTINCT FROM v_fingerprint
      OR v_identifiers IS DISTINCT FROM v_expected_identifiers
      OR EXISTS(SELECT 1 FROM public.personal_plan_product_search_dispositions WHERE product_id=v_id) THEN
    RAISE EXCEPTION 'OGX Weightless product or identifier baseline changed';
  END IF;
  IF v_before.affiliate_link=v_url AND v_before.net_content_value=118
      AND v_before.net_content_unit='ml' AND v_before.price_checked_at=v_stamp
      AND v_before.purchase_link_checked_at=v_stamp THEN
    RETURN;
  END IF;
  IF v_before.affiliate_link IS DISTINCT FROM 'https://www.dm.de/ogx-haaroel-moroccan-argan-oil-weightless-dry-out-oil-p22796976208.html'
      OR v_before.net_content_value IS NOT NULL OR v_before.net_content_unit IS NOT NULL
      OR v_before.price_checked_at IS DISTINCT FROM '2026-06-10T00:00:00+00:00'::timestamptz
      OR v_before.purchase_link_checked_at IS DISTINCT FROM '2026-06-10T00:00:00+00:00'::timestamptz THEN
    RAISE EXCEPTION 'OGX Weightless approved offer baseline changed';
  END IF;
  SELECT related_rows INTO v_related_before FROM (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'table',x->'row'::text),'[]'::jsonb) AS related_rows FROM (
 SELECT jsonb_build_object('table','product_oil_specs','row',to_jsonb(s)) x FROM public.product_oil_specs s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_oil_eligibility','row',to_jsonb(s)) FROM public.product_oil_eligibility s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_thickness_eligibility','row',to_jsonb(s)) FROM public.product_thickness_eligibility s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_concern_eligibility','row',to_jsonb(s)) FROM public.product_concern_eligibility s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_application_protocols','row',to_jsonb(s)) FROM public.product_application_protocols s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
) q) related;
  UPDATE public.products
     SET affiliate_link=v_url,net_content_value=118,net_content_unit='ml',
         price_checked_at=v_stamp,purchase_link_checked_at=v_stamp
   WHERE id=v_id RETURNING * INTO STRICT v_after;
  SELECT related_rows INTO v_related_after FROM (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'table',x->'row'::text),'[]'::jsonb) AS related_rows FROM (
 SELECT jsonb_build_object('table','product_oil_specs','row',to_jsonb(s)) x FROM public.product_oil_specs s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_oil_eligibility','row',to_jsonb(s)) FROM public.product_oil_eligibility s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_thickness_eligibility','row',to_jsonb(s)) FROM public.product_thickness_eligibility s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_concern_eligibility','row',to_jsonb(s)) FROM public.product_concern_eligibility s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
 UNION ALL SELECT jsonb_build_object('table','product_application_protocols','row',to_jsonb(s)) FROM public.product_application_protocols s WHERE product_id='aa349c07-1add-44d4-9161-d99190182e5c'
) q) related;
  IF v_after.affiliate_link IS DISTINCT FROM v_url
      OR v_after.net_content_value IS DISTINCT FROM 118
      OR v_after.net_content_unit IS DISTINCT FROM 'ml'
      OR v_after.price_checked_at IS DISTINCT FROM v_stamp
      OR v_after.purchase_link_checked_at IS DISTINCT FROM v_stamp
      OR (to_jsonb(v_before)-ARRAY['affiliate_link','price_checked_at',
          'purchase_link_checked_at','net_content_value','net_content_unit','updated_at'])
         IS DISTINCT FROM
         (to_jsonb(v_after)-ARRAY['affiliate_link','price_checked_at',
          'purchase_link_checked_at','net_content_value','net_content_unit','updated_at'])
      OR (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.product_identifiers i
          WHERE product_id=v_id) IS DISTINCT FROM v_expected_identifiers
      OR v_related_after IS DISTINCT FROM v_related_before THEN
    RAISE EXCEPTION 'OGX Weightless offer or preservation verification failed';
  END IF;
END
$ogx_weightless_offer$;
SELECT id,name,price_eur,net_content_value,net_content_unit,affiliate_link,
       category_key,price_checked_at,purchase_link_checked_at
FROM public.products WHERE id='aa349c07-1add-44d4-9161-d99190182e5c';
