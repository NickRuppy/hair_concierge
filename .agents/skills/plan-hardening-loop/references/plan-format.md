# Hair Concierge Plan Format

Use the smallest durable plan that makes implementation and verification unambiguous.

## Required sections

1. **Outcome and source context** — link the approved spec, decision, issue, or research artifact when one exists.
2. **Chosen direction** — describe one path in plain language.
3. **Scope and non-goals** — name what changes and what must remain unchanged.
4. **Target map** — list concrete files when known; otherwise name repository surfaces and explain how implementation will locate the exact files.
5. **Designed user journey** — describe the actor, entry condition, ordered user-visible steps and decisions, system responses, error/recovery states, meaningful variants, and completion state. For backend-only work, describe the operator or integration journey and explicitly state that no end-user journey changes.
6. **Planning evidence** — for user-facing work, link the annotated screenshot, wireframe, rendered HTML, compared variants, or conditional runnable prototype; name the question each artifact answered, the selected direction, feedback incorporated, and evidence-review status. For backend-only work, state why no user-facing evidence is required; link a logic prototype when one settled an implementation decision.
7. **Ordered tasks** — each task ends with a checkable completion criterion and names tests or fixtures to add or change.
8. **Verification** — separate automated checks, manual/browser checks, migration or live-state checks, and evidence-sensitive review. Derive user-facing acceptance checks from the designed journey and reviewed mockup.
9. **Review and handoff** — identify branch/worktree expectations, review gates, rollout risks, sign-off status, artifact disposition, and the stop point before publication.

## Rules

- Put the chosen plan in the task worktree under `plans/` and include it in the PR.
- Classify every task-owned artifact as `commit`, `archive`, or `discard`; leave none unresolved at handoff.
- Keep external evidence distinct from current internal recommendation behavior unless reconciliation was explicitly requested.
- Avoid speculative abstractions, placeholder tasks, and alternatives that were already rejected.
- Mark evidence review as `pending` for every user-facing change until Nick has seen the relevant artifact and its feedback is incorporated. For an existing surface, require an annotated current/proposed screenshot or rendered artifact in the real layout; do not treat Markdown, ASCII, detached copy samples, or prose-only visual descriptions as mockups. When a runnable prototype was used, record its question, decision criterion, finding, and disposition.
- Mark user-journey sign-off as `pending` until the post-review walkthrough is explicitly confirmed. Record confirmed corrections in the plan before changing it to `confirmed`.
- Make migrations, auth, billing, privacy, medical-adjacent guidance, and irreversible actions explicit when in scope.
- A task such as “update the service” is incomplete; name the behavior, likely seam, regression guard, and proof of completion.
