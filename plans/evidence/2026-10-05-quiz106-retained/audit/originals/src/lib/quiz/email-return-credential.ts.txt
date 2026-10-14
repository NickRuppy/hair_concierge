import { createHash, randomBytes, randomUUID } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { QUIZ_EMAIL_RETURN_PACKAGE_KEY } from "./email-return-context"

export const QUIZ_EMAIL_RETURN_CREDENTIAL_TTL_SECONDS = 30 * 24 * 60 * 60

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type QuizEmailReturnLeadCandidate = {
  id: string
  email: string
  quizKind: string
  quizAnswers: Record<string, unknown> | null
  createdAt: string
}

type QuizEmailReturnLinkRow = {
  link_id?: unknown
  lead_id?: unknown
  quiz_kind?: unknown
  campaign_key?: unknown
  package_key?: unknown
}

type QuizEmailReturnAdmin = {
  from: (table: "leads" | "quiz_email_return_links") => {
    select?: (columns: string) => {
      ilike: (
        column: string,
        value: string,
      ) => {
        in: (
          column: string,
          values: string[],
        ) => {
          not: (
            column: string,
            operator: string,
            value: null,
          ) => {
            order: (
              column: string,
              options: { ascending: boolean },
            ) => {
              order: (
                column: string,
                options: { ascending: boolean },
              ) => Promise<{ data: unknown; error: unknown }>
            }
          }
        }
      }
    }
    insert?: (values: Record<string, unknown>) => Promise<{ error: unknown }>
    update?: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => {
        is: (
          column: string,
          value: null,
        ) => {
          select: (columns: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }>
          }
        }
      }
    }
  }
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

export type QuizEmailReturnCredentialResolution = {
  status: "resolved" | "invalid" | "unavailable"
  linkId: string | null
  leadId: string | null
  quizKind: "legacy" | "personal_plan" | null
  campaignKey: string | null
  packageKey: string | null
}

export function normalizeQuizEmailReturnEmail(email: string) {
  return email.trim().toLowerCase()
}

function isSavedQuizAnswers(value: unknown): value is Record<string, unknown> {
  return (
    !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
  )
}

/**
 * The database query already orders these rows; keeping the ordering pure makes
 * issuance deterministic in tests and protects callers that provide an unordered
 * source. A completed quiz is defined by persisted answers, not lead status.
 */
export function selectNewestQuizEmailReturnLead(
  email: string,
  candidates: QuizEmailReturnLeadCandidate[] | null | undefined,
): QuizEmailReturnLeadCandidate | null {
  const normalizedEmail = normalizeQuizEmailReturnEmail(email)
  const eligible = (candidates ?? []).filter(
    (candidate) =>
      normalizeQuizEmailReturnEmail(candidate.email) === normalizedEmail &&
      (candidate.quizKind === "legacy" || candidate.quizKind === "personal_plan") &&
      isSavedQuizAnswers(candidate.quizAnswers) &&
      Number.isFinite(Date.parse(candidate.createdAt)) &&
      uuidPattern.test(candidate.id),
  )
  eligible.sort((left, right) => {
    const timestampOrder = Date.parse(right.createdAt) - Date.parse(left.createdAt)
    return timestampOrder || right.id.localeCompare(left.id)
  })
  return eligible[0] ?? null
}

function parseLeadCandidates(data: unknown): QuizEmailReturnLeadCandidate[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return []
    const record = row as Record<string, unknown>
    if (
      typeof record.id !== "string" ||
      typeof record.email !== "string" ||
      typeof record.quiz_kind !== "string" ||
      typeof record.created_at !== "string"
    ) {
      return []
    }
    return [
      {
        id: record.id,
        email: record.email,
        quizKind: record.quiz_kind,
        quizAnswers: isSavedQuizAnswers(record.quiz_answers) ? record.quiz_answers : null,
        createdAt: record.created_at,
      },
    ]
  })
}

