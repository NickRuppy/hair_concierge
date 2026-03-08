-- Standardize all hair_profiles enum fields from German/mixed keys to English keys.
-- Each UPDATE is idempotent: already-migrated rows keep their English keys (ELSE val).

-- Migrate concerns: German labels → English keys
UPDATE hair_profiles SET concerns = (
  SELECT array_agg(CASE val
    WHEN 'Haarausfall' THEN 'hair_loss'
    WHEN 'Schuppen' THEN 'dandruff'
    WHEN 'Trockenheit' THEN 'dryness'
    WHEN 'Fettige Kopfhaut' THEN 'oily_scalp'
    WHEN 'Haarschaeden' THEN 'hair_damage'
    WHEN 'Coloriert' THEN 'colored'
    WHEN 'Spliss' THEN 'split_ends'
    WHEN 'Frizz' THEN 'frizz'
    WHEN 'Duenner werdendes Haar' THEN 'thinning'
    ELSE val END)
  FROM unnest(concerns) AS val
) WHERE array_length(concerns, 1) > 0;

-- Migrate goals (including onboarding goal labels that collapse)
UPDATE hair_profiles SET goals = (
  SELECT array_agg(DISTINCT CASE val
    WHEN 'Mehr Volumen' THEN 'volume'
    WHEN 'Mehr Volumen & Lift' THEN 'volume'
    WHEN 'Zu viel Volumen' THEN 'volume'
    WHEN 'Gesuenderes Haar' THEN 'healthier_hair'
    WHEN 'Haarwachstum' THEN 'hair_growth'
    WHEN 'Weniger Frizz' THEN 'less_frizz'
    WHEN 'Anti-Frizz & Geschmeidigkeit' THEN 'less_frizz'
    WHEN 'Farbschutz' THEN 'color_protection'
    WHEN 'Mehr Feuchtigkeit' THEN 'moisture'
    WHEN 'Leichte Feuchtigkeit' THEN 'moisture'
    WHEN 'Intensive Feuchtigkeit' THEN 'moisture'
    WHEN 'Feuchtigkeit versiegeln' THEN 'moisture'
    WHEN 'Maximale Geschmeidigkeit' THEN 'moisture'
    WHEN 'Gesunde Kopfhaut' THEN 'healthy_scalp'
    WHEN 'Weniger schnell nachfetten' THEN 'healthy_scalp'
    WHEN 'Kopfhaut beruhigen' THEN 'healthy_scalp'
    WHEN 'Mehr Glanz' THEN 'shine'
    WHEN 'Locken-Definition' THEN 'curl_definition'
    WHEN 'Wellen-Definition' THEN 'curl_definition'
    WHEN 'Locken-Clumping' THEN 'curl_definition'
    WHEN 'Beach-Waves Textur' THEN 'curl_definition'
    WHEN 'Locken strecken' THEN 'curl_definition'
    ELSE val END)
  FROM unnest(goals) AS val
) WHERE array_length(goals, 1) > 0;

-- Migrate styling_tools (handle both umlaut and ASCII variants)
UPDATE hair_profiles SET styling_tools = (
  SELECT array_agg(CASE val
    WHEN 'Föhn' THEN 'blow_dryer'
    WHEN 'Foehn' THEN 'blow_dryer'
    WHEN 'Glätteisen' THEN 'flat_iron'
    WHEN 'Glaetteisen' THEN 'flat_iron'
    WHEN 'Lockenstab' THEN 'curling_iron'
    WHEN 'Warmluftbürste' THEN 'hot_air_brush'
    WHEN 'Warmluftbuerste' THEN 'hot_air_brush'
    WHEN 'Diffusor' THEN 'diffuser'
    ELSE val END)
  FROM unnest(styling_tools) AS val
) WHERE array_length(styling_tools, 1) > 0;

-- Migrate wash_frequency
UPDATE hair_profiles SET wash_frequency = CASE wash_frequency
  WHEN 'taeglich' THEN 'daily'
  WHEN 'alle_2_tage' THEN 'every_2_days'
  WHEN '2_mal_woche' THEN 'twice_weekly'
  WHEN '1_mal_woche' THEN 'once_weekly'
  WHEN 'seltener' THEN 'rarely'
  ELSE wash_frequency END
WHERE wash_frequency IS NOT NULL;

-- Migrate heat_styling
UPDATE hair_profiles SET heat_styling = CASE heat_styling
  WHEN 'taeglich' THEN 'daily'
  WHEN 'mehrmals_woche' THEN 'several_weekly'
  WHEN '1_mal_woche' THEN 'once_weekly'
  WHEN 'selten' THEN 'rarely'
  WHEN 'nie' THEN 'never'
  ELSE heat_styling END
WHERE heat_styling IS NOT NULL;

-- Migrate cuticle_condition
UPDATE hair_profiles SET cuticle_condition = CASE cuticle_condition
  WHEN 'glatt' THEN 'smooth'
  WHEN 'leicht_uneben' THEN 'slightly_rough'
  WHEN 'rau' THEN 'rough'
  ELSE cuticle_condition END
WHERE cuticle_condition IS NOT NULL;

-- Migrate scalp_type
UPDATE hair_profiles SET scalp_type = CASE scalp_type
  WHEN 'fettig' THEN 'oily'
  WHEN 'ausgeglichen' THEN 'balanced'
  WHEN 'trocken' THEN 'dry'
  ELSE scalp_type END
WHERE scalp_type IS NOT NULL;

-- Migrate scalp_condition
UPDATE hair_profiles SET scalp_condition = CASE scalp_condition
  WHEN 'keine' THEN 'none'
  WHEN 'schuppen' THEN 'dandruff'
  WHEN 'gereizt' THEN 'irritated'
  ELSE scalp_condition END
WHERE scalp_condition IS NOT NULL;

-- Migrate chemical_treatment
UPDATE hair_profiles SET chemical_treatment = (
  SELECT array_agg(CASE val
    WHEN 'natur' THEN 'natural'
    WHEN 'gefaerbt' THEN 'colored'
    WHEN 'blondiert' THEN 'bleached'
    ELSE val END)
  FROM unnest(chemical_treatment) AS val
) WHERE array_length(chemical_treatment, 1) > 0;
