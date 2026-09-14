# Erklärkarte (iOS) — Implementierungsspezifikation

Stand 2026-09-12. Von Nick gewählte Form, Copy fachlich geprüft. Diese Datei ist der Vertrag für die Umsetzung; Designbelege und Entscheidungsweg liegen in `evidence/explanation-glossary/README.md`, gerenderte Referenz in `evidence/explanation-glossary/index.html` und `runde3-liste-final.png`.

## Aktuelle Umsetzungsfreigabe

Nick hat nach Aktualisierung dieser Spezifikation und Mockups ausdrücklich angefordert: „Can you please check them and then let's implement those.“ Die Hauptsession hat die gelieferte Glossar-Referenz geprüft und diese Freigabe am2026-09-12 an die Implementierung weitergegeben. Sie ersetzt die historischen Pending-Angaben in Abschnitt6: Copy-Tabelle wie geliefert; Haardicke-Definition einschließlich „: fein, mittel oder dick“; fehlende Bondbuilder-/Reaction-Bedeutungen als ausdrücklicher Label-Fallback, ohne neue Prosa. Aktueller scoped Vertrag und Prüfbeleg: [glossary-implementation.md](glossary-implementation.md).

## 1. Was die Karte ist

Die Karte, die beim Tipp auf eine Tabellenzeile im Scan-Ergebnis erscheint, ist ein **Glossar-Eintrag** für die Eigenschaft: Titel, Definition, dann jede mögliche Stufe mit einem Satz. Sie zeigt **keinen Produktwert, keinen Zielwert, keinen Status**. Diese Werte stehen bereits in der Zeile, von der der Nutzer kommt.

Ein Layout für alle Achsen. Der einzige achsabhängige Unterschied ist die Farbe der Leiste (siehe 3.4).

### Entfällt gegenüber `ExplanationOverlay` heute (`ios/Chaarlie/Assessment/AssessmentSheet.swift:241-296`)

- Eyebrow „WAS BEDEUTET“
- `row.categoryFit`-Satz
- Kopfzeile „DEIN ZIEL / PRODUKT“
- Stufenfelder mit Produkt-/Zielmarkierung (`stopView`)
- Schlusszeile „Dein Ziel: … · Produkt: …“ (`explanation.values`)
- 1-pt-Rand der Karte, weißer Schließen-Knopf mit Schatten

### Bleibt unverändert (nicht neu öffnen)

Positionierung, Übergang und Verhalten aus `info-position-correction.md`: `FloatingExplanationAnchor`, zentriert im sicheren Fensterbereich mit 16 pt seitlich / 24 pt vertikal Mindestabstand, 32 % Abdunklung, 180 ms Transparenzblende, keine Animation bei Reduce Motion, stationäres Ergebnisblatt (88 %-Detent), Inhalt scrollt in begrenzter Höhe, Schließen liegt außerhalb des Scrollers, Escape/X/Backdrop schließen, keine Drag-to-dismiss-Geste.

## 2. Datenvertrag

Neues Feld pro Zeile: **ein Bedeutungssatz je Stufe**. Vorschlag, minimal-invasiv:

```ts
// src/lib/mobile/scan-contracts.ts — mobileScanRowSchema
stops: z.array(z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  meaning: z.string().min(1),   // NEU
}))
```

```swift
// ios/Chaarlie/Networking/ScanContract.swift
struct Stop: Codable, Identifiable, Sendable { let id: String; let label: String; let meaning: String }
```

- Quelle der Sätze: neue Tabelle `AXIS_STOP_MEANINGS: Record<dimensionId, Record<stopId, string>>` neben `AXIS_DEFINITIONS` in `src/lib/mobile/result-presentation.ts`; `mobileRowsFromScanDimensions` füllt `stops[].meaning` daraus. Fehlt ein Satz (unbekannte Achse/Stufe), Zeile trotzdem liefern und `meaning` auf das Stufenwort setzen — nie eine leere Karte, nie einen erfundenen Satz.
- Kontraktversion: additives Feld. Wenn iOS `meaning` als Pflichtfeld dekodiert, müssen Backend und App zusammen ausgerollt werden; alternativ `meaning` in Swift optional (`String?`) und Fallback auf `label`. Entscheidung der Umsetzung, im PR benennen.
- `definition`, `stops[].label` und die Achsenreihenfolge bleiben die einzige Wahrheit; keine Copy in Swift hartcodieren.
- Die restlichen Felder (`targetValue`, `productValue`, `targetStopIds`, `productStopIds`, `categoryFit`, `displayStatus`) bleiben im Vertrag, weil die Tabelle sie braucht; die Karte liest sie nicht mehr.

## 3. Layout (Punkte, 402-pt-Referenzbreite)

Farben aus `ChaarlieTheme`: `ink #3b3532`, `muted #68605b`, `plum #6b50a0`. Neu in `ChaarlieTheme`: `plumMid #a996cc`, `plumScale #e7dff5` (heller Plum-Ton für die Leiste; bewusst gesättigter als das vorhandene `plumIce #f2eefa`, das für Flächen bleibt). Zeilentrenner `#f6f3f0`. Schließen-Fläche `#efebe6`.

