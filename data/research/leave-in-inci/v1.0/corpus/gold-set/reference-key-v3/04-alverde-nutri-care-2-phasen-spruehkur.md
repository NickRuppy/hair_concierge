# Slot 4 — alverde NATURKOSMETIK Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Two-phase spray

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | alverde NATURKOSMETIK — Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan |
| Pack / market | 75 ml · DE |
| GTIN | 4066447105032 |
| Formula source | 3 independent T3 aggregators in exact agreement; dm.de URL confirms the GTIN |
| Identity status | **`provisional_identity_conflict`** |
| Directions status | `captured` (archived dm.de capture), rinse test PASS |
| Claims status | `none_found_at_C1_C2`, with a **freshness caveat** |
| Fingerprint | `146560146b739a07dd6bb7a265b5e5f0e3541b4fad193be5050320cc62ba7840` |

**Claim-tier correction (§2.4.1 rule 6).** alverde is dm's own private label, so **dm.de is C2** for this product's
directions and claims. `claim_tier_basis: house_brand`; routes to review.

**Identity gap preserved (G5).** The exact dm.de product URL 404s on a fresh fetch and dm.de's live on-site search no
longer surfaces this SKU; the product may be delisted. The INCI content itself is strongly corroborated (three
independent aggregators, exact match). Current-market availability under this GTIN is in doubt — routed to review as
an absent exact-market identifier (§14).

**Frozen claims consumed (§2.4 rule 3).** `claims[] = []`. The archived C2 text — „Für sofortige Haarpflege";
„Verbessert die Kämmbarkeit"; „Entwirrt und bändigt das Haar spürbar"; „umhüllt die Haaroberfläche mit einem
samtweichen Gefühl" — contains **no** heat, humidity/anti-frizz, lightness/finish, repair/bond or curl claim. The
freeze records that the archived capture could **not be re-verified live** this pass (Wayback offline). Because the
C1/C2 search could not be completed to a current source, §2.4 rule 2 applies and the record routes to review as
**`claim_authority_gap`** — "not captured" and "does not exist" must not be collapsed.

## G0 — product-form gate

`in_category`. Aqua leads; the C2 directions spray the product into the lengths and ends with no rinse instruction
(rinse test PASS); conditioning is primary. No exclusion row fires — the product is aqueous-led and HOLD is `none`.

## Reading conventions

**Tail marker (§3.1.1):** **no preservative is declared at all** in this formula (the system is alcohol-based). The
first concentration-capped ingredient under the enumeration is therefore **the declared EU fragrance-allergen block,
beginning at LINALOOL, rank 14**. Above the tail = ranks 1–13.

This is a weaker marker than a preservative and is recorded as such: the allergen block is enumerated in §3.1.1, so
`tail_marker: none_visible` (limit 2) is **not** invoked — but the reading is named so it can be diffed, and the
absence of any preservative marker is carried as a limitation on every anchor below.

Above-tail architecture: Aqua (1) · **Glycine Soja Oil (2)** · Alcohol (3) · Glycerin (4) · Sodium Lactate (5) ·
Betaine (6) · **Argania Spinosa Kernel Oil (7)** · Prunus Amygdalus Dulcis Seed Extract (8) ·
Hippophae Rhamnoides Fruit Extract (9) · Caprylyl/Capryl Glucoside (10) · Tocopheryl Acetate (11) ·
Sodium Phytate (12) · Parfum (13).

## Dimensions (§7)

### FORM — `two_phase`
- `confidence` **moderately_high** · **E1/E2** · formula
- Decision order: `anhydrous` no (Aqua rank 1) → **`two_phase` matched**.
- `formula_observations[]`: an unemulsified architecture — a water phase plus an oil phase present as architecture
  (Glycine Soja Oil 2, Argania Spinosa Kernel Oil 7) with **no true emulsifier** and **no solubiliser package**. The
  single mild nonionic surfactant, Caprylyl/Capryl Glucoside (10), is not on the §7.1 solubiliser enumeration
  (PEG-esters, PEG-hydrogenated castor oils, polysorbates, Trideceth-x, Laureth-x, PPG-x-Buteth-x) and one low-ranked
  glucoside is not a package capable of carrying two bulk oils.
- `threshold_reasoning[]`: decidable from architecture alone. The direction „Bitte vor Gebrauch schütteln!" and the
  product's own „2-Phasen" name **corroborate** and decide nothing (G0: never classify by name).
- G9: the form label may never set WT. It legitimately carries a **dose-variability** statement and nothing more.

### COND — `moderate`
- `confidence` **moderate** (ceiling moderately_high) · **E2** · formula
- One coherent conditioning route: a persistent emollient package above the tail — Glycine Soja Oil (2) and
  Argania Spinosa Kernel Oil (7), both read **medium band** by the §7.5 convention for unenumerated liquid vegetable
  oils.
