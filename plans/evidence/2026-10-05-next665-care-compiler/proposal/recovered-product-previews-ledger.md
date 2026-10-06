# Stage-1 product previews — complete 17-site read-only ledger

Scope: `tests/personal-plan/product-previews.test.ts` only, current SHA `f622fe85d64116aa02919b49e97243d43c459e6f10c00eacf3668371e62de1f7`; 17 top-level AST declarations. **R17 / F0 / C0 / D0.** No candidate reaches the C/D bar: no existing keeper has the donor’s full category/authority/negative assertion union on the same operative inputs.

## Execution closure

`GET` authenticates and gates access before `createStage1PersistenceService(...).loadOrCreate`, then invokes `computeStage1ProductExamplePreviews` at `src/app/api/personal-plan/stage-1/previews/route.ts:45-88`. The producer derives role tasks, suppresses deferred/non-card roles and uses a category cache (Shampoo per role) at `src/lib/personal-plan/product-previews.ts:45-106`; each task evaluates candidate selection, selected-product facts, image/fingerprint, permitted verdict, reasoning, and commerce at :197-326. Discovery also invokes the same owner on its recomputed nonpersisted snapshot (`src/lib/discovery/load-ideal-routine.ts:296-326`); direct acceptance shares its role-key predicate and separately asserts preview/server agreement in `tests/personal-plan-direct-accept-seen-state-join.test.ts:50-105,350-395`. Those are overlapping consumers, not complete replacement keepers for these category cases.

## Per declaration

- **R :82** Conditioner selected product → image/commerce/reasoning: exact selected-authority mapping and all response fields; no route/consumer keeper asserts this union.
- **R :149** missing presentation image → `post_refinement`: distinct image gate after recommendation selection.
- **R :199** null currency → no price label: commerce fail-closed branch distinct from product selection.
- **R :248** 13th irritation Shampoo candidate: role-sensitive Shampoo authority scan; a fixed early candidate would pass other cases.
- **R :310** supportive basis Conditioner: allowed-verdict policy boundary, distinct from ideal selection.
- **R :368** uncovered-slot Oil recommendation: second evaluation of selected recommendation, not merely portfolio-slot outcome.
- **R :431** uncovered Scalp Care recommendation: complementary-coverage input plus selected-image safety.
- **R :504** Mask exact fit and unsuitable-thickness fallback: both positive and negative thickness outcomes in one category authority.
- **R :590** supportive Mask across optional and basis: tier-policy matrix distinct from Conditioner supportive policy.
- **R :673** Bondbuilder exact fit / unsuitable thickness: Bondbuilder authority predicate and fallback differs from Mask.
- **R :757** tied Bondbuilder shortlist → authority tie default: product identity contract also read by direct-accept join keeper, but this test uniquely asserts preview’s image-backed selected card under the tie fixture.
- **R :892** matching Shampoo plus another-category candidate-load failure: `Promise.all` partial failure containment with a surviving recommendation.
- **R :966** two-role Shampoo → two previews: output cardinality/role-key contract.
- **R :1011** multi-role Oil shares one candidate load: category cache key for non-role-sensitive categories; distinct operational read count.
- **R :1061** multi-role Shampoo loads per role: explicit inverse cache policy required by Shampoo spec readset.
- **R :1122** route auth before plan/catalog reads: transport admission/order boundary.
- **R :1138** route returns source-bound preview data without Stage1 mutation: source ID/hash output and no-write route contract.

## History / CI / limits

History ties distinct cases to concrete fixes: `ecf4352f` image selection, `d595dc73` image-backed Mask, `2da01143` and `c75bbea8` Bondbuilder tie/per-role cards, `3e2c63d8` Scalp Care complement, `395ce5c4` supportive fallback. `package.json:test:node` and CI `quality-node` cover top-level test files; no runner was started.

Read limit: full 17 callback bodies plus direct producer/route and the two overlapping consumer excerpts above. I did not re-audit category authority implementations, the complete Stage1 persistence service, or external catalog/provider transport. These are retention reasons for this bounded file only, not a global claim about Personal Plan tests.
