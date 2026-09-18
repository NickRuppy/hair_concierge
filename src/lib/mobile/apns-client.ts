import "server-only"
import { randomUUID } from "node:crypto"
import { connect } from "node:http2"
import { SignJWT, importPKCS8 } from "jose"

const APNS_SANDBOX_ORIGIN = "https://api.sandbox.push.apple.com"
const APNS_PRODUCTION_ORIGIN = "https://api.push.apple.com"
const APNS_REQUEST_TIMEOUT_MS = 10_000
const APNS_AUTH_TOKEN_REUSE_SECONDS = 50 * 60
const APNS_EXPIRATION_SECONDS = 15 * 60

export type ApnsEnvironment = "sandbox" | "production"

export type ApnsConfig = {
  environment: ApnsEnvironment
  keyId: string
  teamId: string
  topic: string
  privateKey: string
  expirationSeconds?: number
}

export type ApnsRequest = {
  origin: string
  path: string
  headers: Readonly<Record<string, string>>
  body: string
}

export type ApnsTransportResponse = {
  status: number
  headers?: Readonly<Record<string, string | undefined>>
  body?: string
}

export type ApnsTransport = (request: ApnsRequest) => Promise<ApnsTransportResponse>

export type ResearchReadyPush = {
  deviceToken: string
  submissionId: string
}

export type ApnsDeliveryReceipt =
  | { state: "accepted"; apnsId: string }
  | {
      state: "invalid_token"
      apnsId: string
      reason: "BadDeviceToken" | "Unregistered" | "ExpiredToken"
      invalidatedAt: number | null
    }
  | { state: "retryable"; apnsId: string; reason: string; retryAfterSeconds: number | null }
  | { state: "rejected"; apnsId: string; reason: string }
  /** A request may have reached APNs even though no response reached us. Do not blind-retry. */
  | { state: "unknown"; apnsId: string; reason: "transport_failure" }

type ApnsClientDependencies = {
  transport?: ApnsTransport
  now?: () => number
  createId?: () => string
}

/**
 * Server-only APNs provider client for the research-ready notification. It deliberately
 * returns an `unknown` receipt for transport failures: APNs may have accepted the push
 * before a connection or response was lost, so a worker must reconcile rather than resend.
 */
export class ApnsClient {
  private readonly transport: ApnsTransport
  private readonly now: () => number
  private readonly createId: () => string
  private authToken: { value: string; issuedAt: number } | null = null
  private signingKey: Promise<Awaited<ReturnType<typeof importPKCS8>>> | null = null

  constructor(
    private readonly config: ApnsConfig,
    dependencies: ApnsClientDependencies = {},
  ) {
    validateConfig(config)
    this.transport = dependencies.transport ?? sendHttp2ApnsRequest
    this.now = dependencies.now ?? Date.now
    this.createId = dependencies.createId ?? randomUUID
  }

  async sendResearchReady({
    deviceToken,
    submissionId,
  }: ResearchReadyPush): Promise<ApnsDeliveryReceipt> {
    if (!isDeviceToken(deviceToken)) throw new Error("APNs device token is invalid")
    if (!isSubmissionId(submissionId)) throw new Error("Research submission ID is invalid")

    const apnsId = this.createId()
    if (!isUuid(apnsId)) throw new Error("APNs message ID must be a UUID")

    const nowSeconds = Math.floor(this.now() / 1000)
    const body = JSON.stringify({
      aps: {
        alert: { title: "chaarlie", body: "Dein Produkt ist bereit." },
        sound: "default",
      },
      // The iPhone only accepts this fixed HTTPS origin and resolves the opaque ID again.
      url: `https://chaarlie.de/app/research/${submissionId}`,
    })
    const request: ApnsRequest = {
      origin: this.config.environment === "sandbox" ? APNS_SANDBOX_ORIGIN : APNS_PRODUCTION_ORIGIN,
      path: `/3/device/${deviceToken}`,
      headers: {
        authorization: `bearer ${await this.authorization(nowSeconds)}`,
        "apns-expiration": String(nowSeconds + expirationSeconds(this.config)),
        "apns-id": apnsId,
        "apns-push-type": "alert",
        "apns-topic": this.config.topic,
        "content-type": "application/json",
      },
      body,
    }

    try {
      return classifyApnsResponse(await this.transport(request), apnsId)
    } catch {
      // Never expose or log the provider token, device token, or an opaque transport error.
      return { state: "unknown", apnsId, reason: "transport_failure" }
    }
  }

  private async authorization(nowSeconds: number): Promise<string> {
    if (this.authToken && nowSeconds - this.authToken.issuedAt < APNS_AUTH_TOKEN_REUSE_SECONDS)
      return this.authToken.value
    this.signingKey ??= importPKCS8(normalizePrivateKey(this.config.privateKey), "ES256")
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.config.keyId })
      .setIssuer(this.config.teamId)
      .setIssuedAt(nowSeconds)
      .sign(await this.signingKey)
    this.authToken = { value, issuedAt: nowSeconds }
    return value
  }
}

