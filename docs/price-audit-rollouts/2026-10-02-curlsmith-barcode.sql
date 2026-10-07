-- Authorized: add the verified 237 ml barcode to the existing Curlsmith product.
-- Evidence: https://www.hagel-shop.de/curlsmith-multi-tasking-conditioner-237ml-12128539.html
-- Commercial offer fields are a proposal only and are not written by this receipt.
DO $curlsmith$
DECLARE
  v_product_id constant uuid := '2bafeb7e-6610-4efc-a8e8-a402071b2ed9';
  v_barcode constant text := '850005417637';
  v_canonical constant text := '00850005417637';
  v_before jsonb;
  v_existing_identifiers jsonb;
  v_owner uuid;
BEGIN
  IF public.product_identifier_canonical_gtin14('gtin', v_barcode)
      IS DISTINCT FROM v_canonical THEN
    RAISE EXCEPTION 'Curlsmith barcode failed canonical/check-digit validation';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('product-identifier:canonical-gtin14:' || v_canonical, 0)
  );
  SELECT to_jsonb(p) INTO v_before
  FROM public.products p WHERE p.id = v_product_id FOR UPDATE;
  IF v_before IS NULL
      OR v_before->>'name' IS DISTINCT FROM 'Curlsmith Multitasking Conditioner 3 in 1'
      OR v_before->>'brand' IS DISTINCT FROM 'Curlsmith'
      OR v_before->>'category_key' IS DISTINCT FROM 'leave_in' THEN
    RAISE EXCEPTION 'Curlsmith product identity changed';
  END IF;
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO v_existing_identifiers
  FROM public.product_identifiers i
  WHERE i.product_id = v_product_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical;
  IF (SELECT array_agg(i.canonical_gtin14 ORDER BY i.canonical_gtin14)
      FROM public.product_identifiers i
      WHERE i.product_id = v_product_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical)
      IS DISTINCT FROM ARRAY['00850005417781','00850005417804']::text[] THEN
    RAISE EXCEPTION 'Curlsmith existing barcode set changed';
  END IF;
  SELECT i.product_id INTO v_owner FROM public.product_identifiers i
  WHERE i.canonical_gtin14 = v_canonical;
  IF FOUND AND v_owner IS DISTINCT FROM v_product_id THEN
    RAISE EXCEPTION 'Curlsmith barcode is already owned by another product';
  ELSIF NOT FOUND THEN
    INSERT INTO public.product_identifiers
      (product_id, identifier_type, identifier_value, source)
    VALUES
      (v_product_id, 'gtin', v_barcode,
       'https://www.hagel-shop.de/curlsmith-multi-tasking-conditioner-237ml-12128539.html');
  END IF;
  IF (SELECT to_jsonb(p) FROM public.products p WHERE p.id = v_product_id)
      IS DISTINCT FROM v_before
      OR (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)
          FROM public.product_identifiers i
          WHERE i.product_id = v_product_id AND i.canonical_gtin14 IS DISTINCT FROM v_canonical)
        IS DISTINCT FROM v_existing_identifiers
      OR (SELECT count(*) FROM public.product_identifiers i
          WHERE i.product_id = v_product_id AND i.canonical_gtin14 = v_canonical) <> 1 THEN
    RAISE EXCEPTION 'Curlsmith barcode preservation verification failed';
  END IF;
END
$curlsmith$;
SELECT identifier_type, identifier_value, canonical_gtin14, source
FROM public.product_identifiers
WHERE product_id = '2bafeb7e-6610-4efc-a8e8-a402071b2ed9'
ORDER BY canonical_gtin14;
