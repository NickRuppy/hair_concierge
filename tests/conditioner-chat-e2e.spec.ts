import { test, expect, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for conditioner chat E2E tests",
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SEEDED_CONDITIONER_NAMES = [
  "Balea Natural Beauty Hibiskus",
  "Sante Intense Hydrating Conditioner",
  "Pantene Hydra Glow (Silikone)",
] as const

type AssistantMessageRecord = {
  content: string | null
  product_recommendations: Array<{
    id: string
    name: string
    recommendation_meta?: {
      category?: string
      matched_weight?: string | null
      matched_repair_level?: string | null
      matched_profile?: {
        density?: string | null
      }
      top_reasons?: string[]
      tradeoffs?: string[]
    } | null
  }> | null
  rag_context: {
    category_decision?: {
      category?: string
      relevant?: boolean
      action?: string | null
      targetProfile?: {
        weight?: string | null
        repairLevel?: string | null
      }
    } | null
  } | null
}

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

async function clearUserConversations(userId: string) {
  const { data: conversations, error } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)

  if (error) throw error

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id)
  if (conversationIds.length > 0) {
    const { error: messageError } = await admin
      .from("messages")
      .delete()
      .in("conversation_id", conversationIds)

    if (messageError) throw messageError
  }

  const { error: conversationError } = await admin
    .from("conversations")
    .delete()
    .eq("user_id", userId)

  if (conversationError) throw conversationError
}

