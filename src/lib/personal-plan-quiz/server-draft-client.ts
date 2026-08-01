import { sanitizePersonalPlanQuizAnswers } from "./draft"
import type {
  PersonalPlanQuizAnswers,
  PersonalPlanQuizDraft,
  PersonalPlanQuizResumeBootstrap,
  PersonalPlanQuizScreenId,
  PersonalPlanQuizServerSnapshot,
} from "./types"

export const PERSONAL_PLAN_QUIZ_RESUME_TOKEN_PARAM = "resume_token"
export const PERSONAL_PLAN_QUIZ_SERVER_DRAFT_API_PATH = "/api/quiz/personal-plan-draft"
export const PERSONAL_PLAN_QUIZ_SERVER_DRAFT_VERSION = 4 as const

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>

type BrowserHistoryLike = {
  state: unknown
  pushState: (state: unknown, title: string, url?: string | URL | null) => void
  replaceState: (state: unknown, title: string, url?: string | URL | null) => void
}

type BrowserLocationLike = Pick<Location, "href">

type BrowserWindowLike = {
  fetch: FetchLike
  history: BrowserHistoryLike
  location: BrowserLocationLike
}

export type PersonalPlanQuizServerDraftPayload = {
  version: typeof PERSONAL_PLAN_QUIZ_SERVER_DRAFT_VERSION
  screen: PersonalPlanQuizScreenId
  history: PersonalPlanQuizScreenId[]
  answers: PersonalPlanQuizAnswers
  expectedRevision?: number
  allowRevisionCatchup?: true
}

export type PersonalPlanQuizServerDraftSaveResult =
  | {
      status: "created" | "saved"
      draftId: string
      revision: number
      browserGeneration: number
      resumeToken?: string
    }
  | { status: "disabled" | "retryable" | "stale" | "failed" }

export type PersonalPlanQuizRestoreChoice =
  | { source: "none"; draft: null }
  | { source: "local"; draft: PersonalPlanQuizDraft }
  | { source: "server"; draft: PersonalPlanQuizDraft }

export function buildPersonalPlanQuizServerDraftPayload(
  draft: PersonalPlanQuizDraft,
  expectedRevision?: number,
  options?: { allowRevisionCatchup?: boolean },
): PersonalPlanQuizServerDraftPayload {
  const safeExpectedRevision =
    typeof expectedRevision === "number" &&
    Number.isSafeInteger(expectedRevision) &&
    expectedRevision >= 0
      ? expectedRevision
      : undefined
  return {
    version: PERSONAL_PLAN_QUIZ_SERVER_DRAFT_VERSION,
    screen: draft.screen,
    history: draft.history,
    answers: sanitizePersonalPlanQuizAnswers(draft.answers),
    ...(safeExpectedRevision !== undefined ? { expectedRevision: safeExpectedRevision } : {}),
    ...(options?.allowRevisionCatchup === true ? { allowRevisionCatchup: true } : {}),
  }
}

export function hasPersonalPlanQuizDurableAnswer(answers: PersonalPlanQuizAnswers): boolean {
  return Object.keys(sanitizePersonalPlanQuizAnswers(answers)).length > 0
}

export function withPersonalPlanQuizServerMetadata(
  draft: PersonalPlanQuizDraft,
  metadata: { draftId?: string; revision?: number; browserGeneration?: number },
): PersonalPlanQuizDraft {
  const serverDraftId =
    typeof metadata.draftId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      metadata.draftId,
    )
      ? metadata.draftId
      : undefined
  const serverRevision =
    typeof metadata.revision === "number" &&
    Number.isSafeInteger(metadata.revision) &&
    metadata.revision >= 0
      ? metadata.revision
      : undefined
  const browserGeneration =
    typeof metadata.browserGeneration === "number" &&
    Number.isSafeInteger(metadata.browserGeneration) &&
    metadata.browserGeneration >= 0
      ? metadata.browserGeneration
      : undefined
  return {
    screen: draft.screen,
    history: draft.history,
    answers: sanitizePersonalPlanQuizAnswers(draft.answers),
    ...(serverDraftId ? { serverDraftId } : {}),
    ...(serverRevision !== undefined ? { serverRevision } : {}),
    ...(browserGeneration !== undefined ? { browserGeneration } : {}),
  }
}

