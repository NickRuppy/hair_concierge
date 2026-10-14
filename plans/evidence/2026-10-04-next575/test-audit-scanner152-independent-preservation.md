# Scanner detection/session: independent nine-candidate preservation review

**Verdict: C1–C6 CONDITIONAL PASS; D1–D3 CONDITIONAL PASS.** No lost asserted contract or unsafe scope expansion identified in the proposed nine cuts. Approval remains conditional on the main operator's transfer-first proof, nine intended source-fault results, byte restoration, focused cut proof and campaign coverage gates. No runtime/fault result is supplied by this report.

Reviewed root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Scope is nine C/D decisions and their surrounding test/owner context. This is not a new full152 classification/audit or browser/camera/provider verification. Repository was read-only; only this report and `/tmp/test-audit-scanner152-independent-static.json` were written. No tests/runners/compiler, owner imports, source mutations, environment/provider/DB commands, or second reviewer.

## Per-candidate decisions

### C1 — full factory defaults into isolation keeper: CONDITIONAL PASS

Donor `tests/scan-scanner-session.test.ts:19-41`; keeper `:43-57`. The donor's entire 19-field literal deepEqual is applied to the keeper's existing first factory result before any mutation. The keeper still mutates detecting/lastFiredValue/frameCounter/hint, creates its existing second result, checks distinct identity and the four second-result reset fields. No factory call/input added.

`src/lib/scan/scanner-session.ts:106-128` returns a fresh flat literal, without parameters or ambient reads. Both first calls therefore have identical operative input. Separate `:59-64` deep-equality plus distinct-identity test remains; the new first-result assertion is not misrepresented as full second-result equality.

Control: change owner's unique `hintChangedAt: 0` to1. Expected failure is the transferred `assert.deepEqual(first, {...})`, not any subsequent mutation/isolation assertion. This proves the full-shape oracle can observe an otherwise unasserted default; it does not individually mutation-prove all19 fields.

### C2 — stable read prefix into duplicate-fire keeper: CONDITIONAL PASS

Donor session test `:144-159`; keeper `:161-169`; helper `:126-142`. Exact existing prefix: fresh session, EAN_A at100, EAN_A at200, ratio0.3, default accepting validator port. The first bare100 call is wrapped with the original null assertion, followed by streak1. All seven post-fire state checks plus the second call's EAN result are preserved before the existing300/400 calls. Later duplicate suppression assertions remain. No additional read, validator input or fixture.

Owner `scanner-session.ts:148-186` records timestamp/ratio, advances streak, validates after2 matches, sets lastFiredValue/hasDecoded, consumes the streak and resets raw telemetry. The helper supplies a fake acceptance policy; this is actual state-machine behavior conditional on port acceptance, not production GTIN-checksum proof. The misleading checksum title on a retained test does not increase coverage credit here.

Control: record input.now-1 at owner:148. At200 the returned fire and earlier state fields remain valid; `assert.equal(session.lastDetectionTime, 200)` must fail for199 before the later continuation. No mock/setup mutation.

### C3 — decoded timeout into live clock composition: CONDITIONAL PASS

Donor session test `:371-379`; keeper loop test `:305-316`. Donor sets hasDecoded true and advances activeMs to6000 once; keeper sets the same flag and supplies100 existing running ticks at100ms increments. Real `advanceLoopClock` imports/calls real `shouldFireTimeout` (`src/lib/scan/scanner-loop.ts:1,106-119`), with no stub. `runningController` in loop test:21-26 sets running true and has no pause reason. First tick anchors; by now6100 activeMs is6000, and the false timeout assertion has been evaluated on every tick.

Readset equivalence is the decoded guard, not identical tick history: `scanner-session.ts:263-270` returns for timeoutFired OR hasDecoded before activeMs is read. The added final timeoutFired=false preserves the donor's unconsumed-one-shot observation: these running clock operations only advance activeMs/lastTickAt and check timeout; none clears timeoutFired. Earlier consumption cannot be hidden by a later reset in this keeper.

Control: in shouldFireTimeout's guarded return, set timeoutFired=true while still returningfalse. The100 existing timedOut=false assertions must pass and the final transferred flag assertion must fail. Guard-removal would instead fail an existing timedOut assertion once threshold is reached, so do not describe the supplied flag control as a separate executed proof of every timeout predicate. Paused time, capped gaps, threshold and reset tests remain independent.

### C4 — first tick into accumulated clock keeper: CONDITIONAL PASS

