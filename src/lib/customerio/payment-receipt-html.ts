import type { TrialRequiredNoticeMessage } from "../billing/trial-required-notices"

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const fact = (label: string, value: string, last = false) =>
  `<tr><td style="padding:14px 18px;${last ? "" : "border-bottom:1px solid #e8e1f0"}"><p style="margin:0 0 3px;font-size:12px;color:#655471">${escapeHtml(label)}</p><p style="margin:0;font-size:18px;font-weight:bold;line-height:1.5">${escapeHtml(value)}</p></td></tr>`

const detail = (label: string, value: string) =>
  `<p style="margin:8px 0"><span style="color:#655471">${escapeHtml(label)}</span><br><span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.45;color:#655471;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</span></p>`

export function renderPaymentReceiptContent(message: TrialRequiredNoticeMessage): string {
  const summary = message.paymentReceipt
  if (!summary) throw new Error("Missing payment receipt summary")
  const firstPaid = summary.phase === "first_paid"
  return `<p style="margin:0 0 28px;font-size:26px;font-weight:bold;letter-spacing:-1px">chaarlie</p>
<p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1.4px;color:#655471">ZAHLUNG BESTÄTIGT</p>
<h1 style="margin:0 0 12px;font-size:30px;line-height:1.2;letter-spacing:-.7px">${firstPaid ? "Deine Mitgliedschaft ist jetzt aktiv." : "Deine Mitgliedschaft läuft weiter."}</h1>
<p style="margin:0 0 24px;color:#655471">${firstPaid ? "Dein kostenloser Test ist abgeschlossen. Deine Zahlung war erfolgreich und dein bezahlter Chaarlie-Zugang ist jetzt aktiv." : "Deine Zahlung war erfolgreich. Deine Chaarlie-Mitgliedschaft läuft weiter."}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0f9;border-radius:10px">
${fact("Bezahlt", summary.amount)}
${fact("Zahlungsdatum", summary.paidOn)}
${fact("Bezahlter Zugang bis", summary.paidThroughOn, true)}
</table>
<p style="margin:12px 0 24px;font-size:14px;color:#655471">${escapeHtml(summary.plan)} · bezahlt über ${escapeHtml(summary.provider)} · Gesamtpreis inkl. anwendbarer Steuern</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2d1b46" style="border-radius:8px;text-align:center"><a href="https://chaarlie.de/profile" style="display:inline-block;padding:13px 22px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none">Mitgliedschaft verwalten</a></td></tr></table>
<p style="margin:16px 0 0;font-size:14px"><a href="https://chaarlie.de/kuendigen" style="color:#2d1b46;text-decoration:underline">Online kündigen</a></p>
<p style="margin:20px 0 30px;font-size:14px;color:#655471">Fragen? Antworte einfach auf diese E-Mail.</p>
<div style="border-top:1px solid #e8e1f0;padding-top:20px;font-size:13px">
<p style="margin:0 0 10px;font-size:14px;font-weight:bold">Belegdetails</p>
${detail("Zahlung gebucht", summary.paidAt)}
${detail("Zugang bezahlt bis", summary.paidThrough)}
${detail("Vertragskennung", summary.contractId)}
${detail("Zahlungskennung", summary.paymentId)}
</div>`
}

export function renderPaymentReceiptText(message: TrialRequiredNoticeMessage): string {
  const summary = message.paymentReceipt
  if (!summary) throw new Error("Missing payment receipt summary")
  const firstPaid = summary.phase === "first_paid"
  return [
    firstPaid ? "Deine Mitgliedschaft ist jetzt aktiv." : "Deine Mitgliedschaft läuft weiter.",
    firstPaid
      ? "Dein kostenloser Test ist abgeschlossen. Deine Zahlung war erfolgreich und dein bezahlter Chaarlie-Zugang ist jetzt aktiv."
      : "Deine Zahlung war erfolgreich. Deine Chaarlie-Mitgliedschaft läuft weiter.",
    "",
    summary.plan,
    `Bezahlt: ${summary.amount}`,
    `Zahlungsdatum: ${summary.paidOn}`,
    `Bezahlter Zugang bis: ${summary.paidThroughOn}`,
    `Bezahlt über: ${summary.provider}`,
    "Gesamtpreis inkl. anwendbarer Steuern.",
    "",
    "Mitgliedschaft verwalten: https://chaarlie.de/profile",
    "Online kündigen: https://chaarlie.de/kuendigen",
    "",
    "Fragen? Antworte einfach auf diese E-Mail.",
    "",
    "Belegdetails",
    `Zahlung gebucht: ${summary.paidAt}`,
    `Zugang bezahlt bis: ${summary.paidThrough}`,
    `Vertragskennung: ${summary.contractId}`,
    `Zahlungskennung: ${summary.paymentId}`,
    "",
    "Chaarlie · Haarmony LLC",
    "Impressum: https://chaarlie.de/impressum",
    "Datenschutz: https://chaarlie.de/datenschutz",
  ].join("\n")
}
