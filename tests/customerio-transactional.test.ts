import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCustomerIoTransactionalEmailRequest,
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
  sendCustomerIoTransactionalEmail,
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalEmailPayload,
} from "../src/lib/customerio/transactional"

test("builds Customer.io App API transactional request with privacy flags", () => {
  const payload: CustomerIoTransactionalEmailPayload = {
    to: "lea@example.com",
    transactionalMessageId: 7,
    messageData: { first_name: "Lea", cta_label: "Zur Routine" },
  }

  const request = buildCustomerIoTransactionalEmailRequest(payload)

  assert.equal(request.path, "/v1/send/email")
  assert.deepEqual(request.body.identifiers, { email: "lea@example.com" })
  assert.equal(request.body.to, "lea@example.com")
  assert.equal(request.body.transactional_message_id, 7)
  assert.equal(request.body.send_to_unsubscribed, true)
  assert.equal(request.body.disable_message_retention, true)
  assert.deepEqual(request.body.message_data, payload.messageData)
})

test("sends Customer.io transactional email through the App API", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const payload: CustomerIoTransactionalEmailPayload = {
    to: "lea@example.com",
    transactionalMessageId: "quiz_result_artifact",
    messageData: { cta_label: "Zur Routine" },
  }

  await sendCustomerIoTransactionalEmail(payload, {
    apiKey: "app-key",
    apiUrl: "https://api.example.test",
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response("{}", { status: 200 })
    }) as typeof fetch,
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://api.example.test/v1/send/email")
  assert.equal(calls[0].init.method, "POST")
  assert.deepEqual(calls[0].init.headers, {
    Authorization: "Bearer app-key",
    "Content-Type": "application/json",
  })
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    to: "lea@example.com",
    transactional_message_id: "quiz_result_artifact",
    identifiers: { email: "lea@example.com" },
    message_data: { cta_label: "Zur Routine" },
    send_to_unsubscribed: true,
    disable_message_retention: true,
  })
})

test("throws with status and response text for non-ok responses", async () => {
  const payload: CustomerIoTransactionalEmailPayload = {
    to: "lea@example.com",
    transactionalMessageId: "quiz_result_artifact",
    messageData: {},
  }

  await assert.rejects(
    sendCustomerIoTransactionalEmail(payload, {
      apiKey: "app-key",
      fetchImpl: (async () => new Response("bad request", { status: 422 })) as typeof fetch,
    }),
    /422 bad request/,
  )
})

test("returns the documented Customer.io delivery receipt", async () => {
  const receipt = await sendCustomerIoTransactionalEmailWithReceipt(
    {
      to: "lea@example.com",
      transactionalMessageId: "payment_support_receipt",
      messageData: { report_code: "PAY-7K2M9ABC" },
    },
    {
      apiKey: "app-key",
      fetchImpl: (async () =>
        Response.json({ delivery_id: "cio-delivery-1", queued_at: 1_786_272_000 })) as typeof fetch,
    },
  )

  assert.deepEqual(receipt, {
    deliveryId: "cio-delivery-1",
    queuedAt: 1_786_272_000,
  })
})

test("classifies non-2xx responses as definitive HTTP failures", async () => {
  await assert.rejects(
    sendCustomerIoTransactionalEmailWithReceipt(
      { to: "lea@example.com", transactionalMessageId: 7, messageData: {} },
      {
        apiKey: "app-key",
        fetchImpl: (async () => new Response("invalid template", { status: 422 })) as typeof fetch,
      },
    ),
    (error: unknown) =>
      error instanceof CustomerIoHttpError &&
      error.status === 422 &&
      error.message.includes("invalid template"),
  )
})

test("treats network failures and malformed success receipts as ambiguous", async () => {
  const payload: CustomerIoTransactionalEmailPayload = {
    to: "lea@example.com",
    transactionalMessageId: 7,
    messageData: {},
  }

  await assert.rejects(
    sendCustomerIoTransactionalEmailWithReceipt(payload, {
      apiKey: "app-key",
      fetchImpl: (async () => {
        throw new TypeError("connection reset")
      }) as typeof fetch,
    }),
    CustomerIoAmbiguousDeliveryError,
  )

  await assert.rejects(
    sendCustomerIoTransactionalEmailWithReceipt(payload, {
      apiKey: "app-key",
      fetchImpl: (async () => Response.json({ queued_at: 1_786_272_000 })) as typeof fetch,
    }),
    CustomerIoAmbiguousDeliveryError,
  )
})
