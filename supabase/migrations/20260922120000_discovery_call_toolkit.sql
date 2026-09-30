-- Discovery-call toolkit: token-gated participant intake plus the admin
-- cockpit's keep/swap decisions for Nick's manual one-on-one calls.
-- Spec: docs/superpowers/specs/2026-09-22-discovery-call-toolkit-design.md (Rev. 4)
--
-- Four tables, all service-only: every surface that touches them runs behind the
-- discovery middleware gate or the admin gate on the service-role client, so
-- anon/authenticated get no table privilege at all (same doctrine as
-- public.scan_wishlist, migration 20260820100200). RLS stays enabled with a
-- service_role policy so a future direct surface starts closed, not open.

CREATE TABLE public.discovery_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (display_name = btrim(display_name) AND display_name <> ''),
  normalized_email text NOT NULL CHECK (
    normalized_email = lower(btrim(normalized_email))
    AND normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  token_version integer NOT NULL DEFAULT 1 CHECK (token_version > 0),
  claimed_user_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_enrollments_claim_pair CHECK (
    (claimed_user_id IS NULL) = (claimed_at IS NULL)
  )
);

-- One live invitation per participant, and one live enrollment per account:
-- both partial so a revoked enrollment never blocks re-inviting the same person.
CREATE UNIQUE INDEX discovery_enrollments_one_current_email
  ON public.discovery_enrollments (normalized_email)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX discovery_enrollments_one_current_claimed_user
  ON public.discovery_enrollments (claimed_user_id)
  WHERE claimed_user_id IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE public.discovery_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE
    REFERENCES public.discovery_enrollments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'submitted')),
  submitted_at timestamptz,
  call_finalized_at timestamptz,
  finalized_source_hash text CHECK (
    finalized_source_hash IS NULL
    OR (finalized_source_hash = btrim(finalized_source_hash) AND finalized_source_hash <> '')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_intakes_submitted_pair CHECK (
    (state = 'submitted') = (submitted_at IS NOT NULL)
  ),
  -- Finalising is a post-call curation step on a completed intake.
  CONSTRAINT discovery_intakes_finalize_requires_submit CHECK (
    call_finalized_at IS NULL OR state = 'submitted'
  ),
  -- The fingerprint is what lets the PDF warn that the engine output drifted
  -- since finalize; it is meaningless without the timestamp and vice versa.
  CONSTRAINT discovery_intakes_finalized_pair CHECK (
    (call_finalized_at IS NULL) = (finalized_source_hash IS NULL)
  )
);

CREATE INDEX discovery_intakes_user ON public.discovery_intakes (user_id);

CREATE TABLE public.discovery_intake_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.discovery_intakes (id) ON DELETE CASCADE,
  -- Mirrors SUPPORTED_PRODUCT_CATEGORY_KEYS (src/lib/product-identity/index.ts),
  -- the constant POST /api/scan/submit validates against. A drift guard test
  -- pins this list equal (as a set) to that constant,
  -- PERSONAL_PLAN_PRODUCT_CATEGORIES and STAGE1_CATEGORY_ORDER.
  category text NOT NULL CHECK (category IN (
    'shampoo',
    'conditioner',
    'leave_in',
    'mask',
    'oil',
    'dry_shampoo',
    'deep_cleansing_shampoo',
    'bondbuilder',
    'heat_protectant',
    'scalp_care'
  )),
  source text NOT NULL CHECK (source IN (
    'catalog_search',
    'barcode',
    'barcode_unknown',
    'dm_search',
    'name_research',
    'none'
  )),
  brand_text text CHECK (
    brand_text IS NULL OR (brand_text = btrim(brand_text) AND brand_text <> '')
  ),
  product_name_text text CHECK (
    product_name_text IS NULL
    OR (product_name_text = btrim(product_name_text) AND product_name_text <> '')
  ),
  barcode_identifier text CHECK (barcode_identifier IS NULL OR barcode_identifier ~ '^[0-9]{8,14}$'),
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  product_submission_id uuid REFERENCES public.product_submissions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- „benutze ich nicht" is an explicit, stored answer — and carries no product.
  CONSTRAINT discovery_intake_items_none_is_empty CHECK (
    source <> 'none'
    OR (
      brand_text IS NULL
      AND product_name_text IS NULL
      AND barcode_identifier IS NULL
      AND product_id IS NULL
      AND product_submission_id IS NULL
    )
  ),
  -- Every captured product carries at least one identity the cockpit can render.
  CONSTRAINT discovery_intake_items_captured_has_identity CHECK (
    source = 'none'
    OR product_id IS NOT NULL
    OR product_submission_id IS NOT NULL
    OR barcode_identifier IS NOT NULL
    OR product_name_text IS NOT NULL
  )
);

