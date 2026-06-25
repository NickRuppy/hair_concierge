UPDATE hair_profiles
SET night_protection = (
  SELECT COALESCE(array_agg(value ORDER BY ord), ARRAY[]::text[])
  FROM unnest(night_protection) WITH ORDINALITY AS item(value, ord)
  WHERE value IS DISTINCT FROM 'tight_hairstyles'
)
WHERE night_protection && ARRAY['tight_hairstyles']::text[];
