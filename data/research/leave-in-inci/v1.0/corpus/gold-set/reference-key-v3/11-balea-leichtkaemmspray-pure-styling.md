# Slot 11 — Balea Leichtkämmspray Pure Styling

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Sensitive / fragrance-free fibre leave-in

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Balea — Leichtkämmspray Pure Styling |
| Pack / market | 200 ml · DE |
| GTIN | 4067796148855 |
| Formula source | dm.de (dm-Art. 3042625), captured 2026-09-03; claims re-confirmed live 2026-09-04 |
| Identity status | `verified` |
| Directions status | `captured`, rinse test PASS |
| Claims status | `present` (2 entries, both **C2**) |
| Fingerprint | `ef2af7781e942a7f0bff9398d89bd2ef8221745d74106516a162b6ab9e9b7328` |

**Claim-tier correction applied at G1 (§2.4.1 rule 6).** The packet stamps the directions `C3`. **Balea is dm's own
private label and dm ↔ Balea is a named case in the v0.3 house-brand clause**, so dm.de is the brand owner's own
German-market page for this product and is **C2** for both directions and claims. `claim_tier_basis: house_brand`;
routes to review.

**Frozen claims consumed (§2.4 rule 3):**
- **finish_weight, C2:** „Kein Verkleben oder Beschweren".
- **sensitive_fragrance_free, C2:** „Ohne Parfüm" (pack/page badge).
- Recorded from the same C2 capture: „Kopfhautpflege durch prebiotisches Inulin", „Natürlicher Glanz & verbesserte
  Kämmbarkeit", „…erleichtert das Kämmen erheblich", „Die Formel bietet eine verbesserte Kämmbarkeit, ohne das Haar zu
  verkleben oder zu beschweren."
- The freeze records, actively checked: **no heat claim, no humidity/frizz claim, no repair/bond claim, no curl claim.**

**Fingerprint note.** This is one of the two slots whose `normalized_ingredients` were repaired for the internal-comma
defect — „1,2-Hexanediol" is now a single token rather than the spurious pair `1` / `2-HEXANEDIOL`. The repair matters
here because it removes a phantom token from a very short list, and rank counts on this product decide several anchors
(§2.4 packet requirements, v0.3).

## G0 — product-form gate

`in_category`. Aqua leads; directions state „Produkt muss nicht wieder ausgespült werden." explicitly (rinse test
PASS). HOLD = `none`, so the §2.3.2 architecture half is not established — **note that the product name contains
„Pure Styling" and this does not touch the decision** (G0: classify by function, directions and architecture, never by
name).

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **HYDROXYACETOPHENONE, rank 7 of 11**. Above the tail = ranks 1–6:
Aqua · Betaine · Propylene Glycol · **Cetrimonium Chloride** · Inulin · Panthenol.
Below-tail: 1,2-Hexanediol (8) · Caprylyl Glycol (9) · Citric Acid (10) · Sodium Hydroxide (11).

An eleven-ingredient list with the marker at rank 7 is a comparatively well-behaved case: the conditioning-relevant
species are all above it, and the below-tail block is entirely preservative/pH adjustment.

## Dimensions (§7)

### FORM — `aqueous_or_hydroalcoholic_solution`
- `confidence` **moderately_high** · **E1/E2** · formula
- Decision order run in full: `anhydrous` no (Aqua rank 1) → `two_phase` no (there is **no oil or silicone phase at
  all**) → `emulsion` no (no true O/W emulsifying system, and none is needed with no lipid phase; **no LGN pair** — a
  cationic surfactant is present but no long-chain fatty alcohol) → `microemulsion` no (**test (ii) fails outright**:
  no real oil or silicone load exists at any rank; test (i) also fails, since no solubiliser-type material is declared)
  → **solution matched**: water leading with a glycol early, no LGN pair, no true emulsifier, no oil/silicone load.
