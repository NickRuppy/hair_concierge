-- Nick approved individually reviewed >30% price corrections on 2026-09-30.
-- Direct dm PDP checks: nedura 500 ml, GTIN 4262490410776, EUR 17.95;
-- Pantene Hydra Glow mask 300 ml, GTIN 8700216173261, EUR 6.45.
-- K18 and olive oil are excluded: no current purchasable PDP / GTIN mismatch.
-- Source: docs/price-audit-rollouts/2026-09-30-first-apply/rollout-receipt.md.
-- Price + evidence stamp only; preserve links, status, identity and recommendation.
DO $reviewed_prices$
DECLARE
  target record;
  updated_count integer;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('2ffeae68-c625-4df5-be02-0c1b620aa0fc'::uuid,
     'nedura Schwarzkümmelöl ungefiltert', 'nedura',
     'https://www.dm.de/nedura-schwarzkuemmeloel-ungefiltert-p4262490410776.html',
     12.49::numeric, 17.95::numeric),
    ('a17d3783-2854-4911-bbfa-b2f3ef7f95a8'::uuid,
     'Pantene Hydra Glow', 'Pantene',
     'https://www.dm.de/pantene-pro-v-haarmaske-miracles-hydra-glow-deep-hydration-p8700216173261.html',
     3.99::numeric, 6.45::numeric)
  ) AS reviewed(id, name, brand, link, old_price, new_price)
  LOOP
    -- Replay on a database without these catalog rows (fresh/preview branch): nothing to correct.
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = target.id);
    UPDATE public.products p
    SET price_eur = target.new_price,
        price_checked_at = '2026-09-30T19:40:00Z'::timestamptz
    WHERE p.id = target.id
      AND p.name = target.name AND p.brand = target.brand
      AND p.affiliate_link = target.link
      AND p.is_active = true AND p.lifecycle_status = 'active'
      AND p.price_eur = target.old_price
      AND p.price_checked_at = '2026-06-10T00:00:00Z'::timestamptz;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 AND NOT EXISTS (
      SELECT 1 FROM public.products p WHERE p.id = target.id
        AND p.name = target.name AND p.brand = target.brand
        AND p.affiliate_link = target.link
        AND p.is_active = true AND p.lifecycle_status = 'active'
        AND p.price_eur = target.new_price
        AND p.price_checked_at >= '2026-09-30T19:40:00Z'::timestamptz
    ) THEN
      RAISE EXCEPTION 'Reviewed price correction guard mismatch: %', target.id;
    END IF;
  END LOOP;
END
$reviewed_prices$;
