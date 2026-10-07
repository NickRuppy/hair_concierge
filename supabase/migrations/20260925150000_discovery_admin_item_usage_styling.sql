-- Discovery cockpit batch 7 follow-up (plan plans/discovery-refinement-b7/plan.md Rev. 3,
-- §2.4 D2): the admin usage correction learns the non-evaluated styling type.
--
--   * a STYLING item may be corrected into an evaluated product: the call sets its product
--     type (one of the ten categories — required, like on a type-open item) together with
--     the usage. „Recherche starten" then opens its research exactly as for „Kategorie offen";
--   * an evaluated item may be corrected INTO styling (new_product_type = 'styling'): usage
--     category and role are cleared and the research link is dropped — the
--     discovery_intake_items_styling_not_evaluated CHECK (20260925120000) allows neither on a
--     styling row. The product_submissions row itself stays; only the link goes.
--
-- Everything else is exactly 20260924140000: the finalize / draft guards, a known type is
-- never overwritten (styling excepted), the destination's „benutzt sie nicht" goes, a
-- vacated category gets one, and the moved item's decisions plus stale_decision_keys are
-- cleared — atomically.
--
-- Outcomes (jsonb `outcome`): not_found | not_submitted | finalized | item_not_found |
-- type_known | product_type_required | updated.
--
-- Backward compatible: same signature, and every call the deployed app makes (a category
-- with a usage, a type only for a type-open item) behaves as before.
-- Reverse: re-run the CREATE FUNCTION body of 20260924140000 as CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.discovery_admin_set_intake_item_usage(
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
  to_styling boolean := new_product_type IS NOT DISTINCT FROM 'styling';
  from_styling boolean;
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

  from_styling := item.product_type IS NOT DISTINCT FROM 'styling';

  IF to_styling THEN
    -- Already styling: nothing to correct.
    IF from_styling THEN
      RETURN jsonb_build_object('outcome', 'type_known');
    END IF;
  ELSIF from_styling THEN
    -- Out of styling, the type comes with the usage (as on a type-open item).
    IF new_product_type IS NULL THEN
      RETURN jsonb_build_object('outcome', 'product_type_required');
    END IF;
  ELSE
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
  END IF;

  vacated := item.category;

  IF to_styling THEN
    UPDATE public.discovery_intake_items
       SET category = NULL,
           usage_role = NULL,
           product_type = 'styling',
           product_submission_id = NULL
     WHERE id = target_item_id;
  ELSE
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
  END IF;

  IF vacated IS NOT NULL
     AND vacated IS DISTINCT FROM (CASE WHEN to_styling THEN NULL ELSE new_category END)
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

COMMENT ON FUNCTION public.discovery_admin_set_intake_item_usage(uuid, uuid, text, text, text, text[]) IS
  'Cockpit usage correction after submission: usage (+ type for a type-open or styling item, or into styling), none rows for the destination and the vacated category, stale call decisions — atomically.';
