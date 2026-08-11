-- Expand the exact product protocol authority from its original Heat/Scalp
-- launch slice to every reviewed Personal Plan product role. The canonical
-- Stage-5 payload stays versioned and app-validated; indexed columns remain
-- available to Stage 3 for deterministic protocol completeness checks.

ALTER TABLE public.product_application_protocols
  DROP CONSTRAINT product_application_protocols_role_category_check,
  DROP CONSTRAINT product_application_protocols_role_check;

ALTER TABLE public.product_application_protocols
  ADD COLUMN guidance_payload jsonb,
  ADD CONSTRAINT product_application_protocols_guidance_payload_object_check
    CHECK (guidance_payload IS NULL OR jsonb_typeof(guidance_payload) = 'object'),
  ADD CONSTRAINT product_application_protocols_role_check CHECK (
    role IN (
      'shampoo_everyday',
      'shampoo_dandruff',
      'conditioner_rinse_out',
      'post_wash_leave_in',
      'intensive_conditioning_mask',
      'pre_wash_fibre_treatment',
      'leave_on_fibre_conditioning',
      'dry_finish',
      'residue_reset',
      'mineral_reset',
      'root_refresh_bridge',
      'pre_heat_protection',
      'specialized_bond_treatment',
      'scalp_comfort',
      'scalp_flake_oil_adjunct',
      'density_claim_tonic',
      'scalp_exfoliant'
    )
  ),
  ADD CONSTRAINT product_application_protocols_role_category_check CHECK (
    (category = 'shampoo' AND role IN ('shampoo_everyday', 'shampoo_dandruff'))
    OR (category = 'conditioner' AND role = 'conditioner_rinse_out')
    OR (category = 'leave_in' AND role IN ('post_wash_leave_in', 'pre_heat_protection'))
    OR (category = 'mask' AND role = 'intensive_conditioning_mask')
    OR (category = 'oil' AND role IN ('pre_wash_fibre_treatment', 'leave_on_fibre_conditioning', 'dry_finish', 'pre_heat_protection'))
    OR (category = 'heat_protectant' AND role = 'pre_heat_protection')
    OR (category = 'bondbuilder' AND role = 'specialized_bond_treatment')
    OR (category = 'deep_cleansing_shampoo' AND role IN ('residue_reset', 'mineral_reset'))
    OR (category = 'dry_shampoo' AND role = 'root_refresh_bridge')
    OR (category = 'scalp_care' AND role IN ('scalp_comfort', 'scalp_flake_oil_adjunct', 'density_claim_tonic', 'scalp_exfoliant'))
  ),
  ADD CONSTRAINT product_application_protocols_exact_guidance_check CHECK (
    role IN (
      'pre_heat_protection',
      'scalp_comfort',
      'scalp_flake_oil_adjunct',
      'density_claim_tonic',
      'scalp_exfoliant'
    )
    OR guidance_payload IS NOT NULL
  );

COMMENT ON COLUMN public.product_application_protocols.guidance_payload IS
  'Canonical ApplicationGuidanceProtocolV1 payload. Required for exact protocols added after the original Heat/Scalp launch slice.';
