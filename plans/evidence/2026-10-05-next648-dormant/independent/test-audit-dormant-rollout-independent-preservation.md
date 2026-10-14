# Independent dormant rollout preservation review

**Conditional PASS for the exact six D sites and atomic source retirement. No concrete live-contract or assertion-preservation blocker found.** This is an independent static/semantic review, not implementation acceptance or runtime proof. Main retains integration, product and verification decisions. No repository file was changed and no product/test module, test runner, compiler, browser, provider or database was executed.

Reviewed frozen packet: `/tmp/test-audit-dormant-rollout-closure/`; manifest SHA `02516c9596630d774f74679bf46ee68270740b7df26ec658184c9bd3ae4cc8ef`, handoff SHA `27022c8ca786c797b324faaa62f961491bc36b469147051b2d282d1a64f61fc1`. Current repository bytes still matched all 56 proposal readset entries at independent static verification. These are historical proposal pins, not a fresh whole-branch freeze or a statement about main's in-progress full-suite result.

## Reachability and chosen direction

The old internal gate is unreachable through current production composition. Before-cut `release.ts:12–17` ignores every environment value and returns literal `all`; the journey factory binds that resolver at `journey-access-loader.ts:472`. Its prefix invokes `loadIsInternal` only for `internal` at205–211. Both exported user wrappers596–614 create that factory. The direct `WithDeps` entrypoints have no outside production override caller in the inspected repository closure. Current route, auth, navigation and Stage2 composition roots bind the wrappers, not an internal-cohort dependency override.

`isPersonalPlanInternalUser` has only the unreachable factory caller. Its profile-admin check, active field-test helper and confirmed-email allowlist therefore form one removable closure. The active field-test helper is **not** the enrollment owner: live `enrollment.ts:148–185,401–450` independently validates grant ownership/linkage, tester reason, both revocations/expiries, activation timestamp, source/lead identity and quiz provenance. It stays byte-identical. Its shared missing-relation helpers stay too. Removing the old helper does not remove either enrollment table, the enrollment reader, the routing RPC, field-test operator entrypoints or their tests.

Current source/module-reference searches independently corroborate the packet's resolved import inventory: retired symbol/property references are confined to the three owners and seven scoped tests; the module's other consumers import retained exports. The retained `isPersonalPlanAppV1AllowedForUser` still accepts one or two arguments, returns true and performs no reads. Changing its unused second argument type to `unknown` removes the retired query-interface dependency without narrowing callable inputs. `resolvePersonalPlanAppV1Rollout` remains as the literal-all contract; its four original calls stay. No external package export or namespace/dynamic module edge to the retired functions was found. This is repository caller evidence, not a guarantee about arbitrary out-of-tree reflection.

