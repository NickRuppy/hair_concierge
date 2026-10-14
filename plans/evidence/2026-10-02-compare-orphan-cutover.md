# Retired Compare adapter closure

Status: applied. Current tree has net 151 removed declarations; latest whole-tree proof remains 144. Original target is still 2,379 (20% of 11,892).

## Decision coverage and outcome

Confirmed: Nick requested test-audit pruning and explicitly told Codex to establish
production reachability. [Parent contract](../2026-10-01-test-audit-pruning.md).
Inherited: skill retention, coupled dead-owner removal, independent preservation,
native repository gates, no source/test edits during runners. Defaults: delete only
the disconnected adapter/scenario closure; preserve all active Lab/operator paths.
Open consequential assumptions: none. Internal revalidation: complete seven cases,
orphan source, current route's normalizing/running path, source graph and deployed
`3abfe00a` checked. Coverage acknowledgement: original global 2pp tolerance, with
conservative original-source denominator and surviving-contract attribution.

The graph now follows actual imports instead of treating every internal barrel as
a public entry point. That revealed a disconnected local-comparison adapter whose
only executable consumers are tests. The active Compare Lab route directly owns
the corresponding orchestration, using live per-user snapshots and dynamic runners.
This removes no usable Compare variant or diagnostic capability.

## Exact targets

Delete `src/lib/agent/compare/run-compare.ts` (222 source lines) and its exclusive
child `src/lib/agent/compare/scenarios.ts` (669), with these seven declarations:

| Test owner and original line | Exact title | Remaining owner / reason |
| --- | --- | --- |
| `tests/agent-compare-runner.spec.ts:51` | runCompareWithAdapters uses the override prompt for both systems | actual route prompt propagation remains; obsolete adapter has no caller |
| same :93 | runCompareWithAdapters resolves omitted tool-loop variant to product evaluation | route defaults and real variant resolver remain |
| same :128 | runCompareWithAdapters tolerates one-sided failures | actual route catches per-runner failures; carry the one-sided failure assertion into retained :185 before deletion |
| same :170 | runCompareWithAdapters can run Tool Loop against AgentV2 without Classic | actual route runner map remains, including both variants |
| same :280 | compare scenarios include leave-in heat and relationship cases with required profile signals | list is consumed only by the removed adapter; live Lab uses user snapshots |
| same :316 | compare scenarios include care balance golden eval coverage | unconsumed synthetic list; actual `data/agent-v2/evals` fixtures and all live evaluation proof remain |
| `tests/agent-v2-compare-runner.spec.ts:16` | Compare Lab accepts agent_v2 system | actual route :101 normalizer and route cases remain, rather than dead exported normalizer |

Both test files stay. Remove only now-exclusive scenario fixture/imports/type in
the first file and normalizer import in the second. Current first file has ten
declarations; six are removed, four active prompt/variant cases remain. Second
file has twenty; nineteen remain. No grouping or parameter-row credit.

Live source keeper: `src/app/api/labs/agent-compare/route.ts:51-69,101-237`, which
loads Classic, tool-loop, AgentV2 and CareBalance runners directly. Retain
`run-shadow-agent`, `run-agentic-tool-loop`, `run-agent-v2`, prompt packs,
tool-loop variants, shared types, Lab UI and judgment API. Existing
`tests/agent-compare-api.spec.ts` cases :28/39 (environment and dynamic-import
boundary), :140 (default CareBalance), :185 (multi-turn, variant, one-sided failure),
:271 (trace), :386/:462 (AgentV2/CareBalance) remain. For :185, the current fixture
has both runners succeed; it is not yet a keeper for one-sided failure. Change its
Classic fake to throw `new Error("Classic comparison failed")` **after** recording the supplied
turns/variant. Preserve every existing turns/prompt/blinding/labels/systems/variant
and surviving tool-loop consultation-brief assertion. Add exact Classic error and
tool-loop answer assertions. This exercises the real route's per-runner catch,
rather than a disconnected adapter, without removing an existing successful-Classic
content assertion (there is none in this case). Independent preservation review
must confirm successful Classic delivery remains covered by other real route cases.
Mutate the actual route catch to rethrow the failure; this retained case must fail
for its expected HTTP200/two-results contract, then restore exact source bytes.

No assertion transfer is required for the discarded synthetic fixture catalogue because it has no runtime,
operator, research, external package or documented manual entry.

History and complete graph evidence:
[barrel-aware lane ledger](2026-10-02-barrel-orphan-layer-ledger.md). The same
separation exists at the inspected deployed SHA. Its current route explicitly
avoids importing this adapter, guarded at `agent-compare-api.spec.ts:39`.

## Verification and stop conditions

Before proof is captured by `node /tmp/test-audit-compare-orphan.cjs before`, using
the existing c8 10.1.3 all-source configuration on the three affected/keeper files.
Source edits wait for every current test/report/mutation runner to exit, and the
read-only Claude plan review precedes cutover. After cuts, recount declarations,
check non-test import/dynamic/operator references and read the full diff. The
source-grep guard that forbids an import is an intentional remaining mention.

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/agent-compare-runner.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-compare-api.spec.ts
node /tmp/test-audit-compare-orphan.cjs after
npm run typecheck
npm run lint
npm run build
git diff --check
```

Independent preservation review must compare deleted tests to the actual route
keepers and verify that no live operator/golden fixture is lost. No migration,
provider, model, user snapshot or judgment write is needed. Repeat full Node
coverage/failure comparison on the final changed tree and retain raw per-file
structural deltas alongside surviving-contract evidence. The expected total is
151; this still does not satisfy the 20% target. Stop publication at the existing
explicit authorization boundary; current-main reconciliation remains a later gate.

## Applied receipt

Patched existing uncommitted files in place; prior held-out sentinel cut stays intact. Focused all-source c8 before/after on three affected files passes; exact case counts are captured in TAP artifacts under `/tmp/test-audit-compare-orphan-{before,after}`. Seven declaration cuts verified by syntax-tree recount: 11,748→11,741. Two disconnected source modules deleted. Independent [preservation review](2026-10-02-compare-orphan-preservation.md) confirms the catalogue has no runtime/operator authority. Actual route keeper now asserts partial success, exact failed Classic error/empty answer, Tool Loop answer/error, and original multi-turn/blinding/trace contracts. A temporary mutation rethrowing its per-runner catch produces HTTP 500 instead of 200 and is caught; source restored byte for byte. Claude plan review found no technical blocker. Main rejects optional renewal of dead-reference retention approval: this deletion falls within Nick's explicit reachability/pruning authorization.

Current plan commands document native reproducible gates; temporary c8 driver's exact args are saved in command.json. Before snapshot uses prior 144 working tree; controlling whole-tree comparison remains pinned to original 21e0e41f. Type/lint/build and another whole-tree proof are required after the final coherent edits; this focused result alone is not a new fully verified campaign checkpoint.
