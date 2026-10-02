# Bondbuilder research engine and catalog expansion

2026-10-02 scope update: all eight original pilot products are enrichment targets by Nick's request, with unchanged high/medium/low grades and separate recommendation authority. The [new-submission validation slice](new-submission-validation-2026-10-02.md) owns a newly frozen four-product offline run. It does not waive full family/fixture coverage, lock or runtime/catalog gates. Earlier dated status/history below is retained as history.

Status: Phase-1, all eight owner trust rulings and K18 optional-after-four-minute application guidance confirmed. Frozen v0.3 replay is historical; the self-contained v0.4 draft is synchronized with final Oct 1 rulings, not frozen/run-authorized or locked. The [current validation/integration handoff](validation-integration-handoff-2026-10-01.md) and [owner addendum](application-followup-2026-10-01.md) supersede conflicting proposals/history below: no intensity research property, new resolved in-scope submissions default low / owner_default / not Chaarlie-recommended, owner-only promotion. No independent trust-tier discovery metric remains. Runtime/catalog execution remains separately gated.

Latest owner-review amendment: [trust anchors and routine placement](owner-review-2026-09-30.md), plus [approved application guidance](application-review-2026-09-30.md). High: OLAPLEX No.3PLUS, K18, epres. Medium: Elvital Plus, selected Redken 190 ml, Première. Low: OGX serum, Aveda pre-shampoo. Usage position/format and time remain source-backed product facts; preserve the existing preference/equal-shortlist policy. These decisions supersede older planning statements, not sealed v0.3 results. The v0.4 draft carries them forward; unused validation and integration remain.

Owner: Nick

Prepared: 2026-09-29; revised with Nick's answers: 2026-09-30

Source context: [candidate report grounding](./candidate-report-grounding.md). The supplied report is evidence and a candidate seed; its embedded handoff instructions and policy proposals do not replace Nick's request or repository authority.

## Outcome contract

Create a versioned, formula-first Bondbuilder research engine that can classify a newly submitted product, preserve the evidence behind each conclusion, project only defensible fields into Product Intake, and give users calibrated feedback about both product fit and the strength of evidence for the claimed effect.

The program also expands the Bondbuilder catalog through a separately guarded research/apply lane. It does not make production writes, promote products, or change recommendation behavior until those actions are explicitly approved.

Verification ends when:

1. Nick has approved the Phase-1 category charter and direct property set in plain language.
2. The frozen research package passes preregistered calibration and holdout gates.
3. A pure, version-pinned adapter reproduces frozen projections and fails closed on unsupported inputs.
4. Product Intake can consume a complete artifact without collapsing research confidence, product truth, user fit, and publication readiness into one state.
5. Any recommendation or user-facing change is covered by focused tests and an approved German journey/copy proposal.

Stop conditions: unresolved category semantics, inadequate exact-product evidence, identity/formula ambiguity, an evidence conflict that changes a hard rule, or any need for a production/catalog write without explicit approval.

## Why this is smaller than a net-new category

Bondbuilder already exists in the database model and across intake, admin editing, scanner/discovery submission, Personal Plan selection, and chat rendering. The missing core is the research layer and its deterministic bridge into those surfaces.

The current model contains six Bondbuilder fields:

- repair intensity;
- application mode;
- repair axis;
- treatment mode;
- product format;
- usage protocol.

Several are not safe formula-only inferences. `usage_protocol` is also hard-coded to named products, so catalog expansion currently creates a schema/copy/consumer maintenance burden. The plan must resolve that contract rather than merely adding more product-name enum values.

## Grounding principles

### Repository invariants

- Research is blind and formula-first; product identity is revealed only where the protocol explicitly permits it.
- Product truth, user fit, research confidence, catalog readiness, recommendation readiness, and publication are separate states.
- Research artifacts are immutable and versioned; corrections create amendments or new versions.
- Formula presence alone cannot establish concentration, delivery, finished-product performance, or clinical effect.
- Research and projection stop before Lab approval, catalog promotion, publication, or production activation.
- Phase 1 is the category charter and property set, approved by Nick before research runs.

