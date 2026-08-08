-- Personal Plan-native Product Intake association.
--
-- This migration deliberately leaves user_product_usage and its lifecycle
-- functions untouched.  Personal Plan submissions use user_products instead,
-- so several owned products in the same category never consume the legacy
-- one-row-per-category slot.

ALTER TABLE public.product_submissions
  ADD COLUMN IF NOT EXISTS user_product_id uuid;

ALTER TABLE public.product_submissions
  ADD COLUMN IF NOT EXISTS personal_plan_request_fingerprint text;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_personal_plan_request_fingerprint_check
  CHECK (
    personal_plan_request_fingerprint IS NULL
    OR personal_plan_request_fingerprint ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_source_check,
  DROP CONSTRAINT IF EXISTS product_submissions_user_product_fkey,
  DROP CONSTRAINT IF EXISTS product_submissions_association_path_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_source_check
  CHECK (source IN ('onboarding', 'chat', 'personal_plan')),
  ADD CONSTRAINT product_submissions_user_product_fkey
  FOREIGN KEY (user_product_id, user_id, category)
  REFERENCES public.user_products(id, user_id, category)
  ON DELETE RESTRICT,
  ADD CONSTRAINT product_submissions_association_path_check
  CHECK (
    NOT (user_product_usage_id IS NOT NULL AND user_product_id IS NOT NULL)
    AND (
      source <> 'personal_plan'
      OR (user_product_id IS NOT NULL AND user_product_usage_id IS NULL)
    )
  );

CREATE INDEX IF NOT EXISTS idx_product_submissions_user_product_id
  ON public.product_submissions (user_product_id);

CREATE INDEX IF NOT EXISTS idx_product_submissions_personal_plan_request_fingerprint
  ON public.product_submissions (user_product_id, personal_plan_request_fingerprint)
  WHERE source = 'personal_plan';

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_submissions_one_open_per_user_product
  ON public.product_submissions (user_product_id)
  WHERE user_product_id IS NOT NULL
    AND status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');

-- The foundation trigger retains its previous checks and additionally makes
-- the new association source-specific and owner/category-safe.  The composite
-- foreign key is the durable guard; the explicit check produces a useful
-- failure before a reviewer transition can act on a forged row.
CREATE OR REPLACE FUNCTION public.validate_product_submission_foundation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  category_supported boolean;
  user_prefix text := NEW.user_id::text || '/';
  tmp_prefix text := 'tmp/' || NEW.user_id::text || '/';
BEGIN
  SELECT is_intake_supported
  INTO category_supported
  FROM public.product_categories
  WHERE key = NEW.category;

  IF category_supported IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Product intake category % is not supported', NEW.category;
  END IF;

  IF NEW.front_image_path IS NOT NULL
      AND NEW.front_image_path NOT LIKE user_prefix || NEW.id::text || '/%'
      AND NEW.front_image_path NOT LIKE tmp_prefix || '%' THEN
    RAISE EXCEPTION 'front_image_path does not belong to product submission owner/path';
  END IF;

  IF NEW.barcode_image_path IS NOT NULL
      AND NEW.barcode_image_path NOT LIKE user_prefix || NEW.id::text || '/%'
      AND NEW.barcode_image_path NOT LIKE tmp_prefix || '%' THEN
    RAISE EXCEPTION 'barcode_image_path does not belong to product submission owner/path';
  END IF;

  IF NEW.user_product_usage_id IS NOT NULL AND NEW.user_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'product submission must use exactly one association path';
  END IF;

  IF NEW.source = 'personal_plan'
      AND (NEW.user_product_id IS NULL OR NEW.user_product_usage_id IS NOT NULL) THEN
    RAISE EXCEPTION 'personal_plan submissions require only user_product_id';
  END IF;

  IF NEW.user_product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_products AS user_product
        WHERE user_product.id = NEW.user_product_id
          AND user_product.user_id = NEW.user_id
          AND user_product.category = NEW.category
      ) THEN
    RAISE EXCEPTION 'user_product_id must belong to the same user and category';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_product_submission_foundation ON public.product_submissions;
CREATE TRIGGER validate_product_submission_foundation
  BEFORE INSERT OR UPDATE OF user_id, category, source, user_product_usage_id,
    user_product_id, front_image_path, barcode_image_path
  ON public.product_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_submission_foundation();

