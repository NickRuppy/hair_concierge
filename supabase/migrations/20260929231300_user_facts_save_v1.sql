-- Central user profile, PR1 task 3 (3/3): `public.user_facts_save_v1`, the ONE
-- function that may write the fact domains on `hair_profiles`.
--
-- Everything the program needs to be atomic happens in this single statement:
-- field-level merge of the patch into the domain document, the provenance
-- merge, the revision bump used as a CAS token, and the recomputation of the
-- narrow legacy columns the domain owns. Doing the derivation HERE rather than
-- in the caller is what makes a stale read harmless: the columns can only ever
-- be a function of the domain document that was just written under the row
-- lock.
--
-- The derivation is a second implementation of
-- `src/lib/user-facts/derive-legacy-columns.ts` (the specification oracle) and
-- of the vocabulary tables in `src/lib/user-facts/legacy-vocabulary.ts` /
-- `src/lib/quiz/normalization.ts`. That duplication is deliberate — the columns
-- must stay correct for writers that never go through TypeScript (backfills,
-- SQL repairs) — and `tests/user-facts-derive-parity.test.ts` is the drift
-- guard: every fixture row is written through this function on a real Postgres
-- and compared against the TypeScript oracle.
--
-- Lock order, for anyone adding a second writer: refinement draft FIRST, then
-- `hair_profiles`. Every path here takes the locks in that order.

-- ---------------------------------------------------------------------------
-- Small pure helpers. Internal to this function: REVOKEd from every role
-- (including service_role) at the bottom — `user_facts_save_v1` is SECURITY
-- DEFINER and calls them as the owner.
-- ---------------------------------------------------------------------------

-- jsonb array -> text[]; anything that is not a JSON array (absent key, JSON
-- null) becomes SQL NULL. This is the "absent -> NULL, [] -> []" distinction
-- the whole derivation rests on.
CREATE OR REPLACE FUNCTION public.user_facts_jsonb_text_array_v1(p_value jsonb)
RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN pg_catalog.jsonb_typeof(p_value) = 'array'
      THEN ARRAY(SELECT element FROM pg_catalog.jsonb_array_elements_text(p_value) AS element)
    ELSE NULL
  END
$$;

-- `mapVocabularyArray` (derive-legacy-columns.ts:60-77): map every value,
-- preserve input order, drop unmapped values, dedupe on the MAPPED value with
-- first occurrence winning. Non-array input -> NULL.
CREATE OR REPLACE FUNCTION public.user_facts_map_vocabulary_array_v1(p_values jsonb, p_map jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN pg_catalog.jsonb_typeof(p_values) IS DISTINCT FROM 'array' THEN NULL
    ELSE COALESCE(
      (
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(deduped.mapped) ORDER BY deduped.first_position)
          FROM (
            SELECT p_map ->> source.value AS mapped,
                   pg_catalog.min(source.ordinal) AS first_position
              FROM pg_catalog.jsonb_array_elements_text(p_values)
                   WITH ORDINALITY AS source(value, ordinal)
             WHERE p_map ? source.value
             GROUP BY p_map ->> source.value
          ) AS deduped
      ),
      '[]'::jsonb
    )
  END
$$;

