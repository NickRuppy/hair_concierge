import { chromium } from "playwright"

const baseUrl = "http://127.0.0.1:3225/labs/personal-plan-stage-2?scenario=ready"
const outputDir = "plans/mockups/frequency-slider-alignment"
const browser = await chromium.launch()

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  const page = await browser.newPage({ viewport })
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
  })
  await page.goto(baseUrl)
  await page.getByRole("button", { name: /Feinschliff starten/ }).click()
  await page.getByRole("button", { name: "Shampoo", exact: true }).click()
  await page.getByRole("button", { name: "Weiter", exact: true }).click()
  await page.getByRole("heading", { name: "Wie oft wäschst du deine Haare nass?" }).waitFor()
  await page.getByRole("button", { name: "1×/Woche", exact: true }).click()
  await page.screenshot({
    path: `${outputDir}/implemented-${viewport.name}.png`,
    fullPage: true,
    animations: "disabled",
  })
  await page.close()
}

await browser.close()