### 3.1 Container

- Weiß, Eckradius 22, Innenabstand 20 auf allen Seiten, **kein** Rand.
- Schatten: schwarz 24 % Alpha (`rgba(20,12,8,.24)`), Radius 36, y-Versatz 14. (Heute: 18 %, 16, 5 – weicher und größer.)
- Breite: Fensterbreite minus 2 × 16. Höhe: Inhalt, begrenzt wie heute; Inhalt scrollt, Titel und X bleiben stehen.

### 3.2 Schließen

- Kreis 30 pt, Fläche `#efebe6`, X-Glyph `xmark` 12 pt / semibold in `ink`.
- 14 pt von oben und rechts. **Tap-Ziel 44 × 44 bleibt** (transparent über den Kreis hinaus).
- Accessibility-Label „Erklärung schließen“, Identifier unverändert.

### 3.3 Titel und Definition

| Element | Schrift | Farbe | Abstand |
|---|---|---|---|
| Titel (`row.label`) | `ChaarlieTheme.display(22)` (Playfair), Zeilenhöhe 1,2 | `ink` | rechts 40 pt frei für X; darunter 8 |
| Definition (`row.definition`) | `ChaarlieTheme.body(15)`, Zeilenhöhe 1,45 | **`ink`** (nicht `muted`) | darunter 18 |

Titel ist `.isHeader` und Fokusziel wie heute.

### 3.4 Stufenliste

Eine Zeile pro Eintrag in `row.stops`, in Vertragsreihenfolge.

**Zeilengeometrie – die zentrale Regel:** alle Zeilen einer Karte sind **gleich hoch**: Höhe = Höhe der längsten Zeile, mindestens 48 pt. Inhalt jeder Zeile vertikal zentriert. Padding 6 oben/unten. Zwischen den Zeilen 1-pt-Trenner `#f6f3f0` über die volle Breite (keine Einrückung). Kein Trenner vor der ersten oder nach der letzten Zeile.

Spalten, Abstand 10 dazwischen:

| Spalte | Breite | Inhalt |
|---|---|---|
| Punkt | 14 | 12-pt-Kreis, horizontal und vertikal zentriert |
| Stufenwort (`stop.label`) | 92 (Standard) · 64 bei genau 2 Stufen · 118 bei Kopfhaut (`shampoo.scalp_route`) | `body(15, .semibold)`, `ink`, Zeilenhöhe 1,35, darf umbrechen („trockene Schuppen“) |
| Bedeutung (`stop.meaning`) | Rest | `body(13)`, `muted`, Zeilenhöhe 1,45, mehrzeilig |

**Leiste:** 2 pt breite vertikale Linie, horizontal mittig in der Punkt-Spalte (x = 6 von deren linker Kante), von der **Mitte des ersten** bis zur **Mitte des letzten** Punkts. Punkte liegen über der Linie.

Farbe nach `row.axisKind`:

| axisKind | Punkte | Linie |
|---|---|---|
| `ordered` (Pflegegewicht, Pflegerichtung, Repair-Pflege, Reinigung) | Füllung ohne Rand, 1. `plumScale`, 2. `plumMid`, 3. `plum`. Bei mehr als drei Stufen linear zwischen `plumScale` und `plum` interpolieren. | Linearer Verlauf `plumScale` (oben) → `plum` (unten) |
| `set`, `categorical`, `binary` (Haardicke, Kopfhaut, Hitzeschutz, eigenständig) | Füllung `plumScale`, Rand 1,5 pt `plumMid`, alle gleich | Einfarbig `plumScale` |

Bedeutung des Verlaufs: „mehr davon“, nie eine Bewertung. Ohne Reihenfolge kein Verlauf, damit keine Rangfolge unterstellt wird.

Nach der letzten Zeile endet die Karte (Innenabstand 20). Kein Fazit, kein Hinweis, keine Werte.

### 3.5 Dynamic Type / Accessibility

- Alle Schriften skalieren relativ wie heute (`relativeTo`). Ab Accessibility-Größen darf eine Zeile auf zwei Zeilen stapeln: Stufenwort oben, Bedeutung darunter, gleicher Punkt links; die Gleich-hoch-Regel gilt weiterhin.
- Liste als eine Accessibility-Gruppe je Zeile mit Label „<Stufenwort>: <Bedeutung>“. Punkte und Linie `accessibilityHidden`.
- Karte bleibt `.isModal`, Escape schließt, Fokus auf den Titel beim Öffnen.

## 4. Copy

Definitionen: unverändert aus `design-spec.md` §3 (Quelle `AXIS_DEFINITIONS`). Stufentexte (Entwurf + Fachreview 12.09.2026; Freigabe durch Nick steht aus, siehe 6):

