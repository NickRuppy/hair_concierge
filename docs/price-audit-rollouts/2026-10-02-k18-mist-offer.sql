-- Nick approved EUR 62.95 / 150 ml, the Look Beautiful link, another barcode,
-- and pausing automatic recommendations. Bondbuilder reclassification is requested
-- but not performed here: its canonical facts/protocol need a separate safe correction.
DO $k18_mist$
DECLARE
  v_id constant uuid := '8f84eae5-222d-4bbf-9ab0-f30361882a95';
  v_barcode constant text := '858511001142';
  v_canonical constant text := '00858511001142';
  v_link constant text := 'https://www.look-beautiful.de/professional-molecular-repair-hair-mist-sw13531';
  v_stamp constant timestamptz := '2026-10-02T10:02:21.039Z'::timestamptz;
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_old_identifiers jsonb;
  v_gtins text[];
  v_owner uuid;
BEGIN
  IF public.product_identifier_canonical_gtin14('gtin',v_barcode) IS DISTINCT FROM v_canonical THEN
    RAISE EXCEPTION 'K18 mist new barcode is invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('product-identifier:canonical-gtin14:' || v_canonical,0));
  SELECT * INTO STRICT v_before FROM public.products WHERE id=v_id FOR UPDATE;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id),
         array_agg(i.canonical_gtin14 ORDER BY i.canonical_gtin14)
    INTO v_old_identifiers,v_gtins FROM public.product_identifiers i
    WHERE i.product_id=v_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical;
  IF v_before.name IS DISTINCT FROM 'K18 Hair Professional Molecular Repair Hair Mist'
      OR v_before.brand IS DISTINCT FROM 'K18'
      OR v_before.category_key IS DISTINCT FROM 'leave_in'
      OR v_before.category IS DISTINCT FROM 'Leave-in'
      OR v_before.currency IS DISTINCT FROM 'EUR'
      OR v_before.origin IS DISTINCT FROM 'curated'
      OR v_before.is_active IS DISTINCT FROM true
      OR v_before.lifecycle_status IS DISTINCT FROM 'active'
      OR v_before.purchase_link_status::text IS DISTINCT FROM 'available'
      OR v_gtins IS DISTINCT FROM ARRAY['00858511001463']::text[]
      OR EXISTS(SELECT 1 FROM public.personal_plan_product_search_dispositions WHERE product_id=v_id) THEN
    RAISE EXCEPTION 'K18 mist identity or scanner visibility baseline changed';
  END IF;
  IF v_before.price_eur=62.95 AND v_before.affiliate_link=v_link
      AND v_before.net_content_value=150 AND v_before.net_content_unit='ml'
      AND v_before.price_checked_at=v_stamp AND v_before.purchase_link_checked_at=v_stamp
      AND v_before.is_chaarlie_recommended=false
      AND EXISTS(SELECT 1 FROM public.product_identifiers
                 WHERE product_id=v_id AND canonical_gtin14=v_canonical) THEN
    RETURN;
  END IF;
  IF v_before.price_eur IS DISTINCT FROM 33.17
      OR v_before.affiliate_link IS DISTINCT FROM 'https://www.douglas.de/de/p/m001995632'
      OR v_before.net_content_value IS DISTINCT FROM 300
      OR v_before.net_content_unit IS DISTINCT FROM 'ml'
      OR v_before.price_checked_at IS DISTINCT FROM '2026-06-10T00:00:00Z'::timestamptz
      OR v_before.purchase_link_checked_at IS DISTINCT FROM '2026-06-10T00:00:00Z'::timestamptz
      OR v_before.is_chaarlie_recommended IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'K18 mist approved commercial/recommendation baseline changed';
  END IF;
  SELECT i.product_id INTO v_owner FROM public.product_identifiers i
    WHERE i.canonical_gtin14=v_canonical;
  IF FOUND AND v_owner IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'K18 mist barcode is owned by another product';
  ELSIF NOT FOUND THEN
    INSERT INTO public.product_identifiers(product_id,identifier_type,identifier_value,source)
      VALUES(v_id,'gtin',v_barcode,
        'https://beautyhair24shop.de/K18-Professional-Molecular-Repair-Hair-Mist-150-ml');
  END IF;
  UPDATE public.products
    SET price_eur=62.95,affiliate_link=v_link,net_content_value=150,net_content_unit='ml',
        price_checked_at=v_stamp,purchase_link_checked_at=v_stamp,is_chaarlie_recommended=false
    WHERE id=v_id RETURNING * INTO STRICT v_after;
  IF v_after.price_eur IS DISTINCT FROM 62.95 OR v_after.affiliate_link IS DISTINCT FROM v_link
      OR v_after.net_content_value IS DISTINCT FROM 150 OR v_after.net_content_unit IS DISTINCT FROM 'ml'
      OR v_after.price_checked_at IS DISTINCT FROM v_stamp
      OR v_after.purchase_link_checked_at IS DISTINCT FROM v_stamp
      OR v_after.is_chaarlie_recommended IS DISTINCT FROM false
      OR (to_jsonb(v_before)-ARRAY['price_eur','affiliate_link','net_content_value','net_content_unit',
          'price_checked_at','purchase_link_checked_at','is_chaarlie_recommended','updated_at'])
        IS DISTINCT FROM
         (to_jsonb(v_after)-ARRAY['price_eur','affiliate_link','net_content_value','net_content_unit',
          'price_checked_at','purchase_link_checked_at','is_chaarlie_recommended','updated_at'])
      OR (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.product_identifiers i
          WHERE i.product_id=v_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical)
        IS DISTINCT FROM v_old_identifiers
      OR (SELECT count(*) FROM public.product_identifiers
          WHERE product_id=v_id AND canonical_gtin14=v_canonical) <> 1 THEN
    RAISE EXCEPTION 'K18 mist offer, barcode or preservation verification failed';
  END IF;
END
$k18_mist$;
SELECT p.id,p.name,p.price_eur,p.affiliate_link,p.net_content_value,p.net_content_unit,
       p.category_key,p.is_active,p.is_chaarlie_recommended,
       (SELECT array_agg(i.identifier_value ORDER BY i.canonical_gtin14)
        FROM public.product_identifiers i WHERE i.product_id=p.id) AS barcodes
FROM public.products p WHERE p.id='8f84eae5-222d-4bbf-9ab0-f30361882a95';
