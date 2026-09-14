# Oil Wave-2 Research Notes (Backlog Top 10, T2-konform)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-03 vom Research-Agenten. Manifest: `wave2-oil-manifest.json`
> (Validator: **PASS, 8/8 Produkte, 1 deviation-flagged, 2 excluded EANs, 0 Duplikate**).
> Alle Evidence-Zeilen tragen wörtliche `source_text`-Zitate, live von der jeweiligen
> `source_url` transkribiert (dm: Seitentext/JSON-LD; Rossmann: Seitentext/Syndigo-
> Produktdaten; Hersteller: Claim-Passagen). Regelbasis: `protocol-templates.md`
> Rev. 2 inkl. Rulings R-A…R-E; Vorbild: `oil-manifest.json` (Pilot).

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

**Die 10 Backlog-Produkte wurden zu 8 Manifest-Einträgen:**

- **Pantene Rang 145 = Rang 148** (dieselbe EAN 4084500085350 bei Rossmann und dm) → 1 Eintrag.
- **Gliss Hitzeschutz Öl-Spray Oil Nutritive** (Rang 146) → per R-A als
  `heat_protectant` re-kategorisiert und **nicht** ins Oil-Manifest aufgenommen
  (Kategorie außerhalb des Pilot-Template-Umfangs); vollständige Evidenz unten, §9.

---

## 1. Langhaarmädchen — Haaröl Intense Repair (150 ml, EAN 4066447864793, **excluded_from_apply**)

**Quellen:** dm.de Produktseite 1539520 (GTIN-Feld "GTIN: 4066447864793" + JSON-LD, 4,95 €,
Verwendungshinweise, INCI, Produktmerkmale). Kein eigener Marken-Webshop mit Produktdaten
gefunden (dm-Marke).

**Konfidenz:** EAN solide belegt, aber **einquellig** (s. u.). Anwendung solide (wörtlich:
"2-3 Pumphübe … in den feuchten oder trockenen Haarlängen und Spitzen"). role_support solide
(feucht ODER trocken explizit; 230-°C-Hitzeschutz als Beschreibungs-Claim — **per R-E
ausreichend**). usable_on_dry_hair=true solide (either_state per P9). weight light abgeleitet.
subtype styling-oel abgeleitet. purpose light_finish abgeleitet ("glänzendes Finish",
"ohne zu beschweren"). thickness alle abgeleitet. concern **nur frizz** — bewusst schmal:
"Intense Repair" ist Linienname; weder Beschreibung noch Produktmerkmale claimen
geschädigtes Haar (ehrlicher als hair_damage aus dem Namen abzuleiten).

