# Hair Tools port - ready-check browser walkthrough (2026-10-11)

Tree: `.worktrees/hair-tools-port`, branch `codex/hair-tools-port`, HEAD `c4d83e0e`.
Servers: `npm run dev:worktree` on `http://localhost:3342` (first `PERSONAL_PLAN_TOOLS_ROLLOUT=all`, restarted without the variable for flag OFF). Port 3217 was not touched. Both servers stopped; nothing listens on 33xx/3217 afterwards.
Browser: Playwright, viewport 390x844 (desktop 1280x900 only for the Profil desktop shot). `LOCAL_DEV_LOGIN_ENABLED` was already present in the worktree `.env.local`; `PERSONAL_PLAN_TOOLS_ROLLOUT` is absent from `.env.local`.
Evidence tiers: labs (A), dev login (B, C). No Personal Plan enrollment was available (D skipped).

Note: `git status` in the worktree shows modifications to `src/lib/user-facts/from-refinement-draft.ts` and `tests/personal-plan/persistence/stage2-module-completion.test.ts`. Not made by this walkthrough (no edits were done here); tree under test therefore may differ from the committed HEAD.

## A. Labs, flag on - DONE

`/labs/feinschliff-journey?step=module-tools` walked end to end. Console: 0 errors; only Next.js "LCP image should be loading=eager" warnings for the first tool image (dev-only, benign).

| Screen | Result | Screenshot |
|---|---|---|
| Tools overview, 4 sections in order Waschen & Auftragen, Abtrocknen & Entwirren, Trocknen & Stylen, Nachtschutz, plus "Nichts davon", CTA "Weiter" | PASS (Abtrocknen + Nachtschutz are preselected by the lab fixture) | `01-tools-overview.png`, `02-tools-overview-all-selected.png` |
| Photo pages, titles per family: Waschen "Was nutzt du beim Waschen und Auftragen?", Handtuecher "Welche Handtuecher oder Tuecher nutzt du?", Buersten & Kaemme "Seite 1 von 2" / "Seite 2 von 2", Haartrockner & Luftstyler, Hitzestyling-Tools, Heatless-Styling-Tools, Fixieren und Abteilen "Seite 1 von 2" / "Seite 2 von 2", Nachtschutz "Was nutzt du nachts?" | PASS. Two-page families show "Seite n von 2"; single-page families do not. "Weiter" disabled until a choice is made. | `03`-`12` |
| Tool-Checkpoint "Das hast du schon", groups in wash-day order (Waschen, Handtuecher, Buersten, Haartrockner, Hitzestyling, Heatless, Fixieren, Nachtschutz), CTA "Weiter zu deiner Routine", secondary "Etwas fehlt? Tools ergaenzen" | PASS | `13-checkpoint.png`, `13-checkpoint-full.png`, `13b-checkpoint-all-groups-full.png` |
| Routine with "Deine Tools" section (tool cards with "Nutze deins"), banner "Letzter Schritt: deine Gewohnheiten. 4 von 5, Weiter . 3 Min." | PASS | `16-routine-with-tools.png`, `16-routine-with-tools-full.png` |
| Gewohnheiten: towel question, drying page (Lufttrocknen / "Gewoehnlich foehnen - auch mit Rundbuerste" / "Mit Diffusor"), no "Nichts davon" on drying page; per-tool "Wie oft" pages for Foehn, Diffusor, Glaetteisen; Glaetteisen page adds "Wie konsequent nutzt du dabei Hitzeschutz?" | PASS | `17`, `18-*`, `19-*`, `20`-`22` |
| Diffusor-only scenario (only Diffusor-Aufsatz ticked, everything else "Nichts davon"): checkpoint lists only Diffusor-Aufsatz; drying page offers only Lufttrocknen + Mit Diffusor (no "Gewoehnlich foehnen"); after ticking Mit Diffusor only a frequency page follows, NO Hitzeschutz block | PASS | `25`, `26-*`, `27`, `28` |
| Haarprofil list (after Gewohnheiten): 5 rows Haar-Analyse, Dein Plan, Deine Produkte, Deine Tools, Deine Gewohnheiten (Tools before Gewohnheiten), "5 von 5" | PASS | `24-haarprofil-list.png` |
| `/labs/personal-plan-tools` index + `?section=stage1 / stage2-overview / stage2-forms / checkpoint / routine / anwendung` | all 200, render, no horizontal scroll | `30`-`36` |
| `/labs/personal-plan-stage-2?scenario=module-tools` | 200, tools overview | `37-stage2-module-tools.png` |
| `/labs/profile-haarprofil` (single page stacking 4 tools-off scenarios "x von 4" and 4 tools-on scenarios "x von 5", Deine Tools between Produkte and Gewohnheiten) | PASS | `40-profile-haarprofil-default.png` |

