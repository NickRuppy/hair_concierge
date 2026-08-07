import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  beginPayPalOneTimeRecoveryCheck,
  cancelPayPalOneTimeRecovery,
  completePayPalOneTimeRecoveryCheck,
  createInitialPayPalOneTimeRecoveryState,
  derivePayPalOneTimeRecoveryView,
  PAYPAL_ONE_TIME_RECOVERY_CHECK_OFFSETS_MS,
  PAYPAL_ONE_TIME_RECOVERY_MANUAL_FLOOR_MS,
  requestManualPayPalOneTimeRecoveryCheck,
  resolvePayPalOneTimeRecoveryHttpResult,
  settlePayPalOneTimeRecoveryRequest,
  settlePayPalOneTimeRecoveryWindow,
  startPayPalOneTimeRecovery,
  type PayPalOneTimeRecoveryEffect,
  type PayPalOneTimeRecoveryState,
} from "../src/lib/checkout/paypal-one-time-recovery"
import { buildPayPalOneTimeWelcomeUrl } from "../src/lib/paypal/welcome-url"

function effectTypes(effects: PayPalOneTimeRecoveryEffect[]) {
  return effects.map((effect) => effect.type)
}

function startWithToken(now = 1_000) {
  return startPayPalOneTimeRecovery(createInitialPayPalOneTimeRecoveryState(), {
    token: "paypal-token-123",
    now,
  })
}

test("terminal recovery carries a non-retryable return state into welcome", () => {
  assert.equal(
    buildPayPalOneTimeWelcomeUrl("paypal token", "failed_permanent"),
    "/welcome?provider=paypal&purchase=one_time&token=paypal+token&return_state=failed_permanent",
  )
  assert.equal(
    buildPayPalOneTimeWelcomeUrl("paypal token"),
    "/welcome?provider=paypal&purchase=one_time&token=paypal+token",
  )
})

function runAutomatic(
  state: PayPalOneTimeRecoveryState,
  index: number,
  status: Parameters<typeof completePayPalOneTimeRecoveryCheck>[1]["result"],
  now = 1_000 + PAYPAL_ONE_TIME_RECOVERY_CHECK_OFFSETS_MS[index],
) {
  const started = beginPayPalOneTimeRecoveryCheck(state, {
    source: "automatic",
    index,
    now,
  })
  assert.deepEqual(effectTypes(started.effects), ["status_check"])
  const statusCheck = started.effects[0]
  assert.equal(statusCheck.type, "status_check")
  return completePayPalOneTimeRecoveryCheck(started.state, {
    source: "automatic",
    index,
    now,
    requestId: statusCheck.requestId,
    result: status,
  })
}

test("token recovery schedules useful absolute 0/3/7s checks inside an 8s window", () => {
  const started = startWithToken()

  assert.equal(started.state.phase, "checking")
  assert.deepEqual(started.effects, [
    { type: "lifecycle", transition: "recovery_started" },
    { type: "schedule_check", dueAt: 1_000, index: 0 },
    { type: "schedule_check", dueAt: 4_000, index: 1 },
    { type: "schedule_check", dueAt: 8_000, index: 2 },
    { type: "schedule_window_deadline", dueAt: 9_000 },
  ])
  const active = runAutomatic(started.state, 0, { ok: true, status: "active" }, 1_000)
  assert.equal(active.state.phase, "navigating")
  assert.equal(active.state.navigationClaimed, true)
  assert.deepEqual(active.effects, [
    { type: "lifecycle", transition: "recovery_succeeded" },
    { type: "navigate", token: "paypal-token-123", outcome: "succeeded" },
  ])

  const duplicateCallback = startPayPalOneTimeRecovery(active.state, {
    token: "paypal-token-123",
    now: 1_200,
  })
  assert.equal(duplicateCallback.state, active.state)
  assert.deepEqual(duplicateCallback.effects, [])

  const lateStatus = completePayPalOneTimeRecoveryCheck(active.state, {
    source: "automatic",
    index: 1,
    now: 4_000,
    requestId: 999,
    result: { ok: true, status: "revoked" },
  })
  assert.equal(lateStatus.state, active.state)
  assert.deepEqual(lateStatus.effects, [])
})