### External evidence boundary

EU cosmetic-claim rules require adequate, verifiable evidence relevant to the exact product and claimed benefit. Ingredient properties should not be extrapolated to a finished product without a defensible rationale such as effective concentration and formulation context.

The hair-fibre literature supports multiple interacting structural forces and does not justify a simple universal model in which a marketing label, one ingredient, or one proposed bond mechanism proves meaningful repair. Exact-product instrumental studies can support a tested endpoint under the studied protocol, but they do not guarantee an effect for every user or establish untested endpoints.

Therefore the new dimension should be framed as **strength of evidence for a defined effect**, not **certainty that the product works**.

## Three levels of trust in the repair claim

### Recommended architecture

Nick chose three simple levels of trust. Keep the underlying sources and a concise rationale so the conclusion can be reviewed. Avoid an elaborate score, percentage, or mandatory hierarchy of study designs. The levels describe support for the claimed repair/reinforcement benefit; they do not estimate effect size or promise a personal result.

The trace should distinguish:

- subject: exact marketed product/formula, technology family, ingredient, or marketing claim only;
- endpoint: for example tensile strength, breakage, combability, surface damage, structural signal, or sensory result;
- method: instrumental, controlled tress/fibre, controlled human use, blinded sensory, observational, or testimonial;
- protocol relevance: dose, contact time, rinsing, system partners, frequency, damage state, and hair substrate;
- comparator: untreated damaged control, vehicle, ordinary conditioner, competitor, baseline, or none;
- provenance and independence: manufacturer/supplier, commissioned laboratory, or independent team;
- quality: sample size, repeatability, uncertainty, conflicts, and replication;
- applicability: exact current formula and intended real-world use versus a model system.

Proposed labels and meanings, to be calibrated in the standard:

1. **Well supported** — a convincing body of relevant evidence supports the product's defined repair/reinforcement benefit. Exact-formula applicability and remaining limitations are stated.
2. **Promising / plausible** — the approach has relevant support, but evidence for this exact product or intended use remains limited. It can be presented as a reasonable option to try.
3. **Weakly substantiated** — support is principally a claim or too indirect to justify confidence in the product's repair benefit. Explain this plainly without pretending it proves ineffectiveness.

Technical enum spelling is an implementation default; these labels are a proposal, not assigned product grades. An incomplete evidence search has a research status, not an invented fourth trust level or automatic lowest grade.

Do not calculate one opaque average of evidence, price, reviews, and fit. Public research limitations remain visible in the rationale. No product has been assigned the top level in this planning turn.

### Existing Conditioner precedent

The Conditioner standard already separates claim evidence, exact formula facts, plausible mechanism, exact finished-product instrumental evidence, controlled human/sensory evidence, and stronger replicated evidence. Bondbuilder should reuse that evidence grammar where possible, then add Bondbuilder-specific endpoint and protocol rules rather than inventing an incompatible scale.

### Market experience and disagreement

Nick does not require a separate market-maturity field. Record newness, longstanding use, and credible user/professional experiences in the research notes when helpful for advice. These can inform practical familiarity, usability, and variation in observed results; they cannot establish molecular repair by themselves.

Mixed consumer reviews do not automatically downgrade an otherwise well-supported product. Evaluate actual contradictory research by relevance, quality, and exact-formula/protocol applicability; there is no blanket rule that any disagreement prohibits the highest level. Review volume is not a scientific contradiction.

### Technology explanation and consumer advice

Nick wants advice in a hairdresser's voice: a clear preferred option, a credible lower-cost option, and a reason to choose between them. Scientific confidence, Chaarlie's curation preference, price, protocol fit, and measured benefit remain distinct inputs to that advice.

Provide a concise technology explanation with an optional deeper explanation of how it approaches hair damage and what is established versus proposed. The candidate report seeds sulfur-targeting/maleate, designed-peptide, acid/calcium-management, and gluconamide/gluconate approaches. These are explanatory families, not automatic efficacy rankings or replacements for exact formula evidence.

