I have enough grounding. The contract specs (`test:playwright:contracts`) import pure functions and run pure assertions with no `page.goto`, no server, no `/api/` calls (e.g. `tests/conversation-state.spec.ts:10` imports `buildConversationStateUpsertPayload` and tests it directly) — so `quality-core` running them without browsers/server is fine and matches today's behavior. Here is the verdict.

---

**Verdict:** Approve with revisions — one hard blocker (split smoke jobs never build the app) plus a shape concern that Task 3 likely doesn't soften the assertions that actually flake. Fix those two before handing to subagents; the rest is solid and well-grounded.

**Lean shape**
- **Irreducible goal:** Replace one overloaded `quality` check (`.github/workflows/ci.yml:16`) with named, path-aware checks so a red CI names the risk, while keeping deterministic gates hard.
- **Cut or defer:**
  - **Task 3's `hasJudgeFailures` branch is dead code in CI.** `test:chat:ci` runs with `--skip-judge` (`package.json:36`), so no judge ever runs in the CI path; the new `hasJudgeFailures` check in `run.ts` is always `false` there. It's also redundant locally — judge results are already pushed as an assertion with no `severity` (`scripts/eval-chat/run.ts:217-223`), so `countHardAssertionFailures` already counts them. Drop the extra check or document it's local-only.
  - **Task 7's `docs/ci-flow.md` is optional and low-value** — the branch-protection target list already lives in Task 7 Step 2. Inline it; skip the doc unless the team wants a durable checklist.
- **Hard tradeoff the plan is avoiding:** *Which* chat assertions are actually causing the red runs. The plan asserts "soft LLM wording heuristics" are the noise but only softens `must_be_german` — the most lenient heuristic in the file (≥3 of 16 ultra-common German words, `scripts/eval-chat/assertions.ts:142-178`). The genuinely brittle substring heuristics (`required_keywords`/`forbidden_keywords`, `assertions.ts:191-213`) stay hard, and the judge is already disabled in CI. So Task 3 may not move the needle on real flakiness. Ground the soft/hard split on an actual failing run before coding it.

**Prior art**
- **Path-aware gate via tested pure module:** matches canonical "extract classifier + unit test" shape. Good — `classifyCiScope`/`hasFullCiMarker` are pure and tested (`tests/ci-path-rules.test.ts`). New prefixes verified to exist (`src/lib/agent-v2/`, `data/agent-v2/`, `tests/fixtures/retrieval-gold-set.json` all present).
- **Required check that's conditionally a no-op:** matches the canonical GitHub pattern (always-run job + step-level `if:` so the check name always reports green). Correctly chosen (`ci.yml` plan §49). **Missing invariant:** the transition off the orphaned `quality` required check — see Blocker 2.
- **Hybrid hard/soft gate:** structurally fine (typed `severity?: "hard" | "soft"` union, not an open string), but mis-targets the soft signal (see hard tradeoff above).
- **Multi-platform native optional deps:** canonical check is "does the lockfile pin the target `os`/`cpu` optional deps." Task 4 Step 1's `rg` is the right check; Task 4 Step 2 (local macOS `npm ci && npm run build`) is **not** — it can't exercise the Linux path the workaround exists for.
- **`secrets` in workflow-level `env`:** verified allowed (`env` key permits `github, secrets, inputs, vars`), so relocating `HAS_LIVE_*` from job-level to workflow-level is safe. Not a blocker.

**Blockers** (will fail or regress as written)

1. **`playwright-smoke` and `chat-live-smoke` run `npm run start` with no prior `npm run build`.** `playwright.config.ts` has **no `webServer`** block, so the server is started externally via `npx start-server-and-test 'npm run start' …` (plan `ci.yml:381,415`). `npm run start` = `next start` (`package.json:9`), which requires a `.next` production build. These are separate runner jobs that only run `npm ci` — `quality-core`'s build does not carry over. → both jobs die at server startup with "Could not find a production build in the '.next' directory." The plan even predicts `playwright_smoke=true` on its own PR (Task 8 Step 3), so this fails on the first run. **Fix:** add `npm run build` to each smoke job (gated by the same `if:`), or upload `.next` as an artifact from `quality-core` and download it. (Today this works only because build + smoke share one job: `ci.yml:52` then `:57`.)

