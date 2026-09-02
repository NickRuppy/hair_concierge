# Leave-In-Pilot Research Notes (Batch 1, T2)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-02 vom Research-Agenten. Alle Authority-Felder sind Urteile aus
> INCI + Claims + Anwendungstexten; Konfidenz pro Feld unten ehrlich markiert
> (solide / abgeleitet / geraten). Manifest: `leave-in-manifest.json` (Validator: PASS 5/5).

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

Template-Regeln angewandt: TPL-LEAVEIN-DAMP als Default für alle fünf Produkte;
TPL-LEAVEIN-HEAT zusätzlich nur bei Hitzeschutz-Claim (2 Produkte), mit recherchiertem
`usable_on_dry_hair`; TPL-LEAVEIN-DRYCARE für kein Produkt gestampt (siehe Querschnittsfrage 1).
`post_style_finish` bleibt geparkt — kein Produkt ist post-style-only positioniert.

---

## 1. L'Oréal Paris Elvital — Leave-In Serum Glycolic Gloss (150 ml, EAN 3600524135430)

**Quellen:** dm.de Produktseite 1343857 (GTIN-Feld, 9,95 €, Verwendungshinweise, INCI, Merkmale),
loreal-paris.de „Glycolic Gloss Ultimate Leave-In Serum" (Manufacturer; Anwendung wortgleich zur dm-Packung).

**Konfidenz:** EAN solide (dm-GTIN-Feld = Draft). Anwendung solide (wörtlicher dm-Text).
format serum / weight light solide begründet (2-Tropfen-Dosierung, Isododecane-/Silikonbasis,
„leicht und nicht fettend"). care_direction balanced abgeleitet (reines Glanzprodukt, deckungsgleich
mit der Glycolic-Gloss-Maske im Mask-Batch). repair low solide begründet (Glykolsäure weit hinten,
keine Protein-/Bond-Aktivstoffe). benefits shine+anti_frizz solide (Kernclaims, −75% Frizz).
roles oil_replacement **abgeleitet** (Enum-Mapping-Urteil: anhydroses Finish-Serum wie ein Glanzöl).
thickness alle abgeleitet.

