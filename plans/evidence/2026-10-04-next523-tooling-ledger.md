# Tooling / CI static-layer reassessment

Eight fully read test files, **74 AST declaration sites** including two dynamic t.test sites in worktree-finish; no row inflation. Verdict counts: **R65 F5 C3 D1**. Core tooling C3 is three conditional removals; separate Stripe config D1 is one conditional removal. No edits/runners/provider traffic/source faults performed. There is no evidence here for a large removable static-architecture layer.

Read limits: every callback and fixture in these eight files was read in full. Complete current owners: worktree-new323 lines, worktree-finish603, path-rules124, changed-paths52, require-job-results52, nested-runner39, CI workflow, k6 launch88/production53, webhook-config131, Vercel config and relevant package script entries. Package scripts are their own configuration owner; implementations of mobile perf and live chat evaluation were not fully audited. Tracker browser source was read in relevant excerpts (a broad output was truncated); no browser-suite complete-read credit. Three quiz API bodies referenced by the final launch source guard were not fully read; that guard is F/hold, no route-security claim. Billing reconcile was read only at the real dynamic-import/call adapter (~353–370); no complete billing-route credit. Full-body-only exploration additionally read eval-chat client/concurrency/debug-artifacts/fixtures/report, launch provider tooling and metadata audit tests, but their owners were not all read and they receive no semantic scope credit here.

Reachability/authority: root AGENTS explicitly requires worktree:new and guarded worktree:finish; package entries31–32 invoke actual scripts. Git operations in candidate keepers run against temporary local bare origin and worktrees; fake gh returns PR input only, never implements cleanup/refusal. CI quality-node invokes test:node whose native glob includes all eight files; quality-core routes actual require-job-results and changed-paths imports actual classifier. Launch runbook explicitly retains future isolated k6 use and one-production-smoke operator command; lack of an eligible isolated target is not retirement. Billing reconcile dynamically imports and invokes webhook config checker to inspect provider delivery setup. No new test-only source seam or dead source closure established.

