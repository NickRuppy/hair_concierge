# Reference key v3 — summary

Engine `leave-in-inci-v0.3` · Key `reference-key-2026-09-04-r3` · Lane: category-developer reference key
Packet: `plans/leave-in-inci/research/gold-set/calibration-packet.json` (13 entries, frozen INCI + directions + `claims[]`)
Date: 2026-09-04 · **No web research was performed. No claim was added, upgraded or re-tiered by this lane** (§2.4 rule 3).

This is round 3 of the two-lane calibration, run under the **v0.3** standard. It measures the repeatability of the
rules, not the truth of any value. **Research artifacts only** — no catalog value, recommendation, Supabase row,
user-facing copy or production matcher changes on this record's authority (§19).

---

## Headline table

| # | Product | G0 | Form | COND | WT | PERS | HOLD | Heat binary | Primary focus | Fine fit |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | alverde Leave-In Sprühkur Express 7in1 | in_category | two_phase | moderate | moderate | moderate | none | false | general | conditional |
| 2 | ISANA PROFESSIONAL Leave-In Conditioner | in_category | emulsion | **high** | **high** | **high** | none | false | general | **caution** |
| 3 | Cantu Leave-In Haarkur Repair Creme | in_category | emulsion | **high** | **high** | moderate | none | false | general | **caution** |
| 4 | alverde Nutri-Care 2-Phasen-Sprühkur | in_category | two_phase | moderate | moderate | moderate | none | false | general | conditional |
| 5 | EVO Head Mistress Cuticle Sealer | in_category | emulsion | moderate | moderate | moderate | none | false | general | conditional |
| 6 | Curlsmith Hydrate & Plump Leave-In | in_category | emulsion | **high** | **high** | **high** | incidental | false | general | **caution** |
| 7 | Maria Nila Curlicue Cream | **excluded_styling_first** | *(solution)* | *(moderate)* | *(moderate)* | *(neutral)* | ***meaningful*** | — | **no profile** | — |
| 8 | Schwarzkopf GLISS Sprüh-Conditioner | in_category | emulsion | moderate | moderate | **high** | none | **true** | **repair** | conditional |
| 9 | Redken Extreme Anti-Snap | in_category | emulsion | moderate | moderate | moderate | none | **true** | general | conditional |
| 10 | Olaplex N°.6 Bond Smoother | in_category | emulsion | **high** | **high** | moderate | none | false | general | **caution** |
| 11 | Balea Leichtkämmspray Pure Styling | in_category | aqueous_solution | **low** | **low** | moderate | none | false | **detangling** (+ volume_lightness) | **recommended** |
| 12 | Kevin Murphy Young.Again Oil | **excluded_anhydrous** | *(anhydrous)* | *(high)* | *(high)* | *(ph_dep.)* | *(none)* | — | **no profile** | — |
| 13 | Neqi Diamond Glass Ultimate Styling Spray | **provisional_boundary** | microemulsion | moderate | moderate | moderate | **meaningful** | **true** | **heat_styling** | conditional |

*Italic values on slots 7 and 12 are `informational_and_non_authoritative` §7 dimensions on excluded records; those two
records emit **no lean profile** at all (§2.3.1), which is the machine-readable signal of exclusion.*

**Distribution.** G0: 10 `in_category`, 1 `provisional_boundary`, 2 excluded (one anhydrous, one styling-first) —
both exclusions land on designed boundary slots and neither is a surprise.
`provides_heat_protection: true` on 3 of 11 profiled records (slots 8, 9, 13), **all three from clean C1/C2 claims,
and all three with no L9 member — so all three route to review**. `humidity_resistance` is `not_claimed` on 10 of 11
and `claim_only` on 1 (slot 13). `focus.primary` is `general` on 8 of 11 profiled records.

**Secondary axes.** `care_direction`: `moisture` ×10, `unknown` ×1 (slot 5). `usage_role` is **empty on 5 of 11**
profiled records (slots 3, 5, 6, 9, 10) purely because directions sit below C1/C2 authority.
`scalp_application_fit`: `avoid` ×4, `conditional` ×1, `unknown` ×6 — the v0.3 narrowing works, and under v0.2 nearly
every fragranced record here would have been `avoid`.

---

## Review-routed list

**Every one of the 13 records routes to human review.** No record cleared without a trigger.

