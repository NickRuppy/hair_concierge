-- Nick approved Rossmann EUR 2.49 / 200 ml, an additional 200 ml barcode,
-- preservation of the 250 ml barcode, and correction of the stale Hair Food description.
DO $garnier_kokos$
DECLARE
  v_id constant uuid := '8c3eda97-5009-40bb-959b-1a7d90f48b09';
  v_barcode constant text := '3600542462327';
  v_canonical constant text := '03600542462327';
  v_stamp constant timestamptz := '2026-10-02T12:19:27.673Z'::timestamptz;
  v_description constant text := 'Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung ist eine ausspülbare Pflegespülung für normales bis trockenes Haar.';
  v_fingerprint constant text := '21a8822e3968f2db34373eedafabcc00';
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_old_identifiers jsonb;
  v_gtins text[];
  v_owner uuid;
BEGIN
  IF public.product_identifier_canonical_gtin14('ean',v_barcode) IS DISTINCT FROM v_canonical THEN
    RAISE EXCEPTION 'Garnier Kokos additional barcode is invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('product-identifier:canonical-gtin14:' || v_canonical,0));
  SELECT * INTO STRICT v_before FROM public.products WHERE id=v_id FOR UPDATE;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id),
         array_agg(i.canonical_gtin14 ORDER BY i.canonical_gtin14)
    INTO v_old_identifiers,v_gtins FROM public.product_identifiers i
    WHERE i.product_id=v_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical;
  IF v_before.name IS DISTINCT FROM 'Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung'
      OR v_before.category_key IS DISTINCT FROM 'conditioner'
      OR v_before.price_eur IS DISTINCT FROM 2.49
      OR v_before.affiliate_link IS DISTINCT FROM 'https://www.rossmann.de/de/pflege-und-duft-garnier-wahre-schaetze-spuelung-kokosmilch-und-macadamia-normales-und-trockenes-haar/p/3600542462327'
      OR v_before.purchase_link_status::text IS DISTINCT FROM 'available'
      OR v_before.is_active IS DISTINCT FROM true
      OR v_before.is_chaarlie_recommended IS DISTINCT FROM true
      OR md5((to_jsonb(v_before)-ARRAY['description','price_checked_at',
          'purchase_link_checked_at','net_content_value','net_content_unit','updated_at'])::text)
         IS DISTINCT FROM v_fingerprint
      OR v_gtins IS DISTINCT FROM ARRAY['03600542462839']::text[]
      OR EXISTS(SELECT 1 FROM public.personal_plan_product_search_dispositions WHERE product_id=v_id) THEN
    RAISE EXCEPTION 'Garnier Kokos identity, offer or scanner baseline changed';
  END IF;
  IF v_before.description=v_description AND v_before.net_content_value=200
      AND v_before.net_content_unit='ml' AND v_before.price_checked_at=v_stamp
      AND v_before.purchase_link_checked_at=v_stamp
      AND EXISTS(SELECT 1 FROM public.product_identifiers
                 WHERE product_id=v_id AND canonical_gtin14=v_canonical) THEN
    RETURN;
  END IF;
  IF v_before.description IS DISTINCT FROM 'Garnier Hair Food Macadamia (Kokos) ist ein Conditioner (Drogerie) von Garnier, empfohlen für dickes Haar bei Feuchtigkeitsbedarf.'
      OR v_before.net_content_value IS NOT NULL OR v_before.net_content_unit IS NOT NULL
      OR v_before.price_checked_at IS DISTINCT FROM '2026-06-11T00:00:00+00:00'::timestamptz
      OR v_before.purchase_link_checked_at IS DISTINCT FROM '2026-06-11T00:00:00+00:00'::timestamptz THEN
    RAISE EXCEPTION 'Garnier Kokos approved metadata baseline changed';
  END IF;
  SELECT i.product_id INTO v_owner FROM public.product_identifiers i WHERE i.canonical_gtin14=v_canonical;
  IF FOUND AND v_owner IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'Garnier Kokos barcode is owned by another product';
  ELSIF NOT FOUND THEN
    INSERT INTO public.product_identifiers(product_id,identifier_type,identifier_value,source)
      VALUES(v_id,'ean',v_barcode,'https://www.budni.de/sortiment/produkte/5399307000');
  END IF;
  UPDATE public.products
    SET description=v_description,net_content_value=200,net_content_unit='ml',
        price_checked_at=v_stamp,purchase_link_checked_at=v_stamp
    WHERE id=v_id RETURNING * INTO STRICT v_after;
  IF v_after.description IS DISTINCT FROM v_description
      OR v_after.net_content_value IS DISTINCT FROM 200 OR v_after.net_content_unit IS DISTINCT FROM 'ml'
      OR v_after.price_checked_at IS DISTINCT FROM v_stamp
      OR v_after.purchase_link_checked_at IS DISTINCT FROM v_stamp
      OR (to_jsonb(v_before)-ARRAY['description','price_checked_at','purchase_link_checked_at',
          'net_content_value','net_content_unit','updated_at'])
        IS DISTINCT FROM
         (to_jsonb(v_after)-ARRAY['description','price_checked_at','purchase_link_checked_at',
          'net_content_value','net_content_unit','updated_at'])
      OR (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.product_identifiers i
          WHERE i.product_id=v_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical)
        IS DISTINCT FROM v_old_identifiers
      OR (SELECT count(*) FROM public.product_identifiers
          WHERE product_id=v_id AND canonical_gtin14=v_canonical) <> 1 THEN
    RAISE EXCEPTION 'Garnier Kokos offer, barcode or preservation verification failed';
  END IF;
END
$garnier_kokos$;
SELECT id,name,price_eur,net_content_value,net_content_unit,affiliate_link,
       category,category_key,description,price_checked_at,purchase_link_checked_at
FROM public.products WHERE id='8c3eda97-5009-40bb-959b-1a7d90f48b09';
