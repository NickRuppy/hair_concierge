# New VSL muted-autoplay — ready-check receipt

## Identity

- Branch: `codex/new-vsl-autoplay-plan`
- Worktree: `.worktrees/new-vsl-autoplay-plan`
- Base: `origin/main` at `641a1522d93ed84ce632a5a1b6422a33246a3c3c`
- Canonical content fingerprint: `7c509d6c4de59391dc3559b5070c0dbea42c0494f06ecc58d203cd65da7eb48d`
- Fingerprint scope: eight task-owned source, test, plan, prototype, and screenshot files. Readiness/review receipts are excluded from their own recursive fingerprint.

## Promised outcomes observed

- The legacy organic result offer now renders Wistia media `nwrpfub965` in the existing isolated player component and unchanged 16:9 offer position.
- The player pins `autoplay="true"`, `silent-autoplay="true"`, and `preload="auto"` without setting the plain `muted` attribute, preserving Wistia's native click-for-sound affordance.
- The stored offer arm remains `organic-plan-v1`; the presentation revision is `organic_plan_v3`.
- The existing placeholder, managed Wistia scripts, 12-second German failure state, diagnosis, field-test activation, pricing, and downstream offer sections remain intact.
- No transcript-bearing embed, duplicate player, custom sound overlay, CSP expansion, Personal Plan route change, checkout change, or Wistia mutation was added.

## Test-first proof

- Before production edits, the focused command passed 8 tests and failed the two intended contracts: the old media/playback attributes and old offer revision.
- After implementation, the identical focused command passed 10/10.

## Verification

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/organic-funnel-surface.test.tsx tests/offer-tracking-contract.test.ts tests/wistia-csp.test.ts` — 10/10 passed.
- `npm run ci:verify` with the root checkout's existing `.env.local` sourced into the isolated worktree process — passed again after rebasing to fresh `origin/main`; typecheck, lint, and production build completed with 141 generated routes.
- Lint reported five pre-existing warnings outside this task and zero errors.
- An initial environment-less `npm run ci:verify` compiled successfully but failed while prerendering `/chat` because the isolated worktree had no Supabase URL/key. Rerunning with the existing local env proved the full gate; no env file or secret was changed or copied.
- `git diff --check` — passed.

## Browser evidence

- Chromium: 320×800, 390×844, and 1440×1000. WebKit: 390×844.
- Both `organic-plan-v1` and `organic-plan` aliases were exercised, including `scenario=field-test`.
- At every width/browser, media `nwrpfub965` reported active muted autoplay and advancing current time. The player measured 288×162 at 320 px, 358×201.375 at 390 px in Chromium, and 720×405 on desktop, with no horizontal overflow or page errors.
- Wistia rendered the native sound control with accessible name “Klicken Sie hier, um den Ton einzuschalten.” Activation changed `muted` to false, kept playback active, and restarted near 0:00.
- When both Wistia scripts were aborted, the player entered its error state after the bounded timeout with “Das Video konnte nicht geladen werden. Seite neu laden”; diagnosis and pricing remained present.
- Scrolling to pricing left playback active. This is recorded as part of Nick's approved direct-autoplay bandwidth tradeoff; no custom viewport pause behavior was added to this bounded swap.
- After Nick authorized the external caption replacement, Wistia accepted the corrected 130-cue VTT as `German [replace]`, rendered the corrected transcript in the authenticated media manager, and served it from the public production caption endpoint. The public VTT matches the audited replacement apart from its final newline, preserves every cue timestamp, and contains none of the tracked mistranscriptions.

## Artifact disposition and residual risk

- Commit later if publication is explicitly authorized: the approved plan, prototype, two planning screenshots, two production changes, two focused test changes, and readiness/review receipts.
- Discarded: the temporary Playwright verification script, local server output, browser trace data, and transient counterpart-plan-review output.
- Skipped: physical iOS Safari in normal and Low Power mode because no device was available; browser-level full-autoplay blocking could not be forced reliably. Manual player controls remain Wistia-owned fallback behavior.
- External caption gate: satisfied on 2026-08-25. The corrected German track is live in Wistia and was verified through both the authenticated transcript and public 130-cue VTT.
- Residual: Wistia configuration and captions can drift independently of repository code; direct autoplay increases pre-consent third-party activity and bandwidth; sequential conversion comparisons are directional rather than causal.
- Authorized next: Nick's “Ship” authorizes staging, commit, push, and a draft PR. Merge, deployment, cleanup, dashboard mutation, and any further Wistia mutation remain out of scope.

## Bottom line

The approved direct muted-autoplay media replacement and its corrected live caption track are verified on the fresh-base fingerprint above. No readiness blocker remains for the authorized commit, push, and draft PR.