Anwendung lab (`36-pp-tools-anwendung.png`) shows only tool steps (Kamm, Handtuch, Foehn, Glaetteisen, Kissenbezug); the "towel before Leave-in" and "Hitzeschutz before the heated step" ordering cannot be judged there (no product steps in the lab). Needs the real /anwendung (D).

Lab observations (likely harness limits, not confirmed bugs):
1. Checkpoint "Tools ergaenzen" in the lab leaves the checkpoint and reopens the tools overview (works), but the overview and pages come back with the lab's seed (Abtrocknen + Nachtschutz ticked, Mikrofaser preselected), not the selections just made (Waschen/Trocknen ticked, Haarturban). The lab routes through `followDemoLink`, so the "prefilled" claim is unverified; check in D / the real `/plan-start?refine=tools` flow. Screenshot `14-tools-ergaenzen-lab.png`.
2. The lab Routine "Deine Tools" list is a static fixture (Foehn, Glaetteisen, Grobzinkiger Kamm, Kissenbezug, Mikrofaser-Handtuch); it did not change between a full-pick run and a Diffusor-only run. Not a product bug if the real routine derives from facts; unverifiable here.
3. Foehn page (Wie oft) has no Hitzeschutz question; only the Glaetteisen page does. Matches the mockup (5a has none for drying), noted for the reviewer in case Foehn was meant to be heat-protected.

## B. Dev login, flag OFF - DONE

`/api/dev/login?next=/profile` -> 307 -> `/profile` (200). Console: 0 errors.
- `/profile` (`60-off-profile.png`): Haar-Check (9/10 vollstaendig, with a "DEINE HAARZIELE" row: Weniger Frizz / Mehr Glanz / Ausgewogenes Volumen, "Ziele bearbeiten"), Produkte (1/2 verifiziert), Styling (3/3), Alltag (5/5), then Einstellungen. No separate Ziele card, no tools/Gewohnheiten cards. = today's layout. PASS.
- `/routine` (`61-off-routine.png`): 2 aktiv / 0 in Pruefung / 2 Vorschlaege (Shampoo, Conditioner, Leave-in and Bondbuilder suggestions). No tools section. PASS (legacy inventory view; the dev account has no plan).
- `/anwendung` (`62-off-anwendung.png`): "Anwendung gerade nicht verfuegbar ... Zur Routine". No tool blocks. PASS.
- Mobile: no horizontal scroll on any (scrollWidth == clientWidth).

## C. Dev login, flag ON (`all`) - DONE

Same three pages, same results as B (identical text): `50-on-profile.png` (+ desktop `50b-on-profile-desktop.png`), `51-on-routine.png`, `52-on-anwendung.png`. No tool UI without facts, no new cards, nothing errored on page load. The only console errors were the 409 responses of my own manual `fetch('/api/personal-plan/routine')` calls (no-plan state, expected). Note: on first load Styling/Alltag cards show "Wird geladen" for roughly 10 s in dev (cold compile) before filling in; same behaviour on OFF at first load, so not flag related.

Server-Timing (dev server, warm, 4 runs each, ms, localhost -> production Supabase, so noisy):

| Endpoint | Flag ON | Flag OFF |
|---|---|---|
| `GET /api/personal-plan/routine` (409 no plan) `personal_plan_routine` | 506, 517, 519, 550 | 679, 686, 694, 713 |
| `GET /api/personal-plan/routine/attention` `personal_plan_attention` | 458, 516, 584, 489 | 558, 560, 564, 598 |
| `GET /routine` `app_proxy_access` | 612, 627, 649 | 632, 646, 677, 690 |

