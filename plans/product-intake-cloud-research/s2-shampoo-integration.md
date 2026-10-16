# Shampoo intake integration — locked v1.6.2

## Outcome, scope and authority

Prepare a current German Shampoo submission as a reproducible, formula-first
review package using the locked v1.6.2 method and the current-storage projection
from PR [#682](https://github.com/NickRuppy/hair_concierge/pull/682). Preserve the
approved Admin journey and human publication boundary. This is a continuation of
[the parent program](plan.md), not activation of a new method.

Worktree `.worktrees/shampoo-intake-integration`, branch
`codex/shampoo-intake-integration`, base `80b963a2cfac866a4083ea00ffbea28acdd1b69c`.
The exact #682 patch at `f790ab5d743c6c7f944d90b038f740051c043881` is adopted locally
for integration; its author branch and worktree remain untouched. That PR is an
offline projector, not a worker integration. Publication/disposition of the
combined branch requires separate authorization and a fresh whole-branch review.
Draft PR [#691](https://github.com/NickRuppy/hair_concierge/pull/691), branch
`codex/intake-review-safety`, exact reviewed head
`75da3b16ec4ea96c28341ca7cae342342866a627`, owns the durable review-cycle APIs.
Its reviewed source was adopted from the sibling `.worktrees/intake-review-safety`
into this local tree. It provides `reserveResearchModelRun`, `withResearchModelCycle`,
`reserveCurrentResearchModelRun`, the cycle-aware `commitResearchPass`,
`decideProjectedResearchOutcome` and the `completeResearchPass.judgeProjected`
callback wired through `buildProjectedResearchJudgePrompt` and `runCodexJson`; SQL is
`20261016052958_product_intake_review_cycles.sql`. The exact reviewed #691 patch is now adopted locally for integration and testing.
This does not merge/publish the dependency or apply its migration. Do not implement
replacement counters or copy an older unfenced launch path. Before publication,
reconcile the branch base with #691 (merged dependency or an explicitly approved
stacked PR); runtime still requires migration-before-code authorization.

Source authority: `docs/research/shampoo-inci/README.md`, the complete
`v1.6.2/classification-standard.md` and `v1.6.2/runbook.md`. Frozen method bytes and
historical research stay unchanged. The unvalidated v1.6.3 candidate is excluded.
No catalog importer, live weight column, fit logic, production write, job retry,
backlog flush, email send, switch activation, merge or deploy is included here.

## Decision coverage — confirmed

- **Confirmed with Nick:** integrate the locked Shampoo method as part of the
  remaining setup; automatic alerts stay off; reserved model slots are never
  refunded. On 2026-10-16 Nick chose to retain regular-shampoo research and ask
  about a separate deep-cleanser listing in “Entscheidung nötig”; never create it
  automatically. He also approved reusing an unchanged, hash-pinned formula
  assessment for a bounded correction when two runs remain; a changed formula
  or insufficient budget returns to him, without raising six runs/45 minutes.
  The fixed six-run/45-minute cap is explicitly confirmed by that answer. Nick
  subsequently approved one isolated research lane plus the Sol judge and his
  approval for routine Shampoo intake, with two lanes for validation batches.
- **Inherited from contract:** real source freeze before classification; a fresh
  blind formula pass sees no name, brand, claims, directions, GTIN, catalog ID or
  URL; release claims only after validating and hashing its output. Classification
  has no web. New formulas require a new freeze. Protocols come from exact
  directions, never INCI. PR #682's R19/R21 current-storage adaptation is the
  integration baseline; research weight stays in evidence, not a new live field.
  Two independent classification lanes remain required for a validation batch.
- **Implementation defaults:** one category module orchestrates its research
  stages through the common model launcher/reservation path. Fresh model sessions,
  isolated blind working directory and allowlisted packets; reuse existing lane-kit
  fingerprint, pack-size scrub and standard scrub helpers. Server computes all
  hashes and submission bindings. No new model, provider, queue or approval type.
- **Open consequential assumptions:** none for local implementation. Migration,
  release, live validation-cohort selection and publication remain explicit later
  gates in the parent program; no requested deliverable is silently parked.
- **Coverage acknowledgement:** Nick's request to continue remaining setup with
  central decisions aligned, plus the Shampoo decisions above on 2026-10-16 and
  his explicit single-lane continuation request.
- **Internal revalidation:** #682's exact head was read and its patch applied
  locally to current main; v1.6.2 pins match the locked files. The current generic
  one-prompt research call exposes identity before formula classification and
  therefore cannot satisfy the new-run sealed contract merely by asking the model
  to ignore those facts. Separate stages address that concrete defect.

Undiscussed consequential assumptions affecting this handoff: none. The prior
plan review remains applicable; the lane-count decision is now explicitly settled,
and local adoption supplies its named safety dependency without a production action.

## Chosen research flow and exact interfaces

The approved initial pass uses three Luna/low launches, followed by the
dependency's Sol/medium
projected-value judge. Every launch consumes a durable slot before spawn and uses
the remaining cycle deadline. Images and optional shadow work share this same
budget; they never get extra slots. Automatic switches stay off.

1. **Source freeze (web enabled):** resolve exact submission identity and German
   formula, preserving conflicts and source hierarchy. Return a full freeze packet
   with the runbook's identity, canonical INCI, verbatim claims/directions and
   source kinds, completeness, source tier and confidence. It performs no property
   classification. Server validates the packet, exact submission/GTIN bindings,
   source URL/canonical raw-INCI agreement and computes the formula fingerprint.
   Blocked/conflicting/low-confidence packets return to human review.
2. **Blind formula pass (web disabled):** use a fresh process/working directory
   with only the allowlisted stage-A packet and scrubbed pinned standard. Packet
   keys are a fresh opaque blind ID, canonical INCI, fingerprint, fixed
   normalization, completeness, source tier, confidence and bare pack size.
   No generic intake prompt, earlier draft, reveal or shared job context enters
   this prompt. Validate the runbook's required formula record and retain all
   eight provisional properties/evidence. Hash and freeze the exact response
   before constructing a reveal. The isolation is an honest-operation boundary,
   matching the runbook; do not claim protection against a hostile filesystem user.
3. **Revealed final pass (web disabled):** give the frozen blind record, permitted
   reveal, full pinned method and exact source directions/commerce/image evidence
   needed for intake. It emits the complete native final research record and the
   ordinary intake envelope. Record every blind-to-final change and uncertainty.
   Server rejects a conflicting supplied submission ID/method tuple before
   attaching its own binding, compares the canonical
   formula fingerprint, and runs the deterministic adapter. Model-written final
   Shampoo rows are replaced by server projection.
4. **Shared completion:** normal identity/commerce/protocol/readiness checks and
   projected judge consume the final projected payload. Final freeze/blind/final
   evidence, preview, outcome and outbox are committed through the safety RPC.
   An abandoned launch may retain diagnostic telemetry, never a review-ready
   artifact or partial preview. A reclaimed job cannot reset budgets or blindly
   trust a local path as prior formula evidence.

Durable artifact: exactly one `property_synthesis` contains
`shampoo_research_envelope` (full native record) and a mirrored server-owned
`shampoo_research_stages` proof. The authoritative carrier is a protected `formula`
artifact stamped with `stage=shampoo_research_stages_v1`, created only by the
worker after stripping model-authored protected artifact kinds. The proof contains
freeze packet + SHA-256, stage-A packet + SHA-256,
blind record + SHA-256, revealed final + SHA-256, submission ID, cycle ID, method
tuple and unchanged formula fingerprint. Existing formula artifact/draft raw INCI
remains available to shared intake checks. Verify every proof member from its
contents; do not trust model-supplied hashes or a nonmatching cycle/submission.

`applyShampooResearchAdapter({final, artifacts, expectedResearchId,
expectedFormulaFingerprintSha256})` consumes the single exact-submission v1.6.2
envelope and trusted formula fingerprint from the stage-proof validator. It
returns `{blockers, warnings, downstreamDecisions}`. Stage-proof validation is
mandatory in the production caller before it supplies that trusted fingerprint;
the pure adapter alone does not claim sealed execution. The downstream decision
contains its server-computed projection hash and fixed D2 question.
Missing/duplicate/mismatched or wrong-version evidence fails closed. It emits
`artifact.payload.shampoo_production_projection` with the complete projector
outcome and server-computed `research_input_sha256`/`projection_sha256`. Only on
`property_lane_ready`, replace `final.product.suitable_thicknesses`,
`final.category_specs.product_shampoo_specs` and engine-owned rationales; preserve
independently researched application protocols and all durable research evidence.
Convert structured rationales to the shared intake schema's prose; retain the full
typed confidence/rule-reference records in the immutable projection artifact.
Hash inputs use one deterministic canonical JSON serialization. Fingerprint uses
the locked lower-case/trim/collapse-whitespace/join-with-`|` rule, never the generic
intake uppercase fallback. Reject native `blindId` as catalog/submission ownership.

## Recovery and additional-listing decision

A machine-fixable correction may use one revealed-final repair and the common
judge (two launches) only if the same submission/cycle/method/formula proofs still
validate and the deadline permits it. The frozen blind assessment remains immutable;
record repair history separately. A change to canonical INCI/identity/method or a
missing proof cannot reuse it and returns to Nick for an explicit fresh cycle.
Infrastructure retry/reclaim does not grant new slots or clear evidence flags.
The maximum-two automatic rounds is an upper bound; the six-run shared budget
can permit fewer. Image work is not silently dropped to manufacture rework budget.

D2 `deepCleanserListing=flagged` retains the regular Shampoo projection and adds
the fixed downstream question: “Auch als Tiefenreiniger anlegen? Die reguläre
Shampoo-Recherche bleibt erhalten.” This is a listing decision, not a fabricated
research failure or the old v1.4 `routed_deep_cleansing` result. Store the exact
projection hash with the open question and use the shared blocked/needs-Nick
outcome. An answer may decline/defer the extra listing or request a separate intake;
it never creates a second product as a side effect of ordinary Shampoo approval.
Consume only an authenticated, matching-revision decision through the forthcoming
shared Admin approval layer; stale approvals cannot suppress the question. Until
that layer is complete, these products remain visibly blocked for this decision.

Operator journey reuses the approved Admin proposal: ordinary ready packages
appear in “Bereit zur Prüfung”; listing/budget/source decisions appear in
“Entscheidung nötig” with retained research and up to three concrete questions.
Nick reviews exact data and image separately and explicitly publishes each product.
This increment introduces no new screen or unseen approval control. The question
and recovery semantics were approved above; no new visual proposal is necessary.

## Ordered implementation and proof

1. **Adopt and revalidate projector:** exact #682 patch locally, current base,
   native v1.6.2 and historical v1.4 regression/CLI/calibration tests. Keep historical
   locked bytes intact and report owner PR dependency rather than rewriting it.
2. **Pure bridge and evidence proof:** new
   `src/lib/product-intake/shampoo-research-adapter.ts` and
   `shampoo-research-stages.ts`, focused tests. Verify exact binding, complete stage
   proof, no blind identity leaks, wrong pins/fingerprint/cycle rejection, canonical
   hashes, owned-field replacement and protocol preservation. Start with behavioral
   red cases on the missing stage/adapter behavior; no source-text assertions.
3. **Staged prompt/orchestration:** new
   `src/lib/product-intake/shampoo-research-prompt-contract.ts` and category stage
   orchestrator. Reuse lane-kit helpers without changing locked artifacts. Extend
   PR #691's common `runCodexJson` with a working-directory option while retaining all
   common reservation/auth/deadline behavior. A subprocess harness records actual
   prompts/working directories and proves no reveal before validated blind output,
   web-off classification, no spawn on budget denial and immutable proof reuse.
4. **Worker/registry wiring against the locally adopted safety dependency:** router uses server v1.6.2
   pins and adapter; the worker selects the staged category module instead of the
   generic single call. Generic categories keep their existing shared stages.
   Verified repair uses persisted matching proof, not local output files or model
   wishes. D2 outcome retains final values, emits the downstream question and
   prevents publication. End-to-end fixture: ordinary ready, missing-INCI/identity
   conflict, D2, valid repair, tampered prior proof, changed formula and exhausted
   budget; common completion writes atomically and alerts remain disabled.
5. **Consuming guidance:** update category README live adapter description,
   `docs/research/README.md`, production-light bridge doc, research-ops and the
   `.agents/skills/product-research-engine/SKILL.md` routing table plus its actual
   mirrored consumer if present. Frozen standards/runbooks are not edited. Document
   single staged intake versus two-lane validation; do not overclaim readiness.

Main owns combined focused verification, explicit source lint, typecheck and final
whole-branch Claude/high review. Use the machine-wide gate; no independent full
suites. Mocks operate at the subprocess/HTTP boundary and observe behavior, not
private helper structure. A real model/cohort trial and new runtime/schema writes
are later separately authorized rollout work, not substituted by local fixtures.

Concrete commands: Task 1 uses `npm run test:focused --
tests/shampoo-production-light-adapter.test.ts
tests/shampoo-production-light-calibration.test.ts
tests/shampoo-production-light-cli.test.ts
tests/shampoo-research-v1-6-2-lock.test.ts` (40/40 passed on this base).
Tasks 2–3 add `tests/product-intake-shampoo-research-adapter.test.ts` and
`tests/product-intake-shampoo-research-stages.test.ts` to that focused command;
Task 4 adds the existing category-router, worker-cycle, readiness, heartbeat and
image owner tests to final combined verification. Final `npm run typecheck` and
explicit `eslint --no-ignore` on affected source run through the shared gate.
Full hosted CI runs after separately authorized publication; local focused
evidence never waives it.

## Review and handoff

Self-review: source authority, blindness, immutable evidence, exact submission,
budget/recovery, D2 retention and no-activation boundaries map to concrete seams
and behavioral checks above. No threshold or locked method is reopened. Run one
read-only terminal Claude/high plan review before implementation, verify findings,
retain the disposition here and discard transient output outside Git.

Commit intended: adopted owner patch, integration source/tests, plan and synchronized
living guides. Archive outside Git: exact dependency/fingerprint/check receipts.
Discard: temporary sealed fixture kits/model-output captures and transient review
reports after disposition. Preserve unrelated worktrees/configuration. Stop before
commit/push/PR for this separate increment unless authorized; merge, migration,
deploy, model trial, product publication and switches each retain their gates.

## Counterpart plan review disposition

Claude/high, read-only terminal review: approve with revisions. Findings verified
against both worktrees, not just the pre-dependency Shampoo base:

| Finding                                               | Type                               | Decision and revalidation                                                                                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing safety API/budget implementation in this tree | defect in dependency specification | Accepted precise dependency naming/barrier and API list. Implementation already exists in #691; rejected inventing a second counter, weakening to artifact counting, or silently parking requested integration. |
| “Existing judge” could mean old shadow A/B comparator | defect in dependency specification | Accepted clarification: #691's single projected-value gate is the dependency. The old `runCodexJudge` comparator is not used for this gate.                                                                     |
| Single-lane routine intake is a risk/rigor choice     | scope/product decision             | Confirmed by Nick after the comparison/example: one isolated lane + Sol + his approval; validation batches stay two-lane.                                                                                       |
| Six-run/45-minute cap needs explicit approval         | scope/product decision             | Already confirmed by Nick's 2026-10-16 recovery answer; recorded without reopening it.                                                                                                                          |
| `blindId` cannot establish exact submission ownership | defect risk                        | Accepted explicit negative binding case; underlying offline convenience fallback is not valid at intake.                                                                                                        |
| Commands should be concrete                           | specification gap                  | Accepted focused commands and final gate ownership above.                                                                                                                                                       |

Core projection/binding preparation is clear; orchestration uses Nick's explicit
one-lane decision and the exact reviewed safety dependency. Raw review report is transient outside Git and discarded
after this disposition and a private receipt are retained.

## Historical preparation receipt — before stage implementation

- Exact #682 patch adopted locally; 40 projector/calibration/CLI/lock checks passed.
- Pure exact-binding bridge and its three boundary tests implemented. Negative
  cases cover wrong/missing submission and formula bindings, blind-ID fallback,
  method pins, duplicate carriers and low-confidence projector rejection. Invalid
  projection clears stale Shampoo values/rationales while preserving protocols.
  Positive cases assert actual current-storage writes and D2 retention/questions.
  Removing failure cleanup produced the intended stale-value failure before
  restoration. Main inspected both files, reran all three bridge boundary tests,
  and passed typecheck plus explicit source lint with zero warnings/errors.
- Living routing guides corrected to v1.6.2; no frozen standard/runbook edited.
  No separate Claude skill mirror exists in this checkout; the repo-owned skill
  is the single router. No worker registry activation was implied by those guide fixes.
- At that checkpoint, stage-proof validation, isolated model execution,
  repair/reclaim, shared judge/completion and D2 decision consumption remained
  incomplete. The continuation below supersedes those local implementation gaps;
  live Admin decision consumption and deployment remain later gates.
- These changes remain local/uncommitted. Nick authorized publication of the
  separate safety PR #691, not this new Shampoo increment.

## Execution continuation

Nick approved the lane design and requested continued implementation with alerts
disabled. Local dependency adoption is an integration detail; it neither authorizes
merge nor changes the live worker. Main owns the worker/router/completion wiring,
final verification and review. The sealed-stage module supplies an actual
production dependency callback to the common model launcher, never a separate
uncounted Codex path. A persisted proof is reusable only from a server-stamped
Shampoo-stage artifact for the same submission/cycle/method; model-authored proof
keys are stripped and rebuilt by the orchestrator. A fresh human cycle never
reuses a previous cycle's blind result.

Implemented locally: source/blind/reveal orchestration, protected proof and
formula fingerprint preservation, complete native-record validation, category
registry/worker wiring, mandatory shared Sol completion, D2 human decision with
retained rows, and immutable same-cycle repair. Routine Shampoo skips the generic
shadow comparator; validation tooling remains two-lane. The server clears all
model-written review approvals before freezing outputs. No live configuration,
alert, model run, migration, release or catalog content changed.

Verification: 40 adopted projector/calibration/CLI/lock checks, 194 focused
owner/sibling checks and three actual worker subprocess cases passed. The latter
prove ordinary readiness, D2 retention despite a clean Sol verdict, and a second
worker pass loading persisted proof for repair plus Sol at exactly six runs.
The subprocess exposed fixes for structured-versus-prose rationales and Sol
telemetry role; both regressions failed before the repair and passed afterward.
Blind identity/web isolation, refusal before spawn, proof tampering, changed
formula/cycle, complete native evidence and discarded model approvals have
recorded negative proof. Final typecheck passed. Source lint passed with zero errors
and the same six baseline worker warnings. Claude/high reviewed the exact 35-file
increment against the adopted safety dependency: **No blocking findings**.
Detailed commands/fingerprints remain in private receipts. Full hosted CI and a separately authorized real-model
cohort remain required before activation; fixture tests do not prove model quality.

## Counterpart code review disposition

The first CLI invocation stalled without a report and was stopped by its exact
owned PID. The same read-only terminal review succeeded with unrelated MCP
integrations excluded and a reliable timeout. No model or review scope changed.
Main inspected the report and all observations:

- Judge telemetry now correctly labels projected/image judges as `judge` rather
  than `researcher`; future analytics must account for that metadata correction.
  No historical artifact is rewritten.
- D2 plus a machine defect returns to Nick with retained defects and the listing
  question. This is the approved human decision taking precedence over correction,
  not a new automatic action or an omitted research issue.
- Rejected a false-positive suggestion that model-emitted protected formula
  carriers survive into uniqueness validation: `normalizeCodexOutput` filters
  `formula` via `isModelGeneratedArtifactKind` before the worker appends its own
  carrier, and mirrored proof keys are stripped/rebuilt. No source change needed.

Review covered the complete Shampoo increment and interactions with the exact
adopted dependencies. Existing #691 internals retain their independent verified
receipt. Final post-review changes are this disposition/checklist only; main
reviewed that documentation delta and refreshed the final content fingerprint.
Transient reviewer output is discarded after retaining the private verdict receipt.

## Current setup checklist — 2026-10-16

This supersedes older preparation checkboxes for Shampoo; it does not declare the
parent setup complete.

- [x] Routine Shampoo uses one isolated blind/reveal lane, shared Sol and Nick's
      approval locally; validation tooling retains two independent lanes.
- [x] Exact method/formula/cycle proof, immutable bounded repair and D2 retention
      implemented; 237 focused checks, typecheck, source lint and counterpart review pass.
- [x] Live read-only refresh: current release remains
      `20261015-201339-7c00ca4a76c6`; worker/review healthy, fresh heartbeat, zero
      queued/running/rework jobs, empty alert outbox. Email/image switches are false;
      auto-rework is unset/default disabled. Two installed releases, disk 60% used.
- [x] Safety PR #691 remains at reviewed `75da3b16`, draft/open with required CI
      successful. Offline projector #682 remains draft/open at `f790ab5d`, unchanged.
- [x] Nick authorized publication; draft #693 is published, stacked on the exact
      #691 head `75da3b16`. #682's adopted method/projector bytes remain unchanged.
- [ ] Resolve #682's owner-PR disposition explicitly rather than silently closing
      or merging it. Complete full hosted CI and Security on the final #693 head.
      The original failures and their repairs are recorded below. Current-main CI
      passed the Scanner journey; a separate Scanner CI owner is addressing its race.
      Alert #34 is now fixed on main (read-only API refresh); rerun analysis on this
      final head rather than treating workflow success alone as a passing CodeQL check.
- [ ] Obtain exact merge, migration and disabled-release authorization. Apply
      `20261016052958_product_intake_review_cycles.sql` and successor
      `20261016131141_product_intake_atomic_artifact_ids.sql`, together with the required
      Oil binding migrations, before worker code. No migration was applied in this
      completion pass. Verify installed release/env/lease state and rollback preconditions.
- [ ] Complete private immutable review images, payload revisions, hash/revision-
      bound data/image approvals, authenticated D2 answers, guarded Admin publication,
      rework and notification-only recovery using the approved Admin journey.
- [ ] Implement/prove the shared rembg/price-audit lock and representative resource
      limits; verify monitoring issue/routing delivery. Installed units still have no
      memory caps and the shared heavy-work lock is absent.
- [ ] Align exact backlog disposition and the ten-case live validation cohort,
      then run the bounded proof under approved limits and obtain Nick's exact product
      approvals. Latest jobs for 141 open submissions are 110 blocked, 14 failed and
      17 awaiting review; these include test/historical rows, not 141 verified waiting
      customers. Shampoo accounts for 39 blocked, 2 failed and 4 awaiting review.
- [ ] Automatic alert activation remains a separate later decision. Nick approved
      the received test email; keep sends disabled and never flush the backlog by
      implication. Automatic images/rework also stay off during this setup.

## CI and Security repair — 2026-10-16

The ReDoS regression exercises real source validation in an interruptible child:
old source times out, the linear scanner returns promptly with the same synonym
grammar. Frozen historical captures are unchanged; assertions now require sealed
Shampoo research and reject legacy unsealed classifications.

The Linux subprocess failure has a concrete transport cause: the locked standard
is 165,970 bytes, exceeding Linux's 128 KiB per-argument limit. A harmless Linux
spawn probe reproduced errno 7. Large prompts now use the documented `codex exec -`
stdin interface, with asynchronous full-byte delivery and explicit EOF; short
prompts still have stdin closed. The independent Unicode/real-child regression
fails with `E2BIG` on the previous implementation and verifies SHA-256 byte identity
after the fix. The existing CLI proofs exercise full blind/reveal and repair over
this transport. No method truncation, extra model run or reservation refund.

Focused verification: 113 tests pass, including transport/heartbeat/cycle/model
config/image seams, stage and CLI proofs, and historical compatibility checks.
Typecheck passes. Final source lint and counterpart delta review are recorded in
the private verification receipt before push. Hosted confirmation remains required.
The Scanner overlay failure also occurs on main `80b963a2` (run `38872955498`);
no force-click or unrelated Scanner behavior change is included here. The latest API refresh reports CodeQL alert #34 fixed on main; final-head analysis
remains required. See [the completion record](s2-completion-2026-10-16.md) for the
current-main reconciliation, atomic Oil compatibility repair and updated verification.
Merge, migration application, deployment and automatic alert activation remain
separate decisions for Nick.
