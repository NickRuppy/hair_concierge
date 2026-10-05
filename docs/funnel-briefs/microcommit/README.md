# Brief: Micro-Commitment Offer Page (Prototyp + Variablen-Spec)

**Status: Referenz-Material, nicht zum Mergen in den Build.** Dieser Ordner enthält einen klickbaren HTML-Prototyp, den Jonas als Kopiervorlage und Struktur-Input gebaut hat, plus eine Spec-Version, in der jede dynamische Stelle markiert und auf Quiz-/Engine-Daten gemappt ist.

**Einordnung zu #238 (guided-story):** Der Prototyp ist parallel zur guided-story Journey entstanden und verfolgt dieselbe Grundidee (harte Gates, Kapitel-Dramaturgie, erst Wert liefern, dann Pricing). Vieles davon hat guided-story bereits produktionsreif. Dieser Brief ist deshalb als **Delta-Input** gedacht: Elemente und Copy, die guided-story ergänzen oder als A/B-Ideen dienen können. Nick entscheidet, was davon in welche Variante wandert.

## Dateien

| Datei | Zweck |
| --- | --- |
| `chaarlie-offer-microcommit.html` | Kundenversion, komplett self-contained, im Browser öffnen und durchklicken (Reveal-Kette) |
| `chaarlie-offer-microcommit-spec.html` | Entwickler-Version: alle Sektionen offen, dynamische Stellen gelb markiert mit Variablen-Namen, Mapping-Tabelle am Seitenende |
| `produkt-shampoo.webp`, `produkt-conditioner.webp` | Lokale Produktbilder für den Prototyp |
| `microcommit-full.png`, `microcommit-spec-full.png` | Full-Page-Screenshots beider Versionen |

## Konzept in einem Satz

Die Auswertung wird als Brief in 3 Teilen erzählt, jeder Abschnitt wird erst nach einem aktiven "Ja"-Klick freigelegt (Micro-Commitments), und die eine Kern-Message ist: Wissen und Produkte hast du jetzt, die Umsetzung über Wochen ist das eigentliche Problem, und genau dafür gibt es Chaarlie.

## Elemente, die guided-story vermutlich noch nicht hat (das eigentliche Delta)

1. **Brief-Intro mit Anrede** (`first_name`), skimmbar formatiert, inkl. Zeile "3-Seiten-Auswertung kommt als PDF per E-Mail".
2. **Radar-Chart (5 Achsen) mit Score-Chips**: Rot = heute, Grün = möglich in 4 Wochen. Die Lücke zwischen den Flächen erzählt den Schmerz ohne Text. Achsen: Kopfhaut, Struktur, Feuchtigkeit, Oberfläche, Längen.
3. **Gabel-Visual "Zwei Wege"**: SVG-Weggabelung, darunter Weg 1 (auf eigene Faust, rote Kreuze) und Weg 2 (mit Chaarlie, grüne Haken) Zeile für Zeile gegenübergestellt.
4. **Ehrlichkeits-Framing bei den Gratis-Produkten**: "Diese Produkte basieren auf einer ehrlichen Bewertung... (Wir verdienen daran nichts.)"
5. **Testimonials mit echten Vornamen** (Kim, Kerstin, Sarah) unter der Überschrift "Kundinnen, die in deiner Situation waren, sagen:".
6. **VIP-Anker-Paket** (999 Euro einmalig, Friseurmeister 1:1) über dem Premium-Paket, macht 31,99 Euro/Quartal günstig.
7. **Gründer-Brief als Abschluss** (Nick & Jonas, "wieso gerade jetzt"), öffnet zusammen mit den Paketen.
8. **FAQ-Ergänzungen**: "Kann ich jederzeit beenden?" (zwei Klicks, keine Mindestlaufzeit) und die Nicht-Versprechen-Antwort bei "Was, wenn ich keine Ergebnisse sehe?" (Wahrscheinlichkeit statt Garantie, Risiko liegt via 14-Tage-Garantie bei uns).

## Variablen-Mapping (Kurzfassung, Details in der Spec-HTML)

| Variable | Beispiel | Quelle |
| --- | --- | --- |
| `first_name` | Lea | Lead-Datensatz (2x: Intro-Brief + Gründer-Brief) |
| `score_today` / `score_possible` | 45/100, 60+ | NEU: Gesamt-Score aus Diagnose, Zielwert bewusst als "X+" ohne Versprechen |
| `radar_today[5]` / `radar_possible[5]` | [55,35,40,45,40] | NEU: Kopfhaut ← scalp_type+condition, Struktur ← Zugtest, Feuchtigkeit ← care-balance, Oberfläche ← Oberflächentest, Längen ← damage. Grün muss auf jeder Achse über Rot liegen |
| `key_finding_text` | Zugtest-Absatz | Stärkster reasonCode als 2-3 deutsche Sätze (Mapping-Tabelle, ca. 6-8 Varianten) |
| `concern_1..3` | Trockenheit, Frizz, nachgebende Längen | Quiz-Concerns (guided-story hat die concern-Priorisierung schon) |
| `product_1` / `product_2` | Balea Ultra Sensitive / Aqua Hyaluron | Engine-Empfehlung Shampoo+Conditioner (in guided-story als shampoo/conditionerModule vorhanden), Felder: image, name, short_name, category, price, reason. Taucht 3x auf: Produktkarten, Tagebuch-Mockup, Produkte-Mockup |
| `checkout_url` | alert-Platzhalter | Stripe-Checkout mit lead_id. Seite zeigt 31,99 nach 20% auf 39,99, bitte gegen echten Stripe-Preis abgleichen |

## Abgleichen vor Nutzung

- Garantie steht überall auf **14 Tagen** (konsistent mit guided-story "14 Tage Geld zurück").
- Claims "über 4.000 Haar-Auswertungen" und "über 1.000 analysierte Produkte" gegen echte Zahlen verifizieren.
- Das 3-Seiten-PDF aus dem Intro wird separat gebaut (Artefakt-Mail), nicht Teil dieser Seite.
- Bekannter Bug bei Reveal-Mechaniken: keine `loading="lazy"` Bilder in initial versteckten Sektionen (laden nach dem Aufklappen nie).
