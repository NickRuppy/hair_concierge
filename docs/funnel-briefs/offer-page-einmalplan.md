# Handover: Angebotsseite EINMALPLAN

**Seite:** `chaarlie.de/result/{id}?entry=quiz_completion`, Package `meta_personal_plan_v1`
**Preis:** neu 29,99 € statt 49,99 €, Einmalzahlung
**Stand:** 02.08.2026

Reihenfolge einhalten. EP-01 zuerst.

---

## EP-01 · Blocker: Widerrufs-Checkbox raus, Fehlermeldung verschwindet damit

**Ist:** Das Zahlungs-Modal öffnet auf einem frischen Load mit zwei roten Fehlern, bevor die Kundin irgendetwas klickt:
- *"Die Zahlung konnte nicht bestätigt werden. Bitte prüfe deine Angaben und versuche es erneut."* plus Button "Erneut versuchen"
- *"Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."*

Beim Öffnen wird kein Payment-Request abgesetzt. Nur PostHog und Facebook Pixel. Beim Page-Load gehen 4 Sentry-Exceptions raus.

**Neu:**
1. Checkbox und Text *"Ich verlange ausdrücklich die sofortige Erstellung meines Haarplans. Mir ist bekannt, dass mein Widerrufsrecht nach vollständiger Erstellung und Bereitstellung erlischt."* ersatzlos entfernen.
2. An dieselbe Stelle im Modal:
```
14 Tage Zufriedenheitsgarantie
Wenn dein Plan nicht zu dir passt, schreib uns eine Mail.
Du bekommst dein Geld zurück, ohne Diskussion.
```
3. Error-State nie beim Mount rendern. Nur nach einem echten fehlgeschlagenen Versuch.
4. Sentry-Exceptions beim Page-Load aufräumen.

**Fertig wenn:** Frischer Load, Klick auf CTA, Modal öffnet ohne rote Schrift. Sichtbar: Produkt, Preis, Garantie, Zahlarten.

**Rechtlich:** Ohne Checkbox behält die Kundin ihr volles Widerrufsrecht. Kostet nichts, weil ohnehin 14 Tage Geld zurück. Bedingung: Widerrufsbelehrung existiert (EP-03) und nirgends steht, es gebe kein Widerrufsrecht.

---

## EP-02 · Garantie unter den Zahlungsbutton, einmalig

**Ist:** Auf dieser Seite gibt es keine Garantie. Unter dem Button steht nur `Einmalzahlung · Kein Abo`.

**Neu:** Diese Zeile ersetzen durch:
```
14 Tage Geld-zurück-Garantie · Einmalzahlung · Kein Abo
```

**Nicht doppelt einbauen.** Kein zusätzlicher Garantie-Block weiter unten. Keine Zusätze wie "Details in den Bedingungen", "nach Prüfung", "unter bestimmten Voraussetzungen".

**Fertig wenn:** Garantie ist im Viewport, sobald der Kaufbutton im Viewport ist.

---

## EP-03 · Footer mit Rechtstexten

**Ist:** Die Seite enthält im gesamten DOM genau einen Link, das Logo. Kein Impressum, keine Datenschutzerklärung, keine AGB, keine Widerrufsbelehrung, kein Kontakt, kein Firmenname.

**Neu:** Footer mit
- Impressum
- Datenschutzerklärung
- AGB
- Widerrufsbelehrung inklusive Muster-Widerrufsformular
- Kontakt: **info@chaarlie.de**
- Betreibende Firma mit Rechtsform

**Fertig wenn:** Alle Links vorhanden, laden eine echte Seite, auch aus dem Zahlungs-Modal erreichbar.

---

## EP-04 · Preis als Discount

**Neu:**
```
Persönlicher Haarplan
~~€49,99~~   €29,99
Du sparst €20,00
```

An allen drei Stellen gleich: Sticky-Header, Preisblock, Modal-Kopf.
Sticky-Header: `Haarplan · 29,99 € statt 49,99 € · Zur Zahlung`

**Offen:** Bestätigen, dass 49,99 € tatsächlich verlangt wird oder wurde. Sonst ist der Streichpreis angreifbar.

---

## EP-05 · Zahlarten und Verschlüsselung unter den Button

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

## EP-06 · CTA-Farbe auf Markenlila

**Ist:** Haupt-CTA staubrot, Header-CTA lila. Rot ist gleichzeitig die Fehlerfarbe im Modal.

**Neu:** Haupt-CTA lila, identisch zum Header. Rot nur noch für Fehler.

---

## EP-07 · FAQ ausbauen

**Ist:** Fünf sehr kurze FAQs, keine Vertrauensfrage beantwortet.

**Neu:** Folgende Fragen nach oben, in dieser Reihenfolge. Texte 1 bis 4 stehen fertig im Artefakt `claude.ai/code/artifact/15f8a219-e019-48c1-9ca7-f6c815697979` und werden wörtlich übernommen.

