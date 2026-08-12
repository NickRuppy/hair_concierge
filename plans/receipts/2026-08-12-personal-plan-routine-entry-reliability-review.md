# Personal Plan Routine entry reliability — review receipt

- Branch: `codex/personal-plan-routine-entry-reliability`
- Base: `origin/main` at `b1078b204e72226bb362c8c3b7a400ef42c00970`
- Reviewed implementation fingerprint: `f6a8fdc5f798c1d69ce75ae9ad6d7ef02eecb8f4b88cff294112d36a7a6e0c67`
- Review lanes: full manual diff review plus two read-only Claude Code whole-working-tree passes at Opus/high.

## Findings resolved

- Replaced the first broad activation sweep with exact pending-refinement settlement. It no longer parses portfolio JSON, touches product/portfolio work, revokes leases, or clears deferred-review breadcrumbs.
- Made finish results authoritative for counters and terminal telemetry; a lost lease is unfinished, not successful.
- Removed the dead blocking `preparing` UI path and reset the per-visit sync latch after proposal acceptance or rejection. The Chromium journey counts the actual POST boundary.
- Split healthy, terminalized, deferred, and unfinished claim counts. Muted expected refinement lifecycle noise while preserving anomalous terminal telemetry.
- Added telemetry for terminal stage-RPC `invalid_source` results and wired the same reporter into post-acquisition synchronization.
- Kept only known legacy `portfolio_version` terminal. A genuinely unknown future source kind remains retryable for safe deploy ordering.
- Added behavioral coverage for both proposal acceptance and initial auto-activation, both deterministic product terminal states, live-lease preservation, and the two terminal-reporting paths.

## Verification after the final fixes

- Focused source/acquisition tests: 21/21 passed.
- Full Personal Plan Node suite: 1,224/1,224 passed after rebasing onto the current `origin/main`.
- Personal Plan database suite: 18 files / 407 assertions passed after rebasing.
- Stage 4 Chromium journey passed with 0/1/2 sync-request assertions across pending, accepted, and rejected proposal states.
- Complete `ci:verify` passed typecheck, lint with four pre-existing warnings and zero errors, and production build.
- `git diff --check` and changed-file Prettier checks passed.

## Bottom line

No known correctness, privacy, migration, or user-flow blocker remains at this fingerprint. General retry caps/DLQ behavior for genuinely transient infrastructure failures remains explicitly outside this slice.
