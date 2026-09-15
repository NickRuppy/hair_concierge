import "server-only"

import type { TrialReminderMessage } from "@/lib/billing/trial-reminders"
import {
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalEmailPayload,
} from "@/lib/customerio/transactional"

export const TRIAL_REMINDER_MESSAGE_ID_ENV = "CUSTOMERIO_TRIAL_REMINDER_TRANSACTIONAL_MESSAGE_ID"
export const TRIAL_REMINDER_FROM_ENV = "CUSTOMERIO_TRIAL_REMINDER_FROM"
export const DEFAULT_TRIAL_REMINDER_TRIGGER = "chaarlie_trial_ending_reminder_v1"
// Verified existing sender in the Customer.io workspace draft.
export const DEFAULT_TRIAL_REMINDER_SENDER = "Chaarlie <info@chaarlie.de>"

// This is the saved Customer.io draft body. Values remain data, never Liquid
// source, and auto_create stays false so no new template can appear at send.
const TRIAL_REMINDER_INLINE_HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ trigger.subject | escape }}</title></head><body style="margin:0;background:#f7f4f9;font-family:Arial,sans-serif;color:#2d1b46"><div style="display:none;max-height:0;overflow:hidden">Dein Testende, der nächste Betrag und dein Kündigungslink auf einen Blick.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e5ddee;border-radius:20px"><tr><td style="padding:32px 24px"><p style="margin:0 0 32px;font-family:Georgia,serif;font-size:29px;font-weight:bold">chaarlie</p><p style="margin:0 0 10px;font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#705198">DEIN KOSTENLOSER TEST</p><h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:32px;line-height:1.15">Dein Test endet bald.</h1><p style="font-size:16px;line-height:1.6;margin:0 0 24px">Wie versprochen, erinnern wir dich vor deiner ersten Zahlung.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ebf8;border-radius:12px"><tr><td style="padding:20px"><p style="margin:0 0 6px;color:#59466e;font-size:13px">TESTENDE</p><p style="margin:0 0 20px;font-size:19px;font-weight:bold">{{ trigger.trial_end_date | escape }}</p><p style="margin:0 0 6px;color:#59466e;font-size:13px">ERSTE ZAHLUNG · {{ trigger.first_charge_date | escape }}</p><p style="margin:0;font-size:26px;font-weight:bold">{{ trigger.first_charge_amount | escape }}</p><p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#59466e">{{ trigger.plan_label | escape }} · Danach {{ trigger.renewal_amount | escape }} {{ trigger.billing_interval_label | escape }}.</p></td></tr></table><p style="font-size:16px;line-height:1.6;margin:24px 0">Nach dem Test beginnt dein gewählter Tarif automatisch, wenn du nicht vorher kündigst.</p><p style="margin:0 0 24px"><a href="{{ trigger.management_url | escape }}" style="display:block;padding:15px 12px;border-radius:10px;background:#6b4d97;color:#fff;text-align:center;text-decoration:none;font-weight:bold;font-size:16px">Mein Abo ansehen</a></p><p style="font-size:15px;line-height:1.6;margin:0">Du möchtest nicht weitermachen? <a href="{{ trigger.cancellation_url | escape }}" style="color:#513576;text-decoration:underline">Vor Testende kündigen</a> – dann beginnt kein bezahlter Zeitraum.</p><p style="font-size:14px;line-height:1.6;color:#59466e;margin:20px 0 0">Falls du inzwischen gekündigt hast, gilt deine Kündigungsbestätigung.</p><p style="font-size:14px;line-height:1.6;color:#59466e;margin:24px 0 0">Fragen? Antworte einfach auf diese E-Mail.</p></td></tr></table><p style="font-size:12px;line-height:1.8;color:#655471;max-width:520px">Chaarlie · Haarmony LLC<br>1111B S Governors Ave # 84075, Dover, DE 19904, USA</p></td></tr></table></body></html>`

const invalidHeader = (value: string) => !value.trim() || /[\r\n]/.test(value)

export function buildTrialReminderEmail(input: {
  email: string
  messageId: string | number
  sender: string
  message: TrialReminderMessage
}): CustomerIoTransactionalEmailPayload {
  if (
    invalidHeader(input.email) ||
    invalidHeader(input.sender) ||
    invalidHeader(input.message.subject) ||
    (typeof input.messageId === "string" && !input.messageId.trim())
  )
    throw new Error("Invalid trial reminder sender or subject")

  return {
    to: input.email,
    transactionalMessageId: input.messageId,
    messageData: input.message.messageData,
    inlineContent: {
      from: input.sender,
      subject: "{{ trigger.subject }}",
      htmlBody: TRIAL_REMINDER_INLINE_HTML,
      textBody: "{{ trigger.receipt_text }}",
      autoCreate: false,
      tracked: false,
    },
  }
}

export function sendTrialReminder(input: {
  email: string
  messageId: string | number
  sender: string
  message: TrialReminderMessage
}) {
  return sendCustomerIoTransactionalEmailWithReceipt(buildTrialReminderEmail(input), {
    timeoutMs: 10_000,
  })
}
