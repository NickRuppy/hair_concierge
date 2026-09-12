import { expect, test, type Page } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * End-to-end journey of the scanner-first funnel package `scan_v1`:
 * `/lp/scan` → quiz with the three scanner inserts → lead capture → the
 * `scan-regal-v1` offer → provisioning on `/plan-bereit` → `/scan` → a real
 * `/api/scan/resolve` call.
 *
 * PAYMENT IS NOT EXERCISED. There is no CI-safe real-payment path in this repo
 * (tests/stripe-subscription-e2e.spec.ts is manual/skipped), so this spec
 * mirrors tests/quiz-onboarding-e2e.spec.ts and skips the checkout by
 * authenticating directly through `/auth?next=…&lead=<leadId>` with a
 * service-role-seeded, entitled user. Everything before and after the payment
 * step is driven for real against the running app.
 *
 * LOCAL GATE (same shape as tests/tracker-page.spec.ts): the spec writes rows to
 * the configured Supabase project, so it only runs with live secrets AND
 * `PLAYWRIGHT_RUN_SCAN_FUNNEL_LIVE=1`. The CI journey lane sets that variable
 * (plus `SCAN_FUNNEL_ENABLED`, `FUNNEL_ATTRIBUTION_ENABLED` and
 * `FUNNEL_COOKIE_SIGNING_SECRET`) in its own env block. Locally:
 *
 *   PLAYWRIGHT_RUN_SCAN_FUNNEL_LIVE=1 PLAYWRIGHT_BASE_URL=http://localhost:3405 \
 *     npx playwright test tests/scan-funnel-journey.spec.ts --project=chromium
 *
 * Every row this spec creates is removed again in `afterAll`.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasLiveSecrets = Boolean(supabaseUrl && serviceRoleKey)
const runScanFunnelJourney = hasLiveSecrets && process.env.PLAYWRIGHT_RUN_SCAN_FUNNEL_LIVE === "1"

const admin: SupabaseClient | null = hasLiveSecrets
  ? createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

/** Nivea Shampoo — a real EAN with a valid GS1 check digit, used across the scan tests. */
const SCAN_EAN = "4006381333931"

async function hideCookieBanner(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
  })
}