Donor loop test `:226-234`; keeper `:236-246`. Identical fresh controller/session and existing first tick1000. Transfer wraps that call in timedOut=false, then checks activeMs0 and lastTickAt1000 before the existing1016/1032 ticks and32ms assertion. Without the transfer an initial anchor defect could be masked by the eventual sum; the prospective edit preserves the intermediate contract explicitly.

Owner loop:111-118 handles paused guard, stores first timestamp and advances only when previous is non-null. Control `previous === null || shouldFireTimeout(session)` makes the existing first call reporttrue: intended first transferred timedOut assertion fails. No clock/environment mock involved.

### C5 — cancellation state prefix into reopen/resubmit keeper: CONDITIONAL PASS

Donor `tests/scan-flow-state.test.ts:360-371`; keeper `:373-403`; run helper `:61-64`. Both reduce exactly initial state→search open→submit token5→cancelSubmit close. Transfer copies auxiliary=none, submitting=false, submitError=null and activeRequest=null to the existing dismissed variable before reopening. Existing token6 pending/success checks and stale token5 result while token6 is pending remain. No reducer invocation, token, result or input added.

Owner `src/lib/scan/scan-flow-state.ts:456-481,504-530` performs those transitions; ownership is token AND kind at:273-275. A later successful resubmit alone could overwrite an uncleared busy flag, so this transfer is necessary. The chosen fault changes cancellation's submitting=false totrue at:528; auxiliary assertion still passes, then `dismissed.submitting` must fail. Prior submitError is already null in both inputs: neither test proves clearing a non-null preexisting error on this particular close path. That is an unchanged limitation.

Distinct non-cancelling continuation remains test:348-358, idle cancellation:405-413; cross-kind and stale success/failure cases remain. Live `scan-flow.tsx:1210-1215` independently gates cancellation/token invalidation on current request kind. Its research success flow closes without cancellation at:886,904 before resolve/submitted. These guards are not interchangeable coverage and none is removed by C5.

### C6 — fresh announcement flags into mount/flip/restart keeper: CONDITIONAL PASS

Donor `tests/scan-detection-state.test.ts:406-413`; keeper `:415-461`; announcements helper `:349-367`. Keeper's extra initial searching/default call is asserted to return the INITIAL object with unchanged default text/searching=false. Its subsequent spotted→searching inputs are therefore the donor's exact operative prefix. Existing searchingAnnounced=true remains; transfer adds spottedAnnounced=true after that search transition. No policy call/input/step is added.

Donor's restarted.spoken=[SPOTTED] is a local helper projection, not another production delivery boundary: helper pushes only when next.announcement differs from previous.announcement. Keeper already checks INITIAL/default and the fresh restarted SPOTTED text/flag. Actual `scanner-session.ts:522-526,537-562` returns a new spotted object from initial state and preserves the spotted flag through searching. `guidance.ts:8-16` supplies distinct default/spotted labels. The keeper's explicit return-to-default/searching=true observation also prevents equal default/spotted text from satisfying the whole sequence.

Control: add spottedAnnounced=false to the actual searching transition at:561. Earlier announcement/searching checks still pass; the transferred spotted flag fails. This is meaningful policy-state proof. Neither test simulates a screen reader, the component's trailing timer, nor actually changing sessionEpoch; both restart by supplying INITIAL again. Actual Scanner resets policy state and timers at `src/components/scan/scanner.tsx:173-185`, calls the policy at:188-195, and schedules publication at:232-244. Those wiring/lifecycle risks remain outside this pure-helper consolidation.

### D1 — alias identity / original-object reset duplicate: CONDITIONAL PASS

Donor session test:100-109; keeper:66-98. `const loopReference=session` makes their identity equality tautological: a callee cannot reassign either caller-local binding. The meaningful observation is lastFiredValue=null on that original object. Keeper observes exactly this, plus reset state and now-derived timestamps.

At owner session:90-103, only detecting, lastFiredValue and blockedValue are read from prior state before assigning fresh defaults; those values match in both inputs. Other seeded keeper fields are overwritten, not predicates. now1 versus5000 affects only timestamp assignments and cannot change the lastFired reset. In-flight detecting preservation test:111-120 and inherited blockedValue test:397-404 remain.

Control redirects Object.assign's target from session to a new object. Keeper's first lastFiredValue=null assertion must fail, proving reset reaches the original reference. Actual hook restart uses sessionRef.current at `use-scanner-loop.ts:931`, but neither pure test proves React ref replacement/wiring or asynchronous detector closure behavior. No such guarantee is lost by removing the redundant alias assertion.

