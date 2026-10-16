# Oil bridge v1 planning reconciliation

2026-10-12. [Plan](../oil-intake-bridge-v1-plan-2026-10-12.md). Planning only; no implementation/activation.

## Scope and decisions

Nick selected “Yes—manual matching tags for v1 (Recommended)”. The proposed implementation is an offline complete-envelope projector plus inactive intake helper. Only existing singleton weight/role_support/heat are projected. Rich research, canonical persistence and conditional scenario fit remain complete artifacts. Legacy matching tags remain outside adapter ownership. No new DB columns, auto-routing or recommendation/scheduling changes.

## Findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| P1 | defect hypothesis | Earlier migration appeared to drop heat in the oil update | Rejected | No SQL repair | Explorer traced effective public→scanned identifier→thumbnail→without canonical guidance chain: heat upsert and later weight/role update are separate; neither erases the other. |
| P2 | scope constraint | Generic enrichment allowlist and cockpit row list omit product_oil_specs | Accepted | Offline summary/inactive helper only; activation must address omitted routes | Current-main allowlist, validator and review enumerator inspected. No claim that generic enrichment or cockpit is ready. |
| P3 | retention boundary | Worker appends artifacts; legacy prepare/approve-package does not | Accepted | Explicit local-v1 vs future-worker vs manual-payload retention distinction | Worker append/repository schema and manual approval call chain traced. No artifact-store guarantee inferred from manual package approval. |
| P4 | defect in initial planning shape | Complete admitted envelope requires scalar; prewash/scalp-only exclusions cannot supply it | Accepted | Explicit typed exclusion input, no fabricated profile/scalar; incomplete source context still needs_research | Internal contract review; add positive valid-exclusion and negative incomplete-exclusion fixtures to implementation checks. |
| P5 | product/architecture choice | Legacy eligibility is binary and not role/scenario aware; legacy flags differ from research flags | User selected | Manual matching v1; preserve full scenario fit and current matching policy | Exact user answer recorded in plan; no automatic subtype/eligibility or persistence penalty. |

## Completed counterpart review

Claude returned **Approve with revisions**, exit 0, on the complete plan. Requested model opus resolved to claude-opus-5; effort high; terminal read-only, with only Read/Grep/Glob available. No nested reviewer or implementation was dispatched. The authenticated wrapper remained silent and was stopped; the successful retry disabled unrelated integrations and automatic customizations, then explicitly read the review and planning skills. Prior auth/timeout attempts remain historical diagnostics, not a current gate.

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | verify-oil-targeted-coverage-v0.2.py:76 writes verification-receipt.json from main | Accepted | Exact importlib + validate() command, no main invocation | Executed read-only entry point; targeted checks pass and all 93 preserved hashes match. |
| C2 | defect | Three selected profile containers have size_ml, size, optional identifier variants and combined market_size shapes | Accepted | Explicit identity mapping table, original identity retained, nullable missing metadata; no guessed variant/size | Inspected identity-key shapes across all 37 records, including the four combined declarations the review sample did not cover. No research record edited. |
| C3 | clarity defect | Current tuple and historical per-field authorities have different meanings | Accepted | Tuple explicitly pins consolidation_serialization; required original_method container/run/hash/declaration plus original per-field authorities | Verified all three containers record run_id/scope, not one uniform classification version. Existing prohibition on relabeling remains. |
| C4 | defect | Leave-In CLI throws on invocation/I/O errors, defaulting to exit 1 | Accepted | Oil main catches errors as exit 2; exit 1 reserved for produced needs_research | Current prior-art CLI:134–141 confirms throw path. Require child-process exit/output boundary tests during implementation. |
| C5 | verification gap | Exact test commands/router guard were unnamed | Accepted | Named four future oil test files, existing router regression, typecheck/lint/diff commands and ready-check follow-through | Existing router test:128–145 exercises engine_not_available; current package scripts and imports resolve. Future oil tests are implementation tasks, not claimed executed. |
| C6 | claim about missing gate | Reviewer could not find test-audit in repo | Rejected in part | Clarify personal skill discovery; retain authoring gate | Available /Users/nick/.codex/skills/test-audit/SKILL.md exists and its authoring gate was read. It is not an npm script. |
| C7 | handoff clarity | Strict oil validator requires nonempty eligibility beyond singleton | Accepted | Explicitly state property_projection_ready cannot satisfy approval alone | Current category-validators.ts:602–626 checked; no automatic matching mapping introduced. |
| C8 | verification gap | H04 known unknown-weight outcome not pinned in plan | Accepted | Require H04 needs_research and independent per-case expected status/reason receipts before projection | H04 inventory identity confirmed; do not invent 36 other ready outcomes before admission validation. |
| C9 | consistency | Custom status names/script placement, research UUID distinction, output symlink handling | Accepted clarification | Reasons for names/layout; research_id = oil:product_key; submission_id gates helper; lstat/staging boundaries explicit | Current worker/helper interface and local CLI prior art checked. No registry status or activation changed. |
| C10 | scope tradeoff | Mask precedent has no inactive helper | Rejected scope reduction | Keep approved deliverable 3; explain preparation purpose | Approved bounded helper scope retained. No new owner decision needed; no runtime caller added. |

**Orchestrator verdict:** ready for the bounded inactive-adapter implementation after the verified technical revisions above. Claude's original verdict remains conditional; this is local reconciliation, not a second unconditional Claude approval. Changes clarify representation, diagnostics and verification without changing product semantics or approved scope, so no review rerun solely for a cleaner approval sentence was performed.

Decision coverage remains confirmed using the original “lets do it” planning authorization and explicit manual-matching answer. Undiscussed consequential assumptions affecting this handoff: none. Separate UX sign-off is inapplicable to the offline/inactive scope. Activation, new matching policies, schema additions and publication remain outside this plan.

Local evidence: 14 integration hashes and 12 frozen policy hashes match; primary main was clean at dd60acc4e89c40b21d5e3fe39c5834915b74c3be. Read-only targeted checks pass four cases, 64 ranks, seven scenario roles and six corrected ranks. All 93 prior research hashes remain unchanged. Markdown links resolve and whitespace checks pass. No new implementation tests, runtime, browser, DB or migration checks were run for this planning-only change. The actual 37-case adapter replay remains implementation work.

Next: create a fresh current-main-based implementation worktree, transfer the owned research/plan with preservation hashes, and implement deliverables 1–3 as the bounded inactive bridge. Keep oil routing unavailable and legacy matching manual. No repair/growth/toning/persistence-fit policy was introduced.

Disposition: plan, this concise reconciliation and receipt are commit-intended but uncommitted. Discard the exact owned temporary review prompt/events/report after retaining verdict, findings, hashes and diagnostics in the receipt. Preserve all research and unrelated task dirt/stashes. No commit/push/PR/production/activation.
