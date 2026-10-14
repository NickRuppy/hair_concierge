import assert from "node:assert/strict"
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { resetInventoryTableNames } from "../scripts/lib/moderator-account-reset-inventory"
import {
  buildRedactedResetReport,
  prepareResetSqlArtifact,
} from "../scripts/lib/moderator-account-reset-execution"
import { buildModeratorResetPlan } from "../scripts/lib/moderator-account-reset-plan"
import {
  MODERATOR_RESET_OPERATION,
  MODERATOR_RESET_SCHEMA_VERSION,
  ResetManifest,
  fingerprintManifest,
} from "../scripts/lib/moderator-account-reset-types"
import {
  applyMaintenance,
  type MaintenanceOperations,
} from "../scripts/moderator-account-maintenance"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const EMAIL = "moderator@example.test"
const GRANT_ID = "22222222-2222-4222-8222-222222222222"

test("uses manifest bytes as the sole plan input and refuses blocked bytes before writing", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const output = join(root, "guarded.sql")
  const manifest = validManifest()
  manifest.externalProof.storageObjectsRemoved = false
  const finalized = withFingerprint(manifest)

  await assert.rejects(
    prepareResetSqlArtifact({
      manifestBytes: JSON.stringify(finalized),
      outputPath: output,
      workingDirectory: join(root, "repo"),
      repositoryRoot: join(root, "repo"),
    }),
    /refusing to write guarded SQL: external proof incomplete: storageObjectsRemoved/,
  )
  await assert.rejects(stat(output))
})

test("refuses repository output paths without writing a private artifact", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const output = join(root, "repo", "guarded.sql")
  const manifest = withFingerprint(validManifest())

  await assert.rejects(
    prepareResetSqlArtifact({
      manifestBytes: JSON.stringify(manifest),
      outputPath: output,
      workingDirectory: join(root, "repo"),
      repositoryRoot: join(root, "repo"),
    }),
    /--output must be outside the repository root and its worktree tree/,
  )
  await assert.rejects(stat(output))
})

test("refuses main-root, symlinked, and not-yet-created worktree descendants", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repositoryRoot = join(root, "main")
  const worktree = join(repositoryRoot, ".worktrees", "task")
  await mkdir(worktree, { recursive: true, mode: 0o700 })
  await symlink(repositoryRoot, join(root, "main-alias"))
  const manifest = withFingerprint(validManifest())

  for (const output of [
    join(repositoryRoot, "private.sql"),
    join(root, "main-alias", ".worktrees", "new-task", "nested", "guarded.sql"),
  ]) {
    await assert.rejects(
      prepareResetSqlArtifact({
        manifestBytes: JSON.stringify(manifest),
        outputPath: output,
        workingDirectory: worktree,
        repositoryRoot,
      }),
      /--output must be outside the repository root and its worktree tree/,
    )
    await assert.rejects(stat(output))
  }
})

test("requires an existing output parent to already be private", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const parent = join(root, "shared-parent")
  await mkdir(parent, { mode: 0o700 })
  await chmod(parent, 0o755)
  const manifest = withFingerprint(validManifest())
  const output = join(parent, "guarded.sql")

  await assert.rejects(
    prepareResetSqlArtifact({
      manifestBytes: JSON.stringify(manifest),
      outputPath: output,
      workingDirectory: join(root, "repo"),
      repositoryRoot: join(root, "repo"),
    }),
    /--output parent must already be private/,
  )
  await assert.rejects(stat(output))
})

