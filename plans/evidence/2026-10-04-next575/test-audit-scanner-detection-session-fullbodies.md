# Exact candidate bodies

## C1: C
Donor: tests/scan-scanner-session.test.ts:19
```ts
test("createScanSessionState: returns the fully-reset default shape", () => {
  assert.deepEqual(createScanSessionState(), {
    detecting: false,
    frameCounter: 0,
    blockedValue: null,
    emptyDetections: 0,
    activeMs: 0,
    detectionAttempts: 0,
    lastRawValue: null,
    consecutiveMatch: 0,
    lastFiredValue: null,
    hasDecoded: false,
    timeoutFired: false,
    startTime: 0,
    lastDetectionTime: 0,
    lastBoundingBoxRatio: null,
    meanLuma: null,
    lastLumaSampleTime: 0,
    rawDetectionsWithoutStableRead: 0,
    hint: null,
    hintChangedAt: 0,
  })
})
```
Keeper before: tests/scan-scanner-session.test.ts:43
```ts
test("createScanSessionState: returns a fresh object each call — mutating one does not leak into the next", () => {
  const first = createScanSessionState()
  first.detecting = true
  first.lastFiredValue = "4006381333931"
  first.frameCounter = 42
  first.hint = "Mehr Licht hilft"

  const second = createScanSessionState()

  assert.notEqual(first, second)
  assert.equal(second.detecting, false)
  assert.equal(second.lastFiredValue, null)
  assert.equal(second.frameCounter, 0)
  assert.equal(second.hint, null)
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("createScanSessionState: returns a fresh object each call — mutating one does not leak into the next", () => {
  const first = createScanSessionState()
  assert.deepEqual(first, {
    detecting: false,
    frameCounter: 0,
    blockedValue: null,
    emptyDetections: 0,
    activeMs: 0,
    detectionAttempts: 0,
    lastRawValue: null,
    consecutiveMatch: 0,
    lastFiredValue: null,
    hasDecoded: false,
    timeoutFired: false,
    startTime: 0,
    lastDetectionTime: 0,
    lastBoundingBoxRatio: null,
    meanLuma: null,
    lastLumaSampleTime: 0,
    rawDetectionsWithoutStableRead: 0,
    hint: null,
    hintChangedAt: 0,
  })
  first.detecting = true
  first.lastFiredValue = "4006381333931"
  first.frameCounter = 42
  first.hint = "Mehr Licht hilft"

  const second = createScanSessionState()

  assert.notEqual(first, second)
  assert.equal(second.detecting, false)
  assert.equal(second.lastFiredValue, null)
  assert.equal(second.frameCounter, 0)
  assert.equal(second.hint, null)
})
```
Original full literal default deepEqual on existing first call, before any mutation; no new constructor/input.

## C2: C
Donor: tests/scan-scanner-session.test.ts:144
```ts
test("applyRawDetection: two consecutive matching reads fire once", () => {
  const session = createScanSessionState()

  assert.equal(read(session, EAN_A, 100), null)
  assert.equal(session.consecutiveMatch, 1)

  assert.equal(read(session, EAN_A, 200), EAN_A)
  assert.equal(session.lastFiredValue, EAN_A)
  assert.equal(session.hasDecoded, true)
  // The fire consumes the streak so the next frame starts a fresh one.
  assert.equal(session.consecutiveMatch, 0)
  assert.equal(session.lastRawValue, null)
  assert.equal(session.rawDetectionsWithoutStableRead, 0)
  assert.equal(session.lastDetectionTime, 200)
  assert.equal(session.lastBoundingBoxRatio, 0.3)
})
```
Keeper before: tests/scan-scanner-session.test.ts:161
```ts
test("applyRawDetection: a third and fourth identical read do not re-fire", () => {
  const session = createScanSessionState()
  read(session, EAN_A, 100)
  assert.equal(read(session, EAN_A, 200), EAN_A)

  assert.equal(read(session, EAN_A, 300), null)
  assert.equal(read(session, EAN_A, 400), null)
  assert.equal(session.lastFiredValue, EAN_A)
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("applyRawDetection: a third and fourth identical read do not re-fire", () => {
  const session = createScanSessionState()
  assert.equal(read(session, EAN_A, 100), null)
  assert.equal(session.consecutiveMatch, 1)
  assert.equal(read(session, EAN_A, 200), EAN_A)
  assert.equal(session.lastFiredValue, EAN_A)
  assert.equal(session.hasDecoded, true)
  assert.equal(session.consecutiveMatch, 0)
  assert.equal(session.lastRawValue, null)
  assert.equal(session.rawDetectionsWithoutStableRead, 0)
  assert.equal(session.lastDetectionTime, 200)
  assert.equal(session.lastBoundingBoxRatio, 0.3)

  assert.equal(read(session, EAN_A, 300), null)
  assert.equal(read(session, EAN_A, 400), null)
  assert.equal(session.lastFiredValue, EAN_A)
})
```
Exact100/200 first-read prefix; existing bare100 call wrapped by original assert rather than duplicated; all original fields asserted before300/400 continuation.

