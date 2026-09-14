# Unified Legal Footer

**Date:** 2026-09-04 · **Branch:** `codex/legal-footer` · **Status:** approved (Nick sign-off after mockup review + 3 follow-up rulings)

## Problem

The live homepage (`organic-refresh` funnel variant, served at `/` and `/lp/organic-refresh`), the quiz lander `/lp/personal-plan-quiz`, all five legal pages, and the logged-in app had no reachable Impressum/Datenschutz links (§ 5 DDG risk). Two different footer designs existed (4-column `SiteFooter`, ad-hoc offer footer).

## Decisions (all confirmed with Nick)

- **D1:** New footer design "V1 Ruhiger Abschluss" — centered wordmark, one muted link row, copyright line. Mockup: `footer-mockups.html` (Variante V1).
- **Unification:** The one new footer replaces the old 4-column `SiteFooter` (default landing, quiz-gate landing, editorial) and the offer page footer, and is added to `organic-refresh` and all 5 legal pages (`/agb`, `/widerruf`, `/kontakt`, `/datenschutz`, `/impressum`; self-link allowed).
- **Link set (legal-only):** Kontakt · Impressum · Datenschutz · AGB · Widerruf · Cookie-Einstellungen. Consequence (acknowledged): Methodik and "Haaranalyse starten" lose their footer links; the offer footer's `info@chaarlie.de` line is replaced by Kontakt.
- **Copyright:** `© {year} Haarmony LLC` — no address, no "Made with care" line.
- **D3 (app):** No app-wide footer. `/profile` gets a muted legal link row below the Abmelden card (all 6 items).
- **D4 (quiz lander):** Mini line "Impressum · Datenschutz" under the first quiz screen only; links open in a new tab so a started quiz isn't lost.
- Waitlist pages keep their existing inline legal links (out of scope).

Undiscussed consequential assumptions affecting this handoff: none.

## Journey (signed off)

1. Homepage → scroll past CTA card → footer → Impressum/Datenschutz reachable; legal pages cross-link via the same footer.
2. Legal pages → Cookie-Einstellungen reopens consent settings (cookie-consent is mounted in the root layout, so the trigger works everywhere).
3. Profile → link row under Abmelden → public legal pages (public routes, no auth wall).
4. Quiz lander → question 1 shows muted legal line; opens in new tab, quiz state intact.

## Tasks

1. **Rework `src/components/landing/footer-links.tsx`:** single `legalFooterLinks` list (Kontakt, Impressum, Datenschutz, AGB, Widerruf) + keep `FooterLink`, `FooterCookieSettingsButton`, `footerLinkClass`; drop now-unused exports (`footerProductLinks`, `footerCompanyLinks`, `footerLegalLinks`, `offerFooterLinks`, `FooterButton`) after confirming no other usages.
2. **Rewrite `src/components/landing/site-footer.tsx`** as V1: `border-t border-border`, centered `Wordmark` (links to `/`), wrap-row of `legalFooterLinks` + cookie button, `© {year} Haarmony LLC` (suppressHydrationWarning year). Remove the `onQuizAction` prop.
3. **Update callers:** `funnels/landing/default.tsx` (no change beyond prop-less usage), `components/waitlist/quiz-gate-landing.tsx` (drop `onQuizAction`, remove dead `openFooterModal` wiring if unused), `components/editorial/editorial-shell.tsx` (unchanged usage), `components/personal-plan-offer/personal-plan-offer.tsx` (replace `PersonalPlanOfferFooter` with `SiteFooter`).
4. **Add footer to `funnels/landing/organic-refresh.tsx`** after the last CTA section.
5. **Add footer to the 5 legal pages** (`agb`, `widerruf`, `kontakt`, `datenschutz`, `impressum` under `src/app/*/page.tsx`) — full-width below the centered content column.
6. **Profile legal row:** `src/app/profile/page.tsx`, muted centered link row below the Abmelden card (6 items incl. Cookie-Einstellungen).
7. **Quiz lander mini line:** first-screen render path in `components/personal-plan-quiz/` — "Impressum · Datenschutz" below the quiz frame, `target="_blank" rel="noopener"`, first screen only.

## Verification

- `npm run ci:verify`
- Drive: homepage bottom, one legal page, profile bottom, quiz lander first screen (dev server, `npm run dev:worktree`)
- Codex whole-branch review before push
