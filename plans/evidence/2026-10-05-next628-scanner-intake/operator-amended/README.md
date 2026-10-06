# Scanner UI26: main-only native command amendment

Fresh kit `/tmp/test-audit-scanner-intake26-isolation-dml82bss`. Original `/tmp/test-audit-scanner-intake26-tools-y8mclofg` remains immutable, including rejected `operator-mutations-transfer-qkt535`. Current repo phase is TRANSFER; original donor callbacks remain. Do not reapply transfer.

New pins SHA256: `68a3621c1a438274ec566d261ee5087b84f0a8d54424d85fc5ed81c8ffdd44bb`.
Original pins: `bfbedb7adb1865d0cc2ada97d9e74fe934645326654e6001273713495e390a5c`.
Proposal remains `d7d58df419edf371041212beb2159cb7f6b6d0282b3ecbd439b6de027ebbfc0e`.

The complete review delta is `bounded-delta.patch`: add one `--experimental-test-isolation=none` argument after `--test` in each of 14 selected command arrays and the guard's exact expected array; change guard BASE to fresh owned receipts path; replace PIN_SHA in unchanged editor/driver. `operator-proof.cjs` and readonly preload are byte-identical. Operator, decoded message requirements, exact first keeper frames, selected count, skip/cancel/signal/timeout rejection, CAS restore, lock, 45-second own-child group lifecycle and complete all14 proof requirements are unchanged.

Why: main's real C2-input fault was rejected as ERR_TEST_FAILURE because isolated native reporting could not serialize Symbol-valued React actual data into a complete assertion record. Main's retained TMP-only diagnostic demonstrates no-isolation reports ERR_ASSERTION/deepStrictEqual/first frame. That toy is not product proof. All14 real owner controls must run fresh; the failed partial receipt and its earlier successful controls cannot qualify this kit's cut. New BASE and pin SHA also make the old receipt inadmissible.

No source/runtime/identity metadata was refreshed: original25 readsets, fixed52 readsets,2192 dependency pins/30 trees, repository tree inventory, Node binary/version, compiler, six identity files/shared-config policy, Git root/HEAD/branch, all six proposal phase snapshots and source mutation/oracle descriptors remain exact. Every original artifact hash and entrypoint attestation is retained in the new pin object; new immutable tooling/provenance/failure/diagnostic hashes are added. `originals/` preserves the exact old tools, controls, evidence and pins. `prepare-amendment.py` is a fully readable one-shot TMP-only preparer; do not rerun over existing outputs or run old preparers to hide drift.

Static results: both guarded --check modes passed under the unmodified deny-write/deny-child preload at current transfer. All6 phases and14 full mutants parsed,20 unrelated callback bodies and heldF retained,52 source readsets/2192 dependencies matched. `verify-amendment.cjs` independently compares every nonartifact pin field, all14 controls minus the one flag, immutable proof/preload/evidence and source/phase/oracle bytes. It parses all six current CJS tool/check files. Every static check attempted0 writes and0 children. No native tests/faults/owner imports or source/test changes occurred.

## Main commands

From `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, after reviewing the bounded delta and original failed receipt:

```sh
node --require /tmp/test-audit-scanner-intake26-isolation-dml82bss/operator-readonly-preload.cjs /tmp/test-audit-scanner-intake26-isolation-dml82bss/operator-edit.cjs --check
node --require /tmp/test-audit-scanner-intake26-isolation-dml82bss/operator-readonly-preload.cjs /tmp/test-audit-scanner-intake26-isolation-dml82bss/operator-run-controls.cjs --check
node /tmp/test-audit-scanner-intake26-isolation-dml82bss/operator-run-controls.cjs run
```

Review all42 fresh TAP/command receipts. Only after successful complete all14 transfer proof and main acceptance:

```sh
node /tmp/test-audit-scanner-intake26-isolation-dml82bss/operator-edit.cjs cut '<fresh returned receiptDir>' '<fresh completionSHA256>'
```

The normal full two-file transfer/cut native campaign command is unchanged; only fault-driver selected commands receive the diagnostic flag. Full native/coverage/CI gates remain main-owned. No matcher weakening or credit is claimed, and no new user approval gate is introduced. Runtime viability of the actual Symbol-valued source fault remains for main to establish.