test("pending, network and rate-limit responses remain neutral after the bounded window", () => {
  let state = startWithToken().state

  let result = runAutomatic(state, 0, { ok: true, status: "pending" }, 1_000)
  assert.equal(result.state.phase, "checking")
  assert.deepEqual(result.effects, [])
  state = result.state

  result = runAutomatic(state, 1, { ok: false }, 4_000)
  assert.equal(result.state.phase, "checking")
  assert.deepEqual(result.effects, [])
  state = result.state

  result = runAutomatic(state, 2, { ok: true, status: "pending" }, 8_000)
  assert.equal(result.state.phase, "pending")
  assert.equal(result.state.outcome, "pending")
  assert.equal(result.state.nextManualCheckAt, 8_000 + PAYPAL_ONE_TIME_RECOVERY_MANUAL_FLOOR_MS)
  assert.deepEqual(result.effects, [
    { type: "lifecycle", transition: "recovery_pending" },
    { type: "schedule_manual_enable", dueAt: 11_000 },
    { type: "warning", tokenPresent: true, outcome: "pending" },
  ])

  const earlyManual = requestManualPayPalOneTimeRecoveryCheck(result.state, { now: 10_999 })
  assert.equal(earlyManual.state, result.state)
  assert.deepEqual(earlyManual.effects, [])

  const manual = requestManualPayPalOneTimeRecoveryCheck(result.state, { now: 11_000 })
  assert.equal(manual.state.phase, "checking")
  assert.deepEqual(manual.effects, [
    { type: "status_check", token: "paypal-token-123", requestId: 4, source: "manual" },
    { type: "schedule_request_deadline", dueAt: 19_000, requestId: 4 },
  ])

  const duplicateManual = requestManualPayPalOneTimeRecoveryCheck(manual.state, { now: 12_001 })
  assert.equal(duplicateManual.state, manual.state)
  assert.deepEqual(duplicateManual.effects, [])
})

test("paid pending, revoked, and permanently failed statuses navigate through the same single-flight path", () => {
  const started = startWithToken()

  const paidPending = runAutomatic(started.state, 0, { ok: true, status: "paid_pending" })
  assert.equal(paidPending.state.phase, "navigating")
  assert.deepEqual(paidPending.effects, [
    { type: "lifecycle", transition: "recovery_pending_access" },
    { type: "navigate", token: "paypal-token-123", outcome: "pending_access" },
  ])

  const revokedStart = startWithToken()
  const revoked = runAutomatic(revokedStart.state, 0, { ok: true, status: "revoked" })
  assert.equal(revoked.state.phase, "navigating")
  assert.deepEqual(revoked.effects, [
    { type: "lifecycle", transition: "recovery_revoked" },
    { type: "navigate", token: "paypal-token-123", outcome: "revoked" },
  ])

  const failedStart = startWithToken()
  const failed = runAutomatic(failedStart.state, 0, {
    ok: true,
    status: "failed_permanent",
  })
  assert.equal(failed.state.phase, "navigating")
  assert.deepEqual(failed.effects, [
    { type: "lifecycle", transition: "recovery_failed_permanent" },
    { type: "navigate", token: "paypal-token-123", outcome: "failed_permanent" },
  ])
})

test("HTTP status parsing preserves terminal server truth before response.ok", () => {
  assert.deepEqual(
    resolvePayPalOneTimeRecoveryHttpResult({
      responseOk: false,
      status: "failed_permanent",
    }),
    { ok: true, status: "failed_permanent" },
  )
  assert.deepEqual(
    resolvePayPalOneTimeRecoveryHttpResult({
      responseOk: false,
      status: "revoked",
    }),
    { ok: true, status: "revoked" },
  )
  assert.deepEqual(
    resolvePayPalOneTimeRecoveryHttpResult({
      responseOk: false,
      status: "pending",
    }),
    { ok: false },
  )
  assert.deepEqual(
    resolvePayPalOneTimeRecoveryHttpResult({
      responseOk: true,
      status: "pending",
    }),
    { ok: true, status: "pending" },
  )
  assert.deepEqual(
    resolvePayPalOneTimeRecoveryHttpResult({
      responseOk: false,
      status: "unexpected",
    }),
    { ok: false },
  )
})

