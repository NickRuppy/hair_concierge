alter table public.messages
    add column if not exists langfuse_trace_id text,
    add column if not exists langfuse_trace_url text,
    add column if not exists user_feedback_score smallint check (user_feedback_score in (-1, 1)),
    add column if not exists user_feedback_at timestamptz;

create index if not exists idx_messages_langfuse_trace_id
    on public.messages (langfuse_trace_id)
    where langfuse_trace_id is not null;

alter table public.conversation_turn_traces
    add column if not exists langfuse_trace_id text,
    add column if not exists langfuse_trace_url text;

create index if not exists idx_conversation_turn_traces_langfuse_trace_id
    on public.conversation_turn_traces (langfuse_trace_id)
    where langfuse_trace_id is not null;