Terms such as "gold standard", "lighter effect", and "best proven" need a substantiated referent. Premium price, patents, or time on market cannot establish comparative superiority; weaker public evidence cannot establish a smaller effect. A preferred premium choice can be described as Chaarlie's core choice while comparisons remain unproven.

The shared formula-first method requires two sequential stages: freeze the blind formula/technology assessment, then assess exact-product claims, published evidence, and experience in an explicitly unblinded stage. Later evidence does not rewrite the frozen blind record. Technology assignment, trust level, and classification confidence are separate results.

## Decision coverage

Status: **confirmed for Phase 1**; this is not yet the execution handoff for schema/adapter/catalog work. Coverage acknowledgement: Nick's 2026-09-30 answers choose three trust levels, practical advice, the report's technology types only, at least medium trust for new category additions, normal routine-plan depth, and database persistence of deeper properties. Internal revalidation: those answers and the complete supplied v2 report have been reconciled against intake, catalog facts, application adapters, both the legacy selector and the approved Personal Plan category contract, and chat projection. No research grades or production policy have been activated.

Explicit acknowledgement: Nick subsequently said "ok lets go with that for now" in response to the Phase-1 handoff. This confirms the chosen baseline: admission plus explanations, unchanged automatic selection, and the agreed category/database/Routine Plan scope. The optional trust-ranking extension is closed for v1, not left waiting for another answer. This acknowledgement does not assert that method anchors, research artifacts, or implementation have already passed their gates.

Pilot acknowledgement: Nick accepted the subsequent suggestions on trust anchors, borderline review holds, and shared technology research. He revised the release sequence to **research 5–10 products first, then recalibrate and review the engine**. The chosen pilot is eight products: the three existing primary reference treatments plus BB-01 through BB-05. This supersedes a release sequence that would prioritize adding Elvital before the cohort review. See [pilot cohort and review sequence](./pilot-cohort.md).

### Confirmed with Nick

- Three levels of trust in repair claims, with sources and rationale retained.
- The central concern is repair at a molecular/structural level.
- Give practical advice about premium/core choices and affordable options to try.
- Use the supplied candidate set as the grounding for viable additions.
- No separate market-maturity property is necessary; useful experience can remain in research notes.
- Mixed customer opinions should not disqualify a product from the strongest level by themselves.
- Explain different technologies, with a deeper explanation available when the user wants it.
- The evidence approach is a first version that will need calibration; do not pretend public evidence is complete.
- Research a 5–10-product initial cohort before release; use findings to recalibrate the engine and review it. Eight products is the selected starting cohort, covering all report technology approaches without adding speculative candidates.
- Relevant technology research plus a compatible targeted formula can support medium; high needs convincing finished-product-applicable support. Judge source quality and applicability, with funding disclosed, rather than impose a universal independent-funder rule.
- Borderline low/medium admission judgments route to review, never default to medium. Research each technology family once with versioned sources, then check each exact product separately and go deeper when it could materially change the assessment.
- Admission is limited to the technology types described in the supplied report. A specific compatible technology and a targeted repair/reinforcement role are required; regular repair products and bond/plex branding alone do not qualify.
- New curated Bondbuilder additions need an explicit owner-reviewed medium/high grade. Every other resolved in-scope new submission defaults low / owner_default / not Chaarlie-recommended while all other facts are researched. This does not block a non-recommended user catalog link.
- No intensity property in the new research set. Preserve legacy production values until a compatible implementation; never invent intensity to satisfy old validators.
- Routine Plan retains the same depth as other categories. No new comparison page or deeper routine-plan UI is included in this program.
- Persist technology, trust, explanations, evidence basis, and limitations with the product in the database so chat and future routine-plan work can consume them. Files or intake-only artifacts are insufficient for approved catalog products.
- Explicitly retain usage type: routine position plus format, rinse mode and exact protocol. Match a user's expressed application/format preference among otherwise ideal products, under the existing approved category policy; do not claim equal trust proves equal efficacy. See the latest owner-review amendment for product rulings and regression obligations.

### Inherited from evidence or contract

