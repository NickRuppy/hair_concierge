# Produkt-Scan — Technical Hardening

**Worktree:** `.worktrees/scan-hardening` on `codex/scan-hardening` (base `11a99692` = origin/main tip, verified).
**Status:** evidence review confirmed, journey signed off, decision coverage `confirmed` — Nick, 2026-09-04. Camera-retry: Variante 1 (button inside the tile).

**PR 1 (server side, tasks 1-7) — implemented 2026-09-04.** SDD per-task reviews clean; Codex whole-branch review (effort high) → 2 Important + 3 Minor, all fixed in one wave and re-reviewed clean. `ci:verify` green; 690 scan/scanner/product-intake node tests green; resolve/search/wishlist/save driven locally via dev login (telemetry rows verified in `scan_resolve_events` with `outcome` null and `lookup_outcome`/`terminal_outcome` populated). Deviations from §5: F12 (single candidate load) was parked at first because it needed a seam inside `catalog-facts.ts`; landed 2026-09-05 as a follow-up commit on this branch — `loadStage3RecommendationCandidatePool` (role-independent product rows + batch snapshot) plus the pure `deriveStage3RecommendationCandidates`, wrapped by `loadStage3RecommendationCandidatesByRole`, which the resolve route now calls exactly once per hit; the private loader behind `product-previews.ts` became derive(pool) so both paths share one implementation (pinned by `tests/personal-plan-catalog-facts-candidate-pool.test.ts` for the batch and per-product-fallback clients, and by the one-load route assertion in `tests/scan-resolve-route.test.ts`); the multi-connection advisory-lock test is replaced by a structural test (lock precedes every read/write, key uses both ids) because PGlite is single-connection; migration renumbered to `20260904150000` after a version collision with the wave-3 approval migration on main. Additional fixes beyond §5 from review: concurrent submits of one EAN now get-or-create on `idx_product_submissions_one_open_scan` (was a 503); attempt-log Sentry captures at warning level; NULL `p_kind` guard; explicit `created_at` on attempt records (the deferred drain otherwise stamps `created_at` after `completed_at`).

**Deploy order for PR 1:** apply `20260904150000_scan_move_saved_product.sql` to production BEFORE the code deploys — `POST /api/scan/save` returns 503 until the RPC exists (verified locally).

## 1. Context

Nick's brief (2026-09-04): "get all scanner-related stuff to an excellent technical standard — proper code review, bugs identified and fixed, streamline, simplify, make the architecture more robust." Approach B ruled: fix every confirmed bug AND reshape the structures that bred them, so the race class cannot recur.

Evidence base: four independent read-only review lanes on `11a99692` (Fable inventory + Opus client-lifecycle lane + Sonnet API/lib lane + Sonnet operator-tooling lane + Codex `--effort high` second opinion). Findings converged; the ledger in §2 lists only items confirmed by at least two lanes or re-verified in code by the orchestrator. Production telemetry (`scan_resolve_events`, last 21 days): 19 attempts, 1 user, 0 logged failures — the pass is code-driven, not incident-driven.

Calibration for the reader: the existing code is deliberate (DI'd routes, pure TDD'd verdict core, 257 node tests, prior Codex review). The gaps are (a) zero browser-level coverage of the two largest files, (b) hand-synchronised lifecycle state in `scanner.tsx` / `scan-flow.tsx`, (c) a two-write "atomic" save, (d) a submit dedupe that ignores the scan eligibility gate.

## 2. Findings ledger (confirmed)

IDs are stable and referenced by tasks and tests.

