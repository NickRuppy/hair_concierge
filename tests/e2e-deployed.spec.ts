import { test, expect } from "@playwright/test"

test.describe("Deployed App E2E Tests", () => {
  // ─── 1. Homepage / Navigation ───────────────────────────────
  test("homepage redirects unauthenticated users to /quiz", async ({
    page,
  }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBeLessThan(500)

    // Middleware redirects unauthenticated users without hc_returning cookie to /quiz
    await page.waitForURL("**/quiz**", { timeout: 15000 })
    expect(page.url()).toContain("/quiz")
  })

  test("homepage does not return 500", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBeLessThan(500)
  })

  // ─── 2. Quiz Page ───────────────────────────────────────────
  test("quiz page loads with landing screen", async ({ page }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(/\/quiz/)

    // Should show the quiz landing content
    await expect(
      page.getByText("FINDE IN 2 MINUTEN HERAUS", { exact: false })
    ).toBeVisible({ timeout: 15000 })

    // "QUIZ STARTEN" button should exist
    await expect(
      page.getByRole("button", { name: /QUIZ STARTEN/i })
    ).toBeVisible()

    // Key bullet points should be present
    await expect(
      page.getByText("Individuelle Analyse", { exact: false })
    ).toBeVisible()
  })

  test("quiz flow: start quiz and navigate through first 4 questions", async ({
    page,
  }) => {
    await page.goto("/quiz", { waitUntil: "networkidle" })
    await expect(
      page.getByText("FINDE IN 2 MINUTEN HERAUS", { exact: false })
    ).toBeVisible({ timeout: 15000 })

    // Click "QUIZ STARTEN" — use force click and wait for transition
    const startButton = page.getByRole("button", { name: /QUIZ STARTEN/i })
    await startButton.waitFor({ state: "visible" })
    await startButton.click()

    // Step 1: Hair texture question (question 1/6)
    await expect(
      page.getByText("HAARTEXTUR", { exact: false })
    ).toBeVisible({ timeout: 15000 })

    // Click "Glatt" option — should auto-advance after 400ms
    await page.getByText("Glatt").first().click()

    // Step 2: Hair thickness (question 2/6)
    await expect(
      page.getByText("WIE DICK SIND DEINE EINZELNEN HAARE?", { exact: false })
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("2/6")).toBeVisible()

    // Click "Mittel"
    await page.getByText("Mittel").first().click()

    // Step 3: Surface test (question 3/6)
    await expect(
      page.getByText("WIE FUEHLT SICH DEIN HAAR AN?", { exact: false })
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("3/6")).toBeVisible()

    // Click "Glatt wie Glas"
    await page.getByText("Glatt wie Glas").click()

    // Step 4: Pull test (question 4/6)
    await expect(
      page.getByText("WIE ELASTISCH IST DEIN HAAR?", { exact: false })
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("4/6")).toBeVisible()
  })

  test("quiz flow: navigate through scalp question progressive disclosure", async ({
    page,
  }) => {
    await page.goto("/quiz", { waitUntil: "networkidle" })
    await expect(
      page.getByRole("button", { name: /QUIZ STARTEN/i })
    ).toBeVisible({ timeout: 15000 })

    // Navigate to scalp question (step 6, question 6/6)
    // Steps: start -> Q1(texture) -> Q2(thickness) -> Q3(surface) -> Q4(pull) -> Q5(chemical) -> Q6(scalp)
    const startBtn = page.getByRole("button", { name: /QUIZ STARTEN/i })
    await startBtn.waitFor({ state: "visible" })
    await startBtn.click()
    // Wait for question title instead of counter (more reliable)
    await expect(
      page.getByText("HAARTEXTUR", { exact: false })
    ).toBeVisible({ timeout: 15000 })

    await page.getByText("Glatt").first().click()
    await expect(page.getByText("2/6")).toBeVisible({ timeout: 10000 })

    await page.getByText("Mittel").first().click()
    await expect(page.getByText("3/6")).toBeVisible({ timeout: 10000 })

    await page.getByText("Glatt wie Glas").click()
    await expect(page.getByText("4/6")).toBeVisible({ timeout: 10000 })

    await page.getByText("Dehnt sich und geht zurueck").click()
    await expect(page.getByText("5/6")).toBeVisible({ timeout: 10000 })

    // Chemical treatment (question 5/6)
    await expect(
      page.getByText("SIND DEINE HAARE CHEMISCH BEHANDELT?", { exact: false })
    ).toBeVisible({ timeout: 10000 })
    await page.locator(".quiz-card", { hasText: "Naturhaar" }).click()
    await page.getByRole("button", { name: /^WEITER$/ }).click()

    // Should be on scalp type question (6/6)
    await expect(page.getByText("6/6")).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByText("ANSAETZE", { exact: false })
    ).toBeVisible({ timeout: 10000 })

    // Select a scalp type — should reveal gate question
    await page.getByText("Ausgeglichen").click()

    // Gate question should appear
    await expect(
      page.getByText("BESCHWERDEN WIE SCHUPPEN", { exact: false })
    ).toBeVisible({ timeout: 5000 })

    // Click "NEIN" to skip condition
    await page
      .getByRole("button", { name: "NEIN" })
      .click()
  })

  test("quiz flow: back button works from question to landing", async ({
    page,
  }) => {
    await page.goto("/quiz", { waitUntil: "networkidle" })
    const startBtn = page.getByRole("button", { name: /QUIZ STARTEN/i })
    await startBtn.waitFor({ state: "visible", timeout: 15000 })

    // Start quiz
    await startBtn.click()

    // Should be on question 1 — wait for the question title
    await expect(
      page.getByText("HAARTEXTUR", { exact: false })
    ).toBeVisible({ timeout: 15000 })

    // Click the back arrow button (the ArrowLeft svg button)
    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-arrow-left") })
      .click()

    // Should go back to landing
    await expect(
      page.getByText("FINDE IN 2 MINUTEN HERAUS", { exact: false })
    ).toBeVisible({ timeout: 10000 })
  })

  // ─── 3. Chat Page ──────────────────────────────────────────
  test("chat page redirects unauthenticated users (no crash)", async ({
    page,
  }) => {
    const response = await page.goto("/chat", {
      waitUntil: "domcontentloaded",
    })
    // Should NOT be a 500 error
    expect(response?.status()).toBeLessThan(500)

    await page.waitForLoadState("networkidle")
    const url = page.url()

    // Unauthenticated: middleware redirects to /quiz (new) or /auth (returning)
    const redirectedToQuiz = url.includes("/quiz")
    const redirectedToAuth = url.includes("/auth")

    expect(redirectedToQuiz || redirectedToAuth).toBe(true)

    if (redirectedToQuiz) {
      await expect(
        page.getByText("FINDE IN 2 MINUTEN HERAUS", { exact: false })
      ).toBeVisible({ timeout: 15000 })
    } else {
      await expect(page.getByText("Hair Concierge")).toBeVisible({ timeout: 15000 })
    }
  })

  // ─── 4. Profile Page ───────────────────────────────────────
  test("profile page redirects unauthenticated users (no crash)", async ({
    page,
  }) => {
    const response = await page.goto("/profile", {
      waitUntil: "domcontentloaded",
    })
    expect(response?.status()).toBeLessThan(500)

    await page.waitForLoadState("networkidle")
    const url = page.url()

    // Unauthenticated: middleware redirects to /quiz (new) or /auth (returning)
    const redirectedToQuiz = url.includes("/quiz")
    const redirectedToAuth = url.includes("/auth")

    expect(redirectedToQuiz || redirectedToAuth).toBe(true)
  })

  // ─── 5. Auth Page ──────────────────────────────────────────
  test("auth page renders login/signup form", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" })

    // Should show the Hair Concierge branding
    await expect(page.getByText("Hair Concierge").first()).toBeVisible({
      timeout: 15000,
    })

    // Should show the subtitle
    await expect(
      page.getByText("Haar-Experte", { exact: false })
    ).toBeVisible()

    // Should show login tab
    await expect(page.getByText("Anmelden").first()).toBeVisible()

    // Should show signup tab
    await expect(page.getByText("Registrieren").first()).toBeVisible()

    // Should show Google login button
    await expect(
      page.getByText("Mit Google anmelden", { exact: false })
    ).toBeVisible()

    // Should show email input
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Should show password input
    await expect(page.locator('input[type="password"]')).toBeVisible()

    // Should show "Passwort vergessen?" link
    await expect(
      page.getByText("Passwort vergessen?", { exact: false })
    ).toBeVisible()

    // Footer with Impressum and Datenschutz
    await expect(page.getByText("Impressum")).toBeVisible()
    await expect(page.getByText("Datenschutz")).toBeVisible()
  })

  test("auth page: switch between login and signup tabs", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "networkidle" })
    await expect(page.getByText("Hair Concierge").first()).toBeVisible({
      timeout: 15000,
    })

    // Click "Registrieren" tab (use role for precision)
    const regTab = page.getByRole("tab", { name: "Registrieren" })
    await regTab.waitFor({ state: "visible" })
    await regTab.click()

    // Wait for the signup panel to render — use tabpanel check
    await expect(
      page.getByRole("button", { name: /Konto erstellen/i })
    ).toBeVisible({ timeout: 10000 })

    // Signup form should show 2 password fields (password + confirm)
    const passwordInputs = page.locator('input[type="password"]')
    await expect(passwordInputs).toHaveCount(2, { timeout: 5000 })

    // Click back to "Anmelden" tab
    await page.getByRole("tab", { name: "Anmelden" }).click()

    // Wait for login panel
    await expect(
      page.getByText("Passwort vergessen?", { exact: false })
    ).toBeVisible({ timeout: 10000 })

    // Should show single password field
    await expect(passwordInputs).toHaveCount(1, { timeout: 5000 })
  })

  // ─── 6. No Uncaught Errors ─────────────────────────────────
  test("no unhandled JS errors on quiz page", async ({ page }) => {
    const pageErrors: string[] = []
    page.on("pageerror", (err) => pageErrors.push(err.message))

    await page.goto("/quiz", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    if (pageErrors.length > 0) {
      console.log("Page errors on /quiz:", pageErrors)
    }
    expect(pageErrors.length).toBe(0)
  })

  test("no unhandled JS errors on auth page", async ({ page }) => {
    const pageErrors: string[] = []
    page.on("pageerror", (err) => pageErrors.push(err.message))

    await page.goto("/auth", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    if (pageErrors.length > 0) {
      console.log("Page errors on /auth:", pageErrors)
    }
    expect(pageErrors.length).toBe(0)
  })

  test("no unhandled JS errors during quiz interaction", async ({ page }) => {
    const pageErrors: string[] = []
    page.on("pageerror", (err) => pageErrors.push(err.message))

    await page.goto("/quiz", { waitUntil: "networkidle" })
    const startBtnErr = page.getByRole("button", { name: /QUIZ STARTEN/i })
    await startBtnErr.waitFor({ state: "visible", timeout: 15000 })
    await startBtnErr.click()
    await expect(
      page.getByText("HAARTEXTUR", { exact: false })
    ).toBeVisible({ timeout: 15000 })

    await page.getByText("Glatt").first().click()
    await expect(page.getByText("2/7")).toBeVisible({ timeout: 10000 })

    await page.getByText("Mittel").first().click()
    await expect(page.getByText("3/7")).toBeVisible({ timeout: 10000 })

    await page.waitForTimeout(1000)

    if (pageErrors.length > 0) {
      console.log("Page errors during quiz interaction:", pageErrors)
    }
    expect(pageErrors.length).toBe(0)
  })
})
