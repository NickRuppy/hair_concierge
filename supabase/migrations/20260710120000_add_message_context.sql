begin;

set local lock_timeout = '5s';

alter table public.messages
  add column if not exists message_context jsonb;

comment on column public.messages.message_context is
  'Assistant message workflow and decision metadata. Replaces legacy rag_context after expand-and-contract migration.';

commit;
