# Chat Context Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-10-chat-context-cleanup-design.md`

**Goal:** Remove dormant chat citation/retrieval plumbing and migrate live assistant-message state
from misleading RAG vocabulary to a production-safe `message_context` contract.

**Architecture:** Client and domain code consume `Message.message_context`. A temporary persistence
adapter is the only place that understands both `message_context` and legacy `rag_context`,
preferring the new column on reads and producing atomic dual-column writes. New AgentV2 traces omit
empty retrieval/citation payloads while admin readers tolerate historical trace shapes. The old
database column is dropped only in a later release after production backfill and cutover proof.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase Postgres/PostgREST, SSE, Node test
runner, React Testing Library, Playwright.

## Progress

Last updated: 2026-07-10.

- [x] Product and architecture decisions aligned.
- [x] Latest `origin/main` rechecked (`ed945d8`).
- [x] Isolated implementation worktree created on `codex/chat-context-cleanup`.
- [x] Expand-release implementation complete.
- [x] Local automated verification complete.
- [ ] Browser/manual review complete (blocked: in-app browser backend unavailable).
- [x] Production additive migration approved and applied.
- [ ] Production backfill approved and applied.
- [ ] New-only cutover deployed and verified.
- [ ] Legacy database column dropped.

## Target File Map

| Area               | Primary files                                                                                                                            | Intended change                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Context contract   | `src/lib/types.ts`, `src/lib/chat-runtime/message-context.ts`                                                                            | Define `MessageContext`; isolate fallback and dual-write behavior |
| Chat persistence   | `src/app/api/chat/route.ts`, `src/app/api/chat/product-selection/route.ts`                                                               | Remove source events; persist dual context columns                |
| History/admin APIs | `src/app/api/chat/[id]/route.ts`, `src/app/api/admin/conversations/[id]/route.ts`, `src/lib/agent-v2/production/conversation-history.ts` | Normalize legacy rows to `message_context`                        |
| Product intake     | `src/lib/product-intake/notifications.ts`, `src/lib/product-intake/route-handlers.ts`                                                    | Read and update message context through the compatibility adapter |
| Client/UI          | `src/hooks/use-chat.ts`, `src/components/chat/chat-message.tsx`, `src/lib/chat/product-lookup-selection-ui.ts`                           | Consume `message_context`; remove citations and Quellen UI        |
| Traces/admin       | `src/lib/chat-runtime/debug-trace.ts`, `src/app/admin/conversations/[id]/page.tsx`                                                       | Omit empty retrieval/source payloads; tolerate old traces         |
| Eval tooling       | `scripts/eval-chat/*`                                                                                                                    | Remove source transport/persistence assertions and counters       |
| Database           | `supabase/migrations/<timestamp>_add_message_context.sql`                                                                                | Add nullable `message_context` only; no drop or production apply  |
| Tests              | focused chat, product-intake, trace, API, and eval tests                                                                                 | Prove cards/context persist without citations                     |

## Scope Boundaries

- Remove chat citation sources, not product research evidence or provenance fields.
- Remove empty AgentV2 retrieval artifacts, not every historical retrieval term in archived traces
  or disabled comparison code.
- Do not alter the old initial migration; add a new forward migration.
- Do not add the drop migration until the compatibility deployment and backfill are proven.
- Do not apply any linked/production migration without explicit approval.

## Task 1: Lock The Contract With Tests

- [x] Add message-context adapter tests covering new-column preference, legacy fallback, normalized
      API rows, and dual-write payloads.
- [x] Update chat rendering tests to construct `message_context` and prove product mentions,
      recommendation cards, intake offers, lookup clarifications, selections, and review state render
      without `sources`.
- [x] Add assertions that current chat event sequences contain neither `sources` nor
      `retrieval_debug`.

## Task 2: Remove Citation And Empty Retrieval Plumbing

- [x] Remove `CitationBadge`, citation renumbering, citation Markdown injection, and the visible
      `Quellen` footer while preserving inline product mention rendering.
- [x] Remove `sources` from AgentV2 pipeline results, assistant context construction, SSE events,
      hooks, eval results, and current trace responses.
- [x] Remove the client `retrieval_debug` SSE event and empty AgentV2 retrieval trace construction.
- [x] Make the admin trace view tolerate historical `retrieval` and `response.sources` fields while
      no longer presenting them for new traces.

