# Task 1 receipt — Hair Tools engine copy (2026-10-09)

SOURCE `personal-plan-hair-tools-current-shape` @ d698e5bf (diff base b540d2ca) -> TARGET `hair-tools-port` (origin/main 404db24f). Copied with `cpio -pdm` (mtime preserved); `cmp` confirmed copied `tools/*.ts` byte-identical.

## Files copied (byte-identical)

| Group | Count |
| --- | --- |
| `src/lib/personal-plan/tools/**` (analytics, application, assets, contracts, facts, labels, presentation, routes, stage2; `decode-stored.ts` skipped) | 9 |
| `src/lib/personal-plan/volume-direction.ts` | 1 |
| `src/components/personal-plan-tools/tool-thumb.tsx` | 1 |
| `docs/personal-plan/categories/tools/*.md` | 8 |
| plans (5 hair-tools plans; `plans/tool-bildkarten.md` NOT copied: exists on main, status M in SOURCE) | 5 |
| `plans/mockups/**` (all A in diff) | 32 |
| `public/images/personal-plan/tools/**` | 53 |
| `public/images/tools/*.webp` missing on main | 32 |
| `scripts/generate-tool-placeholder-illustrations.mjs`, `scripts/postprocess-tool-images.mjs` | 2 |
| tests: assets, routes, fixtures, contract-ws1, volume-direction, `personal-plan/tools-contracts` | 6 |
| **Total copied** | **149** |

`.gitignore`: 8 lines SOURCE added (5 `!plans/mockups/...` allow-list rules + 3 comment lines) appended; nothing removed.

`tests/personal-plan-tools.test.ts` was NOT kept: it imports `PERSONAL_PLAN_TOOLS_ROLLOUT_VALUES`, `canAccessPersonalPlanTools`, `resolvePersonalPlanToolsRollout` from `release.ts` (absent on main). Moves to Task 3 (restore verbatim from SOURCE together with the resolver).

## Non-copy edits

1. `src/lib/analytics/events.ts` — added to `AppEventMap`, before `personal_plan_stage3_review_viewed`: `personal_plan_tools_inventory_entered { sectionCount }` and `personal_plan_tools_inventory_completed { reportedFamilyCount, explicitNoneFamilyCount }` (exact SOURCE hunk, type-only). Reason: copied `tools/analytics.ts` indexes `AppEventMap` with these names. NOT added (later UI tasks): `personal_plan_tools_checkpoint_viewed`, `toolRouteCount`/`toolGapCount` on `personal_plan_stage3_handoff`.
2. `src/lib/analytics/routes.ts` — added `personal_plan_tools_inventory_entered` / `_completed` rows `{ customerio: false, meta: false, posthog: true }` (exact SOURCE hunk; `eventRoutes` is `Record<keyof AppEventMap,…>`, required by edit 1).
3. `src/lib/analytics/destinations/posthog.ts` — added the two `case`s in `toPostHogPayload` (`section_count`; `reported_family_count`, `explicit_none_family_count`) (exact SOURCE hunk; the switch is exhaustive over `AppEventName`, required by edit 1).
4. `tests/personal-plan-tools-fixtures.test.ts` — removed the single test `fixture 116 — tools-onboarding-submitted-unchecked` (old lines 2260-2339). Reason: it needs `Stage2QuestionId "tools_overview"`, `answers.toolFamiliesWithSomething`, `answers.toolForms` (Task 4 answer model); typecheck failed (5 errors) and the test failed at runtime. **Task 4 must restore it verbatim from SOURCE** (same file, same position, before the `// --- coverage of the oracle` comment). The oracle-coverage test still passes without it.
5. `tests/personal-plan-tools.test.ts` — deleted after copy (see above).

No renames of types or imports inside the 9 engine files were needed; they are untouched.

## Results

- `npm run typecheck`: green (0 errors) on the final tree.
- Copied node tests (shim command), 6 files: 175 tests, 175 pass, 0 fail (assets 9, routes 32, fixtures 103, contract-ws1 17, volume-direction 3, tools-contracts 11). Before edit 4: 176 tests, 1 fail (fixture 116).
- `npx eslint` on `src/lib/personal-plan/tools`, `volume-direction.ts`, `src/components/personal-plan-tools`, `src/lib/analytics`: clean. `tests/` is eslint-ignored by repo config. `prettier --check` on the edited fixtures test: clean. `npm run lint` overall: 0 errors, 5 pre-existing warnings, none in copied/edited files.

## Deferred

- Task 3: `tests/personal-plan-tools.test.ts` + rollout resolver in `release.ts`.
- Task 4: restore fixture 116; `tools_overview` question id, `toolFamiliesWithSomething` / `toolForms` answer fields, `toolsEnabled` on trigger context.
- Later UI task: `personal_plan_tools_checkpoint_viewed` event, handoff count fields, posthog/routes entries for them.
- Not copied by design: decode-stored files, UI components, labs harness, retired tests, schema-snapshot test.
