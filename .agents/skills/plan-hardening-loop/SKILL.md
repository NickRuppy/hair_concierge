---
name: plan-hardening-loop
description: Use for Hair Concierge when the user wants to create, grill, harden, or review a non-trivial implementation plan, compare meaningful architecture or UX options, create mockups or conditional runnable prototypes for user-facing work, obtain a counterpart-model review, align the designed user journey before implementation, or continue from a Wayfinder handoff. For user-facing work, this skill ends only after evidence review and explicit user-journey sign-off; every plan ends at an approved implementation handoff. Use `$wayfinder` first only when Nick explicitly invokes it and dependent decisions prevent an implementation outcome or scope from being stated. Use implementation-loop for execution.
---

# Plan Hardening Loop

Turn fuzzy intent or an existing plan into one chosen, evidence-grounded implementation handoff.

## Boundary

- This skill owns discovery, options, decisions, user-facing evidence, plan writing, counterpart review, user-journey sign-off, and revision.
- It does not implement the plan. Handoff execution to `implementation-loop`.
- It accepts a Wayfinder handoff once the planning contract can be stated. If dependent decisions still prevent that, explain the boundary and offer explicit `$wayfinder` invocation instead of silently switching workflows.
- Keep external evidence, internal product logic, and reconciliation separate as defined in `AGENTS.md`.
- Do not use it for a tiny non-user-facing change that does not need a durable plan. Any user-facing change still uses the mockup and journey gates even when the eventual code diff is small.

## 1. Establish the planning contract

Inspect the relevant repository context and any Wayfinder map first. Then establish:

```text
Outcome: what will be different
Constraints: what must remain true
Non-goals: what is excluded
Done when: evidence required for an implementation-ready plan
```

Ask only for missing information that local context cannot answer. Acknowledge the contract and continue without seeking ceremonial confirmation unless an assumption changes scope.

Before writing a persistent plan or mockup, use `branch-gate` and create or reuse the task worktree. Keep all durable task artifacts there.

Completion criterion: outcome, constraints, non-goals, and done-when evidence are concrete enough to reject an unsuitable approach.

## 2. Grill the consequential decisions

Use one high-leverage question at a time. For architecture, UX, data ownership, rollout, verification, risk, or scope forks, present 2-3 similarly scoped options:

| Option | Plain meaning | What gets easier | What gets harder | Best when |
| ------ | ------------- | ---------------- | ---------------- | --------- |

Recommend one option when the evidence supports it. After every 2-4 substantive decisions, checkpoint what is settled, what remains open, and the likely direction.

Completion criterion: every consequential fork has one chosen direction or one explicit unresolved user decision.

## 3. Make consequential behavior concrete

For any user-facing work, create at least one reviewable mockup during planning and show it to the user before finalizing the plan. Do this even for apparently small copy, hierarchy, spacing, state, or interaction changes; put the proposal in context instead of asking the user to imagine it from prose.

State the decision the artifact must resolve, then choose the lightest evidence that makes it real:

- annotated current/proposed screenshot for a small change to an existing surface
- wireframe for information hierarchy or a multi-step flow
- rendered lightweight HTML for layout or responsive behavior
- 2-3 comparable mockup variants when a meaningful visual fork remains
- the `prototype` skill only when interaction, changing state, or a logic model cannot be judged reliably from a static artifact

Do enough grilling to name the prototype question and its decision criterion before invoking `prototype`. A prototype is a higher-fidelity branch of this mockup step, not an opening phase or an automatic requirement. Use its UI branch for interactive or stateful experience questions and its logic branch for state transitions, business rules, data shapes, or interface behavior. Return the prototype's answer to this loop, record the selected behavior in the plan, and require production implementation to rewrite retained behavior with normal tests and safeguards.

For backend-only planning, skip the user-facing mockup ladder. Invoke `prototype` only when operating a logic model will settle a consequential implementation decision more reliably than discussion or a static diagram.

Ground mockups in the actual product surface when one exists. Inspect and capture the current surface first, then annotate that screenshot or recreate the proposed state as rendered lightweight HTML. For copy-only changes, show the before/after wording inside the real component layout at a representative viewport. A Markdown quote, ASCII sketch, detached copy sample, or prose description does not count as a mockup for an existing surface.

