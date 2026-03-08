import type { Page } from "@playwright/test"

/**
 * Authenticate a Playwright page using the test user account.
 */
export async function authenticatePage(page: Page): Promise<void> {
  await page.goto("/auth")
  await page.fill('input[type="email"]', process.env.QA_TEST_EMAIL ?? "qa-test@hairconscierge.test")
  await page.fill('input[type="password"]', process.env.QA_TEST_PASSWORD ?? "test-password")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/chat**", { timeout: 10_000 })
}
