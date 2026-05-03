import { expect, test, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for mobile sidebar E2E tests",
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("Hair Concierge").first()).toBeVisible({ timeout: 15_000 })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)

  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  const signupTab = page.getByRole("tab", { name: "Registrieren" })
  if (await signupTab.isVisible()) {
    await signupTab.click()
    await loginTab.click()
  }
  if (await loginTab.isVisible()) {
    await loginTab.click()
  }

  const emailInput = page.locator('input[type="email"]:visible')
  const passwordInput = page.locator('input[type="password"]:visible')
  const submitButton = page.getByRole("button", { name: /^Anmelden$/ })

  await emailInput.click()
  await emailInput.pressSequentially(email)
  await passwordInput.click()
  await passwordInput.pressSequentially(password)
  await expect(submitButton).toBeEnabled({ timeout: 10_000 })
  await submitButton.click()
  await page.waitForURL(/\/chat$/, { timeout: 30_000 })
}

async function openMobileSidebar(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/chat", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: "Unterhaltungen öffnen" })).toBeVisible()
  await page.getByRole("button", { name: "Unterhaltungen öffnen" }).click()
  await expect(page.getByRole("dialog", { name: "Unterhaltungen" })).toBeVisible()
}

async function expectSidebarClosed(page: Page) {
  await expect(page.getByRole("dialog", { name: "Unterhaltungen" })).toBeHidden({
    timeout: 1_000,
  })
}

test.describe.serial("mobile chat sidebar close lifecycle", () => {
  const email = `playwright-mobile-sidebar-${Date.now()}@hairconscierge.test`
  const password = "Playwright123!"
  let userId = ""
  let conversationId = ""

  test.beforeAll(async () => {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Playwright Mobile" },
    })
    if (userError) throw userError
    userId = userData.user?.id ?? ""
    if (!userId) throw new Error("Failed to create mobile sidebar E2E user")

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: "Playwright Mobile",
        onboarding_completed: true,
        subscription_status: "active",
      },
      { onConflict: "id" },
    )
    if (profileError) throw profileError

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .insert({
        user_id: userId,
        title: "Mobile Sidebar Test Chat",
        message_count: 1,
      })
      .select("id")
      .single()
    if (conversationError) throw conversationError
    conversationId = conversation.id

    const { error: messageError } = await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: "Test conversation",
    })
    if (messageError) throw messageError
  })

  test.afterAll(async () => {
    if (conversationId) {
      await admin.from("messages").delete().eq("conversation_id", conversationId)
      await admin.from("conversations").delete().eq("id", conversationId)
    }
    if (userId) {
      await admin.from("profiles").delete().eq("id", userId)
      await admin.auth.admin.deleteUser(userId)
    }
  })

  test.beforeEach(async ({ page }) => {
    await login(page, email, password)
  })

  test("closes after Plus with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openMobileSidebar(page)

    await page.getByRole("button", { name: "Neue Unterhaltung" }).click()

    await expectSidebarClosed(page)
    await expect(page.getByText("Neuer Chat").first()).toBeVisible()
  })

  test("closes after selecting an existing conversation with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openMobileSidebar(page)

    await page.getByRole("button", { name: /Mobile Sidebar Test Chat/ }).click()

    await expectSidebarClosed(page)
  })

  test("closes after X, backdrop, and Escape with normal motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })

    await openMobileSidebar(page)
    await page.getByRole("button", { name: "Seitenleiste schließen" }).click()
    await expectSidebarClosed(page)

    await openMobileSidebar(page)
    await page.mouse.click(380, 400)
    await expectSidebarClosed(page)

    await openMobileSidebar(page)
    await page.keyboard.press("Escape")
    await expectSidebarClosed(page)
  })

  test("closes via fallback timer when normal-motion animation events do not fire", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/chat", { waitUntil: "domcontentloaded" })
    await page.addStyleTag({ content: "* { animation: none !important; }" })

    await page.getByRole("button", { name: "Unterhaltungen öffnen" }).click()
    await expect(page.getByRole("dialog", { name: "Unterhaltungen" })).toBeVisible()

    await page.getByRole("button", { name: "Seitenleiste schließen" }).click()

    await expectSidebarClosed(page)
  })
})
