# Moderator organic activation middleware correction

Continue the approved moderator journey from PR #474. Production probe reached the saved organic result but activation returned HTTP 403 before its route handler: the new exact endpoint was missing from both route classification and middleware bypass. The live activation RPC itself succeeds in an exact-fixture transaction that was rolled back. No moderator account has been changed.

Scope: add only `/api/personal-plan/field-test/moderator/activate-organic` beside the existing moderator activation in both exact route lists. The route continues to enforce authenticated/confirmed identity, signed campaign/funnel intent, owned lead, origin and rate limits. Do not exempt the Personal Plan prefix or child endpoints. No schema, account, UI or product changes.

Regression: existing field-test entry test now exercises real middleware for the new path before entitlement, plus exact route classification and a protected child path. The classification assertion failed before the fix; removing only the middleware exception independently reproduced the pre-handler lookup failure. Focused entry/activation/reactivation/auth tests: 22 passed. Changed-source lint and formatting pass. Root reviewed the complete narrow diff and handler authorization; final required CI and live retry remain release gates.

Stop only after deploying the correction and retrying the existing disposable organic result through free activation, new Personal Plan and return. Preserve Nick and the other four moderators.
