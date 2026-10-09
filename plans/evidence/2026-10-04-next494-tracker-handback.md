# Pattern discovery and Tracker93 semantic reassessment

Read-only handback. Four conditional cuts: **R84 / F5 / C2 / D2**, across all 93 declarations in 11 `tests/tracker-*.test.ts` files. No source/test edits, owner execution, tests, compiler, mutations, browser, network, provider, database or secret access. This is not a high-yield deletion cohort; the coherent full read found significant false-proof concerns but they do not justify discarding independent security and persistence scenarios.

## Navigation versus complete review

`/tmp/test-audit-pattern468-navigation.json` follows local identifier definitions/import usage recursively to navigate 1,149 currently existing file paths drawn from the earlier394 filename inventory. It parsed 11,424 current declaration sites and emitted243 signals. This is navigation, not semantic credit or a guaranteed fresh whole-tree filename census; hooks/global effects, dynamic loading, alias shadowing and browser-mediated owner execution need human review. No broad all-suite conclusion follows from the graph.

Only three callbacks appeared assertion-free after excluding hooks/describes: two actual SQL acceptance probes and the supported QA response-capture command. Both SQL probes meaningfully observe execution/no-throw; the manual QA callback has operator capture value. They were previously reviewed and receive no new deletion recommendation or duplicate complete-read credit.

Tracker complete bodies and fixtures: agent-context8, agent-loader3, aggregation15, api22, migration-security6, nudges8, presentation4, rhythm8, route-wiring1, save-coordinator11, trust-gate7 = **93 AST declarations**. The access-state loop is one declaration, not three. Every callback has a body SHA, file SHA and individual verdict/fault in `test-audit-tracker-pattern-full-ledger.json` and `.md`.

Source full reads: `src/lib/tracking/{api-handlers,aggregation,load-tracker-days,nudges,presentation,rhythm,save-coordinator,trust-gate,types}.ts`, `src/lib/agent/tools/{tracking-context,tracking-insights}.ts`, `src/components/tracker/{use-tracker-autosave.ts,tracker-widgets.tsx}`, all three tracker API route modules, tracker page, frequency vocabulary, and five tracker migrations (20260708150000, 20260713120000, 20260713143000, 20260713150000, 20260714120000). Selected caller excerpts/rg references, not full reads: tracker-page-client, log-day-card, layout/header, AgentV2 production chat pipeline and responses-agent, CI/workflow, package scripts and docs/plans. Relevant browser callback `live write boundary rejects direct and forged payloads and reloads the backfill date` was read fully, alongside top-level configuration and limited helper navigation; the entire browser file and every shared setup callback were NOT completely audited. No complete-file browser read credit.

## Current owner closure and history

`/tracker` renders TrackerPageClient and is linked from the current desktop/mobile header. `docs/local-qa-access.md` lists it as an authenticated app surface; `docs/freemium-flag-flip-runbook.md` names it in admitted routes. No retirement inference.

Current API GET uses the real trust, aggregation and nudge helpers. The real chat pipeline loads tracker days and builds both raw diary and deterministic insights; runtime serialization uses the diary serializer. SaveCoordinator is called by useTrackerAutosave; shelf ordering is used by LogDayCard; rhythm by TrackerPageClient. The wash estimator's only non-test call is inside computeObservedCadences. It remains live after the proposed cuts; no source export removal is warranted because an existing retained mixed test still directly checks filtering with it.

`7f6b1d0f` introduced the Tracker native suites and implementation together. `0d29b871` updated handler/access recovery. Browser history includes later stability/motion updates; age is not deletion evidence. The July10 stability plan's Data and API Contract explicitly requires ownership, revision tombstones, transactional parent/children writes and API error mapping. It explicitly documents Task11 replacement of authenticated signatures with explicit-user service-role-only RPCs. The migration's referenced July7 design file was not found in that historical commit; it is not used as retention or retirement authority.

All 11 native files are included by `npm run test:node`; `.github/workflows/ci.yml` quality-node invokes it. The live tracker browser callback requires all three secrets plus `PLAYWRIGHT_RUN_TRACKER_LIVE=1` and a schema-ready guard; it is not a local native keeper. No production execution was inspected or assumed.

## Exact four-cut union

- **D1 aggregation:102** `observed wash cadence: 4 washes over 2 observed weeks -> 2/week` → retained :110 `shampoo cadence is the measured wash rhythm, not the self-report`. Identical DENSE_WEEKS is passed through actual computeObservedCadences into actual estimator; existing shampoo existence/basis/weeklyCadence2 exposes the estimator result and rejects self-report5 substitution. No lost assertion or new call.
- **D2 aggregation:106** `observed wash cadence: null with fewer than 2 observed weeks` → retained :118 `shampoo emits no cadence when wash rhythm is unobserved (sparse logging)`. Donor June10 single wash and keeper June10/14 two washes both yield zero observed weeks under >=4-log density. The early return executes before wash arithmetic; keeper's self-report2 must not produce shampoo. Zero, undefined or NaN returned instead of null produces a shampoo object and fails the retained undefined assertion. Neither test actually supplies exactly one qualifying observed week; do not claim coverage of that untested threshold scenario. No transfer, input change or packing.
- **C1 aggregation:127** `need-based policy: mask uses observed-week cadence instead of wash share` → retained :304 `custom and unconfirmed days do not affect cadence denominators or category usage`. Keeper starts with identical DENSE_WEEKS/null/CADENCE_POLICIES and adds two custom days plus an unconfirmed wash. Actual eligibility predicates remove these before every relevant calculation. Transfer only `mask.basis === "day_level"` and `mask.anchorSource === null`; existing presence/usageDays2/weeklyCadence1 and estimator2 stay. Stronger keeper independently checks filtration.
- **C2 nudges:108** `observed clearly above band -> decrease nudge` → retained :118 `dismissed direction stays hidden; other direction still fires`. Exact cadence(mask,5)/MASK_TARGET; keeper only adds `mask:increase` to dismissed keys, irrelevant to actual `mask:decrease` membership. Capture the already-existing second call result, preserve length1, add direction `decrease`. First suppressed-increase call remains unchanged. No new inputs/calls/cases.

