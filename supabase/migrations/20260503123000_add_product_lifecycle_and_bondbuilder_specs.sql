ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active';

UPDATE public.products
SET lifecycle_status = 'active'
WHERE lifecycle_status IS NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_lifecycle_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'discontinued'));

CREATE TABLE IF NOT EXISTS public.product_relationships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  target_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (
    relationship_type IN ('replaced_by', 'add_on_for')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_product_id, target_product_id, relationship_type),
  CHECK (source_product_id <> target_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_relationships_source_type
  ON public.product_relationships (source_product_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_product_relationships_target_type
  ON public.product_relationships (target_product_id, relationship_type);

DROP TRIGGER IF EXISTS set_updated_at_product_relationships ON public.product_relationships;
CREATE TRIGGER set_updated_at_product_relationships
  BEFORE UPDATE ON public.product_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_relationships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_relationships'
      AND policyname = 'product_relationships_admin_select'
  ) THEN
    CREATE POLICY product_relationships_admin_select
      ON public.product_relationships
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_relationships'
      AND policyname = 'product_relationships_admin_insert'
  ) THEN
    CREATE POLICY product_relationships_admin_insert
      ON public.product_relationships
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_relationships'
      AND policyname = 'product_relationships_admin_update'
  ) THEN
    CREATE POLICY product_relationships_admin_update
      ON public.product_relationships
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_relationships'
      AND policyname = 'product_relationships_admin_delete'
  ) THEN
    CREATE POLICY product_relationships_admin_delete
      ON public.product_relationships
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;
END $$;

ALTER TABLE public.product_bondbuilder_specs
  ADD COLUMN IF NOT EXISTS bond_repair_axis text,
  ADD COLUMN IF NOT EXISTS treatment_mode text,
  ADD COLUMN IF NOT EXISTS product_format text,
  ADD COLUMN IF NOT EXISTS usage_protocol text;

UPDATE public.product_bondbuilder_specs
SET treatment_mode = CASE application_mode
  WHEN 'pre_shampoo' THEN 'rinse_out'
  WHEN 'post_wash_leave_in' THEN 'leave_in'
  ELSE treatment_mode
END
WHERE treatment_mode IS NULL;

UPDATE public.product_bondbuilder_specs
SET
  bond_repair_axis = COALESCE(
    bond_repair_axis,
    CASE treatment_mode
      WHEN 'leave_in' THEN 'peptide_chain'
      ELSE 'disulfide_crosslink'
    END
  ),
  product_format = COALESCE(
    product_format,
    CASE treatment_mode
      WHEN 'leave_in' THEN 'leave_in_mask'
      ELSE 'cream_treatment'
    END
  ),
  usage_protocol = COALESCE(
    usage_protocol,
    CASE treatment_mode
      WHEN 'leave_in' THEN 'k18_leave_in'
      ELSE 'olaplex_3_legacy'
    END
  );

ALTER TABLE public.product_bondbuilder_specs
  ALTER COLUMN bond_repair_axis SET NOT NULL,
  ALTER COLUMN treatment_mode SET NOT NULL,
  ALTER COLUMN product_format SET NOT NULL,
  ALTER COLUMN usage_protocol SET NOT NULL;

ALTER TABLE public.product_bondbuilder_specs
  DROP CONSTRAINT IF EXISTS product_bondbuilder_specs_bond_repair_axis_check,
  DROP CONSTRAINT IF EXISTS product_bondbuilder_specs_treatment_mode_check,
  DROP CONSTRAINT IF EXISTS product_bondbuilder_specs_product_format_check,
  DROP CONSTRAINT IF EXISTS product_bondbuilder_specs_usage_protocol_check;

ALTER TABLE public.product_bondbuilder_specs
  ADD CONSTRAINT product_bondbuilder_specs_bond_repair_axis_check
  CHECK (bond_repair_axis IN ('disulfide_crosslink', 'peptide_chain')),
  ADD CONSTRAINT product_bondbuilder_specs_treatment_mode_check
  CHECK (treatment_mode IN ('rinse_out', 'leave_in')),
  ADD CONSTRAINT product_bondbuilder_specs_product_format_check
  CHECK (
    product_format IN (
      'cream_treatment',
      'primer_treatment',
      'leave_in_mask',
      'spray_treatment'
    )
  ),
  ADD CONSTRAINT product_bondbuilder_specs_usage_protocol_check
  CHECK (
    usage_protocol IN (
      'olaplex_3plus',
      'olaplex_0_booster',
      'olaplex_3_legacy',
      'k18_leave_in',
      'epres_spray'
    )
  );

CREATE INDEX IF NOT EXISTS idx_product_bondbuilder_specs_axis
  ON public.product_bondbuilder_specs (bond_repair_axis);

CREATE INDEX IF NOT EXISTS idx_product_bondbuilder_specs_treatment_mode
  ON public.product_bondbuilder_specs (treatment_mode);

CREATE INDEX IF NOT EXISTS idx_product_bondbuilder_specs_usage_protocol
  ON public.product_bondbuilder_specs (usage_protocol);

DROP FUNCTION IF EXISTS public.match_products(vector, text, text[], integer, text[], text);

CREATE OR REPLACE FUNCTION public.match_products(
    query_embedding vector,
    user_hair_texture text DEFAULT NULL,
    user_concerns text[] DEFAULT '{}',
    match_count integer DEFAULT 5,
    category_filter text[] DEFAULT NULL,
    user_thickness text DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    name text,
    brand text,
    description text,
    short_description text,
    tom_take text,
    category text,
    affiliate_link text,
    image_url text,
    price_eur numeric,
    currency text,
    tags text[],
    suitable_thicknesses text[],
    suitable_concerns text[],
    is_active boolean,
    lifecycle_status text,
    sort_order integer,
    similarity double precision,
    profile_score double precision,
    combined_score double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    effective_thickness text := COALESCE(user_thickness, user_hair_texture);
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.brand,
        p.description,
        p.short_description,
        p.tom_take,
        p.category,
        p.affiliate_link,
        p.image_url,
        p.price_eur,
        p.currency,
        p.tags,
        p.suitable_thicknesses,
        p.suitable_concerns,
        p.is_active,
        p.lifecycle_status,
        p.sort_order,
        (1 - (p.embedding <=> query_embedding))::float AS similarity,
        (
            COALESCE(
                CASE
                    WHEN effective_thickness IS NOT NULL
                         AND array_length(p.suitable_thicknesses, 1) > 0
                         AND effective_thickness = ANY(p.suitable_thicknesses)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS profile_score,
        (
            0.6 * (1 - (p.embedding <=> query_embedding))::float
            +
            0.4 * COALESCE(
                CASE
                    WHEN effective_thickness IS NOT NULL
                         AND array_length(p.suitable_thicknesses, 1) > 0
                         AND effective_thickness = ANY(p.suitable_thicknesses)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS combined_score
    FROM products p
    WHERE
        p.is_active = true
        AND p.lifecycle_status = 'active'
        AND p.embedding IS NOT NULL
        AND (category_filter IS NULL OR p.category = ANY(category_filter))
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$function$;
