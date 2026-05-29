-- Capture PostHog session id alongside feedback so triage can deep-link
-- straight to the Session Replay instead of hunting by user_id + timestamp.

alter table public.beta_feedback
  add column posthog_session_id text
    check (posthog_session_id is null or length(posthog_session_id) <= 128);
