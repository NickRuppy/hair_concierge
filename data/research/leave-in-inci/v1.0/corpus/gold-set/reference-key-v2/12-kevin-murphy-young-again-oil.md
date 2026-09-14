# S12 — Kevin Murphy Young.Again Oil

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 12 · 100 ml · GTIN **unresolved** (9339341020356 / 9339341001744) · `formulaFingerprintSha256` a88d2f48…46a8

> ## G0 = `excluded_anhydrous` · `out_of_category: true`
> **This record is emitted under the §2.3.1 excluded-product emission contract.** It carries the identity block, the G0 state and rationale, the explicit `out_of_category` flag, the formula record, and its review status — **and nothing else**. There is **no lean matching profile**: no `focus`, no fit fields, no `specialist_functions`, no `care_direction`, no cautions. Downstream consumers must treat "no lean profile present" as the machine-readable signal of exclusion; **the absence of fit fields is the contract, not an omission.**

---

## 1. Identity block (§2.4) — complete, as the contract requires

| Item | Value |
|---|---|
| Brand / product | Kevin Murphy · Young.Again Oil |
| Market | DE |
| Pack size | 100 ml |
| Identifier | **Unresolved.** 9339341020356 (single source, origin not re-traced) vs 9339341001744 (upcitemdb + idealo.co.uk). Both recorded; not merged, not guessed. Documented identity-research gap |
| Identity status | `provisional_formula_conflict` |
| Formula source | Original lane report (T3 + 2× T2 German retailers, verbatim text held in an unavailable file) plus a new T3 search-cached capture this pass, 2026-09-03 |
| Directions status | `captured` |
| Directions verbatim | "APPLY. INFUSE. DRY. Apply YOUNG.AGAIN to freshly washed hair and before any styling products. Once dried, you can apply a small amount of YOUNG.AGAIN to dry hair to increase the smoothness of the hair and remove any flyaway strands." |
| Directions authority | **C5** — kevinmurphy.com.au, an Australian-region page, English-language. §2.4.1 rule 3 and lane convention RC-2: a non-German-market manufacturer page creates neither a claim nor a role |
| Rinse test (R11) | **PASS** — no rinse, wash-out or contact-time-then-rinse instruction. The directions describe genuine leave-on use |

### Preserved source conflicts (G5) — all four, preserved rather than resolved by preference

1. **GTIN unresolved** — two candidates as above.
2. **EU/US formula divergence** — the capture available to this pass is the international/US listing and contains **HICC (Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde)**, an EU-restricted fragrance allergen; the original lane report states that both German retailer lists it consulted omit HICC. A clean DE-market verbatim string could not be independently reproduced. The raw INCI in the packet is **explicitly not claimed as DE-safe**.
3. **Ingredient-position variance** — this capture places Water (Aqua) at position **23**; the original lane report describes it at "~pos. 15". **Both readings agree on the architecture**, which is the only thing G0 needs.
4. **Token-level uncertainty** — one ingredient returned as "Vinyl Butyl Ether" in one extraction and "Vanillyl Butyl Ether" in another; the latter was selected as far more chemically plausible, and the discrepancy is unresolved against a primary page.

## 2. Formula record

Raw INCI and the normalized fingerprint are carried unchanged from the packet (`rawInciSha256` 76af4a98…02d3, `formulaFingerprintSha256` a88d2f48…46a8). The architecture-relevant head of the list:

| Rank | INCI |
|---|---|
| 1 | Cyclopentasiloxane |
| 2 | Dimethicone |
| 3 | Dimethiconol |
| 4 | Bis-Cetearyl Amodimethicone |
| 5–15 | botanical extracts, safflower seed oil, hydrolyzed soy protein, hexapeptide-11 |
| 16 | Cyclohexasiloxane |
| 17 | Glycerin |
| 18 | Cetearyl Alcohol |
| 21 | Quaternium-91 |
| **23** | **Water (Aqua)** |
| 24 | Behentrimonium Chloride |

## 3. `g0_state` and `g0_rationale`

**`g0_state: excluded_anhydrous`.**

