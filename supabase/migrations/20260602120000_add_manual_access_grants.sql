CREATE TABLE IF NOT EXISTS manual_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles (id) ON DELETE CASCADE,
  email text,
  reason text NOT NULL CHECK (reason IN ('friend', 'tester', 'admin', 'support')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR email IS NOT NULL),
  CHECK (email IS NULL OR email = lower(email)),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_manual_access_grants_user_id
  ON manual_access_grants (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_access_grants_email
  ON manual_access_grants (email)
  WHERE email IS NOT NULL AND revoked_at IS NULL;

CREATE TRIGGER set_updated_at_manual_access_grants
  BEFORE UPDATE ON manual_access_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE manual_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own manual access grants"
  ON manual_access_grants
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      email IS NOT NULL
      AND lower(auth.jwt() ->> 'email') = email
    )
  );

COMMENT ON TABLE manual_access_grants IS
  'Internal non-payment Premium access grants for friends, testers, support, and admin use.';
COMMENT ON COLUMN manual_access_grants.email IS
  'Lowercase email address. Allows granting access before the profile row is linked.';
COMMENT ON COLUMN manual_access_grants.expires_at IS
  'Null means indefinite-time manual access. Set revoked_at to remove access immediately.';
