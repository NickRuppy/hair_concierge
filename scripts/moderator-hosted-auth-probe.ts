#!/usr/bin/env tsx
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdir, writeFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

export const HOSTED_AUTH_PROBE_PROJECT = "pqdkhefxsxkyeqelqegq"
export const HOSTED_AUTH_PROBE_MARKER = "moderator-hosted-auth-probe-v1"
// PostgREST permits a short JWT clock skew; retain a generous margin beyond it.
export const EXPIRED_JWT_OBSERVATION_MARGIN_MS = 120_000
type User = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  app_metadata?: Record<string, unknown> | null
}
type Session = { access_token: string; refresh_token: string; expires_at?: number | null }
type MaintenanceLink = { user: User; hashedToken: string }
type VerifiedMaintenanceSession = { user: User; session: Session }
type AuthError = { status?: number; code?: string; name?: string }
type Outcome<T> = { data: T | null; error: AuthError | null }
type HttpObservation = {
  status: number
  code: string | null
  observedAt: string
  jwtExpired?: boolean
}

export type HostedAuthProbeOperations = {
  createUser(input: {
    email: string
    password: string
    appMetadata: Record<string, unknown>
  }): Promise<Outcome<User>>
  getUserById(userId: string): Promise<Outcome<User>>
  deleteUser(userId: string): Promise<Outcome<unknown>>
  profileSnapshot(userId: string): Promise<Outcome<Record<string, unknown>>>
  profileResidual(userId: string): Promise<Outcome<{ exists: boolean }>>
  signIn(email: string, password: string, client: "a" | "b"): Promise<Outcome<Session>>
  refresh(refreshToken: string, client: "a" | "b"): Promise<Outcome<Session>>
  ban(userId: string): Promise<Outcome<User>>
  unban(userId: string): Promise<Outcome<User>>
  generateMaintenanceLink(email: string): Promise<Outcome<MaintenanceLink>>
  verifyMaintenanceOtp(hashedToken: string): Promise<Outcome<VerifiedMaintenanceSession>>
  globalSignOut(accessToken: string): Promise<Outcome<unknown>>
  getOwnProfile(accessToken: string, userId: string): Promise<Outcome<HttpObservation>>
  patchOwnProfileFullNameNull(
    accessToken: string,
    userId: string,
  ): Promise<Outcome<HttpObservation>>
}
export type HostedAuthProbeResult = {
  dryRun: boolean
  success: boolean
  fixture?: { id: string; email: string; marker: string }
  profileBaseline?: Record<string, unknown>
  sessions?: Array<{
    client: "a" | "b" | "maintenance"
    sessionId: string | null
    issuedAt: string | null
    expiresAt: string | null
  }>
  checks: Record<string, boolean | "unknown">
  denials: Record<string, { status: number | null; code: string | null }>
  errors: Array<{ step: string; status: number | null; code: string | null }>
  cleanup: {
    attempted: boolean
    deleted: boolean
    authResidualAbsent: boolean
    profileResidualAbsent: boolean
  }
  note?: string
  expiryObservation?: {
    checkpointAt: string
    targetAt: string
    preExpiryGet: HttpObservation
    expiredGet: HttpObservation
    expiredPatch: HttpObservation
  }
}
export type HostedAuthProbeCommand = {
  apply: boolean
  project: string | null
  receiptDir: string | null
  observeExpiry: boolean
}

