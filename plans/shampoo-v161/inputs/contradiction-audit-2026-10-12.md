# Claim-vs-classification contradiction audit — Profi shampoos v1.6 (2026-10-12)

Scope: the 42 classified Profi shampoos (round 1 kit `PF*`, round 2 kit `PR*` superseding it for P05, P11, P15–P18, P24, P25, P35–P37; Gallinée P27 dropped). Read-only audit: no lane record or packet was changed. Lane values used: agreed value, or the cautious (P0) value where the lanes split, as ruled 2026-10-11 (D+E). Positions are normalized one-based INCI positions from the frozen packets. Rule IDs refer to `docs/research/shampoo-inci/v1.6/classification-standard.md`.

Verdicts: **(a)** correct reading — the formula really is like that; **(b)** possible misread — re-check; **(c)** rule question — the standard's rule gives a result an expert would dispute.

Checked with no material contradiction (claims and classification agree): P01 Head & Hair Heal, P03 True Soft (heavy, "für trockenes Haar"), P06 KMS HeadRemedy, P08 Revlon Re/Start Soothing, P09 Kevin.Murphy Hydrate-Me (heavy, dry hair), P10 Tea Tree Special, P11 Tea Tree Lemon Sage Thickening (light), P12 Sheer Hydration, P13 Lavender Mint, P16 Mane Tamer (shine), P18 The Therapist, P24 Blond Absolu, P26 L'Oréal Anti-Oiliness (oily), P30 Moroccanoil Moisture Repair (heavy), P32 Vichy Ultra-Sensitiv (dry+sensitive), P36 Purify P4 (dandruff), P43 Metal DX.

## Table