- `threshold_reasoning[]`: `high` needs an LGN pair — there is **no cationic surfactant in the formula at all**, so the
  pair cannot exist. `low` needs no persistent non-volatile above the tail; two are present. → `moderate`.

### SLIP — `moderate`, bias `unknown`
- `confidence` **moderate** · **E2** · formula
- One M1 route (the lipid package). No cationic species and no persistent silicone anywhere. → `moderate`.
- Bias `unknown`: a non-film persistent lipid load in an alcohol/water carrier matches neither `wet_biased` (which
  requires no persistent film in a water/volatile-dominant architecture) nor `dry_biased` (which requires a persistent
  film). §17.16.

### SFR — `moderate` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** · **E2** · formula
- No continuous surface-film route exists (no persistent silicone, no substantive cationic polymer), so the §7.4
  two-observation `high` anchor is unreachable at its first half. `low` is excluded by the medium-band emollient
  package. → `moderate`.

### WT — `moderate`
- `confidence` **moderate** · **E2** · formula
- `formula_observations[]`: **exactly one** persistent non-volatile family present as architecture — medium-band
  liquid vegetable oil, represented twice (Glycine Soja Oil 2, Argania Spinosa Kernel Oil 7). Family is read as
  spreading band/class, so two members of the same band are one family.
- `threshold_reasoning[]`: `high` needs an LGN pair (absent, no cationic surfactant) **or** ≥2 persistent families with
  a rich/low-spreading band member — soy and argan are both **unenumerated liquid vegetable oils**, read in the
  **medium** band by the §7.5 closed-enumeration convention, so the rich-band test fails. `low` needs no persistent
  non-volatile family above the tail; two bulk oils are present, one at rank 2. → `moderate`.
- `counter_signals[]`: the alternative reading that soy and argan are two families lands on the **multi-family
  `moderate` row** — the same value. The value is robust to the family-count question; the counter-signal is recorded
  so the reading is diffable. Also recorded: no preservative marker exists, so the above/below boundary rests on the
  allergen block alone.
- **§10.1.2 weight conflict tag:** not applicable — condition 1 fails (WT is not `high`). No candidate C1/C2
  intended-finish statement exists in any case.
- **G9 clause 1 (as corrected in v0.3):** a bulk oil above the tail in an unemulsified system is a **strong supporting
  observation, recorded as one** in `supporting_signals[]` with its rank — it does **not** by itself satisfy the `high`
  anchor. The v0.2 wording that read as a second route to `high` is not applied.
- Transfer caution: **not** attached — both oils are medium-band, not low-spreading rich-band members.

### PERS — `neutral_non_volatile` (projects `moderate`)
- `confidence` **moderate** · **E2** · formula
- No quat of any kind, no silicone. The highest class present as architecture is the neutral non-volatile oil deposit
  (2, 7). `volatile_or_water_soluble` is excluded — that row is for volatiles and humectants only, and two bulk
  vegetable oils are neither. Alcohol (3) is volatile and contributes nothing to persistence (M6).
- G11: no duration, wash count or clarification schedule.

### HOLD — `none`
- `confidence` **moderately_high** · **E1**. No fixative-class L5 polymer is declared.

### HEAT — trace `not_claimed` · binary `provides_heat_protection: false` · **`claim_authority_gap`**
- `confidence` **moderate** (lowered for the unverifiable C2 capture) · **E0/E1**
- §13.2 row 1: no C1/C2 heat claim in the frozen capture, and **no L9 member** at any rank. Binary `false`.
- Routes to review under `claim_authority_gap` because the C1/C2 search could not be completed against a **current**
  source (the SKU appears delisted and the archive was unavailable), not because retailer copy was found.

### HUM — `not_claimed`
- `confidence` **moderate** · **E0**. No humidity or anti-frizz claim in the frozen capture. §7.9 clause 3 is not
  engaged — there is no hydrophobic continuous film route. Humectants (Glycerin 4, Sodium Lactate 5, Betaine 6) are a
  counter-signal for humidity, never support (FS-15); no dew-point threshold is encoded (FS-16).

### R2 — `none_visible`
- `confidence` **moderately_high** · **E1**. No cationised protein, silane derivative or silicone quat at any rank;
  no hydrolysed protein of any kind is declared, so no plain-hydrolysate note and no `candidate_below_tail` note.

### DOSE — `moderate` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- WT `moderate` ⇒ DOSE `moderate`. No rich/low-spreading band member is present as architecture, so the `high` row does
  not fire.
