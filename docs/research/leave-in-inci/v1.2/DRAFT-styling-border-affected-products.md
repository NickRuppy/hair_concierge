# Styling-border addendum — affected products (DRAFT)

Status: **DRAFT — not in force; Styling v1.0 lock re-instatement pending the independent review (R12-L); every move of an already-ruled Leave-in product needs owner approval.**
Companion to `DRAFT-styling-border-addendum.md` (this folder); A1–A11 and the remaining §6 open items refer to that file.
Refreshed: 2026-10-14. **Styling v1.0 lock re-instatement pending the independent review (R12-L).** No standard, ledger, research data, catalog or database was changed.

## How this list was built

- **Leave-in:** Node read the 19 products in `data/research/leave-in-inci/v1.1/lab-fixture.json`, checked v1.0 corpus/reference-key and v1.1 overlay records, and reconciled the Styling §4.6/ledger owner destinations. Ten distinct owner-only historic Leave-in rulings are added; EVO's owner row overlaps its corpus record and is counted once.
- **Styling:** Node mapped each lane's opaque ids through its own `id_map` in `data/research/styling-inci/v1.0/r6/cohort.json` (143) and `r7/cohort.json` (69 targeted records). Read `blind-lane-A-r6/results.json`, `blind-lane-B-r6/results.json`, `blind-lane-A-r7/results.json`, `blind-lane-B-r7/results.json`. For each lane separately, r7 replaces r6 by source slug; non-targeted records retain r6. Do not merge the two lanes or treat r7's 69 as the full cohort.
- **Hold predicate:** `boundary_reason` or `reason_code` equals `pending_leave_in_addendum`. Both r6 lanes held 18; both r7 lanes held 15 within their targeted population; the final 143-record merged set is **21**, identical by slug and lean subtype between lanes. R6-Q1 adds John Frieda Unendlich Smooth and the two NEQIs; R4-Q4's Balea Glattspray is already held in r6.
- **Direct scope predicate:** final lane A selects actual committed Styling with `pair_rule: 3.4(ii)`, or (r7's representation without that field) `li_function: no` plus a 3.4(ii) path. Require actual `route: styling` and no hold; a rejected/counterfactual path is not a destination. Both lanes' final subtypes are checked. There are **46**, including already-excluded Alcina Föhn Lotion; part C1 lists the other **45**.
- **Latest-lane re-check (2026-10-14):** this list was re-checked against both lanes r6–r12, replacing targeted records by source slug within each lane. Each latest merged lane still has 143 records and 21 holds; the only destination/subtype/hold change from r6+r7 is Moroccanoil Glättende Creme ⇒ `leave_in` (R8-H), already reflected in part D.
- This is a source-data recount and rule/identity review, **not a new classification run**. Live catalog state was not queried.

| Count (Node, unique products) | Value |
|---|---|
| Historic Leave-in audit universe | **29**: 19 corpus + 10 owner-only; 25 Leave-in-positive, 4 already excluded |
| Already-ruled Leave-in moves | **2 — both NEQI moves ALREADY APPROVED**, R6-Q1, 2026-10-13 |
| Other already-ruled Leave-in moves | **0** |
| Historic audit records staying at their destination | **27**: 23 positive Leave-in rulings + 4 already excluded |
| Held Styling products released on overlay approval | **21**, including those 2 NEQI moves; **19** have no prior Leave-in ruling |
| Other explicit border statuses | **47**: 45 direct scope + 1 Polysilicone-9 + 1 GUHL 3in1 |
| Further border products staying put | **16** (part D) |

The two moves are included in the 21 holds; these are **not additive counts**. Under R12-L, secondary-slot differences are soft and do not block; LOCK-1-S remains in force pending the independent review, with no LOCK-2 issued.

---

## A. Historic Leave-in rulings — moves and products staying put

**Result: only NEQI Ultimate (D3/T15) and NEQI All (R2-Q4) move; both moves are ALREADY APPROVED by the owner under R6-Q1 on 2026-10-13. No other already-ruled Leave-in product would move.** Approval of the overlay and any catalog work remain separate.

### A1. The Leave-in corpus (19 records)

Source of the current status: `data/research/leave-in-inci/v1.1/lab-fixture.json` (`g0.state`; standard v1.1). “Historic catalog enrichment” refers to the Leave-in apply manifests; live state was not queried. The 19 records are 15 `in_category`, 2 `excluded_styling_first`, 2 `excluded_anhydrous`.

| Product | Slug (`productId`) | Current Leave-in status | Outcome under the addendum | Amendments checked / reason | Already ruled ⇒ owner approval |
|---|---|---|---|---|---|
| alverde Leave-In Sprühkur Express 7in1 | `slot-01-alverde-naturkosmetik-leave-in-spruehkur-express-7in1` | `in_category` · historic catalog enrichment | `in_category`, unchanged | A1: care lead (C2 house brand). A2: Helianthus oil r2 above T_LI r9 = real care | yes — no move |
| ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol | `slot-02-isana-professional-leave-in-conditioner-hyaluron-panthenol` | `in_category` · historic catalog enrichment | unchanged | A1: no C1/C2 promise captured ⇒ A1 (d). A2: Cetearyl Alcohol r2 = care | yes — no move |
| Cantu Leave-In Haarkur Repair Creme | `slot-03-cantu-leave-in-haarkur-repair-creme` | `in_category` · historic catalog enrichment | unchanged | A1: repair lead. A2: Canola Oil r2 = care. A8: no wax/lanolin in the list | yes — no move |
| alverde Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan | `slot-04-alverde-naturkosmetik-nutri-care-2-phasen-spruehkur-bio-mandel-bio-argan` | `in_category` | unchanged | A1: no C1/C2 promise. A2: soy oil r2 = care (marker `none_visible`, ordinal read) | yes — no move |
| EVO Head Mistress Cuticle Sealer | `slot-05-evo-head-mistress-cuticle-sealer` | `in_category` · historic catalog enrichment | unchanged | A1: claims C5 only ⇒ (d); main directions towel-dried + blow-dry, so not R1-Q2. A2: Dimethicone r2 = care. Also a Styling-side D6 example (A10) | yes — no move |
| Curlsmith Hydrate & Plump Leave-In | `slot-06-curlsmith-hydrate-plump-leave-in` | `in_category`, HOLD `incidental_film` · historic catalog enrichment | unchanged | **Closest A3 case:** PVP r32 above a vacuous marker r36 + COND high, but sold as „Leave-In" conditioner, not a curl cream ⇒ A3 limb 3 fails; no C1/C2 claims | yes — no move |
| Maria Nila Curlicue Cream | `slot-07-maria-nila-curlicue-cream` | `excluded_styling_first` (T15) | excluded, unchanged | T15 stands (D3); Styling routes it `curl_cream` by the same pair rule | yes — no move |
| Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair | `slot-08-schwarzkopf-gliss-sprueh-conditioner-express-repair-ultimate-repair` | `in_category` · historic catalog enrichment | unchanged | A1: care/combing/heat lead. A2: Dimethicone r3 = care. A7: PQ-16 r9 is not L5 | yes — no move |
| Redken Extreme Anti-Snap Leave-In Treatment | `slot-09-redken-extreme-anti-snap-leave-in-treatment` | `in_category` · historic catalog enrichment | unchanged | A1: strengthening lead. A2: Amodimethicone r4 above the pH-adjuster yardstick (marker r3 implausible, T16); no styling-look promise | yes — no move |
| Olaplex N°.6 Bond Smoother | `slot-10-olaplex-n-6-bond-smoother` | `in_category` · historic catalog enrichment | unchanged | A1: no C1/C2 promise (C3 only) ⇒ (d). A2: Cetearyl Alcohol r2 = care | yes — no move |
| Balea Leichtkämmspray Pure Styling | `slot-11-balea-leichtkaemmspray-pure-styling` | `in_category` | unchanged | A1: name job word „Leichtkämm-" (detangling). A2: Cetrimonium Chloride r4 = care | yes — no move |
| Kevin Murphy Young.Again Oil | `slot-12-kevin-murphy-young-again-oil` | `excluded_anhydrous` | excluded, unchanged | not aqueous; the border amendments do not reach it | yes — no move |
| NEQI Diamond Glass Ultimate Styling Spray | `slot-13-neqi-diamond-glass-ultimate-styling-spray` (Styling slug `neqi-diamond-glass-ultimate-styling-spray`; GTIN 4063528094575) | `in_category`, historical D3/T15; v1.1 balanced/low · historic catalog enrichment | **excluded ⇒ Styling `smoothing_styler`** | A10/A11: R6-Q1 replaces D3; FX-1 r8 means explicit registry override, not the generic no-fixative rule | **MOVE ALREADY APPROVED — owner, R6-Q1, 2026-10-13** |
| L'Oréal Paris Elvital Dream Length No Spliss Milk | `unseen-01-l-or-al-paris-elvital-elvital-dream-length-no-spliss-milk-retailer-listing-name-elvital-leave-in-dream-length` | `in_category` | unchanged | A1: repair lead. A2: Isopropyl Myristate r2 = care | yes — no move |
| L'Oréal Paris Elvital ÖL Magique Veredelndes Haaröl | `unseen-02-l-or-al-paris-elvital-elvital-oel-magique-veredelndes-haaroel-retailer-listing-name-elvital-oel-magique-haaroel` | `excluded_anhydrous` | excluded, unchanged | Oil by D2 on the Styling side too | yes — no move |
| Alcina (Professional) Föhn Lotion | `unseen-03-alcina-professional-foehn-lotion` | `excluded_styling_first` | excluded, state unchanged | A1 (b) also fires (C2 volume promise) — a second basis, same state; Styling `blowdry_lotion` (the 46 direct routes include it, but part C1 excludes this duplicate) | yes — no move |
| Briogeo Superfoods Avocado + Kiwi Mega Moisture 3-in-1 Leave-In Spray | `unseen-04-briogeo-superfoods-avocado-kiwi-mega-moisture-3-in-1-leave-in-spray` | `in_category` | unchanged | A1: no C1/C2 promise (C4). A2: Cetearyl Alcohol r3 = care | yes — no move |
| ISANA PROFESSIONAL Argan Leave-in Conditioner | `unseen-05-isana-professional-rossmann-house-brand-argan-leave-in-conditioner` | `in_category` | unchanged | A1: repair/anti-frizz lead, towel-dry directions (not R1-Q2). A2: castor oil r3 = care | yes — no move |
| amika The Shield Anti-Humidity Spray | `unseen-06-amika-the-shield-anti-humidity-spray-german-retailer-listing-name-the-shield-anti-feuchtigkeits-spray` | `in_category` | unchanged | A1: protection lead (not a volume/hold/texture/shine job); directions „before heat styling", not R1-Q2. A2: sea-buckthorn oil r5 = care. A8: Ceresin r17 sits below the marker r16 | yes — no move |

No corpus record contains an FX-4 member (A5), Polysilicone-9 (A6) or Polyquaternium-69 (node scan of all 19 INCI lists).

### A2. Products ruled Leave-in by owner rulings on the Styling side (10)

Source: Styling v1.0 §4.6 registry and the ledger, under **Styling v1.0 lock re-instatement pending the independent review (R12-L)**. Nine are in the r6 cohort: final lanes retain eight Leave-in destinations and hold NEQI All as `smoothing_styler`; syoss Curl Control remains excluded from the DE cohort (not sold in Germany).

| Product | Slug | Current Leave-in status | Outcome under the addendum | Reason | Owner approval |
|---|---|---|---|---|---|
| cantu Lockencreme Kokos | `cantu-lockencreme-kokos` | Leave-in by ruling (D7 scope, T15); no Leave-in engine record | Leave-in | no fixative ⇒ A3 limb 1 fails | ruled — no move |
| HASK „curls defining cream” (old title Lockencreme Curl Care) | `hask-lockencreme-curl-care` | as above | Leave-in | no fixative; named row overrides mixed care + definition (R4-Q6) | ruled — no move |
| BALI CURLS Lockencreme Hydrating Curl Cream | `bali-curls-hydrating-curl-cream` | as above | Leave-in | no fixative | ruled — no move |
| Balea PROFESSIONAL Definier Spray Traumlocken | `balea-professional-definier-spray-traumlocken` | Leave-in by PH1-10 | Leave-in | oils above T_LI = care ⇒ A2 limb 2 fails | ruled — no move |
| Balea Haarserum Anti-Frizz Glatt & Glossy | `balea-haarserum-anti-frizz-glatt-und-glossy` | Leave-in by R2-Q2 | Leave-in | Behentrimonium Chloride above the yardstick = care | ruled — no move |
| Redken One United All-in-One Multi-Benefit Treatment | `redken-one-united-all-in-one-multi-benefit-treatment` | Leave-in (D6 example) | Leave-in | real care; leave-on first (RG2-20) | ruled — no move |
| GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray | `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` | Leave-in by PH2-1 | Leave-in | smoothing promise ⇒ A1 (a); real care; no fixative ⇒ A4 limb 1 fails | ruled — no move |
| LANGHAARMÄDCHEN Lockenspray Natur Lockenwunder | `langhaarmaedchen-lockenspray-natur-lockenwunder` | Leave-in by PH2-11 (PH1-13) | Leave-in | cationic r4 above the preservative = care | ruled — no move |
| NEQI Diamond Glass Styling Spray All | `neqi-diamond-glass-styling-spray-all` (GTIN 4063528078469) | historical Leave-in by R2-Q4; INCI complete (R2-H4) | **excluded ⇒ Styling `smoothing_styler`** | A11: Polysilicone-29 r7; first preservative r8; other care later; no FX; R6-Q1 replaces R2-Q4 | **MOVE ALREADY APPROVED — owner, R6-Q1, 2026-10-13** |
| syoss Curl Control Hydrating Spray | `syoss-curl-control-hydrating-spray` | Leave-in by PH1-13, identity-blocked (dm.at INCI) | Leave-in once its DE identity clears | the ruling does not lift the identity block | ruled — no move |

---

## B. Held Styling products — released only when the addendum is approved (21)

Final A/B lanes agree on every held destination and lean subtype below. Each is excluded at Leave-in G0 by the mirrored ruling. **Two were already ruled Leave-in (part A); nineteen were not.** Research reads of the old v1.1 G0 letter are not prior product rulings. PH1-16 does not require new individual approval for those nineteen; the overlay must still be approved to release the held profiles. Live catalog categories are unverified (O-11).

| # | Brand + confirmed product name | Source slug | Final A / B | Amendment | Prior Leave-in ruling / release evidence |
|---|---|---|---|---|---|
| 1 | alverde NATURKOSMETIK Locken Refresh-Spray | `alverde-locken-refresh-spray` | held `refresher` / held `refresher` (r7) | A2 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 2 | Balea Glattspray Anti-Frizz | `balea-glattspray-anti-frizz` | held `smoothing_styler` / held `smoothing_styler` (r6) | A4 | No prior Leave-in ruling; R4-Q4 includes thin care |
| 3 | Balea Leave-In Spray Sea Salt Care & Define | `balea-leave-in-spray-sea-salt-care-define` | held `salt_spray` / held `salt_spray` (r6) | A2 + A10 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 4 | Balea Locken Crunchgel | `balea-locken-crunchgel` | held `gel` / held `gel` (r7) | A2 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 5 | Balea Locken Revitalizing Spray | `balea-locken-revitalizing-spray` | held `refresher` / held `refresher` (r7) | A2 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 6 | Balea PROFESSIONAL Styling Cream Traumlocken | `balea-professional-styling-cream-traumlocken` | held `curl_cream` / held `curl_cream` (r7) | A3 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 7 | BALI CURLS Haargel Strong Hold Flaxseed | `bali-curls-strong-hold-flaxseed-gel` | held `gel` / held `gel` (r7) | A10 | No prior Leave-in ruling; registry wins over direct 3.4(ii) letter (R4-Q5) |
| 8 | BALI CURLS Volumizing Curl Spray | `bali-curls-volumizing-curl-spray-refreshing` | held `refresher` / held `refresher` (r7) | A2 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 9 | cantu SHEA BUTTER COMEBACK CURL NEXT DAY CURL REVITALIZER | `cantu-lockenspray-comeback-curl-next-day` | held `refresher` / held `refresher` (r7) | A2 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 10 | COLOR WOW Dream Coat Supernatural Spray | `color-wow-dream-coat-supernatural-spray` | held `smoothing_styler` / held `smoothing_styler` (r7) | A10 | No prior Leave-in ruling; D2 owner route; C3 promise override, no evidence block lifted |
| 11 | John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) | `john-frieda-frizz-ease-traumlocken-lockencreme` | held `curl_cream` / held `curl_cream` (r7) | A10 | No prior Leave-in ruling; D7 registry wins despite uncorroborated acrylates (R4-Q5) |
| 12 | John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray | `john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` | held `smoothing_styler` / held `smoothing_styler` (r7) | A11 | No prior Leave-in ruling; R6-Q1 smoothing film |
| 13 | Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) | `kevin-murphy-killer-curls` | held `curl_cream` / held `curl_cream` (r6) | A10 | No prior Leave-in ruling; registry wins over direct 3.4(ii) letter (R4-Q5) |
| 14 | KMS Thermashape Straightening Creme | `kms-thermashape-straightening-creme` | held `smoothing_styler` / held `smoothing_styler` (r6) | A4 | No prior Leave-in ruling; R3-Q4/R3-H4(e), vacuous T_LI does not block |
| 15 | L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt | `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | held `smoothing_styler` / held `smoothing_styler` (r6) | A10 | No prior Leave-in ruling; PH1-14/R3-H3; brand-article directions frozen |
| 16 | NEQI Diamond Glass Styling Spray All | `neqi-diamond-glass-styling-spray-all` | held `smoothing_styler` / held `smoothing_styler` (r7) | A10 + A11 | **Leave-in move ALREADY APPROVED**, R6-Q1, 2026-10-13 |
| 17 | NEQI Diamond Glass Ultimate Styling Spray | `neqi-diamond-glass-ultimate-styling-spray` | held `smoothing_styler` / held `smoothing_styler` (r7) | A10 + A11 | **Leave-in move ALREADY APPROVED**, R6-Q1, 2026-10-13 |
| 18 | Redken Refreshing Curl Mist | `redken-refreshing-curl-mist` | held `refresher` / held `refresher` (r7) | A2 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 19 | Schwarzkopf taft Styling Balm LOCKEN Halt 3 | `schwarzkopf-taft-styling-balm-locken-halt-3` | held `curl_cream` / held `curl_cream` (r7) | A3 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 20 | Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) | `wella-eimi-nutricurls-curl-shaper` | held `curl_cream` / held `curl_cream` (r7) | A3 | No prior Leave-in ruling; held under PH1-16/PH2-2 |
| 21 | Wella Professionals EIMI Flowing Form (Smooth Flowing Form) Glättungscreme / Anti-Frizz Smoothing Balm | `wella-professionals-eimi-flowing-form` | held `smoothing_styler` / held `smoothing_styler` (r6) | A4 | No prior Leave-in ruling; R3-H2 withdraws earlier review outcome |

By lean subtype (Node): `smoothing_styler` 8 · `curl_cream` 5 · `refresher` 5 · `gel` 2 · `salt_spray` 1 = **21**.

---

## C. Other explicit border statuses — destinations stay put (47)

### C1. Outside Leave-in's function scope — A1 / PH2-1 (45)

These already-committed Styling products remain at their final subtype and become explicitly excluded at Leave-in G0 under A1. No prior Leave-in ruling was found. The 46th direct route, Alcina Föhn Lotion, is already excluded and appears only in A1 above. Ordinary 3.4(ii) and 3.5 routes are never held (R4-Q6); named §4.1(d) rows are handled in part B.

| Brand + confirmed product name | Source slug | Final A / B subtype |
|---|---|---|
| ALCINA Ansatz Volumen Spray Aerosol | `alcina-ansatz-volumen-spray-aerosol` | `blowdry_lotion` / `blowdry_lotion` |
| ALCINA Styling Mousse Aerosol | `alcina-styling-mousse-aerosol` | `mousse` / `mousse` |
| alverde NATURKOSMETIK Beach Waves Spray Seaside Balance | `alverde-beach-waves-spray-seaside-balance` | `salt_spray` / `salt_spray` |
| American Crew FIBER | `american-crew-fiber` | `molding` / `molding` |
| Balea Ansatzvolumen Booster | `balea-ansatzvolumen-booster` | `mousse` / `mousse` |
| Balea Föhnlotion Volume Effect | `balea-foehnlotion-volume-effect` | `blowdry_lotion` / `blowdry_lotion` |
| Balea Haargel Hair Jelly (Styling Hair Jelly) | `balea-haargel-hair-jelly` | `gel` / `gel` |
| Balea Haarpuder Volumen (Pomegranate) | `balea-haarpuder-volumen-pomegranate` | `hair_powder` / `hair_powder` |
| Balea Styling Glow Wax | `balea-haarwachs-glow-wax` | `molding` / `molding` |
| Balea MEN Styling Powder | `balea-men-styling-powder` | `hair_powder` / `hair_powder` |
| Balea Sea Salt Texture Spray | `balea-sea-salt-texture-spray` | `salt_spray` / `salt_spray` |
| Balea Styling Creme Power Flex (Forming Cream Power Flex) | `balea-styling-creme-power-flex` | `gel` / `gel` |
| Balea Fixierungsbürste Styling Finishing Stick | `balea-styling-finishing-stick` | `shine_finish` / `shine_finish` |
| Balea Styling Spray Ultra Volumen | `balea-styling-spray-ultra-volumen` | `blowdry_lotion` / `blowdry_lotion` |
| Bali Curls Sleek Stick Brows & Edges | `bali-curls-sleek-stick-brows-and-edges` | `gel` / `gel` |
| BALI GENTS VOLUMIZING STYLING POWDER | `bali-gents-haarpuder-volumizing-styling-powder` | `hair_powder` / `hair_powder` |
| BALI GENTS Matt Paste | `bali-gents-matt-paste` | `molding` / `molding` |
| BALI GENTS Sea Salt Spray | `bali-gents-sea-salt-spray` | `salt_spray` / `salt_spray` |
| Bumble and bumble brilliantine | `bumble-and-bumble-brilliantine` | `shine_finish` / `shine_finish` |
| Gard Haarspray extrastark (Pumpspray, ohne Treibgas) | `gard-haarspray-extrastark-pumpspray` | `hairspray` / `hairspray` |
| got2b Kleber 4 Brows & Edges 2in1 Stylinggel | `got2b-kleber-4-brows-and-edges-2in1-stylinggel` | `gel` / `gel` |
| got2b (Schwarzkopf) Styling Mattpaste Strand Matte | `got2b-styling-mattpaste-strand-matte` | `molding` / `molding` |
| got2b (Schwarzkopf) Styling Paste iStyler Texture Clay | `got2b-styling-paste-istyler-texture-clay` | `molding` / `molding` |
| got2b Styling Puder Volumen Powderfull | `got2b-styling-puder-volumen-powderfull` | `hair_powder` / `hair_powder` |
| GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) | `guhl-foehn-spray-langzeit-volumen` | `blowdry_lotion` / `blowdry_lotion` |
| Jean&Len Sea Salt Spray | `jean-und-len-sea-salt-spray` | `salt_spray` / `salt_spray` |
| John Frieda Frizz Ease Zauberformel Seiden-Finish Creme | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | `shine_finish` / `shine_finish` |
| L'Oréal Men Expert Barber Club Styling Pomade Bart & Haar mit ätherischem Zedernholzöl | `loreal-men-expert-barber-club-styling-pomade` | `molding` / `molding` |
| Moroccanoil Root Boost | `moroccanoil-root-boost` | `blowdry_lotion` / `blowdry_lotion` |
| Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) | `moroccanoil-textur-und-volumenpuder` | `hair_powder` / `hair_powder` |
| Moroccanoil Volumizing Spray (Volumizing Mist) | `moroccanoil-volumizing-spray` | `blowdry_lotion` / `blowdry_lotion` |
| NIVEA MEN Styling Cream Active | `nivea-men-styling-cream-active-craft-stylers` | `molding` / `molding` |
| Schwarzkopf Professional OSiS Dust It | `osis-dust-it` | `hair_powder` / `hair_powder` |
| Redken Powder Grip (03 Mattifying Hair Powder) | `redken-powder-grip-03` | `hair_powder` / `hair_powder` |
| Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 | `schwarzkopf-taft-foehn-spray-volumen-halt-3` | `blowdry_lotion` / `blowdry_lotion` |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) | `schwarzkopf-taft-gel-wax-glanz-halt-2` | `molding` / `molding` |
| Schwarzkopf taft Haarpuder VOLUMEN | `schwarzkopf-taft-haarpuder-volumen` | `hair_powder` / `hair_powder` |
| Schwarzkopf Taft Haargel MATT WAX Halt 5 | `schwarzkopf-taft-matt-wax-halt-5` | `molding` / `molding` |
| Schwarzkopf taft Haargel POWER Halt 5 | `schwarzkopf-taft-power-haargel-halt-5` | `gel` / `gel` |
| Schwarzkopf taft Schaumfestiger Volumen Halt 4, für feines Haar | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` | `mousse` / `mousse` |
| Syoss Max Hold Wax | `syoss-professional-performance-max-hold-power-wax` | `molding` / `molding` |
| Syoss Schaumfestiger Volume | `syoss-schaumfestiger-volume` | `mousse` / `mousse` |
| Schwarzkopf taft FORMING STYLING PASTE | `taft-styling-paste-forming-halt-5plus` | `molding` / `molding` |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray | `wella-eimi-sugar-lift` | `blowdry_lotion` / `blowdry_lotion` |
| Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) | `wella-eimi-texture-ocean-spritz` | `salt_spray` / `salt_spray` |

