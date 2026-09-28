# Consult-Wissensbasis (intern, Beratungs-Cockpit)

Stand: 2026-09-28. Nur intern. Die Dateien hier füttern den Consult-Brief-Generator für Nicks Discovery-Beratungscalls. Nichts davon wird Nutzerinnen direkt angezeigt. Der Brief ist Nicks Werkzeug für den Call.

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
evidence: moderate
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
conditions: [chemically_treated, heat_styling]   # beide
conditions: [[bleached, colored]]                # eins von beiden
conditions: [fine_hair, [mask_rich, oil_on_wet]] # feines Haar UND (Maske ODER Öl nass)
```

Body, in dieser Reihenfolge, als Markdown-Überschriften zweiter Ebene:

1. `## Einsicht` (Pflicht): 2–4 Sätze Mechanismus. Sachlich, ohne Verkaufston.
2. `## Im Call` (Pflicht): Formulierungshilfe für Nick. Telegram-knapp, Du-Form, Beratungssprache. Als Blockzitat (`>`), ein bis drei Sätze.
3. `## Frage` (optional): was live zu klären ist, als Aufzählung.

Formulierungshilfen halten `guardrails.md` ein: keine Heil- oder Reparaturversprechen, keine Garantien, keine Prozentwerte oder Evidenzgrade.

## Bedingungs-Vokabular

Abstrakte Flags. Das Mapping auf Profil-, Quiz- und Intake-Felder macht der Generator (`input.ts`), nicht der Eintrag. Neue Flags erst hier eintragen, dann im Loader mappen.

| Flag                    | Bedeutung                                                                                    | Quelle (Stand heute)                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `bleached`              | blondiert/aufgehellt                                                                         | `chemical_treatment` `bleached` / Snapshot `lightened` / Quiz `blondiert` |
| `colored`               | gefärbt/getönt ohne Aufhellung                                                               | `chemical_treatment` `colored`                                            |
| `chemically_treated`    | irgendeine chemische Behandlung (`bleached`, `colored`, `permed`, `chemically_straightened`) | wie oben                                                                  |
| `fine_hair`             | feines Haar (Durchmesser, nicht Dichte)                                                      | `thickness` `fine`                                                        |
| `dry_scalp_dry_flakes`  | trockene Schuppen / trockene Kopfhaut                                                        | `scalp_condition` `dry_flakes` oder `scalp_type` `dry`                    |
| `heat_styling`          | Hitze-Styling mindestens einmal pro Woche                                                    | Profil `heat_styling` `daily` / `several_weekly` / `once_weekly`          |
| `mask_rich`             | reichhaltige Maske in der aktuellen Routine                                                  | Intake / Verdicts (Kategorie `mask`)                                      |
| `oil_on_wet`            | Öl großzügig ins nasse/feuchte Haar                                                          | Intake-Anwendung / Call-Notiz                                             |
| `oil_in_routine`        | Öl in der aktuellen Routine, Anwendung unklar                                                | Intake (Kategorie `oil`)                                                  |
| `protein_or_bond_care`  | Protein- oder Bondbuilder-Pflege in Routine oder Plan                                        | Intake / Plan (Kategorie `bondbuilder`)                                   |
| `breakage_signal`       | Bruch-Signal: Zugtest „reißt" oder Anliegen Bruch/Schaden                                    | `elasticity` `snaps`, Anliegen `breakage` / `hair_damage`                 |
| `styling_goal_hold`     | Ziel „Form & Halt" / Form verliert sich                                                      | Anliegen `lost_shape`                                                     |
| `wash_frequency_change` | Plan ändert die Waschfrequenz gegenüber heute                                                | Plan vs. Intake                                                           |

## Mining-Prozess

Einträge entstehen aus Nicks Call-Notizen (Phase 5 des Runsheets, Nachbereitung), nicht aus freier Recherche.

1. **Notiz.** Nick hält nach dem Call fest, was überrascht hat, was eine Erklärung gebraucht hat oder welcher Satz funktioniert hat.
2. **Destillieren.** Eine Session macht aus einer Notiz höchstens einen Eintrag: Bedingung → Einsicht → Formulierungshilfe → Evidenzgrad. Personenbezogene Details (Namen, Produkte einer konkreten Teilnehmerin, Zitate) werden entfernt. Der Eintrag muss für die nächste Teilnehmerin mit denselben Flags gelten.
3. **Abgleich.** Prüfen gegen `guardrails.md`, gegen `concern-recipes/` und gegen `goal-concern-levers/`. Widerspricht ein Learning der Evidenz, wird es nicht zur Regel, sondern höchstens zur `question`.
4. **Approval.** Nick bestätigt jeden neuen oder geänderten Eintrag, bevor er committet wird. Ohne Approval kein Eintrag.
5. **Pflege.** Einträge werden überarbeitet statt dupliziert. Ein überholter Eintrag wird gelöscht, nicht auskommentiert.

Evidenzgrad bei neuen Einträgen: im Zweifel `practice`. `strong` nur mit Rückhalt in `docs/research/`.
