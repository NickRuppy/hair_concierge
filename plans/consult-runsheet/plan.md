# Consult-Runsheet & Hair-Expert-Agent — Programm-Plan (Rev. 3)

Datum: 2026-09-27 · Worktree: `.worktrees/consult-runsheet` (`codex/consult-runsheet`, Base `cf7f4604` = origin/main Tip, verifiziert)

## 1. Outcome und Quellkontext

Das Discovery-Cockpit (`/admin/beratung/[id]`) wird zum **Call-Runsheet in Nicks sechs Gesprächsphasen** (Eröffnen · Problem · Produkte · Routine · Feedback & nächste Schritte · Abschluss), und ein **Consult-Agent** komponiert daraus zur Call-Vorbereitung einen Beratungs-Brief (Diagnose, Hebel, Begründungen), den Nick vor dem Call prüft und editiert.

Quelle: Design-Session 2026-09-27 (Devil's-Advocate-Review der Nomi-Seite → Konsultations-Testlauf → Architektur- und Agenda-Rulings). Evidenz: Runsheet-Mockup Iteration 2 mit Nomis echten Daten — `plans/consult-runsheet/evidence/runsheet-mockup-iteration2.html` (Artifact https://claude.ai/artifact/AvwmpqnvjtSSR6ypNnuJNB, Version 2), Richtung von Nick bestätigt („I like that … let's do it and keep it lean").

## 2. Gewählte Richtung

**Engines entscheiden Fakten, der Agent komponiert die Beratung, Nick gated sie.**

- Deterministisch und vom Agenten nicht überschreibbar: Katalogfakten, Produkt-Verdicts, Swap-Rankings, Idealroutine-Gerüst, Guardrails (medizinische Grenzen, verbotene Claims wie „reparieren/heilen", Evidenz-Grenzen).
- Der Hair-Expert-Agent läuft zur Vorbereitung (Intake abgeschickt + Recherche fertig), konsumiert Profil + Intake + Hitze-Daten + Verdicts + Wissensbasis und schreibt den Brief als strukturierte Sektionen: Diagnose-Erzählung mit Ursachenkette, die drei Hebel mit Punkten, Begründung pro Swap in Beratungssprache, Ziel-Lücken-Sätze (z. B. „Form & Halt"), Fragen für den Call, Erwartungs-Sätze.
- Übergang: zunächst manuelle Review + AI-assistiertes Reasoning durch Nick; nach Tests mit mehreren Profilen komponiert der Agent vollständig. Die 50–100 Calls sind der Mining-Loop: Erkenntnisse, die die Seite nicht zeigte, werden Wissensbasis-Einträge (Prosa/strukturiert); formale Regeln nur für Guardrails.

## 3. Programm-Slices

Unabhängig shipbare Slices; jede bekommt vor Implementierung ihren eigenen Detail-Plan (dieser Plan enthält Slice 1 im Detail):

| Slice | Inhalt | Status |
| --- | --- | --- |
| **1 — Runsheet v1** | Cockpit-Umbau auf 6 Phasen mit bestehenden Daten; Kohärenz-Fixes; Score/Feedback/Touchpoints/Brief-Felder (manuell editierbar) | dieser Plan |
| **2 — Consult-Agent v1** | Brief-Generierung serverseitig (Claude API) per „Brief erstellen"-Button (R14); Gesamt-Regenerierung mit Edit-Warnung + Revisionshaltung (R15); Guardrail-Liste; Eval-Fixtures (Golden-Profile inkl. Nomi); Wissensbasis-Struktur + Mining aus Phase-5-Notizen (R16) | Plan folgt |
| **3 — Verdict-Schicht** | `mask.care_direction` global korrigieren + akzeptiertes Set anzeigen (R12); Preise + Händler auf allen Alternativ-Karten, Sortierung Fit/Preis (R19); Frequenz-Delta-Chips (numerische Kadenz-Bänder); Cockpit-Varianten für geteilte Verdict-Texte (neutrale Stimme vollständig) | Plan folgt |
| **4 — Routine-Engine** | Discovery-Kompositionsschicht (R11): produkt-verankerte Schritte (Rollen-Merge mit Einsatz-Momenten), Tiering via `stepWeights` in Concern-Recipes, Weight-Budget für feine/„schnell platt"-Profile, konkrete Frequenz-Defaults statt „nach Herstellerangabe", Ist-vs-Ideal-Delta; Waschfrequenz-Regler rechnet Woche neu; Graduierung in geteilte Engine nach Call-Validierung | Plan folgt |
| **5 — PDF v2 + Loop** | PDF mit Hebeln in Prioritätsreihenfolge (ohne Score-Zahlen, R13), Gewohnheits-Commitments, Wochenansicht, Preisen; Re-Score-Erfassung bei Touchpoints (kalibriert die Treppen-Gewichte) | Plan folgt |

Reihenfolge-Begründung: Slice 1 macht die nächsten Calls sofort besser und schafft die Datenfelder; Slice 2 liefert das AI-assistierte Reasoning, das Nick jetzt will; 3/4 sind Engine-Arbeit (TDD), 5 schließt den Loop.

## 4. Entscheidungs-Ledger (Session 2026-09-27)

Decision coverage: **confirmed** (für Slice 1; Slices 2–5 erben die Architektur-Rulings, offene Punkte stehen in ihren Plänen)

**Confirmed with Nick:**
- R1 Cockpit = Call-Runsheet in den 6 Phasen; Mockup Iteration 2 als Richtung.
- R2 Architektur-Split: deterministische Fakten-Engines + Consult-Agent zur Prep-Zeit + Nick-Gate; lean bauen; Ziel: Agent komponiert nach Multi-Profil-Tests vollständig.
- R3 Score: Baseline 1–10 auf der Seite; Score-Treppe mit Punkten pro Hebel als grobe Orientierung („rough indication"); Ziel durch Profil gedeckelt (nie 10); Re-Scores bei Follow-ups.
- R4 Produkt-Phase: drei Buckets **Behalten / Weglassen / Tauschen oder neu**, Routine-Kategorie an jedem Item verankert; unrecherchierte Produkte als „Klären"-Banner vor dem Call, nie als „benutzt nichts".
- R5 `mask.care_direction`-Always-Pass wird korrigiert („correct this then"); Anzeige des akzeptierten Sets (Slice 3).
- R6 Stimme: Cockpit durchgehend neutrale dritte Person („fix the mixed voice").
- R7 Fotos: kein Intake-Bestandteil (von Nick verworfen).
- R8 Produkt-Zufriedenheit: nicht erfassen; wird live im Call erfragt.
- R9 Budget: Preis auf Alternativen sichtbar; Budget-Band aus ihren vorhandenen Produkten abgeleitet (revealed preference), überschreibbar; Preis kippt nie passt/passt-nicht (Slice 3).
- R10 Routine-Engine wird umgebaut (nicht nur Darstellung): Rollen-Merge, Tiering, Weight-Budget, konkrete Frequenzen (Slice 4).

*Interview-Rulings 2026-09-28:*
- R11 Engine-Umbau lebt zuerst als **Discovery-Kompositionsschicht** über der bestehenden Engine (Mitglieder unberührt); Graduierung in die geteilte Engine erst, wenn ~20–30 Calls das Modell validiert haben.
- R12 `mask.care_direction` wird **global in der Authority korrigiert** (Korrektheits-Fix; einzelne Mitglieder-Scan-Verdicts wechseln von „passt" zu „mit Einschränkung" — akzeptiert), fixtures-first.
- R13 PDF: Hebel in Prioritätsreihenfolge mit Klartext-Wirkung; **keine gedruckten Score-Zahlen/Treppe** — die Zahlen bleiben gesprochenes Call-Werkzeug. PDF iteriert ohnehin nach dem Cockpit.
- R14 Agent-Trigger: manueller „Brief erstellen"-Button (aktiv ab Intake-Submit); Auto-Trigger später bei Bedarf.
- R15 Brief-Editing: **Gesamt-Regenerierung** (Sektionen sind interdependent); Nicks Edit-Pass kommt zuletzt; Regenerieren nach Edits warnt und behält die vorherige Fassung als Revision.
- R16 Mining-Loop: Phase-5-Notizfeld → Session destilliert daraus Wissensbasis-Einträge + Eval-Fixtures, Nick approved.
- R17 Habits: **keine neuen Intake-Fragen.** Verhaltens-Hebel tragen konditionale Inline-Prompts im Problem-Abschnitt („kurz fragen: …" + Empfehlung), gesteuert vom Hauptproblem; Commitments werden aus Recipe-Presets + Call-Antworten erfasst. Tiefere Habit-Fragen später nur via care-habits-SoT, falls das Mining wiederkehrenden Bedarf zeigt.
- R18 Cutover: **alte Cockpit-Ansicht wird ersetzt**, kein Toggle.
- R19 Alternativen: **sortierbar nach Fit (Default) und Preis**; Preis + Händler auf jeder Karte; Preis kippt nie Verdicts. Budget-Band-Annotation („in ihrem Rahmen") als Slice-3-Option geparkt.
- R20 Referral-Copy v1 wie im Mockup freigegeben („okay for now") — O2 damit aufgelöst; Feinschliff später.
- R21 Batch 9 (#616) ist bereits im Base enthalten — keine Sequenz-Entscheidung nötig (Korrektur eines veralteten Stands).

**Inherited from evidence or contract:**
- Finalize-Gates (Recherche offen / Anwendung fehlt) und PDF-Sperre bleiben unverändert (bestehender Cockpit-Vertrag, PR #600ff).
- Forschungs-Unsicherheit bleibt intern; keine Confidence-Felder Richtung Nutzerin (Standing Rule 2026-09-03).
- Kosmetik getrennt von medizinisch-angrenzender Kopfhaut-/Haarausfall-Beratung; Grenz-Zeile bleibt (CLAUDE.md).
- Coral = CTA, Plum = Auswahl-Akzente (Standing Rule 2026-07-28).
- O1 (Freitext-Hauptproblem) AUFGELÖST per Code-Befund: die Quiz-Projektion rendert das „Etwas anderes"-Freitextfeld bereits nach den Karten (`src/lib/discovery/quiz-answers.ts`, concernRow); Nomis Feld war schlicht leer. Kein separates Eingabefeld nötig; Walkthrough prüft die Anzeige mit einem Enrollment, das Freitext enthält.
- Batch 9 (PR #616, live): ein Routine-Schritt kann mehrere Produkte mit je eigenem Verdict + eigener Entscheidung tragen — Bucket-Ableitung muss pro Intake-Eintrag arbeiten (siehe T2).

**Implementation defaults:**
- Slice 1: Treppe/Hebel/Diagnose als manuell editierbare Brief-Felder (Agent befüllt sie ab Slice 2); Punkte-Quelle v1 = Nicks Eingabe, später normative Recipe-Gewichte.
- Follow-up-Touchpoints: manuell (WhatsApp/Call durch Nick); das Tool erfasst nur Termine + Re-Scores, keine Automatisierung.
- Agent (Slice 2): stärkstes Claude-Modell, serverseitig, deutsche Ausgabe; Volumen ist klein, Kosten unkritisch.
- Brief-Speicherung als JSONB pro Enrollment in neuer service-role-only Tabelle (Muster `discovery_admin_item_usage`).
- Referral-Nachricht zeigt auf `/lp/call` (bestehender Funnel).

**Open consequential assumptions:** keine. (O1 per Code-Befund aufgelöst; O2 per R20 aufgelöst; O3/O4 bleiben als bewusst geparkte Slice-Grenzen dokumentiert.)
- O3 Waschfrequenz-Regler in Phase 4 ist in Slice 1 Anzeige + Notiz; Neu-Berechnung der Woche erst mit Slice 4. → *parked out of scope Slice 1*, mit Nicks Kenntnis (Mockup zeigt statischen Regler).
- O4 Geteilte Verdict-Texte (du-Stimme aus Teilnehmer-App) erscheinen im Cockpit bis Slice 3 als zitierte Produktstimme; Cockpit-eigene Copy ist ab Slice 1 neutral. → *parked out of scope Slice 1*.

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nicks Session-Rulings 2026-09-27, insbesondere „I like that. That sounds like quite a good approach … let's do it and keep it lean, and at the same time build this run sheet" sowie die Einzel-Rulings R3–R9 in der Konversation.

Internal revalidation: Rev. 2 nach Codex-Plan-Review 2026-09-27 (approve-with-revisions, F1–F5 eingearbeitet, alle gegen den Code verifiziert); O1 per Code-Befund aufgelöst. Rev. 3 nach Nicks Interview 2026-09-28 (R11–R21): alle offenen konsequenziellen Forks geschlossen, O2 aufgelöst, Cutover „straight replace" bestätigt.

## 5. Designed Operator-Journey (Slice 1)

Akteur: Nick (Admin). Eintritt: Enrollment mit abgeschicktem Intake.

1. **Vor dem Call:** Nick öffnet `/admin/beratung/[id]`. Kopf: Name, Status, Score-Kachel (Baseline leer → Eingabefeld; Ziel erscheint, sobald Hebel-Punkte existieren). „Vor dem Call"-Checkliste zeigt abgeleitete Punkte: offene Recherche (mit Produktbezug), fehlender Score, Standing-Fragen aus Profil-Flags (blondiert → Blondier-Rhythmus; „reißt sofort" → Kamm/Bürste; immer → Einkaufsort). Er füllt Diagnose/Hebel manuell (AI-assistiert in Session, ab Slice 2 vom Agenten vorbefüllt) und prüft die Buckets.
2. **Im Call:** Er scrollt die Phasen 1→6 als Skript: Eröffnungs-Karte, Diagnose + Treppe, Produkt-Buckets mit Kategorie-Ankern und Swaps, Wochenansicht mit Frequenzen, Feedback-Feld + Touchpoint-Chips, Referral-Text mit Kopieren-Button.
3. **Fehler/Zwischenzustände:** unrecherchiertes Produkt → Banner in Phase 3 und Checklisten-Punkt, Kategorie-Bucket zeigt das Produkt mit Status „in Recherche" (nie „benutzt nichts"); leerer Bucket zeigt erklärenden Leerzustand; Finalisieren bleibt durch bestehende Gates gesperrt und nennt Gründe.
4. **Abschluss:** Feedback + Touchpoints gespeichert, Finalisieren + PDF wie bisher. Keine Teilnehmerinnen-Oberfläche ändert sich in Slice 1.

Journey-Sign-off: über Mockup Iteration 2 in der Session erteilt (R1); Slice 1 implementiert dieses Design ohne materielle Abweichung.

## 6. Slice 1 — Target Map

- Cockpit-Seite/Komponenten: `src/app/admin/beratung/[id]/*`, `src/components/discovery/cockpit/*`
- Read-Model: `src/lib/discovery/cockpit*` (bestehende Loader), neu `src/lib/discovery/runsheet/` (Bucket-/Checklisten-Ableitung, pure)
- Persistenz: neue Migration + Tabelle `discovery_call_sheets` (enrollment_id PK/FK; RLS: service_role only). Spalten-Verträge (autoritativ, F5):
  - `baseline_score smallint` CHECK (1–10), nullable
  - `rescores jsonb` — Array `{ score: 1–10, at: ISO-Timestamp, channel: "whatsapp"|"call" }`
  - `touchpoints jsonb` — Array `{ kind: "text_checkin"|"rescore_call", due_on: ISO-Date, done_at: ISO-Timestamp|null }`
  - `consult_brief jsonb` — `{ sections: { diagnose, hebel[], swapReasons{}, zielLuecken[], callFragen[], erwartungen[] }, generated_at: ISO|null, generated_by: "manual"|"agent", source_hash: string|null }` — `source_hash` über Profil+Verdict-Input, damit Slice 2 einen editierten Brief als veraltet erkennen kann
  - `habit_commitments jsonb` — Array `{ id: string, label: string, committed: boolean }`
  - `feedback text`
- Admin-Routen: `src/app/api/admin/beratung/*` (Muster bestehender Cockpit-Writes)
- Recipe-Anzeige („hat sie / hat sie nicht"): Ableitung inkl. unrecherchierter Intake-Items — Seam in `src/lib/discovery/` Cockpit-Read-Model
- Fußzeile „Nicht in der Idealroutine": Copy/Semantik-Fix am bestehenden Renderer

## 7. Slice 1 — Geordnete Tasks

**T1 — Migration + Tabelle `discovery_call_sheets`.**
Produces: Tabelle wie in §6, Grants service_role-only, Migrationsversion kollisionfrei (Lesson Scan-Hardening). Kriterium: Migration lokal angewendet, Spalten/CHECKs/Grants per SQL verifiziert; Test: Schema-Assertion im bestehenden Migrations-Testmuster.

**T2 — Runsheet-Ableitungen (pure, TDD).**
Consumes: bestehendes Cockpit-Read-Model (Verdicts, Idealroutine, Intake-Items inkl. Recherche-Status, Entscheidungen, `unassigned`-Projektion). Produces: `deriveBuckets()` → { behalten, weglassen, tauschenOderNeu, klaeren }, **abgeleitet pro Intake-Eintrag** — jeder Bucket-Eintrag behält `intakeItemId` + `decisionKey` (Batch 9: mehrere Produkte pro Schritt mit unabhängigen Entscheidungen, F2) — mit Kategorie-Anker + Hebel-Referenz; `derivePrepChecklist()` → offene Recherche, fehlender Score, Standing-Fragen aus Profil-Flags (kleine deterministische Regelliste, Keim der Wissensbasis). Kriterium: `npm run test:node`-Suiten mit Fixtures: Nomi-Konstellation, leerer Bucket, unrecherchiertes Item in besetzter Kategorie, **gleicher Schritt mit 2 Produkten und unabhängigen Keep/Swap/Weglassen-Ausgängen** (Chiara-Konstellation), Legacy-Enrollment ohne neue Felder.

**T3 — Cockpit-UI-Umbau auf 6 Phasen.**
Consumes: T1-Felder, T2-Ableitungen. Umsetzung nach `evidence/runsheet-mockup-iteration2.html`: Kopf + Score-Kachel (Baseline-Eingabe), Checkliste, Phase-1-Skriptkarte (statisch), Phase 2 Diagnose/Hebel/Treppe (editierbare Brief-Felder mit Leerzustands-Hinweis; Verhaltens-Hebel tragen konditionale „kurz fragen:"-Prompts mit Empfehlung, R17), Phase 3 Buckets + Recherche-Banner, Phase 4 Wochenansicht aus bestehender Idealroutine + Entscheidungen, Frequenzanzeige („heute 2× — bleibt", Regler statisch, O3), Preise nur wo Katalogdaten existieren, Phase 5 Feedback + Touchpoints, Phase 6 Referral-Text + Kopieren + bestehendes Finalisieren/Gates/Grenze. Cockpit-eigene Copy durchgehend neutral (R6); geteilte Verdict-Texte als zitierte Produktstimme (O4). Kriterium: Nomi-Seite rendert alle 6 Phasen mit echten Daten; Finalize-Gates unverändert (Regressionscheck).

**T4 — Kohärenz-Fixes.**
(a) Unrecherchierte Items erscheinen in ihrer Kategorie/ihrem Schritt mit Status „in Recherche" — **als reine Anzeige-Overlay über dem Read-Model: die `unassigned`-Projektion (`refined-routine.ts` reduceIntakeItemsToSteps) und ihre Konsumenten `discoveryResearchOpenItems`/Finalize-Route/PDF-Weiche bleiben unverändert** (F1); die Aussage „Sie benutzt für diesen Schritt aktuell nichts" darf nur bei wirklich leerem Intake erscheinen; (b) Rezept-Zeile „hat sie / hat sie nicht" konsistent mit (a); (c) Fußzeile „NICHT IN DER IDEALROUTINE" listet keine Kategorien mehr, die oben als Schritte stehen — Copy präzisiert auf „nicht genutzt und ohne Entscheidung nötig". Kriterium: Fixture-Test „gescannter Conditioner in Recherche" zeigt Produkt in Schritt/Bucket UND `discoveryResearchOpenItems` liefert ihn weiterhin; Footer-Snapshot ohne Widerspruch.

**T5 — Persistenz-Routen + Wiring.**
Consumes: T1. Score/Brief/Commitments/Feedback/Touchpoints lesen+schreiben (admin-gated, service-role, Muster bestehender Cockpit-Writes; Entwürfe frei editierbar, keine Freeze-Logik neu). Kriterium: Roundtrip-Test der Routen; manueller Speichern-Flow in der UI.

Artefakt-Disposition: Plan + `evidence/runsheet-mockup-iteration2.html` → **commit** (dieser Worktree, PR); Chat-Iteration-1-Stand → **discard** (in Iteration 2 aufgegangen); Codex-Review-Output → transient, **discard** nach Ledger-Eintrag.

## 8. Verifikation (Slice 1)

- Automatisiert: neue `test:node`-Suiten (T2, T4-Fixtures, T5-Roundtrip); volles `npm run ci:verify` auf dem finalen Baum. **Benannte Regressions-Checks (F4):** `tests/discovery-pdf-page.test.tsx` erweitert um den Fall „research-pending Item wird in seiner Kategorie angezeigt → `/pdf` leitet weiterhin um"; Finalize-Route-Refusal-Test für dieselbe Konstellation.
- Manuell/Browser: Cockpit-Walkthrough mit Nomis Enrollment (`6ebb7e7b…`) und einem Legacy-Enrollment (Tile-Ära) — alle 6 Phasen, Leerzustände, Banner, Kopieren-Button, Finalize-Gates; dev-Server per `npm run dev:worktree`, localhost (nicht 127.0.0.1), Server-Neustart nach Lib-Änderungen.
- Migration: lokal anwenden + verifizieren; Prod-Apply erst auf Nicks explizites Go (bestehender Prozess).
- Stimme: Review-Pass über alle Cockpit-Strings (neutrale dritte Person, idiomatisches Deutsch, keine archaischen Imperative).

## 9. Review & Handoff

- Branch/Worktree: `codex/consult-runsheet` in `.worktrees/consult-runsheet`; Basis verifiziert.
- Counterpart-Review: Codex-Plan-Review dieses Plans (big design, Lean-Regel erfüllt) — Findings-Ledger unten nachtragen; danach pro Slice die normale Whole-Branch-Review vor Push.
- Rollout-Risiken Slice 1: neue Tabelle rein additiv; Cockpit ist admin-only (kein Teilnehmerinnen-Risiko); Regressionsfläche = Finalize-Gates und PDF-Weiche (explizit im Walkthrough).
- Stop-Punkt: nach Slice-1-Implementierung ready-check → Codex-Branch-Review → `/ship`; Merge bleibt separates „merge it".
- Nächste Aktion nach Plan-Review: O1/O2 mit Nick klären, dann `implementation-loop` für Slice 1 (subagent-driven, Implementierer auf Opus).

### Findings-Ledger (Counterpart-Review)

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | ---- | -------- | -------- | ----------- | ------------ |
| F1 | defect | `refined-routine.ts` legt research-pending in `unassigned`; `discoveryResearchOpenItems` + Finalize-Route + PDF-Weiche lesen diese Projektion (verifiziert) | accepted | T4(a): Kategorie-Anzeige als Overlay, Projektion + Gates unverändert; Gate-Kriterium ergänzt | Rev. 2 |
| F2 | defect | Batch 9 (#616): mehrere Einträge pro Schritt mit eigenem Verdict/Entscheidung (Kommentar in `refined-routine.ts` verifiziert) | accepted | T2: Buckets pro Intake-Eintrag (`intakeItemId`+`decisionKey`), Multi-Produkt-Fixture | Rev. 2 |
| F3 | defect | Coverage „confirmed" widersprach offenem O1; Code zeigt Freitext-Projektion existiert (`quiz-answers.ts` concernRow, verifiziert) | accepted | O1 als aufgelöst nach „Inherited" verschoben; Walkthrough prüft Freitext-Anzeige | Rev. 2 |
| F4 | defect | PDF-Redirect-Tests decken neue Kategorie-Darstellung nicht ab (`tests/discovery-pdf-page.test.tsx`) | accepted | §8: benannte Regressions-Checks (PDF-Redirect + Finalize-Refusal) | Rev. 2 |
| F5 | tradeoff | Schema ohne Score-CHECK/JSONB-Verträge; Brief-Staleness für Slice 2 | accepted | §6: CHECK 1–10, JSONB-Shapes autoritativ, `source_hash`/`generated_by` im Brief | Rev. 2 |