R4-Q2: alverde Beach Waves is texture (`salt_spray`), not definition. R4-Q7: Taft Gel Wax Glanz remains molding; got2b Texture Clay's lead hold line supplies the main job. R4-H(3): unknown-position promise lines read in packet order. These text fixes do not create a new hold.

### C2. Polysilicone-9 — A6 (1)

John Frieda Frizz Ease **3-Tage-Glatt Styling-Spray** (`john-frieda-frizz-ease-3-tage-glatt-styling-spray`) remains `provisional_boundary (li_g0_provisional)` in both final lanes: Polysilicone-9 r3 leaves real hold unresolved; review `hair_fixing_silicone_unresolved`. **It is distinct from Unendlich Smooth Salon Blow-Out Spray**, which moves under R6-Q1 in part B. No prior Leave-in ruling was found.

### C3. Care cream with an optional leave-in use — A9 (1)

GUHL **LOCKEN PFLEGE & STYLING 3in1 LOCKENCREME, KUR & SPÜLUNG** (old title Haarkur, Conditioner & Lockencreme Pflege & Styling 3in1; `guhl-locken-pflege-und-styling-3in1`) **stays care in its current category**, as owner-ruled in R2-H2. Its first-named pack use is Spülung; the leave-in curl-cream use is recorded. Leave-in G0 under A9: `excluded_other_form`. Both final Styling lanes retain `provisional_boundary (mixed_promise)` with care/current-category ruling, never a Styling profile. It has no Leave-in engine ruling.