| ID | Sev | Where | Defect | Trigger → wrong outcome |
| --- | --- | --- | --- | --- |
| F1 | High | `scan-flow.tsx` `returnToScanning` + `scanner.tsx` epoch effect | Closing a sheet resets `lastFiredValue`/`hasDecoded` while the barcode is still in frame | Close verdict sheet with bottle still in view → same sheet re-opens ~0.5 s later; second resolve + `scan_result_shown`; on an error toast this loops (toast/request storm, self-amplifying under `rate_limited`) |
| F2 | High | `scanner.tsx` `checkTimeout` | 3 s fallback clock is wall time since `startTime`, keeps accruing while the loop is paused for a sheet | Open Merkliste/search within 3 s of arriving, browse > 3 s, close → search sheet pops open uninvited on the first resumed tick |
| F3 | High | `scanner.tsx` `runDetectionCycle` | In-flight `detect()` finishing after a sheet pause still mutates the session and fires `onDecoded` (flow drops it because a sheet is open) | Value is marked fired + `hasDecoded=true` → that barcode is unscannable for the rest of the attempt and the timeout is suppressed |
| F4 | High | `scan-flow.tsx` `submitUnknown` | No generation guard / cancellation | Dismiss unknown sheet before POST returns → pending sheet re-opens over live viewfinder; `already_in_catalog` branch mints a fresh resolve generation and paints a result the user left; `finally` clears `submitting` for a newer submission |
| F5 | High | `scan-save-sheet.tsx` + `scan-flow.tsx` `updateSavedState` | Save completion not bound to product/generation | Save A in flight, dismiss, scan B → A's saved state applied to B's card, analytics with A's verdict, B's save sheet closed |
| F6 | High | `save/route.ts` + `saved-state.ts` | "Move" = destination insert + source delete as two admin calls | Concurrent opposite moves delete each other's rows (both 200, product in neither list); cleanup failure leaves both rows with a 500 |
| F7 | High | `submit/route.ts` → `submissions.ts` `intake_dedupe` | Dedupe filters on `is_active` only (no lifecycle, no quarantine) | Scan of a quarantined/non-active product → resolve says unknown → submit says `already_in_catalog` → client re-resolves → 404 → back to scanning. No submission ever created; loop forever |
| F8 | Med-High | `scanner.tsx` visibility handling / `start()` | Resume never re-plays the video; no `track.ended`/`mute`/`pageshow` handling; `play()` rejection swallowed | iOS app switch / call / bfcache back → frozen or black viewfinder, hints keep rotating, nothing recovers |
| F9 | Med-High | `scan-flow.tsx` `handleUnavailable` | Camera failure is terminal (`cameraAvailable=false`, no retry) | `NotAllowedError` for non-user reasons (page hidden at prompt, low power) → search-only for the whole visit |
| F10 | Med | `scanner.tsx` pause effect + `afterDetection` | Both schedule a frame; single handle ref | Pause flips true→false inside one `detect()` await → two persistent frame chains, only newest cancellable |
| F11 | Med | `resolve/route.ts` | Telemetry record/complete awaited on the response path | Two extra sequential round trips per scan, purely for fail-open telemetry |
| F12 | Med | `resolve/route.ts` `loadFactsForRole` | Role-sensitive categories reload product facts AND the full candidate catalog per role | Shampoo hit with 2 roles ≈ 23 round trips; candidate pool is role-independent |
| F13 | Low | `scan-wishlist-sheet.tsx` | No request guard on load; removal rollback restores a captured full array | Older GET overwrites fresher list; overlapping removals resurrect a deleted entry |
| F14 | Low | `saved-state.ts` routine save | Unique-violation treated as own success without re-read | Race with another surface → `managedByScan: true` on a row scan does not own; later removal 409 |
| F15 | Low | `resolve/route.ts` | `matchedProductId`/`lookupOutcome` assigned after the quarantine await | Quarantine lookup throws → telemetry loses the known hit |
| F16 | Low | all 5 routes | `Retry-After: "60"` literal instead of `fixedWindowRetryAfterSeconds(SCAN_RATE_LIMIT)` | Correct by coincidence |
| F17 | Low | `scan-unknown-flow.tsx` | `tappedCategory` persists after a failed submit | Card shows selected + error simultaneously |
| F18 | Low | `scanner-identifier-backfill-apply.ts`, `expansion/{preflight,verify}.ts` | Bare `void main()` (no entry-point guard) unlike their siblings | Stray import runs the CLI |

Structural debts (not bugs, drive the refactor): five routes duplicate auth/rate-limit/parse/fail scaffolding with divergent success envelopes; `isDecisionWithoutTarget` byte-duplicates `resolve-verdict.ts`'s private `isNotNeeded`; legacy `outcome` dual-write in `resolve-event-log.ts` after the v2 telemetry rollout; `ScanIdentifierType` carries `gtin|barcode` branches no client can produce; `catalog-readiness.ts` (operator-only) lives in runtime `lib/scan`; orphaned/contradicting doc comments (`identifier-lookup.ts` tail, `scanner.tsx` stacked JSDoc on the wrong effect, `catalog-eligibility.ts` vs `saved-state.ts` eligibility prose); search route silently truncates at 1000 rows.