-- Multiple products per category are allowed, but "I use nothing here" is a
-- single answer that cannot coexist with itself.
CREATE UNIQUE INDEX discovery_intake_items_one_none_per_category
  ON public.discovery_intake_items (intake_id, category)
  WHERE source = 'none';

CREATE INDEX discovery_intake_items_intake_category
  ON public.discovery_intake_items (intake_id, category);

CREATE TABLE public.discovery_call_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.discovery_intakes (id) ON DELETE CASCADE,
  -- stage3DecisionKey(category, role, null) → "decision:<category>:<role>:gap".
  decision_key text NOT NULL CHECK (decision_key = btrim(decision_key) AND decision_key <> ''),
  decision text NOT NULL CHECK (decision IN ('keep', 'swap')),
  swap_product_id uuid REFERENCES public.products (id) ON DELETE RESTRICT,
  -- The intake product bound to this routine step; nullable because an ideal
  -- step the participant owns nothing for can still be decided.
  intake_item_id uuid REFERENCES public.discovery_intake_items (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_call_decisions_swap_pair CHECK (
    (decision = 'swap') = (swap_product_id IS NOT NULL)
  ),
  UNIQUE (intake_id, decision_key)
);

CREATE TRIGGER set_updated_at_discovery_enrollments
  BEFORE UPDATE ON public.discovery_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_discovery_intakes
  BEFORE UPDATE ON public.discovery_intakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_discovery_intake_items
  BEFORE UPDATE ON public.discovery_intake_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_discovery_call_decisions
  BEFORE UPDATE ON public.discovery_call_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.discovery_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_intake_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_call_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.discovery_enrollments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.discovery_intakes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.discovery_intake_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.discovery_call_decisions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.discovery_enrollments TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.discovery_intakes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.discovery_intake_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.discovery_call_decisions TO service_role;

CREATE POLICY discovery_enrollments_service_role_all
  ON public.discovery_enrollments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY discovery_intakes_service_role_all
  ON public.discovery_intakes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY discovery_intake_items_service_role_all
  ON public.discovery_intake_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY discovery_call_decisions_service_role_all
  ON public.discovery_call_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.discovery_enrollments IS
  'Service-operated discovery-call invitations; the HMAC invite link binds id + token_version.';
COMMENT ON COLUMN public.discovery_enrollments.token_version IS
  'Version bound into the reproducible HMAC credential. Incrementing rotates the personal link.';
COMMENT ON TABLE public.discovery_intakes IS
  'One product-checklist intake per enrollment; submitted state gates the call, finalized state gates the PDF.';
COMMENT ON COLUMN public.discovery_intakes.finalized_source_hash IS
  'Composed routine sourceHash captured at finalize; the PDF warns when the freshly computed hash differs.';
COMMENT ON TABLE public.discovery_intake_items IS
  'Captured participant inventory; source=none is the explicit "benutze ich nicht" answer.';
COMMENT ON TABLE public.discovery_call_decisions IS
  'Nick''s keep/swap outcome per routine step (decision_key), written only from the admin cockpit.';
