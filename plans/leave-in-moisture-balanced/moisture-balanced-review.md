# Leave-In `care_direction`: moisture vs. balanced — review and v1.1 overlay proposal

Status: **proposal for Nick's ruling. Nothing here is decided.** No change to the frozen v1.0 standard, no DB write.
Date: 2026-09-29 · Worktree: `codex/leave-in-moisture-balanced` · Rerun script: `plans/leave-in-moisture-balanced/rerun.mjs`

---

## 1. Short version

- **Why too many products end up as `moisture`.** Under v1.0 §9, one "moisture leg" above the tail marker is enough. The legs are L1 (any cationic), L3 (any emollient) or L4 (any humectant). Almost every leave-in has at least one of these, so `moisture` has turned into "this product conditions hair" and no longer marks a direction. Three kinds of ingredient are counted as moisture even though they aren't moisture ingredients:
  1. **Glycols** (propanediol, pentylene, dipropylene glycol…). They often work as solvents, extract carriers, preservative boosters or film plasticisers.
  2. **Dry-feel spreading esters and volatiles** (coco-caprylate, isohexadecane…). These are the film's carriers and slip agents.
  3. **Cationics.** They are the baseline conditioning, which COND already scores.
- **Proposed fix (Option A, recommended).** Only two kinds of ingredient can set `moisture`: **settled humectants** (glycerin, betaine, panthenol, sodium PCA, sodium lactate…) and **non-volatile, medium-rich oils or butters**, and only when they sit above the tail. A product whose silicone film **outranks** every one of those ingredients is film-led, so its moisture content counts as incidental → `balanced`. Protein logic, AD-2 (no `unknown`) and the evidence ceiling are unchanged. The only new step is a rank comparison.
- **Rerun (15 products in the corpus that get a care_direction).** 4 flip from `moisture` to `balanced`: **Gliss Express-Repair, Olaplex No.6, Neqi Diamond Glass, Elvital Dream Length (unseen u1)**. The other 11 don't change.
- **Anchors held:** EVO stays `balanced`, Redken stays `protein`, ISANA Hyaluron & Panthenol stays `moisture` (so do ISANA Argan, Cantu and Curlsmith).
- **Live catalog:** 3 of 9 products change (Gliss, Olaplex, Neqi).
- **What I can't deliver: alverde 7in1 does not flip.** Its formula is sunflower oil (r2) + glycerin (r4) with no silicone film. That reads as a light oil-and-humectant softness spray, and it is almost the same build as the alverde 2-Phasen spray. No ingredient rule I could defend flips alverde without also flipping that product, or even Cantu. See §6.
- **The fix is only partial.** Even after the flip, the adapter still gives these products the `moisture_softness` function, because it keys on `conditioning_level ≥ moderate`. So they would still match a dry-hair "needs moisture" function. That needs a separate adapter decision (§8, Q3).

---

## 2. Problem statement

Nick's ruling (2026-09-29): the protein side and the thickness/weight mapping are good. The moisture/balanced boundary is too strict on the balanced side. Products that his expert sheet put in the "Nix" (performance) column land on `moisture` because they contain humectants or emollients, even when those look incidental to a film-led product. As a result, performance products get recommended as if they actively treat dryness.

**Where it bites in the app.** Plan authority (`axis-fit.ts`) scores product vs. target like this: an exact match passes; if either side is `balanced` it's a caution; `moisture` vs `protein` fails. The AD-3a adapter turns `care_direction = moisture` into the `moisture` care benefit. So a performance spray labelled `moisture` fully passes for every dry-hair user and gets the "Feuchtigkeit" benefit.

## 3. Why each product has its current value (v1.0 as frozen)

The mechanism, read from §9 and the frozen records:

| Step | v1.0 rule | Effect |
|---|---|---|
| 1 | R2 `candidate`/`tested` → `protein` | Only Redken (T16) |
| 2 | **Any** L1, L3 or L4 species above the tail marker → `moisture` | Catches 13 of 15 |
| 3 | Otherwise, a persistent film above the tail with all four T19 clauses met → `balanced` | Only EVO, because nothing at all sits above its r6 marker |
| 4 | Otherwise → `unknown` (evidence failure only) | None |

