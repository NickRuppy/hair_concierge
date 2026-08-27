#!/usr/bin/env tsx
/** Exact-batch Auth restriction operator. It never resets application data. */
import { readFile, writeFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  fingerprintManifest,
  normalizeEmail,
  resetManifestSchema,
} from "./lib/moderator-account-reset-types"
import { assertPrivateOutputPath } from "./lib/moderator-account-reset-execution"
import { MODERATOR_RESET_CUTOFF_KEY } from "../src/lib/billing/moderator-reset-cutoff"

export const MAINTENANCE_PROJECT = "pqdkhefxsxkyeqelqegq"
// PostgREST permits JWT clock skew; this is deliberately larger than its 30-second allowance.
export const JWT_ACCEPTANCE_MARGIN_MS = 120_000
const BAN_DURATION = "24h"
const RESET_REQUEST_DRAIN_MS = 300_000
type AuthError = { status?: number; code?: string }
type User = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  banned_until?: string | null
  app_metadata?: Record<string, unknown> | null
}
type Session = { access_token: string; expires_at?: number | null }
type Outcome<T> = { data: T | null; error: AuthError | null }
export type MaintenanceOperations = {
  getUser(id: string): Promise<Outcome<User>>
  generateLink(email: string): Promise<Outcome<{ user: User; hashedToken: string }>>
  verifyOtp(hash: string): Promise<Outcome<{ user: User; session: Session }>>
  globalSignOut(jwt: string): Promise<Outcome<unknown>>
  ban(id: string, duration: string, paymentReplayCutoffAt: string): Promise<Outcome<User>>
}
export type MaintenanceAccount = {
  id: string
  email: string
  stage: "preflight" | "attempting" | "signed_out" | "banned"
  jwtIssuedAt: string | null
  jwtExpiresAt: string | null
  signedOutAt: string | null
  loginRestrictedAt: string | null
  bannedUntil: string | null
  preexistingBannedUntil: string | null
  paymentReplayCutoffAt: string | null
}
export type MaintenanceJournal = {
  operation: "moderator_auth_maintenance"
  batchId: string
  manifestFingerprint: string
  startedAt: string
  accounts: MaintenanceAccount[]
  tokenExpiryDeadline: string | null
  earliestResetWithDrain: string | null
  requiredResidualProof: "zero-session-and-refresh-token SQL sweep plus worker drain timestamp required"
  partialRecovery: boolean
  needsManualRecovery: boolean
  errors: Array<{ step: string; status: number | null; code: string | null }>
}
export type ParsedCommand = {
  action: "dry-run" | "apply" | "restore"
  manifestPath: string | null
  project: string | null
  approveFingerprint: string | null
  receiptDir: string | null
  journalPath: string | null
  resetResidualProofPath: string | null
}

