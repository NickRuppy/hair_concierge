# Feinschliff-Einstieg: Plan-first, modular, ohne Fork

**Datum:** 2026-08-25 (rev. 2 nach Codex-Review) · **Branch:** `codex/feinschliff-einstieg` · **Mockup-Evidenz:** `plans/feinschliff-einstieg-mockup.html` (v3, von Nick bestätigt 2026-08-25; Artefakt: https://claude.ai/code/artifact/461b953f-930d-4e40-ab1b-b4af4265b9f9)

## Ziel

Der Idealplan gilt sofort und landet direkt in der Routine. Der Feinschliff wird von einem Fork-Zwischenscreen zu einem eingeladenen, modularen Schritt: dismissbares Banner auf der Routine, festes Zuhause im Profil-Tab, grober Fortschritt „X von 4". Jedes Modul aktualisiert den Plan sichtbar bei Abschluss.

Research-Grundlage (Zwei-Stufen-Report, 2026-08-25): Default statt Fork, Endowed Progress, IKEA-Effekt nur bei *abgeschlossenen* Einheiten, Nudges mit konkretem Gewinn. Referenz: https://claude.ai/code/artifact/7ba5aa89-64e7-4539-9512-b601b64c5bb2

## Entschieden (Nick, 2026-08-25)

1. Idealplan-CTA landet direkt auf `/routine` (auto-akzeptiert). Kein Fork-Screen, kein „Plan direkt übernehmen"-Button.
2. Produkt-Check (Stage 3) ist keine Journey-Stufe mehr, sondern das Ende von Modul 1 „Deine Produkte".
3. Zwei Module: `products` (Sektion A) und `habits` (Sektion B). Kein spekulatives Drittmodul-Framework.
4. Fortschritt grob: „2 von 4" (Haar-Analyse · Idealplan · Produkte · Gewohnheiten), nie Fragen-granular. Fortschritt zählt nur **vom Nutzer beantwortete** Fragen (nicht synthetische Defaults).
5. Banner: ✕ gilt bis zum nächsten offenen Modul, danach einmal erneut; Dismissal server-seitig (ersetzt die heutige 24h-Regel).
6. Zeitangabe nur auf dem Banner-Button („· 2 Min." / „· 3 Min."), nicht in den Profil-Zeilen.
7. Blockierte/Fallback-Kategorien: server-seitig als „deferred" Rolle mit persistiertem Grund (nutzt Stage-3 `leave_uncovered`); Routine rendert Platzhalter-Step mit Link in Modul 1.
8. Alt-Nutzer sind Testnutzer: einfaches State-Mapping, kein Feature-Flag.
9. Nav bleibt unverändert (aktuell: Chat · Routine · Anwendung · Profil; Scan versteckt).
10. PostHog-Events erst NACH dem Ship (separater Schritt, nicht Teil dieser PRs).
11. **PR-Schnitt (rev. 2):** PR 1 ist rein additiv und nutzer-unsichtbar (Backend-Modell); der sichtbare Cutover (Fork-Entfernung + alle neuen Oberflächen) liegt komplett in PR 2. Kein Zwischenzustand mit alter Banner-UX auf neuem Accept-Pfad.
12. **Routine-Update bei Modul-Abschluss:** sofortige Aktivierung (Mockup-Verhalten „✓ Plan aktualisiert"), kein Proposal-Pending. Verlust manueller Routine-Anpassungen beim Recompute in Kauf genommen (Testnutzer). **Bestätigt von Nick 25.08.** [Umsetzung nachgereicht 2026-08-31: plans/2026-08-31-feinschliff-modular-exit.md]
13. **Stage-1-CTA:** „Zu deiner Routine". **Bestätigt von Nick 25.08.**
14. **Nav-Orientierung: Punkte + selbsterklärende Tabs, keine Popups.** Unbesuchte Tabs tragen einen dezenten Punkt (einmalig, verschwindet nach erstem Besuch, Zustand persistiert); jeder Tab erklärt sich beim ersten Öffnen durch seinen Inhalt. Keine Tour, keine Tooltips (Research 25.08.: 76 % der Tooltips <3 s dismissed, Tour-Amnesie, NN/g: Overlays nur für unvertraute UI — 4 klar beschriftete Tabs sind es nicht; Duolingo/Instagram-Muster). **Bestätigt von Nick 25.08.**

## Ist-Zustand (Code-Referenzen, verifiziert 2026-08-25, Korrekturen aus Codex-Review eingearbeitet)

- Fork: `src/components/personal-plan-journey/plan-fork-screen.tsx`, erreicht via `plan-start-flow.tsx`; Accept via `POST /api/personal-plan/accept-ideal-plan` mit striktem Seen-State-Contract (`direct-acceptance/accept.ts:105-136` — exakter Abgleich Client-gesehene Rollen ↔ Server-Stage-3-Evaluation; blockierte Kategorien existieren, weil Defaults ungesehene Rollen materialisieren können).
- Auto-Accept schreibt heute synthetische Defaults als echte Antworten und markiert **alle** kanonischen Fragen als beantwortet, dann Voll-Abschluss (`accept.ts:238-280`). Es gibt keine Provenienz „vom Nutzer beantwortet" vs. „angenommen".
- `directAcceptanceAssumptions()` liefert nur Anzeige-Zeilen `{id,label}`; die Werte liegen in `buildDirectAcceptanceStage2Defaults()` (`defaults.ts:51-116`). Der Default-Builder deckt Konditionalfragen (z. B. `oil_purposes` bei vorhandener Öl-Antwort) NICHT vollständig ab.
- Stage-2-Persistenz ist terminal: Status `in_progress | complete | stale`, genau EIN Ergebnis-Version-Slot, atomare Abschluss-RPC (staled aktive Stage-3-Drafts, setzt `current_refined_need_version_id`, enqueued Source-Change) — `supabase/migrations/20260808062602_personal_plan_stage1_3_foundation.sql:45-69, 293-322`. „Modul 1 fertig, Modul 2 offen mit neuer Plan-Version" ist heute nicht ausdrückbar.
- `/plan-start` resumed Stage 3 nur bei `complete` + `completedHandoff` (`plan-start/page.tsx:133-188`, `refinement/session.ts:11-25`).
- `computeNeedPlan()` selbst ist wiederverwendbar — die Vollständigkeitsprüfung sitzt im Service/Adapter, nicht im Engine (`compute-stage1.ts:67-81`).
- Sektions-Zuordnung ist heute UI-lokal in `getQuestionSection()` (`refinement-question.tsx:684-692`), NICHT in `question-path.ts`.
- Aktive Routine + neue Plan-Version ⇒ Successor-**Proposal** (pending), keine sofortige Aktivierung (`20260808062603_personal_plan_routine_backend.sql:321-338`, `20260811154526_...activation_v1.sql:32-40`). Proposal-Accept cleart heute `unrefined_direct_accept` (`proposal-service.ts:274-288`).
- Heutiges Nudge-Banner: 24h-Dismiss, CTA in den linearen `?refine=1`-Flow (`routine/nudge.ts`, `routine-refinement-nudge.tsx`); Tests fixieren die 24h-Regel (`tests/personal-plan-routine-nudge.test.ts:89-110`).
- Journey-Header wird auf 5 Flächen gerendert: Stage 2 (`refinement-flow.tsx:543`), Stage 3 (`personal-plan-products/index.tsx:96`), Routine (`routine-page.tsx:118`), Routine-Editor, Anwendung (`application-page.tsx:176`).
- Profil lädt `/api/personal-plan/refinement-presentation`, das nur **abgeschlossene** Drafts der aktuellen Version liest (`refinement-presentation/route.ts:78-145`) — kein Modul-Status.
- Nav: `navigation-access.ts:35-45` — enthält Chat, versteckt Scan.
- `npm run ci:verify` = Typecheck + Lint + Build, **keine Tests**; Personal-Plan-Suiten und Playwright-Journeys sind separate npm-Scripts (server-only Shim, nie bare `npx tsx --test`).

## PR 1 — Modul-Modell im Backend (additiv, nutzer-unsichtbar)

Kein sichtbares Verhalten ändert sich; alter Fork/Nudge bleiben funktional.

### Task 1.1 — Modul-Modell im Pfad (TDD)
`refinement/question-path.ts` + `types.ts`: festes Zwei-Wert-Modell `products | habits`. Die heutige UI-lokale `getQuestionSection()`-Zuordnung wandert in das Pfadmodell (UI konsumiert sie von dort). Pfad-API liefert pro Modul: Fragen, beantwortet/offen, Modul-Status. Fixtures für Konditionalpfade (Öl, Trockenshampoo, Kopfhaut, 0–7 Heat-Events). Keine Abstraktion für hypothetische weitere Module.

### Task 1.2 — Antwort-Provenienz (TDD + Migration)
Neue persistierte Provenienz pro Antwort: `user | assumed`. Auto-Accept schreibt Defaults künftig als `assumed`; Bestandsdaten: Migration mappt Antworten in Auto-Accept-Drafts auf `assumed`, echte Stage-2-Antworten auf `user` (Testnutzer ⇒ grobes Mapping reicht, dokumentieren). Fortschritt („X von 4") und Modul-Status leiten sich ausschließlich aus `user`-Antworten ab; Projektions-Vollständigkeit aus `user ∪ assumed`.

### Task 1.3 — Typisierter Default-Resolver (TDD)
Ersetzt die Lücken des heutigen Default-Builders: liefert für JEDE offene kanonische Frage einen Annahme-Wert, ausgewertet gegen die aktuellen Partial-Antworten (inkl. Konditionalfälle wie `oil_purposes` bei Nutzer-Öl-Antwort, Heat-Events je gewählter Route). Adversarial-Lane: Rule-ID-Fixtures nur für die Resolver-Regeln, getrennte Review (feedback: eigene grüne Tests sind keine Evidenz).

### Task 1.4 — Modul-Projektions-RPC (Migration + TDD)
Neue atomare RPC „complete_module": CAS auf Draft-Revision, idempotent (Replay-sicher bei lost response), Draft bleibt `in_progress`, schreibt neue Need-Version aus `user`-Antworten ∪ Resolver-Annahmen, persistiert Projektions-Lineage am Draft (welche Version aus welchem Modul-Stand), advanced `current_refined_need_version_id`, staled Stage-3-Drafts der Vorversion (bewusst — Reconciliation s. Task 1.6). Voll-Abschluss (beide Module) nutzt weiterhin die bestehende Abschluss-RPC-Semantik. Persistierter Modul-1-Handoff-Marker, damit Stage-3-Einstieg einen Reload überlebt (heute nur bei `complete`).

### Task 1.5 — Deferred-Rollen server-seitig (TDD)
Accept-Contract: exaktes Seen-State-Pinning bleibt für echte Empfehlungen. Rollen, die der Client nicht gesehen hat (blocked/fallback), leitet der **Server** in eine explizite `deferred`-Entscheidung ab (nutzt Stage-3 `leave_uncovered`) mit persistiertem Grund (`refinement_required | no_product`). Kein Aufweichen der Seen-State-Garantie, keine 409-Schleife.

### Task 1.6 — Ordnungs-Semantik Modul 2 ↔ Stage 3 + Routine-Aktivierung (TDD)
(a) Modul-2-Abschluss bei offenem Modul-1-Stage-3-Draft: Stage-3-Draft wird gestaled; definierter Wiedereinstieg (Draft-Neuaufbau auf neuer Version, Nutzer-Auswahlen gehen verloren — akzeptiert, Testnutzer; dokumentieren). (b) Aktive Routine + Modul-Recompute: sofortige Aktivierung des Successors statt pending Proposal (Entscheidung 12); `unrefined_direct_accept`-Flag wird durch Modul-Status-Ableitung ersetzt (nicht mehr durch Proposal-Accept gecleart). Direct-Accept-Provenienz wird Teil der atomaren Accept-Transaktion (heute best-effort).

### Task 1.7 — Modul-Status-API
Endpoint (oder Erweiterung von `refinement-presentation`): liefert Modul-Status (`products`/`habits`: offen/fertig, aus `user`-Provenienz), Fortschritt „X von 4", Banner-Zustand — auch für nicht-abgeschlossene Drafts. Vertrag, den PR 2 (Banner, Profil) konsumiert.

### Task 1.8 — Banner-Lifecycle-Persistenz (Migration)
Dismissal-State pro Nutzer+Modul (ersetzt 24h-Regel): ✕ gilt bis das nächste Modul offen wird, dann genau ein Reappear. Spalten degradieren lesend zu „kein Banner" (Deploy-Reihenfolge unkritisch, Muster wie `repository.ts:72-108`).

## PR 2 — Cutover: Oberflächen + Fork-Entfernung (nutzer-sichtbar, atomar)

### Task 2.1 — Auto-Accept statt Fork
Stage-1-CTA (Wortlaut s. Walkthrough) → Accept (mit Deferred-Rollen aus 1.5) → `/routine`. `plan-fork-screen.tsx` + Fork-Stage entfernen. Client-Blocker (fallback/refinement-required) entfallen — sie sind jetzt server-seitige Deferred-Entscheidungen.

### Task 2.2 — Platzhalter-Steps in der Routine
`deferred`-Rollen rendern als ruhiger Step „Empfehlung folgt" mit Link in Modul 1 (Grund-spezifische Copy).

### Task 2.3 — Banner auf der Routine
Ersetzt `routine-refinement-nudge.tsx` vollständig (inkl. Löschung der 24h-Tests, neue Tests auf Modul-Lifecycle). Inhalt Mockup v3: „Mach deinen Plan genauer." + Balken + „X von 4" + „Weiter · 2 Min." + ✕; nach Modul 1: „Noch ein Schritt: deine Gewohnheiten." „· 3 Min." unterhalb der Routine-Blöcke. CTA führt in den Modul-Kontext (nicht in den linearen Gesamt-Flow).

### Task 2.4 — Modul-Einstiege im Refinement-Flow
`refinement-flow.tsx`: Einstieg pro Modul (Banner/Profil übergeben Modul), Fragen des Moduls in bestehender Reihenfolge; Modul-Abschluss ruft `complete_module`; nach Modul 1 Handoff in Stage 3 (persistenter Marker aus 1.4); nach Modul 2 wie heutiger Voll-Abschluss — [Superseded 2026-08-31: der schließende Verhalten-Abschluss führt zurück zur Routine mit headless Recompute; siehe plans/2026-08-31-feinschliff-modular-exit.md]. Resume bleibt fragegenau.

### Task 2.5 — Profil-Tab: Haarprofil-Sektion
`profile/page.tsx` + Modul-Status-API (1.7): Balken + „X von 4" + 4 Zeilen (Haar-Analyse ✓ · Dein Idealplan ✓ → Link zur Plan-Ansicht · Deine Produkte › · Deine Gewohnheiten ›), ohne Minuten. Loading-/Error-/kein-Plan-Zustände definiert.

### Task 2.6 — „Plan aktualisiert"-Toast
Auf `/routine` nach Modul-Abschluss, gekoppelt an die tatsächliche Aktivierung der neuen Routine (1.6b). Minimal, kein Diff-Display.

### Task 2.7 — Journey-Header-Matrix
Header-Rückbau pro Fläche: Routine, Routine-Editor, Anwendung, Stage 3 → Header entfällt (Nav trägt). Stage 2 (im Modul) → minimales Chrome ohne 5-Stufen-Bar. Quiz/Plan-Erstellung unverändert.

### Task 2.8 — Copy-Feinschliff
Alle neuen Strings final (deutsch, Telegramm-Stil). Stage-1-CTA: „Zu deiner Routine" (Entscheidung 13).

### Task 2.9 — Unbesuchte-Tab-Punkte
`personal-plan-navigation.tsx`: dezenter Punkt auf noch nie besuchten Tabs (Entscheidung 14). Besucht-Zustand persistiert (gleiche Lifecycle-Tabelle wie Banner, 1.8); Routine gilt als besucht (Landing). Kein Tooltip, keine Tour. A11y: Punkt ist dekorativ (`aria-hidden`), kein Fokus-Hijack.

## Nicht in Scope

- PostHog-Events/Monitoring (nach Ship; Erfolgsmaß: Modul-1-Abschlussrate, D7).
- Nav-Umbau (bleibt: Chat · Routine · Anwendung · Profil; Scan versteckt).
- Drittes Modul, Angaben-granularer Meter, Live-Update pro Antwort, Diff-Anzeige im Toast.
- Onboarding-Flow (obsolet, unberührt).

## Deploy-Reihenfolge (WICHTIG)

Die PR-1-Migrationen sind additiv (neue Spalte/RPCs). Zwingende Reihenfolge beim Ship: **Migrationen zuerst auf Prod anwenden, DANN mergen/deployen.** Alter Code ignoriert die neuen Spalten (sicher); neuer Code ohne Migration bricht Stage-2-Loads.

Vor dem Anwenden auf Prod: die `complete_module`-RPC auf einem Supabase-Branch oder lokal (`supabase start`) durchspielen — Lineage-Merge, Replay bei gleicher Revision, CAS-Konflikt, stale_source, Stage-3-Draft-Staling, Grants (anon/authenticated verweigert, service_role erlaubt). Grund: die Unit-Suiten spiegeln die SQL-Semantik nur in TS-Fakes (Review-Finding I-2, Task 1.4).

## Verifikation

- `npm run ci:verify` (Typecheck+Lint+Build) **plus** die Personal-Plan-Test-Scripts (server-only Shim) **plus** Playwright-Journey-Scripts — alle drei, nicht nur ci:verify.
- Neue/ersetzte Suiten, namentlich: Modul-Pfad inkl. Konditional-Fixtures (1.1); Provenienz-Ableitung `user` vs `assumed` inkl. Alt-Auto-Accept-Mapping (1.2); Default-Resolver-Regeln inkl. `oil_purposes`-Konditionalfall (1.3); `complete_module` CAS/Idempotenz/Replay/lost-response (1.4); Deferred-Accept: blocked-scalp, all-fallback/zero-recommendation (1.5); Modul 2 bei offenem Stage-3-Draft + Aktivierung statt Proposal + Toast-Timing (1.6/2.6); Banner-Lifecycle inkl. failed-POST/Reload (1.8/2.3, ersetzt 24h-Tests); Modul-Deep-Links/Re-Entry + Profil-Zustände (2.4/2.5).
- Manuell (dev server, localhost, Neustart nach Lib-Änderungen): Quiz → Plan → Routine (Banner) → Modul 1 → Stage 3 → Toast + konkrete Produkte → Modul 2 → Voll-Abschluss; ✕-Dismiss + Reappear; Resume mitten im Modul; blocked-scalp-Szenario; Alt-Draft-Resume; Auto-Accept-Alt-Nutzer zeigt „2 von 4".

## Codex-Review (2026-08-25, xhigh)

Verdict rev. 1: Request changes — 7 Blocker. Alle in rev. 2 eingearbeitet (Persistenz-Modell 1.2/1.4/1.8, Provenienz 1.2/1.3, Seen-State/Deferred 1.5, Ordnung/Aktivierung 1.6, PR-Schnitt Entscheidung 11, Profil-API 1.7, Header-Matrix 2.7, Test-Katalog). Nicht übernommen: erneuter Counterpart-Lauf innerhalb des Codex-Agents (Repo-Regel: genau eine Reviewer-Lane pro Pass).

## Offene Punkte

Keine — alle Entscheidungen (1–14) bestätigt, Journey abgenommen, Codex-Review eingearbeitet. Implementierung startet mit PR 1, Task 1.1.
