-- Phase 1 product intake foundation.
-- Unknown user products live in product_submissions until review approval.
-- user_product_usage remains the one-product-per-category inventory slot.

DO $$
DECLARE
  unexpected_values text;
BEGIN
  SELECT string_agg(frequency_range || ' (' || row_count || ')', ', ')
  INTO unexpected_values
  FROM (
    SELECT frequency_range, count(*) AS row_count
    FROM public.user_product_usage
    WHERE frequency_range IS NOT NULL
      AND frequency_range NOT IN (
        'rarely',
        '1_2x',
        '3_4x',
        '5_6x',
        'daily',
        'less_than_monthly',
        'monthly_1x',
        'biweekly_1x',
        'weekly_1x',
        'weekly_2x',
        'weekly_3_4x',
        'weekly_5_6x',
        'daily_1x'
      )
    GROUP BY frequency_range
  ) unexpected;

  IF unexpected_values IS NOT NULL THEN
    RAISE EXCEPTION
      'Unexpected user_product_usage.frequency_range values before product intake migration: %',
      unexpected_values;
  END IF;
END $$;

UPDATE public.user_product_usage
SET frequency_range = CASE frequency_range
  WHEN 'rarely' THEN 'less_than_monthly'
  WHEN '1_2x' THEN 'weekly_1x'
  WHEN '3_4x' THEN 'weekly_3_4x'
  WHEN '5_6x' THEN 'weekly_5_6x'
  WHEN 'daily' THEN 'daily_1x'
  ELSE frequency_range
END
WHERE frequency_range IS NOT NULL;

ALTER TABLE public.user_product_usage
  DROP CONSTRAINT IF EXISTS user_product_usage_category_check,
  DROP CONSTRAINT IF EXISTS user_product_usage_frequency_range_check,
  DROP CONSTRAINT IF EXISTS user_product_usage_added_product_frequency_check,
  DROP CONSTRAINT IF EXISTS user_product_usage_match_status_check,
  DROP CONSTRAINT IF EXISTS user_product_usage_match_status_link_check,
  DROP CONSTRAINT IF EXISTS user_product_usage_intake_method_check,
  DROP CONSTRAINT IF EXISTS user_product_usage_source_check,
  DROP CONSTRAINT IF EXISTS user_product_usage_category_fkey,
  DROP CONSTRAINT IF EXISTS user_product_usage_id_user_id_category_unique,
  DROP CONSTRAINT IF EXISTS user_product_usage_product_submission_id_fkey;

ALTER TABLE public.user_product_usage
  ADD COLUMN IF NOT EXISTS brand_text text,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS product_submission_id uuid,
  ADD COLUMN IF NOT EXISTS match_status text NOT NULL DEFAULT 'text_only',
  ADD COLUMN IF NOT EXISTS intake_method text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS front_image_path text;

UPDATE public.user_product_usage
SET match_status = 'text_only'
WHERE match_status IS NULL
   OR match_status NOT IN ('text_only', 'matched', 'pending_review', 'needs_more_info');

UPDATE public.user_product_usage
SET match_status = 'matched'
WHERE product_id IS NOT NULL
  AND product_submission_id IS NULL
  AND match_status = 'text_only';

ALTER TABLE public.user_product_usage
  ALTER COLUMN match_status SET DEFAULT 'text_only',
  ALTER COLUMN match_status SET NOT NULL;

DO $$
DECLARE
  missing_frequency_count integer;
BEGIN
  SELECT count(*)
  INTO missing_frequency_count
  FROM public.user_product_usage
  WHERE frequency_range IS NULL
    AND (
      product_name IS NOT NULL
      OR brand_text IS NOT NULL
      OR product_id IS NOT NULL
      OR product_submission_id IS NOT NULL
      OR intake_method IS NOT NULL
      OR source IS NOT NULL
      OR front_image_path IS NOT NULL
    );

  IF missing_frequency_count > 0 THEN
    RAISE EXCEPTION
      'user_product_usage has % routine product rows without frequency_range',
      missing_frequency_count;
  END IF;
