export const PAYPAL_ONE_TIME_RECOVERY_CHECK_OFFSETS_MS = [0, 3_000, 7_000] as const
export const PAYPAL_ONE_TIME_RECOVERY_WINDOW_MS = 8_000
export const PAYPAL_ONE_TIME_RECOVERY_MANUAL_FLOOR_MS = 3_000
export const PAYPAL_ONE_TIME_RECOVERY_MANUAL_TIMEOUT_MS = 8_000

export type PayPalOneTimeRecoveryStatus =
  | "active"
  | "paid_pending"
  | "pending"
  | "revoked"
  | "failed_permanent"

export type PayPalOneTimeRecoveryOutcome =
  | "not_started"
  | "no_token"
  | "pending"
  | "pending_access"
  | "succeeded"
  | "failed_permanent"
  | "revoked"

export type PayPalOneTimeRecoveryPhase =
  | "idle"
  | "checking"
  | "pending"
  | "navigating"
  | "cancelled"

export type PayPalOneTimeRecoveryNavigationOutcome =
  | "succeeded"
  | "pending_access"
  | "failed_permanent"
  | "revoked"

export interface PayPalOneTimeRecoveryState {
  phase: PayPalOneTimeRecoveryPhase
  token: string | null
  startedAt: number | null
  inFlight: boolean
  inFlightRequestId: number | null
  nextRequestId: number
  completedAutomaticChecks: number
  nextManualCheckAt: number | null
  warningCaptured: boolean
  pendingLifecycleCaptured: boolean
  navigationClaimed: boolean
  outcome: PayPalOneTimeRecoveryOutcome
}

export type PayPalOneTimeRecoveryEffect =
  | { type: "schedule_check"; dueAt: number; index: number }
  | { type: "schedule_window_deadline"; dueAt: number }
  | { type: "schedule_manual_enable"; dueAt: number }
  | { type: "schedule_request_deadline"; dueAt: number; requestId: number }
  | {
      type: "status_check"
      token: string
      requestId: number
      source: "automatic" | "manual"
      index?: number
    }
  | { type: "abort_status_check"; requestId: number }
  | {
      type: "navigate"
      token: string
      outcome: PayPalOneTimeRecoveryNavigationOutcome
    }
  | { type: "warning"; tokenPresent: boolean; outcome: PayPalOneTimeRecoveryOutcome }
  | {
      type: "lifecycle"
      transition:
        | "recovery_started"
        | "recovery_pending"
        | "recovery_pending_access"
        | "recovery_succeeded"
        | "recovery_failed_permanent"
        | "recovery_revoked"
    }

export type PayPalOneTimeRecoveryView =
  | { kind: "idle" }
  | { kind: "checking" }
  | {
      kind: "pending"
      nextManualCheckAt: number | null
      manualCheckReady: boolean
      outcome: PayPalOneTimeRecoveryOutcome
    }
  | {
      kind: "navigating"
      outcome: PayPalOneTimeRecoveryNavigationOutcome
    }

export function createInitialPayPalOneTimeRecoveryState(): PayPalOneTimeRecoveryState {
  return {
    phase: "idle",
    token: null,
    startedAt: null,
    inFlight: false,
    inFlightRequestId: null,
    nextRequestId: 1,
    completedAutomaticChecks: 0,
    nextManualCheckAt: null,
    warningCaptured: false,
    pendingLifecycleCaptured: false,
    navigationClaimed: false,
    outcome: "not_started",
  }
}

export function startPayPalOneTimeRecovery(
  state: PayPalOneTimeRecoveryState,
  input: { token: string | null; now: number },
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  if (state.phase !== "idle") return { state, effects: [] }

  if (!input.token) {
    const next: PayPalOneTimeRecoveryState = {
      ...state,
      phase: "pending",
      startedAt: input.now,
      outcome: "no_token",
      warningCaptured: true,
    }
    return {
      state: next,
      effects: [
        { type: "lifecycle", transition: "recovery_started" },
        { type: "warning", tokenPresent: false, outcome: "no_token" },
      ],
    }
  }

  const next: PayPalOneTimeRecoveryState = {
    ...state,
    phase: "checking",
    token: input.token,
    startedAt: input.now,
    completedAutomaticChecks: 0,
    nextManualCheckAt: null,
    outcome: "pending",
    warningCaptured: false,
    pendingLifecycleCaptured: false,
  }
  return {
    state: next,
    effects: [
      { type: "lifecycle", transition: "recovery_started" },
      ...PAYPAL_ONE_TIME_RECOVERY_CHECK_OFFSETS_MS.map((offset, index) => ({
        type: "schedule_check" as const,
        dueAt: input.now + offset,
        index,
      })),
      {
        type: "schedule_window_deadline",
        dueAt: input.now + PAYPAL_ONE_TIME_RECOVERY_WINDOW_MS,
      },
    ],
  }
}

