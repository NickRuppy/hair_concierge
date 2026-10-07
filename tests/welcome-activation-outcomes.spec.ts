import { test, expect } from "@playwright/test"
import { build } from "esbuild"
import { createServer, type Server } from "node:http"

test.describe("@ci checkout recovery", () => {
  let server: Server
  let origin: string

  test.beforeAll(async () => {
    const bundle = await build({
      stdin: {
        contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {WelcomeClient} from './src/app/welcome/welcome-client';
      const q=new URLSearchParams(location.search);
      const provider=q.get('provider') || 'stripe';
      createRoot(document.getElementById('root')).render(<WelcomeClient
        email="alex@example.com" purchase={null} isTrialCheckout
        recoveryCode={q.get('code') || undefined} mode={q.get('mode') || 'activation'}
        activationSource={provider==='paypal'?{provider,token:'fixture-token'}:{provider,sessionId:'cs_fixture'}} />);`,
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      bundle: true,
      write: false,
      platform: "browser",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [
        {
          name: "external-effects",
          setup(b) {
            b.onResolve(
              {
                filter:
                  /^(next\/navigation|@\/lib\/supabase\/client|@\/components\/providers\/payment-runtime-provider|@\/lib\/observability\/.*|@\/app\/plan-bereit\/.*|@\/components\/personal-plan-start\/.*|@\/lib\/personal-plan\/stage-navigation-intent|\.\/checkout-return-analytics)$/,
              },
              (args) => ({ path: args.path, namespace: "effects" }),
            )
            b.onLoad({ filter: /.*/, namespace: "effects" }, () => ({
              contents: `export const useRouter=()=>({replace:p=>location.assign(p)});
        export const usePaymentRuntime=()=>({paypalLive:false});
        export const createClient=()=>({auth:{signInWithPassword:async()=>({error:new URLSearchParams(location.search).has('signinFail')?new Error('fixture failure'):null})}});
        export const captureCheckoutException=()=>{}; export const addCheckoutBreadcrumb=()=>{}; export const capturePaymentFailure=()=>{};
        export const CheckoutReturnAnalytics=()=>null; export const markPlanOpeningStart=()=>{};
        export const markPersonalPlanStageNavigation=()=>{}; export const PlanBereitArrival=()=>null; export const PlanStartOpening=()=>null;`,
            }))
          },
        },
      ],
    })
    server = createServer((req, res) => {
      if (req.url === "/fixture.js") {
        res.setHeader("content-type", "application/javascript")
        res.end(bundle.outputFiles[0].text)
      } else {
        res.setHeader("content-type", "text/html")
        res.end(
          '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/fixture.js"></script>',
        )
      }
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("No fixture server")
    origin = `http://127.0.0.1:${address.port}`
  })
  test.afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test("verified terminal denial replaces activation choices and links to real recovery destinations", async ({
    page,
  }) => {
    await page.goto(`${origin}/welcome?code=trial_unavailable`)
    await expect(
      page.getByRole("heading", { name: "Kein weiterer kostenloser Test" }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Login-Link senden" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Support kontaktieren" })).toHaveAttribute(
      "href",
      "/kontakt",
    )
    await expect(page.getByRole("link", { name: "Ich habe bereits ein Konto" })).toHaveAttribute(
      "href",
      "/auth",
    )
    await expect(page.getByRole("alert")).toBeFocused()
    await page.reload()
    await expect(
      page.getByRole("heading", { name: "Kein weiterer kostenloser Test" }),
    ).toBeVisible()
  })

  for (const provider of ["stripe", "paypal"]) {
    test(`${provider} post denial uses trusted code rather than server exception text`, async ({
      page,
    }) => {
      await page.route("**/api/auth/send-magic-link", (route) =>
        route.fulfill({
          status: 403,
          json: { code: "trial_unavailable", error: "PRIVATE provider details" },
        }),
      )
      await page.goto(`${origin}/welcome?provider=${provider}`)
      await page.getByRole("button", { name: "Login-Link senden" }).click()
      await expect(
        page.getByRole("heading", { name: "Kein weiterer kostenloser Test" }),
      ).toBeVisible()
      await expect(page.getByText("PRIVATE provider details")).toHaveCount(0)
    })
  }

  test("email send failure keeps password input and allows a successful resend", async ({
    page,
  }) => {
    let requests = 0
    await page.route("**/api/auth/send-magic-link", (route) => {
      requests++
      return route.fulfill(
        requests === 1
          ? { status: 500, json: { code: "auth_link_send_failed" } }
          : { json: { ok: true } },
      )
    })
    await page.goto(`${origin}/welcome`)
    await page.getByLabel("Passwort", { exact: true }).fill("Example123")
    await page.getByRole("button", { name: "Login-Link senden" }).click()
    await expect(page.getByRole("alert")).toContainText("Dein Konto ist bereit.")
    await expect(page.getByLabel("Passwort", { exact: true })).toHaveValue("Example123")
    await page.getByRole("button", { name: "Login-Link senden" }).click()
    await expect(page.getByRole("heading", { name: "Check deine E-Mails" })).toBeVisible()
    expect(requests).toBe(2)
  })

  test("used activation claim leads to normal login without offering another activation attempt", async ({
    page,
  }) => {
    await page.route("**/api/auth/send-magic-link", (route) =>
      route.fulfill({ status: 409, json: { code: "activation_login_required" } }),
    )
    await page.goto(`${origin}/welcome`)
    await page.getByRole("button", { name: "Login-Link senden" }).click()
    await expect(page.getByRole("link", { name: "Zum Login" })).toHaveAttribute("href", "/auth")
    await expect(page.getByRole("button", { name: "Login-Link senden" })).toHaveCount(0)
  })

  test("PayPal terminal polling outcome stops pending and exposes support", async ({ page }) => {
    let polls = 0
    await page.route("**/api/paypal/activation-status?*", (route) => {
      polls++
      return route.fulfill({ json: { status: "duplicate", code: "trial_checkout_conflict" } })
    })
    await page.goto(`${origin}/welcome?provider=paypal&mode=pending`)
    await expect(page.getByRole("heading", { name: "Andere Anmeldung offen" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Status prüfen" })).toHaveCount(0)
    expect(polls).toBe(1)
  })

  test("password saved but sign-in failed offers login with the new password", async ({ page }) => {
    await page.route("**/api/auth/set-checkout-password", (route) =>
      route.fulfill({ json: { ok: true, email: "alex@example.com" } }),
    )
    await page.goto(`${origin}/welcome?signinFail=1`)
    await page.getByLabel("Passwort", { exact: true }).fill("Example123")
    await page.getByLabel("Passwort wiederholen").fill("Example123")
    await page.getByRole("button", { name: "Passwort erstellen" }).click()
    await expect(page.getByRole("heading", { name: "Passwort gespeichert" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Zum Login" })).toHaveAttribute("href", "/auth")
  })

  for (const code of ["activation_temporary", "auth_rate_limited"]) {
    test(`${code} retains both password fields and supports retry`, async ({ page }) => {
      let requests = 0
      await page.route("**/api/auth/set-checkout-password", (route) => {
        requests++
        return route.fulfill({ status: code === "auth_rate_limited" ? 429 : 503, json: { code } })
      })
      await page.goto(`${origin}/welcome`)
      await page.getByLabel("Passwort", { exact: true }).fill("Example123")
      await page.getByLabel("Passwort wiederholen").fill("Example123")
      await page.getByRole("button", { name: "Passwort erstellen" }).click()
      await expect(page.getByRole("alert")).toBeVisible()
      await expect(page.getByLabel("Passwort", { exact: true })).toHaveValue("Example123")
      await expect(page.getByLabel("Passwort wiederholen")).toHaveValue("Example123")
      await page.getByRole("button", { name: "Passwort erstellen" }).click()
      expect(requests).toBe(2)
    })
  }

  test("all terminal recovery states remove resubmission and private account details", async ({
    page,
  }) => {
    for (const code of [
      "trial_unavailable",
      "trial_checkout_conflict",
      "trial_checkout_closed",
      "trial_reconciliation_required",
      "checkout_existing_access",
      "activation_link_invalid",
      "activation_login_required",
      "password_sign_in_failed",
    ]) {
      await page.goto(`${origin}/welcome?code=${code}`)
      await expect(page.getByRole("alert")).toBeVisible()
      await expect(page.locator("input")).toHaveCount(0)
      await expect(page.getByText("alex@example.com")).toHaveCount(0)
      await expect(page.locator('main a[href="/auth"]')).toHaveCount(1)
      await expect(page.locator('main a[href="/kontakt"]')).toHaveCount(1)
    }
  })

  test("PayPal pending POST continues status checking and handles a non-2xx terminal result", async ({
    page,
  }) => {
    await page.route("**/api/auth/send-magic-link", (route) =>
      route.fulfill({ status: 409, json: { code: "activation_pending" } }),
    )
    await page.route("**/api/paypal/activation-status?*", (route) =>
      route.fulfill({ status: 503, json: { code: "trial_reconciliation_required" } }),
    )
    await page.goto(`${origin}/welcome?provider=paypal`)
    await page.getByRole("button", { name: "Login-Link senden" }).click()
    await expect(page.getByRole("heading", { name: "Zugang noch nicht bereit" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Status prüfen" })).toHaveCount(0)
  })

  test("pending refresh preserves the same return reference", async ({ page }) => {
    await page.goto(`${origin}/welcome?code=activation_pending&session_id=cs_fixture`)
    await page.getByRole("button", { name: "Status prüfen" }).click()
    await expect(page.getByRole("heading", { name: "Zugang wird vorbereitet" })).toBeVisible()
    expect(new URL(page.url()).searchParams.get("session_id")).toBe("cs_fixture")
  })

  test("PayPal poll timeout replaces the spinner with status-retry feedback", async ({ page }) => {
    await page.clock.install()
    let polls = 0
    await page.route("**/api/paypal/activation-status?*", async (route) => {
      polls++
      await route.fulfill({ json: { status: "pending" } })
    })
    await page.goto(`${origin}/welcome?provider=paypal&mode=pending`)
    for (let i = 0; i < 15; i++) {
      const response = page.waitForResponse("**/api/paypal/activation-status?*")
      await page.clock.runFor(2000)
      await (await response).finished()
      await page.evaluate(() => Promise.resolve())
    }
    await expect(page.getByRole("heading", { name: "Die Einrichtung dauert länger" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Status prüfen" })).toBeVisible()
    expect(polls).toBe(15)
    await page.clock.runFor(6000)
    expect(polls).toBe(15)
  })
})
