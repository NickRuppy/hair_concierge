# Canonical identity31 layer plan — one conditional fallback union

Recommendation: consolidate C1 only after main accepts the operative-readset equivalence below and actual four faults pass. Keep the other29 R declarations, hold schema F1 unchanged. No source retirement, no helper export cleanup, no operator invocation. Proposed five-file phases31→31→30; four files never change;29 unrelated callbacks and held F1 byte-identical.

## C1 donor and canonical keeper

Donor `tests/product-identity-resolution.test.ts:97`, “unknown brand returns unresolved raw text with no confidence”. Keeper same file:35, “resolveBrandFromText returns an exact brand match without over-matching inside words”. `candidates.json` contains both complete original bodies and exact keeperAfter.

The donor builds one prebuilt Garnier catalog with empty aliases/lines, then resolves `Unbekannte Pflegecreme`. Keeper already resolves K18 successfully and then resolves `SK18 Leave-in Molecular Repair Hair Oil` against the existing two-brand array. The actual owner converts the array via `toCatalog` (270–281), attempts aliases and canonical prefix matching, and returns `none(rawText)` only when neither matched (446–450). For both negative calls every prefix comparison misses. The terminal owner377–387 receives only rawText; it has no access to input catalog, alias count, brand-record property spelling, category or state.

Transfer precisely these two missing assertions immediately after existing `assert.equal(nonMatch.brand, null)`:

```ts
assert.equal(nonMatch.confidence, "none")
assert.equal(nonMatch.reason, "unresolved")
```

The donor's other two contracts are already literal keepers: nonMatch.match is exactly none and unresolvedRawText is exactly the original SK18 input. Brand=null additionally remains. No duplicated assertion, input, call, table row or generated expected value is added. After transfer proof, remove the exact donor declaration and its private local catalog setup. No imports become unused.

This is not a claim that the two raw input strings or catalog records are identical. The removed German phrase is data for the unmodified-input return contract, not documented product copy or a supported alias. Its spelling is not preserved as a new fixture. The stronger keeper stresses token-boundary rejection and observes the same actual return. The prebuilt-catalog adapter remains in all other relational resolver keepers; empty-alias handling and prebuilt unresolved outputs remain in the dangling-line keeper. Canonical/alias conflicts, missing IDs, punctuation, output matchedText and successful relational/legacy adapters stay independent.

A future special case keyed to this one German sentence is not preserved; no current predicate or documented regression requires it. If main treats that arbitrary literal as an independent contract despite this closure, reject C1 rather than copying a new input into the keeper. This is one conditional semantic union, not automatic deletion credit.

## Actual-owner proof, unexecuted

`controls.json` contains complete unique `none` function anchor, exact source/mutant hashes, exact-one existing keeper command, phase-specific intended assertion text/line and ERR_ASSERTION/strictEqual requirements for four isolated valid faults:

1. none result discriminator → brand (existing match oracle).
2. none confidence → high (new transferred oracle).
3. unresolved reason → canonical_brand_exact (new transferred oracle).
4. unresolved raw text → lowercased text (existing exact raw-input oracle; both original donor and keeper contain uppercase bytes).

No mock/proxy replacement, setup exception or timeout is acceptable. Each main-run fault needs clean selected1, intended first keeper assertion failure, source byte restoration, clean selected1. The exact old donor also has all four oracles; this proposal does not claim its runtime red proof was performed. Full before/transfer/after five-file native proof is required by main, plus normal integrated checks. Static TS parse is not typecheck or fault proof.

## Rejected broader cuts / retained layer responsibilities

- Title composition is not wholly duplicated. Exact Neqi is observed by real Supabase-client/fake-HTTP mobile search; exact Syoss by scanResultTitle. Garnier combined-brand/line containment uses a separate appendDistinct branch absent from those compose-consumers. ProductCard and product-line-display examples use their own middle-dot formatter. All three live fields must stay; do not collapse whole title declaration on two matched examples.
- Blank-title test cannot safely move to scanResultTitle(null-brand): null differs from trimming whitespace, and scanResultTitle's `|| result.name` can hide an empty shared formatter. Keep it.
- Normalizers cover actual Unicode symbol/code-point and nullable wrapper differences, category registry/schema keys and lower parser output; no complete same-existing-input union at intake consumer boundary was established. Do not move fresh strings or loops into larger suites to get credit.
- Catalog conflicts are separate data rejection gates. Duplicate alias targets, canonical-brand collisions, and missing line rows can each fail independently; none is replaced by ordinary unresolved behavior.
- Phase0 schema policy is historical replay/compatibility, not current final RLS state. Phase5 intentionally exposes lines and adds lifecycle/owned-product policies. The later migration assertion reads a different file and cannot retire Phase0 security gates. No SQL execution claim.
- Correction operator is reachable at package products:identity:correct and exact direct-execution guard. Its helper outputs feed real upsert/update construction and guard before all writes. Keep all three tests; current registration and documented safety constraints refute obsolete/test-only retirement.

## Held F1 (zero credit)

The category seed guard can match a display label instead of key. `held-findings.json` records a valid key-only tuple corruption that still leaves the lowercased label matching the old regex. This is a static logical counterexample, not an executed mutant. Retain F1 unchanged in all snapshots; a separate bounded repair would anchor first VALUES field and require old-pass/repaired-red. No repair bundled into C1.

## Artifacts and guards

`manifest.json` holds all phase SHA256s,29 unrelated callback hashes and the full bounded readset. `sites.json` records complete AST statements/assertion lines for every phase. `snapshots/{before,transfer,cut}/tests/` contains all five files each. `complete.diff` is full before→cut and `transfer.diff` is the exact two-assertion transfer. `static-receipt.json` records parsing/phase reconstruction/current hash equality only. `commands.json` records the native command but has NOT_RUN status. No guarded runtime editor is supplied before main's semantic decision; it would not be meaningful to authorize a cut solely with static evidence.
