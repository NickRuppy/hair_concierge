# Slot 12 — Kevin Murphy Young.Again Oil

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Boundary / source-conflict

> **G0 verdict: `excluded_anhydrous`.** This record is emitted under the §2.3.1 exclusion contract: identity, G0 state
> and rationale, `out_of_category: true`, the formula record, and **§7 dimensions marked
> `informational_and_non_authoritative: true`**. **No lean matching profile is emitted** — no `focus`, no fit fields,
> no `specialist_functions`, no cautions.

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Kevin Murphy — Young.Again Oil |
| Pack / market | 100 ml · DE |
| GTIN | **unresolved** — 9339341020356 (single source) vs 9339341001744 (multiply corroborated) |
| Formula source | T3 search-cached international/US listing this pass; the DE-safe capture lives in an unavailable lane report |
| Identity status | **`provisional_formula_conflict`** |
| Directions status | `captured` (English, Australian-region manufacturer page), rinse test PASS |
| Claims status | `present` (2 entries, both **`creates_claim: false`**) |
| Fingerprint | `a88d2f48fc6ad274159cc192e0386a260da0b15a1db37b74096d5eed130446c8` |

**Claim and directions authority (§2.4.1 rule 3, as governing in v0.3).** The packet stamps kevinmurphy.at as
"C2-equivalent (judgment)" and flags it. **Rule 3 governs and this lane does not adopt that stamp:** kevinmurphy.at is
the brand's **Austrian** site — German-language, EU, brand-owned, but **not addressed to the German market**. Rule 3 is
explicit that non-German EU pages are **C5**, and that the resolution is in rule 3's favour as the conservative
reading; the C2 row is worded to match ("manufacturer's **German-market** product page"). The packet also establishes
that kevinmurphy.de merely redirects to the Australian/global site. ⇒ **No C1/C2 source exists for this product.**

**Frozen claims consumed (§2.4 rule 3), all recorded, none creating:**
- C5 (kevinmurphy.at, German, Austrian market), heat_protection: „Verwende es täglich, um trockenem, geschädigtem und
  brüchigem Haar den Kampf anzusagen und deine Haarlängen vor Umwelteinflüssen und **Hitzeschäden** zu schützen." —
  general heat-damage statement, **no °C figure**.
- C5 (same page), finish_weight: „YOUNG.AGAIN ist ein **schwereloses** Haaröl, das nicht fettet".
- C5 (kevinmurphy.com.au, English): „heat protection up to 200 °F / 93 °C" — recorded, not entered.

**Preserved conflicts (G5), four of them, all unresolved:** GTIN; EU/US formula divergence (this capture contains HICC,
which the German retailer lists reportedly omit); token spelling („Vanillyl" vs „Vinyl" Butyl Ether); and ingredient
position (Water at rank 23 here vs "~pos. 15" in the original lane report). **All four route this record to review.**

## G0 — product-form gate → `excluded_anhydrous`

| Test | Observation |
|---|---|
| Aqua position | **Water (Aqua) at rank 23 of 36.** Aqua is absent from the top of the list under either capture (the alternative places it at ~15, still mid-list) |
| Leading species | **Cyclopentasiloxane (1) · Dimethicone (2) · Dimethiconol (3) · Bis-Cetearyl Amodimethicone (4)** — a cyclomethicone/dimethicone-led anhydrous silicone serum architecture |

`excluded_anhydrous` fires on its own terms: *"No Aqua, or Aqua absent from the top of the list;
cyclomethicone/dimethicone/oils lead → oil/serum category."* The boundary table routes pure oils and anhydrous silicone
serums to the oil/serum category.

**§2.3 trap 1 governs the leave-on directions.** *"'Serum' is a marketing word, not an architecture… an anhydrous one
leaves regardless of what the label says."* The directions genuinely describe leave-on use (freshly washed hair, before
styling, reapplied to dry hair) and the rinse test passes — and that changes nothing: the exclusion row is about
architecture, and the boundary table excludes anhydrous silicone serums irrespective of how they are used.

**Why not `provisional_boundary`.** §2.3.2 clause 4 reserves that state for genuine evidence conflicts — a formula
conflict that makes the **conditioning architecture unreadable**, or two C1/C2 sources disagreeing. This record does
carry a formula-source conflict, but **both captures agree that the architecture is silicone-leading /
anhydrous-serum-like**; the position variance moves Water between rank 15 and rank 23 and never to the top. The
architecture is readable and unambiguous, so the conflict does not reach the state. There are also no two C1/C2 sources
to disagree, since none exists. `provisional_boundary` "is never the destination for a decision the reviewer merely
found uncomfortable."