**⚠️ Reformulierungs-Flag (Datenfrische):** dm-Reviews von Ende Aug/Anfang Sep 2026
("Leider eine Neue Formulierung", "scheinbar die Rezeptur geändert … Online ist ebenfalls
noch die alte Version beschrieben") melden einen frischen Rezeptur-Wechsel. Externe
INCI-Datenbanken (Hautschutzengel, INCI Beauty) führen noch die ALTE Cyclopentasiloxane-
geführte INCI; die dm-Seite zeigt inzwischen die NEUE (Dimethicone/Isododecane-geführt) —
diese wurde encodiert. Restrisiko: dm-Beschreibungstexte (230-°C-Claim) könnten noch zur
alten Version gehören, falls dm die Beschreibung nicht synchron aktualisiert hat.

**EAN einquellig → excluded (R-B):** 4066447864793 nur via dm (GTIN-Feld + JSON-LD).
INCI Beauty listet das Produkt unter den ÄLTEREN EANs 4058172702075 und 4066447241679
(Generationswechsel), Amazon/eBay zeigen keine verifizierbare EAN-Ziffernfolge.
cross_source_agreement=false, excluded_from_apply=true bis Zweitquelle oder physischer Scan.

---

## 2. Dejan Garz — Haaröl Violet Hair Oil The Britney (50 ml, EAN 4063528101808)

**Quellen:** dm.de Produktseite 3110122 (JSON-LD, 8,95 €, Verwendungshinweise, INCI),
rossmann.de Produktseite /p/4063528101808 (7,99 €, wortgleiche Anwendung + INCI, live
reproduziert), zusätzlich budni.de-Listing (Suche).

**Konfidenz:** EAN solide, **zweifach retailer-belegt** (dm + Rossmann, identische
Produktdaten) → cross_source_agreement=true. Anwendung solide (wörtlich; dm = Rossmann).
role_support solide: "trockenen oder handtuchtrockenen Haarlängen" trägt dry_finish +
leave_on; Hitzeschutz als Beschreibungs-Claim ("Mit Hitzeschutz", Silikonkomplex
"kann das Haar vor Stylinghitze schützen") — per R-E gestampt, **ohne Temperaturangabe**
(Copy bleibt °C-frei, Template-Regel beachtet). usable_on_dry_hair=true solide.
weight light abgeleitet. subtype styling-oel **solide** (Beschreibung wörtlich:
"silikonbasierte Formel"). purpose null bewusst. concern frizz + hair_damage solide
("blondiertes oder strapaziertes Haar").

**Nebenbefunde:** Violettes Pigment (CI 60725) mit "ohne Farbstich"-Claim — Anti-Gelbstich-
Optik hat keinen Concern-Code, nur hier dokumentiert. "Bei Bedarf Anwendung wiederholen"
ist App-Stil (R-C: ignoriert). Influencer-Marke (Dejan Garz) — alle Fakten ausschließlich
aus Retailer-Produktdaten, keine Creator-Inhalte verwendet.

---

## 3. Herbal Essences — Haaröl Arganöl Elixir, Tiefenreparatur (95 ml, EAN 8006530075718)

**Quellen:** dm.de Produktseite 3115710 (JSON-LD, 5,95 €, Verwendungshinweise, INCI),
rossmann.de Produktseite /p/8006530075718 (5,49 €, wortgleiche Anwendung + INCI, live
reproduziert), 0815.at-Listing mit derselben EAN (Suche).

**Konfidenz:** EAN solide, mehrfach belegt → true. Anwendung solide (wörtlich, dm = Rossmann:
"Auf nassen oder trockenen Längen und Spitzen auftragen."). role_support solide (2 Rollen,
kein Hitzeschutz-, kein Pre-Wash-Claim — bewusst nicht gestampt). weight light solide
begründet ("Leichte, nicht fettende Formel"). subtype styling-oel abgeleitet
(Cyclopentasiloxane/Dimethiconol-geführt, Arganöl Position 3). purpose null bewusst.
concern hair_damage + repair solide — **mit ehrlicher Einschränkung:** der dm-Text
schränkt "reparieren*" selbst auf "*Oberflächenreparatur für Geschmeidigkeit" ein
(als Evidence-Zeile encodiert; kein Struktur-Repair-Versprechen in unserer Copy).

---

## 4. Balea Professional — Haaröl Plex Care (50 ml, EAN 4066447888218, **excluded_from_apply**)

**Quellen:** dm.de Produktseite 1343983 (JSON-LD, 2,75 €, Verwendungshinweise, INCI).
dm-Eigenmarke, kein Hersteller-Webauftritt.

**Konfidenz:** Anwendung solide (wörtlich: "Sparsam in die feuchten oder trockenen
Haarlängen einarbeiten."). role_support solide (feucht/trocken explizit; "Mit integriertem
Hitzeschutz" als Beschreibungs-Claim — per R-E gestampt, keine Temperaturangabe).
usable_on_dry_hair=true solide. weight light abgeleitet. subtype styling-oel abgeleitet —
die INCI ist praktisch dieselbe Formelfamilie wie das Isana-Professional-Öl aus dem Pilot
(Isododecane, C11-13 Isoalkane, Dimethiconol, Isohexadecane, Sonnenblumenöl …), das dort
styling-oel trägt. purpose null bewusst. concern hair_damage + repair solide.

**EAN einquellig → excluded (R-B):** 4066447888218 nur via dm-JSON-LD. **Generationswechsel-
Indiz:** INCI Beauty UND die von Google indexierte dm-Alt-URL
(`dm.de/balea-professional-haaroel-plex-care-p4066447668292.html`) binden das gleichnamige
Produkt an die Vorgänger-EAN 4066447668292. cross_source_agreement=false,
excluded_from_apply=true bis Zweitquelle oder physischer Scan.

---

## 5. Bali Curls — Haaröl Bonding Oil (30 ml, EAN 4262391990513)

**Quellen:** dm.de Produktseite 3093558 (JSON-LD, 9,95 €, INCI, Verwendungshinweise),
bali-care.com/de-de (Hersteller: Anwendung, deckungsgleiche INCI, Claims/FAQ),
incibeauty.com/en/produit/4262391990513 (Listing exakt unter dieser EAN).

**⚠️ Protokoll-Quelle ist die Herstellerseite:** die dm-"Verwendungshinweise" enthalten
KEINE Grundanwendung, sondern nur einen "Extra Locken-Tipp" (Pre-Poo "auf einzelne
Haarpartien **oder die Kopfhaut**" + "ein paar Tropfen in dein Lieblingsshampoo …
geben"). Die Grundanwendung stammt von bali-care.com: "Erwärme einige Tropfen des Öls
zwischen deinen Handflächen und trage es auf das saubere, nasse oder trockene Haar auf,
um die Spitzen zu versiegeln und Glanz zu verleihen."

**Pre-Wash-Rolle bewusst NICHT gestampt (Frage an Nick):** der Pre-Poo-Tipp wäre formal
pre_wash_fibre_treatment, nennt aber ausdrücklich die **Kopfhaut** — das kollidiert mit
der P8-Platzierung ("Kopfhaut und Ansatz aussparen") und der Repo-Regel, Kopfhaut-Guidance
getrennt zu halten. Das Shampoo-Zumischen ist im Schema ohnehin nicht abbildbar.
Entscheidung für Nick: Pre-Wash-Stamp mit Template-Copy (R-C würde die Kopfhaut-Passage
ignorieren) oder schmal bleiben (aktuell gewählt).

**Konfidenz:** EAN solide-mit-Einschränkung: dm-JSON-LD + INCI-Beauty-Listing exakt unter
dieser EAN ("Bali Curls Curl Bonding Oil - 30 ml") — die INCI-Beauty-Seite selbst war nicht
abrufbar (403), Bindung über indexierten Titel + EAN-URL (**Isana-Präzedenz**;
cross_source_agreement=true gesetzt, Nick kann auf false drehen). Anwendung solide
(wörtlicher Herstellertext). role_support solide (nass oder trocken explizit; kein
Hitzeschutz-Claim). weight light solide begründet. subtype natuerliches-oel
**abgeleitet/geraten**: silikonfrei (styling-oel scheidet aus), Ester-/Volatile-Basis mit
Pflanzenölen, natürliche Positionierung; keine Trockenöl-Vermarktung. **Vokabular-Lücke:**
keine der drei Subtyp-Vokabeln passt sauber auf eine Ester-geführte silikonfreie
Finishing-Formel. purpose light_finish abgeleitet. concern nur frizz (Hersteller-Claim
wörtlich); Glanz/Lockendefinition ohne Code. thickness alle solide ("für Curls, Waves und
alle Haartypen").

---

## 6. Weleda — Haaröl Rosmarin (50 ml, EAN 4001638093620)

**Quellen:** dm.de Produktseite 1342502 (JSON-LD, 11,95 €, Verwendungshinweise, INCI,
Produktmerkmale), rossmann.de Produktseite /p/4001638093620 ("Intensiv pflegendes Haaröl
Rosmarin", 11,99 €, wortgleicher Anwendungssatz, live reproduziert), weleda.de Produktseite
(Manufacturer: Claims, Volldeklaration, 12,95 €), zusätzlich shop-apotheke/eBay-Listings.

**Konfidenz:** EAN solide, mehrfach belegt → true. Anwendung solide (wörtlich: "Vor oder
nach der Haarwäsche einige Tropfen gleichmäßig in die Haarlängen verteilen, ins feuchte
oder trockene Haar."). role_support solide — einziger Wave-2-Kandidat mit Pre-Wash-Rolle;
keine Zeitangabe → **P8-Kanon 15–20 Min greift ohne Deviation** (Schweigen ist keine
Abweichung). weight rich **abgeleitet/konservativ**: reine nicht-flüchtige Pflanzenöl-Basis
(Erdnussöl Position 1), "Intensiv pflegend", Spitzen-Fokus; beim Stamping greift die
ends-Platzierung für rich Öle. subtype natuerliches-oel solide ("rein pflanzliches Haaröl",
Naturkosmetik). purpose null bewusst. concern dryness/hair_damage/breakage solide
(dm-Haartypen + "sprödes und brüchiges Haar" wörtlich).

**Bewusst NICHT encodiert:**
- dm-Produktmerkmal "Wirkung: **Gegen Haarausfall**" — medizinisch angrenzend, kein
  Produkt-Concern in unserem Vokabular, Evidenzlage für Rosmarinöl gegen Haarausfall
  ist zudem schwach/gemischt. Bleibt draußen.
- weleda.de: "eignet sich auch für eine wohltuende **Kopfhaut-Massage**" — Kopfhaut-Guidance
  getrennt; nicht gestampt.

**⚠️ Erdnussöl-Allergen-Hinweis:** Basis ist Arachis Hypogaea (Peanut) Oil. Kosmetisch
raffiniertes Erdnussöl gilt regulatorisch als unkritisch, aber für Erdnussallergiker:innen
ist das eine legitime Sensitivität. Wir haben kein Allergen-Feld im Oil-Schema — falls die
Scan-UI Ingredient-Flags anzeigt, wäre das hier ein Kandidat für einen Hinweis.
Entscheidung bei Nick.

**Diskussionspunkt thickness:** rich Öl für alle Stärken freigegeben (Packung ohne
Einschränkung; weight=rich trägt die Fein-Haar-Vorsicht im Ranking) — konsistent mit der
Pilot-Praxis, aber bei feinem Haar das reichhaltigste Produkt der Wave.

---

## 7. Garnier Fructis — Hitzeschutzspray Wunderöl (150 ml, EAN 3600542020060) — **R-A-FLAG, deviation-flagged**

**Quellen:** dm.de Produktseite 1499834 (JSON-LD, 5,95 €, Verwendungshinweise, INCI),
rossmann.de Produktseite /p/3600542020060 ("Hitzeschutzspray **Anti-Spliss** Wunder-Öl …",
5,99 €, wortgleiche Anwendung + INCI, live reproduziert).

**⚠️ PROMINENTES FLAG — Kategorie-Identität (oil vs. heat_protectant).** Beide Retailer
führen das Produkt namentlich als "Hitzeschutzspray"; der Backlog-Draft nannte es
"heat-protectant oil spray". Die Research-Evidenz spricht dagegen für ein **Multi-Use-Öl**:

- **Anhydrische Öl-INCI** (Isododecane • Dimethicone • Dimethiconol + Oliven-/Sonnenblumen-/
  Kokos-/Avocadoöl + Sheabutter) — gleiche Formelfamilie wie Elvital Öl Magique (Pilot-Öl
  mit 230-°C-Claim) und Gliss Tägliches Öl-Elixier.
- **Tropfen-Applikation in den Handflächen** ("Ein paar Tropfen … in die Handflächen geben"),
  nicht Sprühnebel-Anwendung.
- **Pflege-Rollen explizit**: "Hitzeschutz und Anti-Frizz **Pflege ohne ausspülen**",
  Anwendung "im nassen, feuchten **oder trockenen** Haar … besonders in den Spitzen",
  "trocknet 2 Mal schneller".

Vorgehen (Wahre-Schätze-Präzedenz): als `oil` mit allen drei belegten Rollen encodiert,
**alle 3 Protocol-Stamps tragen die Identitätsfrage als strukturelle Deviation** →
im Validator sichtbar (deviation-flagged: 1). Entscheidung für Nick: oil behalten
(Flag auflösen) oder zu heat_protectant re-kategorisieren (dann raus aus diesem Manifest,
wie Gliss in §9). Zur Einordnung: Garnier führt daneben ein separates "Haaröl Oil Repair
Wunder-Öl" (EAN 3600542020053) — die Existenz des Öl-Geschwisters stützt die
Hitzeschutz-Lesart dieses Produkts; die Multi-Use-Anwendungstexte stützen die Öl-Lesart.
Beides dokumentiert, nichts erzwungen.

**Konfidenz:** EAN solide, zweifach retailer-belegt → true. Anwendung solide (wörtlich,
dm = Rossmann). role_support solide (alle 3 Rollen wörtlich belegt; 230 °C explizit).
usable_on_dry_hair=true solide ("nass, feucht oder trocken"). weight light solide begründet
("schwerelose und nicht fettende Formel"). subtype styling-oel abgeleitet. purpose null
bewusst. concern hair_damage + frizz solide; **split_ends über den Rossmann-Produktnamen**
("Anti-Spliss") — Namens-Claim, als solcher in Evidence markiert; dm-Name führt ihn nicht.
"Zitronenprotein" wird beworben, steht aber nicht in der INCI → kein proteins-Flag.

---

## 8. Pantene Pro-V — Haarkur Glatt & Seidig Arganöl Argan Infused Oil (100 ml, EAN 4084500085350) — **Backlog-Merge 145+148**

**Quellen:** dm.de Produktseite 1523357 (JSON-LD, 4,95 €, Verwendungshinweise, INCI),
rossmann.de Produktseite /p/4084500085350 ("Argan Infused Oil Haaröl", 3,99 €, Anwendung,
identische INCI, live reproduziert).

**Backlog-Duplikat aufgelöst:** Rang 145 ("Pantene Pro-V Argan Infused Oil Haaröl",
Rossmann) und Rang 148 ("Haarkur Glatt & Seidig Arganöl, Argan Infused Oil", dm) sind
**dieselbe SKU** (identische EAN an beiden Retailern) → ein Manifest-Eintrag. Der
dm-Name wurde übernommen (Pilot-Konvention), der Rossmann-Alias ist in Evidence dokumentiert.

**Kategorie-Sanity (R-A, bestanden):** dm nennt es "Haarkur", der Backlog vermerkte schon
"oil-format product despite the 'Haarkur' name". Identitätscheck anhydrisches Öl vs.
Serum-Emulsion (Wahre-Schätze-Präzedenz): INCI ist Cyclopentasiloxane/Dimethiconol-geführt,
**Aqua erst an Position 11**, keine Emulgatoren/Verdicker-Polymere → silikonbasiertes Öl,
KEINE wasserbasierte Emulsion. Kategorie oil bestätigt, kein Deviation-Flag nötig.
(Alcohol Denat. an Position 3 ist als Lösungsvermittler notiert — kein Emulsions-Indiz.)

**Konfidenz:** EAN solide, zweifach retailer-belegt → true. Anwendung solide (dm wörtlich:
"Verteile eine kleine Menge in die Längen des nassen oder trockenen Haars. Nicht
ausspülen"). **Quellen-Nuance:** Rossmann formuliert enger ("Nach der Haarwäsche … mittlere
Längen und Spitzen") — kein Widerspruch; der dm-Packungstext (nass ODER trocken) trägt
beide Stamps, Rossmann korroboriert den Leave-on-Stamp. role_support solide (kein
Hitzeschutz-, kein Pre-Wash-Claim — nicht gestampt). weight light abgeleitet ("Mit nur
einem Tropfen"). subtype styling-oel abgeleitet. purpose null bewusst ("Glatt & Seidig"
ist Linienname). concern frizz/dryness/hair_damage solide (wörtliche Claims).
**Panthenol** (Positionen 6–7) konservativ nicht als humectants geflaggt (Spurenlage,
kein Feuchtigkeits-Kernclaim) — zur Review.

---

## 9. Gliss — Hitzeschutz Öl-Spray Oil Nutritive (150 ml, EAN 4015100813876) — **NICHT im Manifest: heat_protectant (R-A)**

**Quellen:** rossmann.de Produktseite /p/4015100813876 (5,49 €, 150 ml, Produktbeschreibung,
Anwendung, INCI, Syndigo-Produktdaten `"name":"Hitzeschutz Öl-Spray Oil Nutritive",
"sku":"4015100813876"` live reproduziert). Rossmann-only im Backlog.

**Research-Verdikt: `heat_protectant`, nicht `oil`.** Anders als beim Garnier Wunder-Öl
ist hier die gesamte belegte Anwendung ausschließlich Pre-Heat:

> "Für optimalen Hitzeschutz vor dem Föhnen und Glätten ins handtuchtrockene oder trockene
> Haar sprühen. Sparsam auf die mittleren Längen und Spitzen geben und trocknen. Nicht
> auswaschen! […] Niemals Glätteisen oder Lockenstab bei nassem Haar verwenden. Entzündbar!"

- Positionierung wörtlich: "Hitzeschutz Spray zum Föhnen, Locken und Haare Glätten",
  "schützt vor Temperaturen bis zu 230 °C". Kein Care-Only-Anwendungsfall, kein
  "ohne ausspülen als Pflege", kein Finish-/Leave-on-Framing.
- Format: Sprühapplikation ("sprühen"), nicht Tropfen-in-Handflächen.
- Die INCI ist zwar ein anhydrisches, silikonFREIES Öl (Isododecane, Caprylic/Capric
  Triglyceride, Dicaprylyl Carbonate, Sonnenblumen-/Aprikosenkern-/Marulaöl) — aber
  Funktion/Claims/Anwendung sind eindeutig Single-Purpose-Hitzeschutz.

Öl-Care-Rollen (leave_on/dry_finish) wären hier **erzwungene Specs ohne Beleg** — genau
das verbietet der Auftrag. `heat_protectant` liegt außerhalb des Pilot-/Wave-Template-
Umfangs (Template-Index §4: "Out of scope … heat_protectant"), daher kein Manifest-Eintrag.
**Entscheidung für Nick:** in eine spätere heat_protectant-Wave aufnehmen (das
`product_heat_protectant_specs`-Schema existiert bereits: format=spray,
provides_heat_protection=true). Eine Aufnahme als Oil wäre ohne belegte Oil-Care-Rolle
kategorisch unehrlich.

**EAN-Stand (falls später gebraucht):** 4015100813876 nur einquellig (Rossmann URL +
Syndigo). GS1-Präfix 4015100 = Henkel/Schwarzkopf (identisch mit dem Pilot-Gliss-Öl
4015100813791 — Plausibilität, kein Beleg). Mod-10 geprüft: gültig. Bei Aufnahme:
excluded_from_apply bis Zweitquelle. Packshot-Kandidat: Rossmann MAM_12764125
(`?width=2000&height=2000`-Parameter analog Pilot-Rezept, nicht vermessen, da nicht
im Manifest).

---

## Querschnitts-Notizen

### Validator (Pflichtlauf)

```
npm run products:intake:expansion:validate -- --manifest plans/scan-db-expansion/research/wave2-oil-manifest.json
→ PASS: products 8/8 passed, deviation-flagged: 1 (Garnier, alle 3 Stamps),
  excluded EANs: 2 (Langhaarmädchen, Balea), duplicate EANs: 0.
```

### EAN-Tabelle (R-B: ≥2 unabhängige Quellen = verified)

| Produkt | EAN | Quellen | Status |
| --- | --- | --- | --- |
| Langhaarmädchen Intense Repair | 4066447864793 | nur dm (GTIN-Feld + JSON-LD); externe DBs führen Alt-EANs (Reformulierung) | **excluded** |
| Dejan Garz The Britney | 4063528101808 | dm + Rossmann (live) + budni | verified |
| Herbal Essences Arganöl Elixir | 8006530075718 | dm + Rossmann (live) + 0815.at | verified |
| Balea Plex Care | 4066447888218 | nur dm; INCI Beauty + dm-Alt-URL führen Vorgänger-EAN 4066447668292 | **excluded** |
| Bali Curls Bonding Oil | 4262391990513 | dm + INCI-Beauty-Listing (Titel/URL-Bindung, Seite 403 — Isana-Präzedenz) | verified (mit Einschränkung) |
| Weleda Haaröl Rosmarin | 4001638093620 | dm + Rossmann (live) + shop-apotheke | verified |
| Garnier Wunder-Öl | 3600542020060 | dm + Rossmann (live) | verified |
| Pantene Argan Infused Oil | 4084500085350 | dm + Rossmann (live); Merge 145+148 | verified |
| (Gliss Öl-Spray, nicht im Manifest) | 4015100813876 | nur Rossmann | einquellig |

Alle EANs GS1-mod-10-geprüft (Validator + eigene Prüfung); keine erfunden — jede stammt
aus einem live abgerufenen GTIN-/JSON-LD-/URL-Feld.

### Kategorie-Sanity (R-A) — 4 Entscheidungen

1. **Gliss Öl-Spray → heat_protectant, ausgeschlossen** (§9). Einzige Anwendung ist Pre-Heat.
2. **Garnier Wunder-Öl → oil mit Identitäts-Deviation auf allen 3 Stamps** (§7).
   Multi-Use-Evidenz vs. "Hitzeschutzspray"-Naming; Entscheidung bei Nick.
3. **Pantene "Haarkur" → oil bestätigt** (§8). Anhydrisch-Check bestanden (Aqua Pos. 11,
   keine Emulgatoren) — kein Wahre-Schätze-Fall.
4. **Serum-Emulsions-Check aller 8:** kein Produkt ist wasserbasiert (alle INCIs beginnen
   mit Silikonen, Volatiles, Estern oder Pflanzenöl; nirgends Aqua/Propylene Glycol vorn,
   nirgends Emulgatoren/Verdicker). Kein leave_in-Umzug nötig.

### Subtyp-/Purpose-Konvention

- 6× styling-oel (silikon-/volatile-geführt — konsistent mit Pilot), 2× natuerliches-oel
  (Weleda solide; **Bali Curls geraten** — silikonfreie Ester-Formel passt auf keine der
  drei Vokabeln sauber; gleiche Vokabular-Frage wie im Pilot, jetzt mit konkretem Fall).
- oil_purpose: 2× light_finish (LHM, Bali Curls — abgeleitet), sonst null (bewusst;
  Multi-Use ohne wörtliche Zweckbindung). Purpose-Semantik weiterhin undokumentiert
  (Pilot-Caveat gilt fort); vor Apply gegen die Live-Konvention prüfen.
- Die Katalog-Konvention konnte auch in dieser Session nicht gegengeprüft werden
  (Supabase MCP nicht authentifiziert).

### Heat-Familien (P9) und R-E

- 4 Heat-Stamps (LHM, Dejan Garz, Balea, Garnier) — **alle vier explizit feucht-ODER-
  trocken gesourct → usable_on_dry_hair=true / either_state.** Kein Damp-only-Fall.
- 3 davon (LHM, Dejan Garz, Balea) stützen sich auf **Beschreibungs-Claims (R-E)**,
  nicht auf Packungs-Verwendungshinweise; Garnier hat den 230-°C-Claim zusätzlich in
  der Beschreibung beider Retailer.
- Dejan Garz + Balea: Hitzeschutz OHNE Temperaturangabe → Template-Copy bleibt °C-frei
  (Regel "keine implizierte °C-Grenze" beachtet).

### Pre-Wash (P8)

Nur Weleda gestampt (keine Zeitangabe → 15–20-Min-Kanon, keine Deviation). Bali Curls
Pre-Poo bewusst nicht gestampt (Kopfhaut-Nennung; §5, Frage an Nick). Kokosöl ist bei
LHM (Position 5) und Garnier (Mittelfeld) enthalten, aber nirgends Pre-Wash-gestampt —
der Protein-Sensitivitäts-Caveat des Pre-Wash-Templates ist nicht einschlägig.

### Nicht sourcebar / offen geblieben

- **LHM Reformulierung:** Beschreibungs-Claims (230 °C) könnten der alten Rezeptur
  entstammen; Abgleich mit physischer Packung empfohlen, bevor die EAN freigegeben wird.
- **oil_purpose/oil_subtype:** dünnste Evidenzbasis (wie im Pilot); Bali-Curls-Subtyp ist
  die konkrete Vokabular-Lücke.
- **Weleda:** Erdnussöl-Allergen (kein Schema-Feld), "Gegen Haarausfall"-Attribut bewusst
  draußen, rich-für-fein-Haar-Diskussionspunkt.
- **Pantene:** Panthenol nicht als humectants geflaggt (konservativ) — Review-Punkt.
- **Garnier:** finale Kategorie-Entscheidung (oil vs. heat_protectant) bei Nick;
  split_ends hängt am Rossmann-Namens-Claim.
- **Preise:** dm-Dauerpreise encodiert; Rossmann-Abweichungen notiert (Dejan Garz 7,99,
  HE 5,49, Garnier 5,99, Pantene 3,99, Weleda 11,99). Kein Schema-Feld für Mehrfachpreise.

### Bildkandidaten (alle geprüft: Download + `sips`-Vermessung + Sichtprüfung)

Alle 8 Kandidaten sind frontale Retail-Packshots der Verpackung allein (keine Badges/
Infografik-Kacheln; Weleda zeigt Flasche + Faltschachtel = Standard-Packshot), Quelle
jeweils die dm-Produktseite; kürzere Achse ≥ 800 px:

| Produkt | Transform | Maße |
| --- | --- | --- |
| Langhaarmädchen | h_4000,w_4000 | 969×4000 |
| Dejan Garz | h_3000,w_3000 | 2265×3000 |
| Herbal Essences | h_4000,w_4000 | 994×4000 |
| Balea | h_3000,w_3000 | 1409×3000 |
| Bali Curls | h_3000,w_3000 | 1458×3000 |
| Weleda | h_3000,w_3000 | 2154×3000 |
| Garnier | h_3000,w_3000 | 1302×3000 |
| Pantene | h_4000,w_4000 | 972×4000 |

(LHM/HE/Pantene lagen bei h_3000 unter der 800-px-Bar → per dm-CDN-Transform auf h_4000
angehoben; Pilot-Rezept.)

### Evidenz-Hygiene

Alle Anwendungs- und Claim-Texte sind wörtliche Zitate der Retailer-/Herstellerseiten
(dm "Verwendungshinweise"/"Produktbeschreibung", Rossmann "Anwendung und Gebrauch"/
"Produktbeschreibung und -details", bali-care.com/weleda.de Produktseiten), in dieser
Session live abgerufen (Browser; JSON-LD-Zitate aus dem Seitenquelltext). `[…]` markiert
Auslassungen zwischen wörtlichen Passagen derselben Seite. Keine Influencer-/Foren-/
Amazon-Quellen für Fakten verwendet (dm-Reviews nur als Reformulierungs-Indiz zitiert
und als solches markiert; Amazon/TikTok-Treffer nur zur Quellen-Triage).
