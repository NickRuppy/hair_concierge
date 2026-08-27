import assert from "node:assert/strict"
import test from "node:test"
import {
  applyMaintenance,
  parseMaintenanceCommand,
  validateMaintenanceUrl,
  type MaintenanceOperations,
} from "../scripts/moderator-account-maintenance"
import { fingerprintManifest } from "../scripts/lib/moderator-account-reset-types"

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]
const marker = "sha256:"
function manifest() {
  const value: any = {
    schemaVersion: 1,
    operation: "moderator_personal_plan_full_reset",
    environment: "production",
    projectRef: "pqdkhefxsxkyeqelqegq",
    batchId: "mod-auth-maintenance",
    createdAt: "2026-08-27T10:00:00.000Z",
    manifestFingerprint: `${marker}${"0".repeat(64)}`,
    operatorApprovedTargetCount: 2,
    expectedSchema: { discoveredOwnerTables: [], profileColumns: [], authUsersColumns: [] },
    profileResetValues: {},
    externalProof: {
      productionOperationApproval: "approved_exact_batch",
      authAdminMechanismVerified: true,
      storageInventoryComplete: true,
      storageObjectsRemoved: true,
      workerPauseVerified: true,
      delayedCallbackWriteBlocked: true,
      billingOwnershipReconciled: true,
    },
    accounts: ids.map((id, index) => ({
      userId: id,
      email: `mod${index}@example.test`,
      expectedAuthEmail: `mod${index}@example.test`,
      expectedCounts: {},
      expectedRuntimeFingerprint: "md5:00000000000000000000000000000000",
      revokeManualAccessGrantIds: [],
      storageObjectPaths: [],
      authAppMetadataKeysToRemove: [],
    })),
  }
  value.manifestFingerprint = fingerprintManifest(value)
  return value
}
const token = (id: string) =>
  `x.${Buffer.from(JSON.stringify({ iat: 1000, exp: 2000, sub: id, session_id: id })).toString("base64url")}.x`
