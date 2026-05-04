-- Atomic one-time claims for post-checkout account activation.
CREATE TABLE IF NOT EXISTS public.checkout_activation_claims (
  session_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('password', 'passwordless')),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_activation_claims_user_id
  ON public.checkout_activation_claims (user_id);

-- RLS enabled, no user-facing policies — only the service_role (admin client) accesses this table.
ALTER TABLE public.checkout_activation_claims ENABLE ROW LEVEL SECURITY;