async function sendChatMessage(page: Page, message: string) {
  await page.goto("/chat", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(500)

  const assistantCountBefore = await page.locator('[data-testid="message-assistant"]').count()
  const input = page.getByTestId("chat-input")
  const sendButton = page.getByTestId("chat-send")
  await expect(input).toBeVisible({ timeout: 15_000 })
  await input.click()
  await input.pressSequentially(message)
  await expect(sendButton).toBeEnabled({ timeout: 10_000 })
  await sendButton.click()

  await page.waitForFunction(
    (initialCount) =>
      document.querySelectorAll('[data-testid="message-assistant"]').length > initialCount,
    assistantCountBefore,
    { timeout: 30_000 },
  )

  let stableTicks = 0
  let previousText = ""

  for (let attempt = 0; attempt < 45; attempt++) {
    await page.waitForTimeout(1000)
    const currentText =
      (await page.locator('[data-testid="message-assistant"]').last().textContent()) ?? ""

    if (currentText.length > 80 && currentText === previousText) {
      stableTicks += 1
      if (stableTicks >= 3) {
        return currentText
      }
    } else {
      stableTicks = 0
    }

    previousText = currentText
  }

  return previousText
}

async function fetchLatestAssistantMessage(userId: string): Promise<AssistantMessageRecord | null> {
  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (conversationError) throw conversationError
  if (!conversation) return null

  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("content, product_recommendations, rag_context")
    .eq("conversation_id", conversation.id)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (messageError) throw messageError
  return (message as AssistantMessageRecord | null) ?? null
}

test.describe.serial("Conditioner chat E2E", () => {
  const email = `playwright-conditioner-${Date.now()}@hairconscierge.test`
  const password = "Playwright123!"
  const fullName = "Playwright Conditioner"
  let userId: string | null = null
  let seededProductIds: string[] = []

  test.beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (error) throw error
    userId = data.user?.id ?? null

    if (!userId) {
      throw new Error("Failed to create conditioner E2E user")
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        onboarding_completed: true,
      },
      { onConflict: "id" },
    )

    if (profileError) throw profileError

    const { data: seededProducts, error: productError } = await admin
      .from("products")
      .select("id, name")
      .in("name", [...SEEDED_CONDITIONER_NAMES])

    if (productError) throw productError

    seededProductIds = (seededProducts ?? []).map((product) => product.id)

    if (seededProductIds.length !== SEEDED_CONDITIONER_NAMES.length) {
      throw new Error("Failed to find all seeded conditioner products for E2E")
    }

    const specsByName = new Map(
      (seededProducts ?? []).map((product) => [product.name, product.id] as const),
    )

    const { error: specError } = await admin.from("product_conditioner_rerank_specs").upsert([
      {
        product_id: specsByName.get("Balea Natural Beauty Hibiskus"),
        weight: "light",
        repair_level: "medium",
      },
      {
        product_id: specsByName.get("Sante Intense Hydrating Conditioner"),
        weight: "medium",
        repair_level: "high",
      },
      {
        product_id: specsByName.get("Pantene Hydra Glow (Silikone)"),
        weight: "rich",
        repair_level: "low",
      },
    ])

    if (specError) throw specError
  })

  test.afterAll(async () => {
    if (seededProductIds.length > 0) {
      await admin
        .from("product_conditioner_rerank_specs")
        .delete()
        .in("product_id", seededProductIds)
    }

    if (!userId) return

    await clearUserConversations(userId)
    await admin.from("user_product_usage").delete().eq("user_id", userId)
    await admin.from("hair_profiles").delete().eq("user_id", userId)
    await admin.from("profiles").delete().eq("id", userId)
    await admin.auth.admin.deleteUser(userId)
  })

  test.beforeEach(async () => {
    if (!userId) throw new Error("Missing conditioner E2E user")
    await clearUserConversations(userId)
    await admin.from("user_product_usage").delete().eq("user_id", userId)
  })

  test("full conditioner profile returns recommendations with conditioner metadata", async ({
    page,
  }) => {
    if (!userId) throw new Error("Missing conditioner E2E user")
    const currentUserId = userId

    const { error: profileError } = await admin.from("hair_profiles").upsert(
      {
        user_id: currentUserId,
        hair_texture: "straight",
        thickness: "fine",
        density: "low",
        concerns: [],
        products_used: null,
        wash_frequency: "every_2_3_days",
        heat_styling: "rarely",
        styling_tools: [],
        goals: ["shine"],
        cuticle_condition: "slightly_rough",
        protein_moisture_balance: "snaps",
        scalp_type: "balanced",
        scalp_condition: "none",
        chemical_treatment: ["colored"],
        desired_volume: "balanced",
        routine_preference: "balanced",
        additional_notes: "Bitte nichts Schweres.",
        conversation_memory: null,
      },
      { onConflict: "user_id" },
    )

    if (profileError) throw profileError

    const { error: usageError } = await admin.from("user_product_usage").insert({
      user_id: currentUserId,
      category: "conditioner",
      product_name: "Conditioner",
      frequency_range: "1_2x",
    })

    if (usageError) throw usageError

    await login(page, email, password)
    const responseText = await sendChatMessage(
      page,
      "Seit drei Monaten sind meine Laengen trocken, ich wasche zweimal pro Woche, benutze aktuell Shampoo und Conditioner aus der Drogerie und meine Haare sind gefaerbt. Welchen leichten Conditioner empfiehlst du mir bei Feuchtigkeitsmangel?",
    )

    expect(responseText.toLowerCase()).toContain("conditioner")
    expect(responseText.toLowerCase()).toMatch(/haar|pflege|feuchtigkeit/)

    await expect
      .poll(
        async () => {
          const message = await fetchLatestAssistantMessage(currentUserId)
          return message?.product_recommendations?.length ?? 0
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0)

    const assistantMessage = await fetchLatestAssistantMessage(currentUserId)
    expect(assistantMessage?.rag_context?.category_decision).toEqual(
      expect.objectContaining({
        category: "conditioner",
        relevant: true,
        action: "replace",
        targetProfile: expect.objectContaining({
          weight: "light",
          repairLevel: "medium",
        }),
      }),
    )
    expect(assistantMessage?.product_recommendations?.[0]?.recommendation_meta).toEqual(
      expect.objectContaining({
        category: "conditioner",
        matched_weight: "light",
        matched_repair_level: "medium",
        matched_profile: expect.objectContaining({
          density: "low",
        }),
      }),
    )
  })

  test("missing density still returns conditioner recommendations via soft fallback", async ({
    page,
  }) => {
    if (!userId) throw new Error("Missing conditioner E2E user")
    const currentUserId = userId

    const { error: profileError } = await admin.from("hair_profiles").upsert(
      {
        user_id: currentUserId,
        hair_texture: "straight",
        thickness: "fine",
        density: null,
        concerns: [],
        products_used: null,
        wash_frequency: "every_2_3_days",
        heat_styling: "rarely",
        styling_tools: [],
        goals: ["shine"],
        cuticle_condition: "slightly_rough",
        protein_moisture_balance: "snaps",
        scalp_type: "balanced",
        scalp_condition: "none",
        chemical_treatment: ["colored"],
        desired_volume: "balanced",
        routine_preference: "balanced",
        additional_notes: "Bitte nichts Schweres.",
        conversation_memory: null,
      },
      { onConflict: "user_id" },
    )

    if (profileError) throw profileError

    const { error: usageError } = await admin.from("user_product_usage").insert({
      user_id: currentUserId,
      category: "conditioner",
      product_name: "Conditioner",
      frequency_range: "1_2x",
    })

    if (usageError) throw usageError

    await login(page, email, password)
    const responseText = await sendChatMessage(
      page,
      "Seit einigen Wochen sind meine Laengen trocken, ich wasche zweimal pro Woche, benutze gerade Drogerie-Shampoo und einen beliebigen Conditioner und meine Haare sind gefaerbt. Welchen Conditioner empfiehlst du mir?",
    )

    expect(responseText.toLowerCase()).toMatch(/conditioner|pflege|laengen/)

    await expect
      .poll(
        async () => {
          const message = await fetchLatestAssistantMessage(currentUserId)
          return message?.product_recommendations?.length ?? 0
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0)

    const assistantMessage = await fetchLatestAssistantMessage(currentUserId)
    expect(assistantMessage?.rag_context?.category_decision).toEqual(
      expect.objectContaining({
        category: "conditioner",
        relevant: true,
        targetProfile: expect.objectContaining({
          weight: null,
        }),
      }),
    )
    expect(assistantMessage?.product_recommendations?.[0]?.recommendation_meta).toEqual(
      expect.objectContaining({
        category: "conditioner",
        matched_weight: null,
      }),
    )
  })
})
