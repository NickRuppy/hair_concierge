import { NextResponse } from "next/server"

import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import {
  resolveDiscoveryIntakeContext,
  type DiscoveryIntakeContext,
  type DiscoveryIntakeContextDependencies,
} from "@/lib/discovery/intake"

/**
 * The shared front half of every intake endpoint: kill switch, then the
 * per-request participant guard (`resolveDiscoveryIntakeContext`).
 *
 * The mapping from guard outcome to status code is fixed here so the
 * endpoints cannot drift apart:
 *   no session               -> 401
 *   no live enrollment       -> 404  (this is also what a REVOKED participant gets)
 *   intake belongs elsewhere -> 403
 *   lookup failed            -> 503
 * A submitted intake is frozen: every write endpoint answers 409 afterwards.
 */

const NO_STORE = { "Cache-Control": "private, no-store" }

export type DiscoveryIntakeRouteDependencies = Partial<DiscoveryIntakeContextDependencies> & {
  flagEnabled?: () => boolean
  resolveContext?: typeof resolveDiscoveryIntakeContext
}

export function discoveryIntakeJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export function discoveryIntakeError(code: string, status: number): NextResponse {
  return discoveryIntakeJson({ code }, status)
}

export type DiscoveryIntakeGuardResult =
  | { ok: true; context: Extract<DiscoveryIntakeContext, { status: "ready" }> }
  | { ok: false; response: NextResponse }

export async function guardDiscoveryIntakeRequest(
  overrides: DiscoveryIntakeRouteDependencies = {},
): Promise<DiscoveryIntakeGuardResult> {
  const { flagEnabled, resolveContext, ...contextOverrides } = overrides
  if (!(flagEnabled ?? isDiscoveryCallToolkitEnabled)()) {
    return { ok: false, response: discoveryIntakeError("unavailable", 404) }
  }
  const context = await (resolveContext ?? resolveDiscoveryIntakeContext)(contextOverrides)
  switch (context.status) {
    case "unauthenticated":
      return { ok: false, response: discoveryIntakeError("unauthenticated", 401) }
    case "not_enrolled":
      return { ok: false, response: discoveryIntakeError("not_enrolled", 404) }
    case "forbidden":
      return { ok: false, response: discoveryIntakeError("forbidden", 403) }
    case "unavailable":
      return { ok: false, response: discoveryIntakeError("unavailable", 503) }
    default:
      return { ok: true, context }
  }
}

/** The write endpoints' freeze: nothing may change once the intake was sent. */
export function refuseSubmittedIntake(context: {
  intake: { state: "draft" | "submitted" }
}): NextResponse | null {
  return context.intake.state === "submitted"
    ? discoveryIntakeError("already_submitted", 409)
    : null
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
