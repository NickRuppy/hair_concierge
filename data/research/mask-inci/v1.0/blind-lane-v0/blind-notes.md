# Blind lane v0 — reviewer notes

Reviewer: independent blind lane, no access to any proposed key.
Standard applied: `mask-classification-standard.v0.1.md` (draft v0.1, pre-calibration), with
`00_category_charter.md` (F1–F4, exclusions) and `02_evidence_lexicon.v0.1.md`.
Products: 13 frozen packets. 11 profiled, 2 excluded at G0.
All values are E2-ceiling formula-only architecture inferences. No efficacy is asserted anywhere.

---

## 1. Where the written rules were ambiguous or forced an uncomfortable call

Ordered roughly by how much they moved values.

### A. §9.2 — the `weight_potential: high` base is cationic-gated, so a heavy above-tail lipid load cannot reach `high` on its own

**Packet 06 (MONDAY Smooth Anti-Frizz) is the clean case.** Its tail marker is Phenoxyethanol at
rank 11 and its only cationic surfactant, Behentrimonium Chloride, is at rank 12 — one rank below.
Above the tail it carries shea butter (7), coconut oil (8), jojoba (9), sweet almond oil (10) and a
dimethicone/dimethiconol pair (4, 5). That means **both** §9.2 supporting alternatives are satisfied
— (a) an R4b heavy lipid above the tail and (b) the named occlusive silicone pair — while the
required base fails on its cationic leg, so the anchor cannot reach `high` and the formula lands on
the `moderate` residual. Derived `hair_thickness_fit` then includes `fine`.

This sits badly against the standard's own evidence rationale (§9.2 counter-signals, lexicon family
3): *fatty-alcohol and butter load is the weight driver, not silicone or cationics*. The anchor
indexes weight through cationic breadth, which is the one axis the lexicon says is **not** the
driver. §15 already lists this as calibration priority 1 and §18 open question 1 asks whether the
base-plus-one-alternative reading is right; packet 06 is that question in concrete form, and my
answer from the blind side is that the *conjunction structure* is the problem, not the
conjunction-vs-alternatives split that was ruled.

### B. §9.2 — the `low` anchor's fatty-alcohol conjunct may be unreachable in this category

`low` requires *no cetearyl-class fatty alcohol in the top three*. The lexicon (family 2) states
that `Cetearyl Alcohol` at rank 2 is **near-universal** in German drugstore masks and that
"presence therefore carries no signal at all". Packets 08, 09 and 11 are all structurally light
(one cationic, no heavy lipid, and in 09 and 11 essentially no lipid above the tail at all) and all
three are blocked out of `low` by a rank-2 cetearyl alcohol alone. Packet 09 is directed for use as
a leave-in and even overnight, and still cannot be `low`.

Only packet 02 reached `low`, and only because it is an unusual solvent-led formula with no
cetearyl-class alcohol at all. If that pattern holds on the full shelf, `low` — and with it
`lightness` (§9.5.2 step 3) and the `fine`/`normal` thickness row (§9.6) and the `straight`/`wavy`
texture row (§9.8) — is effectively reserved for one atypical formula archetype.

### C. §9.1 — S2's rule text and its own parenthetical gloss disagree on non-aqueous-led formulas