```
1. Wieso kostet Chaarlie etwas?
Weil hinter jeder Empfehlung echte Arbeit steckt: geprüfte Produktdaten mit Quellen,
ein Coach der dein Profil kennt, und laufende Weiterentwicklung. Kostenlose Apps
verkaufen dir am Ende meistens Produkte. Chaarlie verkauft dir keine, deshalb bezahlst
du Chaarlie und nicht mit Fehlkäufen.

2. Was, wenn ich keine Ergebnisse sehe?
Wir machen bewusst keine Versprechen. Jede Haarsituation ist individuell, und seriös
lässt sich kein Ergebnis garantieren. Was wir aus unseren Auswertungen sagen können:
Mit einer wirklich passenden Routine steigt die Wahrscheinlichkeit deutlich, dass sich
dein Haar spürbar verbessert. Und weil wir davon überzeugt sind, tragen wir das Risiko:
Wenn dir Chaarlie in den ersten 14 Tagen nicht weiterhilft, schreib uns eine Nachricht
und du bekommst dein Geld zurück.

3. Woher weiß ich, dass das echt ist?
Berechtigte Frage. Deshalb siehst du bei Chaarlie zu jeder Empfehlung den Grund, und
unsere Produktdaten haben nachvollziehbare Quellen. Du musst uns nichts glauben, du
kannst alles nachprüfen. Und mit der Garantie liegt das Risiko bei uns, nicht bei dir.

4. Wie lange, bis ich etwas merke?
Das hängt von deiner aktuellen Haarsituation ab und ist bei jeder Person unterschiedlich.
Viele berichten uns, dass sie nach den ersten zwei Wochen Dinge wie eine ruhigere
Kopfhaut spüren. Nach drei bis fünf Wochen merken viele, dass ihre Haare geschmeidiger
und glänzender werden und das Gesamtbild einfach besser aussieht.

5. Muss ich danach teure Produkte kaufen?
Nein. Wir empfehlen in jeder Preisklasse, von Drogerie bis Salon. Du entscheidest, was
du kaufst. Passende Produkte, die du schon hast, übernehmen wir in deinen Plan.

6. Ist das ein Abo?
Nein. Du zahlst einmalig 29,99 € für deinen Plan. Es gibt keine wiederkehrende Zahlung
und nichts, das du kündigen müsstest.

7. Was passiert mit meinen Daten?
Deine Antworten nutzen wir ausschließlich, um deinen Plan zu erstellen. Keine Weitergabe
an Dritte, keine Werbeprofile. Details in unserer Datenschutzerklärung.
```

Die fünf bestehenden FAQs bleiben, rutschen darunter.
Keine Abo-Fragen auf dieser Seite.

---

## EP-08 · Gründerbrief vor den finalen CTA

**Ist:** Keine Menschen auf der Seite, nur ein Logo.

**Neu**, Text steht fertig im Artefakt, gekürzt übernehmen, mit Foto von Nick und Jonas:
```
Wieso gerade jetzt?
Ein Wort von den Gründern.

Die meisten Menschen finden nie heraus, was ihr Haar wirklich braucht. Sie pflegen
jahrelang daran vorbei. Und Schäden, die sich über Jahre aufbauen, lassen sich
irgendwann kaum noch reparieren.

Dazu kommt das Geld: Studien zeigen, dass 9 von 10 gekauften Beauty-Produkten kaum bis
nie benutzt werden, Shampoos und Conditioner ganz vorne dabei. Und das bei über 300 Euro,
die im Schnitt pro Jahr für Haarprodukte ausgegeben werden. Genau deshalb gibt es
Chaarlie: Du weißt, was bei dir wirkt, bevor du kaufst.

Nick & Jonas, Gründer von Chaarlie
```

**Offen:** Quelle für "9 von 10 Beauty-Produkte" nötig, sonst Satz streichen.

---

## EP-09 · Unabhängigkeit sichtbar machen

**Ist:** Nirgends beantwortet, ob Chaarlie an Produktempfehlungen verdient.

**Neu**, beim Produktempfehlungs-Abschnitt und im Preisblock:
```
Wir verdienen an keiner Produktempfehlung.
Unsere Empfehlungen sind objektiv ausgewählt.
```

---

## EP-10 · Testimonials, nur auf dieser Seite

Betrifft ausschließlich die Offer Page. Quiz-Strecke bleibt unverändert.

**Ist:** Nur Vorname, kein Bild, kein Kontext, Überschrift "STIMMEN AUS DER BETA".

**Neu:**
1. Überschrift: `Das sagen Kundinnen über Chaarlie.` Das Wort Beta entfällt komplett.
2. Volle Vornamen.
3. Kontext ergänzen: `Kim, 34, feines welliges Haar, blondiert`
4. Foto, wo Einverständnis vorliegt.
5. Längere Zitatfassungen aus dem Artefakt übernehmen, zum Beispiel Sarah: *"Dass bei den Produkten der Preis und die Anwendung dabeistehen, ein Foto und warum er es empfiehlt. So muss ich nicht erst googeln."*

---

## EP-11 · Proof-Zeile unter die Hero-Headline

**Neu:**
```
Entwickelt mit Friseurmeistern aus Deutschland
```

Keine Sterne, keine Bewertungszahl, kein "4.000 Bewertungen". Haben wir nicht offiziell.

---

## EP-12 · Testimonial-Section direkt unter den Preisblock

**Ist:** Testimonials liegen mehrere Screens unter dem Preis.

**Neu:** Section direkt unter den Preisblock ziehen.

---

## Bewusst nicht jetzt

Diese Punkte sind geprüft und aufgeschoben, nicht vergessen:
- Plan-Vorschau als unscharfes Mockup über dem Preisblock. Eigenes Thema, später.
- Em-Dash-Prüfung der Funnel-Copy.
- Benannte Friseurmeisterin mit Foto und Salon.
- Antworten der Kundin über den Diagnosekarten zurückspiegeln.
- Formulierung "Zugtest, Oberflächentest" entschärfen.
- 30-Tage-Versprechen mit einer Zeitangabe absichern.
- Hero-Visual gegen echte Kundinnenbilder testen.

---

## Offene Fragen

1. Referenzpreis 49,99 €: bestätigen, dass er verlangt wird oder wurde. EP-04.
2. Quelle für "9 von 10 Beauty-Produkte". EP-08.
