# Coding verification within the machine's capacity

Use focused checks during implementation and one consolidated final verification. Keep complete CI coverage; reduce repeated runs and simultaneous workers, not protected contracts.

## Local commands

`npm run test:focused -- tests/example.test.ts` runs explicit Node test files with the full suite's server-only shim and TypeScript loader. Choose the changed behavior's owner and relevant siblings. Documentation-only changes need reference/format validation unless executable behavior changes; tooling changes need their own contracts, not an unrelated application build.

Node tests use two file workers locally. Use `CODING_TEST_CONCURRENCY=1` for database-heavy checks. Vercel hosted builds retain their original Node-only build toolchain; local builds acquire the Python supervisor slot. GitHub Actions retains its native concurrency unless explicitly overridden; local commands setting `CI=true` still use local limits. A single file can still allocate excessive memory: profile and fix its setup/cleanup separately. Preserve process isolation.

Leaf Node tests, typecheck, lint, build, workspace checks and Playwright commands share one per-user, machine-wide slot across worktrees/apps. Waiting jobs print a message. Python's `fcntl.flock()` releases the slot when its owner exits; never delete the lock file, which could create a second independent slot. Both queue wait and execution default to 30 minutes, configurable through `CODING_VERIFY_WAIT_SECONDS` and `CODING_VERIFY_TIMEOUT_SECONDS`. Pre-commit uses a zero wait and fails clearly if the slot is busy, retaining mandatory checks.

Composite commands take the slot through their leaves. Do not wrap gated npm scripts again: nested launchers fail promptly. Raw commands use `~/.local/bin/coding-check -- <command> <args...>`. For Node tests in older worktrees use `~/.local/bin/coding-check --node-tests <selected files...>`: it supplies both imports and the worker cap. Wrapping a legacy npm suite only serializes it; it cannot change that suite's worker count. `CODING_VERIFY_BYPASS=1` is a warned emergency lock bypass; worker limits and execution deadlines still apply. If the launcher itself is broken, run the underlying raw command for recovery. Do not use `CODING_VERIFY_LOCK_DIR` outside isolated launcher tests: changing it changes the queue. Arbitrary unwrapped commands and already-running jobs remain outside enforcement.

## Consolidate verification

Start with `npm run verification:plan -- --base origin/main` to collect committed branch changes plus staged, unstaged and untracked paths. Use `--json` for structured output, or `--files <paths...>` to inspect explicit paths. The plan recommends focused owner tests for known seams and flags unknown/mixed changes for owner review. Recommendations cover iteration, never complete release coverage; no changes detected is not a verification waiver. No tests run automatically, and required CI gates remain intact.

Before launching another heavy check, use `~/.local/bin/coding-check --status`. It reports the shared slot's kernel state and the recorded supervisor PID/cwd/command basename when available. This is local slot ownership, not total computer activity: old unwrapped jobs, remote jobs and emergency bypasses are outside the status command. Metadata is advisory; stale metadata cannot mark a free lock as running. After updating the runner, run `npm run verification:install` to refresh the installed command.

- Workers run focused owner/sibling checks and report command, content/revision, working directory, environment and result.
- The orchestrator runs required final checks once for combined proposed content. Relevant code/config/fixture/environment changes invalidate evidence.
- Advisory reviewers inspect recorded evidence and run extra focused checks for concrete gaps. They do not launch whole suites/builds to reconfirm unchanged content.
- `test:node` includes top-level Personal Plan contracts. Its complement is `test:personal-plan:nested`; running the broad `test:personal-plan` afterward repeats overlapping top-level files.
- Parallelize reading, bounded edits and inexpensive checks when useful; queue heavy verification across sessions.

## CI and Hetzner

GitHub CI remains the place for full suites, builds and broad typechecks, including manual CI dispatch for a published branch. Required checks remain intact. Do not claim an unrun CI gate passed.

The existing `chaarlie-hetzner` host has 2 CPUs and 3.7 GiB usable RAM. On 2026-10-14 it used about 1 GiB, had 2.8 GiB available, and averaged 98% CPU idle. Recorded peaks: Vinted buying 217 MiB, seller 25 MiB, price audit 682 MiB, Product Intake worker 988 MiB, cockpit 104 MiB. Those peaks belong to different lifetimes; they are not a simultaneous total or a capacity guarantee. The host cannot accommodate the observed 6.6 GiB test worker.

Use `npm run test:remote:focused -- --dry-run tests/example.test.ts` to validate a proposed remote run locally; omit `--dry-run` to execute an explicitly selected group. The opt-in remote helper accepts selected Node test files from a committed tree. Environment files and credentials are excluded from transfer. A serialized Docker job uses at most 1 CPU, 1 GiB RAM without additional swap, one test worker and a bounded runtime; tests have no network. Production paths and credentials remain outside the container. The receipt identifies source SHA and runtime. Dirty changes need a separately reviewed snapshot mechanism. Nick authorized activation on 2026-10-14. The questionnaire normalization/primary-concern group passed 56 tests on source d2e0e65f2ddf286140068df1e22a14edf6a82ddd, Node v22.23.3, with 76,353,536 bytes (about 73 MiB) peak test memory and about two seconds execution. Cold npm installation took about a minute and reached the 1 GiB cgroup limit; temporary files/containers were removed and existing service results stayed successful. Keep this optional: tiny focused checks are quicker locally, and any single heavy test may fail at the hard cap. Install the opt-in command with `npm run verification:install -- --remote`, then use `~/.local/bin/coding-check-remote <selected files...>` from a clean committed checkout. No persistent server service is installed.

## Retained coding helpers

Claude's OpenAI-Codex Companion plugin keeps a detached broker per workspace. Its SessionEnd hook owns shutdown. Old age, PPID 1, zero CPU or a listening socket do not prove inactivity. `/codex:status --all` reports tracked jobs but cannot rule out a foreground client.

Finish/cancel the workspace's jobs, check status, then close its Claude session so SessionEnd can clean its broker and children. Do not kill every Node, REPL or XcodeBuildMCP process. The 2026-10-14 audit found about 15 retained broker trees/224 helpers, around 349 MiB resident under compression; this excludes compressed/swapped memory. Cleanup remains conditional on establishing session inactivity.
