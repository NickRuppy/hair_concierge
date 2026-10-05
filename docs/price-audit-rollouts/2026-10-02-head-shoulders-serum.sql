-- Nick approved dm EUR 5.95 / 145 ml, the current barcode, retention of the
-- existing barcode, and fresh price/link verification. Scalp-care facts stay intact.
DO $head_shoulders_serum$
DECLARE
  v_id constant uuid := 'c9b231ee-77b5-45b7-8127-7a85d3ae7dd0';
  v_barcode constant text := '8006530455787';
  v_canonical constant text := '08006530455787';
  v_stamp constant timestamptz := '2026-10-02T13:22:47.792Z'::timestamptz;
  v_fingerprint constant text := 'cc1a231d2eac1b3dbbd529347ab8e4ad';
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_old_identifiers jsonb;
  v_gtins text[];
  v_owner uuid;
BEGIN
  IF public.product_identifier_canonical_gtin14('gtin',v_barcode) IS DISTINCT FROM v_canonical THEN
    RAISE EXCEPTION 'Head and Shoulders serum current barcode is invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('product-identifier:canonical-gtin14:' || v_canonical,0));
  SELECT * INTO STRICT v_before FROM public.products WHERE id=v_id FOR UPDATE;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id),
         array_agg(i.canonical_gtin14 ORDER BY i.canonical_gtin14)
           FILTER (WHERE i.canonical_gtin14 IS NOT NULL)
    INTO v_old_identifiers,v_gtins FROM public.product_identifiers i
    WHERE i.product_id=v_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical;
  IF v_before.name IS DISTINCT FROM 'Kopfhaut-Feuchtigkeitspflege Leave-In Serum'
      OR v_before.brand IS DISTINCT FROM 'Head & Shoulders'
      OR v_before.category_key IS DISTINCT FROM 'scalp_care'
      OR v_before.price_eur IS DISTINCT FROM 5.95
      OR v_before.affiliate_link IS DISTINCT FROM 'https://www.dm.de/p/d/2482723/head-und-shoulders-leave-in-serum-derma-x-pro-kopfhaut-feuchtigkeitspflege'
      OR v_before.purchase_link_status::text IS DISTINCT FROM 'available'
      OR v_before.is_active IS DISTINCT FROM true
      OR v_before.is_chaarlie_recommended IS DISTINCT FROM true
      OR md5((to_jsonb(v_before)-ARRAY['price_checked_at','purchase_link_checked_at',
          'net_content_value','net_content_unit','updated_at'])::text)
         IS DISTINCT FROM v_fingerprint
      OR v_gtins IS DISTINCT FROM ARRAY['08700216495981']::text[]
      OR NOT EXISTS(SELECT 1 FROM public.product_identifiers WHERE product_id=v_id
          AND identifier_type='retailer_sku' AND identifier_value='dm:2482723')
      OR EXISTS(SELECT 1 FROM public.personal_plan_product_search_dispositions WHERE product_id=v_id) THEN
    RAISE EXCEPTION 'Head and Shoulders serum identity or offer baseline changed';
  END IF;
  IF v_before.net_content_value=145 AND v_before.net_content_unit='ml'
      AND v_before.price_checked_at=v_stamp AND v_before.purchase_link_checked_at=v_stamp
      AND EXISTS(SELECT 1 FROM public.product_identifiers
                 WHERE product_id=v_id AND canonical_gtin14=v_canonical) THEN
    RETURN;
  END IF;
  IF v_before.net_content_value IS NOT NULL OR v_before.net_content_unit IS NOT NULL
      OR v_before.price_checked_at IS DISTINCT FROM '2026-08-09T09:19:32+00:00'::timestamptz
      OR v_before.purchase_link_checked_at IS DISTINCT FROM '2026-08-09T09:19:32+00:00'::timestamptz THEN
    RAISE EXCEPTION 'Head and Shoulders serum approved metadata baseline changed';
  END IF;
  SELECT i.product_id INTO v_owner FROM public.product_identifiers i WHERE i.canonical_gtin14=v_canonical;
  IF FOUND AND v_owner IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'Head and Shoulders serum barcode is owned by another product';
  ELSIF NOT FOUND THEN
    INSERT INTO public.product_identifiers(product_id,identifier_type,identifier_value,source)
      VALUES(v_id,'gtin',v_barcode,'https://www.dm.de/p/d/2482723/head-und-shoulders-leave-in-serum-derma-x-pro-kopfhaut-feuchtigkeitspflege');
  END IF;
  UPDATE public.products SET net_content_value=145,net_content_unit='ml',
      price_checked_at=v_stamp,purchase_link_checked_at=v_stamp
    WHERE id=v_id RETURNING * INTO STRICT v_after;
  IF v_after.net_content_value IS DISTINCT FROM 145 OR v_after.net_content_unit IS DISTINCT FROM 'ml'
      OR v_after.price_checked_at IS DISTINCT FROM v_stamp
      OR v_after.purchase_link_checked_at IS DISTINCT FROM v_stamp
      OR (to_jsonb(v_before)-ARRAY['price_checked_at','purchase_link_checked_at',
          'net_content_value','net_content_unit','updated_at'])
        IS DISTINCT FROM
         (to_jsonb(v_after)-ARRAY['price_checked_at','purchase_link_checked_at',
          'net_content_value','net_content_unit','updated_at'])
      OR (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.product_identifiers i
          WHERE i.product_id=v_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical)
        IS DISTINCT FROM v_old_identifiers
      OR (SELECT count(*) FROM public.product_identifiers
          WHERE product_id=v_id AND canonical_gtin14=v_canonical) <> 1 THEN
    RAISE EXCEPTION 'Head and Shoulders serum metadata, barcode or preservation verification failed';
  END IF;
END
$head_shoulders_serum$;
SELECT id,name,price_eur,net_content_value,net_content_unit,affiliate_link,
       category_key,price_checked_at,purchase_link_checked_at
FROM public.products WHERE id='c9b231ee-77b5-45b7-8127-7a85d3ae7dd0';
