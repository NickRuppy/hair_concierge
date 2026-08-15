import { chromium } from "playwright"

const baseUrl = "http://127.0.0.1:3225/labs/personal-plan-stage-2?scenario=ready"
const outputDir = "plans/mockups/frequency-slider-alignment"
const labels = [
  ["<1×/", "Monat"],
  ["1×/", "Monat"],
  ["Alle 2", "Wochen"],
  ["1×/", "Woche"],
  ["2×/", "Woche"],
  ["3–4×/", "Woche"],
  ["5–6×/", "Woche"],
  ["1×/", "Tag"],
]

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

  await page.locator('[role="slider"] + div > button').evaluateAll((buttons, nextLabels) => {
    buttons.forEach((button, index) => {
      const [top, bottom] = nextLabels[index]
      button.innerHTML = `<span>${top}</span><span>${bottom}</span>`
    })
  }, labels)
  await page.addStyleTag({
    content: `
      [role="slider"] + div {
        display: block !important;
        position: relative !important;
        height: 2.75rem;
      }
      [role="slider"] + div > button {
        position: absolute;
        top: 0;
        width: 12%;
        max-width: none;
        transform: translateX(-50%);
        padding: .2rem 0;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.15;
        color: #6a6560;
        white-space: nowrap;
      }
      [role="slider"] + div > button > span { display: block; }
      [role="slider"] + div > button:nth-child(1) { left: 0%; }
      [role="slider"] + div > button:nth-child(2) { left: 14.2857%; }
      [role="slider"] + div > button:nth-child(3) { left: 28.5714%; }
      [role="slider"] + div > button:nth-child(4) { left: 42.8571%; color: #6b50a0; font-weight: 800; }
      [role="slider"] + div > button:nth-child(5) { left: 57.1429%; }
      [role="slider"] + div > button:nth-child(6) { left: 71.4286%; }
      [role="slider"] + div > button:nth-child(7) { left: 85.7143%; }
      [role="slider"] + div > button:nth-child(8) { left: 100%; }
      @media (max-width: 639px) {
        [role="slider"] + div > button { font-size: 11px; }
      }
    `,
  })
  await page.screenshot({ path: `${outputDir}/simple-wrap-${viewport.name}.png`, fullPage: true })
  await page.close()
}

await browser.close()
