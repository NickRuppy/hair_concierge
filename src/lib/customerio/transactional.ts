export type CustomerIoMessageDataValue =
  | string
  | number
  | boolean
  | null
  | CustomerIoMessageDataValue[]
  | { [key: string]: CustomerIoMessageDataValue }

export type CustomerIoMessageData = Record<string, CustomerIoMessageDataValue>

export interface CustomerIoTransactionalEmailPayload {
  to: string
  transactionalMessageId: string
  messageData: CustomerIoMessageData
}

export interface CustomerIoTransactionalEmailRequest {
  path: "/v1/send/email"
  body: {
    to: string
    transactional_message_id: string
    identifiers: { email: string }
    message_data: CustomerIoMessageData
    send_to_unsubscribed: true
    disable_message_retention: true
  }
}

interface SendCustomerIoTransactionalEmailOptions {
  apiKey?: string
  apiUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_CUSTOMERIO_APP_API_URL = "https://api-eu.customer.io"
const DEFAULT_TIMEOUT_MS = 10_000

export function buildCustomerIoTransactionalEmailRequest(
  payload: CustomerIoTransactionalEmailPayload,
): CustomerIoTransactionalEmailRequest {
  return {
    path: "/v1/send/email",
    body: {
      to: payload.to,
      transactional_message_id: payload.transactionalMessageId,
      identifiers: { email: payload.to },
      message_data: payload.messageData,
      send_to_unsubscribed: true,
      disable_message_retention: true,
    },
  }
}

function joinApiUrl(apiUrl: string, path: CustomerIoTransactionalEmailRequest["path"]) {
  return `${apiUrl.replace(/\/+$/, "")}${path}`
}

export async function sendCustomerIoTransactionalEmail(
  payload: CustomerIoTransactionalEmailPayload,
  options: SendCustomerIoTransactionalEmailOptions = {},
): Promise<void> {
  const apiKey = options.apiKey ?? process.env.CUSTOMERIO_APP_API_KEY

  if (!apiKey) {
    throw new Error("CUSTOMERIO_APP_API_KEY is not set")
  }

  const apiUrl =
    options.apiUrl ?? process.env.CUSTOMERIO_APP_API_URL ?? DEFAULT_CUSTOMERIO_APP_API_URL
  const fetchImpl = options.fetchImpl ?? fetch
  const request = buildCustomerIoTransactionalEmailRequest(payload)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetchImpl(joinApiUrl(apiUrl, request.path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Customer.io transactional email failed: ${response.status} ${text}`.trim())
  }
}
