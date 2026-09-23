import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/require-admin"
import {
  createDiscoveryEnrollment,
  isDiscoveryEmailTakenError,
  revokeDiscoveryEnrollment,
  rotateDiscoveryEnrollment,
  type DiscoveryAdminClient,
} from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import { discoveryPublicSiteUrl, projectDiscoveryAdminInvite } from "@/lib/discovery/invite-link"
import { discoveryEnrollmentSigningSecret } from "@/lib/discovery/token"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * `/api/admin/beratung/invites` — the admin twin of `npm run discovery -- create |
 * rotate | revoke`, over the SAME service functions (`src/lib/discovery/enrollment.ts`).
 *
 *   POST  { name, email? }                      -> new invite + its link
 *   PATCH { action: "rotate"|"revoke", enrollmentId } -> the row after the write
 *
 * Gate order: same-origin (403, CSRF), then the cockpit's kill switch (404), the shared
 * `requireAdmin` (401/403),
 * and only then the service-role client. The CLI's production-write env gate does not
 * apply here — this route is an authenticated admin surface, not an operator script.
 *
 * The link is derived from (id, token_version) on every answer; nothing new is stored.
 */

const NO_STORE = { "Cache-Control": "private, no-store" }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(320)
    .nullish()
    .transform((value) => value || null)
    .refine((value) => value === null || EMAIL.test(value)),
})

const actionSchema = z.object({
  action: z.enum(["rotate", "revoke"]),
  enrollmentId: z.string().uuid(),
})

export type DiscoveryInvitesRouteDependencies = {
  flagEnabled: () => boolean
  requireAdmin: typeof requireAdmin
  createAdminClient: () => DiscoveryAdminClient
  signingSecret: () => string
  siteUrl: () => string
  createEnrollment: typeof createDiscoveryEnrollment
  rotateEnrollment: typeof rotateDiscoveryEnrollment
  revokeEnrollment: typeof revokeDiscoveryEnrollment
}

const DEFAULTS: DiscoveryInvitesRouteDependencies = {
  flagEnabled: isDiscoveryCallToolkitEnabled,
  requireAdmin,
  createAdminClient,
  signingSecret: () => discoveryEnrollmentSigningSecret(),
  siteUrl: () => discoveryPublicSiteUrl(),
  createEnrollment: createDiscoveryEnrollment,
  rotateEnrollment: rotateDiscoveryEnrollment,
  revokeEnrollment: revokeDiscoveryEnrollment,
}

type Guarded =
  | { ok: true; admin: DiscoveryAdminClient; context: { secret: string; siteUrl: string } }
  | { ok: false; response: NextResponse }

async function guard(request: Request, deps: DiscoveryInvitesRouteDependencies): Promise<Guarded> {
  // CSRF: the admin session cookie rides along on a cross-site form or fetch, so a
  // write must also prove it was sent by our own page. Checked before anything else.
  if (!isSameOrigin(request)) return { ok: false, response: error("Ungültige Anfrage.", 403) }
  if (!deps.flagEnabled()) return { ok: false, response: error("Nicht verfügbar.", 404) }
  const auth = await deps.requireAdmin()
  if ("response" in auth) return { ok: false, response: auth.response }
  let secret: string
  try {
    secret = deps.signingSecret()
  } catch {
    return { ok: false, response: error("Signier-Schlüssel fehlt.", 503) }
  }
  return {
    ok: true,
    admin: deps.createAdminClient(),
    context: { secret, siteUrl: deps.siteUrl() },
  }
}

export function createDiscoveryInvitesHandlers(
  overrides: Partial<DiscoveryInvitesRouteDependencies> = {},
) {
  const deps = { ...DEFAULTS, ...overrides }

  async function POST(request: Request) {
    const guarded = await guard(request, deps)
    if (!guarded.ok) return guarded.response
    const body = createSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return error("Bitte prüf Name und E-Mail.", 400)
    try {
      const row = await deps.createEnrollment(body.data, guarded.admin)
      return json({ invite: projectDiscoveryAdminInvite(row, guarded.context) }, 201)
    } catch (reason) {
      if (isDiscoveryEmailTakenError(reason)) {
        return error("Für diese E-Mail gibt es schon eine aktive Einladung.", 409)
      }
      console.error("[discovery] admin invite create failed:", reason)
      return error("Einladung konnte nicht erstellt werden.", 503)
    }
  }

  async function PATCH(request: Request) {
    const guarded = await guard(request, deps)
    if (!guarded.ok) return guarded.response
    const body = actionSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return error("Ungültige Aktion.", 400)
    const write = body.data.action === "rotate" ? deps.rotateEnrollment : deps.revokeEnrollment
    try {
      const row = await write(body.data.enrollmentId, guarded.admin)
      return json({ invite: projectDiscoveryAdminInvite(row, guarded.context) })
    } catch (reason) {
      // The service functions throw „not found" for a missing or already revoked row.
      if (reason instanceof Error && /not found/i.test(reason.message)) {
        return error("Einladung nicht gefunden oder schon widerrufen.", 409)
      }
      console.error(`[discovery] admin invite ${body.data.action} failed:`, reason)
      return error("Einladung konnte nicht aktualisiert werden.", 503)
    }
  }

  return { POST, PATCH }
}

const handlers = createDiscoveryInvitesHandlers()
export const POST = handlers.POST
export const PATCH = handlers.PATCH

/** Same rule as `POST /api/beratung/claim`: the browser's Origin must be our own. */
function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function error(message: string, status: number) {
  return json({ error: message }, status)
}
