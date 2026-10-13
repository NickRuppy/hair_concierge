# Styling-border addendum — affected products (DRAFT)

Status: **DRAFT — not in force; queued for after Styling v1.0 lock (PH1-16); every product move needs owner approval.**
Companion to `DRAFT-styling-border-addendum.md` (this folder). Amendment numbers (A1–A10) and open items (O-1…O-12) refer to that file.
Drafted: 2026-10-13. Nothing here was applied to any standard, ledger, data file, catalog or database.

## How this list was built

- **Leave-in rulings searched:** `data/research/leave-in-inci/` (v1.0 corpus, v1.1 overlay records) and `docs/research/leave-in-inci/`. The only product-level Leave-in rulings are the **19 corpus records** (13 gold-set + 6 unseen-test), read from `data/research/leave-in-inci/v1.1/lab-fixture.json` (G0 state, INCI, tail marker, claims). Nine of them were enriched into the live catalog (`plans/leave-in-apply/leave-in-research-enrichment-manifest.json`; five re-applied under T20, `plans/leave-in-moisture-balanced/leave-in-research-enrichment-manifest-v2-t20.json`).
- **Owner rulings that name a Leave-in route on the Styling side:** the Styling standard v0.4 §4.6 registry and `plans/styling-concept/02-rulings.md`. Ten products beyond the corpus (part A2).
- **Held Styling products:** `boundary_reason` / `reason_code` = `pending_leave_in_addendum` in `data/research/styling-inci/v1.0/blind-lane-A-r3/results.json` and `…/blind-lane-B-r3/results.json`, plus the three products the round-3 rulings add to the hold (R3-Q4, R3-H2, PH1-14 with R3-H3).
- **Others:** lane A round-3 records with pair rule `3.4(ii)` (PH2-1, Styling directly), plus the two products A6 and A9 reclassify.
- **Counts** were computed with a scratch node script (not committed) over those files on 2026-10-13. Products were checked against each amendment from frozen INCI ranks, tail markers and the lanes' rule paths; no lane was re-run.

| Count (node) | Value |
|---|---|
| Already-ruled Leave-in products checked | **29** (19 corpus + 10 Styling-side owner rulings) |
| … of which would move | **0** |
| Held Styling products the addendum releases | **17** (round-3 lanes: A 13, B 14, union 14; + 3 from R3-Q4 / R3-H2 / PH1-14 + R3-H3) |
| Other products newly classified | **45** (43 PH2-1 scope + 1 A6 + 1 A9) |
| Considered, not moved, not Leave-in-ruled | 17 (part D) |

---

## A. Already-ruled Leave-in products — owner approval needed for any move

**Result: none of the 29 would move.** No owner approval of a product move is needed today. If the Styling confirmation round 4 or a re-capture changes one of these inputs, this part must be re-checked before approval.

### A1. The Leave-in corpus (19 records)

Source of the current status: `data/research/leave-in-inci/v1.1/lab-fixture.json` (`g0.state`; standard v1.1). „Live" = enriched into the catalog by the manifests above.

