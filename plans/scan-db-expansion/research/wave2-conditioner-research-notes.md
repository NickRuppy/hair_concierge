# Wave-2 Conditioner Research Notes (Backlog Top 15, T2-konform)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-03 vom Research-Agenten. Erster Conditioner-Batch durch die
> Expansion-Pipeline. Alle Authority-Felder sind Urteile aus INCI + Claims +
> Textur-Hinweisen; Konfidenz pro Feld unten ehrlich markiert (solide /
> abgeleitet / geraten). Manifest: `wave2-conditioner-manifest.json`
> (Validator: **PASS 15/15**, 1 deviation-flagged, 1 excluded EAN, 0 Duplikate).
>
> Rulings angewandt: **R-A** (Kategorie durch Research finalisiert — 1 Re-Kategorisierung),
> **R-B** (EAN ≥2 unabhängige Quellen, sonst excluded — 1 Ausschluss),
> **R-C** (Verpackungs-Anwendungsstil überschreibt Chaarlies Guidance nie; Deviation nur
> strukturell — 1 strukturelle Deviation gesetzt).

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

Alle `source_text`-Zitate wurden live von der jeweiligen `source_url` transkribiert
(dm: Product-Detail-Daten der Produktseite — GTIN-Feld, Verwendungshinweise, INCI,
Preis; Rossmann: Seitentext „Anwendung und Gebrauch" / „Inhaltsstoffe" + JSON-LD;
Müller/Hersteller: `gtin`-Feld im Seitenquelltext). Keine Influencer-/Forenquellen.

**Balance→Spec-Row-Mapping** (Spiegel der Live-Ableitung in Migration
`20260309123000_add_conditioner_specs_and_matcher.sql`): moisture → `snaps`,
protein → `stretches_stays`, balanced → `stretches_bounces`; je eine Zeile pro
freigegebener Haardicke.

---

## 1. L'Oréal Paris Elvital — Conditioner Hydra Hyaluronic (200 ml, EAN 3600524142384)

**Quellen:** dm.de Produktseite 3044952 (GTIN, 3,45 €, Verwendungshinweise, INCI),
loreal-paris.de Produktseite 200 ml (Manufacturer; `gtin13` im JSON-LD = EAN-Zweitquelle).