The older Aug9 internal-rollout plan explicitly required an admin/allowlist selector. It cannot be dismissed merely as old prose. The Aug13 production activation plan31–40 and105–120 explicitly supersedes that rollout: released stages/defaults, preserved eligibility/ownership/cutoff and revert-and-redeploy rollback. Commit `05da162ec509999e062da560cbadaa6500d52c2b` (#382) actually replaced environment parsing with the current literal-all resolver and unconditional allowed helper. I read its saved source diff and verified the commit locally. This supports retirement rather than speculative future reconnection. Retained `appEnabled` and stage dependencies are deliberately outside this deletion; the historical instruction to keep test enablement seams does not justify deleting their live guards.

Rejected alternatives: tests-only deletion would leave an unexplained stale implementation; transplanting old helper inputs into enrollment would manufacture a new case and misrepresent owner equivalence; replacing the internal early-reject call with appEnabled=false changes read ordering and is not a preservation transfer. The packet does none of these.

## Exact six dispositions and retained assertion union

| Site | Original contract intentionally retired | Why conditional D is supported |
| --- | --- | --- |
| journey418, internal exclusion | `legacy` and entitlementReads=0 under injected internal/false | Selector/dependency and its exclusion result are removed atomically; default all cannot enter it. |
| journey436, internal admission | personal_plan under injected internal/true | Same unsupported production selector; ordinary owner journey callbacks remain. |
| rollout77, active personal tester | old helper returns true | Only caller belonged to the internal-selector closure. Live enrollment owner is independently retained. |
| rollout127, active regular tester | true and exact personal→regular helper query order | The whole obsolete query implementation retires; no claim that the distinct live reader reproduces this helper call order. |
| rollout184, missing relation | old helper false for 42P01 | Only the obsolete helper policy retires; shared relation classifier and live enrollment fallback/error behavior remain. |
| rollout216, unrelated error | old helper rejects XX000 | No remaining caller executes that helper. No live DB error clause is removed. |

Independent AST reconstruction: **103 before /103 identical transfer /97 cut**, seven test files; six whole declarations removed, no additions. There are **92 byte-identical retained callbacks and five narrowly changed callbacks**. The seven file counts are23→21,9→9,45→45,12→12,5→5,4→4,5→1 in manifest order. The proposal changes three source owners and six test files; the middleware test file is an unchanged whole-file guard.

The five modified survivors are bounded:

- Mixed narrow Stage2 callback: only its first internal-exclusion call and two obsolete assertions disappear. Its pre-existing owner-1 invocation and all six live assertions survive unchanged: allowed=true, refined/draft/Stage3/Stage4 counters=0, timing=[]; only title changes. This is not removal of Stage2 authorization coverage.
- Owner/aggregate-scoped Supabase callback: only two unused constant `appRollout` fields disappear. Both existing actual loader invocations, rows, query predicates, no-profile receipt and all eight assertions stay.
- Released-default callback: four original resolver calls/expected `all` remain (empty, old enabled, internal and invalid settings). The allowlist normalization assertion and three obsolete predicate assertions retire with their owners.
- Active/expired trial callback: only constant appRollout/loadIsInternal fields disappear; both existing inputs/calls and all four assertions remain.
- Field-test Stage1/journey callback: only the same dead fields disappear; both existing calls and assertions remain.

The freemium shared fixture loses the same two dead fields outside callbacks. All12 callbacks are exact; those functions cease to exist in the production dependency interface too. No accepted path gets a replacement user/source/row/call. In total14 assertion call sites intentionally disappear: eight inside the six retired callbacks and six retired clauses inside two retained callbacks. No live assertion is transferred, weakened or added. The packet is D retirement, not C assertion-equivalence credit.

## Live behavior preserved

For the default factory, `appRollout()` was pure/literal-all and the internal exclusion discriminant always false. Removing that call and impossible branch leaves the existing sequence: required user validation, appEnabled evaluation, entitlement/timing, qualified-owner/cutoff/migration decision, then prepared artifact and concurrent plan reads. appEnabled=false does **not** gain an invented early no-read short-circuit; Stage2's final appEnabled conjunction and the full reducer's disabled response stay. Normal paid vs trial migration treatment, field-test/partner/freemium exceptions and missing source failures remain.

I checked the unchanged full journey reducer: paid_pending recovery, Stage2/3 authority gating, accepted immutable Routine fallback despite later invalid refined authority, pending proposal dependency and Stage5 reachability remain. The loader's source/version/authority comparisons, owner filters, stale draft exclusion, concurrent reads, thrown-read handling and timing phases are unchanged. The retained incomplete-facts callback still exercises app-disabled, paid_pending/none/revoked, pre-cutoff, Stage2-disabled, missing artifact/initial pointer and throwing authoritative read.

The retained middleware suite still has45 original declarations including the actual default-frontier composition under obsolete environment values. Its fake routing RPC facts are injected; it is not SQL integration. The auth-header `every()` assertion can be vacuous if no HTTP fetch occurs, and is left as-is. The explicit no-admin/profile lookup assertions and released helper's monotonic call-list assertion remain. No F is repaired or credited here.

The inspected SQL routing body in `20260915202841_personal_plan_trial_source.sql:76–360` still scopes auth.uid, owner/lead/grant joins, expiry/revocation, paid/field-test/migration/trial precedence and authenticated/public wrapper grants. This SQL is unchanged and was not executed. The historical migration lineage and deployed database are not certified by this review.

## Fourteen prospective controls

Independent static check verified each complete source/mutant SHA, unique replacement anchor, TS parse, exact-one named keeper in its selected file, and complete expected assertion text/line in both transfer and cut phases (28 phase specifications, **zero executions**).

- P1/P2: actual retained allowed helper false result / actual client.from lookup. First failures should respectively be true expectation and empty calls list; P2's fixture logs before returning a usable builder, so no trap hides the attempted read.
- P3: actual resolver internal result, caught by first literal-all assertion.
- P4: actual Stage2 appEnabled conjunction bypass, caught by first app-disabled object assertion.
- P5: actual narrow prefix receives reporter, producing entitlement/artifact timings. Existing positive/no-read assertions remain true; empty timings is the intended first failure.
- P6: actual ordinary cutoff arm allows pre-cutoff owner. Earlier disabled/access-state rows remain denied; the existing pre-cutoff assertion is first affected.
- P7/P8: actual live enrollment revoked-grant/expiry clauses omitted. The existing third/first rows respectively yield field_test at the first sourceKind=null assertion. Fixture filtering does not pre-eliminate these rows.
- P9: actual field-test source discriminator becomes trial, caught by the existing complete active enrollment object (activation/null paidAt/source/lead/quiz-kind fields remain asserted).
- P10: actual journey field-test cohort exception becomes trial. The existing pre-cutoff field-test input becomes legacy; the earlier Stage1 assertion remains unchanged and passing. This scoped probe does not prove the broader substituted trial branch is desirable.
- P11–P14: each inserts one real narrow-owner dependency invocation, catches the fixture's deliberate throw, then returns the original successful access. The fixture increments refined/draft/stage flag counters **before** throwing; the existing independent zero-count assertion should fail1!=0. Prefix.plan is valid for the existing owner-1 call. The earlier internal-excluded transfer call returns before the insertion. These are credible assertion-sensitivity probes, deliberately designed to bypass the trap's earlier generic error; they are not representative production exception handling, real database work or proof of uncaught-error diagnostics. A swallowed TypeError before invocation would leave count0 and make the control survive, which main must reject.

Main still needs native clean→intended ERR_ASSERTION/operator/decoded message/FIRST keeper frame→owned byte-exact restore→clean receipts. Each should select1 with zero skipped/cancelled/todo. Import/setup/SQL/runtime timeout failures do not count. These controls preserve the existing source-security behavior; they are not proof that all possible access faults are detected. Compiler/type/lint/full native/coverage gates remain main-owned after atomic integration.

## Read depth and verification limits

Fully human-read: all seven original test files,3488 lines including helpers, callbacks and loop rows; all three edited original source owners; every proposed diff hunk and changed survivor; full retained release/rollout cut owners. Full additional readers: enrollment, frontier-routing-loader, journey-access, legacy-cutover-eligibility, Stage1 service, stage5-access, transition-performance, field-test errors, admin client, server-only shim and both workspace package manifests. The cut journey source was checked against its fully read original through the complete diff and static whole-file reconstruction; byte-identical text was not treated as a second independent semantic read. All30 snapshots were hashed and parsed.

Supporting slices only: auth/middleware/default wrapper bindings and frontier invocation, navigation cache, plan-start/readiness/welcome/confirm callers; migration-admission gate/RPC adapter; routing SQL60–360; activation and older internal-rollout plan sections; CI130–170 and root package scripts1–65. Other route modules were inspected at named import/composition edges, not fully audited. The author's broader read-scope claims are not inherited as this reviewer's own full reads. SDK behavior is not re-executed or broadly re-audited; unchanged fake query receipts cannot prove RLS or remote SDK delivery.

Mechanically verified: all frozen handoff artifact hashes,30 phase files,56 readset hashes,103 registration mappings,92 exact survivors/five modifications/six removals and14×2 source fault specifications. No drift/mismatch was observed. `node /tmp/test-audit-dormant-rollout-independent-static.cjs` is a text/AST check only; it writes solely its `/tmp` JSON receipt, imports TypeScript as a parser and never imports application/test modules or spawns children.

Only `/tmp/test-audit-dormant-rollout-independent-*` files were written. Report outcome remains conditional on this exact atomic source/test patch and main's actual proof. No deployed/configuration claims, coverage improvement, fresh full-suite pass or six applied-cut credit are made.
