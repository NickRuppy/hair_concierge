# Review Prompt

## Codex

Use `$code-reviewer` to review `git diff main...HEAD`.

Prioritize:

- correctness and regressions
- security and privacy risks
- data or schema coupling
- missing tests and weak rollback paths

Return findings first, ordered by severity, with tight file references. Ignore pure style nits unless they hide a real defect. End with residual risks and a short ship/no-ship recommendation.

## Claude Code

Use the `code-reviewer` agent to review `git diff main...HEAD` with the same focus.

Return:

1. Critical findings
2. High / medium / low findings
3. Residual risks
4. Short verdict

## Scope Variants

- Current uncommitted work: `git diff HEAD`
- Staged changes only: `git diff --cached`
- Specific base branch: `git diff origin/main...HEAD`
