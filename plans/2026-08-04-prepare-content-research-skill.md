# Prepare Content Research Skill — Implementation Plan

## Outcome and source context

Create a repo-owned `$prepare-content-research` skill that lets a co-founder or other operator point Codex at this repository, invoke the skill explicitly, answer only the missing brief questions, and receive a verified structured research package for a downstream content-generation system.

The skill will make existing Hair Concierge category guidance the first source of truth, escalate genuine evidence gaps to targeted scientific or expert research, keep every source type visibly separate, return the package to the caller, and save the completed request for traceability and improvement.

Confirmed source context:

- `data/agent-v2/guidance/categories/*.md` contains current category interpretation, boundaries, and explanation guidance.
- Paired category `*.json` files contain hard rules, review rubrics, and grounding requirements.
- `data/agent-v2/guidance/base/` contains cross-category advice, safety, product-grounding, and answer-quality guidance.
- `docs/agent-v2-guidance-migration/category-guidance-standard.md` defines the separation between model judgment, product/catalog truth, and deterministic boundaries.
- `.agents/skills/hair-care-expert/SKILL.md` owns external hair-care evidence research and conservative evidence handling.
- The operator journey and research-only boundary were confirmed in the planning conversation on 2026-08-04.

Planning contract:

```text
Outcome: An explicitly invoked repo-local skill returns and saves verified, provenance-rich content research.
Constraints: Repo-first source selection; targeted external escalation; transparent provenance; adaptive intake; no broad repo search; preserve uncertainty and conflicts; protect root-main/worktree safety.
Non-goals: Scriptwriting, voice, hooks, visuals, storyboards, video prompts, generation, publishing, recommendation-engine changes, catalog writes, or automatic model training.
Done when: The skill, source policy/manifest, package contract, validator, tests, forward tests, and operator evidence pass review and the confirmed journey works end to end.
```

## Chosen direction

Build one concise, explicitly invoked skill named `prepare-content-research` under `.agents/skills/`. Keep procedural rules in `SKILL.md`; put detailed source routing and the output contract in one-level bundled resources so category knowledge is referenced rather than duplicated.

The skill will use a bounded workflow:

1. Read the caller's initial brief and ask only missing high-value questions.
2. Classify the research request by category, claim type, product specificity, evidence risk, region, and intended content scope.
3. Build a source packet from a versioned allowlist. Do not search the whole repository as the default retrieval strategy.
4. Extract atomic claims before writing the human-readable research summary.
5. Invoke the existing `hair-care-expert` evidence workflow for a real scientific or expert-guidance gap. Keep external evidence separate from current repository guidance and runtime behavior.
6. Run a fresh read-only claim-to-source verification pass. Prefer a context-isolated sub-agent when available; otherwise perform a separate explicit verifier pass over only the raw package and source packet.
7. Repair supported defects, preserve conflicts, omit unsupported claims, and record unresolved gaps.
8. Return the human-readable research package to the caller and persist a Markdown plus JSON pair without committing, pushing, or publishing.

The first version will not introduce a general RAG service, embeddings, an autonomous research graph, a content database, or a video-provider integration. The source set is bounded enough for an allowlisted manifest plus model-directed file loading and targeted search.

## Scope and non-goals

### In scope

- Explicit `$prepare-content-research` discovery and invocation metadata.
- Adaptive intake that asks no more than four questions and skips already answered fields.
- A versioned source-selection policy and category manifest covering the current Hair Concierge category packages.
- Distinct provenance labels for repository guidance, repository runtime, repository product data, external science, external expert guidance, current product sources, synthesis, and unsupported claims.
- Automatic targeted external research when the repo has a material gap.
- A human-readable research handoff and machine-readable package.
- Package persistence under `content-research/` with collision-safe request folders.
- Deterministic validation of package completeness and source-manifest integrity.
- Independent claim verification and realistic forward tests.
- A documented feedback field that can capture later operator corrections without claiming automatic learning.

### Non-goals

