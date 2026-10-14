# Orphan-source hygiene: guarded plan (zero test-declaration credit)

## Scope and authorization boundary

This plan prepares only the closure already established in
`/tmp/test-audit-remaining27-reachability-ledger.md`: 13 orphan source modules (13 whole-file deletes),
and the test-only `src/lib/personal-plan/products/index.ts` forwarding barrel, and
the one unused `projectBuildOrFixRoutinePlan` export alias. It removes no
product fallback, rollback, Labs, selector, planner, shared `cn`, Icon, package,
or operator capability. It is source hygiene only: **0 AST test declarations**.

The 13 deletion candidates are the two quiz leaves, `result-offer-countdown`,
nine unused UI primitives, and `lib/routines/product-attachments`; the machine
manifest records each path and current SHA-256. The barrel is a 10-line
export-star façade. Its only resolved importers are the three retained Stage 3
Node suites; their current 35 + 12 + 10 callbacks remain, with import sources
retargeted to their original direct owner modules. The export alias is used
only as a test title token; real consumers call `projectRoutinePlan` or
`createBuildOrFixRoutineTool`.

## Execution path checked

- Agent runtime: `src/lib/agent-v2/production/chat-pipeline.ts:2,1274` and
  `src/lib/agent-v2/compare/run-agent-v2.ts:2,714` import and call
  `createBuildOrFixRoutineTool`; its body delegates to `projectRoutinePlan` in
  `src/lib/agent/tools/build-or-fix-routine.ts:475-480`. The deprecated alias
  at line 483 has no import/call.
- The retained Stage 3 tests currently import the barrel at
  `tests/personal-plan-stage3-state-machine.test.ts:24`,
  `tests/personal-plan-stage3-contracts.test.ts:15`, and
  `tests/personal-plan-stage3-portfolio.test.ts:10`. The direct targets are
  `authorities`, `contracts`, `state-machine`, `product-load-resolution`, and
  `portfolio`; the transform preserves every binding and every non-import byte.
- The orphan pair edge is local only: `quiz-profile-card.tsx:3` imports
  `quiz-card.tsx`; no static import resolves to either leaf. The scan comments
  in `src/components/scan/scan-flow.tsx:46` and `scan-save-sheet.tsx:10` name a
  separate unmounted toast store and do not import `components/ui/toast`.

## Staged driver

`/tmp/test-audit-orphan-source-hygiene-driver.cjs` is intentionally not run by
this review. It requires the manifest’s exact hashes and operates from the
worktree root.

1. `node /tmp/test-audit-orphan-source-hygiene-driver.cjs --check`
   parses TypeScript AST import/export/`require`/literal dynamic-import edges
   across `src`, `apps`, `packages`, `scripts`, `tests`, and `supabase/functions`, resolving `@/*` and
   relative imports. It fails if any deletion candidate has an edge, if the
   barrel has other than the three known importers, if an import binding lacks a
   known direct owner, or if the alias token occurs outside its known test title.
   It snapshots all source candidates and donor test files under a unique `/tmp`
   directory and prints that path plus the two focused commands.
2. Review the JSON and snapshot. Do not apply on hash drift, a new import,
   namespace/dynamic use not resolved by the parser, or a changed direct-owner
   mapping.
3. `node /tmp/test-audit-orphan-source-hygiene-driver.cjs --apply`
   performs the entire check again, then rechecks every source hash and every
   donor import before its first write. It changes only the three import blocks,
   deletes exactly the alias line, and unlinks exactly the 14 source files. It
   then re-parses/validates bindings and absence. It never runs tests.

