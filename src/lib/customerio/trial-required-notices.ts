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

const REQUIRED_NOTICE_HTML_PREFIX =
  '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px"><tr><td style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#2d1b46;white-space:pre-wrap;overflow-wrap:anywhere">'
const REQUIRED_NOTICE_HTML_SUFFIX =
  '</td></tr><tr><td align="center" style="padding:20px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:#655471"><p style="margin:0"><a href="{% unsubscribe_url %}" class="untracked" style="color:#655471">Abmelden</a> · <a href="https://chaarlie.de/impressum" style="color:#655471">Impressum</a> · <a href="https://chaarlie.de/datenschutz" style="color:#655471">Datenschutz</a></p></td></tr></table></td></tr></table></body></html>'
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
      // Customer.io `escape` percent-encodes; `htmlencode` preserves readable text/URLs.
      subject: "{{ trigger.subject }}",
      htmlBody:
        REQUIRED_NOTICE_HTML_PREFIX +
        "{{ trigger.receipt_text | htmlencode }}" +
        REQUIRED_NOTICE_HTML_SUFFIX,
      textBody: "{{ trigger.receipt_text }}",
      autoCreate: true,
      tracked: false,
    },
  }
}
/** Local HTML preview; provider-rendered delivery must also be checked. */
export function previewRequiredNoticeHtml(message: TrialRequiredNoticeMessage): string {
  return (
    REQUIRED_NOTICE_HTML_PREFIX + escapeHtml(message.receipt_text) + REQUIRED_NOTICE_HTML_SUFFIX
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
