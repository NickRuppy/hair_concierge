# Verification receipt — quiz motion after payment

Date: 2026-08-28. Branch: `codex/post-payment-quiz-motion`. Base: `2ae521b50cda5a8de0e43b15119646179beff351`.

Canonical content fingerprint: `23deedd48c75bda39ebf2607afb09bf2ff69f77ac478d31dd46e81c4a963fdee`.

Identity algorithm: sort the union of paths changed against the base and task-owned untracked paths; each manifest line is `path<TAB>SHA256(current bytes)` (or `DELETED`) followed by a newline; SHA-256 the complete UTF-8 manifest. Exclude only this receipt, `review-receipt.md`, and generated `test-results/.last-run.json`. The two receipts are metadata outside their own fingerprint; generated test state is not a deliverable. Staging or committing identical content does not change identity.

## Fresh checks

Runtime: Node 22.23.2. Local fixture server: `http://localhost:3750`.

- `npm run test:node`: **4,828 passed**, zero failures/skips. The final focused `tests/personal-plan-transition-motion.test.tsx` rerun passed **10/10**.
- `npx tsc --noEmit --incremental false`: passed on the final source/test tree.
- `npm run lint`: passed with five existing warnings outside changed files. Scoped source ESLint: zero warnings/errors. Test files are excluded by repository ESLint configuration; TypeScript and Playwright check them.
- `npm run build`: passed. No deployment was performed.
- Prettier for changed source/tests and plan: passed. `git diff --check`: passed.
- Combined browser run covered 33 Chromium and 32 WebKit cases (the CDP-only safe-area test remains Chromium-only): initially 62 passed, three failed. Two failures were test assumptions corrected and rechecked: scope Plan card counts to the current layer, and measure the Feinschliff dock against the actual visual viewport/media query. The affected Chromium cases passed twice each (4/4); the Feinschliff WebKit case passed twice. This gives passing coverage for 64 unique cases. One additional WebKit Plan CTA alignment failure is a confirmed baseline issue, detailed below; the broader run is not described as entirely green.

## Observed behavior

- Chromium and WebKit, 375/390/1280 widths, normal/reduced motion: **12 cases passed**. Forward/back use quiz keyframes and 200/160 ms timing; no horizontal overflow or outgoing focus; exactly one mobile portal action; nested outgoing animations remain disabled. Reduced motion retains no outgoing layer.
- Actual shared Anwendung stage arrival: same entrance inside a stationary clipping boundary; intent is consumed once and does not replay on reload. Actual local Plan → Feinschliff entry: **six browser/width cases passed**. See `evidence/implementation-matrix.json` and `evidence/implementation-local-entry.json`.
- Red-before-fix guards: SSR consumers initially rendered `depth`; the programmatic browser fixture showed a 2,424 px document during overlap versus 1,224 px after cleanup. The final guard checks equal during/settled document height and exact 199/200 ms retention/focus behavior.
- Fresh screenshot inspected: `evidence/implemented-frequency-mobile.png`; only Next.js development chrome is hidden. Historical comparison evidence remains clearly separate from implementation evidence.
- Rapid programmatic forward → reverse at 80 ms was checked in Chromium and WebKit: the previous 200 ms deadline does not clear the latest outgoing layer; final cleanup/focus belongs to the latest view.

## Known baseline WebKit issue

The expanded iPhone WebKit run of the existing Plan acceptance test found its fixed CTA 17 px above a native fixed viewport anchor. A separate detached checkout of the exact base reproduced identical geometry: old `depth` and new `quiz` both had CTA bottom **827**, native fixed anchor/visual viewport/window bottom **844**, and CSS `bottom: 0px`, at 375×844. The reproduction used the actual Plan Lab and fixture preview responses. Only the baseline development bundler root was adjusted to allow shared dependencies; product code was unchanged. The CTA implementation itself is unchanged by this branch. Attempts to replace the assertion with visual-viewport/native-anchor assumptions did not fix it and were discarded; the original strict Plan CTA assertion remains. This existing issue is outside the approved motion change and remains unresolved, not waived as a passing test.

## Execution notes and boundaries

The first dev process served stale depth CSS after source edits; it was restarted under Node 22 and the served quiz selectors verified. An initial cold quiz navigation timeout passed on rerun. An initial broader scratch configuration used the wrong port for two legacy tests and attempted a Chromium CDP-only test in WebKit; the corrected configuration uses the explicit server URL and the repository's iPhone WebKit device, keeping the CDP safe-area test in Chromium. These setup failures are not reported as product passes.

This is local fixture/component/browser proof. Authenticated production access, actual payment providers, webhooks and production data were intentionally not exercised. No auth, billing, recommendation, routing or persistence behavior was changed.

Artifacts: commit the source/tests, plan, selected evidence and archived prototype text. The temporary comparison route was discarded. Scratch browser scripts/configuration, generated test output and raw reviewer output are transient; retain only their concise results here. Root remains clean on `main`; changes are isolated to the task worktree. Stop before commit, push, PR, merge or deploy.
