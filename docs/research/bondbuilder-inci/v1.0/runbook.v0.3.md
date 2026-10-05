# Bondbuilder replay runbook v0.3

Complete authority: immutable v0.1 base plus [v0.3 overlay](bondbuilder-classification-standard.v0.3.md). Same product/trust/lexicon rules as v0.2; corrected controlled-replay execution. The prepared v0.2 freeze was never dispatched; preserve it.

1. Freeze v0.3 method/prompt/runbook, original and amended anonymous/named inputs, and the immutable v0.2 source amendment. Create-only builder: `node data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/build-packets.mjs`.
2. Two fresh lanes read only base+overlay+prompt and both anonymous packets. Return eight amended observations and eight original-input control observations. Reuse own observation only for identical inputs; no v0.1 transcripts/final labels/web/peers. Seal Stage A.
3. Stage B receives only original v0.1 named evidence and each lane's own fresh original-input observations. Apply v0.3 rules (including owner anchor); return eight source-constant control judgments. Seal before any amended named evidence.
4. Stage C receives amended named evidence, own sealed Stage A and own sealed Stage B. Return eight amended judgments. Preserve the sealed control literally rather than revising it after new information. No additional source research.
5. Seal Stage C. Run `node data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/compare.mjs` for mechanical counts and rule/source deltas; orchestrator authors separate adjudication/findings. Owner-anchor agreement is reported separately from researched trust agreement. Null/null agreement is not jointly assessed trust agreement.
6. Run `node data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/verify.mjs`, local link checks and `git diff --check`. Verify exact source facts, protocol invariants, all disagreement reasons and immutable history. Preserve no-production status. Bring replay findings to Nick before lock/holdout/adapter/catalog work.

All data/method changes use new artifacts; no historical overwrites. Current counterpart findings and disposition are recorded in the [recalibration slice](../../../../plans/bondbuilder-research-engine/recalibration-v0.2.md). Source candidacy is not catalog, supplied-pack or global readiness.
