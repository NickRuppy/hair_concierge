import { NextResponse } from "next/server"
import type { ZodType } from "zod"

import { captureScanException, type ScanRoute } from "@/lib/observability/scan"
import { checkRateLimit, fixedWindowRetryAfterSeconds, SCAN_RATE_LIMIT } from "@/lib/rate-limit"

/**
 * Shared scaffolding for the five scan routes (resolve, search, submit, save, wishlist):
 * auth -> rate limit -> parse -> handler -> error capture. Extracted because all five
 * routes copied this verbatim; route-specific logic (including resolve's attempt
 * telemetry, threaded through `onError`) stays in each route file.
 */

export type ScanRouteContext<TBody> = {
  userId: string
  body: TBody
  request: Request
}

export type ScanRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  captureScanException?: typeof captureScanException
}

export type ScanParseResult<TBody> =
  | { ok: true; body: TBody }
  | { ok: false; error: string; status: number }

export function scanFail(error: string, status: number, headers?: HeadersInit): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  )
}

export function scanOk<T>(body: T, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, {
    status: init?.status,
    headers: { "Cache-Control": "no-store" },
  })
}

export function createScanRoute<TBody>(config: {
  route: ScanRoute
  deps: ScanRouteDeps
  parse: (request: Request) => Promise<ScanParseResult<TBody>>
  handler: (ctx: ScanRouteContext<TBody>) => Promise<NextResponse>
  failureReason: string
  /** Runs before the Sentry capture on a handler throw — e.g. resolve's attempt telemetry. */
  onError?: (error: unknown, ctx: ScanRouteContext<TBody>) => Promise<void>
}): (request: Request) => Promise<NextResponse> {
  return async function scanRouteHandler(request: Request) {
    const userId = await config.deps.getUserId()
    if (!userId) return scanFail("unauthorized", 401)

    const limited = await config.deps.checkRateLimit(userId, SCAN_RATE_LIMIT)
    if (!limited.allowed) {
      const unavailable = limited.error === "service_unavailable"
      return scanFail(
        unavailable ? "temporarily_unavailable" : "rate_limited",
        unavailable ? 503 : 429,
        unavailable
          ? undefined
          : { "Retry-After": String(fixedWindowRetryAfterSeconds(SCAN_RATE_LIMIT)) },
      )
    }

    const parsed = await config.parse(request)
    if (!parsed.ok) return scanFail(parsed.error, parsed.status)

    const ctx: ScanRouteContext<TBody> = { userId, body: parsed.body, request }

    try {
      return await config.handler(ctx)
    } catch (error) {
      console.error(`[scan] ${config.route} failed`, error)
      if (config.onError) await config.onError(error, ctx)
      ;(config.deps.captureScanException ?? captureScanException)(error, {
        route: config.route,
        status: 503,
        reason: config.failureReason,
        userId,
      })
      return scanFail("temporarily_unavailable", 503)
    }
  }
}

/** JSON body + zod schema parsing, shared by every scan route that takes a body. */
export function parseJsonBody<TBody>(schema: ZodType<TBody>) {
  return async function parse(request: Request): Promise<ScanParseResult<TBody>> {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return { ok: false, error: "invalid_request", status: 400 }
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) return { ok: false, error: "invalid_request", status: 400 }
    return { ok: true, body: parsed.data }
  }
}
