# Blind review notes — leave-in gold set

Standard: `leave-in-classification-standard.v0.1.md` (`leave-in-inci-v0.1`)
Packet: `leave-in-gold-set-blind-v0.1` (13 entries)
Engine run: `blind-review-2026-09-03`
Lane: sealed independent blind reviewer. No key, no other lane's output, no repo file outside the four sealed documents.

Machine-comparable record: `blind-review.json` (same directory).

**How to read these notes.** Section 1 is per product: a short reasoning summary and the hardest call. Section 2 is the cross-cutting ambiguity register — the part that should drive the calibration decisions. Section 3 records method choices I had to invent because the standard does not specify them; if the other lane invented different ones, that is a rule gap, not a disagreement about the product.

---

## 1. Per-product notes

### Slot 1 — alverde Leave-In Sprühkur Express 7in1

Water leads, but a vegetable oil sits at #2 and Alcohol Denat. at #3, with **no emulsifier, no solubiliser, no cationic species and no fatty alcohol anywhere**. That combination matches none of the five FORM architectures, so FORM is `unknown`. Conditioning rests on a single emollient package (sunflower hybrid oil, dicaprylyl ether, isoamyl laurate) — `moderate`, since `high` is gated on an LGN pair that cannot exist here. WT is the interesting one: two persistent non-volatile families plus castor oil, a named rich-band member, clears the `high` anchor, but castor sits below the Levulinic Acid / Sodium Levulinate marker and the manufacturer claims the product does not weigh hair down. I kept the trace at `high` and used §10.1 to project `moderate`, marking the field uncertain.

**Hardest call.** HEAT. **Hydrolyzed Wheat Protein is at #14 and is a literal member of the closed L9 list.** Read strictly, §13.2's row "a member of the closed L9 list present in a plausible film-forming context → `formula_plausible`" does not require a claim, and the `not_claimed` row requires *both* no claim and no L9 member — so a naturkosmetik spray with no heat claim would land on `formula_plausible`. I refused that on the "plausible film-forming context" clause (a plain tail-position hydrolysate is not a film) and set `not_claimed` / binary `false`. This is the single most likely source of a lane disagreement in the set.

**Also worth flagging.** German retailer listings for this exact product name carry GTIN `4067796199635`, not the packet's `4066447919387`. Preserved as a conflict, not resolved (G5), and routed to review.

### Slot 4 — alverde Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan

The cleanest record in the set. `two_phase` on the shake instruction plus a bulk oil phase; COND `moderate` on the oil package; WT `high` on the explicit "two-phase carrying a substantial oil/silicone phase" branch — evidenced by soy oil at #2, not by the spray format, so G9 holds. PERS `neutral_non_volatile`, HOLD `none`, HEAT and HUM both `not_claimed`, `care_direction: moisture`. Mandatory review as a two-phase product.

**Hardest call.** ROLE. The packet gives only "Vor Gebrauch gut schütteln" — a shake instruction, not a usage statement. §7.13 says missing directions make ROLE `unknown` and never license a formula guess. I found a damp-or-dry statement at secondary-discovery tier and set `[post_wash, refresh]` at `low` confidence rather than `unknown`. A stricter reader would return `unknown`, and I would not argue.

**Second hardest.** `texture_fit` is `unknown` in my record because §10.3 has no row for **high weight with moderate slip** — row 3 requires high slip. I refused to interpolate. See §2.7.

### Slot 11 — Balea Leichtkämmspray Pure Styling

Eleven ingredients, no lipid, no silicone, no fatty alcohol. FORM `aqueous_or_hydroalcoholic_solution` at high confidence; WT `low` at `moderately_high` confidence — the one product in the set where §7.5's confidence-raise clause is genuinely earned, because the whole non-volatile architecture is readable. EXPO `no_listed_fragrance_signal`.

**Hardest call — and my loudest finding.** The same single observation, `Cetrimonium Chloride #4`, yields **COND `low`** (its anchor names "only a short-chain quat" as the low case) and **SLIP `moderate`** (a cationic route present as architecture is one M1 contributor, and the `low` anchor explicitly requires *no* cationic species above the tail). Both readings are correct against their own anchors and they contradict each other about whether a monomeric short-chain quat is "a route".

**Second finding, product-level.** The `focus` hierarchy makes a dedicated detangling spray come out as **`volume_lightness`**. `detangling` requires SLIP `high`, which needs two independent M1 contributors — structurally impossible for a light aqueous detangler — while `volume_lightness` fires on WT `low` plus no film route. The anchor table inverts the product's actual purpose. I recorded `volume_lightness` because §10.2 rule 4 forbids positioning from creating a route, and flagged it.

### Slot 2 — Balea PROFESSIONAL Magical Water Aqua Hyaluron

