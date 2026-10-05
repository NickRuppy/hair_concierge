-- Nick approved replacing the broken Douglas K18 link with this Flaconi offer.
-- Exact EAN 858511001128; verified live on 2026-10-01: 50 ml / EUR 56.25, in stock.
do $price_corrections$
declare
  target record;
  before_row public.products%rowtype;
  after_row public.products%rowtype;
begin
  for target in select * from (values
    ('38dace91-0fba-49ee-a93f-ac36e488fe4b'::uuid,
     'K18 Leave-In Molecular Repair Hair Mask','K18',
     'https://www.douglas.de/de/p/5010334127',
     'https://www.flaconi.de/haare/k18/leave-in-molecular/k18-leave-in-molecular-repair-hair-mask-haarkur.html?variant=80074805-50',
     75.00::numeric,56.25::numeric,50::numeric,
     '2026-06-10T00:00:00Z'::timestamptz,'00858511001128')
  ) as proposal(id,name,brand,old_link,new_link,old_price,new_price,volume_ml,old_stamp,gtin14)
  loop
    select * into strict before_row from public.products where id=target.id for update;
    if before_row.name is distinct from target.name or before_row.brand is distinct from target.brand
       or before_row.is_active is distinct from true or before_row.lifecycle_status is distinct from 'active'
       or not exists(select 1 from public.product_identifiers where product_id=target.id and canonical_gtin14=target.gtin14) then
      raise exception 'Commercial correction identity mismatch: %',target.id;
    end if;
    if before_row.price_eur=target.new_price and before_row.affiliate_link=target.new_link
       and before_row.net_content_value=target.volume_ml and before_row.net_content_unit='ml'
       and before_row.price_checked_at>='2026-10-01T00:00:00Z'::timestamptz then
      continue;
    end if;
    if before_row.price_eur is distinct from target.old_price
       or before_row.affiliate_link is distinct from target.old_link
       or before_row.price_checked_at is distinct from target.old_stamp
       or before_row.net_content_value is not null or before_row.net_content_unit is not null then
      raise exception 'Commercial correction baseline changed: %',target.id;
    end if;
    update public.products set price_eur=target.new_price,price_checked_at=now(),
      affiliate_link=target.new_link,net_content_value=target.volume_ml,net_content_unit='ml'
      where id=target.id returning * into strict after_row;
    if (to_jsonb(before_row)-'price_eur'-'price_checked_at'-'affiliate_link'-'net_content_value'-'net_content_unit'-'updated_at')
       is distinct from
       (to_jsonb(after_row)-'price_eur'-'price_checked_at'-'affiliate_link'-'net_content_value'-'net_content_unit'-'updated_at') then
      raise exception 'Unexpected noncommercial change; roll back: %',target.id;
    end if;
  end loop;
end $price_corrections$;
select id,name,price_eur,price_checked_at,net_content_value,net_content_unit,affiliate_link,
       purchase_link_status,purchase_link_checked_at
from public.products where id='38dace91-0fba-49ee-a93f-ac36e488fe4b'
order by name;