- The label deliberately covers both purely aqueous and hydroalcoholic systems; **no alcohol is present here**, and
  whether alcohol is present is recorded in EXPO notes, not in FORM (§7.1).

### COND — `low`
- `confidence` **moderate** (ceiling moderately_high) · **E2** · formula
- `threshold_reasoning[]`: the `low` anchor reads "only a short-chain quat, or a water/glycol solution with **no
  persistent non-volatile above the tail**". Both halves describe this formula: **Cetrimonium Chloride (4)** is the
  sole conditioning species, and there is no persistent non-volatile of any kind above the tail — Inulin (5) is a
  prebiotic polysaccharide, Panthenol (6) a humectant/fibre-mechanics signal, Betaine (2) and Propylene Glycol (3)
  humectants/solvents. `moderate` requires a cationic-**polymer** film route or a persistent silicone/emollient
  package; neither exists.
- `limitations[]`: **§7.2 calls Cetrimonium Chloride a "short-chain quat" while §7.6 calls the same material class
  "monomeric long-chain"** — a vocabulary conflict for one material class that v0.3 **deliberately leaves open**
  (ref A18 / blind A24, §21.2 "deliberately not changed"), because resolving it needs the ontology decision whether a
  monomeric quat is "a route". Recorded, not worked around.

### SLIP — `moderate`, bias `wet_biased`
- `confidence` **moderate** · **E2** · formula
- `threshold_reasoning[]`: the `low` anchor requires "**no** persistent lubricant **and no cationic species above the
  tail**" — a cationic species **is** above the tail (Cetrimonium Chloride, rank 4), so `low` is refused. `moderate` is
  "one M1 route present as architecture", which the quat supplies. `high` needs two or more independent contributors;
  there is one.
- Bias `wet_biased`: a water-dominant architecture with **no persistent film** — the row fits cleanly, which is
  unusual in this set and is recorded as such.
- **This record reproduces the carried-open COND `low` / SLIP `moderate` contradiction** on a single monomeric-quat
  observation (BR slot-11 finding, confirmed in round 2, carried open in v0.3). Both values are emitted as the anchors
  say; the tension is recorded, not smoothed away.

### SFR — `low` (`smoothing_shine_qualifier: absent`)
- `confidence` **moderate** · **E2** · formula
- `low` anchor: "No persistent film; water phase and humectants only" — exactly this formula. There is no persistent
  silicone, no substantive cationic **polymer** film, and no emollient package.
- SHN qualifier `absent`: with no alignment/deposition film there is no M3 optical consequence to qualify. The C2 page
  says „Natürlicher Glanz"; **positioning does not create the qualifier** (§8.1, and „Shiny product appearance" is not
  shine, HO §9). Recorded as a counter-signal.

### WT — `low`
- `confidence` **moderately_high** · **E2** · formula
- `low` anchor: a **water/glycol-dominant architecture** with **no** persistent non-volatile family above the tail, no
  LGN pair, and no rich-band lipid — all four conditions hold literally. Ceiling rises to `moderately_high` because
  FORM resolves to a definite architecture **and** the non-volatile architecture is fully readable above the tail: on
  an eleven-ingredient list with the marker at rank 7 there is genuinely nothing to miss.
- **§10.1.2 weight conflict tag:** not applicable — condition 1 requires WT `high`. The C2 statement „Kein Verkleben
  oder Beschweren" **agrees** with the formula read rather than contradicting it, so the tag would have nothing to do
  even if the condition were met. Recorded as the one slot in this set where a C2 lightness claim and a formula-derived
  `low` point the same way.
- Transfer caution: not attached (no lipid load at all).

### PERS — `neutral_non_volatile` (projects `moderate`)
- `confidence` **moderate** (ceiling cap) · **E2** · formula
- `threshold_reasoning[]`: `permanent_cationic` requires a polymeric or silicone-functional quat; none. Amino silicones
  and amidoamines: none. `volatile_or_water_soluble` reads "volatiles and humectants only" — and it is **explicitly
  refused** by §7.6's monomeric rule.
