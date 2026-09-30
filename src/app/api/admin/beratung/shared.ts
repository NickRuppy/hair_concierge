import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth/require-admin"
import {
  buildDiscoveryCockpitView,
  loadDiscoveryCallIntake,
  loadDiscoveryCockpitModel,
  type DiscoveryCallIntake,
  type DiscoveryCockpitAdminClient,
  type DiscoveryCockpitView,
} from "@/lib/discovery/cockpit"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * The front half of every cockpit endpoint: kill switch, the SHARED admin gate
 * (`src/lib/auth/require-admin.ts` — the same one `/api/admin/partner-access` uses, not a
 * second inlined copy), then the intake the URL names.
 *
 * Only after the gate does the service-role client appear: these routes read and write
 * another account's rows, which is exactly what the admin gate is for.
 *
 *   flag off / no such intake -> 404
 *   no session                -> 401 (from the shared gate)
 *   not an admin              -> 403 (from the shared gate)
 */

const NO_STORE = { "Cache-Control": "private, no-store" }

export function discoveryCockpitJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export function discoveryCockpitError(code: string, status: number): NextResponse {
  return discoveryCockpitJson({ code }, status)
}

export type DiscoveryCockpitRouteDependencies = {
  flagEnabled?: () => boolean
  requireAdmin?: typeof requireAdmin
  createAdminClient?: () => DiscoveryCockpitAdminClient
  loadIntake?: typeof loadDiscoveryCallIntake
  loadModel?: typeof loadDiscoveryCockpitModel
}

export type DiscoveryCockpitGuardResult =
  | { ok: true; admin: DiscoveryCockpitAdminClient; intake: DiscoveryCallIntake }
  | { ok: false; response: NextResponse }

export async function guardDiscoveryCockpitRequest(
  enrollmentId: string,
  overrides: DiscoveryCockpitRouteDependencies = {},
): Promise<DiscoveryCockpitGuardResult> {
  if (!(overrides.flagEnabled ?? isDiscoveryCallToolkitEnabled)()) {
    return { ok: false, response: discoveryCockpitError("unavailable", 404) }
  }
  const auth = await (overrides.requireAdmin ?? requireAdmin)()
  if ("response" in auth) return { ok: false, response: auth.response }

  const admin = (overrides.createAdminClient ?? createAdminClient)()
  try {
    const intake = await (overrides.loadIntake ?? loadDiscoveryCallIntake)(enrollmentId, admin)
    if (!intake) return { ok: false, response: discoveryCockpitError("not_found", 404) }
    return { ok: true, admin, intake }
  } catch (error) {
    console.error("[discovery] cockpit intake lookup failed:", error)
    return { ok: false, response: discoveryCockpitError("unavailable", 503) }
  }
}

export type DiscoveryCockpitViewResult =
  | { ok: true; view: DiscoveryCockpitView }
  | { ok: false; response: NextResponse }

/**
 * The composition both write routes validate against — the same one the page renders, so
 * a decision can never name a step or a product the cockpit did not show.
 */
export async function resolveDiscoveryCockpitView(
  admin: DiscoveryCockpitAdminClient,
  intake: DiscoveryCallIntake,
  overrides: DiscoveryCockpitRouteDependencies = {},
): Promise<DiscoveryCockpitViewResult> {
  try {
    const model = await (overrides.loadModel ?? loadDiscoveryCockpitModel)(admin, {
      intakeId: intake.id,
      userId: intake.userId,
    })
    if (model.status !== "ready") {
      return { ok: false, response: discoveryCockpitError(model.status, 503) }
    }
    return { ok: true, view: buildDiscoveryCockpitView(model) }
  } catch (error) {
    console.error("[discovery] cockpit composition failed:", error)
    return { ok: false, response: discoveryCockpitError("unavailable", 503) }
  }
}

/** While finalised, the call's decisions are frozen: un-finalise first, then change them. */
export function refuseFinalizedIntake(intake: DiscoveryCallIntake): NextResponse | null {
  return intake.callFinalizedAt ? discoveryCockpitError("finalized", 409) : null
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
