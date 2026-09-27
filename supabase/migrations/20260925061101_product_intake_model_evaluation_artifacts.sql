-- Additive, service-role-only artifacts for the bounded Product Intake model evaluation.
-- These rows are telemetry and draft evidence only; they do not alter publication access.

ALTER TABLE public.product_intake_research_artifacts
  DROP CONSTRAINT IF EXISTS product_intake_research_artifacts_kind_check;

ALTER TABLE public.product_intake_research_artifacts
  ADD CONSTRAINT product_intake_research_artifacts_kind_check CHECK (
    kind IN (
      'identity_candidate',
      'existing_product_match',
      'source_page',
      'property_extract',
      'property_synthesis',
      'image_candidate',
      'image_judgment',
      'processed_image',
      'publication_preview',
      'publish_result',
      'model_run',
      'model_judgment'
    )
  );
