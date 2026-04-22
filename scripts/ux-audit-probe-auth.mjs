import { chromium } from "playwright"
import path from "path"
import fs from "fs"

const BASE_URL = "http://localhost:3761"
const OUT_DIR = path.resolve("ux-audits/2026-04-21-profile-page/screenshots")

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" })
  await page.screenshot({ path: path.join(OUT_DIR, "auth-page-desktop.png"), fullPage: true })

  const snap = await page.evaluate(() => ({
    url: location.href,
    html: document.body.innerText.slice(0, 2000),
    buttons: [...document.querySelectorAll("button,a")].map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 40),
    inputs: [...document.querySelectorAll("input")].map((i) => ({ type: i.type, name: i.name, placeholder: i.placeholder })),
  }))
  fs.writeFileSync(path.join(path.dirname(OUT_DIR), "auth-probe.json"), JSON.stringify(snap, null, 2))

  await browser.close()
})()
