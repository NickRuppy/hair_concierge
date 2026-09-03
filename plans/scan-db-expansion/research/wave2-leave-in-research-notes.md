# Leave-In Wave-2 Research Notes (Backlog Top 10, T2-konform)

> **STATUS: RESEARCH-ENTWURF zur Review durch Nick — keine freigegebenen Daten.**
> Erstellt 2026-09-03 vom Research-Agenten. Alle Authority-Felder sind Urteile aus
> INCI + Claims + Anwendungstexten; Konfidenz pro Feld ehrlich markiert
> (solide / abgeleitet / geraten). Manifest: `wave2-leave-in-manifest.json`
> (Validator: **PASS 10/10**, 1 excluded EAN, 0 Deviations, 0 Duplikate).
>
> Rulings angewandt (Autorität: `plans/scan-db-expansion/protocol-templates.md`
> §"Nick's pilot-review rulings"): **R-A** (Kategorie per Research finalisiert),
> **R-B** (EAN ≥2 unabhängige Quellen, sonst excluded_from_apply), **R-C**
> (Deviations NUR bei strukturellem Kategorien-Mismatch; Anwendungsstil-Differenzen
> werden ignoriert und hier dokumentiert), **R-D** (DRYCARE-Default: spray/serum ×
> light/medium bzw. lotion×light; Cremes damp-only außer bei explizitem
> Dry-/Between-Wash-Marketing), **R-E** (Hersteller-/Retailer-Beschreibungs-Claim
> reicht für Hitzeschutz).

Konfidenz-Legende: **solide** = direkt gesourct (Packungstext, GTIN-Feld, INCI),
**abgeleitet** = Urteil aus INCI/Claims mit klarer Begründung, **geraten** = Setzung
mangels Evidenz, konservativ gewählt.

Template-Stamps im Überblick: TPL-LEAVEIN-DAMP für alle zehn; TPL-LEAVEIN-DRYCARE
für 5 Produkte (2× R-D-Format-Default Spray/Serum, 1× Serum-Default, 2× explizites
Between-Wash-Marketing); TPL-LEAVEIN-HEAT für 6 Produkte (alle per R-E
claim-gedeckt, `usable_on_dry_hair` pro Produkt recherchiert). `post_style_finish`
bleibt geparkt — **kein** Produkt dieses Batches ist post-style-only positioniert.

---

## EAN-Kapitel (Auftrag a): Erhebung + Cross-Source-Verifikation

Alle 10 EANs waren im Draft offen und wurden selbst erhoben (dm-GTIN-Feld auf der
Produktseite), alle mod-10-valide. Zweitbelege unabhängig (anderer Händler bzw.
Produktdatenbank, die die EAN sichtbar anzeigt):

| # | Produkt | EAN | dm-Quelle | Unabhängiger Zweitbeleg | Status |
|---|---------|-----|-----------|-------------------------|--------|
| 1 | Pantene Bond Repair Haarcreme | 8700216637374 | GTIN-Feld (Art. 3057700) | tangerins.com Produktseite: „GTIN: 8700216637374" | verified |
| 2 | Garnier Locken Methode Air Dry | 3600542657044 | GTIN-Feld (Art. 3115736) | rossmann.de: GTIN in URL `/p/3600542657044` + `"sku":"3600542657044"`; zusätzlich budni.de | verified |
| 3 | HE Leave-In Spray Kamille | 8700216631792 | GTIN-Feld (Art. 3045337) | ohfeliz.com: „EAN: 8700216631792", 145 ml | verified |
| 4 | HE Leave-In Spray Blütensanft | 8700216631761 | GTIN-Feld (Art. 3045328) | ohfeliz.co.uk: „EAN: 8700216631761", 145 ml | verified |
| 5 | Balea Prof. Leave-In Serum Plex Care | 4070765006322 | GTIN-Feld (Art. 1674699) | **KEINER gefunden** (dm-Eigenmarke; Drittshops zeigen keine EAN) | **excluded_from_apply=true** |
| 6 | Dejan Garz Leave-In Cream | 4270004570120 | GTIN-Feld (Art. 3063678) | hagel-shop.de: „EAN 4270004570120" (GPSR: New Flag GmbH) | verified |
| 7 | Dejan Garz Leave-In Serum | 4270004570137 | GTIN-Feld (Art. 3062977) | hagel-shop.de: „EAN 4270004570137" | verified |
| 8 | Balea Prof. Leave-In Haarmaske Molecular | 4066447910148 | GTIN-Feld (Art. 3106685) | mynetfair.com: „… mit der EAN: 4066447910148"; zusätzlich eBay.de-Listing | verified |
| 9 | Jean&Len Peptide Intense Repair | 4262500780288 | GTIN-Feld (Art. 3086348) | fresh-store.eu: „EAN: 4262500780288", 100 ml | verified |
| 10 | Wahre Schätze Leave-In Haarkur Avocado | 3600542639200 | GTIN-Feld (Art. 2976366) | budni.de-Produktseite zeigt 3600542639200 in der Produktbeschreibung (identische INCI, Marke WAHRE SCHÄTZE) | verified |

