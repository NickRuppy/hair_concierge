# Ready-check receipt v2: Hair Tools port (`codex/hair-tools-port`)

Supersedes `2026-10-11-hair-tools-port-ready-check.md` (tree `aec3f743`) for the final tree.

- **Branch / head:** `codex/hair-tools-port` @ `d942b508`. This is the merge of `origin/main` `dd60acc4`; the branch is 0 behind.
- **Content fingerprint:** `f502158669014b624ed2f515f2bc3809f195b93edc986ef3a5b9a51999e3fe7e`. It is the SHA-256 of the sorted manifest `path <blob-hash|DELETED>` over every path changed against merge-base `dd60acc4` (356 paths), taken before this receipt was added.
- **Plan:** `plans/2026-10-09-hair-tools-port.md` (Rev. 5 plus §12 Rev. 6). The rulings ledger addendum is `plans/2026-08-24-hair-tools-d1-d9-rulings.md`.

## What changed since receipt v1

1. **Rev. 6 batch (Nick's rulings 2026-10-11/12).**
   - Gewohnheiten asks one new night question last: „Wie trägst du dein Haar nachts?" (Offen, Locker zusammengebunden, Pineapple). It is skipped for short hair.
   - The night things stay on the Tools page.
   - The rollout flag defaults to on. `off`, in any case, is the emergency switch, and `admin` remains an optional stage.
   - Consistency fixes align the tools pages with quiz and Feinschliff conventions.
   - The Profil Gewohnheiten card gets a fifth row, „Nachts".
2. **Rev. 6 task review (Sonnet).** It approved with nits. The nits are fixed:
   - The rollback script also clears `nightWear`.
   - The flag is parsed case-insensitively.
   - Stale docs and comments are updated.
3. **Codex review of the Rev. 6 delta.** It returned three Majors, all fixed test-first:
   - **F3:** existing members' earlier night answer carries over (Pineapple, else Locker zusammengebunden, else Offen, with the old answer's provenance). Gewohnheiten stays complete and the question is not re-asked.
   - **F2:** a module's own next question can be saved while an earlier module (Tools) is open. A save is validated before a completed draft is reopened.
   - **F1:** a confirmed „Nachts" change reaches the stored `nightProtection`.
4. **Codex re-review.** F2 and F3 were confirmed fixed. Two F1 gaps were found and fixed:
   - Stored facts are read only when needed. A failed read stops completion as `temporarily_unavailable`, which is retryable, and nothing is written.
   - The write is bound to the read's facts revision, so a concurrent edit becomes a conflict instead of a loss.
5. **Codex final check of the F1 round 2.** APPROVE, no findings. The predicate matched the merge across 116,640 combinations.
6. **Merge of `origin/main` `dd60acc4`.** It brings #659 (profiles column lock), #660 (Bondbuilder intensity retirement), #661, #662 (dependency upgrades, Next 16.3.8), #663 and #665.
   - No file overlaps with the branch.
   - Main's three new migrations touch functions this branch does not redefine.
   - The profiles lock revokes write access only, so the `is_admin` read used by the `admin` stage still works.

## Commands and results (tree `d942b508`, dependencies reinstalled with `npm ci`, Next 16.3.8)

| Check | Result |
| --- | --- |
| `npm run ci:verify` (typecheck, lint, build) | exit 0 |
| `npm run test:personal-plan` | 3642 tests: 3641 pass, 0 fail, 1 skipped |
| `npm run test:personal-plan:nested` | 1223 tests: 1223 pass |
| `npm run test:node` | 11686 tests: 11671 pass, 0 fail, 15 skipped |
| `npm run test:playwright:personal-plan-stage3:journey` | chromium: 81 passed, 1 skipped. webkit-mobile: 13 passed, 1 skipped. exit 0 |

Notes on the browser journey:
- **Cold start.** The first run after the dependency upgrade timed out at 60 s while the dev server compiled from a cold cache, so no test ran. The re-run started normally.
- **Escape regression from main.** On tree `13828e6d`, chromium failed „Escape at the first dialog-visible instant closes the detail sheet" in 2 of 3 full runs. On the final tree `d942b508` it passed.
  - In isolation it passed 20 of 20 (`--repeat-each=10`, retries 0).
  - A clean `origin/main` checkout (`dd60acc4`, `npm ci`, no branch changes) failed the same test in 2 of 2 full chromium runs.
  - It is therefore a main regression from #662 (Next 16.3.8), not this branch. Main's CI skipped the personal-plan journey for #662. A separate fix task is filed.
- **Environment.** After the dependency upgrade, Playwright 1.64 needed `npx playwright install webkit chromium` locally.
- **Cancellation-page flake.** On the pre-merge tree `5e66c505`, the webkit-mobile cancellation-page test (`public-contract-declarations`) timed out once. The branch does not touch it, it passed in every other run, and it was already classified as a flake in receipt v1.

The earlier trees `5b4c4153`, `86cbe3e1`, `224b58f3` and `5e66c505` each passed the full gate set before the merge. Logs are in `.superpowers/sdd/2026-10-09-hair-tools-port/reports/readycheck-*/`, which is git-ignored and gets discarded at `worktree:finish`.

## Browser / manual evidence

Unchanged from receipt v1: `plans/mockups/2026-10-09-hair-tools-port/ready-check/` holds the labs journey, flag-off and flag-on dev-login checks, and mobile screenshots. Rev. 6 adds the night-question screen, `63-night-wear.png`, through the journey lab, whose tools scenario has tie-able hair.

## Deploy order and residual risk

1. **Apply the migration before deploying.** Migration `20261009170000_personal_plan_stage2_tools_module.sql` is additive: three `CREATE OR REPLACE` bodies that widen the module list.
   - Production has already applied later-dated migrations (`20261011*`).
   - Apply it via the Supabase MCP. Then rename the file to `<applied_version>_20261009170000_personal_plan_stage2_tools_module.sql` so repo and production history match. This is the same pattern the repo used for `20261011125354_20261009160000_profiles_privileged_columns_lock.sql`.
2. **Deploy.** The module is live for everyone because the flag defaults to on. No Vercel environment change is needed.
3. **Nick's production walkthrough,** plus a Sentry check.

Rollback: set `PERSONAL_PLAN_TOOLS_ROLLOUT=off`. A pre-port code rollback is possible only after `scripts/personal-plan/tools-rollback-clear-facts.ts --apply`.

Residual risks:
- **Pre-Rev. 6 drafts.** Members who completed Gewohnheiten under Rev. 5 with the rollout on are asked the night question once. No production member has such a draft, because Rev. 5 was never live.
- **Night merge outside interactive Stage 2.** The facts-rebase lane and direct acceptance have no stored-facts reader. There, a list whose parts differ in provenance is written as `assumed`, which never overwrites a confirmed list but does not update it either.
- **Relaxed save rule.** A module's own next question can be saved while an earlier module is open, so habits can be answered before products as well. This was previously an error path.
- **Known failures not caused by this branch.** The Escape regression on main may fail this PR's journey CI job until it is fixed on main. Merging past it needs that fix or Nick's explicit call. The cancellation-page test is a known flake.

## Artifacts

- **Commit:** this receipt, the plan and ledger updates, the docs updates and the Rev. 6 mockup.
- **Discard at `worktree:finish`:** `.superpowers/sdd/2026-10-09-hair-tools-port/**`.
- **After merge:** close PR #465 (`personal-plan-hair-tools-current-shape`) as superseded.
