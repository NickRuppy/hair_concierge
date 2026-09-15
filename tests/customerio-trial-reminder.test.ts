import assert from "node:assert/strict"
import test from "node:test"

import { buildTrialReminderMessage } from "../src/lib/billing/trial-reminders"
import {
  buildTrialReminderEmail,
  DEFAULT_TRIAL_REMINDER_SENDER,
  DEFAULT_TRIAL_REMINDER_TRIGGER,
  TRIAL_REMINDER_FROM_ENV,
  TRIAL_REMINDER_MESSAGE_ID_ENV,
} from "../src/lib/customerio/trial-reminder"
import { buildCustomerIoTransactionalEmailRequest } from "../src/lib/customerio/transactional"

const message = buildTrialReminderMessage({
  version: "trial_required_notices_v1",
  contractId: "11111111-1111-4111-8111-111111111111",
  provider: "paypal",
  termsVersion: "trial_launch_v1",
  interval: "year",
  currency: "EUR",
  firstAmountMinor: 9999,
  renewalAmountMinor: 9999,
  authorizedAt: "2026-09-14T10:00:00Z",
  trialEndAt: "2026-09-21T10:00:00Z",
  taxBehavior: "inclusive",
})

test("builds the stored Customer.io transactional message with privacy-preserving flags", () => {
  const payload = buildTrialReminderEmail({
    email: "owner@example.test",
    messageId: "15",
    sender: DEFAULT_TRIAL_REMINDER_SENDER,
    message,
  })
  const request = buildCustomerIoTransactionalEmailRequest(payload)

  assert.equal(TRIAL_REMINDER_MESSAGE_ID_ENV, "CUSTOMERIO_TRIAL_REMINDER_TRANSACTIONAL_MESSAGE_ID")
  assert.equal(TRIAL_REMINDER_FROM_ENV, "CUSTOMERIO_TRIAL_REMINDER_FROM")
  assert.equal(DEFAULT_TRIAL_REMINDER_TRIGGER, "chaarlie_trial_ending_reminder_v1")
  assert.equal(request.body.transactional_message_id, "15")
  assert.equal(request.body.to, "owner@example.test")
  assert.equal(request.body.disable_message_retention, true)
  assert.equal(request.body.send_to_unsubscribed, true)
  assert.equal(request.body.from, DEFAULT_TRIAL_REMINDER_SENDER)
  assert.equal(request.body.subject, "{{ trigger.subject }}")
  assert.equal(request.body.auto_create, false)
  assert.equal(request.body.tracked, false)
  assert.match(request.body.body!, /\{\{ trigger\.trial_end_date \| escape \}\}/)
  assert.match(request.body.body!, /1111B S Governors Ave # 84075/)
  assert.doesNotMatch(request.body.body!, /99,99|owner@example\.test/)
  assert.deepEqual(request.body.message_data, message.messageData)

  const rendered = request.body.body!.replace(
    /\{\{ trigger\.([a-z_]+) \| escape \}\}/g,
    (_match, key: keyof typeof message.messageData) =>
      message.messageData[key]
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;"),
  )
  assert.equal(rendered, message.htmlBody)
})

test("rejects CRLF injection at the transport boundary", () => {
  assert.throws(
    () =>
      buildTrialReminderEmail({
        email: "owner@example.test",
        messageId: "15",
        sender: "Chaarlie\nBcc: attacker@example.test",
        message,
      }),
    /Invalid trial reminder sender or subject/,
  )
})
