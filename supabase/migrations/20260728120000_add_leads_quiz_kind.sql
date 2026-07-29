ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS quiz_kind text NOT NULL DEFAULT 'legacy';

UPDATE public.leads SET quiz_kind = 'legacy' WHERE quiz_kind IS NULL;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_quiz_kind_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_quiz_kind_check CHECK (quiz_kind IN ('legacy', 'personal_plan'));

CREATE INDEX IF NOT EXISTS leads_quiz_kind_email_created_at_idx
  ON public.leads (quiz_kind, email, created_at DESC);
