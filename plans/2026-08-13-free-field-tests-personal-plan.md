# Free field tests enter the Personal Plan

## Outcome

Both payment-free campaign journeys use the same post-offer Personal Plan handoff as their paid equivalents:

- `/test/haarplan/<token>` keeps its existing Personal Plan source artifact and enters `/plan-bereit`.
- `/test/quiz/<token>` keeps its exact legacy quiz lead and enters `/plan-bereit` instead of `/onboarding`.

The old onboarding remains directly reachable for historical edits. Ordinary paid legacy buyers still require the customer cohort date, rollout access, and legacy cutover flag.

## Authority and lifecycle

An explicit field-test source is valid only while its exact flow-scoped enrollment and tester grant are active, unrevoked, unexpired, and owned by the authenticated guest. The routing RPC labels the source as `field_test`; paid sources remain labeled `paid` so application routing cannot confuse test access with a customer cutover.

Stage 1 preserves source truth:

- Personal Plan test: `personal_plan_artifact` and the exact prepared artifact.
- Regular quiz test: `legacy_quiz_lead`, the exact lead ID, and no prepared artifact.

Field-test activation time is not treated as a payment timestamp and is not constrained by the paid-buyer cohort cutoff. Campaign and grant expiry still terminate access through the existing flow-specific ended routes.

## Verification contract

- Both activation APIs return a Personal Plan readiness destination.
- The regular test UI rejects the former onboarding destination.
- Enrollment, readiness, middleware frontier, Stage 1, and journey access recognize both field-test kinds.
- A paid legacy source remains outside the Personal Plan while the independent cutover is disabled.
- Revoked, expired, foreign, malformed, or unavailable sources fail closed.
