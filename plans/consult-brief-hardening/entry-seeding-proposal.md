# Entry-Seeding-Vorschlag (Consult-Wissensbasis)

Stand: 2026-09-29. Status: Entwurf, braucht Nicks Approval pro Eintrag (README, Mining-Prozess Schritt 4). Die 13 Einträge liegen unter `docs/research/consult-knowledge/entries/`. Sie entstehen hier ausnahmsweise aus Recherche statt aus Call-Notizen, als Seeding für die tatsächliche Quiz-Population. Deshalb ist `strong` nur dort gesetzt, wo `docs/research/goal-concern-levers/` den Kern ausdrücklich als `strong` führt.

**Blocker vor dem Merge:** Der Loader (`src/lib/discovery/consult-brief/knowledge.ts`) wirft beim Import auf unbekannte Flags, und `knowledge-sources.ts` ist ein wortgetreuer Spiegel mit Drift-Test. 12 der 13 Einträge nutzen neue Flags. Sie laden erst, wenn (1) die Flags in `CONSULT_FLAGS` + `CONSULT_FLAG_RELIABILITY` + README-Vokabular stehen, (2) `deriveConsultFlags` sie mappt und (3) die Dateien in `knowledge-sources.ts` gespiegelt sind. Geprüft: Alle 13 Dateien parsen mit `parseConsultKnowledgeEntry`, wenn die neuen Flags durch ein bekanntes Flag ersetzt werden, und keine enthält eine Phrase aus `CONSULT_FORBIDDEN_PHRASES`.

## Einträge

