# Calibration round 2 — category-developer reference key, summary

Engine run `reference-key-2026-09-04` · Standard **`leave-in-inci-v0.2`** · Packet `leave-in-gold-set-calibration-v0.1` (amended 2026-09-04, slot 2 swapped)
Lane: category-developer classification. **Independence:** classified fresh from v0.2 and the packet; round-1 outputs (`reference-key/`, `blind/`, `agreement/`) were not read, so this key can serve as a regression test against round 1.

---

## 1. Headline table — 13 products

| # | Product | G0 | `product_form` | `conditioning_level` | `weight_potential` | `persistence` | `hold_support` | `provides_heat_protection` | `focus.primary` | fine-hair fit |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | alverde Leave-In Sprühkur Express 7in1 | in_category | two_phase | moderate | moderate | moderate | none | false | general | conditional |
| 2 | ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol | in_category | emulsion | **high** | **high** | **high** | none | false | general | caution |
| 3 | Cantu Leave-In Haarkur Repair Creme | in_category | emulsion | **high** | **high** | moderate | none | false | general | caution |
| 4 | alverde Nutri-Care 2-Phasen-Sprühkur | in_category | two_phase | moderate | moderate | moderate | none | false | general | conditional |
| 5 | EVO Head Mistress Cuticle Sealer | in_category | emulsion | moderate | moderate | moderate | none | false | **smoothing** | conditional |
| 6 | Curlsmith Hydrate & Plump Leave-In | in_category | emulsion | **high** | **high** | **high** | incidental | false | general | caution |
| 7 | Maria Nila Curlicue Cream | **provisional_boundary** | aqueous_solution | low | moderate | moderate | **meaningful** | false | **curl_definition** | conditional |
| 8 | Schwarzkopf GLISS Sprüh-Conditioner Express-Repair | in_category | emulsion | moderate | moderate | **high** | none | **true** | **smoothing** | conditional |
| 9 | Redken Extreme Anti-Snap Leave-In Treatment | in_category | emulsion | moderate | moderate | moderate | none | **true** | **smoothing** (sec. `repair`) | conditional |
| 10 | Olaplex N°.6 Bond Smoother | in_category | emulsion | **high** | **high** | moderate | none | **true** | **smoothing** | caution |
| 11 | Balea Leichtkämmspray Pure Styling | in_category | aqueous_solution | low | **low** | moderate | none | false | **detangling** (sec. `volume_lightness`) | recommended |
| 12 | Kevin Murphy Young.Again Oil | **excluded_anhydrous** | — *(no lean profile emitted, §2.3.1)* | — | — | — | — | — | — | — |
| 13 | Neqi Diamond Glass Ultimate Styling Spray | **provisional_boundary** | **unknown** | moderate | moderate | moderate | **meaningful** | **true** | **heat_styling** | conditional |

Supporting values not in the table: `care_direction` is `moisture` for 1, 2, 3, 4, 6, 7, 8, 10, 11, 13; `protein` for 9; `unknown` for 5. `humidity_resistance` is `formula_plausible` for 5, 8, 9, 10; `claim_only` for 13; `not_claimed` for the rest. `usage_role` is empty for 3, 5, 6, 7 (directions below C1/C2 authority). `scalp_application_fit` is `avoid` for 1–6 and 8–10, `unknown` for 7, 11, 13.

**Distribution notes worth carrying into the diff.** Seven of twelve in-category products project `focus.primary: general` or a single `smoothing`; only slots 11 and 13 produce a focus a user would recognise as the product's purpose. Nine of twelve project `scalp_application_fit: avoid`, in every case on the EXPO trigger alone. Four heat binaries are `true`, and **all four rest on a C2 claim with no L9 member**, i.e. all four route to review. No product reached HEAT `formula_plausible` or `product_tested`; §17.8 stays open.

---

## 2. Claim capture performed this pass

The packet carries verbatim directions (R11) but **no claim capture at all**, while v0.2's R12/G13 makes claims decisive for `provides_heat_protection`, HUM and parts of §10.2. Applying §2.4.1 rule 1 with no capture would have set all thirteen heat binaries to `false` by default. Five targeted C1/C2 verifications were therefore run:

