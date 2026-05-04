alter table conversations
    add constraint conversations_id_user_id_unique unique (id, user_id);

create table conversation_states (
    conversation_id uuid primary key references conversations (id) on delete cascade,
    user_id         uuid not null references profiles (id) on delete cascade,
    state_version   integer not null default 1,
    state           jsonb not null default '{
      "version": 1,
      "active_topic": null,
      "routine_layer": null,
      "pending_offer": null,
      "answered_slots": [],
      "last_assistant_action": null,
      "last_product_category": null
    }',
    last_transition jsonb,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

alter table conversation_states
    add constraint conversation_states_conversation_user_id_fk
    foreign key (conversation_id, user_id)
    references conversations (id, user_id);

create index idx_conversation_states_user_id
    on conversation_states (user_id, updated_at desc);

alter table conversation_states enable row level security;

create policy "Users can read own conversation states"
    on conversation_states for select
    using (auth.uid() = user_id);

create policy "Users can insert own conversation states"
    on conversation_states for insert
    with check (auth.uid() = user_id);

create policy "Users can update own conversation states"
    on conversation_states for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create trigger set_updated_at_conversation_states
    before update on conversation_states
    for each row
    execute function public.update_updated_at_column();
