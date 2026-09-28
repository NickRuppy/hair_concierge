-- Discovery consult runsheet: one call sheet per discovery enrollment
-- (plan plans/consult-runsheet/plan.md §6).
--
-- Holds what Nick tracks around the call itself: the baseline score, later
-- re-scores, the follow-up touchpoints, the consult brief, habit commitments
-- and free-text feedback. The JSONB inner shapes are application contracts;
-- the database only checks that the list columns are arrays.
--
-- Service-only like the other discovery tables (migration 20260922120000):
-- anon/authenticated get no table privilege; RLS stays enabled with a
-- service_role policy so a future direct surface starts closed.
--
-- Backward compatible: a new table only.
-- Reverse: DROP TABLE public.discovery_call_sheets;

CREATE TABLE public.discovery_call_sheets (
  enrollment_id uuid PRIMARY KEY
    REFERENCES public.discovery_enrollments (id) ON DELETE CASCADE,
  baseline_score smallint CHECK (baseline_score BETWEEN 1 AND 10),
  -- [{ score: 1–10, at: ISO timestamp, channel: "whatsapp" | "call" }]
  rescores jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ kind: "text_checkin" | "rescore_call", due_on: ISO date, done_at: ISO timestamp | null }]
  touchpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- { sections: { diagnose, hebel[], swapReasons{}, zielLuecken[], callFragen[], erwartungen[] },
  --   generated_at: ISO | null, generated_by: "manual" | "agent", source_hash: string | null }
  consult_brief jsonb,
  -- [{ id: string, label: string, committed: boolean }]
  habit_commitments jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_call_sheets_rescores_is_array CHECK (jsonb_typeof(rescores) = 'array'),
  CONSTRAINT discovery_call_sheets_touchpoints_is_array CHECK (jsonb_typeof(touchpoints) = 'array'),
  CONSTRAINT discovery_call_sheets_habit_commitments_is_array CHECK (
    jsonb_typeof(habit_commitments) = 'array'
  )
);

CREATE TRIGGER set_updated_at_discovery_call_sheets
  BEFORE UPDATE ON public.discovery_call_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.discovery_call_sheets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.discovery_call_sheets FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.discovery_call_sheets TO service_role;

CREATE POLICY discovery_call_sheets_service_role_all
  ON public.discovery_call_sheets FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.discovery_call_sheets IS
  'Admin call runsheet per discovery enrollment: baseline/re-scores, touchpoints, consult brief, habit commitments, feedback. Written only from the admin cockpit.';
