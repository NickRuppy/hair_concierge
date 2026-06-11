import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { chromium, type Browser } from "playwright"

const batchDir =
  process.argv.find((arg) => arg.startsWith("--batch-dir="))?.slice("--batch-dir=".length) ??
  "data/product-images/pilot-2026-06-10"
const pilotPath =
  process.argv.find((arg) => arg.startsWith("--pilot="))?.slice("--pilot=".length) ??
  join(batchDir, "pilot-products.csv")
const candidatesDir = join(batchDir, "candidates")
const reviewPath = join(batchDir, "review.html")
const reportPath = join(batchDir, "image-candidates.json")

interface PilotProduct {
  id: string
  brand: string
  name: string
  category: string
  affiliate_link: string
  notes: string
}

interface ImageCandidate {
  url: string
  source: string
  score: number
  localPath?: string
  contentType?: string
  bytes?: number
  sha256?: string
  error?: string
}

interface ProductResult {
  product: PilotProduct
  pageStatus?: number
  pageError?: string
  candidates: ImageCandidate[]
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      values.push(current)
      current = ""
      continue
    }
    current += char
  }

  values.push(current)
  return values
}

function readPilotProducts(path: string): PilotProduct[] {
  const lines = readFileSync(path, "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0)
  const header = parseCsvLine(lines[0] ?? "")

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(
      header.map((key, index) => [key, values[index] ?? ""]),
    ) as PilotProduct
  })
}

function decodeUrlish(value: string): string {
  return value
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim()
}

function addCandidate(
  candidates: Map<string, ImageCandidate>,
  pageUrl: string,
  rawUrl: string | undefined,
  source: string,
  baseScore: number,
  bonus = 0,
): void {
  if (!rawUrl) return

  const candidateUrl = decodeUrlish(rawUrl).trim().split(/\s+/)[0]
  if (!candidateUrl) return

  let url: URL
  try {
    url = new URL(candidateUrl, pageUrl)
  } catch {
    return
  }

  if (!["http:", "https:"].includes(url.protocol)) return

  const normalized = url.toString()
  const lower = normalized.toLowerCase()
  const looksLikeImage =
    /\.(webp|png|jpe?g)(\?|$)/.test(lower) ||
    lower.includes("/image") ||
    lower.includes("image=") ||
    lower.includes("images")
  if (!looksLikeImage) return

  let score = baseScore + bonus
  if (lower.includes("product")) score += 8
  if (lower.includes("pdm") || lower.includes("media")) score += 4
  if (lower.includes("1200") || lower.includes("1000") || lower.includes("800")) score += 4
  if (lower.includes("thumbnail") || lower.includes("thumb")) score -= 4
  if (lower.includes("logo") || lower.includes("icon") || lower.includes("sprite")) score -= 20
  if (lower.includes("placeholder") || lower.includes("transparent")) score -= 20

  const previous = candidates.get(normalized)
  if (!previous || previous.score < score) {
    candidates.set(normalized, { url: normalized, source, score })
  }
}

function addSrcsetCandidates(
  candidates: Map<string, ImageCandidate>,
  pageUrl: string,
  rawSrcset: string | undefined,
  source: string,
  baseScore: number,
): void {
  if (!rawSrcset) return

  for (const part of decodeUrlish(rawSrcset).split(/,\s+(?=\S)/)) {
    addCandidate(candidates, pageUrl, part, source, baseScore)
  }
}

function extractJsonLdImages(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap(extractJsonLdImages)
  if (typeof value === "string") return [value]
  if (typeof value !== "object") return []

  const record = value as Record<string, unknown>
  return [
    ...extractJsonLdImages(record.image),
    ...extractJsonLdImages(record.images),
    ...extractJsonLdImages(record.thumbnailUrl),
    ...extractJsonLdImages(record.offers),
    ...extractJsonLdImages(record["@graph"]),
  ]
}

