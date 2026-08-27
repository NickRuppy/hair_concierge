import { createHash } from "node:crypto"
import { execFile as execFileCallback } from "node:child_process"
import { access, chmod, mkdir, realpath, rm, stat, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { promisify } from "node:util"
import { buildModeratorResetPlan } from "./moderator-account-reset-plan"
import { normalizeEmail, ResetManifest } from "./moderator-account-reset-types"

const execFile = promisify(execFileCallback)

export type PreparedResetSqlArtifact = {
  readonly sqlPath: string
  readonly receiptPath: string
  readonly receipt: {
    readonly operation: string
    readonly batchId: string
    readonly accountCount: number
    readonly manifestSha256: string
    readonly manifestFingerprint: string
    readonly contentFingerprint: string
    readonly sqlSha256: string
    readonly preparationSha256: string
    readonly maintenanceJournalSha256?: string
    readonly transport: "reviewed_supabase_mcp_execute_sql"
    readonly applied: false
  }
}

export async function prepareResetSqlArtifact(input: {
  readonly manifestBytes: string
  readonly outputPath: string
  readonly maintenanceJournalBytes?: string
  readonly workingDirectory?: string
  readonly repositoryRoot?: string
}): Promise<PreparedResetSqlArtifact> {
  const plan = buildModeratorResetPlan(JSON.parse(input.manifestBytes) as unknown)
  if (plan.blockers.length > 0 || !plan.sql) {
    throw new Error(
      `refusing to write guarded SQL: ${plan.blockers.join("; ") || "no executable SQL"}`,
    )
  }

  const maintenanceJournalSha256 =
    plan.manifest.environment === "production"
      ? validateProductionMaintenanceJournal(plan.manifest, input.maintenanceJournalBytes)
      : undefined

  const sqlPath = await assertPrivateOutputPath(input.outputPath, {
    workingDirectory: input.workingDirectory,
    repositoryRoot: input.repositoryRoot,
  })
  const receiptPath = `${sqlPath}.receipt.json`
  await assertDoesNotExist(sqlPath)
  await assertDoesNotExist(receiptPath)

  const manifestSha256 = sha256(input.manifestBytes)
  const contentFingerprint = `sha256:${plan.contentFingerprint}`
  const sql = maintenanceJournalSha256
    ? `-- maintenance_journal_sha256: ${maintenanceJournalSha256}\n${plan.sql}`
    : plan.sql
  const sqlSha256 = sha256(sql)
  const receipt = {
    operation: plan.manifest.operation,
    batchId: plan.manifest.batchId,
    accountCount: plan.manifest.accounts.length,
    manifestSha256,
    manifestFingerprint: plan.manifest.manifestFingerprint,
    contentFingerprint,
    sqlSha256,
    preparationSha256: sha256(
      `${manifestSha256}\n${contentFingerprint}\n${sqlSha256}\n${maintenanceJournalSha256 ?? ""}`,
    ),
    ...(maintenanceJournalSha256 ? { maintenanceJournalSha256 } : {}),
    transport: "reviewed_supabase_mcp_execute_sql" as const,
    applied: false as const,
  }

  await writePrivateFile(sqlPath, sql)
  try {
    await writePrivateFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  } catch (error) {
    await rm(sqlPath, { force: true })
    throw error
  }
  return { sqlPath, receiptPath, receipt }
}

function validateProductionMaintenanceJournal(
  manifest: ResetManifest,
  journalBytes: string | undefined,
): string {
  if (!journalBytes) throw new Error("production prepare-sql requires --maintenance-journal")
  const journal = parseMaintenanceJournal(journalBytes)
  if (journal.operation !== "moderator_auth_maintenance") {
    throw new Error("maintenance journal operation must be moderator_auth_maintenance")
  }
  if (journal.batchId !== manifest.batchId) {
    throw new Error("maintenance journal batchId does not match manifest")
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(journal.manifestFingerprint)) {
    throw new Error("maintenance journal manifestFingerprint must be a sha256 fingerprint")
  }
  if (journal.partialRecovery) throw new Error("maintenance journal reports partial recovery")
  if (journal.errors.length > 0) throw new Error("maintenance journal recorded errors")
  if (journal.accounts.length !== manifest.accounts.length) {
    throw new Error("maintenance journal account count does not match manifest")
  }

  const journalByIdentity = new Map(
    journal.accounts.map((account) => [`${account.id}:${normalizeEmail(account.email)}`, account]),
  )
  if (journalByIdentity.size !== journal.accounts.length) {
    throw new Error("maintenance journal contains duplicate account identities")
  }
  for (const account of manifest.accounts) {
    const identity = `${account.userId}:${normalizeEmail(account.email)}`
    const evidence = journalByIdentity.get(identity)
    if (!evidence)
      throw new Error(`maintenance journal is missing manifest account ${account.userId}`)
    if (evidence.stage !== "banned") {
      throw new Error(`maintenance journal account ${account.userId} did not reach banned stage`)
    }
    const proof = account.authMaintenanceProof
    if (!proof) throw new Error(`manifest account ${account.userId} lacks Auth maintenance proof`)
    if (evidence.signedOutAt !== proof.sessionsRevokedAt) {
      throw new Error(
        `maintenance journal signedOutAt does not match manifest for ${account.userId}`,
      )
    }
    if (evidence.loginRestrictedAt !== proof.loginRestrictedAt) {
      throw new Error(
        `maintenance journal loginRestrictedAt does not match manifest for ${account.userId}`,
      )
    }
    if (
      !proof.paymentReplayCutoffAt ||
      evidence.paymentReplayCutoffAt !== proof.paymentReplayCutoffAt
    ) {
      throw new Error(
        `maintenance journal paymentReplayCutoffAt does not match manifest for ${account.userId}`,
      )
    }
    const cutoffAt = Date.parse(evidence.paymentReplayCutoffAt)
    if (!Number.isFinite(cutoffAt) || cutoffAt > Date.parse(evidence.loginRestrictedAt)) {
      throw new Error(`maintenance journal payment replay cutoff is invalid for ${account.userId}`)
    }
    const jwtIssuedAt = Date.parse(evidence.jwtIssuedAt)
    const jwtExpiresAt = Date.parse(evidence.jwtExpiresAt)
    const jwtDurationSeconds = (jwtExpiresAt - jwtIssuedAt) / 1000
    if (
      !Number.isFinite(jwtIssuedAt) ||
      !Number.isFinite(jwtExpiresAt) ||
      !Number.isInteger(jwtDurationSeconds) ||
      jwtDurationSeconds <= 0
    ) {
      throw new Error(`maintenance journal JWT bounds are invalid for ${account.userId}`)
    }
    if (
      proof.jwtExpiresAfterSeconds < jwtDurationSeconds + 120 ||
      proof.jwtExpiresAfterSeconds < 3720
    ) {
      throw new Error(`manifest JWT lifetime is shorter than hosted evidence for ${account.userId}`)
    }
    const signedOutAt = Date.parse(evidence.signedOutAt)
    const loginRestrictedAt = Date.parse(evidence.loginRestrictedAt)
    const workerQueueDrainedAt = Date.parse(proof.workerQueueDrainedAt)
    const earliestResetAt = Date.parse(proof.earliestResetAt)
    if (
      [signedOutAt, loginRestrictedAt, workerQueueDrainedAt, earliestResetAt].some(Number.isNaN)
    ) {
      throw new Error(`maintenance journal or manifest timing is invalid for ${account.userId}`)
    }
    const deadline =
      Math.max(
        jwtExpiresAt,
        signedOutAt + proof.jwtExpiresAfterSeconds * 1000,
        loginRestrictedAt + proof.jwtExpiresAfterSeconds * 1000,
        workerQueueDrainedAt,
      ) +
      Math.max(300, proof.inFlightDrainSeconds) * 1000
    if (earliestResetAt < deadline) {
      throw new Error(
        `manifest earliestResetAt is before the journal maintenance deadline for ${account.userId}`,
      )
    }
    if (Date.parse(manifest.createdAt) < deadline) {
      throw new Error(
        `manifest createdAt is before the journal maintenance deadline for ${account.userId}`,
      )
    }
  }
  return sha256(journalBytes)
}

function parseMaintenanceJournal(input: string): {
  operation: string
  batchId: string
  manifestFingerprint: string
  partialRecovery: boolean
  errors: unknown[]
  accounts: Array<{
    id: string
    email: string
    stage: string
    signedOutAt: string
    loginRestrictedAt: string
    paymentReplayCutoffAt: string
    jwtIssuedAt: string
    jwtExpiresAt: string
  }>
} {
  const value = JSON.parse(input) as Record<string, unknown>
  if (!value || typeof value !== "object" || !Array.isArray(value.accounts)) {
    throw new Error("maintenance journal must be a JSON object with accounts")
  }
  const accounts = value.accounts.map((account) => {
    const item = account as Record<string, unknown>
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.email !== "string" ||
      typeof item.stage !== "string" ||
      typeof item.signedOutAt !== "string" ||
      typeof item.loginRestrictedAt !== "string" ||
      typeof item.paymentReplayCutoffAt !== "string" ||
      typeof item.jwtIssuedAt !== "string" ||
      typeof item.jwtExpiresAt !== "string"
    ) {
      throw new Error("maintenance journal account has invalid shape")
    }
    return {
      id: item.id,
      email: item.email,
      stage: item.stage,
      signedOutAt: item.signedOutAt,
      loginRestrictedAt: item.loginRestrictedAt,
      paymentReplayCutoffAt: item.paymentReplayCutoffAt,
      jwtIssuedAt: item.jwtIssuedAt,
      jwtExpiresAt: item.jwtExpiresAt,
    }
  })
  if (
    typeof value.operation !== "string" ||
    typeof value.batchId !== "string" ||
    typeof value.manifestFingerprint !== "string" ||
    typeof value.partialRecovery !== "boolean" ||
    !Array.isArray(value.errors)
  ) {
    throw new Error("maintenance journal has invalid header")
  }
  return {
    operation: value.operation,
    batchId: value.batchId,
    manifestFingerprint: value.manifestFingerprint,
    partialRecovery: value.partialRecovery,
    errors: value.errors,
    accounts,
  }
}