| # | Product | Claim | Classification (C/K/W, focus, target, intensity) | Deciding ingredients (normalized pos.) | Verdict | User effect |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **P02 Maria Nila Pure Volume** | Name "Pure Volume"; DE manufacturer: "Für feines Haar", "volumengebend", "Täglich anwendbar" | C low / K high / **W high → heavy**; fit fine `not_suited`, normal `acceptable`, coarse `ideal`; focus split volume (A) vs repair (B); ordinary, gentle | W-RICH read from Sunflower Seed Oil @8 as "prominent payload lipid" + Amodimethicone/Morpholinomethyl Silsesquioxane Copolymer @12 + cationic wheat-protein copolymer @9, Guar HPTC @18, Quaternium-95 @16, proteins @11/@13; reset weak (C6 low: SLMI @2, CAPB @3, DLS-sulfosuccinate @4, sulfoacetate @5) | **(b)** (with a rule question) | Fine-hair users never see it (no row); normal amber; coarse green — the inverse of its own claim |
| 2 | P25 OLAPLEX No.4 | "für alle Haartypen", repair | C low / K high / W split **high (A, low conf.) vs moderate (B, low conf.)**; cautious = heavy; `needs_research` (formula not known complete) | Oils @24–26 read as W-RICH, PQ-10/PQ-11/guar @30–32, amodimethicone @34, divinyldimethicone @35 — all after a 23-item extract run; mild C6 chassis | **(b)** (same prominence issue as #1) | Not applied yet (needs_research); if applied at cautious heavy: fine-hair users never see it |
| 3 | P15 evo Gluttony Volumising | "lightweight volumising … especially fine hair" (foreign page, low) | C low / K moderate / **W moderate**; fine `acceptable`; volume | Polyquaternium-10 @5 (genuinely before Parfum @8), PEG-12 Dimethicone @7 (water-soluble), VP/DMAPA Acrylates Copolymer @11 (cationic film former), Trideceth-9 PG-Amodimethicone @14; reset weak (SLMI + CAPB) | (a) | Fine hair: amber (shown, ranked below light products). Not applied yet (formula not known complete) |
| 4 | P29 Aveda Rosemary Mint Purifying — weight | Retailer (low): "schwerelos", "verleiht feinem Haar Volumen … ohne zu beschweren" | C split moderate (A) / strong (B) / K moderate / **W moderate**; fine `acceptable` | Sunflower Seed Oil @6, Stearamidopropyl Dimethylamine @10, Polyquaternium-4 @12, all before Fragrance @17; Sodium Coco-Sulfate @2 chassis | (a) | Fine hair amber |
| 5 | P29 Aveda Rosemary Mint Purifying — scalp | DE manufacturer: "Normales bis fettiges Haar wird … sanft gereinigt", "klärend" | Target `ordinary` (no E2 oily unit); focus clarifying | Formula passes every S-OILY clause (cleansing moderate/strong, W moderate, K moderate) | **(c)** | Oily-scalp users never get it, although its manufacturer positions it for oily hair |
| 6 | P22 Redken All Soft Mega Curls | "Feuchtigkeitsspendend … für lockiges und welliges Haar", "sehr trockene Locken" | C moderate / **K low / W low → light**; focus general | Sodium C14-16 Olefin Sulfonate @2 + CAPB @3 + Laureth-5 Carboxylic Acid @4; only Glycerin @6 before Parfum @8; Polyquaternium-67 @17 is post-fragrance trace | (a) | Shown green to fine/normal, amber to coarse; curl is texture, not thickness (T2) |
| 7 | P19 Sebastian Dark Oil Silky Shine | "Dark Oil", "reinigt sanft", "leicht, ohne zu beschweren" | **C strong** / K low / W low; shine | SLES @2 + SLS @3 (C1: reinforcing route → strong); Argan @22 and Jojoba @23 listed after all fragrance allergens (trace) | (a) | Green for fine/normal; intensity `regular` (no visible effect of "strong") |
| 8 | P20 Redken Volume Injection | "reinigt das Haar sanft" | **C strong** / W low; volume | SLES @2 + SLS @4 (C1 strong) | (a) | None visible (regular intensity, light) |
| 9 | P14 Authentic Beauty Concept Hydrate Cleanser | "frei von Sulfat-Tensiden", "Hydrate", for dry/curly hair | C moderate / K low / W low; **focus general** | Sodium C14-16 Olefin Sulfonate @2 (C3 strong sulfonate class, not a sulfate) buffered by CAPB @3, taurate @4 (C1 → moderate); only Panthenol @10 before Parfum @11 | (a) | "Sulfatfrei" is literally true; green fine/normal |
| 10 | P21 Redken Acidic Color Gloss | "reinigt … mild", "sulfatfrei" (retailer) | C moderate / W moderate; shine | Olefin sulfonate chassis buffered (C1 moderate) | (a) | Fine amber |
| 11 | P35 System Professional Purify P1 | "gentle cleansing", "mild und pH-neutral" (low-graded) | **C strong**; dandruff, regular | SLES @2 + Sodium Laureth-8 Sulfate @4 (reinforcing) | (a) | None (dandruff bucket expects regular) |
| 12 | P37 System Professional Balance B1 | Pack front "Sanfte Reinigung für empfindliche Kopfhaut" | **C strong**; lanes projected `sensitive` + `review_strong_cleansing_comfort_route` | SLES @2 + SLS @3 | (a), **already ruled** (Nick 2026-10-12: cautious → ordinary) | Make sure consolidation applies the ruling: the lane records still carry the `sensitive` target |
| 13 | P04 Maria Nila Purifying Cleanse | "Tiefenreinigend", "Mach dich bereit für einen Reset!" | **C low → gentle**; D1 true; no deep-cleanser entry (note `deep_cleansing_name_ordinary_formula`); **focus scalp_active**; S-FAIL sensitive → ordinary | Disodium Laureth Sulfosuccinate @2, SLMI @3, CAPB @4 (C6 low); AHA block @11–14 not a cleansing route | **(c)** cleansing (case C2) + **(b)** focus/scalp | Shown amber everywhere (gentle ≠ regular); not in deep-cleanser list; blocked for review |
| 14 | P40 Moroccanoil Clarifying | Name "Clarifying Shampoo"; "tiefenreinigend", removes metals/minerals | **C low → gentle**; D1 true; no deep-cleanser entry; **focus moisture**; W moderate | Cocamidopropyl Hydroxysultaine @2 earliest (C6 low); chelators Tetrasodium EDTA @20, Tetrasodium Glutamate Diacetate @27, Disodium EDTA @22, Sodium Polystyrene Sulfonate @14 count for nothing; Argan @7 + Avocado @8 → W moderate | **(c)** (case C2) | Not in deep-cleanser list; amber everyday shampoo; a "Clarifying" product filed as moisture-focus |
| 15 | P41 OLAPLEX No.4C Clarifying | Name "Clarifying Shampoo", weekly reset | **C low → gentle**; D1 true; no deep-cleanser entry; focus repair | SLMI @2 + hydroxysultaine @3 (C6 low); chelators GLDA @39, EDDS @40 | **(c)** (case C2) | Same as #14 |
| 16 | P39 Color Wow Curl Wow Hooked | "sulfate-free", "residue-free", removes build-up | Lanes split **C low (A) vs strong (B, low conf.)** | Sodium Methyl 2-Sulfolaurate @2 + Disodium 2-Sulfolaurate @10 (before Fragrance @11) | **(c)** (case C3, known C3 gap) | Cautious: gentle/amber for everyone, or needs_research |
| 17 | P34 GLYNT DERMA | "reinigt mild" | **C strong**; dandruff | Sodium Coco-Sulfate @2 (C5) + **Sulfated Castor Oil @16** counted as reinforcing strong anionic; without it C5 gives moderate (3 buffers @3–5) | **(c)** (case C3, known gap) | None visible (regular either way) |
| 18 | P17 evo Normal Persons Daily | "deeply cleanses", "balances scalp … excess oil" (all low-graded) | **C low → gentle**; ordinary; S-FAIL oily | SLMI @2 + CAPB @3 only | (a) | Amber everywhere; not on oily path |
| 19 | P28 O&M Original Detox | "Detox", "neutralise … excess oils" (low-graded) | C low → gentle; ordinary | Betaine @3, sarcosinate @4, glucosides | (a) | Amber everywhere |
| 20 | P42 OUAI Detox | "Detox", "Tiefenreinigungsshampoo" (retailer only) | C moderate; focus clarifying; D1 false | Olefin sulfonate @2 buffered by SLMI/CAPB/decyl glucoside | (a) | Regular everyday shampoo; no deep-cleanser entry (D1 needs a moderate source; D2 also needs strong) |
| 21 | P31 Vichy Dercos Anti-Schuppen | "Anti-Schuppen" in name | ordinary (S-FAIL dandruff) | Selenium Sulfide @15 not on the Section 11 list | (c), **already ruled** → v1.6.1 | Dandruff users don't get it until v1.6.1 |
| 22 | P05 Davines NaturalTech Purifying | Pack front "for scalp with oily or dry dandruff" | ordinary (S-FAIL dandruff) | Selenium Sulfide @9 | (c), **already ruled** → v1.6.1 | Same |
| 23 | P33 René Furterer Neopur Anti-Schuppen | "Anti-Schuppen" in name | ordinary (S-FAIL dandruff) | No recognized active (celery @10, pumpkin oil @14) | (a), already ruled (C) | Dandruff users don't get it — correct |
| 24 | P38 Nõberu Dandruff No 106 | "Dandruff" in name | ordinary (S-FAIL dandruff) | No recognized active (Allantoin @11, Menthol @12) | (a), already ruled (C) | Same — correct |
| 25 | P23 Kérastase Genesis Hydra-Fortifiant | "für feines und/oder fettendes Haar", "Anti-Fett" (retailer/foreign, low) | ordinary; S-FAIL oily (positioning only) | Formula would pass S-OILY | (a), pack-front pass pending (ruling A) | Not on oily path until a moderate source is found |

Counts (rows; #13 carries both a (b) and a (c) issue): (a) 15 · (b) 3 issues on 3 products (P02, P25, P04-focus) · (c) 8 rows in 4 rule cases (two already ruled).

## Why some "contradictions" are correct readings (plain language)

- **A volume claim does not make a formula light.** Volume shampoos usually work by leaving something on the hair — a cationic polymer (e.g. Polyquaternium-10) or a film former that thickens each strand. That deposit *is* the "body", but on very fine hair it is also weight. evo Gluttony (#3) is built exactly like that, so `moderate` → amber for fine hair is honest: shown, just not top-ranked. Aveda (#4) carries a real early oil and two cationic conditioners.
- **"Oil" in the name says nothing about the oil amount.** Sebastian Dark Oil (#7) lists its oils after every fragrance allergen — a trace — on a SLES+SLS base. It really is a light, strong-cleansing shampoo, as its own "ohne zu beschweren" claim says.
- **Curls are texture, not thickness.** Redken Mega Curls (#6) is a lightly conditioning olefin-sulfonate shampoo; its curl claim cannot move the thickness fit (T2).
- **"Sanft/mild" next to SLES+SLS** (#8, #11, #12) is marketing language; cleansing strength is formula-only (Section 4). "Sulfatfrei" with Sodium C14-16 Olefin Sulfonate (#9, #10) is literally true — a sulfonate is not a sulfate — but it cleanses at the same class strength (C3).
- **"Anti-Schuppen" without a recognized active** (#23, #24) is not anti-dandruff under Section 11; already ruled.

## (b) Possible misreads

### B1 — P02 Maria Nila Pure Volume: `heavy` rests on an inconsistent "prominent oil" reading

What decides it: both lanes reach `high` through W-RICH ("prominent payload lipid converging with silicone/cationic deposition, and limited reset"). The "prominent" oil is Sunflower Seed Oil @8.

Why this is probably a misread:

1. **Position 8 is in the sub-1 % tail.** It follows Panthenol @7, the claimed hero ingredient, which in shampoos is typically ≤ 1 %. Every depositing ingredient (@9–@18) comes after it.
2. **Maria Nila does not list its tail in descending order.** Parfum is @33 — after Phenoxyethanol @32 and after its own fragrance allergens (Linalool @28 … Citronellol @31). EU labelling allows any order below 1 %, and this list uses that freedom. So the E3 proxy ("prominent = before Parfum") marks almost the whole list as prominent, which says nothing about amounts.
3. **The same lanes read the sister formula differently.** For P01 Head & Hair Heal (same chassis, same Amodimethicone/Silsesquioxane copolymer, guar, Quaternium-95 and sunflower oil @15, Parfum @37), lane A wrote "E3 is never a weight rule; the payload lipid is late in whole-formula terms" and both lanes refused W-RICH → `moderate`. The standard itself says E3 "is never a weight rule" (13.3 E3; Section 6 forbids position windows), but W-RICH does not define "prominent" for weight. The lanes filled that gap with E3 for Pure Volume and not for Head & Hair Heal.
4. **Without W-RICH, `high` needs "multiple converging, plausibly persistent systems that reset does not offset".** That is arguable here, but the strongest silicone is a resin-type amino-silicone copolymer sold for low build-up, and every system sits in the sub-1 % tail. Read like P01, `moderate` is the consistent band. A mild sulfate-free base with five conditioning traces really does deposit more than a sulfate volume shampoo, so `low/light` would be wrong. `moderate` is the defensible ceiling.

Formula identity is fine. I re-fetched marianila.de on 2026-10-12: same INCI. The Moringa-oil claim is still absent from the INCI (a claim-only conflict, not material for weight).

Effect of the consistent reading (W `moderate`, K stays `high`): fine `acceptable` (amber, now shown), normal `ideal` (green), coarse `ideal` in T1 (amber live, T7). The focus split would also resolve: lane B's switch to `repair` was justified only by "weight high makes volume incompatible".

Re-check: (1) Nick rules what "prominent" means inside W-RICH (and C2 "early"). Options: E3 as written; or E3 plus "not after a preservative or a ≤1 % marker such as Panthenol"; or no position test for W-RICH at all (whole-formula judgment). (2) Re-run P02 weight under that ruling. Apply the same ruling to P03 True Soft, P25 Olaplex No.4 and P32 Vichy Ultra-Sensitiv (alphabetical tail from @10, Parfum last) so all four Parfum-last formulas are read the same way.

### B2 — P25 OLAPLEX No.4: cautious `heavy` rests on the same reading

Both lanes put weight at `low` confidence (W3, closely balanced), so the product is `needs_research` and nothing is applied. Lane A's `high` again uses W-RICH from oils @24–26 that sit after 23 botanical extracts in a 60+ item list. Resolve it together with B1. Do not treat the cautious `heavy` as a finding about the product.

### B3 — P04 Maria Nila Purifying Cleanse: `scalp_active` focus rests on a reset sentence

Focus fell through from `clarifying` (F6 fails: cleansing low) to `scalp_active` via SC1 "itchy scalp" positioning. The units relied on:

- "Wenn du mit fehlendem Volumen, Gelbstich oder einer juckenden Kopfhaut zu kämpfen hast, … ist es Zeit, deine Haare zu resetten" lists reasons to do a reset; it does not say the product treats an itchy scalp. It is borderline under E2a.
- "…während der Aloe-Vera-Extrakt dazu beiträgt, gereizte und juckende Kopfhaut … zu beruhigen" is an ingredient-subject sentence. E2a says these never qualify. Lane A cited it; lane B correctly treated it as supportive only.

If the reset sentence is not positioning: `not_targeted`, focus `general`, and the `review_specialist_gate_failed: sensitive` flag disappears. Rows are the same either way (ordinary, gentle). Re-check at the existing review flag; low impact.

## (c) Rule questions for Nick

### C1 — "fettiges Haar" is not an oily-scalp claim, but "schnell fettendes Haar" is (E2 lexicon)

Aveda Rosemary Mint Purifying (#5) says on the DE manufacturer page "Normales bis fettiges Haar wird mit diesem … klärenden Shampoo sanft gereinigt". Both lanes correctly applied E2: the phrase names the hair, not the scalp or roots, and is not the listed term "schnell fettendes Haar". The formula passes every S-OILY clause, and the focus is already `clarifying`.

User example: Lena has oily roots and normal-thickness hair, and Aveda positions this shampoo for her. Under v1.6 she never sees it. In German usage "fettiges Haar" means greasy roots almost always. The lexicon already accepts "schnell fettendes Haar", which also names the hair.

Question: add "fettiges Haar" / "für fettiges Haar" to the E2 oily lexicon in the v1.6.1 step? That would put Aveda on the oily path: fine amber, normal green, coarse amber.

### C2 — Sulfate-free clarifiers become "gentle everyday shampoos" (C3/C6 + R16.3)

Moroccanoil Clarifying (#14), OLAPLEX No.4C Clarifying (#15) and Maria Nila Purifying Cleanse (#13) are all explicitly positioned deep cleansers (D1 true). All three are built on mild surfactants (C6 → `low`) plus a chelator or acid system: EDTA/GLDA/EDDS and sodium polystyrene sulfonate in Moroccanoil, GLDA/EDDS in Olaplex, an AHA set in Maria Nila. C3 says chelators and acids are "not a cleansing route". R16.3 then gives `gentle`, no deep-cleanser entry and an informational note. Moroccanoil even ends up with focus `moisture`.

The mechanics are applied correctly, and the surfactant part really is mild. The dispute is about what an expert calls "clarifying": a chelating clarifier removes hard-water minerals, metals and product build-up without a harsh surfactant. Section 4's own "required evidence" lists "clarifying, chelating or reset architecture", but no convention reads it.

User example: Jana swims twice a week and asks for a Tiefenreinigung. Moroccanoil Clarifying, a well-known clarifier, never appears in the deep-cleanser list. Instead it shows as an amber "gentle" everyday shampoo for normal scalp.

Options:

1. Keep it as ruled in R16.3 (honest about surfactant mildness).
2. Add a "mild clarifier" deep-cleanser path: D1 true, plus a prominent chelator system, plus cleansing `low`/`moderate`. Intensity stays `gentle`/`regular`.
3. Defer to the deep-cleanser category's own rules.

This is a proposal, not a decision.

### C3 — Unlisted surfactants decide cleansing in both directions (known C3 gaps)

- Color Wow Hooked (#16): Sodium Methyl 2-Sulfolaurate is a sulfo-ester sold as a "sulfate-free" primary surfactant. Lane A read it as mild (`low`), lane B as a sulfonate (`strong`). Most formulators would call it mid-strength, which no convention can return. Effect today: either gentle/amber for everyone or needs_research.
- GLYNT DERMA (#17): Sulfated Castor Oil @16 (Turkey-red oil, a weak, refatting surfactant) is counted as a reinforcing strong anionic, turning C5 `moderate` into `strong` against the claim "reinigt mild". No visible effect today, but it would matter for a sensitive/dry target.

Both are already in the run-log as C3 table gaps. Recommendation: settle them in the same R16.4/v1.6.1 batch. Sodium Methyl 2-Sulfolaurate and Disodium 2-Sulfolaurate → mild anionic (sulfo-ester, like sulfoacetates). Sulfated Castor Oil → not a reinforcing route.

### C4 — Selenium sulfide (already ruled)

Vichy Dercos Anti-Schuppen (#21) and Davines Purifying (#22) are named or pack-front positioned against dandruff but project `ordinary`, because Selenium Sulfide is not on the Section 11 list. Already ruled: the addition goes into v1.6.1, then both are re-projected. Listed only for completeness.
