import "server-only"

export const RESOLVE_PERSONAL_PLAN_MIGRATION_RPC = "personal_plan_resolve_migration_admission"
export const BEGIN_PERSONAL_PLAN_MIGRATION_RPC = "personal_plan_begin_or_bind_migration"

export type PersonalPlanMigrationAdmissionKind =
  | "billing_subscription"
  | "one_time_purchase"
  | "legacy_profile"

export type PaidMigrationAuthority = {
  kind: PersonalPlanMigrationAdmissionKind
  sourceId: string
}

export type PersonalPlanMigrationAdmission =
  | { status: "ineligible" }
  | { status: "candidate"; authority: PaidMigrationAuthority }
  | {
      status: "pending_source"
      enrollmentId: string
      admittedAt: string
      authority: PaidMigrationAuthority
      leadId: null
      quizSourceKind: null
    }
  | {
      status: "ready"
      enrollmentId: string
      admittedAt: string
      authority: PaidMigrationAuthority
      leadId: string
      quizSourceKind: "legacy" | "personal_plan"
    }

export type PersonalPlanMigrationAdmissionClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

export type PersonalPlanMigrationAdmissionRelease = {
  legacyMigrationEnabled: () => boolean
}

type PersonalPlanMigrationEnvironment = {
  [key: string]: string | undefined
  PERSONAL_PLAN_LEGACY_MIGRATION_ENABLED?: string
}

type ResolvePersonalPlanMigrationAdmissionInput = {
  client: PersonalPlanMigrationAdmissionClient
  userId: string
  release?: PersonalPlanMigrationAdmissionRelease
}

type BeginOrBindPersonalPlanMigrationInput = ResolvePersonalPlanMigrationAdmissionInput & {
  ownedLeadId?: string | null
}

const defaultRelease: PersonalPlanMigrationAdmissionRelease = {
  legacyMigrationEnabled: () => isPersonalPlanLegacyMigrationEnabled(),
}

export class PersonalPlanMigrationAdmissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PersonalPlanMigrationAdmissionError"
  }
}

export function isPersonalPlanLegacyMigrationEnabled(
  environment: PersonalPlanMigrationEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_LEGACY_MIGRATION_ENABLED === "true"
}

export async function resolvePersonalPlanMigrationAdmission(
  input: ResolvePersonalPlanMigrationAdmissionInput,
): Promise<PersonalPlanMigrationAdmission> {
  const userId = normalizeRequiredId(input.userId, "userId")
  const { data, error } = await input.client.rpc(RESOLVE_PERSONAL_PLAN_MIGRATION_RPC, {
    p_user_id: userId,
  })
  if (error) throw error

  return applyAdmissionGate(parsePersonalPlanMigrationAdmission(data), input.release)
}

export async function beginOrBindPersonalPlanMigration(
  input: BeginOrBindPersonalPlanMigrationInput,
): Promise<PersonalPlanMigrationAdmission> {
  const release = input.release ?? defaultRelease
  if (!release.legacyMigrationEnabled()) {
    return resolvePersonalPlanMigrationAdmission({
      client: input.client,
      userId: input.userId,
      release,
    })
  }

  const userId = normalizeRequiredId(input.userId, "userId")
  const { data, error } = await input.client.rpc(BEGIN_PERSONAL_PLAN_MIGRATION_RPC, {
    p_user_id: userId,
    p_requested_lead_id: normalizeOptionalId(input.ownedLeadId),
  })
  if (error) throw error

  return parsePersonalPlanMigrationAdmission(data)
}

export function parsePersonalPlanMigrationAdmission(
  value: unknown,
): PersonalPlanMigrationAdmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidPayload()
  }

  const row = value as Record<string, unknown>
  if (row.status === "ineligible") return { status: "ineligible" }

  if (row.status === "candidate") {
    return {
      status: "candidate",
      authority: parseAuthority(row),
    }
  }

  if (row.status === "pending_source") {
    const enrollmentId = optionalNonEmptyString(row.enrollment_id)
    if (!enrollmentId) throw invalidPayload()
    const admittedAt = validIsoTimestamp(row.admitted_at)
    if (!admittedAt) throw invalidPayload()
    const leadId = nullableNonEmptyString(row.lead_id)
    if (leadId !== null) throw invalidPayload()
    const quizSourceKind = parseBoundQuizSourceKind(row.quiz_source_kind)
    if (quizSourceKind !== null) throw invalidPayload()
    return {
      status: "pending_source",
      enrollmentId,
      admittedAt,
      authority: parseAuthority(row),
      leadId: null,
      quizSourceKind: null,
    }
  }

  if (row.status === "ready") {
    const enrollmentId = optionalNonEmptyString(row.enrollment_id)
    if (!enrollmentId) throw invalidPayload()
    const admittedAt = validIsoTimestamp(row.admitted_at)
    if (!admittedAt) throw invalidPayload()
    const leadId = nullableNonEmptyString(row.lead_id)
    if (!leadId) throw invalidPayload()
    const quizSourceKind = parseBoundQuizSourceKind(row.quiz_source_kind)
    if (!quizSourceKind) throw invalidPayload()
    return {
      status: "ready",
      enrollmentId,
      admittedAt,
      authority: parseAuthority(row),
      leadId,
      quizSourceKind,
    }
  }

  throw invalidPayload()
}

function applyAdmissionGate(
  admission: PersonalPlanMigrationAdmission,
  release: PersonalPlanMigrationAdmissionRelease = defaultRelease,
): PersonalPlanMigrationAdmission {
  if (admission.status === "candidate" && !release.legacyMigrationEnabled()) {
    return { status: "ineligible" }
  }
  return admission
}

function parseAuthority(row: Record<string, unknown>): PaidMigrationAuthority {
  const kind = row.admission_kind
  if (
    kind !== "billing_subscription" &&
    kind !== "one_time_purchase" &&
    kind !== "legacy_profile"
  ) {
    throw invalidPayload()
  }
  const sourceId = optionalNonEmptyString(row.admission_source_id)
  if (!sourceId) throw invalidPayload()
  return { kind, sourceId }
}

function normalizeRequiredId(value: string, field: string): string {
  const normalized = optionalNonEmptyString(value)
  if (!normalized) {
    throw new PersonalPlanMigrationAdmissionError(`${field} is required`)
  }
  return normalized
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function optionalNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function nullableNonEmptyString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

function validIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return value.trim()
}

function parseBoundQuizSourceKind(value: unknown): "legacy" | "personal_plan" | null | undefined {
  if (value === null || value === undefined) return null
  if (value === "legacy" || value === "personal_plan") return value
  return undefined
}

function invalidPayload(): PersonalPlanMigrationAdmissionError {
  return new PersonalPlanMigrationAdmissionError(
    "Invalid Personal Plan migration admission RPC payload",
  )
}
