-- Catalogue authority Task 2: additive shared eligibility and category identity.
--
-- This is the expand phase. It preserves every legacy product field and reader,
-- enforces the new constraints for future writes, and deliberately leaves
-- historical composite foreign keys NOT VALID until the reviewed repair task.

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.origin IS NULL
       OR product.origin NOT IN ('curated', 'user_submitted')
  ) THEN
    RAISE EXCEPTION 'catalogue authority preflight: unsupported products.origin';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    LEFT JOIN public.product_categories AS category
      ON category.key = product.category_key
    WHERE product.category_key IS NULL
       OR category.key IS NULL
  ) THEN
    RAISE EXCEPTION 'catalogue authority preflight: missing or unknown products.category_key';
  END IF;
END;
$preflight$;

ALTER TABLE public.products
  VALIDATE CONSTRAINT products_origin_check;

ALTER TABLE public.products
  VALIDATE CONSTRAINT products_category_key_fkey;

ALTER TABLE public.products
  ADD CONSTRAINT products_id_category_key_key UNIQUE (id, category_key),
  ADD CONSTRAINT products_category_key_not_null_check
    CHECK (category_key IS NOT NULL) NOT VALID;

-- Transitional expand-phase bridge for the legacy admin writer, which still
-- sends only products.category. Explicit category_key values remain authoritative.
CREATE FUNCTION public.catalog_authority_set_category_key_compat_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.category_key IS NULL THEN
    NEW.category_key := CASE pg_catalog.lower(pg_catalog.btrim(COALESCE(NEW.category, '')))
      WHEN 'shampoo' THEN 'shampoo'
      WHEN 'shampoo profi' THEN 'shampoo'
      WHEN 'conditioner' THEN 'conditioner'
      WHEN 'conditioner profi' THEN 'conditioner'
      WHEN 'conditioner (drogerie)' THEN 'conditioner'
      WHEN 'leave-in' THEN 'leave_in'
      WHEN 'leave_in' THEN 'leave_in'
      WHEN 'leave in' THEN 'leave_in'
      WHEN 'maske' THEN 'mask'
      WHEN 'mask' THEN 'mask'
      WHEN 'hitzeschutz' THEN 'heat_protectant'
      WHEN 'heat protectant' THEN 'heat_protectant'
      WHEN 'heat_protectant' THEN 'heat_protectant'
      WHEN 'öle' THEN 'oil'
      WHEN 'öl' THEN 'oil'
      WHEN 'oele' THEN 'oil'
      WHEN 'ole' THEN 'oil'
      WHEN 'oil' THEN 'oil'
      WHEN 'kopfhautpflege' THEN 'scalp_care'
      WHEN 'scalp care' THEN 'scalp_care'
      WHEN 'scalp_care' THEN 'scalp_care'
      WHEN 'trockenshampoo' THEN 'dry_shampoo'
      WHEN 'dry shampoo' THEN 'dry_shampoo'
      WHEN 'dry_shampoo' THEN 'dry_shampoo'
      WHEN 'tiefenreinigungsshampoo' THEN 'deep_cleansing_shampoo'
      WHEN 'deep cleansing shampoo' THEN 'deep_cleansing_shampoo'
      WHEN 'deep_cleansing_shampoo' THEN 'deep_cleansing_shampoo'
      WHEN 'bondbuilder' THEN 'bondbuilder'
      WHEN 'bond builder' THEN 'bondbuilder'
      WHEN 'serum' THEN 'serum'
      WHEN 'scrub' THEN 'scrub'
      WHEN 'peeling' THEN 'peeling'
      WHEN 'styling-gel' THEN 'styling_gel'
      WHEN 'styling gel' THEN 'styling_gel'
      WHEN 'styling-mousse' THEN 'styling_mousse'
      WHEN 'styling mousse' THEN 'styling_mousse'
      WHEN 'styling-creme' THEN 'styling_cream'
      WHEN 'styling cream' THEN 'styling_cream'
      WHEN 'haarspray' THEN 'hairspray'
      WHEN 'hairspray' THEN 'hairspray'
      ELSE (
        SELECT category.key
        FROM public.product_categories AS category
        WHERE pg_catalog.lower(category.key) =
              pg_catalog.lower(pg_catalog.btrim(COALESCE(NEW.category, '')))
           OR pg_catalog.lower(category.display_name_de) =
              pg_catalog.lower(pg_catalog.btrim(COALESCE(NEW.category, '')))
        ORDER BY (category.key = NEW.category) DESC, category.key
        LIMIT 1
      )
    END;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.catalog_authority_set_category_key_compat_v1()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER catalog_authority_set_category_key_compat_v1
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_set_category_key_compat_v1();