S2 is "a long-chain fatty alcohol at rank **2 or 3** of the full list (i.e. immediately after the
aqueous phase)". In packet 02 the list runs Propylene Glycol, Alcohol denat., **Myristyl Alcohol**,
Dicaprylyl Carbonate, **Aqua** — so the literal rank test passes while the gloss ("immediately
after the aqueous phase") fails, because Aqua is at rank 5. Literal reading gives S2+S3 = 2 signals
= `conditioning_level: high` on a 7-second express Kur with **zero** cationic above the tail;
intent reading gives S3 only = `moderate`.

I resolved to `moderate` via the binding D1 fallback for unresolvable cases (§9.1: "Unresolvable
cases → `moderate` + the field listed in `uncertain_fields`"; "Never encode unresolved uncertainty
as an extreme"). The standard should say explicitly which of the two readings governs.

### D. §9.3 — the `balanced` operational test is far weaker than the `balanced` semantics

§9.3 says `balanced` is "**Reserved** — never a 'neither' middle bucket", requires "a **substantive
mixed** protein-plus-moisture architecture", and warns that it bridge-matches downstream "so
inflating it has real downstream cost". But its operational test is: material R5 route **and**
(humectant cluster **or** "a substantial R4 lipid/emollient stack (**S3 satisfied**)"). S3 (§9.1)
is only "≥ 2 **distinct** non-fatty-alcohol lipids above the tail" — a breadth count, not a
substance test.

**Packet 04 (Gliss Liquid Silk 4-in-1)** clears the S3 branch on one light ester (Isopropyl
Myristate, 6) plus one trace ceramide-family token (Glycosphingolipids, 10). I applied the written
test and returned `balanced`, flagged at moderate confidence with `protein` as the adjacent value.
Packets 05 and 08 reach `balanced` on genuinely substantive second legs (six lipids incl. a butter;
a five-member humectant cluster), so the same value is being earned three very different ways.
Either S3 needs a substance qualifier for this use, or §9.3 should name a different test.

### E. §9.5.2 — the hierarchy has no comparative test between a qualifying `repair` route and a qualifying `moisture` cluster

**Packet 08 (Sante Intense Hydration)** clears the repair route (three distinct hydrolysates at
above-tail ranks 7–9) *and* the full D5 moisture guard (five distinct humectants above the tail,
four non-glycerin, glycerin within the first five ranks). §9.5.2 tests repair at step 3 and moisture
at step 4, so ordering alone decides the primary. My `focus_care_verdict` is `dual_supported`, which
is exactly the state §9.5.1 says exact-product claims **may** break — and I had no claims source,
so I fell back on hierarchy order. A claims-informed reviewer could legitimately invert my
primary/secondary. The value **pair** is robust; the ordering is not.

### F. §9.5.3 criterion 1 — the `moisture` guard flips on a single boundary-band rank

Packets 03 and 10 are the same brand with near-identical bases.

| | tail marker | Panthenol | humectant cluster above tail | primary_focus |
|---|---|---|---|---|
| 03 SOS Protein | Parfum @10 | @11 (tail) | Glycerin, Betaine = 2 | `general` |
| 10 Deep Repair | Sodium Benzoate @12 | @11 (above tail) | Glycerin, Betaine, Panthenol = 3 | `moisture` |

One rank separates two different research headlines. The lexicon (§0.2) explicitly warns "do not
let a single rank either side of it flip an extreme value on its own", but that warning is written
for extremes and `moisture` is not formally an extreme. I applied the guard as written and returned
`moisture` for 10 at **moderate** confidence (not the `high` the §9.5.3 confidence rule would
technically allow), because §4.1's definition of `high` — "reasonable unknowns would not move the
value" — is plainly not satisfied by a value that turns on one rank.

### G. §9.5.2 step 3 — `lightness` cleared, on the one product the standard expects it never to

Packet 02 reached `weight_potential: low` and a likely-preserving body architecture, so
`lightness` clears at step 3 and terminates the hierarchy before `general` is reachable. The
standard says `lightness` is "expected to go unused in this category" and that never selecting it
"is a finding to report, not a threshold to loosen" — but says nothing about a case that *does*
clear. Two further wrinkles: (i) §7.1 directs abstention on `body_lightness_potential` when there is
"no corroboration", and I had none, so the second conjunct rests on architecture alone;
(ii) §9.5.1's hard rule ("nonspecific resolves to `general` or `smoothing`") does not say what a
`nonspecific` care verdict does to a step-3 `lightness` selection. I selected `lightness`, carried
`focus_care_verdict: nonspecific`, set confidence `low`, and listed the field.

### H. §2.2 — no step covers "two separable qualifying rinse-out modes"

**Packet 12 (Guhl 2in1 Kur & Spülung).** §2.1's exclusion list names this product on the ground
that "its only rinse-out mode is a short **conditioner** mode". The packet's directions state two
rinse-out modes, both after cleansing, both with a stated dwell: a ~30-second Spülung and a 2–3
minute **Kur**. Under charter F2 dwell duration is *never* a boundary test (7-second Kuren are
eligible), so a short dwell cannot be what disqualifies the Spülung mode, and the Kur mode qualifies
on every written leg of §2.2 step 2. §2.2 steps 3/4/5 cover "exactly one", "none", and
"ambiguous/inseparable" — not "two separable qualifying modes".

I applied the ruled exclusion (`excluded_product_form`, boundary evidence, no profile) because the
charter names the product and the formula and marketed form both read as a conditioner. But the
**stated reason** for the exclusion is not supported by these directions, and §2.2 cannot reproduce
the ruling from directions alone — which is uncomfortable in a section whose whole premise is
"eligibility is read from directions, never from the jar". I did **not** fire
`multi_use_directions_ambiguity`, because its condition is ambiguity/inseparability and these modes
are perfectly separable; a reviewer may want that trigger widened.

### I. §3.1 — the tail-class enumeration has gaps that systematically lengthen above-tail segments

Three concrete misses found in 13 packets:

- `Leuconostoc/Radish Root Ferment Filtrate` (packet 08 @15) — a Naturkosmetik preservative system,
  not in §3.1's conventional-preservative list. Marker fell through to Potassium Sorbate @18.
- `Tetrasodium Glutamate Diacetate` (packet 12 @7) — a chelator the lexicon lists in family 10 but
  §3.1's trace-chelator list does not name.
- `Ethylhexylglycerin` (packets 01 @26, 06 @27, 12 @9) — a preservative booster, not listed.

Naturkosmetik and "clean"-preservative formulas will therefore show systematically longer above-tail
segments than conventional ones, which biases every structural signal in their favour. §18 open
question 8 asks about tail-marker *absence*; this is the adjacent problem of tail-marker *lateness*.

### J. §9.8 — no row for "weight `high` but the slip route is not coherent"

The `high` row is "weight_potential high **with** a coherent high-slip R1/R3 route". The table
states no fallback if the conjunct fails. Packets 01, 03, 05 and 10 are all weight-`high` with an
ordinary two-cationic base, which §9.5.2 step 1 calls the *category baseline*. I read the R1/R3
disjunction permissively (R1 alone suffices) and assigned `wavy, curly, coily` — but a reviewer who
holds that a baseline slip route is not "coherent high-slip" has nowhere written to land.

### K. §9.7 — the specialist `damage_fit` branch is gated by lipid/cationic architecture, not by the repair route

Packet 08 has the strongest protein architecture in the set (three distinct hydrolysates above the
tail, `repair_support_level: medium`) and does **not** reach the specialist pair, because its
`conditioning_level` is `moderate` (it is lipid-poor). Packet 05, a nourishing almond-milk 3in1 with
a weaker two-species protein route, **does** reach it, because its six-lipid stack pushes
`conditioning_level` to `high`. The specialist branch therefore turns on field 1 rather than on the
repair route it is supposed to identify. §9.7's own mask delta warns that a large
`moderately_damaged + highly_damaged` bucket is evidence the test is leaking; my set produced two
(packets 04 and 05), one of them on a nourishing 3in1.

### L. §9.1 — the "no material counter-signal" clause is inoperable as written

The `high` threshold requires "≥ 2 of {S1,S2,S3} **and no material counter-signal**". The
counter-signals §9.1 then lists (rheology-only ingredients, long lists, sub-1% hero tails) are
immediately declared to "not move the value in any direction". So the blocking clause has no
populated set to draw from. Packet 01 is where this bit: a four-entry above-tail base whose entire
declared payload sits below the marker still returns `conditioning_level: high` on S1+S2, and the
obvious counter-signal (the hero tail) is precisely one of the items that cannot block it.

### M. Vocabulary gap — there is no focus value for emollient richness

Packets 01, 03 and 05 are all characterised, above the tail, by lipid/occlusive richness. The nine
values offer no home for that, so richness either falls through to `general` (01, 03) or is
displaced by whatever else clears first (05 → `repair`). §18 open question 4 asks whether
`lightness` and `detangling` should stay in the vocabulary; the inverse question — whether a
richness/nourishing value is missing — is worth asking on the same pass.

---

## 2. Fields I could not decide confidently, and why

Listed per product with the adjacent value I could not rule out.

| Product | Field | Adjacent value | Why undecided |
|---|---|---|---|
| 01 HASK | `conditioning_level` | `moderate` | `high` derived from a four-entry above-tail base; §9.1's blocking clause is inoperable (item L) |
| 01 HASK | `weight_potential` | `moderate` | Whole value rests on classifying `Lanolin` as R4b heavy by analogy with `Cera Alba`; not named in the R4b list |
| 01 HASK | `texture_fit` | undefined | §9.8 has no row if a baseline slip route is not "coherent high-slip" (item J) |
| 02 Gliss 7 Sek | `conditioning_level` | `high` | S2 rule text vs. its own gloss (item C); resolved by the D1 fallback |
| 02 Gliss 7 Sek | `weight_potential` | `moderate` | Low anchor's leg 1 says "a single cationic species"; this formula has **zero** above the tail. I read zero as satisfying a fortiori |
| 02 Gliss 7 Sek | `repair_support_level` | `high` | Two-step swing on one rank: the gluconamide pair is at 11/12 against a marker at 8. If the marker were `unresolved`, `high` |
| 02 Gliss 7 Sek | `primary_focus` | `general` | `lightness` cleared but on an uncorroborated body call (item G) |
| 04 Gliss 4-in-1 | `care_direction` | `protein` | `balanced` earned only on the weak S3 branch (item D) |
| 04 Gliss 4-in-1 | `care_direction` (input) | — | Whether `Sericin` and `Hydrolyzed Silk` are two distinct R5 species or one supplier system |
| 05 Isana | `weight_potential` | `moderate` | The product's own leave-in and dry-hair modes contradict a weight-`high` architecture; §9.2's conflict fallback is written for *claims*, and G2 bars directions from moving a comparison field, so I could not apply it |
| 05 Isana | `primary_focus` | `general` | `repair` selected on a two-species protein route on a nourishing almond-milk 3in1 |
| 06 MONDAY | `weight_potential` | `high` | Item A — both alternatives satisfied, base fails on one rank |
| 06 MONDAY | `hair_thickness_fit` | `normal, coarse` | Fully inherited from the above |
| 07 Pantene | `primary_focus` | `general` | Step 6's "clearest practical differentiator" cleared largely by elimination on a six-entry above-tail segment |
| 08 Sante | `primary_focus` / `secondary_focus` | inverted | Item E — genuine `dual_supported` tie broken only by hierarchy order |
| 10 Bali Deep Repair | `primary_focus` | `general` | Item F — D5 cluster met at exactly its bar, two members inside the boundary band |
| 11 Elvital Gloss | `primary_focus` | `smoothing` | §9.5.4 criterion 2 (is the optical route "merely the smoothing film already counted"?) is a judgment; a stricter read sends this to `smoothing` |

Two products I would call clean: **03** (Bali SOS) and **09** (Balea Aqua Hyaluron) — no field at
low confidence, no trigger fired, no rule ambiguity engaged.

---

## 3. Missing inputs

**No claims summary was supplied for any packet.** The standard permits claims to influence exactly
five things (§11 step 4): the `shine` corroboration leg (§9.5.4 criterion 3), a genuinely
`dual_supported` focus tie (§9.5.1), the `bond_claim_review` trigger, the `weight_potential`
conflict fallback (§9.2), and `color_care` corroboration. Where each mattered:

- **Packet 08 — this is where the gap actually bit.** §9.5.1 explicitly permits a claim to break a
  `dual_supported` tie, and I had none, so I resolved by hierarchy order instead. My
  primary/secondary ordering is the least defensible thing in my submission.
- **Packet 11 —** I used the Gloss/Laminierung positioning legible in the product name and
  directions as §9.5.4 criterion 3 corroboration, after satisfying criteria 1 and 2 on architecture
  alone. A proper claims sheet would have made that corroboration record cleaner. Note also that the
  directions themselves say "brillant zu **versiegeln**" — banned mechanism vocabulary under §9.5.4,
  recorded as source text and never reproduced as a mechanism anywhere in my records.
- **Packets 06 and 07 —** I inferred anti-frizz (06) and bond/repair (07) positioning from product
  names only, which is E0. For 07 that is enough to fire `bond_claim_review`. For 07 a claims sheet
  showing explicit Glanz positioning would have required re-testing `shine` criterion 3 (criterion 1
  is met), and could plausibly have moved the primary from `smoothing` to `shine`.
- **Packets 03 and 10 —** curl-brand identity is visible in the packets. §9.5.2 step 3 is explicit
  that curl positioning is corroboration only and never creation, and the formula leg (high slip
  beyond baseline) failed on both, so a claims source could not have changed either outcome.
- **Packets 01, 05, 09 —** no claim-permitted leg was live; the gap changed nothing.
- **Packet 04 —** the name carries "Bonding" and "Glanz". Neither was used. `shine` fails on
  criterion 1 (architecture) regardless of any claim.

**Other missing or weak inputs:**

- Directions provenance is `moderate` (aggregated retail copy, no verbatim primary fetch) on
  packets 01, 04, 05, 06, 09, 11, 12, 13. This is a §2.3 identity-gate weakness on the directions
  leg specifically, and under §2.5/P5 it means none of those products is *stampable* without the
  contact time re-sourced verbatim — `missing_sourced_contact_time` in spirit, though a time is
  stated in all of them. Classification is unaffected, since dwell carries zero credit.
- Packet 13 has `gtinEan: null` and no pinned pack size, so §2.3's identifier and pack-size gates
  would independently have blocked it. G0 excluded it first.
- Packet 10 records an unresolved retail-channel question and a naming conflict; neither touches
  formula identity or directions.
- Packet 03 records a source conflict flag on the brand side; the directions were fetched verbatim.

**Independence limitation I must disclose.** The three documents I was permitted to read contain
worked examples naming products in this packet set: §9.3 and §18 (open question 6) discuss the
L'Oréal Glycolic Gloss family (packet 11) and state it lands in `moisture`; §9.5.3 names Balea Aqua
Hyaluron 3in1 (packet 09) and Gliss Bonding and Pantene Bond as the D5 discrimination set (packets
04/07); §2.1 and §2.2 name Guhl 2in1 (12), Isana 3in1 (05), and the Bali Curls overnight elixir; the
lexicon's §0.2 table works through a sibling Gliss 4-in-1 and an Elsève gloss mask. I reached my
values from the formulas, and in each case my derivation is recorded field by field — but I cannot
claim these reads were made in ignorance of the standard's own expectations for them. Packets 09 and
11 are the most affected, and packet 07 (Pantene Bond → `repair_support_level: low`) is the case
where the standard most clearly telegraphs its expected answer. **A future blind lane should be run
against a standard whose worked examples are drawn from products outside the calibration cohort**,
or the affected products should be excluded from agreement scoring.

---

## 4. Review triggers I fired

| Trigger | Products |
|---|---|
| `bond_claim_review` | 07 (bond positioning, no nameable token — the archetype); 02 (fired as a judgment: a *nameable* bond pair disqualified by rank, which the trigger text does not anticipate) |
| `express_dwell_unknown` | 02 (7-second dwell; `dwell_efficacy: unknown`, not extrapolated in either direction) |
| `protein_payload_review` (D4) | 04, 05, 08 |
| `specialist_damage_fit` | 04, 05 |
| `gloss_lamination_claim` | 11 |
| root/scalp application (inherited) | 11 ("von den Wurzeln bis in die Spitzen" — a P5 deviation; R8 unchanged, no scalp property created) |
| `low_confidence_field` | 01 (`texture_fit`), 02 (`primary_focus`) |
| product-form ambiguity (inherited) | 12 (not because the exclusion is doubtful, but because §2.2 cannot reproduce it — item H) |
| proprietary bond/repair claim (inherited) | 13 (recorded so the reader sees the exclusion is a protocol decision, not a judgment about the chemistry) |
| `tail_marker_anomaly` | **none** — no packet met either written condition (marker at rank ≤ 3, or before any conditioning ingredient). Packet 02's marker at rank 8 in a solvent-led formula is atypical and is recorded in its `anomalyNote`, but I did not force the trigger |
| `weight_high_conflict` | **none** — no packet supplied a lightness claim to conflict with a formula-only `high` |
| `multi_use_directions_ambiguity` | **none** — see item H for why 12 does not meet the written condition |

Vocabulary discipline confirmed across all 13 records: no *versiegelt / seals / closes the cuticle /
laminates / lasting / permanent*; no *repairs / rebuilds bonds / restores structure*; no *hydrates /
proven hydration / moisturizes*; no *protein overload / Proteinüberschuss / protein break*; no
*opens the cuticle / activates / boosts penetration*. Every `bond_route ≠ none` rationale carries the
R7 standing caveat. Biotin (packet 07) was given zero credit and kept clear of hair-loss-adjacent
language.

---

## 5. Attestation

```text
prohibited_files_accessed: false
inherited_key_context: false
```

Files read, in full: `docs/research/mask-inci/v1.0/mask-classification-standard.v0.1.md`,
`docs/research/mask-inci/v1.0/02_evidence_lexicon.v0.1.md`,
`docs/research/mask-inci/v1.0/00_category_charter.md`, and the 13 packets in
`data/research/mask-inci/v1.0/blind-packets/`. I listed the filenames in
`docs/research/mask-inci/v1.0/` and in `data/research/mask-inci/v1.0/blind-packets/` in order to
locate those files; I opened nothing else.

I did not open `reference-key-v0/`, `capture/`, `cohort.json`, `plans/`, `01_property-set-v0.md`,
`planning-evidence/`, or any conditioner or shampoo research directory, and I performed no web
search or fetch. Files written: this file plus 13 JSON records under `blind-lane-v0/`. Nothing else
in the repository was created or modified.

Qualification on `inherited_key_context: false` — I declare it true as written (I received no key
and no prior assessment), but §3 above records that the permitted normative documents themselves
name six of the thirteen packet products in worked examples, in two cases with an expected value.
That is inherited *standard* context, not key context, and I am flagging it so agreement scoring can
account for it rather than treating my reads on packets 04, 05, 07, 09, 11 and 12 as fully
independent.
