import {
  parseTrialRequiredNoticeSnapshot,
  type TrialRequiredNoticeSnapshot,
} from "./trial-required-notices"

export type TrialReminderMessageData = Readonly<{
  subject: string
  receipt_text: string
  trial_end_date: string
  first_charge_date: string
  first_charge_amount: string
  plan_label: string
  renewal_amount: string
  billing_interval_label: string
  management_url: "https://chaarlie.de/profile"
  cancellation_url: "https://chaarlie.de/kuendigen"
}>

export type TrialReminderMessage = Readonly<{
  subject: string
  receipt_text: string
  htmlBody: string
  messageData: TrialReminderMessageData
}>

const MANAGEMENT_URL = "https://chaarlie.de/profile" as const
const CANCELLATION_URL = "https://chaarlie.de/kuendigen" as const

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const date = (value: string) => {
  const formatted = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value))
  const timeZone = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    timeZoneName: "short",
  })
    .formatToParts(new Date(value))
    .find((part) => part.type === "timeZoneName")?.value
  const withUhr = formatted.replace(/( um \d{2}:\d{2})$/, "$1 Uhr")
  return timeZone ? `${withUhr} ${timeZone}` : withUhr
}

const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(value))

const money = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value / 100)

const trialPlan = (snapshot: TrialRequiredNoticeSnapshot) =>
  snapshot.interval === "year"
    ? { label: "Jahresmitgliedschaft", intervalLabel: "jährlich" }
    : { label: "Monatsmitgliedschaft", intervalLabel: "monatlich" }

function renderHtml(data: TrialReminderMessageData): string {
  const v = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, escapeHtml(value)]),
  ) as Record<keyof TrialReminderMessageData, string>

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${v.subject}</title></head><body style="margin:0;background:#f7f4f9;font-family:Arial,sans-serif;color:#2d1b46"><div style="display:none;max-height:0;overflow:hidden">Dein Testende, der nächste Betrag und dein Kündigungslink auf einen Blick.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f9"><tr><td align="center" style="padding:28px 16px;font-family:Arial,sans-serif;color:#2d1b46"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border:1px solid #e5ddee;border-radius:20px"><tr><td style="padding:32px 24px;font-family:Arial,sans-serif;color:#2d1b46"><p style="margin:0 0 32px;font-family:Georgia,serif;font-size:29px;font-weight:bold">chaarlie</p><p style="margin:0 0 10px;font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#705198">DEIN KOSTENLOSER TEST</p><h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:32px;line-height:1.15">Dein Test endet bald.</h1><p style="font-size:16px;line-height:1.6;margin:0 0 24px">Wie versprochen, erinnern wir dich vor deiner ersten Zahlung.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ebf8;border-radius:12px"><tr><td style="padding:20px;font-family:Arial,sans-serif;color:#2d1b46"><p style="margin:0 0 6px;color:#59466e;font-size:13px">TESTENDE</p><p style="margin:0 0 20px;font-size:19px;font-weight:bold">${v.trial_end_date}</p><p style="margin:0 0 6px;color:#59466e;font-size:13px">ERSTE ZAHLUNG · ${v.first_charge_date}</p><p style="margin:0;font-size:26px;font-weight:bold">${v.first_charge_amount}</p><p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#59466e">${v.plan_label} · Danach ${v.renewal_amount} ${v.billing_interval_label}.</p></td></tr></table><p style="font-size:16px;line-height:1.6;margin:24px 0">Nach dem Test beginnt dein gewählter Tarif automatisch, wenn du nicht vorher kündigst.</p><p style="margin:0 0 24px"><a href="${v.management_url}" style="display:block;padding:15px 12px;border-radius:10px;background:#6b4d97;color:#fff;text-align:center;text-decoration:none;font-weight:bold;font-size:16px">Mein Abo ansehen</a></p><p style="font-size:15px;line-height:1.6;margin:0">Du möchtest nicht weitermachen? <a href="${v.cancellation_url}" style="color:#513576;text-decoration:underline">Vor Testende kündigen</a> – dann beginnt kein bezahlter Zeitraum.</p><p style="font-size:14px;line-height:1.6;color:#59466e;margin:20px 0 0">Falls du inzwischen gekündigt hast, gilt deine Kündigungsbestätigung.</p><p style="font-size:14px;line-height:1.6;color:#59466e;margin:24px 0 0">Fragen? Antworte einfach auf diese E-Mail.</p></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px"><tr><td align="center" style="padding:20px 0 0;font-family:Arial,sans-serif;color:#655471;font-size:12px;line-height:1.8"><p style="margin:0">Chaarlie · Haarmony LLC<br>1111B S Governors Ave # 84075, Dover, DE 19904, USA</p><p style="margin:12px 0 0"><a href="{% unsubscribe_url %}" class="untracked" style="color:#655471">Abmelden</a> · <a href="https://chaarlie.de/impressum" style="color:#655471">Impressum</a> · <a href="https://chaarlie.de/datenschutz" style="color:#655471">Datenschutz</a></p></td></tr></table></td></tr></table></body></html>`
}

/**
 * Renders the optional day-five reminder from the same immutable, accepted
 * seven-day trial terms used for contract confirmation. It deliberately has
 * no price defaults: a stale or malformed contract must never become email.
 */
export function buildTrialReminderMessage(value: unknown): TrialReminderMessage {
  const snapshot = parseTrialRequiredNoticeSnapshot(value, "contract_confirmation")
  if (!snapshot) throw new Error("Invalid trial reminder snapshot")

  const plan = trialPlan(snapshot)
  const trialEndDate = date(snapshot.trialEndAt)
  const firstChargeDate = dateOnly(snapshot.trialEndAt)
  const firstAmount = money(snapshot.firstAmountMinor)
  const renewalAmount = money(snapshot.renewalAmountMinor)
  const subject = `Dein kostenloser Test endet am ${firstChargeDate}`
  const receiptText = `Dein kostenloser Test endet bald.\n\nWie versprochen, erinnern wir dich vor deiner ersten Zahlung.\n\nTestende: ${trialEndDate}\nErste Zahlung: ${firstAmount} am ${firstChargeDate}\n${plan.label}: danach ${renewalAmount} ${plan.intervalLabel}.\n\nNach dem Test beginnt dein gewählter Tarif automatisch, wenn du nicht vorher kündigst.\n\nMein Abo ansehen: ${MANAGEMENT_URL}\n\nDu möchtest nicht weitermachen? Vor Testende kündigen: ${CANCELLATION_URL}\nDann beginnt kein bezahlter Zeitraum.\n\nFalls du inzwischen gekündigt hast, gilt deine Kündigungsbestätigung.\n\nFragen? Antworte einfach auf diese E-Mail.\n\nChaarlie · Haarmony LLC\n1111B S Governors Ave # 84075, Dover, DE 19904, USA`
  const messageData: TrialReminderMessageData = {
    subject,
    receipt_text: receiptText,
    trial_end_date: trialEndDate,
    first_charge_date: firstChargeDate,
    first_charge_amount: firstAmount,
    plan_label: plan.label,
    renewal_amount: renewalAmount,
    billing_interval_label: plan.intervalLabel,
    management_url: MANAGEMENT_URL,
    cancellation_url: CANCELLATION_URL,
  }

  return { subject, receipt_text: receiptText, htmlBody: renderHtml(messageData), messageData }
}
