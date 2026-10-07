# Product Intake model routing and shadow evaluation

## Outcome and source context

Configure the Product Intake worker so normal research uses GPT-6 Luna at low reasoning effort, quality review uses GPT-6 Sol at medium reasoning effort, and GPT-6 Luna at medium effort runs as a bounded shadow challenger. GPT-6 Astra is excluded. The same Hetzner worker processes suitable researched flat product images through a resource-bounded `rembg`/`isnet-general-use` container before the existing Chaarlie finalizer, then gives the raw source, magenta QA, and neutral render to a dedicated Sol/medium visual judge. The change extends the existing durable Supabase job and artifact flow described in `docs/product-intake-research-ops.md`; it keeps Nick's final-image review and guarded catalog-publication gates authoritative while removing the routine extra click required only to start reversible image processing.

## Chosen direction

One claimed research job runs a deterministic workflow:

1. Run the production researcher with Luna/low.
2. For the first 10 eligible research runs, also run Luna/medium against the same prompt packet. This is the challenger and is never allowed to write the submission's review draft.
3. Give both outputs to Sol/medium in anonymized order and ask for a structured quality judgment against the Product Intake contract.
4. Persist the researcher runs and judge verdict as durable research artifacts, including model, effort, duration, output hash, and verdict.
5. Persist only the Luna/low result through today's normal normalization, blocker, and `researched_payload` path. Nick remains the final reviewer; catalog publication stays separately approval-gated.
6. Automatically process a review-ready image candidate, then run a separate Sol/medium visual judgment over the raw source, magenta QA, and neutral render before presenting all evidence together to Nick.

The shadow experiment is intentionally finite. It is enabled by configuration and targets 10 successfully judged jobs. The worker checks the durable completed-judgment count before each challenger run; a multi-process deployment may overshoot the target by at most the number of simultaneously eligible workers, which is acceptable for this low-risk experiment and is documented rather than disguised as an exact distributed counter. A future promotion from Luna/low to Luna/medium requires a separate evidence review and configuration change.

## Scope and non-goals

In scope:

- model/effort configuration for production research, shadow research, and judgment;
- a structured judge contract and blind candidate ordering;
- durable model-run and model-judgment artifacts with enough telemetry to compare quality, latency, and usage when the CLI exposes it;
- a migration extending the artifact-kind constraint;
- focused automated tests and operations documentation;
- deployment-ready configuration values for the Hetzner worker;
- Linux background removal for explicitly selected raw images, using a pinned local container and the existing magenta/final-image QA flow;
- a five-image production pilot that stops at final-image review;
- automatic internal processing of a research-ready exact image candidate so raw, magenta-QA, and neutral renders arrive together for one human review;
- a strict visual-quality verdict covering shadows/reflections, packaging or extra objects, edge residue/halos, rectangular remnants, jagged edges, and accidentally removed product content;
- a small versioned reference manifest drawn from the accepted pilot and reviewed production-catalog packshots, with runtime assets retained outside release directories.

Non-goals:

- no Astra calls;
- no automatic promotion of Luna/medium;
- no judge-triggered catalog write, publication, or mutation of Nick's review decision;
- no new admin UI, email delivery, ImageKit integration, or catalog image upload in this slice;
- no final image approval, catalog publish, user linking, or notification during the five-image pilot;
- no automatic image approval or catalog-readiness decision from the visual judge;
- no broad reference-library curation, synthetic defect generator, new inbox/email/admin surface, or public exposure of the SSH-only cockpit in this slice.

## Target map

