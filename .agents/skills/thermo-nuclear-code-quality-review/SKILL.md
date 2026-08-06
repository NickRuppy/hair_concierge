---
name: thermo-nuclear-code-quality-review
description: Use when the user asks for a thermo-nuclear, thermonuclear, especially harsh, or strict structural maintainability review focused on abstraction quality, file sprawl, spaghetti-condition growth, codebase health, and code-judo simplification; also use when asked for a strict structural code-quality subagent.
---

# Thermo-Nuclear Code Quality Review

Use this skill for an unusually strict review focused on implementation quality, maintainability, abstraction quality, and codebase health. This is not a normal bug-focused review. Push hard on whether the code became simpler, more coherent, and easier to own.

## Scope

Review only the requested diff, branch, PR, or changed files. If the user gives no scope, default to the current branch against its base, usually `git diff main...HEAD`, and state that assumption.

When repository instructions exist, read and follow them before reviewing. If another code-review skill also applies, use this skill only for structural maintainability; do not dilute it into general correctness review.

## Subagent Workflow

If the user explicitly asks for subagent review, delegation, or parallel agent work, use this as the primary path:

1. Have the parent gather the review packet locally:
   - `git status --short --branch`
   - `git diff --stat <base>...HEAD`
   - `git diff --name-only <base>...HEAD`
   - `git diff <base>...HEAD`
   - full contents of changed files when practical
2. Spawn one review subagent and pass this skill plus a prompt containing:
   - `### Git / diff output`
   - `### Changed file contents`
   - any project instructions that materially affect review
3. The subagent must apply this rubric only to the packet it receives. It should not spawn nested subagents unless the parent or user explicitly asks.
4. The parent should integrate the subagent result without inventing additional findings. If the parent verifies or rejects a finding, say so explicitly.

If custom subagent types are unavailable, use the available default/explorer/worker subagent role and include this skill as a skill item or paste the rubric request into the subagent prompt.

## Core Prompt

Start from this baseline:

> Perform a deep code quality audit of the current branch's changes.
> Rethink how to structure or implement the changes to meaningfully improve code quality without impacting behavior.
> Work to improve abstractions, modularity, reduce spaghetti code, improve succinctness and legibility.
> Be ambitious. If there is a clear path to improving the implementation that involves restructuring some of the codebase, call it out.
> Be extremely thorough and rigorous.

## Non-Negotiable Standards

1. Be ambitious about structural simplification.
   - Do not stop at "this could be cleaner."
   - Look for code-judo moves: restructurings that preserve behavior while making the implementation dramatically simpler, smaller, more direct, or more elegant.
   - Prefer deleting complexity over rearranging it.

2. Do not let a PR push a file from under 1,000 lines to over 1,000 lines without a very strong reason.
   - Treat this as a strong code-quality smell.
   - Prefer extracting helpers, subcomponents, modules, or local abstractions.
   - If the diff crosses the threshold, explicitly ask whether the code should be decomposed first.

3. Do not allow random spaghetti growth in existing code.
   - Be suspicious of ad-hoc conditionals, scattered special cases, and one-off branches inserted into unrelated flows.
   - Treat "weird if statements in random places" as a design problem, not a stylistic nit.
   - Prefer a dedicated abstraction, helper, state model, policy object, or module.

4. Bias toward cleaning the design, not merely accepting working code.
   - Do not rubber-stamp "it works" implementations that leave the codebase messier.
   - Prefer simplifications that remove moving pieces over refactors that spread the same complexity around.

5. Prefer direct, boring, maintainable code over hacky or magical code.
   - Flag brittle behavior, hidden data-shape assumptions, and generic mechanisms that obscure simple structure.
   - Question thin wrappers or pass-through helpers that do not buy clarity.

6. Push on type and boundary cleanliness when they affect maintainability.
   - Question unnecessary optionality, `unknown`, `any`, and cast-heavy code.
   - Prefer explicit typed models or shared contracts over loosely shaped ad-hoc objects.
   - If silent fallback papers over an unclear invariant, ask whether the boundary should be explicit.

7. Keep logic in the canonical layer and reuse existing helpers.
   - Call out feature logic leaking into shared paths or implementation details leaking through APIs.
   - Prefer canonical utilities over bespoke one-offs.
   - Push code toward the package, service, or module that already owns the concept.

8. Treat unnecessary sequential orchestration and non-atomic updates as design smells when a cleaner structure is obvious.
   - If independent work is serialized for no good reason, ask whether the flow should run in parallel.
   - If related updates can leave state half-applied, push for a more atomic structure.

## Review Questions

For every meaningful change, ask:

- Is there a code-judo move that would make this dramatically simpler?
- Can the change be reframed so fewer concepts, branches, or helper layers are needed?
- Does this improve or worsen the local architecture?
- Did the diff add branching complexity where a better abstraction should exist?
- Did a previously cohesive module become more coupled, more stateful, or harder to scan?
- Is this logic living in the right file and layer?
- Did this change push a file or component past a healthy size boundary?
- Are repeated conditionals signaling a missing model or helper?
- Is the implementation direct and legible, or dependent on special cases and incidental control flow?
- Is this abstraction earning its keep?
- Did the diff introduce casts, optionality, or ad-hoc object shapes that obscure the real invariant?
- Is orchestration more sequential or less atomic than it needs to be?

## What To Flag Aggressively

Escalate findings when you see:

- A complicated implementation where cleaner framing could delete whole categories of complexity.
- Refactors that move code around but fail to reduce the concepts a reader must hold.
- A file crossing 1,000 lines due to the PR, especially if the new code could be split out.
- New conditionals bolted onto unrelated code paths.
- One-off booleans, nullable modes, or flags that complicate existing control flow.
- Feature-specific logic leaking into general-purpose modules.
- Generic magic that hides simple structure and makes code harder to reason about.
- Thin wrappers or identity abstractions that add indirection without simplifying anything.
- Unnecessary casts, `any`, `unknown`, or optional params that muddy the real contract.
- Copy-pasted logic instead of extracted helpers.
- Narrow edge-case handling in the middle of an already busy function.
- Temporary branching that is likely to become permanent debt.
- Bespoke helpers where the codebase already has a canonical utility.
- Logic added in the wrong layer/package when there is a clear canonical home.
- Sequential async flow where independent work could stay clearer with parallel execution.
- Partial-update logic that leaves state harder to reason about.

## Preferred Remedies

When identifying a code-quality problem, prefer suggestions like:

- Delete a whole layer of indirection rather than polishing it.
- Reframe the state model so conditionals disappear.
- Change the ownership boundary so the feature becomes a natural extension of an existing abstraction.
- Turn special-case logic into a simpler default flow with fewer exceptions.
- Extract a helper or pure function.
- Split a large file into smaller focused modules.
- Move feature-specific logic behind a dedicated abstraction.
- Replace condition chains with a typed model or explicit dispatcher.
- Separate orchestration from business logic.
- Collapse duplicate branches into a single clearer flow.
- Delete wrappers that do not meaningfully clarify the API.
- Reuse the existing canonical helper.
- Make type boundaries explicit so control flow gets simpler.
- Parallelize independent work when it also simplifies orchestration.
- Restructure related updates into a more atomic flow.

## Tone

Be direct, serious, and demanding about quality. Do not be rude, but do not soften major maintainability issues into mild suggestions.

Useful phrasing:

- `this pushes the file past 1k lines. can we decompose this first?`
- `this adds another special-case branch into an already busy flow. can we move this behind its own abstraction?`
- `this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure the implementation.`
- `this feels like feature logic leaking into a shared path. can we isolate it?`
- `this abstraction seems unnecessary. can we keep the direct flow?`
- `why does this need a cast or optional here? can we make the boundary more explicit instead?`
- `this looks like a bespoke helper for something we already have elsewhere. can we reuse the canonical one?`
- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this refactor moves complexity around, but does not really delete it. is there a way to make the model itself simpler?`

## Output

Prioritize findings in this order:

1. Structural code-quality regressions
2. Missed opportunities for dramatic simplification or code-judo restructuring
3. Spaghetti or branching complexity increases
4. Boundary, abstraction, or type-contract problems that make code harder to reason about
5. File-size and decomposition concerns
6. Modularity and abstraction issues
7. Legibility and maintainability concerns

Do not flood the review with low-value nits if there are larger structural issues. Prefer a smaller number of high-conviction comments.

Use this format:

### Findings

- `[severity] <title>` - include a tight file reference when available, explain the maintainability failure mode, and propose the cleaner direction.

If there are no material issues, say `No blocking structural findings.`

### Open Questions / Assumptions

- Include only items that materially affect confidence.

### Approval Bar

- Say whether the change clears the structural bar. Do not approve merely because behavior seems correct.

## Approval Bar

Do not approve when any of these are visible and unjustified:

- A structural regression.
- An obvious missed opportunity to make the implementation dramatically simpler.
- File-size explosion, especially crossing 1,000 lines.
- Spaghetti growth from special-case branching.
- Hacky or magical abstraction that makes code harder to reason about.
- Wrapper, cast, or optionality churn that obscures the real design.
- Architecture-boundary leak or avoidable canonical-helper duplication.
- Missed obvious decomposition that would materially improve maintainability.

Treat these as presumptive blockers unless the author can justify them clearly.
