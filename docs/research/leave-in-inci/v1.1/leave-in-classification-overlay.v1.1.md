# Leave-In Research and Classification Standard v1.1 — overlay

Status: **logic locked — normative overlay on Standard v1.0**
Document version: `v1.1`
Engine version: `leave-in-inci-v1.1`
Base standard: `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` (Standard v1.0, sha256 `7ae5e882d9cba3e3fccdea3623d056efe802ff3bc3adbe554112e471da551ace`, 421855 bytes) — **byte-identical, not edited**
Ruling: **T20**, Nick, 2026-09-29 (review: `plans/leave-in-moisture-balanced/moisture-balanced-review.md`, Option A)
Scope: the `care_direction` field (§9) only
Normative source: this Markdown file together with the base standard
Date: 2026-09-29

## 0. How to read this overlay

Standard v1.1 is **Standard v1.0 plus this file**. v1.0 is frozen and its bytes are pinned; a policy change produces an overlay, never a silent rewrite (README, "Guidance synchronization"). Where this overlay speaks, it **replaces** the named v1.0 text. Everything it does not name stays exactly as v1.0 states it.

**Replaced in v1.0 §9, for `care_direction` only:**

1. the `moisture` anchor row and the `moisture` (humectant-led minimum) row — re-stated by §9-O1, §9-O5;
2. `balanced` reading (b)'s film-led rule, clauses 3 and 4 — replaced by §9-O3 and §9-O4;
3. the paragraph *"Where a moisture leg is present as architecture, `moisture` still governs — film lead or not"* — superseded by §9-O3 and by §2 below (the Neqi call);
4. the paragraph *"How much moisture leg is enough"* — replaced by §9-O1, §9-O2 and §9-O5.

**Not changed:** the protein anchor (R2 `candidate`/`tested`), `balanced` reading (a) (substantive mixed; its moisture leg is read through §9-O1, see §9-O7), the `unknown` definition (genuine evidence failure only, T19), §9 constraints 1–3, the G3/G4 gates, evidence level E2 and the `moderate` ceiling. §5's route dictionary (L1–L9) is **not** edited: COND, WT, PERS, `smoothing_route`, the focus hierarchy and every other consumer of L1/L3/L4 read those routes exactly as v1.0 defines them. T20 changes only which species may **set a care direction**.

## 1. T20 — directional species and the film-lead test (normative)

