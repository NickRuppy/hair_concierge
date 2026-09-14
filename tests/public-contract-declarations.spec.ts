import { expect, test, type Page } from "@playwright/test"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"

test.use({ viewport: { width: 360, height: 800 } })

async function capture(page: Page, name: string) {
  const directory = process.env.DECLARATION_SCREENSHOT_DIR
  if (!directory) return
  const essentialCookies = page.getByRole("button", { name: "Nur essentielle", exact: true })
  if (await essentialCookies.isVisible()) await essentialCookies.click()
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true })
}

test.beforeEach(async ({ context, baseURL }) => {
  // The real form runs against the local app; no request may reach a provider,
  // live database or email recipient during these browser contract checks.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(baseURL!).origin) await route.continue()
    else await route.abort()
  })
})

test("public cancellation retries a lost response with the same key, saves a durable receipt and supports extraordinary reasons", async ({
  page,
}) => {
  const attempts: Array<Record<string, unknown>> = []
  await page.route("**/api/billing/contract-declarations", async (route) => {
    const declaration = route.request().postDataJSON()
    attempts.push(declaration)
    if (attempts.length === 1) {
      await route.abort()
      return
    }
    await route.fulfill({
      json: {
        receipt: {
          declarationId: "00000000-0000-4000-8000-000000000002",
          submittedAt: "2026-09-14T12:00:00.000Z",
          declaration,
        },
        deliveryStatus: "queued",
      },
    })
  })
  await page.goto("/kuendigen")
  await expect(page.getByRole("heading", { name: "Vertrag kündigen" })).toBeVisible()
  await expect(
    page.getByText("Eine Anmeldung ist nicht erforderlich.", { exact: false }),
  ).toBeVisible()
  await capture(page, "cancellation-360")
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(page, "cancellation-390")
  await page.setViewportSize({ width: 360, height: 800 })
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Marie Beispiel")
  await page
    .getByRole("textbox", { name: "E-Mail für die Bestätigung", exact: true })
    .fill("marie@example.com")
  await page
    .getByRole("textbox", { name: "Vertrag", exact: true })
    .fill("Chaarlie Jahresabo · CH-12345")
  await page
    .getByRole("combobox", { name: "Art der Kündigung" })
    .selectOption("extraordinary_cancellation")
  await page.getByRole("textbox", { name: "Kündigungsgrund (optional)" }).fill("Mein Grund")
  await page.getByRole("textbox", { name: "Gewünschtes Vertragsende" }).fill("30.09.2026")
  await page.getByRole("button", { name: "Jetzt kündigen", exact: true }).click()
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "mit denselben Angaben erneut",
  )
  await capture(page, "cancellation-error-360")
  await expect(page.getByRole("textbox", { name: "Vertrag", exact: true })).toHaveValue(
    "Chaarlie Jahresabo · CH-12345",
  )
  await page.getByRole("button", { name: "Jetzt kündigen", exact: true }).click()
  const heading = page.getByRole("heading", { name: "Deine Kündigung ist eingegangen." })
  await expect(heading).toBeFocused()
  await expect(page.getByText("Wir haben deine Erklärung am", { exact: false })).toContainText(
    "MESZ erhalten.",
  )
  await capture(page, "cancellation-received-360")
  await expect(page.getByRole("region", { name: "Eingangsbestätigung" })).toContainText(
    "zur Zustellung",
  )
  expect(attempts).toHaveLength(2)
  expect(attempts[1]).toEqual(attempts[0])
  expect(attempts[1].kind).toBe("extraordinary_cancellation")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Erklärung speichern" }).click()
  const download = await downloadPromise
  const contents = await readFile((await download.path())!, "utf8")
  expect(contents).toContain("Eingang (UTC): 2026-09-14T12:00:00.000Z")
  expect(contents).toContain("Gewünschtes Vertragsende: 30.09.2026")
  expect(contents).toContain("Kündigungsgrund: Mein Grund")
  expect(contents).toContain("Nach sicherer Zuordnung")
  expect(contents).not.toContain("wurde gesendet")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test("withdrawal is prominent and distinct, validates required fields and acknowledges without refund promise", async ({
  page,
}) => {
  let calls = 0
  await page.route("**/api/billing/contract-declarations", async (route) => {
    const declaration = route.request().postDataJSON()
    calls++
    expect(declaration.kind).toBe("withdrawal")
    expect(declaration.requestedEnd).toBeNull()
    expect(declaration.reason).toBeNull()
    await route.fulfill({
      json: {
        receipt: {
          declarationId: "00000000-0000-4000-8000-000000000003",
          submittedAt: "2026-09-14T12:00:00.000Z",
          declaration,
        },
        deliveryStatus: "queued",
      },
    })
  })
  await page.goto("/widerruf")
  const links = page.getByRole("link", { name: "Vertrag widerrufen", exact: true })
  await expect(links).toHaveCount(2)
  await links.first().click()
  await expect(page.getByRole("heading", { name: "Vertrag widerrufen" })).toBeVisible()
  await capture(page, "withdrawal-360")
  await page.getByRole("button", { name: "Widerruf bestätigen" }).click()
  expect(calls).toBe(0)
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Marie Beispiel")
  await page
    .getByRole("textbox", { name: "E-Mail für die Bestätigung", exact: true })
    .fill("marie@example.com")
  await page.getByRole("textbox", { name: "Vertrag", exact: true }).fill("Chaarlie Jahresabo")
  await expect(page.getByRole("combobox")).toHaveCount(0)
  await page.getByRole("button", { name: "Widerruf bestätigen" }).click()
  await expect(page.getByRole("heading", { name: "Dein Widerruf ist eingegangen." })).toBeFocused()
  await capture(page, "withdrawal-received-360")
  await expect(page.getByRole("region", { name: "Eingangsbestätigung" })).not.toContainText(
    "Rückerstattung",
  )
  expect(calls).toBe(1)
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
})