## C3: C
Donor: tests/scan-scanner-session.test.ts:371
```ts
test("shouldFireTimeout: a decoded session never fires the fallback", () => {
  const session = createScanSessionState()
  session.hasDecoded = true
  advanceActiveClock(session, SCAN_TIMEOUT_MS * 2)

  assert.equal(shouldFireTimeout(session), false)
  // Not consumed either: the one-shot stays armed for the next attempt.
  assert.equal(session.timeoutFired, false)
})
```
Keeper before: tests/scan-scanner-loop.test.ts:305
```ts
test("advanceLoopClock: a decoded session never reports the fallback", () => {
  const controller = runningController()
  const session = createScanSessionState()
  session.hasDecoded = true

  let now = 0
  for (let i = 0; i < 100; i += 1) {
    now += 100
    assert.equal(advanceLoopClock(controller, session, now).timedOut, false)
  }
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("advanceLoopClock: a decoded session never reports the fallback", () => {
  const controller = runningController()
  const session = createScanSessionState()
  session.hasDecoded = true

  let now = 0
  for (let i = 0; i < 100; i += 1) {
    now += 100
    assert.equal(advanceLoopClock(controller, session, now).timedOut, false)
  }

  assert.equal(session.timeoutFired, false)
})
```
hasDecoded true dominates before activeMs. Existing loop asserts actual timeout false on every tick including6000ms; added final flag proves one-shot not consumed; no extra clock call.

## C4: C
Donor: tests/scan-scanner-loop.test.ts:226
```ts
test("advanceLoopClock: the first tick anchors the clock without accruing anything", () => {
  const controller = runningController()
  const session = createScanSessionState()

  assert.equal(advanceLoopClock(controller, session, 1_000).timedOut, false)

  assert.equal(session.activeMs, 0)
  assert.equal(controller.lastTickAt, 1_000)
})
```
Keeper before: tests/scan-scanner-loop.test.ts:236
```ts
test("advanceLoopClock: accrues the gap between consecutive running ticks", () => {
  const controller = runningController()
  const session = createScanSessionState()

  advanceLoopClock(controller, session, 1_000)
  advanceLoopClock(controller, session, 1_016)
  advanceLoopClock(controller, session, 1_032)

  assert.equal(session.activeMs, 32)
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("advanceLoopClock: accrues the gap between consecutive running ticks", () => {
  const controller = runningController()
  const session = createScanSessionState()

  assert.equal(advanceLoopClock(controller, session, 1_000).timedOut, false)
  assert.equal(session.activeMs, 0)
  assert.equal(controller.lastTickAt, 1_000)
  advanceLoopClock(controller, session, 1_016)
  advanceLoopClock(controller, session, 1_032)

  assert.equal(session.activeMs, 32)
})
```
Samecontroller/session creation and identical initial1000 tick. Wrap existing call and inspect activeMs0/anchor1000 before next two existing ticks.

