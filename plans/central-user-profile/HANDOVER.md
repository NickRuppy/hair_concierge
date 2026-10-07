# Handover — Central user profile program (PR1 start)

Written 2026-09-15 by the planning session. Read this first, then the plan. Do not re-open decisions.

## 1. Where you are

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/care-habits-source-of-truth`
- Branch: `codex/care-habits-source-of-truth`, base `9f1a3dc4` (verified == `origin/main` at creation; re-verify with `git fetch origin && git merge-base --is-ancestor origin/main HEAD || echo "main moved: rebase before starting"`).
- Plan of record: `plans/2026-09-15-care-habits-source-of-truth.md` — **Rev. 10, FINAL**. Decision coverage `confirmed`, evidence review confirmed, journey signed off by Nick 2026-09-15. §4 + §4a are the technical contracts; §8 the ordered tasks; §11 the Codex ledger (28 findings, all reconciled).
- Evidence: `plans/central-user-profile/evidence/` (current/proposed screenshots, review page). Mockup artifact: https://claude.ai/artifact/6SdJUBpLDCVgZvyUnuzUAC (copy A/A chosen).
- Memory: `~/.claude/projects/-Users-nick-AI-work-hair-conscierge/memory/project_care_habits_source_of_truth.md` (update it as you go; index line in `MEMORY.md`).
- Related, parked: onboarding retirement in `.worktrees/retire-onboarding` (base 4935b271, needs rebase; lands after this program and Hair Tools PR #465). Side bug chip: legacy prefill selects nonexistent `hair_profiles.shampoo_frequency` (`stage2-optional-entry.ts:335`) — separate task, but PR3 deletes that loader anyway.

## 2. What this program is (one paragraph)

`hair_profiles` becomes the single mutable source of truth for user facts: `diagnostics` (native v3 quiz vocabulary + verbatim `source.raw`), `care_habits` (full Feinschliff answer set + brush), `quiz_context`, `facts_provenance`, `facts_revision`; legacy narrow columns stay as derived projections computed by one write function. Personal-Plan versions remain immutable snapshots. Three PRs: **PR1** storage + write function + every writer + backfill (no user-visible change) → **PR2** compute reads the profile + diagnostics rebase lane + editor copy → **PR3** profile surfaces + translator retirement. Then Hair Tools #465, then onboarding retirement.

## 3. Your first actions (in order)

1. `npm run worktree:list`; confirm you are in the worktree above; `git status` (plan + evidence are committed on the branch).
2. State the implementation-loop contract (`.agents/skills/implementation-loop/SKILL.md` §1) — prefilled:
   ```text
   Outcome: PR1 of plan Rev. 10 — hair_profiles facts domains, user_facts_save_v1, every writer switched, backfill script; no user-visible change.
   Scope: plans/2026-09-15-care-habits-source-of-truth.md §8 tasks 1–7 only.
   Decision coverage: confirmed (plan §5, Rev. 10).
   Confirmed with Nick: plan §5 "Confirmed with Nick".
   Inherited from evidence or contract: plan §5.
   Implementation defaults: plan §4/§4a.
   Open consequential assumptions: none.
   Undiscussed consequential assumptions affecting this handoff: none.
   Coverage acknowledgement: Nick 2026-09-15 (plan §5).
   Internal revalidation: Rev. 10 vs origin/main 9f1a3dc4 — re-verify base.
   Verification: plan §9 (PR1 rows) + ready-check.
   Stop: before commit of implementation? No — commit per task on the branch. Stop before push/PR/production writes.
   ```
3. Run `branch-gate` (mandatory; answer: reuse this branch), then `superpowers:subagent-driven-development`. Create its ledger (`scripts/sdd-workspace <plan>`), do the pre-flight conflict scan of tasks 1–7 (write the table), then dispatch Task 1.
4. Before Task 3: check whether a local Supabase can run (`supabase start` / Docker). If not, the two-session concurrency tests are a documented manual lane; logic tests use the existing PGlite harness (`tests/personal-plan-complete-stage2-module-migration.test.ts` shows the pattern).

## 4. Model routing (CLAUDE.md "Multi-Model Orchestration")

- Main session = orchestrator: decomposition, test-first design per task (fixtures, invariants, acceptance checks), verification of every handback (read the full diff, run the suites yourself), integration. Never rubber-stamp.
- **Opus** (judgment tier): tasks 3 (migration + `user_facts_save_v1` + RPC tests), 6 (backfill decoders + head traversal), and in PR2 tasks 9, 9b, 10, 11, 12.
- **Sonnet** (execution tier): task 1 fixtures once shapes are fixed, task 2 derivation tables (rules fully specified in §4), task 4, task 5 writer switch (multi-file mechanical), PR3 deletions/serializer/surfaces.
- **Adversarial lane** (feedback memory "my own green tests aren't evidence"): for derivation tables, precedence rules, round-trip guarantees — a separate agent (Sonnet) writes adversarial fixtures from the plan text without seeing the implementation; run them before task review.
- Always pass `model` explicitly on dispatch; never let subagents inherit Fable. Briefs are self-contained (objective, owned files, may-edit, constraints, non-goals, acceptance checks, evidence to return); parallel writers need disjoint write scopes; report status DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
- **Codex** = reviewer lane only: `codex:codex-rescue` AGENT (never the `/codex:rescue` skill), read-only brief, `--effort high`, no `--write`. Whole-branch review before push. Poll from the worktree cwd: `node ~/.claude/plugins/cache/openai-codex/codex/1.0.2/scripts/codex-companion.mjs status <job>` / `result <job>` (the job list is per-cwd; from another cwd it says "No jobs recorded").

## 5. Test-first rules that apply here

- TDD for `src/lib/personal-plan/`, `src/lib/user-facts/`, SQL functions: red proof first (`.agents/skills/implementation-loop/references/test-first-quality.md`).
- Run suites via npm scripts only (`npm run test:node`, `npm run test:personal-plan`, `npm run test:personal-plan:nested`), never bare `npx tsx --test` (server-only shim).
- `npm run ci:verify` (typecheck + lint + build) in ready-check; full `test:node` too (scan-hardening learning).
- Migration file names: check the latest timestamp in `supabase/migrations/` to avoid a version collision; one migration per concern.

## 6. Repo traps (from memory)

- Bash cwd silently resets to the repo root between calls: use absolute paths for every write; on odd `.next`/typecheck errors check `pwd`.
- Next dev hot reload serves stale deep-lib code: restart the dev server before manual verification; use `localhost`, never `127.0.0.1`.
- Dev login for manual checks: `http://localhost:<port>/api/dev/login?next=/profile` (`docs/local-qa-access.md`); the dev account has no Personal Plan — use `/labs` harnesses for plan surfaces.
- Worktree dev server: `npm run dev:worktree` (port 3637 for this worktree).
- Supabase MCP (project `pqdkhefxsxkyeqelqegq`) works for read-only production counts; never write to production from a session — Nick applies migrations/backfill after seeing the dry-run diff (H8).

