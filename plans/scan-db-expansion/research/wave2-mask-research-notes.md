# Mask Wave-2 Research Notes (Backlog Top 10, T2)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-03 vom Research-Agenten. Alle Authority-Felder sind Urteile aus
> INCI + Claims + Textur-Hinweisen; Konfidenz pro Feld unten ehrlich markiert
> (solide / abgeleitet / geraten). Manifest: `wave2-mask-manifest.json`
> (Validator: **PASS 8/8**, 0 deviation-flagged, 0 excluded EANs, 0 Duplikate).
>
> **2 von 10 Backlog-Produkten sind KEINE Rinse-out-Masken (Ruling R-A)** und
> wurden NICHT ins Mask-Manifest recherchiert: Pantene Hydration SOS Hair Shake
> und John Frieda Tägliche Wunderkur Sofort Pflegespray — Details in §9/§10.
> Beide sind strukturell Leave-ins; Evidenz unten dokumentiert, kein erzwungener
> TPL-MASK-Stamp (Präzedenz: Gliss Night Elixier, Pilot-Batch).

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

**EAN-Verifikationsregel dieses Waves (R-B):** verified = identische Ziffern in ≥2
unabhängigen Quellen. Alle 8 Manifest-EANs wurden von mir selbst von den
Live-Retailerseiten erfasst (Backlog trug keine EANs), mod-10-geprüft und sind
mehrquellig bestätigt (dm-GTIN-Feld + Rossmann-URL/JSON-LD-sku, teils zusätzlich
Müller). **0 einquellige EANs, 0 excluded.** Keine Ziffer wurde erfunden.

---

## 1. L'Oréal Paris Elvital — Haarmaske Hydra Hyaluronic (300 ml, EAN 3600524245849)

**Quellen:** dm.de Produktseite 3122676 (GTIN, 4,95 €, Verwendungshinweise, INCI,
Produktmerkmale "Alle Haartypen"), rossmann.de Produktseite /p/3600524245849
(EAN-Zweitquelle; Anwendungstext wortgleich), loreal-paris.de Produktseite (Manufacturer-Claims).

**Konfidenz:** EAN solide (dm-GTIN = Rossmann-URL/Listing). contact_time 180 s solide
(exakte Angabe, dm + Rossmann wortgleich). weight light **abgeleitet** (Hersteller-Claim
'leichte Textur/beschwert nicht' + leichte INCI ohne Öle/Butter; dm-Reviews zur Neuformel
stützen das zusätzlich). concentration medium abgeleitet. balance moisture solide begründet
(Glycerin Pos. 2, Sodium Hyaluronate, keine Proteine). repair low solide begründet.
benefits smoothing+shine abgeleitet (Herstellerclaims). thickness alle solide-nah
(dm-Produktmerkmal 'Alle Haartypen').

**Keine Deviation:** Platzierung 'von den Längen bis zu den Spitzen' = P5-konform,
kein Conditioner-danach, keine Wärme.

**Anmerkungen:**
- **Claims-Drift dokumentiert:** dm sagt 'bis zu 100 Stunden hydratisiert' (Neue Formel),
  die Herstellerseite '72 Stunden'. Mehrere dm-Reviews (Aug 2026) berichten von einer
  spürbaren **Reformulierung** ('Konsistenz dünn wie Spülung'). Für die Spec-Felder ohne
  Konsequenz (beide Versionen sind leichte Moisture-Masken), aber bei einem späteren
  Re-Check die INCI der physischen Packung gegenprüfen.
- Amodimethicone steht weit hinten (nach den Konservierern) — silicones-Flag gesetzt,
  aber für weight nicht als Buildup-Risiko gewichtet (Spurenbereich).

---

## 2. John Frieda — Frizz Ease Wunder-Reparatur Tiefenwirksame Wunder-Kur (250 ml, EAN 5037156298789)

