-- Scan wishlist: lets a user save a scanned/matched catalog product for
-- later without starting a full Product Intake submission. Owner-only,
-- no update surface — a saved row is either present or removed.

CREATE TABLE IF NOT EXISTS public.scan_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- No separate index on (user_id): the UNIQUE (user_id, product_id) constraint
-- above already provides a usable leading-column index for wishlist listing.

ALTER TABLE public.scan_wishlist ENABLE ROW LEVEL SECURITY;

-- Grants mirror public.product_submissions (migration 20260612130000): everything
-- is revoked from anon/authenticated, and only service_role gets table rights.
-- The production path is the scan API, which runs on the admin client; unlike
-- product_submissions there is no admin console reading this table directly, so
-- `authenticated` needs no privilege at all. Handing it SELECT/INSERT/DELETE
-- would have made scan_wishlist directly writable from any browser session with
-- only the owner policies standing between a user and their own rows -- a wider
-- surface than the feature ever uses.
REVOKE ALL ON TABLE public.scan_wishlist FROM anon, authenticated;
GRANT ALL ON TABLE public.scan_wishlist TO service_role;

-- The owner policies below stay as defense in depth: if a future surface is ever
-- granted direct access, the rows are already scoped to their owner rather than
-- open by default.

DROP POLICY IF EXISTS scan_wishlist_service_role_all
  ON public.scan_wishlist;
CREATE POLICY scan_wishlist_service_role_all
  ON public.scan_wishlist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS scan_wishlist_select_own
  ON public.scan_wishlist;
CREATE POLICY scan_wishlist_select_own
  ON public.scan_wishlist
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS scan_wishlist_insert_own
  ON public.scan_wishlist;
CREATE POLICY scan_wishlist_insert_own
  ON public.scan_wishlist
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS scan_wishlist_delete_own
  ON public.scan_wishlist;
CREATE POLICY scan_wishlist_delete_own
  ON public.scan_wishlist
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
