# Scan-Ergebnis — Design-Spezifikation und Umsetzungsanweisungen

> **Approved scope update — 2026-09-11:** First iOS smart-scanner version has **no Merkliste**. Keep the approved result design, complete alternatives and explanations. Remove Hinzufügen/save/remove actions; retain Kaufen ↗ per product, omitting the main footer if its shop link is missing. [Approved CTA evidence](evidence/scan-ergebnis/smart-scanner.html) and [decision record](decisions.md) are authoritative for this release. Save-related implementation tasks are excluded from this release; this note does not authorize broader scope or web entitlement changes.

> **Umsetzungsumfang: zuerst iOS.** Nick hat die erste Umsetzung auf die angepasste iOS-App und ihre notwendigen Backend-Änderungen begrenzt. Die Web-Abschnitte dokumentieren die gemeinsame Designrichtung für eine separate spätere Umsetzung; sie gehören nicht zum ersten Implementierungsplan. Bestehendes Web-Verhalten erhalten.

Gestaltungsstand 2026-09-10; iOS-Handoff bestätigt 2026-09-12. Von Nick freigegeben und gesperrt („lock those designs in“). Gilt für das
Ergebnis-Sheet nach einem Barcode-Scan, auf Web (`src/components/scan/scan-result-card.tsx`)
und in der iOS-App gleichermaßen. Die früheren iOS-Assessment-Mockups in `evidence/`
(`assessment-refined.html`, `five-assessment-directions.html`, Scan03 in `ios-flow-review.html`)
sind historische Referenz, nicht das freigegebene Design.

## Evidenz

[Verbindlicher Design-Handoff mit vollständigem Dateiverzeichnis](design-handoff.md) · [Bestätigter klickbarer Rundgang](evidence/walkthrough.html). Die bestehenden Screenshots bleiben erhalten; aktuellere Copy und die Entfernung der Merkliste haben Vorrang.

Aktuelle native Interaktion: `evidence/scan-ergebnis/smart-scanner.html` übernimmt die freigegebene Darstellung mit ausschließlich Kaufen-Aktionen und finalen Definitionen. Am 11.09.2026 von Nick bestätigt; `ios-abnahme.html` mit Speichern ist historische Evidenz. Die ursprüngliche `prototyp.html` zeigt die Web-Aktionsvariante. Historische Screenshots können ältere Erklärungstexte enthalten; verbindlich ist Abschnitt 3. Der zusätzliche Zustand „Noch nicht einschätzbar“ entspricht der von Nick bestätigten Entscheidung D3 für fehlenden persönlichen Zielkontext. Die integrierte visuelle Abnahme im klickbaren Rundgang wurde am 12.09.2026 bestätigt. Fehlende Produktinformationen sind ein anderer Zustand.


Alle Dateien liegen unter `plans/ios-scanner/evidence/scan-ergebnis/` und sind über den lokalen
Preview-Server erreichbar (`http://127.0.0.1:8770/scan-ergebnis/…`).

| Datei | Was es ist |
| --- | --- |
| `prototyp.html` | Klickbarer Prototyp (eine HTML-Datei, kein Backend, keine Kamera). Vier simulierte Scans, komplette Interaktionskette. Auf 375 px getestet, null Konsolenfehler. |
| `referenz.html` | Die Design-Seite: alle Zustände, Alternativen und Aktionen als Aufnahmen aus dem Prototyp, die Tabelle „Jede Aktion, was sie tut, wohin sie führt“ und die Regeln. |
| `frames/*.png` | Die zwölf Aufnahmen bei 375 × 812 @2x, plus `00-produktion-heute.png` (echter Screenshot der Web-Produktion mit denselben Daten). |
| `prototyp-README.md` | Prototype-Record nach `.agents/skills/prototype/SKILL.md`: Frage, Kriterium, Disposition. |
| `merkliste.html` | Historischer Merkliste-Entwurf; frühere Freigabe für die erste iOS-Version ausdrücklich aufgehoben. Nicht implementieren. |
| `historisch-alternativen-optionen.html` | Verworfene Alternativen-Darstellungen (Spalten, Delta-Karten, Streifen, Tipp). Nur zur Nachvollziehbarkeit. |

