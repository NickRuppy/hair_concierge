# Mask-Pilot Research Notes (Batch 1, T2)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-02 vom Research-Agenten. Alle Authority-Felder sind Urteile aus
> INCI + Claims + Textur-Hinweisen; Konfidenz pro Feld unten ehrlich markiert
> (solide / abgeleitet / geraten). Manifest: `mask-manifest.json` (Validator: PASS 5/5
> nach Anwendung der Pilot-Review-Rulings, s. u.).
>
> **UPDATE 2026-09-02 — Nicks Pilot-Review-Rulings angewandt** (Autorität:
> `plans/scan-db-expansion/protocol-templates.md` §"Nick's pilot-review rulings"):
>
> - **R-A:** Night Elixier (Produkt 1) wurde als `leave_in` re-kategorisiert und aus
>   diesem Manifest **entfernt** → jetzt in `leave-in-manifest.json` (Evidenz übernommen).
> - **R-C:** Die Verpackungs-Deviations von Glycolic Gloss Kur (Ansatz-bis-Spitzen) und
>   IDA WARG (Spülung-danach) wurden auf `null` gesetzt — Verpackung überschreibt
>   Chaarlies Guidance nie; Details in den Produktabschnitten.

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

---

## 1. Schwarzkopf Gliss — Haarkur Night Elixier Ultimate Repair (100 ml, EAN 4015100813951) — **ENTFERNT (R-A, 2026-09-02)**

> **RULING ANGEWANDT (R-A, 2026-09-02):** Aus `mask-manifest.json` entfernt und als
> `leave_in` in `leave-in-manifest.json` neu geführt. Grund: Shelf-Kategorie ist per
> R-A nur eine erste Vermutung; die Research (Overnight-Leave-on, "Nicht ausspülen",
> nass ODER trocken, dm-Kategorie Leave-In) finalisiert die Kategorie. Die unten
> dokumentierte Deviation-Frage ("mask behalten oder leave_in?") ist damit entschieden;
> INCI, EAN, Preis und Quellen wurden in den Leave-in-Eintrag übernommen. Der
> historische Research-Abschnitt bleibt unten als Beleg stehen.

**Quellen:** dm.de Produktseite 1681632 (GTIN-Feld, Preis 7,45 €, Verwendungshinweise, INCI),
schwarzkopf.de Night-Elixier-Linienseite (Manufacturer, Claims), Henkel-Presseseiten (Kontext Overnight-Launch).

**Konfidenz:** EAN solide (dm-GTIN-Feld = Draft). Anwendung/Deviation solide (wörtlicher dm-Packungstext).
weight light abgeleitet (Claims + INCI). concentration medium **geraten** (konservativ).
balance_direction balanced abgeleitet (Hydrolyzed Pearl vs. Humectants gemischt).
repair_support_level medium abgeleitet. functional_benefits shine abgeleitet (nur Herstellerclaim).
thickness alle **abgeleitet** (leichtes Serum, Pumpdosierung).

**Deviation (GENUINE, groß):** Overnight-Leave-in — "Vor dem Schlafengehen 2-4 Pumpstöße …
Nicht ausspülen", auch ins **trockene** Haar. Dreifacher Widerspruch zur
Rinse-out-Maskenfamilie (Einwirklogik, Rinse, Haarzustand). dm führt das Produkt selbst
unter **Leave-In**. Template sagt: "Overnight masks — wrong family entirely; flag as out of scope."
contact_time: seconds=null, Quelle dokumentiert "über Nacht, keine Minutenangabe".

**Offene Fragen an Nick:**
- Bleibt das Produkt als `mask` im Pilot oder Re-Kategorisierung zu `leave_in`?
  Als TPL-MASK-Stamp ist es m.E. nicht publizierbar; der Manifest-Eintrag trägt die Deviation als Beleg.
- Falls mask bleibt: eine Overnight-Familie existiert nicht — Produkt aus T4/T5 ausklammern?
- Nebenbefund: titanpoint.de listet für ein älteres "Night Elixier"-Packaging EAN 4015100747416 —
  mögliche Alt-EAN für existing_product/Variants-Logik, nicht verifiziert.

---

## 2. L'Oréal Paris Elvital — Haarkur Glycolic Gloss, 5 Minuten Haar-Laminierung (200 ml, EAN 3600524128500)

**Quellen:** dm.de Produktseite 1343854 (GTIN, 8,95 €, Verwendungshinweise, INCI),
loreal-paris.de Produktseite (Manufacturer: Anwendung, 19% Gloss-Complex, "bis zu 10 Haarwäschen").

