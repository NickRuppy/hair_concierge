# Stage 3 owned-search overflow — code-review receipt

## Review identity

- Branch: `codex/stage3-owned-search-overflow`
- Base: `origin/main` at `23626d7d5b6a4b8b2d7c85daa90033d518a8c18b`
- Canonical content fingerprint: `b9eea7738fee381cebb1e892008d5a70cc670125c7a55177fcecd1d50788630a`
- Fingerprint input: the same sorted SHA-256 manifest of 19 task-owned paths used by ready-check; both receipts are excluded to avoid self-reference.
- Lanes: normal functional review plus structural/concurrency review. Prior counterpart conclusions were reused only where unchanged; the final integration review's supported P2 finding was reproduced and fixed. Independent re-review of the pre-commit-hook formatting delta completed on the post-format canonical fingerprint.

## Findings disposition

No blocking functional, accessibility, data-contract, security, or structural finding remains.

The counterpart review raised one low-severity boundary concern: pure in-memory and fixture search reported `totalCapped: true` for exactly eight matches. Its claim that production shared that defect was rejected after tracing the live persistence call to the Supabase RPC and verifying the migration expression `matched_count > limit`. The supported part was accepted and fixed: both local implementations now derive the flag from the full matching set before returning at most eight candidates. New red-first tests prove exact-eight is false and a ninth match is true.

The final integration review then found one P2 async-authority defect. It was accepted in full and reproduced twice: a valid request remained authoritative after the query became too short, and an older rejection could overwrite a newer successful result. The fix gives every search effect generation a monotonically increasing token, deactivates the generation on cleanup, requires the local and echoed tokens on success, and requires current local authority on failure. The same boundary covers query, category, draft, gateway, phase, product-kind, debounce-context changes, and unmount.

The commit hook subsequently applied Prettier-only changes to three files: nested ternary indentation in the Labs client and line wrapping in two tests. Independent re-review confirmed that no executable expression, assertion, or control flow changed. Fresh checks on the post-format content passed the focused Stage 3 component/flow/gateway/inventory suites at 101/101 and `npm run typecheck`.

Other reviewed points:

- The response-token acceptance boundary updates results and `searchTotalCapped` together.
- Both fulfillment and rejection now fail closed when their effect generation has been cleaned up or superseded.
- Short queries, errors, category changes, add-another transitions, and explicit empty/manual boundaries clear the state.
- The notice is rendered only for a ready capped result, outside the listbox, with polite status semantics.
- The Labs catalogue injection is scenario-scoped and cannot alter the default or production gateway.
- Automatic recommendation selection, search ranking, the eight-result limit, RPCs, schema, and analytics remain unchanged.
- The extra full-set count is local to already-materialized in-memory arrays; the production RPC remains set-based and capped at the database boundary.
- Structural review found no need for a new request-manager abstraction: lifecycle authority remains local to the single effect that owns the debounce and promise. Shared test builders remove repeated race-fixture setup.

## Verification reviewed

- Red/green exact-boundary proof: 2 intended failures before implementation, then 30/30 focused gateway and inventory-contract tests passing.
- Red/green async-authority proof: 2/2 intended failures before implementation, then 3/3 required/preferred races passing.
- Focused Stage 3 component/flow/gateway/inventory suites: 101/101 passing; final flow suite: 57/57 passing.
- Full Personal Plan suite: 1,581/1,581 passing.
- TypeScript: passing.
- ESLint: 0 errors; five unchanged warnings outside task-owned files.
- Optimized gated build: passing.
- Rebuilt Stage 3 Playwright Lab journey: 4/4 passing, including the overflow/refinement scenario.
- `git diff --check`: passing.
- Ready-check and review fingerprints match.

## Verdict

**PASS — corrected, independently re-reviewed, and ready for publication.** No push, PR, merge, deployment, flag change, or production mutation was performed at this review boundary. Production visual confirmation remains a later post-deployment release check.
