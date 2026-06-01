ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS artifact_email_status text,
  ADD COLUMN IF NOT EXISTS artifact_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_email_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_email_error text;

DO $$
BEGIN
  ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_artifact_email_status_check;

  ALTER TABLE public.leads
    ADD CONSTRAINT leads_artifact_email_status_check
    CHECK (
      artifact_email_status IS NULL
      OR artifact_email_status IN ('sending', 'sent', 'failed')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