Use realistic content and German UI copy. Show mobile and desktop when the experience materially differs, and include loading, empty, error, confirmation, or recovery states when they affect comprehension or trust.

Mockups and prototypes are planning artifacts, not production implementation. Keep durable decision evidence in the task worktree and transient previews outside the repository. Present the relevant evidence to the user, incorporate feedback, record what it proved, and record the selected direction in the plan. Purely backend work may skip user-facing evidence only when the plan explicitly states that no user-facing surface, copy, timing, or feedback changes.

Completion criterion: the user has seen or operated the relevant experience, feedback and prototype findings are reflected in the chosen direction, and evidence review is recorded as confirmed for user-facing work. Any logic prototype also has its finding and disposition recorded.

## 4. Write or update the plan

Read `references/plan-format.md`, then create or patch the plan under `plans/` in the task worktree. Preserve only the chosen path.

Completion criterion: the plan contains concrete files or repository surfaces, scope boundaries, ordered tasks, automated and manual verification, review gates, and an execution handoff.

## 5. Run one counterpart review lane

Select the counterpart reviewer according to `AGENTS.md`. The reviewer is advisory and read-only. Keep its transient output outside the repository unless the plan intentionally retains it.

Maintain a findings ledger for material findings:

| ID  | Type | Evidence | Decision | Plan change | Revalidation |
| --- | ---- | -------- | -------- | ----------- | ------------ |

Classify `Type` as `defect`, `tradeoff`, or `scope/product decision`. Classify `Decision` as `accepted`, `rejected`, `deferred`, or `needs user decision`.

- Accept technical defects only after verifying them against the repository.
- Never silently accept a product, scope, architecture, or risk tradeoff on the user's behalf.
- Rerun the counterpart only after material blocker-driven changes, multiple concrete implementation traps, or an explicit user request. Do not rerun for a cleaner approval sentence.

Completion criterion: every material finding is classified, supported or rejected by evidence, and reflected in the plan or an explicit open decision.

## 6. Confirm the designed user journey

After the plan and counterpart findings are reconciled, translate the chosen design back into the experience the user will actually have. Add or update the plan's **Designed user journey** section, then present the same journey to the user for explicit confirmation.

Describe the journey from the user's perspective, not as an implementation checklist:

1. actor and entry condition
2. ordered user-visible steps, decisions, and system responses
3. important loading, empty, error, fallback, and recovery states
4. meaningful variants such as entitlement, device, prior state, or user choice
5. completion state and what the user sees or can do next

Link the reviewed mockups or screenshots for every user-facing change and ensure the narrated journey matches them. Keep invisible backend work outside the journey unless it changes timing, feedback, trust, or available actions. For a feature with no end-user surface, present the equivalent operator or integration journey and state explicitly that no end-user journey changes.

Ask whether this journey exactly matches the user's intent. A general approval given before this walkthrough does not count as journey sign-off. Do not hand off to implementation while sign-off is pending.

If the user corrects the journey:

- update the journey, plan tasks, acceptance criteria, and verification together
- return to counterpart review only when the correction materially changes architecture, data flow, scope, risk, or earlier review assumptions
- present the revised journey again and obtain explicit confirmation

Completion criterion: the plan records the exact confirmed journey and marks user-journey sign-off as confirmed; no implementation-relevant journey assumption remains implicit.

## 7. Hand off cleanly

The loop is done when the chosen direction is explicit, blockers are resolved or exposed as user decisions, required mockups have been reviewed, the designed user journey has explicit sign-off, the plan is executable, and verification is checkable.

Report:

- plan path
- review artifact path, if intentionally retained
- accepted, rejected, deferred, and decision-required findings
- evidence review status and selected artifact or direction
- user-journey sign-off status and any corrections incorporated
- residual risks
- artifact disposition: commit, archive, or discard
- recommended `implementation-loop` kickoff

Do not create a formal Goal merely because the plan is ready. Goal selection belongs to `implementation-loop` and remains opt-in.