## Task 3: Add The Expand-Phase Message Context Contract

- [x] Add a nullable `public.messages.message_context jsonb` migration with a short lock timeout and
      no default, backfill, trigger, or old-column drop.
- [x] Introduce `MessageContext` and remove `sources` from its shape.
- [x] Add the temporary compatibility adapter as the sole owner of legacy `rag_context` reads and
      dual-column writes.
- [x] Normalize history/admin API rows to expose `message_context` to clients.
- [x] Update chat, product-selection, product-intake notification, and submission paths to
      dual-write identical context values.
- [x] Rename active RAG-named types, helpers, and local variables to message-context vocabulary.

## Task 4: Verify The Expand Release

- [x] Run focused adapter, chat rendering, AgentV2 product-selection, product-intake submission,
      trace, and eval tests.
- [x] Run `npm run typecheck`.
- [x] Run the applicable broader Node and Playwright suites.
- [x] Inspect the final diff for remaining live `rag_context`, citation, source-event, and empty
      retrieval artifacts; document intentional compatibility/history matches.
- [x] Run `ready-check` because chat cards and trust-facing UI are affected. Automated checks pass;
      the browser/manual step is recorded as blocked above.
- [x] Run final code review before any shipping handoff. Claude found no immediate runtime blocker;
      verified legacy marker, fallback, idempotency, migration, eval, mixed-version repair, and
      route-level dual-write gaps were fixed.

## Verification Evidence

- `npm run typecheck` passed.
- `npm run build` passed with all application routes compiled.
- `npm run test:node` passed: 1,174/1,174.
- Focused review-fix tests passed: 117/117.
- `NODE_OPTIONS='-r dotenv/config' DOTENV_CONFIG_PATH=.env.local npm run test:agent` passed:
  964/964.
- `npm run test:playwright:contracts` passed: 160/160.
- `npm run test:chat:ci -- --base-url http://localhost:3625` passed: 6/6 scenarios and 41/41
  assertions. The missing Langfuse `staging` prompt label used the checked-in fallback as designed.
- `npm run lint` completed with 0 errors and 7 pre-existing warnings outside this cleanup's new
  code.
- `git diff --check HEAD` passed.
- Linked Supabase migration history was refreshed over IPv4. Migration `20260710120000` is present
  in both local and remote history.
- Production schema verification confirms nullable `message_context jsonb` with no default;
  PostgREST returned `200` when selecting the new field.
- No backfill was performed: production has 2,992 messages, 0 non-null `message_context` rows, and
  1,477 non-null legacy `rag_context` rows.
- Production evidence found 67 assistant messages with bracketed markers; 64 were tied to legacy
  source arrays and are now sanitized only through that proven compatibility signal.
- Residue scan confirms active `rag_context` references are limited to the temporary adapter and
  dual-column selects; no live chat source/citation or `retrieval_debug` event remains.

## Task 5: Production Expand And Backfill (Deferred, Explicit Approval Required)

- [x] Check linked Supabase migration history and production message row/data size.
- [x] Apply the additive migration before deploying compatibility code.
- [x] Verify PostgREST recognizes `message_context`.
- [ ] Deploy compatibility code and wait for old instances to drain; during that mixed-version
      window, an old instance could update only `rag_context`, leaving `message_context` stale.
- [ ] After old instances drain, backfill every row where
      `message_context IS DISTINCT FROM (rag_context - 'sources')`, using batches if production size
      warrants them.
- [ ] Persistently remove `[N]` markers from `content` only for rows with a non-empty legacy source
      array, before the legacy column is dropped.
- [ ] Require zero `message_context IS DISTINCT FROM (rag_context - 'sources')` mismatches.
- [ ] Require zero source-backed assistant messages whose content still contains `[N]` markers.
- [ ] Smoke persisted product, intake, clarification, selection, and review cards after reload.

## Task 6: Production Contract Release (Deferred Follow-Up)

- [ ] Remove dual-write and legacy fallback code after backfill proof.
- [ ] Deploy and verify new-only reads and writes.
- [ ] Add a separate drop migration with `lock_timeout` after the new-only deployment is live.
- [ ] Check dependencies and backup state, then apply the drop during a low-traffic window.
- [ ] Confirm the live schema and application contain no active `rag_context` contract.
