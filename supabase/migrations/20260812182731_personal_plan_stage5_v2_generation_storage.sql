ALTER TABLE public.application_guidance_protocols
  ADD COLUMN contract_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT application_guidance_protocols_contract_version_check
    CHECK (contract_version IN (1, 2));

ALTER TABLE public.product_application_protocols
  ADD COLUMN guidance_payload_v2 jsonb,
  ADD CONSTRAINT product_application_protocols_guidance_payload_v2_check
    CHECK (
      guidance_payload_v2 IS NULL
      OR (
        pg_catalog.jsonb_typeof(guidance_payload_v2) = 'object'
        AND guidance_payload_v2->>'schemaVersion' = '2'
        AND pg_catalog.octet_length(guidance_payload_v2::text) <= 524288
      )
    );
