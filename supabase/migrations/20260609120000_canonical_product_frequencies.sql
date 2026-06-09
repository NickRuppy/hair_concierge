-- Phase 1: migrate product and legacy wash cadences to canonical frequency values.
-- hair_profiles.wash_frequency remains migrated legacy data only for audit/rollback;
-- runtime shampoo cadence should come from user_product_usage(category = 'shampoo').

/*
Manual preflight audit SQL:

-- Existing legacy wash frequency distribution.
SELECT wash_frequency, count(*) AS profile_count
FROM hair_profiles
GROUP BY wash_frequency
ORDER BY wash_frequency NULLS FIRST;

-- Existing product usage frequency distribution.
SELECT frequency_range, count(*) AS usage_count
FROM user_product_usage
GROUP BY frequency_range
ORDER BY frequency_range NULLS FIRST;

-- Existing shampoo rows that need null-frequency repair.
SELECT count(*) AS shampoo_null_frequency_count
FROM user_product_usage
WHERE category = 'shampoo'
  AND frequency_range IS NULL;

-- Users who have usage rows, no shampoo row, and no legacy wash frequency.
SELECT count(*) AS usage_no_shampoo_no_wash_frequency_backfill_count
FROM (
  SELECT DISTINCT upu.user_id
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
  )
) users_to_backfill;
*/

DO $$
DECLARE
  unexpected_values text;
BEGIN
  SELECT string_agg(source || '=' || value || ' (' || row_count || ')', ', ')
  INTO unexpected_values
  FROM (
    SELECT
      'hair_profiles.wash_frequency' AS source,
      wash_frequency AS value,
      count(*) AS row_count
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
      )
    GROUP BY wash_frequency

    UNION ALL

    SELECT
      'user_product_usage.frequency_range' AS source,
      frequency_range AS value,
      count(*) AS row_count
    FROM user_product_usage
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
      'Unexpected legacy frequency values before canonical migration: %',
      unexpected_values;
  END IF;
END $$;

ALTER TABLE user_product_usage
  DROP CONSTRAINT IF EXISTS user_product_usage_frequency_range_check;

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_wash_frequency_check;

UPDATE hair_profiles
SET wash_frequency = CASE wash_frequency
  WHEN 'rarely' THEN 'less_than_monthly'
  WHEN 'once_weekly' THEN 'weekly_1x'
  WHEN 'every_4_5_days' THEN 'weekly_2x'
  WHEN 'every_2_3_days' THEN 'weekly_3_4x'
  WHEN 'daily' THEN 'daily_1x'
  ELSE wash_frequency
END
WHERE wash_frequency IS NOT NULL;

UPDATE user_product_usage
SET frequency_range = CASE frequency_range
  WHEN 'rarely' THEN 'less_than_monthly'
  WHEN '1_2x' THEN 'weekly_1x'
  WHEN '3_4x' THEN 'weekly_3_4x'
  WHEN '5_6x' THEN 'weekly_5_6x'
  WHEN 'daily' THEN 'daily_1x'
  ELSE frequency_range
END
WHERE frequency_range IS NOT NULL;

UPDATE user_product_usage upu
SET frequency_range = COALESCE(hp.wash_frequency, 'less_than_monthly')
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
  COALESCE(hp.wash_frequency, 'less_than_monthly')
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

ALTER TABLE user_product_usage
  ADD CONSTRAINT user_product_usage_frequency_range_check
  CHECK (
    frequency_range IS NULL
    OR frequency_range IN (
      -- Phase 1 expand compatibility: legacy values remain accepted until
      -- the follow-up contract migration confirms old app instances are gone.
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
  );

ALTER TABLE hair_profiles
  ADD CONSTRAINT hair_profiles_wash_frequency_check
  CHECK (
    wash_frequency IS NULL
    OR wash_frequency IN (
      -- Phase 1 expand compatibility for old app/profile writes.
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
    )
  );

/*
Rollback runbook SQL:

WARNING: canonical values monthly_1x, biweekly_1x, and weekly_2x have no exact
legacy representation. The rollback below maps them to the closest legacy
weekly bucket, so precision is lost.

BEGIN;

ALTER TABLE user_product_usage
  DROP CONSTRAINT IF EXISTS user_product_usage_frequency_range_check;

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_wash_frequency_check;

DELETE FROM user_product_usage
WHERE category = 'shampoo'
  AND product_name = '__system_no_shampoo_selected__'
  AND frequency_range = 'less_than_monthly';

UPDATE user_product_usage
SET frequency_range = CASE frequency_range
  WHEN 'less_than_monthly' THEN 'rarely'
  WHEN 'monthly_1x' THEN 'rarely'
  WHEN 'biweekly_1x' THEN 'rarely'
  WHEN 'weekly_1x' THEN '1_2x'
  WHEN 'weekly_2x' THEN '1_2x'
  WHEN 'weekly_3_4x' THEN '3_4x'
  WHEN 'weekly_5_6x' THEN '5_6x'
  WHEN 'daily_1x' THEN 'daily'
  ELSE frequency_range
END
WHERE frequency_range IS NOT NULL;

UPDATE hair_profiles
SET wash_frequency = CASE wash_frequency
  WHEN 'less_than_monthly' THEN 'rarely'
  WHEN 'monthly_1x' THEN 'rarely'
  WHEN 'biweekly_1x' THEN 'rarely'
  WHEN 'weekly_1x' THEN 'once_weekly'
  WHEN 'weekly_2x' THEN 'every_2_3_days'
  WHEN 'weekly_3_4x' THEN 'every_2_3_days'
  WHEN 'weekly_5_6x' THEN 'daily'
  WHEN 'daily_1x' THEN 'daily'
  ELSE wash_frequency
END
WHERE wash_frequency IS NOT NULL;

ALTER TABLE user_product_usage
  ADD CONSTRAINT user_product_usage_frequency_range_check
  CHECK (
    frequency_range IS NULL
    OR frequency_range IN ('rarely', '1_2x', '3_4x', '5_6x', 'daily')
  );

-- The old database had no hair_profiles.wash_frequency check, so there is no
-- legacy hair_profiles constraint to restore.

COMMIT;
*/
