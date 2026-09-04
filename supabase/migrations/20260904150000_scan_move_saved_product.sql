-- Atomic Merkliste <-> Routine move for the Produkt-Scan save sheet.
--
-- The two save destinations are exclusive, so `POST /api/scan/save` is a MOVE:
-- write the destination, drop the source. Doing that as two separate admin-client
-- calls (the previous implementation) had two defects:
--   * two concurrent opposite moves for the same user+product could each delete
--     the row the other had just inserted, leaving the product in NEITHER list
--     while both requests returned 200;
--   * a cleanup that failed after a successful destination write left both rows
--     behind and answered 500, with no way for the client to know what stood.
-- Both disappear once the insert, the delete and the state read happen inside one
-- function invocation, i.e. one transaction, serialised per user+product.
--
-- Eligibility mirrors the helpers this replaces (`src/lib/scan/saved-state.ts`):
-- lifecycle-active product + ruling R7's disposition quarantine, and deliberately
-- NO `origin` gate — the 2026-09-01 relaxation lets a user save any active,
-- non-quarantined product, wider than `personal_plan_create_or_reuse_user_product`.
--
-- The returned `savedState` is READ BACK after the writes rather than assumed, so
-- "already owned via Stage-3" reports `managedByScan: false` instead of claiming a
-- row the scan surface may not remove. Its priority order is the one
-- `loadScanSavedState` applies (wishlist first, then owned routine rows), so a
-- follow-up GET never contradicts the response the move just returned.

CREATE OR REPLACE FUNCTION public.scan_move_saved_product(
  p_user_id uuid,
  p_product_id uuid,
  p_kind text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_on_wishlist boolean;
  v_owned_total integer;
  v_owned_by_scan integer;
BEGIN
  -- The route validates `kind` with zod before calling; this is the guard that
  -- keeps a direct service_role call from silently doing the wrong move. NULL is
  -- spelled out because `NULL NOT IN (...)` is NULL, not true, so a NULL kind would
  -- otherwise fall past this check and reach the CASE below as an unhandled branch.
  IF p_kind IS NULL OR p_kind NOT IN ('routine', 'merkliste') THEN
    RAISE EXCEPTION 'scan_move_saved_product: unknown kind %', p_kind
      USING ERRCODE = '22023';
  END IF;

  -- Serialise every move for this user+product so two opposite moves queue instead
  -- of interleaving their insert/delete pairs.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('scan_move_saved_product:' || p_user_id::text || ':' || p_product_id::text)
  );

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND is_active = true
    AND lifecycle_status = 'active';

  IF v_product.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'product_not_found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.personal_plan_product_search_dispositions disposition
    WHERE disposition.product_id = p_product_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'product_not_saveable');
  END IF;

  IF p_kind = 'merkliste' THEN
    INSERT INTO public.scan_wishlist (user_id, product_id)
    VALUES (p_user_id, p_product_id)
    ON CONFLICT (user_id, product_id) DO NOTHING;

    -- Scoped exactly like `removeScanRoutineProduct`: an owned row another surface
    -- created (Stage-3, product intake) is not the scan sheet's to move, and that
    -- is not an error — the state read below reports what actually stands.
    DELETE FROM public.user_products
    WHERE user_id = p_user_id
      AND catalog_product_id = p_product_id
      AND intake_source = 'scan'
      AND ownership_status = 'owned';
  ELSE
    -- Already owned by any surface: inserting a second scan-owned row just to make
    -- `managedByScan` true would fake a save that never happened.
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_products owned
      WHERE owned.user_id = p_user_id
        AND owned.catalog_product_id = p_product_id
        AND owned.identity_status = 'matched'
        AND owned.ownership_status = 'owned'
    ) THEN
      INSERT INTO public.user_products (
        user_id, category, catalog_product_id, brand_text, product_name_text,
        identity_status, ownership_status, intake_source
      )
      VALUES (
        p_user_id, v_product.category_key, v_product.id, v_product.brand, v_product.name,
        'matched', 'owned', 'scan'
      )
      ON CONFLICT (user_id, category, catalog_product_id)
        WHERE ownership_status = 'owned' AND catalog_product_id IS NOT NULL
      DO NOTHING;
    END IF;

    DELETE FROM public.scan_wishlist
    WHERE user_id = p_user_id
      AND product_id = p_product_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.scan_wishlist wishlist
    WHERE wishlist.user_id = p_user_id
      AND wishlist.product_id = p_product_id
  ) INTO v_on_wishlist;

  SELECT
    pg_catalog.count(*),
    pg_catalog.count(*) FILTER (WHERE owned.intake_source = 'scan')
  INTO v_owned_total, v_owned_by_scan
  FROM public.user_products owned
  WHERE owned.user_id = p_user_id
    AND owned.catalog_product_id = p_product_id
    AND owned.identity_status = 'matched'
    AND owned.ownership_status = 'owned';

  RETURN pg_catalog.jsonb_build_object(
    'outcome', 'saved',
    'savedState', CASE
      -- Every `scan_wishlist` row belongs to the scan surface, so it is always ours.
      WHEN v_on_wishlist THEN
        pg_catalog.jsonb_build_object('state', 'merkliste', 'managedByScan', true)
      WHEN v_owned_total > 0 THEN
        pg_catalog.jsonb_build_object('state', 'routine', 'managedByScan', v_owned_by_scan > 0)
      ELSE
        pg_catalog.jsonb_build_object('state', NULL, 'managedByScan', false)
    END
  );
END;
$function$;

-- Grants mirror public.personal_plan_create_or_reuse_user_product (migration
-- 20260811212000): the only caller is the scan API on the admin client.
REVOKE ALL ON FUNCTION public.scan_move_saved_product(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_move_saved_product(uuid, uuid, text) TO service_role;
