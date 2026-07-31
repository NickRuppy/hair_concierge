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
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
  })

  await page.goto(`${baseUrl}/quiz`, { waitUntil: "networkidle" })

  const startButton = page.getByRole("button", { name: /QUIZ STARTEN/i })
  if (await startButton.isVisible()) {
    await startButton.click()
  }

  await page.getByRole("button", { name: "Wellig", exact: true }).click()
  await page.getByRole("button", { name: "Mittel", exact: true }).click()
  await page.getByRole("button", { name: "Mittlere Dichte", exact: true }).click()
  await page.getByRole("button", { name: "Mittellang", exact: true }).click()
  await page.getByRole("button", { name: "Leicht uneben", exact: true }).click()
  await page.getByRole("button", { name: "Dehnt sich, bleibt ausgeleiert", exact: true }).click()

  await page.locator(".quiz-card", { hasText: "Naturhaar" }).click()
  await page.locator(".quiz-card", { hasText: "Gefärbt / getönt" }).click()
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

type PersonalPlanOverlapSnapshot = {
  ariaHidden: string | null
  direction: string | null
  duplicateIds: string[]
  exposedHeadings: number
  inert: boolean
}

async function armPersonalPlanOverlapCapture(page: Page) {
  await page.evaluate(() => {
    const quizWindow = window as Window & {
      __personalPlanOverlap?: Promise<PersonalPlanOverlapSnapshot | null>
    }
    quizWindow.__personalPlanOverlap = new Promise((resolve) => {
      let settled = false
      let timeoutId = 0
      let observer: MutationObserver
      const settle = (snapshot: PersonalPlanOverlapSnapshot | null) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeoutId)
        observer.disconnect()
        resolve(snapshot)
      }
      timeoutId = window.setTimeout(() => settle(null), 1_000)
      observer = new MutationObserver(() => {
        const outgoing = document.querySelector<HTMLElement>(
          '[data-personal-plan-transition-layer="outgoing"]',
        )
        if (!outgoing) return
        const ids = Array.from(
          document.querySelectorAll<HTMLElement>("[id]"),
          (element) => element.id,
        )
        settle({
          direction:
            document
              .querySelector('[data-personal-plan-transition-layer="active"]')
              ?.getAttribute("data-personal-plan-transition-direction") ?? null,
          duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
          inert: outgoing.hasAttribute("inert"),
          ariaHidden: outgoing.getAttribute("aria-hidden"),
          exposedHeadings: Array.from(document.querySelectorAll("h1, h2")).filter(
            (heading) => !heading.closest('[aria-hidden="true"]'),
          ).length,
        })
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
    })
  })
}