Verified fine, do not churn: search-sheet debounce is cleared on close (query reset re-runs the effect); toast portal is modal-layer-exempt; save sheet at dialog priority above the result sheet; StrictMode double-invoke guarded at every await; late `detect()` at teardown guarded; quarantine gate consistent across search/resolve/save/wishlist; EAN normalisation consistent end-to-end; expansion apply is per-item idempotent with fingerprint replay; readiness oracle matches the live evaluators; `/scan` Permissions-Policy override.

## 3. Decisions

**Confirmed with Nick (2026-09-04):**
- D1 Behaviour boundary: full package — invisible refactor + bug fixes + small user-visible fixes, each user-visible one with before/after evidence.
- D2 Scope: runtime scan surface AND operator tooling (readiness oracle, coverage scripts, backfill/expansion executors) — tooling changes must stay backward compatible with the running waves' manifests and migrations.
- D3 Save/Merkliste move: one Postgres RPC migration, atomic in one transaction (applied to prod at deploy).
- D4 Browser test: Playwright with an injected fake detector + fake camera source.
- D5 Approach B: bug fixes + structural hardening (reducer flow machine, shared latest-request guard, scanner loop hook with pause-reason set + active-time clock, shared route wrapper, telemetry off the response path, single catalog load per scan, dual-write retired, tooling tidy).
- D6 Re-fire rule after closing a sheet: the same barcode fires again only after the detector has seen NO barcode for N consecutive detection attempts (barcode left the frame). Holding the bottle still never re-opens anything. A different barcode fires immediately.

**Inherited from evidence or contract:**
- I1 Ruling R7 (quarantined = treated as unknown) extends to submit dedupe: a scanned EAN matching a quarantined or non-active product creates/returns a research submission exactly like a miss (F7). Catalog stays the authority for active products.
- I2 The 3 s search fallback after every return-to-scanning stays (public-launch plan); only its clock semantics change to "3 s of active scanning" (F2).
- I3 Five fixed nav tabs, access gates, rate-limit budget (30/min shared), verdict logic, German copy in `verdict-labels.ts`: unchanged.
- I4 `not_removable_here` semantics (409 on DELETE; silent truthful state on POST cleanup) are preserved inside the RPC.

**Implementation defaults (routine, listed for transparency):**
- Telemetry writes use Next's `after()` so they run post-response inside the function lifetime (not bare `void`, which serverless may cut).
- Flow state: one `useReducer` machine `{ step, sheet: "none"|"result"|"unknown"|"pending"|"resolving"|"search"|"wishlist"|"save", camera: "live"|"unavailable"|"stalled", requests }`; every async completion carries a request token; reducer drops stale tokens. `detectionPaused` derives from `sheet !== "none"`.
- Shared `useLatestRequest()` hook (`begin() → token`, `isCurrent(token)`, `invalidateAll()`), used by resolve, submit, save, wishlist, search.
- `useScannerLoop` owns scheduling: `pauseReasons: Set<"hidden"|"sheet">`, one `syncLoop()` as the only caller of schedule/cancel, "at most one outstanding frame handle" invariant, `activeMs` accumulated per tick for the timeout, detection results tagged with a loop generation and dropped when generation or pause state changed during `detect()`.
- Stable-read logic (`handleRawDetections` incl. D6 re-arm) extracted to `scanner-session.ts` as pure `applyRawDetection(session, detections, frameArea)` with node tests.
- Test seams: optional `Scanner` props `detectorFactory` and `mediaSource` (default = current ponyfill + `getUserMedia`); dev-only `/labs/scan` harness page reads `window.__scanTestHooks` and mocks nothing server-side — API responses are mocked by Playwright `page.route`, matching the personal-plan lab pattern. Spec runs in the existing `quality-personal-plan-journey` job.
- Route wrapper `createScanRoute({ route, parse, handler })` → uniform `{ error }` envelope on failure; success bodies keep their current shapes (client contract unchanged) — no envelope migration in this pass.
- Legacy `outcome` column: stop writing (column stays nullable; docs already read only `lookup_outcome`/`terminal_outcome`); update the dual-write sentence in `docs/scan-attempt-log.md`.
- `ScanIdentifierType` narrowed to `"ean"` at the public contract; the 3-way union stays private to the DB matcher.
- `catalog-readiness.ts` moves to `src/lib/product-intake/scan-catalog-readiness.ts`; both script imports updated in the same commit.
- Search route: return `{ results, truncated: boolean }` (additive; client ignores it today).
- Camera retry: Variante 1 (button inside the tile) unless Nick picks otherwise; `insecure` gets no button; new `stalled` state copy "Das Kamerabild ist abgebrochen." / button "Kamera neu starten".
- Delivery: PR 1 server-side, PR 2 client-side, both from this worktree as sequential branches (`codex/scan-hardening-server`, `codex/scan-hardening-client` stacked on it) so each is independently reviewable and deployable.

