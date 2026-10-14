# Research32 guarded main handback

Prepared only; no repository mutations, native tests, faults, browser, provider or database operations executed. `node --check` and static check mode passed.

- Editor: `/tmp/test-audit-research32-edit.cjs` (mode0444).
- Immutable full plan: `/tmp/test-audit-research32-main-TKQOIo/plan.json`, SHA256 `dc99367f2ef2e1bcbdae3d50f5fe4ff2d39ec5b98c47caa5d05e070caa69aab2`.
- Normalized control array: `/tmp/test-audit-research32-main-TKQOIo/controls.json`, SHA256 `1e6e3d159b4c2028b3bdb5d52293abac16d402e475745a25079321a629b01e40`.
- Static editor receipt: `/tmp/test-audit-research32-main-check.json`.
- Static control-schema receipt: `/tmp/test-audit-research32-controls-static-check.json`.
- Existing reviewed complete diffs: `/tmp/test-audit-research32-transfer.diff`, `/tmp/test-audit-research32-cut.diff`.

The final plan embeds/snapshots **all five test files**, parses every before/transfer/cut version, and counts **32→32→30**. This supersedes the older navigation manifest's two changed-file snapshots. Unchanged Shampoo2 + lock5 + review-state3 remain counted and exact byte guarded. All other callbacks remain unchanged except the two intended keepers (API assertion transfer; retained fixture comment repaired to refer to rule-change document). Complete file reconstruction accepts only named keeper transfer, exact two donors and the explicit comment edit; fixture/helper/import bytes otherwise exact. No owner calls/inputs added.

Exact cwd and HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d` required. 571 source/support/readset guards include API/access/review-state/client/adapter/constants/test registration, both Lab fixtures, lock manifest/receipt referenced artifacts and actual Shampoo archive inventory. These hashes are preservation guards, not new full semantic-read credit. All support has read-only snapshots. Directory inventory guards reject archive additions/removals. Local ignored review state and env files are not read.

Before writing, every prospective full test parses, every phase count and reconstruction is checked, all support hashes and HEAD checked. Unique backups include complete tests/support; an immutable prepared receipt precedes the write. Each phase changes exactly one file (transfer API; cut fixture) through exclusive sibling temporary file plus atomic rename with a fresh all-file/readset CAS immediately before rename. Automatic error rollback touches only bytes still equal to this editor's target. Concurrent changes are refused. Explicit rollback requires this editor's applied receipt and backed-up original hashes; it cannot guess ownership. Existing process lock is never overwritten.

Main commands from exact task root:

```sh
node /tmp/test-audit-research32-edit.cjs check
node /tmp/test-audit-research32-edit.cjs before
node /tmp/test-audit-research32-edit.cjs transfer
# Run current keeper/cohort proof and selected actual-owner controls.
node /tmp/test-audit-research32-edit.cjs cut
node /tmp/test-audit-research32-edit.cjs check
# Only when reverting an owned applied phase:
node /tmp/test-audit-research32-edit.cjs rollback /tmp/test-audit-research32-apply-UNIQUE/applied.json
```

Cohort command unchanged in each phase:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/shampoo-research-parked-package.test.ts tests/leave-in-research-fixture.test.ts tests/leave-in-research-v1-1-lock.test.ts tests/leave-in-research-review-state.test.ts tests/leave-in-research-api.test.ts
```

Normalized controls match `test-audit-next538-controls.cjs`: array entries have id/file/sourceSha256, named function anchor with expectedOccurrences1, from/to, mutatedSha256, test.file/test.name and intendedAssertion. The existing main driver was read but **not changed**; main must add the lane/path or use its current generic driver. Each descriptor was applied only to an in-memory string under that exact scope; all ten mutated hashes and TypeScript parse were verified. No mutation was executed. Existing main driver also requires exact selected1 pass, assertion RED, exact restoration then selected1 pass; main must inspect the stated intended clause. These ten controls sample eight C1 result projections/order/prefix and two C2 registry/property failures, not every individual metadata literal. Do not repeat the independent preflight's broader “every scalar” phrasing: standardVersion/keyVersion/derivedFromRun are transferred literally but have no separate control in these ten.

The compile-time type view and JSON projections cannot prove browser rendering. Held F833 remains untouched. Proposal grants no source retirement, normative artifact rewrite, catalog or production activation.
