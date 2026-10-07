import {
  Stage2RefinementError,
  type Stage2CompleteResult,
  type Stage2RefinementErrorCode,
  type Stage2RefinementGateway,
  type Stage2SaveAndCompleteModuleResult,
  type Stage2SaveAndCompleteResult,
  type Stage2SaveAnswerInput,
} from "./gateway"
import type { Stage2Module } from "./types"
import type { Stage2RefinementSession } from "./session"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export function createHttpStage2RefinementGateway({
  fetch: fetcher = fetch,
}: { fetch?: FetchLike } = {}): Stage2RefinementGateway {
  return {
    async openOptionalRefinement(module: Stage2Module) {
      return request<Stage2RefinementSession>(
        fetcher,
        "/api/personal-plan/stage-2/optional-entry",
        jsonRequest("POST", { module }),
        "stage2_optional_entry",
      )
    },
    async load() {
      return request<Stage2RefinementSession>(
        fetcher,
        "/api/personal-plan/stage-2",
        { method: "GET" },
        "stage2_load",
      )
    },
    async saveAnswer(input: Stage2SaveAnswerInput) {
      return request<Stage2RefinementSession>(
        fetcher,
        "/api/personal-plan/stage-2",
        jsonRequest("PATCH", input),
        "stage2_answer_save",
      )
    },
    async saveAnswerAndComplete(input: Stage2SaveAnswerInput) {
      return request<Stage2SaveAndCompleteResult>(
        fetcher,
        "/api/personal-plan/stage-2",
        jsonRequest("PATCH", { ...input, completeAfterSave: true }),
        "stage2_final_save_complete",
      )
    },
    async saveAnswerAndCompleteModule({
      module: stage2Module,
      ...input
    }: Stage2SaveAnswerInput & { module: Stage2Module }) {
      // `request` returns the response body verbatim (cast, not re-shaped), so
      // `moduleCompletion.recompute` (T1.4's habits-recompute outcome) already
      // passes through untouched when present, and stays `undefined` when the
      // server omits it — no extra parsing needed for T2.2's honest toast to
      // see the real outcome.
      return request<Stage2SaveAndCompleteModuleResult>(
        fetcher,
        "/api/personal-plan/stage-2",
        jsonRequest("PATCH", { ...input, completeModuleAfterSave: stage2Module }),
        "stage2_module_save_complete",
      )
    },
    async complete(input: { expectedRevision: number }) {
      return request<Stage2CompleteResult>(
        fetcher,
        "/api/personal-plan/stage-2/complete",
        jsonRequest("POST", input),
        "stage2_complete_retry",
      )
    },
  }
}

function jsonRequest(method: "PATCH" | "POST", body: unknown): RequestInit {
  return {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

async function request<T>(
  fetcher: FetchLike,
  url: string,
  init: RequestInit,
  operation: string,
): Promise<T> {
  const startedAt = performance.now()
  let response: Response
  try {
    response = await fetcher(url, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
      cache: "no-store",
    })
  } catch {
    reportPersonalPlanTransitionTiming({
      layer: "client",
      operation,
      outcome: "network_error",
      durationMs: performance.now() - startedAt,
    })
    throw new Stage2RefinementError("temporarily_unavailable")
  }
  const body = await response.json().catch(() => null)
  reportPersonalPlanTransitionTiming({
    layer: "client",
    operation,
    outcome: response.ok ? "success" : "http_error",
    durationMs: performance.now() - startedAt,
    status: response.status,
  })
  if (response.ok) return body as T
  throw new Stage2RefinementError(errorCode(body), undefined, savedSession(body))
}

function savedSession(body: unknown): Stage2RefinementSession | undefined {
  if (!body || typeof body !== "object" || !("savedSession" in body)) return undefined
  const session = body.savedSession
  if (!session || typeof session !== "object") return undefined
  return session as Stage2RefinementSession
}

function errorCode(body: unknown): Stage2RefinementErrorCode {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    const code = body.error
    if (isStage2ErrorCode(code)) return code
  }
  return "temporarily_unavailable"
}

function isStage2ErrorCode(value: string): value is Stage2RefinementErrorCode {
  return [
    "save_failed",
    "completion_failed",
    "revision_conflict",
    "invalid_answer",
    "question_not_current",
    "incomplete_refinement",
    "temporarily_unavailable",
    "unsupported_snapshot_version",
    "snapshot_too_large",
  ].includes(value)
}