async function readPersonalPlanOverlapCapture(page: Page) {
  return page.evaluate(() => {
    const quizWindow = window as Window & {
      __personalPlanOverlap?: Promise<PersonalPlanOverlapSnapshot | null>
    }
    return quizWindow.__personalPlanOverlap
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

const containmentViewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
]

const personalPlanDraft = {
  version: 3,
  screen: "email_capture",
  history: ["texture", "daily_time", "plan_loading"],
  answers: { texture: "wavy", hairLength: "medium", goals: ["moisture"] },
}

const preparedPlanClaim = {
  artifactId: "mobile-layout-artifact",
  claimToken: "mobile-layout-claim",
  answersKey: JSON.stringify(personalPlanDraft.answers),
  expiresAt: "2099-01-01T00:00:00.000Z",
}

test.describe("@ci mobile layout containment", () => {
  for (const viewport of containmentViewports) {
    test(`personal-plan completion header is contained at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.addInitScript(
        ({ draft, claim }) => {
          window.localStorage.setItem("chaarlie:personal-plan-quiz-draft:v3", JSON.stringify(draft))
          window.sessionStorage.setItem(
            "chaarlie:personal-plan-quiz-prepared:v1",
            JSON.stringify(claim),
          )
        },
        { draft: personalPlanDraft, claim: preparedPlanClaim },
      )

      await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "networkidle" })
      const header = page.locator("header").first()
      const logo = header.getByText("chaarlie", { exact: true })
      const sectionLabel = header.getByText("Ergebnis", { exact: true }).first()

      await expect(logo).toBeVisible()
      await expect(sectionLabel).toBeVisible()

      const geometry = await page.evaluate(() => {
        const header = document.querySelector("header")
        const logo = Array.from(header?.querySelectorAll("span") ?? []).find(
          (element) => element.textContent === "chaarlie",
        )
        const sectionLabel = Array.from(header?.querySelectorAll("span") ?? []).find(
          (element) => element.textContent === "Ergebnis",
        )
        const rect = (element: Element | undefined | null) => element?.getBoundingClientRect()
        const headerRect = rect(header)
        const logoRect = rect(logo)
        const sectionLabelRect = rect(sectionLabel)

        return {
          document: {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          },
          header: headerRect && { left: headerRect.left, right: headerRect.right },
          logo: logoRect && { left: logoRect.left, right: logoRect.right },
          sectionLabel: sectionLabelRect && {
            left: sectionLabelRect.left,
            right: sectionLabelRect.right,
          },
        }
      })

      expect(geometry.document.scrollWidth).toBeLessThanOrEqual(geometry.document.clientWidth)
      expect(geometry.header).not.toBeNull()
      expect(geometry.logo).not.toBeNull()
      expect(geometry.sectionLabel).not.toBeNull()
      expect(geometry.logo!.left + geometry.logo!.right).toBeCloseTo(
        geometry.document.clientWidth,
        0,
      )
      expect(geometry.sectionLabel!.right).toBeLessThanOrEqual(geometry.document.clientWidth - 16)
    })

    for (const route of ["/agb", "/datenschutz", "/methodik"]) {
      test(`${route} headings are contained at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" })

        const geometry = await page.evaluate(() => {
          const heading = document.querySelector("h1")
          const rect = heading?.getBoundingClientRect()
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            heading: heading &&
              rect && {
                left: rect.left,
                right: rect.right,
                fontSize: getComputedStyle(heading).fontSize,
              },
          }
        })

        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
        expect(geometry.heading).not.toBeNull()
        expect(geometry.heading!.left).toBeGreaterThanOrEqual(0)
        expect(geometry.heading!.right).toBeLessThanOrEqual(geometry.clientWidth)
        expect(geometry.heading!.fontSize).toBe(
          viewport.width < 360
            ? route === "/methodik"
              ? "30px"
              : "24px"
            : route === "/methodik"
              ? "36px"
              : "30px",
        )
      })
    }
  }
})

