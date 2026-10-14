# Final144 local coverage diagnostic — 2026-10-02

Read-only comparison of `/tmp/test-audit-baseline/coverage-final.json` and
`/tmp/test-audit-retirement-final144-proof/coverage-final.json`, checked against
`git show HEAD:<path>` and the applied worktree. No test/provider command or
repository mutation was performed here.

## Finding

Neither new decline represents a newly-uncovered surviving executable contract.
Both arise from deleting covered helpers and from c8/esbuild module-export maps.
The file percentages are therefore poor local ratios, while the remaining real
source remains exercised where it has runtime behavior.

## `src/lib/personal-plan-quiz/loading-timeline.ts`

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Functions | 7/8, 87.50% | 3/5, 60.00% | -27.50pp |
| Branches | 14/16, 87.50% | 3/5, 60.00% | -27.50pp |
| Lines | 28/28, 100.00% | 14/15, 93.33% | -6.67pp |
| Statements | 28/28, 100.00% | 14/15, 93.33% | -6.67pp |

`HEAD` contained only one removed executable helper:
`getPersonalPlanLoadingProgress` at old `:17-28`. Its two function-map entries
were both executed four times; its six source branch-map entries all had nonzero
counts (4, 1, 3, 3, 1, 12). Those are retired covered code, not remaining UI
logic.

The current module retains the static three-stage definition at `:1-13` and its
type at `:15`. The actual quiz component consumes that stage data directly at
`src/components/personal-plan-quiz/personal-plan-quiz.tsx:85,1550-1655`; it owns
the current progress calculation itself. There is no caller of the removed
helper.

The remaining local misses are transformed-map artifacts: after c8 reports the
line-1 `get` export helper as 0 and the static-export mapping as 0, and maps
statement/line `:13` (`] as const`) to 0. All preceding array initialization map
entries (`:1-12`) are executed. The baseline likewise mapped the static
`PERSONAL_PLAN_LOADING_STAGES` export itself to 0, so no new executable stage
behavior changed from covered to uncovered. The 13 line/statement denominator
loss is the 12 helper lines plus one instrumentation mapping, not a remaining
progress branch.

## `src/lib/personal-plan-field-test/token.ts`

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Branches | 14/16, 87.50% | 11/13, 84.61% | -2.88pp |

`HEAD` removed `verifyPersonalPlanFieldTestToken` at old `:12-16`. Its whole
function branch map had 3 hits and its timing-safe comparison branch map had 2
hits. The third removed branch entry is the generated line-1 export mapping for
that function (3 hits). Thus all 3 lost total/covered branch entries belong to
the deleted verification helper.

The retained executable token behavior remains exercised: actual
`issuePersonalPlanFieldTestToken` (`:3-6`) has 4 executions before and after;
`hashPersonalPlanFieldTestToken` (`:8-10`) has 15 before and 12 after. The
three fewer hash calls are exactly the three deleted verifier calls. The field
test server still hashes incoming tokens at
`src/lib/personal-plan-field-test/server.ts:123-126,187-190`, and existing tests
retain issuance/hash and server-hash assertions. No branch in either surviving
function became uncovered.

## Limits

c8 source maps count generated CommonJS/export helpers and can map a TypeScript
type/array closing line as an uncovered statement. This review establishes only
coverage attribution and retained source reachability; it does not rerun UI or
field-test behavior. The final global and fixed-original-denominator coverage
proof remains the controlling threshold evidence.