function fake(overrides: Partial<MaintenanceOperations> = {}) {
  const calls: string[] = []
  const users = new Map<
    string,
    {
      id: string
      email: string
      email_confirmed_at: string
      banned_until: string | null
      app_metadata: Record<string, unknown>
    }
  >(
    ids.map((id, index) => [
      id,
      {
        id,
        email: `mod${index}@example.test`,
        email_confirmed_at: "2026-08-27T10:00:00.000Z",
        banned_until: null,
        app_metadata: { retained: `value-${index}` },
      },
    ]),
  )
  const operations: MaintenanceOperations = {
    async getUser(id) {
      calls.push(`get:${id}`)
      return {
        data: users.get(id) ?? null,
        error: users.has(id) ? null : { status: 404, code: "user_not_found" },
      }
    },
    async generateLink(email) {
      calls.push(`generate:${email}`)
      const user = [...users.values()].find((value) => value.email === email)!
      return { data: { user, hashedToken: `hash-${user.id}` }, error: null }
    },
    async verifyOtp(hash) {
      calls.push(`verify:${hash}`)
      const id = hash.replace("hash-", "")
      const user = users.get(id)!
      return { data: { user, session: { access_token: token(id) } }, error: null }
    },
    async globalSignOut(jwt) {
      calls.push(`logout:${jwt}`)
      return { data: {}, error: null }
    },
    async ban(id, duration, cutoff) {
      calls.push(`ban:${id}:${duration}:${cutoff}`)
      const user = users.get(id)!
      user.banned_until = "2026-08-28T10:00:00.000Z"
      user.app_metadata.moderator_reset_cutoff_at = cutoff
      return { data: user, error: null }
    },
    ...overrides,
  }
  return { operations, calls }
}
test("dry-run parsing has no network and apply needs all exact gates", () => {
  assert.equal(parseMaintenanceCommand([]).action, "dry-run")
  assert.throws(() => parseMaintenanceCommand(["apply", "--project", "wrong"]), /requires/)
  assert.throws(
    () =>
      parseMaintenanceCommand([
        "apply",
        "--project",
        "pqdkhefxsxkyeqelqegq",
        "--manifest",
        "x",
        "--approve-fingerprint",
        "x",
        "--receipt-dir",
        ".",
      ]),
    /outside/,
  )
  assert.throws(() => validateMaintenanceUrl("http://127.0.0.1:54321"), /must be https/)
  assert.equal(
    validateMaintenanceUrl("https://pqdkhefxsxkyeqelqegq.supabase.co/"),
    "https://pqdkhefxsxkyeqelqegq.supabase.co",
  )
})
test("rejects manifest count, duplicate identifiers, and mismatched email before calls", async () => {
  for (const change of [
    (value: any) => {
      value.operatorApprovedTargetCount = 1
    },
    (value: any) => {
      value.accounts[1].userId = value.accounts[0].userId
    },
    (value: any) => {
      value.accounts[1].expectedAuthEmail = "different@example.test"
    },
  ]) {
    const input = manifest()
    change(input)
    input.manifestFingerprint = fingerprintManifest(input)
    const fakeOps = fake()
    await assert.rejects(
      () =>
        applyMaintenance(
          input,
          input.manifestFingerprint,
          fakeOps.operations,
          async () => {},
          () => 1_000_000,
        ),
      /exact approved unique/,
    )
    assert.deepEqual(fakeOps.calls, [])
  }
})
test("missing or invalid JWT proof stops before logout", async () => {
  const input = manifest()
  const fakeOps = fake({
    async verifyOtp() {
      return {
        data: {
          user: { id: ids[0], email: "mod0@example.test", email_confirmed_at: "x" },
          session: { access_token: "invalid" },
        },
        error: null,
      }
    },
  })
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async () => {},
    () => 1_000_000,
  )
  assert.equal(result.needsManualRecovery, true)
  assert.equal(result.accounts[0].stage, "attempting")
  assert.ok(!fakeOps.calls.some((call) => call.startsWith("logout:")))
})
test("unbanned ban response is rejected and needs manual recovery", async () => {
  const input = manifest()
  const fakeOps = fake({
    async ban(id, _duration, cutoff) {
      return {
        data: {
          id,
          email: "mod0@example.test",
          email_confirmed_at: "x",
          banned_until: null,
          app_metadata: { retained: "value-0", moderator_reset_cutoff_at: cutoff },
        },
        error: null,
      }
    },
  })
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async () => {},
    () => 1_000_000,
  )
  assert.equal(result.accounts[0].stage, "signed_out")
  assert.equal(result.needsManualRecovery, true)
  assert.ok(result.errors.some((error) => error.step.startsWith("banWindow:")))
})
test("journal failure after confirmed ban preserves recovery state", async () => {
  const input = manifest()
  const fakeOps = fake()
  let writes = 0
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async () => {
      writes += 1
      if (writes === 4) throw new Error("receipt down")
    },
    () => 1_000_000,
  )
  assert.equal(result.accounts[0].stage, "banned")
  assert.equal(result.needsManualRecovery, true)
  assert.equal(result.partialRecovery, true)
})
test("ban marker must round-trip while unrelated app metadata is preserved and never journaled", async () => {
  const input = manifest()
  const calls: Array<{ id: string; duration: string; cutoff: string }> = []
  const fakeOps = fake({
    async ban(id, duration, cutoff) {
      calls.push({ id, duration, cutoff })
      return {
        data: {
          id,
          email: "mod0@example.test",
          email_confirmed_at: "x",
          banned_until: "2026-08-28T10:00:00.000Z",
          app_metadata: { retained: "value-0" },
        },
        error: null,
      }
    },
  })
  const journals: unknown[] = []
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async (journal) => {
      journals.push(JSON.parse(JSON.stringify(journal)))
    },
    () => 1_000_000,
  )
  assert.equal(calls[0].duration, "24h")
  assert.match(calls[0].cutoff, /^1970-01-01T00:16:40\.000Z$/)
  assert.equal(result.accounts[0].stage, "banned")
  assert.equal(result.needsManualRecovery, true)
  assert.ok(result.errors.some((error) => error.step.startsWith("banMetadata:")))
  assert.equal(JSON.stringify(journals).includes("retained"), false)
})
test("ban marker must not replace pre-existing app metadata", async () => {
  const input = manifest()
  const fakeOps = fake({
    async ban(id, _duration, cutoff) {
      return {
        data: {
          id,
          email: "mod0@example.test",
          email_confirmed_at: "x",
          banned_until: "2026-08-28T10:00:00.000Z",
          app_metadata: { moderator_reset_cutoff_at: cutoff },
        },
        error: null,
      }
    },
  })
  const journals: unknown[] = []
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async (journal) => {
      journals.push(JSON.parse(JSON.stringify(journal)))
    },
    () => 1_000_000,
  )
  assert.equal(result.accounts[0].stage, "banned")
  assert.equal(result.needsManualRecovery, true)
  assert.ok(result.errors.some((error) => error.step.startsWith("banMetadata:")))
  assert.equal(JSON.stringify(journals).includes("retained"), false)
})
test("preflights every identity before a journal or mutation", async () => {
  const input = manifest()
  const fakeOps = fake({
    async getUser(id) {
      return id === ids[1]
        ? { data: null, error: { status: 404, code: "user_not_found" } }
        : {
            data: { id, email: "mod0@example.test", email_confirmed_at: "x", banned_until: null },
            error: null,
          }
    },
  })
  let journals = 0
  await assert.rejects(
    () =>
      applyMaintenance(
        input,
        input.manifestFingerprint,
        fakeOps.operations,
        async () => {
          journals += 1
        },
        () => 1_000_000,
      ),
    /preflight/,
  )
  assert.equal(journals, 0)
  assert.ok(!fakeOps.calls.some((call) => call.startsWith("ban:")))
})
test("initial private journal failure prevents every mutation", async () => {
  const input = manifest()
  const fakeOps = fake()
  await assert.rejects(
    () =>
      applyMaintenance(
        input,
        input.manifestFingerprint,
        fakeOps.operations,
        async () => {
          throw new Error("private journal unavailable")
        },
        () => 1_000_000,
      ),
    /journal unavailable/,
  )
  assert.ok(!fakeOps.calls.some((call) => call.startsWith("generate:") || call.startsWith("ban:")))
})
test("global logout precedes 24h ban and journals no secrets", async () => {
  const input = manifest()
  const fakeOps = fake()
  const journals: unknown[] = []
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async (value) => {
      journals.push(JSON.parse(JSON.stringify(value)))
    },
    () => 1_000_000,
  )
  assert.equal(result.errors.length, 0)
  assert.ok(
    fakeOps.calls.indexOf(`logout:${token(ids[0])}`) <
      fakeOps.calls.findIndex((call) => call.startsWith(`ban:${ids[0]}:24h:`)),
  )
  assert.equal(result.tokenExpiryDeadline, "1970-01-01T01:18:40.000Z")
  assert.equal(result.earliestResetWithDrain, "1970-01-01T01:23:40.000Z")
  assert.equal(JSON.stringify(journals).includes("hash-"), false)
  assert.equal(JSON.stringify(journals).includes(token(ids[0])), false)
})
test("delayed restrictions extend the conservative reset deadline beyond minted token expiry", async () => {
  const input = manifest()
  let clock = 1_000_000
  const fakeOps = fake({
    async ban(id, _duration, cutoff) {
      clock += 4_000_000
      return {
        data: {
          id,
          email: id === ids[0] ? "mod0@example.test" : "mod1@example.test",
          email_confirmed_at: "x",
          banned_until: "2026-08-28T10:00:00.000Z",
          app_metadata: {
            retained: id === ids[0] ? "value-0" : "value-1",
            moderator_reset_cutoff_at: cutoff,
          },
        },
        error: null,
      }
    },
  })
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async () => {},
    () => clock,
  )
  assert.ok(Date.parse(result.tokenExpiryDeadline!) > 2_000_000)
  assert.equal(
    Date.parse(result.earliestResetWithDrain!) - Date.parse(result.tokenExpiryDeadline!),
    300_000,
  )
})
test("mid-batch failure stops remaining accounts and never auto-unbans", async () => {
  const input = manifest()
  const fakeOps = fake({
    async ban(id, duration, cutoff) {
      if (id === ids[1]) return { data: null, error: { status: 503, code: "upstream_down" } }
      return {
        data: {
          id,
          email: "mod0@example.test",
          email_confirmed_at: "x",
          banned_until: "2026-08-28T10:00:00.000Z",
          app_metadata: { retained: "value-0", moderator_reset_cutoff_at: cutoff },
        },
        error: null,
      }
    },
  })
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async () => {},
    () => 1_000_000,
  )
  assert.equal(result.partialRecovery, true)
  assert.equal(result.accounts[0].stage, "banned")
  assert.equal(result.accounts[1].stage, "signed_out")
  assert.ok(!fakeOps.calls.some((call) => call.startsWith("unban")))
})
test("maintenance link identity mismatch prevents global logout and ban", async () => {
  const input = manifest()
  const fakeOps = fake({
    async generateLink() {
      return {
        data: {
          user: {
            id: "99999999-9999-4999-8999-999999999999",
            email: "other@example.test",
            email_confirmed_at: "x",
          },
          hashedToken: "wrong",
        },
        error: null,
      }
    },
  })
  const result = await applyMaintenance(
    input,
    input.manifestFingerprint,
    fakeOps.operations,
    async () => {},
    () => 1_000_000,
  )
  assert.equal(result.accounts[0].stage, "attempting")
  assert.ok(!fakeOps.calls.some((call) => call.startsWith("logout:")))
  assert.ok(!fakeOps.calls.some((call) => call.startsWith("ban:")))
})
