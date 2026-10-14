# Migration/admission/prefill/frontier76: no-cut handoff

Decision: retain all 76 registrations in the exact 10-file navigation scope. Classification is **75 R / 1 F / 0 C / 0 D**. The F is held unchanged and earns no repair or removal credit. No production/test/support changes are proposed. The three snapshot phases are deliberately byte-identical 76→76→76; they document no-cut disposition, not an operator workflow.

`sites.json` contains every registration's complete body, callback SHA, all original assertions with source lines, lexical nonassert calls, independent contract and credible regression. `ledger.md` is the readable per-site judgment. `manifest.json` pins all 10 test files plus 54 owner/support/dependency readset files and records exact read depth. All original navigation test hashes matched current bytes. 76 unique callback hashes, 288 callback-local assert call sites, 30 snapshots, zero parse diagnostics. Helper assertions remain in full snapshots, not included in the callback-local assertion count.

## Operative owner layers and rejected transfers

1. **Narrow route projection vs full stage admission.** `frontier-routing.ts` reduces readiness/durable pointers and determines redirects; `journey-access.ts` additionally consumes access state, stage gates, current product authority, completion and plan identity. A Stage 4/5 result in one does not imply the other's allowed-stage/identity/redirect union. The sourceReady false/true rows in moderator entry overlap earlier pure frontier inputs only partially: their `/anwendung` redirect calls are additional existing owner invocations. Consolidating complete callbacks would require moving/adding calls or lose Stage 2, route exemption or output properties. Reject.

2. **Owner-RPC loader vs pure projection.** The loader tests actually consume source kind, qualified_at, migration status and partner-RPC response/error. Direct projection fixtures do not cover default source parsing, fallback ordering, missing-function deployment discrimination or cutoff. Field-test, paid, partner and durable migration bindings are different operative branches even where nextHref is `/plan-bereit`. Reject grouping by common output.

3. **SQL admission vs TypeScript adapter vs HTTP ready route.** PGlite executes `20260828104243_personal_plan_paid_migration_admission.sql` against the complete local predecessor fixture. It covers authority joins, read/write distinctions, privileges, source locking, persisted fields, exact retry and constraints. Adapter tests consume injected SQL-shaped rows and enforce gating/normalization/argument construction. HTTP tests inject resolver/binder/readiness but execute real handler checks, bind-before-link ordering, privacy headers and package/error transport. A captured callback can manufacture a status but cannot manufacture the handler's ordering; conversely it cannot prove SQL storage. No full assertion union crosses these layers.

4. **Three apparently similar SQL source/retry callbacks.** Exact save retry compares the same lead and field rows; changed legacy source creates a new lead while preserving old answers/status; personal-plan source recovery additionally preserves original quiz_kind and creates legacy output. Different actual database state/read predicates and discriminated input source kinds prevent safe transfer. Bound Stage 1 artifact vs legacy quiz sources also take disjoint clauses. Do not pack the three into one callback.

5. **Legacy mapper near-duplicates.** Unknown nonempty night protection, empty historical defaults and explicitly submitted empty arrays express different evidence states. Category mismatch, canonical row/property-order fingerprint, invalid frequency and conflicting duplicate frequencies differ in consumed predicates. The repeated self fingerprint equality in the category-mismatch callback is weak alone but the callback independently protects category authority; the order-invariance callback compares semantically equivalent *different* inputs. No whole callback can be removed.

6. **Cookie crypto vs signed route fixtures.** Route tests issue valid cookies but do not union tamper, user/time, malformed issuance, missing-secret, path/HttpOnly/sameSite/age constants. The signer is a real cryptographic owner; fake admin rows are not a stronger crypto boundary. Reject.

7. **Prefill recovery states vs client init.** Pending same enrollment exits before source-consumption and quiz-kind reads; ready personal-plan checks consumed source then yields blank. Other enrollment, other user, no cookie, consumed initial source and failed authoritative lookup reach different guards. Common `recover`/`fresh_blank` values are not input equivalence. Helper parse/first-missing-step/recover-precedence union is broader than the page retry fixture; the page adds actual retry callback/effect and real store preservation that the pure helper cannot reach. Neither subsumes the other.

8. **Dormant released-rollout helper.** Four direct helper tests have meaningful behavior only on a now-dormant default branch. Current symbol references alone initially suggested a live caller, but the actual production resolver returns literal `all` and `#382` explicitly retired the launch selectors. This is a concrete cross-scope cleanup lead, not a same-input C or an approved four-test deletion. See `dormant-rollout-followup.md` for exact source and sibling contract closure. Earlier R judgments remain recorded; no metadata was repinned to turn them into D.