Main verification before and after apply:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-state-machine.test.ts tests/personal-plan-stage3-contracts.test.ts tests/personal-plan-stage3-portfolio.test.ts
node --import ./tests/server-only-register.cjs --import tsx --test tests/agent-routine-tool.spec.ts
```

The first focus has 57 retained callbacks (35/12/10); the second has 14. The driver now requires the exact target worktree path and validates all three donor-file hashes before any write. Review
before/after TAP counts and the driver receipt before any broader checks.

## Holds and limits

The parser proves literal static edges and literal `require`/dynamic imports in
tracked project code. It cannot prove a runtime-computed path, external SDK
consumer, or untracked generated artifact; any such evidence is a hold. It
will also hold on source drift because other work is active. CSS occurrences of
`.quiz-card` are styling selectors for other live components, not imports of
`QuizCard`; the driver deliberately does not delete CSS or namesake classes.

## Read-only preflight receipt

On 2026-10-03, the corrected driver’s `--check` path completed from the exact
pruning worktree. It found precisely 14 proposed whole-file deletes, the three
expected barrel importer files, and the single alias title occurrence; it
created `/tmp/test-audit-orphan-source-hygiene-receipt-2026-10-03T10-31-50-547Z`.
This is only a static, hash-locked preflight, not a source change or test result.

## Main decision coverage and execution contract

Original authorization: Nick requested a 20% low-value test reduction with coverage within 2%, then explicitly directed Codex to determine reachability rather than ask him to identify retired features. This narrow source cleanup follows the campaign's removal of obsolete seams; it earns zero test credit and changes no supported behavior. Main remains sole repository writer.

Settled: delete only the documented orphan closures, test-only forwarding façade, and unused export alias. Retain shared modules/packages, supported Labs/operator/rollback capabilities, all 71 focused cases, and all public production paths. No rollout, persistence, payment, access, product, data-ownership or recovery decision changes. No publication or provider/database action. Routine choices: direct owner imports, hash/AST staging, serial before/after focused proof, formatting, full CI and final coverage on the frozen integrated tree. New consequential choices: none.

Main inspected the driver and required an extra guard: every literal import/re-export/require/dynamic-import edge to the barrel must equal exactly the three expected top-level named import coordinates. Corrected read-only check passed at /tmp/test-audit-orphan-source-hygiene-receipt-2026-10-03T10-42-05-282Z. Computed loaders and external consumers remain stated limits; supporting graph/loader/history evidence is in 2026-10-02-remaining27-reachability-ledger.md.

Execution: read-only terminal Claude plan review, verify findings, 71 native green before, exclusive guarded apply, formatting, 71 green after, diff check and unchanged AST count; then integration CI/native/c8. Stop before publication. Transient driver/review/controls stay outside the repository.

## Counterpart review disposition

Claude read-only plan review completed /tmp/test-audit-orphan-source-hygiene-plan-review.md: no technical blocker; independently confirmed all paths, importers, alias and hashes. Its request for another source-cleanup approval is advisory scope interpretation, not a workflow requirement: Nick explicitly asked to remove obsolete parts, delegated reachability, and invoked a skill whose edit shape removes dead production paths. Removing unused, non-exported application leaves is reversible task-owned cleanup under that scope. No public SDK/design-system library contract or promised future consumer exists. No new product decision is introduced; main proceeds under existing authorization.

Reviewer count speculation34/70 is false: actual focused native before TAP reports71 cases,71 pass,0skip on current302 tree. Root-level/plan executable edge scan independently found no importer. Partial apply recovery must restore only files listed in snapshot from their actual pre-apply bytes; never blanket git restore, because this dirty worktree contains earlier authorized changes. Transient review stays/tmp.

## Applied receipt

Main exclusive guarded apply completed 2026-10-03: exactly14 source files removed, three direct-import rewrites, unused alias removed; snapshot/tmp/test-audit-orphan-source-hygiene-receipt-2026-10-03T10-54-08-443Z. All71 native cases green before and after,0skip. Formatter completed four files. The two scanner comments now reference the actual mounted provider without naming the removed store. No test declarations removed or added: campaign credit remains302. CI/fullcoverage pending integrated freeze.