export function choosePersonalPlanQuizResumeDraft(
  localDraft: PersonalPlanQuizDraft | null,
  serverSnapshot: PersonalPlanQuizServerSnapshot | null | undefined,
): PersonalPlanQuizRestoreChoice {
  if (!serverSnapshot) {
    return localDraft ? { source: "local", draft: localDraft } : { source: "none", draft: null }
  }

  const serverDraft = withPersonalPlanQuizServerMetadata(serverSnapshot.draft, {
    draftId: serverSnapshot.draftId,
    revision: serverSnapshot.revision,
    browserGeneration: serverSnapshot.browserGeneration,
  })
  if (!localDraft) return { source: "server", draft: serverDraft }

  const localDraftId = localDraft.serverDraftId
  const localGeneration = localDraft.browserGeneration
  const localRevision = localDraft.serverRevision
  if (localDraftId !== serverSnapshot.draftId) {
    return { source: "server", draft: serverDraft }
  }
  if (
    typeof localGeneration === "number" &&
    Number.isSafeInteger(localGeneration) &&
    typeof localRevision === "number" &&
    Number.isSafeInteger(localRevision)
  ) {
    if (
      localGeneration === serverSnapshot.browserGeneration &&
      localRevision === serverSnapshot.revision
    ) {
      return { source: "local", draft: localDraft }
    }

    if (
      serverSnapshot.browserGeneration > localGeneration ||
      (serverSnapshot.browserGeneration === localGeneration &&
        serverSnapshot.revision > localRevision)
    ) {
      return { source: "server", draft: serverDraft }
    }
  }

  return { source: "local", draft: localDraft }
}

export function buildPersonalPlanQuizResumeUrl(href: string, resumeToken: string | null): string {
  const url = new URL(href)
  if (resumeToken) {
    url.searchParams.set(PERSONAL_PLAN_QUIZ_RESUME_TOKEN_PARAM, resumeToken)
  } else {
    url.searchParams.delete(PERSONAL_PLAN_QUIZ_RESUME_TOKEN_PARAM)
  }
  return url.toString()
}

export function replacePersonalPlanQuizResumeTokenInCurrentUrl(
  resumeToken: string,
  win: Pick<BrowserWindowLike, "history" | "location"> = window,
): void {
  win.history.replaceState(
    win.history.state,
    "",
    buildPersonalPlanQuizResumeUrl(win.location.href, resumeToken),
  )
}

export function stripPersonalPlanQuizResumeTokenFromCurrentUrl(
  win: Pick<BrowserWindowLike, "history" | "location"> = window,
): void {
  win.history.replaceState(
    win.history.state,
    "",
    buildPersonalPlanQuizResumeUrl(win.location.href, null),
  )
}

export function pushPersonalPlanQuizHistoryState(
  state: unknown,
  win: Pick<BrowserWindowLike, "history" | "location"> = window,
): void {
  win.history.pushState(state, "", win.location.href)
}

export function shouldFlushPersonalPlanQuizDraftOnPageHide(
  event: Pick<PageTransitionEvent, "persisted">,
): boolean {
  return !event.persisted
}

export async function interpretPersonalPlanQuizServerDraftResponse(
  response: Pick<Response, "ok" | "status" | "json">,
): Promise<PersonalPlanQuizServerDraftSaveResult> {
  if (response.status === 404) return { status: "disabled" }
  if (response.status === 202 || response.status === 429 || response.status >= 500) {
    return { status: "retryable" }
  }
  if (response.status === 409) return { status: "stale" }
  if (!response.ok) return { status: "failed" }

  const payload: unknown = await response.json().catch(() => null)
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { status: "failed" }
  const data = payload as Record<string, unknown>
  const status = data.status === "created" || data.status === "saved" ? data.status : null
  if (
    !status ||
    typeof data.draftId !== "string" ||
    !Number.isSafeInteger(data.revision) ||
    (data.revision as number) < 0 ||
    !Number.isSafeInteger(data.browserGeneration) ||
    (data.browserGeneration as number) < 0
  ) {
    return { status: "failed" }
  }

  return {
    status,
    draftId: data.draftId,
    revision: data.revision as number,
    browserGeneration: data.browserGeneration as number,
    ...(typeof data.resumeToken === "string" && data.resumeToken
      ? { resumeToken: data.resumeToken }
      : {}),
  }
}

export type PersonalPlanQuizServerDraftSession = {
  readonly enabled: boolean
  readonly stale: boolean
  getMetadata: () => { draftId?: string; revision?: number; browserGeneration?: number }
  queueSave: (draft: PersonalPlanQuizDraft) => void
  flushKeepalive: (draft: PersonalPlanQuizDraft) => void
  revoke: () => Promise<void>
}