- `scripts/product-intake/codex-research-worker.ts`: runtime lanes, researcher execution, blind judge execution, telemetry, and persistence ordering.
- `packages/product-intake-core/src/jobs.ts`: new artifact-kind constants.
- `supabase/migrations/<timestamp>_product_intake_model_evaluation_artifacts.sql`: expand the database artifact-kind contract without changing RLS or publication access.
- `tests/product-intake-codex-model-config.test.ts`: model defaults, overrides, CLI arguments, experiment cap, blind ordering, and fail-closed judge behavior.
- `tests/product-intake-research-jobs.test.ts`: migration/static contract coverage.
- `docs/product-intake-research-ops.md`: exact production, challenger, judge, measurement, failure, and rollout behavior.
- `scripts/product-intake/codex-research-worker.ts`: Linux `rembg` fallback and bounded container invocation for selected raw images.
- `scripts/product-intake/codex-research-worker.ts` `runWorkerBatch` research-completion branch: re-queue eligible research-ready jobs as `image_judging`; the existing `findApprovedSourceImageUrl` already resolves researched payload/candidate URLs without requiring a human decision.
- `apps/product-intake-review/app/product-intake-finalized/[submissionId]/[filename]`: validate and serve persistent runtime-created review images from the configured shared directory.
- `tests/product-intake-finalized-image-route.test.ts`: prove valid asset resolution and reject traversal or unsupported extensions.
- `config/product-intake-image-qa-references.v1.json`: small reviewed manifest of durable internal examples; production files remain in the shared Hetzner asset root rather than Git.
- `tests/product-intake-image-quality-judge.test.ts`: image attachment arguments, strict verdict validation, reference selection, automatic processing eligibility, and advisory failure behavior.
- `apps/product-intake-review/app/submissions/[submissionId]/page.tsx` and `submission-actions.tsx`: accept a fresh agent-prepared artifact without a `raw.image` approval, show the visual verdict, and preserve reject/rework/final-approval controls.

## Decision coverage

Status: confirmed.

### Confirmed with Nick

- Production researcher: GPT-6 Luna, low effort.
- Parallel comparison: GPT-6 Luna, medium effort.
- Judge: GPT-6 Sol, medium effort.
- GPT-6 Astra must not be used.
- Hetzner should perform background removal locally when that avoids a paid external API, provided the 4 GB server can run it safely.
- Pilot authorization: set up the flow and put the first five suitable image candidates through it for Nick to test; stop before final approval or catalog publication.
- Scale-up authorization: suitable researched candidates may be processed automatically before review; the visual judge should especially inspect shadows, packaging, and unclean/cut-off edges; retain only relevant pilot and production-catalog examples as a compact reference set.
- Visual-judge/reference acknowledgement: “Don't overprepare or decide on everything. Retain relevant examples for production and then let's keep this as a reference. Should be fine. Anything else or can we start building this then?”
- Coverage acknowledgement: “Yeah I like your recommendations. Let's set it up that way. I also want to test, in parallel, if we perhaps get better results if we increase the Luna effort to medium … Sol on medium … is good for now.”
- Production setup and pilot acknowledgement: “Okay let's try with that. Can you set up the flow and then put the first five images through it so I can test?” This authorizes the Hetzner worker/review services, the additive production migration required by that flow, live queue activation, and the bounded five-image pilot. It does not authorize final-image approval, storage upload, catalog publication, user linking, or notification.

### Inherited from evidence or contract

- Standard processing remains the default by omitting an explicit service tier; expedited processing is opt-in only.
- Research outputs are drafts. Nick's human review and the guarded publish path remain authoritative.
- Exact identifiers, schema validation, job leases, artifact persistence, and publication remain deterministic boundaries.
- Existing queued production jobs must not be claimed merely because implementation is complete.

### Implementation defaults

