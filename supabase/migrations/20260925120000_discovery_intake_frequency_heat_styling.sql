-- Discovery checklist batch 7 (plan plans/discovery-refinement-b7/plan.md Rev. 3, §2.2, §2.4):
--
--   * discovery_intake_items.frequency — how often she uses each product („Wie oft nutzt
--     du es?"). NULL = not asked (every legacy row), 'unknown' = „Weiß ich nicht". The
--     values mirror PRODUCT_FREQUENCIES (src/lib/vocabulary/frequencies.ts).
--   * discovery_intakes.heat_styling — her „Hitze & Styling" answers as one validated
--     object (DiscoveryHeatStylingV1, src/lib/discovery/heat-styling.ts). NULL = not asked.
--   * D1: a conditioner used „Vor der Haarwäsche" carries the usage role
--     pre_wash_conditioner — only ever with the conditioner category.
--   * D2: product_type 'styling' — a styling product (hairspray, styling spray) we do not
--     evaluate. It has no usage, no role and no research.
--   * The cockpit's frequency correction after submit, as a sibling of the usage
--     correction RPC with the same guard.
--
-- Backward compatible with the deployed app: it writes neither new column, never the new
-- role and never the new type, and every row it writes passes every CHECK below. Apply
-- before the deploy that writes them.
--
-- Reverse: DROP FUNCTION public.discovery_admin_set_intake_item_frequency(uuid, uuid, text);
-- restore the 20260924120000 versions of discovery_intake_items_product_type_check and
-- discovery_intake_items_usage_role_pair once no row carries 'styling' or
-- 'pre_wash_conditioner'; drop the three new constraints and the two columns.

ALTER TABLE public.discovery_intake_items
  ADD COLUMN frequency text;

ALTER TABLE public.discovery_intakes
  ADD COLUMN heat_styling jsonb;

ALTER TABLE public.discovery_intake_items
  ADD CONSTRAINT discovery_intake_items_frequency_check CHECK (
    frequency IS NULL OR frequency IN (
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x',
      'unknown'
    )
  ),
  -- „benutzt sie nicht" answers a category and nothing else — no frequency either.
  ADD CONSTRAINT discovery_intake_items_none_has_no_frequency CHECK (
    source <> 'none' OR frequency IS NULL
  ),
  DROP CONSTRAINT discovery_intake_items_product_type_check,
  -- The ten supported categories (SUPPORTED_PRODUCT_CATEGORY_KEYS) plus the non-evaluated
  -- styling marker (D2).
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
      'scalp_care',
      'styling'
    )
  ),
  -- A styling product is listed, never evaluated: no usage category, no routine role, no
  -- research submission (D2).
  ADD CONSTRAINT discovery_intake_items_styling_not_evaluated CHECK (
    product_type IS DISTINCT FROM 'styling'
    OR (category IS NULL AND usage_role IS NULL AND product_submission_id IS NULL)
  ),
  DROP CONSTRAINT discovery_intake_items_usage_role_pair,
  -- As 20260924120000, plus the pre-wash conditioner (D1). `category IS NOT NULL` is
  -- spelled out: a NULL comparison would otherwise make the CHECK pass.
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
        OR (category = 'conditioner' AND usage_role = 'pre_wash_conditioner')
      )
    )
  );

ALTER TABLE public.discovery_intakes
  -- The shape is validated by the app (PUT /api/beratung/intake/heat-styling); the table
  -- only insists it is an object.
  ADD CONSTRAINT discovery_intakes_heat_styling_object CHECK (
    heat_styling IS NULL OR jsonb_typeof(heat_styling) = 'object'
  );

COMMENT ON COLUMN public.discovery_intake_items.frequency IS
  'How often she uses the product (ProductFrequency) or unknown („Weiß ich nicht"). NULL = not asked (legacy rows, none rows).';
COMMENT ON COLUMN public.discovery_intakes.heat_styling IS
  'Her „Hitze & Styling" answers (DiscoveryHeatStylingV1: dryingRoutes, additionalHeatTools, heatEvents). NULL = not asked. Written only while the intake is a draft.';

-- Cockpit frequency correction after submission (§2.2): the same guard as
-- discovery_admin_set_intake_item_usage — refused while the call is finalized („Erst
-- Finalisierung aufheben") or the checklist is still a draft. A frequency moves no binding,
-- so no call decision is cleared.
--
-- Outcomes (jsonb `outcome`): not_found | not_submitted | finalized | item_not_found | updated.
-- The value itself is checked by discovery_intake_items_frequency_check.
CREATE FUNCTION public.discovery_admin_set_intake_item_frequency(
  target_intake_id uuid,
  target_item_id uuid,
  new_frequency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  intake_state text;
  finalized_at timestamptz;
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

  UPDATE public.discovery_intake_items
     SET frequency = new_frequency
   WHERE id = target_item_id
     AND intake_id = target_intake_id
     AND source <> 'none';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'item_not_found');
  END IF;

  RETURN jsonb_build_object('outcome', 'updated');
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_admin_set_intake_item_frequency(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_admin_set_intake_item_frequency(uuid, uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.discovery_admin_set_intake_item_frequency(uuid, uuid, text) IS
  'Cockpit frequency correction after submission; refused while finalized or still a draft.';
