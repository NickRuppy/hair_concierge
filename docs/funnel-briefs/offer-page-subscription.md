# Handover: Angebotsseite SUBSCRIPTION

**Seite:** Result-Seite, Subscription-Variante des 50/50-Splits
**Stand:** 02.08.2026

| Laufzeit | Regulär | Launch | pro Monat |
|---|---|---|---|
| Monatlich | 14,99 € | 9,99 € | 9,99 € |
| Quartal (vorausgewählt) | 34,99 € | 19,99 € | ~6,66 € |
| Jährlich | 99,99 € | 69,99 € | ~5,83 € |

**Nicht betroffen:** Der Fehler im Zahlungs-Modal, der auf der Einmalplan-Seite auftritt, existiert auf dieser Seite nicht. Geprüft. Ebenso gibt es hier keine Widerrufs-Checkbox, also nichts zu entfernen.

Reihenfolge einhalten.

---

## SUB-01 · Footer mit Rechtstexten

**Ist:** Die Seite enthält im gesamten DOM genau einen Link, das Logo. Kein Impressum, keine Datenschutzerklärung, keine AGB, keine Widerrufsbelehrung, kein Kontakt, kein Firmenname.

**Neu:** Footer mit
- Impressum
- Datenschutzerklärung
- AGB
- Widerrufsbelehrung inklusive Muster-Widerrufsformular
- Kontakt: **info@chaarlie.de**
- Betreibende Firma mit Rechtsform
- Kündigungsbutton, siehe SUB-05

**Fertig wenn:** Alle Links vorhanden, laden eine echte Seite, auch aus dem Zahlungs-Modal erreichbar.

---

## SUB-02 · Garantie zusätzlich unter den Preisblock

**Ist:** Unter dem CTA steht nur die kleine graue Zeile *"14 Tage Geld-zurück-Garantie · Details in den Bedingungen"*. Der Garantie-Block "OHNE RISIKO" liegt weit unten.

**Neu:**
1. Zusatz *"Details in den Bedingungen"* streichen. Ebenso jede andere Einschränkung wie "nach Prüfung" oder "unter bestimmten Voraussetzungen".
2. Zeile unter dem CTA ersetzen durch:
```
14 Tage Geld-zurück-Garantie · Jederzeit kündbar
```
3. Der bestehende Block "OHNE RISIKO" weiter unten bleibt wie er ist.

**Fertig wenn:** Garantie ist im Viewport, sobald der Kaufbutton im Viewport ist.

---

## SUB-03 · Launch-Preis-Formulierung streichen

**Ist:** Zwischen Preisauswahl und CTA steht *"Dein Launch-Preis bleibt bis zur Kündigung erhalten. Regulär ab €14,99."*

**Neu:** Satz ersatzlos entfernen. Die Streichpreise bleiben stehen.

---

## SUB-04 · Zahlarten und Verschlüsselung unter den Button

**Ist:** Kein einziges Zahlungs- oder Sicherheitssignal auf der Seite.

**Neu**, unter dem CTA und im Modal:
```
[PayPal] [Visa] [Mastercard]

SSL-verschlüsselte Zahlung über Stripe
Deine Antworten bleiben bei uns. Keine Weitergabe an Dritte.
```

Kein Apple Pay, kein Klarna. Haben wir nicht.
Icons als SVG, mobil ohne Umbruch.

---

## SUB-05 · Kündigung sichtbar machen

**Ist:** Nirgends steht, wie gekündigt wird. Das Wort Kündigung kam nur in der Launch-Preis-Zeile vor, die durch SUB-03 entfällt.

**Neu:**
1. `Jederzeit kündbar` in die Garantiezeile unter dem CTA, siehe SUB-02.
2. FAQ "Kann ich Chaarlie jederzeit beenden?" aufnehmen, siehe SUB-06.
3. Kündigungsbutton nach § 312k BGB im Footer, dauerhaft erreichbar, Beschriftung "Verträge hier kündigen". Vorher rechtlich abklären.

---

## SUB-06 · FAQ ausbauen

**Ist:** Fünf sehr kurze FAQs. Die Abo-Begründung fehlt komplett.

**Neu:** Folgende Fragen nach oben, in dieser Reihenfolge. Texte 2 bis 6 stehen fertig im Artefakt `claude.ai/code/artifact/15f8a219-e019-48c1-9ca7-f6c815697979`. Text 1 ist die dort vorhandene Fassung, bewusst ausführlicher.

