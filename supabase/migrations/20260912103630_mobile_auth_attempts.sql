-- Server-owned association between code and link; no public credential storage.
create table public.mobile_auth_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  verification_count integer not null default 0 check (verification_count >= 0),
  consumed boolean not null default false
);
alter table public.mobile_auth_attempts enable row level security;
revoke all on public.mobile_auth_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.mobile_auth_attempts to service_role;
create index mobile_auth_attempt_expiry on public.mobile_auth_attempts (expires_at);
create unique index mobile_auth_attempt_active_email on public.mobile_auth_attempts (email) where not consumed;

-- Resend stays on the same logical attempt. Supabase rotates the credential within
-- that attempt, so an older still-active ID cannot verify another attempt's code.
create function public.mobile_start_auth_attempt(p_email text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare attempt uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mobile-auth:' || p_email, 0));
  delete from public.mobile_auth_attempts where email = p_email and (expires_at <= now() or consumed or verification_count >= 8);
  select id into attempt from public.mobile_auth_attempts where email = p_email and not consumed;
  if attempt is null then
    insert into public.mobile_auth_attempts(email) values (p_email) returning id into attempt;
  end if;
  return attempt;
end;
$$;
revoke all on function public.mobile_start_auth_attempt(text) from public, anon, authenticated;
grant execute on function public.mobile_start_auth_attempt(text) to service_role;

create function public.mobile_claim_auth_verification(p_attempt_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare destination text;
begin
  update public.mobile_auth_attempts
  set verification_count = verification_count + 1
  where id = p_attempt_id and not consumed and expires_at > now() and verification_count < 8
  returning email into destination;
  return destination;
end;
$$;
revoke all on function public.mobile_claim_auth_verification(uuid) from public, anon, authenticated;
grant execute on function public.mobile_claim_auth_verification(uuid) to service_role;
