# Slot 13 — Neqi Diamond Glass Ultimate Styling Spray

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Boundary / identity-trap secondary (name mismatch + near-duplicate-GTIN sibling)

> **G0 verdict: `provisional_boundary` under §2.3.2 clause 2.** A `provisional_boundary` record **is not an
> exclusion**: it stays in-category, completes the full record, and marks every affected field uncertain (§2.3.1).
> A lean profile **is** emitted.

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Neqi — Diamond Glass Ultimate Styling Spray |
| Pack / market | 180 ml · DE |
| GTIN | 4063528094575 (confirmed across dm.de, rossmann.de and galeria.de) |
| Formula source | neqi-hair.com (manufacturer, German-language page), captured 2026-09-03 |
| Identity status | `verified_with_minor_source_difference` |
| Directions status | `captured`, **C2**, rinse test PASS |
| Claims status | `present` (3 entries, all **C2**) |
| Fingerprint | `0fc43a9c7ee30eef3b6d48ed3c15c069b6777f48b7f0b4aa7a865510591ad2ce` |

**Claim authority — clean C2.** neqi-hair.com is the manufacturer's own site with a full German-language product page
(BESCHREIBUNG / ANWENDUNG / INHALTSSTOFFE). Both directions and claims rest on it.

**Frozen claims consumed (§2.4 rule 3), all C2:**
- **heat_protection:** „Es kombiniert Styling mit intensivem Hitzeschutz bis 230°" (unit not spelled out on the page;
  captured exactly as written and **never used as a protection level** — FS-14).
- **humidity_frizz:** „Starker Anti-Frizz-Effekt", with „Wasserabweisender Effekt", „Feuchtigkeitsschutz" and
  „reduziert Frizz spürbar und schützt das Haar langanhaltend vor Feuchtigkeit".
- **finish_weight:** „Ultra-leichte Textur ohne Beschweren", corroborated by „– ohne es zu beschweren".
- The freeze records: **no hold / „Halt" claim anywhere on the page**, and no curl claim.

**Preserved conflicts (G5).** Name-based misclassification trap — dm.de lists the product as „Leave-In Spray Diamond
Glass Ultimate" while the manufacturer and Galeria call it „Diamond Glass Ultimate Styling Spray", same GTIN across
all three. A near-duplicate-GTIN sibling (4063528078469) is carried forward as a flagged trap, not verified. Both
preserved; neither decides anything, per G0's "never by name".

## G0 — product-form gate → `provisional_boundary`

**Architecture half (§2.3.2, E1/E2) — established.** The HOLD anchor returns **`meaningful_hold_route`**:
- **VP/Methacrylamide/Vinyl Imidazole Copolymer at rank 8** is **fixative-class — an L5 member** under the v0.3
  enumeration (§5): a vinylpyrrolidone-based film former of the same structural family as PVP and VP/VA. It sits
  **above** the tail marker at rank 9, so the rank prong places it as architecture.
- It sits in a **film-forming context**: **Polysilicone-29 (7)**, a silicone film former.
- The conditioning architecture behind it is **thin**. The only cationic conditioning species,
  **Silicone Quaternium-18, is at rank 11 — below the marker**, so it is not architecture (§3.1.1 clause 1). Above the
  marker there is water, two glycols, three botanical extracts, one silicone film former and the fixative polymer.
  Polysilicone-29 **does not set HOLD on its own** (§5) and, as a single silicone film former sitting immediately
  adjacent to the fixative at ranks 7 and 8, it does not constitute a **substantive conditioning architecture that
  dominates** — which is what `incidental_film` requires.
- ⇒ `meaningful_hold_route`. Recorded as a close call: this is the one anchor in the record where the
  `incidental_film` / `meaningful_hold_route` boundary turns on whether one adjacent silicone film former counts as
  dominant conditioning architecture.

**Positioning half — and the C1/C2 evidence pointing the other way.**
- The page leads on „Styling" („Ultimate **Styling** Spray"; „Es kombiniert **Styling** mit intensivem Hitzeschutz"),
  but the freeze records **no hold or texture claim at all**. "Styling" without a durable-hold or texture assertion is
  weaker than the row's requirement that directions or positioning **lead on durable hold or texture**.