async function loadQuizEmailReturnLeadCandidates(email: string, admin: QuizEmailReturnAdmin) {
  const normalizedEmail = normalizeQuizEmailReturnEmail(email)
  // PostgREST ILIKE reaches historical rows saved before lower-casing was
  // consistently enforced. Escape SQL-pattern metacharacters even though this
  // is an internal Customer.io capability rather than a public search API.
  const exactCaseInsensitiveEmail = normalizedEmail.replace(/[\\%_]/g, "\\$&")
  const query = admin.from("leads").select!("id,email,quiz_kind,quiz_answers,created_at")
    .ilike("email", exactCaseInsensitiveEmail)
    .in("quiz_kind", ["legacy", "personal_plan"])
    .not("quiz_answers", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
  const { data, error } = await query
  return error ? null : parseLeadCandidates(data)
}

export function createQuizEmailReturnCredential() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashQuizEmailReturnCredential(token) }
}

export function isValidQuizEmailReturnCredential(value?: string | null): value is string {
  return typeof value === "string" && opaqueTokenPattern.test(value)
}

export function hashQuizEmailReturnCredential(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export async function issueQuizEmailReturnCredential(input: {
  email: string
  campaignKey: string
  packageKey: string
  now?: Date
  admin?: QuizEmailReturnAdmin
  loadCandidates?: (email: string) => Promise<QuizEmailReturnLeadCandidate[] | null>
}): Promise<
  | {
      status: "issued"
      linkId: string
      leadId: string
      quizKind: "legacy" | "personal_plan"
      token: string
      expiresAt: string
    }
  | { status: "not_found" | "unavailable" }
> {
  if (!input.campaignKey || input.packageKey !== QUIZ_EMAIL_RETURN_PACKAGE_KEY) {
    return { status: "unavailable" }
  }
  const admin = input.admin ?? (createAdminClient() as unknown as QuizEmailReturnAdmin)
  const candidates = input.loadCandidates
    ? await input.loadCandidates(normalizeQuizEmailReturnEmail(input.email))
    : await loadQuizEmailReturnLeadCandidates(input.email, admin)
  if (!candidates) return { status: "unavailable" }
  const lead = selectNewestQuizEmailReturnLead(input.email, candidates)
  if (!lead) return { status: "not_found" }

  const credential = createQuizEmailReturnCredential()
  const linkId = randomUUID()
  const createdAt = input.now ?? new Date()
  const expiresAt = new Date(createdAt.getTime() + QUIZ_EMAIL_RETURN_CREDENTIAL_TTL_SECONDS * 1000)
  const { error } = await admin.from("quiz_email_return_links").insert!({
    id: linkId,
    token_hash: credential.tokenHash,
    source_lead_id: lead.id,
    campaign_key: input.campaignKey,
    package_key: input.packageKey,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  })
  if (error) return { status: "unavailable" }
  return {
    status: "issued",
    linkId,
    leadId: lead.id,
    quizKind: lead.quizKind as "legacy" | "personal_plan",
    token: credential.token,
    expiresAt: expiresAt.toISOString(),
  }
}

function parseResolution(data: unknown): {
  linkId: string
  leadId: string
  quizKind: "legacy" | "personal_plan"
  campaignKey: string
  packageKey: string
} | null {
  if (!Array.isArray(data) || data.length !== 1) return null
  const row = data[0] as QuizEmailReturnLinkRow | null
  if (
    !row ||
    !uuidPattern.test(String(row.link_id)) ||
    !uuidPattern.test(String(row.lead_id)) ||
    (row.quiz_kind !== "legacy" && row.quiz_kind !== "personal_plan") ||
    typeof row.campaign_key !== "string" ||
    typeof row.package_key !== "string"
  ) {
    return null
  }
  return {
    linkId: row.link_id as string,
    leadId: row.lead_id as string,
    quizKind: row.quiz_kind,
    campaignKey: row.campaign_key,
    packageKey: row.package_key,
  }
}

const invalidResolution = (): QuizEmailReturnCredentialResolution => ({
  status: "invalid",
  linkId: null,
  leadId: null,
  quizKind: null,
  campaignKey: null,
  packageKey: null,
})

const unavailableResolution = (): QuizEmailReturnCredentialResolution => ({
  status: "unavailable",
  linkId: null,
  leadId: null,
  quizKind: null,
  campaignKey: null,
  packageKey: null,
})

async function resolveQuizEmailReturnLink(
  rpcName: "resolve_quiz_email_return_link" | "resolve_quiz_email_return_link_by_id",
  args: Record<string, unknown>,
  dependencies: { rpc?: QuizEmailReturnAdmin["rpc"]; warn?: (message: string) => void },
): Promise<QuizEmailReturnCredentialResolution> {
  const admin = dependencies.rpc ? null : (createAdminClient() as unknown as QuizEmailReturnAdmin)
  const rpc = dependencies.rpc ?? admin?.rpc?.bind(admin)
  if (!rpc) return unavailableResolution()
  try {
    const { data, error } = await rpc(rpcName, args)
    if (error) {
      ;(dependencies.warn ?? console.warn)("Quiz email return lookup unavailable")
      return unavailableResolution()
    }
    const resolution = parseResolution(data)
    return resolution ? { status: "resolved", ...resolution } : invalidResolution()
  } catch {
    ;(dependencies.warn ?? console.warn)("Quiz email return lookup unavailable")
    return unavailableResolution()
  }
}

/** This read-only lookup neither consumes nor extends the bearer credential. */
export async function resolveQuizEmailReturnCredential(
  token?: string | null,
  dependencies: { rpc?: QuizEmailReturnAdmin["rpc"]; warn?: (message: string) => void } = {},
): Promise<QuizEmailReturnCredentialResolution> {
  if (!isValidQuizEmailReturnCredential(token)) return invalidResolution()
  return resolveQuizEmailReturnLink(
    "resolve_quiz_email_return_link",
    { p_token_hash: hashQuizEmailReturnCredential(token) },
    dependencies,
  )
}

/**
 * For a route-owned signed HttpOnly cookie. The caller must validate that cookie
 * before using this lookup; this function rechecks the database lifecycle.
 */
export async function resolveQuizEmailReturnLinkById(
  linkId?: string | null,
  dependencies: { rpc?: QuizEmailReturnAdmin["rpc"]; warn?: (message: string) => void } = {},
): Promise<QuizEmailReturnCredentialResolution> {
  if (!linkId || !uuidPattern.test(linkId)) return invalidResolution()
  return resolveQuizEmailReturnLink(
    "resolve_quiz_email_return_link_by_id",
    { p_link_id: linkId },
    dependencies,
  )
}

export async function revokeQuizEmailReturnCredential(
  token?: string | null,
  input: { now?: Date; admin?: QuizEmailReturnAdmin } = {},
): Promise<{ revoked: boolean }> {
  if (!isValidQuizEmailReturnCredential(token)) return { revoked: false }
  return revokeStoredQuizEmailReturnLink("token_hash", hashQuizEmailReturnCredential(token), input)
}

/** Operator-safe revocation when only the stored link ID, not the bearer URL, is known. */
export async function revokeQuizEmailReturnLinkById(
  linkId: string,
  input: { now?: Date; admin?: QuizEmailReturnAdmin } = {},
): Promise<{ revoked: boolean }> {
  if (!uuidPattern.test(linkId)) return { revoked: false }
  return revokeStoredQuizEmailReturnLink("id", linkId, input)
}

async function revokeStoredQuizEmailReturnLink(
  column: "id" | "token_hash",
  value: string,
  input: { now?: Date; admin?: QuizEmailReturnAdmin },
): Promise<{ revoked: boolean }> {
  const admin = input.admin ?? (createAdminClient() as unknown as QuizEmailReturnAdmin)
  const { data, error } = await admin.from("quiz_email_return_links").update!({
    revoked_at: (input.now ?? new Date()).toISOString(),
  })
    .eq(column, value)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle()
  return { revoked: !error && Boolean(data?.id) }
}
