# Conditioner Damage Fit recalibration

> Historical v1.5 implementation plan. It records the completed Damage Fit change and approval-preservation approach. The active v1.6-rc1 guidance adds `care_direction` and `repair_support_level`; this plan's seven-field and v1.5 references are provenance, not the current research contract.

## Outcome and source context

Recalibrate the 11 eligible rinse-out Conditioner pilot profiles so `damage_fit` distinguishes general conditioning from genuine damage-specialist support. The decision preserves the seven-field comparison model and the current Lab review workflow.

Sources:

- Current normative standard: `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`
- Current accepted pilot profiles: `data/research/conditioner-inci/v1.0/calibration-full-profile-key.json`
- Current direct-property evidence: `data/research/conditioner-inci/v1.0/calibration-key.json`
- External evidence already reviewed: conditioner adsorption and practical conditioning depend on cationic structure, pH, formula architecture, and hair damage; INCI evidence supports a comparative prior, not proof of structural repair or universal suitability.
- Nick's 2026-09-01 decision: keep `damage_fit` and tighten its threshold rather than rename or remove the property.

## Chosen direction

Keep the existing vocabulary (`healthy`, `moderately_damaged`, `highly_damaged`) but make `highly_damaged` require high conditioning plus a genuinely distinct damage-specialist route. Ordinary conditioning lubrication no longer qualifies by itself.

Reviewer-applied deterministic projection for this calibration pass:

1. `conditioning_level=low` -> `healthy`.
2. `conditioning_level=moderate` -> `healthy + moderately_damaged`.
3. `conditioning_level=high` without a qualifying specialist route -> `healthy + moderately_damaged`.
4. `conditioning_level=high` with a qualifying specialist route -> `moderately_damaged + highly_damaged`.

A qualifying specialist route requires at least one of:

- `bond_specific_support=chemistry_candidate | product_tested` based on distinct chemistry or exact-product substantiation;
- `repair_surface_film=candidate | tested` backed by an identifiable protein/peptide/keratin film route rather than a name alone;
- a clearly exceptional protective-lubrication architecture beyond ordinary fatty alcohol, cationic base, silicone, oil, panthenol, or polymer presence, corroborated by exact damage positioning or relevant product evidence;
- relevant finished-product damage testing.

Generic silicone, oil, panthenol, ceramide, cationic polymer, repair naming, or `repair_lubrication_protection=candidate` alone does not unlock `highly_damaged`. The fit remains a comparative product prior, never an incompatibility or safety claim.

Do not force an aesthetically balanced distribution. Apply the threshold independently to all 11 eligible products and report the resulting distribution.

This pilot does not add a runtime classifier that computes `damage_fit`. The 11 accepted values remain deliberately authored calibration data. Determinism comes from applying the locked rule to every row, recording the evidence and adjacent alternative, and pinning the approved old/new table in regression fixtures.

## Scope and non-goals

In scope:

- damage-fit rubric and exact 11-product recalibration;
- English, product-specific Lab reasoning that names the qualifying or missing specialist route and explains the adjacent alternative;
- standard/guidance synchronization and calibration-metric recomputation;
- property-scoped fingerprint invalidation so only semantically changed fields reopen;
- a plain-language UI gloss for formula-only `weight_deposition_potential` that does not change approved weight evidence or values.

Non-goals:

- changing the seven-field ontology or `damage_fit` vocabulary;
- changing `conditioning_level`, `weight_potential`, focus, thickness, or texture values in this pass;
- deciding whether `conditioning_level=low` remains after the wider cohort; retain it provisionally;
- finished-product performance claims, catalog/Product Intake/Supabase writes, production recommendation behavior, commit, push, PR, deployment, or activation;
- researching or activating the remaining Conditioner cohort before pilot sign-off.

## Target map

- Normative rules and guidance: `conditioner-classification-standard.md`, `03_lean-matching-quick-reference.md`, `04_focus-selection-decision-guide.md`, `02_agent-context.md`, `product-research-prompt.md`, `runbook.md`, `rule-changes.md`, checkpoint/verification receipts, and synchronized DOCX/PDF reading copies.
- Accepted and calibration data: `calibration-full-profile-key.json`, `calibration-full-profile-agreement.json`, `calibration-full-profile-packet.json`, `schema-baseline.json`, and `artifact-manifest.json`; historical reviewer artifacts remain immutable provenance.
- Runtime/reasoning: `src/lib/conditioner-research/profile-evidence.ts` and `src/lib/labs/conditioner-research-access.ts`.
- Lab presentation: `src/app/labs/conditioner-research/queue-audit-client.tsx` and, only if needed for the approved gloss, `research-lab-client.tsx`.
- Regression coverage: Conditioner Lab access, API, UI, and review-state tests.

