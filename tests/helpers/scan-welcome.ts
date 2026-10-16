import { expect, type Page } from "@playwright/test"

/** Leave the denied-camera modal before acting on its intentionally isolated background. */
export async function acknowledgeScanWelcomeAfterCameraFallback(page: Page) {
  await expect(page.locator("[data-scan-flow]")).toHaveAttribute("data-scan-camera", "unavailable")
  const search = page.getByRole("dialog", { name: "Produkt finden", exact: true })
  await expect(search).toBeVisible()
  await search.getByRole("button", { name: "Schließen", exact: true }).click()
  await expect(search).toBeHidden()
  const hint = page.locator("[data-scan-welcome-hint]")
  await expect(hint).toBeVisible()
  await hint.getByRole("button", { name: "Verstanden" }).click()
  await expect(hint).toHaveCount(0)
}
