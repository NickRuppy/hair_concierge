# Leave-In-Pilot Research Notes (Batch 1, T2)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-02 vom Research-Agenten. Alle Authority-Felder sind Urteile aus
> INCI + Claims + Anwendungstexten; Konfidenz pro Feld unten ehrlich markiert
> (solide / abgeleitet / geraten). Manifest: `leave-in-manifest.json` (Validator: PASS 7/7
> nach Anwendung der Pilot-Review-Rulings, s. u.).
>
> **UPDATE 2026-09-02 — Nicks Pilot-Review-Rulings angewandt** (Autorität:
> `plans/scan-db-expansion/protocol-templates.md` §"Nick's pilot-review rulings"):
>
> - **R-A (Re-Kategorisierung):** Zwei Produkte kamen aus anderen Batches dazu —
>   Schwarzkopf Gliss **Night Elixier Ultimate Repair** (vorher mask) und Wahre Schätze
>   **Haarserum Honig reparierend** (vorher oil); Abschnitte 6 und 7 unten.
> - **R-D (Dry-Use-Default):** DRYCARE-Stamps zusätzlich zu DAMP für alle Produkte mit
>   `format ∈ {spray, serum} ∧ weight ∈ {light, medium}` (bzw. lotion+light) — greift für
>   die drei Elvital-Produkte und beide re-kategorisierten Produkte. Garnier Aloe Air Dry
>   (cream) und Being Major Moisture (rich cream) bleiben damp-only. Querschnittsfrage 1
>   ist damit entschieden.
> - **R-E (Heat-Claim-Schwelle):** Beschreibungs-Claims von Hersteller oder Retailer
>   reichen für `provides_heat_protection` — die beiden claim-basierten Heat-Stamps
>   (Glycolic Gloss Serum, Being) stehen damit final. Querschnittsfrage 2 ist entschieden.

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

Template-Regeln angewandt (Stand nach Rulings): TPL-LEAVEIN-DAMP als Default für alle
sieben Produkte; TPL-LEAVEIN-DRYCARE zusätzlich per R-D-Default (5 Produkte);
TPL-LEAVEIN-HEAT zusätzlich nur bei Hitzeschutz-Claim (3 Produkte), mit recherchiertem
`usable_on_dry_hair`. `post_style_finish` bleibt geparkt — kein Produkt ist
post-style-only positioniert.

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