**Konfidenz:** EAN solide (dm-GTIN = Draft = dm-URL-Slug). contact_time 300 s solide (exakte Packungsangabe).
weight medium **abgeleitet/konservativ** (Claim "ohne zu beschweren" vs. Amodimethicone-Buildup — gemischt).
concentration high abgeleitet (herstellerseitig bezifferter 19%-Komplex, semi-permanenter Effekt).
balance_direction balanced abgeleitet (reines Glanz-/Versiegelungsprodukt). repair low solide begründet
(keine Protein-/Bond-Aktivstoffe; "regeneriert" ist Marketing). benefits shine+smoothing solide (Kernclaims).
thickness alle abgeleitet.

**Deviation — GESTRICHEN per R-C (2026-09-02):** Packung: "… um es **vom Ansatz bis in die
Spitzen** glanzvoll zu versiegeln" — explizite Ansatz-Einbeziehung, widerspricht P5.
Ursprünglich als milde Deviation geflaggt; per Ruling R-C (Verpackung überschreibt
Chaarlies Category-Guidance nie, Deviation nur für strukturelle Mismatches) wird die
Ansatz-Anweisung **ignoriert**: `deviation: null`, Standard-Platzierung lengths_ends
("Ansatz aussparen") wird unverändert gestampt. Der Verpackungstext bleibt als
product_source dokumentiert.

**Offene Frage an Nick:** Glanz/Stumpfheit hat keinen sauberen Concern-Code; `performance`-Semantik
im Katalog unklar. concern_eligibility bewusst nur `frizz` — zu schmal?

---

## 3. Garnier Fructis — Haarkur Banana Hair Food 3in1 Maske (400 ml, EAN 3600542511070)

**Quellen:** dm.de Produktseite 1676324 (GTIN, 5,95 €, Verwendungshinweise mit allen 3 Anwendungen, INCI),
garnier.de Produktseite (Manufacturer, deckungsgleiche Anwendung, vegan/98% natürlich, silikonfrei).

**Konfidenz:** EAN solide (dm + Draft + Drittlisting titanpoint). contact_time 180 s solide.
weight medium **abgeleitet/konservativ** (Öle+Sheabutter im INCI-Mittelfeld vs. "leichte Textur"-Claim).
balance moisture solide begründet (reine Emollient-Formel, keine Proteine). concentration medium abgeleitet.
repair low solide begründet. benefits abgeleitet (Geschmeidigkeit, Entwirren aus Herstellertext).
thickness normal/coarse **abgeleitet/konservativ** — feines Haar wegen Emollient-Last ausgeschlossen;
Gegenposition (Claim "beschwert nicht") ist dokumentiert, Entscheidung reviewbar.

**Keine Deviation:** Masken-Anwendung ist sauber TPL-MASK-konform ("nasses Haar" per Ruling ok).
Die Leave-in-Zweitverwendung derselben Formel ist eine Produktfähigkeit außerhalb des Mask-Stamps —
nicht als Deviation geführt. Falls das Produkt später auch als leave_in gelistet werden soll,
wäre das ein separater Katalog-Eintrag (out of scope für diesen Batch).

---

## 4. Herbal Essences — Haarmaske Blütensanft (300 ml, EAN 8700216212724)

**Quellen:** rossmann.de Produktseite (Anwendung, INCI, 3,99 €, Packshot MAM_12711136),
EAN zusätzlich durch Drittlistings (incibeauty.com, combi.de, 0815.eu) und den Draft (Syndigo-Methode) bestätigt.
Kein deutscher Hersteller-Produktauftritt gefunden (P&G führt die Maske nicht auf einer eigenen DE-Seite);
Retailer-Seite ist hier die beste verfügbare Quelle.

**Konfidenz:** EAN solide (mehrere unabhängige Quellen). contact_time 300 s solide
("Aufs nasse Haar auftragen, 5 Minuten einwirken lassen und ausspülen"). balance moisture solide begründet.
weight medium **geraten/konservativ**: INCI ist eine leichte Basis ohne Öle/Butter (spräche für light),
aber Bis-Aminopropyl Dimethicone deponiert stärker und der Claim ist "intensiv nährend" — Mitte gewählt.
concentration medium geraten. repair low solide begründet. benefits smoothing abgeleitet ("seidiges Haar").
thickness alle abgeleitet (keine Butter/Öle).

**Keine Deviation.** Anmerkung: Glutamic Acid + Histidine sind Einzel-Aminosäuren — bewusst KEIN
proteins-Flag (kein hydrolysiertes Protein). Preisabweichung: ältere Listings zeigen 4,99 €,
Live-Seite 3,99 € (übernommen). dm nennt das Produkt "Haarmaske Blütensanft Rosenduft" — Namensvariante.

---

## 5. Schwarzkopf Gliss — Haarkur 7sec Express-Repair, Ultimate Repair (200 ml, EAN 4015100813319)