## C5: C
Donor: tests/scan-flow-state.test.ts:360
```ts
test("auxiliary_closed with cancelSubmit: dismissing the search sheet while a research-intake submit is in flight cancels it (same bug class as F4)", () => {
  const state = run(
    { type: "auxiliary_opened", sheet: "search" },
    { type: "submit_started", token: 5 },
    { type: "auxiliary_closed", cancelSubmit: true },
  )

  assert.equal(state.auxiliary, "none")
  assert.equal(state.submitting, false)
  assert.equal(state.submitError, null)
  assert.equal(state.activeRequest, null)
})
```
Keeper before: tests/scan-flow-state.test.ts:373
```ts
test("auxiliary_closed with cancelSubmit: reopening and submitting again still works (a fresh token owns the flow)", () => {
  const dismissed = run(
    { type: "auxiliary_opened", sheet: "search" },
    { type: "submit_started", token: 5 },
    { type: "auxiliary_closed", cancelSubmit: true },
  )

  const reopened = scanFlowReducer(dismissed, {
    type: "auxiliary_opened",
    sheet: "search",
  })
  const resubmitted = scanFlowReducer(reopened, { type: "submit_started", token: 6 })
  assert.equal(resubmitted.submitting, true)
  assert.deepEqual(resubmitted.activeRequest, { kind: "submit", token: 6 })

  const settled = scanFlowReducer(resubmitted, {
    type: "submitted",
    token: 6,
    pending: pendingResult,
  })
  assert.deepEqual(settled.step, { kind: "pending", pending: pendingResult })
  assert.equal(settled.submitting, false)

  // The earlier cancelled token (5) still cannot settle anything after the reopen/resubmit.
  const stale = scanFlowReducer(resubmitted, {
    type: "submitted",
    token: 5,
    pending: pendingResult,
  })
  assert.equal(stale, resubmitted)
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("auxiliary_closed with cancelSubmit: reopening and submitting again still works (a fresh token owns the flow)", () => {
  const dismissed = run(
    { type: "auxiliary_opened", sheet: "search" },
    { type: "submit_started", token: 5 },
    { type: "auxiliary_closed", cancelSubmit: true },
  )

  assert.equal(dismissed.auxiliary, "none")
  assert.equal(dismissed.submitting, false)
  assert.equal(dismissed.submitError, null)
  assert.equal(dismissed.activeRequest, null)

  const reopened = scanFlowReducer(dismissed, {
    type: "auxiliary_opened",
    sheet: "search",
  })
  const resubmitted = scanFlowReducer(reopened, { type: "submit_started", token: 6 })
  assert.equal(resubmitted.submitting, true)
  assert.deepEqual(resubmitted.activeRequest, { kind: "submit", token: 6 })

  const settled = scanFlowReducer(resubmitted, {
    type: "submitted",
    token: 6,
    pending: pendingResult,
  })
  assert.deepEqual(settled.step, { kind: "pending", pending: pendingResult })
  assert.equal(settled.submitting, false)

  // The earlier cancelled token (5) still cannot settle anything after the reopen/resubmit.
  const stale = scanFlowReducer(resubmitted, {
    type: "submitted",
    token: 5,
    pending: pendingResult,
  })
  assert.equal(stale, resubmitted)
})
```
Identicalrun(searchopen,submit5,cancelSubmitclose) already produces dismissed; inspectfourfields before existing reopen.

