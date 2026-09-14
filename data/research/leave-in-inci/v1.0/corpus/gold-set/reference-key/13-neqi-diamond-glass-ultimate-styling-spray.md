# Slot 13 — Neqi Diamond Glass Ultimate Styling Spray (180 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Boundary / identity-trap secondary (name mismatch + near-duplicate-GTIN sibling)
- `gtin`: 4063528094575 · `market`: DE · `identity_status`: `verified_with_minor_source_difference`
- `rawInciSha256`: `6f1438b205be65c3dba30c91dea0e2875aeed6965d0c8449f02fa79eec782f63`
- `formulaFingerprintSha256`: `0fc43a9c7ee30eef3b6d48ed3c15c069b6777f48b7f0b4aa7a865510591ad2ce`
- `review_routing`: **routed to human review** — (a) **G0 product-form ambiguity** (the styling boundary is genuinely close here, even though the gate returns a decision); (b) **heat-protection claim („Hitzeschutz bis 230°") with no L9 member** (§13.3); (c) unverified near-duplicate-GTIN sibling 4063528078469; (d) FORM unresolved between aqueous solution and microemulsion.

## Sources

| Ref | Tier | Content |
|---|---|---|
| `S13-dir` | T1 (neqi-hair.com, „ANWENDUNG") | „1. Das Haar in Abschnitte unterteilen. 2. Das Spray großzügig und gleichmäßig auf das **handtuchtrockene (nicht nasse)** Haar sprühen. 3. Anschließend die einzelnen Partien **mit Hitze und auf Spannung föhnen**." |
| `S13-dir2` | T2 (dm.de, GTIN 4063528094575 / dm-Art. 3080142 confirmed) | „Handtuchtrockenes Haar in Abschnitte unterteilen. Großzügig und gleichmäßig auf das Haar sprühen. **Jeden Abschnitt unter Hitze und Spannung föhnen**, um den leistungsstarken Feuchtigkeitsschutz für spiegelglatte Haare zu aktivieren…" |
| `S13-claim` | T1 + T2 | **„Es kombiniert Styling mit intensivem Hitzeschutz bis 230°"** and „Styling + intensiver Hitzeschutz (bis 230°) in einem" (T1); dm.de shows a **„Hitzeschutz" badge**. Also: „Starker Anti-Frizz-Effekt"; „Wasserabweisender Effekt"; „Feuchtigkeitsschutz"; „Ultra-leichte Textur ohne Beschweren"; „Verkürzte Föhnzeit"; „Glättet die Haarstruktur mit hitzeaktivierten Polymeren" (T2). **Notable negative finding: no „Halt"/hold claim in either source** — the emphasis is entirely smoothing/gloss/heat-seal. |
| `S13-ing` | T3 (INCI reference) | `POLYSILICONE-29` identified as a **crosslinked amino/PEG-functional silicone film former** (hair-conditioning silicone). Ingredient-family identification only, not performance evidence. |

**Identity trap, resolved.** dm.de names this product „Leave-In Spray Diamond Glass Ultimate"; the manufacturer and Galeria name it „Diamond Glass Ultimate Styling Spray" — **same GTIN across all three**. Per G0, **neither name is used**: the retailer's "Leave-In" does not include it, and the manufacturer's "Styling Spray" does not exclude it. Function, directions and architecture decide.

---

## G0 — `in_category` (decided, but routed to review)

confidence **moderate** · E1 (directions) + E2 (architecture) · scope `directions` + `formula` · decision_type `metadata`

- formula_observations: `AQUA [WATER]` #1 leads. A fixative-class candidate is present — `VP/METHACRYLAMIDE/VINYL IMIDAZOLE COPOLYMER` #8 (a VP-based film-forming polymer, L5). A conditioning architecture is also present — `POLYSILICONE-29` #7 (persistent silicone film route) and `SILICONE QUATERNIUM-18` #11 (a silicone quat: L1 cationic **and** L6 substantive-film member, and one of the most substantive families in the category).
- directions_observation: applied to towel-dry hair and blow-dried under tension, with no rinse step (`S13-dir`, `S13-dir2`) — a blow-dry primer regime.
- threshold_reasoning: §2.2 includes "**blow-dry primers and heat-protective leave-ins when conditioning is meaningful**". `excluded_styling_first` requires a fixative route **with thin or absent conditioning architecture behind it** *and* positioning leading on durable hold or texture. **Both of its remaining limbs fail here:** the conditioning architecture is two distinct substantive routes sitting at #7 and #11 in a fifteen-ingredient list, which is lean but not thin; and neither the manufacturer nor the retailer makes any hold claim — the positioning leads on smoothing, gloss and heat protection. `excluded_anhydrous` fails (Aqua #1). `excluded_other_form` fails (no rinse).
- counter_signals, stated honestly: the fixative polymer sits at **#8, ahead of the silicone quat at #11**; there is no emollient, no oil, no fatty alcohol and no slip agent other than the two silicones; and the manufacturer's own name is "Styling Spray". A reviewer who weighted the polymer's rank over the substantivity of the silicone quat would reasonably return `provisional_boundary`. **This lane decides rather than defers — the gate asks whether conditioning is meaningful, and a silicone quat plus a silicone film former is meaningful — and routes the record to review under §14 (G0 product-form ambiguity).**
- review_status: `specialist_review_required`

## 1. FORM — `aqueous_or_hydroalcoholic_solution` **(field uncertain)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: `AQUA [WATER]` #1; `DIPROPYLENE GLYCOL` #2, `PENTYLENE GLYCOL` #6, `PROPYLENE GLYCOL` #14, `GLYCERIN` #15 (glycol/humectant load); solubiliser-type nonionics `TRIDECETH-6` #12 and `TRIDECETH-12` #13; silicone actives `POLYSILICONE-29` #7 and `SILICONE QUATERNIUM-18` #11. **Absence pattern: no fatty alcohol → no LGN pair; no cationic surfactant; no oil.**
- threshold_reasoning: the `aqueous_or_hydroalcoholic_solution` anchor is met — "Water + glycol early; cationic polymer and/or short-chain quat; no long-chain fatty alcohol; no emulsifier, or **only solubiliser-type**". Trideceth-6/-12 are exactly that class, and they sit *behind* the silicones, consistent with solubilising them. `microemulsion` is the live alternative and cannot be excluded on formula alone: it would require "a **real** oil/silicone load" and several PEG-esters, and this formula has two solubilisers and two silicone actives at functional (not bulk) levels — a judgment about *how much* silicone, which G4 forbids reading off an INCI list. **Field marked uncertain**; the only downstream difference is DOSE, which lands on `moderate` either way. `emulsion` fails (no LGN pair, no emulsifier). `two_phase` fails (solubilisers present, no shake direction).
- FS-17 recorded: if the product is clear, that is a droplet-size fact, not a lightness fact.
- G9: never sets WT. `presentation_form` (metadata): Spray.
- review_status: `provisional`

## 2. COND — `moderate` **(ceiling forced by the LGN-necessity clause)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: `POLYSILICONE-29` #7 — a persistent silicone film route (L2); `SILICONE QUATERNIUM-18` #11 — a silicone quat, i.e. an L1 cationic route with high charge substantivity. **Absence pattern: no emollient, no oil, no ester, no fatty alcohol, no humectant beyond the glycol carrier load.**
- threshold_reasoning: two independent conditioning routes are present at architecture level (in a fifteen-item list, positions 7 and 11 *are* the actives). That would ordinarily satisfy G3 rule 3 for a top value — but **the `high` anchor requires an LGN pair, which a silicone-led spray cannot have.** Assigned `moderate` ("a cationic-polymer film route … or a persistent silicone/emollient package — without a full LGN pair"). `low` fails (persistent non-volatiles well above the tail).
- **Rule-ambiguity flag** — the fourth record capped this way (with 5, 8, 9).
- counter_signals: the conditioning is *lean* in breadth — a single film plus a single cationic, with no lubricating lipid behind them.

## 3. SLIP — `high`, bias `dry_biased`

confidence **low** · E2 · scope `formula`

- Two independent M1 contributors as architecture: an L2 persistent silicone film (#7) and an L1 charge-substantive silicone quat (#11). The anchor's example — "cationic route + persistent lubricant" — is met by two different route families.
- counter_signals, and the reason confidence is **low**: both contributors are silicones sitting mid-list in a lean formula, there is no lipid or ester lubricant at all, and a reviewer could reasonably read this as one silicone route and return `moderate`. Recorded as a judgment call.
- Bias `dry_biased`: a persistent film with few water-phase slip agents (glycols are carriers/humectants, not slip agents), and **no volatile carrier at all**, so `both` and `wet_biased` both fail.

## 4. SFR — `moderate` · SHN qualifier `present`

confidence **moderate** · E2 · scope `formula`

- threshold_reasoning: the `high` anchor needs a continuous surface-film route **plus** a lubrication route. Here the film route and the lubrication route are **the same two silicone species already counted at maximum in SLIP** — there is no separate emollient family. **G3 requires an endpoint-relevant *additional* observation, not a restatement**, so `high` is refused. (Contrast slot 5, where a distinct macadamia/isoparaffin lubrication route sits behind the silicone film and `high` is earned.) `low` fails — a real persistent film exists. → `moderate`.
- SHN `present`, **qualifier on SFR only**. The „Diamond Glass"/„spiegelglatt"/„Glanz" positioning corroborates and never sets it; no distinct uncounted gloss route and no goniophotometry exist (§8.1, FS-23).
- §7.4 discipline: the „Starker Anti-Frizz-Effekt" claim is a humidity statement and is handled exclusively by HUM.

## 5. WT — `moderate`

confidence **moderate** · E2 · scope `formula`

- formula_observations: persistent non-volatile families — the silicone film route (#7 + #11, one family) and the fixative polymer film (#8, arguably a second). **Absence pattern: no rich/low-spreading band member, no oil of any kind, no LGN pair, and — notably — no volatile carrier either.**
- threshold_reasoning: `high` fails on all three limbs (no LGN pair; no rich-band member; FORM is not two-phase, and the microemulsion alternative would still need "a substantial oil/silicone phase", which two functional-level actives are not). `low` fails: persistent non-volatiles sit well above the tail, and WT counts "stiffen" and "coat" as well as "grease" — a VP-type fixative film plus a silicone-quat deposit does both. → `moderate`, which is the value on either FORM reading.
- counter_signals: the E0 claim „Ultra-leichte Textur ohne Beschweren" — recorded, corroborating but not decisive, and **not** a §10.1 conflict tag because the projected value is already `moderate`, not a restrictive `high`.
- attached transfer caution: **not emitted** (no low-spreading, non-film-forming lipid load — there is no lipid at all).
- limitations: §17.11; G9 — the "spray" word played no part (FS-2).

## 6. PERS — `permanent_cationic`

confidence **moderate** · E2 · scope `formula`

- formula_observation: `SILICONE QUATERNIUM-18` #11 — a **silicone quat**, the anchor's first named family, present as architecture in a fifteen-ingredient list. This is the clearest `permanent_cationic` call in the gold set: it needs neither the monomeric-quat workaround nor an unreadable charge-density inference.
- Supporting: `POLYSILICONE-29` #7 is an amino/PEG-functional silicone — the amine function adds substantivity, while the PEG segments add water-dispersibility, so it is recorded as ambiguous rather than as a second `permanent_cationic` observation. Film cohesion is further raised by the crosslinked VP-copolymer film (#8), which modifies within the class.
- threshold_reasoning: `ph_dependent_cationic` understates a permanently quaternised silicone; `neutral_non_volatile` and `volatile_or_water_soluble` understate it further.
- attached buildup caution: **yes**, non-quantitative, and it must not be presented as low while PERS is high (G3 rule 4, FS-13 — wash resistance and buildup are one property from two ends, and silicone quats are marketed on the former). The directions' „großzügig" dosing raises the routine-level consideration.
- limitations: **G11** — no duration, wash count, applications-to-buildup or clarification schedule, and none of the banned circulating removal percentages.

## 7. HOLD — `incidental_film` **(field uncertain)**

confidence **moderate** · E2 · scope `formula` + `product`

- formula_observation: `VP/METHACRYLAMIDE/VINYL IMIDAZOLE COPOLYMER` #8 — a genuine fixative-class (L5) polymer in a film-forming context, above the tail.
- threshold_reasoning: `none` fails — a real fixative is present, and it is **not** covered by the L5 rheology exclusion (it is not a carbomer, gum, cellulose or starch, and this formula has no thickener role for it to play). `meaningful_hold_route` requires **thin or absent** conditioning architecture behind the polymer; a silicone quat plus a silicone film former is lean but not thin, and — decisively — **neither the manufacturer nor the retailer makes any hold claim**, so the "directions/positioning lead on durable hold" limb of the styling exclusion also fails. → `incidental_film`.
- counter_signals and why the field is uncertain: the fixative sits at #8, **ahead** of the silicone quat at #11, and the manufacturer's own product name is "Styling Spray". `meaningful_hold_route` is recorded as the live alternative; it would trigger the G0 styling review, which this record is routed to anyway.
- Hold **level** is deliberately not emitted — polymer level and plasticiser load are invisible (§7.7). The E0 claim „hitzeaktivierte Polymere" names a mechanism, not a level.
- FS-9 honoured: the hold polymer is not read as conditioning or repair.

## 8. HEAT — `claim_only` · **`provides_heat_protection = true`** · **REVIEW**

confidence **low** · E0 + E1 · scope `product` + `formula`

- claim_observation (E0): „intensivem **Hitzeschutz bis 230°**" on the manufacturer's page, plus a „Hitzeschutz" badge on the exact-GTIN retailer page.
- formula_observation: **no member of the closed L9 list.** `VP/METHACRYLAMIDE/VINYL IMIDAZOLE COPOLYMER` #8 was checked individually against every entry: the list carries **VP/Acrylates/Lauryl Methacrylate Copolymer**, Polyquaternium-55, the PVM/MA + Polyquaternium-28 complex, PVP/DMAPA Acrylates Copolymer, Quaternium-70 and hydrolyzed wheat protein. A VP/methacrylamide/vinyl-imidazole terpolymer is a **different polymer** and is not a member. **The list is closed; adding a member requires new peer-reviewed evidence and a standard-version bump** — a family resemblance to a listed VP copolymer is explicitly not enough (G10).
- threshold_reasoning: `formula_plausible` unreachable. `not_claimed` fails. `product_tested` requires an exact-product DSC / breakage-after-ironing / tryptophan-loss result with §3.2 metadata; none exists.
- production projection (§13.3): claim present, no L9 member → `true`, trace `claim_only`, **routed to human review**.
- **This is the sharpest test of the closed list in the gold set:** the product genuinely is a heat-styling primer (the directions *require* blow-drying) and it genuinely contains a VP-family film former — and the rule still says `claim_only`, because the specific polymer with published protection data is not the one present. FS-14: „bis 230°" is a use-condition parameter, never a protection strength; **no `heat_protection_max_c` field exists in this model**.
- review_status: `specialist_review_required`

## 9. HUM — `claim_only`

confidence **moderate** · E1/E2 · scope `product` + `formula`

- claim_observation (E0): „Starker Anti-Frizz-Effekt", „Wasserabweisender Effekt", „Feuchtigkeitsschutz".
- **Mandatory counter-signal — decisive here.** `DIPROPYLENE GLYCOL` at **#2**, `PENTYLENE GLYCOL` #6, `PROPYLENE GLYCOL` #14 and `GLYCERIN` #15: a glycol/humectant load that is dominant by rank. Additionally, the film former is a **VP-family** polymer, and VP chemistry is hygroscopic and loses film stiffness as RH rises (SR §F.1) — mechanistically the wrong direction for humidity resistance.
- threshold_reasoning: `formula_plausible` requires a hydrophobic, continuous film-forming route **and** no dominant humectant architecture. The silicone quat and Polysilicone-29 could arguably supply the first, but the second condition fails outright, and the standard is explicit that humectants **lower this state and never raise it**. → `claim_only`, "the default for most claiming products".
- FS-6 and FS-15 both apply; FS-16 — never encode a dew-point threshold.
- limitations: humidity response is measured, not inferred. The claim's EU legality means a dossier exists, not that an HHCR/DHCR or DVS result does (§3.3).

## 10. R2 — `candidate`

confidence **moderate** · E2 · scope `formula`

- formula_observation: `SILICONE QUATERNIUM-18` #11 — a **silicone quat**, named explicitly in the R2 `candidate` anchor as a substantive route, in a plausible film-forming context alongside `POLYSILICONE-29` #7 and a fixative film.
- Confidence is higher than slots 5/9/10 because the route sits at architecture level in a short list rather than in the sub-1 % tail.
- **Hard limits.** Moderately supported for film/feel/body effects; **not supported** for structural repair; never converts into penetration, strength or a diagnosed "protein need". Ceiling low–moderate on a supplier-dominated evidence base.

## 11. DOSE — `moderate` (derived)

confidence **moderate** · `derived_from: [WT=moderate, FORM=aqueous_or_hydroalcoholic_solution, L3 spreading class = none present]`

- `high` fails on all three limbs. `low` requires WT `low` **and** an aqueous solution with a **volatile-dominant carrier** — WT is `moderate` and there is no volatile carrier, so the conjunction fails. If FORM resolves to `microemulsion`, DOSE remains `moderate` by the second rule. G3: emits a caution, does not modify `hair_thickness_fit`.

## 12. EXPO — `no_listed_fragrance_signal`

confidence **moderate** · E1 · scope `formula`

- Precise absence pattern: **no `PARFUM`/`FRAGRANCE`/`AROMA` entry and none of the 26 EU-labelled fragrance allergens** in the fifteen-item list. The botanical extracts (`GARDENIA TAITENSIS FLOWER EXTRACT` #3, `LYCIUM BARBARUM FRUIT EXTRACT` #4, `MALVA SYLVESTRIS EXTRACT` #5) are not declared as aromatic/allergen entries.
- notes: no `Alcohol`/`Alcohol Denat.`; no alcohol exposure note.
- **Hard prohibition:** this is **not** fragrance-free, **not** allergy-safe and **not** hypoallergenic — labelling thresholds and incomplete formulas prevent those claims (EU technical document to Reg. 655/2013). Sensitive-scalp tolerance is not derivable from an INCI list (SR §M.12). G6 applies.

## 13. ROLE — `["post_wash", "heat_styling"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „auf das handtuchtrockene (nicht nasse) Haar sprühen" → `post_wash` (damp, after washing; the directions even exclude wet hair). „mit Hitze und auf Spannung föhnen" / „Jeden Abschnitt unter Hitze und Spannung föhnen" → `heat_styling`, and here the heat tool is **part of the application procedure itself**, not an optional follow-up — the strongest `heat_styling` read in the gold set.
- `refresh` rejected (no dry-hair touch-up described). `curl_styling` rejected (the technique described is sectioned blow-drying under tension, i.e. straightening). `ends_only` rejected (the directions section the whole head).
- G2: ROLE is an input to fit derivation, never a substitute for one. §14 note: `PERS = permanent_cationic` combined with a `refresh` role would route to review — `refresh` is absent here, so that specific trigger does not fire.

## Demoted flags

- `smoothing_shine_qualifier`: `present`.
- `curl_definition_focus`: **not set.** The §8.2 derivation (HOLD + COND + WT) is *mechanically* satisfiable — HOLD is `incidental_film` and COND/WT are compatible — but it is refused: there is no curl positioning to corroborate it, the directions describe sectioned blow-drying under tension (a straightening technique), and setting it would be exactly the unsupported precision §8.2 exists to prevent (no formula → curl-definition mapping exists; SR §M.6). **Recorded as a case where a derived flag's mechanical trigger and its meaning diverge.**
- `R3`: `unknown` — no bond chemistry, no bond claim.
- LAYER caution: **emitted** — a silicone quat is one of the most substantive cationic species in the category and the product is a styling-stage primer likely to sit under other styling products. Caution string only; no matrix, no score (§8.4).
- Buildup caution: **emitted**. Transfer caution: **not emitted**.

## care_direction — `unknown`

confidence **moderate** · E2 · scope `formula`

- `protein` fails: R2 is `candidate`, but the route is a **silicone quat, not a protein/peptide/silane**, and §9 anchors `protein` on a protein-family film route.
- `moisture` fails: §9's anchor is a coherent **L1/L3/L4** architecture as the *material* direction. The L3 emollient limb is entirely absent, and the glycols at #2/#6/#14 read as the solvent/carrier system of a silicone spray rather than as a care emphasis. The material direction is an L2/L5 film.
- `balanced` requires a substantive mixed architecture.
- Fourth of four in-category records returning `unknown` for the same structural reason (with 5, 8, 9) — see the summary.

## Lean matching profile

```jsonc
{
  "product_form": "aqueous_solution",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "high",
  "hold_support": "incidental",
  "care_direction": "unknown",
  "focus": { "primary": "heat_styling", "secondary": [] },
  "usage_role": ["post_wash", "heat_styling"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "claim_only" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["product_form", "hold_support", "care_direction", "specialist_functions.provides_heat_protection"]
}
```

**Focus derivation.** `heat_styling` = HEAT ≥ `claim_only` **and** ROLE ∋ `heat_styling` — both met, and uniquely well: the heat tool is written into the application procedure. It sets a **use context, never a protection level** (§13). `smoothing` fails (SFR `moderate` under G3) even though the product is sold as a smoothing spray — the smoothing route and the conditioning route are the same two silicones, and G3 refuses the restatement. `curl_definition` fails (see the demoted-flags note). `volume_lightness` fails (WT not `low`). `detangling` fails (bias `dry_biased`). `repair` fails — R2 is `candidate`, which clears the anchor's first limb, but the route is a silicone quat and §10.2 states that generic silicone cannot set a repair focus; recording it would overstate. `shine` fails (§8.1). No secondary adds useful matching information.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=moderate, product_form=aqueous_solution]`: formula (a silicone-quat/film deposit plus a VP-copolymer film, no lipid, no LGN) → product property (moderate coating and mild stiffening potential) → fit. Fine = `conditional`, carrying the §17.11 judgment-call label; the E0 „ohne Beschweren" claim did not move it.
- `damage_fit` ← `[conditioning_level=moderate, repair_surface_film=candidate, bond_flag=none, product_evidence=none]` → row 2. Row 3 needs `conditioning_level = high`.
- `texture_fit` ← `[weight_potential=moderate, slip=high, hold_route_state=incidental_film]` → row 2. `hold_route_state` did not raise curly/coily on its own (§10.3).
- `scalp_application_fit` ← the directions instruct sectioning and spraying „auf das Haar" with no scalp or root statement → `unknown`. Never from an ingredient read; G6 applies.

## German copy emitted (§18)

- HEAT claim without L9 member: „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das."
- HUM `claim_only`: „Anti-Frizz ist ausgelobt. Aus der INCI-Liste lässt sich das Verhalten bei hoher Luftfeuchtigkeit nicht ableiten."
- HUM humectant counter-signal: „Enthält Feuchthaltestoffe – die machen das Haar weicher, sprechen aber nicht für Frizz-Schutz bei feuchtem Wetter."
- PERS `high` + buildup: „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab."
- LAYER: „Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen."
- R2 `candidate`: „Enthält einen Protein-Film-Baustein, der sich aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur." *(Copy-review note: the route here is a silicone quat, not a protein — this string must be reworded before use.)*
- EXPO `no_listed_fragrance_signal`: „Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen."
- `scalp_application_fit = unknown`: „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
