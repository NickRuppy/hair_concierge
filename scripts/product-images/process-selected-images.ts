import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, join, relative, resolve } from "node:path"
import sharp from "sharp"

const batchDir =
  process.argv.find((arg) => arg.startsWith("--batch-dir="))?.slice("--batch-dir=".length) ??
  "data/product-images/pilot-2026-06-10"
const expectedCount = Number(
  process.argv
    .find((arg) => arg.startsWith("--expected-count="))
    ?.slice("--expected-count=".length) ?? 20,
)
const decisionsPath = join(batchDir, "merged-review-decisions.json")
const inputDir = process.argv
  .find((arg) => arg.startsWith("--input-dir="))
  ?.slice("--input-dir=".length)
const skipBackgroundRemoval =
  process.argv.includes("--skip-background-removal") || Boolean(inputDir)
const finalDir = join(batchDir, "final")
const reviewPath = join(batchDir, "final-review.html")
const reportPath = join(batchDir, "final-assets.json")

const CANVAS_SIZE = 1200
const PRODUCT_MAX_SIZE = 940
const PRODUCT_TARGET_AREA = 460_000
const PRODUCT_PADDING = 130
const BACKGROUND = { r: 243, g: 239, b: 232 }

if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
  throw new Error(`--expected-count must be a positive integer, got ${expectedCount}`)
}

interface MergedDecision {
  product_id: string
  product: string
  status: "approved" | "needs_manual_search" | "rejected"
  source_round: string
  selected_local_path: string
  selected_image_url: string
  selected_source: string
  selected_file: string
  comment: string
}

interface FinalAsset {
  product_id: string
  product: string
  source_round: string
  source_page_url: string
  source_image_url: string
  selected_local_path: string
  final_file: string
  final_path: string
  sha256: string
  width: number
  height: number
  removed_background_pixels: number
  notes: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function estimateBackground(data: Buffer, width: number, height: number): [number, number, number] {
  const samples: [number, number, number][] = []
  const sampleSize = Math.max(12, Math.floor(Math.min(width, height) * 0.06))
  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ]

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y += 4) {
      for (let x = startX; x < startX + sampleSize; x += 4) {
        const index = (y * width + x) * 4
        const alpha = data[index + 3]
        if (alpha > 20) samples.push([data[index], data[index + 1], data[index + 2]])
      }
    }
  }

  if (samples.length === 0) return [255, 255, 255]

  const totals = samples.reduce(
    (acc, sample) => [acc[0] + sample[0], acc[1] + sample[1], acc[2] + sample[2]],
    [0, 0, 0],
  )
  return [
    Math.round(totals[0] / samples.length),
    Math.round(totals[1] / samples.length),
    Math.round(totals[2] / samples.length),
  ]
}

function removeEdgeBackground(data: Buffer, width: number, height: number): number {
  const background = estimateBackground(data, width, height)
  const backgroundLum = luminance(...background)
  const backgroundIsLight = backgroundLum > 205
  const distanceThreshold = backgroundIsLight ? 46 : 92
  const visited = new Uint8Array(width * height)
  const queue: number[] = []

  function shouldRemove(pixelIndex: number): boolean {
    const offset = pixelIndex * 4
    const alpha = data[offset + 3]
    if (alpha < 12) return true

    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const lum = luminance(r, g, b)
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const nearBackground = colorDistance([r, g, b], background) < distanceThreshold
    const nearWhite = r > 236 && g > 236 && b > 232 && chroma < 28

    return (nearBackground && (!backgroundIsLight || (lum > 190 && chroma < 42))) || nearWhite
  }

  function enqueue(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const pixelIndex = y * width + x
    if (visited[pixelIndex]) return
    visited[pixelIndex] = 1
    if (shouldRemove(pixelIndex)) queue.push(pixelIndex)
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  let removed = 0
  while (queue.length > 0) {
    const pixelIndex = queue.shift()
    if (pixelIndex === undefined) continue

    const offset = pixelIndex * 4
    if (data[offset + 3] !== 0) {
      data[offset + 3] = 0
      removed += 1
    }

    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    enqueue(x + 1, y)
    enqueue(x - 1, y)
    enqueue(x, y + 1)
    enqueue(x, y - 1)
  }

  return removed
}

function contentBounds(data: Buffer, width: number, height: number): sharp.Region {
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 18) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
  }

  if (right < left || bottom < top) {
    return { left: 0, top: 0, width, height }
  }

  const margin = Math.round(Math.min(width, height) * 0.025)
  left = clamp(left - margin, 0, width - 1)
  top = clamp(top - margin, 0, height - 1)
  right = clamp(right + margin, 0, width - 1)
  bottom = clamp(bottom + margin, 0, height - 1)

  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