| # | Product | Triggers |
|---|---|---|
| 1 | alverde 7in1 | `claim_tier_basis: house_brand` · two-phase product · tail-marker dependence · `scalp_application_fit = avoid` |
| 2 | ISANA | `claim_tier_basis: house_brand` · identity conflict preserved (retailer-internal name inconsistency) · tail-marker dependence |
| 3 | Cantu | formula-source conflict (DE vs US variant; the C2 page shows the US list) · **`claim_authority_gap`** (C3-only heat claim, C2 checked and silent) · below-marker persistence route (PQ-10 r30 vs marker r28) · directions below C1/C2 authority · very late tail marker (28/51) · `scalp_application_fit = avoid` |
| 4 | alverde 2-Phasen | two-phase product · absent exact-market identifier (SKU appears delisted) · **`claim_authority_gap`** (C1/C2 search not completable against a current source) · `claim_tier_basis: house_brand` · tail marker rests on the allergen block only · `scalp_application_fit = avoid` |
| 5 | EVO | **`claim_authority_gap`** · **`candidate_below_tail`** (Quaternium-80, r14 vs marker r6) · below-marker persistence route · early tail marker (6/25) · directions below C1/C2 authority · Polyacrylamide L5 open gap |
| 6 | Curlsmith | absent exact-market identifier (no GTIN) · **`claim_authority_gap`** · very late tail marker (36/40) · directions below C1/C2 authority · `focus.primary` decided by a reading, not evidence · `scalp_application_fit = avoid` |
| 7 | Maria Nila | **G0 product-form decision** · **`HOLD = meaningful_hold_route`** · **`claim_authority_gap`** · `quat_structure: unresolved` (Quaternium-95) · absent identifier · directions below authority |
| 8 | Schwarzkopf GLISS | **heat claim with no L9 member** · `focus.primary` set by a marketing position (recorded rule contradiction) · `care_direction` under-fires on a film-led architecture · tail-marker dependence |
| 9 | Redken | **`candidate_below_tail`** (silanetriol r14 vs marker r3) · **very early tail marker (3/24)** · **heat claim with no L9 member** · `quat_structure: unresolved` (Quaternium-33) · **`claim_authority_gap`** (C3-only anti-frizz) · identity conflict (GTIN) · directions below authority |
| 10 | Olaplex | **bond `R3 = chemistry_candidate`** · **`claim_authority_gap`** (the R12 paradigm case) · **`candidate_below_tail`** (silanetriol r24 vs marker r14) · identity conflict (GTIN, ingredient count, T3-only tail) · directions below authority · `focus.primary` decided by a reading |
| 11 | Balea | **fragrance-free / hypoallergenic implication** · `claim_tier_basis: house_brand` · carried-open COND `low` / SLIP `moderate` contradiction |
| 12 | Kevin Murphy | **G0 product-form decision** · four preserved formula/identity conflicts · absent exact-market formula · **`claim_authority_gap`** · `quat_structure: unresolved` (Quaternium-91) · very late tail marker · **regulatory re-review 2027-06-06** (cyclosiloxane-led) |
| 13 | Neqi | **`provisional_boundary` under §2.3.2 clause 2** · **`HOLD = meaningful_hold_route`** · **heat claim with no L9 member** · **`candidate_below_tail`** (Silicone Quaternium-18 r11 vs marker r9) · below-marker persistence route · `care_direction` under-fires · identity trap |

**Trigger counts.** `claim_authority_gap` ×6 · tail-marker-driven (early, late or vacuous) ×7 ·
`candidate_below_tail` ×4 · directions-below-authority ×6 · heat-claim-without-L9-member ×3 ·
`quat_structure: unresolved` ×3 · house-brand tier ×4 · identity/formula conflict ×5 ·
`meaningful_hold_route` ×2 · `scalp_application_fit = avoid` ×4.

---

## What v0.3 demonstrably fixed on this set

