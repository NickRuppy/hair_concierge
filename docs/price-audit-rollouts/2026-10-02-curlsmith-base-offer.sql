-- Nick approved the presented Hagel 237 ml / EUR 17.85 base offer on 2026-10-02.
-- Fixed operator DML; commercial offer and confirmation dates only.
-- Preserves category, recommendation state, specifications and every barcode.
DO $curlsmith_offer$
DECLARE
  v_id constant uuid := '2bafeb7e-6610-4efc-a8e8-a402071b2ed9';
  v_link constant text := 'https://www.hagel-shop.de/curlsmith-multi-tasking-conditioner-237ml-12128539.html';
  v_stamp constant timestamptz := '2026-10-02T09:01:08.256Z'::timestamptz;
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_identifiers jsonb;
  v_gtins text[];
BEGIN
  SELECT * INTO STRICT v_before FROM public.products WHERE id = v_id FOR UPDATE;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id),
         array_agg(i.canonical_gtin14 ORDER BY i.canonical_gtin14)
    INTO v_identifiers, v_gtins
    FROM public.product_identifiers i WHERE i.product_id = v_id;
  IF v_before.name IS DISTINCT FROM 'Curlsmith Multitasking Conditioner 3 in 1'
      OR v_before.brand IS DISTINCT FROM 'Curlsmith'
      OR v_before.category_key IS DISTINCT FROM 'leave_in'
      OR v_before.currency IS DISTINCT FROM 'EUR'
      OR v_before.is_active IS DISTINCT FROM true
      OR v_before.lifecycle_status IS DISTINCT FROM 'active'
      OR v_before.is_chaarlie_recommended IS DISTINCT FROM true
      OR v_before.purchase_link_status::text IS DISTINCT FROM 'available'
      OR v_gtins IS DISTINCT FROM
         ARRAY['00850005417637','00850005417781','00850005417804']::text[] THEN
    RAISE EXCEPTION 'Curlsmith approved product identity changed';
  END IF;
  IF v_before.price_eur = 17.85 AND v_before.affiliate_link = v_link
      AND v_before.net_content_value = 237 AND v_before.net_content_unit = 'ml'
      AND v_before.price_checked_at = v_stamp
      AND v_before.purchase_link_checked_at = v_stamp THEN
    RETURN;
  END IF;
  IF v_before.price_eur IS DISTINCT FROM 20.95
      OR v_before.affiliate_link IS DISTINCT FROM 'https://www.douglas.de/de/p/5011693052'
      OR v_before.net_content_value IS NOT NULL
      OR v_before.net_content_unit IS NOT NULL
      OR v_before.price_checked_at IS DISTINCT FROM '2026-06-10T00:00:00Z'::timestamptz
      OR v_before.purchase_link_checked_at IS DISTINCT FROM '2026-06-10T00:00:00Z'::timestamptz THEN
    RAISE EXCEPTION 'Curlsmith commercial baseline changed';
  END IF;
  UPDATE public.products
    SET price_eur = 17.85, price_checked_at = v_stamp, affiliate_link = v_link,
        net_content_value = 237, net_content_unit = 'ml', purchase_link_checked_at = v_stamp
    WHERE id = v_id RETURNING * INTO STRICT v_after;
  IF v_after.price_eur IS DISTINCT FROM 17.85
      OR v_after.affiliate_link IS DISTINCT FROM v_link
      OR v_after.net_content_value IS DISTINCT FROM 237
      OR v_after.net_content_unit IS DISTINCT FROM 'ml'
      OR v_after.price_checked_at IS DISTINCT FROM v_stamp
      OR v_after.purchase_link_checked_at IS DISTINCT FROM v_stamp
      OR (to_jsonb(v_before) - ARRAY['price_eur','price_checked_at','affiliate_link',
           'net_content_value','net_content_unit','purchase_link_checked_at','updated_at'])
        IS DISTINCT FROM
         (to_jsonb(v_after) - ARRAY['price_eur','price_checked_at','affiliate_link',
           'net_content_value','net_content_unit','purchase_link_checked_at','updated_at'])
      OR (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)
          FROM public.product_identifiers i WHERE i.product_id = v_id)
        IS DISTINCT FROM v_identifiers THEN
    RAISE EXCEPTION 'Curlsmith approved offer or preservation verification failed';
  END IF;
END
$curlsmith_offer$;
SELECT id, name, price_eur, currency, affiliate_link, net_content_value,
       net_content_unit, price_checked_at, purchase_link_status, purchase_link_checked_at
FROM public.products WHERE id = '2bafeb7e-6610-4efc-a8e8-a402071b2ed9';