export function parseMaintenanceCommand(argv: readonly string[]): ParsedCommand {
  const [rawAction = "dry-run"] = argv
  if (rawAction !== "dry-run" && rawAction !== "apply" && rawAction !== "restore")
    throw new Error("first argument must be dry-run, apply, or restore")
  const command: ParsedCommand = {
    action: rawAction,
    manifestPath: null,
    project: null,
    approveFingerprint: null,
    receiptDir: null,
    journalPath: null,
    resetResidualProofPath: null,
  }
  const names: Record<string, keyof ParsedCommand> = {
    "--manifest": "manifestPath",
    "--project": "project",
    "--approve-fingerprint": "approveFingerprint",
    "--receipt-dir": "receiptDir",
    "--journal": "journalPath",
    "--reset-residual-proof": "resetResidualProofPath",
  }
  for (let i = 1; i < argv.length; i += 1) {
    const flag = argv[i]
    const key = names[flag]
    if (!key) throw new Error(`unknown or unsafe argument ${flag}`)
    const value = argv[++i]
    if (!value) throw new Error(`${flag} requires a value`)
    command[key] = value as never
  }
  if (command.action === "apply") {
    if (
      !command.manifestPath ||
      command.project !== MAINTENANCE_PROJECT ||
      !command.approveFingerprint ||
      !command.receiptDir
    )
      throw new Error(
        "apply requires --manifest, exact --project, --approve-fingerprint, and external --receipt-dir",
      )
    if (insideRepository(command.receiptDir))
      throw new Error("--receipt-dir must be outside the repository")
  }
  if (
    command.action === "restore" &&
    (!command.journalPath ||
      !command.resetResidualProofPath ||
      command.project !== MAINTENANCE_PROJECT ||
      !command.approveFingerprint)
  )
    throw new Error(
      "restore requires exact journal, residual proof, project, and approved fingerprint",
    )
  return command
}
function insideRepository(candidate: string) {
  const path = relative(resolve(process.cwd()), resolve(candidate))
  return path === "" || (!path.startsWith("..") && !path.includes("/../"))
}
function errorShape(error: unknown): AuthError {
  const v =
    error && typeof error === "object" ? (error as { status?: unknown; code?: unknown }) : {}
  return {
    ...(typeof v.status === "number" ? { status: v.status } : {}),
    ...(typeof v.code === "string" ? { code: v.code } : {}),
  }
}
function record(journal: MaintenanceJournal, step: string, error: unknown) {
  const v = errorShape(error)
  journal.errors.push({ step, status: v.status ?? null, code: v.code ?? null })
}
function expiry(session: Session) {
  try {
    const value = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"),
    ) as { iat?: number; exp?: number; sub?: string }
    return {
      iat: typeof value.iat === "number" ? new Date(value.iat * 1000).toISOString() : null,
      exp:
        typeof value.exp === "number"
          ? new Date(value.exp * 1000).toISOString()
          : typeof session.expires_at === "number"
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
      sub: typeof value.sub === "string" ? value.sub : null,
    }
  } catch {
    return { iat: null, exp: null, sub: null }
  }
}
export function validateMaintenanceUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== `${MAINTENANCE_PROJECT}.supabase.co` ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL must be https://${MAINTENANCE_PROJECT}.supabase.co`)
  return url.toString().replace(/\/$/, "")
}
function isUnbanned(user: User, now: number) {
  return !user.banned_until || Date.parse(user.banned_until) <= now
}
function identityMatches(user: User, id: string, email: string) {
  return (
    user.id === id && normalizeEmail(user.email ?? "") === email && user.email_confirmed_at != null
  )
}
function metadataPreserved(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null | undefined,
) {
  if (!before) return true
  if (!after) return false
  return Object.entries(before).every(
    ([key, value]) => JSON.stringify(after[key]) === JSON.stringify(value),
  )
}

