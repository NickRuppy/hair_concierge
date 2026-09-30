# Consult-Iteration 2 — Runsheet-Feedback-Runde (Produktions-Test 2026-09-29)

Nicks erste Produktions-Testrunde auf dem Runsheet (nach #623/#624). Rulings R26–R29 per
Interview fixiert; dazu vier klare Fixes ohne Fork.

## Rulings

- **R26 — Problem-Block restrukturiert.** Kurzer Problem-Intro zuerst (Problem benannt,
  Mechanismus, typische Ursachen — generisch, 2–3 Sätze), dann Diagnose (ihre konkrete
  Situation, gekürzt), dann EIN Maßnahmen-Block mit zwei Buckets **Produkte** und **Umgang
  mit dem Haar**. Die Hebel sind die Bucket-Einträge (Punkte-Mechanik unverändert). Die
  separate Gewohnheiten-Sektion löst sich auf: die Rezept-Gewohnheiten (Checkboxen + PDF-
  Vormerkung, eigene Persistenz) rendern im Umgang-Bucket unter den Hebeln.
- **R27 — Ziel-Lücken entfallen als eigene Liste.** Erwartungs-Diskrepanzen werden als
  Call-Fragen formuliert („Du willst X — wie wichtig ist dir das vs. Y?"). Erwartungen-Liste
  (mit Grenz-Zeile) bleibt.
- **R28 — Komplexität leichtgewichtig, genau zwei Optionen.** Produktphase bekommt oben die
  Frage „Wie aufwendig darf die Routine sein?" mit **Super essenziell** / **Normal** (persistiert).
  Jeder Zusatz-Schritt („Neu") trägt ein **Essenziell**/**Optional**-Label mit Ein-Satz-Nutzen.
  Keine Routine-Varianten, kein Engine-Umbau — das ist Slice 4.
- **R29 — „Liste kopieren" fliegt raus.** Die Liste fließt automatisch in Phase 4 und ins PDF;
  der Copy-Flow hat keinen realen Moment.

## Klare Fixes (kein Fork)

- **F1 — Ziel-Tabellen für Neu-Produkte.** „Neu"-Schritte bekommen dieselbe iOS-Tabelle wie
  Swaps, zweispaltig: **Ziel | Empfohlenes Produkt**.
- **F2 — Frequenz-Begründung in der Idealroutine.** Weicht die Plan-Waschfrequenz von ihrer
  aktuellen Angabe ab, steht am Wochen-Kopf eine Ein-Zeilen-Begründung (deterministisch,
  aus Richtung + Hauptproblem).
- **F3 — Styling in der Diagnose.** Prompt-Nudge: Styling-/Hitze-Gewohnheiten müssen in der
  Diagnose genannt werden, wenn sie plausibel aufs Hauptproblem einzahlen.
- **F4 — Generelles Kürzen.** Diagnose max. 4 Sätze; Listen-Einträge einzeilig; kein
  Wiederholen der Rezept-Gewohnheiten als eigene Hebel.

## T1 — Brief-Schema v4 (prompt.ts, api-schema.ts, call-sheet.ts, lint.ts, generate.ts)

- `CONSULT_BRIEF_PROMPT_VERSION = "consult-brief-v4"`.
- Sections: `mechanik: string` NEU (Pflicht im API-Schema); `hebel[].bucket:
"produkt" | "umgang"` NEU (Pflicht im API-Schema); `zielLuecken` raus aus API-Schema,
  SCHEMA_SKETCH, Prompt-Aufgabe und Lint-Texten.
- Stored shape (`DiscoveryCallSheetBriefSections`): `mechanik` (Parse-Fallback `""`),
  `bucket` optional/null (Alt-Briefe), `zielLuecken` bleibt im Stored-Type + Parse
  (Kompatibilität; UI editiert es nicht mehr, neue Saves schreiben `[]`).
- Prompt-Aufgabe: mechanik-Spez (generisch, kein Personenbezug, aus Rezept/Wissens-Material
  begründet); Diagnose 2–4 Sätze + Styling-Nudge (F3); Hebel-Bucket-Regel + „Mikro-
  Gewohnheiten aus dem Rezept nicht als Hebel doppeln" (F4); Ziel-Lücken-Absatz ersetzt
  durch Diskrepanz-als-Frage-Regel in callFragen (R27). Checkliste am User-Turn angepasst.
- Lint: `mechanik` in die gelinteten Texte (Drittperson-/Claims-Regeln greifen);
  `zielLuecken`-Zeile raus. Guardrails-Doc: Ziel-Lücken-Erwähnungen umformulieren →
  Mirror-Re-Sync (node-Script + prettier) + Drift-Test.

## T2 — Phase-2-UI-Umbau (runsheet-brief.tsx)

- Karte „Problem": Mechanik-Textarea (eigenes Feld, von Generierung ersetzt wie Diagnose),
  darunter Diagnose + Hitze + Quiz-Fold-up (unverändert).
- Karte „Maßnahmen · von X auf Y": Staircase; Gruppe **Produkte** (bucket=produkt) und
  Gruppe **Umgang mit dem Haar** (bucket=umgang) mit je eigenem „Hebel hinzufügen";
  Gewohnheiten-Checkboxen + Eingabe ziehen in die Umgang-Gruppe (Persistenz unverändert:
  `habit_commitments`, nie von Generierung ersetzt). Alt-Briefe ohne Buckets: eine flache
  Hebel-Liste wie bisher (kein irreführendes Einsortieren).
- Karte „Für den Call": nur noch Fragen + Erwartungen (`RUNSHEET_BRIEF_LISTS` ohne
  zielLuecken).
- Pronomenfreie Labels (Voice-Ruling bleibt).

## T3 — Produktphase (comparison-table.tsx, discovery-call-cockpit.tsx, locked-in)

- F1: Neu-Schritte rendern die Vergleichstabelle „Ziel | Empfohlenes Produkt". Datenquelle:
  neuer PropertyRows-Producer für `ideal_recommendation`-Optionen (heute hart `null`,
  cockpit.ts ~938) — Empfehlungs-`productId` gegen Rolle/Kriterien via
  `mobileAssessmentRows` bewerten, analog `propertyRowsFor` in load-participant-verdicts.ts;
  `ownedRows: null` ergibt die vorhandene 2-Spalten-Variante.
- R28: Komplexitäts-Chip oben in Phase 3 („Wie aufwendig darf die Routine sein?" —
  Super essenziell / Normal). Persistenz: neue nullable Spalte `complexity` auf
  `discovery_call_sheets` (Migration VOR dem Deploy/Merge auf Prod anwenden — Code liest
  die Spalte) + COLUMNS/Parse/Patch/Zod/Client-Save. Essenziell/Optional-Label je Schritt
  aus `step.section` („basis" → Essenziell, „optional" → Optional), Ein-Satz-Nutzen aus
  `step.roleDescription` — beides existiert bereits, rein deterministisch.
- R29: „Liste kopieren"-Button + Copy-Flow entfernen; `runsheetShoppingListText` wird
  damit tot und geht mit (PDF v2 holt es sich bei Bedarf aus der Historie); DOM-Tests
  anpassen.

## T4 — Idealroutine (runsheet-routine.tsx + Producer)

- F2: Wochen-Kopf-Zeile „Warum die Frequenz sich ändert", wenn Ziel ≠ ihre Angabe;
  deterministischer Text je Richtung, generisch-ehrlich (bewusst OHNE Concern-Varianten:
  beide Mechanismen — Fettentzug und Talg-Ansammlung — stehen ehrlich in einem Satz, keine
  falsche Ursachen-Zuschreibung). Quelle: Shampoo-Step `idealAllowedRange`/`frequencyLabel`
  (Ziel) vs ihre Angabe; Note nur bei GENAU EINEM Shampoo mit bekannter Frequenz (Codex-
  Review: bei mehreren ist die Wochensumme maßgeblich, dann schweigt die Note und die Chips
  übernehmen). Helper pur + getestet.

## Ausführung

1. Hauptsession: T1 + T2 (+ page.tsx/cockpit.tsx-Anpassungen), Guardrails-Reword + Mirror-
   Sync, zugehörige Tests; Commit.
2. Hauptsession: T4 (klein, teilt page.tsx mit T1); Commit.
3. Opus-Delegation: T3 komplett (disjunkt nach den Commits aus 1–2).
4. T5: Re-Record, volle Suite, ci:verify → Codex-Whole-Branch-Review → /ship.

## T5 — Eval + Tests

- Golden-Profiles-Fixture-Re-Record (`npm run test:consult-brief -- --record nomi`) auf v4.
- Prompt-Pin-, Lint-, API-Schema-, Save-, Page- und DOM-Tests auf neues Schema/Layout.
- `npm run ci:verify` grün; Live-Eval-Lauf der 4 Golden-Profile.

## Nicht in diesem Slice

- Routine-Varianten nach Komplexität (Slice 4, R28).
- Retailer-/Budget-Band-Labels (offen), Budget-Bondbuilder (Nick recherchiert separat),
  PDF v2 (Slice 5).