- **Mandatory monomeric-quat note (§7.6) — this record would be invalid without it:** *persistence rests on a monomeric
  long-chain quat (Cetrimonium Chloride, rank 4): permanently charged, so more substantive than a neutral deposit, but
  small-molecule and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism
  ordering, not a duration (G11).* v0.1 had no home for this material and the blind lane had to assign
  `volatile_or_water_soluble`, which under-states persistence and therefore under-warns on buildup — the direction
  FS-20 exists to guard. The v0.2 rule is applied here as designed.
- **G11:** no duration, wash count or clarification schedule.

### HOLD — `none`
- `confidence` **moderately_high** · **E1**. No fixative-class L5 polymer is declared. „Pure **Styling**" in the
  product name creates nothing (FS-9, G0).

### HEAT — trace `not_claimed` · binary `provides_heat_protection: false`
- `confidence` **high** · **E0/E1**
- §13.2 row 1: **no C1/C2 heat claim** — the C2 house-brand page was fetched live and the freeze records the absence as
  an active check — and **no L9 member** at any rank. Binary `false`.
- **Not a `claim_authority_gap`:** the C1/C2 source was located and is silent. "Not captured" and "does not exist" are
  different states (§2.4 rule 2) and this is the latter.

### HUM — `not_claimed`
- `confidence` **high** · **E0**
- No C1/C2 humidity or anti-frizz claim (actively checked, absent) ⇒ `not_claimed`. §7.9 clause 3 is not engaged:
  there is no hydrophobic continuous film route — the formula is water, glycols, a quat and a polysaccharide.
- Humectants (Betaine 2, Propylene Glycol 3, Panthenol 6) are a **counter-signal** for humidity, never support
  (L4, FS-15). No dew-point threshold is encoded (FS-16).
- Glycol reading recorded (§7.9, v0.2): Propylene Glycol could be read as solvent rather than humectant; the formula
  does not settle it, so the **conservative humectant reading** is taken. It changes nothing here, since the state is
  claim-gated.

### R2 — `none_visible`
- `confidence` **moderately_high** · **E1** · formula
- No cationised protein, silane derivative or silicone quat at any rank. No hydrolysed protein of any kind, so the
  plain-hydrolysate note does not arise; no qualifying route below the marker, so no `candidate_below_tail` note.
- **Panthenol rule:** Panthenol (6) is a **fibre-mechanics** signal (L6), **not** an R2 surface-film route and **not**
  a heat route (FS-24). Marsh et al. 2026 supports "low-confidence mechanistic support for fibre mechanics" and nothing
  above it — single industry-affiliated group, model-system mechanics, not a leave-in finished-product result.

### DOSE — `low` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- Both halves of the `low` row hold: WT = `low`, **and** the carrier is **water-dominant with no persistent family
  above the tail**. The v0.2 correction is load-bearing here — water counts as a dominant carrier in the `low` row
  (M6 covers volatile silicones and hydrocarbons, not water), so a purely aqueous low-weight product now satisfies a
  row instead of falling through. The row no longer carries a FORM condition either.

### EXPO — `no_listed_fragrance_signal`
- `confidence` **high** · **E1** · formula
- **No `Parfum`, no `Aroma`, no declared EU fragrance allergen, no aromatic essential oil at any rank.** The C2 pack
  badge „Ohne Parfüm" corroborates the formula observation.
- **No alcohol note:** no `Alcohol Denat.` / `Alcohol` is declared. (1,2-Hexanediol and Caprylyl Glycol are glycol
  preservative-boosters, not ethanol.)
