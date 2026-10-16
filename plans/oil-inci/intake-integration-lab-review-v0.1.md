# Oil review — reuse the existing Research Lab

Nick's correction on 2026-10-13: “Could you take our review lab instead? I think that would be a bit simpler.” Matching remains “Draft suggestions; I approve or correct them.” This supersedes the never-approved cockpit mockup.

Selected reference: [existing Lab screenshot](intake-integration-lab-reference-v0.1.png). It is an unchanged copy of the saved Mask screen in `.worktrees/canonical-compare-lab/plans/evidence/canonical-compare-lab/shared-mask-desktop.png`; it does not show an implemented oil screen. [Source hashes/dependency status](intake-integration-lab-dependency-2026-10-13.json).

The existing Lab provides a product queue, immediate property reasoning, genuine lane values, expandable evidence, adjacent Freigeben/Nacharbeit, draft-preserving recovery and explicit local completion. The oil extension follows that existing selected pattern:

| Existing region | Oil content |
| --- | --- |
| Category selector / queue | Öle, exact-product entries and review state |
| Product file | Identity, literal INCI, current method/run/source context |
| Property rows | All direct oil properties and retained scenario caveats |
| Projection group | Weight, fibre roles and heat protection; only these are engine-owned catalog facts |
| Ordinary review row | Matching-Vorschläge · manuell prüfen, showing actual draft values/reasons |
| Adjacent actions | Freigeben; Nacharbeit with a correction comment |
| Completion | Explicitly includes open oil and manual matching rows; blocked by missing drafts/open rework |
| Saved state | Lokal geprüft · noch nicht im Katalog |

Corrections create a local rework request; they do not launch workers. After operator rework, a new bound bundle is reviewed. A later explicitly authorized CLI import transfers the exact completed property/matching verdict into intake; publication and image/brand/package checks remain separate. After a successful transfer, that exact Lab bundle is read-only; further changes use intake rework and produce a new Lab bundle. Pending/uncertain transfers remain blocked until reconciled, and an old receipt cannot override later local rework. No repeated cockpit property approval, direct Lab catalog publishing or inline value editor.

Use the existing stale-view 409/reload-with-comment, failed-save draft retention and saved-but-refresh-failed behavior. New research artifacts or matching revisions require review of the new binding. Historical corpus review is local information only and cannot emit a current intake receipt.

The shared implementation is currently untracked in a separate worktree, absent from main and this oil checkout. Dependency reconciliation and oil-specific source/approval binding are required before implementation can work. Read-only mapping verified this in the current turn. The prior shared Lab receipt reports native/browser checks, but those are prior evidence; no fresh browser or oil UI test is claimed here.

Direction/evidence status: user explicitly selected the existing Lab, incorporating the precise correction without repeating design approval. The copied reference anchors the unchanged layout. Actual oil wide/narrow/browser and persistence/race verification remains an implementation gate. No implementation authorization is inferred.

Disposition: retain this note, the exact copied reference, dependency hashes and chosen plan. Archive the old cockpit proposal as superseded, never approved.