**Regulatory note (§15, G12).** Cyclopentasiloxane (1) and Cyclohexasiloxane (16) lead this formula. Commission
Regulation (EU) 2024/1328 extends the D4/D5/D6 0.1 % w/w limit to **leave-on** cosmetics from **6 June 2027**. Any
observation keyed on "Cyclopentasiloxane present" is a **short-lived** one; the reading here keys on **function** — a
volatile carrier is present, with the INCI family enumerated — per G12 and FS-21. `regulatory_re_review_trigger:
2027-06-06` applies to this record.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **PHENOXYETHANOL, rank 29 of 36**. Above the tail = ranks 1–28.
A marker this late separates almost nothing (§17.18); recorded, and confidence is held low on every informational
dimension that leans on it.

## §7 dimensions — `informational_and_non_authoritative: true`

These exist only to make the boundary case reusable as a stress case. **They are never inputs to matching, comparison
or copy** (§2.3.1). The full §7 set is emitted as this lane's stated convention for excluded records; §2.3.1 leaves the
subset optional and §17.24 records that as an open gap.

| Dim | Value | Confidence | Basis |
|---|---|---|---|
| **FORM** | **`anhydrous_serum_or_oil`** | moderately_high | The G0-deciding read. Decision order stops at row 1: no leading Aqua → out of category |
| COND | `high` | low | LGN pair present as architecture on the rank prong — Cetearyl Alcohol (18) + Behentrimonium Chloride (24), both above the rank-29 marker — plus persistent silicones (2, 3) and Bis-Cetearyl Amodimethicone (4). Confidence held **low**: the marker is near-vacuous and the Water-position variance makes the ordinal read unreliable |
| SLIP | `high`, bias `dry_biased` | low | Multiple independent M1 contributors: the silicone film (1–4), the cationic route (21/24), the lipid package (safflower 6, Myristyl Myristate 20). Persistent film with a volatile carrier and a thin water phase → `dry_biased` |
| SFR | `high` (`shine qualifier: present`) | low | §7.4 clause 1: (i) continuous film route = the persistent silicones (2, 3) and Bis-Cetearyl Amodimethicone (4); (ii) a lubrication route on **separate** observations — Carthamus Tinctorius (Safflower) Seed Oil (6), Myristyl Myristate (20). Two distinct observations, so clause 2's "one architecture read twice" failure does not apply |
| WT | `high` | low | LGN pair present as architecture (18 + 24) — the `high` anchor's first prong. The volatiles (1, 16) contribute nothing (M6). No enumerated rich-band member: safflower is an unenumerated liquid vegetable oil read **medium** band. **§10.1.2 tag not applicable** in any case: the only lightness statement („schwereloses Haaröl, das nicht fettet") is **C5**, and a C3–C5 statement never triggers the tag |
| PERS | `ph_dependent_cationic` | low | `permanent_cationic` would need a polymeric or silicone-functional quat enumerated by name; the only candidate is **Quaternium-91 (21)**, an opaque number — §7.6's unresolvable-quat rule: **not promoted**, record `quat_structure: unresolved`, route to review. **Bis-Cetearyl Amodimethicone (4)** is an amino silicone and places the record in `ph_dependent_cationic`. FS-12 observed: the rinse-off selectivity argument is not used |
| HOLD | `none` | moderately_high | No fixative-class L5 polymer is declared |
| HEAT | `not_claimed` | high | **No C1/C2 heat claim exists**: the German-language heat statement is on the brand's **Austrian** site (C5 under rule 3) and the °F/°C figure is on the Australian site (C5). Retailer and non-German-market copy never create a claim (G13). No L9 member at any rank. The binary would be `false`; **not emitted** (no lean profile). Routes to review under **`claim_authority_gap`**. FS-14 observed — the 93 °C figure is never read as a protection strength |
| HUM | `not_claimed` | high | §7.9 clause 1: no C1/C2 humidity or anti-frizz claim. Clause 3 observation recorded: a persistent hydrophobic silicone film is present as architecture, with no dominant humectant architecture — *"a hydrophobic film route is present; the manufacturer makes no humidity claim; humidity response is measured, not inferred."* State stays `not_claimed` |
| R2 | `none_visible` | moderate | No cationised protein, silane derivative or silicone quat at any rank. **Mandatory plain-hydrolysate note:** Hydrolyzed Soy Protein (14) is observed and recorded — a plain hydrolysate is `none_visible` at any position. **Hexapeptide-11 (15)** sits with the L6 evidence but is **not** an R2 `candidate` route: a peptide with no cationisation or silane function is `none_visible` with the same trace note. No `candidate_below_tail` note — no qualifying route sits below the marker |
| **DOSE** | **not emitted** | — | §7.11: *"Anhydrous products emit no DOSE value."* They are out of category at G0 and carry no lean profile |
| EXPO | `aromatic_or_allergen_exposure` | high | Fragrance (Parfum) (31), Citrus Limon (Lemon) Peel Oil (9, a clearly aromatic essential oil), and a declared allergen block: Linalool (32), Limonene (33), Geraniol (34), **Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde (35, HICC)**. HICC is EU-restricted and is one of the four preserved conflicts — the German retailer lists reportedly omit it. No `Alcohol Denat.`/`Alcohol` → no alcohol note. Ethylhexyl Methoxycinnamate (27) and Violet 2 (CI 60725) (36) recorded as observations only; **no colour-deposit conclusion is drawn** — a colour-depositing leave-in would be a separate exclusion row, and a single violet dye at rank 36 in an out-of-category record is not adjudicated here |
| ROLE | `unknown` | low | Directions are on the **Australian-region** manufacturer page — **C5**. §7.13 rule 1 permits role values only from C1/C2 directions. Recorded in `supporting_signals[]` with tier: "Apply YOUNG.AGAIN to freshly washed hair and before any styling products. Once dried, you can apply a small amount … to dry hair to increase the smoothness of the hair and remove any flyaway strands." At C1/C2 this would have established `post_wash` and `refresh` |