export async function assertPrivateOutputPath(
  outputPath: string,
  options: { readonly workingDirectory?: string; readonly repositoryRoot?: string } = {},
): Promise<string> {
  const workingDirectory = options.workingDirectory ?? process.cwd()
  const repositoryRoot = options.repositoryRoot ?? (await discoverRepositoryRoot(workingDirectory))
  const candidate = await resolveThroughNearestExistingAncestor(resolve(outputPath))
  const protectedRepositoryRoot = await resolveThroughNearestExistingAncestor(
    resolve(repositoryRoot),
  )
  if (isWithin(protectedRepositoryRoot, candidate)) {
    throw new Error("--output must be outside the repository root and its worktree tree")
  }
  await ensurePrivateParent(dirname(candidate))
  return candidate
}

export async function assertPrivateInputPath(
  inputPath: string,
  options: { readonly workingDirectory?: string; readonly repositoryRoot?: string } = {},
): Promise<string> {
  const workingDirectory = options.workingDirectory ?? process.cwd()
  const repositoryRoot = options.repositoryRoot ?? (await discoverRepositoryRoot(workingDirectory))
  const candidate = await resolveThroughNearestExistingAncestor(resolve(inputPath))
  const protectedRepositoryRoot = await resolveThroughNearestExistingAncestor(
    resolve(repositoryRoot),
  )
  if (isWithin(protectedRepositoryRoot, candidate)) {
    throw new Error(
      "--maintenance-journal must be outside the repository root and its worktree tree",
    )
  }
  const metadata = await stat(candidate)
  if (!metadata.isFile()) throw new Error("--maintenance-journal must be a regular file")
  if ((metadata.mode & 0o077) !== 0) {
    throw new Error("--maintenance-journal must be private (mode 0600 or stricter)")
  }
  return candidate
}