| Slot | Field | Tier | Verbatim | Source |
|---|---|---|---|---|
| 8 | HEAT | C2 | „Hitzeschutz bis zu 230 °C" | schwarzkopf.de — Gliss Ultimate Repair Express-Repair-Spülung page |
| 9 | HEAT, directions, marketing position | C2 | „bietet gleichzeitig einen Hitzeschutz"; „Nach dem Extreme Shampoo und Conditioner anwenden. Ins handtuchtrockenen Haar geben. Nicht ausspülen."; sold on *Hydrolyzed Vegetable Protein PG-Propyl Silanetriol* | redken.eu/de-de |
| 10 | HEAT, HUM, directions | C2 | „Hitzeschutz bei 450ºF/232ºC"; „Bändigt krauses Haar bis zu 72 Stunden lang mit dieser feuchtigkeitsbeständigen Formel"; „Einen Pumpstoß auf das saubere, feuchte Haar auftragen." | olaplex.de |
| 13 | HEAT, HUM | C2 | „intensiver Hitzeschutz bis 230°"; „Starker Anti-Frizz-Effekt … schützt das Haar langanhaltend vor Feuchtigkeit" | neqi-hair.com |
| 1 | HEAT, HUM | C2-equiv (RC-1) | no heat and no anti-frizz claim; benefits are moisture, split ends, shine, detangling, surface protection, lightness | dm.de product copy, dm-Art. 3090444 |

Two of these changed projected values: slot 9's and slot 10's C2 German pages moved `usage_role` from `[]` to `[post_wash]`.

---

## 3. Records routed to human review — 13 of 13

Every record in the set routes. That is itself a finding.

