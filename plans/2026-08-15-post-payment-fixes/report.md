# UX Check: Post-Payment-Flow (Personal Plan)

**Date:** 2026-08-15
**URL:** https://chaarlie.de/test/quiz/<FIELD-TEST-TOKEN-REDACTED> (Test-Link → freie Aktivierung statt Zahlung)
**Viewports:** 375x812 (mobile, primär), 1440x900 (desktop, Stichprobe)
**Flow:** Quiz schnell ausfüllen → Testzugang aktivieren → alle Post-Payment-Stufen (Idealplan → Feinschliff → Produkte → Routine → Anwendung) inkl. aller Aktionen prüfen
**Test-Account:** field-test+4105875a-…@guest.chaarlie.invalid (Lead 971a66ec…, Draft e47d5ac4…)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Major | 5 |
| Minor | 6 |
| Cosmetic | 2 |

Der Flow ist bis einschließlich Stufe 4 (Routine) gut durchlaufbar und wirkt visuell hochwertig. Zwei Befunde sind aber echte Blocker am Ende des Funnels, und der Produktvergleich (das zentrale Visualisierungs-Element) hat auf Mobile handfeste Layout-Fehler.

## Findings

### [CRITICAL] Stufe 5 „Anwendung" ist ein Dead End — und blockiert auch den Chat
- **Category:** Interaction / Error recovery (Nielsen #9)
- **Viewport:** Both
- **Step:** Nach Abschluss der Produktprüfung → /anwendung
- **Screenshot:** `screenshots/24-mobile-anwendung-fehler.png`
- **Description:** /anwendung zeigt dauerhaft „Anwendung gerade nicht verfügbar", auch nach mehrfachem „Erneut laden". Zusätzlich leitet /chat (Header-Link und Tab) auf /anwendung um — der Nutzer kommt also weder zur Anleitung noch zum Chat. Für einen zahlenden Kunden ist damit der halbe Produktwert unerreichbar; Sentry-Envelopes wurden beim Fehler gesendet (haircare-fw/hair-concierge prüfen).
- **Suggested fix:** Root-Cause im Anwendungs-Generator fixen (Sentry-Event vom 15.08. ~11:42 UTC). Chat-Route nicht auf die kaputte Stufe redirecten, solange die Anleitung fehlt — Chat sollte unabhängig erreichbar sein.

### [CRITICAL] Falscher Fehlerscreen „Speicherstatus noch offen" nach erfolgreichem Speichern
- **Category:** Interaction / Visibility of system status (Nielsen #1)
- **Viewport:** Both
- **Step:** Letztes „Dieses Produkt einplanen" (Produkt 8 von 8, Bondbuilder)
- **Screenshot:** `screenshots/20-mobile-speicherstatus-fehler.png`
- **Description:** Nach dem letzten Einplanen erschien ein Fullscreen-Fehler „Speicherstatus noch offen. / Nicht gespeichert". Ein Klick auf „Speicherstatus erneut prüfen" zeigte, dass alles längst gespeichert war (Übergangsseite „Deine Produktauswahl steht" erschien). Der Fehler ist also spurios — genau an der Stelle mit maximaler Absprunggefahr wirkt das Produkt kaputt.
- **Suggested fix:** Status-Check nach dem Speichern mit Retry/Backoff robust machen, bevor der Fehlerscreen gezeigt wird; Fehlerscreen nur bei bestätigt fehlgeschlagenem Speichern.

### [MAJOR] Vergleichstabelle kollidiert auf 375px: Label läuft in den Wert
- **Category:** Interaction / Layout (Nielsen #8)
- **Viewport:** Mobile
- **Step:** Produkte prüfen → „Eigenschaft für Eigenschaft"-Tabelle
- **Screenshot:** `screenshots/15-mobile-produktvergleich-tabelle-zoom.png`
- **Description:** Gemessen: 0px Abstand zwischen Prüfpunkt-Spalte (111px) und „Deins"-Spalte. „Reinigungsintensität" + „sanft" verschmelzen zu „Reinigungsintensitätsanft". Zudem bricht „ausgeglichen" ohne Trennstrich mitten im Wort um („ausgegli/chen", in der Ziel-Spalte bleibt ein einzelnes „n" stehen). Das ist die zentrale Kaufentscheidungs-Visualisierung — genau hier darf nichts kaputt aussehen.
- **Suggested fix:** Mindest-Gap/Padding zwischen th und erster td; `hyphens: auto` mit `lang="de"` oder kürzere Wertlabels; Spaltenbreiten für 375px testen.

### [MAJOR] Footer-CTA „Jetzt auf meine Produkte abstimmen" ragt 68px aus dem Viewport
- **Category:** Interaction / Layout
- **Viewport:** Mobile
- **Step:** Idealplan → Optionale Empfehlungen (Footer-Navigation)
- **Screenshot:** `screenshots/08-mobile-idealplan-optional.png`
- **Description:** Gemessen: Button beginnt bei x=92, ist 351px breit → rechte Kante bei 443px auf 375px-Viewport. Label und Pfeil-Chevron sind abgeschnitten („…abstimm"). Ursache: „Zur Basis" + langer CTA teilen sich eine Zeile ohne Shrink.
- **Suggested fix:** Footer-Buttons flex mit `min-width: 0` + Text-Truncation, kürzeres Label („Auf meine Produkte abstimmen") oder zweizeiliges Stacking unter ~400px.

### [MAJOR] Idealplan-Karten: leere Bild-Platzhalter bei 4 von 6 Kategorien
- **Category:** Interaction / Aesthetic (Nielsen #8)
- **Viewport:** Both
- **Step:** Idealplan „Deine Basis" + „Zusätzlich sinnvoll"
- **Screenshot:** `screenshots/07-mobile-idealplan-bottom.png`, `screenshots/08-mobile-idealplan-optional.png`
- **Description:** Nur Shampoo und Haaröl zeigen ein Beispielbild mit „Beispiel"-Badge; Conditioner, Leave-in, Haarmaske und Bondbuilder zeigen ein leeres beiges Quadrat. Das liest sich als kaputte Bilder, nicht als bewusstes Design — direkt nach der Aktivierung der erste Eindruck des bezahlten Produkts.
- **Suggested fix:** Beispielbilder für alle Kategorien hinterlegen, oder Platzhalter durch ein Kategorie-Icon ersetzen und das Bildfeld bei fehlendem Bild ausblenden.

### [MAJOR] Feinschliff-Antworten und Produktangaben erscheinen nicht im Profil
- **Category:** Consistency / Data (Nielsen #4, #6)
- **Viewport:** Both
- **Step:** /profile nach komplettem Durchlauf
- **Screenshot:** `screenshots/25-mobile-profil-full.png`
- **Description:** Trotz beantwortetem Feinschliff steht im Profil: Alltag komplett „Noch offen" (Handtuch-Material, Trocknungstechnik, Trocknungsmethode, Nachtschutz — alle wurden beantwortet: Frottee, sanft ausdrücken, Lufttrocknen, kein Nachtschutz), Hitzetools „Noch offen" (beantwortet: Nichts davon), Produkte „Offen / Noch keine Produktangaben vorhanden" (Shampoo + Conditioner wurden angegeben; direkt darunter wird widersprüchlich „Balea Aqua Hyaluron — Nicht verwendet" gelistet). Der Nutzer sieht sein eigenes Onboarding nicht wieder und wird zum erneuten Ausfüllen aufgefordert.
- **Suggested fix:** Plan-Draft-Antworten in die Profil-Quelle syncen bzw. Profil aus dem eingefrorenen Routine-Stand lesen.

### [MAJOR] Interne Engine-Begriffe im Bondbuilder-Vergleich sichtbar
- **Category:** German UI / Match system–real world (Nielsen #2)
- **Viewport:** Both
- **Step:** Produkte prüfen → Bondbuilder (Produkt 8 von 8)
- **Screenshot:** `screenshots/19-mobile-bondbuilder-jargon.png`
- **Description:** Prüfpunkte heißen „Rollenbeziehung" und „Kritisches Protokoll" mit Werten „erfüllt/erfüllt/erfüllt" — für Nutzerinnen bedeutungsloses Engine-Vokabular. Auch die Erklärung („Für eine passende Produktempfehlung muss dieser Prüfpunkt erfüllt sein.") erklärt nichts.
- **Suggested fix:** Interne Prüfpunkte auf nutzerverständliche Labels mappen („Passt zu deiner Routine", „Verträgt sich mit deinen anderen Produkten") oder rein interne Checks aus der Tabelle ausblenden.

### [MINOR] Öl wird dreimal hintereinander abgefragt — mit identischem Inhalt
- **Category:** Flexibility & efficiency (Nielsen #7)
- **Viewport:** Both
- **Step:** Produkte prüfen, Produkte 4–6 („Vor der Haarwäsche", „Im feuchten Haar", „Im trockenen Haar")
- **Description:** Drei fast identische Screens in Folge, zweimal exakt dieselben Produkte/Tabellen (Arganöl). Fühlt sich wie ein Loop-Bug an und bläht „8 Produkte" auf, obwohl es 6 Kategorien sind.
- **Suggested fix:** Öl-Anwendungsfälle in einem Screen bündeln (ein Produkt, Checkboxen für Einsatzzwecke) oder mindestens „Gleiche Auswahl für alle Öl-Anwendungen übernehmen" anbieten.

### [MINOR] Doppelter Header mit zwei „chaarlie"-Wortmarken auf Routine/Anwendung
- **Category:** Aesthetic & minimalist (Nielsen #8)
- **Viewport:** Both (auf Mobile teurer)
- **Step:** /routine, /anwendung
- **Screenshot:** `screenshots/21-mobile-routine-top.png`
- **Description:** App-Header (Wortmarke + Profil-Icon) und Plan-Header (Wortmarke + „Gespeichert" + Stufen-Progressbar) stapeln sich; ~140px des 812px-Viewports sind Chrome, die Marke erscheint zweimal untereinander.
- **Suggested fix:** Im Personal-Plan-Bereich einen der beiden Header einklappen (z. B. Stufenleiste in den App-Header integrieren oder Wortmarke im Plan-Header entfernen).

### [MINOR] Mobile Bottom-Tab-Bar erscheint unverändert auf Desktop
- **Category:** Consistency & standards (Nielsen #4)
- **Viewport:** Desktop
- **Step:** /routine, /profile
- **Screenshot:** `screenshots/26-desktop-routine.png`
- **Description:** Die Tab-Bar (Chat/Routine/Anwendung/Profil) klebt auf 1440px als volle Breite am unteren Rand, Icons hunderte Pixel auseinander; gleichzeitig gibt es oben bereits dieselbe Navigation.
- **Suggested fix:** Tab-Bar ab md-Breakpoint ausblenden (obere Navigation reicht) oder als schmale zentrierte Leiste stylen.

### [MINOR] Katalog-Lücken in der Shampoo-Suche: Gliss, Elvital, Olaplex ohne Treffer
- **Category:** Content / Error prevention (Nielsen #5)
- **Viewport:** Both
- **Step:** Produkte → „Dein Shampoo" Suche
- **Description:** API liefert für category=shampoo bei „gliss", „elvital", „olaplex" 0 Kandidaten (geprüft via /api/personal-plan/stage-3/search; „balea" liefert 6, Gliss existiert als Conditioner). Sehr verbreitete Drogerie-Shampoos laufen damit direkt in den „Nicht gefunden"-Zweig und Handeingabe.
- **Suggested fix:** Shampoo-Abdeckung der Top-Drogeriemarken (Gliss, Elvital, Olaplex No.4 etc.) ingesten; „Nicht gefunden"-Suchbegriffe loggen und als Ingestion-Backlog nutzen.

### [MINOR] Grammatik: „Weiteres Conditioner hinzufügen"
- **Category:** German UI
- **Viewport:** Both
- **Step:** Produkte → Conditioner ausgewählt
- **Description:** Template „Weiteres {Kategorie} hinzufügen" ignoriert das Genus: „Weiteres Conditioner hinzufügen" (korrekt: „Weiteren Conditioner…"). Gleiche Gefahr bei „Weiteres Bondbuilder/Leave-in/Öl".
- **Suggested fix:** Pro Kategorie ein fertiges Label hinterlegen statt generischem Template.

### [MINOR] Entwickler-Sprech in Nutzertexten („eingefrorener Routine-Stand", „wenn das hier erlaubt ist")
- **Category:** German UI (Nielsen #2)
- **Viewport:** Both
- **Step:** Produktdetail-Sheet (/routine) und Maske-Empty-State (Produkte prüfen)
- **Screenshot:** `screenshots/23-mobile-produktdetail-dialog.png`, `screenshots/18-mobile-maske-keine-empfehlung.png`
- **Description:** „Die Eignung stammt aus dem eingefrorenen Routine-Stand." und „…fahre ohne Produkt fort, wenn das hier erlaubt ist." sind System-Innensicht, keine Nutzersprache.
- **Suggested fix:** Z. B. „Bewertung basiert auf deiner bestätigten Routine." / „…oder fahre ohne Produkt fort."

### [MINOR] Routine-Header: „Dein Idealplan mit 1 aktiven Produkt" ist irreführend
- **Category:** German UI / Visibility (Nielsen #1)
- **Viewport:** Both
- **Step:** /routine
- **Screenshot:** `screenshots/21-mobile-routine-top.png`
- **Description:** Die Routine enthält 6+ eingeplante Produkte; „1 aktives Produkt" zählt offenbar nur bereits besessene. Nutzer lesen das als „mein Plan hat nur 1 Produkt".
- **Suggested fix:** Zählung klarstellen („6 Produkte · 1 davon hast du schon") oder Satz entfernen.

### [COSMETIC] Kicker-Zeile umbricht mit Orphan „8"
- **Category:** Layout polish
- **Viewport:** Mobile
- **Step:** Produkte prüfen, alle Vergleichsseiten
- **Screenshot:** `screenshots/13-mobile-produktvergleich-top.png`
- **Description:** „SHAMPOO · HAUPTREINIGUNG · PRODUKT 1 VON␍8" — die „8" steht allein in Zeile 2.
- **Suggested fix:** `white-space: nowrap` um „1 von 8" bzw. `&nbsp;`.

### [COSMETIC] „Mein Produkt trotzdem behalten" wirkt nicht wie ein Button
- **Category:** Affordance (Nielsen #6)
- **Viewport:** Both
- **Step:** Produkte prüfen → Box „Andere Möglichkeit"
- **Screenshot:** `screenshots/14-mobile-produktvergleich-tabelle.png`
- **Description:** Der Behalten-Button ist grauer Text ohne Rahmen/Fläche in einer weißen Karte — als legitime Aktion kaum erkennbar (bewusst deprioritisiert, aber aktuell unter der Erkennbarkeitsschwelle).
- **Suggested fix:** Sekundär-Button-Styling (Outline) wie „Anpassen" auf /routine.

## Was gut funktioniert

- Quiz und Feinschliff sind schnell, klar, sauber gelayoutet; Auto-Save („Gespeichert") und Zurück-Navigation funktionieren durchgehend.
- Fünf-Stufen-Progressbar + Übergangsseiten geben ein starkes Gefühl von Fortschritt und Struktur.
- Der Vergleich „Dein Produkt vs. Alternative" mit Ampel-Badges ist konzeptionell stark und auf Desktop sauber; Preis-/Verfügbarkeits-Daten mit Affiliate-Hinweis im Produktdetail wirken vertrauenswürdig.
- Durchgehend informelles, konsistentes Deutsch; korrektes Fach-Vokabular (Haarstruktur/Haardicke/Haardichte) im Profil.
- Leere-Zustände sind fast überall bewusst gestaltet (Maske ohne Empfehlung, „Nicht verwendete Produkte").

## Anhang: Screenshots

Alle Screenshots unter `ux-audits/2026-08-15-post-payment-flow/screenshots/` (01–27, mobile + desktop).
