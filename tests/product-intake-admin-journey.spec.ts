import { expect, test } from "@playwright/test"

const id = "11111111-1111-4111-8111-111111111111"
const path = `/labs/produkt-intake?detail=${id}`

for (const width of [1280, 390])
  test(`Admin review separates approvals, confirms publication and recovers only the message at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const adminWrites: string[] = []
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/admin/"))
        adminWrites.push(request.url())
    })
    await page.goto(path)
    await expect(page.getByRole("heading", { name: "Prüfung & Abschluss" })).toBeVisible()
    const publish = page.getByRole("button", { name: "Zur Veröffentlichungsfreigabe", exact: true })
    await expect(publish).toBeDisabled()
    await page.getByRole("button", { name: "Werte und Anwendung freigeben", exact: true }).click()
    await expect(
      page.getByText("Werte und Anwendung für diese Version freigegeben.", { exact: true }),
    ).toBeVisible()
    await expect(publish).toBeDisabled()
    await page
      .getByRole("checkbox", {
        name: "Ich habe die drei Bilder geprüft. Produkt, Beschriftung und Freistellung stimmen.",
      })
      .check()
    await page.getByRole("button", { name: "Katalogbild freigeben", exact: true }).click()
    await expect(
      page.getByText("Bild für diese Version freigegeben.", { exact: true }),
    ).toBeVisible()
    await expect(publish).toBeEnabled()
    await publish.click()
    const confirmation = page.getByRole("dialog")
    await expect(confirmation).toContainText(
      "CARE · Conditioner · Beispieldaten · Rechercheversion 3",
    )
    await expect(confirmation).toContainText("Kunden verknüpft")
    await confirmation.getByRole("button", { name: "Abbrechen", exact: true }).click()
    await expect(page.getByText("Produkt veröffentlicht · Version 3", { exact: true })).toHaveCount(
      0,
    )
    await publish.click()
    const confirm = page
      .getByRole("dialog")
      .getByRole("button", { name: "Jetzt veröffentlichen", exact: true })
    await expect(confirm).toBeEnabled()
    await confirm.focus()
    await expect(confirm).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(
      page.getByText("Produkt veröffentlicht · Version 3", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(
        "Die Kundennachricht ist noch ausstehend. Das Produkt bleibt veröffentlicht.",
        { exact: true },
      ),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Nur Kundennachricht erneut prüfen", exact: true })
      .click()
    await expect(
      page.getByText("Kundennachricht bestätigt. Die Übergabe ist abgeschlossen.", { exact: true }),
    ).toBeVisible()
    await expect(publish).toHaveCount(0)
    expect(adminWrites).toEqual([])
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })

test("missing image evidence cannot be approved or published", async ({ page }) => {
  await page.goto(`${path}&bilder=missing`)
  await expect(
    page.getByRole("button", { name: "Katalogbild freigeben", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Werte und Anwendung freigeben", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Zur Veröffentlichungsfreigabe", exact: true }),
  ).toBeDisabled()
})

test("an uncertain publication survives reload and blocks a new operation", async ({ page }) => {
  await page.addInitScript((submissionId) => {
    sessionStorage.setItem(
      `product-review-publication:${submissionId}`,
      JSON.stringify({
        action: "publish",
        request_id: "44444444-4444-4444-8444-444444444444",
        job_id: submissionId,
        review_cycle_id: "77777777-7777-4777-8777-777777777777",
        payload_revision: 3,
        payload_sha256: "a".repeat(64),
        data_decision_id: "66666666-6666-4666-8666-666666666666",
        image_decision_id: "55555555-5555-4555-8555-555555555555",
        confirm: true,
      }),
    )
  }, id)
  await page.goto(path)
  await expect(
    page.getByRole("button", { name: "Diesen Veröffentlichungsvorgang prüfen", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Werte und Anwendung freigeben", exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Diesen Veröffentlichungsvorgang prüfen", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Zur Veröffentlichungsfreigabe", exact: true }),
  ).toHaveCount(0)
})
