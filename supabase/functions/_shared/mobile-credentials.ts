import { decodeProtectedHeader, jwtVerify, SignJWT } from "jose"

export type PilotAccount = { email: string; userId: string }

export type PilotConfig = {
  issuer: string
  audience: string
  environment: string
  expiresAt: number
  accounts: PilotAccount[]
  activeKeyId: string
  keys: Record<string, Uint8Array>
}

export type CredentialClaims = {
  purpose: "access" | "refresh" | "verification"
  credential: string
  userId: string
  email: string
  sessionId?: string
  attemptId?: string
  expiresAt: number
}

const ISSUER = "chaarlie-mobile"
const TYPE = "chaarlie-mobile+jwt"
const MAX_ENVELOPE_LENGTH = 8192
const MAX_PROVIDER_CREDENTIAL_LENGTH = 4096
const MAX_VERIFICATION_LIFETIME_SECONDS = 3600
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const KEY_ID = /^[A-Za-z0-9_-]{1,64}$/
const ENVIRONMENT = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const BASE64URL = /^[A-Za-z0-9_-]+$/
const FORBIDDEN_KEY_IDS = new Set(["__proto__", "constructor", "prototype"])

function invalidConfiguration(): never {
  throw new Error("mobile_pilot_configuration_invalid")
}

function invalidCredential(): never {
  throw new Error("mobile_credential_invalid")
}

function canonicalEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return normalized === value && EMAIL.test(normalized) && normalized.length <= 254
    ? normalized
    : null
}

function parseJson(value: string | undefined): unknown {
  if (!value) invalidConfiguration()
  try {
    return JSON.parse(value)
  } catch {
    invalidConfiguration()
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!BASE64URL.test(value)) return null
  try {
    const padded =
      value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return encodeBase64Url(bytes) === value ? bytes : null
  } catch {
    return null
  }
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]
  if (!value) invalidConfiguration()
  return value
}

function parseAudience(value: string): string {
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/api/mobile/v1" ||
      value !== url.toString()
    ) {
      invalidConfiguration()
    }
    return value
  } catch {
    invalidConfiguration()
  }
}

function parseExpiry(value: string, now: number): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) invalidConfiguration()
  const millis = Date.parse(value)
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) invalidConfiguration()
  const expiresAt = Math.floor(millis / 1000)
  if (expiresAt <= now) invalidConfiguration()
  return expiresAt
}

function parseAccounts(value: unknown): PilotAccount[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) invalidConfiguration()
  const emails = new Set<string>()
  const userIds = new Set<string>()
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) invalidConfiguration()
    const record = item as Record<string, unknown>
    if (
      Object.keys(record).length !== 2 ||
      typeof record.email !== "string" ||
      typeof record.userId !== "string"
    )
      invalidConfiguration()
    const email = canonicalEmail(record.email)
    if (!email || !UUID.test(record.userId) || emails.has(email) || userIds.has(record.userId))
      invalidConfiguration()
    emails.add(email)
    userIds.add(record.userId)
    return { email, userId: record.userId }
  })
}

function parseKeys(value: unknown): Record<string, Uint8Array> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidConfiguration()
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0 || entries.length > 10) invalidConfiguration()
  const keys: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>
  for (const [keyId, encodedKey] of entries) {
    if (!KEY_ID.test(keyId) || FORBIDDEN_KEY_IDS.has(keyId) || typeof encodedKey !== "string")
      invalidConfiguration()
    const key = decodeBase64Url(encodedKey)
    if (!key || key.length !== 32) invalidConfiguration()
    keys[keyId] = key
  }
  return keys
}

function configuredKey(keys: Record<string, Uint8Array>, keyId: string): Uint8Array | null {
  return Object.hasOwn(keys, keyId) ? keys[keyId] : null
}

export function readPilotConfig(
  env: Record<string, string | undefined>,
  now = Math.floor(Date.now() / 1000),
): PilotConfig {
  if (
    env.MOBILE_API_ENABLED !== "true" ||
    env.MOBILE_AUTH_MODE !== "pilot" ||
    env.MOBILE_PILOT_ENABLED !== "true"
  ) {
    invalidConfiguration()
  }

  const callbackUrl = required(env, "MOBILE_AUTH_CALLBACK_URL")
  if (callbackUrl !== "chaarlie-pilot://auth") invalidConfiguration()

  const environment = required(env, "MOBILE_PILOT_ENVIRONMENT")
  if (!ENVIRONMENT.test(environment)) invalidConfiguration()
  const activeKeyId = required(env, "MOBILE_PILOT_ACTIVE_KEY_ID")
  if (!KEY_ID.test(activeKeyId) || FORBIDDEN_KEY_IDS.has(activeKeyId)) invalidConfiguration()
  const keys = parseKeys(parseJson(env.MOBILE_PILOT_KEYS))
  if (!configuredKey(keys, activeKeyId)) invalidConfiguration()

  return {
    issuer: ISSUER,
    audience: parseAudience(required(env, "MOBILE_PILOT_AUDIENCE")),
    environment,
    expiresAt: parseExpiry(required(env, "MOBILE_PILOT_EXPIRES_AT"), now),
    accounts: parseAccounts(parseJson(env.MOBILE_PILOT_ACCOUNTS)),
    activeKeyId,
    keys,
  }
}

