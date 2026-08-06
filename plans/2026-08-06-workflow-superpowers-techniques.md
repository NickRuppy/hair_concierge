# Workflow Technique Hardening Plan

## Outcome and source context

Integrate six selected techniques from the current `obra/superpowers` skills into the existing Hair Concierge Codex workflow without installing another router, duplicating phase ownership, or making common skill paths materially heavier.

Source context:

- Current workflow: `AGENTS.md`
- Repo skills: `.agents/skills/plan-hardening-loop`, `.agents/skills/implementation-loop`
- Repo skills: all orchestration, verification, review, diagnosis, branch, UX-review, counterpart-review, and publication skills under `.agents/skills`
- Reviewed upstream source: `https://github.com/obra/superpowers/tree/main/skills`

## Chosen direction

Keep the current lifecycle and its owners unchanged. Import only the missing micro-contracts into the phase that already owns the behavior. Keep always-loaded `SKILL.md` additions short; disclose detailed test and debugging techniques through narrowly triggered reference files. Do not create a Superpowers dependency or a new top-level workflow skill.

## Scope and non-goals

In scope:

- plan decomposition, task-interface recording, and pre-review self-checks;
- rigorous application of code-review feedback;
- red-test and test-quality proof for deterministic behavior;
- durable resume and worker-result contracts;
- boundary tracing, working-example comparison, and condition-based waiting;
- linked-worktree, detached-head, submodule, and ignored-directory detection;
- a final no-op, duplication, ownership, and word-count review.

Non-goals:

- installing or invoking the Superpowers Codex plugin;
- changing the lifecycle in `AGENTS.md`;
- adding per-task external reviews, mandatory delegation, or universal TDD;
- changing product behavior, UI, automation, deployment, or production state;
- publishing, committing, pushing, or opening a PR in this run.

## Target map

### Repository-owned

- `.agents/skills/plan-hardening-loop/SKILL.md`: add the early independent-subsystem decomposition gate and invoke the plan self-review.
- `.agents/skills/plan-hardening-loop/references/plan-format.md`: add task right-sizing, `Consumes` / `Produces` interfaces, and a concise coverage/placeholder/type/order self-review.
- `.agents/skills/implementation-loop/SKILL.md`: add durable resume reconciliation, worker result statuses, and a conditional pointer to test-quality guidance.
- `.agents/skills/implementation-loop/references/test-first-quality.md`: single detailed owner for red proof, independent expectations, behavior-over-mocks, and mutation checks. `implementation-loop` and `ready-check` carry pointers, not copies.
- `.agents/skills/ready-check/SKILL.md`: require fresh red proof for new deterministic regression guards and independent verification of delegated results.
- `.agents/skills/ship-it/SKILL.md`: keep Hair Concierge publication and migration boundaries versioned with the project.

### Supporting workflow skills

- `.agents/skills/request-code-review/SKILL.md`: add a compact review-feedback application contract.
- `.agents/skills/diagnosing-bugs/SKILL.md`: require working/broken comparison and conditionally load targeted debugging techniques.
- `.agents/skills/diagnosing-bugs/references/targeted-techniques.md`: single source for component-boundary mapping, condition-based waiting, and conditional defense-in-depth.
- `.agents/skills/branch-gate/SKILL.md`: add linked-worktree and submodule interpretation plus ignored-directory verification.
- `.agents/skills/branch-gate/scripts/git-state.sh`: report git/common directory identity, superproject state, and detached-head status.
- `.agents/skills/request-code-review` owns the `code-reviewer` and conditional `thermo-nuclear-code-quality-review` lenses.
- `.agents/skills/ready-check` may invoke `.agents/skills/simulated-user-review`.
- `.agents/skills/claude-plan-review` owns the repository's optional counterpart-review bridge.

## Operator journey