- The shadow experiment covers 10 successfully judged eligible jobs. Failed challenger or judge calls are recorded but do not consume a successful comparison slot.
- Candidate labels and ordering are randomized before judgment; the verdict maps them back deterministically after parsing.
- The judge receives normalized structured outputs and the rubric, not repository write tools or database credentials.
- Luna/low continues even if the shadow challenger or judge fails. The worker records the failure and sends the Luna/low result through the existing human-review path. This preserves intake availability without treating a failed judgment as approval.
- No automatic research-repair loop is added in this slice. Judge findings become evidence for the experiment and later prompt/model tuning; Nick's existing explicit rework flow remains the only rework trigger.
- `rembg` is opt-in, uses the Apache-2.0 `isnet-general-use` model in a digest-pinned container, runs with no network and bounded CPU/RAM, and is invoked only after alpha passthrough and only one image job at a time.
- The production pilot records raw-image selection solely to start processing; Nick still reviews the processed neutral image and magenta QA separately.
- Automatic processing is an internal, reversible preparation step. It neither records a human raw-image approval nor satisfies `final.image` approval.
- The visual judge returns `pass`, `rework`, or `needs_human_review` with structured defect kind, region, severity, explanation, and confidence. A failed/unavailable judge remains visible as `needs_human_review`; it cannot approve or publish.
- The visual verdict controls preparation readiness, not human approval: `pass` may mark the processed artifact ready for Nick even when the deterministic heuristic was over-cautious; `rework` keeps it in image work; `needs_human_review` keeps the existing explicit override path. The deterministic result remains visible as evidence.
- Runtime reference selection is capped at five examples and favors one known residue failure plus representative accepted shapes/dark bases. New examples enter only through an explicit manifest update, not automatically from arbitrary user uploads.
- Usage fields are nullable because Codex CLI output may not expose token accounting in a stable machine-readable form. Duration and output hashes are always recorded.

### Open consequential assumptions

None. Promotion criteria, public/admin presentation beyond the existing SSH-only review cockpit, notifications, automatic image approval, and automated image-repair loops are parked out of scope by this plan and require later decisions or authorization.

### Internal revalidation

- Revision 1: the shadow lane cannot affect `researched_payload`, job readiness, review decisions, or publication; no newly introduced product decision remains unresolved.
- Revision 2 after counterpart review: Astra is hard-rejected; the worker refreshes its lease between model calls; the 10-job threshold is an explicit target with bounded multi-worker overshoot; malformed judge output is not retried; repository-native test commands and experiment cost/latency are explicit. These are implementation-fidelity changes and do not reopen Nick's confirmed model choices.
- Revision 3 after whole-branch review: the Luna/low draft is normalized and persisted before optional shadow evaluation; telemetry-write failures become `telemetry_failed` progress rather than failing the research job, while lease loss still fails closed. Research models cannot emit worker-owned telemetry artifact kinds. No product choice changed.
- Revision 4 after final counterpart review: both the worker output and runtime image route now consume `PRODUCT_INTAKE_FINALIZED_IMAGE_DIR`, removing the hidden operational dependency on a release-local symlink. The production authorization quote and runtime route are recorded explicitly above. No product choice changed.
- Revision 5: Nick approved automatic reversible image preparation, a dedicated visual-quality judge focused on shadows, packaging, and edge/cutout defects, and a compact retained reference set using the pilot plus reviewed production catalog images. Final human image approval and guarded publication remain unchanged.
- Revision 6 after counterpart review: current `codex exec --help` was verified to support `-i/--image`; the exact worker auto-requeue and review-model seams are named; `image_judgment` is a dormant existing artifact kind that will now be populated; unnecessary deployment-preflight machinery was removed. The retained reference set stays in scope because Nick explicitly requested it. The visual verdict resolves known deterministic-gate over-caution only for preparation readiness, never approval or publication.
- Revision 7 after final code review: the complete optional shadow-evaluation invocation is now non-fatal, including lease-refresh and serialization failures, and a regression test proves good production research retains its job path. The integrated UI uses neutral “Bildquelle vorbereitet” wording so an agent-prepared source is never presented as a human approval. Standard-tier omission and concrete model labels remain the deliberate measurement/cost contract recorded above.
- Revision 8 after delegated implementation audit: image-processing failures now use the latest refreshed lease when recording failure, so a post-judge persistence error cannot strand a running job until stale recovery. The persistent finalized-image route now enforces the same local/internal access boundary as the review cockpit before reading an asset. Focused regression tests cover both defects. Missing or invalid optional calibration references still produce warnings and are skipped as originally approved; they never grant human approval or publication authority.
- Undiscussed consequential assumptions affecting this handoff: none.

## Operator and integration journey

The existing review page remains the surface, but the review journey is simplified: the raw source and prepared outputs arrive together instead of requiring a routine “Bild passt” click before processing. Nick reviewed the current live cockpit and approved this one-pass direction in the conversation above; no new layout, navigation, or public-user experience is introduced.

