# Welcome source/config reassessment — main-only proposal

**41 complete declarations: R19 / F18 / C2 / D2. Four supported conditional removals, 41→41→37.** No repository changes, runners, production imports/execution, compiler, mutations, browser, network, providers, database, env files or secrets. Static AST parsing and /tmp staging only. Main retains review, execution and coverage/CI authority.

## Scope and evidence depth

Full tests and every fixture/hook/body: `welcome-email-display.test.tsx`20; `welcome-plan-opening-bridge.test.ts`3; `welcome-activation-return.test.ts`7; `welcome-activation-outcomes.spec.ts`11 AST. Dynamic provider and recovery-code loops keep their existing rows; no row/declaration credit inflation. Exact callbacks, file/body SHA256, individual R/F/C/D and concrete faults are in `test-audit-welcome-static-full-ledger.{json,md}`.

Full owners: `src/app/welcome/page.tsx`617 lines, `welcome-client.tsx`918, `checkout-return-analytics.tsx`129, `checkout-recovery-panel.tsx`75, `return-recovery.ts`100; `src/lib/auth/checkout-{activation-outcome,recovery-classification}.ts`, `password-policy.ts`; `src/lib/paypal/welcome-url.ts`. Current API/error class declarations and Stripe return URL builder were inspected as excerpts, not whole billing implementation. Scope does not claim upstream billing/provider eligibility proof: the kept route harness stubs these dependencies and executes the actual WelcomePage assembly/classification.

Extra sibling bodies inspected, not whole-file read credit: acquisition-funnel-tracking's checkout return suppression callback; auth-post-checkout-routes' welcome activation source callback. The former executes the suppression helper but cannot replace the server-purchase gate; the latter still lacks actual redirect-only success screen proof. No cuts proposed there.

Initial navigation reread the already-audited CI workflow parser/config group and representative static reports. No new deletion recommendation arose merely from their source reads or test-local parser fixtures. These are not counted in the chosen41 semantic denominator. The welcome group is coherent but smaller than the suggested200 ceiling; evidence did not support inflating it into a larger deletion batch.

## Current reachability / history / CI

`/welcome` remains a public admitted middleware route. Stripe's current checkout session builder uses `/welcome?session_id={CHECKOUT_SESSION_ID}` unless contextual completion supplies another return URL. PayPal's current URL owner encodes `provider=paypal`, `purchase=one_time`, token and allowed terminal return state. The page imports/render-calls actual WelcomeClient and verification/recovery adapters. No retirement or lack-of-traffic claim.

