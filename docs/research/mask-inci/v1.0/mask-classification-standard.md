# Mask Research and Classification Standard v1.0

Status: **logic locked — normative mask classification authority (Standard v1.0)**
Document version: `v1.0`
Engine version: `mask-inci-v1.0`
Logic lock: frozen on 2026-10-06 after calibration closed — cohort gate **97/97 value cells, zero value disagreements** between the sealed blind lane and the reference key on all twelve classified cohort products plus the #13 exclusion (`calibration-round-2-report.md` §1), and round 2.5 targeted validation **6/6 against pre-registered expectations** (same report §5; `data/research/mask-inci/v1.0/round2p5-preregistered-expectations.md`). Lock receipt: `data/research/mask-inci/v1.0/v1.0-logic-lock-receipt.json`
Supersedes: `mask-inci-v0.6` — the draft this version promotes unchanged. Its exact bytes are preserved as `mask-classification-standard.v1.0-rc1.md` (the reviewed source snapshot) and, under the filename retained since v0.1, as `mask-classification-standard.v0.1.md`; the v0.1 text itself is `mask-classification-standard.v0.1-archive.md`
Pre-freeze version history: 0.6 (round-1 rule rulings R1–R9, the round-1b escalation rulings **E1–E4 and E6, 2026-09-14**, the round-2 escalation rulings **E7–E11, 2026-09-30**, **E12 (tail protein cluster), 2026-10-05**, then the round-3 seam rulings **E13–E17, 2026-10-06**). **v0.6 supersedes v0.5 (2026-10-06); v0.5 superseded v0.4 (2026-10-05); v0.4 superseded v0.3 (2026-09-30); v0.3 superseded v0.2, which superseded v0.1, all 2026-09-14.**
Scope: rinse-out intensive masks/Haarkuren (Maske, Kur, Intensivkur, Express-Kur, Bond-Kur, Gloss-/Laminier-Kur), Germany/EU market, per `00_category_charter.md`
Normative source: this Markdown file. From v1.0 the normative path is `mask-classification-standard.md`; `mask-classification-standard.v0.1.md` is retained unchanged as the historical draft path and is no longer normative
Drafted: 2026-09-04 · Revised: 2026-09-14, 2026-09-30, 2026-10-05, 2026-10-06 · Frozen: 2026-10-06

## Version

**v0.6 → v1.0: freeze, no rule changes (2026-10-06).** The rule text below is the v0.6 draft, promoted **unchanged**: no anchor, threshold, enumeration, gate, projection, evidence bar, review trigger or string was edited by the promotion. What changed is version identity and lock status — this preamble and the header block above. `mask-classification-standard.v1.0-rc1.md` is the **reviewed source snapshot**: byte-identical to the v0.6 draft as it stood at freeze (including the two round-2.5 triage codifications, which moved no value), and identical to this file minus this header block and this Version section.

**What the lock covers.** The reusable classification logic of the mask engine: the G0 boundary and its three stop values, the tail-marker and boundary-position conventions, the nine-field comparison profile (`conditioning_level`, `weight_potential`, `care_direction`, `repair_support_level`, `primary_focus`, `secondary_focus` and the echo fields `hair_thickness_fit`, `damage_fit`, `texture_fit`), the trace-level `bond_route` and `hinweise` record, vocabulary, anchors, thresholds, evidence ceilings, gates and the reasoning contract. It does **not** approve an individual product and does **not** authorize catalog, database, matching-policy, Product Intake or production use — the charter's stop condition still binds. The production projection is a separate, deterministic adapter documented in `docs/product-intake-mask-production-adapter.md`.

**Retained pre-freeze text, named so no reader mistakes it for a live obligation.** The body below still reads as the draft it was when calibration closed — *What this draft is not* ("It is not locked, not calibrated, and carries no repeatability claim"), the *Rerun obligation* paragraph, §15's calibration rule written as a future obligation, and §18's open questions for the first-set review. That wording is retained deliberately so this file and the reviewed rc1 snapshot stay diffable to the header block alone. **This Version block is the authoritative statement of freeze status**: the cohort gate has been run and passed on values with zero disagreements, the seams it surfaced were ruled (E13–E17) and validated in round 2.5, and calibration is closed (`calibration-round-2-report.md` §6). Every open question §18 lists stays open under v1.0 exactly as listed.

**Freeze notes carried into v1.0** (also recorded in the lock receipt's `known_limits_retained`):

1. **E15 / `balanced` reading (b) is validated on exactly one product** — the unseen record u3 (John Frieda Wunder-Kur, `care_direction: balanced` / `neither_dominant`). Round 2.5 surfaced no second natural reading-(b) candidate on the shelf pass.
2. **Independence caveat on the cohort rerun.** The standard's own ruling notes (E2/E7/E10/E11/E12 annotations) name several cohort products and their outcomes, so the cohort rerun on those fields is confirmation-grade rather than perfectly blind; the unseen set and round 2.5 compensate (`calibration-round-2-report.md` §1).
3. **G0 stops are first-class outcomes.** `insufficient_information` (the q3 Syoss Intense Repair case: no rinse text anywhere in the exact-product source) and the charter exclusions (#13 Olaplex N°3, u5 Olaplex N°3PLUS, u6 Balea Silberglanz) are correct engine results, not failures. A stopped or excluded record carries no profile and is never forced through the mask ontology.

**What changed in v0.6 (E13–E17, 2026-10-06).** Calibration round 2 (`calibration-round-2-report.md`) passed the cohort gate and surfaced five seams S1–S5; Nick ruled all five, recorded in `plans/mask-inci/round1-rule-rulings.md` ("Escalation rulings (round-3, 2026-10-06)"), which is binding. **E13** (S1) replaces §3.1.1's architecture clause with the leave-in v1.0 clause-5 mechanism: a marker is plausible when every species *establishing* `conditioning_level`/`weight_potential` outranks it; conditioning-relevant extras at or below the marker never make it implausible — they earn nothing, carry a `candidate_below_tail` note and route to review where they would otherwise have qualified an anchor. **E14** (S2) adopts three triglyceride bands: heavy (butters, lanolin, coconut, castor) = R4b; **mid** (olive, argan, soy, apricot, sunflower, macadamia and similar liquid plant triglycerides) blocks `weight_potential: low` but can never alone establish `high`; light (esters, caprylic/capric triglyceride, jojoba, squalane) = R4a. Olive and argan, previously named heavy, are corrected to mid. **E15** (S3) rules that Dipropylene Glycol and carrier/solvent glycols of its class are solvents, not humectant-leg species, for §9.3 and §9.5.3, and fixes §9.3's reading-(b) confidence sentence: reading (b) is simply unavailable when any of its four clauses fails. **E16** (S4) gates the `repair` headline: a qualifying `bond_route`, **or** a protein route strong on the label (≥ 2 distinct qualifying hydrolyzed-protein species above the marker, or one quaternized/cationic protein derivative above the marker); a single plain hydrolysate keeps its §9.3/§9.4 values but not the headline. **E17** (S5) makes formula-level G0 exclusions mode-independent. Four round-2 triage readings are codified as operational notes (no ruling IDs): "nasses Haar" satisfies the post-cleansing conjunct (§2.1); the booster-above-preservative limb tests only orderings involving the marker species itself (§3.1.1); G0 gains an `insufficient_information` stop value (§2.1); the E1 boundary note on a full-list conjunct is informational (§13.1). **Every passage changed by a round-3 ruling is marked `(E<n>, 2026-10-06)`; operational notes are marked `(round-2 triage, 2026-10-06)`.** E13 and E17 move no cohort or unseen value (both lanes already read this way). E14, E15 and E16 are systemic rule changes; each moves exactly one unseen value (u2 weight `high` → `moderate`; u3 `care_direction` `moisture` → `balanced`/`neither_dominant`; u1 `primary_focus` `repair` → `general`) and **no cohort value** (reference-key-v1 is untouched; the one near-miss — #08's sunflower oil @17, mid band, which sits in the tail under the R8 marker `Leuconostoc/Radish Root Ferment Filtrate` @15 — is recorded in `calibration-round-2-report.md` §3). The three affected unseen records are re-derived, not patched.

**What changed in v0.4 (E7–E11, 2026-09-30).** Nick ruled five open adjudication points from the v0.3 cohort, recorded in `plans/mask-inci/round1-rule-rulings.md` ("Escalation rulings (round-2, 2026-09-30)"), which is binding. **E7** counts §9.2's leanness conjunct 3 ("a single cationic species") on the **full INCI list**, not the above-tail segment. **E8** rules that R3's tail-edge exclusion does **not** reach §9.3's material-R5 protein test: following E1, a `tail_index − 1` species counts normally there and costs confidence, not credit — one uniform boundary-position principle across §9.1, §9.2 and §9.3. **E9** rules that §9.3 reading (b) clause 2 requires a silicone **system** (≥ 2 distinct R2 silicone species above the tail, or one plus a corroborating R3/R6a route); a single silicone species is not one. **E10** makes a `moisture` secondary available under a step-8 `general` primary, not only under a richer winning route (§9.5.2 secondary rule; §9.5.3 criterion 3). **E11** is a **product-level** human resolution of one unresolved marker (#02, reading B) under §14 `tail_marker_unresolved`; it changes **no** rule text — the general R2 rule that unresolved markers route to human review is unchanged. **Every passage changed by a round-2 ruling is marked `(E<n>, 2026-09-30)`.** E7, E9 and E10 are systemic (they change rules every record's fields 2, 3 and 6 read), so the rerun obligation runs again from v0.3 to v0.4.

**What changed in v0.3 (E1–E4, 2026-09-14).** The v0.2 regeneration applied R1–R9 honestly and flagged five mismatches against the ruling ledger's expected effects; Nick ruled on all five in a round-1b escalation interview, recorded in `plans/mask-inci/round1-rule-rulings.md` ("Escalation rulings (round-1b)"), which is binding. **E1** replaces R3's tail-edge *exclusion* with a **confidence cap**: a species at `tail_index − 1` counts normally toward S1/S2/S3 and toward every other field's evidence, and any value whose threshold depends on it is capped at `moderate` confidence and carries a `hinweise` note. **E2** adds a third implausibility limb to §3.1.1 — a marker whose class ordering is internally inconsistent with the rest of the list (the worked case: a declared fragrance allergen ranked far above `Parfum` itself). **E3** accepts `balanced` / `neither_dominant` on Pantene #07 as a positive architecture finding, recorded as §9.3's worked example; no rule text changes. **E4** makes `weight_potential: low` reachable for creams by deleting the structural fatty-alcohol condition from the leanness test. **E5** is folded into E1: the boundary-species treatment is **field-uniform**. **Every passage changed by an escalation ruling is marked `(E<n>, 2026-09-14)`.** R1–R9 and their `(R<n>, 2026-09-14)` marks stand except where an `(E<n>)` mark supersedes them on the same question.
**What E6 changed, added to v0.3 without a version bump (E6, 2026-09-14).** E6 is a round-1b escalation ruling of Nick's, recorded in the same binding ledger, and it is applied into this same v0.3 document because it revises rules E4 had only just made reachable. **`lightness` is removed from the mask `primary_focus` / `secondary_focus` vocabulary entirely.** The vocabulary is now **eight** values — `moisture` · `detangling` · `smoothing` · `repair` · `shine` · `curl_support` · `color_care` · `general` — and §9.5.2's step-3 `lightness` route is deleted with it. Nick's ground: **masks are not bought for lightness**, and `weight_potential: low` already owns that information, so a focus headline saying "light" spends the product's one forced headline on something no user shops for and duplicates a field the profile already carries. E6 also rules that **E4's leanness test applies uniformly** across the cohort — every record whose formula satisfies the three conjuncts reads `low`, not only the one record E4's expected-effects column happened to name. The two halves are one ruling: E4 applied uniformly reaches several lean masks, and E6 is what stops that reach from rewriting their headlines. **Every passage changed by E6 is marked `(E6, 2026-09-14)`.** This closes former §18 open question 13 (`lightness` focus reachability) and creates a deliberate divergence from the conditioner focus vocabulary, recorded as a conditioner-parity delta in §16.1 row 7a.

Superseded version: `mask-classification-standard.v0.1-archive.md` — a byte-identical copy of v0.1, retained as provenance for records derived before 2026-09-14

**What changed in v0.2 (R1–R9, Nick, 2026-09-14).** Nine rule-level questions were settled before per-product review so the whole cohort re-derives consistently; the ruling ledger is `plans/mask-inci/round1-rule-rulings.md` and is binding. **R1** corrects the charter's Guhl boundary case — mode-scoped eligibility is decided by the directions test, and the principle is "no **mode** is profiled twice", not "no product". **R2** adopts the leave-in T16 plausibility conditional for the tail marker. **R3** fixes three evidence defects in `conditioning_level: high` (S1 mandatory, no tail-edge signal carriage, the counter-signal conjunct made operative) — explicitly **not** a distribution target. **R4** gives `weight_potential` its own evidence: the cationic gate comes off `high`, and `low` becomes a positive leanness test. **R5** makes the moisture-focus lipid-led guard operational (focus only; `care_direction` untouched). **R6** replaces `balanced` with the two-readings rule aligned to leave-in T19. **R7** restates the v1.5 tie-break discipline. **R8** adopts the leave-in housekeeping block whole: the conservative-failure invariant (§1.1), T18 source-conflict precedence (§2.4.1), the always-emitted `hinweise` record (§13.1), the lexicon patches, and the G0 placement default. **R9** marks fields 7–9 as echo fields on the T8 pattern. **Every passage changed by a ruling is marked `(R<n>, 2026-09-14)`.** Every `[judgment call — review]` annotation the rulings did not resolve is retained verbatim.

**Binding upstream inputs.** `00_category_charter.md` (boundary rulings F1–F4, exclusions, evidence boundary, coverage target) and `01_property-set-v0.md` (nine-field shape, rulings D1–D6, moisture-focus guard, `bond_route` rule, watch-list) are **ruled by Nick and binding**. This standard operationalizes them; it may not widen, narrow, or reinterpret them. Where this standard adds an anchor, threshold, or operational test that the ruled inputs did not fix, that addition is marked **[judgment call — review]** and listed again in §16.

**Where a later ruling supersedes an earlier one (R1–R9, 2026-09-14).** R1 corrects a charter line and R6 amends D6's `balanced` wording. A later dated ruling by Nick governs over an earlier one on the same question; this standard records both, names the superseding ruling, and never silently rewrites the earlier text. `01_property-set-v0.md` still carries D6's v0.1 wording — reconciling that file is **out of scope** for this revision and is carried as an open item (§18.9).

**What this draft is not.** It is not locked, not calibrated, and carries no repeatability claim. Its anchors are provisional under Nick's "first set, then adjust" caveat (`01_property-set-v0.md` status line). It approves no product, activates no catalog field, writes nothing to Supabase, and changes no recommendation, matcher, intake rule, or user-facing copy (charter stop condition).

**Rerun obligation (R1–R9, 2026-09-14; extended E1–E4, 2026-09-14).** R1–R9 are **systemic** rule changes, so §15's "systemic rule changes require a pilot rerun" applies in full: no agreement, repeatability, or distribution statement made under v0.1 carries into v0.2. Records derived under v0.1 must be re-derived, not patched. **(E1–E4, 2026-09-14)** E1 and E4 are likewise systemic — they change a rule that every record's field 1 and field 2 read — so the same obligation runs again from v0.2 to v0.3, and no v0.2 agreement or distribution statement carries into v0.3. **(E6, 2026-09-14)** E6 is systemic for the same reason: it removes a value from field 5's vocabulary and deletes a step from the hierarchy every record's field 5 and 6 run. No agreement, repeatability or distribution statement made before E6 carries past it, and records re-derived under E4/E6 must be re-derived, not patched. **(E7–E11, 2026-09-30)** E7, E9 and E10 are systemic (fields 2, 3 and 6), so the obligation runs again from v0.3 to v0.4; E8 confirms an existing E1 consequence and E11 is a single-record human resolution, neither of which changes a rule any other record reads. **(E13–E17, 2026-10-06)** E14, E15 and E16 are systemic (fields 2, 3 and 5); E13 and E17 codify readings both calibration lanes already applied. Every record whose value an E14/E15/E16 rule reads is re-derived under v0.6; on the frozen cohort no value moves, on the unseen set u1, u2 and u3 are re-derived (`rederivedUnder: "mask-inci-v0.6 (E13-E17)"`).

---

## 1. Purpose

This standard converts one exact market mask — exact product, exact pack/formula version — into an auditable research record. It separates:

1. formula observations (what the INCI literally says);
2. plausible direct mask routes and direct properties (what might follow);
3. finished-product evidence (what was actually measured on this product);
4. profile-specific fit (which hair groups this product is a broad prior for).

It does not turn ingredient names into universal good/bad labels, does not diagnose a user's protein, moisture, or damage state, and does not replace a formulation test, consumer study, clinical evaluation, or catalog decision.

**Category-relative reading.** Every value in this standard is anchored *within the mask shelf*, not across all rinse-out products. Masks sit higher on the same lamellar-gel-network continuum as conditioners (evidence §1). A formula that would read `high` conditioning as a conditioner may read `moderate` as a mask. Reviewers must hold the mask reference distribution in mind; the `moderate` bucket is expected to hold the majority of the shelf, and that is an accepted outcome (evidence §8), not a failure of the scale.

**Architecture is not the category.** A blind INCI read cannot reliably tell a mask from a conditioner (evidence §1). The category is decided at G0 from product metadata and authoritative directions, never from the ingredient list. This engine is the conditioner architecture run with a shifted richness prior and a mask-specific route and focus layer.

### 1.1 The conservative-failure invariant **(R8, 2026-09-14 — adopted from leave-in T17/§1.1)**

Every hard rule in this standard — every threshold, closed enumeration, gate, marker convention and counting rule — must fail in exactly one of two directions when its own input is implausible, absent, or otherwise untrustworthy: **toward human review, or toward the anchor's own conservative value.** A hard rule may never fail toward a recommendation, an upgrade, or any value that reads more favourably to a user than the evidence supports.

This is not a new rule. It is the shape the mask standard already gave several of its own fallbacks — D1's "never encode unresolved uncertainty as an extreme" (§9.1), the NEQI weight fallback (§9.2), G5's smallest-affected-scope rule, and the `general` focus fallback (§9.5.2 step 8) — stated here once, generally, as the test every future rule change must pass before it is adopted. **A proposed rule or amendment that can be shown to fail toward a confident, more-favourable value on a plausible German-market input does not clear this bar, however cheap or well-motivated it otherwise is.**

Three consequences are binding across the whole document:

1. **An implausible input can neither qualify nor disqualify.** R2's tail-marker plausibility conditional (§3.1) is the primary instance: an implausible marker may not push a value *down* (it cannot disqualify a route that sits "below" it) and may not push a value *up* (nothing is credited as above-tail architecture solely because it outranks an unreliable marker). Plausibility is a precondition of the marker being read at all.
2. **"Unresolved" means review, never a default good answer.** Every `unresolved`/`unknown` state in this standard routes to a named §14 trigger and caps confidence; none of them may resolve silently toward a higher `conditioning_level`, a richer `weight_potential`, a specialist `damage_fit`, or a `repair_support_level` above what the named evidence earns.
3. **The two `low`/`high` extremes are asymmetric by design.** `high` on any field requires positive, converging evidence (D1). `low` on `weight_potential` is a *positive leanness test* (§9.2, R4) precisely so that "we could not find richness" cannot masquerade as "this is a light product" — an absence-based `low` would fail toward a more favourable fine-hair fit.

**Conformance check for R1–R9.** R2 fails to `unresolved` + review. R3 removes two paths on which `high` could be reached without converging evidence. R4's `high` requires a positive heavy-lipid core and its `low` requires a positive leanness test. R5 only *disqualifies* a headline, never creates one. R6's `balanced` readings are positive architecture reads whose own failure paths step confidence down and route to review. R7 permits a tie-break only on a verdict that is already `dual_supported` and still forbids upgrading `nonspecific`. R8's §2.4.1 tier 2 fails to `unknown` + review. R9 changes a review surface and no value at all. All nine clear §1.1.

---

## 2. Category and identity gates

### 2.1 G0 — charter boundary (binding, charter F1–F4 and exclusions)

Classification stops before formula analysis unless the product is **eligible** under the charter.

**Eligible** — the product's authoritative directions describe a rinse-out intensive treatment applied after cleansing, with a product-stated contact time, then rinsed out. The research unit is the exact market product, pack/formula version, never a brand line or marketing name.

**Placement is not a G0 conjunct (R8, 2026-09-14).** "To lengths and ends" was written into v0.1's eligibility test as a required conjunct. It is removed as a conjunct: **where the directions are silent about placement, the product takes the P5 canonical placement (Längen und Spitzen, Ansatz aussparen) by default and remains eligible.** Silence about placement is the normal state of a German mask pack, and treating it as a failed conjunct made G0 fail toward exclusion on a bookkeeping absence rather than on evidence (§1.1). Two boundaries are unchanged: directions that **explicitly** direct whole-head or root application ("im ganzen Haar verteilen", "in die Kopfhaut einmassieren") still contradict P5, still fire the root/scalp review trigger, and still create no scalp property (R8, §5); and directions that place the product somewhere **incompatible with the category** (a pre-shampoo-only step, a leave-on step) still exclude at G0 on their own terms. The three surviving G0 conjuncts are therefore: **after cleansing · product-stated contact time · rinsed out.**

**Operational note — rinse evidence from the exact-product source (round-2.5 triage, 2026-10-06).** The *rinsed out* conjunct is satisfied by the manufacturer's own usage statement **anywhere in the exact-product source** (the Anwendungshinweis block, or a usage sentence in the same page's product description), not only by the labelled directions block — retailer pages routinely truncate the directions block while stating the rinse a paragraph above. A record whose rinse evidence comes from outside the directions block carries the `product_form_ambiguity` review trigger. Where **no text in the exact-product source** states the rinse, G0 stops at `insufficient_information` (the Syoss Intense Repair case, round 2.5): the engine never infers a rinse from "einwirken lassen" alone.

**Operational note — wet-hair directions (round-2 triage, 2026-10-06).** Directions that place the product on **"nasses Haar"** / **"feuchtes Haar"**, state a rinse-out, and carry **no pre-wash positioning** for that mode satisfy the *after cleansing* conjunct. German mask packs routinely say "ins nasse Haar" without repeating "nach der Haarwäsche"; wet hair at a rinse-out step is the post-wash state. A mode that is explicitly positioned before shampooing ("Pre-Wash", "vor der Haarwäsche", "anschließend mit Shampoo waschen") is not covered by this note and still fails the conjunct.

**Operational note — G0 stop values (round-2 triage, 2026-10-06).** G0 has three outcomes, not two: **`in_category`** (classify, mode-scoped where §2.2 applies); **`excluded_product_form`** with its charter reason (e.g. `excluded_color_depositing`, `excluded_pre_shampoo_bondbuilder_protocol`) — a charter exclusion, no profile, kept as boundary evidence; and **`insufficient_information`** — an **identity/evidence stop, not a charter exclusion**: the product may well be in the category, but the packet does not carry enough to decide (unpinned variant, missing or truncated INCI, no authoritative directions, §2.2 step-5 ambiguity). It produces **no profile** and routes to **evidence work** (a fresh capture), never to a boundary ruling. A record must never encode an evidence gap as `excluded_product_form`, nor a charter exclusion as `insufficient_information`.

Explicitly in scope:

| Charter ruling | Included | Operational note |
|---|---|---|
| **F1** | Multi-use products (3in1/2in1) — **mode-scoped** | Eligible when authoritative directions state a distinct rinse-out mask mode with dwell. Only that mode is classified. |
| **F2** | Express Kuren at **every** stated dwell duration (7 sec, 30 sec, 1 min, …) | Marketed form and the `intensive_conditioning_mask` role decide. Dwell is protocol metadata under P5 and is **never** a boundary test. |
| **F3** | Bond-claim drugstore masks (Plex/Bond positioning) | The bond route is claim-gated (R7). `repair_support_level: high` requires named chemistry visible in the reviewed formula. |
| **F4** | Gloss/lamination rinse-out treatments | Treated as shine-focused masks. Lamination/acid-gloss claims stay claim-gated and conservative. There is **no** lamination property (§5, R6a; evidence §7). |

**Excluded** (charter; each maps to `excluded_product_form` and produces **no** profile):

- leave-on-only "masks" and overnight treatments (leave-in / bondbuilder territory);
- pre-shampoo-only treatments;
- products in the `bondbuilder` catalog category with specialist protocols (Olaplex-style);
- color-depositing masks, scalp/medicated treatments, salon back-bar chemistry;
- ampoule/shot formats **unless** the directions are post-shampoo rinse-out with dwell;
- a multi-use product **none of whose** stated rinse-out modes clears the three G0 conjuncts — for example a product whose only rinse-out mode is an immediate-rinse **conditioner/Spülung** mode with no stated contact time. **(R1, 2026-09-14 — rewritten.)** v0.1 listed Guhl Panthenol + Reparatur 2in1 Kur & Spülung here as the worked example of this exclusion. That was wrong on the facts: its directions state a distinct **2–3-minute Kur mode**, which clears the conjuncts, so the product is **eligible, mode-scoped** (§2.2). The exclusion itself stands; only its example was mistaken.

**No MODE is ever profiled twice (R1, 2026-09-14 — restated principle).** v0.1 stated this as "no *product* ever receives two engine profiles", and that phrasing is what produced the Guhl error: it forced a whole multi-mode product to one engine, so a genuine Kur mode had to be argued away to protect a Spülung profile that lives in a different engine. The correct principle is **mode-scoped**: a multi-mode product may hold **one profile per engine**, each covering exactly one mode, and **no single mode may be profiled by two engines**. A Guhl-style 2in1 may therefore carry a Conditioner-engine profile for its Spülung mode *and* a Mask-engine profile for its Kur mode; those are two modes, not two readings of one mode. This is consistent with — and forward-compatible with — the cross-category multi-row architecture Nick parked (charter). Excluded rows stay visible as boundary evidence and stress cases; they are never forced through the mask ontology.

### 2.2 G0 multi-use variant (charter F1) — eligibility is read from directions, not from the jar

For a product with several stated modes, the engine classifies **use, not jar**.

1. Locate the **authoritative directions** for the exact pack (source hierarchy §2.4). Marketing names ("3 in 1", "Kur & Spülung") never decide.
2. Test each stated mode against §2.1. A mode qualifies as a mask mode when the directions place it **after cleansing**, with a **stated contact time**, followed by a **rinse**. **(R8, 2026-09-14)** Placement is no longer a conjunct here either: a mode silent on placement takes the P5 canonical placement by default; a mode whose directions explicitly place it at the roots/whole head fires the root/scalp trigger and is a P5 deviation, not an automatic disqualification.
3. If **exactly one** mode qualifies → classify only that mode. Record `multi_use: true` and name the uncovered modes.
4. If **no** mode qualifies → `excluded_product_form`, with the reason recorded (e.g. no-dwell-rinse-mode-only, leave-on-only).
5. If the directions are ambiguous about which mode carries the dwell, or the modes cannot be separated → do **not** guess. Set identity state `insufficient_information`, fire the `multi_use_directions_ambiguity` review trigger (§14), and stop.

**A qualifying Kur mode inside a self-labelled 2in1 is in scope (R1, 2026-09-14).** A pack that sells itself as "2in1 Kur & Spülung" — or as anything else — does not thereby leave the category. Step 2 is applied to each stated mode on its own terms, and a **2–3-minute Kur mode with a stated dwell and a rinse is a mask mode**, whatever the front of pack calls the product and whatever other mode sits beside it. The worked case is **Guhl Panthenol + Reparatur 2in1 Kur & Spülung**: its Spülung mode is an immediate-rinse conditioner mode and does not qualify; its Kur mode states 2–3 minutes and does. So the product is **eligible, mode-scoped**, with `multi_use: true`, `multi_use_covered_mode: post_shampoo_rinse_out_mask`, and `multi_use_uncovered_modes: ["conditioner"]`. Its Conditioner-engine profile for the Spülung mode is **untouched and not in conflict** — that is a different mode, and the §2.1 principle forbids profiling one *mode* twice, not one product (R1). Where **both** modes would qualify as mask modes, the directions cannot be separated into exactly one covered mode: that is step 5, `multi_use_directions_ambiguity`, not a licence to classify both.

**Formula-level exclusions are mode-independent (E17, 2026-10-06, binding).** Mode scoping selects which **directions** are evaluated; it **never** overrides a charter product-form exclusion that rests on the **formula** itself — colour-depositing pigment chemistry, or bond-builder chemistry used under a specialist protocol. Such an exclusion applies to the **whole product in every mode**: a pigment deposits colour whichever mode the user follows, so a qualifying Kur mode on a silver/colour-depositing 2in1 does not bring that product into scope. Step 2 is therefore applied only to products that clear every formula-level exclusion first. Exclusions that rest on the **directions** (pre-shampoo-only, leave-on-only, no-dwell rinse modes) remain mode-scoped exactly as above. Worked case: **u6 Balea Silberglanz 2in1** (`CI 60730`) — its Kur mode clears the three conjuncts, and the product is still `excluded_color_depositing` wholesale; the round-2 lane's choice is codified, not changed.

**`multi_use` flag semantics** (research envelope, trace level):

```text
multi_use: true | false
multi_use_covered_mode: "post_shampoo_rinse_out_mask"     # always this, when true
multi_use_uncovered_modes: ["leave_in", "conditioner", ...] # verbatim from the directions
multi_use_directions_source_id: <source id>
```

`multi_use: true` means: *this profile describes only the rinse-out mask mode of a product that also has other stated modes.* It is a scope declaration, never a quality signal, never a penalty, and never an input to any comparison field. Cross-category multi-row architecture (one 3in1 spawning sibling rows per category) is **parked out of scope** by Nick (charter). Mode-scoped classification is forward-compatible with it.

Live boundary cases already identified (charter, 2026-09-04; Guhl row corrected **R1, 2026-09-14**): Garnier/Fructis Hair Food line, Balea 3 in 1 Intensivmaske, Isana 3in1, Balea Aqua Hyaluron 3 in 1 → eligible, mode-scoped. **Guhl Panthenol + Reparatur 2in1 Kur & Spülung → eligible, mode-scoped on its 2–3-minute Kur mode** (v0.1 recorded this as excluded; superseded). Pantene Pro-V Serum Shot → eligible **only** if directions show post-shampoo rinse-out with dwell. Bali Curls Bonding Repair Overnight Elixir → excluded.

### 2.3 Identity gates

Classification stops before formula analysis unless all of the following are known:

- exact catalog product UUID;
- exact brand and product name;
- Germany/EU market;
- pack size or an explicit unknown;
- one reliable identifier or a documented identity-research gap;
- dated exact-market formula source;
- raw INCI;
- product-form status (§2.1/§2.2 resolved);
- source/formula conflicts;
- **the authoritative directions text** carrying the mode, contact time and rinse (mask-specific — §2.2 and P5 both depend on it). **(R8, 2026-09-14)** Placement is recorded when the directions state it and defaults to the P5 canonical placement when they do not; its absence no longer blocks the identity gate.

Allowed identity states (inherited from Conditioner §2):

`verified` · `verified_with_minor_source_difference` · `provisional_formula_conflict` · `provisional_identity_conflict` · `insufficient_information` · `excluded_product_form`

A GTIN may survive reformulation. Formula identity and product identity are related but separate. A conflict that changes only one property makes that property `unknown`; it blocks the whole analysis only when the dominant architecture cannot be resolved.

### 2.4 Input authority hierarchy

1. exact pack/label for the exact product identifier;
2. current exact local-market (DE) manufacturer source;
3. preferred exact-product retailer source (exact GTIN);
4. reputable fallback/corroboration.

Never merge lists across product identifiers, sizes, markets, or versions. Retain divergent retailer transcriptions as provenance rather than averaging formulas.

### 2.4.1 Formula-set conflicts between same-market captures — convergence, then the conservative fallback **(R8, 2026-09-14 — adopted from leave-in T18/§2.4.2)**

§2.4 ranks sources and G5 preserves conflicts, but neither says **how to decide which of several disagreeing captures of the same German-market unit is the formula of record.** Without that rule two reviewers split predictably: one abstains on every affected field, the other classifies from whichever capture the packet happened to freeze as primary. The second reading is a source preference wearing a procedural disguise, and the leave-in unseen test proved the frozen primary can itself be the outlier. The rule is stated in two tiers.

**What counts as a conflict here.** A **formula-set conflict**: two or more independent captures of the same nominal German-market SKU disagree on **which species are declared**. Ordering differences alone, and differences that are only the granularity of a fragrance/allergen declaration (one source itemising aroma chemicals another leaves inside `Parfum`), are **not** set conflicts. A set conflict on the above-tail architecture, on a functional species, or on any species a §9 field reads is what this clause governs.

**Tier 1 — convergence resolution (primary).** A set conflict is **resolved** when all three hold:

1. **at least three independent sources** return the **identical ingredient list in identical order**;
2. **at least one of the three is a GTIN-anchored German retailer capture** — the GTIN visible on the page or in its URL/markup, never inferred from the product name;
3. **the manufacturer's own printed formula markers match across them where visible** (formula prefixes, F.I.L. fragrance codes). **A trailing revision digit difference does not break the match** (`C240136/1` vs `C240136/2` is the same fragrance declaration); a different code *family* does.

Where the bar is met, **that convergent list is the formula of record**, and:

- the packet's primary capture is **(re-)anchored to it via a dated amendment-log entry** — never silently;
- every outlier capture is **demoted to an additional capture with a note stating why**, and **never deleted** (G5's preserve-don't-resolve discipline is unchanged: demotion is a ranking, not a deletion);
- identity state becomes **`verified_with_minor_source_difference`**, not `verified`;
- **confidence on every affected §9 field drops one step** below what a single clean capture would have earned;
- the record carries the `formula_conflict_convergence` review trigger (§14), so a human still sees the residual;
- **classification then proceeds from the convergent list normally — no blanket `unknown`s.** Resolving the conflict is the point; a resolved conflict is not re-punished by withholding the values it decided.

**Tier 2 — conservative fallback.** Any set conflict that **cannot** reach that bar: the affected fields take **`unknown`**, the record carries the named **`formula_source_conflict`** trigger (§14), and it **routes to human review**. A tier-2 record is not publishable as a research profile beyond its identity block, and — consistent with the charter stop condition — nothing derived from it may be proposed for any downstream use until the conflict is resolved, whether by a fresh exact-pack capture or by later reaching tier 1's bar.

**The reading this clause explicitly rejects.** Classifying from whichever capture the packet froze as primary is **not** an admissible resolution. A capture's position in a packet is a bookkeeping fact, never evidence about the formula. (This narrows, and does not contradict, G5: G5 governs how far a conflict's scope reaches; this clause governs which list is read in the first place.)

