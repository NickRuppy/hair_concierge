# Catalogue completeness fill — decision record

Origin: read-only prod catalogue audit 2026-10-09 (scannable/recommendable completeness), followed by research lanes R1–R5 (`research/`). Rulings below are Nick's, given in chat on 2026-10-09.

## Confirmed with Nick (2026-10-09)

**Selection logic**
- S1. Dry shampoo, deep-cleansing shampoo and scalp care join the shared Stage-3 ranking rule (full fit before partial fit → more matched user needs → fewer cautions → catalogue order → lower price), with the profile answers they need passed into the evaluator (scalp sensitivity, visible hair colour, volume goal; oily vs balanced scalp). Scalp care has no distinguishing property within a role → catalogue order, then price.
- S2. Bondbuilder ranks by claim trust level first (as on `codex/profi-tier-baseline`), then by how the product is used (pre-shampoo rinse-out / post-wash leave-in / overnight) matched to a new user preference. Budget cap behaviour from the Profi branch stays.

**Heat protection (leave-ins)**
- H1. Port the September evaluator fix (`23a83cfa`): a manufacturer heat claim plus a verified pre-heat protocol suffices; directions need not literally state pre-heat timing.
- H2. If the manufacturer claims heat protection, it counts (claim-led binary; ingredient alone does not create it). The six leave-ins currently `false` with a manufacturer claim flip to `true`.
- H3. Pantene Bonding (claim on P&G's German site) and Pantene HEAT&GLOW (claim on German back label) count as heat protection.
- H4. Bali Curls N°3: "schützt vor … UV-Strahlen, Hitze oder Luftfeuchtigkeit" is environmental, not styling heat → no heat protection, no pre-heat role; stays a post-wash leave-in (reverses the 2026-09-18 ruling).

**Heat activation (new property)**
- A1. "Needs heat to work" becomes a real property, set from manufacturer statements/directions. Products with it are offered only in the heat-styling routine — never as conditioner replacement, never as a plain post-wash leave-in — with bespoke guidance from the manufacturer's directions. Neqi Diamond Glass Ultimate Styling Spray is the first product.
- A2. Neqi spray must not be offered as a conditioner replacement (Nick: "it's a styling spray").

**Bondbuilder data**
- B1. Aveda: show the schedule branch matching the user's damage level (manufacturer: light–medium damage once a week; medium–heavy every wash day).
- B2. OGX: use the UK manufacturer page's "1–2 times a week".
- B3. K18: schedule copy from the German official manufacturer page.
- B4. Routine fixes: `category='Bondbuilder'` on the five October rows; Aveda GTIN 018084067994. The `repair` concern tag is dropped (no reader).

**Multi-use products**
- M1. Every product usable in several categories gets one catalogue row per category — in this batch (supersedes the 2026-08-28 "one barcode owner, alternate modes in protocols" interim). Includes scan (one barcode → several category rows), plan (no accidental double recommendation of one package), intake/research of all catalogue products for manufacturer-stated multiple uses.
- M2. Rule for whether a category row is legitimate: the manufacturer names that use. Wrong-category duplicates are retired (tombstone: inactive, discontinued, `replaced_by`; owners and GTIN move to the keeper): L'Oréal Midnight Serum oil row → keep leave-in; Pantene 7in1 leave-in row → keep oil. **Correction (2026-10-09):** Balea Tiefenreinigung keeps BOTH rows — Nick's Shampoo v1.6 ruling R6 (2026-10-07, `.worktrees/shampoo-v16/data/research/shampoo-inci/v1.6/rulings-ledger.md`): a deep cleanser may be listed as regular shampoo and as deep cleanser.

**User-submitted scan-visible products (14)**
- U1. The 8 ordinary shampoos/conditioners get standard shared category guidance (as ruled 2026-09-18).
- U2. Aussie SOS and Balea Hair Sealer follow the current Leave-In engine v1.1 (T20) result `balanced`.
- U3. Pantene Moisture Boost: replace the 800 ml pump GTIN with the 200 ml bottle GTIN 8700216939508.
- U4. Jean&Len rosemary mask: conservative reading (moisture, low repair); manufacturer contact time 5–30 min (masks carry per-product contact time).
- U5. Neqi Smooth Strength Rosemary Oil moves to Scalp Care; role reviewed by hair-care expert (growth claims are medically adjacent); unassessable until then.

**Earlier in the session**
- Use the research engines; research runs on Sonnet subagents.
- Duplicate pairs: keep both rows only if the manufacturer names both uses.
- Shampoo re-checks (incl. H&S DERMAXPRO intensity) stay with the Shampoo v1.6 program (`.worktrees/shampoo-v16`).

**Second round (2026-10-09)**
- D-a. Deep-cleansing scalp fit is ingredient-based via our own engine, not wording-only: use Shampoo v1.6 §13.5 scalp targets (S-OILY = oily positioning + formula gate: cleansing moderate/strong, weight not high, conditioning not high; S-DRY etc.) on the deep cleansers' formulas; v1.6 already keeps deep cleansers in its cohort (R6). Coordinate with the Shampoo v1.6 program.
- D-b. Aveda: moderate damage → once a week; high/severe → every wash day.
- D-c. Pantene HEAT&GLOW counts as heat-activated (its between-wash use is also a short blow-dry).
- D-d. Heat activation evidence: manufacturer only (German page or pack).
- D-e. Heat activation and heat protection are completely separate properties.
- D-g. Neqi Rosemary Oil → Scalp Care, role `density_claim_tonic` (recommendation accepted).
- D-f. Garnier Fructis Sleek & Stay Heat-Activated Serum (`c574ee6f`): take it out of Oils now (hidden from plan and scan until the Styling program picks it up as a heat-activated smoothing styler).
- D-h. Nick is merging PR #654 (Budget + Profi); S2 and S4 build on main after it lands. The heat-activation property (S3) is built so the Styling category can reuse it.

## Inherited from evidence or contract
- Claim authority for heat: Leave-In standard §2.4.1, §13.3. Application protocols only from manufacturer directions (product-research-engine invariants). Scalp-care schedules stay generic where no manufacturer frequency exists (R3). Elvital/Redken/Première bondbuilder schedules stay generic (no German manufacturer frequency, R2). Mask contact time is a required per-product slot (protocol templates P5). Production writes require Nick's approval of the exact reviewed batch.

**UX rulings (2026-10-09, mockups in `mockups/`)**
- X1 (S4, mockup 1). Keep the Bondbuilder routine question, shown only when the plan recommends a Bondbuilder, directly after the wash-frequency question. Short copy: „Wann passt der Extra-Schritt?" — „Vor dem Waschen" (Einwirken lassen, dann waschen.) / „Nach dem Waschen" (Drin lassen, nicht ausspülen.) / „Ist mir egal". No overnight option. Routine card: no extra line when the preference is met; one neutral line only when it cannot be met.
- X2 (S5, mockup 2). The scan result for a multi-use product looks like any single-product result and shows one verdict: the use the user's plan needs (else the best-fitting use). The use is chosen only when saving: sheet „Wofür verwendest du es?" (plan's use preselected). Each use's verdict chip opens that use's full result (2b) with a left/right footer „Zurück zur Auswahl" (primary) | „Trotzdem speichern" (secondary). After saving, the result shows the saved use. Buttons follow the iOS ChaarlieButton style.
- X3 (S5, mockup 3). One package in two plan slots stays two separate slots with the same product; the second slot says „Dieselbe Packung wie beim Conditioner"; the package counts once.
- D-h resolved: PR #654 merged 2026-10-09.

