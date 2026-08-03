---
name: prototype
description: Build the lightest runnable UI or logic artifact needed to resolve a specific planning decision. Use from plan-hardening-loop or an exploratory workflow when discussion, screenshots, wireframes, or static HTML cannot validate interaction, responsive behavior, state transitions, data shapes, or API boundaries. Keep ordinary static mockups in plan-hardening-loop and production execution in implementation-loop.
---

# Prototype

A prototype is disposable evidence for one decision. It is a conditional helper inside planning, not a separate mandatory phase.

## 1. Name the question

Before writing code, record:

```text
Question: what must this prototype answer?
Shape: UI or logic
Decision criterion: what observation will settle the question?
Disposition: what will be retained, rewritten, or discarded?
```

Return to ordinary planning when conversation or a lighter mockup can answer the question. Build only when interaction makes the uncertainty materially easier to judge.

Use the existing task worktree. If none exists, run `branch-gate` and establish one before creating repository-backed prototype artifacts.

## 2. Choose the shape

### UI prototype

Use for interaction, responsive behavior, information hierarchy that changes through use, or a visual fork that static artifacts cannot settle.

- Embed the prototype in the real product surface when possible; preserve representative data density, navigation, and surrounding context.
- Create 2-3 structurally different variants when a meaningful fork remains. Vary hierarchy or interaction, not decoration alone.
- Use realistic German UI copy and representative mobile dimensions.
- Include critical loading, empty, error, confirmation, and recovery states when they affect the decision.
- Keep the experience read-only or route mutations to explicit stubs.
- Make variants directly switchable and provide one URL or command that runs the artifact.

### Logic prototype

Use for state transitions, business rules, data shapes, or an interface whose behavior is difficult to judge on paper.

- Put the decision logic behind a small pure interface.
- Add the smallest interactive shell that can drive realistic and adversarial cases.
- Keep state in memory unless persistence is the question under investigation.
- Show the full relevant state after every action.
- Use project-native tooling and provide one command that runs the artifact.

## 3. Keep prototype constraints explicit

- Optimize for learning speed, not production completeness.
- Add only the error handling and polish required to evaluate the question.
- Keep production services, credentials, customer data, analytics, and real mutations outside the artifact.
- Treat prototype code as non-production even when one variant wins.
- Reimplement retained deterministic logic through the repository's test-first production workflow.

## 4. Review and capture the answer

Let the user operate or inspect the artifact. Iterate only where feedback bears on the named question.

When the question is settled, record:

- the answer and supporting observation
- the selected variant or behavior
- rejected alternatives and why they lost, when that context prevents rework
- implications for the plan and designed user journey
- artifact disposition

Keep durable decision evidence with the task. Remove prototype-only routes, switchers, shells, stubs, and losing variants from the production implementation. Never promote the prototype directly to production.