Alcohol Denat. at #1, Aqua at #2, **Myristyl Alcohol at #3** with Behentrimonium Chloride at #6. FORM is `unknown`: the solution anchor explicitly forbids a long-chain fatty alcohol, and the emulsion anchor enumerates Cetearyl/Cetyl/Stearyl Alcohol — C14 myristyl is not listed, and an LGN is implausible at the alcohol level the #1 position implies. COND/SLIP `moderate` on one cationic route; SFR `moderate` as an interpolation.

**Hardest call.** PERS. The persistent species here are a monomeric long-chain quat and a fatty alcohol. `permanent_cationic` enumerates silicone quats, high-charge polyquaterniums and cationised proteins; `ph_dependent_cationic` needs an amodimethicone or amidoamine; `neutral_non_volatile` is defined by dimethicone/dimethiconol/esters/oils. **Behentrimonium chloride belongs to none of the four classes**, and it is the most substantive thing in the bottle. I assigned `volatile_or_water_soluble` as the lowest defensible residue and said plainly in the record that this probably under-states persistence. Same problem, same resolution, at slot 11.

**Note on WT and G9.** I did *not* let FORM `unknown` force WT `unknown`, even though §7.5's `unknown` anchor says "Form or non-volatile architecture unresolved" — that clause makes FORM a determinant of WT, which G9 forbids. See §2.3.

### Slot 3 — Cantu Leave-In Haarkur Repair Creme

