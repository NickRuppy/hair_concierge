# S13 — Neqi Diamond Glass Ultimate Styling Spray

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 13 · 180 ml · GTIN 4063528094575 · `formulaFingerprintSha256` 0fc43a9c…d0ce

> **G0 = `provisional_boundary`.** Not an exclusion: the record stays in-category, is completed in full, and **every affected field is marked uncertain** (§2.3). Routes to review by definition (§14).

---

## G1 — identity, directions and claims

| Item | Value |
|---|---|
| Identity status | `verified_with_minor_source_difference` |
| Preserved conflicts (G5) | (a) **Name-based misclassification trap**: dm.de lists this product as „Leave-In Spray Diamond Glass Ultimate"; the manufacturer and galeria.de call it „Diamond Glass Ultimate **Styling** Spray". Same GTIN across three independent DE retailers; the name differs by retailer. **Classify by function + directions + architecture, never by name** (§2.3) — and note that the trap cuts both ways here: the retailer name would have argued it *into* the category and the manufacturer name would have argued it *out*, and neither was used. (b) A near-duplicate-GTIN sibling SKU 4063528078469 is recorded but unverified. |
| Directions verbatim | „Das Haar in Abschnitte unterteilen. Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen. Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen." |
| Directions authority | **C2** — neqi-hair.com, the manufacturer's page with a German „ANWENDUNG" section. |
| Rinse test (R11) | **PASS** — no rinse instruction; applied to towel-dry hair, then blow-dried under tension. |

**Claim capture performed this pass.**

| Field | Tier | Verbatim | Source |
|---|---|---|---|
| HEAT | **C2** | „intensiver Hitzeschutz bis 230°" | neqi-hair.com, retrieved 2026-09-04 |
| HUM | **C2** | „Starker Anti-Frizz-Effekt"; „reduziert Frizz spürbar"; „Feuchtigkeitsschutz — schützt das Haar langanhaltend vor Feuchtigkeit" | same |
| positioning | C2 | „verleiht dem Haar maximalen Feuchtigkeitsschutz und ultimativen Glanz" | same |

## G0 — product-form gate: `provisional_boundary`

As at slot 7, the two halves of §2.3 disagree — but here they disagree in the opposite direction, which makes the pair a useful matched test.

- **Pointing to `excluded_styling_first`:** §2.3's named trap 3 — "Run the HOLD anchor; `meaningful_hold_route` with thin conditioning is what excludes, not the word." HOLD is `meaningful_hold_route`: VP/METHACRYLAMIDE/VINYL IMIDAZOLE COPOLYMER sits at **rank 8**, above the tail, in a film-forming context, and the conditioning architecture behind it is thin — one silicone film former above the tail, one silicone quat *below* it, and a glycol water phase. The manufacturer's own name for the product is „**Styling** Spray".
- **Pointing to `in_category`:** the `excluded_styling_first` row requires the architecture **and** that "directions/positioning lead on durable hold or texture". The **C2** directions lead on nothing of the kind — they describe sectioning, spraying onto towel-dried hair and blow-drying under tension: a **blow-dry primer**, which the charter and §2.2 include explicitly ("blow-dry primers and heat-protective leave-ins when conditioning is meaningful"). The C2 claim set is heat protection, anti-frizz and shine — not hold. §2.3's trap 3 also states that "a 'styling prep' or 'mist' positioning does not by itself exclude".

The clause that would exclude and the clause that would include are both in §2.3 and both fire. `provisional_boundary` is the state the standard provides for exactly that, so the record is completed with affected fields marked uncertain and routed. The unresolved sub-question for the reviewer is whether "conditioning is meaningful" is satisfied by a single silicone film former at rank 7.

## Reading conventions applied

**Tail marker (§3.1.1):** `Ethylhexylglycerin`, **rank 9** of 15 (with `Hydroxyacetophenone` immediately after at rank 10 — the capped pair). Above the tail: ranks 1–8 — Aqua, Dipropylene Glycol, three botanical extracts, Pentylene Glycol, Polysilicone-29, VP/Methacrylamide/Vinyl Imidazole Copolymer.