export function parseHostedAuthProbeCommand(argv: readonly string[]): HostedAuthProbeCommand {
  let apply = false
  let project: string | null = null
  let receiptDir: string | null = null
  let observeExpiry = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--apply") {
      apply = true
      continue
    }
    if (arg === "--observe-expiry") {
      observeExpiry = true
      continue
    }
    if (arg === "--project" || arg === "--receipt-dir") {
      const value = argv[++index]
      if (!value) throw new Error(`${arg} requires a value`)
      if (arg === "--project") project = value
      else receiptDir = value
      continue
    }
    if (arg.startsWith("--project=") || arg.startsWith("--receipt-dir=")) {
      const [flag, value] = arg.split("=", 2)
      if (!value) throw new Error(`${flag} requires a value`)
      if (flag === "--project") project = value
      else receiptDir = value
      continue
    }
    throw new Error(`Unknown or unsafe argument ${arg}`)
  }
  if (apply && project !== HOSTED_AUTH_PROBE_PROJECT)
    throw new Error(`--apply requires --project ${HOSTED_AUTH_PROBE_PROJECT}`)
  if (apply && !receiptDir) throw new Error("--apply requires --receipt-dir outside the repository")
  if (observeExpiry && !apply) throw new Error("--observe-expiry requires --apply")
  if (receiptDir && pathIsWithin(process.cwd(), receiptDir))
    throw new Error("--receipt-dir must be outside the repository")
  return { apply, project, receiptDir, observeExpiry }
}
export function validateHostedSupabaseUrl(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== `${HOSTED_AUTH_PROBE_PROJECT}.supabase.co` ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be https://${HOSTED_AUTH_PROBE_PROJECT}.supabase.co`,
    )
  return parsed.toString().replace(/\/$/, "")
}
function pathIsWithin(root: string, candidate: string) {
  const value = relative(resolve(root), resolve(candidate))
  return value === "" || (!value.startsWith("..") && !value.includes("/../"))
}
function sanitizedError(error: unknown): AuthError {
  if (!error || typeof error !== "object") return {}
  const value = error as { status?: unknown; code?: unknown; name?: unknown }
  return {
    ...(typeof value.status === "number" ? { status: value.status } : {}),
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.name === "string" ? { name: value.name } : {}),
  }
}
function recordError(result: HostedAuthProbeResult, step: string, error: unknown) {
  const value = sanitizedError(error)
  result.errors.push({ step, status: value.status ?? null, code: value.code ?? null })
}
async function call<T>(
  result: HostedAuthProbeResult,
  step: string,
  operation: () => Promise<Outcome<T>>,
): Promise<T | null> {
  try {
    const outcome = await operation()
    if (outcome.error || !outcome.data) {
      recordError(result, step, outcome.error)
      return null
    }
    return outcome.data
  } catch (error) {
    recordError(result, step, error)
    return null
  }
}
function evidence(session: Session, client: "a" | "b" | "maintenance") {
  const payload = decodeJwtPayload(session.access_token)
  return {
    client,
    sessionId: typeof payload?.session_id === "string" ? payload.session_id : null,
    issuedAt: typeof payload?.iat === "number" ? new Date(payload.iat * 1000).toISOString() : null,
    expiresAt:
      typeof payload?.exp === "number"
        ? new Date(payload.exp * 1000).toISOString()
        : typeof session.expires_at === "number"
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
  }
}
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split(".")[1]
    return encoded
      ? (JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
function sessionExpiryMilliseconds(session: Session) {
  const payload = decodeJwtPayload(session.access_token)
  if (typeof payload?.exp === "number") return payload.exp * 1000
  return typeof session.expires_at === "number" ? session.expires_at * 1000 : Number.NaN
}
function isExplicitUserNotFound(error: AuthError | null) {
  return error?.status === 404 && error.code === "user_not_found"
}

function isExpiredJwtResponse(observation: HttpObservation) {
  return (
    observation.status === 401 &&
    observation.jwtExpired === true &&
    ["PGRST301", "PGRST303", "jwt_expired"].includes(observation.code ?? "")
  )
}

function recordDenial(
  result: HostedAuthProbeResult,
  step: string,
  error: AuthError | null,
  codes: string[],
) {
  result.denials[step] = { status: error?.status ?? null, code: error?.code ?? null }
  return (
    !!error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500 &&
    codes.includes(error.code ?? "")
  )
}

export async function runHostedAuthProbe(
  operations: HostedAuthProbeOperations,
  options: {
    apply: boolean
    observeExpiry?: boolean
    writeReceipt?: (result: HostedAuthProbeResult) => Promise<void>
    now?: () => number
    delay?: (milliseconds: number) => Promise<void>
  },
): Promise<HostedAuthProbeResult> {
  const result: HostedAuthProbeResult = {
    dryRun: !options.apply,
    success: false,
    checks: { expiryProof: "unknown" },
    denials: {},
    errors: [],
    cleanup: {
      attempted: false,
      deleted: false,
      authResidualAbsent: false,
      profileResidualAbsent: false,
    },
  }
  if (!options.apply) {
    result.success = true
    result.note =
      "Dry run only: no Auth or database request was made. Expiry proof requires a separately approved private observation window."
    return result
  }
  const email = `moderator-reset-probe-${randomUUID()}@example.test`
  const password = randomBytes(32).toString("base64url")
  const now = options.now ?? Date.now
  const delay =
    options.delay ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  let fixture: User | null = null
  const writeReceipt = async (step: string) => {
    if (!options.writeReceipt) return true
    try {
      await options.writeReceipt(result)
      return true
    } catch (error) {
      recordError(result, `${step}Receipt`, error)
      result.success = false
      return false
    }
  }
  try {
    fixture = await call(result, "createUser", () =>
      operations.createUser({
        email,
        password,
        appMetadata: { operational_test: HOSTED_AUTH_PROBE_MARKER },
      }),
    )
    if (!fixture) return result
    result.fixture = { id: fixture.id, email, marker: HOSTED_AUTH_PROBE_MARKER }
    result.checks.createdExactFixture =
      fixture.email === email &&
      fixture.email_confirmed_at != null &&
      fixture.app_metadata?.operational_test === HOSTED_AUTH_PROBE_MARKER
    if (!(await writeReceipt("createdFixture"))) return result
    if (!result.checks.createdExactFixture) {
      recordError(result, "createdExactFixture", {})
      return result
    }
    const baseline = await call(result, "profileBaseline", () =>
      operations.profileSnapshot(fixture!.id),
    )
    if (!baseline) return result
    result.profileBaseline = baseline
    const first = await call(result, "signInA", () => operations.signIn(email, password, "a"))
    const second = await call(result, "signInB", () => operations.signIn(email, password, "b"))
    if (!first || !second) return result
    result.sessions = [evidence(first, "a"), evidence(second, "b")]
    result.checks.independentPasswordSessions = first.refresh_token !== second.refresh_token
    const preBanRefresh = await call(result, "preBanRefreshA", () =>
      operations.refresh(first.refresh_token, "a"),
    )
    result.checks.preBanRefreshWorks = preBanRefresh != null
    if (!preBanRefresh) return result
    if (!(await call(result, "ban", () => operations.ban(fixture!.id)))) return result
    const deniedLogin = await operations
      .signIn(email, password, "a")
      .catch((error) => ({ data: null, error: sanitizedError(error) }))
    const deniedRefresh = await operations
      .refresh(preBanRefresh.refresh_token, "a")
      .catch((error) => ({ data: null, error: sanitizedError(error) }))
    result.checks.bannedLoginDenied = recordDenial(result, "bannedLogin", deniedLogin.error, [
      "user_banned",
    ])
    result.checks.bannedRefreshDenied = recordDenial(result, "bannedRefresh", deniedRefresh.error, [
      "user_banned",
    ])
    if (!result.checks.bannedLoginDenied) recordError(result, "bannedLogin", deniedLogin.error)
    if (!result.checks.bannedRefreshDenied)
      recordError(result, "bannedRefresh", deniedRefresh.error)
    if (!(await call(result, "unban", () => operations.unban(fixture!.id)))) return result
    const maintenanceLink = await call(result, "generateMaintenanceLink", () =>
      operations.generateMaintenanceLink(email),
    )
    result.checks.maintenanceLinkExactSubject =
      maintenanceLink?.user.id === fixture.id && maintenanceLink.user.email === email
    if (!maintenanceLink || !result.checks.maintenanceLinkExactSubject) {
      if (maintenanceLink) recordError(result, "maintenanceLinkExactSubject", {})
      return result
    }
    const maintenance = await call(result, "verifyMaintenanceOtp", () =>
      operations.verifyMaintenanceOtp(maintenanceLink.hashedToken),
    )
    result.checks.maintenanceOtpExactSubject =
      maintenance?.user.id === fixture.id && maintenance.user.email === email
    if (!maintenance || !result.checks.maintenanceOtpExactSubject) {
      if (maintenance) recordError(result, "maintenanceOtpExactSubject", {})
      return result
    }
    result.sessions.push(evidence(maintenance.session, "maintenance"))
    const logout = await call(result, "globalSignOutMaintenance", () =>
      operations.globalSignOut(maintenance.session.access_token),
    )
    result.checks.globalSignOutWithMaintenanceJwt = logout != null
    if (!(await call(result, "secondBan", () => operations.ban(fixture!.id)))) return result
    if (options.observeExpiry) {
      result.checks.expiryProfileBaselineSafe = result.profileBaseline?.full_name === null
      if (!result.checks.expiryProfileBaselineSafe) {
        recordError(result, "expiryProfileBaseline", {})
        return result
      }
      const expiry = Math.max(
        ...[first, second, maintenance.session].map(sessionExpiryMilliseconds),
      )
      const target = expiry + EXPIRED_JWT_OBSERVATION_MARGIN_MS
      const maximumAllowedTarget = now() + 2 * 60 * 60 * 1000
      result.checks.expiryObservationCheckpoint =
        Number.isFinite(expiry) && target <= maximumAllowedTarget
      if (!result.checks.expiryObservationCheckpoint) {
        recordError(result, "expiryObservationWindow", {})
        return result
      }
      result.expiryObservation = {
        checkpointAt: new Date(now()).toISOString(),
        targetAt: new Date(target).toISOString(),
        preExpiryGet: { status: 0, code: null, observedAt: "" },
        expiredGet: { status: 0, code: null, observedAt: "" },
        expiredPatch: { status: 0, code: null, observedAt: "" },
      }
      if (!(await writeReceipt("expiryCheckpoint"))) return result
      const preExpiryGet = await call(result, "preExpiryProfileGet", () =>
        operations.getOwnProfile(first.access_token, fixture!.id),
      )
      if (!preExpiryGet) return result
      result.expiryObservation.preExpiryGet = preExpiryGet
      result.checks.preExpiryJwtAccepted = preExpiryGet.status >= 200 && preExpiryGet.status < 300
      if (!(await writeReceipt("preExpiryObservation"))) return result
      if (!result.checks.preExpiryJwtAccepted) {
        recordError(result, "preExpiryProfileGet", {
          status: preExpiryGet.status,
          code: preExpiryGet.code ?? undefined,
        })
        return result
      }
      while (now() < target) await delay(Math.min(30_000, target - now()))
      const expiredGet = await call(result, "expiredProfileGet", () =>
        operations.getOwnProfile(first.access_token, fixture!.id),
      )
      const expiredPatch = await call(result, "expiredProfilePatch", () =>
        operations.patchOwnProfileFullNameNull(first.access_token, fixture!.id),
      )
      if (!expiredGet || !expiredPatch) return result
      result.expiryObservation.expiredGet = expiredGet
      result.expiryObservation.expiredPatch = expiredPatch
      if (!(await writeReceipt("expiredObservation"))) return result
      result.checks.expiredJwtGetDenied = isExpiredJwtResponse(expiredGet)
      result.checks.expiredJwtPatchDenied = isExpiredJwtResponse(expiredPatch)
      if (!result.checks.expiredJwtGetDenied)
        recordError(result, "expiredProfileGet", {
          status: expiredGet.status,
          code: expiredGet.code ?? undefined,
        })
      if (!result.checks.expiredJwtPatchDenied)
        recordError(result, "expiredProfilePatch", {
          status: expiredPatch.status,
          code: expiredPatch.code ?? undefined,
        })
      result.checks.expiryProof = Boolean(
        result.checks.expiredJwtGetDenied && result.checks.expiredJwtPatchDenied,
      )
    }
    const bannedBRefresh = await operations
      .refresh(second.refresh_token, "b")
      .catch((error) => ({ data: null, error: sanitizedError(error) }))
    result.checks.bannedBRefreshDenied = recordDenial(
      result,
      "bannedBRefresh",
      bannedBRefresh.error,
      ["user_banned", "refresh_token_not_found", "refresh_token_already_used", "session_not_found"],
    )
    if (!result.checks.bannedBRefreshDenied)
      recordError(result, "bannedBRefresh", bannedBRefresh.error)
    if (!(await call(result, "secondUnban", () => operations.unban(fixture!.id)))) return result
    const restored = await call(result, "restoredLogin", () =>
      operations.signIn(email, password, "a"),
    )
    result.checks.restoredCredentialsLogin = restored != null
    const oldBRefresh = await operations
      .refresh(second.refresh_token, "b")
      .catch((error) => ({ data: null, error: sanitizedError(error) }))
    result.checks.untouchedBRefreshRevoked = recordDenial(
      result,
      "untouchedBRefresh",
      oldBRefresh.error,
      ["refresh_token_not_found", "refresh_token_already_used", "session_not_found"],
    )
    if (!result.checks.untouchedBRefreshRevoked)
      recordError(result, "untouchedBRefresh", oldBRefresh.error)
    result.checks.concurrentSessionSweep = "unknown"
    result.note =
      "This proves the observed ordered maintenance sequence only; it does not prove a race-free concurrent-session sweep."
    result.success = result.errors.length === 0
  } catch (error) {
    recordError(result, "unexpected", error)
  } finally {
    if (fixture) {
      result.cleanup.attempted = true
      const current = await call(result, "cleanupGuard", () => operations.getUserById(fixture!.id))
      const safe =
        current?.email === email &&
        current.app_metadata?.operational_test === HOSTED_AUTH_PROBE_MARKER
      if (!safe) recordError(result, "cleanupGuard", {})
      else {
        result.cleanup.deleted =
          (await call(result, "deleteUser", () => operations.deleteUser(fixture!.id))) != null
        try {
          const residual = await operations.getUserById(fixture.id)
          result.cleanup.authResidualAbsent = isExplicitUserNotFound(residual.error)
          if (!result.cleanup.authResidualAbsent)
            recordError(result, "authResidual", residual.error)
        } catch (error) {
          recordError(result, "authResidual", error)
        }
        try {
          const profile = await operations.profileResidual(fixture.id)
          result.cleanup.profileResidualAbsent = !profile.error && profile.data?.exists === false
          if (!result.cleanup.profileResidualAbsent)
            recordError(result, "profileResidual", profile.error)
        } catch (error) {
          recordError(result, "profileResidual", error)
        }
      }
    }
    result.success =
      result.success &&
      result.errors.length === 0 &&
      result.cleanup.deleted &&
      result.cleanup.authResidualAbsent &&
      result.cleanup.profileResidualAbsent
    await writeReceipt("final")
  }
  result.success =
    result.success &&
    result.cleanup.deleted &&
    result.cleanup.authResidualAbsent &&
    result.cleanup.profileResidualAbsent
  return result
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for --apply`)
  return value
}
function createHostedOperations(): HostedAuthProbeOperations {
  const url = validateHostedSupabaseUrl(requireEnv("NEXT_PUBLIC_SUPABASE_URL"))
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const service = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const a = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const b = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const user = (response: {
    data: { user: User | null }
    error: AuthError | null
  }): Outcome<User> => ({ data: response.data.user, error: response.error })
  const session = (response: {
    data: { session: Session | null }
    error: AuthError | null
  }): Outcome<Session> => ({ data: response.data.session, error: response.error })
  return {
    async createUser(input) {
      return user(
        await admin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          app_metadata: input.appMetadata,
        }),
      )
    },
    async getUserById(id) {
      return user(await admin.auth.admin.getUserById(id))
    },
    async deleteUser(id) {
      const response = await admin.auth.admin.deleteUser(id)
      return { data: response.error ? null : {}, error: response.error }
    },
    async profileSnapshot(id) {
      const response = await admin.from("profiles").select("*").eq("id", id).maybeSingle()
      return { data: response.data as Record<string, unknown> | null, error: response.error }
    },
    async profileResidual(id) {
      const response = await admin.from("profiles").select("id").eq("id", id).maybeSingle()
      return {
        data: response.error ? null : { exists: response.data != null },
        error: response.error,
      }
    },
    async signIn(email, password, client) {
      return session(await (client === "a" ? a : b).auth.signInWithPassword({ email, password }))
    },
    async refresh(refreshToken, client) {
      return session(
        await (client === "a" ? a : b).auth.refreshSession({ refresh_token: refreshToken }),
      )
    },
    async ban(id) {
      return user(await admin.auth.admin.updateUserById(id, { ban_duration: "2h" }))
    },
    async unban(id) {
      return user(await admin.auth.admin.updateUserById(id, { ban_duration: "none" }))
    },
    async generateMaintenanceLink(email) {
      const response = await admin.auth.admin.generateLink({ type: "magiclink", email })
      const hashedToken = response.data.properties?.hashed_token
      return {
        data:
          response.data.user && typeof hashedToken === "string"
            ? { user: response.data.user, hashedToken }
            : null,
        error: response.error,
      }
    },
    async verifyMaintenanceOtp(hashedToken) {
      const response = await a.auth.verifyOtp({ type: "magiclink", token_hash: hashedToken })
      return {
        data:
          response.data.user && response.data.session
            ? { user: response.data.user, session: response.data.session }
            : null,
        error: response.error,
      }
    },
    async globalSignOut(accessToken) {
      const response = await admin.auth.admin.signOut(accessToken, "global")
      return { data: response.error ? null : {}, error: response.error }
    },
    async getOwnProfile(accessToken, userId) {
      return profileRequest(url, anon, accessToken, userId, "GET")
    },
    async patchOwnProfileFullNameNull(accessToken, userId) {
      return profileRequest(url, anon, accessToken, userId, "PATCH")
    },
  }
}
async function profileRequest(
  url: string,
  anon: string,
  accessToken: string,
  userId: string,
  method: "GET" | "PATCH",
): Promise<Outcome<HttpObservation>> {
  try {
    const response = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id`,
      {
        method,
        signal: AbortSignal.timeout(15_000),
        headers: {
          apikey: anon,
          authorization: `Bearer ${accessToken}`,
          ...(method === "PATCH" ? { "content-type": "application/json" } : {}),
        },
        ...(method === "PATCH" ? { body: JSON.stringify({ full_name: null }) } : {}),
      },
    )
    let code: string | null = null
    let jwtExpired = false
    try {
      const body = (await response.json()) as { code?: unknown; message?: unknown }
      code = typeof body.code === "string" ? body.code : null
      jwtExpired = body.message === "JWT expired"
    } catch {
      // HTTP status remains evidence; no response body is persisted.
    }
    return {
      data: { status: response.status, code, jwtExpired, observedAt: new Date().toISOString() },
      error: null,
    }
  } catch (error) {
    return { data: null, error: sanitizedError(error) }
  }
}
async function main() {
  const command = parseHostedAuthProbeCommand(process.argv.slice(2))
  if (!command.apply) {
    console.log(
      JSON.stringify(
        await runHostedAuthProbe({} as HostedAuthProbeOperations, { apply: false }),
        null,
        2,
      ),
    )
    return
  }
  const directory = command.receiptDir!
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const path = resolve(directory, `moderator-hosted-auth-probe-${Date.now()}.json`)
  const writeReceipt = async (result: HostedAuthProbeResult) => {
    await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  }
  const result = await runHostedAuthProbe(createHostedOperations(), {
    apply: true,
    observeExpiry: command.observeExpiry,
    writeReceipt,
  })
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exitCode = 2
}
if (process.argv[1]?.endsWith("moderator-hosted-auth-probe.ts"))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
