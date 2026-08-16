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
          'products_id_category_key_key',
          'products_category_key_not_null_check',
          'product_shampoo_specs_product_id_fkey',
          'product_conditioner_specs_product_id_fkey',
          'product_conditioner_rerank_specs_product_id_fkey',
          'product_leave_in_specs_product_id_fkey',
          'product_leave_in_eligibility_product_id_fkey',
          'product_heat_protectant_specs_product_id_fkey',
          'product_oil_specs_product_id_fkey',
          'product_oil_eligibility_product_id_fkey',
          'product_mask_specs_product_id_fkey',
          'product_scalp_care_specs_product_id_fkey',
          'product_dry_shampoo_specs_product_id_fkey',
          'product_bondbuilder_specs_product_id_fkey',
          'product_deep_cleansing_shampoo_specs_product_id_fkey',
          'product_application_protocols_product_id_fkey'
        )
        OR constraint_row.conname LIKE 'product\_%\_product\_category\_fkey' ESCAPE '\'
        OR constraint_row.conname LIKE 'product\_%\_thickness\_eligibility\_fkey' ESCAPE '\'
      )
  ) AS constraints
), index_objects AS (
  SELECT
    'index'::text AS kind,
    index_relation.relname AS name,
    index_row.indisvalid AND index_row.indisready AS valid,
    pg_catalog.pg_get_indexdef(index_row.indexrelid) AS definition
  FROM pg_catalog.pg_index AS index_row
  JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_row.indexrelid
  JOIN pg_catalog.pg_class AS table_relation ON table_relation.oid = index_row.indrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND index_relation.relname LIKE 'product\_%\_product\_category\_idx' ESCAPE '\'
), schema_objects AS (
  SELECT * FROM constraint_objects
  UNION ALL
  SELECT * FROM index_objects
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
