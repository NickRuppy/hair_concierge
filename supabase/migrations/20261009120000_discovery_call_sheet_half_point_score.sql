-- Nomi consult finish (plans/nomi-consult-finish/plan.md T2): the baseline score takes
-- half points („7,5"), as participants say them. Widening only — every stored whole
-- score stays valid. Re-scores live in JSONB; their shape is an application contract.
-- Apply to prod BEFORE deploying code that may send a half point (the old smallint
-- column would round 7.5 to 8 silently).
-- Reverse: ALTER COLUMN baseline_score TYPE smallint USING round(baseline_score)
--          (after replacing the check with the old 1–10 one).
alter table public.discovery_call_sheets
  drop constraint if exists discovery_call_sheets_baseline_score_check;

alter table public.discovery_call_sheets
  alter column baseline_score type numeric(3, 1) using baseline_score::numeric(3, 1);

alter table public.discovery_call_sheets
  add constraint discovery_call_sheets_baseline_score_check
    check (
      baseline_score between 1 and 10
      and baseline_score * 2 = trunc(baseline_score * 2)
    );
