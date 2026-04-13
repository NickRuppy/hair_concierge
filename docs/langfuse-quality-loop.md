# Langfuse Quality Loop

This repo now has a phase-1 Langfuse integration for the production chat path.

## What is live in the app

- One Langfuse trace per chat turn, grouped by conversation ID as the session ID.
- Child observations for the major pipeline stages:
  - context loading
  - intent classification
  - routing
  - retrieval
  - product selection
  - synthesis
  - memory extraction
- Prompt linkage for the production chat prompts:
  - chat system prompt
  - intent classifier prompt
  - conversation title prompt
  - memory extraction prompt
- Prompt fallback behavior if Langfuse is unavailable or a label is missing.
- Dual-write trace persistence in Supabase via `conversation_turn_traces`.
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

The repo keeps prompt fallbacks in code and treats Langfuse as the runtime source of truth.

1. Sync the repo prompts into Langfuse:

```bash
npm run langfuse:sync-prompts
```

2. Review or relabel the synced versions in Langfuse.

3. Production chat reads by label. If that fetch fails, the app falls back to the in-repo prompt text and marks the trace as fallback-backed.

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

## Dataset seeding

Seed the two baseline datasets:

```bash
npm run langfuse:seed-datasets
```

Default datasets:

- `hair-concierge-curated-chat-evals`
- `hair-concierge-production-chat-triage`

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

Use the shared review rubric in [docs/chat-quality-review-rubric.md](/Users/nick/AI_work/hair_conscierge/.worktrees/langfuse-quality-loop/docs/chat-quality-review-rubric.md:1) so manual review, thumbs feedback, and eval metrics stay aligned.

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
