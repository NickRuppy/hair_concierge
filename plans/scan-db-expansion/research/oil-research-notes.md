# Oil-Pilot Research Notes (Batch 1, T2)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-02 vom Research-Agenten. Alle Authority-Felder sind Urteile aus
> INCI + Claims + Textur-Hinweisen; Konfidenz pro Feld unten ehrlich markiert
> (solide / abgeleitet / geraten). Manifest: `oil-manifest.json` (Validator: PASS 5/5).

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

---

## 1. Wahre Schätze — Haarserum Honig reparierend (115 ml, EAN 3600542567329, **3× deviation-flagged**)

**Quellen:** dm.de Produktseite 1324799 (GTIN-Feld + JSON-LD, 6,95 €, Verwendungshinweise, INCI),
garnier.de Produktseite (Manufacturer: deckungsgleiche Anwendung, 230 °C, identische INCI-Spitze).

**⚠️ PROMINENTES FLAG — kein Öl, sondern Serum-Emulsion.** Die INCI beginnt mit
**Propylene Glycol • Aqua** (Positionen 1–2), enthält Emulgatoren (Trideceth-5/-10) und ein
Verdicker-Polymer (Polyacrylate Crosspolymer-6). Das ist eine wasserbasierte Silikon-Serum-Emulsion,
kein anhydrisches Öl — formell dasselbe Format wie die Elvital-„Leave-In Haarserum"-Produkte,
die dieser Pilot selbst als `leave_in` führt (dm zeigt es in „Ähnliche Produkte" neben genau diesen).
dm kategorisiert es allerdings unter **Haaröl**, und der Pilot pinnt es als `oil`.
**Vorgehen (Night-Elixier-Präzedenz):** Specs ehrlich ausgefüllt, alle 3 Protocol-Stamps tragen
das Identitäts-Flag als Deviation, Entscheidung für Nick: als `oil` behalten oder zu `leave_in`
re-kategorisieren? Die Anwendung selbst ist mit allen 3 Oil-Templates konform — nur die
Produktidentität ist strittig.

**Konfidenz:** EAN solide (dm-GTIN-Feld + JSON-LD = Draft). Anwendung solide (wörtlicher dm-Text,
von Garnier bestätigt). role_support solide (feucht ODER trocken explizit; 230 °C-Hitzeschutz explizit).
usable_on_dry_hair=true solide („auf feuchtem oder trockenem Haar" → either_state per P9).
weight light abgeleitet. oil_subtype styling-oel **geraten** (kein Subtyp passt auf eine Emulsion).
oil_purpose styling_finish abgeleitet. thickness alle abgeleitet (leichtes Pumpserum).
concern split_ends/hair_damage/repair solide (Kernclaims).

**Offene Fragen an Nick:**
- `oil` behalten (mit Serum-Emulsions-Flag) oder Re-Kategorisierung zu `leave_in`?
  Als leave_in hätte es saubere Felder (format=serum, provides_heat_protection=true, max_c=230).
- Falls oil bleibt: ist styling-oel als Subtyp akzeptabel oder braucht die Subtyp-Vokabel
  einen „serum"-Wert?

---

## 2. Schwarzkopf Gliss — Haaröl Tägliches Öl Elixier (75 ml, EAN 4015100813791)

**Quellen:** dm.de Produktseite 1534910 (GTIN + JSON-LD, 5,95 €, Verwendungshinweise, INCI),
schwarzkopf.de Oil-Nutritive-Linienseite (Manufacturer: Zielgruppe, Arganöl+Vitamin E,
„+100% stärkeres Haar", keine fettigen Rückstände; die Anwendungssektion der Herstellerseite
war nicht auslesbar — Claims-Korroboration ja, Anwendungs-Korroboration nur via Drittlistings).

**Konfidenz:** EAN solide (dm-GTIN = Draft). Anwendung solide (wörtlich: „2 ANWENDUNGSMÖGLICHKEITEN",
handtuchtrocken nach der Wäsche / trocken als „Beauty- Finish" [sic, dm-Tippfehler mit Leerzeichen]).
role_support solide (exakt die 2 gestampten Rollen; kein Hitzeschutz-, kein Pre-Wash-Claim).
weight light abgeleitet (flüchtige Alkane Undecane/Tridecane, „keine fettigen Rückstände").
subtype styling-oel abgeleitet/konservativ. purpose light_finish abgeleitet.
thickness alle abgeleitet. concern hair_damage/repair solide begründet.

**Keine Deviation:** Platzierung „mittlere Längen & Spitzen" + sparsame Dosierung sind konform;
Pumpformat (1-2 Pumpstöße) ist laut Ruling mit der „wenige Tropfen"-Copy konsistent.

**Nebenbefund:** Ältere „Gliss Kur"-Ära-Listings desselben Produkts existieren
(shop-apotheke, medpex, Müller) — mögliche Alt-EAN nicht geprüft; nur relevant, falls
existing_product/Variants-Logik das Produkt später breiter fassen soll.

---

## 3. L'Oréal Paris Elvital — Haaröl Öl Magique, für alle Haartypen (100 ml, EAN 3600523734955)

**Quellen:** dm.de Produktseite 1621820 (GTIN + JSON-LD, 6,95 €, Verwendungshinweise, INCI),
loreal-paris.de Produktseite „Veredelndes Haaröl 100 ml" (Manufacturer: 230 °C, alle Haartypen,
Anti-Frizz, Anwendungsvarianten).

**Konfidenz:** EAN solide (dm-GTIN = Draft). Anwendung solide (wörtlicher dm-Text).
role_support solide (trocken UND nass explizit; „glanzvolles Styling-Finish" wörtlich;
230 °C-Hitzeschutz + „vor dem Föhnen" explizit). usable_on_dry_hair=true solide
(„auf trockenem und nassem Haar" → either_state per P9). weight light abgeleitet
(Isododecane Position 1, „leichtes Haargefühl"). subtype styling-oel abgeleitet/konservativ.
purpose styling_finish solide (wörtlich auf der Packung). thickness alle solide
(„für alle Haartypen"). concern frizz/dryness solide (wörtliche Claims).

**Keine Deviation.** Anmerkungen:
- „Während dem Duschen" ist eine zusätzliche Nass-Anwendungsgelegenheit, kein Rinse-out und
  kein Template-Widerspruch.
- Die **Herstellerseite** listet unter 10 Anwendungsideen auch eine **Over-Night-Kur** — das
  stünde im Konflikt mit P8, ist aber NICHT auf der dm-Packungsanweisung und wurde bewusst
  nicht encodiert (nur hier dokumentiert). Kein Pre-Wash-Stamp.
- Glanz ist Kernclaim, hat aber weiterhin keinen sauberen Concern-Code (bekanntes Thema aus
  dem Mask-Batch, `performance`-Semantik unklar).

---

## 4. Isana Professional — Haaröl Arganöl & Pflege (100 ml, EAN 4068134024947, 2,79 €)

**Quellen:** rossmann.de Produktseite (Anwendung und Gebrauch, INCI, Preis/Grundpreis,
Packshot MAM_57247767), Syndigo-Tag `SYNDI.push('4068134024947')` von mir live reproduziert.
Kein Hersteller-Webauftritt (Rossmann-Eigenmarke; Kontakt läuft über Mann & Schröder —
die Rossmann-Seite ist hier de facto die Herstellerquelle).

**EAN-Zweitbeleg (mit Einschränkung):** INCI Beauty führt ein Listing exakt unter dieser EAN
(„Isana Haaröl Arganöl & Pflege - 100 ml", incibeauty.com/en/produit/4068134024947); zusätzlich
binden Allegro-Listings dieselbe EAN an dasselbe Produkt. **Einschränkung ehrlich:** die
INCI-Beauty-Seite selbst konnte ich nicht öffnen (Navigation verweigert/403) — die Bindung ist
über den indexierten Listing-Titel + die EAN-URL verifiziert, nicht über den Seiteninhalt.
cross_source_agreement=true gesetzt (Herbal-Essences-Präzedenz), aber Nick kann das auf
false drehen, wenn ihm die Beleg-Tiefe nicht reicht. GS1-Präfix 40681xx (DE) passt zur
Mann-&-Schröder-Fertigung — Plausibilität, kein Beleg.

**Konfidenz:** EAN solide-mit-Einschränkung (s.o.). Anwendung solide (wörtlicher Rossmann-Text).
role_support solide — die Packung nennt exakt drei Anwendungen: **vor der Haarwäsche**
(pre_wash_fibre_treatment), **im feuchten Haar** (leave_on_fibre_conditioning), **im trockenen
Haar als Styling Finish** (dry_finish). Einziges Pilot-Öl mit Pre-Wash-Rolle.
weight medium **abgeleitet/konservativ** (gemischte Evidenz: volatile-dominante INCI spräche für
light, aber die Packung warnt selbst „Bei dünnen Haaren bitte sparsam verwenden" und claimt
„reichhaltige Oil Intensiv-Pflegeformel" — Mitte gewählt). subtype styling-oel **geraten**.
purpose **null (bewusst)** — drei gleichwertige Anwendungen, ein Einzelwert wäre unbelegte
Präzision. thickness alle abgeleitet (fein explizit erlaubt mit Sparsamkeits-Hinweis).
concern dryness/hair_damage solide („extrem strapaziertes & trockenes Haar").

**Keine Deviation:** Pre-Wash ohne Zeitangabe → P8-Regel (15–20 Min) greift, Schweigen ist
keine Abweichung. Keine Kopfhaut-, keine Overnight-Anweisung. Platzierung konform.

**Nebenbefund:** Rossmann-Suche kennt eine zweite URL für das gleichnamige Produkt unter
/p/0000042508113 (Rossmann-Artikelnummer, keine GTIN) — bereits im Draft notiert, nicht verwendet.

---

## 5. Monday Haircare — Repair Argan Haaröl (89 ml, EAN 4895248009825, **excluded_from_apply**)

**Quellen:** rossmann.de Produktseite (Anwendung, INCI, 5,99 €, Packshot MAM_57218955,
Syndigo-Tag von mir live reproduziert), mondayhaircare.com + us.mondayhaircare.com
(Manufacturer: identische INCI-Spitze, Claims; **keine** Anwendungsanleitung auf beiden Seiten).

**Konfidenz:** EAN **nur einquellig** — Rossmann-URL + Syndigo-Tag. Kein unabhängiger
Zweitbeleg auffindbar: Ulta/Boots/Amazon/Target führen die US-Variante unter UPC 840191616426
bzw. zeigen keine EAN. GS1-Präfix 4895248 = derselbe Inhaber wie die Being-by-ZURU-EANs im
Draft (Monday ist eine ZURU-Marke; Rossmann nennt Zuru Germany GmbH als Kontakt) —
Plausibilität, kein Beleg. **Daher cross_source_agreement=false + excluded_from_apply=true**
(IDA-WARG-Präzedenz) bis Zweitquelle oder physischer Scan vorliegt.

**role_support bewusst schmal: nur dry_finish.** Weder Rossmann noch die Herstellerseiten
nennen einen Haarzustand (feucht/trocken) für die Anwendung — der Text sagt nur „auftragen …
Nicht ausspülen". Die Finish-/Glanz-Positionierung („glass-like shine", „Anti-frizz,
lightweight finish") trägt dry_finish; leave_on_fibre_conditioning wurde OHNE Beleg nicht
gestampt (Template-Regel: Rolle braucht einen Beleg; Schweigen ist keiner).
weight light solide begründet („lightweight", „leicht und dennoch hochwirksam", Ester-/Silikon-Basis).
subtype styling-oel abgeleitet. purpose light_finish abgeleitet (wörtlich „lightweight finish").
thickness alle abgeleitet („all hair types, including fine" laut Herstellerbeschreibung).
concern frizz/split_ends/dryness/hair_damage solide (wörtliche Claims).

**Keine Deviation:** Platzierung „mittlere Länge und Spitzen", Kamm-Verteilung, „Nicht
ausspülen" — alles konform. („zwischen den Hängen" ist ein Rossmann-Tippfehler für „Händen",
im Manifest wörtlich zitiert.)

**Offene Fragen an Nick:**
- EAN-Freigabe: physischer Scan im Markt oder zweite Retailer-Quelle, um excluded_from_apply
  aufzuheben?
- Soll leave_on_fibre_conditioning trotz fehlender Quellen-Aussage gestampt werden
  (typische Argan-Öl-Nutzung), oder bleibt die schmale dry_finish-Lesart?

---

## Querschnitts-Notizen

- **Validator:** `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/oil-manifest.json`
  → PASS, 5/5 Produkte, 1 deviation-flagged (Wahre Schätze, alle 3 Stamps = Identitäts-Flag),
  1 excluded EAN (Monday), 0 Duplikate.
- **EAN-Stand:** alle 5 EANs stammen aus `selection-batch1-draft.json` und wurden unabhängig
  gegen die Live-Retailer-Seiten geprüft (dm: GTIN-Feld + JSON-LD; Rossmann: Syndigo-Tag live
  reproduziert). 3/5 dm-mehrfachbelegt, Isana mit eingeschränktem Zweitbeleg (s. Abschnitt 4),
  Monday einquellig → excluded.
- **Subtyp-Konvention (Frage an Nick):** Alle 5 Produkte tragen `styling-oel`. Das ist kein
  Zufall, sondern ehrliche Chemie: **keines** der 5 Pilot-„Öle" ist ein reines Pflanzenöl
  (`natuerliches-oel`) und keines ist als Trockenöl-Spray vermarktet (`trocken-oel`) — alle sind
  silikon-/volatile-basierte Finishing-Formeln (eines sogar eine Wasser-Emulsion). Angewandte
  Konvention: Trockenöl-Vermarktung → trocken-oel; pflanzenöl-dominante INCI → natuerliches-oel;
  silikon-/volatile-geführte Finishing-Öle → styling-oel. Die bestehende Katalog-Konvention
  konnte in dieser Session NICHT gegengeprüft werden (Supabase MCP nicht authentifiziert) —
  bitte vor Apply gegen die 45 bestehenden `product_oil_eligibility`-Zeilen prüfen.
- **oil_purpose:** Semantik der drei Werte ist nirgends dokumentiert; Zuordnungen sind als
  abgeleitet/geraten markiert (Elvital ist der einzige wörtliche Treffer: „Styling-Finish").
  Isana bewusst null (Multi-Use). Gleiches Caveat wie beim Subtyp: vor Apply gegen die
  Live-Konvention prüfen.
- **Heat-Familien (P9):** Beide Heat-Stamps (Wahre Schätze, Elvital) sind explizit
  „feucht ODER trocken" gesourct → `usable_on_dry_hair: true` / either_state. Kein Produkt
  brauchte die Damp-only-Lesart.
- **Pre-Wash:** Nur Isana. Keine Zeitangabe auf der Packung → P8-Kanon 15–20 Min greift ohne
  Deviation. Kein Kokosöl-dominantes Produkt im Batch (Protein-Sensitivitäts-Caveat aus dem
  Template nicht einschlägig).
- **Nicht sourcebar / offen geblieben:**
  - `oil_subtype` und `oil_purpose` haben die dünnste Evidenzbasis aller Oil-Felder
    (Vokabular-Semantik undokumentiert, DB-Konvention nicht einsehbar).
  - Monday: Haarzustand der Anwendung nirgends angegeben (s. Abschnitt 5).
  - Isana weight: gemischte Evidenz, medium als konservative Mitte.
- **Evidenz-Hygiene:** Alle Anwendungstexte sind wörtliche Zitate der Retailer-Produktseiten
  (dm „Verwendungshinweise", Rossmann „Anwendung und Gebrauch"); Manufacturer-Seiten als
  Korroboration, wo vorhanden (Garnier, Schwarzkopf, L'Oréal, Monday). Keine Influencer-/
  Forenquellen für Fakten verwendet (dm-Reviews nur als Textur-Kontext gelesen, nicht encodiert).
- **Bildkandidaten:** dm: JSON-LD-Produktbild (1200er-Variante). Rossmann: erstes
  Galerie-Bild mit Produkt-Alt-Text; ACHTUNG Isana: das auf der Seite mehrfach eingebundene
  MAM_4038827 ist ein **Siegel-Badge**, nicht der Packshot — verwendet wurde MAM_57247767.
