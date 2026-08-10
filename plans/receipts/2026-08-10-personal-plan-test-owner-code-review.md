# Personal Plan test owner code-review receipt

Date: 2026-08-10
Base: `origin/main` at `97d1fc1b344a22f9e6eb2ec2cb01600bdc660db3`

## Verdict

No blocking correctness or security finding remains. Main-session source review and two prior read-only structural counterpart passes covered the full migration, operator CLI, policy, browser state, reset path, and harness changes. The final reconciliation over PR #355 was reviewed in the main session without another counterpart invocation, per Nick's instruction.

## Findings resolved

- Rejected `profiles.is_admin=true` as unnecessarily broad. The owner now remains non-admin and receives one exact long-lived `tester` grant/enrollment; pgTAP and browser tests prove internal Personal Plan access still works.
- Restricted auth consumption to the canonical production origin and mode-`0600` temporary state.
- Applied the same explicit production write gate to `auth-state` because opening `/plan-start` may create/resume plan state.
- Changed auth-user pagination to stop only on an empty page, avoiding reliance on GoTrue honoring a requested page size.
- Extended the atomic Customer.io suppression comment to make future source-table side effects part of the migration contract.
- Added wrong-version SQL coverage and progress → erase → source-preservation pgTAP coverage.
- Bound the service-role client to the exact canonical production Supabase origin, rejecting lookalike hosts before any inspection query.
- Required the rendered `Deine Basis` Stage 1 frontier before persisting auth state; pathname-only success is no longer sufficient.
- Kept ambiguous or mutated canonical source rows fail-closed. `unsafe` deliberately requires operator diagnosis/manual database repair; the tool never guesses which source row to delete or overwrite.
- Reconciled the owner test with `main`'s production-build browser harness and retained its bounded readiness, failure evidence, and completed-handoff detection.
- Kept the existing Stage 3 dev-server semantics while pinning the lab gate inside the child process and probing the guarded lab route before tests, removing the CI readiness race without weakening route protection.

## Residual risk

- The deterministic tester grant/enrollment expires in 2099 and must remain recognizable as synthetic; no public campaign credential exists because the sentinel campaign is revoked.
- Future schema migrations that add source-row workers/outboxes must extend the atomic suppression contract.
- PID-derived local ports can theoretically collide under unusual concurrent process numbering; per-process project IDs and current disjoint port ranges materially reduce the risk.
