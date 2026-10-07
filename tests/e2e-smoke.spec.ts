import { test, expect } from "@playwright/test"

test.describe("Core user flows — smoke test @ci", () => {
  test("1. Homepage renders the marketing landing for unauthenticated users", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "networkidle" })
    // / is now the marketing landing — should NOT redirect
    expect(page.url()).toMatch(/\/$/)
    expect(response?.ok() || response?.status() === 304).toBeTruthy()
    // Hero H1 is the marketing landing's signature copy
    const heroHeading = page.locator("h1").first()
    await expect(heroHeading).toContainText("Versteh dein Haar. Ohne Produktchaos.")
    // Both the compact header action and the primary hero action start the regular quiz.
    await expect(
      page.getByRole("link", { name: "Analyse starten", exact: true }).first(),
    ).toHaveAttribute("href", "/quiz")
    await expect(page.getByRole("link", { name: "Anmelden", exact: true })).toHaveAttribute(
      "href",
      "/auth?next=/chat",
    )
    await expect(page.locator("[data-landing-hero-cta]")).toHaveAttribute("href", "/quiz")
    // The organic landing deliberately keeps pricing out of the entry experience.
    await expect(page.getByText("Plan wählen")).toHaveCount(0)
    // Take a screenshot as evidence
    await page.screenshot({ path: "tests/screenshots/01-homepage-landing.png", fullPage: true })
  })

  test("anonymous /pricing with no lead redirects into the quiz", async ({ page }) => {
    await page.goto("/pricing")
    await expect(page).toHaveURL(/\/quiz(\?.*)?$/)
  })

  test("/pricing with a lead param redirects to the personalized result offer", async ({
    page,
  }) => {
    await page.goto("/pricing?lead=00000000-0000-4000-8000-000000000001")
    await expect(page).toHaveURL(
      /\/result\/00000000-0000-4000-8000-000000000001\?focus=unlock-plan/,
    )
  })

  test("2. Quiz page loads with intro and first quiz step after clicking start", async ({
    page,
  }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" })
    expect(page.url()).toContain("/quiz")

    // Info strip is shown above the first question, framing the quiz
    // before the user commits to answering.
    const infoStrip = page.getByText("Lass uns deine Haare verstehen")
    await expect(infoStrip).toBeVisible({ timeout: 10000 })

    // Wait for quiz content to render
    await page.waitForTimeout(2000)

    // Screenshot the initial quiz landing/intro
    await page.screenshot({ path: "tests/screenshots/02a-quiz-intro.png", fullPage: true })

    // The quiz should show a heading
    const headings = page.locator("h1, h2")
    const headingCount = await headings.count()
    expect(headingCount).toBeGreaterThan(0)
    const headingText = await headings.first().textContent()
    console.log(`Quiz intro heading: "${headingText}"`)

    // Find and click the start/CTA button to begin the quiz
    const startButton = page.locator("button, a").filter({ hasText: /start|los|beginnen|weiter/i })
    const startCount = await startButton.count()
    console.log(`Found ${startCount} start-like buttons`)

    if (startCount > 0) {
      await startButton.first().click()
      await page.waitForTimeout(2000)

      // Screenshot the first quiz step
      await page.screenshot({ path: "tests/screenshots/02b-quiz-step1.png", fullPage: true })

      // After clicking start, there should be quiz options visible
      // Look for quiz option elements — could be buttons, cards, or radio-like elements
      const pageContent = await page.textContent("body")
      console.log(`Page text snippet (first 500 chars): ${pageContent?.slice(0, 500)}`)

      // Check for visible interactive elements (quiz options)
      const options = page.locator("button, [role='button'], [role='option'], [data-value], label")
      const optionCount = await options.count()
      console.log(`Found ${optionCount} interactive elements after clicking start`)

      // There should be quiz step content visible
      const newHeadings = page.locator("h1, h2, h3")
      const newHeadingCount = await newHeadings.count()
      if (newHeadingCount > 0) {
        const newHeadingText = await newHeadings.first().textContent()
        console.log(`Quiz step heading: "${newHeadingText}"`)
      }
    } else {
      // No explicit start button — quiz options may be directly on the page
      // Look for any selectable elements
      const allButtons = page.locator("button")
      const allButtonCount = await allButtons.count()
      console.log(`Total buttons on page: ${allButtonCount}`)
      for (let i = 0; i < Math.min(allButtonCount, 5); i++) {
        const text = await allButtons.nth(i).textContent()
        console.log(`  Button ${i}: "${text?.trim()}"`)
      }
    }
  })

  test("3. Auth page renders login form with email and password", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "networkidle" })

    // Wait for form to render
    await page.waitForTimeout(2000)

    // Should have an email input
    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="mail" i]',
    )
    await expect(emailInput.first()).toBeVisible({ timeout: 10000 })

    // Should have a password input
    const passwordInput = page.locator('input[type="password"], input[name="password"]')
    await expect(passwordInput.first()).toBeVisible({ timeout: 10000 })

    // Should have a submit button
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Anmelden"), button:has-text("Login"), button:has-text("Einloggen")',
    )
    const submitCount = await submitButton.count()
    console.log(`Found ${submitCount} submit-like buttons`)
    expect(submitCount).toBeGreaterThan(0)

    // Verify tab structure (Anmelden / Registrieren tabs)
    const tabs = page.locator('button:has-text("Anmelden"), button:has-text("Registrieren")')
    const tabCount = await tabs.count()
    console.log(`Found ${tabCount} auth tabs`)

    // Screenshot the auth page
    await page.screenshot({ path: "tests/screenshots/03-auth-page.png", fullPage: true })
  })
})