**Decisive consequence:** **SILICONE QUATERNIUM-18 (rank 11)**, TRIDECETH-6 (12), TRIDECETH-12 (13), PROPYLENE GLYCOL (14) and GLYCERIN (15) are all tail members — in a fifteen-ingredient list where the marker sits at rank 9, i.e. the "tail" is the last third of a very short list and its members are *unpositioned, not absent* (§3.1.1 rule 4).

---

## §7 dimensions

### 1. FORM — `unknown` — **uncertain**

confidence **low** · E2 · scope formula. **This is §7.1's declared ambiguous middle, and the row says to return `unknown`.**
**formula_observations** AQUA (1) leading; DIPROPYLENE GLYCOL (2) and PENTYLENE GLYCOL (6) as early glycols; POLYSILICONE-29 (7), a silicone film-forming polymer, above the tail; SILICONE QUATERNIUM-18 (11) below it; TRIDECETH-6 (12) and TRIDECETH-12 (13), two solubiliser-type materials, both below the tail. No fatty alcohol, no cationic surfactant, no true O/W emulsifier, no bulk oil.
**threshold_reasoning, row by row.** `anhydrous_serum_or_oil` — no (Aqua rank 1). `two_phase` — no (there is no unemulsified bulk oil phase; the silicone materials are polymers, not a carried oil load). `emulsion` — no true O/W emulsifying system: Trideceth-6/-12 are solubilisers, not emulsifiers, and there is no LGN pair and no lipid or silicone *phase* for an emulsifier to carry. `microemulsion` — requires **both** (i) a solubiliser package, which two Trideceth grades plus early glycols arguably satisfy, **and** (ii) a real oil or silicone load **present as architecture**; the second condition is exactly what is unresolved, since Polysilicone-29 is a film-forming polymer rather than a silicone *load* and the one clear silicone-quat species sits below the marker. `aqueous_or_hydroalcoholic_solution` — requires the solubiliser to be carrying only fragrance or a trace active with **no** oil/silicone load above the tail, which Polysilicone-29 at rank 7 contradicts.
§7.1's stated resolution for this shape — "A single solubiliser plus a single tail-position silicone is the ambiguous middle: **return `unknown`, record both readings, and route to review**" — is the closest fit and was applied. **Both readings are recorded**: `microemulsion` (Trideceth pair + Polysilicone-29) and `aqueous_or_hydroalcoholic_solution` (a glycol/water spray whose silicone content is polymeric and thin).
**G9 note, applied in the direction v0.2 added:** `FORM = unknown` **never** forces `WT = unknown`. WT was assessed from the readable non-volatile architecture alone (below). review_status `provisional`; **routed**. `presentation_form`: Spray.

