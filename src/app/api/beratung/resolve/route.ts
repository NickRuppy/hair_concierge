import { NextResponse, type NextRequest } from "next/server"

import {
  deriveDiscoveryEnrollmentState,
  loadDiscoveryEnrollment,
  type DiscoveryEnrollment,
} from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import {
  discoveryInviteCookieOptions,
  DISCOVERY_INVITE_COOKIE,
  readDiscoveryCredentialInput,
} from "@/lib/discovery/invite-session"
import {
  decodeDiscoveryEnrollmentCredential,
  discoveryEnrollmentSigningSecret,
} from "@/lib/discovery/token"

/**
 * Turns the invite link's fragment credential into the greeting the invite page
 * shows, and parks the credential in an httpOnly cookie so the claim can run
 * after the page has scrubbed the fragment out of the URL bar.
 *
 * The partner-access `resolve` analogue. It reveals the enrollment's own name
 * and e-mail to whoever already holds the signed credential — nothing else, and
 * only for an enrollment that is neither revoked nor rotated past.
 */

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const UNAVAILABLE = "Diese Einladung ist nicht verfügbar."

type ResolveDependencies = {
  decodeCredential: typeof decodeDiscoveryEnrollmentCredential
  loadEnrollment: typeof loadDiscoveryEnrollment
  signingSecret: () => string
  flagEnabled: () => boolean
}

const DEFAULT_DEPENDENCIES: ResolveDependencies = {
  decodeCredential: decodeDiscoveryEnrollmentCredential,
  loadEnrollment: loadDiscoveryEnrollment,
  signingSecret: () => discoveryEnrollmentSigningSecret(),
  flagEnabled: isDiscoveryCallToolkitEnabled,
}

export function createDiscoveryResolveHandler(overrides: Partial<ResolveDependencies> = {}) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }

  return async function POST(request: NextRequest) {
    if (!isSameOrigin(request)) return jsonError("Ungültige Anfrage.", 403)
    // The kill switch closes the journey for everyone, including links already
    // out in the wild.
    if (!dependencies.flagEnabled()) return jsonError(UNAVAILABLE, 410)

    const input = await readResolveInput(request)
    if (!input) return jsonError("Ungültige Anfrage.", 400)

    let secret: string
    try {
      secret = dependencies.signingSecret()
    } catch {
      return jsonError("Diese Einladung ist gerade nicht verfügbar.", 503)
    }

    const credential =
      input.kind === "credential"
        ? input.credential
        : (request.cookies.get(DISCOVERY_INVITE_COOKIE)?.value ?? null)
    const payload = dependencies.decodeCredential(credential, secret)
    if (!payload || !credential) return jsonError(UNAVAILABLE, 410)

    let enrollment: DiscoveryEnrollment | null
    try {
      enrollment = await dependencies.loadEnrollment({
        enrollmentId: payload.enrollmentId,
        tokenVersion: payload.tokenVersion,
      })
    } catch {
      return jsonError("Diese Einladung ist gerade nicht verfügbar.", 503)
    }
    if (!enrollment) return jsonError(UNAVAILABLE, 410)

    const response = NextResponse.json(
      {
        name: enrollment.name,
        email: enrollment.email,
        state: deriveDiscoveryEnrollmentState(enrollment),
      },
      { headers: NO_STORE_HEADERS },
    )
    response.cookies.set(DISCOVERY_INVITE_COOKIE, credential, discoveryInviteCookieOptions)
    return response
  }
}

export const POST = createDiscoveryResolveHandler()

async function readResolveInput(request: Request) {
  try {
    const body: unknown = await request.json()
    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null
    const credential = readDiscoveryCredentialInput(record?.credential)
    if (credential) return { kind: "credential" as const, credential }
    return record?.resume === true ? { kind: "resume" as const } : null
  } catch {
    return null
  }
}

function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}
