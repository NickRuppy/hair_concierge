# Chaarlie — Project Instructions

## Role of this file

`AGENTS.md` routes Hair Concierge work. Repo-owned skills live under `.agents/skills`; companion personal workflow skills may live under `~/.codex/skills`. Prefer the smallest skill set that covers the task and state the chosen skills and order when it matters. If a referenced personal skill is unavailable, use the closest built-in equivalent or apply the named gate directly from this file; do not fail solely because a personal profile is missing, and never skip an explicit approval boundary.

## Core workflow

```text
plan-hardening-loop -> implementation-loop (ready-check -> request-code-review) -> ship-it
```

- `plan-hardening-loop` owns non-trivial planning, meaningful option comparison, user-facing mockups, counterpart plan review, revision, and a final designed-user-journey walkthrough. For user-facing work it stops only after Nick has reviewed the mockup and explicitly confirmed the journey.
- `implementation-loop` owns execution of an approved plan or clearly bounded non-trivial change. It invokes `ready-check` and `request-code-review` before its review-ready handoff; do not rerun them as separate top-level phases on unchanged content.
- `ready-check` owns repository and user-flow verification.
- `request-code-review` is the single local review router. Do not separately stack `code-reviewer`, thermo review, and other general review skills unless it delegates those lenses.
- `ship-it` owns explicitly authorized publication branches. “Ship it” means commit, push, and draft PR; cleanup, merge, deployment, and production writes each require separate authorization.

### Goal versus loop

- A **Goal** is the durable outcome that should remain stable across turns.
- A **plan** is the editable set of steps toward that outcome.
- A **loop** is a reusable procedure encoded in a skill.

Use formal Goal mode only when the user explicitly asks for it and the implementation is likely to span several turns, resumptions, or a long autonomous sequence. Before creating one, inspect any active goal. Formal Goal mode supplements the compact implementation contract; it does not replace it. For normal one-turn implementation work, use the contract and a short working plan. Quick audits, questions, routine queue passes, small fixes, and recurring automations need neither.

## Domain skills

### `hair-care-expert`

Use for external hair-care research, evidence-sensitive rules, myth or overreach audits, medically adjacent boundaries, and evidence review of rough specs. Keep external evidence independent from internal methodology unless the user explicitly asks for reconciliation. It is valid to conclude that evidence is weak or inconclusive.

### `category-specific-recommendation`

Use to redesign, specify, or implement one product category at a time: explicit questions, deterministic mappings, fallback rules, response metadata, and tests. Use `hair-care-expert` first only when new external evidence is requested; preserving current internal recommendation behavior does not require external research.

### `product-intake`

Use for product-intake research, review-center operations, image work, rework, worker debugging, publish preflight, and guarded final handoff. `docs/product-intake-research-ops.md` is the source of truth; automation prompts must not restate its policy. For a stuck worker, start with `product-intake` alone to inspect job, queue, and lock state; add `diagnosing-bugs` only after evidence identifies a reproducible code defect. Keep diagnosis read-only; retry, requeue, cancel, or clear a lock only with explicit approval.

## Planning decisions

For non-trivial plans, present 2-3 similarly scoped approaches only for meaningful product, architecture, UX, data, rollout, verification, risk, or scope forks. Explain what gets easier, what gets harder, and the residual risk. Let the user choose when local evidence cannot settle the fork.

For every user-facing change, inspect the current product surface and create at least one reviewable mockup during planning. Use the lightest useful format: an annotated screenshot for a small existing-surface change, a wireframe for a new hierarchy or flow, or rendered lightweight HTML for layout and interaction. For copy-only work on an existing surface, show the before/after copy inside the real component layout. Show 2-3 variants for meaningful visual forks, use realistic German copy, and include responsive or critical error/loading states when they materially affect the experience. Markdown, ASCII, detached copy samples, and prose-only descriptions do not count as mockups for an existing surface.

Before implementing a user-facing plan, record the reviewed mockup and incorporated feedback, then translate the final design into the concrete user journey and walk Nick through it once more. Include entry state, ordered user actions and system responses, error/recovery states, meaningful variants, and completion. Require confirmed mockup review and explicit journey sign-off; earlier general plan approval does not satisfy either gate.

## Orchestration

The main session owns user intent, product and architecture decisions, decomposition, worktree and write-scope decisions, integration, final verification, and the user-facing handoff.

Delegate only bounded, independently executable work when parallelism materially helps or when noisy exploration would harm the main context. Prefer:

- `fast_explorer` for read-only mapping, research, and log or test-output analysis
- `routine_worker` for well-specified mechanical edits and test-fixing to a known oracle
- `judgment_worker` for German copy, UX/taste calls, ambiguous implementation, and tricky deterministic logic

Every delegated brief must state the objective, context, owned files or question, edit permission, constraints, non-goals, acceptance checks, and expected evidence. Parallel writers need disjoint scopes. The main session reviews every result and runs final verification.

## Counterpart-model review

Use exactly one external counterpart lane per review pass:

- When Codex is the orchestrator, use `claude-plan-review` for non-trivial plan review, meaningful whole-branch review before push, and independent judgment when stuck.
- When Claude or Fable is the orchestrator, use the configured Codex review agent for those same checkpoints.

The reviewer is read-only and terminal: it returns a verdict and must not invoke another reviewer. The orchestrator verifies findings locally, rejects false positives, and retains the final decision. Do not run counterpart review for trivial fixes, routine exploration, every worker result, or merely to obtain a cleaner approval sentence. Do not silently convert reviewer-proposed product, scope, architecture, or risk tradeoffs into decisions.

## Project conventions

- All UI text is in German.
- Vocabulary: `hair_texture` = pattern (straight/wavy/curly/coily); `thickness` = diameter (fine/normal/coarse).
- No over-engineering: build only what is requested and avoid speculative abstractions.
- Use test-first development for deterministic logic in `src/lib/routines/`, `src/lib/rag/router/`, and `src/lib/quiz/`.
- Keep recommendation logic as deterministic as the evidence allows.
- Do not present weak evidence as a hard rule.
- Separate cosmetic guidance from medically adjacent scalp or hair-loss guidance.
- When evidence is mixed, keep product behavior conservative and explicit about uncertainty.
- Supabase project ID: `pqdkhefxsxkyeqelqegq`.

## Git workflow

- Default to repo-local worktrees for implementation, fixes, and parallel investigations.
- Keep the root checkout as the stable base; do not switch it in place unless the user explicitly asks.
- Create `.worktrees/<slug>` on `codex/<slug>` from fresh `origin/main` when available.
- Use `npm run worktree:new -- <slug>` and `npm run dev:worktree`.

## Working outputs

- Put implementation plans in `plans/`.
- Put reusable project docs in `docs/`.
- Only add to `questions-for-domain-review.md` when internal domain review is genuinely required and external evidence or repository context cannot resolve the question.