**Scope boundary — same market only.** This clause governs conflicts **between captures of the same German-market unit**. A genuine **cross-market** formula difference (a non-German formula that really differs) is an identity question under §2.4, not a convergence question: three non-German sources agreeing with each other say nothing about the German-sold unit, because they are evidence about a different product. Never resolve a cross-market difference by convergence counting.

**§1.1 conformance.** Tier 2 fails to the conservative value and to review. Tier 1 is an evidence resolution, not a recommendation-ward failure: it takes the reading three converging sources support, keeps the outliers on file, lowers confidence, and still routes to a human.

**[judgment call — review]** The three-source count and the German-retailer/GTIN requirement are adopted from leave-in T18 unchanged; whether a drugstore mask shelf with thinner retailer coverage can routinely reach a three-source bar is a calibration question (§18.10).

### 2.5 Protocol boundary (owned by TPL-MASK / P5 — not by this engine)

This engine never produces protocol values, and protocol values never produce comparison properties. TPL-MASK owns:

- placement **Längen und Spitzen, Ansatz aussparen**;
- canonical conditioner relationship **`replaces_conditioner`** — on a mask day the mask takes the conditioner slot. `conditioner_after` requires an explicit sourced sequence;
- **contact time is a required per-product slot**, taken from the packaging **with a source**. It is **never** derived from INCI. A stamp without a sourced contact time is invalid and must not be published.

This standard records the sourced contact time as protocol metadata for traceability only. It carries **zero classification credit** (§7.2).

---

## 3. Evidence scale

Inherited from Conditioner §3 verbatim in substance.

| Level | Meaning | Permitted use |
|---|---|---|
| E0 | Product name, marketing claim, unsupported secondary statement, or no usable evidence | Record claim only; no direct property |
| E1 | Verified exact-formula observation: ingredient present/absent, literal rank, declared exposure | Formula fact only |
| E2 | Plausible architecture or mechanism inference from the complete formula and product form | Candidate route / direct-property **potential**, always provisional |
| E3 | Exact finished product tested instrumentally under a stated protocol | Endpoint-specific product property |
| E4 | Controlled human-use or blinded trained-sensory evidence for the exact product | Endpoint-specific product/user-perception evidence |
| E5 | Strong replicated or consensus finished-product evidence relevant to use | Strong endpoint-specific conclusion |

**INCI-only classification never exceeds E2.** Every mask profile produced by this standard in v0.1 is an E2-ceiling document. Reviewer agreement measures repeatability of the rules, not truth.

**EU Article 19 rank semantics.** Ingredients above 1% are listed in descending order; ingredients below 1% may appear in any order. **The 1% boundary is not visible.** Never infer exact percentages, ratios, pH, molecular weight, droplet size, deposition amount, viscosity, manufacturing process, or active dose from a consumer list. Rank is used **qualitatively** (structural position), never as a concentration claim.

### 3.1 The fragrance/preservative tail marker rule

Because Art. 19 hides the 1% boundary, this standard uses a conservative, reproducible proxy for "structurally material" versus "trace".

**Definition.** `tail_index` is the one-based position of the **earliest** ingredient belonging to any tail class:

- fragrance: `Parfum`, `Fragrance`, `Aroma`;
- declared fragrance allergens: `Limonene`, `Linalool`, `Citronellol`, `Geraniol`, `Citral`, `Coumarin`, `Hexyl Cinnamal`, `Benzyl Salicylate`, `Benzyl Benzoate`, `Alpha-Isomethyl Ionone`, `Butylphenyl Methylpropional`, `Eugenol`, `Amyl Cinnamal`, `Hydroxycitronellal`, `Isoeugenol`, `Farnesol` …;
- conventional preservatives: `Phenoxyethanol`, `Sodium Benzoate`, `Potassium Sorbate`, `Benzyl Alcohol`, `Benzoic Acid`, `Chlorphenesin`, `Methylisothiazolinone`, `Methylchloroisothiazolinone`, `DMDM Hydantoin`, `Sodium Hydroxymethylglycinate`, `Iodopropynyl Butylcarbamate`, `Dehydroacetic Acid`, `Sodium Dehydroacetate`, `Methylparaben`, `Propylparaben`, **`Leuconostoc/Radish Root Ferment Filtrate`** *(R8, 2026-09-14)*;
- preservative boosters, **only when declared alongside a preservative from the line above**: **`Ethylhexylglycerin`**, `Caprylyl Glycol`, `1,2-Hexanediol`, `Glyceryl Caprylate`, `Caprylhydroxamic Acid` *(R8, 2026-09-14)*;
- trace chelators: `Disodium EDTA`, `Tetrasodium EDTA`, **`Tetrasodium Glutamate Diacetate`** *(R8, 2026-09-14)*, `Trisodium Ethylenediamine Disuccinate`, `Etidronic Acid`, `Phytic Acid` / `Sodium Phytate`.

**Colourants are NOT marker-eligible (R8, 2026-09-14 — marker precedence).** v0.1 listed `CI 1xxxx` / `CI 7xxxx` as a tail class, so a colourant could **define** `tail_index`. It is removed from the marker classes, and the precedence rule is: **`tail_index` is set only by the earliest fragrance / declared allergen / preservative / booster-in-a-pair / chelator species. A colourant never sets it.** Two reasons, both §1.1 reasons. (a) Colourants are placed for shade, not for level: a pigment declared early would drop an entire conditioning architecture into the nominal sub-1 % tail and collapse every field to its floor — a disqualification driven by a listing convention, not by evidence. (b) The category's colour-*depositing* products are excluded at G0 anyway, so an early colourant on an eligible mask is an opacifier or a tinting trace, not a boundary. **Colourants keep zero care credit wherever they sit** — above the tail they are recorded as an E1 formula fact and earn nothing, exactly as `Titanium Dioxide` and `Mica` do (lexicon family 10) — and they remain tail members for credit purposes when they fall at or after `tail_index`. This mirrors the leave-in treatment, where colourants count inside the vacuity set but are not marker-eligible.

**Above the tail** = strictly before `tail_index`. **In the tail** = at or after `tail_index`.

**Rules.**

- Ingredients in the tail contribute **nothing** to `conditioning_level`, `weight_potential`, `care_direction`, `repair_support_level`, the moisture-focus cluster, or `bond_route` (D1 and evidence §2: the sub-1% hero tail — hydrolyzed keratin, panthenol, ceramides after fragrance — is a false signal).
- Tail ingredients may still be recorded as E1 formula facts and as claim context.
- `Citric Acid` is **never** used as a tail marker: it is a ubiquitous pH adjuster whose position varies (evidence §6).
- If **no** tail-class ingredient appears in the list, set `tail_marker: absent`, treat the whole list as above-tail, and cap every judgment field's confidence at `moderate` (an INCI with no fragrance and no preservative is more likely truncated than genuinely preservative-free). Fire the `tail_marker_anomaly` review trigger.

#### 3.1.1 The plausibility conditional **(R2, 2026-09-14 — adopted from leave-in T16/§3.1.1 clause 5)**

v0.1 disqualified a marker on a **rank threshold** ("before any conditioning ingredient, or at rank ≤ 3"). That test is replaced. A fixed rank cut is arbitrary across list lengths and, worse, it decided in both directions: on a short list it could void a perfectly ordinary marker, and on a long list it let an obviously broken marker keep disqualifying real architecture. **The marker's plausibility is now tested against the formula's own architecture, by rank comparison, so the condition is itself deterministic rather than a judgment call.**

**The test (E13, 2026-10-06 — the leave-in v1.0 clause-5 mechanism, adopted verbatim in substance; replaces the v0.2–v0.5 "architecture-establishing species" wording).** Identify the species that **establish** this product's `conditioning_level` and `weight_potential` values — the primary base the field values actually rest on: the cationic(s), fatty alcohol(s), lipid(s) and silicone stack that carry §9.1's fired signals and §9.2's fired anchor or failed leanness conjunct.

- **Plausible** — **every ingredient establishing `conditioning_level`/`weight_potential` outranks** (sits above) `tail_index`, **and** the marker's own class ordering is internally consistent (third limb, below).
- **Implausible** — the marker **outranks one or more of those establishing species**, i.e. it sits *before* the primary architecture it is supposed to bound; **or** the product is a **low-water / non-emulsion architecture** (an anhydrous or near-anhydrous oil- or butter-based Kur, a solvent- or glycol-continuous system) in which the ~1 % band the marker proxies does not sit where an O/W emulsion's does at all; **or** the marker's class ordering is internally inconsistent with the rest of the list (third limb — **E2, 2026-09-14**).

**Conditioning-relevant extras below the marker never make it implausible (E13, 2026-10-06, binding).** A second cationic, a co-quat, a decorative oil or butter, a silicone or a cationic polymer declared **at or below** the marker is **not** an establishing species and can never flip the marker to implausible — whatever its family, and however much it would have contributed had it sat higher. Such a species:

1. **earns no architecture credit** (the ordinary §3.1 tail rule — it does not count toward S1/S2/S3, the §9.2 anchors, or any other field);
2. **carries a below-marker note** — the `candidate_below_tail` flag in the `hinweise` record (§13.1), naming the species, its rank, the marker and the marker's rank; and
3. **routes to human review** (`candidate_below_tail_review`, §14) **where it would otherwise have qualified an anchor** — i.e. where crediting it as above-tail would change a `conditioning_level` or `weight_potential` value (complete S1, complete the §9.2 heavy-lipid core, form an occlusive stack). An extra that would change nothing is recorded as an E1 formula fact and fires neither the note nor the trigger.