**Konfidenz:** EAN solide (dm-GTIN + Hersteller-gtin13). Anwendung solide (wörtlich).
weight medium **abgeleitet/konservativ** (Dimethicone Pos. 3 + Amodimethicone vs.
„ohne zu beschweren"). balance moisture solide begründet. repair low solide begründet.
thickness alle solide (dm „Alle Haartypen").

**Kontaktzeit für den Stamp:** Packung nennt exakt **„1 Minute"** — liegt im
1–3-Min-Fenster. Für T4/T5: exakte Zeit → Integer 60 s + Digit-Copy („1 Minute
einwirken lassen.") gemäß Template-Regel „stated exact time overrides". Deviation=null.

---

## 2. Herbal Essences — Conditioner Fiji mit Kokosnussextrakt (250 ml, EAN 8006530290005)

**Quellen:** dm.de Produktseite 3131494 (GTIN, 3,95 €, Verwendungshinweise, INCI),
mueller.de PPN3182592 (EAN-Zweitquelle `gtin`, bestätigt 250 ml).

**Konfidenz:** EAN solide (dm + Müller). weight medium **geraten/konservativ** —
Spiegel der Blütensanft-Mask-Einstufung: leichte Basis ohne Öle/Butter spräche für
light, aber Bis-Aminopropyl Dimethicone deponiert stärker („pflegt intensiv").
balance moisture solide begründet. repair low solide begründet. thickness alle abgeleitet.

**Dual-Use-Hinweis (offene Frage an Nick):** Der dm-Verwendungshinweis bewirbt NUR
die Leave-in-Option („Warum nicht das Ausspülen überspringen? … kann **auch** als
Leave-in genutzt werden"). Kategorie bleibt per R-A-Urteil **conditioner**
(dm-Regal Spülung, cremige Rinse-out-Textur, „auch" impliziert Rinse-out als
Standard; identische Formulierung wie beim Limetten-Schwesterprodukt, das die
Rinse-out-Anweisung ausschreibt). Falls Nick die Template-Zeile
„leave-in-capable → re-categorise" strenger liest: Kandidat für Doppel-Listing,
nicht für Umkategorisierung.

---

## 3. Schwarzkopf Gliss — Conditioner Total Repair (200 ml, EAN 4015100812275)

**Quellen:** dm.de Produktseite 1430910 (GTIN, 2,95 €, Verwendungshinweise, INCI),
Open Beauty Facts Eintrag 4015100812275 („Schwarzkopf Gliss Reparaturspülung total
repair" — nutzer-gescannte physische Packung als unabhängige EAN-Zweitquelle).

**Konfidenz:** EAN solide (dm + OBF). weight medium abgeleitet. balance protein solide
begründet (Hydrolyzed Keratin Pos. 8, Repair-Linie). **repair medium abgeleitet** —
Messlatte wie 7sec-Kur im Mask-Batch: Keratin als Protein-Aktivstoff vorhanden, aber
unbeziffert, kein Bond-System → nicht high; Marketing allein wäre low, das Keratin
hebt auf medium. thickness alle abgeleitet.

**Hinweis:** Ältere Planungsnotiz (2026-06-27) stufte die Schwester „Ultimate Repair
Spülung" auf repair **high** — nach der aktuellen Messlatte (quantifizierte
Bond-/Protein-Aktivstoffe → maximal medium) ist high für keratinbasierte
Drogerie-Spülungen nicht mehr vergebbar. Bewusste Abweichung, reviewbar.

**Keine Deviation (R-C):** „im feuchten Haar verteilen" ohne Ansatz-Anweisung ist
Anwendungsstil; lengths_ends wird unverändert gestampt. Keine Zeitangabe → Range-Copy.

---

## 4. Pantene Pro-V — Conditioner Repair & Care (200 ml, EAN 8700216422116)

**Quellen:** dm.de Produktseite 1554190 (GTIN, 3,95 €, Verwendungshinweise, INCI),
mueller.de IPN3078725 (EAN-Zweitquelle `gtin`).

**Konfidenz:** EAN solide. weight medium **abgeleitet/konservativ** („schwerelose
Formel" vs. Bis-Aminopropyl-Dimethicone-Deposition — gleiche Messlatte wie HE Fiji;
Gegenposition light ist vertretbar, dokumentiert). **repair low solide begründet —
Kernurteil dieses Produkts:** „Regeneration der Haarbindungen", „bis zu 100% mehr
Stärke", „50% mehr Wirkstoffe" sind Vergleichs-/Bond-Marketing OHNE benannte
Protein-/Bond-Aktivstoffe in der INCI (nur Panthenol + Einzel-Aminosäure Histidine).
Ehrlich bleibt es eine Silikon-Pflegespülung → low. balance balanced abgeleitet
(Repair-Marketing ohne Proteinbasis, zugleich Feuchtigkeits-Wirkung). thickness alle.

**Dual-Use-Hinweis:** Packung: „AUSSPÜLEN. LEAVE-IN FÜR ZUSÄTZLICHE PFLEGE" (auch auf
dem Packshot). Rinse-out ist Standard; Leave-in-Fähigkeit = Produktfähigkeit außerhalb
des Conditioner-Stamps (wie Banana-Hair-Food-Präzedenz). Keine Deviation.

---

## 5. Garnier Fructis — Conditioner Locken Methode Feuchtigkeit (200 ml, EAN 3600542656924)

**Quellen:** dm.de Produktseite 3115735 (GTIN, 3,95 €, Verwendungshinweise, INCI),
rossmann.de /p/3600542656924 (EAN-Zweitquelle: EAN in Produkt-URL + JSON-LD-sku).

**Konfidenz:** EAN solide (dm + Rossmann). weight medium abgeleitet (Sheabutter +
Sonnenblumenöl Mittelfeld, Hersteller nennt die Formel „reichhaltig"; silikonfrei).
balance moisture solide begründet (bezifferter 14%-Feuchtigkeitskomplex, 100h-Claim).
repair low solide begründet. thickness alle **abgeleitet** — Gegenposition „fine
ausschließen wegen Butter" dokumentiert; Butter erst Pos. 8, weight=medium trägt die
Vorsicht im Ranking. Entscheidung reviewbar.

**Keine Deviation:** „feuchte Längen und Spitzen" = P2-konform; „kurze Einwirkzeit"
ohne Zahl → Range-Copy des Templates bleibt.

---

## 6. Pantene Pro-V — Conditioner Grow Abundant (250 ml, EAN 8006530059299) — **MEDIZIN-NÄHE BEACHTET**

**Quellen:** dm.de Produktseite 3115707 (GTIN, 7,95 €, Verwendungshinweise, INCI),
mueller.de PPN3159483 (EAN-Zweitquelle `gtin`).

**Konfidenz:** EAN solide. weight light solide begründet (silikon-/ölfreie
Minimalformel, Zielgruppe feines Haar). repair low solide begründet (keine Protein-/
Bond-Aktivstoffe; Aminosäuren sind keine hydrolysierten Proteine). balance balanced
abgeleitet. thickness fine+normal **abgeleitet/konservativ** („für feines und
schwaches Haar" beworben; coarse ausgeschlossen).

**Haarausfall-nahes Marketing — kosmetisches Framing durchgesetzt:**

- Produkt heißt bei dm „… Anti-Haarverlust"; dm-Wirkung listet sogar **„Gegen
  Haarausfall"**. Beides wird NICHT übernommen: `clean_name` ist „Conditioner Grow
  Abundant" (ohne Suffix), Beschreibung und Concern beschränken sich auf **Haarverlust
  durch Haarbruch** (kosmetisch, Faserbruch — kein Wachstums-/Alopezie-Claim).
- Packshot trägt „damit das Haar länger wachsen kann(1)" und „1500MG(2)
  Pro-Vitamin-Komplex" — Fußnoten-Marketing; Wachstums-Formulierungen bleiben aus
  jeder Chaarlie-Copy heraus.
- dm-Beschreibung enthält einen klinischen Vergleichsclaim („reduziert Haarverlust um
  bis zu 90%. Klinische Studie im Vergleich zu Placebo … bei Verwendung mit der Grow
  Abundant Haarmaske") — Komparator ist ein Volumen-Shampoo und die Wirkung ist an die
  Maske gekoppelt; als Evidenz-Zitat dokumentiert, in keiner Empfehlung verwendet.
- Verwendungshinweis endet mit Upsell auf ein „Anti-Haarverlust Kopfhautserum" —
  gehört nicht zum Conditioner-Protokoll, ignoriert.
- Konsequenz fürs Produkt: reiner Pflege-Conditioner-Stamp, concern nur `breakage`.
  Sollte der Chat je nach diesem Produkt gefragt werden: kosmetische Anti-Haarbruch-
  Sprache, bei echten Haarausfall-Sorgen → ärztliche Abklärung (Repo-Regel).

**Keine Deviation:** „In die Haarlängen geben" P2-nah; keine Zeitangabe.

---

## 7. Aussie — Conditioner Bouncy Curls (200 ml, EAN 8006530325448)

**Quellen:** dm.de Produktseite 3135994 (GTIN, 4,95 €, Verwendungshinweise, INCI),
rossmann.de /p/8006530325448 („Spülung Curls", EAN-Zweitquelle).

**Konfidenz:** EAN solide (dm + Rossmann; Achtung: Drittlisting caretobeauty.com führt
für eine ÄLTERE Packungsgeneration 8700216185394 — Alt-EAN-Kandidat, nicht
verifiziert, nur notiert). weight light abgeleitet (Minimalbasis; Macadamia-/Rizinusöl
stehen am INCI-Ende). balance moisture solide begründet. repair low solide begründet
(„gegen Haarbruch" = Stylingschutz-Marketing). thickness alle abgeleitet.

**Keine Deviation:** sehr knapper Packungstext („Kämme deine frisch gewaschenen Locken
durch, ausspülen und fertig!") ohne Widerspruch zur Guidance.

---

## 8. Langhaarmädchen — Conditioner Intense Repair (250 ml, EAN 4070765004588, **excluded_from_apply**)

**Quellen:** dm.de Produktseite 1539684 (GTIN, 4,95 €, Verwendungshinweise, INCI).

**EAN einquellig (R-B):** 4070765004588 stammt allein aus dem dm-GTIN-Feld; dm.at
zeigt dieselbe Zahl, ist aber derselbe Datenfeed (nicht unabhängig). Kein
unabhängiger Zweitbeleg auffindbar — die Marke ist dm-exklusiv. Es gibt dokumentierte
**EAN-Churn-Historie**: VivaVoss (Shopify-Barcode) und eine ältere dm-URL führen
4058172831409, Codecheck sogar 4010355409836 für dasselbe Produkt (frühere
Packungsgenerationen). → `cross_source_agreement=false`, `excluded_from_apply=true`,
bis Zweitquelle oder physischer Scan die aktuelle EAN bestätigt. Alt-EANs nur
notiert, nicht als Identifier aufgenommen.

**Konfidenz:** Anwendung solide (P2-Musterbeispiel: „feuchte Längen und Spitzen …
kurz einwirken … gründlich ausspülen"). weight medium abgeleitet (Öle + 2 Silikone).
balance moisture abgeleitet (Glycerin Pos. 2, PCA/Sodium PCA, keine hydrolysierten
Proteine). **repair low solide begründet:** „Intense Repair" ist Linien-Marketing;
der „Aminosäuren-Komplex" besteht aus Einzel-Aminosäuren (Arginine, Serine, Glycine …)
— gleiche Messlatte wie Blütensanft (kein proteins-Flag, kein repair-Bonus).
thickness alle abgeleitet.

---

## 9. Herbal Essences — Conditioner Limettenduft, Tiefenreinigung & Glanz (250 ml, EAN 8006530123433)

**Quellen:** dm.de Produktseite 3115709 (GTIN, 3,95 €, Verwendungshinweise, INCI),
mueller.de PPN3159518 (EAN-Zweitquelle `gtin`).

**Konfidenz:** EAN solide. weight light solide begründet (Minimalbasis, „schwerelos",
silikonfrei). balance balanced abgeleitet (reines Glanz-/Basisprodukt). repair low
solide begründet. thickness alle abgeleitet.

**concern_eligibility LEER (ehrlich, offene Frage an Nick):** Glanz/Stumpfheit hat
keinen Conditioner-Concern-Code (bekanntes Lückenthema seit dem Mask-Batch:
`performance`-Semantik unklar). Nichts anderes ist belegt — bewusst `[]` statt eines
erfundenen Concerns. Runtime-Matching läuft über thickness+balance, davon unberührt.
ingredient_flags ebenfalls leer (keine Silikone/Öle/Proteine/Polymere — ehrlich).

**Dual-Use-Hinweis:** wie Fiji („kann auch als Leave-in genutzt werden"), aber hier
mit ausgeschriebener Rinse-out-Anweisung („Solltest du ausspülen: …"). Kategorie
conditioner, keine Deviation; Leave-in-Option nur notiert.

---

## 10. Jean&Len — Conditioner Hydration Pfirsich Chia (300 ml, EAN 4262401738906)

**Quellen:** dm.de Produktseite 3100946 (GTIN, 3,95 €, Verwendungshinweise, INCI),
jeanlen.de Produktseite (Manufacturer; `gtin13` im JSON-LD = EAN-Zweitquelle).

**Konfidenz:** EAN solide (dm + Hersteller). weight light abgeleitet (silikonfrei,
keine Butter, leichte Ester). balance moisture solide begründet. repair low solide
begründet. thickness alle solide (dm „Alle Haartypen").

**Keine Deviation (R-C):** „ins feuchte Haar einmassieren" ohne Ansatz-Anweisung =
Anwendungsstil; „kurz einwirken" ohne Zahl → Range-Copy bleibt.

---

## 11. Syoss — Tiefenspülung Intense Repair (250 ml, EAN 4015100860986)

**Quellen:** rossmann.de /p/4015100860986 (Anwendung, INCI, 3,49 €, Packshot
MAM_15572855), Open Beauty Facts Eintrag 4015100860986 (unabhängige EAN-Zweitquelle).

**Kategorie-Urteil (R-A):** „Tiefenspülung" — Hersteller: „reichhaltiger als eine
Spülung und leichter als eine Haarkur" (ein Bulletpoint nennt sie sogar „Haarmaske").
Bleibt **conditioner**: Anwendung ist reine Spülung („nach dem Shampoonieren sanft in
nasses Haar einarbeiten. Gründlich ausspülen", Marketing: „ganz ohne Einwirkzeit"),
Rossmann-Regal Conditioner. Die Zwischenstellung ist über `weight=rich` encodiert
statt über einen Mask-Stamp.

**Konfidenz:** EAN solide (Rossmann + OBF). **weight rich abgeleitet** (explizite
Hersteller-Positionierung; rich trägt zugleich die Feinhaar-Vorsicht — reviewbar,
medium wäre die Gegenposition). **repair medium solide begründet:** bezifferter
**9% Protein-Pflege-Komplex** mit Hydrolyzed Keratin (Pos. 5) + Hydrolyzed Soy
Protein (Pos. 6) = quantifizierte Protein-Aktivstoffe → medium ist per Messlatte das
Maximum (kein Bond-Builder → nicht high). balance protein solide begründet.
thickness alle abgeleitet.

**Kontaktzeit-Notiz für den Stamp:** Marketing sagt „ganz ohne Einwirkzeit". Per R-C
überschreibt das die 1–3-Min-Regel nicht (Anwendungsstil); der Stamp bleibt Standard.
Falls Nick hier die Zeit auf „Kurz einwirken lassen." reduzieren will: bewusste
Abweichung von P2, bitte explizit entscheiden.

---

## 12. Nivea — Hairmilk Shine Glanzspülung (200 ml, EAN 4006000192673)

**Quellen:** rossmann.de /p/4006000192673 (Anwendung, INCI, 2,49 €, Packshot
MAM_18168014), nivea.de Produktseite 40060001926730001 (Manufacturer; `gtin` im
Quelltext = EAN-Zweitquelle).

**Konfidenz:** EAN solide (Rossmann + Hersteller). weight light solide begründet
(Milch-Textur, silikonfrei, 3× „ohne zu beschweren"). balance moisture solide
begründet. repair low solide begründet („regeneriert von innen heraus" = Marketing).
thickness alle solide („eignet sich für alle Haartypen").

**Anwendung = P2-Musterbeispiel** (wörtlich: „Sparen Sie die Kopfhaut und den
Haaransatz beim Auftragen der Spülung aus", „ca. 1 Minute einwirken"). Für den Stamp:
„ca. 1 Minute" ist eine Circa-Angabe → konservativ als Range-Copy des Templates
belassen ODER Integer 60 s; Stamping-Entscheidung notiert, hier nicht erzwungen.

---

## 13. Schwarzkopf Gliss — Sprüh-Conditioner Express-Repair Total Repair (200 ml, EAN 4015100813470) — **RE-KATEGORISIERT → leave_in (R-A)**

**Quellen:** dm.de Produktseite 1430766 (GTIN, 4,95 €, Verwendungshinweise, INCI),
rossmann.de /p/4015100813470 (EAN-Zweitquelle; eigene Anwendungs-/INCI-Sektion,
4,99 €, deckungsgleicher Anwendungstext).

**R-A angewandt (wie Night-Elixier-Präzedenz):** Backlog führte das Produkt als
conditioner (Rossmann-Regal). Die Research finalisiert **leave_in**: „**Nicht
ausspülen!**", Anwendung „in das handtuchtrockene **oder trockene** Haar sprühen",
dm-Führung als „Sprüh-Conditioner". Ein TPL-CONDITIONER-Stamp wäre strukturell
falsch. Alle Stamps deviation=null, da die Kategorie jetzt stimmt.

**Stamps: TPL-LEAVEIN-DAMP + TPL-LEAVEIN-DRYCARE + TPL-LEAVEIN-HEAT.**
DRYCARE doppelt begründet: explizite Dry-Use-Vermarktung UND R-D-Default
(format=spray ∧ weight=light). HEAT: „Hitzeschutz bis zu 230 °C" (beide Retailer) →
`provides_heat_protection=true`, `heat_protection_max_c=230`;
`usable_on_dry_hair=true` / either-state ist hier durch das explizite
„handtuchtrocken **oder** trocken" gedeckt (P9-Kriterium erfüllt, keine bloße
Präferenzformulierung).

**Konfidenz:** EAN solide (dm + Rossmann). format/heat/Anwendung solide (wörtlich).
weight light abgeleitet (wässriges Spray). care_direction balanced abgeleitet
(Keratin + Silikon-Glättung, Spiegel Night Elixier). **repair_support medium
abgeleitet** (Hydrolyzed Keratin als Protein-Aktivstoff, unbeziffert; Messlatte
7sec/Night Elixier — nicht high). roles replacement+extension abgeleitet
(positioniert als „die Spülung" nach jeder Wäsche; zusätzlich Dry-Use).
Eligibility-Buckets repair×air_dry + heat_protect×heat_style **abgeleitet**.
heat_activation_required=false **abgeleitet** (keine Aktivierungsangabe — Negativbefund).

**INCI-Randnotiz:** dm- und Rossmann-INCI unterscheiden sich im Duftstoff-Endfeld
(dm listet u. a. Rose Ketones/Vanillin, Rossmann Coumarin) — vermutlich
Chargen-/Versionsdrift; alle Authority-Facts stützen sich auf die vorderen,
identischen Positionen. Preisdifferenz dm 4,95 € / Rossmann 4,99 € — dm übernommen
(Primärquelle des Eintrags).

---

## 14. John Frieda — Go Blonder Conditioner (500 ml, EAN 5037156296204)

**Quellen:** rossmann.de /p/5037156296204 (Anwendung, INCI, 14,39 €), mueller.de
PPN3189090 (EAN-Zweitquelle `gtin`, bestätigt 500 ml), Müller-Packshot
(FrontView 3000×3000) als Bildquelle.

**Größenkorrektur gegenüber Backlog:** Draft sagte 250 ml — die aktuelle
Handelsgröße bei Rossmann UND Müller ist die **500-ml-Relaunch-Flasche** zu dieser
EAN (Rossmann: „500 ml (1 L = 28,78 €) … Aktueller Artikelpreis: 14,39 €",
Streichpreis 17,99 €). Manifest führt 500 ml / 14,39 €.

**Konfidenz:** EAN solide. weight light solide begründet (silikon-/ölfreie leichte
Basis). balance moisture abgeleitet („spendet Feuchtigkeit" ist der konkreteste
Pflege-Claim; Gegenposition balanced vertretbar). repair low solide begründet
(„reduziert Haarbruch" ist Kollektions-Claim). thickness alle abgeleitet.

**Aufhellungs-Claim NICHT übernommen:** Packung: „Hellt um bis zu 2 Nuancen auf …
mit Botanical-Citrus-Complex"; Linie claimt „sanfte Aufhellung". Die INCI enthält
keinen Aufheller (kein Peroxid; nur Zitrus-Schalenöle). Evidenzlage für Aufhellung
per Rinse-out-Conditioner: schwach/Marketing → als Produktwirkung nicht encodiert,
nicht in der Beschreibung. **Empfehlungsrisiko (offene Frage an Nick):** Das
Conditioner-Schema hat keine Farb-/Blond-Dimension — die Engine könnte das Produkt
Nicht-Blondinen empfehlen. Concern bewusst schmal (`feuchtigkeit`).

**Keine Deviation:** Anwendung P2-konform („in den Haarlängen und Spitzen").

---

## 15. John Frieda — Salon Blonde Champagnerblond Pflegende Farbveredelung (120 ml, EAN 5037156295931) — **DEVIATION (strukturell) → Nick**

**Quellen:** rossmann.de /p/5037156295931 (Anwendung, INCI, 8,99 €, Warnhinweise),
mueller.de PPN3111169 (EAN-Zweitquelle `gtin`, bestätigt 120 ml), Müller-Packshot
(FrontView 3600×3600, Faltschachtel) als Bildquelle.

**Warum Deviation statt Stamp:** farbabscheidende Toning-Behandlung mit Direktziehern
(ACID RED 52, CI 60730, HC BLUE NO. 12), effektabhängigem **2–5-Minuten-Fenster**
(„Der Effekt variiert je nach Einwirkzeit"), **Wechsel-Kadenz** („nach jeder 2. bis
3. Haarwäsche, im Wechsel mit deinem regulären John Frieda Conditioner") und
Färbe-/Handschuh-Warnung („ACHTUNG Stark Färbendes Produkt"). Das ist kein
Alltags-Rinse-out-Conditioner; Chaarlie hat keine Toning-Kategorie
(EXPANSION_CATEGORY_KEYS: shampoo/conditioner/leave_in/oil/mask). Die
Template-Deviationsliste nennt exakt diesen Fall („Colour-refreshing conditioners
with a timing/gloves warning → flag"). R-C greift nicht — das ist strukturell, nicht
Anwendungsstil. **Produkt geht mit gesetzter Deviation an Nick; ohne Freigabe kein
Stamp/Apply.**

**Konfidenz (falls freigegeben):** EAN solide. weight light abgeleitet. balance
protein abgeleitet (benannter „Protein Peptid Komplex" = Hydrolyzed Rice/Vegetable
Protein). **repair medium abgeleitet** (echte hydrolysierte Proteine; der
„97% weniger Haarbruch"-Claim hat einen schwachen Komparator — „im Vergleich zu
herkömmlichem Shampoo"). concern nur breakage. thickness alle. V1 hat keinen
Kadenz-Slot (bekanntes Template-Thema) — Kadenz nur dokumentiert.

---

## Querschnitts-Notizen

- **Validator:** `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/wave2-conditioner-manifest.json`
  → **PASS, 15/15 Produkte, 1 deviation-flagged (Salon Blonde), 1 excluded EAN
  (Langhaarmädchen), 0 Duplikate** (Erstlauf, unverändert).
- **EAN-Stand (R-B):** 14/15 mehrquellig verifiziert (dm/Rossmann/Müller-GTIN-Felder,
  Hersteller-JSON-LD bei L'Oréal/Jean&Len/Nivea, Open Beauty Facts bei Gliss/Syoss —
  jeweils unabhängige Systeme). Einziger Ausschluss: Langhaarmädchen (dm-exklusiv,
  EAN-Churn-Historie, §8). Alle 15 EANs bestehen die GS1-Mod-10-Prüfung (Validator).
  Der Backlog-Draft enthielt für keinen der 15 eine EAN — alle hier neu erhoben.
- **Kategorien (R-A):** 13× conditioner bestätigt, 1× re-kategorisiert (Gliss-Spray →
  leave_in, §13), 1× strukturelle Deviation (Salon Blonde, §15). Dual-Use-Notizen
  (Rinse-out + Leave-in-Option) bei HE Fiji, HE Limette, Pantene Repair & Care —
  Kategorie jeweils conditioner belassen, für Nick sichtbar gemacht.
- **Kontaktzeiten fürs Stamping (T4/T5):** exakt: Elvital 1 Min (60 s); circa:
  Nivea „ca. 1 Minute"; qualitativ „kurz": LHM, Jean&Len, Fructis; keine Angabe:
  Gliss TR, Pantene R&C, Pantene Grow, Aussie, HE Fiji, HE Limette, Syoss („ganz
  ohne Einwirkzeit" — Marketing, R-C), Go Blonder. Deviation-Fall: Salon Blonde
  2–5 Min. Kein Wert widerspricht dem 1–3-Min-Fenster strukturell.
- **Schwächste Urteile (ehrlich geraten/dünn):**
  - `weight` bei HE Fiji und Pantene R&C (medium konservativ wegen
    Bis-Aminopropyl Dimethicone; light wäre je nach Lesart vertretbar).
  - `weight=rich` bei Syoss (Hersteller-Selbstpositionierung, keine Textur-Messung).
  - Eligibility-Buckets des Gliss-Sprays (abgeleitet aus Claims, keine Live-Präzedenz
    für Spray-Leave-ins dieser Bauart im Batch).
  - Concern-Lücke „Glanz/Stumpfheit" (HE Limette `[]`) — Codes fehlen, wie im
    Mask-Batch dokumentiert.
- **Nicht sourcebar / offen geblieben:** kein Feld komplett ungesourct; alle
  „geraten"-Werte sind konservative Setzungen mit dokumentierter Gegenposition.
  Keine Hersteller-Seite für Herbal Essences/Aussie in DE auffindbar (P&G führt keine
  eigenen DE-PDPs) — Müller/Rossmann dienen als Zweitquellen.
- **Bilder:** alle 15 geprüft (heruntergeladen, `sips`-vermessen, visuell als
  frontale Retail-Packshots bestätigt; kürzeste Achse ≥ 800 px):
  dm-CDN mit `h_3000,w_3000` (Standard) bzw. `h_4500,w_4500` (Gliss-Spray 1046 px,
  Jean&Len 1062 px — bei h_3000 lagen beide unter 800 px Breite); Rossmann
  `?width=2000&height=2000` (Syoss 1020 px, Nivea 886 px); für beide John-Frieda-
  Produkte liefern die Rossmann-Originale nur 681/767 px kurze Achse → Müller-
  Packshots verwendet (3000×3000 bzw. 3600×3600, `static.prod.ecom.mueller.de`,
  Quelle = Müller-PDP). Salon-Blonde-Bild zeigt die Faltschachtel (so wird das
  Produkt verkauft).
- **Offene Fragen an Nick (Sammelliste):**
  1. Dual-Use-Conditioner (HE Fiji/Limette, Pantene R&C): conditioner belassen ok,
     oder Doppel-Listing als leave_in gewünscht?
  2. Salon Blonde: Deviation entscheiden — aufnehmen (mit welchem Stamp?) oder aus
     dem Apply ausklammern? Toning-Kategorie mittelfristig?
  3. Go Blonder: Blond-Dimension fehlt im Schema — Empfehlungsrisiko akzeptieren
     oder Produkt bis dahin zurückhalten?
  4. Syoss: weight rich vs. medium; „ohne Einwirkzeit"-Marketing vs. 1–3-Min-Regel.
  5. Langhaarmädchen: physischen Scan organisieren (dm-Filiale) zur EAN-Freigabe?
  6. Repair-Messlatte: Bestand „Ultimate Repair = high" (Plan 2026-06-27) auf die
     aktuelle Messlatte (max. medium ohne Bond-System) nachziehen?


## Nick's W-rulings (2026-09-02)
- W2: JF Salon Blonde Champagnerblond DROPPED from the wave — toning/direct-dye products are out of scope for now (parked in backlog; no toning treatment exists yet).
- JF Go Blonder STAYS (its 'aufhellend' line is marketing without lightener actives — not a toner; researched values unchanged).
- W4: cream dry-use tolerance = damp-only confirmed (no stamp changes needed — researched conservatively).