| v0.3 change | Where it bit, and what it changed |
|---|---|
| **§2.4.1 rule 6 house-brand clause** | Restored directions **and** claims on slots 1, 2, 4 and 11. Under a literal v0.2 reading all four German mass-market products would have lost their `usage_role` and their claim-keyed fields to a C3 stamp. Slot 11's `focus.primary: detangling` exists only because of it |
| **§2.4.1 rule 3 governing, C2 row reworded** | Decided claim authority on slots 5, 7, 10 and 12 — the packet's four "C2-equivalent (judgment)" stamps were **not** adopted, and slot 9's `.eu/de-de` page **was** taken as C2. This is the single largest driver of the `claim_authority_gap` count |
| **§2.3.2 boundary precedence** | Slot 7 → `excluded_styling_first` under clause 3 (weak-tier positioning fails to *create* the positioning half but does not manufacture an ambiguity). Slot 13 → `provisional_boundary` under clause 2 (C2 blow-dry-primer directions materially contradicting a styling-first architecture). Two boundary records, two different states, each on a named clause |
| **§7.4 two-observation SFR anchor** | Lowered SFR to `moderate` on slots 5, 9 and 13 where a film and its "lubricant" were one architecture read twice, or where the second route sat below the marker. Slot 5's clause-2 case (Dimethicone/Dimethiconol) is the textbook example |
| **§10.2 rank order binding before observation counting** | Slot 8's `repair` beat `smoothing`; slot 11's `detangling` beat `volume_lightness`; slot 13's `heat_styling` was the sole qualifier. Observation counting moved no `primary` anywhere |
| **§7.9 HUM reversed to claim-led** | Slots 5, 8, 10 and 12 all carry a genuine hydrophobic film route and **no** C1/C2 claim. Under v0.2 each would have projected `formula_plausible` into a matching field that no §18 string was permitted to explain. All four now read `not_claimed` with the route recorded in the trace |
| **§7.10 `candidate_below_tail`** | Fired on slots 5, 9, 10 and 13 — four of thirteen. Without it each would have shown `none_visible` as though nothing had been observed |
| **§10.1.2 weight conflict tag** | Applied **zero** times, and **declined with a named failing condition on all 13 records**. Four had a candidate statement at the wrong tier or the wrong subject; slot 13 satisfied conditions 2–4 and failed only condition 1. Determinism achieved — but see the residual note below |
| **§10.3.1 narrowed `avoid`** | `avoid` fell to 4 of 11 profiled records, all on the **architecture** trigger or an architecture-plus-alcohol pair. Under v0.2's fragrance-alone trigger, 9 or 10 would have fired |
| **§7.13 `pre_heat` stage** | Slot 13 reaches `heat_styling` and its focus. Slots 8 and 9 still cannot — for reasons that are *not* the tool-name test (see residual ambiguity 4) |
| **§5 L5 enumeration** | Decisive on slot 13 twice: VP/Methacrylamide/Vinyl Imidazole Copolymer **is** fixative-class (so HOLD `meaningful_hold_route`, and the G0 boundary case exists at all) and **is not** L9 (so the heat claim is formula-unsupported); Polysilicone-29 **cannot** set HOLD alone |
| **§7.1 microemulsion asymmetry** | Slot 13's `microemulsion` rests on it directly: solubilisers below the marker, silicone above |
| **§8.3 R3 `none`** | 12 of 13 records are `none` rather than `unknown`, which reads as *absent* rather than *unresearched*. Slot 10 is the only `chemistry_candidate` — and it is the record that needed v0.3's new German string |
| **§4 confidence vocabulary** | Every confidence value in this key is one of the four permitted members. Nothing is diff-blocked on scale mismatch |

---

## Remaining ambiguities in v0.3

Specific, and each one changed or could change a projected field on this set. Ordered by consequence.

### 1. The tail marker's variance is now the dominant source of value movement (§17.18, §17.14)

Markers landed at rank **3 of 24** (slot 9), **6 of 25** (slot 5), **28 of 51** (slot 3), **36 of 40** (slot 6) and
**14 of 16** on a formula with **no preservative at all** (slot 4). v0.3 made rank the single deterministic prong
without claiming to fix the variance, and §17.18 says so. On this set the consequence is concentrated:

- **Slot 9, the gold set's designated protein/surface-repair archetype, projects `repair_surface_film: none_visible`,
  `care_direction: moisture`, `focus.primary: general` and `damage_fit.highly_damaged: conditional` — every one of them
  because the marker landed at rank 3.** The product carries a genuine §7.10-qualifying silane route. Round 2 reported
  the mirror-image failure on this same slot (a `smoothing` focus over a real repair route); v0.3 moved the failure
  rather than removing it.
