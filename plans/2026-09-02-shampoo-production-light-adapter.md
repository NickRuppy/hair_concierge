# Shampoo Production Light v1 adapter

Status: implemented and locally verified — awaiting publication authorization

## Outcome and source context

Create a reusable, research-only companion workflow that applies the frozen Shampoo v1.4 method to a new current German regular shampoo and projects the reviewed result into only the Shampoo properties used by the current production catalog.

The adapter must preserve the two-layer model:

1. product truth: exact identity, canonical formula and all eight v1.4 direct properties;
2. production projection: ideal thickness eligibility, Shampoo bucket/route/intensity rows and required protocol roles.

Canonical inputs:

- `docs/research/shampoo-inci/v1.4/classification-standard.md`
- `docs/research/shampoo-inci/v1.4/new-product-research-runbook.md`
- `docs/product-intake-research-ops.md`
- current production contracts in `src/lib/shampoo/constants.ts`, `src/lib/product-intake/category-validators.ts` and `src/lib/product-intake/shampoo-protocol-roles.ts`

The original v1.4 engine remains the complete, independent research authority and can still be used for full eight-property research, method validation, holdouts and future sophisticated matching. The lite workflow neither replaces nor weakens it. The parked v1.4 archive remains immutable and research-only, and the adapter does not activate the eight-property model in production.

## Chosen direction

Build a named, reusable **Shampoo Production Light v1** workflow around a pure local TypeScript adapter and small CLI. A future task such as “Research these 50 shampoos with Shampoo Production Light v1 so we can prepare them for Product Intake” must be sufficient to locate and execute the documented procedure without relying on this conversation.

The lite workflow still performs the original engine's exact-identity, canonical-formula and formula-first analysis. “Lite” refers to the operational output and approval scope—not weaker research. It consumes a complete v1.4 research envelope and a separate, evidence-backed production-fit projection assessment. It returns one of three explicit outcomes:

- `property_lane_ready`: validated production Shampoo properties, field rationales/confidence and a concise review summary;
- `needs_research`: identity, formula, direct-property or projection evidence is incomplete or low-confidence;
- `routed_deep_cleansing`: the product is a true reset/deep-cleansing product and must use the existing separate category workflow.

The adapter never queries or writes Supabase. Its JSON is review material that Product Intake may later consume after explicit approval; it is not `catalog_intake_ready` or `global_recommendation_ready` by itself.

### Locked decisions

- Output only production Shampoo properties. Product Intake continues to own catalog identity, price, image, purchase link and full publish readiness.
- Emit only `ideal` thickness matches. Preserve `conditional` assessments in the rationale, but do not write them to binary production eligibility.
- Route true reset/deep-cleansing products to the existing deep-cleansing workflow.
- Choose one primary scalp route by default. Add a second only when exact-product positioning and independent formula evidence support a genuine dual target.
- New ingredient research controls the projection. Existing expert/catalog labels are calibration evidence, not a target the engine must reproduce.
- Store formula-observed cleansing intensity. When it differs from the bucket's expected intensity, the current authority engine should deliberately classify the fit as `supportive` rather than `ideal`; never overwrite product truth to manufacture an ideal fit.
- Produce both machine-readable JSON and a concise Markdown review summary.

### Authoritative projection rules

#### Cleansing intensity

- `low` -> `gentle`
- `moderate` -> `regular`
- ordinary `strong` -> `regular`
- `strong` plus a supported alternating clarifying/reset role -> `clarifying`
- `strong` plus `focusPrimary: clarifying`, `usageRole: occasional_reset` and explicit reset/deep-cleansing positioning -> `routed_deep_cleansing`

Strong cleansing alone does not make a product clarifying or move it to the deep-cleansing category.

Every emitted Shampoo row must contain a non-null `cleansing_intensity`. The production schema technically accepts an omitted/null value, but the live authority engine treats that as missing evidence and cannot match the product. The adapter therefore uses the stricter consumer contract.

The current authority engine expects `gentle` for `trocken` and `irritationen`, and `regular` for `normal`, `dehydriert-fettig` and `schuppen`. A researched intensity that differs is an intentional trade-off signal: the route stays eligible, but its fit is `supportive` rather than `ideal`. `clarifying` similarly remains a visible, consequential observed value rather than being replaced by a bucket default.

#### Scalp route and bucket