- **The C2 directions describe an explicitly included use:** „Das Spray großzügig und gleichmäßig auf das
  **handtuchtrockene** (nicht nasse) Haar sprühen. Anschließend die einzelnen Partien **mit Hitze und auf Spannung
  föhnen**." That is a **blow-dry primer** — one of the two paradigm cases §2.3.2 clause 2 names by name, and one the
  §2.2 boundary table explicitly **includes**.

**Ordered rule applied — §2.3.2 clause 2.**
> *Architecture half established, C1/C2 evidence materially contradicting the exclusion ⇒ `provisional_boundary`.
> The paradigm case is C1/C2 directions describing an explicitly included use — a blow-dry primer, a post-wash
> leave-in — for a product whose architecture reads styling-first. That is a genuine evidence conflict, which is what
> the state is for.*

- Clause 1 does not fire: the positioning half is not established at C1/C2 (no hold/texture claim), **and** C1/C2
  evidence points the other way, which clause 1 forbids in any case.
- Clause 3 does not fire: it applies where the positioning half rests on **C3–C5** sources **and no C1/C2 evidence
  points the other way**. Here the contradicting evidence is C1/C2.
- Clause 4 is satisfied: this is a **genuine evidence conflict**, not discomfort — a formula reading styling-first
  against manufacturer directions for an included use, both at the highest available tier.

⇒ **`provisional_boundary`.** The record **stays in-category**, completes the full record, and marks every affected
field uncertain. It routes to review under both the standing G0 trigger and the v0.3 trigger for a clause-2 record,
with the conflict named.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **ETHYLHEXYLGLYCERIN, rank 9 of 15**. Above the tail = ranks 1–8:
Aqua [Water] · Dipropylene Glycol · Gardenia Taitensis Flower Extract · Lycium Barbarum Fruit Extract ·
Malva Sylvestris (Mallow) Extract · Pentylene Glycol · **Polysilicone-29** ·
**VP/Methacrylamide/Vinyl Imidazole Copolymer**.
Below-tail: Hydroxyacetophenone (10) · **Silicone Quaternium-18 (11)** · **Trideceth-6 (12)** ·
**Trideceth-12 (13)** · Propylene Glycol (14) · Glycerin (15).

## Dimensions (§7)

### FORM — `microemulsion` *(uncertain)*
- `confidence` **moderate** · **E1/E2** · formula
- Decision order: `anhydrous` no (Aqua rank 1) → `two_phase` no (a solubiliser package is present and there is no bulk
  oil phase) → `emulsion` no (no LGN pair; no true O/W emulsifier — Trideceth-x are solubiliser-type, not emulsifiers;
  no lipid phase to carry) → **`microemulsion` matched**.
- **Both tests, with v0.3's asymmetry applied explicitly (§7.1, blind A16):**
  - **Test (i) — solubiliser package: satisfied, and it carries no position requirement.** Trideceth-6 (12) and
    Trideceth-13 (13) are two enumerated solubiliser-type materials. They sit **below** the marker, and v0.3 states
    that this does not matter: *"a solubiliser legitimately sits low in a list, and its rank says nothing about the
    load it carries."*
  - **Test (ii) — a real oil or silicone load present as architecture: satisfied.** **Polysilicone-29 at rank 7,
    above the marker at rank 9.** This half **does** carry the position requirement, and it is met.
- `threshold_reasoning[]`: this is exactly the shape v0.3 tightened — solubilisers below the marker, silicone above —
  and the tightening makes the example set exhaustive: *"A solubiliser package — two or more, at any position — plus
  one oil or silicone species above the tail is `microemulsion`, not the ambiguous middle."* The ambiguous middle is
  now only a **single** solubiliser plus a **single** oil/silicone species at or below the marker, which is not this
  formula. `aqueous_or_hydroalcoholic_solution` would require **no** oil/silicone load above the tail; Polysilicone-29
  refutes that.
- **FS-17 observed:** "clear = light" is not used. Product clarity corroborates and never decides the row.
- Marked uncertain as an affected field of the `provisional_boundary` state.

### COND — `moderate` *(uncertain)*
- `confidence` **moderate** (ceiling moderately_high) · **E2** · formula
- One coherent conditioning route: **Polysilicone-29 (7)**, a persistent silicone film former, present as architecture.
  §5 states its family placement explicitly — it reads with the **L2 persistent silicones**, not with the vinyl/acrylate
  fixatives, and it feeds SFR, PERS and WT.
