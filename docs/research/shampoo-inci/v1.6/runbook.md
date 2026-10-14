# Shampoo v1.6 new-product research runbook

Use this procedure to research a current German regular shampoo under the locked standard `shampoo-classification-v1.6` ([`classification-standard.md`](./classification-standard.md)). It produces a research record and a projection proposal. It never approves a catalog product, writes to Supabase or changes recommendations (standard Section 16).

It adapts the v1.4 runbook (`docs/research/shampoo-inci/v1.4/new-product-research-runbook.md`) to v1.6, and writes down the formula-freeze and sealed two-lane procedure practised in the v1.6 calibration (`data/research/shampoo-inci/v1.6/calibration/`: `freeze-brief.md`, the lane builders and the compare scripts), with two corrections for every new run: the lane kit is delivered in two stages so the blind formula pass really is blind (step 3), and the comparison counts `researchCombinationTargets` (step 5). The historical calibration kits were single packets with name, brand and claims co-delivered and without completeness or source-tier evidence; see the lock receipt's known limits and `data/research/shampoo-inci/v1.6/calibration/README.md`.

## Required inputs

- the locked standard and its SHA-256 from `data/research/shampoo-inci/v1.6/artifact-manifest.json`; verify it before a run (`npm run test:node` includes `tests/shampoo-research-v1-6-lock.test.ts`);
- an exact product identity candidate;
- read-only access to current German manufacturer and retailer sources;
- a new, versioned artifact root for the run (never the frozen calibration folder);
- for a validation batch: two independent classification lanes.

## 1. Pre-register before classification

For a batch, a holdout or an unseen check, freeze the exact candidates (and reserves) before any label exists. Record per slot: selection order and why it was chosen, exact brand / name / size, known GTIN/EAN aliases, catalog product id if one exists, selection source and date, expected formula availability, and why it is a regular shampoo (a deep cleanser stays in the cohort, standard 13.6).

Reject overlap with every earlier cohort (calibration gold set, earlier unseen sets, earlier holdouts) by normalized `brand + exact name` and by every GTIN alias. A product used to shape or adjudicate a rule is never a valid unseen product again (round-1 procedure note). Replace a blocked slot only with a pre-registered reserve, before any lane runs.

## 2. Freeze the formula packet (freeze worker)

One worker per product, read-only browsing, no classification. This is the procedure of `calibration/freeze-brief.md`:

1. **Identity.** Exact German product: name, brand, pack size, GTIN aliases, catalog product id.
2. **Canonical INCI.** Authority order (standard Section 2): exact German pack or current German manufacturer page; German retailers with the GTIN shown as corroboration; ingredient databases as support only. Never use a foreign-market formula for the German product, never merge lists across GTINs, sizes or reformulations.
3. **Conflicts.** Preserve every conflicting list verbatim. Pick a canonical list only when one source clearly wins (exact manufacturer pack, or at least two independent GTIN-anchored sources agreeing); otherwise the packet is `frozen_with_conflict` or `blocked` (ID-3). A conflict is never resolved inside a lane.
4. **Fingerprint.** SHA-256 of the canonical list after lower-casing, trimming, collapsing whitespace and joining with `|`. State the normalization in the packet. Position citations in records use the ID-2 normalized numbering.
5. **Positioning.** German claims and usage directions verbatim, per source, with source type (`manufacturer` or `retailer`) and URL. Claims are graded later by CL-SRC/E1, so keep the source type exact; keep pack front/back apart when the source shows it.
6. **Web hygiene.** Decline non-essential cookies, no logins, no forms. If a page fails or hangs twice, record it and move on.
7. **Evidence inputs for the blind pass (standard Sections 2, 3.1, ID-1).** Record `formulaCompleteness` (`complete` only for an approved, canonical full-INCI capture of the exact product without a material conflict, ID-1; otherwise `not_known_complete`), `formulaSourceTier` (1–4, the Section 2 hierarchy position of the source the canonical list comes from) and `identityConfidence`. Give every source a `sourceKind` from the closed set `pack_front`, `pack_back`, `manufacturer_de`, `manufacturer_foreign`, `retailer`, which fixes its CL-SRC base grade.

Packet fields: `slot, productId, name, brand, packSize, gtins[], sources[{url, retrievedAt, sourceType, sourceKind, gtinShown, inciVerbatim, claimsVerbatim, directionsVerbatim}], conflicts[], canonicalInci[], canonicalReason, inciFingerprintSha256, normalization, identityConfidence, formulaCompleteness, formulaSourceTier, status (frozen | frozen_with_conflict | blocked), blockReason, notes`. Examples of the older shape (without `sourceKind`, `formulaCompleteness` and `formulaSourceTier`): `calibration/packets/full/`, `calibration/unseen-v2/full/`.

A packet is amended, never silently edited: an evidence-only amendment keeps the fingerprint, and the change is logged in the packet's `notes`. A change that moves the fingerprint is a new formula and a new freeze.