### 2. COND — `moderate` — **uncertain**
confidence **low** · E2. One coherent route above the tail: POLYSILICONE-29 (7), a persistent silicone film former.
`low` is excluded because a persistent non-volatile sits above the tail. `high` is excluded — no LGN pair, no cationic surfactant, no fatty alcohol.
**counter_signals** SILICONE QUATERNIUM-18 (11) would be a second, more substantive conditioning route but sits two positions below the marker in a fifteen-ingredient list; it is unpositioned, not absent. The glycols (2, 6, 14) and GLYCERIN (15) are humectants, not conditioning routes. Field marked uncertain (the G0 verdict is unresolved and so is the marker's meaning on so short a list). review_status `provisional`.

### 3. SLIP — `moderate`, bias `unknown` — **uncertain**
confidence **low** · E2. One M1 contributor present as architecture (the Polysilicone-29 film). `high` requires two independent contributors — the silicone quat is below the marker. `low` requires no persistent lubricant and no cationic species above the tail; the first clause fails. Bias `unknown`: a thin polymeric silicone film with an early glycol water phase fits neither `dry_biased` (which requires few water-phase agents — Dipropylene Glycol is at rank 2) nor `wet_biased` (which requires no persistent film) (§17.16). review_status `provisional`.

### 4. SFR — `moderate` — **uncertain**
confidence **low** · E2. `moderate`'s anchor admits "a single film former", and there are two above the tail (Polysilicone-29 at 7, the VP copolymer at 8). `high` requires a continuous surface-film route **plus a distinct lubricating species** present as architecture (RC-4) — there is no emollient, no oil, no second lubricating silicone above the tail, so the second limb fails. `low` requires water phase and humectants only, which the two film formers rule out. review_status `provisional`.

### 5. WT — `moderate` (multi-family row, §7.5) — **uncertain**
confidence low_moderate · E2.
**formula_observations** Two persistent non-volatile families above the tail: (1) **silicone film former** — POLYSILICONE-29 (7); (2) **fixative-class vinyl film former** — VP/METHACRYLAMIDE/VINYL IMIDAZOLE COPOLYMER (8).
**counter_signals (MANDATORY, §4)** The multi-family observation: two persistent non-volatile families at ranks 7 and 8, **neither a rich/low-spreading band member** — indeed **no lipid of any kind is declared** in fifteen ingredients — and **no LGN pair**. **What holds the value below `high` is the absent rich-band member**: the `high` anchor is about occlusion, weight and transfer, none of which this formula offers. Dose remains the unmeasured term (§17.1). Confidence caps at `moderate` on this row.
**counter_signals (second)** WT measures the tendency to "flatten, grease, **stiffen** or coat". Both families here contribute to the *stiffen/coat* limb rather than the grease limb, and the anchor rows do not distinguish them — recorded, as at slot 7.
**counter_signals (third)** SILICONE QUATERNIUM-18 (11) is a third persistent family sitting below the marker; counting it would not change the row.
**threshold_reasoning** `low` excluded (two persistent families above the tail — and G9 checked: the spray presentation contributed nothing, FS-1/FS-2). `high` excluded on both limbs. Confidence cannot reach `moderately_high`: **FORM is `unknown`**, so §7.5's first condition for the upgrade fails — while G9 clause 2 still guarantees the *value* is assessed normally. review_status `provisional`.

Transfer caution: not attached (no lipid load).

### 6. PERS — `neutral_non_volatile` — **uncertain**
confidence **low** · E2.
**formula_observations** Above the tail: POLYSILICONE-29 (7), a neutral non-volatile silicone polymer; the VP copolymer film (8).
**counter_signals (decisive if reversed)** **SILICONE QUATERNIUM-18 is declared at rank 11** — a `Silicone Quaternium-x`, named explicitly in the v0.2 `permanent_cationic` anchor's silicone-functional enumeration. It sits **two positions below the tail marker at rank 9**, in a fifteen-ingredient list. Under lane convention RC-3 (class anchors gated on rank above the marker) it does not promote the class. Under §3.1.1's coherence prong — a silicone quat is entirely coherent with a silicone-film architecture, and the tail is unordered so a rank-11 entry in a 15-item list is *unpositioned* — it would promote the record to `permanent_cationic`, moving `persistence` from `moderate` to `high` and emitting the buildup caution. **v0.2 does not say which reading governs.** This is the tightest of the three RC-3 cases in the set (marker rank 9 vs species rank 11). Routed.
**counter_signals (second)** Silicone quats are marketed on wash resistance, and **wash resistance and buildup are the same property** (FS-13). Holding the class low under-warns on buildup — the direction FS-20 and v0.2's monomeric-quat repair exist to guard. Recorded so the abstention is auditable rather than silent.
**threshold_reasoning** `ph_dependent_cationic` requires amodimethicone or an amidoamine — absent. `volatile_or_water_soluble` is excluded — persistent film formers dominate. No monomeric long-chain quat is present, so §7.6's monomeric note is not engaged.
**limitations** G11 — mechanism ordering, no duration, no wash count; banned removal percentages not used. review_status `provisional`.

### 7. HOLD — `meaningful_hold_route` — **uncertain**
confidence low_moderate · E2.
**formula_observations** VP/METHACRYLAMIDE/VINYL IMIDAZOLE COPOLYMER at **rank 8**, above the tail, in a film-forming context (a glycol/water spray with a second film former and two solubilisers). Conditioning architecture behind it: one silicone film former, one below-tail silicone quat, glycols and glycerin — thin.
**threshold_reasoning** `none` requires no L5 fixative-class polymer, or only the L5 rheology exclusions. `incidental_film` requires **either** a dominating substantive conditioning architecture (absent — COND is `moderate` on a single film former) **or** a polymer plausibly serving bottle rheology (a VP copolymer in a sprayable water-thin product is not a thickener). `meaningful_hold_route` is what remains.
**counter_signals (recorded, and it is a v0.2 open item)** VP/Methacrylamide/Vinyl Imidazole Copolymer is **not enumerated** in §5's L5 evidence list; it was placed there **by analogy** to the listed VP-based film formers (PVP, VP/VA, VP/Acrylates/Lauryl Methacrylate). v0.2 §21 lists this exact material among the L5 rheology-exclusion enumeration questions "deliberately not changed", noting that round 1 resolved such materials by analogy without producing a disagreement. **The whole G0 verdict turns on this analogy**: if the copolymer is not an L5 fixative, HOLD is `none`, the styling-boundary half of the `provisional_boundary` verdict evaporates, and the record is a clean `in_category` blow-dry primer.
**Consequences applied:** → G0 styling review (§7.7), one half of the boundary verdict above; → §14 human review.
**limitations** **Hold *level* is not readable** (§7.7): no grade, no low/moderate/high hold score. FS-9: a hold polymer is not conditioning and not repair. review_status `provisional`.

### 8. HEAT — trace `claim_only` → binary **`provides_heat_protection: true`**
confidence moderate · E0.
**claim authority** A **C2** claim exists, captured verbatim this pass: „intensiver Hitzeschutz bis 230°" on the manufacturer's German page. Not system-conditioned, so §2.4.1 rule 4 does not apply.
**formula_observations** L9 closed-list check across all 15 ingredients: **no L9 member.** Note carefully — **VP/Methacrylamide/Vinyl Imidazole Copolymer is *not* on the closed list**; the listed VP-family member with published protection data is *VP/Acrylates/Lauryl Methacrylate Copolymer* (Zhou et al. 2011), a different material. Polysilicone-29 and Silicone Quaternium-18 are generic silicones and are excluded by name (G10, FS-7). **The list is closed**; adding a member requires new peer-reviewed evidence and a standard-version bump.
**threshold_reasoning** §13.3: claim present, no L9 member ⇒ binary **`true`**, trace **`claim_only`**, **route to review** with a "claim looks formula-unsupported" note.
**Hard prohibitions observed.** The 230 °C figure is a marketing **use-condition** parameter, not a protection level (FS-14); `heat_protection_max_c` does not exist in this model. No efficacy grade, no percentage. Note that the *directions* independently instruct blow-drying with heat, which is a use context — §10.2 is explicit that the `heat_styling` focus "sets a *use context*, never a protection level". review_status `provisional`; **routed**.

### 9. HUM — `claim_only`
confidence moderate · E0.
**claim authority** A **C2** anti-frizz/humidity claim exists: „Starker Anti-Frizz-Effekt", „schützt das Haar langanhaltend vor Feuchtigkeit".
**threshold_reasoning** `formula_plausible` requires a **hydrophobic, continuous film-forming route** present as architecture **and no *dominant* humectant architecture**. The second condition **fails**: DIPROPYLENE GLYCOL (2) and PENTYLENE GLYCOL (6) sit above the tail with PROPYLENE GLYCOL (14) and GLYCERIN (15) behind them — four members, two of them high in a fifteen-ingredient list. That is a **dominant humectant leg**, which under §7.9 step 1 **blocks `formula_plausible` outright**; the highest reachable state with a claim is therefore `claim_only`. (The first condition is doubtful in any case: the VP-imidazole copolymer is a vinyl film former in the PVP family, and PVP-family polymers are **hygroscopic and lose film stiffness as RH rises** — mechanistically the wrong direction, SR §F.1.)
**Glycols-are-not-automatically-humectants check (§7.9 v0.2), and it is decisive here.** Dipropylene Glycol at rank 2 could plausibly be a **solvent** for the film formers rather than a humectant. The formula does not settle it, so the standard's instruction was followed: **take the humectant reading — the conservative one, because it lowers the state — and mark the field uncertain.** Under the solvent reading the humectant leg would arguably not be dominant, `formula_plausible` would become reachable, and the product's own anti-frizz claim would be paired with a plausibility the evidence does not otherwise support. The reading choice is recorded in this `threshold_reasoning` as §7.9 requires.
**limitations** Humidity response is **measured, not inferred** (§7.9). FS-15/FS-6: humectants are a counter-signal for a humidity claim, never support. FS-16: no dew-point threshold is encoded. `product_tested` would need HHCR/DHCR (~26 °C / 90 % RH over 24 h), DVS or humidity-chamber imaging with declared RH, temperature and equilibration time; „langanhaltend" is marketing, not a protocol. review_status `provisional`.

### 10. R2 — `none_visible` — **uncertain**
confidence low_moderate · E1.
**formula_observations** SILICONE QUATERNIUM-18 (11) — a **silicone quat**, and therefore one of the three routes on §7.10's closed `candidate` list — sitting **below the tail marker at rank 9**.
**threshold_reasoning** `candidate` additionally requires the route to be **present as architecture (§3.1.1)** in a plausible film context. Under RC-3 the rank prong fails and the value is held at `none_visible`, field marked uncertain, routed. This is the same unresolved reading as PERS, and it moves with it: if the silicone quat is read as architecture, R2 becomes `candidate`, `care_direction` moves toward `protein`, `damage_fit` gains the row-3b upgrade, `repair` becomes an available focus, and the §18 silicone-quat R2 string is emitted.
**Mandatory trace note:** the observation, its rank (11), the marker's rank (9) and the reason it does not qualify are recorded here so the record does not read as if the silicone quat were missed.
**Other candidates:** none. No protein, no silane derivative, no peptide is declared. review_status `provisional`.

### 11. DOSE — `moderate` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence low_moderate · E2. WT = `moderate` (multi-family row) sets `moderate`; §7.11 forbids re-arguing it upward on family count. No `high` trigger: FORM is not `two_phase`, and no rich-band lipid is present as architecture (none at all). The additive `microemulsion` trigger was **not** fired, because FORM is `unknown` — and v0.2 rule change 33 is explicit that **`FORM = unknown` no longer forces `unknown` here**: WT is the determinant, and FORM `two_phase`/`microemulsion` are additive triggers, never blockers. review_status `provisional`.

### 12. EXPO — `no_listed_fragrance_signal`
confidence moderate · E1. No `Parfum`, no `Aroma`, none of the 26 declared EU allergens, no aromatic essential oil among fifteen ingredients.
**Hard limit restated:** "no listed fragrance signal" is **not** fragrance-free, **not** allergy-safe and **not** hypoallergenic (§7.12, SR §M.12, Reg. 655/2013 technical document). The §18 string carries that limit. No `Alcohol`/`Alcohol Denat.` note. G6 applies. review_status `approved`.

### 13. ROLE — `[post_wash, heat_styling]`
confidence moderate · E1 · scope directions · **C2 source**. One verbatim sentence per value:
- `post_wash` ← „Das Spray großzügig und gleichmäßig auf das **handtuchtrockene** (nicht nasse) Haar sprühen." (neqi-hair.com, C2, 2026-09-03) — application to towel-dried hair.
- `heat_styling` ← „Anschließend die einzelnen Partien **mit Hitze** und auf Spannung **föhnen**." — a **named heat tool** (föhnen / blow-dryer). This is the **only** record in the set where a direction sentence names a heat tool, so it is the only one where the `heat_styling` role — and therefore the `heat_styling` focus — is reachable at all. §7.13's rule that "a temperature figure alone is a claim, not a direction" is what excludes it elsewhere; here the direction itself carries the tool.
**Not taken:** `refresh` (nothing about dry hair between washes), `ends_only` (no placement restriction), `curl_styling` (the directions describe tension-drying, the opposite of curl forming). review_status `approved`.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 optical consequence of the film. „ultimativen Glanz" is in the C2 positioning; that is **E0** and does not create an independent shine value — an independent value needs a distinct gloss route or exact-product goniophotometry, and neither exists (§8.1, FS-23) |
| CURL | `derived_candidate` (low) | HOLD ∈ {`meaningful_hold_route`} feeds the HOLD+COND+WT derivation mechanically. **Not selected as a focus** — see below; this is a recorded v0.2 defect |
| R3 | `unknown` | No bond claim, no bond chemistry |
| LAYER | no string emitted | No cationic polymer above the tail; the one silicone quat is a tail member |
| Buildup caution | not emitted | PERS projects `moderate` — but if the silicone quat promotes the class on review, this caution becomes mandatory |

## §9 care_direction — `moisture` (humectant-led minimum) — **uncertain**

confidence **low** · E2 · shared_mechanism `M7_HUMECTANT_PLASTICISER`.
R2 is `none_visible`, so `protein` is unreachable. An L4 humectant leg is present as architecture — DIPROPYLENE GLYCOL (2) and PENTYLENE GLYCOL (6) above the tail — with no R2 route and with the emollient and cationic legs thin or absent: the v0.2 **humectant-led minimum** row, `moisture` at `low` confidence with the thin-architecture observation as the required counter-signal.
**Counter-signal (decisive, recorded).** The silicone-led `unknown` rule was tested: conditioning here *is* led by a silicone film former, but §9's rule fires only when there is no R2 route **and** no material humectant/emollient leg — and a humectant leg is present above the tail, so it does not fire. Yet the product's real material direction is a **film system** (silicone + fixative), for which §9's protein-versus-moisture vocabulary has no home at all. **A blow-dry styling primer therefore projects `care_direction: moisture`.** Recorded as an ambiguity; field marked uncertain.
Constraint 3 observed: the „Feuchtigkeitsschutz" positioning was **not** used to set the value — and note that the claim means *protection against ambient moisture*, close to the opposite of what `moisture` denotes in this vocabulary, which is a second reason the projected label reads misleadingly. Constraint 1 observed.

---

## §10 lean matching profile

> A `provisional_boundary` record keeps its lean profile (§2.3.1), with affected fields marked uncertain.

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "unknown",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "meaningful",
  "care_direction": "moisture",
  "focus": { "primary": "heat_styling", "secondary": [] },
  "usage_role": ["post_wash", "heat_styling"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "claim_only" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "cautions": [
    "Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das.",
    "Anti-Frizz ist ausgelobt. Aus der INCI-Liste lässt sich das Verhalten bei hoher Luftfeuchtigkeit nicht ableiten.",
    "Bringt Halt über ein Styling-Polymer – das ist etwas anderes als Pflege.",
    "Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen.",
    "Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
  ],
  "uncertain_fields": ["product_form", "conditioning_level", "persistence", "focus", "care_direction", "repair_surface_film"],
  "assumption_notes": [
    "G0 = provisional_boundary: §2.3's trap-3 sentence and the excluded_styling_first row disagree for this product.",
    "HOLD rests on placing VP/Methacrylamide/Vinyl Imidazole Copolymer in L5 by analogy; §5's list does not enumerate it (v0.2 §21, left open).",
    "PERS and R2 held low under RC-3; Silicone Quaternium-18 sits two ranks below the tail marker."
  ]
}
```

**Focus selection (§10.2) — and the defect this record exposes.**

- Step 1, qualifying routes. **`heat_styling`** qualifies on both required limbs: HEAT ≥ `claim_only` under **C2** claim authority (§2.4.1), **and** ROLE includes `heat_styling` with its verbatim direction sentence (§7.13). It sets a **use context**, never a protection level (§13). **`curl_definition`** *also* qualifies, literally: its anchor is `HOLD ∈ {incidental_film, meaningful_hold_route}` **present as architecture** — the VP copolymer at rank 8 is unambiguously architectural — **plus compatible COND/WT** (COND `moderate`, WT `moderate`; neither is disqualifying), with "curl positioning corroborates only". Others fail: `smoothing` (SFR `moderate`), `repair` (R2 `none_visible`), `detangling` (no detangling-led positioning; the slip-dominant prong needs WT `low`), `volume_lightness` (needs WT `low`), `shine` (the C2 „Glanz" claim is E0 and cannot create a route; no gloss route, no goniophotometry).
- **The defect.** §10.2's step-3 rank order is `repair > smoothing > curl_definition > heat_styling`. Both qualifying routes here rest on comparable support, so if step 2's strength test is read as a tie, **`curl_definition` outranks `heat_styling` and becomes the primary focus of a blow-dry straightening spray** — a product whose C2 directions instruct drying "auf Spannung", the opposite of curl forming. **v0.2's `curl_definition` anchor has no negative gate:** any fixative-class polymer above the tail with non-extreme COND/WT qualifies, and curl positioning is explicitly demoted to corroboration, so its *absence* cannot count against the route either.
- **Resolution taken.** `heat_styling` was selected as primary on step 2: it rests on two distinct, directly endpoint-relevant pieces of evidence (a C2 claim and a C2 direction sentence naming the heat tool) that describe what the product is *for*, whereas `curl_definition` rests on a single formula observation whose user endpoint the directions actively contradict. **`primary` is marked uncertain** under §10.2 rule 5 and routed, and the defect is recorded rather than papered over. Secondary: none — `curl_definition` cannot clear the independent-moderate+ bar for a secondary when the directions contradict its endpoint.
⇒ **`primary: heat_styling`, secondary `[]`.**

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `moderate`; fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2** (COND `moderate`, no qualifying repair route). Row 3b would open if the silicone quat were read as architecture (R2 `candidate`).
- `texture_fit` ← **row 2** (`weight_potential = moderate`, any slip). §10.3 explicitly: **`HOLD = meaningful_hold_route` does not by itself raise curly/coily** — it triggers the G0 styling review instead, which it did.
- `scalp_application_fit` ← ordered test: no `avoid` trigger fires (EXPO `no_listed_fragrance_signal`, no material alcohol, WT not `high`, no oil-led load, no direction to avoid the roots). `suitable_if_evidenced` requires C1/C2 directions explicitly directing the product at the scalp or roots — the directions direct it at sectioned hair, not the scalp. `conditional` requires a stated placement that is not the scalp — „auf das handtuchtrockene Haar" states no placement. → **`unknown`**, the default. G6 applies.

## §14 review routing

1. **G0 `provisional_boundary`** — every such record routes (§14). Reviewer question: does §2.3's trap-3 sentence override the `excluded_styling_first` row's directions/positioning requirement, and is "conditioning is meaningful" satisfied by one silicone film former at rank 7?
2. **`HOLD = meaningful_hold_route`** — styling-boundary decision (§14). It rests on an **analogical** L5 placement (§5 does not enumerate VP/Methacrylamide/Vinyl Imidazole Copolymer; v0.2 §21 left it open). Resolving the analogy resolves half the G0 question.
3. **Heat-protection claim with no L9 member** (§13.3, §14).
4. **`FORM = unknown`** — §7.1's declared ambiguous middle; both readings recorded (§7.1, §14).
5. **PERS / R2 tail-gating** — Silicone Quaternium-18 at rank 11 against a marker at rank 9 in a fifteen-ingredient list. This single reading moves `persistence`, the buildup caution, `repair_surface_film`, `care_direction`, the `damage_fit` row and one §18 string (RC-3).
6. **`focus.primary` uncertain** — §10.2's `curl_definition` anchor has no negative gate and outranks `heat_styling`; a blow-dry primer literally qualifies as a curl product.
7. **Identity** — near-duplicate-GTIN sibling SKU 4063528078469 unverified; retailer/manufacturer name divergence preserved (G5).
