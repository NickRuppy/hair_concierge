# Hard-rule audit — Leave-In Classification Standard v0.4

**Question asked (Nick, 2026-09-11).** The §3.1.1 tail-marker rule was made a strict single-prong rule for determinism, and was blind to an implausible input: Redken declares Phenoxyethanol at rank 3 of 24, so the rule mechanically disqualified a genuine mid-list repair silane. T16 made that rule **conditional** — it applies only when the marker is plausible; an implausible marker cannot disqualify anything and routes to review. **Which other rules have that shape?**

**Scope.** Every hard threshold, closed enumeration and gate in `leave-in-classification-standard.v0.4.md`, assessed against how it actually fired on the 13-product gold set (`reference-key-v4/reference-key.json`, `transform-notes.md`), both lanes' residual registers (`reference-key-v3/summary.md` §"Remaining ambiguities", `blind-v3/blind-review-notes.md` §3–§4) and the round-3 report.

**Calibration discipline used.** A rule is **SOUND** when it is strict by evidence-based design *and* its failure output is a review route or the anchor's own conservative value — not a confident wrong value. A rule is **NEEDS-CONDITIONAL-ESCAPE** only when a German-market-plausible formula makes it emit a confident wrong *projected* value with no human in the path. I have not manufactured problems: L9, the plain-hydrolysate R2 exclusion, G9, G11 and the claim-authority tiers all come out SOUND below, and I say why.

**One structural observation up front.** The reference-key v4 run carries **five tail-marker review triggers that §14 does not define** — `tail_marker_dependence` (3 records), `very_late_tail_marker` (3), `very_early_tail_marker` / `early_tail_marker` (2), `tail_marker_allergen_block_only` (1). §14 names only `tail_marker: none_visible`. **Nine of thirteen records** route on a marker condition the standard has no trigger for. The escapes around §3.1.1 are currently *lane conventions, not rules* — which is the same defect T16 fixes on the disqualification side, and it is why several items below are cheap.

---

## Ranked table

Ranked by (decisiveness on the gold set) × (severity of the wrong-confident output) × (absence of an escape).