**Demoted flags (informational).** SHN `present` (qualifier on SFR only) · CURL not derived (§17.20) ·
**R3 `none`** (researched, negative: no C1/C2 bond claim, no recognised bond chemistry) · LAYER not emitted ·
buildup caution not emitted.

**`care_direction` (informational): `moisture`, confidence `low`.** R2 `none_visible` ⇒ `protein`/`balanced`
unreachable. §9's silicone-led `unknown` rule does **not** fire, because material emollient and humectant legs are
present above the marker — Carthamus Tinctorius Seed Oil (6), Myristyl Myristate (20), Glycerin (17), Betaine (19).
This is precisely the **under-firing shape recorded as open gap §17.22**: a plainly film-led, silicone-dominant
architecture returns `moisture` because §9 is a protein-versus-moisture vocabulary with no value for a film-led
product. The alternative reading (`unknown`) is recorded here and **not** adopted, since the rule's own gate is not met.
Informational only — the value is not emitted anywhere.

## Lean matching profile

**Not emitted.** §2.3.1: an excluded record carries no `focus`, no fit fields, no `specialist_functions` and no
cautions. Downstream consumers must treat "no lean profile present" as the machine-readable signal of exclusion.

No German user-facing string is emitted for this record.

## Catalog note (ruling 4)

This slot is one of the boundary-suspect "serum / oil_replacement" shapes the charter describes. **The research record
flags it; the live DB category stays unchanged pending a separate decision.** Nothing here authorizes a catalog write
(§19 stop condition).

## Review routing (§14)

| Trigger | Basis |
|---|---|
| G0 product-form decision | Boundary record; the exclusion is emitted, and the record is retained as a stress case (§16) |
| **Formula / identity conflict ×4** | GTIN unresolved; EU/US HICC divergence; token spelling; Water-position variance — all preserved, none merged (G5) |
| Absent exact-market formula | No DE-market-specific verbatim INCI was independently reproduced; the frozen list is the international capture and is explicitly not claimed as DE-safe |
| `claim_authority_gap` | Heat and lightness statements exist only at C5 (Austrian and Australian brand pages); no German-market Kevin Murphy source exists |
| `quat_structure: unresolved` | Quaternium-91 (§7.6) |
| Very late tail marker | Rank 29 of 36 (§17.18) |
| Regulatory re-review | `regulatory_re_review_trigger: 2027-06-06` — D4/D5/D6 leave-on limit; this formula is cyclosiloxane-led (§15, G12) |

`review_status`: **`provisional`** (minimum for an excluded record) → routed.
`out_of_category`: **true**. `g0_state`: `excluded_anhydrous`.
