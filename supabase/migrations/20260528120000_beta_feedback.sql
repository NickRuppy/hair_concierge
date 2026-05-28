-- Beta-Feedback aus dem In-App-Bubble-Widget
-- Authentifizierte User submitten Freitext; Kontext über PostHog Session Replay
-- (user_id + created_at -> Session-Lookup).

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null check (length(message) between 1 and 4000),
  page_url text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

-- Authentifizierte User dürfen ausschließlich eigenes Feedback einreichen.
create policy "users insert own feedback"
  on public.beta_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

create index beta_feedback_created_at_idx
  on public.beta_feedback (created_at desc);
