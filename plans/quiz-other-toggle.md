# Quiz „Etwas anderes“ toggle

## Outcome

In the regular quiz and Personal Plan quiz, the „Etwas anderes“ card is the only control for activating or deactivating its free-text answer. Deselecting the card collapses the field without erasing the in-screen draft; a deselected note is not counted, validated, persisted, or submitted.

## Planning evidence

- Reviewed mockup: `quiz-other-toggle-mockup.html` in the task conversation artifact.
- UX review confirmed the standard multi-select pattern: the card toggles a short conditionally revealed question; no competing remove action.
- Nick explicitly approved implementation in both quizzes on 2026-09-01.

## Designed user journey

1. User selects „Etwas anderes“; the card becomes selected and the text field opens with focus.
2. User types a note; it counts as one answer and can unlock „Weiter“.
3. User selects a fitting listed answer and deselects „Etwas anderes“ by pressing its card again.
4. The field collapses, its answer leaves the count and submission state, and the listed answer remains selected.
5. If the user reselects the card before continuing, the typed draft returns.
6. If the user continues while the card is deselected, the inactive draft is discarded.

## Scope and verification

- Change only the regular concerns screen and the Personal Plan `current_problems` screen.
- Remove the separate „Notiz entfernen“ actions.
- Preserve existing answer values, limits, layout, focus behavior, and all other quiz questions.
- Add browser regression coverage for select → type → deselect → reselect in both flows.
- Run focused tests, typecheck/lint gates required by `ready-check`, and inspect both changed flows.

## Stop

Verified local worktree only. Commit, push, PR, merge, deploy, and cleanup require separate authorization.