**Motivation.** Under v1.0 one species of L1, L3 or L4 above the tail marker was enough for `moisture`. Almost every leave-in carries one, so `moisture` had come to mean "this product conditions hair" rather than a direction. Three kinds of species were counted as moisture although their role on the list is not moisture: multifunctional glycols (solvent, extract carrier, preservative booster, film plasticiser), dry-feel spreading esters and volatiles (the film's carriers and slip agents), and cationics (the conditioning baseline COND already scores). T20 counts only species whose water-binding or softening role the INCI name settles, and makes a persistent film that leads them decide the direction.

**§9-O1 Directional species.** For `care_direction`, a moisture leg is created **only** by a **moisture-directional species** present above the tail (§3.1.1; on the ordinal read where the marker is vacuous or `none_visible`):

- **(DH) settled humectants** — Glycerin, Betaine, Panthenol, Sodium PCA, Sodium Lactate, Sodium Hyaluronate / Hyaluronic Acid, Urea, Sorbitol, and simple sugars (Glucose, Fructose, Sucrose). The list is representative for materials whose water-binding function is settled by the INCI name. A species whose function the name does not settle is **not** directional; it is recorded, and the ambiguity goes in `threshold_reasoning[]` (the §3.1.1 clause-6 doctrine: an unsettled role is not credited).
- **(DL) non-volatile lipids in the medium or rich spreading band** (SR §D.1; v1.0 §5 L3 table) — plant triglyceride oils, butters, Squalane, Jojoba, Caprylic/Capric Triglyceride.

**§9-O2 Non-directional species.** Recorded; they keep feeding COND, WT, PERS and `smoothing_route` unchanged, but **never set `care_direction`**:

- L1 cationics and LGN fatty alcohols — the conditioning baseline;
- volatile carriers and propellants (M6) — they contribute nothing;
- **dry-feel spreading esters** (SR §D.1 dry-feel band: Coco-Caprylate, Coco-Caprylate/Caprate, Dicaprylyl Carbonate, Dicaprylyl Ether, Isoamyl Laurate, Isopropyl Myristate, Isopropyl Palmitate, Neopentyl Glycol Diheptanoate and comparable);
- **multifunctional glycols** — Propanediol, Butylene Glycol, Pentylene Glycol, Propylene Glycol, Dipropylene Glycol, Hexylene Glycol, 1,2-Hexanediol, Caprylyl Glycol. A glycol **corroborates** a DH species and never creates the leg on its own.

**§9-O3 Film-lead test.** Where a **persistent film** — T19 clause 2's set: an L2 persistent silicone (Dimethicone, Dimethiconol, Amodimethicone, Phenyl Trimethicone and comparable), a silicone quat, Polysilicone-29, or a §5-equivalent substantive film route — is present above the tail **and its highest-ranked species outranks every DH/DL species above the tail**, the moisture leg is subordinate to the film ⇒ **`balanced`**, `row: film_leads_moisture_leg`. This is an ordinal comparison between two species on the same list, of the same kind as T19 clause 4; it states no percentage, ratio or dose (G4).

**§9-O4 No directional species.** No DH/DL species above the tail:

- a persistent film above the tail ⇒ **`balanced`**, `row: film_led_neutral`;
- no film, but a readable non-directional care architecture above the tail — an L1 cationic, an LGN fatty alcohol, a dry-feel ester or a multifunctional glycol ⇒ **`balanced`**, `row: conditioning_only_neutral`;
- none of these above the tail ⇒ **`unknown`**, unchanged: there is no readable care architecture at all, which is the evidence failure T19 reserves `unknown` for.

**§9-O5 Otherwise `moisture`** — a DH/DL species leads the film, or no film competes. Confidence ceiling `moderate`, with v1.0's confidence rules unchanged; the humectant-led minimum row (a lone DH leg on a thin architecture ⇒ `low`, recorded with the thin-architecture counter-signal) is unchanged.

**§9-O6 Confidence and review for an O3/O4 `balanced`.** Take `moderate` only when **all three** hold:

1. the tail marker is `plausible` (not `implausible`, `vacuous` or `none_visible`);
2. on an O3 row, the film-lead margin (rank of the first DH/DL species minus rank of the first film species) is **at least 2 ranks**;
3. the read does not rest on demoting a glycol: **no** multifunctional glycol above the tail outranks the highest-ranked film species (and, on a row with no film above the tail, no glycol sits above the tail at all).

Otherwise take **`low`** and route to review:

- **`glycol_only_leg`** — clause 3 failed;
- **`moisture_leg_subordinate`** — every O3 row whose final confidence is `low`, for any reason (O6 or a standing step-down such as §2.4.2 tier 1);
- an O4 row that is `low` only because the marker is unreliable routes under that marker's standing §14 trigger (`tail_marker_implausible`, `tail_marker_vacuous`, `tail_marker: none_visible`), which §3.1.1 already requires.

A standing step-down elsewhere in the standard (§2.4.2 tier 1, §3.1.1 limits) still applies on top of O6; O6 never raises a confidence another rule lowered.

**Mandatory counter-signal** on every O3/O4 `balanced`: the marker and its rank; the film species and their ranks; every directional species with its rank and class; **every demoted species** (a species v1.0 counted as a leg that §9-O2 does not) with its rank and class; the subordinate below-marker species; and any C1/C2 moisture claim, recorded as a counter-signal only (§9 constraint 3).

**§9-O7 One leg definition for the whole field.** `balanced` reading (a) — an R2 `candidate`/`tested` route **and** a material moisture leg, both above the tail — reads its moisture leg through §9-O1 as well. An R2 route beside only non-directional species is `protein`. No corpus record is affected (reading (a) is taken by no record; Redken's only ester, Isopropyl Myristate r8, is non-directional).

**Executable form.** `src/lib/leave-in-research/care-direction-t20.ts` (`deriveLeaveInCareDirectionT20`) implements §9-O3–O7 over a researcher's species classification; `tests/leave-in-care-direction-t20.test.ts` holds the red-proof cases and re-runs the rule on every T20 corpus record against the frozen INCI. The text above is normative; the function must follow it.

## 2. Supersession of T19's Neqi call

T19 (2026-09-12) made the film-led gate checkable and explicitly kept gold-set slot 13, **Neqi Diamond Glass Ultimate Styling Spray**, on `moisture` "by design", because its glycol "humectant leg" (Dipropylene Glycol r2, Pentylene Glycol r6) sat above its r9 marker. **Nick ruled on 2026-09-29 that those glycols are not genuine moisture legs.** That part of T19 is superseded:

- Under §9-O2 a glycol never creates the leg on its own. Neqi has no DH or DL species above its marker (Glycerin r15 and Propylene Glycol r14 sit below it), and its only persistent film above the tail is Polysilicone-29 r7, so §9-O4 gives `balanced`, `row: film_led_neutral`.
- Both glycols outrank the film, so §9-O6 clause 3 fails: confidence `low`, routed to review under `glycol_only_leg`.
- The rest of T19 stands unchanged: `balanced` reading (b) is directional neutrality, `unknown` is evidence failure only, and T19's own §1.1 argument carries over to T20.
- The v1.0 lock receipt's Neqi anchor pattern (`care_direction: moisture`, purpose T15) is historical. T15's in-category ruling for Neqi is untouched; only its direction moves. The v1.1 receipt carries the updated anchor.

The v1.0 standard's §9 and §17.22 text naming Neqi as `moisture` is not edited (byte immutability); this section is the authoritative statement.

## 3. Relationship to the conditioner standard (review open question 5)

The conditioner standard (`docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`, §10.2) uses `balanced` **only** for a substantive protein-plus-moisture mix. It says `balanced` "is not an uncertainty bucket or a label for an otherwise neutral conventional conditioner", and that "humectant or protein name presence alone is insufficient".

The two categories use **the same word with category-appropriate readings, under one shared doctrine**:

- **Shared doctrine: presence alone is insufficient.** The conditioner standard refuses to let a humectant or protein *name* set a direction. T20 applies the same principle to leave-ins. A glycol, a dry-feel ester or a cationic being present does not make a product moisture-directed; only a settled directional species that actually leads the architecture does. T20 brings the leave-in rule *closer* to the conditioner doctrine than v1.0 was.
- **Shared reading: substantive mixed.** Leave-in reading (a) and the conditioner's only `balanced` reading are the same concept, and §9-O7 reads the leave-in moisture leg with the same "name presence is insufficient" bar.
- **Leave-in-only reading: directional neutrality.** The leave-in category genuinely contains film-led styling, finishing and heat-primer products — silicone serums-in-water, primers, glossing sprays — whose care result is carried by a film, not by a moisture or protein route. The conventional rinse-out conditioner category does not contain that architecture class; its baseline is a cationic/fatty-alcohol conditioner whose moisture reading is the norm. So the conditioner standard needs no neutral reading, and the leave-in standard cannot do without one: T19 added it for exactly this architecture, and T20 applies it consistently.
- **Consequence, stated honestly.** A leave-in LGN cream led by a silicone (Olaplex No.6) reads `balanced` here, while a similar rinse-out would read `moisture` under the conditioner standard. That divergence is **principled, not accidental**: the leave-in field answers "does the formula direct moisture beyond its film and its conditioning baseline?", in a category where that question separates products. Both fields remain product-formula emphasis, never a diagnosis of a user (§9 definition; conditioner §10.2).
- **The values stay shared.** The production enum is `moisture | balanced | protein` in both categories, and both carry "formula-only calls remain E2". No enum member is added on either side (AD-1).

## 4. Consequences on the corpus

T20 reopens `care_direction` on every in-category record (§16: a standard-version bump reopens the fields whose rules changed). All 15 in-category records were re-derived from the frozen packets, not assumed unchanged. The records, with the species classification, reasoning, counter-signals and superseded readings, are in `data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json`.

| Record | v1.0 | v1.1 | Row | Confidence | Review |
|---|---|---|---|---|---|
| 1 alverde Sprühkur Express 7in1 | moisture | moisture | moisture_led | moderate | — |
| 2 ISANA Hyaluron & Panthenol | moisture | moisture | moisture_led | moderate | — |
| 3 Cantu Repair Creme | moisture | moisture | moisture_led | moderate | — |
| 4 alverde 2-Phasen-Sprühkur | moisture | moisture | moisture_led | moderate | — |
| 5 EVO Head Mistress | balanced | balanced | film_led_neutral | moderate | — |
| 6 Curlsmith Hydrate & Plump | moisture | moisture | moisture_led | moderate | — |
| **8 Gliss Express-Repair** | moisture | **balanced** | film_leads_moisture_leg (margin 1) | **low** | `moisture_leg_subordinate` |
| 9 Redken Extreme Anti-Snap | protein | protein | protein_anchor | low | — |
| **10 Olaplex No.6** | moisture | **balanced** | film_led_neutral | moderate | — |
| 11 Balea Leichtkämmspray | moisture | moisture | moisture_led | low | — |
| **13 Neqi Diamond Glass** | moisture | **balanced** | film_led_neutral | **low** | `glycol_only_leg` |
| **u1 Elvital Dream Length** | moisture | **balanced** | film_leads_moisture_leg (margin 4) | **low** (T18 step-down) | `moisture_leg_subordinate`, `formula_or_identity_conflict` |
| u4 Briogeo Avocado + Kiwi | moisture | moisture | moisture_led | moderate | — |
| u5 ISANA Argan | moisture | moisture | moisture_led | moderate | — |
| u6 amika The Shield | moisture | moisture | moisture_led | moderate | — |

**Anchors held:** EVO `balanced` (now via O4), Redken `protein`, ISANA Hyaluron & Panthenol `moisture`. **alverde 7in1 stays `moisture`** (Nick, 2026-09-29): sunflower oil r2 and glycerin r4 above its r9 marker, no film — a light oil-and-humectant softness spray. The formula reading stands; there is no per-product exception. The four excluded records (Maria Nila, Kevin Murphy, u2, u3) emit no `care_direction` (§2.3.1).

## 5. Conformance

- **Evidence ceiling (G4):** kept. Only rank comparisons between species on the same list; no percentage, ratio or dose.
- **Formula-first; claims only as counter-signals (constraint 3):** kept. u1's „wirkt intensiv feuchtigkeitsspendend“ and Neqi's „Feuchtigkeitsschutz“ are counter-signals only.
- **No `unknown` commits (AD-2):** kept. `unknown` still means evidence failure only; no corpus record lands there.
- **Protein criteria:** untouched. R2 decides first.
- **§1.1 conservative-failure invariant.** `moisture` → `balanced` is less favourable for moisture-target users and more favourable for protein-target users (fail → caution in plan authority). That is the right outcome for a directionally neutral product, but it is a move toward a more favourable result on one side. So every flip resting on a thin read — adjacent ranks, a glycol demotion, a conflicted formula — is capped at `low` and **routes to a human** (§9-O6). A glycol-humectant-led mist with no settled humectant fails toward `balanced` + `glycol_only_leg` review, never silently.
- **Calibration honesty.** T20 was applied by one re-derivation lane with every step machine-checked (classification vs frozen INCI ranks, rule vs record). It has **not** been run by two independent sealed lanes. This is the same "implemented, not yet calibrated" standing T19's film-led row had at its adoption; a two-lane check of §9-O1/O2 classification belongs in the next calibration round.

## 6. Science-review addendum (review open question 6)

T20's DH list adds Sodium Lactate, Urea, Sorbitol and simple sugars to SR's L4 examples, and it demotes the glycols SR lists under L4, **for `care_direction` only**. The basis stays inside SR/HO as the authority clause requires: SR §E.2 (humectants also act as film plasticisers, "a film-quality role, not a hair claim"); the multifunctional-glycol role recognised by the standard's own §3.1.1 clause 6(a) (1,2-Hexanediol and Caprylyl Glycol as boosters); SR §D.1 (dry-feel band = slip and spread); SR §C.2 / M6 (volatiles contribute nothing); SR §B.2 (cationics = conditioning baseline). CIR function listings for the alkane diols and dipropylene glycol (solvent, humectant, antimicrobial) corroborate the multifunctionality. Confidence that the classes are *real*: moderate. Confidence that Option A draws the product line in the right place: low–moderate — a product judgment with no external ground truth, ruled by Nick.

## 7. Refinements to the review's Option A text

The rule above is Option A as adopted, put into normative register. Three points the review left open had to be decided to make the rule deterministic. None moves a corpus value.

1. **§9-O4 readable architecture.** The review's O4 read "film and/or L1". Here it also counts an LGN fatty alcohol, a dry-feel ester or a multifunctional glycol. Without this, a glycol-only mist would fall to `unknown` on a fully readable formula. That contradicts both T19 (`unknown` is evidence failure only) and the review's own §9 conformance note that such a mist "would fail toward `balanced` + review".
2. **§9-O6 routing.** The review named two triggers. Here each one has an exact firing condition, and a marker-only step-down routes under the marker's existing §14 trigger instead of inventing a third name.
3. **§9-O7 reading (a).** The review listed reading (a) as unchanged. Here its moisture leg is read through §9-O1, so the field has one leg definition, not two. No record moves.

## 8. Rule-change ledger — v1.1 block

The v1.0 ledger (`v1.0/rule-changes.md`) is frozen. The v1.1 block lives here.

### `care_direction` counts only directional species; a leading film makes the leg subordinate (T20, 2026-09-29)

**21. §9's "any L1/L3/L4 leg above the tail" rule is replaced by the directional-species rule and the film-lead test (§9-O1–O7; T20).** What changed: only settled humectants (DH) and medium/rich-band non-volatile lipids (DL) above the tail can set `moisture`. Cationics, fatty alcohols, dry-feel esters, volatiles and multifunctional glycols are recorded but never set the direction. A persistent film that outranks every directional species makes the leg subordinate (`balanced`, `film_leads_moisture_leg`). A readable architecture with no directional species is `balanced` (`film_led_neutral` / `conditioning_only_neutral`). O6 caps thin reads at `low` with review. **Consequence:** four records move `moisture` → `balanced` — gold-set slots 8 (Gliss, low, review), 10 (Olaplex, moderate) and 13 (Neqi, low, review), and unseen u1 (Elvital, low, review). The other eleven in-category records were re-derived and hold. **T19 partially superseded:** its Neqi-stays-`moisture` call (§2 above). **Adapter:** AD-3a revised the same day — `moisture_softness` now requires `care_direction = moisture` (`plans/leave-in-inci/adapter-decisions.md`). That is an adapter decision, not a standard change. *Motivated by:* Nick's 2026-09-29 finding that performance products from his expert sheet's "Nix" column landed on `moisture` because they contain humectants or emollients incidental to a film-led product, and were then recommended as dryness treatments. Both calibration lanes had flagged Gliss and Neqi (`care_direction_underfires_on_film_led_architecture`). *Traces to:* Nick's binding ruling T20, 2026-09-29 (Option A; Neqi reversal accepted; alverde 7in1 stays `moisture`; four flips approved); `plans/leave-in-moisture-balanced/moisture-balanced-review.md`; SR §B.2, §C.2, §D.1, §E.1–E.2.

**README index row:** `T20 | care_direction counts directional species only | Only settled humectants and medium/rich lipids above the tail set moisture; a leading persistent film makes the leg subordinate (balanced); glycols, dry-feel esters, volatiles and cationics never set a direction. Supersedes T19's Neqi call.`

## 9. Source anchors

- Base standard v1.0 §3.1.1, §5 (L1–L4), §6 (M1, M6), §9, §14, §16, §17.22, §21.3 row 19 (T19).
- Review and rerun: `plans/leave-in-moisture-balanced/moisture-balanced-review.md`, `plans/leave-in-moisture-balanced/rerun.mjs`.
- Science review: `plans/leave-in-inci/research/leave-on-science-review.md` §B.2, §C.2, §D.1–D.2, §E.1–E.2, §H.1, §N.2.
- Conditioner standard v1.6 §10.2.
- CIR, Safety Assessment of Alkane Diols; CIR, Dipropylene Glycol (function listings, corroboration only).
