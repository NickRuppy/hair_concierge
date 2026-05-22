UPDATE hair_profiles
SET night_protection = (
  SELECT array_agg(DISTINCT mapped_value ORDER BY mapped_value)
  FROM (
    SELECT CASE
      WHEN value IN ('loose_braid', 'loose_bun') THEN 'loose_tied'
      ELSE value
    END AS mapped_value
    FROM unnest(night_protection) AS value
  ) normalized_values
)
WHERE night_protection && ARRAY['loose_braid', 'loose_bun']::text[];