test("accepted token recovery warns only if the bounded checks remain unresolved", () => {
  const started = startWithToken()
  assert.equal(started.effects.filter((effect) => effect.type === "warning").length, 0)

  const active = runAutomatic(started.state, 0, { ok: true, status: "active" }, 1_000)
  assert.equal(active.effects.filter((effect) => effect.type === "warning").length, 0)

  const duplicate = startPayPalOneTimeRecovery(active.state, {
    token: "paypal-token-123",
    now: 1_250,
  })
  assert.equal(duplicate.effects.filter((effect) => effect.type === "warning").length, 0)

  const unresolvedStart = startWithToken()
  const unresolved = runAutomatic(unresolvedStart.state, 2, { ok: true, status: "pending" }, 8_000)
  assert.equal(unresolved.effects.filter((effect) => effect.type === "warning").length, 1)
})

test("manual pending rechecks do not repeat the recovery-pending lifecycle", () => {
  const started = startWithToken()
  const pendingResult = runAutomatic(started.state, 2, { ok: true, status: "pending" }, 8_000)
  assert.equal(
    pendingResult.effects.filter(
      (effect) => effect.type === "lifecycle" && effect.transition === "recovery_pending",
    ).length,
    1,
  )

  const manualStarted = requestManualPayPalOneTimeRecoveryCheck(pendingResult.state, {
    now: 11_000,
  })
  const statusCheck = manualStarted.effects.find((effect) => effect.type === "status_check")
  assert.ok(statusCheck && statusCheck.type === "status_check")
  const manualPending = completePayPalOneTimeRecoveryCheck(manualStarted.state, {
    now: 12_100,
    source: "manual",
    requestId: statusCheck.requestId,
    result: { ok: true, status: "pending" },
  })
  assert.equal(
    manualPending.effects.filter(
      (effect) => effect.type === "lifecycle" && effect.transition === "recovery_pending",
    ).length,
    0,
  )
  assert.equal(manualPending.effects.filter((effect) => effect.type === "warning").length, 0)
})

test("a hanging manual recheck settles neutrally and ignores its late response", () => {
  const started = startWithToken()
  const pendingResult = runAutomatic(started.state, 2, { ok: true, status: "pending" }, 8_000)
  const manual = requestManualPayPalOneTimeRecoveryCheck(pendingResult.state, { now: 11_000 })
  const request = manual.effects.find((effect) => effect.type === "status_check")
  assert.ok(request && request.type === "status_check")

  const timedOut = settlePayPalOneTimeRecoveryRequest(manual.state, {
    now: 19_000,
    requestId: request.requestId,
  })
  assert.equal(timedOut.state.phase, "pending")
  assert.deepEqual(timedOut.effects, [
    { type: "abort_status_check", requestId: request.requestId },
    { type: "schedule_manual_enable", dueAt: 22_000 },
  ])

  const late = completePayPalOneTimeRecoveryCheck(timedOut.state, {
    now: 19_100,
    source: "manual",
    requestId: request.requestId,
    result: { ok: true, status: "active" },
  })
  assert.equal(late.state, timedOut.state)
  assert.deepEqual(late.effects, [])
})

test("no-token SDK uncertainty never status-polls and stays neutral", () => {
  const started = startPayPalOneTimeRecovery(createInitialPayPalOneTimeRecoveryState(), {
    token: null,
    now: 2_000,
  })

  assert.equal(started.state.phase, "pending")
  assert.equal(started.state.token, null)
  assert.equal(started.state.outcome, "no_token")
  assert.deepEqual(started.effects, [
    { type: "lifecycle", transition: "recovery_started" },
    { type: "warning", tokenPresent: false, outcome: "no_token" },
  ])
  assert.deepEqual(derivePayPalOneTimeRecoveryView(started.state, { visible: true }), {
    kind: "pending",
    nextManualCheckAt: null,
    manualCheckReady: false,
    outcome: "no_token",
  })

  const manual = requestManualPayPalOneTimeRecoveryCheck(started.state, { now: 5_000 })
  assert.equal(manual.state, started.state)
  assert.deepEqual(manual.effects, [])
})

test("a settled no-token cycle cannot restart without the component reset", () => {
  const noToken = startPayPalOneTimeRecovery(createInitialPayPalOneTimeRecoveryState(), {
    token: null,
    now: 2_000,
  })

  const tokenRetry = startPayPalOneTimeRecovery(noToken.state, {
    token: "paypal-token-123",
    now: 5_000,
  })

  assert.equal(tokenRetry.state, noToken.state)
  assert.deepEqual(tokenRetry.effects, [])
})

