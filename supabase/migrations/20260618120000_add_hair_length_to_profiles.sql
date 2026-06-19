alter table public.hair_profiles
  add column if not exists hair_length text;

alter table public.hair_profiles
  drop constraint if exists hair_profiles_hair_length_check;

alter table public.hair_profiles
  add constraint hair_profiles_hair_length_check
  check (
    hair_length is null
    or hair_length in ('very_short', 'short', 'medium', 'long', 'very_long')
  );