**Why (Nick, 2026-10-06).** Mask R2 already adopted leave-in T16 *by reference*; the v0.2 transcription ("the cationics, fatty alcohols and lipids that … the anchors read") left open whether *any* such species — including tail-side extras — counted, and a strict reading would have flipped the marker on most of the shelf (u3's chelator above three oils; cohort #07/#08/#09/#12). Both calibration lanes independently read "establishing" as the primary base. E13 closes the transcription gap and keeps the family consistent with leave-in. The marker is **a reading convention, never a measurement**: it is tested against what the record's values actually rest on, not against everything that might have mattered had the list been ordered differently. The leave-in Redken case is the shape of a genuinely implausible marker — the marker outranks the establishing species itself — and on the mask cohort the blind lane read #02 and #06 this way (their establishing cationic sits below the marker) — readings E13 leaves exactly where they were.

**Third limb — internally inconsistent marker class ordering (E2, 2026-09-14).** A marker is also implausible when the tail classes themselves are declared out of their own known order, so that the species chosen as `tail_index` cannot be where the ~1 % boundary sits **given what else the same list declares**.

> **The worked example, and the case this limb was ruled on.** A **declared fragrance allergen** ranked far **above `Parfum` itself** — e.g. `Hydroxycitronellal` at rank 12 with `Parfum` at rank 30. Declared allergens are constituents *of* the fragrance compound and are therefore, by construction, present in smaller quantity than the compound that carries them: they are trace ingredients. An allergen eighteen ranks above its own parent `Parfum` is not a descending-weight ordering; it is a house listing convention or a transcription artifact. Taking it as the 1 % proxy would place the fragrance compound — and everything between rank 12 and rank 30 — in the sub-1 % tail on the strength of one of its own trace constituents. **Set `tail_marker: unresolved` and route to review** under `tail_marker_unresolved` (§14); the five consequences above then govern in both directions.
>
> **E2 application note (evidence obtained 2026-10-06, cohort #11).** The worked case was re-fetched verbatim from L'Oréal's own declaration (F.I.L. Z70038579/2 via rossmann.de): the ordering is REAL — `Hydroxycitronellal` @12, `Limonene` @18, `Linalool` @19, `Hexyl Cinnamal` @28, `Glycolic Acid` @29 and `Parfum` LAST @30, with the CI colourants already at @7–8. Conclusion, generalized: **a `Parfum` listed at or near the end of the list, behind its own declared allergens, is a house listing convention (observed L'Oréal/Garnier style), never a concentration position** — the third limb fires deterministically and the marker is `unresolved` permanently for such lists, not pending a better capture. Per E2's own terms the conservative reading is then FINAL, not provisional. On #11 this closed AP-11-MARKERUNRESOLVED with weight `moderate`, focus `shine`, conditioning `moderate`.

**The test is ordinal and deterministic, not a size judgment.** The limb fires on a **declared contradiction inside the same list** — an allergen above its own `Parfum`, a preservative booster declared above the preservative it is only permitted to boost (§3.1's booster class already requires the pair), a chelator above a preservative block it is printed beneath elsewhere on the same capture. It does **not** fire on "this marker feels early": earliness alone is governed by the unchanged paragraph below, and a marker that is merely early **but ordinally consistent** stays plausible.

**Operational note — the booster limb tests the marker species only (round-2 triage, 2026-10-06).** The booster-above-preservative (and chelator-above-preservative-block) readings test only orderings that **involve the marker species itself** — e.g. a booster chosen as `tail_index` that sits above the preservative it must be paired with. An ordering **wholly inside the tail** (a `Caprylyl Glycol` @13 above a `Benzoic Acid` @16 when the marker is `Parfum` @7) never fires this limb: below the marker, Art. 19 order is arbitrary, so such an ordering is not a declared contradiction about where the ~1 % line sits.

**The R8 colourant demotion itself stands (E2, 2026-09-14).** This limb does not reopen §3.1's marker-precedence rule. A colourant is still not marker-eligible, and recomputing `tail_index` on the marker-eligible classes is still the first step. E2 only adds a test on the species that recomputation lands on: where **that** species is ordinally inconsistent with the list's own fragrance/preservative structure, the recomputed marker is `unresolved` rather than accepted. The demotion is a precedence rule about *which classes may set the marker*; E2 is a plausibility rule about *whether the marker it produces can be believed*. Neither is a fallback for the other, and a record that fires E2 does **not** revert to the colourant.

**Consequence of an implausible marker.** Set **`tail_marker: unresolved`**. Then, binding in both directions (§1.1):

1. **It may not disqualify.** A route, species or signal that would fail only because it sits at or after this marker is instead read **on its own merits**, from the ordinal architecture read. An implausible marker never pushes a value down.
2. **It may not qualify.** Nothing is credited as above-tail architecture **solely** because it outranks this marker. An implausible marker never pushes a value up.
3. **Confidence on every affected field is capped at `moderate`**, and drops to `low` where the field's value rested on the marker boundary alone.
4. **Every affected call routes to human review** under the named **`tail_marker_unresolved`** trigger (§14) — distinct from `tail_marker_anomaly`, which keeps the marker-**absent** case.
5. It **never auto-decides toward a value in either direction.** `unresolved` is a review state, not a shortcut to `low`, to `moderate`, or to a richer read.

*Worked shape (leave-in's Redken record, carried as the pattern rather than as a mask product record):* a `Phenoxyethanol` at rank 3 of 24, sitting **before** the product's own main conditioning silicone at rank 4, would absurdly place that silicone in the sub-1 % tail. That is a listing artifact, not a 1 % boundary. Under v0.1's rank rule the same record was already caught (`rank ≤ 3`), but a marker at rank 7 of 30 sitting before a rank-9 cationic base was not; the architecture test catches both and stops mis-catching a rank-3 marker on a six-species list whose architecture genuinely sits at ranks 1–2.

**A merely early marker is still a marker.** Where `tail_index` is early **but still sits after every architecture-establishing species** (a fatty-alcohol base at ranks 2–3, marker at rank 6), the marker is **plausible** and the ordinary rules govern it unchanged. Earliness on its own is a counter-signal to record, never a disqualification.

**[judgment call — review]** The tail-class enumeration and the "no tail marker → cap at moderate" rule are operational additions. **(E13, 2026-10-06)** Which species count as "establishing" for the plausibility test is **no longer a judgment call**: it is the primary base the record's `conditioning_level`/`weight_potential` values rest on, and below-marker extras are excluded by rule. The ruled inputs fix the principle ("above the fragrance/preservative tail") and, from R2, the conditional's *direction* (implausible → `unresolved`, review, never auto-decide); they do not fix the enumeration. **(E2, 2026-09-14)** The third limb's *principle* and its worked case (allergen above `Parfum`) are ruled. The wider enumeration of "internally inconsistent orderings" beyond that worked case — the booster-above-preservative and chelator-above-preservative-block readings named above — is this standard's operationalization and is calibration-testable.

---

## 4. Evidence record

Every direct property carries (Conditioner §4 pattern):

- `value`
- `decision_type` — `deterministic` | `structured_judgment` | `claim_gated` | `not_inferable`
- `confidence` — `high` | `moderate` | `low` (§4.1)
- `evidence_level` — E0–E5
- `evidence_scope`
- `rationale` — potential wording, never performance wording
- `formula_observations[]` — what is literally present, with one-based rank
- `product_inferences[]` — what might follow
- `supporting_signals[]`
- `counter_signals[]`
- `derived_from[]`
- `profile_fact_ids[]`
- `source_ids[]`
- `shared_mechanism_ids[]`
- `review_status`

Mask-specific additions to every record:

- `tail_marker` — `{ ingredient, index, plausible: true|false }` | `absent` | `unresolved` (§3.1, §3.1.1). **(R2, 2026-09-14)** The `plausible` prong is mandatory: a record that does not state it has not applied §3.1.1
- `above_tail_segment` — the ordered ingredient slice used for structural signals
- `multi_use_scope` — §2.2 envelope, when `multi_use: true`
- `hinweise` — the always-emitted §13.1 record **(R8, 2026-09-14)**; empty when nothing fired, never omitted
- `protocol_metadata_ref` — pointer to the sourced TPL-MASK/P5 contact time; **never** an input to any value

Formula observations state what is literally present. Product inferences state what might follow. **A derived fit without both `derived_from` and `profile_fact_ids` is invalid.**

Each profile also carries one concise `uncertain_fields` list and `assumption_notes`. These are reviewer aids, not a taxonomy Nick must adjudicate value by value.

### 4.1 Confidence meaning (category-wide)

- `high` — exact complete input, no material gap, converging independent signals, reasonable unknowns would not move the value;
- `moderate` — one value is best supported but realistic unknowns could move it to a **neighbouring** value;
- `low` — identity/formula conflict, incomplete evidence, or balanced interpretations prevent a dependable call.

Confidence measures classification robustness, not clinical accuracy. Never invent percentages. Low confidence is visible in the artifact, does not remove the product from the set, and does not block finalization — but it does fire a review trigger (§14).

---

## 5. Route dictionary

Routes are candidate architectures, not scores. Each route below restates the Conditioner rule and then adds an explicit **Mask delta**.

### R1 — Cationic / fatty-alcohol conditioning base

**Candidate evidence.** A verified long-chain cationic quat (`Behentrimonium Chloride`, `Cetrimonium Chloride`, `Behentrimonium Methosulfate`, `Distearyldimonium Chloride`, `Quaternium-87` …) or a protonatable amidoamine (`Stearamidopropyl Dimethylamine`, `Behenamidopropyl Dimethylamine`) plus a long-chain fatty alcohol (`Cetearyl Alcohol`, `Cetyl Alcohol`, `Stearyl Alcohol`, `Behenyl Alcohol`, `Myristyl Alcohol`) in a confirmed rinse-out product.

**Permitted E2 statement.** "Contains a conventional cationic conditioning-base pattern."

Do not infer actual lamellar phase, viscosity, deposited amount, combing force, sensory richness, rinseability, buildup, or user fit. An acid beside an amidoamine supports the candidate context but does not prove protonation or final pH.

> **Mask delta.** R1 is the **category baseline**, not a differentiator. Every eligible mask is expected to carry it. What is mask-diagnostic is the *breadth and position* of the base: masks typically run **multi-cationic stacks** (two or more distinct cationic species above the tail) and place a fatty alcohol at rank 2–3 (evidence §1, §2). R1 therefore feeds `conditioning_level` and `weight_potential` through structural-position signals S1/S2 (§9.1), and it **never** by itself sets `detangling`, `smoothing`, or `moisture` as a focus (§9.5 step 1). A mask being a mask is not evidence of anything.

### R2 — Silicone surface-film / lubrication route

**Candidate evidence.** Verified silicone ingredient(s) considered within the full deposition architecture (`Dimethicone`, `Amodimethicone`, `Dimethiconol`, `Bis-Aminopropyl Dimethicone`, `Cyclopentasiloxane`, `Behenoxy Dimethicone`, silicone quaterniums, and their emulsifier partners such as `Trideceth-12` / `Cetrimonium Chloride` pairs).

**Permitted E1/E2 statement.** "Contains a possible silicone surface-film/lubrication route."

Silicone presence does not prove heavy finish, buildup, fine-hair mismatch, superior shine, repair, persistence, or deposition. Silicone-free does not prove lightness or low residue.

> **Mask delta.** Silicone is **not** a weight driver in this category: fatty-alcohol and butter/triglyceride load is (evidence §8). R2 therefore contributes to `weight_potential` only via the occlusive-stack sub-signal (§9.2), never as "silicone present → heavier". R2 is, however, the principal carrier of the **shine/gloss emphasis architecture** (§9.5, F4): an alignment-oriented silicone/polymer route with a *low* lipid load is the formula shape behind gloss positioning. Nothing about a silicone route may be worded as sealing, cuticle closure, or lasting change.

### R3 — Cationic-polymer deposition / film route

**Candidate evidence.** Verified cationic polymer such as a `Polyquaternium-N`, `Guar Hydroxypropyltrimonium Chloride`, or `Hydroxypropyl Guar Hydroxypropyltrimonium Chloride`.

**Permitted E1/E2 statement.** "Contains a possible cationic-polymer deposition modifier."

Charge density, molecular weight, formula interactions, substrate, use frequency, and rinse determine behavior. Never map the family directly to buildup. R3 is a deposition modifier, **not** automatically a temporary repair-film result.

> **Mask delta.** Masks routinely carry a **broader secondary conditioning polymer set** than conditioners (evidence §1) — this breadth is category-typical and therefore *not* a differentiator on its own. Polymer count is explicitly **not** a `conditioning_level` signal (evidence §2 false-signal list: ingredient count). R3 contributes to the shine architecture (with R2) and to the high-slip architecture that feeds `texture_fit`.

### R4 — Lipid / butter / emollient relubrication route

**Candidate evidence.** Verified oil, butter, ester, hydrocarbon, ceramide, or related emollient in formula context.

**Permitted E1/E2 statement.** "Contains a possible emollient/relubrication route."

A hero oil in the uncertain tail is not a richness score. Fatty alcohols used in the base are **not** counted again as hero oils.

> **Mask delta.** This is where the mask/conditioner continuum is most visible: masks shift toward **more and heavier lipids** — plant butters (`Butyrospermum Parkii Butter`, `Theobroma Cacao Seed Butter`, `Mangifera Indica Seed Butter`), heavy triglycerides (`Cocos Nucifera Oil`, `Ricinus Communis Seed Oil`), hydrogenated fats (`Hydrogenated Vegetable Oil`) and occlusive hydrocarbons (`Paraffinum Liquidum`, `Petrolatum`) — none of them mask-exclusive (evidence §1). **(E14, 2026-10-06)** v0.2–v0.5 named `Olea Europaea Fruit Oil` and `Argania Spinosa Kernel Oil` as heavy triglycerides here; that was a transcription error against the lexicon's own banding and is corrected — both are **mid band**. R4 is split into **three** graded bands for this category, adopting the lexicon's triglyceride bands (lexicon family 3) with a binding mapping:
> - **R4b heavy lipid** — butters (shea, cocoa, mango), lanolin / wool wax and its derivatives, **coconut oil**, **castor oil**, hydrogenated fats, petrolatum and occlusive hydrocarbons. The `weight_potential: high` anchor's heavy-lipid core reads **this band only**.
> - **Mid band (E14, 2026-10-06)** — conventional liquid plant triglycerides: **olive, argan, soy/soybean, apricot kernel, sunflower, macadamia, avocado, sweet almond** and similar. Above the marker a mid-band oil **defeats the leanness test's no-lipid conjunct** (`weight_potential: low` becomes unavailable) but **can never alone establish `high`** — it is not an R4b core, does not count toward §9.5.3 criterion 2's lipid-led limbs, and does not fail §9.5.4 criterion 1.
> - **R4a light lipid** — esters (`Isopropyl Myristate`, `Coco-Caprylate/Caprate`, `Isoamyl Laurate`, `Cetyl Esters` …), `Caprylic/Capric Triglyceride`, jojoba (a wax ester), squalane, ceramides. **No weight signal** in either direction.
>
> **Why three bands (E14).** The lexicon always carried three; the standard mapped only two, so a single contested liquid oil had to be filed as R4b or R4a, and on u2 one boundary-position soy oil decided between `weight_potential: high` and `low`. **No single contested oil may ever decide between the two extremes** (§1.1): the mid band can only *withhold* `low`, never *grant* `high`, so it always fails toward `moderate`. All three bands count toward the lipid-breadth signal S3 for `conditioning_level` (§9.1). A butter listed in the tail is a hero-tail false signal and contributes nothing.

### R5 — Temporary protein / film-support route

**Candidate evidence.** Hydrolyzed protein (`Hydrolyzed Keratin`, `Hydrolyzed Wheat Protein`, `Hydrolyzed Soy Protein`, `Hydrolyzed Silk`, `Hydrolyzed Collagen`, `Hydrolyzed Oat Protein`, `Hydrolyzed Rice Protein`), peptide (`Oligopeptide-N`, named peptide systems), keratin (`Keratin`, `Keratin Amino Acids`), quaternized protein derivative (`Hydroxypropyltrimonium Hydrolyzed Wheat Protein`), or a non-cationic fibre-substantive film former, with plausible delivery context.

**Permitted E1/E2 statement.** "Contains a possible temporary protein/film-support route."

Ingredient presence does not prove penetration, structural repair, strength, breakage reduction, or a "protein need". Upgrade requires exact-product evidence and a defined endpoint. R5 requires a plausible **fibre-substantive** film route in formula context; a generic gum, starch, or viscosity signal that may primarily control bottle rheology is not sufficient by itself.

> **Mask delta — free amino acids do NOT qualify.** Single free amino acids and simple amino-acid blends (`Arginine`, `Glycine`, `Serine`, `Glutamic Acid`, `Alanine`, `Cysteine`, `Amino Acids`, `Sodium PCA` as an amino-acid derivative) are **not** an R5 protein-film route. They are small molecules without a substantive film mechanism; several of them (`Arginine`, `Sodium PCA`) belong to the humectant/pH-context families instead and are handled under R9/R6. Counting them as protein would inflate `care_direction: protein`, `repair_support_level: medium`, and the `damage_fit` specialist route in exactly the category where "Repair"/"Reparatur" naming is most common. `Keratin Amino Acids` is a borderline token: treat it as **non-qualifying** for R5 unless a second, unambiguous hydrolyzed-protein or peptide species also appears above the tail. **[judgment call — review]** The `Keratin Amino Acids` handling and the explicit free-amino-acid exclusion list are operational additions; the ruled inputs fix only the direction ("free amino acids do not qualify").
>
> Second mask delta: because masks carry heavier payloads generally, a protein species in the tail is *more* likely, not less, to be a marketing hero. The tail rule (§3.1) applies without exception.

### R6 — Acid / buffer / chelator context

**Candidate evidence.** Verified acid, buffer, or chelator (`Citric Acid`, `Lactic Acid`, `Sodium Hydroxide`, `Sodium Citrate`, `Disodium EDTA`, `Sodium Phytate`).

**Permitted E1 statement:** presence. **E2 statement:** possible pH-control or metal/hard-water robustness context.

Do not infer final pH, cuticle sealing, color retention, metal removal, detox, repair, or bleaching safety.

> **Mask delta.** `Citric Acid` is a ubiquitous pH adjuster and is **never** bond evidence (evidence §6, and the `bond_route` rule in `01_property-set-v0.md`). It is also never a tail marker (§3.1).

#### R6a — Acid gloss / "lamination" context (charter F4)

**Candidate evidence.** `Glycolic Acid` (or another alpha-hydroxy acid) declared above the tail in a product positioned as Gloss, Glaze, Laminierung, or Lamination.

**Permitted E1/E2 statement.** "Contains an acid-gloss context ingredient consistent with the product's gloss positioning."

**Hard rules:**

- **There is no gloss/lamination route property and no `lamination` focus value.** Gloss identity is carried entirely by the `shine` focus, through the ordinary shine threshold plus claim corroboration (D2; evidence §7).
- "Lamination" is positioning, not distinct chemistry (evidence §7).
- Glycolic acid **temporarily plasticizes** the fibre (a measured decrease in Young's modulus). It does **not** seal, coat, close the cuticle, laminate, or produce lasting change. Banned wording in every rationale and every downstream copy: *versiegelt*, *seals*, *closes the cuticle*, *laminates*, *lasting*, *permanent*, *bonds the surface*.
- The optical mechanism behind gloss (surface smoothing raising specular reflection) is **not separable** from ordinary smoothing-film shine (evidence §7). Therefore R6a alone can never set `shine`; the shine threshold in §9.5 must be met independently.
- A gloss/lamination mask classifies its `care_direction` by the **care base it actually carries**, not by its acid claim (D6).

### R7 — Bond-claim review route (charter F3)

**Candidate evidence.** An exact product claim **plus** a named or explicitly described chemistry visible in the reviewed formula **plus**, for anything above candidate status, product-level substantiation.

**Permitted E1/E2 statement.** "Contains a named bond-chemistry candidate." Formula-only evidence remains E1/E2 and does **not** prove new bonds, internal repair, or strength. Routine-level evidence is never attributed to the mask.

> **Mask delta — deterministic `bond_route` enum.** In this category the bond claim is common enough that the route is made **deterministic**, by named INCI above the tail only (`01_property-set-v0.md`, trace-level additions):
>
> ```text
> bond_route ∈ { maleate, gluconamide, peptide, none }
> ```
>
> | Value | Qualifying evidence | Anchor example |
> |---|---|---|
> | `maleate` | A named maleate-ester bonding ingredient declared above the tail | `Bis-Aminopropyl Diglycol Dimaleate` (Olaplex-style chemistry) |
> | `gluconamide` | A named gluconamide/gluconolactone-family bonding ingredient declared above the tail, identified as the bonding technology | Henkel system; present in Gliss 4-in-1 Repair Bond mask (evidence §6) |
> | `peptide` | A named bond-positioned peptide system declared above the tail | K18-style oligopeptide systems — **largely absent** from German drugstore rinse-out masks (evidence §6) |
> | `none` | Everything else | — |
>
> **The reviewer must record the exact INCI token carrying the chemistry.** If the token cannot be named — the pack says "Bond Repair Complex", "Plex Technology", "Bonding Komplex" with no identifiable INCI species — then `bond_route = none` and the `bond_claim_review` trigger fires (§14). Branded naming never substitutes for a token.
>
> **Explicit non-qualifiers** (binding, `01_property-set-v0.md`): `Citric Acid`; **any hydrolyzed protein alone**; the words "Bond", "Plex", "Bonding", "Bond Repair" anywhere in the product name or claim; ceramides; free amino acids; panthenol; an unspecified proprietary "complex"; a bonding ingredient found only **in the tail**.
>
> **Standing caveat (evidence §6, open risk).** None of the three routes has strong independent product-level substantiation at drugstore concentrations; gluconamide bonding in particular has **zero independent literature**, and the two secondary-source maleate tensile figures remain unverified at one remove. "Bond" front-of-pack is frequently an ordinary rich mask. `bond_route ≠ none` therefore gates a *comparative formula-potential* value (`repair_support_level: high`), never an efficacy statement. Every rationale must say so.

### R8 — Fragrance / scalp exposure route

`Parfum`, `Fragrance`, `Aroma`, declared fragrance allergens, and clearly aromatic essential oils are exposure signals.

Allowed values: `fragrance_declared` · `aromatic_or_allergen_exposure` · `no_listed_fragrance_signal` · `unknown`.

"No listed signal" is not allergy-safe, hypoallergenic, or guaranteed fragrance-free. Labelling thresholds and incomplete/conflicting formulas prevent those claims. Discomfort, rash, dermatitis, infection, hair loss, and disease require abstention and professional evaluation (G6).

> **Mask delta.** The canonical mask placement is **Längen und Spitzen, Ansatz aussparen** (P5). Scalp-exposure reasoning is therefore *not* part of the ordinary mask profile: a directions-compliant mask is not a scalp product. If a source explicitly directs whole-head or root application ("im ganzen Haar verteilen"), that contradicts P5, is a protocol deviation, and fires the root/scalp review trigger — it does not silently change R8 or create a scalp property. R8 doubles as the tail-marker source (§3.1).

### R9 — Humectant cluster route *(new in Mask; grounds the `moisture` focus)*

**Candidate evidence.** Two or more distinct humectant-class ingredients declared **above the tail**:

`Glycerin` · `Propylene Glycol` *(named explicitly, E15 — lexicon family 7 already carried it)* · `Propanediol` *(not when positioned as carrier — E15)* · `Butylene Glycol` *(not when positioned as carrier — E15)* · `Panthenol` / `Panthenyl Ethyl Ether` · `Sodium Hyaluronate` / `Hyaluronic Acid` / `Hydrolyzed Hyaluronic Acid` / `Sodium Acetylated Hyaluronate` · `Sodium PCA` · `Betaine` · `Urea` · `Aloe Barbadensis Leaf Juice` / `Leaf Extract` · `Sorbitol` · `Trehalose` · `Mel` (honey) · `Sodium Lactate` · `Inositol` · `Saccharide Isomerate`

**Carrier/solvent glycols are not R9 species (E15, 2026-10-06, binding; lexicon family 7 note).** `Dipropylene Glycol` and `Pentylene Glycol` — and `Butylene Glycol` or `Propanediol` **when positioned as a carrier** — are **solvents, not humectant-leg species**. They **never** count as a humectant leg for §9.3's care-direction tests (the partial cluster in reading (b) clause 3, the cluster in reading (a), the clause-4 ordering) or toward §9.5.3's moisture cluster, at any rank. *Positioned as a carrier* means, for `Butylene Glycol`/`Propanediol`: immediately preceding or inside a run of botanical `… Extract` entries, or adjacent to the preservative/booster block; otherwise they stay R9 species under the rule below. **Scope is deliberately narrow:** `Glycerin`, `Propylene Glycol`, `Panthenol`, `Betaine`, `Sodium PCA`, `Urea` and the hyaluronates **remain** humectant-leg species wherever they sit above the tail. `Caprylyl Glycol` and `1,2-Hexanediol` were never on this list (preservative boosters, §3.1). v0.1–v0.5 listed `Dipropylene Glycol` and `Pentylene Glycol` here on D5's general inclusion of glycols; E15 is a later ruling of Nick's on the narrower question of solvent glycols and governs it (the header's later-ruling-governs principle).

**Permitted E1/E2 statement.** "Contains a humectant-forward comparative direction." **Never** "hydrates", "proven hydration", "adds moisture to the hair", or any moisture-delivery claim (D5 wording rule).

**Rules.**

- R9 is a **cluster** route, not a hero-token route. One humectant — including glycerin, which is near-universal in this category — establishes nothing (D5 guard).
- Hydrolyzed proteins are **not** counted as humectants (they are R5). Fatty alcohols, esters, and oils are **not** humectants (they are R1/R4). This separation is what prevents "rich mask" from silently reading as "moisture mask" (§6, G3).
- ~~A polyol that appears solely as the carrier/solvent of a botanical extract chain (e.g. `Butylene Glycol` immediately preceding a run of `… Extract` entries and appearing nowhere else) is still counted per D5's explicit inclusion of glycols, but the reviewer must record it in `counter_signals[]` and cap the moisture-focus confidence at `moderate`.~~ **Superseded (E15, 2026-10-06):** a carrier-positioned glycol is **not counted at all** (paragraph above); it is recorded in `counter_signals[]` as a solvent so the reviewer sees it was seen.
- R9 grounds the **`moisture` primary/secondary focus** (§9.5) and contributes to `care_direction` (§9.3), but the two use **different thresholds** — see §9.3.1.

> **Mask delta.** R9 has no counterpart in the Conditioner standard, because Conditioner v1.6 has no `moisture` focus. It exists here solely because Nick ruled `moisture` into the mask focus vocabulary (D5), and it is deliberately built as an *anti-hero-token* route: the ruled guard was tested on four real formulas (Balea Aqua Hyaluron 3in1 and Guhl 30 sek Feuchtigkeit clear it; Gliss Bonding and Pantene Bond correctly fail), and this route is the operationalization of exactly that test.

### No route exists for

- **dwell time** — protocol only, zero classification credit (evidence §3);
- **heat assist** — optional protocol modifier only, never a formula property or ranking input (evidence §4);
- **gloss/lamination as chemistry** — see R6a (evidence §7);
- **"protein overload"** — not an established condition; see §13 (evidence §5);
- **the mask/conditioner category itself** — metadata and directions decide at G0 (evidence §1).

---

## 6. Shared mechanisms and double counting

Mechanism IDs (M1–M4 inherited from Conditioner §6; M5 added for R9):

- `M1_DEPOSITION_SURFACE_LUBRICATION` — cationic base (R1), cationic polymer (R3), silicone (R2), lipids (R4).
- `M2_TEMPORARY_FILM_SUPPORT` — proteins, peptides, film formers (R5).
- `M3_OPTICAL_ALIGNMENT_FILM` — shine caused through alignment or surface film (R2/R3, and the optical consequence of M1).
- `M4_CLAIM_ONLY_PROPRIETARY` — claim without product-specific substantiation (branded bond/gloss complexes).
- `M5_HUMECTANT_WATER_BINDING` — humectant cluster (R9). **New in Mask.**

Several ingredients may raise confidence in **one** mechanism. They do not create several independent technologies. One mechanism cannot independently score conditioning, smoothing, shine, repair, moisture, and body without endpoint-specific evidence.

**Mask-specific anti-double-count rules (G3):**

1. A rich R1+R4 base is **one** M1 observation, however many fatty alcohols, cationics, oils, and butters it contains. It may raise `conditioning_level` and `weight_potential` — it may not additionally create `smoothing`, `detangling`, `shine`, and `moisture` as four focus candidates.
2. `shine` that is merely the optical consequence of the smoothing/deposition film is **M3 sharing M1** and does not earn its own focus slot (D2: shine is never a free add-on of the smoothing film).
3. M5 is deliberately kept **disjoint** from M1: an emollient-rich "moisturizing"-positioned mask with one glycerin is an M1 product, not an M5 product. This is the core discrimination D5 was ruled to enforce.
4. `bond_route ≠ none` is a single M2-adjacent observation; it may set `repair_support_level: high` **or** corroborate `repair` focus, but the same token cannot also be counted as a protein-film route for `care_direction`.

---

## 7. Direct properties

Formula-only values describe **potential**, not measured performance. Every value below is capped at E2 unless the record carries exact-finished-product evidence.

### 7.1 Inferable direct properties

| Property | Values | Formula-only ceiling | Required false-signal rule | Abstain when |
|---|---|---|---|---|
| `treatment_concentration_potential` *(mask-specific)* | lower / moderate / higher / unknown | E2 | count **structural position**, not ingredient points; rheology-only ingredients (HEC, xanthan, carbomer) and post-tail heroes are excluded | tail marker unresolved, or formula/product form unresolved |
| `conditioning_deposition_potential` | lower / moderate / higher / unknown | E2 | count architecture, not ingredient points | formula or product form unresolved |
| `wet_slip_detangling_potential` | lower / moderate / higher / unknown | E2 | wet evidence is not dry evidence | architecture ambiguous or only claim evidence |
| `dry_combability_potential` | lower / moderate / higher / unknown | E2 | never upgrade from wet-combing data alone | no dry endpoint or coherent film/lubrication route |
| `surface_lubrication_softness_potential` | lower / moderate / higher / unknown | E2 | friction proxy is not perceived softness | only bottle rheology or claim evidence |
| `smoothing_frizz_control_potential` | lower / moderate / higher / unknown | E2 | deposition route is not weatherproof frizz control | humidity/use protocol absent for a hard claim |
| `shine_potential` | lower / moderate / higher / unknown | E2 | shine is not repair; alignment/film shares M3 with M1; an acid-gloss claim is E0 | only hero ingredient, only R6a, or only claim |
| `humectant_support_potential` *(mask-specific)* | lower / moderate / higher / unknown | E2 | one humectant — glycerin above all — is not a cluster; hydrolyzed proteins are not humectants | tail marker unresolved |
| `weight_deposition_potential` | lower / moderate / higher / unknown | E2 | silicone-free is not light; viscosity is not weight; **silicone presence is not the weight driver — fatty alcohol/butter load is** | full architecture unavailable |
| `body_lightness_potential` | likely_preserving / balanced / likely_depositing / unknown | E2 | name/volume claim is not body evidence | architecture conflicts or no corroboration |
| `repair_lubrication_protection` | none_visible / candidate / tested / unknown | E2 | manageability/breakage protection is not structural repair | endpoint undefined |
| `repair_surface_film` | none_visible / candidate / tested / unknown | E2 | temporary film is not cortex regeneration; free amino acids do not qualify | route depends only on a protein/keratin **name** |
| `bond_specific_support` | claim_only / chemistry_candidate / product_tested / unknown | E2 | "bond/plex/repair" naming is E0; citric acid and hydrolyzed protein are never bond evidence | named chemistry token or substantiation absent |
| `color_chemical_damage_protection` | general_conditioning / candidate / product_tested / unknown | E2 | acid/chelator is not anti-fade proof | no color endpoint |
| `fragrance_scalp_exposure` | R8 values | E1 | exposure is not diagnosis | incomplete/conflicting INCI |

**`body_lightness_potential` after E6 (2026-09-14).** It **stays** in this table, with its values, its ceiling and its false-signal rule unchanged, and every record still records it. What changed is only what reads it: it was the second condition of §9.5.2 step 3's `lightness` route, and that route is deleted, so the property now feeds **no** §9 comparison field. That is the ordinary condition of a §7 direct property — several others also inform no field directly — and it is recorded here so a reviewer does not read the orphaned consumer as a reason to drop the property or to reconstruct the route through it.

A direct property may be `higher` at E2 only when **multiple independent, endpoint-relevant** formula observations support the route and no material counter-signal exists. One shared mechanism must not upgrade several endpoints as if it were several independent observations. The rationale must say "potential" and preserve the cap.

### 7.2 Explicitly NOT inferable — protocol-only, trace-only, or absent

These are ruled (`01_property-set-v0.md`) and evidence-backed. They must never appear as a comparison field, never influence any value in §9, and never be reconstructed by proxy.

| Item | Status | Why | Where it lives instead |
|---|---|---|---|
| **Dwell / contact time** | **Protocol-only — zero classification credit** | Cationic/silicone deposition is fast and largely equilibrium-driven; 1-min vs 5-min dwell of similar architectures is not reliably different, and no peer-reviewed head-to-head dwell trial exists (evidence §3) | TPL-MASK / P5, sourced from packaging with a source. Required for a valid stamp; irrelevant to classification |
| **The 7-second segment** | **`dwell_efficacy: unknown`, never extrapolated in either direction** | 7 seconds is outside all tested contact times (evidence §3). Charter F2: express Kuren are fully eligible; dwell is never a boundary test | Protocol metadata + `express_dwell_unknown` review trigger (§14) |
| **Heat assist** | **Optional protocol modifier only — never a formula property or ranking input** | Plausible for lipid/small-peptide uptake but evidence is thin and indirect; popular uptake percentages trace to blogs; oil penetration is more damage/porosity-dependent than warmth-dependent (evidence §4) | Protocol deviation note. **Banned wording:** "opens the cuticle", "activates", "boosts penetration" |
| **Cadence / frequency** | Not inferable | Reproduces directions wording, not product behaviour | Protocol metadata |
| **Amount / dosage** | Not inferable | Same | Protocol metadata |
| **Buildup / cumulative residue** | **Trace-only**, `lower / indeterminate / higher`, E0 from one use, E3 only from repeated apply/rinse/wash/removal cycles | One-use deposition is not buildup | Detailed research trace. **Never projected into the nine-field profile** |
| **Rinse behavior** | **Trace-only**, `quick / balanced / tenacious / unknown`, E0 from INCI, E3/E4 tested | Not inferable from ingredients | Detailed research trace. **Never projected into the nine-field profile**; `weight_potential` is the retained ingredient-informed deposition signal |
| **Penetration depth** | Not inferable | INCI discloses no molecular weight, delivery, or substrate state | — |
| **Mask-vs-conditioner category** | Not inferable from INCI | Both are lamellar-gel-network O/W systems on one continuum (evidence §1) | G0, from metadata/directions |

---

## 8. Finished-product methods (the E3/E4 upgrade path)

Recorded so the ceiling is honest, not because v0.1 expects to reach it.

- Wet slip: peak force and total work on controlled wet tresses.
- Dry combability: peak force and total work after controlled drying/humidity.
- Friction/lubrication: specified fibre/probe tribology with orientation, load, speed, humidity.
- Softness: blinded trained sensory, optionally paired with haptic/friction proxies.
- Shine: fixed-geometry goniophotometry/lustre plus blinded visual assessment.
- Rinse behavior: water volume/time to a predefined visual and clean-touch endpoint.
- Cumulative residue: repeated apply/rinse/wash cycles plus deposition and functional endpoint, **including a removal arm**.
- Body/lightness: tress volume/projected width or bundle compression plus blinded assessment.
- Breakage protection: repeated combing fragments/break counts under a defined comparator.
- **Dwell comparison (mask-specific):** identical formula, identical dose, two or more contact times, one pre-registered endpoint, blinded assessment. Until such a study exists for the exact product, dwell stays at zero credit (evidence §3).

Every E3/E4 record names exact formula/version, substrate, damage state, dose, **contact time**, rinse, drying, environment, sample size, comparator, endpoint, and result. Evidence for a shampoo, conditioner, leave-in, routine, or different formula cannot upgrade this product.

---

## 9. The nine-field comparison profile

The ruled shape (`01_property-set-v0.md`) is Conditioner v1.6's nine fields, re-anchored inside the mask category. Only reviewed direct properties may produce it. Authoritative directions remain required protocol metadata but **do not create comparison properties**. Current catalog labels never break a tie.

```text
1 conditioning_level      low / moderate / high              → product_mask_specs.concentration
2 weight_potential        low / moderate / high              → weight (light/medium/rich)
3 care_direction          protein / moisture / balanced      → balance_direction
4 repair_support_level    low / medium / high                → repair_support_level
5 primary_focus           1 of 9 values                      → via benefits mapping
6 secondary_focus         0–2 further values                 → via benefits mapping
7 hair_thickness_fit      subset of fine / normal / coarse   → suitable_thicknesses     [ECHO — R9]
8 damage_fit              subset of healthy / moderately_damaged / highly_damaged   (research-only)  [ECHO — R9]
9 texture_fit             subset of straight / wavy / curly / coily                 (research-only)  [ECHO — R9]
```

**(R9, 2026-09-14)** Fields 7–9 are **echo fields** (§9.5E): deterministically derived, displayed as „→ ergibt:" annotations on the rows that drive them, and **not separately reviewed**. They are still emitted in the research envelope and in every projection, and `suitable_thicknesses` still projects. The per-product review surface is therefore **seven rows**: fields 1–6 plus the `hinweise` record (§13.1).

Trace level, beneath the profile: `bond_route`, the `balanced_reading` tag wherever `care_direction: balanced` (§9.3, R6), the protein-payload counter-signal (§13), the `multi_use` envelope (§2.2), the always-emitted `hinweise` record (§13.1, R8), and `ingredient_flags` (silicones/polymers/oils/proteins/humectants — deterministic presence flags from the normalized complete INCI; **not** a judgment field and never a tie-breaker).

### 9.1 `conditioning_level` — the `concentration` twin (D1, binding)

**Meaning.** Overall conditioning/treatment intensity **relative to the mask category**, from structural INCI position only. Repair stays owned by `repair_support_level`; this field is not a repair proxy at research level.

> Production note, not a research rule: matching currently consumes `concentration` as a repair-need proxy (`mask_concentration_is_temporary_repair_level_proxy`). Whether production later matches repair need against `repair_support_level` instead is a production-policy question outside this project (D1).

**Signals — structural position only.** Compute on the above-tail segment (§3.1).

| ID | Signal | Test |
|---|---|---|
| **S1** | Cationic breadth | ≥ 2 **distinct** long-chain cationic / protonatable-amidoamine species above the tail |
| **S2** | Fatty-alcohol prominence | A long-chain fatty alcohol at rank **2 or 3** of the full list (i.e. immediately after the aqueous phase) |
| **S3** | Lipid breadth above the tail | ≥ 2 **distinct** non-fatty-alcohol lipids (R4a, mid band or R4b — E14, 2026-10-06) above the tail |

**Thresholds (R3, 2026-09-14 — three evidence defects fixed).**

- `high` — **S1 satisfied** (mandatory) **and at least one of {S2, S3}** satisfied, **and** no material counter-signal (see below). Two independent structural signals are still required, as D1 demands; what changed is that they may no longer be *any* two. **Why S1 specifically:** of the three, S1 is the only one that reads **conditioning breadth** — how many distinct deposition species the formula runs. S2 (a fatty alcohol at rank 2–3) and S3 (two lipids above the tail) both read the **fatty/emollient load**, which is the axis §9.2 owns and which R4 now anchors on its own evidence. Allowing S2+S3 alone to reach `high` therefore made `conditioning_level: high` and `weight_potential: high` two readings of one observation — exactly the shared-mechanism double count G3 and §6 rule 1 forbid ("a rich R1+R4 base is **one** M1 observation"). A formula with S2+S3 and a single cationic species is `moderate`, and its richness is said once, in `weight_potential`.
  > **The honest caveat, recorded not resolved.** The lexicon's own false-positive register notes that *two* distinct above-tail cationics is "near-baseline in this market" (lexicon §13), i.e. S1's threshold sits low against the German shelf. R3 makes S1 **necessary** for `high`; it does not claim S1 is by itself *sufficient*, which is why a second signal is still required. Whether S1's count should rise to three on calibration evidence is §18.1's question — and it is a question about the signal's *threshold*, never about the resulting distribution.
- `low` — **none** of {S1, S2, S3} satisfied, i.e. a single cationic species, no fatty alcohol in the top three, and at most one lipid above the tail.
- `moderate` — everything else, **including S2+S3 without S1**, including exactly one satisfied signal, and including the unresolvable fallback.

**The boundary-position rule — count the species, cap the confidence (E1, 2026-09-14; supersedes R3's tail-edge exclusion).** A species declared at **`tail_index − 1`** — the last rank above the tail — **counts normally**, toward S1, S2 and S3 and toward every other field's evidence. What its position costs is **confidence, not credit**:

> **The rule.** A species at `tail_index − 1` is credited in full wherever it would ordinarily be credited. **Any value whose threshold depends on that species** — i.e. a value that would change if the species were removed — has its **confidence capped at `moderate`** and carries a **`hinweise` note** recording that the value *"hinges on a boundary-position ingredient"*, naming the species, its rank and the marker's rank. The value itself does not move in either direction.

**Why the strike was wrong, and this is right.** R3's original text removed every `tail_index − 1` species and re-ran the signals, so a signal that fired only with that species did not count at all. Nick ruled that out on 2026-09-14 (E1) on the evidence, and the reasoning is recorded here because it is the rule's whole basis:

1. **Relative order above the marker is legally reliable.** Art. 19 requires descending order above 1 %. Everything above `tail_index` is therefore in a *known* order relative to everything else above it. What Art. 19 does **not** tell us is where the 1 % line falls — only that. So the uncertainty at `tail_index − 1` is uncertainty about **one boundary**, not about the species' presence, its identity, or its position relative to its neighbours.
2. **Only the 1 % boundary is uncertain, and the marker is already a proxy for it.** The marker is a conservative stand-in for an invisible line. Striking the species immediately above it treats the proxy as if it were sharper than the thing it proxies — it spends a *second* conservatism on the same single uncertainty.
3. **~1 % of a co-conditioner is a functional dose.** The species this actually bit on in the first cohort were second cationics — `Quaternium-18`, `Behentrimonium Methosulfate` — declared one rank above `Parfum`. At the concentrations in play a co-conditioning quat at or about 1 % is a real, working dose, not a decorative trace. Voiding it produced `moderate` calls on formulas that plainly run two deposition species, which is the breadth D1 asks S1 to read.
4. **§1.1 does not require it.** The conservative-failure invariant asks that unreadable evidence never fail toward the *more favourable* value. Here the evidence is readable — the species is declared, in order, above the marker. What is uncertain is a boundary, and uncertainty about a boundary is exactly what a **confidence cap** is for. Encoding it as a value move made the record say "this formula is less conditioning" when the honest statement is "this formula is this conditioning, and one of the two facts carrying the call sits on a line we cannot see".

**The cap is field-uniform (E1, with E5 folded in, 2026-09-14).** The boundary-position treatment applies **identically in every field** — §9.1's S1/S2/S3, §9.2's base terms and anchors, §9.3's material-R5 test and humectant-cluster count, §9.4, §9.5's focus routes and the §9.5.3 cluster, and the echo projections of all of them. There is no field in which a `tail_index − 1` species is struck, and no field in which it is credited without the cap where it is load-bearing. This closes the scope question R3's drafting left open (whether the exclusion reached §9.3 as well as §9.1 and §9.2 — carried in the first cohort as `AP-04-R5TAILEDGE`): the question is moot, because nothing is excluded anywhere. **(E8, 2026-09-30)** Nick confirmed the §9.3 half explicitly; §9.3 now states the rule in its own text.

**What the record must show.** The species, its rank, `tail_index`, and — for each value it is load-bearing in — a one-line statement of what the value would be without it. A boundary-position species that is **not** load-bearing (the threshold clears without it, or it carries no signal in that field at all) is recorded as an E1 formula fact and caps nothing: the cap tracks dependence, not position.

**The counter-signal conjunct is operative (R3, 2026-09-14).** v0.1 wrote "and no material counter-signal" into the `high` threshold and then, three paragraphs later, said counter-signals "never move the value in any direction" — so the conjunct was dead text. It is now live, **for `high` only**, and it caps at `moderate` rather than moving the value further:

> **Material counter-signal (closed list).** (a) `tail_marker` is `absent` or `unresolved` (§3.1, §3.1.1) — the above-tail segment the signals were counted on is not reliable; (b) a §2.4.1 **tier-2** formula-set conflict touches any species that carried a fired signal; (c) a fired signal rests wholly on a species whose functional family is contested on this list or that lexicon family 10 claims as rheology-only/emulsifier (the classic case: `Glyceryl Stearate` or the `Ceteareth-20` half of a `Cetearyl Alcohol / Ceteareth-20` blend counted as a lipid or a fatty alcohol). **Any one of these → `conditioning_level` caps at `moderate`, the counter-signal is recorded, and the field is listed in `uncertain_fields`.**

**Non-material counter-signals — unchanged, and explicitly never capping.** Rheology-only ingredients present in the formula (`Hydroxyethylcellulose`, `Xanthan Gum`, `Carbomer`, `Acrylates/…Crosspolymer`) — these thicken the jar, not the fibre. Long ingredient lists. Sub-1 % hero tails (hydrolyzed keratin, panthenol, ceramides listed after fragrance). "Reichhaltig"/"Intensiv" positioning with no matching architecture. None of these move the value **or** cap it; they are recorded and nothing else (evidence §2 false-signal list). The material list above is material precisely because each of its three members undercuts *the reliability of a signal that actually fired*, which is a different thing from being a false signal in its own right.

**This is an evidence fix, not a distribution target (R3, 2026-09-14 — recorded because it was explicitly challenged; amended E1, 2026-09-14).** The changes above were adopted because each closes a per-product evidence defect — a `high` reachable without the multiple-independent-signals breadth D1 requires, and a dead conjunct — **not** because the first cohort produced more `high` calls than expected. The product-truth-≠-distribution invariant governs: **if most masks earn `high` on real evidence, they keep it.** No threshold in this section may be tuned toward a target prevalence, and §15 must report prevalence as a finding, never as a pass/fail criterion. **(E1, 2026-09-14)** R3's third defect — "a `high` carried by a boundary-band species" — is **withdrawn as a defect**: E1 rules that a boundary-band species carries its signal in full and that the boundary uncertainty is a confidence matter. The invariant cuts the same way in this direction too: the two products that lost `high` only to the strike (`#01`, `#03`) regain it, and that is a consequence of the corrected rule, not a distribution adjustment either.

**Fallback (D1, binding).** Unresolvable cases → `moderate` + the field listed in `uncertain_fields` (NEQI fallback pattern). Never encode unresolved uncertainty as an extreme (§1.1).

**Confidence rule (R3, 2026-09-14; amended E1, 2026-09-14).** `high` **confidence** requires a resolved **and plausible** tail marker (§3.1.1), a complete exact-market INCI, **S1 plus at least one of S2/S3**, and no material counter-signal. `moderate` is the default, and is mandatory when the tail marker is `absent`/`unresolved`. **(E1, 2026-09-14)** `moderate` is **also** mandatory — whatever the value — when a `tail_index − 1` species is load-bearing for the value, i.e. when S1, S2 or S3 would stop firing without it; the boundary-position `hinweise` note is emitted with it. `low` when the formula source is conflicted (including a §2.4.1 tier-1 step-down that lands there) or the above-tail segment cannot be determined.

**Honest limitation, stated in every record.** A three-step concentration scale is at the **edge of INCI support** (confidence low-moderate at method level; evidence §2). No published dataset maps INCI patterns to validated low/medium/high thresholds. These anchors are provisional and are the first thing the calibration set should move.

**[judgment call — review]** S1/S2/S3 as the exact operational triple, the "0 signals → low" arithmetic, and the "fatty alcohol at rank 2–3" cut remain this standard's additions. D1 fixes the *signal families* (cationic count and rank, fatty-alcohol rank, lipid-above-tail breadth) and the *extremes-need-multiple-signals* principle, not the counting rule. **(R3, 2026-09-14)** The `high` half of the old "≥ 2 of three" arithmetic is **no longer a free judgment call** — R3 rules S1 mandatory and S2/S3 as its alternatives. What stays open and calibration-testable: the exact membership of the material-counter-signal closed list. **(E1, 2026-09-14)** The band-*width* question ("is `tail_index − 1` the right width") is **no longer a value question** and is largely defused: no width of band strikes anything any more, so a wider band could only widen the set of values that carry a `moderate` cap and a `hinweise` note. Whether the cap should reach `tail_index − 2` is carried as a low-stakes calibration item rather than as the value-moving question it was under R3.

### 9.2 `weight_potential`

**Meaning.** An ingredient-informed matching prior, not a prediction that the product will visibly flatten hair. Best-supported axis in the category — but inferred, never measured (evidence §8).

**Weight gets its own evidence (R4, 2026-09-14).** v0.1 gated `weight_potential: high` behind a **cationic** base condition (≥ 2 distinct cationics plus a cetearyl-class fatty alcohol in the top three). That gate is removed. It imported `conditioning_level`'s S1 signal into a field whose own evidence base says something different: the weight driver in this category is **fatty-alcohol and butter/triglyceride load**, explicitly **not** silicone and explicitly not cationic breadth (evidence §8, and §5 R2's mask delta). Gating weight on cationic count made the two fields echo each other, so a lipid-rich, single-cationic mask could not reach `rich` however heavy its lipid load was — and, symmetrically, it let cationic breadth substitute for the lipid evidence the field is actually about. `weight_potential` now stands on lipid and fatty-base evidence alone.

**Anchors (evidence §8; `high`/`low` restated R4, 2026-09-14):**

- `high` — **required core:** a **heavy-lipid load above the marker** — at least one R4b heavy lipid (butter, lanolin, **coconut or castor oil**, hydrogenated fat, occlusive hydrocarbon — the **heavy band only**, E14, 2026-10-06) declared above the tail — **completed by either**: (a) a **dense fatty-alcohol base**, or (b) an **occlusive silicone stack** above the tail (two or more silicone species, or a dimethicone/dimethiconol pair). **And** no material unresolved counter-signal. No cationic condition applies in either direction: cationic breadth neither qualifies nor blocks `high`. **(E14, 2026-10-06)** A **mid-band** oil (olive, argan, soy, apricot, sunflower, macadamia and similar) **never** forms the core, however early it sits and however many there are.
- `low` — a **positive leanness test (restated E4, 2026-09-14; conjunct 1 widened E14, 2026-10-06)**, all three conjuncts required: **no R4b heavy lipid and no mid-band triglyceride above the marker**, **and** **no occlusive silicone stack** above the tail, **and** **a single cationic species on the full INCI list** *(scope ruled E7, 2026-09-30)*. The structural fatty-alcohol conjunct is **deleted**: see below. R4a light lipids (esters, caprylic/capric triglyceride, jojoba, squalane) do not touch conjunct 1.
- **The mid band, stated once (E14, 2026-10-06).** A mid-band oil above the marker **blocks `low`** (it defeats conjunct 1) and **cannot make `high`** (it is not an R4b core). A formula whose only above-marker lipid evidence is mid-band therefore reads `moderate` whatever else it carries. This is the binding answer to seam S2: **no single contested oil decides between the two extremes** (§1.1). Where that oil sits at `tail_index − 1`, it is still load-bearing (`moderate` vs `low`), so E1's confidence cap and boundary note still apply — but the counterfactual is now one step, never extreme-to-extreme.
- `moderate` — everything else. **The expected majority, and accepted** (evidence §8).

**What E4 deleted from `low`, and why (E4, 2026-09-14).** R4 had replaced v0.1's "no cetearyl-class fatty alcohol in the top three" rank test with a **thin fatty base** test — but that test kept a top-three rank cut inside it, so it reintroduced the same block it was written to remove. On the first cohort the result was that `low` was selected **zero** times: the products that failed it failed on a **single structurant fatty alcohol at rank 2**, which lexicon family 2 records as near-universal in this category ("presence therefore carries no signal at all"). A conjunct that fails on the category baseline is not a leanness test; it is an unreachability. Nick ruled E4 against the catalog's **ten curated light masks** — real products, on a real shelf, that a working `low` anchor must be able to describe. The `low` anchor now reads the three things that actually make a mask heavy on this category's own evidence: heavy lipid, occlusive film, and deposition breadth.

**Base term, defined so the `high` anchor is deterministic (R4, 2026-09-14; `thin fatty base` deleted E4, 2026-09-14):**

| Term | Test (on the above-tail segment) |
|---|---|
| **Dense fatty-alcohol base** | **≥ 2 distinct** long-chain fatty alcohols (`Cetearyl`, `Cetyl`, `Stearyl`, `Behenyl`, `Myristyl Alcohol`) above the tail, **or** a cetearyl-class fatty alcohol within the **top three ranks** |
| ~~**Thin fatty base**~~ | **Deleted (E4, 2026-09-14.)** No longer defined and no longer read by any anchor. The `low` test does not look at fatty-alcohol count or rank at all. |

The `dense fatty-alcohol base` term does not count an emulsifier half of a blend (`Ceteareth-20`, `Glyceryl Stearate`, `PEG-100 Stearate` — lexicon family 10). **(E1, 2026-09-14)** It **does** count a fatty alcohol at `tail_index − 1`, per §9.1's boundary-position rule: the species is credited and the resulting value carries the `moderate` confidence cap and the `hinweise` note. §9.1's former tail-edge exclusion no longer applies here or anywhere.

**The `single cationic species` conjunct (E4, 2026-09-14; counting scope E7, 2026-09-30) — and how it sits with R4's removal of the cationic gate.** Counted on the **full INCI list (E7, 2026-09-30)** — the one term in this section that is *not* counted on the above-tail segment: `low` requires that **exactly one** distinct long-chain cationic / protonatable-amidoamine species (the S1 family, §9.1) is declared **anywhere in the list**, above or below the marker. **Why the full list (E7).** Sub-1 % cationics still deposit on hair: a formula running two or three deposition species is not structurally lean however early `Parfum` lands, and demoting its further cationics into the tail would let the marker's position manufacture leanness. Counting the full list can only *withhold* `low`, never grant it, so it fails toward the conservative value (§1.1). The other two conjuncts keep their above-marker scope unchanged. This is **not** a reinstatement of the gate R4 removed. R4 removed cationic breadth as a qualifier for **`high`**, because weight is a lipid-and-fatty-base axis and letting cationic count reach `high` made `conditioning_level` and `weight_potential` two readings of one observation. E4 uses a **single** cationic at the **`low`** end for a different purpose: as one of three *leanness observations* — a formula running one deposition species is structurally lean in a way a formula running three is not — never as a reason to call anything rich. Cationic count therefore remains, as R4's counter-signal list says, **not a weight signal for `high` in either direction**; it is a conjunct of the positive leanness test only. Where the two readings would conflict, the `high` anchor governs: no cationic observation can raise a value.

**Why `low` is a positive test and not an absence (R4, §1.1; conjuncts restated E4).** An absence-based `low` — "we found no richness" — fails toward the more favourable value: it would hand a lean fit prior, and therefore a fine-hair recommendation, to any product whose formula we simply could not read well. The three conjuncts must each be *observed*, conjuncts 1 and 2 on a readable above-tail segment and conjunct 3 on the full list (E7, 2026-09-30). Where the segment is not readable (tail marker `absent`/`unresolved`, or a §2.4.1 tier-2 conflict), `low` is **not available**: the field takes `moderate` and goes to `uncertain_fields`. E4 changed which three things are observed; it did not change that they must be observed.

**[SUPERSEDED — the v0.1 `high` reading]** v0.1 recorded a ruling of Nick's dated 2026-09-04 reading evidence §8's four markers ("≥ 2 cationics, cetearyl top-3, butter/heavy oil above tail, occlusive silicone stack") as **base-plus-one-alternative**, with the first two markers required, on the ground that requiring all four would make `high` nearly unreachable (none of five verified formulas would have qualified against a catalog showing ~20 % rich). **R4 (2026-09-14) supersedes that reading**, and it does so on the same evidence: the reachability problem was real, but its cause was the cationic base condition, not the number of markers. The reading is retained here as provenance because records derived under v0.1 used it. **Both the "all four" and the "cationic base plus one" readings are closed as live options** — §18's open question 1 is closed by R4.

**Conflict fallback (Conditioner 10.1 pattern, retained).** When a formula-only `high` is already conflict-tagged, exact-product intended finish materially contradicts it (e.g. "leichte Pflege", "ohne zu beschweren", a volume-positioned Kur), and no finished-product evidence resolves the conflict → use `moderate` for lean matching and keep `weight_potential` in `uncertain_fields`. Do not encode unresolved uncertainty as a restrictive `high` that automatically removes fine hair from the broad prior.

**Counter-signals.** Silicone presence per se (**not** the weight driver — evidence §8; the occlusive-stack sub-signal is the one narrow exception, and only as a *completer* of an already-present heavy-lipid core, never on its own). `silicone-free` positioning (proves nothing about lightness). Viscosity. A "reichhaltig"/"nourishing" claim without a matching lipid architecture. **(R4, 2026-09-14)** Cationic count is on this list for the **`high`** anchor: it is neither a weight signal nor a weight counter-signal there, in either direction. **(E4, 2026-09-14 — the one carve-out, stated so the two rules are not read as contradicting)** A **single** cationic species above the tail is a conjunct of the **`low`** leanness test (above). Cationic count can therefore *withhold* `low` from a formula running several deposition species — counted on the full list (E7, 2026-09-30); it can never *produce* `high`, and it remains outside the `high` anchor entirely.

**Confidence rule (R4, 2026-09-14 — retained unchanged by E4).** `high` requires the full anchor pattern with a resolved **and plausible** tail marker (§3.1.1) and no positioning conflict. `low` requires the same marker quality — the leanness test is unavailable on an unreadable segment (conjunct 3's full-list count, E7, does not lift this precondition — conjuncts 1 and 2 still read the above-marker segment). Otherwise `moderate`; `low` confidence on formula conflict. **(E1, 2026-09-14)** Additionally, and in either direction: `moderate` is mandatory where a `tail_index − 1` species is load-bearing for the value — where the heavy-lipid core, the dense-base completer, the occlusive stack, or the mid-band block on conjunct 1 (E14, 2026-10-06) would read differently without it — with the boundary-position `hinweise` note emitted alongside. **Operational note (round-2 triage, 2026-10-06):** the **single-cationic count is not on that list.** It is counted on the full INCI list (E7), so it is **position-independent** — a cationic at `tail_index − 1` would be counted exactly the same at any other rank. A boundary-position note naming a full-list conjunct is therefore **informational only**: it may be emitted so the reviewer sees the species, but it imposes no confidence cap.

**[judgment call — review]** The "dense fatty-alcohol base" test above is this standard's operationalization. R4 fixes the *structure* (heavy-lipid core required; fatty-base or occlusive-stack completer; leanness positively tested) and the removal of the cationic gate; it does not fix the two-species / top-three cuts on the `high` side. **(E14, 2026-10-06)** The lipid **banding** (heavy / mid / light, with the mid band's block-low-never-make-high role) is now **ruled**; only the membership of "similar liquid plant triglycerides" for oils not named in §5 R4 remains reviewer work, resolved against lexicon family 3. **(E4, 2026-09-14)** The `low` side's three conjuncts are now **ruled**, not a judgment call: no R4b above the marker, no occlusive silicone stack, a single cationic species. **(E7, 2026-09-30)** The conjunct's **counting scope is now ruled too**: the full INCI list, not the above-tail segment. What remains this standard's addition there is only the species family it counts (§9.1's S1 family). The `high` side's two-species / top-three cuts are first in line for the calibration set (§15).

**Wording rule.** Weight drives a **soft preference with a stated reason**, never "fine hair must avoid masks". Fine-hair flattening is a **fit mismatch, not a hair-type law** — silicone-microemulsion evidence shows fine hair can benefit from conditioning products (evidence §8).

### 9.3 `care_direction` (D6, binding — always populated)

**Meaning.** The formula's comparative care emphasis. **Never** an assertion that a user has a protein or moisture deficiency (G6).

**Values — no empty value and no `none`** (a `none` value was considered and withdrawn — D6). **What R6 amends, and what it does not (2026-09-14).** D6's three value names, its "no `none`" rule, its `protein` bar and its `moisture` default are unchanged. What R6 amends is D6's sentence that `balanced` is "**never** a 'neither' middle bucket": Nick raised that `balanced` can also mean *both-not*, matching his own leave-in T19 ruling, and ruled the unified two-readings rule below. The distinction D6 was protecting is kept exactly — **`balanced` is never an *uncertainty* bucket** — and reading (b) is not an uncertainty read but a positive finding about a readable formula. `01_property-set-v0.md` still carries D6's v0.1 wording; reconciling it is out of scope here (§18.9).

**Direction is decided by which side leads (R6, 2026-09-14 — the both-readings rule, aligned with leave-in T19).** `care_direction` is a **protein-versus-moisture comparison**: the value names which of the two legs leads the formula. `balanced` is what the field says when **neither leads** — and there are **two co-equal ways** for neither to lead, not one. Neither reading is the fallback of the other, and neither is an uncertainty bucket.

| Value | Requires |
|---|---|
| `protein` | The **protein leg leads**: a **material identifiable R5 protein/peptide/keratin film-support route** that is more than ordinary conditioning, **and** no qualifying humectant cluster beside it |
| `moisture` | The **moisture leg leads**: a coherent conditioning / humectant / emollient architecture as the material direction, **without** a material protein-film route. This is the category's honest default |
| `balanced` **(a) both-substantive** | Both legs are substantive: a material R5 route **and** a qualifying humectant cluster, both above the tail. Record `balanced_reading: both_substantive` |
| `balanced` **(b) neither-dominant** | Neither leg leads because the formula's care result is carried by a **film or acid route** instead — the film/acid-led rule below. Record `balanced_reading: neither_dominant` |

**Operational test for "material R5 route":** a qualifying R5 species (§5, R5 — free amino acids excluded) above the tail, **plus either** (a) a second distinct qualifying R5 species above the tail, **or** (b) a single qualifying R5 species within the **first eight above-tail ranks**. **[judgment call — review]** — D6 fixes "material and more than ordinary conditioning"; the two-species / rank-8 disjunction is this standard's operationalization.

**Boundary position in the protein test (E8, 2026-09-30).** R3's tail-edge exclusion is **not** extended to this test. Following E1's principle (§9.1), a qualifying R5 species at **`tail_index − 1`** **counts normally** toward either leg above; where the material-R5 result — and therefore `care_direction` (and `repair_support_level: medium`, which uses the same test, §9.4) — would change without it, the value's **confidence is capped at `moderate`** and a `boundary_position_ingredient` `hinweise` note is emitted (§13.1), naming the species, its rank, `tail_index`, and the value it would take without it. The value itself does not move. With E1 governing §9.1 and §9.2 and E8 governing §9.3, the standard states **one uniform boundary-position principle**: a species one rank above the marker costs confidence, never credit, in every field.

**Operational test for `balanced` reading (a) — both-substantive (R6, 2026-09-14).** The material R5 route above **and** a qualifying humectant cluster (§9.5.3 criterion 1: ≥ 3 distinct humectants above the tail, ≥ 2 of them non-glycerin). **The lipid-leg alternative is deleted.** v0.1 also let a substantial R4 lipid/emollient stack (S3 satisfied) stand in for the humectant cluster, which meant **"protein + generic lipids" reached `balanced`** — and generic lipids are exactly what every rich mask carries (evidence §1). That path made `balanced` a synonym for "a repair mask that is also a mask", inflating a value that **bridge-matches** in the production fit layer and therefore has real downstream cost. **A protein-led formula whose only other leg is lipid breadth now reads `protein`**, which is what its architecture says.

**Operational test for `balanced` reading (b) — neither-dominant / film- or acid-led (R6, 2026-09-14).** A record takes reading (b) when **all four** hold:

1. **No protein anchor.** No material R5 route above the tail.
2. **A film- or acid-led primary care mechanism, present above the tail.** The conditioning result is carried by a substantive **R2 silicone system** or **R3 cationic-polymer film**, or by an **R6a acid-gloss** architecture, with at least one such species above the tail. **(E9, 2026-09-30) A "substantive R2 silicone system" requires at least two distinct R2 silicone species above the tail — the same two-species count §9.2's occlusive-stack term uses — or one R2 silicone species plus a corroborating R3 cationic-polymer film species or R6a acid-gloss species above the tail. A single silicone species on its own is a route, not a system, and does not satisfy this clause.**
3. **No leading moisture leg.** Above the tail, the formula carries **neither** a partial humectant cluster (≥ 2 distinct R9 humectants) **nor** an R4 lipid stack (S3 satisfied) — i.e. nothing beyond the bare R1 category baseline, which §9.5.2 step 1 and §6 rule 3 already forbid reading as a direction. A single glycerin is not a leg (D5 guard). Leg species present **only in the tail** are subordinate: recorded, and creating no direction. **(E15, 2026-10-06)** A carrier/solvent glycol (`Dipropylene Glycol`, `Pentylene Glycol`, carrier-positioned `Butylene Glycol`/`Propanediol` — §5 R9) is **not a leg species** here or in clause 4, at any rank; it is recorded as a solvent and nothing else.
4. **Ordinal corroboration.** Every film/acid species establishing clause 2 ranks **above** every candidate leg species noted under clause 3, so the read does not rest on the marker's exact rank alone.

The anchor case is the structurally minimal gloss mask — single-cationic, lipid-free, humectant-poor, with the optical route and the acid carrying the product (lexicon §8, L'Oréal Elsève Glycolic Gloss). Its care direction is genuinely *neither*, and saying so is a **positive architecture finding**, not an abstention: nothing is missing from the record. **Where a moisture leg is present as architecture, `moisture` still governs, film lead or not** — this boundary does not move; clause 3 makes it checkable rather than lowering it.

**The reading is recorded, always.** Every `balanced` rationale states which reading it took and names the evidence: for (a) the R5 species and the cluster members with ranks; for (b) the marker and its rank, the film/acid species with ranks, and **every subordinate leg species with its rank**. A `balanced` with no recorded reading is an invalid record.

**`balanced` is still never an uncertainty bucket.** Unreadable evidence does not land here. Where the formula or identity cannot be read at all — a §2.4.1 tier-2 conflict, an unresolvable capture — the affected field takes `unknown` under G5 and routes to review; it does not take `balanced` (§1.1).

**Gloss/lamination masks (D6, verbatim in substance; extended R6, 2026-09-14).** They classify by the **care base they actually carry**, never by the acid claim. Where that base is a conventional cetearyl / behentrimonium / amodimethicone conditioning base with a real emollient or humectant leg above the tail — as L'Oréal Glycolic Gloss treatment and Balea Glow & Shine Laminier-Kur were read under v0.1 — they land in `moisture`, or `protein` where a protein route is material (Balea's keratin). **(R6)** Where the base is instead structurally minimal — single-cationic, lipid-free, no humectant pair above the tail, with the silicone/polymer film and the acid carrying the product — reading (b) applies and the value is `balanced` / `neither_dominant`. This is not a new licence for gloss products: it is the same "classify by the base you carry" rule, now able to say *this base leads in neither direction* instead of defaulting a film-led formula into `moisture`. The gloss identity is still carried by the `shine` focus, never by `care_direction`.

**Worked example for reading (b) — the accepted case (E3, 2026-09-14).** Reading (b)'s first accepted cohort record is **not** a gloss product: it is **Pantene Pro-V Molecular Bond Repair (#07)** — a single amidoamine above the tail, one amino silicone, zero humectants and zero lipids above the tail, clause 4 satisfied because there is no leg species to outrank. Nick ruled the `balanced` / `neither_dominant` result **accepted**: the film genuinely carries the product, and the `moisture` value the record would otherwise have taken was a **convention, not evidence**. Use this record, rather than the §9.3 anchor text's structurally-minimal gloss mask, as the pattern for what reading (b) looks like in practice. No rule text moves with this example: it fixes nothing new and loosens nothing — it records that a film-led `neither_dominant` finding is a legitimate outcome rather than a result to be talked back into the default.

**The worked example's outcome is superseded (E9, 2026-09-30).** E3 accepted the reading-(b) *architecture finding* on #07; it did not rule whether one amino silicone is a clause-2 "system". E9 rules that it is not (clause 2, above). #07 carries a single silicone species and no R3/R6a corroboration, so clause 2 fails and it reads `moisture`. E3's point stands as principle — a film-led `neither_dominant` finding is legitimate where the architecture earns it — but after E9 **reading (b) is reached by no record in the first cohort**, and it remains reserved for genuine structural outliers.

**The first reached case (E15, 2026-10-06) — unseen u3, John Frieda Frizz Ease Wunder-Kur.** A three-species R2 silicone system above the chelator marker @10 (`Dimethicone` @3, `Bis(C13-15 Alkoxy) PG-Amodimethicone` @7, `Dimethiconol` @8 — a system under E9), a single cationic, no R5 at any rank, no humectant and no lipid above the marker once `Dipropylene Glycol` @6 is read as a solvent (E15), and every film species outranking every subordinate tail leg (coconut @12, olive @13, castor @14, ceramides @17–18). All four clauses hold: `balanced` / `neither_dominant`, `moderate`. It is the shelf's first genuine structural outlier of the kind §18.4 asked about.

**Counter-signals.** Heavy protein payload → confidence cap (§13). "Feuchtigkeit"/"Hydration" naming with no qualifying cluster → recorded, never decisive. Protein naming with the protein only in the tail → the value the architecture supports, with the claim recorded as a `hinweise` note that moves nothing (§13.1, R8).

**Confidence rule (R6, 2026-09-14).** `high` requires a resolved and plausible tail marker and an unambiguous route separation. Capped at `moderate` whenever the D4 protein-payload counter-signal fires (§13, binding), whenever the `tail_protein_cluster` flag fires (§13.1 rule 4, E12), whenever the tail marker is `absent`/`unresolved`, or whenever the leading leg is close enough to the other that a reviewer could plausibly call `balanced` reading (a). For `balanced` reading (b) specifically **(sentence rewritten E15, 2026-10-06)**: reading (b) **requires all four clauses**, and its ceiling is `moderate`. **Where any clause fails, reading (b) is simply unavailable** — the record takes the value the other rows of the table give (ordinarily `moisture`), at that value's own confidence; there is no "reading (b) at low confidence". Within a reading (b) that holds, **step down to `low` and route to review** only where the leg-absence reading rests on a marker the record flags as `absent` or `unresolved`. *(v0.2–v0.5 also stepped down "where clause 4's ordering does not hold", which contradicted the all-four requirement two paragraphs earlier; a record whose clause 4 fails never reaches this sentence.)*

#### 9.3.1 `care_direction: moisture` ≠ `primary_focus: moisture`

These are **different tests at different bars** and must never be conflated:

| | `care_direction: moisture` (§9.3) | `moisture` as a focus (§9.5) |
|---|---|---|
| Bar | Coherent conditioning/humectant/emollient base without a dominant protein route | The **D5 cluster guard**: ≥ 3 distinct humectants above the tail, ≥ 2 non-glycerin, and no richer special-purpose route winning |
| Frequency | The category default; most masks | Deliberately rare |
| Meaning | "This formula's care emphasis is not protein" | "Humectant-forward is this product's most distinctive job" |

A mask can — and usually will — be `care_direction: moisture` with `primary_focus: smoothing` or `general`. That is correct, not a contradiction.

### 9.4 `repair_support_level`

**Meaning.** The formula's comparative **temporary damage-support route**, not measured repair efficacy and not structural restoration.

| Value | Requires |
|---|---|
| `low` | Ordinary conditioning / lubrication only |
| `medium` | A **distinct temporary protein/peptide/keratin fibre-film route** — the same qualifying test as §9.3's material R5 route |
| `high` | **`bond_route ≠ none`** — a named bond chemistry token visible above the tail in the reviewed formula (R7). Nothing else reaches `high` |

**Explicit non-upgraders** (any of these alone keeps the value where it was earned): generic silicone; oil; panthenol; ceramide; cationic polymer; free amino acids; generic repair naming; ordinary R1 conditioning; finished-product positioning without a corresponding formula route; citric acid; hydrolyzed protein alone (for `high`); a bond token found only in the tail.

> **Mask delta.** Three category-specific inflation risks are closed explicitly:
> 1. **Being a mask is not repair.** The category's higher baseline richness (evidence §1) must never raise `repair_support_level`. `conditioning_level: high` alone is `repair_support_level: low`.
> 2. **Dwell is not repair.** A long or "intensive" contact time carries zero credit (evidence §3).
> 3. **"Bond"/"Reparatur"/"Plex" on the pack is not repair.** "Bond" front-of-pack is frequently an ordinary rich mask (evidence §6). Naming is E0.

**Confidence rule.** `high` is `deterministic` on the token, so confidence tracks the *identity* evidence, not the judgment: `high` confidence only with a verified exact-market INCI and a resolved, plausible tail marker (§3.1.1, R2, 2026-09-14). `medium` follows §9.3's protein-route confidence. Every `high` rationale must carry the standing caveat from R7 (no strong independent product-level substantiation at drugstore concentrations; gluconamide bonding has zero independent literature).

**Wording.** Comparative formula potential, never efficacy. Banned: "repairs", "rebuilds bonds", "restores structure", "reverses damage".

### 9.5 `primary_focus` and `secondary_focus` (D2, D5)

**Vocabulary — eight values (E6, 2026-09-14)** (Conditioner v1.6's eight, **plus `moisture`** ruled by Nick 2026-09-04, **minus `lightness`** ruled by Nick 2026-09-14):

`moisture` · `detangling` · `smoothing` · `repair` · `shine` · `curl_support` · `color_care` · `general`

Exactly one `primary_focus` (a forced research-review headline) and zero to two distinct `secondary_focus` values, excluding `general`.

**`lightness` is removed from this vocabulary (E6, 2026-09-14).** It is not a value a mask record may take in either slot, and no record may reintroduce it under another name. Nick's ground, recorded as the rule's own reasoning: **masks are not bought for lightness.** A mask's forced headline exists to name the job the product is chosen for, and "light" is not that job in this category — it is a deposition and dosage property, and **`weight_potential: low` (§9.2) owns that information already**, projecting it into `hair_thickness_fit` and `texture_fit` without spending the headline. A `lightness` focus therefore said nothing the profile did not already say, at the cost of the one field that is meant to say something new. The value is removed rather than raised to a stricter threshold, because the objection is not that the two-condition test was too easy — it is that the value does not belong in this vocabulary at all. **Nothing else moves with it:** `weight_potential: low` is unaffected, both echo tables are unaffected, `body_lightness_potential` (§7.1) is still recorded, and a lean mask that would have taken `lightness` takes the focus its other routes earn — or `general` at step 8, which is the honest answer for a capable conventional mask with no specific route clearing (§9.5.2 step 8). This is a deliberate divergence from the conditioner focus vocabulary, recorded as a conditioner-parity delta in §16.1 row 7a.

> **Provenance note (D5, corrected 2026-09-04).** `moisture` is not new to the program: **Shampoo Focus v1.5** already carries it as a primary/secondary focus in its research overlay, approved by Nick 2026-09-03. Production Light stays frozen on v1.4 and rejects `moisture` — a deliberate scope boundary, symmetric with Mask, where the moisture focus also does **not** project into `functional_benefits` and reaches production only via `balance_direction`. Conditioner v1.6 and the leave-in v0.3 draft have no moisture focus. No adapter change is needed for Mask.

#### 9.5.1 Formula-first decision rule (adapted from Shampoo Focus v1.5)

**Claims identify the candidate job. The complete formula must then support — or at minimum remain compatible with — that job, and meaningful counter-signals must be recorded. No single hero ingredient proves a focus.**

Every mask focus record carries one **`focus_care_verdict`** (named to avoid collision with the `care_direction` field of §9.3):

| Verdict | Meaning |
|---|---|
| `repair_supported` | The §9.5.2 step-3 repair gate clears **(E16, 2026-10-06)**: a qualifying `bond_route`, **or** a label-strong protein route (≥ 2 distinct qualifying hydrolyzed-protein species above the marker, or one quaternized/cationic protein derivative above the marker). A single plain hydrolysate is a real §9.3/§9.4 route but does **not** reach this verdict; for focus purposes it reads `nonspecific` (or `dual_supported` only where a second route genuinely clears). **For bond claims:** a named bond-chemistry token is required — **not merely one protein token** (hydrolyzed protein alone is never bond evidence, R7) *(sentence rescoped to bond claims, E16, 2026-10-06)* |
| `moisture_supported` | A coherent humectant cluster (R9) plus conditioning/emollient support meets the D5 guard |
| `dual_supported` | The formula genuinely supports both directions |
| `nonspecific` | Generic intensive conditioning is compatible with both but distinguishes neither |
| `not_applicable` | The chosen focus is not a repair/moisture decision |

**Claim role** ∈ `candidate` | `tie_breaker` | `corroborating` | `not_applicable`.

**The hard rule (binding, adapted from v1.5 and D5; scope clarified R7, 2026-09-14):** exact-product claims **may break a genuinely `dual_supported` tie**. Claims can **never** convert `nonspecific` formula evidence into a confident specialist focus. `nonspecific` resolves to `general` (or to `smoothing` when the dry-surface route genuinely clears §9.5.2 step 6), never to `moisture` and never to `repair`.

**The tie-break is not confined to one step of the hierarchy (R7, 2026-09-14).** On a verdict that is genuinely `dual_supported`, **exact-product positioning may break the tie regardless of which §9.5.2 step the two tied candidates sit at** — and may break it in either direction, including deciding which of the two takes `primary_focus` and which takes a `secondary_focus` slot. v0.1 left this ambiguous: §9.5.2 tests special-purpose routes in a fixed order, and a reviewer could read that order as itself resolving every tie, leaving the claim leg with nothing to do. The order decides **which routes are tested first**; it does not decide a tie between two routes that both genuinely cleared their own thresholds on the formula.

The v1.5 discipline is carried over verbatim in substance and is **not** widened by this clarification:

> **Break ties: yes. Create routes: never. Upgrade nonspecific evidence: never.**

So, exhaustively: positioning may choose between two candidates the **formula already supports**; it may not make a third candidate appear, may not lower either candidate's own threshold, may not turn a `nonspecific` verdict into a specialist focus, and may not substitute for the corroboration legs that specific focus values require in their own right (`shine` §9.5.4 criterion 3, `color_care` §9.5.2 step 3). Current catalog values remain excluded from tie-breaking entirely (§9.5.2 step 9). Every tie broken this way records the verdict `dual_supported`, `claim_role: tie_breaker`, the exact claim text used, and the competing focus that lost.

Ingredient order is used qualitatively, not as a concentration claim. Rinse-off limitation, shared conditioning routes, and counter-signals stay visible in the record.

#### 9.5.2 Deterministic hierarchy

Apply in order, after §7 direct properties are complete.

1. **Exclude the category baseline.** Intensive conditioning is what a mask *is*. A rich R1/R4 base supports conditioning, wet slip, surface smoothing, and softness — it does **not** automatically make `detangling`, `smoothing`, or `moisture` the product's distinctive main purpose. This step is stricter than the Conditioner equivalent because the mask baseline is higher (evidence §1).
2. **Group evidence by shared mechanism** (§6) before comparing endpoints. Several ingredients may strengthen M1 without creating several independent technologies.
3. **Test special-purpose routes first**, in this order:
   - **`repair`** — requires R7 named bond chemistry (`bond_route ≠ none`, unchanged), **or** a protein route that is **strong on the label (E16, 2026-10-06)**, or exact-product damage-endpoint evidence. R2 silicone alone, panthenol, oils, ceramides, cationic polymers, free amino acids, biotin, generic repair naming, and `bond_specific_support = claim_only` **cannot** set `repair`.
     > **The repair headline evidence gate (E16, 2026-10-06, binding).** A protein route is *strong on the label* when, **above the marker**, the formula declares **either** (i) **at least two distinct qualifying hydrolyzed-protein species** (R5; free amino acids excluded), **or** (ii) **one quaternized/cationic protein derivative** — INCI patterns such as `Laurdimonium Hydroxypropyl Hydrolyzed …`, `Cocodimonium Hydroxypropyl Hydrolyzed …`, `Hydroxypropyltrimonium Hydrolyzed …` (and their `… Hydrolyzed … Protein` variants). **A single plain hydrolysate above the marker** still carries the §9.3 care route (`care_direction: protein` where §9.3 says so) and `repair_support_level: medium` per §9.4, unchanged — but the **headline falls through** the hierarchy, typically to `general` at step 8.
     >
     > **Basis (hair-care-expert evidence review, 2026-10-06).** No study shows wash-persistent repair from a plain hydrolysate at rinse-off contact. Species **count** has no evidential basis as a dose or efficacy argument — **one well-dosed protein outperforms three traces**, and nothing in this gate says otherwise. The only INCI-readable *quality* signal is the **derivative type**: a quaternized protein is cationic and fibre-substantive by construction. The gate is therefore about **capability-promise honesty, not dose**: a `repair` headline is a promise the label must visibly back, and one plain hydrolysate on a list is the label pattern most often used to back a "Repair"/"Plex" front-of-pack. Two distinct species, or a substantive derivative, is the minimum label evidence that the protein route is a designed formula identity rather than a token.
     >
     > **What it does not do.** It moves only `primary_focus` (and the §9.5.1 verdict). It never touches `care_direction`, `repair_support_level`, `damage_fit` or `bond_route`. Tail-side species never count toward it (§3.1; a tail cluster stays E12's visible flag). Worked case: unseen **u1 Balea Plex Care 2in1** — single plain `Hydrolyzed Pea Protein` @6 above `Parfum` @10 → `care_direction: protein` and `repair_support_level: medium` stand, `primary_focus` `repair` → `general`.
   - **`curl_support`** — requires high slip **plus** compatible weight/body architecture; curl/coily positioning is corroboration only, never creation.
   - **`color_care`** — requires at least a formula candidate **plus** compatible exact-product positioning or product-tested evidence. (Note: colour-*depositing* masks are excluded at G0; `color_care` here means colour-protection positioning on an eligible mask.)
   - ~~**`lightness`**~~ — **deleted (E6, 2026-09-14).** Step 3 tests **three** special-purpose routes, not four. The former fourth leg required `weight_potential: low` plus a likely-preserving body and sat *above* moisture, shine and smoothing, so a formula that became lean had its headline displaced by a value naming the leanness the weight field had already recorded. `lightness` is out of the vocabulary (§9.5), so there is no route to test and nothing routes here. **A lean formula does not skip the rest of the hierarchy:** it continues to step 4 and is judged on its moisture, shine, smoothing and detangling routes exactly as any other mask, and reaches step 8 `general` if none clears. Watch-list item 2's expectation that `lightness` would go unused is now moot rather than tested — the value is gone, not merely unselected.
4. **`moisture`** — apply the **D5 guard** (§9.5.3). It is tested *after* repair/curl/colour because D5 requires that "no richer special-purpose route wins". **(E6, 2026-09-14 — `lightness` removed from this list; step 3 now holds three routes.)**
5. **`shine`** — requires a **distinct optical emphasis architecture** *plus* claim corroboration (§9.5.4). Never added when it is merely the expected optical result of the smoothing film (D2).
6. **`smoothing`** — prefer when dry surface control is the clearest practical differentiator **and** the architecture extends materially beyond the ordinary mask base (a distinct silicone, substantive polymer, or substantial lipid/emollient route beyond baseline).
7. **`detangling`** — permitted as primary **only** when slip/combability is itself distinctive: clearly stronger than competing routes, or exact tangling/combability positioning corroborates it, and no richer special-purpose route wins. **Expected to be rarer than in Conditioner:** every mask is a slip product, so slip is baseline here. **[judgment call — review]** — the *expectation* is this standard's; the threshold text is inherited unchanged.
8. **`general`** — the honest fallback when the product is a capable conventional mask but no specific focus clears the differentiator threshold, when formula evidence is nonspecific, or when competing directions cannot be resolved conservatively.
9. **Official positioning may corroborate but never create a route.** Current catalog values never break a tie.
10. **Mark `primary_focus` uncertain** when two plausible purposes remain unresolved.

**Secondary focus.** A secondary may represent a distinct user endpoint even when it shares part of a mechanism, but it must add **useful matching information**. Do not spend a slot on moderate shine that only reuses the primary smoothing route (§6 rule 2). **(E10, 2026-09-30)** The secondary path is available whatever the primary is — **including the step-8 `general` fallback**, not only a richer winning route. In particular a `moisture` secondary may attach under a `general` primary whenever the humectant cluster independently meets §9.5.3 criterion 1 (and criterion 2's baseline sentence); R5's lipid-led disqualifier removes only the headline and never blocks this slot.

**Required focus explanation** (inherited, non-negotiable). For every product, the focus record must list: the exact INCI ingredients or formula pattern carrying each candidate route, with ranks; the direct-property comparison that selected the winner; any exact-product positioning used **only** as corroboration; the `focus_care_verdict` and `claim_role`; and the evidence ceiling. It must also state **why a plausible competing focus lost** and **why each secondary adds a distinct endpoint** rather than double-counting the primary film route. "Smoothing fits this product" is not an acceptable rationale.

#### 9.5.3 The `moisture` focus guard (D5, binding — tested 2026-09-04)

**`moisture` qualifies only when ALL of the following hold:**

1. **Cluster size.** At least **three distinct humectant-class ingredients** (R9 list) declared **above the tail**, of which **at least two are not glycerin**.
   *This is the operationalization of the ruled guard "glycerin alone never qualifies — `moisture` requires at least two further distinct humectants above the fragrance/preservative tail."* It reproduces the ruled discrimination set exactly: Balea Aqua Hyaluron 3in1 (4 humectants above tail, no protein/bond/silicone routes) → clears; Guhl 30 sek Feuchtigkeit (3 humectants, no competing route) → clears; Gliss Bonding (glycerin at #3 but repair routes win) → fails at criterion 3; Pantene Bond (no cluster) → fails at criterion 1.
2. **Not the baseline — and not lipid-led (R5, 2026-09-14: criterion 2 made operational).** Intensive conditioning alone never qualifies. A rich R1/R4 architecture is M1, not M5 (§6 rule 3). v0.1 stated that principle and gave a reviewer no way to apply it, so a mask with a real humectant cluster *and* a heavy lipid payload could take the moisture headline on the cluster alone while the formula was plainly a rich nourishing Kur. The disqualifier is now a test, and it fires when **either** limb holds:
   > **(i) Heavy-lipid load.** **≥ 2 distinct R4b heavy lipids** (butters, heavy triglycerides, hydrogenated fats, occlusive hydrocarbons) declared **above the marker**; **or**
   > **(ii) Cluster ranked under the lipids.** The **entire** qualifying humectant cluster — every member counted under criterion 1 — ranks **below the highest-ranked R4b heavy lipid** above the marker.
   
   Either limb ⇒ **`moisture` is disqualified as `primary_focus`.** The formula is lipid-led; its distinctive job is richness, not humectancy. The record states which limb fired, with the species and ranks.
   
   **What this does not do.** It is a **focus** rule and nothing else. It does **not** touch `care_direction` — a lipid-led formula is still `care_direction: moisture` on §9.3's own (much lower) bar, and that remains correct and is not a contradiction (§9.3.1). It does **not** move `conditioning_level` or `weight_potential`. It does **not** disqualify `moisture` as a **secondary** focus: where the cluster independently meets criterion 1 and adds distinct matching information, the secondary slot stays available (criterion 3's existing rule) — **including under a `general` primary (E10, 2026-09-30)**. And it only ever **removes** a headline — it can never create or upgrade one (§1.1).
   
   **[judgment call — review]** The "≥ 2 R4b" count and the highest-lipid ordering comparison are this standard's operationalization. R5 fixes that criterion 2 must be operational, that it is focus-only, and the two limbs' shape; the exact count is calibration-testable.
3. **No richer special-purpose route wins.** `repair`, `curl_support` and `color_care` are tested first (§9.5.2 step 3). **(E6, 2026-09-14 — `lightness` struck from this list; it is no longer a focus value, so it can no longer win against `moisture` or displace a moisture headline. A lean humectant-forward mask is judged on its cluster, not on its weight.)** If any clears — **or, (E10, 2026-09-30), if none clears and the primary is the step-8 `general` fallback** — `moisture` may still take a **secondary** slot if it independently meets **criterion 1 and criterion 2's baseline sentence** and adds distinct matching information. **(R5, 2026-09-14)** Criterion 2's **lipid-led disqualifier** — limbs (i) and (ii) — applies to the **headline only** and does **not** block the secondary slot: R5 rules the guard focus-primary-scoped, and a genuinely present humectant cluster on a rich mask is exactly the case where a secondary slot carries useful matching information.
4. **Hydrolyzed proteins are not counted** toward the cluster (they are R5). **(E15, 2026-10-06)** Nor are carrier/solvent glycols — `Dipropylene Glycol`, `Pentylene Glycol`, and carrier-positioned `Butylene Glycol`/`Propanediol` (§5 R9) — at any rank, for the headline or the secondary slot.

**Confidence rule.** `high` requires ≥ 3 distinct qualifying humectants above the tail **with at least one within the first five ranks** of the full list, a resolved and plausible tail marker (§3.1.1, R2, 2026-09-14), and no competing route. Otherwise `moderate`. **[judgment call — review]** — the "one within the first five ranks" cut is this standard's addition. It is consistent with the v1.5 pilot's Elvital Hydra Hyaluronic call (`moisture`, moderate confidence, "humectant not early"), which D5 cites as consistent with the above-the-tail requirement.

**Wording (D5, binding).** E2 phrasing is **"humectant-forward comparative direction"**. **Never** "proven hydration", "hydrates the hair", "moisturizes", "restores moisture balance", or any moisture-delivery claim.

#### 9.5.4 The `shine` threshold, and gloss/lamination masks (charter F4, D2)

Gloss/lamination masks route through the **ordinary shine threshold with claim corroboration**. There is **no separate lamination property** (evidence §7).

**`shine` qualifies only when ALL of the following hold:**

1. **Distinct optical emphasis architecture** — an alignment-oriented R2 silicone and/or R3 cationic-polymer route above the tail, **with a comparatively low lipid load** (no R4b heavy lipid above the tail). This is the formula shape that distinguishes a gloss product from a rich nourishing mask.
2. **The optical route is not merely the smoothing film already counted.** If the same M1/M3 deposition is the sole basis, select `smoothing` and keep the gloss claim as claim context only (§6 rule 2).
3. **Claim corroboration** — exact-product Gloss / Glaze / Laminierung / Glanz positioning. Corroboration only: positioning can never create the route (step 9 of the hierarchy).

R6a acid-gloss context (`Glycolic Acid` above the tail in a gloss-positioned product) is **supporting context, never sufficient**.

**Banned wording, absolute** (evidence §7): *seals*, *versiegelt*, *closes the cuticle*, *laminates the hair*, *lasting*, *permanent*, *builds a protective layer that stays*. Permitted: temporary optical/surface emphasis, comparative shine **potential**. Glycolic acid **temporarily plasticizes** and does **not** seal.

Care direction for these products is decided by the base they carry (§9.3, D6) — typically `moisture`, or `protein` where a keratin route is material (Balea Glow & Shine).

### 9.5E Echo fields — fields 7–9 are annotations, not reviewable items **(R9, 2026-09-14 — adopted from leave-in T8)**

`hair_thickness_fit` (§9.6), `damage_fit` (§9.7) and `texture_fit` (§9.8) are **deterministic projections of fields already reviewed** — `weight_potential` for 7 and 9, `conditioning_level` + `repair_support_level`/`bond_route` for 8. Each table below has **no second input and no rule that can change its output** once its driving fields are set. Reviewing them separately asks a human the same question twice and invites the two answers to diverge.

**The rule.** An echo field **is not a separately reviewable item.** It is displayed as an annotation on its driving field's row — „→ ergibt: `normal`, `coarse`" — and **approving the driving field approves the projection.** The per-product review surface is therefore **seven reviewed rows**, not ten: fields 1–6 plus the `hinweise` record (§13.1), with fields 7–9 shown as annotations on the rows that produce them.

**What does not change — stated exhaustively, because this is a review-surface rule and nothing else:**

- **All three fields are still emitted**, with the same values, in the research envelope and in every projection. `suitable_thicknesses` still projects exactly as before.
- **The projection tables in §9.6–§9.8 are unchanged.** No mapping, anchor or value moves.
- **Their review triggers still fire.** `specialist_damage_fit` (§14) still fires on a `moderately_damaged` + `highly_damaged` result — but it is a trigger on the *specialist route that produced it*, and a reviewer who disagrees with the result disagrees with `repair_support_level` or `bond_route`, which are reviewable.
- **Their confidence still tracks the driving field.** An echo cannot be more confident than what it echoes.
- A reviewer who disagrees with an annotation disagrees with the field that emitted it; that field is on the sheet.

**Watch-list item 1 is unaffected.** Whether `damage_fit` should be demoted from a reviewed field to a computed row was already on the watch-list (§9.7). R9 answers the *review-surface* half of that question and leaves the *storage* half open (§18.5): an echo field is still stored and still emitted; it is simply not re-adjudicated.

### 9.6 `hair_thickness_fit` — derived policy **(echo field — R9, 2026-09-14; annotated on the `weight_potential` row)**

Deterministically derived from `weight_potential` (`01_property-set-v0.md` field 7):

| `weight_potential` | `hair_thickness_fit` |
|---|---|
| `low` | `fine`, `normal` |
| `moderate` | `fine`, `normal`, `coarse` |
| `high` | `normal`, `coarse` |

This is a **desired-finish / dosage prior**, not a universal exclusion (evidence §8). Never worded as "fine hair must avoid masks".

**Vocabulary delta:** this repo's canonical thickness vocabulary is `fine` / `normal` / `coarse` (project conventions). The Conditioner standard's §10.4 text says "medium"; `normal` is the same middle value under the repo's canonical name. No semantic change.

### 9.7 `damage_fit` — derived policy, specialist-route pattern (Conditioner v1.6 re-stated for masks) **(echo field — R9, 2026-09-14; annotated on the `conditioning_level` and `repair_support_level` rows)**

| Condition | `damage_fit` |
|---|---|
| `conditioning_level: low` | exactly `healthy` |
| `conditioning_level: moderate` | exactly `healthy` + `moderately_damaged` |
| `conditioning_level: high` **without** a qualifying specialist route | exactly `healthy` + `moderately_damaged` |
| `conditioning_level: high` **with** a qualifying specialist route | exactly `moderately_damaged` + `highly_damaged` |

**Qualifying specialist route** — any one of: (a) a distinct protein/peptide/keratin fibre-film route (i.e. `repair_support_level ≥ medium`); (b) named bond chemistry (`bond_route ≠ none`); (c) exceptional corroborated protection; (d) a relevant exact-product test.

**The specialist result replaces the general-high set — never emit all three values.**

**Never qualifying:** generic silicone, oil, panthenol, ceramide, cationic polymer, free amino acids, repair naming, a generic lubrication candidate.

This is a **broad product prior**, not a repair-efficacy claim.

> **Mask delta.** Because the mask baseline is richer, `conditioning_level: low` is expected to be **rare**, so most of the shelf should land on `healthy` + `moderately_damaged`. If the first set produces a large `moderately_damaged` + `highly_damaged` bucket, that is evidence the specialist-route test is leaking, not evidence that drugstore masks repair hair.
>
> **Watch-list item 1** (`01_property-set-v0.md`): `damage_fit` may be fully derivable from conditioning level + repair route and could become a computed row. The table above is already deterministic given fields 1 and 4 — the first-set review should decide whether to keep it as a reviewed field or demote it to a computed projection.

### 9.8 `texture_fit` — derived policy (Conditioner 10.4 pattern) **(echo field — R9, 2026-09-14; annotated on the `weight_potential` row)**

| Architecture | `texture_fit` |
|---|---|
| Low-weight architecture (`weight_potential: low`) **(row label restated E6, 2026-09-14)** | `straight`, `wavy` |
| Balanced architecture (`weight_potential: moderate`) | `straight`, `wavy`, `curly` |
| High-slip, high-deposition architecture (`weight_potential: high` with a coherent high-slip R1/R3 route) | `wavy`, `curly`, `coily` |

**Curl branding alone never determines the result.**

**Row-label note (E6, 2026-09-14).** Row 1 formerly read "Low-weight / **lightness** architecture". The word named an architecture, never the focus value, but E6 removes `lightness` from the focus vocabulary and the label is restated so no reader reconstructs a deleted route from an echo table. **The mapping is unchanged**: `weight_potential: low` → `{straight, wavy}`, exactly as before. Echo tables read their driving field and nothing else (§9.5E); they have never read `primary_focus` and do not begin to now.

**Echo-field caveat (R9, 2026-09-14 — flagged, resolved conservatively).** The `high` row carries a **second condition** beyond `weight_potential` ("with a coherent high-slip R1/R3 route"), and §9.7's specialist-route test likewise admits legs (c) "exceptional corroborated protection" and (d) "a relevant exact-product test" that are not projections of fields 1 and 4. Strictly, a field with a second input is not an echo on the leave-in T8 definition. R9 nevertheless names all three of fields 7–9 as echo fields, so the conservative reading is adopted: **these secondary conditions are evaluated from facts already recorded and already reviewed elsewhere in the profile** — the R1/R3 route facts from §5/§7, the protection and product-test facts from §7/§8 — and they are **read, never re-judged, at the echo step.** Where such a fact is *not* already on the record, the echo does **not** get to establish it: the driving field's ordinary value governs (`weight_potential: high` without a recorded high-slip route gives the `moderate` row's `texture_fit`; a specialist `damage_fit` needs leg (a) or (b), or a leg (c)/(d) fact recorded and reviewed in §7/§8). Whether legs (c) and (d) should be removed outright, making the two tables pure projections, is carried as an open question (§18.11).

Research-only: mask matching does not consume `texture_fit` today. Nick ruled 2026-09-04 that it stays, because it is needed for user-profile matching down the line. It is **off** the watch-list.

### 9.9 Conflict handling and completion

When evidence conflicts: follow the canonical source hierarchy (§2.4), choose **one** documented formula/directions basis, **complete the profile**, and list the affected field in `uncertain_fields`. Only G0 boundary exclusions omit the profile entirely.

Current live catalog values (`protein_moisture_balance`, `repair_level`, weight, ingredient flags) are comparison-only historical data. They cannot determine a new classification or break a tie.

**Projection stops here.** Any mapping of these nine fields into `product_mask_specs`, `balance_direction`, `functional_benefits`, or any other production column is a **separate, separately approved** adapter decision outside this standard (charter stop condition). D2 records the intended deterministic benefits derivation (smoothing → `smoothing_frizz_control`, detangling → `detangling_slip`, shine → `shine`); `moisture` has no `functional_benefits` counterpart and reaches production only via `balance_direction`, so **no adapter change is needed** — that is a note about the target, not an authorization to write to it.

---

## 10. Evidence lexicon

One versioned lexicon backs the route dictionary. Each entry records:

```text
normalized name / aliases
functional family            (cationic, fatty alcohol, silicone, cationic polymer,
                              lipid-light, lipid-heavy, protein/peptide, free amino acid,
                              humectant, acid/buffer/chelator, rheology-only,
                              preservative, fragrance/allergen, colorant, bond-named)
directly supported routes     (R1…R9)
mask-specific evidence role   (structural signal S1/S2/S3, weight anchor, humectant cluster
                              member, tail-class marker, explicit non-qualifier)
exclusions / common false positives
source and review date
```

The lexicon **extracts evidence**; it must not silently become a label algorithm. Only `bond_route` and `ingredient_flags` are deterministic lexicon lookups. Version the lexicon whenever a change would invalidate historical records; historical validation continues to use the evidence-method version stored in each artifact.

---

## 11. Formula-first sequence

1. Build a **blind packet**: normalized complete INCI, product form, and the directions facts needed for G0/§2.2 — with brand, product name, claims, prior catalog labels, and fit outcomes removed.
2. **Freeze its hash** before unblinding.
3. Classify §7 direct properties and §9 fields 1–4 and 6–9 from the blind packet.
4. **Unblind.** Claims may influence **only**: the `shine` focus corroboration leg (§9.5.4 criterion 3), a genuinely `dual_supported` focus tie (§9.5.1 — **at any step of the §9.5.2 hierarchy, R7, 2026-09-14**), the `bond_claim_review` trigger, the `weight_potential` conflict fallback (§9.2), and `color_care` corroboration. Claims may influence **nothing else** — in particular not `conditioning_level` (and not its material-counter-signal list, R3), not `care_direction` or its `balanced` reading (R6), not `repair_support_level`, not the moisture guard, and not R5's lipid-led disqualifier. A claim/formula mismatch is recorded in the `hinweise` record (§13.1) and moves no value.
5. Record every blind-to-final change with its reason.
6. The same evidence packet and policy must be usable by an independent second researcher.

---

## 12. Gates

- **G0 — Boundary (charter as corrected by R1, §2.1/§2.2).** Excluded forms do not classify. Multi-use products classify **mode-scoped** or not at all. Eligibility is read from authoritative directions, never from the jar, the marketing name, or the INCI; the conjuncts are **after cleansing · stated contact time · rinsed out**, with placement defaulting to P5 when unstated (R8). **No MODE is profiled twice (R1, 2026-09-14)** — a multi-mode product may hold one profile per engine, one mode each. **Formula-level exclusions are mode-independent (E17, 2026-10-06)** — colour-depositing pigment and bond-builder chemistry-plus-protocol exclude the whole product in every mode (§2.2). **Stop values (round-2 triage, 2026-10-06):** `in_category` · `excluded_product_form` (with charter reason) · `insufficient_information` (identity/evidence stop, not a charter exclusion; no profile; routes to evidence work — §2.1).
- **G1 — Identity/formula.** Follow the canonical source hierarchy, preserve the conflict, and complete a provisional research profile from the best available exact-market evidence.
- **G2 — Evidence firewall.** observation → direct property → profile fit. No shortcuts. Protocol metadata (dwell, heat, cadence, amount, placement, rinse) never crosses into a comparison property.
- **G3 — Anti-double-counting.** One shared mechanism counts once unless endpoint-specific evidence separates it (§6). M5 stays disjoint from M1.
- **G4 — Evidence cap.** Formula-only ≤ E2; claim-only E0. Every v0.1 profile is an E2 document.
- **G5 — Conflict.** Preserve source conflicts and lower the **smallest affected scope**; a conflict that changes one property makes that property `unknown`, not the whole profile.
- **G6 — Medical.** No diagnosis, treatment, hair-loss lifecycle, inflammation, infection, or structural-regeneration suitability. Healthy/cosmetic population only. Cosmetic guidance stays separate from medically adjacent scalp or hair-loss guidance. "Protein overload" is banned vocabulary (§13).
- **G7 — Review freshness.** Review fingerprints must match identity, formula, analysis, and standard. Each newly written profile field uses a deterministic **unsalted** SHA-256 fingerprint of its canonical field evidence/value payload; equality proves the field content is unchanged and preserves its approval, changed content reopens. The whole-profile fingerprint binds the canonical nine-field profile plus `standard_version`, and is **not** a substitute for the per-field fingerprints. Because v0.1 was a draft, **every** field was open under it. **(R1–R9, 2026-09-14)** v0.2 is also a draft and **leaves no field closed**: R1–R9 touch G0 eligibility, the tail marker, and fields 1, 2, 3, 5, 6 and the review surface of 7–9, so no v0.1 approval carries forward into v0.2 and no v0.1-derived fingerprint matches. Records are re-derived, not patched (§15).

---

## 13. Overload counter-signal rule (D4, binding)

**Verdict from the evidence (evidence §5).** "Protein overload" as a named condition is **not established** — it is a practitioner/consumer construct. Published protein work mostly shows *improved* mechanics (mid/high-MW keratin peptides raising Young's modulus, reducing breakage). Heaviness or stiffness is a real but **individual, reversible product-to-hair mismatch**.

**The rule.**

A **heavy protein payload** — multiple distinct R5 species above the tail, and/or a qualifying R5 species in the top five ranks — produces exactly three effects and nothing else:

1. a **trace-level counter-signal record** (`protein_payload_counter_signal`), listing the species and ranks;
2. a **confidence cap** on `care_direction` at `moderate`;
3. a **human review trigger** (`protein_payload_review`, §14).

**It is never:**

- a comparison field;
- a user-facing verdict;
- a value modifier on any of the nine fields (it caps confidence, it does not move a value);
- a diagnosis, a warning, or a suitability exclusion.

**Banned vocabulary** in every rationale and every downstream surface: *protein overload*, *Proteinüberschuss*, *too much protein*, *protein-sensitive hair*, *needs a protein break*.

**Parked out of scope (Nick, 2026-09-04):** a routine-level protein-stacking heads-up — a warning when protein-focused products combine across one routine — belongs to the production/fit layer as its own later decision. It is not part of this engine.

**[judgment call — review]** The operational trigger ("multiple distinct R5 species above the tail, and/or a qualifying R5 species in the top five ranks") is this standard's; D4 fixes only the *handling* of a heavy protein payload, not its detection threshold.

### 13.1 The `hinweise` record **(R8, 2026-09-14 — adopted from leave-in T5/§8.6)**

**One record per product, always emitted, listing only what fired.** Three observations in this standard move no value but must reach a reviewer — the D4 overload counter-signal, the `multi_use` scope declaration, and claim-vs-formula mismatches. v0.1 scattered them across three sections with three different carriers. They are now carried in one record, reviewed as **one item** (the seventh reviewed row alongside fields 1–6 — §9.5E, R9).

```jsonc
{
  "hinweise": {
    "fired": [
      { "flag": "protein_payload" | "protein_tail_only" | "multi_use"
              | "claim_formula_mismatch" | "tail_marker" | "formula_conflict"
              | "boundary_position_ingredient" | "tail_protein_cluster"
              | "candidate_below_tail",
        "value": "<the flag's own value>",
        "note": "<one line: what fired, and what it does not mean>" }
    ]
  }
}
```

**Rules.**

1. **Always emitted, never omitted.** An empty `fired` array is the normal case and is written out as an empty record, so *"no Hinweise"* and *"Hinweise not researched"* stay distinguishable. This is why the record is emitted rather than conditional.
2. **Only fired flags appear.** `protein_payload` fires on a D4 heavy payload (§13). `protein_tail_only` fires where a protein species appears **only in the tail** — see below. **`tail_protein_cluster` (E12, 2026-10-05)** fires where **three or more distinct** hydrolyzed-protein/peptide/keratin species sit at or after `tail_index` — see below. `multi_use` fires when `multi_use: true` (§2.2), carrying the covered and uncovered modes. `claim_formula_mismatch` fires where exact-product positioning contradicts the formula read (a "Bond" pack with `bond_route: none`; "Feuchtigkeit" naming with no qualifying cluster; "reichhaltig" on a `weight_potential: low` leanness result — **(E4, 2026-09-14)**, restated because the `thin fatty base` term this example used is deleted; "leicht" on a `weight_potential: high` anchor). `tail_marker` fires on `absent` or `unresolved` (§3.1, §3.1.1). `formula_conflict` fires on either §2.4.1 tier. **`boundary_position_ingredient` (E1, 2026-09-14)** fires where a species at `tail_index − 1` is **load-bearing** for a value under §9.1's boundary-position rule — naming the species, its rank, `tail_index`, each value that hinges on it, and what each of those values would be without it. Like every other flag here it **moves no value**; unlike the others it **does** carry a confidence consequence, but that consequence is imposed by §9.1 and §9.2's confidence rules, not by this record — the flag reports it, and the one-line note states plainly that the value *"hinges on a boundary-position ingredient"*. A `tail_index − 1` species that is not load-bearing does not fire it. **Operational note (round-2 triage, 2026-10-06):** where the only value-relevant reading of a `tail_index − 1` species is a **full-list** conjunct (§9.2's E7 single-cationic count), the note is **informational only** — that count is position-independent, so it carries no confidence cap (§9.2 confidence rule). **`candidate_below_tail` (E13, 2026-10-06)** fires where a conditioning-relevant extra — a second cationic, co-quat, oil or butter, silicone or cationic polymer — sits **at or below** a **plausible** marker **and** would otherwise have qualified a `conditioning_level` or `weight_potential` anchor (§3.1.1): it names the species, its rank, the marker and the marker's rank, and the value it would have moved. It moves no value and caps no confidence; it **fires the `candidate_below_tail_review` trigger** (§14). It does not fire on a marker that is `unresolved` (§3.1.1's consequences govern there instead), and tail **proteins** stay with `protein_tail_only` / `tail_protein_cluster` (rules 3–4), not with this flag.
3. **Tail-only protein payloads are a note that moves no value (R8, 2026-09-14).** A hydrolyzed protein, peptide or keratin species declared **at or after `tail_index`** is a sub-1 % hero tail: the §3.1 tail rule applies without exception, so it contributes **nothing** to `care_direction`, `repair_support_level`, `damage_fit` or the `repair` focus, and it is **not** a D4 payload either (D4 counts above-tail species). It is recorded here, with the species and ranks, and with a note stating plainly that the payload is present and carries no classification credit. **This flag may not cap a confidence, fire a review trigger of its own, or move any value** — except via the E12 cluster rule below — it exists so that a reviewer who sees "Keratin" on the pack and "Keratin" in the list, and a `care_direction: moisture`, can see that the engine saw it too and why it earned nothing. Where a protein species sits **above** the tail, D4 and §9.3 govern instead and `protein_payload` is the applicable flag.
4. **Tail protein cluster (E12, 2026-10-05, binding).** Where **≥3 distinct** hydrolyzed-protein/peptide/keratin species sit at or after `tail_index` (free amino acids do not count), the `tail_protein_cluster` flag fires in place of `protein_tail_only`, naming every species with its rank and `tail_index`. It still moves **no value** — below the marker the order is arbitrary and the dose unprovable, and crediting the cluster would reward label cocktails — but unlike `protein_tail_only` it (a) **caps `care_direction` confidence at `moderate`** and (b) **fires the `tail_protein_cluster_review` trigger**, because hydrolyzed proteins are the one ingredient class that is plausibly functional below 1 %: a cluster this size is either pixie dust or a real formula identity, and only a human can weigh the pack against the list. Ruled by Nick on #01 Hask Argan Oil (4 tail proteins behind PARFUM @6): value stays `moisture`, doubt becomes deterministic and visible instead of free text. This closes the D4 above-tail detection blind spot (AP-D4-BLINDSPOT).
4. **The per-observation rules are unchanged.** §13, §2.2, §3.1 and §2.4.1 still decide whether something fires; §13.1 only decides how it is carried. Nothing gains or loses a state.
5. **Nothing here is a score and nothing here projects.** The record is not part of the nine-field profile, is never a comparison field, never a user-facing verdict, and never a suitability exclusion. Its only downstream consequence is the review routing the individual rules already carried.
6. **Never compute a matrix over it.** Collapsing several observations into one record does not make them a set that can be reasoned over, ranked, or scored.
7. **The banned vocabulary of §13 applies to every note in this record**, as does the potential-not-performance wording rule (§7).

---

## 14. Human review triggers

Require targeted human review for:

**Inherited from Conditioner §12:**

- product-form ambiguity;
- formula-source conflict;
- absent exact-market formula or identifier;
- proprietary bond/repair claim;
- root/scalp application;
- fragrance-free / hypoallergenic implication;
- multi-product or routine-level efficacy evidence;
- a directional detailed-trace rinse-behavior or buildup value;
- a proposed hard user-fit rule;
- any attempt to replace current production fields.

**Mask-specific additions:**

| Trigger | Fires when |
|---|---|
| `bond_claim_review` | The product carries Bond/Plex/Bonding positioning **but no nameable bond-chemistry INCI token above the tail** (R7). This is expected to be the single most frequent mask trigger — "Bond" front-of-pack is frequently an ordinary rich mask (evidence §6) |
| `multi_use_directions_ambiguity` | Authoritative directions cannot be resolved into exactly one qualifying rinse-out mask mode (§2.2 step 5) |
| `express_dwell_unknown` | The product's stated dwell is in the **7-second segment**, which is outside all tested contact times. The record must carry `dwell_efficacy: unknown` and must not extrapolate in either direction (evidence §3) |
| `protein_payload_review` | D4 heavy protein payload (§13) |
| `tail_protein_cluster_review` | ≥3 distinct tail protein species (§13.1 rule 4, E12) |
| `candidate_below_tail_review` | **(E13, 2026-10-06 — new.)** A conditioning-relevant extra at or below a plausible marker would otherwise have qualified a `conditioning_level`/`weight_potential` anchor (§3.1.1, §13.1 `candidate_below_tail`). The value holds its rank-supported reading; a human weighs whether the list's tail order hides real architecture. Never fires on an `unresolved` marker (that is `tail_marker_unresolved`) |
| `gloss_lamination_claim` | Any Gloss / Glaze / Laminierung / Lamination positioning (charter F4) — verify the shine threshold was met independently and the banned wording is absent |
| `tail_marker_anomaly` | Tail marker **`absent`** — no tail-class species appears in the list at all (§3.1). **(R2, 2026-09-14 — narrowed:** this trigger no longer covers the implausible-marker case, which has its own trigger below) |
| `tail_marker_unresolved` | **(R2, 2026-09-14 — new.)** Tail marker `unresolved` under the §3.1.1 plausibility conditional — the marker outranks a species establishing `conditioning_level`/`weight_potential` (E13, 2026-10-06; below-marker extras never count), or the product is a low-water/non-emulsion architecture. Every field whose read touched the marker boundary is listed with the trigger; the two are separate triggers because their remedies differ (an absent marker needs a fuller capture; an implausible marker needs a human to read the architecture) |
| `formula_conflict_convergence` | **(R8, 2026-09-14 — new.)** A §2.4.1 **tier-1** convergence resolution was applied: the formula of record was re-anchored, outliers demoted, identity stepped to `verified_with_minor_source_difference`, confidence stepped down one. A human confirms the re-anchoring |
| `formula_source_conflict` | **(R8, 2026-09-14 — new.)** A §2.4.1 **tier-2** formula-set conflict: affected fields are `unknown` and the record is not publishable beyond its identity block until the conflict is resolved |
| `missing_sourced_contact_time` | TPL-MASK/P5 has no sourced contact time. The product is **not stampable** and goes to Nick. (The research profile may still complete; the protocol may not) |
| `weight_high_conflict` | `weight_potential` reached the `high` anchor while exact-product positioning materially claims lightness (§9.2 fallback applied) |
| `low_confidence_field` | Any of the nine fields lands at `low` confidence |
| `specialist_damage_fit` | `damage_fit` resolved to `moderately_damaged` + `highly_damaged` — verify the specialist route genuinely qualified. **(R9, 2026-09-14)** `damage_fit` is an echo field and is not separately reviewed, but this trigger still fires: it routes the reviewer to the **specialist route** (`repair_support_level` / `bond_route`) that produced the result, which is reviewable |

**Note on echo fields (R9, 2026-09-14).** No trigger is removed by the echo ruling. A trigger that names an echo field routes a human to the *driving* field; the echo itself is never the thing adjudicated.

---

## 15. Calibration rule

**Blind reviewers receive this standard and the locked formula/source packets — never the proposed key.**

Compare: exact agreement, adjacent agreement, mean absolute difference, maximum difference, systematic drift, completion, and coded causes. Every difference is explained as one of: source ambiguity, missing evidence, rule ambiguity, double counting, overconfidence, or legitimate uncertainty.

Report separately:

- raw exact agreement overall and **per field**;
- label prevalence per field (this matters here: `moderate` is expected to dominate fields 1 and 2, so raw agreement will flatter the scale — report **conditional agreement** for default-heavy fields);
- confidence distribution;
- **deterministic-property agreement separately** (`bond_route` and `ingredient_flags` should be at or near 100%; anything less is a lexicon defect, not a judgment disagreement);
- every disagreement and its adjudication.

**Systemic rule changes require a pilot rerun.** Product-specific uncertainty remains uncertainty. Passing shows research-process repeatability, not real-world outcome accuracy. **(R1–R9, 2026-09-14)** R1–R9 are systemic by this definition. Any record derived under v0.1 must be re-derived under v0.2 before it appears in an agreement, repeatability or distribution statement.

**Prevalence is a finding, never a criterion (R3, 2026-09-14).** §15 reports label prevalence per field. That report exists to expose a scale that has collapsed to one value, **not** to set a target. No threshold in §9 may be tuned toward an expected distribution: if the real German shelf earns a value, it keeps it. The one legitimate inference from prevalence is the §9.1 honest-limitation question — whether a three-step scale is supportable at all — and that is a question about the *scale*, not about individual products.

**The four Phase-3 provisional defaults — status after R1–R9 (2026-09-14).** The Phase-3 checkpoint accepted four technical defaults on the understanding that calibration would test them. Their status is now:

| Phase-3 default | Status |
|---|---|
| **S1 two-of-three arithmetic** (`conditioning_level`) | **Superseded by R3, then amended by E1.** S1 is mandatory for `high`, completed by S2 or S3, with the material-counter-signal cap. **(E1, 2026-09-14)** R3's tail-edge *exclusion* is withdrawn: a `tail_index − 1` species carries its signal in full and the dependent value is capped at `moderate` confidence with a `boundary_position_ingredient` note. The `low` end (0 of 3) is unchanged and still provisional |
| **Moisture-`high` first-five-ranks rule** (§9.5.3 confidence) | **Unchanged and still provisional.** R5 amends criterion 2, not the confidence cut; it remains a `[judgment call — review]` |
| **No-tail-marker moderate cap** (§3.1) | **Unchanged and still provisional** for the marker-**absent** case. R2 adds a *separate* rule for the implausible-marker case — it does not replace this one |
| **Protein-flag trigger** (multiple R5 above tail, or one in the top five — §13) | **Unchanged and still provisional.** R8 changes how the flag is *carried* (the `hinweise` record, §13.1), not when it fires |

**v0.2 status.** This document is **pre-calibration**. No blind lane has run against it and **no repeatability claim exists**. The anchors most likely to move on first contact with real formulas, in priority order (R1–R9 revised, 2026-09-14):

1. the `weight_potential` **dense-fatty-base** cut (§9.2) — R4 fixed the structure of the `high` anchor; the two-species / top-three thresholds inside it remain an unruled judgment call. **(E4, 2026-09-14)** The thin-fatty-base cut is gone: the `low` anchor's three conjuncts are ruled, and **(E7, 2026-09-30)** so is the single-cationic conjunct's counting scope (full list);
2. the S1/S2/S3 signal definitions and the `low` end of the `conditioning_level` scale (§9.1) — a three-step scale remains at the edge of INCI support; R3 fixed the `high` end only;
3. the `care_direction: protein` rank-8 / two-species test (§9.3), and — new under R6 — how often `balanced` reading (b) is actually reachable on a real mask shelf;
4. whether `detangling` is ever selected in this category (§9.5.2 step 7). **(E6, 2026-09-14)** The `lightness` half of this item is **withdrawn, not answered**: the value is out of the vocabulary, so there is nothing left to observe. What the calibration set should watch instead is where the lean masks that would have taken it actually land — on `general` at step 8, or on a route they earn in their own right;
5. whether §2.4.1 tier 1's three-source convergence bar is reachable on drugstore masks, or whether tier 2 will dominate;
6. the R5 lipid-led disqualifier's `≥ 2 R4b` count (§9.5.3 criterion 2) — how much of the shelf it removes from the `moisture` headline.

Calibration product selection, the frozen cohort, the envelope/adapter schema, and the runbook are **out of scope for this document** and are separate Phase-4 artifacts.

---

## 16. Conditioner deltas

### 16.1 Where this standard deviates from Conditioner v1.6 — and why

| # | Area | Conditioner v1.6 | Mask v0.1 | Why |
|---:|---|---|---|---|
| 1 | **Category boundary** | Masks/deep treatments are an **excluded form** (§2) | Masks are **the** category; a multi-use product none of whose rinse-out modes clears the G0 conjuncts is excluded here | Charter category definition; **no MODE is profiled twice (R1, 2026-09-14)** — a multi-mode product may hold one profile per engine |
| 2 | **Multi-use products** | Excluded outright ("multi-use products permitting materially different rinse-out and leave-on behavior") | **Eligible, mode-scoped** — classified only in the rinse-out mask mode, with a `multi_use` envelope naming uncovered modes. **(R1)** A self-labelled 2in1 with a qualifying 2–3-min Kur mode is in scope even where its other mode is Conditioner-engine territory | Charter F1 as corrected by R1. Eight such products are live and `is_chaarlie_recommended`; excluding them would forfeit the coverage target |
| 2a | **G0 placement conjunct (R8, 2026-09-14)** | n/a | "To lengths and ends" is **not** a G0 conjunct; unstated placement defaults to the P5 canonical placement. Three conjuncts remain: after cleansing · stated contact time · rinsed out | Silence about placement is the normal state of a German mask pack; failing G0 on a bookkeeping absence fails toward exclusion, not toward evidence (§1.1) |
| 2b | **Conservative-failure invariant (R8, 2026-09-14)** | Implicit in individual fallbacks | **Stated once, globally (§1.1):** every hard rule fails toward review or the conservative value, never toward a recommendation — and is the admission test for future amendments | Adopted from leave-in T17/§1.1 so the mask engine and the leave-in engine share one invariant |
| 2c | **Source-conflict precedence (R8, 2026-09-14)** | Conflicts preserved; no rule for choosing the formula of record | **§2.4.1 two tiers:** three-source convergence incl. one GTIN-anchored German retailer → formula of record, confidence stepped down, review routed; otherwise `unknown` + `formula_source_conflict` | Adopted from leave-in T18. Classifying from whichever capture a packet froze as primary is a source preference wearing a procedural disguise |
| 3 | **Reference distribution** | Anchored across conventional rinse-out conditioners | Anchored **within the mask shelf** — the same formula may read one step lower here | Evidence §1: masks shift richer on one continuum; a shared scale would push the whole category to `high` |
| 4 | **Field 1 name/semantics** | `conditioning_level` from `conditioning_deposition_potential` | `conditioning_level` as the **`concentration` twin** — overall treatment intensity from structural position only | D1 (binding) |
| 5 | **Structural-signal formalism** | Prose ("count architecture, not ingredient points") | Explicit **S1/S2/S3** signals with a counting rule and a `moderate` fallback. **(R3, 2026-09-14)** S1 is **mandatory** for `high`; the "no material counter-signal" conjunct is operative with a closed list. **(E1, 2026-09-14)** A `tail_index − 1` species **does** carry its signal; the dependent value is capped at `moderate` confidence and flagged instead | D1 requires "extremes need multiple independent structural signals" + NEQI-pattern fallback; evidence §2 names the honest and false signals. R3 fixes three per-product evidence defects and sets **no distribution target** |
| 6 | **Tail marker** | The under-1% boundary is acknowledged as invisible; no operational marker | An explicit **`tail_index` rule** with a tail-class list and anomaly handling. **(R2, R8, 2026-09-14)** Plus the **plausibility conditional** (§3.1.1, leave-in T16), a widened tail-class list, and **colourants removed from the marker classes** with a precedence note | D1: "ingredients after the fragrance/preservative block contribute nothing" needs a reproducible cut for a blind lane. R2 replaces a rank threshold with an architecture comparison, in both directions (§1.1). **(E13, 2026-10-06)** The comparison is against the species *establishing* fields 1–2 only — the leave-in v1.0 clause-5 wording; below-marker extras never flip it and route to review via `candidate_below_tail` |
| 6a | **`weight_potential` evidence base (R4, 2026-09-14)** | Weight-high = rich base plus one supporting route | **No cationic gate.** `high` = heavy-lipid core above the marker **+** dense fatty-alcohol base **or** occlusive silicone stack. `low` = a **positive leanness test** — **(E4, 2026-09-14)** no R4b above the marker + no occlusive stack + a single cationic species (**counted on the full list — E7, 2026-09-30**); the structural fatty-alcohol conjunct is deleted | Evidence §8: the weight driver is fatty-alcohol/butter load, not cationic breadth and not silicone. An absence-based `low` would fail toward a favourable fine-hair fit (§1.1). **E4:** a conjunct that fails on a rank-2 structurant fatty alcohol fails on the category baseline, and the catalog's ten curated light masks prove `low` must be reachable for creams |
| 7 | **Focus vocabulary** | Eight values | **Eight, but not the same eight (E6, 2026-09-14)** — plus `moisture`, minus `lightness`. The count coincides; the set does not | D5 (binding), ruled by Nick 2026-09-04, provenance Shampoo Focus v1.5; then E6 (2026-09-14) removing `lightness` |
| 7a | **`lightness` focus — conditioner-parity delta (E6, 2026-09-14)** | `lightness` is a live focus value | **Not a value at all.** Removed from the vocabulary and its §9.5.2 step-3 route deleted; `weight_potential: low` carries the information instead | **A deliberate divergence, ruled by Nick**: masks are not bought for lightness, so the category's one forced headline must not be spent naming a deposition property the profile already reports. The conditioner shelf is different — a light conditioner is a thing a user shops for — so this delta is **mask-scoped and is not a proposal to change Conditioner v1.6**, which keeps `lightness`. Whether the conditioner engine should follow is **not** asked here and is not implied; it joins the parked reconciliation items in §18.9 |
| 8 | **`moisture` guard** | n/a | Cluster guard: ≥ 3 distinct humectants above the tail, ≥ 2 non-glycerin, no richer route winning. **(R5, 2026-09-14)** Plus an operational **lipid-led disqualifier** on criterion 2 — ≥ 2 R4b heavy lipids above the marker, or the whole cluster ranked below the highest R4b lipid — **focus only**, `care_direction` untouched | D5, tested on four real formulas (Balea Aqua Hyaluron, Guhl 30 sek pass; Gliss Bonding, Pantene Bond fail). R5 closes the reading in which a rich nourishing Kur takes the moisture headline on its cluster alone |
| 8a | **`balanced` semantics (R6, 2026-09-14)** | `balanced` = substantive mixed architecture; never a "neither" bucket | **Two co-equal readings:** (a) both-substantive (material R5 route **and** humectant cluster), (b) neither-dominant (film- or acid-led, four clauses). The **lipid-leg shortcut is deleted** — "protein + generic lipids" now reads `protein`. The reading is recorded | Aligned with leave-in T19 on Nick's own "balanced can also be both-not". `balanced` bridge-matches downstream, so the deleted lipid shortcut was a real inflation cost |
| 8b | **Focus tie-break scope (R7, 2026-09-14)** | Claims may break a `dual_supported` tie | Same, **at any step of the §9.5.2 hierarchy**, including which candidate takes primary vs secondary | v1.5 discipline, verbatim in substance: break ties yes; create routes or upgrade `nonspecific` never |
| 9 | **New route R9** | No humectant route | **R9 humectant cluster** + mechanism **M5**, kept disjoint from M1 | The `moisture` focus needs a route to hang on, and it must not be satisfiable by a rich emollient base |
| 10 | **Formula-first care verdict** | Not present | **`focus_care_verdict`** (repair/moisture/dual/nonspecific/not_applicable) + `claim_role`, with "claims may break a dual tie, never upgrade nonspecific" | Adapted from the approved Shampoo Focus v1.5 discipline, as D5 instructs for Phase 3 |
| 11 | **`bond_route`** | R7 is a review flag; `bond_specific_support` is a graded direct property | A **deterministic four-value enum** (`maleate`/`gluconamide`/`peptide`/`none`) that **gates** `repair_support_level: high`, requiring a nameable INCI token | `01_property-set-v0.md` trace-level ruling + charter F3. Bond positioning is far more common on masks than on conditioners |
| 12 | **Free amino acids** | Not called out | **Explicitly non-qualifying** for R5 | Mask "Repair"/"Reparatur" naming is dense; amino-acid tokens would inflate `care_direction: protein`, `repair_support_level: medium`, and specialist `damage_fit` |
| 13 | **Gloss / lamination** | Not addressed | **R6a context** + a three-criterion `shine` threshold + absolute banned-wording list; **no lamination property** | Charter F4 + D2 + evidence §7: lamination is positioning, glycolic acid plasticizes temporarily and does not seal |
| 14 | **Lipid route granularity** | Single R4 | **Three bands (E14, 2026-10-06):** R4b heavy (butters, lanolin, coconut, castor, hydrogenated fats, occlusive hydrocarbons) feeds the `weight_potential: high` core; the **mid band** (olive, argan, soy, apricot, sunflower, macadamia …) blocks `low` but never makes `high`; R4a light carries no weight signal | Evidence §8: butter/heavy-triglyceride load is the weight driver; evidence §1: masks carry heavier lipids |
| 15 | **Silicone and weight** | `weight_deposition_potential` false-signal rule says "silicone-free is not light" | Same, **plus** the positive direction closed: "silicone presence is not the weight driver" | Evidence §8 states the driver explicitly. Masks carry more silicone, so the inflation risk is larger |
| 16 | **Dwell / heat** | Not applicable (conditioners have no meaningful dwell axis) | **Explicitly zero classification credit**, with the 7-second segment marked `unknown` and a dedicated trigger | Evidence §3 and §4 + `01_property-set-v0.md` "explicitly protocol-only". This is the category's biggest temptation to over-infer |
| 17 | **Overload handling** | Not addressed | **D4 rule**: trace counter-signal + `care_direction` confidence cap + review trigger; never a field, never diagnosis language. **(R8, 2026-09-14)** Carried, with `multi_use` and claim/formula mismatches, in one always-emitted **`hinweise` record** (§13.1) — including tail-only protein payloads as a note that moves no value | D4 (binding) + evidence §5: "protein overload" is not an established condition. The record is a review-surface decision (leave-in T5), not an evidence decision |
| 17a | **Echo fields (R9, 2026-09-14)** | Fields 7–9 are reviewed fields | Fields 7–9 are **echo fields**: deterministic projections displayed as „→ ergibt:" annotations on their driving rows, not separately reviewed. **All three still emitted, in envelope and projections; `suitable_thicknesses` still projects** | Leave-in T8: reviewing a projection asks a human the same question twice and lets the two answers diverge. Seven reviewed rows per product |
| 18 | **Thickness vocabulary** | fine / medium / coarse | fine / **normal** / coarse | Repo canonical vocabulary. Same middle value, no semantic change |
| 19 | **`usage_role` / `scalp_application_fit`** | Excluded, with the reasoning that a mask/intensive protocol "belongs to its applicable product-form boundary" | Excluded **and** the protocol explicitly owned by TPL-MASK/P5 (`replaces_conditioner`, Längen und Spitzen, required sourced contact time) | The boundary Conditioner v1.6 pointed at is this document's P5 boundary |
| 20 | **Scalp reasoning** | R8 carries a root/scalp suitability discussion | R8 notes that a directions-compliant mask is **not a scalp product**; whole-head directions are a P5 deviation | P5: Ansatz aussparen |
| 21 | **`detangling` expectation** | A live primary focus in the pilot | Same threshold, but **expected rarer** — slip is category baseline | Evidence §1: the mask baseline already delivers slip |
| 22 | **Lock status** | Locked v1.6, logic approved, calibrated (22/22 on the two new fields) | **Draft v0.1, pre-calibration, zero repeatability claim** | First-set-then-adjust caveat in `01_property-set-v0.md` |
| 23 | **Production adapter** | Conditioner Production Adapter v1 may derive compatibility rows after research | **No adapter, no projection, no writes** — D2 records the intended derivation as a note about the target only | Charter stop condition |

### 16.2 Where this standard deliberately matches Conditioner v1.6 — and why

| Area | Match |
|---|---|
| **Nine-field shape and vocabulary** | Identical **fields**; identical value sets except in the focus field and the thickness vocabulary naming. Ruled: conditioner-parity profile (`01_property-set-v0.md`). **(E6, 2026-09-14)** The focus exception is now two-sided — `moisture` added (D5) and `lightness` removed (E6) — so the focus vocabulary is the one place the two engines' value sets deliberately differ in both directions. See §16.1 rows 7 and 7a; every other field remains at parity |
| **Evidence scale E0–E5** | Inherited verbatim in substance, including the E2 formula-only ceiling and "reviewer agreement measures repeatability, not truth" |
| **EU Art. 19 semantics** | Inherited verbatim: descending above 1%, arbitrary below, boundary invisible, never infer percentages, pH, MW, droplet size, dose, or process |
| **Evidence record shape** | Conditioner §4 field list inherited whole; mask-specific fields appended, none removed |
| **Routes R1–R8** | Same route IDs, same permitted-statement discipline, same "presence proves a clue" boundary. Only the deltas above are added |
| **Shared mechanisms M1–M4** | Inherited unchanged; M5 appended |
| **Anti-double-counting (G3)** | Inherited unchanged, then tightened with three mask-specific applications |
| **Direct-property table shape** | Conditioner §7 pattern, including the "`higher` needs multiple independent endpoint-relevant observations" rule and the potential-not-performance wording rule |
| **`care_direction` semantics** | **v1.6 value names and bars retained** — `protein` needs a material film route, `moisture` is the coherent non-protein direction, and `balanced` is never an *uncertainty* bucket. **(R6, 2026-09-14 — one deliberate divergence, moved to §16.1 row 8a:)** `balanced` is no longer reserved for substantive mixed architecture alone; a film- or acid-led architecture in which neither leg leads reads `balanced` / `neither_dominant`. Conditioner v1.6 reconciliation is parked (§18.9) |
| **`repair_support_level` semantics** | v1.6 low/medium/high meanings inherited; only the `high` gate is made deterministic |
| **Focus hierarchy discipline** | Baseline exclusion, mechanism grouping, special-purpose-routes-first, positioning corroborates but never creates, catalog values never break ties, required focus explanation, at most two secondaries that must add distinct endpoints |
| **`damage_fit` specialist-route pattern** | Inherited exactly, including "the specialist result **replaces** the general-high set; never emit all three values". **(R9, 2026-09-14)** The *mapping* is unchanged; only its review surface moves (echo field) |
| **`texture_fit` mapping** | Conditioner 10.4 pattern inherited unchanged. **(R9, 2026-09-14)** Unchanged as a mapping; echo field for review purposes |
| **`weight_potential` conflict fallback** | The NEQI rule inherited: never encode unresolved uncertainty as a restrictive `high` that removes fine hair from the broad prior |
| **Gates G0–G7** | Same seven gates, same meanings; G0 and G7 re-scoped to this category and this draft status |
| **Human review triggers** | Conditioner §12 list inherited whole, then extended |
| **Calibration method** | Conditioner §13 pattern: blind reviewers get standard + packets, never the key; the same seven comparison metrics; systemic changes force a rerun |
| **Research/production separation** | Inherited and reinforced by the charter stop condition |

---

## 17. Template coverage map

Mapping to `category-classification-engine-template.md` (the 12-section shell), for the acceptance check:

| Template section | Satisfied by |
|---|---|
| 0. Failure discipline **(R8)** | §1.1 conservative-failure invariant |
| 1. Category boundary | §2.1, §2.2 (charter-derived, R1-corrected) |
| 2. Input authority | §2.3, §2.4, §2.4.1 source-conflict precedence **(R8)** |
| 3. Direct product properties | §7.1, §7.2, §9 (per-field: values, signals, thresholds, counter-signals, confidence, fit consumers) |
| 4. Evidence lexicon | §10 |
| 5. Deterministic vs judgment | §4 (`decision_type`), §9 per field; deterministic = `bond_route`, `ingredient_flags`, fields 7–9 (**echo fields — §9.5E, R9**); claim-gated = `shine` corroboration, `color_care`, bond claim, and the §9.5.1 `dual_supported` tie-break (**R7**); not inferable = §7.2 |
| 6. Formula/input-first sequence | §11 |
| 7. Confidence | §4.1, plus a per-field confidence rule in every §9 subsection |
| 8. Product truth vs user fit | §9 (fields 1–6 = product truth; fields 7–9 = broad fit priors), §9.9 |
| 9. Calibration and holdout | §15 (cohort selection itself is out of scope for v0.1) |
| 10. Validation and artifacts | §4, §11 step 2 (frozen packet hash), G7 |
| 11. Activation gate | §9.9, charter stop condition — no activation is implied anywhere |
| 12. Acceptance checklist | §16 plus this table |

---

## 18. Open questions for the first-set review

**Closed by the 2026-09-14 rulings — recorded so they are not reopened by habit:**

| v0.1 question | Closed by |
|---|---|
| **1. `weight_potential: high`** — all four markers, or base-plus-one? | **R4.** Neither: the cationic base gate is removed entirely. `high` = heavy-lipid core + (dense fatty base **or** occlusive stack); `low` = a positive leanness test (§9.2) |
| **2. `conditioning_level` counting**, `high` half | **R3, amended E1** — for the `high` end only: S1 is mandatory, completed by S2 or S3, with the material-counter-signal cap; **(E1)** boundary-position species count and cap confidence rather than being struck. **The `low` end and the three-step-scale question stay open** — see §18.1 below |
| **5. `damage_fit`** — computed row or reviewed field? | **R9** — for the *review surface*: it is an echo field, annotated not adjudicated. **The storage half stays open** — see §18.5 below |
| **8. Tail-marker absence rate** | **Partly, by R2.** The implausible-marker case now has its own rule and its own trigger, so it no longer rides on the absence cap. The *absence* rate question itself stays open — §18.8 below |
| **13. `lightness` focus reachability** (opened under E4, 2026-09-14 — the shortest-lived question in this document) | **CLOSED by E6 (2026-09-14), and closed by removal rather than by an answer.** The question asked whether `lightness` was the right headline for a lean conventional Kur, or whether step 3's two-condition test was too thin to sit that high in the hierarchy. Nick ruled neither: **masks are not bought for lightness**, so the value leaves the vocabulary and the step-3 route is deleted (§9.5, §9.5.2). The calibration set is therefore **not** asked to test a threshold here — there is no threshold left. **It is not reopened by observing that a lean mask now reads `general`:** that is the ruled outcome, not a symptom. What remains observable, and is carried in §15's priority list item 4, is where the lean masks land instead. The ruling also settles the second-order half E4 had left loose — E4's leanness test **applies uniformly** to every record that satisfies its three conjuncts, and E6 is what prevents that uniform application from rewriting those records' headlines |

**Closed or answered by the 2026-09-30 round-2 rulings (E7–E11):**

| Question | Closed by |
|---|---|
| **§18.2, scope item** — is the leanness test's single-cationic conjunct counted on the above-tail segment or the full list? (AP-07-CATIONICSCOPE, AP-09-CATIONICSCOPE) | **E7.** Full INCI list (§9.2). Cohort effect: #07 and #09 `low` → `moderate`; #08 and #12 keep `low`. The dense-base half of §18.2 stays open |
| **§18.3, boundary item** — does R3's tail-edge exclusion reach the §9.3 material-R5 test? (AP-04-R5TAILEDGE) | **E8.** No: a `tail_index − 1` species counts normally and caps confidence at `moderate` (§9.3), mirroring E1. #04 keeps `protein`. The two-species / rank-8 bar itself stays open |
| **§18.4, reading (b) reachability** — narrowed | **E9** rules clause 2 needs a silicone *system* (§9.3). **This run's answer: reading (b) is reached by no record in the first cohort** (#07 fails clause 2 under E9; #11 already failed clause 4). It stays in the vocabulary, reserved for genuine structural outliers; §18.4's residual is whether any such outlier exists on the German shelf |
| **Secondary-slot seam** — may a `moisture` secondary attach under a `general` primary? (AP-10-SECONDARYSLOT, filed against §18.6 in the first cohort) | **E10.** Yes, when the cluster independently meets criterion 1 (§9.5.2 secondary rule, §9.5.3 criterion 3). #10 gains `moisture` secondary. §18.6's gloss-cohort question is unaffected |
| **#02 unresolved-marker reading** (AP-02-BONDREADINGS) | **E11** — a product-level human resolution (reading B) under §14 `tail_marker_unresolved`. **No rule text changes**; unresolved markers still route to human review |

**Closed by the 2026-10-06 round-3 seam rulings (E13–E17, calibration round 2):**

| Seam | Closed by |
|---|---|
| **S1 — marker-plausibility scope** (which species make a marker implausible) | **E13.** Only species *establishing* `conditioning_level`/`weight_potential`; below-marker extras never do, and route to review via `candidate_below_tail` where they would have qualified an anchor (§3.1.1). No value moves |
| **S2 — oil band mapping** (lexicon mid band vs R4a/R4b) | **E14.** Three bands; mid blocks `low`, never makes `high`; olive/argan corrected to mid (§5 R4, §9.2). u2 weight `high` → `moderate` |
| **S3 — reading (b) clause-4 text + DPG class** | **E15.** Carrier/solvent glycols are not humectant-leg species (§5 R9, §9.3, §9.5.3); reading (b) is unavailable when any clause fails (§9.3 confidence rule). u3 `care_direction` `moisture` → `balanced` / `neither_dominant` — reading (b)'s first reached case, which also answers §18.4's residual question |
| **S4 — single-token repair headline** | **E16.** Repair headline needs `bond_route ≠ none` or a label-strong protein route (≥ 2 species, or one quaternized derivative, above the marker) (§9.5.2 step 3). u1 `primary_focus` `repair` → `general` |
| **S5 — mode scoping vs product-form exclusions** | **E17.** Formula-level exclusions are mode-independent (§2.2). u6 unchanged |

**Open for the first-set review (renumbered continuously; v0.1 numbering preserved where the question survives unchanged):**

1. **`conditioning_level` scale (was 2, narrowed by R3).** Does S1-mandatory-plus-one produce a usable spread on the real shelf, or does the field collapse to `moderate`? If it collapses, is a two-step scale more honest than a three-step one (evidence §2: three steps are at the edge of INCI support)? **Report prevalence as a finding about the scale, never as a target (R3).**
2. **`weight_potential` base cuts (new under R4; half of this question CLOSED by E4, 2026-09-14).** Is "≥ 2 distinct fatty alcohols above the tail, or a cetearyl-class one in the top three" (dense) the right cut for the `high` anchor's completer? That half stays open. **The thin-base half is closed:** the first cohort answered it — the thin-base test did **not** make `low` reachable, it relocated the unreachability, and E4 deleted the structural fatty-alcohol conjunct outright. The successor question is narrower and should be put to the calibration set: does the new leanness test (no R4b + no occlusive stack + single cationic) select `low` on roughly the products the catalog's curated light masks describe, or does it now select too many? **(E7, 2026-09-30)** The conjunct's counting scope is closed (full list; see the round-2 closed table); on the first cohort the test now selects `low` on **2 of 12** (#08, #12).
3. **`care_direction: protein` (was 3; boundary item closed by E8, 2026-09-30).** Is the "second species OR within first eight above-tail ranks" test the right bar, and should `Keratin Amino Acids` really be non-qualifying alone? The interaction with the marker boundary is settled — a `tail_index − 1` species counts and caps confidence (E8) — so this is now purely a question about the bar.
4. **`balanced` reading (b) reachability (new under R6).** How often is the film-/acid-led `neither_dominant` reading actually reached on German drugstore masks, given that clause 3 requires *no* humectant pair and *no* lipid stack above the tail? If it is reached never or almost never, is clause 3 too strict, or is the reading simply correct and rare? And how often does deleting the lipid-leg shortcut move a product from `balanced` to `protein`? **(E9, 2026-09-30 — narrowed.)** Clause 2 now requires a silicone system (§9.3), and the first cohort's answer is **never**: reading (b) fires on no record. The residual question is only whether a genuine structural outlier that earns it exists on the shelf.
5. **`damage_fit` storage (was 5, narrowed by R9).** R9 settles that it is not separately reviewed. Should it additionally stop being *stored* as a field and become a computed row at read time (watch-list item 1)?
6. **Gloss cohort (was 6, unchanged and now doubly live).** Do L'Oréal Glycolic Gloss, Syoss Lamination Intense Glaze and Neqi Gloss Glaze clear the three-criterion `shine` threshold on their real INCIs? **Added under R6:** do those same products now land on `care_direction: balanced / neither_dominant` rather than `moisture`, and is that the reading Nick wants for a gloss mask? **Added under E2 (2026-09-14):** the cohort's own Glycolic Gloss record is now marker-`unresolved` (allergen @12 against `Parfum` @30), so its `shine`-versus-`smoothing` and weight calls are review-routed rather than answered — this question can only be settled on a **re-fetched verbatim exact-pack INCI**, not on the aggregated capture.
7. **`bond_route: gluconamide` (was 7, unchanged).** Can the exact qualifying INCI token(s) be pinned from the Gliss 4-in-1 Repair Bond formula, so the enum value is as deterministic as `maleate`? Until then, `gluconamide` calls rest on reviewer identification and should be flagged.
8. **Tail-marker absence rate (was 8, narrowed by R2).** How often do exact-market drugstore mask INCIs lack any tail-class ingredient? If it is common, the marker-absent "cap at moderate" rule will dominate the confidence distribution. **Added under R2:** how often does the *plausibility* conditional fire, and does the low-water/non-emulsion limb ever fire on a rinse-out mask at all, or is it dead text inherited from a leave-on category? **Added under E2 (2026-09-14):** how often does the third limb (internally inconsistent class ordering) fire, and how much of that rate is genuine house listing convention versus retailer transcription damage that a verbatim re-fetch would remove?
9. **Upstream reconciliation (new under R1/R6/R8) — three named gaps.** (a) `01_property-set-v0.md` still carries D6's v0.1 `balanced` wording, which R6 amends; that file is outside this revision's write scope. (b) The **charter's Category definition** still reads "applied after cleansing **to hair lengths and ends**", while R8 removes placement as a G0 conjunct (§2.1); the charter was amended for **R1 only** on 2026-09-14, so the two texts differ on placement until Nick rules the charter wording. **The standard's §2.1 governs classification in the meantime, and the divergence is recorded rather than resolved silently.** (c) Does the **Conditioner v1.6** engine adopt the two-readings rule too (parked with the moisture-focus extension) or deliberately diverge?
10. **§2.4.1 convergence reachability (new under R8).** Is a three-source convergence bar — including one GTIN-anchored German retailer — reachable on the drugstore mask shelf, whose retailer coverage is thinner than the leave-in shelf's? If tier 2 dominates, a large share of the cohort becomes non-publishable on a rule imported rather than calibrated.
11. **Echo-field purity (new under R9).** `texture_fit`'s `high` row carries a second condition (a coherent high-slip R1/R3 route) and `damage_fit`'s specialist test admits legs (c) and (d). Should those be removed so both tables become pure projections of fields 1/2/4, or is the "read, never re-judge" convention in §9.8 enough?
12. **`hinweise` volume (new under R8; widened by E1).** How many products fire nothing at all? If the empty record is rare, the seventh reviewed row is not the light-touch item T5 intended and its contents may need splitting. **(E1, 2026-09-14)** `boundary_position_ingredient` is expected to be a frequent flag — a species one rank above the marker is common — so this question is now partly a question about *that* flag's volume specifically.
13. ~~**`lightness` focus reachability**~~ — **CLOSED by E6, 2026-09-14**; see the closed table above. The number is retired rather than reused, so no later question inherits its reference. **The successor question, and it is a different one:** now that E4's leanness test applies uniformly and `lightness` cannot absorb the result, does the cohort's `weight_potential` distribution itself look right against the catalog's ten curated light masks — and do the lean records land on defensible headlines at steps 4–8? That is §18.2's successor question plus ordinary focus review, not a new open item.