test("a long-hanging automatic check skips later ticks and settles at the 8s deadline", () => {
  const started = startWithToken()

  const first = beginPayPalOneTimeRecoveryCheck(started.state, {
    source: "automatic",
    index: 0,
    now: 1_000,
  })
  assert.deepEqual(first.effects, [
    {
      type: "status_check",
      token: "paypal-token-123",
      requestId: 1,
      source: "automatic",
      index: 0,
    },
  ])

  const secondTick = beginPayPalOneTimeRecoveryCheck(first.state, {
    source: "automatic",
    index: 1,
    now: 4_000,
  })
  assert.equal(secondTick.state, first.state)
  assert.deepEqual(secondTick.effects, [])

  const thirdTick = beginPayPalOneTimeRecoveryCheck(first.state, {
    source: "automatic",
    index: 2,
    now: 8_000,
  })
  assert.equal(thirdTick.state, first.state)
  assert.deepEqual(thirdTick.effects, [])

  const settled = settlePayPalOneTimeRecoveryWindow(thirdTick.state, { now: 9_000 })
  assert.equal(settled.state.phase, "pending")
  assert.equal(settled.state.inFlight, false)
  assert.equal(settled.state.inFlightRequestId, null)
  assert.equal(
    settled.state.completedAutomaticChecks,
    PAYPAL_ONE_TIME_RECOVERY_CHECK_OFFSETS_MS.length,
  )
  assert.deepEqual(settled.effects, [
    { type: "abort_status_check", requestId: 1 },
    { type: "lifecycle", transition: "recovery_pending" },
    { type: "schedule_manual_enable", dueAt: 12_000 },
    { type: "warning", tokenPresent: true, outcome: "pending" },
  ])

  const lateSuccess = completePayPalOneTimeRecoveryCheck(settled.state, {
    source: "automatic",
    index: 0,
    requestId: 1,
    now: 9_100,
    result: { ok: true, status: "active" },
  })
  assert.equal(lateSuccess.state, settled.state)
  assert.deepEqual(lateSuccess.effects, [])
})

test("the final automatic check can consume active truth before the 8s deadline", () => {
  let state = startWithToken().state
  state = runAutomatic(state, 0, { ok: true, status: "pending" }, 1_000).state
  state = runAutomatic(state, 1, { ok: true, status: "pending" }, 4_000).state

  const active = runAutomatic(state, 2, { ok: true, status: "active" }, 8_100)
  assert.equal(active.state.phase, "navigating")
  assert.deepEqual(active.effects, [
    { type: "lifecycle", transition: "recovery_succeeded" },
    { type: "navigate", token: "paypal-token-123", outcome: "succeeded" },
  ])
})

test("window deadline settles checking state even when the last scheduled tick is skipped", () => {
  const started = startWithToken()
  const first = beginPayPalOneTimeRecoveryCheck(started.state, {
    source: "automatic",
    index: 0,
    now: 1_000,
  })

  const settled = settlePayPalOneTimeRecoveryWindow(first.state, { now: 9_000 })
  assert.equal(settled.state.phase, "pending")
  assert.equal(settled.state.inFlight, false)
  assert.deepEqual(settled.effects, [
    { type: "abort_status_check", requestId: 1 },
    { type: "lifecycle", transition: "recovery_pending" },
    { type: "schedule_manual_enable", dueAt: 12_000 },
    { type: "warning", tokenPresent: true, outcome: "pending" },
  ])
})

test("manual status view is disabled during cooldown and enabled at the floor", () => {
  const started = startWithToken()
  const pending = runAutomatic(started.state, 2, { ok: true, status: "pending" }, 8_000)

  assert.deepEqual(derivePayPalOneTimeRecoveryView(pending.state, { visible: true, now: 10_999 }), {
    kind: "pending",
    nextManualCheckAt: 11_000,
    manualCheckReady: false,
    outcome: "pending",
  })
  assert.deepEqual(derivePayPalOneTimeRecoveryView(pending.state, { visible: true, now: 11_000 }), {
    kind: "pending",
    nextManualCheckAt: 11_000,
    manualCheckReady: true,
    outcome: "pending",
  })
})