**provides_heat_protection = true — per R-E (2026-09-02) bestätigt** (Beschreibungs-Claim
von Hersteller oder Retailer reicht; der ursprüngliche Grenzfall-Vorbehalt ist damit
aufgelöst, die Dokumentation bleibt als Beleg):
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
**R-D-Update (2026-09-02):** zusätzlich TPL-LEAVEIN-DRYCARE gestampt — Default greift
(format=serum ∧ weight=light), Trockenhaar-Erlaubnis wörtlich gesourct.

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
**R-D-Update (2026-09-02):** TPL-LEAVEIN-DRYCARE zusätzlich gestampt — Default greift
(format=spray ∧ weight=light), Trockenhaar-Erlaubnis wörtlich gesourct
(„Auf nassem oder trockenem Haar").
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
**R-D-Update (2026-09-02):** TPL-LEAVEIN-DRYCARE zusätzlich gestampt — Default greift
(format=serum ∧ weight=light), Trockenhaar-Erlaubnis wörtlich gesourct.

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
**R-D geprüft (2026-09-02), KEIN DRYCARE-Stamp:** format=cream fällt nicht unter den
Default (nur spray/serum light/medium bzw. lotion light), und es gibt keine explizite
Trockenhaar-/Between-Wash-Vermarktung („auf nassem oder handtuchtrockenem Haar" sind
beides feuchte Zustände) → damp-only.

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
**R-D geprüft (2026-09-02), KEIN DRYCARE-Stamp:** reichhaltige Creme (format=cream,
weight=rich) ist per Regel damp-only; keine explizite Trockenhaar-Vermarktung.
Heat-Stamp steht per R-E final (Beschreibungs-Claim reicht).

---

## 6. Schwarzkopf Gliss — Haarkur Night Elixier Ultimate Repair (100 ml, EAN 4015100813951) — **re-kategorisiert aus dem Mask-Batch (R-A, 2026-09-02)**

**Herkunft:** Ursprünglich in `mask-manifest.json` recherchiert (Shelf-Kategorie „Haarkur")
und dort mit einer dreifachen Struktur-Deviation geflaggt (Overnight-Leave-on, „Nicht
ausspülen", nass ODER trocken). Per R-A finalisiert die Research die Kategorie →
`leave_in`; Eintrag hierher verschoben, EAN/Preis/INCI/Quellen aus dem Mask-Research
übernommen (dm.de Produktseite 1681632, schwarzkopf.de Night-Elixier-Linienseite).
Historischer Research-Abschnitt: `mask-research-notes.md` §1.

**Top-up-Research für die Leave-in-Felder (2026-09-02):**
format **serum** abgeleitet (Pumpspender mit 2–4 Pumpstößen, „zieht sofort ein", „keine
Spuren auf dem Kopfkissen"; Emulsionsbasis mit Cetearyl Alcohol, aber Dosierung/Textur/
dm-Führung sprechen für serum). weight light abgeleitet (übernommen). roles
extension_conditioner abgeleitet (Overnight-Zusatzpflege, kein Ersatz-Claim, kein
Öl-Analog). provides_heat_protection **false solide** — kein Hitzeschutz-Claim auf dm-
oder Herstellerseite (schwarzkopf.de am 2026-09-02 erneut geprüft: keiner).
application_stage towel_dry+dry_hair solide („in das nasse oder trockene Haar").
care_direction balanced / repair_support_level medium / ingredient_flags
silicones+proteins+humectants: unverändert aus dem Mask-Research übernommen.
fit care_benefits repair (Fit-Enum hat keinen Glanz-Wert). Eligibility: repair-Bucket,
alle Stärken, air_dry.

**Stamps: TPL-LEAVEIN-DAMP + TPL-LEAVEIN-DRYCARE, beide deviation=null.**

- **DAMP — strukturelles Urteil (für Nick dokumentiert):** Die Damp-Familie ist
  strukturell erfüllt — Anwendung ins nasse Haar, Leave-on, „Nicht ausspülen",
  Längen-Einarbeitung; das Template kodiert keine Einwirkdauer und keinen
  Tageszeitpunkt, insofern widerspricht „über Nacht wirken lassen" keiner
  Template-Konstante (Leave-ins bleiben naturgemäß bis zur nächsten Wäsche im Haar).
  Die Overnight-Nuance („Vor dem Schlafengehen", d. h. der Damp-Fall setzt praktisch
  eine Abendwäsche voraus) ist im Template-Vokabular nicht darstellbar — bewusst NICHT
  als Deviation geführt (R-C reserviert die Deviation für strukturelle Mismatches, und
  die Kategorie ist jetzt korrekt), sondern hier als Copy-/Anzeigefrage für Nick
  notiert: Soll die Anwendungs-Copy den Schlafenszeit-Kontext tragen?
- **DRYCARE:** R-D-Default greift (format=serum ∧ weight=light); zusätzlich explizite
  Trockenhaar-Erlaubnis auf der Packung. Between-Wash-Nutzung („Kann jeden Abend genutzt
  werden", auch trocken) passt strukturell.

**EAN-Hinweis:** einquellig im Sinne von R-B? Nein — dm-GTIN-Feld = Draft-Wert; im
Mask-Research als cross_source_agreement=true übernommen (dm + Draft-Quelle). Status
unverändert übernommen, excluded_from_apply=false. Alt-EAN-Nebenbefund (titanpoint.de,
4015100747416, altes Packaging) bleibt unverifiziert.

---

## 7. Wahre Schätze — Haarserum Honig reparierend (115 ml, EAN 3600542567329) — **re-kategorisiert aus dem Oil-Batch (R-A, 2026-09-02)**

**Herkunft:** Ursprünglich in `oil-manifest.json` recherchiert (Shelf-Kategorie „Haaröl")
und dort mit einem 3-fachen Identitäts-Deviation-Flag geführt (wasserbasierte
Serum-Emulsion, kein anhydrisches Öl: INCI-Positionen 1–2 Propylene Glycol/Aqua,
Emulgatoren Trideceth-5/-10, Polyacrylate Crosspolymer-6 — formatgleich mit den
Elvital-Leave-in-Seren). Per R-A finalisiert die Research die Kategorie → `leave_in`;
das Identitäts-Flag ist damit aufgelöst, alle Stamps tragen deviation=null.
EAN/Preis/INCI/Quellen übernommen (dm.de Produktseite 1324799, garnier.de
Manufacturer-Korroboration). Historischer Research-Abschnitt: `oil-research-notes.md` §1.

**Top-up-Research für die Leave-in-Felder (2026-09-02):**
format serum solide („Haarserum", Pumpdosierung, Serum-Emulsion). weight light
abgeleitet (übernommen: Isododecane, „ohne zu kleben oder zu fetten"). roles
oil_replacement abgeleitet (silikon-dominantes Längen-Finish-Serum; gleiches
Enum-Mapping wie das Glycolic-Gloss-Serum). provides_heat_protection **true solide** —
„schützt das Haar bis 230°C vor Hitze" steht im dm-Verwendungstext und wird von Garnier
bestätigt; genügt R-E deutlich → **heat_protection_max_c=230** (im Oil-Schema gab es
dafür kein Feld — als leave_in jetzt sauber erfasst). care_benefits repair+shine solide
(Kernclaims). care_direction balanced abgeleitet (Humectants vorhanden, aber kein
Feuchtigkeits-Kernclaim; keine Proteine). repair_support_level **low abgeleitet**
(„reparierend" ist Linien-Marketing über Silikon-Glättung/Honig; keine Protein-/
Bond-Aktivstoffe — gleiche Messlatte wie beim Glycolic-Gloss-Serum; Bond Repair bekam
medium nur wegen der dedizierten, bezifferten Bond-Formulierung).
application_stage towel_dry+dry_hair+pre_heat solide. Eligibility: repair (air_dry) +
heat_protect (heat_style), alle Stärken.

**Stamps: TPL-LEAVEIN-DAMP + TPL-LEAVEIN-DRYCARE + TPL-LEAVEIN-HEAT, alle deviation=null.**

- **DAMP:** post-wash feucht, Längen und Spitzen, nicht ausspülen — konform.
- **DRYCARE:** R-D-Default greift (format=serum ∧ weight=light); zusätzlich explizite
  Erlaubnis „grundsätzlich auf feuchtem oder trockenem Haar anwendbar" (usable_on_dry_hair
  war schon im Oil-Research etabliert).
- **HEAT:** usable_on_dry_hair=true („feucht oder trocken" explizit) →
  either_state_protection nach P9; Claim-Basis mit 230 °C beziffert.

**Aufgelöste Oil-Fragen:** Die beiden offenen Fragen aus dem Oil-Batch (oil behalten
vs. leave_in; „serum"-Subtyp-Vokabel) sind durch R-A gegenstandslos.

---

## Querschnitts-Notizen

- **Validator (nach Rulings 2026-09-02):** `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/leave-in-manifest.json`
  → PASS, 7/7 Produkte, 0 deviation-flagged, 0 excluded EANs, 0 Duplikate.
  (Vor den Rulings: 5/5; dazugekommen sind die beiden R-A-Re-Kategorisierungen aus
  Mask- und Oil-Batch, §6/§7.)
- **EAN-Stand:** 3/5 der ursprünglichen Produkte aus dm-GTIN-Feldern (Glycolic Gloss, Bond Repair,
  Garnier; = Draft-Werte, live gegengeprüft). Hydra Hyaluron NEU erhoben (Auftrag) und mehrquellig
  bestätigt. Being mehrquellig bestätigt (Identität), aber mit Größenkonflikt (s. Produkt 5).
  Die beiden R-A-Zugänge (§6/§7) tragen ihre im Mask-/Oil-Batch verifizierten dm-EANs unverändert.
- **DRYCARE-Stamps per R-D vergeben (Querschnittsfrage 1 ENTSCHIEDEN, 2026-09-02):** Nicks
  Ruling R-D setzt den Default: `format ∈ {spray, serum} ∧ weight ∈ {light, medium}` oder
  `lotion ∧ light` → DRYCARE zusätzlich zu DAMP; explizite Dry-Use-Vermarktung qualifiziert
  formatunabhängig. Angewandt: Glycolic Gloss Serum, Hydra Hyaluron Spray, Bond Repair Serum,
  Night Elixier (§6) und Wahre Schätze Serum (§7) tragen jetzt DRYCARE mit den bereits
  dokumentierten Dry-Permission-Quellen („feuchtes oder trockenes Haar"-Zitate). Garnier Aloe
  Air Dry (cream, keine Dry-Vermarktung) und Being Major Moisture (rich cream) bleiben damp-only.
- **Heat-Claim-Schwelle (Querschnittsfrage 2 ENTSCHIEDEN, 2026-09-02):** Per R-E reicht ein
  Beschreibungs-Claim von Hersteller oder Retailer für provides_heat_protection; Packungs-/
  Temperatur-Standard ist nicht erforderlich. Die beiden claim-basierten Heat-Stamps
  (Glycolic Gloss Serum, Being) stehen damit final; dazu kommt der Heat-Stamp des
  re-kategorisierten Wahre-Schätze-Serums (230 °C, sogar im Verwendungstext).
- **post_style_finish:** kein Kandidat — alle sieben sind post-wash-tauglich positioniert;
  nichts zu flaggen.
- **Offen für Nick (aus §6):** Anzeige-/Copy-Frage zum Night Elixier — die Damp-Anwendung
  setzt praktisch eine Abendwäsche voraus („Vor dem Schlafengehen"); das Template-Vokabular
  kennt keinen Tageszeitpunkt. Strukturell konform gestampt, Copy-Entscheidung offen.
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

## Image re-sourcing 2026-09-02

Qualitätsbar geprüft (Packshot der Verpackung allein, kürzere Achse ≥ 800 px ideal / ≥ 600 px
Minimum, Hersteller- oder Retailer-Quelle mit Seiten-URL). Jedes Kandidatenbild wurde
heruntergeladen und mit `sips -g pixelWidth -g pixelHeight` vermessen sowie visuell geprüft
(Read-Tool auf das gespeicherte Bild). Betrifft 7 der 7 Produkte dieses Manifests.

- **Elvital Leave-In Serum Glycolic Gloss:** zu niedrig aufgelöst (331×1200 px bei
  `h_1200,w_1200`). dm-static liefert dieselbe Cloudinary-Quelle in höherer Auflösung über den
  `h_*,w_*`-Transform-Parameter. Neu: `h_3600,w_3600` → **993×3600 px** (dm.de), scharf,
  Bildinhalt unverändert.
- **Elvital Leave-In Haarkur Hydra Hyaluron Aufpolsterndes Feuchtigkeitsserum:** falscher
  Bildinhalt (bisheriges Bild `MAM_16015421` ist eine Marketing-/Info-Folie, kein Packshot).
  In der Rossmann-Galerie desselben Produkts ist `MAM_16015375` das erste Thumbnail und zeigt
  die Sprühflasche frontal ohne Overlay. Neu: `MAM_16015375` bei `width=2000&height=2000` →
  **2000×2000 px**, gleiche Rossmann-Produktseite als Quelle.
- **Elvital Leave-In Haarserum Bond Repair, Anti-Haarschäden:** zu niedrig aufgelöst
  (328×1200 px). Gleicher dm-static-Trick, `h_3600,w_3600` → **984×3600 px**, scharf,
  Bildinhalt unverändert.
- **Garnier Fructis Leave-In Creme Aloe Air Dry:** zu niedrig aufgelöst (358×1200 px).
  `h_3000,w_3000` → **896×3000 px** (dm.de), scharf, Bildinhalt unverändert.
- **Being Major Moisture Leave-In Conditioner:** falscher Bildinhalt (bisheriges Bild
  `MAM_23934152` ist eine Textur-Schmier-Aufnahme, kein Packshot). In der Rossmann-Galerie
  desselben Produkts ist `MAM_23934125` das erste Thumbnail und zeigt den Tiegel frontal ohne
  Overlay. Neu: `MAM_23934125` bei `width=2000&height=2000` → **2000×2000 px**, gleiche
  Rossmann-Produktseite als Quelle.
- **Gliss Haarkur Night Elixier Ultimate Repair:** zu niedrig aufgelöst (407×1200 px).
  `h_3000,w_3000` → **1017×3000 px** (dm.de), scharf, Bildinhalt unverändert.
- **Wahre Schätze Haarserum Honig reparierend:** zu niedrig aufgelöst (547×1200 px).
  `h_3000,w_3000` → **1368×3000 px** (dm.de), scharf, Bildinhalt unverändert.

Alle sieben jetzt über der Qualitätsbar (Retail-Packshot, keine Marketing-Folien oder
Textur-Aufnahmen, kürzere Achse ≥ 800 px, Quelle dokumentiert).


## Final review closure (Nick, 2026-09-02)

- Night Elixier: KEEP as regular leave-in (add-on care role, `extension_conditioner`); Anwendung copy = pure standard template, NO bedtime-specific sentence (Nick's ruling). The §6 overnight-copy question is thereby CLOSED.
- All six uncertainty fields ruled (HE weight medium; HH benefit detangle_smooth; Isana medium+styling-oel; WS repair low; Being 354 ml per manufacturer, physical pack check queued; Bond Repair 9,95 € verified on the dm product page).
- Pilot data review is COMPLETE — nothing unreviewed remains in this PR.

## Evidence quote backfill 2026-09-02

Alle 37 Evidence-Zeilen tragen jetzt ein wörtliches `source_text`-Zitat, live von der
jeweiligen `source_url` transkribiert (dm.de/Rossmann: GTIN-Feld bzw. JSON-LD-`sku`,
INCI-Kopf, Verwendungshinweise, Preisangabe; Herstellerseiten: Claim-Passagen).
`[…]` markiert Auslassungen zwischen wörtlichen, auf derselben Seite stehenden Passagen.
Zwei dokumentierte Abweichungen:
- **Bond Repair:** loreal-paris.de führt das Produkt inzwischen als "Bond Repair Plus";
  die Zahlen-Claims aus dem `fact_value` (3x weniger Haarbruch, 7x weniger Spliss, 100%
  wiederhergestellte Stärke, Zitronensäure) stehen auf der heutigen Seite nicht mehr.
  Zitiert wurde die weiterhin vorhandene 20%-Bond-Repair-Komplex-Passage.
- **Night Elixier:** die zitierte URL
  `.../produktlinien/night-elixier/ultimate-repair.html` leitet heute auf die
  Ultimate-Repair-Linienseite um; dort steht die zitierte 5x-Widerstandsfähigkeits-Passage.
  Die Overnight-Formulierung ("regeneriert es über Nacht") steht auf der verschobenen
  Produktseite `.../gliss/ultimate-repair/night-elixier.html`; die Leave-in-Anwendung
  über Nacht ist über die dm-Verwendungshinweise (eigene Evidence-Zeile) belegt.

## F1 reconciliation 2026-09-02

**Elvital Bond Repair — Zeile `product.claims.bond_repair` getrimmt und gesplittet
(Codex-Review F1: fact_value trug 100%-/3x-/7x-Claims, die keine aktuelle Quelle mehr
nennt).** Live geprüft 2026-09-02:

- loreal-paris.de führt das Produkt als "Bond Repair Plus Leave-in-Serum"; die
  20%-Komplex-Passage steht dort weiterhin wörtlich. `bond_repair`-fact_value auf genau
  diesen Umfang getrimmt (20% Bond-Repair-Komplex + Aminosäuren, baut Haarbrücken wieder
  auf, festigt Keratin-Mikrofibrillen); Anwendungs- und Hitzeschutz-Nebensätze entfernt
  (Anwendung ist über die dm-Protokoll-Zeile separat belegt).
- Neue Zeile `product.claims.damage_repair` (dm.de, retailer): dm nennt weiterhin
  wörtlich "20 % Bond-Repair-Komplex mit Zitronensäure", "Repariert alle Arten von
  Haarschäden", "Schützt Haarbrücken für mehr Geschmeidigkeit & Glanz", "Stärkeres Haar",
  "Weniger Spliss" — alles unbeziffert. Die früheren Zahlen (100% wiederhergestellte
  Stärke, 3x weniger Haarbruch, 7x weniger Spliss) stehen weder auf dm noch auf
  loreal-paris.de und wurden vollständig entfernt, nicht umformuliert.
- **Sanity-Check repair_support_level=medium: hält.** Die Einstufung stützte sich auf
  den bezifferten 20%-Komplex mit Zitronensäure (weiterhin von dm UND Hersteller belegt)
  bei fehlender Protein-/Bond-Builder-INCI — nicht auf die 3x/7x-Zahlen. Kein Downgrade
  nötig. concern_eligibility-Rationale aktualisiert: split_ends jetzt über das
  unbezifferte "Weniger Spliss" (dm), breakage über "Stärkeres Haar" +
  Repair-Positionierung (als schwächer belegt markiert); die Eligibility-Werte selbst
  bleiben unverändert.

**Gliss Night Elixier — Zeile `product.claims.overnight_leave_in` umgesourct und
gesplittet (Codex-Review F1: Overnight-Fakt war gegen die Linienseite zitiert, die nur
den 5x-Claim trägt).** Live geprüft 2026-09-02:

- Die Produktseite liegt heute unter
  `https://www.schwarzkopf.de/marken/haarpflege/gliss/ultimate-repair/night-elixier.html`
  (der im Task genannte Kurzpfad `/gliss/ultimate-repair/night-elixier.html` ist 404;
  die alte `produktlinien`-URL leitet auf die Linienseite
  `/marken/haarpflege/gliss/ultimate-repair.html` um). Die Produktseite trägt die
  Overnight-Formulierung wörtlich ("verwandelt sehr geschädigtes Haar und regeneriert es
  über Nacht", "hinterlässt keine Spuren auf dem Kopfkissen") und im Anwendungs-Accordion
  exakt den dm-Text ("... Nicht ausspülen. ..."). Zeile auf diese URL umgestellt,
  fact_value auf den Overnight-/No-rinse-Umfang getrimmt (5x-Anteil entfernt).
- Neue Zeile `product.claims.line_resilience_shine` (Linienseite): trägt den
  5x-Widerstandsfähigkeits-/Glanz-Claim mit passendem Wortlaut-Zitat und ist im
  fact_value explizit als Linien-Claim (nicht produktspezifisch) markiert; sie stützt
  die shine-Rationale in care_benefits.