| Product | Slug (`productId`) | Current Leave-in status | Outcome under the addendum | Amendments checked (why no move) | Already ruled ⇒ owner approval |
|---|---|---|---|---|---|
| alverde Leave-In Sprühkur Express 7in1 | `slot-01-alverde-naturkosmetik-leave-in-spruehkur-express-7in1` | `in_category` · live | `in_category`, unchanged | A1: care lead (C2 house brand). A2: Helianthus oil r2 above T_LI r9 = real care | yes — no move |
| ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol | `slot-02-isana-professional-leave-in-conditioner-hyaluron-panthenol` | `in_category` · live | unchanged | A1: no C1/C2 promise captured ⇒ A1 (d). A2: Cetearyl Alcohol r2 = care | yes — no move |
| Cantu Leave-In Haarkur Repair Creme | `slot-03-cantu-leave-in-haarkur-repair-creme` | `in_category` · live | unchanged | A1: repair lead. A2: Canola Oil r2 = care. A8: no wax/lanolin in the list | yes — no move |
| alverde Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan | `slot-04-alverde-naturkosmetik-nutri-care-2-phasen-spruehkur-bio-mandel-bio-argan` | `in_category` | unchanged | A1: no C1/C2 promise. A2: soy oil r2 = care (marker `none_visible`, ordinal read) | yes — no move |
| EVO Head Mistress Cuticle Sealer | `slot-05-evo-head-mistress-cuticle-sealer` | `in_category` · live | unchanged | A1: claims C5 only ⇒ (d); main directions towel-dried + blow-dry, so not R1-Q2. A2: Dimethicone r2 = care. Also a Styling-side D6 example (A10) | yes — no move |
| Curlsmith Hydrate & Plump Leave-In | `slot-06-curlsmith-hydrate-plump-leave-in` | `in_category`, HOLD `incidental_film` · live | unchanged | **Closest A3 case:** PVP r32 above a vacuous marker r36 + COND high, but sold as „Leave-In" conditioner, not a curl cream ⇒ A3 limb 3 fails; no C1/C2 claims | yes — no move |
| Maria Nila Curlicue Cream | `slot-07-maria-nila-curlicue-cream` | `excluded_styling_first` (T15) | excluded, unchanged | T15 stands (D3); Styling routes it `curl_cream` by the same pair rule | yes — no move |
| Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair | `slot-08-schwarzkopf-gliss-sprueh-conditioner-express-repair-ultimate-repair` | `in_category` · live | unchanged | A1: care/combing/heat lead. A2: Dimethicone r3 = care. A7: PQ-16 r9 is not L5 | yes — no move |
| Redken Extreme Anti-Snap Leave-In Treatment | `slot-09-redken-extreme-anti-snap-leave-in-treatment` | `in_category` · live | unchanged | A1: strengthening lead. A2: Amodimethicone r4 above the pH-adjuster yardstick (marker r3 implausible, T16); no styling-look promise | yes — no move |
| Olaplex N°.6 Bond Smoother | `slot-10-olaplex-n-6-bond-smoother` | `in_category` · live | unchanged | A1: no C1/C2 promise (C3 only) ⇒ (d). A2: Cetearyl Alcohol r2 = care | yes — no move |
| Balea Leichtkämmspray Pure Styling | `slot-11-balea-leichtkaemmspray-pure-styling` | `in_category` | unchanged | A1: name job word „Leichtkämm-" (detangling). A2: Cetrimonium Chloride r4 = care | yes — no move |
| Kevin Murphy Young.Again Oil | `slot-12-kevin-murphy-young-again-oil` | `excluded_anhydrous` | excluded, unchanged | not aqueous; the border amendments do not reach it | yes — no move |
| Neqi Diamond Glass Ultimate Styling Spray | `slot-13-neqi-diamond-glass-ultimate-styling-spray` | `in_category`, HOLD `incidental_film` (T15) · live | unchanged | **Closest A4 case:** fixative r8 + care film, but not sold as a straightening/smoothing styler; D3/T15 named (A10) | yes — no move |
| L'Oréal Paris Elvital Dream Length No Spliss Milk | `unseen-01-l-or-al-paris-elvital-elvital-dream-length-no-spliss-milk-retailer-listing-name-elvital-leave-in-dream-length` | `in_category` | unchanged | A1: repair lead. A2: Isopropyl Myristate r2 = care | yes — no move |
| L'Oréal Paris Elvital ÖL Magique Veredelndes Haaröl | `unseen-02-l-or-al-paris-elvital-elvital-oel-magique-veredelndes-haaroel-retailer-listing-name-elvital-oel-magique-haaroel` | `excluded_anhydrous` | excluded, unchanged | Oil by D2 on the Styling side too | yes — no move |
| Alcina (Professional) Föhn Lotion | `unseen-03-alcina-professional-foehn-lotion` | `excluded_styling_first` | excluded, state unchanged | A1 (b) also fires (C2 volume promise) — a second basis, same state; Styling `blowdry_lotion` (part C1 lists it too) | yes — no move |
| Briogeo Superfoods Avocado + Kiwi Mega Moisture 3-in-1 Leave-In Spray | `unseen-04-briogeo-superfoods-avocado-kiwi-mega-moisture-3-in-1-leave-in-spray` | `in_category` | unchanged | A1: no C1/C2 promise (C4). A2: Cetearyl Alcohol r3 = care | yes — no move |
| ISANA PROFESSIONAL Argan Leave-in Conditioner | `unseen-05-isana-professional-rossmann-house-brand-argan-leave-in-conditioner` | `in_category` | unchanged | A1: repair/anti-frizz lead, towel-dry directions (not R1-Q2). A2: castor oil r3 = care | yes — no move |
| amika The Shield Anti-Humidity Spray | `unseen-06-amika-the-shield-anti-humidity-spray-german-retailer-listing-name-the-shield-anti-feuchtigkeits-spray` | `in_category` | unchanged | A1: protection lead (not a volume/hold/texture/shine job); directions „before heat styling", not R1-Q2. A2: sea-buckthorn oil r5 = care. A8: Ceresin r17 sits below the marker r16 | yes — no move |

