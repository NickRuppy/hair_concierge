import assert from "node:assert/strict"
import test from "node:test"
import { PDFParse } from "pdf-parse"
import { buildTrialRequiredNoticeMessage } from "../src/lib/billing/trial-required-notices"
import {
  buildRequiredNoticeEmail,
  previewRequiredNoticeHtml,
} from "../src/lib/customerio/trial-required-notices"
import { renderCustomerIoTriggerTemplate } from "./helpers/customerio-liquid"
import {
  publicDeclarationReceiptText,
  publicDeclarationRequiredNoticePresentation,
  publicDeclarationStatement,
  type PublicContractDeclarationReceipt,
} from "../src/lib/billing/public-contract-declaration"
import { renderRequiredNoticeText } from "../src/lib/customerio/required-notice-html"

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

test("trial cancellation uses the approved branded hierarchy and provider-pending language", async () => {
  const message = buildTrialRequiredNoticeMessage("cancellation_receipt", {
    ...snapshot,
    declarationId: "22222222-2222-4222-8222-222222222222",
    submittedAt: "2026-09-20T07:31:26Z",
    effectiveEndAt: snapshot.trialEndAt,
  })
  const html = previewRequiredNoticeHtml(message)
  const payload = await buildRequiredNoticeEmail({
    email: "owner@example.test",
    messageId: "test",
    sender: "Chaarlie <info@chaarlie.de>",
    message,
  })
  assert.match(html, /background:#f7f5fa/)
  assert.match(html, /max-width:600px/)
  assert.match(html, /KÜNDIGUNG EINGEGANGEN/)
  assert.match(html, /Nach dem Test entstehen keine Kosten\./)
  assert.match(html, /technische Bearbeitung beim Zahlungsanbieter/)
  assert.match(html, /Diese Eingangsbestätigung bleibt gültig/)
  assert.match(html, /Zugang endet/)
  assert.match(html, /25\. September 2026 um 02:00:00 MESZ/)
  assert.match(html, /Mitgliedschaft ansehen/)
  assert.doesNotMatch(html, />Online kündigen</)
  assert.match(payload.inlineContent!.htmlBody, /trigger\.required_notice_html/)
  assert.equal(payload.inlineContent!.textBody, "{{ trigger.required_notice_text }}")
  assert.deepEqual(Object.keys(payload.messageData), [
    "subject",
    "receipt_text",
    "required_notice_html",
    "required_notice_text",
  ])
  assert.equal(
    renderCustomerIoTriggerTemplate(payload.inlineContent!.htmlBody, payload.messageData),
    html,
  )
  const text = renderCustomerIoTriggerTemplate(payload.inlineContent!.textBody, payload.messageData)
  assert.match(text, /Nach dem Test entstehen keine Kosten\./)
  assert.match(text, /Kündigungskennung: 22222222-2222-4222-8222-222222222222/)
  assert.match(text, /Eingegangen: 20\. September 2026 um 09:31:26 MESZ/)
  assert.match(text, /Zugang endet: 25\. September 2026 um 02:00:00 MESZ/)
  assert.match(text, /Mitgliedschaft ansehen: https:\/\/chaarlie\.de\/profile/)
  assert.doesNotMatch(text, /Online kündigen:/)
})

test("all lifecycle variants keep their truthful status, actions and durable contract appendix", () => {
  const cases = [
    {
      message: buildTrialRequiredNoticeMessage("contract_change", {
        ...snapshot,
        provider: "stripe",
        authorizedAt: "2026-09-16T07:31:26Z",
        trialEndAt: "2026-09-23T07:31:26Z",
        operationId: "22222222-2222-4222-8222-222222222222",
        revision: 1,
        changeKind: "switch",
        committedAt: "2026-09-17T07:31:26Z",
        cancelAtPeriodEnd: false,
      }),
      matches: [/ÄNDERUNG BESTÄTIGT/, /Deine Laufzeit wurde geändert\./, /Online kündigen/],
      textMatches: [
        /Änderungskennung: 22222222-2222-4222-8222-222222222222/,
        /Bestätigt: 17\. September 2026 um 09:31:26 MESZ/,
        /Vollständige Vertragsbedingungen/,
        /Allgemeine Geschäftsbedingungen \(Stand September 2026\)/,
      ],
    },
    {
      message: buildTrialRequiredNoticeMessage("paid_cancellation_receipt", {
        ...snapshot,
        declarationId: "22222222-2222-4222-8222-222222222222",
        submittedAt: "2026-10-01T07:31:26Z",
        effectiveEndAt: "2027-09-25T00:00:00Z",
        paidThroughAt: "2027-09-25T00:00:00Z",
        providerStatus: "pending",
      }),
      matches: [
        /KÜNDIGUNG EINGEGANGEN/,
        /Bezahlter Zugang bis/,
        /Diese Eingangsbestätigung bleibt gültig/,
      ],
      textMatches: [
        /Kündigungskennung: 22222222-2222-4222-8222-222222222222/,
        /Eingegangen: 1\. Oktober 2026 um 09:31:26 MESZ/,
        /Wirksames Vertragsende: 25\. September 2027 um 02:00:00 MESZ/,
        /technische Bearbeitung beim Zahlungsanbieter läuft noch/,
      ],
    },
    {
      message: buildTrialRequiredNoticeMessage("annual_renewal", {
        ...snapshot,
        renewalAt: "2027-09-25T00:00:00Z",
        amountMinor: 9999,
      }),
      matches: [
        /JÄHRLICHE ZAHLUNG/,
        /99,99\s€ inkl\. Steuern/,
        /keine neue feste Jahresbindung/,
        /25\. September 2027 um 02:00:00 MESZ/,
        /Ungenutztes vorausgezahltes Entgelt wird zeitanteilig erstattet/,
      ],
      textMatches: [
        /Betrag: 99,99\s€ inkl\. Steuern/,
        /Vorgesehen: 25\. September 2027 um 02:00:00 MESZ/,
        /Zahlungsanbieter: PayPal/,
        /Online kündigen: https:\/\/chaarlie\.de\/kuendigen/,
      ],
    },
  ]
  for (const { message, matches, textMatches } of cases) {
    const html = previewRequiredNoticeHtml(message)
    for (const pattern of matches) assert.match(html, pattern)
    const text = renderRequiredNoticeText(message)
    for (const pattern of textMatches) assert.match(text, pattern)
    assert.match(html, /Mitgliedschaft/)
    assert.match(html, /overflow-wrap:anywhere/)
  }
  const contractChange = previewRequiredNoticeHtml(cases[0]!.message)
  assert.match(contractChange, /Vollständige Vertragsbedingungen/)
  assert.match(contractChange, /Allgemeine Geschäftsbedingungen \(Stand September 2026\)/)
})

test("public declarations render ordinary, extraordinary and withdrawal receipts without inventing account state", async () => {
  const base: PublicContractDeclarationReceipt = {
    declarationId: "22222222-2222-4222-8222-222222222222",
    submittedAt: "2026-09-22T08:56:19Z",
    declaration: {
      requestId: "33333333-3333-4333-8333-333333333333",
      kind: "ordinary_cancellation",
      name: "Marie Beispiel",
      email: "marie@example.test",
      contract: "Chaarlie Jahresmitgliedschaft",
      requestedEnd: "zum nächstmöglichen Zeitpunkt",
      reason: null,
    },
  }
  const cases: Array<{
    receipt: PublicContractDeclarationReceipt
    title: RegExp
    fact: RegExp
    detail?: RegExp
  }> = [
    {
      receipt: base,
      title: /Wir haben deine Kündigung erhalten\./,
      fact: /Ordentliche Kündigung/,
    },
    {
      receipt: {
        ...base,
        declaration: {
          ...base.declaration,
          kind: "extraordinary_cancellation",
          requestedEnd: "sofort",
          reason: '<img src=x onerror=alert(1)> {{ customer.email }} & "Grund"',
        },
      },
      title: /Wir haben deine außerordentliche Kündigung erhalten\./,
      fact: /Außerordentliche Kündigung/,
      detail:
        /&lt;img src=x onerror=alert\(1\)&gt; \{\{ customer\.email \}\} &amp; &quot;Grund&quot;/,
    },
    {
      receipt: {
        ...base,
        declaration: {
          ...base.declaration,
          kind: "withdrawal",
          requestedEnd: null,
        },
      },
      title: /Wir haben deinen Widerruf erhalten\./,
      fact: /Die Zuordnung und Abwicklung werden geprüft/,
    },
  ]
  for (const { receipt, title, fact, detail } of cases) {
    const message = {
      subject: "Deine Erklärung zu deinem Chaarlie Vertrag",
      receipt_text: publicDeclarationReceiptText(receipt),
      requiredNotice: publicDeclarationRequiredNoticePresentation(receipt),
    }
    const html = previewRequiredNoticeHtml(message)
    assert.match(html, title)
    assert.match(html, fact)
    assert.match(html, /noch keine Bestätigung eines Vertragsendes/)
    assert.match(html, /href="mailto:info@chaarlie\.de"[^>]*>Kontakt aufnehmen</)
    assert.doesNotMatch(html, /Mitgliedschaft verwalten|Online kündigen/)
    assert.match(html, /Marie Beispiel/)
    assert.doesNotMatch(html, /<img|%20|%0A|%C3/)
    if (detail) assert.match(html, detail)
    const payload = await buildRequiredNoticeEmail({
      email: receipt.declaration.email,
      messageId: "test",
      sender: "Chaarlie <info@chaarlie.de>",
      message,
    })
    assert.equal(
      renderCustomerIoTriggerTemplate(payload.inlineContent!.htmlBody, payload.messageData),
      html,
    )
    const text = renderCustomerIoTriggerTemplate(
      payload.inlineContent!.textBody,
      payload.messageData,
    )
    assert.ok(text.includes(receipt.declarationId))
    assert.ok(text.includes("22. September 2026 um 10:56:19 MESZ"))
    assert.ok(text.includes(receipt.declaration.name))
    assert.ok(text.includes(receipt.declaration.email))
    assert.ok(text.includes(receipt.declaration.contract))
    assert.ok(text.includes(publicDeclarationStatement(receipt.declaration)))
    if (receipt.declaration.reason) assert.ok(text.includes(receipt.declaration.reason))
    assert.match(text, /Kontakt aufnehmen: mailto:info@chaarlie\.de/)
    assert.equal(payload.inlineContent!.tracked, false)
  }
})

test("first paid receipt renders the approved branded hierarchy without losing exact receipt facts", async () => {
  const message = buildTrialRequiredNoticeMessage("payment_receipt", {
    ...snapshot,
    provider: "stripe",
    trialEndAt: "2026-09-23T07:31:26Z",
    paymentEventId: "22222222-2222-4222-8222-222222222222",
    phase: "first_paid",
    occurredAt: "2026-09-23T07:31:26Z",
    paidThroughAt: "2027-09-23T07:31:26Z",
    amountMinor: 6999,
  })
  const html = previewRequiredNoticeHtml(message)
  assert.match(html, /background:#f7f5fa/)
  assert.match(html, /max-width:600px/)
  assert.match(html, /ZAHLUNG BESTÄTIGT/)
  assert.match(html, /<h1[^>]*>Deine Mitgliedschaft ist jetzt aktiv\.<\/h1>/)
  assert.match(html, /Dein kostenloser Test ist abgeschlossen\./)
  assert.match(html, /dein bezahlter Chaarlie-Zugang ist jetzt aktiv\./)
  assert.doesNotMatch(html, /ohne Unterbrechung/)
  assert.match(html, /Bezahlt/)
  assert.match(html, /69,99\s€/)
  assert.match(html, /Zahlungsdatum/)
  assert.match(html, /23\. September 2026/)
  assert.match(html, /Bezahlter Zugang bis/)
  assert.match(html, /23\. September 2027/)
  assert.match(html, /Jahresmitgliedschaft · bezahlt über Stripe/)
  assert.match(html, /Gesamtpreis inkl\. anwendbarer Steuern/)
  assert.match(html, /href="https:\/\/chaarlie\.de\/profile"[^>]*>Mitgliedschaft verwalten<\/a>/)
  assert.match(html, /href="https:\/\/chaarlie\.de\/kuendigen"[^>]*>Online kündigen<\/a>/)
  assert.match(html, /Belegdetails/)
  assert.match(html, /23\. September 2026 um 09:31:26 MESZ/)
  assert.match(html, /23\. September 2027 um 09:31:26 MESZ/)
  assert.match(html, /11111111-1111-4111-8111-111111111111/)
  assert.match(html, /22222222-2222-4222-8222-222222222222/)
  assert.match(html, /overflow-wrap:anywhere/)

  const payload = await buildRequiredNoticeEmail({
    email: "owner@example.test",
    messageId: "test",
    sender: "Chaarlie <info@chaarlie.de>",
    message,
  })
  assert.equal(payload.attachments, undefined)
  assert.match(payload.inlineContent!.htmlBody, /\{\{ trigger\.payment_receipt_html \}\}/)
  assert.doesNotMatch(payload.inlineContent!.htmlBody, /receipt_text \| htmlencode/)
  assert.equal(payload.inlineContent!.textBody, "{{ trigger.payment_receipt_text }}")
  assert.equal(payload.inlineContent!.tracked, false)
  const renderedHtml = renderCustomerIoTriggerTemplate(
    payload.inlineContent!.htmlBody,
    payload.messageData,
  )
  const renderedText = renderCustomerIoTriggerTemplate(
    payload.inlineContent!.textBody,
    payload.messageData,
  )
  assert.equal(renderedHtml, html)
  assert.match(renderedText, /Deine Mitgliedschaft ist jetzt aktiv\./)
  assert.match(renderedText, /Zahlung gebucht: 23\. September 2026 um 09:31:26 MESZ/)
  assert.match(renderedText, /Zugang bezahlt bis: 23\. September 2027 um 09:31:26 MESZ/)
  assert.match(renderedText, /Online kündigen: https:\/\/chaarlie\.de\/kuendigen/)
  assert.match(renderedText, /Zahlungskennung: 22222222-2222-4222-8222-222222222222/)
})

test("renewal receipt uses continuation copy and keeps dynamic summary values escaped as data", async () => {
  const original = buildTrialRequiredNoticeMessage("payment_receipt", {
    ...snapshot,
    provider: "paypal",
    paymentEventId: "22222222-2222-4222-8222-222222222222",
    phase: "renewal",
    occurredAt: "2027-09-25T07:31:26Z",
    paidThroughAt: "2028-09-25T07:31:26Z",
    amountMinor: 9999,
  })
  const message = {
    ...original,
    paymentReceipt: {
      ...original.paymentReceipt!,
      plan: '<img src=x onerror=alert(1)> {{ customer.email }} & "Plan"',
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
  assert.match(rendered, /<h1[^>]*>Deine Mitgliedschaft läuft weiter\.<\/h1>/)
  assert.doesNotMatch(rendered, /kostenloser Test ist abgeschlossen/)
  assert.match(rendered, /99,99\s€/)
  assert.match(rendered, /bezahlt über PayPal/)
  assert.match(
    rendered,
    /&lt;img src=x onerror=alert\(1\)&gt; \{\{ customer\.email \}\} &amp; &quot;Plan&quot;/,
  )
  assert.doesNotMatch(rendered, /<img|%20|%0A|%C3/)
  assert.doesNotMatch(payload.inlineContent!.htmlBody, /onerror|customer\.email/)
  assert.equal(rendered, previewRequiredNoticeHtml(message))
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