- Writing or optimizing the final video script.
- Selecting voice, tone, presenter persona, hook, CTA, scenes, visuals, or editing rhythm.
- Generating a video prompt or calling a video-generation provider.
- Publishing content or modifying production systems.
- Rewriting or duplicating category guidance inside the new skill.
- Treating migration docs, archived marketing plans, legacy guidance, or arbitrary web pages as canonical content sources.
- Updating recommendation logic, catalog data, Supabase, or product-intake state.
- Automatically changing the skill from saved packages; improvement remains an explicit reviewed maintenance task.

## Target map

| Target                                                                          | Purpose                                                                                                         | Disposition                                                                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/prepare-content-research/SKILL.md`                              | Concise intake, retrieval, evidence, verification, persistence, and stop-boundary workflow                      | commit                                                                                                                        |
| `.agents/skills/prepare-content-research/agents/openai.yaml`                    | Display metadata and explicit `$prepare-content-research` default prompt; disable implicit invocation           | commit                                                                                                                        |
| `.agents/skills/prepare-content-research/references/source-policy.md`           | Source tiers, claim types, gap escalation, conflicts, exclusions, freshness, and safety rules                   | commit                                                                                                                        |
| `.agents/skills/prepare-content-research/references/source-manifest.json`       | Versioned mapping from category/topic and claim type to required, conditional, and excluded repository surfaces | commit                                                                                                                        |
| `.agents/skills/prepare-content-research/assets/research-template.md`           | Human-readable output template copied for each completed request                                                | commit                                                                                                                        |
| `.agents/skills/prepare-content-research/assets/research-package.schema.json`   | Machine-readable output contract                                                                                | commit                                                                                                                        |
| `.agents/skills/prepare-content-research/scripts/validate-research-package.mjs` | Deterministic package and manifest validation                                                                   | commit                                                                                                                        |
| `tests/prepare-content-research-skill.test.ts`                                  | Static source routing, package schema, boundary, and fixture regression checks                                  | commit                                                                                                                        |
| `tests/fixtures/prepare-content-research/`                                      | Small valid/invalid packages and source-routing fixtures                                                        | commit                                                                                                                        |
| `content-research/<date>-<slug>/research.md`                                    | Human-readable completed request output                                                                         | runtime output; not created by the initial skill PR; commit only when a later research task intentionally retains the package |
| `content-research/<date>-<slug>/package.json`                                   | Structured completed request, provenance, verification, and optional feedback                                   | runtime output; not created by the initial skill PR; commit only when a later research task intentionally retains the package |
| `plans/artifacts/2026-08-04-prepare-content-research-journey.html`              | Durable planning mockup of the operator journey                                                                 | commit                                                                                                                        |
| `plans/2026-08-04-prepare-content-research-skill.md`                            | Approved implementation plan                                                                                    | commit                                                                                                                        |

Use the system `skill-creator` initializer during implementation to scaffold the skill, then remove every unused placeholder. Do not add a README, installation guide, changelog, or duplicated category reference files.

## Designed user journey

### Actor and entry condition

A co-founder or content operator opens Codex in the Hair Concierge repository and explicitly invokes `$prepare-content-research`, optionally including a topic and any known constraints in the same prompt. The skill does not depend on the operator knowing repository paths.

### Ordered journey

1. Codex loads the skill and reads the initial request before asking anything.
2. It identifies which of these material fields are missing:
   - exact question, decision, or misconception the research must resolve;
   - audience baseline or region only when it changes evidence selection;
   - category education versus named-product or ingredient/formula analysis;
   - intended content scope: one short video, long-form material, or a series.
3. It asks only the missing fields, in one compact intake, with a maximum of four questions. It never asks about voice, style, hooks, visuals, CTA, or video generation.
4. After the operator answers, Codex restates the research scope and proceeds without asking for ceremonial approval.
5. Codex runs branch/worktree safety before writing the durable output. If invoked from the clean protected root `main`, it creates a task worktree with `npm run worktree:new -- content-research-<date>-<slug>` and writes there. It may reuse an existing exact-task worktree only when that worktree and branch are unambiguous and safe. It must not write a package directly into protected root `main`. If a safe task worktree cannot be created or used, research continues read-only and persistence becomes a reported fallback rather than a reason to lose the returned result.
6. Codex selects the minimum relevant repository source packet from the manifest:
   - category Markdown plus its paired JSON accountability rules;
   - safety and cross-category base guidance when relevant;
   - neighboring category packages only for a real comparison or boundary;
   - runtime code/tests only for claims about current Chaarlie behavior;
   - current product/catalog sources only for named-product facts.
7. Codex records repository SHA and source-policy version, extracts candidate claims, and identifies unsupported gaps.
8. For a material gap, Codex invokes the evidence-sensitive hair-care research lane and searches authoritative scientific, regulatory, professional, or exact current-product sources. It labels those sources separately and records access dates. It does not browse merely to decorate already supported repository claims.
9. Codex creates the structured package and sends it through a fresh read-only verification pass that sees only the research brief, source packet, claims, and output contract.
10. Codex repairs verified defects. Contradictions remain visible; uncertain claims are downgraded; unsupported claims are removed from findings and retained only in `do_not_claim` or `open_gaps` when useful.
11. Codex validates the JSON package, writes collision-safe `research.md` and `package.json` artifacts, and returns the complete human-readable research to the operator with the saved path and verification status.
12. The operator can hand the package to a separate content-generation system with its own voice and creative guidelines. This skill stops.

### Error, fallback, and recovery states

- **Initial request is already complete:** ask no intake questions.
- **Category is ambiguous:** ask one category/scope question only if the source packet would materially change; otherwise load the smallest safe comparison set.
- **Repository has no adequate support:** run targeted external evidence research and label it. If research is unavailable, omit the unsupported claim and expose the gap.
- **Sources conflict:** preserve both positions, explain the conflict, downgrade confidence, and avoid an artificial consensus.
- **Named product is unresolved or formula version is unclear:** do not infer from the name. Mark the product-specific claim blocked or require exact identity/version evidence.
- **Medically adjacent claim appears:** keep cosmetic and medical boundaries explicit, avoid diagnosis/treatment language, and require suitable evidence plus conservative framing.
- **Independent verifier finds a blocker:** repair and revalidate once. If useful supported findings remain, return a package and verification status of `partial`; if none remain, use `blocked`. Name the exact unresolved claims in either case.
- **Output folder already exists:** create a timestamped or incremented request folder; never overwrite a previous completed package.
- **Persistence fails or the checkout is unsafe:** return the research in the conversation, report that saving failed, and provide the exact unsaved artifact status. Do not silently write to root `main`.

### Meaningful variants

- General category education uses guidance packages and normally needs no product source.
- Named-product research adds identity, current product/formula, and freshness requirements.
- Ingredient or scientific research commonly triggers the external evidence lane.
- A short-video brief prioritizes fewer decisive findings but does not alter factual standards; long-form or series scope may retain more claims and nuance.

### Completion state

The operator sees the research summary, prioritized findings, complete claim ledger, source separation, limitations, conflicts, `do_not_claim` list, verification result, repository SHA, and saved package path. No script or creative direction is produced.

User-journey sign-off: confirmed in conversation on 2026-08-04 for the research-only boundary and interactive flow. Reconfirm after reviewing the rendered planning artifact and any counterpart-driven journey corrections.

## Planning evidence

- Artifact: `plans/artifacts/2026-08-04-prepare-content-research-journey.html`
- Question answered: Can the co-founder invoke one skill, answer only missing research questions, and understand exactly what the skill searches, returns, saves, and refuses to produce?
- Selected direction: a three-stage conversational journey—guided intake, evidence assembly, verified handoff.
- Feedback incorporated:
  - the result is the structured research package, not a script;
  - voice and creative guidelines belong to the downstream content system;
  - external scientific/expert research runs automatically for real repo gaps and stays transparently labeled;
  - every completed request is saved for traceability and a later first-ten review.
- Evidence-review status: confirmed on 2026-08-04 when Nick reviewed the rendered artifact and explicitly requested implementation.

## Package contract

The machine package must include at least:

```text
schema_version
request_id
status
created_at
research_scope
intake
repository { commit_sha, source_policy_version, source_manifest_version }
findings[]
claims[] {
  claim_id
  statement
  importance
  source_type
  source_refs[]
  support_level
  confidence
  limitations[]
  verification_status
}
sources[] {
  source_id
  source_type
  repo_path_or_url
  title
  accessed_at_or_commit
  relevant_sections[]
}
material_gaps[] {
  gap_id
  unsupported_question
  repo_sources_checked[]
  why_repo_is_insufficient
  required_external_source_type
  status
  external_source_refs[]
}
conflicts[]
open_gaps[]
do_not_claim[]
verification { status, checked_claim_ids, blockers[] }
feedback? { operator_notes, downstream_corrections[] }
```

Allowed `source_type` values must distinguish at least:

- `repository_guidance`
- `repository_runtime`
- `repository_product_data`
- `external_scientific`
- `external_regulatory`
- `external_expert_guidance`
- `current_product_source`
- `synthesis`
- `unsupported`

The human Markdown must be generated from the same package content and present the research in this order: scope, executive summary, prioritized findings, important distinctions, claim ledger, repo/external source separation, conflicts and gaps, `do_not_claim`, and verification result.

## Ordered tasks

### Task 1 — Scaffold and expose the explicit skill

Run the `skill-creator` initializer for `.agents/skills/prepare-content-research` with only the needed `scripts,references,assets` resources and generated `agents/openai.yaml` metadata.

Implement concise frontmatter and set `policy.allow_implicit_invocation: false` so the primary entry point is explicit `$prepare-content-research`. The default prompt must show a topic-bearing example. Remove unused scaffold files.

Completion criterion: the system quick validator accepts `SKILL.md`; targeted tests separately prove that `agents/openai.yaml` exists, its default prompt invokes `$prepare-content-research`, and implicit invocation is disabled; a manual repo-pointed invocation discovers the skill by name; and no unrelated skill or repo instruction changes.

### Task 2 — Encode intake and source-selection boundaries

Implement adaptive intake in `SKILL.md` and detailed routing in `references/source-policy.md` plus `references/source-manifest.json`.

The manifest must:

- enumerate all current AgentV2 categories and advisory topics from the package index;
- map each category to its current category Markdown and JSON pair;
- map current topic packages, including `topic.night_protection.v1`, as first-class conditional sources or explicitly exclude a topic with a documented reason;
- declare base packages by purpose rather than loading all of them every time;
- declare adjacent categories only as conditional boundary sources;
- route current-behavior claims to exact runtime/test surfaces;
- route named-product claims to current product identity/fact sources;
- exclude `plans/**`, `docs/archive/**`, migration summaries as content authority, legacy `data/agent-guidance/**`, and unbounded `src/**` or repo-wide search;
- contain a schema/version field that is recorded in each output package.

Completion criterion: every manifest path exists, every current category and topic has an explicit routing decision exactly once, excluded surfaces cannot be selected as primary evidence, and tests fail on missing paths, omitted package-index entries, or broad glob patterns.

### Task 3 — Define evidence escalation and claim provenance

Add the repo-first gap test and the external research handoff. As an ordering invariant, do not invoke `$hair-care-expert` until this skill has named a material unsupported question. Then invoke the evidence-sensitive hair-care workflow, prefer primary scientific/regulatory/exact product sources, and preserve external citations with access dates.

Define claim support levels such as `direct`, `supported_synthesis`, `uncertain`, `conflicted`, and `unsupported`. Do not let an external source silently overwrite current internal product behavior; show both when reconciliation is material.

Completion criterion: a fixture with complete repo support does not trigger unnecessary web research, while a real formula/scientific gap produces separately labeled external claims and transparent uncertainty.

### Task 4 — Build the output template, schema, and validator

Create the Markdown template, JSON Schema, and a deterministic Node validator. The validator must reject missing provenance, invalid source types, duplicate claim/source IDs, claims with no source references unless explicitly `unsupported`, inconsistent verification state, and destructive path collisions.

The workflow must produce the structured package first and render the human Markdown from the same facts rather than maintaining two independent research answers.

Completion criterion: valid fixture passes; fixtures for missing citations, source-type blending, duplicate IDs, unsupported-as-approved, and invalid verification status fail with actionable errors.

### Task 5 — Implement persistence and branch safety

Write completed requests to `content-research/<date>-<slug>/research.md` and `package.json`, using a timestamp/version suffix for collisions. Run branch/worktree inspection before persistent writes. From protected root `main`, create `.worktrees/content-research-<date>-<slug>` on `codex/content-research-<date>-<slug>` through `npm run worktree:new -- content-research-<date>-<slug>` before writing. Reuse only an exact-task clean worktree; never select a similarly named branch by guesswork. Do not commit, push, open a PR, or publish unless separately authorized.

If persistence is unavailable, return the full research and report the unsaved state. Add optional feedback fields but do not claim that saved artifacts automatically train or update the skill.

Completion criterion: two same-topic fixtures produce distinct non-overwriting destinations; a protected-root fixture selects the exact task-worktree command or a visible `persistence_skipped` fallback; failed writes never suppress the returned research.

### Task 6 — Add independent verification and forward tests

Define the verifier brief so it receives only the raw request, source packet, package, and contract—not the writer's conclusions or expected answer. The verifier extracts claims again, checks source entailment and provenance, flags unsafe or overstated claims, and returns a structured blocker/warning ledger.

Forward-test at least these clean scenarios:

1. “How do I find the right shampoo?” — repo-first category education.
2. A scientific ingredient shortcut such as “Does sulfate-free always mean gentle?” — external evidence escalation and uncertainty.
3. A named shampoo/formula claim — identity and freshness boundary.
4. A scalp symptom prompt — medical-adjacent boundary.
5. A fully specified initial prompt — no redundant intake questions.
6. A repo gap with unavailable external research — partial but honest package.

Do not leave generated research packages from tests in the repository. Store only sanitized fixtures and compact evaluation results chosen for regression value.

Completion criterion: all six scenarios respect the research-only stop point, provenance labels, adaptive intake, source routing, verifier gate, and persistence boundary.

### Task 7 — Run readiness and review gates

Run the system skill quick validator, targeted Node tests, `git diff --check`, and the repository's proportional lint/type checks for changed code. Review the full diff, then run `ready-check` and `request-code-review` through `implementation-loop` before a review-ready handoff.

Completion criterion: validation passes, no critical review findings remain, planning artifacts are committed with the implementation, and the branch stops before publication.

## Verification

### Automated checks

- `python3 /Users/nick/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/prepare-content-research`
- `node --import ./tests/server-only-register.cjs --import tsx --test tests/prepare-content-research-skill.test.ts`.
- `npm run test:node` when the focused checks pass and the implementation diff can affect shared test helpers or conventions.
- Execute `validate-research-package.mjs` against every valid and invalid fixture.
- Assert every manifest path exists and every package-index category and topic has an explicit routing decision.
- Assert the manifest contains no repo-wide glob and excluded source classes cannot become primary evidence.
- Assert `agents/openai.yaml` exists, its default prompt explicitly invokes `$prepare-content-research`, and `policy.allow_implicit_invocation` is `false`; do not treat `quick_validate.py` as proof of these interface fields.
- `git diff --check`.
- Proportional lint/typecheck commands selected from the actual implementation diff.

### Manual/operator checks

- Invoke only `$prepare-content-research` with no topic and verify compact clarification rather than premature searching.
- Invoke it with the full shampoo brief and verify no repeated questions.
- Confirm the returned Markdown matches `package.json` claims and source separation.
- Confirm the final handoff contains no script, voice, hooks, CTA, scene, or video-generation material.
- Confirm a save failure still returns the full research and identifies the unsaved state.
- Confirm the same slug never overwrites an older package.

### Evidence-sensitive review

- Inspect one repo-only and one externally escalated fixture claim by claim.
- Verify external sources directly support their attributed claims and that citations are near the relevant statements.
- Verify scientific uncertainty and medically adjacent boundaries are conservative.
- Verify migration, archive, legacy, and plan documents never become primary content authority.

### Live-state and migration checks

None. This task must not query or mutate production data, run migrations, or publish content. Named-product forward tests use sanitized fixtures or read-only grounded context only.

## Review and handoff

- Worktree: `.worktrees/prepare-content-research-plan`
- Planning branch: `codex/prepare-content-research-plan`
- Implementation should start from a fresh task worktree based on current `origin/main`, carrying the approved plan and planning artifact forward.
- Plan review: one read-only sub-agent ran the required high-effort Claude counterpart lane, checked its findings against the repo, and returned `approve with revisions`; the accepted findings are reconciled below.
- Evidence review: confirmed on 2026-08-04 after Nick reviewed the rendered operator-journey artifact.
- User-journey sign-off: confirmed on 2026-08-04 through Nick's explicit implementation request after the reviewed plan and rendered journey handoff.
- Publication stop: implementation may stop at a review-ready local branch unless Nick later authorizes `ship-it`. No merge, deployment, content generation, or production write is implied.

Artifact disposition:

- plan and journey artifact: commit with the eventual skill PR;
- transient counterpart report: discard after findings are reconciled unless Nick asks to retain it;
- test-generated research packages: discard;
- sanitized fixtures with lasting regression value: commit.

## Review findings ledger

| ID  | Type     | Evidence                                                                                                                        | Decision           | Plan change                                                                                    | Revalidation                                          |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| F1  | defect   | `src/lib/agent-v2/guidance/package-index.ts` includes `topic.night_protection.v1`, while the first draft tested categories only | accepted           | Task 2 and verification now require an explicit routing decision for every category and topic  | package-index coverage test                           |
| F2  | defect   | `quick_validate.py` validates `SKILL.md` frontmatter but does not inspect `agents/openai.yaml`                                  | accepted           | Task 1/verification now require direct interface metadata assertions                           | targeted skill test plus manual invocation smoke      |
| F3  | tradeoff | Typed JSON, schema, validator, and Markdown rendering add surface area beyond a Markdown-only v1                                | accepted direction | Keep the typed package because traceability and downstream machine handoff are explicit goals  | validator fixtures and dual-output consistency checks |
| F4  | defect   | The first draft prohibited root-main writes without specifying the normal safe path                                             | accepted           | Designed journey and Task 5 now name the exact task-worktree command, reuse rule, and fallback | protected-root persistence fixture                    |
| F5  | defect   | The first draft named the test file but not the repo preload command                                                            | accepted           | Verification now pins the focused Node/tsx command                                             | run exact command during implementation               |
| F6  | defect   | Runtime package rows said `commit` while also excluding those files from the initial implementation                             | accepted           | Target map now classifies them as later runtime outputs                                        | plan inspection                                       |
| F7  | tradeoff | `$hair-care-expert` browses by default once invoked                                                                             | accepted           | Task 3 now makes the repo-gap decision an ordering invariant before invoking it                | repo-complete and repo-gap forward tests              |

Rejected counterpart claims:

- The AgentV2 package index is not missing; `src/lib/agent-v2/guidance/package-index.ts` is the current index.
- Explicit-only invocation is not unprecedented; the repo's `bug` and `wayfinder` skills already set `policy.allow_implicit_invocation: false`.

Transient review output is intentionally not retained in the repository. The sub-agent's verified ledger above is the durable review record.

## Open risks

- The repo guidance is strong but not a complete scientific evidence corpus; the gap test must not become either reflexive browsing or repo-only complacency.
- Current product/formula facts are freshness-sensitive and may require market/version identity beyond static repo files.
- A Markdown/JSON dual output can drift unless both are generated from one structured package.
- Saved packages create traceability, not improvement by themselves; the first-ten audit must be an explicit later review.
- Requiring a verifier adds latency, but it protects the central source-faithfulness promise and is justified for publish-bound research.
- Skill invocation and bundled-resource discovery can differ across Codex surfaces; forward testing must use the same repo-pointed workflow expected for the co-founder.