export function buildRedactedResetReport(plan: ReturnType<typeof buildModeratorResetPlan>) {
  return {
    operation: plan.manifest.operation,
    environment: plan.manifest.environment,
    projectRef: plan.manifest.projectRef,
    batchId: plan.manifest.batchId,
    accountCount: plan.manifest.accounts.length,
    manifestFingerprint: plan.manifest.manifestFingerprint,
    contentFingerprint: `sha256:${plan.contentFingerprint}`,
    executableOfflineSql: plan.blockers.length === 0,
    applySupportedByThisCommand: false,
    blockers: plan.blockers,
    warnings: plan.warnings,
  }
}

async function writePrivateFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, { encoding: "utf8", mode: 0o600, flag: "wx" })
  await chmod(path, 0o600)
}

async function discoverRepositoryRoot(workingDirectory: string): Promise<string> {
  try {
    const { stdout } = await execFile(
      "git",
      ["-C", workingDirectory, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8" },
    )
    const commonDirectory = stdout.trim()
    if (commonDirectory) return dirname(commonDirectory)
  } catch {
    // Test callers and non-git invocations retain the explicit working-directory boundary.
  }
  return workingDirectory
}

async function resolveThroughNearestExistingAncestor(path: string): Promise<string> {
  const remaining: string[] = []
  let cursor = path
  while (true) {
    try {
      return resolve(await realpath(cursor), ...remaining)
    } catch {
      const parent = dirname(cursor)
      if (parent === cursor) throw new Error(`cannot resolve private output path ${path}`)
      remaining.unshift(cursor.slice(parent.length + (parent.endsWith("/") ? 0 : 1)))
      cursor = parent
    }
  }
}

async function ensurePrivateParent(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 })
  const metadata = await stat(path)
  if (!metadata.isDirectory()) throw new Error("--output parent must be a directory")
  if ((metadata.mode & 0o077) !== 0) {
    throw new Error("--output parent must already be private (mode 0700 or stricter)")
  }
}

async function assertDoesNotExist(path: string): Promise<void> {
  try {
    await access(path)
  } catch {
    return
  }
  throw new Error(`refusing to overwrite existing private artifact ${path}`)
}

function isWithin(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate)
  return (
    path === "" ||
    (!path.startsWith("..") && !path.includes(`..${process.platform === "win32" ? "\\" : "/"}`))
  )
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
