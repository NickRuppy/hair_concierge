# Gold-set PROPOSED REFERENCE KEY — summary

- Standard: `leave-in-inci-v0.1` (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.v0.1.md`)
- Engine run: `reference-key-2026-09-03` · Packet: `leave-in-gold-set-calibration-v0.1` (frozen 2026-09-03)
- Artifacts (all in `plans/leave-in-inci/research/gold-set/reference-key/`): `reference-key.json` (machine-comparable) · `NN-<slug>.md` × 13 (evidence chains) · this file
- Status: **PROPOSED, pre-adjudication.** Formula-only classification, capped at E2 throughout. No catalog value, recommendation, Supabase row, user-facing copy or production matcher changes on its authority (§19 stop condition).

**Headline: 3 of the 13 frozen products leave the category at G0.** Two of those were expected boundary exercises (Kevin Murphy, Maria Nila); the third — Balea Magical Water — was slotted as the "mainstream milk/lotion" archetype and turns out to be a rinse-out product. That is the single most important finding for the calibration lane, because it means the gold set currently has no clean mainstream-emulsion archetype and one of the twelve archetype cells is empty.

---

## 1. Headline calls — 13 rows

`—` = not classified (out of category). Weight column shows the **projected** `weight_potential`; slot 1's trace value differs (see note).

| # | Product | G0 boundary | Form | Cond. | Weight | Persistence | Hold | Heat (binary) | Primary focus | Fine-hair fit |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | alverde Sprühkur Express 7in1 | `in_category` | `two_phase` | moderate | moderate ¹ | moderate | none | **false** | general | conditional |
| 2 | Balea PROF. Magical Water | **`excluded_other_form`** | — | — | — | — | — | — | — | — |
| 3 | Cantu Leave-In Repair Creme | `in_category` | `emulsion` | **high** | **high** | moderate | none | **true** ² | general | caution |
| 4 | alverde Nutri-Care 2-Phasen | `in_category` | `two_phase` | moderate | **high** | moderate | none | false | general | caution |
| 5 | EVO Head Mistress Cuticle Sealer | `in_category` | `emulsion` ³ | moderate ⁴ | moderate ⁵ | moderate | none | **true** ² | smoothing | conditional |
| 6 | Curlsmith Hydrate & Plump | `in_category` | `emulsion` | **high** | **high** | **high** | incidental | false | curl_definition | caution |
| 7 | Maria Nila Curlicue Cream | **`excluded_styling_first`** | — | — | — | — | (meaningful) | — | — | — |
| 8 | Schwarzkopf GLISS Express-Repair | `in_category` | `emulsion` ³ | moderate ⁴ | moderate ⁵ | **high** | none | **true** ² | smoothing | conditional |
| 9 | Redken Extreme Anti-Snap | `in_category` | `emulsion` ³ | moderate ⁴ | moderate ⁵ | moderate | none | **true** ² | smoothing | conditional |
| 10 | Olaplex N°.6 Bond Smoother | `in_category` | `emulsion` | **high** | **high** | moderate | none | **true** ² | smoothing | caution |
| 11 | Balea Leichtkämmspray Pure Styling | `in_category` | `aqueous_solution` | **low** | **low** | **low** | none | false | volume_lightness | recommended |
| 12 | Kevin Murphy Young.Again Oil | **`excluded_anhydrous`** | — | — | — | — | — | — | — | — |
| 13 | Neqi Diamond Glass Ultimate | `in_category` ⁶ | `aqueous_solution` ⁶ | moderate ⁴ | moderate | **high** | incidental ⁶ | **true** ² | heat_styling | conditional |

¹ Trace WT = `high`; projected `moderate` under §10.1 (conflict-tagged FORM + a contradicting "ohne zu beschweren" intended finish).
² `provides_heat_protection = true` is **claim-led** per §13.3 with **no L9 member present** → every one of these six is routed to human review with a "claim looks formula-unsupported" note. It is a reporting decision, never an efficacy statement.
³ Non-LGN emulsion — the §7.1 `emulsion` anchor is LGN-specific and does not literally cover a polymeric- or silicone-emulsifier system. Field marked uncertain.
⁴ Capped at `moderate` because the COND `high` anchor makes an LGN pair a **necessary** condition. See hard call H-1.
⁵ See hard call H-2 — the WT anchors have no cell for "several light/medium persistent non-volatile families".
⁶ Genuinely close boundary; `excluded_styling_first` and `meaningful_hold_route` recorded as live alternatives.

**Distribution sanity check.** Ten in-category records split 4 `high` / 5 `moderate` / 1 `low` on conditioning, and 4 `high` / 5 `moderate` / 1 `low` on weight — and those are the *same* four products, all four of which are LGN emulsions or two-phase sprays. Every silicone-led product in the set lands on moderate/moderate. That correlation is an artefact of the anchors, not of the products, and it is the central thing calibration should look at.

---

## 2. Records routed to human review (13 of 13)

Every record is routed for at least one §14 reason. Grouped by trigger:

**A. Heat-protection claim with no L9 member (§13.3 / §14) — 6 records: 3, 5, 8, 9, 10, 13** *(plus slot 12, recorded with its exclusion)*
The designed review path, and it fires on **every single claiming product in the set**. `product_tested` was reached zero times; `formula_plausible` was reached zero times. On current evidence the closed L9 list is empty of German-market matches, which answers SR §M.8 provisionally: `product_tested` is reachable-but-unobserved, and `formula_plausible` may be effectively unobserved too.

**B. G0 boundary decisions — 4 records**
- **2 — Balea Magical Water: `excluded_other_form`.** Directions on the exact-GTIN retailer page read „Nach 9 Sekunden gründlich ausspülen." Decisive. Review item is what to do with the empty archetype cell, not the verdict.
- **7 — Maria Nila Curlicue: `excluded_styling_first`.** `PVP` at #4, conditioning limited to a cetyl alcohol with no quat partner and a tail-level Quaternium-95, manufacturer positioning "Curl Defining Styling Cream" with a stated **Hold 3/5**. Also carries the standalone `HOLD = meaningful_hold_route` trigger.
- **12 — Kevin Murphy Young.Again Oil: `excluded_anhydrous`.** Cyclopentasiloxane #1, water at #23. Architecture out, exposure regime in (the manufacturer calls it "a weightless leave-in treatment oil", applied to washed hair, never rinsed). The routing question — does the receiving oil/serum category apply leave-on reasoning? — is Nick's, not this lane's.
- **13 — Neqi Diamond Glass: `in_category`, but genuinely close.** Decided, then routed.

**C. Identity / formula-source conflicts (§14) — 5 records: 3, 4, 9, 10, 12**
- 3: DE vs US formula under a different GTIN. 9 and 10: two circulating GTINs each. 12: GTIN conflict + the captured list is the international (HICC-containing) one + an unresolved token spelling. 4: the SKU is now **confirmed delisted at dm.de**; directions were recovered only from an archived page.
- Also: **6 and 7 have no GTIN at all** — an absent exact-market identifier is itself a §14 trigger.

**D. Two-phase products (§14, least dose-predictable form) — 2 records: 1, 4**
Slot 1 arrives here as a *classification* result: the packet gave no FORM, and a 32-ingredient list with **no emulsifier or solubiliser of any kind**, a sunflower oil at rank #2, and directions reading „Bitte vor Gebrauch schütteln" reads as two-phase.

**E. Proprietary bond/repair chemistry (§14) — 1 record: 10.** `BIS-AMINOPROPYL DIGLYCOL DIMALEATE` #11 → `R3 = chemistry_candidate`, review flag open, no repair level set. Worth noting: Olaplex makes **no explicit bond-repair claim** for N°.6 — the bond claim is carried by the product name, which is E0.

**F. Root/scalp application and a fragrance-free implication (§14) — 1 record: 11.** A „Kopfhautpflege durch prebiotisches Inulin" claim against directions that say nothing about placement, plus an „Ohne Parfüm" pack badge over a genuinely fragrance-signal-free list.

**G. Routine-level efficacy offered for a single leave-in (§14) — 1 record: 9.** Redken's „73 % less breakage" is, by the manufacturer's own asterisk, a three-product system result.

**H. Rule-ambiguity items raised by this lane (not a listed §14 trigger) — records 1, 4, 5, 8, 9, 11, 13.** Detailed below.

---

## 3. Honest hard calls — the calibration discussion list

Ordered by how much they move outcomes.

### H-1 — The COND `high` anchor makes an LGN pair *necessary*, so no silicone-led leave-in can reach high conditioning
Affects **4 of 10** in-category records (5, 8, 9, 13). The anchor reads "an LGN pair present above the tail **plus** at least one further independent lubrication route". Silicone systems do not use LGN pairs, so a product with a persistent silicone film *and* a silicone quat *and* an emollient — three independent routes, which is exactly what G3 rule 3 asks for before a top value — is still capped at `moderate`.

The damage is downstream: §10.3's `damage_fit` third row requires `conditioning_level = high`. **Slot 9 (Redken Anti-Snap) is the sharp case** — it is the only product in the set with a genuine, named, non-generic substantive film route (`Hydrolyzed Vegetable Protein PG-Propyl Silanetriol`), it is explicitly built for extremely damaged hair, and it lands on `highly_damaged: conditional`. Meanwhile slot 10 (Olaplex) reaches row 3 on an **unproven** bond chemistry whose review flag is open. An unsubstantiated bond claim unlocks the damage upgrade; a real silane film route does not. That asymmetry looks wrong and I could not resolve it inside the standard.

### H-2 — The WT anchors have no cell for "several *light/medium* persistent non-volatile families"
Affects records 5, 8, 9. `high` needs an LGN pair, **or** ≥2 persistent non-volatile families *with a rich/low-spreading band member*, **or** a two-phase/microemulsion oil phase. `moderate` says "**exactly one** persistent non-volatile family". A dimethicone-plus-macadamia cream fits neither cell.

I took `moderate`, on §10.1's own tie-break ("do not encode unresolved uncertainty as a restrictive `high` that silently removes fine hair"). **I am genuinely unsure this is right for slot 5** — EVO Head Mistress has `DIMETHICONE` at rank #2 in an opaque cream, and reading that as *moderate* weight may understate it badly. The alternative (`high`) is preserved in each record's `threshold_reasoning`. A reviewer taking the other reading would flip fine-hair fit from `conditional` to `caution` on three products. **This is the single largest source of disagreement I would predict against a blind reviewer.**

### H-3 — PERS has no class for a monomeric permanent quat
`permanent_cationic` enumerates silicone quats, high-charge-density polyquaterniums and cationised proteins; `ph_dependent_cationic` covers amodimethicone and amidoamines. Behentrimonium/Cetrimonium Chloride and Behentrimonium Methosulfate — which appear in slots 2, 3, 5, 10 and 11 — are *permanently* charged but small, mobile and surfactant-removable, and belong to none of the listed families.

I ruled (LD-1) that a monomeric quat alone does **not** reach `permanent_cationic`, and recorded `neutral_non_volatile` with the charge mechanism noted. The opposite ruling would flip slots 3 and 10 from `persistence: moderate` to `high` and add buildup cautions. Note the direction of risk: SR is explicit that the *damaging* error is scoring persistence low while the material is substantive (FS-13), so my conservative choice here is conservative in the **less** protective direction. I flag that deliberately.

### H-4 — `care_direction` has no anchor for a silicone-led architecture
Returns `unknown` on **4 of 10** in-category records (5, 8, 9, 13) for one structural reason: `protein` requires a protein/peptide/silane route that is *materially present*, `moisture` requires a coherent **L1/L3/L4** architecture as the material direction, and a silicone film is **L2** — outside both anchors. Slot 9 is the near-miss: it *has* a silane route (R2 `candidate`), and fails `protein` purely on the materiality clause because the silanetriol sits at #14. Slot 11 is the opposite near-miss: I recorded `moisture` at **low** confidence because the L3 emollient limb is entirely absent (L1 + L4 only), and whether that counts as "coherent" is a rule question I could not settle.

The science review recommended dropping this axis; ruling 7 kept it. On this evidence the axis returns `unknown` or a low-confidence value for half the set, which is worth weighing against that ruling.

### H-5 — The `detangling` focus anchor may be structurally unreachable for detangling products
`detangling` requires SLIP `high` **with** a `wet_biased` or `both` bias. SLIP `high` requires two or more independent M1 contributors. A light detangling spray has, by construction, exactly one — so it caps at `moderate` and cannot qualify. Meanwhile `wet_biased` requires "no persistent film", which is exactly what rich products carrying two M1 routes *do* have. **The two conditions pull in opposite directions**, and `detangling` was set **zero times across 10 in-category records** — including on slot 11, a „Leichtkämmspray" whose entire declared purpose is easier combing (it lands on `volume_lightness`), and slot 4, whose claims are „Verbessert die Kämmbarkeit / Entwirrt und bändigt" (it lands on `general`). Four records landed on `general` in total. Either the anchor needs loosening or `general` needs to be understood as the expected majority outcome.

### H-6 — Slot 1's FORM: two-phase or a solubilised hydroalcoholic spray?
The alverde 7in1 has **no emulsifier and no solubiliser anywhere in 32 ingredients**, sunflower oil at #2, and a shake direction — the literal `two_phase` anchor. But `ALCOHOL DENAT.` sits at #3 and could be co-solubilising, and I never observed the pack. The call cascades: `two_phase` → WT trace `high` → DOSE `high` → a shake caution and a dosing caution. I then applied §10.1 to project weight back down to `moderate` because the product claims „ohne zu beschweren". **Two judgment calls stacked on one unobserved fact.** A reviewer who calls it a hydroalcoholic solution gets WT `moderate` directly and DOSE `moderate`, and the visible profile is nearly identical for a different reason — which is itself worth noticing.

### H-7 — Slot 13's G0: a blow-dry primer, or a styling spray wearing a leave-in label?
The fixative (`VP/METHACRYLAMIDE/VINYL IMIDAZOLE COPOLYMER`) sits at **#8, ahead** of the silicone quat at #11; there is no emollient, oil or fatty alcohol at all; the manufacturer's own name is "Styling Spray". Against that: §2.2 explicitly includes blow-dry primers when conditioning is meaningful, a silicone quat is one of the most substantive conditioning materials in the category, and **neither source makes a hold claim** — which fails the "positioning leads on durable hold" limb of the styling exclusion. I decided `in_category` with `HOLD = incidental_film` and routed it. A reviewer returning `provisional_boundary` or `meaningful_hold_route` would be reasoning correctly from the same facts.

Related and worth calling out: slot 13's `curl_definition_focus` derivation (HOLD + COND + WT) is **mechanically satisfied** on a spray whose directions describe sectioned blow-drying under tension. I refused it. §8.2 gives no rule for refusing a derived flag whose trigger fires but whose meaning is absurd.

### H-8 — Slot 13 and the closed L9 list
The product contains a VP-family film former and its directions *require* a blow-dryer — and the rule still returns `claim_only`, because the polymer with published protection data is **VP/Acrylates/Lauryl Methacrylate Copolymer**, not this terpolymer. I applied the closed list strictly, as G10 demands. This is the case that will most tempt a reviewer to reason by family resemblance, and the record says so explicitly. Related, from slot 12: the same claim format spans **93 °C** (Kevin Murphy) and **232 °C** (Olaplex), which is about as clean a demonstration of FS-14 as the category offers.

### H-9 — `texture_fit` has no row for high weight without high slip
Slot 4 (WT `high`, SLIP `moderate`) matches none of §10.3's three rows. I assigned `conditional` across all four textures and marked the field uncertain rather than borrowing a neighbouring row. Small, but it will produce a clean disagreement if the blind reviewer borrows instead.

### H-10 — SFR and G3: when is a film route an "additional" observation?
G3 says SFR's top value needs an endpoint-relevant *additional* observation, not a restatement of the M1 deposit. I read that as requiring a **second ingredient family**: slot 5 earns `high` (silicone film + a separate macadamia/isoparaffin lubrication route); slot 13 gets `moderate` (film and lubricant are the same two silicones); slots 3 and 6 get `moderate` (the only candidate film is the cationic route already maxed in COND). That is a defensible line but it is *my* line — the standard does not state it. It is why the two silicone-free LGN creams score `moderate` on smoothing while looking, to a lay reader, like smoothing products.

### Two smaller notes
- **§18 copy defect.** The R2 `candidate` German string („Enthält einen **Protein**-Film-Baustein…") is emitted for slots 5 and 13, where the route is a **silicone quat**, not a protein. The string needs rewording before any copy use.
- **`scalp_application_fit` had no derivation rule.** §10.3 gives only "derived from directions plus EXPO, default `unknown` when silent". I adopted an implementation default (LD-4) so the set would be internally consistent: explicit lengths/ends placement → `avoid` (slots 1, 4); application extending toward the root area → `conditional` (slot 3); silent → `unknown` (all others). Worth ratifying or replacing.

---

## 4. What the key does *not* contain, deliberately

No duration, wash count, applications-to-buildup or clarification schedule (G11), and none of the banned circulating removal percentages. No `heat_protection_max_c` — the 230 °C / 232 °C / 93 °C figures are recorded as claim strings only (ruling 6, FS-14). No graded hold level (§7.7); Maria Nila's manufacturer-stated "Hold 3/5" is recorded as E0 and never adopted. No independent shine value anywhere — `smoothing_shine_qualifier` only, `present` on 5, 8, 9, 10, 13 (§8.1). No layering compatibility matrix or score; LAYER is a caution string on 3, 6, 8, 13 (§8.4). No tolerance, allergy or sensitive-scalp prediction from any INCI list, and no diagnosis (G6, SR §M.12). No dew-point threshold (FS-16). Every `high`-persistence record carries its buildup caution, and no record scores persistence high while presenting buildup as low (G3 rule 4, FS-13).
