-- Scan resolve attempt log: one row per barcode resolve attempt, hit or miss.
-- Operator-facing operational data — the miss ranking is the EAN-backfill
-- priority list (WP10) and the debugging trail for field-test reports.
-- Deliberately server-written only (resolve API on the admin client); users
-- never read this table, so no authenticated grants at all.

CREATE TABLE IF NOT EXISTS public.scan_resolve_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier_type text NOT NULL,
  raw_value text NOT NULL,
  canonical_value text,
  outcome text NOT NULL CHECK (outcome IN ('hit', 'miss', 'pending_submission', 'quarantined', 'invalid')),
  matched_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Miss ranking groups by the canonical spelling; recency queries scan by outcome.
CREATE INDEX IF NOT EXISTS idx_scan_resolve_events_canonical
  ON public.scan_resolve_events (canonical_value);
CREATE INDEX IF NOT EXISTS idx_scan_resolve_events_outcome_created
  ON public.scan_resolve_events (outcome, created_at);

ALTER TABLE public.scan_resolve_events ENABLE ROW LEVEL SECURITY;

-- Grants mirror scan_wishlist (migration 20260820100200): service-role only.
-- Unlike scan_wishlist there is no owner-facing surface even hypothetically
-- planned, so no defense-in-depth owner policies — nothing but service_role
-- touches this table.
REVOKE ALL ON TABLE public.scan_resolve_events FROM anon, authenticated;
GRANT ALL ON TABLE public.scan_resolve_events TO service_role;

DROP POLICY IF EXISTS scan_resolve_events_service_role_all
  ON public.scan_resolve_events;
CREATE POLICY scan_resolve_events_service_role_all
  ON public.scan_resolve_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