The projection assessment records exact positioning evidence, compatible formula evidence, confidence and rationale for each plausible target. The adapter accepts one primary target and at most one independently supported secondary target.

| Supported target | Production bucket | Production route |
| --- | --- | --- |
| ordinary/general | `normal` | `balanced` |
| oily/sebum | `dehydriert-fettig` | `oily` |
| dry scalp or dry flakes | `trocken` | `dry` |
| sensitive/itchy/uncomfortable scalp | `irritationen` | `irritated` |
| true dandruff | `schuppen` | `dandruff` |

Dry flakes never create a dandruff row. A `schuppen/dandruff` row requires both `dandruffSupport: supported` and exact anti-dandruff positioning. Tea tree, mint, menthol or a vague scalp claim cannot establish dandruff support. Sensitive positioning is judged from the whole formula; menthol/mint is a counter-signal, not an automatic veto.

#### Thickness

The research envelope records `ideal | conditional | not_suited` for `fine`, `normal` and `coarse`, with confidence and a concise whole-formula rationale. The assessment must reconcile `weightPotential`, `conditioningLevel`, cleansing architecture, focus and relevant positioning. No single polymer, silicone, oil or marketing claim determines a thickness.

Only `ideal` values become `suitable_thicknesses` and Shampoo spec rows. At least one ideal thickness is required. Current expert labels may expose a disagreement for review but cannot override the new evidence.

#### Rows and roles

Create the cross-product of accepted scalp targets and ideal thicknesses, attach the same required non-null observed cleansing intensity to every row, deduplicate by `thickness + shampoo_bucket`, and validate every bucket/route pair against the current production contract. Derive roles with the existing `deriveShampooProtocolRoles` helper:

- any non-`schuppen` row -> `shampoo_everyday`;
- any `schuppen` row -> `shampoo_dandruff`.

These are required roles only. Exact `product_application_protocols` remain a separate Product Intake/application task.

## Scope and non-goals

### In scope

- A versioned input/output schema for a complete v1.4-to-production projection.
- A pure deterministic adapter implementing the locked rules.
- A local CLI that handles either one JSON input or a frozen batch manifest, writing per-product artifacts plus a complete batch status summary.
- Validation errors that identify the exact missing/contradictory property or projection assessment.
- Representative regression fixtures and a read-only calibration report against ten already researched shampoos.
- Operator documentation showing how to research, project, review and hand the result to Product Intake.
- A copyable single-product and batch invocation contract so future Codex tasks can reliably select this workflow by name.

### Non-goals

- No Supabase reads or writes.
- No catalog creation, merge, approval or publication.
- No change to live matching, Personal Plan, recommendations or user-facing explanations.
- No product identity, image, price, availability or affiliate-link research in the adapter.
- No automatic generation of application instructions/cadence.
- No modification, replacement or deprecation of the hash-pinned parked v1.4 archive or original full engine.
- No extension to conditioners or other categories in this change.

## Target map

- `src/lib/shampoo/production-light-adapter.ts` — versioned Zod contracts, pure validation/projection and typed outcomes.
- `scripts/shampoo-research/project-production-light.ts` — filesystem-only single/batch CLI and JSON/Markdown emission.
- `tests/shampoo-production-light-adapter.test.ts` — rule, boundary and production-contract regression tests.
- `tests/fixtures/shampoo-production-light/` — small representative research-envelope fixtures, including ten-product calibration inputs.
- `docs/product-intake-shampoo-production-light.md` — durable named workflow, single-product and batch invocation examples, input/output contract and readiness boundaries.
- `docs/product-intake-research-ops.md` — concise link from the Product Intake runbook to the owning adapter procedure.
- `package.json` — one local projection/validation command.

Do not edit files under `docs/research/shampoo-inci/` or `data/research/shampoo-inci/`; the parked package validator must continue to pass unchanged.

## Designed operator journey

There is no end-user journey change.