export async function applyMaintenance(
  manifestInput: unknown,
  approvedFingerprint: string,
  operations: MaintenanceOperations,
  writeJournal: (journal: MaintenanceJournal) => Promise<void>,
  now = () => Date.now(),
): Promise<MaintenanceJournal> {
  const manifest = resetManifestSchema.parse(manifestInput)
  if (
    manifest.environment !== "production" ||
    manifest.projectRef !== MAINTENANCE_PROJECT ||
    manifest.accounts.length > 5
  )
    throw new Error("manifest must be the exact production batch with at most five accounts")
  const normalizedEmails = manifest.accounts.map((account) => normalizeEmail(account.email))
  if (
    manifest.externalProof.productionOperationApproval !== "approved_exact_batch" ||
    manifest.operatorApprovedTargetCount !== manifest.accounts.length ||
    new Set(manifest.accounts.map((account) => account.userId)).size !== manifest.accounts.length ||
    new Set(normalizedEmails).size !== manifest.accounts.length ||
    manifest.accounts.some(
      (account) => normalizeEmail(account.email) !== normalizeEmail(account.expectedAuthEmail),
    )
  )
    throw new Error("manifest must have exact approved unique id/email recipients")
  if (
    manifest.manifestFingerprint !== fingerprintManifest(manifest) ||
    approvedFingerprint !== manifest.manifestFingerprint
  )
    throw new Error("manifest fingerprint approval mismatch")
  const journal: MaintenanceJournal = {
    operation: "moderator_auth_maintenance",
    batchId: manifest.batchId,
    manifestFingerprint: manifest.manifestFingerprint,
    startedAt: new Date(now()).toISOString(),
    accounts: manifest.accounts.map((a) => ({
      id: a.userId,
      email: normalizeEmail(a.expectedAuthEmail),
      stage: "preflight",
      jwtIssuedAt: null,
      jwtExpiresAt: null,
      signedOutAt: null,
      loginRestrictedAt: null,
      bannedUntil: null,
      preexistingBannedUntil: null,
      paymentReplayCutoffAt: null,
    })),
    tokenExpiryDeadline: null,
    earliestResetWithDrain: null,
    requiredResidualProof:
      "zero-session-and-refresh-token SQL sweep plus worker drain timestamp required",
    partialRecovery: false,
    needsManualRecovery: false,
    errors: [],
  }
  const preexistingMetadataById = new Map<string, Record<string, unknown> | null>()
  // All identities must be checked before the initial durable journal or any mutation.
  for (const account of journal.accounts) {
    try {
      const check = await operations.getUser(account.id)
      if (
        check.error ||
        !check.data ||
        !identityMatches(check.data, account.id, account.email) ||
        !isUnbanned(check.data, now())
      ) {
        record(journal, `preflight:${account.id}`, check.error)
        throw new Error("auth preflight failed")
      }
      account.preexistingBannedUntil = check.data.banned_until ?? null
      preexistingMetadataById.set(account.id, check.data.app_metadata ?? null)
    } catch (error) {
      record(journal, `preflight:${account.id}`, error)
      throw new Error("auth preflight failed")
    }
  }
  await writeJournal(journal)
  for (const account of journal.accounts) {
    try {
      account.stage = "attempting"
      journal.needsManualRecovery = true
      await writeJournal(journal)
      const link = await operations.generateLink(account.email)
      if (link.error || !link.data || !identityMatches(link.data.user, account.id, account.email)) {
        record(journal, `generate:${account.id}`, link.error)
        throw new Error("maintenance link identity failed")
      }
      const verified = await operations.verifyOtp(link.data.hashedToken)
      if (
        verified.error ||
        !verified.data ||
        !identityMatches(verified.data.user, account.id, account.email)
      ) {
        record(journal, `verify:${account.id}`, verified.error)
        throw new Error("maintenance OTP identity failed")
      }
      const timing = expiry(verified.data.session)
      account.jwtIssuedAt = timing.iat
      account.jwtExpiresAt = timing.exp
      if (
        !timing.iat ||
        !timing.exp ||
        timing.sub !== account.id ||
        Date.parse(timing.exp) <= now() ||
        Date.parse(timing.exp) - Date.parse(timing.iat) > 86_400_000
      ) {
        record(journal, `jwt:${account.id}`, {})
        throw new Error("maintenance JWT timing or subject invalid")
      }
      const signedOut = await operations.globalSignOut(verified.data.session.access_token)
      if (signedOut.error) {
        record(journal, `signout:${account.id}`, signedOut.error)
        throw new Error("global signout failed")
      }
      account.stage = "signed_out"
      account.signedOutAt = new Date(now()).toISOString()
      await writeJournal(journal)
      const paymentReplayCutoffAt = new Date(now()).toISOString()
      const preexistingMetadata = preexistingMetadataById.get(account.id) ?? null
      const banned = await operations.ban(account.id, BAN_DURATION, paymentReplayCutoffAt)
      if (
        banned.error ||
        !banned.data ||
        !identityMatches(banned.data, account.id, account.email)
      ) {
        record(journal, `ban:${account.id}`, banned.error)
        throw new Error("ban failed")
      }
      const bannedUntil = Date.parse(banned.data.banned_until ?? "")
      if (!Number.isFinite(bannedUntil) || bannedUntil < now() + 23 * 60 * 60 * 1000) {
        record(journal, `banWindow:${account.id}`, {})
        throw new Error("ban response did not prove future restriction")
      }
      account.stage = "banned"
      account.loginRestrictedAt = new Date(now()).toISOString()
      account.bannedUntil = banned.data.banned_until ?? null
      account.paymentReplayCutoffAt = paymentReplayCutoffAt
      if (
        banned.data.app_metadata?.[MODERATOR_RESET_CUTOFF_KEY] !== paymentReplayCutoffAt ||
        !metadataPreserved(preexistingMetadata, banned.data.app_metadata)
      ) {
        record(journal, `banMetadata:${account.id}`, {})
        throw new Error("ban response did not preserve metadata or marker")
      }
      const deadlines = journal.accounts
        .filter(
          (a) => a.stage === "banned" && a.loginRestrictedAt && a.jwtIssuedAt && a.jwtExpiresAt,
        )
        .map((a) => {
          const issuedAt = Date.parse(a.jwtIssuedAt!)
          const expiresAt = Date.parse(a.jwtExpiresAt!)
          const restrictedAt = Date.parse(a.loginRestrictedAt!)
          const observedLifetime = Math.max(3_600_000, expiresAt - issuedAt)
          return Math.max(expiresAt, restrictedAt + observedLifetime)
        })
      const lastPossibleAcceptedJwtAt = deadlines.length ? Math.max(...deadlines) : Number.NaN
      const expiryDeadline = Number.isFinite(lastPossibleAcceptedJwtAt)
        ? lastPossibleAcceptedJwtAt + JWT_ACCEPTANCE_MARGIN_MS
        : Number.NaN
      journal.tokenExpiryDeadline = Number.isFinite(expiryDeadline)
        ? new Date(expiryDeadline).toISOString()
        : null
      // Worker queue drain is external evidence; this is only the JWT acceptance+drain lower bound.
      journal.earliestResetWithDrain = Number.isFinite(expiryDeadline)
        ? new Date(expiryDeadline + RESET_REQUEST_DRAIN_MS).toISOString()
        : null
      await writeJournal(journal)
    } catch (error) {
      journal.partialRecovery = true
      journal.needsManualRecovery = true
      record(journal, `halt:${account.id}`, error)
      try {
        await writeJournal(journal)
      } catch (writeError) {
        record(journal, `haltJournal:${account.id}`, writeError)
      }
      return journal
    }
  }
  return journal
}