---

## D. Further border products staying put (16)

| Product | Source slug | Final A / B destination | Reason |
|---|---|---|---|
| Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion) | `wella-eimi-smooth-perfect-me` | `leave_in` / same | Effective care; no firing A3/A4/A11 exclusion |
| Balea PROFESSIONAL Haarserum Glow & Shine | `balea-professional-haarserum-glow-und-shine` | `leave_in` / same | R2-Q2 water-based-conditioner-serum exception; “Glow & Shine” line name is not a job |
| Wella Professionals EIMI Nutricurls Fresh Up | `wella-eimi-nutricurls-fresh-up` | `leave_in` / same | PQ-10 above the post-preservative yardstick = care; “Nutricurls” line name never supplies a job |
| got2b Anti-Frizz Lotion Schmusekatze | `got2b-anti-frizz-lotion-schmusekatze` | `leave_in` / same | Effective care; no firing A3/A4/A11 exclusion |
| AUSSIE WORK THAT CURL LEAVE-IN CREAM | `aussie-leave-in-creme-work-that-curl` | `leave_in` / same | R4-Q3: “strong hair” is a result, not a care job; no fixative |
| Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY | `schwarzkopf-professional-osis-curl-retouch` | `leave_in` / same | Effective care; no firing A3/A4/A11 exclusion |
| BALI CURLS Leave-In Spray Curl Defining (Curl Defining Spray) | `bali-curls-leave-in-spray-curl-defining` | `leave_in` / same | Effective care; no firing A3/A4/A11 exclusion |
| Moroccanoil Anti-Frizz Schild-Spray (Frizz Shield Spray) | `moroccanoil-anti-frizz-schild-spray` | `leave_in` / same | Effective care; no firing A3/A4/A11 exclusion |
| Balea Styling Locken Lotion | `balea-styling-locken-lotion` | `leave_in` / same | Effective care; no firing A3/A4/A11 exclusion |
| Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray | `kerastase-curl-manifesto-refresh-absolu` | `leave_in` / same | R4-Q1: one-job C1 refreshing-spray name supplies promise; care keeps Leave-in |
| syoss KERATIN Heat HITZESCHUTZ-SPRAY | `syoss-hitzeschutzspray-keratin-heat` | `heat_protectant` / same | Protection-first confirmed name; outside this addendum |
| GUHL LOCKEN PFLEGE & STYLING 2in1 STYLING-SPRAY | `guhl-styling-spray-locken-pflege-und-styling-2in1` | `provisional_boundary (mixed_promise)` / same | Ruled mixed-promise review; current category retained |
| GARNIER FRUCTIS LOCKEN METHODE SHAPE REFRESH STEP 4 FEUCHTIGKEITS-BOOST SPRAY | `garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray` | `provisional_boundary (mixed_promise)` / same | Ruled mixed-promise review; current category retained |
| John Frieda Traumlocken Belebender Wellenauffrischer | `john-frieda-traumlocken-belebender-wellenauffrischer` | `provisional_boundary (mixed_promise)` / same | Ruled mixed-promise review; current category retained |
| Moroccanoil Glättende Creme (Smoothing Lotion) | `moroccanoil-glaettende-creme-smoothing-lotion` | `leave_in` / same | R8-H: „Definition” for „krauses Haar” plus „Ideal für lockiges Haar” is not a curl-definition promise; Leave-in |
| Syoss Glaze Glanz & Schutz Primer | `syoss-glaze-glanz-und-schutz-primer` | `provisional_boundary (mixed_promise)` / same | Ruled mixed-promise review; current category retained |