1. An existing Supabase trigger creates a research job after an unknown product is confirmed.
2. The worker claims the job and creates the existing prompt packet.
3. Luna/low researches the product. During the bounded experiment, Luna/medium receives the same packet independently.
4. Sol/medium judges anonymized candidates and the worker records the comparison.
5. Only the validated Luna/low result updates the submission draft and existing job status.
6. When research has no blocking image uncertainty and contains a renderable exact candidate, the same durable job automatically enters serial image processing. The worker creates the cutout, magenta QA, and neutral render, then asks the visual judge for an advisory structured verdict using at most five retained references.
7. Nick sees the raw candidate, processed render, magenta QA, properties, and visual verdict together. He may approve the final image, request another image, or request product rework. No automatic judgment records a human approval.
8. If a model lane or the visual judge fails, the job retains an auditable artifact and reaches human review with the failure explained; publication remains unavailable until Nick completes the existing explicit review gates.

Planning evidence is the current live submission page Nick tested at `http://127.0.0.1:3911/submissions/<submission-id>` plus the agreed ordered journey above. The selected direction keeps its layout and approval controls, adds the visual verdict, and removes only the processing prerequisite click. No separate mockup is required for this bounded refinement; the public submission journey remains unchanged.

## Ordered tasks

### 1. Define model-lane and evaluation contracts

Consumes: existing `CodexResearchRuntimeConfig`, Codex CLI invocation seam, research output schema, and artifact contract.

Produces: explicit production, challenger, and judge configs; bounded-experiment eligibility; structured judge output; deterministic blind mapping; runtime measurements.

Implementation:

- keep Luna/low as the default production config;
- add Luna/medium and Sol/medium defaults with environment overrides; reject `gpt-6-astra` explicitly on every lane before any Codex process starts;
- factor the Codex execution seam so researcher and judge runs share timeout/error handling without sharing prompts or output files;
- use unique output paths for concurrent/sequential lanes;
- make the judge return a strict JSON verdict with preferred anonymous candidate, rubric scores, material issues, and confidence;
- schema-validate the judge verdict once; malformed output is recorded as a non-fatal evaluation failure rather than retried, because it cannot authorize or alter the production path;
- refresh the job lease after Luna/low returns, after Luna/medium returns, and after Sol returns so no blocking CLI call inherits a lease older than the existing 10-minute stale threshold;
- treat malformed/failed challenger or judge output as non-fatal evaluation failure while retaining production research behavior.

Completion criterion: unit tests prove exact model/effort CLI arguments, Standard-tier omission, hard Astra rejection, blind-label mapping, output-path separation, lease refresh ordering, strict verdict validation, and fail-open-to-human-review semantics.

### 2. Persist auditable experiment artifacts

Consumes: lane results, runtime telemetry, output hashes, and judge verdict.

Produces: `model_run` artifacts for each executed lane and one `model_judgment` artifact for each completed or failed comparison.

Implementation:

- extend the shared artifact-kind constant and database check constraint;
- store role/lane, model, effort, duration, output hash, success/failure, nullable usage, anonymous ordering, mapped preference, rubric scores, and issues;
- count only successful `model_judgment` artifacts toward the 10-job target and document the bounded multi-process overshoot behavior;
- ensure service-role-only RLS and existing artifact deletion/retention behavior remain unchanged.

Completion criterion: migration/static tests and repository tests prove both artifact kinds are valid, inaccessible to public roles, and contain no publication side effect.

### 3. Integrate evaluation without changing the production draft

Consumes: production research output and optional evaluation result.

Produces: the same normalized Luna/low draft/status behavior as today plus additive telemetry artifacts.

Implementation:

- run the challenger only while enabled and below the durable completed-judgment target;
- judge only when both research lanes return parseable outputs;
- refresh the leased job between each potentially five-minute model call and thread the latest lock timestamp into later updates;
- normalize and persist the Luna/low production output before the optional shadow evaluation so telemetry failure or latency cannot withhold the review draft;
- normalize and save only Luna/low as the submission's `researched_payload`;
- include compact experiment status in job progress without exposing the challenger as an approved result;
- keep per-lane measurements in `model_run`; keep `model_judgment` limited to anonymous ordering, mapped verdict, rubric scores, and judge-run linkage rather than duplicating all lane telemetry.