CREATE TABLE public.product_thickness_eligibility (
  product_id uuid NOT NULL,
  category_key text NOT NULL,
  thickness text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_thickness_eligibility_pkey
    PRIMARY KEY (product_id, category_key, thickness),
  CONSTRAINT product_thickness_eligibility_thickness_check
    CHECK (thickness IN ('fine', 'normal', 'coarse'))
);

CREATE TABLE public.product_concern_eligibility (
  product_id uuid NOT NULL,
  category_key text NOT NULL,
  concern_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_concern_eligibility_pkey
    PRIMARY KEY (product_id, category_key, concern_key),
  CONSTRAINT product_concern_eligibility_concern_key_check
    CHECK (length(btrim(concern_key)) > 0)
);

ALTER TABLE public.product_thickness_eligibility
  ADD CONSTRAINT product_thickness_eligibility_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.product_concern_eligibility
  ADD CONSTRAINT product_concern_eligibility_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.product_thickness_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_concern_eligibility ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_thickness_eligibility FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_concern_eligibility FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_thickness_eligibility FROM service_role;
REVOKE ALL ON TABLE public.product_concern_eligibility FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_thickness_eligibility TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_concern_eligibility TO service_role;

-- Legacy arrays are the broad compatibility source. Independently typed
-- contextual tuples add reviewed thickness values only when the tuple table's
-- category agrees with the product spine. This captures known Oil tuple debt
-- without treating wrong-category rows as canonical eligibility.
INSERT INTO public.product_thickness_eligibility (product_id, category_key, thickness)
SELECT DISTINCT source.product_id, source.category_key, source.thickness
FROM (
  SELECT product.id AS product_id, product.category_key, thickness.value AS thickness
  FROM public.products AS product
  CROSS JOIN LATERAL unnest(coalesce(product.suitable_thicknesses, '{}'::text[])) AS thickness(value)

  UNION ALL

  SELECT spec.product_id, product.category_key, spec.thickness
  FROM public.product_shampoo_specs AS spec
  JOIN public.products AS product
    ON product.id = spec.product_id
   AND product.category_key = 'shampoo'

  UNION ALL

  SELECT spec.product_id, product.category_key, spec.thickness
  FROM public.product_conditioner_specs AS spec
  JOIN public.products AS product
    ON product.id = spec.product_id
   AND product.category_key = 'conditioner'

  UNION ALL

  SELECT eligibility.product_id, product.category_key, eligibility.thickness
  FROM public.product_leave_in_eligibility AS eligibility
  JOIN public.products AS product
    ON product.id = eligibility.product_id
   AND product.category_key = 'leave_in'

  UNION ALL

  SELECT eligibility.product_id, product.category_key, eligibility.thickness
  FROM public.product_oil_eligibility AS eligibility
  JOIN public.products AS product
    ON product.id = eligibility.product_id
   AND product.category_key = 'oil'
) AS source
WHERE source.thickness IN ('fine', 'normal', 'coarse')
  AND source.category_key NOT IN ('heat_protectant', 'dry_shampoo', 'scalp_care')
ON CONFLICT (product_id, category_key, thickness) DO NOTHING;

INSERT INTO public.product_concern_eligibility (product_id, category_key, concern_key)
SELECT DISTINCT product.id, product.category_key, concern.value
FROM public.products AS product
CROSS JOIN LATERAL unnest(coalesce(product.suitable_concerns, '{}'::text[])) AS concern(value)
WHERE length(btrim(concern.value)) > 0
ON CONFLICT (product_id, category_key, concern_key) DO NOTHING;

