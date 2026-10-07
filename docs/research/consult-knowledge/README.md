# Consult-Wissensbasis (intern, Beratungs-Cockpit)

Stand: 2026-09-29. Nur intern. Die Dateien hier füttern den Consult-Brief-Generator für Nicks Discovery-Beratungscalls. Nichts davon wird Nutzerinnen direkt angezeigt. Der Brief ist Nicks Werkzeug für den Call.

## Dateien

| Pfad              | Rolle                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| `README.md`       | Format-Contract, Bedingungs-Vokabular, Mining-Prozess                        |
| `guardrails.md`   | Harte Regeln für Prompt und deterministischen Lint. Gehen jedem Eintrag vor. |
| `entries/<id>.md` | Ein Learning pro Datei. Dateiname = `id` + `.md`.                            |

Der Generator unter `src/lib/discovery/consult-brief/` lädt `guardrails.md` und alle `entries/*.md` maschinell. Wer das Format ändert, ändert den Loader mit. Einträge ohne gültiges Frontmatter gelten als Fehler, nicht als stillschweigend übersprungen.

Verhältnis zu den Nachbar-Quellen:

- `docs/research/concern-recipes/` liefert pro Quiz-Anliegen das Rezept (Kategorien, Hebel, Grenze). Die Wissensbasis ergänzt das um Call-Learnings: Mechanismen, die im Gespräch erklärt werden müssen, Fragen, Erwartungssätze, Formulierungen.
- Engines (Verdicts, Swap-Rankings, Routine-Gerüst) entscheiden Fakten. Ein Eintrag darf sie erklären, nie überschreiben.

## Eintrags-Format

Jede Datei in `entries/` beginnt mit YAML-Frontmatter, genau diese vier Felder, keine weiteren:

```yaml
---
id: dry-flakes-vs-antifungal
category: mechanism
conditions: [dry_scalp_dry_flakes]
evidence: practice
---
```

| Feld         | Typ                                                | Regel                                                                                                                                                                                                      |
| ------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | string, kebab-case                                 | Eindeutig, identisch mit dem Dateinamen ohne `.md`. Nie umbenennen, wenn der Eintrag schon genutzt wurde.                                                                                                  |
| `category`   | enum                                               | `mechanism` (warum etwas passiert), `lever` (was am meisten bewegt), `question` (was live zu klären ist), `expectation` (ehrliche Zeitfenster und Grenzen), `phrasing` (wie man etwas Heikles sagt)        |
| `conditions` | Liste aus Flags und Flag-Gruppen (Vokabular unten) | Siehe „Bedingungs-Semantik". Leere Liste `[]` = immer relevant.                                                                                                                                            |
| `evidence`   | enum                                               | `strong` / `moderate` / `practice`. **Nur intern.** Steuert, wie bestimmt der Generator formuliert, und erscheint nie im Brief-Text. `practice` = Beratungs- oder Salonpraxis, kein direkter Studienbeleg. |

### Bedingungs-Semantik

- **Top-Level-Elemente: AND.** Jedes Element muss zutreffen.
- **Verschachtelte Liste: OR.** Ein Element darf selbst eine Liste sein; es trifft zu, wenn mindestens ein Flag darin zutrifft. Nur eine Ebene tief.
- **Unbekannte Profilwerte matchen nicht.** Der Eintrag bleibt dann still.

Beispiele:

```yaml
conditions: []                                   # immer relevant
conditions: [breakage_signal]                    # ein Flag
conditions: [colored, hot_tool]                  # beide
conditions: [[bleached, colored]]                # eins von beiden
conditions: [fine_hair, volume_concern, [mask_in_routine, oil_on_wet]]
                                                 # feines Haar UND platt UND (Maske ODER Öl nass)
```

Body, in dieser Reihenfolge, als Markdown-Überschriften zweiter Ebene:

1. `## Einsicht` (Pflicht): 2–4 Sätze Mechanismus. Sachlich, ohne Verkaufston.
2. `## Im Call` (Pflicht): Formulierungshilfe für Nick. Telegram-knapp, Du-Form, Beratungssprache. Als Blockzitat (`>`), ein bis drei Sätze. Ein ärztlicher Verweis steht als eigener Absatz im Zitat (G6). Gibt es Varianten (z. B. seltener/häufiger waschen), bekommt jede ein eigenes Blockzitat mit kurzer Einleitungszeile davor.
3. `## Frage` (optional): was live zu klären ist, als Aufzählung.

Formulierungshilfen halten `guardrails.md` ein: keine Heil- oder Reparaturversprechen, keine Garantien, keine Prozentwerte oder Evidenzgrade.

## Bedingungs-Vokabular

Abstrakte Flags. Das Mapping auf Profil-, Quiz- und Intake-Felder macht der Generator (`input.ts`), nicht der Eintrag. Neue Flags erst hier eintragen, dann im Loader mappen.

Spalte „Verlässlichkeit": `hoch` = strukturiertes Profil- oder Plan-Feld; `niedrig` = Selbstauskunft ohne Menge/Anwendung oder nur aus Call-Notizen ableitbar (siehe „Generator-Hinweise").

