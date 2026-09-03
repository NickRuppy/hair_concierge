# Oil-Pilot Research Notes (Batch 1, T2)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-02 vom Research-Agenten. Alle Authority-Felder sind Urteile aus
> INCI + Claims + Textur-Hinweisen; Konfidenz pro Feld unten ehrlich markiert
> (solide / abgeleitet / geraten). Manifest: `oil-manifest.json` (Validator: PASS 4/4
> nach Anwendung der Pilot-Review-Rulings, s. u.).
>
> **UPDATE 2026-09-02 — Nicks Pilot-Review-Rulings angewandt** (Autorität:
> `plans/scan-db-expansion/protocol-templates.md` §"Nick's pilot-review rulings"):
> **R-A:** Wahre Schätze Haarserum Honig (Produkt 1) wurde als `leave_in`
> re-kategorisiert und aus diesem Manifest **entfernt** → jetzt in
> `leave-in-manifest.json` (Evidenz übernommen; das dreifache Serum-Emulsions-
> Identitäts-Flag ist damit aufgelöst).

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

---

## 1. Wahre Schätze — Haarserum Honig reparierend (115 ml, EAN 3600542567329) — **ENTFERNT (R-A, 2026-09-02)**

> **RULING ANGEWANDT (R-A, 2026-09-02):** Aus `oil-manifest.json` entfernt und als
> `leave_in` in `leave-in-manifest.json` neu geführt. Grund: Shelf-Kategorie ist per
> R-A nur eine erste Vermutung; die Research (wasserbasierte Serum-Emulsion mit
> INCI-Positionen 1–2 Propylene Glycol/Aqua, Emulgatoren, Verdicker-Polymer —
> formatgleich mit den Elvital-Leave-in-Seren) finalisiert die Kategorie. Die drei
> Identitäts-Deviation-Flags und die beiden offenen Fragen unten sind damit
> entschieden; INCI, EAN, Preis, 230-°C-Claim und Quellen wurden in den
> Leave-in-Eintrag übernommen (format=serum, provides_heat_protection=true,
> heat_protection_max_c=230, Stamps DAMP + DRYCARE per R-D + HEAT either-state).
> Der historische Research-Abschnitt bleibt unten als Beleg stehen.

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

- **Validator (nach Rulings 2026-09-02):** `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/oil-manifest.json`
  → PASS, 4/4 Produkte, 0 deviation-flagged, 1 excluded EAN (Monday), 0 Duplikate.
  (Vor den Rulings: 5/5 mit 1 deviation-flagged — Wahre Schätze ist jetzt im Leave-in-Manifest.)
- **EAN-Stand:** alle 5 recherchierten EANs stammen aus `selection-batch1-draft.json` und wurden unabhängig
  gegen die Live-Retailer-Seiten geprüft (dm: GTIN-Feld + JSON-LD; Rossmann: Syndigo-Tag live
  reproduziert). 3/5 dm-mehrfachbelegt, Isana mit eingeschränktem Zweitbeleg (s. Abschnitt 4),
  Monday einquellig → excluded. Nach der R-A-Verschiebung von Wahre Schätze trägt dieses
  Manifest noch 4 davon.
- **Subtyp-Konvention (Frage an Nick):** Alle 5 recherchierten Produkte (nach R-A noch 4 im Manifest) tragen `styling-oel`. Das ist kein
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
- **Heat-Familien (P9):** Beide Heat-Stamps (Wahre Schätze — seit R-A im Leave-in-Manifest —
  und Elvital) sind explizit „feucht ODER trocken" gesourct → `usable_on_dry_hair: true` /
  either_state. Kein Produkt brauchte die Damp-only-Lesart. Einziger verbleibender
  Oil-Heat-Stamp in diesem Manifest: Elvital Öl Magique.
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

## Image re-sourcing 2026-09-02

Qualitätsbar geprüft (Packshot der Verpackung allein, kürzere Achse ≥ 800 px ideal / ≥ 600 px
Minimum, Hersteller- oder Retailer-Quelle mit Seiten-URL). Jedes Kandidatenbild wurde
heruntergeladen und mit `sips -g pixelWidth -g pixelHeight` vermessen sowie visuell geprüft
(Read-Tool auf das gespeicherte Bild).

- **Gliss Haaröl Tägliches Öl-Elixier:** zu niedrig aufgelöst (373×1200 px bei
  `h_1200,w_1200`). dm-static liefert dieselbe Cloudinary-Quelle in höherer Auflösung, wenn man
  den `h_*,w_*`-Transform-Parameter erhöht. Neu: `h_3000,w_3000` → **932×3000 px** (dm.de),
  scharf, Bildinhalt unverändert.
- **Elvital Haaröl Öl Magique:** zu niedrig aufgelöst (421×1200 px). Gleicher Trick,
  `h_3000,w_3000` → **1052×3000 px** (dm.de), scharf, Bildinhalt unverändert.
- **Monday Haircare Repair Argan Haaröl:** falscher Bildinhalt (bisheriges Bild
  `MAM_57218955` ist eine Claims-/Infografik-Kachel, kein Packshot). In der Rossmann-Galerie
  desselben Produkts ist `MAM_57218952` das erste Thumbnail und zeigt die Sprühflasche frontal
  ohne Overlay. Neu: `MAM_57218952` bei `width=2000&height=2000` → **2000×2000 px**, gleiche
  Rossmann-Produktseite als Quelle.

Alle drei jetzt über der Qualitätsbar (Retail-Packshot, keine Infografik-/Claims-Kacheln,
kürzere Achse ≥ 800 px, Quelle dokumentiert).

## Evidence quote backfill 2026-09-02

Alle 19 Evidence-Zeilen tragen jetzt ein wörtliches `source_text`-Zitat, live von der
jeweiligen `source_url` transkribiert (dm.de/Rossmann: GTIN-Feld bzw. JSON-LD-`sku`,
INCI-Kopf, Verwendungshinweise, Preisangabe; Herstellerseiten: Claim-Passagen).
`[…]` markiert Auslassungen zwischen wörtlichen, auf derselben Seite stehenden Passagen.
Hinweis: Die Rossmann-Anwendung zum Monday Repair Argan Haaröl enthält den Seitentippfehler
"zwischen den Hängen" — wörtlich so übernommen (sic), nicht korrigiert.
