# Product Assessment, Active Product Context, And Agent-Directed Lookup Plan

> Status: implementation, post-Claude fixups, post-`requesting-code-review` fixups, fresh-context subagent guardrail fixups, bounded pending-submission refresh fixups, and post-quota live-smoke fixes are in the local worktree. Targeted tests, `npm run typecheck`, `git diff --check`, historical replay, and the live product-assessment smoke pass locally. Simulated-user review and explicit staging/ship approval are still pending.
> Created: 2026-06-28.
> Worktree: `.worktrees/product-intake-full-flow-smoke`.
> Review: `plans/2026-06-28-product-assessment-context-and-lookup.claude-review.md`.

## Resume Checkpoint - 2026-06-28

OpenAI quota was restored and the local live product-assessment smoke has now passed for exact-found, ambiguous clarification, candidate selection, active-context follow-up, not-found intake, pending follow-up, and broad recommendation after active context. The implementation and deterministic verification are saved in the worktree. Do not stage, commit, push, or open a PR until Nick explicitly approves the ship step.

## Goal

Make chat product understanding reliable for user questions about specific products, without turning product assessment into broad product recommendation.

When a user asks about a named product, Chaarlie should:

- identify the product through an agent-directed lookup flow,
- ask for clarification when multiple plausible products exist,
- offer product intake only after a concrete product is not found,
- answer product-specific assessment questions only from verified product context,
- remember the current product(s) under discussion for natural follow-ups,
- avoid unrelated recommendation cards unless the user explicitly asks for alternatives.

## Problem This Fixes

The current top-stack behavior has product identity, assessment, and recommendation too entangled:

- Specific product questions can still be forced through `product_recommendation` / `select_products`.
- `lookup_product_candidate` exists, but exact/ambiguous/not-found lookup outcomes do not yet define the whole product-assessment path cleanly.
- Candidate selection can answer with stale or contradictory context.
- Follow-up questions after a product selection rely too much on chat history instead of explicit conversation state.
- Broad recommendation cards can appear after the user only asked about one specific product.
- Lookup is still too brittle for shortened names, punctuation/case variants, and line/name aliases.

## Current Implementation Baseline

This is a delta plan, not a greenfield build. The active worktree already contains much of the product-intake and lookup machinery:

