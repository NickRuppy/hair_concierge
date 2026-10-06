# Independent Reactivation2 preservation review

**C1: PASS, conditional on main's intended owner-fault proof. C2: PASS, conditional on main's intended owner-fault proof. No semantic preservation blocker found.**

Reviewed only final proposal `/tmp/test-audit-reactivation83-proposal-Zzh1n4`, manifest SHA256 `87ceba4ac9d6819ea70ad95daaead398035d3b383742fc8c892e6a6b885ac0e3`. Repository was read-only. No tests, owner imports, TypeScript parser/typechecks, browser, provider/DB or environment-file operations were performed. Main's reported native 89-pass baseline is context, not independently rerun evidence.

## C1 — retained identity and password capability

Donor `tests/reactivation-retained-account-activation.test.ts:288`: **duplicate completed webhook retains account and never grants initial-password capability**.

Primary keeper at original line 223: **Stripe duplicate webhook safely repeats completion of the same bound reservation**.

Complete original union is retained: first userId equals the fixed `00000000-0000-4000-8000-000000000002`; second userId equals the same id; second `canSetInitialPassword === false`; one billing row; one Auth user. The keeper additionally retains actual reservation status `completed`. Both existing calls remain, with their awaited results bound to variables; no new owner call, fixture or input is introduced.

The fixture is not byte-identical between callbacks because the donor explicitly assigns `reservation.status = "completed"` between direct calls. That assignment is inert under current owner behavior, rather than an independent state case: `ensureCheckoutAccount` calls `markMembershipReactivationCheckoutCompleted` before returning (checkout-activation:478–491), and the real completion helper updates the matching provider/user/reservation to `completed` (checkout-reservations:206–230). The fixture applies that actual update and its filters, so the first keeper call has already established the state manually assigned by the donor. The source resolver explicitly accepts completed reservations together with provider_created/reconciliation_required (checkout-activation:1191–1196). All other consumed identity/customer/context/Auth/payment/subscription fields are the same freshly constructed fixture. The fixture Auth user has the matching SHA256 activation marker and no password_initialized_at, so removing only the retained-account exception exposes the capability.

`handleCheckoutSessionCompleted` is an actual unchanged direct delegate, returning `ensureCheckoutAccount(session,deps)` at webhook-handlers:365–370. This is proof at that delegate boundary, not an HTTP webhook/signature/event-claim test. The real HTTP route invokes it at api/stripe/webhook/route:462; welcome/auth/freemium callers independently use the same owner. No public seam is retired.

Control C1 changes only `canSetInitialPassword = !retainedAccount && canSetPasswordForAuthUser(...)` to the actual helper result. The fixture's matching marker makes that true. Identity and row counts remain valid, while the retained keeper's explicit second-result false assertion is the intended first failure at transfer/cut line **229**, `strictEqual`. Prospective complete owner hash `7b566fd8e06bf83639ca04d5523ac3fda6b6ca32aafb838dadc19f0c97bcff07` was independently reconstructed from current source bytes. This has not been executed here.

