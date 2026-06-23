---
name: plan-hardening-loop
description: Use for Hair Concierge whenever the user mentions creating, hardening, reviewing, or executing an implementation plan; when they ask to be grilled before a plan; or when a plan should be reviewed with Claude and revised until it has a clean implementation handoff.
---

# Plan Hardening Loop

## Purpose

Turn fuzzy intent or an existing plan into a clean, reviewed implementation handoff with fewer manual prompts from the user.

This skill is a loop packaged as a skill:

- The skill is the reusable Codex workflow.
- The loop is the procedure inside it: grill, compare options, plan, review, revise, and repeat until ready or blocked on a real decision.

## Trigger

Use this skill when the user asks to:

- create a plan, write a plan, harden a plan, or review a plan
- "grill me" before planning
- run Claude on a plan and incorporate findings
- make a plan ready for subagent execution or implementation handoff
- implement a written plan, start subagent-driven implementation, or continue from a finalized plan

Do not use it for tiny implementation changes that do not need a written plan.

## Operating Rules

- Keep external evidence, internal product logic, and reconciliation lanes separate according to `AGENTS.md`.
- Inspect relevant code/docs before asking questions when local context can answer them.
- When the kickoff prompt is rough, run the intake interview before starting the autonomous loop.
- Before implementing a written plan, establish an implementation goal contract before editing files.
- Ask plainly for factual details.
- Present 2-3 options only for meaningful forks: architecture, UX direction, data ownership, rollout, verification, risk posture, or scope boundary.
- Explain tradeoffs in simple language. Avoid abstract labels that hide the practical cost.
- Prefer comparing elegant architectures at similar scope over comparing "tiny vs medium vs huge" by default.
- Recommend one option when evidence is strong, and say why in plain language.
- Stop for the user only when initial loop terms are missing, or when a product decision, risk acceptance, or scope choice cannot be made from local context.
- Do not let Claude review output automatically rewrite product intent. Codex owns judgment and must classify findings.

## Step 1: Intake Interview

Before starting a more autonomous loop, make sure the loop is set off on the right terms.

If the user's kickoff already includes a clear goal, constraints, and done-when criteria, summarize them and continue. If any are missing or fuzzy, interview the user before planning.

Ask one question at a time, in this order:

1. Goal: what should be different when this is done?
2. Context: which files, flows, users, examples, or current pain matter?
3. Constraints: what must stay unchanged, what risks matter, and what conventions apply?
4. Non-goals: what should this explicitly not include?
5. Done when: what evidence proves the loop is ready for implementation handoff?

Use short, simple questions. Offer a recommended default when the likely answer is visible from local context, but do not invent product intent.

After intake, restate the loop contract:

```text
Goal: ...
Constraints: ...
Non-goals: ...
Done when: ...
```

Ask for confirmation only if the contract changes scope or contains a meaningful assumption. Otherwise continue into the grill.

## Step 2: Align And Grill

Use `plan-grill` behavior:

1. Identify the user goal, context, constraints, non-goals, and "done when".
2. Ask one high-leverage question at a time.
3. After every 2-4 substantive questions, checkpoint settled decisions, remaining risks, and likely next step.
4. For each meaningful fork, present 2-3 options before asking the user to choose.

Option comparisons should use this shape:

| Option | Plain meaning | Why it is elegant | Tradeoff | Best when |
| --- | --- | --- | --- | --- |
| A: Name | What this means in normal language | Boundary, data flow, UX, or maintenance strength | The real cost or risk | When this condition is true |
| B: Name | ... | ... | ... | ... |

Then add:

```text
My recommendation: <option>. <One or two plain-language sentences explaining why.>
```

## Step 3: Visual Options For UI Work

When a decision is frontend, visual, or UX-facing, do not ask the user to choose from prose alone if layout, hierarchy, copy density, interaction shape, or emotional tone matters.

Create 2-3 lightweight HTML mockups before asking for a decision. Use repo-local scratch space such as `.tmp-previews/` or the existing brainstorming preview convention. Mockups may be static, but they must make the choice visible enough for the user to compare.

Use mockups for:

- onboarding and quiz screens
- result, offer, paywall, and checkout-adjacent surfaces
- chat UX, prompt cards, feedback UI, and response presentation
- emails or share artifacts where hierarchy and copy density matter

Do not create mockups for purely backend, data, or test-architecture choices.

## Step 4: Write Or Update The Plan

When the direction is chosen:

1. Use the repo's plan conventions from `AGENTS.md`.
2. Put implementation plans in `plans/` unless the user or existing artifact uses a more specific accepted location.
3. Include source context, chosen direction, explicit non-goals, target file map, task checklist, verification, review gates, and handoff instructions.
4. Plan one chosen path only. Do not preserve rejected options as parallel implementation tracks.
5. Make assumptions and deferred decisions visible.

If the plan already exists, patch it instead of rewriting from scratch unless it is structurally unusable.

## Step 5: Claude Review Loop

Use `claude-plan-review` for second-opinion review when available.

After Claude returns:

1. Read the generated review.
2. Classify each material finding:
   - `accepted`: plan should change
   - `rejected`: finding is not supported by local evidence or conflicts with product intent
   - `deferred`: valid but out of scope for this plan
   - `needs user decision`: product/risk choice Codex should not make alone
3. Patch accepted findings into the plan.
4. Record rejected/deferred findings briefly in the plan or handoff only when future implementers need the context.
5. Ask the user only for `needs user decision` findings.

Rerun Claude only when:

- a blocker finding caused material plan changes
- the review found multiple concrete implementation traps
- the user asks for another pass

Do not rerun Claude just to get a nicer approval sentence after small wording changes.

## Step 6: Clean Handoff

The loop is complete when:

- the chosen direction is explicit
- blocking review findings are fixed or converted into explicit user decisions
- the plan has concrete file paths, verification, and review gates
- remaining risks are named without hiding them
- the next execution path is clear

End with:

- plan path
- review file path, if any
- accepted/rejected/deferred findings summary
- unresolved decisions or risks
- recommended next skill or command
- whether to use a worktree, Goal mode, subagents, or sequential execution

## Goal Mode Guidance

Use Goal mode for execution after the plan is hardened, not for early brainstorming.

Before any plan implementation edits, create or restate an implementation goal contract. A short user message such as "good, implement", "go", or "do subagent-driven implementation" after plan approval is not enough by itself; treat it as permission to start the implementation kickoff, then anchor the work.

Good goal shape:

```text
/goal Implement <plan-path> in a repo-local worktree. Keep the plan checklist updated, preserve unrelated changes, run the listed verification, run autoreview after checks, and stop before commit/push/PR for explicit approval.
```

If Goal mode is available, set this as the active goal before edits. If the current surface cannot set a formal goal, print the contract under `Implementation Goal Contract` and follow it as the controlling objective.

The implementation kickoff must include:

- plan path and current branch/worktree
- whether a formal goal is active, or the fallback contract text
- branch-gate decision and dirty-state classification
- execution mode: sequential, subagent-driven, or mixed
- subagent write scopes, if any
- required final checks from the plan
- explicit stop line before staging, committing, pushing, PR creation, merge, deploy, or cleanup

If the goal is still fuzzy, continue the hardening loop instead of starting Goal mode.

## Orchestrator Guidance

For large initiatives, recommend one orchestrator thread. The orchestrator owns decisions, plan status, review findings, branches/worktrees, verification state, and final handoff.

The orchestrator may spawn subagents in the same working session for bounded tasks, or ask the user to create separate Codex threads for longer independent streams. Prefer subagents for read-heavy exploration, review lenses, and disjoint implementation slices. Avoid defaulting to subagents for small or tightly coupled work.

Subagent prompts should define:

- one concrete question or owned file slice
- whether the subagent may edit files
- what summary to return
- what evidence or file references are required

## User Testing And Quality Suite Follow-up

If the plan affects user-facing behavior, recommend a separate quality loop when appropriate:

- browser or Chrome-based simulated user review
- Computer Use only when full desktop interaction is required
- fixed chat/recommendation prompt set
- rubric-based pass/review/fail report
- regression comparison before shipping broad answer-behavior changes

Do not bundle the full prompt quality suite into this planning loop unless the user's task is specifically to build that suite.