```
1. Wieso ist Chaarlie ein Abo?
Weil dein Haar sich verändert: Jahreszeiten, Färben, neue Produkte, neue Fragen.
Eine einmalige Auswertung veraltet. Chaarlie begleitet dich laufend: passt deine
Routine an, wenn sich deine Haarsituation ändert, tauscht Produkte aus, wenn sie
nicht mehr zu dir passen, und bleibt für deine Fragen ansprechbar. Genau das ist
der Unterschied zu einem PDF.

2. Kann ich Chaarlie jederzeit beenden?
Ja. In der App beendest du dein Abo jederzeit mit zwei Klicks.
Es gibt keine Mindestvertragslaufzeit, du wählst nur die Laufzeit, die zu dir passt.

3. Wieso kostet Chaarlie etwas?
Weil hinter jeder Empfehlung echte Arbeit steckt: geprüfte Produktdaten mit Quellen,
ein Coach der dein Profil kennt, und laufende Weiterentwicklung. Kostenlose Apps
verkaufen dir am Ende meistens Produkte. Chaarlie verkauft dir keine, deshalb bezahlst
du Chaarlie und nicht mit Fehlkäufen.

4. Was, wenn ich keine Ergebnisse sehe?
Wir machen bewusst keine Versprechen. Jede Haarsituation ist individuell, und seriös
lässt sich kein Ergebnis garantieren. Was wir aus unseren Auswertungen sagen können:
Mit einer wirklich passenden Routine steigt die Wahrscheinlichkeit deutlich, dass sich
dein Haar spürbar verbessert. Und weil wir davon überzeugt sind, tragen wir das Risiko:
Wenn dir Chaarlie in den ersten 14 Tagen nicht weiterhilft, schreib uns eine Nachricht
und du bekommst dein Geld zurück.

5. Woher weiß ich, dass das echt ist?
Berechtigte Frage. Deshalb siehst du bei Chaarlie zu jeder Empfehlung den Grund, und
unsere Produktdaten haben nachvollziehbare Quellen. Du musst uns nichts glauben, du
kannst alles nachprüfen. Und mit der Garantie liegt das Risiko bei uns, nicht bei dir.

6. Wie lange, bis ich etwas merke?
Das hängt von deiner aktuellen Haarsituation ab und ist bei jeder Person unterschiedlich.
Viele berichten uns, dass sie nach den ersten zwei Wochen Dinge wie eine ruhigere
Kopfhaut spüren. Nach drei bis fünf Wochen merken viele, dass ihre Haare geschmeidiger
und glänzender werden und das Gesamtbild einfach besser aussieht.

7. Muss ich zusätzlich teure Produkte kaufen?
Nein. Wir empfehlen in jeder Preisklasse, von Drogerie bis Salon. Du entscheidest, was
du kaufst. Passende Produkte, die du schon hast, übernehmen wir in deine Routine.
```

Die fünf bestehenden FAQs bleiben, rutschen darunter.

---

## SUB-07 · CTA-Farbe auf Markenlila

**Ist:** Haupt-CTA staubrot, Header-CTA und Auswahl-Markierung lila.

**Neu:** Haupt-CTA lila, identisch zum Header.

---

## SUB-08 · Testimonials

Betrifft ausschließlich diese Seite. Quiz-Strecke bleibt unverändert.

**Ist:** Nur Vorname, kein Bild, kein Kontext, Überschrift "STIMMEN AUS DER BETA".

**Neu:**
1. Überschrift: `Das sagen Kundinnen über Chaarlie.` Das Wort Beta entfällt komplett.
2. Volle Vornamen.
3. Kontext ergänzen: `Kim, 34, feines welliges Haar, blondiert`
4. Foto, wo Einverständnis vorliegt.
5. Längere Zitatfassungen aus dem Artefakt übernehmen, zum Beispiel Kim: *"Der Fragebogen ist echt gut und leicht verständlich. Im Chat hat das Antworten super geklappt. Auch die Produktempfehlung fand ich gut."* Die Erwähnung des Chats belegt den laufenden Nutzen.

---

## SUB-09 · Proof-Zeile unter die Hero-Headline

**Neu:**
```
★★★★★  Entwickelt mit Friseurmeistern aus Deutschland
```

Sterne ja. Keine Bewertungszahl, keine Kundenzahl, kein Name einer Person. Haben wir nicht belegt.

---

## Bewusst nicht jetzt

Geprüft und aufgeschoben, nicht vergessen:
- App-Mockups als laufender Abo-Gegenwert über dem Preisblock.
- Satz "Wir verdienen an keiner Produktempfehlung".
- Gründerbrief von Nick und Jonas vor dem finalen CTA.
- Em-Dash im CTA "Jetzt starten — €19,99 im Quartal".
- Benannte Friseurmeisterin mit Foto und Salon.
- Antworten der Kundin über den Diagnosekarten zurückspiegeln.
- Formulierung "Zugtest, Oberflächentest" entschärfen.
- 30-Tage-Versprechen mit einer Zeitangabe absichern.
- Hero-Visual gegen echte Kundinnenbilder testen.
- Laufzeit-Vorauswahl Jährlich statt Quartal testen.

---

## Offene Frage

Kündigungsbutton § 312k BGB: rechtlich abklären. SUB-05.