-- Transitional projection for writers that still own the legacy arrays. The
-- aa_ pass inserts parent eligibility before surviving legacy tuple triggers;
-- the zz_ pass prunes removed values after those tuple triggers have settled.
CREATE FUNCTION public.catalog_authority_sync_product_eligibility_compat_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_NAME LIKE 'zz_%' THEN
    DELETE FROM public.product_thickness_eligibility AS eligibility
    WHERE eligibility.product_id = NEW.id
      AND eligibility.category_key = NEW.category_key
      AND (
        NEW.category_key IN ('heat_protectant', 'dry_shampoo', 'scalp_care')
        OR NOT (
          eligibility.thickness = ANY (
            COALESCE(NEW.suitable_thicknesses, '{}'::text[])
          )
        )
      )
      AND NOT (
        (NEW.category_key = 'shampoo' AND EXISTS (
          SELECT 1 FROM public.product_shampoo_specs AS fact
          WHERE fact.product_id = NEW.id AND fact.thickness = eligibility.thickness
        ))
        OR (NEW.category_key = 'conditioner' AND EXISTS (
          SELECT 1 FROM public.product_conditioner_specs AS fact
          WHERE fact.product_id = NEW.id AND fact.thickness = eligibility.thickness
        ))
        OR (NEW.category_key = 'leave_in' AND EXISTS (
          SELECT 1 FROM public.product_leave_in_eligibility AS fact
          WHERE fact.product_id = NEW.id AND fact.thickness = eligibility.thickness
        ))
        OR (NEW.category_key = 'oil' AND EXISTS (
          SELECT 1 FROM public.product_oil_eligibility AS fact
          WHERE fact.product_id = NEW.id AND fact.thickness = eligibility.thickness
        ))
      );

    DELETE FROM public.product_concern_eligibility AS eligibility
    WHERE eligibility.product_id = NEW.id
      AND eligibility.category_key = NEW.category_key
      AND NOT (
        eligibility.concern_key = ANY (
          COALESCE(NEW.suitable_concerns, '{}'::text[])
        )
      );
  END IF;

  INSERT INTO public.product_thickness_eligibility (product_id, category_key, thickness)
  SELECT NEW.id, NEW.category_key, thickness.value
  FROM pg_catalog.unnest(
    COALESCE(NEW.suitable_thicknesses, '{}'::text[])
  ) AS thickness(value)
  WHERE thickness.value IN ('fine', 'normal', 'coarse')
    AND NEW.category_key NOT IN ('heat_protectant', 'dry_shampoo', 'scalp_care')
  ON CONFLICT (product_id, category_key, thickness) DO NOTHING;

  INSERT INTO public.product_concern_eligibility (product_id, category_key, concern_key)
  SELECT NEW.id, NEW.category_key, concern.value
  FROM pg_catalog.unnest(
    COALESCE(NEW.suitable_concerns, '{}'::text[])
  ) AS concern(value)
  WHERE pg_catalog.length(pg_catalog.btrim(concern.value)) > 0
  ON CONFLICT (product_id, category_key, concern_key) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.catalog_authority_sync_product_eligibility_compat_v1()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER aa_catalog_authority_sync_product_eligibility_compat_v1
  AFTER INSERT OR UPDATE OF suitable_thicknesses, suitable_concerns ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_sync_product_eligibility_compat_v1();

CREATE TRIGGER zz_catalog_authority_sync_product_eligibility_compat_v1
  AFTER INSERT OR UPDATE OF suitable_thicknesses, suitable_concerns ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_sync_product_eligibility_compat_v1();

ALTER TABLE public.product_shampoo_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'shampoo',
  ADD CONSTRAINT product_shampoo_specs_category_key_check
    CHECK (category_key = 'shampoo'),
  ADD CONSTRAINT product_shampoo_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_conditioner_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'conditioner',
  ADD CONSTRAINT product_conditioner_specs_category_key_check
    CHECK (category_key = 'conditioner'),
  ADD CONSTRAINT product_conditioner_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_conditioner_rerank_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'conditioner',
  ADD CONSTRAINT product_conditioner_rerank_specs_category_key_check
    CHECK (category_key = 'conditioner'),
  ADD CONSTRAINT product_conditioner_rerank_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_leave_in_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'leave_in',
  ADD CONSTRAINT product_leave_in_specs_category_key_check
    CHECK (category_key = 'leave_in'),
  ADD CONSTRAINT product_leave_in_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_leave_in_eligibility
  ADD COLUMN category_key text NOT NULL DEFAULT 'leave_in',
  ADD CONSTRAINT product_leave_in_eligibility_category_key_check
    CHECK (category_key = 'leave_in'),
  ADD CONSTRAINT product_leave_in_eligibility_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_heat_protectant_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'heat_protectant',
  ADD CONSTRAINT product_heat_protectant_specs_category_key_check
    CHECK (category_key = 'heat_protectant'),
  ADD CONSTRAINT product_heat_protectant_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_oil_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'oil',
  ADD CONSTRAINT product_oil_specs_category_key_check
    CHECK (category_key = 'oil'),
  ADD CONSTRAINT product_oil_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_oil_eligibility
  ADD COLUMN category_key text NOT NULL DEFAULT 'oil',
  ADD CONSTRAINT product_oil_eligibility_category_key_check
    CHECK (category_key = 'oil'),
  ADD CONSTRAINT product_oil_eligibility_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

