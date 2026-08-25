do $$
begin
  if to_regclass('public.billing_subscriptions_backup_20260822') is not null then
    execute 'revoke all privileges on table public.billing_subscriptions_backup_20260822 from public, anon, authenticated';
    execute 'alter table public.billing_subscriptions_backup_20260822 enable row level security';
  end if;

  if to_regclass('public.profiles_backup_20260822') is not null then
    execute 'revoke all privileges on table public.profiles_backup_20260822 from public, anon, authenticated';
    execute 'alter table public.profiles_backup_20260822 enable row level security';
  end if;
end
$$;