2. **The introducing PR will be merge-blocked by the orphaned `quality` required check.** Branch protection currently requires `quality` (Task 7 Step 2). The new workflow no longer produces a job named `quality`, so that required check never reports and stays pending forever — including on the PR that introduces this change. **Fix:** make Task 7 Step 2 explicit that branch protection must be edited *during* the open PR (remove `quality`, add the new names) — or an admin merge / temporary requirement removal is needed — before this PR can land. The plan's "don't remove `quality` until replacements are green" instruction directly conflicts with being able to merge this PR; call out the resolution order.

**High-confidence issues** (correctness, not preference)

- **Task 3 Step 4 must replace `run.ts:308`, not just add code.** Current final line is `process.exit(report.summary.failed > 0 ? 1 : 0)` (`scripts/eval-chat/run.ts:308`), which hard-exits 1 on *any* failed scenario — and a scenario fails if any assertion fails, including the now-soft `must_be_german` (`run.ts:236,267`). If a subagent appends the `process.exitCode` logic without deleting line 308, soft failures still hard-fail and the whole task is a no-op. Also, the snippet references `options.ciSmoke`, but args are destructured as a bare `ciSmoke` (`run.ts:88-96`) — there is no `options` object. The plan's caveat ("if variable names differ, preserve behavior") half-covers this but doesn't name the line to delete.
- **Task 4 Step 2 verifies the wrong platform.** Removing the Linux-native-binding workaround (`ci.yml:43-48`) based on a passing *macOS* `npm ci && npm run build` is unsound — macOS resolves the darwin variants regardless. The real evidence is Task 4 Step 1: I confirmed the lockfile now pins `@tailwindcss/oxide-linux-x64-gnu` and `lightningcss-linux-x64-gnu` with `resolved` URLs (`package-lock.json:5791,5917`), so removal is in fact safe — but say so based on the lockfile + the CI run, and treat Step 2 as non-load-bearing for this decision.

**Smaller / nice-to-haves**

- **Task 2 removes the native-binding workaround before Task 4 validates it** (sequencing). Harmless here because the lockfile already carries the Linux variants and nothing is pushed until Task 8, but flagging the order is cleaner to reverse (validate, then remove).
- **New tests are auto-covered by CI** — `tests/ci-path-rules.test.ts` matches `tsx --test tests/*.test.ts` in `test:node` → `test:contracts` → `quality-core` (`package.json:32,35`). Good, but the plan only runs it as a standalone local command; worth noting it also gates in CI (and `tsx` is correctly in devDependencies, `package.json:92` — satisfies the recorded CI-tsx constraint).
- **Task 3 Step 5 is already satisfied** — `client.ts:126-148` already upserts `subscription_status:"active"` and a `billing_subscriptions` row with `provider_status/entitlement_status:"active"`. This step is a confirm-only no-op; mark it as such so a subagent doesn't "fix" working code.
- **`@types/node` stays `^20` while runtime moves to Node 22** (Task 5; `package.json:79`). Harmless (forward-compatible) but slightly inconsistent — consider bumping to `^22`.
- **Behavior change worth stating:** Playwright smoke currently runs on every PR (secrets-gated only, `ci.yml:58`); the plan makes it path-aware, so unrelated PRs will skip it (green-via-skip). Intended per Settled Decisions, but it's a coverage reduction the reviewer should know about.

**Bottom line**

Shape is right and the codebase grounding is mostly accurate — path classifier, required-check pattern, secrets relocation, and rollback story all check out. But as written it fails on first run: **fix the missing `npm run build` in both smoke jobs (Blocker 1)** and **spell out the branch-protection cutover so the introducing PR can actually merge (Blocker 2)**. Before coding Task 3, pull one real red `chat-live-smoke` run and confirm which assertions fail — softening only `must_be_german` while the judge is disabled in CI may classify the wrong signal and leave the noise untouched. Address the two `run.ts`/Task-4 correctness notes and this is safe to hand to subagents.

Want me to spec the leaner counter-proposal for Task 3 (ground the hard/soft split on an actual failing run) and the smoke-job build fix so you can compare side-by-side?

Sources:
- [GitHub Actions — Contexts reference (context availability table)](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)
- [GitHub Actions — Using secrets / if conditionals](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
