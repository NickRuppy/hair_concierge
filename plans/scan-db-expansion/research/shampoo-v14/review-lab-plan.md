# Shampoo v1.4 pilot review Lab

Status: implemented and locally verified; awaiting Nick's product decisions

## Outcome and source context

Expose the five completed Shampoo v1.4 pilot products in the familiar local Shampoo Research Lab so Nick can review the actual formula packets, adjudicated classifications, independent-lane disagreements, and Production Light projections in one interface.

Sources:

- The reviewed pilot artifacts live under `plans/scan-db-expansion/research/shampoo-v14/pilot/`.
- The historical interface reference is the development-only `/labs/shampoo-research` Lab in the preserved `codex/shampoo-inci-research-engine` worktree.
- Shampoo Production Light remains a research-only projection. Lab approval is not Product Intake approval, catalog readiness, database apply, recommendation activation, or publication.

## Chosen direction

Reuse the historical Lab's visual hierarchy and operator language, but build a narrow current-worktree adapter over the v1.4 pilot files. Do not translate the pilot back into the historical v1.3 `formula-source.json` and `analysis.json` contracts, and do not import the historical cohort, persistence tables, migrations, or fit engine.

The Lab will read each product's frozen files directly:

- `source-packet.json` for exact identity, canonical INCI, sources, claims, directions, and source-conflict resolution;
- `comparison.json` for Lane A/B exact agreement and per-lane confidence;
- `adjudication.json` for the eight final classifications, formula facts, rationales, counter-signals, neighboring alternatives, and adjudication outcomes;
- `focus-v15.json` for the effective formula-led focus, v1.4 prior-value join, repair/moisture support verdict, claim role, limitations, and decision trace;
- `adapter-artifacts-run-1/production-light.json` for the exact projected production rows, thickness eligibility, protocol roles, warnings, and field rationales.

Review decisions will be stored only in `pilot/review-state.json`, bound to the exact SHA-256 of those source files, the adapter determinism receipt, and the v1.5 focus overlay. A changed input invalidates the corresponding approval and archives the previous decision set. This full integrity layer is intentionally retained because the remaining 47 products are expected to reuse the same review surface; it is not trimmed to a one-shot five-product recorder.

## Scope and non-goals

In scope:

- development-only `/labs/shampoo-research` route in the `db-expansion-scan` worktree;
- five-product queue and detail review;
- formula/source approval or rework;
- per-property approval or rework for all eight v1.4 properties;
- formula-led v1.5 focus values inside the existing primary/secondary focus approval scopes;
- visible Lane A/B comparison and adjudication rationale;
- Production Light projection approval or rework;
- whole-product approval only after all review gates pass;
- atomic, hash-bound local JSON persistence;
- focused automated and browser verification.

Non-goals:

- no Supabase client, migration, database row, storage upload, catalog apply, or recommendation activation;
- no change to the v1.4 research method, five adjudications, Production Light adapter, or remaining 47 products;
- no reuse of the historical v1.3 cohort or database persistence layer;
- no image review in this formula-classification Lab;
- no commit, push, PR, merge, or deployment in this run.

## Target map

- `src/lib/labs/shampoo-v14-pilot-review.ts` — strict artifact schemas, loader, hashes, derived review readiness, and atomic review-state persistence.
- `src/app/labs/shampoo-research/page.tsx` — development-only server entry and initial five-product queue.
- `src/app/labs/shampoo-research/shampoo-v14-pilot-client.tsx` — familiar queue/detail interface, formula/source section, eight properties, Lane comparison, and projection review.
- `src/app/api/labs/shampoo-research/review/route.ts` — local review actions only; fail closed outside development and on stale hashes.
- `tests/shampoo-v14-pilot-review.test.ts` — loader, integrity, stale-decision invalidation, rework, and approval gates.
- `tests/shampoo-v14-pilot-review-api.test.ts` — API validation and disabled-environment behavior.
- `tests/shampoo-v14-pilot-review-ui.test.tsx` — render the five-product queue and critical review evidence.
- `plans/scan-db-expansion/research/shampoo-v14/pilot/review-state.json` — created only by Nick's Lab actions; local research decision record, never a publish instruction.

## Designed user journey

