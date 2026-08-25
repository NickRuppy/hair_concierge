import {
  Stage3ProductsGatewayError,
  type Stage3CompletionReceiptResponse,
  type Stage3CompleteResponse,
  type Stage3DraftResponse,
  type Stage3IntakeClientPort,
  type Stage3MutationResponse,
  type Stage3ProductsGateway,
  type Stage3SearchResponse,
} from "./gateway"
import { stage3ProductDraftSchema } from "./contracts"

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export function createHttpStage3ProductsGateway({
  fetch: fetcher = fetch,
}: { fetch?: FetchLike } = {}): Stage3ProductsGateway {
  return {
    loadOrCreate: async ({
      personalPlanId,
      refinedVersionId,
      repairRoutineVersionId,
      rebuildOnStaleRefinedVersion,
    }) =>
      request<Stage3DraftResponse>(
        fetcher,
        `/api/personal-plan/stage-3?${new URLSearchParams({
          personalPlanId,
          refinedVersionId,
          ...(repairRoutineVersionId ? { repairRoutineVersionId } : {}),
          // Strictly opt-in (see the route's `rebuildStale` contract): only a
          // module-driven re-entry may be rebuilt on the current version.
          ...(rebuildOnStaleRefinedVersion && !repairRoutineVersionId ? { rebuildStale: "1" } : {}),
        })}`,
        { method: "GET" },
      ),
    search: async ({ draftId, category, query, requestToken }) =>
      request<Stage3SearchResponse>(
        fetcher,
        `/api/personal-plan/stage-3/search?${new URLSearchParams({
          draftId,
          category,
          q: query,
          requestToken: String(requestToken),
        })}`,
        { method: "GET" },
      ),
    mutate: async (input) =>
      request<Stage3MutationResponse>(
        fetcher,
        "/api/personal-plan/stage-3",
        jsonRequest("PATCH", input),
        { allowRevisionConflict: true },
      ),
    resolveDecision: async (input) =>
      request<Stage3MutationResponse>(
        fetcher,
        "/api/personal-plan/stage-3",
        jsonRequest("PATCH", input),
        { allowRevisionConflict: true },
      ),
    resolveDecisions: async (input) =>
      request<Stage3MutationResponse>(
        fetcher,
        "/api/personal-plan/stage-3",
        jsonRequest("PATCH", input),
        { allowRevisionConflict: true },
      ),
    resolveNeedRevision: async (input) =>
      request<Stage3MutationResponse>(
        fetcher,
        "/api/personal-plan/stage-3",
        jsonRequest("PATCH", input),
        { allowRevisionConflict: true },
      ),
    acknowledgeInventoryDisposition: async (input) =>
      request<Stage3MutationResponse>(
        fetcher,
        "/api/personal-plan/stage-3",
        jsonRequest("PATCH", { ...input, action: "acknowledge_inventory_disposition" }),
        { allowRevisionConflict: true },
      ),
    invalidateForRefinedVersion: async () => {
      throw new Stage3ProductsGatewayError("temporarily_unavailable")
    },
    loadCompletionReceipt: async ({ draftId }) =>
      request<Stage3CompletionReceiptResponse>(
        fetcher,
        `/api/personal-plan/stage-3/complete?${new URLSearchParams({ draftId })}`,
        { method: "GET" },
      ),
    complete: async (input) =>
      request<Exclude<Stage3CompleteResponse, { status: "not_ready" }>>(
        fetcher,
        "/api/personal-plan/stage-3/complete",
        jsonRequest("POST", input),
        { allowRevisionConflict: true },
      ),
  }
}

export function createHttpStage3IntakeClient({
  fetch: fetcher = fetch,
}: { fetch?: FetchLike } = {}): Stage3IntakeClientPort {
  return {
    submit: ({ idempotencyKey, ...body }) =>
      request(
        fetcher,
        "/api/personal-plan/stage-3/intake",
        jsonRequest("POST", body, idempotencyKey),
      ),
  }
}

function jsonRequest(
  method: "PATCH" | "POST",
  body: unknown,
  idempotencyKey?: string,
): RequestInit {
  return {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  }
}

async function request<T>(
  fetcher: FetchLike,
  url: string,
  init: RequestInit,
  options?: { allowRevisionConflict?: boolean },
): Promise<T> {
  let response: Response
  try {
    response = await fetcher(url, { ...init, cache: "no-store" })
  } catch {
    throw new Stage3ProductsGatewayError("temporarily_unavailable")
  }
  const body = await response.json().catch(() => null)
  if (response.ok) return body as T
  if (options?.allowRevisionConflict && response.status === 409) {
    const conflict = parseStage3RevisionConflict(body)
    if (conflict) return conflict as T
  }
  throw stage3GatewayErrorFromResponse(response, body)
}

export function stage3GatewayErrorFromResponse(response: Response, body: unknown) {
  return new Stage3ProductsGatewayError(
    parseStage3GatewayErrorCode(body),
    undefined,
    response.status,
    parseRetryAfterSeconds(response.headers.get("Retry-After")),
  )
}

export function parseStage3RevisionConflict(body: unknown) {
  if (!body || typeof body !== "object") return null
  const candidate = body as Record<string, unknown>
  if (candidate.error !== "revision_conflict") return null
  const latestDraft = stage3ProductDraftSchema.safeParse(candidate.latestDraft)
  return latestDraft.success ? { status: "conflict" as const, latestDraft: latestDraft.data } : null
}

export function parseStage3GatewayErrorCode(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    (body.error === "invalid_request" ||
      body.error === "unauthorized" ||
      body.error === "personal_plan_not_available" ||
      body.error === "stage_not_ready" ||
      body.error === "stale_refined_source" ||
      body.error === "stale_authority_snapshot" ||
      body.error === "stage3_replacement_candidate_invalid" ||
      body.error === "rate_limited" ||
      body.error === "completion_not_ready" ||
      body.error === "unsupported_snapshot_version" ||
      body.error === "snapshot_too_large" ||
      body.error === "compensation_pending" ||
      body.error === "rolled_back" ||
      body.error === "idempotency_key_reused")
  )
    return body.error
  return "temporarily_unavailable" as const
}

export function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined
}
