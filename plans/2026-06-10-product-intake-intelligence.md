# Product Intake Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clean product identity foundation and product-intake workflow so user-entered products can be researched once, approved as full canonical products with category-specific specs, linked to the owning user, and safely used by the assistant without leaking unapproved products into general recommendations.

**Architecture:** `products` remains the only table for verified product intelligence. User-entered unknown products first live in `product_submissions` as a review workflow with raw inputs, images, research JSON, and manual approval metadata. `user_product_usage` remains the user's inventory slot and is extended to point either to a verified `products.id` or to a pending `product_submissions.id`; category-specific product properties stay in the existing product spec tables, not on the user usage row. Phase 0 is a standalone, blocking foundation release that normalizes the current catalog into canonical `product_categories`, `brands`, optional `product_lines`, aliases, clean product names, identifiers, and product origin before intake/review is implemented.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase Postgres/RLS/Storage, Zod, Node `tsx` scripts, existing recommendation engine/category spec tables, existing Node test runner and Playwright/browser checks.

**Review Status:** This plan has had two pre-implementation reviews:

- A fresh-context adversarial subagent review found lifecycle/RLS/migration/dedupe issues that are folded into this plan.
- The adversarial review summary is saved at `plans/2026-06-10-product-intake-intelligence.adversarial-review.md`.
- A Claude plan review found the root checkout was behind `origin/main` and that several file lists/verified facts must be re-baselined before execution. The generated review is saved at `plans/2026-06-10-product-intake-intelligence.claude-review.md`.
- A second Claude plan review after Phase 3 chat-lookup realignment found the old heuristic/template scaffold had to be removed, the `ProductIntakeOffer` contract had to be reconciled, stale `src/lib/rag/*` path assumptions had to be removed, and category spec discovery had to become a gate. The generated review is saved at `plans/2026-06-10-product-intake-intelligence.claude-review-2.md`, and those findings are folded into this plan.
- A fourth Claude plan review after Phase 3 post-review decisions found the plan needed a hard Phase 0 DB-first rollout gate, stale Phase 3.2A wording re-baselined to verification, explicit protection for non-intake `product_categories` rows, and a stackable Phase 4A/4B split. The generated review is saved at `plans/2026-06-10-product-intake-intelligence.claude-review-4.md`, and those findings are folded into this plan.
- A Phase 3 code-review and simulated-user pass after initial implementation found trigger-order bugs in pending cancellation/rollback, old committed photo cleanup gaps, oversized orchestration files, and target-environment readiness blockers (`products.brand_id` missing and `product-intake` storage bucket missing in the tested Supabase state). The accepted patch decisions are folded into the Phase 3 post-review patch spec below.

## Implementation Progress

Last updated: 2026-06-18.

Use this section as the current orchestration ledger. The detailed task checkboxes below remain the implementation checklist for each phase and may lag behind the stacked PR state.

| Phase                                               | Status                                       | Branch / PR                                                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0: Product Identity Normalization             | Implemented, pushed, draft PR open           | `codex/product-intake-intelligence`, PR #172, base `main`                                                                  | Open draft PR, mergeable, visible GitHub/Vercel checks green as of 2026-06-13. Shipping normalized-read code requires the hard DB-first gate: migration + backfill + prod verification before deploy/merge, unless explicit legacy fallbacks are present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Phase 1: User Product Usage Extension               | Implemented, pushed, draft PR open           | `codex/product-intake-phase-1`, PR #173, base `codex/product-intake-intelligence`                                          | Open draft PR, mergeable, visible Vercel checks green as of 2026-06-13. Supabase migration application is still a separate shipping decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Phase 2: Product Identity Resolution And Matching   | Implemented, reviewed, pushed, draft PR open | `codex/product-intake-phase-2`, PR #175, base `codex/product-intake-phase-1`, commit `24a5d75`                             | Claude opus/high review found no in-scope correctness bug; accepted low-risk follow-ups were patched. Focused tests, typecheck, node suite, lint, and `git diff --check` passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Phase 3: Intake APIs And UI                         | Implemented, reviewed, pushed, draft PR open | `codex/product-intake-phase-3`, PR #177, base `codex/product-intake-phase-2`, commit `cf443bc`                             | Chat intake trigger is lookup-driven. Post-review fixups were committed and pushed, including trigger-safe pending lifecycle handling, committed-photo cleanup/reuse guards, operator readiness checks, bounded onboarding/client-helper extraction, and final code-review fixes. Focused tests, typecheck, lint, `ci:verify`, `git diff --check`, Clawpatch revalidation, and code-quality review passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Phase 4A: Review And Approval Core                  | Implemented, reviewed, pushed, draft PR open | `codex/product-intake-phase-4a-review-core`, PR #179, base `codex/product-intake-phase-3` / PR #177, commit `267824a`      | Core script-first review path implemented: queue/review/research, approve/approve-ready, link-existing, request-info/reject, notifications, review validators, review RPCs, and cleanup wrapper. Review findings patched for needs-more-info reopen, global recommendation exclusion for `is_chaarlie_recommended=false`, closed-submission research guard, destructive script confirmation gates, notification status/idempotency guard, identifier canonicalization, legacy uniqueness preservation, barcode-aware SQL duplicate checks, optional identifiers, exact-name SQL dedupe, needs-more-info follow-up intake card metadata bound to the expected submission id, `/api/products` recommendation filtering, 6-hour tmp cleanup default, identifier-aware review candidates, null-safe research drafts, optimistic `updated_at` save guard, inline CLI flag parsing for values containing `=`, and the `research.ts` empty-row error path. Supabase migrations for the Phase 0-4A stack were applied and verified in the linked production project. PR #179 is clean and Vercel green as of 2026-06-18.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Phase 4B: Review Ops Hardening                      | Implemented, reviewed, pushed, draft PR open | `codex/product-intake-phase-4b-ops`, PR #180, base `codex/product-intake-phase-4a-review-core` / PR #179, commit `950ae73` | Ships operational hardening: queue reporting/export pagination, `products:intake:promote`, Sentry-safe product-intake observability, short-lived script flushing, duplicate notification-capture cleanup, and script tests. Final `$superpowers:requesting-code-review` found no critical, important, or minor issues. Focused tests, typecheck, diff hygiene, Vercel, and safe ops smoke passed as of 2026-06-18. No Supabase migration files changed in PR #180.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Phase 5: Assistant And Recommendation Integration   | Implemented locally, review fixups patched   | `codex/product-intake-phase-5`, stacked after `codex/product-intake-phase-4b-ops` / PR #180                                | Implements explicit product eligibility modes, AgentV2 product lookup validation, owned verified product context, admin product filters, and a product visibility policy migration (`20260618120000_product_visibility_policy_lifecycle.sql`). Initial spec-review blockers were patched: user-visible lookup is active-lifecycle recommended-only while intake dedupe remains active-only, named-product claims require lookup and unresolved lookup blocks product-specific prose, and owned non-recommended products no longer expose a user-facing not-recommended caveat. Code-review findings were patched so explicit owned IDs use owned-assessment eligibility while normal global candidates remain recommended-only, including a shared guard that blocks owned non-recommended products without category-specific specs/eligibility rows across the supported rerankers and matcher preservation so explicit owned IDs are not truncated before reranking. Follow-up review fixups patched the production AgentV2 routine identity projection (`product_id`, `product_submission_id`, `match_status`), added narrow RLS for users to read active products matched into their own routine, and made lookup-required repair call `lookup_product_candidate` before normal product grounding. Expanded focused Phase 5 tests pass (448 passing), diff hygiene passes, final re-review is still required after these latest fixups, and typecheck is blocked only by the pre-existing PayPal module/type issue. |
| Phase 6: Verification And Shipping Gates            | Ongoing per phase                            | PR stack #172 -> #173 -> #175 -> #177 -> #179 -> #180 -> Phase 5 branch                                                    | Final merge/deploy requires live PR checks, review gates, explicit Supabase migration-state decisions, and a stack refresh because PR #172 is currently behind `main` as of 2026-06-18.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Phase 7: Follow-Up Legacy Identity Contract Cleanup | Not started                                  | none                                                                                                                       | Intentionally deferred until after a separate production release proves normalized identity reads are stable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## Source Of Truth

- Production Supabase project: `pqdkhefxsxkyeqelqegq`.
- Production schema/data should be checked before implementing migrations because local migrations and local constants are not fully current.
- Execute from a fresh worktree based on current `origin/main`, not from the root checkout. At review time the root checkout was behind `origin/main`, and upstream commits already changed product usage frequencies, off-catalog named-product context, and product metadata health tooling.
- Verified production facts at plan time:
  - `products` has plain text `brand` and display-label `category`; no `brands`, `product_lines`, or `product_categories` table exists yet.
  - Production product category labels are currently `Shampoo`, `Conditioner (Drogerie)`, `Leave-in`, `Maske`, `Öle`, `Trockenshampoo`, `Tiefenreinigungsshampoo`, and `Bondbuilder`.
  - `user_product_usage` has columns `id`, `user_id`, `category`, `product_name`, `frequency_range`, `created_at`, `updated_at`.
  - Production `user_product_usage.category` values already use canonical keys, including non-intake keys such as `peeling`. The `product_categories` seed must therefore contain valid non-intake category rows so the later FK can validate live data; only the 8 supported categories should have `is_intake_supported = true`.
  - Production `user_product_usage.frequency_range` values already use the newer canonical set in data: `less_than_monthly`, `weekly_1x`, `weekly_2x`, `weekly_3_4x`, `weekly_5_6x`, `daily_1x`, plus `NULL`. The target vocabulary also includes `monthly_1x` and `biweekly_1x`.
  - Upstream `origin/main` already contains a product-usage frequency migration. Re-verify the current frequency constants and write path in the implementation worktree before changing anything in this area.
  - Existing catalog brand data is inconsistent and mixes brand, product line, and product name, for example `Garnier`, `Garnier Fructis`, `Garnier Wahre Schätze`, `Pantene`, `L'Oréal Paris Elvital`, `Olaplex`, `OLAPLEX`.

## Promised End-State

At the end of this plan:

- Current catalog products are normalized into canonical category keys, brands, optional product lines, aliases, clean product names, identifiers, and origin.
- The repo contains a durable product identity normalization standard for future extraction from user text, front photos, barcode photos, OCR, retailer pages, and web research.
- Future canonical product additions, whether curated or user-submitted, follow the same documented identity/research playbook.
- The initial catalog cleanup lives in `data/product-catalog-normalization.json`. Future approved product additions use one small dated review record per approval day/source under `data/product-additions/`, only on days where products are actually approved, so diffs stay reviewable and no empty daily files are created.
- `products` has `category_key`, `brand_id`, optional `product_line_id`, `origin`, `is_chaarlie_recommended`, and no long-term dependency on free-text `products.brand` or display-label `products.category`.
- `user_product_usage` remains the one-product-per-category user inventory table for MVP and links to verified products or pending submissions.
- Unknown products are never assessed as if known. The assistant asks for intake details and defers product-specific judgment until review is complete.
- Unknown product handling in chat is not heuristic keyword matching. It is driven by a typed product lookup service/tool that returns structured lookup status.
- A reviewed user-submitted product is inserted into `products` plus the required category-specific spec table only after full manual approval and category validator success.
- Approved user-submitted products default to `is_chaarlie_recommended = false`, are usable for the submitting/owning user, and are excluded from general proactive recommendations until promoted.
- Matching/dedupe searches all active products, including `is_chaarlie_recommended = false`, to avoid researching the same product twice.
- Review remains script-first through Codex/Supabase/helper scripts. No polished admin UI is in MVP scope.
- Phase 0 ships and verifies independently before Phase 1 starts.

## Non-Goals

- Do not build a polished admin dashboard in this plan.
- Do not support multiple products per category in MVP. Keep `UNIQUE (user_id, category)` behavior for `user_product_usage`; HAI-115 can relax this later.
- Do not store product intelligence such as shampoo cleansing intensity, conditioner buckets, or mask specs on `user_product_usage`.
- Do not allow half-approved products in `products`.
- Do not make barcode mandatory. Barcode is strongly suggested and skippable.
- Do not ask users to understand product lines. Product-line resolution is internal.
- Do not make unapproved `is_chaarlie_recommended = false` products eligible for general recommendations.
- Do not introduce a `physical_products` table in MVP. Multi-use physical products are represented as separate `products` rows per category-use.
- Do not create a `product_aliases` table in Phase 0. Use canonical search text plus legacy/current titles from the normalization mapping; add a product alias table later only if matching misses justify it.
- Do not implement direct-to-storage signed uploads or resumable/TUS uploads in Phase 3. The Phase 3 Pareto fix is client-side image compression before the current server route plus server-side validation as the hard backstop.

## Locked Product Decisions

