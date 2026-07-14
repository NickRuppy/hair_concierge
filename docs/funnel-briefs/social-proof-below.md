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

## Hinweise fürs Review

- Screenshots (Desktop + Mobile) hängen am PR.
- Bilder liegen unter `public/images/funnels/social-proof-below/` (auf 800px verkleinert).
- Bild- und Copy-Iterationen folgen ggf. im selben Branch nach erstem Review von Jonas.
