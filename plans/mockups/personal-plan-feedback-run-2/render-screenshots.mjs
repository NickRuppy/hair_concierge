import { chromium } from "playwright"
import path from "node:path"
import { fileURLToPath } from "node:url"

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = `file://${path.join(dir, "index.html")}`
const out = path.join(dir, "screenshots")

const shots = [
  { variant: "a", viewport: "desktop", width: 1280, height: 860 },
  { variant: "a", viewport: "mobile", width: 390, height: 844 },
  { variant: "b", viewport: "desktop", width: 1280, height: 860 },
  { variant: "b", viewport: "mobile", width: 390, height: 844 },
  { variant: "c", viewport: "desktop", width: 1280, height: 860 },
  { variant: "c", viewport: "mobile", width: 390, height: 844 },
  { variant: "d", viewport: "desktop", width: 1280, height: 860 },
  { variant: "d", viewport: "mobile", width: 390, height: 844 },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

for (const shot of shots) {
  await page.setViewportSize({ width: shot.width, height: shot.height })
  await page.goto(`${html}?variant=${shot.variant}`, { waitUntil: "load" })
  await page.waitForTimeout(250)
  await page.screenshot({
    path: path.join(out, `variant-${shot.variant}-${shot.viewport}.png`),
    fullPage: true,
  })
}

await browser.close()

for (const shot of shots) {
  console.log(path.join(out, `variant-${shot.variant}-${shot.viewport}.png`))
}
