# Personal Plan Stage 1 category card colors

## Outcome and source context

Stage 1 Bedarfsplan cards use a stable, muted color family per product category instead of coloring every Basis card green and every Optional card grey. Recommendation state remains explicit through page structure, pills, titles, and supporting copy, so color is not the sole status signal.

The selected visual direction is recorded in [the rendered decision mockup](./evidence/2026-08-12-stage1-category-card-colors.html).

## Chosen direction

Use the former Personal Plan Routine category palette as the semantic source, adapted into low-saturation card fills and borders with stronger, clearly differentiated category dots. Fill, border, and dot all mean category. They do not communicate Basis, Optional, or Pausiert.

| Category        | Fill      | Border    | Dot       |
| --------------- | --------- | --------- | --------- |
| Shampoo         | `#F5F0E5` | `#E2D4B8` | `#A77D31` |
| Conditioner     | `#EDF3F5` | `#CFDEE3` | `#4C8EA8` |
| Leave-in        | `#EDF4F0` | `#CEDFD5` | `#56866B` |
| Hitzeschutz     | `#F5F0EA` | `#E5D6C8` | `#B76A3E` |
| Haaröl          | `#F5EDEF` | `#E2D0D4` | `#A85F70` |
| Haarmaske       | `#F1EEF5` | `#DCD3E5` | `#7D67A8` |
| Kopfhautpflege  | `#EBF3F2` | `#CADEDB` | `#2F817A` |
| Trockenshampoo  | `#F1F3E9` | `#DCE2C6` | `#7D913F` |
| Bondbuilder     | `#F4EDF3` | `#E2D1DF` | `#985D8F` |
| Tiefenreinigung | `#F5F2E5` | `#E2DBC0` | `#998323` |

The Pause state retains its amber `Pausiert` pill, `Aktuell nicht anwenden` title, explanation, and delayed cadence. It no longer replaces the category card fill. Optional example images no longer receive an Optional-only opacity/desaturation filter.

## Scope and non-goals

In scope:

- Stage 1 `/plan-start` NeedCard fill, border, dot, and example-image presentation.
- All ten existing `Stage1Category` values.
- Focused render-contract coverage for category color and text-visible status combinations.
- Durable mockup and this implementation plan.

Non-goals:

- Recommendation logic, `needTier`, pause rules, snapshot shape, ordering, or Stage 1 navigation.
- Copy changes.
- Stage 2-5 card styling or the legacy Routine artifact.
- New design tokens or a cross-product category-color abstraction.
- Publication, feature-flag changes, deployment, or production writes.

## Target map

- `src/components/personal-plan-start/need-card.tsx`: authoritative category visual map and rendering behavior.
- `tests/personal-plan-start-ui.test.tsx`: render-contract coverage for Basis, Optional, and Pausiert cards.
- `plans/evidence/2026-08-12-stage1-category-card-colors.html`: reviewed visual decision evidence.

## Designed user journey

1. A customer with a completed Personal Plan snapshot enters `/plan-start` on the Basis page.
2. Each visible card uses the muted fill and border for its product category, with a stronger dot in the same category hue. The Basis page title and `Von uns klar empfohlen` section continue to communicate that these cards are foundational.
3. The customer expands and collapses a card exactly as before. The white detail panel stays neutral for readability; category coloring remains on the outer card.
4. If Optional recommendations exist, the customer advances to `Zusätzlich sinnvoll`. The same category palette is used, and every ordinary Optional card retains its explicit `Optional` pill.
5. If an included category is paused, its category color remains stable while the amber `Pausiert` pill, `Aktuell nicht anwenden`, explanation, and delayed cadence communicate the safety state. No user must infer Pause from color.
6. Cards without a usable example image continue to use the existing no-image layout. Loading, retry, unavailable, Basis-only, and navigation behavior remain unchanged.
7. The customer continues to Stage 2 through the existing CTA. No persistent artifact or downstream stage is changed.

Meaningful variants: desktop and mobile retain the current responsive layout; Basis-only snapshots omit the Optional page as before; paused-only Optional handling is unchanged apart from its card color.

User-journey sign-off: **confirmed by Nick on 2026-08-12 with no corrections**.

## Planning evidence

- Artifact: [rendered Basis, Optional, and Pausiert comparison](./evidence/2026-08-12-stage1-category-card-colors.html).
- Question answered: can category colors create a more harmonious Stage 1 surface without weakening the explicit Basis, Optional, and Pausiert status language?
- Selected direction: muted category fills and borders, stronger category dots, and textual status indicators.
- Feedback incorporated: soften the original fills; strengthen and separate dot hues, especially Leave-in green versus Kopfhautpflege teal; keep `Pausiert` explicit rather than color-only.
- Evidence review: **confirmed by Nick on 2026-08-12**.
- Prototype disposition: this static mockup is planning evidence only; production behavior will be implemented in `NeedCard` and verified independently.

## Ordered tasks

1. Add one exhaustive static category visual map in `need-card.tsx`, keyed by all ten Stage 1 category identifiers. Apply its fill and border to the card shell and its stronger hue to the category dot. Preserve the existing neutral fallback for malformed or legacy identifiers. Remove Basis/Optional card-shell coloring, the Pause shell override, and Optional-only image desaturation. Completion: rendered cards expose the approved category styling while all status copy and pills remain unchanged.
2. Extend `personal-plan-start-ui.test.tsx` with focused render assertions that prove different categories receive different fills/dots, Optional remains visible as text, and a paused card keeps its category styling plus `Pausiert` and `Aktuell nicht anwenden`. Completion: the focused test fails against the old styling and passes with the approved behavior.
3. Run the complete-tree readiness and review workflow. Completion: focused Stage 1 tests, relevant Personal Plan suite, formatting/diff checks, responsive browser evidence, and repository review report no blocking issue on one matching content fingerprint.

## Verification

Automated:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-start-ui.test.tsx`
- The relevant repository-provided Personal Plan test command selected by `ready-check`.
- TypeScript, lint/format, and diff checks selected by `ready-check` in proportion to the CSS-only UI risk.

Manual/browser:

- Render representative Basis, Optional, and Pausiert cards at desktop and mobile widths.
- Confirm category fills stay muted, dots are visibly stronger and Leave-in/Kopfhautpflege dots are distinguishable.
- Confirm `Optional` and `Pausiert` remain readable without relying on color.
- Expand a card and confirm the detail panel remains legible and neutral.

Migration/live-state: none; no database, auth, billing, flag, or production change is in scope.

## Review and handoff

- Worktree: `.worktrees/personal-plan-category-card-colors`
- Branch: `codex/personal-plan-category-card-colors`, based on `origin/main` at `761f180f`.
- Counterpart plan review: skipped because this is a tightly bounded visual-only change with no architecture, data, or rollout fork; repository guidance excludes trivial fixes from counterpart review.
- Evidence artifact: commit the HTML mockup; discard the ignored generated PNG after it has served as local review evidence.
- Use `ready-check` and `request-code-review` on the final tree.
- Stop before commit, push, PR, merge, deployment, production write, or cleanup unless separately authorized.