Actor and entry: Nick opens the local development Lab at `/labs/shampoo-research`. The page shows exactly the five validated pilot products and a prominent `Nur Entwicklung · keine Katalogfreigabe` boundary.

1. Nick selects a product from the queue.
2. The Lab first shows exact identity, GTIN, pack size, canonical INCI fingerprint, formula source, source comparison, and any resolved conflict. Nick can approve the formula packet or request formula rework with a comment.
3. The Lab first shows the formula-led Focus v1.5 overlay: effective and prior v1.4 values, repair/moisture formula-support verdict, ingredient routes, shared routes, claim role, limitation, counter-signal, and decision trace. It then shows the eight final working classifications in a compact table. Non-focus values still come from v1.4 adjudication; focus values come from the overlay, while Lane A/B remain visible as historical v1.4 evidence. Nick approves or requests rework through the existing primary/secondary focus scopes. Empty secondary-focus arrays render as `Kein sekundärer Fokus` rather than an empty cell.
4. The Lab shows the exact Production Light result: emitted Shampoo rows, suitable and conditional thicknesses, required protocol roles, warnings, and relevant field rationales. Nick can approve the projection or request rework.
5. `Gesamtes Pilotprodukt freigeben` becomes available only when the formula packet, all eight properties, and the projection are approved and no rework request remains.
6. Every click persists atomically to `pilot/review-state.json`. Refreshing the page restores the decisions. If an underlying source, adjudication, or projection changes, the old approval is visibly archived and the changed scope returns to review.
7. Completion is a local `approved` status for that exact research artifact set. The UI explicitly states that this neither applies nor publishes anything.

Error and recovery states:

- missing, malformed, mismatched, or non-ready artifact: only that product is blocked with the exact file/error; the other products remain reviewable;
- stale browser request after an artifact changes: API returns a conflict and the client reloads the current item;
- rework requested: the comment remains visible and prevents whole-product approval until the scope is approved again;
- persistence failure: no optimistic approval is retained and the Lab shows the error.

Meaningful variant: Elvital shows its resolved same-GTIN manufacturer-versus-dm formula conflict prominently from `formula.version_or_reformulation_conflicts` and `identity.explicit_conflicts`, but the resolved status does not create an artificial hard blocker.

Journey sign-off: **confirmed 2026-09-03**. Nick reviewed the existing Lab in the linked work session, asked to reuse that interface for this set, and explicitly said, “Yeah that. Please use this so I can review those in that set as well within that interface.”

## Planning evidence

The existing interactive Shampoo Research Lab is the approved visual and interaction reference. Nick previously operated it at `/labs/shampoo-research`; its queue, product-audit, source-comparison, classification table, property approval, rework, and whole-product approval states are retained. The current request explicitly selects that existing surface rather than a new visual variant.

Evidence-review status: **confirmed 2026-09-03**.

Selected adaptation:

- retain the existing queue/detail hierarchy and German operator copy;
- replace historical v1.3 artifact assumptions with the pilot adapter;
- add resolved Lane A/B corrections and Production Light sections because they are material new evidence;
- add the separately versioned Focus v1.5 evidence panel while preserving v1.4 lane history;
- keep the second area focused on the exact Production Light projection rather than importing the historical anonymous-profile replay engine.

## Ordered tasks

### 1. Strict pilot adapter and local review state

Consumes: the five product paths in `pilot-manifest.json` and the four source files named under Chosen direction.

Produces: a validated `ShampooV14PilotReviewItem` for every product plus atomic hash-bound review-state transitions.

Implementation:

- validate exact artifact versions, product IDs, ready status, adapter determinism, and agreement between adjudication, comparison, source formula fingerprint, and Production Light summary;
- reuse the exported `ShampooProductionLightOutcome` TypeScript contract and version constant while validating the frozen JSON at the Lab boundary; never call the projection function from the UI;
- preserve a product-local diagnostic instead of failing the entire queue;
- expose stable UI view models without rewriting research artifacts;
- accept only formula, named-property, projection, rework, and whole-product actions;
- refuse stale expected hashes and refuse whole-product approval until all scopes pass.

Completion criterion: focused tests fail before the adapter exists, then pass for the five real pilot products plus malformed/stale/rework fixtures.