**S5 rulings (2026-10-09, third round)**
- O1. Keep the other-uses line on the multi-use result page (rendered as „Auch nutzbar als Maske › · Leave-in ›"; each link opens that use's full result).
- O3. One database row per category for the same product (same shopping link, image, price), each with its own category-specific properties; the rows are linked as one package.
- O4. The plan may put the same package into two slots (edge case, allowed).

- O2. Save flow (2026-10-09): one sheet „Wohin speichern?" — „Benutze ich schon als …" one row per use with verdict chip, plus „Auf die Merkliste"; one tap saves; single-use products keep today's sheet. Nick: "not great, but a rare edge case — do it like this." (`mockups/mockup-2-scan-multi-use.html`, frames 1–4.)

## Open
None. Production applies remain separate per-batch approvals.

## Superseded research statements
- `research/r4-user-submitted-14/findings.md`: Bali Curls heat protection → superseded by H4 (no heat protection); Neqi spray ordinary shared protocols → superseded by A1 (bespoke heat-activated guidance in S3).
- `research/x1-multi-use/facts.md` / `research/r3-*`: retiring the Balea Tiefenreinigung shampoo row → superseded (keeps both rows, Shampoo v1.6 R6); Pantene 7in1 retirement → moved to S5.


## Nick's answers to the 11 open questions (2026-10-13)
1. Bondbuilder tie without K18 → catalogue order, then price (OLAPLEX), Epres shown as equal option. ✔ **Superseded 2026-10-13 (Nick):** equally trusted, equally timed Bondbuilders rank cheapest first; the K18 house default is retired everywhere (timing question stays).
2. 68 already-finished drafts → silent assumed „Ist mir egal", nothing reopens. ✔
3. „Shampoo & Spülung" 2-in-1 → no extra conditioner row. ✔
4. iOS: only the „Auch nutzbar als" line + per-use view, no save sheet — OK for now, to be fixed later (iOS product saving = own project).
5. Pantene 7in1: affected plans re-pick the next-best leave-in. ✔
6. Dry shampoo tint → A: keep the decision-doc rule (universal product, no tint bonus).
7. Hair-loss scalp care (Neqi rosemary vs L'Oréal Anti-Haarverlust) → **A (Nick 2026-10-13, "1a")**: the standard selection rule decides (Neqi first by price); no L'Oréal evidence override.
8. Pantene HEAT&GLOW in 7 plans → be coherent with 5: affected plans re-pick the next-best alternative (reusable re-pick lane built in S3, reused by S5).
9. Neqi Diamond Glass spray not actively recommended. ✔
10. Heat-activated only for users who blow-dry ✔ — existing properties suffice (product `heat_activation_route` + profile heat events).
11. → **B (Nick 2026-10-13, "2b")**: Pantene HEAT&GLOW is not heat-activated (no heat-reactive ingredient; label allows use without heat). It stays a normal leave-in; the 7 plans keep it, no re-pick (supersedes 8 for HEAT&GLOW). Neqi Diamond Glass is the only activated product; activation still requires blow-drying with styling. Record: S3 `slice3/amendments/q11-b-heat-glow-superseded.md`.