No corpus record contains an FX-4 member (A5), Polysilicone-9 (A6) or Polyquaternium-69 (node scan of all 19 INCI lists).

### A2. Products ruled Leave-in by owner rulings on the Styling side (10)

Source: Styling standard v0.4 §4.6 registry and the ledger. Nine are in the Styling round-3 cohort (both lanes `leave_in`); syoss Curl Control is excluded from the cohorts (not sold in Germany).

| Product | Slug | Current Leave-in status | Outcome under the addendum | Why no move | Owner approval |
|---|---|---|---|---|---|
| cantu Lockencreme Kokos | `cantu-lockencreme-kokos` | Leave-in by ruling (D7 scope, T15); no Leave-in engine record | Leave-in | no fixative ⇒ A3 limb 1 fails | ruled — no move |
| HASK Lockencreme Curl Care | `hask-lockencreme-curl-care` | as above | Leave-in | no fixative | ruled — no move |
| BALI CURLS Lockencreme Hydrating Curl Cream | `bali-curls-hydrating-curl-cream` | as above | Leave-in | no fixative | ruled — no move |
| Balea PROFESSIONAL Definier Spray Traumlocken | `balea-professional-definier-spray-traumlocken` | Leave-in by PH1-10 | Leave-in | oils above T_LI = care ⇒ A2 limb 2 fails | ruled — no move |
| Balea Haarserum Anti-Frizz Glatt & Glossy | `balea-haarserum-anti-frizz-glatt-und-glossy` | Leave-in by R2-Q2 | Leave-in | Behentrimonium Chloride above the yardstick = care | ruled — no move |
| Redken One United All-in-One Multi-Benefit Treatment | `redken-one-united-all-in-one-multi-benefit-treatment` | Leave-in (D6 example) | Leave-in | real care; leave-on first (RG2-20) | ruled — no move |
| GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray | `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` | Leave-in by PH2-1 | Leave-in | smoothing promise ⇒ A1 (a); real care; no fixative ⇒ A4 limb 1 fails | ruled — no move |
| LANGHAARMÄDCHEN Lockenspray Natur Lockenwunder | `langhaarmaedchen-lockenspray-natur-lockenwunder` | Leave-in by PH2-11 (PH1-13) | Leave-in | cationic r4 above the preservative = care | ruled — no move |
| NEQI Diamond Glass Styling Spray All | `neqi-diamond-glass-styling-spray-all` | Leave-in by R2-Q4 (R2-H4) | Leave-in | no hold polymer; D3 extended | ruled — no move |
| syoss Curl Control Hydrating Spray | `syoss-curl-control-hydrating-spray` | Leave-in by PH1-13, identity-blocked (dm.at INCI) | Leave-in once its DE identity clears | the ruling does not lift the identity block | ruled — no move |

---

## B. Held Styling products (`pending_leave_in_addendum`) — released by the addendum

