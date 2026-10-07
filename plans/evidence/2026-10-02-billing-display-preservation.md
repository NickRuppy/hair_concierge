# Billing display leaf preservation review

**Verdict: no deletion-induced preservation gap found.** The change removes three direct AST tests, the unreachable formatter and its private date predicate, and a zero-credit Boolean alias. It does not remove the current membership read model, profile display path, date formatter, or one-time access decision.

## Exact removed layer

- `formatBillingMembershipStatus` and its private `isFutureDate` were removed from `src/lib/billing/display.ts` (original lines 7 and 41). The formatter translated a raw subscription/fallback status and embedded a paid-through date in one string.
- The three direct declarations removed from `tests/billing-display.test.ts:6,20,34` only call that formatter: future canceled label, expired cancellation, and fallback `active/past_due/incomplete` labels.
- `hasCurrentOneTimePurchaseAccess` was removed from `src/lib/billing/purchases.ts:21`. It was exactly `resolveOneTimePurchaseAccessState(entitlement) === "active"`; its only test assertion was removed inside the retained enum-state test, with zero AST-test credit.

Exact searches after the edit find none of the three removed symbols in source, app, script, package, or current test callers. `formatBillingDate` remains exported and is still imported by `src/app/profile/page.tsx:33`.

## Live replacement path and guards

The running profile does not call the deleted raw-row formatter. It displays `membershipStatusLabel(membershipState)` at `src/app/profile/page.tsx:2220-2223` and the independently retained `formatBillingDate(membershipState.renewalAt)` at `:2243-2246`.

The state is built from subscription/provider/date facts in `buildMembershipManagementState`:
- `src/lib/billing/plan-change.ts:54-65` produces `canceled_at_period_end`, preserving `cancel_scheduled_at ?? current_period_end` as `renewalAt`.
- `:67-72` produces `payment_problem`; later branches distinguish legacy/catalog/pending/reconciling/manageable states.
- `src/app/profile/page.tsx:110-116` maps those typed state kinds to the live German status labels. It intentionally shows the date separately under the common `Nächste Abrechnung / Laufzeitende` row.

The independent semantic owner test `tests/billing-plan-change.test.ts:110-158` asserts the manageable, payment-problem, canceled-at-period-end, scheduled-date, manual-grant, and legacy state outcomes. This protects the actual enum/date derivation. I found no dedicated profile-render assertion for the label map itself; that is a pre-existing UI-test coverage limit, not a contract lost by deleting an unused formatter.

For one-time access, `tests/billing-one-time-purchases.test.ts:75-104` remains and directly asserts `resolveOneTimePurchaseAccessState` returns `active` only for fully confirmed/delivered paid evidence and returns `paid_pending` / `revoked` for the listed failures. Actual consumers call that resolver directly: activation (`src/lib/billing/personal-plan-one-time-activation.ts:195,222,356,379,520,540`), first access (`personal-plan-one-time-first-access.ts:60`), monitoring (`paid-access-monitor.ts:293,380`), enrollment (`personal-plan/enrollment.ts:216`), welcome (`src/app/welcome/page.tsx:598`), and recovery (`scripts/billing/one-time-recover.ts:621`). The Boolean alias could not independently catch a resolver defect.

## Recorded focused proof and history

The recorded native before/after command is identical and covers `tests/billing-display.test.ts`, `tests/billing-one-time-purchases.test.ts`, and `tests/one-time-paid-pending-ux.test.ts` with Node, server-only registration, tsx, and c8. `/tmp/test-audit-billing-display-before/tests.tap` reports 20 tests, 20 pass, 0 fail; the after TAP reports 17, 17 pass, 0 fail. The three before-only subtests are precisely the three formatter declarations in `/tmp/test-audit-billing-display-cuts.json`; it also records the two source leaves and zero added declarations.

`cf167278` and `3e80bb77` introduced/expanded the formatter while membership lifecycle work was active. A prior plan at `plans/2026-07-16-billing-plan-change-reliability.md:129` explicitly kept it out of that earlier scope; current zero-caller closure, rather than that historical scope note, supports this later deletion.

## Limits

I did not run tests, mutations, or external operations. The recorded TAP proves the supplied focused suite only. No static review can exclude undocumented runtime reflection absolutely, but no barrel, namespace import, dynamic import, operator script, or public SDK surface was found for the deleted symbols. The only possible adjacent concern is the pre-existing absence of a direct profile-render test for `membershipStatusLabel`; this cleanup neither removes its source nor changes its enum/date inputs.

## Later full-run correction

The focused static no-gap verdict above missed incidental execution of the remaining live formatBillingDate through the deleted formatter. Full268 coverage showed zero hits. Main restored that independent German date/empty-state contract with one dedicated existing-file declaration; net billing-layer reduction is two, and current campaign net267. Native focus18/18 and two actual date-locale/placeholder faults are red then restored-green; focused c8 has3/3lines and7/7functions, real formatter4hits. The missing full-profile renderer remains a pre-existing integration limit. See final268 diagnostic for exact evidence.