**Quellen:** dm.de Produktseite 1581143 (GTIN, 6,95 €, Verwendungshinweise, INCI),
schwarzkopf.de Produktseite (Manufacturer, deckungsgleiche Anwendung inkl. "Längen und Spitzen").

**Konfidenz:** EAN solide (dm-GTIN-Feld = Draft). ACHTUNG Nebenbefund: es existiert eine ältere
dm-URL `…-p4015100433456.html` ("Gliss Kur"-Ära) — vermutlich Alt-SKU desselben Produkts; für
existing_product/Alt-EAN-Prüfung notieren, nicht verifiziert. contact_time 7 s solide (exakte Angabe;
ungewöhnlich kurz, aber gesourct — kein Regelwiderspruch, §2.5-Copy wäre "7 Sekunden einwirken lassen.").
balance protein abgeleitet (Hydrolyzed Keratin + Repair-Linie). weight light abgeleitet.
concentration medium **geraten/konservativ** ("so effektiv wie 5-Minuten-Kur" ist Marketing).
repair medium abgeleitet (Keratin + HaptIQ-Marketing, kein belegter Bond-Builder → nicht high).
benefits shine abgeleitet. thickness alle abgeleitet ("beschwert nicht", silikonfrei).

**Keine Deviation:** Platzierung "direkt auf die Haarlängen" = P5-konform.

---

## 6. IDA WARG Beauty — Intense Moisture Hair Mask (250 ml, EAN 6412600231793, **excluded_from_apply**)

**Quellen:** rossmann.de Produktseite (Anwendung, INCI, 250 ml, Grundpreis 59,96 €/L → 14,99 €,
Packshot MAM_56165360), idawargbeauty.se Produktseite (Manufacturer; 300-ml-Variante, deckungsgleiche
Anwendung inkl. "Finish with conditioner", Inhaltsstoff-Claims, 1-2x/Woche).

**Konfidenz:** EAN **nur einquellig** — Rossmann-URL + Syndigo-Tag (Draft-Methode, von mir unabhängig
reproduziert, aber dieselbe Quelle). Kein unabhängiger Zweitbeleg auffindbar (Websuche leer; DACH-exklusive
250-ml-Größe, Herstellershop listet 300 ml). GS1-Präfix 641 (Finnland) passt zur Lumene Group als
Inhaber — Plausibilität, kein Beleg. **Daher cross_source_agreement=false + excluded_from_apply=true.**
contact_time solide: "5-15 Minuten" = Range → seconds=null (§2.5-Copy wäre "5–15 Minuten einwirken lassen.").
weight rich abgeleitet (Sheabutter INCI-Pos. 5, Premium-Intensivprofil). concentration high abgeleitet.
balance moisture solide begründet (Sodium PCA, Glycerin, Claims). repair low solide begründet.
benefits smoothing abgeleitet (Frizz-Positionierung). thickness normal/coarse abgeleitet/konservativ.
price_eur 14,99 **abgeleitet** aus dem Grundpreis (Seitenlayout gab den Einzelpreis nicht sauber her) —
vor Apply gegenprüfen.

**Deviation — GESTRICHEN per R-C (2026-09-02):** "Gründlich ausspülen **und Spülung
anwenden**" — explizite conditioner_after-Sequenz, vom Hersteller bestätigt ("Finish with
conditioner"). Ursprünglich als Deviation geflaggt; per Ruling R-C wird die
Verpackungs-Sequenz **ignoriert**: `deviation: null`, die Standard-Regel
`replaces_conditioner` (P5) wird unverändert gestampt. Der Verpackungstext bleibt als
product_source dokumentiert. "Handtuchtrockenes Haar" war ohnehin keine Abweichung.
**Der EAN-Ausschluss bleibt bestehen** — das ist R-B (einquellige EAN → excluded_from_apply,
bis Zweitquelle oder physischer Scan) und von R-C unberührt.

**Offene Fragen an Nick (Stand nach Rulings):**
- ~~conditioner_after übernehmen oder replaces_conditioner durchsetzen?~~ → durch R-C
  entschieden (replaces_conditioner, Verpackung ignoriert).
- EAN-Verifikation: per R-B reichen ≥2 unabhängige Quellen ODER ein physischer Scan;
  beides steht für dieses Produkt noch aus.
- Herstellerseite nennt Kadenz "1-2x pro Woche" — V1 hat keinen Kadenz-Slot (bekanntes Template-Thema,
  siehe TPL-SHAMPOO-DANDRUFF-Hinweis); nur notiert, nicht encodiert.

---

## Querschnitts-Notizen

- **Validator (nach Rulings 2026-09-02):** `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/mask-manifest.json`
  → PASS, 5/5 Produkte, 0 deviation-flagged, 1 excluded EAN (IDA WARG), 0 Duplikate.
  (Vor den Rulings: 6/6 mit 3 deviation-flagged — Night Elixier ist jetzt im Leave-in-Manifest,
  die beiden R-C-Deviations sind gestrichen.)
