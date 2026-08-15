import { chromium } from "playwright"
import path from "node:path"
import { fileURLToPath } from "node:url"

const dir = path.dirname(fileURLToPath(import.meta.url))
const source = path.join(dir, "2026-08-15-stage3-owned-search-overflow.html")
const output = path.join(dir, "2026-08-15-stage3-owned-search-overflow.png")
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })

await page.goto(`file://${source}`, { waitUntil: "load" })
await page.screenshot({ path: output, fullPage: true })
await browser.close()

console.log(output)