- `src/lib/product-intake/product-lookup.ts` already has product lookup statuses and candidate matching.
- `src/lib/agent-v2/product-lookup-policy.ts` already maps lookup statuses to pending UI actions and product-claim blocking.
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts` already converts lookup outcomes into intake offers, clarification cards, deterministic fallbacks, and active-context candidates.
- `src/lib/agent-v2/resolved-product-selection-adapter.ts` and `src/lib/product-intake/resolved-product-selection.ts` already model trusted selected-product context.
- `src/lib/agent-v2/production/persisted-session-state.ts` already has `active_resolved_product_context`, currently as a singular resolved context.
- `messages.rag_context` already persists assistant-message UI metadata such as product intake/clarification/selection payloads.

Implementation must modify these existing seams rather than duplicating new parallel lookup, card, or context systems.

## Locked Decisions

- Add a first-class `product_assessment` answer mode.
- `product_assessment` is for working with products the user named, not for choosing new products from the catalog.
- Keep existing broad product intent semantics in this plan. Do not add a new `primary_intent` enum for product assessment; use the final `answer_mode: "product_assessment"` plus the existing product-detail/comparison request interpretation as the contract.
- Named-product comparison stays in `product_assessment`; it does not automatically become `product_recommendation`.
- Assessment supports up to 3 named products per turn. If the user names more, ask them to narrow to the 2-3 most important.
- Use broad `assessment_kind` values only:
  - `fit`
  - `comparison`
  - `detail`
  - `routine_usage`
- Product assessment is text-only in the UI. No assessment result cards in this plan.
- Product assessment may internally reuse the existing `select_products`/product projection data path to load product facts, but it must not render recommendation cards when the final answer mode is `product_assessment`.
- Product cards remain for:
  - clarification candidates,
  - intake cards,
  - actual product recommendations.
- Candidate match UX is warm clarification: one natural sentence, product card, no product-specific judgment until the user confirms.
- After candidate selection, the assistant should acknowledge briefly and answer the original question in the same turn when possible.
- The clarification/selection card stores structured metadata as a technical receipt. Conversation history still provides natural context.
- Store active product context as conversation-scoped soft memory, not as durable routine ownership.
- Active product context can be resolved or unresolved/pending.
- Resolved context may come from:
  - exact-found lookup,
  - user-selected candidate,
  - approved/intake-linked owned-product context if already available through normal DB/routine context.
- Pending context may come from:
  - a not-found product intake offer,
  - a submitted product intake card,
  - a pending product submission.
- Pending context blocks product-specific advice and points back to review status.
- Active product context is max 3 products.
- Implement max-3 active product context in this scope, not as a later follow-up, because product assessment supports up to 3 named products and follow-up questions after comparisons need the same context.
- Active product context is background context, not a router. Broad recommendation requests still use normal recommendation flow unless the user explicitly asks for alternatives to the active product.
- Inject compact active product context into Agent V2 turns. Refresh pending submission status from Supabase when needed.
- Chat lookup scope:
  - active global products with `is_chaarlie_recommended = true`,
  - plus `is_chaarlie_recommended = false` products linked to the current user.
- Internal review/dedupe may search all approved products.
- Same brand/category but no exact variant: show up to 3 strong candidates first, no intake yet.
- Cross-category close match: show the candidate with a clear warning. If the user really uses that product in the requested category and no category-specific row exists, show intake for that category.
- Category-specific product rows are required for product-specific assessment.
- Strong candidates are visible. Weak candidates are internal evidence only.
- Lookup architecture is agent-directed candidate retrieval:
  - model decides when lookup is needed,
  - lookup receives raw phrase plus optional hints,
  - lookup returns exact/strong/weak candidates and evidence,
  - model chooses natural UX path,
  - validators prevent product claims without verified/resolved context.
- The lookup service should use lexical/fuzzy ranking first, not semantic search in this phase.
- Exact-found means confident exact, not strict string equality:
  - clear brand,
  - clear or inferable category/use,
  - distinctive product tokens uniquely identify one eligible active product,
  - no competing strong candidate remains.
- Candidate ranking priority:
  1. visibility/ownership,
  2. category/use,
  3. brand,
  4. product line/name/distinctive tokens,
  5. fuzzy typo tolerance,
  6. weak internal evidence.
- If category is missing, infer when obvious from text/context; otherwise lookup broadly and clarify category/use only when needed.
- Product-specific claims require product data. If the exact property is missing, clearly separate general category guidance from product-specific uncertainty.

## Explicit Non-Goals

- Do not build durable "save this known product into my routine/profile from chat" in this plan.
- Do not redesign the routine mutation flow.
- Do not add assessment result cards.
- Do not create a separate product-assessment projection or new product-facts tool in this plan; reuse the existing product projection path internally.
- Do not add a new `primary_intent` just for product assessment.
- Do not build a full semantic-search infrastructure.
- Do not fix category display labels here; this was fixed in another work session.
- Do not change the research/review app workflow committed separately.
- Do not make unapproved products eligible for broad recommendations.
- Do not use visible assistant copy parsing as the source of truth for cards or state.
- Do not make approval notifications update active product context in v1 unless there is a concrete conversation-state write path. The approval notification can stay a chat message; later turns can resolve through the normal DB/routine/context path.
- Do not add a temporary user-facing feature flag or fallback switch for `product_assessment`. This is test-phase feedback for a feature that will ship broadly after sufficient verification.

## Architecture Direction

Use a model-native assistant with structured boundaries:

- **Model-owned judgment:** intent, ambiguity handling, final German answer, whether active product context is relevant to the current turn.
- **Lookup/retrieval plumbing:** catalog search, visibility filtering, candidate ranking, exact/strong/weak evidence.
- **Deterministic guardrails:** schemas, validator, product-claim blocking, user-owned visibility rules, pending-submission status refresh, max active-context size.

## Target File Map

Likely touched files:

- `src/lib/agent-v2/contracts.ts`
  - Add `product_assessment` answer mode.
  - Add minimal product-assessment payload schema.
  - Add broad `assessment_kind`.
- `src/lib/agent-v2/tools/tool-definitions.ts`
  - Update `lookup_product_candidate` description for agent-directed candidate retrieval.
  - Untangle `select_products` wording so product detail/assessment does not default to recommendation tooling.
- `src/lib/agent-v2/tools/guidance-tool.ts`
  - Ensure loaded guidance allows named-product assessment without forcing broad recommendation mode.
- `data/agent-v2/guidance/**`
  - Update active guidance that currently says named product detail must use `select_products` as visible recommendation output.
  - Keep `select_products` available as an internal product-facts/projection source for assessment when needed.
- `src/lib/agent-v2/named-product-context.ts`
  - Keep named-product intent detection aligned with `product_assessment` and lookup-required validation.
- `src/lib/agent-v2/runtime/responses-agent.ts`
  - Inject compact active product context.
  - Route trusted lookup/selection/exact-found context into assessment.
  - Ensure selected/exact products become active product context.
- `src/lib/agent-v2/runtime/prompt.ts`
  - Add concise guidance for product assessment vs product recommendation.
- `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Allow `product_assessment` for named-product turns.
  - Require lookup/resolved context before product-specific claims.
  - Prevent broad recommendation payload/cards for pure assessment turns.
  - Validate assessed product IDs against trusted lookup/selection context.
  - Add `product_assessment` to `payloadFieldsByMode`.
  - Update all product-detail validators that currently require `select_products`.
- `src/lib/agent-v2/production/product-output.ts`
  - Render `product_assessment` as normal assistant text only.
  - Suppress recommendation-card output for product-assessment turns, even if product facts were loaded internally.
- `src/lib/agent-v2/product-lookup-policy.ts`
  - Align lookup status policies with assessment/clarification/intake behavior.
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`
  - Add `product_assessment` handling to exhaustive answer-mode logic.
  - Ensure lookup outcomes can build assessment-compatible active context and card metadata.
- `src/lib/product-intake/product-lookup.ts`
  - Upgrade lookup to agent-directed candidate retrieval with confident exact, strong candidates, weak internal evidence, and evidence-rich output.
  - Support category-less lookup when category cannot be inferred.
- `src/lib/agent-v2/production/persisted-session-state.ts`
  - Extend/normalize active product context to support resolved and pending contexts, max 3.
  - Normalize old singular persisted active context into the chosen new shape.
- `src/lib/agent-v2/production/session-state.ts`
  - Update active product context from exact-found lookup, candidate selection, intake submit, and assessment outcomes.
  - Do not treat approval notification messages as active-context writes unless a concrete persisted-state write path is added later.
  - Update all singular-context consumers if the final shape becomes an array.
- `src/lib/agent-v2/production/chat-pipeline.ts`
  - Refresh pending submission status when needed.
  - Persist active context transitions.
- `src/app/api/chat/product-selection/route.ts`
  - Ensure selection event carries original question and updates active product context.
- `src/components/chat/product-intake-card.tsx`
  - Only if needed to emit submission context after intake submit; no visual redesign expected.
- `src/lib/types.ts`
  - Update message/session metadata types only if the active-context or product-assessment payload shape requires it.
- `tests/agent-v2-contracts.spec.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-product-lookup-policy.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-production-chat-pipeline.spec.ts`
- `tests/agent-v2-product-lookup-clarification.spec.ts`
- `tests/agent-v2-product-selection.spec.ts`
- `tests/product-intake-lookup.test.ts`
- Add focused tests if needed:
  - `tests/agent-v2-product-assessment.spec.ts`
  - `tests/agent-v2-active-product-context.spec.ts`

## Implementation Tasks

### 1. Contract: Product Assessment Mode

- [x] Add `product_assessment` to `AgentV2AnswerModeSchema`.
- [x] Add the new mode to every exhaustive answer-mode consumer, including `product-lookup-turn-outcome.ts`.
- [x] Add the new mode to `payloadFieldsByMode` in `final-answer-validator.ts`.
- [x] Define terminal semantics explicitly:
  - `answer_mode: "product_assessment"`
  - keep existing `request_interpretation.primary_intent` values; do not add a new primary intent in this plan,
  - keep existing product request-kind semantics: single-product fit/detail/routine questions stay product-detail-like, named A/B comparisons stay comparison-like,
  - `tool_grounding.used_product_tool` must be true when the answer uses product facts loaded through the existing projection path,
  - `tool_grounding.product_ids` must include every assessed product ID,
  - `assessed_product_ids` must be a subset of trusted grounded product IDs and max 3 entries.
- [x] Add minimal payload:
  - `assessment_kind: "fit" | "comparison" | "detail" | "routine_usage"`
  - `assessed_product_ids: string[]`
  - `user_facing_answer_de: string`
- [x] Keep product-assessment payload text-only. It should not carry product cards, recommendation candidates, or machine verdict taxonomy.
- [x] Keep no machine verdict taxonomy in this plan.
- [x] Update contract tests for valid and invalid product-assessment payloads.

### 2. Validator: Separate Assessment From Recommendation

- [x] Allow named-product turns to end in `product_assessment` when grounded by lookup/selection/active resolved context.
- [x] Require `lookup_product_candidate` or trusted active context before product-specific claims.
- [x] Add a dedicated "grounded by lookup, selected candidate, or active resolved product context" path for `product_assessment`.
- [x] Do not blindly reuse the existing trusted-selected-product exception if it disables or rejects product-specific claims; product assessment needs its own grounding check that allows claims only for verified product IDs.
- [x] Update `validateInterpretationAnswerMode` so `product_detail` can use `product_assessment`.
- [x] Update `validateInterpretationToolHistory` so `product_assessment` does not require `select_products` when grounded by lookup/active context.
- [x] Update `validateProductToolRequired` and related product-tool validators so assessment turns are not forced into recommendation tooling.
- [x] Allow internally loaded product projection/`select_products` facts to satisfy product-data grounding without changing the final answer into `product_recommendation` or emitting recommendation cards.
- [x] Block `product_assessment` if `assessed_product_ids` are not in trusted lookup/selection/active context.
- [x] Block product-specific assessment for unresolved/pending contexts.
- [x] Keep generic category guidance allowed only when explicitly separated from unavailable product-specific data.
- [x] Prevent recommendation payload/cards for pure assessment turns unless user explicitly asked for alternatives.
- [x] Add validator regression tests for:
  - missing `assessed_product_ids`,
  - more than 3 assessed products,
  - assessed IDs not present in trusted grounding,
  - unresolved lookup status trying to produce product-specific assessment,
  - `product_detail` plus `product_assessment` not requiring visible `select_products`,
  - `product_assessment` plus recommendation payload/cards being rejected.

### 3. Runtime Guidance And Tool Contracts

- [x] Update prompt/tool wording so the model treats:
  - "Does this product suit me?"
  - "What do you think of Product X?"
  - "Is A or B better?"
  - "Is Product X color-safe/protein-heavy/mild?"
  as product assessment, not broad recommendation.
- [x] Keep visible `select_products` output for actual product recommendation and comparison of catalog options selected by the system.
- [x] Reuse existing product projection data internally for assessment when product facts are needed:
  - load facts for the resolved product IDs,
  - expose them to the model as grounding,
  - do not emit visible recommendation cards for this internal projection.
- [x] Keep `lookup_product_candidate` as the first identity-resolution tool for named products.
- [x] Add guidance that alternatives should be offered in text first; product recommendation cards require the user's explicit follow-up.
- [x] Update named-product context handling so product assessment intents remain lookup-actionable and do not fall into broad recommendation flow.
- [x] Update `guidance-tool.ts` and active `data/agent-v2/guidance/**` files so current guidance does not contradict the new contract by saying named product detail must become a recommendation response.

### 4. Agent-Directed Candidate Retrieval

- [x] Rework lookup output into evidence-rich candidate retrieval:
  - raw query phrase,
  - parsed/hinted brand/category/name,
  - `found_exact` when confident exact,
  - strong visible candidates,
  - weak internal candidates,
  - evidence summary for why each candidate matched.
- [x] Implement confident-exact logic:
  - unique eligible candidate,
  - brand/category/use sufficiently clear,
  - distinctive product tokens match,
  - no competing strong candidate.
- [x] Implement category-less lookup when category cannot be inferred:
  - search across supported categories,
  - return exact/strong candidates when identity is clear,
  - ask category/use only when it changes the answer, routine save, or intake path.
- [x] Improve lexical/fuzzy matching:
  - case-insensitive,
  - punctuation-insensitive,
  - `No.7` / `No 7` / `Nr. 7`,
  - product-line/name aliases,
  - common shortened names such as "Syoss Volume Shampoo".
- [x] Enforce visibility:
  - global recommended products,
  - plus current user's linked non-recommended products.
- [x] Map strong/weak candidate tiers onto existing lookup candidate confidence/status concepts instead of inventing a parallel taxonomy.
- [x] Use real current statuses in tests, especially `needs_variant_selection` for same-brand/same-category multiple candidates.
- [x] Keep weak candidates out of user UI but available in trace/debug/review evidence.

### 5. Clarification And Intake State

- [x] For strong candidates, render warm clarification card and no product-specific assessment yet.
- [x] Ensure card metadata stores:
  - original user question,
  - lookup identity,
  - candidates,
  - requested category/use,
  - status and evidence summary.
- [x] After selection, answer the original question in the same assistant turn when possible.
- [x] If not found, render intake card only after concrete product identity and supported category/use are established.
- [x] After intake submit, store pending submission context and block product-specific advice until approval.
  - Pending context is stored from intake offer/submission state.
  - Routine inventory rows with pending submission links are refreshed through a bounded DB read.
  - Terminal submission rows suppress stale pending routine context instead of keeping the product under review forever.

### 6. Active Product Context

- [x] Extend active product context to support resolved and pending entries.
- [x] Store max 3 active product contexts in this implementation, including follow-up support after A/B/C product comparisons.
- [x] Use one normalized array shape for active product context, for example:
  - `status: "resolved" | "pending_review"`
  - `product_id: string | null`
  - `submission_id: string | null`
  - `category: string | null`
  - `brand_text: string | null`
  - `product_name_text: string | null`
  - `display_name: string`
  - `original_user_message: string`
  - `source: "lookup_exact" | "product_lookup_selection" | "product_intake_submission"`
  - `updated_at: string`
- [x] Keep the serialized context compact when injected into Agent V2; include only what the model needs for follow-ups and pending-status handling.
- [x] Before changing the shape, enumerate and patch all singular active-context consumers:
  - `persisted-session-state.ts` summary and normalization,
  - `chat-pipeline.ts` state threading and run params,
  - `session-state.ts` next-state builder,
  - `responses-agent.ts` active/trusted selected-product injection,
  - tests that assert singular `product_id`/`category`.
- [x] Preserve backwards compatibility by normalizing existing singular persisted contexts into the chosen new shape.
- [x] Update context on:
  - exact-found assessment,
  - candidate selection,
  - intake offer / pending product context.
- [x] Do not update active context from approval notification messages in this v1 unless implementation discovers an existing conversation-state write seam that is safe and local to this plan.
- [x] Preserve context across follow-ups and inject compactly into the next Agent V2 turn.
- [x] Let the model decide relevance; do not use active context as a hard router.
- [x] Define pending-status refresh precisely:
  - refresh only when active context contains a pending submission and the current turn could reference it,
  - do not add an unbounded DB read to every chat turn,
  - keep the refreshed status compact in model context.
  - Implementation note: the current patch refreshes pending submission identity only for bounded routine inventory / active-context candidates with a submission id, treats the submission row as authoritative, and drops pending context when the submission has moved to a terminal status.
- [x] Keep durable routine/profile inventory unchanged unless another flow explicitly saves it.

### 7. Multi-Product Assessment

- [x] Support up to 3 named products.
- [x] If more than 3 are named, ask the user to narrow.
- [x] For comparison, require all named products to be resolved before final assessment.
- [x] If one product is found and another is ambiguous/not found, clarify/intake unresolved products first.
- [x] After all products are resolved, answer the original comparison/assessment.

### 8. Tests And Local QA

- [x] Exact-found assessment:
  - "Syoss Volume Shampoo" confidently finds `Syoss Intense Volume Shampoo` when unique.
- [x] Ambiguous candidate:
  - same brand/category multiple variants shows clarification card, no assessment yet.
- [x] Cross-category:
  - same physical product in another category shows warning candidate; if rejected, intake for requested category.
- [x] Not found:
  - concrete product not in DB shows intake card with no contradictory assistant copy.
- [x] Pending follow-up:
  - after intake submit, "how often should I use it?" says review is pending.
  - Covered by deterministic production-pipeline regression for normal not-found turns with pending submission context and by the live smoke after provider quota was restored.
- [x] Selection follow-up:
  - after selecting a candidate, assistant answers original question and next "how often?" uses active product context.
- [x] Active context state:
  - legacy singular `active_resolved_product_context` normalizes into one resolved entry,
  - max 3 resolved/pending contexts persist,
  - newest pending context prevents an older resolved product from being exposed as primary.
- [x] Recommendation boundary:
  - product assessment does not render unrelated recommendation cards.
  - alternatives are offered in text only until user asks.
- [x] Multi-product:
  - A/B comparison waits for all products resolved.
- [x] Factual detail:
  - if DB lacks exact property, answer separates product-specific uncertainty from general guidance.

## Required Checks

Run targeted checks after implementation:

- `npx tsx --test tests/agent-v2-contracts.spec.ts`
- `npx tsx --test tests/agent-v2-final-answer-validator.spec.ts`
- `npx tsx --test tests/agent-v2-product-lookup-policy.spec.ts`
- `npx tsx --test tests/agent-v2-responses-runtime.spec.ts`
- `npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts`
- `npx tsx --test tests/agent-v2-product-lookup-clarification.spec.ts`
- `npx tsx --test tests/agent-v2-product-selection.spec.ts`
- `npx tsx --test tests/agent-v2-guidance-compiler.spec.ts` if guidance/compiler tests exist or are added by the implementation.
- `npx tsx --test tests/product-intake-lookup.test.ts`
- Any new product-assessment/active-context tests added by this plan.
- `npm run typecheck`

Latest local verification, 2026-06-28:

- [x] `npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts`
- [x] `npx tsx --test tests/agent-v2-responses-runtime.spec.ts`
- [x] `npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-named-product-context.spec.ts tests/agent-v2-product-lookup-policy.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-product-selection.spec.ts tests/agent-v2-resolved-product-selection-adapter.spec.ts`
- [x] `npx tsx --test tests/product-intake-lookup.test.ts tests/product-intake-submissions.test.ts tests/product-intake-notifications.test.ts tests/resolved-product-selection.test.ts tests/chat-product-mentions.test.tsx tests/onboarding-care-vocabulary.test.ts`
- [x] `npm run typecheck`
- [x] `git diff --check`

Browser/API smoke after checks:

- [x] Exact-found Syoss question answers as assessment, sets active resolved product context, and does not render an intake card or unrelated recommendation card.
- [x] Ambiguous Syoss variant shows clarification card.
- [x] Selecting candidate answers original question.
- [x] Asking a follow-up uses active product context.
- [x] Not-found Jean & Len-style product renders intake card and pending state behaves correctly.
- [x] Broad recommendation after active context still uses the normal recommendation path.

Latest live-smoke result:

- [x] Re-ran remaining live browser/API smoke after provider quota was restored. `npx tsx tmp/live-product-assessment-smoke.ts all` passed locally on 2026-06-28 after the category-less known-brand fallback and visible resolved-product-name patches.

## Review Gates

- [x] Run Claude plan review before implementation.
- [x] Patch accepted Claude findings.
- [x] Resolve open user decisions from Claude review before implementation.
- [x] After implementation, run Claude code review.
- [x] Patch accepted Claude code-review findings:
  - safety-mode guard for deterministic product-lookup fallbacks and cards,
  - `N°5` / `N°7` tokenization and rare apostrophe normalization,
  - notification idempotency claim-before-insert ordering,
  - matched-photo tmp cleanup after matched usage write,
  - turn-gate allowance for `product_assessment`,
  - missing `no_towel` onboarding icon,
  - removal of a stale duplicate validator helper.
- [x] Run `requesting-code-review` after the post-Claude patch set.
- [x] Patch accepted `requesting-code-review` findings:
  - product-selection replay/duplicate paths now repair active product context before streaming the existing answer,
  - product-selection route now rejects non-recommended products unless they are linked to the current user as matched owned products,
  - fresh product-selection answer now fails closed if conversation-state persistence fails,
  - fallback/recovery lookup scope was reviewed; the live chat loader already pre-scopes the catalog to user-visible products before fallback lookup, and the route validation now provides the final safety check.
- [x] Patch post-smoke product-assessment schema/validator gap:
  - `submit_final_answer` now exposes the `product_assessment` payload schema to the model,
  - found-exact lookup results can ground text-only product assessment without forcing visible recommendation-card semantics,
  - unresolved/off-catalog lookup results still block product-specific claims.
- [x] Patch fresh-context subagent guardrail findings:
  - mixed found-exact plus unresolved lookup results now still block product-specific claims about the unresolved product,
  - pending-review active product context is converted into unresolved lookup evidence for validation,
  - safe deferral copy remains allowed because the unresolved-product blocker now separates "related lookup" from affirmative product-fit/use/property claims.
- [x] Patch fresh-context subagent pending-refresh findings:
  - normal not-found turns with matching pending submission context now suppress repeat intake offers even without repair/failure-stage metadata,
  - terminal submission rows now prevent stale routine inventory from being injected as pending active product context.
- [ ] Run simulated-user review for:
  - exact-found assessment,
  - ambiguous clarification,
  - candidate selection,
  - not-found intake,
  - pending follow-up,
  - broad recommendation after active context.
- [ ] Stop before staging/committing/pushing for explicit approval.

## Open Risks

- `product_assessment` touches the central Agent V2 answer contract and validator; tests must be broad enough to avoid breaking existing product-recommendation flows.
- Lookup calibration may need iteration. Keep scoring traceable so failures can be debugged from candidate evidence.
- Active product context must stay helpful but not sticky. The model should see it as background context, not a forced routing decision.
- The current branch already contains a partial implementation of lookup/selection/context behavior. Implementation must patch the existing seams, not rebuild parallel systems.
- The current worktree already contains uncommitted top-stack changes; implementation must preserve unrelated changes and classify dirty files before editing.
- Pending-submission refresh is intentionally bounded rather than a blind per-turn DB read. Residual risk: this should still get one simulated-user review pass before shipping because model copy can drift even when the live smoke passes.
- Deferred code-review findings to revisit separately: canonical brand conflict guard, active-context shape cleanup beyond the compatibility bridge, typed product-selection route boundary, SKU/url normalization, orphaned committed image cleanup, broader hook/component tests, and the untracked `data/product-additions/2026-06-27-user-submitted.json` packaging decision before final commit.

## Claude Review Classification

Review file: `plans/2026-06-28-product-assessment-context-and-lookup.claude-review.md`.

Accepted and patched into this plan:

- Reframe implementation as a delta on existing lookup/policy/turn-outcome/validator code.
- Add missing load-bearing files to the target map: `product-lookup-turn-outcome.ts`, `named-product-context.ts`, and product-lookup policy tests.
- Call out exhaustive answer-mode obligations, especially `payloadFieldsByMode` and the `product-lookup-turn-outcome.ts` `never` switch.
- Specify the validator conflict: `product_detail` currently requires `select_products`; `product_assessment` needs a lookup/active-context grounding path instead.
- Add category-less lookup support because the locked UX decision depends on it.
- Enumerate singular active-context consumers before changing shape.
- Define pending-submission refresh as bounded, not a blind per-turn DB read.
- Use current lookup statuses such as `needs_variant_selection` in tests.

Resolved user decisions from Claude review:

- Implement max-3 active product context now. Reason: product assessment supports up to 3 named products, and follow-up questions after comparisons would fail if the active context remembered only one.
- Do not add a temporary fallback/kill-switch for `product_assessment`. Reason: this is being built from internal test-phase feedback and will ship to all users once sufficiently tested.

## Fresh-Context Adversarial Review Classification

Review source: fresh-context subagent `Ohm`, 2026-06-28.

Accepted and patched into this plan:

- Specify exact `product_assessment` terminal semantics instead of only naming the new answer mode.
- Add `product-output.ts`, `guidance-tool.ts`, `data/agent-v2/guidance/**`, and optional shared type targets to the file map.
- Make the validator contract explicit: assessed product IDs must come from trusted lookup/selection/active-context grounding, and pure assessment must not render recommendation cards.
- Do not blindly reuse the existing trusted-selection validator exception if it blocks product-specific claims; add a dedicated product-assessment grounding path.
- Define how product facts are loaded: reuse the existing product projection/`select_products` data path internally, but keep the visible response as `product_assessment`.
- Define active product context as a normalized max-3 array with resolved and pending entries.
- Keep pending-submission refresh bounded to turns that could refer to a pending context.

Deferred or intentionally excluded:

- Do not create a new product-assessment projection/tool in this plan; reuse the existing projection path first.
- Do not add a new `primary_intent`; use existing intent/request-kind semantics plus `answer_mode: "product_assessment"`.
- Do not implement approval-notification-to-active-context writes unless implementation finds a safe existing persisted-state seam.
- Do not build a broad weak-candidate evidence taxonomy; weak candidates can stay internal trace/debug evidence in this phase.

Resolved user decisions from adversarial review:

- Use internal projection reuse for product facts instead of identity-only lookup or a new projection.
- Keep product assessment under the existing product-detail/comparison interpretation family; no new primary intent for now.
- Implement max-3 active product context now.
- Keep the pending submission refresh slim and status-driven.

## Handoff Notes

- This plan supersedes the remaining product-assessment concerns in `plans/2026-06-25-product-lookup-clarification-card.md` and `plans/2026-06-25-product-selection-architecture-cleanup.md`.
- After this plan is implemented, update both this plan and the master ledger `plans/2026-06-10-product-intake-intelligence.md`.
- Do not fold this into the review-app/research-ops commit; that work was already committed separately.