END $$;

ALTER TABLE public.user_product_usage
  ADD CONSTRAINT user_product_usage_frequency_range_check
  CHECK (
    frequency_range IS NULL
    OR frequency_range IN (
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x'
    )
  ),
  ADD CONSTRAINT user_product_usage_added_product_frequency_check
  CHECK (
    frequency_range IS NOT NULL
    OR (
      product_name IS NULL
      AND brand_text IS NULL
      AND
      product_id IS NULL
      AND product_submission_id IS NULL
      AND intake_method IS NULL
      AND source IS NULL
      AND front_image_path IS NULL
    )
  ),
  ADD CONSTRAINT user_product_usage_match_status_check
  CHECK (match_status IN ('text_only', 'matched', 'pending_review', 'needs_more_info')),
  ADD CONSTRAINT user_product_usage_match_status_link_check
  CHECK (
    (
      match_status = 'text_only'
      AND product_id IS NULL
      AND product_submission_id IS NULL
    )
    OR (
      match_status IN ('pending_review', 'needs_more_info')
      AND product_id IS NULL
      AND product_submission_id IS NOT NULL
    )
    OR (
      match_status = 'matched'
      AND product_id IS NOT NULL
    )
  ),
  ADD CONSTRAINT user_product_usage_intake_method_check
  CHECK (intake_method IS NULL OR intake_method IN ('manual', 'photo')),
  ADD CONSTRAINT user_product_usage_source_check
  CHECK (source IS NULL OR source IN ('onboarding', 'chat', 'profile', 'script')),
  ADD CONSTRAINT user_product_usage_category_fkey
  FOREIGN KEY (category)
  REFERENCES public.product_categories(key)
  ON DELETE RESTRICT
  NOT VALID,
  ADD CONSTRAINT user_product_usage_id_user_id_category_unique
  UNIQUE (id, user_id, category);

ALTER TABLE public.user_product_usage
  VALIDATE CONSTRAINT user_product_usage_category_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index idx
    JOIN pg_class table_class
      ON table_class.oid = idx.indrelid
    JOIN pg_namespace table_namespace
      ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_class.relname = 'user_product_usage'
      AND idx.indisunique = true
      AND pg_get_indexdef(idx.indexrelid) ILIKE '%(user_id, category)%'
  ) THEN
    RAISE EXCEPTION 'user_product_usage must keep unique (user_id, category)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_product_usage_id uuid,
  source text NOT NULL CHECK (source IN ('onboarding', 'chat')),
  source_conversation_id uuid,
  intake_method text NOT NULL CHECK (intake_method IN ('manual', 'photo')),
  category text NOT NULL REFERENCES public.product_categories(key) ON DELETE RESTRICT,
  brand_text text,
  product_name_text text,
  frequency_range text NOT NULL,
  front_image_path text,
  barcode_image_path text,
  front_image_validation_status text,
  front_image_validation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  barcode_image_validation_status text,
  barcode_image_validation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  previous_product_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_review',
  researched_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  intake_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  user_facing_resolution_reason text,
  user_facing_next_step text,
  user_facing_missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_sent_at timestamptz,
  cleanup_after timestamptz,
  photos_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_submissions_status_check CHECK (
    status IN (
      'pending_review',
      'researching',
      'ready_for_review',
      'needs_more_info',
      'matched_existing',
      'approved',
      'rejected',
      'cancelled_by_user'
    )
  ),
  CONSTRAINT product_submissions_success_product_check CHECK (
    status NOT IN ('approved', 'matched_existing')
    OR approved_product_id IS NOT NULL
  ),
  CONSTRAINT product_submissions_frequency_range_check CHECK (
    frequency_range IN (
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x'
    )
  ),
  CONSTRAINT product_submissions_front_image_validation_status_check CHECK (
    front_image_validation_status IS NULL
    OR front_image_validation_status IN (
      'valid_product_front',
      'uncertain',
      'not_a_product_photo',
      'unsafe_or_inappropriate'
    )
  ),
  CONSTRAINT product_submissions_barcode_image_validation_status_check CHECK (
    barcode_image_validation_status IS NULL
    OR barcode_image_validation_status IN (
      'valid_barcode',
      'uncertain',
      'not_a_product_photo',
      'unsafe_or_inappropriate'
    )
  ),
  CONSTRAINT product_submissions_user_product_usage_fkey
  FOREIGN KEY (user_product_usage_id, user_id, category)
  REFERENCES public.user_product_usage(id, user_id, category)
  ON DELETE SET NULL (user_product_usage_id),
  CONSTRAINT product_submissions_source_conversation_fkey
  FOREIGN KEY (source_conversation_id, user_id)
  REFERENCES public.conversations(id, user_id)
  ON DELETE SET NULL (source_conversation_id),
  CONSTRAINT product_submissions_id_user_id_category_unique
  UNIQUE (id, user_id, category)
);

