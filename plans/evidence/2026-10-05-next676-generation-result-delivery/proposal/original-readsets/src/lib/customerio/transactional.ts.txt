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
  transactionalMessageId: string | number
  messageData: CustomerIoMessageData
  /** Filename to base64-encoded content, sent in the same API request. */
  attachments?: Record<string, string>
  /** Optional complete API-owned content. Existing template-only callers are unchanged. */
  inlineContent?: {
    from: string
    subject: string
    htmlBody: string
    textBody: string
    autoCreate?: boolean
    tracked?: boolean
  }
}

export interface CustomerIoTransactionalEmailRequest {
  path: "/v1/send/email"
  body: {
    to: string
    transactional_message_id: string | number
    identifiers: { email: string }
    message_data: CustomerIoMessageData
    send_to_unsubscribed: true
    disable_message_retention: true
    from?: string
    subject?: string
    body?: string
    body_plain?: string
    auto_create?: boolean
    tracked?: boolean
    attachments?: Record<string, string>
  }
}

interface SendCustomerIoTransactionalEmailOptions {
  apiKey?: string
  apiUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export type CustomerIoTransactionalDeliveryReceipt = {
  deliveryId: string
  queuedAt: string | number
}

export class CustomerIoHttpError extends Error {
  readonly status: number

  constructor(status: number, detail = "") {
    super(`Customer.io transactional email failed: ${status} ${detail}`.trim())
    this.name = "CustomerIoHttpError"
    this.status = status
  }
}

export class CustomerIoAmbiguousDeliveryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "CustomerIoAmbiguousDeliveryError"
  }
}

const DEFAULT_CUSTOMERIO_APP_API_URL = "https://api-eu.customer.io"
const DEFAULT_TIMEOUT_MS = 10_000

export function buildCustomerIoTransactionalEmailRequest(
  payload: CustomerIoTransactionalEmailPayload,
): CustomerIoTransactionalEmailRequest {
  // Customer.io limits the total base64-encoded attachment size to under 2 MB.
  if (
    payload.attachments &&
    Object.values(payload.attachments).reduce(
      (sum, value) => sum + Buffer.byteLength(value, "utf8"),
      0,
    ) >= 2_000_000
  )
    throw new Error("Customer.io attachments must total less than 2 MB encoded")
  return {
    path: "/v1/send/email",
    body: {
      to: payload.to,
      transactional_message_id: payload.transactionalMessageId,
      identifiers: { email: payload.to },
      message_data: payload.messageData,
      send_to_unsubscribed: true,
      disable_message_retention: true,
      ...(payload.attachments ? { attachments: payload.attachments } : {}),
      ...(payload.inlineContent
        ? {
            from: payload.inlineContent.from,
            subject: payload.inlineContent.subject,
            body: payload.inlineContent.htmlBody,
            body_plain: payload.inlineContent.textBody,
            ...(payload.inlineContent.autoCreate !== undefined
              ? { auto_create: payload.inlineContent.autoCreate }
              : {}),
            ...(payload.inlineContent.tracked !== undefined
              ? { tracked: payload.inlineContent.tracked }
              : {}),
          }
        : {}),
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
  await sendCustomerIoTransactionalRequest(payload, options)
}

async function sendCustomerIoTransactionalRequest(
  payload: CustomerIoTransactionalEmailPayload,
  options: SendCustomerIoTransactionalEmailOptions,
): Promise<Response> {
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
    } catch (error) {
      throw new CustomerIoAmbiguousDeliveryError(
        "Customer.io delivery result is unknown after the request failed",
        { cause: error },
      )
    }
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new CustomerIoHttpError(response.status, text)
  }

  return response
}

export async function sendCustomerIoTransactionalEmailWithReceipt(
  payload: CustomerIoTransactionalEmailPayload,
  options: SendCustomerIoTransactionalEmailOptions = {},
): Promise<CustomerIoTransactionalDeliveryReceipt> {
  const response = await sendCustomerIoTransactionalRequest(payload, options)
  const body = await response.json().catch(() => null)
  const deliveryId =
    body && typeof body === "object" && typeof body.delivery_id === "string"
      ? body.delivery_id.trim()
      : ""
  const queuedAt =
    body &&
    typeof body === "object" &&
    (typeof body.queued_at === "string" || typeof body.queued_at === "number")
      ? body.queued_at
      : null

  if (!deliveryId || queuedAt === null) {
    throw new CustomerIoAmbiguousDeliveryError(
      "Customer.io accepted the request without a valid delivery receipt",
    )
  }

  return { deliveryId, queuedAt }
}
