-- The indexed protocol columns application_stage, placement, and rinse_action
-- hold machine enum codes (e.g. 'wet_cleanse', 'all_hair', 'rinse_out');
-- user-facing prose belongs in the guidance payload copy. German prose landed
-- in these columns once (repaired by the preceding migration), so enforce the
-- snake_case code format at the storage boundary. The exact vocabularies are
-- still evolving per category, so this deliberately checks format, not an
-- enumerated value list. Mirrored in code by nullableProtocolIndexCode in
-- src/lib/product-intake/category-validators.ts.
ALTER TABLE public.product_application_protocols
  ADD CONSTRAINT product_application_protocols_stage_code_format_check
    CHECK (application_stage IS NULL OR application_stage ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  ADD CONSTRAINT product_application_protocols_placement_code_format_check
    CHECK (placement IS NULL OR placement ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  ADD CONSTRAINT product_application_protocols_rinse_action_code_format_check
    CHECK (rinse_action IS NULL OR rinse_action ~ '^[a-z0-9]+(_[a-z0-9]+)*$');