-- Contextual writers may create a reviewed thickness tuple before legacy arrays
-- are updated. Project that tuple first so the new FK can enforce the write.
CREATE FUNCTION public.catalog_authority_sync_contextual_thickness_compat_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.product_thickness_eligibility (product_id, category_key, thickness)
  VALUES (NEW.product_id, NEW.category_key, NEW.thickness)
  ON CONFLICT (product_id, category_key, thickness) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.catalog_authority_sync_contextual_thickness_compat_v1()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER catalog_authority_sync_contextual_thickness_compat_v1
  BEFORE INSERT OR UPDATE OF product_id, category_key, thickness
  ON public.product_shampoo_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_sync_contextual_thickness_compat_v1();

CREATE TRIGGER catalog_authority_sync_contextual_thickness_compat_v1
  BEFORE INSERT OR UPDATE OF product_id, category_key, thickness
  ON public.product_conditioner_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_sync_contextual_thickness_compat_v1();

CREATE TRIGGER catalog_authority_sync_contextual_thickness_compat_v1
  BEFORE INSERT OR UPDATE OF product_id, category_key, thickness
  ON public.product_leave_in_eligibility
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_sync_contextual_thickness_compat_v1();

CREATE TRIGGER catalog_authority_sync_contextual_thickness_compat_v1
  BEFORE INSERT OR UPDATE OF product_id, category_key, thickness
  ON public.product_oil_eligibility
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_sync_contextual_thickness_compat_v1();

-- Remove a contextual-only projection after its last tuple disappears. A
-- thickness retained by the broad legacy array remains eligible during expand.
CREATE FUNCTION public.catalog_authority_prune_contextual_thickness_compat_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = OLD.product_id
      AND product.category_key = OLD.category_key
      AND OLD.thickness = ANY (
        COALESCE(product.suitable_thicknesses, '{}'::text[])
      )
  ) OR EXISTS (
    SELECT 1 FROM public.product_shampoo_specs AS fact
    WHERE fact.product_id = OLD.product_id
      AND fact.category_key = OLD.category_key
      AND fact.thickness = OLD.thickness
  ) OR EXISTS (
    SELECT 1 FROM public.product_conditioner_specs AS fact
    WHERE fact.product_id = OLD.product_id
      AND fact.category_key = OLD.category_key
      AND fact.thickness = OLD.thickness
  ) OR EXISTS (
    SELECT 1 FROM public.product_leave_in_eligibility AS fact
    WHERE fact.product_id = OLD.product_id
      AND fact.category_key = OLD.category_key
      AND fact.thickness = OLD.thickness
  ) OR EXISTS (
    SELECT 1 FROM public.product_oil_eligibility AS fact
    WHERE fact.product_id = OLD.product_id
      AND fact.category_key = OLD.category_key
      AND fact.thickness = OLD.thickness
  ) THEN
    RETURN OLD;
  END IF;

  DELETE FROM public.product_thickness_eligibility AS eligibility
  WHERE eligibility.product_id = OLD.product_id
    AND eligibility.category_key = OLD.category_key
    AND eligibility.thickness = OLD.thickness;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.catalog_authority_prune_contextual_thickness_compat_v1()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER catalog_authority_prune_contextual_thickness_compat_v1
  AFTER DELETE OR UPDATE OF product_id, category_key, thickness
  ON public.product_shampoo_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_prune_contextual_thickness_compat_v1();

CREATE TRIGGER catalog_authority_prune_contextual_thickness_compat_v1
  AFTER DELETE OR UPDATE OF product_id, category_key, thickness
  ON public.product_conditioner_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_prune_contextual_thickness_compat_v1();

CREATE TRIGGER catalog_authority_prune_contextual_thickness_compat_v1
  AFTER DELETE OR UPDATE OF product_id, category_key, thickness
  ON public.product_leave_in_eligibility
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_prune_contextual_thickness_compat_v1();

CREATE TRIGGER catalog_authority_prune_contextual_thickness_compat_v1
  AFTER DELETE OR UPDATE OF product_id, category_key, thickness
  ON public.product_oil_eligibility
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_authority_prune_contextual_thickness_compat_v1();

ALTER TABLE public.product_mask_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'mask',
  ADD CONSTRAINT product_mask_specs_category_key_check
    CHECK (category_key = 'mask'),
  ADD CONSTRAINT product_mask_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_scalp_care_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'scalp_care',
  ADD CONSTRAINT product_scalp_care_specs_category_key_check
    CHECK (category_key = 'scalp_care'),
  ADD CONSTRAINT product_scalp_care_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_dry_shampoo_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'dry_shampoo',
  ADD CONSTRAINT product_dry_shampoo_specs_category_key_check
    CHECK (category_key = 'dry_shampoo'),
  ADD CONSTRAINT product_dry_shampoo_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_bondbuilder_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'bondbuilder',
  ADD CONSTRAINT product_bondbuilder_specs_category_key_check
    CHECK (category_key = 'bondbuilder'),
  ADD CONSTRAINT product_bondbuilder_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

