# Offer87 C1–C4 independent preservation preflight

**Verdict: PASS for all four conditional consolidations.** No assertion-union, operative-input, owner-delivery, or fixture-side-effect gap found. This is a static preservation verdict; all four actual-owner control executions and the native transfer/after run remain main-owned gates. No deletion credit is claimed here.

Frozen proposal: `/tmp/test-audit-offer-experiments87/manifest.json` SHA256 `2536b4d22c8694f616729ff29ca98948cd2a85f2eca708a1eb872bdadd62d071`; `handoff.json` SHA256 `3c6298451c9f493accd36b5c3a63cb480944a72360e9c0d06d384badb0edda30`. Both verified. Current seven test files and all 52 manifest guards match.

## Exact preservation decisions

| Candidate | Decision and complete donor union |
| --- | --- |
| C1 | **PASS.** Both fresh clients execute consume(user-1, product-a), then actual hasUsedFreeReveal(user-1). Keeper's first assertion already requires true. Donor's intermediate result variable is a primitive binding, not an additional owner input or operation. Later user-2 false lookup adds security strength and cannot retroactively change that earlier observed result. No transfer clauses needed. |
| C2 | **PASS with proposed transfer.** Both start from an empty Map and execute the same first insert. Keeper already requires first result `consumed`. The donor's exact `{user_id:'user-1', product_id:'product-a'}` row assertion is transferred immediately after the first consume, before the existing second consume. This preserves the donor's temporal state observation rather than relying only on the keeper's later row. First result is an immutable primitive; its assertion remains after the existing second operation without weakening the successful first-result contract. Original second `already_used` and unchanged final row assertions remain. |
| C3 | **PASS with proposed transfer.** Both existing callbacks perform exactly two consumes in the same order, user-1/product-a then user-1/product-b, using one fresh identical fixture. Retaining the fixture object as `fake` exposes the original getters; it does not construct another client or change stored rows. Original `insertCalls===2` and `selectCalls===0` are copied after the second operation. Counters increment in actual invoked fake `insert`/`maybeSingle` methods and cannot be supplied by expected-result constants. |
| C4 | **PASS.** Both fresh clients perform consume(user-1, product-a), then actual loadFreeRevealRecord(user-1). Keeper already deep-compares `{productId:'product-a'}` before its additional user-2 null lookup. Exact projection, ownership predicate, table/column validation and inserted row inputs agree. No transfer clauses needed. |

C2 and C3 are complementary assertions on the same existing two-operation callback; the proposed union adds no fixture invocation, owner call, input, table row or loop. C1/C4 preserve existing successful prefixes of cross-user keepers, not merely equal final statuses on different inputs.

## Actual implementation and live consumers

Read `tests/free-reveal.test.ts` completely, including all 13 callbacks and the full fixture. The fake asserts table `scan_free_reveals`, selection `user_id` or `product_id`, and filter column `user_id`. It uses the passed value for Map lookup, increments actual insert/select counters, stores the passed insert object, and returns duplicate code23505 without overwriting an existing row. Reading the Map or counter getter has no side effects. It does not manufacture hasUsed/load/consume outcomes; those functions execute the production implementation.

Read `src/lib/entitlements/free-reveal.ts` completely: hasUsed at22–31 returns actual nonnull-row presence; load at42–56 maps the selected `product_id`; consume at63–75 inserts passed identities, then differentiates no-error, unique violation and unexpected error. Private unique-violation helper at78–83 remains intact. The only runtime import is `server-only`; Supabase is type-only. Preload replacement of that marker does not replace the tested owner.

Read the full actual reveal route and entitlement owner, plus resolve route475–535 and its symbol bindings. Reveal production POST binds real consume/load at219–220. Its handler spends credit only after auth/flag/product/profile/access/verdict/eligibility processing; the already-used branch reads the stored product and separates same-product re-serve from409 conflict at183–193. Resolve passes actual hasUsed into getEntitlements at513 and binds the owner at611. Thus these are reachable current owners, not uncalled export cleanup.

Read migration20260905090000 completely: user_id PK, nonnull product_id, select-own RLS, service-role-only writes. This fixture proves adapter arguments, projection, conflict-response interpretation and absence of pre-read. It does **not** prove actual PostgreSQL concurrency, deployed RLS or service credentials. The fixture comment's atomicity claim is broader than its execution; it is unchanged and not relied on for accepting the cuts. No SQL/storage/security tests or source are removed.

Local history confirms f3790784 (#526) introduced this current free-credit/keepsake owner. Current source caller search found resolve/reveal production bindings; no reachability inference rests on navigation visibility. Package `test:node` includes the six native files; the unchanged19-case motion Playwright file stays on its existing separate lane. Parent reports the six-native-file baseline68PASS; this reviewer did not rerun it.

## Independent static reconstruction and fault review

`/tmp/test-audit-offer87-independent-check.cjs` independently parsed all21 prospective file snapshots, reconstructed the complete transfer from exactly one keeper replacement, then reconstructed the complete cut by removing precisely four donor expressions. All outside-target bytes agree, including unchanged support code and intentionally retained whitespace. Counts: **87→87→83**, free-reveal13→13→9, **82 retained callbacks byte-identical**, one modified keeper, six entire files unchanged, all19 PW declarations unchanged, all3 held F clauses/callbacks unchanged. Operative fixture/owner call lists are identical before/after for each keeper. No new declarations or callbacks were introduced.

All four proposed source faults are within unique complete function scopes and parse as TS. Exact phase assertions were independently found as AST calls, including the full multiline C4 deepEqual rather than only its textual prefix:

- C1 changes hasUsed's successful returned boolean to false. Intended first own-user true assertion: transfer102/cut95, strictEqual false→true.
- C2 corrupts actual inserted product-a to wrong-product. Intended **pre-second-call** full row equality: transfer126/cut109, deepStrictEqual exact product field mismatch. This cannot be mistaken for final-row or setup failure.
- C3 adds an actual awaited ledger read before each insert. Table/column checks accept the valid query, normal outputs/rows remain unchanged, insertCalls stays2, actual selectCalls becomes2. Intended zero-read assertion: transfer139/cut122, strictEqual2→0.
- C4 corrupts actual returned record productId. Intended first own-user record equality: transfer207/cut175, deepStrictEqual wrong-product→product-a.

These are representative faults, not exhaustive tests of every field or security branch. Each runtime proof must select exactly one named existing keeper and require clean1→unique intended ERR_ASSERTION/operator/message/first keeper frame→byte-exact source restore→clean1. No import/setup error or timeout can substitute for intended failure. The proposed controls were only statically reviewed/parsed, not executed.

## Read limits and unchanged concerns

This is a preservation review of four cuts, not a second complete87-site semantic audit. Full semantic reads: all13 free-reveal callbacks/fixture, whole free-reveal owner, whole reveal route, whole entitlement owner and migration; resolve caller is the explicit bounded slice plus binding/search. All seven complete snapshot bytes were parsed and compared; other six suites were not re-audited line by line. Broader pricing/experiment/Meta/transition/PW rationale remains the proposal author's scope. Three F findings are retained unchanged, zero credit. No repository writes, owner imports, runtime/native/PW/type/build/DB/provider calls, environment-file reads or counterpart dispatch occurred. Existing main-owned product choices remain unchanged.
