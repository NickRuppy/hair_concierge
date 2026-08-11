import {
  Stage3ProductsGatewayError,
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
    loadOrCreate: async ({ personalPlanId, refinedVersionId }) =>
      request<Stage3DraftResponse>(
        fetcher,
        `/api/personal-plan/stage-3?${new URLSearchParams({ personalPlanId, refinedVersionId })}`,
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
    invalidateForRefinedVersion: async () => {
      throw new Stage3ProductsGatewayError("temporarily_unavailable")
    },
    complete: async (input) =>
      request<Stage3CompleteResponse>(
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
  throw new Stage3ProductsGatewayError(parseStage3GatewayErrorCode(body))
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
    (body.error === "stale_refined_source" ||
      body.error === "unsupported_snapshot_version" ||
      body.error === "snapshot_too_large" ||
      body.error === "compensation_pending" ||
      body.error === "rolled_back" ||
      body.error === "idempotency_key_reused")
  )
    return body.error
  return "temporarily_unavailable" as const
}
