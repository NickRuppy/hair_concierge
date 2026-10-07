# Independent canonical identity31 preservation review

**Conditional PASS for C1 only; no static preservation blocker.** Main must still run the complete before/transfer/cut native cohort and the four isolated actual-owner controls. No test, owner, compiler, provider or database execution was performed in this review, and no repository file was written. Proposed declaration counts are **31 → 31 → 30**, not an applied removal.

Reviewed frozen packet `/tmp/test-audit-canonical-identity31`:

- Manifest SHA256 `0c952af62b35a52af39802a34879f5a697d9e26cfdcea38369e6602d334966b7`.
- Handoff SHA256 `33b7bbe5e4a4f149c0418bdc4482df976fc871279d56593a05052da438bee097`.
- Independent machine receipt: `/tmp/test-audit-canonical-identity31-independent-receipt.json`, SHA256 `bad4b835bd2e3222dc4a56e9062cd3a8c595b39df7ac08f8d6557a7ce152478a`.

## Exact preservation decision

Donor `tests/product-identity-resolution.test.ts:97`, **unknown brand returns unresolved raw text with no confidence**, builds a one-brand Garnier prebuilt catalog with no aliases or lines and resolves `Unbekannte Pflegecreme`. Keeper at line35, **resolveBrandFromText returns an exact brand match without over-matching inside words**, already resolves two inputs against the unchanged two-brand legacy-array fixture. Its existing negative input is `SK18 Leave-in Molecular Repair Hair Oil`; its positive K 18 input remains unchanged.

These are different strings, catalogs and adapter paths. They are equivalent only for the removed declaration's four assertions at the actual common unresolved return. I independently read the complete resolver and normalizer. `toCatalog` at270–281 either returns the prebuilt catalog or builds the legacy-array catalog. Alias and canonical searches use normalized whole-token prefix equality. For the donor, aliases are empty and Garnier's first token differs from Unbekannte. For the keeper, SK18 differs from both canonical brand tokens and all alias first tokens. Both searches therefore reach `if (!brandMatch) return none(rawText)` at446–450. The complete `none` function at377–387 has one parameter and reads no catalog, caller, environment, mutable state or normalized text. It returns constants plus the original raw string.

| Donor assertion | Existing keeper after transfer | Preservation |
| --- | --- | --- |
| `resolution.match === "none"` | `nonMatch.match === "none"` | Existing exact result discriminator |
| `resolution.confidence === "none"` | `nonMatch.confidence === "none"` | One added exact assertion |
| `resolution.reason === "unresolved"` | `nonMatch.reason === "unresolved"` | One added exact assertion |
| `unresolvedRawText` equals original German input | `unresolvedRawText` equals original SK18 input | Existing exact unmodified-input echo; different bytes explicitly acknowledged |

The keeper's seven original assertions remain byte-identical and in order; confidence and reason are inserted after `nonMatch.brand === null`. There is no new resolver/catalog invocation, fixture, input, row, render, mock implementation or expected-from-owner oracle. Removing the donor also removes only its local catalog setup. No import or production support cleanup is proposed.

The donor does not independently assert the Garnier canonical output, empty catalog policy, or a German-only normalization branch. Its two words contain no normalization feature absent from the retained uppercase/space/hyphen input. Prebuilt catalogs and empty usable alias arrays remain exercised by the complete retained conflict and dangling-line tests. In particular the dangling-line keeper explicitly checks `aliases.length === 0`, resolves Elvital against its prebuilt catalog, and asserts unresolved match/reason. The generic catalog adapter cannot safely be retired and is not proposed for removal.

A hypothetical future behavior keyed to the exact German fixture sentence is not preserved; neither current predicates nor the inspected identity standard/correction plan/history establish such a contract. This is not a general claim that different unknown strings can always be discarded. A current alternate branch, meaningful normalization operation or public literal would require retention. None was found for this donor.

## Current runtime/operator evidence and limits

Actual resolver consumers remain active; no reachability-based retirement is claimed. Named consumer search across `src`, `scripts`, `apps`, and `packages` found Product Intake lookup/submission, AgentV2 known-brand lookup, review CLI and research-worker prompt preparation. Independently read operative slices:

- `src/lib/product-intake/product-lookup.ts:465–575`: provided-ID and category/name gates precede real resolution; reads actual brand/product-line IDs and cleans the display name.
- `src/lib/product-intake/submissions.ts:604–650`: complete `resolveInputIdentity`; explicit-ID path remains distinct, otherwise real resolution feeds nullable IDs/display cleanup.
- `src/lib/product-intake/repository.ts:75–185`: actual brand/line/alias SQL column projections produce the prebuilt-catalog input. SDK transport was not executed or independently audited.
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts:975–1048`: real per-suffix lookup skips results lacking brand/matchedText and returns null if no suffix matches.
- `scripts/product-intake/review.ts:1–145`: real catalog loading and matchCandidates resolution consume nullable brand/line.
- `scripts/product-intake/codex-research-worker.ts:2060–2115`: real prompt context includes resolved metadata only for a non-none result with brand; otherwise preserves submitted text and computes nearby options. No special treatment of this donor sentence.

Resolver dependencies are the fully read pure `normalizeIdentityText` implementation and ECMAScript string/array/map operations. No injected mock owns its asserted receipt. I fully read the five target tests, including all tables/imports/fixtures: normalization8, resolution9, schema9, title2, correction3. The four pure identity source files (`index`, `normalize`, `brand-resolution`, `display-title`) were read completely. I read correction guard/projection/write-caller/direct-execution slices, not the entire 1042-line correction operator. Its registered `products:identity:correct` command and existing three tests stay untouched. I did not independently full-read the author's 49-file readset, entire SQL lineage, broad HTTP handlers, installed SDK/parser implementations or all adjacent consumer suites. Their pin equality is byte evidence, not semantic read credit.

`git log` for resolver/test identifies introduction in `b4fb21f4`; `git show` independently confirms both exact callback bodies already existed there. Current standard `docs/product-identity-normalization.md:65–145` requires conservative aliases, ambiguous-match review and raw evidence preservation; it does not define the donor sentence as product copy. Correction-plan matching sections retain specific real historical aliases; those tests remain. This narrow history check is not an exhaustive issue/remote history search.

`package.json:test:node` includes all five `.test.ts` files; `.github/workflows/ci.yml:quality-node` runs that command. `tests/server-only-register.cjs` only supplies the empty server-only marker; it does not replace the resolver or its persistence outcomes. No native runtime/package implementation was imported in this review.

## Exact static reconstruction

Independent standard-library byte/JSON/hash checks verified:

1. Both requested packet identity hashes and all12 handoff artifact hashes.
2. All49 current readset pins match, including five live before files; no repinning or metadata changes.
3. All15 phase snapshots match manifest hashes. Flat anchored test declaration names/counts agree with complete supplied sites:31/31/30. UTF-16 source offsets reproduce every complete declaration body and its hash; this was not a compiler or fresh TypeScript AST run.
4. Transfer is exactly the original file with the keeper body replaced by its two-assertion extension. Cut is exactly that transfer file minus the whole donor and separator. Every other byte in the changed file is accounted for by these two operations.
5. All29 unrelated callbacks are byte-identical in both prospective phases; the other four whole files are byte-identical. No hidden support/import edit.
6. Held F **product identity migration seeds all phase 0 product categories** remains exact. Its lowercased-SQL regex can match display label `Shampoo` after changing only the tuple key: a real static false-green possibility, not deletion justification. SQL tuple75–105 and complete test129–150 were inspected. No F repair or SQL mutation is included.

## Four controls: valid proposed first failures, unexecuted

All descriptors pin the actual source SHA256 `5182615a8419b477e73b0a00e05e78bb9436d8b7ad9c3c7f2d35850f65e48b8a`. Independently verified the complete `none` function anchor occurs once, each `from` once within it, and isolated replacement reproduces the exact recorded mutant SHA. All prospective oracle line/text/keeper hashes match transfer and cut snapshots.

| Control | Actual owner fault | First intended keeper failure in both phases |
| --- | --- | --- |
| none-match | `none` discriminator becomes brand | line43, strictEqual actual `brand`, expected `none` |
| none-confidence | confidence becomes high | line45, strictEqual actual `high`, expected `none` |
| none-reason | reason becomes canonical_brand_exact | line46, strictEqual actual `canonical_brand_exact`, expected `unresolved` |
| none-raw-preservation | raw echo lowercased | line47, strictEqual lowercase SK18 sentence versus exact original sentence |

The keeper's positive K 18 call does not enter `none`; each isolated fault leaves every earlier assertion in that keeper satisfied. This is source-based prediction, not a runtime result. Each descriptor requires `ERR_ASSERTION`, `strictEqual`, exact expected/actual values and FIRST keeper frame at the stated file/line. None has an ambiguous null message. A driver must match this structured tuple and exact frame rather than merely any assertion or any failure. Bare `assert.ok` inspection does not apply here.

Main must require one exact selected keeper pass, one intended failure with no skipped/cancelled/todo/setup/import/timeout substitution, byte-exact owner restoration, then one exact selected keeper pass for each control. The complete five-file cohort must pass before/transfer/cut under its native command. No browser/provider proof is needed or implied by this pure transfer. No source cleanup, extra quota or unexecuted sensitivity claim is authorized by this review.
