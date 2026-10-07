---
name: plan-hardening-loop
description: Create or harden a Hair Concierge implementation plan through consequential decisions, evidence, and review. For review-only requests, return findings and missing gates without requiring implementation approval.
---

# Plan Hardening Loop

Turn fuzzy intent or an existing plan into one chosen, evidence-grounded implementation handoff.

## Boundary

- For plan creation or hardening, this skill owns discovery, options, decisions, user-facing evidence, plan writing, counterpart review, user-journey sign-off, and revision.
- For review-only requests, inspect the requested plan and relevant evidence, then return findings, unresolved choices, and missing implementation gates. Completing the assessment does not require revising the plan, obtaining sign-off, or implementing it. Use counterpart review only when required by `AGENTS.md` or explicitly requested.
- When planning is complete and execution is already authorized, continue directly with `implementation-loop`. A planning-only request ends with the plan and a concrete recommended next action.
- It accepts a Wayfinder handoff once the planning contract can be stated. If dependent decisions still prevent that, explain the boundary and offer explicit `$wayfinder` invocation instead of silently switching workflows.
- Keep external evidence, internal product logic, and reconciliation separate as defined in `AGENTS.md`.
- Use the proportional planning and evidence rules in `AGENTS.md`. Routine bounded work needs no planning ceremony; unresolved consequential choices return here.

## 1. Establish the planning contract

Inspect the relevant repository context and any Wayfinder map first. Then establish:

```text
Outcome: what will be different
Constraints: what must remain true
Non-goals: what is excluded
Done when: evidence required for an implementation-ready plan
```

If the outcome spans independently shippable subsystems, plan coherent slices while preserving the whole requested outcome. Splitting work does not authorize dropping or deferring a requested slice.

Ask only for missing information that local context cannot answer. Acknowledge the contract and continue without seeking ceremonial confirmation unless an assumption changes scope.

Before writing a persistent plan or mockup, use `branch-gate` and create or reuse the task worktree. Keep all durable task artifacts there.

Completion criterion: outcome, constraints, non-goals, and done-when evidence are concrete enough to reject an unsuitable approach.

## 2. Resolve consequential decisions

Ask only about unresolved consequential choices under `AGENTS.md`. Group related questions when it helps, explain meaningful alternatives, and recommend a direction. Choose routine details yourself.

Maintain a compact decision-coverage record with four buckets:

- **Confirmed with Nick:** product, experience, scope, and risk choices he explicitly approved.
- **Inherited from evidence or contract:** behavior uniquely determined by current product rules, repository authority, or supplied requirements, with no meaningful fork left; cite the determining source rather than asking ceremonially.
- **Implementation defaults:** routine technical choices with no meaningful product consequence.
- **Open consequential assumptions:** anything not yet confirmed where another choice could change user-visible behavior, product semantics, scope, data ownership, access or payment, rollout, recoverability, or material risk. Mark each item `resolve before handoff` or `parked out of scope` and name the affected work.

Track the record as `pending` only while a consequential choice affecting the work is unresolved; otherwise mark it `confirmed` using the original request, approved proposal, or determining contract. Nick approves choices, not the formatting of this record. Record the original authorization and scope, and separately note internal revalidation against the current plan and evidence. A new consequential choice blocks only dependent work. Park requested work only with Nick's agreement.

Do not treat a reviewer preference or evidence favoring one viable option as approval of an unresolved consequential choice. A confirmed handoff states `Undiscussed consequential assumptions affecting this handoff: none`; otherwise list the actual open decisions.

Compact example:

```text
Decision coverage: <pending|confirmed>
Confirmed with Nick: <consequential choices>
Inherited from evidence or contract: <determining sources>
Implementation defaults: <non-consequential choices only>
Open consequential assumptions: <none, or explicitly acknowledged parked work>
Undiscussed consequential assumptions affecting this handoff: <none, or list>
Coverage acknowledgement: <original user acknowledgement/request and approved scope>
Internal revalidation: <current revision/evidence checked; changes since acknowledgement>
```

Completion criterion: every known consequential fork has a chosen direction or is explicitly marked `resolve before handoff` or `parked out of scope` with its affected work, the record is current for this planning stage, and no consequential assumption is hidden inside an implementation default.

## 3. Make consequential behavior concrete

For new flows or material changes to the user experience, prepare concrete evidence under `AGENTS.md`. Present the proposal and journey together for approval. Reuse reviewed evidence for an unchanged design; exact routine edits need contextual verification rather than a new mockup ceremony.

State the decision the artifact must resolve, then choose the lightest evidence that makes it real:

- annotated current/proposed screenshot for a small change to an existing surface
- wireframe for information hierarchy or a multi-step flow
- rendered lightweight HTML for layout or responsive behavior
- 2-3 comparable mockup variants when a meaningful visual fork remains
- the `prototype` skill only when interaction, changing state, or a logic model cannot be judged reliably from a static artifact

Do enough grilling to name the prototype question and its decision criterion before invoking `prototype`. A prototype is a higher-fidelity branch of this mockup step, not an opening phase or an automatic requirement. Use its UI branch for interactive or stateful experience questions and its logic branch for state transitions, business rules, data shapes, or interface behavior. Return the prototype's answer to this loop, record the selected behavior in the plan, and require production implementation to rewrite retained behavior with normal tests and safeguards.

For non-user-facing planning, skip the user-facing mockup ladder. Invoke `prototype` only when operating a logic model will settle a consequential implementation decision more reliably than discussion or a static diagram.

Ground required mockups in the actual product surface when one exists: use an annotated screenshot or rendered proposal, with copy inside the real layout. Detached prose does not demonstrate the visual result.

Use realistic content and German UI copy. Show mobile and desktop when the experience materially differs, and include loading, empty, error, confirmation, or recovery states when they affect comprehension or trust.

Mockups and prototypes are planning artifacts, not production implementation. Keep durable decision evidence in the task worktree and transient previews outside the repository. Present the relevant evidence to the user, incorporate feedback, record what it proved, and record the selected direction in the plan. Purely non-user-facing work may skip user-facing evidence only when the plan explicitly states that no surface, copy, timing, or user-visible feedback changes.

Completion criterion: the relevant evidence is ready for the combined design/journey decision, or existing approval is linked. Record prototype findings and disposition. Pending approval blocks dependent implementation, not preparation or review of the proposal.

## 4. Write or update the plan

Read `references/plan-format.md`, then create or patch the plan under `plans/` in the task worktree. Preserve only the chosen path, include the current decision-coverage record, and complete its self-review before counterpart review.

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

Revalidate decision coverage after the review. A material finding that changes a consequential choice returns the record to `pending` until Nick confirms it. If findings change only technical defects or non-consequential defaults, update internal revalidation and retain `confirmed` with the original user acknowledgement.

Completion criterion: every material finding is classified, supported or rejected by evidence, reflected in the plan or an explicit open decision, and reconciled with current decision coverage.

## 6. Align on the concrete proposal

For new flows or material UX changes, describe the actor and entry state, ordered actions and system responses, meaningful variants, error/recovery states, and completion. Link the concrete mockup or prototype. Keep the presentation proportional to the decision.

Present the evidence, journey, and unresolved consequential choices together. One explicit approval of that concrete proposal supplies evidence review, journey sign-off, and decision coverage. It may happen before or after counterpart review: retain it if review changes only implementation details. Ask about material changes to the proposal, not an unchanged journey or reformatted plan. An approval given before seeing the relevant proposal does not settle unseen behavior.

For an already approved design, link the original evidence and approval. For exact routine changes or internal work, record separate journey sign-off as not applicable under `AGENTS.md` and verify the requested result. If the user gives a precise correction that leaves no consequential choice open, incorporate it without another confirmation; if it opens a new choice, ask about that choice and continue independent work.

Completion criterion: required design/journey decisions are settled, their evidence and authorization are recorded, and no consequential assumption is hidden.

## 7. Hand off cleanly

For plan creation or hardening, the loop is done when the chosen direction is explicit, decision coverage is current and `confirmed`, no item remains marked `resolve before handoff`, no open or undiscussed consequential assumption affects the handoff, blockers are resolved or explicitly parked out of scope, required mockups have been reviewed, required user-facing journey sign-off is explicit and internal outcomes have no unresolved consequential choices, the plan is executable, and verification is checkable. A review-only request instead ends with the assessment and any missing gates; it does not require implementation approval.

Report:

- plan path
- review artifact path, if intentionally retained
- decision-coverage status, Coverage acknowledgement, the required no-undiscussed-assumptions statement, and any decisions parked out of scope
- accepted, rejected, deferred, and decision-required findings
- evidence review status and selected artifact or direction
- user-journey sign-off status and any corrections incorporated
- residual risks
- artifact disposition: commit, archive, or discard
- next action: enter `implementation-loop` when execution is authorized; otherwise recommend the concrete kickoff

Do not create a formal Goal merely because the plan is ready. Goal selection belongs to `implementation-loop` and remains opt-in.