No ON-vs-OFF regression visible (ON was not slower; difference is run-order/cache noise). `refinement-presentation` and `portfolio-presentation` return 200 and send no Server-Timing header.

## D. Real signed-in flag-ON journey - SKIPPED

Docs section 3 prerequisites are missing in the worktree `.env.local` (checked by key presence only): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE`, `PERSONAL_PLAN_ONE_TIME_QA_ENABLED`, `PERSONAL_PLAN_ONE_TIME_QA_SIGNING_SECRET` are all absent. In addition section 3 itself says the recipe is "not yet blessed" (Meta/Customer.io analytics have no internal-test suppression). No payment setup was improvised. Therefore NOT verified: /plan-bereit -> /plan-start Produkte -> tools module with real persistence, real /routine tool section, /anwendung tool-use blocks (towel before Leave-in, Hitzeschutz before heated step), /profile with four cards (Haar-Check, Produkte, Deine Tools, Gewohnheiten; no Styling/Alltag), and whether "Tools ergaenzen" opens the tools module prefilled with saved facts (see lab observation 1).

## E. Mobile layout sanity (390px) - DONE

Every captured screen measured: `scrollWidth == clientWidth` (390, or 384 when the dev vertical scrollbar is present), no horizontal scroll. Option chips/cards wrap in 2-column grids; long names hyphenate ("Applikatorfla-sche", "Applikator-kamm") but stay inside cards. Fixed bottom CTA ("Weiter" / "Weiter zu deiner Routine") overlays the last card row in full-page screenshots only (artifact of fullPage capture); in viewport shots the CTA is reachable. The dev-tools Next.js indicator badge overlaps the bottom-left of CTAs in screenshots (dev only).

## Versus mockup (`index.html`, screenshot `70-mockup-reference-full.png`)

Matches: overview copy and four-section order, "Nichts davon", checkpoint copy and group order, checkpoint CTA + secondary link, drying page with no "Mit Diffusor" unless a diffuser is ticked, Glaetteisen page = frequency + Hitzeschutz (Immer/Manchmal/Nein/Unsicher), 5-row Haarprofil with Tools before Gewohnheiten, no progress header on checkpoint.

Differences (all minor, copy/scale rather than structure):
1. Frequency scale on the per-tool "Wie oft" page: mockup has 4 options (Taeglich, Mehrmals pro Woche, Woechentlich, Seltener); implementation has 8 (Seltener als 1x/Monat ... Taeglich). Question wording differs ("Wie oft nutzt du dein Glaetteisen?" vs "das Glaetteisen"; subtitle added).
2. Towel page: mockup title "Welche Handtuecher & Trocknungsmaterialien nutzt du?" with options Mikrofaser, Frottee, Trockenturban, Baumwolltuch; implementation "Welche Handtuecher oder Tuecher nutzt du?" with Mikrofaser, Frottee, "Glattes Baumwolltuch / T-Shirt", "Haarturban / Wrap". The mockup page has no per-page eyebrow chip beyond the family label; implementation matches that.
3. Routine banner: mockup 1a "Als Naechstes: Deine Tools. 3 von 5"; the tools step is entered from the lab differently, and after the tools the banner reads "Letzter Schritt: deine Gewohnheiten. 4 von 5" (consistent progression, not seen in the mockup).
4. Checkpoint in the implementation can contain additional groups (Waschen & Auftragen, Heatless-Styling, Fixieren & Clips) that the mockup example does not show.
5. Profil with tools (mockup 6a/6b four cards incl. "Deine Tools - 7 Tools") could not be seen: the dev account has no plan, so the real Profil stays at today's layout (D skipped). The labs only cover the Haarprofil progress section, not the card layout.

## Anomalies / open items

1. D not run - real-enrollment checks (persistence, /routine tool section, /anwendung ordering, Profil four-card layout, "Tools ergaenzen" prefill) are unverified in a browser.
2. Lab "Tools ergaenzen" reopens the module with lab seed, not the just-entered picks (probably harness; verify in real flow).
3. Worktree has two uncommitted modified files not made by this run.
4. Only warning seen anywhere: Next.js LCP image `loading="eager"` hint for the first tool image on the overview/photo pages (dev, low severity).
