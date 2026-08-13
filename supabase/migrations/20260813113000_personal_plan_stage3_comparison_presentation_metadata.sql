-- Presentation-only catalog facts for Stage 3 comparison cards. These nullable
-- values are intentionally outside every fit, ranking, and decision contract.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS net_content_value numeric,
  ADD COLUMN IF NOT EXISTS net_content_unit text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_net_content_value_check,
  ADD CONSTRAINT products_net_content_value_check
    CHECK (net_content_value IS NULL OR net_content_value > 0),
  DROP CONSTRAINT IF EXISTS products_net_content_unit_check,
  ADD CONSTRAINT products_net_content_unit_check
    CHECK (net_content_unit IS NULL OR net_content_unit IN ('ml', 'g')),
  DROP CONSTRAINT IF EXISTS products_net_content_pair_check,
  ADD CONSTRAINT products_net_content_pair_check
    CHECK ((net_content_value IS NULL) = (net_content_unit IS NULL));

-- Each identity is asserted alongside its ID so a changed catalog row cannot
-- silently receive a size intended for another product.
UPDATE public.products
SET net_content_value = payload.net_content_value,
    net_content_unit = payload.net_content_unit
FROM (
  VALUES
    ('e1ad37be-9330-49b4-8add-872a30324122'::uuid, 'Jean&Len Conditioner Keratin/Mandel'::text, 300::numeric, 'ml'::text),
    ('63239c38-5633-4062-9e8d-d528ee71502a'::uuid, 'Bali Curls Moisturising Conditioner'::text, 250::numeric, 'ml'::text),
    ('5516009a-eecb-42dd-87f6-07c560161136'::uuid, 'Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung'::text, 400::numeric, 'ml'::text)
) AS payload(id, expected_name, net_content_value, net_content_unit)
WHERE products.id = payload.id
  AND products.name = payload.expected_name
  AND products.net_content_value IS NULL
  AND products.net_content_unit IS NULL;

-- Preserve the existing canonical-guidance approval flow and apply only the
-- new nullable presentation fields after it returns the authoritative product.
ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  RENAME TO product_intake_approve_reviewed_product_before_net_content;

CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product(
  p_submission_id uuid,
  p_final_payload jsonb,
  p_spec_operations jsonb,
  p_reviewed_by text,
  p_reviewed_at timestamptz DEFAULT now(),
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  approval_result jsonb;
  approved_product_id uuid;
BEGIN
  approval_result := public.product_intake_approve_reviewed_product_before_net_content(
    p_submission_id, p_final_payload, p_spec_operations, p_reviewed_by, p_reviewed_at, p_review_notes
  );
  approved_product_id := (approval_result->>'product_id')::uuid;

  UPDATE public.products
  SET net_content_value = NULLIF(p_final_payload#>>'{product,net_content_value}', '')::numeric,
      net_content_unit = NULLIF(p_final_payload#>>'{product,net_content_unit}', '')
  WHERE id = approved_product_id;

  RETURN approval_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_before_net_content(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;