Textbook LGN emulsion (Cetearyl Alcohol #3 + Behentrimonium Methosulfate #5) with canola #2, shea #6 and olive #7 behind it. COND `high`, SLIP `high` with `both` bias, WT `high` at `moderately_high` confidence, transfer caution attached. PERS `neutral_non_volatile`; R2 `none_visible` despite the "Repair" name — there is no protein or silane in the formula at all.

**Hardest call.** `focus.primary`. SLIP `high` with a `both` bias clears the `detangling` anchor exactly. But §10.2 rule 1 says an ordinary conditioning architecture "does not automatically make `detangling` the distinctive purpose", and Cantu's slip is entirely baseline conditioning. I recorded `detangling` (the anchor is explicit and the slip rests on three independent contributors) but marked `focus.primary` uncertain. If the other lane returned `general`, that is a rule gap, not a data disagreement — see §2.6.

**Second.** SFR held at `moderate` rather than `high` because the only continuous-film candidate, Polyquaternium-10, sits at #30, two places below Phenoxyethanol at #28.

### Slot 6 — Curlsmith Hydrate & Plump Leave-In

LGN emulsion with castor #5, shea #9, jojoba #10, Guar HPTC #11 and PQ-10 #12. COND `high`, SLIP `high`, **SFR `high`** (the substantive cationic-polymer film is a genuinely additional endpoint-relevant observation), WT `high`. EXPO `aromatic_or_allergen_exposure` from two named allergens with no Parfum declared — the L8 vocabulary handles this correctly.

**Hardest call.** `curl_definition` as primary focus, which fires only because **PVP at #32** — sitting among maltodextrin and cyclodextrin, plausibly a complexing carrier — makes HOLD `incidental_film`, and the anchor is `HOLD ∈ {incidental_film, meaningful_hold_route}` plus compatible COND/WT. That is an extremely low bar: any conditioner with a trace fixative polymer becomes a curl-definition product. I recorded it with `low` confidence and flagged it.

**Second.** PERS `neutral_non_volatile` rather than `permanent_cationic`. Guar HPTC is among the most substantive materials in the category and FS-20 exists precisely to warn about it — but "high-charge-density" is not readable from an INCI list (G4), and neither guar HPTC nor PQ-10 is enumerated in the top class. I took the lower class and recorded the counter-signal inside PERS rather than emitting a buildup caution that would contradict the assigned class.

**Third.** WT `high` with `fine: caution` sits directly against the manufacturer's "ideal for fine to medium, lifeless hair" positioning. Conflict preserved, not resolved.

### Slot 5 — EVO Head Mistress Cuticle Sealer

Aqua-led silicone emulsion: Dimethicone #2, Cyclopentasiloxane #3, Polyacrylamide #4, Dimethiconol #5. Emulsified by a Sepigel-type polyacrylamide / C13-14 isoparaffin / laureth-7 system. SFR `high`, SLIP `moderate` `dry_biased`, WT `moderate` (exactly one persistent family; the volatiles contribute nothing — FS-4 checked). Regulatory trigger `2027-06-06` stamped for the cyclopentasiloxane.

**Hardest call.** FORM. **The §7.1 `emulsion` row recognises only the cationic-surfactant/fatty-alcohol LGN pair**, so a nonionic/polymeric silicone emulsion — an extremely common leave-in architecture — has no row. I assigned `emulsion` on the FORM *definition* ("the colloidal architecture of the product") rather than on its anchor, at `low_moderate` confidence, and flagged the gap. The same gap bites slots 8 and 9.

**Second.** COND capped at `moderate`. The `high` anchor is gated on an LGN pair, so a dimethicone/dimethiconol-led leave-in is **structurally incapable of reaching high conditioning** regardless of silicone load. That is probably not what the ontology intends.

**Third.** R2. Quaternium-80 at #14 is a silicone quat, which is one of the four enumerated `candidate` routes. I returned `none_visible` on materiality grounds — partly because `candidate` would have made **`repair`** an available primary focus for a smoothing cream, which is plainly wrong. See §2.5.

### Slot 12 — Kevin Murphy Young.Again Oil

**`excluded_anhydrous`** at high confidence: Cyclopentasiloxane #1, Dimethicone #2, Dimethiconol #3, and Water at **#23** — Aqua is present but absent from the top of the list, which is the gate's operative test. Routes to the oil/serum category. Dimensions completed as informational only; no production profile projected.

**Hardest call.** Not the boundary — that one is easy. It is HUM. The brand makes **no humidity claim**, but a persistent hydrophobic silicone film with no dominant humectant architecture satisfies `formula_plausible` word for word, and `not_claimed` requires *both* no claim and no qualifying route. So the ladder emits `formula_plausible` — an implicit humidity claim the brand never made. I assigned it per the letter and flagged it hard. Same defect at slots 8 and 9.

**Identity red flag.** The packet formula declares **Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde**, prohibited in EU cosmetics since 2021, plus Violet 2 (CI 60725). This is strong evidence that the packet's formula is not the current Germany/EU market version. Preserved as a `provisional_formula_conflict` and routed to review. No GTIN either.

### Slot 7 — Maria Nila Curlicue Cream

**`excluded_styling_first`.** PVP at #4 in a film-forming context; behind it, a lone unpaired Cetyl Alcohol, no oil, no silicone, and Quaternium-95 sitting below Carbomer. The manufacturer sells it as a "Curl Defining Styling Cream" and publishes a graded **Hold 3/5**. HOLD `meaningful_hold_route` → G0 styling review → exclusion. `provisional_boundary` is the credible alternative and I would accept it.

**Hardest call.** Whether to read SFR up on the PVP film. I did not: M5_FIXATIVE_FILM feeds HOLD, CURL and HEAT, and §7.7 says explicitly that a hold route and a conditioning route are different mechanisms. SFR stayed `low`. This was the cleanest gate application in the whole set and I want it recorded as a case where the standard worked.

**Claim-authority problem.** A retailer describes PVP as "the heat protecting molecule". The manufacturer's own page makes **no heat claim**. I set HEAT `not_claimed` on the manufacturer's copy. **The standard defines a source hierarchy for directions but not for claims** — see §2.9. Note also that plain PVP is *not* on the closed L9 list (which carries VP/Acrylates/Lauryl Methacrylate Copolymer and PVP/DMAPA Acrylates Copolymer), so even a claim would have stopped at `claim_only`.

**Third.** FORM `unknown` — a Carbomer/TEA aqueous gel-cream with a solubiliser and an unpaired fatty alcohol has no row in §7.1.

### Slot 13 — Neqi Diamond Glass Ultimate Styling Spray

In-category despite "Styling Spray" in the name: German manufacturer directions (T1) put it on towel-dried hair before a blow-dry, and a substantive silicone film architecture (Polysilicone-29 #7, Silicone Quaternium-18 #11) stands behind the single VP-family polymer. FORM `microemulsion`. PERS `permanent_cationic` on the silicone-quat family match, with the buildup caution attached. HEAT `claim_only` + binary `true` + review; HUM `claim_only` (four glycols including the #2 ingredient = a dominant humectant architecture). ROLE `[post_wash, heat_styling]` at `moderately_high` — the only first-tier German directions read in the set.

**Hardest call — and a direct internal contradiction in the standard.** §7.5's `high` anchor ends with "**or** a two-phase or microemulsion carrying a substantial oil/silicone phase". Applied here, FORM alone sets WT `high` — which is **exactly what G9 forbids** ("FORM may never set WT. 'Spray ⇒ light', 'cream ⇒ heavy', 'clear ⇒ light' … are hard failures"). I treated G9 as governing, assessed the readable non-volatile architecture instead, and returned WT `moderate`. See §2.3.

**Second.** R2 `candidate` on the silicone quat makes `repair` an available focus, but the §10.2 `repair` row itself says "generic silicone… or cationic polymer… cannot set it" — the row's own qualifying condition and its own exclusion contradict each other. I chose `heat_styling` as primary. See §2.5.

### Slot 10 — Olaplex N°.6 Bond Smoother

LGN emulsion (Cetearyl Alcohol #2 + Behentrimonium Chloride #7) with Dimethicone #3, two volatile hydrocarbons at #4 and #8, Phenyl Trimethicone #9. COND/SLIP/SFR/WT all `high`. R3 `chemistry_candidate` on Bis-Aminopropyl Diglycol Dimaleate #11 with an open review flag and no repair level set; R2 `candidate` on the silanetriol protein at #24. HEAT `claim_only` + `true` + review (the 232 °C figure is recorded as a use condition and carried into no field). Reaches the third row of `damage_fit`.

**Hardest call.** `focus.primary` between `smoothing` (SFR `high`, formula-backed) and `repair` (R3 `chemistry_candidate` plus R2 `candidate`, which the §10.2 row explicitly admits). Choosing `repair` would mean a product's *primary* user-facing purpose is set by a bond claim whose salon evidence G8 bars and whose chemistry independent spectroscopy failed to confirm. I chose `smoothing` primary with `repair` secondary and marked primary uncertain. §10.2 rule 3 ("evaluate special-purpose routes first") does not rank two special-purpose routes against each other.

**Second.** HUM `formula_plausible`. §7.9's state definition requires "no *dominant* humectant architecture", but the mandatory counter-signal sentence says humectants materially present "**lower** this state and never raise it". Propanediol at #10 is materially present but not dominant. Those two sentences give different answers. I applied the "dominant" test. See §2.4.

**Third.** ROLE has no `heat_styling` because the directions never name a heat tool — so the `heat_styling` *focus* cannot fire even though the product carries a 232 °C claim. The claim survives only in the binary. I think that is correct behaviour, but it is worth confirming it is intended.

### Slot 9 — Redken Extreme Anti-Snap Leave-In Treatment

Amodimethicone #4 → PERS `ph_dependent_cationic` with the buildup caution; SLIP `high` `dry_biased` (this formula has **no humectant at all** — no glycerin, no glycol, no panthenol); SFR `high`; R2 `candidate` on the silanetriol protein at #14. FORM `emulsion` on the definition, not the anchor (same Sepigel gap as slot 5).

**Hardest call — a methodological one that changes the whole record.** **Phenoxyethanol sits at #3.** Phenoxyethanol is capped at 1 % in the EU, and Article 19 orders only the >1 % fraction. On a strictly descending list, that places **everything from #4 downwards in the unordered sub-1 % tail** — including amodimethicone, the entire conditioning architecture and the LGN pair. That is a bounded rank observation, which §3.1 permits, not a percentage inference, which G4 forbids. Read strictly, WT would be `low` ("no persistent non-volatile family above the tail") and COND `low`. I did not go that far: I returned WT `moderate` at `low` confidence with the ordinal observation recorded as a strong counter-signal, and flagged the field uncertain. **The standard has no operational definition of "above the tail", and this product is where that bites hardest.** See §2.2.

**Second.** The heat claim is a **system-level claim** — "5-in-1 damage protection … when used as a system of Extreme Shampoo, Conditioner and Anti-Snap". §13.3's claim-led rule assumes a product-level claim and gives no rule for this case; §14 separately lists routine-level efficacy evidence for a single leave-in as a review trigger. I set the binary `true` (claim leads) and routed to review on both grounds.

**Third.** `care_direction: balanced` — the only `balanced` in the set. A substantive silane film route sits alongside a conditioning/emollient architecture with the humectant leg entirely missing, so `moisture` is unavailable and `protein` would overstate. Confidence `low`; flagged uncertain. §9 insists `balanced` is not an uncertainty bucket, and I want it on record that I did not use it as one.

**Fourth, product-sense.** `damage_fit.highly_damaged` comes out `conditional` for a product sold specifically for highly damaged hair, because the third row requires `conditioning_level = high` and R2 `candidate` alone cannot lift it. See §2.8.

### Slot 8 — Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair

Trisiloxane #2 (volatile carrier — contributes nothing to residue, FS-4 checked), then Dimethicone #3, apricot kernel oil #4, Phenyl Trimethicone #5, Dimethiconol #8, PQ-16 #9. SLIP `high` `both`, SFR `high`. HEAT `claim_only` on the 230 °C claim with no L9 member → binary `true` + review. `care_direction: moisture` despite the product being sold entirely on keratin repair — hydrolyzed keratin is a plain hydrolysate, and §9 requires L6 or R2 `candidate`.

**Hardest call.** WT. **Three** persistent non-volatile families occupy #3–#9 with no capped preservative marker before #14 — an unusually well-established architecture — but **none of them is an enumerated rich/low-spreading band member** (apricot kernel oil is a medium-band liquid oil). §7.5 `moderate` says "exactly one persistent non-volatile family"; §7.5 `high` requires two-or-more **and** a rich-band member. Neither row fits. I assigned `high` at `low_moderate` confidence on ordinal depth of load. At slot 9, facing the same gap with a much shallower load, I assigned `moderate`. **That distinction rests on my judgment about list position, not on any anchor** — the most likely place for a defensible lane disagreement. See §2.1.

**Second.** FORM `unknown`. A silicone-emulsifier (Cetyl PEG/PPG-10/1 Dimethicone) O/W system carrying a bulk silicone and oil phase, with a cationic polymer, a short-chain quat and no fatty alcohol, matches no row: the solution anchor forbids a real emulsifier, the emulsion anchor demands an LGN pair, the microemulsion anchor demands several solubilisers plus glycols high.

**Third.** R2 `none_visible` even though hydrolyzed keratin sits at **#6**, high in the list. The `none_visible` anchor describes "a plain hydrolyzed protein sitting in **the tail**" — it does not cover a plain hydrolysate high in the list. I resolved it from the `candidate` list instead (a plain hydrolysate is not a cationised protein, silane, silicone quat or high-charge polymer), so the value is the same, but the anchor wording has a hole in it.

---

## 2. Ambiguity register — where the standard could not decide

Ordered by how likely each is to produce systematic lane disagreement.

### 2.1 §7.5 WT has no anchor for "two or more persistent families, no rich-band member" — hit 3 times

`moderate` requires **exactly one** persistent non-volatile family. `high` requires **two or more families AND at least one rich/low-spreading band member**. A formula with two or three persistent families and no butter/coconut/olive/castor/avocado/petrolatum member falls between the rows. Hit at slot 1 (resolved `high` via castor), slot 8 (resolved `high` on ordinal depth) and slot 9 (resolved `moderate` on ordinal shallowness). **My slot-8 vs slot-9 split is a judgment call with no rule behind it.** Also unenumerated in any L3 band: sunflower/high-oleic sunflower, soy, argan, apricot kernel, macadamia, safflower, canola, myristyl myristate, neopentyl glycol diheptanoate.

**Suggested fix:** add a `moderate`/`high` tie-breaker that keys on family count *and* ordinal depth, and either extend the L3 band table or state that unenumerated liquid vegetable oils default to the medium band.

### 2.2 "Present as architecture" / "above the tail" is never operationalised — affects every dimension

Almost every anchor in §7 turns on whether an ingredient is "present as architecture" or "above the tail", and the standard never says how to decide. §3.1 permits bounded rank observations and forbids percentage inference, which leaves exactly one visible marker: the position of a concentration-capped preservative or fragrance-allergen block. I used that consistently (Phenoxyethanol, Sodium Benzoate, Hydroxyacetophenone, Ethylhexylglycerin, Levulinic Acid/Sodium Levulinate). It is decisive at slot 9 (Phenoxyethanol at **#3** puts the entire conditioning architecture in the sub-1 % tail), slot 3 (PQ-10 below Phenoxyethanol), slot 5 (Quaternium-80 below Phenoxyethanol) and slot 1 (castor below the levulinate pair).

**Suggested fix:** make the preservative-marker heuristic an explicit, named method in §3.1 with its limits stated — or explicitly forbid it. Either is fine; silence guarantees divergence.

### 2.3 §7.5's microemulsion/two-phase clause contradicts G9 — decisive at slot 13

§7.5 `high`: "…**or** a two-phase or microemulsion carrying a substantial oil/silicone phase." G9: "FORM may never set WT. 'Spray ⇒ light', 'cream ⇒ heavy', '**clear ⇒ light**' … are hard failures." The clause reads WT off the FORM value. At slot 4 it is harmless (soy oil at #2 evidences the oil phase independently). At **slot 13 it is decisive**: applying the clause gives `high`, applying G9 gives `moderate`. I applied G9.

Related: §7.5's `unknown` anchor ("**Form** or non-volatile architecture unresolved") also makes FORM a determinant of WT. I ignored it at slots 2 and 8 and assessed WT from architecture alone.

**Suggested fix:** rewrite the clause to key on the *observed oil/silicone rank*, not on the form label, and delete "Form or" from the `unknown` anchor.

### 2.4 §7.9 HUM: `formula_plausible` fires with no claim, and the humectant rule is self-inconsistent

Two separate defects.

**(a) No-claim `formula_plausible`.** `not_claimed` requires "no claim **and** no qualifying route". `formula_plausible` requires only a route. So any silicone-film leave-in that makes no humidity claim lands on `formula_plausible` — the profile then asserts humidity plausibility the brand never claimed. Hit at slots 8, 9 and 12. I assigned it per the letter and flagged all three.

**(b) "Dominant" vs "lowers it".** The `formula_plausible` requirement is "**no dominant** humectant architecture". The mandatory counter-signal says humectants materially present "**lower this state and never raise it**". At slot 10 (propanediol #10, material but not dominant) the two sentences disagree. I applied the "dominant" test consistently: slots 5 and 10 → `formula_plausible`; slot 13 (four glycols including #2) → `claim_only`.

**Suggested fix:** add a claim precondition to `formula_plausible` (or rename the state), and pick one humectant rule.

### 2.5 §10.2 `repair` row contradicts §7.10 `candidate` — and makes `repair` nearly unreachable

The `repair` anchor is "R2 ∈ {`candidate`, `tested`} **or** R3 = `chemistry_candidate`", then the same row says "generic silicone, oil, panthenol, ceramide, **cationic polymer** or generic repair naming cannot set it". But §7.10 *defines* `candidate` partly as "silicone quat" or "high-charge cationic polymer" — i.e. the row's qualifying condition and its own exclusion overlap. Decisive at slot 13 (silicone quat) and slot 5 (where I avoided the collision by returning `none_visible`). In practice `repair` is reachable only via a cationised protein or a silane.

**Suggested fix:** restrict R2 `candidate` to protein/peptide/silane routes and move silicone quats and cationic polymers to PERS and SFR only — or drop the exclusion clause.

### 2.6 §10.2 rule 1 contradicts the `detangling` anchor — decisive at slot 3

Rule 1: "Exclude baseline conditioning from the hierarchy. An ordinary conditioning architecture supports conditioning and slip; it does not automatically make `detangling` the distinctive purpose." Anchor: "`detangling` | SLIP `high` with a `wet_biased` or `both` bias." Every capable emulsion leave-in reaches SLIP `high` with a `both` bias. Either rule 1 is decorative or `detangling` is unreachable. I chose `detangling` at slot 3 and marked it uncertain; slot 8 got `smoothing` primary and `detangling` secondary.

**Suggested fix:** define "distinctive" operationally, e.g. `detangling` requires SLIP `high` with COND ≤ `moderate`, or requires a wet-biased architecture specifically.

### 2.7 §10.3 `texture_fit` rows are not exhaustive — one clean hit at slot 4

The three rows are "low weight, light dry-down", "moderate weight, balanced", "high weight **and** high slip". **High weight with moderate or low slip has no row.** I returned `unknown` for all four textures at slot 4 rather than guessing. Elsewhere I read the rows as weight-led (moderate weight → row 2 regardless of slip), which is itself an unstated interpretation.

**Suggested fix:** state whether the rows are weight-led with slip as a modifier, and add the missing case.

### 2.8 `damage_fit` third row is gated on `conditioning_level = high`, so specialist repair products for damaged hair cannot reach it

At slot 9, a leave-in sold specifically for highly damaged hair, carrying a genuine L6 silane film route, lands on `highly_damaged: conditional` because its COND is `moderate` — and COND is `moderate` only because the `high` anchor is gated on an LGN pair (see 2.10). The specialist-route upgrade is unreachable for exactly the products it was written for.

**Suggested fix:** allow the third row on `conditioning_level ≥ moderate` **with** a qualifying specialist route.

### 2.9 Claim authority is undefined — decisive at slot 7, load-bearing at slots 9, 10, 12

§2.4 gives a source hierarchy for *directions* (package → manufacturer → exact-GTIN retailer → other retailer → secondary). §13.3 and §7.9 turn on whether "the exact product claims" something, with **no hierarchy for claims**. Cases in this set:

- **Slot 7:** manufacturer makes no heat claim; a retailer calls PVP "the heat protecting molecule". I used the manufacturer → `not_claimed` / `false`. A retailer-inclusive reader gets `claim_only` / `true` + review.
- **Slot 10:** the 232 °C heat claim and the 72-hour humidity claim were recovered from amazon.de and salon retailers, not a first-tier German brand page.
- **Slot 9:** the heat claim is explicitly conditioned on system use.
- **Slot 12:** heat claims span 392 °F and 450 °F across sources.

Because the binary `provides_heat_protection` is **claim-led**, this gap directly determines a production field.

**Suggested fix:** extend the §2.4 hierarchy to claims and state the minimum tier that can set the binary.

### 2.10 §7.2 COND `high` is gated on an LGN pair, so silicone-led leave-ins are capped at `moderate`

`high` requires "an LGN pair present above the tail **plus** at least one further independent lubrication route". A dimethicone/dimethiconol-led product (slots 5, 8, 13) has no fatty alcohol by design and therefore cannot exceed `moderate` no matter how large the silicone load. Given that COND drives `conditioning_level` and `damage_fit`, this systematically down-rates a whole architecture class.

**Suggested fix:** add a second `high` route — e.g. two or more independent persistent lubrication routes present as architecture, one of which is a continuous film.

### 2.11 §7.6 PERS ladder has no class for monomeric long-chain quats, and its top class is unusable

Two problems.

- **No home for behentrimonium/cetrimonium chloride** as the dominant persistent species (slots 2, 11). None of the four classes describes them; I assigned `volatile_or_water_soluble`, which likely under-states persistence and therefore under-warns on buildup — the direction FS-20 exists to guard.
- **`permanent_cationic` is gated on "high-charge-density polyquaterniums"**, a property G4 forbids inferring from an INCI list, and its enumerated silicone quats are only Silicone Quaternium-16/-22. Guar HPTC and PQ-10 (slot 6), PQ-16 (slot 8), Quaternium-80 (slot 5), Quaternium-91/-95 (slots 12, 7) and Silicone Quaternium-18 (slot 13) all sit outside the enumeration. I reached `permanent_cationic` exactly once, at slot 13, and only on a family match to Silicone Quaternium-16/-22.

**Suggested fix:** enumerate the cationic polymers by INCI name rather than by an unreadable charge-density property, and add a class or a rule for monomeric long-chain quats.

### 2.12 §7.1 FORM table cannot classify four of the thirteen products

`unknown` at slots 1, 2, 7 and 8; assigned against the definition rather than an anchor at slots 5 and 9. The missing architectures are:

1. **Nonionic / polymeric-emulsifier emulsions** (Sepigel-type polyacrylamide systems; silicone emulsifiers) — the `emulsion` row recognises only the cationic LGN pair. Slots 5, 8, 9.
2. **Aqueous polymer gels** (Carbomer/TEA plus a solubiliser). Slot 7.
3. **Hydroalcoholic systems containing a fatty alcohol.** Slot 2 — and C14 myristyl alcohol is unenumerated.
4. **Water + oil + alcohol with no emulsifier and no shake instruction.** Slot 1.

Also: the `aqueous_or_hydroalcoholic_solution` label conflates a purely aqueous system (slot 11, no alcohol) with a hydroalcoholic one (slot 2), and the microemulsion/aqueous-solution boundary depends on product clarity, which is not an INCI observation and was not verifiable for slot 13.

### 2.13 §13 HEAT: "hydrolyzed wheat protein" is a closed-list member, and the ladder ignores the claim for L9 presence

Two coupled problems, both live at slot 1.

- The closed L9 list includes **hydrolyzed wheat protein** — a routine tail ingredient in mass-market leave-ins. The L9 list is therefore far less strict in practice than §13 assumes. The list should name the study concentration/context or drop the member.
- §13.2's ladder gives `formula_plausible` for an L9 member with **no claim requirement**, while §13.3 rule 3 says a formula with no claim yields `false`. So the trace state and the binary can point in opposite directions for a product with an L9 member and no claim. I resolved it via the "plausible film-forming context" clause; another reader could reasonably return `formula_plausible` + `false`.

Also unspecified: **whose** heat claim counts (2.9), and how a **system-level** claim (slot 9) interacts with the claim-led binary.

### 2.14 §7.3 SLIP bias is nearly unusable from formula

`wet_biased` requires "a volatile- or water-dominant architecture with **no persistent film**"; `dry_biased` requires "a **persistent film** (persistent silicone or substantive cationic) with few water-phase slip agents". A formula with a substantial **non-film persistent lipid load** (slots 1, 4) matches neither. A formula whose only persistent species is a monomeric quat (slot 2) matches neither. I returned `unknown` four times. §7.3 already flags the WET+DRY merge as provisional; the bias qualifier is the weaker half of it.

### 2.15 §9 `care_direction` has no value for silicone-led products

`moisture` is defined over L1/L3/L4; `protein` over L6. **L2 — the silicone route — appears in neither.** Slots 5, 12 and 13 are silicone-led and came out `unknown`. §9 also does not say whether `moisture` needs all three of L1/L3/L4 or any of them: slot 2 (L1+L4, no emollient) → I said `moisture`; slot 11 (L4 only, COND `low`) → `unknown`. That line is mine, not the standard's.

### 2.16 The lean profile has no `unknown` values except for `care_direction`

§10's `product_form`, `conditioning_level`, `weight_potential`, `persistence` and `hold_support` are closed enums with no `unknown`, but FORM, COND, WT, PERS and HOLD all *have* an `unknown` state in §7. I emitted `null` plus an `uncertain_fields` entry for `product_form` at slots 1, 2, 8 and 10 (Kevin Murphy/Maria Nila project nothing at all). The envelope needs either `unknown` members or an explicit null convention.

### 2.17 Excluded products: the standard does not say what to emit

§2.3 and G0 say excluded products "do not classify", but §16 says a product that leaves the category "retains its record as a boundary stress case", and this task asked for all 13 dimensions. I completed the dimensions for slots 7 and 12 marked **informational and non-authoritative**, and projected **no** production profile (all fit fields `unknown`, `out_of_category: true`). If the other lane either omitted the dimensions or projected a full profile, that is a spec gap, not a disagreement.

### 2.18 Smaller items

- **Polyacrylamide** (slots 5, 9) is not in the L5 rheology-exclusion enumeration (Carbomer, Xanthan Gum, HEC, Acrylates/C10-30). I excluded it by analogy. Same question for **Polysorbate 20** vs the enumerated solubiliser types, and for **PQ-16** and **VP/Methacrylamide/Vinyl Imidazole Copolymer** as VP-family film formers that L5 does not name.
- **§7.10 `none_visible`** says "a plain hydrolyzed protein sitting **in the tail**" — no rule for a plain hydrolysate high in the list (slot 8, hydrolyzed keratin at #6).
- **L6 lists "peptides"** as evidence for the substantive-film route; the §7.10 `candidate` list does not (slot 12, Hexapeptide-11).
- **§7.11 DOSE `low`** requires "a volatile-dominant carrier". Water is not a volatile carrier in the M6 sense (which covers volatile silicones and hydrocarbons), so a purely aqueous low-weight product (slot 11) technically satisfies no DOSE row. I read water as the carrier.
- **DOSE has no row for an anhydrous architecture** (slot 12).
- **§7.9 treats all glycols as humectants.** Dipropylene glycol at slot 13 #2 is at least as likely a solvent; that reading decides `claim_only` vs `formula_plausible` for that product.
- **`scalp_application_fit`** has no rule for directions that state a *placement* without mentioning the scalp. "Avoid the roots" (slot 5) → I used `avoid`; "auf die Längen" (slot 2) and "mid-lengths and ends" (slot 10) → `conditional`; silence → `unknown`.
- **Transfer caution** has no threshold. I attached it only where a *named* rich/low-spreading band member is present as architecture (slots 3, 6), not at slot 10 where the only such member is in the final tail position.

---

## 3. Method choices I had to invent

Recorded so a lane disagreement traceable to one of these is not mistaken for a product-level disagreement.

1. **Preservative-position tail marker.** Used the rank of a concentration-capped preservative (Phenoxyethanol, Sodium Benzoate, Hydroxyacetophenone, Ethylhexylglycerin, levulinates) as the visible boundary for "above the tail". Bounded rank observation only; no percentage was inferred or recorded.
2. **`unknown` over interpolation.** Where a table has no matching row I returned `unknown` and flagged the gap (FORM at 4 slots, `texture_fit` at slot 4, SLIP bias at 4 slots) rather than picking the nearest row — except where I say explicitly that I interpolated (WT at slots 8 and 9, SFR at slot 2, FORM-by-definition at slots 5 and 9).
3. **G9 over §7.5's microemulsion clause** at slot 13.
4. **"Dominant humectant" over "any humectant lowers it"** for HUM, applied consistently across slots 5, 10 and 13.
5. **Manufacturer copy governs claims**, retailer copy does not (slot 7). Where only retailer copy exists (slots 9, 10, 12) I accepted the claim and recorded the source weakness.
6. **`texture_fit` rows read as weight-led**, with row 3 additionally requiring SLIP `high`; high weight with non-high slip returns `unknown`.
7. **Excluded products** get informational dimensions and no production profile.
8. **Confidence vocabulary**: `low` / `low_moderate` / `moderate` / `moderately_high` / `high`, with every §7 formula-only ceiling treated as a hard maximum.

## 4. Seal statement

The seal held. I opened exactly four files, all under `.worktrees/leave-in-inci/`:

- `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.v0.1.md`
- `docs/research/leave-in-inci/v1.0/00_category_charter.md`
- `docs/research/leave-in-inci/v1.0/product-research-prompt.v0.1.md`
- `plans/leave-in-inci/research/gold-set/blind-packet.json`

No other repository file was read, listed, globbed or grepped, and no other lane's output was consulted. The only writes are `blind-review.json` and this file, both under `plans/leave-in-inci/research/gold-set/blind/`. Web research was used only for directions of use and product claims (E1 directions and E0 claims); **no ingredient list was re-sourced** — every formula observation above comes from the packet's `normalized_ingredients`, with list positions taken from that array.

Sources consulted for directions and claims: dm.de, marianila.com, neqi-hair.com, evohair.com, redken.com, curlsmith.com, lookfantastic/lockenbox, amazon.de, schwarzkopf.de, kevinmurphy.com.au, and general German retailer listings. Where a claim or direction rests on a weak source tier, that is recorded in the affected field's `counter_signals` and in the record's `assumption_notes`.
