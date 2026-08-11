# Personal Plan test-owner removal ready check

Branch: `codex/personal-plan-test-owner-removal`  
Base: `origin/main` at `506bd05b84f2eebd5eece3c726a30163a146e3c6`

Canonical implementation fingerprint: `5100707513869a239dd33990d145af4f55df66b17153e396dfdfe882f8444f72`

The fingerprint covers every changed, added, or deleted task path except this self-referential receipt.

## Verified outcome

- Removed the fixed Personal Plan QA-owner CLI, policy, browser fixture, Node contracts, and database preparation contract.
- Preserved the applied historical migration and added a forward migration that drops only `public.prepare_personal_plan_test_owner(uuid, jsonb, jsonb)`.
- Routed production simulated-user reviews and transition-measurement guidance through the shareable field-test link and its free continuation CTA.
- Preserved the field-test campaign implementation unchanged.

## Evidence

- Red proof: `npm run test:personal-plan-db` failed 1/225 because the old preparation function still existed before the drop migration.
- Green database replay: `npm run test:personal-plan-db` passed 225/225 after the forward migration.
- Field-test contracts: 34/34 server/route/policy tests and 6/6 UI tests passed.
- Full Personal Plan suite: `npm run test:personal-plan` passed 1002/1002.
- Isolated production-style Stage 1–5 browser harness: 2/2 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with four unrelated pre-existing warnings and zero errors.
- Measurement-script help output, Prettier, `bash -n`, and `git diff --check`: passed.
- Exact reference search found fixed-owner names only in the immutable historical migration, the forward drop migration, the absence regression, and this removal plan.
- Read-only production migration inventory confirms `20260810140000_personal_plan_test_owner` is applied and the new removal migration is not yet applied.

## Review

Main-session correctness and structural review covered the full uncommitted diff. Structural review was included because the change retires an operator workflow and adds a migration. No blocking findings remain. Claude/counterpart review was intentionally omitted per Nick's instruction.

## Artifacts and residual risk

- The historical implementation plan and its old ready-check receipt are intentionally deleted; Git history retains them.
- The original applied migration remains immutable so clean database replay creates and then removes the function in order.
- Production still exposes the service-role-only function until this branch is published, merged, deployed, and the new migration is separately applied.
- Read-only inspection immediately before implementation found no reusable QA owner, so no synthetic owner data requires deletion.
- No commit, push, PR, merge, deployment, migration application, production write, or cleanup was performed.
