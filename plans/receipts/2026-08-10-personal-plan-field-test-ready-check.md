# Personal Plan field-test access — ready check

Status: **READY FOR CODE REVIEW · NO_ACTIVATION**

## Tree

- Branch: `codex/cofounder-production-access`
- Base: `origin/main` at `1b2cb6146baa3250f86f94e55bc07bfb6623ec60`
- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/cofounder-production-access`
- Canonical in-scope fingerprint: `bbf8e4930307159578e1672e3022eccc4b43f4870269b659ed592873ccfd5a65`
- Manifest: `plans/receipts/2026-08-10-personal-plan-field-test-manifest.sha256`
- The receipt and manifest are verification artifacts and are intentionally excluded from their own recursive fingerprint.

## Promised outcomes checked

- A 256-bit reusable bearer link resolves only an active, unexpired, non-exhausted campaign, exchanges the token for signed HttpOnly state, sets `Referrer-Policy: no-referrer`, and redirects to the clean `/lp/haarplan` URL.
- Field-test entry forces a fresh funnel session and refuses to overwrite any authenticated customer or prior tester browser session.
- The normal Personal Plan quiz and result reveal remain in the journey, with a persistent German field-test banner.
- The field-test offer mounts a `0 €` activation card and does not mount Stripe, PayPal, subscription selection, checkout, guarantee, or purchase/refund claims.
- Activation is rate-limited, creates a synthetic non-deliverable Auth guest, establishes the browser session, and uses one service-role-only transaction binding the exact campaign, funnel, lead, guest, grant, and prepared artifact.
- The transaction binds the exact lead owner for existing `/plan-bereit` profile projection, is idempotent only while access remains active, and rejects expired or manually revoked grants.
- Active field-test enrollment qualifies the five-stage Personal Plan journey without fabricating `paidAt`, provider purchases, subscriptions, or revenue.
- Before the additive migration is installed, only the exact missing field-test relation is treated as no field-test enrollment, preserving ordinary existing-user Routine access; unrelated database failures remain fail-closed.
- Campaign revocation atomically ends future entry, active enrollments, and tester grants.
- Trusted `test_kind=field_test` propagates into usability analytics while Meta conversion, Customer.io completion events, and commercial PostHog/dashboard cohorts exclude it.
- The operator command is dry-run by default; production create/revoke requires `--apply`, a dedicated environment write gate, exact project confirmation, and the production project URL.

## Fresh verification

- `npm run test:personal-plan` — PASS, 943/943.
- `npm run test:personal-plan-db` — PASS, 8 files and 224 pgTAP assertions on a disposable Supabase project, including migration replay, activation, exact ownership, idempotency, browser-role grant isolation, revoked-grant rejection, and campaign revocation.
- Focused entry/schema rerun — PASS, 6/6.
- Scoped ESLint for field-test routes, primitives, command, lab, and tests — PASS.
- `git diff --check` — PASS.
- `npm run typecheck` — PASS on the post-hook tree.
- Post-PR CI correction — PASS, 45/45 focused funnel, route-inventory, enrollment, rollout, and field-test tests; the exact live Routine browser regression passed in 10.8 seconds with the field-test relation absent.
- Post-hook refresh — Prettier reformatted 19 TypeScript files; two source-text assertions were made whitespace-insensitive, the manifest was regenerated, and the complete 943-test suite plus typecheck and database harness passed again against the final bytes.

## Browser/manual evidence

Local development-only lab, with vendor analytics keys disabled and a dummy local Supabase endpoint:

- Mobile `390 × 844`: banner present, free card present, no horizontal overflow, no framework overlay, and no payment/checkout iframe or component.
- Desktop `1440 × 900`: same checks passed.
- Activation failure state: stayed on the offer and displayed `Testzugang erneut aktivieren oder zur Auswertung zurückkehren.`
- External screenshot artifacts:
  - `/Users/nick/.codex/visualizations/2026/08/10/019feb48-a723-7053-a761-dc9cf09943ab/personal-plan-field-test-mobile.png`
  - `/Users/nick/.codex/visualizations/2026/08/10/019feb48-a723-7053-a761-dc9cf09943ab/personal-plan-field-test-card-mobile.png`
  - desktop equivalents in the same directory.

## Skipped checks and residual gates

- No production migration, deployment, environment-variable change, campaign creation, revocation, allowlist change, email send, or tester-link sharing was performed.
- A real production link does not exist yet.
- The separately authorized activation gate must verify the deployed app/schema SHA, configure the independent cookie-signing secret, confirm Customer.io commercial workflows require `commercial_automation_eligible=true`, create one bounded campaign, and run one supervised production smoke.
- The production smoke must confirm the full quiz → result → free activation → `/plan-bereit` → five-stage journey, zero provider/billing rows, and correct PostHog/Customer.io exclusion.
- No Claude or counterpart review was run, per the workstream instruction.

## Artifact disposition

- Commit with the change: approved plan, reviewed mockup, runbook, source, migration, tests, this receipt, and manifest.
- Archive outside the repository: rendered browser screenshots listed above.
- Discarded: local dev server/browser sessions; worktree-local installed dependencies are ignored and excluded from task artifacts. No generated source artifact remains.