## C6: C
Donor: tests/scan-detection-state.test.ts:406
```ts
test("nextViewfinderAnnouncement: a fresh attempt re-arms both flips", () => {
  const { state } = announcements([{ visual: "spotted" }, { visual: "searching" }])
  assert.equal(state.spottedAnnounced, true)
  assert.equal(state.searchingAnnounced, true)

  const restarted = announcements([{ visual: "spotted" }], INITIAL_VIEWFINDER_ANNOUNCEMENT)
  assert.deepEqual(restarted.spoken, [SCAN_HINT_SPOTTED])
})
```
Keeper before: tests/scan-detection-state.test.ts:415
```ts
test("nextViewfinderAnnouncement: the mount publish does not spend the searching budget, so a later return-to-idle still announces", () => {
  // Step 1: the very first publish a mounted scanner ever runs — searching + the default
  // hint, which is exactly the text the live region already starts with. Nothing actually
  // changed, so this must not touch the state at all (same reference back).
  const afterMount = nextViewfinderAnnouncement(INITIAL_VIEWFINDER_ANNOUNCEMENT, {
    visual: "searching",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(afterMount, INITIAL_VIEWFINDER_ANNOUNCEMENT)
  assert.equal(afterMount.searchingAnnounced, false)
  assert.equal(afterMount.announcement, SCAN_HINT_DEFAULT)

  // Step 2: the barcode is spotted.
  const afterSpotted = nextViewfinderAnnouncement(afterMount, {
    visual: "spotted",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(afterSpotted.announcement, SCAN_HINT_SPOTTED)
  assert.equal(afterSpotted.spottedAnnounced, true)

  // Step 3: lost again. The searching budget was never spent by the mount publish, so
  // this is the flip that actually announces the return to idle.
  const afterSearchingAgain = nextViewfinderAnnouncement(afterSpotted, {
    visual: "searching",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(afterSearchingAgain.announcement, SCAN_HINT_DEFAULT)
  assert.equal(afterSearchingAgain.searchingAnnounced, true)

  // Step 4: still searching within the same attempt — the budget is spent now, so the
  // live region holds its text instead of being asked to say the same thing twice. This
  // is the state that used to stay stuck on "Barcode gefunden – kurz stillhalten" forever.
  const stillSearching = nextViewfinderAnnouncement(afterSearchingAgain, {
    visual: "searching",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(stillSearching, afterSearchingAgain)
  assert.equal(stillSearching.announcement, SCAN_HINT_DEFAULT)

  // Step 5: an epoch restart re-arms the budget from scratch.
  const restarted = nextViewfinderAnnouncement(INITIAL_VIEWFINDER_ANNOUNCEMENT, {
    visual: "spotted",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(restarted.announcement, SCAN_HINT_SPOTTED)
  assert.equal(restarted.spottedAnnounced, true)
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("nextViewfinderAnnouncement: the mount publish does not spend the searching budget, so a later return-to-idle still announces", () => {
  // Step 1: the very first publish a mounted scanner ever runs — searching + the default
  // hint, which is exactly the text the live region already starts with. Nothing actually
  // changed, so this must not touch the state at all (same reference back).
  const afterMount = nextViewfinderAnnouncement(INITIAL_VIEWFINDER_ANNOUNCEMENT, {
    visual: "searching",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(afterMount, INITIAL_VIEWFINDER_ANNOUNCEMENT)
  assert.equal(afterMount.searchingAnnounced, false)
  assert.equal(afterMount.announcement, SCAN_HINT_DEFAULT)

  // Step 2: the barcode is spotted.
  const afterSpotted = nextViewfinderAnnouncement(afterMount, {
    visual: "spotted",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(afterSpotted.announcement, SCAN_HINT_SPOTTED)
  assert.equal(afterSpotted.spottedAnnounced, true)

  // Step 3: lost again. The searching budget was never spent by the mount publish, so
  // this is the flip that actually announces the return to idle.
  const afterSearchingAgain = nextViewfinderAnnouncement(afterSpotted, {
    visual: "searching",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(afterSearchingAgain.announcement, SCAN_HINT_DEFAULT)
  assert.equal(afterSearchingAgain.searchingAnnounced, true)
  assert.equal(afterSearchingAgain.spottedAnnounced, true)

  // Step 4: still searching within the same attempt — the budget is spent now, so the
  // live region holds its text instead of being asked to say the same thing twice. This
  // is the state that used to stay stuck on "Barcode gefunden – kurz stillhalten" forever.
  const stillSearching = nextViewfinderAnnouncement(afterSearchingAgain, {
    visual: "searching",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(stillSearching, afterSearchingAgain)
  assert.equal(stillSearching.announcement, SCAN_HINT_DEFAULT)

  // Step 5: an epoch restart re-arms the budget from scratch.
  const restarted = nextViewfinderAnnouncement(INITIAL_VIEWFINDER_ANNOUNCEMENT, {
    visual: "spotted",
    hint: SCAN_HINT_DEFAULT,
  })
  assert.equal(restarted.announcement, SCAN_HINT_SPOTTED)
  assert.equal(restarted.spottedAnnounced, true)
})
```
Extra initial searching/default call returns same INITIAL object (already asserted), then exact spotted/searching pair. Existing searching flag and restarted announcement prove donorremaining observations; add carried spotted flag.

