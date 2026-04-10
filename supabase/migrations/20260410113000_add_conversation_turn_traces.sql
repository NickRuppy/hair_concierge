create table conversation_turn_traces (
    id                 uuid primary key default uuid_generate_v4(),
    conversation_id    uuid references conversations (id) on delete set null,
    user_id            uuid not null references profiles (id) on delete cascade,
    user_message_id    uuid references messages (id) on delete set null,
    assistant_message_id uuid references messages (id) on delete set null,
    status             text not null check (status in ('completed', 'failed')),
    trace              jsonb not null,
    created_at         timestamptz default now(),
    updated_at         timestamptz default now()
);

create index idx_conversation_turn_traces_conversation_id
    on conversation_turn_traces (conversation_id, created_at desc);

create index idx_conversation_turn_traces_user_id
    on conversation_turn_traces (user_id, created_at desc);

create index idx_conversation_turn_traces_assistant_message_id
    on conversation_turn_traces (assistant_message_id);

alter table conversation_turn_traces enable row level security;

create trigger set_updated_at_conversation_turn_traces
    before update on conversation_turn_traces
    for each row
    execute function public.update_updated_at_column();