-- Legacy association validation is preserved verbatim in intent.  Keeping the
-- definition here makes the final active trigger authority explicit after the
-- parallel user_products path is added.
CREATE OR REPLACE FUNCTION public.validate_user_product_usage_submission_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  linked_status text;
  linked_approved_product_id uuid;
BEGIN
  IF NEW.product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = NEW.product_id AND category_key = NEW.category
      ) THEN
    RAISE EXCEPTION 'user_product_usage.product_id must match usage category';
  END IF;

  IF NEW.product_submission_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, approved_product_id
  INTO linked_status, linked_approved_product_id
  FROM public.product_submissions
  WHERE id = NEW.product_submission_id
    AND user_id = NEW.user_id
    AND category = NEW.category;

  IF linked_status IS NULL THEN
    RAISE EXCEPTION 'product_submission_id must belong to the same user and category';
  END IF;
  IF linked_status IN ('rejected', 'cancelled_by_user') THEN
    RAISE EXCEPTION 'closed unsuccessful product submissions cannot remain linked to user_product_usage';
  END IF;
  IF NEW.match_status = 'matched' AND linked_status NOT IN ('approved', 'matched_existing') THEN
    RAISE EXCEPTION 'matched user_product_usage links require a successful product submission';
  END IF;
  IF linked_status IN ('approved', 'matched_existing') AND linked_approved_product_id IS NULL THEN
    RAISE EXCEPTION 'successful closed product submissions require approved_product_id';
  END IF;
  IF linked_status IN ('approved', 'matched_existing')
      AND NEW.product_id IS DISTINCT FROM linked_approved_product_id THEN
    RAISE EXCEPTION 'successful closed product submissions require user_product_usage.product_id to equal approved_product_id';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_user_product_usage_submission_link ON public.user_product_usage;
CREATE TRIGGER validate_user_product_usage_submission_link
  BEFORE INSERT OR UPDATE OF product_submission_id, user_id, category, product_id, match_status
  ON public.user_product_usage
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_product_usage_submission_link();

CREATE OR REPLACE FUNCTION public.protect_user_product_usage_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE caller_is_admin boolean;
BEGIN
  IF auth.role() = 'service_role' OR coalesce(current_setting('request.jwt.claims', true), '') = '' THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) INTO caller_is_admin;
  IF caller_is_admin THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.brand_text IS NOT NULL OR NEW.product_id IS NOT NULL
        OR NEW.product_submission_id IS NOT NULL OR NEW.match_status IS DISTINCT FROM 'text_only'
        OR NEW.intake_method IS NOT NULL OR NEW.source IS NOT NULL OR NEW.front_image_path IS NOT NULL THEN
      RAISE EXCEPTION 'review-managed product usage fields require service or admin access';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.brand_text IS DISTINCT FROM OLD.brand_text OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.product_submission_id IS DISTINCT FROM OLD.product_submission_id
      OR NEW.match_status IS DISTINCT FROM OLD.match_status OR NEW.intake_method IS DISTINCT FROM OLD.intake_method
      OR NEW.source IS DISTINCT FROM OLD.source OR NEW.front_image_path IS DISTINCT FROM OLD.front_image_path THEN
    RAISE EXCEPTION 'review-managed product usage fields require service or admin access';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_user_product_usage_review_fields ON public.user_product_usage;
CREATE TRIGGER protect_user_product_usage_review_fields
  BEFORE INSERT OR UPDATE OF brand_text, product_id, product_submission_id, match_status,
    intake_method, source, front_image_path
  ON public.user_product_usage
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_product_usage_review_fields();

CREATE OR REPLACE FUNCTION public.validate_user_product_submission_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.catalog_product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = NEW.catalog_product_id AND category_key = NEW.category
      ) THEN
    RAISE EXCEPTION 'user_products.catalog_product_id must match user product category';
  END IF;
  IF NEW.identity_status = 'matched' AND NEW.catalog_product_id IS NULL THEN
    RAISE EXCEPTION 'matched user_products require catalog_product_id';
  END IF;
  IF NEW.identity_status IN ('pending_review', 'needs_more_info', 'text_only')
      AND NEW.catalog_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'unresolved user_products cannot retain catalog_product_id';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_user_product_submission_link ON public.user_products;
CREATE TRIGGER validate_user_product_submission_link
  BEFORE INSERT OR UPDATE OF catalog_product_id, identity_status, category
  ON public.user_products
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_product_submission_link();

