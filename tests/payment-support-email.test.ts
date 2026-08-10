import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPaymentSupportReceiptPayload,
  buildPaymentSupportResolutionPayload,
  getPaymentSupportMessageId,
  sendPaymentSupportReceipt,
} from "../src/lib/customerio/payment-support"
import {
  deliverPaymentSupportReceipt,
  type PaymentSupportReceiptClaim,
} from "../src/lib/billing/payment-support-delivery"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "../src/lib/customerio/transactional"

test("builds a fixed receipt without payment or identity details", () => {
  const payload = buildPaymentSupportReceiptPayload(
    {
      email: "lea@example.com",
      reportCode: "PAY-7K2M9ABC",
      attemptId: "receipt-attempt-1",
    },
    {
      CUSTOMERIO_PAYMENT_SUPPORT_RECEIPT_TRANSACTIONAL_MESSAGE_ID: "receipt-template",
    },
  )

  assert.equal(payload.to, "lea@example.com")
  assert.deepEqual(payload.messageData, {
    report_code: "PAY-7K2M9ABC",
    delivery_attempt_id: "receipt-attempt-1",
  })
  assert.doesNotMatch(JSON.stringify(payload.messageData), /lea@example\.com/)
})

test("builds the human-approved resolution wrapper", () => {
  const payload = buildPaymentSupportResolutionPayload(
    {
      email: "lea@example.com",
      reportCode: "PAY-7K2M9ABC",
      attemptId: "resolution-attempt-1",
      resolutionNote: "Deine Bank hat die Karte abgelehnt. Bitte nutze eine andere Karte.",
    },
    {
      CUSTOMERIO_PAYMENT_SUPPORT_RESOLUTION_TRANSACTIONAL_MESSAGE_ID: "resolution-template",
    },
  )

  assert.deepEqual(payload.messageData, {
    report_code: "PAY-7K2M9ABC",
    delivery_attempt_id: "resolution-attempt-1",
    resolution_note: "Deine Bank hat die Karte abgelehnt. Bitte nutze eine andere Karte.",
  })
})

test("requires configured support message IDs", () => {
  assert.throws(() => getPaymentSupportMessageId("receipt", {}), /RECEIPT/)
  assert.equal(
    getPaymentSupportMessageId("resolution", {
      CUSTOMERIO_PAYMENT_SUPPORT_RESOLUTION_TRANSACTIONAL_MESSAGE_ID: "81",
    }),
    81,
  )
})

test("returns the Customer.io delivery receipt from the support sender", async () => {
  const calls: unknown[] = []
  const result = await sendPaymentSupportReceipt(
    {
      email: "lea@example.com",
      reportCode: "PAY-7K2M9ABC",
      attemptId: "receipt-attempt-1",
    },
    {
      environment: {
        CUSTOMERIO_PAYMENT_SUPPORT_RECEIPT_TRANSACTIONAL_MESSAGE_ID: "receipt-template",
      },
      send: async (payload) => {
        calls.push(payload)
        return { deliveryId: "cio-1", queuedAt: 1_786_272_000 }
      },
    },
  )

  assert.equal(calls.length, 1)
  assert.deepEqual(result, { deliveryId: "cio-1", queuedAt: 1_786_272_000 })
})

const claim: PaymentSupportReceiptClaim = {
  caseId: "case-123",
  reportCode: "PAY-7K2M9ABC",
  attemptId: "11111111-1111-4111-8111-111111111111",
  identity: { kind: "lead", id: "22222222-2222-4222-8222-222222222222" },
}

test("claims the durable receipt before sending and records the delivery ID", async () => {
  const order: string[] = []
  await deliverPaymentSupportReceipt("case-123", {
    claim: async () => {
      order.push("claim")
      return claim
    },
    resolveRecipient: async () => {
      order.push("identity")
      return "lea@example.com"
    },
    send: async () => {
      order.push("send")
      return { deliveryId: "cio-1", queuedAt: 1_786_272_000 }
    },
    settle: async (_claim, outcome) => {
      order.push(`settle:${outcome.status}:${outcome.deliveryId ?? "none"}`)
    },
  })
  assert.deepEqual(order, ["claim", "identity", "send", "settle:sent:cio-1"])
})

test("does not send when another task already claimed the receipt", async () => {
  let sends = 0
  await deliverPaymentSupportReceipt("case-123", {
    claim: async () => null,
    resolveRecipient: async () => "lea@example.com",
    send: async () => {
      sends += 1
      return { deliveryId: "cio-1", queuedAt: 1_786_272_000 }
    },
    settle: async () => undefined,
  })
  assert.equal(sends, 0)
})

test("records definitive and ambiguous delivery outcomes without retrying", async () => {
  for (const [error, expected] of [
    [new CustomerIoHttpError(422, "template invalid"), "failed"],
    [new CustomerIoAmbiguousDeliveryError("connection lost"), "delivery_uncertain"],
  ] as const) {
    const outcomes: string[] = []
    let sends = 0
    await deliverPaymentSupportReceipt("case-123", {
      claim: async () => claim,
      resolveRecipient: async () => "lea@example.com",
      send: async () => {
        sends += 1
        throw error
      },
      settle: async (_claim, outcome) => {
        outcomes.push(outcome.status)
      },
    })
    assert.equal(sends, 1)
    assert.deepEqual(outcomes, [expected])
  }
})
