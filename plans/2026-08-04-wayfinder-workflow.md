# Wayfinder workflow

## Outcome and source context

Add an explicit `$wayfinder` entry for Hair Concierge work whose direction is too open-ended for an implementation plan. It should turn uncertainty into a small Linear decision map, then hand the chosen direction to `$plan-hardening-loop`.

## Chosen direction

Adapt the useful parts of Matt Pocock's Wayfinder to the existing workflow: destination, decision tickets, dependencies, current frontier, and fog-of-war tracking. Keep Linear as the durable map and keep the skill explicit-only. Use it only when the destination is nameable but the implementation outcome or scope cannot yet be stated without resolving dependent decisions. Use `$prototype` only when runnable evidence is the lightest way to settle one decision.

## Scope and non-goals

Change the repository workflow guidance, add the `wayfinder` skill and UI metadata, and add the boundary/handoff to `plan-hardening-loop`. Do not run Wayfinder, create Linear issues, change product code, add an implementation backlog, or implement `improve-codebase-architecture`.

## Target map

- `.agents/skills/wayfinder/`: new skill and explicit-only metadata.
- `.agents/skills/plan-hardening-loop/SKILL.md`: accept the Wayfinder handoff and reject work that is still too undefined.
- `AGENTS.md`: route explicitly invoked open-ended work through Wayfinder before the normal loop. Keep the change Codex-only; do not alter Claude's separate skill tree.

## Designed operator journey

1. Nick explicitly invokes `$wayfinder` for a genuinely open-ended outcome.
2. Codex inspects context and drafts a destination plus the first decision frontier; Nick confirms the map before Linear is mutated.
3. Each session resolves one unblocked decision using grilling, research, or—only when needed—`$prototype` evidence. The Linear map records decisions and remaining fog.
4. When the direction is concrete enough to plan, Wayfinder produces a concise handoff and invokes `$plan-hardening-loop` for the normal implementation plan, evidence, review, and sign-off gates.
5. If the work is already plan-shaped, Codex skips Wayfinder and starts with `$plan-hardening-loop`.

No end-user journey changes; this affects only the planning/operator workflow.

## Planning evidence

No user-facing mockup is required. The operator journey above captures the agreed workflow from this conversation. Operator-journey sign-off is confirmed by Nick's instruction to implement Wayfinder.

## Ordered tasks

1. Create the skill with concise entry, mapping, resolution, and exit rules.
2. Add explicit-only invocation metadata.
3. Update the core-workflow routing in `AGENTS.md` and the plan-hardening boundary.
4. Validate metadata, forward-test routing on two concrete prompts, and run repository-relevant checks and review.

## Verification

- Run the skill validator.
- Check all workflow references and the final diff.
- Forward-test “Explore what the personal hair plan should become” and require a Wayfinder decision-map response.
- Forward-test “Plan the approved personal-plan navigation redesign” and require a direct plan-hardening response.
- Run the repository readiness and review gates required for workflow-only changes.

## Review and handoff

Use one read-only Claude plan review before implementation and the normal final review lane on the complete branch. Commit the skill, router changes, and this plan; discard transient reviewer output. Stop before commit or publication unless separately authorized.

Plan-review findings:

| ID | Type | Decision | Plan change | Revalidation |
| --- | ---- | -------- | ----------- | ------------ |
| P1 | defect | accepted | Define the intake test separating Wayfinder from plan hardening. | Forward-test both routes. |
| P2 | scope/product decision | accepted | Keep Wayfinder Codex-only; remove the `CLAUDE.md` change. | Inspect final target map. |
| P3 | defect | rejected | `agents/openai.yaml` is required by the current skill-creator instructions. | Generate and validate it. |
| P4 | defect | rejected | `quick_validate.py` is provided by `skill-creator`, outside the repository. | Run it against the new skill. |

Verification evidence:

- Skill structure and YAML: passed `quick_validate.py` and independent YAML parsing.
- Open-ended probe: selected Wayfinder and drafted a decision frontier without mutation.
- Plan-shaped probe: declined Wayfinder and selected `plan-hardening-loop`.