Relevant history supports redundancy rather than retirement: `26419861` (#539) introduced retained-account safety; `0903adf0` (#541) subsequently made completion server-owned inside ensureCheckoutAccount and introduced the current duplicate delegate keeper. I read the relevant #541 source/test diff. Its added real completion makes the earlier manual assignment redundant.

## C2 — billing ownership before profile access

Donor at original line 440: **late conflicting billing owner cannot grant access through the profile mirror**.

Primary keeper at original line 418: **competing subscription insert is adopted only for the same immutable account**.

The existing keeper already iterates exactly `[userId, "other-owner"]`, constructing a fresh fixture in each iteration and making one ensureCheckoutAccount call in each mutually exclusive branch. In the existing other-owner iteration, the race closure pushes exactly the donor's three fields: provider `stripe`, subscription `sub_reactivation`, owner `other-owner`. The hook executes immediately before the insert and is then cleared. Both callbacks ignore the push return value. No state from the successful first iteration survives into the second fixture.

All donor assertions are retained in that existing conflicting-owner branch: rejection code `checkout_ownership_conflict`, full profile deep equality against a shallow snapshot taken before activation, and exact empty writes array. The shallow snapshot is sufficient because every original profile field is primitive (`id`, `email`, `stripe_customer_id`, `history`), and the production patch writes primitive fields. The keeper's existing billing row count, immutable owner and Auth-user count assertions are untouched. The same-owner branch, literal loop rows and existing owner call count remain unchanged.

The fake does not implement the security rejection: it inserts the conflicting row on the hook and returns a generic unique-constraint `23505`; actual `upsertRetainedBillingSubscription` re-reads that row and compares `owner.user_id` against `input.user_id`, throwing the real ownership conflict before profile update (checkout-activation:1254–1303). Actual `findBillingSubscriptionByProviderId` filters provider and subscription (billing/subscriptions:116–129). Actual profile update is a compare-and-set on canonical user/email/old customer (checkout-activation:1232–1251), so profile preservation and zero writes are observations of a real owner ordering decision at the injected storage boundary. This is not proof of PostgreSQL isolation or RLS; those retained SQL tests remain separate.

The final C2 control is the corrected **single ordering fault**. Its one contiguous source replacement changes both conditions:

- earlier `!retainedAccount && !trial` becomes `!trial`;
- later `retainedAccount || trial` becomes `trial`.

For the retained nontrial fixture, the existing profile write therefore executes exactly once, before billing ownership. On the first same-owner iteration, the profile CAS succeeds, the insert race is adopted for the same owner, and no second stale-CAS profile write runs. Thus the existing success assertion should survive. On the second iteration, the early profile write changes customer and grants subscription mirror fields; the actual billing owner check still throws the expected code. The transferred whole-profile equality then fails at transfer line **438** / cut line **427**, `deepStrictEqual`; the zero-write assertion immediately following independently retains the donor's second observation.

I independently verified that the corrected source block changes exactly those two conditions and nothing between them, and reconstructs prospective owner SHA256 `2ff27caf78b782a67bff7fee000c60382849012c8ab844e8bb7a77058e084409`. The superseded one-condition/double-write fault is not used. It would fail the first same-owner row at a different assertion and cannot establish this preservation claim. Runtime proof must reject any such earlier or unrelated failure.

## Independent static conservation

`/tmp/test-audit-reactivation83-independent-static.json` records these checks:

- Final manifest hash matches the requested value; all 67 current readset hashes match.
- All 27 complete phase snapshots match their hashes. Exact keeper substitutions reconstruct transfer; deleting exactly two donor declarations plus their adjacent newline reconstructs cut. No other bytes change.
- Independent lexical declaration-start recount and reconciliation of every inventoried declaration/hash give **83 → 83 → 81**. No TypeScript parser/AST check was run in this review.
- **79 unrelated callbacks remain byte-identical.** Only the retained-account activation test file changes.
- The entire metadata suite is byte-identical, including held F declarations at original lines 470/490/522. No F repair or deletion credit is included.
- The full PostgreSQL test file remains byte-identical, including all 18 declaration sites. The browser recovery spec remains byte-identical, including all six declaration sites.
- Both control anchors are unique within the complete current `ensureCheckoutAccount` function (scope SHA256 `053b42899beeb1fc15fb48d3419c58cc54c9344bb757c13e6c0b81e8cc7e83c1`), and exact prospective full-owner hashes/phase oracle lines reconcile.

## Read depth and remaining gates

I read the entire changed test file (all 15 declarations, all local fixtures/helpers/tables), both full donor and keeper bodies in each prospective phase, the complete operative ensureCheckoutAccount function, the complete retained-account resolver/profile CAS/billing adoption functions, subscription/session/payment guards, password-marker/Auth lookup helpers, measurement/link helpers, actual completion helper, direct webhook delegate and full checkout-recovery module. I read the relevant live HTTP caller slice, current caller searches, CI/package routing and focused history diff. Larger checkout-activation/webhook modules were not wholly reread outside those branches. Installed SDK implementations and SQL migration bodies were not independently audited; tests use local injected transports. Other eight test files received byte/hash preservation checks and their prior ledger was consulted; this review does not claim a fresh semantic read of all 83 cases.

Native routing remains package.json test:node for the eight .test.ts files, with the existing six-browser spec explicitly in test:playwright:contracts. CI invokes those owners. Main must execute the two intended actual-owner controls against transferred keepers, verify exact assertion failures and restoration, then run the native cut cohort and campaign gates. No browser/SQL/provider proof is inferred from these two helper/delegate transfers.

**Final verdict: C1 PASS conditional; C2 PASS conditional. No additional cuts or tooling prepared.**