Wella EIMI Smooth Thermal Image stays Heat Protectant. Syoss Glaze **Topcoat** stays committed `shine_finish` (3.5, R4-Q2), distinct from the mixed Glaze **Primer** above. Balea Finishing Spray Glow & Care and taft x Gliss Silky Shine stay committed `shine_finish`; Barber Club Pomade (C1) and Redken Wax Spray stay committed Styling (R4-Q6). None is released from a Leave-in-addendum hold.

---

## E. Complete Styling-cohort destination check

All **143** source slugs were checked. Four corpus identities use different Styling slugs; this crosswalk accounts for them without duplicate product counts:

| Corpus product in part A1 | Styling source slug | Final Styling A / B destination |
|---|---|---|
| Alcina Föhn Lotion | `alcina-foehn-lotion` | committed `blowdry_lotion` / same; already excluded from Leave-in |
| Maria Nila Curlicue Cream | `maria-nila-curlicue-cream` | committed `curl_cream` / same; already excluded from Leave-in |
| Elvital Öl Magique | `loreal-elvital-haaroel-oel-magique-alle-haartypen` | `oil` / same; already excluded from Leave-in |
| EVO Head Mistress Cuticle Sealer | `evo-head-mistress-cuticle-sealer` | `provisional_boundary (evidence_gate)` / same; owner Leave-in destination recorded, missing directions/promise in this Styling capture still block emission |

 The final set has **21 holds** and **122 without that hold**. Parts A–D name the border-relevant products; the table below lists the remaining cohort products so every unchanged destination is reviewable. Non-Styling routes and evidence/formula/mixed-review blocks are retained, not released by this overlay.