History inspected: fbc0c69c (#276) introduced clean/fresh main worktree-new and six tests; 99632b11 (#231) introduced exact guarded cleanup with detached preservation and ignored-file safety, so these policies remain. 19b1ec22 (#381) explicitly retired Docker/local Supabase CI and introduced both repeated migration projections; no restoration of retired feature proposed. 97d1fc1b (#355) owns parallel CI aggregation. 641a1522 (#466) deliberately hardens load isolation; 455c115b (#469) corrects pricing307→quiz smoke. 1550ae7c (#461) introduced billing truth webhook-check coverage. History is targeted git log/stat/diff excerpts, not exhaustive branch archaeology. Prior /tmp/test-audit-static-ledger.md grouped source guards all R; this reassessment preserves independent release contracts but marks exact private call/token shape checks F and finds actual input union C3.

Validation required of main: `node --import ./tests/server-only-register.cjs --import tsx --test tests/worktree-new.test.ts tests/worktree-finish.test.ts tests/ci-path-rules.test.ts tests/ci-workflow-orchestration.test.ts tests/ci-job-results.test.ts tests/package-scripts.test.ts tests/launch-load-readiness.test.ts tests/stripe-webhook-config-check.test.ts`. No executable production worktree command or real k6/provider command should be run for this proof. Run candidate source controls serially against local fixtures, restore byte exact; full native/c8 and branch gates remain main-owned. No source/support deletion unlocked; existing fixture helpers serve retained tests. Baseline failures were not evaluated or removed.

## Per-declaration verdicts

### tests/package-scripts.test.ts (6)

- **R 11 — test:agent runs agent compare regressions**: Package registration protects four compare suites omitted from the native glob; removing a named spec from test:agent fails. Owner is package.json command, not compare implementation.
- **R 25 — launch stress scripts expose the expected k6 profiles**: Supported operator command names select smoke/average/spike/safety/soak k6 profiles and separate production harness. Wrong K6_PROFILE or executable path fails; actual k6 profile owner does not prove npm routing.
- **R 44 — mobile performance script is exposed**: npm perf:mobile must resolve an existing mobile-lighthouse script; missing public command/file fails. No same-input command-registration keeper.
- **R 51 — merged task cleanup is exposed through the guarded finisher**: AGENTS merge workflow invokes npm worktree:finish, so package registration and script existence are independent of direct script execution in worktree-finish tests.
- **F 58 — prepare skips Husky when dev dependencies are omitted**: Omitted-dev install contract is meaningful, but three source tokens also survive a reversed condition or unconditional husky invocation. Repair at execution of existing package command with controlled husky stub/environment; no deletion proposed.
- **R 66 — chat ci smoke uses bounded eval concurrency**: CI invokes test:chat:ci; run.ts plus --ci-smoke and bounded --concurrency 2 command registration is independent of worker implementation/order tests.

### tests/ci-job-results.test.ts (3)

- **R 12 — quality aggregation accepts success and deliberate path skips**: Executes actual aggregation CLI: successes and explicitly allowlisted skipped child must succeed and be reported. Removing allowlist support fails.
- **R 26 — quality aggregation rejects failures, cancellations, and unknown states**: Executes failure/cancelled/nonallowlisted skipped/unknown timed_out states, checks nonzero and exact job state. Permitting arbitrary non-success fails; not mock-owned verdict.
- **R 35 — quality aggregation rejects malformed or missing results**: Actual CLI rejects empty argv, missing equals, missing result, empty allowlist. Removing argument validation fails; these are distinct parse/arity branches.

### tests/ci-path-rules.test.ts (14)

- **R 5 — full CI marker in PR title forces all path-aware gates**: Public [full-ci] title override produces exact six-field all-true output on docs input. Removing marker support or one forced field fails.
- **R 17 — diff failures can force all path-aware gates without changed files**: forceFullCi:true with empty files traverses strict explicit fallback when diff fails; marker keeper does not cover this distinct branch.
- **R 28 — frontend route changes run Playwright but not chat or retrieval evals**: Profile route triggers UI smoke without paid chat/retrieval: broadening CHAT_PREFIXES or losing src/app/ smoke fails.
- **R 35 — chat engine changes run chat eval and Playwright when user flow may be affected**: Chat API combines chat and UI checks; removing chat API prefix fails independently of frontend route.
- **R 41 — retrieval fixture changes run retrieval gate only**: Configured retrieval gold-file exact match with no chat/UI costs; changing that exact path fails. Existing retirement ledger is not reopened.
- **R 48 — product matcher changes run chat eval**: Product matcher prefix remains paid-chat relevant but not retrieval; changing prefix membership fails.
- **R 54 — product list chunk changes run retrieval eval**: Configured product-list chunk path is explicitly excluded from CHAT and included in retrieval. Retained configured contract; no new retirement inference in this lane.
- **R 60 — Personal Plan application routines run the journey without paid chat evaluation**: Application subprefix suppresses paid chat despite broader routines prefix, retains journey. Deleting CHAT_EXCLUDE_PREFIXES fails.
- **R 69 — shared chat routine changes still run chat evaluation**: Two shared routine inputs still admit chat after application exclusion; overbroad routines exclusion fails. No input packing proposed.
- **R 78 — workflow and dependency changes mark security scan relevant**: Both workflow prefix and dependency lock exact path enable security; dropping either rule fails.
- **C 83 — CI scope no longer exposes a local database gate**: C3: exact same migration literal already evaluated by targeted journey keeper. Transfer absence of personal_plan_db onto existing migration result; journey:true already asserted.
- **R 89 — integrated Personal Plan runtime paths run the persisted journey**: All listed runtime/auth/layout inputs and two excluded layout/card inputs constrain exact/prefix admission union. Distinct listed registry keys remain; no blanket same-prefix cuts.
- **R 116 — Personal Plan journey scope remains targeted to runtime and presentation changes**: Primary C3 keeper; existing migration, persistence, presentation and docs results protect journey inclusion and docs exclusion. Absorb own-property absence using existing migration variable.
- **R 130 — field-test access seams trigger the contracts they can invalidate**: Field-test server/API/script and public token/ended surface prefixes must trigger journey; removal of any corresponding prefix fails.

### tests/ci-workflow-orchestration.test.ts (13)

- **R 107 — workflow job extraction respects top-level boundaries and the final job**: Test-local YAML inspection support is used by release assertions. Nested inserted-job text, top-level on/push exclusion, comments, last job, and spaced job declarations guard false extraction; no stronger current input covers all grammar variants.
- **R 137 — job dependencies support block declarations without crossing into later fields**: Actual quality-core uses block needs. Blank/comment/trailing-comment fixture protects parser acceptance and prevents runs-on capture; inline real-job keeper cannot prove block grammar.
- **R 151 — Playwright smoke starts after scope detection without waiting for core quality**: Actual workflow smoke dependencies, exact guarded command sequence, live-secret AND gate, setup-node and always-upload are independent release guarantees. An unguarded run is rejected by checker calibration inside same callback.
- **R 186 — payment feedback V2 smoke is reserved for scheduled or explicit full CI**: Independent opt-in V2 job uses full_ci true and public feature flag, exact tag and always upload; removing full gate or feature switch fails.
- **R 204 — scan funnel journey live run is reserved for the same full CI gate as payment feedback V2**: Live scan fixture is separately opt-in AND nonempty service-role secret; loosening boolean gate could write production on normal PR and fails exact expression check.
- **R 219 — quality core preserves its required name as a fail-closed parallel aggregate**: Required quality-core name, six dependencies, always execution and result bindings/allowed skips keep branch gate fail-closed; helper execution tests do not prove YAML wiring.
- **R 239 — quality work is divided into independently scheduled lanes**: Static typecheck/lint/build/funnel, Node native/nested/agent and generic browser lanes have unique command assertions beyond Stage3 sibling. Whole declaration cannot be cut from partial Stage3 overlap.
- **R 283 — the Stage 3 CI browser suite isolates the production lab from development journeys**: Distinct build-vs-dev server, environment flags, runner specs/projects, port, readiness root, browser installation and cleanup timeout are configured delivery contracts; basic scheduling sibling omits these.
- **F 364 — the tracker product drawer smoke does not wait for network silence**: Tracker no-networkidle intent matters, but exact baseUrl spelling/private goto call shape fails identifier refactors and can miss an equivalent helper regression. Existing real tracker journey was read only in excerpts; no faithful zero-extra-input runtime keeper established, retain pending repair.
- **R 376 — aggregate contracts keep focused Personal Plan coverage without duplicate top-level tests**: Public nested runner command and aggregate inclusion/exclusion guard suite reachability; direct nested runner behavior does not prove its npm registration.
- **R 395 — Docker-backed Personal Plan jobs and commands stay retired**: Historical Docker retirement is explicit at 19b1ec22; negative public job/command/output keys and Docker package commands are retained independent release contract, not obsolete-test evidence.
- **R 418 — scheduled CI explicitly forces every path-aware gate**: Nightly schedule and schedule-to-FORCE_FULL_CI mapping guard full gate delivery; force flag unit test does not prove workflow input.
- **R 428 — chat and retrieval gates retain their core-quality dependency**: Paid chat/retrieval must wait for scope and quality-core; smoke intentionally does not. Removing quality dependency fails this independent scheduling constraint.

### tests/worktree-new.test.ts (6)

- **C 72 — fetches and fast-forwards clean root main before creating from fresh origin/main**: C1: plain origin-only clean success is absorbed by existing unavailable-unrelated-remote keeper; transfer task HEAD=freshSha. Git fetch is explicitly origin-only and no owner enumerates other remotes.
- **R 82 — refuses a fully dirty root without creating task artifacts**: Untracked dirty root refusal before creating directory/branch or moving HEAD; skipping clean check fails precise stderr plus real local state assertions.
- **R 103 — refuses when the primary root is not on main**: Root checked out on local-root-work must refuse; main-only branch guard independent of dirtiness.
- **R 114 — refuses when origin main is unavailable**: Origin removed makes fetch fail; no-root-artifact assertion guards missing remote branch, independent of non-origin remote failure.
- **R 125 — refuses root main history that cannot fast-forward**: Local commit plus newer remote creates divergence; actual --ff-only failure must preserve absence of task checkout.
- **R 136 — ignores unavailable remotes unrelated to origin**: Primary C1 keeper adds unreachable unavailable remote but actual owner fetches origin only; retained selective-fetch contract and root fresh SHA plus transferred task fresh SHA.

### tests/worktree-finish.test.ts (20)

- **R 201 — dry-run proves a multi-commit squash merge without mutation**: Dry-run has apply:false and three-commit squash fixture; checks local/remote refs and root HEAD unchanged. Apply keepers cannot catch writes leaking into dry-run.
- **C 213 — apply fast-forwards root and removes exact task artifacts**: C2: ordinary apply success oracle absorbed by detached-worktree-preservation keeper. Transfer FINISHED, root merge SHA and exact task worktree absence; existing local/remote absence retained.
- **R 228 — a completed cleanup is idempotent**: Two actual apply invocations test absent local/remote/worktree retry branches and already-absent receipt; a first-run success cannot prove idempotency.
- **R 239 — dirty task worktrees are preserved**: Untracked task dirtiness must stop all deletion and preserve both refs; not root-dirty policy.
- **R 251 — unique ignored files are preserved**: Ignored unique task file with no matching included root copy must refuse; actual ignored-state/diff policy is not exercised by plain untracked file.
- **R 268 — unchanged worktree include copies are disposable**: Identical root/task .worktreeinclude copy may be discarded; retaining all ignored content would make this successful cleanup fail. This is synthetic local fixture content, not a credential read performed during audit.
- **R 286 — locked task worktrees are intentional retention**: Git lock plus retention reason blocks deletion. Removing lock checks fails status/reason/refs.
- **R 304 — local commits added after the merged PR are preserved**: Local post-merge commit tips differ from PR head and must survive; existing correct-head fixture cannot detect lease/ownership drift.
- **R 316 — malformed and all-zero PR head SHAs are refused**: Container invokes both malformed and zero SHA child cases; preserve this declaration and both child inputs.
- **R 320 — headRefOid**: Child site checks actual invalid or zero SHA refusal message before refs deleted; meaningful two-row SHA format/zero branches, not two deletion credits.
- **R 334 — GitHub must return the exact requested pull request**: GitHub returns PR43 when requested42; wrong-PR refusal and both refs preservation protect exact task ownership.
- **R 347 — duplicate pull request arguments fail closed**: Duplicate --pr42 --pr43 is rejected by actual argv parser before cleanup; returned wrong PR is a later independent guard.
- **R 362 — forked, stacked, unmerged, and protected PRs fail closed**: Container invokes fork, stacked base, OPEN, protected main child cases; all remain distinct ownership/admission checks.
- **R 380 — name**: Child site asserts exact refusal for each supported unsafe PR shape and real refs; no packing or removal.
- **R 390 — the finisher refuses invocation from a linked task worktree**: Invocation cwd is linked worktree; main-only ownership guard must refuse even clean correct PR.
- **R 403 — an unrelated detached worktree is preserved without blocking exact cleanup**: Primary C2 keeper; detached worktree has same SHA but no branch and must survive while exact task branch is removed. Add donor root/receipt/task-absence assertions to existing result.
- **R 419 — dirty root main is preserved while exact task cleanup continues**: Dirty root is intentionally left unchanged while task is safely cleaned; root cleanliness branch differs from clean fast-forward.
- **R 433 — remote deletion failure preserves local retry artifacts**: Local bare-origin pre-receive hook rejects delete; nonzero and all local retry artifacts must remain. Real subprocess ordering, not fake receipt.
- **R 451 — merge commit must be reachable from fresh origin main**: Merge SHA points at task head not contained in fresh origin/main; ancestry admission must refuse.
- **R 467 — open dependent PRs preserve the remote and local task branch**: Fake gh supplies an open dependent PR input; actual owner parses it and preserves real local/remote refs. Fake does not implement cleanup or refusal.

### tests/launch-load-readiness.test.ts (4)

- **R 5 — Vercel functions are pinned to Dublin beside the production database**: Exact Vercel region/deployment branch config independently protects Dublin placement and main-only deployment; runtime route tests do not observe it.
- **F 15 — isolated launch load tests fail closed instead of defaulting to production**: Meaningful nonproduction isolation/GET-only contract, but substring names and includes/endsWith tokens do not prove denial predicate or execution ordering. Retain; no same-input executable k6 keeper found and no production traffic authorized.
- **F 33 — production smoke has a separate read-only harness**: Production smoke must remain acknowledged and assert exact redirect/status. Private expectedStatuses/result spelling couples source; acknowledge text alone does not prove fail-closed check. Preserve contract, do not delete pending safe operator harness repair.
- **F 48 — production routes contain no preview load-test authorization seam**: Normative launch runbook forbids preview authorization seam; absence of three historical spellings is not proof against renamed bypass. Entire route owners not read in this lane, so no whole declaration cut or claim of route security proof.

### tests/stripe-webhook-config-check.test.ts (8)

- **R 10 — verifyStripeWebhookConfig reports ok when the matching endpoint covers every required event**: Primary D1 keeper: actual classifier sees enabled matching endpoint and all required events plus irrelevant extra; exact result and captured.length0 prove successful branch and silence. Extra event does not affect operative decision.
- **R 33 — verifyStripeWebhookConfig treats a wildcard enabled_events list as covering every required event**: Wildcard is separate early return before missing-event filter; removing wildcard support fails.
- **R 49 — verifyStripeWebhookConfig matches the endpoint URL ignoring trailing slash and case**: Case/trailing slash actual normalizer input distinct from exact URL keeper; no title-only duplicate.
- **R 65 — verifyStripeWebhookConfig reports endpoint_disabled and captures an issue when the matching endpoint is disabled**: Disabled matching endpoint has complete events but must be rejected before healthy result; captured result expected exact.
- **R 88 — verifyStripeWebhookConfig reports missing_events and captures an issue when required events are absent**: Two specific omitted required events give literal missingEvents array and capture; success fixture expected-from-list cannot replace this negative event-byte contract.
- **R 112 — verifyStripeWebhookConfig reports endpoint_not_found and captures an issue when no endpoint matches the app URL**: Other-app URL is unmatched and returns before status/events; missing status in this fixture does not make false-green because exact endpoint_not_found is asserted.
- **R 133 — verifyStripeWebhookConfig reports error and captures an issue when listing endpoints fails**: Listing rejects actual async promise with Error; returned reason and captured issue protect error branch.
- **D 147 — verifyStripeWebhookConfig does not capture an issue for the ok result**: D1: no-issue-only callback duplicates successful actual branch already checked by first full-result keeper. Same normalized URL, enabled status, no wildcard, missingEvents=[]; extra checkout event in keeper is irrelevant to admission.

