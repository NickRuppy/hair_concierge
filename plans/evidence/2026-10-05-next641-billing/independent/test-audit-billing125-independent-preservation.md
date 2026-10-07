# Independent billing125 preservation review

**Verdict: CONDITIONAL PASS for the six proposed declarations (4 C, 2 D), pending main-owned native and five actual-owner fault controls. No semantic preservation blocker found.** This review applies only to frozen `/tmp/test-audit-billing-operational125`, manifest `53fbed371f43e577c3049f263ade5fcc920840fa74ed0b9eb56433a46d588b06`, handoff `a85f60016049990c636e0ea62e1cc63605360a7026e5d6807821b422f2c5947f`.

One reasoning qualification is necessary: **C3 is supported by the existing keeper union, not by claiming +420h admission alone mathematically subsumes +24h admission under every monotonic threshold shift.** The retained -12h admission keeper also constrains the same actual lower-bound predicate. No proposal bytes need changing for that qualification. No calls, inputs, rows, assertions, or cases are added. No source/helper retirement is supported or proposed.

## Independent static reconstruction

The independent static reader did not invoke author preparation scripts. It parsed all 39 full phase files with the installed TypeScript parser, reconstructed each cut from exact original AST statements, compared every survivor, checked every frozen artifact digest, and checked all 55 current readset digests. All 839 checks passed, with no live-byte drift detected at that observation.

- Exact 13 files: **125 → 125 → 119** AST declarations.
- Transfer is byte-identical to before for all 13 files.
- Only three test files change at cut: access-grace loses four statements; admin summary loses one; monitor route loses one.
- **119 surviving statements are byte-identical**, including all five keepers and all five held F declarations. The 114 other survivors exclude the five distinct keepers.
- All source, imports, helpers, tables, other test statements, and statement-external text remain unchanged except whitespace adjoining the six whole deleted statements.
- Every fault's complete named function and original file hash matches; each scoped replacement is unique, its complete mutant file SHA matches, and its prospective TypeScript syntax parses. Each command selects exactly one title in its selected file; each phase's designated assertion text, line and column matches.
- Static syntax is not semantic typechecking or actual execution. No repository/configuration writes, owner/test imports, native tests, subprocesses from the static script, mutations, providers, network or database operations occurred. The static script imported only Node built-ins and TypeScript's parser and emitted a `/tmp` report.

## Full test read scope

All callbacks, fixtures, helper functions and parameter-loop bodies in these 13 original files were independently read in full: 3,877 lines, 125 declaration sites. Statement equality proves preservation of their unchanged prospective bodies; snapshots were not given fresh runtime credit.

|File (`tests/` prefix)|Original → cut|
|---|---:|
|admin-user-billing-summary.test.ts|20 → 19|
|billing-subscriptions-access-grace.test.ts|15 → 11|
|billing-reconcile-analytics.test.ts|16 → 16|
|billing-slack-supabase-ownership.test.ts|1 → 1|
|payment-integrity.test.ts|12 → 12|
|payment-monitor-route.test.ts|18 → 17|
|payment-monitor-trigger.test.ts|8 → 8|
|payment-monitor-paypal-test-classification.test.ts|4 → 4|
|billing-public-contract-declaration-resolution.test.ts|7 → 7|
|billing-public-contract-declaration-route.test.ts|5 → 5|
|billing-public-contract-declaration.test.ts|3 → 3|
|billing-public-contract-declarations-postgres.test.ts|6 → 6|
|public-contract-declaration-receipt-delivery.test.ts|10 → 10|

## Exact donor/keeper judgments

|Candidate|Original donor → existing keeper|Preserved assertion and judgment|
|---|---|---|
|C1|access-grace:43 → admin summary:197|Sole `hasCurrentBillingAccess(...) === false` remains observed as literal `summary.status === "expired"` through the actual helper. Donor is -48h; keeper -36h. Both canonical finite ISO dates, active, cancel flag false, no trial markers. For the current single lower-bound predicate, rejection of the nearer -36h also rejects -48h. Conditional pass; different epochs are disclosed.|
|C2|access-grace:51 → admin summary:188|Sole helper `true` maps directly to literal `"active"`. Both have exactly -12h relative period end, though their absolute dates and provider labels differ. No relevant owner branch reads those provider labels. Conditional pass.|
|C3|access-grace:59 → admin summary:135, with retained summary:188 as part of the union|Sole helper `true` at +24h remains protected by the future active keeper (+420h, including its independent exact period literal) and the existing -12h admission keeper. See the qualification below. Conditional pass.|
|C4|access-grace:110 → admin summary:144|Sole helper `true` for null period end remains observed as literal `"active"` through the actual null fallback. Omitted trial fields versus explicit null fields both reach the actual absent-marker branch. Conditional pass.|
|D1|admin summary:180 → admin summary:197|Both assert only literal `"expired"`. The donor is -1164h, keeper -36h; nearer rejection constrains the current monotonic threshold more tightly. Donor has no date-return, month-boundary or bucket oracle. Conditional duplicate pass; no claim the policy is retired.|
|D2|monitor route:364 → monitor route:406|Both assert exact `response.status === 200` and `flushes === 1`. Existing counter-based keeper traverses the same actual telemetry owner using findings counter 1, failures counter 0, the same valid receipt, optional no-op check-in and the same incrementing successful flush. Conditional duplicate pass with stubbed payment runner limitation.|

