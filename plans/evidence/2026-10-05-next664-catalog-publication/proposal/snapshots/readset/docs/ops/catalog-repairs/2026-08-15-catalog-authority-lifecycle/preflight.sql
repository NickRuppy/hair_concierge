-- READ ONLY. Exact preflight for the approved 19-product lifecycle repair.
WITH expected(id, is_active, lifecycle_status, is_recommended) AS (
  VALUES
    ('917786d2-cf02-43d4-8a9f-7f872528d581'::uuid, true,  'discontinued', true),
    ('d105d245-5993-4b89-b45d-1bf0a86650e3'::uuid, false, 'discontinued', true),
    ('caa94951-57d9-441d-bd46-5d7debbf365f'::uuid, false, 'discontinued', true),
    ('e937c8aa-fc99-4731-b848-e5bd988fcc17'::uuid, false, 'discontinued', true),
    ('a1d705b4-b973-486d-b853-2c795b6db681'::uuid, false, 'discontinued', true),
    ('6513692a-b54f-4acc-9c77-5799d3dd200c'::uuid, false, 'discontinued', true),
    ('1a6e731e-8fb2-43b4-9f4c-2d7f6dd06dca'::uuid, false, 'discontinued', true),
    ('3f9328d8-1f6a-44e9-affd-fc219d1e691a'::uuid, false, 'discontinued', true),
    ('514ffd65-e4a5-4f7f-96c5-0f194e3b3b36'::uuid, false, 'discontinued', true),
    ('d0936238-7412-40bc-ba7a-3c268f17d0f4'::uuid, false, 'discontinued', true),
    ('6d6c3ff2-9d12-4f27-a56f-b5b72cf53318'::uuid, false, 'discontinued', true),
    ('7bd5f94a-fb02-4505-a53a-2b100c265a5b'::uuid, false, 'active', true),
    ('7db2bb60-0af6-4198-adec-28fad13251a6'::uuid, false, 'active', true),
    ('996eaa2a-ea4c-4dfb-b455-2782e82d9a44'::uuid, false, 'active', true),
    ('4417217b-2843-47aa-8815-04a125b08341'::uuid, false, 'active', true),
    ('4e76bb70-b521-48e1-9708-4edc48b17c73'::uuid, false, 'active', true),
    ('686df4f6-4e8f-48e7-b823-5b1e89dd9cf2'::uuid, false, 'active', true),
    ('3c769f60-283f-48c3-9549-cf84b73115d7'::uuid, false, 'active', true),
    ('4fd5f4c3-83b2-4893-be8c-ada29b8ca718'::uuid, false, 'active', true)
), actual AS (
  SELECT p.id, p.is_active, p.lifecycle_status, p.is_chaarlie_recommended AS is_recommended
  FROM public.products p
  JOIN expected e USING (id)
), drift AS (
  (SELECT * FROM expected EXCEPT SELECT * FROM actual)
  UNION ALL
  (SELECT * FROM actual EXCEPT SELECT * FROM expected)
), mappings(source_id, target_id) AS (
  VALUES
    ('7bd5f94a-fb02-4505-a53a-2b100c265a5b'::uuid, 'c2d7eb89-9a2e-4476-bb89-c0f33a2aa501'::uuid),
    ('7db2bb60-0af6-4198-adec-28fad13251a6'::uuid, 'e3c4b607-8f81-462c-8a2b-e45c8b3a2976'::uuid),
    ('996eaa2a-ea4c-4dfb-b455-2782e82d9a44'::uuid, '695414e1-3435-4304-943b-76677408980c'::uuid),
    ('4417217b-2843-47aa-8815-04a125b08341'::uuid, '9d7141bf-bb7e-41e8-a206-38ee5c42fdc6'::uuid),
    ('4e76bb70-b521-48e1-9708-4edc48b17c73'::uuid, 'd9825ad6-f549-4b02-a62a-eaa3bf917936'::uuid),
    ('686df4f6-4e8f-48e7-b823-5b1e89dd9cf2'::uuid, '088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid)
), target_defects AS (
  SELECT m.source_id, m.target_id
  FROM mappings m
  LEFT JOIN public.products source ON source.id = m.source_id
  LEFT JOIN public.products target ON target.id = m.target_id
  WHERE source.id IS NULL OR target.id IS NULL
    OR source.category_key IS DISTINCT FROM target.category_key
    OR target.is_active IS DISTINCT FROM true
    OR target.lifecycle_status IS DISTINCT FROM 'active'
    OR target.is_chaarlie_recommended IS DISTINCT FROM true
), conflicting_relationships AS (
  SELECT relationship.source_product_id, relationship.target_product_id
  FROM public.product_relationships relationship
  JOIN mappings m ON m.source_id = relationship.source_product_id
  WHERE relationship.relationship_type = 'replaced_by'
    AND relationship.target_product_id <> m.target_id
)
SELECT jsonb_build_object(
  'expectedRows', (SELECT count(*) FROM expected),
  'exactRows', (SELECT count(*) FROM actual),
  'driftRows', (SELECT count(*) FROM drift),
  'mappingCount', (SELECT count(*) FROM mappings),
  'targetDefects', (SELECT count(*) FROM target_defects),
  'conflictingRelationships', (SELECT count(*) FROM conflicting_relationships),
  'existingExactRelationships', (
    SELECT count(*)
    FROM public.product_relationships relationship
    JOIN mappings m
      ON m.source_id = relationship.source_product_id
     AND m.target_id = relationship.target_product_id
    WHERE relationship.relationship_type = 'replaced_by'
  )
) AS receipt;