- Follow the category template, blind formula-first invariants, and immutable artifact requirements.
- Claims and product evidence are assessed after the blind stage; classification confidence is not efficacy certainty.
- Preserve exact formula/version applicability; historical Olaplex evidence does not automatically establish No.3PLUS efficacy.
- Ingredient/technology evidence and system tests cannot silently become evidence for an individual current bottle.
- Public evidence gaps differ from demonstrated lack of effect.
- Directions come from authoritative local product sources.
- Research/projection, catalog readiness, recommendation readiness, and activation remain separate.
- Existing Bondbuilder search/intake/admin/Personal Plan surfaces should be reused unless an actual user-journey gap is identified.
- The approved `docs/personal-plan/categories/bondbuilder/decision.md` rejects person-side mechanism targets and intensity-only ranking (current-behavior table, target, selection rules). The implemented plan-owned category uses a mechanism-neutral target. Preserve those rules; do not reopen them as new choices or introduce a scientific stronger/weaker rating through the engine.

### Implementation defaults

- Preserve test metadata per source; expose one compact trust level plus an explanation rather than many public scores.
- Retain specific measured outcomes in the evidence record; no extra user-facing endpoint ratings are needed for v1.
- Use an explicit incomplete/review-required status for unresolved identity/category/facts. New applicable trust is an owner policy assignment, not a model's empirical judgment.
- Keep price and customer reviews out of a mechanical efficacy score.
- Use exact current product/formula identity as the evidence target and retain technology-family evidence as contextual support.
- Candidate prices and availability in the report are dated leads, requiring recheck during intake.
- Reuse the existing Product Intake submission/review path and application-protocol system. Low trust is an assessment result, not a worker failure requiring endless retries.
- Keep the optional Aveda leave-in separate from the first five-candidate expansion wave. It remains a category-boundary fixture to resolve before any eventual import; no cross-category capability framework is introduced merely to handle it.
- Medium/high trust does not override an identity conflict or missing protocol. Incomplete research cannot be defaulted to medium to satisfy admission.
- Preserve the eight exact reviewed owner grades, including the top-three high references. Do not inherit grades by brand or reset matching existing catalog approvals to the new-submission default. A materially changed identity or conflicting existing-row result goes to review rather than automatic demotion or replacement.
- Admission transition is additive for the explicitly captured existing approved product set: a pending/null assessment does not revoke current eligibility. New admissions require medium/high, with no default-medium fill or legacy bypass for new products. Reassessment cannot automatically deactivate a previously approved row. Global activation of new trust-based selection behavior remains a separate action.
- Preserve the current thickness readiness requirement. Assess fit with explicit formula/application/deposition and product-evidence anchors; retain unknowns and withhold global recommendation readiness where required fit evidence is missing. Selecting exact research anchors is method work, not a request for Nick to invent empirical evidence.

### Open consequential assumptions

None affecting the Phase-1 scope or the latest usage-property amendment. Preserve the current approved equal-shortlist behavior when no application/format preference is expressed, and its existing preference matching when one is expressed. Nick's subsequent acknowledgement selects admission/explanation without a new trust-ranking rule for v1. The second submitted question about intensity is settled by the existing category authority for Routine Plan.

Undiscussed consequential assumptions affecting this Phase-1 handoff: **none**. This states coverage of the charter/property proposal, not permission to activate anything. The full implementation handoff still needs the locked standard, corpus/holdout receipt, concrete projection fixtures, exact migration lineage, and verified consumer/migration tests. Optional Aveda leave-in admission requires a later boundary assessment before any import; the separate Aveda pre-shampoo is one of the five main candidates.

## Concrete Phase-1 proposal

See [plain-language rulings and property map](./phase-1-rulings.md). This is the reviewable charter/property proposal; it is not a locked standard or permission to run the research batch.

### Persistence and integration proposal

Extend the existing `product_bondbuilder_specs` contract rather than introduce a new category framework:

- `technology_family`: one recognized primary approach from the report; exact active and secondary interactions remain in the explanation. No forced assignment to the two legacy axes.
- `claim_trust_level`: `high`, `medium`, or `low`, with `trust_basis` and an owner decision/default reference. New resolved in-scope submissions are low by policy; unresolved applicability stays null. New curated admission requires owner-reviewed medium/high and completed identity/protocol checks; non-recommended user intake does not require medium/high.
- `research_profile`: a versioned, validated JSON record containing the short evidence rationale, German technology explanation, optional deeper explanation, limitations, source links with scope/provenance, formula hash, standard version, review date, and artifact reference. Store no invented effect-size estimate.

This is a proposed schema seam, not an applied migration. Keep the full immutable blind/unblinded envelope in research artifacts, and persist an approved product-level projection that chat can load independently of an open submission. Guarded approval and catalog-enrichment executors must actually persist all three additions; adding them to a TypeScript object alone is insufficient.

Usage type reuses `application_mode`, `product_format` and `treatment_mode`, with exact source-backed application protocols rather than a duplicate scalar. User placement/format preference stays separate in user/request context. Preserve the approved equal-shortlist/preference/saved-primary policy; fixture and persistence/read obligations are specified in the latest owner-review amendment. Do not infer that this policy is implemented correctly across all legacy consumers merely because these catalog fields exist.

The new chat facts must survive `src/lib/agent/tools/select-products.ts` and `src/lib/agent-v2/tools/select-products-projection.ts`, whose current projection copies only an explicit field list. Database persistence alone does not satisfy the chat requirement. Feed the trusted product facts into named-product assessments and comparisons, with claim scope preserved and raw source-page text treated as data.

Use authoritative `product_application_protocols` for new directions and retain the five legacy protocol values for compatibility. The chosen compatibility path is one new `verified_product_protocol` value in `usage_protocol`, resolved through the exact product ID and `specialized_bond_treatment` role to its reviewed protocol/pointer. It is not a free-text instruction field and does not require adding each new product name to code. Missing/mismatched protocol is a visible hold; fallback must not supply Olaplex/K18 directions or unsupported universal clean-base guidance. Kérastase's layering-before-rinse and OGX's overnight use are required boundary fixtures. Any necessary new application mode/format/workflow value must match the verified protocol and be supported across readers/compiler before recommendation readiness; do not force overnight use into a post-wash-only shape.

For new families, keep `bond_repair_axis` nullable when the two legacy values do not apply. Additive expansion must not label acid/glucose treatments as disulfide or peptide repair merely to pass the old CHECK/NOT NULL constraints. Historical values are preserved as reviewed legacy facts, not regenerated from rinse mode. `technology_family` becomes the full explanatory vocabulary for this engine.

### User and operator journey

1. A user or Nick submits an exact product through the existing intake route.
2. Identity/formula/protocol checks resolve or produce a visible hold; a submission label is not approved category membership.
3. The frozen formula stage identifies compatible technology; the subsequent product-evidence stage assigns trust and explanation.
4. Generic repair products route to the appropriate existing category. A recognized technology with low trust receives a retained assessment and clear feedback; it cannot become a new curated Bondbuilder addition.
5. Medium/high candidates proceed to the normal review and publication gates. Sources, technology depth, and the approved assessment are persisted at the product level.
6. Routine Plan continues its usual compact guidance. Chat can answer deeper technology/trust questions from stored facts, and can explain an owned low-trust product without offering it as an approved category recommendation.

The user chose the existing-surface scope; no new visual layout is proposed. Any new chat wording or changed selection consequence will be shown as a concrete conversation example before implementation. Later Routine Plan depth is enabled by stored data, not implemented in this program.

### Target map