### Actual access readset and direction of implication

`src/lib/billing/trial-access-projection.ts:103–120` first validates the cohort marker, then treats null and undefined enrollment/projection fields as absent at 109–112. Both fixtures have `{}` metadata, so neither invokes the trial facts policy. The helper in `subscriptions.ts:405–424` handles open status, preserves null period access at 417, and otherwise calls `isWithinExpiryGrace`. The complete finite-date predicate at 474–477 is `timestamp >= now.getTime() - EXPIRED_ENTITLEMENT_GRACE_MS`. Its lexical input is the same canonical ISO format in all candidates.

The real composed summary at `admin-user-summary.ts:148–171` calls that helper at 161. For the selected active/cancel-false inputs it maps the returned boolean bijectively to `active`/`expired`. No fixture replaces the access helper, no date-specific override fabricates the expected result, and no provider-specific branch is traversed. Adminusers route:99 is a current production caller of the summary. This is real composed-function delivery, **not an executed HTTP/auth/query proof**.

For C3, a lower threshold of +48h would grant +420h while denying +24h. Therefore the pair alone does not prove every threshold drift. But that same faulty threshold denies the unchanged -12h keeper, which is already part of this packet's retained actual-helper composition. The -12h admission together with future admission and the preserved exact 24h constant/equality/one-millisecond boundary proofs retains the current lower-bound behavior. The supplied C3 fault (`&& timestamp <= now`) independently tests future rejection, and fails both original and future keeper. It is not claimed to prove all possible alternate date policies. There is no current future upper-bound, month bucket or provider condition to preserve; inventing one to reject the cut would expand current intent.

C1 and D1 have the opposite implication: for an increasing threshold predicate, -36h false implies -48h and -1164h false. Epoch differences cannot be called identical inputs, but no independent parser form, timezone conversion or date-bucket branch is exercised. All use finite UTC ISO values and an explicit fixed `now`.

The canceled-row helper tests must stay: summary:151–158 has its own canceled logic **before** calling the helper, so summary canceled assertions cannot detect a fault in the helper's canceled gate. The separate `hasCurrentLegacyProfileAccess` adapter must also stay: it consumes `subscription_status`, has its own null fallback and lacks the billing-row cancel flag. The proposed cut correctly leaves these branches, exact grace constant, equality and one-millisecond edge intact.

### Actual telemetry readset and limits

`payment-monitor/route.ts:179–221` executes the supplied runner, then actual `confirmTelemetryDelivery` and check-in receipt handling, and emits success only after those return success. `confirmTelemetryDelivery:348–356` reads `counters.findings + counters.monitorFailures`, filters actual receipt strings and awaits actual `flushTelemetryWithRetry:381–389`. The owner never reads detailed `findings` there. The actual summarizer omits that array.

The donor supplies one detailed Stripe finding and providersScanned/candidatesChecked 2/4; the keeper's counters are rebuilt from `emptyPaymentIntegrityCounters`, hence those two counts are 0/0, and findings is empty. These values do differ. They are not consumed by either asserted result. They are copied into a body neither test asserts. Incident count, receipt, completed status, check-in mode, authorization and flush behavior match. There is no hidden paid-access branch in either input. In particular, the fake runner does not compute the route's flush count or HTTP status; it only supplies input. That is adequate for this shared telemetry orchestration contract.

The keeper's empty materialization additionally detects incorrectly deriving receipt demand from `findings.length`; this is extra keeper strength, not proof that the donor originally detected that specific fault. Neither callback proves capture actually reached Sentry, real Stripe/PayPal scanning occurred, transport was delivered externally, or production default factories ran. Both use a supplied receipt and runner, and the successful flush callback increments before resolving; neither establishes delayed-promise ordering beyond this callback observation. No such stronger old oracle is lost.

## Five controls: exact static expectations, not results

All are unique scoped function replacements in the actual source. C1 and D1 share one control; there are **five**, not six, distinct faults. Columns are 3 in every keeper frame. Every intended failure must be decoded `ERR_ASSERTION` / `strictEqual` at the first relevant keeper frame; setup/import/type/runtime exceptions and timeouts do not count.

|Fault|Actual source fault|Intended first failing assertion; before/transfer → cut line|
|---|---|---|
|expired-access|`isWithinExpiryGrace` returns true after finite-date validation|admin summary `active !== expired`, line 202 → 194; C1+D1|
|premature-grace-end|Remove subtraction of 24h from comparison|admin summary `expired !== active`, line 194 → 186; C2|
|reject-future-access|Add timestamp<=now condition to the actual grace predicate|admin summary `expired !== active`, line 140 → 140; C3|
|reject-legacy-null|Actual open-entitlement null fallback true→false|admin summary `expired !== active`, line 145 → 145; C4|
|skip-incident-flush|Actual `confirmTelemetryDelivery` final await path returns true instead|HTTP status remains 200; then `flushes` 0 !== 1, monitor route line 428 → 386; D2|