test("PayPal recovery reset clears all recovery timers, cooldown timer, and abort controller", () => {
  const source = readFileSync("src/components/checkout/paypal-one-time-button.tsx", "utf8")

  assert.match(
    source,
    /function resetPayPalRecovery\(\) \{[\s\S]*recoveryTimersRef\.current\.clear\(\)/,
  )
  assert.match(
    source,
    /function resetPayPalRecovery\(\) \{[\s\S]*manualCooldownTimerRef\.current !== null/,
  )
  assert.match(
    source,
    /function resetPayPalRecovery\(\) \{[\s\S]*recoveryAbortRef\.current\?\.controller\.abort\(\)/,
  )
  assert.match(
    source,
    /function resetPayPalRecovery\(\) \{[\s\S]*createInitialPayPalOneTimeRecoveryState\(\)/,
  )
  assert.match(
    source,
    /createOrder=\{async \(\) => \{[\s\S]*resetPayPalRecovery\(\)[\s\S]*intentTokenRef\.current = null[\s\S]*setRecoveryView\(null\)/,
  )
  assert.match(
    source,
    /function claimWelcomeNavigation\(url: string\) \{[\s\S]*manualCooldownTimerRef\.current !== null/,
  )
  assert.match(
    source,
    /function claimWelcomeNavigation\(url: string\) \{[\s\S]*recoveryAbortRef\.current\?\.controller\.abort\(\)/,
  )
  assert.match(source, /onError=\{\(paypalError\) => \{\s*if \(!visibleRef\.current\) return/)
  assert.match(
    source,
    /function claimWelcomeNavigation\(url: string\) \{[\s\S]*if \(!visibleRef\.current\) \{[\s\S]*deferredWelcomeUrlRef\.current = url[\s\S]*return false/,
  )
  assert.match(
    source,
    /useEffect\(\(\) => \{[\s\S]*if \(visible && deferredWelcomeUrlRef\.current\)[\s\S]*claimWelcomeNavigation\(url\)/,
  )
})

test("PayPal recovery poll uses HTTP parser and no-token SDK failures keep provider-load telemetry", () => {
  const source = readFileSync("src/components/checkout/paypal-one-time-button.tsx", "utf8")
  const pollBlock = source.slice(
    source.indexOf("async function pollPayPalRecoveryStatus"),
    source.indexOf("function startPayPalSdkErrorRecovery"),
  )
  const sdkRecoveryBlock = source.slice(
    source.indexOf("function startPayPalSdkErrorRecovery"),
    source.indexOf("if (expired)"),
  )

  assert.match(
    pollBlock,
    /resolvePayPalOneTimeRecoveryHttpResult\(\{[\s\S]*responseOk: response\.ok,[\s\S]*status: body\.status/,
  )
  assert.doesNotMatch(pollBlock, /response\.ok &&/)

  assert.match(sdkRecoveryBlock, /const token = intentTokenRef\.current/)
  assert.match(
    sdkRecoveryBlock,
    /if \(!token && recoveryStateRef\.current\.phase === "idle"\) \{[\s\S]*status: "paypal_button_error"/,
  )
  assert.match(
    sdkRecoveryBlock,
    /if \(!token && recoveryStateRef\.current\.phase === "idle"\) \{[\s\S]*transition: "provider_load_error"/,
  )
  assert.match(sdkRecoveryBlock, /Token-backed popup[\s\S]*recovery poller/)
  assert.match(
    sdkRecoveryBlock,
    /startPayPalOneTimeRecovery\(recoveryStateRef\.current,[\s\S]*token,/,
  )
})

test("hidden state suppresses only visual output and cancellation stops late checks", () => {
  const started = startWithToken()

  assert.equal(derivePayPalOneTimeRecoveryView(started.state, { visible: false }), null)
  assert.deepEqual(derivePayPalOneTimeRecoveryView(started.state, { visible: true }), {
    kind: "checking",
  })

  const cancelled = cancelPayPalOneTimeRecovery(started.state)
  assert.equal(cancelled.state.phase, "cancelled")

  const lateBegin = beginPayPalOneTimeRecoveryCheck(cancelled.state, {
    source: "automatic",
    index: 0,
    now: 1_000,
  })
  assert.equal(lateBegin.state, cancelled.state)
  assert.deepEqual(lateBegin.effects, [])
})

test("PayPal onError clears busy before ignored SDK-error branches", () => {
  const source = readFileSync("src/components/checkout/paypal-one-time-button.tsx", "utf8")
  const onErrorBlock = source.match(/onError=\{\(paypalError\) => \{([\s\S]*?)\n\s*\}\}/)?.[1]

  assert.ok(onErrorBlock)
  assert.match(
    onErrorBlock,
    /setBusy\(false\)[\s\S]*if \(suppressNextPayPalErrorRef\.current\)[\s\S]*paypalError\.message === "checkout access already exists"/,
  )
})
