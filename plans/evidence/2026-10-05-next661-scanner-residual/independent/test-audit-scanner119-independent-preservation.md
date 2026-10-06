# Independent scanner residual119 preservation review

Verdict: **CONDITIONAL PASS for the exact 14 proposed registrations (12 C, 2 D). No blocking assertion-union or current consumed-input gap found.** This is semantic/static acceptance, not permission to skip main-owned baseline, transfer, actual faults, restoration, cut, or final coverage proof. No removal credit is claimed here.

Reviewed packet: `/tmp/test-audit-scanner-residual119`. Manifest SHA256 `8f982b06fbe8e5481e90c5723c02ab18ebe9d26e46b4e5975f5937e849151048`; handoff SHA256 `ee488f815db07525e045e3a8be7ac3a6747fad660934ad5cc7ff722dc2e588ff`. Worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`.

## Exact preservation result

Independently parsed/reconstructed all 63 full snapshots across 21 files: **119 before →119 transfer →105 cut**. All 14 original donor registrations remain during transfer. Seven existing keepers carry the union; five change and two are byte-identical. Of 105 survivors, **100 are byte-identical** (98 unrelated +2 unchanged keepers); five retain every original assertion and gain only reviewed observations. Both held F callbacks remain exact. Fourteen whole test files are unchanged; transfer changes five files, cut changes seven. Support cleanup is solely the unused `ScanComparisonRow` type import. No production owner, migration, fixture, helper, table row, input, test skip, or source export is removed.

All existing operative keeper calls are byte-identical and in the same order: masking/payload calls, route factory/dependencies/request/handler, fixture/RPC adapter call, pending query, session storage owner calls, and SQL database/query calls. Added recursive key traversal, label projection, and storage `getItem` are observations of those existing results. They are not additional input cases. Exact whole-file reconstruction also preserves all top-level fixtures/helpers/tables and unrelated assertions.

`test-audit-scanner119-independent-static.cjs` performs only file reads, TypeScript AST parsing, SHA calculation and literal AssertionError formatting. Its receipt passes **1,194 checks**, including all 76 original readsets, every sealed artifact/phase hash, ledger callback identity, full transfer/cut reconstruction, 98 unrelated callbacks, both F sites, original keeper assertions, owner calls, all 18 unique source/whole-mutant anchors, and both phase oracle locations. The installed parser is imported; no application owner, test, PGlite engine, provider, or subprocess is imported/executed. The checker writes no files; shell redirection creates its receipt under `/tmp`.

## Candidate-by-candidate decision

| Candidate | Full original assertion and operative input analysis | Existing keeper and decision |
|---|---|---|
| C1 | Lower helper `[]` must yield whole `{rows:[],summaryScore:0}`. `maskAlternative` passes `alternative.criteria ?? []` to the real helper; undefined criteria therefore produces exactly that operative array. No identity fields are read by this helper. | Existing `maskAlternative: an alternative with no carried criteria yields an empty comparison` already asserts the whole comparison. PASS, no transfer. |
| C2 | Single pass criterion asserts row id, German generic label, match state and score1. Donor `conditioner.care_direction/Pflegerichtung` differs from keeper `shampoo.scalp_route/Kopfhaut-Fokus`. These are unconditional copied strings, not category selector inputs: `alternative-comparison.ts:36–64` maps id/label directly and switches only on result. Source comments explicitly define generic verbatim copying; no independent fixed conditioner copy policy is present. | Existing payload keeper already constructs that default alternative. New fixed whole comparison literal preserves copying, shape, pass mapping and score. PASS on current consumed predicates; do not describe raw strings as identical. The retained multirow order/verbatim test independently preserves arbitrary ids/labels. |
| C3 | Donor exact enumerable row-key set is label/rowId/state. | Same payload keeper gains direct deep equality on its plain comparison object before any JSON serialization. Extra own enumerable properties, including undefined-valued extras, fail. PASS; no undefined-key loss through HTTP serialization. |
| C4 | Default alternative identity/image/price/net-content exclusion is asserted by exact top-level keys. | Existing payload keeper contains the identical default alternative and checks exact keys for every result. PASS, no additional assertion needed. |
| C5 | Donor overrides verdict to supportive and German label to `Passt eingeschränkt`. Other input identity/criteria values are irrelevant to these two direct copies in `masked-alternative.ts:27–33`. | Existing authenticated productId route fixture already has supportive alternative B. Two exact literal assertions on its existing body preserve both values through actual presentation/masking/JSON. PASS. Core verdict construction/catalog reads are injected; no engine-fit/default-provider proof is claimed. |
| C6 | Default alternative criteria require exact shampoo row and score1. | Identical default alternative already exists as payload first entry. C2's whole-comparison assertion preserves the entire donor union. PASS, one shared assertion union; no redundant new assertion copies. |
| C7 | Same flag, request productId, route factory/dependencies and adversarial fixture as primary keeper. Donor asserts alternatives2, every recursive forbidden key absent and exact recursive allowed-key set. | Entire observation union moves onto primary keeper's already parsed native response bytes. `response.text()` plus `JSON.parse` and `response.json()` read the same serialized output; NextResponse delegates to native `Response.json`. Original adversarial strings and positive scanned identity remain. PASS. |
| C8 | Identical route input/dependencies; exact sorted generic criterion labels, excluding product naming through literal expected set. | Entire label extraction/sorted literal assertion moves onto same existing response. No new positional contract and no extra request. PASS. |
| C9 | First call with fresh memory storage and timestamp1000 returns1 and persists a truthy session record. | Existing three-visit keeper already makes exactly that first call. Transfer asserts return1 plus marker immediately before second call. Explicit diagnostic added to the new `assert.ok`; condition is unchanged. PASS. |
| C10 | Same storage seed and first call; second timestamp1000+31min returns2. | Existing second call in three-visit keeper is identical. Its return is now asserted before third call, preserving intermediate-output risk not established by final3 alone. PASS. |
| C11 | Both fixtures have no refined row; donor leaves stale refined pointer, keeper clears it. `eligiblePaid` returns true before reading need when no edit, and `validNeed` returns null on `!need` before pointer access (`scanner-context.ts:285–301,343–387`). Initial source/current profile/source revision/publication inputs are identical; no pointer branch is reached. Donor asserts initial source and exact hair preservation. | Existing initial-fallback keeper already asserts initial source and all decisions; transfers exact hair deep equality from initial source. PASS. Shared real engine-generated fixture/output is source/adapter preservation evidence, not independent engine correctness. RPC stub supplies successful publication; no real SQL/concurrency claim. |
| C12 | Donor and keeper both return `{data:null,error:null}` for the same user. Query identifiers differ and produce different GTIN variants, but `pending-submission.ts:38` returns null without consuming identifier/count after the await. | Existing three-variant query call is unchanged and its full variant assertion remains; new wrapper asserts that existing result null. PASS. Query fake captures real builder requests but does not prove database filtering. |
| D1 | EAN INSERT and user parameter are literally keeper's first INSERT against the same empty minimal migrated table; original count1 expresses successful admission. | Existing EAN+name coexistence keeper executes that INSERT plus a separately valid name INSERT and asserts count2. PASS as duplicate registration, not obsolete/retired SQL. |
| D2 | Name INSERT/user parameter is literally keeper's second INSERT. Table state differs by preceding EAN row, but that row cannot participate in the partial name index (`scanned_identifier_value IS NULL`) and CHECK is row-local. No trigger or stateful third-party writer exists in this minimal harness. | Same unchanged two-row keeper preserves successful name admission and final cardinality. PASS on this actual dependency readset. Existing constraint failures, duplicate rejection, closed-row reuse and scope cases stay. No deployed schema/RLS/concurrency claim. |

The two D labels mean already-covered registrations, not dead application paths. Neither migration nor any owner is retired. I reject an alternative rationale that a helper is expendable merely because private/test-only, dark rollout, old history, or not in navigation. All owners here are reachable/current or are supported fixture adapters.

## Eighteen intended-failure recipes

All 16 TypeScript whole mutants parse and match unique complete owner/source anchors and whole-mutant SHA. The two SQL changes are raw migration text append operations; they were not parsed as SQL, compiled, or executed. All 18 exact selected titles identify one AST registration within their named file; none selects the dynamic typo table. Both transfer/cut oracle text, callback SHA, first-frame requirement, operator and generated literal message are coherent. Literal error formatting was independently reproduced, but is not an observed test failure.

| Control | Real owner fault | First intended assertion, transfer/cut lines | Assessment |
|---|---|---|---|
| M01 | Empty comparison score0→1 | mask empty whole comparison57/36 | Whole output mismatch; actual empty branch. |
| M02 | pass→partial state mapping | payload whole comparison89/68 | State and consequential score mismatch. |
| M03 | Extra `debug` in comparison row | payload whole comparison89/68 | Exact nested shape fails. |
| M04 | Product id added to masked alternative | payload key loop94/73 | Comparison remains correct; original exact key assertion fails. |
| M05 | Supportive alternative forced ideal | route339/339 | Prior privacy/labels pass; transferred verdict literal fails. |
| M06 | Verdict label forced `Passt` | route340/340 | Verdict/supportive assertion passes; label fails. |
| M07 | rowId copied from label | payload89/68 | Generic copy contract fails, without category-policy assumption. |
| M08 | Nonempty score forced0 | payload89/68 | Transferred score1 fails. |
| M09 | Mask only first alternative | route315/315 | Count1!=2 before later observations. |
| M10 | Extra `debug` masked property | route325/325 | Not in forbidden-key list, so exact allowed-key set is first failure. |
| M11 | All labels `Kriterium` | route338/338 | Generic-label literal set fails after key checks pass. |
| M12 | Fresh call return0 while persisted count remains1 | session48/36 | First return assertion catches separately from persistence. |
| M13 | Skip first storage write, return1 | session49/37 | Explicit `fresh session must persist the session record`, operator `==`; no Node source-inspection diagnostic dependency. |
| M14 | Second call returns1 while storing2 | session50/38 | Intermediate return assertion catches; final3 alone would not. |
| M15 | Actual profile adapter changes output thickness to coarse | initial fallback82/82 | Existing source/decisions pass; transferred whole hair equality fails. Independently corrupts receiver after shared builders. |
| M16 | Null pending result replaced by unexpected researching object | pending62/54 | New null equality fails after unchanged query. |
| M17 | Actual migration rule discards identifier-bearing INSERT | SQL211/184 | Must be actual strict count1!=2; import/SQL/setup error does not qualify. |
| M18 | Actual migration rule discards identifier-null INSERT | SQL211/184 | Same strict count1!=2, complementary admission fault. |

M17/M18 use PostgreSQL `ON INSERT ... DO INSTEAD NOTHING` rules with predicates on `NEW.scanned_identifier_value`; keeper queries do not request RETURNING. This is a plausible real migration fault and the static conditions align with the two existing rows. **Only main's local execution can establish PGlite accepts the rule and reaches the intended assertion.** Require clean1 → intended ERR_ASSERTION1 with correct operator/decoded message/FIRST keeper frame → owned byte-exact source restoration → clean1. No setup, skip, hook, cancel or timeout may count. The same strict runtime condition applies to all16 TypeScript controls. No mutant was run by this reviewer.

## Retained contracts and bounded corrections to broad wording

All103 R and both F sites were read in full, not accepted from title alone. The machine site receipt preserves exact119 names/body SHAs and maps each to this review's independently checked file contract. Particularly retained: unknown/caution/fail/order/fractional comparison branches; alternative/scanned-id collision and identifier HTTP branches; query projection/user/open-status/GTIN filters and errors; role ranking/status/coverage/tie/nonmutation; auth/access/quarantine/commerce availability; analytics privacy/routes/retry/dedup/session metadata; observability outcome/reason boundaries; SQL missing-identity/brand-only constraints, duplicate indexes, scope and closed-state reuse; trigger threshold/fatigue/storage failures; quiz once-only/background/internal-test boundaries; email configured-template/encoded URL; trial German copy and links.

Both held F sites remain exact and earn zero credit: catalog id-tie title lacks equal-name rows; SQL scope title names brand but does not vary brand. No repair/new input is proposed.

Narrow claims that must not be promoted in integration evidence:

- Payload keeper preserves the three original untouched fields actually asserted (verdictTitle, coverage, dimensions), not an exhaustive assertion of every future payload property.
- Frozen comparison-array test does not deep-freeze each criterion object.
- Offer analytics asserts selected `source_section` value undefined; it does not prove own-key absence. Scanner email fixture uses an already clean email, so it does not prove trimming.
- Manual trigger-card traversal is not mounted hook/browser execution. Retaining it makes no new mounted lifecycle claim.
- Capturing PostHog calls proves that adapter boundary; event route constants alone are not delivery to every destination. The zero-op port is not a live provider integration.
- Source seed and publish RPC fixture are meaningful adapter inputs but do not independently prove underlying engine outputs or storage CAS.

These are limitations of retained tests/author wording, not new assertion losses caused by the proposed cuts.

## Reachability, history, dependencies and exact read depth

Fresh full reads: **all21 original tests**, every119 callback, all fixtures/helpers and parameter rows. Complete transfer diff, cut diff, candidates, ledger, controls, sealed manifest/handoff and command packet reviewed. The typo table has10 existing rows for one declaration; static expected registrations are128 before/transfer and114 after if all register. These are not freshly measured runtime counts.

Immediate operative owner/support closure: 34 full files named as full-source readsets (32 fresh full reads; two prior full reads reused only after exact SHA correspondence). Reused `scanner-context.ts` SHA `f77e2a27db12dc68cc8b4deab30c25c45e12796053b32bf43fd71f7d4b7e73ce` and `compute-stage1.ts` SHA `3618dbc5d3e1c035ea60b79dffe6a356ced57c3e19b8d591c512d688936a4bcc` from `/tmp/test-audit-free-provisioning67-independent-read-depth.json`; scanner predicate/source-selection/publication portions were additionally reread fresh. This full closure includes actual resolve/search/funnel routes, shared context Supabase adapter, mobile seed builder, comparison/masking/presentation/roles/pending/access/session owners, commerce/title/normalization helpers, analytics/context/quiz and scanner email builders, both offer components, trigger cards, and actual name-only migration.

Other precise source slices are recorded separately in the read-depth JSON: ScanFlow fatigue storage290–340; resolve-verdict150–225 role/comparison caller; artifact dispatcher80–127; submit180–232 conflict recovery; open status list42–59; plan input/schema/projection1–155 and170–264; plan hair types130–156; legacy adapter1–102; scan contracts1–110; relevant PostHog mappings and event types. Full transitive recommendation engines, whole ScanFlow, whole product-intake repository/submissions, all analytics runtime/provider implementation and whole underlying database engine were not independently re-audited.

Direct caller search confirms authenticated `/api/scan/resolve` invokes masking and profile/pending owners; reveal also uses profile context; ScanFlow uses session owner; product-intake repository uses pending lookup and submit route uses name-conflict recovery; scanner email is dispatched by result-artifact service. No no-current-caller retirement claim is made. History read-only logs/full commit messages and scoped stats inspected for #526 (`f3790784` masked/privacy/session), #593 (`ac021a5b` name intake/EAN compatibility), #584 (`0d72bb53` shared native/web context). T8/T10/current privacy plan clauses corroborate these live contracts. Historical dark rollout is not current retirement evidence.

CI Node22 step `.github/workflows/ci.yml:145–163` executes `npm run test:node`; package command includes all top-level `.test.ts/.test.tsx` files. Marker-only `server-only-register.cjs` was fully read. Installed NextResponse JSON delegation84–108 was read. Installed PGlite query/exec API declarations810–844 were read; its engine/package internals were not fully audited/executed. Parser/package/lock SHA checks are identity guards only. The separate236-file literal import navigation is not adopted as semantic scope or runtime closure; original76 guards are preserved, without refreshing dormant-owner drift.

## Handoff and verification limits

Only fresh `/tmp/test-audit-scanner119-independent-*` files were written. Repository/test/source/config unchanged by this reviewer. No test, mutation, provider, browser, database or owner execution; no external review dispatch. Main's648 frozen full-suite/coverage work is separate evidence and was not rerun or claimed here.

Use packet `main-commands.json` for the exact21-file native command and anchored selected-title template. Before integration, main still owns current guard acceptance, original/transfer/cut native proof,18 strict faults/restores and campaign CI/coverage. This review adds no new approval gate or product policy.
