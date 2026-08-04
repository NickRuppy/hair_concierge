# Prepare Content Research Source Policy

Policy version: `prepare-content-research-source-policy.v1`

Use this policy with `source-manifest.json`. The manifest chooses repository sources; this policy decides source authority, gap escalation, claim labels, verification, and persistence behavior.

## Source authority

Use these source tiers in order:

1. Repository guidance: current `data/agent-v2/guidance/**` package Markdown and paired JSON selected through the manifest.
2. Repository runtime: exact runtime or test files selected through the manifest only for current Chaarlie behavior claims.
3. Repository product data: exact catalog, identity, and normalization files selected through the manifest only for named-product or internal product-fact claims.
4. External scientific, regulatory, professional, expert, or current product sources: use only after recording a material repository gap.
5. Synthesis: a clearly labeled inference across cited sources.
6. Unsupported: a useful claim or question that the sources do not support.

Do not treat older guidance, migration notes, plans, archived docs, or broad code search as primary source authority.

## Claim types and routing

- Category education: load the selected category package plus the manifest's `answer_quality_and_advisor_boundaries` and `general_category_education` base groups; add the safety group only when the topic requires it.
- Product choice principles without named products: add `base.product_recommendation.v1`; do not load product catalog files unless concrete product facts are needed.
- Routine or usage guidance: add `base.routine_building.v1`; load exact runtime and tests from `conditional_sources.runtime_behavior_claims` only for claims about current Chaarlie behavior.
- Named product or formula identity: add `conditional_sources.named_product_claims`, require exact product identity/version evidence, and use external current product sources when static repo data is stale or incomplete.
- Ingredient or scientific shortcut: first test repo support; if material evidence is missing, invoke `$hair-care-expert`.
- Medically adjacent scalp, shedding, irritation, dandruff, allergy, pregnancy, medication, or diagnosis/treatment topics: load `base.safety_boundaries.v1`, keep cosmetic and medical boundaries separate, and invoke `$hair-care-expert` when making evidence-sensitive statements.
- Safety precedence: when persistent symptoms, diagnosis, or treatment language appears, the safety route outranks product-choice routing. Do not select products or lead with `base.product_recommendation.v1`; first reframe the scope to non-diagnostic education and evidence-backed categories or escalation boundaries. Add product-choice guidance later only when a safely framed product comparison is explicitly required.
- Category boundary or comparison: add only the adjacent category packages needed for the comparison.

## External research gate

Before external research, write a concrete gap record:

```text
material_gap:
  gap_id:
  unsupported_question:
  repo_sources_checked: [repository source IDs]
  why_repo_is_insufficient:
  required_external_source_type:
  status: unresolved | resolved | blocked
  external_source_refs: [external source IDs]
```

Only after this record exists may the agent invoke `$hair-care-expert`. Prefer primary scientific, regulatory, professional, exact current-product, and authoritative expert sources. Label external evidence separately and record access dates. Do not browse merely to strengthen already supported repository guidance.

If the required external evidence lane is unavailable or fails, do not improvise. Keep the material question in `open_gaps`, place the unsafe positive formulation in `do_not_claim`, and mark the affected claim `unsupported` with `verification_status: blocked` or `rejected`. Use package/verification status `partial` when other supported findings still answer part of the scope, and `blocked` when no useful supported answer remains. A valid partial or blocked package may still be persisted for traceability; an invalid package must not be persisted.

## Provenance labels

Use only these `source_type` values:

- `repository_guidance`
- `repository_runtime`
- `repository_product_data`
- `external_scientific`
- `external_regulatory`
- `external_expert_guidance`
- `current_product_source`
- `synthesis`
- `unsupported`

Use only these `support_level` values:

- `direct`: a cited source directly states the claim.
- `supported_synthesis`: the claim is a conservative synthesis across cited sources.
- `uncertain`: evidence exists but is limited, conditional, or freshness-sensitive.
- `conflicted`: credible sources or repo/runtime surfaces disagree.
- `unsupported`: no adequate support; do not use as a finding.

## Conflict and safety rules

- Preserve conflicts instead of forcing consensus.
- Downgrade confidence when evidence is mixed, indirect, or product freshness is uncertain.
- Never infer current formula, claims, price, availability, or suitability from product name alone.
- Do not present weak evidence as a hard rule.
- Keep cosmetic advice separate from diagnosis, treatment, or disease-management language.
- Exclude unsupported claims from prioritized findings.

## Verification pass

Run a fresh read-only verification before saving. Prefer a context-isolated sub-agent. Give it only:

- raw request and intake answers;
- selected source packet;
- structured package;
- draft Markdown rendered from that package;
- this policy and output contract.

Ask the verifier to check source entailment, provenance labels, unsupported claims, conflict handling, safety boundaries, and whether the Markdown matches the JSON facts. Repair supported findings once. If a blocker remains, return `verification.status: blocked` or `partial` and name the claims.

## Persistence

Before writing `content-research/**`, run branch/worktree safety. If the current checkout is protected root `main`, create a task worktree with:

```bash
npm run worktree:new -- content-research-<date>-<slug>
```

Write `research.md` and `package.json` under `content-research/<date>-<slug>/`. Never overwrite an existing completed package. Do not stage, commit, push, publish, mutate production systems, or trigger video/content generation unless separately authorized.

If the caller explicitly requests a read-only/no-persistence run, or safe persistence is unavailable, return the full research and include:

```json
{
  "persistence_skipped": {
    "reason": "...",
    "intended_path": "content-research/<date>-<slug>/"
  }
}
```
