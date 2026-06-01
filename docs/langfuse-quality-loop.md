# Langfuse Quality Loop

This repo has a Langfuse integration for the production chat path and the
AgentV2 Responses plus CareBalance recommendation engine.

## What is live in the app

- One Langfuse trace per chat turn, grouped by conversation ID as the session ID.
- The production chat route runs AgentV2 production chat, which uses the
  CareBalance recommendation engine.
- Observed OpenAI generations for current agent prompts:
  - `agent-v2-responses-step`
  - legacy bounded-agent route/render generations when Compare Lab or older
    helper paths use them
- The root chat observation output includes compact review fields:
  - `response_composition`
  - `engine_summary`
  - `selected_products`
  - `agent_v2_summary`
- The full sanitized turn trace is persisted in Supabase
  `conversation_turn_traces`.
- Prompt linkage for the production chat prompts:
  - chat system prompt
  - intent classifier prompt
  - conversation title prompt
  - memory extraction prompt
  - AgentV2 Responses prompt
- Prompt fallback behavior if Langfuse is unavailable or a label is missing.
- Assistant-message thumbs up/down feedback stored locally and sent to Langfuse scores.
- Eval harness publishing into Langfuse experiments.

## Required environment variables

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_RELEASE`

Optional:

- `LANGFUSE_PROMPT_LABEL`
- `LANGFUSE_TRACING_ENVIRONMENT`
- `LANGFUSE_EVAL_PUBLISH`

Use your Langfuse EU cloud base URL for `LANGFUSE_BASE_URL`.

## Prompt workflow

The repo keeps prompt fallbacks in code and treats Langfuse as the runtime
source of truth for managed prompts that are fetched by the current runtime.

1. Sync the repo prompts into Langfuse:

```bash
npm run langfuse:sync-prompts
```

2. Review or relabel the synced versions in Langfuse.

3. Production chat reads managed prompts by label for the agentic model calls.
   If that fetch fails, the app falls back to the in-repo prompt text and marks
   the generation metadata as fallback-backed.

Use `--dry-run` to preview prompt changes:

```bash
npm run langfuse:sync-prompts -- --dry-run
```

## Eval workflow

Run the normal harness without publishing:

```bash
npm run test:chat:judge
```

Publish the run into Langfuse:

```bash
npm run test:chat:langfuse
```

Useful flags:

- `--scenario <id>`
- `--base-url <url>`
- `--langfuse-run-name <name>`
- `--langfuse-experiment-name <name>`

The Langfuse experiment stores:

- assertion pass rate
- scenario-specific judge score
- groundedness
- recommendation relevance
- clarification quality
- overclaim risk
- internal eval quality

`internal_eval_quality` is the phase-1 headline KPI. It blends deterministic assertion pass rate, rubric scores, and the scenario-specific expectation judge when present.

## CI quality policy

Pull requests use a tiered quality gate:

- deterministic checks always run: typecheck, lint, build, Node contract tests, Playwright contract tests, and `@ci` smoke tests
- live chat smoke eval runs only when AI, chat, RAG, routine, recommendation, prompt, or eval-harness paths change
- dependency manifest changes do not trigger live chat smoke by themselves, so Dependabot PRs do not need OpenAI/Supabase chat secrets unless they also touch AI behavior
- retrieval metrics run only when retrieval, ingestion, source chunking, Supabase match functions, or retrieval gold-set paths change; until `tests/fixtures/retrieval-gold-set.json` is annotated with real chunk IDs, CI logs this as a skipped gate instead of enforcing placeholder metrics
- full judged chat evals are manual or scheduled, not required on every PR

Use this before a quality-critical merge, launch, prompt/model/provider change, or when production feedback suggests regression:

```bash
npm run test:chat:judge
```

Publish the judged run into Langfuse when comparing prompt or behavior changes:

```bash
npm run test:chat:langfuse
```

The PR chat smoke suite intentionally stays small to control external API cost and flake risk. Add a scenario to the PR smoke suite only when it protects a high-value regression, safety redirect, or routing contract.

The retrieval metric gate requires an annotated gold set. The current placeholder value `__ANNOTATE__` is intentionally treated as not enforceable so CI does not report meaningless zero-quality scores as product regressions.

## AgentV2 Production Status

AgentV2 Responses with CareBalance is the production chat path. Compare Lab
still exists for side-by-side review, but `/api/chat` now routes through AgentV2
Responses and the CareBalance recommendation context.

For full persisted trace review, inspect:

- `response_composition.path = agent_v2_responses`
- `response_composition.migration_mode = agent_v2_care_balance`
- `engine_variant = agent_v2_care_balance`
- `router_decision.retrieval_mode = agent_v2_responses`
- `agent_v2_trace.model_steps`
- `agent_v2_trace.tool_calls`
- `agent_v2_trace.loaded_guidance_ids`
- `agent_v2_trace.answer_context_capsule_ids`
- `agent_v2_trace.guardrails`
- `agent_v2_trace.visible_failure`
- `decision_context.engine_trace`
- `decision_context.matched_products`

The main risk buckets are now AgentV2 tool-choice misses, missing or over-broad
guidance, CareBalance category-fit regressions, unsupported product-claim
wording, and visible AgentV2 failure handling.

## GitHub repository settings to confirm

- Require the `CI / quality` check before merging to `main`.
- Require the `Security / dependency-review` check for PRs that change dependency manifests when available on the repository plan.
- Enable secret scanning in GitHub settings.
- Keep full judged Langfuse evals manual or scheduled until the score threshold has enough history to be reliable.

## Dataset seeding

Seed the two baseline datasets:

```bash
npm run langfuse:seed-datasets
```

Default datasets:

- `chaarlie-curated-chat-evals`
- `chaarlie-production-chat-triage`

The production dataset samples recent traced conversations from Supabase using:

- thumbs down traces
- zero-feedback traces
- thumbs up traces

Helpful flags:

- `--since-days 30`
- `--negative-limit 50`
- `--zero-feedback-limit 25`
- `--positive-limit 10`
- `--fetch-limit 500`

Production dataset items include review metadata for slicing:

- `trace_version`
- `response_composition_path`
- `prompt_kind`
- `retrieval_mode`
- `response_mode`
- `engine_damage_level`
- `engine_repair_priority`
- `engine_actions`
- `selected_products`
- `failure_bucket`

## Trace Schema V2

Trace Schema V2 keeps the review-critical decision path in structured fields:

- `router_decision`: intent routing, retrieval mode, response mode, clarification state, confidence, slot completeness, and policy overrides.
- `decision_context.engine_trace.damage`: engine damage assessment, including overall level and repair priority.
- `decision_context.engine_trace.categories`: category-level engine actions. For review, inspect each category's `relevant`, `action`, reason codes, and target profile.
- `decision_context.matched_products`: selected product traces, including `recommendation_meta` for score, top reasons, tradeoffs, usage hint, and category-specific fit metadata.
- `agent_v2_trace`: compact model-step, tool-call, loaded-guidance,
  answer-context, guardrail, and visible-failure metadata. Raw prompt context and
  raw guidance bodies are intentionally not persisted here.
- `response_composition`: composer path, migration mode, fallback reason, rendering path, plan type, and attachment mode.
- `user_feedback`: thumbs feedback and review annotations when present, including `failure_bucket`.

In Langfuse, start from the production dataset item metadata for slicing, then
open the source trace to inspect the root observation output. Use the linked
Supabase `conversation_turn_traces` row or admin conversation trace view for the
full `agent_v2_trace`, `router_decision`, engine categories, matched product
`recommendation_meta`, `response_composition`, and `user_feedback` details.

## Review queue setup

Create the manual review score configs and annotation queues:

```bash
npm run langfuse:setup-review-queues
```

Queues created by default:

- `HC Thumbs Down Review`
- `HC No Feedback Sample`
- `HC Thumbs Up Sample`
- `HC Prompt Change Review`

If your Langfuse plan only allows a single annotation queue, the setup script will automatically reuse the first available queue for all review buckets instead of failing. In that case, treat that one queue as your shared manual review inbox.

To focus the prompt-change queue on specific prompt versions:

```bash
npm run langfuse:setup-review-queues -- --prompt-versions 12,13
```

Use the shared review rubric in [docs/chat-quality-review-rubric.md](docs/chat-quality-review-rubric.md) so manual review, thumbs feedback, and eval metrics stay aligned.

## Tester Cohort Review

Run tester cohort review weekly, and additionally after prompt, tool-routing,
recommendation-engine, answer-context, or response-composition changes.

Suggested cadence:

- `2x` per week: review new thumbs-down traces from the tester cohort.
- weekly: sample zero-feedback traces across the most active categories.
- weekly: sample thumbs-up traces as positive references.
- before an AgentV2 or CareBalance rule/prompt change: seed the production dataset and tag the review batch.
- after the change: compare the same slicing dimensions against the next tester cohort sample.

Primary slicing dimensions from Langfuse metadata and the linked full persisted trace:

- `trace_version`
- `response_composition_path`
- `prompt_kind`
- `intent`
- `product_category`
- `retrieval_mode`
- `response_mode`
- `needs_clarification`
- `agent_v2_trace.tool_calls[].name`
- `agent_v2_trace.loaded_guidance_ids`
- `agent_v2_trace.answer_context_capsule_ids`
- `agent_v2_trace.guardrails`
- `agent_v2_trace.visible_failure`
- `engine_damage_level`
- `engine_repair_priority`
- `engine_actions.<category>.relevant`
- `engine_actions.<category>.action`
- `selected_products[].category`
- `selected_products[].recommendation_meta` compact scalar fit fields
- `failure_bucket`

Use these slices to separate routing failures, deterministic engine/category fit failures, product metadata gaps, response composition regressions, and positive reference traces.

## Privacy and masking

Before trace data leaves the app, the Langfuse OTEL exporter applies masking in `src/lib/langfuse/masking.ts`.

Sent raw:

- structured hair-profile enums and booleans
- routing metadata such as `intent`, `product_category`, `retrieval_mode`, and `needs_clarification`
- prompt name, version, label, and fallback status
- release and environment dimensions
- user feedback and eval scores

Masked:

- email-like strings
- phone-like strings
- metadata keys such as `email`, `name`, `first_name`, `last_name`, and `phone`

Aggressively redacted:

- `additional_notes`
- `memory_context`
- `conversation_memory`
- `notes`
- `free_text`

This keeps quality-relevant structured context visible while reducing direct identifier leakage.

## Operational notes

- Keep the current Supabase trace tables and admin trace UI. They are still the source of repo-local debugging context.
- Langfuse is the quality analysis layer on top: prompt versions, experiments, review queues, and cross-run comparison.
- Release gating is still manual in phase 1. Use Langfuse traces, experiments, and queues to make ship decisions, but do not hard-block CI on these scores yet.
