# Erklärkarte als Glossar — gewählte Form

2026-09-12. Design-Entscheidung von Nick, Handoff an die iOS-Implementierung. Ersetzt die Vergleichsrichtung aus `../explanation-compact/` (A/B und die drei unteren Visualisierungen); diese bleiben historische Belege.

Vorschau: `index.html` in diesem Ordner, Screenshot `runde3-liste-final.png` (nutzt `../explanation-compact/result-background.png`), über den bestehenden Server `http://127.0.0.1:8774/explanation-glossary/`. Gleiche Seite als Artefakt: https://claude.ai/code/artifact/279fdfed-5516-413f-b4e3-7b22a13b3102 (Version „Runde 3“; Runde 1 und 2 in der Versionshistorie).

## Entscheidung

Nick, wörtlich sinngemäß: Die Karte ist nur eine Erklärung. Sie braucht keine Produkt- oder Zielwerte, sondern zeigt das mögliche Spektrum der Eigenschaft. Eine generalisierbare Form für alle Eigenschaften. Aus drei Varianten (Liste, Balken, Fließtext) gewählt: **Liste mit Verlaufsleiste und Farben**, mit dem Wissen, dass der Verlauf nicht für alle Kategorien passt.

Damit entfallen in der Karte: `DEIN ZIEL` / `PRODUKT`, Stufenfelder mit Produkt-/Zielmarkierung, der Satz „Dein Ziel: … · Produkt: …“, der Kategorie-Kontextsatz (`categoryFit`) und das Eyebrow „WAS BEDEUTET“. Werte und Zeilenstatus bleiben ausschließlich in der Tabelle, von der der Nutzer kommt.

Unverändert und nicht neu geöffnet: zentrierte Position, stationäres Ergebnisblatt, 32 % Abdunklung, Transparenzblende, Reduce Motion, begrenzte Scrollhöhe mit Schließen außerhalb des Scrollers (`info-position-correction.md`).

## Karte (Spezifikation)

Verbindlicher Implementierungsvertrag: `../../explanation-card-spec.md`. Dieser Abschnitt ist die Kurzfassung.

Container: weiß, Radius 22, Padding 20, kein Rand, Schatten `0 14 36 rgba(20,12,8,.24)`. Schließen: 30-pt-Kreis `#efebe6`, X in Tinte, 14 pt vom Rand (44-pt-Tap-Ziel bleibt Pflicht). Farben aus `ChaarlieTheme`: Tinte `#3b3532`, gedämpft `#68605b`, Plum `#6b50a0`, Zeilentrenner `#f6f3f0`. Neu nur zwei Plum-Tinten für die Skala: `plumMid #a996cc`, `plumIce #e7dff5` (etwas gesättigter als `ChaarlieTheme.plumIce`).

1. Titel: Playfair 22, Tinte, rechts 40 pt frei für X.
2. Definition: Plus Jakarta 15/1,45 in **Tinte** (nicht gedämpft). Text = freigegebene Definition aus `design-spec.md` §3, unverändert.
3. Stufenliste: eine Zeile pro möglicher Stufe der Achse (`row.stops`, in Achsenreihenfolge). **Alle Zeilen einer Karte gleich hoch** (Höhe der längsten Zeile, mindestens 48 pt), Inhalt vertikal mittig, Padding 6 pt oben/unten; Trenner 1 pt `#f6f3f0` zwischen Zeilen. Zeile = Raster `14 | 92 | 1fr`, Abstand 10. Stufenwort 15/600 Tinte; Bedeutung 13/1,45 gedämpft. Spaltenbreite 64 bei ja/nein, 118 bei Kopfhaut („trockene Schuppen“).
4. Leiste links, **auf jeder Karte**: 12-pt-Punkte mittig in Spalte 1, 2-pt-Linie von der Mitte des ersten bis zur Mitte des letzten Punkts.
   - **Geordnete Achsen** (Pflegegewicht, Pflegerichtung, Repair-Pflege, Reinigung): Punkte in drei Tinten plumIce → plumMid → Plum, Linie mit linearem Verlauf plumIce → Plum. Bedeutung: „mehr davon“, keine Bewertung.
   - **Mengen** (Haardicke, Kopfhaut) und **Ja/Nein** (Hitzeschutz): gleiche Punkte plumIce mit 1,5-pt-Rand plumMid, Linie einfarbig plumIce. Gleiche Struktur, kein Verlauf, weil es keine Reihenfolge gibt.
5. Kein Fazit, kein Status, keine Werte. Karte endet nach der letzten Stufe.

Accessibility: Titel bleibt Header und Fokusziel; Liste als Aufzählung mit „Stufe: Bedeutung“; Punkte und Linie dekorativ. Bei Accessibility-Schriftgrößen darf die Zeile auf zwei Zeilen stapeln (Wort über Bedeutung); die Skala bleibt links. Kein nativer Dynamic-Type-Nachweis in diesem Beleg.

