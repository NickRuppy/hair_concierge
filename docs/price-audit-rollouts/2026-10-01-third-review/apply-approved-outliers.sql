-- Nick explicitly approved these two above-30-percent corrections on 2026-10-01.
-- Nivea EUR 3.95 / 400 ml, Monday Volume EUR 5.40 / 350 ml; exact GTINs verified live.
-- This fixed two-row operator DML does not alter the automatic 30-percent guard.
-- Price and its confirmation stamp only. No links, sizes, formulas, identifiers or statuses.
-- All rows apply atomically; abort on identity/baseline drift. Idempotent at this exact receipt stamp.
do $reviewed_prices$
declare
  target record;
  before_row public.products%rowtype;
  after_row public.products%rowtype;
  observed_gtins jsonb;
  receipt_stamp constant timestamptz := '2026-10-01T09:36:33.748Z'::timestamptz;
begin
  for target in
    select * from jsonb_to_recordset($batch$[{"id":"6dc65df2-2466-43e4-bdc2-3a05803f305c","name":"Monday Haircare Volume Kraft & Fülle Shampoo","brand":"Monday Haircare","old_price":8.95,"new_price":5.4,"old_stamp":"2026-06-11T00:00:00+00:00","affiliate_link":"https://www.flaconi.de/haare/monday-haircare/volume/monday-haircare-volume-kraft-and-fuelle-haarshampoo.html","net_content_value":null,"net_content_unit":null,"purchase_link_status":"available","purchase_link_checked_at":"2026-06-11T00:00:00+00:00","is_chaarlie_recommended":true,"gtins":["04897097266343"]},{"id":"f033afbe-281a-419e-a245-3ad83d721bd0","name":"Nivea Shampoo&Conditioner 2in1","brand":"Nivea","old_price":2.99,"new_price":3.95,"old_stamp":"2026-06-11T00:00:00+00:00","affiliate_link":"https://www.dm.de/nivea-shampoo-und-conditioner-express-2in1-p4006000193991.html","net_content_value":null,"net_content_unit":null,"purchase_link_status":"available","purchase_link_checked_at":"2026-06-11T00:00:00+00:00","is_chaarlie_recommended":true,"gtins":["04006000193991"]}]$batch$::jsonb)
      as proposal(id uuid,name text,brand text,old_price numeric,new_price numeric,
                  old_stamp timestamptz,affiliate_link text,net_content_value numeric,
                  net_content_unit text,purchase_link_status text,purchase_link_checked_at timestamptz,
                  is_chaarlie_recommended boolean,gtins jsonb)
    order by id
  loop
    select * into strict before_row from public.products where id=target.id for update;
    select coalesce(jsonb_agg(g order by g),'[]'::jsonb) into observed_gtins
      from (select distinct canonical_gtin14 as g from public.product_identifiers
            where product_id=target.id and canonical_gtin14 is not null) ids;
    if before_row.name is distinct from target.name or before_row.brand is distinct from target.brand
       or before_row.is_active is distinct from true or before_row.lifecycle_status is distinct from 'active'
       or observed_gtins is distinct from target.gtins
       or before_row.affiliate_link is distinct from target.affiliate_link
       or before_row.net_content_value is distinct from target.net_content_value
       or before_row.net_content_unit is distinct from target.net_content_unit
       or before_row.purchase_link_status::text is distinct from target.purchase_link_status
       or before_row.purchase_link_checked_at is distinct from target.purchase_link_checked_at
       or before_row.is_chaarlie_recommended is distinct from target.is_chaarlie_recommended then
      raise exception 'Reviewed price identity or commercial baseline changed: %',target.id;
    end if;
    if target.new_price is null or target.new_price<=0 or target.new_price>500
       or not ((target.id='f033afbe-281a-419e-a245-3ad83d721bd0'::uuid and target.new_price=3.95)
         or (target.id='6dc65df2-2466-43e4-bdc2-3a05803f305c'::uuid and target.new_price=5.40)) then
      raise exception 'Price differs from the exact approved correction: %',target.id;
    end if;
    if before_row.price_eur=target.new_price and before_row.price_checked_at=receipt_stamp then
      continue;
    end if;
    if before_row.price_eur is distinct from target.old_price
       or before_row.price_checked_at is distinct from target.old_stamp then
      raise exception 'Reviewed price baseline changed: %',target.id;
    end if;
    update public.products set price_eur=target.new_price,price_checked_at=receipt_stamp
      where id=target.id returning * into strict after_row;
    if (to_jsonb(before_row)-'price_eur'-'price_checked_at'-'updated_at')
       is distinct from (to_jsonb(after_row)-'price_eur'-'price_checked_at'-'updated_at') then
      raise exception 'Unexpected field changed; roll back reviewed batch: %',target.id;
    end if;
  end loop;
end $reviewed_prices$;