CREATE OR REPLACE FUNCTION public.protect_user_product_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE caller_is_admin boolean;
BEGIN
  IF auth.role() = 'service_role' OR coalesce(current_setting('request.jwt.claims', true), '') = '' THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    INTO caller_is_admin;
  IF caller_is_admin THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.brand_text IS NOT NULL OR NEW.product_name_text IS NOT NULL
        OR NEW.catalog_product_id IS NOT NULL OR NEW.identity_status IS DISTINCT FROM 'text_only'
        OR NEW.ownership_status IS DISTINCT FROM 'owned' THEN
      RAISE EXCEPTION 'review-managed user product fields require service or admin access';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.brand_text IS DISTINCT FROM OLD.brand_text
      OR NEW.product_name_text IS DISTINCT FROM OLD.product_name_text
      OR NEW.catalog_product_id IS DISTINCT FROM OLD.catalog_product_id
      OR NEW.identity_status IS DISTINCT FROM OLD.identity_status
      OR NEW.ownership_status IS DISTINCT FROM OLD.ownership_status THEN
    RAISE EXCEPTION 'review-managed user product fields require service or admin access';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_user_product_review_fields ON public.user_products;
CREATE TRIGGER protect_user_product_review_fields
  BEFORE INSERT OR UPDATE OF brand_text, product_name_text, catalog_product_id, identity_status, ownership_status
  ON public.user_products
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_product_review_fields();

-- Migration two owns the AFTER user_products source-change producer.  These
-- review mutations therefore enqueue through that trigger in the same SQL
-- transaction; this migration deliberately does not create a second producer.
-- The synchronizer fires before status validation (alphabetically before the
-- validate_* trigger).  It keeps the Personal Plan row executable only for a
-- resolved active identity and archives failed/cancelled intake in the same
-- transaction.  Legacy review functions continue to mutate only legacy usage.
CREATE OR REPLACE FUNCTION public.sync_user_product_from_submission_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.user_product_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('approved', 'matched_existing') THEN
    UPDATE public.user_products
    SET catalog_product_id = NEW.approved_product_id,
        identity_status = 'matched',
        ownership_status = 'owned',
        updated_at = NEW.updated_at
    WHERE id = NEW.user_product_id AND user_id = NEW.user_id AND category = NEW.category;
  ELSIF NEW.status = 'needs_more_info' THEN
    UPDATE public.user_products
    SET catalog_product_id = NULL,
        identity_status = 'needs_more_info',
        ownership_status = 'owned',
        updated_at = NEW.updated_at
    WHERE id = NEW.user_product_id AND user_id = NEW.user_id AND category = NEW.category;
  ELSIF NEW.status IN ('rejected', 'cancelled_by_user') THEN
    UPDATE public.user_products
    SET catalog_product_id = NULL,
        identity_status = 'text_only',
        ownership_status = 'archived',
        updated_at = NEW.updated_at
    WHERE id = NEW.user_product_id AND user_id = NEW.user_id AND category = NEW.category;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS aaa_sync_user_product_from_submission_review ON public.product_submissions;
CREATE TRIGGER aaa_sync_user_product_from_submission_review
  BEFORE UPDATE OF status, approved_product_id ON public.product_submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_product_from_submission_review();

CREATE OR REPLACE FUNCTION public.validate_product_submission_status_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status IN ('rejected', 'cancelled_by_user')
      AND EXISTS (
        SELECT 1 FROM public.user_product_usage AS usage WHERE usage.product_submission_id = NEW.id
      ) THEN
    RAISE EXCEPTION 'unsuccessful product submissions must be unlinked from user_product_usage before closing';
  END IF;
  IF NEW.status IN ('approved', 'matched_existing') AND NEW.approved_product_id IS NULL THEN
    RAISE EXCEPTION 'successful product submissions require approved_product_id';
  END IF;
  IF NEW.status IN ('approved', 'matched_existing') AND NOT EXISTS (
    SELECT 1 FROM public.products WHERE id = NEW.approved_product_id AND category_key = NEW.category
  ) THEN
    RAISE EXCEPTION 'successful product submissions require approved_product_id to match submission category';
  END IF;
  IF NEW.status IN ('approved', 'matched_existing')
      AND EXISTS (
        SELECT 1 FROM public.user_product_usage AS usage
        WHERE usage.product_submission_id = NEW.id AND usage.product_id IS DISTINCT FROM NEW.approved_product_id
      ) THEN
    RAISE EXCEPTION 'successful product submissions must link user_product_usage.product_id to approved_product_id before closing';
  END IF;
  IF NEW.user_product_id IS NOT NULL AND NEW.status IN ('approved', 'matched_existing')
      AND NOT EXISTS (
        SELECT 1 FROM public.user_products AS user_product
        WHERE user_product.id = NEW.user_product_id AND user_product.user_id = NEW.user_id
          AND user_product.category = NEW.category AND user_product.catalog_product_id = NEW.approved_product_id
          AND user_product.identity_status = 'matched' AND user_product.ownership_status = 'owned'
      ) THEN
    RAISE EXCEPTION 'successful product submissions must resolve the linked user_product';
  END IF;
  IF NEW.user_product_id IS NOT NULL AND NEW.status IN ('rejected', 'cancelled_by_user')
      AND NOT EXISTS (
        SELECT 1 FROM public.user_products AS user_product
        WHERE user_product.id = NEW.user_product_id AND user_product.user_id = NEW.user_id
          AND user_product.category = NEW.category AND user_product.ownership_status = 'archived'
      ) THEN
    RAISE EXCEPTION 'unsuccessful product submissions must archive the linked user_product';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_product_submission_status_link ON public.product_submissions;