| Remaining product | Source slug | Final A / B destination |
|---|---|---|
| American Crew Styling Pomade | `american-crew-pomade` | provisional_boundary (evidence_gate) / provisional_boundary (evidence_gate) |
| Balea Finishing Spray Glow & Care | `balea-finishing-spray-glow-und-care` | styling shine_finish / styling shine_finish |
| Balea Styling WAX STICK | `balea-haarwachs-styling-stick` | styling molding / styling molding |
| Balea MEN Pomade Haar & Bart 2in1 | `balea-men-pomade-haar-bart-2in1` | styling molding / styling molding |
| Balea Overnight Wellenspray | `balea-overnight-wellenspray` | styling gel / styling gel |
| Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray | `balea-professional-glow-und-shine-finishing-spray` | styling shine_finish / styling shine_finish |
| Balea Styling Spray Volumenpuder Pure Styling | `balea-pure-styling-volumenpuder-spray` | styling texture_spray / styling texture_spray |
| Batiste TROCKENSHAMPOO ALL IN ONE fruchtig frischer Duft | `batiste-trockenshampoo-all-in-one` | dry_shampoo / dry_shampoo |
| Bumble and bumble Surf Spray | `bumble-and-bumble-surf-spray` | provisional_boundary (evidence_gate) / provisional_boundary (evidence_gate) |
| Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel | `cantu-shea-butter-extra-hold-edge-stay-gel` | provisional_boundary (formula_conflict) / provisional_boundary (formula_conflict) |
| feschi smooth & shine Anti Frizz Spray (Glanzspray) | `feschi-smooth-and-shine-anti-frizz-spray-glanzspray` | provisional_boundary (evidence_gate) / provisional_boundary (evidence_gate) |
| GARNIER FRUCTIS SLEEK & STAY HEAT-ACTIVATED SERUM | `garnier-fructis-sleek-and-stay-heat-activated-serum` | oil / oil |
| got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | `got2b-gotgloss-glanz-spray` | styling shine_finish / styling shine_finish |
| got2b Schutz-engel Hitzeschutz Spray | `got2b-hitzeschutzspray-schutzengel` | heat_protectant / heat_protectant |
| got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) | `got2b-lockenspray-refresher-curlz` | styling refresher / styling refresher |
| got2b SPRÜH KLEBER Freeze Haarlack | `got2b-spruehkleber-freeze-haarlack` | styling hairspray / styling hairspray |
| got2b Trocken SHAMPOO Extra Volumen | `got2b-trockenshampoo-extra-volumen` | dry_shampoo / dry_shampoo |
| ISANA PROFESSIONAL Styling Creme Locken Traum | `isana-professional-styling-creme-locken-traum` | provisional_boundary (evidence_gate) / provisional_boundary (evidence_gate) |
| John Frieda Frizz Ease DER BÄNDIGER EXTRA STRONG SERUM | `john-frieda-haarserum-frizz-ease-der-baendiger` | oil / oil |
| John Frieda Volume Lift Ansatz-Booster | `john-frieda-volume-lift-ansatz-booster` | provisional_boundary (formula_conflict) / provisional_boundary (formula_conflict) |
| John Frieda Spray Volume Lift Pushed-up Dry Texture | `john-frieda-volume-lift-pushed-up-dry-texture-spray` | styling texture_spray / styling texture_spray |
| Kevin.Murphy Powder.Puff Volume | `kevin-murphy-powder-puff-volume` | provisional_boundary (formula_conflict) / provisional_boundary (formula_conflict) |
| KMS Thermashape 2-in-1 Spray | `kms-thermashape-2-in-1-spray` | styling smoothing_styler / styling smoothing_styler |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft | `langhaarmaedchen-lockenspray-halt-sprungkraft` | provisional_boundary (evidence_gate) / provisional_boundary (evidence_gate) |
| Living Proof Full Dry Volume & Texture Spray | `living-proof-full-dry-volume-texture-spray` | provisional_boundary (evidence_gate) / provisional_boundary (evidence_gate) |
| L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt | `loreal-paris-elnett-haarspray-extra-starker-halt` | styling hairspray / styling hairspray |
| L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) | `loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` | dry_shampoo / dry_shampoo |
| Moroccanoil Trockenes Texturspray (Dry Texture Spray) | `moroccanoil-dry-texture-spray` | styling texture_spray / styling texture_spray |
| Schwarzkopf Professional OSiS Flatliner | `osis-flatliner` | heat_protectant / heat_protectant |
| Schwarzkopf Professional OSiS Sparkler | `osis-sparkler` | styling shine_finish / styling shine_finish |
| Schwarzkopf Professional OSiS Super Shield | `osis-super-shield` | heat_protectant / heat_protectant |
| Redken Root Tease | `redken-root-tease` | styling texture_spray / styling texture_spray |
| Redken BEACH SPRAY BEACHY TEXTURE SPRAY | `redken-styling-beach-spray` | provisional_boundary (evidence_gate) / provisional_boundary (evidence_gate) |
| Redken Wax Spray (Redken Spray Wax) | `redken-wax-spray` | styling texture_spray / styling texture_spray |
| Schwarzkopf taft Haarspray CLASSIC Halt 3 | `schwarzkopf-taft-haarspray-classic-halt-3` | styling hairspray / styling hairspray |
| Schwarzkopf taft Haarspray GLANZ Halt 4 | `schwarzkopf-taft-haarspray-glanz-halt-4` | styling hairspray / styling hairspray |
| Schwarzkopf taft Haarspray POWER Halt 5 | `schwarzkopf-taft-haarspray-power-halt-5` | styling hairspray / styling hairspray |
| Schwarzkopf taft Texturspray Aloe Boost | `schwarzkopf-taft-texturspray-aloe-boost` | styling texture_spray / styling texture_spray |
| Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine | `schwarzkopf-taft-x-gliss-silky-shine-shine-coat` | styling shine_finish / styling shine_finish |
| syoss Curl Cream Gel | `syoss-curl-cream-gel-3in1` | styling gel / styling gel |
| Syoss Glaze Topcoat | `syoss-glaze-topcoat` | styling shine_finish / styling shine_finish |
| syoss Haarspray Max Hold | `syoss-haarspray-max-hold` | styling hairspray / styling hairspray |
| Schwarzkopf taft taft x GLISS Lovely Long MULTITASKING HITZESCHUTZ-SPRAY | `taft-x-gliss-hitzeschutzspray-lovely-long` | heat_protectant / heat_protectant |
| Wella Professionals EIMI Glam Mist Shinespray | `wella-eimi-glam-mist-shine-spray` | styling shine_finish / styling shine_finish |
| Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) | `wella-eimi-smooth-thermal-image` | heat_protectant / heat_protectant |
| Wella Professionals EIMI Volume Dry Me (Trockenshampoo) | `wella-eimi-volume-dry-me` | dry_shampoo / dry_shampoo |
| wellaflex Schaumfestiger Locken & Wellen, Starker Halt | `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` | styling mousse / styling mousse |

## F. Approval and evidence limits

- **No additional already-ruled Leave-in move was found** in the corpus plus owner registry. The 19 non-NEQI holds and 45 direct-scope products have no prior Leave-in ruling; GUHL 3in1 has an owner care ruling, not a Leave-in engine record.
- Color Wow Dream Coat appears in Leave-in data as a rejected unseen-test candidate and in a Product Intake router fixture; neither is a Leave-in ruling.
- The frozen v1.0/v1.1 records remain historical. The NEQI moves do not silently rewrite T15/T20 or release profiles today.
- **O-11:** live categories and catalog identities need a separate check before any separately authorised migration. No Supabase or production query/write was performed.