test("production preparation refuses a missing, mismatched, or shortened maintenance journal", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const manifest = productionManifest()
  const output = join(root, "private", "guarded.sql")
  const shared = {
    manifestBytes: JSON.stringify(manifest),
    outputPath: output,
    workingDirectory: join(root, "repo"),
    repositoryRoot: join(root, "repo"),
  }

  await assert.rejects(
    prepareResetSqlArtifact(shared),
    /production prepare-sql requires --maintenance-journal/,
  )
  await assert.rejects(stat(output))

  const mismatched = maintenanceJournal(manifest)
  mismatched.accounts[0].email = "another@example.test"
  await assert.rejects(
    prepareResetSqlArtifact({ ...shared, maintenanceJournalBytes: JSON.stringify(mismatched) }),
    /maintenance journal is missing manifest account/,
  )
  await assert.rejects(stat(output))

  for (const cutoff of [undefined, "2026-08-27T11:00:00.000Z"]) {
    const cutoffJournal = maintenanceJournal(manifest)
    cutoffJournal.accounts[0].paymentReplayCutoffAt = cutoff
    await assert.rejects(
      prepareResetSqlArtifact({
        ...shared,
        maintenanceJournalBytes: JSON.stringify(cutoffJournal),
      }),
      /invalid shape|paymentReplayCutoffAt does not match/,
    )
    await assert.rejects(stat(output))
  }

  const shortenedManifest = productionManifest()
  shortenedManifest.accounts[0].authMaintenanceProof!.jwtExpiresAfterSeconds = 3599
  const finalizedShortened = withFingerprint(shortenedManifest)
  await assert.rejects(
    prepareResetSqlArtifact({
      ...shared,
      manifestBytes: JSON.stringify(finalizedShortened),
      maintenanceJournalBytes: JSON.stringify(maintenanceJournal(finalizedShortened)),
    }),
    /manifest JWT lifetime is shorter than hosted evidence/,
  )
  await assert.rejects(stat(output))
})

test("production preparation binds a valid maintenance journal into the SQL header and receipt", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const manifest = productionManifest()
  const journalBytes = JSON.stringify(maintenanceJournal(manifest))
  const artifact = await prepareResetSqlArtifact({
    manifestBytes: JSON.stringify(manifest),
    maintenanceJournalBytes: journalBytes,
    outputPath: join(root, "private", "guarded.sql"),
    workingDirectory: join(root, "repo"),
    repositoryRoot: join(root, "repo"),
  })

  assert.ok(artifact.receipt.maintenanceJournalSha256)
  assert.match(
    await readFile(artifact.sqlPath, "utf8"),
    new RegExp(`maintenance_journal_sha256: ${artifact.receipt.maintenanceJournalSha256}`),
  )
})

test("production preparation waits out a JWT that could be minted before a delayed ban", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const manifest = productionManifest()
  manifest.accounts[0].authMaintenanceProof!.loginRestrictedAt = "2026-08-27T12:20:00.000Z"
  const delayedBanManifest = withFingerprint(manifest)
  const delayedBanJournal = maintenanceJournal(delayedBanManifest)
  delayedBanJournal.accounts[0].loginRestrictedAt = "2026-08-27T12:20:00.000Z"
  const shared = {
    maintenanceJournalBytes: JSON.stringify(delayedBanJournal),
    outputPath: join(root, "private", "guarded.sql"),
    workingDirectory: join(root, "repo"),
    repositoryRoot: join(root, "repo"),
  }

  await assert.rejects(
    prepareResetSqlArtifact({ ...shared, manifestBytes: JSON.stringify(delayedBanManifest) }),
    /earliestResetAt does not wait out the actual JWT lifetime after session revocation and login restriction/,
  )

  delayedBanManifest.accounts[0].authMaintenanceProof!.earliestResetAt = "2026-08-27T13:27:00.000Z"
  delayedBanManifest.createdAt = "2026-08-27T13:30:00.000Z"
  const safeManifest = withFingerprint(delayedBanManifest)
  const artifact = await prepareResetSqlArtifact({
    ...shared,
    manifestBytes: JSON.stringify(safeManifest),
  })
  assert.ok(artifact.receipt.maintenanceJournalSha256)
})

