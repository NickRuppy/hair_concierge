import { expect, test, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for mobile UX tests",
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function completeQuizToConcerns(page: Page) {
  await page.goto(`${baseUrl}/quiz`, { waitUntil: "networkidle" })

  await page.getByRole("button", { name: /QUIZ STARTEN/i }).click()
  await page.getByText("Wellig").first().click()
  await page.getByText("Mittel").first().click()
  await page.getByText("Leicht uneben").click()
  await page.getByText("Dehnt sich, bleibt ausgeleiert").click()

  await page.locator(".quiz-card", { hasText: "Naturhaar" }).click()
  await page.locator(".quiz-card", { hasText: "Gefärbt / Getönt" }).click()
  await page.getByRole("button", { name: /^Weiter$/i }).click()

  await page
    .locator(".quiz-card")
    .filter({ has: page.getByText(/^Trocken$/) })
    .click()
  await page.getByRole("button", { name: "NEIN" }).click()

  await expect(page.getByRole("heading", { name: /Welche Haarprobleme/i })).toBeVisible()
}

async function quizScrollPaneTop(page: Page) {
  return page.evaluate(() => {
    const panes = Array.from(document.querySelectorAll<HTMLElement>(".overflow-y-auto"))
    const pane = panes.find((element) => element.scrollHeight > element.clientHeight)
    return Math.max(pane?.scrollTop ?? 0, window.scrollY)
  })
}

function expectBoxInsideViewport(
  box: { x: number; y: number; width: number; height: number } | null,
  viewport: { width: number; height: number },
) {
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
}

const mobileViewports = [
  { name: "small", label: "375x667", viewport: { width: 375, height: 667 } },
  { name: "regular", label: "390x844", viewport: { width: 390, height: 844 } },
]

for (const mobileViewport of mobileViewports) {
  test.describe.serial(`mobile UX regressions (${mobileViewport.label})`, () => {
    test.use({
      viewport: mobileViewport.viewport,
      isMobile: true,
      hasTouch: true,
    })

    const email = `playwright-mobile-${mobileViewport.name}-${Date.now()}@hairconscierge.test`
    const password = "Playwright123!"
    let userId: string | null = null

    test.beforeAll(async () => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Mobile UX" },
      })

      if (error) throw error
      userId = data.user?.id ?? null
      if (!userId) throw new Error("Failed to create mobile UX user")

      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: userId,
          email,
          full_name: "Mobile UX",
          onboarding_completed: true,
          onboarding_step: "celebration",
          subscription_status: "active",
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "id" },
      )
      if (profileError) throw profileError

      const { error: hairProfileError } = await admin.from("hair_profiles").upsert(
        {
          user_id: userId,
          hair_texture: "wavy",
          thickness: "fine",
          density: "medium",
          concerns: ["frizz"],
          cuticle_condition: "rough",
          protein_moisture_balance: "stretches_bounces",
          scalp_type: "balanced",
          scalp_condition: null,
          chemical_treatment: ["colored"],
          goals: ["less_frizz"],
          desired_volume: "balanced",
          wash_frequency: "every_2_3_days",
          heat_styling: "never",
          styling_tools: [],
          night_protection: [],
          uses_heat_protection: false,
        },
        { onConflict: "user_id" },
      )
      if (hairProfileError) throw hairProfileError
    })

    test.afterAll(async () => {
      if (!userId) return

      await admin.from("user_product_usage").delete().eq("user_id", userId)
      await admin.from("hair_profiles").delete().eq("user_id", userId)
      await admin.from("profiles").delete().eq("id", userId)
      await admin.auth.admin.deleteUser(userId)
    })

    test("quiz step changes reset the mobile scroll pane and focus the new heading", async ({
      page,
    }) => {
      await completeQuizToConcerns(page)

      const scrollTopBefore = await page.evaluate(() => {
        const panes = Array.from(document.querySelectorAll<HTMLElement>(".overflow-y-auto"))
        const pane = panes.find((element) => element.scrollHeight > element.clientHeight)
        pane?.scrollTo({ top: pane.scrollHeight })
        window.scrollTo({ top: document.documentElement.scrollHeight })
        return Math.max(pane?.scrollTop ?? 0, window.scrollY)
      })

      expect(scrollTopBefore).toBeGreaterThan(0)

      await page.getByText("Trockenheit").click()
      await page.getByText("Frizz").click()
      await page.getByRole("button", { name: /^Weiter$/i }).click()

      const goalsHeading = page.getByRole("heading", { name: /Deine Haarziele/i })
      await expect(goalsHeading).toBeVisible()
      await expect.poll(() => quizScrollPaneTop(page)).toBe(0)

      const headingBox = await goalsHeading.boundingBox()
      expect(headingBox).not.toBeNull()
      expect(headingBox!.y).toBeGreaterThanOrEqual(0)
      expect(headingBox!.y).toBeLessThanOrEqual(200)

      const activeElementText = await page.evaluate(() => document.activeElement?.textContent ?? "")
      expect(activeElementText).toContain("Was sind deine Haarziele?")
    })

    test("chat keeps long input, product cards, and feedback controls inside mobile bounds", async ({
      page,
    }) => {
      await page.route("**/api/chat", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ conversations: [] }),
          })
          return
        }

        const events = [
          { type: "conversation_id", data: "mobile-conversation" },
          {
            type: "content_delta",
            data: "Nimm zuerst ein leichtes Leave-in und prüfe danach, ob die Längen weicher fallen.",
          },
          {
            type: "product_recommendations",
            data: [
              {
                id: "product-mobile-1",
                name: "Ultra Lightweight Frizz Control Leave-in Conditioner With Long Name",
                brand: "Chaarlie",
                category: "leave_in",
                price_eur: 18.9,
                recommendation_meta: {
                  top_reasons: [
                    "Leicht genug für feines Haar mit sehr langer Begründung ohne Layoutbruch",
                  ],
                },
              },
            ],
          },
          { type: "assistant_message", data: { id: "assistant-mobile-1" } },
          { type: "done", data: { category_decision: null } },
        ]

        const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")

        await route.fulfill({
          contentType: "text/event-stream",
          body,
        })
      })

      await page.goto(`${baseUrl}/auth?email=${encodeURIComponent(email)}`, {
        waitUntil: "networkidle",
      })
      const emailInput = page.locator('input[type="email"]:visible')
      const passwordInput = page.locator('input[type="password"]:visible')
      await emailInput.fill("")
      await emailInput.pressSequentially(email)
      await passwordInput.fill("")
      await passwordInput.pressSequentially(password)
      const loginButton = page.getByRole("button", { name: /^Anmelden$/ })
      await expect(emailInput).toHaveValue(email)
      await expect(passwordInput).toHaveValue(password)
      await expect(loginButton).toBeEnabled()
      await loginButton.click()
      await page.waitForURL(/\/chat(\?.*)?$/, { timeout: 30_000 })

      const longToken = "haarlaengen".repeat(32)
      const chatInput = page.getByTestId("chat-input")
      await chatInput.fill(longToken)

      const viewport = page.viewportSize()
      expect(viewport).not.toBeNull()
      expectBoxInsideViewport(await page.getByTestId("chat-send").boundingBox(), viewport!)

      await page.getByTestId("chat-send").click()

      const productCard = page.getByRole("button", {
        name: /Ultra Lightweight Frizz Control/i,
      })
      await expect(productCard).toBeVisible()
      expectBoxInsideViewport(await productCard.boundingBox(), viewport!)

      const reasonText = page.getByText(
        "Leicht genug für feines Haar mit sehr langer Begründung ohne Layoutbruch",
      )
      await expect(reasonText).toBeVisible()
      await expect
        .poll(async () =>
          reasonText.evaluate((element) => element.scrollWidth <= element.clientWidth),
        )
        .toBe(true)

      for (const label of ["Antwort positiv bewerten", "Antwort negativ bewerten"]) {
        const box = await page.getByRole("button", { name: label }).boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expectBoxInsideViewport(box, viewport!)
      }
    })
  })
}
