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

test("builds a concise, truthful annual reminder using accepted contract facts", () => {
  const message = buildTrialReminderMessage(annual)

  assert.equal(message.subject, "Dein kostenloser Test endet am 21. September 2026")
  assert.match(message.receipt_text, /Testende: 21\. September 2026 um 12:00 Uhr MESZ/)
  assert.match(message.receipt_text, /Erste Zahlung: 69,99\s*€ am 21\. September 2026/)
  assert.match(message.receipt_text, /Jahresmitgliedschaft: danach 99,99\s*€ jährlich\./)
  assert.match(message.receipt_text, /Nach dem Test beginnt dein gewählter Tarif automatisch/)
  assert.match(message.receipt_text, /Vor Testende kündigen: https:\/\/chaarlie\.de\/kuendigen/)
  assert.doesNotMatch(message.receipt_text, /Rabatt|Angebot|scanner|quiz/i)
  assert.equal(message.messageData.management_url, "https://chaarlie.de/profile")
  assert.equal(message.messageData.cancellation_url, "https://chaarlie.de/kuendigen")
  assert.match(message.htmlBody, /69,99\s*€/)
  assert.match(message.htmlBody, /href="https:\/\/chaarlie\.de\/kuendigen"/)
  assert.match(message.htmlBody, /1111B S Governors Ave # 84075/)
})

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

test("escapes all rendered data and keeps its trusted links fixed", () => {
  const message = buildTrialReminderMessage({
    ...annual,
    contractId: "11111111-1111-4111-8111-111111111111",
  })
  assert.doesNotMatch(message.htmlBody, /<script|onerror=/i)
  assert.doesNotMatch(message.htmlBody, /\{\{\s*trigger\./)
  assert.doesNotMatch(message.htmlBody, /https:\/\/chaarlie\.de\/impressum/)
  assert.equal(message.messageData.trial_end_date, "21. September 2026 um 12:00 Uhr MESZ")
})