What the frozen records cite as the "moisture leg" for the three live products Nick flagged or would likely flag:

- **Olaplex No.6** (reference-key-v3 slot 10): "emollient (Coco-Caprylate 5, Neopentyl Glycol Diheptanoate 6) and humectant (Propanediol 10) legs." Both esters are in the science review's **dry-feel spreading band** (SR §D.1: "slip and spread"), and propanediol is a multifunctional glycol. No settled humectant and no medium-rich oil sits above its r14 marker. Panthenol is at r41 and aloe at r40.
- **Neqi Diamond Glass** (slot 13): "humectant-led minimum", via Dipropylene Glycol r2 and Pentylene Glycol r6. Glycerin is at r15, below the r9 marker. Both calibration lanes already flagged this record as "`care_direction` under-firing on a film-led architecture".
- **Gliss Express-Repair** (slot 8): the moisture leg is apricot kernel oil at r4, directly behind Dimethicone r3, with Phenyl Trimethicone r5 and Dimethiconol r8 around it. The reference key carries the same "under-firing on a film-led architecture" note.

So the calibration lanes had already sensed the defect. T19 closed §17.22 by making the gate checkable, **not by moving it**, and it explicitly kept Neqi on `moisture` "by design". Flipping Neqi re-opens that part of T19 (Q1).

## 4. What the evidence supports

Claim type: formulation / ingredient function. The bar is cosmetic-chemistry consensus plus the standard's own science review (SR). The overlay stays inside SR/HO, as the authority clause requires. The one point that goes slightly beyond SR's wording is the glycol multifunctionality, and it is already recognised in §3.1.1 clause 6(a) and in CIR function listings.

| Finding | Support | Source |
|---|---|---|
| Humectants (glycerin, betaine, panthenol, sodium PCA) bind water and plasticise keratin, which gives softness and pliability. This is the one mechanism that actually adds "moisture" (water) to the fibre | **Well supported as a mechanism class**; low confidence for any single product | SR §E.1–E.2, §H.1; general glycerin moisture-retention data [1] |
| The same humectants also serve as **film plasticisers**, a "film-quality role, not a hair claim" | **Well supported** (standard formulation practice) | SR §E.2 |
| Glycols (propanediol, pentylene, butylene, dipropylene, propylene glycol) are multifunctional: solvent, extract carrier, preservative booster, humectant. The INCI name doesn't settle which role they play in a given formula | **Well supported** that the function is multiple; *which* role applies in a product is an inference | CIR alkane-diol and dipropylene glycol reviews [2][3]; standard §3.1.1 clause 6(a) already treats 1,2-hexanediol and caprylyl glycol as boosters |
| Volatile carriers (cyclosiloxanes, isododecane, isohexadecane) contribute nothing to residue | **Well supported** | SR §C.2; standard M6 |
| Dry-feel esters (coco-caprylate, dicaprylyl carbonate/ether, isoamyl laurate, IPM) are spreading and slip agents with a low weight penalty; medium-rich oils and butters are the occlusion/softness band | **Moderately supported** | SR §D.1 |
| Cationics give conditioning (antistatic, slip, lubrication). That is COND's baseline, shared by every leave-in, not a moisture direction | **Well supported** | SR §B.2 |
| Oils add softness, lubrication and some occlusion, but they **don't add water**. Oil-coated fibres can even take up water more slowly. Counting oils as "moisture" is a convention inherited from the conditioner standard more than a hard mechanism | **Mixed / debated** | SR §D.1–D.2; practitioner "L-O-C" framing [4] |
| Above 1 %, EU INCI order is descending, so "species A ranks above species B" (both above the tail) is a legitimate ordinal read. Nothing quantitative is | **Regulatory fact** | Standard §3.1 (EU Art. 19) |

