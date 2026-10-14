import assert from "node:assert/strict"
import test from "node:test"
import {
  EXPIRED_JWT_OBSERVATION_MARGIN_MS,
  HOSTED_AUTH_PROBE_MARKER,
  parseHostedAuthProbeCommand,
  runHostedAuthProbe,
  validateHostedSupabaseUrl,
  type HostedAuthProbeOperations,
} from "../scripts/moderator-hosted-auth-probe"

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email_confirmed_at: "2026-08-27T10:00:00Z",
  app_metadata: { operational_test: HOSTED_AUTH_PROBE_MARKER },
}
const TOKEN = (sessionId: string) =>
  `x.${Buffer.from(JSON.stringify({ iat: 1000, exp: 2000, session_id: sessionId })).toString("base64url")}.x`
const notFound = { status: 404, code: "user_not_found" }

function fakeOperations(overrides: Partial<HostedAuthProbeOperations> = {}) {
  const calls: string[] = []
  let email = ""
  let banned = false
  let loggedOut = false
  let deleted = false
  let maintenanceToken = ""
  const operations: HostedAuthProbeOperations = {
    async createUser(input) {
      calls.push("create")
      email = input.email
      return { data: { ...USER, email }, error: null }
    },
    async getUserById() {
      calls.push("get")
      return deleted ? { data: null, error: notFound } : { data: { ...USER, email }, error: null }
    },
    async deleteUser() {
      calls.push("delete")
      deleted = true
      return { data: {}, error: null }
    },
    async profileSnapshot() {
      calls.push("profileBaseline")
      return {
        data: { id: USER.id, onboarding_step: "welcome", full_name: null, is_admin: false },
        error: null,
      }
    },
    async profileResidual() {
      calls.push("profileResidual")
      return { data: { exists: false }, error: null }
    },
    async signIn(_email, _password, client) {
      calls.push(`signIn${client}`)
      return banned
        ? { data: null, error: { status: 400, code: "user_banned" } }
        : {
            data: { access_token: TOKEN(`sid-${client}`), refresh_token: `refresh-${client}` },
            error: null,
          }
    },
    async refresh(token, client) {
      calls.push(`refresh${client}:${token}`)
      if (banned) return { data: null, error: { status: 400, code: "user_banned" } }
      if (loggedOut && token === "refresh-b")
        return { data: null, error: { status: 400, code: "refresh_token_not_found" } }
      return {
        data: { access_token: TOKEN(`refreshed-${client}`), refresh_token: `refreshed-${client}` },
        error: null,
      }
    },
    async ban() {
      calls.push("ban")
      banned = true
      return { data: USER, error: null }
    },
    async unban() {
      calls.push("unban")
      banned = false
      return { data: USER, error: null }
    },
    async generateMaintenanceLink(requestedEmail) {
      calls.push(`generate:${requestedEmail}`)
      maintenanceToken = "hashed-maintenance-token"
      return { data: { user: { ...USER, email }, hashedToken: maintenanceToken }, error: null }
    },
    async verifyMaintenanceOtp(token) {
      calls.push(`verify:${token}`)
      return token === maintenanceToken
        ? {
            data: {
              user: { ...USER, email },
              session: {
                access_token: TOKEN("maintenance"),
                refresh_token: "refresh-maintenance",
              },
            },
            error: null,
          }
        : { data: null, error: { status: 400, code: "otp_expired" } }
    },
    async globalSignOut(accessToken) {
      calls.push(`logout:${accessToken}`)
      loggedOut = true
      return { data: {}, error: null }
    },
    async getOwnProfile() {
      calls.push("profileGet")
      return {
        data: { status: 200, code: null, observedAt: "1970-01-01T00:16:40.000Z" },
        error: null,
      }
    },
    async patchOwnProfileFullNameNull() {
      calls.push("profilePatch")
      return {
        data: {
          status: 401,
          code: "PGRST301",
          jwtExpired: true,
          observedAt: "1970-01-01T00:35:20.000Z",
        },
        error: null,
      }
    },
    ...overrides,
  }
  return { operations, calls }
}

test("dry run makes no hosted calls", async () => {
  const fake = fakeOperations()
  const result = await runHostedAuthProbe(fake.operations, { apply: false })
  assert.equal(result.success, true)
  assert.deepEqual(fake.calls, [])
  assert.equal(result.checks.expiryProof, "unknown")
})

