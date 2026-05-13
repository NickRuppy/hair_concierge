import { expect, test, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for chat scroll UX tests",
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" })

const LONG_RESPONSE = [
  "Ich starte mit einer leichten Leave-in-Pflege, damit dein feines, welliges Haar nicht beschwert wird.",
  "",
  "Wichtig ist eine kleine Menge in den Laengen, danach nur mit den Fingern einkneten.",
  "",
  "Fuer die Routine: mild waschen, Conditioner nur in die Laengen geben, Leave-in sparsam dosieren und lufttrocknen lassen.",
  "",
  "Wenn dein Haar schnell platt wird, nimm beim naechsten Mal weniger Produkt und arbeite lieber mit Wasser nach.",
  "",
  "Produktkarte: ein leichter Leave-in Conditioner waere hier besser als eine reichhaltige Maske.",
  "",
  "Das ist absichtlich eine lange Antwort, damit der mobile Chat scrollen muss und der Sprung zum Ende sichtbar wird.",
  "",
  "Zusatz: Achte darauf, dass der Ansatz frei bleibt. So bleiben die Wellen beweglich und das Ergebnis wirkt nicht schwer.",
  "",
  "Noch ein Hinweis: Wenn du am zweiten Tag auffrischen möchtest, reicht meistens etwas Wasser in den Händen.",
  "",
  "Danach kannst du die Längen kurz kneten und nur bei Bedarf einen Hauch Leave-in ergänzen.",
  "",
  "Für feines Haar ist weniger Produkt fast immer besser als eine zweite große Portion.",
  "",
  "Beobachte, ob deine Wellen nach dem Trocknen federnd bleiben oder sich strähnig anfühlen.",
  "",
  "Wenn sie strähnig werden, reduzierst du die Menge. Wenn sie frizzig bleiben, verteilst du das Produkt nasser.",
].join("\n")

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")

  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  if (await loginTab.isVisible()) {
    await loginTab.click()
  }

  await page.locator('input[type="email"]:visible').fill(email)
  await page.locator('input[type="password"]:visible').fill(password)
  await page.getByRole("button", { name: /^Anmelden$/ }).click()
  await page.waitForURL(/\/chat$/, { timeout: 30_000 })
}

test("mobile chat anchors a new long assistant answer and can jump to latest", async ({ page }) => {
  const email = `playwright-chat-scroll-${Date.now()}@hairconscierge.test`
  const password = "Playwright123!"
  const fullName = "Playwright Chat Scroll"
  let userId: string | null = null

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) throw error
  userId = data.user?.id ?? null
  if (!userId) throw new Error("Failed to create chat scroll test user")

  try {
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        onboarding_completed: true,
        subscription_status: "active",
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
        cuticle_condition: "medium_porosity",
        scalp_type: "balanced",
        scalp_condition: [],
        chemical_treatment: [],
        concerns: ["dryness"],
      },
      { onConflict: "user_id" },
    )
    if (hairProfileError) throw hairProfileError

    await page.setViewportSize({ width: 393, height: 852 })
    await page.addInitScript(
      ({ longResponse }) => {
        const originalFetch = window.fetch.bind(window)

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const url =
            typeof input === "string" || input instanceof URL ? input.toString() : input.url
          const method = (
            init?.method ?? (input instanceof Request ? input.method : "GET")
          ).toUpperCase()

          if (url.includes("/api/chat") && method === "POST") {
            const encoder = new TextEncoder()
            const events = [
              {
                chunk: `data: ${JSON.stringify({
                  type: "conversation_id",
                  data: "test-conversation",
                })}\n\n`,
                delayAfterMs: 40,
              },
              {
                chunk: `data: ${JSON.stringify({ type: "content_delta", data: longResponse })}\n\n`,
                delayAfterMs: 3000,
              },
              {
                chunk: `data: ${JSON.stringify({
                  type: "assistant_message",
                  data: {
                    id: "test-assistant-message",
                    langfuse_trace_id: null,
                    langfuse_trace_url: null,
                  },
                })}\n\n`,
                delayAfterMs: 40,
              },
              {
                chunk: `data: ${JSON.stringify({
                  type: "done",
                  data: { category_decision: null },
                })}\n\n`,
                delayAfterMs: 0,
              },
            ]

            return new Response(
              new ReadableStream({
                start(controller) {
                  let index = 0

                  const push = () => {
                    const event = events[index]
                    if (!event) {
                      controller.close()
                      return
                    }

                    controller.enqueue(encoder.encode(event.chunk))
                    index += 1
                    window.setTimeout(push, event.delayAfterMs)
                  }

                  push()
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-cache",
                },
              },
            )
          }

          return originalFetch(input, init)
        }
      },
      { longResponse: LONG_RESPONSE },
    )
    await login(page, email, password)

    await page.goto("/chat", { waitUntil: "domcontentloaded" })

    await page
      .getByRole("button", {
        name: "Welche Routine passt am besten zu meinem Haarprofil?",
      })
      .click()

    const assistant = page.getByTestId("message-assistant").last()
    await expect(assistant).toBeVisible({ timeout: 15_000 })

    const topDelta = await page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('[data-testid="chat-scroll-container"]')
      const assistantMessages = document.querySelectorAll<HTMLElement>(
        '[data-testid="message-assistant"]',
      )
      const assistantNode = assistantMessages[assistantMessages.length - 1]
      const wrapper = assistantNode?.closest<HTMLElement>("[data-message-id]")

      if (!container || !wrapper) return null

      const expectedTop = Math.max(
        0,
        container.scrollTop +
          (wrapper.getBoundingClientRect().top - container.getBoundingClientRect().top) -
          16,
      )
      return Math.abs(container.scrollTop - expectedTop)
    })

    expect(topDelta).not.toBeNull()
    expect(topDelta!).toBeLessThanOrEqual(32)

    const jumpButton = page.getByTestId("chat-jump-to-latest")
    await expect(jumpButton).toBeVisible({ timeout: 15_000 })

    await jumpButton.click()

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const container = document.querySelector<HTMLElement>(
            '[data-testid="chat-scroll-container"]',
          )
          if (!container) return null
          return container.scrollHeight - container.clientHeight - container.scrollTop
        }),
      )
      .toBeLessThanOrEqual(80)

    await page.waitForTimeout(3200)

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const container = document.querySelector<HTMLElement>(
            '[data-testid="chat-scroll-container"]',
          )
          if (!container) return null
          return container.scrollHeight - container.clientHeight - container.scrollTop
        }),
      )
      .toBeLessThanOrEqual(80)
  } finally {
    await admin.from("messages").delete().eq("conversation_id", "test-conversation")
    await admin.from("conversations").delete().eq("id", "test-conversation")
    await admin.from("hair_profiles").delete().eq("user_id", userId)
    await admin.from("profiles").delete().eq("id", userId)
    await admin.auth.admin.deleteUser(userId)
  }
})
