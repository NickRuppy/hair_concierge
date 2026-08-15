-- Read-only schema receipt for scripts/catalog-authority/audit.ts --schema-input.
-- Run through an authenticated SQL console/MCP and save the `schemaObjects`
-- JSON array without editing it. Missing target objects are detected by the TS audit.
WITH constraint_objects AS (
  SELECT
    'constraint'::text AS kind,
    constraint_name AS name,
    validated AS valid,
    definition
  FROM (
    SELECT
      constraint_row.conname AS constraint_name,
      constraint_row.convalidated AS validated,
      pg_catalog.pg_get_constraintdef(constraint_row.oid) AS definition
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_class AS relation ON relation.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND (
        constraint_row.conname IN (
          'products_origin_check',
          'products_category_key_fkey',
          'products_id_category_key_key'
        )
        OR constraint_row.conname LIKE 'product\_%\_product\_category\_fkey' ESCAPE '\'
      )
  ) AS constraints
), schema_objects AS (
  SELECT * FROM constraint_objects
)
SELECT pg_catalog.jsonb_build_object(
  'schemaObjects',
  COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'kind', kind,
        'name', name,
        'valid', valid,
        'definition', definition
      )
      ORDER BY kind, name
    ),
    '[]'::jsonb
  )
) AS receipt
FROM schema_objects;