1. A future task enters the same existing workflow and owner skill as today.
2. Planning decomposes independent systems before detailed work and self-checks task coverage, interfaces, exact values, and dependency order.
3. Implementation resumes from the durable plan plus Git evidence, gives bounded workers one of four explicit result statuses, and loads detailed test guidance only when deterministic tests are being written or changed.
4. Diagnosis loads focused techniques only for multi-component boundaries, flaky timing, or invalid-data recurrence.
5. Review findings are understood, verified, classified, and applied in coherent checked batches; product or scope conflicts return to Nick.
6. Branch setup correctly recognizes existing linked or externally managed workspaces before creating anything.
7. The final workflow remains the same: `plan-hardening-loop -> implementation-loop (ready-check -> request-code-review) -> ship-it`.

No end-user journey changes; no UI evidence is required.

## Ordered tasks

### Task 1: Harden planning and task interfaces

- Add the decomposition gate to `plan-hardening-loop`.
- Extend `plan-format.md` with right-sized deliverables, explicit cross-task interfaces, and a self-review checklist.
- Keep the chosen-path-only and no-placeholder rules as the existing source of truth.

Completion: a plan spanning independent systems is split before detailed planning, and every retained plan can be checked for coverage, interface consistency, and dependency order without adding step-by-step code templates.

### Task 2: Add test-first quality and resumable execution