- **§3.1.1 clause 1 and §3.1.1 limit 3 give opposite instructions on a very early marker**, and the standard never says
  which governs. Clause 1: rank alone decides "present as architecture". Limit 3: *do not collapse to `low`; hold the
  value at the level the architecture supports*. This lane resolved by a stated convention — the rank prong governs
  wherever an anchor carries its own explicit above-tail requirement, limit 3 governs elsewhere — and marked every
  affected field uncertain. **A second lane could reasonably resolve it the other way and move six to eight fields on
  slot 9 alone.** This is the single most repeatability-threatening hole left in v0.3.
- The **vacuous-marker** case (slot 6, rank 36 of 40) is uncovered in the opposite direction: everything qualifies as
  "above the tail", so the test separates nothing and every anchor passes trivially.

### 2. §10.2's `repair` row contradicts §10.2 principle 4 — and it set a `focus.primary` here

The `repair` row and §10.2 step 3 both name *"protein/silane actives in the product's C1/C2 marketing position"* as an
**independent** qualifying prong. §10.2 principle 4 says *"Official positioning may corroborate but never creates a
route"*, and §9 constraint 3 says the same for `care_direction`. The row's exclusion list (generic silicone, oil,
panthenol, ceramide, non-silicone cationic polymer, generic repair naming) only makes sense if the prong can fire
without a formula route — otherwise it is redundant with the R2 prong.

**Consequence on slot 8:** `focus.primary: repair` on a product whose only protein is a plain hydrolysate that §7.10
rules `none_visible`, and whose `care_direction` reads `moisture` on the same formula. This lane applied the specific
row over the general principle and routed the record. **A lane applying principle 4 instead would project `general`.**
The standard should say which governs, and whether the named active must itself be a §7.10-qualifying species.

*(The exclusion list did do real work: slot 3's C2 „Sheabutter und natürlichen Ölen" was refused because oils are
excluded, and slot 9's „stärkt und glättet die Schuppenschicht" was refused as generic repair naming. So the prong is
not unbounded — only its relationship to principle 4 is undefined.)*

### 3. §10.2.1 does not say which COND-establishing set to name when the anchor is over-satisfied

COND `high` needs "an LGN pair plus **at least one** further independent lubrication route". On slots 2, 6 and 10 two
or three candidate further routes are present, so **more than one admissible minimal establishing set exists** — and
whether the SFR film route is "beyond baseline conditioning" depends on which set the reviewer names. Slot 8 has the
same shape at COND `moderate`.

This lane adopted the conservative convention *"beyond baseline under **every** admissible set"*, which sent slots 2,
6, 8 and 10 to `general` rather than `smoothing`. **Under the permissive convention, slots 6 and 10 would project
`focus.primary: smoothing`** — and slot 10's product is literally named "Bond **Smoother**". §10.2.1 defines the phrase
but not the selection, and it is decisive on four of eleven profiled records.

### 4. A C1/C2 heat claim and the `heat_styling` focus still disagree on two of three heat products

v0.3's `pre_heat` widening (§7.13) was written to close exactly this gap, and it worked on slot 13. It does not reach
the other two, for two *different* reasons:

- **Slot 8:** the C2 directions establish `post_wash` but name no tool and position nothing before heat styling. The
  heat claim is on the same C2 page. `provides_heat_protection: true`, `focus.primary: repair`, `usage_role` has no
  `heat_styling`.
- **Slot 9:** the C2 page supplies the heat claim, but the packet captured **directions** only from C3, so ROLE is
  empty entirely. This is an **authority** failure, not a tool-name failure — and it is adjacent to but distinct from
  §17.23. The shape "a C2 source exists and carries the claim, but the directions were captured from C3" has no rule.

### 5. `usage_role` is empty on five of eleven profiled records, entirely on authority grounds (§17.23)

Slots 3, 5, 6, 9 and 10 all have **captured, verified, rinse-tested directions** that are plainly pack- or
manufacturer-derived, and all five return `usage_role: []` because the source is C3 or C5. §2.4 rule 3 routes *absent*
directions to review; there is still no route for *present but below-authority* directions, and §17.23 names this as
the largest single source of empty `usage_role` values. Round 3 confirms it at the same rate.