export async function prepareRestore(
  journalInput: unknown,
  residualProofInput: unknown,
  approvedFingerprint: string,
) {
  const journal = journalInput as Partial<MaintenanceJournal>
  const proof = residualProofInput as { manifestFingerprint?: unknown; accounts?: unknown }
  if (
    journal.operation !== "moderator_auth_maintenance" ||
    journal.manifestFingerprint !== approvedFingerprint ||
    proof.manifestFingerprint !== approvedFingerprint ||
    !Array.isArray(proof.accounts)
  )
    throw new Error("restore proof does not match exact maintenance journal")
  const journalAccounts = Array.isArray(journal.accounts) ? journal.accounts : []
  const proofAccounts = proof.accounts as Array<{ id?: unknown; email?: unknown }>
  const exactAccounts =
    journalAccounts.length > 0 &&
    journalAccounts.length === proofAccounts.length &&
    journalAccounts.every((account) =>
      proofAccounts.some(
        (proofAccount) =>
          proofAccount.id === account.id &&
          proofAccount.email === account.email &&
          account.stage === "banned",
      ),
    )
  if (!exactAccounts)
    throw new Error("restore proof does not contain the exact journal id/email batch")
  throw new Error(
    "restore is intentionally stopped: root must review the supported residual SQL proof and invoke the supported Auth restore API",
  )
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} required`)
  return value
}
function hostedOperations(): MaintenanceOperations {
  const url = validateMaintenanceUrl(requireEnv("NEXT_PUBLIC_SUPABASE_URL"))
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const service = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const user = (r: { data: { user: User | null }; error: AuthError | null }): Outcome<User> => ({
    data: r.data.user,
    error: r.error,
  })
  return {
    async getUser(id) {
      return user(await admin.auth.admin.getUserById(id))
    },
    async generateLink(email) {
      const r = await admin.auth.admin.generateLink({ type: "magiclink", email })
      const hash = r.data.properties?.hashed_token
      return {
        data:
          r.data.user && typeof hash === "string" ? { user: r.data.user, hashedToken: hash } : null,
        error: r.error,
      }
    },
    async verifyOtp(hash) {
      const r = await client.auth.verifyOtp({ type: "magiclink", token_hash: hash })
      return {
        data: r.data.user && r.data.session ? { user: r.data.user, session: r.data.session } : null,
        error: r.error,
      }
    },
    async globalSignOut(jwt) {
      const r = await admin.auth.admin.signOut(jwt, "global")
      return { data: r.error ? null : {}, error: r.error }
    },
    async ban(id, duration, paymentReplayCutoffAt) {
      return user(
        await admin.auth.admin.updateUserById(id, {
          ban_duration: duration,
          app_metadata: { [MODERATOR_RESET_CUTOFF_KEY]: paymentReplayCutoffAt },
        }),
      )
    },
  }
}
async function main() {
  const command = parseMaintenanceCommand(process.argv.slice(2))
  if (command.action === "dry-run") {
    console.log(JSON.stringify({ dryRun: true, network: false }, null, 2))
    return
  }
  if (command.action === "restore") {
    await prepareRestore(
      JSON.parse(await readFile(command.journalPath!, "utf8")),
      JSON.parse(await readFile(command.resetResidualProofPath!, "utf8")),
      command.approveFingerprint!,
    )
    return
  }
  const manifest = JSON.parse(await readFile(command.manifestPath!, "utf8"))
  const directory = command.receiptDir!
  const output = await assertPrivateOutputPath(
    resolve(directory, `moderator-account-maintenance-${Date.now()}.json`),
  )
  const result = await applyMaintenance(
    manifest,
    command.approveFingerprint!,
    hostedOperations(),
    (journal) => writeFile(output, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 }),
  )
  console.log(
    JSON.stringify(
      {
        success: result.errors.length === 0,
        accountCount: result.accounts.length,
        stages: result.accounts.map((account) => account.stage),
        privateJournal: output,
      },
      null,
      2,
    ),
  )
  if (result.errors.length) process.exitCode = 2
}
if (process.argv[1]?.endsWith("moderator-account-maintenance.ts"))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