export function readApnsConfig(env: Record<string, string | undefined> = process.env): ApnsConfig {
  const environment = env.MOBILE_APNS_ENVIRONMENT
  if (environment !== "sandbox" && environment !== "production")
    throw new Error("MOBILE_APNS_ENVIRONMENT must be sandbox or production")
  return {
    environment,
    keyId: required(env, "MOBILE_APNS_KEY_ID"),
    teamId: required(env, "MOBILE_APNS_TEAM_ID"),
    topic: required(env, "MOBILE_APNS_TOPIC"),
    privateKey: required(env, "MOBILE_APNS_PRIVATE_KEY"),
  }
}

export function classifyApnsResponse(
  response: ApnsTransportResponse,
  requestedApnsId: string,
): ApnsDeliveryReceipt {
  const apnsId = response.headers?.["apns-id"] || requestedApnsId
  // A transport that ends without HTTP/2 response headers cannot prove APNs rejected
  // the request. Keep it for reconciliation instead of risking a duplicate alert.
  if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599)
    return { state: "unknown", apnsId, reason: "transport_failure" }
  const { reason, timestamp } = apnsError(response.body)
  if (response.status === 200) return { state: "accepted", apnsId }
  if (
    response.status === 410 ||
    reason === "BadDeviceToken" ||
    reason === "Unregistered" ||
    reason === "ExpiredToken"
  ) {
    return {
      state: "invalid_token",
      apnsId,
      reason:
        reason === "BadDeviceToken" || reason === "Unregistered" || reason === "ExpiredToken"
          ? reason
          : "Unregistered",
      invalidatedAt: typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : null,
    }
  }
  // Our own provider credentials failed, not this device. Hold the delivery for a slow
  // retry so a corrected key recovers it; the next run signs a fresh provider token.
  if (reason === "InvalidProviderToken" || reason === "ExpiredProviderToken")
    return { state: "retryable", apnsId, reason, retryAfterSeconds: 3600 }
  if (response.status === 429 || response.status >= 500) {
    return {
      state: "retryable",
      apnsId,
      reason: reason ?? `http_${response.status}`,
      retryAfterSeconds: retryAfter(response.headers?.["retry-after"]),
    }
  }
  return { state: "rejected", apnsId, reason: reason ?? `http_${response.status}` }
}

async function sendHttp2ApnsRequest(request: ApnsRequest): Promise<ApnsTransportResponse> {
  return await new Promise<ApnsTransportResponse>((resolve, reject) => {
    const session = connect(request.origin)
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      session.close()
      callback()
    }
    session.once("error", (error) => finish(() => reject(error)))
    const stream = session.request({ ":method": "POST", ":path": request.path, ...request.headers })
    let status = 0
    let responseHeaders: Record<string, string | undefined> = {}
    let body = ""
    stream.setTimeout(APNS_REQUEST_TIMEOUT_MS, () =>
      stream.destroy(new Error("APNs request timed out")),
    )
    stream.on("response", (headers) => {
      status = typeof headers[":status"] === "number" ? headers[":status"] : 0
      responseHeaders = Object.fromEntries(
        Object.entries(headers)
          .filter(([name, value]) => name !== ":status" && typeof value === "string")
          .map(([name, value]) => [name.toLowerCase(), value as string]),
      )
    })
    stream.setEncoding("utf8")
    stream.on("data", (chunk: string) => {
      if (body.length < 8_192) body += chunk.slice(0, 8_192 - body.length)
    })
    stream.once("error", (error) => finish(() => reject(error)))
    stream.once("end", () => finish(() => resolve({ status, headers: responseHeaders, body })))
    stream.end(request.body)
  })
}

function validateConfig(config: ApnsConfig) {
  if (config.environment !== "sandbox" && config.environment !== "production")
    throw new Error("APNs environment is invalid")
  for (const [label, value] of [
    ["APNs key ID", config.keyId],
    ["APNs team ID", config.teamId],
    ["APNs topic", config.topic],
    ["APNs private key", config.privateKey],
  ] as const) {
    if (!value || value.trim() !== value || (/[\r\n]/.test(value) && label !== "APNs private key"))
      throw new Error(`${label} is invalid`)
  }
  if (!/^[A-Za-z0-9.-]+$/.test(config.topic)) throw new Error("APNs topic is invalid")
  expirationSeconds(config)
}

function expirationSeconds(config: ApnsConfig): number {
  const value = config.expirationSeconds ?? APNS_EXPIRATION_SECONDS
  if (!Number.isInteger(value) || value < 60 || value > 3_600)
    throw new Error("APNs expiration must be between 60 and 3600 seconds")
  return value
}

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]
  if (!value) throw new Error(`${key} is not set`)
  return value
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n")
}

function isDeviceToken(value: string) {
  return /^[A-Fa-f0-9]{32,200}$/.test(value)
}

function isSubmissionId(value: string) {
  return isUuid(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function apnsError(body: string | undefined): { reason: string | null; timestamp: number | null } {
  if (!body || body.length > 8_192) return { reason: null, timestamp: null }
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== "object") return { reason: null, timestamp: null }
    const value = parsed as { reason?: unknown; timestamp?: unknown }
    return {
      reason:
        typeof value.reason === "string" && /^[A-Za-z]+$/.test(value.reason) ? value.reason : null,
      timestamp: typeof value.timestamp === "number" ? value.timestamp : null,
    }
  } catch {
    return { reason: null, timestamp: null }
  }
}

function retryAfter(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) ? seconds : null
}
