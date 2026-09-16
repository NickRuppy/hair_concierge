import assert from "node:assert/strict"
import test from "node:test"
import { PDFParse } from "pdf-parse"
import { buildTrialRequiredNoticeMessage } from "../src/lib/billing/trial-required-notices"
import {
  buildRequiredNoticeEmail,
  previewRequiredNoticeHtml,
} from "../src/lib/customerio/trial-required-notices"
import { renderCustomerIoTriggerTemplate } from "./helpers/customerio-liquid"

const snapshot = {
  version: "trial_required_notices_v1",
  contractId: "11111111-1111-4111-8111-111111111111",
  provider: "paypal",
  termsVersion: "trial_launch_v1",
  interval: "year",
  currency: "EUR",
  firstAmountMinor: 6999,
  renewalAmountMinor: 9999,
  authorizedAt: "2026-09-16T07:31:26Z",
  trialEndAt: "2026-09-25T00:00:00Z",
  taxBehavior: "inclusive",
}
test("confirmation opens with scan-friendly payment and deadline facts, with full receipt attached", async () => {
  const message = buildTrialRequiredNoticeMessage("contract_confirmation", snapshot)
  const html = previewRequiredNoticeHtml(message)
  assert.match(html, /<h1[^>]*>Dein Chaarlie-Test ist bestätigt\./)
  assert.match(html, /Heute bezahlt/)
  assert.match(html, /0,00 €/)
  assert.match(html, /25\. September 2026 um 02:00:00 MESZ/)
  assert.match(html, /Erste Zahlung am 25\. September 2026/)
  assert.match(html, /69,99\s€ für das erste Jahr/)
  assert.match(html, /Danach 99,99\s€ jährlich im Voraus/)
  assert.match(html, /PDF-Anhang/)
  assert.doesNotMatch(html, /§ 12|Vertragskennung:|Muster-Widerrufsformular/)
  const payload = await buildRequiredNoticeEmail({
    email: "owner@example.test",
    messageId: "test",
    sender: "Chaarlie <info@chaarlie.de>",
    message,
  })
  assert.equal(payload.messageData.receipt_text, message.receipt_text)
  const attachments = payload.attachments!
  assert.deepEqual(Object.keys(attachments), ["Deine-Chaarlie-Vertragsunterlagen.pdf"])
  const bytes = Buffer.from(Object.values(attachments)[0], "base64")
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-")
  assert.ok(bytes.length < 100_000)
  const parser = new PDFParse({ data: new Uint8Array(bytes) })
  try {
    const extracted = await parser.getText({ pageJoiner: "" })
    const withoutDecoration = extracted.text
      .replace(/Chaarlie · Vertragsunterlagen \| \d+ \/ \d+/g, "")
      .replace(/^\s*chaarlie\s+Deine Vertragsunterlagen\s+/, "")
    const normalize = (text: string) => text.replace(/\s+/g, "")
    assert.equal(normalize(withoutDecoration), normalize(message.receipt_text))
  } finally {
    await parser.destroy()
  }
  const plain = renderCustomerIoTriggerTemplate(
    payload.inlineContent!.textBody,
    payload.messageData,
  )
  assert.match(plain, /PDF-Anhang/)
  assert.match(plain, /69,99\s€/)
  assert.doesNotMatch(plain, /§ 12|Vertragskennung:/)
})
test("monthly Stripe and historical PayPal dates reflect their own accepted snapshot", () => {
  const monthly = previewRequiredNoticeHtml(
    buildTrialRequiredNoticeMessage("contract_confirmation", {
      ...snapshot,
      provider: "stripe",
      interval: "month",
      firstAmountMinor: 999,
      renewalAmountMinor: 999,
      trialEndAt: "2026-09-23T07:31:26Z",
    }),
  )
  assert.match(monthly, /9,99\s€ monatlich/)
  assert.match(monthly, /Erste Zahlung am 23\. September 2026 um 09:31:26 MESZ/)
  assert.doesNotMatch(monthly, /für das erste Jahr|Danach 99,99/)
  const historical = previewRequiredNoticeHtml(
    buildTrialRequiredNoticeMessage("contract_confirmation", {
      ...snapshot,
      trialEndAt: "2026-09-23T07:31:26Z",
      firstAmountMinor: 9999,
    }),
  )
  assert.match(historical, /Erste Zahlung am 24\. September 2026/)
  assert.match(historical, /99,99\s€ für das erste Jahr/)
})
test("canceled confirmation does not promise a charge or ask for cancellation again", () => {
  const html = previewRequiredNoticeHtml(
    buildTrialRequiredNoticeMessage("contract_confirmation", {
      ...snapshot,
      cancelAtPeriodEnd: true,
    }),
  )
  const summary = html.slice(0, html.indexOf("Deine Vertragsunterlagen"))
  assert.match(summary, /Deine Kündigung ist berücksichtigt/)
  assert.doesNotMatch(summary, /Erste Zahlung am|Test kündigen|sofern du nicht/)
})
test("provider template treats escaped HTML as data and preserves literal Liquid, Unicode and plain text", async () => {
  const original = buildTrialRequiredNoticeMessage("contract_confirmation", snapshot)
  const message = {
    ...original,
    confirmation: {
      ...original.confirmation!,
      plan: '<img src=x onerror=alert(1)> {{ customer.email }} & "Text"',
    },
  }
  const payload = await buildRequiredNoticeEmail({
    email: "owner@example.test",
    messageId: "test",
    sender: "Chaarlie <info@chaarlie.de>",
    message,
  })
  const rendered = renderCustomerIoTriggerTemplate(
    payload.inlineContent!.htmlBody,
    payload.messageData,
  )
  assert.equal(rendered, previewRequiredNoticeHtml(message))
  assert.match(
    rendered,
    /&lt;img src=x onerror=alert\(1\)&gt; \{\{ customer.email \}\} &amp; &quot;Text&quot;/,
  )
  assert.doesNotMatch(rendered, /<img|%20|%0A|%C3/)
  assert.doesNotMatch(payload.inlineContent!.htmlBody, /onerror|customer.email/)
  assert.match(
    renderCustomerIoTriggerTemplate(payload.inlineContent!.textBody, payload.messageData),
    /PDF-Anhang/,
  )
  assert.equal(payload.inlineContent!.tracked, false)
  assert.equal((rendered.match(/<html/g) ?? []).length, 1)
})

test("PDF failures reject the whole confirmation payload; other notices have no attachment", async () => {
  const input = {
    email: "owner@example.test",
    messageId: "test",
    sender: "Chaarlie <info@chaarlie.de>",
  }
  const message = buildTrialRequiredNoticeMessage("contract_confirmation", snapshot)
  await assert.rejects(
    buildRequiredNoticeEmail({ ...input, message: { ...message, receipt_text: "" } }),
    /empty contract PDF/,
  )
  await assert.rejects(
    buildRequiredNoticeEmail({
      ...input,
      message: { ...message, receipt_text: message.receipt_text + "\n😀" },
    }),
    /cannot encode/,
  )
  const declaration = {
    subject: "Deine Erklärung",
    receipt_text: "Vollständige Erklärung mit äöü {{ literal }}",
  }
  const payload = await buildRequiredNoticeEmail({ ...input, message: declaration })
  assert.equal(payload.attachments, undefined)
  assert.equal(
    renderCustomerIoTriggerTemplate(payload.inlineContent!.textBody, payload.messageData),
    declaration.receipt_text,
  )
})