**Quellen:** rossmann.de Produktseite (Backlog-Retailer: URL-GTIN + JSON-LD-sku, 9,99 €,
Anwendung, INCI, Claims-Bullets), dm.de führt dieselbe EAN als 'Haarkur Frizz Ease
Wunder-Reparatur, 250 ml' (EAN-Zweitquelle, via dm-Suchindex), johnfrieda.com/de-de
Produktseite (Manufacturer).

**Konfidenz:** EAN solide (Rossmann + dm). contact_time solide: '3-5 Minuten' = Range →
seconds=null (§2.5-Copy '3–5 Minuten einwirken lassen.'). weight rich **abgeleitet**
(Dimethicone Pos. 3 + Amodimethicone-Derivat + Dimethiconol + 3 Öle; Intensiv-Positionierung,
kein Leicht-Claim) — reviewbar, medium wäre die nächst-konservative Alternative.
concentration high abgeleitet (wöchentliche Intensiv-Tiefenpflegekur, ersetzt laut
Hersteller den Conditioner). balance balanced abgeleitet. repair low solide begründet
(Ceramide im Spurenbereich, keine Proteine; '90% der Oberflächenschäden' ist ein
Oberflächen-/Glättungsclaim). benefits smoothing+shine solide (Kernclaims).
thickness normal/coarse **abgeleitet/konservativ** (Buildup-Risiko der Silikon-Öl-Formel
bei feinem Haar).

