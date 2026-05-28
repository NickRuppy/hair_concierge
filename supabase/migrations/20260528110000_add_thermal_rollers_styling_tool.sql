-- Normalize historical/manual thermal roller styling-tool labels to the canonical value.

UPDATE hair_profiles AS hp
SET styling_tools = normalized.normalized_tools
FROM (
  SELECT
    id,
    ARRAY(
      SELECT mapped.normalized_value
      FROM (
        SELECT normalized_value, MIN(position) AS first_position
        FROM (
          SELECT
            CASE
              WHEN lower(trim(value)) IN (
                'thermo-lockenwickler',
                'thermolockenwickler',
                'thermal rollers',
                'thermal_rollers',
                'heizwickler',
                'warme lockenwickler',
                'warme-lockenwickler'
              ) THEN 'thermal_rollers'
              ELSE value
            END AS normalized_value,
            position
          FROM unnest(styling_tools) WITH ORDINALITY AS tool(value, position)
        ) AS mapped_values
        GROUP BY normalized_value
      ) AS mapped
      ORDER BY mapped.first_position
    ) AS normalized_tools
  FROM hair_profiles
  WHERE array_length(styling_tools, 1) > 0
    AND EXISTS (
      SELECT 1
      FROM unnest(styling_tools) AS value
      WHERE lower(trim(value)) IN (
        'thermo-lockenwickler',
        'thermolockenwickler',
        'thermal rollers',
        'thermal_rollers',
        'heizwickler',
        'warme lockenwickler',
        'warme-lockenwickler'
      )
    )
) AS normalized
WHERE hp.id = normalized.id
  AND hp.styling_tools IS DISTINCT FROM normalized.normalized_tools;