| Flag                      | Bedeutung                                                                                                     | Quelle (Stand heute)                                                                                                                                                                                                                                                                                        | Verlässlichkeit                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `bleached`                | blondiert/aufgehellt                                                                                          | `chemical_treatment` `bleached` / Snapshot `lightened` / Quiz `blondiert`                                                                                                                                                                                                                                   | hoch                              |
| `colored`                 | gefärbt/getönt                                                                                                | `chemical_treatment` `colored` / Snapshot `colored` / Quiz `gefaerbt`                                                                                                                                                                                                                                       | hoch                              |
| `permed`                  | Dauerwelle                                                                                                    | `chemical_treatment` `permed`                                                                                                                                                                                                                                                                               | hoch                              |
| `chemically_straightened` | chemisch geglättet                                                                                            | `chemical_treatment` `chemically_straightened`                                                                                                                                                                                                                                                              | hoch                              |
| `fine_hair`               | feines Haar (Durchmesser, nicht Dichte)                                                                       | `thickness` `fine`                                                                                                                                                                                                                                                                                          | hoch                              |
| `dry_scalp_dry_flakes`    | trockene Schuppen                                                                                             | nur `scalp_condition` `dry_flakes`. `scalp_type` `dry` allein setzt das Flag **nicht**.                                                                                                                                                                                                                     | hoch                              |
| `hot_tool`                | heißes Styling-Gerät in Nutzung: Glätteisen, Lockenstab oder Welleneisen                                      | Intake `additionalHeatTools` enthält `straightener` oder `curling_or_wave_iron` (Profil-Hitze-Events: `straightener`, `curling_iron`). Föhn, Diffusor, Warmluftbürste zählen nicht.                                                                                                                         | hoch                              |
| `mask_in_routine`         | Maske in der aktuellen Routine; Häufigkeit, Menge und ob statt oder zusätzlich zum Conditioner sind unbekannt | Intake / Verdicts (Kategorie `mask`)                                                                                                                                                                                                                                                                        | niedrig                           |
| `oil_on_wet`              | Öl großzügig ins nasse/feuchte Haar                                                                           | Intake-Anwendung / Call-Notiz                                                                                                                                                                                                                                                                               | niedrig                           |
| `oil_in_routine`          | Öl in der aktuellen Routine, Anwendung unklar                                                                 | Intake (Kategorie `oil`)                                                                                                                                                                                                                                                                                    | niedrig                           |
| `protein_or_bond_care`    | Protein- oder Bondbuilder-Pflege in Routine oder Plan                                                         | Intake / Plan (Kategorie `bondbuilder`)                                                                                                                                                                                                                                                                     | hoch                              |
| `breakage_signal`         | Bruch-Signal: Zugtest „reißt" oder Anliegen Bruch/Schaden                                                     | `elasticity` `snaps`, Anliegen `breakage` / `hair_damage`                                                                                                                                                                                                                                                   | hoch                              |
| `volume_concern`          | Haar wird schnell platt / wirkt beschwert                                                                     | Anliegen `low_volume_or_weighed_down` oder Call-Notiz „wird schnell platt"                                                                                                                                                                                                                                  | hoch (Anliegen) / niedrig (Notiz) |
| `styling_goal_hold`       | Ziel „Form & Halt" / Form verliert sich                                                                       | Anliegen `lost_shape`                                                                                                                                                                                                                                                                                       | hoch                              |
| `wash_frequency_change`   | Plan ändert die Waschfrequenz gegenüber heute (seltener oder häufiger)                                        | Plan vs. Intake                                                                                                                                                                                                                                                                                             | hoch                              |
| `oily_scalp`              | Kopfhaut eher fettig                                                                                          | Snapshot `profile.scalp.oiliness` `oily` (Legacy-Quiz `scalp_type` `fettig` wird dorthin übersetzt)                                                                                                                                                                                                         | hoch                              |
| `oily_scalp_flakes`       | fettige/gelbliche Schuppen                                                                                    | Snapshot `profile.scalp.concerns` enthält `oily_dandruff`. `hair_profiles` `dandruff` (Art unbekannt) setzt das Flag nicht; Legacy-Quiz `schuppen` übersetzt der Plan-Adapter aber schon in `oily_dandruff`, der Brief erbt das; die wenigen Legacy-Fälle sind bewusst in Kauf genommen (Nick, 2026-09-29). | hoch                              |
| `irritated_scalp`         | Kopfhaut gereizt (Selbstauskunft)                                                                             | `scalp.concerns` / `scalp_condition` `irritated` (Legacy-Quiz `gereizt` wird dorthin übersetzt)                                                                                                                                                                                                             | hoch                              |
| `frizz_concern`           | Anliegen Frizz/Flyaways                                                                                       | Anliegen `frizz_flyaways` (Legacy-Alias `frizz`)                                                                                                                                                                                                                                                            | hoch                              |
| `shine_concern`           | Anliegen wenig Glanz                                                                                          | Anliegen `low_shine`                                                                                                                                                                                                                                                                                        | hoch                              |
| `dry_lengths_concern`     | Anliegen trockene Längen                                                                                      | Anliegen `dry_lengths` (Legacy-Alias `dryness`)                                                                                                                                                                                                                                                             | hoch                              |
| `tangling_concern`        | Anliegen Verknoten                                                                                            | Anliegen `tangling`                                                                                                                                                                                                                                                                                         | hoch                              |
| `curly_or_coily`          | Textur lockig oder kraus                                                                                      | Snapshot `profile.hair.texture` `curly` / `coily` (Legacy-Quiz `structure`, gleiche Werte)                                                                                                                                                                                                                  | hoch                              |
| `wavy_hair`               | Textur wellig                                                                                                 | Snapshot `profile.hair.texture` `wavy` (Legacy-Quiz `structure`, gleicher Wert)                                                                                                                                                                                                                             | hoch                              |

