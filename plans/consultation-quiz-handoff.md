# Consultation quiz handoff and truthful admin progress

Outcome: investigate the quiz-to-products handoff and show a saved, complete hair quiz in the admin even before the product checklist is opened. User request (2026-10-16): check the handoff and replace misleading not-started reporting when the quiz is complete.

Scope: read-only live evidence, focused handoff probes, and the admin progress read model/list. Fix a handoff defect only if reproduced; do not infer abandonment from missing rows. No customer impersonation, customer data repair, schema changes, publication, deployment, or messages.

## Evidence and chosen direction

The admin currently reads only enrollments and intakes. Quiz answers live in legacy leads and are bound to the account on the checklist visit. Thus a complete unbound lead must be visible in progress reporting. Isabell initially had a complete lead without intake; a subsequent quiz save and intake/profile creation now demonstrate a successful handoff on a later attempt. Neither snapshot proves why the first attempt stopped.

Keep the existing table layout. In its Checkliste cell, independently show `Haarquiz abgeschlossen` with the saved time, and `Produkte: noch nicht begonnen`, `Produkte: offen`, or `Produkte: abgeschickt` with the existing submit time. Without a completed quiz, show `Haarquiz: noch nicht abgeschlossen`. Access/finalization controls retain their meaning.

Read only claimed enrollments' matching legacy quiz leads. Include complete unbound leads created at or after claim and already-bound same-account leads even when older; exclude foreign-owned leads and pre-claim anonymous/partial quizzes. Use a dedicated server-only admin enrollment projection so the CLI list never receives account IDs. Normalize stored legacy answer aliases using the existing discovery reader contract, then use `storedQuizAnswersSchema` (the persisted version of the quiz submission validator). Require explicit concerns before normalization so a default empty list cannot fabricate completion. Do not add a caller to the frozen historical profile projection. Batch and paginate reads so unrelated/duplicate leads cannot hide a participant's quiz. This is admin progress evidence, never authorization or automatic ownership binding.

`Haarquiz abgeschlossen` means a complete, validated quiz result is saved; it deliberately does not require the subsequent profile projection or checklist visit. The producer inserts discovery leads only after validating the completed quiz request (`src/app/api/quiz/lead/route.ts`), so `created_at` is the quiz-save time, not quiz-start time. A failed quiz read displays `Haarquiz: gerade nicht lesbar`. Personal Plan quiz envelopes are out of scope: the consultation entry explicitly uses the legacy `/quiz` journey.

## Decision coverage

Status: confirmed.

- Confirmed with Nick: investigate the handoff; show completed quiz instead of implying nothing was started.
- Inherited from evidence/contract: submitted checklist and finalization are separate; existing account ownership and auth gates remain authoritative; no writes from admin reads.
- Implementation defaults: existing table cell, German status wording, batched read-only lead lookup, focused regression and DOM probes. Saved quiz completeness inherits the submission validator, independent from the later account projection.
- Open consequential assumptions: none for this correction. Any material participant journey redesign requires a concrete proposal first.
- Undiscussed consequential assumptions affecting this handoff: none.
- Coverage acknowledgement: the user's current request supplies authorization for the exact progress correction and investigation.
- Internal revalidation: plan matches production/root commit f3b78e81; successful later handoff is distinguished from the earlier unproven failure. Claude's plan review was integrated: accepted legacy-normalization compatibility and documented degraded reads; CLI/frozen-projection concerns were already corrected. Rejected the proposed requirement to wait for profile projection, because it would recreate the requested missing-progress behavior; the existing quiz submission schema determines what saved completion means.

## Tasks and verification

1. Add server-only quiz progress loader and integrate it into the admin list. Extend owner-boundary list tests for completed quiz without intake, draft/submitted checklist, no quiz, and independent participant rows. Loader tests cover claim-time, account ownership, incomplete payloads, pagination, and read errors. Demonstrate baseline failure before the repair.
2. Exercise real React DOM continuation with save pending, save completed, retry, and remount. Trace the full lead-capture wiring and existing server/middleware/projection contracts; fix only a reproduced defect. Use real participant data solely for read-only state/log evidence, and continue investigating the other person when identified.
3. Run focused owner/sibling tests via the shared launcher, targeted lint/typecheck as indicated by verification routing, and inspect the changed admin in a local browser using fictional fixtures (no customer session). Get one read-only Claude plan review and final whole-change review. Verify findings locally.

Journey sign-off: separate mockup approval is not needed for this precise status correction in the existing table. The user requested this information; no participant actions or flow are redesigned.

Artifacts: commit this plan, implementation, and useful regression tests. Discard transient probes/previews and Claude review output after recording results. Stop at a verified local branch; commit/push/PR/merge/deploy require their own authorization.

## Investigation receipt

Both named participants have reached the product checklist and have persisted products. The original missing-intake snapshot does not establish whether the first continuation was tapped or failed. Laura's last product save predates the confirmed budget-save deployment (#688); that is consistent with the prior budget block, not proof of her exact stopping reason. No customer state was edited.

Real React DOM probes cover the complete lead capture plus child continuation with delayed save, retry, and remount, and the product checklist through budget, routine confirmation, heat answers and final submission. Only auth/transport/navigation are fixtures: these probes establish client wiring, not live database persistence. Existing server, projection and middleware sibling tests supplement this evidence. No participant-flow production change is warranted by the current probes.
