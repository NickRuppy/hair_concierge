-- Discovery cockpit batch 9 (plan plans/discovery-multi-product/plan.md Rev. 2, D2): several
-- of her products in one Idealplan step, one call decision per (step, product).
--
--   * one row per (intake, decision_key, intake_item_id) instead of per (intake,
--     decision_key). NULLS NOT DISTINCT: an empty step (no product, intake_item_id NULL)
--     still holds exactly one decision;
--   * decision 'drop' („Weglassen") — only ever about a product (drop_names_item), never
--     with a swap product (the swap pair CHECK is unchanged);
--   * intake_item_id ON DELETE CASCADE instead of SET NULL: two rows of one step whose
--     products are deleted would otherwise collide on the new key, and a decision about a
--     deleted product means nothing;
--   * discovery_admin_set_call_decision: the cockpit's one decision write. It takes the
--     same intake row lock as discovery_admin_set_intake_item_usage, so decisions and
--     usage corrections serialize per intake, and checks the step's invariants inside
--     that lock. The app composes the binding (the database does not know the Idealplan)
--     BEFORE the lock, so the write re-checks it: the target's usage (category, role) must
--     still be the one the app composed (stale_binding), and a drop only counts a sibling
--     whose usage is still its OWN composed one (drop_last) — a sibling a concurrent usage
--     correction moved away never keeps a step alive, while products the app legitimately
--     bound into one step with different raw roles (a pre-wash conditioner next to a
--     role-less one) still count for each other. `siblings` is a jsonb array of
--     {"id", "category", "usage_role"} as the app composed them. Two products of one step never swap
--     to the same product (swap_taken). Like the route before it, a draft intake is
--     decidable; only a finalised one is frozen.
--
-- Outcomes (jsonb `outcome`): not_found | finalized | item_not_found | stale_binding |
-- drop_last | swap_taken | stored (with the stored row).
--
-- Existing rows are compatible: the old key was stricter, and the server always wrote the
-- step's bound product. NOT compatible with the previously deployed app, whose upsert names
-- ON CONFLICT (intake_id, decision_key): coordinated cutover, see the plan's Rollout.
-- Reverse: DROP FUNCTION public.discovery_admin_set_call_decision(uuid, text, uuid, text, text, text, uuid, jsonb);
-- delete 'drop' rows and all but one row per (intake_id, decision_key); restore the old
-- UNIQUE (intake_id, decision_key), the decision CHECK without 'drop' and ON DELETE SET NULL.

ALTER TABLE public.discovery_call_decisions
  DROP CONSTRAINT discovery_call_decisions_intake_id_decision_key_key;
ALTER TABLE public.discovery_call_decisions
  ADD CONSTRAINT discovery_call_decisions_one_per_item
  UNIQUE NULLS NOT DISTINCT (intake_id, decision_key, intake_item_id);

ALTER TABLE public.discovery_call_decisions
  DROP CONSTRAINT discovery_call_decisions_decision_check;
ALTER TABLE public.discovery_call_decisions
  ADD CONSTRAINT discovery_call_decisions_decision_check
  CHECK (decision IN ('keep', 'swap', 'drop'));
ALTER TABLE public.discovery_call_decisions
  ADD CONSTRAINT discovery_call_decisions_drop_names_item
  CHECK (decision <> 'drop' OR intake_item_id IS NOT NULL);

ALTER TABLE public.discovery_call_decisions
  DROP CONSTRAINT discovery_call_decisions_intake_item_id_fkey;
ALTER TABLE public.discovery_call_decisions
  ADD CONSTRAINT discovery_call_decisions_intake_item_id_fkey
  FOREIGN KEY (intake_item_id) REFERENCES public.discovery_intake_items (id) ON DELETE CASCADE;

CREATE FUNCTION public.discovery_admin_set_call_decision(
  target_intake_id uuid,
  target_decision_key text,
  target_item_id uuid,
  expected_category text,
  expected_usage_role text,
  new_decision text,
  new_swap_product_id uuid,
  siblings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  finalized_at timestamptz;
  target_category text;
  target_role text;
  stored_key text;
  stored_decision text;
  stored_swap uuid;
  stored_item uuid;
BEGIN
  -- Draft or submitted: both decidable (as before batch 9). Finalised: frozen.
  SELECT intake.call_finalized_at INTO finalized_at
    FROM public.discovery_intakes AS intake
   WHERE intake.id = target_intake_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;
  IF finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'finalized');
  END IF;

  IF target_item_id IS NOT NULL THEN
    SELECT item.category, item.usage_role INTO target_category, target_role
      FROM public.discovery_intake_items AS item
     WHERE item.id = target_item_id
       AND item.intake_id = target_intake_id
       AND item.source <> 'none';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('outcome', 'item_not_found');
    END IF;
    -- The binding the app composed before the lock still holds for the target itself.
    IF target_category IS DISTINCT FROM expected_category
       OR target_role IS DISTINCT FROM expected_usage_role THEN
      RETURN jsonb_build_object('outcome', 'stale_binding');
    END IF;
  END IF;

  -- „Weglassen" never empties a step: at least one other product of this intake that is
  -- still in the step — its current usage (category, role), read under the lock, is still
  -- the one the app composed for it — must stay, i.e. carry no drop.
  IF new_decision = 'drop' AND NOT EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(coalesce(siblings, '[]'::jsonb))
             AS sibling (id uuid, category text, usage_role text)
      JOIN public.discovery_intake_items AS item
        ON item.id = sibling.id
       AND item.intake_id = target_intake_id
       AND item.source <> 'none'
       AND item.category IS NOT DISTINCT FROM sibling.category
       AND item.usage_role IS NOT DISTINCT FROM sibling.usage_role
     WHERE sibling.id IS DISTINCT FROM target_item_id
       AND NOT EXISTS (
         SELECT 1 FROM public.discovery_call_decisions AS other
          WHERE other.intake_id = target_intake_id
            AND other.decision_key = target_decision_key
            AND other.intake_item_id = sibling.id
            AND other.decision = 'drop'
       )
  ) THEN
    RETURN jsonb_build_object('outcome', 'drop_last');
  END IF;

  IF new_decision = 'swap' AND EXISTS (
    SELECT 1 FROM public.discovery_call_decisions AS other
     WHERE other.intake_id = target_intake_id
       AND other.decision_key = target_decision_key
       AND other.decision = 'swap'
       AND other.swap_product_id = new_swap_product_id
       AND other.intake_item_id IS DISTINCT FROM target_item_id
  ) THEN
    RETURN jsonb_build_object('outcome', 'swap_taken');
  END IF;

  INSERT INTO public.discovery_call_decisions
    (intake_id, decision_key, intake_item_id, decision, swap_product_id)
  VALUES (
    target_intake_id,
    target_decision_key,
    target_item_id,
    new_decision,
    CASE WHEN new_decision = 'swap' THEN new_swap_product_id END
  )
  ON CONFLICT (intake_id, decision_key, intake_item_id) DO UPDATE
    SET decision = excluded.decision,
        swap_product_id = excluded.swap_product_id
  RETURNING decision_key, decision, swap_product_id, intake_item_id
    INTO stored_key, stored_decision, stored_swap, stored_item;

  RETURN jsonb_build_object(
    'outcome', 'stored',
    'decision_key', stored_key,
    'decision', stored_decision,
    'swap_product_id', stored_swap,
    'intake_item_id', stored_item
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_admin_set_call_decision(uuid, text, uuid, text, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_admin_set_call_decision(uuid, text, uuid, text, text, text, uuid, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.discovery_admin_set_call_decision(uuid, text, uuid, text, text, text, uuid, jsonb) IS
  'Cockpit keep/swap/drop for one (step, product) until finalised, under the intake row lock: the composed binding is re-checked, drop never empties a step, siblings never share a swap target.';
COMMENT ON TABLE public.discovery_call_decisions IS
  'Nick''s keep/swap/drop outcome per routine step (decision_key) and product (intake_item_id; NULL = the step holds none), written only from the admin cockpit.';