## Generator-Hinweise

Für `src/lib/discovery/consult-brief/` (T2):

- **Niedrige Verlässlichkeit → Frage zuerst.** Wird eine OR-Gruppe nur durch `niedrig`-Flags erfüllt, oder ist ein AND-Element `niedrig`, übernimmt der Brief zuerst die `## Frage` und formuliert die Einsicht als „falls ja, dann …", nicht als Befund.
- **Überschneidungen zusammenführen.** Feuern `heavy-care-paradox-fine-hair` und `oil-as-finish` gemeinsam, wird daraus ein Punkt (Menge und Platzierung), nicht zwei. Ebenso geht `fine-hair-buildup-layering` in `heavy-care-paradox-fine-hair` auf und `dry-lengths-softness` in `oily-roots-dry-lengths`. `frizz-mechanism` und `ask-frizz-or-breakage` bleiben bewusst zwei Punkte.
- **Stärkere Variante gewinnt.** Feuern `ongoing-damage-first` und `heat-on-colored-hair` gemeinsam (z. B. blondiert und gefärbt), gilt nur `ongoing-damage-first`.
- **Ton: ehrliche Fachberatung (R22).** Qualitativ sagen, was gut belegt, Erfahrungswert oder kaum untersucht ist, nie mit Zahlen; ärztliche Optionen faktisch nennen, nie empfehlen oder dosieren ([Plan](../../../plans/consult-brief-hardening/plan.md)).
- **Hebel 3–5, typoffen (R23).** Nach Impact für ihr Problem gereiht; Verhaltens-Hebel und Produkt-Züge zählen gleich ([Plan](../../../plans/consult-brief-hardening/plan.md)).
- **Call-Fragen 3–5 (R24).** Gereiht nach „ändert die Antwort den Plan?"; Themen-Batterien zu je einer Frage verdichtet ([Plan](../../../plans/consult-brief-hardening/plan.md)).
- **Seeding-Batch 2026-09-29 (R25).** Einmalig datengetrieben entlang der Quiz-Profilverteilung nachgesät; danach gilt unverändert nur der Mining-Prozess unten ([Plan](../../../plans/consult-brief-hardening/plan.md)).
- **Verdicts bleiben unangetastet (G4).** Einträge sprechen Menge, Platzierung und Rhythmus an. Sie kippen weder ein „passt" noch ein „passt nicht".
- **Eval-Lane.** `npm run test:consult-brief` schickt die drei Golden-Profile (`tests/fixtures/consult-brief/golden-profiles.ts`) gegen die echte API (on demand, nicht in CI) und legt die Briefe als Markdown unter `test-results/consult-brief-eval/<lauf>/` ab. Nach Änderungen an Einträgen, Guardrails oder Prompt laufen lassen; `--record nomi` erneuert die aufgezeichnete Antwort, die `tests/discovery-consult-eval.test.ts` API-frei pinnt.

## Mining-Prozess

Einträge entstehen aus Nicks Call-Notizen (Phase 5 des Runsheets, Nachbereitung), nicht aus freier Recherche.

1. **Notiz.** Nick hält nach dem Call fest, was überrascht hat, was eine Erklärung gebraucht hat oder welcher Satz funktioniert hat.
2. **Destillieren.** Eine Session macht aus einer Notiz höchstens einen Eintrag: Bedingung → Einsicht → Formulierungshilfe → Evidenzgrad. Personenbezogene Details (Namen, Produkte einer konkreten Teilnehmerin, Zitate) werden entfernt. Der Eintrag muss für die nächste Teilnehmerin mit denselben Flags gelten.
3. **Abgleich.** Prüfen gegen `guardrails.md`, gegen `concern-recipes/` und gegen `goal-concern-levers/`. Widerspricht ein Learning der Evidenz, wird es nicht zur Regel, sondern höchstens zur `question`.
4. **Approval.** Nick bestätigt jeden neuen oder geänderten Eintrag, bevor er committet wird. Ohne Approval kein Eintrag.
5. **Pflege.** Einträge werden überarbeitet statt dupliziert. Ein überholter Eintrag wird gelöscht, nicht auskommentiert.

Evidenzgrad bei neuen Einträgen: im Zweifel `practice`. `strong` nur mit Rückhalt in `docs/research/`.
