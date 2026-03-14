-- Secure leave-in eligibility helpers after initial rollout.
-- 1) Enable RLS on the derived eligibility table.
-- 2) Pin the helper function search_path.

ALTER TABLE public.product_leave_in_eligibility ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.expand_leave_in_eligibility(
  p_thicknesses text[],
  p_roles text[],
  p_care_benefits text[],
  p_application_stage text[],
  p_provides_heat_protection boolean,
  p_heat_activation_required boolean
)
RETURNS TABLE(
  thickness text,
  need_bucket text,
  styling_context text
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  t text;
  bucket text;
  context text;
  buckets text[] := ARRAY[]::text[];
  contexts text[] := ARRAY[]::text[];
BEGIN
  IF p_heat_activation_required OR p_provides_heat_protection THEN
    buckets := array_append(buckets, 'heat_protect');
  END IF;

  IF 'curl_definition' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'curl_definition');
  END IF;

  IF
    'repair' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'protein' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'repair');
  END IF;

  IF
    'moisture' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'anti_frizz' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'detangling' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'moisture_anti_frizz');
  END IF;

  IF 'shine' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'shine_protect');
  END IF;

  IF p_heat_activation_required THEN
    contexts := ARRAY['heat_style'];
  ELSE
    IF
      p_provides_heat_protection
      OR 'pre_heat' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'heat_style');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'air_dry');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'post_style' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'styling_prep' = ANY(COALESCE(p_roles, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'non_heat_style');
    END IF;
  END IF;

  IF array_length(contexts, 1) IS NULL THEN
    contexts := ARRAY['air_dry', 'non_heat_style'];
  END IF;

  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    FOREACH bucket IN ARRAY buckets LOOP
      IF bucket = 'heat_protect' THEN
        thickness := t;
        need_bucket := bucket;
        styling_context := 'heat_style';
        RETURN NEXT;
        CONTINUE;
      END IF;

      FOREACH context IN ARRAY contexts LOOP
        IF context = 'heat_style' THEN
          CONTINUE;
        END IF;

        thickness := t;
        need_bucket := bucket;
        styling_context := context;
        RETURN NEXT;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$function$;