## D1: D
Donor: tests/scan-scanner-session.test.ts:100
```ts
test("restartScanSessionState: mutates in place so the running detection loop sees it", () => {
  const session = createScanSessionState()
  const loopReference = session
  session.lastFiredValue = "4006381333931"

  restartScanSessionState(session, 1)

  assert.equal(loopReference, session)
  assert.equal(loopReference.lastFiredValue, null)
})
```
Keeper before: tests/scan-scanner-session.test.ts:66
```ts
test("restartScanSessionState: re-arms the guards that would block a second scan", () => {
  const session = createScanSessionState()
  session.lastFiredValue = "4006381333931"
  session.hasDecoded = true
  session.timeoutFired = true
  session.lastRawValue = "4006381333931"
  session.consecutiveMatch = 2
  session.rawDetectionsWithoutStableRead = 7
  session.frameCounter = 120
  session.detectionAttempts = 40
  session.hint = "Mehr Licht hilft"
  session.lastBoundingBoxRatio = 0.4
  session.meanLuma = 30

  restartScanSessionState(session, 5_000)

  // The same barcode must be able to fire again, and the 3s search fallback must re-arm.
  assert.equal(session.lastFiredValue, null)
  assert.equal(session.hasDecoded, false)
  assert.equal(session.timeoutFired, false)
  assert.equal(session.lastRawValue, null)
  assert.equal(session.consecutiveMatch, 0)
  assert.equal(session.rawDetectionsWithoutStableRead, 0)
  assert.equal(session.frameCounter, 0)
  assert.equal(session.detectionAttempts, 0)
  assert.equal(session.hint, null)
  assert.equal(session.lastBoundingBoxRatio, null)
  assert.equal(session.meanLuma, null)
  // The timeout and the hint window are measured from the restart, not from camera start.
  assert.equal(session.startTime, 5_000)
  assert.equal(session.lastDetectionTime, 5_000)
  assert.equal(session.hintChangedAt, 5_000)
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("restartScanSessionState: re-arms the guards that would block a second scan", () => {
  const session = createScanSessionState()
  session.lastFiredValue = "4006381333931"
  session.hasDecoded = true
  session.timeoutFired = true
  session.lastRawValue = "4006381333931"
  session.consecutiveMatch = 2
  session.rawDetectionsWithoutStableRead = 7
  session.frameCounter = 120
  session.detectionAttempts = 40
  session.hint = "Mehr Licht hilft"
  session.lastBoundingBoxRatio = 0.4
  session.meanLuma = 30

  restartScanSessionState(session, 5_000)

  // The same barcode must be able to fire again, and the 3s search fallback must re-arm.
  assert.equal(session.lastFiredValue, null)
  assert.equal(session.hasDecoded, false)
  assert.equal(session.timeoutFired, false)
  assert.equal(session.lastRawValue, null)
  assert.equal(session.consecutiveMatch, 0)
  assert.equal(session.rawDetectionsWithoutStableRead, 0)
  assert.equal(session.frameCounter, 0)
  assert.equal(session.detectionAttempts, 0)
  assert.equal(session.hint, null)
  assert.equal(session.lastBoundingBoxRatio, null)
  assert.equal(session.meanLuma, null)
  // The timeout and the hint window are measured from the restart, not from camera start.
  assert.equal(session.startTime, 5_000)
  assert.equal(session.lastDetectionTime, 5_000)
  assert.equal(session.hintChangedAt, 5_000)
})
```
const loopReference=session identity cannot be changed by callee. Both assert original session.lastFiredValue=null after sameEAN restart;now1versus5000 onlywrites timestamps, no reset predicate.

