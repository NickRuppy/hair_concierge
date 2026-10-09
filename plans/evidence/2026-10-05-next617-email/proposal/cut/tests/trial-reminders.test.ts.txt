import assert from "node:assert/strict"
import test from "node:test"

import { buildTrialReminderMessage } from "../src/lib/billing/trial-reminders"

const annual = {
  version: "trial_required_notices_v1",
  contractId: "11111111-1111-4111-8111-111111111111",
  provider: "stripe",
  termsVersion: "trial_launch_v1",
  interval: "year",
  currency: "EUR",
  firstAmountMinor: 6999,
  renewalAmountMinor: 9999,
  authorizedAt: "2026-09-14T10:00:00Z",
  trialEndAt: "2026-09-21T10:00:00Z",
  taxBehavior: "inclusive",
}

test("supports the accepted monthly and annual price contracts without inventing amounts", () => {
  const monthly = buildTrialReminderMessage({
    ...annual,
    interval: "month",
    firstAmountMinor: 999,
    renewalAmountMinor: 999,
  })
  const annualFullPrice = buildTrialReminderMessage({ ...annual, firstAmountMinor: 9999 })

  assert.equal(monthly.messageData.first_charge_amount, "9,99 €")
  assert.equal(monthly.messageData.renewal_amount, "9,99 €")
  assert.equal(monthly.messageData.plan_label, "Monatsmitgliedschaft")
  assert.equal(monthly.messageData.billing_interval_label, "monatlich")
  assert.match(annualFullPrice.receipt_text, /Erste Zahlung: 99,99\s*€/)
  assert.equal(annualFullPrice.messageData.renewal_amount, "99,99 €")
})

test("rejects malformed accepted terms rather than creating a reminder with fallback billing facts", () => {
  assert.throws(
    () => buildTrialReminderMessage({ ...annual, trialEndAt: "2026-09-22T10:00:00Z" }),
    /Invalid trial reminder snapshot/,
  )
  assert.throws(
    () => buildTrialReminderMessage({ ...annual, renewalAmountMinor: 6999 }),
    /Invalid trial reminder snapshot/,
  )
})

test("PayPal reminder states the day-after first-charge date while the trial end stays exact", () => {
  const message = buildTrialReminderMessage({ ...annual, provider: "paypal" })
  assert.equal(message.messageData.first_charge_date, "22. September 2026")
  assert.match(message.messageData.trial_end_date, /21\. September 2026 um 12:00/)
  assert.match(message.messageData.subject, /21\. September 2026/)
})