- **Mandatory `two_phase` dose-variability note (v0.3 change 18):** shake quality changes the delivered oil:water ratio
  per actuation and that variability is unmeasured (§17.9). This is a statement about **variability**, not magnitude —
  a two-phase spray whose WT reads `moderate` is dose-variable at a `moderate` residue level, and encoding it as DOSE
  `high` would overstate the residue. Carries the §18 shake caution and the §14 two-phase review trigger.

### EXPO — `aromatic_or_allergen_exposure` (+ alcohol note)
- `confidence` **high** · **E1** · formula
- Parfum (13) plus a declared allergen block: Linalool (14), Limonene (15), Coumarin (16).
- `notes[]`: **Alcohol materially present at rank 3** → alcohol exposure note emitted.
- Exposure statement only; no tolerance prediction (§7.12, G6).

### ROLE — `[post_wash, refresh, ends_only]`
- `confidence` **moderate** · **E1** · directions · tier **C2 (house_brand)**
- `ends_only` ← „Je nach Bedarf aus ca. 30 cm Entfernung in die Haarlängen und -spitzen sprühen."
- `post_wash` ← „Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden." (damp half).
- `refresh` ← same sentence, dry half; the same permissive-sentence reading as slot 1 is applied and named
  (carried-open item, blind A11).
- „HINWEIS: Bitte vor Gebrauch schütteln!" is a handling instruction and establishes **no** role (§7.13).
- Not emitted: `heat_styling` (no named tool, no `pre_heat` stage), `curl_styling`.

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only |
| CURL | not derived | §17.20; `curl_definition` also fails HOLD and the negative gate |
| R3 | **`none`** | Researched, negative. No German string |
| LAYER | not emitted | |
| Buildup caution | not emitted | `persistence` projects `moderate` |

## `care_direction` — `moisture`
- `confidence` **moderate** · **E2** · formula
- R2 `none_visible` ⇒ `protein`/`balanced` unreachable. Not silicone-led (no silicone). L3 (soy, argan) and L4
  (Glycerin 4, Sodium Lactate 5, Betaine 6) both present as architecture ⇒ `moisture`.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `moderate` was established by the medium-band oil package (2, 7).

| Route | Verdict |
|---|---|
| `repair` | Not available. R2 = `none_visible`; no protein or silane active in any C1/C2 marketing position (`claims[]` is empty) |
| `smoothing` | Not available. SFR is `moderate`; no continuous film route exists |
| `curl_definition` | Not available. HOLD = `none`; the negative gate also fails |
| `heat_styling` | Not available. HEAT = `not_claimed` |
| `detangling` | Not available. Prong 1: the archived C2 copy does say „Verbessert die Kämmbarkeit" / „Entwirrt und bändigt das Haar spürbar", but the product is positioned as a Nutri-Care **Sprühkur** — detangling is one benefit among several, not detangling-**led** positioning of the kind the row names („Leichtkämmspray", „Entwirrungsspray"). Prong 2 requires WT `low`; WT is `moderate`. Recorded as the closest near-miss on this slot |
| `volume_lightness` | Not available. Requires WT `low` |
| `shine` | Not available |

**No qualifying route ⇒ `focus.primary: general`**, `secondary: []`.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "two_phase",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["post_wash", "refresh", "ends_only"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "uncertain_fields": ["slip_bias"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: moderate` (row 2); fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← row 2 (COND `moderate`, no qualifying repair route).
- `texture_fit` ← row 2 (WT `moderate`, any slip).
- `scalp_application_fit` ← **`avoid`**, two independent triggers, either sufficient: (i) an **oil-led two-phase load**
  — `FORM = two_phase` with Glycine Soja Oil at rank 2, above the marker; (ii) a **scalp-relevant irritant load** under
  the narrowed v0.3 trigger — `aromatic_or_allergen_exposure` **plus** a materially present `Alcohol` note (rank 3).
  The directions' ends-only placement would give `conditional`, but `avoid` is tested first.

## German cautions (§18)

| Emitted by | String |
|---|---|
| FORM = `two_phase` | „Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark." |
| EXPO alcohol note | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben." |
| `scalp_application_fit = avoid` | „Nicht für die Kopfhaut gedacht – bitte nur in die Längen und Spitzen geben." |

## Review routing (§14)

| Trigger | Basis |
|---|---|
| Two-phase product | Least dose-predictable form (SR §M.9) |
| Absent exact-market identifier | SKU appears delisted at dm.de; URL 404s; `provisional_identity_conflict` |
| `claim_authority_gap` | The C1/C2 claim search could not be completed against a current source (§2.4 rule 2) |
| `claim_tier_basis: house_brand` | dm ↔ alverde (§2.4.1 rule 6) |
| Tail marker rests on the allergen block only | No preservative is declared; recorded rather than treated as `none_visible` |
| `scalp_application_fit = avoid` | Most restrictive placement value |

`review_status`: `provisional` → routed. `out_of_category`: false.