## D2: D
Donor: tests/scan-scanner-loop.test.ts:338
```ts
test("streamReleasePlan: during a recovery swap the old stream leaves the new one attached", () => {
  // `recover()` acquires first: the ref and the video already point at the new stream when
  // the old one is released, so releasing it must not detach the live viewfinder.
  const previous: FakeStream = { id: "previous" }
  const next: FakeStream = { id: "next" }
  const plan = streamReleasePlan({ current: next, videoSource: next }, previous)
  assert.equal(plan.clearCurrent, false)
  assert.equal(plan.clearVideoSource, false)
})
```
Keeper before: tests/scan-scanner-loop.test.ts:329
```ts
test("streamReleasePlan: a stale effect instance cannot stop the newer instance's stream", () => {
  // The exact `camera_retry` shape: instance A parked on `await video.play()`, instance B
  // already acquired and attached its own stream. A's bail-out must clear nothing.
  const stale: FakeStream = { id: "stale" }
  const fresh: FakeStream = { id: "fresh" }
  const plan = streamReleasePlan({ current: fresh, videoSource: fresh }, stale)
  assert.deepEqual(plan, { clearCurrent: false, clearVideoSource: false })
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("streamReleasePlan: a stale effect instance cannot stop the newer instance's stream", () => {
  // The exact `camera_retry` shape: instance A parked on `await video.play()`, instance B
  // already acquired and attached its own stream. A's bail-out must clear nothing.
  const stale: FakeStream = { id: "stale" }
  const fresh: FakeStream = { id: "fresh" }
  const plan = streamReleasePlan({ current: fresh, videoSource: fresh }, stale)
  assert.deepEqual(plan, { clearCurrent: false, clearVideoSource: false })
})
```
Both current and videoSource point at objectY; releasedobjectX differs. Ownerreads only strictidentity, neverid strings. KeeperdeepEqual false/false includes both donor equal assertions.

## D3: D
Donor: tests/scan-detection-state.test.ts:278
```ts
test("deriveViewfinderPresentation: the confirm window holds the read look over a fresh spot", () => {
  // The bottle has not moved, so the loop keeps reporting raw hits behind the confirm.
  const presentation = deriveViewfinderPresentation({
    detection: { kind: "spotted", box: boxA },
    confirmBox: boxA,
    confirmActive: true,
    detectionPaused: false,
  })

  assert.equal(presentation.visual, "read")
})
```
Keeper before: tests/scan-detection-state.test.ts:318
```ts
test("deriveViewfinderPresentation: the confirm window keeps the box the decode was read at", () => {
  // The bottle drifts while the result sheet rises: the loop reports a new, different
  // box behind the confirm — the green outline must not follow it.
  const presentation = deriveViewfinderPresentation({
    detection: { kind: "spotted", box: boxB },
    confirmBox: boxA,
    confirmActive: true,
    detectionPaused: false,
  })

  assert.equal(presentation.visual, "read")
  assert.deepEqual(presentation.outlineBox, boxA)
})
```
Keeper after transfer/cut (same callback bytes in both phases):
```ts
test("deriveViewfinderPresentation: the confirm window keeps the box the decode was read at", () => {
  // The bottle drifts while the result sheet rises: the loop reports a new, different
  // box behind the confirm — the green outline must not follow it.
  const presentation = deriveViewfinderPresentation({
    detection: { kind: "spotted", box: boxB },
    confirmBox: boxA,
    confirmActive: true,
    detectionPaused: false,
  })

  assert.equal(presentation.visual, "read")
  assert.deepEqual(presentation.outlineBox, boxA)
})
```
Both confirmActive=true,detectionPaused=false,confirmBox=boxA,kindspotted. NonnullconfirmBox avoids detectionBoxOf, so liveboxAversusB unused. Keeperalready asserts visualread pluscaptured outline.

