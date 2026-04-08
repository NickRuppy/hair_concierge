-- User-controlled memory layer.
-- V1 stores curated hair-care memories separately from structured hair_profiles.

ALTER TABLE public.hair_profiles
  ADD COLUMN IF NOT EXISTS conversation_memory text;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS memory_extracted_at_count integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.user_memory_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  memory_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_memory_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (
    kind IN (
      'preference',
      'routine',
      'product_experience',
      'hair_history',
      'progress',
      'sensitivity',
      'medical_context',
      'legacy_summary',
      'other'
    )
  ),
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  normalized_key text NOT NULL,
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'manual', 'legacy')),
  source_conversation_id uuid REFERENCES public.conversations (id) ON DELETE CASCADE,
  evidence text,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  superseded_by uuid REFERENCES public.user_memory_entries (id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_entries_user_status
  ON public.user_memory_entries (user_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_entries_user_key_active
  ON public.user_memory_entries (user_id, normalized_key)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_memory_entries_source_conversation
  ON public.user_memory_entries (source_conversation_id)
  WHERE source_conversation_id IS NOT NULL;

ALTER TABLE public.user_memory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_user_memory_settings'
  ) THEN
    CREATE TRIGGER set_updated_at_user_memory_settings
      BEFORE UPDATE ON public.user_memory_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_user_memory_entries'
  ) THEN
    CREATE TRIGGER set_updated_at_user_memory_entries
      BEFORE UPDATE ON public.user_memory_entries
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_memory_settings'
      AND policyname = 'user_memory_settings_select_own'
  ) THEN
    CREATE POLICY "user_memory_settings_select_own"
      ON public.user_memory_settings FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_memory_settings'
      AND policyname = 'user_memory_settings_insert_own'
  ) THEN
    CREATE POLICY "user_memory_settings_insert_own"
      ON public.user_memory_settings FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_memory_settings'
      AND policyname = 'user_memory_settings_update_own'
  ) THEN
    CREATE POLICY "user_memory_settings_update_own"
      ON public.user_memory_settings FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_memory_entries'
      AND policyname = 'user_memory_entries_select_own'
  ) THEN
    CREATE POLICY "user_memory_entries_select_own"
      ON public.user_memory_entries FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_memory_entries'
      AND policyname = 'user_memory_entries_insert_own'
  ) THEN
    CREATE POLICY "user_memory_entries_insert_own"
      ON public.user_memory_entries FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_memory_entries'
      AND policyname = 'user_memory_entries_update_own'
  ) THEN
    CREATE POLICY "user_memory_entries_update_own"
      ON public.user_memory_entries FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_memory_entries'
      AND policyname = 'user_memory_entries_delete_own'
  ) THEN
    CREATE POLICY "user_memory_entries_delete_own"
      ON public.user_memory_entries FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;