function targetProductSize(bounds: sharp.Region): { width: number; height: number } {
  const maxSideScale = Math.min(PRODUCT_MAX_SIZE / bounds.width, PRODUCT_MAX_SIZE / bounds.height)
  const areaScale = Math.sqrt(PRODUCT_TARGET_AREA / (bounds.width * bounds.height))
  const scale = Math.min(maxSideScale, areaScale)

  return {
    width: Math.max(1, Math.round(bounds.width * scale)),
    height: Math.max(1, Math.round(bounds.height * scale)),
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70)
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function processAsset(decision: MergedDecision, index: number): Promise<FinalAsset> {
  const inputPath = inputDir
    ? findInputFileForProduct(decision.product_id)
    : decision.selected_local_path
  const source = sharp(inputPath).rotate().ensureAlpha()
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true })
  const removed = skipBackgroundRemoval ? 0 : removeEdgeBackground(data, info.width, info.height)
  const bounds = contentBounds(data, info.width, info.height)
  const finalFile = `${String(index + 1).padStart(2, "0")}-${decision.product_id}-${slug(decision.product)}.webp`
  const finalPath = join(finalDir, finalFile)

  const productBuffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(bounds)
    .resize({
      ...targetProductSize(bounds),
      fit: "fill",
    })
    .png()
    .toBuffer()

  const productMeta = await sharp(productBuffer).metadata()
  const left = Math.round((CANVAS_SIZE - (productMeta.width ?? PRODUCT_MAX_SIZE)) / 2)
  const top = Math.round((CANVAS_SIZE - (productMeta.height ?? PRODUCT_MAX_SIZE)) / 2)

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([{ input: productBuffer, left, top }])
    .webp({ quality: 88, effort: 5 })
    .toFile(finalPath)

  return {
    product_id: decision.product_id,
    product: decision.product,
    source_round: decision.source_round,
    source_page_url: "",
    source_image_url: decision.selected_image_url,
    selected_local_path: inputPath,
    final_file: `final/${finalFile}`,
    final_path: finalPath,
    sha256: sha256File(finalPath),
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    removed_background_pixels: removed,
    notes: decision.comment,
  }
}

