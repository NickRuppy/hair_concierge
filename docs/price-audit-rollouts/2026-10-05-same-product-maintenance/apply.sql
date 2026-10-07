-- 2026-10-05 same-product maintenance (Nick ruling 2026-10-05: same dm article = same product;
-- update link/size, add current barcode, keep properties + recommendation flags).
-- Dry run: set v_dry := true (raises DRY_RUN_OK -> full rollback).
DO $$
DECLARE
 v_dry boolean := :DRY;
 r record; v_n int;
BEGIN
 -- commerce: id, expected old link, expected price, new link, size
 FOR r IN SELECT * FROM (VALUES
  ('e7cde77e-e9d5-4976-a8ed-830c8a30c62a'::uuid,'https://www.dm.de/balea-professional-spuelung-oil-repair-intensiv-p4066447365443.html',1.25::numeric,'https://www.dm.de/p/d/1703916/balea-professional-conditioner-oil-repair-intensiv',200::numeric),
  ('1623a993-3ff4-43be-82c1-95a1ee57ec52','https://www.dm.de/langhaarmaedchen-shampoo-beautiful-curls-p4067796150735.html',4.95,'https://www.dm.de/p/d/1678985/langhaarmaedchen-shampoo-beautiful-curls',300),
  ('e76e0ed4-bd20-40cd-84ae-e93030610d40','https://www.dm.de/langhaarmaedchen-shampoo-lovely-long-p4067796002621.html',4.95,'https://www.dm.de/p/d/1559584/langhaarmaedchen-shampoo-lovely-long',300)
 ) t(id,old_link,price,new_link,size) LOOP
  UPDATE public.products SET affiliate_link=r.new_link, net_content_value=r.size, net_content_unit='ml',
    purchase_link_status='available', price_checked_at=now(), purchase_link_checked_at=now()
   WHERE id=r.id AND affiliate_link=r.old_link AND price_eur=r.price AND net_content_value IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n<>1 THEN RAISE EXCEPTION 'commerce expected-before mismatch for %', r.id; END IF;
 END LOOP;
 -- barcodes: id, gtin, source PDP
 FOR r IN SELECT * FROM (VALUES
  ('4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6'::uuid,'8700216210546','https://www.dm.de/p/d/1409620/herbal-essences-conditioner-feuchtigkeit-aloe-vera'),
  ('efaff579-e411-41eb-972a-2734a8517356','4015100894141','https://www.dm.de/p/d/1267310/got2b-hitzeschutzspray-schutzengel'),
  ('e7cde77e-e9d5-4976-a8ed-830c8a30c62a','4070765001402','https://www.dm.de/p/d/1703916/balea-professional-conditioner-oil-repair-intensiv'),
  ('1623a993-3ff4-43be-82c1-95a1ee57ec52','4070765004649','https://www.dm.de/p/d/1678985/langhaarmaedchen-shampoo-beautiful-curls'),
  ('e76e0ed4-bd20-40cd-84ae-e93030610d40','4066447864694','https://www.dm.de/p/d/1559584/langhaarmaedchen-shampoo-lovely-long')
 ) t(id,gtin,src) LOOP
  PERFORM public.product_identifier_assert_canonical_owner_available('gtin',r.gtin,r.id);
  IF EXISTS(SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14=public.product_identifier_canonical_gtin14('gtin',r.gtin)) THEN
   RAISE EXCEPTION 'barcode already owned: %', r.gtin; END IF;
  INSERT INTO public.product_identifiers(product_id,identifier_type,identifier_value,source) VALUES(r.id,'gtin',r.gtin,r.src);
 END LOOP;
 SET CONSTRAINTS ALL IMMEDIATE;
 IF v_dry THEN RAISE EXCEPTION 'DRY_RUN_OK'; END IF;
END $$;