test("production preparation consumes the actual applyMaintenance journal contract", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const manifest = productionManifest()
  manifest.accounts[0].authMaintenanceProof!.loginRestrictedAt = "2026-08-27T12:05:00.000Z"
  manifest.accounts[0].authMaintenanceProof!.paymentReplayCutoffAt = "2026-08-27T12:05:00.000Z"
  const finalized = withFingerprint(manifest)
  const now = Date.parse("2026-08-27T12:05:00.000Z")
  const user = {
    id: USER_ID,
    email: EMAIL,
    email_confirmed_at: "2026-08-26T12:00:00.000Z",
    banned_until: null as string | null,
    app_metadata: {} as Record<string, unknown>,
  }
  const operations: MaintenanceOperations = {
    async getUser() {
      return { data: user, error: null }
    },
    async generateLink() {
      return { data: { user, hashedToken: "fixture-hash" }, error: null }
    },
    async verifyOtp() {
      return {
        data: {
          user,
          session: {
            access_token: `x.${Buffer.from(
              JSON.stringify({ iat: 1787832000, exp: 1787835600, sub: USER_ID }),
            ).toString("base64url")}.x`,
          },
        },
        error: null,
      }
    },
    async globalSignOut() {
      return { data: {}, error: null }
    },
    async ban(_id, _duration, cutoffAt) {
      user.app_metadata.moderator_reset_cutoff_at = cutoffAt
      user.banned_until = "2026-08-28T12:05:00.000Z"
      return { data: user, error: null }
    },
  }
  const journal = await applyMaintenance(
    finalized,
    finalized.manifestFingerprint,
    operations,
    async () => {},
    () => now,
  )
  assert.equal(journal.batchId, finalized.batchId)
  assert.equal(journal.accounts[0].stage, "banned")
  assert.equal(journal.errors.length, 0)

  const artifact = await prepareResetSqlArtifact({
    manifestBytes: JSON.stringify(finalized),
    maintenanceJournalBytes: JSON.stringify(journal),
    outputPath: join(root, "private", "guarded.sql"),
    workingDirectory: join(root, "repo"),
    repositoryRoot: join(root, "repo"),
  })
  assert.ok(artifact.receipt.maintenanceJournalSha256)
})

test("writes private SQL and a redacted receipt without applying or making a network call", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "moderator-reset-execution-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const manifest = withFingerprint(validManifest())
  const manifestBytes = JSON.stringify(manifest)
  const output = join(root, "private", "guarded.sql")
  const originalFetch = globalThis.fetch
  globalThis.fetch = (() => {
    throw new Error("network must not be called by SQL preparation")
  }) as typeof fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  const artifact = await prepareResetSqlArtifact({
    manifestBytes,
    outputPath: output,
    workingDirectory: join(root, "repo"),
    repositoryRoot: join(root, "repo"),
  })

  assert.equal(artifact.receipt.applied, false)
  assert.equal(artifact.receipt.transport, "reviewed_supabase_mcp_execute_sql")
  const sql = await readFile(output, "utf8")
  const receipt = await readFile(artifact.receiptPath, "utf8")
  assert.match(sql, /BEGIN;/)
  assert.match(sql, new RegExp(EMAIL))
  assert.equal(receipt.includes(EMAIL), false)
  assert.equal(receipt.includes(USER_ID), false)
  assert.equal((await stat(output)).mode & 0o777, 0o600)
  assert.equal((await stat(artifact.receiptPath)).mode & 0o777, 0o600)

  const report = buildRedactedResetReport(buildModeratorResetPlan(manifest))
  assert.equal(JSON.stringify(report).includes(EMAIL), false)
  assert.equal(JSON.stringify(report).includes(USER_ID), false)
})