-- Union of two `preservedCandidates` lists, deduped on kind+id, old entries
-- first, first occurrence winning. NULL when neither side has any.
CREATE OR REPLACE FUNCTION public.user_facts_union_preserved_candidates_v1(p_old jsonb, p_new jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN pg_catalog.jsonb_typeof(p_old) IS DISTINCT FROM 'array'
         AND pg_catalog.jsonb_typeof(p_new) IS DISTINCT FROM 'array'
      THEN NULL
    ELSE (
      SELECT pg_catalog.jsonb_agg(deduped.entry ORDER BY deduped.first_position)
        FROM (
          SELECT (pg_catalog.array_agg(candidate.entry ORDER BY candidate.position))[1] AS entry,
                 pg_catalog.min(candidate.position) AS first_position
            FROM (
              SELECT old.value AS entry, old.ordinal AS position
                FROM pg_catalog.jsonb_array_elements(
                       CASE WHEN pg_catalog.jsonb_typeof(p_old) = 'array' THEN p_old ELSE '[]'::jsonb END
                     ) WITH ORDINALITY AS old(value, ordinal)
              UNION ALL
              -- Offset keeps every incoming entry strictly after every existing
              -- one, so "old first, first occurrence wins" holds across the union.
              SELECT incoming.value, 1000000 + incoming.ordinal
                FROM pg_catalog.jsonb_array_elements(
                       CASE WHEN pg_catalog.jsonb_typeof(p_new) = 'array' THEN p_new ELSE '[]'::jsonb END
                     ) WITH ORDINALITY AS incoming(value, ordinal)
            ) AS candidate
           GROUP BY candidate.entry ->> 'kind', candidate.entry ->> 'id'
        ) AS deduped
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.user_facts_diagnostics_hash_v1(p_diagnostics jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_diagnostics IS NULL THEN NULL
    ELSE pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_diagnostics::pg_catalog.text, 'utf8')), 'hex')
  END
$$;

-- ---------------------------------------------------------------------------
-- Derivation: diagnostics -> its 13 legacy columns.
-- Mirrors `deriveDiagnosticsColumns` (derive-legacy-columns.ts:79-146).
-- Returns a jsonb object with all 13 keys always present; a JSON null means the
-- column is SQL NULL — EXCEPT `chemical_treatment`/`concerns`/`goals`, which are
-- always a jsonb array (possibly empty) and never JSON null (controller ruling
-- 2026-09-15, task-2-3-amendment-brief.md: legacy readers rely on the historical
-- NOT NULL DEFAULT '{}' contract for these three columns).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_facts_derive_diagnostics_columns_v1(p_diagnostics jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
  -- legacy-vocabulary.ts:HAIR_SURFACE_TO_CUTICLE_CONDITION
  c_cuticle CONSTANT jsonb :=
    '{"smooth":"smooth","slightly_uneven":"slightly_rough","rough":"rough"}'::jsonb;
  -- legacy-vocabulary.ts:SCALP_CONCERN_TO_SCALP_CONDITION + SCALP_CONCERN_PRIORITY
  c_scalp_condition CONSTANT jsonb :=
    '{"irritated":"irritated","oily_dandruff":"dandruff","dry_dandruff":"dry_flakes"}'::jsonb;
  c_scalp_priority CONSTANT text[] := ARRAY['irritated', 'oily_dandruff', 'dry_dandruff'];
  -- legacy-vocabulary.ts:CHEMICAL_TREATMENT_TO_COLUMN
  c_chemical CONSTANT jsonb := '{
    "natural":"natural","colored":"colored","lightened":"bleached","permed":"permed",
    "chemically_straightened":"chemically_straightened"}'::jsonb;
  -- normalization.ts:CONCERN_TO_PROFILE_CONCERN_MAP
  c_concern CONSTANT jsonb := '{
    "hair_damage":"hair_damage","breakage":"breakage","split_ends":"split_ends",
    "dryness":"dryness","dry_lengths":"dryness","frizz":"frizz","frizz_flyaways":"frizz",
    "tangling":"tangling","hair_loss_or_thinning":"hair_loss"}'::jsonb;
  -- normalization.ts:GOAL_TO_PROFILE_GOAL_MAP
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
  -- Controller ruling 2026-09-15 (task-2-3-amendment-brief.md): chemical_treatment/
  -- concerns/goals project as '{}', never NULL, when the underlying fact is
  -- absent (legacy readers rely on the historical NOT NULL DEFAULT '{}'
  -- contract). Initialized to '[]' rather than NULL so the absent case (the
  -- loop below never runs) already yields the right value.
  v_goals jsonb := '[]'::jsonb;
  v_goal text;
  v_mapped text;
  v_desired_volume text := NULL;
  v_primary_pick text := p_diagnostics ->> 'primaryConcern';
  v_primary_concern text := NULL;
