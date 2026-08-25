# New VSL muted-autoplay — code-review receipt

## Verdict

**No blocking findings.** The reviewed repository implementation is ready for the authorized commit, push, and draft PR. The external caption gate is satisfied.

## Review identity

- Scope: committed branch state plus all task-owned unstaged and untracked changes against `origin/main`.
- Branch: `codex/new-vsl-autoplay-plan`
- Base: `origin/main` at `641a1522d93ed84ce632a5a1b6422a33246a3c3c`
- Canonical content fingerprint: `7c509d6c4de59391dc3559b5070c0dbea42c0494f06ecc58d203cd65da7eb48d`
- In-scope content: the approved plan; prototype and two screenshots; two production files; two focused test files. Readiness/review receipts are excluded from their own recursive fingerprint but were read as supporting evidence.

## Lanes run

- Normal correctness lens: run in the main Codex session over media identity, Wistia attribute/runtime contract, script and fallback behavior, offer-revision propagation, route aliases, existing component boundaries, CSP coverage, regression tests, and all task-owned artifacts.
- Independent counterpart lens: Claude Opus 4.8 at high effort, read-only, over the source/test tree and original retained artifacts. It reported no correctness defects and no requested changes. The later delta only records the satisfied external caption gate and fresh `origin/main` identity; its source/test content is unchanged, so the prior counterpart conclusion is reused.
- Structural maintainability lens: skipped. The implementation changes two string/attribute contracts in one isolated player boundary and one tracking revision, with no new route, shared abstraction, state model, migration, workflow, concurrency, cache, or type boundary.

## Findings

No actionable code findings.

Confirmed review points:

- `WISTIA_MEDIA_ID` remains the single source for player identity, media script, swatch, and selector interpolation.
- `autoplay="true"`, `silent-autoplay="true"`, and `preload="auto"` implement the approved direct muted-autoplay path; omitting a plain `muted` attribute preserves Wistia's native click-for-sound action.
- The presentation revision changes to `organic_plan_v3` while stored offer identity remains `organic-plan-v1`.
- No stale production/test reference to the old media, revision, paused autoplay, or metadata preload remains. Historical old values remain only where the plan explains the replacement.
- The existing failure fallback, offer hierarchy, single pricing slot, regular field-test presentation, and CSP origin contract are preserved.
- The regression test's absent-`muted` assertion protects the key server-markup contract; runtime muted autoplay and unmute/restart behavior are appropriately covered by fresh Chromium/WebKit evidence instead of a brittle unit mock.
- The fresh-base delta is unrelated launch-readiness documentation/tooling plus billing-backup containment; it does not overlap the player, offer revision, or focused test files. The task rebased without conflict.
- The retained plan's caption-gate update accurately reflects the authenticated Wistia save and public 130-cue VTT proof. It does not change application behavior or introduce a repository caption artifact.

## Verification considered

- Focused red/green proof: intended two failures before implementation; 10/10 passing after implementation.
- `npm run ci:verify` passed typecheck, lint with zero errors and five unrelated warnings, and a full production build when run with the existing local env sourced.
- Chromium and WebKit evidence covered muted autoplay, advancing playback, native German sound control, unmute/restart, responsive geometry, both aliases, field-test mode, script-abort fallback, and continued access to diagnosis/pricing.
- `git diff --check` passed and no transient browser script remains in the worktree.

## Open assumptions and residual risk

- Wistia's remote configuration and media availability can drift after this review; the repository pins media identity and core playback attributes but does not own that external state.
- Continued offscreen playback, `preload="auto"`, and increased pre-consent third-party activity are explicit owner-accepted direct-autoplay tradeoffs, not hidden defects.
- Native Wistia sound-control copy uses formal German; the user approved retaining it instead of introducing a custom overlay.
- A physical iOS Safari normal/Low Power check was unavailable and remains a release-device check.
- The corrected German captions are live on media `nwrpfub965`. The public VTT preserves all 130 cue timestamps, matches the audited replacement apart from the final newline, and contains none of the tracked errors.

## Artifact disposition

- Commit later only with explicit publication authorization: plan, prototype/screenshots, implementation, tests, and both receipts.
- Discarded/transient: local Playwright script and server output; Claude review file under the system temporary directory.
- Authorized next: stage, commit, push, and draft PR. Merge, deployment, cleanup, dashboard mutation, and further Wistia changes remain separate.

## Bottom line

The exact fresh-base fingerprint has no blocking findings and no requested code changes. Caption correction is complete; physical iOS remains a disclosed device-specific residual, not a publication blocker. Nick's separate “Ship” authorization covers commit, push, and a draft PR only.
