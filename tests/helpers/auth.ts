/**
 * Playwright auth helper: creates a test user via Supabase admin API,
 * then logs in through the UI login form.
 */

import { createClient } from "@supabase/supabase-js"
import type { Page } from "@playwright/test"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_EMAIL = "qa-test@hairconscierge.test"
const TEST_PASSWORD = "qa-test-password-2026!"

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Ensure the test user exists. Creates with a confirmed email + password if missing.
 */
async function ensureTestUser() {
  const admin = getAdminClient()

  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existing = existingUsers?.users?.find((u) => u.email === TEST_EMAIL)

  if (existing) return existing

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })

  if (error) throw new Error(`Failed to create test user: ${error.message}`)
  return data.user
}

/**
 * Authenticate a Playwright page by filling the login form on /auth.
 */
export async function authenticatePage(page: Page) {
  await ensureTestUser()

  await page.goto("/auth", { waitUntil: "networkidle" })

  // Make sure we're on the login tab
  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  await loginTab.click()

  // Fill credentials
  await page.getByPlaceholder("E-Mail-Adresse").fill(TEST_EMAIL)
  await page.getByPlaceholder("Passwort").fill(TEST_PASSWORD)

  // Submit
  await page.getByRole("button", { name: "Anmelden", exact: true }).click()

  // Wait for redirect to /chat
  await page.waitForURL("**/chat**", { timeout: 15_000 })
}