| Deliverable | Owning surfaces |
| --- | --- |
| Charter, standard, lexicon, runbook, handover | `docs/research/bondbuilder-inci/`, shared research index/skill router |
| Frozen identity, formula, evidence, calibration/holdout, receipts | `data/research/bondbuilder-inci/v1.0/` |
| Pure projection and replay | `src/lib/bondbuilder-research/production-adapter.ts`, new replay CLI and golden fixtures |
| Intake bridge and validation | `src/lib/product-intake/bondbuilder-research-adapter.ts`, `category-validators.ts`, research worker, adapter guide |
| Persisted product assessment and admission gates | new migration(s), `product_bondbuilder_specs`, active intake approval and catalog-enrichment SQL, curated publication preflight, audit readers |
| Technology/protocol compatibility | `src/lib/product-specs/constants.ts`, `src/lib/bondbuilder/`, application-protocol adapters and catalog facts |
| Admission gate and fit compatibility | canonical Personal Plan category/fit authority, `src/lib/recommendation-engine/categories/bondbuilder.ts`, `selection.ts`, typed metadata; distinguish approved mechanism-neutral Plan policy from legacy behavior before changing either |
| Chat access to stored depth | `src/lib/agent/tools/select-products.ts`, `src/lib/agent-v2/tools/select-products-projection.ts`, named-product assessment/facts loader and guidance package |
| Catalog expansion | existing guarded executor/manifests; five main report candidates after holds resolve |

## Proposed delivery slices

### Slice 1 — Phase-1 rulings

- Approve the category charter, excluded forms, evidence semantics, smallest direct property set, and user-facing consequences.
- Map every property to formula evidence, claim/product evidence, protocol evidence, bounded judgment, or non-inferable status.
- Reconcile the approved properties with the existing database, recommendation, copy, and publication-gate consumers.

Exit: Nick approves the plain-language rulings. No product research runs yet.

### Slice 2 — Frozen research package

- Create the Bondbuilder docs/data roots, normative standard, lexicon, researcher prompt, source policy, adjudication rules, and handover.
- Write a provisional v0.1 method and freeze the eight-product calibration manifest/source packets and independent-lane procedure before running that pilot. Preregister boundary/negative fixtures and disagreement measures; do not preassign trust grades from the candidate report or catalog flags.
- Research the cohort, return an eight-product assessment table plus gaps/disagreements, and review those results with Nick. Change general rules through a versioned ledger, synchronize every consuming guide, and replay/reassess affected pilot records without overwriting the initial run.
- Reserve a genuinely unused holdout before finalizing the method, with exact identities, preregistered archetypes and substitution rules. The holdout is distinct from the 5–10-product learning cohort, not an excuse to call pilot replay independent validation.
- Run independent sealed lanes, preserve disagreements, and lock only after defined pilot/replay/holdout gates pass. If independent positive identities are unavailable within the small category, record the limitation and resolve the validation gap rather than relabel a pilot product as unseen.

### Slice 3 — Schema and consumer convergence

- Propose the smallest mapping for the three trust levels, explanatory technology families, and existing intensity/fit/protocol fields. Migrate only fields whose current semantics cannot represent the approved rulings.
- Update every writer and consumer together: intake validation, admin UI, recommendation logic, Personal Plan facts, chat copy, and publication readiness.
- Keep compatibility explicit for existing rows and older artifacts.
- Expand nullable fields/allowed values first, then deploy compatible writers/readers, then persist reviewed projections. Capture the exact pre-existing eligible product set for the admission transition; a null trust value is not an open-ended new-product bypass.
- Name rollback before writing migrations: disable the new bridge/admission activation, restore prior readers/writers that tolerate expanded values, and preserve rich assessment data. Do not drop new columns/data or reinstate restrictive constraints until an audited reverse mapping proves no rows would be lost. Create migration files via the repository's current migration workflow; do not apply them during planning.

### Slice 4 — Production adapter and intake bridge

- Implement a pure, version/hash-pinned projection adapter with `projection_ready`, `needs_research`, and `routed_out_of_scope` outcomes.
- Add replay tooling, frozen golden projections, negative/fail-closed tests, and a worker apply lane that writes only adapter-owned fields.
- Retain the complete research artifact and keep exact product directions independently source-transcribed.

### Slice 5 — Catalog expansion

- Consume reviewed pilot results and project them through the locked engine. Re-run affected records if the final method/source version differs; do not needlessly repeat unchanged technology research.
- Wait for pilot recalibration/review and validation before choosing actual new additions. A cohort member may conclude low trust, out of scope, or unresolved; research inclusion is not a catalog-admission promise.
- Prepare scannable and recommendation-ready states separately.
- Use the guarded catalog executor with reviewed-head/fingerprint checks, advisory locking, null-safe guards, replay-safe ledgering, dry-run/preflight, and verification receipts.
- Apply only after separate explicit authorization.

