-- R28 (consult-iteration-2): routine complexity asked in the call — two options only.
-- Additive nullable column; apply to prod BEFORE deploying code that selects it.
alter table public.discovery_call_sheets
  add column if not exists complexity text
    constraint discovery_call_sheets_complexity_check
    check (complexity in ('essenziell', 'normal'));