test.describe("@ci personal-plan quiz motion", () => {
  test("screen overlap is directional, inert, identity-safe, and reduced-motion aware", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
      window.localStorage.removeItem("chaarlie:personal-plan-quiz-draft:v3")
    })
    await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "domcontentloaded" })
    await expect(
      page.locator("[data-personal-plan-client-ready]"),
      "quiz hydration",
    ).toHaveAttribute("data-personal-plan-client-ready", "true")

    await armPersonalPlanOverlapCapture(page)
    await page.getByRole("button", { name: /Wellig/i }).click()
    const forwardOverlap = await readPersonalPlanOverlapCapture(page)
    expect(forwardOverlap).toEqual({
      direction: "forward",
      duplicateIds: [],
      inert: true,
      ariaHidden: "true",
      exposedHeadings: 1,
    })
    await expect(
      page.getByRole("heading", { name: "Wie dick ist ein einzelnes Haar?" }),
    ).toBeVisible()

    await armPersonalPlanOverlapCapture(page)
    await page.getByRole("button", { name: "Zurück" }).click()
    const backOverlap = await readPersonalPlanOverlapCapture(page)
    expect(backOverlap?.direction).toBe("back")
    await expect(page.getByRole("heading", { name: "Welche Haarstruktur hast du?" })).toBeVisible()

    await page.emulateMedia({ reducedMotion: "reduce" })
    await expect(page.locator('[data-personal-plan-transition-layer="outgoing"]')).toHaveCount(0)
    await armPersonalPlanOverlapCapture(page)
    await page.getByRole("button", { name: /Wellig/i }).click()
    await expect(
      page.getByRole("heading", { name: "Wie dick ist ein einzelnes Haar?" }),
    ).toBeVisible()
    const reducedMotionOverlap = await readPersonalPlanOverlapCapture(page)
    expect(reducedMotionOverlap).toBeNull()
    await expect(page.locator('[data-personal-plan-transition-layer="active"]')).toHaveCSS(
      "animation-name",
      "none",
    )
  })
})

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
      const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

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
          current_period_end: currentPeriodEnd,
        },
        { onConflict: "id" },
      )
      if (profileError) throw profileError

      const { error: billingError } = await admin.from("billing_subscriptions").upsert(
        {
          user_id: userId,
          provider: "stripe",
          provider_customer_id: `cus_mobile_${userId}`,
          provider_subscription_id: `sub_mobile_${userId}`,
          provider_status: "active",
          entitlement_status: "active",
          interval: "month",
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: false,
          metadata: { ci_seed: "mobile-ux" },
        },
        { onConflict: "provider,provider_subscription_id" },
      )
      if (billingError && billingError.code !== "PGRST205") throw billingError

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
          heat_styling: "never",
          styling_tools: [],
          night_protection: [],
          uses_heat_protection: false,
        },
        { onConflict: "user_id" },
      )
      if (hairProfileError) throw hairProfileError

      const { error: productUsageError } = await admin.from("user_product_usage").insert({
        user_id: userId,
        category: "shampoo",
        product_name: "Shampoo",
        frequency_range: "weekly_3_4x",
      })
      if (productUsageError) throw productUsageError
    })

    test.afterAll(async () => {
      if (!userId) return

      await admin.from("user_product_usage").delete().eq("user_id", userId)
      await admin.from("billing_subscriptions").delete().eq("user_id", userId)
      await admin.from("hair_profiles").delete().eq("user_id", userId)
      await admin.from("profiles").delete().eq("id", userId)
      await admin.auth.admin.deleteUser(userId)
    })

    test("quiz step changes reset the mobile scroll pane and focus the new heading", async ({
      page,
    }) => {
      await completeQuizToConcerns(page)

      await page.evaluate(() => {
        const panes = Array.from(document.querySelectorAll<HTMLElement>(".overflow-y-auto"))
        const pane =
          panes.find((element) => element.scrollHeight > element.clientHeight) ?? panes[0]
        if (!pane) return

        const spacer = document.createElement("div")
        spacer.setAttribute("data-testid", "mobile-scroll-reset-spacer")
        spacer.style.height = "800px"
        spacer.setAttribute("aria-hidden", "true")
        pane.appendChild(spacer)
        pane.scrollTo({ top: pane.scrollHeight })
        window.scrollTo({ top: document.documentElement.scrollHeight })
      })
      await expect.poll(() => quizScrollPaneTop(page)).toBeGreaterThan(0)

      await page.getByRole("button", { name: "Trockenheit", exact: true }).click()
      await page.getByRole("button", { name: "Frizz", exact: true }).click()
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
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "chaarlie_cookie_consent_v1",
          JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
        )
      })
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

      const productName = page.getByText(
        "Ultra Lightweight Frizz Control Leave-in Conditioner With Long Name",
        { exact: true },
      )
      await expect(productName).toBeVisible()
      expectBoxInsideViewport(await productName.boundingBox(), viewport!)
      await expect
        .poll(async () =>
          productCard.evaluate((element) => element.scrollWidth <= element.clientWidth),
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
