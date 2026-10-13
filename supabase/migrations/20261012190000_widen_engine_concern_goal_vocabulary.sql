-- NR2/NR3 only, Nick ruling 2026-10-11. No data backfill.
-- Deploy readers before this writer migration. Existing facts/schema/legacy slugs unchanged.
BEGIN;
ALTER TABLE public.hair_profiles
  DROP CONSTRAINT hair_profiles_primary_concern_check;
ALTER TABLE public.hair_profiles
  ADD CONSTRAINT hair_profiles_primary_concern_check CHECK (
    primary_concern IS NULL OR primary_concern IN (
      'hair_loss', 'dandruff', 'dryness', 'oily_scalp', 'hair_damage',
      'split_ends', 'breakage', 'frizz', 'tangling', 'thinning',
      'low_shine', 'lost_shape', 'low_volume_or_weighed_down'
    )
  );
COMMENT ON COLUMN public.hair_profiles.primary_concern IS
  'Her stated main problem in the engine concern vocabulary. NULL = none stated. Always one of concerns; a stale value is dropped by trigger.';

CREATE OR REPLACE FUNCTION public.user_facts_derive_diagnostics_columns_v1(p_diagnostics jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
  c_cuticle CONSTANT jsonb :=
    '{"smooth":"smooth","slightly_uneven":"slightly_rough","rough":"rough"}'::jsonb;
  c_scalp_condition CONSTANT jsonb :=
    '{"irritated":"irritated","oily_dandruff":"dandruff","dry_dandruff":"dry_flakes"}'::jsonb;
  c_scalp_priority CONSTANT text[] := ARRAY['irritated', 'oily_dandruff', 'dry_dandruff'];
  c_chemical CONSTANT jsonb := '{
    "natural":"natural","colored":"colored","lightened":"bleached","permed":"permed",
    "chemically_straightened":"chemically_straightened"}'::jsonb;
  c_concern CONSTANT jsonb := '{
    "hair_damage":"hair_damage","breakage":"breakage","split_ends":"split_ends",
    "dryness":"dryness","dry_lengths":"dryness","frizz":"frizz","frizz_flyaways":"frizz",
    "tangling":"tangling","hair_loss_or_thinning":"hair_loss",
    "low_shine":"low_shine","lost_shape":"lost_shape",
    "low_volume_or_weighed_down":"low_volume_or_weighed_down"}'::jsonb;
  c_goal CONSTANT jsonb := '{
    "moisture":"moisture","frizz_surface":"less_frizz","less_frizz":"less_frizz",
    "shine":"shine","shape_definition":"curl_definition","curl_definition":"curl_definition",
    "strength_ends":"anti_breakage","anti_breakage":"anti_breakage",
    "less_split_ends":"less_split_ends","scalp_balance":"healthy_scalp",
    "healthy_scalp":"healthy_scalp","manageability_styling":"less_frizz","volume":"volume",
    "less_volume":"less_volume","healthier_hair":"healthier_hair",
    "color_protection":"color_protection","strengthen":"strengthen"}'::jsonb;
  v_texture text := p_diagnostics ->> 'texture';
  v_thickness text := p_diagnostics ->> 'thickness';
  v_density text := p_diagnostics ->> 'density';
  v_surface text := p_diagnostics ->> 'hairSurface';
  v_volume_direction text := p_diagnostics ->> 'volumeDirection';
  v_scalp_concern text;
  v_scalp_condition text := NULL;
  v_goals jsonb := '[]'::jsonb;
  v_goal text;
  v_mapped text;
  v_desired_volume text := NULL;
  v_primary_pick text := p_diagnostics ->> 'primaryConcern';
  v_primary_concern text := NULL;
BEGIN
  IF pg_catalog.jsonb_typeof(p_diagnostics -> 'scalpConcerns') = 'array' THEN
    FOREACH v_scalp_concern IN ARRAY c_scalp_priority LOOP
      IF p_diagnostics -> 'scalpConcerns' @> pg_catalog.to_jsonb(v_scalp_concern) THEN
        v_scalp_condition := c_scalp_condition ->> v_scalp_concern;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF pg_catalog.jsonb_typeof(p_diagnostics -> 'goals') = 'array' THEN
    FOR v_goal IN
      SELECT element FROM pg_catalog.jsonb_array_elements_text(p_diagnostics -> 'goals') AS element
    LOOP
      IF v_goal = 'volume_balance' THEN
        IF v_volume_direction = 'more' THEN
          v_mapped := 'volume';
        ELSIF v_volume_direction = 'less' THEN
          v_mapped := 'less_volume';
        ELSIF v_thickness = 'fine' OR v_density = 'low' THEN
          v_mapped := 'volume';
        ELSIF v_thickness = 'coarse' OR v_density = 'high'
              OR v_texture IN ('wavy', 'curly', 'coily') THEN
          v_mapped := 'less_volume';
        ELSE
          v_mapped := 'volume_balance';
        END IF;
      ELSE
        v_mapped := c_goal ->> v_goal;
      END IF;

      IF v_mapped IS NOT NULL AND NOT (v_goals @> pg_catalog.to_jsonb(v_mapped)) THEN
        v_goals := v_goals || pg_catalog.to_jsonb(v_mapped);
      END IF;
    END LOOP;
  END IF;

  IF pg_catalog.jsonb_array_length(v_goals) > 0 THEN
    IF v_goals @> '"volume"'::jsonb THEN
      v_desired_volume := 'more';
    ELSIF v_goals @> '"less_volume"'::jsonb THEN
      v_desired_volume := 'less';
    END IF;
  END IF;

  IF pg_catalog.jsonb_typeof(p_diagnostics -> 'currentConcerns') = 'array'
     AND pg_catalog.jsonb_array_length(p_diagnostics -> 'currentConcerns') > 0 THEN
    IF v_primary_pick IS NOT NULL
       AND p_diagnostics -> 'currentConcerns' @> pg_catalog.to_jsonb(v_primary_pick) THEN
      v_primary_concern := c_concern ->> v_primary_pick;
    ELSIF pg_catalog.jsonb_array_length(p_diagnostics -> 'currentConcerns') = 1 THEN
      v_primary_concern := c_concern ->> (p_diagnostics -> 'currentConcerns' ->> 0);
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'hair_texture', v_texture,
    'thickness', v_thickness,
    'density', v_density,
    'hair_length', p_diagnostics ->> 'hairLength',
    'cuticle_condition', CASE WHEN v_surface IS NULL THEN NULL ELSE c_cuticle ->> v_surface END,
    'protein_moisture_balance', p_diagnostics ->> 'elasticResponse',
    'scalp_type', p_diagnostics ->> 'scalpOiliness',
    'scalp_condition', v_scalp_condition,
    'chemical_treatment',
      COALESCE(
        public.user_facts_map_vocabulary_array_v1(p_diagnostics -> 'chemicalTreatments', c_chemical),
        '[]'::jsonb),
    'concerns',
      COALESCE(
        public.user_facts_map_vocabulary_array_v1(p_diagnostics -> 'currentConcerns', c_concern),
        '[]'::jsonb),
    'goals', v_goals,
    'desired_volume', v_desired_volume,
    'primary_concern', v_primary_concern
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_facts_derive_diagnostics_columns_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
