-- Version the two ordinary wash-family protocols so the same accepted
-- Shampoo/Conditioner can participate in the already-canonical composite day
-- types. Active application content is immutable, so retire V1 and insert V2
-- instead of rewriting reviewed payloads in place.

UPDATE public.application_guidance_protocols
SET status = 'retired'
WHERE id IN (
  'ed16ed9e-83e0-4e44-b3c7-5e1486e3af01'::uuid,
  '384f2d0e-13e2-4151-bceb-d8757e1c8c02'::uuid
)
  AND protocol_version = 1
  AND locale = 'de'
  AND status = 'active';

INSERT INTO public.application_guidance_protocols (
  id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
  product_id, application_family, payload, status, verified_at
) VALUES
  (
    'bd8fb861-40d9-41e2-ad69-2116970e5785',
    'shampoo-standard-rinse-out-cleanse', 2, 'de',
    'application_family', 'shampoo', 'cleanse', NULL, 'standard_rinse_out_cleanse',
    '{"schemaVersion":1,"guidanceKey":"shampoo-standard-rinse-out-cleanse","protocolVersion":2,"locale":"de","scope":{"kind":"application_family","category":"shampoo"},"role":"cleanse","applicationFamily":"standard_rinse_out_cleanse","compatibleDayTypes":["wash_day","intensive_care_day","bond_repair_day"],"exactGuidanceRequired":false,"sequence":{"anchor":"wet_cleanse","before":[],"after":[],"conflictsWith":[]},"requirements":{"requiredCatalogFacts":[],"requiredProtocolFacts":[],"requiredProfileFacts":[]},"protocolFacts":{"applicationArea":"scalp_roots","rinse":"rinse_out","contactTimeSeconds":null,"conditionerRelationship":"not_applicable","reapplication":"none","amount":{"kind":"qualitative","copyDe":"Eine kleine Menge verwenden."},"cautions":[]},"steps":[{"stepKey":"cleanse","action":"apply_product","copyTemplateDe":"Auf die nasse Kopfhaut geben und sanft einmassieren."},{"stepKey":"rinse","action":"rinse","copyTemplateDe":"Gründlich ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/shampoo-conditioner","sourceType":"professional_authority","checkedAt":"2026-08-08"}]}'::jsonb,
    'active', '2026-08-10T00:00:00Z'
  ),
  (
    '1b9bafd0-2583-41cc-961c-318db4fd3d65',
    'conditioner-standard-rinse-out-conditioning', 2, 'de',
    'application_family', 'conditioner', 'condition', NULL, 'standard_rinse_out_conditioning',
    '{"schemaVersion":1,"guidanceKey":"conditioner-standard-rinse-out-conditioning","protocolVersion":2,"locale":"de","scope":{"kind":"application_family","category":"conditioner"},"role":"condition","applicationFamily":"standard_rinse_out_conditioning","compatibleDayTypes":["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"],"exactGuidanceRequired":false,"sequence":{"anchor":"post_cleanse_rinse_off","before":[],"after":[],"conflictsWith":[]},"requirements":{"requiredCatalogFacts":[],"requiredProtocolFacts":[],"requiredProfileFacts":[]},"protocolFacts":{"applicationArea":"lengths_ends","rinse":"rinse_out","contactTimeSeconds":null,"conditionerRelationship":"not_applicable","reapplication":"none","amount":{"kind":"qualitative","copyDe":"Sparsam in Längen und Spitzen verteilen."},"cautions":[]},"steps":[{"stepKey":"condition","action":"apply_product","copyTemplateDe":"In Längen und Spitzen verteilen."},{"stepKey":"rinse","action":"rinse","copyTemplateDe":"Gründlich ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/shampoo-conditioner","sourceType":"professional_authority","checkedAt":"2026-08-08"}]}'::jsonb,
    'active', '2026-08-10T00:00:00Z'
  );
