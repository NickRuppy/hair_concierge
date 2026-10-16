# Private raw candidate staging

## Outcome and source

Nick selected “Finish candidate staging” for the discovered gap: research must
stage the exact candidate, then Nick approves raw → processing → final-image
review → explicit publication. The existing Admin raw-image action and approved
review journey remain the interface. This completes the missing integration,
without new UI, automatic approval, customer messages or publication.

## Decision coverage — confirmed

Confirmed with Nick: private candidate staging during research and the ordered
human approval journey above; ten-entry pilot only after rollout/host checks.
Inherited: immutable current-revision bytes, atomic CAS/lease/cycle completion,
six reserved runs/45 minutes, no stale approvals, disabled automatic switches.
Implementation defaults: HTTPS only, no credentials/custom ports; reject unsafe
DNS/IP destinations and pin validated DNS addresses to the HTTPS connection;
revalidate each redirect (maximum three), at most 10 MiB and 16 million decoded pixels.
Stage deadline is min(30 seconds,, current lease deadline and current cycle deadline).
Use the existing private storage uploader/hash/media checks; construct a scoped
Supabase storage client with the combined abort signal on its HTTP transport.
No new dependencies or migrations. Unreferenced private uploads after CAS/lease
loss are preserved, never directly registered or speculatively deleted.
Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: Nick’s exact “Finish candidate staging (recommended)”
reply follows the concrete raw-approval/processing/final-review/publication proposal.
Internal revalidation: the existing 16-argument completion RPC accepts raw-only
assets at revisionR+1, enforces currentR and lease/cycle, and atomically registers
them. The old remote fetch helper is unbounded and must not be reused as safe.

## Journey and scope

Successful formula/data research stages only the current pass’s image_candidate
bytes. Admin shows that immutable private image and the existing raw-selection
button. No processing begins until Nick explicitly selects its exact hash. Missing,
unrenderable or unsafe candidates hand back an explicit image blocker with
research evidence preserved. Data/formula blockers remain blockers; do not strip
model defects to manufacture readiness. No raw candidate is inferred from an old
finalized URL or historical artifact. No interface redesign is needed: consume the
already approved Admin raw-selection journey and image rendering.

## Ordered implementation

1. Add a narrow raw-candidate staging/download module under pipeline/. Select a
   URL only from this pass’s candidate evidence. Bound HTTPS DNS/redirect/body,
   decode safely, upload unchanged bytes through uploadProductReviewAsset.
   Cancellation must cover DNS wait, download, storage and pre-completion checks.
   Consumes candidate evidence+revisionR+execution fence; produces one raw
   ProductIntakeReviewAssetInput with key submission/R+1/hash, or explicit failure.
2. Wire completeResearchPass using a required staging integration callback, like
   its existing judge/evaluation integrations. Production supplies the actual
   staging helper with a scoped abortable storage client; fixtures supply the
   boundary behavior. Only otherwise review-ready research with automatic image
   processing off stages a candidate. Use post-judge current job/deadline/lease;
   re-read currentJob after staging before existing fenced commit. No model slot.
   Failed staging becomes needs_nick/blocked with a fixed image code; abort/lease
   loss must not commit. Pass raw manifest into existing atomic completion.
3. Clarify contradictory research/judge prompt wording: current raw image evidence
   belongs in image_candidate; pending raw/final approval/processing/publication
   are later gates, not formula/data defects. Keep missing/wrong image as a blocker.
   Update owning operational guidance, with no new autonomous approval authority.

## Verification and review

Extend owning completion fixture for raw-only review handoff with auto images off,
no automatic queue/approval, missing/broken candidate, genuine research defect,
post-judge deadline/lease and abort before commit. Test network policy at the HTTP
boundary (private/credential/redirect targets, pinned DNS, byte/timeout/decode
failure, cancellation) using deterministic transport mocks, no live internet in CI.
Reuse SQL evidence and extend its real PostgreSQL raw-only/replay/CAS proof only
where the existing owner does not already cover that path. Existing Admin raw
approval tests prove the later fresh image cycle; publication remains blocked.
Use focused verification planner + shared launcher, final typecheck/lint/build as
invalidated, readonly Claude/high delta review and exact final-head CI/Security.


Plan/source/sanitized proof: commit in #696. Raw reviews/config: private /tmp.
Keep current production worker running until final checks pass. Refresh candidate,
manifest and migration preflight; deploy once with all three automatic switches
disabled, then run the approved sequential pilot without exact image approvals.

## Counterpart disposition and concrete handoff

Claude/high approved the shape with revisions. Accepted its target/gating/receipt
clarifications. The legacy unbounded-download concern is resolved by sharing the
new guarded downloader with image.ts's remote fallback. This is a technical fix
within safe image preparation, without changing the approved human sequence or
turning on automatic image processing; no acceptance of unbounded risk is needed.
No new product choice is taken from the reviewer. Internal coverage stays confirmed.

Targets: pipeline/raw-candidate-staging.ts (transport + stageRawImageCandidate),
scripts/product-intake/cli.ts (optional per-operation abort signal),
scripts/product-intake/codex-research-worker.ts (after projected judge and status
selection, before its single final commit), pipeline/image.ts (guard remote
fallback), pipeline/research-judge.ts (clarify later human image gates), owning ops
doc, and existing Lab raw-only fixture/browser journey. Staging branch is exactly
executeCodex && nextStatus === waiting_for_review && !autoPrepareImage.
Require current submission revision R before upload. After staging, re-read the
current job and recheck execution/cycle before completion. Missing or bad candidate
changes previously image-less ready rows to an explicit needs_nick/blocked outcome.

Task 1 is done when deterministic HTTP-boundary tests in
product-intake-raw-candidate-staging.test.ts pass URL/DNS pin/redirect/size/decode/
abort controls and unchanged private-byte upload. Task 2 is done when the existing
research-readiness-self-check owner proves raw-only handoff, fixed blocker,
post-judge deadline/current lease and cancellation; oil-worker-admission fixtures
remain valid. The existing review-evidence-postgres owner now uses a raw-only
manifest for its atomic R+1/replay test. Task 3 is done when the existing Admin
raw-selection journey renders and confirms in the Lab without any Admin write.

Focused command: npm run test:focused -- tests/product-intake-raw-candidate-staging.test.ts
tests/product-intake-research-readiness-self-check.test.ts tests/oil-worker-admission.test.ts
tests/product-intake-review-evidence-postgres.test.ts tests/product-intake-image-quality-judge.test.ts
tests/product-intake-pipeline-image.test.ts (all on one shell command line).
Run verification:plan for all changed files, npm run typecheck, npm run lint and
required build through the shared gate, the five Admin browser cases, then readonly
Claude/high delta code review and final hosted CI/Security. Reuse unchanged real
Docker and monitoring proof; candidate runtime build/import is refreshed after
final source. Exact-head CI remains the final merge gate.

Implementation discovery: worker normalization still required unpublished
final.product.image_url before the candidate handoff. A dedicated normalization
regression failed with that requirement, so the private research-only required
field list now excludes it. Actual candidate availability remains enforced by
staging, and final catalog image requirements remain in guarded publication.

Counterpart code-review exception: Claude’s weekly limit prevented the final
code pass after its completed plan review. Nick explicitly chose “Use independent
Codex review (recommended)” for this increment, retaining final CI/Security before
rollout. This exception does not change future repository review policy.