Completion criterion: focused worker tests prove a judge preference for Luna/medium cannot change the saved draft, readiness decision, blockers, or publication state; challenger/judge failure still yields the normal Luna/low review path.

### 4. Document configuration and activation boundary

Consumes: tested environment variables and experiment semantics.

Produces: an operations runbook section with exact defaults, overrides, cap behavior, metrics to review, and the stop point before production activation.

Completion criterion: the documentation names Luna/low, Luna/medium, Sol/medium, Standard processing, hard Astra exclusion, the 10-job evidence review, the temporary roughly three-call cost/latency multiplier, bounded multi-worker overshoot, and the separate authorization needed before the Hetzner service starts claiming live jobs.

### 5. Add Hetzner image processing and run the five-image pilot

Consumes: reviewer-selected image-candidate URLs, the existing `image_judging` job stage, the existing finalizer, and the measured 4 GB Hetzner capacity.

Produces: transparent cutouts, magenta QA images, and neutral 1200x1200 review images in the existing review cockpit, without upload or publication.

Implementation:

- preserve clean-alpha sources without model inference;
- keep Apple Vision as the macOS path and use opt-in `rembg`/`isnet-general-use` on Linux;
- pin the container digest, pre-download the model, disable runtime network access, and cap the container at 2.5 GB RAM, 3 GB including swap, two CPUs, and 256 processes;
- run the production worker with concurrency one so Codex research and image processing do not overlap on the 4 GB server;
- process five existing, renderable image candidates through the normal raw-image-selected to final-image-review path;
- stop before `final.image` approval, storage upload, or catalog handoff.

Completion criterion: five processed-image artifacts are visible for Nick with both neutral and magenta review images, and the worker remains serial and healthy.

### 6. Serve persistent runtime review images safely

Consumes: runtime-created finalized assets stored outside atomic release directories.

Produces: review URLs that continue to work for assets created after application startup and across release switches.

Implementation:

- configure a shared finalized-image root outside the active release and point the release-local output path to it;
- add a dynamic route that accepts only a UUID submission directory plus a supported image filename;
- resolve every request below the configured root, reject traversal and unsupported extensions, and return private no-store image responses;
- keep the review app bound to localhost and accessed through the SSH tunnel; do not expose this no-login app publicly.

Completion criterion: tests reject traversal and unsupported types, an asset created after app startup returns `200` without restart, and all ten neutral/magenta pilot URLs render through the tunnel.

Pilot result (2026-09-25): complete. Head & Shoulders Derma X Pro, NEQI Repair Reveal, Pantene Repair & Care, Bali Curls Hydrating Curl Cream, and Weleda Rosmarin Revitalising all produced neutral and magenta review assets. Nick accepted all five after the NEQI lower-left rectangular residue was corrected; the deterministic gate was over-cautious on the acceptable dark bases of Bali Curls and Weleda. The review and worker services are supervised separately, finalized files persist outside release directories, and a runtime image route serves assets created after application startup. No final-image approval, upload, product approval, or catalog publication was performed.

### 7. Add a bounded visual image-quality judge

Consumes: downloaded raw candidate, transparent cutout/magenta QA, neutral final render, Sol/medium runtime config, and an optional compact reference manifest.

Produces: one `image_judgment` artifact with `pass`, `rework`, or `needs_human_review`, confidence, and structured localized defects; the processed-image artifact links the verdict without acquiring approval authority.

Implementation:

- extend the shared Codex CLI argument builder with the verified read-only `-i/--image` attachments;
- attach the current raw source, magenta QA, and neutral render plus at most five valid reference images;
- instruct the judge to check shadows/reflections, outer or secondary packaging, extra objects, edge residue/halos, rectangular remnants, jagged edges, and product content cut away by the mask;
- distinguish acceptable intrinsic dark bottle bases from removable background/shadow residue;
- validate the verdict strictly and persist prompt version, model, effort, duration, confidence, defects, and reference-set version;
- never convert `pass` into `final.image` approval; use it only to mark the prepared artifact ready for Nick, convert `rework` into visible image work, and route judge failure/uncertainty to human review.

