-- Store per-user dismissed routine suggestions so temporary deferrals can
-- reappear after the cooldown window.

CREATE TABLE IF NOT EXISTS public.dismissed_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL REFERENCES public.product_categories(key) ON DELETE RESTRICT,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  reappear_at timestamptz NOT NULL,
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_suggestions_user_id
  ON public.dismissed_suggestions (user_id);

CREATE INDEX IF NOT EXISTS idx_dismissed_suggestions_user_reappear_at
  ON public.dismissed_suggestions (user_id, reappear_at);

ALTER TABLE public.dismissed_suggestions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dismissed_suggestions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dismissed_suggestions TO authenticated;
GRANT ALL ON TABLE public.dismissed_suggestions TO service_role;

DROP POLICY IF EXISTS dismissed_suggestions_select_own
  ON public.dismissed_suggestions;
CREATE POLICY dismissed_suggestions_select_own
  ON public.dismissed_suggestions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS dismissed_suggestions_insert_own
  ON public.dismissed_suggestions;
CREATE POLICY dismissed_suggestions_insert_own
  ON public.dismissed_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS dismissed_suggestions_update_own
  ON public.dismissed_suggestions;
CREATE POLICY dismissed_suggestions_update_own
  ON public.dismissed_suggestions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS dismissed_suggestions_delete_own
  ON public.dismissed_suggestions;
CREATE POLICY dismissed_suggestions_delete_own
  ON public.dismissed_suggestions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
