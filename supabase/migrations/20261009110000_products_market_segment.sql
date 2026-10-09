-- Catalog market bucket (Drogerie/Profi badge). Nullable and additive: no
-- "recommended => segment" constraint here. That constraint ships with the
-- approved backfill; even a NOT VALID check would validate every UPDATE and break
-- writers that do not know the column yet (for example the price audit).
BEGIN;

ALTER TABLE public.products ADD COLUMN market_segment text;
ALTER TABLE public.products
  ADD CONSTRAINT products_market_segment_value_check
  CHECK (market_segment IS NULL OR market_segment IN ('drugstore', 'professional'));
COMMENT ON COLUMN public.products.market_segment IS
  'Market bucket shown as Drogerie/Profi badge on shampoo/conditioner/mask; not a quality grade. Required for recommendation once backfilled.';

-- Bondbuilder admission, activation-replay and research receipts store the whole
-- serialized product row. A new column (even NULL, even after a later backfill) must
-- not change those historical images, so both row serializers drop it. The only
-- change against the latest definitions is `to_jsonb(p)` -> `(to_jsonb(p) - 'market_segment')`.
-- bondbuilder_catalogue_available_v1 / bondbuilder_catalogue_activate_v1 and the
-- reviewed-promotion writers compare through these two functions, so they need no change.
CREATE OR REPLACE FUNCTION public.bondbuilder_internal_admission_readback_v1(p_product_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT jsonb_build_object('product',(SELECT (to_jsonb(p) - 'market_segment') FROM public.products p WHERE p.id=p_product_id),'spec',(SELECT to_jsonb(s) FROM public.product_bondbuilder_specs s WHERE s.product_id=p_product_id),'identifiers',COALESCE((SELECT jsonb_agg(jsonb_build_object('type',i.identifier_type,'value',i.identifier_value,'source',i.source) ORDER BY i.identifier_type,i.identifier_value) FROM public.product_identifiers i WHERE i.product_id=p_product_id),'[]'::jsonb),'asset',(SELECT to_jsonb(a) FROM public.product_image_assets a WHERE a.product_id=p_product_id),'protocols',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.product_application_protocols a WHERE a.product_id=p_product_id),'[]'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.bondbuilder_research_preimage_v1(p_product_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT jsonb_build_object(
 'product',(to_jsonb(p) - 'market_segment'),
 'specs',(SELECT to_jsonb(s) FROM public.product_bondbuilder_specs s WHERE s.product_id=p.id),
 'protocols',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.category,a.role,a.application_family) FROM public.product_application_protocols a WHERE a.product_id=p.id),'[]'::jsonb))
 FROM public.products p WHERE p.id=p_product_id
$$;

REVOKE ALL ON FUNCTION public.bondbuilder_internal_admission_readback_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bondbuilder_internal_admission_readback_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.bondbuilder_research_preimage_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bondbuilder_research_preimage_v1(uuid) TO service_role;

COMMIT;