Commit `8a5e42c2` (#559, September15) explicitly added actionable activation outcomes after denied trials, including server preflight, safe terminal/pending panels, input retention and bounded polling. Its retained `plans/trial-activation-errors/{plan,recovery-audit}.md` documents those contracts. Earlier one-time and trial changes include `e47b740e`, `12619247`, `318cf157`. The plan-opening bridge cites founder-approved destination choreography; its private-name checks need repair, not deletion without a real redirect fixture.

Package `test:node` discovers all three native files. Current CI quality-node invokes it. The browser file is `@ci checkout recovery`, discovered by default Chromium and the CI smoke `--grep @ci` command when the path/live-secret gating admits that job. The isolated config prepared below loads no env file and starts no app server; this suite's existing beforeAll serves its own local esbuild fixture, with provider/auth/observability effects stubbed. No actual browser run was made here.

## Exact candidate union

**C1 `welcome-email-display.test.tsx:44` — terminal PayPal activation polling reports a typed payment failure without the token.** Primary keeper: `welcome-activation-outcomes.spec.ts:234` — PayPal poll timeout replaces the spinner with status-retry feedback. Existing fixture uses providerpaypal/modepending, fixed fixture-token, paypalLivefalse, fifteen pending responses, then six additional seconds. It executes the exact actual timeout call inspected by the source donor. Change existing capturePaymentFailure stub from no-op to an argument recorder; it must not construct expected payloads. Append an exact one-element payload assertion covering all13 fields: signal customer_payment_error_observed, providerpaypal, stagepaypal_activation_status_poll, errorFamilytimeout, commerceKindsubscription, originbrowser, methodpaypal, truthunknown, livefalse, isInternalTestfalse, retryable"true", sourcewelcome, providerReferencePresenttrue. Exact object equality forbids extra token/private fields. All original timeout/poll-count/retry assertions remain. No new owner calls or inputs.

**C2 `welcome-email-display.test.tsx:58` — welcome labels the account email as Chaarlie-E-Mail.** Primary keeper: browser:113 — email send failure keeps password input and allows a successful resend. The existing initial `/welcome` render reaches the one actual account-email label, with alex@example.com, before its current password/send interactions. Append `getByLabel("Chaarlie-E-Mail", {exact:true}).toHaveValue("alex@example.com")` and old rendered label absence; all failure/password/resend/request-count assertions stay. No fixture input changes. Source has one such label and no other existing old-label branch; the meaningful user label now has rendered proof.

**D1 `welcome-email-display.test.tsx:172` — a paid Stripe verification failure preserves the revoked return state.** Existing keeper: native:204 — Stripe verification failures keep paid one-time returns pending and classify terminal failures. It already throws typed checkout_one_time_charge_revoked, rereads a payment+paid provider session and asserts actual `paidPage.props.oneTimeReturnState === "revoked"`, plus pending component/email. Donor only checks private helper signature/type annotation and error code string. It does not behaviorally test the default support_needed outcome. The actual revoked mapping assertion is stronger and survives helper/type alias rename. No transfer or source deletion.

**D2 `welcome-activation-return.test.ts:197` — the preflight guard is sensitive to an in-memory bypass.** Existing keeper: native:188 — persisted Stripe trial denial renders before account writes or destination reads for signed-in and anonymous returns. Donor rewrites actual source to if(false) and expects bypass behavior. The adjacent ordinary keeper already executes unmodified source with the same persisted denial, observes the real recovery component/code and exact empty side-effect log for both auth states; removing the guard breaks it. The calibration is moved to a parent-only source fault control, not another permanent test of wrong behavior. Delete only this callback, Options.bypassStripePreflight and test helper's source.replace conditional. Always transpile original source. All other native callbacks/fixtures stay byte-identical. No production change.

## Rejected apparent consolidations / remaining F

- **Hash/privacy source guard stays:** every current real server PayPal fixture uses literal `token`. Transferring its expected hash into one such result would still pass if `.update(token)` were replaced by `.update("token")`. The donor catches that meaningful token-dependence loss. No new input allowed; no whole cut.
- **Paid-return source predicate stays:** current native route keeper covers recovered payment+paid and non-payment sessions, but not recovered payment+unpaid. Removing only the payment_status conjunct could evade the supposed stronger keeper. The source guard also freezes replaceable local identifiers, so classify F and retain the independent paid-only contract.
- **Stable polling dependency stays:** fixture creates activationSource once. Internal WelcomeClient rerenders retain the same prop object. The fifteen-poll keeper does not prove resilience to a parent recreating the object.
- **One-time pending/status/retry/URL/account-missing cases stay:** selected browser source never supplies purchaseKind one_time and stubs opening/analytics effects; similarly named PayPal subscription pending checks are not owner proof for the one-time state machine.
- **Separate provider email stays:** no selected existing fixture supplies unequal/equal provider email values. Copying source predicates into a keeper would just relocate the brittle guard.
- **Opening bridge stays:** selected actual browser fixture never supplies redirectTo and stubs destination frames/markers. It cannot prove approved plan-bereit/start choreography or no-JS link delivery.
- The two source-only one-time copy callbacks remain R as cheap independent public-byte guards; changing approved German reassurance/progress wording fails them. They do not prove rendering.

F means preserve and repair; it does not mean deletion-ready. No fixes for these18 were staged, no new scenarios created, and no new product intent inferred.

## Artifacts / static verification

- `/tmp/test-audit-welcome-static-full-ledger.md` and `.json`: all41 verdicts/hashes.
- `/tmp/test-audit-welcome-static-candidates.json`: complete donor/keeper bodies, union and evidence.
- `/tmp/test-audit-welcome-static-complete.diff`: complete proposed transfer/cut diff.
- `/tmp/test-audit-welcome-static-edit.cjs`: exact-cwd main-only check/before/transfer/cut.
- `/tmp/test-audit-welcome-static-edit-plan.json`: all4 test guards and11 owner/dependency guards; every prospective phase/declaration hash.
- PlanSHA256 `59139f5eab033dc087cfbc2067611b928a4ebae18e3d3e3cdff5d77a293ee657`.
- `/tmp/test-audit-welcome-static-staging-KxP8jA`: before/transfer/cut full proposed file bytes.
- `/tmp/test-audit-welcome-static-controls.json`:5 actual-source fault recipes: timeout stage, added raw token, rendered old label, revoked mapping, preflight bypass.
- `/tmp/test-audit-welcome-static-playwright.config.cjs`: isolated no-env/no-webServer Chromium config, existing self-contained browser spec only.

Static check passed:41→41→37; all prospectiveTS/TSX parse; unrelated callbacks preserved; five owner faults have unique current anchors and syntactically valid TSX; editor/config JS syntax check passed; check mode confirms all15 current guard hashes. No typechecker/runtime/browser/control execution; no claim of green tests. Recording payload is the only browser beforeAll support change. Mutation source strings remain descriptors, not applied files.

Main-only validation from exact task cwd:

```sh
node /tmp/test-audit-welcome-static-edit.cjs check
node --import ./tests/server-only-register.cjs --import tsx --test tests/welcome-email-display.test.tsx tests/welcome-plan-opening-bridge.test.ts tests/welcome-activation-return.test.ts
./node_modules/.bin/playwright test --config /tmp/test-audit-welcome-static-playwright.config.cjs
```

Run baseline before transfer. Main may then apply `transfer`, run both focused windows and serial actual-source controls with finally byte restoration, apply `cut`, repeat appropriate focused checks and campaign coverage gates. `before` is a read-only phase check. All staged outputs parse and all guards are rechecked before first write; editor saves receipt/original bytes and uses per-file atomic rename. Main owns formatting after cut or an intentional rebase of the stage hashes. Native3files go30→26 AST; browser remains11 AST. Counterpart/whole-branch review remains parent-owned.
