# Product Intake matrix/source-grep discovery — read-only

## Inventory

Largest in-scope suites: `product-intake-submissions` 51, review-app 39, review-workflow 26, research-jobs 23, lookup 23, catalog-enrichment 23, matching 22, review-scripts 17. I excluded already-applied Stage5 artifacts plus assigned agent/Compare/Discovery work.

## Result and limit

No full candidate test file was selected for D/C in this pass: the initial inventory showed that the apparent matrix-heavy suites are tied to active Product Intake writers, review operators, research job lifecycle, catalog authority, and guarded preflight/apply scripts. Package commands retain live operators for heat/scalp/leave-in protocol lanes (`package.json:125-158`), so fixture repetition cannot be assumed redundant.

## Specific counterproof

`tests/product-intake-research-jobs.test.ts`, research-package, review-scripts, and catalog-lifecycle tests protect job locks, human review handoff, guarded apply/preflight receipts and catalog authority. Those are storage/protocol/operator contracts and do not qualify as junk merely because they use fixtures or inspect scripts. History confirms maintained feature work through model routing/image QA (`14127b07`) and scanner enrichment (`7072124b`), not an explicit retirement.

## Complete-read declaration ledger (156)

All five bodies were read: submissions 51 (2,216 lines), review-app 39 (1,991), review-workflow 26 (861), research-jobs 23 (1,562), review-scripts 17 (1,278). **D=0, C=0, F=0, R=156.** This is not a blanket active-feature rationale: each line below names the distinct observation class and owner boundary; no identical stronger keeper was found.

### R — `product-intake-submissions.test.ts` (51)

* `:37,:442,:460,:495,:531` category admission/feature gate/schema/identifier normalization.
* `:543,:564,:598,:636,:666,:701,:738,:779,:823,:844,:868` matched versus unknown intake, atomic image/persistence compensation, server-derived validation, owner-path and expiry checks.
* `:893,:910,:931,:956,:1010,:1063,:1118,:1168,:1223,:1248,:1269,:1325,:1369` usage-slot replacement and pending-submission state-machine/ownership ordering.
* `:1408,:1449,:1458,:1499,:1539,:1568,:1592,:1649,:1688,:1721,:1761,:1794,:1818,:1845` chat ownership, shared open-state set, scan catalog eligibility, GTIN/dm provenance/privacy, unique-index race and null identifier behavior.
* `:1862,:1882,:1951,:2047,:2081,:2115,:2157,:2195` route fail-closed ordering, legacy dual-write linkage, storage error classes and binary image validation.

Direct owners are submission service/routes, storage verifier, and pending-submission writer. No UI/route sibling can replace transaction compensation, race or privacy assertions.

### R — `product-intake-review-app.test.ts` (39)

* `:209,:228,:265,:304,:317,:333,:365,:409` review package state projection, detail/evidence, local candidate preference and traversal block.
* `:453,:537,:576,:684,:802,:861` image replacement/search source identity, JS fallback and unsafe URL rejection.
* `:910,:971,:1001,:1026,:1069` property rationales, stale validation, image metadata and table representation.
* `:1081,:1107,:1133,:1166,:1209,:1216,:1240,:1305,:1375` per-field/image/final approval writes, stale-decision invalidation and approval gates.
* `:1428,:1448,:1460,:1481,:1566,:1661,:1745,:1834,:1865,:1909,:1951` signed-path scope, payload patching, finalization/cutout fail-closed behavior and image-decision states.

Owner is review-app file/service plus image finalization script. UI tests do not cover file-path traversal, candidate provenance, or write ordering.

### R — `product-intake-review-workflow.test.ts` (26)

* `:343,:352,:364,:375,:389,:421,:439,:481` category and canonical protocol applicability/rejection.
* Remaining declarations through `:861` validate approval validator field paths, reviewed product facts, decision transitions and handoff state; all are category protocol/publication guards. Stronger Stage5 artifact tests are excluded and do not exercise generic validator shape.

### R — `product-intake-research-jobs.test.ts` (23)

* `:131,:178` GTIN packet provenance/mismatch no-leak; `:547,:567` workspace contract; `:577,:602,:625,:650,:670,:685,:693,:727,:745` durable job lifecycle, service-role/RPC/partial-index/local-route boundaries.
* `:774,:787,:928,:1060,:1087,:1149,:1321,:1347,:1521,:1545` artifact/reviewer UI contract, approval normalization, worker modes, publish fail-closed and image payload/decision validation.

### R — `product-intake-review-scripts.test.ts` (17)

* `:62,:114,:161,:253` package/migration/dry-run/CLI parsing protocol.
* `:261,:424,:486` queue projection, filter/pagination/export semantics.
* `:559,:709,:777` promotion readiness, approved-submission requirement and optimistic stale-write guard.
* `:1021,:1029,:1091,:1148,:1172,:1201,:1219` German notification copy, stale AgentV2 context removal, missing-info safety and category-spec derivation.

## Duplicate/transfer check

No exact duplicate was found. Some route tests re-observe service output, but they add distinct caller ordering, storage or user-facing persistence. The nearest overlap is approval state between review-app and research-jobs; review-app owns image/property decision writes while research-jobs owns durable worker/publish handoff, so neither transfers cleanly. No source/support closure unlocked.

## Native validation for a future proven batch

`node --import ./tests/server-only-register.cjs --import tsx --test <exact-files>`.
