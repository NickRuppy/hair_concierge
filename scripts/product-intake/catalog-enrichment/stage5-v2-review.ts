import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  stage5V2ApplicationArtifactSchema,
  stage5V2ArtifactFingerprint,
} from "../../../src/lib/product-intake/catalog-enrichment/stage5-v2-application"

const defaultArtifactPath = resolve(
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
)
const defaultOutputPath = resolve("plans/receipts/2026-08-13-stage5-instruction-review.html")

const categoryLabel: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  mask: "Maske",
  oil: "Öl",
  heat_protectant: "Hitzeschutz",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigung",
  dry_shampoo: "Trockenshampoo",
  scalp_care: "Kopfhautpflege",
}

const dayLabel: Record<string, string> = {
  wash_day: "Waschtag",
  intensive_care_day: "Intensivpflege",
  bond_repair_day: "Bond-Repair-Tag",
  clarifying_wash_day: "Tiefenreinigungstag",
  refresh_day: "Refresh-Tag",
  between_wash_care_day: "Pflege zwischen Waschtagen",
  styling_day: "Stylingtag",
  rest_day: "Pausentag",
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function list(values: readonly string[], empty = "Keine") {
  return values.length > 0 ? values.map(escapeHtml).join(" · ") : empty
}

export function renderStage5InstructionReviewHtml(artifactText: string) {
  const artifact = stage5V2ApplicationArtifactSchema.parse(JSON.parse(artifactText))
  if (artifact.items.some((item) => item.guidance_payload_v2.runtimeBlockerCode !== null)) {
    throw new Error("instruction_review_requires_zero_runtime_blockers")
  }
  const fingerprint = stage5V2ArtifactFingerprint(artifactText)
  const templates = [...artifact.family_templates].sort(
    (left, right) =>
      left.scope.category.localeCompare(right.scope.category) ||
      left.guidanceKey.localeCompare(right.guidanceKey),
  )
  const exactItems = artifact.items
    .filter((item) => item.exact_workflow_id !== null)
    .sort(
      (left, right) =>
        left.guidance_payload_v2.scope.category.localeCompare(
          right.guidance_payload_v2.scope.category,
        ) || left.product_name.localeCompare(right.product_name),
    )

  const familySections = templates
    .map((template) => {
      const mappedProducts = artifact.items
        .filter((item) => item.template_keys.includes(template.guidanceKey))
        .map((item) => item.product_name)
        .sort((left, right) => left.localeCompare(right))
      return `<article class="card">
        <div class="eyebrow">${escapeHtml(categoryLabel[template.scope.category] ?? template.scope.category)} · ${mappedProducts.length} Produkt${mappedProducts.length === 1 ? "" : "e"}</div>
        <h3>${escapeHtml(template.guidanceKey)}</h3>
        <p class="meta"><strong>Geeignet für:</strong> ${list(template.compatibleDayTypes.map((day) => dayLabel[day] ?? day))}</p>
        <ol>${template.steps.map((step) => `<li><span>${escapeHtml(step.action)}</span>${escapeHtml(step.copyTemplateDe)}</li>`).join("")}</ol>
        <details><summary>Verwendete Produkte (${mappedProducts.length})</summary><p>${list(mappedProducts)}</p></details>
      </article>`
    })
    .join("\n")

  const exactSections = exactItems
    .map((item) => {
      const pointer = item.guidance_payload_v2
      return `<article class="card exact">
        <div class="eyebrow">${escapeHtml(categoryLabel[pointer.scope.category] ?? pointer.scope.category)} · Produktspezifisch</div>
        <h3>${escapeHtml(item.product_name)}</h3>
        <p class="workflow">${escapeHtml(item.exact_workflow_id)}</p>
        <ol>${pointer.exactSteps.map((step) => `<li><span>${escapeHtml(step.action)}</span>${escapeHtml(step.copyDe)}</li>`).join("")}</ol>
        <p class="meta"><strong>Hinweise:</strong> ${list(pointer.cautionCodes)}</p>
      </article>`
    })
    .join("\n")

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Stage 5 Anwendungsanweisungen – Review</title>
  <style>
    :root{color-scheme:light;--ink:#171714;--muted:#68675f;--line:#deddd5;--paper:#fbfaf6;--accent:#6f5a45;--exact:#f3e8d9}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1040px;margin:0 auto;padding:48px 24px 80px}header{border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:32px}h1{font:600 clamp(2rem,5vw,4rem)/1.02 ui-serif,Georgia,serif;max-width:14ch;margin:.15em 0}.lede{max-width:72ch;color:var(--muted)}.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.pill{border:1px solid var(--line);border-radius:999px;padding:6px 11px;background:#fff}.fingerprint{font:12px/1.5 ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere;color:var(--muted)}h2{font:600 1.75rem/1.2 ui-serif,Georgia,serif;margin:48px 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:16px}.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 8px 30px rgba(31,28,22,.04)}.card.exact{background:var(--exact)}h3{font-size:1rem;margin:5px 0 12px;overflow-wrap:anywhere}.eyebrow{color:var(--accent);font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.meta,.workflow,details{font-size:.88rem;color:var(--muted)}.workflow{font-family:ui-monospace,SFMono-Regular,monospace}ol{padding-left:22px;margin:18px 0}li{padding:0 0 12px 4px}li span{display:block;color:var(--muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}summary{cursor:pointer;font-weight:700}@media(max-width:560px){main{padding:28px 16px 56px}.grid{grid-template-columns:1fr}.card{padding:17px}}
  </style>
</head>
<body><main>
  <header>
    <div class="eyebrow">Review-Artefakt · 13. August 2026</div>
    <h1>Anwendung: kanonisch, wo möglich. Spezifisch, wo nötig.</h1>
    <p class="lede">Jede Familienanweisung wird genau einmal gezeigt. Produktspezifische Abläufe stehen separat. Dieses Dokument ändert keine Inhalte; es bindet die Review an das exakt generierte Katalog-Artefakt.</p>
    <div class="stats"><span class="pill">${templates.length} kanonische Familien</span><span class="pill">${exactItems.length} produktspezifische Abläufe</span><span class="pill">${artifact.observed_counts.rows} Produkt-Rollen</span><span class="pill">0 Blocker</span></div>
    <p class="fingerprint"><strong>SHA-256:</strong> ${fingerprint}</p>
  </header>
  <section><h2>Kanonische Familien</h2><div class="grid">${familySections}</div></section>
  <section><h2>Produktspezifische Abläufe</h2><div class="grid">${exactSections}</div></section>
</main></body></html>\n`
}

function main() {
  const artifactText = readFileSync(defaultArtifactPath, "utf8")
  const html = renderStage5InstructionReviewHtml(artifactText)
  mkdirSync(dirname(defaultOutputPath), { recursive: true })
  writeFileSync(defaultOutputPath, html)
  process.stdout.write(`wrote ${defaultOutputPath}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
