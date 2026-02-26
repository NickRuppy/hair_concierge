Generate an options-first implementation plan for: $ARGUMENTS

## Phase 1: Gather Context

Use Explore agents (or Glob/Grep/Read) to understand the relevant parts of the codebase. Identify:
- Which files would be affected
- Existing patterns to follow
- Constraints or dependencies

## Phase 2: Generate Approaches

Design 2-3 **distinct** implementation approaches. For each approach, define:
- **Name** — short, descriptive label
- **Description** — 1-2 sentences on the core idea
- **Key files** — which files are created/modified
- **Complexity** — Low / Medium / High
- **Pros** — main advantages
- **Cons** — main disadvantages or risks

## Phase 3: Visualize

Render a markdown comparison table:

| | Approach A | Approach B | Approach C |
|---|---|---|---|
| **Description** | ... | ... | ... |
| **Key files** | ... | ... | ... |
| **Complexity** | ... | ... | ... |
| **Effort** | ... | ... | ... |
| **Pros** | ... | ... | ... |
| **Cons** | ... | ... | ... |

Add a brief recommendation if one approach is clearly better for this project.

## Phase 4: Ask

Use `AskUserQuestion` to let the user pick an approach. Use the approach names as option labels, with the description as option descriptions.

## Phase 5: Detailed Plan

After the user chooses, write a detailed implementation plan covering:
1. Step-by-step implementation with specific file paths and code changes
2. Migration steps (if DB changes needed)
3. Verification criteria — how to confirm it works
4. Only include specs for the **chosen** approach

## Rules
- Do not write a plan until the user has chosen an approach
- Keep approach descriptions honest — don't strawman any option to push a favorite
- If only one viable approach exists, say so and ask if the user wants to proceed directly
- Respect existing project patterns (check CLAUDE.md and MEMORY.md)
