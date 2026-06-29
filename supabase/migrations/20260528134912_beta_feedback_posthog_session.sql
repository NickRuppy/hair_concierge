alter table public.beta_feedback
  add column posthog_session_id text
    check (posthog_session_id is null or length(posthog_session_id) <= 128);;