function validManifest(): ResetManifest {
  const expectedCounts = Object.fromEntries(resetInventoryTableNames().map((table) => [table, 0]))
  expectedCounts["public.profiles"] = 1
  expectedCounts["public.manual_access_grants"] = 1
  return {
    schemaVersion: MODERATOR_RESET_SCHEMA_VERSION,
    operation: MODERATOR_RESET_OPERATION,
    environment: "local_test",
    projectRef: "local-pglite",
    batchId: "synthetic-moderator-reset",
    createdAt: "2026-08-27T13:30:00.000Z",
    manifestFingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    operatorApprovedTargetCount: 1,
    expectedSchema: {
      discoveredOwnerTables: resetInventoryTableNames(),
      profileColumns: [
        "id",
        "email",
        "full_name",
        "is_admin",
        "onboarding_completed",
        "onboarding_step",
        "message_count_this_month",
        "created_at",
        "updated_at",
      ],
      authUsersColumns: ["id", "email", "raw_app_meta_data"],
    },
    profileResetValues: {
      full_name: null,
      onboarding_completed: false,
      onboarding_step: "welcome",
      message_count_this_month: 0,
      updated_at: "$now",
    },
    externalProof: {
      productionOperationApproval: "not_required_local_test",
      authAdminMechanismVerified: true,
      storageInventoryComplete: true,
      storageObjectsRemoved: true,
      workerPauseVerified: true,
      delayedCallbackWriteBlocked: true,
      billingOwnershipReconciled: true,
    },
    accounts: [
      {
        userId: USER_ID,
        email: EMAIL,
        expectedAuthEmail: EMAIL,
        expectedCounts,
        expectedRuntimeFingerprint: "md5:00000000000000000000000000000000",
        revokeManualAccessGrantIds: [GRANT_ID],
        storageObjectPaths: ["product-images/tmp/synthetic-moderator-reset/front.jpg"],
        authAppMetadataKeysToRemove: ["access_kind"],
        authUserMetadataKeysToRemove: ["manual_access_reason"],
        authMaintenanceProof: {
          loginRestrictionMethod: "synthetic local stub",
          loginRestrictedAt: "2026-08-27T12:00:00.000Z",
          sessionsRevokedAt: "2026-08-27T12:05:00.000Z",
          jwtExpiresAfterSeconds: 3600,
          inFlightDrainSeconds: 300,
          workerQueueDrainedAt: "2026-08-27T13:05:00.000Z",
          earliestResetAt: "2026-08-27T13:15:00.000Z",
          restoreProcedure: "synthetic local restore",
        },
      },
    ],
  }
}

function withFingerprint(manifest: ResetManifest): ResetManifest {
  return { ...manifest, manifestFingerprint: fingerprintManifest(manifest) }
}

function productionManifest(): ResetManifest {
  const manifest = validManifest()
  manifest.environment = "production"
  manifest.projectRef = "pqdkhefxsxkyeqelqegq"
  manifest.externalProof.productionOperationApproval = "approved_exact_batch"
  manifest.accounts[0].authMaintenanceProof!.jwtExpiresAfterSeconds = 3720
  manifest.accounts[0].authMaintenanceProof!.paymentReplayCutoffAt =
    manifest.accounts[0].authMaintenanceProof!.loginRestrictedAt
  return withFingerprint(manifest)
}

function maintenanceJournal(manifest: ResetManifest) {
  const account = manifest.accounts[0]
  const proof = account.authMaintenanceProof!
  return {
    operation: "moderator_auth_maintenance",
    batchId: manifest.batchId,
    manifestFingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    partialRecovery: false,
    needsManualRecovery: false,
    errors: [],
    accounts: [
      {
        id: account.userId,
        email: account.email,
        stage: "banned",
        signedOutAt: proof.sessionsRevokedAt,
        loginRestrictedAt: proof.loginRestrictedAt,
        paymentReplayCutoffAt: proof.paymentReplayCutoffAt,
        jwtIssuedAt: "2026-08-27T12:00:00.000Z",
        jwtExpiresAt: "2026-08-27T13:00:00.000Z",
      },
    ],
  }
}