test.describe.serial("@scan-funnel scan_v1 funnel journey", () => {
  const email = `info+playwright-scan-funnel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@chaarlie.de`
  const password = "Playwright123!"
  const fullName = "Playwright Scan"
  let userId: string | null = null
  let leadId: string | null = null
  let offerFunnelSessionId: string | null = null
  const funnelSessionIds = new Set<string>()

  test.skip(
    !runScanFunnelJourney,
    "Set PLAYWRIGHT_RUN_SCAN_FUNNEL_LIVE=1 with live Supabase secrets to run the scan funnel journey",
  )

  test.beforeEach(async ({ page }) => {
    // The result artifact render is a heavy side quest of the quiz handoff and
    // has nothing to do with the funnel journey — same stub the quiz E2E uses.
    await page.route("**/api/quiz/result-artifact", async (route) => {
      await route.fulfill({ contentType: "application/json", status: 202, body: "{}" })
    })
  })

  async function fetchLatestLead() {
    const { data, error } = await admin!
      .from("leads")
      .select("id, email, status, user_id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data as { id: string; status: string | null; user_id: string | null } | null
  }

  async function fetchFunnelSessionForLead(lead: string) {
    const { data, error } = await admin!
      .from("funnel_sessions")
      .select("id, package_key, offer_variant")
      .eq("lead_id", lead)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data as { id: string; package_key: string; offer_variant: string } | null
  }

  async function fetchPersonalPlan() {
    if (!userId) return null
    const { data, error } = await admin!
      .from("personal_plans")
      .select("id, current_initial_need_version_id")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) throw error
    return data as { id: string; current_initial_need_version_id: string | null } | null
  }

  test.beforeAll(async () => {
    if (!runScanFunnelJourney) return

    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await admin!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) throw error
    userId = data.user?.id ?? null
    if (!userId) throw new Error("Failed to create scan funnel E2E user")

    const { error: profileError } = await admin!.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        stripe_customer_id: `cus_scan_${userId}`,
        subscription_status: "active",
        current_period_end: currentPeriodEnd,
        // Same QA convention as the repo's dev login (src/lib/dev/local-login.ts):
        // a seeded test account is provisioned past legacy onboarding. Without it
        // the proxy's intake gate bounces /scan to /onboarding for a plain
        // subscription buyer (see the report's concern about that gate).
        onboarding_completed: true,
      },
      { onConflict: "id" },
    )
    if (profileError) throw profileError

    const { error: billingError } = await admin!.from("billing_subscriptions").upsert(
      {
        user_id: userId,
        provider: "stripe",
        provider_customer_id: `cus_scan_${userId}`,
        provider_subscription_id: `sub_scan_${userId}`,
        provider_status: "active",
        entitlement_status: "active",
        interval: "month",
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
        metadata: { ci_seed: "scan-funnel-journey" },
      },
      { onConflict: "provider,provider_subscription_id" },
    )
    if (billingError && billingError.code !== "PGRST205") throw billingError
  })

  test.afterAll(async () => {
    if (!admin) return

    function report(step: string, error: { message: string } | null) {
      // Teardown must never mask a green run, but a silent failure would leave
      // rows in the shared project — so every failure is at least visible.
      if (error) console.warn(`[scan-funnel-journey] cleanup failed: ${step}: ${error.message}`)
    }

    if (userId) {
      // Provisioning writes immutable `personal_plan_*` version rows that also
      // hold an FK on the lead; plain DELETEs are rejected by the immutability
      // trigger. This is the erasure RPC the repo's own account reset uses.
      const { error } = await admin.rpc("personal_plan_erase_owner_data", { p_user_id: userId })
      report("personal_plan_erase_owner_data", error)
    }

    // funnel_sessions.lead_id is ON DELETE SET NULL, so the sessions have to go
    // before the lead they point at or they can no longer be found.
    for (const sessionId of funnelSessionIds) {
      const { error } = await admin.from("funnel_sessions").delete().eq("id", sessionId)
      report("funnel_sessions", error)
    }
    report("leads", (await admin.from("leads").delete().eq("email", email)).error)

    if (!userId) return

    for (const table of ["user_product_usage", "billing_subscriptions", "hair_profiles"]) {
      report(table, (await admin.from(table).delete().eq("user_id", userId)).error)
    }
    report("profiles", (await admin.from("profiles").delete().eq("id", userId)).error)
    const { error: userError } = await admin.auth.admin.deleteUser(userId)
    report("auth user", userError)
  })

  test("scan_v1 carries a visitor from /lp/scan to a real scan verdict", async ({ page }) => {
    await hideCookieBanner(page)
    await test.step("Landing sets the scan_v1 funnel session", async () => {
      await page.goto("/lp/scan", { waitUntil: "networkidle" })
      await expect(
        page.getByRole("heading", { name: "200 Shampoos im Regal. Eins passt zu dir." }),
      ).toBeVisible()

      const sessionResponse = await page.request.get("/api/funnel/session")
      expect(sessionResponse.ok()).toBe(true)
      const session = (await sessionResponse.json()) as {
        funnelPackageKey: string | null
        funnelSessionId: string | null
      }
      expect(session.funnelPackageKey).toBe("scan_v1")
      if (session.funnelSessionId) funnelSessionIds.add(session.funnelSessionId)
    })

    await test.step("Quiz runs the three scanner inserts", async () => {
      await page.getByRole("link", { name: "Haarprofil erstellen" }).first().click()
      await page.waitForURL((url) => url.pathname === "/quiz", { timeout: 30_000 })

      await expect(page.getByRole("note")).toContainText("dann prüft der Scanner deine Produkte.")
      await expect(
        page.getByRole("heading", { name: /Welche Haarstruktur haben die meisten deiner Haare/i }),
      ).toBeVisible()

      await page.getByRole("button", { name: "Wellig", exact: true }).click()
      await expect(page.getByText("2/10")).toBeVisible()
      await page.getByRole("button", { name: "Fein", exact: true }).click()
      await expect(page.getByText("3/10")).toBeVisible()
      await page.getByRole("button", { name: "Mittlere Dichte", exact: true }).click()

      // Insert 16 — "Das Problem", right after the density question.
      const problemInsert = page.locator('[data-scan-insert="problem"]')
      await expect(problemInsert).toBeVisible()
      await expect(problemInsert.getByText("Das Problem", { exact: true })).toBeVisible()
      await expect(
        problemInsert.getByRole("heading", { name: "Vorm Regal raten alle." }),
      ).toBeVisible()
      await expect(problemInsert.getByText("Passt nicht zu deinem Haar")).toBeVisible()
      // The insert's "Weiter" renders into the mobile bottom-action portal outside
      // the insert container, so it is addressed page-level (exactly one copy is in
      // the accessibility tree at any viewport).
      await page.getByRole("button", { name: /^Weiter$/ }).click()
      await expect(page.getByText("4/10")).toBeVisible()

      await page.getByRole("button", { name: "Mittellang", exact: true }).click()
      await expect(page.getByText("5/10")).toBeVisible()
      await page.getByRole("button", { name: "Leicht uneben", exact: true }).click()
      await expect(page.getByText("6/10")).toBeVisible()
      await page.getByRole("button", { name: "Dehnt sich und geht zurück", exact: true }).click()

      await expect(
        page.getByRole("heading", { name: /Sind deine Haare chemisch behandelt/i }),
      ).toBeVisible()
      await page.getByRole("button", { name: "Naturhaar", exact: true }).click()
      await page.getByRole("button", { name: /Weiter$/ }).click()

      await expect(page.getByText("8/10")).toBeVisible()
      await expect(
        page.getByRole("heading", { name: /Wie fühlt sich deine Kopfhaut normalerweise an/i }),
      ).toBeVisible()
      await page.getByRole("button", { name: "Ausgeglichen", exact: true }).click()
      await expect(
        page.getByRole("heading", {
          name: /Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen/i,
        }),
      ).toBeVisible()
      await page.getByRole("button", { name: "Nein", exact: true }).click()

      // Insert 17 — "Die Lösung", right after the scalp question.
      const solutionInsert = page.locator('[data-scan-insert="solution"]')
      await expect(solutionInsert).toBeVisible()
      await expect(solutionInsert.getByText("Die Lösung", { exact: true })).toBeVisible()
      await expect(
        solutionInsert.getByRole("heading", { name: "Nicht mehr raten. Scannen." }),
      ).toBeVisible()
      await expect(solutionInsert.getByText("Passt nicht zu deiner Kopfhaut")).toBeVisible()
      // The insert's "Weiter" renders into the mobile bottom-action portal outside
      // the insert container, so it is addressed page-level (exactly one copy is in
      // the accessibility tree at any viewport).
      await page.getByRole("button", { name: /^Weiter$/ }).click()

      await expect(page.getByText("9/10")).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Was beschäftigt dich gerade?" }),
      ).toBeVisible()
      await page
        .getByRole("button", { name: "Frizz oder viele abstehende Haare", exact: true })
        .click()
      await page.getByRole("button", { name: /Weiter$/ }).click()

      await expect(page.getByRole("heading", { name: /Was wünschst du dir für/ })).toBeVisible({
        timeout: 10_000,
      })
      await page.getByRole("button", { name: /Mehr Glanz/ }).click()
      await page.getByRole("button", { name: /Weiter$/ }).click()

      // Insert 18 — "Und zu Hause", right after the goals question.
      const homeInsert = page.locator('[data-scan-insert="home"]')
      await expect(homeInsert).toBeVisible()
      await expect(homeInsert.getByText("Und zu Hause", { exact: true })).toBeVisible()
      await expect(
        homeInsert.getByRole("heading", { name: "Dein Bad ist das erste Regal." }),
      ).toBeVisible()
      // The insert's "Weiter" renders into the mobile bottom-action portal outside
      // the insert container, so it is addressed page-level (exactly one copy is in
      // the accessibility tree at any viewport).
      await page.getByRole("button", { name: /^Weiter$/ }).click()
    })

    await test.step("Lead capture and the scanner commit screen", async () => {
      await expect(page.getByText("Dein Haarprofil ist fertig.")).toBeVisible({ timeout: 15_000 })

      await page.getByPlaceholder("Dein Vorname").fill("Playwright")
      await page.getByRole("button", { name: /Weiter zum Ergebnis/ }).click()

      await page.getByPlaceholder("name@beispiel.de").fill(email)
      await page.getByRole("button", { name: /Weiter$/ }).click()

      await page.getByRole("button", { name: "Ja, weiter zu meiner Auswertung" }).click()

      await expect(
        page.getByRole("heading", { name: /bereit für deinen ersten Scan\?/ }),
      ).toBeVisible({ timeout: 20_000 })
      const commitButton = page.getByRole("button", { name: "Ja, zeig mir meinen Scanner" })
      await expect(commitButton).toBeVisible()

      await expect
        .poll(async () => (await fetchLatestLead())?.id ?? null, { timeout: 30_000 })
        .not.toBeNull()
      leadId = (await fetchLatestLead())!.id

      await commitButton.click()
      await expect(page.getByText("Wir richten deinen Scanner ein.")).toBeVisible({
        timeout: 10_000,
      })
      await page.waitForURL((url) => url.pathname === `/result/${leadId}`, { timeout: 30_000 })
    })

    await test.step("The scan-regal-v1 offer renders and is the recorded variant", async () => {
      await expect(page.locator('[data-offer-section="scan_criteria"]')).toHaveCount(1)
      await expect(
        page.getByRole("heading", { name: "Nie wieder raten vorm Regal." }),
      ).toBeVisible()
      await expect(page.locator('[data-offer-section="pricing"]')).toHaveCount(1)

      await expect
        .poll(async () => (await fetchFunnelSessionForLead(leadId!))?.package_key ?? null, {
          timeout: 30_000,
        })
        .toBe("scan_v1")

      const funnelSession = await fetchFunnelSessionForLead(leadId!)
      funnelSessionIds.add(funnelSession!.id)
      offerFunnelSessionId = funnelSession!.id
      expect(funnelSession?.offer_variant).toBe("scan-regal-v1")
    })

    await test.step("Payment is bypassed; /plan-bereit provisions the scanner", async () => {
      // See the file header: no real payment runs here. /plan-bereit resolves the
      // buyer through `findPersonalPlanEnrollmentForUser`, which needs the
      // correlation a completed checkout writes — the lead bound to the account,
      // the funnel session marked purchased, and a launch-catalog subscription
      // carrying that checkout reference. Those three writes are seeded with the
      // service role instead of charging a card; everything downstream of them
      // (readiness poll, provisioning, scanner hand-over) runs for real.
      const purchaseReference = `cs_test_scan_funnel_${Date.now()}`
      const paidAt = new Date().toISOString()

      const { error: sessionError } = await admin!
        .from("funnel_sessions")
        .update({
          user_id: userId,
          purchase_provider: "stripe",
          purchase_reference: purchaseReference,
          purchase_completed_at: paidAt,
        })
        .eq("id", offerFunnelSessionId!)
      if (sessionError) throw sessionError

      const { error: subscriptionError } = await admin!
        .from("billing_subscriptions")
        .update({
          metadata: {
            ci_seed: "scan-funnel-journey",
            pricing_catalog: "personal_plan_launch_v1",
            checkout_session_id: purchaseReference,
          },
        })
        .eq("user_id", userId!)
      if (subscriptionError) throw subscriptionError

      // Account binding: the same `/auth?next=/onboarding&lead=<id>` shortcut the
      // quiz E2E uses. Logging in with the lead is what runs `linkQuizToProfile`
      // — it writes `leads.user_id` and the `hair_profiles` row that both the
      // enrollment lookup and `/scan`'s route guard require. A real buyer gets
      // this from the post-checkout account creation.
      await page.goto(`/auth?next=/onboarding&lead=${leadId}`, { waitUntil: "networkidle" })

      await page.getByPlaceholder("E-Mail-Adresse").fill(email)
      await page.getByPlaceholder("Passwort").fill(password)
      const loginButton = page.getByRole("button", { name: /^Anmelden$/ })
      await expect(loginButton).toBeEnabled()
      await loginButton.click()

      await page.waitForURL((url) => url.pathname !== "/auth", {
        timeout: 60_000,
        waitUntil: "domcontentloaded",
      })
      await expect
        .poll(async () => (await fetchLatestLead())?.user_id ?? null, { timeout: 30_000 })
        .toBe(userId)

      // The post-login landing redirects itself onward (frontier routing), so let
      // that chain settle before steering to the buyer's hand-over screen —
      // otherwise the goto races the app's own navigation. The retry covers the
      // case where a redirect still lands between the settle and the goto.
      await page.waitForLoadState("networkidle")
      for (let attempt = 1; ; attempt += 1) {
        try {
          await page.goto(`/plan-bereit?lead=${leadId}`, { waitUntil: "domcontentloaded" })
          break
        } catch (error) {
          if (attempt >= 3) throw error
          await page.waitForLoadState("networkidle")
        }
      }

      // Both arrival headlines are always in the DOM — the frame morphs in place
      // and hides the other one from assistive tech, so match on the role and
      // take whichever one is currently exposed.
      const arrivalHeadline = page
        .getByRole("heading", { name: "Wir richten deinen Scanner ein." })
        .or(page.getByRole("heading", { name: "Dein Scanner ist startklar." }))
      await expect(arrivalHeadline.first()).toBeVisible({ timeout: 60_000 })

      // Provisioning runs behind the readiness poll, so the CTA is the signal
      // that the scanner destination is actually reachable.
      const scannerCta = page.getByRole("link", { name: "Scanner öffnen" })
      await expect(scannerCta).toBeVisible({ timeout: 120_000 })

      await expect
        .poll(async () => (await fetchPersonalPlan())?.current_initial_need_version_id ?? null, {
          timeout: 60_000,
        })
        .not.toBeNull()
    })

    await test.step("The scanner greets the buyer once", async () => {
      await page.getByRole("link", { name: "Scanner öffnen" }).click()
      await page.waitForURL(
        (url) => url.pathname === "/scan" && url.searchParams.get("welcome") === "scan",
        { timeout: 60_000 },
      )

      const hint = page.locator("[data-scan-welcome-hint]")
      await expect(hint).toBeVisible({ timeout: 30_000 })
      await expect(hint).toContainText("Dein Scanner ist startklar. Dein Plan wartet daneben.")

      await hint.getByRole("button", { name: "Verstanden" }).click()
      await expect(hint).toHaveCount(0)

      await page.reload({ waitUntil: "domcontentloaded" })
      await expect(page.locator("[data-scan-welcome-hint]")).toHaveCount(0)
    })

    await test.step("A real /api/scan/resolve call clears the profile gate", async () => {
      const response = await page.request.post("/api/scan/resolve", {
        data: { identifier: { type: "ean", value: SCAN_EAN } },
      })

      // The catalog content decides whether this EAN yields a verdict or an
      // unknown-product outcome; both prove the snapshot exists. Only the
      // profile gate (409 `profile_missing`) is a journey failure.
      expect(response.status()).not.toBe(409)
      const body = await response.text()
      expect(body).not.toContain("profile_missing")
    })
  })
})
