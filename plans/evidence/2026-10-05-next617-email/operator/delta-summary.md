# Bounded delta from approved Offer87 tools

Exact template directory: `/tmp/test-audit-offer87-tools-j3gv5ax6/`. Full old/new SHA256 values and line counts are in `approved-template-delta.json`; the complete code-only unified diff is `approved-template-delta.diff`.

- `operator-guard.cjs`: 35 added / 25 removed lines. Adapt phase reconstruction to three changed tests plus 15 guarded unchanged tests, four candidate unions, the type-only reminder import and unused constant binding, 94/94/90 owned and 105/105/101 total counts. Validate 89 unrelated owned callbacks plus 11 support callbacks. Permit the exact Meta whole-file constant fault in addition to named-function faults; match the pinned native argv including concurrency. Keep source/readset/runtime identity guards and shared token/CAS infrastructure.
- `operator-edit.cjs`: 2 added / 2 removed lines. New pins SHA and static counts only; transfer/cut CAS, backups, rollback and receipt gating are inherited.
- `operator-run-controls.cjs`: 4 added / 4 removed lines. New pins SHA, 20-control count and 18-test backup description; serial child process, timeout and restoration code is inherited.
- `operator-proof.cjs`: 21 added / 8 removed lines. Require 20 controls / 40 clean runs / 18 cohort hashes. Decode Node TAP error.message block or quoted scalar before applying the independent review's substrings; malformed/unsupported encodings fail closed. The existing exact-one, operator, ERR_ASSERTION, first keeper frame, source/hash and command checks remain.
- `operator-readonly-preload.cjs`: byte-identical to the approved template.

New data files are cohort-specific pins, candidate/control normalization, closure evidence and physical snapshots. No general runner abstraction, source behavior, input, SUT invocation, assertion condition or optional PP cut is introduced. All 20 message matchers are the reviewer's explicit proposed substrings; frozen original proposal/control artifacts remain unchanged. Static checks are complete; intended runtime reds remain main's responsibility.