- Onboarding and chat both support product intake.
- Both surfaces offer two equal paths: `Foto hochladen` and `Daten eingeben`.
- Photo path requires front photo, category, and frequency. Barcode photo is strongly suggested but skippable.
- Phase 3 uses an 80/20 mobile upload approach: resize/compress selected product photos in the browser before the existing authenticated upload route. Direct signed Supabase Storage uploads and TUS/resumable uploads are the cleaner long-term architecture, but are deferred until upload volume/failure data justifies the extra lifecycle complexity.
- Manual path requires brand, product name, category, and frequency.
- Category is mandatory because it describes how the user uses the product. This matters for multi-use products that could be conditioner, leave-in, or mask.
- One canonical category vocabulary is shared by `products.category_key`, `user_product_usage.category`, `product_submissions.category`, matching, intake options, and category validators.
- Phase 0 maps current catalog display labels to canonical keys: `Shampoo -> shampoo`, `Conditioner (Drogerie) -> conditioner`, `Leave-in -> leave_in`, `Maske -> mask`, `Öle -> oil`, `Trockenshampoo -> dry_shampoo`, `Tiefenreinigungsshampoo -> deep_cleansing_shampoo`, `Bondbuilder -> bondbuilder`.
- The full review-to-catalog flow is exposed only for the 8 supported catalog categories: `shampoo`, `conditioner`, `leave_in`, `mask`, `oil`, `dry_shampoo`, `deep_cleansing_shampoo`, `bondbuilder`.
- Chat product intake is also limited to those 8 supported categories. For unsupported product categories, the assistant gives a brief natural German answer that the category cannot be added yet and does not render an intake card.
- Product intake is feature-flagged and lower-level runtime/tool builders must fail closed: omitted/undefined `productIntakeEnabled` is treated as disabled. The app can still fully enable the feature through the explicit route/env flag after brief testing.
- Product lookup may use simple per-turn memoization so repeated `lookup_product_candidate` calls in one assistant turn do not reload the catalog/brand tables repeatedly. Keep this local to the chat request; do not add Redis/global cache/invalidation in Phase 3.
- Multi-use physical products are duplicated as separate `products` rows per category-use for now. Each row has its own category specs and its own `is_chaarlie_recommended` value.
- Frequency is required wherever the product is added to the user's routine.
- Brand entry uses autocomplete from canonical brands and aliases with free-text fallback.
- Users can enter brand/line messily. Internally we preserve raw input and resolve to canonical brand, optional product line, and clean product name.
- `product_submissions.researched_payload` stores flexible pre-approval research JSON. Recommendations never read from this JSON.
- `products` receives a product only after canonical product data, required category-specific spec data, and manual review are complete.
- Approval requires complete source-backed metadata in one conclusive research pass: commercial link, image, price, currency, link status, checked timestamps, source evidence, category-specific specs, and manual review.
- `product_submissions.approved_product_id` points to the approved `products.id`.
- `user_product_usage.product_id` points to the verified product once matched or approved.
- `user_product_usage.product_submission_id` points to the intake/review record for traceability and can remain after approval.
- High-confidence matching can auto-link to any existing active product, including `is_chaarlie_recommended = false`.
- In chat, "found in DB" means any approved active product row, including `is_chaarlie_recommended = false`. These products can support exact product-detail assessment, but only `is_chaarlie_recommended = true` products remain eligible for broad/general Chaarlie recommendations.
- Auto-link requires exact canonical category match. Cross-category barcode/name matches are review candidates only; reviewer can create a new category-use row if needed.
- Uncertain matching goes to review.
- Ambiguous product mentions in chat do not trigger product intake. They trigger a natural clarification question, optionally listing likely existing candidates and asking whether the user means one of them or another product.
- The chat intake card renders only for: concrete product identity, supported category/use, conclusive lookup executed, and no approved active product match.
- The assistant text for not-found products is model-generated natural German, constrained by structured lookup state. Do not implement deterministic full-message templates for this response.
- The UI card is rendered from structured assistant-turn metadata such as `rag_context.product_intake_offer`, not by parsing visible assistant copy.
- Current catalog products are backfilled as `origin = 'curated'` and `is_chaarlie_recommended = true`. Newly approved user submissions are `origin = 'user_submitted'` and `is_chaarlie_recommended = false`.
- `origin` remains stable when a user-submitted product is later promoted; promotion changes only `is_chaarlie_recommended`.
- Approval metadata stays on `product_submissions`, not on `products`.
- Adding another product in an already-filled category replaces the current `user_product_usage` slot after user confirmation.
- Onboarding same-page edit/resume for the current category slot should save as an in-place update and must not scare the user with a replacement modal. Replacement confirmation is reserved for genuinely replacing an already-filled category from another entry point or with a clearly different product.
- Pending products count as category present in routine logic, but product-specific claims remain blocked until the product is verified.
- Approved owned products render with the same rich product card treatment as Chaarlie-recommended products. No user-facing "not recommended" badge.
- Internal/admin views see all products and can filter by recommendation status/origin.
- Chat-origin submissions notify the origin conversation. Onboarding-origin submissions notify/create a dedicated `Produktprüfung` conversation.
- Temporary uncommitted uploads are deleted after 6 hours. Approved/relevant photos are kept in private storage for audit and re-review. Rejected/spam/irrelevant/cancelled committed submission photos are deleted after a retention window, recommended 30 days.

---

## Target File Map

### Documentation And Data

- Create: `docs/product-identity-normalization.md`
  - Living standard for category keys, brand, product line, alias, clean product name, identifiers, origin, future extraction rules, and the ongoing product-addition playbook.
- Create: `data/product-catalog-normalization.json`
  - Reviewed mapping for every existing product: current category/brand/name text, canonical category key, canonical brand, optional product line, clean product name, known titles, brand/line aliases, notes.
- Create: `data/product-catalog-normalization.schema.json`
  - JSON schema for the mapping file so review scripts can validate it before migrations/backfills.
- Create: `data/product-additions/.gitkeep`
  - Directory for future dated reviewed product-addition records, created only when products are approved. Products approved from the same source on the same day append to the same file, for example `data/product-additions/2026-06-20-user-submitted-products.json`.

### Database

- Create: `supabase/migrations/<timestamp>_product_identity_normalization.sql`
  - Adds `product_categories`, `brands`, `brand_aliases`, `product_lines`, `product_identifiers`, `products.category_key`, `products.brand_id`, `products.product_line_id`, `products.origin`, `products.is_chaarlie_recommended`.
- Create: `supabase/migrations/<timestamp>_product_intake_submissions.sql`
  - Adds `product_submissions`, extends `user_product_usage`, adds indexes/RLS policies/storage metadata if managed through SQL.
- Defer: `supabase/migrations/<timestamp>_drop_products_legacy_identity_columns.sql`
  - Final contract migration after at least one separate production release proves app code, scripts, ingestion, RAG chunks, and rollback paths no longer depend on `products.brand` or `products.category`.

### Product Identity Library

- Create: `src/lib/product-identity/types.ts`
- Create: `src/lib/product-identity/categories.ts`
- Create: `src/lib/product-identity/normalize.ts`
- Create: `src/lib/product-identity/brand-resolution.ts`
- Create: `src/lib/product-identity/catalog-normalization.ts`
- Create: `src/lib/product-identity/display-name.ts`
- Create: `src/lib/product-identity/product-identifiers.ts`

### Product Intake Library

- Create: `src/lib/product-intake/types.ts`
- Create: `src/lib/product-intake/schemas.ts`
- Create: `src/lib/product-intake/product-matching.ts`
- Create: `src/lib/product-intake/product-lookup.ts`
- Create: `src/lib/product-intake/submissions.ts`
- Create: `src/lib/product-intake/category-validators.ts`
- Create: `src/lib/product-intake/review-workflow.ts`
- Create: `src/lib/product-intake/image-validation.ts`
- Create: `src/lib/product-intake/client-image-compression.ts`
- Create: `src/lib/product-intake/notifications.ts`

### API Routes

- Create: `src/app/api/product-intake/brand-options/route.ts`
- Create: `src/app/api/product-intake/onboarding/route.ts`
- Create: `src/app/api/product-intake/chat/route.ts`
- Create: `src/app/api/product-intake/upload/route.ts`

### Onboarding UI

- Modify: `src/lib/onboarding/store.ts`
- Modify: `src/lib/onboarding/product-usage-save.ts` if present on `origin/main`
- Modify: `src/components/onboarding/screens/product-drilldown-screen.tsx`
- Modify: `src/components/onboarding/onboarding-flow.tsx`
- Modify: `src/app/onboarding/page.tsx`

### Chat UI And Agent

