# Personal Plan Stage 1–5 launch-candidate ready-check

- **Status:** `READY_FOR_PUBLICATION_AND_FLAGS_OFF_DEPLOYMENT` — `NOT_READY_FOR_CUSTOMER_ACTIVATION`
- **Date:** 2026-08-09
- **Worktree:** `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-launch-candidate`
- **Branch:** `codex/personal-plan-launch-candidate`
- **Base:** `origin/main` at `e8f8b7e9a0267d76d1a469eb35729bc20227a3d5`

## Canonical tree identity

- In-scope product tree: **370** sorted paths changed against `origin/main`, including durable implementation, tests, plans, mockups, migrations and the ten-category readiness evidence.
- SHA-256: `c91dffb9eb17b9228fc966b3e1fa1a394d958d9ecfa5bd657c8073e304544dad`.
- Manifest representation: `path + NUL + SHA-256(current content)` in sorted path order.
- This receipt, the launch-candidate operational receipt and the separate code-review receipt are excluded from the fingerprint so they can record that identity without self-reference.
- Current `origin/main` was merged into the candidate without conflict. Staging and committing byte-identical content do not invalidate this receipt.

## Verified outcomes

| Gate                                                            | Result                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Node                                                            | 3,116/3,116 passed                                                            |
| Personal Plan                                                   | 838/838 passed                                                                |
| Production-shaped database transition                           | 185/185 assertions across five SQL files passed on the unchanged serial rerun |
| Full authenticated production-shaped Stage 1→5 Chromium journey | 2/2 passed                                                                    |
| Incoming-current-main semantic contracts                        | 49/49 passed                                                                  |
| Bondbuilder relationship-authority regression                   | 14/14 passed                                                                  |
| Typecheck                                                       | Passed                                                                        |
| Lint                                                            | Passed                                                                        |
| Funnel registry                                                 | `npm run funnel:check` passed                                                 |
| Production build                                                | Passed with all Personal Plan flags absent/off                                |
| Formatting and diff hygiene                                     | Prettier checks and `git diff --check` passed                                 |

The journey covers Bedarf, Verfeinerung, exact-product decisions, Routine proposal/retry/acceptance, Anwendung, reload/resume, paid-pending containment and foreign-session denial. The signed German UX/mockup remains the accepted journey evidence.

## Production schema verification

Nick separately authorized the seven additive Personal Plan migrations. They are applied under their exact repository versions on Supabase project `pqdkhefxsxkyeqelqegq`.

Post-apply checks prove:

- all fifteen new relations exist with RLS enabled;
- critical privileged RPCs deny `anon` and `authenticated` execution and allow `service_role`;
- Product Intake schema/storage readiness passes;
- new Personal Plan, Routine and product-protocol tables contain no customer or catalog content rows;
- security advisors contain no new warning for the new surface. Expected service-role-only Stage-5 tables produce informational no-policy notices, while performance advisors expose non-blocking future index/admin-policy optimization opportunities.

## Artifact disposition

- **Commit:** implementation, tests, migrations, approved plans/mockups and all three durable readiness/review receipts.
- **Discarded/transient:** `/tmp` command logs and manifest working files; no generated browser report is in scope.
- **Preserved outside scope:** root checkout, sibling worktrees, existing stashes and the original draft PR branches.

## Blockers and residual risk

- Full customer activation remains blocked by the ten-category catalog/spec/exact-protocol gate. Deep Cleansing has no active launch cohort; Heat Protectant and Scalp Care have no approved live product/protocol cohort; other categories retain the documented enrichment gaps.
- `STAGE1_2` remains unavailable as a reduced rollout because the terminal refined-Bedarfsplan renderer is not implemented.
- No owner-scoped production customer-flow smoke or test purchase has run; that requires separate write authorization after deployment.
- The new empty tables have non-blocking performance-advisor suggestions. They do not block flags-off deployment or controlled testing.

## Ready-check verdict

Every promised software outcome is observed on the identified tree. The candidate is ready to stage, commit, push, open/update as a draft PR and deploy with all Personal Plan flags off. It is not ready for customer activation.
