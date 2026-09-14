import { expect, test, type Page, type Route } from "@playwright/test"

const PAGE_SIZE = 50

test.setTimeout(30_000)

function fixtureUsers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `user-${String(index + 1).padStart(3, "0")}`,
    full_name: `Nutzer ${index + 1}`,
    email: `nutzer-${index + 1}@example.test`,
    is_admin: false,
    created_at: new Date(Date.UTC(2026, 0, 31) - index * 86_400_000).toISOString(),
    hair_profiles:
      index === 0
        ? [{ hair_texture: null, concerns: [], goals: [] }]
        : index === 1
          ? []
          : [{ hair_texture: "wavy", concerns: [], goals: [] }],
    current_billing_subscription: null,
  }))
}

async function fulfillUsers(route: Route, users: ReturnType<typeof fixtureUsers>) {
  const requestUrl = new URL(route.request().url())
  const offset = Number(requestUrl.searchParams.get("offset") ?? "0")
  const limit = Number(requestUrl.searchParams.get("limit") ?? String(PAGE_SIZE))
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ users: users.slice(offset, offset + limit), total: users.length }),
  })
}

async function dismissCookiesIfVisible(page: Page) {
  const essentialOnly = page.getByRole("button", { name: "Nur essentielle" })
  if (await essentialOnly.isVisible().catch(() => false)) await essentialOnly.click()
}

async function openAdminUsers(page: Page, users = fixtureUsers(123)) {
  await page.route("**/api/admin/users**", (route) => fulfillUsers(route, users))
  await page.goto("/labs/admin-users")
  await dismissCookiesIfVisible(page)
  await expect(page.getByText("123 Nutzer insgesamt")).toBeVisible()
  return users
}

test("admin users shows a truthful total, profile-row presence, and reaches the oldest retained accounts", async ({
  page,
}, testInfo) => {
  await openAdminUsers(page)

  await expect(page.getByText("1–50 von 123 · Seite 1 von 3")).toBeVisible()
  await expect(page.getByText("Nutzer 1", { exact: true })).toBeVisible()
  await expect(
    page.locator("tr").filter({ has: page.getByText("Nutzer 1", { exact: true }) }),
  ).toContainText("Vorhanden")
  await expect(
    page.locator("tr").filter({ has: page.getByText("Nutzer 2", { exact: true }) }),
  ).toContainText("Nicht vorhanden")
  await page.screenshot({ path: testInfo.outputPath("admin-users-newest.png"), fullPage: true })

  await page.getByRole("button", { name: "Weiter" }).click()
  await expect(page.getByText("51–100 von 123 · Seite 2 von 3")).toBeVisible()
  await expect(page.getByText("Nutzer 51", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Älteste" }).click()
  await expect(page.getByText("101–123 von 123 · Seite 3 von 3")).toBeVisible()
  await expect(page.getByText("Nutzer 101", { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("admin-users-oldest.png"), fullPage: true })
  await expect(page.getByRole("button", { name: "Weiter" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Älteste" })).toBeDisabled()

  await page.getByRole("button", { name: "Neueste" }).click()
  await expect(page.getByText("1–50 von 123 · Seite 1 von 3")).toBeVisible()
  await expect(page.getByRole("button", { name: "Neueste" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Zurück" })).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole("navigation", { name: "Nutzerseiten" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("admin-users-mobile.png"), fullPage: true })
})

test("admin users locks navigation while loading and retries both initial and later page failures", async ({
  page,
}) => {
  const users = fixtureUsers(123)
  let calls = 0
  let releaseInitialFailure!: () => void
  const initialFailure = new Promise<void>((resolve) => {
    releaseInitialFailure = resolve
  })
  await page.route("**/api/admin/users**", async (route) => {
    calls += 1
    if (calls === 1) {
      await initialFailure
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"kaputt"}',
      })
    }
    if (calls === 3) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"kaputt"}',
      })
    }
    return fulfillUsers(route, users)
  })
  await page.goto("/labs/admin-users")
  await dismissCookiesIfVisible(page)
  await expect(page.getByText("Nutzer werden geladen …")).toBeVisible()
  await expect(page.getByRole("button", { name: "Weiter" })).toHaveCount(0)
  releaseInitialFailure()
  await expect(page.getByText("Nutzer konnten nicht geladen werden.")).toBeVisible()
  await page.getByRole("button", { name: "Erneut versuchen" }).click()
  await expect(page.getByText("1–50 von 123 · Seite 1 von 3")).toBeVisible()

  await page.getByRole("button", { name: "Weiter" }).click()
  await expect(page.getByText("Nutzer konnten nicht geladen werden.")).toBeVisible()
  await page.getByRole("button", { name: "Erneut versuchen" }).click()
  await expect(page.getByText("51–100 von 123 · Seite 2 von 3")).toBeVisible()
})

test("admin users handles empty and one-page results, and clamps a page whose total shrinks", async ({
  page,
}) => {
  let users = fixtureUsers(123)
  let latestOffset = 0
  await page.route("**/api/admin/users**", async (route) => {
    latestOffset = Number(new URL(route.request().url()).searchParams.get("offset") ?? "0")
    await fulfillUsers(route, users)
  })
  await page.goto("/labs/admin-users")
  await dismissCookiesIfVisible(page)
  await expect(page.getByText("1–50 von 123 · Seite 1 von 3")).toBeVisible()

  users = fixtureUsers(74)
  // The count can fall after the first page loads. A request for the former final page
  // now returns no rows, so the page must retry the last valid offset rather than
  // presenting this as an empty account history.
  await page.getByRole("button", { name: "Älteste" }).click()
  await expect.poll(() => latestOffset).toBe(50)
  await expect(page.getByText("51–74 von 74 · Seite 2 von 2")).toBeVisible()

  await page.unroute("**/api/admin/users**")
  await page.route("**/api/admin/users**", (route) => fulfillUsers(route, fixtureUsers(0)))
  await page.reload()
  await expect(page.getByText("0 Nutzer insgesamt")).toBeVisible()
  await expect(page.getByText("Noch keine Nutzer vorhanden.")).toBeVisible()

  await page.unroute("**/api/admin/users**")
  await page.route("**/api/admin/users**", (route) => fulfillUsers(route, fixtureUsers(1)))
  await page.reload()
  await expect(page.getByText("1 Nutzer insgesamt")).toBeVisible()
  for (const name of ["Neueste", "Zurück", "Weiter", "Älteste"]) {
    await expect(page.getByRole("button", { name })).toBeDisabled()
  }
})