## 3. Build the two-stage sealed lane kit (orchestrator)

From the frozen full packets, build the kit with `npx tsx scripts/shampoo-research/build-lane-kit.ts build <full-packets-dir> <run-root>/kit --seed <n>`. It fails closed when a packet lacks `formulaCompleteness`, `formulaSourceTier`, a valid `identityConfidence` or a known `sourceKind`, or when `inciFingerprintSha256` does not match `canonicalInci`. It also refuses an output directory that exists and is not empty, so a rebuild can never leave an earlier run's reveals or formula-pass records in a fresh kit, and it accepts an optional `--prefix` only of the form `^[A-Z][A-Z0-9]{0,7}$` (default `K`). Its last step writes `held/build-complete.json` (the full id list and the SHA-256 of every stage-A packet); a kit without that marker is an interrupted build and cannot be released. Per product and lane it writes two packets under fresh blind ids (seeded shuffle; the mapping `kit/blind-mapping.json` stays outside every lane root):

- **Stage A, `<lane>/formula/<id>.json` (blind formula pass, standard 3.1):** canonical INCI, its fingerprint and normalization, `formulaCompleteness`, `formulaSourceTier`, `identityConfidence` and pack size. No product name, brand, claims, directions, catalog id, GTIN or URL.
- **Stage B, `held/<lane>/reveal/<id>.json` (post-unblind reconciliation, 3.2):** product name, brand, and per source the verbatim claims and directions with `sourceType`, `sourceKind` and its CL-SRC base grade `sourceGrade` (`pack_front` high; `pack_back` and `manufacturer_de` moderate; `manufacturer_foreign` and `retailer` low). The lane still grades a word in the exact product name `high` and a foreign manufacturer claim by a German source carrying the same claim (E1). Slot, catalog id, GTINs, URLs, conflicts and notes are dropped.

The reveal stays in `held/`, outside the lane root, until the lane has frozen its formula pass. Each lane also gets a scrubbed copy of the locked standard (`<lane>/classification-standard.md`: Section 13.10 worked examples and catalog references removed; the build fails if a batch brand or product name remains). The scrubbed copy is a lane aid; the normative text stays the pinned standard.

The historical builders (`calibration/build_lanes.py`, `build_round2_kit.py`, `build_unseen_v2_kit.py`) shipped one packet with name, brand and claims and are kept only as a record of the calibration runs; do not use them for new runs.

## 4. Sealed lanes

Two independent lanes classify the same products. Contract:

- **Inputs, and only these:** the scrubbed standard and the lane's own packets, stage A first and stage B only after release. No other lane's output, no reports, no rulings ledger, no catalog, no live rows, no earlier labels.
- **No web of any kind.** The packets are the complete evidence; a product is never re-researched inside a lane. Missing evidence is closed by an evidence pass and a packet amendment (step 2), never by a lane guessing.
- **Order inside a lane, enforced by the kit:**
  1. Blind formula pass on `<lane>/formula/` only (Sections 3.1, 6.5): write one formula-pass record per product to `<lane>/out/formula-pass/<id>.json`: provisional eight properties with rationales and confidence, formula facts with normalized positions, unresolved material ingredients. The release gate (step 4.2) enforces these fields: the record's own `blindId` (equal to the packet id), the `inciFingerprintSha256` of the stage-A packet it was written against, and `directProperties.cleansingStrength`, `directProperties.conditioningLevel` and `directProperties.weightPotential`, each with a non-empty `value` and a non-empty `rationale`. The remaining fields are part of the contract but are not machine-checked.
  2. The orchestrator runs `npx tsx scripts/shampoo-research/build-lane-kit.ts release <run-root>/kit <lane>`. It takes the cohort from `held/build-complete.json` and requires, for every id in it, a stage-A packet that still matches the marker's SHA-256, a held reveal and a formula-pass record. It refuses while any formula-pass record is missing, unparseable or incomplete (the error names the id and the field); each record is read once as a regular file (symlinks and other file types are refused) and that same buffer is validated and hashed. It pins each record's SHA-256 in `held/<lane>/release-log.json` and only then copies the reveal packets to `<lane>/reveal/`. The first release log is immutable freeze evidence and is never rewritten: a repeated release succeeds only when every record still matches the logged SHA-256; a changed, added or removed record fails closed. A first release means no log and no reveal already in `<lane>/reveal/`; a missing log over released reveals fails closed ("release evidence missing but reveals already released"), and a held reveal the marker does not list is refused.
  3. Post-unblind reconciliation (3.2) with `<lane>/reveal/`: every blind-to-final change is recorded with its evidence.
