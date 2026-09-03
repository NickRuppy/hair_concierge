# Conditioner Stage A artifact runbook

The reusable nine-property classification logic is locked as Conditioner Standard v1.6. The logic lock covers the vocabulary, thresholds, evidence ceiling, and reasoning contract; it does not approve an individual product or authorize catalog, database, matching-policy, or production use. The machine-readable receipt is `data/research/conditioner-inci/v1.0/v1.6-logic-lock-receipt.json`.

1. Inspect `00_category_charter.md`.
2. Verify `data/research/conditioner-inci/v1.0/source-manifest.json` hashes.
3. Inspect the frozen cohort and exclusions in `cohort.json`.
4. Read the normative classification standard and evidence register.
5. Review the locked formula packet, direction packet, and full-profile blank packet.
6. Preserve the accepted Reviewer C direct-property calibration and its historical 176-cell metrics.
7. The proposed key and a zero-inheritance blind reviewer independently complete the nine-property comparison profile for the 11 eligible products. The blind reviewer may read the reviewed direct-property evidence but not the proposed full-profile key, agreement artifacts, checkpoint summaries, prior profile reviewers, or workbook.
8. Compare all nine profile fields separately from the historical direct-property metrics. Array fields use exact set agreement after canonical ordering; every difference is retained and adjudicated.
   - The current v1.6 composite preserves frozen Reviewer F values for the historical seven fields and appends independent Reviewer G values only for `care_direction` and `repair_support_level`. Reviewer G matched the accepted key on 22/22 new-field cells under the semantically identical v1.6-rc1 rules; promotion to final v1.6 changed status/version metadata only. The composite is 94/99 pre-adjudication, 85/99 post-adjudication (85.9%), and 68/77 non-focus. It is not a fresh de-novo nine-property blind rerun and must not be described as full v1.6 repeatability.
9. Record one concise product/property uncertainty ledger. Review recurring pattern classes in `04_focus-selection-decision-guide.md` before individual exceptions; do not replace the required primary/secondary comparison hierarchy with flat capability tags.
10. Actual rinse behavior remains detailed-trace-only and unknown for every untested product.
11. Apply profile stress assertions and rerun the comparison after any systemic rule change.
12. Regenerate the review workbook and reading copies, then stop at `stage-a-checkpoint.md`. Stage B needs separate approval.

## Lab review order

- The Lab queue always shows the complete current cohort. `Zuerst prüfen` is a priority view for consequential uncertainty, not a smaller research queue.
- Every eligible product opens with all nine researched comparison fields. A highlighted field identifies where the reviewer should spend more time; it does not imply that the remaining fields are missing or already human-approved.
- Every field shows a product-specific conclusion, a list of exact ingredient/formula or directions signals, the derivation rule, an explicit threshold comparison, and the evidence limit. The comparison answers why this value clears its boundary and why the adjacent lower/higher or categorical alternative does not. A generic suitability sentence or enum restatement is a research defect and must be reworked before approval.
- All reviewer-facing evidence text is written in English. The compact overview shows the explicit threshold comparison for every property; the detailed audit retains the broader rationale, signals, derivation, and evidence ceiling.
- Ingredient ranks refer to the captured consumer INCI list, not exact concentrations. Fit fields must expose the upstream weight/conditioning/slip/film prior rather than invent a separate ingredient-fit mechanism.
- Review priority fields and their downstream fit effects first, then scan the remaining evidence. Use whole-product approval only when the complete nine-property profile is acceptable; that action atomically accepts all nine fields. Otherwise request targeted field rework and leave unaffected fields reviewable. On this v1.6 migration, unchanged existing field approvals remain visible; `care_direction` and `repair_support_level` begin unreviewed and must be accepted either individually or as part of that whole-product action before the product is considered approved.
- Excluded product forms show identity and G0 boundary evidence instead of a fabricated Conditioner profile.
- A targeted Lab rework request is a worker handoff, not an inert note. List the unresolved exact-version packet with `npm run conditioner:research:rework-queue`; use `-- --path <file>` only for a test or alternate local queue. The packet includes product, field, reviewer comment, formula/profile/field fingerprints, and semantic standard version.
- A worker changes only the named product artifact and field evidence unless the review exposes a reusable rule. After the corrected artifact is validated, the Lab reopens stale decisions and the reviewer resolves the field by approving it or requesting another rework pass.

## Guidance synchronization

- Every reusable classification or review-workflow change must update the normative standard and every consuming guide before the next Conditioner batch: `03_lean-matching-quick-reference.md`, `04_focus-selection-decision-guide.md`, `02_agent-context.md`, `product-research-prompt.md`, this runbook, and `rule-changes.md`.
- Bump the semantic `standard_version` when classification meaning, evidence thresholds, routes, field derivation, or review eligibility changes. Copy, formatting, and typo-only corrections do not invalidate product approvals.
- Keep a product-specific evidence correction in that product's versioned artifact and review history. Promote it into the shared guidance only when it reveals a reusable rule.
- Local Lab approval accepts only the exact research artifact/version. It never implies Product Intake, catalog, Supabase, deployment, or production approval.
- Field fingerprints include the rationale, evidence basis, named signals, derivation, threshold reasoning, and limitations. A material evidence-explanation change therefore reopens that field even when its enum value is unchanged.
- Historical v1.5 transition compatibility (provenance only):
- v1.5 field fingerprints are deterministic unsalted SHA-256 hashes of canonical per-field evidence/value payloads. During migration only, the Lab recomputes the legacy salted hash from current content plus the stored review version; equality with the stored old hash preserves an unchanged approval. Changed content matches neither hash and reopens. New decisions store only the unsalted hash. The whole-profile fingerprint remains versioned with `standard_version`.
- v1.6 keeps deterministic unsalted field fingerprints. Independent Reviewer G's 22/22 exact new-field comparison does not replace Nick's local approval: unchanged existing fields preserve approval, while `care_direction` and `repair_support_level` remain open in the Lab until Nick accepts them either individually or through the atomic nine-field whole-product action. The whole-profile fingerprint remains versioned with `standard_version`.
- Apply the Damage Fit boundary before every batch as exact output sets: low → only healthy; moderate and general high without a qualifying specialist route → only healthy + moderately damaged; high conditioning with a distinct protein/peptide/keratin fibre-film route, named bond chemistry, exceptional corroborated protection, or a relevant exact-product test → only moderately damaged + highly damaged. The specialist result replaces the general-high set; never emit all three values. Generic silicone/oil/panthenol/ceramide/cationic polymer/repair name/generic lubrication alone does not qualify.

No command in this runbook writes to Supabase or production.

## New-product Product Intake path

After the v1.6 logic lock, previously unknown eligible Conditioners use the complete research method above and serialize all nine fields plus their evidence into `conditioner-research-envelope-v1.6`. Product Intake stores that envelope in a `property_synthesis` artifact and invokes `conditioner-production-adapter-v1` to derive today's narrower Conditioner database fields.

The full envelope remains the source of truth. The adapter never reads current catalog Conditioner values as evidence, never rewrites the research profile, and never invents an application protocol from INCI. Exact `conditioner_rinse_out` directions still come from the authoritative product source. Use `docs/product-intake-conditioner-production-adapter.md` for the envelope, projection, replay command, and readiness boundaries.

An adapter warning is a visible review issue, not a hidden default. An invalid/missing envelope, weak identity, unresolved material formula conflict, or excluded product form blocks the property lane. A valid projection remains separate from Product Intake approval and every guarded publish gate.