- `threshold_reasoning[]`: `high` needs an LGN pair; none exists (no fatty alcohol, no cationic surfactant above the
  marker). `low` needs no persistent non-volatile above the tail; Polysilicone-29 is one.
- `counter_signals[]`: **Silicone Quaternium-18 (11)** would be a second, cationic conditioning route — it sits below
  the marker and the rank prong does not place it (§3.1.1 clause 1). Recorded; not counted.

### SLIP — `moderate` *(uncertain)*, bias `dry_biased`
- `confidence` **low** · **E2** · formula
- One M1 contributor present as architecture (the silicone film). `high` needs two or more independent contributors;
  the only candidate second route (Silicone Quaternium-18) is below the marker.
- Bias `dry_biased`: a persistent film with few water-phase slip agents — Glycerin (15) and Propylene Glycol (14) are
  both below the marker; the above-tail glycols read as the solvent/humectant carrier rather than as slip agents.
- Confidence `low`: the whole conditioning read rests on a single species.

### SFR — `moderate` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** · **E2** · formula
- **§7.4 clause 3 governs:** the film route is present (Polysilicone-29 7), but *"where the only candidate second route
  sits at or below the tail marker, it is not available (§3.1.1) and the value is `moderate`."* The only candidate
  lubrication observation, Silicone Quaternium-18 (11), is below the marker. → `moderate`.
- Clause 2 is also respected: counting Polysilicone-29 once as film and once as lubricant would be one architecture
  read twice.
- SHN qualifier `present`: the M3 optical consequence of the silicone film. The „Diamond Glass" / „ultimativer Glanz"
  positioning does **not** create it and is recorded as a counter-signal (§8.1 — "shiny product appearance" is not
  shine).

### WT — `moderate` *(uncertain)*
- `confidence` **moderate** · **E2** · formula
- `formula_observations[]`: **one** persistent non-volatile family present as architecture — the silicone film former,
  Polysilicone-29 (7).
- `counter_signals[]`: the alternative reading that the fixative polymer film (VP/Methacrylamide/Vinyl Imidazole
  Copolymer, 8) is a **second** persistent non-volatile family lands on the **multi-family `moderate` row** — the same
  value; it is not one of §7.5's enumerated families (light/medium-band emollient, light silicone, cationic-polymer
  film), so this lane takes the single-family row and records the alternative. **The value is robust to the choice.**
- `threshold_reasoning[]`: `high` needs an LGN pair (absent) or ≥2 families with an enumerated rich/low-spreading band
  member (there is no lipid of any kind in this formula). `low` needs no persistent non-volatile above the tail;
  Polysilicone-29 is one. → `moderate`.
- **§10.1.2 weight conflict tag — declined, condition named. This is the deterministic-decline case the rule exists
  for.** A candidate statement exists and is at the right tier: **C2, „Ultra-leichte Textur ohne Beschweren"** —
  materially about the finish this product leaves, not decorative, and no finished-product evidence resolves anything.
  Conditions **2, 3 and 4 are all satisfied. Condition 1 fails: WT did not resolve to `high` from formula alone.**
  The tag is therefore unavailable and **nothing moves**; `weight_potential` projects `moderate` on its own anchor.
  Recorded explicitly, because a lane that applied the downgrade here would be applying it to a value that was never
  `high` — the exact non-determinism §10.1.2 closes.
- Transfer caution: not attached (no lipid load).
- G9 observed: „Spray ⇒ leicht" is not used, and the C2 lightness claim does not set the value either.

### PERS — `neutral_non_volatile` (projects `moderate`)
- `confidence` **moderate** (ceiling cap) · **E2** · formula
- `threshold_reasoning[]`: `permanent_cationic` would be reached by **Silicone Quaternium-18**, which is enumerated by
  name in the silicone-functional group ("any declared `Silicone Quaternium-x`") — but it sits at **rank 11, below the
  marker at rank 9**, so the rank prong does not place it as architecture and it cannot set the class (§3.1.1 clauses 1
  and 3). `ph_dependent_cationic` needs an amino silicone or amidoamine; none. The highest class present as
  architecture is the persistent silicone film former, Polysilicone-29 (7) — a neutral non-volatile.
