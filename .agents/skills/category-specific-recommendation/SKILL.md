---
name: category-specific-recommendation
description: "Use for Hair Concierge when redesigning, specifying, or implementing one product category at a time: explicit user-facing questions, deterministic mappings, fallback rules, response metadata, and regression tests. Use hair-care-expert first only when new external evidence is requested."
---

# Category-Specific Recommendation

Turn one noisy category flow into explicit, testable product logic while preserving current internal behavior unless change is authorized.

## Workflow

1. Name the single category, intended user decision, current entry points, data contracts, and existing tests.
2. Map the current behavior from code, tables, internal sources, and fixtures. Distinguish intentional rules from accidental fallback behavior.
3. Define only the questions that can materially change the recommendation. Use German user-facing copy and the project vocabulary from `AGENTS.md`.
4. Specify deterministic mappings, precedence, missing-data behavior, conservative fallbacks, exclusions, and response metadata. Keep weak or mixed evidence out of hard routing rules.
5. Show representative input-to-output examples, including ambiguity, incomplete profiles, and no-good-match cases.
6. Implement or plan regression tests at the real decision seam. Confirm unrelated categories and shared fallbacks remain unchanged.

Use `hair-care-expert` first only when the user asks for external evidence or the change introduces an evidence-sensitive rule. Do not route preservation of current internal logic through external research by default.

## Completion criteria

- every question changes a documented decision
- mappings and precedence are explicit
- fallbacks are conservative and user-legible
- payload values match actual schemas or allowed values
- tests cover normal, boundary, missing-data, and regression cases
- external evidence and internal methodology remain visibly separate