Completion criterion: focused tests prove exact image attachment ordering, verdict validation, defect localization, reference cap/path containment, and that every judge outcome still requires Nick's final image decision.

### 8. Deliver one-pass prepared image review

Consumes: a complete research result with no image blocker and a renderable exact image candidate.

Produces: a re-queued `image_judging` stage that processes the candidate without first writing a raw-image approval, followed by one review page containing raw, processed, magenta QA, properties, and visual verdict.

Implementation:

- re-queue the leased job for serial image processing only when the normalized production result is review-ready and contains a usable image URL;
- mark the processing selection as agent-prepared rather than human-approved;
- accept and display a fresh processed-image artifact even when `raw.image` has no approval decision;
- keep existing rejection/search-rework and final-image approval controls; remove only the routine prerequisite click that started reversible processing;
- retain the current manual start/retry path for missing, failed, or legacy jobs.

Completion criterion: worker/state tests prove eligible research automatically reaches image processing, blockers do not, stale artifacts are ignored, and publish preflight still fails until Nick approves `final.image` and the final product handoff.

### 9. Retain a small production-relevant reference set

Consumes: the original failed and corrected NEQI outputs, accepted Pantene/Head & Shoulders/Weleda/Bali Curls pilot outputs, and a few visually reviewed public catalog packshots already live in production.

Produces: a versioned repository manifest for a persistent shared Hetzner reference directory; no customer-uploaded photo is retained. The existing dormant `image_judgment` artifact kind is populated; no database migration is needed for it.

Implementation:

- label references with expected verdict, defect classes/regions, and concise rationale;
- keep binary assets out of Git and resolve only manifest-relative paths below the configured shared reference root; validate optional SHA-256 values while loading the manifest;
- start with the smallest balanced set that teaches the known failure and acceptable dark-base distinction;
- use later explicit human decisions as candidates for a future manifest revision, never as automatic training data.

Completion criterion: the manifest and contained paths validate when the worker loads them, supplied checksums match, missing references are skipped without granting approval, and the known failed NEQI image plus accepted dark-base examples are represented.

## Verification

Automated:

- focused TypeScript tests for model configuration, CLI argument construction, evaluator contracts, target counting, blind mapping, lease refreshing, and production-output isolation;
- research-job migration/static tests;
- existing Product Intake worker and queue regression tests;
- focused visual-judge and automatic-image-preparation tests;
- `npm run test:node` for the repository's server-only shimmed Node suite;
- `npm run typecheck`;
- `git diff --check`.

Manual/local:

- run a fixture prompt through mocked/controlled lane outputs and inspect persisted artifact payload shapes;
- optionally run one no-database CLI smoke for Luna/low, Luna/medium, and Sol/medium to verify account/model access and strict JSON parsing;
- run the visual judge read-only over the retained pilot set and compare its verdicts with Nick's recorded decisions before enabling automatic preparation for new submissions.

Migration/live-state:

- the model-evaluation migration is applied before the always-on worker starts;
- the production pilot claims only the explicitly queued five image-processing jobs before general research processing resumes;
- visual judging and automatic preparation remain disabled until the reference manifest is installed and the retained-set smoke matches the expected verdicts; enabling the worker configuration is a separate deployment action.

Evidence-sensitive review:

- Claude counterpart reviews the hardened plan and the final meaningful branch diff at high effort, read-only;
- Codex verifies each finding against current code and tests.

## Review and handoff

- Worktree: `.worktrees/product-intake-model-routing`
- Branch: `codex/product-intake-model-routing`
- All plan, code, migration, tests, and operations documentation are committed artifacts when later authorized for publication.
- Transient CLI output and counterpart-review files are discarded outside the repository.
- The earlier authorization covered the existing Hetzner pilot deployment, migration, worker activation, and five image-processing jobs. The latest acknowledgement authorizes building and verifying this visual-judge/one-pass slice in the task worktree. Commit, push/PR, merge, deployment of the new slice, final image approval, catalog publication, and cleanup remain separate gates.
