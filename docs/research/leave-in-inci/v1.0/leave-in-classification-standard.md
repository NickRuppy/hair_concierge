# Leave-In Research and Classification Standard v1.0

Status: **logic locked — normative leave-in classification authority (Standard v1.0)**
Document version: `v1.0`
Engine version: `leave-in-inci-v1.0`
Logic lock: approved by Nick on 2026-09-13 after calibration round 4 returned zero value disagreements between two independent sealed lanes and against the reference key on all thirteen gold-set products (`data/research/leave-in-inci/v1.0/corpus/gold-set/round-4/round-4-report.md`)
Supersedes: `leave-in-inci-v0.4` (`leave-in-classification-standard.v0.4.md`, the draft this version promotes unchanged; `leave-in-classification-standard.v0.3.md`, `…v0.2.md` and `…v0.1.md` remain the frozen round-3, round-2 and round-1 rule sets)
Scope: conventional leave-on hair-conditioning products (spray, mist, milk, lotion, cream, microemulsion, two-phase), Germany/EU
Normative source: this Markdown file
Date: 2026-09-13

## Version

**v0.4 → v1.0, promoted at freeze on 2026-09-13.** The rule text below is the v0.4 draft, promoted **unchanged**: no anchor, threshold, enumeration, gate, projection, evidence bar or string was edited by the promotion. What changed is version identity and lock status — this preamble, the header block above, and the three version stamps in §10 (`model_version` → `leave-in-matching-v1.0`, `category_standard_version` → `leave-in-inci-v1.0`, and the research envelope's promotion-at-lock, below). `leave-in-classification-standard.v1.0-rc1.md` is the **reviewed source snapshot**: the exact bytes round 4 was run against, identical to this file minus this preamble and those version stamps.

**What the lock covers.** The reusable seven-dimension classification logic: vocabulary, anchors, thresholds, evidence ceilings, gates and the reasoning contract. It does **not** approve an individual product and does **not** authorize catalog, database, matching-policy, Product Intake or production use — §19.3's stop condition is unchanged and still binds. No production adapter exists yet; its four open decisions are listed in the [README](../README.md).

**Retained pre-freeze text, named so no reader mistakes it for a live obligation.** The body below still reads as the draft it was when round 4 reviewed it — §17's heading ("must stay open in v0.4"), §19.2.2 ("Round 4 — required for the v0.4 trim, not yet run"), §19.3's "Stop condition for v0.4", and the "it is not locked … awaiting a round-4 repeatability check" sentence in *What this document is not* below. That wording is retained deliberately, so this file and the reviewed rc1 snapshot stay diffable to the version stamps alone. **This Version block is the authoritative statement of freeze status**: round 4 has been run, it passed on values with zero disagreements, and its residue is closed (`…/corpus/gold-set/round-4/round-4-report.md`; ledger row 20a in `rule-changes.md`). §17's open evidence gaps remain open under v1.0 exactly as listed.

**Corpus relocation, effective at freeze.** The calibration corpus this document cites throughout as `plans/leave-in-inci/research/gold-set/…` and `plans/leave-in-inci/research/unseen-test/…` now lives at **`data/research/leave-in-inci/v1.0/corpus/gold-set/…`** and **`data/research/leave-in-inci/v1.0/corpus/unseen-test/…`**. Every such citation in the body resolves there; the paths in the body are not rewritten, for the diffability reason above. `plans/leave-in-inci/research/leave-on-science-review.md` and `plans/leave-in-inci/research/hard-rule-audit.md` — the two authority documents cited as **SR §x** and the hard-rule audit — are unmoved and keep their paths.

**What this document is.** It converts an exact leave-in product and its exact formula into an auditable research record, and it defines the reasoning contract a human or AI researcher must follow. Prose is English; all product-facing copy examples are German (§18).

**What this document is not.** It is not locked and it classifies no product. It has now survived three calibration rounds (§19), so its anchors are no longer untested — but v0.4 **trims the model on Nick's rulings without re-running either lane**, so every field the trim touches is a *re-projection* of round-3 evidence awaiting a round-4 repeatability check, not a locked rule. It does not activate a catalog field, authorize a production write, diagnose a user, or replace a formulation test.

**What changed in v0.2.** Calibration round 1 (13-product gold set, reference key vs sealed blind lane, 86.2 % field agreement) located the disagreement mass in *standard defects*, not in erratic judgment. v0.2 repairs those defects. Every change traces to the round-1 disagreement log (`plans/leave-in-inci/research/gold-set/agreement/disagreement-log.md`, cited as **DL Cx**), to the round-1 blind lane's ambiguity register (`plans/leave-in-inci/research/gold-set/blind/blind-review-notes.md` §2, cited as **BR §2.x**), or to Nick's adjudication rulings R11–R14 (§21.1). **v0.2 introduces no science absent from the science review.**

**What changed in v0.3.** Calibration round 2 re-ran both lanes on the same gold set under v0.2: **398 fields, 93.0 % exact agreement, 28 disagreements** (from 86.2 % and 50), with a clean v1→v2 regression — every reference-key change traced to an intended v0.2 rule. The residual disagreement mass again sat on *standard defects*: six clusters plus an overshoot list. v0.3 repairs exactly those. Its binding fix list is the round-2 report (`plans/leave-in-inci/research/gold-set/agreement/round-2-report.md`); every entry additionally traces to a named residual-ambiguity item in one of the two lanes' registers, cited as **ref Ax** (reference-key lane, `reference-key-v2/summary.md`) or **blind Ax** (sealed blind lane, `blind-v2/blind-review-notes.md`). **The two registers number independently, so every citation names its lane.** **v0.3 introduces no science absent from the science review**, adds no product-specific rule, and issues no new Nick ruling — R11–R14 stand, and the claim-capture change extends R12's scope rather than creating a new adjudication. The full entry-by-entry ledger is §21.2 and `rule-changes.md`.

**What changed in v0.4.** Calibration round 3 re-ran both lanes on the same gold set under v0.3 from a fully frozen packet with no web research in either lane: **398 fields, 97.5 % exact agreement, 10 disagreements** (§19.2.2). v0.4 is **not** a defect-repair pass on that result. It is a **model trim** issued by Nick on 2026-09-05 (rulings **T1–T8**, §21.3): the ontology carried more separately-reviewable surface than the evidence can support or than a matching model needs, and the trim removes that surface without touching a single anchor's evidence bar. SLIP is folded into COND (T1); SFR stops being a scored dimension and becomes the typed `smoothing_route` input to the smoothing focus (T2); DOSE is removed entirely, its dosing advice belonging to the app's existing application-guidance layer (T3); `scalp_application_fit` is removed, because the repo separates cosmetic from scalp guidance and the field was mostly `unknown` (T4); the six demoted flags collapse into one conditional **Hinweise** record listing only what fired (T5); a `repair_support_level` output aligned with the conditioner engine's `repair_level` replaces the implicit repair read (T6); HOLD keeps its 3-state and gains a **captured, never derived** manufacturer hold level (T7); and lean-profile fields that are deterministic echoes of a dimension stop being separately reviewable (T8). **v0.4 introduces no science absent from the science review, adds no product-specific rule, and re-derives no round-3 value** — the round-3 evidence is unchanged and is re-projected, never re-judged. The ledger is §21.3 and `rule-changes.md`.

**Amended in v0.4 (T9, 2026-09-05, same draft).** A further ruling issued the same day and folded into this still-unfrozen draft: **HUM is removed from the model completely** — no dimension, no lean-profile field, no state ladder, and no quoted-claim adoption. An unverifiable manufacturer humidity/anti-frizz claim is not a comparison axis this standard can defend; the anti-frizz *user need* is already served, without a humidity claim, by the `smoothing` focus (§10.2); the humectant-is-not-anti-frizz guardrail survives unchanged as FS-6/FS-15 (§12); and **HEAT is now the only claim-led field** in this standard. §7.9 becomes a removal record on the §7.3/§7.11 pattern. The gold-set packet's frozen `claims[]` may still carry `humidity_frizz`-typed entries from before the ruling — that is untouched, upstream data; **the model simply stops consuming them.** The ledger entry is §21.3 change 9 and `rule-changes.md`.

**Authority.** Every scientific claim traces to the leave-on science review (`plans/leave-in-inci/research/leave-on-science-review.md`, cited below as **SR §x**) or to the Leave-In Category Development Handover v1.0 (cited as **HO §x**). Where the two conflict, the handover's own hierarchy applies: new leave-in research and the handover take precedence over conditioner-specific assumptions, and the science review takes precedence over the handover on questions the review actually investigated. Nothing in this standard may introduce science absent from those two documents.

**Inherited structure.** The gate pattern (G0–G7), the evidence scale, the property-evidence object, the shared-mechanism/anti-double-counting discipline, and the identity control are reused from the Conditioner Research and Classification Standard v1.6 (`docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`). Conditioner *score rules and category science do not transfer* (HO §5, SR §N).

**Confirmed rulings encoded here.** Ontology of 13 scored dimensions with SHN/CURL/R3/LAYER demoted and R1 folded into COND (ruling 5); binary production heat protection with no `heat_protection_max_c` (ruling 6); `usage_role` reinstated and `care_direction` retained as a dedicated evidence-backed axis (ruling 7); regulatory re-review trigger 2027-06-06 (implementation default). **Added in v0.2:** formula freeze must capture and verify directions-of-use, not only INCI (R11, §2.4); claim authority is the manufacturer's German/EU page or the current German pack, never retailer copy (R12, §2.4.1); the two-persistent-families WT anchor resolves to `moderate` with a mandatory counter-signal, and counter-signals/confidence never leave the research trace (R13, §7.5, §10.1.1); a genuine repair-film route qualifies a product for the highly-damaged tier alongside the high-conditioning path, an R3 bond flag alone never does (R14, §10.3). **Added in v0.3:** claim capture is part of the formula freeze and classification lanes consume frozen claims rather than re-researching them (§2.4, extending R12); HUM returns to a claim-led ladder like HEAT, reversing the v0.2 decision on round-2 evidence (§7.9, §21.1 change 14); rank is the single deterministic prong of "present as architecture" (§3.1.1); the focus rank order binds before observation counting (§10.2). **Added in v0.4 (Nick's trim rulings T1–T9, 2026-09-05):** SLIP is not a property and its observations live inside COND (T1, §7.2, §7.3); SFR is not a scored dimension and `smoothing_route` is a typed trace input to the smoothing focus (T2, §7.4, §10.2); DOSE and its caution string are removed (T3, §7.11, §18); `scalp_application_fit` is removed from the model (T4, §10.3.1); SHN, CURL, R3, LAYER, buildup and transfer collapse into one conditional **Hinweise** record (T5, §8); `repair_support_level: low | medium | high` is the repair output, derived by the fixed rule in §10.3.2 (T6); a manufacturer-stated hold level is C1/C2 claim data recorded verbatim and never derived from formula (T7, §7.7); deterministic lean-profile echoes are annotations on their dimension rather than separately reviewable fields (T8, §10.1.3); and **HUM is removed from the model completely — no dimension, no field, no state ladder, no claim adoption; HEAT is now the only claim-led field (T9, §7.9)**. Deviations from the handover's candidate vocabulary are marked **[divergence]** with their justification.

---

## 1. Purpose and the required reasoning chain

The standard separates four things that a careless reader merges:

1. **formula observations** — what is literally on the INCI list and in the authoritative directions;
2. **direct product properties** — what the complete formula architecture plausibly does at leave-on dose;
3. **finished-product evidence** — what was measured on this exact product;
4. **user fit** — who it is likely to suit.

**Required chain (HO §12, gate G2):** formula observation → direct leave-in product behaviour → user-fit decision. No ingredient may jump directly to "suitable for fine hair", "heat protecting" or "curl friendly".

**Category law (SR §A.2).** Everything downstream of weight, persistence and dose obeys:

```
residue load  ≈  applied dose  ×  non-volatile fraction  ×  (1 − transfer/removal)
```

An INCI list gives an ordinal read on the second term and no read at all on the first or third. That is the single sentence from which most caps in this standard follow.

**Why leave-in cannot reuse rinse-out rules (HO §5, SR §B.1, §N).** Removing the rinse removes *deposition efficiency* as a hidden variable, which raises what COND and WT can support. It introduces *dose* as a new hidden variable, which lowers what PERS and buildup can support — and which v0.4 stops trying to score at all (T3, §7.11). The uncertainty moves; it does not shrink.

### 1.1 The conservative-failure invariant **[new in v0.4 — T17]**

Every hard rule in this standard — every threshold, closed enumeration, gate and marker convention — must fail in exactly one of two directions when its own input is implausible, absent, or otherwise untrustworthy: **toward human review, or toward the anchor's own conservative value.** A hard rule may never fail toward a recommendation, an upgrade, or any value that reads more favourably to a user than the evidence supports. This is not a new rule; it is the shape T16 gave the tail-marker rank prong (an implausible marker cannot disqualify) and the shape the hard-rule audit found seven more instances of (§17.14, §17.18, `plans/leave-in-inci/research/hard-rule-audit.md`) — stated here once, generally, as the test a future rule change must pass before it is adopted. A proposed rule or amendment that can be shown to fail toward a confident, more-favourable value on a plausible German-market input does not clear this bar, however cheap or well-motivated it otherwise is. **The first amendment tested against it was T18's formula-conflict precedence rule (§2.4.2), which clears it: its fallback tier fails to `unknown` and review, and its convergence tier resolves the conflict on converging evidence — preserving the outliers, lowering confidence and still routing to a human — rather than failing toward a more favourable reading.**

---

## 2. Category charter and the G0 product-form gate

### 2.1 Working definition (HO §4.1)

A leave-in is a cosmetic hair product intentionally left on the fibre after application, whose primary or co-primary function is conditioning, detangling, smoothing, curl support, heat-styling support or related fibre management. It may be used on damp or dry hair and may be a spray, mist, milk, lotion, cream, microemulsion or two-phase system.

The research unit is the **exact market product, pack and formula version** — never a brand line or marketing name.

### 2.2 Boundary table (HO §4.1)

| Decision | Boundary |
|---|---|
| Include | Water-based or emulsion-based leave-in sprays, mists, milks, lotions and creams |
| Include | Single-phase and two-phase products when conditioning/detangling is primary or co-primary |
| Include | Multi-benefit "10-in-1" products that are fundamentally leave-in conditioners or primers |
| Include | Curl creams when conditioning/definition is central and hold remains secondary |
| Include | Blow-dry primers and heat-protective leave-ins when conditioning is meaningful |
| Exclude | Pure oils and anhydrous silicone serums → route to the oil/serum category |
| Exclude | Styling-first gels, mousses, hairsprays, waxes, clays and strong-hold creams |
| Exclude | Rinse-out conditioners, masks, co-washes and cleansing conditioners |
| Exclude | Scalp serums, growth tonics, medicated and anti-dandruff treatments |
| Exclude | Color-depositing leave-ins and salon chemical-processing treatments |

### 2.3 G0 — product-form gate

**Classify by function + authoritative directions + formula architecture. Never by name (HO §4.2).**

G0 runs before any formula analysis and produces exactly one state:

| G0 state | Condition |
|---|---|
| `in_category` | Aqua (or an aqueous phase) leads or is materially present; directions say the product stays on the hair; conditioning/detangling/smoothing/curl/heat-styling support is primary or co-primary |
| `excluded_anhydrous` | No Aqua, or Aqua absent from the top of the list; cyclomethicone/dimethicone/oils lead → oil/serum category (SR §A.1) |
| `excluded_styling_first` | A fixative-class polymer route with thin or absent conditioning architecture behind it, and directions/positioning lead on durable hold or texture (SR §F.2, HOLD anchor in §7.7) |
| `excluded_other_form` | Rinse-out, mask, co-wash, scalp/medicated, color-depositing, salon chemistry |
| `provisional_boundary` | Genuinely ambiguous: retain as a boundary stress case, complete the record, mark every affected field uncertain |

Three named traps this gate must survive:

- **"Serum" is a marketing word, not an architecture.** A water-based product called a serum may remain in-category once the formula is verified; an anhydrous one leaves regardless of what the label says. The catalog holds ~10 boundary-suspect rows on exactly this point; per ruling 4 they are **flagged in research only** and the live DB categories stay unchanged pending a separate decision.
- **A two-phase spray is in-category** when conditioning is primary, even though it has no emulsifier at all (SR §A.1).
- **A "styling prep" or "mist" positioning does not by itself exclude.** Run the HOLD anchor; `meaningful_hold_route` with thin conditioning is what excludes, not the word. **This trap warns against excluding on a word alone. It never converts a cleanly-firing two-half styling-first test into an ambiguity — §2.3.2 states the precedence and governs over this sentence [v0.3].**

### 2.3.1 Emission contract for excluded products **[new in v0.2 — DL defect register, BR §2.17]**

v0.1 said excluded products "do not classify" (§2.3) while §16 said a product leaving the category "retains its record as a boundary stress case". The two lanes read that differently, so the contract is now explicit. An excluded record (`excluded_anhydrous`, `excluded_styling_first`, `excluded_other_form`) carries **exactly** the following and nothing else:

| Emitted | Content |
|---|---|
| Identity block (§2.4) | Complete, including the directions capture required by G1 |
| `g0_state` + `g0_rationale` | The exclusion state and the observation that triggered it |
| `out_of_category: true` | Explicit |
| Formula record | Raw INCI, normalized fingerprint, source, conflicts |
| §7 dimensions | **Optional, and if present marked `informational_and_non_authoritative: true`.** They exist only to make the boundary case reusable as a stress case; they are never inputs to matching, comparison or copy |
| Lean matching profile (§10) | **Not emitted at all.** No `focus`, no fit fields, no `specialist_functions`, no cautions |
| `review_status` | `provisional` at minimum; `provisional_boundary` records always route to human review (§14) |

A `provisional_boundary` record is *not* an exclusion: it stays in-category, completes the full record, and marks every affected field uncertain (§2.3). Downstream consumers must treat "no lean profile present" as the machine-readable signal of exclusion; the absence of fit fields is the contract, not an omission.

**The exclusion state is the routing — no boundary trigger is added [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** An excluded record emits **no** `g0_boundary_decision` trigger (and no other trigger restating its own `g0_state`). The state, its rationale and the `review_status` row above already carry the record to a human, and §14's standing G0 trigger already covers ambiguity and every `provisional_boundary`. A trigger that repeats a field the record itself carries adds no routing and makes two lanes' trigger lists undiffable — see §14's trigger-vocabulary rules. `tail_marker` is likewise **not** on the contract above: §14's requirement that every record state `tail_marker.marker_status` binds **in-category records only**. An excluded record may carry a tail-marker reading as part of the optional informational block (row 5 above, `informational_and_non_authoritative: true`) — gold-set slot 12 does — but it is never required to, and such a reading is never an input to anything.

### 2.3.2 Boundary precedence — `excluded_styling_first` vs `provisional_boundary` **[new in v0.3 — round-2 cluster 3, ref A14, blind A15]**

Round 2 landed two of thirteen records on `provisional_boundary` for the same rule conflict, in opposite directions, and neither product is one a human would call genuinely ambiguous. The cause: §2.3's trap-3 sentence says `meaningful_hold_route` with thin conditioning "is what excludes", while the `excluded_styling_first` row requires that architecture **and** directions/positioning leading on durable hold or texture — and §2.4.1 never said which claim tier carries the positioning half. The precedence is now stated, and **§2.3.2 governs over the trap-3 sentence**.

The styling-first test has two halves:

- **Architecture half (E1/E2, always available from the formula):** the HOLD anchor (§7.7) returns `meaningful_hold_route` — a fixative-class polymer in a film-forming context with thin or absent conditioning architecture behind it.
- **Positioning half:** directions or positioning that lead on durable hold or texture. **G13 binds this half exactly as it binds every other claim-keyed decision**: it is established only at C1/C2 (§2.4.1). v0.2's "fields governed by this rule" list omitted G0 (blind A15); the omission is closed.

Ordered rule:

1. **Both halves established at C1/C2, and no C1/C2 evidence points the other way ⇒ `excluded_styling_first`.** The test has fired cleanly. Do not soften it to `provisional_boundary`, and do not reopen it on the product's brand range, category shelf or marketing word.
2. **Architecture half established, C1/C2 evidence materially contradicting the exclusion ⇒ `provisional_boundary`.** The paradigm case is C1/C2 directions describing an explicitly *included* use — a blow-dry primer, a post-wash leave-in — for a product whose architecture reads styling-first. That is a genuine evidence conflict, which is what the state is for.
3. **Architecture half established, positioning half resting only on C3–C5 sources, and no C1/C2 evidence pointing the other way ⇒ `excluded_styling_first`**, with the weak-tier positioning recorded as corroboration and its tier stated. A weak positioning tier does not manufacture an ambiguity: it fails to *create* the positioning half, while the architecture read stands unambiguous on its own terms.
4. **`provisional_boundary` is reserved for genuine evidence conflicts** — clause 2, a formula-source conflict that makes the conditioning architecture unreadable, or two C1/C2 sources disagreeing. It is never the destination for a decision the reviewer merely found uncomfortable.

The precedence decides the **emitted state**, not whether a human looks at the record: G0 ambiguity and every `provisional_boundary` already route to review (§14), and an exclusion decided under clause 3 records its weak-tier basis for the same reason.

**Worked-example pair — the adjudicated styling boundary [new in v0.4 — ruling T15, 2026-09-10].** Nick adjudicated the gold set's designed boundary case, and the pair now anchors this gate:

- **Styling-first, excluded — Maria Nila Curlicue Cream:** PVP at rank 4, ahead of the fatty alcohol, with no conditioning architecture behind it. The product's result comes from the fixative film welding fibres; the care content is thin. `excluded_styling_first`.
- **Leave-in, included — Neqi Diamond Glass Ultimate Styling Spray:** a genuine substantive conditioning film (Silicone Quaternium-18, permanently cationic; Polysilicone-29 smoothing film) with **one supporting** fixative-class polymer (VP/Methacrylamide/Vinyl Imidazole Copolymer, rank 8). The result comes from conditioning and heat styling; the fixative supports rather than defines. `in_category`, HOLD `incidental_film` (§7.7). The naming conflict across channels ("Ultimate Styling Spray" at the brand vs. "Leave-In Spray" at dm) decided nothing, per the classify-by-function rule.

The dividing line, stated once: **a fixative system with thin conditioning behind it is styling; a conditioning film with a supporting fixative is a leave-in.**

**Cross-rule consistency clause [new in v0.4 — T17, hard-rule audit item H9].** One species, at one rank, in one record, may not simultaneously count as **substantive architecture** for one rule (this section's boundary test, or §7.7's HOLD anchor) and **disqualified trace** for another (§7.10's R2 anchor, or any other §7 anchor reading the same rank-position observation). Where two rules read the same species at the same rank differently, the record does not silently carry both readings: it **routes to human review** (`species_reading_conflict`), and the note names the species, its rank, and the two rules whose readings diverge. Neither reading is overridden by this clause — each rule keeps deciding its own anchor exactly as it already does — the clause only makes the divergence visible instead of letting it stand unrecorded. The worked case this clause exists for: T15 names Silicone Quaternium-18 (r11) as the substantive conditioning film that decides slot 13's HOLD/G0 reading (§7.7), while §7.10's rank prong independently keeps the same species, at the same rank, as `candidate_below_tail` for R2 (§21.3, T15; §21.3, T17).

### 2.4 G1 — identity and formula gate

Classification stops before formula analysis unless these are captured or explicitly recorded as a documented gap:

- exact catalog product UUID;
- exact brand and product name;
- Germany/EU market;
- pack size or an explicit unknown;
- one reliable identifier (GTIN/EAN) or a documented identity-research gap;
- dated exact-market formula source;
- raw INCI plus a normalized formula fingerprint;
- **the verbatim authoritative application directions, quoted and source-stamped** (source hierarchy: user package → German/EU manufacturer → exact-GTIN German retailer → other German/EU retailer → secondary discovery) — see the mandatory directions capture below;
- **`application_stage[]` — the identity-level application-timing read, transcribed from the same directions** (`towel_dry | dry_hair | pre_heat | post_style`, §7.13) — captured alongside directions, never derived from formula, never a judgment call **[new in v0.4 — T12]**;
- **`claims[]` — every claim the product carries that touches a claim-keyed field, captured verbatim with its source tier, URL and retrieval date** — see the mandatory claim capture below **[new in v0.3]**;
- G0 product-form status;
- any source/formula conflicts, preserved rather than resolved by preference.

Allowed identity states: `verified` · `verified_with_minor_source_difference` · `provisional_formula_conflict` · `provisional_identity_conflict` · `insufficient_information` · `excluded_product_form`.

A GTIN may survive reformulation. Formula identity and product identity are related but separate. A conflict that affects one property makes **that property** unknown; it blocks the whole analysis only when the dominant architecture cannot be resolved.

**Leave-in-specific addition:** directions are not optional metadata here. `application_stage` (§7.13) is transcribed from directions at E1 and feeds the `heat_styling` focus (its `pre_heat` half) and the buildup review trigger (§14) **[v0.4 — T12: this addition previously named `usage_role`, load-bearing for dose, frequency and accumulation (SR §K ROLE); ROLE is removed and `application_stage` is its identity-capture successor for the one bit that survived — dry-hair usability. `provides_heat_protection` was never role-derived and is unaffected (§13.3).]**. Missing directions leave `application_stage` empty — they never license an INCI-based guess.

**Mandatory directions capture (G1, hard requirement) [new in v0.2 — ruling R11, DL C1].** The formula freeze is not complete until directions-of-use have been *captured and verified*, not merely assumed from the product's category or name. Round 1 lost a gold-set slot to exactly this failure: a product freeze-captured as a leave-in carried the direction „Nach 9 Sekunden gründlich ausspülen" and was in fact a rinse-out (`excluded_other_form`). Both the identity lane and the blind lane missed it because only the INCI was captured. Therefore:

1. **Capture the direction text verbatim**, in the original German where the source is German, with the source tier and retrieval date. A paraphrase is not a capture.
2. **Verify it against the exclusion test first, scoped to the product's own application step [scoped in v0.4 — T17, hard-rule audit item H3].** Any direction governing **the product's own application step** — the sentence that says what to do with the product after applying it — that contains a rinse, wash-out, or contact-time-then-rinse instruction sets `excluded_other_form` at G0 **before** any formula analysis runs. Product form, list architecture and marketing name never override an explicit rinse direction that governs the application step. Three consequences:
   1. **A safety or hazard instruction never fires the test.** „Bei Kontakt mit den Augen gründlich mit Wasser ausspülen" and comparable spillage/contact sentences describe what to do in an accident, not what to do with the product — they do not govern the application step and are never read as a rinse direction.
   2. **A dual-use direction that offers leave-on use as an alternative to rinsing keeps the record in-category.** „…im Haar lassen oder nach 2 Minuten ausspülen" and comparable „ODER"-structured directions are a genuine dual-use product. The record stays `in_category`, both direction sentences are captured verbatim, `application_stage` is transcribed from the leave-on half only, and the record carries a `dual_use_directions` note and **routes to human review**.
   3. **Only a direction that makes rinsing the sole disposition of the product** — no leave-on alternative stated — sets `excluded_other_form`, exactly as before.
   
   This does not move the evidence bar the rule already applies: it stops the rule from firing on sentences it was never aimed at (an accident/hazard sentence, or one half of a genuinely dual-use direction), consistent with §1.1's invariant — the rule's failure mode on an ambiguous direction is now human review, not a silent, maximally destructive exclusion with no lean profile emitted (§2.3.1).
3. **Absent directions are a documented gap, not an assumption.** Record `directions_capture: missing`, leave `application_stage` empty (§7.13), and route the record to human review (§14). **[v0.4: the `scalp_application_fit` consequence is gone with the field — T4, §10.3.1. The `usage_role: unknown` consequence is gone with the field too — T12, §7.13; an empty `application_stage[]` is the honest state for a field that was never derived, not a fourth value.]**
4. A **directions change** reopens `application_stage` and every placement- or frequency-keyed caution (§16) — which only works if the original capture is on file to diff against. **[v0.4: `scalp_application_fit` removed from this list with the field — T4. This clause previously named ROLE; T12 replaces it with ROLE's identity-capture successor.]**

**Mandatory claim capture (G1, hard requirement) [new in v0.3 — round-2 cluster 5, ref A19; extends R12].** R11 made *directions* part of the formula freeze. R12 then made *claims* decisive for `provides_heat_protection`, HUM, the `heat_styling` focus, the §10.1.2 weight conflict tag and every „… ist ausgelobt" string — but the G1 checklist was never extended to require a claim capture with its tier. Round 2's reference lane had to research five claims mid-classification; without those, every heat binary in the set would have been `false` by §2.4.1 rule 1 and the round-2 HEAT comparison would have been vacuous. It was the single most consequential gap the round found. **[v0.4 — T9: HUM is removed from the model, so it is no longer among the claim-keyed fields this capture serves; `provides_heat_protection` is now the only production field claim capture decides. The capture requirement itself, and the humidity-frizz claims already frozen from before the ruling, are unchanged — the model simply stops reading them for a HUM field that no longer exists.]** The freeze now covers claims:

1. **`claims[]` is part of the formula freeze.** For every product the freeze carries a `claims[]` array, and each entry carries `claim_text` (verbatim, in the original German where the source is German), `source_tier` (C1–C5, §2.4.1), `source_url` (or the pack-photo identifier for C1) and `retrieval_date`.
2. **The C1/C2 search is run and recorded either way.** Where no C1/C2 source is located for a claim-keyed field, `claims[]` records that explicitly — the field, the sources searched, and the date — and §2.4.1 rule 1 applies: the claim does not exist, the field takes its no-claim value, and the record routes to review as `claim_authority_gap`. **"Not captured" and "does not exist" are different states** and must not be collapsed into each other.
3. **Classification lanes consume frozen claims and never re-research them.** A lane may not add, upgrade or re-tier a claim while classifying. A claim discovered mid-classification **reopens the freeze** (§16 formula/identity discipline), is captured with its tier, and the record is completed against the re-frozen packet. This is the discipline the INCI list and the directions already carry, and it is what makes a claim-keyed field comparable across two lanes at all.
4. A **claims change** reopens HEAT, the `heat_styling` focus, the §10.1.2 conflict tag, and every „… ist ausgelobt" string (§16). **[v0.4 — T9: HUM removed from this list with the field. T12: this clause previously named ROLE, because a claims-authority change could move which directions text qualified as C1/C2 for a role value. `application_stage` does not carry a claim-tier gate to move (§7.13), so it drops out of this list — it is governed only by a *directions* change (§16, §2.4 rule 4 above), the same trigger every other identity field already answers to.]**

**Packet requirements [new in v0.3 — round-2 overshoot list, blind A27, ref A19].** These are fixes to the *packet builder*, not to the reasoning rules, recorded here because the packet is the artifact G1 freezes:

- **Source stamps carry C-tiers.** A packet must stamp every source with this standard's own `C1`–`C5` tier (§2.4.1). Round 2's packet stamped its own `T1/T2/T3` tiers, which do not map onto C1–C5, so every record required a reviewer inference to reconstruct the tier — an inference that decides claim-keyed fields.
- **INCI normalization must not split inside an ingredient name.** Round 2's `normalized_ingredients` split on every comma, so „1,2-Hexanediol" became the two tokens `1` and `2-HEXANEDIOL`. It was harmless where it occurred; a comma-bearing INCI name higher in a list would corrupt every rank count on that product, and the §3.1.1 tail marker is a rank observation. Normalization splits on the INCI list separator only and preserves commas inside a declared ingredient name.

### 2.4.1 Claim authority **[new in v0.2 — ruling R12, DL C5, BR §2.9; gains a narrow cross-market exception in v0.4 — T14]**

v0.1 defined a source hierarchy for *directions* and none at all for *claims*, while making the production field `provides_heat_protection` claim-led (§13.3). Round 1 showed the cost twice: a product whose authoritative German source carries no heat claim while assorted retailer copy mentions heat-damage protection, and a retailer inventing "the heat protecting molecule" for a plain PVP the manufacturer never made a heat claim about. Two lanes, two different production binaries, from the same product.

**The rule — general, and it governs every claim-keyed field in this standard:**

> **A marketing claim exists for classification purposes if and only if the manufacturer's German/EU product page or the current German pack states it.** Retailer copy — including exact-GTIN German retailers, marketplaces and salon resellers — **never creates a claim.** It may only *corroborate* a claim that already exists at manufacturer or pack level.

| Tier | Source | Can create a claim? | Can corroborate? |
|---|---|---|---|
| C1 | Current German pack (user photo, pack scan) | **Yes** | Yes |
| C2 | Manufacturer's **German-market** product page for the exact product — a German-language page addressed to the German market **[reworded in v0.3, see rule 3]** | **Yes** | Yes |
| C3 | Exact-GTIN German retailer listing | No | Yes |
| C4 | Other German/EU retailer, marketplace, salon reseller | No | Yes |
| C5 | Secondary discovery, review sites, brand social copy on a non-EU market page | No | Weakly, and record the weakness |
| C2_cross_market_verified | Manufacturer's **non-German-market** page, admitted as claim-creating **only** under rule 7's identity-verification-plus-corroboration exception **[new in v0.4 — T14]** | **Yes — exception only, see rule 7** | Yes |

**Operating rules.**

1. **No C1/C2 source found ⇒ the claim does not exist**, and the claim-keyed field takes its no-claim value (`not_claimed` for HEAT — **the only claim-led field from v0.4, T9**). Record the retailer copy in `counter_signals[]` with its tier, and route the record to human review with a `claim_authority_gap` note so a human can decide whether the manufacturer source was simply not found.
2. **C1 and C2 conflict** (pack says one thing, the page another) ⇒ preserve both under G5, take the **more conservative** reading for the production field, and route to review.
3. **Non-German EU or non-EU market pages** are C5, not C2: a claim made on a US page is not a claim made on the German market product. **Rule 3 governs, and the C2 row is worded to match [v0.3 — round-2 overshoot list, ref A2, blind A2].** v0.2's C2 row read "manufacturer's German/**EU** product page" while this rule excluded non-German EU pages — directly contradictory for any EU-but-not-German manufacturer page, and round 2 hit the contradiction on four products, where the two readings moved `usage_role` and one HUM claim. Resolved in **rule 3's favour**, the conservative reading. A Swedish, Spanish or US brand page is C5 whether or not it is in the EU; a German-language German-market page of a foreign brand is C2. **Rule 7 below carves out one narrow, identity-gated exception to this rule; without satisfying rule 7, this rule stands exactly as written.**
4. **A system-level claim** ("… when used as a system of shampoo, conditioner and treatment") is a claim about a routine, not about this product alone. Authority is satisfied when the source is C1/C2, so the claim exists — but its *scope* is a separate question this standard does **not** decide. Handling: record the claim verbatim with its system conditioning, tag the field `claim_scope: system_level`, take the trace state the product's own evidence supports (usually `claim_only`), apply §13.3's claim-led binary unchanged, and **route the record to human review** (§14 already lists routine-level efficacy evidence for a single leave-in). **Whether a system-level claim should set a product-level production binary is an open adjudication item (§17.13)** — it is a product-policy question, not a claim-authority question, and this standard does not resolve it in v0.2 or v0.3.
5. **Claim authority does not create evidence.** A C1/C2 claim is still E0 (§3.1). This rule decides only *whether a claim exists*, never how strong it is.
6. **House brands: a retailer's page for its own private label is C2 for that product [new in v0.3 — round-2 overshoot list, ref A1, blind A1].** Where the retailer and the brand owner are one legal entity, the retailer's page for its **own** private-label product *is* the manufacturer's page for that product, and it is **C2**, not C3. The rule this clause qualifies exists to stop *retailer-invented* copy about a third party's product; it was never aimed at a brand owner's own product data, and read literally it stripped four German mass-market products of their directions and claims in round 2. Named German-market cases: **dm ↔ alverde and Balea; Rossmann ↔ Isana.** The clause is deliberately narrow: it applies only to the retailer's **own** brand, only on that retailer's page, and the record carries `claim_tier_basis: house_brand` naming the ownership relation in the trace and routes to review (§14) so a human confirms it. The same retailer's page for a **third-party** brand remains C3.
7. **Cross-market manufacturer exception to rule 3 [new in v0.4 — T14, 2026-09-10, adjudicated during Nick's Olaplex gold-set review].** A manufacturer's **non-German-market** product page **can** create a claim for the German market when **both**: **(a) product identity is verified** — the German-sold unit's formula fingerprint is identical to the claimed product's own published INCI (a set-for-set diff against the frozen German-market capture, order noise aside), **or** a shared GTIN is confirmed at a German retailer; **and (b) at least one German-market retailer (C3 or C4) corroborates the claim.** Both prongs are required; corroboration alone, or identity alone, does not satisfy this rule. Record such a claim with `source_authority_tier: C2_cross_market_verified` and attach the identity evidence (the formula diff or the confirmed GTIN match, with its source) to the claim record. **This rule decides authority only — it does not touch G4's evidence cap:** a `C2_cross_market_verified` claim is still E0 (rule 5). **Without identity verification, rule 3 stands unchanged**: a non-German page remains C5, and no amount of retailer corroboration substitutes for identity — corroboration under rule 3's ordinary reading only ever corroborates an *existing* C1/C2 claim, it does not manufacture one. **Guarding counter-example: Cantu.** Cantu's own DE-pack formula (dm.de, gold-set slot 3) and its US-market formula are already documented as genuinely different formulas (`known_conflicts`, same record) — a different cationic/emollient architecture under a different GTIN. Clause (a) therefore fails for Cantu on the evidence already on file: whatever a US or other non-German Cantu page says about heat protection, this rule cannot treat it as creating a claim for the German-sold product, because the two are not shown to be the same formula. Cantu's heat statement stays exactly what rule 3's ordinary reading already made it — C3-only (dm.de), non-creating, `not_claimed`. This exception is deliberately narrow: it exists to let a verified single-formula product's global marketing page count once identity is nailed down, not to let corroboration alone launder a foreign claim onto a different German formula.

**Directions authority no longer names a role field [v0.4 — T12].** Through v0.4-draft this paragraph stated that directions inherit the same C1/C2 claim authority "for ROLE". ROLE is removed. Its identity-capture successor, `application_stage` (§7.13), is deliberately **not** governed by this claim-authority rule — it reads whatever directions text G1's own general source hierarchy already captures and verifies (§2.4), with no additional C1/C2 gate. `application_stage` therefore drops out of this clause rather than replacing ROLE in it.

**Fields governed by this rule:** HEAT (§7.8, §13), the `heat_styling` focus (§10.2) — **for its `provides_heat_protection` half only; the focus's `application_stage` half is not claim-gated (§7.13)** — and every German copy string in §18 that begins with „… ist ausgelobt". **Added in v0.3:** the **positioning half of an `excluded_styling_first` G0 decision** (§2.3.2 — v0.2's omission of G0 from this list was itself a defect, blind A15), the **§10.1.2 weight conflict tag**, and the **curl/wave positioning negative gate** on the `curl_definition` focus (§10.2). **Removed in v0.4 — T9:** HUM (§7.9) governed this rule from v0.2 through v0.3; the field is gone and **HEAT is now the only claim-led field this standard has.** **[v0.4 — T12: ROLE governed this rule via its directions sourcing through v0.4-draft; ROLE is removed and, unlike every other T9-T11 removal, its identity-capture successor does *not* inherit this gate — see the sourcing note above.]**

### 2.4.2 Formula-set conflicts between same-market captures — convergence, then the conservative fallback **[new in v0.4 — T18, 2026-09-12, adjudicated against the unseen-test u1 record]**

§2.4 requires source and formula conflicts to be "preserved rather than resolved by preference" and offers `verified_with_minor_source_difference` and `provisional_formula_conflict` as identity states — but through v0.4-draft it never said **how to decide which of several disagreeing captures of the same German-market unit is the formula of record.** The unseen-test round showed the cost: the two lanes split on u1 (L'Oréal Paris Elvital Dream Length No Spliss Milk), one taking `unknown` on every affected dimension, the other classifying from whichever capture the packet happened to freeze as primary (`plans/leave-in-inci/research/unseen-test/unseen-test-report.md`). The second reading is a source preference wearing a procedural disguise, and the recency investigation proved it can be the *wrong* preference: on u1 the frozen primary was itself an outlier. The rule is now stated, in two tiers.

**What counts as a conflict here.** A **formula-set conflict**: two or more independent captures of the same nominal German-market SKU disagree on **which species are declared**. Ordering differences alone, and differences that are only granularity of a fragrance/allergen declaration (one source itemising aroma chemicals that another leaves inside `Parfum`), are **not** set conflicts — the same "order noise aside" tolerance §2.4.1 rule 7 already applies to its own identity diff. A set conflict on the persistent architecture, on a functional active, or on any species an anchor reads is what this clause governs.

**Tier 1 — convergence resolution (primary).** A set conflict is **resolved** when all of the following hold:

1. **at least three independent sources** return the **identical ingredient list in identical order**, and
2. **at least one of those three is a GTIN-anchored German retailer capture** (the GTIN visible on the page or in its URL/markup, not inferred from the product name), and
3. **the manufacturer's own printed formula markers match across them where visible** — F.I.L. fragrance codes and formula prefixes. **A trailing revision digit difference does not break the match** (`C240136/1` vs `C240136/2` is the same fragrance declaration, not a different formula); a different code *family* does.

Where the bar is met, **that convergent list is the formula of record**, and:

- the packet's primary capture is **(re-)anchored to it via a dated amendment-log entry** — the re-anchoring is recorded, never silent;
- every outlier capture is **demoted to an additional capture with a note stating why**, and **never deleted** (§2.4's preserve-don't-resolve discipline is unchanged: demotion is a ranking, not a deletion);
- `identity_status` becomes **`verified_with_minor_source_difference`**, not `verified` — the disagreement happened and the record says so;
- **confidence on every affected dimension drops one step below what a single-source clean capture would earn**, on the §3.1.1 mandatory-limit-2 pattern;
- the record carries the standing **`formula_or_identity_conflict`** review trigger (§14), so a human still sees the residual;
- **classification then proceeds from the convergent list normally — no blanket `unknown`s.** Resolving the conflict is the point; a resolved conflict is not re-punished by withholding every value it decided.

**Tier 2 — conservative fallback.** Any set conflict that **cannot** reach that bar: the affected dimensions take **`unknown`**, the record carries a named **`formula_source_conflict`** trigger (§14), it **routes to human review**, and — per adapter decision **AD-2** (`plans/leave-in-inci/adapter-decisions.md`) — **it cannot be committed to the catalog until the conflict is resolved**, whether by a fresh C1 pack capture or by later reaching tier 1's convergence bar.

**The reading this clause explicitly rejects.** Classifying from whichever capture the packet froze as primary — the "G5 smallest-scope" reading the unseen test's lane B applied — is **not** an admissible resolution. It bakes an arbitrary source preference into a product's values while presenting itself as procedural restraint, and u1 is the standing proof that the frozen primary can be the outlier. A capture's position in a packet is a bookkeeping fact, never evidence about the formula.

Both tiers satisfy §1.1: tier 2 fails to the conservative value and to review, and tier 1 is an **evidence resolution**, not a recommendation-ward failure — it takes the reading three converging sources support, keeps the outliers on file, lowers confidence, and still routes to a human.

**Scope boundary — T18 is a same-market rule, T14 governs cross-market differences.** This clause governs conflicts **between captures of the same German-market unit**. A **cross-market formula difference** — a US (or other non-German) formula that genuinely differs from the German one — is **not a T18 conflict at all**: it is an identity question, already governed by **§2.4.1 rule 7 (T14)**, whose named counter-example is Cantu's documented DE/US formula split under different GTINs (gold-set slot 3 `known_conflicts`). Never resolve a cross-market difference by convergence counting: three non-German sources agreeing with each other say nothing about the German-sold unit, because they are evidence about a *different product*. Where both questions are live on one record — is this the same product across markets, and which of several German captures is current — rule 7 decides the first and this clause decides the second, in that order.

**Worked example — u1, where the frozen primary and the manufacturer's own page were both outliers [T18, 2026-09-12].** The unseen packet's u1 entry (L'Oréal Paris Elvital Dream Length No Spliss Milk, GTIN 3600523587841) carried three mutually contradicting captures for one German-market SKU: mueller.de at 38 ingredients (the frozen primary), loreal-paris.de at 35 (the manufacturer's own German page), and codecheck.info at 31. The differences were structural, not cosmetic — a whole silicone backbone (plain Dimethicone vs. Cyclopentasiloxane/Dimethiconol/PEG-PPG-17/18 Dimethicone), the presence or absence of Niacinamide and Panthenol, and a cationised wheat protein present on one source alone, the single species that would have moved R2, `care_direction`, `repair_support_level`, `damage_fit` and `focus.primary`. The recency investigation (`plans/leave-in-inci/research/unseen-test/u1-formula-recency.md`) found convergence on the 31-ingredient list: **rossmann.de** (GTIN in the URL path) and **parfumdreams.de**, both German retailers, and the independent aggregator **codecheck.info** returned the same list in the same order, sharing the formula prefix `1184630 C` and the F.I.L. family `C240136`, differing only in the trailing revision digit (`/1` vs `/2`). Tier 1's bar is met, so the 31-ingredient list is the formula of record; the packet's primary was re-anchored to it under a dated amendment-log entry; mueller.de — re-fetched live and reproducing exactly, so a genuinely served page rather than a stale capture — was demoted to an additional capture, as was loreal-paris.de; `identity_status` reads `verified_with_minor_source_difference`; confidence sits one step down on the affected dimensions; and the record routes under `formula_or_identity_conflict`, because a C1 back-of-pack photo is still the definitive close-out. **The two lessons this example is kept for:** the frozen primary was an outlier, and so was the manufacturer's own page — neither position carries evidentiary weight against three converging same-day sources for the same GTIN.

---

## 3. Evidence scale, the E3 metadata requirement, and the evidence firewall

### 3.1 Scale (SR §J, HO §12)

| Level | Meaning | Permitted use |
|---|---|---|
| E0 | Product name, marketing claim, "schützt bis 230 °C", unsupported secondary statement | Record the claim only; never a direct property |
| E1 | Verified exact-formula observation: ingredient present/absent, literal rank; declared directions and dose form | Formula/directions fact only |
| E2 | Architecture or mechanism inference from the complete formula **for leave-on exposure** | Candidate route or direct-property potential, always provisional |
| E3 | The exact product tested instrumentally, **applied as a leave-on**, protocol declared | Endpoint-specific product property |
| E4 | Controlled human-use or blinded trained-sensory evidence on the exact product | Endpoint-specific product/perception evidence |
| E5 | Replicated or consensus finished-product evidence relevant to leave-on use | Strong endpoint-specific conclusion |

INCI-only classification never exceeds E2 (G4). Reviewer agreement measures repeatability of the rules, not truth.

**The assignment ladder — which level a given read earns [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** The table above defines the levels; it never said which one a *particular* read earns, and the two sealed unseen-test lanes drifted systematically apart on exactly that — lane A stamping `E2` where lane B stamped `E1` on the same formula-only reads (`unseen-test-report.md` secondary finding 2). The ladder is fixed here, once, and binds every field in every record:

| The read is | Level | Test |
|---|---|---|
| An **identity-block fact** — pack, exact product name, GTIN, pack size, market, the verbatim transcription of the declared directions of use, `application_stage` | **E1** | Nothing is inferred. The record states what a source literally says, and a second reader checking the source either finds the same words or does not |
| A **value read from the frozen formula alone** — any §7 dimension value, any route or architecture read, `care_direction`, `smoothing_route`, `tail_marker`, any flag fired from formula, and every derived fit resting on them | **E2** | The formula is complete and literally observed, but the *value* is an architecture or mechanism inference from it. This is the ordinary level for this standard's own output |
| An **exact-product instrumental result, applied as a leave-on, protocol declared** | **E3+** | §3.2's four metadata requirements are met and G8's firewall is clear. Nothing short of exact-product external evidence reaches this rung |

Three consequences, stated because they are the ones that drifted:

1. **A formula observation is E1; a value read from it is E2.** "Dimethicone is declared at rank 4" is E1 and belongs in `formula_observations[]`. "`weight_potential: high`" is E2, even when the observation behind it is a single unambiguous rank. The evidence *object's* `evidence_level` describes the value, not the observation it cites — so a dimension whose entire basis is the frozen INCI list is **E2, never E1**.
2. **E1 is not a confidence statement and E2 is not a demotion.** A cleanly-read formula value at E2 with `moderately_high` confidence is a stronger record than a directions transcription at E1 with `low` confidence. The two axes are independent (§4).
3. **This ladder is applied from round 4 forward and re-levels nothing retroactively.** Records written before this ladder was stated keep the levels they carry until round 4 re-derives them; the freeze comparison uses this ladder, not the levels those records happen to hold today.

**EU Article 19 limit.** Ingredients above 1 % are in descending order; the sub-1 % tail may appear in any order and the boundary is not visible. Never infer exact percentages, ratios, pH, molecular weight, droplet size, viscosity grade, deposited amount, manufacturing process or active dose from a consumer list. Dimethicone at 5 cSt and at 1,000,000 cSt read identically (SR §C.2).

### 3.1.1 "Present as architecture" and "above the tail" — the operational marker **[new in v0.2 — DL defect register, BR §2.2]**

Almost every anchor in §7 turns on whether an ingredient is *present as architecture* or *above the tail*, and v0.1 never said how to decide. Both lanes had to invent a method; silence here guarantees divergence on every dimension at once. The method is now named, bounded and mandatory.

**Definitions.**

- **Present as architecture** — the ingredient is positioned such that it plausibly constitutes part of the product's structure rather than a token addition, *and* its family is coherent with the rest of the read (e.g. a fatty alcohol paired with a cationic surfactant, an oil with other lipids).
- **Above the tail** — the ingredient's rank is above the **tail marker** defined below.

**The tail marker (a heuristic, explicitly labelled as one).** The only boundary visible on a consumer INCI list is the rank of a **concentration-capped ingredient** — chiefly the common preservatives and preservative-adjacent materials whose EU or practical use levels sit at or below ~1 %:

> Phenoxyethanol · Sodium Benzoate · Potassium Sorbate · Benzyl Alcohol (as preservative) · Hydroxyacetophenone · Ethylhexylglycerin · Levulinic Acid / Sodium Levulinate · Chlorphenesin · Dehydroacetic Acid · Caprylyl Glycol (in a preservative pair).
>
> **The declared 26 EU fragrance allergens are not marker-eligible [removed in v0.4 — T17, hard-rule audit item H2].** They are declared last by EU convention, so including them guaranteed a near-terminal (vacuous) marker on any formula carrying no other capped material and pre-empted mandatory limit 2 below — the honest `none_visible` escape written for exactly those preservative-free naturkosmetik formulas. **Where a formula declares no other capped material, the marker is `none_visible` and limit 2 governs** (ordinal read, confidence lowered one step on every anchor that depended on it, routed to review) — the state the standard already defined for this case. A formula whose only near-terminal declaration is the allergen block is therefore read as marker-absent, never as marker-present-but-vacuous.

**The rule.** The **first** such capped ingredient in the list is the tail marker. Ingredients ranked **above** it are read as "above the tail"; ingredients at or below it are read as tail members. This is a **bounded rank observation**, which §3.1 permits — it compares two positions on the same list. It is **not** a percentage inference, which G4 forbids: no record may state or imply a percentage, a ratio or a concentration derived from this marker.

**Rank is the single deterministic prong [new in v0.3 — round-2 cluster 4, ref A3, blind A3/A8].** v0.2 defined "present as architecture" with **two** prongs — rank and coherence — and never said which governs when they disagree. Every §7 anchor says "present as architecture" while the operational rule measures only rank, so round 2's two lanes adopted opposite conventions on four polymeric or silicone-functional quats sitting just below their markers, moving up to six projected fields on a single product. Resolved:

1. **For every §7 anchor decision, "present as architecture" is decided on the rank prong alone.** Above the marker ⇒ present as architecture for anchor purposes; at or below it ⇒ not.
2. **The coherence observation survives as a recorded observation, never as an override.** Where the family read is incoherent — a lone fatty alcohol with no cationic partner, a plainly token addition sitting above a very late marker — record it in `counter_signals[]` and lower confidence by one step. It may **not** raise a value the rank prong does not support, and it may **not** lower one the rank prong does support.
3. **A qualifying route below the marker is not silently absent.** Mandatory limit 4 below already says the marker never creates presence — an ingredient below it is still present. Where a route that would otherwise *qualify* an anchor sits at or below the marker, the dimension takes its **rank-supported value**, the record carries the below-marker note that dimension defines, and it **routes to human review** (§14). §7.10 defines that note for R2 (`candidate_below_tail`); §7.6 and §7.9 carry the same discipline through their existing mandatory counter-signals.
4. This resolution is a **determinism decision, not an accuracy claim.** Its error direction is known and is the one the standard exists to guard: strict rank under-states persistence on a below-marker polymeric quat, which under-warns on buildup (FS-20). Clause 3's review route is what carries that risk to a human instead of into a projected field. The marker's own variance across list lengths remains an open gap (§17.14, §17.18).
5. **Clauses 1 and 3 apply only when the marker itself is plausible [new in v0.4 — T16, 2026-09-11, adjudicated against the Redken gold-set record].** The strict-rank prong (clause 1) and the below-marker routing (clause 3) may disqualify a route or ingredient **only when the marker sits *after* the product's own core conditioning architecture** — the ingredients that establish COND (§7.2) and WT (§7.5). Test it by rank comparison, so the condition is itself deterministic, not a judgment call: **plausible** when every ingredient establishing COND/WT outranks (sits above) the marker; **implausible** when the marker outranks (sits above) one or more of them — i.e. the marker sits *before* the architecture it is supposed to bound. Where the marker is **implausible**, it is unreliable and **may not be used to disqualify any route or ingredient on that record**: a route that would otherwise fail clause 1's rank test, or that clause 3 would otherwise route as below-marker, is instead read on its own merits, and the record carries a `tail_marker_implausible` note and **routes to human review** (§14) in place of the clause-3 mechanisms (`candidate_below_tail` and its siblings in §7.6/§7.9). *Motivation, recorded verbatim in substance:* Redken Extreme Anti-Snap's marker, Phenoxyethanol, sits at rank 3 of 24 — **before** the product's own main conditioning silicone, Amodimethicone, at rank 4 — which would absurdly place that silicone in the sub-1 % tail; a listing artifact, not a real 1 % boundary. Both calibration lanes had independently flagged this record as the tail-marker stress case (mandatory limit 3 below; §17.14, §17.18). This is narrower than mandatory limit 3: limit 3 already forbids collapsing COND/WT to `low` on an early marker; clause 5 additionally stops that same early, implausible marker from disqualifying a *different* route or ingredient under clause 1/3 elsewhere in the record. A marker that is merely early but still sits after the architecture it bounds (e.g. a persistent silicone established at rank 2, marker at rank 6) remains **plausible** and clauses 1 and 3 govern it exactly as before.
6. **A marker can also be implausibly late — vacuous — and that failure mode is the mirror of clause 5, not a repeat of it [new in v0.4 — T17, hard-rule audit item H1; vacuity test restated as a single exhaustive enumeration in **[freeze-prep housekeeping, 2026-09-13 — ledger row 20]**].** A tail marker is **vacuous** when **every** ingredient ranked **at or below** it belongs to the closed set below — i.e. the marker separates **no functional material**, so the above/below test decides nothing. Check it the same deterministic way clause 5 checks plausibility: read every ingredient at or below the marker's rank and confirm each one falls in the set.

   > **The closed set (exhaustive; membership is decided by the material's function on this list, not by whether §3.1.1 enumerates it as marker-eligible):**
   >
   > (a) **concentration-capped preservatives and preservative boosters** — this section's own marker-eligible list **and** any other declared material whose function here is preservation or preservative boosting (Caprylhydroxamic Acid, Sodium Dehydroacetate, Glyceryl Caprylate in a preservative pair, and comparable);
   > (b) **fragrance and allergen declarations** — the generic `Parfum` / `Fragrance` entry, any named declared EU allergen, and any named fragrance substance declared in its own right (e.g. Tetramethyl Acetyloctahydronaphthalenes, Hexamethylindanopyran);
   > (c) **colourants** — CI numbers, Chlorophyllin-Copper Complex and comparable;
   > (d) **pH adjusters, buffers and chelators at tail position** — Citric Acid, Sodium Hydroxide, Lactic Acid, Sodium Citrate, Tetrasodium EDTA / Sodium Phytate and comparable.
   >
   > **The complement is the whole of the non-vacuous case**: a tail containing **even one** ingredient outside (a)–(d) — a conditioning polymer, a quat, an oil, a butter, a wax, a fatty alcohol, an emulsifier, a humectant, an active, a botanical extract, a formulation antioxidant or stabiliser, or any other species not doing one of the four listed jobs — is **not** vacuous, and clauses 1–5 govern that marker unchanged.
   >
   > **A species whose job on the list is not settled by its INCI name sits outside the set**, so the marker is read as non-vacuous and clauses 1–5 govern; record the ambiguity in `threshold_reasoning[]`. Clause 6 is a narrow exception to the marker's normal reading, and an exception is not granted on an unsettled read.

   Where the marker **is** vacuous: it **cannot establish** "present as architecture" for any anchor on the strength of rank alone. An anchor that would be *raised* by treating everything above a vacuous marker as architecture instead takes the value the **coherence/ordinal read** (clause 2) supports; nothing may be credited as "present as architecture" solely because it sits above a marker that separates nothing. The record carries `tail_marker: vacuous`, naming the marker and its rank, and **routes to human review** (`tail_marker_vacuous`). Confidence is lowered one step on every anchor whose reading actually rested on the vacuous marker's rank boundary rather than on an independent coherence read. **Stated together with clause 5 and T16: an implausible marker can neither disqualify (clause 5 / T16) nor qualify (this clause) — plausibility, including not being vacuous, is a precondition of the marker being read at all, and no value may *improve* toward a recommendation solely on a vacuous marker (§1.1).**

   **Why the enumeration was made exhaustive, and what it settles [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** Through the unseen test this clause carried **two non-equivalent tests** in one paragraph: an opening strict enumeration ("capped materials from this section's own list, fragrance/allergen declarations, colourants") and a closing substantive sentence requiring the non-vacuous tail to contain "real architecture". They disagreed on exactly the materials that sit in a well-ordered tail and are neither: pH adjusters, and preservatives not on the marker-eligible list. Both sealed lanes flagged it independently (`plans/leave-in-inci/research/unseen-test/lane-a/notes.md` item 1, `lane-b/notes.md` convention A) and read it in opposite directions. **The substantive reading is adopted**, expressed as the exhaustive closed set above so that it is decided by reading the list rather than by judging what "real architecture" means, and the closing substantive sentence is deleted so only one test remains. **Worked against the frozen unseen packet, both markers are vacuous under this reading:** **u4** (Briogeo, 36 ingredients) — marker Potassium Sorbate r31, tail r31–r36 = Potassium Sorbate (a), Sodium Benzoate (a), Sodium Hydroxide (d), Fragrance (Parfum) (b), Caprylhydroxamic Acid (a), Benzyl Alcohol (a); **u5** (ISANA Argan, 18 ingredients) — marker Sodium Benzoate r11, tail r11–r18 = Sodium Benzoate (a), Potassium Sorbate (a), Tetramethyl Acetyloctahydronaphthalenes (b), Hexyl Cinnamal / Coumarin / Linalool / Alpha-Isomethyl Ionone (b), Citric Acid (d). Neither tail carries a species outside the set, so both take `tail_marker: vacuous` and `tail_marker_vacuous` — the reading lane B applied and the reading the T17 pass already applied to gold slots 6 and 12. **No value moves on any of those records**, here or in the test: on each one every anchor was established on the coherence/ordinal read at ranks far above the marker, which is exactly what clause 6 instructs a vacuous-marker record to fall back to. **One gold-set record additionally becomes vacuous under the widened set and is recorded rather than re-derived here: slot 11 (Balea Leichtkämmspray)** — marker Hydroxyacetophenone r7 of 11, tail r7–r11 = Hydroxyacetophenone (a), 1,2-Hexanediol (a, booster), Caprylyl Glycol (a), Citric Acid (d), Sodium Hydroxide (d). Under T17's strict enumeration the two pH adjusters and the booster fell outside and the marker read as ordinary; under the substantive reading the tail separates nothing. **Checked, and no value moves there either:** every anchor on that record is `low`, `none`, `none_visible` or `neutral_non_volatile`, decided on the coherence read of a six-species architecture at r1–r6, and clause 6 bites only where an anchor would be *raised* by treating everything above the marker as architecture — nothing is, so not even a confidence step is owed. The record gains `marker_status: vacuous` and the `tail_marker_vacuous` trigger at its next derivation; it is **not** edited in the freeze-prep pass (`reference-key-v4/transform-notes.md` §24). Every other gold-set and unseen record was re-checked against the widened set and its marker reading is unchanged — each carries at least one functional species in its tail (slot 3's Polyquaternium-10 r30, slot 7's formulation antioxidant r15, slot 13's Silicone Quaternium-18 r11, and so on) — and slots 6 and 12 were already vacuous under both readings. **Lane A's `very_late_tail_marker` for the same observation was the non-canonical alias** — that trigger names a *non*-vacuous late marker and is mutually exclusive with `tail_marker_vacuous` (§14); a tail meeting the closed set above fires `tail_marker_vacuous`, never `very_late_tail_marker`. This is still narrower than it may look: a marker that is merely late but separates at least one functional species is doing its job and is an ordinary marker (§17.18).

**Mandatory limits — this is a heuristic, not a measurement.**

1. **It is a heuristic and must be recorded as one.** Every anchor decision that turns on the marker records the marker ingredient and its rank in `threshold_reasoning[]`, and carries a `limitations[]` entry naming the heuristic. A reviewer who does not state the marker has not applied the rule.
2. **No marker present ⇒ no tail boundary is readable.** Do not guess one. Fall back to the ordinal read (how early and how many members of a family appear), record `tail_marker: none_visible`, and lower confidence by one step on every anchor that depended on it.
3. **An early marker is a strong counter-signal, not an automatic downgrade.** When the marker sits very high in the list — round 1 saw Phenoxyethanol at rank 3, placing an entire conditioning architecture nominally in the unordered sub-1 % tail — do **not** mechanically collapse COND and WT to `low`. Record the ordinal observation as a strong counter-signal, hold the value at the level the architecture supports, mark the field uncertain, and lower confidence. Reason: a capped preservative can legitimately be over-declared or sit adjacent to the boundary, and the tail is unordered, so a low-ranked non-volatile is *unpositioned*, not *absent*.
4. **The marker never creates presence.** An ingredient below the marker is still present; it simply cannot be read as architecture on rank alone.
5. It is a **within-list** marker only. Never compare marker positions across two different products' lists as if they were a common scale.

**Open gap.** No published method validates this heuristic against measured concentrations; it is a reading convention adopted so two reviewers reach the same answer, and it is listed as an open gap in §17.

### 3.1.2 The architecture reading convention **[new in v0.4 — T11, demoted from the FORM dimension]**

**Status.** Not a dimension, not a property-evidence object, not a separately reviewable item. This is a **reading convention** on the same footing as §3.1.1's tail marker: a fixed method so that every rule which needs to know a product's colloidal architecture — G0's boundary rationale (§2.3), the WT ceiling and G9 clauses (§7.5), and COND's routes (§7.2) — reads it the same way. It is consumed **inline**, recorded in the consuming rule's own `threshold_reasoning[]`, and carries no confidence band, no ceiling and no `review_status` of its own (§7.1).

**Definition.** Leave-ons are not a viscosity continuum; they are four distinct in-category systems plus one out-of-category one, read from the INCI list (SR §A.1).

**Values and anchors.**

| Value | INCI-visible anchor |
|---|---|
| `aqueous_or_hydroalcoholic_solution` | Water leading, optionally with glycol and/or alcohol early; **no LGN pair** — that is, no long-chain fatty alcohol *paired with a cationic surfactant*; a lone long-chain fatty alcohol does **not** block this row **[reworded in v0.3, see the note below]**; **no** true emulsifier — either nothing, or only solubiliser-type material (PEG-40 Hydrogenated Castor Oil, Polysorbate-20/-80, PPG-x-Buteth-x) **without** a real oil/silicone load behind it. A cationic polymer or short-chain quat is *typical but not required* |
| `emulsion` | **Any** true O/W emulsifying system carrying a lipid or silicone phase. Two sub-types, both fully in this row: **(a) LGN emulsion** — a cationic-surfactant + fatty-alcohol lamellar gel network pair (Behentrimonium/Cetrimonium/Distearyldimonium Chloride or Stearamidopropyl Dimethylamine **plus** Cetearyl/Cetyl/Stearyl Alcohol; often Glyceryl Stearate, Carbomer, Xanthan). **(b) Non-LGN emulsion** — a nonionic, polymeric or silicone emulsifier system with **no LGN pair**: pre-neutralised polyacrylamide/isoparaffin/laureth systems, Sodium Polyacrylate/Acrylate copolymer emulsifiers, Cetyl PEG/PPG-10/1 Dimethicone and other silicone emulsifiers, Glyceryl Stearate + PEG-100 Stearate, Ceteareth-x/Steareth-x pairs, Polyglyceryl-x esters |
| `microemulsion` | **Both** of: (i) a **solubiliser package** — two or more solubiliser-type materials (PEG-esters, PEG-hydrogenated castor oils, polysorbates, Trideceth-x, Laureth-x, PPG-x-Buteth-x), or one such material plus glycols high in the list; **and** (ii) a **real oil or silicone load present as architecture** (§3.1.1). **No LGN pair, no true O/W emulsifier.** Product clarity corroborates; it is not an INCI observation and never decides the row |
| `two_phase` | An **unemulsified** architecture: a water phase plus an oil and/or silicone phase, with **no emulsifier and no solubiliser package** capable of carrying that load. Decidable from architecture alone. A "vor Gebrauch gut schütteln" direction **corroborates** and is not required |
| `anhydrous_serum_or_oil` | No Aqua, or Aqua absent from the top → **out of category** (G0) |
| `unknown` | The formula is incomplete, or the architecture matches none of the rows above after all four have been tested in order |

**Decision order [new in v0.2 — DL C2].** Test the rows in this order and take the first match: `anhydrous_serum_or_oil` → `two_phase` → `emulsion` → `microemulsion` → `aqueous_or_hydroalcoholic_solution` → `unknown`.

**The solution ↔ microemulsion threshold [new in v0.2 — DL C2].** The two rows differ on **one** test, because a solubiliser is present in both: does the formula carry a **real oil or silicone load present as architecture**?

- Solubiliser package **plus** a real oil/silicone load above the tail ⇒ `microemulsion`.
- Solubiliser present but **no** oil/silicone load above the tail (the solubiliser is carrying fragrance or a trace active) ⇒ `aqueous_or_hydroalcoholic_solution`.
- A single solubiliser plus a single tail-position silicone is the ambiguous middle: return `unknown`, record both readings, and route to review.

**Which half carries a position requirement [tightened in v0.3 — round-2 cluster 6, blind A16].** Test (i), the solubiliser package, carries **no** position requirement: a solubiliser legitimately sits low in a list, and its rank says nothing about the load it carries. Test (ii), the oil or silicone load, **does** — it must be present as architecture (§3.1.1). Round 2 met a product whose two solubilisers sat below the marker while its silicone sat above it, and the two readings changed the architecture read. The asymmetry is deliberate and is now stated, which makes the example set above exhaustive: the **only** ambiguous middle is a **single** solubiliser plus a **single** oil or silicone species at or below the tail marker. A solubiliser *package* — two or more, at any position — plus one oil or silicone species above the tail is `microemulsion`, not the ambiguous middle.

**Notes on the rebuilt table.**

- The **cationic-required clause is gone** from the solution row (v0.1 required "cationic polymer and/or short-chain quat"). Round 1 produced water + oil + alcohol systems and eleven-ingredient detangling sprays that the clause pushed to `unknown` for no decision-relevant reason.
- The `aqueous_or_hydroalcoholic_solution` label deliberately covers both purely aqueous and hydroalcoholic systems. Whether alcohol is present is recorded in EXPO notes (§7.12), not here.
- **A long-chain fatty alcohol without a cationic partner** is not an LGN pair. Read it as an emollient/consistency factor and classify on the rest of the architecture; it does not by itself create the `emulsion` row (the sub-type (b) test is the emulsifier system, not the fatty alcohol). **This note governs over the solution row's exclusion clause, and the clause is reworded to match [new in v0.3 — round-2 overshoot list, ref A13].** v0.2's solution row excluded "a long-chain fatty alcohol" outright while this note told the reader to ignore exactly that observation and classify on the rest. A cream with a lone Cetyl Alcohol and no cationic partner therefore matched no row at all and the decision order returned `unknown` for no decision-relevant reason. The row now excludes the **LGN pair**, not the fatty alcohol.
- Fatty alcohols beyond the enumerated Cetearyl/Cetyl/Stearyl — e.g. Myristyl, Behenyl, Arachidyl — count for the LGN pair test when paired with a cationic surfactant. The enumeration is representative, not closed; record the reading.

**Reliability.** These classes are real and INCI-separable — that has not changed. A specific borderline product is a **moderate**-confidence read; the thin-lotion-vs-thick-milk boundary is rheological, not compositional, and **carries no decision weight** on the architecture read itself. Because this is a reading convention rather than a scored dimension, this reliability note is descriptive, not a ceiling to enforce — the rule that actually bites is the one stated wherever a consuming row uses this observation (WT's ceiling, §7.5; COND's anchors, §7.2).

**Not the presentation form.** The user-facing `product_form` (`spray | milk | lotion | cream | serum`) is a **separate, independently-captured identity fact** — pack, exact product name, directions of use — and is never derived from this reading convention (§10.1, T10). A `two_phase` read typically presents as a spray — every `two_phase` product in the gold set does — but that is an **observed correlation, not a derivation rule**.

**Trace-only companion value.** The LGN / non-LGN distinction stays part of this reading convention as `emulsion_subtype: lgn | non_lgn`, recorded wherever the architecture read is used; it is **not** projected (§10.1).

### 3.2 The leave-on E3 metadata requirement **[leave-in-specific]**

An E3 record that omits any of the following is **downgraded to E2**, because in leave-on use all four change the result (SR §J, §N.8):

1. **dose** — g product per g hair (laboratory convention for leave-on is ~0.2 g/g, roughly double the ~0.1 g/g rinse-off convention; this is a protocol figure, not consumer behaviour);
2. **damp vs dry** application;
3. **drying method** (air-dry, blow-dry, controlled oven, diffuser);
4. **ambient relative humidity** (and temperature, for any humidity or frizz endpoint).

E4 records additionally state substrate, damage state, sample size, comparator and endpoint.

### 3.3 The evidence firewall **[leave-in-specific, gate G8]**

Evidence generated under a **different exposure regime** may enter a leave-in record **only at E2, as mechanism** — never as product evidence, and never as an upgrade path. The regimes covered are:

- rinse-out conditioner and shampoo testing;
- pre-wash / post-wash oil treatments;
- in-salon, high-concentration, short-contact professional application;
- any protocol whose contact ends in a rinse.

The base case is FS-10: a rinse-out ingredient study does not prove leave-on performance. Three consequences worth stating because they are the ones people get wrong:

- **Amodimethicone's rinse-off selectivity argument does not transfer** (SR §C.3, FS-12).
- **Rele & Mohile's coconut-oil result was a pre-/post-wash oil treatment**, so it is E2 mechanism support for a leave-in containing coconut oil and nothing more — and it is specific to coconut oil, since the study's own mineral and sunflower comparators failed (SR §D.2, FS-19).
- **A leave-in carrying a "plex"/"bond" name inherits none of the salon bond evidence** — different concentration, contact time and often professional application (SR §H.2, FS-26).

A brand's claim being legal in the EU means a dossier exists somewhere (Reg. (EU) No 655/2013 common criteria). It does **not** mean an instrumental finished-product test exists, and it never converts an E0 claim into E3 evidence (SR §J).

---

## 4. Property-evidence record

Every direct property, flag and derived fit carries:

- `value`
- `decision_type` — `direct_product_property` | `derived_user_fit` | `flag` | `metadata`
- `confidence`
- `evidence_level` (E0–E5)
- `evidence_scope` — `formula` | `directions` | `product` | `routine`
- `rationale` (one to two sentences, English)
- `formula_observations[]` — exact INCI names with captured list positions, or a precise absence pattern
- `product_inferences[]`
- `supporting_signals[]`
- `counter_signals[]`
- `derived_from[]` — required for every derived user fit and every derived property
- `profile_fact_ids[]`
- `source_ids[]`
- `shared_mechanism_ids[]` (§6)
- `threshold_reasoning[]` — why the evidence clears this value **and** why the nearest lower/higher alternative does not
- `limitations[]`
- `review_status` — `draft` | `approved` | `provisional` | `specialist_review_required`

**Confidence vocabulary — the permitted set [new in v0.3 — round-2 overshoot list, blind A25].** v0.2 required a `confidence` value on every property-evidence object and never defined the permitted set, while §7's ceilings used "high / moderately high / moderate / low–moderate / low" informally. The two round-2 lanes adopted different scales, so confidence could not be diffed at all. The permitted set is exactly four values, **matching the conditioner engine**:

> `low` · `moderate` · `moderately_high` · `high`

Mapping for the §7 ceiling language, so a ceiling is machine-comparable: "high" ⇒ `high`; "moderately high" ⇒ `moderately_high`; "moderate" ⇒ `moderate`; **"low–moderate" ⇒ a ceiling of `moderate`**; "low" ⇒ `low`. There is no fifth value and no intermediate. A ceiling **caps** the value; it never sets it. Confidence is a research-trace artifact and never leaves the trace (§10.1.1, G14).

**Partial or conflicted evidence lowers the band; a limitation note does not substitute for lowering it [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** Where a field's evidence is partial, conflicted or incomplete — an unreadable or contested formula segment, a conflict this standard resolves but does not close, an anchor resting on a `none_visible`, implausible or vacuous tail marker, a value held across a source disagreement, a row §7 or §9 does not enumerate for the shape actually met — the field's confidence sits **one band below what its anchor would otherwise earn**, and its `limitations[]` entry **names the missing piece specifically** (which source, which species, which rank, which enumeration gap). Holding the anchor's band and explaining the shortfall in a limitation note instead is the **non-canonical** reading: it makes a partially-evidenced field indistinguishable from a cleanly-evidenced one in every machine comparison, which is what the band exists to prevent. The two sealed unseen-test lanes split on exactly this, systematically (lane A holding `low` where lane B held `moderate` with a note — `unseen-test-report.md` secondary finding 6). Four clauses bound it:

1. **One step, not a cascade.** A field takes **one** step down for being partially evidenced, however many partial inputs it has. Named, separately-stated step-downs elsewhere — §3.1.1 mandatory limit 2's marker-absent step, clause 6's vacuous-marker step, §2.4.2 tier 1's conflict step, §9's marker step — are *instances* of this rule, not additions on top of it. Two of them firing on the same field is still one step.
2. **It lowers confidence, never the value.** The value is what the anchor says (§4's closing rule). Partial evidence that is severe enough to leave the value itself unreadable is an `unknown`, which is a different decision made under §2.4.2/G5, not a confidence question.
3. **`low` is the floor.** A field already at `low` stays at `low`, with the limitation recorded.
4. **The note is required as well, not instead.** Lowering the band without naming the missing piece is as invalid as naming it without lowering the band — a reviewer must be able to see *what* would restore the band.

Formula observations state what is literally present. Product inferences state what might follow. **A derived fit without both `derived_from` and `profile_fact_ids` is invalid.** Generic "formula-derived" or value-restating `threshold_reasoning` is invalid.

**Mandatory counter-signals [new in v0.2 — ruling R13].** Some anchors in §7 are reachable *only* with a recorded counter-signal; the record is invalid without it. These are:

| Anchor | Mandatory counter-signal |
|---|---|
| WT `moderate` via the two-or-more-families row (§7.5) | The multi-family observation itself: which families, at which ranks, and why the absent rich-band member holds the value below `high` |
| PERS when a monomeric long-chain quat is the dominant persistent species (§7.6) | The likely-under-stated-persistence note |
| Any anchor decided on the §3.1.1 tail marker | The marker ingredient, its rank, and the heuristic limitation |

**Removed in v0.4 — T9.** HUM's `formula_plausible`-with-humectant counter-signal governed this table through v0.3. HUM is gone, so the anchor it protected is gone with it. The guardrail it existed to enforce — a humectant is never support for an anti-frizz reading, in either direction — is not lost: it survives generally as **FS-6/FS-15** (§12), which bind any future consumer of a humectant observation, not only the removed anchor.

**Counter-signals, confidence and uncertainty are research-trace artifacts.** They exist to make a value auditable and re-openable. They are **never projected into a user-facing field** and are dropped at projection — see §10.1.1. A counter-signal is not a hedge that shifts a value; the value is what the anchor says, and the counter-signal says why a reviewer should be able to reopen it.

---

## 5. Route dictionary (L1–L9)

A route is a *candidate* mechanism visible in the formula. A route is never a performance conclusion and never a user fit.

### L1 — Cationic conditioning route

Evidence: long-chain quats (Behentrimonium Chloride/Methosulfate, Cetrimonium Chloride, Distearyldimonium Chloride), protonatable amidoamines (Stearamidopropyl Dimethylamine + acid), cationic polymers (Polyquaternium-10/-7/-11/-55, Guar Hydroxypropyltrimonium Chloride), silicone quats (Silicone Quaternium-16/-22), cationised proteins.

Permitted E2 statement: "contains a leave-on cationic conditioning route."

Leave-on reading (SR §B.1–B.2): the whole applied dose stays, so deposition efficiency stops being the bottleneck; leave-ins typically run **lower cationic active levels** and shift toward lightweight film-forming cationic polymers. Charge density is the main lever on substantivity **and** on buildup — the same lever, read from two ends. Silicone-quat behaviour is supplier/trade-literature dominated and must be labelled as such.

Do not infer lamellar phase, deposited amount, combing force, sensory richness or user fit.

### L2 — Silicone system route

Split the silicones before reasoning (SR §C.2):

- **Volatile carriers** — Cyclopentasiloxane, Cyclohexasiloxane (both decaying under §15), Disiloxane, Hexamethyldisiloxane, Trisiloxane; and volatile hydrocarbons Isododecane, Isohexadecane. They lower apparent viscosity, aid spreading, and evaporate. **Contribution to residue and to persistence: zero.**
- **Persistent silicones** — Dimethicone, Dimethiconol (usually as a Dimethicone/Dimethiconol blend), Amodimethicone, Bis-Aminopropyl Dimethicone, silicone quats. These are the residue.
- **Easily removed** — PEG-modified silicones (e.g. PEG-x Dimethicone) and other water-dispersible variants.

Permitted E1/E2 statement: "contains a volatile carrier and/or a persistent silicone film route."

**The residue is whatever the volatile was carrying.** "Contains a volatile silicone, therefore leaves no residue" is false (FS-4). Amino silicones and silicone quats are marketed on wash resistance; wash resistance and buildup are the same property (FS-13).

### L3 — Lipid / emollient route, organised by spreading value

The predictive variable is **spreading value**, not "oil vs butter" (SR §D.1). Ordering, **moderately supported**:

| Band | Representative INCI | Leave-on read |
|---|---|---|
| Dry-feel / high spreading | Isododecane, Isohexadecane, C13-15 Alkane, Coco-Caprylate, Isoamyl Laurate, Dicaprylyl Carbonate, Isopropyl Myristate | Slip and spread, low perceived greasiness, low weight penalty; IPM carries a known negative "grating/dry" sensory note |
| Medium | Caprylic/Capric Triglyceride, Squalane, Jojoba (a wax ester), light silicones | The workhorse band for leave-in milks |
| Rich / low spreading | Coconut, Olive, Castor, Avocado oil; Shea/Mango/Cocoa Butter; petrolatum, heavy mineral oil | Occlusion, weight, transfer to skin/pillow — the greasiness risk band |

**Transfer** (to skin, collar, pillow, phone) is predicted mechanistically by low-spreading, non-volatile, non-film-forming lipid load. **No published instrumental transfer method for hair leave-ons surfaced** (SR §D.3, §M.3). It is a qualitative caution attached to WT — never a scored dimension.

Fatty alcohols consumed by the L1 lamellar pair are **not** counted again as hero emollients.

### L4 — Humectant / plasticiser route

Evidence: Glycerin, Propanediol, Butylene/Pentylene Glycol, Sodium PCA, Betaine, Panthenol.

Permitted E2 statement: "contains a humectant/plasticiser route supporting softness at ordinary indoor humidity, and supporting film pliability."

**What this route may never support:** anti-frizz or humidity resistance, in either direction (SR §E, FS-6, FS-15). The best-supported anti-frizz mechanism is *reducing* water uptake; a humectant's function is to *increase* water association. **[v0.4 — T9: HUM, the anchor this route used to counter-sign, is removed from the model entirely.]** The guardrail is unchanged and now stands on its own: a humectant observation is never support for an anti-frizz reading, whatever downstream field might one day read it — this is FS-6/FS-15 (§12), not a HUM-specific rule. The "~60 °F / 15 °C dew-point" threshold is community folklore with no peer-reviewed source and must never be encoded (FS-16).

Panthenol is treated separately in L6.

### L5 — Fixative / film-forming polymer route

Evidence: PVP; VP/VA Copolymer; VP/Acrylates/Lauryl Methacrylate Copolymer; **VP/Methacrylamide/Vinyl Imidazole Copolymer [v0.3]**; Polyurethane-14 (and) AMP-Acrylates Copolymer; acrylates copolymers used as fixatives; PVP/DMAPA Acrylates Copolymer.

Permitted E2 statement: "contains a fixative-class film route."

Established chemistry (SR §F.1): PVP is hygroscopic and loses film stiffness as RH rises; VP/VA raises the hydrophobic fraction and improves humidity resistance at some cost in flexibility; crosslinked polyurethane/acrylate hybrids were developed for firm hold with restyleability. **Confidence high that these families differ; confidence low that a particular leave-in delivers a particular hold level**, because polymer level, plasticiser load and the competing conditioning phase are all invisible.

**L5 rheology exclusion (mirrors conditioner R5).** Carbomer, Xanthan Gum, Hydroxyethylcellulose, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, gums and starches that plausibly serve bottle viscosity are **not** a hold route by themselves (SR §F.2 boundary caution, FS-25).

**Two families enumerated, with their HOLD consequences [new in v0.3 — round-2 cluster 6, blind A13].** v0.2 left both unenumerated, and §21.1 recorded them as "resolved by analogy" in round 1 without saying which way. Round 2's blind lane therefore had to guess at an analogy it could not see, and the guess set HOLD on three products. Enumerated now:

| Material | Family placement | HOLD consequence |
|---|---|---|
| **VP/Methacrylamide/Vinyl Imidazole Copolymer** | **Fixative-class — an L5 member.** A vinylpyrrolidone-based film former of the same structural family as PVP and VP/VA | It is a fixative-class polymer for §7.7. Present as architecture with a substantive conditioning architecture dominating ⇒ `incidental_film`; present in a film-forming context with **thin or absent** conditioning behind it ⇒ `meaningful_hold_route`, and the G0 styling review under §2.3.2. At or below the tail marker it sets nothing (§3.1.1) |
| **Polysilicone-29** | **Silicone film-former family — *not* fixative-class by default.** A silicone polymer film former, read with the L2 persistent silicones, not with the vinyl/acrylate fixatives | It **does not set HOLD on its own**: a formula whose only candidate hold polymer is Polysilicone-29 is HOLD `none`. It contributes to the L2 persistent-silicone film, so it feeds `smoothing_route` (§7.4), PERS and WT, and it may sit inside an `incidental_film` read only where an **independent** fixative-class L5 member is also present. Reading it as a hold polymer would be FS-9 exactly |

Both entries are **family placements, not performance conclusions**: they say which dictionary route the material belongs to, and the §7.7 anchors then decide the state on the rest of the architecture. **Polyacrylamide remains unenumerated** — round 2 produced no disagreement on it — and is recorded as an open gap (§17.19) rather than resolved here.

**Anionic/cationic pairing check.** A high-charge polyquaternium and a carboxylated acrylate fixative both high in the same INCI is unusual; formulators normally pair cationic conditioning with nonionic or amphoteric film formers. Treat it as a **read/identity check**, not a performance conclusion (SR §B.3).

### L6 — Substantive protein / silane film route

Evidence: cationised proteins (Hydroxypropyltrimonium Hydrolyzed Wheat/Rice/Keratin Protein), silane derivatives (Hydrolyzed Wheat Protein PG-Propyl Silanetriol), peptides, silicone quats, cationic polymers — in a plausible film-forming context.

Permitted E2 statement: "contains a possible substantive surface-film route."

**Route ≠ dimension value [v0.2].** L6 is the *mechanism dictionary*; the R2 dimension (§7.10) applies a **narrower closed list** — cationised protein, silane derivative, silicone quat — and excludes non-silicone cationic polymers and peptides from `candidate`, because "high charge density" is not readable from an INCI list (G4). An L6 observation that does not clear the R2 list is recorded as L6 evidence feeding PERS and `smoothing_route` (§7.4), and R2 stays `none_visible`.

Limits (SR §H.1): moderately supported for film/feel/body effects; **not supported** for structural repair. The area is supplier-dominated and molecular-weight figures come from datasheets, not independent measurement. Generic gums, starches and rheology polymers are excluded.

**Panthenol is a fibre-mechanics signal, not a surface-film signal and not a heat signal.** Marsh et al. 2026 report imaging evidence of penetration into cortical protein regions and higher break stress versus control — with the caveats that it is a single industry-affiliated research group, model-system mechanics, and not a leave-in finished-product result. That justifies "low-confidence mechanistic support for fibre mechanics" and nothing above it (SR §H.1, FS-24).

### L7 — Bond-claim review route

Evidence: an exact product claim plus a named or explicitly described chemistry (e.g. Bis-Aminopropyl Diglycol Dimaleate) plus product-level substantiation.

A recognised chemistry opens a **`bond_claim_review` flag** and never sets a repair level (SR §H.2). Independent spectroscopy found **none** of the investigated α,β-unsaturated Michael-acceptor repairing agents increased disulfide content in the hair cortex; most supportive published work is manufacturer-funded. "K18"/"Plex"/"Bond" naming is E0. Salon-regime evidence is barred by G8.

### L8 — Fragrance, alcohol and scalp/skin exposure route

`Parfum`, `Fragrance`, `Aroma`, the 26 EU-labelled fragrance allergens and clearly aromatic essential oils are **exposure signals**. `Alcohol Denat.` / `Alcohol` materially present is recorded as an additional exposure note.

Leave-on raises this above its rinse-out relevance: contact is all-day fibre, skin, neck and sometimes scalp (SR §K EXPO).

Allowed values: `fragrance_declared` · `aromatic_or_allergen_exposure` · `no_listed_fragrance_signal` · `unknown`.

**"No listed fragrance signal" is not fragrance-free, not allergy-safe and not hypoallergenic** — labelling thresholds and incomplete formulas prevent those claims, and the EU technical document to Reg. 655/2013 addresses "free from" and "hypoallergenic" specifically. Flags are exposure statements; they never predict tolerance (SR §M.12).

### L9 — Evidenced heat-protection polymer route (closed list)

The **only** members are the polymers with published protection data (SR §G.1):

- **Zhou et al. 2011:** VP/Acrylates/Lauryl Methacrylate Copolymer · Polyquaternium-55 · the polyelectrolyte complex of PVM/MA Copolymer with Polyquaternium-28
- **McMullen & Jachowicz 1998:** PVP/DMAPA Acrylates Copolymer · Quaternium-70 · hydrolyzed wheat protein (one specific protein at a defined concentration in a model system)

The list is **closed**. Adding a member requires new peer-reviewed evidence and a standard-version bump. Generic silicone, generic protein, panthenol and oils are **not** on it (§13).

**L9 tail-member rule [new in v0.2 — DL defect register, BR §2.13].** Membership of the closed list is necessary, never sufficient. Hydrolyzed wheat protein is both an L9 member (McMullen & Jachowicz tested one specific protein at a defined concentration in a model system) and a routine tail ingredient in mass-market leave-ins, so a literal reading of §13.2 would have promoted an unclaiming naturkosmetik spray to `formula_plausible`. Therefore:

1. An L9 member that is **not above the tail** (§3.1.1) is **not** in "a plausible film-forming context" and produces **no state upgrade**. Record the observation in the trace with the tail marker and stop.
2. An L9 member present with **no C1/C2 claim** (§2.4.1) produces **no state upgrade and no binary change**: the trace state stays `not_claimed`, and the binary stays `false` per §13.3 rule 3. A formula does not manufacture a claim.
3. The two rules compose: an upgrade to `formula_plausible` requires an L9 member **above the tail** *and* a C1/C2 claim.
4. The study context is recorded, not inherited: for hydrolyzed wheat protein the published result is at a defined concentration in a model system, which the INCI list cannot confirm. That is itself a mandatory limitation on any `formula_plausible` resting on it.

---

## 6. Shared mechanisms and anti-double-counting (G3)

Anti-double-counting is harder in leave-on than in rinse-out: in rinse-out, M1 feeds conditioning, slip and weight; in leave-on it feeds conditioning, slip, smoothing, shine, weight **and** persistence (SR §N.6). The §7 merges exist mainly to keep G3 enforceable, and **v0.4's trim (T1, T2, T3) removes three of the places where the same M1 observation could be read a second time as its own score.**

| ID | Mechanism | Fed by | Feeds |
|---|---|---|---|
| `M1_DEPOSITION_SURFACE_LUBRICATION` | Lubricating deposit on the fibre | L1, L2 persistent, L3 | COND (**including the absorbed slip observation, T1**), WT, PERS, `smoothing_route` |
| `M2_SUBSTANTIVE_FILM_SUPPORT` | Charge-substantive protein/polymer film | L6 | R2, PERS, care_direction, `repair_support_level` |
| `M3_OPTICAL_ALIGNMENT_FILM` | Shine as the optical consequence of alignment | M1, M2 | The SHN entry of the **Hinweise** record only (§8) |
| `M4_CLAIM_ONLY_PROPRIETARY` | A claim with no product-specific substantiation | L7, marketing | The R3 entry of the **Hinweise** record, HEAT `claim_only` **(the only claim-led field from v0.4 — T9)** |
| `M5_FIXATIVE_FILM` | Fixative film welding fibre-to-fibre contacts | L5, L9 | HOLD, the CURL entry of the **Hinweise** record, HEAT when an L9 member |
| `M6_VOLATILE_CARRIER` | Spreading and dry-down, then evaporation | L2 volatile, L3 dry-feel volatiles | The §3.1.2 architecture reading convention **[v0.4 — T11: no longer FORM, a dimension; the same observation now feeds the architecture read directly]**, the slip bias recorded inside COND; **contributes nothing to WT or PERS** |
| `M7_HUMECTANT_PLASTICISER` | Water association, film pliability | L4 | COND softness component; **feeds no field from v0.4 — HUM, the anchor it counter-signed, is removed (T9). The guardrail survives as FS-6/FS-15, not as a mechanism feed** |

**Rules.**

1. Several ingredients may raise confidence in **one** mechanism. They do not create several independent technologies. A "10-in-1" label is not ten mechanisms (FS-11).
2. One mechanism must not independently score conditioning, weight and persistence as if each were separate evidence. **v0.4 removes the three worst offenders structurally rather than by rule** — slip is no longer a score (T1), smoothing is no longer a score (T2) and dose sensitivity is no longer a score (T3) — so the remaining discipline is about the scores that are left, not about restating a merge.
3. A direct property may reach its top value at E2 only when **multiple independent, endpoint-relevant** formula observations support the route and no material counter-signal exists.
4. **The persistence/buildup rule.** PERS and the buildup caution are the *same* evidence read from two ends. Scoring PERS high while presenting buildup as low is a G3 violation in the most damaging direction (SR §C.3, §K WASH, FS-13).
5. **The shine rule.** SHN may not carry an independent value that merely restates the M3 consequence of the M1/M2 film (SR §K SHN).
6. The rationale must say "potential" and preserve the cap.

---

## 7. The 7 scored dimensions **[trimmed from 13 in v0.4 — T1, T2, T3, T9, T11, T12]**

Formula-only values describe **potential**, not measured performance. The `Ceiling` column is the formula-only confidence ceiling adopted from SR §K.

**Section numbering is stable across the trim.** §7.1 (FORM), §7.3 (SLIP), §7.4 (SFR), §7.9 (HUM), §7.11 (DOSE) and §7.13 (ROLE) keep their numbers and become removal records that state what happened to the observation, so every earlier citation still resolves and no reader mistakes a deletion for an oversight.

Summary table:

| # | Code | Field | Values | Formula-only ceiling |
|---|---|---|---|---|
| 1 | COND | `conditioning_potential` | low / moderate / high / unknown | Moderately high |
| 2 | WT | `weight_residue_potential` | low / moderate / high / unknown | Moderate; moderately high only under §7.5 |
| 3 | PERS | `persistence_removal_class` | 4 ordinal mechanism classes / unknown | **Low–moderate** |
| 4 | HOLD | `hold_route_state` | none / incidental_film / meaningful_hold_route | Moderate for the coarse state only |
| 5 | HEAT | `heat_protection_evidence_state` | not_claimed / claim_only / formula_plausible / product_tested | **Low** |
| 6 | R2 | `repair_surface_film` | none_visible / candidate / tested / unknown | Low–moderate |
| 7 | EXPO | `fragrance_scalp_exposure` | L8 values | Moderate for flags |

**Removed in v0.4, with their observations preserved:**

| Removed | Was | Where the observation lives now |
|---|---|---|
| FORM (§7.1) | `product_form_architecture` | **Split in two (T11, §7.1).** The presentation-form half is unchanged — it was already the profile's `product_form` property, captured at identity, independent of the architecture read (T10, §10, §10.1). The architecture-analysis half survives as the **§3.1.2 reading convention**, consumed inline by G0's boundary rationale (§2.3, unchanged — it already owned its own evidence), the WT ceiling and G9 clauses (§7.5), and COND's routes (§7.2) |
| SLIP (§7.3) | `slip_combability_potential` + bias | Inside the COND evidence object as the **absorbed slip observation** (T1, §7.2) |
| SFR (§7.4) | `ambient_smoothing_alignment_potential` | As the typed trace input `smoothing_route` feeding the `smoothing` focus row (T2, §7.4, §10.2) |
| HUM (§7.9) | `humidity_resistance_evidence_state` (claim-led ladder) | **Nowhere — removed completely, not re-homed (T9, §7.9).** The anti-frizz *user need* it partly served is already reachable, without a humidity claim, through the `smoothing` focus (§10.2); the humectant≠anti-frizz guardrail survives as FS-6/FS-15 (§12); the quoted manufacturer claim itself is not taken up anywhere in the model |
| DOSE (§7.11) | `dose_sensitivity` (derived) | Nowhere in this model. The app's existing application-guidance layer carries general dosing advice; the standard stops asserting a per-product dose sensitivity (T3, §7.11) |
| ROLE (§7.13) | `usage_role[]` (5 roles, scored) | **Split three ways (T12, §7.13).** `post_wash` and `curl_styling` are dropped, carrying no information the product already stated elsewhere. `refresh`'s one informative bit — dry-hair usability — survives as **identity data**, `application_stage: dry_hair`, captured judgment-free at G1 (§2.4) exactly like a GTIN, and read from G1's general directions hierarchy rather than ROLE's C1/C2 claim-tier gate. `heat_styling` is dropped as a role and is not re-homed: the `heat_styling` focus now keys directly on `application_stage` including `pre_heat` (alongside `provides_heat_protection`, unaffected — §13.3). `ends_only` becomes an application-guidance note, alongside the two-phase shake instruction (§17 item 27) |

### 7.1 FORM — **removed as a scored dimension in v0.4 (T11)**

**Status: not a dimension.** `product_form_architecture` is removed from §7 by Nick's ruling T11 on 2026-09-10. The section number is retained so earlier citations resolve.

**What was removed and why.** T10 had already made FORM's architecture value trace-only and never projected, leaving the presentation form (`product_form`) as the only part of this dimension the lean profile actually used. A dimension whose value is never projected, and whose only remaining job is to feed reasoning inside the rows that consume it, does not need its own property-evidence object, confidence band, ceiling or review row — it needs to be **read correctly wherever it is used**, which is what a reading convention is for. T11 finishes the move T10 started: the architecture taxonomy is **retained in full**, because the classification work it does is real and still required (G0's boundary decision, WT's ceiling, COND's routes all depend on it); only its status as an independently-scored, separately-reviewable dimension is removed. This is the same kind of demotion T2 already made for `smoothing_route` (a typed trace input, not a scored dimension) and T8 made for the echo fields (an annotation, not a separately reviewable row) — applied here to the one dimension T10 had already made trace-only.

**Where the observation went.**

| Was carried by FORM | Now |
|---|---|
| The presentation-form value the user holds (`spray \| milk \| lotion \| cream \| serum`) | **Unchanged.** Already the profile's `product_form` property, captured independently at identity (E1: pack, exact product name, directions), independent of the architecture read (T10, §10, §10.1). T11 does not touch `product_form` at all |
| The architecture taxonomy — 4 in-category architectures + 1 exclusion, the decision order, the solution↔microemulsion threshold, the LGN/non-LGN notes | **§3.1.2**, a trace reading convention stated alongside §3.1.1's tail marker. Consumed inline, in the consuming rule's own `threshold_reasoning[]`: G0's `excluded_anhydrous` rationale (§2.3 — **unchanged**, it already carried its own architecture evidence and never depended on a separate FORM row), the WT ceiling and both G9 clauses (§7.5), and COND's routes (§7.2) |
| `emulsion_subtype: lgn \| non_lgn` | Stays trace-only, now recorded as part of the §3.1.2 reading convention rather than a FORM record (unchanged in substance since T10, §10.1) |
| The two-phase dose-variability note, the §18 shake caution, the §14 two-phase review trigger | Still fire off the architecture read resolving to `two_phase`, now recorded inside WT's G9 clause 3 (§7.5) rather than a standalone FORM record — all unchanged (§17 item 27 is unaffected: it already keyed on this same architecture read) |

**What is prohibited.** No record may emit `product_form_architecture`, a FORM value, a FORM confidence band, or a FORM ceiling. No property-evidence object exists for the architecture read. It is recorded only inline, inside the `threshold_reasoning[]` of the row that depends on it (G0, WT, COND) — never as a field of its own.

**Gates.** G9 is restated to reference the architecture read instead of a FORM value; its substance is unchanged — see §7.5 and §11.

**False signals.** FS-1, FS-2, FS-17, FS-18 (§12): water-first ≠ light; spray ≠ light and cream ≠ heavy; clear ≠ light (a microemulsion is transparent by droplet size, not by low oil load, and can out-deposit an opaque milk); no-emulsifier ≠ no lipid load (a two-phase spray carries an oil phase by design).

### 7.2 COND — conditioning potential

**Definition.** Overall leave-on lubrication and substantive conditioning delivered by the complete architecture. **R1 "repair lubrication" is folded in here (ruling 5):** friction reduction and grooming-breakage prevention are the *same* M1 mechanism; "reduces grooming breakage" is an explanation frame derived from COND, not a separate score (SR §K R1).

**Ceiling: moderately high.** Removing the rinse removes deposition efficiency, the least predictable variable in rinse-out conditioning, so conditioning architecture is *more* formula-readable here than in the rinse-out standard. It stays capped at E2 because concentration is invisible and product form modulates delivery (SR §K COND).

**Anchors.**

| Value | Anchor |
|---|---|
| `high` | An LGN pair present above the tail **plus** at least one further independent lubrication route (persistent silicone, medium/rich-band emollient, or a cationic polymer) |
| `moderate` | One coherent conditioning route: a cationic-polymer film route (PQ-10/-7/-11/-55, Guar HPTC) **or** a persistent silicone/emollient package — without a full LGN pair |
| `low` | Only a short-chain quat, or a water/glycol solution with no persistent non-volatile above the tail |
| `unknown` | Formula or product form unresolved |

**The absorbed slip observation [new in v0.4 — T1].** SLIP was a separate score reading the *same* M1 deposit through the *same* mechanism as COND, and §7.3 already conceded that scoring wet and dry slip apart is the anti-double-counting violation G3 exists to prevent. Nick's ruling T1 finishes that argument: **slip is not a property of this model.** Its observation is absorbed into COND's evidence object and nothing else changes:

1. **COND's `supporting_signals[]` carries the slip observation** — which M1 contributors are present as architecture, and, where the architecture settles it, the wet/dry bias reading that §7.3 used to carry as a qualifier. It is recorded as an observation about combing force, never as a value.
2. **It may not move the COND value.** The COND anchors are unchanged, and an absorbed slip observation is by construction the same M1 evidence the anchor already counted (G3). A record whose COND value rests on the slip observation alone is invalid.
3. **It is the input the two consumers that used SLIP now read.** The `detangling` focus row (§10.2) and the `texture_fit` row-3/row-4 modifier (§10.3) name the absorbed slip observation in COND's record instead of a SLIP value; **their thresholds and their resulting values are unchanged**, because the observation is the same observation.
4. **No slip value is projected.** The lean profile has no slip field and never had one; the trim removes a *reviewable* dimension, not a matching field.
5. The bias reading inherits open gap §17.16 unchanged — it was `unknown` on 8 of 12 profiled round-2 records, and folding it into COND neither fixes nor hides that.

**Gates.** G3 (one M1 observation may not also independently maximise COND, WT and PERS, and the absorbed slip observation is that same observation); G4.

**False signals.** A hero ingredient in the sub-1 % tail is not an architecture. "Moisture" language without a route (HO §9). Bottle rheology is not conditioning (FS-25). Bottle thickening or perfume read as a slip signal (HO §9). Quoting an instrumental combing improvement as a consumer-perceptible benefit — a 2018 study of actual consumer combing frequency and per-hair forces indicates the lab protocol does not map cleanly onto real grooming (FS-22).

### 7.3 SLIP — **removed in v0.4 (T1)**

**Status: not a dimension.** `slip_combability_potential` and its bias qualifier were removed from the model by Nick's ruling T1 on 2026-09-05. The section number is retained so earlier citations resolve.

**What was removed and why.** SLIP was already declared a *shared* property capped at `moderate`, reading the same M1 deposit as COND through the same mechanism, and §7.3 itself said that scoring wet and dry apart is the violation G3 exists to prevent. Two rounds then showed the residual half was not readable either: the bias qualifier returned `unknown` on 8 of 12 profiled round-2 records (§17.16), and open gap §17.5 — whether wet and dry slip separate from formula at all in leave-on — is unresolved and not resolvable from an INCI list. A separately reviewable score sitting on that evidence base invited a reviewer to adjudicate a value the standard could not defend.

**Where the observation went.** Into COND's evidence object as the **absorbed slip observation** (§7.2). Nothing is lost: the two rules that consumed a SLIP value — the `detangling` focus row (§10.2) and the `texture_fit` slip modifier (§10.3) — now name that observation, at the same thresholds, producing the same values.

**What is prohibited.** No record may emit a `slip_combability_potential` field, a slip score, a slip bias as a value, or a lean-profile slip member. Wet-combing evidence still never upgrades a dry endpoint and vice versa; at E3 both endpoints stay in the research trace, because instrumented wet-combing data genuinely does not prove dry combing.

**Open gaps §17.5 and §17.16 stay open.** They are not closed by the removal — a gap does not go away because the field that exposed it did. They are re-scoped: they now describe what the absorbed observation cannot support, not what a score got wrong.

### 7.4 SFR → `smoothing_route` — **descored in v0.4 (T2)**

**Status: not a scored dimension; a typed input.** `ambient_smoothing_alignment_potential` no longer carries a low/moderate/high value and is no longer a reviewable row anywhere. Nick's ruling T2 converts it into **`smoothing_route`**, a typed observation recorded in the research trace and consumed by exactly one rule — the `smoothing` focus row (§10.2).

**The type set (closed):**

| `smoothing_route` | Recorded when the alignment/film route read from the formula is |
|---|---|
| `silicone_film` | A persistent silicone film system — Dimethicone, Dimethiconol, Phenyl Trimethicone, Amodimethicone, a silicone quat, or a silicone polymer film former |
| `cationic_alignment` | A substantive cationic-polymer film — Polyquaternium-x, Guar Hydroxypropyltrimonium Chloride and family |
| `emollient` | A medium- or dry-feel-band emollient package with no continuous film former |
| `fixative_film` | A fixative-class L5 film (§5) doing the alignment work |
| `none` | No alignment route: water phase and humectants only |

**How it is derived.** From the **existing SFR and §6 mechanism evidence, unchanged** — the same formula observations the v0.3 SFR anchor read, typed by which mechanism family carries the film rather than graded. It is a **classification of the observation, not a new judgment**: a record states the species and ranks that establish the route exactly as the SFR anchor required, and the v0.3 SFR value it would have produced is retained in the trace for diffability.

**Where the two-observation test went.** It is **unchanged and it moved to the consumer**: the `smoothing` focus row (§10.2) still requires two distinct formula observations — the continuous film route, and a lubrication route resting on at least one ingredient observation not among those establishing the film — and still refuses a route that is baseline conditioning under §10.2.1. The v0.3 clauses below are preserved verbatim as that row's test, so no product's `focus.primary` moves on the descoring alone.

**Where it appears.** Only inside the `focus` row's evidence in the Lab, and in the trace. It has no row of its own, no confidence band of its own and no lean-profile projection (G14).

**Prohibited.** No `ambient_smoothing_alignment_potential` value in any record. No `smoothing_route` in any user-facing or matching field. `smoothing_route` never makes a humidity or frizz statement — the word "frizz" stays absent, and it stays absent even though HUM, the field that once held that territory, is removed entirely (T9, §7.9): the prohibition was never "leave frizz to HUM", it was "frizz is not readable from a formula", and that reason survives HUM's removal unchanged.

**The v0.3 SFR rule, retained as the `smoothing` route test:**

#### 7.4.1 SFR — the retained anchor text *(narrowed, ruling 5)*

**Definition.** Surface alignment and lubrication smoothing **at ambient conditions**. The word "frizz" is deliberately absent: humidity-driven frizz control is not readable from formula at all. Leaving "frizz" in this definition would make the dimension silently carry an unsupported humidity claim (SR §K SFR). **[v0.4 — T9: this row previously deferred anti-frizz to HUM (§7.9); HUM is now removed from the model entirely, and this row's own no-humidity-claim discipline is what the anti-frizz user need now falls back on — `smoothing` addresses the mechanistically-supported surface-alignment part of that need, and never the humidity claim itself, exactly as before.]**

**Anchors.**

| Value | Anchor |
|---|---|
| `high` | A continuous surface-film route — persistent silicone (Dimethicone/Dimethiconol/Amodimethicone/silicone quat) or a substantive cationic-polymer film — **plus** a lubrication route resting on a **separate** endpoint-relevant observation (see the G3 resolution below) **[tightened in v0.3]** |
| `moderate` | One alignment route: a medium/dry-feel emollient package or a single film former |
| `low` | No persistent film; water phase and humectants only |
| `unknown` | Architecture unresolved |

**Ceiling: moderate** — correct *once narrowed*. **[v0.4: a ceiling on a value the model no longer emits. It is retained because it states the evidence bar the `smoothing` route test inherits: a formula-only alignment read is never better than moderate, which is why `smoothing_route` is typed rather than graded.]**

**Gates.** G3 (the alignment read shares M1/M2 with COND — the qualifying route needs an endpoint-relevant *additional* observation, not a restatement). G4.

**The anchor and the G3 note reconciled — G3 governs [new in v0.3 — round-2 cluster 2, ref A4].** v0.2's `high` anchor asked for a film route "plus a lubrication route" while its own gate note demanded an *additional* observation rather than a restatement. Because COND typically reads the same architecture, the two gave opposite answers on six of thirteen round-2 products, and the disagreement propagated straight into `focus.primary` through the §10.2 `smoothing` row. **Resolved in G3's favour:**

1. **A qualifying smoothing route requires two distinct formula observations** (in v0.3 terms, SFR `high`), not one architecture read twice: the continuous film route, **and** a lubrication route resting on at least one ingredient observation that is *not* among the observations establishing the film route.
2. A Dimethicone/Dimethiconol pair, an amino silicone plus its own carrier, or a silicone quat counted once as film and once as lubricant is **one** observation. It supports `moderate`, not `high`.
3. Where the only candidate second route sits at or below the tail marker, it is not available (§3.1.1) and the value is `moderate`.
4. This is the honest reading of G3 and deliberately the conservative one. It disqualifies the smoothing route on single-mechanism film products, and it is the change that lets a dedicated repair route reach `focus.primary` on a product whose "smoothing" was a restatement of its own film (§10.2, §10.2.1).

**False signals.** FS-8 (anti-frizz and curl definition are not the same property); FS-6/FS-15 (humectants do not control frizz); "'Moisture' language without a route" (HO §9).

### 7.5 WT — weight and residue potential **(anchor dimension)**

**Definition.** Net tendency to flatten, grease, stiffen or coat. **WT is the anchor dimension of the category** — it is the binding constraint in almost every user job in HO §6, and it is more formula-tractable in leave-on than rinse-out because deposition efficiency is not a hidden variable. The residual uncertainty is dose, not composition (SR §K WT).

**Anchors.**

| Value | Anchor |
|---|---|
| `low` | Volatile carrier dominant or a water/glycol-dominant architecture; **no** persistent non-volatile family above the tail; no LGN pair; no rich-band lipid |
| `moderate` | **Either** exactly one persistent non-volatile family present as architecture (a light/medium-band emollient, a light silicone, or a cationic-polymer film); **or** the multi-family row below |
| `moderate` **(multi-family row) [new in v0.2 — ruling R13, DL C3, BR §2.1]** | **Two or more** persistent non-volatile families present as architecture, **none of them a rich/low-spreading band member**, and no LGN pair. **The multi-family counter-signal is mandatory** (§4): name every family and its rank, and state that the absent rich-band member is what holds the value below `high`. Confidence caps at `moderate` |
| `high` | An LGN pair present as architecture **and/or** two or more persistent non-volatile families with **at least one rich/low-spreading band member** (coconut/olive/castor/avocado oil, shea/mango/cocoa butter, petrolatum, heavy mineral oil) |
| `unknown` | The non-volatile architecture is unresolved — the formula is incomplete, or a source conflict makes the persistent families unreadable |

**The multi-family row, and why `moderate` [ruling R13].** Round 1 hit this gap three times and both lanes flagged it independently: v0.1's `moderate` required *exactly one* persistent family and its `high` required two-or-more **and** a rich-band member, so a formula with two or three persistent families and no butter/coconut/olive/castor/avocado/petrolatum member fell between the rows. The blind lane resolved two such products in opposite directions on nothing but its own judgment about list depth. Nick's adjudication anchors this row at **`moderate` with a mandatory counter-signal**. The reasoning that must appear in `threshold_reasoning[]`: multiple persistent families raise residue above the single-family case, but the absent rich/low-spreading member is the specific thing the `high` anchor is about — occlusion, weight and transfer — and dose remains the unmeasured term (§17.1). The FS-13 double-check still runs: a `moderate` WT on this row must not be paired with a PERS reading that quietly promises high persistence and low buildup.

**Rich-band membership is a closed enumeration for anchor purposes [new in v0.2 — BR §2.1].** For the `high` anchor, "rich/low-spreading band member" means a member enumerated in the L3 rich band (§5). An **unenumerated liquid vegetable oil** — round 1 saw sunflower, high-oleic sunflower, soy, argan, apricot kernel, macadamia, safflower and canola — is read in the **medium** band and does **not** satisfy the rich-band test. It still counts as a persistent non-volatile family for the multi-family row. This is a reading convention adopted so two reviewers reach the same answer, not a spreading-value measurement; it is recorded as an open gap in §17 and the L3 band table is not extended on this basis.

**Ceiling: moderate.** It may rise to **moderately high** only when *both* (a) the architecture read (§3.1.2) resolves to a definite class and (b) the non-volatile architecture is fully readable above the tail (§3.1.1). It never rises on the architecture read alone, and the multi-family row never rises above `moderate`.

**Gates.** **G9 — the architecture read (§3.1.2) must never set WT, in either direction.** "Spray ⇒ light" is a hard gate, not a note (SR §A.2, §K FORM). G3. G4.

**G9 resolution of the v0.1 form clauses [new in v0.2 — DL C2/defect register, BR §2.3].** v0.1's `high` anchor ended "…**or** a two-phase or microemulsion carrying a substantial oil/silicone phase", and its `unknown` anchor read "**Form** or non-volatile architecture unresolved". Both clauses let the former FORM dimension determine WT, which G9 forbids, and round 1 showed the contradiction was decisive on at least one product. **G9 governs. Both clauses are removed** and replaced by: **[v0.4 — T11: FORM is no longer a scored dimension; every "FORM" reference below now means the §3.1.2 architecture reading convention, unchanged in substance.]**

1. A two-phase or microemulsion product reaches WT `high` **only by satisfying the `high` anchor row on its own terms** — an LGN pair present as architecture, or two or more persistent non-volatile families with at least one rich/low-spreading band member — assessed exactly as for any other architecture. **The anchor row governs [corrected in v0.3 — round-2 overshoot list, ref A12].** v0.2's wording ("when a two-phase product carries a bulk oil above the tail, the `high` value rests on that observation") read as a second, easier route to `high` and contradicted the anchor row for a single-family unemulsified bulk oil with no enumerated rich-band member — a shape round 2 met directly, where the clause said `high` and the anchor said `moderate`. A bulk oil above the tail in an unemulsified system is a **strong observation and is recorded as one**, in `supporting_signals[]` with its rank; it does not by itself satisfy the anchor. G14 binds: a projected value is exactly what its anchor says. When the oil/silicone load is not readable above the tail, the form label buys nothing.
2. **The architecture read (§3.1.2) resolving to `unknown`** never forces `WT = unknown`. Assess WT from the readable non-volatile architecture alone. WT is `unknown` only when the *architecture itself* is unresolved.
3. **The architecture read (§3.1.2) resolving to `two_phase`** still emits the shake caution (§18) and still fires the §14 two-phase review trigger. That is a **dose-variability** statement, not a weight statement, and it is the one place the architecture read legitimately carries information G9 does not bar. **[v0.4: the DOSE derivation it used to drive no longer exists (T3, §7.11); the caution and the review trigger are emitted directly by the architecture read and are unchanged. From T11 on this is recorded inside this WT clause rather than a standalone FORM record (§7.1).]**

**Attached qualitative caution — transfer.** When a low-spreading, non-volatile, non-film-forming lipid load is present, attach the transfer caution (skin, collar, pillow, phone). It is qualitative: **no published instrumental transfer method for hair leave-ons surfaced** (SR §D.3). Never a scored dimension.

**False signals.** FS-1, FS-2, FS-3, FS-4, FS-17, FS-18, FS-20 (silicone-free plus a cationic polymer is not low buildup — high-charge-density polyquaterniums are among the most substantive materials in the category).

**Known judgment call.** There is **no evidence establishing a residue load at which fine hair reads as limp** (SR §M.11). Any fine-hair threshold this standard sets is a product judgment call and must be labelled as one in `limitations[]`, not presented as a derived scientific constant.

### 7.6 PERS — persistence and removal class *(PERS + WASH merged, ruling 5)*

**Definition.** An **ordinal mechanism class only**. Wash resistance and buildup are one property viewed from opposite ends, so they are one axis plus one non-quantitative caution — never two scores that can be set in opposite directions (SR §K PERS/WASH).

**Values — ordinal, highest class present as architecture wins; record the others as supporting:**

| Class | Anchor |
|---|---|
| `permanent_cationic` | **Polymeric or silicone-functional quats only.** Silicone-functional: any declared `Silicone Quaternium-x` (16, 18, 22, …) and Quaternium-80. Polymeric: any declared `Polyquaternium-x` (7, 10, 11, 16, 28, 55, …), Guar Hydroxypropyltrimonium Chloride, Hydroxypropyl Guar Hydroxypropyltrimonium Chloride, Starch/Cellulose Hydroxypropyltrimonium Chloride. Cationised proteins: Hydroxypropyltrimonium Hydrolyzed *x* Protein |
| `ph_dependent_cationic` | Amodimethicone, Bis-Aminopropyl Dimethicone, amidoamines (Stearamidopropyl Dimethylamine and family) |
| `neutral_non_volatile` | Dimethicone, Dimethiconol, Phenyl Trimethicone, esters, oils, waxes, fatty alcohols — **and monomeric long-chain quats** (see the rule below) |
| `volatile_or_water_soluble` | Volatiles and humectants only; or PEG-modified silicones as the only silicone |
| `unknown` | The persistent architecture is unresolved |

**`permanent_cationic` is now enumerated by INCI name, not by charge density [new in v0.2 — DL C4, BR §2.11].** v0.1 gated the top class on "high-charge-density polyquaterniums" — a property **G4 forbids inferring from an INCI list**. Round 1's consequence was that the blind lane reached the class exactly once in thirteen products, and only on a literal family match, while materials the standard's own FS-20 singles out as among the most substantive in the category (Guar HPTC, PQ-10, PQ-16) sat outside the enumeration. The class is therefore defined by **structure that is visible on the label** — polymeric or silicone-functional quaternisation — and the charge-density language is deleted. Charge density remains the *mechanistic* explanation (SR §B.2, §I) and may be described in prose; it may never be a threshold.

**Monomeric long-chain quats [new in v0.2 — DL C4].** Behentrimonium Chloride/Methosulfate, Cetrimonium Chloride/Bromide, Distearyldimonium Chloride and comparable small-molecule quats are **permanently charged but surfactant-removable**, unlike polymeric and silicone-functional quats, and the science review's removability ordering separates them on exactly that basis (SR §I). v0.1 had **no home** for them: the blind lane had to assign `volatile_or_water_soluble`, which under-states persistence and therefore under-warns on buildup — the direction FS-20 exists to guard. The rule:

> A monomeric long-chain quat as the dominant persistent species places the record in **`neutral_non_volatile`**, with a **required note** (`counter_signals[]` + `limitations[]`): *"Persistence rests on a monomeric long-chain quat: permanently charged, so more substantive than a neutral deposit, but small-molecule and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not a duration (G11)."*

The note is mandatory; a record placing a monomeric quat in `neutral_non_volatile` without it is invalid. A monomeric quat **never** reaches `permanent_cationic` on its own, and it never drops to `volatile_or_water_soluble` when it is the dominant persistent species.

**Unresolvable quats.** A declared quat whose polymeric-vs-monomeric structure cannot be established from the INCI name alone (several `Quaternium-x` numbers are opaque) is **not** promoted. Take the `neutral_non_volatile` class with the monomeric note, record `quat_structure: unresolved` in `limitations[]`, and route the record to human review (§14). Do not infer structure from a supplier datasheet claim about substantivity — that is a charge-density inference by another route (G4).

Film cohesion modifies within a class: a crosslinked or high-MW fixative film resists both water and mild surfactant more than a discontinuous emollient deposit. **Volatiles contribute nothing to persistence.**

**Ceiling: low–moderate** — lowered from the handover's "moderate" on the review's recommendation.

**Hard prohibition (gate G11).** Never emit a duration, a wash count, a "lasts 2 days", a "survives 3 washes", a number of applications to visible buildup, or a clarification frequency. Those depend on dose, frequency, cleanser strength, water hardness and hair porosity — none of which is in the INCI list and two of which are outside the product entirely. **No retrievable finished-product study measures leave-in accumulation over realistic use cycles** (SR §I, §C.4, §M.2).

**Banned numbers.** Circulating figures such as "only 0.3–0.7 % of polymer remains after five applications", "89 % of dimethicone removed in one wash" or "no silicone remains after 8 shampoos" are untraceable to any primary source and at least one misattributes lab data to a body that does not run comparative efficacy tests. **These numbers may not enter any record** (SR §C.4).

**Attached flag — buildup caution.** Emitted from the same evidence, explicitly non-quantitative, and **must not contradict PERS** (G3 rule 4). **Keyed on WT `high` as well as PERS `high` [widened in v0.4 — T17, hard-rule audit item H6].** See §8.5 for the full rule; PERS's own ordinal class is untouched by this widening — only what the caution reads is different.

**False signals.** FS-12 (amodimethicone selectivity is a rinse-off argument), FS-13 (high persistence + low buildup double-count), FS-20 (silicone-free + cationic polymer ≠ low buildup), FS-3.

### 7.7 HOLD — hold route state *(coarse 3-state, ruling 5)*

**Definition.** Whether a fixative-class route is present, and whether conditioning architecture stands behind it. This is a **styling-boundary signal** first and a performance signal second.

**Values.**

| Value | Anchor |
|---|---|
| `none` | No fixative-class polymer (L5), or only the L5 rheology exclusions |
| `incidental_film` | A fixative-class polymer is present but a substantive conditioning architecture dominates, **or** the polymer plausibly serves bottle rheology |
| `meaningful_hold_route` | A fixative-class polymer in a film-forming context with **thin or absent** conditioning architecture behind it → **route to G0 styling review** |

**Evidence level: `hold_route_state` is `E2` on every record [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** The 3-state is an architecture read of the frozen formula — L5 membership, plus whether a conditioning architecture stands behind it — so it takes **E2** under §3.1's assignment ladder even when the decisive observation is a single unmissable rank, and even when the value is the negative `none`. The two sealed unseen-test lanes split on exactly this field (`unseen-test-report.md` secondary finding 2). A captured `manufacturer_hold_level` beside it is separate claim evidence carrying its own level and tier (clause 1 below); it never sets this field's.

**Adjudicated worked examples [new in v0.4 — ruling T15, 2026-09-10].** Maria Nila Curlicue (PVP r4, no conditioning architecture) = `meaningful_hold_route` → excluded at G0. Neqi Diamond Glass Ultimate (Silicone Quaternium-18 conditioning film + one supporting fixative at r8) = `incidental_film` → in-category. One fixative-class polymer riding on a genuine conditioning film is the `incidental_film` paradigm; the state answers the user question "can I expect styling hold from this?" with "no — this is care, not hold." See the boundary pair in §2.3.2.

**Ceiling.** Moderate for the coarse state. **Hold *level* is not readable from a formula** — polymer level and plasticiser load are invisible — so no 0–4 grade and no low/moderate/high hold score may be **derived** (SR §K HOLD). **[divergence from HO §11's `hold_support: none | low | moderate | high`; the lean profile carries the 3-state instead — see §10]**

**A manufacturer-stated hold level is captured, never derived [new in v0.4 — T7].** Several brands publish a hold number on their own scale („Hold 3/5", „hold 4/10", „Halt 2"). That is **claim data**, and the standard's existing claim machinery already knows what to do with it:

1. **Capture it, do not compute it.** Where the frozen `claims[]` (§2.4) carries a manufacturer-stated hold level at **C1 or C2** (§2.4.1, G13), record it verbatim in the HOLD evidence object as `manufacturer_hold_level`, with its scale as written, its tier, its source and its retrieval date. The value is the manufacturer's sentence, not a number this standard endorses.
2. **It never sets, raises or lowers `hold_route_state`.** The 3-state is a formula read and stays one. A C2 „Hold 4/10" beside `hold_route_state: none` is not a contradiction to reconcile — it is a claim recorded beside an architecture read, exactly like a heat claim beside an absent L9 member (§13.3).
3. **A hold level found only at C3–C5 does not populate the field.** It is recorded as a tier-stamped trace observation with the note that it is not frozen claim data and cannot create a claim (§2.4.1 rule 1). The paradigm case in the gold set is a manufacturer's own non-German-market page, which rule 3 makes C5.
4. **No hold level, from any tier, is ever projected.** The lean profile carries `hold_support` — the 3-state — and nothing else. G14 binds: a captured claim is not a value.
5. **A hold level is never derived from the formula, in either direction.** Not from polymer identity, not from rank, not from the absence of a conditioning architecture. FS-9 is the false signal this clause exists to keep closed.

**Gates.** L5 rheology exclusion. G3 (a hold route and a conditioning route are different mechanisms; do not let one raise the other). G0 when `meaningful_hold_route`.

**Why this matters (SR §F.2).** Two mechanistically different things produce "defined, smooth, controlled" hair: the **conditioning route** (lubrication + surface film → fibres slide, align and lie together) and the **hold route** (a fixative film welds fibre-to-fibre contacts → the shape resists deformation). They feel different — hold adds stiffness, resists restyling and can flake — and they suit different users. A curl cream whose definition comes from VP/VA plus a low conditioning load is a styling product wearing a conditioning label.

**False signals.** FS-9 (hold polymer equals conditioning or repair), FS-25 (bottle rheology read as hair performance).

### 7.8 HEAT — heat-protection evidence state

Full rule in **§13**. Summary here for the dimension table.

**Research-trace values:** `not_claimed` / `claim_only` / `formula_plausible` / `product_tested`.
**Production projection (ruling 6):** binary `provides_heat_protection`. **No `heat_protection_max_c` field exists in this model.**
**Ceiling: low from formula alone** — and made stricter than the handover implies. `formula_plausible` requires a member of the **closed L9 list**, above the tail, **with a C1/C2 claim** (§2.4.1, §5 L9 tail-member rule). Generic silicone, generic protein, panthenol and oils reach `claim_only` and no further.

**Claim authority (v0.2).** "The product claims heat protection" means a claim carried by the current German pack or the manufacturer's German/EU page. Retailer copy never creates the claim (§2.4.1). This decides the production binary, so it is not a research nicety.

### 7.9 HUM — **removed in v0.4 (T9)**

**Status: not a dimension, not a claim-led field, not a lean-profile field, not a state ladder.** `humidity_resistance_evidence_state` and its lean-profile echo `specialist_functions.humidity_resistance` are removed from the model **entirely** by Nick's ruling T9 on 2026-09-05, together with its three §18 strings and its row in the §4 mandatory-counter-signal table. The section number is retained so earlier citations resolve. Unlike SLIP (§7.3, absorbed into COND's evidence object) and unlike SFR (§7.4, descored into the typed trace input `smoothing_route`), **HUM is not re-homed as an observation anywhere in the model — it is dropped, and no quoted manufacturer claim about it is taken up.**

**Why.** Three reasons, stated together because they are one argument:

1. **An unverifiable manufacturer claim is not a comparison axis.** HUM's only state past the floor was reachable solely through a C1/C2 claim (§2.4.1) — the model never once measured this exact product's humidity behaviour across three calibration rounds; `product_tested` was reachable-but-unobserved throughout, the same open state HEAT's `product_tested` carries (§17.8). A field whose entire ladder above `not_claimed` says nothing beyond "the manufacturer claims this, and we hold confidence at `low`" gives a matching model nothing to discriminate leave-ins on that the claim string itself does not already say.
2. **The anti-frizz *user need* is already served, without a humidity claim.** A user reaching for "less frizz" is, mechanistically, reaching for ambient-condition surface alignment and smoothness — exactly what the `smoothing` focus already models (§10.2, fed by `smoothing_route`, §7.4), without ever asserting humidity performance. Removing HUM does not leave that need unmet; it removes a second, weaker, claim-dependent route to the same shelf position.
3. **HEAT stays the only claim-led field.** HUM was built as the second of two claim-led ladders (§2.4.1, G13), mirroring HEAT (§7.8, §13) on the argument that HUM projects only its own evidence flag rather than a production binary. Three rounds show that argument did not pay for the machinery it required: the ladder reached `formula_plausible` on at most one gold-set product per round, and its claim requirement was already reversed once on its own reasoning (v0.2 → v0.3, §21.1 change 14, §21.2 change 9) — itself evidence the field was never stable enough to be worth repairing a second time. Removing it, rather than adjudicating it again, leaves HEAT as the sole claim-led field this standard has to defend.

**What survives, and where:**

| Was carried by HUM | Now |
|---|---|
| The anti-frizz *user need* | The `smoothing` focus (§10.2), unchanged — ambient-condition surface alignment and lubrication, never a humidity or frizz claim |
| The humectant-is-not-anti-frizz guardrail (the old mandatory counter-signal, §4) | **FS-6 and FS-15** (§12) — general false signals rather than a HUM-specific mandatory counter-signal. They bind any future consumer of a humectant observation, not only the removed anchor |
| A quoted manufacturer humidity/anti-frizz claim, where one is already frozen in a product's `claims[]` (§2.4) | **Not taken up anywhere in the model.** The claim capture machinery is untouched: a pre-existing `humidity_frizz`-typed entry in a frozen packet is not deleted, edited or re-tiered by this ruling — it simply has no field left to project into and stays in `claims[]` as unconsumed upstream data (§2.4.1 rule 5's "claim authority does not create evidence" cuts the same way: it never authorised consuming a claim with no defensible field behind it) |
| The "no dew-point threshold" prohibition | **FS-16** (§12), unchanged — it was never HUM-specific |
| "HUM absorbs the humidity half of the old SFR definition" | Moot. No dimension in this model may make a humidity or frizz statement, full stop — not because HUM claims that territory, but because nothing does (§7.4) |

**Prohibited.** No record may emit `humidity_resistance_evidence_state`, a HUM value of any kind, `specialist_functions.humidity_resistance`, a HUM counter-signal, or a humidity/anti-frizz caution string. `smoothing_route` and the `smoothing` focus (§7.4, §10.2) never make a humidity or frizz statement — a prohibition that predates this removal and is unchanged by it. A `humidity_frizz`-typed claim sitting in a frozen `claims[]` array is recorded upstream data, not a rule input; it may not be smuggled into `smoothing_route`, `care_direction`, or any other field as an indirect humidity signal.

**The v0.3 HUM rule is retained below, struck through in substance, so the removal is auditable rather than silent.**

#### 7.9.1 HUM — the removed v0.3 rule, retained for audit **(claim-led evidence flag mirroring HEAT)**

**Definition.** A 4-state **evidence flag**, not a score, mirroring HEAT. Humidity response is *measured*, not inferred (SR §K HUM).

| State | Requirement |
|---|---|
| `not_claimed` | **No C1/C2 humidity, anti-frizz or "Anti-Frizz" claim.** This is the state whenever the claim is absent, *whatever the formula shows*: a qualifying route with no claim is recorded in the trace and changes nothing **[v0.3 — see the decision below]** |
| `claim_only` | A C1/C2 humidity/anti-frizz claim without a qualifying route — **the default for most claiming products** |
| `formula_plausible` | **A C1/C2 humidity/anti-frizz claim [required from v0.3]** **and** a **hydrophobic, continuous film-forming route** with a plausible water-uptake-reduction mechanism (e.g. VP/VA or a more hydrophobic fixative, or a persistent hydrophobic silicone film) present as architecture (§3.1.1) **and** no *dominant* humectant architecture. E2, **low** confidence — always, with no upgrade path from formula |
| `product_tested` | The exact product tested by HHCR or DHCR (high-humidity curl retention at ~26 °C / 90 % RH over 24 h, `% retention = (Le − Lt)/(Le − Li) × 100`; ~70 % retention is the conventional "good" bar), by dynamic vapour sorption (0 % → 90 % RH weight gain), or by humidity-chamber tress imaging — with declared RH, temperature and equilibration time |

**Decision reversed in v0.3: HUM is claim-led, exactly like HEAT [round-2 cluster 4; reverses v0.2 change 14, §21.1].** v0.2 faced this fork explicitly and took the opposite branch — `formula_plausible` claim-free — on the reasoning that HEAT projects a production binary while HUM projects only its own evidence flag, so a route observation without a claim was a legitimate trace value. **Round 2 falsified the premise that the asymmetry is harmless.** Three failures showed up together:

1. **A claim-free `formula_plausible` is a state the projection cannot use.** It projects into `specialist_functions.humidity_resistance` — a *matching* field — while §7.9 simultaneously forbade any user-facing string for it. The profile carried a benefit-shaped value that nothing downstream was permitted to explain, which is precisely the shape G14 exists to prevent.
2. **It made HUM a different kind of ladder from HEAT for no user-visible gain.** Both lanes had to hold two claim models in mind at once, and that is the condition that produced round 2's HUM and `heat_styling` disagreements.
3. **The observation the claim-free reading was defended to preserve is preserved anyway** — clause 3 below puts it in the trace, where a later `product_tested` record can still be compared against it. Nothing is lost by moving it there; only the misleading *state* is lost.

**The rule as it stood:**

1. **No C1/C2 humidity or anti-frizz claim ⇒ `not_claimed`**, whatever the formula shows. A formula does not manufacture a claim — the same sentence §5's L9 tail-member rule and §13.2 already apply to HEAT.
2. **`formula_plausible` requires both** a C1/C2 claim (§2.4.1, G13, frozen in `claims[]` per §2.4) **and** the qualifying hydrophobic film route present as architecture, with no dominant humectant architecture. Confidence stays capped at **`low`**, always, with no formula-only upgrade path.
3. **Formula plausibility without a claim goes to the trace and stops there.** Record the route in `supporting_signals[]` with its rank and the sentence *"a hydrophobic film route is present; the manufacturer makes no humidity claim; humidity response is measured, not inferred"* — and leave the state at `not_claimed`. It is an observation, not a state.
4. **A claimed `formula_plausible` now has a German string** (§18) — the gap v0.2's claim-free reading created and round 2 found (ref A15). A record with no claim emits nothing user-facing, because its state is `not_claimed`.

**Humectant counter-signal (mandatory) — and the "dominant" vs "lowers it" conflict resolved [new in v0.2 — BR §2.4b].** v0.1 said `formula_plausible` requires "no *dominant* humectant architecture" while the counter-signal sentence said humectants materially present "**lower** this state and never raise it". Those give different answers for a materially-present-but-not-dominant humectant. Resolved in favour of a two-step rule:

1. **A dominant humectant architecture blocks `formula_plausible` outright.** Dominant means the humectant leg (Glycerin, Propanediol, Butylene/Pentylene/Dipropylene Glycol, Sodium PCA, Betaine, Panthenol) is the material direction of the water phase — several members, and/or a member above the tail and high in the list. The highest reachable state is then `claim_only` (with a claim) or `not_claimed` (without one).
2. **A humectant materially present but not dominant does not block the state**, but its observation is a **mandatory counter-signal** (§4) and **confidence is capped at `low`**. It never raises the state and it never raises confidence.

Humectants are never support for a humidity claim in either direction: the best-supported anti-frizz mechanism is reducing water uptake, while a humectant's function is to increase water association (SR §E.1).

**Glycols are not automatically humectants [new in v0.2 — BR §2.18].** A glycol high in the list may be a solvent rather than a humectant, and that reading can decide the state. Record which reading was taken and why in `threshold_reasoning[]`; where the formula does not settle it, take the **humectant** reading (the conservative one — it lowers the state) and mark the field uncertain.

**Gates.** G4. **Never encode a dew-point threshold** (FS-16). HUM also absorbs the humidity half of the old SFR definition — no other dimension may make a humidity statement. Claim authority per §2.4.1.

**False signals.** FS-6, FS-8, FS-15, FS-16 — **these four survive the removal and remain binding generally (§12); FS-8 and FS-6/FS-15 in particular are why the `smoothing` focus and the humectant route (§5 L4) still carry their own no-frizz-claim prohibitions after v0.4.**

### 7.10 R2 — repair surface film

**Definition.** A substantive protein/polymer/silane surface film. Tightened from the handover.

| Value | Anchor |
|---|---|
| `candidate` | An identifiable **substantive** route from the closed list below — **a cationised protein, a silane derivative, or a silicone quat** — present as architecture (§3.1.1) in a plausible film context |
| `none_visible` | Generic gums, starches, rheology polymers; panthenol; **a plain (non-cationised) hydrolyzed protein at any list position**; a non-silicone cationic polymer |
| `tested` | Exact-product endpoint evidence meeting §3.2 |
| `unknown` | Formula or context unresolved |

**Evidence level: `repair_surface_film` is `E2` on every record short of `tested` [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** `candidate`, `none_visible` and `unknown` are all architecture reads of the frozen formula — is a closed-list substantive route declared, is it cationised or silane-functionalised, and is it present as architecture — so each takes **E2** under §3.1's assignment ladder, including the negative `none_visible` and including a `none_visible` reached by the plain-hydrolysate rule below, where the underlying observation is a single literal INCI name. Only `tested` reaches **E3+**, and only on exact-product endpoint evidence meeting §3.2 and clearing G8. The two sealed unseen-test lanes split on exactly this field (`unseen-test-report.md` secondary finding 2).

**The `candidate` route list is closed and narrower than v0.1 [new in v0.2 — DL singles, DL defect register, BR §2.5].** Two changes:

1. **"High-charge cationic polymer" is removed as a qualifying route.** It rested on a charge-density property G4 forbids inferring from an INCI list — the same defect repaired in PERS (§7.6) — and it was half of the §10.2 `repair`-row contradiction. Non-silicone cationic polymers now contribute to PERS (§7.6) and SFR (§7.4) only.
2. **A plain hydrolyzed protein is `none_visible` wherever it sits.** v0.1's `none_visible` anchor described "a plain hydrolyzed protein sitting **in the tail**", which left a hole: round 1 met a plain hydrolysate at rank 6, high in the list, with no anchor covering it. What makes a protein an R2 route is **cationisation or silane functionalisation**, not rank. A plain hydrolysate — Hydrolyzed Keratin, Hydrolyzed Wheat/Rice/Soy/Quinoa Protein, Hydrolyzed Silk, and comparable — is `none_visible` at any position, **with a mandatory trace note** recording the observation, its rank, and the reason it does not qualify. The note exists so the record does not read as if the protein was missed.

Peptides sit with the L6 evidence but are **not** an R2 `candidate` route on their own; a peptide with no cationisation or silane function is `none_visible` with the same trace note.

**A qualifying route below the tail marker: `candidate_below_tail` [new in v0.3 — round-2 cluster 4, ref A3].** §7.10's `none_visible` row enumerates only *non-qualifying* materials plus a plain hydrolysate at any position. It had **no row at all** for a route that genuinely *does* qualify — a cationised protein, a silane derivative or a silicone quat — sitting **below** the tail marker. Round 2 fell into that hole on the set's designated surface-repair product, and the value silently became `none_visible` as though nothing had been observed. With rank now the single deterministic prong (§3.1.1), the hole would recur on every such product. The missing rule:

> A **§7.10-qualifying** route present **at or below the tail marker** does **not** become `none_visible` by default. The dimension takes its **rank-supported value** — `none_visible`, because the rank prong does not support `candidate` — **and** the record carries a mandatory `candidate_below_tail` note in `counter_signals[]` naming the species, its rank, the marker and the marker's rank, **and routes to human review** (§14).

Three consequences worth stating:

1. **The projected value is unchanged by the note** (G14). The note does not create a fourth state between `none_visible` and `candidate`, and no downstream consumer may read it as one.
2. **The review route is the point.** It exists so a human — not a rank heuristic whose variance is an open gap (§17.14, §17.18) — decides whether a specialist product built on a below-marker silane belongs in the highly-damaged tier (§10.3 row 3b) and in the `repair` focus (§10.2).
3. `candidate_below_tail` is **not a value** of `repair_surface_film`. It is a trace note on a record whose R2 value is `none_visible`, and it never appears in the lean profile.

**`candidate_below_tail` does not fire when the marker itself is implausible [new in v0.4 — T16, §3.1.1 clause 5].** The rule above presupposes a plausible marker: one that sits after the product's own core conditioning architecture. Where the marker is **implausible** — it sits *before* that architecture — §3.1.1 clause 5 forbids using it to disqualify the route at all, so R2 is not held at its rank-supported `none_visible`; it takes its **qualifying value, `candidate`**, directly. The record carries a `tail_marker_implausible` note in place of `candidate_below_tail` and still **routes to human review** (§14) — the review route survives the ruling unchanged, only its trigger name and R2's own value change. Applied to the Redken gold-set record (slot 9): its marker (Phenoxyethanol r3) sits before its own main conditioning silicone (Amodimethicone r4), so R2 moves `none_visible` → `candidate` on the r14 silane (§21.3, T16).

**Ceiling: low–moderate** — lowered from the handover's "moderate". The evidence base is supplier-dominated; molecular-weight and substantivity figures come from datasheets, not independent measurement (SR §K R2).

**Gates.** G3 (R2 shares M2 with PERS and with `care_direction`). G4. Never converts into structural repair, penetration, strength or a diagnosed "protein need".

**Panthenol rule.** Panthenol is a fibre-mechanics signal (L6), **not** an R2 route and **not** a heat route (FS-24).

**False signals.** FS-5 (botanical oil or butter means deep repair), FS-19 (coconut oil penetrates therefore botanical oils repair), FS-24.

### 7.11 DOSE — **removed in v0.4 (T3)**

**Status: not a dimension, not a stored derivation, not a caution.** `dose_sensitivity` is removed from the model entirely by Nick's ruling T3 on 2026-09-05, together with its §18 caution string („Reagiert empfindlich auf die Menge …"). The section number is retained so earlier citations resolve.

**Why.** DOSE was, by its own definition below, a **restatement of the WT/M1 observation** — that is why v0.2 made it derived rather than assessed, and why v0.3 had to stop FORM from setting it a second time. Its only job was to emit one German dosing caution. The app already carries general dosing advice in its application-guidance layer, so the standard was asserting a *per-product* dose sensitivity it derived from nothing the WT record did not already say, and paying for it with a field, a derivation rule, a projection rule and a user-facing string. The trim removes all four.

**What survives, and where:**

| Was carried by DOSE | Now |
|---|---|
| The residue magnitude the derivation restated | WT (§7.5), unchanged |
| The two-phase dose-**variability** note | Attached to the architecture read (§3.1.2), inside WT's G9 clause 3 (§7.5), with the §18 shake caution and the §14 two-phase review trigger — all unchanged **[v0.4 — T11: previously attached to a standalone FORM record; FORM is no longer a dimension]** |
| The dosing caution string | Removed from §18. General dosing advice belongs to the app's application-guidance layer, which is outside this standard |
| Open gap §17.1 (no market-representative consumer dose figures) | Still open, and now stated where it belongs: it is a limitation on WT, PERS and buildup, not a field |

**Prohibited.** No record may emit `dose_sensitivity`, a dose-sensitivity value, or a per-product dosing caution derived from one. The two-phase shake caution is emitted when the architecture read (§3.1.2) resolves to `two_phase` and says nothing about magnitude.

**The v0.3 DOSE rule is retained below, struck through in substance, so the removal is auditable rather than silent.**

#### 7.11.1 DOSE — the removed v0.3 rule, retained for audit **(derived; store-vs-derive decision recorded)**

**Definition.** The risk that a small change in applied amount materially changes the finish. This is the property that most distinguishes leave-on from rinse-out and it has a clean mechanistic basis: without a rinse to normalise application, finish moves directly with dose, and the sensitivity scales with non-volatile fraction and low-spreading lipid load (SR §B.1, §K DOSE).

**Store-vs-derive decision (required by SR §K DOSE, decided here):** DOSE is **derived and stored**, never independently assessed, and **is not projected into the lean matching profile**. Letting it be assessed separately would make it a fourth restatement of the same M1/WT observation and would violate G3. It is stored because the derived value drives a user-facing dosing caution.

**Derivation.** `derived_from = [WT, FORM, L3 spreading class]`:

| Value | Rule |
|---|---|
| `high` | WT = `high`; **or** a rich/low-spreading lipid band member is present as architecture |
| `moderate` | WT = `moderate` — **including the multi-family row (§7.5)** |
| `low` | WT = `low` **and** the carrier is volatile- or water-dominant with no persistent family above the tail |
| `unknown` | WT = `unknown` |

**DOSE follows WT [new in v0.2 — DL C3].** The multi-family WT row resolves to `moderate` (§7.5, ruling R13), so DOSE for those products is `moderate` — it is not separately re-argued upward on family count. DOSE is a restatement of the WT/M1 observation by construction (that is why it is derived, not assessed), so any DOSE value that disagrees with its WT input is a G3 violation.

**FORM never sets the DOSE value; it attaches a dose-variability note [new in v0.3 — round-2 overshoot list, ref A11, blind A7].** v0.2's rows fired `high` on `FORM = two_phase` and `moderate` on `FORM = microemulsion` **regardless of WT**, which contradicted the paragraph above whenever such a product read WT `moderate` — a shape round 2 met twice, and the two lanes resolved the contradiction by opposite readings of the same unqualified sentence. The two clauses are made to **compose** rather than to fight:

1. **The DOSE *value* is WT-derived, without exception.** Both FORM clauses are removed from the value rows. This is the reasoning G9 applies to WT, and v0.2's own DOSE note already recorded that a FORM→DOSE dependency is disfavoured by it. `derived_from` still lists FORM, because the form label sources the variability note attached to the DOSE record (clause 2) — it no longer sources the value.
2. **`FORM = two_phase` attaches a mandatory dose-*variability* note** to the DOSE record — shake quality changes the delivered oil:water ratio per actuation and that variability is unmeasured (§17.9) — together with the §18 shake caution and the §14 two-phase review trigger. §7.5's G9 clause 3 says exactly this, and it is a statement about **variability**, not about magnitude.
3. **A note is not a value.** Variability and magnitude are different properties: a two-phase spray whose WT reads `moderate` is dose-*variable* at a `moderate` residue level, and encoding that as DOSE `high` overstates the residue rather than the variability. G14 binds here as everywhere — the projected value is exactly what its rule says.
4. **`FORM = microemulsion` likewise changes no value.** Its real non-volatile load is already what WT reads; firing a second time on the form label was the double count G3 forbids.

**Two corrections to the v0.1 rows [BR §2.18].**

- The `low` row no longer requires FORM = `aqueous_or_hydroalcoholic_solution` **and** a "volatile-dominant carrier". Water is not a volatile carrier in the M6 sense (M6 covers volatile silicones and hydrocarbons), so a purely aqueous low-weight product satisfied no row at all in v0.1. The row now keys on the carrier being volatile- **or water**-dominant, and drops the FORM condition — which also removes a FORM→DOSE dependency that G9's reasoning disfavours even though G9 formally binds only WT.
- The `unknown` row no longer fires on `FORM = unknown`. WT is the determinant; FORM `two_phase` and `microemulsion` are additive triggers, never blockers.

**Anhydrous products emit no DOSE value.** They are out of category at G0 and carry no lean profile (§2.3.1). **[v0.4: no product emits a DOSE value.]**

**Ceiling: moderate.**

**Gates.** G3 — because DOSE is derived from WT, it may **not** additionally modify `hair_thickness_fit`; it emits a German dosing caution string instead (§18).

**Known gap.** **No published, market-representative consumer dose figures exist for leave-in sprays, milks or creams** — only laboratory protocol conventions and patent ranges (SR §A.2, §M.1). Two-phase products are the least dose-predictable form because shake quality changes the delivered oil:water ratio per actuation, and that variability is unmeasured (SR §M.9).

### 7.12 EXPO — fragrance and scalp/skin exposure

**Definition.** Exposure statements, per route L8. Values: `fragrance_declared` · `aromatic_or_allergen_exposure` · `no_listed_fragrance_signal` · `unknown`, plus `notes[]` for materially present `Alcohol Denat.` / `Alcohol`.

**Ceiling: moderate for flags.**

**Gates.** **G6 (medical), reused verbatim from the conditioner standard.** No diagnosis, treatment, hair-loss lifecycle, inflammation, infection or structural-regeneration suitability. Discomfort, rash, dermatitis, infection, hair loss and disease require abstention and professional evaluation. Cosmetic guidance stays separated from medically adjacent scalp or hair-loss guidance.

**Hard prohibition.** Flags remain exposure statements. **Sensitive-scalp tolerance is not derivable from an INCI list** (SR §M.12). "No listed fragrance signal" is not fragrance-free and not hypoallergenic.

**Root/scalp suitability** requires application directions and exposure context, never an ingredient read.

### 7.13 ROLE — **removed in v0.4 (T12)**

**Status: not a dimension, not a lean-profile field.** `usage_role[]` — `post_wash` · `refresh` · `heat_styling` · `curl_styling` · `ends_only`, scored and multi-valued — is removed from the model entirely by Nick's ruling T12 on 2026-09-10, together with its lean-profile field, its T8 echo-field entry (§10.1.3), and every rule and review trigger keyed on a role value. The section number is retained so earlier citations resolve.

**Why.** Three reasons, one per surviving or discarded piece:

1. **`post_wash` was true for nearly every in-category product.** It does not discriminate between leave-ins and carries no matching information — the same shape §17.20's CURL gap and HUM's removed ladder (T9) both failed on for related reasons.
2. **`heat_styling` is derivable, not a separate observation.** The production heat binary already requires a `pre_heat` direction to reach `formula_plausible` (§13.2), so scoring a `heat_styling` role from the same direction sentence restated a fact the heat evidence state and the `heat_styling` focus already established. `curl_styling` is the same shape: curl/wave positioning already gates the `curl_definition` focus directly (§10.2's negative gate), so the role added no information the focus did not already require.
3. **`ends_only` is application *guidance*, not a scored property.** Where to place a product on the hair is a usage instruction for the app's application-guidance layer, the same layer the two-phase shake instruction already belongs to (§17 item 27) — not a comparison axis a matching model scores.

**The one informative bit survives, re-homed as identity data.** `refresh`'s only content that was not already redundant with something else was **dry-hair usability** — whether the product's own directions permit application to dry hair. That single bit is preserved, not as a scored role but as a **plain transcription of the manufacturer's directions**, judgment-free the way a GTIN or a pack format is judgment-free: `application_stage: dry_hair`, captured at G1 identity (§2.4) next to the directions capture it is read from, using the vocabulary production already consumes on the DB's leave-in specs.

**Where the observation went.**

| Was carried by ROLE | Now |
|---|---|
| `post_wash` | Nowhere. True for nearly every in-category product; not a comparison axis |
| `refresh` (dry-hair usability) | `application_stage: dry_hair`, transcribed at identity (§2.4) — judgment-free, never scored |
| `heat_styling` | Not re-homed as a role. `application_stage: pre_heat` carries the same directions evidence; the `heat_styling` focus (§10.2) now keys on it directly, alongside `provides_heat_protection` — which was never role-derived and is unaffected (§13.3) |
| `curl_styling` | Nowhere. The `curl_definition` focus's own curl/wave positioning gate (§10.2) already required this evidence; the role added nothing |
| `ends_only` | An application-guidance note (§10.3.1), not identity data and not a score — the same layer the shake instruction belongs to (§17 item 27) |

**`application_stage` — identity data, not a dimension [new identity field, T12].** Unlike a re-homed observation, this is a **new identity-level field**, captured at G1 alongside directions (§2.4), not inside any §7 dimension or focus. It has no anchor, no ceiling and no confidence band, because it is not assessed — it is transcribed. Multi-valued, closed vocabulary, matching the existing DB column on leave-in specs:

| Stage | What the direction sentence must establish |
|---|---|
| `towel_dry` | Application to freshly washed, towel-dried or damp hair |
| `dry_hair` | Application to dry hair — between washes, as a refresh, or as a generally permitted use |
| `pre_heat` | A named heat tool, or a direction positioning the application before heat styling as a stage of the routine — the same evidence shape ROLE's v0.3 `pre_heat` reading required (retained verbatim in §7.13.1 below) |
| `post_style` | Application to hair that is already styled — a finishing step |

**Sourcing — G1's general directions hierarchy, not ROLE's claim-tier gate.** This is the one place `application_stage` genuinely diverges from ROLE rather than carrying its rule forward: ROLE required C1/C2 claim-tier authority (§2.4.1) because it was a *scored, matching-relevant* field, the same bar the standard holds every claim-keyed decision to. `application_stage` is identity data, transcribed the way a GTIN or pack format is — it is captured from whatever directions text G1 already requires and verifies (§2.4's source hierarchy: user package → German/EU manufacturer → exact-GTIN German retailer → other German/EU retailer → secondary discovery), with no additional claim-authority gate layered on top. A stage without its verbatim direction sentence in `formula_observations[]` (scope `directions`) is invalid and must be dropped, but the sentence may come from any tier in G1's hierarchy that the record's `directions_capture` already relies on — the same text a reviewer already reads to verify the rinse-exclusion test (§2.4). Silence leaves `application_stage` empty — never guessed from the formula, never defaulted from the product name.

**Ambiguous directions route to review as an identity conflict.** Where a direction sentence does not cleanly place into one of the four stages, or plausibly supports more than one reading, the record does not force a reading. It preserves the ambiguity (G5) and routes to human review as a **documented identity conflict** (§2.4, `provisional_identity_conflict`), exactly as a source or formula conflict already does — this is a transcription the record could not settle, not a formula judgment call. **Otherwise there is nothing to review per product**: a clean transcription of a clean direction is not a reviewable judgment.

**What is prohibited.** No record may emit `usage_role`, a role value, or a `derived_from: [usage_role]` reference anywhere. `application_stage` is never derived from formula, never scored, never gated on a threshold, and feeds no rule beyond the ones that already read it directly (the `heat_styling` focus's `pre_heat` half, and the `dry_hair` + `permanent_cationic` buildup trigger, §14). It never sets `provides_heat_protection`, which was never role-derived (§13.3).

**Gates.** G1 (identity capture, §2.4). G5 (conflict preservation, for ambiguous directions). G2's "never a substitute for a fit decision" caution no longer needs to name ROLE — `application_stage` is an identity input, not a scored dimension, so there is no score for it to substitute for.

**False signal.** FS-11 — a "10-in-1" or "7-in-1" name is not a list of application stages and not a list of mechanisms; read the directions. **Unchanged by the removal.**

**The v0.3 ROLE rule is retained below for audit.**

#### 7.13.1 ROLE — the removed v0.4-draft rule, retained for audit **(usage role, reinstated for leave-in in ruling 7, removed by T12)**

**Definition.** How the product is actually used, read from the product's **own authoritative directions at E1**: `post_wash` · `refresh` · `heat_styling` · `curl_styling` · `ends_only`. Multi-valued.

**Sourcing and evidence rule [new in v0.2 — DL C10, ruling R12].** Round 1 assigned `refresh`, `ends_only` and `heat_styling` from differently-sourced directions across the two lanes, which is a sourcing defect, not a judgment difference. Two binding rules:

1. **Authority.** Role values may be read **only** from directions carried by a C1 (current German pack) or C2 (manufacturer's German/EU page) source — the same authority tier as claims (§2.4.1). Retailer application copy **corroborates** an existing role; it never creates one. Where only retailer copy exists, ROLE is `unknown` and the retailer text is recorded in `supporting_signals[]` with its tier.
2. **One direction sentence per role value.** Every emitted role value carries, in `formula_observations[]` (scope `directions`), the **verbatim direction sentence** that establishes it, with source tier and date. A role value without its sentence is invalid and must be dropped, not defended.

| Role | What the direction sentence must establish |
|---|---|
| `post_wash` | Application to freshly washed, towel-dried or damp hair |
| `refresh` | Application to dry hair between washes, or re-application during the day |
| `heat_styling` | Application before a named heat tool (blow-dryer, straightener, curling iron), **or a direction that positions the application before heat styling as a stage of the routine** („vor dem Föhnen", „vor dem Hitzestyling", „auftragen und föhnen") — a **`pre_heat` application stage [widened in v0.3]**. A temperature figure alone is still a claim, not a direction |
| `curl_styling` | Application for curl forming, scrunching, diffusing or definition |
| `ends_only` | Placement restricted to lengths and/or ends („in die Längen und Spitzen") |

**The `pre_heat` application stage [new in v0.3 — round-2 overshoot list, ref A8].** v0.2 required a **named tool**, so three of the four round-2 products carrying a C1/C2 heat claim and projecting `provides_heat_protection: true` could not reach the `heat_styling` role at all — and with it the `heat_styling` focus (§10.2) was unreachable for them. The production binary and the focus vocabulary disagreed about what a heat product is. The role now fires on either evidence shape: **a named heat tool, or a direction sentence that positions the application *before* heat styling as a stage of the routine.** What does **not** suffice is unchanged: a temperature figure („schützt bis 230 °C") is a claim, not a direction, and a heat claim whose directions are silent about *when* to apply leaves ROLE `unknown`. Rule 2's verbatim-direction-sentence requirement applies to a `pre_heat` reading exactly as to a named tool, and the record states which of the two shapes was read. **[v0.4 — T12: this is exactly the evidence shape `application_stage: pre_heat` now requires; the rule text carries forward unchanged, only the field it establishes is renamed.]**

A **shake instruction** („vor Gebrauch gut schütteln") is a handling instruction, not a usage statement, and establishes no role. **Silence is `unknown`.** Multiple sentences may establish multiple roles; one sentence may establish more than one role if it states both.

**Ceiling: moderately high** — and it earns that ceiling *precisely because it is an E1 directions read, not an INCI inference*. If C1/C2 directions are unavailable, the value is `unknown`; it is never guessed from the formula. A role resting on a single sentence at the weaker end of C2 carries `low`–`moderate` confidence, recorded.

**Why this diverged from the conditioner standard (SR §K ROLE, §N.3).** Conditioner v1.6 deliberately dropped `usage_role` because "regular" vs "frequent" mostly reproduced directions wording. v0.1–v0.3 argued that reasoning did not transfer: for leave-ons, post-wash vs refresh vs heat-styling vs curl-styling vs ends-only changes dose, frequency, damp-vs-dry application and therefore accumulation. **T12 does not reverse that argument** — it accepts a narrower version of it: most of the five roles turned out to reproduce information the model already had elsewhere (this section, entry above), which is a scope finding three calibration rounds exposed, not evidence that directions-derived timing was never worth capturing at all.

**Gates.** G2 — ROLE is an input to fit derivation, never a substitute for one. A `refresh` role plus a high PERS class raises the buildup caution; it does not raise or lower any score.

**False signal.** FS-11 — a "10-in-1" or "7-in-1" name is not a list of usage roles and not a list of mechanisms; read the directions.

---

## 8. Demoted flags and derived values (ruling 5) — **collapsed into one Hinweise record in v0.4 (T5)**

These carry information but **never a score**. **v0.4 changes how they are emitted, not what they mean:** the six of them — SHN, CURL, R3, LAYER, buildup and transfer — no longer occupy six always-present slots, five of which were empty on most products. They collapse into **one conditional `hinweise` record per product** that lists only the flags that actually fired, each with its one-line note (§8.6). The per-flag rules in §8.1–§8.5 are unchanged and remain the definition of *whether* a flag fires.

### 8.1 SHN — shine, as a qualifier on the smoothing route

From formula, shine is almost entirely the optical consequence (M3) of the same alignment/deposition mechanism that drives SFR; scoring it separately double-counts. Worse, measured gloss depends on hair colour, baseline condition, and even incident-light direction and polarisation — a large share of the outcome is a **user** variable, not a product variable (SR §K SHN).

**Emit** `smoothing_shine_qualifier: present | absent` **as a qualifier on the smoothing route only** (§7.4). **[v0.4: it fires into the `hinweise` record only when `present`; `absent` is the ordinary case and says nothing a reader needs told — §8.6.]** An independent shine value is permitted only with (a) a distinct gloss route not already counted in M1/M2, or (b) exact-product goniophotometry (fixed geometry, Reich–Robbins luster `L = S/D × Θ½`, or polarisation-imaging luster).

**The present/absent anchor [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** Through the unseen test this section named the qualifier and its two values without ever stating what decides between them, and both sealed lanes improvised the same reading independently (`lane-a/notes.md` item 5, `lane-b/notes.md` convention C). That reading is now the rule, keyed on §7.4's own closed type table so it is decided by reading a value the record already carries:

> **`present`** — the record's `smoothing_route` (§7.4) is a **continuous-film type present as architecture**: `silicone_film`, `cationic_alignment` or `fixative_film`.
> **`absent`** — the record's `smoothing_route` is `emollient` or `none`.

Three bounds, each following from M3's definition (§6) rather than added to it:

1. **M3 is the optical consequence of a film, so it needs a film to be the consequence of.** An emollient package with no continuous film former produces no alignment film for shine to follow from, which is why `emollient` sits on the `absent` side despite being a real smoothing route.
2. **Product positioning never sets it.** „Glanz", „Glossing", „Shine" and a glossy pack are not observations of shine (FS-23, HO §9); the qualifier reads `smoothing_route` and nothing else.
3. **It remains a qualifier, never a value.** `present` fires the SHN entry of the `hinweise` record (§8.6) and nothing more — no score, no separate confidence band, no lean-profile projection, and no claim about how much shine (G3 rule 5).

**False signals.** FS-23 — goniophotometric luster depends on incident-light direction and polarisation as well as on the hair, so two labs' shine figures are not comparable. "Shiny product appearance" is not shine (HO §9).

### 8.2 CURL — curl/wave definition, as a derived focus

There is **no formula → curl-definition mapping in the literature**, and a large part of the outcome is the user's curl pattern and application technique (scrunching, plopping, diffusing), which no formula encodes (SR §K CURL, §M.6).

**Derive** `curl_definition_focus` from `HOLD + COND + WT`, with curl positioning as **corroboration only, never as a route**. Confidence from formula alone: **low**. Never give it an independent score implying the formula determines definition.

**False signals.** FS-8 (anti-frizz and curl definition are the same property); FS-9 (a hold polymer equals conditioning or repair); and the HO §9 route-dictionary false signal for this outcome — "conditioning alone or heavy oil alone" is not a definition route.

### 8.3 R3 — bond-specific support, as a flag

**Values:** `none` / `claim_only` / `chemistry_candidate` / `product_tested` / `unknown`. A `chemistry_candidate` opens a **review flag** (L7) and **never sets a repair level** from formula alone. Ceiling: **flag only**.

**`none` added, `unknown` narrowed [new in v0.3 — round-2 overshoot list, ref A16, blind A10].** v0.2's enum had no negative member, so eleven of thirteen round-2 products — no bond claim, no bond chemistry, nothing unresolved — were emitted as `unknown`, which reads as *unresearched* rather than *absent*. §10's own rule ("a profile enum gains `unknown` only where its §7 dimension can actually return `unknown`") has an unstated converse, now stated: **a flag needs a negative state wherever absence is the normal case.** The two members are disjoint and neither is a default:

- **`none`** — the bond question was researched and the answer is negative: no C1/C2 bond claim **and** no recognised bond chemistry in the formula. This is the ordinary value for most leave-ins.
- **`unknown`** — reserved for the genuinely unresearched or unresolvable: the formula is incomplete, the claim search could not be completed, or a source conflict leaves the bond chemistry unreadable. It carries an `uncertain_fields` entry and its §4 evidence object stating what was unresolvable.

`none` emits **no** German string (§18) and **does not fire into the `hinweise` record** (§8.6): the absence of a bond claim is not something a user needs told. **The full R3 enum and its review routing survive inside the Hinweise record** — `claim_only`, `chemistry_candidate`, `product_tested` and `unknown` each fire, carry their state and their §14 routing, and `none` is recorded in the trace without firing.

Two independent problems justify the demotion (SR §K R3): independent spectroscopy found no increase in cortical disulfide content after treatment with α,β-unsaturated Michael-acceptor repairing agents, and most supportive work is manufacturer-funded; and even granting the chemistry, bond systems were characterised at salon concentrations and contact times, so a leave-in at consumer dose inherits none of that evidence (G8).

### 8.4 LAYER — layering risk, as a caution string only

Cationic/anionic complexation across layered products is plausible colloid chemistry and near-universal formulator belief, but **no peer-reviewed measurement of pilling or flaking as a function of layering in consumer routines exists** (SR §B.3, §K LAYER, §M.4).

**Emit at most one German caution string** (§18). **Never** compute a compatibility matrix, a numeric layering-risk score, or a product-to-product incompatibility verdict. That would be exactly the "unsupported precision" failure.

**The firing condition [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** Through the unseen test this section defined what LAYER *means* and §18 gave it a string, while §8.6 rule 1 said only that it fires "when true" — no section anywhere said when it is true. Both sealed lanes recorded the gap and neither fired it: lane A declined to invent a trigger at all, lane B adopted the narrowest defensible one (`lane-a/notes.md` item 4, `lane-b/notes.md` convention B). Lane B's convention is adopted as the rule:

> **LAYER fires when, and only when, `persistence_removal_class` (§7.6) resolves to `permanent_cationic`** — a polymeric or silicone-functional quat present as architecture.

Four bounds:

1. **It is keyed on the class the mechanism is actually about.** Cationic/anionic complexation is a claim about a *substantive* cationic deposit meeting a strongly anionic styling polymer. A monomeric long-chain quat is surfactant-removable and sits at `neutral_non_volatile` by §7.6's own rule; firing on it would fire LAYER on most conditioning leave-ins, which is the §10.3.1 overshoot shape the v0.3 repair pass exists to prevent — the most restrictive statement in a flag becoming the default.
2. **G3 rule 4 is not engaged.** The buildup caution reads the same class (§8.5 limb 1), but the two are non-scoring cautions about different consequences — how much accumulates, versus what happens when it meets an anionic film — and neither modifies a dimension value. Rule 4 bars scoring PERS high while presenting buildup low; it does not bar two cautions from reading one class.
3. **It is narrow, and it is exercised — on exactly the records §7.6's own enumeration reaches. [Corrected 2026-09-13 — freeze-prep housekeeping addendum, ledger row 20; round-4 report residue item 4.]** When this rule was first written it carried an aside claiming LAYER fires on no gold-set record "because none reaches `permanent_cationic`". That aside was **false on the standard's own text**: §7.6's enumeration reaches `permanent_cationic` on three in-category gold-set records — **slot 2** (Guar Hydroxypropyltrimonium Chloride, r5), **slot 6** (Guar HPTC r11 + Polyquaternium-10 r12, on the vacuous-marker coherence read) and **slot 8** (Polyquaternium-16, r9) — and the reference key projects `persistence_removal_class: permanent_cationic` on all three. **Under the rule as defined above, LAYER fires on those three records and on no other.** This is the same set §8.5 limb 1 already fires the buildup caution on (slots 2, 6 and 8 each carry it today), which is what H6's own reasoning predicts: the two cautions read one class from two ends and neither modifies a dimension value (bound 2). The rule remains narrow — it fires on no record in the **unseen** set, none of which reaches the class — and firing on three of thirteen is the intended selectivity, not evidence that the rule is right. *Emission consequence only: the three records gain the LAYER entry of their `hinweise` record and its one §18 string at their next derivation; no dimension, profile, fit, focus, confidence or evidence level moves, and §1.1 holds — a caution moves toward telling the user more, never toward a recommendation (round-4 report, registered expected key delta).*
4. **Everything above §8.4 already forbids stays forbidden.** One string, no matrix, no score, no per-pair verdict, and no statement about *which* other product (§8.6 rule 6).

### 8.5 Buildup caution

Non-quantitative, bound by G3 rule 4 and G11. It states a mechanism-level tendency and a routine-level consideration; it never states a count, a duration or a clarification schedule.

**Emission rule, widened in v0.4 [T17, hard-rule audit item H6].** The caution is emitted when **either**:

1. `persistence` (PERS, §7.6) projects `permanent_cationic` — the pre-v0.4 rule, unchanged; **or**
2. `weight_potential` (WT, §7.5) projects `high` **and** at least one persistent non-volatile family is present as architecture — i.e. PERS resolves to any class at or above `neutral_non_volatile` (§7.6) rather than `volatile_or_water_soluble` or `unknown`.

**Why.** PERS's own under-statement problem is structural: a monomeric long-chain quat is deliberately read as `neutral_non_volatile`, not `permanent_cationic` (§7.6), so a heavy, rich leave-in whose persistence rests on exactly that class carried no buildup caution while a much lighter, silicone-free cationic-polymer spray did — a user-visible inversion (warning on the lightest product in a comparison set, silence on the heaviest), observed on the round-4 gold set (slots 3 and 10 both project `weight_potential: high` with `persistence: neutral_non_volatile` and previously carried no buildup caution). This does not violate G3 rule 4: the caution and PERS still read the same underlying evidence from two ends — persistence directly, or weight as its own independent, formula-readable proxy for a heavy, retained non-volatile load — it widens **which end can raise the caution**, not what either dimension itself projects. A record emitting the caution on the WT limb records that basis in the caution's own emission trace, and PERS's projected ordinal class is untouched (§1.1: the widening moves the caution toward showing the user more information, never toward a recommendation).

### 8.6 The `hinweise` record **[new in v0.4 — T5]**

**One record per product, conditional, listing only what fired.**

```jsonc
{
  "hinweise": {
    "fired": [
      { "flag": "SHN" | "CURL" | "R3" | "LAYER" | "buildup" | "transfer",
        "value": "<the flag's own value>",
        "note": "<one line: what fired and what it does not mean>" }
    ],
    "r3_state": "none | claim_only | chemistry_candidate | product_tested | unknown",
    "r3_review_routing": ["<§14 trigger ids, where R3 opened one>"]
  }
}
```

**Rules.**

1. **Only fired flags appear.** SHN fires at `present`; CURL fires when a curl-definition focus was actually derived; R3 fires at any state other than `none`; LAYER, buildup and transfer fire when true. An empty `fired` array is the normal case and the record is then emitted empty — it is never omitted, so "no Hinweise" and "Hinweise not researched" stay distinguishable.
2. **The per-flag rules are unchanged.** §8.1–§8.5 still decide whether a flag fires; §8.6 only decides how it is carried. No flag gains or loses a state in v0.4.
3. **R3's states and routing survive inside the record.** `r3_state` is always present, including `none`, because the R3 enum's negative member is a researched answer (§8.3) and a machine diff needs it. `r3_review_routing` carries the §14 triggers R3 opened. Only a non-`none` state appears in `fired`.
4. **One reviewable unit.** The record is reviewed as one item, not six. This is a review-surface decision, not an evidence decision: a reviewer who wants a flag's basis reads its note and the §8.1–§8.5 rule it names.
5. **Nothing here is a score, and nothing here projects.** The Hinweise record is not part of the lean matching profile. Its only user-facing consequence is the §18 strings the individual flags already emitted, unchanged.
6. **Never compute a compatibility matrix, a layering score or a product-to-product incompatibility verdict** (§8.4). Collapsing the flags into one record does not make them a set that can be reasoned over.

---

## 9. `care_direction` — protein / moisture / balanced (ruling 7)

**Status.** Retained as a dedicated, evidence-backed axis by Nick's confirmed ruling 7. **The science review recommended against reusing it** (SR §N.2: it is a conditioner-specific comparison vocabulary and the discriminating axes in leave-on are weight, persistence and hold). The ruling overrides the recommendation; the review's substantive concern is answered by the two constraints below rather than by dropping the field.

**Definition.** The formula's comparative care *emphasis*. It is **not** a diagnosis of a user's protein or moisture state and never implies a deficiency.

**Values and anchors (E2, ceiling moderate):**

| Value | Anchor |
|---|---|
| `protein` | An identifiable **substantive** protein/silane film route (R2 = `candidate` or `tested`, §7.10) present as architecture, i.e. above the tail and more than ordinary conditioning |
| `moisture` | **Either** a coherent conditioning + humectant + emollient architecture (L1/L3/L4) is the material direction, with **no** protein-film route; **or** the humectant-led minimum below |
| `moisture` **(humectant-led minimum) [new in v0.2 — DL C9]** | A humectant leg (L4) present as architecture with **no** R2 route, even where the emollient and cationic legs are thin or absent. **Confidence `low`**, recorded, with the thin-architecture observation as a counter-signal |
| `balanced` | **Two explicitly co-equal readings, neither one the fallback of the other [amended in v0.4 — T19].** **(a) Substantive mixed** — an R2 `candidate`/`tested` route **and** a material moisture leg, both above the tail. **(b) Directional neutrality** — a **film-led** architecture with no protein anchor and no moisture leg present as architecture (the film-led rule below). It is **not** an uncertainty bucket, and under reading (b) it *is* the label for an architecturally neutral product |
| `unknown` | **Genuine evidence failure only [amended in v0.4 — T19]:** the formula or the identity is not readable, so no direction can be read at all — an unresolved or partial capture, an identity conflict, or a §2.4.2 tier-2 formula-set conflict. **Never the answer for a readable film-led architecture** **[divergence: the conditioner vocabulary has no `unknown`; adding it here keeps the standard conservative where the *evidence* fails instead of forcing a guess. Under AD-2 (`plans/leave-in-inci/adapter-decisions.md`) an `unknown` blocks the record from committing to the catalog at all]** |

**Film-led architectures are `balanced` [amended in v0.4 — T19, 2026-09-12; supersedes the v0.2 silicone-led `unknown` rule, DL C9, BR §2.15, and closes open gap §17.22].**

*What the v0.2 rule got right and keeps.* `protein` is defined over L6/R2 and `moisture` over L1/L3/L4. **L2 — the silicone route — appears in neither**, and that is still not an oversight to be interpolated away: a film route never *creates* a moisture direction or a protein direction, and `care_direction` remains a *protein-versus-moisture* comparison vocabulary (constraint 1, and the reason SR §N.2 recommended against reusing the field at all).

*What it got wrong.* From "the film is neither leg" the v0.2 rule concluded **`unknown`** — an abstention — on a formula that is in fact **fully readable**. Nothing is missing on such a record: the architecture is read, the legs are read, and the answer that reading produces is that the product is **neither moisture-directed nor protein-directed**. That is a **value**, not a gap. Its name is `balanced` — the third member the field's own title already carries and the only other value the production enum accepts (`moisture | balanced | protein`, `product_leave_in_specs_care_direction_check`), so this ruling adds no enum member on either side (AD-1's single-enum principle).

*The rule.* A record takes `balanced` on reading (b) when **all four** hold:

1. **No protein anchor.** `repair_surface_film` (§7.10) is not `candidate` or `tested` as architecture — no cationised protein, silane derivative or silicone quat above the tail marker.
2. **A film-led primary care mechanism, present as architecture.** The product's conditioning result is carried by a **substantive film** — an L2 silicone system (dimethicone, dimethiconol, phenyl trimethicone, a cyclomethicone-carried film), a silicone quat, or a §5-equivalent substantive film route — read through §3.1.2 and §5, with **at least one film species above the tail marker** (§3.1.1).
3. **No moisture leg present as architecture.** **No** L1 (cationic), L3 (emollient) or L4 (humectant) species sits above the tail marker. A leg species present **only below the marker** is **subordinate**: it is recorded, and it does **not** create a moisture direction.
4. **Ordinal corroboration, so the read does not rest on the marker's exact rank alone.** Every film species establishing clause 2 ranks **above** every candidate leg species of clause 3. Where that ordering does not hold, clause 3's marker test is doing all the work on its own and the row is not taken on `moderate` confidence (see below).

⇒ **`balanced`**, `evidence_level` **E2** (formula), `evidence_scope: formula`, **confidence ceiling `moderate`** — the §9 ceiling, unchanged. Take `moderate` where clauses 2–4 hold on ranks. Step **one down to `low`, and route to review**, where the leg-absence reading rests on a marker the record's own `tail_marker` object flags as unreliable — `plausible: false` (T16, §3.1.1 clause 5), `vacuous: true` (T17/H1, clause 6) or `none_visible` (limit 2) — or where clause 4's ordering does not hold. Record the row as **`row: film_led_neutral`** so a reviewer and a machine diff can tell the two `balanced` readings apart; reading (a) records nothing and is the default.

*Mandatory counter-signal.* The film-led row is decided on the §3.1.1 tail marker, so §4's marker counter-signal is mandatory: name the marker and its rank, the film species and their ranks, and **every subordinate leg species with its rank** — so the `balanced` reads as a positive neutrality finding with its evidence attached, exactly as the v0.2 rule required the silicone architecture to be recorded so its `unknown` read as a deliberate abstention.

*Where a moisture leg is present as architecture, `moisture` still governs — film lead or not.* This is the deliberate boundary, and T19 does **not** move it: §17.22 complained that the old rule was "gated too narrowly", and the repair is to make the gate **checkable** (clause 3's present-as-architecture bar plus clause 4's ordering), not to lower it. A film-led product with a genuine humectant or emollient leg above its own marker is moisture-directed on its architecture and stays `moisture` — including the blow-dry primer §17.22 names, gold-set slot 13 (Neqi), whose glycol humectant leg sits at r2/r6 above its r9 marker. Its C2 „Feuchtigkeits**schutz**" positioning does not enter the reading in either direction (constraint 3).

*`unknown` is never the film-led answer.* It survives only for **evidence failure** — a formula that cannot be read (a partial or unresolved capture, an identity conflict, a §2.4.2 tier-2 set conflict). The one adjacent case worth naming: where clause 2 **also** fails — nothing above the tail in any of L1/L3/L4 **and** no film species above it either — there is no readable care architecture at all, and the record returns `unknown` as exactly the evidence failure it is, normally alongside COND's own `unknown` and a §3.1.1 marker limitation, never as a film-led abstention. Stating this explicitly is the point of the ruling: under AD-2 an `unknown` is a shipping blocker, so an abstention taken where the evidence is actually complete costs the catalog a record it could have committed, for no evidentiary reason.

*Conformance with §1.1.* The film-led row is a positive architecture read, not a failure mode, and it cannot fail toward a recommendation: `care_direction` may not drive weight, persistence, hold or heat matching (constraint 1), and `balanced` asserts **neither** emphasis — it is the conservative statement about a product that makes no directional claim on its own formula. The rule's own failure paths stay conservative: an unreliable marker steps confidence down and routes to review, and unreadable evidence still returns `unknown`.

**How much moisture leg is enough.** v0.1 did not say whether `moisture` needs all three of L1/L3/L4 or any of them, and the lanes drew the line differently. **Any one leg present as architecture is sufficient**, subject to the confidence rules: L1+L3+L4 or L1+L3 ⇒ `moisture` at up to `moderate` confidence; a lone L4 humectant leg ⇒ `moisture` at `low` confidence (the humectant-led minimum row); nothing above the tail in any of the three ⇒ **not `moisture`** — the film-led rule above then decides `balanced`, and only an unreadable formula returns `unknown` **[amended in v0.4 — T19; this clause previously ended "⇒ `unknown`"]**.

**Three mandatory constraints (answering SR §N.2):**

1. **`care_direction` may not drive weight, persistence, hold, or heat matching.** WT, PERS and HOLD are the discriminating axes of this category; `care_direction` is a comparison and explanation axis only.
2. **Panthenol alone never sets `protein`** — it is a fibre-mechanics signal, not a surface-film route (§7.10, FS-24). Neither does a humectant name alone set `moisture`; a name is not a route, and the humectant-led minimum requires the leg **above the tail**, not a tail entry.
3. **Marketing direction never sets the value.** A product sold entirely on keratin repair whose only protein is a plain hydrolysate is `moisture` or `unknown` on its architecture, exactly as the formula reads (§7.10). Positioning is recorded as a counter-signal, never as a route.

**Gates.** G3 — `care_direction` shares M2 with R2 and PERS; it may not be presented as independent corroboration of either. G4 — formula-only calls stay E2.

---

## 10. The lean matching profile

Keep the detailed ontology in the research trace. The production model exposes only what recommendation and explanation need (HO §11, charter §G).

```jsonc
{
  "model_version": "leave-in-matching-v1.0",
  "category_standard_version": "leave-in-inci-v1.0",
  "research_record_id": "<uuid>",

  "product_form": "spray | milk | lotion | cream | serum | unknown",
  "conditioning_level": "low | moderate | high | unknown",
  "weight_potential": "low | moderate | high | unknown",
  "persistence": "low | moderate | high | unknown",
  "hold_support": "none | incidental | meaningful",
  "care_direction": "protein | moisture | balanced | unknown",
  "repair_support_level": "low | medium | high",

  "focus": {
    "primary": "detangling | smoothing | curl_definition | heat_styling | repair | shine | volume_lightness | general",
    "secondary": ["<= 2 distinct values from the primary vocabulary, excluding general>"]
  },

  "specialist_functions": {
    "provides_heat_protection": true
  },

  "hair_thickness_fit": {
    "fine":   "recommended | conditional | neutral | caution | unknown",
    "medium": "recommended | conditional | neutral | caution | unknown",
    "coarse": "recommended | conditional | neutral | caution | unknown"
  },
  "damage_fit": {
    "healthy":            "recommended | conditional | caution | unknown",
    "moderately_damaged": "recommended | conditional | caution | unknown",
    "highly_damaged":     "recommended | conditional | caution | unknown"
  },
  "texture_fit": {
    "straight": "recommended | conditional | caution | unknown",
    "wavy":     "recommended | conditional | caution | unknown",
    "curly":    "recommended | conditional | caution | unknown",
    "coily":    "recommended | conditional | caution | unknown"
  },
  "cautions": ["<German user-facing strings, §18>"],
  "uncertain_fields": [],
  "assumption_notes": []
}
```

Every field carries its own property-evidence object (§4). The research envelope wrapping this profile is **`leave-in-research-envelope-v1.0`** (five-part conditioner shape: `version, researchMethod, identity, formula, profile`; fail-closed validation) — **promoted at the 2026-09-13 freeze from `leave-in-research-envelope-v0.4` under the promotion-at-lock rule stated here since v0.1, which the lock now executes.** The envelope version tracks the standard version; the promotion carries no shape or field change, only the version stamp.

**`unknown` members added to four enums [new in v0.2 — DL defect register, BR §2.16].** `conditioning_level`, `weight_potential` and `persistence` were closed enums with no `unknown`, while COND, WT and PERS each carry an `unknown` state in §7 that the §K ceilings can genuinely produce. Round 1 had to emit `null` plus an `uncertain_fields` entry four times, which is an undeclared convention. The enums now carry `unknown` explicitly, so an honest abstention is representable rather than encoded as absence. **`product_form` also carries `unknown`, but not for this reason [v0.4 — T10].** From v0.4, `product_form` is no longer a FORM projection (§10.1), so its `unknown` is no longer justified by FORM's own ceiling. It is retained for a different, still-honest reason: identity capture (E1: pack, product name, directions) can itself fail or stay unresolved — the same gap G1 already represents as `directions_capture: missing` or `identity_status: insufficient_information` (§2.4) — and a record in that state must be able to say so about its presentation form rather than guessing.

**`hold_support` deliberately gains no `unknown`.** The blind lane's register listed HOLD among the affected fields, but §7.7's ontology has only three states: HOLD is a *coarse presence read* — a fixative-class route is either absent, incidental, or meaningful — and `none` is the correct value for a formula in which no fixative-class polymer is visible. There is no §7 `unknown` to project, so adding one to the profile would create a state the standard cannot produce. The rule holds generally: **a profile enum gains `unknown` only where its §7 dimension can actually return `unknown`.**

Rules for the new members:

- `unknown` is emitted **only** when the §7 dimension resolved to `unknown`. It is never a rounding-down of a low-confidence value, and never a substitute for a value the anchors do reach.
- Every `unknown` also appears in `uncertain_fields` and carries its §4 evidence object explaining what was unresolvable.
- `unknown` never means "out of category". An excluded product emits **no lean profile at all** (§2.3.1).

**Adapter consequence — open, not decided here.** These five new enum members, together with `care_direction`'s existing `unknown`, must be handled by whatever adapter maps this profile onto production fields, and no production field is known to accept `unknown` today. **That is a Phase-5 adapter decision and this standard does not design it** — it is recorded as an open item in §17 alongside the `format`-enum and `heat_protection_max_c` reconciliation items. Nothing in v0.3 authorizes a production write (§19 stop condition).

**Fields deliberately absent.**

- **`heat_protection_max_c`** — removed (ruling 6, §13).
- **`dose_sensitivity`** — **removed from the model entirely in v0.4** (T3, §7.11). Not a dimension, not a stored derivation, not a caution string. General dosing advice belongs to the app's application-guidance layer.
- **`scalp_application_fit`** — **removed from the model in v0.4** (T4, §10.3.1). The repo separates cosmetic guidance from medically adjacent scalp guidance, the field was `unknown` or `avoid` on almost every record, and an exposure flag is not a tolerance prediction (§7.12, SR §M.12).
- **`specialist_functions.humidity_resistance`** — **removed from the model entirely in v0.4** (T9, §7.9). No dimension, no state ladder, no quoted-claim adoption. The anti-frizz user need is served without a humidity claim by the `smoothing` focus (§10.2); HEAT is now the only claim-led field this standard has.
- **`usage_role`** — **removed from the model entirely in v0.4** (T12, §7.13). `post_wash` carried no information (true on almost every record); `heat_styling` and `curl_styling` restated evidence the `heat_styling`/`curl_definition` focuses already required directly; `ends_only` is application guidance, not a matching field. The one informative bit — dry-hair usability, formerly `refresh` — survives as the identity field `application_stage`, transcribed at G1 (§2.4), never projected into the lean profile.
- **A slip field and a smoothing score** — never present in the profile, and from v0.4 not present as dimensions either (T1, T2).
- **`climate_fit` / `layering_compatibility`** as confident labels — kept as specialist evidence states or `unknown` (HO §11 recommended simplification).
- **A separate fit label per marketing claim** — one primary focus, up to two secondary, plus specialist evidence states.

### 10.1 Projection rules

- `product_form` — **not** a projection of the architecture read **[v0.4 — T10, reversing the v0.1–v0.4-draft rule below; T11 does not change this rule]**. `product_form` is the **presentation form** the user holds — `spray | milk | lotion | cream | serum`; `unknown` when identity capture cannot settle it — captured directly at identity (E1: pack, exact product name, directions of use), independent of the architecture read. The architecture read (`aqueous_or_hydroalcoholic_solution` / `emulsion` / `microemulsion` / `two_phase` / `anhydrous_serum_or_oil` / `unknown`) is **trace-only and never projected** — from T10 as a matter of projection, and from T11 not a scored dimension at all, only the §3.1.2 reading convention (§7.1, §3.1.2). *Superseded text, kept for the record:* v0.1 through the v0.4 draft projected `product_form` from the FORM architecture class and kept the marketing form word as separate `presentation_form` metadata; T10 collapses the two into one field, keeps the user-facing name, and flips which side is trace-only. A `two_phase` architecture typically presents as `spray` — an observed correlation in the gold set, not a derivation rule; the presentation form is still captured per product from identity, never derived mechanically from the architecture read. The `emulsion_subtype` (LGN / non-LGN) remains trace-only and not projected (§3.1.2).
- `conditioning_level` ← COND (low→low, moderate→moderate, high→high, unknown→unknown).
- `weight_potential` ← WT; `unknown` → `unknown`. The multi-family `moderate` row projects as plain `moderate` — its mandatory counter-signal stays in the trace (§10.1.1). When a formula-only `high` is conflict-tagged, the exact-product intended finish materially contradicts it, and no finished-product evidence resolves the conflict, project `moderate`, mark the field uncertain, and preserve the higher trace result. Do not encode unresolved uncertainty as a restrictive `high` that silently removes fine hair from the fit prior. **The tag's trigger, its evidence tier and its determinism are defined in §10.1.2 [v0.3]; a tag applied without a recorded C1/C2 statement is invalid.**
- `persistence` ← PERS **mechanism class**, projected ordinally: `volatile_or_water_soluble` → `low`; `neutral_non_volatile` → `moderate`; `ph_dependent_cationic` → `moderate`; `permanent_cationic` → `high`; `unknown` → `unknown`. **This is a mechanism ordering, not a duration** (G11). The buildup caution travels with a `high` value. A `neutral_non_volatile` record carrying the monomeric-quat note (§7.6) still projects `moderate`; the note does not shift the projection.
- `hold_support` ← HOLD 3-state, unchanged and with **no** `unknown` member **[divergence, §7.7]**.
- `care_direction` ← §9.
- `repair_support_level` ← the fixed rule in §10.3.2 **[new in v0.4 — T6]**. `derived_from: [repair_surface_film, conditioning_level, product_evidence]`.
- ~~`usage_role` ← ROLE~~ — **removed entirely in v0.4 (T12, §7.13).** No projection rule remains; the field does not exist. `application_stage` is captured at identity (§2.4) and is never projected into the lean profile — it is consumed directly by the `heat_styling` focus (§10.2), the same way `claims[]` is consumed without itself being projected.
- `provides_heat_protection` ← §13 binary rule, **unchanged by T12** — it was never ROLE-derived; only the `heat_styling` focus (§10.2) read ROLE, and now reads `application_stage`. **From v0.4, this is the only claim-led projection in this list (T9, §7.9).**
- ~~`humidity_resistance` ← HUM 4-state~~ — **removed entirely in v0.4 (T9, §7.9).** No projection rule remains; the field does not exist.

### 10.1.1 What never leaves the research trace **[new in v0.2 — ruling R13]**

The trace and the profile are different objects with different jobs. The trace exists to make a value auditable and re-openable; the profile exists to be matched on. **Nothing in the following list is projected into any user-facing or matching field, in any form, including as a modified value:**

| Trace-only | Why it stops here |
|---|---|
| `counter_signals[]` — including every counter-signal made mandatory in §4 | A counter-signal explains why a value can be reopened. It is not a hedge and it must not shift, soften or annotate the projected value |
| `confidence` on any dimension | Confidence is a property of the *research read*, not of the product. The lean profile carries values, not confidence bands |
| `evidence_level`, `evidence_scope`, `threshold_reasoning[]`, `limitations[]`, `shared_mechanism_ids[]` | Audit machinery |
| `emulsion_subtype`, `tail_marker` and its rank, `quat_structure` | Reading conventions, not product properties |
| The §7 four-state HEAT detail | Projects only as the binary (§13.3); the states live in the trace |

**The two permitted exceptions, both already defined and both narrow:**

1. **`uncertain_fields[]`** carries the *fact* that a field is uncertain — a field name, never a confidence value or a rationale.
2. **The §18 caution strings** are emitted by named field values (WT `high`, PERS `high`, the architecture read resolving to `two_phase` — §3.1.2, and so on), never by a confidence level or a counter-signal. No string may be added that says "we are unsure"; the standard's honest-uncertainty register is expressed by *field values* (`unknown`) and by the fixed string for an `unknown` field, not by leaking confidence.

**Why this rule exists (R13).** The v0.2 WT anchor deliberately pairs a value with a mandatory counter-signal. Without this rule, that pattern would tempt a downstream consumer to treat "moderate + counter-signal" as a fourth value somewhere between `moderate` and `high`, and the anchor would silently become un-calibratable. A projected value is exactly what its anchor says, or it is `unknown`.

### 10.1.2 The weight conflict tag — trigger, evidence tier and determinism **[new in v0.3 — round-2 cluster 1, blind A20]**

§10.1's `weight_potential` rule lets a formula-only WT `high` project as `moderate` when "the exact-product intended finish materially contradicts it". v0.2 named **no evidence tier** for "intended finish", so round 2's two lanes applied the downgrade to different products from the same kind of statement — one lane on a C2 statement, the other withholding it on a C4/C5 one — and six fields moved on a single slot. The trigger is now closed.

**Trigger — all four conditions, and nothing else:**

1. **WT resolved to `high` from formula alone (E2).** A `high` resting on exact-product evidence (E3+) is never conflict-tagged: measured residue beats a positioning statement.
2. **A C1/C2 intended-finish or positioning statement materially contradicts it.** The statement must come from the current German pack or the manufacturer's German-market page (§2.4.1, G13) — the same authority tier as every other claim-keyed decision, and frozen in `claims[]` at G1 (§2.4) — and it must be about **the finish this product leaves**: „beschwert nicht", „leicht", „ohne zu beschweren", „federleicht" and equivalents. **A retailer, marketplace or secondary statement (C3–C5) never triggers the tag.** A statement about hair type, benefit or scent that is not about weight or finish does not trigger it either.
3. **No finished-product evidence resolves the conflict.** An E3+ residue, weight or deposition result on the exact product decides the value directly, and the tag does not apply.
4. **The contradiction is material, not decorative** — the statement asserts a light finish rather than merely omitting a heavy one. Silence is not a contradiction.

**Effect — fixed, and this is the whole of it:** project `weight_potential: moderate`; add `weight_potential` to `uncertain_fields`; preserve the WT `high` dimension value, its anchor and the triggering statement verbatim with its tier in the research trace. Nothing else moves by the tag.

**Determinism.** Given the same frozen packet — which from v0.3 carries `claims[]` with C-tiers (§2.4) — the four conditions are decidable without judgment: the WT anchor is already deterministic, the tier is stamped rather than inferred, and conditions 3 and 4 are presence tests on the captured text. Two lanes reading the same packet must reach the same tag state. **A record that applies the tag names the C1/C2 statement that triggered it**; a record that declines the tag where a candidate statement exists names the condition that failed. **A tag applied without a recorded C1/C2 statement is invalid**, exactly as an anchor decided on the tail marker is invalid without the marker (§4).

**What the tag does not touch.** The **WT dimension value** is preserved at `high` in the trace while `weight_potential` projects `moderate`; every rule that reads the *dimension* still reads `high`. That is not an inconsistency to smooth away: the two answer different questions — how much residue the architecture supports, versus how confidently a weight-led prior can be formed against a contradicting manufacturer statement — and G14 forbids letting a projection rewrite its own input. **[v0.4: v0.3 illustrated this with the DOSE derivation, which no longer exists (T3). The principle is unchanged and now applies to `texture_fit`'s and `hair_thickness_fit`'s weight input, which read the projected `weight_potential`, exactly as before.]**

### 10.1.3 Echo fields are annotations, not reviewable items **[new in v0.4 — T8]**

Four lean-profile fields are **deterministic identity projections** of a §7 dimension: `conditioning_level` ← COND, `weight_potential` ← WT (outside a §10.1.2 tag), `persistence` ← PERS, `hold_support` ← HOLD. Reviewing them separately asks a human the same question twice and invites the two answers to diverge, which is the failure mode G14 exists to prevent. **[v0.4 — T9: this list carried a sixth entry, `specialist_functions.humidity_resistance` ← HUM, through the T8 ruling. HUM is now removed entirely, so there is no sixth echo — the field it would have echoed does not exist.]** **[v0.4 — T10: `product_form` was this list's original first entry, `product_form` ← FORM. It is removed from the list, not renamed: from T10 on, `product_form` is captured independently at identity (E1) rather than derived from any single §7 dimension, so it no longer fits the definition of an echo field at all, and it moves to the "stays separately reviewable" list below for exactly the reason care_direction is already there — it is its own read, not someone else's projection.]** **[v0.4 — T11: FORM itself stops being a §7 dimension in this same still-unfrozen draft, so there is no FORM row left for `product_form` to have been an echo of in the first place; T10's move stands unchanged.]** **[v0.4 — T12: `usage_role` ← ROLE was this list's fifth entry. It is removed, not re-annotated — HUM's kind of removal, not FORM's: there is no `usage_role` value left to echo or to review. `application_stage`, its identity-capture successor, does not join this list either — it is not a lean-profile field at all, echo or otherwise, so it is neither reviewed here nor projected (§7.13, §2.4).]**

**The rule.** An echo field — any lean-profile field whose value is a deterministic projection of exactly one dimension, with no second input and no rule that can change it — **is not a separately reviewable item**. It is displayed as an annotation on its dimension's row („→ Profilwert: rich"), and approving the dimension approves the projection. The projection rules in §10.1 are unchanged; only the review surface is.

**What stays separately reviewable, because each has a second input or a non-identity rule:**

- the three `hair_thickness_fit` values, the three `damage_fit` values and the four `texture_fit` values (§10.3);
- `focus.primary` and `focus.secondary` (§10.2);
- `specialist_functions.provides_heat_protection` — the binary is a **policy** projection of a four-state ladder and can differ from the state that produced it (§13.3);
- `care_direction` (§9);
- `product_form` — **added in v0.4 (T10).** It is not a projection of any §7 dimension at all; it is its own identity-level read of the pack, product name and directions (§7.1, §3.1.2, §10.1);
- `repair_support_level` (§10.3.2);
- the `hinweise` record (§8.6);
- `g0_state` and every §7 dimension.

**`cautions[]` and `uncertain_fields[]` are echoes too.** Both are deterministic consequences of named field values (§18, §10.1.1) and are displayed with the record rather than reviewed line by line. A reviewer who disagrees with a caution disagrees with the field that emitted it, and that field is reviewable.

**This is a review-surface rule and nothing else.** No value, anchor, projection or emission changes. A record still carries every field it carried before, with the same value.

### 10.2 Focus hierarchy and route anchors

1. **Exclude baseline conditioning from the hierarchy.** An ordinary conditioning architecture supports conditioning and slip; it does not automatically make `detangling` the distinctive purpose. **"Baseline conditioning" is defined against §6 in §10.2.1 [v0.3].**
2. **Group evidence by shared mechanism (§6) before comparing endpoints.**
3. **Evaluate special-purpose routes first**, then fall back.
4. **Official positioning may corroborate but never creates a route.** Current catalog values never break a tie.
5. **Mark `primary_focus` uncertain** when two plausible purposes remain unresolved; use `general` when nothing clears its threshold.

**Selection procedure [rewritten in v0.3 — round-2 cluster 2, ref A5/A6; supersedes the v0.2 procedure, DL C6, BR §2.5/§2.6].** v0.2 replaced v0.1's contradictory principles with an explicit procedure, but the procedure had its own defect: step 2 set `primary` by **counting formula observations**, and step 3's rank order applied only "when two routes tie on strength". A specialist route resting on one active therefore always lost to a film route resting on two species, and the rank order — including its deliberate repair-over-smoothing precondition — could never bind. Round 2 showed the cost on the set's designated surface-repair archetype: R2 `candidate`, `care_direction: protein`, a C2 marketing position naming its silane, and a projected `focus.primary: smoothing`. **The rank order now binds before observation counting can decide.** The procedure runs in this order:

1. **Collect qualifying routes.** A route qualifies when it clears its anchor row below **and** rests on evidence **beyond baseline conditioning as defined in §10.2.1**. Baseline conditioning is never a route.
2. **Exact-product evidence first.** A qualifying route resting on `tested` / exact-product endpoint evidence meeting §3.2 outranks every formula-only route. Where two such routes exist, step 3 decides between them. **This is the only strength comparison that may override the rank order** — measured beats ranked; counted does not.
3. **Otherwise the rank order binds:** `repair` > `smoothing` > `curl_definition` > `heat_styling` > `detangling` > `volume_lightness` > `shine`. The **highest-ranked qualifying route is `primary`**. **`repair` outranks `smoothing` only when a dedicated repair route exists** — R2 ∈ {`candidate`, `tested`} (§7.10). **[v0.4 — T13a, 2026-09-10: the second prong — "or protein/silane actives in the product's marketing position at C1/C2" — is deleted. It let positioning create a route, contradicting principle 4 below on its own terms; Nick's ruling resolves the contradiction in principle 4's favour. See the note after the anchor table.]** Without a dedicated repair route `repair` is not available at all, and `smoothing` is then the higher-ranked route.
4. **Observation counting never promotes a lower-ranked route.** v0.2's strength ladder — two or more independent endpoint-relevant observations beats one — survives with a narrowed job: it ranks **secondary** candidates (step 6) and is recorded in `threshold_reasoning[]` as evidence weight. It may not move `primary`, because "how many species express a mechanism" is a fact about formulation convenience, not about what the product is for.
5. **Positioning breaks a remaining tie, and only a remaining tie.** It never creates or upgrades a route (principle 4 above, §9 constraint 3). Two routes that remain genuinely unresolved after steps 2–4 ⇒ take the rank order and **mark `primary` uncertain**. **No qualifying route ⇒ `general`.**
6. **Secondary focus** is then selected from the remaining qualifying routes in rank order, capped at two, each still clearing the independent-support bar below.

**Secondary focus [new in v0.2 — DL C6].** At most **two**, and each requires **independent support at `moderate` or better** — i.e. its own endpoint-relevant observation, not a restatement of the primary's mechanism (G3). A route that qualified only through the primary's evidence is not a secondary focus; it is the primary focus described twice. `general` is never a secondary value.

| Focus | Route anchor |
|---|---|
| `volume_lightness` | WT `low` **and** no persistent film route. **Never from the architecture read alone** (§3.1.2, G9, FS-2) |
| `detangling` | **Either** detangling-led C1/C2 positioning (the product is sold as a detangler / „Leichtkämmspray" / „Entwirrungsspray") with **at least one M1 slip contributor present as architecture in COND's absorbed slip observation** (§7.2); **or** a slip-dominant light architecture — that same observation with COND ≤ `moderate` and WT `low` — i.e. slip is the product's whole point rather than a by-product of a rich conditioning load. **Two or more M1 slip contributors alone never set it**, because every capable emulsion has them. **[v0.4 — T1: the thresholds are the v0.3 SLIP anchors read off the absorbed observation instead of a SLIP value. "SLIP ≥ `moderate`" was "one M1 route present as architecture"; "SLIP `high`" was "two or more independent M1 contributors". No product's `detangling` result changes.]** |
| `smoothing` | A qualifying smoothing route under §7.4.1's **two-observation** test — a continuous alignment/film route **beyond baseline conditioning as defined in §10.2.1** — with its `smoothing_route` type recorded (§7.4) **[divergence: HO §11's `smoothing_frizz` is renamed `smoothing`; a label naming frizz would smuggle the unsupported humidity claim that §7.4 exists to prevent]** **[v0.4 — T2: "SFR `high`" is replaced by the identical two-observation test it always named; the type is recorded, not graded. No product's `smoothing` result changes on the descoring alone.]** |
| `curl_definition` | HOLD ∈ {`incidental_film`, `meaningful_hold_route`} **present as architecture (§3.1.1)** **plus** compatible COND/WT (§8.2) **plus the negative gate below**. A fixative polymer **at or below the tail marker** does not set it. **Negative gate [new in v0.3 — round-2 overshoot list, ref A7, blind A19]: the route is unavailable unless the product carries curl/wave positioning *or* texture-targeted directions at C1/C2** — sold for curls, waves, coils or texture, or directions describing curl forming, scrunching, plopping or diffusing. Without that evidence `curl_definition` is not a qualifying route at all. The gate is **negative only**: its presence never creates or upgrades the route (principle 4), it only fails to disqualify. Never from conditioning alone or heavy oil alone |
| `heat_styling` | `provides_heat_protection = true` (§13.3) **and** `application_stage` includes `pre_heat`, with its verbatim direction sentence (§2.4, §7.13) — where that sentence may name a heat tool **or** position the application before heat styling as a stage of the routine. **An explicit tool name is not required: the heat binary plus a `pre_heat` application stage in the directions suffices [v0.3 — ref A8; re-keyed from HEAT/ROLE to the production binary/`application_stage` in v0.4 — T12, §7.13]**. Sets a *use context*, never a protection level (§13) |
| `repair` | **R2 ∈ {`candidate`, `tested`}** (§7.10), and nothing else **[v0.4 — T13a: the marketing-position prong is deleted]**. Generic silicone, oil, panthenol, ceramide, a non-silicone cationic polymer or generic repair naming cannot set it — and neither, now, can a named protein or silane active in C1/C2 copy: positioning corroborates a route, it never creates one (principle 4) |
| `shine` | A distinct gloss route or exact-product goniophotometry. **Not added when it merely restates the smoothing film** (§8.1, G3) |
| `general` | A capable conventional leave-in where no route clears its threshold |

**The `repair` row no longer contradicts §7.10 [new in v0.2 — DL defect register, BR §2.5].** v0.1's row qualified on "R2 `candidate`" while excluding "cationic polymer" in the same sentence, and §7.10 *defined* `candidate` partly as a high-charge cationic polymer — the row's condition and its own exclusion overlapped. The contradiction is removed at the source: §7.10 no longer admits non-silicone cationic polymers, so the exclusion clause and the qualifying condition are now disjoint. What remains excluded is exactly what it says: generic materials and naming.

**R3 no longer sets `repair` primary [new in v0.2 — DL C6, ruling R14].** v0.1 allowed `repair` on `R3 = chemistry_candidate` with its review flag open. That would let a product's primary user-facing purpose be set by a bond claim whose salon evidence G8 bars and whose chemistry independent spectroscopy failed to confirm (§8.3). Consistent with R14's damage-fit ruling that an R3 flag alone never qualifies a product for the highly-damaged tier: **`R3 = chemistry_candidate` alone may never set `repair` as primary**, and may support `repair` as a *secondary* focus only where the review flag is open, an independent moderate+ observation exists, and the record routes to human review (§14). R3 keeps its flag and its review route; it loses its focus-setting power.

**Positioning never creates a focus — the second prong deleted [ruling T13a, 2026-09-10].** Every version through this v0.4 draft admitted a second, independent qualifying condition on the `repair` row — protein or silane actives named in the product's C1/C2 marketing position — alongside R2 ∈ {`candidate`, `tested`}. That second prong contradicted principle 4 above ("Official positioning may corroborate but never creates a route") on its own terms: a route created by positioning alone, resting on no formula evidence beyond a plain hydrolysate, is exactly what principle 4 forbids. Nick adjudicated the contradiction while reviewing the gold set's Schwarzkopf GLISS record — the repair archetype whose *only* qualifying route to `repair` was the marketing-position prong, via a C2 page naming "flüssiges Keratin" over a formula whose sole protein, Hydrolyzed Keratin, is a plain hydrolysate that does not qualify under §7.10. **Resolved in principle 4's favour.** The second prong is deleted everywhere it appeared — the anchor table row above, the rank-order precondition in the selection procedure (step 3), and the R3-secondary-focus allowance, which already required an independent R2-adjacent observation and is unaffected in substance. `repair` now requires R2 ∈ {`candidate`, `tested`} and nothing else, as both a primary and a secondary focus. A record whose only route to `repair` was the deleted prong is re-derived under its remaining qualifying routes exactly as if the prong had never existed — marketing may still corroborate whichever route the formula does support (principle 4), but it supplies no route of its own.

A secondary focus may add a distinct user endpoint even when it shares part of a mechanism, but it must add useful matching information and clear the independent-moderate+ bar above.

### 10.2.1 "Beyond baseline conditioning", defined against §6 **[new in v0.3 — round-2 cluster 2, ref A5]**

§10.2's principle 1 excludes baseline conditioning from the hierarchy, and its `smoothing` row requires a route "beyond baseline conditioning" — but v0.2 never defined the phrase against §6's mechanism table. Read literally against §6, which puts persistent silicones in **M1** alongside the cationic and emollient routes, `smoothing` becomes unreachable for every silicone product, which cannot be intended, since the row exists. Read loosely, every film-carrying emulsion is a smoothing product. Round 2's lanes split on exactly this, and it was the sole reason two products projected `general` where four others projected `smoothing`.

**Definition.** *Baseline conditioning* is the set of formula observations that **established this product's COND value** (§7.2) — the M1 lubrication deposit already counted there, including the absorbed slip observation (T1). A route is **beyond baseline conditioning** when it rests on at least one endpoint-relevant formula observation that is **not in that set**.

**The operational consequence, stated in both directions so neither reading wins by default:**

- **Reachable for a silicone product.** Where COND rests on a cationic and/or emollient architecture and a **dedicated persistent-silicone film system** is an *additional* observation, that film is beyond baseline conditioning and `smoothing` is available. A silicone system deliberately built as the product's alignment layer is a route, not a by-product.
- **Not automatic for a silicone product.** Where the persistent silicone **is** the COND read — the film is what makes the product a conditioner at all, and there is no separate alignment observation — it is baseline conditioning: `smoothing` does not qualify under §7.4.1's two-observation test — the route is recorded with its `smoothing_route` type and it is not a focus. A film that is a by-product of the conditioning architecture is not a smoothing route.
- The same test applies to every other row: a route is distinctive when the product carries an observation for it that COND has not already spent.
- **The test binds `focus.secondary` exactly as it binds `focus.primary` [clarified 2026-09-13 — freeze-prep housekeeping addendum, ledger row 20; round-4 report residue item 3].** The observation set that established COND's baseline cannot double as a beyond-baseline route for a **secondary** focus either: a route that is baseline conditioning is not a focus at all, in either position, and "it is only the secondary" is not a lower bar. *Worked case:* on gold-set slot 9 (Redken) the persistent silicone film **is** the COND read, so it is baseline conditioning and `smoothing` does not qualify — neither as primary nor as the secondary one round-4 lane A reached. No value moves: `focus.secondary: []` is the reference key's and lane B's reading and stays the rule-correct one.

**Recording requirement.** A record claiming any route beyond baseline conditioning names, in `threshold_reasoning[]`, both the observations that established COND **and** the additional observation the route rests on. A route whose additional observation cannot be named is baseline conditioning by definition, and it does not qualify.

**Permissive reading adopted — the over-satisfaction case resolved [ruling T13b, 2026-09-10].** The two directions above define "beyond baseline conditioning" for a record with exactly one admissible COND-establishing set. They leave open what happens when COND's anchor is **over-satisfied** — more than one admissible formula-observation set could independently have established the COND value on its own. Must a candidate route be beyond baseline under *every* such set, or does beyond baseline under *any one* of them suffice? Round 3 could not close this by calibration: the reference-key lane read conservatively (every admissible set), the blind lane read permissively (a single admissible set), and the split alone decided `focus.primary` general-versus-smoothing on four gold-set slots and one slot's secondary focus (round-3 report, item 1) — the largest remaining round-3 disagreement.

**Nick adopts the permissive reading: a single admissible COND-establishing set suffices.** A route is beyond baseline conditioning once at least one defensible reading of the formula shows it resting on an observation COND did not need to reach its value — even where a different, equally defensible reading would have spent that same observation on COND instead. In Nick's own phrasing, adjudicated against the Gliss, Isana, Curlsmith and Olaplex gold-set records: this reading **matches product identity** where the formula supports it — a product built and marketed around a dedicated film system (Olaplex's own "Bond Smoother" naming is the clearest case) should not read as `general` merely because an alternative bookkeeping of the same formula could have assigned that film's observation to COND instead — and it **keeps `general` meaningful for genuinely unfocused products**: a formula with no distinctive route under any reading, not a formula that merely has more than one way to reach its COND anchor.

This closes open adjudication item 1 (round-3 report) as a standing rule, not a per-record judgment call. Every record re-derives its `focus.primary`/`focus.secondary` under this reading; a record's evidence trace stating that "this lane reads conservatively" or recording the over-satisfaction as an open question is **historical** — it documents what round-3's reference-key lane did while the question was still open — and no longer states the current rule. The two-observation test at §7.4.1 is unchanged and still gates whether a smoothing route exists at all before this reading is even reached: a route resting on one observation only (the v0.3 SFR "moderate" shape) still fails to qualify regardless of which beyond-baseline reading applies.

### 10.3 Fit priors

These are **broad product priors**, not universal exclusions and not efficacy claims. Final recommendations still combine product behaviour with the user's damage, thickness, texture, routine, dosage, desired finish and scalp context.

**`hair_thickness_fit` — weight-led** (`derived_from: [weight_potential]`) **[v0.4 — T10 note: `product_form` is dropped from this list.** The table below never actually used it — only `weight_potential` decides a row — and now that `product_form` is the presentation form rather than a projection of the architecture read, keeping it here would misstate the rule: §3.1.2's own reliability note says the presentation word "carries no decision weight". Removing it corrects a stale reference; no cell in the table changes]:

| `weight_potential` | fine | medium | coarse |
|---|---|---|---|
| `low` | recommended | recommended | conditional |
| `moderate` | conditional | recommended | recommended |
| `high` | caution | conditional | recommended |
| `unknown` | unknown | unknown | unknown |

**No second weight-derived field modifies this table.** v0.3 stated this as "DOSE does not additionally modify it"; with DOSE removed (T3, §7.11) the rule survives as the general one it always was — `hair_thickness_fit` is weight-led and nothing else derived from the same WT observation may adjust it (G3). Every fine-hair value carries the §7.5 judgment-call limitation.

**The `unknown` row is a consequence of the enum change, not a new prior [v0.2].** `weight_potential` can now be `unknown` (§10), so every weight-led table needs a row for it; the same completion is made in `damage_fit` and as `texture_fit` row 5. It states only that a weight-led prior cannot be formed without a weight value.

**`damage_fit` — two independent paths to the highly-damaged tier** (`derived_from: [conditioning_level, repair_surface_film, bond_flag, product_evidence]`):

| Row | Condition | healthy | moderately_damaged | highly_damaged |
|---|---|---|---|---|
| 1 | `conditioning_level = low` **and** no qualifying repair route | recommended | conditional | caution |
| 2 | `conditioning_level ∈ {moderate, high}` with no qualifying repair route | recommended | recommended | conditional |
| 3a | **Conditioning path:** `conditioning_level = high` **plus** a qualifying specialist route (below) | conditional | recommended | recommended |
| 3b | **Repair-film path [new in v0.2 — ruling R14]:** **R2 ∈ {`candidate`, `tested`}**, at any `conditioning_level ≥ moderate` | conditional | recommended | recommended |
| — | `conditioning_level = unknown` | unknown | unknown | unknown |

**The repair-film path (R14).** v0.1 gated the third row on `conditioning_level = high`, and COND `high` was itself gated on an LGN pair — so a specialist leave-in built for highly damaged hair on a silicone/silane architecture could not reach the tier written for exactly that product. Nick's ruling opens a **second, independent path**: a genuine repair-film route — R2 `candidate` or better under the narrowed §7.10 list — qualifies a product for the highly-damaged tier **alongside** the high-conditioning path, without needing COND `high`.

**What an R3 bond flag does — and does not — do (R14).** `R3 = chemistry_candidate` **never** qualifies a product for the highly-damaged tier on its own. It opens a review flag (§8.3), it is recorded, and it is invisible to this table. A product with an R3 flag and no R2 route sits in row 1 or row 2 on its conditioning level like any other product. The same ruling governs the `repair` focus (§10.2).

**Qualifying specialist route (row 3a)** means a distinct L6 substantive film route, or a relevant exact-product test meeting §3.2. Generic silicone, oil, panthenol, ceramide, a non-silicone cationic polymer or repair naming alone does **not** qualify — for either path.

**`texture_fit` — weight-led, slip as the row-3 modifier, exhaustive** (`derived_from: [weight_potential, conditioning_potential.absorbed_slip_observation, hold_route_state]`):

| Row | Architecture | straight | wavy | curly | coily |
|---|---|---|---|---|---|
| 1 | `weight_potential = low` (light dry-down) | recommended | recommended | conditional | caution |
| 2 | `weight_potential = moderate`, any slip observation | recommended | recommended | recommended | conditional |
| 3 | `weight_potential = high` **and** the absorbed slip observation names **two or more independent M1 contributors present as architecture** | conditional | recommended | recommended | recommended |
| 4 | `weight_potential = high` **and** the absorbed slip observation names **one or none** | conditional | conditional | conditional | conditional |
| 5 | **Fallback:** any combination not matched above, including `weight_potential = unknown` or an unresolved slip observation | unknown | unknown | unknown | unknown |

**[v0.4 — T1.]** Rows 3–5 read the absorbed slip observation in COND's record (§7.2) instead of a SLIP value. The thresholds are the v0.3 SLIP anchors written out: "SLIP `high`" was two or more independent M1 contributors present as architecture, "SLIP ∈ {`moderate`, `low`}" was one or none, "SLIP `unknown`" was an unresolved architecture. **The observation is the same observation, so no product's `texture_fit` changes.**

**The completed matrix [new in v0.2 — DL C8, BR §2.7].** v0.1's three rows had no entry for **high weight with moderate or low slip**, and left unstated whether the rows were weight-led with slip as a modifier. Round 1 produced a clean four-cell disagreement on exactly that hole. The table is now exhaustive by construction: rows are **weight-led**, slip modifies only within the high-weight band, and **row 5 is an explicit `unknown` fallback** so no combination falls through to interpolation. Row 4's uniform `conditional` reflects the honest position — a heavy product without high slip is neither recommendable nor excludable for any texture from formula alone — and every row-4 cell carries the §7.5 fine-hair judgment-call limitation and an `uncertain_fields` entry.

`HOLD = meaningful_hold_route` does not by itself raise curly/coily — it first triggers the G0 styling review. Curl branding alone never determines the result.

### 10.3.1 `scalp_application_fit` — **removed in v0.4 (T4)**

**Status: not a field.** `scalp_application_fit` is removed from the lean matching profile, from the derivation rules and from §18 by Nick's ruling T4 on 2026-09-05. The section number is retained so earlier citations resolve.

**Why.** Three reasons, all of which the standard had already written down about itself:

1. **The repo separates cosmetic guidance from medically adjacent scalp guidance**, and a scalp *placement* verdict projected into a matching profile blurs exactly that line. G6 stays and governs everything the standard says about scalp, hair loss, irritation and inflammation — the trim removes a field, not a boundary.
2. **The field was mostly `unknown`.** Its own default is `unknown`, its positive value requires explicit C1/C2 scalp-directed directions and has been reached by nothing, and v0.3 had to narrow the `avoid` trigger because it fired on nine of twelve profiled records for no better reason than a declared fragrance allergen. A four-state field that resolves to `unknown` or `avoid` on almost every product is carrying no matching information.
3. **An exposure flag is not a tolerance prediction** (§7.12, SR §M.12). That is the sentence §10.3.1 kept having to restate, and it is the reason the field could never earn a positive value from formula.

**What survives, and where:**

| Was carried by `scalp_application_fit` | Now |
|---|---|
| The exposure observation itself | EXPO (§7.12), unchanged, with its §18 strings unchanged |
| The material-alcohol note | EXPO `notes[]` and its §18 string („Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben."), unchanged — it is emitted by EXPO, not by the removed field |
| An explicit ends-only or avoid-the-scalp direction | **[v0.4 — T12: ROLE `ends_only` is removed with the field.]** Recorded as an application-guidance note (§7.13), the same layer the two-phase shake instruction belongs to (§17 item 27) — not a scored field |
| The G6 medical boundary and its §18 string | G6 (§11) and §18, unchanged |
| Every review trigger keyed on a positive scalp value | Removed with the field (§14). G6-relevant records still route on "root or scalp application, or any medically adjacent scalp/hair-loss framing", which is the standing trigger and is not a field |

**Prohibited.** No record may emit `scalp_application_fit`, and no other field may be repurposed to carry a scalp placement verdict. **Root or scalp suitability still requires application directions and exposure context and is never an ingredient read** (§7.12) — the standard simply no longer publishes a field that invites one.

**The v0.3 rule is retained below for audit.**

#### 10.3.1.1 `scalp_application_fit` — the removed v0.3 rule, retained for audit **[rewritten in v0.2 — DL C7, BR §2.18]**

Derived from **directions plus EXPO**, never from an ingredient read (`derived_from: [directions, fragrance_scalp_exposure]`). v0.1 gave only a default sentence; round 1 saw one lane invent a default and the other vary across five products. The value is now decided by an ordered test:

| Value | Condition |
|---|---|
| `unknown` | **The default.** C1/C2 directions are silent about placement, or absent entirely (§2.4), and no `avoid` trigger fires |
| `avoid` | **Either** a heavy-occlusive or oil-led architecture — WT `high` with a rich/low-spreading band member present as architecture, or an oil-led two-phase load; **or** a **scalp-relevant irritant load** as defined below **[narrowed in v0.3]**; **or** directions that explicitly say to avoid the roots or scalp |
| `conditional` | Directions state a **placement that is not the scalp** („in die Längen und Spitzen", "mid-lengths and ends") **and** no `avoid` trigger fires. The product is not scalp-directed; nothing is asserted about tolerance |
| `suitable_if_evidenced` | Directions **explicitly direct the product at the scalp or roots** (C1/C2 source), **and** EXPO is clean — `no_listed_fragrance_signal` or `fragrance_declared` with no allergen block and no material alcohol note |

**Ordering.** Test `avoid` first: an `avoid` trigger beats a directions-based positive value. Then the explicit scalp direction (`suitable_if_evidenced`), then the non-scalp placement (`conditional`), then `unknown`.

**Scalp-relevant irritant load — the trigger narrowed [new in v0.3 — round-2 overshoot list, ref A9].** v0.2 fired `avoid` on `aromatic_or_allergen_exposure` **alone**. In the EU essentially every fragranced product declares at least one of the 26 labelled allergens, so the trigger fired on **nine of twelve** profiled round-2 records — including records whose directions state an explicit ends-only placement that §10.3.1 was rewritten (v0.2 change 24) to capture. The directions-derived signal became invisible, `suitable_if_evidenced` was reached by nothing at all, and the most restrictive value in the model became the default for fragranced products. That is an overshoot, and it is also a false precision: **an exposure flag is not a tolerance prediction** (§7.12, SR §M.12), so it cannot carry a restrictive placement verdict on its own. Narrowed:

- **A fragrance or allergen flag alone does not fire `avoid`.** Neither `aromatic_or_allergen_exposure` nor `fragrance_declared` fires it by itself. The flag is recorded, its §18 exposure string is emitted as before, and the ordered test continues to the next value — `conditional` where a non-scalp placement is stated, otherwise **`unknown`**.
- **`scalp-relevant irritant load` means an exposure flag *plus* a second, scalp-relevant observation:** `aromatic_or_allergen_exposure` **or** `fragrance_declared`, **combined with** a materially present `Alcohol Denat.`/`Alcohol` note (§7.12). Two exposure observations pointing the same way are the honest floor for a restrictive scalp verdict formed from formula.
- **The architecture trigger is unchanged** — a heavy-occlusive or oil-led load still fires `avoid` on its own — and so is the **directions trigger**: directions saying to avoid the roots or scalp fire `avoid` whatever the flags show. Directions outrank flags in both directions here, which is what `derived_from: [directions, fragrance_scalp_exposure]` says.
- **`avoid` now has a German string** (§18). v0.2's most restrictive scalp value was silent to the user (ref A15).

**Hard limits.**

- **Positive values require directions, never a formula read.** `suitable_if_evidenced` means the manufacturer directs the product at the scalp and the exposure flags are clean — nothing more. It is not a tolerance prediction: **sensitive-scalp tolerance is not derivable from an INCI list** (§7.12, SR §M.12).
- **G6 applies to every value.** No diagnosis, no treatment framing, no hair-loss lifecycle, no inflammation or infection suitability. Cosmetic guidance stays separated from medically adjacent scalp or hair-loss guidance.
- A direction stating placement **without mentioning the scalp** is a `conditional`, not an `avoid` and not a positive — v0.1 had no rule for this and it was one of the divergence sources.

### 10.3.2 `repair_support_level` **[new in v0.4 — T6]**

**Definition.** A three-state statement of how much *repair support* this product's evidence carries: `low` | `medium` | `high`. It replaces the implicit repair read that a consumer previously had to assemble from R2, COND and the R3 flag, and it is **aligned with the conditioner engine's `repair_level`** so one downstream consumer serves both categories. `derived_from: [repair_surface_film, conditioning_level, product_evidence]`.

**The derivation rule — fixed, ordered, and it is the whole of it:**

| Value | Condition |
|---|---|
| `high` | **Exact-product repair evidence at E3 or better** (§3.1, §3.2 metadata requirement, G8 exposure firewall) — a repair, strength or structural endpoint measured on this exact product, applied as a leave-on. Nothing formula-only reaches `high` |
| `medium` | **A qualifying substantive film route — R2 ∈ {`candidate`, `tested`} (§7.10) — with `conditioning_level` ≥ `moderate`** |
| `low` | **Everything else**, explicitly including a product whose repair story is a bond claim: `R3 = chemistry_candidate` or `claim_only` with no R2 route is `low` |

**Five clauses that keep it honest:**

1. **A bond claim is not repair support.** R3 is invisible to this rule, exactly as it is invisible to `damage_fit` (§10.3, R14). Independent spectroscopy found no increase in cortical disulfide content after treatment with the α,β-unsaturated Michael-acceptor agents, most supportive work is manufacturer-funded, and salon-regime evidence is barred by G8 (§8.3, FS-26). A "plex"/"bond" product with no R2 route is `low`, and that is the answer, not a gap.
2. **Marketing never moves it.** Generic silicone, oil, panthenol, ceramide, a non-silicone cationic polymer or repair naming cannot raise it (§7.10, §10.2 `repair` row). A product sold entirely on keratin repair whose only protein is a plain hydrolysate is `low`.
3. **The R2 route detail stays in the trace.** Which species, at which rank, against which tail marker, and any `candidate_below_tail` note (§7.10) — all of it stays in the R2 evidence object. `repair_support_level` carries the level and names its inputs; it does not restate the route.
4. **A `candidate_below_tail` note does not raise the level — but a `tail_marker_implausible` record isn't `candidate_below_tail` [note added in v0.4 — T16].** R2's value is `none_visible` under the rank prong (§3.1.1, §7.10), so the product is `low` — and the record routes to human review exactly as §7.10 already requires, which is where a below-marker specialist route gets decided by a person rather than by a heuristic. This clause presupposes a **plausible** marker (§3.1.1 clause 5). Where the marker is ruled **implausible**, R2 is not held at `none_visible` at all — it takes its qualifying `candidate` value directly (§7.10) — so `repair_support_level` reads that value like any other `candidate` record: `medium` when `conditioning_level` ≥ `moderate`, exactly as the table above says. Nothing about this clause's own logic changes; only which records reach it does, because the input R2 supplies is different. Applied to the Redken gold-set record (slot 9): `repair_support_level` moves `low` → `medium` (§21.3, T16).
5. **It is a support level, never a repair claim.** `medium` says a substantive surface-film route is present in a conditioning architecture. It never converts into structural repair, penetration, strength or a diagnosed "protein need" (§7.10 gates), and it emits no §18 string of its own.

**Relationship to `damage_fit`.** They read the same inputs and answer different questions: `damage_fit` says which damage tier the product is a reasonable prior for (§10.3), `repair_support_level` says how much repair support the evidence carries. A product may be `recommended` for highly damaged hair on the conditioning path (row 3a) while carrying `repair_support_level: low`, and that is not a contradiction — high conditioning is not repair.

**Ceiling.** Inherits R2's: **low–moderate** for any formula-only value. `high` is an E3+ state and, like HEAT's `product_tested`, may be a permanently empty state until a product with such evidence appears (§17.8).

### 10.4 Boundary with the live catalog

Current live leave-in spec values (`format`, `provides_heat_protection`, `heat_protection_max_c`, roles, ingredient flags) are **legacy heuristics, not research-engine output**. They are comparison-only historical data: they cannot determine a new classification and never break a tie.

Two known reconciliation items are **parked as Phase-5 adapter decisions**, not resolved here:

- The DB `format` enum has no `two_phase` and carries `serum`, which this standard treats as a boundary decision rather than a form.
- Removing `heat_protection_max_c` touches live code (`src/lib/recommendation-engine/selection.ts` ≥ 220 °C heat-fit bonus and its German copy) and personal-plan catalog facts. That is a scoped migration surfaced to Nick before execution — **not** authorized by this document.

---

## 11. Gates

| Gate | Rule |
|---|---|
| **G0** | **Boundary / product form.** Classify by function + directions + architecture, never by name. Anhydrous → oil/serum; fixative route with thin conditioning → styling; ambiguous → `provisional_boundary` stress case. Excluded products do not classify (§2.3) |
| **G1** | **Identity, formula and directions.** Capture the §2.4 set, follow the canonical source hierarchy, preserve conflicts, and complete a provisional profile from the best available exact-market evidence. **Directions-of-use must be captured verbatim and verified, not assumed (v0.2, R11):** an explicit rinse instruction sets `excluded_other_form` at G0 before any formula analysis, and absent directions are a documented gap that leaves `application_stage` empty rather than guessed (§2.4) **[v0.4 — T12: this clause previously forced `usage_role` to `unknown`; ROLE is removed and `application_stage` is transcribed, never guessed, so an empty array is the honest state]**. **Claims are captured with their C-tier in `claims[]` as part of the same freeze (v0.3):** a claim-keyed field is decided from the frozen capture, and a claim found mid-classification reopens the freeze rather than being added to the record (§2.4) |
| **G2** | **Evidence firewall (chain).** Formula observation → direct product property → user-fit decision. No shortcuts, no naked suitability labels |
| **G3** | **Anti-double-counting.** One shared mechanism counts once unless endpoint-specific evidence separates it. Includes the persistence/buildup rule and the shine rule (§6) |
| **G4** | **Evidence cap.** Formula-only ≤ E2; claim-only E0. No exact concentration, pH, MW, droplet size, viscosity grade or deposited amount from an INCI list |
| **G5** | **Conflict.** Preserve source conflicts and lower the **smallest** affected scope; do not blank the record |
| **G6** | **Medical.** No diagnosis, treatment, hair-loss lifecycle, inflammation, infection or structural-regeneration suitability. Cosmetic guidance stays separate from medically adjacent scalp/hair-loss guidance |
| **G7** | **Review freshness.** Per-field unsalted SHA-256 fingerprints over the canonical field evidence/value payload, plus a versioned whole-profile fingerprint binding the lean profile and `category_standard_version`. Equality preserves approval; changed content reopens the field |
| **G8** | **Exposure-regime firewall [leave-in-specific].** Rinse-out, shampoo, pre-wash-oil and in-salon evidence enters **only at E2, as mechanism** — never as product evidence and never as an upgrade path (§3.3) |
| **G9** | **Form is not weight [leave-in-specific].** The architecture read (§3.1.2, and FORM before it was demoted to a reading convention by T11) may never set WT, **in either direction (v0.2)**. "Spray ⇒ light", "cream ⇒ heavy", "clear ⇒ light" and "no emulsifier ⇒ no lipid load" are hard failures, not notes; and the architecture read resolving to `unknown` never forces `WT = unknown`. G9 governs wherever a §7 clause reads WT off the form label — the v0.1 two-phase/microemulsion and "Form or …" clauses are removed on this basis (§7.1, §3.1.2, §7.5) |
| **G10** | **Heat strictness [leave-in-specific].** `formula_plausible` requires a member of the closed L9 list. Generic silicone/protein/panthenol/oil stops at `claim_only`. Never grade efficacy; never use a °C figure as a protection level (§13) |
| **G11** | **No quantitative persistence [leave-in-specific].** No durations, wash counts, applications-to-buildup, clarification schedules, or the circulating untraceable removal percentages (§7.6) |
| **G12** | **Regulatory durability [leave-in-specific].** Rules key on **function** ("a volatile carrier is present") with the INCI family enumerated — never on the presence of a specific cyclosiloxane (§15, FS-21) |
| **G13** | **Claim authority [new in v0.2, ruling R12; extended in v0.3; narrowed in v0.4 — T9, T12; gains a narrow cross-market exception in v0.4 — T14].** A marketing claim exists only if the current German pack or the manufacturer's **German-market** page states it (rule 3 governs and the C2 row is worded to match — §2.4.1). A retailer's page for its **own private label** is that product's manufacturer page and is C2; all other retailer copy never creates a claim and may only corroborate. **Since T14, a manufacturer's non-German-market page can also create a claim, tier `C2_cross_market_verified`, but only when product identity is verified (identical formula/INCI or a German-retailer-confirmed shared GTIN) and at least one German-market retailer corroborates it (§2.4.1 rule 7); without both, the page is C5 and rule 3's ordinary reading stands.** Applies to HEAT — **the only claim-led field from v0.4; HUM governed this gate through v0.3 and is removed entirely (T9, §7.9)** — the `heat_styling` focus's `provides_heat_protection` half, **the positioning half of an `excluded_styling_first` G0 decision (§2.3.2)**, **the §10.1.2 weight conflict tag**, and every „… ist ausgelobt" string. **Claims are frozen at G1 in `claims[]` with their tier, and classification lanes consume them rather than re-researching them (§2.4).** No C1/C2 (or `C2_cross_market_verified`) source ⇒ the claim does not exist and the record routes to review (§2.4.1). **[v0.4 — T12: ROLE governed this gate via directions sourcing through v0.4-draft; ROLE is removed and its identity-capture successor, `application_stage`, is deliberately *not* added here — it reads G1's general directions hierarchy, not this claim-tier gate (§7.13).]** |
| **G14** | **Trace containment [new in v0.2, ruling R13].** Counter-signals, confidence, evidence levels and reading conventions are research-trace artifacts. They are never projected into a matching or user-facing field, and never modify a projected value. A projected value is exactly what its anchor says, or it is `unknown` (§10.1.1) |

---

## 12. False-signal register

The handover's eleven (FS-1 to FS-11, HO §8) plus the science review's sixteen (FS-12 to FS-27, SR §L). All twenty-seven are normative: producing one is a rule violation, not a stylistic lapse.

**From the handover (HO §8):**

| ID | False signal |
|---|---|
| FS-1 | Water is first, therefore the product is lightweight |
| FS-2 | Spray means lightweight; cream means heavy |
| FS-3 | Silicone-free means no buildup or low weight |
| FS-4 | A volatile silicone means the complete formula leaves no residue |
| FS-5 | Botanical oil or butter means deep repair |
| FS-6 | Glycerin automatically improves frizz in every climate |
| FS-7 | Any silicone, protein or panthenol proves heat protection |
| FS-8 | Anti-frizz and curl definition are the same property |
| FS-9 | A hold polymer equals conditioning or repair |
| FS-10 | A rinse-out ingredient study proves leave-on performance |
| FS-11 | A "10-in-1" label represents ten independent mechanisms |

**From the science review (SR §L), in source order:**

| ID | False signal |
|---|---|
| FS-12 | "Amodimethicone deposits selectively on damaged sites, so it cannot build up." A rinse-off argument that over-reads the deposition data even there: streaming-potential work shows deposition continues *after* surface-charge reversal, i.e. it does not self-limit. In a leave-on there is no rinse to remove the non-selective fraction |
| FS-13 | Scoring persistence high and buildup risk low from the same wash-resistance evidence — they are one property viewed from two ends |
| FS-14 | Reading `heat_protection_max_c` ("bis 230 °C") as a protection *strength*. It is a use-condition statement; published effect sizes are modest (10–20 % damage reduction in the classic study, ~50 % the commonly cited ceiling) and are not expressed in °C |
| FS-15 | "Humectants control frizz." Not merely climate-dependent — mechanistically the wrong direction. The best-supported anti-frizz route is *reducing* water uptake; humectants are a softness/plasticiser route and, for a humidity claim, a counter-signal |
| FS-16 | Treating the ~60 °F / 15 °C dew-point humectant threshold as science. Ubiquitous in curly-hair education, absent from the peer-reviewed literature. Do not encode the number |
| FS-17 | "Clear product = light product." Microemulsions are transparent by droplet size, not by low oil load; a clear silicone microemulsion spray can out-deposit an opaque milk |
| FS-18 | "No emulsifier / no fatty alcohol = no meaningful lipid load." Two-phase sprays carry an oil or silicone phase with zero emulsifier by design |
| FS-19 | "Coconut oil penetrates, therefore botanical oils repair." Rele & Mohile's own mineral and sunflower comparators failed; the result is specific to coconut oil, and the protocol was a pre-/post-wash oil treatment, not a leave-in at consumer dose |
| FS-20 | "Silicone-free plus a cationic polymer = low buildup." High-charge-density polyquaterniums are among the most substantive materials in the category |
| FS-21 | Treating "Cyclopentasiloxane present" as a durable classification rule. Under Regulation (EU) 2024/1328 it is a decaying signal in EU leave-ons (0.1 % limit from 6 June 2027). Key rules on *function* — "volatile carrier present" — with the INCI family enumerated (G12) |
| FS-22 | Quoting an instrumental combing improvement as a consumer-perceptible benefit. A 2018 study of actual consumer combing frequency and per-hair forces indicates the lab protocol does not map cleanly onto real grooming |
| FS-23 | Cross-lab comparison of gloss numbers — goniophotometric luster depends on incident-light direction and polarisation as well as on the hair |
| FS-24 | "Panthenol strengthens hair, therefore it protects from heat." The 2026 mechanistic work is about fibre mechanics and protein interaction, not thermal protection |
| FS-25 | Bottle rheology read as hair performance (Carbomer, Xanthan Gum, Hydroxyethylcellulose, Acrylates/C10-30 Alkyl Acrylate Crosspolymer). A thick leave-in cream tempts this far more than a rinse-out one |
| FS-26 | A leave-in "plex/bond" product inheriting salon bond evidence — different concentration, contact time and often professional application; an exposure-regime mismatch on the same footing as the rinse-out/leave-on mismatch |
| FS-27 | Inferring pH, "pH-balanced", or acid-sealing behaviour from an INCI list. Not readable at all |

> **Overlap note.** FS-6 (handover) and FS-15 (science review) both concern humectants and frizz, and both are kept: FS-6 forbids the *climate-dependent* framing, FS-15 corrects the *mechanistic direction*. A record that avoids one while producing the other still fails.

---

## 13. Heat protection — the strict rule (ruling 6)

This is the category's **single largest overreach risk** (SR §G.3), so the rule is stated in full.

### 13.1 What is actually published (SR §G.1)

Two peer-reviewed anchors exist, and both are narrower than the category's marketing:

- **Zhou et al., *J Cosmet Sci* 2011;62(2):265–282** — flat irons above 200 °C; endpoints FTIR imaging (α-helix → β-sheet conversion), DSC keratin denaturation, dynamic vapour sorption, AFM, SEM, thermal imaging. Breakage was significantly reduced by pretreatment with **VP/Acrylates/Lauryl Methacrylate Copolymer**, **Polyquaternium-55**, and a **polyelectrolyte complex of PVM/MA Copolymer with Polyquaternium-28**.
- **McMullen & Jachowicz, *J Cosmet Sci* 1998;49(4):245–256** — curling-iron thermal degradation; 1 % solutions of **PVP/DMAPA Acrylates Copolymer**, **Quaternium-70** and **hydrolyzed wheat protein** each reduced damage on the order of **10–20 %** versus control.

Supporting but weaker: amino-silicone conditioning work across treatment conditions; and a supplier conference poster on silicones as thermal protectants — **not peer-reviewed**, and labelled as such wherever used.

Method note: DSC is the sensitive method but gives a **binary** answer — protection happened or it did not — and does not translate to consumer-perceptible damage. Automated repeated grooming after ironing supports "X % less breakage" claims but is less sensitive. Tryptophan fluorescence loss is the third common endpoint. **There is no settled formula-to-protection mapping.**

### 13.2 The state ladder (research trace)

Throughout this ladder, **"claims" means a C1/C2 claim under §2.4.1 (G13)**: the current German pack or the manufacturer's German/EU page — **or, since v0.4 (T14), a claim admitted under §2.4.1 rule 7's identity-verified cross-market exception, tier `C2_cross_market_verified`.** Retailer copy on its own is recorded but never creates the claim; it can only corroborate an existing C1/C2 (or `C2_cross_market_verified`) claim.

| Formula situation | Highest defensible state |
|---|---|
| No C1/C2 heat claim and no L9 member | `not_claimed` |
| **No C1/C2 heat claim, L9 member present (v0.2)** | `not_claimed`, with the L9 observation recorded in the trace. **A formula does not manufacture a claim** — this closes the v0.1 hole where an unclaiming product could reach `formula_plausible` while its binary stayed `false` |
| **L9 member present only at or below the tail marker (§3.1.1) (v0.2)** | No state upgrade. A tail-position hydrolysate or polymer is not "a plausible film-forming context"; record and stop |
| No relevant polymer; the product carries a C1/C2 heat claim | `claim_only` |
| Generic silicone / generic protein / panthenol / oil only, with a claim | `claim_only` — **not** `formula_plausible` |
| A member of the **closed L9 list**, **above the tail**, in a plausible film-forming context, **with a C1/C2 claim** | `formula_plausible`, E2, **low** confidence |
| The exact finished product tested (DSC, breakage-after-ironing, or tryptophan loss) with a stated protocol meeting §3.2 | `product_tested`, E3+ |
| A **system-level** C1/C2 claim ("… as a system of shampoo, conditioner and treatment") | The state the product's own evidence supports, usually `claim_only`, tagged `claim_scope: system_level`; the binary follows §13.3 unchanged and the record routes to review. Scope handling is an open item (§2.4.1 rule 4, §17.13) |

### 13.3 The production projection (ruling 6)

The production model carries **one binary field: `provides_heat_protection`.** The four-state evidence detail lives in the research trace only.

**Claim-led with a formula sanity-check.**

1. The **claim leads**: if the exact product carries a **C1/C2** heat-protection claim (§2.4.1, G13) — **or a `C2_cross_market_verified` claim admitted under §2.4.1 rule 7 (T14)** — `provides_heat_protection = true` is the normal outcome. This is a recommendation-policy decision, not an efficacy statement — the app is reporting what the product is sold as, and the claim's EU legality means a dossier exists, not that a test does (§3.3). **Retailer-only copy is not a claim and sets `false`** — with the retailer text recorded and the record routed to review under `claim_authority_gap`, so a missed manufacturer source is caught by a human rather than by a guess. **Retailer-only copy plus a verified cross-market identity match is different**: once rule 7's two conditions both hold, the claim exists (tier `C2_cross_market_verified`) and this rule proceeds exactly as it would for an ordinary C1/C2 claim.
2. The **formula sanity-check runs anyway**: compare the claim against the closed L9 list.
   - Claim present **and** an L9 member present **above the tail** → `true`, trace state `formula_plausible`.
   - Claim present, L9 member present **only at or below the tail marker** → `true`, trace state `claim_only`, and route to review. The tail-position member is recorded but earns no upgrade (§5 L9 tail-member rule).
   - Claim present, **no** L9 member → `true`, trace state `claim_only`, **and route the record to human review** with a "claim looks formula-unsupported" note. Review decides; the standard does not silently drop the claim.
   - **No claim, L9 member present → `false`, trace state `not_claimed`**, with the L9 observation recorded in the trace. A formula does not manufacture a claim, and in v0.2 the trace state and the binary can no longer point in opposite directions here.
   - Claim present, exact-product test present → `true`, trace state `product_tested`.

**Hard prohibitions.**

- **Never grade efficacy.** No "strong/moderate/weak heat protection", no 0–4 heat score, no percentage.
- **Never use `heat_protection_max_c`.** The field is removed from this model. The 221–232 °C figures on legacy rows are marketing **use-condition** parameters, not measured protection levels, and must not be promoted (FS-14). A product promising hair is "geschützt bis 230 °C" is making a claim no published method supports in that form.
- **Never let a generic silicone, generic protein, panthenol or an oil reach `formula_plausible`** (G10, FS-7, FS-24).
- **Adding a polymer to the L9 list requires new peer-reviewed evidence and a standard-version bump.**

**Open question (SR §M.8):** whether any German-market leave-in actually holds E3+ heat evidence is a per-product exercise. Until calibration answers it, `product_tested` may be a permanently empty state — record it as reachable but unobserved.

---

## 14. Human review triggers

Route to targeted human review for:

- G0 product-form ambiguity, and every `provisional_boundary` record;
- `HOLD = meaningful_hold_route` (styling-boundary decision) — the canonical trigger name is **`meaningful_hold_route`**, which is the §7.7 enum value itself: this bullet already effectively carried its id, and it is confirmed rather than assigned **[freeze-prep housekeeping addendum, 2026-09-13 — ledger row 20]**;
- a formula-source or identity conflict, or an absent exact-market formula/identifier — the canonical trigger name is **`formula_or_identity_conflict`** **[freeze-prep housekeeping, 2026-09-13 — ledger row 20]**;
- **a heat-protection claim with no L9 member** (§13.3);
- a proprietary bond/repair claim (R3 `chemistry_candidate`) — the canonical trigger name is **`bond_claim_review`** **[freeze-prep housekeeping addendum, 2026-09-13 — ledger row 20]**;
- root or scalp application, or any medically adjacent scalp/hair-loss framing;
- a fragrance-free or hypoallergenic implication — the canonical trigger name is **`fragrance_free_implication`** **[freeze-prep housekeeping addendum, 2026-09-13 — ledger row 20]**;
- multi-product or routine-level efficacy evidence being offered for a single leave-in;
- a two-phase product (least dose-predictable form, SR §M.9) — the canonical trigger name is **`two_phase_shake_dependency`** **[freeze-prep housekeeping addendum, 2026-09-13 — ledger row 20]**;
- a `PERS = permanent_cationic` record combined with `application_stage` including `dry_hair` **[v0.4 — T12: previously a `refresh` usage role; `dry_hair` is ROLE's identity-capture successor for the same dry-hair-usability evidence, §7.13]**;
- any proposed hard user-fit rule, or any attempt to replace a current production field.

**Added in v0.2:**

- **`claim_authority_gap`** — a heat claim found only in retailer copy, with no C1/C2 source located (§2.4.1). The review decides whether the manufacturer source was simply not found. **[v0.4 — T9: this trigger covered heat or humidity claims through v0.3; HUM is removed entirely, so a retailer-only humidity/anti-frizz claim now routes nowhere — there is no claim-keyed field left for it to gap-check against.]**
- **a system-level claim** carried into a product-level field (`claim_scope: system_level`, §2.4.1 rule 4);
- **missing directions capture** — `directions_capture: missing` after the G1 search (§2.4, R11);
- **`quat_structure: unresolved`** — a declared quat whose polymeric-vs-monomeric structure the INCI name does not settle (§7.6);
- **`tail_marker: none_visible`** on a record whose anchors depended on the tail boundary (§3.1.1);
- **an R3 `chemistry_candidate` carried as a secondary `repair` focus** (§10.2);
- **a `texture_fit` row-4 or row-5 record** (high weight without high slip, or a fallback `unknown`), because those cells state that formula alone cannot decide (§10.3);
- ~~**`scalp_application_fit = suitable_if_evidenced`**~~ — **removed in v0.4 with the field** (T4, §10.3.1). The standing trigger "root or scalp application, or any medically adjacent scalp/hair-loss framing" is unchanged and does the work.

**Added in v0.3:**

- **`candidate_below_tail`** — a §7.10-qualifying substantive route sitting at or below the tail marker, where R2 therefore takes its rank-supported `none_visible` value (§3.1.1, §7.10);
- **`claim_tier_basis: house_brand`** — a claim or direction taken at C2 because the retailer owns the private label, so a human confirms the ownership relation (§2.4.1 rule 6);
- **an applied §10.1.2 weight conflict tag**, carried to review with the C1/C2 intended-finish statement that triggered it;
- **a `provisional_boundary` record reached under §2.3.2 clause 2** — C1/C2 evidence materially contradicting a styling-first architecture read. (Already covered by the standing G0 trigger; listed because the precedence rule is new and the review needs the conflict named.)

**Added in v0.4:**

- **a captured `manufacturer_hold_level`** (§7.7, T7) — a manufacturer publishing a hold number for a product this standard reads as `hold_route_state: none` or `incidental_film` is a claim-versus-architecture divergence a human should see, exactly like a heat claim with no L9 member;
- **`repair_support_level: medium` or `high`** (§10.3.2, T6) — every non-`low` repair support level, because the level is the field a production consumer will read and `high` additionally asserts E3+ evidence that must be checked against §3.2 and G8.

**Removed in v0.4:** the two `scalp_application_fit` triggers, with the field (T4); and every HUM-specific routing — the `claim_authority_gap` humidity clause and any trigger keyed on `humidity_resistance_evidence_state` or `specialist_functions.humidity_resistance` — with the field (T9). A pre-existing `humidity_frizz` claim in a frozen packet routes to no trigger at all; it is unconsumed upstream data (§7.9). No ROLE-specific trigger is removed with the field (T12) — the one trigger ROLE fed (`PERS = permanent_cationic` + dry-hair use, above) is re-keyed onto `application_stage`, not dropped, and an ambiguous `application_stage` reading routes through the standing identity-conflict trigger rather than a new one (§2.4, §7.13).

**Added by T17 (hard-rule audit, 2026-09-11):**

- **`l9_member_without_claim`** — an L9 closed-list member (§5) present **above the tail marker** with **no** C1/C2 (or `C2_cross_market_verified`) heat-protection claim (§13.3 rule 2's `false`/`not_claimed` row). The binary stays `false` — the claim-led policy is deliberate (ruling 6) and a formula does not manufacture a claim — but the record routes to review so a human can decide whether the manufacturer source was simply not found, exactly as `claim_authority_gap` already does in the mirror direction. This is the mirror of the standing "a heat-protection claim with no L9 member" trigger above, which fired four times on the round-3/4 gold set; this trigger has not yet fired on this gold set (§17 item 25 addendum, hard-rule audit item H8).
- **`tail_marker_vacuous`** — a tail marker so late that everything ranked at or below it is only capped material, fragrance/allergen declarations or colourants (§3.1.1 clause 6). No anchor may credit "present as architecture" solely on the strength of a vacuous marker's rank boundary; the record routes to review so a human confirms the coherence/ordinal read the anchor actually rests on (hard-rule audit item H1).
- **`species_reading_conflict`** — one species at one rank read as substantive architecture by one rule and as disqualified trace by another, on the same record (§2.3.2's cross-rule consistency clause; hard-rule audit item H9). Neither reading is overridden by the trigger; it exists to surface the divergence.
- **`dual_use_directions`** — a captured application direction that offers leave-on use as an alternative to rinsing (§2.4 rule 2, clause 2). The record stays in-category; a human confirms the leave-on-only `application_stage` transcription (hard-rule audit item H3).

**Tail-marker trigger definitions [new in v0.4 — T17, hard-rule audit item 7].** Five names were already in use across the reference key with no definition in this standard — the "lane convention, not rule" gap the audit's own structural observation names (§17.18). They are now defined, matching the reading each already carries in the reference key:

| Trigger | Fires when |
|---|---|
| `tail_marker_dependence` | An ordinary mid-list marker — neither very early, very late, vacuous, absent nor allergen-block-only — whose position nonetheless decided at least one §7 anchor's "present as architecture" read. The standing reminder that §3.1.1 is a heuristic (mandatory limit 1): every record that leans on it routes for a human to see the marker named. |
| `very_early_tail_marker` | The marker sits at the extreme early end of the list (the mandatory-limit-3 paradigm shape: an entire readable conditioning architecture would nominally fall in the sub-1 % tail). Distinct from `early_tail_marker` by degree, not by mechanism — both are limit-3 cases; this is the more extreme one. Independent of, and may co-occur with, `tail_marker_implausible` (§3.1.1 clause 5) where the marker also outranks the architecture it should bound. |
| `early_tail_marker` | The marker sits early in the list — a mandatory-limit-3 strong counter-signal on the anchors that lean on it — but not extremely so. |
| `very_late_tail_marker` | The marker sits far down a long list, so the above/below test separates comparatively little of it (§17.18) — but the tail it defines is **not** vacuous: at least one ingredient at or below the marker falls **outside** §3.1.1 clause 6's closed set (a)–(d), i.e. is a functional species. Where every tail ingredient falls inside that set, `tail_marker_vacuous` fires **instead of, not alongside**, this trigger; the two are mutually exclusive and a record may never carry both. **[test re-keyed onto clause 6's exhaustive enumeration — freeze-prep housekeeping, 2026-09-13 — ledger row 20]** |
| `tail_marker_allergen_block_only` | **Superseded by H2 (clause removed from the marker-eligible list, §3.1.1).** Retained here, struck through in substance, for audit continuity: through v0.4-draft this named a record whose only capped-list entry was the declared EU allergen block. Such a record now reads `tail_marker: none_visible` under mandatory limit 2, and routes under the standing `tail_marker: none_visible` trigger instead. |

**Added by T18 (2026-09-12):**

- **`formula_source_conflict`** — a **same-market formula-set conflict that did not reach §2.4.2's convergence bar**: independent captures of the same German-market unit disagree on which species are declared, and tier 1 could not resolve it, so the affected dimensions take `unknown` and the record cannot commit to the catalog until the conflict is resolved (§2.4.2 tier 2, AD-2). A conflict that *was* resolved under tier 1 does **not** fire this trigger — it routes under the standing **`formula_or_identity_conflict`** trigger above, because its residual is a preserved outlier capture rather than an unreadable formula. A **cross-market** formula difference fires neither: it is an identity question under §2.4.1 rule 7 (T14) and routes under the standing identity-conflict trigger (§2.4.2's scope boundary). *Naming note: the reference key already used this name ad hoc on gold-set slot 3 (Cantu), whose difference is cross-market and therefore outside T18's scope — the same "lane convention, not rule" gap T17's housekeeping closed for the tail-marker names. T18 defines the name; it re-derives no record, and slot 3's routing is unchanged by this definition.* **[Re-keyed 2026-09-13 — freeze-prep housekeeping, ledger row 20: slot 3's ad-hoc use of this name is corrected to the standing `formula_or_identity_conflict`, so the name now carries only the T18 tier-2 meaning defined here. See the vocabulary rules below.]**

**Trigger vocabulary — canonical names and emission scope [freeze-prep housekeeping, 2026-09-13 — ledger row 20].** §14 is the canonical list of trigger names and has been since T17's housekeeping pass, but the unseen test found three ways two disciplined lanes still diverged on it without any value moving (`unseen-test-report.md` secondary finding 3), and round 4 found a fourth — rule 4 below, added by the 2026-09-13 addendum to ledger row 20 (round-4 report residue item 7). The exact names and emission rules bind from here:

1. **`formula_or_identity_conflict` is the canonical name; `formula_source_or_identity_conflict` is a retired alias.** The standing trigger above is spelled `formula_or_identity_conflict` and only that. Lane B emitted the longer form on five records; it is not a second trigger and no record, key or fixture may carry it. Do not confuse either with **`formula_source_conflict`**, which is a *different* trigger with a narrow T18 tier-2 meaning (a same-market set conflict that failed the convergence bar), never a synonym for the standing one.
2. **An excluded record emits no `g0_boundary_decision` trigger.** `excluded_anhydrous`, `excluded_styling_first` and `excluded_other_form` **are** the routing: §2.3.1 already requires the exclusion state, its rationale and a `review_status` of at least `provisional`, and the standing G0 trigger above already routes G0 ambiguity and every `provisional_boundary` record. A trigger restating the state the record's own `g0_state` field carries adds no routing and makes two lanes' trigger lists undiffable. Lane B's emission on u2 and u3 was surplus. The name `g0_boundary_decision` is **not** a §14 trigger and may not appear in any record. **An in-category record that was a genuinely close boundary call still routes** — under the standing G0-ambiguity trigger, or as `provisional_boundary`, both of which already exist.
3. **`tail_marker.marker_status` is a required field on every in-category record.** Values: **`plausible` | `implausible` | `vacuous` | `none_visible`** — the four states §3.1.1 defines (clause 5, clause 6 and mandatory limit 2), and no others. It is stated on every in-category record whether or not it routes, because "the marker was read and found plausible" and "the marker's status was never recorded" are different facts and only the field distinguishes them, exactly as §8.6 rule 1 keeps "no Hinweise" distinguishable from "Hinweise not researched". Lane A emitted it and lane B did not; lane A additionally used `very_late` as a value, which is a **trigger** name (and, on those records, the wrong one — see §3.1.1 clause 6), not a marker status. **This requirement binds in-category records only.** §2.3.1's emission contract governs what an excluded record carries, and the tail marker is not on it; an excluded record may carry a marker reading inside the optional informational block, but is never required to and never routes on it.
4. **Four standing bullets get canonical ids [addendum 2026-09-13 — freeze-prep housekeeping, ledger row 20; round-4 report residue item 7].** T17's housekeeping pass named the five tail-marker triggers and left four standing bullets above with no id at all, so both round-4 lanes improvised names for them — the same "lane convention, not rule" shape, one round later. The ids bind from here and no synonym may appear in any record, key or fixture: **`two_phase_shake_dependency`** (a two-phase product), **`meaningful_hold_route`** (`HOLD = meaningful_hold_route`), **`bond_claim_review`** (a proprietary bond/repair claim, R3 `chemistry_candidate`) and **`fragrance_free_implication`** (a fragrance-free or hypoallergenic implication). Each is matched to the bullet it already described; **`meaningful_hold_route` is confirmed, not assigned** — the §7.7 enum value was already doing the work of an id and every lane used it, so re-naming it would have created the alias problem rule 1 exists to close. No bullet's firing condition, wording or routing changes: this names four triggers that already fired, exactly as T17's tail-marker table did.

---

## 15. Regulatory watch and the 2027 re-review trigger

**Commission Regulation (EU) 2024/1328** (in force 6 June 2024) amends REACH Annex XVII entry 70 and extends the cyclosiloxane restriction. The 0.1 % w/w limit for **D4/D5/D6** applies to **rinse-off** cosmetic products from **6 June 2026** and is extended to **leave-on** cosmetic products from **6 June 2027**.

Consequences for a standard authored in September 2026:

1. German/EU leave-in INCI lists **still legally contain Cyclopentasiloxane / Cyclohexasiloxane today**, but a reformulation wave to linear volatiles (Disiloxane, Hexamethyldisiloxane, Trisiloxane) and volatile hydrocarbons (Isododecane, Isohexadecane) is underway and completes within this standard's first year of life.
2. Any rule, anchor or calibration entry keyed on "Cyclopentasiloxane present" is a **short-lived rule**. **Gate G12** therefore requires rules to key on *function* — "a volatile carrier is present" — with the INCI family enumerated (§L2).

**`regulatory_re_review_trigger: 2027-06-06`** — adopted as an implementation default with no objection raised at charter review. On that date:

- re-verify every anchor and calibration entry that mentions a cyclosiloxane;
- re-verify the architecture read (§3.1.2) and WT anchors for products reformulated to linear volatiles or isododecane;
- record whether the substitutes change dry-down, weight or persistence enough to invalidate the anchors (**unknown today — SR §M.10; set the trigger rather than guessing**).

The second regulatory frame is **Commission Regulation (EU) No 655/2013** and its 2017 technical document: six common criteria for cosmetic claims, including evidential support, and specific guidance on "free from" and "hypoallergenic". Practical read for this standard: legality implies a dossier, never an instrumental finished-product test, and never an E-level upgrade (§3.3, §7.12).

---

## 16. Versioning and re-review rules

| Change | Consequence |
|---|---|
| **Formula change** (normalized formula fingerprint differs) | Reopen every field whose per-field fingerprint no longer matches (G7). Fields whose canonical payload is unchanged keep their approval. Re-run G0 only when the dominant architecture may have changed |
| **GTIN / identifier change** | Treated as a **new identity**. Re-run G1, re-verify the exact-market formula, and re-date the source. A GTIN may survive reformulation and a formula may survive a GTIN change — the two are related but separate |
| **Category-boundary change** | Re-run G0 across the affected cohort. A product that leaves the category retains its record as a boundary stress case rather than being deleted |
| **Directions change** | Reopen `application_stage` and any caution keyed on placement or frequency. Directions are E1 evidence, not metadata **[v0.4 — T12: previously named ROLE; `application_stage` is its identity-capture successor]** |
| **Standard-version bump** | Reopen only the fields whose rules changed; record which in the change log. Approvals for unchanged fields remain valid |
| **L9 list change** | Requires new peer-reviewed evidence, a standard-version bump, and re-review of every record with a heat claim (§13.3) |
| **Regulatory trigger 2027-06-06** | §15 |
| **Calibration rule change** | Systemic rule changes require a full pilot re-run. Product-specific uncertainty remains uncertainty and does not become a rule |

**Fingerprints (G7).** Each canonical profile field carries a deterministic **unsalted** SHA-256 fingerprint of its canonical field evidence/value payload. The whole-profile fingerprint is versioned and binds the lean profile plus `category_standard_version`; it is not a substitute for per-field fingerprints.

---

## 17. Open evidence gaps — must stay open in v0.4

None of these may be closed by inference. Each is recorded here so a record that touches it inherits the limitation (SR §M). Items 13–17 are new in v0.2, items 18–24 are new in v0.3 and items 25–26 are new in v0.4; they are gaps the calibrations and the trim exposed, not gaps either created. **A gap is not closed by removing the field that exposed it** — items 5, 16 and 20 are re-scoped by the v0.4 trim and stay open.

1. **Consumer dose per form.** No published, market-representative grams-per-use figures for sprays, milks or creams. Only laboratory protocol conventions (~0.2 g/g leave-on, ~0.1 g/g rinse-off) and patent ranges. This propagates into WT, PERS and buildup — each inherits an unmeasured term. **[v0.4: it no longer propagates into a DOSE field, because there is none (T3). The gap is unchanged; the standard simply stopped asserting a per-product value on top of it.]**
2. **Leave-in accumulation over realistic use cycles.** No retrievable finished-product study. Circulating percentages are untraceable and banned (§7.6).
3. **Transfer** to skin, collar, pillow. A real user complaint; no published instrumental method surfaced. Qualitative caution only.
4. **Layering / pilling.** No measurement as a function of product layering. Caution string only (§8.4).
5. **Whether wet and dry slip separate meaningfully from formula in leave-on.** Unresolved. **[Re-scoped in v0.4: SLIP is no longer a dimension (T1), so this is now a limitation on what the absorbed slip observation inside COND can support — it may name contributors and, where the architecture settles it, a bias reading, and it may not assert that wet and dry separate. The gap stays open.]**
6. **Curl definition from formula.** No mapping exists; technique is a large uncontrolled term (§8.2).
7. **Humidity response from formula.** No mapping; only measurable, never inferred. **[v0.4 — T9: this is no longer a gap the model tries to cross at all.]** HUM, the field this gap was attached to, is removed entirely — the model does not attempt a formula-based or claim-based humidity read of any kind, so there is no anchor left for the gap to under-support. The underlying scientific fact is unchanged and would bind again if humidity evidence were ever reintroduced.
8. **Whether any German-market leave-in holds E3+ heat evidence.** Decides whether `product_tested` is a live state (§13.3).
9. **Two-phase dose variability.** Shake quality changes the delivered oil:water ratio per actuation. Unmeasured.
10. **What replaces D5/D6 in EU leave-ons after June 2027**, and whether the substitutes change dry-down, weight or persistence enough to invalidate v0.1 anchors (§15).
11. **Fine-hair residue thresholds.** No evidence establishes a residue load at which fine hair reads as limp. Any threshold here is a **product judgment call** and must be labelled as one (§7.5).
12. **Sensitive-scalp tolerance from INCI.** Not derivable. EXPO flags describe exposure; they do not predict tolerance (§7.12).
13. **System-level claims and product-level fields.** Whether a manufacturer claim explicitly conditioned on using a product *as a system* should set that product's own production binary is a product-policy question. v0.2 records the claim, tags its scope, applies the claim-led binary unchanged and routes to review; it does not decide the policy (§2.4.1 rule 4, §13.2). **Open adjudication item.**
14. **The tail-marker heuristic is unvalidated.** §3.1.1's capped-preservative-rank convention is adopted so two reviewers reach the same answer. No published method validates it against measured concentrations, and it is decisive on several anchors. It is a reading convention, never a measurement, and every record that leans on it says so.
15. **Spreading-band membership for unenumerated liquid vegetable oils.** §7.5 reads them in the medium band by convention. No spreading-value measurement supports member-by-member placement for sunflower, soy, argan, apricot kernel, macadamia, safflower or canola; SR §D.1 supports the *organising variable*, not a per-oil table. Do not extend the L3 band table on the strength of this convention.
16. **Whether wet/dry slip bias is readable at all.** The bias qualifier had no matching value for a non-film persistent lipid load or for a monomeric-quat-only architecture, and returned `unknown` four times in round 1 and on 8 of 12 profiled round-2 records (ref A18, blind A23). **Not repaired in v0.2 or v0.3.** **[v0.4: T1 removes the field the gap was attached to. That is a scope decision, not a repair — the observation is still unreadable, it is simply no longer presented as a reviewable value. The gap stays open and is the reason the absorbed slip observation records a bias only where the architecture settles it.]**
17. **Lean-profile `unknown` and the production adapter.** §10 now carries `unknown` in five enums (the four added in v0.2 plus `care_direction`). No production field is known to accept it. The adapter mapping is a Phase-5 decision this standard does not design (§10, §10.4). **[v0.4 — T12: this item previously also named `usage_role`, which could project as `[]`. `usage_role` is removed; the adapter no longer needs to handle that case, and `application_stage` is not a lean-profile field so it is not an adapter-mapping question at all.]**
18. **The tail marker's variance across list lengths.** §17.14 records the heuristic as unvalidated; round 2's evidence is that its **variance** is the practical problem rather than its accuracy. The marker landed at rank 3 of 24 on one product (the whole conditioning architecture nominally in the tail), at rank 36 of 40 on another (the test separates almost nothing), and on a third no preservative was declared at all. §3.1.1's limits 2 and 3 cover the *absent* and *very early* cases; v0.3 makes rank the single deterministic prong (§3.1.1) without claiming to fix the variance — that is the trade it makes, recorded here rather than hidden (ref A17, blind A4). **[v0.4 — T16 covers the implausibly-early case generally (clause 5) and T17 covers the *vacuous*-late case generally (clause 6, hard-rule audit item H1) — the specific gap this item named ("nothing covers a marker so late that the test is vacuous") is closed as a rule.** The broader variance gap stays open: a late marker that is *not* vacuous (real architecture genuinely sits in its tail, e.g. rank 28 of 51 on the Cantu gold-set record) still separates comparatively little of a long list with no correction, and that is unchanged by either ruling.]**
19. **L5 membership for Polyacrylamide.** v0.3 enumerates VP/Methacrylamide/Vinyl Imidazole Copolymer and Polysilicone-29 (§5) because round 2 produced a disagreement on them. Polyacrylamide — and the other materials §21.1 recorded as "resolved by analogy" — are not on the round-2 fix list and stay unenumerated. A round-3 disagreement makes them a v0.4 item (blind A13).
20. **`curl_definition_focus` has no value vocabulary.** §8.2 requires the focus to be derived but names no permitted values anywhere in this document; round 2's blind lane had to invent a pair. Two lanes cannot agree on this field by construction. Not on the round-2 fix list (blind A9). **[v0.4: CURL now fires into the `hinweise` record (T5, §8.6) only when a curl-definition focus was actually derived — which, with no vocabulary, is never. The gap is unchanged and is why the CURL entry is empty on every round-3 record.]**
21. **Alcohols outside the `Alcohol Denat.` / `Alcohol` enumeration.** §7.12's alcohol note and §10.3.1's irritant-load trigger both key on that enumeration; Isopropyl Alcohol appeared twice in round 2 and is not covered. Not on the fix list: no note was emitted and the observation was recorded (blind A12).
22. **`care_direction` has no value for a film-led architecture — CLOSED 2026-09-12 by T19.** The gap as it stood: §9's silicone-led `unknown` rule was gated too narrowly to catch a film-led product — one with any emollient or humectant leg returned `moisture`, including a blow-dry primer whose own C2 claim is „Feuchtigkeits**schutz**" — and §9's protein-versus-moisture vocabulary had no value at all for the shape round 2 found (ref A10). This item recorded itself as belonging in **a Nick fork rather than a repair pass**, and that is exactly how it was closed. **Nick's binding ruling T19** gives `balanced` a **second, explicitly co-equal reading — directional neutrality** — so a film-led architecture with no protein anchor and no moisture leg present as architecture resolves to `balanced` rather than abstaining, and `unknown` is reserved for genuine evidence failure (§9, §21.3 row 19). The *ontology* half of the gap is closed: the vocabulary now has a value for the shape. The *gating* half is closed by making the gate **checkable and deterministic** — clause 3's present-as-architecture bar plus clause 4's ordinal corroboration — and **not** by lowering it: a film-led product with a genuine leg above its own marker is still `moisture` by design, which is why gold-set slot 13 (the „Feuchtigkeitsschutz" primer this item names) is unchanged and only slot 5 moves. That boundary is a ruled product call, not a residual defect. **[closed in v0.4 — T19]**
23. **Directions that exist and are verified but sit below C1/C2 authority.** §2.4 rule 3 routes *absent* directions to review; there is no route for captured, plainly pack-derived directions reproduced by a retailer. Round 2 hit this on four products and routed them by analogy, and it was the largest single source of empty `usage_role` values. Adjacent to the v0.3 house-brand clause (§2.4.1 rule 6) but not the same question (ref A19, blind A21). **[v0.4 — T12: this gap was about ROLE's own C1/C2 claim-tier gate specifically. ROLE is removed, and its identity-capture successor `application_stage` is deliberately not gated the same way (§7.13) — it reads G1's general directions hierarchy, so this particular gap does not recur for it. The gap stays open as a historical record of what affected ROLE.]**
24. **Which §7 dimensions an excluded record may carry.** §2.3.1 makes them optional without saying which, so two lanes emit different subsets and a machine diff of exclusion records is not well-defined (blind A22).

25. **The `repair_support_level` boundary between `low` and `medium` rests entirely on R2**, whose own ceiling is low–moderate and whose evidence base is supplier-dominated (§7.10). The rule is deliberately conservative — bond claims are `low`, marketing is `low`, a below-marker qualifying route is `low` — and its consequence on the round-3 gold set is that **all eleven in-category products are `low`**. That is an honest read of the evidence, not a calibration of the field: no product in the set carries a qualifying R2 route above its tail marker, so **the `medium` row has never been exercised and the `high` row is E3+ and unobserved**. Both need a product that reaches them before the rule can be said to discriminate. **[new in v0.4 — T6]**
26. **What the app's application-guidance layer actually says about dosing — CLOSED 2026-09-05.** T3 removes the DOSE field on the ground that general dosing advice already lives there. Verified by the orchestrator against the codebase: the personal-plan application templates carry per-step dosing guidance (e.g. `src/lib/routines/personal-plan/application/shared-templates-v2.ts:306` — „Mit einer sehr kleinen Menge beginnen und nach dem Styling sparsam über Längen und Spitzen geben.", plus further „sparsam"-guidance at lines 416 and 528). The removal rests on verified ground. Were that layer ever removed, the consequence would be a **product gap, not a standard gap** — the answer is not to re-derive a per-product dose sensitivity from the same WT observation. **[new in v0.4 — T3; closed same day]**
27. **The two-phase shake instruction belongs to a per-product application-guidance/protocol layer that does not exist yet — open, not decided here.** T10 makes `product_form` the presentation form captured at identity and cleanly separates it from the architecture read, but it deliberately does **not** touch the shake caution: the §18 string („Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark.") and the §14 two-phase review trigger keep being emitted when the architecture read (§3.1.2) resolves to `two_phase`, exactly as T3 left them (§7.1). The honest position is that this caution is a per-product **handling instruction**, not a fact about format, and belongs in the app's application-guidance/protocol layer as a per-product step — the same layer item 26 verified already carries general dosing guidance — rather than as an architecture-keyed research projection. This standard does not build that layer or move the caution; it is recorded as a handover item for whoever designs the Phase-5 production adapter (§10.4, §17 item 17), exactly as item 17 already records that adapter as undesigned. **[new in v0.4 — T10; unaffected by T11 — the trigger already keyed on the architecture read rather than on FORM being separately reviewable. Joined in v0.4 — T12 — by the ROLE `ends_only` placement note (§7.13), which this standard likewise no longer emits as a scored field and hands to the same undesigned layer.]**

**Three carried-open assumptions from the charter**, listed so they are not mistaken for settled: the DB `format` enum reconciliation, the projection of the four-state heat evidence onto existing production fields, and the blind-reviewer identity. All three are later-phase decisions.

**Carried-open from round 1**, listed so the fix list and the fork list are not confused with each other: the gold-set slot vacated by the rinse-out exclusion and its proposed replacement are a Nick decision, not a standard change (DL C1).

---

## 18. German product-facing copy examples

All UI text is German. These are **patterns**, not approved copy — final wording goes through the normal copy review. Each example states the field that emits it and shows the conservative, uncertainty-honest register the standard requires.

| Emitted by | German string |
|---|---|
| WT = `high` | „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren." |
| WT = `low` | „Bleibt leicht im Haar und beschwert kaum." |
| Architecture read (§3.1.2) = `two_phase` | „Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark." |
| Buildup caution (§8.5) — **either limb**: `persistence` → `permanent_cationic`, **or** `weight_potential` → `high` with a persistent non-volatile family present as architecture **[firing condition re-keyed onto §8.5's T17-widened rule — freeze-prep housekeeping, 2026-09-13 — ledger row 20]** | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." |
| Transfer caution (§7.5, §8.6) — a low-spreading, non-volatile, non-film-forming lipid load present as architecture **[string added — freeze-prep housekeeping, 2026-09-13 — ledger row 20]** | „Kann sich auf Haut, Kragen oder Kissen absetzen – schwere Öle bleiben an der Haaroberfläche. Belegt ist das nicht." |
| LAYER caution (§8.4) | „Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen." |
| HEAT trace `claim_only` | „Als Hitzeschutz ausgelobt. Wie stark der Schutz ist, bewerten wir nicht – dafür fehlen belastbare Produkttests." |
| HEAT trace `formula_plausible` | „Enthält ein Polymer, für das Hitzeschutz in Studien untersucht wurde. Für dieses Produkt selbst liegt uns kein Test vor." |
| HEAT claim without L9 member (review route) | „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das." |
| R3 = `claim_only` | „Bond-Technologie ist ausgelobt. Unabhängige Belege für einen Struktureffekt im Haar fehlen." |
| R3 = `chemistry_candidate` **[v0.3]** | „Enthält einen Baustein aus der Bond-Kategorie. Unabhängige Belege dafür, dass sich damit die Haarstruktur verändert, fehlen – wir prüfen das." |
| R2 = `candidate`, cationised-protein or silane route | „Enthält einen Protein-Baustein, der sich als Film aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur." |
| R2 = `candidate`, silicone-quat route | „Enthält ein Silikon-Quat, das als Film auf dem Haar bleibt. Das ist Pflege an der Oberfläche, keine Reparatur." |
| HOLD = `meaningful_hold_route` | „Bringt Halt über ein Styling-Polymer – das ist etwas anderes als Pflege." |
| EXPO = `no_listed_fragrance_signal` | „Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen." |
| EXPO = `fragrance_declared` | „Enthält deklarierte Duftstoffe." |
| EXPO = `aromatic_or_allergen_exposure` **[string added — freeze-prep housekeeping, 2026-09-13 — ledger row 20]** | „Enthält deklarierte Duftstoff-Allergene oder aromatische Pflanzenstoffe." |
| EXPO alcohol note | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben." |
| Any `unknown` field | „Dazu haben wir keine belastbare Information." |
| G6 medical boundary | „Bei Juckreiz, Rötung, Schuppung oder Haarausfall bitte ärztlich abklären lassen – das ist keine kosmetische Frage." |

**Register rules.** State the mechanism, then the limit. Never promise a durability, a temperature or a wash count. Prefer „kann" over „wirkt". An explicit unknown always beats a confident guess.

**Added in v0.2.**

- **The R2 string is split by route.** v0.1 emitted „Protein-Film" for every R2 `candidate`, including silicone-quat routes, where it is simply wrong — the film is a silicone quat, not a protein (DL defect register). Each route now has its own string and neither is used for the other.
- **A claim-free HUM `formula_plausible` emits nothing** (§7.9). It is a trace observation, not a benefit, and no string may be added that presents it as one. **[v0.3: this case no longer exists — a claim-free hydrophobic film route now takes the state `not_claimed` (§7.9), so the sentence is unreachable rather than merely unused, and its intent is preserved.]**
- **„… ist ausgelobt" strings require C1/C2 claim authority** (§2.4.1, G13). The word „ausgelobt" asserts that the manufacturer makes the claim; retailer copy may never trigger it.
- **No string may express confidence or a counter-signal** (§10.1.1, G14). Uncertainty reaches the user as an `unknown` field value and its fixed string, never as a hedge appended to a value.

**Added in v0.3.**

- **Three strings round 2 found missing** (ref A15). A **claimed** HUM `formula_plausible` fell between the `claim_only` string and §7.9's deliberate silence on the claim-free case, so a C2 anti-frizz claim reached the user unqualified. `R3 = chemistry_candidate` had no string at all — §18 covered only `claim_only` — so a bond claim reached the user with **no** honesty qualifier, inverting §8.3's entire reasoning. And `scalp_application_fit = avoid`, the most restrictive scalp value in the model, was silent.
- **`R3 = none` emits nothing** (§8.3). The absence of a bond claim is not something a user needs told, and a string saying so would be the "we are unsure" register §10.1.1 forbids.
- **The new strings keep the register**: mechanism first, then the limit; „kann" rather than „wirkt"; no durability, temperature or wash count; and the scalp string states a placement, never a tolerance (§7.12, G6).

**Removed in v0.4.**

- **The DOSE string** („Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig.") — removed with the field (T3, §7.11). General dosing advice belongs to the app's application-guidance layer, not to a per-product research projection.
- **Both `scalp_application_fit` strings** — removed with the field (T4, §10.3.1). The scalp-adjacent copy the user still sees is emitted by EXPO („Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben.") and by the G6 medical boundary, both unchanged. **The register is unchanged: a placement is stated, a tolerance is never predicted.**
- **All three HUM strings** — „Anti-Frizz ist ausgelobt…" (`claim_only`), the **claimed** `formula_plausible` string added in v0.3, and the humectant counter-signal string — removed with the field (T9, §7.9). No replacement string is added: the anti-frizz user need is served, without ever naming humidity or frizz, by whatever copy the `smoothing` focus already emits for its own routes; it does not get a dedicated humidity sentence, because the model makes no humidity claim of any kind from v0.4 on.
- **No string is added in v0.4.** `repair_support_level` (§10.3.2) emits none — it is a matching field, and inventing a repair sentence for it would be exactly the overreach §8.3 and G8 exist to prevent.
- **No string changes under T10.** `product_form`'s redefinition (§7.1, §10.1) touches no copy: the architecture read resolving to `two_phase` still emits the „Vor Gebrauch gut schütteln…" string exactly as before, and no string is emitted by `product_form`'s new value. The row above is keyed on the architecture read (§3.1.2), not on the profile field, and stays accurate under the new meaning of `product_form`.
- **No string changes under T11 either.** FORM stops being a scored dimension, but the row above was already keyed on the architecture value resolving to `two_phase`, not on FORM being separately reviewable — the trigger condition is unchanged, only its home section moved (§7.1, §3.1.2).

**Added and re-keyed 2026-09-13 [freeze-prep housekeeping — ledger row 20].** Both sealed unseen-test lanes hit the same three §18 gaps independently (`unseen-test-report.md` secondary finding 4). All three are closed here; no existing string's wording changes, and no string is removed.

- **`EXPO = aromatic_or_allergen_exposure` gains its own string.** L8's enum has four values and §18 carried rows for two of them, so both lanes substituted „Enthält deklarierte Duftstoffe." on three records each — the stronger flag's string, chosen because it was the only one in the family. That substitution is now unnecessary: the value has its own row, in the same register as its sibling. **It states an exposure and predicts no tolerance** (§7.12, SR §M.12, G6): „deklariert" means labelled, and the string says nothing about who will or will not react. The word „Allergene" is the EU's own labelling term for the declared 26 and is used in that sense only — it is not a statement that the product causes allergy. **This is the one string change in this batch with a real emission consequence, and it is the widest one in the standard's history: nine of the eleven in-category gold-set records hold this EXPO value (slots 1, 2, 3, 4, 5, 6, 8, 9, 10) and none of them carries any fragrance-exposure string today, because the value had none to emit.** Each gains exactly one `cautions_de` entry at its next derivation; nothing is removed and no other field moves (`reference-key-v4/transform-notes.md` §24). **§1.1 holds**: the addition moves a record toward telling the user more, never toward a recommendation — the same direction T17's H6 buildup widening moved.
- **The buildup row is re-keyed onto §8.5's widened rule.** The row cited the pre-T17 `PERS → high` limb alone, while §8.5 has emitted on either the PERS limb **or** the T17/H6 `weight_potential: high` + persistent-non-volatile limb since T17. §8.5 was always the rule of record and the string itself is unchanged; the row's condition column now matches it, so a lane reading §18 alone no longer sees a narrower condition than the one that fires.
- **The transfer caution gains its string.** `transfer` is a §8 member — named in §8's own preamble and in §8.6's flag enum — and its firing rule has been §7.5's ("a low-spreading, non-volatile, non-film-forming lipid load present as architecture") since v0.1, but it had no German string anywhere, so a fired flag reached the `hinweise` record with nothing to say. Retiring the flag was rejected: §8 still carries the member and §7.5 still attaches the caution, so the honest fix is the missing string, not removing a live flag. **The string is qualitative by construction** — it names the mechanism and then its limit, and it never states an amount, a garment, a frequency or a wash: no published instrumental transfer method for hair leave-ons exists (§7.5, §17.3, SR §D.3, §M.3).

**Emission scope — two ambiguities the round-4 lanes split on, settled [addendum 2026-09-13 — freeze-prep housekeeping, ledger row 20; round-4 report residue item 6].** Neither is a new string, a wording change or a value change; both name which of the rows above fires on records where the table alone admitted two readings and the two sealed lanes took one each (round-4 report, caution-count residue). **(a) A `claim_only` heat record with no L9 member emits exactly ONE heat string, not both.** The rows „Als Hitzeschutz ausgelobt. …" (HEAT trace `claim_only`) and „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das." (HEAT claim without L9 member) both match such a record on their face; the **review string is the one that fires**, because it is the more specific row and it already carries everything the `claim_only` row says plus the formula finding and the honest „Wir prüfen das". Emitting both would state the same claim twice in one caution list and read as two separate findings. The `claim_only` row therefore fires only where the review row does not — i.e. where an L9 member **is** present (§13.3, §5). *This writes down what the reference key already emits: all four gold-set `claim_only`-without-L9 records (slots 8, 9, 10, 13) carry exactly this one string today, so no record changes and the double emission was a lane deviation.* **(b) `product_form: unknown` emits no string, and none exists to emit.** The „Dazu haben wir keine belastbare Information."-row is scoped to *researched* fields whose value could not be resolved from the evidence; `product_form` is an **identity capture** (T10: E1, read off pack, exact name and directions), so an unresolved presentation form is an **identity gap, not a research result** — it routes through identity review (§2.4, §14's standing identity-conflict trigger), which is where a missing capture gets closed, and no user-facing caution is emitted for it. A caution saying the form is unknown would also tell the user nothing they cannot see by holding the product.

---

## 19. Calibration status

### 19.1 Round 1 — completed under v0.1 (2026-09-03)

Round 1 ran the planned two-lane design on a 13-product gold set: a reference key lane and a sealed blind lane, each classifying from the same locked formula/directions packets, with the blind lane holding no key. Headline result:

- **363 fields compared, 86.2 % exact agreement, 50 substantive disagreements.**
- **Both designed boundary cases produced identical G0 exclusions** — the boundary rule generalises, which was the single most important thing to establish.
- **The disagreement mass sat on standard defects, not on erratic judgment.** Ten clusters (C1–C10) plus a consolidated defect register account for nearly all of it, and both lanes independently flagged several of the same holes.

What that means for this document: round 1 measured **the repeatability of the rules**, which is the only thing a calibration lane can measure. It did not establish that any value is correct. v0.2 is the repair pass — every cluster in the disagreement log has a rule change in §21, and none of those changes is a post-hoc adjustment to make two lanes agree on a *product*.

### 19.2 Round 2 — completed under v0.2 (2026-09-04)

Round 2 re-ran **both lanes** on the same 13-product gold set under v0.2, under the same seal discipline, with round-1 outputs sealed off and the packet extended with verified directions (R11). Headline result:

- **398 fields compared, 93.0 % exact agreement, 28 substantive disagreements** — up from 86.2 % and down from 50. Six slots agreed completely, and both exclusions that both lanes could decide agreed.
- **The v1→v2 regression was clean.** All 60 reference-key changes trace to intended v0.2 rules: the R12 claim-authority heat flips, the R13 weight downgrades, R14's damaged-hair tier move, and the C4/C6/C10/§7.10 tightenings. No untraced drift.
- **Verified working as designed:** the R11 rinse test, the multi-family WT row and its mandatory counter-signal, the monomeric-quat PERS rule, the plain-hydrolysate R2 rule, the L9 tail rule, the §2.3.1 exclusion contract, and G14 trace containment — no counter-signal, confidence value or reading convention reached a projected field.
- **The remaining 28 disagreements again sat on standard defects** — six clusters plus an overshoot list, not erratic judgment. v0.3 repairs exactly those; §21.2 is the ledger.

As in round 1, this measured **the repeatability of the rules**, which is the only thing a calibration lane can measure. It did not establish that any value is correct.

### 19.2.1 Round 3 — completed under v0.3 (2026-09-04)

Round 3 re-ran **both lanes** on the same 13-product gold set under v0.3, on a packet rebuilt to §2.4's v0.3 requirements — frozen `claims[]` with C-tiers and comma-safe INCI normalization — with **no web research in either lane**, so both lanes ran on fully deterministic inputs. Headline result (`plans/leave-in-inci/research/gold-set/agreement/round-3-report.md`):

- **398 fields compared, 97.5 % exact agreement, 10 disagreements.** Trajectory: 86.2 % (r1) → 93.0 % (r2) → 97.5 % (r3).
- **Every heat binary was decided from frozen `claims[]` with zero judgment in both lanes** — the v0.3 claim freeze (change 8) doing exactly what it was added to do. All three `true` products lack an L9 evidenced polymer and route to review by design.
- **Both boundary exclusions agreed** and the v0.2 `provisional_boundary` regression is gone under the §2.3.2 precedence rule.
- **The §10.1.2 weight conflict tag fired zero times and was correctly declined on all thirteen** — no C1/C2 intended-finish statement coincided with a formula-only WT `high`.
- The 10 residual disagreements sit on four items: the §10.2.1 permissive-vs-conservative reading of "beyond baseline conditioning", one packet directions capture, §9's under-firing silicone-led rule on a film-led architecture, and the designed Neqi styling boundary — the last of which is a **product-level call for Nick**, which is what that archetype slot is for. **Item 1 — resolved 2026-09-10.** Nick's ruling T13b adopts the permissive reading as a standing rule (§10.2.1); see §21.3 and `rule-changes.md`. **Item 4 — resolved 2026-09-10** by ruling T15, which is what that archetype slot exists for (§2.3.2, §7.7). **Item 3 — resolved 2026-09-12** by ruling T19, which gives `balanced` its second, co-equal film-led reading and closes open gap §17.22 (§9, §21.3 row 19). **Item 2** — the slot-3 packet directions capture — stays open, and is a packet fix rather than a rule fix.

As in rounds 1 and 2, this measured **the repeatability of the rules**, not the truth of any value.

### 19.2.2 Round 4 — required for the v0.4 trim, not yet run

**Nothing in v0.4 has been tested for repeatability.** A material change forces a re-run; that rule is unchanged and it binds v0.4 exactly as it bound v0.3 — with one honest qualification recorded here rather than assumed:

**v0.4 is a projection change, not an evidence change.** No anchor's evidence bar moved, no round-3 observation was re-derived, and the reference key's v4 run is a **mechanical transform of the round-3 key** (`derived_from_run: reference-key-2026-09-04-r3`), not a re-classification. Fields whose rule text changed only to name a different *carrier* for the same observation — `detangling`, `texture_fit` rows 3–5, the `smoothing` focus test — produce the same values by construction, and the transform is auditable against the r3 key.

What round 4 must nevertheless measure, because a rule that reads differently can be *read* differently:

- `detangling` and `texture_fit` rows 3–5, now reading the absorbed slip observation instead of a SLIP value (T1, §7.2, §10.2, §10.3);
- `focus.primary` and `focus.secondary` under the `smoothing` row's two-observation test, and the `smoothing_route` type recorded with it (T2, §7.4, §10.2);
- `repair_support_level` on every record — a field with no calibration history at all, and one whose `medium` and `high` rows the round-3 set never exercises (T6, §10.3.2, §17.25);
- the `hinweise` record on every record, specifically whether two lanes fire the same flags (T5, §8.6);
- `manufacturer_hold_level` on every product whose frozen `claims[]` carries a hold statement, and the tier decision behind it (T7, §7.7);
- `product_form` on every record, now captured directly at identity (pack, exact product name, directions) rather than projected from the architecture read (T10, §7.1, §10.1) — a newly-introduced identity read with no calibration history at all, unlike the fields above it is not a re-projection of a round-3 value onto a new carrier;
- `application_stage` on every record, now transcribed directly at identity from the same directions ROLE used to read (T12, §7.13, §2.4) — like `product_form`, a newly-introduced identity read with no round-3 baseline of its own; and the `heat_styling` focus wherever it now keys on `application_stage` including `pre_heat` instead of a ROLE value, though the underlying direction-sentence evidence is unchanged;
- every field the round-3 report left open — the four items in §19.2.1 are **not** resolved by v0.4 and are not on its list.

**HUM needs no round-4 measurement (T9).** Unlike the fields above, HUM is not re-projected onto a new carrier — it is removed, full stop, with nothing left to diff against a round-3 baseline. There is no `humidity_resistance_evidence_state` value for a round-4 lane to re-derive and nothing for two lanes to agree or disagree on.

**FORM needs no round-4 measurement of its own either (T11).** T11 does not touch a single anchor: the architecture taxonomy, its decision order and its solution↔microemulsion threshold are carried forward verbatim as the §3.1.2 reading convention, and G0, WT and COND read the same observation they always read. What changes is review surface, not evidence — the same kind of change T8 made, which needed no round-4 re-derivation either. Where the architecture read feeds a measured field (WT's ceiling, the two-phase dose-variability note), that field's own round-4 requirement — already listed above where applicable — covers it.

Round-3 values are **carried forward** for every field the trim did not touch, and **re-projected, never re-labelled**, for the fields it did. That is the difference between this bump and the v0.2 and v0.3 bumps, and it is stated so no reader takes the carried-forward values as re-tested.

**The v0.3 round-3 requirement, retained for the record:**

- `g0_state` on every styling-boundary record, under the §2.3.2 precedence rule;
- SFR under the two-observation anchor, and every `focus.primary` / `focus.secondary` that moves with it (§7.4, §10.2, §10.2.1);
- HUM under the reversed claim-led ladder (§7.9);
- R2 and the `candidate_below_tail` route, with their `damage_fit` row-3b and `repair`-focus dependents (§3.1.1, §7.10);
- `weight_potential` under the §10.1.2 conflict tag, and DOSE under the FORM-composition rule (§7.11);
- ROLE and the `heat_styling` focus under the `pre_heat` stage (§7.13, §10.2);
- `scalp_application_fit` under the narrowed `avoid` trigger (§10.3.1);
- HOLD on any record carrying an L5 material enumerated in v0.3 (§5), and FORM where the solution ↔ microemulsion threshold decided it (§7.1);
- every claim-keyed field on a house-brand product (§2.4.1 rule 6) and on a non-German EU manufacturer page (rule 3);
- R3 on every record, now that the enum carries `none` (§8.3).

Round-2 values are superseded for those fields, not carried forward: **a field whose rule changed must be re-derived, never re-labelled.**

Nick's adjudication of the round-1 forks (§21.1, R11–R14) is applied in this document and stands unchanged in v0.3 and v0.4. The round-2 items that are *not* standard changes — the product-level review of the current key state, the unseen-product test, and the vacated round-1 gold-set slot — are decisions outside this standard (§17).

### 19.3 The lane design, for the record

The planned lane, retained here because round 2 reuses it:

- 12 archetypes per HO §13, selected for **best archetype coverage regardless of catalog presence** (ruling 3), with exact identity, GTIN and current formula verified before classification, and the final 12 presented to Nick before any product is classified (ruling 8).
- 3–5 adversarial stress products: a lightweight-branded product with persistent film formers; a heat claim resting on generic silicone/protein only; a hold-driven "curl cream"; a 10-in-1 whose claims rest on one or two shared mechanisms; a GTIN/formula-conflict case.
- **Blind lane (ruling 2):** a clean reviewer receives this standard and the locked formula/directions packets but **not** the proposed key. Disagreements are coded by cause — source ambiguity, missing evidence, rule ambiguity, double counting, overconfidence, legitimate uncertainty, exposure-regime error. Nick adjudicates. Systematic disagreement becomes an explicit gate, cap or anchor; product-specific uncertainty stays uncertainty.
- A material rule change forces a full re-run. Reviewer agreement measures repeatability of the rules, not truth.

**Stop condition for v0.4.** Unchanged from v0.1, v0.2 and v0.3, and restated because v0.4 continues to carry production-shaped fields — and because `repair_support_level` is deliberately named after a live conditioner DB column, which makes the boundary easier to blur, not harder: this document produces **research artifacts only**. No catalog value, recommendation, Product Intake rule, Supabase row, user-facing copy or production matcher changes on its authority. The `unknown` enum members in §10, the `none` member added to R3 (§8.3), the `claims[]` freeze field (§2.4), the `hinweise` record (§8.6) and `repair_support_level` (§10.3.2) are a research-record shape, **not an adapter contract and not a write** (§17.17). Naming a field after `repair_level` states the intended alignment; it authorizes nothing.

---

## 20. Source anchors

This standard adds no science of its own. Every claim above traces to:

- `plans/leave-in-inci/research/leave-on-science-review.md` — the evidence base, including its full source register (§O: Tier 1 peer-reviewed/primary, Tier 2 regulatory, Tier 3 trade education, and the explicitly rejected sources). The named primary anchors relied on here are Zhou et al. 2011; McMullen & Jachowicz 1998; Rele & Mohile 2003; Marsh et al. 2026; the 2020 *Int J Biol Macromol* Michael-acceptor study; the 2013 *Colloids Surf A* streaming-potential study; the 2025 *Adv Colloid Interface Sci* LGN review; the 2012 *Colloids Surf B* emollient-spreading study; the 2018 consumer-combing study; Robbins 5th ed.; and the Manchester HHCR/DHCR work.
- `plans/leave-in-inci/handover/01_Leave_In_Category_Development_Handover_v1.0.txt` — category mission, boundary, user jobs, candidate ontology, lean profile, evidence requirements, calibration plan and system boundary.
- `plans/leave-in-inci/first-output-charter-draft.md` — Nick's confirmed rulings 1–8 and the decision-coverage record.
- `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md` — structural template only (gates, evidence scale, evidence object, anti-double-counting discipline). Its score rules and rinse-out science do not transfer.

**Regulatory:** Commission Regulation (EU) 2024/1328 (REACH Annex XVII entry 70; D4/D5/D6; leave-on 0.1 % from 6 June 2027) · Commission Regulation (EU) No 655/2013 and the 2017 Commission technical document on cosmetic claims.

**Added in v0.2 — calibration provenance (rule sources, not science sources):**

- `plans/leave-in-inci/research/gold-set/agreement/disagreement-log.md` — the round-1 disagreement log, clusters C1–C10, the singles, and the consolidated standard-defect register (**DL**).
- `plans/leave-in-inci/research/gold-set/agreement/agreement-diff.md` — the 363-field diff behind the 86.2 % figure.
- `plans/leave-in-inci/research/gold-set/blind/blind-review-notes.md` — the sealed blind lane's per-product notes, its §2 ambiguity register and its §3 record of invented method choices (**BR**).
- `docs/research/leave-in-inci/v1.0/rule-changes.md` — the append-style rule ledger; one entry per rule change with its motivating disagreement.

**Added in v0.3 — round-2 calibration provenance (rule sources, not science sources):**

- `plans/leave-in-inci/research/gold-set/agreement/round-2-report.md` — the round-2 report: the 93.0 % figure, the six clusters, the overshoot list and the clean-regression verdict. **This is the binding fix list for v0.3.**
- `plans/leave-in-inci/research/gold-set/agreement/agreement-diff-v2.md` / `.json` — the 398-field round-2 diff behind that figure.
- `plans/leave-in-inci/research/gold-set/agreement/regression-v1-v2.md` / `.json` — the v1→v2 reference-key regression trace.
- `plans/leave-in-inci/research/gold-set/reference-key-v2/summary.md` — the reference lane's round-2 summary and its residual-ambiguity list **A1–A19** (cited as **ref Ax**).
- `plans/leave-in-inci/research/gold-set/blind-v2/blind-review-notes.md` — the sealed blind lane's round-2 notes and its ambiguity register **A1–A27** (cited as **blind Ax**).

**The two round-2 registers number independently**, so every v0.3 citation states its lane. Round-1 citations keep their v0.2 codes (**DL Cx**, **BR §2.x**).

**Added in v0.4 — round-3 calibration provenance and the trim rulings (rule sources, not science sources):**

- `plans/leave-in-inci/research/gold-set/agreement/round-3-report.md` — the round-3 report: the 97.5 % figure, the 10 disagreements and their resolution routes.
- `plans/leave-in-inci/research/gold-set/agreement/agreement-diff-v3.md` / `.json` — the 398-field round-3 diff behind that figure.
- `plans/leave-in-inci/research/gold-set/reference-key-v3/` — the round-3 reference-key lane (key + per-product evidence chains + summary).
- `plans/leave-in-inci/research/gold-set/blind-v3/blind-review-notes.md` — the sealed blind lane's round-3 notes.
- `plans/leave-in-inci/research/gold-set/reference-key-v4/` — the **v0.4 projection** of that key: a mechanical transform of the round-3 record under T1–T9, with `derived_from_run: reference-key-2026-09-04-r3` and `transform-notes.md` recording the per-product result of every transform, including T9's field removal. **It contains no new classification.**
- **Nick's trim rulings T1–T9, 2026-09-05** — the binding authority for v0.4, recorded in §21.3 and `rule-changes.md`. They are product-model decisions, not evidence: none of them cites or requires a scientific claim, and none changes an evidence bar.

These are **rule provenance only.** They contain no science, and nothing in them may be cited as evidence for a product property.

---

## 21. Change log

### 21.1 v0.1 → v0.2

**Nick's adjudication rulings applied in v0.2.** These override any conflicting text elsewhere in the document.

| Ruling | Substance | Landed in |
|---|---|---|
| **R11** | Formula freeze / G1 must capture **and verify** directions-of-use, not just INCI | §2.4 mandatory directions capture, G1 |
| **R12** | A marketing claim exists only if the manufacturer's German/EU page or the current German pack states it; retailer copy never creates a claim, only corroborates. General claim-authority rule | §2.4.1, G13, §7.8, §7.9, §7.13, §13, §18 |
| **R13** | The "≥2 persistent non-volatile families, none rich-band" WT anchor is **`moderate`** with a **mandatory** counter-signal; counter-signals and confidence are research-trace only and never project | §7.5 multi-family row, §4, §10.1.1, G14 |
| **R14** | A genuine repair-film route (R2 `candidate`+) qualifies a product for the highly-damaged tier alongside the high-conditioning path; an R3 bond flag alone never does | §10.3 damage_fit row 3b, §10.2 repair focus |

**Rule changes, by motivating disagreement.**

| # | Change | Motivated by | Section |
|---|---|---|---|
| 1 | G1 directions capture made mandatory and verified; explicit rinse instruction excludes at G0 before formula analysis | DL C1 (a leave-in-freezed product was in fact rinse-out), R11 | §2.4, G1 |
| 2 | Claim-authority hierarchy C1–C5 introduced; retailer copy cannot create a claim | DL C5, BR §2.9, R12 | §2.4.1, G13 |
| 3 | FORM solution anchor: cationic-species requirement dropped | DL C2 | §7.1 |
| 4 | FORM: non-LGN emulsion sub-type added (nonionic / polymeric / silicone emulsifier systems) | DL C2, BR §2.12 | §7.1 |
| 5 | FORM: `two_phase` decidable from architecture (unemulsified oil + water); shake direction demoted to corroboration | DL C2, BR §2.12 | §7.1 |
| 6 | FORM: solution ↔ microemulsion threshold defined (solubiliser package + real oil/silicone load ⇒ microemulsion); clarity is corroboration only | DL C2, BR §2.12 | §7.1 |
| 7 | FORM decision order stated; `emulsion_subtype` kept trace-only | DL C2 | §7.1, §10.1 |
| 8 | §7.5's two-phase/microemulsion `high` clause and the "Form or …" `unknown` clause **removed**; G9 governs in both directions | DL defect register, BR §2.3 | §7.5, G9 |
| 9 | WT multi-family `moderate` row added, with mandatory counter-signal; DOSE follows it | DL C3, BR §2.1, R13 | §7.5, §7.11 |
| 10 | Rich-band membership fixed as a closed enumeration; unenumerated liquid vegetable oils read medium-band | BR §2.1 | §7.5, §17.15 |
| 11 | PERS `permanent_cationic` redefined as polymeric or silicone-functional quats, enumerated by INCI name; charge-density inference removed as G4-barred | DL C4, BR §2.11 | §7.6 |
| 12 | Monomeric long-chain quats placed in `neutral_non_volatile` with a required note; unresolvable quats routed to review | DL C4, BR §2.11 | §7.6 |
| 13 | "Present as architecture" / "above the tail" operationalised as the capped-preservative-rank heuristic, with mandatory limits and an explicit heuristic label | DL defect register, BR §2.2 | §3.1.1 |
| 14 | HUM: `formula_plausible` decided **claim-not-required**, with the decision and its two safety constraints documented; confidence capped at `low` — **⚠ reversed in v0.3 (§21.2 change 9): HUM is claim-led like HEAT, and a claim-free route observation goes to the trace with the state at `not_claimed`. Round 2 showed the claim-free state projects into a *matching* field that no §18 string was permitted to explain, which is the shape G14 exists to prevent** | DL defect register, BR §2.4a | §7.9 |
| 15 | HUM: "dominant" vs "any humectant lowers it" resolved into a two-step rule; glycol-as-solvent reading recorded, conservative default | BR §2.4b, §2.18 | §7.9 |
| 16 | R2 `candidate` narrowed to cationised protein / silane / silicone quat; non-silicone cationic polymers and peptides removed | DL singles, DL defect register, BR §2.5 | §7.10, §5 L6 |
| 17 | R2 `none_visible` covers a plain hydrolysate **at any position**, with a mandatory trace note | DL singles, BR §2.18 | §7.10 |
| 18 | L9 tail-member rule: an evidenced polymer at or below the tail earns no upgrade; an L9 member without a C1/C2 claim earns no upgrade and the binary stays `false` | DL defect register, BR §2.13 | §5 L9, §13.2, §13.3 |
| 19 | Focus selection procedure defined: qualifying routes, strength ordering, rank tie-break, positioning last | DL C6, BR §2.6 | §10.2 |
| 20 | `detangling` anchor rewritten — detangling-led positioning **or** a slip-dominant light architecture; SLIP `high` alone no longer sets it | DL C6, BR §2.6 | §10.2 |
| 21 | `repair` outranks `smoothing` only with a dedicated repair route; §10.2 repair row / §7.10 contradiction removed at source; R3 alone can no longer set `repair` primary | DL C6, DL defect register, BR §2.5, R14 | §10.2 |
| 22 | Secondary focus capped at 2 and gated on independent moderate+ support | DL C6 | §10.2 |
| 23 | `curl_definition` requires the fixative route **above the tail** — a trace polymer no longer makes every conditioner a curl product | DL C6, BR (slot-level finding) | §10.2 |
| 24 | `scalp_application_fit` fully specified: default `unknown`; `avoid` for heavy-occlusive/oil-led or EXPO-flagged irritant load; positives require explicit scalp-directed C1/C2 directions **and** clean EXPO; placement-without-scalp is `conditional` | DL C7, BR §2.18 | §10.3.1 |
| 25 | `texture_fit` matrix completed: weight-led rows, high-weight/non-high-slip row added, explicit `unknown` fallback row; `hair_thickness_fit` and `damage_fit` given matching `unknown` rows as a consequence of the enum change | DL C8, BR §2.7 (+ change 30) | §10.3 |
| 26 | `damage_fit` gains the independent repair-film path to the highly-damaged tier; R3 explicitly excluded from the table | DL defect register (fork 4), BR §2.8, R14 | §10.3 |
| 27 | `care_direction`: silicone-led architectures → `unknown`; humectant-led with no protein route → `moisture` at `low` confidence; "how much moisture leg" defined; marketing direction never sets the value | DL C9, BR §2.15 | §9 |
| 28 | ROLE: values only from C1/C2 directions, one verbatim direction sentence required per value, per-role sentence table added, shake instruction explicitly establishes nothing | DL C10, R12 | §7.13 |
| 29 | Excluded-product emission contract defined — identity + G0 + optional informational dimensions, **no lean profile** | DL defect register, BR §2.17 | §2.3.1 |
| 30 | `unknown` added to `product_form`, `conditioning_level`, `weight_potential`, `persistence`; **`hold_support` deliberately excluded** (§7.7 has no `unknown` state to project); adapter consequence recorded as an open item, adapter **not** designed | DL defect register, BR §2.16 | §10, §17.17 |
| 31 | Trace containment rule: counter-signals, confidence and reading conventions never project; two narrow exceptions named | R13 | §10.1.1, G14 |
| 32 | §18 R2 German copy split by route — „Protein-Film" no longer used for a silicone-quat film | DL defect register | §18 |
| 33 | DOSE rows corrected: water counts as a dominant carrier for `low`; `FORM = unknown` no longer forces `unknown` | BR §2.18 | §7.11 |
| 34 | Mandatory-counter-signal register added to the property-evidence object | R13 | §4 |
| 35 | Gates G13 (claim authority) and G14 (trace containment) added; G1 and G9 restated | R11, R12, R13 | §11 |
| 36 | Human-review triggers extended by eight v0.2 conditions | DL C5/C7/C10, BR §2.7/§2.9 | §14 |
| 37 | §19 rewritten from "no calibration has run" to round-1 result plus the round-2 re-run requirement | DL verdict | §19 |
| 38 | Open gaps 13–17 added; version stamps and envelope bumped to v0.2 | DL defect register, BR §2.2/§2.14/§2.16 | §17, header, §10 |

**Deliberately not changed in v0.2** — flagged in the blind lane's register but **outside the round-1 fix list**, so changing them would be an untraced rule change:

| Item | Blind register | Why it stands |
|---|---|---|
| COND `high` gated on an LGN pair, capping silicone-led products at `moderate` | BR §2.10 | Not on the fix list. It is a real ontology question with a product consequence (it moves `conditioning_level` and `damage_fit`), so it belongs in a Nick fork, not in a repair pass. **R14's repair-film path removes its worst consequence** — a specialist repair product no longer needs COND `high` to reach the highly-damaged tier |
| SLIP bias qualifier unusable for non-film lipid loads and monomeric-quat architectures | BR §2.14 | Not on the fix list; the WET+DRY merge is already flagged provisional and its resolution needs the open evidence question in §17.5. Recorded as open gap §17.16 |
| The COND `low` / SLIP `moderate` contradiction on a single short-chain quat observation | BR (slot 11 finding) | Not on the fix list, and not resolvable without deciding whether a monomeric quat is "a route" — the same question C4 answers for PERS but was not asked to answer for COND. Recorded here so round 2 can measure whether it still bites |
| L3 band table extension for unenumerated oils | BR §2.1 | v0.2 adopts a **reading convention** (§7.5) rather than extending the band table, because SR §D.1 supports the organising variable, not a per-oil placement. Recorded as open gap §17.15 |
| L5 rheology-exclusion enumeration (Polyacrylamide, Polysorbate 20, PQ-16, VP/Methacrylamide/Vinyl Imidazole Copolymer) | BR §2.18 | Not on the fix list. Round 1 resolved these by analogy without producing a disagreement; if round 2 produces one, it becomes a v0.3 item |
| Transfer-caution threshold | BR §2.18 | Not on the fix list, and §7.5 already states there is no published instrumental transfer method — a threshold would be exactly the unsupported precision the standard forbids |

**Re-review consequence of the v0.2 bump (§16).** A standard-version bump reopens only the fields whose rules changed. For v0.2 that is: FORM, WT, PERS, HEAT, HUM, R2, DOSE, ROLE, `care_direction`, `focus`, `damage_fit`, `texture_fit`, `scalp_application_fit`, and every field whose value was derived through the tail-marker convention. Approvals for fields outside that list remain valid where their per-field fingerprint is unchanged.

### 21.2 v0.2 → v0.3

**Authority for this version.** v0.3 is the round-2 defect-repair pass. Its binding fix list is `plans/leave-in-inci/research/gold-set/agreement/round-2-report.md` — the six clusters and the overshoot list. Every entry below traces to that report **and** to a named residual-ambiguity item in one of the two lanes' registers: **ref Ax** = the reference-key lane (`reference-key-v2/summary.md`), **blind Ax** = the sealed blind lane (`blind-v2/blind-review-notes.md`). The two registers number independently, so each citation names its lane. **No new Nick ruling was issued for v0.3** — R11–R14 remain the standing adjudications, and change 8 below extends R12's scope rather than creating a new one. **v0.3 introduces no science absent from the science review**, contains **no product-specific rule**, and adopts no change chosen to make two lanes agree about a particular product.

| # | Change | Motivated by | Section |
|---|---|---|---|
| 1 | Weight conflict tag closed: only a **C1/C2 intended-finish or positioning statement** may trigger the `high` → `moderate` projection downgrade. Four named conditions, a fixed effect, a determinism clause, and an invalidity rule for a tag applied without a recorded statement | Cluster 1, blind A20 | §10.1.2, §10.1 |
| 2 | SFR `high` requires **two distinct observations**, not one architecture read twice — the anchor/G3-note contradiction resolved **in G3's favour** | Cluster 2, ref A4 | §7.4 |
| 3 | "Beyond baseline conditioning" defined against §6 as *any endpoint-relevant observation not in the set that established COND*, stated in both directions so `smoothing` is **reachable** for a dedicated silicone film system and **not automatic** for a silicone product | Cluster 2, ref A5 | §10.2.1, §10.2 |
| 4 | Focus selection procedure rewritten so the **rank order binds before observation counting**; only exact-product evidence may override it; observation counting demoted to ranking secondaries | Cluster 2, ref A6 | §10.2 |
| 5 | G0 boundary precedence stated: a styling-first test firing cleanly on C1/C2 evidence ⇒ `excluded_styling_first`; `provisional_boundary` reserved for genuine evidence conflicts; **§2.3.2 governs over the §2.3 trap-3 sentence**; G13 binds the positioning half of the G0 decision | Cluster 3, ref A14, blind A15 | §2.3.2, §2.3, G13 |
| 6 | §3.1.1: **rank is the single deterministic prong** of "present as architecture"; the coherence read survives as a recorded counter-signal that can never override rank; the error direction is stated rather than hidden | Cluster 4, ref A3, blind A3/A8 | §3.1.1 |
| 7 | §7.10 gains its missing rule: a **qualifying** substantive route below the marker does not silently become `none_visible` — the dimension holds its rank-supported value, the record carries a `candidate_below_tail` note, and it routes to review | Cluster 4, ref A3 | §7.10, §14 |
| 8 | **Claim capture added to the formula freeze**: `claims[]` with claim text, source tier, URL and date for every product; the C1/C2 search recorded either way; classification lanes consume frozen claims and never re-research them | Cluster 5, ref A19; extends R12 | §2.4, G1, G13 |
| 9 | **HUM reversed to a claim-led ladder**, like HEAT: no C1/C2 claim ⇒ `not_claimed`, and formula plausibility goes to the trace only. v0.2's opposite decision (§21.1 change 14) is marked reversed with the round-2 reasoning | Cluster 4, round-2 report | §7.9, §21.1, §10.1, §18 |
| 10 | §5 L5 enumerates **Polysilicone-29** (silicone film-former family — *not* fixative-hold by default; HOLD `none` on its own) and **VP/Methacrylamide/Vinyl Imidazole Copolymer** (fixative-class), each with its HOLD consequence | Cluster 6, blind A13 | §5 |
| 11 | Microemulsion threshold tightened: test (i) is position-free, test (ii) requires above-tail architecture, and the ambiguous middle is narrowed to exactly one shape | Cluster 6, blind A16 | §7.1 |
| 12 | `scalp_application_fit = avoid` narrowed to occlusive/oil-led architecture, a **scalp-relevant irritant load** (an exposure flag **plus** a material alcohol note), or explicit avoid-the-scalp directions. **Fragrance or allergen flags alone no longer fire it** — the ordered test continues, normally to `unknown` | Overshoot list, ref A9 | §10.3.1 |
| 13 | **House-brand clause**: a retailer's page for its own private label is C2 for that product (dm ↔ alverde/Balea, Rossmann ↔ Isana), recorded as `claim_tier_basis: house_brand` and routed to review | Overshoot list, ref A1, blind A1 | §2.4.1, §14 |
| 14 | The §2.4.1 C2-row "German/EU" vs operating-rule-3 contradiction resolved **in rule 3's favour**; the C2 row now reads "German-market manufacturer page" | Overshoot list, ref A2, blind A2 | §2.4.1 |
| 15 | **§4 confidence vocabulary defined** — `low` / `moderate` / `moderately_high` / `high`, matching the conditioner engine — with the §7 ceiling language mapped onto it ("low–moderate" ⇒ a ceiling of `moderate`) | Overshoot list, blind A25 | §4 |
| 16 | **R3 gains `none`**; `unknown` narrowed to the genuinely unresearched or unresolvable | Overshoot list, ref A16, blind A10 | §8.3 |
| 17 | Three §18 strings added — a **claimed** HUM `formula_plausible`, `R3 = chemistry_candidate`, and `scalp_application_fit = avoid` | Overshoot list, ref A15 | §18 |
| 18 | DOSE composed with "DOSE follows WT": **FORM never sets the DOSE value.** `two_phase` attaches a dose-**variability** note (with the shake caution and the review trigger) rather than a higher DOSE value; the `microemulsion` clause goes the same way | Overshoot list, ref A11, blind A7 | §7.11 |
| 19 | §7.5 G9-resolution clause 1 corrected: **the `high` anchor row governs**; a two-phase bulk oil above the tail is a recorded supporting observation, not a second route to `high` | Overshoot list, ref A12 | §7.5 |
| 20 | §7.1 solution row reworded to exclude the **LGN pair** rather than any long-chain fatty alcohol, so the row and its own note agree | Overshoot list, ref A13 | §7.1 |
| 21 | `curl_definition` gains a **negative gate**: unavailable without curl/wave positioning or texture-targeted directions at C1/C2. Negative only — presence never creates or upgrades the route | Overshoot list, ref A7, blind A19 | §10.2 |
| 22 | `heat_styling`: a C1/C2 heat claim plus a **`pre_heat` application stage** in the directions suffices; an explicit tool name is not required | Overshoot list, ref A8 | §7.13, §10.2 |
| 23 | Packet-side fix instructions recorded at G1: packets must stamp **C-tiers**, and INCI normalization must not split inside an ingredient name („1,2-Hexanediol") | Overshoot list, ref A19, blind A27 | §2.4 |
| 24 | §19 rewritten to the round-2 result plus the targeted round-3 requirement; open gaps 18–24 added; §20 gains the round-2 provenance; version stamps, model version and envelope bumped to v0.3 | Round-2 report | §17, §19, §20, header, §10 |

**Deliberately not changed in v0.3** — raised by a lane in round 2 but **outside the round-2 report's fix list**, so changing them would be an untraced rule change:

| Item | Register | Why it stands |
|---|---|---|
| The tail marker's **variance** across list lengths, including the very-late-marker case | ref A17, blind A4 | Not on the fix list. v0.3 makes rank deterministic without claiming to make it accurate; the variance is open gap §17.18, and change 7's below-marker review route is what carries the risk to a human |
| COND `low` / SLIP `moderate` on a lone monomeric quat, and §7.2's "short-chain" vs §7.6's "long-chain" vocabulary for one material class | ref A18, blind A24 | Carried open from v0.2 for the same reason: it needs the decision whether a monomeric quat is "a route", which is an ontology fork for Nick, not a repair. Round 2 confirms it still bites, on two slots |
| SLIP bias qualifier unusable — `unknown` on 8 of 12 profiled records | ref A18, blind A23 | Predicted by §17.16 and now confirmed at scale. Its resolution needs the open evidence question in §17.5 |
| WT has no enumerated family for a monomeric-quat-only architecture | blind A5 | The same fork as the COND/SLIP item above; both lanes' readings are recorded and neither is adopted |
| §9 has no value for a film-led architecture, and its silicone-led `unknown` rule under-fires | ref A10 | Ontology question with a product consequence — a Nick fork, recorded as open gap §17.22 |
| Polyacrylamide's L5 placement | blind A13 | Round 2 produced no disagreement on it; open gap §17.19 |
| Alcohols outside the `Alcohol Denat.` / `Alcohol` enumeration | blind A12 | Open gap §17.21 |
| `curl_definition_focus` value vocabulary | blind A9 | Open gap §17.20 |
| Retailer-reproduced pack directions and their tier | ref A19, blind A21 | Open gap §17.23. Adjacent to the house-brand clause (change 13) but a different question, and answering it was not on the fix list |
| Which §7 dimensions an excluded record may carry | blind A22 | Open gap §17.24 |
| A review trigger on the `hair_thickness_fit` / `damage_fit` `unknown` rows, matching the existing `texture_fit` one | blind A26 | Not on the fix list, and no round-2 product reached those rows |
| The `refresh` role reading for directions that merely *permit* dry-hair application | blind A11 | Not on the fix list. Both lanes applied the same reading uniformly and it produced no disagreement |

**Re-review consequence of the v0.3 bump (§16).** A standard-version bump reopens only the fields whose rules changed. For v0.3 that is: `g0_state` on any styling-boundary record, SFR, HUM, R2, R3, DOSE, HOLD on records carrying a v0.3-enumerated L5 material, FORM where the solution ↔ microemulsion threshold or the fatty-alcohol clause decided it, WT where the §7.5 G9 clause or the §10.1.2 conflict tag applies, ROLE `heat_styling`, `focus.primary` and `focus.secondary`, `scalp_application_fit`, every field whose value was derived through the two-prong "present as architecture" reading, and every claim-keyed field whose source tier moves under the house-brand or rule-3 clarifications. Approvals for fields outside that list remain valid where their per-field fingerprint is unchanged.

### 21.3 v0.3 → v0.4

**Authority for this version.** v0.4 is a **model trim**, not a defect-repair pass. Its binding authority is **Nick's trim rulings T1–T10 of 2026-09-05, T11–T15 of 2026-09-10, T16 of 2026-09-11, T17 of 2026-09-11, T18 of 2026-09-12, and T19 of 2026-09-12** — T1–T8 issued first, T9 the same day, T10 the same day again, T11 five days later, T12 the same day as T11, T13 the same day again, T14 the same day again, the last adjudicated while reviewing the Olaplex gold-set record, T16 issued a day after that, adjudicated while reviewing the Redken gold-set record, T17 issued the same day as T16, adopting the seven "adopt now" items of the hard-rule audit Nick commissioned against T16 (`plans/leave-in-inci/research/hard-rule-audit.md`), and T18 issued the day after that, adjudicated while reviewing the unseen-test round's u1 record — each folded into this same still-unfrozen draft — recorded verbatim in substance below. It is **not** motivated by the round-3 disagreement list: round 3 reached 97.5 % agreement with 10 disagreements on four items (§19.2.1). **T13, T14, T16, T17, T18 and T19 are the exceptions**: unlike T1, T2 and T4–T12, T13 directly resolves the largest of those four items (item 1, the §10.2.1 permissive-vs-conservative reading) and a self-contradiction in the repair row's second prong found while adjudicating it, T14 amends §2.4.1's claim-authority operating rule 3 with a narrow, identity-gated cross-market exception, adjudicated against the Olaplex gold-set record's previously-unresolvable douglas.de/olaplex.com heat claim, T16 makes §3.1.1's tail-marker rank prong conditional on the marker's own plausibility, adjudicated against the Redken gold-set record's rank-3 marker (a listing artifact that would otherwise sit in front of the product's own main conditioning silicone), and T17 is a structured audit of every other hard rule in the standard for the same T16 shape — a rule whose failure mode on an implausible input is a confident wrong value rather than review or the conservative default — adopting the seven items the audit found cheap, evidence-backed and already demonstrated on this gold set, and adding the general invariant (§1.1) that shape must satisfy, and T18 settles which of several disagreeing **same-market** formula captures is the formula of record (new §2.4.2), adjudicated against the unseen-test u1 record, where the capture the packet had frozen as primary proved to be the outlier, and T19 issued the same day as T18, resolving round-3 item 3 — §9's silicone-led `unknown` rule under-firing on a film-led architecture, open gap §17.22, the one round-3 item the standard itself had reserved for "a Nick fork rather than a repair pass" — by giving `balanced` a second, explicitly co-equal reading (directional neutrality, §9), adjudicated while cleaning up the EVO gold-set record's `care_direction: unknown` so that record can commit to the catalog at all under adapter decision AD-2 — recorded here rather than in a defect-repair version because all six are, like T1–T12, product-model rulings rather than calibration-driven repairs. Of the four round-3 items, only item 2 — the slot-3 packet directions capture, a packet fix and not a rule fix — remains open (§19.2.1). The trim is a product-model decision about how much separately-reviewable surface the ontology should carry, taken on the evidence the three rounds produced about which dimensions the standard can actually defend.

**What v0.4 does not do.** It introduces **no science absent from the science review**, contains **no product-specific rule**, changes **no anchor's evidence bar**, and **re-derives no round-3 value**. Every rule below either removes a field, re-homes an observation the model already carried, or changes which items a human reviews. The reference key's v4 run is a **mechanical transform** of the round-3 key (`derived_from_run: reference-key-2026-09-04-r3`) with no re-classification.

| # | Ruling | Change | Section |
|---|---|---|---|
| 1 | **T1** | **SLIP dropped as a property.** `slip_combability_potential` and its bias qualifier are removed; the observation is absorbed into COND's evidence object as the **absorbed slip observation**, which may not move the COND value (G3). The two consumers that read a SLIP value — the `detangling` focus row and the `texture_fit` row-3/4/5 modifier — now name that observation at the **same thresholds**, written out as the v0.3 anchors they encode, so no product's value changes. Open gaps §17.5 and §17.16 are re-scoped, not closed | §7.2, §7.3, §10.2, §10.3, §6 |
| 2 | **T2** | **SFR descored into `smoothing_route`.** `ambient_smoothing_alignment_potential` stops being a scored, separately reviewable dimension and becomes a **typed trace input** — `silicone_film` / `cationic_alignment` / `emollient` / `fixative_film` / `none` — derived from the existing SFR and §6 mechanism evidence. The v0.3 two-observation anchor is retained verbatim as §7.4.1 and becomes the `smoothing` focus row's test, so the focus results do not move on the descoring. `smoothing_route` appears only inside the focus row's evidence and never in a projected field (G14) | §7.4, §7.4.1, §10.2, §10.2.1 |
| 3 | **T3** | **DOSE dropped entirely** — no dimension, no stored derivation, no `derived_from`, and its §18 caution string is deleted. DOSE was a restatement of the WT/M1 observation whose only output was one dosing sentence, and the app's existing application-guidance layer carries general dosing advice. The two-phase dose-**variability** note, the §18 shake caution and the §14 two-phase review trigger survive, attached to FORM, unchanged. Open gap §17.1 stays open and is re-stated as a limitation on WT, PERS and buildup *(T11 below moves this attachment point from a standalone FORM record into WT's own G9 clause 3, §7.5 — the trigger condition itself is unchanged)* | §7.11, §7.5, §10.1.1, §10.3, §18 |
| 4 | **T4** | **`scalp_application_fit` dropped from the model**, with both its §18 strings and both its §14 triggers. The repo separates cosmetic from medically adjacent scalp guidance; the field resolved to `unknown` or `avoid` on almost every record and its positive value was reached by nothing; and an exposure flag is not a tolerance prediction (§7.12, SR §M.12). EXPO, its alcohol note and string, ROLE `ends_only`, G6 and the standing scalp review trigger are all unchanged *(T12 below removes ROLE entirely, including `ends_only`; the placement note it carried moves to the application-guidance layer, §7.13, §17 item 27 — this row's "unchanged" was true as of T4 and is superseded by T12, not retroactively wrong)* | §10.3.1, §2.4, §14, §16, §18, G1 |
| 5 | **T5** | **The six demoted flags collapse into one conditional `hinweise` record** listing only the flags that fired, each with its one-line note; empty when nothing fired. The per-flag rules (§8.1–§8.5) are unchanged and still decide *whether* a flag fires. **R3's full enum and its review routing survive inside the record** — `r3_state` is always carried, including `none`, and only a non-`none` state appears in `fired`. One reviewable unit instead of six mostly-empty ones | §8, §8.6 |
| 6 | **T6** | **`repair_support_level: low \| medium \| high` added**, aligned with the conditioner engine's `repair_level` consumer. Fixed rule: `high` requires exact-product repair evidence at E3+; `medium` requires a qualifying substantive film route (R2 ∈ {`candidate`, `tested`}) with `conditioning_level` ≥ `moderate`; `low` is everything else, **explicitly including bond-claim-only products**. The R2 route detail stays in the trace. Applied mechanically to the eleven in-category round-3 records, it returns `low` on all eleven, which §17.25 records as an unexercised `medium` row rather than a calibrated one | §10.3.2, §10.1, §14 |
| 7 | **T7** | **HOLD keeps its 3-state and gains a captured manufacturer hold level.** A manufacturer-stated hold level („Hold 3/5", „hold 4/10") is **claim data**: captured verbatim with its scale, tier, source and date from the frozen `claims[]` when it exists at C1/C2, recorded beside `hold_route_state`, and **never derived from formula, never projected, and never able to move the 3-state**. A hold level found only at C3–C5 is a tier-stamped trace observation that does not populate the field (§2.4.1 rule 1). A captured level routes to review (§14) | §7.7, §14 |
| 8 | **T8** | **Lean-profile echo fields stop being separately reviewable.** `product_form`, `conditioning_level`, `weight_potential`, `persistence`, `hold_support` and `usage_role` are deterministic identity projections of one dimension; they are shown as an annotation on that dimension's row („→ Profilwert: rich") and approving the dimension approves the projection. `cautions[]` and `uncertain_fields[]` are echoes of named field values and are displayed rather than reviewed line by line. The fits (thickness ×3, damage ×3, texture ×4), `focus.primary`, `focus.secondary`, the heat binary, `care_direction`, `repair_support_level` and the `hinweise` record stay reviewable. **No value, anchor, projection or emission changes — only the review surface.** *(T8's original list also named `specialist_functions.humidity_resistance` ← HUM as a seventh echo field, and "the humidity state" as separately reviewable; both are gone under T9 below, not merely re-annotated — there is no HUM row left to echo or to review. T8's original list also named `product_form` ← FORM as its first echo field; T10 below removes it from this list — not re-annotated either, but for the opposite reason from HUM: `product_form` still exists, it is simply no longer FORM's projection, so it moves to the separately-reviewable list instead of disappearing. T8's original list also named `usage_role` ← ROLE as its sixth entry; T12 below removes it on HUM's reasoning, not `product_form`'s — there is no `usage_role` value left to echo or to review, and its identity-capture successor `application_stage` never joins this list at all, because it was never a lean-profile field to begin with.)* | §10.1.3, §10.1 |
| 9 | **T9** | **HUM dropped entirely — no dimension, no lean-profile field, no state ladder, no quoted-claim adoption.** `humidity_resistance_evidence_state` and `specialist_functions.humidity_resistance` are removed from the model, together with their three §18 strings, their row in the §4 mandatory-counter-signal table, and their entries in G13's field list. Unlike SLIP and SFR, HUM is **not re-homed as an observation** — nothing new is added to COND, `smoothing_route`, or any other field. *Rationale:* an unverifiable manufacturer claim is not a comparison axis this standard can defend (HUM's ladder above `not_claimed` was reachable only via a C1/C2 claim, and never once resolved to a measured `product_tested` state across three rounds); the anti-frizz *user need* it partly served is already reachable, without a humidity claim, through the `smoothing` focus (§10.2); the humectant-is-not-anti-frizz guardrail survives generally as **FS-6/FS-15** (§12) rather than as a HUM-specific mandatory counter-signal; and **HEAT becomes the only claim-led field this standard has** (§2.4.1, G13). A `humidity_frizz`-typed entry already frozen in a gold-set product's `claims[]` is **untouched upstream data** — the model simply stops consuming it | §7.9, §2.4, §2.4.1, §4, §5 L4, §6, §10, §10.1, §10.1.3, §11 G13, §14, §18 |
| 10 | **T10** | **`product_form` becomes the presentation form, not the FORM architecture class.** The lean profile's `product_form` is redefined from a projection of FORM's architecture value (`aqueous_or_hydroalcoholic_solution` / `emulsion` / `microemulsion` / `two_phase`) to the **presentation form** the user holds — `spray \| milk \| lotion \| cream \| serum \| unknown` — captured directly at identity (E1: pack, exact product name, directions). FORM's own architecture value becomes trace-only and is never projected. A `two_phase` architecture typically presents as `spray` (every gold-set example does), but that is an observed correlation, not a derivation rule. `product_form` is removed from the T8 echo-field list — it is no longer a projection of any single §7 dimension — and moves to the separately-reviewable list alongside `care_direction`. `hair_thickness_fit`'s stale `derived_from` reference to `product_form` is dropped (it never carried decision weight and now carries even less). The two-phase shake caution and its §14 review trigger are untouched and stay attached to `FORM = two_phase`; the instruction itself is recorded as a handover item for the app's application-guidance/protocol layer, not built here (§17 item 27) | §7.1, §10, §10.1, §10.1.3, §10.3, §17 |
| 11 | **T11** | **FORM stops being a scored, separately reviewable dimension.** `product_form_architecture` is removed from §7 entirely — no row, no ceiling, no confidence, no property-evidence object of its own. The **presentation form** T10 already made independent (`product_form`) is untouched by this ruling. The **architecture taxonomy** — the four in-category architectures plus the anhydrous exclusion, the decision order, and the solution↔microemulsion threshold, including the microemulsion/two-phase reading rules — survives **verbatim** as a trace reading convention, stated alongside §3.1.1's tail marker as new §3.1.2, and consumed inline wherever a rule already needed it: G0's `excluded_anhydrous` rationale (unchanged — G0 already carried its own architecture evidence and never depended on a separate FORM row), the WT `moderately high` ceiling and both G9 clauses (§7.5), and COND's routes (§7.2). Scored dimensions drop from 9 to 8. No anchor's evidence bar moves and no product's projected value changes — this is the same kind of demotion T2 made for `smoothing_route` and T8 made for the echo fields, applied to the one dimension T10 had already made trace-only | §3.1.2, §7.1, §6, §7.5, §10.1, §11 G9 |
| 12 | **T12** | **ROLE dropped as a scored dimension and a profile property; application timing survives as identity data.** `usage_role[]` — `post_wash · refresh · heat_styling · curl_styling · ends_only`, scored and projected into the lean profile — is removed entirely: no dimension, no lean-profile field, no echo entry (T8, §10.1.3). `post_wash` was true for nearly every in-category product and carried no information; `heat_styling` is derivable from evidence the heat binary and the `heat_styling` focus already require (a `pre_heat` direction); `ends_only` is application guidance, not a matching field, and joins the two-phase shake instruction in the app's undesigned application-guidance layer (§17 item 27). The one informative bit — dry-hair usability, formerly `refresh` — survives as **`application_stage[]`**, a new identity-level field captured judgment-free at G1 (§2.4) next to directions, using the production vocabulary `towel_dry \| dry_hair \| pre_heat \| post_style` (matches the existing DB column on leave-in specs). **Sourced from G1's general directions hierarchy, not ROLE's C1/C2 claim-tier gate** — the one deliberate divergence from the T9-T11 removal pattern: `application_stage` reads whatever directions text G1 already captures and verifies, because it is identity data like a GTIN, not a scored or claim-keyed field. Ambiguous directions route to review as a documented identity conflict (§2.4); a clean transcription is not a reviewable judgment, so there is nothing to review per product beyond that. The `heat_styling` focus stays and is re-keyed from HEAT/ROLE onto `provides_heat_protection` (unaffected, never role-derived) and `application_stage` including `pre_heat` (§10.2). Scored dimensions drop from 8 to 7 | §7.13, §2.4, §7, §10, §10.1, §10.1.3, §10.2, §10.3.1, §11 G1/G13, §14, §16, §17 |
| 13 | **T13** | **Repair-row marketing prong deleted; §10.2.1's over-satisfaction question resolved permissively.** (a) The `repair` focus row's second qualifying condition — protein/silane actives named in the product's C1/C2 marketing position — is deleted; it contradicted principle 4 ("positioning never creates a route") on its own terms, adjudicated against the GLISS gold-set record. `repair` now requires R2 ∈ {`candidate`, `tested`} only, as both primary and secondary focus. (b) §10.2.1's open question — whether a route need be beyond baseline conditioning under *every* admissible COND-establishing set (conservative) or just *one* (permissive) when COND's anchor is over-satisfied — is settled: **a single admissible set suffices.** This closes round-3 report item 1. Four gold-set records (slots 2, 6, 8, 10) re-derive `focus.primary`/`focus.secondary` under the combined ruling; the rest are re-checked and unchanged. Neither change moves an anchor's evidence bar or introduces new evidence — both are product-model policy calls, on the same footing as T1–T12 | §10.2, §10.2.1 |
| 14 | **T14** | **Claim authority (§2.4.1 rule 3) gains a narrow cross-market exception, adjudicated against the Olaplex gold-set record.** A manufacturer's **non-German-market** page can now create a claim for the German market when **both** (a) product identity is verified — an identical formula/INCI set against the frozen German-market capture, or a shared GTIN confirmed at a German retailer — **and** (b) at least one German-market retailer (C3/C4) corroborates it. Such claims are recorded at tier `C2_cross_market_verified` with the identity evidence attached (§2.4.1 rule 7). **Without identity verification, rule 3 stands**: the guarding counter-example is Cantu, whose documented US/German formula split (gold-set slot 3 `known_conflicts`) fails clause (a), so its dm.de-only heat claim stays C3, non-creating. **Applied to the Olaplex N°.6 Bond Smoother gold-set record**: its „450ºF/232ºC" claim is byte-identical on olaplex.com and the EU-facing es.olaplex.com page, the manufacturer's published 46-ingredient INCI matches the frozen douglas.de capture set-for-set, EAN 850018802796 is confirmed at the German retailer xhair.eu, and douglas.de (C3) already corroborates the claim text — both prongs clear. `heat_protection_evidence_state` moves `not_claimed` → `claim_only` (no L9 member; the formula's silicones are generic, so `formula_plausible` is not reached), and `provides_heat_protection` moves `false` → `true`. The record's `claim_authority_gap` routing is resolved (dated 2026-09-10); it now routes under the standing `heat_claim_without_l9_member` trigger (§13.3 rule 2) instead | §2.4.1, §13.2, §13.3, §11 G13, reference-key-v4 slot 10 |
| 15 | **T15** | **The designed styling-boundary case is adjudicated, and the boundary gains its worked-example pair (§2.3.2, §7.7).** Nick ruled the Neqi Diamond Glass Ultimate Styling Spray (gold-set slot 13) **in-category**: its result comes from a genuine substantive conditioning film (Silicone Quaternium-18, permanently cationic; Polysilicone-29 smoothing film) with **one supporting** fixative-class polymer (VP/Methacrylamide/Vinyl Imidazole Copolymer, r8) — so HOLD reads `incidental_film`, not `meaningful_hold_route`, and G0 moves `provisional_boundary` → `in_category` (dated 2026-09-10). The dividing line is codified: **a fixative system with thin conditioning behind it is styling (Maria Nila Curlicue, PVP r4); a conditioning film with a supporting fixative is a leave-in (Neqi).** The slot-13 boundary and `meaningful_hold_route` review triggers are resolved with dated notes; standing triggers (e.g. `heat_claim_without_l9_member`, `identity_trap`) remain. Closes the round-3 open item on slot 13's G0/HOLD split | §2.3.2, §7.7, reference-key-v4 slot 13 |
| 16 | **T16** | **§3.1.1's tail-marker rank prong becomes conditional on the marker's own plausibility, adjudicated against the Redken gold-set record.** The strict-rank prong (clause 1) may disqualify a route or ingredient **only when the marker is plausible** — checkably defined as: the first capped-preservative marker sits **after** the product's own core conditioning architecture (the ingredients that establish COND/WT). Where the marker sits **before** that architecture, it is **implausible**: it is unreliable and **may not be used to disqualify any route or ingredient**, and the record routes to review with a `tail_marker_implausible` note instead of the below-marker mechanisms (`candidate_below_tail` and its siblings). Determinism is preserved — plausibility is itself a rank test (compare the marker's rank to the ranks of the ingredients that establish COND/WT), not a judgment call. *Motivation, recorded verbatim in substance:* Redken Extreme Anti-Snap's tail marker, Phenoxyethanol, sits at rank 3 of 24 — **before** its own main conditioning silicone, Amodimethicone, at rank 4 — which would absurdly place that silicone in the sub-1 % tail; a listing artifact, not a real 1 % boundary. Both calibration lanes had independently flagged this record as the tail-marker stress case (§17.14, §17.18). **Applied to the Redken gold-set record (slot 9) only**: `repair_surface_film` moves `none_visible` → `candidate` (the silane, Hydrolyzed Vegetable Protein PG-Propyl Silanetriol at r14, is no longer below-marker-disqualified); `repair_support_level` moves `low` → `medium` under §10.3.2's own rule, unchanged in text — the gold set's first record to exercise that row; `damage_fit` opens R14's repair-film path (row 3b: `healthy` `recommended` → `conditional`, `highly_damaged` `conditional` → `recommended`, `moderately_damaged` unchanged); `focus.primary` moves `general` → `repair` (a dedicated repair route now exists under §10.2/T13a); `care_direction` moves `moisture` → `protein` (§9's protein anchor is now met). **Every other in-category record is independently re-checked against the same plausibility test and stays unchanged** — each one's core conditioning architecture sits above its own marker (Olaplex's LGN pair at r2/r7 above its marker at r14; Curlsmith's LGN pair at r3/r6 above its very-late marker at r36; and so on for the rest) — so no other record's marker is implausible and no other value moves. This also resolves the `repair_support_level_uncalibrated` adjudication (§14): the `medium` row is now demonstrably reachable, not merely an applied-but-untested rule | §3.1.1, §7.10, §10.3.2, §10.3, §10.2, §9, §14, reference-key-v4 slot 9 |
| 17 | **T17** | **Seven items adopted from the hard-rule audit (`plans/leave-in-inci/research/hard-rule-audit.md`), Nick's commissioned structural audit of every hard rule in the standard for the T16 shape — a rule whose failure mode on an implausible input is a confident wrong value rather than review or the conservative default — plus the general invariant that shape must satisfy.** (1) **§1.1 — the conservative-failure invariant**, new: every hard rule must fail toward review or the anchor's own conservative value, never toward a recommendation; the test a future rule change must pass. (2) **§3.1.1 clause 6 (H1)** — a tail marker so late that everything at or below it is only capped material, fragrance/allergen declarations or colourants is **vacuous**: it cannot establish "present as architecture" for any anchor: the coherence/ordinal read governs instead, the record carries `tail_marker: vacuous` and routes to review (`tail_marker_vacuous`). Symmetric with T16's clause 5 — neither an implausibly-early nor an implausibly-late marker may disqualify **or** qualify anything on rank alone. (3) **§3.1.1's marker-eligible list (H2)** — the declared 26 EU fragrance allergens are removed; a formula whose only near-terminal declaration was the allergen block now reads `tail_marker: none_visible` and mandatory limit 2 governs (ordinal read, confidence down one step, routed to review), restoring the escape the allergen-block entry had been pre-empting. (4) **§2.4 rule 2 (H3)** — the rinse test is scoped to the direction governing the product's own application step: a safety/hazard sentence never fires it, and a dual-use "leave-on or rinse" direction keeps the record in-category with a `dual_use_directions` route instead of `excluded_other_form`. (5) **§8.5 / §7.6 (H6)** — the buildup caution is now emitted when `weight_potential` projects `high` with a persistent non-volatile family present as architecture, in addition to `persistence` projecting `permanent_cationic`; PERS's own ordinal class is untouched. (6) **§14 (H8)** — new trigger `l9_member_without_claim`: an L9 closed-list member above the tail marker with no C1/C2 heat claim routes to review instead of silently emitting `provides_heat_protection: false` with no human in the path; the binary itself is unchanged (claim-led policy, ruling 6). (7) **§2.3.2 (H9)** — a cross-rule consistency clause: one species at one rank read as substantive architecture by one rule and as disqualified trace by another routes to review (`species_reading_conflict`) rather than silently carrying both readings. **Housekeeping** — §14 gains formal definitions for the five tail-marker trigger names the reference key already used with no definition in this standard (`tail_marker_dependence`, `very_early_tail_marker`, `early_tail_marker`, `very_late_tail_marker`, `tail_marker_allergen_block_only` — the last superseded by item 3 above) and for the new triggers items 2–4 add. **Applied to the reference-key-v4 gold set, mechanically, no new judgment**: slot 6 (Curlsmith) and slot 12 (Kevin Murphy, excluded/informational) carry vacuous markers (item 2) — both re-checked and confirmed no anchor's value was in fact established solely by the vacuous marker's rank boundary, so no dimension value moves, only the marker note, confidence and review routing; slot 4 (alverde Nutri-Care) loses its allergen-block marker (item 3) and reads `tail_marker: none_visible`, with COND/WT/PERS/HOLD/R2 confidence lowered one step per mandatory limit 2 and no value change (every decisive ingredient on that record sits well above where any marker could plausibly fall); slots 3 (Cantu) and 10 (Olaplex) gain the buildup caution (item 5) — both project `weight_potential: high` with `persistence: neutral_non_volatile`, the exact inversion H6 exists to close; slot 13 (Neqi) gains the `species_reading_conflict` trigger (item 7) — Silicone Quaternium-18 at r11 is T15's named substantive conditioning film for HOLD/G0 and simultaneously §7.10's `candidate_below_tail` disqualified trace for R2, on the same record, at the same rank; item 6 (`l9_member_without_claim`) and the dual-use clause of item 4 are defined but unexercised on this gold set — no record's L9/claim shape or rinse-direction shape matches either trigger's condition, the same "implemented, not yet calibrated" honesty T7's `manufacturer_hold_level` and T14's cross-market exception are already recorded under. **No value moves toward a recommendation on any record** — every change is a new caution, a new review trigger, a confidence step-down, or a marker-reading correction that leaves the underlying dimension value where it already was (`reference-key-v4/transform-notes.md` §21, `agreement/t17-delta-report.md`) | §1.1, §2.3.2, §2.4, §3.1.1, §7.6, §8.5, §14, reference-key-v4 slots 3, 4, 6, 10, 12, 13 |
| 18 | **T18** | **Same-market formula-set conflicts get a two-tier precedence rule: convergence resolution first, conservative fallback otherwise (new §2.4.2), adjudicated against the unseen-test u1 record.** Through T17, §2.4 required conflicts to be "preserved rather than resolved by preference" but never said which of several disagreeing captures of the same German-market unit is the formula of record — so the unseen-test lanes split on u1, one taking `unknown` on every affected dimension, the other classifying from whichever capture the packet froze as primary. **Tier 1 (primary): convergence.** Where **≥3 independent sources — at least one a GTIN-anchored German retailer capture — return the identical list in identical order**, and the manufacturer's own printed formula markers match where visible (F.I.L. codes / formula prefixes; a trailing revision-digit difference does not break the match), **that convergent list is the formula of record**: the packet primary is re-anchored to it under a **dated amendment-log entry**, outliers are **demoted to additional captures with notes and never deleted**, `identity_status` becomes `verified_with_minor_source_difference`, confidence on affected dimensions drops **one step below a single-source clean capture**, the record carries the standing `formula_or_identity_conflict` trigger — and **classification proceeds from the convergent list normally, with no blanket unknowns**. **Tier 2 (fallback):** any set conflict that cannot reach that bar takes `unknown` on the affected dimensions, carries the now-defined `formula_source_conflict` trigger (§14), routes to review, and under adapter decision **AD-2** cannot commit to the catalog until resolved. **Explicitly rejected:** classifying from the frozen primary (the "G5 smallest-scope" reading lane B applied) — it bakes in an arbitrary source preference, and u1 proved the frozen primary can itself be the outlier. **Scope boundary:** T18 is a **same-market** rule; a **cross-market** formula difference is not a T18 conflict but an identity question under §2.4.1 rule 7 (**T14**), whose named counter-example is Cantu's DE/US split. **Consequences on records: none.** The u1 record as re-derived 2026-09-12 already conforms to tier 1 — it *is* the worked example — and no other unseen or gold-set record carries a same-market formula-set conflict, so no record value moves anywhere. Conforms to §1.1: tier 2 fails to the conservative value and to review, tier 1 is evidence resolution (converging sources, outliers preserved, confidence lowered, human still in the path), never a recommendation-ward failure. Traceability: `plans/leave-in-inci/research/unseen-test/u1-formula-recency.md` (the recency investigation), the `amendment_log` in `plans/leave-in-inci/research/unseen-test/unseen-packet.json` (the dated re-anchoring), `plans/leave-in-inci/research/unseen-test/rederived/` (the re-derivation), and `plans/leave-in-inci/research/unseen-test/unseen-test-report.md` (the lane A/B divergence that raised the question) | §2.4.2, §14, §1.1 |
| 19 | **T19** | **`balanced` gains a second, explicitly co-equal reading — directional neutrality — and `unknown` is reserved for evidence failure (§9); open gap §17.22 closes.** Through T18, §9's v0.2 silicone-led rule sent a **film-led** architecture to `unknown`: `protein` is defined over L6/R2, `moisture` over L1/L3/L4, L2 appears in neither, and the rule concluded abstention from that. **The premise is kept, the conclusion is replaced.** A film route still never *creates* either direction — but a formula that is fully readable and reads as **neither** moisture-directed **nor** protein-directed is not a gap, it is **directional neutrality**, and its name is `balanced`: the value §9's own title already carries and the only other member of the production enum `moisture \| balanced \| protein` (`product_leave_in_specs_care_direction_check`, root-repo migration `20260811211000_personal_plan_mask_leave_in_authority_v3.sql`), so **no enum member is added on either side** (AD-1's single-enum principle). The film-led path is a four-clause rank test: (1) no R2 route present as architecture; (2) a substantive film — L2 silicone system, silicone quat or §5 equivalent, read through §3.1.2/§5 — with at least one film species above the tail marker; (3) **no** L1/L3/L4 species above the marker, a leg present only below it being **subordinate** and creating no direction; (4) every film species ranks above every candidate leg species, so the read does not rest on the marker's exact rank alone. E2, ceiling `moderate`; one step down to `low` **and route to review** where the record's marker is `plausible: false` (T16), `vacuous` (T17/H1) or `none_visible`, or where clause 4's ordering fails. The row records itself as `row: film_led_neutral` and carries §4's mandatory marker counter-signal naming the marker, the film species and every subordinate leg with its rank. **The gate is made checkable, not lowered:** a film-led product with a genuine leg above its own marker stays `moisture` by design — including slot 13 (Neqi), the „Feuchtigkeits*schutz*" primer §17.22 itself names. `unknown` survives **only** for genuine evidence failure (unreadable or partial capture, identity conflict, §2.4.2 tier-2 set conflict) and is **never** the film-led answer — which is the point of the ruling, since under **AD-2** an `unknown` blocks the record from committing to the catalog at all. Conforms to §1.1: `care_direction` drives no weight, persistence, hold or heat matching (constraint 1), `balanced` asserts neither emphasis, and both failure paths still fail to review or to the conservative value. **Exactly one record changes — reference-key-v4 slot 5 (EVO Head Mistress Cuticle Sealer), `care_direction` `unknown` → `balanced`; every other record is re-checked against the four clauses and unchanged** | §9, §17.22, §19.2.1, reference-key-v4 slot 5 |
| 20 | **Freeze-prep housekeeping (2026-09-13)** | **A convention/wording batch, explicitly NOT a product-model ruling — modelled on T17's own §14-housekeeping sub-item rather than on T13–T19's adjudications. Authority: Nick's freeze directive of 2026-09-12 („let's go … then we can freeze this") plus the six convention findings of the unseen-product test (`plans/leave-in-inci/research/unseen-test/unseen-test-report.md`, "Secondary findings" 1–6), each item traced to its finding. Every item closes a place where two disciplined sealed lanes diverged in *trace* while agreeing on every value — none of the six is a product-model choice, and none changes an anchor, an enum, an evidence bar or a projection.** (1) **§3.1.1 clause 6 (finding 1)** — the vacuity test's two non-equivalent readings resolve to the **substantive** one, restated as an exhaustive closed set (capped preservatives and boosters · fragrance/allergen declarations · colourants · pH adjusters, buffers and chelators at tail position) so it is decided by reading the list, not by judging "real architecture"; the contradictory closing sentence is deleted. Verified against the frozen packet ranks: **u4's** Potassium Sorbate r31 tail (r31–r36) and **u5's** Sodium Benzoate r11 tail (r11–r18) are both vacuous under it — the reading lane B applied and the T17 pass already applied to gold slots 6 and 12 — and lane A's `very_late_tail_marker` for the same observation was the non-canonical alias (§14 re-keys that trigger's own test onto the same enumeration; the two triggers are mutually exclusive). (2) **The E-level assignment ladder (finding 2)** — stated once in §3.1: an identity-block fact (pack, name, directions transcription, `application_stage`) is **E1**; a value read from the frozen formula alone is **E2**, including a negative value and including one resting on a single unmissable rank; **E3+** requires exact-product external evidence meeting §3.2 and G8. One line added to the two dimension sections the lanes actually split on (`hold_route_state` §7.7, `repair_surface_film` §7.10). **No record's E-levels are edited in this pass** — round 4 produces canonical levels and the freeze comparison uses this ladder. (3) **Trigger vocabulary, §14 canonical list enforced (finding 3)** — `formula_or_identity_conflict` is declared canonical and `formula_source_or_identity_conflict` a retired alias (and neither is a synonym for T18's narrow `formula_source_conflict`); an **excluded record emits no `g0_boundary_decision`** trigger, the exclusion state and §2.3.1's contract being the routing (lane B's emission was surplus; the name is not a §14 trigger at all); and **`tail_marker.marker_status` is REQUIRED on every in-category record** with the four values `plausible \| implausible \| vacuous \| none_visible` (lane A emitted it, lane B did not). (4) **§18 string gaps (finding 4)** — `aromatic_or_allergen_exposure` gains its own German string in the established exposure register („Enthält deklarierte Duftstoff-Allergene oder aromatische Pflanzenstoffe.", stating exposure and predicting no tolerance); the buildup row's firing condition is re-keyed from the pre-T17 PERS limb onto §8.5's T17/H6-widened either-limb rule (§8.5 was always the rule of record; the string itself is unchanged); and the **transfer** caution gains the string it never had — retiring the flag was rejected because §8's preamble, §8.6's enum and §7.5's attachment all still carry it, so the missing piece was the string, not the flag. (5) **LAYER and SHN (finding 5)** — **LAYER** gains the deterministic firing condition it never had: it fires when, and only when, `persistence_removal_class` resolves to `permanent_cationic` (lane B's narrow convention; the looser "any cationic deposit" reading fires on most conditioning leave-ins, the §10.3.1 overshoot shape). It is **not** retired: §8.4's mechanism and §18's string both stand, and the flag fires on no **unseen** record today. **[Corrected by the row-20 addendum below, 2026-09-13: this item originally added "or gold-set" to that sentence and §8.4 carried the same aside. Both were false on the standard's own text — §7.6's enumeration reaches `permanent_cationic` on gold slots 2, 6 and 8, so LAYER fires there. The rule itself is unchanged; only the false claim about its exercise is.]** **SHN** gains the present/absent anchor both lanes improvised identically: `present` when `smoothing_route` (§7.4's closed type table) is a continuous-film type (`silicone_film`, `cationic_alignment`, `fixative_film`), `absent` at `emollient` or `none`; positioning („Glanz") never sets it (FS-23). (6) **Confidence bands under partial evidence (finding 6)** — partial, conflicted or incomplete evidence lowers the band **one step below what the anchor would otherwise earn**, and the limitation must name the missing piece; holding the anchor's band with a limitation note instead (lane B's style) is the non-canonical reading. One step, not a cascade; confidence only, never the value; `low` is the floor; the note is required as well, not instead. **Consequences on records: no value moves on any record, gold-set or unseen.** Two **emission/trace** consequences are recorded rather than applied, both at the next derivation and neither touching a value. **(i)** The new `aromatic_or_allergen_exposure` string (item 4) is emitted by **nine in-category gold-set records** — slots 1, 2, 3, 4, 5, 6, 8, 9, 10 — which hold that EXPO value and carry no fragrance-exposure string at all today, because the value had none; each gains exactly one `cautions_de` entry and nothing else moves. §1.1 holds: a caution moves toward telling the user more, never toward a recommendation, exactly as T17's H6 widening did. **(ii)** Under item 1's widened set, **slot 11 (Balea)**'s marker (Hydroxyacetophenone r7 of 11, tail = two preservative-boosters and two pH adjusters) becomes vacuous where T17's strict enumeration left it ordinary, so it gains `marker_status: vacuous` and the `tail_marker_vacuous` trigger **at its next derivation** — checked: every anchor on that record is `low`/`none`/`none_visible`/`neutral_non_volatile`, decided on the coherence read at r1–r6, and clause 6 bites only where an anchor would be *raised*, so no value and not even a confidence step moves. Every other gold-set and unseen record's marker reading is re-checked and unchanged; slots 6 and 12 were vacuous under both readings. The single record **edit** in this batch is a **trigger re-key on gold-set slot 3 (Cantu)**: its ad-hoc `formula_source_conflict` — now T18's tier-2 name, wrong for a cross-market case that §2.4.1 rule 7 governs — becomes the standing `formula_or_identity_conflict`, with a dated note. No dimension, profile, fit, focus, confidence or evidence level moves on slot 3 or anywhere else; the record's routing is unchanged in substance, only in name (`reference-key-v4/transform-notes.md` §24). **Addendum, 2026-09-13 (round 4): four further wording/emission/naming fixes closing the round-4 residue — see "Row-20 addendum" below; still no value change and still not a ruling** | §2.3.1, §3.1, §3.1.1, §4, §7.7, §7.10, §8.1, §8.4, §10.2.1, §14, §18, reference-key-v4 slot 3 |

**Deliberately not changed in v0.4** — the trim is a scope decision and deliberately not a repair pass, so everything the round-3 report left open stays open, **except item 1, resolved by T13 above, and the §9 film-led item (round-3 item 3), resolved by T19 above — both removed from this table**:

| Item | Register | Why it stands |
|---|---|---|
| The Neqi G0 / HOLD boundary call | round-3 report, item 4 | The designed styling-boundary archetype. It goes to Nick as a product-level call and then becomes the §2.3.2/§7.7 worked example |
| The slot-3 packet directions capture | round-3 report, item 2 | A packet fix, not a rule fix |
| The tail marker's variance across list lengths | §17.18 | Unchanged. The trim removes reviewable surface; it does not make a rank heuristic more accurate |
| COND `low` beside a slip observation on a lone monomeric quat, and the "short-chain" vs "long-chain" vocabulary for one material class | ref A18, blind A24 | Carried open since v0.2. T1 changes where the slip observation lives, **not** whether a monomeric quat is "a route" for COND — that ontology fork is still Nick's and is still unanswered |
| Polyacrylamide's L5 placement · alcohols outside the `Alcohol Denat.`/`Alcohol` enumeration · `curl_definition_focus` value vocabulary · retailer-reproduced pack directions · which §7 dimensions an excluded record may carry | §17.19, §17.21, §17.20, §17.23, §17.24 | All unchanged. §17.20 is now the reason the CURL entry of the `hinweise` record is empty on every round-3 record |

**Re-review consequence of the v0.4 bump (§16).** A standard-version bump reopens only the fields whose rules changed. For v0.4 that is: `focus.primary` and `focus.secondary` (the `detangling` and `smoothing` rows now name a different carrier for the same observation), `texture_fit` rows 3–5, the new `repair_support_level` on every record, the `hinweise` record on every record, `hold_route_state` on any record whose frozen `claims[]` carries a hold statement, — **added by T10** — `product_form` on every record, because its rule did not just move to a new carrier, it changed what the field *means*: a v0.3-fingerprinted approval of "product_form = FORM's architecture class" does not carry any information about the presentation form and cannot stand in for a review of it — and — **added by T12** — `application_stage` on every record, a genuinely new identity read with no v0.3-fingerprinted equivalent to carry forward, plus `focus.primary`/`focus.secondary` again wherever the `heat_styling` row's re-keying onto `provides_heat_protection`/`application_stage` changes which evidence a record's approval was actually reviewed against. **Removed fields are not reopened, they are gone:** `slip_combability_potential`, `ambient_smoothing_alignment_potential`, `dose_sensitivity`, `scalp_application_fit`, `humidity_resistance_evidence_state` and `specialist_functions.humidity_resistance` carry no approval forward because they carry no value forward (T9 added the last two). **T11 adds `product_form_architecture` to the gone list** — for the same reason as T8's echo fields, not T9's: nothing about the architecture read changed, only whether it is a standalone reviewable item, so there is no value that could have carried an approval forward in the first place; it simply has no row left to review. **T12 adds `usage_role` to the gone list**, on T9's reasoning, not T11's: the field carried a value and that value carries no approval forward, because there is no field left for the approval to attach to. Approvals for every other field remain valid where their per-field fingerprint is unchanged — and because T8 and T11 change the review surface rather than any value, an approval given against a v0.3 fingerprint is **not** invalidated by the echo-annotation rule alone.

**Added by T13** — `focus.primary` and `focus.secondary` reopen on every record a third time within this same version, for a different reason from T10's and T12's re-key moves: T13 is a genuine rule change (the repair row's marketing prong is deleted; §10.2.1 adopts the permissive over-satisfaction reading), not a carrier move for the same observation, so a prior approval of either field is not a plausible stand-in for review under the amended rule regardless of whether the record's *value* happens to be unchanged. Four records change value (slots 2, 6, 8, 10); the rest do not, but every record's `focus.primary`/`focus.secondary` approval is reopened on the same footing, because "the rule changed" — not "the value moved" — is what triggers re-review here.

**Added by T14** — `heat_protection_evidence_state` and `specialist_functions.provides_heat_protection` reopen, but **only on a record whose claims include a `C2_cross_market_verified` entry**: T14 is a genuine claim-authority rule change (§2.4.1 rule 7), not a carrier move, so a prior approval reviewed against the old reading — "this page is C5, so the claim does not exist" — is not a plausible stand-in once the exception admits it. On this gold set that is slot 10 (Olaplex) only; no other record's frozen `claims[]` carries a cross-market claim meeting both of rule 7's prongs, so no other record's HEAT fields reopen under T14. `focus.primary`/`focus.secondary` do **not** reopen a fourth time on T14's account alone — the `heat_styling` route still fails on Olaplex's `application_stage` (no `pre_heat`), so the focus value and its basis are unaffected by the HEAT change and stay on their T13 footing.

**Added by T15** — slot 13's `g0` and `hold_route_state` (and the `hold_support` projection) reopen: the ruling changed their values (`provisional_boundary` → `in_category`, `meaningful_hold_route` → `incidental_film`). No other record is affected — the worked-example pair codifies the reasoning both excluded and included cases already followed, and Maria Nila's `excluded_styling_first` is confirmed, not changed, by it.

**Added by T16** — slot 9 (Redken)'s `repair_surface_film`, `repair_support_level`, `damage_fit`, `focus.primary`/`focus.secondary` and `care_direction` reopen: the ruling changed all five values (§21.3 row 16). No other record's value changes, but **every in-category record's `tail_marker` reading is re-checked against the new plausibility test** (§21.3 row 16, `reference-key-v4/transform-notes.md`), and the fact of that check — not a value change — is what the audit trail records for the other ten. A prior approval of slot 9's five reopened fields is not a plausible stand-in for review under the amended rule, on the same footing T13 states for its own reopened fields: "the rule changed" is what triggers re-review here, independent of whether a given record's value happens to move.

**Added by T17** — no record's dimension or profile *value* moves (§21.3 row 17), so this is a T15-shaped reopening, not a T13/T16-shaped one: only the fields whose *trace* actually changed reopen, and only on the records it touched. Slot 6's and slot 12's `tail_marker` object and `persistence_removal_class`/`hold_route_state` trace notes reopen (the vacuous-marker note and its confidence step, H1). Slot 4's `tail_marker` object and `conditioning_potential`, `weight_residue_potential`, `persistence_removal_class`, `hold_route_state` and `repair_surface_film` reopen for their confidence step alone — no anchor's *value* changes (H2). Slots 3 and 10's `hinweise` record and `profile.cautions_de` reopen for the added buildup entry (H6). Slot 13's `review_routing` reopens for the added `species_reading_conflict` trigger (H9); its `hold_route_state` and `repair_surface_film` *values* are unchanged and their own T15/prior approvals stand. No record's `focus`, any fit, `care_direction` or `repair_support_level` reopens under T17 — none of those fields' values is touched by any of the seven adopted items on this gold set. §2.4 rule 2 (H3), §14's `l9_member_without_claim` trigger (H8) and §3.1.1's allergen-block removal's general text (H2) are unexercised beyond slot 4 and add no further reopening.

**Added by T18** — **no record reopens on the gold set, and none on the unseen set either.** T18 states a precedence rule for a question no gold-set record raises: no gold-set record carries a same-market formula-set conflict. Slot 3 (Cantu) is the documented **cross-market** DE/US split, §2.4.1 rule 7's domain and explicitly outside §2.4.2's scope. Slot 12 (Kevin Murphy, excluded/informational) has no *second German-market capture* to conflict with at all — its `known_conflicts` are an EU/US allergen difference (cross-market again), an unresolved GTIN, one token-level extraction ambiguity and a position discrepancy against an earlier lane description, none of which is two same-market captures disagreeing on a species set. Every remaining gold-set conflict is a naming, GTIN, discarded-scrape or tail-count item (slots 2, 5, 9, 10, 13), and slot 4's `provisional_identity_conflict` is a GTIN/product-page-availability question on a record whose three independent captures match each other exactly. So no gold-set value, trace or trigger moves, and reference-key-v4 is untouched by this ruling. On the unseen set the one record the rule governs, u1, was already re-derived under tier 1 on 2026-09-12 — it **is** §2.4.2's worked example, not a record the rule changes — and the closest other candidate, u6 (amika), is a cross-market source pair whose only difference is three appended fragrance/aroma chemicals, i.e. declaration granularity, which §2.4.2 excludes from "set conflict" by its own terms and §2.4.1 rule 7 already governs. T18 therefore adds a rule and a trigger definition, and reopens nothing.

**Added by T19** — **`care_direction` reopens on every in-category record**, on T13's and T16's footing rather than T15's: §9's rule changed, so a prior approval given against the pre-T19 reading ("a film-led architecture abstains") is not a plausible stand-in for review under the amended one, independently of whether a given record's value moves. **Exactly one record's value moves: slot 5 (EVO Head Mistress Cuticle Sealer), `care_direction` `unknown` → `balanced`** — the film is Dimethicone r2 / Cyclopentasiloxane r3 / Dimethiconol r5, all above the Phenoxyethanol r6 marker, with no R2 route above it (Quaternium-80 r14) and no L1/L3/L4 species above it at all; every leg candidate is subordinate and ranks below every film species (Panthenol r8, Hydrolyzed Quinoa r12, Macadamia oil r13, Butylene Glycol r18), so clause 4 holds and the row takes `moderate`/E2. Its `profile.care_direction` echo follows the same value, and the two projections that existed **only** because the field was `unknown` are dropped with it — `profile.uncertain_fields` loses its single `care_direction` entry and `profile.cautions_de` loses the §18 „Dazu haben wir keine belastbare Information."-string it emitted, leaving both arrays empty. No other field on slot 5 moves, and its review routing is unchanged (it already routes under `early_tail_marker`, `candidate_below_tail` and four other standing triggers). **Every other record is re-checked against the four clauses and unchanged** — eleven of the twelve fail clause 3 with a moisture leg above their own marker (slots 1, 2, 3, 4, 6, 7, 8, 10, 11, 12 and 13 — for slot 4 on the ordinal read its `none_visible` marker requires, and for slots 6 and 12 on the ordinal read their vacuous markers require), and slot 9 (Redken) fails clause 1 outright — its R2 is `candidate` under T16, so it keeps `protein`, and `balanced`'s reading (a) is untouched by this ruling. **No unseen record changes either**: u1 keeps `moisture` on the L3 emollient leg (IPM r2, castor r7) above its r13 marker — the same leg its own `silicone_led_unknown_check` recorded as the reason the old rule did not fire; u4, u5 and u6 each carry an L1 and/or L3 leg above their own markers; u2 and u3 are excluded records that emit no `care_direction` at all. No §18 string is added — `balanced` emits none, in either reading, and the only copy consequence anywhere is the `unknown` string slot 5 stops emitting.

**Added by the freeze-prep housekeeping batch (row 20, 2026-09-13)** — **no field reopens for a value, on any record.** This is a T15/T17-shaped consequence at its narrowest: no anchor, enum, evidence bar, projection or string wording changes, so no value can have been reviewed against a superseded rule. Only **slot 3's `review_routing`** reopens, and only for the trigger re-key (`formula_source_conflict` → `formula_or_identity_conflict`); its dimensions, profile, fits, focus, `care_direction` and every confidence band stand on their existing approvals. The five conventions that are newly *stated* rather than changed — the vacuity enumeration, the E-level ladder, the marker-status/trigger vocabulary, the LAYER and SHN anchors, and the partial-evidence confidence step — carry a **round-4 obligation rather than a re-review obligation**: each is a first statement of a convention two lanes previously improvised, so what round 4 must measure is whether two independent lanes now produce the *same trace* on the same frozen evidence, not whether a stored approval still holds. Two emission consequences are named above and apply at the next derivation rather than here — the nine records that gain the `aromatic_or_allergen_exposure` string, and slot 11's vacuous marker. The records a convention would visibly touch if re-derived today are named for that run: **u4 and u5** (`marker_status: vacuous` and the `tail_marker_vacuous` trigger in place of lane A's `very_late_tail_marker`, no value moving); **gold slot 11**, which the widened set moves from an ordinary marker to a vacuous one, again with no value and no confidence step moving; and **gold slots 6 and 12**, which T17 already placed on that reading and which the widened set leaves exactly where they are. Records written before this batch keep their existing E-levels and confidence bands until round 4 re-derives them (§3.1, clause 3 of the ladder).

**Row-20 addendum (2026-09-13) — four wording, emission and naming fixes closing the round-4 residue.** Round 4 (`plans/leave-in-inci/research/gold-set/round-4/round-4-report.md`) passed on values: **zero disagreements on any scored dimension, profile field, focus, fit, care direction, repair level, heat binary or marker status**, between the two sealed lanes and against the reference key, across all thirteen products. Its residue was two packet evidence gaps (items 1–2, closed by an evidence pass, not here), two registered expected key deltas (items 4–5, LAYER and SHN, applied to the key at its next derivation), and **four text items closable without touching any value** — which is what this addendum does. Authority is the same as row 20's: Nick's freeze directive, extended to round 4's own findings; **this is an addendum to a housekeeping row, not a new ruling, and nothing in it is a product-model decision.** The four:

1. **§8.4's false aside deleted and corrected (residue item 4).** Bound 3 claimed LAYER "fires on no gold-set record, because none reaches `permanent_cationic`" — false on the standard's own text: §7.6's enumeration reaches the class on **slots 2** (Guar HPTC r5), **6** (Guar HPTC r11 + PQ-10 r12, vacuous-marker coherence read) and **8** (PQ-16 r9), and the reference key projects `persistence_removal_class: permanent_cationic` on all three. Both round-4 lanes correctly applied the rule over the aside and fired LAYER there. Bound 3 now states that LAYER fires on exactly those three records and on no unseen record, which is the same set §8.5 limb 1 already fires the buildup caution on — consistent with H6's own reasoning (two cautions reading one class from two ends, bound 2). Item 5 of row 20 above is corrected in place. **Emission-only consequence:** those three records gain the LAYER `hinweise` entry and its one existing §18 string at their next derivation; §1.1 holds, and no dimension, profile, fit, focus, confidence or evidence level moves.
2. **§10.2.1 binds `focus.secondary` as well as `focus.primary` (residue item 3).** One clarifying sentence: the observation set that established COND's baseline cannot double as a beyond-baseline route for a **secondary** focus either — a baseline route is not a focus in either position, and "only the secondary" is not a lower bar. This resolves round 4's **single genuine lane deviation** (slot 9, Redken: lane A `focus.secondary: [smoothing]` vs lane B and the key `[]`), which was adjudicated to `[]` on the rule as it already stood. The adjudicated value is the key's existing one; **no record's focus moves.**
3. **§18 gains an emission-scope paragraph (residue item 6).** Two rows admitted two readings each and the lanes took one apiece, producing the round's caution-count residue with no value behind it. **(a)** On a `claim_only` heat record with **no** L9 member, exactly **one** heat string fires — the review string („… Wir prüfen das."), the more specific row, which already carries what the `claim_only` row says plus the formula finding; the `claim_only` row fires only where an L9 member **is** present. **(b)** **No §18 string exists or fires for `product_form: unknown`**: `product_form` is an identity capture (T10, E1), so an unresolved form is an identity gap routing through identity review (§2.4, §14), not a researched `unknown` for the „Dazu haben wir keine belastbare Information."-row. No string's wording changes and no string is added or removed.
4. **§14 assigns canonical ids to four standing bullets (residue item 7).** `two_phase_shake_dependency`, `meaningful_hold_route`, `bond_claim_review` and `fragrance_free_implication`, added as §14 vocabulary rule 4 — the same shape as T17's tail-marker table and this batch's own rule 1, one round later: both lanes had to improvise names for bullets that had none. **`meaningful_hold_route` is confirmed rather than assigned** (the §7.7 enum value was already serving as the id). No bullet's firing condition, wording or routing changes.

**Re-review consequence of the addendum: none, on any record.** No anchor, enum, evidence bar, projection, fit, focus, confidence band, evidence level or existing string wording changes, so no stored approval was given against a superseded rule and **no field reopens for a value** — the same narrowest T15/T17 shape row 20 itself records. Items 1 and 3 are **emission-scope** statements that take effect at the next derivation (item 1's three LAYER entries; **item 3 changes no record at all** — it codifies what the reference key already emits: all four `claim_only`-without-L9 records, slots 8, 9, 10 and 13, carry exactly one heat string today and it is the review string, so lane A's double emission was the deviation and clause (a) is the key's existing behaviour written down; and no in-category key record carries `product_form: unknown`, the four packet-side form gaps being residue item 1's evidence pass rather than a research `unknown`). Items 2 and 4 are **trace and naming** statements with no emission at all. Reference key, packets, lane records, fixtures, builders and tests are untouched by this addendum; the LAYER and SHN deltas round 4 registered are applied to the key by that separate pass, not by this text.

**Review-state consequence.** The trim changes which items exist to be reviewed, so a stored per-property review state keyed on the v0.3 property set does not map onto the v0.4 set. Existing review state is **invalidated rather than migrated**: no property approval is silently carried across a shape change, which is the same discipline G7's per-field fingerprints apply to values.