- Create: `src/components/chat/product-intake-card.tsx`
- Modify: `src/components/chat/chat-message.tsx`
- Modify: `src/components/chat/chat-container.tsx`
- Modify: `src/hooks/use-chat.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/agent-v2/contracts.ts`
- Modify: `src/lib/agent-v2/named-product-context.ts` if present on `origin/main`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`

### Recommendation And Product Reads

- Modify all product selection/read paths that currently select/display `products.brand`, compare `products.category`, or return products for recommendations. Known candidates:
  - `src/lib/recommendation-engine/selection.ts`
  - `src/lib/recommendation-engine/normalize.ts`
  - `src/lib/recommendation-engine/adapters/from-persistence.ts`
  - `src/lib/routines/product-attachments.ts`
  - `src/lib/agent/tools/select-products.ts`
  - `src/lib/agent-v2/tools/select-products-projection.ts`
  - `src/lib/agent-v2/production/persisted-session-state.ts`
  - `src/components/chat/product-card.tsx`
  - `src/components/chat/product-detail-drawer.tsx`
  - `src/components/chat/product-popover.tsx`
  - `src/app/admin/products/page.tsx`
- Modify ingestion and chunking paths that key on `products.name`, `products.brand`, or `products.category`, including:
  - `scripts/ingest-products.ts`
  - `scripts/ingest-product-chunks.ts`
  - category spec backfill scripts under `scripts/backfill-*`
- Before implementation, re-derive this read/chunk surface on the current target branch. Do not assume a `src/lib/rag/*` product layer exists; current product chunking may be owned by `scripts/ingest-product-chunks.ts` and `content_chunks`.

### Review Ops Scripts

- Create: `scripts/product-identity/export-catalog.ts`
- Create: `scripts/product-identity/validate-normalization.ts`
- Create: `scripts/product-identity/apply-normalization.ts`
- Create: `scripts/product-intake/queue.ts`
- Create: `scripts/product-intake/review.ts`
- Create: `scripts/product-intake/research.ts`
- Create: `scripts/product-intake/approve.ts`
- Create: `scripts/product-intake/approve-ready.ts`
- Create: `scripts/product-intake/link-existing.ts`
- Create: `scripts/product-intake/request-info.ts`
- Create: `scripts/product-intake/notify-pending.ts`
- Create: `scripts/product-intake/cleanup-storage.ts`
- Create: `scripts/product-intake/promote.ts`
- Modify: `package.json`
  - Add script commands for identity and intake operations.

### Tests

- Create: `tests/product-identity-normalize.test.ts`
- Create: `tests/product-identity-resolution.test.ts`
- Create: `tests/product-catalog-normalization.test.ts`
- Create: `tests/product-intake-schema.test.ts`
- Create: `tests/product-intake-matching.test.ts`
- Create: `tests/product-intake-submissions.test.ts`
- Create: `tests/product-intake-review-workflow.test.ts`
- Create: `tests/product-intake-review-scripts.test.ts`
- Create: `tests/onboarding-product-intake.test.tsx`
- Create: `tests/chat-product-intake-card.test.tsx`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`
- Modify: `tests/agent-select-products-tool.spec.ts`
- Modify: `tests/product-catalog-lifecycle.test.ts`

---

## Phase 0: Product Identity Normalization

Phase 0 is standalone and blocking. Ship, verify, and stabilize this phase before starting product intake, submissions, or chat/onboarding UI changes.

### Task 0.1: Create Implementation Worktree

**Files:**

- No product files modified in this task.

- [ ] **Step 1: Fetch and confirm baseline**

Run from the root checkout:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status -sb
```

Expected: you know whether the root checkout is behind. Do not implement from the stale root checkout.

- [ ] **Step 2: Create the worktree**

Run:

```bash
npm run worktree:new -- product-intake-intelligence
```

Expected: a bootstrapped worktree under `.worktrees/product-intake-intelligence` on branch `codex/product-intake-intelligence`.

- [ ] **Step 3: Confirm worktree status and upstream facts**

Run:

```bash
cd .worktrees/product-intake-intelligence
git status --short
npm run --silent
```

Expected: no unrelated edits in the worktree. Then inspect current `origin/main` versions of product usage frequency code, named off-catalog product context, metadata health tooling, and package scripts before touching those areas.

- [ ] **Step 4: Create/symlink data directory if needed**

If `data/` is gitignored or missing in the worktree, create the directory or a local symlink before running identity scripts. Do not assume files generated in the root checkout exist in the worktree.

### Task 0.2: Snapshot Production Catalog And Usage Vocabulary

**Files:**

- Create: `scripts/product-identity/export-catalog.ts`
- Create: `data/product-catalog-snapshot.json`
- Test: `tests/product-catalog-normalization.test.ts`

- [ ] **Step 1: Write a test that asserts the snapshot shape**

Create `tests/product-catalog-normalization.test.ts` with tests that require:

- every snapshot row has `id`, `brand`, `name`, `category`, `is_active`, `lifecycle_status`;
- every snapshot row's current category can map to a canonical category key;
- no duplicate product ids exist;
- production frequency vocabulary in fixture/test constants uses only `less_than_monthly`, `monthly_1x`, `biweekly_1x`, `weekly_1x`, `weekly_2x`, `weekly_3_4x`, `weekly_5_6x`, `daily_1x`.

- [ ] **Step 2: Create the export script**

Create `scripts/product-identity/export-catalog.ts` to:

- load `.env.local`;
- connect with the Supabase service role;
- query production `products` with `id, brand, name, category, is_active, lifecycle_status, image_url, affiliate_link, price_eur, currency, purchase_link_status, purchase_link_checked_at, price_checked_at`;
- query distinct `user_product_usage.frequency_range` values as an aggregate only;
- write `data/product-catalog-snapshot.json`.

The script must not export user ids, product usage rows, or other personal data.

- [ ] **Step 3: Run the export**

Run:

```bash
npm run products:identity:export
```

Expected: `data/product-catalog-snapshot.json` exists and contains the current product catalog plus aggregate frequency vocabulary.

- [ ] **Step 4: Run the tests**

Run:

```bash
npx tsx --test tests/product-catalog-normalization.test.ts
```

Expected: pass.

### Task 0.3: Write The Product Identity Standard

**Files:**

- Create: `docs/product-identity-normalization.md`

- [ ] **Step 1: Document the canonical model**

Create `docs/product-identity-normalization.md` with these rules:

- `brand` is the canonical consumer-facing brand or manufacturer-owned product brand, for example `Pantene`, `Garnier`, `L'Oréal Paris`, `Balea`, `OLAPLEX`.
- `product_line` is optional and captures sub-brand/series/range, for example `Pro-V`, `Pro-V Miracles`, `Fructis`, `Wahre Schätze`, `Elvital`, `Balea Med`.
- `products.name` is the clean SKU/product name without duplicated canonical brand or product line when they are confidently separable.
- `product_categories.key` is the canonical category source for products, user usage, submissions, matching, intake options, and validators.
- `products.category_key` stores category-use, not only physical taxonomy. Multi-use physical products are duplicated into one product row per supported category-use.
- User input may contain brand, line, name, variant, and marketing words in any field. Preserve raw input and resolve internally.
- Product-line handling must be forgiving. Users may type a product line as brand, include it in the product name, omit it entirely, or mix it with variant words. The UI must not require users to understand the brand-vs-line distinction; only internal resolution/review uses it.
- Use one alias concept for brand-entry resolution. An alias may resolve to brand only or to brand plus product line.
- Front photo/OCR and retailer search output are treated as raw extraction, not canonical truth.
- Uncertain brand/line/name splits go to review rather than guessed auto-approval.

- [ ] **Step 2: Add examples from current catalog**

Include examples for:

- `Pantene Pro-V Miracles Hydra Glow Conditioner` -> brand `Pantene`, line `Pro-V Miracles`, name `Hydra Glow Conditioner`;
- `Garnier Fructis Hair Food Aloe Vera Feuchtigkeitsspülung` -> brand `Garnier`, line `Fructis Hair Food`, name `Aloe Vera Feuchtigkeitsspülung`;
- `Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung` -> brand `Garnier`, line `Wahre Schätze`, name `Kokosmilch & Macadamia Nährende Spülung`;
- `L'Oréal Paris Elvital Fiber Booster Conditioner` -> brand `L'Oréal Paris`, line `Elvital`, name `Fiber Booster Conditioner`;
- `Balea Med Ultra Sensitive Shampoo` -> brand `Balea`, line `Med`, name `Ultra Sensitive Shampoo`.

- [ ] **Step 3: Document future extraction behavior**

Add a section for new user submissions:

- first normalize raw brand text against aliases;
- then attempt brand plus product line resolution;
- then normalize product name by removing duplicated brand/line tokens only when confidence is high;
- barcode/GTIN match wins over text matching;
- exact normalized brand plus line plus name plus category can auto-link;
- all close/ambiguous matches stay in review.
- barcode/GTIN plus category can auto-link; barcode/GTIN without category only returns candidates because one physical product can have multiple category-use rows.

- [ ] **Step 4: Document the ongoing product-addition playbook**

Add a playbook section that applies to curated team additions, user-submitted products, and future imports:

- create or update one reviewed identity/research record per category-use product row;
- use `data/product-catalog-normalization.json` only for the initial catalog cleanup;
- use dated files under `data/product-additions/` for future curated, user-submitted, or imported product approval batches;
- create a dated addition file only when at least one product is actually approved in that batch/day;
- append products approved from the same source on the same date to the same addition file;
- write the addition record only after the approval DB transaction succeeds, so the record documents the actual created product/spec/identifier rows;
- addition records store the final approved payload plus review metadata only; automation drafts and review deltas stay in `product_submissions.researched_payload` for learning/audit;
- resolve canonical category key, brand, optional product line, and display-quality product name;
- preserve raw/known titles for search and audit;
- record identifiers where available;
- record source evidence and commercial/display metadata;
- prefer sources in this order: official brand/manufacturer page, major retailer pages, barcode/GTIN lookup, secondary product listings, then user photo/OCR as identity evidence;
- fill the required category-specific spec payload;
- run category validator before inserting into `products`;
- set `origin` according to source and set `is_chaarlie_recommended` according to recommendation eligibility;
- do not create a canonical product row until the record is complete and reviewed.

### Task 0.4: Create The Normalization Mapping File

**Files:**

- Create: `data/product-catalog-normalization.schema.json`
- Create: `data/product-catalog-normalization.json`
- Create: `data/product-additions/.gitkeep`
- Create: `scripts/product-identity/validate-normalization.ts`
- Test: `tests/product-catalog-normalization.test.ts`

- [ ] **Step 1: Define the mapping schema**

Create `data/product-catalog-normalization.schema.json` requiring each row:

- `product_id`;
- `current_brand`;
- `current_name`;
- `current_category`;
- `canonical_category_key`;
- `canonical_brand`;
- `product_line` nullable;
- `clean_name`;
- `aliases` array; each alias resolves to the row's canonical brand and, when `product_line` is present and the alias includes the line, to brand plus product line;
- `known_titles` array for legacy/current/retailer titles used in generated search text, not a product alias table;
- `identifiers` array with optional GTIN/EAN/barcode/retailer identifiers when known;
- `notes` nullable;
- `review_status` as `draft`, `reviewed`, or `blocked`.

- [ ] **Step 2: Create the first mapping file**

Create `data/product-catalog-normalization.json` from the production snapshot. The first pass can mark rows `draft`, but the final backfill must require all rows to be `reviewed`.

Create `data/product-additions/.gitkeep` so future reviewed product-addition batches have a stable home without changing the baseline catalog cleanup file.

- [ ] **Step 3: Create the validation script**

Create `scripts/product-identity/validate-normalization.ts` to fail when:

- any production product id is missing from the mapping;
- any mapping product id is unknown;
- `canonical_category_key` is not one of the supported canonical category keys;
- `canonical_brand` or `clean_name` is blank;
- `clean_name` still starts with the exact canonical brand plus a separator;
- `product_line` is present but `canonical_brand` is missing;
- duplicate aliases map to conflicting canonical brand/line pairs or attempt to reuse the same `normalized_alias`;
- `known_titles` contains blank strings;
- `identifiers` contains unsupported identifier types or blank values;
- any row is not `reviewed` when run with `--require-reviewed`.

The validator should support validating the baseline file and future `data/product-additions/*.json` files with the same schema rules. For the baseline file, every current production product id must be present. For future addition files, product ids may be absent before insertion but the reviewed identity/research fields must still be complete.

- [ ] **Step 4: Add package scripts**

Add:

```json
{
  "products:identity:export": "tsx scripts/product-identity/export-catalog.ts",
  "products:identity:validate": "tsx scripts/product-identity/validate-normalization.ts",
  "products:identity:validate-reviewed": "tsx scripts/product-identity/validate-normalization.ts --require-reviewed",
  "products:identity:apply": "tsx scripts/product-identity/apply-normalization.ts"
}
```

- [ ] **Step 5: Validate the mapping**

Run:

```bash
npm run products:identity:validate
```

Expected: pass for structural validation. `--require-reviewed` may fail until manual review is complete.

### Task 0.5: Add Category, Brand, Product Line, Alias, And Identifier Schema

**Files:**

- Create: `supabase/migrations/<timestamp>_product_identity_normalization.sql`
- Modify: `src/lib/types.ts`
- Test: `tests/product-identity-resolution.test.ts`

- [ ] **Step 1: Write schema expectations as tests**

Create tests or SQL assertions that expect:

- `product_categories` has `key`, `display_name_de`, `sort_order`, `is_catalog_supported`, `is_intake_supported`, `created_at`, `updated_at`;
- `brands` has `id`, `canonical_name`, `normalized_name`, `created_at`, `updated_at`;
- `brand_aliases` has `id`, `brand_id`, optional `product_line_id`, `alias`, `normalized_alias`, timestamps, and a composite FK that prevents a line from being paired with the wrong brand;
- `product_lines` has `id`, `brand_id`, `canonical_name`, `normalized_name`, timestamps, and a composite unique key on `(id, brand_id)`;
- `product_identifiers` has `id`, `product_id`, `identifier_type`, `identifier_value`, `normalized_identifier_value`, timestamps, and allows the same identifier to point to more than one category-use product row;
- `products.category_key` exists and references `product_categories(key)`;
- `products.brand_id` exists and references `brands(id)`;
- `products.product_line_id` exists and is protected by a composite FK with `products.brand_id` so a product cannot point to a line from another brand;
- `products.origin` exists and accepts `curated` and `user_submitted`;
- `products.is_chaarlie_recommended` exists and defaults to false.

- [ ] **Step 2: Create the migration**

Create the migration with:

```sql
create table if not exists public.product_categories (
  key text primary key,
  display_name_de text not null,
  sort_order integer not null default 0,
  is_catalog_supported boolean not null default false,
  is_intake_supported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.product_categories (key, display_name_de, sort_order, is_catalog_supported, is_intake_supported)
values
  ('shampoo', 'Shampoo', 10, true, true),
  ('conditioner', 'Conditioner', 20, true, true),
  ('leave_in', 'Leave-in', 30, true, true),
  ('mask', 'Maske', 40, true, true),
  ('oil', 'Öl', 50, true, true),
  ('dry_shampoo', 'Trockenshampoo', 60, true, true),
  ('deep_cleansing_shampoo', 'Tiefenreinigungsshampoo', 70, true, true),
  ('bondbuilder', 'Bondbuilder', 80, true, true),
  ('heat_protectant', 'Hitzeschutz', 90, false, false),
  ('serum', 'Serum', 100, false, false),
  ('scrub', 'Scrub', 110, false, false),
  ('peeling', 'Peeling', 120, false, false),
  ('styling_gel', 'Styling-Gel', 130, false, false),
  ('styling_mousse', 'Styling-Mousse', 140, false, false),
  ('styling_cream', 'Styling-Creme', 150, false, false),
  ('hairspray', 'Haarspray', 160, false, false)
on conflict (key) do update set
  display_name_de = excluded.display_name_de,
  sort_order = excluded.sort_order,
  is_catalog_supported = excluded.is_catalog_supported,
  is_intake_supported = excluded.is_intake_supported,
  updated_at = now();

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_lines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  canonical_name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, normalized_name),
  unique (id, brand_id)
);

create table if not exists public.brand_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_line_id uuid,
  alias text not null,
  normalized_alias text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_line_id, brand_id)
    references public.product_lines(id, brand_id)
    on delete cascade
);
```

Do not trim this seed down to only the 8 intake-supported categories. `user_product_usage.category` may already contain canonical non-intake keys such as `peeling`; those rows must exist in `product_categories` with `is_intake_supported = false` so the later `user_product_usage.category` FK can validate live data while the intake UI remains limited to the 8 supported categories.

- [ ] **Step 3: Add product identifiers**

Add:

```sql
create table if not exists public.product_identifiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  identifier_type text not null check (identifier_type in ('gtin','ean','barcode','retailer_sku','retailer_url')),
  identifier_value text not null,
  normalized_identifier_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, identifier_type, normalized_identifier_value)
);

create index if not exists idx_product_identifiers_lookup
  on public.product_identifiers (identifier_type, normalized_identifier_value);
```

- [ ] **Step 4: Extend products**

Add:

```sql
alter table public.products
  add column if not exists category_key text references public.product_categories(key) on delete restrict,
  add column if not exists brand_id uuid references public.brands(id) on delete restrict,
  add column if not exists product_line_id uuid,
  add column if not exists origin text not null default 'curated',
  add column if not exists is_chaarlie_recommended boolean not null default false;

alter table public.products
  add constraint products_product_line_matches_brand
  foreign key (product_line_id, brand_id)
  references public.product_lines(id, brand_id)
  on delete restrict;

alter table public.products
  add constraint products_origin_check
  check (origin in ('curated','user_submitted'));
```

Backfill the current catalog as curated and Chaarlie-recommended:

```sql
update public.products
set origin = 'curated',
    is_chaarlie_recommended = true;
```

- [ ] **Step 5: Add RLS/admin policies**

Make category/brand/line/alias data readable where products are readable. Writes should be service-role/admin only for MVP.

- [ ] **Step 6: Audit RLS on existing category spec tables**

Before changing product identity/spec writes, audit RLS and policies on all existing product spec tables touched by this plan, especially conditioner/leave-in/oil/shampoo spec and eligibility tables.

If any table is unexpectedly exposed, create a deliberate RLS remediation migration with policies that preserve existing app reads/writes. Do not simply enable RLS without policies.

### Task 0.6: Backfill Category, Brand/Line IDs, Origin, And Clean Product Names

**Files:**

- Create: `scripts/product-identity/apply-normalization.ts`
- Modify: `data/product-catalog-normalization.json`
- Test: `tests/product-catalog-normalization.test.ts`

- [ ] **Step 1: Finish manual mapping review**

Review every row in `data/product-catalog-normalization.json` until `review_status = "reviewed"` for all current products.

During review, explicitly decide per row whether suffixes such as `(Silikone)` or `(Kokos)` are part of the display product name or should become structured notes/flags. Do not let the apply script silently strip or preserve these without the reviewed mapping saying so.

- [ ] **Step 2: Run reviewed validation**

Run:

```bash
npm run products:identity:validate-reviewed
```

Expected: pass.

- [ ] **Step 3: Create apply script**

Create `scripts/product-identity/apply-normalization.ts` to:

- create a DB-side backup table before any product name/category/brand rewrite, for example `products_identity_backup_<date>`, including the original `id`, `brand`, `category`, `name`, commercial metadata, and timestamps;
- upsert `brands`;
- upsert `product_lines`;
- upsert `brand_aliases` from the mapping `aliases` array, including aliases that resolve to brand plus product line;
- upsert identifiers where the mapping/research has reliable GTIN/EAN/retailer identifiers;
- update each `products` row with `category_key`, `brand_id`, `product_line_id`, `origin = 'curated'`, `is_chaarlie_recommended = true`, and `name = clean_name`;
- keep `products.brand` and `products.category` unchanged until all app reads are migrated;
- run in dry-run mode by default;
- require `--apply --confirm-project=pqdkhefxsxkyeqelqegq` for writes.

- [ ] **Step 3.5: Make ingestion id-stable before renaming products**

Before applying any `products.name` rewrite, update existing product ingestion/backfill scripts that key on exact `name,category` so they use stable ids, normalized identity, or explicit mapping rather than creating duplicates after cleanup.

At minimum inspect and update:

- `scripts/ingest-products.ts`;
- `scripts/ingest-product-chunks.ts`;
- category spec backfill scripts such as `scripts/backfill-leave-in-specs.ts` and related `scripts/backfill-*` files.

Expected: rerunning ingestion after `name = clean_name` does not create duplicate products and does not crash if legacy category display labels are no longer the primary identity.

For product-list chunk generation, use only the JSON-driven product chunk path after normalization. Do not run both product chunk writers if the target branch still has multiple ways to create `product_list` chunks, because running both can double-insert equivalent chunks.

- [ ] **Step 4: Dry-run the apply script**

Run:

```bash
npm run products:identity:apply -- --dry-run
```

Expected: printed counts for brands, lines, aliases, products to update; no writes.

- [ ] **Step 5: Apply after human approval**

Run only after explicit human approval:

```bash
npm run products:identity:apply -- --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

Expected: all existing products have `category_key` and `brand_id`; known line products have `product_line_id`; `products.brand` and `products.category` remain available temporarily.

- [ ] **Step 6: Refresh product RAG chunks after identity cleanup**

After the apply script succeeds, run or add a chunk re-ingest path for product list chunks so chat/RAG content reflects cleaned display names, canonical brands, and category keys.

Expected: `content_chunks`/product-list chunks no longer contain stale pre-normalization display names for current products.

### Task 0.7: Migrate Product Reads To Normalized Category, Brand, And Line

**Files:**

- Create: `src/lib/product-identity/display-name.ts`
- Modify product reads listed in Target File Map
- Test: `tests/product-identity-resolution.test.ts`
- Test: existing product/recommendation tests

- [ ] **Step 0: Enforce DB-first cutover gate**

Do not deploy normalized-read code to production until the Phase 0 database migration and backfill are already applied and verified on the target Supabase project.

Hard gate order:

1. Apply the Phase 0 identity migration to the target Supabase project.
2. Run the identity backfill for categories, brands, product lines, aliases, identifiers, `products.category_key`, `products.brand_id`, `products.product_line_id`, `products.origin`, and `products.is_chaarlie_recommended`.
3. Verify production schema/data with SQL checks: required tables/columns exist, every active/current product has normalized identity fields, every current product category maps to `product_categories`, no product line points to the wrong brand, and product cards/recommendation reads can resolve normalized identity.
4. Only then merge/deploy app code that depends on normalized joined fields.

If the implementation intentionally ships code before the migration, normalized reads must tolerate missing normalized tables/columns and fall back to legacy `products.brand`/`products.category` until the DB gate is complete. Do not leave this implicit.

- [ ] **Step 1: Create display helper tests**

Write tests for:

- brand only: `Pantene` plus `Hydra Glow Shampoo` -> `Pantene Hydra Glow Shampoo`;
- brand plus line: `Garnier` plus `Fructis Hair Food` plus `Aloe Vera Spülung` -> `Garnier Fructis Hair Food Aloe Vera Spülung`;
- product name already contains line due legacy row -> helper avoids duplicate display where possible.
- category display: `category_key = oil` returns display label `Öl` and logic key `oil`.

- [ ] **Step 2: Implement display helpers**

Create helpers:

- `buildProductDisplayName(product)`;
- `buildProductSearchText(product)`;
- `getProductCategoryKey(product)`;
- `getProductCategoryDisplayName(product)`;
- `getProductBrandLabel(product)`;
- `getProductLineLabel(product)`.

- [ ] **Step 3: Update read queries**

Update product selects to include joined category/brand/line data or a stable view/RPC that returns:

- `category_key`;
- `category_display_name_de`;
- `brand_name`;
- `product_line_name`;
- `display_name`;
- existing fields expected by UI and tools.

- [ ] **Step 4: Keep compatibility during migration**

Where a consumer still expects `product.brand` or display `product.category`, adapt at the boundary from normalized joined fields. Do not write new code that reads raw `products.brand` or raw `products.category`.

- [ ] **Step 5: Run product UI and recommendation checks**

Run:

```bash
npx tsx --test tests/product-identity-resolution.test.ts
npx tsx --test tests/product-catalog-lifecycle.test.ts
```

Expected: pass.

### Task 0.8: Defer Legacy `products.brand` And `products.category` Drop

**Files:**

- Do not create the drop migration in the blocking foundation release.

- [ ] **Step 1: Confirm the contract step is deferred**

Keep `products.brand` and `products.category` through at least one separate production release after normalized reads ship. This preserves rollback safety and prevents stale scripts/functions from crashing while the identity migration is still fresh.

- [ ] **Step 2: Record the follow-up**

Keep Phase 7 in this plan as the explicit follow-up for the later contract migration. Do not mark the whole product-intake project fully cleaned up until Phase 7 is either executed or deliberately rescheduled.

---

## Phase 1: User Product Usage Extension

### Task 1.1: Verify Product Frequency Vocabulary Is Already Current

**Files:**

- Inspect: `src/lib/vocabulary/frequencies.ts`
- Inspect: `src/lib/onboarding/product-usage-save.ts` if present
- Inspect: `src/lib/recommendation-engine/adapters/from-persistence.ts`
- Inspect tests/fixtures using product frequency values

- [ ] **Step 1: Verify upstream migration**

On current `origin/main`, verify product frequencies already use:

```ts
export const PRODUCT_FREQUENCIES = [
  "less_than_monthly",
  "monthly_1x",
  "biweekly_1x",
  "weekly_1x",
  "weekly_2x",
  "weekly_3_4x",
  "weekly_5_6x",
  "daily_1x",
] as const
```

- [ ] **Step 2: Verify legacy normalization**

Confirm current code already normalizes or safely handles old values:

```ts
rarely -> less_than_monthly
1_2x -> weekly_1x
3_4x -> weekly_3_4x
5_6x -> weekly_5_6x
daily -> daily_1x
```

Do not re-implement this if it already exists upstream.

- [ ] **Step 3: Verify frequency ordering**

Confirm current code orders:

```ts
less_than_monthly: 0
monthly_1x: 1
biweekly_1x: 2
weekly_1x: 3
weekly_2x: 4
weekly_3_4x: 5
weekly_5_6x: 6
daily_1x: 7
```

- [ ] **Step 4: Update only stale tests and fixtures**

Replace old product frequency values in tests/fixtures only if they still exist on current `origin/main` and are not intentionally covering legacy normalization.

### Task 1.2: Extend `user_product_usage`

**Files:**

- Create: `supabase/migrations/<timestamp>_product_intake_submissions.sql`
- Modify: `src/lib/types.ts`
- Test: `tests/product-intake-schema.test.ts`

- [ ] **Step 1: Add columns**

Extend `user_product_usage` with:

```sql
alter table public.user_product_usage
  drop constraint if exists user_product_usage_category_check;

alter table public.user_product_usage
  add column if not exists brand_text text,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists product_submission_id uuid,
  add column if not exists match_status text not null default 'text_only',
  add column if not exists intake_method text,
  add column if not exists source text,
  add column if not exists front_image_path text;

```

Target `match_status` values:

- `text_only`;
- `matched`;
- `pending_review`;
- `needs_more_info`.

- [ ] **Step 2: Add constraints**

Add checks:

```sql
alter table public.user_product_usage
  add constraint user_product_usage_match_status_check
  check (match_status in ('text_only','matched','pending_review','needs_more_info'));

alter table public.user_product_usage
  add constraint user_product_usage_intake_method_check
  check (intake_method is null or intake_method in ('manual','photo'));

alter table public.user_product_usage
  add constraint user_product_usage_source_check
  check (source is null or source in ('onboarding','chat','profile','script'));
```

Keep existing `UNIQUE (user_id, category)` for MVP.

`user_product_usage.category` remains the column name, but values must be canonical `product_categories.key` values.

- [ ] **Step 3: Update frequency constraint**

Ensure the DB constraint accepts:

```sql
less_than_monthly, monthly_1x, biweekly_1x, weekly_1x, weekly_2x,
weekly_3_4x, weekly_5_6x, daily_1x
```

and old values are normalized before the stricter constraint is applied.

- [ ] **Step 4: Verify and backfill existing rows**

Current production data is expected to already use canonical `user_product_usage.category` keys and canonical `frequency_range` values. Verify this first and treat mapping/normalization as a likely no-op on current prod data. Do not invent a display-label mapping unless live data proves it is needed.

Backfill:

- `brand_text = null`;
- `match_status = 'text_only'` when `product_id` and `product_submission_id` are null;
- existing category values are canonical keys or are mapped before adding the FK;
- normalize old `frequency_range` values if any remain.

- [ ] **Step 5: Add category FK after backfill**

Only after existing rows are canonical, add and validate the FK. Prefer `not valid` plus `validate constraint` so rollout fails cleanly if unexpected legacy values remain:

This FK depends on Phase 0 seeding all live category keys, including non-intake keys such as `peeling`. The intake UI/API still exposes only rows where `is_intake_supported = true`.

```sql
alter table public.user_product_usage
  add constraint user_product_usage_category_fkey
  foreign key (category)
  references public.product_categories(key)
  on delete restrict
  not valid;

alter table public.user_product_usage
  validate constraint user_product_usage_category_fkey;
```

### Task 1.3: Add Product Submissions

**Files:**

- Create: `supabase/migrations/<timestamp>_product_intake_submissions.sql`
- Test: `tests/product-intake-schema.test.ts`

- [ ] **Step 1: Create table**

Create:

```sql
create table if not exists public.product_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_product_usage_id uuid references public.user_product_usage(id) on delete set null,
  source text not null check (source in ('onboarding','chat')),
  source_conversation_id uuid,
  intake_method text not null check (intake_method in ('manual','photo')),
  category text not null references public.product_categories(key) on delete restrict,
  brand_text text,
  product_name_text text,
  frequency_range text,
  front_image_path text,
  barcode_image_path text,
  previous_product_id uuid references public.products(id) on delete set null,
  previous_product_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review',
  researched_payload jsonb not null default '{}'::jsonb,
  intake_history jsonb not null default '[]'::jsonb,
  approved_product_id uuid references public.products(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  user_facing_resolution_reason text,
  user_facing_next_step text,
  user_facing_missing_fields jsonb not null default '[]'::jsonb,
  notification_sent_at timestamptz,
  cleanup_after timestamptz,
  photos_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_submissions_status_check check (
    status in ('pending_review','researching','ready_for_review','needs_more_info','matched_existing','approved','rejected','cancelled_by_user')
  )
);
```

- [ ] **Step 2: Add ownership integrity**

Add constraints/triggers so:

- `source_conversation_id`, if present, belongs to the same `user_id`;
- `user_product_usage_id`, if present, belongs to the same `user_id`;
- `user_product_usage_id`, if present, has the same category as the submission;
- at most one open submission can be the current pending link for a given `user_product_usage` row;
- closed submissions cannot remain the current pending usage link except as traceability after successful `approved` or `matched_existing` linkage;
- `category` is a supported intake category when a submission is created through onboarding/chat;
- service-role code cannot link another user's conversation, submission, usage row, or storage path.

- [ ] **Step 3: Add reverse FK**

After table creation, add:

```sql
alter table public.user_product_usage
  add constraint user_product_usage_product_submission_id_fkey
  foreign key (product_submission_id)
  references public.product_submissions(id)
  on delete set null;
```

- [ ] **Step 4: Add indexes**

Add indexes for:

- `(status, created_at asc)`;
- `(user_id, created_at desc)`;
- `(approved_product_id)`;
- `(source_conversation_id)`;
- `(user_product_usage_id)`.

### Task 1.4: Add RLS And Storage Policies

**Files:**

- Create/modify migration from Task 1.3
- Test: `tests/product-intake-submissions.test.ts`

- [ ] **Step 1: Enable RLS**

Enable RLS on `product_submissions`.

- [ ] **Step 2: Keep raw submission table service-only**

Do not grant direct user `select` on raw `product_submissions` under any MVP route. RLS is row-level, not column-level, and the table contains internal `researched_payload`, source evidence, reviewer notes, image paths, reviewer metadata, and workflow state.

Users create submissions only through authenticated route handlers/RPC that derive `user_id` from auth. Users read only sanitized submission status through API/RPC/view fields such as status, user-facing reason, next step, missing fields, and linked approved product/card data when available. Internal research payloads, raw source evidence, reviewer notes, reviewer identity, and internal failure details must stay service/admin-only.

- [ ] **Step 3: Add service-role/admin update path**

Review scripts use service role. Route handlers must derive `user_id` from auth and never trust client-provided `user_id`.

- [ ] **Step 4: Add private storage bucket**

Create private bucket, for example `product-intake`.

Storage path convention:

```txt
product-intake/{user_id}/{submission_id}/front.{ext}
product-intake/{user_id}/{submission_id}/barcode.{ext}
product-intake/tmp/{user_id}/{upload_session_id}/front.{ext}
product-intake/tmp/{user_id}/{upload_session_id}/barcode.{ext}
```

Photo intake uses a temporary upload session before Save/Continue. The client may upload a front photo first and fill category/frequency afterwards, but no `product_submissions` row, no `user_product_usage` change, and no review queue item is created until the user commits the add-product flow.

On Save/Continue, the submit route validates required inputs, creates the `product_submissions` row, atomically moves or links uploaded files from `tmp/{user_id}/{upload_session_id}/...` to `{user_id}/{submission_id}/...`, upserts `user_product_usage`, then runs matching/review routing. Abandoned upload sessions expire after 6 hours and are cleaned up without creating submissions.

- [ ] **Step 5: Add upload validations**

Enforce:

- MIME type image only;
- server-side file signature/magic-byte validation, not only browser `Content-Type`;
- size limit;
- generated server-side storage path/filename;
- path ownership;
- expected image kind validation state (`front`, `barcode`);
- private bucket access with authenticated/signed URLs only;
- temporary uncommitted upload cleanup after 6 hours;
- rejected/spam/cancelled cleanup after retention window.

---

## Phase 2: Product Identity Resolution And Matching

### Task 2.1: Implement Normalization Helpers

**Files:**

- Create: `src/lib/product-identity/normalize.ts`
- Test: `tests/product-identity-normalize.test.ts`

- [ ] **Step 1: Write tests**

Test normalization for:

- case folding;
- trim/collapse whitespace;
- punctuation normalization;
- diacritic-insensitive matching where safe;
- `L'Oréal`, `L’Oréal`, and `Loreal`;
- `OLAPLEX` and `Olaplex`;
- `Garnier Fructis` alias lookup.

- [ ] **Step 2: Implement helpers**

Create:

- `normalizeIdentityText(input: string): string`;
- `normalizeIdentifier(input: string): string`;
- `tokenizeProductName(input: string): string[]`.

### Task 2.2: Implement Brand/Line Resolution

**Files:**

- Create: `src/lib/product-identity/brand-resolution.ts`
- Test: `tests/product-identity-resolution.test.ts`

- [ ] **Step 1: Write resolver tests**

Test:

- `Pantene Pro-V` resolves to brand `Pantene` and line `Pro-V`;
- `Garnier Fructis` resolves to brand `Garnier` and line `Fructis`;
- `Fructis` resolves to brand plus line when alias says so;
- unknown brand returns unresolved raw text;
- conflicting aliases are rejected by validation and are not represented in `brand_aliases`;

- [ ] **Step 2: Implement resolver**

The resolver should:

- load canonical brands, lines, and aliases;
- check exact normalized alias first;
- check canonical brand next;
- optionally infer line from product-name text;
- return confidence and reason codes.

### Task 2.3: Implement Product Matching

**Files:**

- Create: `src/lib/product-intake/product-matching.ts`
- Test: `tests/product-intake-matching.test.ts`

- [ ] **Step 1: Write matching tests**

Cases:

- GTIN/EAN plus selected canonical category returns exact matched product when one active row exists.
- GTIN/EAN without category or with a different category returns review candidates only.
- Brand plus line plus clean name plus canonical category exact match returns matched.
- Existing `is_chaarlie_recommended = false` product can match.
- Multiple close candidates returns ambiguous/review.
- Missing category cannot match for usage.
- Category mismatch does not auto-link.

- [ ] **Step 2: Implement matching**

Match order:

1. Identifier plus selected canonical category match through `product_identifiers`.
2. Exact normalized brand/line/name/category-key match.
3. Exact normalized brand/name/category-key match when no line exists.
4. Conservative fuzzy candidate list for review only.

Return statuses:

- `matched`;
- `pending_review`;
- `needs_more_info`;
- `rejected` only for explicit validation failures.

---

## Phase 3: Intake APIs And UI

**Blocking precondition:** Phase 3 API/UI work assumes the Phase 0 identity normalization and Phase 1 usage/submission schema exist in the target database or branch database. Do not stage or QA Phase 3 against production until Phase 0/1 migrations are applied or a branch database with those migrations is explicitly used. If migrations are not applied, Phase 3 endpoints must remain feature-flagged off and should fail closed with controlled disabled/missing-schema behavior.

### Phase 3 Post-Review Patch Spec

This patch spec supersedes any earlier Phase 3 implementation notes where they conflict. It reflects the accepted code-review and simulated-user findings from the Phase 3 worktree.

**Accepted engineering decisions:**

- Multi-row pending lifecycle transitions are DB-owned where the invariant is already enforced by DB triggers. Do not rely on several best-effort app-side calls for transitions that must update both `user_product_usage` and `product_submissions`.
- Add small transactional Supabase functions/RPC helpers for trigger-safe cancellation/replacement lifecycle transitions, especially:
  - deselecting/removing a pending product slot;
  - cancelling an old pending submission while replacing it with a matched product or a new pending submission;
  - rollback/reopen behavior when replacement fails after temporarily closing an old submission.
- Keep user-facing failure copy friendly and generic. Do not expose missing column/bucket/schema details to users. Preserve real causes in server logs/Sentry/operator checks.
- Replaced committed submission photos are deleted after a successful replacement unless still referenced. Do not leave private user photos as implicit storage history. If audit-grade photo history is needed later, model it explicitly with a submission-image table or retention policy.
- Same-slot onboarding edits update the existing `pending_review` submission in place only while it has not proceeded further in review. Once review has advanced, replacement must use the normal lifecycle path.
- Do bounded architecture cleanup before staging Phase 3:
  - extract onboarding product-intake orchestration/payload/upload glue out of `OnboardingFlow`;
  - share small product-intake client primitives where they are truly common, for example brand-option fetching, upload preparation, submit gating, and payload building;
  - do not force a universal chat+onboarding form state machine if it makes the two surfaces harder to understand;
  - defer the broader AgentV2 product-intake capability abstraction to a stacked cleanup phase unless the current patch naturally exposes a tiny generic metadata policy.
- Add an operator readiness check for target Supabase state before declaring Phase 3 ready. The check must verify the required normalized product columns/tables and the `product-intake` storage bucket/policies exist in the target project or branch database.

**Known blockers found by simulated user review:**

- Photo upload can fail with `Bucket not found` if the `product-intake` storage bucket migration has not been applied.
- Manual submit/brand lookup can fail if Phase 0 identity columns such as `products.brand_id` are not present in the connected Supabase project.
- These are not user-copy problems; they are migration/readiness blockers. Phase 3 QA must run against a database with Phase 0/1/2 migrations applied, or the feature flag must remain off.

**Patch verification requirements:**

- Add tests that model the DB trigger invariant: unsuccessful submissions cannot remain linked from `user_product_usage`.
- Test cancellation/removal through the DB-side helper/RPC, not only against an in-memory fake repository.
- Test rollback ordering for failed replacement so the old pending submission is reopened before the old usage link is restored, or use one DB transaction that makes the intermediate invalid state impossible.
- Test pending photo replacement cleanup: new committed photo becomes current reference; old committed object is removed after successful DB update; new object is removed on failure.
- Rerun code review after the patch. Rerun simulated-user review only against a migrated/ready Supabase state or explicitly report the readiness blocker.

### Task 3.0: Add Intake Feature Flag

**Files:**

- Modify: existing feature flag/config location
- Modify: product-intake route guards
- Test: `tests/product-intake-submissions.test.ts`

- [ ] **Step 1: Define kill switch**

Add a server-side feature flag/config value for product intake surfaces, for example `PRODUCT_INTAKE_ENABLED`.

Default behavior:

- production: off until explicitly enabled after migrations, review scripts, and QA are verified;
- preview/dev: on by default for testing unless explicitly disabled.

- [ ] **Step 2: Guard onboarding and chat routes**

When disabled:

- onboarding does not show the new product-intake UI;
- chat does not render the product-intake card;
- product-intake APIs return a controlled disabled response;
- existing routine/onboarding behavior remains usable.

- [ ] **Step 3: Verify disabled mode**

Add tests proving disabled mode does not create submissions or upload paths.

### Task 3.1: Product Intake Schemas

**Files:**

- Create: `src/lib/product-intake/types.ts`
- Create: `src/lib/product-intake/schemas.ts`
- Test: `tests/product-intake-schema.test.ts`

- [ ] **Step 1: Define product frequency schema**

Use the new canonical frequency values only, with legacy normalizer at boundaries.

- [ ] **Step 2: Define supported intake categories**

The intake schema accepts only:

```ts
const SUPPORTED_PRODUCT_INTAKE_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "dry_shampoo",
  "deep_cleansing_shampoo",
  "bondbuilder",
] as const
```

Do not expose this flow for `serum`, `scrub`, `peeling`, `heat_protectant`, styling products, or other unsupported categories yet.

- [ ] **Step 3: Define onboarding intake schema**

Photo method requires:

- `front_image_path`;
- `category`;
- `frequency_range`.

Manual method requires:

- `brand_text`;
- `product_name_text`;
- `category`;
- `frequency_range`.

Barcode image is optional in both.

- Both methods include `replace_existing_confirmed?: boolean` so the API can require explicit confirmation before replacing an existing category slot.

- [ ] **Step 4: Define chat intake schema**

Same as onboarding, plus optional `source_conversation_id`. API derives user from auth.

### Task 3.2: Brand Options API

**Files:**

- Create: `src/app/api/product-intake/brand-options/route.ts`
- Test: `tests/product-identity-resolution.test.ts`

- [ ] **Step 1: Load canonical options**

Return canonical brands plus aliases. Alias options can include hidden resolution metadata internally, but user-facing labels stay simple.

- [ ] **Step 2: Include brand+line aliases**

Examples:

- `Pantene Pro-V`;
- `Pantene Pro-V Miracles`;
- `Garnier Fructis`;
- `Garnier Wahre Schätze`;
- `L'Oréal Paris Elvital`.

- [ ] **Step 3: Allow free text**

The API must not reject new brands. Unknowns go to review.

### Task 3.2A: Shared Product Lookup Candidate Service

**Files:**

- Create: `src/lib/product-intake/product-lookup.ts`
- Modify: `src/lib/product-intake/product-matching.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/chat-runtime/stream-events.ts`
- Modify: `src/hooks/use-chat.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/components/chat/chat-message.tsx`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Test: `tests/product-intake-lookup.test.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`

Build one shared lookup service used by chat and future intake surfaces. Do not add a second chat-only heuristic resolver.

The model owns language understanding and proposes a structured identity. The service owns validation, brand/line resolution, database search, match confidence, and returned status.

Before staging the lookup integration, verify the lookup contract is the only path that can produce a chat product-intake offer:

- no `buildProductIntakeOfferFromMessage` or equivalent regex/keyword raw-message detector remains;
- no `PRODUCT_INTAKE_DEFERRED_RESPONSE` or deterministic full-message replacement template remains;
- no `productsToSend.length === 0` intake gate remains;
- the only chat trigger for `product_intake_offer` is the typed lookup result: `LookupProductCandidateResult.status === "not_found"` for a supported category;
- tests prove raw user text alone does not render an intake card.

This is a verification requirement on the current Phase 3 worktree. If the old heuristic scaffold is already absent, do not recreate or search for it as an implementation target.

Input contract:

```ts
type LookupProductCandidateInput = {
  user_query?: string
  brand_text?: string
  product_name_text?: string
  category?: ProductIntakeCategoryKey
  category_evidence?: string
  barcode?: string
}
```

Rules:

- `category` is required for a conclusive lookup, but it can be derived from explicit wording, product name, or active conversational context before the tool call.
- The service accepts only the 8 supported intake categories for conclusive lookup.
- If the category is missing, unclear, or unsupported, the result is non-conclusive.
- The service searches all approved active products, including `is_chaarlie_recommended = false`.
- The service must not expose browse/enumeration access to other users' non-recommended products through public catalog paths. Use server-side/admin lookup paths for exact product-detail/intake decisions.
- Do not let the model generate arbitrary SQL. The assistant/tool interface is typed; SQL/RPC/trigram/full-text logic stays inside application code.
- Measure the lookup path in tests or local logs before staging. Target one catalog/brand load per assistant turn through simple request-local memoization, and keep p95 lookup overhead low enough that ordinary chat response latency is not noticeably worsened. Do not add global caching/invalidation in Phase 3.

Return contract:

```ts
type LookupProductCandidateResult =
  | {
      status: "found_exact"
      product_id: string
      product: Product
      eligible_for_general_recommendation: boolean
    }
  | {
      status: "ambiguous"
      candidates: Array<{
        product_id: string
        brand: string
        name: string
        category: ProductIntakeCategoryKey
        is_chaarlie_recommended: boolean
      }>
      clarification_prompt_hint?: string
    }
  | {
      status: "not_found"
      extracted_identity: {
        brand_text?: string
        product_name_text?: string
        category: ProductIntakeCategoryKey
      }
      supported_for_intake: true
    }
  | {
      status: "insufficient_identity"
      missing: Array<"brand" | "product_name" | "category">
    }
  | {
      status: "unsupported_category"
      category_text?: string
      supported_for_intake: false
    }
```

Conclusive `found_exact` requires a strong match:

- exact identifier/category match; or
- resolved brand plus optional line plus clean product name plus exact category match; or
- resolved brand plus clean product name plus exact category match when no line exists.

Fuzzy/trigram/full-text matches are candidates only. They return `ambiguous`, not `found_exact`, unless a later implementation adds reviewed deterministic thresholds and eval coverage.

Chat behavior from lookup result:

- `found_exact`: use the normal product-detail answer path with the returned product properties. No product intake card.
- `ambiguous`: assistant asks a natural clarification question and may list likely candidates. No product intake card.
- `insufficient_identity`: assistant asks for the missing precise product detail/category. No product intake card.
- `unsupported_category`: assistant says that products from this category cannot be added yet. No product intake card.
- `not_found`: assistant naturally defers exact product assessment and the assistant-turn metadata includes `product_intake_offer`.

The card contract must be metadata-driven:

```ts
rag_context.product_intake_offer = {
  id: string
  source: "chat"
  reason: "product_lookup_not_found"
  category: ProductIntakeCategoryKey
  extracted_identity: {
    brand_text?: string
    product_name_text?: string
  }
}
```

Update the existing `ProductIntakeOffer` interface and every SSE/history consumer to this contract. The old `reason: "unknown_product_opinion_request"` and nullable `category` contract must not remain as a parallel option.

Do not render the card by parsing visible German assistant text.

### Task 3.3: Onboarding Intake API

**Files:**

- Create: `src/app/api/product-intake/onboarding/route.ts`
- Create: `src/lib/product-intake/submissions.ts`
- Test: `tests/product-intake-submissions.test.ts`

- [ ] **Step 1: Auth and payload validation**

Derive `user_id` from the session. Reject missing category/frequency. Reject unsupported intake categories. Reject invalid image paths that do not belong to the user.

- [ ] **Step 2: Require replacement confirmation**

If `user_product_usage` already has a row for `(user_id, category)` and `replace_existing_confirmed` is not true, return a conflict response with German UI copy:

```txt
Du hast für diese Kategorie bereits ein Produkt hinterlegt. Möchtest du es durch dieses Produkt ersetzen?
```

If replacement is confirmed and the existing slot points to a still-open `product_submission_id`, mark the old submission `cancelled_by_user` before linking the new matched product or new submission.

Post-review correction: the old pending submission must not be closed while any `user_product_usage` row still points at it. Implement this through the Phase 3 DB-side transactional helper/RPC or an equivalently trigger-safe transaction. Do not restore a usage link to a still-cancelled submission during rollback.

If replacement is confirmed and the new product is unknown, the visible routine slot changes immediately to the new pending product. Do not keep the old verified product active while the new submission is under review. Store the old state on the submission for audit and possible support/debug recovery.

- [ ] **Step 3: Match existing products**

If high-confidence match exists:

- upsert `user_product_usage` for `(user_id, category)`;
- set `product_id`;
- set `match_status = 'matched'`;
- set `brand_text`/`product_name`;
- do not create duplicate product.

- [ ] **Step 4: Create submission when unknown**

If not matched:

- create `product_submissions`;
- upsert `user_product_usage` with `product_submission_id`;
- when replacing a verified product with a pending unknown, copy the old verified product/slot state into `product_submissions.previous_product_id` and `previous_product_snapshot`, then clear the old `product_id` so the user's visible slot represents the newly submitted pending product;
- set `match_status = 'pending_review'`;
- preserve raw brand/name/category/frequency/image paths.

For onboarding same-slot edits of an already pending submission, update the existing `pending_review` submission row in place. If a new committed photo replaces an old committed photo, update the DB reference first and then remove the old object unless it is still referenced. If the DB update fails, remove the newly committed object and leave the old reference intact.

### Task 3.4: Chat Intake API

**Files:**

- Create: `src/app/api/product-intake/chat/route.ts`
- Test: `tests/product-intake-submissions.test.ts`

- [ ] **Step 1: Validate origin conversation ownership**

If `source_conversation_id` is present, verify it belongs to authenticated user.

- [ ] **Step 2: Reuse submission service**

Use the same matching/submission flow as onboarding.

- [ ] **Step 3: Handle moved-on conversations**

Store origin conversation for notification, but do not require it to still be the active chat.

### Task 3.5: Upload API And Image Validation

**Files:**

- Create: `src/app/api/product-intake/upload/route.ts`
- Create: `src/lib/product-intake/image-validation.ts`
- Create: `src/lib/product-intake/client-image-compression.ts`
- Test: `tests/product-intake-submissions.test.ts`

- [ ] **Step 0: Add 80/20 mobile image preprocessing**

Before the upload request, compress selected image files in the browser for both onboarding and chat product-intake photo paths.

MVP target:

- max longest edge around `1800px`;
- JPEG/WebP quality around `0.82`;
- preserve the original file when it is already small enough and within accepted image types;
- after compression, reject files still above the practical serverless upload budget with a friendly German error before sending the request;
- do not expose compression details in the UI copy.

This is the Phase 3 mobile-optimized Pareto approach. Direct signed Supabase Storage uploads and TUS/resumable uploads are deferred.

- [ ] **Step 1: Implement authenticated temporary upload route**

Accept the already-compressed image file from the authenticated browser request, validate it server-side, write it to the private temporary bucket path format, and return the temporary path plus validation metadata. The client must not upload into a guessed final `submission_id` path.

For onboarding/chat photo flow, upload can happen before category/frequency is selected. Category and frequency are required only before Save/Continue. The later intake submit/follow-up call validates required fields, creates the submission, and attaches uploaded paths plus any manual brand/name text to that committed submission.

Submit idempotency is bounded in Phase 3 by `UNIQUE (user_id, category)`, the at-most-one-open-submission invariant, and replacement confirmation. Do not add a full idempotency-key table in Phase 3 unless duplicate submit retries become visible in testing; record it as a future hardening option if needed.

- [ ] **Step 2: Validate obvious wrong files**

Reject non-image files, oversized files, invalid paths, and content whose server-validated file signature does not match an allowed image type. Do not trust browser `Content-Type` alone. Generate server-side storage paths and keep uploads in the private bucket. Server validation remains authoritative even after client-side compression.

- [ ] **Step 3: Add image-kind validation boundary**

Create a function that returns:

- `valid_product_front`;
- `valid_barcode`;
- `not_a_product_photo`;
- `unsafe_or_inappropriate`;
- `uncertain`.

For MVP, uncertain images can enter review, but clearly invalid, unsafe, or obviously unrelated images should not. Barcode photos that are scratched, blurry, or low confidence should not block submission by themselves; they should reduce matching confidence and surface as review notes.

Use a layered implementation:

- hard upload checks first: auth, ownership, size, allowed extension, server-side signature/magic-byte validation, generated filename/path;
- semantic classification second: front product photo, barcode photo, uncertain, unrelated, or unsafe;
- human review fallback for uncertain product images.

- [ ] **Step 4: Clean abandoned temporary uploads**

Temporary upload sessions that are not committed through Save/Continue expire after 6 hours. Add cleanup support to remove `product-intake/tmp/{user_id}/{upload_session_id}/...` objects without creating submissions or user usage rows.

- [ ] **Step 5: Record direct-upload hardening as a follow-up**

If photo upload failures remain common after client-side compression, replace the server-route upload with a direct-to-Supabase signed upload flow and consider TUS/resumable uploads. Do not build that heavier lifecycle in Phase 3 unless the user explicitly expands scope.

### Task 3.6: Onboarding UI

**Files:**

- Modify: `src/lib/onboarding/store.ts`
- Modify: `src/components/onboarding/screens/product-drilldown-screen.tsx`
- Modify: `src/components/onboarding/onboarding-flow.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Test: `tests/onboarding-product-intake.test.tsx`

- [ ] **Step 1: Keep onboarding entry category-specific**

Do not create a generic "add any product" onboarding screen. The user enters a product from a supported category step, and that canonical category is preselected.

- [ ] **Step 2: Add equal path switcher**

UI text in German:

- `Foto hochladen`;
- `Daten eingeben`.

- [ ] **Step 3: Add photo path fields**

Fields:

- front photo required;
- category prefilled by current category step;
- frequency required;
- barcode optional/strongly suggested.

- [ ] **Step 4: Add manual path fields**

Fields:

- brand autocomplete with free-text fallback;
- product name;
- category prefilled by current category step;
- frequency.

- [ ] **Step 5: Add replacement confirmation**

If the category already has a tracked product, ask for confirmation before replacing it.

- [ ] **Step 6: Remove review sidebar from onboarding**

Do not show a persistent `Deine Produkte` right-side list during the intake step. Final confirmation can happen at end of onboarding or later in chat.

### Task 3.7: Chat Product Intake Card

**Files:**

- Create: `src/components/chat/product-intake-card.tsx`
- Modify: `src/components/chat/chat-message.tsx`
- Modify: `src/components/chat/chat-container.tsx`
- Modify: `src/hooks/use-chat.ts`
- Test: `tests/chat-product-intake-card.test.tsx`

- [ ] **Step 1: Render only from structured offer metadata**

Render the card only when the assistant message contains `rag_context.product_intake_offer`.

Do not infer card visibility from German assistant text.

The assistant response itself stays model-generated and natural, but it must follow the lookup result policy:

- no exact assessment when lookup returned `not_found`;
- no intake card for ambiguous, insufficient, or unsupported categories;
- a friendly invitation to add the product only when `product_intake_offer` is present.

- [ ] **Step 2: Render the same two paths**

Card offers `Foto hochladen` and `Daten eingeben`, matching onboarding requirements.

In chat, category is not prefilled by onboarding context, so the card must require one of the 8 supported canonical categories.

- [ ] **Step 3: Submit to chat intake API**

Preserve `source_conversation_id`.

If the card is rendered on the first message in a newly created conversation, ensure the saved or streamed assistant message has the real `conversation_id` before submitting. Never submit an empty string as `source_conversation_id`.

---

## Phase 4A: Review And Approval Core

Phase 4A is the first production review workflow slice. It should be shippable on its own after Phase 3 and before Phase 4B. It includes the core daily review path: queue/review/research, approval/link-existing/request-info/reject, user notification, and basic storage cleanup.

### Task 4.1: Review Queue CLI

**Files:**

- Create: `scripts/product-intake/queue.ts`
- Create: `scripts/product-intake/review.ts`
- Modify: `package.json`

- [ ] **Step 0: Add Phase 4A package scripts**

Add every command introduced in Phase 4A before later tasks invoke them:

```json
{
  "products:intake:queue": "tsx scripts/product-intake/queue.ts",
  "products:intake:review": "tsx scripts/product-intake/review.ts",
  "products:intake:research": "tsx scripts/product-intake/research.ts",
  "products:intake:approve": "tsx scripts/product-intake/approve.ts",
  "products:intake:approve-ready": "tsx scripts/product-intake/approve-ready.ts",
  "products:intake:link-existing": "tsx scripts/product-intake/link-existing.ts",
  "products:intake:request-info": "tsx scripts/product-intake/request-info.ts",
  "products:intake:notify-pending": "tsx scripts/product-intake/notify-pending.ts",
  "products:intake:cleanup-storage": "tsx scripts/product-intake/cleanup-storage.ts"
}
```

- [ ] **Step 1: Add queue command**

`products:intake:queue` lists pending, researching, ready, needs-more-info submissions with:

- id;
- created_at;
- user id hash or internal id;
- source;
- category;
- brand/name text;
- image paths;
- current status.

By default, the queue shows only actionable states: `pending_review`, `researching`, `ready_for_review`, and `needs_more_info`. Closed states such as `approved`, `matched_existing`, `rejected`, and `cancelled_by_user` are hidden unless the reviewer passes `--include-closed` or an explicit status filter.

- [ ] **Step 2: Add review command**

`products:intake:review <submission-id>` prints:

- raw input;
- image paths/signed URLs for reviewer;
- existing match candidates across all active products;
- researched payload summary;
- source conversation id if present.

- [ ] **Step 3: Support efficient batch review output**

Add a review/export mode that lets the reviewer inspect multiple submissions during a daily review session without approving them:

```bash
npm run products:intake:review -- --status pending_review --limit 20
```

This mode may print a compact table or export a review file, but it must not write product rows, link user usage rows, or send notifications.

### Task 4.2: Research Payload Workflow

**Files:**

- Create: `src/lib/product-intake/review-workflow.ts`
- Create: `scripts/product-intake/research.ts`
- Modify: `scripts/product-intake/review.ts`
- Test: `tests/product-intake-review-workflow.test.ts`

- [ ] **Step 1: Define researched payload shape**

Use JSON like:

```json
{
  "draft": {
    "product": {
      "canonical_brand": "Garnier",
      "product_line": "Fructis Hair Food",
      "clean_name": "Aloe Vera Feuchtigkeitsspülung",
      "category_key": "conditioner",
      "affiliate_link": "https://...",
      "image_url": "https://...",
      "price_eur": 3.95,
      "currency": "EUR",
      "purchase_link_status": "ok",
      "purchase_link_checked_at": "2026-06-11T00:00:00.000Z",
      "price_checked_at": "2026-06-11T00:00:00.000Z"
    },
    "identifiers": [{ "identifier_type": "gtin", "identifier_value": "..." }],
    "category_specs": {
      "conditioner": {}
    },
    "sources": [
      {
        "type": "retailer",
        "url": "https://...",
        "notes": "Used for price, image, and product title."
      }
    ],
    "field_rationales": {}
  },
  "final": {
    "product": {},
    "identifiers": [],
    "category_specs": {},
    "sources": [],
    "field_rationales": {}
  },
  "review": {
    "reviewed_by": null,
    "reviewed_at": null,
    "notes": []
  }
}
```

- [ ] **Step 2: Store drafts in JSON only**

Do not write draft products/specs into final product tables.

The JSON draft is flexible during research, but approval validators must treat the final approval payload as strict and complete.

Keep both automation draft and reviewer-confirmed final payload in MVP so the team can learn where assisted research is accurate or weak. This is an early learning/audit choice; it can be simplified later if the draft history stops being useful.

Do not auto-delete `researched_payload.draft` in MVP. Treat it as review/audit learning data subject to a future retention policy once the process stabilizes.

- [ ] **Step 3: Mark submissions ready only after validation dry-run**

Only review/research tooling may set `product_submissions.status = 'ready_for_review'`.

Before setting `ready_for_review`, the tool must run the same category-specific approval validator used by approval commands in dry-run mode. If validation fails, keep the submission in `researching`, `pending_review`, or `needs_more_info` and print the missing fields.

`approve-ready` must treat `ready_for_review` as a precondition, not as proof by itself; it still reruns validators before writing.

- [ ] **Step 4: Add assisted research script**

Create:

```bash
npm run products:intake:research -- --submission-id <submission-id>
```

The script should automatically run live web research where available and help draft `researched_payload` by using available inputs:

- raw brand/name/category;
- front photo/OCR text if available;
- barcode/GTIN if available;
- existing product/identifier matches;
- web research from brand pages, retailer pages, barcode sources, and reliable product listings.

The script may suggest sources, commercial/display metadata, identifiers, and category spec candidates, but it must not mark the submission `ready_for_review` or write to `products` without human review.

The reviewer should be able to inspect/edit/confirm the drafted payload, including exactly which sources were used and which fields came from each source, then run the validation dry-run that moves the submission to `ready_for_review`.

Source priority:

1. Official brand/manufacturer product page.
2. Major retailer product pages with stable product data, for example dm, Rossmann, Douglas, Hagel, Flaconi, and similar reputable shops.
3. Barcode/GTIN lookup sources when available.
4. Secondary product listings only when primary sources are missing.
5. User photo/OCR as identity evidence, not as the only source for category specs or commercial metadata.

Amazon marketplace pages should be treated cautiously and should not override official brand or reputable retailer data unless no better source exists.

Category-specific properties may be researched conclusions, not only scraped fields. For example, shampoo copy such as "mild daily cleansing" is valid evidence toward a lower cleansing-intensity conclusion. The research payload must distinguish direct facts from reasoned conclusions and include the source evidence/reasoning used for each category spec value. Human review signs off on the final spec values before `ready_for_review`.

Require field-level rationale for important derived category spec fields, for example shampoo cleansing intensity/scalp route, conditioner fit/weight, mask balance/intensity, oil purpose/weight, dry-shampoo effect/fit, deep-cleansing reset role, and bondbuilder lane/protocol. Simple commercial/display metadata such as price, currency, image URL, and purchase link only needs source attribution.

### Task 4.3: Category-Specific Approval Validators

**Files:**

- Create: `src/lib/product-intake/category-validators.ts`
- Test: `tests/product-intake-review-workflow.test.ts`

- [ ] **Step 0: Discover and lock current category spec write contracts**

Before implementing approval writes, inspect the current target branch and production schema for every category-specific product table used by recommendation/selection logic. Capture the required operations in tests or fixtures before writing validator code.

Known likely surfaces to verify:

- shampoo: `product_shampoo_specs` plus any bucket/eligibility/pair data used by selection logic;
- conditioner: `product_conditioner_specs` plus `product_conditioner_rerank_specs`;
- leave_in: `product_leave_in_specs`, `product_leave_in_fit_specs`, and `product_leave_in_eligibility`;
- mask: `product_mask_specs`;
- oil: verify the real oil table surface before implementation; current code may use `product_oil_eligibility` rather than a `product_oil_specs` table;
- dry_shampoo: `product_dry_shampoo_specs`;
- deep_cleansing_shampoo: `product_deep_cleansing_shampoo_specs`;
- bondbuilder: `product_bondbuilder_specs`.

This discovery is a gated task. Do not proceed to approval transaction implementation while any category's required write operations are still described as "inspect later."

- [ ] **Step 1: Implement validator interface**

Each validator returns:

- `ok`;
- missing fields;
- normalized final payload;
- target spec operations, not just one table. Some categories require multiple spec tables or multiple rows per product.

- [ ] **Step 2: Start with supported categories**

Support only the 8 current catalog categories where product logic already exists and specs are required:

- shampoo;
- conditioner;
- mask;
- leave_in;
- oil;
- dry_shampoo;
- deep_cleansing_shampoo;
- bondbuilder.

- [ ] **Step 3: Define required spec operations per category**

Using the Step 0 discovery results, document each supported category's required spec writes in code tests:

- shampoo: required shampoo spec fields plus any eligibility/pair rows used by current selection logic;
- conditioner: `product_conditioner_specs` plus rerank/selection specs used by current logic;
- leave_in: leave-in base specs plus fit and eligibility rows used by current logic;
- mask: mask spec rows used by current logic;
- oil: the verified current oil eligibility/spec operations used by current logic;
- dry_shampoo: dry-shampoo spec rows used by current logic;
- deep_cleansing_shampoo: deep-cleansing shampoo spec rows used by current logic;
- bondbuilder: bondbuilder spec rows used by current logic.

Validators must fail unless every category-specific table/row required for existing recommendation and selection paths can be written in the approval transaction. There is no MVP state where a product is approved with only identity/commercial metadata but missing category-specific recommendation specs.

- [ ] **Step 4: Fail incomplete approval**

Approval fails if:

- canonical brand is missing;
- clean name is missing;
- canonical category key is missing or unsupported;
- source evidence is missing;
- affiliate/purchase link is missing;
- image URL is missing;
- price, currency, purchase link status, purchase link checked timestamp, or price checked timestamp is missing;
- required category spec operation fields are missing;
- manual review flag is not passed;
- match candidate is ambiguous.

MVP intentionally uses one full approval state. Do not split approval into separate `owned_assessment_ready` and `commerce_ready` states. The review process should do one conclusive research pass per product and fill identity, commercial/display metadata, source evidence, and all category-specific specs before the product becomes usable.

### Task 4.4: Approve New Product

**Files:**

- Create: `scripts/product-intake/approve.ts`
- Create: `scripts/product-intake/approve-ready.ts`
- Create: `src/lib/product-intake/review-workflow.ts`
- Test: `tests/product-intake-review-scripts.test.ts`

- [ ] **Step 1: Transactional approval**

Approval transaction must:

- validate researched payload;
- upsert/find brand and product line;
- rerun exact dedupe inside the transaction using canonical category, brand, product line, clean name, and identifiers across all active products, including `is_chaarlie_recommended = false`;
- abort insert and require explicit reviewer action through `link-existing` if an exact existing product appears during the transaction;
- insert `products` with `origin = 'user_submitted'` and `is_chaarlie_recommended = false`;
- set `products.category_key` to the reviewed canonical category;
- write all required commercial/display fields, including link, image, price, currency, link status, and checked timestamps;
- insert all required category spec rows/operations;
- insert identifiers;
- set `product_submissions.status = 'approved'`;
- set `product_submissions.approved_product_id`;
- update linked `user_product_usage.product_id`;
- set `user_product_usage.match_status = 'matched'`;
- keep `user_product_usage.product_submission_id`.

After the transaction succeeds, append the approved product record to the dated source file under `data/product-additions/`, including the created `product_id`, category key, brand/line ids, spec table/row reference, identifiers, source evidence, and approval timestamp.

If writing the addition record fails after DB approval, the script must print a clear follow-up command to regenerate the record for that submission. Do not silently ignore the failure.

The product becomes user-ready at DB transaction commit, because the canonical product row, category spec rows/operations, identifiers, approved submission, and linked `user_product_usage.product_id` are then all in place. The addition record is audit/process documentation and must be attempted before notification on the happy path, but it is not what powers the app.

- [ ] **Step 2: Require manual tick-off**

CLI requires:

```bash
--manual-review-complete --reviewed-by <reviewer-name>
```

Without this, approval fails.

- [ ] **Step 3: Add efficient selected approval command**

Create an approval command for multiple already-reviewed submissions:

```bash
npm run products:intake:approve-ready -- --ids <submission-id-1>,<submission-id-2> --reviewed-by <reviewer-name> --dry-run
npm run products:intake:approve-ready -- --ids <submission-id-1>,<submission-id-2> --reviewed-by <reviewer-name> --apply --confirm
```

Rules:

- only submissions in `ready_for_review` can be approved by this command;
- every selected submission must pass the same category validator as single approval;
- `--dry-run` prints the exact products, specs, identifiers, user links, addition-record writes, and notifications that would be created;
- `--apply --confirm` is required for writes;
- each selected submission is approved in its own transaction so one failure does not corrupt the whole batch;
- the command reports successes and failures clearly;
- successful approvals from the same source/date append to the same `data/product-additions/` file;
- users are notified only for submissions whose DB approval succeeded.

- [ ] **Step 4: Report unexpected approval failures clearly**

Report unexpected approval failures such as transaction errors, ownership violations, product/spec insert failures, addition-record write failures after commit, and unhandled script exceptions with structured CLI output and non-zero exit codes.

Do not treat expected validator failures such as missing source evidence, missing price, missing image, or incomplete category specs as alert-worthy errors; those are normal review feedback and should be printed in the CLI output.

Phase 4B adds Sentry alerting for unexpected approval/notification failures. Phase 4A only needs clear CLI reporting and safe transactional behavior.

When failure details are printed or later sent to Sentry, include:

- submission id;
- source;
- category;
- reviewer name if available;
- failure stage;
- error reason;
- whether the DB transaction committed.

### Task 4.5: Link Existing Product

**Files:**

- Create: `scripts/product-intake/link-existing.ts`
- Test: `tests/product-intake-review-scripts.test.ts`

- [ ] **Step 0: Surface link-existing as review action**

The manual review flow must show exact and high-confidence existing candidates before approval. The reviewer can choose `link-existing` as the final review action instead of approving a new product. The `approve` command remains create-new-product only and must not silently convert itself into a link operation.

- [ ] **Step 1: Link to existing product**

For confident existing matches:

- set `product_submissions.status = 'matched_existing'`;
- set `approved_product_id` to existing product id;
- update `user_product_usage.product_id`;
- set `match_status = 'matched'`;
- do not create a duplicate product.

Auto-linking requires the existing product row's `category_key` to match the user-selected submission category exactly. Cross-category matches are printed as candidates for review only.

- [ ] **Step 2: Allow false Chaarlie-recommended products**

Existing product can be `is_chaarlie_recommended = false`; linking is still allowed for user-owned context.

### Task 4.6: Request More Info And Reject

**Files:**

- Create: `scripts/product-intake/request-info.ts`
- Modify: `src/lib/product-intake/notifications.ts`
- Test: `tests/product-intake-review-scripts.test.ts`

- [ ] **Step 1: Request more info**

Set submission to `needs_more_info`, update linked usage row, and notify user with what is missing.

Keep the linked `user_product_usage` slot in place with `match_status = 'needs_more_info'`. Do not clear or revert to the previous product automatically. The category still counts as present, but product-specific assessment remains blocked until the submission is matched or approved.

`needs_more_info` must include precise user-facing guidance in `user_facing_resolution_reason` and/or `user_facing_next_step`, for example:

- `Die Vorderseite ist zu unscharf, um Marke und Produktname sicher zu erkennen.`
- `Bitte lade ein schärferes Foto der Vorderseite hoch.`
- `Uns fehlt der genaue Produktname. Bitte ergänze ihn so, wie er auf der Verpackung steht.`
- `Wir sehen mehrere mögliche Treffer. Bitte ergänze, ob es die Aloe-Vera- oder Papaya-Variante ist.`

The notification should include a product-intake follow-up card prefilled with all known fields from the previous submission. The card should ask only for the missing or low-confidence fields, for example a sharper front photo, exact product name, variant, barcode photo, or category confirmation.

Represent missing information in `user_facing_missing_fields` as structured field-level requirements rather than one generic text blob, so a submission can ask for a single property without forcing the user to restart the whole intake.

User follow-up attempts for missing information update the same `product_submissions` row rather than creating a new submission. Append each user follow-up to `intake_history` with timestamp, changed fields, uploaded paths, and source conversation when available.

When a user provides requested follow-up information, move the submission from `needs_more_info` back to `pending_review` so it appears in the actionable queue again. Preserve prior review notes and history.

- [ ] **Step 2: Reject spam/irrelevant submissions**

Set submission status `rejected`, clear the linked pending usage slot, and schedule storage cleanup.

When a submission is rejected, clear the pending product from the user's category slot. If the linked `user_product_usage` row was created only for that rejected submission and has no verified `product_id`, delete it or null the pending submission link according to the safest implementation path. Keep the `product_submissions` row as review history, notify the user via chat/onboarding notification, and block product-specific assessment.

Do not automatically restore `previous_product_id` on rejection. The user explicitly replaced the product, so reverting to the old product would be surprising. Keep the previous snapshot only for audit, support/debugging, and a possible future explicit undo feature.

Rejected submissions must include a precise user-safe reason and, when useful, a next step so the user understands what happened and can retry differently. Examples:

- `Wir konnten das Produkt anhand der Angaben nicht eindeutig identifizieren.`
- `Das hochgeladene Bild zeigt kein erkennbares Haarprodukt.`
- `Die Kategorie passt nicht zu einem Produktbereich, den wir aktuell prüfen können.`
- `Bitte starte eine neue Produktprüfung mit einem Foto der Vorderseite und dem genauen Produktnamen.`

Do not expose internal reviewer notes directly to the user.

- [ ] **Step 3: Support user cancellation**

If a user removes/replaces a pending product before review completes, clear the linked `user_product_usage` pending reference and set the submission to `cancelled_by_user`. Cancelled submissions remain in history but are hidden from the default actionable queue.

Cancelled submissions should follow the same image retention cleanup path as rejected submissions.

- [ ] **Step 4: Add storage cleanup ownership**

Create `scripts/product-intake/cleanup-storage.ts` and package script `products:intake:cleanup-storage`.

Rejected, spam/irrelevant, and `cancelled_by_user` submissions should get a cleanup deadline such as `cleanup_after` or equivalent metadata. The cleanup script deletes retained images after the retention window and records `photos_deleted_at` or equivalent audit metadata so repeated runs are idempotent.

### Task 4.7: Notify User After Review

**Files:**

- Create: `src/lib/product-intake/notifications.ts`
- Create: `scripts/product-intake/notify-pending.ts`
- Modify conversation/message persistence code as needed
- Test: `tests/product-intake-review-workflow.test.ts`

- [ ] **Step 1: Chat-origin notification**

Write a message into the origin conversation after DB approval succeeds and the dated addition record write has succeeded or clearly reported a follow-up action. If the conversation moved on, still append a clear review result message.

- [ ] **Step 2: Onboarding-origin notification**

Create or reuse a dedicated `Produktprüfung` conversation and write the review result there after DB approval succeeds and the dated addition record write has succeeded or clearly reported a follow-up action.

- [ ] **Step 3: Make notification idempotent**

Use `notification_sent_at` so retrying scripts cannot send duplicate messages.

If notification fails after approval, keep the submission approved and the product usable. Treat notification as retryable by querying approved submissions where `notification_sent_at is null`; do not roll back the product approval.

- [ ] **Step 4: Add retry script**

Create:

```bash
npm run products:intake:notify-pending
```

The script finds approved or matched submissions where `notification_sent_at is null`, sends the correct chat-origin or onboarding-origin notification, and updates `notification_sent_at` idempotently.

- [ ] **Step 5: Leave notification failures retryable**

Phase 4A must make notification failures visible in CLI output and retryable through `products:intake:notify-pending`. Sentry alerting is Phase 4B hardening, not required for the first review-core PR.

## Phase 4B: Review Ops Hardening

Phase 4B stacks after Phase 4A. It is still part of the full product-intake program, but should ship as separate PRs so the core review workflow does not become one monster branch.

### Task 4B.1: Review Workflow Monitoring

**Files:**

- Modify: `src/lib/product-intake/notifications.ts`
- Modify: `src/lib/product-intake/review-workflow.ts`
- Modify Sentry instrumentation/configuration where product-intake errors are captured
- Test: `tests/product-intake-review-scripts.test.ts`

- [ ] **Step 1: Add Sentry capture and alerting for unexpected failures**

Capture unexpected approval failures such as transaction errors, ownership violations, product/spec insert failures, addition-record write failures after commit, and unhandled script exceptions.

Do not send Sentry alerts for expected validator failures such as missing source evidence, missing price, missing image, or incomplete category specs; those are normal review feedback and should be printed in the CLI output.

Approval failure events should include:

- submission id;
- source;
- category;
- reviewer name if available;
- failure stage;
- error reason;
- whether the DB transaction committed.

- [ ] **Step 2: Add Sentry capture and alerting for notification failures**

On notification failure, capture a Sentry event with:

- submission id;
- approved product id if present;
- user id hash or internal id, avoiding personal contact details;
- source (`chat` or `onboarding`);
- source conversation id if present;
- failure reason;
- retry eligibility.

Set up or document a Sentry alert/monitor for product-intake notification failures so the team is notified when a user-ready product was approved but the user notification did not send.

### Task 4B.2: Promotion Command

**Files:**

- Create: `scripts/product-intake/promote.ts`
- Modify: `package.json`
- Test: `tests/product-intake-review-scripts.test.ts`

- [ ] **Step 1: Add package script**

Add:

```json
{
  "products:intake:promote": "tsx scripts/product-intake/promote.ts"
}
```

- [ ] **Step 2: Promote products**

Command:

```bash
npm run products:intake:promote -- --product-id <id> --confirm
```

Sets `products.is_chaarlie_recommended = true`.

Do not change `products.origin`. A user-submitted product can become Chaarlie-recommended while keeping `origin = 'user_submitted'`.

- [ ] **Step 3: Guard promotion**

Promotion requires:

- product active;
- lifecycle active;
- required specs still present;
- manual confirmation.

### Task 4B.3: Review Ops Ergonomics And Research History

**Files:**

- Modify: `scripts/product-intake/queue.ts`
- Modify: `scripts/product-intake/review.ts`
- Modify: `scripts/product-intake/research.ts`
- Modify: `src/lib/product-intake/review-workflow.ts`
- Test: `tests/product-intake-review-scripts.test.ts`

- [ ] **Step 1: Improve batch review ergonomics**

Add filters, compact output, and optional export formats based on real Phase 4A review usage. Keep commands script-first; do not build a polished admin screen.

- [ ] **Step 2: Revisit draft/final research retention**

After several real submissions, decide whether keeping both `researched_payload.draft` and `researched_payload.final` is useful. If not, simplify retention while preserving enough auditability to explain approvals, request-info decisions, and rejection reasons.

- [ ] **Step 3: Add lightweight reporting**

Add script output or a simple report for counts by status, age, category, source, notification status, and approval outcome. This is operational reporting, not user-facing product behavior.

---

## Phase 5: Assistant And Recommendation Integration

### Task 5.1: Product Eligibility Boundary

**Files:**

- Modify product selectors listed in Target File Map
- Test: `tests/agent-select-products-tool.spec.ts`
- Test: `tests/product-catalog-lifecycle.test.ts`

- [ ] **Step 1: Define eligibility modes**

Implement explicit modes:

- `general_recommendation`: requires `is_active = true`, `lifecycle_status = active`, `is_chaarlie_recommended = true`;
- `owned_assessment`: requires user-owned `user_product_usage.product_id` and verified product/specs; does not require `is_chaarlie_recommended = true`;
- `intake_dedupe`: server-only search across all active products regardless of `is_chaarlie_recommended`;
- `internal_admin`: shows all products and can filter by `origin`, `is_chaarlie_recommended`, lifecycle, and active status.

- [ ] **Step 2: Update selectors**

Audit every product query/RPC/tool so the mode is explicit rather than implicit.

The query/RLS boundary must enforce:

- users can read recommended active products through general catalog/product card paths;
- users can read their own verified non-recommended products only through `owned_assessment` joins from `user_product_usage`;
- users cannot browse or enumerate other users' non-recommended submitted products;
- intake dedupe and internal review use service-role/admin-only paths.

### Task 5.2: Product Lookup Tool In AgentV2

**Files:**

- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Modify: `src/lib/agent-v2/named-product-context.ts` if present on current `origin/main`
- Modify: `src/lib/agent-v2/contracts.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: `src/lib/product-intake/product-lookup.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: chat eval fixtures through `npm run test:chat`

- [ ] **Step 1: Expose typed lookup tool**

Expose a typed AgentV2 tool backed by `src/lib/product-intake/product-lookup.ts`.

The model provides structured identity and category/use evidence. The tool returns `found_exact`, `ambiguous`, `not_found`, `insufficient_identity`, or `unsupported_category`.

Do not expose raw SQL to the model.

- [ ] **Step 2: Route named product-detail turns through lookup**

If the user asks about a concrete product, adding a product, or whether a product suits them, run product lookup before product-specific claims.

Do not call the lookup tool for broad recommendation requests such as "Welche Pantene Produkte empfiehlst du?" unless the assistant needs to resolve a concrete named product.

Behavior:

- `found_exact`: answer through normal product-detail/product-recommendation path from product properties.
- `ambiguous`: ask which candidate or exact variant the user means; no intake card.
- `insufficient_identity`: ask for missing product identity/category; no intake card.
- `unsupported_category`: say this category cannot be added yet; no intake card.
- `not_found`: do not assess exact product; include structured `product_intake_offer` metadata so the UI renders the card.

Existing named off-catalog handling must route through this same result model:

- precise named product in one of the 8 supported categories plus `not_found` becomes product intake;
- ambiguous named product becomes clarification;
- unsupported product category becomes unsupported-category reply;
- broad off-catalog discussion without a concrete product-detail/add-product ask remains a non-intake answer.

Do not let `named-product-context.ts` and the new lookup tool create competing final answers for the same turn.

- [ ] **Step 3: Return intake card contract**

Return structured `rag_context.product_intake_offer` metadata only for `not_found` supported-category products. The assistant message remains natural German generated from the lookup result; it is not a deterministic app copy template.

- [ ] **Step 4: Validator blocks overreach**

Final-answer validator fails if product-specific claims are made when lookup returned `not_found`, `unsupported_category`, `insufficient_identity`, or unresolved `ambiguous`.

Add regression fixtures:

- precise known product in the 8 categories returns no intake card and can answer from product data;
- precise unknown product in the 8 categories returns a natural defer plus `product_intake_offer`;
- ambiguous brand/line mention asks clarification and returns no intake card;
- unsupported category says it cannot be added yet and returns no intake card;
- broad recommendation request does not trigger product lookup/intake card unless it contains a concrete product-detail ask.

### Task 5.3: Owned Product Context

**Files:**

- Modify: `src/hooks/use-hair-profile.ts`
- Modify: `src/lib/recommendation-engine/selection.ts`
- Modify: `src/lib/routines/product-attachments.ts`
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Load user product usage with links**

Fetch:

- category;
- frequency_range;
- raw brand/name;
- match_status;
- product_id;
- product_submission_id;
- joined product/brand/line data where matched.

- [ ] **Step 2: Show pending status**

Profile/onboarding summary should show pending review state rather than pretending the product is known.

Pending products count as category present in routine logic, but the assistant cannot make product-specific quality, fit, strength, or suitability claims until the row is matched to a verified product.

- [ ] **Step 3: Use verified owner products**

Recommendation/routine assessment can use owned verified products even when `is_chaarlie_recommended = false`.

Approved owned products render with the same product card richness as Chaarlie-recommended products. Do not show a user-facing "not recommended" label or badge.

---

## Phase 6: Verification And Shipping Gates

### Automated Checks

- [ ] Run product identity tests:

```bash
npx tsx --test tests/product-identity-normalize.test.ts tests/product-identity-resolution.test.ts tests/product-catalog-normalization.test.ts
```

- [ ] Run product intake tests:

```bash
npx tsx --test tests/product-intake-schema.test.ts tests/product-intake-matching.test.ts tests/product-intake-submissions.test.ts tests/product-intake-review-workflow.test.ts tests/product-intake-review-scripts.test.ts
```

- [ ] Run agent/recommendation tests:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-select-products-tool.spec.ts tests/product-catalog-lifecycle.test.ts
```

- [ ] Run app checks:

```bash
npm run lint
npm run typecheck
npm run test:chat
npm run ci:verify
```

Use the repo's actual available scripts if names differ.

### Manual Checks

- [ ] Phase 0 DB-first gate: verify Phase 0 migration and identity backfill are applied on the target Supabase project before normalized-read app code is deployed.
- [ ] Phase 0 standalone: verify product cards, admin products, chat product cards, and recommendation outputs still work after normalized category/brand/line migration and before intake work starts.
- [ ] Phase 0 cleanup: verify `products.brand` and `products.category` are still present for compatibility, while new reads use normalized identity fields.
- [ ] Phase 7 follow-up: verify `products.brand` and `products.category` are dropped only after all reads, ingestion, and product chunks are migrated to normalized fields.
- [ ] Onboarding: add product by photo path with front photo, category, frequency, no barcode.
- [ ] Onboarding: upload a large phone-style front photo and verify the browser compresses it before upload, the server accepts it, and the user sees only normal upload progress/success copy.
- [ ] Onboarding: add product by manual path with brand alias like `Garnier Fructis`.
- [ ] Onboarding: replacing an existing category product requires confirmation and then updates the existing `user_product_usage` slot.
- [ ] Phase 3 readiness check: before simulated-user QA or staging, verify the target Supabase state has Phase 0/1/2 identity columns/tables, `product_submissions`/extended `user_product_usage`, and the private `product-intake` storage bucket/policies. If any are missing, keep product intake disabled and report the environment blocker rather than treating generic user-facing save errors as app copy issues.
- [ ] Onboarding: deselecting/removing a category with a pending submission cancels the submission and clears the usage slot without violating DB triggers.
- [ ] Onboarding: same-slot pending photo edit without a new upload reuses the committed front photo and saves frequency/text changes.
- [ ] Onboarding: same-slot pending photo edit with a new front photo updates the current reference and removes the old committed object after success.
- [ ] Chat: ask about unknown product and verify assistant defers with product-intake card.
- [ ] Chat: submit product intake by photo with a large phone-style image and verify compression plus upload success.
- [ ] Chat: submit manual text-only product and verify pending review state.
- [ ] Review script: link submission to existing Chaarlie-recommended product.
- [ ] Review script: link submission to existing non-Chaarlie-recommended product.
- [ ] Review script: cross-category barcode match is shown as candidate and does not auto-link.
- [ ] Review script: approve new product and verify product/spec rows are inserted in one transaction.
- [ ] Review script: approval fails if link, image, price, source evidence, checked timestamps, category specs, or manual review tick-off are missing.
- [ ] General recommendations: verify non-Chaarlie-recommended approved user product is not proactively recommended to other users.
- [ ] Owned assessment: verify submitting user can ask about the approved product after notification.

### Required Review Gates

- [ ] Run the repo-required final review gate after implementation and applicable local checks. Use `autoreview` where that is the active repo gate; if local/branch instructions require an additional Codex rescue/final diff review, run that too and record the result before shipping.
- [ ] If migrations changed, check Supabase migration state for project `pqdkhefxsxkyeqelqegq` before merge. For Phase 0 normalized reads, do not merge/deploy code that requires normalized tables/columns until the migration/backfill has been applied and verified, unless the code has an explicit legacy fallback.
- [ ] Ask for explicit approval before commit, push, PR, or merge.

---

## Phase 7: Follow-Up Legacy Identity Contract Cleanup

This is a required follow-up after normalized identity has shipped and survived at least one production release. It is intentionally not part of the blocking foundation release.

### Task 7.1: Drop Legacy `products.brand` And `products.category`

**Files:**

- Create later: `supabase/migrations/<timestamp>_drop_products_legacy_identity_columns.sql`
- Modify any remaining legacy consumers found by audit
- Test: product read, ingestion, chat/RAG, admin, and recommendation tests

- [ ] **Step 1: Audit live and repo usage**

Run:

```bash
rg -n "products\\.brand|products\\.category|\\.select\\([^\\n]*(brand|category)|brand:|category:" src scripts tests supabase/migrations -S
```

Also inspect live logs/query traces for stale reads from deployed functions, scripts, or operational workflows.

Expected: no app code depends on raw `products.brand` or raw `products.category`; allowed hits are historical migrations and normalized returned DTO fields.

- [ ] **Step 2: Verify ingestion and chunking are normalized**

Rerun product ingestion and product chunk generation in dry-run/safe mode.

Expected: no duplicate products are created from cleaned names and no RAG/product chunks are generated from legacy identity fields.

- [ ] **Step 3: Add NOT NULL constraints**

After live verification, add:

```sql
alter table public.products
  alter column category_key set not null,
  alter column brand_id set not null;
```

- [ ] **Step 4: Drop raw legacy columns**

Only after rollback notes and explicit approval, add:

```sql
alter table public.products
  drop column if exists brand,
  drop column if exists category;
```

- [ ] **Step 5: Verify app behavior**

Run product-card, chat product, admin product, ingestion, RAG chunk, and recommendation tests. Manually inspect product cards in the browser.

---

## Final Cleanup: Temporary Upload Reaper

This is the explicit cleanup item for abandoned product-intake uploads. It must not be forgotten after Phase 3 because the upload flow first stores user photos under a temporary Supabase Storage prefix before Save/Continue commits them to a submission.

### Task C.1: Add Temporary Upload Reaper Before Broad Production Enablement

**Files:**

- Create later: `src/app/api/product-intake/cleanup-tmp-uploads/route.ts` or `scripts/product-intake/cleanup-tmp-uploads.ts`
- Modify later: `vercel.json` if using a scheduled API route
- Test later: cleanup script/route unit test plus one dry-run/manual Supabase Storage check

- [ ] **Step 1: Implement a scheduled cleanup path**

Delete abandoned objects under `product-intake/tmp/{user_id}/...` older than the agreed retention window, currently 6 hours.

The cleanup must:

- use service-role storage access only;
- never delete committed submission images under `{user_id}/{submission_id}/...`;
- be idempotent across repeated runs;
- log deleted object count and failures;
- support a dry-run mode if implemented as a script.

- [ ] **Step 2: Wire scheduling or operating procedure**

If implemented as an API route, add a Vercel cron entry protected by `CRON_SECRET`. If implemented as a script-first helper, document the exact command and when it is run.

- [ ] **Step 3: Verify storage behavior**

Manually create or identify one stale tmp object, run the cleanup in dry-run and apply mode, and confirm:

- stale tmp object is deleted;
- fresh tmp object is retained;
- committed submission image is retained;
- logs clearly show what happened.

- [ ] **Step 4: Treat as a production enablement gate**

Phase 3 staging/manual testing may proceed with the upload rate limit in place, but broad production enablement of product photo upload should not happen until this reaper exists and has been verified.

---

## Execution Handoff

This plan is intentionally large. Execute it in phases, with review checkpoints after each phase:

1. Phase 0 catalog identity normalization as a standalone blocking release.
2. Phase 1 user usage and submission schema.
3. Phase 2 matching/resolution.
4. Phase 3 intake APIs/UI. Implemented, reviewed, pushed, and open as draft PR #177 stacked on Phase 2. Before broad production enablement, verify the target Supabase state has Phase 0/1/2 migrations and the `product-intake` storage bucket/policies.
5. Phase 4A review and approval core, stacked from `codex/product-intake-phase-3` / PR #177 as draft PR #179. Implemented, reviewed, pushed, and Vercel green as of 2026-06-18.
6. Phase 4B review ops hardening, stacked from `codex/product-intake-phase-4a-review-core` / PR #179 as draft PR #180. Implemented, reviewed, pushed, Vercel green, and safe ops-smoked as of 2026-06-18.
7. Phase 5 assistant/recommendation integration. This is the next implementation phase: explicit product eligibility modes, AgentV2 product lookup tool integration, and owned verified product context.
8. Phase 6 verification and shipping.
9. Phase 7 follow-up legacy identity contract cleanup after a separate production release.
10. Final cleanup: temporary upload reaper before broad production enablement if it was not already implemented in Phase 4A.

Recommended next skill after final approval: `branch-gate`, then `superpowers:subagent-driven-development`. Before production merge/deploy, refresh the PR stack because PR #172 is currently behind `main`.