BEGIN
  -- `deriveScalpCondition`: a priority pick, not a mapping of the whole list.
  IF pg_catalog.jsonb_typeof(p_diagnostics -> 'scalpConcerns') = 'array' THEN
    FOREACH v_scalp_concern IN ARRAY c_scalp_priority LOOP
      IF p_diagnostics -> 'scalpConcerns' @> pg_catalog.to_jsonb(v_scalp_concern) THEN
        v_scalp_condition := c_scalp_condition ->> v_scalp_concern;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- `deriveGoals`: like mapVocabularyArray, except that `volume_balance`
  -- follows `deriveVolumeBalanceGoal`: a stored `volumeDirection` (migration
  -- table M — only the legacy-columns backfill sets one) keeps the profile's
  -- direction; otherwise it resolves through `resolveVolumeBalanceGoal`
  -- (normalization.ts:300-315) against this document's own
  -- thickness/density/texture.
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
          v_mapped := NULL;
        END IF;
      ELSE
        v_mapped := c_goal ->> v_goal;
      END IF;

      IF v_mapped IS NOT NULL AND NOT (v_goals @> pg_catalog.to_jsonb(v_mapped)) THEN
        v_goals := v_goals || pg_catalog.to_jsonb(v_mapped);
      END IF;
    END LOOP;
  END IF;

  -- `deriveDesiredVolumeFromGoals(goals, null)` (hair-profile/derived.ts:70-80):
  -- reads the DERIVED goals column, never the raw answers, and "volume" wins
  -- when both directions somehow survive.
  IF pg_catalog.jsonb_array_length(v_goals) > 0 THEN
    IF v_goals @> '"volume"'::jsonb THEN
      v_desired_volume := 'more';
    ELSIF v_goals @> '"less_volume"'::jsonb THEN
      v_desired_volume := 'less';
    END IF;
  END IF;

  -- `derivePrimaryConcern` (main #611, F1): the explicit pick while it is one of
  -- currentConcerns, else her only concern, else NULL — in the `concerns` column
  -- vocabulary (NULL when it has no legacy equivalent).
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
    -- Controller ruling 2026-09-15: absent -> '[]', not NULL (legacy NOT NULL
    -- DEFAULT '{}' contract) — the shared helper returns NULL for a non-array
    -- input, so these two call sites override it, mirroring the TS oracle's
    -- `?? []`.
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

-- ---------------------------------------------------------------------------
-- Derivation: care_habits -> its 8 legacy columns.
-- Mirrors `deriveCareHabitsColumns` (derive-legacy-columns.ts:148-224).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_facts_derive_care_habits_columns_v1(p_care_habits jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
  -- legacy-vocabulary.ts:DRYING_ROUTE_TO_DRYING_METHOD + deriveDryingMethod's priority
  c_drying_priority CONSTANT text[] :=
    ARRAY['diffuser_or_airflow_shaping', 'ordinary_blow_dry', 'air_dry'];
  c_drying_method CONSTANT jsonb := '{
    "air_dry":"air_dry","ordinary_blow_dry":"blow_dry",
    "diffuser_or_airflow_shaping":"blow_dry_diffuser"}'::jsonb;
  -- refinement/types.ts:STAGE2_HEAT_EVENT_SOURCES — the CANONICAL emission order
  -- for styling_tools (task-2 rule 11, amended 2026-09-15): the projection must
  -- not depend on the order the user clicked things in.
  c_heat_sources CONSTANT text[] := ARRAY[
    'ordinary_blow_dry', 'diffuser_airflow_shaping', 'dryer_brush', 'hot_air_styler',
    'straightener', 'curling_or_wave_iron', 'thermal_rollers'];
  -- legacy-vocabulary.ts:HEAT_SOURCE_TO_STYLING_TOOL
  c_styling_tool CONSTANT jsonb := '{
    "ordinary_blow_dry":"blow_dryer","diffuser_airflow_shaping":"diffuser",
    "diffuser_or_airflow_shaping":"diffuser","dryer_brush":"hot_air_brush",
    "hot_air_styler":"multi_tool","straightener":"flat_iron",
    "curling_or_wave_iron":"curling_iron","thermal_rollers":"thermal_rollers"}'::jsonb;
  -- frequencies.ts:PRODUCT_FREQUENCIES, ascending — position IS the sortOrder
  -- `chooseHigherProductFrequency` compares on.
  c_frequency_order CONSTANT text[] := ARRAY[
    'less_than_monthly', 'monthly_1x', 'biweekly_1x', 'weekly_1x', 'weekly_2x',
    'weekly_3_4x', 'weekly_5_6x', 'daily_1x'];
  -- legacy-vocabulary.ts:PRODUCT_FREQUENCY_TO_HEAT_STYLING
  c_heat_styling CONSTANT jsonb := '{
    "daily_1x":"daily","weekly_5_6x":"several_weekly","weekly_3_4x":"several_weekly",
    "weekly_2x":"several_weekly","weekly_1x":"once_weekly","biweekly_1x":"rarely",
    "monthly_1x":"rarely","less_than_monthly":"rarely"}'::jsonb;
  v_drying_routes jsonb := p_care_habits -> 'dryingRoutes';
  v_additional jsonb := p_care_habits -> 'additionalHeatTools';
  v_heat_events jsonb;
  v_route text;
  v_source text;
  v_selected text[] := ARRAY[]::text[];
  v_selected_json jsonb;
  v_event jsonb;
  v_frequency text;
  v_protection text;
  v_frequency_rank integer;
  v_best_rank integer := NULL;
  v_protection_count integer := 0;
  v_all_always boolean := true;
  v_drying_method text := NULL;
  v_heat_styling text := NULL;
  v_styling_tools jsonb := NULL;
  v_uses_heat_protection boolean := false;