**provides_heat_protection = true — GRENZFALL, Nick muss bestätigen:**
Der Claim „Es bietet zuverlässigen Hitzeschutz" steht NUR auf der Herstellerseite
(loreal-paris.de/elvital/glycolic-gloss/serum, wörtlich verifiziert); der dm-Packungstext
nennt keinerlei Hitzeschutz, und es gibt keine Temperaturangabe für diese SKU.
SKU-Identität dm ↔ Herstellerseite ist stark (Anwendungstext wortgleich, gleiche Linie,
150-ml-Tropfen-Serum), aber der Herstellername lautet „Ultimate Leave-In Serum".
**Falle dokumentiert:** Der „Hitzeschutz bis 230 °C"-Claim aus Suchtreffern gehört zum
SEPARATEN „Glycolic Gloss Spiegelglanz"-Leave-In-Spray (eigene dm-SKU, 173 Bewertungen) —
nicht auf dieses Produkt übertragen. → heat_protection_max_c = null.
Konsequenz im Manifest: TPL-LEAVEIN-HEAT gestampt mit usable_on_dry_hair=true
(Hersteller erlaubt explizit „feuchtes oder trockenes Haar" → either_state_protection nach P9).
Wenn Nick den Packungs-Standard (Claim muss auf der Packung stehen) verlangt:
provides_heat_protection→false, Heat-Stamp und pre_heat-Einträge streichen — Ein-Zeilen-Änderung.

**Keine Deviation:** „im feuchten oder trockenen Haar" ist eine Entweder-oder-Erlaubnis,
kein Dry-only-Widerspruch; Längen/Spitzen konform. „Glanz-Finish"-Positionierung ist
Post-Wash-tauglich, kein post_style_finish-only-Fall.

---

## 2. L'Oréal Paris Elvital — Leave-In Haarkur Hydra Hyaluron Aufpolsterndes Feuchtigkeitsserum (150 ml, EAN 3600524030865)

**EAN-CAPTURE (war im Draft offen — Auftrag erfüllt):**
Rossmann-Produktseite gefunden über die Rossmann-Suche; URL-Nummer `/p/3600524030865`
= Syndigo-Tag `SYNDI.push('3600524030865')`. Mod-10 geprüft: gewichtete Summe 65 → Prüfziffer 5 ✓.
GS1-Präfix 360 = L'Oréal-Frankreich-Kreis (Plausibilität). **Unabhängiger Zweitbeleg:**
produkte.globus.de führt dieselbe GTIN in der Produkt-URL („Elvital Haarkur Spray, Hydra
Hyaluronic Serum"); zusätzlich budni.de-Listing und rossmann.dk mit derselben Nummer.
→ cross_source_agreement=true, excluded_from_apply=false.

**Quellen:** rossmann.de Produktseite (6,99 €, 150 ml, Anwendung, INCI, Packshot MAM_16015421),
loreal-paris.de Hydra-Hyaluronic-Serum-Seite (Manufacturer: Claims, nass-oder-trocken, kein Hitze-Claim).

**Konfidenz:** EAN solide (mehrquellig). Anwendung solide. format spray solide („auf die Längen
sprühen" — trotz „Haarkur/Serum" im Namen ein Spray!). weight light solide begründet („ohne
Rückstände/ohne zu beschweren", wässrige Basis). care_direction moisture solide begründet.
repair low solide begründet. benefits moisture solide, volume **abgeleitet** („aufpolsternd/Schwung").
fit care_benefits detangle_smooth **geraten/erzwungen** — das Fit-Enum kennt keinen
Feuchtigkeits-/Volumenwert; schwächstes Feld dieses Produkts. thickness alle abgeleitet.

**Keine Deviation.** Kein Hitzeschutz (auf beiden Quellen explizit geprüft: keiner).
**Namensvarianten-Nebenbefund:** dm verkauft mit hoher Wahrscheinlichkeit dasselbe Produkt als
„Haarserum Hydra Hyaluronic, feuchtigkeitsspendend" (dm 1633046, 6,95 €, 2976 Bewertungen; die
EAN-Suche lieferte diese dm-Seite als Treffer für 3600524030865). Für die Scan-Identität egal
(gleiche GTIN), für die Anzeige ggf. relevant — Rossmann-Name übernommen, da Rossmann die
Draft-Quelle ist.

---

## 3. L'Oréal Paris Elvital — Leave-In Haarserum Bond Repair, Anti-Haarschäden (150 ml, EAN 3600524075576)

**Quellen:** dm.de Produktseite 1679221 (GTIN-Feld „GTIN: 3600524075576", Verwendungshinweise,
INCI, Beschreibung mit 20%-Komplex), loreal-paris.de Bond-Repair-Leave-in-Seite (Manufacturer:
100% Stärke / 3x weniger Haarbruch / 7x weniger Spliss, 2 Tropfen, feucht oder trocken).

**Konfidenz:** EAN solide (dm-GTIN-Feld = Draft). Anwendung solide. format/weight solide begründet
(identische anhydrose Serumbasis wie Glycolic Gloss). care_direction balanced **abgeleitet**
(Citrat-Chemie ist weder protein noch moisture). benefits repair+shine solide (Kernclaims).
**repair_support_level medium abgeleitet — Kernurteil dieses Produkts:** dedizierte Bond-Repair-
Linie mit beziffertem „20% Bond-Repair-Komplex mit Zitronensäure", aber KEINE Proteine in der INCI
und die unabhängige Evidenz für Citrat-„Haarbrücken-Reparatur" ist schwach (Herstellerstudien;
transiente Salzbrücken, kein verifizierter Bond-Builder). „high" wäre nicht evidenzgedeckt, „low"
würde die dedizierte Repair-Formulierung unterzeichnen — Spiegelbild der HaptIQ-Einstufung im
Mask-Batch. thickness alle abgeleitet (2-Tropfen-Serum).

**Kein Hitzeschutz:** „Schützt die Haarbindungen" ist ein Bond-, kein Hitze-Claim; auf keiner
Quelle ein Hitzeschutz-Claim → provides_heat_protection=false, kein Heat-Stamp.

**Keine Deviation:** „von trockenem oder feuchtem Haar" ist Entweder-oder, Längen/Spitzen konform.

**Preis-Hinweis:** 9,95 € stammt aus dem dm-„Ähnliche Produkte"-Panel (inkl. konsistentem
Grundpreis 66,33 €/l bei 150 ml); der Preisblock der Einzelseite wurde im Layout nicht separat
erfasst — vor Apply gegenprüfen (im field_rationale vermerkt).

---

## 4. Garnier Fructis — Leave-In Creme Aloe Air Dry (400 ml, EAN 3600542117593)

**Quellen:** dm.de Produktseite 1538389 (GTIN-Feld, 5,95 €, Verwendungshinweise, INCI, Merkmale
„Ohne Silikone", Haartyp „jeder Haartyp"). Kein deutscher Garnier-Produktauftritt unter diesem
Namen gefunden (garnier.de listet die Air-Dry-Cream nicht auffindbar als eigene Seite) —
dm-Seite ist hier die beste verfügbare Quelle; Claims sind Syndigo-/Herstellercontent auf dm.

**Konfidenz:** EAN solide (dm-GTIN-Feld = Draft). Anwendung solide (wörtlich). format cream solide.
weight light solide begründet (wässrige Gel-Creme: keine Silikone, keine Öle/Butter in der INCI,
„jeder Haartyp"). care_direction moisture solide begründet (Aloe + Glycerin + Hyaluronat, keine
Proteine). repair low solide begründet. benefits moisture+anti_frizz solide („24 Stunden Anti-Frizz").
roles extension_conditioner+styling_prep abgeleitet (dm-Wirkung „Pflege, Styling", Anti-Föhn-Styling).
thickness alle abgeleitet.

**Keine Deviation:** „auf nassem oder handtuchtrockenem Haar" = Damp-Template; „bis in die Spitzen
einmassieren" ist keine Ansatz-Anweisung; „lufttrocknen lassen und ausbürsten" sind zusätzliche
Styling-Hinweise ohne Widerspruch zu Platzierung/Rinse-Logik. Explizit KEIN Hitzeschutz
(Anti-Föhn-Positionierung) → kein heat_style-Eligibility-Kontext.

**Katalog-Altzeile (aus dem Draft, hier nicht auflösbar):** Die bestehende Katalogzeile
„Garnier Hair Food Aloe Vera" (leave_in, ohne GTIN) ist laut Draft-Follow-up vermutlich eine
ANDERE Sub-Linie (Hair Food = Maske/Shampoo/Spülung; das Leave-in heißt bei beiden Retailern
„Air Dry"). Manuelle Reconciliation mit Nick vor dem Apply weiterhin empfohlen;
existing_product_updates bewusst leer gelassen (kein Produkt-UUID-Zugriff in dieser Session,
Supabase-MCP nicht authentifiziert).

---

## 5. Being — Major Moisture Leave-In Conditioner (EAN 4895248005988, **Netto-Inhalt offen**)

**Quellen:** rossmann.de Produktseite /p/4895248005988 (6,79 €, Anwendung, INCI, Beschreibung
inkl. Hitzeschutz-Verwendung, Packshot MAM_23934152), beinghaircare.com Produktseite
(Manufacturer: Heat-Protectant-Claim bestätigt, Anwendung deckungsgleich, INCI deckungsgleich,
Größe 12 fl oz / 354 ml).

**Konfidenz:** EAN solide: Rossmann-URL = Syndigo-Tag, mod-10 valide; unabhängig bestätigt durch
internationale Listings derselben GTIN (eBay UK 226823754631 „354ML", Walmart-/Instacart-Treffer).
Produktidentität (GTIN ↔ „Being Major Moisture Leave-In Conditioner") ist mehrquellig konsistent
→ cross_source_agreement=true. Anwendung solide (wörtlich, von Herstellerseite bestätigt).
weight rich solide begründet (Kokosöl Pos. 3, Sheabutter Pos. 4, Kakaobutter; Zielgruppe 3A-4C) —
der Hersteller-Claim „lightweight" ist dokumentierte Gegenposition, konservativ rich.
care_direction moisture solide begründet. repair low solide begründet. format cream abgeleitet
(Cetearyl-/Butter-Basis, Tiegel laut Herstellerbildern). benefits moisture+curl_definition solide.
thickness normal/coarse **abgeleitet/konservativ** (Butter-Last; feines Haar ausgeschlossen).

**NETTO-INHALT-KONFLIKT (Feld bewusst weggelassen):** Rossmann zeigt 227 ml (Grundpreis-Rechnung
6,79 € / 29,91 €/l = exakt 227 ml; Draft bestätigt 227 ml auf der Seite), aber Hersteller UND
internationale Listings derselben GTIN nennen 354 ml (12 fl oz). Nach GS1-Logik kann eine GTIN
nur eine Größe tragen — wahrscheinlich ist die Rossmann-Größenangabe falsch (227 ml = 8 fl oz,
möglicher Datenfehler), beweisbar ist das remote nicht. net_content_value/unit daher im Manifest
weggelassen (Schema erlaubt das), Konflikt in den field_rationales dokumentiert. Physischer
Scan/Blick auf die Packung im Markt löst es auf.

**provides_heat_protection = true (Claim-basiert):** Rossmann-Beschreibung „… oder als Hitzeschutz",
Hersteller „alternatively for use as a heat protectant". Keine Temperaturangabe, keine unabhängige
Wirksamkeitsevidenz (Butter-/Öl-Creme als Hitzeschutz ist aus kosmetikwissenschaftlicher Sicht
plausibel als Film, aber unbeziffert) → max_c null. TPL-LEAVEIN-HEAT gestampt mit
usable_on_dry_hair=false: keine explizite „nass oder trocken"-Erlaubnis, Anwendung nennt nur
feuchtes Haar → nach P9 damp-only (pre_heat_damp).

**Keine Deviation** beim Damp-Stamp: feuchtes Haar, Spitzen-Fokus, nicht ausspülen — konform.

---

## Querschnitts-Notizen

- **Validator:** `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/leave-in-manifest.json`
  → PASS, 5/5 Produkte, 0 deviation-flagged, 0 excluded EANs, 0 Duplikate.
- **EAN-Stand:** 3/5 aus dm-GTIN-Feldern (Glycolic Gloss, Bond Repair, Garnier; = Draft-Werte,
  live gegengeprüft). Hydra Hyaluron NEU erhoben (Auftrag) und mehrquellig bestätigt.
  Being mehrquellig bestätigt (Identität), aber mit Größenkonflikt (s. Produkt 5).
- **Kein DRYCARE-Stamp vergeben (Querschnittsfrage 1 an Nick):** Drei Produkte (beide Elvital-
  Serums, Hydra-Hyaluron-Spray) erlauben explizit die Anwendung „im feuchten ODER trockenen Haar",
  das Glycolic-Gloss-Serum sogar „tägliche Anwendung". Das ist eine explizite Zustands-Erlaubnis,
  aber KEINE Between-Wash-Use-Case-Vermarktung im Sinne der DRYCARE-Regel („Auffrischen zwischen
  den Wäschen", „Spitzenpflege im trockenen Haar"). Konservativ: nur TPL-LEAVEIN-DAMP gestampt,
  Trockenhaar-Erlaubnis über application_stage=dry_hair als Fakt erfasst. Wenn Nick die Schwelle
  anders zieht („feucht oder trocken + täglich" = Between-Wash), bekämen diese drei zusätzlich
  TPL-LEAVEIN-DRYCARE — die Quellen sind im Manifest bereits zitiert.
- **Heat-Claim-Schwelle (Querschnittsfrage 2 an Nick):** Zwei Heat-Stamps beruhen auf
  Beschreibungs-Claims ohne Temperaturangabe (Glycolic Gloss: nur Herstellerseite; Being:
  Rossmann-Beschreibung + Hersteller). Kein Packungs-Verwendungstext nennt Hitze. Reicht der
  Beschreibungs-Claim als Schwelle für provides_heat_protection, oder gilt Packungs-/
  Temperatur-Standard? Beide Stamps sind einzeln rückbaubar.
- **post_style_finish:** kein Kandidat — alle fünf sind post-wash-tauglich positioniert;
  nichts zu flaggen.
- **Enum-Reibungen (dokumentiert, nicht erfunden):** (a) `product_leave_in_fit_specs.care_benefits`
  hat keinen Feuchtigkeits-/Glanz-/Volumenwert — beim Hydra-Hyaluron-Spray war `detangle_smooth`
  eine erzwungene Wahl (min 1). (b) Glanz/Stumpfheit mappt weiterhin auf keinen Concern-Code
  (gleiches Problem wie im Mask-Batch beim Glycolic Gloss).
- **Nicht sourcebar / offen geblieben:** Being-Nettoinhalt (Konflikt, s.o.); Bond-Repair-Preis
  aus dem dm-Listing-Panel statt dem Einzelseiten-Preisblock (gegenprüfen); keine
  heat_protection_max_c-Werte (keine SKU nennt eine Temperatur — der 230-°C-Wert im Netz gehört
  zum separaten Spiegelglanz-Spray).
- **Evidenz-Hygiene:** Alle Anwendungstexte sind wörtliche Zitate der Retailer-Produktseiten
  (dm „Verwendungshinweise", Rossmann „Anwendung und Gebrauch"); Herstellerseiten (loreal-paris.de,
  beinghaircare.com) als Korroboration. Marketplace-Treffer (eBay/Walmart) nur zur EAN-Identität,
  nie für Authority-Felder. Keine Influencer-/Forenquellen verwendet.