Note the asymmetry this creates: the **rinse test** ran on all five of those direction texts and passed (correctly —
the exclusion test is not authority-gated), while the **role assignment** from the same sentences was withheld.

### 6. §18 has three unresolved string questions

- **`EXPO = aromatic_or_allergen_exposure` has no §18 string**, while `fragrance_declared` does. Eight records carry
  the former. This lane emitted nothing rather than substituting a neighbouring string; a lane that substituted would
  differ on eight records' `cautions[]`.
- **§18's "HUM humectant counter-signal" row contradicts §18's own register rule and G14**, both of which state that no
  string may express a counter-signal and that counter-signals never leave the trace. Slot 13 is the only record where
  it could fire; this lane **withheld** it on G14. The row should be deleted or G14 should be qualified.
- **Two heat rows match a `claim_only` state with no L9 member** — the generic „Als Hitzeschutz ausgelobt…" row and the
  „…finden wir dafür keinen belegten Wirkstoff" review row. §18 does not say whether one or both fire. This lane
  emitted only the more specific one, on slots 8, 9 and 13.

### 7. §9 has no value for a film-led architecture, and its silicone-led `unknown` rule under-fires (§17.22)

Confirmed on three records. The rule requires "no R2 route **and** no material humectant or emollient leg", so any
emollient or humectant above the marker blocks it:

- **Slot 8** — a silicone-led primer with one apricot-oil observation ⇒ `moisture`.
- **Slot 13** — a film-led spray (silicone film former + fixative polymer, no lipid and no cationic architecture above
  the marker) ⇒ `moisture`, **while its own C2 page claims „Feuchtigkeits*schutz*"** — protection *from* moisture.
  This is the exact shape ref A10 described.
- **Slot 12** (informational) — the same.

Only **slot 5** met the gate cleanly and returned `unknown`. §17.22 records this as a Nick fork rather than a repair;
round 3 confirms the fork is live and that the under-firing is the common case, not the exception.

### 8. Smaller, each observed once or twice

- **§7.5's "family" is never defined** as band, species or route. Slots 1, 4 and 13 each had two readings; **all three
  landed on the same value**, so no field moved — but the robustness is luck, not rule.
- **§10.1.2 achieved determinism at the cost of never firing.** The tag was declined 13 times. Slot 13 satisfied
  conditions 2, 3 and 4 and failed only condition 1 (WT was `moderate`, not `high`). Worth asking whether a rule that
  cannot fire on any product in the gold set is calibrated, or merely safe.
- **Alcohols outside the `Alcohol Denat.`/`Alcohol` enumeration** (§17.21): Isopropyl Alcohol on slots 6 and 10, Benzyl
  Alcohol on slots 3 and 9. Four records where an alcohol note was **not** emitted and the `scalp_application_fit`
  irritant-load pair therefore could not form. Confirmed at twice round 2's rate.
- **Polyacrylamide's L5 placement** (§17.19) decided HOLD on slots 5 and 9. Both were read as `none` (emulsifier /
  rheology function). Round 2 produced no disagreement on it; round 3 records that it is now load-bearing on two slots.
- **`curl_definition_focus` still has no value vocabulary** (§17.20) — not derived on any record.
- **SLIP bias returned `unknown` on 5 of 11 profiled records** (§17.16, §17.5), the same shape as round 2 at similar
  rate: a non-film persistent lipid load or a monomeric-quat architecture matches neither `wet_biased` nor `dry_biased`.
- **Which §7 dimensions an excluded record may carry** (§17.24) is still undefined. This lane emitted the **full** §7
  set on slots 7 and 12, marked `informational_and_non_authoritative`, as a stated convention. A lane emitting a
  smaller subset would produce a non-comparable diff on two records.
- **The COND `low` / SLIP `moderate` contradiction** on a lone monomeric quat (slot 11) and the §7.2 "short-chain" /
  §7.6 "long-chain" vocabulary split both still bite, exactly as §21.2 predicted.

### Not ambiguous — worth recording as clean

`provides_heat_protection` was decidable from the frozen `claims[]` on all 13 records with no judgment: three `true`
(C1/C2 claim present), ten `false`. The v0.3 claim freeze is the reason — round 2's report called its absence the most
consequential gap of that round, and on this run **no lane-side claim research was needed or performed**. The C-tier
question that remained was *authority interpretation* (rules 3 and 6), not *capture*.