| # | Rule | Decisive on gold set | Implausible-input failure mode | Has escape? | Verdict |
|---|---|---|---|---|---|
| H1 | **§3.1.1 tail marker — the vacuous / implausibly-late case** (T16's mirror) | Markers at 36/40 (s6), 29/36 (s12), 28/51 (s3), 14/16 (s4); 3 records carry a lane-invented `very_late_tail_marker` | Everything above a terminal marker passes "present as architecture" trivially → a token 0.1 % active mid-list can set R2 `candidate`, `repair_support_level: medium`, `damage_fit.highly_damaged: recommended`, `focus.primary: repair` | **No.** §3.1.1 limits 2 and 3 cover *absent* and *very early*; §17.18 states explicitly that nothing covers the vacuous case | **NEEDS-CONDITIONAL-ESCAPE** |
| H2 | **§3.1.1's "26 EU fragrance allergens as a block" marker entry** | 1 record (s4: LINALOOL at 14/16 on a formula with **no preservative at all**) | Allergens are declared last by EU convention, so this entry guarantees a near-terminal marker and **prevents limit 2 (`none_visible` + review) from firing on exactly the preservative-free formulas it was written for** | **No** — it actively blocks the escape that exists | **NEEDS-CONDITIONAL-ESCAPE** |
| H3 | **§2.4 rule 2 — the rinse test** ("any direction containing a rinse … sets `excluded_other_form` before any formula analysis"; "product form, list architecture and marketing name never override") | 1 record in round 1 (the vacated slot) — the rule exists for a real reason | Dual-use „im Haar lassen **oder** nach 2 Minuten ausspülen" and the standard German eye-safety sentence („bei Augenkontakt gründlich ausspülen") both match. Output is `excluded_other_form` + **no lean profile at all** (§2.3.1) — the most destructive, least recoverable output in the standard | **No.** The rule states that nothing overrides it | **NEEDS-CONDITIONAL-ESCAPE** |
| H4 | **§10.2 `detangling` row, prong (i)** — C1/C2 detangling positioning + ≥1 M1 contributor | 1 record set (s11); 1 record demonstrably missed (s3 Cantu → `general`) | Two-way. (a) Positioning **creates** a route on one observation "every capable emulsion has" — the exact shape T13a just deleted from the `repair` row. (b) A rich detangler (the archetypal category) is unreachable: prong (ii) needs WT `low`, prong (i) needs C1/C2 — s3's positioning is C3 (`directions_below_authority` fires on the same record) | **No.** Falls silently to `general` | **NEEDS-CONDITIONAL-ESCAPE** |
| H5 | **§7.4.1 two-observation test, clause 2** (a silicone pair / amino silicone + carrier counts as **one**) | Decided `smoothing` vs `general` on 5 slots (2, 6, 8, 9, 10); largest round-3 disagreement surface | A single-mechanism dedicated smoothing product (Aqua · Cyclopentasiloxane · Dimethiconol · Dimethicone · Amodimethicone · Parfum — a German „Anti-Frizz Glättungsspray") has one film observation and no second lubrication observation → `general`, i.e. "no distinctive purpose", on a product whose only purpose is smoothing. Observed on s9 | **No.** T13b's permissive reading sits *downstream*; this test gates first | **NEEDS-CONDITIONAL-ESCAPE** |
| H6 | **§7.6 monomeric-quat → `neutral_non_volatile` → projects `moderate`**, with the buildup caution keyed only on PERS `high` | PERS class decisive on 13/13; buildup fired on 3 (s2, s6, s8) | Inversion the user sees: a water + PQ-10 light spray (s11 shape) carries the buildup caution while a behentrimonium-led rich cream (s3 Cantu, WT `high`) and s10 (WT `high`) carry none. The mandatory under-statement note is **trace-only** (G14), so the correction never reaches the output | **Partial** — the note exists but cannot move anything by design | **NEEDS-CONDITIONAL-ESCAPE** |
| H7 | **L5 fixative enumeration** — half-open list with an internal circularity ("acrylates copolymers *used as fixatives*") | HOLD decisive on 13/13; Polyacrylamide specifically decisive on s5 + s9 (§17.19) | False-negative on the **G0 styling gate**. A German „Föhnlotion" / blow-dry primer on Alcohol Denat. + Polyquaternium-4 + Polyquaternium-11 + Panthenol reads HOLD `none` (no declared L5 member), passes G0 `in_category`, and is classified as a conditioning leave-in. PQ-11 is currently listed in **L1 as a conditioning polymer** and is also a classic fixative resin | **No** for the false-negative; §17.19 covers only Polyacrylamide | **NEEDS-CONDITIONAL-ESCAPE** (subsumes §17.19) |
| H8 | **§13.3 — L9 member above the tail with *no* C1/C2 claim ⇒ `provides_heat_protection: false`** | 0 records reached this exact shape (s1 hit the below-marker variant); the mirror trigger fired 4× | §14 carries "a heat-protection claim with no L9 member" but **not its mirror**. A product declaring Polyquaternium-55 or VP/Acrylates/Lauryl Methacrylate Copolymer at rank 6 whose manufacturer page is silent — or is Austrian and therefore C5 (s12's exact shape) — emits `false` confidently and **no human ever sees it** | **No review route** | **NEEDS-CONDITIONAL-ESCAPE** (one line) |
| H9 | **§2.3.2 "thin or absent conditioning architecture"** — undefined, and composed with the §3.1.1 rank prong | 2 G0 decisions (s7 excluded, s13 required Nick's T15 by hand) | The rank prong can make a real conditioning architecture read as "thin", firing `excluded_styling_first` → **no lean profile**. T15 had to adjudicate s13 by naming Silicone Quaternium-18 at r11 (below the r9 marker) as a substantive conditioning film for G0/HOLD — **while §7.10's rank prong keeps R2 `none_visible` on the same species, at the same rank, on the same record.** Two rules now read one observation opposite ways | **Yes, partially** — `HOLD = meaningful_hold_route` is a standing §14 trigger, so the destructive path always reaches a human | **NEEDS-CONDITIONAL-ESCAPE** (consistency clause, not a new route) |
| H10 | **§7.5 rich-band closed enumeration** (unenumerated oils read medium) + **"family" is never defined** | Held WT at `moderate` on 3 of 11 in-category records (s1, s8, s9) via the "absent rich-band member" clause; "family" had two readings on s1, s4, s13 and **agreed by luck** | WT drives `hair_thickness_fit.fine` (`conditional` vs `caution`) and `texture_fit` rows 3/4. s4 — alverde Nutri-Care 2-Phasen **Bio-Mandel, Bio-Argan**, a bulk-oil two-phase spray — reads WT `moderate` / fine `conditional`, because sweet almond and argan are unenumerated and count as one "family". Under-warning is the FS-13/FS-20 direction | **No.** §17.15 correctly forbids extending the L3 table, but offers no substitute | **NEEDS-CONDITIONAL-ESCAPE** (caution + route, not a science change) |
| H11 | **§3.2 E3 metadata requirement** — an E3 record omitting ambient RH is downgraded to E2 | 0 (no E3 record exists) | Post-T9 dead weight: with HUM removed there is **no humidity or frizz endpoint left in the model**, yet RH is still mandatory. A genuine DSC heat test or instrumented combing test declaring dose, damp/dry and drying method but not RH is mechanically downgraded — and this rule is one of the things keeping `HEAT: product_tested` (§17.8) and `repair_support_level: high` (§17.25) permanently empty | **No** | **NEEDS-CONDITIONAL-ESCAPE** (defer — see freeze list) |
| — | **L9 closed list** (§5, §13, G10) | 4 records → `claim_only` + `heat_claim_without_l9_member` (fired 4×); 0 reached `formula_plausible` | Strict by published evidence (Zhou 2011; McMullen & Jachowicz 1998). Refuses structural-family resemblance (s13: VP/Methacrylamide/Vinyl Imidazole ≠ L9; s8: PQ-16 ≠ PQ-55) | **Yes** — fails to `claim_only` + review; the production binary still honestly reports the claim | **SOUND** |
| — | **L9 tail-member rule** (§5) | 1 record (s1: Hydrolyzed Wheat Protein r14, below marker, no claim) | Did exactly its job on the naturkosmetik case it was written for; two independent rules blocked the upgrade | Yes (records and stops) | **SOUND** |
| — | **§7.10 plain-hydrolysate R2 exclusion** | R2 = `none_visible` on 13/13; decisive on s8 (Gliss "flüssiges Keratin") | *Could a genuinely effective unmodified protein exist?* Yes — hydrolyzed wheat protein is an **L9** member. But R2 is a *surface-film substantivity* dimension, and cationisation/silane functionalisation is the evidence-backed basis for substantivity (SR §H.1). A genuinely effective unmodified hydrolysate is a **heat** (L9) or **fibre-mechanics** (L6) observation, and both routes already exist. Fails to `none_visible` **with a mandatory trace note** | Yes | **SOUND** |
| — | **§2.4.1 claim-authority tiers, post-T14** | `claim_authority_gap` fired on **7 of 13**; every heat binary decided from frozen `claims[]` with zero judgment | Brands with no German web presence (s5 EVO — C5 US page + C4 German retailer; s12 Kevin Murphy — .at is C5) and pack-only claims all land at "no claim" — **but every one routes to review** under rule 1. Two residual notes, both *packet* issues not rule failures: (a) a German-language Austrian page is C5, defensible but worth Nick's eye; (b) `claims_status` conflates "searched, does not exist" (s2, s11) with "could not obtain" (s4, s6) — blind AMB-09 | **Yes**, consistently | **SOUND** (two packet notes) |
| — | **§7.6 `permanent_cationic` INCI-name enumeration** | PERS decisive on 13/13 | v0.2 already repaired the G4-forbidden charge-density gate. The enumeration is *pattern*-open (`Polyquaternium-x`, `Silicone Quaternium-x`), so it lacks the closed-list failure mode; the residual opaque-`Quaternium-x` case has its own `quat_structure: unresolved` route (fired 3×) | Yes | **SOUND** |
| — | **COND `high` LGN-pair gate** (silicone-led capped `moderate`) | COND `high` on 4 records, all LGN; s13 capped at `moderate` | Deliberate and evidence-backed: LGN is the best-supported high-conditioning architecture. It fails toward a *lower* value, which is conservative. The real damage is the compound — `damage_fit` row 3b (the R2 escape written for exactly this product) is dead because R2 never reaches `candidate` | Row 3b is the escape; **its deadness is an H1/T16 problem, not a COND problem** | **SOUND** (treat at H1) |
| — | **§10.2 `curl_definition` negative gate** | 0 (never derived on any record) | Negative-only; fails toward not-qualifying. Curl definition is not formula-readable at all (§17.6, SR §M.6), so a positioning gate is the honest floor | Yes | **SOUND** — but see §17.20 below |
| — | **§10.1.2 weight conflict tag** | Declined 13/13, correctly | Cannot fire without WT `high` from formula alone; s13 satisfied conditions 2–4 and failed only condition 1. Fails toward the anchor's own answer | n/a | **SOUND but uncalibrated** — the ref lane's own question ("calibrated, or merely safe?") stands |
| — | **G9, G11, G4, G14, §2.3.1 emission contract, G7 fingerprints** | G9 removed two v0.1 clauses; G14 verified clean across rounds 2 and 3 | Hard gates with no value-producing power; their failure mode is refusal, not a wrong value | n/a | **SOUND** |
| — | §17.19 Polyacrylamide L5 placement | Decisive on s5, s9 (both read as the emulsifier system) | — | — | **OPEN-GAP-ALREADY-KNOWN (§17.19)** — folded into H7 |
| — | §17.20 `curl_definition_focus` has no value vocabulary | CURL empty on **13/13**; the §8.6 `hinweise` CURL entry can never fire | — | — | **OPEN-GAP-ALREADY-KNOWN (§17.20)** |
| — | §17.22 `care_direction` under-fires on film-led architectures | s8, s13 (+ s12 informational) → `moisture`; s13's own C2 page claims „Feuchtigkeits**schutz**" | — | — | **OPEN-GAP-ALREADY-KNOWN (§17.22)** |
| — | §17.23 captured-but-below-C1/C2 directions | `directions_below_authority` fired **6×** | — | — | **OPEN-GAP-ALREADY-KNOWN (§17.23)** — but note it now feeds H4, not ROLE |
| — | §17.21 alcohols outside the `Alcohol Denat.`/`Alcohol` enumeration | 4 records (Isopropyl Alcohol s6/s10, Benzyl Alcohol s3/s9) | Post-T4 this no longer feeds a scalp verdict; it only suppresses the EXPO §18 alcohol string. **Lower stakes than in v0.3** | — | **OPEN-GAP-ALREADY-KNOWN (§17.21)** |
| — | §17.24 which §7 dimensions an excluded record may carry | 2 records (s7, s12) | — | — | **OPEN-GAP-ALREADY-KNOWN (§17.24)** |
| — | §17.25 `repair_support_level` `medium`/`high` never exercised | `low` on **11/11** in-category | — | — | **OPEN-GAP-ALREADY-KNOWN (§17.25)** |
| — | §8.1 SHN fires `present` on **12/13** | — | Not a correctness risk — but a flag that fires on nearly every product carries no information, and it is now 12 of the 18 total `hinweise` entries. Worth one line at freeze: consider whether SHN `present` should fire into `hinweise` at all | n/a | Note only |

---

## Per-rule detail — NEEDS-CONDITIONAL-ESCAPE

### H1 — §3.1.1: the vacuous / implausibly-late tail marker (T16's mirror)

**What it decides.** Whether any ingredient is "present as architecture", for **every** §7 anchor (clause 1: rank is the single deterministic prong).

**Observed.** Markers at rank 36/40 (s6 Curlsmith), 29/36 (s12), 28/51 (s3 Cantu), 14/16 (s4). §17.18 already states the problem in the standard's own words: *"nothing covers a marker so late that the test is vacuous, and that case was decisive on one round-2 `focus.primary`."* The ref-v3 register repeats it: *"everything qualifies as 'above the tail', so the test separates nothing and every anchor passes trivially."*

**Realistic failure scenario (German market, over-read direction — untested by the gold set).** A mass-market „Repair" leave-in cream — the Balea Professional / Isana / Garnier shape — with a 45-ingredient list, Phenoxyethanol at rank 38, and **Hydroxypropyltrimonium Hydrolyzed Wheat Protein at rank 26**. That is a classic claim-support level (~0.1 %), sitting in a formula whose conditioning is done by the LGN pair at ranks 3–5. Under the rank prong, rank 26 is "above the tail", so:

- R2 → `candidate` (a cationised protein present as architecture in a film context)
- `repair_support_level` → **`medium`** (§10.3.2 row 2: R2 `candidate` + `conditioning_level ≥ moderate`) — the row §17.25 says has never been exercised, first exercised by a token
- `damage_fit.highly_damaged` → **`recommended`** (§10.3 row 3b, R14's repair-film path)
- `focus.primary` → **`repair`** (§10.2, the only remaining qualifying route post-T13a)

Four projected fields, all confidently wrong, from a token active — and `repair_support_level: medium` is a §14 trigger, so a human would see *that* one, but `damage_fit` and `focus.primary` project regardless. This is strictly more damaging than the Redken case T16 fixed, because Redken **under**-reads (a real route becomes invisible) while this **over**-reads a token into the highly-damaged tier.

**Proposed conditional escape (symmetric with T16, same shape, no numbers).**

> A tail marker is **implausibly late** when the ingredients ranked at or below it consist only of other concentration-capped materials, fragrance/allergen declarations and colourants — i.e. the tail it defines contains nothing the architecture read would have placed there anyway, so the test separates nothing.
>
> An implausibly-late marker **cannot establish** "present as architecture" for any anchor. Anchors that would be *raised* by it take the value the coherence/ordinal read supports, the record carries `tail_marker: vacuous` naming the marker and its rank, and it **routes to human review** (`vacuous_tail_marker`).
>
> Stated once, together with T16: **an implausible marker can neither disqualify (T16) nor qualify (this). Plausibility is a precondition of the marker being read at all.**

**Why this is checkable.** It is a presence test over the declared tail, on the same frozen list the marker itself is read from — no judgment, no percentage, no cross-product comparison. It preserves §3.1.1's determinism claim (two lanes reading the same list reach the same answer) and its error direction is review, not a value.

---

### H2 — §3.1.1: the "26 EU fragrance allergens as a block" marker entry

**What it decides.** Which ingredient becomes the tail marker on a formula carrying no other capped material.

**Observed.** s4 (alverde Nutri-Care 2-Phasen-Sprühkur) took **LINALOOL at rank 14 of 16** as its marker — on a formula with **no preservative at all**. The lane invented `tail_marker_allergen_block_only` to route it.

**The defect.** EU practice declares the 26 labelled allergens at the **end** of the INCI list. Including the block in the capped list therefore does two things at once: it guarantees a near-terminal (vacuous) marker, and it **pre-empts limit 2** — `tail_marker: none_visible`, fall back to the ordinal read, lower confidence, route to review — which is the honest escape written for exactly these preservative-free naturkosmetik formulas. The list entry disables its own safety net.

**Proposed conditional escape.**

> Remove the declared fragrance-allergen block from the capped-ingredient list in §3.1.1. Where a formula declares no other capped material, the marker is **`none_visible`** and limit 2 governs (ordinal read, confidence lowered one step, route to review) — which is the state the standard already defined for this case.
>
> If the block is retained for any reason, it must be marked **marker-of-last-resort** and must set `tail_marker: none_visible_preservative` with the same limit-2 consequences, never a rank-bearing marker.

Cost: one line. It converts an invented lane trigger into a defined rule state, and it is a strict prerequisite for H1 (otherwise the vacuity test fires on every allergen-marked formula and the two rules collide).

---

### H3 — §2.4 rule 2: the rinse test

**What it decides.** `excluded_other_form` at G0, **before any formula analysis**, emitting **no lean profile at all** (§2.3.1). The least recoverable output the standard has.

**Why it exists.** Round 1 lost a gold-set slot to a product freeze-captured as a leave-in whose direction read „Nach 9 Sekunden gründlich ausspülen". The rule is well-motivated and should stay.

**The blindness.** It is stated as a keyword test over direction text — *"any direction containing a rinse, wash-out, or contact-time-then-rinse instruction"* — and then hardened: *"Product form, list architecture and marketing name never override an explicit rinse direction."* No escape at all. Two German-market-plausible inputs break it:

1. **Dual-use directions.** „Auf das handtuchtrockene Haar sprühen, im Haar lassen **oder** nach 2 Minuten ausspülen." This is a standard shape on German „Sprühkur" / „2-in-1 Kur" products. The product is genuinely usable as a leave-in and genuinely usable as a rinse-out, and the rule excludes it outright.
2. **The safety sentence.** „Bei Kontakt mit den Augen gründlich mit Wasser ausspülen." Present on a large share of German packs, and it satisfies the test as literally written.

The gold set contains **neither** shape, so this direction of the rule has never been exercised.

**Proposed conditional escape.**

> The rinse test fires only on an instruction governing **the product's own application step** — i.e. the sentence that says what to do with the product after applying it.
>
> 1. A **safety or hazard instruction** (eye contact, accidental contact, spillage) never fires the test.
> 2. Directions that offer leave-on use as an **alternative** to rinsing keep the record **in-category** as a dual-use record, with both direction sentences captured verbatim, `application_stage` transcribed from the leave-on half, and the record routed to human review (`dual_use_directions`).
> 3. Only a direction that makes rinsing **the sole disposition** of the product sets `excluded_other_form`, and it does so exactly as today.

The evidence bar does not move; the rule stops firing on sentences it was never aimed at.

---

### H4 — §10.2 `detangling` row, prong (i)

**What it decides.** `focus.primary: detangling` — the row that owns the single largest German leave-in shelf segment („Entwirrungsspray", „Leichtkämmspray", kids' detanglers, curl detangling creams).

**Observed.** Set on 1 record (s11 Balea Leichtkämmspray, via prong (ii)). **Missed on s3 (Cantu Leave-In Haarkur)** — a product dm retails as a detangling leave-in for curls — which projects `general`, while the same record carries the `directions_below_authority` trigger.

**Two-way failure.**

- **Over-read.** Prong (i) is *positioning + one M1 slip contributor*, and the row itself says one contributor is something "every capable emulsion has". That makes prong (i) effectively positioning-only — **the exact shape T13a deleted from the `repair` row on 2026-09-10**, for contradicting §10.2 principle 4 ("official positioning may corroborate but never creates a route"). The contradiction T13a resolved in the `repair` row is still standing, unamended, in the `detangling` row two rows below it.
- **Under-read.** Prong (ii) requires WT `low`. A rich detangling cream for curly/coily hair — the archetype of the category — cannot satisfy it, and if its detangling positioning sits at C3 (retailer) rather than C1/C2, prong (i) is unreachable too. Result: `general`, silently.

**Proposed conditional escape.** This is partly a consistency ruling and Nick has to make the call, because it moves projected focus values:

> 1. **Consistency (required either way).** Either delete prong (i) as T13a deleted the `repair` row's positioning prong, or state in §10.2 why `detangling` is permitted a positioning prong when `repair` is not. The two rows currently apply opposite readings of principle 4.
> 2. **If prong (i) is kept**, tighten it so positioning is not doing the work alone: detangling-led C1/C2 positioning **plus two or more independent M1 slip contributors present as architecture** (the row's own "not by themselves" threshold, used here as a corroborating floor rather than a disqualifier).
> 3. **Add a third prong for the heavy-detangler case, routed rather than projected:** detangling-led **directions or positioning at any tier in G1's general hierarchy** (not claim-gated — the same sourcing `application_stage` already uses, §7.13) with two or more M1 contributors above the tail ⇒ `detangling` is a **candidate** route, the record routes to review (`detangling_positioning_below_authority`), and `focus.primary` is marked uncertain rather than falling to `general`.

---

### H5 — §7.4.1 two-observation test, clause 2

**What it decides.** Whether a smoothing route exists at all — it gates **before** T13b's permissive beyond-baseline reading is even reached (§10.2.1 says so explicitly).

**Observed.** Decided `smoothing` vs `general` on slots 2, 6, 8, 9, 10 — the largest disagreement surface of round 3. s9 fails the test outright ("every candidate second route sits below the rank-3 marker") and lands `general`.

**Realistic failure scenario.** A German „Anti-Frizz Glättungsspray" / „Glanz-Serum-Spray" (the Gliss / Syoss / Guhl shelf shape): **Aqua · Cyclopentasiloxane · Dimethiconol · Dimethicone · Amodimethicone · Phenoxyethanol · Parfum**. Every candidate observation is one silicone film system; clause 2 counts "a Dimethicone/Dimethiconol pair, an amino silicone plus its own carrier" as **one** observation. There is no second lubrication route because there is nothing else in the product. The two-observation test fails ⇒ no smoothing route ⇒ `focus.primary: general`.

`general` is not a neutral abstention — §10 defines it as "a capable conventional leave-in where no route clears its threshold". A dedicated single-mechanism smoothing product is projected as having no distinctive purpose.

**Why clause 2 is nevertheless right in general.** Its job is G3: on a product where COND already rests on that same film, counting it twice is a double count. That reasoning is sound. It simply assumes the film has a COND value to be double-counted *against*.

**Proposed conditional escape.**

> Clause 2 applies where the film route is among the observations that **established COND** (§10.2.1's set, which the record must already name). Where it is not — because COND rests on a different architecture, or because there is no independent conditioning architecture at all and the film **is** the product — the single continuous film route does not fail silently:
>
> - If COND was established **without** the film route ⇒ the film is beyond baseline conditioning and the smoothing route qualifies (this is already T13b's logic, applied one level earlier).
> - If COND has **no** independent basis (the film is the entire architecture) ⇒ `smoothing` is a **candidate** route, `focus.primary` is marked uncertain, and the record routes to review (`single_mechanism_smoothing`). It never projects `general` by default.

This adds no evidence and invents no anchor: it reuses the COND-establishing set §10.2.1 already requires every record to state, and its failure output is a review route rather than a confident `general`.

---

### H6 — §7.6 monomeric-quat class and the buildup caution's key

**What it decides.** `persistence` (projected) and — indirectly — whether the user sees a buildup caution at all.

**Observed inversion.** Buildup fired on s2, s6, s8 (all PERS `permanent_cationic`). It did **not** fire on s3 (Cantu, WT `high`, a rich behentrimonium-led leave-in cream) or s10 (Olaplex, WT `high`). Meanwhile s11 — a water + cationic-polymer light spray, WT `low` — is the shape that *would* carry it. A user comparing the two products sees a buildup warning on the lightest product in the set and none on the heaviest.

**Why the existing note cannot fix it.** §7.6's under-statement note is mandatory, but it lives in `counter_signals[]` / `limitations[]`, and G14 forbids a counter-signal from moving or annotating a projected value. The correction is structurally sealed inside the trace. §7.6 itself names the error direction: *"under-states persistence and therefore under-warns on buildup — the direction FS-20 exists to guard."*

**Proposed conditional escape.** Do not touch the PERS ordinal class (it is a mechanism ordering and the science is right). Change what the **caution** keys on:

> The buildup caution (§8.5) is emitted when **either** `persistence` projects `high`, **or** `weight_potential` is `high` with at least one persistent non-volatile family present as architecture.
>
> This does not violate G3 rule 4 — the caution and PERS still read the same evidence from two ends; it widens which end can raise it. A record emitting the caution on the WT limb records that basis in the caution's own emission trace.

Alternative if Nick prefers no copy change at freeze: route `neutral_non_volatile` + `weight_potential: high` to review (`monomeric_quat_high_weight`) and let a human decide. Cheaper, less useful.

---

### H7 — L5 fixative enumeration (subsumes §17.19)

**What it decides.** HOLD (13/13), and through HOLD the **G0 styling-first exclusion** (§2.3.2's architecture half).

**Observed.** Polyacrylamide was load-bearing on s5 and s9 and is unenumerated (§17.19); both lanes read it as the pre-neutralised emulsifier system, correctly, but by analogy rather than by rule. s10's record had to invoke the L5 rheology exclusion by hand for Hydroxyethylcellulose and Hydroxypropyl Guar.

**The structural problem.** L5 is a *half-open* list: it names six specific copolymers, then adds "acrylates copolymers **used as fixatives**" — a phrase that requires the reader to already know the answer — and then the L5 rheology exclusion removes a set of acrylates by name. A reviewer facing an unlisted polymer has a circular test.

**Realistic failure scenario (false-negative on the boundary gate).** A German drugstore **„Föhnlotion" / „Volumen-Föhnspray"** — a category that is genuinely in-category-adjacent and often marketed as a blow-dry primer: **Aqua · Alcohol Denat. · Polyquaternium-4 · Polyquaternium-11 · Panthenol · Phenoxyethanol · Parfum**. PQ-4 and PQ-11 are the classic vinylpyrrolidone-based cationic **fixative resins** of that shelf; PQ-11 is currently listed in **L1 as a cationic conditioning polymer** and nowhere in L5. HOLD reads `none` (no declared L5 member), so §2.3.2's architecture half can never be established, the G0 styling gate cannot fire, and a styling product is classified as a conditioning leave-in with a full lean profile. **A whole fixative chemistry class is invisible to the boundary gate.**

**Proposed conditional escape** — use the v0.3 precedent (the VP/Methacrylamide/Vinyl Imidazole and Polysilicone-29 entries), which placed materials in a *family* and let the §7.7 anchors decide the state:

> 1. **Enumerate as dual-placement, not re-placement:** Polyquaternium-4, -11, -44, -46 and -69 are **L1 cationic conditioning polymers *and* L5 fixative-class film formers**. They do not set HOLD on their own; §7.7's anchors decide the state on the rest of the architecture (substantive conditioning behind them ⇒ `incidental_film`; thin or absent ⇒ `meaningful_hold_route` ⇒ G0 styling review, which is a §14 trigger, so a human sees it).
> 2. **Enumerate the remaining German-shelf styling copolymers** in the same way: Acrylates/Octylacrylamide Copolymer, Octylacrylamide/Acrylates/Butylaminoethyl Methacrylate Copolymer, VA/Crotonates/Vinyl Neodecanoate Copolymer.
> 3. **Close §17.19** by enumerating Polyacrylamide explicitly as the emulsifier/rheology reading both lanes independently reached, with the note that a Polyacrylamide declared *without* an isoparaffin/laureth partner routes to review.
> 4. **Delete the circular phrase** "acrylates copolymers used as fixatives" and replace it with the enumeration plus: "an unenumerated polymer whose family placement cannot be settled from the INCI name routes to review (`l5_placement_unresolved`); it never sets HOLD by analogy."

Clause 4 is the T16-shaped half: the failure output becomes a review route instead of a confident `none`.

---

### H8 — §13.3: L9 member with no claim, and the missing mirror trigger

**What it decides.** `provides_heat_protection` — the standard's only production-shaped binary.

**The asymmetry.** §14 carries *"a heat-protection claim with no L9 member"* (fired 4× on the gold set — s8, s9, s10, s13; the trigger works). It does **not** carry the mirror. §13.3 rule 2 states the outcome without routing it: *"No claim, L9 member present → `false`, trace state `not_claimed`, with the L9 observation recorded in the trace."*

**Realistic failure scenario.** A German-market heat spray declaring **VP/Acrylates/Lauryl Methacrylate Copolymer** (a Zhou 2011 polymer, and a real ingredient on that shelf) at rank 6 — above the tail — whose manufacturer page is silent on heat, or is Austrian and therefore C5 under rule 3. **s12 is exactly that shape** (kevinmurphy.at → C5; a °C figure exists and is correctly refused). Output: `provides_heat_protection: false`, confidently, with the best formula evidence the standard recognises sitting in the trace and **no human in the path**.

The gold set never produced the above-marker version of this shape (s1 hit the below-marker variant and was correctly stopped by two rules), so it is untested.

**Proposed conditional escape — one line, no semantics change.**

> Add to §14: **`l9_member_without_claim`** — an L9 closed-list member present **above the tail marker** with no C1/C2 (or `C2_cross_market_verified`) heat claim. The binary stays `false` — the claim-led policy is deliberate (ruling 6) and a formula does not manufacture a claim — but the record routes to review so a human can decide whether the manufacturer source was simply not found, exactly as `claim_authority_gap` already does in the mirror direction.

This is the cheapest item in the audit and it closes the only place in the standard where the *strongest available formula evidence* produces a confident negative that nobody sees.

---

### H9 — §2.3.2 "thin or absent conditioning architecture", and its collision with the rank prong

**What it decides.** `excluded_styling_first` — exclusion, no lean profile, no matching presence.

**Observed.** The blind lane's hardest-call #4: *"§2.3.2 clause 3 is unambiguous once the architecture half is granted, but granting it rests on judging a lone fatty alcohol plus an unresolvable quat as 'thin'."* And s13 required **Nick's T15 adjudication by hand** because the round-3 mechanical read placed Silicone Quaternium-18 (r11) below the marker (r9), read the conditioning as thin, and landed `provisional_boundary`.

**The live contradiction T15 left behind.** T15 names Silicone Quaternium-18 + Polysilicone-29 as the substantive conditioning film that decides G0/HOLD on s13 — **while §7.10's rank prong keeps `repair_surface_film: none_visible` on Silicone Quaternium-18, at the same rank, on the same record** (`candidate_below_tail` fires). The standard now reads one observation two opposite ways depending on which rule is asking. T15 says explicitly that it does not amend §3.1.1 and does not reopen the marker for any other record — which is the right scope for a product-level adjudication, but leaves the general rule inconsistent.

**Mitigation already in place.** `HOLD = meaningful_hold_route` is a standing §14 trigger, so the destructive path always reaches a human. That is why this ranks below H1–H8 despite the severity of its output.

**Proposed conditional escape — a consistency clause, not a new route.**

> A conditioning architecture is **not** "thin or absent" for §2.3.2's architecture half merely because the §3.1.1 rank prong placed its members at or below the tail marker. Where the only reason the conditioning reads thin is a marker that is **implausible under T16 (too early) or vacuous under H1 (too late)**, the architecture half is **not established**, the G0 decision does not fire, and the record routes to review (`styling_boundary_marker_dependent`).
>
> Stated generally: **T16's plausibility precondition governs every rule that reads the marker, including G0's architecture half and §7.10's R2 value — not only the anchors T16 was adjudicated on.**

The second sentence is the important one. If T16 is scoped narrowly to the R2/Redken case, s13-shaped collisions will keep needing per-product adjudication, and the standard will accumulate worked examples instead of a rule.

---

### H10 — §7.5 rich-band closed enumeration, and the undefined "family"

**What it decides.** `weight_potential`, which is the anchor dimension of the category and drives `hair_thickness_fit` (fine: `conditional` vs `caution`) and `texture_fit` rows 3/4.

**Observed.** The "absent rich-band member" clause held WT at `moderate` on **s1, s8, s9** — three of eleven in-category records. And "family" is never defined as band, species or route; s1, s4 and s13 each admitted two readings and **landed on the same value by luck, not by rule** (ref-v3 register item 8).

**Realistic failure scenario — already in the gold set.** s4, **alverde Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan**: an unemulsified bulk-oil spray whose oil phase is sweet almond and argan. Neither is on the L3 rich band, so both read medium (§7.5's convention, §17.15); under the undefined "family" both count as **one** family; result `row: single_family` ⇒ WT `moderate` ⇒ `hair_thickness_fit.fine: conditional`. A two-phase oil spray is told to fine hair as "conditional" rather than "caution". FS-18 says in the standard's own words that a two-phase spray carries an oil phase by design.

**What must not be done.** §17.15 is right: do not extend the L3 band table on a reading convention. The escape must not touch the spreading-band science.

**Proposed conditional escape — a caution and a route, not a value change.**

> 1. **Define "family"** for §7.5, explicitly, as one of band / species / route, and state it once. (Recommendation: **band**, which is what the L3 table is organised by and what all three ambiguous records happened to use.)
> 2. **Add an unenumerated-oil-load clause.** Where the persistent non-volatile architecture is an **unemulsified bulk oil phase**, or two or more unenumerated vegetable oils present as architecture, and WT would otherwise read `moderate`: keep the value at `moderate` (the anchor governs, G14), **emit the fine-hair caution**, add `weight_potential` to `uncertain_fields`, and route to review (`unenumerated_oil_load`).
>
> The projected value does not move — the enumeration stops being the silent sole decider of the fine-hair prior.

---

### H11 — §3.2 E3 metadata requirement, post-T9

**What it decides.** Whether an exact-product instrumental test counts as E3 or is downgraded to E2 — which is the gate on `HEAT: product_tested` (§17.8) and `repair_support_level: high` (§17.25), the two permanently-empty states in the model.

**The defect.** §3.2 requires **ambient relative humidity** on every E3 record, with "(and temperature, for any humidity or frizz endpoint)" as the only scoping. **T9 removed HUM entirely — there is no humidity or frizz endpoint left anywhere in the model.** RH is now a mandatory field for endpoints it cannot affect.

**Realistic failure scenario.** A manufacturer publishes a DSC heat-protection study on the exact product, declaring dose, damp-vs-dry application, drying method, protocol, substrate, comparator and endpoint — but not the ambient RH of the lab, because RH is not a variable in a thermal-denaturation measurement. The rule downgrades it to E2. `provides_heat_protection` is unaffected (it is claim-led), but the trace state stays `claim_only` instead of `product_tested`, and the one thing that would ever move `repair_support_level` off `low` is refused on a non-causal metadata omission.

**Proposed conditional escape.**

> Scope requirement 4 the way the parenthesis already scopes temperature: **ambient relative humidity is required where the endpoint is humidity- or water-uptake-sensitive.** For an endpoint where RH is not causally relevant (thermal denaturation, breakage-after-ironing, tryptophan loss, combing force at controlled conditions), its omission is recorded as a `limitations[]` entry and **does not downgrade the record**. Requirements 1–3 (dose, damp vs dry, drying method) stay mandatory for every E3 record without exception — those three change the result in leave-on use regardless of endpoint.

**Honest calibration.** Decisiveness is zero today and stays zero until a product with E3 evidence appears. I flag it because it is post-T9 dead weight that will bite the *first* time the E3 path is used, and because §17.8 and §17.25 both name the emptiness of those states as an open question — this rule is one of the things keeping them empty.

---

## Recommended for the v1.0 freeze

### Adopt now — seven items

Cheap, no new science, each fixes a demonstrated confident-wrong output or a demonstrated missing escape route. Together they are roughly the size of the T16 amendment itself.

| # | Item | Why now |
|---|---|---|
| 1 | **H1 — vacuous-marker escape** (T16's mirror) | Same ruling shape as T16, and the standard already names the gap in its own §17.18. Adopting T16 without its mirror leaves the marker conditional in one direction and absolute in the other, which is harder to reason about than either extreme. The over-read direction (a token active into the highly-damaged tier) is more damaging than the under-read T16 fixed |
| 2 | **H2 — drop the allergen block from the marker list** | One line, and it is a **prerequisite for H1**: while the block can be a marker, the vacuity test collides with it on every preservative-free formula. It also restores limit 2 (`none_visible` + review) on the formulas it was written for. Observed on s4 |
| 3 | **H8 — add the `l9_member_without_claim` §14 trigger** | One line, no semantics change, and it closes the only place where the strongest formula evidence the standard recognises produces a confident negative with no human in the path. The mirror trigger already exists and fired 4× |
| 4 | **H3 — scope the rinse test to the application step** | The output (`excluded_other_form`, no lean profile) is the least recoverable in the standard and currently has **no escape whatsoever**. Both failing inputs — dual-use directions and the eye-safety sentence — are common on German packs and **neither appears in the gold set**, so waiting for the unseen test will not surface them reliably |
| 5 | **H9 — the T16 scope sentence + the "thin ≠ below-marker" clause** | Needed for T16 to be coherent with T15. Without it, T16 is a rule about R2 and every other marker-dependent decision keeps needing per-product adjudication. The clause is a scoping statement about a ruling Nick is making anyway |
| 6 | **H6 — key the buildup caution on WT `high` as well as PERS `high`** | A caution, not a value: G3 and G14 are untouched. Fixes a user-visible inversion observable on the current gold set (warning on the lightest product, silence on the heaviest) |
| 7 | **Housekeeping — name the tail-marker triggers in §14** | Five trigger names are in the reference key and none in the standard; 9 of 13 records route on them. Whatever T16 and H1 write must be nameable, or the escapes stay lane conventions and round 4 cannot diff them |

### Defer to the unseen-product test — five items

Each needs evidence the 13-product gold set structurally cannot provide, and each would move projected values rather than only adding a route.

| # | Item | What evidence it is waiting on |
|---|---|---|
| 8 | **H7 — L5 enumeration widening (PQ-4/-11/-44/-46/-69, styling copolymers), and closing §17.19** | Enumerate on a disagreement, not by analogy — the discipline v0.3 used for VP/Methacrylamide and Polysilicone-29. Needs a Föhnlotion/blow-dry-primer product in the test set. **Adopt clause 4 now if anything** (an unresolvable L5 placement routes to review instead of setting HOLD `none` silently) — that half is free |
| 9 | **H5 — single-mechanism smoothing escape** | The gold set contains no dedicated single-mechanism anti-frizz silicone spray. The escape changes `focus.primary` on a whole product shape and should be calibrated, not assumed |
| 10 | **H4 — `detangling` prong (i) consistency ruling** | This is a **product-policy call for Nick**, not a defect repair: T13a ruled that positioning does not create a route; applying that consistently to `detangling` moves focus values. Needs a heavy detangler in the test set to see which direction actually bites |
| 11 | **H10 — "family" definition + unenumerated-oil-load caution** | §17.15 correctly forbids extending the band table on convention. The three ambiguous gold-set records agreed by luck; the definition needs one record where the readings actually diverge before the choice is evidenced |
| 12 | **H11 — E3 metadata scoping** | Zero decisiveness until an E3 record exists. Adopt when the first product with instrumental evidence enters the set — or now, if Nick wants the E3 path open at freeze rather than blocked by a post-T9 vestige |

### Seeding recommendation for the unseen-product test (3–5 products)

The gold set's blind spots are specific, so the unseen test can close several at once if it is chosen deliberately rather than randomly:

1. **A long-list mass-market „Repair" leave-in cream** (45+ ingredients, late preservative, a cationised protein or silane mid-list) — the **only** way to exercise H1's over-read direction, `repair_support_level: medium` (§17.25) and `damage_fit` row 3b, none of which the current set reaches.
2. **A dual-use „Sprühkur"** with „im Haar lassen oder ausspülen" directions — exercises H3 and the `dual_use_directions` route.
3. **A Föhnlotion / blow-dry primer on PQ-4 / PQ-11 chemistry** — exercises H7 and the G0 styling gate's false-negative direction, which no current record tests.
4. **A dedicated single-mechanism anti-frizz silicone spray** — exercises H5 and §7.4.1 clause 2.
5. **A rich detangling cream for curly hair** with C3-only detangling positioning — exercises H4 in both directions.

A preservative-free naturkosmetik leave-in would additionally exercise H2 and §3.1.1 limit 2, and could substitute for any of the above if only four slots are available.

---

## Stop condition

This is a research audit of a research standard. Nothing here changes a catalog value, a recommendation rule, a Supabase row, user-facing copy or a production matcher, and none of the proposed escapes is adopted by being written down — each is a ruling for Nick (§19 stop condition, unchanged).
