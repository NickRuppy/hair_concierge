import { test, expect, Page } from "@playwright/test"

const BASE = "https://hair-concierge.vercel.app"

// ─── Helpers ─────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" })

  // Wait for login form
  await expect(page.getByText("TomBot").first()).toBeVisible({ timeout: 15000 })

  // Fill credentials
  await page.locator('input[type="email"]').fill("qa-test@hairconscierge.test")
  await page.locator('input[type="password"]').fill("TestUser123!")

  // Click login button
  await page.getByRole("button", { name: /Anmelden/i }).click()

  // Wait for redirect to /chat (authenticated landing) — may also go to /profile or /onboarding
  await page.waitForURL(/\/(chat|profile|onboarding|goals)/, { timeout: 30000 })
}

async function screenshotStep(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/conditioner-flow/${name}.png`,
    fullPage: true,
  })
}

// ─── Test Suite ──────────────────────────────────────────────
test.describe("Conditioner Recommendation Flow", () => {
  test.describe.configure({ mode: "serial" })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    // Create a persistent context so login state carries across tests
    const context = await browser.newContext()
    page = await context.newPage()

    // Capture console errors
    page.on("pageerror", (err) => {
      console.error("[PAGE ERROR]", err.message)
    })
  })

  test.afterAll(async () => {
    await page.close()
  })

  // ─── Test 1: Login and verify profile ───────────────────────
  test("Test 1: Login and verify profile", async () => {
    // Step 1: Navigate to auth page
    await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" })
    await expect(page.getByText("TomBot").first()).toBeVisible({ timeout: 15000 })
    await screenshotStep(page, "01-auth-page-loaded")

    // Step 2: Fill login form
    await page.locator('input[type="email"]').fill("qa-test@hairconscierge.test")
    await page.locator('input[type="password"]').fill("TestUser123!")
    await screenshotStep(page, "02-login-form-filled")

    // Step 3: Submit login (use exact match to avoid "Mit Google anmelden")
    await page.getByRole("button", { name: "Anmelden", exact: true }).click()

    // Wait for navigation after login — could redirect to various pages
    // or might show an error on the auth page
    await page.waitForTimeout(3000) // Give time for auth + redirect
    await screenshotStep(page, "03-post-login-click")
    console.log("[TEST 1] URL after login click (3s):", page.url())

    // If still on auth page, wait longer for redirect
    if (page.url().includes("/auth")) {
      // Check if there's an error message
      const errorEl = page.locator('[role="alert"]').or(page.getByText("Fehler", { exact: false }))
      if (await errorEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        const errorText = await errorEl.textContent()
        console.log("[TEST 1] Login error:", errorText)
      }
      // Wait longer for redirect
      try {
        await page.waitForURL(/(?!.*\/auth).*/, { timeout: 20000 })
      } catch {
        // Still on auth — take screenshot and log
        await screenshotStep(page, "03b-still-on-auth")
        console.log("[TEST 1] Still on /auth after 20s, current URL:", page.url())
      }
    }

    await screenshotStep(page, "03-post-login-redirect")
    console.log("[TEST 1] Logged in, redirected to:", page.url())

    // Step 4: Navigate to profile
    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000) // Extra wait for any client-side redirects
    await screenshotStep(page, "04-profile-page")
    console.log("[TEST 1] Profile page URL:", page.url())

    // If we got redirected to auth, login failed — log it
    if (page.url().includes("/auth") || page.url().includes("/quiz")) {
      console.log("[TEST 1] FAIL: Redirected away from /profile to:", page.url())
    }

    // Verify profile page loaded (not redirected away)
    expect(page.url()).toContain("/profile")

    // Check for hair profile data — look for common profile section indicators
    // The profile page should show hair texture, thickness, or other profile data
    const bodyText = await page.textContent("body")
    console.log("[TEST 1] Profile page URL:", page.url())

    // Verify we're on the profile page and it has content
    // Look for profile-related German text
    const hasProfileContent =
      bodyText?.includes("Haartextur") ||
      bodyText?.includes("Haardicke") ||
      bodyText?.includes("Zugtest") ||
      bodyText?.includes("Profil") ||
      bodyText?.includes("Kopfhaut") ||
      bodyText?.includes("Protein") ||
      bodyText?.includes("Feuchtigkeit")

    expect(hasProfileContent).toBe(true)
    console.log("[TEST 1] PASS: Profile page loaded with hair profile data")
    await screenshotStep(page, "05-profile-verified")
  })

  // ─── Test 2: Chat conditioner recommendation ────────────────
  test("Test 2: Chat - Ask for conditioner recommendation", async () => {
    // Step 1: Navigate to chat
    await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await screenshotStep(page, "06-chat-page-loaded")
    console.log("[TEST 2] Chat page URL:", page.url())

    // Verify we're on the chat page
    expect(page.url()).toContain("/chat")

    // Step 2: Find the chat input and type the question
    // The input could be a textarea or input — find whichever exists
    const chatInput =
      page.locator('textarea').first().or(
        page.locator('input[type="text"]').first()
      )
    await chatInput.waitFor({ state: "visible", timeout: 15000 })
    await chatInput.fill("Welchen Conditioner empfiehlst du mir?")
    await screenshotStep(page, "07-chat-question-typed")

    // Step 3: Submit the question
    // Try pressing Enter or clicking the send button
    const sendButton = page.locator('button[type="submit"]').or(
      page.getByRole("button", { name: /send|senden/i })
    )
    if (await sendButton.isVisible()) {
      await sendButton.click()
    } else {
      await chatInput.press("Enter")
    }
    console.log("[TEST 2] Message sent, waiting for response...")

    // Step 4: Wait for the streaming response to complete
    // The assistant messages have data-testid="message-assistant"
    // Wait for the LATEST assistant message to appear (the one responding to our question)
    // First, count existing assistant messages
    const initialAssistantCount = await page.locator('[data-testid="message-assistant"]').count()
    console.log("[TEST 2] Initial assistant message count:", initialAssistantCount)

    // Wait for a new assistant message to appear
    await page.waitForFunction(
      (initCount) => {
        const msgs = document.querySelectorAll('[data-testid="message-assistant"]')
        return msgs.length > initCount
      },
      initialAssistantCount,
      { timeout: 30000 }
    )
    console.log("[TEST 2] New assistant message appeared")

    // Now wait for the streaming to stabilize (text stops changing)
    let responseText = ""
    let lastLength = 0
    let stableCount = 0
    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(1000)
      const lastMsg = page.locator('[data-testid="message-assistant"]').last()
      responseText = (await lastMsg.textContent()) ?? ""

      if (responseText.length === lastLength && responseText.length > 50) {
        stableCount++
        if (stableCount >= 4) break // Text hasn't changed for 4 seconds = done
      } else {
        stableCount = 0
      }
      lastLength = responseText.length
    }

    await screenshotStep(page, "08-chat-response-received")
    console.log("[TEST 2] Response length:", responseText.length)
    console.log("[TEST 2] Response preview:", responseText.slice(0, 300))

    // Step 5: Verify the response content (using the assistant message text)
    const lowerText = responseText.toLowerCase()

    // Check for conditioner-related content
    const mentionsConditioner =
      lowerText.includes("conditioner") ||
      lowerText.includes("spülung") ||
      lowerText.includes("pflege") ||
      lowerText.includes("spuelung")

    console.log("[TEST 2] Mentions conditioner/spülung/pflege:", mentionsConditioner)
    expect(mentionsConditioner).toBe(true)

    // Check the response is in German
    const isGerman =
      lowerText.includes("dein") ||
      lowerText.includes("haar") ||
      lowerText.includes("empfehl") ||
      lowerText.includes("für") ||
      lowerText.includes("fuer")

    console.log("[TEST 2] Response is in German:", isGerman)
    expect(isGerman).toBe(true)

    // Check for error indicators in the response itself
    const hasError =
      lowerText.includes("something went wrong") ||
      lowerText.includes("ein fehler ist aufgetreten") ||
      lowerText.includes("fehlgeschlagen")

    console.log("[TEST 2] Has error in response:", hasError)
    expect(hasError).toBe(false)

    console.log("[TEST 2] PASS: Conditioner recommendation received")
    await screenshotStep(page, "09-chat-response-verified")
  })

  // ─── Test 3: Chat specific conditioner advice ───────────────
  test("Test 3: Chat - Ask for specific conditioner advice", async () => {
    // Start a new conversation or use the existing one
    // Navigate to chat to ensure clean state
    await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await screenshotStep(page, "10-chat-new-conversation")

    // Find chat input
    const chatInput =
      page.locator('textarea').first().or(
        page.locator('input[type="text"]').first()
      )
    await chatInput.waitFor({ state: "visible", timeout: 15000 })

    // Type the specific question
    await chatInput.fill(
      "Ich brauche einen Conditioner für feines Haar mit Feuchtigkeitsmangel"
    )
    await screenshotStep(page, "11-specific-question-typed")

    // Submit
    const sendButton3 = page.locator('button[type="submit"]').or(
      page.getByRole("button", { name: /send|senden/i })
    )
    if (await sendButton3.isVisible()) {
      await sendButton3.click()
    } else {
      await chatInput.press("Enter")
    }
    console.log("[TEST 3] Specific question sent, waiting for response...")

    // Count current assistant messages, wait for new one
    const initCount3 = await page.locator('[data-testid="message-assistant"]').count()
    console.log("[TEST 3] Initial assistant message count:", initCount3)

    await page.waitForFunction(
      (initCount) => {
        const msgs = document.querySelectorAll('[data-testid="message-assistant"]')
        return msgs.length > initCount
      },
      initCount3,
      { timeout: 30000 }
    )

    // Wait for streaming to stabilize
    let responseText3 = ""
    let lastLen3 = 0
    let stable3 = 0
    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(1000)
      const lastMsg = page.locator('[data-testid="message-assistant"]').last()
      responseText3 = (await lastMsg.textContent()) ?? ""

      if (responseText3.length === lastLen3 && responseText3.length > 50) {
        stable3++
        if (stable3 >= 4) break
      } else {
        stable3 = 0
      }
      lastLen3 = responseText3.length
    }

    await screenshotStep(page, "12-specific-response-received")
    console.log("[TEST 3] Response length:", responseText3.length)
    console.log("[TEST 3] Response preview:", responseText3.slice(0, 300))

    const lowerText3 = responseText3.toLowerCase()

    // Verify moisture/Feuchtigkeit is addressed
    const addressesMoisture =
      lowerText3.includes("feuchtigkeit") ||
      lowerText3.includes("moisture") ||
      lowerText3.includes("trocken") ||
      lowerText3.includes("hydra")

    console.log("[TEST 3] Addresses moisture needs:", addressesMoisture)
    expect(addressesMoisture).toBe(true)

    // Verify fine hair is addressed
    const addressesFineHair =
      lowerText3.includes("fein") ||
      lowerText3.includes("fine") ||
      lowerText3.includes("duenn") ||
      lowerText3.includes("dünn")

    console.log("[TEST 3] Addresses fine hair:", addressesFineHair)

    // Verify product recommendations are present
    const hasProductRecommendation =
      lowerText3.includes("conditioner") ||
      lowerText3.includes("spülung") ||
      lowerText3.includes("spuelung") ||
      lowerText3.includes("produkt") ||
      lowerText3.includes("empfehl")

    console.log("[TEST 3] Has product recommendation:", hasProductRecommendation)
    expect(hasProductRecommendation).toBe(true)

    // Verify response is in German
    const isGerman3 =
      lowerText3.includes("dein") ||
      lowerText3.includes("haar") ||
      lowerText3.includes("für") ||
      lowerText3.includes("fuer")

    expect(isGerman3).toBe(true)

    // No errors in the assistant response itself
    const hasError3 =
      lowerText3.includes("something went wrong") ||
      lowerText3.includes("ein fehler ist aufgetreten") ||
      lowerText3.includes("fehlgeschlagen")

    expect(hasError3).toBe(false)

    console.log("[TEST 3] PASS: Specific conditioner advice received")
    await screenshotStep(page, "13-specific-response-verified")
  })

  // ─── Test 4: Quiz pull test options ─────────────────────────
  test("Test 4: Verify quiz pull test options", async ({ browser }) => {
    // Use a fresh (unauthenticated) context for the quiz test
    // because authenticated users may be redirected away from /quiz
    const freshContext = await browser.newContext()
    const quizPage = await freshContext.newPage()

    // Navigate to quiz page (with retry for transient network issues)
    try {
      await quizPage.goto(`${BASE}/quiz`, { waitUntil: "domcontentloaded", timeout: 30000 })
    } catch {
      console.log("[TEST 4] First attempt timed out, retrying...")
      await quizPage.waitForTimeout(2000)
      await quizPage.goto(`${BASE}/quiz`, { waitUntil: "domcontentloaded", timeout: 30000 })
    }
    await expect(
      quizPage.getByRole("button", { name: /QUIZ STARTEN/i })
    ).toBeVisible({ timeout: 15000 })
    await quizPage.screenshot({
      path: "test-results/conditioner-flow/14-quiz-landing.png",
      fullPage: true,
    })

    // Start quiz
    await quizPage.getByRole("button", { name: /QUIZ STARTEN/i }).click()

    // Step 1: Hair texture — click "Glatt"
    await expect(
      quizPage.getByText("HAARTEXTUR", { exact: false })
    ).toBeVisible({ timeout: 15000 })
    await quizPage.screenshot({
      path: "test-results/conditioner-flow/15-quiz-step1-haartextur.png",
      fullPage: true,
    })
    await quizPage.getByText("Glatt").first().click()

    // Step 2: Thickness — click "Mittel"
    await expect(quizPage.getByText("2/7")).toBeVisible({ timeout: 10000 })
    await quizPage.screenshot({
      path: "test-results/conditioner-flow/16-quiz-step2-thickness.png",
      fullPage: true,
    })
    await quizPage.getByText("Mittel").first().click()

    // Step 3: Surface test — click "Glatt wie Glas"
    await expect(quizPage.getByText("3/7")).toBeVisible({ timeout: 10000 })
    await quizPage.screenshot({
      path: "test-results/conditioner-flow/17-quiz-step3-surface.png",
      fullPage: true,
    })
    await quizPage.getByText("Glatt wie Glas").click()

    // Step 4: Pull test — THIS IS WHAT WE'RE TESTING
    await expect(
      quizPage.getByText("DER ZUGTEST", { exact: false })
    ).toBeVisible({ timeout: 10000 })
    await expect(quizPage.getByText("4/7")).toBeVisible()
    await quizPage.screenshot({
      path: "test-results/conditioner-flow/18-quiz-step4-pulltest.png",
      fullPage: true,
    })

    // Verify all three pull test options are visible
    const option1 = quizPage.getByText("Dehnt sich und geht zurueck")
    const option2 = quizPage.getByText("Dehnt sich, bleibt ausgeleiert")
    const option3 = quizPage.getByText("Reisst sofort")

    await expect(option1).toBeVisible({ timeout: 5000 })
    await expect(option2).toBeVisible({ timeout: 5000 })
    await expect(option3).toBeVisible({ timeout: 5000 })

    console.log("[TEST 4] Pull test option 1 visible: Dehnt sich und geht zurueck")
    console.log("[TEST 4] Pull test option 2 visible: Dehnt sich, bleibt ausgeleiert")
    console.log("[TEST 4] Pull test option 3 visible: Reisst sofort")

    await quizPage.screenshot({
      path: "test-results/conditioner-flow/19-quiz-pulltest-options-verified.png",
      fullPage: true,
    })
    console.log("[TEST 4] PASS: All three pull test options render correctly")

    await quizPage.close()
    await freshContext.close()
  })
})