| dimensionId | stopId | Satz |
|---|---|---|
| conditioner.repair_support | low | Kaum Repair-Stoffe. Nicht auf strapazierte Längen ausgelegt. |
| | medium | Etwas Repair-Anteil. Auf leicht strapazierte Längen ausgelegt. |
| | high | Deutlich auf strapazierte Längen ausgelegt, etwa nach Färben, Blondieren oder viel Hitze. |
| conditioner.weight | light | Legt wenig auf. Für feines Haar oder schnell beschwerte Längen. |
| | medium | Legt mittelstark auf. Für die meisten Haartypen ausgelegt. |
| | rich | Legt viel auf. Für dickes, trockenes oder stark strapaziertes Haar. |
| conditioner.care_direction | moisture | Setzt auf feuchtigkeitsbindende Stoffe wie Glycerin oder Panthenol. |
| | balanced | Enthält beides, ohne klaren Schwerpunkt. |
| | protein | Setzt auf hydrolysierte Proteine, etwa Keratin oder Weizenprotein. |
| shampoo.cleansing_intensity | gentle | Wäscht weniger stark ab. Für trockene Kopfhaut oder häufiges Waschen. |
| | regular | Alltagsreinigung. Stärker als sanft, milder als klärend. |
| | clarifying | Entfernt mehr Rückstände und Talg. Für fettige Kopfhaut oder Ablagerungen. |
| hair.thickness | fine | Dünne einzelne Haare. Werden von reichhaltigen Formeln eher beschwert. |
| | normal | Weder auffällig dünn noch dick. |
| | coarse | Kräftige einzelne Haare. Werden von reichhaltigen Formeln seltener beschwert. |
| shampoo.scalp_route | oily | Fettet schnell nach, oft schon am nächsten Tag. |
| | balanced | Weder fettig noch trocken. |
| | dry | Fühlt sich trocken an oder spannt, ohne Schuppen. |
| | dandruff | Sichtbare, eher fettige Schuppen. |
| | dry_flakes | Feine, trockene Schüppchen ohne fettigen Glanz. |
| | irritated | Rötungen, Jucken oder Empfindlichkeit. |
| heat.protection | true | Vom Hersteller als Hitzeschutz ausgewiesen. |
| | false | Kein ausgewiesener Hitzeschutz. |

Regel für weitere Sätze (z. B. Bondbuilder „eigenständig / nur ergänzend“, `reaction`): entweder „auf X ausgelegt“ oder reine Beschreibung. Keine Eignungs- oder Wirkverben (reicht, verträgt, schützt, ohne zu beschweren), keine Ursachen bei Kopfhaut, „ausgewiesen“ statt „schützt“ bei Hitzeschutz. Copy bleibt im Backend, nicht in Swift.

## 5. Verifikation

- **Backend:** Test in `tests/` für `mobileRowsFromScanDimensions`: jede Stufe jeder bekannten Achse hat einen nicht-leeren `meaning`; unbekannte Stufe fällt auf `label` zurück; Zod-Schema akzeptiert das Feld. Fixture unter `tests/fixtures/mobile/` erweitern.
- **iOS UI-Test** (`ChaarlieUITests`, bestehender Explanation-Test): `explanation.values` existiert nicht mehr — Assertion auf die Schlusszeile entfernen und durch „Karte enthält alle `stops[].label` der Zeile und keinen `productValue`/`targetValue`-Text“ ersetzen. Stationäres Ergebnis (`testMainExplanationKeepsResultStationary`) muss weiter grün sein.
- **Geometrie-Test** (Unit oder UI, XCTAttachment): für Reinigung (1/2/3-zeilige Bedeutungen gemischt) haben alle drei Zeilen dieselbe Höhe; für Hitzeschutz sind beide Zeilen ≥ 48 pt.
- **Sichtprüfung** im Simulator gegen `evidence/explanation-glossary/runde3-liste-final.png`: Repair-Pflege (Verlauf), Kopfhaut (6 Zeilen, flache Leiste, 118-pt-Spalte, Scroll), Hitzeschutz (2 Zeilen, 64-pt-Spalte), einmal Accessibility XXXL, einmal Reduce Motion. Screenshots nach `implementation-evidence/`.
- Kein Wert und kein Status irgendwo in der Karte – per Test und per Auge.

## 6. Offen vor Umsetzungsstart (Nick)

1. Haardicke-Definition: mit oder ohne den Nachsatz „: fein, mittel oder dick“ (Stufen stehen jetzt direkt darunter). Betrifft nur `AXIS_DEFINITIONS["hair.thickness"]` und `design-spec.md` §3.
2. Freigabe der Copy-Tabelle in 4 als final.
3. Bondbuilder-Achse („eigenständig / nur ergänzend“): zwei Sätze nach der Regel in 4 nachziehen, im selben PR.

Außerhalb dieser Karte, vom Fachreview angemerkt: Der Scan-Flow braucht an anderer Stelle eine Eskalation für anhaltende Kopfhautbeschwerden (Dermatologie), weil die Karte bewusst keinen Rat trägt; und „Hitzeschutz: nein“ darf nirgends zu „schützt nicht“ werden.
