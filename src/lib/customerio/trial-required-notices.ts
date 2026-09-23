import "server-only"
import {
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalEmailPayload,
} from "@/lib/customerio/transactional"
import type { TrialRequiredNoticeMessage } from "@/lib/billing/trial-required-notices"
import {
  CONFIRMATION_HTML_PREFIX,
  CONFIRMATION_HTML_SUFFIX,
  renderConfirmationContent,
  renderConfirmationText,
} from "./contract-confirmation-html"
import { renderPaymentReceiptContent, renderPaymentReceiptText } from "./payment-receipt-html"
import { renderRequiredNoticeContent, renderRequiredNoticeText } from "./required-notice-html"
import { buildContractPdf, CONTRACT_PDF_FILENAME } from "./contract-pdf"
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
export async function buildRequiredNoticeEmail(input: {
  email: string
  messageId: string
  sender: string
  message: TrialRequiredNoticeMessage
}): Promise<CustomerIoTransactionalEmailPayload> {
  if (!input.sender.trim() || /[\r\n]/.test(input.sender) || /[\r\n]/.test(input.message.subject))
    throw new Error("Invalid required notice sender or subject")
  const attachments = input.message.confirmation
    ? {
        [CONTRACT_PDF_FILENAME]: Buffer.from(
          await buildContractPdf(input.message.receipt_text),
        ).toString("base64"),
      }
    : undefined
  return {
    ...(attachments ? { attachments } : {}),
    to: input.email,
    transactionalMessageId: input.messageId,
    messageData: {
      subject: input.message.subject,
      receipt_text: input.message.receipt_text,
      ...(input.message.confirmation
        ? {
            confirmation_html: renderConfirmationContent(input.message),
            confirmation_text: renderConfirmationText(input.message),
          }
        : {}),
      ...(input.message.paymentReceipt
        ? {
            payment_receipt_html: renderPaymentReceiptContent(input.message),
            payment_receipt_text: renderPaymentReceiptText(input.message),
          }
        : {}),
      ...(input.message.requiredNotice
        ? {
            required_notice_html: renderRequiredNoticeContent(input.message),
            required_notice_text: renderRequiredNoticeText(input.message),
          }
        : {}),
    },
    inlineContent: {
      from: input.sender,
      // Use Liquid only as a fixed template over message_data: user text in a
      // public declaration can contain Liquid tags and must not become template code.
      // Customer.io `escape` percent-encodes; `htmlencode` preserves readable text/URLs.
      subject: "{{ trigger.subject }}",
      htmlBody: input.message.confirmation
        ? CONFIRMATION_HTML_PREFIX + "{{ trigger.confirmation_html }}" + CONFIRMATION_HTML_SUFFIX
        : input.message.paymentReceipt
          ? CONFIRMATION_HTML_PREFIX +
            "{{ trigger.payment_receipt_html }}" +
            CONFIRMATION_HTML_SUFFIX
          : input.message.requiredNotice
            ? CONFIRMATION_HTML_PREFIX +
              "{{ trigger.required_notice_html }}" +
              CONFIRMATION_HTML_SUFFIX
            : REQUIRED_NOTICE_HTML_PREFIX +
              "{{ trigger.receipt_text | htmlencode }}" +
              REQUIRED_NOTICE_HTML_SUFFIX,
      textBody: input.message.confirmation
        ? "{{ trigger.confirmation_text }}"
        : input.message.paymentReceipt
          ? "{{ trigger.payment_receipt_text }}"
          : input.message.requiredNotice
            ? "{{ trigger.required_notice_text }}"
            : "{{ trigger.receipt_text }}",
      autoCreate: true,
      tracked: false,
    },
  }
}
/** Local HTML preview; provider-rendered delivery must also be checked. */
export function previewRequiredNoticeHtml(message: TrialRequiredNoticeMessage): string {
  if (message.confirmation)
    return CONFIRMATION_HTML_PREFIX + renderConfirmationContent(message) + CONFIRMATION_HTML_SUFFIX
  if (message.paymentReceipt)
    return (
      CONFIRMATION_HTML_PREFIX + renderPaymentReceiptContent(message) + CONFIRMATION_HTML_SUFFIX
    )
  if (message.requiredNotice)
    return (
      CONFIRMATION_HTML_PREFIX + renderRequiredNoticeContent(message) + CONFIRMATION_HTML_SUFFIX
    )
  return (
    REQUIRED_NOTICE_HTML_PREFIX + escapeHtml(message.receipt_text) + REQUIRED_NOTICE_HTML_SUFFIX
  )
}
/** Only wraps local preparation; provider failures retain their delivery classification. */
export class RequiredNoticePreparationError extends Error {
  constructor(cause: unknown) {
    super("Required notice preparation failed", { cause })
    this.name = "RequiredNoticePreparationError"
  }
}
export async function sendTrialRequiredNotice(input: {
  email: string
  messageId: string
  sender: string
  message: TrialRequiredNoticeMessage
}) {
  let payload: CustomerIoTransactionalEmailPayload
  try {
    payload = await buildRequiredNoticeEmail(input)
  } catch (error) {
    throw new RequiredNoticePreparationError(error)
  }
  return sendCustomerIoTransactionalEmailWithReceipt(payload, {
    timeoutMs: 10_000,
  })
}
