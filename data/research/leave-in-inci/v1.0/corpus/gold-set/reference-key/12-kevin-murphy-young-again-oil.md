# Slot 12 — Kevin Murphy Young.Again Oil (100 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Boundary / source-conflict
- `gtin`: **unresolved** — candidates 9339341020356 and 9339341001744 · `market`: DE · `identity_status`: **`provisional_formula_conflict`**
- `rawInciSha256`: `76af4a98c3f67aa751bed0599aaa83b3cd0707252e97a9622a4ec78505fc02d3`
- `formulaFingerprintSha256`: `a88d2f48fc6ad274159cc192e0386a260da0b15a1db37b74096d5eed130446c8`
- **G0 verdict: `excluded_anhydrous` → `routed_out_of_scope` (oil/serum category).**
- `review_routing`: **routed to human review** — (a) G0 category exit; (b) GTIN conflict; (c) the captured INCI is the **international/US listing** (it contains HICC), and a DE-market-safe verbatim string was not reproduced; (d) unresolved token spelling (`Vanillyl` vs `Vinyl Butyl Ether`); (e) a heat-protection claim with no L9 member (would apply if the record were retained in-category).

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S12-dir` | T1 (kevinmurphy.com.au, "USE.ME") | „APPLY. INFUSE. DRY. Apply YOUNG.AGAIN to **freshly washed hair and before any styling products**. Once dried, you can apply a small amount of YOUNG.AGAIN to **dry hair** to increase the smoothness of the hair and remove any flyaway strands." |
| `S12-dir2` | T2 (flaconi.de, German) | „AUFTRAGEN. EINWIRKEN LASSEN. TROCKNEN. Geben Sie YOUNG.AGAIN ins frisch gewaschene Haar, bevor Sie Stylingprodukte verwenden. Nach dem Trocknen können Sie eine kleine Menge YOUNG.AGAIN ins trockene Haar geben…" |
| `S12-pos` | T1 | Manufacturer positioning, verbatim: „**a weightless leave-in treatment oil**". **No rinse instruction anywhere.** |
| `S12-claim` | T1 | „Offers **heat protection up to 200°F / 93°C**"; „Weightless, nutrient-rich oil"; „Helps promote elasticity and increase shine"; „Ideal for dry, damaged and brittle hair". No bond/repair-chemistry claim. |

---

## G0 — `excluded_anhydrous`

confidence **high** · E1 (formula) + E2 (architecture) · scope `formula` · decision_type `metadata`

- formula_observations: `CYCLOPENTASILOXANE` **#1**, `DIMETHICONE` #2, `DIMETHICONOL` #3, `BIS-CETEARYL AMODIMETHICONE` #4 — a silicone system occupying the entire head of the list. **`WATER (AQUA)` appears at position 23 of 36** (the packet's earlier lane report placed it around #15; both captures agree it is nowhere near the top, and the position variance does not change the reading).
- product_inference: a silicone-continuous serum/oil architecture in which the aqueous phase, wherever it sits, is a minor component rather than the carrier.
- threshold_reasoning: the `excluded_anhydrous` state is defined as "**No Aqua, or Aqua absent from the top of the list**; cyclomethicone/dimethicone/oils lead → oil/serum category". Both limbs are met by direct observation. §2.2 excludes "pure oils and anhydrous silicone serums" and routes them to the oil/serum category. `in_category` requires that "Aqua (or an aqueous phase) leads or is materially present" as the architecture — position 23 is not that. `provisional_boundary` was considered and rejected: the architecture is unambiguous even though the *function* is not, and G0 resolves on architecture for this state.
- **The genuine tension, stated plainly.** The function and directions limbs of G0 point the other way: the manufacturer calls it „a weightless **leave-in treatment** oil", the directions describe application to freshly washed hair with **no rinse**, and the product is used exactly as a pre-styling leave-in. This record is therefore *not* a misclassified product — it is a product whose **exposure regime is in-category while its architecture is out**. That is precisely the case §2.3's first named trap describes in reverse ("'serum' is a marketing word, not an architecture"), and the standard resolves it by architecture. The reciprocal question — whether the oil/serum category, which will receive this record, applies leave-on reasoning to it — is a routing question for Nick, not a classification question for this lane.
- limitations: **G12** — this record must not be used to key any rule on "Cyclopentasiloxane present". Under Commission Regulation (EU) 2024/1328 the D4/D5/D6 0.1 % limit reaches **leave-on** products on **6 June 2027**, so `CYCLOPENTASILOXANE` #1 and `CYCLOHEXASILOXANE` #16 are a **decaying signal**; the durable rule is "a volatile carrier is present", with the INCI family enumerated (FS-21, §15). The `regulatory_re_review_trigger: 2027-06-06` applies with unusual force to this record, because a reformulation to linear volatiles or isododecane could move the water position and therefore the G0 verdict itself.
- review_status: `specialist_review_required`

## Classification

Per §2.3, **excluded products do not classify.** All thirteen dimensions and the lean matching profile are `not_applicable — out_of_category`. Retained as a boundary stress case per §16 (a product that leaves the category keeps its record rather than being deleted).

## Recorded observations that travel with the exclusion

**HEAT (recorded, non-normative).** The manufacturer claims „heat protection up to 200°F / 93°C" and **no member of the closed L9 list is present**. Were this record in-category it would be `claim_only` with `provides_heat_protection = true` and a review route. Two observations are worth carrying to the oil/serum lane:
- FS-14 in its sharpest form: 93 °C is well below any styling-tool temperature and below the >200 °C conditions of the Zhou et al. flat-iron work. A °C figure is a **use-condition parameter, never a protection strength**, and this record shows how uninformative the number is — the same claim format spans 93 °C here and 232 °C on slot 10.
- FS-7 and FS-24 both bar the generic silicones, `HYDROLYZED SOY PROTEIN` #14 and `HEXAPEPTIDE-11` #15 from reaching `formula_plausible`.

**EXPO (recorded, non-normative).** `FRAGRANCE (PARFUM)` #31 plus `LINALOOL`, `LIMONENE`, `GERANIOL` and — in this international capture — **`HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE` (HICC) #35**, an EU-restricted fragrance allergen. The packet records that both German retailer listings consulted in the original lane omit HICC. **This lane could not reproduce a DE-market verbatim string**, so the captured formula is explicitly *not* claimed as DE-safe. G5: the conflict is preserved and the smallest affected scope is lowered — here that is the whole record, since the exclusion verdict rests on the silicone head of the list, which both captures agree on.

## Non-normative shadow read (for blind-lane comparison only — NOT part of the reference key)

**These values are void.**

| Dim | Shadow value | One-line basis |
|---|---|---|
| FORM | `anhydrous_serum_or_oil` | the fifth, out-of-category architecture |
| COND | `moderate` | persistent silicone package + `BIS-CETEARYL AMODIMETHICONE` #4; no LGN pair above the tail (`CETEARYL ALCOHOL` sits at #18) |
| SLIP | `high`, bias `dry_biased` | persistent silicone film + amodimethicone-class cationic; volatile carrier for spread |
| SFR | `high`, SHN `present` | continuous persistent silicone film + a separate lipid route (`CARTHAMUS TINCTORIUS SEED OIL` #6, `MYRISTYL MYRISTATE` #20) |
| WT | `high` | multiple persistent non-volatile families with the silicone leading at #2/#3; the „weightless" claim is E0 and would be a §10.1 conflict tag |
| PERS | `ph_dependent_cationic` | `BIS-CETEARYL AMODIMETHICONE` #4 as architecture; `QUATERNIUM-91` #21 supporting; the volatile cyclosiloxanes contribute nothing |
| HOLD | `none` | no L5 member |
| HEAT | `claim_only` | see above |
| HUM | `formula_plausible` | persistent hydrophobic silicone film, humectants (`GLYCERIN` #17, `BETAINE` #19) not dominant |
| R2 | `candidate` | `HEXAPEPTIDE-11` #15 (peptide) in a film context; low confidence, mid-list |
| DOSE | `high` | shadow WT `high` plus a low-spreading non-volatile load |
| EXPO | `aromatic_or_allergen_exposure` | see above; HICC conflict preserved |
| ROLE | `["post_wash", "refresh"]` | E1: freshly washed hair before styling products; small amount on dry hair afterwards |
| care_direction | `unknown` | silicone-led material direction; §9 has no anchor for it (the fourth such case) |
