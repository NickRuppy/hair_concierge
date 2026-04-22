import { chromium } from "playwright"
import fs from "fs"
import path from "path"

const BASE_URL = "http://localhost:3761"
const OUT_DIR = path.resolve("ux-audits/2026-04-21-profile-page/screenshots")
fs.mkdirSync(OUT_DIR, { recursive: true })

const TEST_EMAIL = "ux-audit-test@hairconscierge.test"
const TEST_PASSWORD = "uxAudit!Test123"

async function tryAuth(page) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" })
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL(/.*\/(chat|profile|onboarding).*/, { timeout: 10000 })
    return true
  } catch {
    return false
  }
}

async function captureProfile(page, viewport, label) {
  await page.setViewportSize(viewport)
  await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" }).catch(() => {})
  // wait for async data loads
  await page.waitForTimeout(3500)

  const finalUrl = page.url()

  await page.screenshot({
    path: path.join(OUT_DIR, `01-${label}-top.png`),
    fullPage: false,
  })

  await page.screenshot({
    path: path.join(OUT_DIR, `02-${label}-fullpage.png`),
    fullPage: true,
  })

  // Expand all sections (click all buttons with aria-expanded=false)
  const expanded = await page.evaluate(() => {
    const collapsed = [...document.querySelectorAll("[aria-expanded='false']")]
    collapsed.forEach((el) => el.click())
    return collapsed.length
  })
  await page.waitForTimeout(1000)

  await page.screenshot({
    path: path.join(OUT_DIR, `03-${label}-all-expanded.png`),
    fullPage: true,
  })

  const dom = await page.evaluate(() => {
    const texts = []
    document.querySelectorAll("h1, h2, h3, button, [role='button']").forEach((el) => {
      const t = el.textContent?.trim()
      if (t && t.length < 200) texts.push({ tag: el.tagName, text: t })
    })
    return {
      title: document.title,
      url: location.href,
      headingsAndButtons: texts.slice(0, 120),
      collapsibleCount: document.querySelectorAll("[aria-expanded]").length,
      expandedNow: document.querySelectorAll("[aria-expanded='true']").length,
      skeletonCount: document.querySelectorAll(".animate-pulse, [class*='skeleton']").length,
    }
  })

  return { viewport: label, finalUrl, expandedClicked: expanded, dom }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  const authOk = await tryAuth(page)
  console.log("AUTH_OK=" + authOk + " url=" + page.url())

  const mobile = await captureProfile(page, { width: 375, height: 812 }, "mobile")
  const desktop = await captureProfile(page, { width: 1440, height: 900 }, "desktop")

  // Capture mockup for side-by-side.
  await page.goto(`file://${path.resolve("docs/mockups/profile-editorial-v2.html")}`)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(700)
  await page.screenshot({
    path: path.join(OUT_DIR, "00-mockup-desktop-fullpage.png"),
    fullPage: true,
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(700)
  await page.screenshot({
    path: path.join(OUT_DIR, "00-mockup-mobile-fullpage.png"),
    fullPage: true,
  })

  fs.writeFileSync(
    path.join(path.dirname(OUT_DIR), "inspection.json"),
    JSON.stringify({ authOk, mobile, desktop }, null, 2),
  )

  await browser.close()
  console.log("DONE")
})()