## Held F

`tests/personal-plan-legacy-cutover-eligibility.test.ts:88`, “eligible and excluded legacy activations emit only aggregate transition dimensions,” invokes only an eligible PayPal activation. It protects exact eligible aggregate fields and no raw identifiers. A mutation that leaks identifiers only on `cutover_ineligible` would not be observed. Title overclaims the tested input, but deleting it would lose the positive privacy contract. No new rows or repair proposed.

## Positive current consumers and history

- Migration admission is consumed by `enrollment.ts:200`, the ready page `page.tsx:169`, ready status GET/POST, and signed quiz context route. Lead completion routes signed recovery to `saveMigrationQuizLead`, which calls the SQL save RPC. These are current mounted default entries; no historical-account retirement inference.
- Legacy prefill is invoked by optional Stage 2 after eligible/unconsumed/assumed-parent checks and Stage 3 optional inventory after migration state/handoff/current-draft checks. Its canonical fingerprints and incomplete facts are persistence inputs, not test-only decoration.
- Legacy cutoff eligibility is still called from Stripe subscription/one-time and PayPal checkout/trial admission. Trial authorization timestamp is intentionally used when there is no payment yet.
- `822a547c` (#481) introduced the unified paid migration implementation and owned admission/prefill tests; `97e7da78` (#490) added current partner routing fallback. `05da162e` (#382) explicitly retired app/Stage 2–5 launch flags while preserving new-buyer cutoff, legacy quiz cutover, owner authority and initial-Routine gate. It is evidence for the narrow dormant rollout follow-up only.
- Earlier full semantic ledgers: `/tmp/test-audit-personal-plan-journey-quiz-complete-ledger.md`, `/tmp/test-audit-journey-lifecycle-layer-ledger.md`, `/tmp/test-audit-stage2-delivery-full-ledger.md`. Their owner reads were reused as recorded in manifest; their test cohorts were not silently counted as fresh full reads.

## Dependency and proof limits

All 10 owned files, including complete 910-line PGlite test, 668-line route/client harness test, fixture SQL, callback helpers, and literal parameter arrays, were read. Primary owners and direct operative mapper/normalizer dependencies were read completely. Large surrounding callers were read only at relevant call paths; exact limits are in manifest. The database predecessor is a purpose-built minimal schema, not the entire migration chain. Real PGlite SQL execution is present in tests, but this read-only review ran none of it and establishes neither live Supabase RLS behavior nor real two-session contention. Existing SQL test sequencing does not prove races.

The prefill fake query builder ignores `.eq` arguments; the happy path cannot independently establish actual Supabase ownership filtering. The route invokes real signer/parser/normalizer and NextResponse, whose installed implementation delegates to standard Response.json. Cookie-free and wrong-user cases do prove early avoidance of the injected admin factory. The client harness replaces React's dispatcher and directly invokes the Button callback; installed React delegates hook calls to that dispatcher, and installed Zustand merges partial setState. This is actual QuizPage/effect/store logic but not DOM event propagation, browser navigation, React scheduler or unmount correctness. The helper's effect-cleanup bookkeeping and timed settling are inherited limitations, not new proof.

No tests, owner imports, SQL execution, browser or provider calls were run. Static work imported only the installed TypeScript parser and Node built-ins; no subprocesses were started by static scripts. No runtime verdict, coverage gain, deletion saving or source-fault claim is made. Empty candidates/controls/diff are intentional.

## Main-only validation, if a fresh baseline is desired

From the pinned worktree, use the repository's Node lane (not executed here):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-frontier-routing.test.ts tests/personal-plan-journey-access.test.ts tests/personal-plan-legacy-cutover-eligibility.test.ts tests/personal-plan-legacy-prefill.test.ts tests/personal-plan-migration-admission-migration.test.ts tests/personal-plan-migration-admission.test.ts tests/personal-plan-migration-quiz-context.test.ts tests/personal-plan-migration-quiz-prefill.test.ts tests/personal-plan-migration-ready-route.test.ts tests/personal-plan-rollout-access.test.ts
```

`.github/workflows/ci.yml:148–159` runs `npm run test:node`; package.json includes these top-level files. Any pre-existing failure remains evidence for investigation, not grounds for deletion. There is no transfer/cut command because no cut is proposed.
