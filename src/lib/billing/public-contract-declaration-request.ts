import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  type RateLimitConfig,
} from "@/lib/rate-limit"
import { parsePublicContractDeclaration } from "./public-contract-declaration"
import { submitPublicContractDeclaration } from "./public-contract-declarations"

const IP_LIMIT: RateLimitConfig = { prefix: "public-declaration-ip", limit: 20, windowMs: 600_000 }
const EMAIL_LIMIT: RateLimitConfig = {
  prefix: "public-declaration-address",
  limit: 5,
  windowMs: 3_600_000,
}
const MAX_BYTES = 16_384
type Dependencies = {
  rateLimit: typeof checkRateLimit
  submit: typeof submitPublicContractDeclaration
}

function respond(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

async function readBoundedBody(request: Request) {
  if (!request.body) return null
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0,
    text = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BYTES) {
        await reader.cancel()
        return null
      }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

export async function handlePublicContractDeclaration(
  request: Request,
  deps: Dependencies = { rateLimit: checkRateLimit, submit: submitPublicContractDeclaration },
) {
  // This endpoint never reads cookies, users or subscriptions. Same-origin JSON
  // protects the submitter from a cross-site form while permitting no-login use.
  const origin = request.headers.get("origin")
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return respond({ error: "invalid_request" }, 403)
  }
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    return respond({ error: "invalid_request" }, 400)
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BYTES)
    return respond({ error: "invalid_request" }, 413)
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const ipCheck = await deps.rateLimit(createHash("sha256").update(ip).digest("hex"), IP_LIMIT)
    if (ipCheck.error) return respond({ error: "submission_unavailable" }, 503)
    if (!ipCheck.allowed)
      return respond({ error: "rate_limited" }, 429, {
        "Retry-After": String(fixedWindowRetryAfterSeconds(IP_LIMIT)),
      })
    const declaration = parsePublicContractDeclaration(await readBoundedBody(request))
    if (!declaration) return respond({ error: "invalid_request" }, 400)
    const emailCheck = await deps.rateLimit(
      createHash("sha256").update(declaration.email).digest("hex"),
      EMAIL_LIMIT,
    )
    if (emailCheck.error) return respond({ error: "submission_unavailable" }, 503)
    if (!emailCheck.allowed)
      return respond({ error: "rate_limited" }, 429, {
        "Retry-After": String(fixedWindowRetryAfterSeconds(EMAIL_LIMIT)),
      })
    const receipt = await deps.submit(declaration)
    // Queue commit is acceptance. Provider identity/status and delivery are not
    // inspected or inferred here, including for an already authenticated user.
    return respond({ receipt, deliveryStatus: "queued" }, 200)
  } catch {
    return respond({ error: "submission_unavailable" }, 503)
  }
}