- **Below-marker counter-signal (§3.1.1 clause 3):** Silicone Quaternium-18, rank 11; marker Ethylhexylglycerin,
  rank 9. The known error direction is that strict rank **under-states** persistence and therefore **under-warns on
  buildup** (FS-20) — and this product is applied before heat styling and is silicone-film-based, so buildup is the
  live question. The record **routes to human review** so that risk is carried by a person.
- **G11:** no duration, wash count, applications-to-buildup or clarification schedule.

### HOLD — **`meaningful_hold_route`** (projects `hold_support: meaningful`)
- `confidence` **moderate** (the ceiling for the coarse state) · **E1/E2** · formula
- The G0-deciding read, above: a **fixative-class L5 member present as architecture** (VP/Methacrylamide/Vinyl
  Imidazole Copolymer, rank 8, above the marker) in a film-forming context, with **thin conditioning architecture
  behind it**.
- **§5's v0.3 enumeration is load-bearing here, in both directions:**
  - VP/Methacrylamide/Vinyl Imidazole Copolymer is **fixative-class**, so it *can* set HOLD.
  - **Polysilicone-29 is *not* fixative-class by default** — it is a silicone film former read with the L2 persistent
    silicones. *"A formula whose only candidate hold polymer is Polysilicone-29 is HOLD `none`."* Reading it as a hold
    polymer would be FS-9 exactly. It may sit inside an `incidental_film` read only where an **independent**
    fixative-class L5 member is also present — which it is, but that clause supports `incidental_film`, and the
    conditioning architecture behind the pair is not substantive enough to dominate.
- **Ceiling respected:** the coarse **state** only. **No hold level, no grade, no 0–4 score** — polymer level and
  plasticiser load are invisible (SR §K HOLD). The C2 page makes no hold claim to compare against in any case.
- **Triggers the G0 styling review** (§7.7 gate, §14) — already reflected in the `provisional_boundary` state.

### HEAT — trace **`claim_only`** · production binary **`provides_heat_protection: true`** · **routes to review**
- `confidence` **high** (on the claim) · **E0/E1**
- **§13.3 rule 1:** a **C2** heat-protection claim exists („Es kombiniert Styling mit intensivem Hitzeschutz bis 230°",
  neqi-hair.com). ⇒ binary **`true`**. A recommendation-policy decision, not an efficacy statement.