ALTER TABLE public.product_deep_cleansing_shampoo_specs
  ADD COLUMN category_key text NOT NULL DEFAULT 'deep_cleansing_shampoo',
  ADD CONSTRAINT product_deep_cleansing_shampoo_specs_category_key_check
    CHECK (category_key = 'deep_cleansing_shampoo'),
  ADD CONSTRAINT product_deep_cleansing_shampoo_specs_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

-- category is retained for compatibility with every current writer. The
-- generated alias cannot diverge and lets the exact protocol join the same
-- composite identity contract without changing application behavior.
ALTER TABLE public.product_application_protocols
  ADD COLUMN category_key text GENERATED ALWAYS AS (category) STORED,
  ADD CONSTRAINT product_application_protocols_product_category_fkey
    FOREIGN KEY (product_id, category_key)
    REFERENCES public.products(id, category_key)
    ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

CREATE INDEX product_shampoo_specs_product_category_idx
  ON public.product_shampoo_specs (product_id, category_key);
CREATE INDEX product_conditioner_specs_product_category_idx
  ON public.product_conditioner_specs (product_id, category_key);
CREATE INDEX product_conditioner_rerank_specs_product_category_idx
  ON public.product_conditioner_rerank_specs (product_id, category_key);
CREATE INDEX product_leave_in_specs_product_category_idx
  ON public.product_leave_in_specs (product_id, category_key);
CREATE INDEX product_leave_in_eligibility_product_category_idx
  ON public.product_leave_in_eligibility (product_id, category_key);
CREATE INDEX product_heat_protectant_specs_product_category_idx
  ON public.product_heat_protectant_specs (product_id, category_key);
CREATE INDEX product_oil_specs_product_category_idx
  ON public.product_oil_specs (product_id, category_key);
CREATE INDEX product_oil_eligibility_product_category_idx
  ON public.product_oil_eligibility (product_id, category_key);
CREATE INDEX product_mask_specs_product_category_idx
  ON public.product_mask_specs (product_id, category_key);
CREATE INDEX product_scalp_care_specs_product_category_idx
  ON public.product_scalp_care_specs (product_id, category_key);
CREATE INDEX product_dry_shampoo_specs_product_category_idx
  ON public.product_dry_shampoo_specs (product_id, category_key);
CREATE INDEX product_bondbuilder_specs_product_category_idx
  ON public.product_bondbuilder_specs (product_id, category_key);
CREATE INDEX product_deep_cleansing_shampoo_specs_product_category_idx
  ON public.product_deep_cleansing_shampoo_specs (product_id, category_key);
CREATE INDEX product_application_protocols_product_category_idx
  ON public.product_application_protocols (product_id, category_key);

ALTER TABLE public.product_shampoo_specs
  ADD CONSTRAINT product_shampoo_specs_thickness_eligibility_fkey
    FOREIGN KEY (product_id, category_key, thickness)
    REFERENCES public.product_thickness_eligibility(product_id, category_key, thickness)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED
    NOT VALID;

ALTER TABLE public.product_conditioner_specs
  ADD CONSTRAINT product_conditioner_specs_thickness_eligibility_fkey
    FOREIGN KEY (product_id, category_key, thickness)
    REFERENCES public.product_thickness_eligibility(product_id, category_key, thickness)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED
    NOT VALID;

ALTER TABLE public.product_leave_in_eligibility
  ADD CONSTRAINT product_leave_in_eligibility_thickness_eligibility_fkey
    FOREIGN KEY (product_id, category_key, thickness)
    REFERENCES public.product_thickness_eligibility(product_id, category_key, thickness)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED
    NOT VALID;

ALTER TABLE public.product_oil_eligibility
  ADD CONSTRAINT product_oil_eligibility_thickness_eligibility_fkey
    FOREIGN KEY (product_id, category_key, thickness)
    REFERENCES public.product_thickness_eligibility(product_id, category_key, thickness)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED
    NOT VALID;

COMMENT ON TABLE public.product_thickness_eligibility IS
  'Canonical cross-category thickness eligibility. products.suitable_thicknesses is compatibility-only.';
COMMENT ON TABLE public.product_concern_eligibility IS
  'Canonical cross-category concern eligibility. products.suitable_concerns is compatibility-only.';