| # | Trigger(s) | §14 basis |
|---|---|---|
| 1 | Two-phase product · `claim_authority_gap` (RC-1 house-brand tier) · GTIN discrepancy raised this pass (packet 4066447919387 vs current listings 4067796199635) | §14 two-phase; §2.4.1 r1; §14 identity |
| 2 | `claim_authority_gap` (RC-1) · retailer-internal name conflict („Hyaluron & Care" vs „… & Panthenol") | §2.4.1 r1; §14 identity |
| 3 | Formula-source conflict (DE pack vs US variant, different GTIN) · `claim_authority_gap` (no C1/C2 source exists) · directions only at C3 ⇒ `usage_role` forced empty · PQ-10 at rank 30 vs marker at 28 | §14 conflict; §2.4.1 r1; §2.4/§7.13 by analogy; §3.1.1 |
| 4 | Two-phase product · absent exact-market identifier (dm.de URL 404s, SKU delisted) · `claim_authority_gap` (RC-1) · WT anchor conflict (§7.5 G9-clause 1 vs the `high` row) · degenerate tail marker | §14 two-phase; §14 identity; §2.4.1 r1 |
| 5 | `claim_authority_gap` (frizz text only at C5) · no C1/C2 directions ⇒ `usage_role` `[]` · Quaternium-80 at rank 14 vs marker at 6 (moves 5 fields) · Polyacrylamide outside the §5 L5 enumeration | §2.4.1 r1; §7.13; §3.1.1/§7.6 |
| 6 | No reliable identifier (GTIN not established) · no C1/C2 directions ⇒ `usage_role` `[]` · `claim_authority_gap` · tail marker at rank 36 of 40 decides `focus.primary` between `curl_definition` and `general` | §14 identity; §7.13; §3.1.1 |
| 7 | **G0 `provisional_boundary`** · **`HOLD = meaningful_hold_route`** · **`quat_structure: unresolved`** (Quaternium-95) · no C1/C2 directions · `claim_authority_gap` · §7.1 solution-row conflict (FORM) · COND `low` / SLIP `moderate` seam | §14 boundary; §14 HOLD; §14 quat; §7.13; §2.4.1 r1 |
| 8 | **Heat claim with no L9 member** · **`PERS = permanent_cationic` + `refresh` role** · `care_direction` silicone-led-with-thin-leg unresolved · designated heat product cannot reach the `heat_styling` focus | §13.3/§14; §14 |
| 9 | **Heat claim with no L9 member** · GTIN unresolved (2 candidates) · **`quat_structure: unresolved`** (Quaternium-33) · tail marker at rank 3 (§3.1.1 r3 applied across 5 fields) · `focus.primary` uncertain · R2 `candidate` under an unusable marker (moves 4 fields) | §13.3/§14; §14 identity; §14 quat; §14 tail; §10.2 r5 |
| 10 | **`R3 = chemistry_candidate`** (proprietary bond claim) · **heat claim with no L9 member** · GTIN unresolved · R2 silane below the tail with no §7.10 row for that case · §18 has no string for `R3 = chemistry_candidate` · §18 has no string for a *claimed* HUM `formula_plausible` | §14 bond; §13.3/§14; §14 identity |
| 11 | `claim_authority_gap` (RC-1) · COND `low` / SLIP `moderate` seam (the slot where round 1 first found it) · packet normalization artifact („1,2-Hexanediol" comma-split) | §2.4.1 r1; v0.2 §21 |
| 12 | **G0 exclusion of a product whose directions describe leave-on use** · GTIN unresolved · DE-market (HICC-free) INCI not reproduced · token-level uncertainty (Vanillyl vs Vinyl Butyl Ether) | §14 boundary; §14 identity/conflict |
| 13 | **G0 `provisional_boundary`** · **`HOLD = meaningful_hold_route`** (resting on an analogical L5 placement) · **heat claim with no L9 member** · **`FORM = unknown`** · Silicone Quaternium-18 at rank 11 vs marker at 9 (moves 6 fields) · `focus.primary` uncertain · unverified sibling GTIN | §14 boundary; §14 HOLD; §13.3/§14; §7.1; §10.2 r5 |

**Reading of the routing volume.** Only three routes come from genuine product ambiguity (the two `provisional_boundary` records and the exclusion). The rest come from three systematic sources: **claim/directions authority** (10 records), **the tail-marker heuristic** (6 records, decisive on 3), and **identity gaps already in the packet** (6 records). A round-2 agreement figure computed over a set where 13/13 route to review measures the rules' repeatability on *uncertain* readings, which is what §19.2 asked for — but it should not be reported as a readiness signal.

---

## 4. Where v0.2 was still ambiguous or contradictory

Ordered by how many projected fields each item moves. **A1–A5** are the lane reading conventions recorded in `reference-key.json`; the rest are defects found while classifying.

### A1 — §2.4.1: no tier for a private-label brand where retailer and manufacturer are one legal entity
**Affects slots 1, 2, 4, 11 (4 of 13).** §2.4.1 defines tiers by *source type*: C2 is "the manufacturer's German/EU product page", C3 is "exact-GTIN German retailer listing", and "retailer copy … **never** creates a claim". dm.de is the exact-GTIN German retailer **and** the brand owner for alverde and Balea; rossmann.de likewise for ISANA (codecheck names Dirk Rossmann GmbH as manufacturer). Read literally, four of the set's German mass-market products lose `usage_role` entirely. Read purposively — the rule exists to stop *retailer-invented* copy (BR §2.9's PVP case) — those pages are the brand owner's own product data and are C2.
This lane adopted **RC-1** (house brand ⇒ C2-equivalent, flagged, routed) and applied it uniformly. **v0.2 does not decide it**, and the two readings differ on `usage_role` for four products.

### A2 — §2.4.1 C2 row vs rule 3: is a non-German **EU** manufacturer page C2 or C5?
**Affects slots 5, 6, 7, 10 (4 of 13).** The C2 row says "Manufacturer's German/**EU** product page". Rule 3 says "**Non-German EU** or non-EU market pages are C5, not C2". These are directly contradictory for an EU-but-not-German manufacturer page — Maria Nila (Swedish) and Curlsmith's EU presence are exactly that shape. The lane adopted **RC-2** (rule 3 governs), the conservative reading. Under the C2-row reading, slots 5, 6 and 7 gain `usage_role` values and slot 5's frizz text becomes a real HUM claim.

