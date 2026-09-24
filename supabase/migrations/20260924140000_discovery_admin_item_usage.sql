-- Discovery cockpit: admin usage correction (batch 5, plan
-- plans/discovery-flat-checklist/plan.md Rev. 3 task 5 — R7, R10, P1-3, F3).
--
-- After she submitted, only the cockpit changes a product's usage (R10). One
-- call does the whole correction, so the list she confirmed stays consistent:
--
--   * refuses while the call is finalized („Erst Finalisierung aufheben") or the
--     checklist is still a draft;
--   * sets the item's usage (category + role) and — only for an item nobody
--     knows the type of („Kategorie offen", R7) — its product type;
--   * deletes a „benutzt sie nicht" row in the destination category;
--   * when the vacated category has no product left, inserts a „benutzt sie
--     nicht" there (Nick 2026-09-24: her „Stimmt so – abschicken" confirmed the
--     whole list, so a misfiled product's old category is honestly empty);
--   * deletes every call decision that referenced the moved item, and the
--     decisions of the steps whose bound item the move changes (F3) — the
--     binding is computed by the app from the Idealplan, which the database
--     does not know, and handed in as `stale_decision_keys`.
--
-- Outcomes (jsonb `outcome`): not_found | not_submitted | finalized |
-- item_not_found | type_known | product_type_required | updated.
-- The usage/role pair itself is checked by discovery_intake_items_usage_role_pair.
--
-- Backward compatible: a new function only; no table changes.
-- Reverse: DROP FUNCTION public.discovery_admin_set_intake_item_usage(uuid, uuid, text, text, text, text[]);

CREATE FUNCTION public.discovery_admin_set_intake_item_usage(
  target_intake_id uuid,
  target_item_id uuid,
  new_category text,
  new_usage_role text,
  new_product_type text,
  stale_decision_keys text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  intake_state text;
  finalized_at timestamptz;
  item public.discovery_intake_items%ROWTYPE;
  vacated text;
  none_removed integer := 0;
  none_inserted boolean := false;
  decisions_cleared integer := 0;
BEGIN
  SELECT intake.state, intake.call_finalized_at INTO intake_state, finalized_at
    FROM public.discovery_intakes AS intake
   WHERE intake.id = target_intake_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;
  IF intake_state <> 'submitted' THEN
    RETURN jsonb_build_object('outcome', 'not_submitted');
  END IF;
  IF finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'finalized');
  END IF;

  SELECT * INTO item
    FROM public.discovery_intake_items AS candidate
   WHERE candidate.id = target_item_id
     AND candidate.intake_id = target_intake_id
     AND candidate.source <> 'none'
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'item_not_found');
  END IF;

  -- A product type is only ever SET here, and only where nobody knows it (R7);
  -- a known type (catalog, classifier, her answer) is never overwritten.
  IF new_product_type IS NOT NULL
     AND (item.product_type IS NOT NULL
          OR item.product_id IS NOT NULL
          OR item.product_submission_id IS NOT NULL) THEN
    RETURN jsonb_build_object('outcome', 'type_known');
  END IF;
  -- A usage alone on a type-open item would read as a legacy row to research
  -- (which falls back to the usage category): the type comes first (F1).
  IF new_product_type IS NULL
     AND item.product_type IS NULL
     AND item.product_id IS NULL
     AND item.product_submission_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'product_type_required');
  END IF;

  vacated := item.category;

  UPDATE public.discovery_intake_items
     SET category = new_category,
         usage_role = new_usage_role,
         product_type = coalesce(new_product_type, product_type)
   WHERE id = target_item_id;

  DELETE FROM public.discovery_intake_items AS answer
   WHERE answer.intake_id = target_intake_id
     AND answer.source = 'none'
     AND answer.category = new_category;
  GET DIAGNOSTICS none_removed = ROW_COUNT;

  IF vacated IS NOT NULL
     AND vacated IS DISTINCT FROM new_category
     AND NOT EXISTS (
       SELECT 1 FROM public.discovery_intake_items AS other
        WHERE other.intake_id = target_intake_id
          AND other.category = vacated
     ) THEN
    INSERT INTO public.discovery_intake_items (intake_id, category, source)
    VALUES (target_intake_id, vacated, 'none');
    none_inserted := true;
  END IF;

  DELETE FROM public.discovery_call_decisions AS decision
   WHERE decision.intake_id = target_intake_id
     AND (
       decision.intake_item_id = target_item_id
       OR decision.decision_key = ANY (coalesce(stale_decision_keys, ARRAY[]::text[]))
     );
  GET DIAGNOSTICS decisions_cleared = ROW_COUNT;

  RETURN jsonb_build_object(
    'outcome', 'updated',
    'vacated_category', vacated,
    'none_removed', none_removed > 0,
    'none_inserted', none_inserted,
    'decisions_cleared', decisions_cleared
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_admin_set_intake_item_usage(uuid, uuid, text, text, text, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_admin_set_intake_item_usage(uuid, uuid, text, text, text, text[])
  TO service_role;

COMMENT ON FUNCTION public.discovery_admin_set_intake_item_usage(uuid, uuid, text, text, text, text[]) IS
  'Cockpit usage correction after submission: usage (+ type for a type-open item), none rows for the destination and the vacated category, stale call decisions — atomically.';
