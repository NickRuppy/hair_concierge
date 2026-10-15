# Chat Oil: select by formula weight and supported use

## Outcome and authority

Chat currently uses manually curated subtype/purpose tags as proxies for Oil weight and supported application. This change selects from `product_oil_specs.weight` and `role_support`, using the existing [Oil decision](../../docs/personal-plan/categories/oil/decision.md) and [canonical fit model](../../docs/personal-plan/fit-verdict-model.md).

Implementation request: “Okay let's align chat with the actual oil weight and supported uses then. Keep matching tags manual, use subagents, and only come back if there's a critical decision.”

Publication request: “Okay good, let's prepare the draft PR then. Use subagents and only come back if there's a critical decision.”

Publish only this Chat alignment on `codex/chat-oil-facts`, based on `9fc02a26285ad172c9c21556a0dac8419bc45257`. The earlier Oil research/Intake/Lab work remains intact in `.worktrees/oil-review-lab` and is outside this PR. Transfer tracked changes as a patch, preserving main's newer Bondbuilder ordering and Leave-in tests; transfer the new shared weight helper and selector-loading test explicitly.

## Final behavior and boundaries

- Consume canonical Oil weight and fibre-role support. Keep matching tags manually maintained; do not write or generate catalog facts, matching rows, protocols or research records.
- Preserve existing Chat purpose inference: `pre_wash_oiling` maps to `pre_wash_fibre_treatment`; both finish purposes map to `dry_finish`. No new damp-conditioning or scalp-selection intent is introduced.
- Share Personal Plan's scalar and accepted-set weight targets through `getOilLeaveOnWeightTargets(thickness, loadSensitive)`. Normal retained targets are fine `[light]`, normal `[light, medium]`, coarse `[medium, rich]`. Load sensitivity narrows normal to `[light]` and coarse to `[medium]`; fine stays `[light]`.
- Chat load sensitivity is existing daily-oil care-balance pressure, overload risk, or `low_volume_or_weighed_down`. Density/texture alone does not narrow weight targets. Preserve an explicit light request separately as `oilWeightRequest`/`weightRequest`, since legacy purpose inference can still label “leichtes Öl als Finish” as `styling_finish`.
- Reuse `evaluateFit` for role support plus diameter and retained-use weight. Pre-wash omits the weight axis. Zero distance is ideal, one step supportive, two or more mismatch. Missing facts remain unverified. Only ideal/supportive candidates qualify; legacy tags and included/preserved IDs cannot rescue unsupported use or missing facts.
- `products.suitable_thicknesses` remains the independent diameter fact. Empty/null is unknown. Read and page joined canonical spec/product rows before ranking so legacy purpose/subtype windows cannot hide qualifying products.
- A canonical-spec read failure returns no Oil recommendation, matching the existing Leave-in dependency-error pattern. An unverified tag fallback would undo the requested alignment.
- Rank fit bucket first, then existing deterministic relevance/price/catalog ordering; retain budget ordering before the final cut and owned-assessment eligibility. Personal Plan target outputs remain unchanged.
- Project actual weight, all supported fibre roles and the selected role into Chat claims/reasons. Legacy request purpose remains category-decision evidence; it is not a formula subtype fact. Pre-wash guidance stays on lengths/ends. Weight may be displayed as a true formula fact for pre-wash while remaining neutral in its fit.
- No new UI/onboarding question, schema/migration, research-method pin, intake worker activation, persistence/UV/heat/ingredient-flag ranking or production write.

## Decision coverage — confirmed

**Confirmed with Nick:** formula weight/use alignment, manual matching tags, subagents, and now commit/push/draft-PR publication of the reviewed alignment.

**Inherited from contract:** canonical Oil role/weight matrix, pre-wash weight neutrality, degree-based thickness, unverified missing facts, existing budget/owned selection boundaries.

**Implementation defaults:** pure shared helper and evaluator reuse; retain purpose inference while recording explicit light preference independently; spec dependency failures cannot assert unverified product facts. No additional consequential choice is needed for this publication.

**Open consequential assumptions:** none. Additional Oil research/Lab changes and new selection axes/intents are outside this publication scope.

**Coverage acknowledgement:** the two original user requests quoted above cover implementation and publication respectively. Merge, production deployment, migrations and catalog publication remain separately authorized.

**Internal revalidation:** the source handoff fingerprint matched before transfer. A fresh worktree isolates the 12 code/test paths plus this plan and its receipt; subagents checked dependencies and current-main overlap. Current-main behavior outside the Oil changes is preserved. Undiscussed consequential assumptions affecting this handoff: none.

## Existing journey

A user asks for pre-wash Oil or a finish with diameter known. The existing tool/response path selects products with the required supported role and grades retained formula weight. Conditional fits carry the evaluator's caveat. Missing/unsupported facts use the existing empty-candidate recovery. No new screen, user decision or timing change requires a new mockup; inspect the actual selector-to-projection output.

## Implementation and verification

1. **Shared targets:** `src/lib/oil/weight.ts` and the Personal Plan Oil category preserve both scalar and accepted-set outputs. Existing Personal Plan Oil category and fit fixtures remain green.
2. **Chat matching:** Oil constants/types, request context/category target and `selection.ts` consume canonical facts and preserve budget/owned behavior. Metadata and `select-products.ts` expose researched facts instead of subtype proxies.
3. **Owner-boundary tests:** replace obsolete tag-authority cases in `tests/recommendation-engine-selection.test.ts`; use `tests/chat-oil-spec-selection.test.ts` for real Supabase-client HTTP acquisition, pagination, failure and null-thickness handling; use `tests/agent-select-products-tool.spec.ts` for factual Chat projection. No test-only production seam is added.
4. **Fresh-base proof:** run the focused owner/sibling suite, scoped source lint and TypeScript sequentially through the shared verification launcher. Review the complete isolated diff with Claude and the correctness/structural router before commit/push.

The source handoff recorded 465 passing owner/sibling tests, 62 final affected tests, TypeScript/source-lint passes, and meaningful old-behavior failures. It also verified the live catalog read-only: all 39 active recommended Oils had canonical spec/weight/role/thickness facts; six diameter/use selector-to-projection cases passed, with ideal finish results. These are dated checks, not production activation. The [publication receipt](chat-oil-facts-alignment-2026-10-15-verification.json) distinguishes reused source proof from fresh-base commands and review.

Full hosted CI remains required before merge. Live LLM Chat evaluation is not part of this bounded publication: it creates remote QA users/profiles; deterministic integration and read-only live selector evidence cover the changed path without those writes.

## Artifacts and authorized stop

Commit the 12 implementation/test paths, this plan and the publication receipt. Preserve all earlier research/Lab artifacts in the original worktree. Discard transient patch/reviewer output after recording its hash and verdict outside the committed code. Stop after pushing and creating/attaching the draft PR; do not merge, deploy, apply migrations or publish catalog records.