## 7. Contracts you must honor (short list; details in plan §4/§4a)

- Facts first, snapshot second. One write function; derived columns computed inside it; `facts_revision` CAS; `create_only` for account linking; optional draft binding validated inside the facts transaction.
- Provenance per domain with per-field overrides; `unknown_historical` when not provable; `assumed` markers propagate.
- `diagnostics.source.raw` verbatim; `toStage1Source` re-emits raw until the first native edit (identical `input_hash` for unchanged users — test it for v3, v2, legacy).
- Backfill: diagnostics artifact → lead → columns (artifact wins, P4); habits from the immutable Stage-2 head (traverse Stage-3 revisions via `refinedInputHash`), brush from `brush_type`, legacy columns only when no refined version exists; `--dry-run` default, idempotent, diff lists the P4 conflict rows (expected: 1 user).
- PR1 writers: account link (`link-to-profile.ts`, `plan-bereit/readiness.ts` ×3 call sites, readiness proof → provenance-based), Feinschliff completion (write facts before `completeModule`), live onboarding flow, Haar-Check + Ziele persistence (UI unchanged), delete orphan `PUT /api/profile` (+ its three route-list entries).
- German UI copy only; no user-visible change in PR1.

## 8. Ship gates

Per PR: ready-check → Codex whole-branch review (read-only) → fix real findings → `/ship` only on Nick's explicit "ship it" → PR is draft → "merge it" is a separate authorization. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push the branch on your own.

## 9. Suggested opening prompt for the new session

> Start PR1 of the central user profile program. Read `plans/central-user-profile/HANDOVER.md` first, then the plan it points to (Rev. 10, final, do not re-open decisions). Follow the implementation loop with subagent-driven development, Opus for the judgment tasks and Sonnet for the mechanical ones as listed in the handover, test-first, adversarial fixtures for the deterministic rules, Codex whole-branch review before any push, and no push without my "ship it".