| id | category | conditions | Lücke in der Population | evidence |
| --- | --- | --- | --- | --- |
| `oily-scalp-wash-cadence` | mechanism | `[oily_scalp]` | fettige Kopfhaut ≈40 %, größte Gruppe; fein+fettig+glatt-Archetyp | moderate |
| `oily-roots-dry-lengths` | lever | `[oily_scalp, [dry_lengths_concern, breakage_signal, bleached, colored]]` | „fettiger Ansatz + trockene Längen", Überschneidung fettig × behandelt/trocken | strong |
| `oily-flakes-antidandruff` | lever | `[oily_scalp_flakes]` | `oily_dandruff` (91); Gegenstück zu `dry-flakes-vs-antifungal` | moderate |
| `frizz-mechanism` | mechanism | `[frizz_concern]` | `frizz_flyaways`, häufigstes Anliegen (516/879) | moderate |
| `ask-frizz-or-breakage` | question | `[frizz_concern]` | Frizz vs. Bruch unterscheiden (Zugtest „reißt" ≈21 %) | practice |
| `color-fade-honesty` | expectation | `[colored]` | gefärbt ≈39 % | moderate |
| `colored-oily-scalp-tradeoff` | lever | `[colored, oily_scalp]` | Archetyp gefärbt/normal/fettig/wellig; Ziele Farbe vs. Kopfhaut kollidieren | practice |
| `fine-hair-buildup-layering` | lever | `[fine_hair, volume_concern]` | fein 45 %, `low_volume_or_weighed_down` 295; feuert ohne Maske/Öl (anders als `heavy-care-paradox-fine-hair`) | moderate |
| `curly-coily-care-basics` | mechanism | `[curly_or_coily]` | lockig + kraus ≈17 %; Ratschläge für glattes Haar lassen sich nicht übertragen | moderate |
| `wavy-hair-weight-and-handling` | mechanism | `[wavy_hair, [frizz_concern, volume_concern, styling_goal_hold]]` | wellig 47 %, größte Textur-Gruppe; Top-Archetyp unbehandelt/wellig | practice |
| `irritated-scalp-phrasing` | phrasing | `[irritated_scalp]` | `irritated` (259), häufigstes Kopfhaut-Anliegen | practice |
| `shine-surface-reflection` | mechanism | `[shine_concern]` | `low_shine` (322) | moderate |
| `dry-lengths-softness` | mechanism | `[dry_lengths_concern]` | trockene Längen ≈441 | moderate |

Vorgeschlagene Selektionsregeln (Loader, analog `CONSULT_KNOWLEDGE_MERGES` / `_PRECEDENCE`):

- Merge: keep `oily-roots-dry-lengths`, fold `dry-lengths-softness` (gleicher Hebel, Platzierung).
- Merge: keep `heavy-care-paradox-fine-hair`, fold `fine-hair-buildup-layering` (ein Punkt: Menge, Platzierung, Schichtung).
- Kein Merge: `oily-scalp-wash-cadence` und `colored-oily-scalp-tradeoff` beide behalten. Der Trade-off ist bei gefärbtem Haar die eigentliche Botschaft.
- Optional: `frizz-mechanism` + `ask-frizz-or-breakage` feuern immer gemeinsam. Entweder zu einem Punkt zusammenführen (keep `ask-frizz-or-breakage`, fold `frizz-mechanism`) oder bewusst als Paar lassen. Nick entscheidet.
- `oily-flakes-antidandruff` und `dry-flakes-vs-antifungal` können beide feuern, wenn beide Schuppen-Arten angegeben sind; dann beide lassen, die Frage nach dem Schuppenbild entscheidet im Call.

Vorgeschlagene Änderung an einem bestehenden Eintrag (nicht umgesetzt, Scope): `ask-detangling` von `[breakage_signal]` auf `[[breakage_signal, tangling_concern]]` erweitern. `tangling` (212) hat heute keinen Eintrag, und der Inhalt passt 1:1.

## Neue Flags

Die Bezeichnungen der Quellfelder sind am Code geprüft: `concernProfileFacts` aus `concern-recipe-view.ts`, `consultFacts.scalpConcerns` aus `snapshot-facts.ts`, `DiagnosticConcern` aus `src/lib/quiz/diagnostic-input.ts` und die Legacy-Labels aus `src/lib/discovery/quiz-answers.ts`.

| Flag | Bedeutung | Quelle (Mapping-Vorschlag) | Verlässlichkeit |
| --- | --- | --- | --- |
| `oily_scalp` | Kopfhaut eher fettig | modern: Snapshot `profile.scalp.oiliness` = `oily` (= `concernProfileFacts.scalp_type` `oily`, Quiz `scalpOiliness`); legacy: `scalp_type` = `fettig` | hoch |
| `oily_scalp_flakes` | fettige/gelbliche Schuppen | modern: `scalpConcerns` enthält `oily_dandruff`. Legacy `scalp_condition` = `schuppen` sagt nichts über die Art und wird **nicht** gemappt; sonst müsste das Flag komplett auf niedrig. | hoch |
| `irritated_scalp` | Kopfhaut gereizt (Selbstauskunft) | modern: `scalpConcerns` enthält `irritated`; legacy: `scalp_condition` = `gereizt` | hoch |
| `frizz_concern` | Anliegen Frizz/Flyaways | `concerns` enthält `frizz_flyaways` (Alias `frizz` löst `resolveVisibleDiagnosticConcerns` schon auf) | hoch |
| `shine_concern` | Anliegen wenig Glanz | `concerns` enthält `low_shine` | hoch |
| `dry_lengths_concern` | Anliegen trockene Längen | `concerns` enthält `dry_lengths` (Alias `dryness`); falls im Rohquiz `dry_dull_lengths` vorkommt, mitmappen (steht heute nicht in `DIAGNOSTIC_CONCERNS`, prüfen) | hoch |
| `tangling_concern` | Anliegen Verknoten | `concerns` enthält `tangling`. Nur für die vorgeschlagene `ask-detangling`-Änderung; kein neuer Eintrag nutzt es. | hoch |
| `curly_or_coily` | Textur lockig oder kraus | `concernProfileFacts.hair_texture` ∈ {`curly`, `coily`} (Snapshot `profile.hair.texture`); legacy `structure` gleiche Werte (am Legacy-Rohwert verifizieren) | hoch |
| `wavy_hair` | Textur wellig | `hair_texture` = `wavy`; legacy `structure` = `wavy` (verifizieren) | hoch |

Kein eigenes Flag „gefärbt ohne Blondierung": Beide Farb-Einträge gelten auch bei blondiert + gefärbt (Toner verblasst sogar schneller). `colored` reicht.

## Bewusst nicht abgedeckt

- **`lost_shape` / Styling-Ziel (g):** existiert schon als `styling-goal-honesty`. Ein zweiter Eintrag wäre ein Duplikat. Die Technik für Welle und Locken steckt in den beiden Textur-Einträgen.
- **Haarausfall (18 Picks):** G2 trägt das. Die uncommittete Neufassung von `guardrails.md` in diesem Worktree (G1b „Medizinisches benennen ja, empfehlen nie") erlaubt es, ärztliche Wirkstoffe mit ärztlicher Verortung zu nennen. `lint.ts` führt `minoxidil` aber weiter als Forbidden-Phrase. Das muss die Guardrail-/Lint-Aufgabe auflösen, bevor ein Haarausfall-Eintrag sinnvoll ist. Danach ist er ein guter Kandidat, und G1b liefert die Formulierung schon. Die neuen Einträge verweisen bis dahin nur allgemein auf ärztliche Behandlungsmöglichkeiten, ohne Wirkstoffnamen.
- **Porosität, Sulfat- und Silikon-Debatten als eigene Einträge:** Die Evidenz ist dünn, und G1c deckt die Mythen schon ab. Wo es hingehört, ist es als Einordnung eingebaut („sulfatfrei" in `color-fade-honesty`, Silikon-Anreicherung ohne Schadensbehauptung in `fine-hair-buildup-layering`).
- **Grobes Haar (13 %), Spliss als eigenes Thema und UV-/Chlor-Schutz:** kleinere Gruppen oder schon von `expectation-windows`/G3 und den Bruch-Einträgen abgedeckt. Kandidaten für echte Call-Notizen statt Recherche-Seeding.
- **Kein Eintrag nennt Anti-Schuppen-Wirkstoffe:** G1b. Die Kategorie „Anti-Schuppen-Shampoo" reicht für den Call.
