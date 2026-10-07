# PayPal trial: creation-time collection start

> Scheduling assumption superseded by [the verified noon repair](paypal-trial-scheduling-verification.md). D1–D3 below remain the customer contract; the prior claim that a midnight provider start guarantees same-date collection was disproven in production.

## Contract and decision coverage

Status: confirmed. Scope: make PayPal trial activation verifiable by fixing the collection date when checkout is created, instead of patching `start_time` after approval (PR #568's patch approach was proven dead by webhook WH-3V548547RB010763M: PayPal applies the patched start but never recomputes `next_billing_time`). Stripe is unchanged. No offer-page surface, timing, or user-visible feedback changes; the confirmation email's PayPal trial-end sentence is corrected so the legal record matches the ruled contract.

Confirmed with Nick (2026-09-15 evening, one by one):

- D1 — **The PayPal trial ends on the frozen collection date.** `original_trial_end_at` for a PayPal enrollment is the collection start S itself, not approval + 7 days. The trial is "mindestens 7 Tage" (8–9 days for prompt approvals, more than 7 in every case); trial end and first charge date coincide; cancellation runs to S. Rejected alternative: keep approval + 7 days and let every PayPal customer spend 1–2 days in the "Zahlung ausstehend" bridge state.
- D2 — **Keep the 24-hour approval window.** S = next UTC midnight strictly after freeze + 8 days (= `trunc_utc(freeze) + 9 days`), which covers every approval inside the window. Rejected: shortening the window to 3–6 h to cut one free day, because late approvers would receive a PayPal "subscription cancelled" mail mid-purchase. Add a read-only script measuring tap→approval latency so the window can be revisited with data.
- D3 — **Offer-page copy stays "7 Tage kostenlos".** It remains true as a minimum. The exact date is already disclosed on the PayPal approval screen, in the confirmation email, and in the profile.

Inherited from evidence or contract: PayPal bills in a daily batch (~10:00 UTC) keyed to the UTC date of `start_time` and can schedule it earlier in the day than the start (#568 evidence); `paypal_checkout_intents.expires_at` = creation + 24 h; attempt `request_expires_at` = freeze + 72 h; §§187/188 BGB day-after logic (#568 ruling); AGB already say the exact Testende and first payment date are named at conclusion and in the confirmation.

Implementation defaults (non-consequential): keep helper names where semantics survive; ceil-to-midnight semantics for `paypalTrialCollectionStart` so legacy second-exact trial ends keep today's value; the SQL window twins inline the ceil expression (`date_trunc('day', end − 1 µs) + 3 d`) instead of a shared helper, because the access harness has no `private` schema; legacy in-flight attempts (frozen before deploy, `start_time` = freeze + 7 d) are blocked as `trial_checkout_closed` so the customer retries without consuming the trial.

Open consequential assumptions: none. Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick's rulings D1 ("a for sure, needs to be"), D2 ("let's be safe here and pick the 24 hours, but also let's monitor"), D3 ("Obviously, we leave it as it is") on 2026-09-15, following the handoff from the #568 session. Internal revalidation: worktree `paypal-trial-creation-start` on `codex/paypal-trial-creation-start` from `origin/main` a54ee67a (verified equal to the fetched tip).

## Contract in one place

```text
F  = freeze time            = request_expires_at − 72 h
S  = frozen trial end       = trunc_utc(F) + 9 days   (a UTC midnight; whole seconds by construction)
A  = approval time          (A ≤ intent creation + 24 h ≤ F + 24 h  ⇒  A + 7 d < S always)
PayPal subscription: start_time = S at creation; never patched.
Activation verifies: status ACTIVE ∧ start_time == S ∧ S ≤ next_billing_time < S + 48 h ∧ A + 7 d ≤ S ∧ S > now.
Stored: original_trial_end_at = S. Collection start = ceil_utc_midnight(original_trial_end_at) = S. Window end = S + 2 d.
Stripe: unchanged (trial end = A + 7 d exact; ceil of a non-midnight value = previous floor + 1 d, so all legacy math is preserved).
```

## Target map and ordered tasks (as built)

1. **Helpers (TDD)** — `src/lib/paypal/trial-collection-start.ts`: `paypalTrialCollectionStart` is ceil-to-UTC-midnight (aligned input returns itself; second-exact legacy input unchanged); new `frozenPayPalTrialStart(requestExpiresAt)` replaces the retired `provisionalPayPalTrialStart` (freeze = expiry − 72 h; S = next UTC midnight strictly after freeze + 8 d). Tests: `tests/paypal-trial-collection-start.test.ts` incl. the 24 h-window property over sampled freezes.
2. **Checkout** — `src/lib/paypal/trial-checkout.ts` creates the agreement with `startTime = S`.
3. **Admission** — `src/lib/paypal/trial-account-admission.ts`: reserved path uses `trialEnd = S`; late approval (approval + 7 d > S), past S, or past start → block + `trial_checkout_closed`; `start_time` = retired provisional start (pre-deploy attempts) → block + `trial_checkout_closed`; any other start mismatch → `trial_reconciliation_required`; patch step deleted; batch verification accepts `S ≤ next_billing < S + 48 h`. Active path accepts a stored end of S or the legacy approval + 7 d and returns the stored value. `src/lib/billing/trial-admission.ts` threads an optional `originalTrialEndAt` (7–10 d after authorization) into the RPC only when given, so Stripe's call is byte-identical. Tests: `tests/paypal-trial-activation.test.ts` (27 cases).
4. **SQL contract (migration `20260915190000_paypal_trial_frozen_end`)** — the table's exact-seven-day CHECK becomes `trial_enrollments_trial_end_bounds` (≥ 7 d, ≤ 10 d); `admit_trial_enrollment` gains `p_original_trial_end_at` (validated, replay-safe, `invalid_state` on a foreign end; NULL keeps authorization + 7 d); `trial_enrollment_has_access` uses the ceil window (`date_trunc('day', end − 1 µs) + 3 d`). Tests: `tests/billing-trial-identity-rights.test.ts` (admit + bounds), `tests/billing-trial-access-postgres.test.ts` (aligned window closes at +2 d, legacy at next midnight + 2 d, SQL = TS).
5. **Paid-recovery gate (migration `20260915190100_…_recovery_gate`)** — the three recovery functions use the same ceil window; separate file so harnesses without the recovery tables can load the contract migration alone. Test: `tests/paypal-trial-paid-recovery-postgres.test.ts` (recover_unpaid opens at +2 d for an aligned end).
6. **Expiry clock + report (migration `20260915190500_…_frozen_start_expiry`)** — `private.paypal_trial_frozen_start()` (SQL twin), `claim_paypal_trial_candidate_expiry` keyed to it, and `report_paypal_trial_approval_latency()` (service_role, aggregates only). Tests: twin equality over fixtures, candidate `start_time`, report shape. Script: `scripts/billing/paypal-trial-approval-latency.ts`.
7. **Notices** — `src/lib/billing/trial-required-notices.ts`: snapshot validator allows 7–10 d for PayPal (Stripe stays exact); PayPal confirmation says "dauert mindestens 7 Tage und endet am {S}", first payment "für den {S}". Reminder and management/restore already resolve to S through the helper. Test: `tests/billing-trial-required-notices.test.ts`.
8. **Verification + review + ship** — focused suites, `npm run test:node`, `npm run ci:verify`; Codex whole-branch review (read-only); `/ship`. Migrations applied to prod after merge (Supabase MCP needs an authorized interactive session).

## Verification, risks and rollback

Commands: `node --import ./tests/server-only-register.cjs --import tsx --test tests/paypal-trial-collection-start.test.ts tests/paypal-trial-activation.test.ts tests/paypal-trial-checkout-attempt.test.ts tests/paypal-trial-management.test.ts tests/paypal-trial-management-postgres.test.ts tests/billing-trial-policy.test.ts tests/billing-trial-access-postgres.test.ts tests/billing-trial-paid-recovery-postgres.test.ts tests/paypal-trial-paid-recovery-postgres.test.ts tests/paypal-trial-expiry.test.ts tests/billing-trial-required-notices.test.ts tests/trial-reminders-delivery.test.ts`; then `npm run test:node`; then `npm run ci:verify`.

Risks: (a) an already-activated legacy PayPal enrollment with `original_trial_end_at = A + 7 d` — preserved by ceil semantics and the dual-accept in the active path; (b) pre-deploy frozen attempts — blocked as closed, customer retries; (c) PayPal reporting `next_billing_time` exactly at S — accepted by the `≥ S` bound; (d) the SQL helper must be `IMMUTABLE` and `SET search_path=''` like its neighbours.

Rollback: reverting the PR is clean only while no PayPal enrollment has been admitted under the frozen end. Once one exists, the base code's active-path check (stored end must equal authorization + 7 d) and its notice validator reject that enrollment, so a rollback must keep the frozen-end readers (active-path dual-accept, 7–10 d notice validation, ceil window) and disable only agreement creation; the migrations themselves stay in place (the admit RPC's new parameter defaults to NULL, legacy window values are unchanged).

Codex review outcome (2026-09-15): the reviewer's first pass found the management transaction window could start in the future with a frozen end (fixed: ten days before the stored end), the SQL frozen-start twin depended on the session time zone (fixed: UTC wall clock before day arithmetic, twin test runs under three zones), and that one rounding rule would have shortened the bridge for a Stripe end sitting exactly on a midnight (fixed via the reviewer's proposal: `trialFirstCollectionWindowEnd` and the four SQL twins keep exact-seven-day contracts on their original window; only frozen ends, which are always more than seven days out, close at end + 2 d). Stripe behaviour is therefore unchanged for every input.

Rollback also covers in-flight agreements: a PayPal agreement created with start_time = S but not yet approved would be rejected by the base admission code as `trial_reconciliation_required`, so a revert must either keep the frozen-end admission path or drain pending frozen-start agreements first (the candidate-expiry job neutralises those whose 24 h intent has expired).
Post-deploy: Nick cancels test sub `I-CM6TVHEJ6U9R`; run one real PayPal trial end-to-end; after the first cohort, run the latency script; release the QA identity restriction when done.
