import type { TrialRequiredNoticeMessage } from "../billing/trial-required-notices"

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const action = (kind: "manage" | "cancel" | "contact") => {
  if (kind === "manage") return "https://chaarlie.de/profile"
  if (kind === "cancel") return "https://chaarlie.de/kuendigen"
  return "mailto:info@chaarlie.de"
}

export function renderRequiredNoticeContent(message: TrialRequiredNoticeMessage): string {
  const summary = message.requiredNotice
  if (!summary) throw new Error("Missing required notice summary")
  const facts = summary.facts
    .map(
      ({ label, value }, index) =>
        `<tr><td style="padding:14px 18px;${index === summary.facts.length - 1 ? "" : "border-bottom:1px solid #e8e1f0"}"><p style="margin:0 0 3px;font-size:12px;color:#655471">${escapeHtml(label)}</p><p style="margin:0;font-size:18px;font-weight:bold;line-height:1.5">${escapeHtml(value)}</p></td></tr>`,
    )
    .join("\n")
  const details = summary.details
    .map(
      ({ label, value }) =>
        `<p style="margin:8px 0;color:#655471;overflow-wrap:anywhere;word-break:break-word"><strong style="color:#2d1b46">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
    )
    .join("\n")
  const appendix = summary.appendReceiptTextLabel
    ? `<div style="margin-top:28px;border-top:1px solid #e8e1f0;padding-top:20px;font-size:13px;color:#655471">
<p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#2d1b46">${escapeHtml(summary.appendReceiptTextLabel)}</p>
<div style="white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(message.receipt_text)}</div>
</div>`
    : ""
  return `<p style="margin:0 0 28px;font-size:26px;font-weight:bold;letter-spacing:-1px">chaarlie</p>
<p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1.4px;color:#655471">${escapeHtml(summary.eyebrow.toLocaleUpperCase("de-DE"))}</p>
<h1 style="margin:0 0 12px;font-size:30px;line-height:1.2;letter-spacing:-.7px">${escapeHtml(summary.title)}</h1>
<p style="margin:0 0 24px;color:#655471">${escapeHtml(summary.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0f9;border-radius:10px">
${facts}
</table>
<p style="margin:14px 0 24px;border-left:3px solid #2d1b46;padding-left:14px;font-size:14px;color:#655471">${escapeHtml(summary.status)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2d1b46" style="border-radius:8px;text-align:center"><a href="${action(summary.primaryAction.kind)}" style="display:inline-block;padding:13px 22px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none">${escapeHtml(summary.primaryAction.label)}</a></td></tr></table>
${summary.secondaryAction ? `<p style="margin:16px 0 0;font-size:14px"><a href="${action(summary.secondaryAction.kind)}" style="color:#2d1b46;text-decoration:underline">${escapeHtml(summary.secondaryAction.label)}</a></p>` : ""}
<p style="margin:20px 0 30px;font-size:14px;color:#655471">Fragen? Antworte auf diese E-Mail oder schreibe an info@chaarlie.de.</p>
<div style="border-top:1px solid #e8e1f0;padding-top:20px;font-size:13px">
<p style="margin:0 0 10px;font-size:14px;font-weight:bold">${escapeHtml(summary.detailTitle)}</p>
${details}
</div>
${appendix}`
}

export function renderRequiredNoticeText(message: TrialRequiredNoticeMessage): string {
  const summary = message.requiredNotice
  if (!summary) throw new Error("Missing required notice summary")
  return [
    summary.title,
    summary.intro,
    "",
    ...summary.facts.map(({ label, value }) => `${label}: ${value}`),
    "",
    summary.status,
    "",
    `${summary.primaryAction.label}: ${action(summary.primaryAction.kind)}`,
    ...(summary.secondaryAction
      ? [`${summary.secondaryAction.label}: ${action(summary.secondaryAction.kind)}`]
      : []),
    "",
    "Fragen? Antworte auf diese E-Mail oder schreibe an info@chaarlie.de.",
    "",
    summary.detailTitle,
    ...summary.details.map(({ label, value }) => `${label}: ${value}`),
    ...(summary.appendReceiptTextLabel
      ? ["", summary.appendReceiptTextLabel, message.receipt_text]
      : []),
    "",
    "Chaarlie · Haarmony LLC",
    "Impressum: https://chaarlie.de/impressum",
    "Datenschutz: https://chaarlie.de/datenschutz",
  ].join("\n")
}
