import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = path.join(root, "docs/customerio/personal-plan-result-artifact-template.html")
const output = path.join(root, "tmp/personal-plan-result-email-preview.html")

const trigger = {
  profile_line: "Für welliges, mittelstarkes Haar",
  comparison_image_url: "/public/images/emails/personal-plan-before-after.jpg",
  primary_message: {
    kind: "concern",
    label: "Frizz und viele abstehende Haare",
  },
  diagnostic_rows: [
    {
      title: "Oberfläche",
      today_label: "viel Potenzial",
      summary:
        "Dein Plan bringt Pflege und Styling in eine Reihenfolge, die Frizz und Reibung reduziert.",
    },
    {
      title: "Feuchtigkeit",
      today_label: "viel Potenzial",
      summary:
        "Dein Plan stimmt Pflegeintensität und Rhythmus auf geschmeidigere, ausgeglichenere Längen ab.",
    },
    {
      title: "Definition",
      today_label: "viel Potenzial",
      summary:
        "Dein Plan verbindet Pflege und Styling so, dass deine natürliche Struktur klarer zur Geltung kommt.",
    },
  ],
  plan_fit_statement:
    "Ein klarer Plan statt widersprüchlicher Tipps: Du bekommst eine feste Reihenfolge, die zu deinem Haar passt und im Alltag leicht nachvollziehbar bleibt.",
  cta_label: "Meinen Plan freischalten",
  result_url:
    "https://chaarlie.de/result/550e8400-e29b-41d4-a716-446655440000?entry=result_email#pricing",
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

let html = await readFile(source, "utf8")
html = html.replace(
  /\{% if trigger\.primary_message\.kind == "concern" %\}([\s\S]*?)\{% elsif trigger\.primary_message\.kind == "goal" %\}([\s\S]*?)\{% else %\}([\s\S]*?)\{% endif %\}/g,
  trigger.primary_message.kind === "concern" ? "$1" : trigger.primary_message.kind === "goal" ? "$2" : "$3",
)
html = html.replace(
  /\{% for row in trigger\.diagnostic_rows %\}([\s\S]*?)\{% endfor %\}/g,
  (_, block) =>
    trigger.diagnostic_rows
      .map((row) =>
        block.replace(
          /\{\{\s*row\.([a-z_]+)\s*\|\s*xml_escape\s*\}\}/g,
          (_match, key) => escapeXml(row[key]),
        ),
      )
      .join(""),
)
html = html.replace(
  /\{\{\s*trigger\.([a-z_]+)(?:\.([a-z_]+))?\s*\|\s*xml_escape\s*\}\}/g,
  (_match, first, second) => escapeXml(second ? trigger[first][second] : trigger[first]),
)

const document = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personal-plan result email</title></head>
<body style="margin:0;background:#f6f0f7">${html}
<div style="max-width:552px;margin:0 auto 30px;padding:0 24px;font:12px/1.5 Arial;color:#746b77;text-align:center">
Chaarlie · info@chaarlie.de<br>Haarmony LLC · Dover, DE, USA<br>
<a href="#">Abmelden</a> · <a href="https://chaarlie.de/impressum">Impressum</a> · <a href="https://chaarlie.de/datenschutz">Datenschutz</a>
</div></body></html>`

await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, document, "utf8")
console.log(path.relative(root, output))
