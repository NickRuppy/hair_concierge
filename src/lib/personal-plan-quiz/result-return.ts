import { createHash } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"

import { createPersonalPlanClaimCredential } from "./persistence"

export const PERSONAL_PLAN_RESULT_RETURN_COOKIE = "__Host-chaarlie_personal_plan_result_return"
export const PERSONAL_PLAN_RESULT_RETURN_TTL_SECONDS = 30 * 24 * 60 * 60

export const personalPlanResultReturnCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: true,
  path: "/",
  maxAge: PERSONAL_PLAN_RESULT_RETURN_TTL_SECONDS,
}

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CookieResponse = {
  cookies: {
    set: (
      name: string,
      value: string,
      options: typeof personalPlanResultReturnCookieOptions,
    ) => void
  }
}

type ResultReturnAdmin = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  from: (table: "personal_plan_result_returns") => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: "lead_id" },
    ) => Promise<{ error: unknown }>
    update: (values: Record<string, unknown>) => {
      eq: (column: "token_hash", value: string) => Promise<{ error: unknown }>
    }
  }
}

export type PersonalPlanResultReturnResolution = {
  leadId: string | null
  status: "resolved" | "invalid" | "unavailable"
}

export function isPersonalPlanResultReturnForLead(
  resolution: PersonalPlanResultReturnResolution,
  leadId: string,
) {
  return resolution.status === "resolved" && resolution.leadId === leadId
}

export function createPersonalPlanResultReturnCredential() {
  const { claimToken: token, claimTokenHash: tokenHash } = createPersonalPlanClaimCredential()
  return { token, tokenHash }
}

export function isValidPersonalPlanResultReturnToken(value?: string | null): value is string {
  return typeof value === "string" && opaqueTokenPattern.test(value)
}

export function hashPersonalPlanResultReturnToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function clearPersonalPlanResultReturnCookie(response: CookieResponse) {
  response.cookies.set(PERSONAL_PLAN_RESULT_RETURN_COOKIE, "", {
    ...personalPlanResultReturnCookieOptions,
    maxAge: 0,
  })
}

export async function issuePersonalPlanResultReturn(input: {
  leadId: string
  response: CookieResponse
  admin?: ResultReturnAdmin
  now?: Date
}): Promise<{ issued: boolean }> {
  if (!uuidPattern.test(input.leadId)) return { issued: false }
  const credential = createPersonalPlanResultReturnCredential()
  const createdAt = input.now ?? new Date()
  const expiresAt = new Date(createdAt.getTime() + PERSONAL_PLAN_RESULT_RETURN_TTL_SECONDS * 1000)
  const admin = input.admin ?? (createAdminClient() as unknown as ResultReturnAdmin)
  const { error } = await admin.from("personal_plan_result_returns").upsert(
    {
      token_hash: credential.tokenHash,
      lead_id: input.leadId,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      revoked_at: null,
    },
    { onConflict: "lead_id" },
  )
  if (error) return { issued: false }
  input.response.cookies.set(
    PERSONAL_PLAN_RESULT_RETURN_COOKIE,
    credential.token,
    personalPlanResultReturnCookieOptions,
  )
  return { issued: true }
}

export function isConnectionTransportFailure(error: unknown) {
  const isTransportTypeError = error instanceof TypeError
  const errorRecord = error && typeof error === "object" ? (error as Record<string, unknown>) : null
  const isFetchError = !!errorRecord && errorRecord.name === "FetchError"
  if (!isTransportTypeError && !isFetchError && !errorRecord) return false
  const code =
    errorRecord?.cause && typeof errorRecord.cause === "object" && "code" in errorRecord.cause
      ? String((errorRecord.cause as { code?: unknown }).code)
      : errorRecord && "code" in errorRecord
        ? String(errorRecord.code)
        : ""
  const message = error instanceof Error ? error.message : String(errorRecord?.message ?? "")
  const details = String(errorRecord?.details ?? "")
  const isPostgrestTransportEnvelope =
    !!errorRecord &&
    !code &&
    /^(?:TypeError:\s*)?(?:fetch failed|failed to fetch|network error|load failed)/i.test(
      message,
    ) &&
    /(?:fetch failed|failed to fetch|network error|load failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)/i.test(
      `${message}\n${details}`,
    )
  return (
    /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)$/i.test(code) ||
    isPostgrestTransportEnvelope ||
    ((isTransportTypeError || isFetchError) &&
      /(?:fetch failed|network error|connection (?:reset|refused)|timed out)/i.test(message))
  )
}

