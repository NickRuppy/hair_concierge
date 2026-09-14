# Slot 3 — Cantu Leave-In Haarkur Repair Creme

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Rich cream dry/damaged

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Cantu — Leave-In Haarkur Repair Creme |
| Pack / market | 453 g · DE |
| GTIN | 810006945430 (DE pack, Version A — authoritative for this gold set) |
| Formula source | dm.de (dm-Art. 1685686), captured 2026-09-03 |
| Identity status | **`provisional_formula_conflict`** |
| Directions status | `captured`, rinse test PASS („Nicht ausspülen") |
| Claims status | `present` (3 entries: 2× C2 repair, 1× C3 heat) |
| Fingerprint | `acb2659ab5068218f40c60aa550f49950dd25477f314dc6b4ca61600cc9ba21e` |

**Preserved conflict (G5).** A genuinely different US-market formula (Dicetyldimonium Chloride / Diheptyl Succinate /
Silk Amino Acids) circulates under GTIN 810006943405. The freeze additionally records that the INCI shown on the C2
manufacturer page **cantubeauty.de** matches that US variant, not the frozen DE pack. The conflict is preserved, not
merged; it affects the formula-source read, so confidence is lowered one step on every architecture-dependent
dimension and the record routes to review. It does **not** blank the record — the dominant architecture (LGN emulsion
with a rich lipid band) is unambiguous in the frozen DE list.

**Frozen claims consumed (§2.4 rule 3), with tiers as stamped:**
- C2 (cantubeauty.de, German-market manufacturer page): „Repariert geschädigtes Haar bis in die Haarspitzen";
  „Stärkt das Haar und verhindert Haarbruch" — both `creates_claim: true`.
- C3 (dm.de): „Zudem bietet sie einen Schutz vor Hitzeschäden, die durch das Styling entstehen können." —
  `creates_claim: false`. The C2 manufacturer page was actively checked and carries **no** heat claim.

## G0 — product-form gate

`in_category`. Aqua leads; directions state „Nicht ausspülen" explicitly (rinse test PASS); conditioning is primary.
The §2.3.2 architecture half is not established (HOLD = `none`), so `excluded_styling_first` does not arise.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **PHENOXYETHANOL, rank 28 of 51**. Above the tail = ranks 1–27.
The declared allergen block (Benzyl Salicylate, Citral, Coumarin, Hexyl Cinnamal, Limonene, Linalool) sits at ranks
37–42 and is therefore not the *first* marker. Leuconostoc/Radish Root Ferment Filtrate (15) is preservative-adjacent
but is not on the §3.1.1 enumeration and is not used as the marker.

**Late-marker limitation.** A marker at rank 28 of 51 makes the above/below test separate comparatively little of the
list. §3.1.1's limits 2 and 3 cover the *absent* and *very early* cases; **nothing in v0.3 covers a very late marker**,
which is the open gap at §17.18. Recorded on every anchor below that leans on it.

Above-tail, decision-relevant: Canola Oil (2, medium band) · Cetearyl Alcohol (3) · Glycerin (4) ·
**Behentrimonium Methosulfate (5)** · **Butyrospermum Parkii (Shea) Butter (6, rich band)** ·
**Olea Europaea Fruit Oil (7, rich band)** · Panthenol (16) · Sodium Hyaluronate (24) ·
Hydrogenated Ethylhexyl Olivate (25) · Hydrogenated Olive Oil Unsaponifiables (26).
Below-tail, decision-relevant: **Polyquaternium-10 (30)** · Cetrimonium Chloride (35) · Helianthus Annuus Seed Oil (44).

## Dimensions (§7)

### FORM — `emulsion` (`emulsion_subtype: lgn`, trace-only)
- `confidence` **moderate** (lowered one step for the formula-source conflict) · **E1/E2** · formula
- LGN pair present as architecture: Behentrimonium Methosulfate (5) + Cetearyl Alcohol (3), plus Glyceryl-type
  co-structure. Decision order: `anhydrous` no → `two_phase` no (a true emulsifying system is present) → `emulsion`.
- G9: this label may never set WT, in either direction.

### COND — `high`
- `confidence` **moderate** (ceiling moderately_high; lowered for the source conflict) · **E2** · formula
- (i) LGN pair above the tail — Cetearyl Alcohol (3) + Behentrimonium Methosulfate (5); (ii) a further independent
  lubrication route — the rich/medium emollient package: Canola Oil (2), Shea Butter (6), Olea Europaea Fruit Oil (7).
- `threshold_reasoning[]`: `moderate` applies only without a full LGN pair; the pair is present and above the marker.
- `counter_signals[]`: Polyquaternium-10 sits at rank 30, **below** the marker, and is therefore not counted as a
  further route (§3.1.1 clause 1); it is recorded, not used.

### SLIP — `high`, bias `unknown`
- `confidence` **moderate** · **E2** · formula
- Two independent M1 contributors as architecture: the cationic LGN route (3/5) and the rich/medium lipid package
  (2/6/7).
- Bias `unknown`: the load is a **non-film persistent lipid** plus a monomeric quat — the shape §17.16 records as
  having no matching bias value. Listed in `uncertain_fields`.
- FS-22 observed: no instrumental combing figure is quoted as a consumer-perceptible benefit.

### SFR — `moderate` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** · **E2** · formula
- `threshold_reasoning[]`: `high` requires a **continuous surface-film route** — a persistent silicone or a substantive
  cationic-polymer film. There is no silicone anywhere, and the only cationic polymer, Polyquaternium-10, is at rank 30,
  **below the marker**, so it is not present as architecture (§3.1.1 clause 1). The two-observation anchor is therefore
  not reached at its first half. `low` is excluded by the emollient package. → `moderate`, carried by one alignment
  route (the medium-band/ester emollients: Canola Oil 2, Hydrogenated Ethylhexyl Olivate 25).
- `counter_signals[]`: PQ-10 below the marker — a candidate film route the rank prong cannot place.

### WT — `high`
- `confidence` **moderately_high** · **E2** · formula
- **Both** prongs of the `high` anchor are independently satisfied: (i) an LGN pair present as architecture
  (Cetearyl Alcohol 3 + Behentrimonium Methosulfate 5); (ii) two or more persistent non-volatile families with at
  least one **enumerated rich/low-spreading band member** — Butyrospermum Parkii (Shea) Butter (6) and
  Olea Europaea Fruit Oil (7), both enumerated in the L3 rich band, alongside the medium-band Canola Oil (2).
- Ceiling: FORM resolves to a definite architecture and the non-volatile architecture is readable above the tail, so
  confidence may rise to `moderately_high`; the late-marker limitation is recorded against it.
- **§10.1.2 weight conflict tag — declined, condition named.** Condition 1 is satisfied. **Condition 2 fails:** the two
  C2 statements are repair claims („Repariert geschädigtes Haar…", „Stärkt das Haar…"); the page's other line
  („Spendet intensive Feuchtigkeit dank Sheabutter") is a benefit statement, not a statement about **the finish this
  product leaves**. A statement about hair type, benefit or scent that is not about weight or finish does not trigger
  the tag. `weight_potential` projects `high`.
- **Transfer caution attached (qualitative):** a low-spreading, non-volatile, non-film-forming lipid load is present
  (shea butter, olive oil). No published instrumental transfer method for hair leave-ons exists (§17.3), so this is a
  caution, never a scored dimension.

### PERS — `neutral_non_volatile` (projects `moderate`)
- `confidence` **moderate** (ceiling cap) · **E2** · formula
- `threshold_reasoning[]`: `permanent_cationic` would be reached by Polyquaternium-10 — enumerated by INCI name — but
  it sits at **rank 30, below the marker at rank 28**, so the rank prong does not place it as architecture and it
  cannot set the class (§3.1.1 clauses 1 and 3). `ph_dependent_cationic` requires an amino silicone or amidoamine; none.
  The highest class present as architecture is the neutral non-volatile lipid deposit plus Behentrimonium Methosulfate.
- **Mandatory monomeric-quat note (§7.6):** persistence rests in part on Behentrimonium Methosulfate, a monomeric
  long-chain quat — permanently charged, so more substantive than a neutral deposit, but small-molecule and
  surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not a
  duration (G11).
- **Below-marker counter-signal (§3.1.1 clause 3):** Polyquaternium-10, rank 30; marker Phenoxyethanol, rank 28. The
  known error direction is that strict rank **under-states** persistence here and therefore under-warns on buildup
  (FS-20). That risk is carried to a human by the review route, not into the projected field.
- FS-12 observed: no amodimethicone selectivity argument is used. FS-3/FS-20 observed: silicone-free plus a cationic
  polymer is not read as low buildup.

### HOLD — `none`
- `confidence` **moderately_high** · **E1**. No fixative-class L5 polymer is declared.

### HEAT — trace `not_claimed` · binary `provides_heat_protection: false` · **`claim_authority_gap`**
- `confidence` **high** · **E0/E1**
- The only heat statement is **C3** (dm.de) and the freeze records `creates_claim: false`; the **C2 manufacturer page
  was actively checked and makes no heat claim at all**. Retailer copy never creates a claim (§2.4.1, G13). →
  `not_claimed`, binary **`false`** per §13.3 rule 1.
- `counter_signals[]`: the C3 text „Zudem bietet sie einen Schutz vor Hitzeschäden…" recorded verbatim with its tier.
- **Routes to review under `claim_authority_gap`** (§13.3 rule 1, §14) so a human decides whether the manufacturer
  source was simply not found — here it was found and is silent, which is the stronger negative, and the review should
  record that.
- No L9 member is present at any rank, so the sanity-check adds nothing.

### HUM — `not_claimed`
- `confidence` **high** · **E0**. No humidity or anti-frizz claim at any tier. §7.9 clause 3 is not engaged — there is
  no hydrophobic continuous film route (no silicone, no hydrophobic fixative).

### R2 — `none_visible`
- `confidence` **moderately_high** · **E1** · formula
- No cationised protein, no silane derivative, no silicone quat at any rank. **No hydrolysed protein of any kind is
  declared**, so the plain-hydrolysate note does not arise and no `candidate_below_tail` note applies.
- `counter_signals[]`: two **C2 repair claims** exist. §7.10 is a formula dimension; a claim cannot set it, and no
  route is visible. Recorded so the record does not read as if the claims were missed.
- Never converts into structural repair, penetration or strength (FS-5, FS-19).

### DOSE — `high` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- WT `high` **and** a rich/low-spreading band member present as architecture — both `high` rows fire. FORM contributes
  no value (v0.3 change 18) and attaches no `two_phase` variability note.

### EXPO — `aromatic_or_allergen_exposure`
- `confidence` **high** · **E1** · formula
- Parfum (27) plus a declared allergen block: Benzyl Salicylate, Citral, Coumarin, Hexyl Cinnamal, Limonene, Linalool
  (37–42). Tetramethyl Acetyloctahydronaphthalenes (51) is a further aromatic.
- **No alcohol note.** Benzyl Alcohol (36) is declared as a preservative/allergen and is **outside** the
  `Alcohol Denat.` / `Alcohol` enumeration that §7.12 keys on; §17.21 records exactly this coverage gap. The
  observation is recorded and no note is emitted — the enumeration is not silently widened.

### ROLE — `unknown` (`usage_role: []`)
- `confidence` **low** · **E1 observation held below authority** · directions
- The captured directions are **C3** (dm.de, exact-GTIN German retailer). Cantu is a third-party brand, so the
  house-brand clause does **not** apply — dm.de's page for a third-party brand remains C3 (§2.4.1 rule 6, final
  sentence). §7.13 rule 1: role values may be read **only** from C1/C2 directions; retailer application copy
  corroborates but never creates a role. → `usage_role: []`, `usage_role` in `uncertain_fields`.
- `supporting_signals[]`: the full C3 direction text is recorded with its tier — „Großzügig und gleichmäßig auf die
  feuchten Haarspitzen auftragen…", „Nicht ausspülen.", „…über Nacht unter einer Haube einziehen lassen.",
  „Für das anschließende Styling … die Coconut Curling Cream oder die Moisturizing Curl Activator Cream verwenden."
- **This is open gap §17.23**: directions that exist, are verified and are plainly pack-derived, but sit below C1/C2
  authority, have no routing rule of their own. Named here rather than resolved.
- Note the cost: the rinse test still ran on this text and passed (§2.4 rule 2 is about the *exclusion* test, which is
  not authority-gated); only the **role assignment** is withheld.

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only |
| CURL | not derived | §17.20; and `curl_definition` fails its §10.2 negative gate — the curl language sits in C3 directions, not C1/C2 positioning |
| R3 | **`none`** | No C1/C2 **bond** claim (the C2 claims are repair claims, not bond claims) and no recognised bond chemistry in the formula. No German string |
| LAYER | not emitted | |
| Buildup caution | not emitted | `persistence` projects `moderate` |

## `care_direction` — `moisture`
- `confidence` **moderate** · **E2** · formula
- R2 `none_visible` ⇒ `protein`/`balanced` unreachable. Not silicone-led. L1 (Behentrimonium Methosulfate + Cetearyl
  Alcohol), L3 (canola, shea, olive) and L4 (Glycerin 4) all present as architecture ⇒ `moisture`.
- `counter_signals[]` (§9 constraint 3): the product is positioned on repair at C2. **Marketing direction never sets
  the value**; the architecture is an emollient/cationic moisture direction with no protein-film route.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `high` was established by the LGN pair (3/5) **and** the rich/medium
emollient package (2/6/7).

| Route | Verdict |
|---|---|
| `repair` | **Not available.** R2 = `none_visible`. Positioning prong: the C2 page names „Sheabutter und natürlichen Ölen" as the actives — **oils and butter are explicitly excluded** by the row ("Generic silicone, oil, panthenol, ceramide, a non-silicone cationic polymer or generic repair naming cannot set it"), and „Repariert geschädigtes Haar" is generic repair naming. No protein or silane active is named |
| `smoothing` | Not available. SFR is `moderate`, not `high` — there is no continuous film route above the marker |
| `curl_definition` | Not available. HOLD = `none`. The negative gate also fails: the curl references are C3 directions, not C1/C2 curl/wave positioning |
| `heat_styling` | Not available. HEAT = `not_claimed`, and ROLE is empty |
| `detangling` | Not available. No C1/C2 detangler positioning; prong 2 requires WT `low` |
| `volume_lightness` | Not available. WT is `high` |
| `shine` | Not available. Would restate the emollient alignment |

**No qualifying route ⇒ `focus.primary: general`**, `secondary: []`.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "high",
  "weight_potential": "high",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "avoid",
  "uncertain_fields": ["usage_role", "slip_bias"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: high` (row 3); fine `caution` carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2**. Row 3a needs COND `high` **plus** a qualifying specialist route — a distinct L6 substantive
  film route or an exact-product test; generic oil, butter, panthenol and repair naming do not qualify. Row 3b needs
  R2 ∈ {candidate, tested}. Neither path opens, which is the honest result for a rich cream sold on repair whose
  formula shows no repair route.
- `texture_fit` ← **row 3**: WT `high` **and** SLIP `high`.
- `scalp_application_fit` ← **`avoid`**: the **architecture trigger** fires on its own — WT `high` with rich/
  low-spreading band members present as architecture (shea 6, olive 7). This trigger is unchanged in v0.3 and does not
  depend on the narrowed fragrance rule. Directions cannot be consulted for a positive value in any case (C3).

## German cautions (§18)

| Emitted by | String |
|---|---|
| WT = `high` | „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren." |
| DOSE = `high` | „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig." |
| `scalp_application_fit = avoid` | „Nicht für die Kopfhaut gedacht – bitte nur in die Längen und Spitzen geben." |
| `usage_role` unknown | „Dazu haben wir keine belastbare Information." |

**No heat string is emitted.** „… ist ausgelobt" requires C1/C2 authority (§18, G13), and the heat statement is C3.
This is the R12 mechanism working as intended: the user is told nothing about heat protection for this product.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| Formula-source / identity conflict | `provisional_formula_conflict` — DE vs US variant; the C2 page shows the US list |
| `claim_authority_gap` | Heat claim found only at C3; C2 checked and silent (§13.3 rule 1) |
| Below-marker persistence route | Polyquaternium-10 at rank 30 vs marker at rank 28 (§3.1.1 clause 3) |
| Directions below C1/C2 authority | `usage_role` empty; open gap §17.23 |
| Very late tail marker | Rank 28 of 51 — §17.18, uncovered by §3.1.1's limits |
| `scalp_application_fit = avoid` | Most restrictive placement value |

`review_status`: `provisional` → routed. `out_of_category`: false.
