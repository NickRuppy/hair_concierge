import assert from "node:assert/strict"
import test from "node:test"
import { renderCustomerIoTriggerTemplate } from "./helpers/customerio-liquid"
import { buildTrialRequiredNoticeMessage } from "../src/lib/billing/trial-required-notices"
import {
  dispatchTrialRequiredNotices,
  type TrialNoticeClaim,
  type TrialNoticeOutcome,
} from "../src/lib/billing/trial-required-notices-delivery"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "../src/lib/customerio/transactional"
import { handleTrialRequiredNoticeReconcile } from "../src/app/api/billing/trial-required-notices/reconcile/route"
const snapshot = {
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
const claim: TrialNoticeClaim = {
  notice_id: snapshot.contractId,
  attempt_id: "22222222-2222-4222-8222-222222222222",
  user_id: "33333333-3333-4333-8333-333333333333",
  kind: "contract_confirmation",
  snapshot,
}
test("contract confirms actual accepted progression, Berlin deadline, cancellation and full withdrawal instruction", () => {
  const message = buildTrialRequiredNoticeMessage("contract_confirmation", snapshot)
  assert.match(message.receipt_text, /69,99/)
  assert.match(message.receipt_text, /99,99/)
  assert.match(message.receipt_text, /21\. September 2026 um 12:00:00 MESZ/)
  assert.match(message.receipt_text, /höchstens einem Monat/)
  assert.match(message.receipt_text, /zeitanteilig erstattet/)
  assert.match(message.receipt_text, /Muster-Widerrufsformular/)
  assert.match(message.receipt_text, /binnen 14 Tagen/)
  assert.match(message.receipt_text, /chaarlie.de\/kuendigen/)
  assert.doesNotMatch(message.receipt_text, /price_|coupon_|day.?5|Tag 5/i)
  assert.match(
    buildTrialRequiredNoticeMessage("contract_confirmation", {
      ...snapshot,
      firstAmountMinor: 9999,
    }).receipt_text,
    /erste bezahlte Jahr werden 99,99/,
  )
  assert.throws(
    () =>
      buildTrialRequiredNoticeMessage("contract_confirmation", {
        ...snapshot,
        trialEndAt: "2026-09-22T10:00:00Z",
      }),
    /Invalid/,
  )
})
test("cancel receipt acknowledges declaration even when provider operation is pending; never needs provider success", () => {
  const m = buildTrialRequiredNoticeMessage("cancellation_receipt", {
    ...snapshot,
    declarationId: claim.attempt_id,
    submittedAt: "2026-09-15T09:00:00Z",
    effectiveEndAt: snapshot.trialEndAt,
  })
  assert.match(m.receipt_text, /Eingegangen am: 15\. September/)
  assert.match(m.receipt_text, /technische Bearbeitung beim Zahlungsanbieter noch läuft/)
  assert.match(m.receipt_text, /21\. September/)
})
test("paid receipt rejects zero/mismatched amounts and uses late-success time; annual is never a monthly reminder", () => {
  const paid = {
    ...snapshot,
    paymentEventId: claim.attempt_id,
    phase: "first_paid",
    occurredAt: "2026-09-24T10:00:00Z",
    paidThroughAt: "2027-09-24T10:00:00Z",
    amountMinor: 6999,
  }
  assert.match(
    buildTrialRequiredNoticeMessage("payment_receipt", paid).receipt_text,
    /24\. September 2026/,
  )
  assert.throws(
    () => buildTrialRequiredNoticeMessage("payment_receipt", { ...paid, amountMinor: 0 }),
    /Invalid/,
  )
  assert.throws(
    () =>
      buildTrialRequiredNoticeMessage("annual_renewal", {
        ...snapshot,
        interval: "month",
        firstAmountMinor: 999,
        renewalAmountMinor: 999,
        amountMinor: 999,
        renewalAt: "2027-09-24T10:00:00Z",
      }),
    /Invalid/,
  )
})
test("missing configuration claims nothing; verified owner alone chooses recipient; queue ACK is not delivered", async () => {
  let claims = 0
  const outcomes: TrialNoticeOutcome[] = []
  const deps = {
    messageId: "required",
    apiKeyPresent: true,
    sender: "Chaarlie <info@chaarlie.de>",
    enqueueAnnual: async () => {},
    claim: async () => {
      claims++
      return [claim]
    },
    recipient: async (id: string) => {
      assert.equal(id, claim.user_id)
      return "verified@example.test"
    },
    send: async (input: { email: string }) => {
      assert.equal(input.email, "verified@example.test")
      return { deliveryId: "d1", queuedAt: 1789394400 }
    },
    settle: async (_c: TrialNoticeClaim, o: TrialNoticeOutcome) => {
      outcomes.push(o)
    },
  }
  assert.equal(
    (await dispatchTrialRequiredNotices({ ...deps, messageId: undefined })).blocked,
    true,
  )
  assert.equal(claims, 0)
  assert.deepEqual(await dispatchTrialRequiredNotices(deps), {
    claimed: 1,
    queued: 1,
    supportRequired: 0,
    blocked: false,
  })
  assert.equal(outcomes[0]!.status, "queued")
})
test("ambiguous/HTTP/error sends park once; settlement failure never retries provider", async () => {
  for (const error of [
    new CustomerIoAmbiguousDeliveryError("timeout"),
    new CustomerIoHttpError(503),
    new Error("network"),
  ]) {
    let sends = 0
    const outcomes: TrialNoticeOutcome[] = []
    const result = await dispatchTrialRequiredNotices({
      messageId: "required",
      apiKeyPresent: true,
      sender: "Chaarlie <info@chaarlie.de>",
      enqueueAnnual: async () => {},
      claim: async () => [claim],
      recipient: async () => "x@example.test",
      send: async () => {
        sends++
        throw error
      },
      settle: async (_c, o) => {
        outcomes.push(o)
      },
    })
    assert.equal(result.supportRequired, 1)
    assert.equal(sends, 1)
    assert.equal(outcomes[0]!.status, "support_required")
  }
  let sends = 0
  await assert.rejects(
    dispatchTrialRequiredNotices({
      messageId: "required",
      apiKeyPresent: true,
      sender: "Chaarlie <info@chaarlie.de>",
      enqueueAnnual: async () => {},
      claim: async () => [claim],
      recipient: async () => "x@example.test",
      send: async () => {
        sends++
        return { deliveryId: "d1", queuedAt: 1789394400 }
      },
      settle: async () => {
        throw new Error("db offline")
      },
    }),
    /db offline/,
  )
  assert.equal(sends, 1)
})
test("missing verified recipient and malformed snapshot send nothing", async () => {
  for (const input of [{ ...claim, snapshot: {} }, claim]) {
    let sends = 0
    const result = await dispatchTrialRequiredNotices({
      messageId: "required",
      apiKeyPresent: true,
      sender: "Chaarlie <info@chaarlie.de>",
      enqueueAnnual: async () => {},
      claim: async () => [input],
      recipient: async () => null,
      send: async () => {
        sends++
        return { deliveryId: "d", queuedAt: 0 }
      },
      settle: async () => {},
    })
    assert.equal(result.supportRequired, 1)
    assert.equal(sends, 0)
  }
})
test("cron refuses unauthenticated requests and exposes only aggregate failure/config status", async () => {
  let calls = 0
  const dispatch = async () => {
    calls++
    return { claimed: 0, queued: 0, supportRequired: 0, blocked: true }
  }
  assert.equal(
    (
      await handleTrialRequiredNoticeReconcile(new Request("https://example.test"), {
        cronSecret: "secret",
        dispatch,
      })
    ).status,
    401,
  )
  assert.equal(calls, 0)
  assert.equal(
    (
      await handleTrialRequiredNoticeReconcile(
        new Request("https://example.test", { headers: { authorization: "Bearer secret" } }),
        { cronSecret: "secret", dispatch },
      )
    ).status,
    503,
  )
})

test("inline required notice keeps arbitrary declaration content as escaped data, with no open or click tracking", async () => {
  const { buildRequiredNoticeEmail, previewRequiredNoticeHtml } =
    await import("../src/lib/customerio/trial-required-notices")
  const message = {
    subject: "Bestätigung",
    receipt_text:
      'Kündigung bestätigt: 69,99 €\nhttps://chaarlie.de/kuendigen\n<img src=x onerror=alert(1)> {{ customer.email }} & "Text"',
  }
  const payload = buildRequiredNoticeEmail({
    email: "owner@example.test",
    messageId: "required_v1",
    sender: "Chaarlie <info@chaarlie.de>",
    message,
  })
  assert.equal(payload.inlineContent?.subject, "{{ trigger.subject }}")
  const rendered = renderCustomerIoTriggerTemplate(
    payload.inlineContent!.htmlBody,
    payload.messageData,
  )
  assert.match(rendered, /Kündigung bestätigt: 69,99 €\nhttps:\/\/chaarlie.de\/kuendigen/)
  assert.match(rendered, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.match(rendered, /\{\{ customer.email \}\} &amp; &quot;Text&quot;/)
  assert.doesNotMatch(rendered, /<img|%20|%0A|%C3/)
  assert.match(rendered, /style="margin:0;background:#fff"/)
  assert.match(rendered, /max-width:560px/)
  assert.match(
    rendered,
    /font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#2d1b46;white-space:pre-wrap;overflow-wrap:anywhere/,
  )
  assert.match(rendered, /href="\{% unsubscribe_url %\}" class="untracked"/)
  assert.match(rendered, /Abmelden.*Impressum.*Datenschutz/)
  assert.equal((rendered.match(/<html/g) ?? []).length, 1)
  assert.equal((rendered.match(/<body/g) ?? []).length, 1)
  assert.equal(rendered, previewRequiredNoticeHtml(message))
  assert.doesNotMatch(payload.inlineContent!.htmlBody, /onerror|customer.email/)
  assert.equal(payload.messageData.receipt_text, message.receipt_text)
  assert.equal(payload.inlineContent?.tracked, false)
  assert.equal(payload.inlineContent?.autoCreate, true)
  assert.match(previewRequiredNoticeHtml(message), /&lt;img/)
  assert.doesNotMatch(previewRequiredNoticeHtml(message), /<img/)
})

test("committed change confirmation names original deadline and does not restore a canceled switch", () => {
  const changed = {
    ...snapshot,
    operationId: claim.attempt_id,
    revision: 1,
    changeKind: "switch",
    committedAt: "2026-09-15T10:00:00Z",
    cancelAtPeriodEnd: true,
  }
  const m = buildTrialRequiredNoticeMessage("contract_change", changed)
  assert.match(m.receipt_text, /kein neuer Test/)
  assert.match(m.receipt_text, /Deine Kündigung bleibt wirksam/)
  assert.doesNotMatch(m.receipt_text, /Die erste Zahlung ist zu diesem Zeitpunkt vorgesehen/)
  assert.match(m.receipt_text, /21\. September 2026/)
  const restored = buildTrialRequiredNoticeMessage("contract_change", {
    ...changed,
    changeKind: "restore",
    cancelAtPeriodEnd: false,
  })
  assert.match(restored.receipt_text, /Kündigung wurde auf deinen Wunsch aufgehoben/)
})

test("paid cancellation receipt preserves paid access and pending provider work without trial-only promises", () => {
  const paid = {
    ...snapshot,
    declarationId: claim.attempt_id,
    submittedAt: "2026-10-01T10:00:00Z",
    effectiveEndAt: "2027-09-21T10:00:00Z",
    paidThroughAt: "2027-09-21T10:00:00Z",
    providerStatus: "pending",
  }
  const message = buildTrialRequiredNoticeMessage("paid_cancellation_receipt", paid)
  assert.match(message.receipt_text, /bereits bezahlter Zugang/)
  assert.match(message.receipt_text, /technische Bearbeitung beim Zahlungsanbieter läuft noch/)
  assert.doesNotMatch(
    message.receipt_text,
    /danach beginnt kein kostenpflichtiger Zeitraum|Testzugang/,
  )
  assert.throws(
    () =>
      buildTrialRequiredNoticeMessage("paid_cancellation_receipt", {
        ...paid,
        effectiveEndAt: snapshot.trialEndAt,
      }),
    /Invalid/,
  )
})

test("PayPal contract confirmation states the day-after first-charge date instead of the trial-end moment", () => {
  const message = buildTrialRequiredNoticeMessage("contract_confirmation", {
    ...snapshot,
    provider: "paypal",
  })
  // trialEndAt 2026-09-21T10:00:00Z → collection starts 2026-09-22T00:00Z → Berlin date 22.09.
  assert.match(message.receipt_text, /Die erste Zahlung ist für den 22\. September 2026 vorgesehen/)
  assert.doesNotMatch(message.receipt_text, /zu diesem Zeitpunkt/)
  assert.match(message.receipt_text, /21\. September 2026 um 12:00:00 MESZ/)
})

test("Stripe contract confirmation keeps the exact-moment first-charge statement", () => {
  const message = buildTrialRequiredNoticeMessage("contract_confirmation", snapshot)
  assert.match(message.receipt_text, /Die erste Zahlung ist zu diesem Zeitpunkt vorgesehen/)
})

test("PayPal contract confirmation with a frozen midnight trial end names one date for trial end and first charge", () => {
  const message = buildTrialRequiredNoticeMessage("contract_confirmation", {
    ...snapshot,
    provider: "paypal",
    // Frozen end: next UTC midnight after freeze + 8 days (8.6 days after this authorization).
    trialEndAt: "2026-09-23T00:00:00Z",
  })
  assert.match(
    message.receipt_text,
    /dauert mindestens 7 Tage und endet am 23\. September 2026 um 02:00:00 MESZ/,
  )
  assert.match(message.receipt_text, /Die erste Zahlung ist für den 23\. September 2026 vorgesehen/)
  // Ten days is the upper bound; Stripe keeps the exact seven-day contract.
  assert.throws(
    () =>
      buildTrialRequiredNoticeMessage("contract_confirmation", {
        ...snapshot,
        provider: "paypal",
        trialEndAt: "2026-09-24T10:00:01Z",
      }),
    /Invalid/,
  )
})
