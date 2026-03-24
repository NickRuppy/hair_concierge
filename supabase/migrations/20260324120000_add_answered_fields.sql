ALTER TABLE hair_profiles
ADD COLUMN IF NOT EXISTS answered_fields text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN hair_profiles.answered_fields IS
  'Tracks which fields the user explicitly answered. A field in answered_fields with value [] means "user said none." A field NOT in answered_fields means "user never saw/answered it."';