**Nebenbefund Balea Plex Care (Produkt 5):** incibeauty.com und weareeves.com
verweisen für dasselbe Produkt auf die ÄLTERE GTIN **4066447220476**
(weareeves verlinkt die dm-Alt-URL `…-p4066447220476.html`) — mutmaßlicher
Relaunch mit neuer EAN (dm-GS1-Kreis 4070765 statt 4066447). Die Alt-EAN wurde
NICHT als Identifier aufgenommen (Formulierungsgleichheit unbelegt, F-09 wäre nur
mit Beleg zulässig). Wenn Nick einen physischen Scan macht, löst das beide Fragen.
incibeauty war zudem Cloudflare-geschützt (nicht umgangen).

Keine EAN wurde erfunden; alle Werte stammen wörtlich aus dem dm-GTIN-Feld.

---

## Kategorie-Sanity (Auftrag b, R-A): die zwei „Leave-In Haarmasken"

**Beide sind echte Leave-on-Produkte — Kategorie `leave_in` ist KORREKT, keine
Re-Kategorisierung nötig:**

- **Balea Professional Leave-In Haarmaske Molecular Care:** dm-Beschreibung
  „Kein Ausspülen erforderlich … Besonders praktisch ist die Anwendung ohne
  Ausspülen"; Anwendung „Nicht ausspülen. Nach 4 Minuten Einwirkzeit wie gewohnt
  stylen oder lufttrocknen lassen." → Leave-on mit Einwirk-Beat, kein Rinse-out.
