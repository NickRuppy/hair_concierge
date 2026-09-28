# Consult-Agent v1 (Slice 2) — Plan Rev. 1

Datum: 2026-09-28 · Worktree: `.worktrees/consult-agent` (`codex/consult-agent`, Base `3a774a20` = origin/main Tip nach Slice-1-Merge #619, verifiziert)

## 1. Outcome und Quellkontext

Der Hair-Expert-Agent aus dem Programm-Plan (Slice 1, `plans/consult-runsheet/plan.md` auf main, §2/§3): Auf Knopfdruck („Brief erstellen", Phase 2 des Runsheets) komponiert ein LLM-Aufruf den Consult-Brief — Diagnose-Erzählung mit Ursachenkette, Hebel mit Punkten, Begründung pro Swap in Beratungssprache, Ziel-Lücken-Sätze, Call-Fragen, Erwartungs-Sätze — aus Profil, Intake, Hitze-Daten, Verdicts, Buckets und einer kuratierten Wissensbasis. Nick prüft und editiert vor dem Call; nichts Agent-Geschriebenes erreicht eine Teilnehmerin ungeprüft.

Autorisierung: Nicks „let's do it and keep it lean" (Architektur R2) + „merge and then directly continue with the build" (2026-09-28). Alle konsequenziellen Forks wurden im Programm-Plan geruled (R2, R14–R17); dieser Plan setzt sie um. Kein separates Codex-Plan-Review (Lean-Regel: die Architektur wurde bereits im Programm-Plan-Review geprüft; dieser Plan ist Ausführungsdetail) — das Whole-Branch-Review am Ende bleibt.

## 2. Bindende Rulings (geerbt)

- R2: Engines entscheiden Fakten; der Agent komponiert nur Erzählung/Begründung und darf Verdicts, Swap-Rankings, Routine-Gerüst und Guardrails nicht überschreiben oder ihnen widersprechen.
- R14: Trigger = manueller Button, aktiv ab Intake-Submit. Kein Auto-Trigger.
- R15: Gesamt-Regenerierung; Nicks Edit-Pass zuletzt; Regenerieren nach Edits warnt und behält die vorherige Fassung.
- R16: Wissensbasis-Einträge in Prosa/strukturiert, aus dem Call-Mining; formale Regeln nur für Guardrails.
- Slice-1-Verpflichtung: optimistische Konkurrenz gegen das Überschreiben eines neueren Briefs (source_hash/generated_at) — Slice 1 akzeptierte das Risiko nur, weil es noch keinen Agenten gab.
- Standing Rules: Forschungs-Unsicherheit bleibt intern; keine „reparieren/heilen"-Claims; medizinische Grenze bleibt getrennt und erhalten; deutsche Ausgabe.

## 3. Scope und Non-Goals

**Scope:** Wissensbasis-Struktur + Seed; Brief-Generator (Input-Assembly, Prompt, Claude-API-Aufruf, Schema-Validierung, deterministischer Guardrail-Lint); Generate-Route mit Konkurrenz-Schutz; UI-Wiring (Button, Pending, Stale-Hinweis, Regenerate-Bestätigung); Eval-Lane (Golden-Profile) + deterministische Tests.

**Non-Goals:** kein Auto-Trigger; keine Änderungen an Verdicts/Engine/PDF (Slices 3–5); keine DB-Migration (der Brief lebt in `discovery_call_sheets.consult_brief`); kein Agent-Zugriff auf Recherche-Pipeline-Schreibpfade; keine Teilnehmerinnen-Oberfläche.

## 4. Zieltopologie (Target Map)

- Wissensbasis: `docs/research/consult-knowledge/` — `README.md` (Format, Mining-Prozess aus Phase-5-Notizen), `entries/*.md` (ein Learning pro Datei: Bedingung → Einsicht → Formulierungshilfe → Evidenzgrad intern), `guardrails.md` (verbotene Claims-Liste, Pflicht-Grenz-Zeile, Erwartungs-Grenzen).
- Generator: `src/lib/discovery/consult-brief/` — `input.ts` (Assembly aus Cockpit-Read-Model + Runsheet-Ableitungen + Recipe + Wissensbasis; pure), `hash.ts` (source_hash über die Assembly; stabil, getestet), `prompt.ts` (deutscher Prompt, strukturierte JSON-Ausgabe = §6-Sections-Schema aus Slice 1), `generate.ts` (LLM-Aufruf hinter Interface), `lint.ts` (deterministischer Guardrail-Lint, pure: verbotene Phrasen; Grenz-Zeile vorhanden; Verdict-Widerspruchs-Check — der Brief darf ein passt-nicht-Produkt nicht zum Behalten erklären und keine Produkte nennen, die nicht in Verdicts/Swaps/Buckets vorkommen).
- LLM-Client: den bestehenden Server-LLM-Pfad des Repos wiederverwenden — OpenAI-Lane mit Langfuse-Instrumentierung (`src/lib/openai/chat.ts`, Muster der agent-/chat-runtime-Aufrufer; kein neuer Provider, keine neue Key-Verwaltung). Modell konfigurierbar per Env, Default das stärkste im Repo konfigurierte Modell; Volumen ist klein. Der Generator bleibt hinter einem Interface, Provider-Wechsel später möglich.
- Route: `POST /api/admin/beratung/[enrollmentId]/consult-brief` — Muster der Slice-1-PATCH-Route (CSRF, Kill-Switch, requireAdmin, service_role); generiert, lintet, schreibt `consult_brief` mit `generated_by:"agent"`, `generated_at`, `source_hash`.
- Konkurrenz (Slice-1-Verpflichtung): Request trägt `expected_state` (source_hash + generated_at des zuletzt gesehenen Briefs oder null); Mismatch → 409 `brief_conflict` mit aktuellem Stand; UI bestätigt dann explizit (R15-Warnung) und sendet `force: true`. Die vorherige Fassung wird vor dem Überschreiben als `previous` im JSONB mitgeführt (eine Revision, R15).
- UI: Phase-2-Karte in `src/components/discovery/cockpit/runsheet-brief.tsx` — „Brief erstellen"/„Neu generieren"-Button (Coral-CTA-Regel beachten: sekundäre Aktion → plum/ghost, Finalisieren bleibt der Coral-CTA), Pending-Zustand, Fehleranzeige, Stale-Hinweis („Eingaben haben sich geändert") via Server-geliefertem aktuellem Hash vs. gespeichertem, Regenerate-Bestätigung bei manuellen Edits.
- Evals: deterministische Anteile in `tests/` (test:node); Generierungs-Evals als eigene On-Demand-Lane im `test:chat`-Muster mit Golden-Profilen (Nomi-artig blondiert+Hitze; fettige-Kopfhaut/Überwäsche; Locken+Bruch) und Assertions: Schema gültig, Lint bestanden, kein Verdict-Widerspruch, Grenz-Zeile vorhanden, keine verbotenen Claims.

## 5. Entscheidungs-Coverage

Status: **confirmed**. Confirmed with Nick: R2/R14/R15/R16 + „directly continue with the build" (2026-09-28). Inherited: Slice-1-§6-Brief-Schema; Route-/Auth-Muster; Standing Rules (Unsicherheit intern, Claims-Grenzen, medizinische Trennung); Konkurrenz-Verpflichtung aus Slice-1-Ledger. Implementation defaults: bestehende OpenAI/Langfuse-Lane statt neuem Provider (lean; Generator hinter Interface), Modellwahl per Env; eine Revision (`previous`) statt Historie; Wissensbasis als Markdown-Dateien; Eval-Lane on-demand statt CI-pflichtig (API-Kosten). Open consequential assumptions: none. Undiscussed consequential assumptions affecting this handoff: none.

## 6. Operator-Journey

Nick öffnet ein submitted Enrollment → Phase 2 zeigt leere Brief-Felder + „Brief erstellen". Klick → Pending → Sections erscheinen ausgefüllt (Diagnose, Hebel mit Punkten, Swap-Begründungen an den Bucket-Einträgen, Ziel-Lücken, Call-Fragen, Erwartungen). Er editiert frei (Slice-1-Speichern unverändert, `generated_by` wird bei manuellem Save `"manual"`). Ändern sich Inputs (z. B. Recherche schließt ab) → Stale-Hinweis; „Neu generieren" warnt bei Edits (409-Pfad → Bestätigen), alte Fassung bleibt als Revision. Fehlerfälle: LLM-Fehler/Lint-Fehlschlag → deutsche Fehlermeldung, gespeicherter Brief unangetastet. Keine Teilnehmerinnen-Sicht ändert sich.

## 7. Geordnete Tasks

**T1 — Wissensbasis + Guardrails (Daten, kein Code).** `docs/research/consult-knowledge/` mit README (Format + Mining-Loop aus Phase-5-Notizen), `guardrails.md` (verbotene Claims inkl. „reparieren/heilen/wie neu", Pflicht-Grenz-Umgang, Erwartungs-Grenzen: kein Ziel 10, Zeiträume ehrlich), ~10 Seed-Einträge aus den Session-Learnings (Trockenschuppen-vs-Anti-Schuppen-Mechanismus; Schwere-Pflege-Paradox bei feinem Haar; laufender-Schaden-Hebel; Protein-Steifheits-Risiko; Blondier-Rhythmus-Frage; Entwirr-Frage; Form&Halt-Ehrlichkeitssatz; Erwartungs-Zeiträume; Öl-als-Finish; Waschfrequenz-Übergang). Kriterium: Dateien vorhanden, Format konsistent, von T2 maschinenlesbar (Frontmatter: `conditions`, `category`).

**T2 — Generator-Kern (pure Teile TDD).** `input.ts` + `hash.ts` + `lint.ts` pure und voll getestet (Fixtures: Nomi-Konstellation; Brief der ein passt-nicht-Produkt lobt → Lint-Fehler; Brief mit fremdem Produktnamen → Lint-Fehler; fehlende Grenz-Zeile → Lint-Fehler; Hash stabil bei identischen Inputs, ändert sich bei Verdict-Änderung). `prompt.ts` + `generate.ts` hinter Interface mit Mock-Tests (Schema-Parse via zod auf §6-Sections; ungültige LLM-Antwort → Fehler ohne Write). Consumes: Cockpit-Read-Model, `runsheet/`-Ableitungen, Recipe-View, T1-Dateien. Produces: `generateConsultBrief(enrollmentContext) → {brief, sourceHash} | {error}`.

**T3 — Route + Konkurrenz.** POST-Route im Slice-1-Muster; `expected_state`/409 `brief_conflict`/`force`; `previous`-Revision; Schreibpfad über die bestehende `saveDiscoveryCallSheet`-Merge-Logik. Tests: Roundtrip mit gemocktem Generator, 409-Pfad, force-Pfad, Lint-Fehlschlag schreibt nichts, Nicht-Admin/CSRF wie Geschwister-Route.

**T4 — UI-Wiring.** Button/Pending/Fehler/Stale-Hinweis/Regenerate-Bestätigung in `runsheet-brief.tsx`; Slice-1-Dirty-Guard bleibt intakt; Page liefert aktuellen Input-Hash. Tests im Slice-1-Seitenmuster (Button ruft Route, 409 → Bestätigungspfad, Stale-Hinweis-Rendering, Legacy ohne Brief).

**T5 — Eval-Lane.** On-Demand-Skript im `test:chat`-Muster (`npm run test:consult-brief` o. ä. gemäß Repo-Konvention): 3 Golden-Profile end-to-end gegen die echte API, Assertions wie §4; zusätzlich deterministische Fixture-Suite in test:node mit aufgezeichneter Beispiel-Antwort. Kriterium: Lane läuft lokal mit API-Key; CI bleibt ohne API-Pflicht grün.

## 8. Verifikation

Automatisiert: neue test:node-Suiten (T2–T4), volles `npm run ci:verify` auf finalem Baum. Live: einmaliger echter Generate-Lauf gegen ein Test-Enrollment über die Eval-Lane (T5) mit API-Key aus der Repo-Umgebung — der Brief-Inhalt selbst ist danach Nicks Review-Gegenstand im gemeinsamen Walkthrough (Slices 1+2 zusammen, wie mit Nick vereinbart). Migration: keine.

## 9. Review & Handoff

Worktree `codex/consult-agent`; SDD-Ausführung (Opus-Implementierer); ein Codex-Whole-Branch-Review vor Push (einzige Review-Lane); /ship danach; Merge separat. Rollout: kein Flag nötig — die Route ist admin-only und der Button erscheint nur im Cockpit; ohne API-Key antwortet die Route mit sauberem Fehler. Artefakte: Plan committen; transienten Review-Output verwerfen.