**Rationale.** The G0 anchor is: *"No Aqua, or **Aqua absent from the top of the list**; cyclomethicone/dimethicone/oils lead → oil/serum category (SR §A.1)."* Water (Aqua) is declared at **rank 23 of 36**, behind four silicones, eleven botanicals and a vegetable oil; the four leading positions are Cyclopentasiloxane, Dimethicone, Dimethiconol and Bis-Cetearyl Amodimethicone. The variance between this capture (rank 23) and the original lane report (~rank 15) is immaterial: **both place Aqua far outside the top of the list**, and both readings agree the architecture is silicone-leading / anhydrous-serum-like. FORM row `anhydrous_serum_or_oil` matches at the first step of the §7.1 decision order, and that row is out of category by definition.

**The trap this slot exists to test, and how G0 handled it.** The captured directions describe unambiguous leave-on use — applied to freshly washed hair before styling, and re-applied to dry hair. §2.3's first named trap is exactly this: *"'Serum' is a marketing word, not an architecture. A water-based product called a serum may remain in-category once the formula is verified; **an anhydrous one leaves regardless of what the label says.**"* G0 classifies by function + authoritative directions + **formula architecture**, and the architecture decides this row. Leave-on usage does not convert a silicone-leading anhydrous system into a leave-in; it routes to the oil/serum category, where its own standard applies.

Two further points, recorded so the exclusion is auditable rather than mechanical:

- **This is not a `provisional_boundary`.** That state is for genuine ambiguity, and there is none about the architecture — four silicones lead and Aqua is twenty-two positions behind the first. A `provisional_boundary` record would stay in-category and keep its lean profile; this one does neither.
- **The `excluded_styling_first` and `excluded_other_form` rows were tested and do not apply.** No L5 fixative-class polymer leads the list, and the directions carry no rinse instruction.

## 4. `out_of_category: true`

Explicit, as the contract requires.

## 5. §7 dimensions — deliberately not emitted

§2.3.1 makes §7 dimensions **optional** on an excluded record, and requires that any that are emitted be marked `informational_and_non_authoritative: true` and never used as inputs to matching, comparison or copy. This lane emits **one** informational observation and no others:

```jsonc
{
  "FORM": {
    "value": "anhydrous_serum_or_oil",
    "confidence": "high",
    "evidence_level": "E1",
    "informational_and_non_authoritative": true,
    "rationale": "Aqua at rank 23 of 36 behind four silicones; the row that triggered the G0 exclusion."
  }
}
```

Nothing else is emitted. COND, SLIP, SFR, WT, PERS, HOLD, HEAT, HUM, R2, DOSE, EXPO, ROLE, the §8 demoted flags and `care_direction` are **absent by decision, not by oversight**: a full dimension set on an out-of-category record invites exactly the downstream reuse the contract forbids, and the leave-on category's science does not govern an anhydrous silicone serum in any case. The boundary case remains reusable through the identity block, the formula record and this rationale.

## 6. Lean matching profile — **not emitted at all**

Per §2.3.1: no `focus`, no `hair_thickness_fit`, no `damage_fit`, no `texture_fit`, no `scalp_application_fit`, no `specialist_functions` (so **no `provides_heat_protection` and no `humidity_resistance`**), no `care_direction`, no cautions, no `uncertain_fields`.

No claim capture was performed for this record. Under §2.4.1 a claim would be relevant only to fields this record does not emit, and performing it would imply a profile that does not exist.

## 7. `review_status: provisional` and review routing (§14)

1. **G0 boundary case** — an exclusion applied to a product whose captured directions describe leave-on use. Every boundary decision of this kind is worth a human eye, and the standard retains such records as stress cases (§16).
2. **Identity conflict** — GTIN unresolved, two candidates (§14).
3. **Formula-source conflict** — no DE-market-specific (HICC-free) verbatim INCI could be reproduced this pass; the captured string is the international/US variant and is explicitly not claimed as DE-safe (§14).
4. **Token-level uncertainty** — Vanillyl vs Vinyl Butyl Ether, unresolved against a primary page.

## 8. What this record contributes to round 2

The v0.2 change under test here is **rule change 29, the §2.3.1 emission contract** — v0.1 said excluded products "do not classify" in §2.3 while §16 said such a product "retains its record as a boundary stress case", and the two lanes read that differently. The contract now fixes exactly what an excluded record contains. This record follows it literally: identity + G0 + `out_of_category` + formula + one informational FORM observation + review status, and **no lean profile**. If the round-2 diff shows the lanes agreeing on the G0 state but disagreeing on *what was emitted*, the defect is in §2.3.1's optionality of §7 dimensions — the only remaining degree of freedom the contract leaves open.
