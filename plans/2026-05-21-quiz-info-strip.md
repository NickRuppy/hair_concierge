# Quiz info strip + landing question-count fix

**Goal:** Add a dismissible info strip above the question content during the quiz that frames *why* users are answering questions — and quietly correct the landing's stale "6 Fragen" copy to match the actual quiz length (9).

**Branch:** `codex/quiz-info-strip` (new worktree under `.worktrees/quiz-info-strip`).

---

## Decisions (locked)

- **Surface:** Option B from the earlier mockup — top strip above the question, same design on desktop and mobile.
- **Visibility:** **Only on the first question (step 2).** Auto-hidden from step 3 onward — no localStorage needed. User can also dismiss manually on step 2 if they want.
- **State:** Simple `useState` inside the layout, no persistence. Dismiss sticks within the session (across question steps, since the layout doesn't unmount); a full page reload resets it but the next session would only see the strip on step 2 anyway, so it's effectively idempotent.
- **Copy:**
  > **Lass uns deine Haare verstehen — Schritt für Schritt.** 9 schnelle Fragen zur Basis, dann gehts an deine Routine und Produkte.

## Files to create

```
src/components/quiz/quiz-info-strip.tsx   (new, client component)
```

- `"use client"` directive (needs `onClick` handler for the dismiss button).
- Props: `onDismiss: () => void`. The parent (layout) owns the dismissed state so it can also gate on `step === 2`.
- Markup mirrors the mockup: rounded card with brand-plum-ice background, small info icon (lucide-react `Info`), copy with bold lead, and an `×` close button.
- No internal `mounted` / `useEffect` gymnastics — there's no localStorage to read, so no SSR/CSR mismatch risk.
- Accessibility:
  - `role="note"` on the outer container.
  - `aria-label="Hinweis schließen"` on the dismiss button.
  - `aria-hidden="true"` on the decorative icon.
  - Focus ring on the dismiss button (`focus-visible:ring-…`).

## Files to modify

```
src/app/quiz/layout.tsx                    (mount the strip in the content column)
src/components/landing/how-it-works.tsx    (sechs → neun)
```

- **`src/app/quiz/layout.tsx`:**
  - Add a `dismissed` `useState` in the layout component (starts `false`).
  - In the right-column content area, just above `{children}`, render `{step === 2 && !dismissed && <QuizInfoStrip onDismiss={() => setDismissed(true)} />}`.
  - That's the entire visibility logic: gate on `step === 2`, and the user's dismiss only matters within that step. From step 3 onward the strip is never rendered regardless of `dismissed`.
  - Layout doesn't unmount across step transitions, so the user clicking dismiss on step 2 keeps it dismissed even if they back-button to step 2 within the same session.

- **`src/components/landing/how-it-works.tsx:13`:**
  Replace `"2 Minuten, sechs Fragen. Zugtest, Oberfläche, Kopfhaut, deine Ziele."` with `"2 Minuten, neun Fragen. Zugtest, Oberfläche, Kopfhaut, deine Ziele."`.

  This is the only stale "sechs Fragen" reference in `src/`. FAQ doesn't mention a count.

## Files NOT to touch

- `src/lib/quiz/store.ts` — no state changes needed.
- `src/lib/quiz/types.ts` — no type changes needed.
- Other landing copy — no other count references.

## Verification

- `npm run typecheck` clean.
- `npm run lint` clean (no new warnings).
- Manual smoke (`npm run dev:worktree`):
  - Visit `/quiz` → strip is visible above the first question on desktop AND mobile.
  - Click dismiss `×` → strip disappears immediately.
  - Advance to question 2 (step 3) → strip is gone.
  - Back-button to question 1 → strip stays gone (within-session dismiss).
  - Hard reload `/quiz` → strip is back (session reset is the expected reset point).
  - Skim through subsequent questions (3-8, 13) → strip never reappears.
- Curl smoke for landing copy: `curl -s http://localhost:<port>/ | grep "neun Fragen"` returns the line; `grep "sechs Fragen"` returns nothing.
- Add a Playwright assertion to `tests/e2e-smoke.spec.ts` test 2 (quiz page loads): assert the strip's text "Lass uns deine Haare verstehen" is visible on first visit. Optional but locks the behavior.

## Risks / things to watch

- **Strip pushing options below the fold on small mobile viewports:** with the strip + progress + eyebrow + question title + instruction + 4 option cards, the first option might sit just at the fold edge on a 360×640 viewport. Acceptable — user scrolls a quarter screen. Worth eyeballing on a real device after deploy.
- **Quiz retake flow** (`/quiz?mode=retake`): the strip will reappear on step 2 since it's gated only by step + in-memory dismiss. Probably fine — retake is a fresh session conceptually.

## Codex review focus areas (for the whole-branch pass)

1. The `step === 2` gate in layout.tsx — does the layout component re-render correctly when step changes, so the strip disappears on advance?
2. Strip styling: brand tokens only, focus-visible ring on the dismiss button, dismiss button has accessible name.
3. Test coverage: smoke assertion for strip presence + the "neun Fragen" landing update.

## Effort estimate

~30 min: 10 min for the component, 5 min for the layout mount + state, 1 min for the landing copy fix, 5 min for the smoke test update, 10 min for codex review + push. Smaller now that there's no localStorage to handle.

## Out of scope

- Showing the strip during lead-capture / analysis / results / goals / welcome — the framing doesn't match those steps.
- Re-surfacing the strip after a long absence (e.g., 30-day cookie expiry). Sticky dismiss is fine for now.
- Reusing the same strip pattern on the marketing landing — different surface, different role.
