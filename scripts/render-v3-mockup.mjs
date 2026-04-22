import { chromium } from "playwright"
import path from "path"
import fs from "fs"

const OUT = path.resolve("ux-audits/2026-04-21-profile-page/screenshots")
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const file = `file://${path.resolve("docs/mockups/profile-editorial-v3-applied.html")}`

await page.goto(file)
await page.waitForTimeout(700)
await page.screenshot({ path: path.join(OUT, "99-v3-applied-desktop.png"), fullPage: true })

await page.setViewportSize({ width: 375, height: 812 })
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(OUT, "99-v3-applied-mobile.png"), fullPage: true })

await browser.close()
console.log("DONE")
