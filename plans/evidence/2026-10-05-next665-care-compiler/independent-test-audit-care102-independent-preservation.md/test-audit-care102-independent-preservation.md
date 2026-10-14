# Residual care102 — independent preservation review

**CONDITIONAL PASS for C1 only. No blocking assertion-union, consumed-input, call-count or preservation gap found.** The exact proposed merge is102→102→101. Actual selected native clean/red/restored proof remains main-owned. No deletion credit or execution result is claimed by this review.

Packet `/tmp/test-audit-residual-care102-ezeu563r`, manifest SHA256 `946a680f03ce84419ba6e3dc31e6c155cbecb2d96d10f36b2ee3a1dc6cec1a9b`, handoff SHA256 `d926359a52cb978c073d649af31c99a2ca5ca3c5d6f9c54d8839a0355f8a6000`. HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`, worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`.

## C1: exact existing first compiler result absorbs the whole donor oracle

Donor: `tests/personal-plan-routine-candidate-compiler.test.ts:279`, “initial Routine preserves Stage-3 choices and canonical Basis then Optional ordering”. Keeper: same file:184, “initial Routine compilation is deterministic and excludes volatile portfolio metadata”. I read this complete901-line test file, including all12 callbacks, the complete refined snapshot, `portfolio`, `compilerInput`, and sibling version/identity/cadence fixtures.

Both donor and keeper first call are literally `await compileInitialRoutineCandidate(compilerInput())`. Default source revision7, expected draft revision12, schema1, user/plan/draft IDs, portfolio08:00 timestamp and shared refined snapshot are identical. Portfolio creates fresh object/arrays. Keeper's second existing call uses source revision7 and09:00 timestamp; it is preserved verbatim. There are no new compiler/fixture invocations, rows or input cases.

The source `src/lib/personal-plan/routine-candidate-compiler.ts:384–521` checks schema/plan, creates a fresh decision Map and item array, sorts that fresh array, builds new category/section objects, hashes an explicit preimage and returns a new candidate. It does not read current time, provider, storage, cache or mutable module state. `cadence.recommended` shares a frequency reference, but the compiler and cadence resolver only read it. The fixture is not actually frozen: “immutable” in the proposal describes observed usage, not an enforced `Object.freeze`. Full owner/callee inspection establishes that the keeper's second call cannot change the first result under the current path. There is no extra asynchronous dependency call after the first result to obscure the oracle.

All seven donor assertion expressions transfer **byte-for-byte**, in order, after the keeper's three original assertions. Only the preceding binding changes from `candidate.payload` to `first.payload`:

1. Exact two Basis/Optional sections and all item-key memberships.
2. Exact source rendered category order.
3. Exact intent category order.
4. Complete four-row ordered projection: item key, assessment, inclusion, availability, fit decision, executable and product kind for owned Conditioner, planned Oil, pending Heat and excluded Mask.
5. `applicationOrder` absent using `in`.
6. `dayTypes` absent using `in`.
7. `user_product_usage` absent using `in`.

The original fingerprint equality, payload equality and exact authority-version join remain verbatim. Negative own/inherited property checks remain `in`, not weaker undefined-value or serialization checks. Expected values remain independent literals; the compiler does not generate the added expectations. No donor assertion is replaced with status/coverage or title equivalence.

Full-file reconstruction confirms that apparent large movements of the neighboring delegated-cadence callback in `complete.diff` are diff alignment, not edits/reordering: that complete callback registration is byte-identical and remains in original sequence after the expanded first keeper. The only removal is the donor registration. No support/import/source cleanup is unlocked or proposed.

## Static preservation and pin results

Independent checker `/tmp/test-audit-care102-independent-static.cjs` passes **713 checks**. It imports only Node builtins and the installed TypeScript parser; it has no filesystem writes, owner/test imports or child-process APIs. Its stdout receipt is `/tmp/test-audit-care102-independent-static.json`.

- All21 phase files parse;102 before,102 transfer,101 cut.
- Full transfer reconstructed from the old keeper plus the exact donor block; full cut reconstructed by removing only the donor registration and its separating blank line.
- All100 unrelated complete registrations byte-identical through both phases; all six other whole files byte-identical, including four held F callbacks.
- Keeper transfer and cut registration identical,10 assertions (3 original+7 transferred), original two compiler inputs and helper calls identical.
- All102 author ledger callback SHAs correspond to independently parsed before snapshots. Classification remains97R/4F/1C.
- All83 original readset bytes match at inspection; no pin refresh or drift adoption. All frozen artifacts and phase hashes match.
- All13 mutation anchors occur exactly once inside the real `compileInitialRoutineCandidate`; original/whole-mutant SHAs match and complete mutant sources parse. Both phase oracle text/line/ordinal and exact selected single title match.

Counts per file are25 shampoo cadence,14 CareBalance targets,12→11 compiler,11 routine cadence,17 nested previews,11 catalog bundle,12 Stage3 contracts. These are AST declaration counts, not fresh native execution results.

## Thirteen source controls: plausible first assertions, UNRUN

The mutations change the actual compiler's returned payload, not fixtures, expected values or mock receipts. They deliberately corrupt both keeper results symmetrically, so original equality checks should pass; fingerprint is computed before the return-payload corruption. This makes the transferred literal oracle meaningful rather than relying on the old self-equality assertions. These output faults prove preservation of output contracts; they do not isolate every internal policy helper or hash algorithm.