BEGIN
  -- `deriveDryingMethod`: a priority pick over the selected routes.
  IF pg_catalog.jsonb_typeof(v_drying_routes) = 'array' THEN
    FOREACH v_route IN ARRAY c_drying_priority LOOP
      IF v_drying_routes @> pg_catalog.to_jsonb(v_route) THEN
        v_drying_method := c_drying_method ->> v_route;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- `deriveHeatColumns`. Both question groups unanswered is NOT the same as
  -- "answered with nothing": the former leaves the columns unknown, the latter
  -- is a real "never".
  IF pg_catalog.jsonb_typeof(v_drying_routes) IS DISTINCT FROM 'array'
     AND pg_catalog.jsonb_typeof(v_additional) IS DISTINCT FROM 'array' THEN
    v_heat_styling := NULL;
    v_styling_tools := NULL;
    v_uses_heat_protection := false;
  ELSE
    -- `getSelectedStage2HeatEventSources` (heat-events.ts:31-44), walked in
    -- canonical order so the result is a function of the SET, not of click order.
    FOREACH v_source IN ARRAY c_heat_sources LOOP
      IF v_source = 'ordinary_blow_dry' THEN
        IF COALESCE(v_drying_routes @> '"ordinary_blow_dry"'::jsonb, false) THEN
          v_selected := v_selected || v_source;
        END IF;
      ELSIF v_source = 'diffuser_airflow_shaping' THEN
        IF COALESCE(v_drying_routes @> '"diffuser_or_airflow_shaping"'::jsonb, false) THEN
          v_selected := v_selected || v_source;
        END IF;
      ELSIF COALESCE(v_additional @> pg_catalog.to_jsonb(v_source), false) THEN
        v_selected := v_selected || v_source;
      END IF;
    END LOOP;

    IF pg_catalog.array_length(v_selected, 1) IS NULL THEN
      v_heat_styling := 'never';
      v_styling_tools := '[]'::jsonb;
      v_uses_heat_protection := false;
    ELSE
      v_heat_events := CASE
        WHEN pg_catalog.jsonb_typeof(p_care_habits -> 'heatEvents') = 'object'
          THEN p_care_habits -> 'heatEvents'
        ELSE '{}'::jsonb
      END;

      FOREACH v_source IN ARRAY v_selected LOOP
        v_event := v_heat_events -> ('heat:' || v_source);
        CONTINUE WHEN pg_catalog.jsonb_typeof(v_event) IS DISTINCT FROM 'object';

        -- `chooseHigherProductFrequency` over every recorded event.
        v_frequency := v_event ->> 'frequency';
        IF v_frequency IS NOT NULL THEN
          v_frequency_rank := pg_catalog.array_position(c_frequency_order, v_frequency);
          IF v_frequency_rank IS NOT NULL
             AND (v_best_rank IS NULL OR v_frequency_rank > v_best_rank) THEN
            v_best_rank := v_frequency_rank;
          END IF;
        END IF;

        -- `uses_heat_protection`: true only when at least one event carries a
        -- protection answer and every such answer is "always". Ordinary blow-dry
        -- carries none, so it neither helps nor hurts.
        v_protection := v_event ->> 'protectionConsistency';
        IF v_protection IS NOT NULL THEN
          v_protection_count := v_protection_count + 1;
          IF v_protection <> 'always' THEN
            v_all_always := false;
          END IF;
        END IF;
      END LOOP;

      IF v_best_rank IS NOT NULL THEN
        v_heat_styling := c_heat_styling ->> c_frequency_order[v_best_rank];
      END IF;

      SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source)) INTO v_selected_json
        FROM pg_catalog.unnest(v_selected) AS source;
      v_styling_tools :=
        COALESCE(public.user_facts_map_vocabulary_array_v1(v_selected_json, c_styling_tool), '[]'::jsonb);
      v_uses_heat_protection := v_protection_count > 0 AND v_all_always;
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'drying_method', v_drying_method,
    'heat_styling', v_heat_styling,
    'styling_tools', v_styling_tools,
    'uses_heat_protection', v_uses_heat_protection,
    'towel_material', p_care_habits -> 'towel' ->> 'material',
    'towel_technique', p_care_habits -> 'towel' ->> 'technique',
    'night_protection', CASE
      WHEN pg_catalog.jsonb_typeof(p_care_habits -> 'nightProtection') = 'array'
        THEN p_care_habits -> 'nightProtection'
      ELSE NULL
    END,
    'brush_type', CASE
      WHEN pg_catalog.jsonb_typeof(p_care_habits -> 'brushesCombs') = 'array'
        THEN p_care_habits -> 'brushesCombs'
      ELSE NULL
    END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- The write function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_facts_save_v1(
  p_user_id uuid,
  p_domain text,
  p_patch jsonb,
  p_provenance jsonb,
  p_expected_revision integer DEFAULT NULL,
  p_mode text DEFAULT 'upsert',
  p_source_draft_id uuid DEFAULT NULL,
  p_expected_draft_revision bigint DEFAULT NULL,
  p_expected_initial_version_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile public.hair_profiles%ROWTYPE;
  v_draft public.personal_plan_refinement_drafts%ROWTYPE;
  v_plan_initial_version_id uuid;
  v_current_revision integer;
  v_old_domain jsonb;
  v_new_domain jsonb;
  v_cleared_keys text[];
  v_old_provenance jsonb;
  v_merged_provenance jsonb;
  v_fields jsonb;
  v_candidates jsonb;
  v_columns jsonb;
  v_changed boolean;
  v_diagnostics jsonb;
BEGIN
  -- (1) Input validation. Nothing is read or written before this passes.
  IF p_domain IS NULL OR p_domain NOT IN ('diagnostics', 'care_habits', 'quiz_context') THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'unknown_domain');
  END IF;
  IF pg_catalog.jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'patch_not_object');
  END IF;
  IF pg_catalog.jsonb_typeof(p_provenance) IS DISTINCT FROM 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'provenance_not_object');
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('upsert', 'create_only') THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'unknown_mode');
  END IF;

  -- (2) Draft binding (F22), validated INSIDE this transaction and before the
  -- profile row is touched, so a rejected binding leaves no trace at all — not
  -- even an empty hair_profiles row. Draft lock first, profile lock second.
  IF p_source_draft_id IS NOT NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_refinement_drafts
     WHERE id = p_source_draft_id AND user_id = p_user_id
       FOR UPDATE;
    IF v_draft.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'not_found');
    END IF;
    IF v_draft.status <> 'in_progress' THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'not_in_progress');
    END IF;
    IF v_draft.revision IS DISTINCT FROM p_expected_draft_revision THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'revision_mismatch');
    END IF;
    SELECT current_initial_need_version_id INTO v_plan_initial_version_id
      FROM public.personal_plans WHERE id = v_draft.personal_plan_id;
    -- Both ends must agree with the caller: the draft still descends from the
    -- version it was opened on, AND the plan still points at that version.
    IF v_draft.base_initial_need_version_id IS DISTINCT FROM p_expected_initial_version_id
       OR v_plan_initial_version_id IS DISTINCT FROM p_expected_initial_version_id THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'stale_source');
    END IF;
  END IF;

  -- (3) Lock the profile row, creating it when it is missing. A missing row
  -- counts as revision 0, and the CAS is checked against that BEFORE the insert
  -- so a stale caller never leaves an empty row behind.
  SELECT * INTO v_profile FROM public.hair_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision IS NOT NULL AND p_expected_revision <> 0 THEN
      RETURN pg_catalog.jsonb_build_object('status', 'revision_conflict', 'revision', 0);
    END IF;
    -- ON CONFLICT + re-select: a concurrent account link may have created the
    -- row between the select above and this insert. Whoever lost simply
    -- continues against the winner's row, re-checking the CAS below.
    INSERT INTO public.hair_profiles (user_id) VALUES (p_user_id)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_profile FROM public.hair_profiles WHERE user_id = p_user_id FOR UPDATE;
    -- Unreachable in practice (the insert either wrote the row or lost to a
    -- concurrent writer whose row is now visible and locked). Raising beats
    -- continuing: every UPDATE below is keyed on user_id, so a vanished row
    -- would silently update ZERO rows and still return {"status":"ok"}.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'user_facts_save_v1: hair_profiles row vanished for user %', p_user_id
        USING ERRCODE = 'internal_error';
    END IF;
  END IF;

  v_current_revision := v_profile.facts_revision;
  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_current_revision THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'revision_conflict', 'revision', v_current_revision);
  END IF;

  v_old_domain := CASE p_domain
    WHEN 'diagnostics' THEN v_profile.diagnostics
    WHEN 'care_habits' THEN v_profile.care_habits
    ELSE v_profile.quiz_context
  END;
  v_old_provenance := COALESCE(v_profile.facts_provenance -> p_domain, '{}'::jsonb);

  -- (4) create_only (F14/F28): never overwrite a domain the user already has.
  -- Account linking uses it for a quiz that is NOT newer than the profile's
  -- last facts change (decision wave 1: a newer own quiz writes with upsert
  -- instead, decided in TypeScript). The one exception (controller ruling 2026-09-15) is
  -- diagnostics the backfill itself synthesised from the narrow legacy columns:
  -- `source.kind = 'legacy_columns'` carries no quiz envelope, so a real
  -- artifact/lead source always wins over it (plan P4).
  IF p_mode = 'create_only'
     AND v_old_domain IS NOT NULL
     AND NOT (p_domain = 'diagnostics' AND v_old_domain #>> '{source,kind}' = 'legacy_columns') THEN
    v_candidates := public.user_facts_union_preserved_candidates_v1(
      v_old_provenance -> 'preservedCandidates', p_provenance -> 'preservedCandidates');
    IF v_candidates IS NOT NULL THEN
      UPDATE public.hair_profiles
         SET facts_provenance = facts_provenance || pg_catalog.jsonb_build_object(
               p_domain,
               v_old_provenance || pg_catalog.jsonb_build_object('preservedCandidates', v_candidates))
       WHERE user_id = p_user_id;
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'status', 'preserved',
      'revision', v_current_revision,
      'changed', false,
      'diagnosticsHash', public.user_facts_diagnostics_hash_v1(v_profile.diagnostics));
  END IF;

  -- (Decision wave 1, Nick 2026-09-30: the former Task 5a C1 goals anti-clobber
  -- step that dropped `goals` from a create_only patch over a `legacy_columns`
  -- document is gone. "Latest own quiz wins" — the TS account-link writer
  -- decides whether a quiz may write, and a quiz that writes replaces goals
  -- like every other field.)

  -- (5) Field-level merge (F13). A key whose patch value is JSON null is
  -- CLEARED; every other key is replaced wholesale; keys the patch does not
  -- name survive untouched.
  --
  -- Deliberately NOT `jsonb_strip_nulls`: that recurses, and
  -- `diagnostics.source.raw` is the verbatim quiz envelope (task 1) which may
  -- legitimately contain nulls. Only TOP-LEVEL nulls are clear instructions.
  SELECT COALESCE(pg_catalog.array_agg(entry.key), ARRAY[]::text[]) INTO v_cleared_keys
    FROM pg_catalog.jsonb_each(p_patch) AS entry(key, value)
   WHERE pg_catalog.jsonb_typeof(entry.value) = 'null';

  v_new_domain := (COALESCE(v_old_domain, '{}'::jsonb) || p_patch) - v_cleared_keys;
  v_changed := v_new_domain IS DISTINCT FROM v_old_domain;

  -- (6) Provenance: this write's envelope plus the accumulated per-field map
  -- (cleared fields drop out with the data they described).
  v_fields := (
    COALESCE(v_old_provenance -> 'fields', '{}'::jsonb)
    || COALESCE(p_provenance -> 'fields', '{}'::jsonb)
  ) - v_cleared_keys;
  v_merged_provenance := p_provenance - 'fields' - 'preservedCandidates';
  IF v_fields <> '{}'::jsonb THEN
    v_merged_provenance := v_merged_provenance || pg_catalog.jsonb_build_object('fields', v_fields);
  END IF;

  -- `preservedCandidates` is evidence of a source that was NOT applied, so only
  -- the preserve path above may add to it (controller ruling 2026-09-15). This
  -- write applied its source, so any incoming array is ignored — the account-link
  -- caller passes one unconditionally — while an array recorded by an EARLIER
  -- preserve survives untouched.
  v_candidates := CASE
    WHEN pg_catalog.jsonb_typeof(v_old_provenance -> 'preservedCandidates') = 'array'
      THEN v_old_provenance -> 'preservedCandidates'
    ELSE NULL
  END;
  IF v_candidates IS NOT NULL THEN
    v_merged_provenance :=
      v_merged_provenance || pg_catalog.jsonb_build_object('preservedCandidates', v_candidates);
  END IF;

  -- (7) Store the domain and recompute ONLY the columns it owns, in the same
  -- statement, from the document just merged. The revision counts WRITES, not
  -- diffs (F04), so it is bumped even when `changed` is false.
  IF p_domain = 'diagnostics' THEN
    v_columns := public.user_facts_derive_diagnostics_columns_v1(v_new_domain);
    UPDATE public.hair_profiles
       SET diagnostics = v_new_domain,
           facts_provenance =
             facts_provenance || pg_catalog.jsonb_build_object(p_domain, v_merged_provenance),
           facts_revision = v_current_revision + 1,
           hair_texture = v_columns ->> 'hair_texture',
           thickness = v_columns ->> 'thickness',
           density = v_columns ->> 'density',
           hair_length = v_columns ->> 'hair_length',
           cuticle_condition = v_columns ->> 'cuticle_condition',
           protein_moisture_balance = v_columns ->> 'protein_moisture_balance',
           scalp_type = v_columns ->> 'scalp_type',
           scalp_condition = v_columns ->> 'scalp_condition',
           chemical_treatment =
             public.user_facts_jsonb_text_array_v1(v_columns -> 'chemical_treatment'),
           concerns = public.user_facts_jsonb_text_array_v1(v_columns -> 'concerns'),
           goals = public.user_facts_jsonb_text_array_v1(v_columns -> 'goals'),
           desired_volume = v_columns ->> 'desired_volume',
           -- main #611 (20260925100000_hair_profiles_primary_concern.sql): its BEFORE
           -- trigger still drops a value `concerns` does not contain.
           primary_concern = v_columns ->> 'primary_concern',
           updated_at = pg_catalog.now()
     WHERE user_id = p_user_id;
  ELSIF p_domain = 'care_habits' THEN
    v_columns := public.user_facts_derive_care_habits_columns_v1(v_new_domain);
    UPDATE public.hair_profiles
       SET care_habits = v_new_domain,
           facts_provenance =
             facts_provenance || pg_catalog.jsonb_build_object(p_domain, v_merged_provenance),
           facts_revision = v_current_revision + 1,
           drying_method = v_columns ->> 'drying_method',
           heat_styling = v_columns ->> 'heat_styling',
           styling_tools = public.user_facts_jsonb_text_array_v1(v_columns -> 'styling_tools'),
           uses_heat_protection = (v_columns ->> 'uses_heat_protection')::boolean,
           towel_material = v_columns ->> 'towel_material',
           towel_technique = v_columns ->> 'towel_technique',
           night_protection = public.user_facts_jsonb_text_array_v1(v_columns -> 'night_protection'),
           brush_type = public.user_facts_jsonb_text_array_v1(v_columns -> 'brush_type'),
           updated_at = pg_catalog.now()
     WHERE user_id = p_user_id;
  ELSE
    -- quiz_context owns no projection.
    UPDATE public.hair_profiles
       SET quiz_context = v_new_domain,
           facts_provenance =
             facts_provenance || pg_catalog.jsonb_build_object(p_domain, v_merged_provenance),
           facts_revision = v_current_revision + 1,
           updated_at = pg_catalog.now()
     WHERE user_id = p_user_id;
  END IF;

  SELECT diagnostics INTO v_diagnostics FROM public.hair_profiles WHERE user_id = p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'ok',
    'revision', v_current_revision + 1,
    'changed', v_changed,
    'diagnosticsHash', public.user_facts_diagnostics_hash_v1(v_diagnostics));
END;
$$;

COMMENT ON FUNCTION public.user_facts_save_v1(
  uuid, text, jsonb, jsonb, integer, text, uuid, bigint, uuid) IS
  'The only supported writer of hair_profiles.diagnostics/care_habits/quiz_context and of the 21 legacy columns derived from them. Merges p_patch field-by-field (a top-level JSON null clears that field), merges provenance, bumps facts_revision on every non-preserved write (CAS via p_expected_revision), and recomputes the derived columns owned by p_domain in the same statement. create_only preserves an existing domain, except diagnostics whose source is the backfill''s own legacy_columns, which the patch merges over like a normal write. Returns {status, revision, changed, diagnosticsHash} or a typed conflict.';

REVOKE ALL ON FUNCTION public.user_facts_jsonb_text_array_v1(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_facts_map_vocabulary_array_v1(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_facts_union_preserved_candidates_v1(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_facts_diagnostics_hash_v1(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_facts_derive_diagnostics_columns_v1(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_facts_derive_care_habits_columns_v1(jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.user_facts_save_v1(
  uuid, text, jsonb, jsonb, integer, text, uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_facts_save_v1(
  uuid, text, jsonb, jsonb, integer, text, uuid, bigint, uuid) TO service_role;
