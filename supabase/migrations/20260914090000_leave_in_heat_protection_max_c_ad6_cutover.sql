-- AD-6 cutover — degree values were legacy marketing heuristics (10 rows in the
-- 2026-08-26 baseline, ≤15 with later waves); binary `provides_heat_protection` is
-- the sole heat field. Column + CHECK retained for writer-compatibility, drop
-- scheduled as later cleanup.
UPDATE public.product_leave_in_specs
SET heat_protection_max_c = NULL
WHERE heat_protection_max_c IS NOT NULL;