- Create one conditional test-quality reference.
- Add a concise conditional pointer from `implementation-loop` when writing or changing deterministic behavior or regression tests; keep the detailed red-proof rule only in the reference.
- Extend the existing Goal-resume paragraph into one reconciliation path covering plan status, Git history/diff, and receipts; do not add a parallel resume section.
- Add `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, and `BLOCKED` worker statuses with action-changing semantics.
- Cross-reference the worker roles and delegation contract already owned by `AGENTS.md`.

Completion: detailed test guidance has one owner, completed work is not repeated after context loss, and worker concerns cannot be silently ignored.

### Task 3: Harden review-feedback application

- Extend the existing **Verify and integrate findings** section rather than adding a second feedback workflow.
- Add only the missing deltas: clarify interdependent ambiguity before partial fixes, check actual usage/YAGNI for scope-expanding proposals, and route conflicts with approved product or plan decisions back to Nick.
- Preserve the existing verification, classification, single-router, and fingerprint refresh rules as the source of truth.

Completion: ambiguous or unsupported feedback cannot flow directly into code, while supported findings still move through a short delta-based correction loop.

### Task 4: Add targeted debugging techniques

- Make working-versus-broken comparison an explicit diagnostic step.
- Add one conditional reference for boundary maps, condition-based waiting, and justified secondary guards.
- Preserve the existing red-capable loop, ranked hypotheses, and two-attempt breaker.

Completion: the techniques are discoverable at the exact failure branch without bloating every diagnosis run.

### Task 5: Improve worktree-state detection

- Extend the branch snapshot with git/common directory, detached-head, and superproject information.
- Teach `branch-gate` how to distinguish linked worktrees from submodules and make its existing ignored-directory rule executable with an explicit check before manual creation.
- Preserve repository-native `worktree:new` as the preferred Hair Concierge path.

Completion: branch setup does not create nested or untracked worktrees because the current environment was misidentified.

### Task 6: Concision and ownership review

- Compare before/after word counts for every changed top-level `SKILL.md`.
- Run a sentence-level no-op and duplication pass.
- Confirm each rule has one owner and conditional detail is behind one pointer.
- Remove imported rhetoric, universal mandates, examples, and process repetition that do not change behavior.
- Re-read the complete final workflow from planning through review and branch handling.
- Require combined growth across the six changed top-level `SKILL.md` files to stay at or below 5% of the 4,652-word baseline; no individual top-level skill may grow by more than 12%. Reference files are reviewed for relevance and duplication but excluded from the always-loaded ceiling.

Completion: no new top-level skill exists; phase ownership is unchanged; detailed guidance has one source; top-level growth is limited to the minimum routing and completion criteria needed to invoke it.

## Verification

Automated:

- `git diff --check`
- parse/check YAML frontmatter for every changed `SKILL.md`
- `bash -n .agents/skills/branch-gate/scripts/git-state.sh`
- run the branch snapshot from both the root checkout and task worktree and confirm the states differ correctly
- compare before/after word counts and inspect every top-level increase
- `rg` checks for duplicate status contracts and repeated test/debugging rules

Manual:

- Walk one planning scenario across two independent subsystems.
- Walk one deterministic regression test through red and green proof.
- Walk one ambiguous reviewer finding through classification.
- Walk one flaky async diagnosis through condition-based waiting.
- Walk root checkout, linked worktree, and detached-head interpretations.

## Review and handoff

- Run the required read-only counterpart plan review before edits and reconcile its findings.
- Before migrating unversioned personal utilities, copy their owned directories to a timestamped temporary backup and report the restore path.
- After implementation, run a whole-scope concision and correctness review covering all repository skill changes.
- Repository artifact: this plan is committed with the draft PR.
- Counterpart output: transient and discarded.
- Every skill referenced by the Hair Concierge workflow is repository-owned; same-named local copies are removed.
- Initial stop was before publication. Nick later authorized commit, push, and a draft PR; the current stop remains before merge, deployment, production writes, or worktree cleanup.

Planning evidence: upstream and current-skill comparison reviewed in conversation on 2026-08-06.

Evidence review: confirmed by Nick on 2026-08-06.

Operator-journey sign-off: confirmed by Nick's authorization to integrate all six targeted additions and review concision before locking the skills.

## Concision baseline and ownership decisions

Before-edit top-level word counts:

- `plan-hardening-loop/SKILL.md`: 1,465
- `implementation-loop/SKILL.md`: 821
- `request-code-review/SKILL.md`: 496
- `ready-check/SKILL.md`: 329
- `diagnosing-bugs/SKILL.md`: 814
- `branch-gate/SKILL.md`: 727
- combined: 4,652; maximum accepted combined result: 4,884 words

Single owners:

- detailed test-first quality: `implementation-loop/references/test-first-quality.md`;
- resume and worker-result handling: the existing resume/execution path in `implementation-loop`;
- review-feedback application: the existing **Verify and integrate findings** section in `request-code-review`;
- targeted debugging technique detail: `diagnosing-bugs/references/targeted-techniques.md`;
- linked-worktree interpretation: `branch-gate` and its snapshot script.

## Implementation and review receipt

Status: all six technique tasks and the repository-ownership migration are complete; published in draft PR #332.

Counterpart findings accepted before implementation:

- narrowed review-feedback and worktree edits to missing deltas;
- made the test reference, existing resume path, and existing review-integration section the single owners;
- captured a reversible personal-skill snapshot at `/tmp/workflow-skills-backup-20260806.A8Ngm6`;
- captured the complete pre-migration workflow-skill snapshot at `/tmp/hair-concierge-workflow-skills-20260806.6sYio7`;
- pinned the 4,652-word baseline and 5% combined ceiling.

Ownership clarification after review: repository portability is the priority for this single-user, primarily single-project setup. Every workflow dependency moved to `.agents/skills`, and same-named local copies were removed. Unrelated personal and other-project skills remain local.

Verification:

- top-level result: 4,863 words, +4.5%; every individual increase below 12%;
- YAML frontmatter parsed for all six changed top-level skills;
- `git diff --check` and `bash -n` passed;
- root, linked-worktree, detached-head, and ignored-directory checks passed.
- all 19 workflow skills and 18 available agent metadata files validated from `.agents/skills`;
- repo/local duplicate skill names: none;
- migrated scripts remained executable and matched the pre-migration snapshot; other migrated content matched except for intentional repo-relative paths and ownership wording;
- `npm run typecheck` passed after the ownership migration;
- the final Claude whole-branch review was skipped at Nick's explicit request; local `request-code-review` remained required.

Final whole-scope review: no blocking findings. Accepted one wording correction that treats linked-worktree identity and submodule context as separate signals, removed one redundant review-feedback sentence, and retained execution-worker statuses in `implementation-loop` while `AGENTS.md` remains the owner of general delegation roles and brief structure.