### D2 — duplicated stream slot identity shape: CONDITIONAL PASS

Donor loop test:338-347; keeper:329-336. Both construct distinct objectsX/Y and pass current=Y, videoSource=Y, releasingX. Owner loop:171-178 reads strict reference identity only; id strings are never read. Keeper's exact false/false object includes both donor assertions and also excludes extra keys. All live/live and mixed-slot cases remain.

The two narrative situations do not execute different lifecycle paths: neither callback runs recover or effect cleanup. Hook `use-scanner-loop.ts:598-622` applies the plan, removes only owned listeners, stops the supplied stream and conditionally clears video; recovery acquires before releasing previous at:814-858, cleanup releases only watched streams at:877-889. Thus the deletion preserves the predicate's entire asserted contract but cannot be credited as browser teardown, stale-await ordering, track-stop identity or recovery-order proof.

Control clearCurrent=true makes keeper's exact plan assertion fail while leaving clearVideoSourcefalse. No fixture IDs or mocked lifecycle behavior are changed.

### D3 — confirm visual with identical versus drifting live box: CONDITIONAL PASS

Donor detection test:278-288; keeper:318-330. Both supply kindspotted, confirmActivetrue, detectionPausedfalse and confirmBoxA. Live box differsA/B, but owner session:417-423 uses constant visualread and non-null confirmBoxA short-circuits detectionBoxOf entirely. The differing live box is outside the operative readset for all returned fields on this branch. Keeper already asserts visualread and the captured outlineBoxA; donor only checks visualread.

Control replaces constant visualread with detection.kind on the confirm branch: keeper must fail read-versus-spotted assertion. Searching-confirm, paused-confirm, unconfirmed spotted and static-paused branches remain; no geometry axes, tolerance or boxes are generalized away.

## Scope, retained risks and static checks

Read complete candidate/keeper bodies in their live files and all four changed test files/helpers for context; reviewed complete scanner-session and scanner-loop owners, scan-flow-state transition/type contract, guidance, plus targeted live hook/Scanner/ScanFlow caller slices. The nine callbacks reach standard synchronous JavaScript owners. No external SDK/browser dependency-backed outcome is claimed, so hardware, wasm and browser dependency internals were not represented as verified. No private getter/status seam, production export, helper or import is removed: prospective diff changes only four test files. FakeScheduler's getters/counters remain local support for retained scheduling tests.

Scheduling cancellation remains separate from clock tests: loop test:79-221 checks direct decision, redundant asks, pause reasons, generation and stale continuation. FakeScheduler applies real decisions but supplies browser-side bookkeeping itself; it cannot replace actual request/cancel/teardown verification. Live syncLoop applies cancellation to actual handles at hook:335-373 and ignores stale detection/continuation generations at:395,415,485. No candidate retires that independent policy coverage.

Relevant history was inspected: `255ffa87` (#523) introduced the controller/active clock/recovery ownership boundary; `2a87014e` (#524) added confirm and announcement contracts; `ac021a5b` (#593) added both research-submit dismissal and reopen tests. Historical fix provenance is retained by assertions, not used as evidence that comments execute. No dead-feature claims.

All three F classifications remain untouched and receive zero removal/repair credit: session paused-wall-time title only supplies explicit deltas; flow mismatch title exceeds its unknown-only input; null fatigue action remains an admitted reducer input while the caller dispatches only truthy hydration. This review does not extend those titles into additional asserted coverage.

Static report verifies all4 live baseline hashes and15 readset hashes match evidence; all12 embedded phase snapshot hashes match. Exact text reconstruction replaces only six existing keeper bodies to produce transfer, then removes only nine donor statements to produce cut. It therefore preserves all surrounding imports/helpers and existing retained call/input sequences. Manifest hashes for137 other callbacks are identical; these are byte comparisons, not a fresh AST recount or per-site judgment. Declared152→152→143 counts are unexecuted artifact counts. All9 actual-source control anchors are currently unique and owner hashes match. Hash freshness is not human reading credit.

CI routing remains `package.json:49` top-level Node glob and `.github/workflows/ci.yml:158`; server-only preload does not replace these owners. Main must refresh hashes immediately before applying, hold unrelated work fixed, require selected keeper green→named ERR_ASSERTION→exact owner restore→green for each fault, then cut and run focused/full/coverage gates. One representative fault per candidate proves its named oracle; do not label every field individually mutation-tested. Baseline failures may not be discarded as cleanup.
