import { decodeProtectedHeader, jwtVerify, jwtDecrypt, SignJWT, EncryptJWT } from "jose"
import { readPilotConfig, type PilotConfig } from "./mobile-credentials.ts"

export type RegistrationConfig = Omit<PilotConfig, "accounts"> & {
  callbackUrl: string
  emails: readonly string[]
}
export type RegistrationPurpose =
  | "registration_request"
  | "registration_verification"
  | "registration_completion"
  | "profile_completion"
export type RegistrationClaims = {
  purpose: RegistrationPurpose
  attemptId: string
  sendGeneration: string
  requestHash: string
  email: string
  expiresAt: number
  userId?: string
  credential?: string
  refreshToken?: string
  sessionId?: string
  sessionExpiresAt?: number
}
const TYPE = "chaarlie-registration+jwt"
const privateType = (purpose: RegistrationPurpose) =>
  purpose === "profile_completion"
    ? "chaarlie-profile-completion+jwe"
    : "chaarlie-registration-completion+jwe"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function invalid(): never {
  throw new Error("mobile_registration_credential_invalid")
}
function parseRegistrationEmails(raw: string | undefined): readonly string[] {
  if (!raw || raw.length > 8192) invalid()
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    invalid()
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) invalid()
  const emails: string[] = []
  // Exact ASCII dot-atom addresses only: no glob syntax, domain rules, aliases,
  // trimming or case folding can silently widen the configured cohort.
  const address =
    /^[a-z0-9!#$%&'+/=_`|~^-]+(?:\.[a-z0-9!#$%&'+/=_`|~^-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/
  for (const email of value) {
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      email !== email.trim().toLowerCase() ||
      email.split("@")[0].length > 64 ||
      !address.test(email) ||
      emails.includes(email)
    )
      invalid()
    emails.push(email)
  }
  return Object.freeze(emails)
}
export function eligibleRegistrationEmail(config: RegistrationConfig, email: string): boolean {
  return config.emails.includes(email)
}
export function readRegistrationConfig(
  env: Record<string, string | undefined>,
  now = Math.floor(Date.now() / 1000),
): RegistrationConfig {
  if (env.MOBILE_REGISTRATION_ENABLED !== "true") invalid()
  const emails = parseRegistrationEmails(env.MOBILE_REGISTRATION_EMAILS)
  const callbackUrl = env.MOBILE_REGISTRATION_CALLBACK_URL
  if (callbackUrl !== "chaarlie-pilot://auth" && callbackUrl !== "chaarlie-local://auth") invalid()
  // Reuse the audited strict key, audience, environment and absolute expiry parser.
  const parsed = readPilotConfig(
    {
      MOBILE_API_ENABLED: env.MOBILE_API_ENABLED,
      MOBILE_AUTH_MODE: "pilot",
      MOBILE_PILOT_ENABLED: "true",
      MOBILE_AUTH_CALLBACK_URL: "chaarlie-pilot://auth",
      MOBILE_PILOT_AUDIENCE: env.MOBILE_REGISTRATION_AUDIENCE,
      MOBILE_PILOT_ENVIRONMENT: env.MOBILE_REGISTRATION_ENVIRONMENT,
      MOBILE_PILOT_EXPIRES_AT: env.MOBILE_REGISTRATION_EXPIRES_AT,
      MOBILE_PILOT_ACTIVE_KEY_ID: env.MOBILE_REGISTRATION_ACTIVE_KEY_ID,
      MOBILE_PILOT_KEYS: env.MOBILE_REGISTRATION_KEYS,
      MOBILE_PILOT_ACCOUNTS: JSON.stringify([
        {
          email: "config-validation@example.invalid",
          userId: "00000000-0000-4000-8000-000000000001",
        },
      ]),
    },
    now,
  )
  return {
    issuer: "chaarlie-mobile-registration",
    audience: parsed.audience,
    environment: parsed.environment,
    expiresAt: parsed.expiresAt,
    activeKeyId: parsed.activeKeyId,
    keys: parsed.keys,
    callbackUrl,
    emails,
  }
}
function validate(config: RegistrationConfig, c: RegistrationClaims, now: number) {
  if (
    !eligibleRegistrationEmail(config, c.email) ||
    !UUID.test(c.attemptId) ||
    !UUID.test(c.sendGeneration) ||
    !/^[a-f0-9]{64}$/.test(c.requestHash) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ||
    c.email !== c.email.trim().toLowerCase() ||
    c.email.length > 254 ||
    !Number.isSafeInteger(c.expiresAt) ||
    c.expiresAt <= now ||
    c.expiresAt > Math.min(now + 3600, config.expiresAt)
  )
    invalid()
  if (c.purpose === "registration_request") {
    if (
      c.userId !== undefined ||
      c.credential !== undefined ||
      c.refreshToken !== undefined ||
      c.sessionId !== undefined ||
      c.sessionExpiresAt !== undefined
    )
      invalid()
  } else {
    if (!c.userId || !UUID.test(c.userId) || !c.credential || c.credential.length > 4096) invalid()
    if (c.purpose === "registration_verification") {
      if (
        !/^[A-Za-z0-9_-]{32,256}$/.test(c.credential) ||
        c.refreshToken !== undefined ||
        c.sessionId !== undefined ||
        c.sessionExpiresAt !== undefined
      )
        invalid()
    } else if (c.purpose === "registration_completion" || c.purpose === "profile_completion") {
      if (
        !c.refreshToken ||
        c.refreshToken.length > 4096 ||
        !c.sessionId ||
        !UUID.test(c.sessionId) ||
        !Number.isSafeInteger(c.sessionExpiresAt) ||
        c.sessionExpiresAt! <= now
      )
        invalid()
    } else invalid()
  }
}
async function privateKey(config: RegistrationConfig, keyId: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    config.keys[keyId] as BufferSource,
    "HKDF",
    false,
    ["deriveBits"],
  )
  const bytes = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("chaarlie-registration-private-v1"),
      info: new TextEncoder().encode(`${config.issuer}:${config.audience}:${config.environment}`),
    },
    key,
    256,
  )
  return new Uint8Array(bytes)
}
export async function sealRegistrationCredential(
  config: RegistrationConfig,
  c: RegistrationClaims,
  now = Math.floor(Date.now() / 1000),
) {
  validate(config, c, now)
  if (c.purpose === "registration_completion" || c.purpose === "profile_completion") {
    return new EncryptJWT({ ...c, environment: config.environment, version: 1 })
      .setProtectedHeader({
        alg: "dir",
        enc: "A256GCM",
        typ: privateType(c.purpose),
        kid: config.activeKeyId,
      })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt(now)
      .setExpirationTime(c.expiresAt)
      .encrypt(await privateKey(config, config.activeKeyId))
  }
  return new SignJWT({ ...c, environment: config.environment, version: 1 })
    .setProtectedHeader({ alg: "HS256", typ: TYPE, kid: config.activeKeyId })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt(now)
    .setExpirationTime(c.expiresAt)
    .sign(config.keys[config.activeKeyId])
}
export async function openRegistrationCredential(
  config: RegistrationConfig,
  raw: string,
  purpose: RegistrationPurpose,
  now = Math.floor(Date.now() / 1000),
): Promise<RegistrationClaims> {
  try {
    if (!raw || raw.length > 16384) invalid()
    const header = decodeProtectedHeader(raw)
    const privatePurpose = purpose === "registration_completion" || purpose === "profile_completion"
    if (typeof header.kid !== "string" || !Object.hasOwn(config.keys, header.kid)) invalid()
    const options = {
      issuer: config.issuer,
      audience: config.audience,
      currentDate: new Date(now * 1000),
      requiredClaims: ["iat", "exp", "iss", "aud"],
    }
    let payload
    if (privatePurpose) {
      if (
        header.alg !== "dir" ||
        header.enc !== "A256GCM" ||
        header.typ !== privateType(purpose) ||
        Object.keys(header).length !== 4
      )
        invalid()
      const verified = await jwtDecrypt(raw, await privateKey(config, header.kid), {
        ...options,
        typ: privateType(purpose),
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      })
      payload = verified.payload
    } else {
      if (header.alg !== "HS256" || header.typ !== TYPE || Object.keys(header).length !== 3)
        invalid()
      const verified = await jwtVerify(raw, config.keys[header.kid], {
        ...options,
        typ: TYPE,
        algorithms: ["HS256"],
      })
      payload = verified.payload
    }
    const allowed = new Set([
      "purpose",
      "attemptId",
      "sendGeneration",
      "requestHash",
      "email",
      "expiresAt",
      "userId",
      "credential",
      "refreshToken",
      "sessionId",
      "sessionExpiresAt",
      "environment",
      "version",
      "iat",
      "exp",
      "iss",
      "aud",
    ])
    if (
      Object.keys(payload).some((k) => !allowed.has(k)) ||
      payload.purpose !== purpose ||
      payload.environment !== config.environment ||
      payload.version !== 1 ||
      payload.aud !== config.audience ||
      payload.exp !== payload.expiresAt ||
      !Number.isSafeInteger(payload.iat) ||
      payload.iat! > now
    )
      invalid()
    const claims = Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) => !["environment", "version", "iat", "exp", "iss", "aud"].includes(key),
      ),
    )
    validate(config, claims as RegistrationClaims, now)
    return claims as RegistrationClaims
  } catch {
    invalid()
  }
}
export async function registrationCodeDigest(
  config: RegistrationConfig,
  c: Pick<RegistrationClaims, "attemptId" | "sendGeneration" | "requestHash" | "email">,
  code: string,
  keyId = config.activeKeyId,
) {
  if (!eligibleRegistrationEmail(config, c.email) || !Object.hasOwn(config.keys, keyId)) invalid()
  if (!/^\d{8}$/.test(code)) invalid()
  const key = await crypto.subtle.importKey(
    "raw",
    config.keys[keyId] as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      JSON.stringify([
        "registration-code-v1",
        config.environment,
        c.attemptId,
        c.sendGeneration,
        c.requestHash,
        c.email,
        code,
      ]),
    ),
  )
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
}