export function createPersonalPlanQuizServerDraftSession({
  bootstrap,
  onMetadata,
  win = window,
}: {
  bootstrap: PersonalPlanQuizResumeBootstrap
  onMetadata?: (metadata: { draftId: string; revision: number; browserGeneration: number }) => void
  win?: BrowserWindowLike
}): PersonalPlanQuizServerDraftSession {
  let enabled = bootstrap.enabled
  let stale = false
  let draftId = bootstrap.snapshot?.draftId
  let revision = bootstrap.snapshot?.revision
  let browserGeneration = bootstrap.snapshot?.browserGeneration
  let inFlight = false
  let pending: PersonalPlanQuizDraft | null = null
  let retryCount = 0
  let startedSequence = 0
  let acceptedSequence = 0
  let unloadFlushStarted = false

  function applySuccessfulResult(
    result: Extract<PersonalPlanQuizServerDraftSaveResult, { status: "created" | "saved" }>,
    sequence: number,
  ) {
    if (sequence < acceptedSequence) return
    acceptedSequence = Math.max(acceptedSequence, sequence)
    retryCount = 0
    draftId = result.draftId
    revision = result.revision
    browserGeneration = result.browserGeneration
    onMetadata?.({ draftId, revision, browserGeneration })
    if (result.resumeToken) {
      replacePersonalPlanQuizResumeTokenInCurrentUrl(result.resumeToken, win)
    }
  }

  async function send(draft: PersonalPlanQuizDraft): Promise<void> {
    if (!enabled || stale || !hasPersonalPlanQuizDurableAnswer(draft.answers)) return
    const sequence = ++startedSequence
    const expectedRevision = Number.isSafeInteger(revision) ? revision : undefined
    let result: PersonalPlanQuizServerDraftSaveResult
    try {
      result = await interpretPersonalPlanQuizServerDraftResponse(
        await win.fetch(PERSONAL_PLAN_QUIZ_SERVER_DRAFT_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPersonalPlanQuizServerDraftPayload(draft, expectedRevision)),
        }),
      )
    } catch {
      result = { status: "retryable" }
    }

    if (result.status === "disabled") {
      if (sequence < acceptedSequence) return
      enabled = false
      stripPersonalPlanQuizResumeTokenFromCurrentUrl(win)
      return
    }
    if (result.status === "stale") {
      if (sequence < acceptedSequence || sequence < startedSequence) return
      stale = true
      stripPersonalPlanQuizResumeTokenFromCurrentUrl(win)
      return
    }
    if (result.status === "retryable") {
      if (sequence < acceptedSequence || sequence < startedSequence) return
      if (retryCount < 2) {
        retryCount += 1
        await new Promise((resolve) => setTimeout(resolve, 250 * retryCount))
        pending = pending ?? draft
      }
      return
    }
    if (result.status !== "created" && result.status !== "saved") return

    applySuccessfulResult(result, sequence)
  }

  async function drain(): Promise<void> {
    if (inFlight) return
    inFlight = true
    try {
      while (pending && enabled && !stale && !unloadFlushStarted) {
        const draft = pending
        pending = null
        await send(draft)
      }
    } finally {
      inFlight = false
    }
  }

  return {
    get enabled() {
      return enabled
    },
    get stale() {
      return stale
    },
    getMetadata() {
      return { draftId, revision, browserGeneration }
    },
    queueSave(draft) {
      if (
        !enabled ||
        stale ||
        unloadFlushStarted ||
        !hasPersonalPlanQuizDurableAnswer(draft.answers)
      )
        return
      pending = draft
      void drain()
    },
    flushKeepalive(draft) {
      if (
        !enabled ||
        stale ||
        unloadFlushStarted ||
        !hasPersonalPlanQuizDurableAnswer(draft.answers)
      )
        return
      unloadFlushStarted = true
      // This payload is the latest state. Do not let an older queued autosave
      // start after the terminal unload write and recreate the revision race.
      pending = null
      const sequence = ++startedSequence
      const expectedRevision = Number.isSafeInteger(revision) ? revision : undefined
      void win
        .fetch(PERSONAL_PLAN_QUIZ_SERVER_DRAFT_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildPersonalPlanQuizServerDraftPayload(draft, expectedRevision, {
              allowRevisionCatchup: true,
            }),
          ),
          keepalive: true,
        })
        .then(interpretPersonalPlanQuizServerDraftResponse)
        .then((result) => {
          if (result.status === "created" || result.status === "saved") {
            applySuccessfulResult(result, sequence)
            return
          }
          if (result.status === "disabled") {
            if (sequence < acceptedSequence) return
            enabled = false
            stripPersonalPlanQuizResumeTokenFromCurrentUrl(win)
            return
          }
          if (result.status === "stale") {
            if (sequence < acceptedSequence || sequence < startedSequence) return
            stale = true
            stripPersonalPlanQuizResumeTokenFromCurrentUrl(win)
          }
        })
        .catch(() => undefined)
    },
    async revoke() {
      if (!enabled) return
      enabled = false
      try {
        await win.fetch(PERSONAL_PLAN_QUIZ_SERVER_DRAFT_API_PATH, {
          method: "DELETE",
          keepalive: true,
        })
      } catch {
        // Draft revocation is best effort; completion still clears local state and URL token.
      }
    },
  }
}
