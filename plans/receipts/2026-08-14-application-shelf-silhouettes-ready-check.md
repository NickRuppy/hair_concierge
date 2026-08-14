# Anwendung shelf silhouettes — ready-check receipt

## Identity

- Branch: `codex/application-shelf-silhouettes`
- Worktree: `.worktrees/application-shelf-silhouettes`
- Base: `origin/main` at `c983d88e56acbd1e48c423f63d44e543b7b92e75`
- Canonical content fingerprint: `e70f84b4b062d4c880cba552b7e5fe64a9bcb150d3c04678b67a6a9d02ba6928`
- Fingerprint scope: approved plan, final mockup evidence, `application-day-card.tsx`, and the focused Stage 5 view-adapter test. Readiness/review receipts are excluded from their own recursive fingerprint.

## Promised outcomes checked

- The ten exact approved category paths replace the previous silhouette geometry.
- Standardized catalog images use the approved per-category image bounds with `xMidYMid meet`; the mask uses the reduced `(14, 72, 92, 102)` bounds.
- Product canvas remains `#f3f0e8`; the shelf surface is now the distinct `#e9e3ed`; the previous warm shelf gradient is absent.
- Confirmed, provisional, open, missing/nonstandard-image fallback, rest-day, link navigation, and link-level accessible summaries remain intact.
- Confirmed, provisional, and open placeholders count as shelf slots. Ordered slots chunk at five per rail, and each generated row owns its own rail and shadow.
- Product/fallback/open slots increase from `h-28 max-w-20` to `h-32 max-w-24` and use zero inter-slot gap without changing compiler or DTO order.
- No runtime background removal, catalog mutation, migration, feature flag, analytics, tracker, chat, or detail-page behavior was added.

## Test-first proof

- Red command: `node --test --import tsx tests/personal-plan-stage5-view-adapter.test.ts`.
- Red result: 8/10 passed. The exact approved shampoo path assertion failed against the old geometry, and the mixed six-open-slot fixture found zero shelf-row hooks instead of two. The failures were behavioral; imports and fixture rendering succeeded.
- Green result on the proposed tree: 10/10 passed. Exact paths, per-category bounds, contained fit, two five-slot rails, mixed open-slot chunking, colors, fallback/state semantics, and accessible summaries are covered.

## Verification

- `node --test --import tsx tests/personal-plan-stage5-view-adapter.test.ts` — 10/10 passed.
- `npm run test:personal-plan-stage5` — 210/210 passed.
- `npm run test:personal-plan` — 1505/1505 passed.
- `npm run typecheck` — passed on the final source tree.
- `npx eslint src/components/application/application-day-card.tsx tests/personal-plan-stage5-view-adapter.test.ts` — zero errors; the repository ignores the test file and emitted one ignore warning.
- `npm run ci:verify` — passed: typecheck, lint with zero errors and five pre-existing warnings outside this diff, and a production build with 127 generated routes.
- `git diff --check` — passed.
- After counterpart review, the geometry test was hardened so image-bound assertions no longer depend on JSX attribute order; the focused test, Stage 5 suite, typecheck, focused lint, and `git diff --check` were rerun on the updated test.
- The commit hook then applied repository-standard formatting to the component without changing behavior; its post-hook bytes define the final fingerprint, and the focused test was rerun before publication.
- The branch was fast-forwarded to the then-current `origin/main` before the final broad gates; the incoming Stage 3 loading change did not overlap task files.

## Browser/manual evidence

- The task worktree development server started successfully at its assigned local port, and the temporary four-state QA route compiled without a framework error before being removed.
- The final reviewed artifact `plans/mockups/2026-08-14-application-shelf-final-signoff.html` remains the visual source for the ten shapes, per-category image placement, shelf/product surfaces, close packing, and two five-item rails.
- Live local browser screenshots were not captured: the mandatory in-app Browser runtime failed to initialize after the documented guarded setup and one clean-kernel retry. No alternate browser backend was substituted.
- Static rendered-markup regressions observe the exact geometry, image fit, surface colors, row count/order, fallback/state hooks, and accessible summaries, but they do not measure physical stroke overlap or clipping in a browser layout engine.

## Artifact disposition and residual risk

- Commit: approved plan, final mockup evidence, production component, focused tests, ready-check receipt, and code-review receipt.
- Discarded: temporary local QA route, development server, temporary manifest, Claude plan-review scratch reports, and failed browser runtime state.
- Archive: none.
- Skipped: authenticated production replay because no deployment is authorized; migration/live database checks because no persistence boundary changed.
- Residual risk: the exact implementation could not receive a fresh browser-layout screenshot in this run. Deterministic markup coverage and the signed-off mockup reduce, but do not eliminate, the risk of a responsive stroke/marker clipping issue. Rollback after a later deployment remains revert plus redeploy, as explicitly accepted at journey sign-off.

## Bottom line

The approved presentation contract is implemented and all available repository gates pass on the identified content fingerprint. The missing local browser-layout capture is a disclosed non-blocking residual for this presentation-only branch; no production or data boundary changed.