### 2. Development-only Lab route and review API

Consumes: the pilot review adapter.

Produces: server-rendered initial queue plus a local POST review action.

Implementation:

- return 404 outside development;
- expose no publish action and import no Supabase modules;
- refresh the exact item and summary after accepted decisions;
- return structured 400, 404, 409, and 500 responses for invalid, missing, stale/blocked, and persistence-failure states.

Completion criterion: API tests prove environment gating, schema validation, stale-hash refusal, and a successful local decision against an isolated temporary review-state file.

### 3. Familiar review interface with pilot evidence

Consumes: queue items and review API responses.

Produces: German review UI matching the historical Lab hierarchy.

Implementation:

- queue cards show review status, resolved `product_correction` counts, and next action;
- detail shows formula/source evidence first, then classifications, then projection;
- focus detail shows the v1.5 formula-support verdict, routes, claims' bounded role, limitations, and the prior v1.4 value;
- disagreements and adjudications are visible without opening raw JSON;
- review/rework actions require the currently displayed hashes;
- whole-product approval remains disabled until every scope passes;
- boundary copy makes local research approval unmistakable.

Completion criterion: static-render component tests assert the five-product queue, Elvital conflict, at least one resolved `product_correction`, empty secondary-focus rendering, exact Production Light row values, and absence of publish/apply actions. Interactive state behavior is covered by adapter/API tests and the browser pass rather than an unavailable interactive component-test harness.

### 4. Full verification and browser handoff

Consumes: the completed adapter, API, UI, and real pilot artifacts.

Produces: a locally running review surface ready for Nick.

Implementation:

- run focused tests through the repository's server-only registration shim, then `npm run ci:verify`, pilot validation, and `git diff --check`;
- launch the worktree development server;
- inspect desktop and narrow layouts;
- exercise one reversible isolated review action using a temporary state path, then launch the real state path without making a decision for Nick;
- open the Lab in Codex.

Completion criterion: all checks pass, all five products render, no database/network write path exists, and Nick can begin with the first formula review.

## Verification

Automated:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/shampoo-v14-pilot-review.test.ts tests/shampoo-v14-pilot-review-api.test.ts tests/shampoo-v14-pilot-review-ui.test.tsx`;
- UI tests use `renderToStaticMarkup`; state transitions remain adapter/API/browser assertions;
- `npm run ci:verify` for typecheck, lint, and production build;
- `node plans/scan-db-expansion/research/shampoo-v14/tools/validate-pilot.mjs --phase complete`;
- `git diff --check`.

Manual/browser:

- queue contains exactly five products;
- each product shows complete INCI, eight properties, lane comparison, and Production Light projection;
- Elvital renders `moisture`; Syoss renders `repair_supported`; ISANA Sensitiv no longer renders `gentle` as the effective focus; ISANA 2in1 proves that a protein token does not force repair;
- Elvital conflict is visible and resolved;
- rework comment blocks whole-product approval;
- refresh restores decisions;
- narrow viewport remains usable;
- no publish, upload, apply, or production control appears.

Evidence-sensitive review:

- the UI is a faithful view over frozen artifacts; it must not recalculate or reinterpret classifications;
- displayed exact production rows must byte/field match `production-light.json`;
- the review-state hashes must match the exact current inputs.

## Review and handoff

- Worktree/branch: `.worktrees/db-expansion-scan`, `codex/db-expansion-scan`.
- Planning evidence and journey sign-off are confirmed.
- Counterpart plan review is required before implementation; findings remain advisory and are verified locally.
- Counterpart review accepted the real-vocabulary, test-runner, build, conflict-field, projection-contract, empty-value, and determinism clarifications. Its suggestion to remove hash-bound archival was rejected because this surface is intended to scale to the remaining 47 products, making stale-decision invalidation part of the approved outcome rather than one-shot overhead.
- `implementation-loop` owns execution, `ready-check`, and final repository review.
- Task-owned code/tests/plan: retain for review; temporary counterpart output and temporary review-state fixtures: discard; Nick-created real `pilot/review-state.json`: retain as research evidence.
- Stop after opening the verified local Lab. No commit, push, PR, merge, deployment, Supabase write, catalog apply, or remaining-wave research.
