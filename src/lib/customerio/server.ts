type CustomerIoPrimitive = string | number | boolean | null

export type CustomerIoServerValue =
  | CustomerIoPrimitive
  | CustomerIoPrimitive[]
  | Record<string, CustomerIoPrimitive | CustomerIoPrimitive[] | undefined>

export type CustomerIoServerProperties = Record<string, CustomerIoServerValue | undefined>

export type CustomerIoServerResult = {
  ok: boolean
  skipped?: boolean
  status?: number
  error?: string
}

const CUSTOMERIO_PIPELINES_BASE_URL =
  process.env.CUSTOMERIO_PIPELINES_BASE_URL ?? "https://cdp-eu.customer.io/v1"
const DEFAULT_TIMEOUT_MS = 1500

function cleanProperties(properties: CustomerIoServerProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, CustomerIoServerValue>
}

function authorizationHeader(writeKey: string) {
  return `Basic ${Buffer.from(`${writeKey}:`).toString("base64")}`
}

async function postCustomerIoPipelines(
  path: "/identify" | "/track",
  body: Record<string, unknown>,
): Promise<CustomerIoServerResult> {
  const writeKey = process.env.CUSTOMERIO_SERVER_WRITE_KEY
  if (!writeKey) {
    return { ok: false, skipped: true, error: "CUSTOMERIO_SERVER_WRITE_KEY is not set" }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${CUSTOMERIO_PIPELINES_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(writeKey),
        "Content-Type": "application/json",
        "X-Strict-Mode": "1",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return { ok: false, status: response.status, error: `${response.status} ${text}`.trim() }
    }

    return { ok: true, status: response.status }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Customer.io error"
    return { ok: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}

export function identifyCustomerIoServerPerson({
  messageId,
  timestamp,
  traits,
  userId,
}: {
  userId: string
  traits: CustomerIoServerProperties
  messageId: string
  timestamp?: string
}) {
  return postCustomerIoPipelines("/identify", {
    userId,
    traits: cleanProperties(traits),
    messageId,
    ...(timestamp ? { timestamp } : {}),
  })
}

export function trackCustomerIoServerEvent({
  event,
  messageId,
  properties,
  timestamp,
  userId,
}: {
  userId: string
  event: string
  properties: CustomerIoServerProperties
  messageId: string
  timestamp?: string
}) {
  return postCustomerIoPipelines("/track", {
    userId,
    event,
    properties: cleanProperties(properties),
    messageId,
    ...(timestamp ? { timestamp } : {}),
  })
}

export function logCustomerIoServerResult(context: string, result: CustomerIoServerResult) {
  if (result.ok) return

  console.warn("[customerio:server]", context, {
    skipped: result.skipped,
    status: result.status,
    error: result.error,
  })
}
