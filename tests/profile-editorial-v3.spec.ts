import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = "ux-audit-test@hairconscierge.test"
const PASSWORD = "uxAudit!Test123"

test.describe.serial("@ci profile editorial v3", () => {
  test.beforeAll(async () => {
    // Ensure the seeded user exists; mirror scripts/ux-audit-create-test-user.mjs
    // by re-establishing a known password on every run so the shared account
    // remains deterministic across reruns.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existing = list.users.find((u) => u.email === EMAIL)
    let userId: string

    if (existing) {
      userId = existing.id
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
      })
      if (error) throw error
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
      })
      if (error) throw error
      if (!data.user) throw new Error("failed to ensure test user exists")
      userId = data.user.id
    }

    // Seed profile so the Mitgliedschaft subscription section renders — it is
    // guarded by profile.stripe_customer_id in src/app/profile/page.tsx.
    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId,
      stripe_customer_id: "cus_ux_audit_test",
      subscription_status: "active",
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      onboarding_completed: true,
    })
    if (profErr) throw new Error(`profiles upsert failed: ${profErr.message}`)
  })

  test("renders editorial layout without the removed blocks", async ({ page }) => {
    await page.goto(`${baseUrl}/auth`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(chat|profile|quiz|onboarding)/, { timeout: 10_000 })

    await page.goto(`${baseUrl}/profile`)
    await expect(page.getByRole("heading", { name: "Mein Profil", level: 1 })).toBeVisible()

    // 1. No gamified progress card
    await expect(page.getByText("Profil-Fortschritt")).toHaveCount(0)
    await expect(page.getByText("Nächster Fokus")).toHaveCount(0)

    // 2. No shortcut grid
    await expect(page.getByText("Schnellzugriff")).toHaveCount(0)
    await expect(page.getByText("Zum offenen Bereich springen")).toHaveCount(0)

    // 3. No Mehr/Weniger collapse buttons on core sections
    await expect(
      page.getByRole("button", { name: /Haar-Check (aufklappen|zuklappen)/ }),
    ).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Produkte (aufklappen|zuklappen)/ })).toHaveCount(
      0,
    )
    await expect(page.getByRole("button", { name: /Styling (aufklappen|zuklappen)/ })).toHaveCount(
      0,
    )
    await expect(page.getByRole("button", { name: /Alltag (aufklappen|zuklappen)/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Ziele (aufklappen|zuklappen)/ })).toHaveCount(0)

    // 4. Footer utilities still render, with the new copy
    await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Erinnerungen" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mitgliedschaft" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible()
    // Old copy must be gone
    await expect(page.getByRole("heading", { name: "Was Hair Concierge sich merkt" })).toHaveCount(
      0,
    )
    await expect(page.getByRole("heading", { name: "Dein Abo" })).toHaveCount(0)

    // 5. All five core sections are present and open
    for (const name of ["Haar-Check", "Produkte", "Styling", "Alltag", "Ziele"]) {
      await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible()
    }

    // 5b. Core sections render before the Einstellungen group in DOM order
    const coreLocator = page.getByRole("heading", { name: "Ziele", level: 2 })
    const einstellungenLocator = page.getByRole("heading", { name: "Einstellungen" })
    const [coreY, settingsY] = await Promise.all([
      coreLocator.boundingBox().then((b) => b?.y ?? 0),
      einstellungenLocator.boundingBox().then((b) => b?.y ?? 0),
    ])
    expect(settingsY).toBeGreaterThan(coreY)

    // 6. No per-field "Bearbeiten →" CTAs
    await expect(page.getByText(/^Bearbeiten$/)).toHaveCount(0)

    // 7. Hero has no body paragraph
    await expect(page.getByText("Je vollständiger dein Profil ist")).toHaveCount(0)
  })
})