- **Jean&Len Leave-In Haarmaske Peptide Intense Repair:** Anwendung „4 Minuten
  einwirken lassen, nicht ausspülen. Danach wie gewohnt trocknen und stylen." →
  Leave-on, tritt an die Stelle des Conditioners („keinen Conditioner verwenden").
- (Auch die Wahre-Schätze-„Haarkur" ist leave-on: „muss nicht ausgespült werden".)

Konsequenz: kein struktureller R-C-Fall, `deviation: null` überall. Die
4-Minuten-Einwirkzeiten sind Anwendungsstil-Differenzen zum wait-losen
DAMP-Template und werden per R-C ignoriert (im Protokoll-Quelltext dokumentiert;
`contact_time` ist schema-seitig ohnehin nur für TPL-MASK zulässig).

---

## 1. Pantene Pro-V — Miracles Molecular Bond Repair Wunder Haarcreme, Leave-In (90 ml, EAN 8700216637374)

**Quellen:** dm.de Produktseite 3057700 (GTIN, 9,95 €, Beschreibung, Merkmale
„Wirkung: Anti-Spliss, Pflege, Glanz", INCI, Verwendung), tangerins.com (EAN-Zweitbeleg).

**Konfidenz:** EAN solide (mehrquellig). Anwendung solide (wörtlich). format cream
solide (Name + „regenerierende Creme"). **weight medium abgeleitet** (Conditioning-
Creme mit Fettalkoholen/Silikon-Quat, kein Light-Claim auf der dm-Seite — Reviews
sagen „beschwert nicht", sind aber keine zulässige Quelle). care_direction balanced
abgeleitet. **repair_support_level medium abgeleitet — Kernurteil:** dedizierte
Bond-Repair-Linie („molekulare Reparatur der Haarbindungen", „über 3.000 Pro-V
Nutri-Perlen"), aber KEINE Protein-/Bond-Aktivstoffe in der INCI; Spiegelbild der
Elvital-Bond-Repair-Einstufung im Pilot. benefits repair+shine solide. thickness
alle abgeleitet. Flags: silicones solide (Silicone Quaternium-26, Methicone);
Triglycerid-/Ester-Emollients bewusst nicht als oils geflaggt.

**Heat (R-E):** dm-Beschreibung „Zudem schützt die Creme das Haar vor Hitzeschäden"
→ provides_heat_protection=true, keine Temperatur → max_c=null. usable_on_dry_hair=true
(„Als letzten Schritt auf trockenem oder nassem Haar verwenden" → either_state nach P9).

**Grenzfall für Nick (DRYCARE):** cream → damp-only per R-D. Die Packung erlaubt
aber explizit „auf trockenem … Haar" + „Zur täglichen Anwendung geeignet". Ich habe
das als Toleranz (kein Between-Wash-Marketing) gewertet → KEIN DRYCARE-Stamp.
Wenn Nick die Dry-Erlaubnis als Marketing liest, käme DRYCARE dazu.

**Kein post_style_finish-Fall:** „Als letzten Schritt" ist Routine-Position der
Pflege (Care-Creme), kein After-Styling-Finish — dokumentiert, nicht geflaggt.

---

## 2. Garnier Fructis — Leave-In Creme Locken Methode Air Dry (260 ml, EAN 3600542657044)

**Quellen:** dm.de Produktseite 3115736 (GTIN, 5,95 €, Beschreibung, INCI,
Verwendung, Merkmale „Vegan, Ohne Silikone, Haartyp: Lockiges Haar"), rossmann.de
(EAN-Zweitbeleg via URL + sku-Feld).

**Konfidenz:** EAN solide (mehrquellig). Anwendung solide. format cream solide.
weight light solide begründet („Die leichte Textur", „ohne die Locken zu
beschweren" — wörtlich). care_direction moisture solide (7%-Feuchtigkeits-Komplex).
repair low solide. benefits moisture+curl_definition+anti_frizz solide (100h-Claim).
roles extension_conditioner+styling_prep abgeleitet (dm-Wirkung „Styling", dritter
Routine-Schritt). thickness alle abgeleitet (Nicht-Beschweren-Claim).

**Kein Heat:** Packung sagt sogar explizit „Hitze ist für die Wirksamkeit der Air
Dry Cream nicht nötig" → provides_heat_protection=false, kein Heat-Stamp.

**R-D:** cream → damp-only, „feucht oder trocken" ist Toleranz → kein DRYCARE
(deckungsgleich mit Garnier Aloe Air Dry im Pilot-Batch).

---

## 3. + 4. Herbal Essences — Leave-In Spray Kamille / Blütensanft Rosenduft (je 145 ml)

**Quellen:** dm.de Produktseiten 3045337 / 3045328 (GTIN, je 5,95 €, Beschreibung,
Merkmale „Produkteigenschaften: Hitzeschutz", INCI, Verwendung wortgleich),
ohfeliz.com/.co.uk (EAN-Zweitbelege mit „EAN:"-Feld und 145 ml).

**Konfidenz:** EANs solide (mehrquellig). Anwendung solide (wortgleich: „Gleichmäßig
auf das feuchte oder trockene Haar sprühen und durchkämmen. Kein Ausspülen
erforderlich."). format spray solide. weight light solide begründet (wässrige Basis,
internationaler Name „Weightless All In 1" bei Amazon als Stütze — sekundär, nicht
als Quelle im Manifest). care_direction balanced abgeleitet (Glanz/Anti-Frizz/
Entwirren ohne Feuchtigkeits-/Proteinfokus). repair low solide. benefits
anti_frizz+shine+detangling solide (Kernclaims). thickness alle abgeleitet.
Beide Produkte sind INCI-seitig nahezu identisch (Amodimethicone-Basis), nur der
Duft-/Extraktanteil unterscheidet sich.

**Heat (R-E):** dm-Beschreibung „schützt sie auch vor Hitze" / „gleichzeitig vor
Hitze schützt" + Merkmal „Hitzeschutz" → true, keine Temperatur. usable_on_dry_hair=true
(„feucht oder trocken" → either_state nach P9).

**R-D:** spray ∧ light → DRYCARE-Default greift; Trockenhaar-Erlaubnis wörtlich
gesourct. Stamps: DAMP + DRYCARE + HEAT (je 3 Protokolle).

**Hinweis Rosenduft:** Der Draft nennt zusätzlich Rossmann als Händler; das
Rossmann-Listing wurde nicht separat erhoben (ohfeliz deckt den Zweitbeleg).

---

## 5. Balea Professional — Leave-In Serum Plex Care (50 ml, EAN 4070765006322 — EXCLUDED)

**Quellen:** dm.de Produktseite 1674699 (GTIN, 2,75 €, Beschreibung, Merkmale
„Wirkung: Glättung, Anti-Spliss; Haartyp: Chemisch behandelt, Geschädigt", INCI,
Verwendung). Kein unabhängiger EAN-Zweitbeleg (siehe EAN-Kapitel) → **einziges
excluded-Produkt dieses Batches.**

**Konfidenz:** EAN-Wert solide (dm-GTIN-Feld), Verifikation UNVOLLSTÄNDIG per R-B.
Anwendung solide („Das Serum in das handtuchtrockene oder trockene Haar
einmassieren." — kompletter Verwendungstext, sehr knapp). format serum solide.
**weight medium abgeleitet/konservativ** (Fettalkohol-/Castoröl-Basis, kein
Light-Claim; R-D-Default bleibt mit medium erfüllt). care_direction protein solide
begründet (3-fach Protein-Komplex beworben UND Keratin/Erbsen-/Gemüse-/Seidenprotein
+ Aminosäuren prominent in der INCI — klarster Protein-Fall des Batches).
repair medium abgeleitet („Lücken auffüllen" ist Film-Chemie, kein Bond-Builder —
high nicht evidenzgedeckt). benefits repair+protein solide. thickness alle abgeleitet.

**Kein Heat:** dm-Seite nennt keinerlei Hitzeschutz (explizit geprüft). Ein
„220 °C"-Schnipsel in Suchtreffern stammt aus einem Amazon-Set-Listing MIT separatem
Hitzeschutz-Balm bzw. war nicht verifizierbar — nicht übernommen (Falle dokumentiert).

**R-D:** serum ∧ medium → DRYCARE-Default; Trockenhaar-Erlaubnis wörtlich gesourct.

---

## 6. Dejan Garz — Leave-In Cream The Foundation (100 ml, EAN 4270004570120)

**Quellen:** dm.de Produktseite 3063678 (GTIN, 9,95 €, Beschreibung, Merkmale
„Textur: Creme; Haartyp: Alle Haartypen", INCI, Verwendung), hagel-shop.de
(EAN-Zweitbeleg + GPSR-Hersteller New Flag GmbH).

**Konfidenz:** EAN solide (mehrquellig). Anwendung solide. format cream solide
(dm-Merkmal). **weight medium abgeleitet — Grenzfall:** dm nennt sie „reichhaltige
Pflege", der Hersteller-Shop „das reichhaltigste Produkt der Serie"; zugleich
„ohne das Haar zu beschweren" und dm-Haartyp „Alle Haartypen", 1–2 Pumpstöße.
Ich habe medium gesetzt; wenn Nick „rich" ruled, fällt thickness=fine und die
DRYCARE-Frage bleibt trotzdem offen (Marketing-Qualifier, s. u.). care_direction
moisture solide. repair low solide begründet („Schutz vor Spliss durch Versiegelung"
ist präventives Sealing, kein Repair → split_ends bewusst NICHT als Concern).
benefits moisture+anti_frizz+detangling solide. Flags silicones+oils+humectants solide.

**Kein Heat:** kein Claim auf dm- oder Hagel-Seite.

**R-D:** cream wäre damp-only, aber **explizites Between-Wash-Marketing** greift:
„Sie eignet sich auch sehr gut als Overnight Produkt oder als intensive Pflege für
zwischendurch" (wörtlich) → DRYCARE zusätzlich gestampt. **Overnight-Hinweis:**
Zusatzpositionierung, KEIN Kategorien-Mismatch (kein Rinse-out, keine
Overnight-Maske als Hauptanwendung) — deshalb kein R-C-Flag; dokumentiert.

---

## 7. Dejan Garz — Leave-In Serum The Foundation (100 ml, EAN 4270004570137)

**Quellen:** dm.de Produktseite 3062977 (GTIN, 9,95 €, Beschreibung, Merkmale
„Textur: Gel", INCI, Verwendung), hagel-shop.de (EAN-Zweitbeleg).

**Konfidenz:** EAN solide (mehrquellig). Anwendung solide. **format serum
abgeleitet:** dm-Merkmal sagt „Textur: Gel" — das Format-Enum kennt kein gel;
serum (Produktname, wässrige Gel-Serum-Basis, Pumpspender) ist die ehrlichste
Zuordnung. Falls das Enum je gel bekommt, umhängen. weight light solide begründet
(„Schwerelose Pflege", „sehr leichte Pflege für zwischendurch" — wörtlich).
care_direction moisture solide. repair low solide (nur präventive Versiegelung).
benefits moisture+anti_frizz solide. fit care_benefits detangle_smooth
**geraten/erzwungen** (Fit-Enum kennt keinen Feuchtigkeitswert; „glattes Finish"/
„Griffigkeit" als nächstliegende Zuordnung — schwächstes Feld dieses Produkts).
Flags: silicones+polymers+humectants solide; PEG-40 Hydrogenated Castor Oil ist
Solubilizer, bewusst NICHT oils.

**Kein Heat.** **R-D:** DRYCARE doppelt gedeckt (serum ∧ light UND „für
zwischendurch"-Marketing).

---

## 8. Balea Professional — Leave-In Haarmaske Molecular Care (50 ml, EAN 4066447910148)

**Quellen:** dm.de Produktseite 3106685 (GTIN, 2,95 €, Beschreibung, Merkmale
„Vegan, Ohne Alkohol, Ohne Ammoniak, **Hitzeschutz**", INCI, Verwendung),
mynetfair (EAN-Zweitbeleg; Produktdaten-Verzeichnis, vermutlich GS1-gespeist —
als unabhängige Organisation gewertet, eBay.de-Listing als Drittstütze).

**R-A-Urteil:** echtes Leave-on (siehe Kategorie-Sanity oben) — leave_in korrekt.

**Konfidenz:** EAN solide (mehrquellig). Anwendung solide (wörtlich, inkl.
„je nach Haardicke und -länge"-Dosierung). format cream abgeleitet (Pump-Creme,
Enum kennt kein mask). weight medium abgeleitet (Intensivpflege + Sparsam-Gebot).
**care_direction protein abgeleitet:** Repair-/Stärkungs-Positionierung für
poröses Haar PLUS echte Proteine/Peptide in der INCI (Hydrolyzed Wheat Protein,
Avena Sativa Peptide, Arginine) und kein Feuchtigkeits-Kernclaim; balanced wäre
die Alternativlesart, wenn Nick die Proteine als zu weit hinten wertet.
repair medium abgeleitet („Multi-Layer-Repair" unbelegte Herstellerterminologie).
benefits repair+shine solide. Flags silicones+oils+proteins+polymers solide.

**Heat (R-E):** dm-Produktmerkmal „Hitzeschutz" → true, keine Temperatur.
usable_on_dry_hair=false (Anwendung nennt AUSSCHLIESSLICH handtuchtrockenes Haar
→ pre_heat_damp nach P9). application_stage bewusst OHNE dry_hair.

**R-C dokumentiert:** „Nach 4 Minuten Einwirkzeit" ist Anwendungsstil-Differenz
zum wait-losen DAMP-Template → ignoriert, Quelltext trägt die Passage.
**R-D:** cream → damp-only, kein Dry-Marketing → kein DRYCARE.

---

## 9. Jean&Len — Leave-In Haarmaske Peptide Intense Repair (100 ml, EAN 4262500780288)

**Quellen:** dm.de Produktseite 3086348 (GTIN, 5,25 €, Beschreibung inkl.
„Hitzeschutz bis 230 °C", Merkmale, INCI, Verwendung), fresh-store.eu
(EAN-Zweitbeleg), vivavoss.com (Drittstütze).

**R-A-Urteil:** echtes Leave-on (siehe Kategorie-Sanity) — leave_in korrekt.

**Konfidenz:** EAN solide (mehrquellig). Anwendung solide (wörtlich).
format cream abgeleitet (Maskentextur, Enum kennt kein mask). weight medium
abgeleitet. **roles replacement_conditioner solide — Besonderheit dieses
Produkts:** Packung sagt wörtlich „Haare shampoonieren, keinen Conditioner
verwenden" → fit conditioner_relationship=replacement_capable (stärkster
Replacement-Beleg im gesamten Leave-in-Bestand). care_direction protein solide
begründet (Peptid-Claims + drei Hydrolyzed Proteins + Peptide in der INCI).
repair medium abgeleitet („rekonstruiert" ohne verifizierte Bond-Chemie; high
nicht evidenzgedeckt). benefits repair+anti_frizz+shine+moisture solide (dm-Wirkung
nennt alle vier; moisture der schwächste). Flags proteins+humectants+polymers
solide; silikonfrei (Merkmal + INCI).

**Heat (R-E):** „Der integrierte Hitzeschutz bis 230 °C …" → true, max_c=230
(einer von zwei bezifferten Heat-Claims des Batches). usable_on_dry_hair=false
(Anwendung an den Waschtag gebunden, nur handtuchtrocken → pre_heat_damp).

**R-C dokumentiert (2 Punkte, beide ignoriert, kein Deviation-Record):**
1. „4 Minuten einwirken lassen" vor dem Trocknen (Anwendungsstil).
2. Kadenz-Empfehlung „bei den ersten 4 Haarwäschen hintereinander, danach bei
   jeder 4. Haarwäsche" — V1 hat keinen Kadenz-Slot; als Quelltext dokumentiert.

**R-D:** cream → damp-only; kein Dry-/Between-Wash-Marketing → kein DRYCARE.

---

## 10. Wahre Schätze — Leave-In Haarkur Avocado (200 ml, EAN 3600542639200)

**Quellen:** dm.de Produktseite 2976366 (GTIN, 2,95 €, Beschreibung inkl.
„Hitzeschutz bis zu 230°C", Merkmale „Ohne Silikone; Haartyp: Trockenes Haar,
Lockiges Haar", INCI, Verwendung), budni.de (EAN-Zweitbeleg mit identischer INCI).

**Konfidenz:** EAN solide (mehrquellig; GS1-Präfix 3600542 = L'Oréal/Garnier-Kreis,
plausibel — Wahre Schätze ist eine Garnier-Linie). Anwendung solide. format cream
solide (Verwendungstext nennt es „Intensiv Pflegende Leave-In-Creme"; „Haarkur"
ist Marketing — Leave-on bestätigt, kein R-A-Fall). **weight medium abgeleitet:**
Öl-+Shea-Butter-Creme (INCI-Basis baugleich zur Garnier-Locken-Creme), aber OHNE
deren Light-/Nicht-Beschweren-Claims auf dieser Seite; „kleine Menge"-Dosierung
spricht gegen rich. care_direction moisture solide. repair low solide. benefits
moisture+anti_frizz+curl_definition solide.

**Heat (R-E):** „Hitzeschutz bis zu 230°C" (Bullet + Beschreibung) → true,
max_c=230. usable_on_dry_hair=true („täglich auf trockenem oder nassem Haar" →
either_state nach P9).

**Grenzfall für Nick (thickness):** normal+coarse gesetzt, fine ausgeschlossen —
Öl-/Butter-Creme, positioniert für „sehr trockenes, welliges und lockiges Haar",
kein Nicht-Beschweren-Claim. Wenn Nick der Garnier-Baugleichheit (dort light,
alle Stärken) mehr Gewicht gibt, wäre fine vertretbar.

**Grenzfall für Nick (DRYCARE):** cream → damp-only per R-D; „kann täglich auf
trockenem … Haar angewendet werden" habe ich als Toleranz-/Frequenz-Erlaubnis
gewertet, nicht als Between-Wash-Marketing → kein DRYCARE-Stamp. Gleiche
Lesart-Frage wie bei Pantene (§1) — eine Entscheidung deckt beide.

---

## Querschnittsfragen an Nick

1. **DRYCARE-Lesart „auf trockenem Haar anwendbar" bei Cremes (§1 Pantene, §10
   Wahre Schätze):** Ich habe Usage-Toleranz ≠ Dry-Use-Marketing gewertet (beide
   damp-only). Bestätigen oder kippen — eine Regel deckt beide Fälle.
2. **Balea Plex Care EAN (§5):** einziges excluded-Produkt. Physischer Scan bei dm
   würde 4070765006322 verifizieren UND die Alt-EAN-Frage (4066447220476) klären.
3. **care_direction protein für Balea Molecular Care (§8):** protein vs. balanced —
   Proteine stehen mittig/hinten in der INCI; ich habe protein gesetzt (Claims +
   Aktivstoffe), balanced wäre die konservativere Lesart.
4. **Dejan Garz Cream weight (§6):** medium gesetzt trotz „reichhaltigstes Produkt
   der Serie" (Hersteller-Shop) — dm sagt „Alle Haartypen" + „ohne zu beschweren".
   Bei rich-Ruling: fine raus.
5. **Taxonomie-Loch Glanz:** unverändert kein Concern-Code für Glanz/Stumpfheit
   (HE-Sprays, Pantene) — bekanntes Loch aus dem Pilot, bewusst schmal gehalten.

## Validator-Ergebnis (2026-09-03)

```
Products (10): 10× PASS
Existing-product updates (0)
Deviation-flagged products (0)
Excluded EANs (1): products[4] Balea Professional Leave-In Serum Plex Care: 4070765006322
Summary: products 10/10 passed · deviation-flagged 0 · excluded EANs 1 · duplicate EANs 0 · overall: PASS
```

## Methodik-Receipts

- Alle dm-Fakten wurden live von den dm-Produktseiten erhoben (Browser, 2026-09-03);
  jede Evidence-Zeile trägt ein wörtliches `source_text`-Zitat aus der genannten URL.
- EAN-Zweitbelege wurden auf der jeweiligen Drittseite wörtlich verifiziert
  (EAN-Feld sichtbar im Seitentext), nicht aus Suchtreffer-Titeln übernommen.
- Mod-10 aller 10 EANs per Skript geprüft: alle valide.
- candidate_image: jeweils erstes dm-PDP-Bild (Front-Packshot; für Pantene visuell
  verifiziert) über den dm-CDN mit `c_fit,h_3600,w_3600`; für die drei schmalen
  Packshots (Pantene 796px, HE-Sprays 772/776px kurze Achse bei 3600) wurde
  `h_4000,w_4000` gesetzt, damit die kurze Achse ≥800px liegt (Pantene 884px,
  HE ~858px). Alle 10 Bildmaße per Skript geprüft.
- Cookie-Banner: nicht-essenzielle Cookies abgelehnt bzw. nicht interagiert;
  Cloudflare-Challenge (incibeauty) nicht umgangen.