- **Hard limit, and it is the whole point of this archetype slot:** *"no listed fragrance signal" is **not**
  fragrance-free, **not** allergy-safe and **not** hypoallergenic.* Labelling thresholds and incomplete formulas
  prevent those claims, and the EU technical document to Reg. 655/2013 addresses "free from" and "hypoallergenic"
  specifically. The manufacturer's „Ohne Parfüm" is recorded as **the manufacturer's claim**, never as a tolerance
  conclusion (§7.12, SR §M.12, G6).

### ROLE — `[post_wash]`
- `confidence` **moderate** · **E1** · directions · tier **C2 (house_brand)**
- `post_wash` ← „Auf nasses Haar aufsprühen, kurz einwirken lassen, kämmen und wie gewohnt frisieren." — application to
  wet/damp hair.
- Not emitted: `refresh` (no dry-hair or between-washes application is described); `ends_only` (no placement
  restriction is stated); `heat_styling` (no named heat tool, and „wie gewohnt frisieren" establishes no `pre_heat`
  application stage — it is generic styling); `curl_styling` (nothing).
- „Produkt muss nicht wieder ausgespült werden." is the rinse-test sentence and establishes no role.

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | **`absent`** | No alignment/deposition film exists; the C2 „Natürlicher Glanz" positioning does not create the qualifier |
| CURL | not derived | §17.20; `curl_definition` also fails HOLD and the negative gate |
| R3 | **`none`** | Researched, negative. Emits no German string |
| LAYER | not emitted | |
| Buildup caution | not emitted | `persistence` projects `moderate` |

## `care_direction` — `moisture` (humectant-led minimum)
- `confidence` **low** (fixed by the row) · **E2** · formula
- R2 `none_visible` ⇒ `protein`/`balanced` unreachable. Not silicone-led (no silicone), so the §9 `unknown` rule does
  not fire.
- **Humectant-led minimum row (§9, v0.2):** an L4 humectant leg present **as architecture** — Betaine (2),
  Propylene Glycol (3), Panthenol (6), all above the marker — with **no** R2 route, even though the emollient and
  cationic legs are thin. Confidence is fixed at `low` and the **thin-architecture observation is the required
  counter-signal**: there is no L3 leg at all and the L1 leg is a single monomeric quat.
- Constraint 2 observed: neither Panthenol alone nor a humectant name alone sets a value; the leg must be above the
  tail, and it is.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND is `low`; the observation that established it is the **absence** of any
persistent non-volatile above the tail, alongside the lone quat (4). Nothing beyond that is spent, so both routes below
rest on observations outside the COND set.

*Step 1 — collect qualifying routes.*

| Route | Verdict |
|---|---|
| `repair` | Not available. R2 = `none_visible`; no protein or silane active in any C1/C2 marketing position |
| `smoothing` | Not available. SFR is `low` |
| `curl_definition` | Not available. HOLD = `none`; the negative gate also fails (no C1/C2 curl/wave positioning) |
| `heat_styling` | Not available. HEAT = `not_claimed` |
| **`detangling`** | **Qualifies — on both prongs independently.** Prong 1: **detangling-led C1/C2 positioning**. The row names „Leichtkämmspray" as its worked example, and this product is exactly that: the C2 house-brand page states „…erleichtert das Kämmen erheblich" and „Die Formel bietet eine verbesserte Kämmbarkeit", with detangling as the product's whole point rather than one benefit among several — and **SLIP is `moderate`**, clearing the ≥ `moderate` bar. Prong 2: a **slip-dominant light architecture** — SLIP `moderate` **and** COND `low` (≤ moderate) **and** WT `low`. Note the row's own guard is respected: SLIP `high` alone would set nothing, and SLIP here is only `moderate` |
| **`volume_lightness`** | **Qualifies.** WT = `low` **and** no persistent film route. Never derived from FORM alone (G9, FS-2) — the value rests on the WT anchor, which was decided on the absent non-volatile architecture, not on the word "Spray" |
| `shine` | Not available. No distinct gloss route; the C2 „Natürlicher Glanz" is positioning and would restate nothing at all, since there is no film (§8.1) |

