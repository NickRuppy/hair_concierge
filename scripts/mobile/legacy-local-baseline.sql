-- Local-only reconstruction of the untracked legacy leads creation.
-- Column/FK metadata verified read-only against public.leads on 2026-09-12.
-- Later repository migrations add status, email delivery and quiz/provenance fields.
-- This is NOT a production migration or a claim that the historical chain is complete.
-- Initial migration installs vector in public; later migrations expect extensions.
ALTER EXTENSION vector SET SCHEMA extensions;
-- Existing retention migrations assume pg_cron was provisioned out of band.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  marketing_consent boolean DEFAULT false,
  quiz_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_insight text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  share_quote text
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
