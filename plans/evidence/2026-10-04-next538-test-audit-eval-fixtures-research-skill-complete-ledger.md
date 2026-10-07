# Eval fixtures and content-research workflow — independent bounded ledger

**Scope.** `tests/eval-chat-fixtures.test.ts` (2 AST test declarations) and `tests/prepare-content-research-skill.test.ts` (6), plus complete callback fixtures, `scripts/eval-chat/{fixtures,run,assertions,types}.ts`, `scripts/langfuse/seed-datasets.ts`, `.agents/skills/prepare-content-research/{SKILL.md,agents/openai.yaml,assets/research-package.schema.json,references/source-manifest.json,scripts/validate-research-package.mjs}`, the AgentV2 package index/compiler, package/CI/docs and targeted history. I first read the earlier whole eval operator ledger and static ledger; their relevant hashes remain current. This is a fresh second-pass assessment, not an acceptance of their R marks.

## Current ownership and closure

- Eval fixtures are live inputs: `scripts/eval-chat/run.ts:27,123-206,327-331,357-420` selects `SCENARIOS` for normal, CI-smoke and named runs, seeds a fresh profile/inventory, sends every turn, records deterministic assertions, retries hard CI failures, and can publish the same selected set. `scripts/langfuse/seed-datasets.ts:2,39-68` imports every scenario and turns every turn into a curated dataset record including prior-turn context and assertion metadata. `package.json:46-48,75` exposes normal/judge/Langfuse/CI runs; `.github/workflows/ci.yml:395` executes CI-smoke against the started application.
- Content research is an explicitly supported operator workflow, rather than an app route: `.agents/skills/prepare-content-research/SKILL.md:21,63` requires an explicit invocation and calls the validator before persistence. The validator enforces package/provenance semantics (`validate-research-package.mjs:134-543`), safe no-overwrite path handling (`:550-595`), and nonzero CLI failure (`:601-631`). Its manifest must match the live AgentV2 package registry, whose compiler reads the paths and rejects ID/metadata mismatches (`src/lib/agent-v2/guidance/compiler.ts:8-44`). `74830155` introduced the workflow, package, validator and focused suite together; its commit message records the provenance, evidence-gap, medical-boundary and containment intent.

## Exact declaration ledger

| site | mark | full observable contract and retention evidence |
|---|:---:|---|
| `eval-chat-fixtures.test.ts:6` | R | The test protects the exact two-turn `leave-in-offer-confirmation` CI scenario: its smoke selector, visible follow-up prompt, minimum product count, application keyword, and no-generic-clarification negative. The runner executes both turns and CI consumes the `ci_smoke` bit. No direct agent unit keeper exercises the same persisted conversation/SSE sequence. |
| `eval-chat-fixtures.test.ts:23` | R | The set assertion protects five distinct multi-turn scenario IDs: OWC context, offer confirmation, routine summary, explicit branch selection and clarification cap. Each supplies different turn history and expected response behavior to the runner and dataset seeder. A single two-turn smoke case cannot absorb that union. |
| `prepare-content-research-skill.test.ts:26` | R | Reads the skill metadata/interface to prove explicit-only invocation and research-only scope. This is an operational authorization boundary: a generic validator cannot prove metadata discovery, and the user-facing skill can otherwise become implicitly runnable. |
| `prepare-content-research-skill.test.ts:37` | R | Cross-checks every manifest route against `AGENT_V2_GUIDANCE_PACKAGE_IDS`, exact on-disk Markdown/metadata paths, wild-card exclusions and conditional-source paths. The runtime compiler only observes requested IDs; this test catches an omitted/extra registry-to-manifest mapping before a content-research operator uses it. |
| `prepare-content-research-skill.test.ts:105` | R | The schema inventory is a contract to the package validator and downstream persistent research record: required provenance/claim/verification fields, allowed source types, and repository version binding. It is not a private identifier replay, and no runtime call checks schema and semantic-validator parity together. |
| `prepare-content-research-skill.test.ts:175` | R | Exercises valid and malformed packages through the actual validator: missing citations, duplicate IDs, unsupported-as-approved, verification blockers, unknown references, external-evidence material-gap gating, strict unknown properties, impossible dates, and completion state. This is the core fail-closed safety/provenance behavior. Each fixture changes an independent validator predicate; no candidate has full assertion union elsewhere. |
| `prepare-content-research-skill.test.ts:340` | R | The collision, outside-root, filesystem-root and symlink component cases test `validateOutputPath` with actual temporary filesystem behavior. These prevent a workflow from overwriting or escaping its designated research folder; the package-content validator cannot substitute for it. |
| `prepare-content-research-skill.test.ts:371` | R | Exercises the actual CLI with a valid file, valid stdin, and invalid file to retain process status plus actionable output. Direct function tests do not establish CLI argument/stdin/exit behavior needed by the explicit skill command. |

## C/D/F decision

**R8 / F0 / C0 / D0.** No whole callback has an existing keeper with the same operative input and complete assertion union. In particular, the 2-vs-5 fixture tests do not duplicate each other: the former protects selected CI conversation behavior, the latter preserves the multi-turn coverage set that also drives curated Langfuse records. The content-workflow tests combine static interfaces with executed validator/CLI/filesystem contracts; their source reads are the only reasonable check for an operator-facing skill manifest and declaration parity.

No source/test cleanup, transfer or fault recipe is justified. The earlier request-interpretation fixture withdrawal is respected: it is outside this scope and was not reconsidered.

## Current hashes and history

- `e9b7be0e3708a4cda95a85307920990080b7b1f1feb75a62d36c614fe71d8d3f` — eval fixture test
- `a97850d268a9638437d50d7dd0b6b7072b66cdc4833135d93eb336e425152edd` — eval fixtures owner
- `79bd19cd1900ef67332012176fc7f6721991a8b0d8775d7e5c1315e8d6395715` — eval runner
- `d2af5c4c35221094c12f1fd7313dcb92217a703cc0294362d7a65fa925663348` — research workflow test
- `46d841a071a7bdf5237cffb0de7f269bdef59f01579eaaf5077b615ca83b304e` — validator
- `bd8dd4751e9899721f7590b0860781bf10a00391117f4aa188dc6073986d52e9` — live guidance package index

Relevant history: `4a79d1cc` introduced the eval harness; `7ab3f88a` introduced the Langfuse quality loop; `cc8a86f8` hardened CI; `74830155` added the explicit verified-content workflow and all six focused contracts.

## Limits

No test, app, CLI, provider, Langfuse, database, environment or filesystem-mutating operator command was run. CI/package/docs references establish current repository reachability, not a claim that an external evaluation or content-research run was performed. Focused commands if these owners change: `node --import ./tests/server-only-register.cjs --import tsx --test tests/eval-chat-fixtures.test.ts tests/prepare-content-research-skill.test.ts`; the eval runner itself requires configured services and was intentionally not invoked.