- D7 Camera-retry affordance: Variante 1, button inside the tile (mockup reviewed 2026-09-04).

**Undiscussed consequential assumptions affecting this handoff: none.**

## 4. Non-goals

- Parked product calls (409 copy, "Unklar" naming the role, promotion-layer rule, Merkliste-in-plan, provenance widening) — out of scope (Approach B, not C).
- Decode-quality work (STRICH, worker-offloaded detection), barcode formats beyond EAN-8/13, changes to verdict logic or rate limits.
- Any change to expansion manifest formats, migration formats, or the approval/apply RPCs the running waves use.
- Archiving the August phase-1a/1b ledger scripts + tests + data: flagged as likely dead, left untouched pending Nick's word (historical ledger references).

## 5. Tasks

### PR 1 — server side (`codex/scan-hardening-server`)

1. **Atomic move RPC (F6, F14).** Migration `scan_move_saved_product(p_user_id uuid, p_product_id uuid, p_kind text)` SECURITY DEFINER, service-role only: eligibility gate (active + lifecycle active → else `product_not_found`; not quarantined → else `product_not_saveable`), idempotent destination upsert (`scan_wishlist` ON CONFLICT DO NOTHING; `user_products` insert only when no owned+matched row exists from any source), source cleanup scoped as today (`intake_source='scan'` rows only; non-scan owned row → `not_removable_here` without aborting), advisory lock on `(user_id, product_id)`, returns the post-write saved-state row set. `saved-state.ts` gains `moveScanSavedProduct` calling it; POST handler becomes one call. Postgres integration test in the existing `*-postgres.test.ts` style (opposite concurrent moves; cleanup refusal; replay idempotency). Removal path (DELETE) unchanged.
2. **Submit dedupe honours the scan gate (F7, I1).** `submitScanProductIntake` runs the `already_in_catalog` match through `catalog-eligibility` (active lifecycle + not quarantined); otherwise falls through to submission creation. Route test with a quarantined and a discontinued match. Client `already_in_catalog` branch stays.
3. **Route wrapper.** `src/lib/scan/route.ts`: `createScanRoute` (auth → rate limit with derived `Retry-After` (F16) → parse → handler → `captureScanException` on throw → `temporarily_unavailable` 503). Migrate all five routes; existing DI seams preserved (deps objects unchanged in shape where tests depend on them). Route tests keep passing; add one wrapper test.
4. **Resolve route.** Telemetry via `after()` (F11); record hit/matched id before the quarantine await (F15); load the role-independent candidate pool once and derive per-role facts only (F12) with a test asserting `loadRecommendationCandidates` is called once for shampoo with two roles; export the not-needed predicate from `resolve-verdict.ts` and delete `isDecisionWithoutTarget`; `ScanIdentifierType` narrowing; `{ truncated }` on search.
5. **Telemetry tidy.** Stop legacy `outcome` dual-write; route repeated attempt-log write failures through `captureScanException` at warning level (one capture per process per minute, not per attempt); doc sentence update.
6. **Operator tooling.** Entry-point guards (F18); move `catalog-readiness.ts` under product-intake with import updates; no format changes.
7. **Doc-comment reconciliation** across `catalog-eligibility.ts` / `saved-state.ts` / `identifier-lookup.ts`.

Verification: `npm run ci:verify`, `npm run test:node`, the two postgres suites, Codex whole-branch review, drive `/scan` save/Merkliste move + unknown flow locally against the migrated local DB.

### PR 2 — client side (`codex/scan-hardening-client`, stacked)

