import { createHash } from "node:crypto"
import { z } from "zod"

export const MODERATOR_RESET_SCHEMA_VERSION = 1
export const MODERATOR_RESET_OPERATION = "moderator_personal_plan_full_reset"
export const PRODUCTION_PROJECT_REF = "pqdkhefxsxkyeqelqegq"

const uuidSchema = z.string().uuid()
const isoTimestampSchema = z.string().datetime({ offset: true })
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export const authMaintenanceProofSchema = z
  .object({
    loginRestrictionMethod: z.string().min(1),
    loginRestrictedAt: isoTimestampSchema,
    paymentReplayCutoffAt: isoTimestampSchema.optional(),
    sessionsRevokedAt: isoTimestampSchema,
    jwtExpiresAfterSeconds: z.number().int().positive().max(86_400),
    inFlightDrainSeconds: z.number().int().nonnegative().max(86_400),
    workerQueueDrainedAt: isoTimestampSchema,
    earliestResetAt: isoTimestampSchema,
    restoreProcedure: z.string().min(1),
  })
  .strict()

export const externalResetProofSchema = z
  .object({
    productionOperationApproval: z.enum(["not_required_local_test", "approved_exact_batch"]),
    authAdminMechanismVerified: z.boolean(),
    storageInventoryComplete: z.boolean(),
    storageObjectsRemoved: z.boolean(),
    workerPauseVerified: z.boolean(),
    delayedCallbackWriteBlocked: z.boolean(),
    billingOwnershipReconciled: z.boolean(),
  })
  .strict()

export const resetAccountManifestSchema = z
  .object({
    userId: uuidSchema,
    email: z.string().email(),
    expectedAuthEmail: z.string().email(),
    expectedCounts: z.record(z.string(), z.number().int().nonnegative()),
    expectedRuntimeFingerprint: z.string().regex(/^md5:[0-9a-f]{32}$/),
    revokeManualAccessGrantIds: z.array(uuidSchema),
    storageObjectPaths: z.array(z.string().min(1)),
    authAppMetadataKeysToRemove: z.array(z.string().regex(/^[a-zA-Z0-9_.:-]+$/)),
    authUserMetadataKeysToRemove: z.array(z.string().regex(/^[a-zA-Z0-9_.:-]+$/)).optional(),
    authMaintenanceProof: authMaintenanceProofSchema.optional(),
  })
  .strict()

export const resetManifestSchema = z
  .object({
    schemaVersion: z.literal(MODERATOR_RESET_SCHEMA_VERSION),
    operation: z.literal(MODERATOR_RESET_OPERATION),
    environment: z.enum(["local_test", "production"]),
    projectRef: z.string().min(1),
    batchId: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,80}$/),
    createdAt: isoTimestampSchema,
    manifestFingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    operatorApprovedTargetCount: z.number().int().positive().max(25),
    expectedSchema: z
      .object({
        discoveredOwnerTables: z.array(z.string().regex(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/)),
        profileColumns: z.array(z.string().regex(/^[a-z_][a-z0-9_]*$/)),
        authUsersColumns: z.array(z.string().regex(/^[a-z_][a-z0-9_]*$/)),
      })
      .strict(),
    profileResetValues: z.record(z.string(), jsonValueSchema),
    externalProof: externalResetProofSchema,
    accounts: z.array(resetAccountManifestSchema).min(1).max(25),
  })
  .strict()

export type ResetManifest = z.infer<typeof resetManifestSchema>
export type ResetAccountManifest = z.infer<typeof resetAccountManifestSchema>

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function fingerprintManifest(input: unknown): string {
  const withoutFingerprint = JSON.parse(JSON.stringify(input)) as { manifestFingerprint?: string }
  delete withoutFingerprint.manifestFingerprint
  return `sha256:${stableSha256(withoutFingerprint)}`
}

export function stableSha256(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex")
}

export function stableStringify(input: unknown): string {
  if (Array.isArray(input)) {
    return `[${input.map((value) => stableStringify(value)).join(",")}]`
  }
  if (input && typeof input === "object") {
    return `{${Object.entries(input as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${JSON.stringify(key)}:${stableStringify(value)}`)
      .join(",")}}`
  }
  return JSON.stringify(input)
}
