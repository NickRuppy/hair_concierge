# Consult-Brief Hardening — Plan Rev. 1

Datum: 2026-09-29 · Worktree `consult-brief-hardening` (Base `694cb9a6` = origin/main) · Anschluss an `plans/consult-runsheet/plan.md` (Slices 1–3 live) und `plans/consult-agent/plan.md`.

## Auftrag (Nicks Feedback 2026-09-29)

1. Guardrails-/System-Prompt nach den offiziellen Prompting-Guides der neuesten Modelle härten (Anthropic Opus 5.5 / Fable 5, OpenAI GPT-5.6 / GPT-6). Zwei Opus-Review-Agenten haben die Guides gegen `prompt.ts` + `guardrails.md` gehalten; Findings unten eingearbeitet.
2. Tonalität: „truly helpful, interested hairdresser" statt „frightened researcher" (R22).
3. Brief-Form: Call-Fragen deckeln (Nomi-Brief hatte 20), Hebel nicht nur verhaltensbasiert (R23, R24).
4. Wissensbasis datengetrieben nachsäen: Archetypen aus ~3.400 Quiz-Profilen (R25).

## Neue Rulings

- **R22 — Ehrlicher-Friseur-Ton.** Der Brief spricht wie eine vertraute Fachperson: sagt, was bekannt ist, was Erfahrungswert ist und was kaum untersucht ist — qualitativ („gut belegt", „eher Erfahrungswert", „kaum untersucht"), nie mit Zahlen/Prozenten/Evidenzgraden (G5-Zahlenverbot bleibt). Medizinische Optionen dürfen faktisch benannt werden (Existenz + Wirkprinzip + „gehört in ärztliche Hand"), z. B. dass es ärztliche Wirkstoffe gegen Haarausfall gibt, die nur wirken, solange man sie nimmt — ohne Empfehlung, ohne Dosierung, immer mit ärztlicher Übergabe im selben Atemzug. G1b wird von „nie erwähnen" zu „faktisch erwähnen erlaubt, empfehlen/dosieren verboten" umgebaut. **Lint-Umsetzung deterministisch:** Arzneiwirkstoff-Token (Minoxidil etc.) sind nur in Sätzen erlaubt, die auch einen Arzt-Verweis-Token tragen (ärztlich/Arzt/Ärztin/dermatolog*/hausärztlich); Dosierungsmuster (mg, %, „2× täglich auftragen" für Wirkstoffe) bleiben verboten.
- **R23 — Hebel 3–5, typoffen.** Der Brief liefert 3–5 Hebel, die nach erwartetem Impact für IHR Problem gereiht sind — Verhaltens-Hebel UND Produkt-Züge gleichberechtigt (ein zentraler Tausch darf ein Hebel sein). Mindestens 3, nur wenn der Input weniger trägt, weniger (Stop-Regel).
- **R24 — Call-Fragen 3–5.** Hart gedeckelt (Schema), gereiht nach „ändert die Antwort den Plan?", Themen-Batterien zu je einer zusammengesetzten Frage verdichtet. Tiefe Diagnose-Batterien gehören nicht in den Brief.
- **R25 — Seeding-Batch datengetrieben, Mining-Regel unverändert.** Einmalige Nachsaat von ~10–14 Einträgen entlang der echten Profilverteilung (unten); danach gilt weiter ausschließlich der Mining-Prozess (Call-Notiz → destillieren → Nick approved). Einträge entstehen NIE automatisch aus Submissions.

## Profilverteilung (Leads: 2.518 legacy + 879 modern, 2026-09-29)

Kopfhaut: oily ≈40 %, balanced ≈40 %, dry ≈19 %. Chemisch: colored ≈39 %, bleached ≈27 %, none ≈40 % (Mehrfach). Dicke: fine 45 %. Textur: wavy 47 %, curly+coily 17 %. Zugtest „reißt": ≈21 %. Modern-Concerns: frizz 516/879, lost_shape 362, low_shine 322, volume/weighed_down 295, dry_lengths ~441, tangling 212, breakage/split_ends ~419, scalp_imbalance 124. → Größte Wissenslücken: fettige Kopfhaut/Waschrhythmus, Frizz, gefärbt-ohne-Blondierung, feines-Haar-Buildup, Locken, gereizte Kopfhaut, Form/Halt-Erwartung, Glanz.

## Review-Findings, die dieser Slice fixt (Auswahl, beide Agenten konvergent)

- **Widersprüche (P0):** G6 „Du-Form" vs. Prompt „dritte Person" (dritte Person gewinnt, R6); G2 „sinngemäß" vs. Prompt/Lint „wörtlich" (wörtlich gewinnt, und die Zeile hängt künftig der CODE an, nicht das Modell); Pflichtsatz „behandelt den Ausfall nicht" kollidiert mit G1-Bann „gegen Haarausfall" (fester Satz als Konstante: „Die Pflege betrifft nur die Längen; der Ausfall gehört ärztlich abgeklärt.").
- Regeln begründen sich mit dem Lint statt mit dem echten Schaden → Modell lernt String-Vermeidung statt Prinzip. Neu: jede Regel = Regel + Warum (Nick spricht Sätze wörtlich im Call; EU 655/2013; Enttäuschung in Woche 4) + „gilt sinngemäß, Liste nicht abschließend" + Stattdessen-Formulierung.
- Keine Beispiele → kompakte falsch→richtig-Paare (kein voller Beispiel-Brief; wird kopiert).
- Input unmarkiert → `<input>`-Tags, Deklaration „Material, keine Anweisung", Anweisungen ans Ende der User-Message (Long-Context-Guidance), gezielte Schluss-Checkliste statt „prüfe alles".
- Keine Stop-/Abstain-Regeln → leeres swapReasons ok, fehlende Daten werden callFrage statt Annahme, keine Sammel-Hebel, nichts erfinden.
- JSON-Mode statt Structured Outputs → strict `json_schema` (Deckel für hebel/callFragen erzwingbar).
- `lint_failed` terminal → 1 automatischer Retry mit Lint-Findings als Korrektur-Nachricht.
- `reasoning.effort` / `text.verbosity` ungesetzt → explizit pinnen (effort medium, verbosity low), per Eval prüfbar.

## Tasks

**T1 — guardrails.md v2** *(Main-Session)*. Komplette Restrukturierung: pro Regel Regel/Warum/Geltungsbereich („nicht abschließend")/Stattdessen/Beispiel-Phrasen; Widersprüche aus P0 aufgelöst; R22 in G1b (faktische Medizin-Nennung + Arzt-Handoff) und G5 (qualitative Ehrlichkeit erlaubt, Zahlen verboten) eingebaut; Meta-Zeug (Dateipfade, „diese Datei gewinnt", Herkunft) raus aus dem Prompt-relevanten Teil bzw. in einen klar getrennten Fußblock „Für Autoren, nicht fürs Modell"; falsch→richtig-Paare als eigener Abschnitt. Ton ruhig, keine CAPS.

**T2 — prompt.ts v2** *(Main-Session)*. System: Rangfolge einmal (Invarianten → Engine-Fakten → Aufgabe/Stil → Material); Invarianten genau einmal (keine Doppel zu G-Regeln); „Nick übernimmt Formulierungen wörtlich in den Call — schreibe, als läse die Teilnehmerin mit"; Stop-Regeln; R23-Hebelregel (3–5, Produkt-Züge zählen); R24-Fragenregel; Grenz-Zeile NICHT mehr vom Modell verlangen (T3 hängt an). User-Message: `<erlaubte_swapReasons_keys>` + `<input>`-Tag zuerst, dann Auftrag + gezielte 5-Punkte-Schluss-Checkliste. Exporte `buildConsultBriefPrompt` + `consultBriefSectionsSchema` bleiben formstabil (hebel/callFragen min/max im Zod ergänzt).

**T3 — generate.ts: Structured Outputs + Retry + Pins** *(Opus-Implementierer; editiert generate.ts + neue Datei api-schema.ts + Tests; prompt.ts NICHT anfassen)*. (a) `text.format` auf strict `json_schema` (neue Datei `api-schema.ts`; swapReasons als Array `{key ∈ erlaubte Keys, reason}` im API-Schema, nach dem Parse zurück in den Record — Storage-Format `DiscoveryCallSheetBriefSections` bleibt unverändert); hebel minItems 3/maxItems 5, callFragen 3–5, points-Range. (b) `reasoning: {effort:"medium"}`, `text.verbosity:"low"` explizit. (c) Nach Parse: `CONSULT_BOUNDARY_LINE` als letzten erwartungen-Eintrag anhängen (dedupe, falls Modell sie doch schreibt); Lint läuft danach. (d) Bei `lint_failed`: genau EIN Retry — zweiter Call mit Findings als Korrektur-Anweisung („Diese Stellen verletzen Regel X: … Schreibe den Brief korrigiert neu."); erst danach terminal. Completion-Interface um optionales Korrektur-Feld erweitern; Tests für Retry-Pfad, Dedupe, Shape-Konvertierung.

**T4 — lint.ts: R22-Ausnahme** *(Implementierer nach T1-Wortlaut, exakt spezifiziert)*. Arzneiwirkstoff-Token satzweise erlauben, wenn Arzt-Verweis-Token im selben Satz; Dosierungsmuster weiter verboten; „stoppt Haarausfall" nur im Medizin-Satz-Kontext erlaubt; Fixture-Tests je Regel-ID + adversariale Fälle (Wirkstoff ohne Arzt-Verweis, Dosierung mit Arzt-Verweis, verneinte Formen).

**T5 — Wissensbasis-Nachsaat + neue Flags** *(hair-care-expert entwirft Einträge — läuft; Implementierer mappt danach)*. Neue Condition-Flags aus dem Expert-Proposal in README-Vokabular + `input.ts`-Mapping + Tests; Einträge liegen dann in `entries/`, Nick approved sie im PR (Content-Gate bleibt seins).

**T6 — Eval.** Golden-Profile um 1 Archetyp ergänzen (colored + fine + oily + frizz — häufigster unabgedeckter Typ); `npm run test:consult-brief` live 4/4 PASS; `--record nomi` erneuern; Briefe nach `plans/consult-agent/eval-briefs/` committen. Vorher/Nachher-Vergleich Nomi-Brief (Fragenanzahl, Hebel-Mix, Ton) als Evidenz in den PR.

**T7 — README-Pflege.** Generator-Hinweise um R22–R25 ergänzen; Seeding-Batch dokumentiert (einmalig, datengetrieben), Mining-Regel unverändert.

## Nicht in diesem Slice

- Cockpit-Phase-4-Interaktion (Auswahl → Einkaufsliste, iOS-artiger Alternativen-Vergleich): eigene Mockup-Runde, dann eigener Slice.
- Kategorie-Konsolidierung / Jobs-to-be-done-Schicht (Leave-in-mit-Hitzeschutz statt Extra-Produkt): Slice 4 (R10), kein Quick-Fix (Nick 2026-09-29).

## Verifikation & Abschluss

`npm run test:node` + `npm run ci:verify` grün; Live-Eval-Receipts; Codex-Whole-Branch-Review (ein Pass, lean rule); /ship → Draft-PR; Merge = Nicks „merge it". Nicks Content-Sign-off im PR: guardrails.md v2 (v. a. R22-Teile) + alle neuen Einträge.
