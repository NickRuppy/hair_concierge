import "server-only"
import {
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalEmailPayload,
} from "@/lib/customerio/transactional"
import type { TrialRequiredNoticeMessage } from "@/lib/billing/trial-required-notices"
export const TRIAL_REQUIRED_NOTICE_MESSAGE_ID_ENV =
  "CUSTOMERIO_TRIAL_REQUIRED_NOTICE_TRANSACTIONAL_MESSAGE_ID"
export const REQUIRED_NOTICE_FROM_ENV = "CUSTOMERIO_REQUIRED_NOTICE_FROM"
// Verified existing sender: live workspace 219516 transactional message 14.
export const DEFAULT_REQUIRED_NOTICE_SENDER = "Chaarlie <info@chaarlie.de>"
export const DEFAULT_REQUIRED_NOTICE_TRIGGER = "chaarlie_required_contract_notice_v1"
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
export function buildRequiredNoticeEmail(input: {
  email: string
  messageId: string
  sender: string
  message: TrialRequiredNoticeMessage
}): CustomerIoTransactionalEmailPayload {
  if (!input.sender.trim() || /[\r\n]/.test(input.sender) || /[\r\n]/.test(input.message.subject))
    throw new Error("Invalid required notice sender or subject")
  return {
    to: input.email,
    transactionalMessageId: input.messageId,
    messageData: { subject: input.message.subject, receipt_text: input.message.receipt_text },
    inlineContent: {
      from: input.sender,
      // Use Liquid only as a fixed template over message_data: user text in a
      // public declaration can contain Liquid tags and must not become template code.
      subject: "{{ trigger.subject }}",
      htmlBody:
        '<!doctype html><html lang="de"><meta charset="utf-8"><body><div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere">{{ trigger.receipt_text | escape }}</div></body></html>',
      textBody: "{{ trigger.receipt_text }}",
      autoCreate: true,
      tracked: false,
    },
  }
}
/** Local preview helper; matches the escaped Liquid body and never sends. */
export function previewRequiredNoticeHtml(message: TrialRequiredNoticeMessage): string {
  return (
    '<!doctype html><html lang="de"><meta charset="utf-8"><body><div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere">' +
    escapeHtml(message.receipt_text) +
    "</div></body></html>"
  )
}
export function sendTrialRequiredNotice(input: {
  email: string
  messageId: string
  sender: string
  message: TrialRequiredNoticeMessage
}) {
  return sendCustomerIoTransactionalEmailWithReceipt(buildRequiredNoticeEmail(input), {
    timeoutMs: 10_000,
  })
}