- **EAN-Stand:** alle 6 recherchierten EANs stammen aus `selection-batch1-draft.json` (Stand nach dem parallelen
  EAN-Update-Agenten, gelesen 2026-09-02) und wurden hier unabhängig gegen die Live-Retailer-Seiten geprüft.
  5/6 mehrquellig bestätigt; IDA WARG einquellig (s.o.). Nach der R-A-Verschiebung des Night Elixiers
  trägt dieses Manifest noch 5 davon.
- **Nicht sourcebar / offen geblieben:**
  - Kein Feld ist komplett ungesourct; die als "geraten" markierten Werte (concentration bei
    Night Elixier/7sec, weight bei Herbal Essences) sind konservative Setzungen mangels Textur-Evidenz.
  - `concentration` hat generell die dünnste Evidenzbasis der Mask-Spec-Felder — es gibt keine
    öffentliche Aktivstoff-Konzentration außer beim Glycolic Gloss (19%-Claim).
  - `performance`-Concern-Semantik unklar → Glanzprodukte (Glycolic Gloss) mappen derzeit schlecht.
- **Evidenz-Hygiene:** Alle Anwendungstexte sind wörtliche Zitate der Retailer-Produktseiten
  (dm "Verwendungshinweise", Rossmann "Anwendung und Gebrauch"); Manufacturer-Seiten als Korroboration,
  wo vorhanden. Keine Influencer-/Forenquellen verwendet.

## Image re-sourcing 2026-09-02

Qualitätsbar geprüft (Packshot der Verpackung allein, kürzere Achse ≥ 800 px ideal / ≥ 600 px
Minimum, Hersteller- oder Retailer-Quelle mit Seiten-URL). Jedes Kandidatenbild wurde
heruntergeladen und mit `sips -g pixelWidth -g pixelHeight` vermessen sowie visuell geprüft
(Read-Tool auf das gespeicherte Bild).

- **Elvital Haarkur Glycolic Gloss (5-Minuten-Haar-Laminierung):** zu niedrig aufgelöst
  (408×1200 px bei `h_1200,w_1200`). dm-static liefert dieselbe Cloudinary-Quelle in höherer
  Auflösung, wenn man den `h_*,w_*`-Transform-Parameter erhöht (c_fit skaliert proportional
  hoch, keine andere Bilddatei). Neu: `h_3000,w_3000` → **1021×3000 px**, gleiche Quelle
  (dm.de-Produktseite), scharf und unverändert im Bildinhalt.
- **Gliss Haarkur 7sec Express-Repair, Ultimate Repair:** zu niedrig aufgelöst (334×1200 px).
  Gleicher Trick, `h_3600,w_3600` → **1001×3600 px** (dm.de), scharf, Bildinhalt unverändert.
- **IDA WARG Beauty Intense Moisture Hair Mask:** falscher Bildinhalt (bisheriges Bild
  `MAM_56165360` zeigt ein Vorher/Nachher-Haarfoto, kein Packshot). In der Rossmann-Galerie
  desselben Produkts ist `MAM_56165348` das erste Thumbnail und zeigt den Tiegel frontal ohne
  Marketing-Overlay. Neu: `MAM_56165348` bei `width=2000&height=2000` → **2000×2000 px**,
  gleiche Rossmann-Produktseite als Quelle.

Alle drei jetzt über der Qualitätsbar (Retail-Packshot, keine Vorher/Nachher- oder
Marketing-Aufnahmen, kürzere Achse ≥ 800 px, Quelle dokumentiert).

## Evidence quote backfill 2026-09-02

Alle 24 Evidence-Zeilen tragen jetzt ein wörtliches `source_text`-Zitat, live von der
jeweiligen `source_url` transkribiert (dm.de/Rossmann: GTIN-Feld bzw. JSON-LD-`sku`,
INCI-Kopf, Verwendungshinweise, Preisangabe; Herstellerseiten: Claim-Passagen).
`[…]` markiert Auslassungen zwischen wörtlichen, auf derselben Seite stehenden Passagen.
Abweichung dokumentiert: Die idawargbeauty.se-Seite (Intense Moisture Hair Mask) zeigt
heute die 250-ml-Variante mit "Leave on for 5-10 minutes" und "freshly washed hair" —
die im `fact_value` festgehaltenen Angaben "5-15 minutes" / "towel-dried" / Passionsfruchtöl
stehen dort nicht mehr (die deutsche Rossmann-Seite bestätigt weiterhin 5-15 Minuten,
handtuchtrocken und Passiflora Edulis Seed Oil). Zitat entsprechend von der heutigen Seite
übernommen, nicht rekonstruiert.
