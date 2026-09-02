/**
 * Builds a self-contained review.html contact sheet from batch-run.ts's
 * results.json: one card per image with original | cutout-on-white |
 * cutout-on-magenta, the automated path taken + metrics, and a checkbox
 * (default checked for status "ok", unchecked for "flagged"/"failed", and
 * disabled — nothing to approve — when there's no cutout at all). A button
 * downloads approved-ids.json with the checked ids for
 * finalize-approved.ts.
 *
 * Opened locally via file://, so images are referenced with paths relative
 * to review.html (same output directory batch-run.ts wrote into).
 *
 * Usage:
 *   npx tsx scripts/product-images/contact-sheet.ts \
 *     --results <batchOutDir>/results.json [--out <batchOutDir>/review.html]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { parseArgs, requireFlag } from "./cli-args"
import type { ImageResult } from "./batch-run"

const USAGE =
  "usage: npx tsx scripts/product-images/contact-sheet.ts --results <results.json> [--out <review.html>]"

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  )
}

function relPath(baseDir: string, target: string | null): string | null {
  if (!target) return null
  return relative(baseDir, target).replaceAll("\\", "/")
}

function figure(src: string | null, label: string): string {
  if (!src) {
    return `<figure><div class="missing">kein Bild</div><figcaption>${escapeHtml(label)}</figcaption></figure>`
  }
  return `<figure><img src="${escapeHtml(src)}" loading="lazy" alt="${escapeHtml(label)}" /><figcaption>${escapeHtml(label)}</figcaption></figure>`
}

function renderCard(result: ImageResult, baseDir: string): string {
  const original = relPath(baseDir, result.files.original)
  const white = relPath(baseDir, result.files.qa_white)
  const magenta = relPath(baseDir, result.files.qa_magenta)
  const hasCutout = Boolean(result.files.cutout)
  const checked = result.status === "ok" ? "checked" : ""
  const disabled = hasCutout ? "" : "disabled"

  return `<div class="card status-${result.status}">
  <div class="card-head">
    <span class="id">${escapeHtml(result.id)}</span>
    <span class="badge ${result.status}">${result.status}</span>
  </div>
  <div class="imgs">
    ${figure(original, "Original")}
    ${figure(white, "Cutout / Weiß")}
    ${figure(magenta, "Cutout / Magenta")}
  </div>
  <div class="meta">
    <div>Pfad: ${escapeHtml(result.path_taken.join(" → ") || "—")}</div>
    <div>Alpha: ${(result.metrics.alpha_coverage * 100).toFixed(1)}% · Halo: ${result.metrics.halo_score.toFixed(3)}</div>
    ${result.reason ? `<div class="reason">${escapeHtml(result.reason)}</div>` : ""}
  </div>
  <label class="approve">
    <input type="checkbox" value="${escapeHtml(result.id)}" ${checked} ${disabled} />
    Freigeben
  </label>
</div>`
}

function buildHtml(payload: { summary: Record<string, unknown>; results: ImageResult[] }, baseDir: string): string {
  const rows = payload.results.map((result) => renderCard(result, baseDir)).join("\n")
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>Produktbild-Review — ${payload.results.length} Bilder</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 24px; background: #f7f5f2; color: #1c1a17; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .summary { color: #57534e; margin-bottom: 20px; font-size: 14px; }
  .toolbar { position: sticky; top: 0; background: #f7f5f2; padding: 12px 0; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #e2ddd4; margin-bottom: 16px; z-index: 10; }
  button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #c9c2b6; background: #fff; cursor: pointer; }
  button.primary { background: #1c1a17; color: #fff; border-color: #1c1a17; }
  .count { font-size: 13px; color: #57534e; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
  .card { background: #fff; border: 1px solid #e2ddd4; border-radius: 12px; padding: 12px; }
  .card.status-flagged { border-color: #d97706; background: #fffaf0; }
  .card.status-failed { border-color: #dc2626; background: #fef2f2; }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .id { font-weight: 600; font-size: 13px; word-break: break-all; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; }
  .badge.ok { background: #dcfce7; color: #166534; }
  .badge.flagged { background: #fef3c7; color: #92400e; }
  .badge.failed { background: #fee2e2; color: #991b1b; }
  .imgs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
  .imgs figure { margin: 0; }
  .imgs img { width: 100%; aspect-ratio: 1; object-fit: contain; background: #eee; border-radius: 6px; display: block; }
  .imgs figcaption { font-size: 10px; text-align: center; color: #78716c; margin-top: 2px; }
  .missing { display: flex; align-items: center; justify-content: center; background: #f1ede6; color: #a8a29e; font-size: 11px; border-radius: 6px; aspect-ratio: 1; }
  .meta { font-size: 11px; color: #57534e; line-height: 1.5; }
  .meta .reason { color: #92400e; }
  .card.status-failed .meta .reason { color: #991b1b; }
  label.approve { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 13px; }
</style>
</head>
<body>
<h1>Produktbild-Review</h1>
<div class="summary">${payload.summary.total} Bilder — ok: ${payload.summary.ok}, zu prüfen: ${payload.summary.flagged}, fehlgeschlagen: ${payload.summary.failed} · ${payload.summary.avg_ms_per_image} ms/Bild</div>
<div class="toolbar">
  <button class="primary" id="download-btn">approved-ids.json herunterladen</button>
  <span class="count"><span id="approved-count">0</span> ausgewählt</span>
</div>
<div class="grid">
${rows}
</div>
<script>
function updateCount() {
  document.getElementById('approved-count').textContent =
    document.querySelectorAll('input[type=checkbox]:checked').length;
}
document.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
  cb.addEventListener('change', updateCount);
});
updateCount();
document.getElementById('download-btn').addEventListener('click', function () {
  var ids = Array.prototype.map.call(
    document.querySelectorAll('input[type=checkbox]:checked'),
    function (cb) { return cb.value; }
  );
  var blob = new Blob([JSON.stringify(ids, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'approved-ids.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
</script>
</body>
</html>
`
}

async function main(): Promise<void> {
  const flags = parseArgs()
  const resultsPath = resolve(requireFlag(flags, "results", USAGE))
  const outPath = resolve(flags.get("out") ?? resolve(dirname(resultsPath), "review.html"))
  const baseDir = dirname(outPath)

  const payload = JSON.parse(readFileSync(resultsPath, "utf8")) as {
    summary: Record<string, unknown>
    results: ImageResult[]
  }
  if (!Array.isArray(payload.results)) {
    throw new Error(`${resultsPath} does not look like a batch-run.ts results.json (missing "results" array)`)
  }

  const html = buildHtml(payload, baseDir)
  writeFileSync(outPath, html)
  console.log(`Review sheet: ${outPath}`)
  console.log(`Open it directly in a browser (file://${outPath}).`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