ALTER TABLE public.user_product_usage
  ADD CONSTRAINT user_product_usage_product_submission_id_fkey
  FOREIGN KEY (product_submission_id, user_id, category)
  REFERENCES public.product_submissions(id, user_id, category)
  ON DELETE SET NULL (product_submission_id);

CREATE INDEX IF NOT EXISTS idx_user_product_usage_product_id
  ON public.user_product_usage (product_id);

CREATE INDEX IF NOT EXISTS idx_user_product_usage_product_submission_id
  ON public.user_product_usage (product_submission_id);

CREATE INDEX IF NOT EXISTS idx_product_submissions_status_created_at
  ON public.product_submissions (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_product_submissions_user_created_at
  ON public.product_submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_submissions_approved_product_id
  ON public.product_submissions (approved_product_id);

CREATE INDEX IF NOT EXISTS idx_product_submissions_source_conversation_id
  ON public.product_submissions (source_conversation_id);

CREATE INDEX IF NOT EXISTS idx_product_submissions_user_product_usage_id
  ON public.product_submissions (user_product_usage_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_submissions_one_open_per_usage
  ON public.product_submissions (user_product_usage_id)
  WHERE user_product_usage_id IS NOT NULL
    AND status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');

CREATE OR REPLACE FUNCTION public.validate_product_submission_foundation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_product_submission_foundation
  ON public.product_submissions;
CREATE TRIGGER validate_product_submission_foundation
  BEFORE INSERT OR UPDATE OF user_id, category, front_image_path, barcode_image_path
  ON public.product_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_product_submission_foundation();

CREATE OR REPLACE FUNCTION public.validate_user_product_usage_submission_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  linked_status text;
  linked_approved_product_id uuid;
BEGIN
  IF NEW.product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.products
        WHERE id = NEW.product_id
          AND category_key = NEW.category
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

  IF NEW.match_status = 'matched'
      AND linked_status NOT IN ('approved', 'matched_existing') THEN
    RAISE EXCEPTION 'matched user_product_usage links require a successful product submission';
  END IF;

  IF linked_status IN ('approved', 'matched_existing')
      AND linked_approved_product_id IS NULL THEN
    RAISE EXCEPTION 'successful closed product submissions require approved_product_id';
  END IF;

  IF linked_status IN ('approved', 'matched_existing')
      AND NEW.product_id IS DISTINCT FROM linked_approved_product_id THEN
    RAISE EXCEPTION 'successful closed product submissions require user_product_usage.product_id to equal approved_product_id';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_user_product_usage_submission_link
  ON public.user_product_usage;
CREATE TRIGGER validate_user_product_usage_submission_link
  BEFORE INSERT OR UPDATE OF product_submission_id, user_id, category, product_id, match_status
  ON public.user_product_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_product_usage_submission_link();

CREATE OR REPLACE FUNCTION public.protect_user_product_usage_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_admin boolean;
BEGIN
  IF auth.role() = 'service_role'
      OR coalesce(current_setting('request.jwt.claims', true), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
  INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.brand_text IS NOT NULL
        OR NEW.product_id IS NOT NULL
        OR NEW.product_submission_id IS NOT NULL
        OR NEW.match_status IS DISTINCT FROM 'text_only'
        OR NEW.intake_method IS NOT NULL
        OR NEW.source IS NOT NULL
        OR NEW.front_image_path IS NOT NULL THEN
      RAISE EXCEPTION 'review-managed product usage fields require service or admin access';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.brand_text IS DISTINCT FROM OLD.brand_text
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.product_submission_id IS DISTINCT FROM OLD.product_submission_id
      OR NEW.match_status IS DISTINCT FROM OLD.match_status
      OR NEW.intake_method IS DISTINCT FROM OLD.intake_method
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.front_image_path IS DISTINCT FROM OLD.front_image_path THEN
    RAISE EXCEPTION 'review-managed product usage fields require service or admin access';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_user_product_usage_review_fields
  ON public.user_product_usage;
CREATE TRIGGER protect_user_product_usage_review_fields
  BEFORE INSERT OR UPDATE OF brand_text, product_id, product_submission_id, match_status, intake_method, source, front_image_path
  ON public.user_product_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_product_usage_review_fields();

CREATE OR REPLACE FUNCTION public.validate_product_submission_status_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('rejected', 'cancelled_by_user')
      AND EXISTS (
        SELECT 1
        FROM public.user_product_usage usage
        WHERE usage.product_submission_id = NEW.id
      ) THEN
    RAISE EXCEPTION 'unsuccessful product submissions must be unlinked from user_product_usage before closing';
  END IF;

  IF NEW.status IN ('approved', 'matched_existing') AND NEW.approved_product_id IS NULL THEN
    RAISE EXCEPTION 'successful product submissions require approved_product_id';
  END IF;

  IF NEW.status IN ('approved', 'matched_existing') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.products
      WHERE id = NEW.approved_product_id
        AND category_key = NEW.category
    ) THEN
      RAISE EXCEPTION 'successful product submissions require approved_product_id to match submission category';
    END IF;
  END IF;

  IF NEW.status IN ('approved', 'matched_existing')
      AND EXISTS (
        SELECT 1
        FROM public.user_product_usage usage
        WHERE usage.product_submission_id = NEW.id
          AND usage.product_id IS DISTINCT FROM NEW.approved_product_id
      ) THEN
    RAISE EXCEPTION 'successful product submissions must link user_product_usage.product_id to approved_product_id before closing';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_product_submission_status_link
  ON public.product_submissions;
CREATE TRIGGER validate_product_submission_status_link
  BEFORE INSERT OR UPDATE OF status, approved_product_id, user_product_usage_id, category
  ON public.product_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_product_submission_status_link();

DROP TRIGGER IF EXISTS set_updated_at_product_submissions
  ON public.product_submissions;
CREATE TRIGGER set_updated_at_product_submissions
  BEFORE UPDATE ON public.product_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_submissions FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.product_submissions TO authenticated;
GRANT ALL ON TABLE public.product_submissions TO service_role;

DROP POLICY IF EXISTS product_submissions_service_role_all
  ON public.product_submissions;
CREATE POLICY product_submissions_service_role_all
  ON public.product_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS product_submissions_admin_select
  ON public.product_submissions;
CREATE POLICY product_submissions_admin_select
  ON public.product_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS product_submissions_admin_update
  ON public.product_submissions;
CREATE POLICY product_submissions_admin_update
  ON public.product_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-intake',
  'product-intake',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS product_intake_service_role_all
  ON storage.objects;
CREATE POLICY product_intake_service_role_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'product-intake')
  WITH CHECK (bucket_id = 'product-intake');
