do $$
declare
  before_row public.products%rowtype;
  after_row public.products%rowtype;
  target_id constant uuid := '9bfe0a67-72ad-4951-bb99-9f2f5d5c724a';
  old_link constant text := 'https://www.dm.de/dmbio-natives-olivenoel-extra-p4066447423761.html';
  new_link constant text := 'https://www.dm.de/p/d/1459848/dmbio-natives-olivenoel-extra';
begin
  select * into strict before_row from public.products where id=target_id for update;
  if before_row.name <> 'dmBio natives Olivenöl extra' or before_row.brand <> 'dmBio'
     or not exists (select 1 from public.product_identifiers where product_id=target_id and canonical_gtin14='04066447918687') then
    raise exception 'Olive identity precondition changed';
  end if;
  if before_row.affiliate_link = new_link then
    return;
  end if;
  if before_row.affiliate_link is distinct from old_link then
    raise exception 'Olive link changed concurrently';
  end if;
  update public.products set affiliate_link=new_link where id=target_id returning * into strict after_row;
  if (to_jsonb(before_row)-'affiliate_link'-'updated_at') is distinct from
     (to_jsonb(after_row)-'affiliate_link'-'updated_at') then
    raise exception 'Unexpected field change: rolling back link update';
  end if;
end $$;
select id,name,affiliate_link,price_eur,price_checked_at,purchase_link_status,purchase_link_checked_at,net_content_value,net_content_unit
from public.products where id='9bfe0a67-72ad-4951-bb99-9f2f5d5c724a';