1. Nick starts a single-product or batch task by asking for **Shampoo Production Light v1** and supplies exact identities, GTINs or Product Intake submissions. The documented batch contract freezes the product manifest before research and tracks every product through the same outcome states.
2. The researcher follows Shampoo v1.4: resolve the current German identity/formula, freeze provenance, complete the blind formula pass, reconcile positioning, and finish all eight direct properties with rationales and moderate-or-high confidence.
3. The researcher completes the separate production projection assessment: three thickness judgments and one primary scalp target, with an optional independently supported secondary target.
4. The CLI validates the envelope.
   - A material identity/formula conflict, missing property, low-confidence final property, missing ideal thickness or unsupported dual target returns `needs_research` with exact reasons and no partial DB-shaped payload.
   - A true deep-cleansing/reset product returns `routed_deep_cleansing` with the trigger evidence and no Shampoo payload.
   - Otherwise it returns `property_lane_ready`.
5. Nick reviews a short table containing every proposed production value, rationale, confidence, conditional thickness notes and any legacy-label disagreement. The sibling JSON contains the exact `suitable_thicknesses`, `product_shampoo_specs`, required protocol roles and field rationales.
6. Nick may approve the property package or send a named field back for research. Rework changes the research/projection envelope and reruns the deterministic adapter; it never patches the output directly.
7. When approved, Product Intake combines the property package with separately researched identity, image, price, purchase and exact application protocols. Normal Product Intake approval and guarded apply gates remain unchanged.
8. Completion for one product is an approved, reproducible property package. Completion for a batch is a manifest where every product is either property-lane ready, explicitly routed, or blocked with one named research action; no product silently disappears.
9. Catalog/global recommendation readiness, database apply, deployment and user-facing activation are later explicit gates. The original full engine remains available independently throughout.

Recovery behavior:

- Stale/foreign/reformulated formula -> return to identity research.
- `dandruffSupport: supported` without anti-dandruff positioning -> keep a non-dandruff primary route and explain that the active alone does not create a treatment row.
- Sensitive target plus strong cleansing -> allow `irritationen/irritated`; preserve strong-cleansing trade-off in rationale and intensity rather than rejecting the route automatically.
- No secondary focus or no secondary scalp target -> valid and expected.
- Existing expert label disagrees -> surface comparison only; do not mutate either source silently.

Operator-journey sign-off: **confirmed 2026-09-02**. Nick explicitly requested implementation after confirming that the original v1.4 engine remains independently available and the lite workflow is a reusable named companion for future one-product or batch intake.

## Planning evidence

This is backend/operator tooling with no change to an existing user-facing surface, so no visual mockup is required. The review artifacts are the JSON contract and concise Markdown table generated by the CLI. No runnable prototype was needed to choose the architecture because current schemas and the parked v1.4 contract establish the required boundary.

## Ordered tasks

### 1. Define and test the versioned adapter contract

Create strict schemas for identity/formula readiness, the eight v1.4 properties, positioning evidence, three thickness assessments, primary/secondary scalp targets and legacy comparison metadata. Define typed `property_lane_ready`, `needs_research` and `routed_deep_cleansing` outputs.

Consumes: Shampoo v1.4 value/confidence/rationale contract and current production enums.

Produces: a public pure-function signature and stable `shampoo-production-light-v1` JSON envelope.

Tests: reject missing properties, invalid values, low-confidence final fields, unresolved formula conflict, no ideal thickness, invalid primary target and unsupported secondary target.

Completion: invalid or incomplete research cannot produce a partial DB-shaped payload, and all errors identify exact JSON paths.

### 2. Implement deterministic production projection

Implement cleansing, deep-cleaning boundary, scalp bucket/route, ideal-thickness cross-product and protocol-role rules. Reuse current constants and `deriveShampooProtocolRoles`; do not duplicate production enums.

Consumes: validated adapter input from task 1.

Produces: deterministic property payload, rationales/confidence and comparison warnings.

Tests: ordinary general; dry scalp/dry flakes; formula-supported positioned dandruff; supported active without treatment positioning; sensitive product with strong cleansing; strong ordinary Shampoo; strong alternating clarifier; true deep-cleanser routing; legitimate dual scalp target; rejected unsupported dual target; multi-thickness row cross-product; missing/null intensity refusal.

Completion: projected rows satisfy the existing Shampoo category validator when a test fixture supplies the separately owned Product Intake fields/protocols; representative rows also pass through `evaluateShampooAuthority` and prove the intended `ideal`, `supportive` and `unknown` boundaries; repeated identical input is byte-stable after canonical serialization.

### 3. Add the local single/batch CLI and review artifacts

