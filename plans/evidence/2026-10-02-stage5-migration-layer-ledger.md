# Stage 5 migration/static-layer audit — pinned `21e0e41f`

## Owned scope, count, and read boundary

Complete read-only group: `tests/personal-plan-stage5-migration.test.ts` (4 AST declarations), `personal-plan-stage5-v2-generation-migration.test.ts` (1), `personal-plan-stage5-v2-authority-reconciliation-migration.test.ts` (4), `personal-plan-stage5-v2-pointer-delta-postgres.test.ts` (15), and `personal-plan-application-use-case-variants-migration.test.ts` (3): **27/27**. The count is from `/tmp/test-audit-reachability181.json` `testCounts`; complete bodies, fixtures, referenced SQL, direct callers, package CI selector, and file history were read. Excluded: already-retired full-apply branch and the already-audited pointer/wrapper exports.

No runners, database execution, mutation, environment/provider operation, or repository edit was performed. The PGlite tests named below are existing code evidence, not a fresh execution claim.

Disposition: **R=27, F=0, C=0, D=0.** There is no source/support cleanup unlocked. “Keeper” is the actual owner whose distinct observation would be lost.

## Reachability, lineage, and why a shared SQL filename is insufficient

* Stage 5 migration SQL is still part of clean-install lineage. The V1 foundation creates the canonical tables, immutable trigger, RLS, and role grants in `20260808062747_personal_plan_application_guidance.sql:5-140`; V2 adds contract/pointer constraints in `20260812182731...:1-16`. `tests/oil-day-type-rulings-migration-postgres.test.ts:43-55` executes both before its O4 migration. That PGlite keeper confirms the later migration can execute on that schema, but it neither checks all eight V1 seed rows nor privilege/revoke/search-path/immutability behavior. It is therefore not a complete transfer for the four foundation source tests.
* The current operator writer is the narrow pointer-delta RPC, not the retired full-registry executor. `20260914170000_personal_plan_stage5_v2_pointer_delta_executor.sql:28-287` is `SECURITY DEFINER`, fixed `search_path`, locks products/protocols, and books a ledger. Its 15 PGlite declarations execute the real migration and RPC (`...pointer-delta-postgres.test.ts:121-141,225-636`). Those behavioural tests are retained; the terminal declaration explicitly asserts that the older full-registry executor is not invoked, rather than retiring its installed migration (`:627-636`).
* The 14-Aug authority-reconciliation and use-case migrations remain forward migrations with exact-cohort/fingerprint and transaction requirements. No existing PGlite suite applies `20260814191843` or `20260814120000/121000` and then verifies their exact old/new cohort, trigger restoration, or product-key-repair content. Similar schema fixtures and later PGlite writers are not an exact keeper.
* CI: `package.json:52` includes all `tests/personal-plan-stage5-*.test.ts` in `test:personal-plan-stage5`. File history anchors are `12619247` (foundation, 2026-08-10), `6d1e30fc` (V2 storage, 2026-08-12), `53c15176` (use-case variants, 2026-08-14), `f7d614b8`/`7aa3c6b5` (authority reconciliation), and `92f00b8c` (current delta/retired full apply, 2026-09-14).

## Exact declaration ledger

