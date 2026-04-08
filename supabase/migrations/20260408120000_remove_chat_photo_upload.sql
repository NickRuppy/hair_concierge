-- Remove user-uploaded chat photo support for launch.
-- Product/admin/article image fields remain unchanged.

ALTER TABLE public.messages
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS image_analysis;

ALTER TABLE public.subscription_tiers
  DROP COLUMN IF EXISTS can_upload_photos;

UPDATE public.subscription_tiers
SET features = features - 'photo_upload'
WHERE features ? 'photo_upload';
