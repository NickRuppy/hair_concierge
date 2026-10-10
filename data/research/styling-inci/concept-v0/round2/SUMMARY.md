# Styling calibration round 2: summary (2026-10-09)

**Lanes**
- F1–F3: authoritative claim freeze for the round-1 Styling products (Henkel / other mass / salon brands).
- G1: gap fill for curls and refresh.
- G2: gap fill for finish, texture and salt sprays.
- G0: formal Leave-in border check.

**Result:** `../calibration-set-r2.json`, built by `../build-calibration-r2.js`.

> **Current state, after D7, D8/D8b and the pre-push Codex review fixes:**
> - 70 Styling products: `curl_cream` 5, `gel` 9; 5 provisional (the Bali Curls spray, with two INCIs under one GTIN, went back to provisional).
> - C1/C2 claims on 56 of them.
> - Hold: 1:4 · 2:9 · 3:11 · 4:10 · keine Herstellerangabe 36. There is no formula-derived 0 any more (D8).
> - Wella EIMI levels now come from strength words, because no denominator is stated: Sugar Lift 3, Flowing Form 1.
> - Balea Ultra Volumen = 4: its house-brand dm attribute counts as C2.
>
> The tables below show the state before these changes.

## Totals (90 products)

| Route | Count |
|---|---|
| Styling | 68 |
| Leave-in | 9 |
| Oil | 3 |
| Heat Protectant | 2 |
| Dry Shampoo | 1 |
| Provisional boundary | 7 |

Styling subtypes:

| Subtype | Count |
|---|---|
| gel | 10 |
| molding | 11 |
| blowdry_lotion | 8 |
| hairspray | 6 |
| shine_finish | 6 |
| mousse | 5 |
| salt_spray | 5 |
| texture_spray | 5 |
| hair_powder | 4 |
| smoothing_styler | 4 |
| curl_cream | 2 (+3 provisional, D7) |
| refresher | 2 (+3 provisional) |

**Claim authority:** 53 of 68 Styling products now have C1/C2 claims (C1 7 · C2 31 · C2 house brand 15). Round 1 had almost none from a manufacturer source. The remaining 15 are C3 or C5.

## Hold, Chaarlie scale 0–4 (68 Styling products)

| Level | 0 | 1 | 2 | 3 | 4 | review |
|---|---|---|---|---|---|---|
| Count | 6 | 4 | 9 | 8 | 9 | **32** |

The main finding: **about half of the products state no hold strength at the manufacturer.** They give duration („48 h“), look („natürlicher Halt“), flexibility („flexibel“), unquantified words („perfekter / langanhaltender Halt“), or nothing at all. Retailer copy adds strengths that no manufacturer source confirms. Example: Douglas gave L'Oréal Barber Club "starker Halt", while the brand page says only "perfekten Halt". Living Proof's DE hold wording is retailer copy only, and its US page has a different formula.

Holds that changed after the authoritative capture (11 products):

| Product | Round 1 → Round 2 | Why |
|---|---|---|
| Syoss Schaumfestiger Volume | review → 3 | syoss.de states "Haltegrad 4" |
| Maria Nila Curlicue | review → 2 | marianila.de states "Halt 3/5" |
| got2b Strand Matte | 1 → 2 | got2b.de says "mittlerem Halt"; dm said "leicht" |
| got2b Texture Clay | 3 → 4 | brand says "ultra krass" |
| Wellaflex Locken | 3 → 2 | pack shows 3 of 5 dots; the word "stark" is inflated |
| Wella EIMI Sugar Lift | 3 → 2 | DE page states "Haltegrad 3" (x/5) |
| Syoss Curl Creme-Gel | 3 → review | no strength on syoss.de; "hold 5" only on the English page; reformulated |
| got2b Powderfull | 1 → review | brand says only "natürlichem Halt" |
| Living Proof Full Dry Texture | 1 → review | DE claim is C3 only; US formula differs |
| American Crew Fiber | 4 → review | C3 only |
| L'Oréal Barber Club Pomade | 3 → review | brand page says "perfekten Halt" only |

## Brand scales found (normalisation tables in the build script)

| Brand | Scale | Notes |
|---|---|---|
| **Henkel** (Taft, Syoss, got2b) | sprays, foams and Föhnspray: Haltegrad up to 5, with 5+ and 6 in the Ultimate/Marathon lines | **Gels use a separate 4–14 scale** ("von 4 für natürlichen Halt bis 14"). No legend is published. Words inflate: Syoss calls 3 "starker Halt", Taft calls 3 "mittlerer". Numbers are shared across the brands, so the number wins. |
| **Wellaflex** | 1–5 dots | flexibel 2 · stark 3 · extra stark 4 · ultra 5 · mega 5+ |
| **NIVEA MEN, Gard** | printed 1–6 | — |
| **Alcina** | Hold-Faktor and Flex-Faktor, 1–10 | — |
| **Maria Nila** | x/5 | on every product |
| **Wella EIMI** | "Haltegrad" 1–4 seen | no maximum stated |
| **Elnett** | word ladder: Normal < Stark < Extra stark | INCI identical across the ladder; "Sehr stark" is unranked |
| **American Crew** | Haltfaktor/Glanzfaktor | no maximum, may differ per product |
| **Kevin Murphy** | words (Soft/Flexible/Strong/Maximum) | non-DE pages only |

## Border check (G0) and new owner questions

- **D6 applied:**
  - Balea Locken Revitalizing → Styling `refresher`;
  - Balea Sea Salt Care & Define → `salt_spray`;
  - Bali Curls Curl Defining Spray → `gel` (spray), after the D6 wording fix: starch/salt ≠ fixative-class hold.
- **New ruling needed (D7), the curl-cream middle band:** a high fixative *and* a substantive conditioning system. A mechanical rank rule ("fixative before the first cationic") would move NEQI to Styling, contradicting T15, so a mechanical rule doesn't work.
  - Taft Styling Balm Locken: PVP r5, PQ-37 r6, esters r2/r3.
  - Balea Traumlocken: cetearyl r2, VP/VA r3.
  - John Frieda Lockencreme: acrylates r2, fatty alcohols r4/r5.
- **New ruling needed (D8):** how matching treats the ~half of products with no stated hold strength.
- **Technical (for the research standard, not urgent):** in light mists, does an early preservative "tail marker" bound a cationic conditioner below it? (alverde Refresh, Langhaarmädchen Lockenwunder, Syoss Hydrating). Does oil without a cationic count as "conditioning" for D6? (Balea Definier Spray). These stay `provisional_boundary` until ruled.

## Data-quality notes

- **Possibly delisted or not sold in DE:** Taft Aloe Boost Texturspray, Syoss Curl Control Hydrating Spray, Elnett Stylingspray 3 Tage Glatt (dm still sells it).
- **Reformulated:** Syoss Curl Cream Gel and Max Hold Wax; John Frieda Ansatz-Booster (three formulas in circulation); Bali Curls Curl Defining Spray (two INCIs under one GTIN).
- **dm adds claims** the brand pages don't make: Taft "bis zu 24 h", "Ultra starker Halt", "Föhnschutz".
- **Retail filters contradict the INCI:** alverde Beach Waves "ohne Alkohol" (alcohol r3); Color Wow "silikonfrei".
- **Possible duplicate:** Balea "Finishing Spray Glow & Care" (round 2) vs "Glow&Shine Finishing Spray" (round 1). Check the GTIN.
- **Lane discipline:** one lane downloaded a Henkel press PDF despite the no-download rule. It was session scratch only, read as data, and has been removed.
