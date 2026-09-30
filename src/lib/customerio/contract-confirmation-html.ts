import type { TrialRequiredNoticeMessage } from "../billing/trial-required-notices"

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

export const CONFIRMATION_HTML_PREFIX =
  '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7f5fa"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px"><tr><td style="padding:28px 24px;font-family:Arial,sans-serif;color:#2d1b46;font-size:16px;line-height:1.6;overflow-wrap:anywhere">'
export const CONFIRMATION_HTML_SUFFIX =
  '</td></tr><tr><td align="center" style="padding:0 24px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:#655471"><p>Chaarlie · Haarmony LLC</p><p><a href="{% unsubscribe_url %}" class="untracked" style="color:#655471">Abmelden</a> · <a href="https://chaarlie.de/impressum" style="color:#655471">Impressum</a> · <a href="https://chaarlie.de/datenschutz" style="color:#655471">Datenschutz</a></p></td></tr></table></td></tr></table></body></html>'

// Text is escaped before becoming markup and inserted as Liquid data, never source.
// Complete frozen contract text is delivered separately in the mandatory PDF.
export function renderConfirmationContent(message: TrialRequiredNoticeMessage): string {
  const summary = message.confirmation
  if (!summary) throw new Error("Missing confirmation summary")
  const fact = (label: string, value: string) =>
    `<tr><td style="padding:14px 18px;border-bottom:1px solid #e8e1f0"><p style="margin:0 0 3px;font-size:12px;color:#655471">${escapeHtml(label)}</p><p style="margin:0;font-size:18px;font-weight:bold;line-height:1.5">${escapeHtml(value)}</p></td></tr>`
  return `<p style="margin:0 0 28px;font-size:26px;font-weight:bold;letter-spacing:-1px">chaarlie</p>
<p style="margin:0 0 8px;font-size:12px;letter-spacing:1.4px;color:#655471">DEINE TESTBESTÄTIGUNG</p>
<h1 style="margin:0 0 12px;font-size:30px;line-height:1.2;letter-spacing:-.7px">Dein Chaarlie-Test ist bestätigt.</h1>
<p style="margin:0 0 24px;color:#655471">Hier findest du die wichtigsten Infos zu deiner ${escapeHtml(summary.plan)} auf einen Blick.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0f9;border-radius:10px">
${fact("Heute bezahlt", "0,00 €")}
${fact("Kostenlos testen bis", summary.trialEnd)}
${summary.canceled ? fact("Deine Kündigung ist berücksichtigt", "Es beginnt kein bezahlter Zeitraum.") : fact(`Erste Zahlung am ${summary.firstCharge}`, summary.price)}
</table>
${
  !summary.canceled
    ? `<p style="margin:12px 0 0;font-size:14px">${summary.renewal ? `${escapeHtml(summary.renewal)} ` : ""}Alle Preise inkl. anwendbarer Steuern.</p>
<p style="margin:12px 0 24px;font-size:14px;color:#655471">Die Zahlung ist vorgesehen, sofern du nicht vorher kündigst.</p>`
    : '<p style="margin:12px 0 24px;font-size:14px;color:#655471">Dein Zugang bleibt bis zum Testende bestehen. Du musst nicht erneut kündigen.</p>'
}
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2d1b46" style="border-radius:8px;text-align:center"><a href="https://chaarlie.de/profile" style="display:inline-block;padding:13px 22px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none">Mitgliedschaft verwalten</a></td></tr></table>
${!summary.canceled ? '<p style="margin:16px 0 0;font-size:14px"><a href="https://chaarlie.de/kuendigen" style="color:#2d1b46;text-decoration:underline">Test kündigen</a> · Bis zum Testende kündigen, dann entstehen keine Kosten.</p>' : ""}
<p style="margin:20px 0 32px;font-size:14px;color:#655471">Fragen? Antworte einfach auf diese E-Mail.</p>
<p style="margin:0;border-top:1px solid #e8e1f0;padding-top:20px;font-size:14px;color:#655471">Deine vollständigen Vertragsunterlagen mit AGB und Widerrufsbelehrung findest du im PDF-Anhang. Bitte bewahre ihn auf.</p>`
}

export function renderConfirmationText(message: TrialRequiredNoticeMessage): string {
  const summary = message.confirmation
  if (!summary) throw new Error("Missing confirmation summary")
  return [
    "Dein Chaarlie-Test ist bestätigt.",
    summary.plan,
    "Heute bezahlt: 0,00 €",
    `Kostenlos testen bis: ${summary.trialEnd}`,
    ...(summary.canceled
      ? [
          "Deine Kündigung ist berücksichtigt. Es beginnt kein bezahlter Zeitraum.",
          "Dein Zugang bleibt bis zum Testende bestehen. Du musst nicht erneut kündigen.",
        ]
      : [
          `Erste Zahlung am ${summary.firstCharge}: ${summary.price}`,
          ...(summary.renewal ? [summary.renewal] : []),
          "Alle Preise inkl. anwendbarer Steuern.",
          "Die Zahlung ist vorgesehen, sofern du nicht vorher kündigst.",
        ]),
    "",
    "Mitgliedschaft verwalten: https://chaarlie.de/profile",
    ...(!summary.canceled
      ? [
          "Test kündigen: https://chaarlie.de/kuendigen",
          "Bis zum Testende kündigen, dann entstehen keine Kosten.",
        ]
      : []),
    "",
    "Fragen? Antworte einfach auf diese E-Mail.",
    "",
    "Deine vollständigen Vertragsunterlagen mit AGB und Widerrufsbelehrung findest du im PDF-Anhang. Bitte bewahre ihn auf.",
    "",
    "Chaarlie · Haarmony LLC",
    "Impressum: https://chaarlie.de/impressum",
    "Datenschutz: https://chaarlie.de/datenschutz",
  ].join("\n")
}
