-- Account-backed native scan/search history. No verdict or product display snapshots.
-- Products deliberately have no FK: a removed catalog identity remains reopenable as
-- unavailable. Account deletion cascades; clearing history never deletes research.
CREATE TABLE public.mobile_scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  barcode_ean text,
  barcode_gtin14 text GENERATED ALWAYS AS (public.product_identifier_canonical_gtin14('ean',barcode_ean)) STORED,
  product_id uuid,
  submission_id uuid REFERENCES public.product_submissions(id) ON DELETE SET NULL,
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (barcode_ean IS NOT NULL OR product_id IS NOT NULL),
  CHECK (barcode_ean IS NULL OR (barcode_ean ~ '^([0-9]{8}|[0-9]{13})$' AND public.product_identifier_canonical_gtin14('ean',barcode_ean) IS NOT NULL)),
  CHECK (submission_id IS NULL OR barcode_ean IS NOT NULL)
);
CREATE UNIQUE INDEX mobile_scan_history_barcode_key ON public.mobile_scan_history(user_id,barcode_gtin14) WHERE barcode_gtin14 IS NOT NULL;
CREATE UNIQUE INDEX mobile_scan_history_product_key ON public.mobile_scan_history(user_id,product_id) WHERE barcode_gtin14 IS NULL;
CREATE INDEX mobile_scan_history_recent ON public.mobile_scan_history(user_id,last_seen_at DESC,id DESC);
CREATE INDEX mobile_scan_history_submission ON public.mobile_scan_history(submission_id) WHERE submission_id IS NOT NULL;
ALTER TABLE public.mobile_scan_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobile_scan_history FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.mobile_scan_history TO authenticated;
GRANT ALL ON public.mobile_scan_history TO service_role;
CREATE POLICY mobile_scan_history_owner_read ON public.mobile_scan_history FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY mobile_scan_history_owner_delete ON public.mobile_scan_history FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);

-- Only the bearer-authenticated mobile server can write validated identities.
-- A per-owner transaction lock serializes scan, search, merge and clear, including
-- the empty-table case that row locks alone cannot protect.
CREATE FUNCTION public.mobile_scan_history_touch(p_user_id uuid,p_barcode_ean text DEFAULT NULL,p_product_id uuid DEFAULT NULL,p_submission_id uuid DEFAULT NULL)
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
      -- Preserve list identity when the first real barcode replaces a search identity.
      v_id := v_provisional.id;
      UPDATE public.mobile_scan_history SET barcode_ean=p_barcode_ean WHERE id=v_id;
    ELSIF v_id IS NOT NULL AND v_provisional.id IS NOT NULL THEN
      UPDATE public.mobile_scan_history SET last_seen_at=greatest(last_seen_at,v_provisional.last_seen_at) WHERE id=v_id;
      DELETE FROM public.mobile_scan_history WHERE id=v_provisional.id;
    END IF;
  ELSE
    -- A barcode saved before catalog publication must also absorb a later search.
    SELECT h.id INTO v_id FROM public.mobile_scan_history h
      WHERE h.user_id=p_user_id AND (h.product_id=p_product_id OR EXISTS (
        SELECT 1 FROM public.product_identifiers i WHERE i.product_id=p_product_id AND i.canonical_gtin14=h.barcode_gtin14
      )) ORDER BY (h.barcode_gtin14 IS NOT NULL) DESC,h.last_seen_at DESC,h.id DESC LIMIT 1;
    IF v_id IS NOT NULL THEN
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

CREATE FUNCTION public.mobile_scan_history_clear(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_history_owner'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mobile-scan-history:'||p_user_id::text,0));
  DELETE FROM public.mobile_scan_history WHERE user_id=p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.mobile_scan_history_touch(uuid,text,uuid,uuid),public.mobile_scan_history_clear(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_scan_history_touch(uuid,text,uuid,uuid),public.mobile_scan_history_clear(uuid) TO service_role;
