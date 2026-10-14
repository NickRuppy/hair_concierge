# C3 semantic proof correction from independent review

The frozen proposal and its hashes remain unchanged. This addendum corrects the explanatory claim, with no new calls, fixtures, inputs, assertions or operator controls.

The `plain active subscription reports active` keeper in tests/admin-user-billing-summary.test.ts:135 admits +420h. That assertion alone does **not** imply admission at the donor's +24h for every shifted monotonic lower threshold. A mistakenly shifted lower threshold between +24h and +420h would pass that keeper but reject the donor.

The preserved union also includes `active entitlement within the 24h expiry grace still reports active` in the same file:188, admitting −12h at assertion194. For the actual finite-date monotonic timestamp >= now − grace predicate, admission at −12h requires admission at +24h. `EXPIRED_ENTITLEMENT_GRACE_MS is exactly 1 day, matching the SQL grace window` in tests/billing-subscriptions-access-grace.test.ts:39 additionally retains the independent literal24h constant assertion. Both whole callbacks are byte-identical in all phases. C2's keeper is this same retained −12h summary callback; C2 removes only its separate direct helper duplicate.

Thus C3 preservation uses the existing +420h active/period projection, existing −12h active admission, and explicit24h constant together. It does not claim one future sample proves arbitrary future implementations or a caller-keyed date branch. The actual future-rejection source control remains required and pending, along with all four other controls. Main independently reviews this union and owns final acceptance.
