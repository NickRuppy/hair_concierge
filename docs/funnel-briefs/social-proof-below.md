# Funnel-Brief: social_proof_below (/lp/routine-b)

## Hypothese

Kalter Meta-Traffic konvertiert auf der aktuellen Offer Page nicht, weil unterhalb der
Auswertung drei Dinge fehlen: Social Proof, ein greifbares Bild der App und eine explizite
Liste dessen, was man freischaltet. Diese Variante testet genau diese drei Ergänzungen und
lässt den oberen Teil der Seite (Hero, Pflegebasis-Auswertung, Produkt-Matching,
Schloss-Karte) bewusst identisch zur Produktion, damit der Test eine einzige Variable misst.

## Was gleich bleibt (1:1 Produktion)

- Sticky-Bar, Hero, Auswertungs-Intro
- `OfferPreviewRoutine` (Shampoo/Conditioner-Matching + gesperrte Bausteine)
- Schloss-Karte "Chaarlie finalisiert deinen persönlichen Plan"
- Pricing-Slot (geteilter Checkout, unangetastet), Garantie, FAQ

## Was neu ist (unterhalb der Schloss-Karte)

1. **"Triff Chaarlie" mit echten App-Screenshots** statt der Text-Story: Routine-Seite,
   Produktempfehlung mit Preis/Begründung, Berater-Chat. Ersetzt `OfferProductStory` und
   `OfferTimeline`.
2. **Beta-Testimonials mit 5-Sterne-Bewertung** (drei echte Zitate aus der Beta) plus
   Vertrauens-Zahlen (4.000+ Haar-Checks, Sat.1, 19 Jahre Friseur-Erfahrung im Beirat).
3. **"Das schaltest du frei"-Liste direkt über dem Preisblock**: vollständige Routine,
   Haar-Berater jederzeit, Produkt-Tausch inklusive, Nachmessung in Woche 4.
4. Schluss-CTA mit direkterer Copy ("Deine Routine ist fertig. Hol sie dir.").

## Herkunft

Konzept und Copy stammen aus der Offer-Page-Recherche vom 13.07. (Benchmark: Funnel
konvertiert ~15-25% der Offer-Page-Besucher; Haupttreiber bei kaltem Traffic: Social Proof
am Kaufpunkt, sichtbares Produkt, benannter Leistungsumfang). Testimonials sind wörtliche
Beta-Zitate, gekürzt; Vertrauens-Zahlen bitte vor Livegang final verifizieren (4.000+).

## Messung

Vergleich über `funnel_package_key` (`social_proof_below` vs `default_organic` bzw. das
aktive Meta-Paket) in Supabase-Attribution und Meta, Meilenstein Kauf. Kein Preis- oder
Checkout-Unterschied zwischen den Varianten.

## Copy-Verfeinerungen in dieser Variante (unterhalb der Schloss-Karte)

- Preis-Headline verkauft das Deliverable statt der Marke: "Schalte deine vollständige
  Routine frei." (gleiche Sprache wie die Schloss-Karten-CTA, ein durchgängiger Handlungsfaden).
- Kostenanker über dem Preisblock: "Ein einziger Fehlkauf im Drogerieregal kostet oft mehr
  als ein Monat Chaarlie." Ehrlicher "Warum jetzt"-Hebel ohne künstliche Dringlichkeit.
- CTA-Sprache vereinheitlicht: Sticky-Bar und Schluss-CTA sagen jetzt ebenfalls
  "Routine freischalten" statt "Chaarlie starten".

## Vorschläge für die Produktionsseite (Owner-Zone, bewusst NICHT in dieser Variante)

Beim Audit der Gesamtseite aufgefallen, betrifft den gemeinsamen oberen Teil bzw. geteilte
Komponenten. Zur Diskussion, kein Blocker für diesen PR:

1. **Preise auf die Beispiel-Produktkarten** (`OfferPreviewRoutine`): Der Drogerie-Preis
   (z.B. 2,95 Euro) beweist Umsetzbarkeit. Ein Beta-Testimonial lobt wörtlich, "dass der
   Preis dabeisteht"; auf der Offer Page fehlt er aktuell.
2. **Hero-H1 auf Outcome statt Prozess**: "Deine Analyse ist der Anfang. Chaarlie macht sie
   anwendbar." beschreibt den Prozess. Outcome-Alternative testen, z.B. "Dein Haar kann sich
   in 4 Wochen anders anfühlen. Hier ist dein Weg dahin."
3. **Disclaimer positiv framen**: "Das sind noch nicht deine finalen Produktempfehlungen"
   entwertet das Gratis-Ergebnis. Gleiche Aussage, positiver: "Diese Basis passt zu deinem
   Profil. Nach dem Start gleicht Chaarlie sie mit deinen vorhandenen Produkten ab."
4. **"Mini-Routine" umbenennen** (macht das Gratis-Ergebnis klein, "Pflegebasis" reicht).
5. Typografie: Gedankenstriche im Hero-Text und im Preisbutton ("Jetzt starten — ...")
   durch Punkt oder Komma ersetzen (Markenregel: keine Gedankenstriche).

## Hinweise fürs Review

- Screenshots (Desktop + Mobile) hängen am PR.
- Bilder liegen unter `public/images/funnels/social-proof-below/` (auf 800px verkleinert).
- Bild- und Copy-Iterationen folgen ggf. im selben Branch nach erstem Review von Jonas.
