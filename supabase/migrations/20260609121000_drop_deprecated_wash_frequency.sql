-- Drop deprecated wash_frequency after shampoo usage has become the source of truth.
-- Apply only after the app no longer reads or writes hair_profiles.wash_frequency.

DO $$
DECLARE
  unexpected_profile_wash_count integer;
  non_canonical_usage_count integer;
BEGIN
  SELECT count(*)
  INTO unexpected_profile_wash_count
  FROM hair_profiles
  WHERE wash_frequency IS NOT NULL
    AND wash_frequency NOT IN (
      'rarely',
      'once_weekly',
      'every_4_5_days',
      'every_2_3_days',
      'daily',
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x'
    );

  IF unexpected_profile_wash_count > 0 THEN
    RAISE EXCEPTION
      'Cannot drop hair_profiles.wash_frequency: % unexpected profile cadence rows remain',
      unexpected_profile_wash_count;
  END IF;

  SELECT count(*)
  INTO non_canonical_usage_count
  FROM user_product_usage
  WHERE frequency_range IS NOT NULL
    AND frequency_range NOT IN (
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x'
    );

  IF non_canonical_usage_count > 0 THEN
    RAISE EXCEPTION
      'Cannot contract user_product_usage.frequency_range: % non-canonical rows remain',
      non_canonical_usage_count;
  END IF;
END $$;

UPDATE user_product_usage upu
SET frequency_range = CASE hp.wash_frequency
  WHEN 'rarely' THEN 'less_than_monthly'
  WHEN 'once_weekly' THEN 'weekly_1x'
  WHEN 'every_4_5_days' THEN 'weekly_2x'
  WHEN 'every_2_3_days' THEN 'weekly_3_4x'
  WHEN 'daily' THEN 'daily_1x'
  ELSE COALESCE(hp.wash_frequency, 'less_than_monthly')
END
FROM hair_profiles hp
WHERE upu.user_id = hp.user_id
  AND upu.category = 'shampoo'
  AND upu.frequency_range IS NULL;

UPDATE user_product_usage
SET frequency_range = 'less_than_monthly'
WHERE category = 'shampoo'
  AND frequency_range IS NULL;

INSERT INTO user_product_usage (user_id, category, product_name, frequency_range)
SELECT
  hp.user_id,
  'shampoo',
  CASE
    WHEN hp.wash_frequency IS NULL THEN '__system_no_shampoo_selected__'
    ELSE NULL
  END,
  CASE hp.wash_frequency
    WHEN 'rarely' THEN 'less_than_monthly'
    WHEN 'once_weekly' THEN 'weekly_1x'
    WHEN 'every_4_5_days' THEN 'weekly_2x'
    WHEN 'every_2_3_days' THEN 'weekly_3_4x'
    WHEN 'daily' THEN 'daily_1x'
    ELSE COALESCE(hp.wash_frequency, 'less_than_monthly')
  END
FROM hair_profiles hp
WHERE NOT EXISTS (
    SELECT 1
    FROM user_product_usage upu
    WHERE upu.user_id = hp.user_id
      AND upu.category = 'shampoo'
  );

INSERT INTO user_product_usage (user_id, category, product_name, frequency_range)
SELECT DISTINCT upu.user_id, 'shampoo', '__system_no_shampoo_selected__', 'less_than_monthly'
FROM user_product_usage upu
WHERE NOT EXISTS (
    SELECT 1
    FROM user_product_usage shampoo
    WHERE shampoo.user_id = upu.user_id
      AND shampoo.category = 'shampoo'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM hair_profiles hp
    WHERE hp.user_id = upu.user_id
      AND hp.wash_frequency IS NOT NULL
  );

DO $$
BEGIN
  IF to_regclass('public.user_memory_entries') IS NOT NULL THEN
    UPDATE public.user_memory_entries old_memory
    SET
      status = 'archived',
      superseded_by = new_memory.id,
      archived_at = COALESCE(old_memory.archived_at, now()),
      updated_at = now()
    FROM public.user_memory_entries new_memory
    WHERE old_memory.normalized_key = 'routine:wash_frequency'
      AND old_memory.status = 'active'
      AND new_memory.user_id = old_memory.user_id
      AND new_memory.normalized_key = 'routine:shampoo_frequency'
      AND new_memory.status = 'active'
      AND old_memory.id <> new_memory.id;

    UPDATE public.user_memory_entries
    SET
      normalized_key = 'routine:shampoo_frequency',
      updated_at = now()
    WHERE normalized_key = 'routine:wash_frequency'
      AND status = 'active';
  END IF;
END $$;

ALTER TABLE user_product_usage
  DROP CONSTRAINT IF EXISTS user_product_usage_frequency_range_check;

ALTER TABLE user_product_usage
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
  );

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_wash_frequency_check;

ALTER TABLE hair_profiles
  DROP COLUMN IF EXISTS wash_frequency;