Datenvertrag: Stufenwort = vorhandenes `stop.label`. Bedeutungssatz je Stufe ist **neue Copy** und muss als Tabelle `axisId × stopId → Satz` an einer Stelle liegen (Vorschlag: neben `AXIS_DEFINITIONS` in `src/lib/mobile/result-presentation.ts`, damit iOS sie über den bestehenden Row-Vertrag erhält). Bondbuilder-Achse „Wirkt eigenständig“ (eigenständig / nur ergänzend) ist hier nicht abgedeckt; gleiche Form, Copy fehlt.

## Copy (Entwurf, Fachreview 12.09.2026 eingearbeitet)

Definitionen unverändert aus `design-spec.md` §3. Stufentexte: Hauptsession-Entwurf, geprüft vom hair-care-expert-Agenten (read-only). Alle Umformulierungen des Reviews übernommen; Prinzip: jede Zeile ist entweder „auf X ausgelegt“ oder reine Beschreibung, keine Eignungs- oder Wirkverben (reicht, verträgt, ohne zu beschweren).

| Eigenschaft | Stufe | Satz |
|---|---|---|
| Repair-Pflege | niedrig | Kaum Repair-Stoffe. Nicht auf strapazierte Längen ausgelegt. |
| | mittel | Etwas Repair-Anteil. Auf leicht strapazierte Längen ausgelegt. |
| | hoch | Deutlich auf strapazierte Längen ausgelegt, etwa nach Färben, Blondieren oder viel Hitze. |
| Pflegegewicht | leicht | Legt wenig auf. Für feines Haar oder schnell beschwerte Längen. |
| | mittel | Legt mittelstark auf. Für die meisten Haartypen ausgelegt. |
| | reichhaltig | Legt viel auf. Für dickes, trockenes oder stark strapaziertes Haar. |
| Pflegerichtung | Feuchtigkeit | Setzt auf feuchtigkeitsbindende Stoffe wie Glycerin oder Panthenol. |
| | ausgeglichen | Enthält beides, ohne klaren Schwerpunkt. |
| | Protein | Setzt auf hydrolysierte Proteine, etwa Keratin oder Weizenprotein. |
| Reinigung | sanft | Wäscht weniger stark ab. Für trockene Kopfhaut oder häufiges Waschen. |
| | regulär | Alltagsreinigung. Stärker als sanft, milder als klärend. |
| | klärend | Entfernt mehr Rückstände und Talg. Für fettige Kopfhaut oder Ablagerungen. |
| Haardicke | fein | Dünne einzelne Haare. Werden von reichhaltigen Formeln eher beschwert. |
| | mittel | Weder auffällig dünn noch dick. |
| | dick | Kräftige einzelne Haare. Werden von reichhaltigen Formeln seltener beschwert. |
| Kopfhaut | fettig | Fettet schnell nach, oft schon am nächsten Tag. |
| | ausgeglichen | Weder fettig noch trocken. |
| | trocken | Fühlt sich trocken an oder spannt, ohne Schuppen. |
| | Schuppen | Sichtbare, eher fettige Schuppen. |
| | trockene Schuppen | Feine, trockene Schüppchen ohne fettigen Glanz. |
| | gereizt | Rötungen, Jucken oder Empfindlichkeit. |
| Hitzeschutz | ja | Vom Hersteller als Hitzeschutz ausgewiesen. |
| | nein | Kein ausgewiesener Hitzeschutz. |

Review-Hinweise, die über die Karte hinausgehen (nicht in dieser Karte lösen): (1) Kopfhaut-Stufen liegen auf dem Kontinuum Schuppen/seborrhoische Dermatitis; die Karte trägt bewusst keinen Rat, also muss die Eskalation (anhaltende Rötung, Juckreiz, offene Haut → Dermatologie) im Ergebnisblatt oder Scan-Flow existieren; vor Auslieferung prüfen, ob sie es tut. (2) „Hitzeschutz nein“ darf nirgends zu „schützt dein Haar nicht“ werden; ausgewiesen ≠ gemessen.

## Offen vor Umsetzung

- Nick: Haardicke-Definition mit oder ohne „: fein, mittel oder dick“ (Stufen stehen jetzt direkt darunter).
- Nick: Copy-Tabelle oben final freigeben (Entwurf + Fachreview, keine Produktfreigabe).
- Copy für „Wirkt eigenständig“ (Bondbuilder) nachziehen.
- Sichtbaren Öffnen/Lesen/Schließen-Ablauf nach Umsetzung nativ prüfen (Dynamic Type XXXL, VoiceOver, Reduce Motion) wie in `info-position-correction.md`.

Status: Entwurf gewählt, Copy geprüft, **Umsetzung nicht freigegeben** bis die zwei Nick-Punkte oben beantwortet sind. Undiscussed consequential assumptions affecting this handoff: none.

## Aktuelle Freigabe für die Umsetzung

2026-09-12: Nicks direkter Auftrag zur Implementierung der aktualisierten Spezifikation bestätigt die gezeigte Glossar-Form und gelieferte Copy. Die früheren Aussagen „Umsetzung nicht freigegeben“ oben sind historisch. Haardicke bleibt wie gezeigt einschließlich des Nachsatzes; fehlende besondere Stufenbedeutungen verwenden den expliziten Label-Fallback. [Aktueller Umsetzungsvertrag](../../glossary-implementation.md).