- **Output per product** (`<lane>/out/<id>.json`): the eight direct properties, each with value, confidence, conclusion-first rationale, formula facts with normalized one-based positions, counter-signal and `neighboringAlternative` (N-ALT); the focus record fields and decision trace (7.4, F-TRACE); the full weight record (6.8); the projection block (Section 13: three thickness fits after T6, `weight`, primary and secondary scalp target, observed intensity, `explicitResetPositioning`, `deepCleanserListing` with `deepCleanserRecord: needs_record`, review flags, informational notes, `researchCombinationTargets`); a `selfCheck` (the 6.11 operator self-check); and an `uncertainties` list naming every reading the lane had to choose, with the alternative. Record shape: `calibration/unseen-v2/lane-a/Q01.json`.
- **Seal confirmation.** The lane's handback lists every file it read and when (formula packets before the release, reveal packets after), states that it used no web, and reports any incident (anything seen that could have contaminated it).

**What the tool guarantees.** The kit tool enforces the formula-first order for honest operation by the orchestrator: sealed lanes can only write their own `out/`, so a reveal is released only after the orchestrator has run `release` against a complete build and a validated, hash-pinned formula-pass record per product. It is not a security boundary against someone with write access to the kit directory, who can edit the held files, the marker or the release log directly. The machine-checked fields are exactly those listed in step 4.1 (`blindId`, `inciFingerprintSha256`, and `value` and `rationale` of the three formula-derived direct properties) plus the completeness checks above.

Lanes never see catalog ids. The deep-cleanser record id and `review_live_value_differs` are resolved by the orchestrator only after both lanes are frozen (13.6 D2, Section 14).

## 5. Compare

After both lanes are frozen, run `npx tsx scripts/shampoo-research/compare-lanes.ts <run-root>/kit/lane-a/out <run-root>/kit/lane-b/out`. It counts every decision below, `researchCombinationTargets` included; the historical `calibration/*/compare.py` scripts predate that field and are not used for new runs (`calibration/research-combination-addendum.md`):

- compare the seven judgment properties; recompute `dandruffSupport` mechanically;
- compare the projection judgments: three thickness fits (after T6), primary and secondary scalp target; recompute `weight`, observed intensity, `deepCleanserListing` and rows mechanically from each lane's own properties;
- compare `researchCombinationTargets` as a research judgment (never `toward_recommending`);
- recompute review flags per lane and compare them as a diagnostic;
- write every disagreement with the rule ID each lane applied, its projection effect, and whether either value is `toward_recommending` (a higher thickness tier, an extra row or target, or a lighter `weight`).

Pass bars (Section 14): at least 75% raw exact agreement overall, at least 60% for every judged property, 100% formula-derived dandruff agreement, zero unresolved identity/audit failures, all final properties moderate-or-better confidence. Kappa and prevalence are diagnostics only. The v1.6 lock runs reached 97.4%, 97.1% and 95.8%; a routine batch far below that is a signal to look for a packet or process problem before adjudicating.

## 6. Adjudicate without tuning

Nick adjudicates every disagreement. Classify each as:

| Cause | Action |
| --- | --- |
| Product correction | Correct the record; keep the original and its rationale. |
| Source or identity failure | Evidence pass and packet amendment, or block/replace the slot. |
| Researcher-process ambiguity | Tighten the lane kit or instructions and rerun the affected lane work. |
| Systematic rule gap | Not fixable under v1.6: record it for the next version (a new version, new calibration, new lock receipt). Until then the cautious reading applies (P0). |

A genuinely balanced boundary is resolved conservatively (P0, W3), as R14 did for the Kokosmilch weight. Never change a label to hit an agreement score, a target distribution, a live row or cell coverage (Section 15). A product with a `low`-confidence property stays visible and returns `needs_research`.

Candidate ingredients named in `unlisted_route_candidate:<INCI name>` are collected per run for the batch list decision (R16.4); a lane never counts them.

## 7. Projection proposal and review

The adjudicated projection block is a proposal. Every review flag (13.9) blocks that product until Nick rules on it; informational notes do not block. Compare the proposal with the live rows only after projection (`review_live_value_differs`, program decision D4), never as an input.

## 8. Apply boundary

Nothing in this runbook applies anything. A catalog apply is a separate, approved workflow that must, among its own gates:

- run the N1 no-gap preflight over all 15 thickness × scalp cells and fail closed on any empty cell (13.11);
- list every active exception-register entry (13.12);
- use a Production Light adapter that is explicitly re-pinned to v1.6 (the shipped adapter is pinned to v1.4);
- have the live `weight` column and shampoo authority rule (R2) in place before any v1.6 projection is applied.

## 9. Artifact checklist

Each run writes a new versioned root containing: the pre-registration, full frozen packets, the lane kit (formula and reveal packets, blind mapping, release logs), both lanes' formula-pass records, final records and seal confirmations, the comparison output, the adjudication, the report and, when replayed, de-identified profile results. Historical runs, including `data/research/shampoo-inci/v1.6/calibration/`, are never overwritten or regenerated.

## 10. Stop boundary

Stop after local artifacts, comparison, adjudication and Nick's review. Separate authorization is required before Product Intake reconciliation, catalog creation or update, Lab approval changes, database writes or migrations, production recommendation changes, user-facing copy, and commit, push or deployment.