### Slice 6 — User feedback/front end, only if approved

- Prepare the existing-surface proposal in German: concise hairdresser-style advice, three trust levels, price/protocol orientation, and optional technology depth. Retain the exact-formula evidence rationale behind the advice.
- Keep Routine Plan and search at their current depth; provide stored technology/evidence facts to chat's existing assessment and comparison path. No new browse/comparison page is part of this scope.

## Verification strategy

- Normative contract lint and artifact-schema validation.
- Frozen calibration and holdout agreement/confidence gates.
- Hash/manifest verification and profile replay.
- Golden projection fixtures plus malformed, unsupported, conflict, unknown, and legacy/null cases.
- Consumer contract tests across intake, admin, recommendation, publication gate, Personal Plan, and chat.
- Red tests proving guarded catalog execution rejects stale heads/fingerprints, concurrent/partial apply, and unsafe replay.
- User-flow verification for every approved frontend change, including weak/conflicted evidence and mobile German copy.
- Admission transition proofs: all new low/null-trust rows are rejected; exact captured legacy rows remain assessable/eligible while pending; no new ID can claim legacy status; reassessment does not silently toggle recommendation/lifecycle flags.
- Persist/read round trip: scalar trust/technology and strict versioned `research_profile` survive intake approval and catalog enrichment and reach named-product chat projection without incompatible claims. Low-trust user assessments are scoped to their authorized submission/inventory and do not become curated recommendations.
- Protocol proofs: new generic protocol selector resolves only the reviewed product/role; missing protocol fails visibly; no current-product timing leaks into another product; Kérastase layering and OGX overnight scheduling either compile correctly or remain explicitly not recommendation-ready.
- For executable slices, run their focused Vitest suites and repository `npm run ci:verify`, then the owning readiness/whole-branch review workflow. Planning-doc changes alone need consistency/link checks, not a production test run.

## Approval boundaries

Approval of this plan or the Phase-1 rulings does not authorize migrations, research batch application, catalog promotion, recommendation activation, production writes, commit/push, deployment, or merge. Those gates remain explicit.

## Review and artifact disposition

The earlier external review identified schema/consumer convergence, the protocol blast radius, and guarded catalog executor proofs; these remain accounted for. A fresh counterpart pass on the concretized Phase-1 proposal is advisory and cannot choose the optional new ranking preference. The plan-owned intensity/mechanism ruling has since been verified against its approved contract and implemented target.

2026-09-30 counterpart verdict: sound decision brief; not yet an implementation handoff. Its intake-schema and explicit projection-allowlist observations were verified locally. It read a draft before the final Personal Plan authority reconciliation; findings about unresolved plan intensity are superseded by the approved category contract.

| Finding | Type | Decision and evidence | Plan change / revalidation |
| --- | --- | --- | --- |
| Explicit new-product protocol route | Architecture clarity | Accepted; current five-value enum and typed readers were verified. Exact product protocols already have product/role identity. | Pin `verified_product_protocol` plus exact reviewed row/pointer resolution; retain legacy values and fail visibly on gaps. |
| Existing-row null-trust transition | Rollout consequence | Accepted as a clarity gap; Nick's threshold concerns additions, while existing approvals must not be revoked by an additive schema change. | Capture exact prior approved set; preserve pending existing rows; reject low/null new admissions; review adverse reassessment explicitly. |
| Aveda cohort/type contradiction | Claimed defect | Rejected: source table has BB-04 Aveda **pre-shampoo** and separate BB-06 optional **leave-in**. They are different exact products. | Repeat IDs in the first-wave scope: BB-01 through BB-05; BB-06 is optional, not counted. |
| Intensity must be re-decided | Product decision | Superseded: approved Plan contract explicitly rejects intensity-only and mechanism ranking; current plan-owned target confirms it. Legacy chat code is a separate compatibility surface. | Preserve current Plan policy; do not silently migrate legacy ranking rules or ask Nick again about an already confirmed Plan rule. |
| Rich JSON might diverge from existing engines | Architecture risk | Accepted for validation, not rejected scope: Nick explicitly requires richer facts in the database, beyond intake-only storage. | Strict versioned schema, bounded fields, approved-source projection, and persist/read golden tests; no arbitrary open blob passed to chat. |
| Migration reversibility and execution gates | Technical readiness | Accepted; necessary before schema/adapter slices, not reasons to reopen charter choices. | Expand/compatible-deploy/backfill sequence, data-preserving rollback, focused tests plus CI and whole-branch review. |

