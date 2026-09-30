# Consult-Runsheet Iteration 4 — Plan of Record

Feedback-Runde 4 (2026-09-30, Nick, Live-Test auf Prod nach #631). Worktree
`consult-iteration-4`, Base `21c2813f` (= origin/main Tip). Rulings R30–R34
(Fortsetzung des Ledgers aus Runde 2/3).

## Rulings

- **R30 — Hitze-Block zurück in die Quiz-Antworten.** „Hitze & Styling" ist kein
  eigener gepinnter Block mehr (er sah aus wie ein Fold, war aber keiner). Die
  Zeilen wandern in den „Alle Quiz-Antworten"-Aufklapper. Fakt: die Daten kommen
  aus der Intake-Checkliste (`loadHeatStyling`), NICHT aus dem Quiz-Lead — sie
  müssen also explizit mit in den Fold gerendert werden, sonst verschwinden sie
  ganz. Die Hitze-Story bleibt außerdem im generierten Diagnose-Text (v4-Regel).
- **R30b — Eine Problem-Karte.** „Problem kurz erklärt" (mechanik) und
  „Diagnose" verschmelzen zu einer Karte — sie entstehen im selben LLM-Call und
  gehören inhaltlich zusammen (generisch → konkret).
- **R31 — Wärmerer Ton für mechanik.** Prompt v5: verständnisvoll-nahbar statt
  Lehrbuch-kalt; weiterhin generisch, ohne Personenbezug, ohne Versprechen (G1).
- **R32 — Treppe skaliert auf die Lücke.** Hebel-Punkte werden Gewichte: liegt
  die Punktesumme über der Lücke bis 9, skaliert der Code alle Schritte
  proportional herunter (nie hoch — kein erfundener Impact). Ziel bleibt
  min(9, Baseline + Summe); keine flachen +0-Stufen am Cap mehr. Mathe bleibt
  komplett im Code (R3), Felder bleiben editierbare Roh-Orientierung.
- **R33 — Rezept↔Hebel-Kopplung im Prompt.** Jede „Zuerst"-Kategorie des
  Hauptproblem-Rezepts muss im Brief auftauchen: als Produkt-Hebel, ausdrücklich
  in einer Hebel-Note, oder als Call-Frage. Neuer Punkt in der
  Vorab-Checkliste des Prompts.
- **R34 — Anti-Echo Umgang-Hebel ↔ Gewohnheiten.** Prompt: Umgang-Hebel dürfen
  keine Zeile der Rezept-Gewohnheiten umformulieren — nur eigenständige Züge
  mit Score-Gewicht; die Note vertieft (wie genau), statt zu wiederholen.
  UI: Gewohnheiten-Block wird einzeilig-kompakt (keine eigene Sub-Karte).

## Tasks

- **T1 (Opus-Lane, nur `src/lib/discovery/consult-brief/prompt.ts`):**
  Version → `consult-brief-v5`; R31-Tonregel für mechanik; R33-Kopplungsregel
  (+ Checklistenpunkt); R34-Anti-Echo-Regel. Hash wird durch den Versions-Bump
  automatisch stale (Invariante aus Runde 2).
- **T2 (main, TDD):** `runsheetScoreSteps` — proportionale Skalierung auf die
  Lücke (nur runter), Schritte auf 1 Dezimale gerundet, Ziel exakt
  min(Cap, Baseline+Summe); Baseline ≥ Cap bleibt flach. Tests zuerst.
- **T3 (main):** Eine Problem-Karte in `runsheet-brief.tsx` (mechanik +
  Diagnose); `HeatStyling` in `page.tsx` zu schlichten Zeilen umgebaut und in
  den Quiz-Fold verschoben.
- **T4 (main):** Gewohnheiten kompakt (Checkbox-Zeilen ohne Sub-Karten-Rahmen),
  DOM-ids unverändert.
- **T5 (main, nach T1):** Golden-Fixture live auf v5 neu aufnehmen
  (eval-consult-brief), Tonprüfung der 4 Profile; Lint/Eval-Checks angepasst
  falls nötig.
- Danach: voller Testlauf, ci:verify, eine Codex-Whole-Branch-Review, /ship.

## Codex-Review (fix-first, alle 4 behoben)

- **F1** Negative Punkte konnten den Cap durchstoßen bzw. eine flache Baseline
  absenken → `parseRunsheetPoints` lehnt Negative ab (Save-Fehlertext angepasst),
  `runsheetScoreSteps` klemmt Gewichte auf ≥ 0. Regressionstests.
- **F2** Rundung konnte trotz Skalierung eine positive Stufe auf +0 plätten →
  Zehntel-Verteilung nach größtem Rest (deterministisch, Ziel exakt der Cap,
  jede gewichtete Stufe bleibt sichtbar, solange ein Zehntel da ist). Test mit
  dem Codex-Fall (Baseline 8, fünf Gewichte in Lücke 1).
- **F3** swapReasons-Regel unterstellte immer einen Tausch → umformuliert auf
  „vorgeschlagener Zug hinter dem Key" (Tausch/Neuzugang/offen), keine
  Entscheidung behaupten, die nicht im Input steht.
- **F4** Prioritäts-Verbot war nicht gepinnt und das Fixture verletzte es →
  neue Lint-Regel `swap_reason_priority` (eng: „nachrangig", „erster/zweiter
  Schritt", „nicht zuerst"; bloßes „zuerst aufbrauchen" bleibt legal), Fixture
  live neu aufgenommen.

Beim Re-Record zwei vorbestehende Lint-False-Positives gefixt, die der
v5-Ton/die Vertiefungsregel systematisch triggerte: „passt **aber** nicht" gilt
jetzt als benannte Negation (Konjunktion direkt nach „passt"), und „das
**gewählte/empfohlene/neue** Shampoo" zählt nicht mehr als Erwähnung ihres
Produkts (Kategorie-Fallback). Beides testgepinnt; Live-Eval danach 4/4 PASS.

## Nicht in Scope

- Punkte-Neudesign über die Skalierung hinaus (kein festes Punkte-Schema).
- UI-Verweis Rezept↔Hebel (Chips-Mapping) — bewusst nur Prompt-Kopplung.
- Preise/Preis-Audit (läuft als eigene Session), Slice 4/5 unverändert.