No production, helper, import or fixture deletion is unlocked. Proposed edits touch only aggregation/nudges tests. All unrelated callbacks are byte-identical, and fixtures/inputs remain unchanged. The controls target actual owners, not rewritten mocks.

## False-proof findings retained for repair (zero quota)

1. **api:430 valid upsert** observes genuine RPC dispatch/user projection and HTTP success, but the fake returns snake_case `p_products` in `day.products`; actual latest SQL returns `productName`/`userProductUsageId`. Its response assertion certifies a fixture protocol that disagrees with the real owner. Repair by asserting actual request args independently and giving the transport fake an independently literal, real-protocol response. Do not claim this tests transactional replacement.
2. **api:510 foreign owner / :537 category mismatch**: the fake searches its own `state.tables.user_product_usage` and itself returns `foreign_product`. Production only serializes the request and maps the RPC result. Both tests genuinely observe mapping400, but neither detects removing the actual SQL ownership/category predicate. The category scenario is not deleted just because mapping is duplicated: the unique security scenario needs real-owner repair. A SQL mutation removing `u.user_id = v_user_id` or `u.category = p.category` in the final entitlement migration would leave both current native callbacks green.
3. **api:608 revision/tombstone/LWW**: the fake implements all asserted persistence ordering. Production only dispatches PUT/DELETE RPCs and passes results through. This callback retains genuine delete dispatch coverage and cannot be removed wholesale on the basis of fake persistence. A SQL stale-revision guard removal would stay invisible to it.
4. **route-wiring:11**: the resolver wiring is meaningful purchase recovery behavior, but local alias/destructure refactoring breaks exact private-name regexes. Retain until actual route delivery proves the canonical resolver receives the authenticated user/client; then remove the private syntax dependence. No prepared cut.

Related browser limitation: the fully read live write callback calls the old authenticated signatures without p_user_id and expects successful invalid_products/deleted/stale results. Final migration20260714120000 explicitly drops those signatures and revokes authenticated execution, leaving service-role signatures only. Thus that callback is **not** a stronger valid current SQL keeper. It should assert authenticated denial and exercise accepted service operations through the correct boundary. This is a separate F finding outside the93 native denominator; shared browser setup and whole suite remain unreviewed.

A real local SQL repair is NOT ready to execute from these fixtures verbatim: `user-1` is not a UUID, and fixed July7 dates will fail today's database backfill guard. It needs deliberate minimal schema/valid identity and database-clock fixtures while preserving the semantic scenarios. No new SQL runner/fixture was prepared, no live DB operation is authorized by this handback, and no claim of executed SQL safety is made. Historical migration grep tests remain useful artifact guards but cannot substitute for final-owner behavior proof.

## Guarded artifacts and checks

- `test-audit-tracker-pattern-edit.cjs`: main-only check/before/transfer/cut editor.
- `test-audit-tracker-pattern-edit-plan.json`: complete phase paths,7 source/dependency hashes and all11 test hashes.
- Plan SHA256: `b49e9275b63d0de6990fc01f08970bd6d9d0965b87a5f2b1fc5da258b8559f43`.
- Staged originals/proposals: `/tmp/test-audit-tracker-pattern-staging-9aUaQJ/{before,transfer,cut}/tests/`.
- `test-audit-tracker-pattern-complete.diff`: complete transfer and cut diff.
- `test-audit-tracker-pattern-candidates.json`: exact donors/keepers, bodies/hashes and candidate evidence.
- `test-audit-tracker-pattern-controls.json`: five unique valid-TS actual-source mutations with intended retained assertions and restoration instructions.
- `test-audit-tracker-pattern-full-ledger.{md,json}`: every native declaration and specific fault.

Static checks completed: inventory93; every prospective phase parsed; counts93→93→89; all unrelated callbacks hash-identical; five mutant source strings parse and have exactly one current anchor; read-only editor check passes with current7source/11test guards. No native run, type compilation or actual source fault executed. Source and test bytes were not written.

Parent-only focused native command before/after transfer/cut:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/tracker-*.test.ts
```

Run from exact task checkout. Phase commands: `node /tmp/test-audit-tracker-pattern-edit.cjs check`, then `before` (read-only), `transfer` after permitted baseline, actual-source controls serialized with byte restoration, then `cut`. Editor verifies every prospective TS file/declaration set and rechecks all guards before first write; writes changed files with per-file atomic rename and saves originals/receipt. Parent retains whole-campaign coverage/CI gates. Frozen468 work is untouched.