function parseLeadId(data: unknown) {
  if (!Array.isArray(data) || data.length !== 1) return null
  const row = data[0]
  if (!row || typeof row !== "object" || Array.isArray(row)) return null
  const leadId = (row as Record<string, unknown>).lead_id
  return typeof leadId === "string" && uuidPattern.test(leadId) ? leadId : null
}

export async function resolvePersonalPlanResultReturn(
  cookieValue?: string | null,
  dependencies: { rpc?: ResultReturnAdmin["rpc"]; warn?: (message: string) => void } = {},
): Promise<PersonalPlanResultReturnResolution> {
  if (!isValidPersonalPlanResultReturnToken(cookieValue)) return { leadId: null, status: "invalid" }
  const admin = dependencies.rpc ? null : (createAdminClient() as unknown as ResultReturnAdmin)
  const rpc = dependencies.rpc ?? admin!.rpc.bind(admin)
  const warn = dependencies.warn ?? console.warn
  const args = { p_token_hash: hashPersonalPlanResultReturnToken(cookieValue) }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await rpc("resolve_personal_plan_result_return", args)
      if (error) {
        if (isConnectionTransportFailure(error) && attempt === 0) continue
        warn("Personal Plan result return lookup unavailable")
        return { leadId: null, status: "unavailable" }
      }
      const leadId = parseLeadId(data)
      return leadId ? { leadId, status: "resolved" } : { leadId: null, status: "invalid" }
    } catch (error) {
      if (!isConnectionTransportFailure(error) || attempt === 1) {
        warn("Personal Plan result return lookup unavailable")
        return { leadId: null, status: "unavailable" }
      }
    }
  }
  return { leadId: null, status: "unavailable" }
}

export async function revokePersonalPlanResultReturn(input: {
  cookieValue?: string | null
  response: CookieResponse
  admin?: ResultReturnAdmin
  now?: Date
}): Promise<{ revoked: boolean }> {
  clearPersonalPlanResultReturnCookie(input.response)
  if (!isValidPersonalPlanResultReturnToken(input.cookieValue)) return { revoked: false }
  const admin = input.admin ?? (createAdminClient() as unknown as ResultReturnAdmin)
  const { error } = await admin
    .from("personal_plan_result_returns")
    .update({ revoked_at: (input.now ?? new Date()).toISOString() })
    .eq("token_hash", hashPersonalPlanResultReturnToken(input.cookieValue))
  return { revoked: !error }
}

/** Pure landing precedence: completed result beats a supplied draft resume token. */
export function resolvePersonalPlanReturnLanding(input: {
  resultReturn?: PersonalPlanResultReturnResolution
  resumeToken?: string | null
  hasDraft?: boolean
}):
  | { kind: "result"; leadId: string }
  | { kind: "unavailable" | "resume_token" | "draft" | "fresh" } {
  if (
    input.resultReturn?.status === "resolved" &&
    input.resultReturn.leadId &&
    uuidPattern.test(input.resultReturn.leadId)
  ) {
    return { kind: "result", leadId: input.resultReturn.leadId }
  }
  if (input.resultReturn?.status === "unavailable") return { kind: "unavailable" }
  if (input.resumeToken) return { kind: "resume_token" }
  if (input.hasDraft) return { kind: "draft" }
  return { kind: "fresh" }
}