None of the 17 has a Leave-in engine ruling. „v1.1 letter" is the locked Leave-in G0 as the Styling lanes re-ran it in their §4.5 step, or as the concept-phase G0 lane read it (`data/research/styling-inci/concept-v0/round2/G0-border-verdicts.json`, research reads, not rulings). Under the addendum each product is excluded at Leave-in G0 (state label O-1). On approval its held Styling record becomes a committed Styling record (PH2-2). Because none is an already-ruled Leave-in product, PH1-16 does not require a separate per-product approval; the owner's approval of the addendum releases them. Live catalog category not checked (O-11).

| # | Product | Slug | Current Leave-in status | Styling round 3 (lane A / lane B) | Outcome under the addendum | Amendment | Note |
|---|---|---|---|---|---|---|---|
| 1 | BALI CURLS Haargel Strong Hold Flaxseed | `bali-curls-strong-hold-flaxseed-gel` | no ruling; v1.1 letter `in_category` (lanes) | held `gel` / held `gel` | excluded ⇒ Styling `gel` | A2 | Carrageenan r3 natural film; no care above T_LI Phenoxyethanol r8; hold level 4 (R3-H) |
| 2 | alverde NATURKOSMETIK Locken Refresh-Spray | `alverde-locken-refresh-spray` | no ruling; v1.1 letter `in_category` (concept G0 lane; lanes) | held `refresher` / held `refresher` | excluded ⇒ Styling `refresher` | A2 | care only below the yardstick ⇒ `care_below_dose_yardstick` review (PH1-13) |
| 3 | Balea Locken Revitalizing Spray | `balea-locken-revitalizing-spray` | no ruling; v1.1 letter `in_category` (concept G0 lane; lanes) | held `refresher` / held `refresher` | excluded ⇒ Styling `refresher` | A2 | A2 worked example; `inci_tail_defect` (r15) |
| 4 | Balea Locken Crunchgel | `balea-locken-crunchgel` | no ruling; v1.1 letter `in_category` (lanes) | held `gel` / held `gel` | excluded ⇒ Styling `gel` | A2 | any format (PH2-3) |
| 5 | cantu Lockenspray Comeback Curl Next Day | `cantu-lockenspray-comeback-curl-next-day` | no ruling; v1.1 letter `in_category` (lanes) | held `refresher` / held `refresher` | excluded ⇒ Styling `refresher` | A2 | Shea r10 below T_LI r4 |
| 6 | Redken Refreshing Curl Mist | `redken-refreshing-curl-mist` | no ruling; v1.1 letter `in_category` (lanes) | held `refresher` / held `refresher` | excluded ⇒ Styling `refresher` | A2 | R2-Q1 case; PQ-6 below the yardstick |
| 7 | BALI CURLS Volumizing Curl Spray | `bali-curls-volumizing-curl-spray-refreshing` | no ruling; v1.1 letter `in_category` (lane B) | committed `salt_spray` (3.4 (ii)) / held `refresher` | excluded ⇒ Styling `refresher` | A2 | lane split closed by RG3-1 (two job words ⇒ revival ⇒ held); **confirm in round 4** |
| 8 | Balea Leave-In Spray Sea Salt Care & Define | `balea-leave-in-spray-sea-salt-care-define` | no ruling; v1.1 letter `in_category` (concept G0 lane) | held `salt_spray` / held `salt_spray` | excluded ⇒ Styling `salt_spray` | A2 + A10 | owner D6 ruling overrides the Styling-side `mixed` reading |
| 9 | Balea PROFESSIONAL Styling Cream Traumlocken | `balea-professional-styling-cream-traumlocken` | no ruling; v1.1 letter `provisional_boundary` (concept G0 lane; lane A, LI §2.3.2 clause 2) | held `curl_cream` / held `curl_cream` | excluded ⇒ Styling `curl_cream` | A3 | VP/VA r3; LGN pair; PH1-12 / R2-H5 |
| 10 | Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) | `wella-eimi-nutricurls-curl-shaper` | no ruling; v1.1 letter claims it (lane A) | held `curl_cream` / held `curl_cream` | excluded ⇒ Styling `curl_cream` | A3 | VP/VA r3 + Ethyl Ester of PVM/MA r8 (FX-4); D7 before the mixed stop |
| 11 | Schwarzkopf taft Styling Balm LOCKEN Halt 3 | `schwarzkopf-taft-styling-balm-locken-halt-3` | no ruling; v1.1 letter `provisional_boundary` (concept G0 lane) | held `curl_cream` / held `curl_cream` | excluded ⇒ Styling `curl_cream` | A3 | A3 worked example |
| 12 | Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) | `kevin-murphy-killer-curls` | no ruling; v1.1 letter claims it (lanes) | held `curl_cream` / held `curl_cream` | excluded ⇒ Styling `curl_cream` | A3 | vacuous T_LI r39 (O-2); Lanolin Wax r2 (A8) |
| 13 | KMS Thermashape Straightening Creme | `kms-thermashape-straightening-creme` | no ruling; v1.1 letter `in_category` (lane A) or `provisional_boundary` (lane B) | `leave_in` / `li_g0_provisional` (round 3 ran before R3-Q4) | excluded ⇒ Styling `smoothing_styler` | A4 | R3-Q4 case; vacuous T_LI r16 (O-2); **confirm in round 4** |
| 14 | Wella Professionals EIMI Flowing Form (Glättungscreme / Anti-Frizz Smoothing Balm) | `wella-professionals-eimi-flowing-form` | no ruling; v1.1 letter `provisional_boundary` (lanes) | `li_g0_provisional` / `li_g0_provisional` (before R3-H2) | excluded ⇒ Styling `smoothing_styler` | A4 | R3-H2 (at commit `6c1e2b6c` the Styling standard §4.6 still showed the withdrawn „review" text; the working-copy amendment folds R3-H2); **confirm in round 4** |
| 15 | COLOR WOW Dream Coat Supernatural Spray | `color-wow-dream-coat-supernatural-spray` | no ruling; v1.1 letter `in_category` (lane A) | held `smoothing_styler` / held `smoothing_styler` | excluded ⇒ Styling `smoothing_styler` | A10 | D2 corrected example; C3 claims only (`claim_authority_gap`). Also appears as a router-fixture output `heat_protectant` (`tests/fixtures/product-intake-router/real-production-outputs.json`) and as a rejected Leave-in unseen-test candidate — neither is a ruling |
| 16 | L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt | `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | no ruling; v1.1 letter `in_category` (Styling §4.6) | evidence gate / evidence gate (no directions) | excluded ⇒ Styling `smoothing_styler` | A10 | PH1-14; directions from the L'Oréal article (R3-H3) still to be frozen; **confirm in round 4** |
| 17 | John Frieda Lockencreme Traumlocken | `john-frieda-frizz-ease-traumlocken-lockencreme` | no ruling; v1.1 letter would be `provisional_boundary` (lane A: D6 unresolved) | held `curl_cream` / held `curl_cream` | excluded ⇒ Styling `curl_cream` | A10 | D7 naming; FX-2c not corroborated ⇒ HOLD stays a formula read (`ambiguous` on the Styling side; O-4) |

By amendment (node): A2 7 · A3 4 · A4 2 · A10 3 · A2 + A10 1 = **17**. By lean subtype: `curl_cream` 5 · `refresher` 5 (incl. Bali Volumizing) · `smoothing_styler` 4 · `gel` 2 · `salt_spray` 1 = 17.

---

## C. Other products the addendum newly classifies (45)

None has a Leave-in ruling; none moves on the Styling side. The addendum states their Leave-in status for the first time.

### C1. Outside Leave-in's function scope — A1 (PH2-1) — 43 (+ Alcina Föhn Lotion, already ruled, part A1)

Lane A round 3 routed each by pair rule `3.4(ii)` (C1/C2 promise volume, hold, texture, shaping/molding or shine only). Under the addendum each reads **excluded (Styling)**, `g0_basis: promise_outside_leave_in_function`; their Styling route is already committed. `hold_route` is the Styling F value (present = a fixative-class member above T_S). Lane B agrees on the Styling route for all but one (marked).

| Product | Slug | Styling subtype (lane A) | `hold_route` |
|---|---|---|---|
| ALCINA Ansatz Volumen Spray Aerosol | `alcina-ansatz-volumen-spray-aerosol` | blowdry_lotion | present |
| ALCINA Styling Mousse Aerosol | `alcina-styling-mousse-aerosol` | mousse | ambiguous (PQ-11, A7) |
| alverde NATURKOSMETIK Beach Waves Spray Seaside Balance | `alverde-beach-waves-spray-seaside-balance` | salt_spray | absent |
| Balea Ansatzvolumen Booster | `balea-ansatzvolumen-booster` | mousse | present (FX-4 only, A5) |
| Balea Föhnlotion Volume Effect | `balea-foehnlotion-volume-effect` | blowdry_lotion | absent (A1 worked example) |
| Balea Haargel Hair Jelly | `balea-haargel-hair-jelly` | gel | present |
| Balea Haarpuder Volumen (Pomegranate) | `balea-haarpuder-volumen-pomegranate` | hair_powder | absent |
| Balea Styling Glow Wax | `balea-haarwachs-glow-wax` | molding | absent |
| Balea MEN Styling Powder | `balea-men-styling-powder` | hair_powder | absent |
| Balea Sea Salt Texture Spray | `balea-sea-salt-texture-spray` | salt_spray | absent |
| Balea Styling Creme Power Flex | `balea-styling-creme-power-flex` | gel | present (VP/DMAEMA, FX-4) |
| Balea Fixierungsbürste Styling Finishing Stick | `balea-styling-finishing-stick` | shine_finish | present (A1 (c), R1-Q2) |
| Balea Styling Spray Ultra Volumen | `balea-styling-spray-ultra-volumen` | blowdry_lotion | present |
| Bali Curls Sleek Stick Brows & Edges | `bali-curls-sleek-stick-brows-and-edges` | gel | present |
| BALI GENTS Haarpuder Volumizing Styling Powder | `bali-gents-haarpuder-volumizing-styling-powder` | hair_powder | absent |
| BALI GENTS Matt Paste | `bali-gents-matt-paste` | molding | absent |
| BALI GENTS Sea Salt Spray | `bali-gents-sea-salt-spray` | salt_spray | absent |
| Gard Haarspray extrastark (Pumpspray) | `gard-haarspray-extrastark-pumpspray` | hairspray | present |
| got2b Kleber 4 Brows & Edges 2in1 Stylinggel | `got2b-kleber-4-brows-and-edges-2in1-stylinggel` | gel | present |
| got2b Styling Mattpaste Strand Matte | `got2b-styling-mattpaste-strand-matte` | molding | absent |
| got2b Styling Paste iStyler Texture Clay | `got2b-styling-paste-istyler-texture-clay` | molding | present |
| got2b Styling Puder Volumen Powderfull | `got2b-styling-puder-volumen-powderfull` | hair_powder | absent |
| GUHL Föhn-Spray Langzeit Volumen | `guhl-foehn-spray-langzeit-volumen` | blowdry_lotion | absent |
| Jean&Len Sea Salt Spray | `jean-und-len-sea-salt-spray` | salt_spray | absent |
| John Frieda Frizz Ease Zauberformel Seiden-Finish Creme | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | shine_finish | present — **lane B: `provisional_boundary`** (lane split, round 4) |
| L'Oréal Men Expert Barber Club Styling Pomade | `loreal-men-expert-barber-club-styling-pomade` | molding | present |
| Moroccanoil Root Boost | `moroccanoil-root-boost` | blowdry_lotion | present |
| Moroccanoil Textur- & Volumenpuder | `moroccanoil-textur-und-volumenpuder` | hair_powder | absent |
| Moroccanoil Volumizing Spray | `moroccanoil-volumizing-spray` | blowdry_lotion | present |
| NIVEA MEN Styling Cream Active | `nivea-men-styling-cream-active-craft-stylers` | molding | present |
| Schwarzkopf Professional OSiS Dust It | `osis-dust-it` | hair_powder | absent |
| Redken Powder Grip 03 | `redken-powder-grip-03` | hair_powder | present |
| Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 | `schwarzkopf-taft-foehn-spray-volumen-halt-3` | blowdry_lotion | present |
| Schwarzkopf Taft Gel Wax Glanz | `schwarzkopf-taft-gel-wax-glanz-halt-2` | molding | absent |
| Schwarzkopf taft Haarpuder VOLUMEN | `schwarzkopf-taft-haarpuder-volumen` | hair_powder | absent |
| Schwarzkopf Taft MATT WAX Halt 5 | `schwarzkopf-taft-matt-wax-halt-5` | molding | absent |
| Schwarzkopf taft Haargel POWER Halt 5 | `schwarzkopf-taft-power-haargel-halt-5` | gel | present |
| Schwarzkopf taft Schaumfestiger Volumen Halt 4 (feines Haar) | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` | mousse | absent |
| Syoss Max Hold Wax | `syoss-professional-performance-max-hold-power-wax` | molding | present |
| Syoss Schaumfestiger Volume | `syoss-schaumfestiger-volume` | mousse | absent |
| Schwarzkopf taft Styling Paste Forming | `taft-styling-paste-forming-halt-5plus` | molding | present |
| Wella Professionals EIMI Volume Sugar Lift | `wella-eimi-sugar-lift` | blowdry_lotion | present |
| Wella Professionals EIMI Texture Ocean Spritz | `wella-eimi-texture-ocean-spritz` | salt_spray | present |

By subtype (node, incl. Alcina Föhn Lotion = 44 rows of lane A `3.4(ii)` less Bali Volumizing, which is in part B): molding 10 · blowdry_lotion 9 · hair_powder 8 · gel 5 · salt_spray 5 · mousse 4 · shine_finish 2 · hairspray 1. `hold_route`: present 23 · absent 20 · ambiguous 1. Why they are listed: under the v1.1 letter a no-fixative volume/texture/shine product has no clean G0 state (no Leave-in function, no L5 route, not rinse-out), so v1.1 could only park it at `provisional_boundary`; A1 settles it.

### C2. Polysilicone-9 — A6 — 1

| Product | Slug | Current Leave-in status | Outcome under the addendum | Amendment |
|---|---|---|---|---|
| John Frieda Frizz Ease 3-Tage-Glatt Styling-Spray | `john-frieda-frizz-ease-3-tage-glatt-styling-spray` | no ruling; v1.1 letter would read Polysilicone-9 r3 as an L2 silicone ⇒ real care ⇒ `in_category` | `provisional_boundary`, review `hair_fixing_silicone_unresolved`; stays in its current category (both Styling lanes: `li_g0_provisional`) | A6 |

### C3. Care cream with an optional leave-in use — A9 — 1

| Product | Slug | Current Leave-in status | Outcome under the addendum | Amendment |
|---|---|---|---|---|
| GUHL Haarkur, Conditioner & Lockencreme Pflege & Styling 3in1 | `guhl-locken-pflege-und-styling-3in1` | no ruling; v1.1 §2.4 rule 2 consequence 2 (dual-use) would read `in_category` + review | stays care in its current category: `excluded_other_form`, `dual_use_directions` recorded, review (R2-H2) | A9 (scope O-7) |

---

## D. Considered, not moved (no Leave-in ruling) — 17

Checked because they sit at the border; the addendum leaves their outcome where the Styling lanes put it.

| Product | Slug | Styling round 3 (A / B) | Why the addendum does not move it |
|---|---|---|---|
| Wella EIMI Smooth Perfect Me | `wella-eimi-smooth-perfect-me` | leave_in / leave_in | real care (ester r3, Dimethicone r4); Polyacrylamide stays unenumerated |
| Balea PROFESSIONAL Haarserum Glow & Shine | `balea-professional-haarserum-glow-und-shine` | leave_in / leave_in | water-based-serum exception ⇒ G0; real care |
| Wella EIMI Nutricurls Fresh Up | `wella-eimi-nutricurls-fresh-up` | leave_in / leave_in | Polyquaternium-10 above the yardstick = care (R2-H1) |
| John Frieda Frizz Ease Unendlich Smooth Blow-Out Spray | `john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` | leave_in / leave_in | real care |
| got2b Anti-Frizz Lotion Schmusekatze | `got2b-anti-frizz-lotion-schmusekatze` | leave_in / leave_in | real care |
| AUSSIE Leave-In Creme Work That Curl | `aussie-leave-in-creme-work-that-curl` | leave_in / leave_in | real care, no fixative |
| Schwarzkopf Professional OSiS+ Curl Retouch | `schwarzkopf-professional-osis-curl-retouch` | leave_in / leave_in | real care |
| BALI CURLS Leave-In Spray Curl Defining | `bali-curls-leave-in-spray-curl-defining` | leave_in / leave_in | real care on the frozen list (formula-conflict history, Styling §2.2 A2) |
| Moroccanoil Anti-Frizz Schild-Spray | `moroccanoil-anti-frizz-schild-spray` | leave_in / leave_in | real care |
| Balea Styling Locken Lotion | `balea-styling-locken-lotion` | leave_in / leave_in | PQ-69 r4 + phenyl silicones = care (A7 worked example) |
| Balea Glattspray Anti-Frizz | `balea-glattspray-anti-frizz` | li_g0_provisional / li_g0_provisional | fixative with **thin** conditioning ⇒ A4 limb 2 fails; LI §2.3.2 clause 2 unchanged |
| syoss Hitzeschutzspray Keratin | `syoss-hitzeschutzspray-keratin-heat` | li_g0_provisional / heat_protectant | Heat Protectant under R3-Q2 (shop-title fallback); outside this addendum |
| GUHL Styling Spray Locken Pflege & Styling 2in1 | `guhl-styling-spray-locken-pflege-und-styling-2in1` | mixed / mixed | R1-Q3 not mirrored (O-8) |
| GARNIER FRUCTIS Pflege-Spray Locken Methode Feuchtigkeitsboost | `garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray` | mixed / mixed | R1-Q3 not mirrored (O-8) |
| John Frieda Traumlocken Belebender Wellenauffrischer | `john-frieda-traumlocken-belebender-wellenauffrischer` | mixed / mixed | R1-Q3 not mirrored (O-8) |
| Moroccanoil Glättende Creme (Smoothing Lotion) | `moroccanoil-glaettende-creme-smoothing-lotion` | mixed / mixed | no L5 member (PQ-11 r9 is A7) ⇒ A3/A4 fail; R1-Q3 not mirrored; A8: Hydrogenated Vegetable Oil r12 does not change WT (LGN pair already `high`) |
| Syoss Glaze Glanz & Schutz Primer | `syoss-glaze-glanz-und-schutz-primer` | mixed / mixed | mixed style + care + repair lead (O-8) |

Wella EIMI Smooth Thermal Image (mixed / heat_protectant) goes to Heat Protectant under RG3-4 and is outside this addendum.

---

## E. Where no Leave-in ruling was found

- **All 17 held products (part B) and all 45 products in part C** have no record under `data/research/leave-in-inci/` or `docs/research/leave-in-inci/`. Their „current Leave-in status" is the v1.1 letter as the Styling lanes re-ran it (round 3, §4.5 step) or, for five of them, the concept-phase G0 lane (`concept-v0/round2/G0-border-verdicts.json`: Taft Balm, Balea Pro Traumlocken, Balea Revitalizing, alverde Locken Refresh, Balea Sea Salt Care & Define). Those reads are research, not rulings.
- **COLOR WOW Dream Coat** appears in Leave-in data only as an unseen-test candidate that was set aside (`data/research/leave-in-inci/v1.0/corpus/unseen-test/candidate-products.md`), and in a Product Intake router fixture as `heat_protectant` — neither is a Leave-in ruling.
- **The ten Styling-side Leave-in rulings (part A2)** have no Leave-in engine record either; their status is the owner ruling.
- **Live catalog category** was not checked for any product outside the nine catalog-enriched corpus records (O-11).
