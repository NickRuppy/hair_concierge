-- Phase 0 product identity normalization.
-- Expand/backfill/compatibility only: keep legacy products.brand/category and
-- do not alter existing product spec table RLS here. Production anon reads were
-- audited separately and must stay table-specific.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.product_categories (
  key text PRIMARY KEY,
  display_name_de text NOT NULL,
  is_catalog_supported boolean NOT NULL DEFAULT false,
  is_intake_supported boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  canonical_name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, normalized_name),
  UNIQUE (id, brand_id)
);

CREATE TABLE IF NOT EXISTS public.brand_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  product_line_id uuid,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  source text NOT NULL DEFAULT 'curated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_line_id, brand_id)
    REFERENCES public.product_lines(id, brand_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.product_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  normalized_identifier_value text GENERATED ALWAYS AS (
    lower(regexp_replace(btrim(identifier_value), '\s+', '', 'g'))
  ) STORED,
  source text NOT NULL DEFAULT 'curated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_identifiers_type_check
    CHECK (
      identifier_type IN (
        'ean',
        'gtin',
        'barcode',
        'retailer_sku',
        'retailer_url'
      )
    )
);

INSERT INTO public.product_categories (
  key,
  display_name_de,
  is_catalog_supported,
  is_intake_supported,
  sort_order
)
VALUES
  ('shampoo', 'Shampoo', true, true, 10),
  ('conditioner', 'Conditioner (Drogerie)', true, true, 20),
  ('mask', 'Maske', true, true, 30),
  ('leave_in', 'Leave-in', true, true, 40),
  ('oil', 'Öle', true, true, 50),
  ('dry_shampoo', 'Trockenshampoo', true, true, 60),
  ('deep_cleansing_shampoo', 'Tiefenreinigungsshampoo', true, true, 70),
  ('bondbuilder', 'Bondbuilder', true, true, 80),
  ('heat_protectant', 'Hitzeschutz', false, false, 90),
  ('serum', 'Serum', false, false, 100),
  ('scrub', 'Scrub', false, false, 110),
  ('peeling', 'Peeling', false, false, 120),
  ('styling_gel', 'Styling-Gel', false, false, 130),
  ('styling_mousse', 'Styling-Mousse', false, false, 140),
  ('styling_cream', 'Styling-Creme', false, false, 150),
  ('hairspray', 'Haarspray', false, false, 160)
ON CONFLICT (key) DO UPDATE
SET
  display_name_de = EXCLUDED.display_name_de,
  is_catalog_supported = EXCLUDED.is_catalog_supported,
  is_intake_supported = EXCLUDED.is_intake_supported,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_key text,
  ADD COLUMN IF NOT EXISTS brand_id uuid,
  ADD COLUMN IF NOT EXISTS product_line_id uuid,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'curated',
  ADD COLUMN IF NOT EXISTS is_chaarlie_recommended boolean NOT NULL DEFAULT true;

UPDATE public.products
SET
  origin = COALESCE(origin, 'curated'),
  is_chaarlie_recommended = true
WHERE origin = 'curated'
  AND is_chaarlie_recommended IS DISTINCT FROM true;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_origin_check,
  DROP CONSTRAINT IF EXISTS products_category_key_fkey,
  DROP CONSTRAINT IF EXISTS products_brand_id_fkey,
  DROP CONSTRAINT IF EXISTS products_product_line_id_fkey,
  DROP CONSTRAINT IF EXISTS products_product_line_matches_brand;

ALTER TABLE public.products
  ADD CONSTRAINT products_origin_check
    CHECK (origin IN ('curated', 'user_submitted')) NOT VALID,
  ADD CONSTRAINT products_category_key_fkey
    FOREIGN KEY (category_key)
    REFERENCES public.product_categories(key)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
    NOT VALID,
  ADD CONSTRAINT products_brand_id_fkey
    FOREIGN KEY (brand_id)
    REFERENCES public.brands(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID,
  ADD CONSTRAINT products_product_line_matches_brand
    FOREIGN KEY (product_line_id, brand_id)
    REFERENCES public.product_lines(id, brand_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL (product_line_id)
    NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_normalized_name
  ON public.brands (normalized_name);

CREATE INDEX IF NOT EXISTS idx_product_lines_brand_id
  ON public.product_lines (brand_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_lines_brand_normalized_name
  ON public.product_lines (brand_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_brand_aliases_brand_id
  ON public.brand_aliases (brand_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_aliases_normalized_alias
  ON public.brand_aliases (normalized_alias);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_product_id
  ON public.product_identifiers (product_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_identifiers_product_type_value
  ON public.product_identifiers (product_id, identifier_type, normalized_identifier_value);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_lookup
  ON public.product_identifiers (identifier_type, normalized_identifier_value);

CREATE INDEX IF NOT EXISTS idx_products_category_key
  ON public.products (category_key);

CREATE INDEX IF NOT EXISTS idx_products_brand_id
  ON public.products (brand_id);

CREATE INDEX IF NOT EXISTS idx_products_product_line_id
  ON public.products (product_line_id);

CREATE INDEX IF NOT EXISTS idx_products_origin
  ON public.products (origin);

CREATE INDEX IF NOT EXISTS idx_products_chaarlie_recommended
  ON public.products (is_chaarlie_recommended)
  WHERE is_chaarlie_recommended = true;

DROP FUNCTION IF EXISTS public.match_products(extensions.vector, text, text[], integer, text[], text);

CREATE OR REPLACE FUNCTION public.match_products(
    query_embedding extensions.vector,
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
        AND p.is_chaarlie_recommended = true
        AND p.lifecycle_status = 'active'
        AND p.embedding IS NOT NULL
        AND (category_filter IS NULL OR p.category = ANY(category_filter))
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$function$;

DROP TRIGGER IF EXISTS set_updated_at_product_categories ON public.product_categories;
CREATE TRIGGER set_updated_at_product_categories
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_brands ON public.brands;
CREATE TRIGGER set_updated_at_brands
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_product_lines ON public.product_lines;
CREATE TRIGGER set_updated_at_product_lines
  BEFORE UPDATE ON public.product_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_brand_aliases ON public.brand_aliases;
CREATE TRIGGER set_updated_at_brand_aliases
  BEFORE UPDATE ON public.brand_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_product_identifiers ON public.product_identifiers;
CREATE TRIGGER set_updated_at_product_identifiers
  BEFORE UPDATE ON public.product_identifiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_identifiers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.product_categories TO anon, authenticated;
GRANT SELECT ON TABLE public.brands TO anon, authenticated;

DROP POLICY IF EXISTS "products_select_active"
  ON public.products;
CREATE POLICY "products_select_active"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND is_chaarlie_recommended = true
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS product_categories_select_public
  ON public.product_categories;
CREATE POLICY product_categories_select_public
  ON public.product_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS brands_select_public
  ON public.brands;
CREATE POLICY brands_select_public
  ON public.brands
  FOR SELECT
  TO anon, authenticated
  USING (true);