CREATE TRIGGER validate_product_submission_status_link
  BEFORE INSERT OR UPDATE OF status, approved_product_id, user_product_usage_id, user_product_id, category
  ON public.product_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_submission_status_link();

CREATE OR REPLACE FUNCTION public.product_intake_create_submission_for_user_product(
  p_user_id uuid,
  p_user_product_id uuid,
  p_category text,
  p_frequency_range text,
  p_intake_method text,
  p_brand_text text DEFAULT NULL,
  p_product_name_text text DEFAULT NULL,
  p_front_image_path text DEFAULT NULL,
  p_barcode_image_path text DEFAULT NULL,
  p_source_conversation_id uuid DEFAULT NULL,
  p_request_fingerprint text DEFAULT NULL,
  p_created_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE user_product_row public.user_products%ROWTYPE;
DECLARE submission_row public.product_submissions%ROWTYPE;
DECLARE replayed boolean := false;
BEGIN
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'personal plan request fingerprint is invalid' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO user_product_row
  FROM public.user_products
  WHERE id = p_user_product_id AND user_id = p_user_id
  FOR UPDATE;
  IF user_product_row.id IS NULL THEN
    INSERT INTO public.user_products(
      id, user_id, category, brand_text, product_name_text, identity_status,
      ownership_status, intake_source, created_at, updated_at
    ) VALUES (
      p_user_product_id, p_user_id, p_category, p_brand_text, p_product_name_text,
      'pending_review', 'owned', 'intake_fallback', p_created_at, p_created_at
    )
    RETURNING * INTO user_product_row;
  END IF;
  IF user_product_row.category IS DISTINCT FROM p_category THEN
    RAISE EXCEPTION 'personal plan user product category mismatch';
  END IF;
  IF user_product_row.ownership_status <> 'owned' THEN
    RAISE EXCEPTION 'archived user product cannot start Product Intake';
  END IF;
  IF user_product_row.catalog_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'matched user product does not need Product Intake';
  END IF;
  SELECT * INTO submission_row
  FROM public.product_submissions
  WHERE user_product_id = user_product_row.id
    AND status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info')
  FOR UPDATE;
  IF submission_row.id IS NOT NULL THEN
    IF submission_row.personal_plan_request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
      RAISE EXCEPTION 'personal plan idempotency key was reused with different input' USING ERRCODE = '23505';
    END IF;
    replayed := true;
    SELECT * INTO user_product_row FROM public.user_products WHERE id = user_product_row.id;
    RETURN jsonb_build_object('userProduct', to_jsonb(user_product_row), 'submission', to_jsonb(submission_row), 'replayed', replayed);
  END IF;
  UPDATE public.user_products
  SET identity_status = 'pending_review', updated_at = p_created_at
  WHERE id = user_product_row.id;
  BEGIN
    INSERT INTO public.product_submissions (
      user_id, user_product_id, source, source_conversation_id, intake_method,
      category, brand_text, product_name_text, frequency_range, front_image_path,
      barcode_image_path, personal_plan_request_fingerprint, created_at, updated_at
    ) VALUES (
      p_user_id, user_product_row.id, 'personal_plan', p_source_conversation_id,
      p_intake_method, user_product_row.category, p_brand_text, p_product_name_text,
      p_frequency_range, p_front_image_path, p_barcode_image_path, p_request_fingerprint, p_created_at, p_created_at
    ) RETURNING * INTO submission_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'open Personal Plan product submission already exists for user product'
      USING ERRCODE = '23505';
  END;
  SELECT * INTO user_product_row FROM public.user_products WHERE id = user_product_row.id;
  RETURN jsonb_build_object('userProduct', to_jsonb(user_product_row), 'submission', to_jsonb(submission_row), 'replayed', replayed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_cancel_submission_for_user_product(
  p_user_id uuid,
  p_user_product_id uuid,
  p_submission_id uuid,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE submission_row public.product_submissions%ROWTYPE;
DECLARE user_product_row public.user_products%ROWTYPE;
BEGIN
  SELECT * INTO submission_row FROM public.product_submissions
  WHERE id = p_submission_id AND user_id = p_user_id AND user_product_id = p_user_product_id
  FOR UPDATE;
  IF submission_row.id IS NULL THEN RAISE EXCEPTION 'personal plan product submission not found'; END IF;
  IF submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission is not open for cancellation';
  END IF;
  SELECT * INTO user_product_row FROM public.user_products
  WHERE id = p_user_product_id AND user_id = p_user_id AND category = submission_row.category
  FOR UPDATE;
  IF user_product_row.id IS NULL THEN RAISE EXCEPTION 'linked personal plan user product not found'; END IF;
  UPDATE public.product_submissions
  SET status = 'cancelled_by_user', cleanup_after = COALESCE(cleanup_after, p_updated_at + interval '30 days'),
      updated_at = p_updated_at
  WHERE id = submission_row.id
  RETURNING * INTO submission_row;
  SELECT * INTO user_product_row FROM public.user_products WHERE id = p_user_product_id;
  RETURN jsonb_build_object('userProduct', to_jsonb(user_product_row), 'submission', to_jsonb(submission_row));
END;
$function$;

-- The repository has no self-service erasure surface, but the established
-- privileged account-erasure workflow needs one ordered step for this new
-- aggregate. The transaction-local owner key is the only immutable-trigger
-- bypass and is cleared before returning.
CREATE OR REPLACE FUNCTION public.personal_plan_erase_owner_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  deleted_plans integer := 0;
  deleted_user_products integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'personal plan erasure requires an owner id' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.set_config('app.personal_plan_erasure_user_id', p_user_id::text, true);

  -- Product Intake owns this restrictive association and must release it
  -- before the canonical user-product identities can be removed.
  DELETE FROM public.product_submissions
   WHERE user_id = p_user_id AND user_product_id IS NOT NULL;

  UPDATE public.personal_plans
     SET current_initial_need_version_id = NULL,
         current_refined_need_version_id = NULL,
         active_routine_version_id = NULL,
         pending_routine_proposal_id = NULL
   WHERE user_id = p_user_id;

  DELETE FROM public.personal_plan_routine_source_change_outbox WHERE user_id = p_user_id;
  DELETE FROM public.personal_plan_routine_proposals WHERE user_id = p_user_id;
  DELETE FROM public.personal_plan_routine_versions WHERE user_id = p_user_id;
  DELETE FROM public.personal_plan_portfolio_versions WHERE user_id = p_user_id;
  DELETE FROM public.personal_plan_product_drafts WHERE user_id = p_user_id;
  DELETE FROM public.personal_plan_refinement_drafts WHERE user_id = p_user_id;
  DELETE FROM public.personal_plan_need_versions WHERE user_id = p_user_id;
  DELETE FROM public.personal_plans WHERE user_id = p_user_id;
  GET DIAGNOSTICS deleted_plans = ROW_COUNT;
  DELETE FROM public.user_products WHERE user_id = p_user_id;
  GET DIAGNOSTICS deleted_user_products = ROW_COUNT;

  PERFORM pg_catalog.set_config('app.personal_plan_erasure_user_id', '', true);
  RETURN pg_catalog.jsonb_build_object(
    'outcome', 'erased',
    'personalPlansDeleted', deleted_plans,
    'userProductsDeleted', deleted_user_products
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_create_submission_for_user_product(uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_cancel_submission_for_user_product(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_erase_owner_data(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_product_submission_foundation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_user_product_usage_submission_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_user_product_usage_review_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_user_product_submission_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_user_product_review_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_product_submission_status_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_user_product_from_submission_review() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_create_submission_for_user_product(uuid, uuid, text, text, text, text, text, text, text, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_cancel_submission_for_user_product(uuid, uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_erase_owner_data(uuid) TO service_role;