### A3 — §7.6 and §7.10: are the class/route anchors gated on the §3.1.1 tail marker, and does the coherence prong override rank?
**Affects slots 3, 5, 9, 10, 13 (5 of 13); moves up to 6 projected fields on slot 13 alone.** §3.1.1 defines "present as architecture" with **two** prongs — rank ("above the tail") and coherence ("plausibly constitutes part of the product's structure … and its family is coherent with the rest of the read") — and rule 4 says the marker "never creates presence". §7.6 says "highest class present as architecture wins" but never says whether rank alone can veto a class. Four polymeric/silicone-functional quats sit just below their markers:

| Slot | Species | Rank | Marker rank | Under strict rank | Under coherence |
|---|---|---|---|---|---|
| 3 | Polyquaternium-10 | 30 | 28 | `neutral_non_volatile` | `permanent_cationic` |
| 5 | Quaternium-80 (silicone quat) | 14 | 6 | `neutral_non_volatile`, R2 `none_visible` | `permanent_cationic`, R2 `candidate` |
| 13 | Silicone Quaternium-18 | 11 | 9 | `neutral_non_volatile`, R2 `none_visible` | `permanent_cationic`, R2 `candidate` |
| 10 | Hydrolyzed Veg. Protein PG-Propyl Silanetriol | 24 | 14 | R2 `none_visible` | R2 `candidate` |

The lane adopted **RC-3** (strict rank, counter-signal recorded, field uncertain, routed) for predictability. **The direction of the resulting error is the one the standard exists to prevent**: under-stating persistence under-warns on buildup, which is why v0.2 rewrote §7.6 (change 12) and why FS-20 exists. Related sub-gap: **§7.10 has no anchor row for a *qualifying* route below the tail** — its `none_visible` row enumerates only non-qualifying materials plus "a plain hydrolyzed protein at any list position". Slot 10 fell in that hole.

