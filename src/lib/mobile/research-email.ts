import "server-only"
import { z } from "zod"
import {
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalEmailPayload,
} from "@/lib/customerio/transactional"

export const MOBILE_RESEARCH_MESSAGE_ID_ENV = "CUSTOMERIO_MOBILE_RESEARCH_TRANSACTIONAL_MESSAGE_ID"
const RESULT_ORIGIN = "https://chaarlie.de"
const SENDER = "Chaarlie <info@chaarlie.de>"

const HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7f5f2;color:#2a1845;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#fff;border:1px solid #e6e0da;border-radius:20px"><tr><td style="padding:32px 24px"><p style="font-family:Georgia,serif;font-size:28px;margin:0 0 36px">chaarlie</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2;font-weight:normal;margin:0 0 16px">Deine Einschätzung ist da.</h1><p style="font-size:16px;line-height:1.5;margin:0 0 28px">Dein Produkt ist bereit. Öffne die Einschätzung in der iPhone-App.</p><a href="{{ trigger.result_url | htmlencode }}" style="display:inline-block;background:#6b50a0;color:#fff;text-decoration:none;border-radius:12px;padding:14px 18px;font-weight:bold">Einschätzung öffnen</a><p style="font-size:13px;line-height:1.5;color:#68605b;margin:28px 0 0">Am Computer? Öffne diese E-Mail auf deinem iPhone.</p></td></tr></table><p style="font-size:12px;color:#68605b;margin:20px 0"><a href="https://chaarlie.de/impressum" style="color:#6b50a0">Impressum</a> · <a href="https://chaarlie.de/datenschutz" style="color:#6b50a0">Datenschutz</a></p></td></tr></table></body></html>`
const TEXT = `Deine Einschätzung ist da.\n\nDein Produkt ist bereit. Öffne die Einschätzung in der iPhone-App:\n{{ trigger.result_url }}\n\nAm Computer? Öffne diese E-Mail auf deinem iPhone.\n\nChaarlie · https://chaarlie.de/impressum · https://chaarlie.de/datenschutz`

export function mobileResearchMessageId(): string | number {
  const value = process.env[MOBILE_RESEARCH_MESSAGE_ID_ENV]?.trim()
  if (!value) throw new Error("Mobile research transactional message ID is not configured")
  return /^\d+$/.test(value) ? Number(value) : value
}

export function mobileResearchResultURL(submissionId: string, origin = "https://chaarlie.de") {
  if (!z.uuid().safeParse(submissionId).success || origin !== RESULT_ORIGIN)
    throw new Error("Invalid mobile research link")
  return new URL(`/app/research/${submissionId}`, RESULT_ORIGIN).toString()
}

export function buildMobileResearchEmail(input: {
  email: string
  submissionId: string
  messageId: string | number
}): CustomerIoTransactionalEmailPayload {
  const email = input.email.trim()
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (typeof input.messageId === "string" &&
      (!input.messageId.trim() || /[\r\n]/.test(input.messageId)))
  )
    throw new Error("Invalid mobile research email")
  return {
    to: email,
    transactionalMessageId: input.messageId,
    messageData: { result_url: mobileResearchResultURL(input.submissionId) },
    inlineContent: {
      from: SENDER,
      subject: "Dein Produkt ist bereit",
      htmlBody: HTML,
      textBody: TEXT,
      autoCreate: false,
      tracked: false,
    },
  }
}

export function sendMobileResearchEmail(input: Parameters<typeof buildMobileResearchEmail>[0]) {
  return sendCustomerIoTransactionalEmailWithReceipt(buildMobileResearchEmail(input))
}