test("rejects wrong project, unsafe user arguments, and a non-hosted production URL before calls", () => {
  assert.throws(
    () =>
      parseHostedAuthProbeCommand([
        "--apply",
        "--project",
        "wrong",
        "--receipt-dir",
        "/tmp/receipt",
      ]),
    /requires --project/,
  )
  assert.throws(() => parseHostedAuthProbeCommand(["--user-id", USER.id]), /unsafe argument/)
  assert.throws(() => parseHostedAuthProbeCommand(["--observe-expiry"]), /requires --apply/)
  assert.throws(() => validateHostedSupabaseUrl("http://127.0.0.1:54321"), /must be https/)
  assert.equal(
    validateHostedSupabaseUrl("https://pqdkhefxsxkyeqelqegq.supabase.co/"),
    "https://pqdkhefxsxkyeqelqegq.supabase.co",
  )
})

test("optional expiry observation checkpoints then proves only explicit PostgREST JWT-expired 401s", async () => {
  const fake = fakeOperations()
  let reads = 0
  fake.operations.getOwnProfile = async () => {
    reads += 1
    return {
      data:
        reads === 1
          ? { status: 200, code: null, observedAt: "1970-01-01T00:16:40.000Z" }
          : {
              status: 401,
              code: "PGRST301",
              jwtExpired: true,
              observedAt: "1970-01-01T00:35:20.000Z",
            },
      error: null,
    }
  }
  fake.operations.patchOwnProfileFullNameNull = async () => ({
    data: {
      status: 401,
      code: "PGRST301",
      jwtExpired: true,
      observedAt: "1970-01-01T00:35:20.000Z",
    },
    error: null,
  })
  let clock = 1_000_000
  const receipts: unknown[] = []
  const result = await runHostedAuthProbe(fake.operations, {
    apply: true,
    observeExpiry: true,
    now: () => clock,
    delay: async (milliseconds) => {
      assert.ok(milliseconds <= 30_000)
      clock += milliseconds
    },
    writeReceipt: async (value) => {
      receipts.push(JSON.parse(JSON.stringify(value)))
    },
  })
  assert.equal(result.success, true)
  assert.equal(result.checks.expiryProof, true)
  assert.equal(result.checks.concurrentSessionSweep, "unknown")
  assert.equal(result.expiryObservation?.targetAt, "1970-01-01T00:35:20.000Z")
  assert.equal(EXPIRED_JWT_OBSERVATION_MARGIN_MS, 120_000)
  assert.equal(receipts.length, 5)
  assert.equal(JSON.stringify(receipts).includes("refresh-a"), false)
})

test("expired network failure cannot prove expiry and still cleans the fixture", async () => {
  const fake = fakeOperations()
  let reads = 0
  fake.operations.getOwnProfile = async () => {
    reads += 1
    return reads === 1
      ? { data: { status: 200, code: null, observedAt: "1970-01-01T00:16:40.000Z" }, error: null }
      : { data: null, error: { status: 503, code: "upstream_down" } }
  }
  let clock = 1_000_000
  const result = await runHostedAuthProbe(fake.operations, {
    apply: true,
    observeExpiry: true,
    now: () => clock,
    delay: async (milliseconds) => {
      clock += milliseconds
    },
  })
  assert.equal(result.success, false)
  assert.equal(result.checks.expiredJwtGetDenied, undefined)
  assert.equal(result.cleanup.deleted, true)
})

test("uses a verified maintenance JWT before the second ban and writes sanitized receipts", async () => {
  const fake = fakeOperations()
  const receipts: unknown[] = []
  const result = await runHostedAuthProbe(fake.operations, {
    apply: true,
    writeReceipt: async (value) => {
      receipts.push(JSON.parse(JSON.stringify(value)))
    },
  })
  assert.equal(result.success, true)
  assert.equal(result.checks.preBanRefreshWorks, true)
  assert.equal(result.checks.untouchedBRefreshRevoked, true)
  assert.equal(result.checks.maintenanceLinkExactSubject, true)
  assert.equal(result.checks.maintenanceOtpExactSubject, true)
  assert.ok(fake.calls.includes(`logout:${TOKEN("maintenance")}`))
  assert.ok(!fake.calls.includes(`logout:${TOKEN("sid-b")}`))
  assert.ok(fake.calls.includes("refreshb:refresh-b"))
  assert.equal(receipts.length, 2)
  assert.deepEqual(result.profileBaseline, {
    id: USER.id,
    onboarding_step: "welcome",
    full_name: null,
    is_admin: false,
  })
  assert.equal(JSON.stringify(receipts).includes("refresh-b"), false)
  assert.equal(JSON.stringify(receipts).includes("hashed-maintenance-token"), false)
})

