# Hair Concierge Plan Format

Use the smallest durable plan that makes implementation and verification unambiguous. Combine related sections; these are coverage prompts, not a requirement for ten separate headings or a new approval ceremony.

## Plan contents

1. **Outcome and source context** — link the approved spec, decision, issue, or research artifact when one exists.
2. **Chosen direction** — describe one path in plain language.
3. **Scope and non-goals** — name what changes and what must remain unchanged.
4. **Target map** — list concrete files when known; otherwise name repository surfaces and explain how implementation will locate the exact files.
5. **Decision coverage** — record status `pending` or `confirmed`; include `Confirmed with Nick`, `Inherited from evidence or contract`, `Implementation defaults`, and `Open consequential assumptions`. Mark every open item `resolve before handoff` or `parked out of scope` with its affected work. A parked item requires Nick's explicit acknowledgement. Add `Coverage acknowledgement` with the original user acknowledgement/request and approved scope, plus separate `Internal revalidation` for the current revision. Apply the existing-authorization rule in the owning skill; record approval of the choices without requiring separate approval of this record. Never invent a new user acknowledgement. A confirmed handoff states `Undiscussed consequential assumptions affecting this handoff: none`.
6. **Designed user journey** — describe the actor, entry condition, ordered user-visible steps and decisions, system responses, error/recovery states, meaningful variants, and completion state. For non-user-facing work, describe the operator/integration outcome in the approved contract and state that no surface, copy, timing, or user-visible feedback changes. Separate walkthrough/sign-off is needed only to settle a consequential choice absent from that contract.
7. **Planning evidence** — when required by `AGENTS.md`, link the annotated screenshot, wireframe, rendered HTML, compared variants, or conditional runnable prototype; name the question each artifact answered, the selected direction, feedback incorporated, and evidence-review status. For non-user-facing work, state why no user-facing evidence is required; link a logic prototype when one settled an implementation decision.
8. **Ordered tasks** — each task is the smallest independently testable deliverable a reviewer could meaningfully accept or reject. Fold setup, fixtures, documentation, and configuration into the deliverable that needs them. Each task ends with a checkable completion criterion and names tests or fixtures to add or change.
9. **Verification** — separate automated checks, manual/browser checks, migration or live-state checks, and evidence-sensitive review. Derive user-facing acceptance checks from the designed journey and reviewed mockup.
10. **Review and handoff** — identify branch/worktree expectations, review gates, rollout risks, decision-coverage and sign-off status, artifact disposition, and the stop point before publication.

## Rules

- Put the chosen plan in the task worktree under `plans/` and include it in the PR.
- Classify every task-owned artifact as `commit`, `archive`, or `discard`; leave none unresolved at handoff.
- Keep external evidence distinct from current internal recommendation behavior unless reconciliation was explicitly requested.
- Avoid speculative abstractions, placeholder tasks, and alternatives that were already rejected.
- For new flows or material UX changes, link concrete evidence and journey approval under `AGENTS.md`. One approval of the concrete proposal suffices; reuse it after review unless the proposal changes materially. For an existing surface, use a contextual screenshot or rendered artifact rather than detached prose. Record any prototype's question, finding, and disposition.
- For exact routine edits, an already reviewed design, or internal work, record the applicable request/approval or why separate evidence/journey sign-off is not required. Derive verification from the requested result.
- Revalidate decision coverage after counterpart review and every material plan revision. A newly introduced consequential choice returns coverage to `pending`; unchanged approved choices retain `confirmed` and the original user acknowledgement; record the current revision under internal revalidation.
- Make migrations, auth, billing, privacy, medical-adjacent guidance, and irreversible actions explicit when in scope.
- A task such as “update the service” is incomplete; name the behavior, likely seam, regression guard, and proof of completion.
- For dependent tasks, record `Consumes` and `Produces` with the exact interface, artifact, signature, event, or value that crosses the boundary. Keep shared exact values in one authoritative section instead of repeating them in several tasks.

## Self-review before counterpart review

- **Coverage:** every approved requirement and meaningful recovery state maps to a task or explicit non-goal.
- **Decision coverage:** no product-relevant choice is hidden as a technical default; every consequential assumption is explicitly recorded, and each open decision names whether it must be resolved before handoff or may be parked with its affected work out of scope.
- **Placeholders:** no `TBD`, vague “handle edge cases,” unnamed tests, or unresolved implementation choice remains outside the explicitly tracked Decision coverage record.
- **Consistency:** types, signatures, names, IDs, events, and exact values agree across tasks and source evidence.
- **Order:** dependency order matches each task's `Consumes` and `Produces`; no task assumes an artifact that does not yet exist.
- **Scope:** independently shippable subsystems have separate plans, while inseparable setup stays with its deliverable.
