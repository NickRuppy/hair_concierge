# Personal Plan field-test access — code review

Status: **APPROVED FOR COMMIT, PUSH, AND DRAFT PR · NO_ACTIVATION**

## Findings

No blocking findings remain in the reviewed implementation.

## Frozen review scope

- Branch: `codex/cofounder-production-access`
- Base: `origin/main` at `1b2cb6146baa3250f86f94e55bc07bfb6623ec60`
- Canonical in-scope fingerprint: `bbf8e4930307159578e1672e3022eccc4b43f4870269b659ed592873ccfd5a65`
- Manifest: `plans/receipts/2026-08-10-personal-plan-field-test-manifest.sha256`
- Review covered the full tracked and untracked implementation delta. Verification receipts are excluded from their own recursive fingerprint.
- Review was performed locally by the owning Codex session without Claude or another counterpart, as required by the workstream instruction.

## Review lanes

### Correctness and recovery

- Entry, campaign lifecycle, signed cookie state, fresh funnel binding, exact lead ownership, activation idempotency, plan readiness, and revocation were followed through the full server trust chain.
- Error handling fails closed for invalid, expired, exhausted, or revoked campaigns and grants while preserving the paid journey.
- The quiz, result reveal, free activation, and existing five-stage plan remain ordered correctly.

### Security and privacy

- The reusable URL is a high-entropy bearer token stored only as a hash; exchange uses a clean redirect, `HttpOnly` signed state, `Referrer-Policy: no-referrer`, and search-indexing denial.
- Browser roles cannot create campaigns, grants, enrollments, or bind arbitrary users, leads, funnels, or artifacts. Activation and revocation remain service-role-only.
- Synthetic guest identity is non-deliverable and authorization depends on server-owned campaign/enrollment state rather than email or user metadata.
- The implementation does not fabricate billing records, provider purchases, subscriptions, or revenue.

### Data integrity and analytics isolation

- The database transaction locks and validates campaign capacity, exact funnel and Personal Plan lead, prepared artifact ownership, guest binding, time-limited grant, and enrollment together.
- Field-test traffic is marked separately and excluded from Meta conversion, commercial Customer.io lifecycle, and paid PostHog/dashboard cohorts.
- Capacity is not replenished by revocation, preventing campaign replay through repeated guest creation.

### Structural review

- The additive migration, new token/activation routes, operator command, enrollment/access model, UI branch, analytics propagation, and tests were reviewed as one integrated change.
- The implementation follows existing service-role RPC and Personal Plan artifact-binding patterns without widening authenticated database privileges.

## Findings resolved before the frozen fingerprint

- Bound the activated lead to the exact guest so `/plan-bereit` can project the completed quiz profile.
- Rejected idempotent reuse after grant expiry or manual revocation.
- Prevented bearer-token leakage through referrers and indexing.
- Explicitly revoked browser write privileges on `manual_access_grants`.
- Preserved ordinary existing-user Routine access when the additive field-test relation is not installed yet, while keeping unrelated database errors fail-closed.
- Classified the narrow public bearer-entry route explicitly and synchronized its route-owned funnel test contract.

## Verification and residual gates

- Fresh verification is recorded in `plans/receipts/2026-08-10-personal-plan-field-test-ready-check.md` against the same fingerprint.
- `npm run test:personal-plan` passed 943/943; the disposable database harness passed 224 assertions; typecheck, focused lint, entry/schema tests, browser checks, and `git diff --check` passed.
- The commit hook reformatted 19 TypeScript files. The manifest was refreshed, two format-sensitive source assertions were hardened, and the full suite was repeated against the final tree.
- The post-PR correction passed 45/45 focused tests, TypeScript, manifest verification, and the exact live Routine browser regression against an absent field-test relation.
- Migration `20260810120016_personal_plan_field_test_access.sql` is not applied in production.
- No production cookie secret, deployment, campaign, link, or smoke test exists yet. Those require a separate activation decision after merge.

## Bottom line

The reviewed tree is suitable for a commit, branch push, and draft pull request. It is not authorization to merge, deploy, apply a migration, configure production, create a campaign, or share a live link.