export function beginPayPalOneTimeRecoveryCheck(
  state: PayPalOneTimeRecoveryState,
  input: { now: number; source: "automatic" | "manual"; index?: number },
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  if (!canCheck(state)) return { state, effects: [] }
  if (
    input.source === "manual" &&
    state.nextManualCheckAt !== null &&
    input.now < state.nextManualCheckAt
  ) {
    return { state, effects: [] }
  }
  const requestId = state.nextRequestId
  const next = {
    ...state,
    phase: "checking" as const,
    inFlight: true,
    inFlightRequestId: requestId,
    nextRequestId: requestId + 1,
  }
  return {
    state: next,
    effects: [
      {
        type: "status_check",
        token: state.token,
        requestId,
        source: input.source,
        ...(input.index === undefined ? {} : { index: input.index }),
      },
    ],
  }
}

export function completePayPalOneTimeRecoveryCheck(
  state: PayPalOneTimeRecoveryState,
  input:
    | {
        now: number
        source: "automatic"
        index: number
        requestId: number
        result: { ok: true; status: PayPalOneTimeRecoveryStatus } | { ok: false }
      }
    | {
        now: number
        source: "manual"
        requestId: number
        result: { ok: true; status: PayPalOneTimeRecoveryStatus } | { ok: false }
      },
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  if (
    state.phase === "navigating" ||
    state.phase === "cancelled" ||
    !state.token ||
    !state.inFlight ||
    state.inFlightRequestId !== input.requestId
  ) {
    return { state, effects: [] }
  }

  const completedAutomaticChecks =
    input.source === "automatic"
      ? Math.max(state.completedAutomaticChecks, input.index + 1)
      : state.completedAutomaticChecks
  const base: PayPalOneTimeRecoveryState & { token: string } = {
    ...state,
    token: state.token,
    inFlight: false,
    inFlightRequestId: null,
    completedAutomaticChecks,
  }

  if (input.result.ok) {
    const terminal = terminalStatusOutcome(input.result.status)
    if (terminal) return navigate(base, terminal)
  }

  if (
    input.source === "automatic" &&
    completedAutomaticChecks < PAYPAL_ONE_TIME_RECOVERY_CHECK_OFFSETS_MS.length
  ) {
    return { state: base, effects: [] }
  }

  return pending(base, input.now)
}

export function resolvePayPalOneTimeRecoveryHttpResult(input: {
  responseOk: boolean
  status: unknown
}): { ok: true; status: PayPalOneTimeRecoveryStatus } | { ok: false } {
  if (!isPayPalRecoveryStatus(input.status)) return { ok: false }
  if (terminalStatusOutcome(input.status)) return { ok: true, status: input.status }
  if (input.responseOk) return { ok: true, status: input.status }
  return { ok: false }
}

export function requestManualPayPalOneTimeRecoveryCheck(
  state: PayPalOneTimeRecoveryState,
  input: { now: number },
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  const started = beginPayPalOneTimeRecoveryCheck(state, { now: input.now, source: "manual" })
  const request = started.effects.find((effect) => effect.type === "status_check")
  if (!request || request.type !== "status_check") return started
  return {
    state: started.state,
    effects: [
      ...started.effects,
      {
        type: "schedule_request_deadline",
        dueAt: input.now + PAYPAL_ONE_TIME_RECOVERY_MANUAL_TIMEOUT_MS,
        requestId: request.requestId,
      },
    ],
  }
}

export function settlePayPalOneTimeRecoveryRequest(
  state: PayPalOneTimeRecoveryState,
  input: { now: number; requestId: number },
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  if (!state.inFlight || state.inFlightRequestId !== input.requestId) {
    return { state, effects: [] }
  }
  const settled = pending({ ...state, inFlight: false, inFlightRequestId: null }, input.now)
  return {
    state: settled.state,
    effects: [{ type: "abort_status_check", requestId: input.requestId }, ...settled.effects],
  }
}

export function cancelPayPalOneTimeRecovery(state: PayPalOneTimeRecoveryState): {
  state: PayPalOneTimeRecoveryState
  effects: PayPalOneTimeRecoveryEffect[]
} {
  return {
    state: { ...state, phase: "cancelled", inFlight: false, inFlightRequestId: null },
    effects:
      state.inFlight && state.inFlightRequestId !== null
        ? [{ type: "abort_status_check", requestId: state.inFlightRequestId }]
        : [],
  }
}

export function settlePayPalOneTimeRecoveryWindow(
  state: PayPalOneTimeRecoveryState,
  input: { now: number },
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  if (
    state.phase === "idle" ||
    state.phase === "pending" ||
    state.phase === "navigating" ||
    state.phase === "cancelled"
  ) {
    return { state, effects: [] }
  }
  const abortEffect =
    state.inFlight && state.inFlightRequestId !== null
      ? [{ type: "abort_status_check" as const, requestId: state.inFlightRequestId }]
      : []
  const settled = pending(
    {
      ...state,
      inFlight: false,
      inFlightRequestId: null,
      completedAutomaticChecks: PAYPAL_ONE_TIME_RECOVERY_CHECK_OFFSETS_MS.length,
    },
    input.now,
  )
  return { state: settled.state, effects: [...abortEffect, ...settled.effects] }
}

