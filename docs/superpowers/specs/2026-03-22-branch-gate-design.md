# Branch Gate Skill — Design Spec

**Date:** 2026-03-22
**Status:** Approved

## Purpose

Automatically assess a plan before execution and recommend whether to build on a feature branch or directly on main. Invoked automatically via CLAUDE.md rule — the user never needs to call it manually.

## Trigger

Always called before `executing-plans` or `subagent-driven-development`. Enforced by a mandatory rule in the project's CLAUDE.md.

## Process

1. Read the plan file from the current conversation context
2. Extract signals: task count, file count, new files, migrations, uncertainty keywords
3. Score against heuristics
4. Present recommendation with one-line reasoning
5. On approval: create branch and proceed to execution skill
6. On rejection: proceed on main (or accept user's alternative)

## Heuristics

| Signal | Weight | Rationale |
|--------|--------|-----------|
| 3+ tasks in plan | +1 | Multi-step work is harder to revert |
| 5+ files touched | +1 | Wide blast radius |
| Creates new files | +1 | New files = new feature, not a tweak |
| Includes DB migrations | +2 | Migrations are hard to undo — auto-triggers branch |
| Uncertainty keywords (explore, prototype, try, experiment) | +1 | Experimental work may be discarded |
| Single task | -1 | Likely small and safe |
| 3 or fewer files | -1 | Narrow scope |
| Bug fix or config change | -1 | Low risk, targeted |

**Decision rule:** Score >= 2 recommends a branch. Any migration present always recommends a branch regardless of score.

## Branch Naming

Auto-generated from plan title:
- Features: `feat/<slugified-plan-title>` (e.g., `feat/oil-recommendation-flow`)
- Bug fixes: `fix/<slug>` (e.g., `fix/og-share-image`)
- Refactors: `refactor/<slug>`

## Output Format

```
Branch assessment: This plan has [N] tasks touching [M] files [with K migration(s)]
— score [X]. Recommending branch `feat/example-name`.

Create branch and proceed? (y/n)
```

If main is recommended:
```
Branch assessment: Single task, 2 files, bug fix — score -1.
Proceeding on main. (Say "branch" if you'd prefer a branch anyway.)
```

## Files

- **Create:** `~/.claude/skills/branch-gate/SKILL.md`
- **Modify:** `CLAUDE.md` — add mandatory invocation rule

## Integration

```
writing-plans → branch-gate → executing-plans / subagent-driven-development
```

The branch-gate skill does NOT replace `using-git-worktrees`. If the execution skill needs a worktree (parallel work), that's a separate concern. Branch-gate only handles the branch/main decision.