8. **Pure extraction first (behaviour-preserving).** `applyRawDetection` + D6 re-arm rule + active-time timeout predicate into `scanner-session.ts`, node tests for F1/F2/F3 semantics; `useLatestRequest` hook with tests; flow reducer transcribed from current transitions with tests for every transition incl. stale-token drops (F4, F5).
9. **Scanner loop hook (F3, F8, F10).** `useScannerLoop` per §3 defaults; visibility resume re-plays the video; `track.ended`/`mute` and `pageshow` (persisted) trigger re-acquire; failure → `stalled`. `Scanner` keeps its public props, adds `detectorFactory`/`mediaSource`.
10. **Flow on the reducer (F1, F4, F5, F9, F13, F17).** Sheets inside state; save sheet completion bound to product id + token; wishlist load/removal guarded per product; camera-unavailable tile gets the retry button (Variante per sign-off) and the `stalled` state; unknown-flow selection resets on error.
11. **Harness + Playwright.** `/labs/scan` (dev-only, 404 in prod like the other labs) with fake detector/camera hooks; spec `tests/scan-flow.spec.ts` covering: decode → 400 ms confirm → sheet; close with barcode still in frame → no re-open, remove and re-present → re-open (F1/D6); sheet open across the 3 s mark → no search pop (F2); decode landing during a sheet → still scannable after close (F3); dismiss unknown before submit returns → nothing re-opens (F4); save A, dismiss, scan B → B untouched (F5); scripted `NotAllowedError` → tile → retry → live (F9); error toast with barcode still in frame → single toast (F1 loop). Wire into `test:playwright:personal-plan-stage3:journey`.
12. **Delete the old guards** (`sheetOpenRef`, `resolveInFlightRef`, `resolveGenRef`, `loopControlRef`, the two pause booleans) once the reducer/hook tests are green; doc comments rewritten to describe the new invariants briefly.

Verification: `npm run ci:verify`, node + Playwright suites, Codex whole-branch review, then Nick's phone walkthrough on the deployed build (iOS app-switch resume, deny → retry, same-bottle close, Merkliste browse > 3 s).

## 6. User journey (for sign-off)

Entry: entitled user on `/scan`, camera permission granted, viewfinder live.

1. Point at a bottle → within ~100 ms two matching reads → corners and pill turn green "✓ Barcode erkannt" for 400 ms → verdict sheet slides up (resolve already in flight during the confirm). Unchanged.
2. Close the sheet (✕, swipe, "Weiter scannen") while the bottle is still in view → viewfinder live, hint pill back to default, **nothing re-opens** (F1/D6). Move the bottle out and back in → same sheet opens again immediately. Point at another product → its sheet opens immediately.
3. Tap Merkliste or "Produkt suchen" within the first seconds, browse for a while, close → viewfinder live, **no search sheet pops** (F2). After 3 s of actual scanning without a read, the search sheet opens as before.
4. A read that lands the instant a sheet opens is discarded → after closing, that product still scans (F3).
5. Unknown product → category tap → dismiss before the reply → **nothing re-opens**; the submission, if it was created, still shows on the next scan of that EAN as "Wir prüfen das gerade" (F4). Quarantined product → same "Wir prüfen das gerade" path instead of an error loop (F7). Failed submit → card no longer looks selected, error line shown (F17).
6. Save to Merkliste / "Benutze ich schon" → one request, exclusive lists guaranteed even on double taps or two tabs (F6). Save A, dismiss, scan B → B's card unaffected (F5).
7. Error while resolving (offline, 429) → one toast, viewfinder live, **no toast storm**; re-present the bottle to retry (F1).
8. Switch apps or take a call, come back → viewfinder resumes on its own. If iOS killed the stream, the tile shows "Das Kamerabild ist abgebrochen." with "Kamera neu starten" (F8). Camera denied or missing → same tile with "Kamera erneut versuchen"; tapping re-asks the browser; if it fails again the tile stays with the search link (F9). Insecure context → tile without a button, unchanged.

Completion: user leaves `/scan`; camera stops; nothing re-opens after leaving.

Evidence: camera-retry mockup (current, Variante 1, Variante 2, per-state copy): https://claude.ai/code/artifact/41b7def6-bac7-4794-8426-78ff04a2803c . All other changes are timing/robustness fixes with no new visual element; they are proven by the Playwright spec in task 11 rather than a static mockup.