function extractCandidates(pageUrl: string, html: string): ImageCandidate[] {
  const candidates = new Map<string, ImageCandidate>()

  for (const match of html.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
  )) {
    addCandidate(candidates, pageUrl, match[1], "meta", 90)
  }

  for (const match of html.matchAll(
    /<link[^>]+rel=["'][^"']*(?:image_src|preload)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
  )) {
    addCandidate(candidates, pageUrl, match[1], "link", 65)
  }

  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(decodeUrlish(match[1] ?? ""))
      for (const image of extractJsonLdImages(parsed)) {
        addCandidate(candidates, pageUrl, image, "json-ld", 95)
      }
    } catch {
      // Some shops emit malformed JSON-LD. Other extractors still cover them.
    }
  }

  for (const match of html.matchAll(
    /<img[^>]+(?:src|data-src|data-original|data-image|data-zoom-image)=["']([^"']+)["'][^>]*>/gi,
  )) {
    addCandidate(candidates, pageUrl, match[1], "img", 50)
  }

  for (const match of html.matchAll(/<(?:img|source)[^>]+srcset=["']([^"']+)["'][^>]*>/gi)) {
    addSrcsetCandidates(candidates, pageUrl, match[1], "srcset", 55)
  }

  for (const match of html.matchAll(
    /https?:\\?\/\\?\/[^"' <>)]+?\.(?:webp|png|jpe?g)(?:\?[^"' <>)]+)?/gi,
  )) {
    addCandidate(candidates, pageUrl, match[0], "raw-url", 35)
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

function mergeCandidates(...groups: ImageCandidate[][]): ImageCandidate[] {
  const candidates = new Map<string, ImageCandidate>()

  for (const group of groups) {
    for (const candidate of group) {
      const previous = candidates.get(candidate.url)
      if (!previous || previous.score < candidate.score) {
        candidates.set(candidate.url, candidate)
      }
    }
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

function productMatchBonus(product: PilotProduct, value: string): number {
  const haystack = value.toLowerCase()
  const words = `${product.brand} ${product.name}`
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter((word) => word.length >= 4)

  return words.filter((word) => haystack.includes(word)).length * 3
}

async function extractBrowserCandidates(
  browser: Browser,
  product: PilotProduct,
): Promise<ImageCandidate[]> {
  const candidates = new Map<string, ImageCandidate>()
  const page = await browser.newPage({
    locale: "de-DE",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  })

  try {
    await page.goto(product.affiliate_link, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(3000)

    const rendered = await page.evaluate(() => {
      const metas = Array.from(document.querySelectorAll("meta"))
        .map((meta) => ({
          key: meta.getAttribute("property") || meta.getAttribute("name") || "",
          content: meta.getAttribute("content") || "",
        }))
        .filter((meta) => /image/i.test(meta.key))

      const images = Array.from(document.images)
        .map((image) => ({
          src: image.currentSrc || image.src,
          alt: image.alt || "",
          width: image.naturalWidth,
          height: image.naturalHeight,
        }))
        .filter((image) => image.src)

      return { metas, images }
    })

    for (const meta of rendered.metas) {
      addCandidate(
        candidates,
        product.affiliate_link,
        meta.content,
        "browser-meta",
        110,
        productMatchBonus(product, meta.content),
      )
    }

    for (const image of rendered.images) {
      const dimensionsBonus = Math.min(image.width, image.height) >= 250 ? 12 : 0
      const productBonus = productMatchBonus(product, `${image.alt} ${image.src}`)
      const penalty = /logo|icon|sprite|star|rating|payback|seal/i.test(`${image.alt} ${image.src}`)
        ? -30
        : 0
      addCandidate(
        candidates,
        product.affiliate_link,
        image.src,
        "browser-img",
        70,
        dimensionsBonus + productBonus + penalty,
      )
    }
  } finally {
    await page.close()
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

function extensionFor(url: string, contentType?: string | null): string {
  const fromContentType = contentType?.split(";")[0]?.trim().toLowerCase()
  if (fromContentType === "image/webp") return ".webp"
  if (fromContentType === "image/png") return ".png"
  if (fromContentType === "image/jpeg") return ".jpg"
  if (fromContentType === "image/avif") return ".avif"

  const ext = extname(new URL(url).pathname).toLowerCase()
  if ([".webp", ".png", ".jpg", ".jpeg", ".avif"].includes(ext)) return ext
  return ".jpg"
}

function safeFileName(
  product: PilotProduct,
  index: number,
  url: string,
  contentType?: string | null,
): string {
  const slug = `${product.brand}-${product.name}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
  return `${String(index + 1).padStart(2, "0")}-${slug || product.id}${extensionFor(url, contentType)}`
}

async function fetchText(url: string): Promise<{ status: number; html: string }> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    },
  })
  return { status: response.status, html: await response.text() }
}

async function downloadCandidate(
  product: PilotProduct,
  candidate: ImageCandidate,
  productDir: string,
  index: number,
): Promise<ImageCandidate> {
  try {
    const response = await fetch(candidate.url, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: product.affiliate_link,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      return { ...candidate, error: `download status ${response.status}` }
    }

    const contentType = response.headers.get("content-type")
    if (!contentType?.startsWith("image/")) {
      return {
        ...candidate,
        contentType: contentType ?? undefined,
        error: "download was not an image",
      }
    }
    if (contentType.includes("svg")) {
      return { ...candidate, contentType, error: "skipped svg/non-product asset" }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength < 12000) {
      return {
        ...candidate,
        contentType,
        bytes: buffer.byteLength,
        error: "skipped tiny image asset",
      }
    }
    const localPath = join(productDir, safeFileName(product, index, candidate.url, contentType))
    writeFileSync(localPath, buffer)

    return {
      ...candidate,
      localPath,
      contentType,
      bytes: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    }
  } catch (error) {
    return { ...candidate, error: error instanceof Error ? error.message : String(error) }
  }
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function writeReview(results: ProductResult[]): void {
  const reviewDir = dirname(resolve(reviewPath))
  const batchLabel = basename(resolve(batchDir))
  const body = results
    .map((result, productIndex) => {
      const usableCandidates = result.candidates.filter(
        (candidate) => candidate.localPath && !candidate.error,
      )
      const failedCandidates = result.candidates.filter(
        (candidate) => candidate.error || !candidate.localPath,
      )
      const candidates = usableCandidates
        .map((candidate, candidateIndex) => {
          const reviewImagePath = candidate.localPath
            ? relative(reviewDir, resolve(candidate.localPath))
            : undefined
          const candidateId = `${result.product.id}:${candidateIndex}`
          return `<article class="candidate" data-product-id="${htmlEscape(result.product.id)}" data-candidate-id="${htmlEscape(candidateId)}" data-candidate-url="${htmlEscape(candidate.url)}" data-local-path="${htmlEscape(candidate.localPath ?? "")}" data-source="${htmlEscape(candidate.source)}">
            <button class="imageButton" type="button" data-action="select" aria-label="Select candidate">
              <img src="${htmlEscape(reviewImagePath ?? candidate.localPath ?? "")}" alt="">
            </button>
            <div class="candidateMeta">
              <strong>${htmlEscape(candidate.source)}</strong> score ${candidate.score}
              ${candidate.bytes ? `<span>${Math.round(candidate.bytes / 1024)} KB</span>` : ""}
              <a href="${htmlEscape(candidate.url)}" target="_blank" rel="noreferrer">source</a>
            </div>
            <div class="actions" role="group" aria-label="Candidate review">
              <button type="button" data-rating="good">Good</button>
              <button type="button" data-rating="maybe">Maybe</button>
              <button type="button" data-rating="bad">Bad</button>
            </div>
          </article>`
        })
        .join("")
      const failed = failedCandidates
        .map(
          (candidate) =>
            `<li><strong>${htmlEscape(candidate.source)}</strong>: ${htmlEscape(candidate.error ?? "not downloaded")} · <a href="${htmlEscape(candidate.url)}" target="_blank" rel="noreferrer">source</a></li>`,
        )
        .join("")

      return `<section>
        <header class="productHeader">
          <div>
            <p class="index">${productIndex + 1} / ${results.length}</p>
            <h2>${htmlEscape(result.product.brand)} ${htmlEscape(result.product.name)}</h2>
            <p>${htmlEscape(result.product.category)} · <a href="${htmlEscape(result.product.affiliate_link)}" target="_blank" rel="noreferrer">product page</a></p>
          </div>
          <div class="productDecision" data-product-id="${htmlEscape(result.product.id)}">
            <button type="button" data-product-rating="approved">Approve Product</button>
            <button type="button" data-product-rating="needs_work">Needs Work</button>
            <button type="button" data-product-rating="reject">Reject</button>
          </div>
          ${result.pageError ? `<p class="error">${htmlEscape(result.pageError)}</p>` : ""}
        </header>
        <div class="grid">${candidates || '<p class="error">No usable image candidates found.</p>'}</div>
        <label class="comment">
          Comment
          <textarea data-comment-for="${htmlEscape(result.product.id)}" rows="2" placeholder="Exact product? Wrong packaging? Needs manual search?"></textarea>
        </label>
        ${
          failed
            ? `<details class="failed"><summary>${failedCandidates.length} hidden failed/noisy candidates</summary><ul>${failed}</ul></details>`
            : ""
        }
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
  <title>Product Image Review - ${htmlEscape(batchLabel)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f7f4ef; color: #1d1b18; }
    .topbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 16px 32px; background: rgba(247, 244, 239, 0.96); border-bottom: 1px solid #d8d0c3; backdrop-filter: blur(8px); }
    main { max-width: 1280px; margin: 0 auto; padding: 24px 32px 40px; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 18px; margin: 0; }
    p { margin: 4px 0 0; color: #5e574d; }
    section { border-top: 1px solid #d8d0c3; padding: 24px 0; }
    .productHeader { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
    .index { font-size: 12px; text-transform: uppercase; letter-spacing: 0; color: #81786b; }
    .summary { font-size: 14px; color: #5e574d; }
    .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    button, .download { appearance: none; border: 1px solid #cfc5b6; background: #fffaf1; color: #29251f; border-radius: 6px; padding: 8px 10px; font: inherit; font-size: 13px; cursor: pointer; text-decoration: none; }
    button:hover, .download:hover { background: #f0e7d7; }
    button.active, .download.active { border-color: #78614a; background: #dfd1be; }
    button[data-rating="good"].active, button[data-product-rating="approved"].active { border-color: #3c7a4b; background: #dcebd8; }
    button[data-rating="maybe"].active, button[data-product-rating="needs_work"].active { border-color: #a66c19; background: #f4e2c2; }
    button[data-rating="bad"].active, button[data-product-rating="reject"].active { border-color: #9b2c2c; background: #efd7d3; }
    .productDecision { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-top: 16px; }
    .candidate { margin: 0; background: #ebe6dd; border: 1px solid #d8d0c3; border-radius: 8px; overflow: hidden; }
    .candidate.selected { outline: 3px solid #78614a; border-color: #78614a; }
    .imageButton { display: block; width: 100%; padding: 0; border: 0; border-radius: 0; background: #f3efe8; }
    img { width: 100%; aspect-ratio: 1; object-fit: contain; display: block; background: #f3efe8; }
    .candidateMeta { padding: 10px 10px 0; font-size: 12px; line-height: 1.35; word-break: break-word; }
    .candidateMeta span { display: block; color: #5e574d; }
    .actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px; }
    .actions button { padding: 7px 6px; }
    .comment { display: grid; gap: 6px; margin-top: 14px; font-size: 13px; font-weight: 700; }
    textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfc5b6; border-radius: 6px; padding: 10px; background: #fffaf1; color: #1d1b18; font: inherit; resize: vertical; }
    details { margin-top: 12px; color: #5e574d; font-size: 13px; }
    li { margin: 4px 0; }
    a { color: #67513d; }
    .error { color: #9b2c2c; }
    @media (max-width: 720px) {
      .topbar, .productHeader { display: block; }
      .toolbar, .productDecision { margin-top: 12px; justify-content: flex-start; }
      main, .topbar { padding-left: 16px; padding-right: 16px; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div>
      <h1>Product Image Review</h1>
      <p class="summary">${htmlEscape(batchLabel)} · <span id="progress">0 reviewed</span> · selections are saved in this browser</p>
    </div>
    <div class="toolbar">
      <button type="button" id="showAll">Show All</button>
      <button type="button" id="showOpen">Show Open</button>
      <button type="button" id="copyJson">Copy JSON</button>
      <a class="download" id="downloadJson" href="#">Download Review</a>
    </div>
  </div>
  <main>
    ${body}
  </main>
  <script>
    const storageKey = "product-image-review-v2:" + window.location.pathname;
    const review = JSON.parse(localStorage.getItem(storageKey) || "{}");

    function productState(productId) {
      review[productId] ||= { productRating: "", selectedCandidateId: "", candidateRatings: {}, comment: "" };
      return review[productId];
    }

    function save() {
      localStorage.setItem(storageKey, JSON.stringify(review, null, 2));
      syncToServer();
      render();
    }

    function syncToServer() {
      const statePath = window.location.pathname.replace(/review\\.html$/, "review-state");
      fetch(statePath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exportPayload(), null, 2)
      }).catch(() => {});
    }

    function render() {
      document.querySelectorAll("section").forEach((section) => {
        const productId = section.querySelector("[data-product-id]")?.dataset.productId;
        if (!productId) return;
        const state = productState(productId);
        section.querySelectorAll("[data-product-rating]").forEach((button) => {
          button.classList.toggle("active", state.productRating === button.dataset.productRating);
        });
        section.querySelectorAll(".candidate").forEach((card) => {
          const candidateId = card.dataset.candidateId;
          card.classList.toggle("selected", state.selectedCandidateId === candidateId);
          card.querySelectorAll("[data-rating]").forEach((button) => {
            button.classList.toggle("active", state.candidateRatings[candidateId] === button.dataset.rating);
          });
        });
        const textarea = section.querySelector("textarea");
        if (textarea && document.activeElement !== textarea) textarea.value = state.comment || "";
      });

      const states = Object.values(review);
      const reviewed = states.filter((state) => state.productRating || state.selectedCandidateId || state.comment).length;
      document.getElementById("progress").textContent = reviewed + " / ${results.length} reviewed";
      document.getElementById("downloadJson").href = URL.createObjectURL(
        new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json" })
      );
      document.getElementById("downloadJson").download = "product-image-pilot-review.json";
    }

    function exportPayload() {
      return Array.from(document.querySelectorAll("section")).map((section) => {
        const productId = section.querySelector("[data-product-id]")?.dataset.productId;
        const state = productState(productId);
        const selected = state.selectedCandidateId
          ? section.querySelector("[data-candidate-id='" + CSS.escape(state.selectedCandidateId) + "']")
          : null;
        return {
          product_id: productId,
          product: section.querySelector("h2")?.textContent || "",
          product_rating: state.productRating,
          selected_candidate_id: state.selectedCandidateId,
          selected_image_url: selected?.dataset.candidateUrl || "",
          selected_local_path: selected?.dataset.localPath || "",
          selected_source: selected?.dataset.source || "",
          candidate_ratings: state.candidateRatings,
          comment: state.comment || ""
        };
      });
    }

    document.addEventListener("click", async (event) => {
      const target = event.target.closest("button, a");
      if (!target) return;

      if (target.id === "showAll") {
        document.querySelectorAll("section").forEach((section) => section.hidden = false);
        return;
      }
      if (target.id === "showOpen") {
        document.querySelectorAll("section").forEach((section) => {
          const productId = section.querySelector("[data-product-id]")?.dataset.productId;
          const state = productState(productId);
          section.hidden = Boolean(state.productRating || state.selectedCandidateId || state.comment);
        });
        return;
      }
      if (target.id === "copyJson") {
        await navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
        target.textContent = "Copied";
        setTimeout(() => { target.textContent = "Copy JSON"; }, 1200);
        return;
      }

      const candidate = target.closest(".candidate");
      const productId = candidate?.dataset.productId || target.closest("[data-product-id]")?.dataset.productId;
      if (!productId) return;

      const state = productState(productId);
      if (target.dataset.action === "select" && candidate) {
        state.selectedCandidateId = candidate.dataset.candidateId;
        state.candidateRatings[candidate.dataset.candidateId] = "good";
        if (!state.productRating) state.productRating = "approved";
        save();
      }
      if (target.dataset.rating && candidate) {
        state.candidateRatings[candidate.dataset.candidateId] = target.dataset.rating;
        if (target.dataset.rating === "good") {
          state.selectedCandidateId = candidate.dataset.candidateId;
          if (!state.productRating) state.productRating = "approved";
        }
        save();
      }
      if (target.dataset.productRating) {
        state.productRating = target.dataset.productRating;
        save();
      }
    });

    document.addEventListener("input", (event) => {
      if (!event.target.matches("textarea[data-comment-for]")) return;
      const state = productState(event.target.dataset.commentFor);
      state.comment = event.target.value;
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
  mkdirSync(candidatesDir, { recursive: true })

  const products = readPilotProducts(pilotPath)
  const results: ProductResult[] = []
  const browser = await chromium.launch({ headless: true })

  try {
    for (const [productIndex, product] of products.entries()) {
      const productDir = join(
        candidatesDir,
        `${String(productIndex + 1).padStart(2, "0")}-${product.id}`,
      )
      mkdirSync(productDir, { recursive: true })

      const result: ProductResult = { product, candidates: [] }
      try {
        const page = await fetchText(product.affiliate_link)
        result.pageStatus = page.status
        if (page.status >= 400) {
          result.pageError = `Product page returned HTTP ${page.status}`
        }

        const staticCandidates = extractCandidates(product.affiliate_link, page.html)
        const browserCandidates = await extractBrowserCandidates(browser, product)
        const candidates = mergeCandidates(staticCandidates, browserCandidates)
        result.candidates = await Promise.all(
          candidates.map((candidate, index) =>
            downloadCandidate(product, candidate, productDir, index),
          ),
        )
      } catch (error) {
        result.pageError = error instanceof Error ? error.message : String(error)
      }

      results.push(result)
      const downloaded = result.candidates.filter((candidate) => candidate.localPath).length
      console.log(
        `${String(productIndex + 1).padStart(2, "0")}/${products.length} ${product.brand} ${product.name}: ${downloaded}/${result.candidates.length} downloaded`,
      )
    }
  } finally {
    await browser.close()
  }

  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  writeReview(results)

  console.log(`Wrote ${reportPath}`)
  console.log(`Wrote ${reviewPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