**Core conclusion.** The current rule over-assigns `moisture` because it counts non-directional species as legs: **moderate** confidence. Exactly where to draw the new line is a product judgment with no external ground truth; my confidence that Option A draws it right is **low–moderate**.

## 5. Proposed rule — candidate v1.1 overlay (working name T20)

v1.0 is immutable. This ships as an overlay that replaces §9's "how much moisture leg is enough" paragraph and T19's clause 3/4 test **for `care_direction` only**. §5's route dictionary, COND, WT, smoothing_route and every other consumer of L1/L3/L4 stay exactly as they are.

### Option A — directional species + film-lead test (recommended)

> **§9-O1 Directional species.** For `care_direction`, a moisture leg is created only by a **moisture-directional species** present above the tail (§3.1.1; ordinal read when the marker is vacuous or `none_visible`):
> - **(DH) settled humectants**: Glycerin, Betaine, Panthenol, Sodium PCA, Sodium Lactate, Sodium Hyaluronate, Urea, Sorbitol, simple sugars (Glucose, Fructose, Sucrose). The list is representative for materials whose water-binding function is settled by the INCI name. A species whose function the name doesn't settle is not directional and is recorded.
> - **(DL) non-volatile lipids in the medium or rich spreading band** (SR §D.1): plant triglyceride oils, butters, squalane, jojoba, Caprylic/Capric Triglyceride.
>
> **§9-O2 Non-directional species** (recorded; they keep feeding COND/WT/smoothing unchanged, but never set `care_direction`): L1 cationics and LGN fatty alcohols (the conditioning baseline); volatile carriers and propellants (M6); **dry-feel spreading esters** (SR §D.1 dry-feel band); **multifunctional glycols** (Propanediol, Butylene, Pentylene, Propylene, Dipropylene, Hexylene Glycol, 1,2-Hexanediol, Caprylyl Glycol). A glycol **corroborates** a DH species and never creates the leg on its own.
>
> **§9-O3 Film-lead test.** Where a persistent film (T19 clause 2's set: L2 persistent silicone, silicone quat, Polysilicone-29 or a §5 equivalent) is present above the tail **and its highest-ranked species outranks every DH/DL species above the tail**, the moisture leg is subordinate to the film → **`balanced`**, `row: film_leads_moisture_leg`.
>
> **§9-O4 No directional species.** No DH/DL species above the tail, with a readable care architecture (film and/or L1) → **`balanced`**, `row: film_led_neutral` (film present) or `conditioning_only_neutral` (L1 only). No readable architecture at all → `unknown`, unchanged (evidence failure).
>
> **§9-O5 Otherwise `moisture`** (ceiling `moderate`). The humectant-led minimum row (lone DH leg, thin architecture → `low`) is unchanged.
>
> **§9-O6 Confidence and review.** A `balanced` reached through O3 or O4 takes `moderate` only when all three hold: the marker is plausible and not vacuous; the O3 margin is at least 2 ranks; and the read doesn't rest on demoting a glycol that outranks the film. Otherwise it takes `low` and **routes to review** (`moisture_leg_subordinate` or `glycol_only_leg`). Mandatory counter-signal: every demoted species with its rank and class, and any C1/C2 moisture claim (recorded as a counter-signal only, per constraint 3).
>
> **Unchanged:** the protein anchor (R2), `balanced` reading (a) (substantive mixed), `unknown` = evidence failure only, constraints 1–3, the E2 level and the `moderate` ceiling.

**Why this shape.** Each exclusion rests on something the standard already says:
- volatiles contribute nothing (M6);
- dry-feel esters are slip agents (SR §D.1);
- glycols have an unsettled role (SR §E.2 plus the §3.1.1 clause-6 doctrine that an unsettled role is not credited);
- cationics are COND's job.

The film-lead test is the same kind of ordinal comparison as T19 clause 4. It never states a percentage.

### Option A-narrow — species filter only, no film-lead test

Apply O1, O2, O4 and O5, but drop O3. **Flips only Olaplex and Neqi.** Gliss and Elvital stay `moisture`, because a real oil sits above their tail even though it ranks behind the silicone.
- *For:* smaller change; no new rank comparison; nothing hangs on an adjacent-rank read (Gliss is Dimethicone r3 vs apricot oil r4).
- *Against:* it leaves Gliss, the clearest silicone primer in the set, labelled as a moisture product, and the calibration lanes had already flagged Gliss for exactly this.

### Option B — two-phase add-on (only if Nick wants the alverde sprays out of `moisture`)

On top of A: in a `two_phase` architecture, read the oil phase as the lubricating lead (the §6 M1 mechanism, the same one the film feeds), and require a DH humectant to outrank it before `moisture` applies.
- **Flips alverde 7in1 and the alverde 2-Phasen spray.**
- *Against:*
  - The logic is architecture-specific without a mechanism difference. An emulsified oil does the same thing, and applying it consistently would flip Cantu (canola r2 > glycerin r4) and Curlsmith (castor r5 > glycerin r7), which is clearly wrong.
  - Evidence: **weak**.
  - Side effect: alverde 7in1 would then have **no** AD-3a care benefit (focus `general`, repair `low`, smoothing `emollient`). The adapter would return `needs_research`, and alverde would **drop out of the catalog**.
- **Not recommended.**

### Rejected: Option C — "moisture = humectant only"

Treat oils as non-directional as well, so that only humectants can set `moisture`. This is the cleanest science (only humectants add water), but it flips Cantu, Curlsmith and both alverde sprays. That goes against practitioner consensus that rich oil-and-butter creams are the dry-hair products. Rejected.

## 6. Rerun across the corpus

The corpus holds 19 frozen records: 13 in the gold set and 6 in the unseen test. **15 are in-category and emit a `care_direction`.** The other 4 are excluded and emit none: Maria Nila (styling-first), Kevin Murphy (anhydrous), Elvital Öl Magique (u2, anhydrous) and Alcina (u3, styling-first). The brief said 13 products; I reran all 15 that carry a value.

Validation: `rerun.mjs` reproduces the frozen v1.0 value on **15 of 15** records. It also checks every classified rank against the frozen INCI, and it throws on any mismatch.

| # | Product | Live | v1.0 | A-narrow | **A (rec.)** | Row | First film / first DH-DL |
|---|---|---|---|---|---|---|---|
| 1 | alverde Sprühkur Express 7in1 | moisture | moisture | moisture | **moisture** | moisture_led | – / r2 |
| 2 | ISANA Hyaluron & Panthenol | moisture | moisture | moisture | **moisture** | moisture_led | – / r3 |
| 3 | Cantu Leave-In Repair Creme | moisture | moisture | moisture | **moisture** | moisture_led | – / r2 |
| 4 | alverde Nutri-Care 2-Phasen | – | moisture | moisture | **moisture** | moisture_led | – / r2 |
| 5 | EVO Head Mistress | balanced | balanced | balanced | **balanced** | film_led_neutral | r2 / – |
| 6 | Curlsmith Hydrate & Plump | moisture | moisture | moisture | **moisture** | moisture_led | – / r5 |
| 8 | Gliss Express-Repair | moisture | moisture | moisture | **balanced** ⟵ | film_leads_moisture_leg | r3 / r4 |
| 9 | Redken Extreme Anti-Snap | protein | protein | protein | **protein** | protein_anchor | – |
| 10 | Olaplex No.6 Bond Smoother | moisture | moisture | balanced | **balanced** ⟵ | film_led_neutral | r3 / – |
| 11 | Balea Leichtkämmspray | – | moisture (low) | moisture | **moisture (low)** | moisture_led | – / r2 |
| 13 | Neqi Diamond Glass | moisture | moisture (low) | balanced | **balanced** ⟵ | film_led_neutral | r7 / – |
| u1 | Elvital Dream Length Milk | – | moisture (low) | moisture | **balanced** ⟵ | film_leads_moisture_leg | r3 / r7 |
| u4 | Briogeo Avocado + Kiwi | – | moisture | moisture | **moisture** | moisture_led | – / r4 |
| u5 | ISANA Argan Leave-in | – | moisture | moisture | **moisture** | moisture_led | – / r2 |
| u6 | amika The Shield | – | moisture | moisture | **moisture** | moisture_led | r12 / r5 |

### Reasoning for the four flips

**Gliss Express-Repair (slot 8): moisture → balanced, confidence `low`, routes to review.** The first functional ingredient after the volatile carrier (Trisiloxane r2) is Dimethicone r3, with Phenyl Trimethicone r5 and Dimethiconol r8 around the only directional species, apricot kernel oil at r4. Glycerin (r15) sits below the r14 marker, and the keratin (r6) is a plain hydrolysate, so there is no protein route. The film leads, but only by one rank, so O6 keeps confidence at `low`. A reviewer should confirm the read. Nothing else about this silicone heat primer argues for `moisture`.

**Olaplex No.6 (slot 10): moisture → balanced, confidence `moderate`.** No settled humectant and no medium-rich oil sits above the r14 marker; panthenol, aloe and the real oils are all at r34–r46. What v1.0 counted as legs are dry-feel spreading esters (Coco-Caprylate r5, Neopentyl Glycol Diheptanoate r6), volatiles (Isohexadecane r4, Isododecane r8) and a glycol (Propanediol r10). All of them sit behind Dimethicone r3, and all of them carry the film rather than moisturising. The LGN pair (Cetearyl Alcohol r2 + Behentrimonium r7) is real conditioning and keeps COND `high`. It doesn't create a moisture direction.

**Neqi Diamond Glass (slot 13): moisture → balanced, confidence `low`, routes to review.** v1.0 reached `moisture` only through two glycols, Dipropylene Glycol r2 and Pentylene Glycol r6. In a hydroxyacetophenone/ethylhexylglycerin preserved spray with three botanical extracts at r3–r5, those are plausibly solvent, extract-carrier and booster roles. Glycerin (r15) is below the r9 marker. The only film above the tail is Polysilicone-29 r7, and both glycols outrank it, so the read rests on the glycol demotion. O6 therefore gives `low` and review. This flip **reverses a documented part of T19** (Q1).

**Elvital Dream Length Milk (u1, unseen, not live): moisture → balanced, confidence `low`, routes to review.**
- Dimethicone r3 and Amodimethicone r4 lead the architecture.
- IPM (r2) is a dry-feel ester, and niacinamide (r6) is a vitamin whose role on hair isn't settled.
- The only directional species is castor oil at r7, four ranks behind the film.
- Confidence was already one step down for the §2.4.2 formula conflict.
- The C2 claim „wirkt intensiv feuchtigkeitsspendend" is recorded as a counter-signal only (constraint 3). The two sealed lanes had split on this record (unknown vs. moisture), which marks it as a real boundary case.

### Rows that don't move but deserve a note

- **alverde 7in1 (slot 1): stays `moisture`. This is a challenge to Nick's sheet.** The formula's lead non-water ingredient is high-oleic sunflower oil (r2), then alcohol (r3) and **glycerin (r4)**, all above the r9 marker, and there is no silicone or other film. On ingredients alone, that is a light oil + humectant softness spray. Its own claim, „geschmeidiges Haargefühl, ohne zu beschweren", fits that read. The alverde 2-Phasen spray (slot 4) has almost the same build (soy oil r2, alcohol r3, glycerin r4, plus sodium lactate and betaine). Any ingredient rule that flips slot 1 flips slot 4 too, and applied consistently it also flips Cantu (Option B/C). If the "Nix" read comes from how the product performs in use rather than from its formula, it can't be encoded formula-first. It would have to be a named per-product adjudication. Confidence in "stays moisture": **moderate**.
- **amika The Shield (u6): stays `moisture`.** It is sold as an anti-humidity performance spray, but sea-buckthorn oil sits at r5, well ahead of the only persistent film (Phenyl Trimethicone r12), and glycerin (r15) is above the r16 marker. That is honest formula-first. Positioning doesn't enter.
- **Balea Leichtkämmspray (slot 11): stays `moisture (low)`.** Betaine r2 and panthenol r6 are settled humectants. This is the humectant-led minimum row, and it's correct.
- **Excluded records (no emission, informational only):** Kevin Murphy would read `balanced` (Dimethicone r2 ahead of safflower r6); Maria Nila stays `moisture` (glycerin r3; PVP is a hold polymer, not a care film). Neither reaches the catalog.

### Anchors

| Anchor | Held? |
|---|---|
| EVO → `balanced` | **Yes**, now via `film_led_neutral` with no directional species above its r6 marker |
| Redken → `protein` | **Yes**; R2 is decided first and the protein logic is untouched |
| ISANA Hyaluron & Panthenol → `moisture` | **Yes**: glycerin r3 and betaine r6 above the r9 marker, no film. ISANA Argan, Cantu and Curlsmith hold too |

## 7. Catalog impact (the 9 live products)

| Product | Live | Under A | Changes? | AD-3a care_benefits after |
|---|---|---|---|---|
| alverde 7in1 | moisture | moisture | no | unchanged |
| ISANA Hyaluron | moisture | moisture | no | unchanged |
| Cantu | moisture | moisture | no | unchanged |
| EVO | balanced | balanced | no | unchanged |
| Curlsmith | moisture | moisture | no | unchanged |
| **Gliss** | moisture | **balanced** | **yes** | loses `moisture`; keeps `anti_frizz` (smoothing focus + silicone film) → still commits |
| Redken | protein | protein | no | unchanged |
| **Olaplex No.6** | moisture | **balanced** | **yes** | loses `moisture`; keeps `anti_frizz` → still commits |
| **Neqi** | moisture | **balanced** | **yes** | loses `moisture`; keeps `anti_frizz` (silicone film) → still commits |

**3 of 9 live products change.** None of them falls into `needs_research`.

What changes for users of those three products (plan authority `careDirectionAxisFitResult`):

| User target | Before (`moisture`) | After (`balanced`) |
|---|---|---|
| moisture | pass | **caution** (intended: no longer shown as a dryness treatment) |
| balanced | caution | **pass** |
| protein | fail | **caution** (more favourable; see §9) |

**What the flip doesn't fix.** AD-3a sets the functional benefit `moisture_softness` whenever `care_direction = moisture` **or `conditioning_level ≥ moderate`**. All three flipped products (and EVO) have conditioning ≥ moderate, so they keep `moisture_softness`. The personal plan's dry-hair function requirement (`moisture_softness`, "Feuchtigkeit & Geschmeidigkeit") would still be satisfied by them. So the care-direction axis becomes cautious, but the function axis still says "treats dryness". Changing that is an adapter decision (AD-3a), not a standard change (Q3).

## 8. Open questions for Nick

1. **Neqi and T19.** T19 ruled that a film-led product with a genuine leg above its marker "stays `moisture` by design" and named Neqi explicitly. Option A treats Neqi's glycols as not a genuine leg. Do you want to re-open that part of T19? If not, drop the glycol demotion. Neqi then stays `moisture` (Dipropylene Glycol r2 outranks the Polysilicone-29 film at r7). Olaplex still flips under Option A through the film-lead test (Dimethicone r3 outranks Propanediol r10), but under A-narrow it would not.
2. **Option A or A-narrow?** The difference is Gliss (and u1). A says "a real oil sitting behind a silicone lead is incidental". A-narrow only removes the non-moisture species. I recommend A. Gliss is the clearest film primer in the set, and both calibration lanes flagged it.
3. **Should AD-3a's `moisture_softness` require `care_direction = moisture`?** Without this, performance products keep matching dry-hair function needs (§7). If yes, EVO, Gliss, Olaplex and Neqi lose `moisture_softness`. Check first that each still passes its other function axes.
4. **alverde 7in1.** Accept that the formula reads moisture, or make a named per-product adjudication? I recommend accepting it, or re-testing your "Nix" read against the INCI. Option B is available but carries collateral (alverde drops out of the catalog, and the rule is inconsistent across architectures).
5. **Cross-category consistency.** The conditioner standard says `balanced` "is not a label for an otherwise neutral conventional conditioner". T19 already diverged from that for leave-ins, and this overlay widens the gap. For example, Olaplex No.6 (an LGN cream) reads `balanced` here, while a similar rinse-out would read `moisture`. Is that acceptable, given the two categories do different jobs?
6. **Glycol and humectant lists.** The DH list adds Sodium Lactate, Urea, Sorbitol and simple sugars to the SR §L4 list, and it demotes the glycols SR lists under L4 for this one field. Is it OK to record that as an SR addendum (mechanism: SR §E.2 plasticiser role; CIR multifunctionality), or do you want a science-review pass first?

## 9. Conformance and risks

- **Evidence ceiling:** kept. Only rank comparisons between two species above the tail are used. No percentage, ratio or dose is stated or implied.
- **Blind formula-first; claims only through claim-gated properties:** kept. u1's „feuchtigkeitsspendend" and Neqi's „Feuchtigkeitsschutz" are counter-signals only.
- **No `unknown` (AD-2):** kept. `unknown` still means evidence failure only. No corpus record lands there.
- **Protein criteria:** untouched. R2 decides first, and `balanced` (a) is unchanged.
- **§1.1 conservative-failure invariant.** Moving a product from `moisture` to `balanced` makes it *less* favourable for moisture-target users but *more* favourable for protein-target users (fail → caution). That is the right outcome for a directionally neutral product, but it is a change toward a more favourable result on one side. So every flip that rests on a thin read (adjacent ranks, glycol-only demotion, conflicted formula) is capped at `low` and **routes to a human** (O6). A glycol-humectant-led hydrating mist with no glycerin would fail toward `balanced` + review, not silently.
- **Risk of mis-demoting glycols.** Some products really do rely on propanediol or butylene glycol as the humectant. Under A they become `balanced` + `glycol_only_leg` review, never silently. None of the 15 corpus records is such a product.
- **Adjacent-rank fragility.** The Gliss read hangs on r3 vs r4. Above 1 % the order is binding, but the concentration gap can be tiny. That's why it gets `low` and review.
- **Required follow-ups before anything ships.**
  - Write the overlay into a versioned file (v1.1).
  - Reopen `care_direction` on every in-category record (the rule changed, as with T19).
  - Re-derive the 4 flipped records with the full §4 evidence object and counter-signals.
  - Rerun the calibration projection.
  - Get separate authorisation for any catalog write (§19.3 stop condition).

## Sources

- Standard v1.0 §3.1.1, §5 (L1–L4), §6 (M1, M6, M7), §9, §17.22, §21.3 row 19; reference-key-v3/v4 slot records; unseen lane records and `rederived/u1-record.json`.
- Leave-on science review (`plans/leave-in-inci/research/leave-on-science-review.md`) §B.2, §C.2, §D.1–D.2, §E.1–E.2, §H.1, §N.2.
- App wiring: `src/lib/leave-in-research/production-adapter.ts` (AD-3a), `src/lib/personal-plan/products/authority/categories/axis-fit.ts`, `src/lib/personal-plan/categories/leave-in.ts`.
- [1] Moisture retention of glycerin solutions (mechanism context only, not a hair study): https://pmc.ncbi.nlm.nih.gov/articles/PMC9205919/
- [2] CIR, Safety Assessment of Alkane Diols (function listings: solvent, humectant, antimicrobial): https://www.cir-safety.org/sites/default/files/ADIOLS042017TR.pdf
- [3] CIR, Dipropylene Glycol: https://www.cir-safety.org/ingredient/dipropylene-glycol
- [4] Cosmetics & Toiletries, Humectants vs. Emollients vs. Occlusive Agents (practitioner framing): https://www.cosmeticsandtoiletries.com/research/literature-data/article/21834417/comparatively-speaking-humectants-vs-emollients-vs-occlusive-agents