function findInputFileForProduct(productId: string): string {
  if (!inputDir) throw new Error("Missing inputDir")

  const files = readdirSync(inputDir)
    .filter((file) => file.includes(productId))
    .map((file) => join(inputDir, file))

  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one input image for ${productId} in ${inputDir}, found ${files.length}`,
    )
  }

  return files[0]
}

function writeReview(assets: FinalAsset[]): void {
  const reviewDir = resolve(batchDir)
  const sections = assets
    .map((asset, index) => {
      const original = relative(reviewDir, resolve(asset.selected_local_path))
      const final = relative(reviewDir, resolve(asset.final_path))
      return `<section data-product-id="${htmlEscape(asset.product_id)}">
        <header>
          <div>
            <p class="index">${index + 1} / ${assets.length}</p>
            <h2>${htmlEscape(asset.product)}</h2>
            <p>${htmlEscape(asset.source_round)} · ${Math.round(asset.removed_background_pixels / 1000)}k background pixels removed</p>
          </div>
          <div class="actions">
            <button type="button" data-rating="approved">Approve</button>
            <button type="button" data-rating="needs_work">Needs Work</button>
          </div>
        </header>
        <div class="compare">
          <figure>
            <img src="${htmlEscape(original)}" alt="">
            <figcaption>Selected original</figcaption>
          </figure>
          <figure>
            <img src="${htmlEscape(final)}" alt="">
            <figcaption>Processed final</figcaption>
          </figure>
        </div>
        <textarea data-comment-for="${htmlEscape(asset.product_id)}" rows="2" placeholder="Comment"></textarea>
      </section>`
    })
    .join("")

  writeFileSync(
    reviewPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Final Product Image Review</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f4ef; color: #1d1b18; }
    .topbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 16px 32px; border-bottom: 1px solid #d8d0c3; background: rgba(247,244,239,.96); backdrop-filter: blur(8px); }
    main { max-width: 1280px; margin: 0 auto; padding: 24px 32px 40px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    h2 { margin: 0; font-size: 18px; }
    p { margin: 4px 0 0; color: #5e574d; }
    section { border-top: 1px solid #d8d0c3; padding: 24px 0; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
    .index { font-size: 12px; text-transform: uppercase; color: #81786b; }
    .compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
    figure { margin: 0; border: 1px solid #d8d0c3; border-radius: 8px; overflow: hidden; background: #ebe6dd; }
    img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; background: #f3efe8; }
    figcaption { padding: 10px; font-size: 13px; color: #5e574d; }
    .actions, .toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
    button, a.download { appearance: none; border: 1px solid #cfc5b6; background: #fffaf1; color: #29251f; border-radius: 6px; padding: 8px 10px; font: inherit; font-size: 13px; cursor: pointer; text-decoration: none; }
    button.active[data-rating="approved"] { border-color: #3c7a4b; background: #dcebd8; }
    button.active[data-rating="needs_work"] { border-color: #a66c19; background: #f4e2c2; }
    textarea { margin-top: 12px; width: 100%; box-sizing: border-box; border: 1px solid #cfc5b6; border-radius: 6px; padding: 10px; background: #fffaf1; color: #1d1b18; font: inherit; resize: vertical; }
    @media (max-width: 720px) {
      .topbar, header { display: block; }
      .toolbar, .actions { margin-top: 12px; }
      .compare { grid-template-columns: 1fr; }
      main, .topbar { padding-left: 16px; padding-right: 16px; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div>
      <h1>Final Product Image Review</h1>
      <p><span id="progress">0 reviewed</span> · final 1200x1200 WebP assets</p>
    </div>
    <div class="toolbar">
      <button type="button" id="approveAll">Approve All</button>
      <button type="button" id="copyJson">Copy JSON</button>
      <a class="download" id="downloadJson" href="#">Download Review</a>
    </div>
  </div>
  <main>${sections}</main>
  <script>
    const storageKey = "product-image-final-review-nobg-v2:" + window.location.pathname;
    const review = JSON.parse(localStorage.getItem(storageKey) || "{}");

    function state(productId) {
      review[productId] ||= { rating: "", comment: "" };
      return review[productId];
    }

    function exportPayload() {
      return Array.from(document.querySelectorAll("section")).map((section) => {
        const productId = section.dataset.productId;
        const current = state(productId);
        return {
          product_id: productId,
          product: section.querySelector("h2")?.textContent || "",
          rating: current.rating,
          comment: current.comment
        };
      });
    }

    function syncToServer() {
      fetch("/final-review-state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exportPayload(), null, 2)
      }).catch(() => {});
    }

    function save() {
      localStorage.setItem(storageKey, JSON.stringify(review, null, 2));
      syncToServer();
      render();
    }

    function render() {
      document.querySelectorAll("section").forEach((section) => {
        const current = state(section.dataset.productId);
        section.querySelectorAll("[data-rating]").forEach((button) => {
          button.classList.toggle("active", current.rating === button.dataset.rating);
        });
        const textarea = section.querySelector("textarea");
        if (textarea && document.activeElement !== textarea) textarea.value = current.comment || "";
      });
      const reviewed = Object.values(review).filter((item) => item.rating || item.comment).length;
      document.getElementById("progress").textContent = reviewed + " / ${assets.length} reviewed";
      document.getElementById("downloadJson").href = URL.createObjectURL(new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json" }));
      document.getElementById("downloadJson").download = "final-product-image-review.json";
    }

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.id === "approveAll") {
        document.querySelectorAll("section").forEach((section) => {
          state(section.dataset.productId).rating = "approved";
        });
        save();
        return;
      }
      if (button.id === "copyJson") {
        await navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
        button.textContent = "Copied";
        setTimeout(() => { button.textContent = "Copy JSON"; }, 1200);
        return;
      }
      if (button.dataset.rating) {
        state(button.closest("section").dataset.productId).rating = button.dataset.rating;
        save();
      }
    });

    document.addEventListener("input", (event) => {
      if (!event.target.matches("textarea[data-comment-for]")) return;
      state(event.target.dataset.commentFor).comment = event.target.value;
      save();
    });

    render();
    syncToServer();
  </script>
</body>
</html>
`,
  )
}

async function main(): Promise<void> {
  const decisions = (JSON.parse(readFileSync(decisionsPath, "utf8")) as MergedDecision[]).filter(
    (decision) => decision.status === "approved",
  )
  if (decisions.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} approved image decisions, found ${decisions.length}`)
  }

  rmSync(finalDir, { recursive: true, force: true })
  mkdirSync(finalDir, { recursive: true })

  const assets: FinalAsset[] = []
  for (const [index, decision] of decisions.entries()) {
    assets.push(await processAsset(decision, index))
    console.log(`${String(index + 1).padStart(2, "0")}/${decisions.length} ${decision.product}`)
  }

  writeFileSync(reportPath, `${JSON.stringify(assets, null, 2)}\n`)
  writeReview(assets)

  console.log(`Wrote ${reportPath}`)
  console.log(`Wrote ${reviewPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
