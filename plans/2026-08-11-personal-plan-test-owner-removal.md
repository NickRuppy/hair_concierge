# Remove reusable Personal Plan QA owner

Status: approved for local implementation on 2026-08-11.

## Outcome

Use the existing shareable Personal Plan field-test campaign link as the single production testing path. Remove the fixed reusable QA-owner operator tooling so future agents complete the real quiz, use the free continuation CTA, and enter the same five-stage journey without payment.

## Scope

- Remove the fixed-owner CLI, policy module, Node tests, browser test, and database preparation contract.
- Remove fixed-owner setup from the Personal Plan database and Stage 1–5 browser harnesses.
- Update transition-measurement guidance and `simulated-user-review` to use a field-test guest session.
- Keep the already-applied `20260810140000_personal_plan_test_owner.sql` migration as immutable history.
- Add a forward migration that drops only `public.prepare_personal_plan_test_owner(uuid, jsonb, jsonb)`.
- Preserve the public field-test campaign/link implementation unchanged.

No user-facing mockup is required: this removes internal operator tooling and does not change the field-test or Personal Plan screens, copy, timing, or recovery behavior.

## Verification

- Red/green database contract proving the preparation function is absent after replay.
- Personal Plan database harness and Stage 1–5 browser harness.
- Focused Node tests, typecheck, lint, formatting/diff checks, and an exact reference search.
- Confirm the field-test access implementation and tests remain present.

## Stop boundary

Local verified branch only. Commit, push, PR, merge, deployment, migration application, production writes, and cleanup require later authorization.