## Designed user journey

1. Nick opens the existing development-only Conditioner Lab and retains every previously approved property whose value and evidence did not change.
2. Products whose recalibrated `damage_fit` value or evidence changed return to the review queue. A prior whole-product approval becomes stale, but unrelated property approvals remain visibly approved.
3. In the compact overview, Damage Fit states the proposed subset and gives two plain-English reasons: the exact qualifying specialist route (or its absence), and why the adjacent damage subset was not chosen.
4. In expanded evidence, raw direct properties remain available, but the explanation distinguishes ordinary conditioning from damage-specialist support and states that fit is comparative, not a universal exclusion.
5. Weight reasoning displays `weight_deposition_potential` as a formula-deposition signal in plain English without changing the approved value or evidence semantics.
6. Nick approves or requests rework only for the reopened Damage Fit property. Once all seven fields are approved again, the whole product can be re-approved locally.
7. The calibration tab discloses the new 11-product damage distribution and recomputed blind-agreement metrics. No arbitrary distribution target is presented as success.
8. After all 11 eligible pilot profiles and the G0 boundary are approved, the next separate step is the remaining Conditioner cohort; that expansion also tests whether `conditioning_level=low` is a useful real-world bucket.

Recovery states:

- A changed formula, changed field value, or changed field evidence reopens the affected field.
- An unchanged field keeps its approval even when the global Conditioner standard version advances.
- Malformed local review state continues to degrade to an unreviewed Lab state without affecting production data.

User-journey sign-off: **confirmed by Nick on 2026-09-01**.

## Planning evidence

- Rendered current/proposed Lab-context mockup: `docs/research/conditioner-inci/v1.0/planning-evidence/damage-fit-recalibration.html`
- Question answered: whether ordinary conditioning should continue to qualify nearly every product for highly damaged hair.
- Selected direction: keep `damage_fit`; require a distinct specialist route.
- Feedback incorporated: preserve the understandable low-conditioning model, explain raw deposition signals in plain language, and retain comparison value across products.
- Evidence review: **confirmed by Nick on 2026-09-01** after the approval-preservation correction was added.

## Ordered tasks

### 1. Lock the stricter damage rubric and projected pilot changes

Consumes: current direct-property key, exact formulas, current accepted profiles, and the chosen threshold above.

Produce a complete old/new table for all 11 eligible products. For every retained or changed value, name the exact route and ingredients that clear or fail the specialist threshold. Treat NEQI, OGX, Bali, Cantu's excluded boundary, and Bond+ as adversarial cases. Do not update accepted profiles until the full table is internally consistent.

Completion: all 11 rows have one deterministic result, adjacent-value reasoning, evidence ceiling, and no outcome justified by desired distribution.

### 2. Update the normative rule and recalibrated artifacts

Consumes: approved old/new table.

Update the standard to v1.5-rc1, every consuming research/operator guide, current accepted profile data, agreement metrics, packet/schema metadata, manifests, and reading copies. Historical blind/reviewer files remain unchanged and explicitly labelled provenance.

Regeneration path: keep Markdown as the normative editable authority; minimally update the existing DOCX with the bundled Documents runtime, then use its canonical `render_docx.py <docx> --output_dir <qa-dir> --emit_pdf` flow to create page PNGs and the synchronized PDF. Run the DOCX accessibility audit, compare extracted heading/body content against the Markdown authority, and visually inspect every rendered page. The main session owns this artifact step; it is not left to an executor to invent.

Completion: current artifacts agree on the new values, totals, distribution, version, and rule; DOCX/PDF reading copies match the Markdown authority and pass structural/visual QA.

### 3. Preserve unrelated approvals with property-scoped fingerprints

Consumes: v1.5 global standard and changed `damage_fit` value/evidence.

Remove the global `standardVersion` salt from newly generated individual field fingerprints. Each field hash continues to include formula identity, path, value, rationale, evidence, derivation, threshold reasoning, and limitations, so future version changes reopen only semantically changed fields. Keep `standardVersion` in the overall profile fingerprint and stored review metadata; advancing to v1.5-rc1 therefore makes prior whole-product approval stale until the changed Damage Fit field is reviewed.