### A4 — §7.4: the SFR `high` anchor and its own G3 note contradict each other
**Affects slots 2, 5, 6, 8, 9, 10 (6 of 13).** The anchor is "a continuous surface-film route … **plus** a lubrication route". The gate note says the top value "needs an endpoint-relevant *additional* observation, **not a restatement**" — and since COND typically reads the same architecture, a strict reading makes SFR `high` unreachable for every product whose conditioning *is* its film. The lane adopted **RC-4** (the anchor governs; G3 bars one observation counted twice, not two dimensions reading one architecture). Under the strict note reading, slot 5's and slot 9's `focus.primary` change (`smoothing` disappears; slot 9's becomes `repair`).

### A5 — §10.2: "beyond baseline conditioning" is undefined against §6
**Affects slots 2, 5, 6, 8, 9, 10.** The `smoothing` row requires "a continuous alignment/film route **beyond baseline conditioning**", and rule 1 requires a route to rest on evidence "not simply the M1 lubrication deposit already counted in COND and SLIP". But §6 puts persistent silicones in **M1**, so a literal application makes `smoothing` unreachable for every silicone product — which cannot be intended, since the row exists. The lane adopted **RC-5** (a *dedicated* film system qualifies; a film that is a by-product of an LGN conditioning emulsion does not). This is the sole reason slots 2 and 6 project `general` while 5, 8, 9 and 10 project `smoothing`.

### A6 — §10.2 step 2's observation counting defeats step 3's rank order
**Affects slot 9 decisively; slot 13 structurally.** Step 2 sets `primary` = the strongest qualifying route, where strength is *tested > two-or-more formula observations > one*. Step 3's rank order (`repair > smoothing > …`) applies **only** "when two routes tie on strength". A specialist route resting on one active therefore always loses to a film route resting on two species. Result: **Redken Extreme Anti-Snap — the set's designated protein/surface-repair archetype, with R2 `candidate`, `care_direction: protein` and a C2 marketing position naming its silane — projects `focus.primary: smoothing`.** Step 3's repair-over-smoothing precondition is fully satisfied and never gets to apply. Marketing position, the only evidence that says what the product is *for*, is demoted to a step-4 tie-break it never reaches.

### A7 — §10.2's `curl_definition` anchor has no negative gate
**Affects slots 6, 7, 13.** The anchor is `HOLD ∈ {incidental_film, meaningful_hold_route}` present as architecture **plus** compatible COND/WT, with curl positioning "corroborates only" — so the *absence* of curl positioning cannot count against it. Any fixative-class polymer above the tail with non-extreme COND/WT qualifies, and rank order places `curl_definition` **above** `heat_styling`. On slot 13 that means a blow-dry straightening spray whose C2 directions say to dry „auf Spannung" literally qualifies as a curl product and outranks its own heat-styling route. On slot 6 the opposite failure appears: the anchor was declined only because PVP at rank 32 was judged a token addition — a judgment the rank prong would have overruled.

### A8 — §7.13 + §10.2: the `heat_styling` focus is unreachable for heat products that do not name a tool in their directions
**Affects slots 8, 9, 10 — all three `provides_heat_protection: true` products other than slot 13.** §7.13 requires a direction sentence naming a heat tool and states that "a temperature figure alone is a claim, not a direction". The `heat_styling` focus requires HEAT ≥ `claim_only` **and** ROLE including `heat_styling`. Gliss („Hitzeschutz bis zu 230 °C"), Redken („bietet … Hitzeschutz") and Olaplex („Hitzeschutz bei 232 ºC") all carry C2 heat claims, all project `provides_heat_protection: true`, and **none** can reach the `heat_styling` focus. Only slot 13 does. The rule is defensible in isolation; the interaction is that the production binary and the focus vocabulary disagree about what a heat product is.

### A9 — §10.3.1: the `aromatic_or_allergen_exposure` avoid trigger swamps the directions
**Affects 9 of 12 profiled products.** `avoid` fires on `aromatic_or_allergen_exposure` alone, and in the EU essentially every fragranced product declares at least one of the 26 allergens. All nine fragranced products project `avoid`, including cases where the directions state an explicit ends-only placement that §10.3.1 would otherwise map to `conditional`. The ordered test works as written; the consequence is that the directions-derived signal §10.3.1 was rewritten (change 24) to capture is visible on only three records — and on those three it is `unknown`, never a positive. `suitable_if_evidenced` was **not reached by any product**, so §14's "every positive scalp value routes" trigger is untested.

### A10 — §9 has no home for a film-led architecture, and its silicone-led rule under-fires
**Affects slots 8 and 13 (values taken at `low`, marked uncertain); slot 5 (where it fires correctly).** §9's silicone-led `unknown` rule requires **both** no R2 route **and** no material humectant/emollient leg. Slot 8 is silicone-led at ranks 2/3/5/8/10 but has an apricot-oil leg at rank 4, so the rule does not fire and the record returns `moisture`. Slot 13 is film-led (silicone polymer + fixative) with a glycol water phase, so the humectant-led minimum row returns `moisture` for a blow-dry styling primer — whose own C2 claim is „Feuchtigkeits**schutz**", i.e. protection *against* moisture, close to the opposite of what the label denotes. Slot 7 has the same shape. §9 is a protein-versus-moisture vocabulary; **it has no value for a film-led product**, and its `unknown` escape is gated too narrowly to catch them.

### A11 — §7.11: the `two_phase` DOSE trigger contradicts the "DOSE follows WT" paragraph
**Affects slots 1 and 4.** The derivation table fires `high` on `FORM = two_phase` regardless of WT, and §7.5's G9 clause 3 confirms that is deliberate (a dose-variability statement). The same section's "DOSE follows WT" paragraph then says "any DOSE value that disagrees with its WT input is a G3 violation". Both slots have WT `moderate` and DOSE `high`. The lane read the paragraph as scoped to the multi-family row it was written for (DL C3), but the text is unqualified.

### A12 — §7.5: the G9-resolution clause contradicts the `high` anchor for a two-phase bulk oil
**Affects slot 4.** §7.5's G9 resolution clause 1 says "When a two-phase product carries a bulk oil above the tail, the `high` value rests on that observation". The `high` anchor row requires an LGN pair **or** two-plus persistent families **with a rich-band member**. Slot 4 has soybean oil at rank 2 in an unemulsified system — a bulk oil above the tail — but one family and no enumerated rich-band member (soy and argan read medium-band by the §7.5 convention). The clause says `high`; the anchor says `moderate`. The lane took the anchor, because G14 requires a projected value to be exactly what its anchor says.

### A13 — §7.1: the solution row excludes a long-chain fatty alcohol that its own note tells you to ignore
**Affects slot 7.** The `aqueous_or_hydroalcoholic_solution` anchor reads "**no long-chain fatty alcohol**". §7.1's "Notes on the rebuilt table" then say a long-chain fatty alcohol without a cationic partner "does not by itself create the `emulsion` row" and should be read as an emollient/consistency factor — "classify on the rest of the architecture". Maria Nila Curlicue Cream has Cetyl Alcohol at rank 5 with no cationic partner and matches no other row, so the decision order would return `unknown`. The lane followed the note and took `solution`, marked uncertain.

### A14 — §2.3: the trap-3 sentence and the `excluded_styling_first` row disagree
**Affects slots 7 and 13 — both `provisional_boundary`, in opposite directions.** Trap 3 says "`meaningful_hold_route` with thin conditioning **is what excludes**". The table row requires that architecture **and** that "directions/positioning lead on durable hold or texture". Slot 7 has the architecture and texture-leaning directions but sits in a curl-care range; slot 13 has the architecture and a „Styling Spray" name but C2 directions describing a blow-dry primer, an explicitly *included* form. Two of thirteen records land on `provisional_boundary` for the same rule conflict — and neither is a product a human would find genuinely ambiguous.

### A15 — §18 copy gaps found while projecting
- **No string for `R3 = chemistry_candidate`** (slot 10). §18 provides one only for `R3 = claim_only`. Olaplex's C2 bond claim reaches the user with **no** honesty qualifier, inverting §8.3's entire reasoning.
- **No string for a *claimed* HUM `formula_plausible`** (slot 10). §18 covers `claim_only`, and §7.9 deliberately covers nothing for the *claim-free* case — the claimed-plus-route case falls between them. Olaplex's C2 72-hour anti-frizz claim is projected unqualified.
- **No string for `scalp_application_fit = avoid`** (9 records). §18 has one only for `unknown`. The most restrictive scalp value in the model is silent to the user.

### A16 — §8.3: an enum with no negative member
**R3** has `claim_only / chemistry_candidate / product_tested / unknown` and **no `none`**. Eleven of thirteen products have no bond claim and no bond chemistry; all eleven were emitted as `unknown`, which reads as "unresearched" rather than "absent". §10's own rule — "a profile enum gains `unknown` only where its §7 dimension can actually return `unknown`" — has an unstated converse: a flag needs a negative state where absence is the normal case. Compare `hold_support`, where v0.2 reasoned this through explicitly and correctly.

### A17 — the §3.1.1 tail marker degenerates at both ends of the list-length distribution
**Affects slots 4, 6, 9 hardest.** The heuristic's discriminating power depends entirely on where the first capped ingredient happens to fall:

| Slot | Marker | Rank / list length | Effect |
|---|---|---|---|
| 9 | Phenoxyethanol | **3 / 24** | The entire conditioning architecture is nominally tail; rule 3 invoked; 5 fields marked uncertain |
| 5 | Phenoxyethanol | 6 / 25 | Everything but the silicones is unpositioned |
| 4 | Linalool (allergen block) | **14 / 16** | No preservative is declared at all; the marker separates nothing |
| 6 | Phenoxyethanol | **36 / 40** | "Above the tail" includes twelve botanical extracts and a trace PVP; nearly vacuous |

§3.1.1 rule 2 covers `tail_marker: none_visible` and rule 3 covers a very early marker, but **nothing covers a marker so late that the test is vacuous** — and that case (slot 6) was decisive on `focus.primary`. §17.14 already records the heuristic as unvalidated; round 2's evidence is that its *variance* is the practical problem, not its accuracy.

### A18 — v0.2's two knowingly-unrepaired items both bit again
Recorded because §21 explicitly asked round 2 to measure them.
- **COND `low` / SLIP `moderate` on a single monomeric-quat observation** — reproduced at slot 11 (where round 1 found it) *and* at slot 7. §7.3's `low` is excluded by *any* cationic species above the tail, while §7.2's `moderate` needs a *route*; a lone monomeric quat falls between them. §7.2's `low` anchor also says "**short-chain** quat" while §7.6 calls the same materials "monomeric **long-chain** quats" — two sections, different vocabulary, one material class.
- **SLIP bias qualifier unusable** — returned `unknown` on **8 of 12** profiled products. It fits only a pure silicone-film architecture (slots 5, 8) or a pure water/quat solution (slot 11); every non-film lipid load and every LGN-plus-polymer emulsion is self-excluding, because `both` is defined through a wet route that requires the film's absence. §17.16 predicted this; it is confirmed at scale.

### A19 — packet-level gaps that are really standard gaps
- **The packet captures directions but not claims.** R11 made directions capture mandatory at G1; R12 then made *claims* decisive for `provides_heat_protection`, HUM, the `heat_styling` focus and every „… ist ausgelobt" string — but **§2.4's G1 checklist was never extended to require a claim capture with its tier**. Without the five verifications run this pass, all thirteen heat binaries would have been `false` by §2.4.1 rule 1 and the round-2 HEAT comparison would have been vacuous. This is the single most consequential gap found.
- **v0.2 routes *absent* directions to review (§2.4 rule 3) but has no route for directions that exist and are rinse-tested yet sit below C1/C2 authority.** That is the situation on slots 3, 5, 6 and 7; all four were routed by analogy.
- **Packet normalization artifact:** `normalized_ingredients` splits on commas, so slot 11's „1,2-Hexanediol" became the tokens `"1"` and `"2-HEXANEDIOL"`. Harmless there; it would corrupt rank counts on any product with a comma-bearing INCI name higher in the list.

---

## 5. What worked

Recorded so the repair pass gets credit where it is due. These v0.2 changes were exercised and behaved as designed:

- **R11's rinse test** (change 1) passed cleanly on all thirteen, including both designed traps — slot 8's „Sprüh-Conditioner"/„Spülung" naming with „Nicht ausspülen!" directions, and slot 13's retailer-vs-manufacturer name divergence.
- **The WT multi-family `moderate` row with its mandatory counter-signal** (change 9, R13) fired on slots 1, 7, 8, 9, 13 and produced a stable value where v0.1 had a hole. `moderate` never leaked upward on family count, and the FS-13 double-check ran on each.
- **PERS by enumerated INCI name** (change 11) put PQ-16 (slot 8) and Guar HPTC / PQ-10 (slots 2, 6) in `permanent_cationic` without any charge-density inference. **The monomeric-quat rule** (change 12) gave slot 11 a home in `neutral_non_volatile` where v0.1 would have forced `volatile_or_water_soluble`.
- **R2 narrowed to cationised protein / silane / silicone quat, and plain hydrolysates `none_visible` at any position** (changes 16, 17) resolved slot 8's rank-6 Hydrolyzed Keratin cleanly — the exact hole v0.1 left open — and kept Guar HPTC and PQ-10 out.
- **The L9 tail-member rule** (change 18) stopped slot 1's rank-14 hydrolyzed wheat protein from promoting an unclaiming naturkosmetik spray, on two independent grounds.
- **R14's `damage_fit` row 3b** (change 26) let slot 9 reach the highly-damaged tier on a silane route without COND `high` — the product shape v0.1 could not serve — while **R14's other half** kept slot 10's bond flag out of that tier and out of the `repair` focus.
- **DOSE row corrections** (change 33) gave slot 11 a `low` value v0.1's rows could not produce, and `FORM = unknown` on slot 13 correctly forced neither `WT` nor `DOSE` to `unknown` (G9 clause 2).
- **The §2.3.1 emission contract** (change 29) made slot 12's exclusion unambiguous: identity + G0 + formula + one informational observation, and **no lean profile**.
- **G14 / §10.1.1 trace containment** held throughout: no counter-signal, confidence value, tail marker, `emulsion_subtype` or `quat_structure` reached any projected field, and no §18 string expresses uncertainty except through an `unknown` field value.