Der Prototyp ist Evidenz, kein Produktionscode. Nichts daraus wird übernommen; die Umsetzung
folgt dieser Spezifikation und dem normalen Test-first-Workflow.

## 1. Sheet

- Bottom-Sheet über der Live-Kamera. Höhe = Inhalt, maximal 88 % des Viewports. Body scrollt,
  Footer bleibt fix. Die Kamera bleibt oberhalb sichtbar und ist die Affordance für „weiter scannen“.
- **Standardansicht** (direkt nach dem Scan): Produktzeile, Verdict, Abweichungszeile, Tabelle,
  Überschrift „Alternativen“ und von der ersten Alternativ-Karte nur Packshot-Band und Name.
  Alles Weitere der Karten erscheint erst beim Scrollen (siehe 4).
- Schließen: X oben rechts (44 px), Wischen nach unten am Griff, Tipp auf die Kamera. Kein
  „Nochmal scannen“-Link, kein „Weiter scannen“-Button.
- Aufbau von oben:
  1. Produktzeile: Bild 52 px (Radius 12), Name 15/700 (zweizeilig erlaubt), darunter
     `Marke · Kategorie · ca. Preis` 12/400 gedämpft.
  2. Verdict in der Display-Serife (Playfair Display 28/600, Zeilenhöhe 1,12):
     „Passt zu deinem Haar“ · „Passt mit Einschränkung“ · „Passt nicht zu deinem Haar“;
     scheitert die Kopfhaut-Achse: „Passt nicht zu deiner Kopfhaut“.
     Farbe: Amber (`--status-pending-text` #805a16) nur bei „mit Einschränkung“, sonst Tinte.
  3. Abweichungszeile 15/400, **erzeugt, nicht getextet** (Ruling 10.09.): je abweichender
     Zeile `{Eigenschaft}: {Produktwert} statt {Ziel}` (Mengen-Achse: abgedeckte Stufen,
     z. B. „Kopfhaut: trocken, gereizt statt fettig“), mehrere mit „ · “ verbunden; alles grün →
     „Alles im Ziel.“ Keine Häufigkeit, kein Rat. Ersetzt „2 von 3 Zielbereichen“.
  4. Tabelle (Abschnitt 2).
  5. Alternativen (Abschnitt 4), nur wenn vorhanden.
- Footer (Abschnitt 5).

## 2. Tabelle

Eine Zeile pro Eigenschaft (Achse) der Kategorie, Reihenfolge = Reihenfolge der Engine
(`comparison-dimensions.ts`), nie nach Status sortiert.

- Karte: Radius 14, 1-px-Rand `--border`, Kopfzeile 32 px, Fläche #f6f3f0, Text 12/700
  Versalien, Spacing 0,08 em: leer · leer · PRODUKT · DEIN ZIEL (Plum) · leer.
- Raster, fünf feste Spalten: Name 62 px · Zeichen 16 px · Produkt 1 fr · Dein Ziel 1 fr ·
  „i“ 18 px. Gap 8 px, Innenabstand 10 px, Zeile **genau 52 px**, 1-px-Trenner.
- Name 13/600, darf an der Wortfuge auf zwei Zeilen brechen (Pflege-/gewicht).
- Zeichen: 16-px-Scheibe in der Statusfarbe mit weißem Glyph ✓ / ! / ✕. Genau ein Zeichen pro Zeile.
- Produkt 13/700 in der Statusfarbe, Ziel 13/600 in Plum (#6b50a0). Werte sind ein Wort und
  brechen nie um; längstes zulässiges Wort ist „ausgeglichen“. Längere Anzeigewörter erhalten eine semantisch äquivalente Präsentationsbeschriftung;
  Katalog-Fakten werden dafür nicht verändert. Native Dynamic-Type-Regeln siehe Abschnitt 8.
- Zeilenstatus (Ampel), Fläche + Wortfarbe + Zeichen:
  - passt: Fläche #edf7ef, Wort #356b45, ✓
  - mit Einschränkung: Fläche #fff5df, Wort #805a16, !
  - passt nicht: Fläche #fff0f1, Wort #9a3f48, ✕
- Mengen-Achsen (Kopfhaut, Haardicke): Treffer zeigt nur die Ziel-Stufe („fettig“); „jede“ nur,
  wenn der Katalog jede Stufe nennt. Fehlschlag zeigt die Stufen des Produkts zweizeilig in der
  52-px-Zelle (12,5 px). Nie ein Abstand auf ungeordneten Stufen.
- Ja/Nein-Achsen (Hitzeschutz): „ja“ / „nein“ als Wort.
- Scannbar ist binär (Ruling Q9): ein scannbares Produkt hat alle Werte; ein Produkt ohne
  vollständige Werte ist nicht scannbar und läuft in den bestehenden „Produkt aufnehmen“-Pfad
  (Kategorie wählen, Recherche, Push + E-Mail). Das Sheet kennt keinen „Unbekannt“-Zustand.
- Die ganze Zeile ist antippbar und öffnet die Erklärung; das „i“ (18-px-Ring, 1,5 px
  `--brand-plum-light`, Glyph 11/800 Plum) ist nur der Hinweis. Offen: „i“ gefüllt Plum.

## 3. Erklärung („Was bedeutet …“)

- Tipp auf eine Zeile: Kamera wird zu 55 % gedimmt, das Sheet bleibt hell, die Zeile bekommt
  das gefüllte „i“. Karte oberhalb des Sheets (Radius 20, Padding 14/16), Unterkante =
  Sheet-Oberkante + 12 px; reicht der Platz nicht, darf die Karte den Produktkopf überdecken,
  nie Verdict oder Tabelle.
- Inhalt: Eyebrow „WAS BEDEUTET“ (Plum), Titel Playfair 20, Definition 13/1,45, der bestehende
  Kategorie-Satz aus `decision-presentation.ts` („Deine Haaranalyse zeigt …“), Skala mit Beschriftung DEIN ZIEL / PRODUKT (geordnete Achse: drei Felder,
  Ziel Plum-hell, Produkt Tinte; Mengen-Achse: Wortliste, Ziel in Plum; Ja/Nein: zwei Felder).
- Schließen: X oben rechts (40 px), Tipp neben die Karte, Wischen. Kein „Verstanden“-Button.
- Definitionen (von Nick freigegeben, 10.09., Fassung des Fachreviews; nur in der Info-Box):
  - Pflegegewicht: Wie reichhaltig eine Formel ist. Leicht legt wenig auf, reichhaltig legt mehr auf und kann feines Haar beschweren.
  - Pflegerichtung: Ob eine Formel eher auf feuchtigkeitsbindende Stoffe oder auf Protein setzt. Ausgeglichen enthält beides.
  - Repair-Pflege: Wie stark eine Formel auf strapazierte Längen ausgelegt ist.
  - Haardicke: Für welche Haardicke die Formel ausgelegt ist: fein, mittel oder dick.
  - Reinigung: Wie gründlich ein Shampoo reinigt. Sanft wäscht weniger stark ab, klärend entfernt mehr Rückstände.
  - Kopfhaut: Für welche Kopfhaut die Formel ausgewiesen ist: fettig, ausgeglichen, trocken, mit Schuppen, mit trockenen Schuppen oder gereizt.
  - Hitzeschutz: Ob die Formel als Hitzeschutz für Föhn und Glätteisen ausgelegt ist.
  - Verträglichkeit: Deine eigene Angabe, ob du auf dieses Produkt schon einmal reagiert hast.
- Kein Hinweis-/Vorbehaltstext auf dem Sheet (Nick: „keine Caveats“); die Headline bei Kopfhaut-Fehlschlag bleibt „Passt nicht zu deiner Kopfhaut“.
- Kein neuer Copy-Layer für die Ziel-Herkunft: der generische `fit`-Satz je Kategorie aus
  `src/lib/personal-plan/decision-presentation.ts` reicht (Ruling 10.09.).

## 4. Alternativen

- Immer unter dem gescannten Produkt, auf jedem Verdict, sofern die Engine Alternativen liefert.
- Überschrift „Alternativen“ Playfair 22/600 nach einer 1-px-Trennlinie; Unterzeile 13 gedämpft:
  „Passen gleich gut oder besser · N“ (bei grünem Verdict: „Passen auch zu deinem Haar · N“).
- Karussell: horizontal wischbar mit Snap, eine Karte sichtbar (Breite = Inhalt − 34 px), die
  nächste lugt rechts herein, Punkte darunter (6 px, aktiv Plum). Auswahl: beste Passung
  zuerst (grün vor gelb), dann Preis aufsteigend, maximal 5. Alternativen mit Einschränkung
  bleiben drin.
- Karte (Radius 16, 1-px-Rand): Packshot-Band 88 px (oben abgerundet), Name 14/700. Erst beim
  Scrollen des Sheets (ab 24 px) erscheinen mit 250 ms Fade: Verdict der Alternative Playfair
  18 (Farbe wie oben), erzeugte Abweichungszeile 13, `Kategorie · Preis` 12, die Tabelle mit Kopfzeile im
  selben Raster ohne „i“-Spalte (54 · 16 · 1 fr · 1 fr, Gap 6, Werte 12 px), dann auf iOS nur „Kaufen ↗“ (weiß, 1-px-Rand). Die historische Web-Variante enthält zusätzlich „Hinzufügen“.
- Zeilen der Karten-Tabelle sind antippbar (Erklärung für dieses Produkt). Bild und Name tun nichts.
- Datenvertrag: jede Alternative liefert dieselben Achsen in derselben Reihenfolge, ihr
  Stage-3-Urteil, Preis und `purchaseUrl`; die Abweichungszeile wird aus den Zeilen erzeugt.
  Die Vergleichsebene `src/lib/personal-plan/products/fit-comparison.ts` berechnet die
  Tabellen-Evidenz bereits. Der aktuelle `alternativesFrom`-Mapper in
  `src/lib/scan/resolve-verdict.ts` gibt jedoch nur Urteil und Präsentationsdaten weiter;
  der native Vertrag muss die Zeilen zusätzlich übertragen. Die iOS-Auswahl erfolgt vor
  der Begrenzung: grün, dann gelb; innerhalb eines Urteils Preis aufsteigend; maximal fünf.
  Web behält seine bestehende differenziertere Reihenfolge und das Limit von drei.

## 4b. Nicht scannbar → Produkt aufnehmen (bestehender Pfad)

Das Ergebnis-Sheet erscheint nur bei einer belastbaren Einschätzung. Der Aufnahme-Pfad
gilt für fehlende Produktdaten. D3 präzisiert die frühere binäre Regel Q9: Ist das Produkt
bekannt, aber eine persönliche Angabe fehlt oder die bestehende Bewertungslogik keine
Einschätzung zulässt, erscheint stattdessen „Noch nicht einschätzbar“ mit einem kurzen,
sachlichen Grund. Schließen führt zurück zum Scanner. Für v1 keine Zusatzfragen und keine
Produkt-Recherche wegen fehlender Nutzerangaben. Ein bekanntes „nicht benötigt“ bleibt ein
eigenständiges Ergebnis und wird nicht als fehlende Information dargestellt.

Aufnahme-Pfad:

- Auslöser: Barcode nicht im Katalog · Produkt in Quarantäne · Produkt ohne vollständige Werte
  (nur bestätigte fehlende Produktdaten, nicht pauschal jeder `unknown`-Verdict). Ein Produkt mit offener Einreichung zeigt „Eingereicht!“.
- Ablauf (Produktion, `src/components/scan/scan-unknown-flow.tsx`, Copy in
  `src/lib/scan/verdict-labels.ts`): Sheet „Danke dir – das ist neu für uns!“, Brücke „Barcode
  gelesen – das Produkt fehlt noch in unserer Datenbank.“, „Wir nehmen es auf. Dein Ergebnis kommt
  in den Chat.“, Frage „Wobei benutzt du es?“ mit Kategorie-Karten; ein Tap reicht ein.
  Danach „Eingereicht!“; Recherche läuft asynchron; Ergebnis per Benachrichtigung.
- iOS: identischer Pfad, bestätigt in `decisions.md` Punkte 14 und 16 und Q7 (Kategorie-Wahl,
  asynchrone Recherche, Push + E-Mail statt Chat, Push-Freigabe erst nach erfolgreicher
  Einreichung). Screens im Fluss-Mockup `evidence/ios-flow-review.html` (Kapitel „Eingereicht +
  Push“, Push-Systemfreigabe, Ergebnis-Benachrichtigung). Die iOS-Copy „Dein Ergebnis kommt in
  den Chat“ muss auf Push/E-Mail umgestellt werden.
- Nicht Teil des gesperrten Sheet-Designs; hier nur verlinkt, damit die binäre Regel geschlossen ist.

## 5. Aktionen

Footer: zwei Slots à 48 px, Radius 12, Abstand 8, auf jedem Verdict gleich. **Kein „Trotzdem“.**

| Element | Was passiert | Wohin es führt |
| --- | --- | --- |
| Kaufen ↗ (Plum-Outline) | Öffnet den Partnerlink (`purchaseUrl`). | Browser / Shop des Partners; Sheet bleibt offen. Fehlt der Link, entfällt der Button und „Hinzufügen“ füllt die Breite. |
| Hinzufügen (Coral `--brand-coral-deep`, weiß 15/700) | Öffnet „Wohin damit?“. | Kleines Sheet: Titel „Wohin damit?“ (Playfair 22), Produktname, Optionen „Routine“ / „Merkliste“ mit je einer Beschreibungszeile. X zurück ins Ergebnis. |
| Routine | Legt das Produkt in die Routine (Kadenz wie heute im Speichern-Sheet, keine Vorbelegung aus dem Sheet). | Zurück ins Ergebnis; der Hinzufügen-Slot wird zum Chip „✓ In deiner Routine“. |
| Merkliste | Merkt das Produkt für den nächsten Einkauf. | Zurück ins Ergebnis; Chip „✓ Gemerkt“. |
| Chip „✓ In deiner Routine“ / „✓ Gemerkt“ (Plum-hell, Tinte Plum-dunkel) | Öffnet „Wohin damit?“ erneut, aktuelle Wahl markiert, Link „Entfernen“. | Ändern oder entfernen; zurück ins Ergebnis. |
| Hinzufügen / Kaufen ↗ auf einer Alternativ-Karte | Wie oben, für dieses Produkt. | Chip erscheint auf der Karte. |
| Tabellenzeile | Erklärung der Eigenschaft. | Karte über dem Sheet. |
| X, Wischen nach unten, Tipp auf die Kamera | Schließt das Ergebnis. | Sucher aktiv. |
| Produktzeile, Karten-Bild, Karten-Name | Nichts. | — |

**iOS v1 (bestätigt 11.09.2026): keine Merkliste.** Im Ergebnis-Footer bleibt nur „Kaufen ↗“ in der vorhandenen Plum-Outline-Gestaltung, über die verfügbare Breite. Auf Alternativ-Karten entfällt „Hinzufügen“ ebenfalls; ihr vorhandener Kaufbutton bleibt. Haupt-Footer → Shoplink des gescannten Produkts, Karten-Button → Shoplink genau dieser Alternative. Keine neue Beschriftung und kein Ersatz-Speicherziel.

Fehlt der Shoplink am Hauptprodukt, entfällt sein ganzer Footer; Alternativen behalten ihre eigenen verfügbaren Links. Kein Lesezeichen im Scan-Kopf, kein Merkliste-Screen, keine gespeicherten Chips und kein Entfernen-Sheet. Tabelle, Erklärung, Produktidentität, Karussell und Schließen bleiben unverändert. Bestehende Web-Merklisten und Routinen werden nicht verändert. Die historische plattformübergreifende Listenfreigabe gilt nicht für diese erste iOS-Version.

## 6. Tokens

Aus `src/app/globals.css`: Plum #6b50a0 / dunkel #3d2a62 / hell #c8b8e0 / Ice #f2eefa; Coral-deep
#aa464e für den Primär-Button (Weiß darauf ≈ 5,5:1); Statusfarben wie in Abschnitt 2;
Hintergrund #faf8f6, Karte #fff, Rand #e6e0da, Tinte #3b3532, gedämpft #68605b. Schrift: Plus
Jakarta Sans (Body), Playfair Display (Verdict, Überschriften). Schriftboden 12 px in der Tabelle.

## 7. Umsetzung, Web — historische Folgeplanung, nicht Teil des iOS-Builds

1. `scan-result-card.tsx`: Banner + `ScanDimensionBar` + Warum-Karte + Alternativen-Liste durch
   Produktzeile, Verdict, Abweichungszeile, Tabelle, Alternativen-Karussell ersetzen. Payload
   (`ScanResolvedVerdictResult`) bleibt; neu nötig sind nur die acht Definitionen (Copy in
   `src/lib/scan/verdict-labels.ts`), die erzeugte Abweichungszeile (pure Funktion in
   `result-presentation.ts`) und `purchaseUrl` je Alternative.
2. `scan-action-footer.tsx`: „Kaufen ↗“ + „Hinzufügen“; gespeicherter Zustand als Chip mit
   Tap → Sheet. `scan-save-sheet.tsx`: Titel „Wohin damit?“, Optionen „Routine“ / „Merkliste“
   mit Beschreibungszeilen, „Entfernen“ bei bestehender Wahl; Kadenz übergeben.
3. Erklärkarte als neues Overlay über dem Sheet (nicht im Body), Fokus-Falle, Escape/X/Backdrop.
4. Karussell mit `scroll-snap-type: x mandatory`, Punkte per `scroll`-Event; Karten-Details
   erst nach 24 px Body-Scroll einblenden (`revealed`-Klasse). Tabellen im Body mit
   `flex: 0 0 auto`, sonst schrumpfen sie in der Scroll-Flex-Spalte (bekannter Fehler).
5. Test-first für die deterministischen Teile: Zeilenstatus → Fläche/Zeichen, Mengen-Achsen
   (Treffer/Fehlschlag/„jede“), Sortierung der Alternativen, Sichtbarkeit von „Kaufen ↗“.
   Playwright: 375 px, keine Zelle mit `scrollWidth > clientWidth`, alle Zustände der
   Referenzseite.

## 8. Umsetzung, iOS (SwiftUI)

- Gleiche Hierarchie, gleiche Tokens, System-Dynamic-Type mit den Größen oben als Basis;
  Tabellenwerte dürfen bei größerer Schrift auf zwei Zeilen wachsen, die Zeile wächst mit.
- Sheet als `.sheet` mit Detents (Inhaltshöhe bis 88 %). Kameravorschau darf dahinter sichtbar bleiben; Barcode-Erkennung pausiert bis zum Schließen. Im Hintergrund/bei verdecktem Scan pausiert auch die Kamera.
- Karussell als `ScrollView(.horizontal)` mit `scrollTargetBehavior(.viewAligned)`,
  Karten-Details per `onScrollGeometryChange` ab 24 px einblenden.
- Erklärung als Popover/Overlay mit Dimmung nur über der Kamera.
- Footer gemäß Abschnitt 5 (iOS): nur Kaufen, keine Speicher-/Routine-Auswahl.
- Kein Kamerazugriff zur Design-Prüfung; Zustände über Fixtures rendern.

## 9. Prüfliste vor der Abnahme

- Alle zwölf Zustände der Referenzseite bei 375 px und 390 px, ohne abgeschnittene Werte.
- Amber nur bei „mit Einschränkung“; Rot nie in einer Headline; ein Coral pro Screen.
- Standardansicht zeigt von der ersten Alternative nur Bild und Name.
- iOS: kein Speichern/Chip/Entfernen; Kaufziel pro Produkt korrekt, Haupt-Footer ohne Shoplink vollständig ausgeblendet.
- Schließen über X, Wischen und Kamera-Tipp bringt den Sucher zurück.