The final fault must be scoped to the complete named function, because identical flush-return text also occurs in the paid-access and check-in helpers. The descriptor provides that complete function and hash, and independent static reconstruction used it. The C4 fault likewise replaces only its named helper, preserving the legacy profile's sibling null fallback. The five prospective files parse; this is no claim that TypeScript semantic checking or actual red execution passed.

Main should require exact-one selected clean → intended red → own byte-exact restoration → exact-one clean for each, then the unchanged cohort command in `commands.json` before/after as appropriate. No test runner or fault was executed during this review.

## Retained safety and held F findings

All five held F statements remain exact. Static source/test inspection supports the narrow findings: the seven-character healthy candidate and invalid synthetic digest do not reach the purported healthy local-lookup branch; cap and concurrency bounds derive oracle/workload from their own production constants; Keychain argv is fabricated by the injected callback; the oversized-body row is also parser-invalid and accepts a broad rejection set. Those are held concerns, not repaired or newly executed mutation proof. Their other assertions remain valuable and no declaration is removed for being partially weak.

Unchanged survivors preserve provider-status versus entitlement distinctions; canonical conflict and paid-access receipt fallback; missing and partial receipts; false-flush retry; production-required start/end check-ins; auth-before-work and limiter ordering; aggregate privacy; independent route timeout exports; asynchronous fulfillment-before-other-branches; true/false retry flags; destination limits and isolated failures; default dispatcher dependency forwarding; explicit Slack/no-DB ownership; operator classification gates and metadata CAS inputs; legal declaration parsing; no-cookie submission/rate isolation; immutable acceptance and replay; real migration rollback and role denial; matching ownership; original submission timing; paid/refund/provider-confirmation gates; queue acknowledgment versus confirmed sent; whole-claim validation and settlement-failure handling.

The public declaration/receipt SQL tests use real migration text and PGlite APIs with test-owned minimal surrounding schema and RPC adapters. They do not prove deployed grants, provider truth, production database state, or two-session concurrency. These 31 unchanged declarations were fully read; this review does not claim independently rereading every line of all seven underlying public/trial SQL migrations or every untouched public-delivery owner. Their retained bodies and all author-pinned source bytes were verified. No retirement is inferred from a historical migration or operator-only entrypoint.

## Independent production/read depth, caller history and CI

Independently read in full this pass: subscriptions; admin-user-summary; trial-access-projection; trial-policy; payment-integrity; payment-monitor route; billing reconcile route; observability payment-server and payment-server-core; admin users route; trigger-payment-monitor CLI; classify-payment-monitor-paypal-test CLI. The classified billing view migration was also read in full. These are the complete operative owners for every proposed cut and the applicable billing/telemetry dependencies. The summary path's trial policy is bypassed for these selected inputs but was read to distinguish retained trial cases.

Additional supporting reads: payment-integrity-runtime 1–225 (dynamic factory, actual provider/local construction and reporter); PayPal trial collection-start 1–90; monitoring runbook 40–82,155–177,210–252; trusted declaration-operations section109–156; CI150–172; relevant package native/operator entries; complete server-only register and vercel config; installed PGlite declaration API780–848 and NextResponse.json90–101. Broad provider SDK internals, remaining payment runtime implementation, all public-delivery source/SQL internals, browser implementation and external operational state receive no independent full-read credit. The 55-file hash verification is provenance/drift evidence, not 55 whole semantic reads.

Read-only symbol search confirms canonical helper use in subscription/current-app/paid-access paths (`subscriptions.ts:146,174,198,269,303`) and summary through admin users:99; monitor HTTP POST uses the dynamically imported runtime; daily reconcile imports actual `runPaymentIntegrityBranch` and invokes it at161. CLI entry guards and runbook/package commands keep trigger/classifier reachable. Nothing becomes orphaned. `1550ae7c` (#461) introduced current 24h access enforcement; `960070f1` (#595) added the composed admin badge with explicit grace alignment; `e47b740e` (#337) hardened payment recovery/monitor receipts. Commit metadata and relevant changed-file summaries were read locally, without assuming historical verification applies to this branch.

All 13 tests are top-level `.test.ts`. Current package `test:node` includes them with server-only register + tsx; CI's top-level Node contracts step invokes that command. The register stubs only the Next `server-only` marker, not billing access or telemetry implementation. Separate browser/provider/SQL lanes are not being replaced by this packet. No current full-suite, coverage, deployment or applied-cut credit is claimed here.

## Deliverables and stop condition

- `/tmp/test-audit-billing125-independent-preservation.md` — this judgment and limits.
- `/tmp/test-audit-billing125-independent-static.cjs` — independent static-only checker (stdout JSON, no repository mutation or subprocess API).
- `/tmp/test-audit-billing125-independent-static.json` — exact phase/readset/artifact/119 survivor/control-frame pins and attestation.
- `/tmp/test-audit-billing125-independent-receipt.json` — final report/tool hashes and explicit read-depth/decision record.

The proposal remains conditional on main's runtime proof. This review changes no product decisions or repository files and does not authorize publication or live operations.