test("failed residual read is not absence", async () => {
  const fake = fakeOperations()
  const getUserById = fake.operations.getUserById
  let reads = 0
  fake.operations.getUserById = async (id) => {
    reads += 1
    if (reads === 2) return { data: null, error: { status: 500, code: "internal_error" } }
    return getUserById(id)
  }
  let lastReceipt: { success: boolean } | null = null
  const result = await runHostedAuthProbe(fake.operations, {
    apply: true,
    writeReceipt: async (value) => {
      lastReceipt = JSON.parse(JSON.stringify(value))
    },
  })
  assert.equal(result.success, false)
  assert.equal(lastReceipt!.success, false)
  assert.equal(result.cleanup.authResidualAbsent, false)
  assert.ok(result.errors.some((error) => error.step === "authResidual" && error.status === 500))
})

test("network failures cannot prove login restriction or refresh revocation", async () => {
  const fake = fakeOperations()
  const signIn = fake.operations.signIn
  let signIns = 0
  fake.operations.signIn = async (...args) => {
    signIns += 1
    if (signIns === 3) return { data: null, error: { status: 503, code: "upstream_down" } }
    return signIn(...args)
  }
  const refresh = fake.operations.refresh
  let refreshes = 0
  fake.operations.refresh = async (...args) => {
    refreshes += 1
    if (refreshes > 1) return { data: null, error: { status: 503, code: "upstream_down" } }
    return refresh(...args)
  }
  const result = await runHostedAuthProbe(fake.operations, { apply: true })
  assert.equal(result.success, false)
  assert.equal(result.checks.bannedLoginDenied, false)
  assert.equal(result.checks.bannedRefreshDenied, false)
  assert.equal(result.checks.untouchedBRefreshRevoked, false)
})

test("failed initial journal stops the probe but still cleans the created fixture", async () => {
  const fake = fakeOperations()
  const result = await runHostedAuthProbe(fake.operations, {
    apply: true,
    writeReceipt: async () => {
      throw new Error("disk full")
    },
  })
  assert.equal(result.success, false)
  assert.equal(result.cleanup.deleted, true)
  assert.ok(!fake.calls.includes("ban"))
  assert.ok(!fake.calls.includes("signIna"))
})

test("maintenance subject mismatch stops before logout and still cleans the exact fixture", async () => {
  const fake = fakeOperations({
    async verifyMaintenanceOtp() {
      return {
        data: {
          user: {
            ...USER,
            id: "99999999-9999-4999-8999-999999999999",
            email: "other@example.test",
          },
          session: { access_token: TOKEN("wrong-subject"), refresh_token: "wrong-refresh" },
        },
        error: null,
      }
    },
  })
  const result = await runHostedAuthProbe(fake.operations, { apply: true })
  assert.equal(result.success, false)
  assert.ok(result.errors.some((error) => error.step === "maintenanceOtpExactSubject"))
  assert.ok(!fake.calls.some((call) => call.startsWith("logout:")))
  assert.equal(result.cleanup.deleted, true)
})

test("a thrown mid-probe operation still cleans fixture and writes a final receipt", async () => {
  const fake = fakeOperations({
    async ban() {
      throw Object.assign(new Error("do not persist this message"), {
        status: 503,
        code: "upstream_down",
      })
    },
  })
  const receipts: unknown[] = []
  const result = await runHostedAuthProbe(fake.operations, {
    apply: true,
    writeReceipt: async (value) => {
      receipts.push(JSON.parse(JSON.stringify(value)))
    },
  })
  assert.equal(result.success, false)
  assert.equal(result.cleanup.deleted, true)
  assert.equal(result.cleanup.authResidualAbsent, true)
  assert.equal(result.cleanup.profileResidualAbsent, true)
  assert.equal(receipts.length, 2)
  assert.ok(
    result.errors.some(
      (error) => error.step === "ban" && error.status === 503 && error.code === "upstream_down",
    ),
  )
  assert.equal(JSON.stringify(result).includes("do not persist"), false)
})