export function eligibleAccount(config: PilotConfig, email: string): PilotAccount | null {
  const canonical = canonicalEmail(email)
  if (!canonical) return null
  return config.accounts.find((account) => account.email === canonical) ?? null
}

function validateClaims(config: PilotConfig, claims: CredentialClaims, now: number) {
  const account = eligibleAccount(config, claims.email)
  if (
    !account ||
    account.userId !== claims.userId ||
    !UUID.test(claims.userId) ||
    typeof claims.credential !== "string" ||
    claims.credential.length === 0 ||
    claims.credential.length > MAX_PROVIDER_CREDENTIAL_LENGTH ||
    !Number.isSafeInteger(claims.expiresAt) ||
    claims.expiresAt <= now ||
    claims.expiresAt > config.expiresAt
  ) {
    invalidCredential()
  }

  if (
    claims.purpose !== "access" &&
    claims.purpose !== "refresh" &&
    claims.purpose !== "verification"
  )
    invalidCredential()
  const hasSession = typeof claims.sessionId === "string" && UUID.test(claims.sessionId)
  const hasAttempt = typeof claims.attemptId === "string" && UUID.test(claims.attemptId)
  if (claims.purpose === "verification") {
    if (hasSession || !hasAttempt || claims.expiresAt > now + MAX_VERIFICATION_LIFETIME_SECONDS)
      invalidCredential()
  } else if (!hasSession || hasAttempt) {
    invalidCredential()
  }
}

export async function sealCredential(
  config: PilotConfig,
  claims: CredentialClaims,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  validateClaims(config, claims, now)
  const token = await new SignJWT({
    version: 1,
    purpose: claims.purpose,
    environment: config.environment,
    email: claims.email,
    credential: claims.credential,
    ...(claims.sessionId ? { sid: claims.sessionId } : {}),
    ...(claims.attemptId ? { attemptId: claims.attemptId } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: TYPE, kid: config.activeKeyId })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(claims.userId)
    .setIssuedAt(now)
    .setExpirationTime(claims.expiresAt)
    .sign(configuredKey(config.keys, config.activeKeyId) ?? invalidCredential())
  if (token.length > MAX_ENVELOPE_LENGTH) invalidCredential()
  return token
}

type VerifiedPayload = Record<string, unknown> & {
  iss: string
  aud: string | string[]
  sub: string
  iat: number
  exp: number
}

function parseVerifiedClaims(
  config: PilotConfig,
  payload: VerifiedPayload,
  purpose: CredentialClaims["purpose"],
  now: number,
): CredentialClaims {
  const allowed = new Set([
    "iss",
    "aud",
    "sub",
    "iat",
    "exp",
    "version",
    "purpose",
    "environment",
    "email",
    "credential",
    "sid",
    "attemptId",
  ])
  if (Object.keys(payload).some((key) => !allowed.has(key))) invalidCredential()
  if (
    payload.version !== 1 ||
    payload.purpose !== purpose ||
    payload.environment !== config.environment ||
    payload.aud !== config.audience ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.credential !== "string" ||
    !Number.isSafeInteger(payload.iat) ||
    !Number.isSafeInteger(payload.exp) ||
    payload.iat > now ||
    payload.iat > payload.exp ||
    payload.exp <= now
  ) {
    invalidCredential()
  }
  const hasSid = Object.hasOwn(payload, "sid")
  const hasAttemptId = Object.hasOwn(payload, "attemptId")
  if (
    (hasSid && typeof payload.sid !== "string") ||
    (hasAttemptId && typeof payload.attemptId !== "string")
  )
    invalidCredential()
  const claims: CredentialClaims = {
    purpose,
    credential: payload.credential,
    userId: payload.sub,
    email: payload.email,
    ...(typeof payload.sid === "string" ? { sessionId: payload.sid } : {}),
    ...(typeof payload.attemptId === "string" ? { attemptId: payload.attemptId } : {}),
    expiresAt: payload.exp,
  }
  validateClaims(config, claims, now)
  return claims
}

export async function openCredential(
  config: PilotConfig,
  raw: string,
  purpose: CredentialClaims["purpose"],
  now = Math.floor(Date.now() / 1000),
): Promise<CredentialClaims> {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_ENVELOPE_LENGTH)
    invalidCredential()
  let header: ReturnType<typeof decodeProtectedHeader>
  try {
    header = decodeProtectedHeader(raw)
  } catch {
    invalidCredential()
  }
  if (
    header.alg !== "HS256" ||
    header.typ !== TYPE ||
    typeof header.kid !== "string" ||
    !KEY_ID.test(header.kid) ||
    FORBIDDEN_KEY_IDS.has(header.kid) ||
    !configuredKey(config.keys, header.kid) ||
    Object.keys(header).length !== 3 ||
    !["alg", "kid", "typ"].every((key) => Object.hasOwn(header, key))
  ) {
    invalidCredential()
  }
  try {
    const verified = await jwtVerify(
      raw,
      configuredKey(config.keys, header.kid) ?? invalidCredential(),
      {
        algorithms: ["HS256"],
        typ: TYPE,
        issuer: config.issuer,
        audience: config.audience,
        requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
        currentDate: new Date(now * 1000),
      },
    )
    return parseVerifiedClaims(config, verified.payload as VerifiedPayload, purpose, now)
  } catch {
    invalidCredential()
  }
}