| Declaration | Mark | Actual detectable failure and named keeper | Transfer/deletion result |
| --- | --- | --- | --- |
| `personal-plan-stage5-migration.test.ts:17` foundation defines versioned canonical tables | R | Detects table/key/scope/FK topology change or accidental user/personal-plan application table. Keeper: V1 clean-install migration `20260808062747:5-57`. | Oil PGlite only bootstraps schema; no complete topology assertion. None. |
| `:31` eight active German V1 day types | R | Detects missing/renamed seeded day type. Keeper: V1 migration seed `:93-128` and runtime day-definition reader. | PGlite later seeds only oil templates; no eight-day keeper. None. |
| `:49` V1 guidance seeds parse runtime contract | R | Detects stored migration JSON ceasing to satisfy `applicationGuidanceProtocolSchema`. Keeper: migration payloads plus `src/lib/routines/personal-plan/application/contracts`. | No existing database test parses every V1 seed with runtime schema. None. |
| `:61` server-read-only/active immutable | R | Detects RLS, revoke/grant, immutable trigger, verified-at or trigger-function permission regression. Keeper: migration `:60-90,130-140`. | Later PGlite application does not exercise all privilege/search-path/active-to-retired behavior. None. |
| `personal-plan-stage5-v2-generation-migration.test.ts:10` V2 expands without changing V1 generation | R | Detects missing contract-version/pointer constraints or an accidental V1/V2 update in additive migration. Keeper: `20260812182731:1-16`. | Oil PGlite executes file but does not assert check rejection or no-update semantics. None. |
| `personal-plan-stage5-v2-authority-reconciliation-migration.test.ts:131` nine V1 payloads produce reviewed fingerprints | R | Detects a source/artifact/precondition/migration fingerprint mismatch for each exact product-role. Keeper: `20260814191843` forward repair and checked-in cohort inputs. | No PGlite test executes this reconciliation or all nine rows. None. |
| `:190` two family transitions derive captured copy | R | Detects incorrect old/new family template fingerprint or German-copy transfer. Keeper: same reconciliation migration and precondition evidence. | No exact family transition execution keeper found. None. |
| `:214` exact-cohort guards and every transition | R | Detects missing transaction, cardinality/fingerprint guards, trigger restore, snapshot identity checks, or forbidden unrelated writes. Keeper: reconciliation SQL `:5-324`. | A different PGlite executor cannot prove this one-off migration’s release guards. None. |
| `:246` product-key repair parentheses | R | Detects operator-precedence repair disappearing from `20260814193326:3-38`, yielding malformed key formation. Keeper: exact forward repair. | Current delta test runs later RPC, not this historical repair against its target definition. None. |
| `personal-plan-application-use-case-variants-migration.test.ts:10` multi-family persistence | R | Detects loss of generated family identity/index expansion used to store multiple families per product-role. Keeper: `20260814120000` schema migration. | Pointer PGlite stubs a matching shape; it does not apply or validate this migration. None. |
| `:22` 18-pointer reviewed cohort | R | Detects lost exact-cohort/pristine guard, incomplete delta, Money Mist inclusion, or pointer identity failure in `20260814121000`. Keeper: coverage forward migration. | No actual DB suite applies this exact 18-row migration. None. |
| `:40` Product Intake upsert exact family | R | Detects conflict key/NULL mismatch or old unparenthesized product-key expression in use-case migration. Keeper: `20260814120000` and historical full-executor compatibility chain. | Current delta writer uses a different RPC/one-item shape. None. |
| `personal-plan-stage5-v2-pointer-delta-postgres.test.ts:225` writes pointer + ledger | R | Detects real RPC failure to write reviewed pointer/ledger/attribution. Keeper: current migration/RPC executed by PGlite. | None. |
| `:253` SQL fingerprint matches artifact | R | Detects SQL canonical JSON/hash diverging from reviewed source fingerprint. Keeper: canonical helper plus current RPC. | None. |
| `:278` per-item replay no second write | R | Detects non-idempotent replay, timestamp rewrite, or duplicate ledger. Keeper: current RPC. | None. |
| `:300` already-current pointer books ledger | R | Detects recovery/replay bookkeeping loss when state is already current. Keeper: current RPC. | None. |
| `:311` conflicting pointer is never overwritten | R | Detects authority conflict becoming destructive overwrite. Keeper: current RPC lock/check path. | None. |
| `:328` reviewer/fingerprint refusal | R | Detects approval/fingerprint/tamper/JSON admission. Keeper: current `SECURITY DEFINER` RPC. | None. |
| `:359` invalid header/count/size/duplicate role | R | Detects malformed batch schema acceptance. Keeper: current RPC. | None. |
| `:428` pointer contradicts item | R | Detects scope/role/schema/family/source-fingerprint mismatch reaching a write. Keeper: current RPC. | None. |
| `:470` missing/inactive/recategorized/non-curated product | R | Detects lifecycle/category/origin gate bypass. Keeper: RPC product lookup `FOR UPDATE`. | None. |
| `:498` missing/NULL/wrong-family V1 source | R | Detects non-authoritative source treated as eligible. Keeper: current RPC source query. | None. |
| `:528` source payload drift | R | Detects reviewed fingerprint drift accepted for write. Keeper: current RPC. | None. |
| `:541` foreign ledger row blocks replay | R | Detects retry conflict rewriting an item booked by a different batch/reviewer. Keeper: current RPC ledger gate. | None. |
| `:574` NULL approval arguments | R | Detects SQL three-valued-logic bypass of reviewer/fingerprint/payload guards. Keeper: current RPC. | None. |
| `:604` deactivation before write + `FOR UPDATE` pin | R | Detects lifecycle race posture weakening. Keeper: current RPC source plus pre-call refusal; PGlite limitation is explicitly documented at :604-624. | No two-session proof claimed. None. |
| `:627` retired full registry stays untouched | R | Detects current delta migration calling/altering retired full executor or failure to install delta RPC. Keeper: migration compatibility/retirement boundary. | It is a distinct migration-lineage assertion, not a dead-executor feature test. None. |

## Result and limits

No concrete layer retirement is grounded. The static tests are not treated as disposable merely because some migrations are historical: they cover clean-install SQL, exact migration-repair lineage, and permissions/rollback-adjacent guards that the real PGlite executor suite does not fully execute. Conversely, the existing PGlite suite is retained as the actual current writer owner and does not prove a complete replacement for the source-inspection declarations. No fresh DB/CI run or live migration state was asserted.

