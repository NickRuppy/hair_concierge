-- Canonical, versioned Stage-5 content. This migration deliberately contains no
-- user-specific application state; accepted Routine ownership remains a later
-- server-resolver concern.

CREATE TABLE public.application_day_type_definitions (
  day_type_key text NOT NULL,
  definition_version integer NOT NULL CHECK (definition_version > 0),
  locale text NOT NULL DEFAULT 'de' CHECK (locale = 'de'),
  label text NOT NULL CHECK (length(trim(label)) > 0),
  summary text NOT NULL CHECK (length(trim(summary)) > 0),
  sort_order integer NOT NULL CHECK (sort_order > 0),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day_type_key, definition_version, locale)
);

CREATE UNIQUE INDEX application_day_type_definitions_one_active_per_key_locale
  ON public.application_day_type_definitions (day_type_key, locale)
  WHERE status = 'active';

CREATE INDEX application_day_type_definitions_active_locale_sort_order_idx
  ON public.application_day_type_definitions (locale, sort_order)
  WHERE status = 'active';

CREATE TABLE public.application_guidance_protocols (
  id uuid PRIMARY KEY,
  guidance_key text NOT NULL CHECK (length(trim(guidance_key)) > 0),
  protocol_version integer NOT NULL CHECK (protocol_version > 0),
  locale text NOT NULL DEFAULT 'de' CHECK (locale = 'de'),
  scope_kind text NOT NULL CHECK (scope_kind IN ('application_family', 'product')),
  category_key text NOT NULL CHECK (length(trim(category_key)) > 0),
  role_key text,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  application_family text NOT NULL CHECK (length(trim(application_family)) > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_guidance_protocols_scope_product_check CHECK (
    (scope_kind = 'product' AND product_id IS NOT NULL)
    OR (scope_kind = 'application_family' AND product_id IS NULL)
  ),
  CONSTRAINT application_guidance_protocols_active_verified_check CHECK (
    status <> 'active' OR verified_at IS NOT NULL
  ),
  CONSTRAINT application_guidance_protocols_key_version_locale_unique
    UNIQUE (guidance_key, protocol_version, locale)
);

CREATE UNIQUE INDEX application_guidance_protocols_one_active_per_key_locale
  ON public.application_guidance_protocols (guidance_key, locale)
  WHERE status = 'active';

CREATE INDEX application_guidance_protocols_active_locale_key_idx
  ON public.application_guidance_protocols (locale, guidance_key)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.reject_active_application_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    RAISE EXCEPTION 'active application content must be retired, not deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    IF NEW.status <> 'retired'
      OR (to_jsonb(NEW) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION 'active application content is immutable; only active-to-retired is allowed';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER application_day_type_definitions_active_immutable
  BEFORE UPDATE OR DELETE ON public.application_day_type_definitions
  FOR EACH ROW EXECUTE FUNCTION public.reject_active_application_content_mutation();

CREATE TRIGGER application_guidance_protocols_active_immutable
  BEFORE UPDATE OR DELETE ON public.application_guidance_protocols
  FOR EACH ROW EXECUTE FUNCTION public.reject_active_application_content_mutation();

INSERT INTO public.application_day_type_definitions (
  day_type_key, definition_version, locale, label, summary, sort_order, status
) VALUES
  ('wash_day', 1, 'de', 'Waschtag', 'Deine vollständige Basiswäsche.', 10, 'active'),
  ('intensive_care_day', 1, 'de', 'Intensiv-Pflegetag', 'Wäsche mit deiner abgestimmten Intensivpflege.', 20, 'active'),
  ('bond_repair_day', 1, 'de', 'Bond-Repair-Tag', 'Deine vollständige Bond-Repair-Anwendung.', 30, 'active'),
  ('clarifying_wash_day', 1, 'de', 'Klär-Waschtag', 'Deine klärende Wäsche mit passender Nachpflege.', 40, 'active'),
  ('refresh_day', 1, 'de', 'Auffrisch-Tag', 'Frische deinen Ansatz oder deine Längen gezielt auf.', 50, 'active'),
  ('between_wash_care_day', 1, 'de', 'Pflegetag ohne Wäsche', 'Pflege deine trockenen Längen zwischen den Wäschen.', 60, 'active'),
  ('styling_day', 1, 'de', 'Styling-Tag', 'Schütze und style dein Haar passend zu deinem Werkzeug.', 70, 'active'),
  ('rest_day', 1, 'de', 'Pausentag', 'An einem Pausentag ist keine Anwendung nötig.', 80, 'active');

-- The family baselines intentionally contain application protocol facts only.
-- Existing catalog/spec tables remain the authority for product facts.
INSERT INTO public.application_guidance_protocols (
  id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
  product_id, application_family, payload, status, verified_at
) VALUES
  (
    'ed16ed9e-83e0-4e44-b3c7-5e1486e3af01', 'shampoo-standard-rinse-out-cleanse', 1, 'de',
    'application_family', 'shampoo', 'cleanse', NULL, 'standard_rinse_out_cleanse',
    '{"schemaVersion":1,"guidanceKey":"shampoo-standard-rinse-out-cleanse","protocolVersion":1,"locale":"de","scope":{"kind":"application_family","category":"shampoo"},"role":"cleanse","applicationFamily":"standard_rinse_out_cleanse","compatibleDayTypes":["wash_day"],"exactGuidanceRequired":false,"sequence":{"anchor":"wet_cleanse","before":[],"after":[],"conflictsWith":[]},"requirements":{"requiredCatalogFacts":[],"requiredProtocolFacts":[],"requiredProfileFacts":[]},"protocolFacts":{"applicationArea":"scalp_roots","rinse":"rinse_out","contactTimeSeconds":null,"conditionerRelationship":"not_applicable","reapplication":"none","amount":{"kind":"qualitative","copyDe":"Eine kleine Menge verwenden."},"cautions":[]},"steps":[{"stepKey":"cleanse","action":"apply_product","copyTemplateDe":"Auf die nasse Kopfhaut geben und sanft einmassieren."},{"stepKey":"rinse","action":"rinse","copyTemplateDe":"Gründlich ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/shampoo-conditioner","sourceType":"professional_authority","checkedAt":"2026-08-08"}]}'::jsonb,
    'active', '2026-08-08T00:00:00Z'
  ),
  (
    '384f2d0e-13e2-4151-bceb-d8757e1c8c02', 'conditioner-standard-rinse-out-conditioning', 1, 'de',
    'application_family', 'conditioner', 'condition', NULL, 'standard_rinse_out_conditioning',
    '{"schemaVersion":1,"guidanceKey":"conditioner-standard-rinse-out-conditioning","protocolVersion":1,"locale":"de","scope":{"kind":"application_family","category":"conditioner"},"role":"condition","applicationFamily":"standard_rinse_out_conditioning","compatibleDayTypes":["wash_day"],"exactGuidanceRequired":false,"sequence":{"anchor":"post_cleanse_rinse_off","before":[],"after":[],"conflictsWith":[]},"requirements":{"requiredCatalogFacts":[],"requiredProtocolFacts":[],"requiredProfileFacts":[]},"protocolFacts":{"applicationArea":"lengths_ends","rinse":"rinse_out","contactTimeSeconds":null,"conditionerRelationship":"not_applicable","reapplication":"none","amount":{"kind":"qualitative","copyDe":"Sparsam in Längen und Spitzen verteilen."},"cautions":[]},"steps":[{"stepKey":"condition","action":"apply_product","copyTemplateDe":"In Längen und Spitzen verteilen."},{"stepKey":"rinse","action":"rinse","copyTemplateDe":"Gründlich ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/shampoo-conditioner","sourceType":"professional_authority","checkedAt":"2026-08-08"}]}'::jsonb,
    'active', '2026-08-08T00:00:00Z'
  ),
  (
    'cc85928b-9ca5-421b-a455-0943736f8b03', 'leave-in-post-wash-booster', 1, 'de',
    'application_family', 'leave_in', 'leave_in', NULL, 'post_wash_booster',
    '{"schemaVersion":1,"guidanceKey":"leave-in-post-wash-booster","protocolVersion":1,"locale":"de","scope":{"kind":"application_family","category":"leave_in"},"role":"leave_in","applicationFamily":"post_wash_booster","compatibleDayTypes":["wash_day","intensive_care_day"],"exactGuidanceRequired":false,"sequence":{"anchor":"damp_leave_on","before":[],"after":[],"conflictsWith":[]},"requirements":{"requiredCatalogFacts":[],"requiredProtocolFacts":[],"requiredProfileFacts":[]},"protocolFacts":{"applicationArea":"lengths_ends","rinse":"leave_in","contactTimeSeconds":null,"conditionerRelationship":"not_applicable","reapplication":"none","amount":{"kind":"qualitative","copyDe":"Eine kleine Menge in das handtuchtrockene Haar geben."},"cautions":[]},"steps":[{"stepKey":"apply","action":"apply_product","copyTemplateDe":"Gleichmäßig in Längen und Spitzen verteilen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/shampoo-conditioner","sourceType":"professional_authority","checkedAt":"2026-08-08"}]}'::jsonb,
    'active', '2026-08-08T00:00:00Z'
  );

ALTER TABLE public.application_day_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_guidance_protocols ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.application_day_type_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.application_guidance_protocols FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.application_day_type_definitions FROM service_role;
REVOKE ALL ON TABLE public.application_guidance_protocols FROM service_role;
GRANT SELECT ON TABLE public.application_day_type_definitions TO service_role;
GRANT SELECT ON TABLE public.application_guidance_protocols TO service_role;

REVOKE ALL ON FUNCTION public.reject_active_application_content_mutation() FROM PUBLIC, anon, authenticated;
