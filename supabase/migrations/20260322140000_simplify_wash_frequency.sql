-- Merge old wash frequency values into the simplified set
UPDATE hair_profiles
SET wash_frequency = 'every_2_3_days'
WHERE wash_frequency IN ('every_2_days', 'twice_weekly');
