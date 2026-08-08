# Brief: Minimal Offer Pages (Plan-Verkauf, 3 Varianten + Spec)

**Status: Referenz-Material, nicht zum Mergen in den Build.** Radikales Reframing der Offer Page auf EIN Promise: *"Wir finden deine Haarroutine und deine passenden Produkte. Dein Plan zu schöneren Haaren in 30 Tagen."* Kein Value-first mehr, die Seite verkauft nur noch. Alle Dateien sind self-contained HTML, einfach im Browser öffnen (Bilder liegen daneben).

## Die 3 Varianten (gleiche Struktur, 3 Unterschiede)

| Datei | Zweck | Unterschiede |
| --- | --- | --- |
| `chaarlie-offer-hybrid.html` | **Haupt-Variante für kalten Meta-Traffic** | Timer-Bar (15-Min-Reservierung), Heute/Ziel mit KI-Fotos (Symbolbild-Note), 3 Abo-Laufzeiten (14,99 Monat / 39,99→31,99 Quartal / 99,99→79,99 Jahr, Tagespreise) |
| `chaarlie-offer-einmal.html` | **Ads-Preistest Einmalzahlung** | Kein Timer, EIN Preis: 30-Tage-Plan 29,99 € einmalig, keine automatische Verlängerung, Zugang endet nach 30 Tagen von selbst, FAQ "Ist das ein Abo? Nein" |
| `chaarlie-offer-hybrid-tom.html` | **Tom-Route** (Traffic über seine Kanäle) | Kein Timer, keine KI-Fotos (nur Balken-Vergleich), Methode-Box geschärft ("echte Haar-Tests", "wir verdienen nichts an den Produkten") |

Struktur überall: App-Mockup-Hero ("Wir haben deinen perfekten Haarplan gefunden!", echter App-Screen, Produkte geblurrt als Neugier-Gate) → Heute/Ziel-Vergleich → Highlights → Haar-Tests-Box → Vorher/Nachher → Pricing → Umfrage-Stats → 14-Tage-Garantie → Beta-Testimonials (Kim/Kerstin/Sarah) → FAQ (inkl. echtem Beta-Einwand "Produkte aufbrauchen") → Final-CTA.

## Copy = wörtlich aus der Community-Umfrage (4.024 Antworten)

Die gesamte Copy ist gegen die TBC-Umfrage abgeglichen (GHL-Export, Mehrfachauswahl):

- **82%** "Endlich verstehen, was meine Haare wirklich brauchen" → Highlight #1
- **73%** "Eine klare Routine ohne Produktchaos" → Highlight #2
- **64%** "Ehrliche Produktempfehlungen" / **63%** "Ich weiß nie, welche Produkte wirklich zu mir passen" → Highlight #3 + Stats-Ring
- **50%** "trocken, strohig oder glanzlos" / **44%** Kopfhaut / **43%** Spliss & Haarbruch / **40%** "Selbstbewusster mit meinen Haaren"

Die Stats-Ringe (82/73/63%) laufen auf diesen eigenen Zahlen, Fußnote "eigene Umfrage, 4.024 Antworten". Die ersten 3 Vorher/Nachher-Karten sind **wörtliche Umfrage-Optionen als Zitate** (kursiv, Anführungszeichen), bitte nicht umformulieren, die Wiedererkennung ist der Punkt. Freitext-Warnung: Haarausfall ist Platz 2 der frei genannten Probleme und bewusst NICHT in der Copy (kosmetisch nicht adressierbar).

## Variablen / dynamische Stellen

`chaarlie-offer-minimal-spec.html` öffnen: alle dynamischen Stellen sind gelb markiert mit Variablen-Namen, unten die komplette Mapping-Tabelle (plan_label, attr_rows aus den Quiz-Concerns, goal_label, checkout_url pro Variante, optional first_name). NEU-Badges markieren, was noch gebaut werden muss.

## Vor Launch abgleichen

- **Stripe:** Abo-Preise 14,99 / 31,99 / 79,99 verifizieren; für die Einmal-Variante braucht es ein Einmal-Produkt (29,99 €) plus App-Logik: Zugang läuft nach 30 Tagen aus, Upgrade-Moment in der App.
- **Garantie:** überall 14 Tage (konsistent mit AGB/guided-story).
- **Heute/Ziel-Fotos** (hybrid/einmal): KI-Symbolbilder mit "Symbolbild"-Note; sobald echte Kundinnen-Fotos mit Freigabe existieren, ersetzen. Tom-Route hat bewusst keine.
- Checkout-Buttons sind Platzhalter (alert).

Gehostete Vorschau-Links (privat, bei Jonas): Hybrid, Einmal, Tom-Route und Spec als Claude-Artifacts. Bezug zu #238/guided-story: gleiche Gate-Philosophie, dieses Set ist die zugespitzte Nur-Verkaufen-Variante für den Preis- und Routen-Test.