Self-review: current chosen scope reflects all of Nick's rulings; separate Aveda identities are preserved; an optional unapproved ranking extension is not hidden as a default; product depth is persisted and projected into chat; no production action is implied. Exact standard anchors, cohort metrics, and migration/consumer fixtures are next-stage deliverables, not assertions that research already passed.

Internal revalidation after the pilot-sequence correction: eight-product research precedes recalibration and engine review; catalog expansion consumes the reviewed/locked results afterwards. Cohort size concerns products, not researcher lanes or technology dossiers. No high/medium grade is guaranteed, and no calibration row is used as an independent holdout.

Durable plan, source-grounding note, and Phase-1 ruling sheet: **commit with the eventual task PR**. Transient counterpart report: **discard after findings are incorporated**. Research, schema changes, new-row apply, and activation remain distinguishable gates.

## Execution checkpoint — 2026-09-30

Phase-1 rulings and the eight-product learning cohort are confirmed. The provisional v0.1 standard, prompt and runbook have been written and frozen with anonymous and named evidence packets under `data/research/bondbuilder-inci/v1.0/pilot-2026-09-30/`. Semantic v0.1 is not an engine lock; the `v1.0` directory is an artifact-program root, not production approval.

Both formula-only lanes and subsequent named-evidence passes are sealed. Redken has conflicting local formula captures, OGX lacks verified DE-market formula binding, and Kérastase has a size/manufacturer-block mismatch. These are visible holds, not silently chosen formulas or automatic low trust. Source-version findings for other rows are also not live catalog or supplied-pack bindings.

The [initial findings and recalibration brief](pilot-findings.md) retains raw comparisons and separate root adjudication: one provisional low-support finding, seven unresolved trust grades, no research-admission candidates. Marker/flag/protocol fidelity agrees 8/8; trust agreement is only 1/1 on assessable rows and cannot establish medium/high calibration. Four boundary/technology serialization differences expose a property-hold rule ambiguity. Next: Nick review, targeted source/method amendments and affected-row replay. Preserve the initial artifacts. Holdout, engine lock, fit/protocol integration, adapter, database persistence and catalog expansion remain pending. No production code/schema changes or production writes have occurred.

Pilot counterpart review confirmed artifact/count fidelity and separation of approval gates. The revised brief puts Nick's initial review **before** the next semantic method revision. Concrete open calibration ruling: whether unpublished active concentration is a limitation rather than an automatic hold when relevant empirical technology evidence, exact compatible formula and a defensible application bridge exist. This is not a waiver of missing consumer directions/dilution or identity/fit/protocol gates. The next pass may still yield zero additions; wider product sourcing requires scope review rather than automatic expansion. Packet and method deltas must be distinguished; no positive medium/high anchor is currently available. Full accepted/qualified review ledger lives in the findings brief.

Post-pilot interview update: the concentration ruling is now settled as a non-automatic blocker; medium practical trust may incorporate sustained informed experience alongside credible technology/formula support, with commercial context disclosed rather than automatically excluded. Abbey Yung, Tom Hannemann / The Beautiful People and Dejan Garz are required starting sources, not a closed panel. Nick explicitly selected original OLAPLEX No.3 and No.3PLUS as the gold-standard high-trust calibration anchors, carrying relevant predecessor evidence forward. These later rulings supersede the earlier open-question/no-positive-anchor planning status, not the frozen v0.1 observations. Full amendment: [phase-1-rulings.md](./phase-1-rulings.md); source audit: [creator-source-panel.md](./creator-source-panel.md). No historical records or production data are relabelled by this planning update.