Add `research:shampoo:production-light -- --input <file> --output <dir>` for one product and `--manifest <file> --output <dir>` for a frozen batch. The command performs no network access, writes atomically, exits non-zero for malformed input, and emits a valid outcome artifact for research/deep-cleansing routing. Generate compact Markdown from the same typed output so JSON and review copy cannot drift. Batch mode writes one directory per manifest item plus `batch-summary.json` and `batch-summary.md`; duplicate IDs, missing result files and silent member loss are hard failures.

Consumes: pure adapter API from task 2.

Produces: per-product `production-light.json` and `production-light-summary.md`, plus batch summaries when a manifest is supplied.

Tests: single CLI success, mixed-outcome batch success, duplicate batch ID, missing batch member, routed outcome, needs-research outcome, malformed JSON, refused overwrite unless an explicit flag is supplied, stable rerun, and no secret/database dependency.

Completion: an operator can run one command for one or 50 researched products and account for every input in both machine and review outputs without opening every full research record.

### 4. Calibrate on ten researched products

Create ten small adapter fixtures spanning general, oily, dry/dry-flake, sensitive, dandruff, different weight/conditioning bands, multi-thickness and reset boundaries. Their projection assessments must cite the existing archived research evidence rather than retrofitting current catalog labels. Produce a read-only calibration report listing agreements and disagreements with legacy fields and explaining every disagreement.

Consumes: tasks 1-3 and existing v1.4 archive evidence.

Produces: regression fixtures and calibration report.

Checks: parked-package integrity command remains green; the report includes all ten products and contains no unresolved adapter failure.

Completion: the ten-product set contains no unresolved adapter failure, and every observed-intensity mismatch is correctly identified as an intentional `supportive` fit rather than a research disagreement.

### 5. Document the repeatable operator handoff

Document the research -> adapter -> review -> Product Intake sequence, including the exact input template, command, output meanings, rework loop and the distinction between `property_lane_ready`, `catalog_intake_ready` and `global_recommendation_ready`. Include copyable future invocations for one product and a frozen batch, plus a batch status summary that counts ready, routed and blocked products.

Consumes: stable contracts and examples from tasks 1-4.

Produces: durable operator documentation and a concise link from the canonical Product Intake runbook.

Checks: a clean-worktree dry run can follow only the document and reproduce a fixture's JSON and Markdown outputs.

Completion: another researcher can apply the method to one or 50 new shampoos by asking for **Shampoo Production Light v1**, without relying on this conversation, while Product Intake cannot mistake the output for publish authorization.

## Verification

### Automated

- Focused adapter and CLI tests.
- Existing Product Intake Shampoo validator/protocol-role tests.
- Actual Shampoo authority evaluation tests proving observed-intensity matches are `ideal`, divergences are `supportive`, and missing intensity is `unknown`.
- TypeScript typecheck and relevant lint checks.
- `npm run research:shampoo:validate-parked-v14` to prove the archived method/evidence did not change.

### Manual/operator

- Run the CLI for one ordinary, one sensitive, one dandruff and one deep-cleansing fixture.
- Confirm the Markdown table and JSON contain identical values.
- Confirm a field rework changes the input and deterministically regenerates output.
- Confirm no `.env.local`, Supabase client or live product identifier is needed.

### Live-state and migration

- No migration and no live-state check are required because the adapter is local/read-only.
- Any later catalog apply requires a separate Product Intake preflight and explicit per-product authorization.

### Evidence-sensitive review

- Verify all ten fixture projections against the cited v1.4 evidence.
- Treat legacy divergence as a review signal, not an automatic failure.
- Require every emitted field to have moderate-or-high internal confidence and a conclusion-first rationale.

## Review and handoff

- Worktree: `.worktrees/shampoo-production-light-adapter`
- Branch: `codex/shampoo-production-light-adapter`
- Counterpart plan review: approved with revisions; verified intensity-semantic findings incorporated.
- Nick operator-journey sign-off: confirmed 2026-09-02.
- Implementation started after journey sign-off and is complete on the task worktree.
- `ready-check` and the whole-change `request-code-review` pass completed; no blocking findings remain.
- Commit artifacts: adapter, CLI, tests, fixtures, calibration report, durable docs and this plan.
- Archive artifacts: none expected.
- Discard artifacts: transient counterpart-review output and temporary CLI outputs.
- Stop before commit/push/PR unless Nick explicitly says to ship; stop before any database apply, merge, deployment or production activation unless separately authorized.
