-- Discovery checklist without category tiles (batch 5, plan
-- plans/discovery-flat-checklist/plan.md Rev. 3, task 1).
--
-- A captured product now carries two separate answers:
--   * product_type — what the product IS when there is no catalog product and no
--     research submission yet (the research submission is created from it, F1).
--     NULL for „Weiß ich nicht".
--   * category (+ usage_role) — how SHE uses it (R9). NULL while unknown. The oil
--     step has three roles and a scalp oil is scalp care, so the usage may carry
--     a routine role (F5).
--
-- Backward compatible with the deployed app: it writes neither new column and
-- never a NULL category, and every row it writes passes every CHECK below.
-- Apply before the deploy that reads the new columns.
--
-- Reverse: DROP FUNCTION public.discovery_intake_submit_confirming_none(uuid);
-- drop the three constraints and two columns; re-add NOT NULL on category once
-- no row carries a NULL category.

ALTER TABLE public.discovery_intake_items
  ALTER COLUMN category DROP NOT NULL,
  ADD COLUMN product_type text,
  ADD COLUMN usage_role text;

ALTER TABLE public.discovery_intake_items
  -- Same ten keys as the category CHECK (SUPPORTED_PRODUCT_CATEGORY_KEYS).
  ADD CONSTRAINT discovery_intake_items_product_type_check CHECK (
    product_type IS NULL OR product_type IN (
      'shampoo',
      'conditioner',
      'leave_in',
      'mask',
      'oil',
      'dry_shampoo',
      'deep_cleansing_shampoo',
      'bondbuilder',
      'heat_protectant',
      'scalp_care'
    )
  ),
  -- A usage role only with the category it belongs to. `category IS NOT NULL`
  -- is spelled out: a NULL comparison would otherwise make the CHECK pass.
  ADD CONSTRAINT discovery_intake_items_usage_role_pair CHECK (
    usage_role IS NULL
    OR (
      category IS NOT NULL
      AND (
        (category = 'oil' AND usage_role IN (
          'pre_wash_fibre_treatment',
          'leave_on_fibre_conditioning',
          'dry_finish'
        ))
        OR (category = 'scalp_care' AND usage_role = 'scalp_flake_oil_adjunct')
      )
    )
  ),
  -- „benutzt sie nicht" answers a category and nothing else.
  ADD CONSTRAINT discovery_intake_items_none_is_category_only CHECK (
    source <> 'none'
    OR (category IS NOT NULL AND usage_role IS NULL AND product_type IS NULL)
  );

COMMENT ON COLUMN public.discovery_intake_items.category IS
  'Usage: the routine category she uses the product in. NULL = usage unknown („Weiß ich nicht").';
COMMENT ON COLUMN public.discovery_intake_items.product_type IS
  'What the product is, when no catalog product carries it; research submissions are created from it. NULL = unknown.';
COMMENT ON COLUMN public.discovery_intake_items.usage_role IS
  'Routine role of the usage for multi-role steps: oil roles with oil, scalp_flake_oil_adjunct with scalp_care.';

-- „Stimmt so – abschicken": ONE call that records every category without a
-- product as an explicit „benutzt sie nicht" and freezes the intake.
--
-- Outcomes (jsonb `outcome`): not_found | not_draft | no_products | submitted.
-- Products are rows with source <> 'none' — a product with unknown usage
-- counts as a product but answers no category. The intake row is locked for
-- the duration; participant item writes are checked in the app only (accepted
-- risk, plan Rev. 3), so this lock orders submits, not item writes.
CREATE FUNCTION public.discovery_intake_submit_confirming_none(target_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_state text;
  confirmed text[];
  stamped timestamptz;
BEGIN
  SELECT intake.state INTO current_state
    FROM public.discovery_intakes AS intake
   WHERE intake.id = target_intake_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;
  IF current_state <> 'draft' THEN
    RETURN jsonb_build_object('outcome', 'not_draft');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.discovery_intake_items AS item
     WHERE item.intake_id = target_intake_id AND item.source <> 'none'
  ) THEN
    RETURN jsonb_build_object('outcome', 'no_products');
  END IF;

  -- A category holding products AND a legacy „benutze ich nicht": products win.
  DELETE FROM public.discovery_intake_items AS answer
   WHERE answer.intake_id = target_intake_id
     AND answer.source = 'none'
     AND EXISTS (
       SELECT 1 FROM public.discovery_intake_items AS product
        WHERE product.intake_id = target_intake_id
          AND product.source <> 'none'
          AND product.category = answer.category
     );

  WITH missing AS (
    SELECT supported.category, supported.position
      FROM unnest(ARRAY[
        'shampoo',
        'conditioner',
        'leave_in',
        'mask',
        'oil',
        'dry_shampoo',
        'deep_cleansing_shampoo',
        'bondbuilder',
        'heat_protectant',
        'scalp_care'
      ]::text[]) WITH ORDINALITY AS supported(category, position)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.discovery_intake_items AS existing
        WHERE existing.intake_id = target_intake_id
          AND existing.category = supported.category
     )
  ),
  inserted AS (
    INSERT INTO public.discovery_intake_items (intake_id, category, source)
    SELECT target_intake_id, missing.category, 'none' FROM missing
    RETURNING category
  )
  SELECT coalesce(array_agg(missing.category ORDER BY missing.position), ARRAY[]::text[])
    INTO confirmed
    FROM missing
   WHERE missing.category IN (SELECT inserted.category FROM inserted);

  UPDATE public.discovery_intakes
     SET state = 'submitted', submitted_at = now()
   WHERE id = target_intake_id
  RETURNING submitted_at INTO stamped;

  RETURN jsonb_build_object(
    'outcome', 'submitted',
    'submitted_at', stamped,
    'confirmed_none', to_jsonb(confirmed)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_intake_submit_confirming_none(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_intake_submit_confirming_none(uuid) TO service_role;

COMMENT ON FUNCTION public.discovery_intake_submit_confirming_none(uuid) IS
  'Participant submit with confirmation: inserts none rows for every category without a product and marks the intake submitted, atomically.';
