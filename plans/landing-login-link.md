# Landing returning-user login link

## Outcome

Restore an obvious returning-user entrance on the active organic homepage without weakening the acquisition hierarchy.

## Planning evidence

- Current production and source inspection on 2026-08-20 confirmed that the active organic homepage header exposed only `Analyse starten`, while `/auth` and the existing login methods remained available.
- External pattern research found that comparable conversion-led consumer products keep a persistent, visually subordinate login action beside the primary acquisition CTA.
- Nick reviewed the desktop/mobile header mockup and approved the placement on 2026-08-21.
- Retained mockup: [`evidence/landing-login-header-mockup.html`](evidence/landing-login-header-mockup.html).
- Nick approved the implementation plan and designed journey, then explicitly authorized implementation.

## Claude plan review

Claude Opus 4.8 reviewed the plan at high effort and returned `Approve with minor revisions` with no blockers. Incorporated revisions:

- Link directly to `/auth?next=/chat` to avoid an unnecessary anonymous redirect and misleading `session_expired` copy.
- Assert the exact login destination once in the rendered surface.
- Keep `prefetch={false}` because the destination is authentication-sensitive.
- Keep the login action visually subordinate to the plum analysis CTA.
- Verify at 320px and 375px; spacing may tighten if necessary, but neither action may be hidden and existing CTA copy may not change without further approval.
- Use the repository test shim and full `npm run ci:verify` gate.

## Scope

1. Update the inline header in `src/funnels/landing/organic-refresh.tsx`:
   - place `Anmelden` immediately before `Analyse starten`;
   - target `/auth?next=/chat`;
   - disable prefetch;
   - keep current primary CTA copy, color, and dominance;
   - keep both actions visible on mobile and desktop.
2. Add rendered-surface and browser regression coverage.

## Non-goals

- No separate returning-user landing.
- No auth, middleware, quiz, footer, campaign, or analytics changes.
- No cookie-based homepage redirect or session lookup.
- No commit, publication, deployment, or production write in the implementation loop.

## Designed user journey

1. A new visitor opens `/` and sees `Analyse starten` as the dominant header action.
2. Choosing `Analyse starten` enters `/quiz` exactly as before.
3. A logged-out returning customer chooses `Anmelden` and reaches `/auth?next=/chat` directly.
4. The customer signs in with password or email login link, or uses the existing password recovery path.
5. Existing authenticated routing sends the customer to the correct intake or app stage.
6. An already-authenticated visitor opening the auth target is redirected by the existing intake router to the correct application destination.
7. Existing auth error and recovery states remain unchanged.

## Verification

- Red/green rendered-surface regression through `npm run test:node`.
- Focused homepage Playwright smoke against a worktree server on `localhost`.
- Responsive inspection at 320px, 375px, tablet, and desktop widths.
- `npm run ci:verify`.
- `git diff --check`.
- Repository ready-check and final code-review loop.
