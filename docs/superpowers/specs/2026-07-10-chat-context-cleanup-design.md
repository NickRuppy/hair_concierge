# Chat Context Cleanup Design

## Goal

Remove the dormant chat citation/retrieval artifact and replace misleading live RAG vocabulary
with a message-context contract that accurately describes the state persisted for assistant
messages.

When the cleanup is complete:

- production chat emits and renders no citation sources;
- AgentV2 traces no longer manufacture empty retrieval payloads;
- live application code uses `message_context` and `MessageContext`;
- historical product-intake, lookup, and review cards keep working;
- the production database can retire `messages.rag_context` after a verified compatibility
  window.

## Current State

AgentV2 production returns no sources and no retrieved chunks, but the API, SSE client, message
renderer, admin trace view, and eval tooling still carry source/citation contracts. Meanwhile,
`messages.rag_context` now stores live product-intake and product-lookup workflow state rather
than retrieval context.

There is no live `src/lib/rag/` directory on the implementation baseline. This cleanup therefore
targets contracts and persisted naming, not another file move.

## Decisions

- The canonical name is `message_context` in persistence and `MessageContext` in TypeScript.
- `message_context` includes recommendation decision metadata, product-intake offers and reviews,
  product-lookup clarification and selection state, and response metadata.
- Chat citation sources, citation badges, citation renumbering, source SSE events, and the visible
  `Quellen` footer are removed.
- Product research evidence, recommendation provenance, and prompt source material are not chat
  citations and remain in scope where they are genuinely used.
- New AgentV2 traces omit the empty retrieval stage and response sources. Historical trace JSON is
  read tolerantly rather than rewritten.
- The database rename uses expand-and-contract: add the new column, temporarily dual-read and
  dual-write, mechanically backfill, cut over to the new column, then drop the old column in a
  later production-verified release.
- Historical workflow and decision metadata is copied as JSONB, but the retired top-level `sources`
  key is omitted from `message_context` during backfill.

## Compatibility Contract

During the expand release, one persistence adapter owns all legacy compatibility:

- reads prefer `message_context` and fall back to `rag_context`;
- normalized reads remove retired source payloads and their rendered citation markers;
- writes persist the same context to both columns atomically;
- client components and domain helpers only consume `message_context`;
- API responses normalize persisted rows before returning them to clients.

After the backfill has zero mismatches and the new-only release is deployed, the adapter fallback
and dual-write are removed. Only then may a separate migration drop `rag_context`.

## Scope

- `/api/chat` and product-selection persistence
- chat SSE contracts and client state
- chat message rendering
- product-intake notification and submission context updates
- admin conversation/trace displays
- AgentV2 production trace construction
- eval tooling and focused tests
- additive Supabase migration for `message_context`

## Non-Goals

- No production migration application in the implementation branch.
- No `rag_context` drop migration in the expand release.
- No historical trace rewrite.
- No broad rename of legitimate `source`, provenance, or evidence concepts.
- No redesign of recommendation logic, product-intake behavior, or AgentV2 reasoning.
- No direct in-place column rename.

## Rollout

1. Remove dormant citation and empty AgentV2 retrieval contracts.
2. Add nullable `messages.message_context` without a default.
3. Deploy compatibility code that dual-reads and dual-writes.
4. After old instances drain, repair every mismatch with
   `message_context = rag_context - 'sources'`, not only null rows.
5. Persistently remove `[N]` markers from message content only where the legacy row has a non-empty
   source array, then verify zero context mismatches and zero source-backed marker rows.
6. Exercise persisted chat cards.
7. Deploy new-only reads and writes.
8. Drop `messages.rag_context` in a separate migration during a low-traffic window with a short
   lock timeout.

## Acceptance Criteria

- No source or retrieval-debug SSE event is emitted by AgentV2 chat.
- Chat messages render Markdown, product mentions, product cards, intake cards, and lookup cards
  without citation helpers.
- New persisted messages expose `message_context`; compatibility reads preserve old contexts.
- Every context-writing path dual-writes during the expand release.
- New AgentV2 traces contain no empty retrieval object or response source list.
- Historical traces remain viewable in admin without assuming the legacy fields exist.
- Focused chat, product-intake, trace, and eval tests pass, followed by typecheck and the applicable
  broader test suite.
