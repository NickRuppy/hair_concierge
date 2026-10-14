# Large reachability-layer challenge at current 299 inventory

**Result: no new large disconnected retirement closure proved; 0 C/D declarations proposed.** The three largest old graph components contain 73 source modules and **974 distinct AST test declarations** across 66 nonzero-count test files, but all 73 modules become statically reachable when their current registered framework/operator roots are included. These counts are candidate surface, not full-body audit coverage or removable tests. There is no request to retire supported Labs/operator features merely to increase the quota.

Read-only worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`. Parent remains sole writer/operator. No repository edit, test/compiler/owner execution, provider/browser/DB/env/credential operation occurred. `/tmp` graph scripts parsed files and resolved static module paths only.

## Corrected graph and depth limits

The supplied `/tmp/test-audit-reachability268.cjs` explicitly excludes both `src/app/labs/` and `src/app/api/labs/` from roots and does not root package commands. Therefore its `outsideProduct` and `unrootedWithTests` mean **outside public-product roots**, not uncallable or dead. This explains why whole active Labs and operator areas appeared as large candidates.

I first filtered its 175-module outsideProduct set against current existing files, formed weak components within that induced set, and recounted direct-import test surfaces using `/tmp/test-audit-final299-declarations.json` (11,593 declaration sites). I then reran a read-only source graph from current files as `/tmp/test-audit-reachability299-supported.cjs`, preserving literal import/path resolution and adding:

* every current Next Labs page/API framework root, instead of deliberately excluding them;
* existing literal script targets from package scripts in the root and current workspaces (143 registered command-target entries, not 143 distinct modules);
* current `apps/*/app/**` framework page/route/layout entries.

Fresh result: **3,097 code files, 456 distinct roots, 1,788 reachable files, 27 outside-root `src` modules, and 12 outside-root modules with direct test callers**. All three large components below are now reached. Current graph is `/tmp/test-audit-reachability299-supported.json`; exact component membership, tests and shortest supported-root paths are `/tmp/test-audit-large-cluster299-evidence.json`.

This is conservative import reachability, not export-level liveness or runtime invocation proof. It includes type dependencies and literal path references, and cannot prove arbitrary computed paths or human intent. Framework/package registration plus manual caller/route/docs/history inspection establishes why the large clusters cannot be declared obsolete. I did not fully read 974 tests or every owner body and therefore assign no blanket per-declaration R marks. No existing SQL/storage/research contract is reclassified by static topology.

Prior ledgers were checked before selecting scope: retired-agent, retired-tools/retrieval, next-reachability, and barrel-orphan-layer. Their active operator/Lab conclusions were rechecked at current registration and direct execution edges, not adopted solely by title. The already removed `run-compare.ts -> scenarios.ts` orphan closure is excluded; current `agent-compare-runner.spec.ts` has four retained declarations, not the old eleven. The prior 26 modules and 299 campaign removals receive no duplicate credit.

## A. Intake/catalog authority/calibration: 30 modules, 482 direct-import sites

The apparent disconnected island has **51 existing external non-test importing files**, predominantly guarded operator commands. This is not a closed test-only subsystem.

Concrete current roots/call edges read:

* `package.json:57` registers `catalog:authority:audit` → `scripts/catalog-authority/audit.ts`. Its imports at :8–19 load actual audit, reader, contracts and Supabase audit source; `runCatalogAuthorityAudit` reads the snapshot/schema path and invokes those owners. `docs/catalog-authority.md:72–88` specifies both live-read and offline-input operator commands. No command was executed.
* `package.json:92,102,110–113` registers research preparation, approval and expansion commands. `scripts/product-intake/prepare-research.ts:7` imports actual `dryRunProductIntakeReadyForReview`; `approve.ts:13` retains category operation typing; enrichment `index.ts:3–12` imports actual category validators. Current expansion/calibration/protocol command targets root the rest of the component, as the JSON path map shows.
* `package.json:61–64` still exposes V2 preflight and pointer-delta commands. The full **46-line** `scripts/product-intake/catalog-enrichment/stage5-v2-apply.ts` was read: its full-registry apply is intentionally an executable refusal since 2026-09-14, directs operators to pointer-delta, and explicitly says the historical artifact remains frozen and consumed by preflight. This is precise retirement of a write command, not evidence that all historical protocol validators, migration proofs or the new pointer-delta owner are obsolete.
* `docs/research/README.md` was fully read. It declares active Shampoo Production Light, Conditioner/Leave-in intake adapters and immutable provenance. Active package scripts point at these adapters. Research/parked artifacts are not automatically retirement targets.
* Current history: **92f00b8c** (2026-09-14) introduces pointer-delta while retiring full-registry apply; **6be9b148** (same date) updates current category validators for binary heat; **3e5018eb** updates oil capability. These are operational changes, not a wholesale decommission.

**Closure decision:** no D/C. Deleting the 30-module set would break registered audit/approval/calibration/expansion entry points and their storage safeguards. The current pointer-delta tests cannot replace protocol history, exact manifest admission, SQL guards or frozen-artifact checks by mere shared terminology. A future redundant-validator audit would need exact payload/guard-to-executor correspondence and full donor/keeper bodies; this lane supplies no such deletion evidence.

## B. Personal Plan Labs/fixture gateways: 21 modules, 260 direct-import sites

This induced component has no incoming edge from the old graph's public roots because its roots are themselves Labs pages. It is still a concrete supported QA closure.

* `src/app/labs/personal-plan/stage-3/page.tsx` was fully read: actual environment admission calls `isPersonalPlanStage3LabEnabled` then renders `PersonalPlanStage3LabClient`. The admission helper was fully read and permits development, preview or explicit CI lab mode.
* `lab-client.tsx:6–17,28,55` imports/constructs the real fixture gateway/scenarios and passes development analytics to the rendered flow; Stage 2 preview does the same through `createStage2FixtureGateway` (:19,106). Feinschliff journey constructs Stage 3 gateway (:83) and passes its analytics (:256). These callers are live framework components, not tests pretending to be production.
* `docs/local-qa-access.md:60–99` explicitly directs operators to these Labs for no-auth stage UI/copy/layout review and carefully distinguishes their limits from entitlement/persistence testing.
* `package.json:71–72` registers native Stage 3 Lab and multi-stage journey suites, including exact CI enable flags. `.github/workflows/ci.yml:200,247` runs these commands. History **822a547c** unifies the paid journey while retaining its harnesses; **2902a8be** subsequently repairs unresolved heat protection on this surface. An old fixture name is not a cutover certificate.

**Closure decision:** no D/C. Fixture gateway tests may contain individual lower-layer redundancy (already reviewed in earlier Stage 3 lanes), but removing the complete gateway/Lab feature would destroy an explicitly used QA entry. Several direct-import files are actual billing/admission tests reusing fixtures, not tests exclusively owned by the Labs. The graph count therefore overstates even a hypothetical whole-feature deletion surface. Browser tests using route strings may add dependencies not counted by direct imports.

## C. Compare/legacy-agent operators: 22 modules, 232 direct-import sites

This remains the largest coherent legacy runtime candidate, but current source makes support explicit rather than merely leaving unreachable code around.

* Full `src/app/labs/agent-compare/page.tsx` remains a development-only framework page rendering AgentCompareLab.
* Current `src/app/api/labs/agent-compare/route.ts:14–28` accepts classic/tool_loop/AgentV2 modes; :43–69 dynamically imports the three real runners; :195–237 maps requested modes to runners and executes each result. Read through route normalization/running/blinding logic; no API call executed.
* The actual UI still offers **Debug: Classic vs Legacy Tool-Loop** (`agent-compare-lab.tsx:43–54`) and returns both requested systems. Thus legacy modes are operator-reachable in the shipped development surface, not just schema aliases or tests forcing impossible values.
* `run-agentic-tool-loop.ts:85–111` resolves its runtime module and model client, :412 invokes real runAgenticToolTurn and :424 supplies loadAdvisorGuidance; `run-shadow-agent.ts:228` invokes runShadowAgentTurn. This closes the misleading gap caused by dynamic loading. I inspected these call sites; I did not reread the entire legacy engine/runtime in this navigation lane.
* `package.json:68` registers the legacy/Compare test suites; CI :164 invokes test:agent. `scripts/agent-v2/run-guidance-regression.ts` is an additional operator importer and is documented in guidance migration regression records. This does not make all tests good, but rules out absence of maintained operator reachability.
* **dccff6f7** retired production RAG in June; **fa358862** then updated Compare defaults in July without dropping the debug selector. The production `/api/chat` still selects AgentV2 independently; keeping public production alone does not preserve this supported comparison purpose.

**Closure decision:** no D/C without changing current operator support. The stronger live Compare route previously justified removing the separate run-compare/scenarios orchestration closure, and that cleanup has already happened. It does not duplicate the full classic/tool-loop execution internals it still invokes. Deleting all 232 sites or the runtime would require a separate explicit feature-retirement decision, plus shared prompt/type/trace migration and full per-declaration review. No user decision is requested by this read-only lane; the current audit simply cannot count the feature as dead.

## Remaining graph leads: bounded triage, not another small all-R sweep

The fresh graph leaves only 12 source modules with direct test callers. High apparent counts are dominated by `paypal/trial-plan-shape.ts` (82 sites in four mixed billing files) and the test-only forwarding `personal-plan/products/index.ts` barrel (57 sites). Prior barrel/retirement ledgers already establish that the latter forwards live concrete state/portfolio owners and yields **zero test declaration credit**; direct import cleanup is not a whole-test retirement. The other leads are documented/research/operator leaves or small ingest/affiliate helpers. They are listed in current JSON and were not broadened into a new leaf audit merely to manufacture another all-R report.

No large **new** isolated component remains supported by the requested graph evidence. Any high-yield next pass must establish semantic duplicate contracts inside an active subsystem; public-route reachability cannot supply that evidence, and root omission cannot substitute for it.

## Exact scope appendix

The following inventories are complete for the three graph components, not complete body audits. Each source list is the weak component induced by the supplied outsideProduct set, so shared outgoing live-product dependencies are outside the list. It is a candidate topology set, not a deletion-safe closure. Shortest current root paths and external importers are in the evidence JSON.

### Component A source membership (30 modules)

- `src/app/api/labs/shampoo-research/review/route.ts`
- `src/app/labs/shampoo-research/page.tsx`
- `src/app/labs/shampoo-research/shampoo-v14-pilot-client.tsx`
- `src/lib/catalog-authority/audit-reader.ts`
- `src/lib/catalog-authority/audit.ts`
- `src/lib/catalog-authority/contracts.ts`
- `src/lib/catalog-authority/oil-repair.ts`
- `src/lib/catalog-authority/repair.ts`
- `src/lib/catalog-authority/supabase-audit-source.ts`
- `src/lib/labs/shampoo-v14-pilot-review.ts`
- `src/lib/product-intake/catalog-enrichment/heat.ts`
- `src/lib/product-intake/catalog-enrichment/index.ts`
- `src/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20.ts`
- `src/lib/product-intake/catalog-enrichment/leave-in-research-calibration.ts`
- `src/lib/product-intake/catalog-enrichment/scalp.ts`
- `src/lib/product-intake/catalog-enrichment/scanner-identifier-backfill.ts`
- `src/lib/product-intake/catalog-enrichment/stage5-catalog-bundle.ts`
- `src/lib/product-intake/catalog-enrichment/stage5-protocol-amendments.ts`
- `src/lib/product-intake/catalog-enrichment/stage5-protocols.ts`
- `src/lib/product-intake/catalog-enrichment/stage5-v2-application.ts`
- `src/lib/product-intake/catalog-enrichment/stage5-v2-builder.ts`
- `src/lib/product-intake/catalog-enrichment/stage5-v2-pointer-delta.ts`
- `src/lib/product-intake/category-validators.ts`
- `src/lib/product-intake/expansion-apply-templates.ts`
- `src/lib/product-intake/expansion-apply.ts`
- `src/lib/product-intake/expansion-manifest.ts`
- `src/lib/product-intake/review-workflow.ts`
- `src/lib/product-intake/shampoo-protocol-roles.ts`
- `src/lib/shampoo/focus-v15.ts`
- `src/lib/shampoo/production-light-adapter.ts`

### Component A direct-import test inventory

| AST sites | File |
|---:|---|
| 2 | `tests/catalog-authority-audit-command.test.ts` |
| 5 | `tests/catalog-authority-audit-reader.test.ts` |
| 19 | `tests/catalog-authority-audit.test.ts` |
| 4 | `tests/catalog-authority-legacy-sync-retirement-migration.test.ts` |
| 5 | `tests/catalog-authority-oil-repair.test.ts` |
| 10 | `tests/catalog-authority-repair.test.ts` |
| 18 | `tests/expansion-apply-batch.test.ts` |
| 10 | `tests/expansion-apply-templates.test.ts` |
| 13 | `tests/leave-in-calibration-executor-postgres.test.ts` |
| 15 | `tests/leave-in-calibration-v2-t20-executor-postgres.test.ts` |
| 5 | `tests/oil-day-type-rulings-migration-postgres.test.ts` |
| 11 | `tests/personal-plan-exact-catalog-bundle.test.ts` |
| 4 | `tests/personal-plan-leave-in-use-case-manifest.test.ts` |
| 10 | `tests/personal-plan-product-dispositions.test.ts` |
| 24 | `tests/personal-plan-stage5-catalog-program.test.ts` |
| 1 | `tests/personal-plan-stage5-disposition-resolution-postgres.test.ts` |
| 1 | `tests/personal-plan-stage5-k18-live-artifact.test.ts` |
| 12 | `tests/personal-plan-stage5-protocol-amendment.test.ts` |
| 4 | `tests/personal-plan-stage5-v2-activation.test.ts` |
| 4 | `tests/personal-plan-stage5-v2-authority-reconciliation-migration.test.ts` |
| 5 | `tests/personal-plan-stage5-v2-builder.test.ts` |
| 15 | `tests/personal-plan-stage5-v2-pointer-delta-postgres.test.ts` |
| 14 | `tests/personal-plan-stage5-v2-pointer-delta.test.ts` |
| 6 | `tests/personal-plan-stage5-v2-preflight.test.ts` |
| 1 | `tests/product-intake-catalog-enrichment-batch.test.ts` |

Historical inventory: the one-test Heat batch file is superseded by the existing Heat preflight keeper in the next349 assertion-union batch. Its three package-script consumers are rerouted to the surviving Heat suite; this row records the original audit inventory.
| 10 | `tests/product-intake-catalog-enrichment-heat.test.ts` |
| 8 | `tests/product-intake-catalog-enrichment-leave-in-calibration-v2-t20.test.ts` |
| 17 | `tests/product-intake-catalog-enrichment-leave-in-calibration.test.ts` |
| 17 | `tests/product-intake-catalog-enrichment-scalp.test.ts` |
| 23 | `tests/product-intake-catalog-enrichment.test.ts` |
| 15 | `tests/product-intake-expansion-manifest.test.ts` |
| 21 | `tests/product-intake-research-jobs.test.ts` |
| 26 | `tests/product-intake-review-workflow.test.ts` |
| 21 | `tests/scan-expansion-batch-postgres.test.ts` |
| 24 | `tests/scanner-existing-identifier-backfill-postgres.test.ts` |
| 23 | `tests/scanner-existing-identifier-backfill.test.ts` |
| 7 | `tests/shampoo-focus-v15.test.ts` |
| 18 | `tests/shampoo-production-light-adapter.test.ts` |
| 3 | `tests/shampoo-production-light-authority-contract.test.ts` |
| 3 | `tests/shampoo-production-light-calibration.test.ts` |
| 6 | `tests/shampoo-production-light-cli.test.ts` |
| 1 | `tests/shampoo-protocol-roles.test.ts` |
| 5 | `tests/shampoo-v14-pilot-review-api.test.ts` |
| 7 | `tests/shampoo-v14-pilot-review-ui.test.tsx` |
| 9 | `tests/shampoo-v14-pilot-review.test.ts` |

### Component B source membership (21 modules)

- `src/app/labs/feinschliff-journey/fixtures.ts`
- `src/app/labs/feinschliff-journey/journey-client.tsx`
- `src/app/labs/feinschliff-journey/page.tsx`
- `src/app/labs/feinschliff-journey/stage3-entry.ts`
- `src/app/labs/personal-plan-routine-editor/page.tsx`
- `src/app/labs/personal-plan-routine-editor/routine-editor-lab.tsx`
- `src/app/labs/personal-plan-stage-1-2/actions.ts`
- `src/app/labs/personal-plan-stage-1-2/fixture.ts`
- `src/app/labs/personal-plan-stage-1-2/integration.ts`
- `src/app/labs/personal-plan-stage-1-2/journey-client.tsx`
- `src/app/labs/personal-plan-stage-1-2/page.tsx`
- `src/app/labs/personal-plan-stage-2/page.tsx`
- `src/app/labs/personal-plan-stage-2/preview-client.tsx`
- `src/app/labs/personal-plan-start/page.tsx`
- `src/app/labs/personal-plan/stage-3/lab-client.tsx`
- `src/app/labs/personal-plan/stage-3/page.tsx`
- `src/lib/labs/personal-plan-stage3-access.ts`
- `src/lib/personal-plan/products/fixture-gateway.ts`
- `src/lib/personal-plan/products/fixture-scenarios.ts`
- `src/lib/personal-plan/products/stage3-development-analytics.ts`
- `src/lib/personal-plan/refinement/fixture-gateway.ts`

### Component B direct-import test inventory

| AST sites | File |
|---:|---|
| 12 | `tests/freemium-paypal-webhook-provisioning.test.ts` |
| 14 | `tests/freemium-plan-provisioning.test.ts` |
| 4 | `tests/personal-plan-direct-accept-seen-state-join.test.ts` |
| 36 | `tests/personal-plan-direct-acceptance.test.ts` |
| 2 | `tests/personal-plan-stage1-2-3-integration.test.ts` |
| 11 | `tests/personal-plan-stage2-fixture-gateway.test.ts` |
| 32 | `tests/personal-plan-stage2-module-entry.test.tsx` |
| 18 | `tests/personal-plan-stage2-refinement-ui.test.tsx` |
| 6 | `tests/personal-plan-stage3-analytics.test.ts` |
| 82 | `tests/personal-plan-stage3-flow.test.tsx` |
| 22 | `tests/personal-plan-stage3-gateway.test.ts` |
| 9 | `tests/personal-plan-stage3-release.test.ts` |
| 0 | `tests/personal-plan-start-preview.fixtures.ts` |
| 12 | `tests/personal-plan-start.spec.ts` |

### Component C source membership (22 modules)

- `src/app/api/labs/agent-compare/judgments/route.ts`
- `src/app/api/labs/agent-compare/route.ts`
- `src/app/labs/agent-compare/page.tsx`
- `src/components/labs/agent-compare-lab.tsx`
- `src/lib/agent-v2/compare/run-agent-v2.ts`
- `src/lib/agent/compare/judgment-log.ts`
- `src/lib/agent/compare/prompt-packs.ts`
- `src/lib/agent/compare/run-agentic-tool-loop.ts`
- `src/lib/agent/compare/run-shadow-agent.ts`
- `src/lib/agent/compare/tool-loop-variants.ts`
- `src/lib/agent/compare/types.ts`
- `src/lib/agent/guidance/load-guidance.ts`
- `src/lib/agent/orchestrator/agentic-answer-context.ts`
- `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
- `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- `src/lib/agent/orchestrator/current-turn-context.ts`
- `src/lib/agent/orchestrator/model-client.ts`
- `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- `src/lib/agent/orchestrator/run-shadow-agent-turn.ts`
- `src/lib/agent/orchestrator/tool-definitions.ts`
- `src/lib/agent/tools/load-advisor-guidance.ts`
- `src/lib/openai/chat.ts`

### Component C direct-import test inventory

| AST sites | File |
|---:|---|
| 23 | `tests/agent-compare-api.spec.ts` |
| 13 | `tests/agent-compare-product-trace.spec.ts` |
| 4 | `tests/agent-compare-runner.spec.ts` |
| 42 | `tests/agent-final-render-prompt.spec.ts` |
| 32 | `tests/agent-guidance.spec.ts` |
| 6 | `tests/agent-shadow.spec.ts` |
| 19 | `tests/agent-v2-compare-runner.spec.ts` |
| 93 | `tests/agentic-tool-loop.spec.ts` |

## Verification and receipt

Read-only AST graph generation and current file-existence/import/package-route checks completed. No owner execution or new deletion proved. Proposed removals: **0 declarations, 0 source modules**. No mutation, focused test command or coverage result is supplied because there is no evidence-ready cut. Parent campaign coverage and baseline failures are unchanged.
