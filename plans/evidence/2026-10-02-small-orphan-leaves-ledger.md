# Remaining test-only leaves — read-only validation ledger

Scope: `test-audit-pruning` at `21e0e41f`; no repository edits, runners, or
provider calls. `D` means source deletion is evidence-supported; `R` means retain.
All declaration counts are TypeScript AST top-level declaration counts. No candidate
is a whole test-file deletion: every named test file has surviving contracts.

## Per-declaration verdicts

### getPersonalPlanLoadingProgress — D

- Declaration: `src/lib/personal-plan-quiz/loading-timeline.ts:17-28`; AST count **1**; source unlocked.
- Actual path: no executable caller/import other than `tests/personal-plan-quiz.test.ts`; it reaches the public barrel only through `src/lib/personal-plan-quiz/index.ts:3`.
- Stronger live owner: the loading UI directly consumes `PERSONAL_PLAN_LOADING_STAGES`, not this helper, in `src/components/personal-plan-quiz/personal-plan-quiz.tsx:85,1543-1680`.
- History: introduced in `b741dd37`; deployed `3abfe00a` also contains the orphan.
- Test impact: remove the one whole AST test declaration, **1**: `loading progress is monotonic across its three stages` at `tests/personal-plan-quiz.test.ts:416-428`, plus import `:13`.
- Risk/check: retain `PERSONAL_PLAN_LOADING_STAGES` and verify the loading render/animation path plus typecheck after barrel export removal.

### verifyPersonalPlanFieldTestToken — D

- Declaration: `src/lib/personal-plan-field-test/token.ts:12-16`; AST count **1**; source unlocked after a field-test security/operator audit.
- Actual live/dormant field-test contract: `scripts/personal-plan-field-test-campaign.ts:10,278-301` issues a 256-bit token and prints its bearer link once; `src/lib/personal-plan-field-test/server.ts:21,119-150,181-198` hashes submitted tokens before DB lookup; public entry routes add enabled/auth/cookie gates. Neither runtime nor operator code calls `verifyPersonalPlanFieldTestToken`.
- Required keepers: `issuePersonalPlanFieldTestToken` and `hashPersonalPlanFieldTestToken`; deleting either breaks campaign creation or runtime lookup.
- History: introduced in `02a84108`; deployed `3abfe00a` has the stale comparator.
- Test impact: **mixed test, retain its AST declaration.** In `tests/personal-plan-field-test-primitives.test.ts:24-35`, remove the verifier import and assertions `:32-34`; retain entropy and SHA-256 equality assertions `:25-31`. Whole test declarations removed: **0**.
- Risk/check: removing this convenience timing-safe comparator must not be described as changing bearer-token security. Keep positive/negative resolver and entry-route cases; validate command dry-run, active/revoked/expired campaigns, generic unavailable responses, and enabled gates. Do not execute the write-gated campaign command.

### detectBrandAliasConflicts — D

- Declaration: `src/lib/product-identity/brand-resolution.ts:201-226`; AST count **1**; source unlocked.
- Actual path: no executable caller. It duplicates the stronger production algorithm in `buildBrandResolutionCatalog` at `:327-417`, which computes canonical-brand and brand/product-line alias conflicts, filters conflicting aliases, and returns `catalog.conflicts`.
- Stronger live owner: the catalog serves product intake runtime/review/worker consumers at `src/lib/product-intake/product-lookup.ts:521`, `src/lib/product-intake/submissions.ts:849,1021`, `scripts/product-intake/review.ts:99`, and `scripts/product-intake/codex-research-worker.ts:2079,2111`.
- History: came with `b4fb21f4`; deployed `3abfe00a` retains the duplicate.
- Test impact: remove the one whole AST test declaration, **1**: `detectBrandAliasConflicts reports duplicate normalized aliases with conflicting targets` at `tests/product-identity-resolution.test.ts:245-260`, plus import `:6`.
- Risk/check: retain broader catalog conflict and product-intake normalization tests. Validate that conflict filtering covers product-line aliases; do no intake operation/write.

### cockpitVoiceOrNull — D

- Declaration: `src/lib/discovery/cockpit-copy.ts:265-267`; AST count **1**; source unlocked.
- Actual path: all cockpit renderers use non-null `cockpitVoice` directly: `src/components/discovery/cockpit/discovery-call-cockpit.tsx:13,492,498,910,1153,1271` and `runsheet-routine.tsx:2,125`; no caller passes nullable content to the wrapper.
- History: added with neutral-cockpit work in `694cb9a6`; present in deployed `3abfe00a`.
- Test impact: **mixed test, retain its AST declaration.** In `tests/discovery-cockpit-copy.test.ts:148-165`, remove wrapper import and only assertions `:162-164`; retain the unknown-string pass-through assertions for live `cockpitVoice`. Whole test declarations removed: **0**.
- Risk/check: preserve `cockpitVoice`, `COCKPIT_VOICE_MAP`, exact-match/no-blind-rewrite behavior, and shared participant sources. Inspect nullable call sites after integration.

### findAsciiGermanOrthography — R

- Declaration: `src/lib/german-orthography/ascii-transliterations.ts:112-129`; AST count **1**; source locked by the CI source guard.
- Actual path: `tests/agent-v2-german-orthography.spec.ts:352-369` calls it over each model-facing source line, applies allowlist exceptions, and emits file/line/detector diagnostics. The suite is in `npm run test:agent` (`package.json:68`), run by CI (`.github/workflows/ci.yml:164`). Runtime separately uses `hasAsciiGermanOrthography` at `src/lib/agent-v2/validation/user-facing-language.ts:2,89-93`.
- Architecture/history: the shared source guard is explicitly required by `plans/2026-06-01-agentic-german-orthography-cleanup.md:13,145-159,314-328`; added in `7e10a965`; deployed `3abfe00a` contains it.
- Test impact: remove none. Its direct dependent test declarations are **3**: `AgentV2 production model-facing sources use standard German orthography` (`:352`), `ASCII German orthography detector catches curated domain compounds` (`:371`), and `ASCII German orthography detector ignores ordinary ue letter pairs` (`:384`).
- Risk/check: deletion would weaken required detailed CI diagnostics or duplicate detector logic. Retain ordered-match behavior and run the targeted agent orthography suite during normal integration.

## Totals and safe integration checks

- Declarations reviewed: **5**; `D = 4`, `C = 0`, `R = 1`.
- Eligible source AST declarations: **4**. Eligible whole-test AST declarations: **2**. Mixed retained tests requiring narrow import/assertion removal: **2**.
- First typecheck/static-import audit, then Personal Plan quiz, field-test primitive/resolver/entry-route, product-identity/product-intake, discovery cockpit, and agent orthography suites. No field-test campaign creation, database write, provider call, or operator action is needed for the pruning change.