**Keine Deviation — Herstellerbestätigung für P5:** johnfrieda.com sequenziert die Kur
explizit als Conditioner-Ersatz ('Ersetze einmal wöchentlich den Conditioner durch die
Wunder-Reparatur Wunderkur') — die kanonische replaces_conditioner-Regel ist hier sogar
herstellerseitig belegt. 'Insbesondere in die Spitzen' = P5-konform. Der Serienbezug
('mit Wunder-Reparatur Shampoo waschen') ist Cross-Selling.

**Namens-Hinweis:** Rossmann-Markenfeld ist 'JOHN FRIEDA Frizz Ease Wunder-Reparatur',
Produktname 'Wunder-Reparatur Tiefenwirksame Wunder-Kur'; dm nennt es 'Haarkur Frizz Ease
Wunder-Reparatur'. Manifest: brand 'John Frieda' + name 'Frizz Ease Wunder-Reparatur
Tiefenwirksame Wunder-Kur' (dedupliziert). Für das Scan-Matching ggf. beide Varianten hinterlegen.

---

## 3. Pantene Pro-V — Moisture BOOST Keratin Protect Haarmaske (300 ml, EAN 8700216940108) — **CONTACT-TIME-BLOCKER**

**Quellen:** rossmann.de Produktseite (Backlog-Retailer: URL-GTIN + JSON-LD-sku, 3,99 €,
Anwendung, INCI), dm.de Produktseite 3088184 (GTIN-Feld, 4,45 €, Verwendungshinweise
wortgleich), mueller.de (EAN-Suche löst auf dieses Produkt auf, 4,45 €, INCI wortgleich).
Kein deutscher Pantene-Herstellerauftritt mit Produktdetails gefunden.

**Konfidenz:** EAN solide (3 unabhängige Retailer). weight medium **abgeleitet/konservativ**
('reichhaltige Formel'-Claim vs. schlanke Amino-Silikon-Basis — Präzedenz Herbal Essences).
concentration medium **geraten/konservativ**. balance moisture solide begründet.
repair low solide begründet (**KEIN Keratin in der INCI trotz 'Keratin Protect'-Namen** —
ehrlich dokumentiert, reines Namens-Marketing). benefits abgeleitet. thickness alle abgeleitet.

**BLOCKER (P5, kein Deviation-Fall):** Alle drei Retailer-Texte sagen nur
'**für ein paar Minuten** einwirken lassen' + optional '**über Nacht**' — es existiert
nirgends eine exakte Zeit, Range oder Maximum-Angabe. Die REQUIRED wait-Copy nach §2.5
kann nicht gefüllt werden ('Kurz einwirken lassen.' ist für Masken unzulässig).
Der Manifest-Eintrag trägt contact_time.seconds=null mit dem wörtlichen Quellzitat
(Schema-PASS), aber **T4/T5 darf diesen Stamp nicht publizieren, bevor Nick entschieden
hat** (Optionen: konservative Chaarlie-Setzung als Regel, physische Packung prüfen, oder
Produkt zurückstellen). Die Overnight-Option ist eine optionale Intensivierung derselben
Rinse-out-Anwendung, kein Familienwechsel (anders als beim Night Elixier, das ein
Leave-on war).

**Preisabweichung:** Rossmann 3,99 € (übernommen, Backlog-Retailer) vs. dm/Müller 4,45 €.

---

## 4. Guhl — Haarkur 30_sek Reparatur (100 ml, EAN 4072600720080)

**Quellen:** dm.de Produktseite 1649553 (GTIN, 3,45 €, Verwendungshinweise, INCI,
Produktmerkmale), rossmann.de /p/4072600720080 (EAN-Zweitquelle, Name '30_sek Intensiv Kur
Reparatur' = Backlog-Name, Anwendungstext wortgleich, 3,29 €), guhl.com Produktseite
(Manufacturer: 30 Sekunden, Birnenextrakt + Avocadoöl, ohne Silikone, 97 % natürlich).

**Konfidenz:** EAN solide (dm + Rossmann). contact_time 30 s solide (exakt, dm + Rossmann +
guhl.com deckungsgleich; §2.5-Copy '30 Sekunden einwirken lassen.'). weight light abgeleitet
('schnell wie eine Spülung', leichte Basis, Öl weit hinten, silikonfrei). concentration
medium **geraten/konservativ** ('hochkonzentriert' ist Marketing, Express-Format dagegen —
Präzedenz Gliss 7sec). balance moisture abgeleitet (Glycerin/Panthenol + Feuchtigkeitsclaim;
keine Proteine). repair low solide begründet. benefits solide (dm-Wirkung 'Leichte
Kämmbarkeit' → detangling_slip; 'mehr Geschmeidigkeit' → smoothing). thickness alle
abgeleitet (leicht, silikonfrei; dm nennt u. a. 'Dick' als Haartyp, schließt fein nicht aus).

**Keine Deviation:** 'ins nasse Haar einmassieren' ohne Ansatz-Anweisung, kein
Conditioner-danach. dm-Name 'Haarkur 30_sek Reparatur' übernommen; Rossmann-/Backlog-Name
als Variante dokumentiert.

---

## 5. Pantene Pro-V — Haarkur 1 Minute Wunder-Ampulle Rescue Shots Repair & Care (15 ml, EAN 4084500390089) — **REBRAND-VERDACHT**

**Quellen:** dm.de Produktseite 1383345 (GTIN, 1,95 €, Verwendungshinweise, INCI),
rossmann.de /p/4084500390089 (EAN-Zweitquelle; identische INCI + identischer
Anwendungstext, 1,99 €).

**Konfidenz:** EAN solide (dm + Rossmann, identische Formel). contact_time 60 s solide
(exakt; Kadenz '1-2x wöchentlich' notiert — V1 hat keinen Kadenz-Slot). weight medium
abgeleitet/konservativ (Bis-Aminopropyl Dimethicone Pos. 2 — Präzedenz Herbal Essences).
concentration high abgeleitet (Single-Use-Ampulle, 'hochkonzentriert', Wochenkadenz).
balance balanced abgeleitet (Repair-Positionierung ohne Proteine, ohne Moisture-Fokus).
repair low solide begründet ('repariert Haarschäden von 6 Monaten' ist unbelegtes
P&G-Marketing auf einer Amino-Silikon-Formel). benefits shine solide (dm-Wirkung 'Glanz').
thickness alle abgeleitet (Serum-Textur, 15-ml-Dosisdeckel).

**REBRAND-VERDACHT (Entscheidung an Nick):** Rossmann listet dieselbe EAN als
'**Serum Shot mit Collagen Peptiden**' — mit **identischer INCI und identischem
Anwendungstext**. Auch das aktuelle dm-Packshot (beide dm-Galeriebilder) zeigt bereits die
'Serum Shot'-Aufmachung ('mit Collagen Peptiden / Aprikosen Öl / Vitamin B7'), während der
dm-Listingname noch 'Rescue Shots' lautet. Kollagen/Aprikosenöl/B7 stehen NICHT in der
Retailer-INCI — entweder Verpackungs-Marketing oder die Retailer-INCI hinkt einer
Reformulierung hinterher. Konsequenzen:
- Manifest-Name = dm-Listingname (Backlog-Retailer), candidate_image = aktuelles Packshot
  (Serum-Shot-Design) → Name und Bild divergieren bewusst; vor Apply entscheiden, ob auf
  den neuen Namen umgestellt wird.
- Authority-Facts sind auf die (übereinstimmende) Retailer-INCI gesourct; falls eine
  Reformulierung bestätigt wird, Zeile neu prüfen (physische Packung).

---

## 6. Garnier Fructis — Haarmaske Keratin Sleek, Anti-Frizz Kur (370 ml, EAN 3600542638951)

**Quellen:** dm.de Produktseite 3042310 (GTIN, 5,95 €, Verwendungshinweise, INCI),
rossmann.de /p/3600542638951 (EAN-Zweitquelle, 5,99 €, Anwendungstext inhaltsgleich),
garnier.de Produktseite (Manufacturer: Anwendung mit Zeitangabe).

**Konfidenz:** EAN solide (dm + Rossmann). contact_time solide, aber **nur von der
Herstellerseite**: garnier.de sagt 'einige Minuten (**zirka 3-5**) einwirken lassen' =
Range → seconds=null (§2.5-Copy '3–5 Minuten einwirken lassen.'); dm und Rossmann sagen nur
'mehrere Minuten' (keine Zahl). Die Herstellerseite ist hier die präziseste verfügbare
Quelle; kein Widerspruch zwischen den Quellen. weight medium abgeleitet/konservativ
(Öle + Sheabutter im Mittelfeld vs. silikonfrei/kein Rich-Claim — Präzedenz Banana Hair
Food). concentration medium abgeleitet (bezifferter 13%-Komplex, aber 3-Tage-Effekt ist
kein semi-permanenter Laminierungseffekt — Konsistenz mit Hydra Hyaluronic, Abgrenzung zum
Glycolic-Gloss-High). balance protein solide begründet (3 hydrolysierte Proteine +
Keratin-Positionierung). repair medium abgeleitet (Protein-Trio mit Stärkungs-Claim —
Präzedenz Gliss 7sec; high wäre nicht gedeckt). benefits smoothing+shine solide.
thickness normal/coarse abgeleitet/konservativ (Emollient-Last).

**Keine Deviation:** Routine-Kontext (Keratin-Sleek-Shampoo davor, Serum danach) ist
Cross-Selling; das Serum ist ein Post-Rinse-Leave-in, KEINE conditioner_after-Sequenz.
Platzierungsanweisung fehlt auf allen Quellen → Template-Platzierung lengths_ends
wird regulär gestampt (Schweigen ist keine Deviation).

---

## 7. Wahre Schätze — Haarkur 1-Minute Traube (340 ml, EAN 3600542656191)

**Quellen:** dm.de Produktseite 3115711 (GTIN, 4,95 €, Verwendungshinweise, INCI),
rossmann.de /p/3600542656191 (EAN-Zweitquelle, 4,99 €, als 'Garnier Wahre Schätze'),
garnier.de Traube-Hydraboost-Produktseite (Manufacturer, Anwendung deckungsgleich).

**Konfidenz:** EAN solide (dm + Rossmann). contact_time solide: 'für **etwa eine Minute**'
(dm + garnier.de deckungsgleich) → als exakte 60 s übernommen (Produktname '1-Minute';
§2.5-Copy '1 Minute einwirken lassen.'). weight medium abgeleitet (cremig-schmelzende
Jar-Maske, Öle im Mittelfeld, keine Butter). concentration medium abgeleitet
(1-Minuten-Express). balance moisture solide begründet (Glycerin Pos. 2, Traubenwasser,
'bis zu 4 Tage Feuchtigkeit'; keine Proteine). repair low solide begründet.
benefits shine abgeleitet ('sofortige Strahlkraft'; bewusst schmal). thickness alle
abgeleitet (leichte Öle ohne Butter, kein Overload-Signal).

**Deviation — GESTRICHEN per R-C:** dm UND garnier.de instruieren '…die
Haarpflegeroutine mit einem passenden **Conditioner abrunden/ergänzen**'
(conditioner-after). Per Ruling R-C wird die Verpackungs-Sequenz **ignoriert**:
deviation=null, die Standard-Regel replaces_conditioner (P5) wird unverändert gestampt;
der Verpackungstext bleibt als product_source dokumentiert (Präzedenz IDA WARG, Pilot).

**Anmerkung:** dm-Badge 'Vegan' koexistiert mit Amodimethicone in der INCI (kein
'Ohne Silikone'-Claim bei dieser Variante — anders als Honig Schätze). silicones-Flag gesetzt.

---

## 8. Wahre Schätze — Haarkur 1-Minute Honig Schätze (340 ml, EAN 3600542509428)

**Quellen:** dm.de Produktseite 1679237 (GTIN, 4,95 €, Verwendungshinweise, INCI),
rossmann.de /p/3600542509428 (EAN-Zweitquelle, 4,99 €), garnier.de Honig-Schätze-Produktseite
(Manufacturer, Anwendung deckungsgleich: 1 Minute).

**Konfidenz:** EAN solide (dm + Rossmann). contact_time 60 s solide (exakt, dm +
garnier.de deckungsgleich). weight medium **abgeleitet/konservativ** (Sheabutter Pos. 7 vs.
Claim 'schwereloses Haargefühl/ohne zu beschweren' — gemischte Evidenz, Mitte).
concentration medium abgeleitet. balance balanced **abgeleitet** (Repair-Claims ohne
Proteine, kein beworbener Feuchtigkeitsfokus — weder Protein- noch Moisture-Schwerpunkt;
reviewbar, moisture wäre die Alternative wegen Honig/Glycerin). repair low solide begründet
(keine Protein-/Bond-Aktivstoffe; Honig/Wachs-Marketing). benefits smoothing abgeleitet.
thickness normal/coarse **abgeleitet/konservativ** — Sheabutter-Formel; der Gegen-Claim
'ohne zu beschweren' ist dokumentiert, Entscheidung reviewbar (Präzedenz Banana Hair Food).

**Keine Deviation:** exakte 1-Minuten-Angabe, kein Conditioner-danach ('danach wie gewohnt
föhnen und stylen'), keine Ansatz-Anweisung.

**Anmerkung (Claim/INCI-Abweichung):** dm-Beschreibung und garnier.de bewerben
'Bienenwachs', die dm-INCI enthält aber **kein Cera Alba** — nur Mel/Honey + Honey Extract.
Flags entsprechend nur aus der INCI gesetzt; nicht vegan (Honig), 'Ohne Silikone'-Badge
von dm bestätigt die INCI.

---

## 9. Pantene Pro-V — Haarkur Hydration SOS, Hair Shake (150 ml, EAN 8006540497401) — **R-A-FLAG: KEIN MASK, NICHT IM MANIFEST**

**Evidenz (dm.de Produktseite 1631800, GTIN-Feld 'GTIN: 8006540497401', mod-10 valide):**
- Produktbeschreibung: "**Leave-in-Spray**, das sofort Feuchtigkeit spendet" / "Der Pantene
  Pro-V Haarpflegespray Hydration SOS Hair Shake **ohne Ausspülen** […] Perfekt für feines
  Haar, ohne zu beschweren."
- Verwendungshinweise: "Anwendung: Gut schütteln und **auf trockenes Haar sprühen.
  Nicht ausspülen.**"
- INCI-Basis: Aqua, Isododecane, Isopropyl Alcohol, Panthenol, … (Sprüh-Leichtformel,
  silikon- und sulfatfrei laut dm-Badges).

**Verdikt:** Dreifacher Strukturbruch zur Rinse-out-Maskenfamilie (Leave-on statt
Rinse-out, trockenes statt nasses Haar, Spray statt Kur) — die dm-Shelf-Kategorie
'Haarkur & Haarmaske' ist per R-A nur eine erste Vermutung und hier falsch. **Kein
TPL-MASK-Stamp; nicht ins Mask-Manifest aufgenommen.** Empfehlung: als `leave_in`
(TPL-LEAVEIN-DRYCARE-Kandidat — explizite Dry-Hair-Positionierung) in einen
Leave-in-Wave einplanen; EAN + INCI + Anwendungstext sind hier dokumentiert und
wiederverwendbar. (Nur dm als Quelle erfasst; EAN-Zweitquelle wäre für den
Leave-in-Wave nachzuholen.)

---

## 10. John Frieda — Tägliche Wunderkur Sofort Pflegespray (200 ml, EAN 5037156298819) — **R-A-FLAG: KEIN MASK, NICHT IM MANIFEST**

**Evidenz (rossmann.de /p/5037156298819, JSON-LD sku '5037156298819', 9,99 €, mod-10 valide;
dm führt dieselbe EAN als 'Sprühkur Frizz Ease Tägliche Wunderkur, 200 ml' → Ziffern
mehrquellig bestätigt):**
- Anwendung und Gebrauch: "Großzügig auf das gesamte gewaschene, handtuchtrockene Haar
  sprühen und dabei auf die Haarspitzen konzentrieren, wo das Haar am trockensten ist.
  **Nicht ausspülen.** Wie gewohnt stylen."
- INCI-Basis: Aqua, Glycerin, Amodimethicone, …, Ceramide NP/AP/EOP (Leave-on-Sprühkur).

**Verdikt:** Leave-on-Spray nach der Wäsche — strukturell ein **Leave-in**
(TPL-LEAVEIN-DAMP-Kandidat: gewaschenes, handtuchtrockenes Haar, nicht ausspülen), keine
Rinse-out-Maske. Die Rossmann-Shelf-Kategorie 'Haarkur' ist per R-A überstimmt. **Kein
TPL-MASK-Stamp; nicht ins Mask-Manifest aufgenommen.** EAN, INCI und Anwendungstext hier
dokumentiert und für einen Leave-in-Wave wiederverwendbar.

---

## Querschnitts-Notizen

- **Validator:** `npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/wave2-mask-manifest.json`
  → **PASS**, 8/8 Produkte, 0 deviation-flagged, 0 excluded EANs, 0 Duplikate (Erstlauf).
- **EAN-Stand:** Alle 8 Manifest-EANs selbst erfasst (Backlog trug keine): 6× dm-GTIN-Feld
  + Rossmann-Bestätigung, 1× Rossmann + dm + Müller (Pantene MB), 1× Rossmann + dm
  (John Frieda Kur). Die 2 R-A-geflaggten Produkte tragen ebenfalls verifizierte EANs
  (in den Notes, nicht im Manifest). Alle 10 mod-10-geprüft.
- **T4/T5-Blocker:** Pantene Moisture BOOST (§3) — keine §2.5-fähige Zeitangabe auf
  keiner Quelle; Stamp erst nach Nicks Entscheidung publizieren. Alle anderen 7 tragen
  eine gesourcte exakte Zeit (30 s / 60 s / 180 s) oder Range (3–5 min ×2).
- **R-C-Anwendungen dieses Waves:** 1× conditioner-after ignoriert (WS Traube, von dm UND
  Hersteller instruiert); Cross-Selling-Verweise (Serien-Shampoo davor, Serum danach) bei
  John Frieda / Pantene / Fructis als Nicht-Deviations behandelt. 0 offene Deviations.
- **Rebrand-Risiko:** Pantene Rescue Shots → 'Serum Shot mit Collagen Peptiden' (§5);
  Namensentscheidung vor Apply an Nick.
- **Ehrlichkeits-Flags in den Daten:** 'Keratin Protect' (Pantene MB) und 'Rescue/Repair'
  (Rescue Shots, Guhl, Honig Schätze) haben KEINE Protein-/Bond-Aktivstoffe in der INCI →
  repair_support_level=low, Marketing nicht in Facts übersetzt. Keratin Sleek ist die
  einzige echte Protein-Maske des Waves (3 Hydrolysate → balance protein, repair medium).
- **`concentration` bleibt das dünnste Feld** (bekannt aus dem Pilot): außer den
  bezifferten Komplexen (13 % bei Hydra + Keratin Sleek) gibt es keine öffentliche
  Konzentrations-Evidenz; Formatlogik (Express vs. Ampulle vs. Wochenkur) trägt die
  Urteile — als abgeleitet/geraten markiert.
- **Wackeligste Urteile (Review-Prioritäten für Nick):** JF Wunder-Kur weight=rich
  (vs. medium), Honig Schätze balance=balanced (vs. moisture) und thickness-Ausschluss
  von fein bei JF/Keratin Sleek/Honig (Butter-/Silikon-Konservatismus vs. 'beschwert
  nicht'-Claims).
- **Evidenz-Hygiene:** Alle 45 Evidence-Zeilen tragen wörtliche `source_text`-Zitate,
  live von der jeweiligen `source_url` transkribiert (dm 'Verwendungshinweise'/GTIN-Feld/
  INCI-Kopf/Preis, Rossmann 'Anwendung und Gebrauch'/JSON-LD, Hersteller-Claim-Passagen);
  `[…]` markiert Auslassungen zwischen wörtlichen Passagen derselben Seite. Keine
  Influencer-/Foren-/Affiliate-Quellen verwendet. incibeauty.com war Cloudflare-gesperrt
  (Bot-Challenge nicht umgangen) und wurde in diesem Wave nicht als Quelle genutzt.

## Bildquellen (Qualitätsbar geprüft)

Bar: Frontal-Packshot der Retail-Verpackung allein, kürzere Achse ≥ 800 px, Retailer-Quelle
mit Seiten-URL, keine Infografiken/Vorher-Nachher/Textur-Aufnahmen. Jedes Kandidatenbild
wurde heruntergeladen, mit `sips` vermessen und visuell geprüft (Read-Tool).

| Produkt | Quelle/Asset | Maße | Prüfnotiz |
| --- | --- | --- | --- |
| Elvital Hydra | dm `474537a9` (h_3000,w_3000) | 3000×2944 | Frontal, sauber. Das ERSTE dm-Galeriebild (`324cdc2e`) zeigt einen Textur-Smear hinter dem Tiegel → bewusst das zweite Asset gewählt. |
| JF Wunder-Kur | Rossmann `MAM_53683564` (width=2000) | 2000×2000 | Frontal-Tiegel, sauber. |
| Pantene MB | Rossmann `MAM_18544833` (width=2000) | 2000×2000 | Frontal-Tiegel, sauber. |
| Guhl 30_sek | dm `8be2d033` (h_3000,w_3000) | 980×3000 | Frontal-Tube, sauber. |
| Rescue Shots | dm `da1cc6e5` (h_3000,w_3000) | 1093×3000 | Frontal-Ampulle, sauber — zeigt das AKTUELLE 'Serum Shot'-Design (siehe §5 Rebrand). |
| Keratin Sleek | dm `d8fc86da` (h_3000,w_3000) | 3000×2541 | Frontal-Tiegel, sauber. |
| WS Traube | dm `513ce4aa` (h_3000,w_3000) | 2931×3000 | Frontal-Tiegel, sauber. |
| WS Honig | dm `d8d6a0a6` (h_3000,w_3000) | 2986×3000 | Frontal-Tiegel, sauber. |

Alle 8 über der Qualitätsbar (kürzere Achse ≥ 800 px; dm-CDN-Transform `h_3000,w_3000`
skaliert dieselbe Cloudinary-Quelle proportional hoch, Rossmann `width=2000`-Parameter
wie im Pilot).
