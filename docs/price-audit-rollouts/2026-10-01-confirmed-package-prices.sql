-- Nick approved the current olive bottle price and accepted Moroccanoil's smaller pack.
-- Retailer evidence checked 2026-10-01: dm 750 ml / EUR 6.95; Douglas 50 ml / EUR 16.
-- Change commercial price/stamp/pack-size only; preserve product and scan identities.
do $package_prices$
declare
  target record;
  before_row public.products%rowtype;
  after_row public.products%rowtype;
begin
  for target in select * from (values
    ('9bfe0a67-72ad-4951-bb99-9f2f5d5c724a'::uuid,
     'dmBio natives Olivenöl extra','dmBio',
     'https://www.dm.de/p/d/1459848/dmbio-natives-olivenoel-extra',
     3.75::numeric,6.95::numeric,750::numeric,'04066447918687'),
    ('7a3d1d99-2ff4-49b9-b021-d5ec2bdb0fe6'::uuid,
     'Moroccanoil All In One Leave In Conditioner','Moroccanoil',
     'https://www.douglas.de/de/p/5011481841',
     28.80::numeric,16.00::numeric,50::numeric,'07290113142954')
  ) as approved(id,name,brand,link,old_price,new_price,volume_ml,gtin14)
  loop
    select * into strict before_row from public.products where id=target.id for update;
    if before_row.name is distinct from target.name or before_row.brand is distinct from target.brand
       or before_row.affiliate_link is distinct from target.link
       or before_row.is_active is distinct from true or before_row.lifecycle_status is distinct from 'active'
       or not exists(select 1 from public.product_identifiers where product_id=target.id and canonical_gtin14=target.gtin14) then
      raise exception 'Package price identity guard mismatch: %',target.id;
    end if;
    if before_row.price_eur=target.new_price and before_row.net_content_value=target.volume_ml
       and before_row.net_content_unit='ml' and before_row.price_checked_at>='2026-10-01T00:00:00Z'::timestamptz then
      continue;
    end if;
    if before_row.price_eur is distinct from target.old_price
       or before_row.price_checked_at is distinct from '2026-06-10T00:00:00Z'::timestamptz
       or before_row.net_content_value is not null or before_row.net_content_unit is not null then
      raise exception 'Package price baseline changed: %',target.id;
    end if;
    update public.products set price_eur=target.new_price,price_checked_at=now(),
      net_content_value=target.volume_ml,net_content_unit='ml'
      where id=target.id returning * into strict after_row;
    if (to_jsonb(before_row)-'price_eur'-'price_checked_at'-'net_content_value'-'net_content_unit'-'updated_at')
       is distinct from
       (to_jsonb(after_row)-'price_eur'-'price_checked_at'-'net_content_value'-'net_content_unit'-'updated_at') then
      raise exception 'Unexpected noncommercial change; roll back: %',target.id;
    end if;
  end loop;
end $package_prices$;
select id,name,price_eur,price_checked_at,net_content_value,net_content_unit,affiliate_link,
       purchase_link_status,purchase_link_checked_at
from public.products where id in ('9bfe0a67-72ad-4951-bb99-9f2f5d5c724a','7a3d1d99-2ff4-49b9-b021-d5ec2bdb0fe6')
order by name;
