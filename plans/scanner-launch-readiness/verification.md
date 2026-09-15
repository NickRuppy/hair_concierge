# Verification receipt — scanner launch readiness

Branch `codex/scanner-launch-readiness`, base `b4deccd8b638e589514ba0cfb5d49e9c556d323a` (#555). Uncommitted source, tests, migration, privacy/ops docs and durable design artifacts are in scope. Content fingerprint (sorted path + SHA256 manifest, verification/review receipts excluded for self-reference): `8d55b9f6942657068e98071ef78ba041502f7552b4feddec46a71aec70bdbfaa`, 30 files. Manifest is transient at `/tmp/scanner-launch-content-manifest.txt`.

Decision coverage confirmed: original preview acceptance “Okay yeah, I think it's good. Can you set this up with those emails” plus “all trials!” approves the new reminder journey, email and privacy for all new trials. Locked v20 + supplied WhatsApp link authorizes the contact change. Internal revalidation against final implementation introduces no consequential choices; activation still last. Undiscussed consequential assumptions affecting this handoff: none.

## Evidence
- Node22.12.0. Main ran30 focused renderer/delivery/route/mandatory-notice/scanner component tests, then39 including the initial9 SQL tests, all passing. Final SQL boundary test expands that SQL suite to10; final main rerun recorded below.
- SQL runs the actual migration and preceding trial schema in PGlite. Covers all-provider/interval selection, rollout cutoff, eligibility,48h boundary, cancellation after claim, temporary management hold, immutable one-use prepare, stale leases/settlement, anon/authenticated denial, and dispatcher→actual RPC shapes→fake Customer.io acknowledgement. No live provider calls.
- Red proofs recorded in plan: inert dispatcher failures; route auth and middleware bypass mutations; price-mapping mutation; cutoff/repeated-prepare SQL mutations. All restored.
- `npm run typecheck`: passed; final repeat after SQL fixture changes recorded below.
- `npm run lint`: no errors, five pre-existing warnings in untouched files (preview frame.js, onboarding-flow, avatar, agent-v2 chat pipeline, agent model client).
- `npm run build`: passed including new reconcile route.
- Main `npm run test:playwright:scanner-refinement`:10/10 passed Chromium and mobile WebKit, exact WhatsApp destination, approved dock spacing, retained zoom/quiz flow.
- Actual renderer HTML inspected at390px: no horizontal overflow (document/viewport390); amounts reflect accepted first/renewal contract rather than fictional pricing authority. Edited privacy component rendered in its existing layout and wording inspected.
- Customer.io draft15/content155 was saved and inspected in previous preparation turn; no email sent, no activation. Inline send content has a parity test with renderer; shared provider layout/mailbox rendering still needs controlled delivery proof.
- `git diff --check`: clean.

## Limits and disposition
All30 task files are intended for commit, including approved and implemented previews. These two receipts are also intended for commit. Raw reviews, ASR, mutation logs and manifest remain transient under /tmp. No production migration/deploy/env/activation, charge or real customer email was performed. No true two-connection PostgreSQL concurrency run: PGlite provides state/RPC regression evidence, not production concurrency proof. Local advisors on an unapplied database cannot validate this new migration and are not claimed as such. Activation still needs applied-schema verification, final template settings, explicit rollout cutoff/env, controlled email delivery and production flow verification. The queue records Customer.io acknowledgement only; no automated delivery webhook or blind resend is introduced.

Final main reruns: SQL10/10 passed; typecheck passed; diff check clean; recomputed30-file fingerprint unchanged. Combined focused coverage is40 tests (30 source/component/route/mandatory-notice +10 SQL), plus10 browser cases. Ready for code review; publication/production activation remain separate.

Whole-worktree review complete: Claude Opus4.8/high approved with no blocking findings. Main verified observations; bounded skip/park behavior and external launch-proof limits are recorded in review.md. Fingerprint unchanged; decision coverage remains confirmed. Next authorized boundary is publication when requested, followed by separately controlled launch steps.

Publication revalidation: commit hooks formatted only the WhatsApp anchor and SQL test file. Main proved both changes exactly match Prettier output from the reviewed preimages; no behavior changed. The affected SQL/component suites passed15/15, and the commit hook typecheck passed. Canonical fingerprint above is refreshed for the formatted bytes; existing whole-tree review and other verification remain applicable.

Release test hardening: cold parallel Next dev compilation reset the first320px pricing interaction (CI annual copy after successful month selection; local first-case timeout/reset). A controlled prewarm-only probe passed10/10 with unchanged assertions and workers. Added a nine-line beforeAll route warm-up to the offer browser test; the ordinary scanner command then passed10/10. Main reviewed the bounded test-only diff and an independent explorer confirmed the pricing controls have no navigation side effects. No production behavior, approved journey, or billing code changed; original Claude whole-branch review remains applicable with this trivial test-only supplement. Latest main PayPal helper grants were merged; task source bytes are otherwise unchanged.