| Control | Actual fault | Required first keeper assertion in both phases |
|---|---|---|
| C1-01 | Reverse copied sections at payload construction | line201, exact Basis/Optional sections, deepStrictEqual |
| C1-02 | Reverse copied source renderedOrder only | line211, fixed three-category order, deepStrictEqual |
| C1-03 | Reverse copied intent categories only | line212, fixed category projection, deepStrictEqual |
| C1-04 | First item key becomes `wrong-assignment` | line216, complete four-item projection, deepStrictEqual |
| C1-05 | First item assessment becomes optional | line216, basis expected |
| C1-06 | First item inclusion becomes excluded | line216, included expected |
| C1-07 | First item availability becomes none | line216, owned expected |
| C1-08 | First item fitDecision becomes standard | line216, informed_override expected |
| C1-09 | First item executable becomes false | line216, true expected |
| C1-10 | First item's product becomes kind none/displayName null | line216, owned productKind expected |
| C1-11 | Returned payload gains applicationOrder[] | line265, `true !== false`, strictEqual |
| C1-12 | Returned payload gains dayTypes[] | line266, `true !== false`, strictEqual |
| C1-13 | Returned payload gains user_product_usage[] | line267, `true !== false`, strictEqual |

For C1-04–10, sections and source/intent remain unchanged because the corruption maps fresh payload items after they were built; their earlier transferred assertions should pass. C1-11–13 add one property outside the satisfies object and leave previous fields intact. Expected decoded fragments are consistent with the literal mismatch; none is a generic timeout/setup error condition. New assertions are deep equality/strict equality; no new unmessaged `assert.ok` is introduced.

Main must still prove exact selected1 clean → actual ERR_ASSERTION at the expected **FIRST keeper frame**, correct operator and decoded fragments → owned byte-exact source restore → clean1 for each. Syntax parsing is not typechecking, module-import proof or actual caught-fault evidence. Do not accept any earlier assertion or another callback as equivalent. The packet's exact native keeper argv is anchored and selects the existing title once within its named file. I ran no controls or native tests.

## Retained risks, broader ledger and read limits

This independent assignment is a preservation review of the one compiler merge, **not a new full semantic re-audit of all102 sites**. I read all102 ledger entries/reasons and statically verified every body identity; I did not re-read every body/owner in the six unchanged suites. Their complete-byte equality is the preservation evidence here. In particular, product-preview17 has explicitly recovered current-byte prior evidence in the packet, not fresh17-site review credit from me. The author's85 fresh/17 recovered read-depth claim is not promoted to my own independent full-body count.

I independently fully read the changed compiler test12, all525 compiler source lines, complete canonicalize/cadence/authorities/editor/diff modules, and complete production recompute dependency wiring. Read exact caller/type/consumer slices: routine-proposal-stager1–150; Stage1 types1–70; production gateway985–1035; complete route185–245; direct-accept142–180; freemium provisioning220–250. Actual compiler gateway output is immediately supplied to the stager; current completion, direct acceptance, freemium and recompute callers demonstrate the owner remains live. This test directly executes compiler semantics, not gateway auth/DB/RLS/provider semantics; those remain separate.

The compiler siblings retain distinct contracts: exact delegated cadence/fingerprint, source revision7→8, missing refined category rejection, legacy supplemental category/renderedOrder rejection, v3 decision-key replacement identity, v3 replacement-over-pending precedence, v4 inventory exclusion, v1 pending identity, role-tier override and category-tier fallback. None is absorbed merely because it uses `compilerInput` or raw fixtures look similar. Imported editor/diff are full-read but not invoked by this compile export. Shared constants are inspected as read-only values, not independent proof that all authority versions/policies are correct.

I read the four held F callback bodies at catalog lines390–463. They retain SQL text assertions for atomicity/privacy/conflict/heat mapping/Oil insert and reviewed-head/clean-tree script strings. Their inability to establish execution is plausible from the literal readFile/assert.match shape; no old-false-pass fault was executed by this reviewer and no repair/cut credit is claimed. Other catalog data, schemas, full SQL lineage and operator implementation were not re-audited here. No category/schema/public role/cadence or catalog artifact contract is removed.

History: read-only log plus full commit messages for #387 (`f0505bd6` category alignment), #451 (`8afa1608` per-role tiers), #383 (`032245c5` replacement/version compatibility). The existing Stage4 plan scope/non-goals72–108 gives Basis/Optional, assignment states and Stage5 separation; cadence plan52–82 gives category vs exact-product cadence authority. Those explain why the transferred literal/negative assertions remain meaningful. Neither age nor helper status is retirement evidence.

CI read: package exact Node commands and full nested runner, `.github/workflows/ci.yml:145–166`. Six top-level files run in test:node; nested previews run in test:personal-plan:nested via recursive discovery. Marker hook/parser are identity/infrastructure reads; no native crypto/Zod/runtime engine execution or full dependency-internal audit is claimed. The selected default compiler path does not invoke Zod parsing; Zod-backed sibling schemas remain unchanged.

## Tooling caveat and handoff

**Do not invoke the sealed packet's `static-check.cjs` as a read-only check.** Its lines21–22 call `fs.writeFileSync` on controls.json, phase-inventory.json and static-check.json. It does not write the checkout, but invoking it can rewrite the sealed proposal and invalidate artifact hashes. I only read that script and did not run it. The separate independent checker provided here is actually read-only; this is a tooling-use qualification, not a semantic merge blocker or a request to alter the frozen packet.

Only fresh `/tmp/test-audit-care102-independent-*` outputs were written. No repository/source/test/config changes, application/test imports, child runners, provider/database/network operations, compiler execution or counterpart dispatch. Main owns all source faults, native/CI/coverage and integration. The proposal earns no campaign credit until those proofs complete.
