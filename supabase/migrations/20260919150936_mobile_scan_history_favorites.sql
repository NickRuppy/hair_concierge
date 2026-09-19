-- Favorites are a durable property of the account-owned History entry. They are
-- deliberately not direct authenticated writes: the mobile bearer boundary calls
-- the service-role RPC after owner validation.
ALTER TABLE public.mobile_scan_history
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS mobile_scan_history_favorites_recent
  ON public.mobile_scan_history(user_id,last_seen_at DESC,id DESC)
  WHERE is_favorite;

-- Preserve favorite state when a provisional product-only entry is absorbed by
-- its barcode entry, and when multiple product-only rows are collapsed.
CREATE OR REPLACE FUNCTION public.mobile_scan_history_touch(p_user_id uuid,p_barcode_ean text DEFAULT NULL,p_product_id uuid DEFAULT NULL,p_submission_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  v_gtin text := public.product_identifier_canonical_gtin14('ean',p_barcode_ean);
  v_id uuid;
  v_product uuid := p_product_id;
  v_provisional public.mobile_scan_history;
BEGIN
  IF p_user_id IS NULL OR (p_barcode_ean IS NULL AND p_product_id IS NULL)
    OR (p_barcode_ean IS NOT NULL AND (p_barcode_ean !~ '^([0-9]{8}|[0-9]{13})$' OR v_gtin IS NULL)) THEN
    RAISE EXCEPTION 'invalid_history_identity';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mobile-scan-history:'||p_user_id::text,0));
  IF p_submission_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_submissions s WHERE s.id=p_submission_id AND s.user_id=p_user_id
      AND s.source='scan' AND v_gtin IS NOT NULL
      AND public.product_identifier_canonical_gtin14('ean',s.scanned_identifier_value)=v_gtin
  ) THEN RAISE EXCEPTION 'invalid_history_submission'; END IF;

  IF v_gtin IS NOT NULL THEN
    SELECT h.id,COALESCE(p_product_id,h.product_id) INTO v_id,v_product
      FROM public.mobile_scan_history h WHERE h.user_id=p_user_id AND h.barcode_gtin14=v_gtin;
    v_product := COALESCE(v_product,p_product_id);
    IF v_product IS NOT NULL THEN
      SELECT * INTO v_provisional FROM public.mobile_scan_history h
        WHERE h.user_id=p_user_id AND h.barcode_gtin14 IS NULL AND h.product_id=v_product;
    END IF;
    IF v_id IS NULL AND v_provisional.id IS NOT NULL THEN
      v_id := v_provisional.id;
      UPDATE public.mobile_scan_history SET barcode_ean=p_barcode_ean WHERE id=v_id;
    ELSIF v_id IS NOT NULL AND v_provisional.id IS NOT NULL THEN
      UPDATE public.mobile_scan_history
        SET last_seen_at=greatest(last_seen_at,v_provisional.last_seen_at),
            is_favorite=is_favorite OR v_provisional.is_favorite
        WHERE id=v_id;
      DELETE FROM public.mobile_scan_history WHERE id=v_provisional.id;
    END IF;
  ELSE
    SELECT h.id INTO v_id FROM public.mobile_scan_history h
      WHERE h.user_id=p_user_id AND (h.product_id=p_product_id OR EXISTS (
        SELECT 1 FROM public.product_identifiers i WHERE i.product_id=p_product_id AND i.canonical_gtin14=h.barcode_gtin14
      )) ORDER BY (h.barcode_gtin14 IS NOT NULL) DESC,h.last_seen_at DESC,h.id DESC LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE public.mobile_scan_history h
        SET is_favorite = h.is_favorite OR EXISTS (
          SELECT 1 FROM public.mobile_scan_history duplicate
          WHERE duplicate.user_id=p_user_id AND duplicate.product_id=p_product_id
            AND duplicate.barcode_gtin14 IS NULL AND duplicate.id<>v_id AND duplicate.is_favorite
        )
        WHERE h.id=v_id;
      DELETE FROM public.mobile_scan_history h WHERE h.user_id=p_user_id AND h.product_id=p_product_id
        AND h.barcode_gtin14 IS NULL AND h.id<>v_id;
    END IF;
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.mobile_scan_history(user_id,barcode_ean,product_id,submission_id)
      VALUES(p_user_id,p_barcode_ean,v_product,p_submission_id) RETURNING id INTO v_id;
  ELSE
    UPDATE public.mobile_scan_history SET product_id=COALESCE(v_product,product_id),
      submission_id=COALESCE(p_submission_id,submission_id),last_seen_at=greatest(last_seen_at,clock_timestamp()) WHERE id=v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.mobile_scan_history_clear(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_history_owner'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mobile-scan-history:'||p_user_id::text,0));
  DELETE FROM public.mobile_scan_history WHERE user_id=p_user_id AND NOT is_favorite;
END $$;

CREATE FUNCTION public.mobile_scan_history_set_favorite(p_user_id uuid,p_entry_id uuid,p_is_favorite boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_updated boolean;
BEGIN
  IF p_user_id IS NULL OR p_entry_id IS NULL OR p_is_favorite IS NULL THEN
    RAISE EXCEPTION 'invalid_history_favorite';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mobile-scan-history:'||p_user_id::text,0));
  UPDATE public.mobile_scan_history SET is_favorite=p_is_favorite
    WHERE id=p_entry_id AND user_id=p_user_id
    RETURNING is_favorite INTO v_updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'history_entry_not_found'; END IF;
  RETURN v_updated;
END $$;

REVOKE ALL ON FUNCTION public.mobile_scan_history_touch(uuid,text,uuid,uuid),public.mobile_scan_history_clear(uuid),public.mobile_scan_history_set_favorite(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_scan_history_touch(uuid,text,uuid,uuid),public.mobile_scan_history_clear(uuid),public.mobile_scan_history_set_favorite(uuid,uuid,boolean) TO service_role;