Migration compatibility is required because the currently stored v1.4 field hashes include the old global salt. During hydration, accept either the new unsalted hash or the legacy salted hash recomputed from the current field content and the stored review's standard version. Unchanged fields therefore retain their v1.4 approvals, while changed Damage Fit content fails both comparisons and reopens. New decisions persist only the unsalted hash, naturally retiring the compatibility path product by product.

Do not sweep unrelated `standard v1.4` prose literals inside `profile-evidence.ts` during this pass. They describe unchanged Weight/Thickness rules and are outside this recalibration. Their fingerprints should remain stable unless those rules receive their own future semantic update.

Completion: tests prove unchanged approvals survive, changed Damage Fit reopens, whole-product approval becomes stale, and re-approving Damage Fit restores eligibility for local product approval.

### 4. Make Lab reasoning reviewer-readable

Consumes: recalibrated field evidence and property-scoped review state.

Render product-specific Damage Fit reasoning in English with exact ingredient/route evidence and a direct adjacent-value comparison. Add a presentation-only plain-language gloss for formula deposition signals so raw `weight_deposition_potential` terminology is explained without changing existing weight fingerprints.

Completion: compact and expanded views show the same value and logic; no generic “candidate” phrase can hide which route qualified; mobile and desktop remain readable.

### 5. Re-verify and return the pilot for focused approval

Consumes: synchronized v1.5 artifacts and Lab behavior.

Run focused tests, typecheck, lint, production build/CI verification with documented local placeholders where required, data invariant checks, and live browser verification. Perform one final code-review lane and resolve supported findings.

Completion: the Lab shows 12 pilot products, only changed Damage Fit fields reopen, calibration metrics match source artifacts, and Nick can complete focused local approval without re-reviewing unrelated properties.

## Verification

Automated:

- red-first assertions for the stricter route threshold and expected changed/retained adversarial products;
- 11-profile completeness/vocabulary/distribution invariants;
- recalculated agreement-cell arithmetic;
- property-scoped fingerprint compatibility, explicit removal of global version salt from field hashes, and stale whole-product behavior;
- API and rendered UI absence of generic unexplained damage logic;
- focused Conditioner suites, typecheck, task-owned lint, and `ci:verify`.

Manual/browser:

- desktop and narrow viewport review of one general Conditioner, one protein/peptide-film case, one bond case, and NEQI;
- confirm exact formula signals, adjacent-value explanation, approval preservation, rework recovery, and calibration disclosure;
- confirm the Lab remains development-only and no catalog or production action is exposed.

Evidence-sensitive:

- reject any `highly_damaged` assignment supported only by generic lubrication or marketing;
- preserve uncertainty where formula position, concentration, deposition, or finished-product performance is unknown;
- confirm no guide describes the fit subset as a universal exclusion or structural-repair proof.

## Review and handoff

- Worktree: continue only in `.worktrees/conditioner-inci-research-plan` on `codex/conditioner-inci-research-plan`; preserve all same-program dirty work and do not rebase during this checkpoint.
- Planning counterpart review: complete — Claude Opus 4.8, high effort, read-only.
- Counterpart findings ledger:
  - accepted: state explicitly that the projection authors calibration data rather than adding a runtime classifier;
  - accepted with local correction: replace the proposed per-field version ledger with ordinary property-scoped fingerprint invalidation plus one-way compatibility for existing v1.4 salted hashes; removing the salt without that migration would reopen every field once;
  - accepted: freeze unrelated v1.4 prose during this pass and name the DOCX/PDF regeneration/QA owner and path;
  - rejected: none;
  - deferred: no new reusable Markdown-to-DOCX converter is added in this recalibration because the existing reading copy receives a bounded minimal update;
  - needs user decision: none beyond the pending evidence and designed-journey sign-off below.
- Evidence review: confirmed by Nick on 2026-09-01.
- Designed-journey sign-off: confirmed by Nick on 2026-09-01.
- Implementation handoff: authorized for local execution; stop before publication or production actions.
- Local implementation checkpoint: complete on 2026-09-01. The focused suite passes 31/31, the development-isolation pass succeeds 12/12, `ci:verify` passes, the Lab serves the final v1.5 review surface, and the synchronized reading copies include the fresh-blind-rerun caveat.
- Stop before commit, push, PR, catalog/Product Intake/Supabase, deployment, or production activation.
- Artifact disposition: plan, selected mockup, normative guidance, current calibration artifacts, Lab code, and tests are intended to commit with the eventual task; transient reviewer output is discarded outside the repository.