*Step 2 — exact-product evidence first.* None exists.

*Step 3 — the rank order binds:* `repair` > `smoothing` > `curl_definition` > `heat_styling` > **`detangling`** >
**`volume_lightness`** > `shine`. Two routes qualify; **`detangling` is the higher-ranked** ⇒ `focus.primary`.

*Step 4 — observation counting never promotes a lower-ranked route*, and is not used here.

*Step 6 — secondary focus.* `volume_lightness` is the remaining qualifying route and clears the
**independent-support bar**: it rests on its own endpoint-relevant observation — the absence of any persistent
non-volatile family above the tail (a **weight** read) — which is not a restatement of the slip/cationic observation
behind `detangling`. Cap of two respected; one used.

⇒ **`focus.primary: detangling`**, **`focus.secondary: ["volume_lightness"]`**.

*This is the only slot in the set that reaches a non-`general`, non-specialist focus on a clean two-route read, and it
does so without any rule tension.*

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "aqueous_solution",
  "conditioning_level": "low",
  "weight_potential": "low",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "detangling", "secondary": ["volume_lightness"] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "recommended", "medium": "recommended", "coarse": "conditional" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "conditional", "highly_damaged": "caution" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "conditional", "coily": "caution" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": []
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: low` (row 1). The fine `recommended` still carries the §7.5
  judgment-call limitation: no evidence establishes a residue load at which fine hair reads as limp, so this is a
  product judgment call and is labelled as one.
- `damage_fit` ← **row 1**: `conditioning_level = low` **and** no qualifying repair route. `highly_damaged: caution`
  is the honest read — a water/glycol solution with one monomeric quat has little to offer badly damaged hair.
- `texture_fit` ← **row 1**: `weight_potential = low` (light dry-down).
- `scalp_application_fit` ← **`unknown`** (the default), ordered test: `avoid` does not fire on any of its three
  triggers — the architecture is neither heavy-occlusive nor oil-led; **EXPO carries no exposure flag at all**, so the
  scalp-relevant irritant load cannot form even before the alcohol half is considered; and the directions do not say to
  avoid the roots or scalp. `suitable_if_evidenced` is **not** reached: it requires **directions** that explicitly
  direct the product at the scalp or roots, and „Auf nasses Haar aufsprühen" does not. The C2 claim „Kopfhautpflege
  durch prebiotisches Inulin" is a **claim, not a direction**, and §10.3.1 is explicitly directions-derived — positive
  values require directions, never a formula or claim read. `conditional` is not reached either, since no non-scalp
  placement is stated. → `unknown`.
- **Recorded reading:** this is the cleanest available example of §10.3.1's directions-only discipline producing a
  value that looks under-informative next to the marketing. It is deliberate: an exposure flag is not a tolerance
  prediction and a scalp-care claim is not a placement direction.

## German cautions (§18)

| Emitted by | String |
|---|---|
| WT = `low` | „Bleibt leicht im Haar und beschwert kaum." |
| EXPO = `no_listed_fragrance_signal` | „Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |

The EXPO string carries its own hard caveat by design; no additional hedge is appended (G14). DOSE `low` and PERS
`moderate` emit nothing. No „… ist ausgelobt" string — the two C2 claims are a finish claim and a fragrance-free badge,
neither of which is a §18-emitting field value.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| **Fragrance-free / hypoallergenic implication** | The C2 „Ohne Parfüm" badge plus `EXPO = no_listed_fragrance_signal` — standing trigger, and the reason this archetype exists in the set |
| `claim_tier_basis: house_brand` | dm ↔ Balea (§2.4.1 rule 6, v0.3) |
| Carried-open ontology conflict | COND `low` beside SLIP `moderate` on one monomeric-quat observation, plus the §7.2 "short-chain" / §7.6 "long-chain" vocabulary split (ref A18, blind A24) |

`review_status`: `draft` → routed. `out_of_category`: false.
