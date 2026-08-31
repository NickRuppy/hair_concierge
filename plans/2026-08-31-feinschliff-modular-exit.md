# Feinschliff: modularer Ausstieg + echter Verhalten-Recompute

**Branch:** `codex/feinschliff-modular-exit` · **Datum:** 2026-08-31 · **Rev. 3** (nach zwei Codex-Review-Pässen, alle Blocker eingearbeitet)
**Bug-Report:** Nach Abschluss des Produkte-Moduls und anschließendem Verhalten-Modul wird der Nutzer automatisch erneut in die Produkt-Verfeinerung (Stage 3) weitergeleitet.

## 1. Befund (verifiziert, Codex-bestätigt)

Beide Defekte verstoßen gegen `plans/feinschliff-einstieg.md` Entscheidung 12 („Jedes Modul aktualisiert den Plan sichtbar bei Abschluss, sofortige Aktivierung, kein Proposal-Pending"):

**(D1) Falsche Weiterleitung in der kanonischen Reihenfolge.** Das schließende Modul delegiert serverseitig an den linearen Voll-Abschluss (`stage2-refinement-service.ts:328`); der Client prüft `status: "complete"` VOR `stage3Handoff` und armiert die Stage-3-Bridge (`refinement-flow.tsx:915`); ein expliziter Modul-Einstieg auto-continued sie ohne Tap (`stage2BridgeAutoContinues`, `refinement-flow.tsx:127`). In der kanonischen Reihenfolge (Produkte → Verhalten) ist Verhalten immer das schließende Modul → Zwangsdurchlauf durch Stage 3; der `handBackToHost`-Routine-Pfad (`plan-start-flow.tsx:1041`) ist dort unerreichbar. Gepinnt (falsch) durch `tests/personal-plan-stage2-module-entry.test.tsx:858`. Verschärfung: der Rebuild des gestalten Drafts auf der NEUEN Refined-Version verwirft Captures, Assignments und Entscheidungen (`production-persistence-gateway.ts:384-386` — Verlust tritt genau im Version-Wechsel-Fall auf, also in unserem Szenario).

**(D2) Kein Verhalten-Abschluss aktualisiert die Routine.** Modul-RPC schreibt Projektion + Head-Advance + Outbox-Eintrag, aber: der Sync-Worker terminalisiert `refined_need`-Claims (`source-sync-service.ts:119`, `terminal_refinement_pending_stage3`; terminale Codes parken den Eintrag auf `available_at='infinity'`, Migration `20260808071000:273`); die Sofort-Aktivierung `personal_plan_complete_draft_activate_v2` läuft nur beim Stage-3-Abschluss (`routine-proposal-stager.ts:221` ← `production-persistence-gateway.ts:~1000`); `/routine` liest `current_refined_need_version_id` nie; kein Cron/Trigger kompiliert. Der „✓ Plan aktualisiert"-Toast ist ein reines Navigations-Signal (`plan-updated-signal.ts`) — im habits-first-Pfad eine Falschaussage auf unverändertem Payload. Kein Test behauptet eine echte Aktualisierung.

**(D3, im Review entdeckt) Undirigierter `/plan-start`-Besuch nach Voll-Abschluss.** Für einen Nutzer mit aktiver Routine ist der Frontier nie `stage3` (`journey-access.ts:79ff` — `hasAcceptedRoutine` hält Stage 4/5 erreichbar), also fällt `resolvePlanStartPageState` auf den Stage-2-Zweig zurück (`page.tsx:282`), wo der unskopierte complete Draft die Bridge armiert und `autoHandoff` (undirigiert → true) in Stage 3 durchreicht. Betrifft heute schon jeden Post-Accept-Nutzer mit abgeschlossenem Draft, der `/plan-start` ohne Parameter öffnet.

## 2. Nicks Rulings (2026-08-31, dieses Gespräch)

- R1: Verhalten-Abschluss (erstes, zweites oder einziges Modul) → **zurück auf `/routine`**, nie in die Produktauswahl.
- R2: Planänderungen aus Verhalten-Antworten werden **still übernommen**; ein neuer Baustein **ohne Produkt** erscheint als **offene Lücke**. Kein Proposal-Pending.
- R3: Banner zählt runter, **verschwindet einfach** bei 4 von 4.
- R4: **Option B** — Routing-Fix + echter Recompute in einem PR.
- Journey-Sign-off: erteilt (Abschnitt 9). Toast-Ehrlichkeit ist Bestandteil von Entscheidung 12.

- R5 (D-gap, entschieden 2026-08-31): Neuer empfohlener Baustein mit kaufbarer, aber ungesehener Empfehlung → **Lücke zeigen**, nichts Ungesehenes wird still eingeplant. Umsetzung: `leave_uncovered` mit ehrlichem Copy + Edit-Link ins Produkte-Modul; dafür ggf. neuer `Stage3DecisionDeferralReason` mit eigenem Copy-Eintrag, da `refinement_required` auf ein ERLEDIGTES Modul verlinken würde und `no_product`/`preview_unavailable` (`labels.ts:98ff`) faktisch falsch wären. Neues Copy (eine Zeile, deutsch) ist Teil des T0.3-Evidenz-Pakets.

## 3. Zielverhalten

| Abschluss von | Draft danach | Navigation | Plan-Update |
| --- | --- | --- | --- |
| Produkte (nicht schließend) | in_progress | Bridge → Stage 3 (unverändert) | Stage-3-Abschluss + v2-Sofortaktivierung (unverändert) |
| Produkte (schließend, habits-first) | complete | Bridge → Stage 3 (unverändert) | Stage-3-Abschluss (unverändert) |
| Verhalten (nicht schließend) | in_progress | `/routine` (heute schon) | **NEU: headless Recompute** |
| Verhalten (schließend, kanonisch) | complete | **NEU: `/routine`** | **NEU: headless Recompute** |

Recompute-Ergebnis ist dreiwertig — `applied | unchanged | unavailable`:
- `applied`: neue Routine-Version sofort aktiv → `/routine?planUpdated=1` (Toast).
- `unchanged`: Antworten ergaben dieselbe Refined-Version (Input-Hash-Dedupe, Migrationen `20260825130000:98` / `20260808062602:306`) oder semantisch identische Routine → `/routine` **ohne** Toast (ehrlich; Banner-Countdown ist die Bestätigung). Maßgeblich ist die Ausgangszustands-Definition in §4c, die die Formulierung „semantisch identische Routine" ablöst: `unchanged` heißt ausschließlich „die Ziel-Version war schon VOR der Arbeit die aktive Quelle" — eine Aktivierung auf dieselbe Quelle meldet `applied`, auch wenn die neue Routine-Payload byte-identisch ist.
- `unavailable`: Recompute fehlgeschlagen → `/routine` ohne Toast; Modul-Abschluss bleibt gültig; Self-Heal über T1.5.

Ausnahme (Codex-Finding 6): ein Modul-Abschluss OHNE akzeptierten Plan (nur per Hand gebauter `?refine=habits`-Link erreichbar; keine Produkt-Surface verlinkt das) behält das heutige Bridge-Verhalten — `/routine` würde diese Kohorte bouncen, ihr Abschluss ist eine Erst-Aktivierung. Routing entscheidet `isPostAcceptModuleEntry`, nicht das Modul allein.

## 4. Design des Recompute

Präzedenz: `acceptIdealPlan` (`direct-acceptance/accept.ts:205`) — headless `loadOrCreate → evaluateDecisions → resolveDecisions → complete`; der Abschluss läuft durch `personal_plan_complete_draft_activate_v2`, dessen Modul-Gate (nicht-leere `module_projections`-Lineage + erste Routine auf der Version) deployed und getestet ist. Codex-verifiziert: das Gate greift für beide Verhalten-Fälle — die nicht-schließende Projektion (Lineage `habits`) und den schließenden Voll-Abschluss (Voll-Abschluss löscht die `products`-Lineage nicht, `20260808062602:310`; v2 akzeptiert Result- wie Projektions-Version, `20260825140000:87`).

**4a. Draft-Rehydration (Kern; Quelle = Quell-Draft, nicht Routine+Portfolio).** Ein frisch aufgebauter Stage-3-Draft ist leer (`stage3-persistence-supabase.ts:69`); `keep_owned` braucht Captured-Product-Subjekte mit User-Product-Identität + `frequencyRange` (`products/contracts.ts:276`). Routine-Payload (`routine/contracts.ts:91`), Pending-Products (`products/contracts.ts:498ff`) und Retained-Inventory (`:470ff`) tragen diese Frequenz NICHT — Rehydration aus Routine+Portfolio allein ist unmöglich (Codex-Pass 2, Blocker 1). Autoritative Quelle ist der **immutable Quell-Stage-3-Draft** der aktiven Routine-Version (`sourceProductDraftId` + Revision, owner-scoped geladen; Loader-Präzedenz `source-sync-service.ts:450ff`): von dort werden Captures, Assignments und Frequenzen CAS-kopiert; Routine + Portfolio liefern nur die Final-Choice-Semantik und die „Nicht verwendete Produkte"-Kontinuität. **Fail-closed:** eine Legacy-Zeile, deren Quell-Draft nicht verifizierbar ist, ergibt `unavailable` (bestehende Routine bleibt unangetastet).

**4b. Intent-Seeding** aus rehydrierten Subjekten + `reviewDecisionBundles` (Kandidaten/Fingerprints kommen NICHT aus `evaluateDecisions` — `Stage3KnownAuthorityEvaluation` trägt nur die Primär-Empfehlung, `authority/contracts.ts:222ff`; `select_replacement` validiert gegen die Fit-Comparison-Alternativen, `production-persistence-gateway.ts:1242`, und ist von der `allowedActions`-Mitgliedschaft ausgenommen, `:1164`). Vollständige Fallkarte, jede Zeile mit Fixture:

| Zustand in aktiver Routine | Intent |
| --- | --- |
| owned, Verdict passt | `keep_owned` |
| owned, bestätigter Mismatch | `acknowledge_override` (so bleiben akzeptierte Mismatches owned, vgl. `authority/categories/conditioner.ts:225`) |
| pending (in Prüfung) | `keep_pending` |
| planned = Primär-Empfehlung der neuen Evaluation | `plan_recommendation` |
| planned = Alternative (in Bundles auffindbar, Fingerprint auflösbar) | `select_replacement` + Kandidaten-Id/Fingerprint |
| planned, Kandidat weggefallen/Fingerprint nicht auflösbar | Fallback: `plan_recommendation` falls buyable+erlaubt, sonst `leave_uncovered` + Reason |
| bewusst unbesetzt/excluded | `leave_uncovered` |
| Rolle neu, keine kaufbare Empfehlung | `leave_uncovered` + `no_product` (Lücke, R2) |
| Rolle neu, kaufbare ungesehene Empfehlung | `leave_uncovered` + neuer Deferral-Reason mit Edit-Link (R5) |
| Evaluation `unsupported` (erlaubt KEINE Action, `authority/contracts.ts:255`) | **Recompute-Abbruch als `unavailable`, nicht-retryable** — ein unentschiedenes Pflicht-Subjekt macht `complete` zu `not_ready` (`production-persistence-gateway.ts:932`), und `resolveDecisions` verwirft leere Batches (`:1118`); Server-authored-Deferral für unsupported existiert nicht. Bestehende Routine bleibt aktiv; Outbox-Claim terminal (kein Retry-Loop). Test fixiert Klassifikation. |
| Rolle im neuen Plan entfallen | kein Intent; Produkt → „Nicht verwendete Produkte" via Portfolio |

Produkttausch nie als Default, nur als dokumentierter Fallback (R2). Verlust manueller Routine-**Editor**-Anpassungen: von Entscheidung 12 in Kauf genommen. `markUnrefinedDirectAccept: false`.

**4c. Erfolgs-/Replay-Semantik.** Ein Completed-Draft-Replay liefert das gespeicherte Receipt VOR dem v2-Wrapper (`production-persistence-gateway.ts:913`), und der Receipt-Loader gibt auch für bereits akzeptierte Proposals eine Proposal-Id zurück (`stage3-persistence-supabase.ts:406`). `applied` wird deshalb NIE aus `routineProposalId` abgeleitet, sondern **relativ zu einem VOR der Arbeit erfassten owner-scoped Ausgangszustand** (Codex-Pass 2, Finding 7): `unchanged` nur, wenn die Ziel-Version schon VORHER die aktive Quelle war; `applied`, wenn sie WÄHREND der Operation aktiv wird — auch wenn die konkurrierende Lane (inline vs. Worker) den CAS gewonnen hat; sonst `unavailable`.

**4d. Einbauorte.**
- Inline: `app/api/personal-plan/stage-2/route.ts`, nach erfolgreichem `completeModule`/Abschluss mit `module === "habits"` und aktiver Routine (Gateway-Aufbau nach dem Muster von `accept-ideal-plan/route.ts`). Antwortfeld `moduleCompletion.recompute: "applied" | "unchanged" | "unavailable"` (additiv). Telemetrie `stage2_habits_recompute`.
- Self-Heal (T1.5): derselbe Recompute-Service aus der `refined_need`-Behandlung des Sync-Workers (`source-sync-service.ts:119`) — mit vier von Codex-Pass 2 erzwungenen Kontrakten: **(i)** eigene owner-scoped Klassifikations-Query (Claim-Row trägt keine Lineage, `source-sync-service.ts:25`; Lineage-Nachweis wie in `20260825140000:73`), die zugleich prüft, dass `sourceKey` die AKTUELLE Refined-Version ist; nur nicht-modulgetriebene Claims bleiben terminal. **(ii)** Modulgetriebene Claims laufen als **exklusiver Pass VOR dem Laden der Reconciliation-Base**; danach Plan/Base-Reload, bevor `user_product`-Geschwister-Claims verarbeitet werden (der Batch-Snapshot wäre sonst stale, `source-sync-service.ts:211,244,314`). **(iii)** Sync-Ergebnis erhält ein explizites `recompute: "applied"`-Signal — `proposalStaged` bleibt bei Auto-Confirm false und der Client würde nie reloaden (`RoutineSourceSyncResult`, `source-sync-service.ts:101`; Reload-Gate `personal-plan-routine-client.tsx:318ff`); Client reloadet auf das neue Signal. **(iv)** Recompute nachweislich unter der 60s-Lease (`source-sync-service.ts:432`) oder Lease-Renewal; Test: Lease-Expiry-Reclaim, bei dem Worker A aktiviert aber den Finish-Token verliert und Worker B `unchanged` beobachtet. Damit heilt ein `unavailable` beim nächsten `/routine`-Besuch automatisch und der Outbox-Eintrag settelt regulär.

## 5. Tasks (Reihenfolge = Ausführungsreihenfolge; TDD für alle Lib-Logik)

**T0 — Rote Repros + Evidenz**
- T0.1: Red-Test kanonische Reihenfolge: schließender Verhalten-Abschluss bei explizitem Post-Accept-Modul-Einstieg endet heute in der Bridge (Ziel: `handBackToHost`).
- T0.2: Red-Test habits-first mit **semantisch geänderten** Antworten (distinct Refined-Version): keine neue aktive Routine-Version trotz Toast-Href.
- T0.3: Evidenz-Paket (User-Facing-Gate): annotierte Screenshots der realen Surfaces (Banner-Zustände, Toast, Lücken-Darstellung, Landing nach Verhalten-Abschluss) als Ist/Soll-Journey; Nick vorlegen. Kein neues UI — die Annotation zeigt Navigations-/Timing-Änderung und Toast-Bedingungen.

**T1 — Recompute-Lane (Server)**
- T1.1 (zuerst, entscheidet alles Weitere): Rehydrations-Service nach 4a — Quell-Draft owner-scoped laden + Revision verifizieren, CAS-Copy in frischen Draft, Final-Choice-Abgleich gegen Routine+Portfolio; Tests inkl. Retained-Inventory-Kontinuität, Version-Mismatch, Legacy-fail-closed, Replay.
- T1.2: Pure Funktion `buildRefinementRecomputeIntents(rehydratedSubjects, bundles, activeRoutinePayload)` mit der Fallkarte aus 4b; Fixture je Zeile. Opus-Tier (deterministische Judgment-Logik). D-gap ist entschieden (R5).
- T1.3: Orchestrator `recomputeRoutineAfterHabitsCompletion(deps)`: rehydrate → evaluate → seed → resolve → complete; Ergebnis `applied | unchanged | unavailable` nach 4c; wirft nie in den Modul-Abschluss zurück. Tests: distinct-Version nicht-schließend, distinct-Version schließend, Same-Version/No-op, Lost-Response-Replay nach Aktivierung, Source-Revision-Konflikt.
- T1.4: Route-Wiring (`stage-2/route.ts`) + Antwortfeld + Telemetrie; nur `module === "habits"` && aktive Routine.
- T1.5: Self-Heal im Sync-Worker nach 4d (i)–(iv): Klassifikations-Query, exklusiver Pass + Base-Reload, `recompute`-Signal im Sync-Ergebnis + Client-Reload, Lease-Kontrakt. Tests: heilt nach `unavailable`, settelt Outbox, Stale-Target, Mixed-Batch (refined_need + user_product), Inline/Worker-Race, Lease-Expiry, nicht-modulgetriebene Claims bleiben terminal (bestehende Tests `stage4-source-sync-api.test.ts:290` präzisieren).
- T1.6: Real-SQL-Lane (pglite, Präzedenz `personal-plan-refinement-recompute-activation-migration.test.ts`): v2-Aktivierung für den schließenden Pfad (products-Lineage + Result-Version) und Projektions-Pfad.

**T2 — Client-Routing**
- T2.1: `applyStage2ModuleCompletion` routet nach `stage3Handoff` UND Post-Accept-Origin: `stage3Handoff` → Bridge; sonst Post-Accept → `handBackToHost`; sonst (unaccepted, handgebauter Link) → heutiges Bridge-Verhalten. Pinnende Tests umschreiben; Regressionstests: linearer Funnel, Direct-Accept, `?refine=1`, Modul-1-Resume, unaccepted `?refine=habits`.
- T2.2: Toast nur bei `recompute === "applied"` (`Stage2ModuleCompletionPayload` transportiert das Ergebnis; `onModuleComplete` in `plan-start-flow.tsx` wählt den Href). Doc-Kommentar `plan-updated-signal.ts` korrigieren.
- T2.3 (D3-Guard): `resolvePlanStartPageState` — für `planAccepted` && Draft complete && Frontier ≠ stage3 wird der undirigierte Besuch **auf `/routine` redirected** (NICHT in die Stage-1-Ansicht: deren Journey-Shape verliert `planAccepted` und rendert einen Accept-CTA, den der Accept-Service für aktive Pläne ablehnt — `page.tsx:158`, `plan-start-flow.tsx:911`, `need-plan-screen.tsx:47`, `accept.ts:307`; Codex-Pass 2, Blocker 5). Kohorten-Tests: manuell akzeptiert, direct-accepted, aktiv mit pending Proposal, Repair-Pfad, explizites `?refine=1` (Repair- und Refine-Zweige liegen früher und bleiben unberührt, `page.tsx:202,222`). Ist-Verhalten des `ideal_plan`-Profil-Links verifizieren.

**T3 — Doku**
- T3.1: `plans/feinschliff-einstieg.md` (Zeile 84 „nach Modul 2 wie heutiger Voll-Abschluss" = Wurzel von D1) um Verweis auf diesen Plan ergänzen; `plan-updated-signal.ts`-Kommentar (T2.2) zählt hierzu.

**T4 — Verifikation**
- `npm run ci:verify`; Suiten über npm-Scripts (server-only-Shim, nie bare `npx tsx --test`).
- Manuell (dev server, localhost, Neustart nach Lib-Änderungen): kanonische Reihenfolge end-to-end (… Verhalten → Routine+Toast, Plan sichtbar aktualisiert, kein Stage 3, Banner weg); habits-first via Profil-Zeile; Heat-Events hochsetzen → neuer Baustein als Lücke gemäß D-gap-Ruling; Recompute-Fehler simulieren → Routine ohne Toast, nächster `/routine`-Besuch heilt (T1.5); undirigierter `/plan-start`-Besuch nach Abschluss → Plan-Ansicht, kein Stage 3.

## 6. Nicht-Ziele
- Kein neues UI über das ggf. nötige D-gap-Copy hinaus; Banner unverändert.
- Produkte-Modul, linearer Funnel, Direct-Accept unverändert.
- Kein Erhalt manueller Routine-Editor-Anpassungen beim Recompute (Entscheidung 12).
- Keine Latenz-Optimierung des Inline-Recompute vor Telemetrie-Befund.

## 7. Risiken
- Rehydration (T1.1) ist der größte Neubau — deshalb zuerst, mit eigener Testlane; ihr Ausgang bestimmt die Intent-Fallkarte.
- Fingerprint-/Kandidaten-Churn → Fallback-Kette, jede Stufe getestet.
- Doppel-Aktivierung/Replay → 4c-Semantik + Tests (T1.3).
- Latenz des Modul-Abschlusses steigt (headless Pass im Request); akzeptiert, Telemetrie ab Tag 1; Self-Heal-Lane hält den Abschluss auch bei Timeout korrekt.

## 8. Codex-Review-Status
Zwei Review-Pässe (2026-08-31, --effort high):
- **Pass 1** (Rev. 1): D1/D2-Diagnose und `stage3Handoff`-Routing bestätigt; 3 Blocker (Capture-Rehydration, Intent-Kontrakt, Recovery/Frontier) + Should-fixes → Rev. 2. Zwei Rev.-1-Behauptungen widerlegt und entfernt (Outbox-Re-Arm alle 30s; pauschaler Capture-Verlust). Provenienz dieses Passes unklar (CLI-Hinweis im Agent-Lauf); alle übernommenen Findings wurden unabhängig gegen den Code verifiziert.
- **Pass 2** (Rev. 2, verifiziert echter Codex-CLI-Lauf, Thread `01a05873-…`, Modell gpt-5.6-sol): bestätigt, dass Rev. 2 die Pass-1-Blocker korrekt repariert; 5 neue Blocker auf Implementierungs-Kontrakt-Ebene (Rehydrations-Quelle = Quell-Draft; unsupported-Policy; Worker-Batch-Konkurrenz/Lineage-Erkennung; Client-Sichtbarkeit des Self-Heal; D3-Guard-Ziel) + 2 Should-fixes (Lease-Kontrakt; applied/unchanged relativ zum Ausgangszustand) — alle in Rev. 3 eingearbeitet (4a–4d, T1.1, T1.5, T2.3). Schlüssel-Claims stichprobenverifiziert (frequencyRange-Lücken, Empty-Intent-Rejection, not_ready).

## 9. Signed-off User Journey (Referenz)
1. Routine-Banner „Mach deinen Plan genauer · 2 von 4" → Produkte-Fragen → Produktauswahl → Routine, Toast, „3 von 4".
2. „Noch ein Schritt: deine Gewohnheiten" → Verhalten-Fragen → nach letzter Antwort direkt Routine; Toast nur bei tatsächlich aktualisiertem Plan; Änderungen still übernommen; neuer Baustein ggf. als Lücke.
3. Banner verschwindet bei 4 von 4. Umgekehrte Reihenfolge gleichwertig. Fehlerfall: Antworten gespeichert, bestehende Retry-Meldung im Modul; Recompute-Fehler → Rückkehr ohne Toast, Self-Heal beim nächsten Routine-Besuch.