export function derivePayPalOneTimeRecoveryView(
  state: PayPalOneTimeRecoveryState,
  options: { visible: boolean; now?: number },
): PayPalOneTimeRecoveryView | null {
  if (!options.visible) return null
  if (state.phase === "checking") return { kind: "checking" }
  if (state.phase === "pending") {
    return {
      kind: "pending",
      nextManualCheckAt: state.nextManualCheckAt,
      manualCheckReady:
        Boolean(state.token) &&
        (state.nextManualCheckAt === null ||
          (options.now ?? Date.now()) >= state.nextManualCheckAt),
      outcome: state.outcome,
    }
  }
  if (state.phase === "navigating") {
    if (!isNavigationOutcome(state.outcome)) return { kind: "idle" }
    return { kind: "navigating", outcome: state.outcome }
  }
  return { kind: "idle" }
}

function canCheck(
  state: PayPalOneTimeRecoveryState,
): state is PayPalOneTimeRecoveryState & { token: string } {
  return (
    (state.phase === "checking" || state.phase === "pending") &&
    Boolean(state.token) &&
    !state.inFlight &&
    !state.navigationClaimed
  )
}

function isPayPalRecoveryStatus(value: unknown): value is PayPalOneTimeRecoveryStatus {
  return (
    value === "active" ||
    value === "paid_pending" ||
    value === "pending" ||
    value === "revoked" ||
    value === "failed_permanent"
  )
}

function terminalStatusOutcome(
  status: PayPalOneTimeRecoveryStatus,
): PayPalOneTimeRecoveryNavigationOutcome | null {
  if (status === "active") return "succeeded"
  if (status === "paid_pending") return "pending_access"
  if (status === "failed_permanent") return "failed_permanent"
  if (status === "revoked") return "revoked"
  return null
}

function lifecycleForOutcome(
  outcome: PayPalOneTimeRecoveryNavigationOutcome,
): Extract<PayPalOneTimeRecoveryEffect, { type: "lifecycle" }>["transition"] {
  if (outcome === "succeeded") return "recovery_succeeded"
  if (outcome === "pending_access") return "recovery_pending_access"
  if (outcome === "failed_permanent") return "recovery_failed_permanent"
  return "recovery_revoked"
}

function recoveryOutcomeForNavigation(
  outcome: PayPalOneTimeRecoveryNavigationOutcome,
): PayPalOneTimeRecoveryOutcome {
  return outcome
}

function isNavigationOutcome(
  outcome: PayPalOneTimeRecoveryOutcome,
): outcome is PayPalOneTimeRecoveryNavigationOutcome {
  return (
    outcome === "succeeded" ||
    outcome === "pending_access" ||
    outcome === "failed_permanent" ||
    outcome === "revoked"
  )
}

function navigate(
  state: PayPalOneTimeRecoveryState & { token: string },
  outcome: PayPalOneTimeRecoveryNavigationOutcome,
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  const recoveryOutcome = recoveryOutcomeForNavigation(outcome)
  const next: PayPalOneTimeRecoveryState = {
    ...state,
    phase: "navigating",
    outcome: recoveryOutcome,
    navigationClaimed: true,
    warningCaptured: state.warningCaptured,
  }
  return {
    state: next,
    effects: [
      { type: "lifecycle", transition: lifecycleForOutcome(outcome) },
      { type: "navigate", token: state.token, outcome },
    ],
  }
}

function pending(
  state: PayPalOneTimeRecoveryState,
  now: number,
): { state: PayPalOneTimeRecoveryState; effects: PayPalOneTimeRecoveryEffect[] } {
  const next: PayPalOneTimeRecoveryState = {
    ...state,
    phase: "pending",
    inFlight: false,
    inFlightRequestId: null,
    outcome: "pending",
    nextManualCheckAt: now + PAYPAL_ONE_TIME_RECOVERY_MANUAL_FLOOR_MS,
    warningCaptured: true,
    pendingLifecycleCaptured: true,
  }
  return {
    state: next,
    effects: [
      ...(state.pendingLifecycleCaptured
        ? []
        : [{ type: "lifecycle" as const, transition: "recovery_pending" as const }]),
      { type: "schedule_manual_enable", dueAt: now + PAYPAL_ONE_TIME_RECOVERY_MANUAL_FLOOR_MS },
      ...(state.warningCaptured
        ? []
        : [
            {
              type: "warning" as const,
              tokenPresent: Boolean(state.token),
              outcome: "pending" as const,
            },
          ]),
    ],
  }
}
