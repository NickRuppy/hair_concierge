# Continue authorized work without repeated approvals

## Outcome and source context

Nick's September 15 request authorizes softening the audited workflow instructions: use judgment, align on important choices, and continue when nothing needs clarification. This is an instruction-only change; no application surface, copy, timing, or user feedback changes.

[OpenAI's September 11 Astra guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) recommends concise, task-specific instructions, explicit completion criteria, and revisiting overly restrictive boundaries. It identifies tentative stopping as a possible Astra behavior; it does not prove the cause of any particular past task.

## Chosen direction and scope

Replace duplicated approval ceremonies with one clear rule in AGENTS.md: continue authorized work through verification and repair, asking only about unresolved consequential choices or missing authorization. Carry existing approval forward. A workflow-stage transition is not a new permission request.

Keep alignment for material product, UX, architecture, data/access/payment, scope, rollout, recoverability, and risk choices. Present new flows or materially changed experiences with concrete evidence and their journey together; one approval of that concrete proposal suffices. Routine exact edits or implementation of an already approved design require verification, not another planning ceremony. Preserve explicit review-only requests and all publication, merge, production, payment, and cleanup authority boundaries.

Update AGENTS.md, CLAUDE.md, plan-hardening-loop and its template/UI prompt, implementation-loop, ready-check, and the Claude review bridge's decision-coverage wording if needed. Do not modify host configuration, memories, application code, old worktrees, or historical plans. Publication is a separate next action.

## Decision coverage

- Status: confirmed from Nick's explicit bounded instruction-update request above.
- Confirmed with Nick: simplify rather than add more rules; continue when no clarification or blocker exists; retain alignment on important choices.
- Inherited from evidence or contract: publication and production authority, guarded merge/cleanup, read-only reviews, verification, and terminal counterpart review remain intact.
- Implementation defaults: consolidate duplicated language, retain existing decision-record fields for compatibility, update direct consuming templates and prompts.
- Open consequential assumptions: none. No requested product work is deferred or dropped.
- Undiscussed consequential assumptions affecting this handoff: none.
- Coverage acknowledgement: September 15 user request in this task; no claim that Nick has reviewed later text revisions.
- Internal revalidation: proposed scope matches the request and prior audit; final diff will be checked again.

## Tasks and verification

1. Review this bounded plan with Claude, read-only and terminal; inspect findings locally.
2. Edit the owning rules and direct consumers together. Remove contradictory unconditional gates rather than append exceptions throughout the skill set.
3. Validate changed skill metadata, Markdown references, shell syntax if a reviewer prompt script changes, and diff whitespace. Inspect complete proposed files and preserve release safeguards.
4. Review representative scenarios: exact UI typo; new checkout flow; approved implementation with failing local tests; new payment or rollout choice; stale record with intact authorization; review-only request; publish request versus merge request; genuine missing credentials. Use the current user scope as the authority for this workflow change.
5. Run the final review router and read-only Claude counterpart review. Fix supported defects, rerun affected checks, and report the review-ready local result and next action.

No application build or production/browser execution is needed for instruction-only changes. Structural scenario review cannot prove future model behavior. Durable artifact: this plan (commit candidate); transient reviewer output: outside the repository, discard after reconciliation.


## Review reconciliation

Claude plan review: approve with revisions. Accepted explicit target enumeration and preservation checks: the edited targets are `AGENTS.md`, `CLAUDE.md`, `.agents/skills/implementation-loop/SKILL.md`, `.agents/skills/ready-check/SKILL.md`, `.agents/skills/plan-hardening-loop/SKILL.md`, its `references/plan-format.md` and `agents/openai.yaml`, and `.agents/skills/claude-plan-review/scripts/claude-plan-review.sh`. Wayfinder's Linear-map approval, content-research scope, and all domain skills are outside this change.

The exact replacement policy is reviewable in AGENTS.md's **Working together and planning decisions** section. The proposal preserves the compact decision fields for non-trivial plans, while removing repeated inline records, ten-heading ceremony, mandatory mockups for exact routine edits, and repeated approval of an unchanged journey.

Rejected the review's demand for an extra acknowledgement before preparing the wording: Nick explicitly requested this bounded simplification. Wording is reviewable in the local diff, publication is not authorized, and no claim is made that Nick has already reviewed the resulting text. The user's current request supersedes the very ceremony being changed.

Verification includes byte-preservation of the existing merge/finish section, shipping ownership rule, implementation publication-stop sentence, Claude release section, and unchanged domain/review-only boundaries. Separate journey sign-off and application mockups are not applicable to this instruction-only work.


## Final verification and review

September 15: all four affected skills passed `quick_validate.py`; planning UI YAML parsed with its invocation policy preserved; changed local Markdown links resolved; reviewer shell syntax and `git diff --check` passed. The byte-preservation checks above passed. No application build, browser test, or production operation was run because the change is instruction-only.

The normal correctness review and Claude whole-diff review found no blocking issues across the eight planned stop/continue scenarios. A separate structural review lane was unnecessary for documentation-only changes. Two advisory terminology notes were resolved locally: the route now describes conditional journey alignment and carrying authorization into execution. The final delta only clarifies those existing rules and records this receipt; no further counterpart pass is warranted.

Decision coverage remains confirmed from the original request, internally revalidated against the final scope. Commit candidates: the eight edited instruction/prompt files and this plan. Transient reviewer reports were reconciled and discarded; the final content manifest and verification/review fingerprint receipt are outside the repository. The result is local and uncommitted on `codex/workflow-continuity`; root main remains clean. Next action: explicitly authorized shipping, followed by separate merge authorization. Existing worktrees have not been rewritten and will require normal integration of the merged rules.