- **§13.3 rule 2 — formula sanity-check against the closed L9 list: no member is present.** The tempting candidate is
  the vinyl copolymer, and it must be refused explicitly: **VP/Methacrylamide/Vinyl Imidazole Copolymer is enumerated
  in v0.3 as an L5 fixative-class member, not an L9 member.** The L9 list is closed —
  VP/**Acrylates/Lauryl Methacrylate** Copolymer, Polyquaternium-55, PVM/MA + Polyquaternium-28, PVP/DMAPA Acrylates
  Copolymer, Quaternium-70, hydrolyzed wheat protein — and adding a member requires new peer-reviewed evidence plus a
  version bump. Structural family resemblance to a tested polymer is **not** membership. Polysilicone-29 and
  Silicone Quaternium-18 are generic silicones and stop at `claim_only` by G10 / FS-7.
  ⇒ **`true`, trace state `claim_only`, route to human review** with a "claim looks formula-unsupported" note.
- **FS-14 observed:** „bis 230°" is a marketing **use-condition** parameter, never a protection level; the page does not
  even spell out the unit. `heat_protection_max_c` does not exist in this model. No efficacy grade is emitted.

### HUM — **`claim_only`** *(uncertain)*
- `confidence` **low** · **E0/E2** · product+formula
- **A C2 humidity/anti-frizz claim exists** („Starker Anti-Frizz-Effekt"), so `not_claimed` is refused and the ladder
  opens at `claim_only`.
- **`formula_plausible` is blocked, and the blocking rule is the humectant one.** The state would additionally require
  a hydrophobic continuous film-forming route present as architecture — **which is satisfied** (Polysilicone-29, 7) —
  **and no dominant humectant architecture**. The humectant leg **is** dominant: **Dipropylene Glycol at rank 2** — a
  member above the tail and very high in the list — with **Pentylene Glycol at rank 6**, i.e. several members and one
  high-ranked one, which is §7.9's definition of "the material direction of the water phase". A dominant humectant
  architecture **blocks `formula_plausible` outright**, and the highest reachable state with a claim is `claim_only`.
- **Glycol reading recorded (§7.9, v0.2):** dipropylene and pentylene glycol could be read as solvents rather than
  humectants, and that reading would unblock `formula_plausible`. The formula does not settle it — there is no oil
  phase for them to solubilise and no alcohol — so the standard's rule applies: **take the humectant reading, the
  conservative one, and mark the field uncertain.** `humidity_resistance` is in `uncertain_fields`.
- **Mandatory humectant counter-signal (§4):** the humectant observation is recorded with **confidence held at `low`**.
  Humectants are never support for a humidity claim in either direction — the best-supported anti-frizz mechanism is
  *reducing* water uptake while a humectant's function is to *increase* water association (SR §E.1, FS-15). No
  dew-point threshold is encoded (FS-16).
- The page's „Wasserabweisender Effekt" and „Feuchtigkeitsschutz" lines are recorded; they are claims, and a claim
  never upgrades the evidence state (§2.4.1 rule 5).

### R2 — `none_visible` + **`candidate_below_tail`** *(uncertain)*
- `confidence` **moderate** · **E1** · formula
- **`candidate_below_tail` note (§7.10, v0.3 — mandatory `counter_signals[]` entry):** a §7.10-**qualifying** route is
  present — **Silicone Quaternium-18, a silicone quat, at rank 11** — sitting **below the tail marker,
  Ethylhexylglycerin, at rank 9**. The dimension takes its **rank-supported value, `none_visible`**, and the record
  **routes to human review**. The note is not a fourth state between `none_visible` and `candidate`, never appears in
  the lean profile, and no downstream consumer may read it as one (G14).
- No protein of any kind is declared, so the plain-hydrolysate note does not arise.

### DOSE — `moderate` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- WT `moderate` ⇒ DOSE `moderate`. **`FORM = microemulsion` changes no value (v0.3 change 18, clause 4):** the real
  non-volatile load is already what WT reads, and firing a second time on the form label was the double count G3
  forbids. No `two_phase` variability note applies.

### EXPO — `no_listed_fragrance_signal` *(uncertain)*
- `confidence` **moderate** · **E1** · formula
- **No `Parfum`, no `Aroma`, no declared EU fragrance allergen** at any rank.
- `counter_signals[]`: **Gardenia Taitensis Flower Extract (3)** is an aromatic botanical high in the list. L8's
  `aromatic_or_allergen_exposure` value covers "clearly aromatic **essential oils**"; a flower **extract** is not an
  essential oil, so the literal read is `no_listed_fragrance_signal`. The observation is recorded and the field is
  marked uncertain rather than silently widening the value.
- No `Alcohol Denat.`/`Alcohol` → no alcohol note.
- **Hard limit:** "no listed fragrance signal" is **not** fragrance-free, **not** allergy-safe and **not**
  hypoallergenic (§7.12, SR §M.12, G6). The product makes no fragrance-free claim, so the §14 fragrance-free trigger
  does not fire — unlike slot 11.

### ROLE — `[post_wash, heat_styling]`
- `confidence` **moderately_high** (ceiling) · **E1** · directions · tier **C2**
- `post_wash` ← „Das Spray großzügig und gleichmäßig auf das **handtuchtrockene** (nicht nasse) Haar sprühen." —
  application to towel-dried hair.
- **`heat_styling` ← „Anschließend die einzelnen Partien mit Hitze und auf Spannung **föhnen**."** The sentence
  satisfies **both** evidence shapes §7.13 permits, and the record states which: a **named heat tool** („föhnen" — the
  blow-dryer) **and** a **`pre_heat` application stage** — the direction positions the application before heat styling
  as a stage of the routine („auftragen und föhnen"). The v0.3 widening is not even needed here, but it is the shape it
  was written for.
- Not emitted: `refresh` (no dry-hair or between-washes application); `ends_only` (no placement restriction —
  the directions section the hair but do not restrict placement to lengths and ends); `curl_styling` (the directions
  blow-dry **auf Spannung**, i.e. under tension — the opposite of curl forming, scrunching or diffusing).
- The 230° figure is a **claim, not a direction**, and establishes nothing for ROLE (§7.13).

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only; „Diamond Glass" and „ultimativer Glanz" are positioning and create nothing (§8.1, G3 rule 5) |
| CURL | not derived | §17.20 — no value vocabulary; and `curl_definition` fails its v0.3 negative gate (below) |
| R3 | **`none`** | Researched, negative: no C1/C2 bond claim and no recognised bond chemistry. Emits no German string |
| LAYER | not emitted | |
| Buildup caution | not emitted | `persistence` projects `moderate` — the below-marker silicone quat is the recorded under-warning direction |

## `care_direction` — `moisture` *(uncertain)*
- `confidence` **low** (humectant-led minimum row) · **E2** · formula
- R2 `none_visible` ⇒ `protein`/`balanced` unreachable.
- **§9's silicone-led `unknown` rule does not fire**, and this record is the sharpest illustration of **open gap
  §17.22** in the set. The rule requires a silicone-led architecture with **no R2 route and no material humectant or
  emollient leg** — but Dipropylene Glycol (2) and Pentylene Glycol (6) are a material humectant leg above the tail, so
  the gate is not met and the value falls to the **humectant-led minimum row**: an L4 leg as architecture with no R2
  route, at `low` confidence, with the thin-architecture observation as the required counter-signal.
- The result is that a plainly **film-led** product — a silicone film former plus a fixative polymer, with no lipid and
  no cationic architecture above the marker — is labelled `moisture`, **while its own C2 page claims
  „Feuchtigkeits*schutz*"** (protection *from* moisture). §17.22 names exactly this shape and records it as a Nick
  fork rather than a repair. Recorded, not worked around.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `moderate` was established by **Polysilicone-29 (7)** — a single observation,
uniquely determined, so the over-satisfaction question that affects slots 2, 6, 8 and 10 does not arise here.

*Step 1 — collect qualifying routes.*

| Route | Verdict |
|---|---|
| `repair` | Not available. R2 = `none_visible` (the qualifying silicone quat is below the marker); no protein or silane active in the C2 marketing position |
| `smoothing` | Not available. SFR is `moderate`, not `high` (§7.4 clause 3). **And** §10.2.1's second bullet independently blocks it: Polysilicone-29 **is** the COND read, with no separate alignment observation above the marker, so the film is baseline conditioning rather than a route |
| `curl_definition` | **Not available — the v0.3 negative gate does the work.** The positive half is satisfied: HOLD ∈ {`incidental_film`, `meaningful_hold_route`} with the fixative **present as architecture** (rank 8, above the marker). But the route is **unavailable unless the product carries curl/wave positioning or texture-targeted directions at C1/C2**, and it carries neither — the freeze records no curl claim, and the C2 directions blow-dry the hair **auf Spannung**, which is straightening, not curl forming, scrunching, plopping or diffusing. The gate is **negative only**: its failure disqualifies the route and its presence would never have created one |
| **`heat_styling`** | **Qualifies — both halves, cleanly.** (i) HEAT ≥ `claim_only` under **C1/C2 claim authority** (§2.4.1): the C2 „Hitzeschutz bis 230°" claim. (ii) **ROLE includes `heat_styling` with its direction sentence** („Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen"), which both names a heat tool **and** establishes a `pre_heat` application stage. Sets a **use context, never a protection level** (§13) |
| `detangling` | Not available. Prong 1: no detangling-led C1/C2 positioning. Prong 2: SLIP `moderate` ✓ and COND ≤ `moderate` ✓, but it requires **WT `low`** and WT is `moderate` |
| `volume_lightness` | Not available. Requires **WT `low`** — WT is `moderate` — **and** no persistent film route, which also fails. The C2 „Ultra-leichte Textur ohne Beschweren" claim **cannot create the route** (principle 4, G9, FS-2). Recorded, because this is where a positioning-led lane would have gone wrong |
| `shine` | Not available. No distinct gloss route; it would restate the silicone film (§8.1, G3), and „Diamond Glass" is a name |

*Step 2 — exact-product evidence first.* None exists.

*Step 3 — the rank order binds:* `repair` > `smoothing` > `curl_definition` > **`heat_styling`** > `detangling` >
`volume_lightness` > `shine`. One route qualifies. ⇒ **`focus.primary: heat_styling`**.

*Step 6 — secondary focus.* No remaining route qualifies. ⇒ `focus.secondary: []`.

*This slot is where the v0.3 `pre_heat` / `heat_styling` change lands: the production binary and the focus vocabulary
now agree about what a heat product is. Compare slots 8 and 9, where a C1/C2 heat claim and a `true` binary sit beside
an unreachable `heat_styling` focus — in slot 8 because the directions establish no application stage, in slot 9
because the directions are below C1/C2 authority.*

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "microemulsion",
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
  "uncertain_fields": [
    "product_form", "conditioning_level", "weight_potential", "hold_support",
    "care_direction", "focus", "humidity_resistance", "fragrance_scalp_exposure"
  ]
}
```

**`uncertain_fields` rationale.** §2.3 requires a `provisional_boundary` record to mark **every affected field**
uncertain. The affected set is: the fields the boundary conflict itself touches (`product_form`, `hold_support`,
`focus`), the fields resting on the single-species above-tail architecture the conflict turns on (`conditioning_level`,
`weight_potential`, `care_direction`), plus the two fields with their own recorded readings (`humidity_resistance`
under the glycol rule; `fragrance_scalp_exposure` under the aromatic-botanical counter-signal).

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: moderate` (row 2); fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← row 2 (COND `moderate`, no qualifying repair route — R2 `none_visible`, so row 3b is unreachable
  despite the below-marker silicone quat).
- `texture_fit` ← row 2 (WT `moderate`, any slip). **`HOLD = meaningful_hold_route` does not by itself raise
  curly/coily** — it first triggers the G0 styling review, which it has (§10.3).
- `scalp_application_fit` ← **`unknown`** (the default): `avoid` does not fire — no occlusive or oil-led architecture,
  and the narrowed v0.3 irritant-load trigger needs an exposure flag **plus** a material alcohol note, and there is no
  exposure flag at all. No explicit scalp direction (not `suitable_if_evidenced`); the directions section the hair but
  state no non-scalp placement (not `conditional`).

## German cautions (§18)

| Emitted by | String |
|---|---|
| HOLD = `meaningful_hold_route` | „Bringt Halt über ein Styling-Polymer – das ist etwas anderes als Pflege." |
| HEAT claim without an L9 member (review route) | „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das." |
| HUM = `claim_only` | „Anti-Frizz ist ausgelobt. Aus der INCI-Liste lässt sich das Verhalten bei hoher Luftfeuchtigkeit nicht ableiten." |
| EXPO = `no_listed_fragrance_signal` | „Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |
| Any `unknown` field | „Dazu haben wir keine belastbare Information." |

**The HUM humectant counter-signal string is deliberately NOT emitted.** §18's table lists a row for it
(„Enthält Feuchthaltestoffe – die machen das Haar weicher, sprechen aber nicht für Frizz-Schutz bei feuchtem Wetter."),
but §18's own v0.2 register rule and **G14 both state that no string may express a counter-signal** and that
counter-signals never leave the research trace. G14 governs; the string is withheld and the contradiction is recorded
as a residual ambiguity.

The 230° figure appears in no string (FS-14). No hold **level** is stated — the HOLD string names the mechanism and
its limit, per §18's register rules.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| **`provisional_boundary` under §2.3.2 clause 2** | v0.3 trigger — the review needs the conflict named: styling-first architecture vs C2 blow-dry-primer directions |
| **`HOLD = meaningful_hold_route`** | Styling-boundary decision (standing trigger) |
| **Heat claim with no L9 member** | §13.3 rule 2 — binary `true`, formula unsupported; VP/Methacrylamide/Vinyl Imidazole Copolymer is L5, not L9 |
| **`candidate_below_tail`** | Silicone Quaternium-18 (silicone quat) at rank 11 vs marker at rank 9 |
| Below-marker persistence route | Same species — PERS under-states and therefore under-warns on buildup (FS-20) |
| `care_direction` under-firing on a film-led architecture | Open gap §17.22 — `moisture` on a product claiming „Feuchtigkeitsschutz" |
| Identity trap | Retailer name divergence; unverified near-duplicate-GTIN sibling (G5) |

`review_status`: **`provisional`** → routed. `out_of_category`: **false** — a `provisional_boundary` record is not an
exclusion; it stays in-category and carries a full lean profile.
