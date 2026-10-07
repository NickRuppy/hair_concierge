import { test, expect } from "@playwright/test"
import { build } from "esbuild"
import { createServer, type Server } from "node:http"

// Mount the real analytics and recovery components. Provider verification and
// payment APIs are deliberately absent: this fixture proves browser navigation,
// document reload, storage failure and analytics privacy, not authorization.
let server: Server
let origin: string

test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
        import { CheckoutReturnAnalytics } from './src/app/welcome/checkout-return-analytics';
        import { WelcomeReturnRecovery } from './src/app/welcome/return-recovery-client';
        import { MetaPixelProvider } from './src/providers/meta-pixel-provider';
        window.events = [];
        const q = new URLSearchParams(location.search);
        const hasProof = q.has('session_id') || q.has('token');
        createRoot(document.getElementById('root')).render(
          <MetaPixelProvider>{location.pathname === '/' ? <h1>Landing</h1> : hasProof ? <>
            <CheckoutReturnAnalytics purchase={q.has('paid') ? {currency:'EUR', value:9.99, interval:'month', planId:'monthly'} : null} sessionId={q.get('session_id') || 'paypal:hashed'} redirectTo={q.get('complete') === '1' ? '/' : undefined} isTrialCheckout={!q.has('paid')} />
            <h1>Konto aktivieren</h1>
          </> : <WelcomeReturnRecovery />}</MetaPixelProvider>);`,
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
        name: "external-effects-only",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(next\/navigation|@\/lib\/(analytics\/track-app-event|meta-pixel|observability\/checkout))$/,
            },
            (args) => ({ path: args.path, namespace: "fixture-effects" }),
          )
          b.onLoad({ filter: /.*/, namespace: "fixture-effects" }, () => ({
            contents: `export const usePathname = () => location.pathname;
            export const useSearchParams = () => new URLSearchParams(location.search);
            export const useRouter = () => ({ replace: p => location.replace(p) });
            export const trackMetaPageView = () => { window.events.push({ kind: 'page', url: location.href }); window.recordWelcomeAnalytics?.(location.href); };
            export const trackAppEvent = () => window.events.push({ kind: 'event', url: location.href });
            export const addCheckoutBreadcrumb = () => {};
            export const captureCheckoutException = () => {};`,
          }))
        },
      },
    ],
  })
  const js = bundle.outputFiles[0].text
  server = createServer((req, res) => {
    if (req.url === "/fixture.js") {
      res.setHeader("content-type", "application/javascript")
      res.end(js)
    } else {
      res.setHeader("content-type", "text/html")
      res.end('<!doctype html><div id="root"></div><script src="/fixture.js"></script>')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Fixture server unavailable")
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
})

for (const query of [
  "session_id=cs_live_original",
  "provider=paypal&token=original",
  "provider=paypal&token=original&purchase=one_time&return_state=revoked",
]) {
  test(`@ci activation survives repeated reload: ${query.split("=")[0]} ${query.includes("one_time") ? "one-time" : ""}`, async ({
    page,
  }) => {
    const restored: string[] = []
    const pageViews: string[] = []
    await page.exposeFunction("recordWelcomeAnalytics", (url: string) => {
      pageViews.push(url)
    })
    page.on("request", (req) => {
      if (req.isNavigationRequest()) restored.push(req.url())
    })
    await page.goto(`${origin}/welcome?${query}`)
    await expect(page.getByRole("heading", { name: "Konto aktivieren" })).toBeVisible()
    await expect(page).toHaveURL(`${origin}/welcome`)
    for (let i = 0; i < 2; i++) {
      await page.reload()
      await expect(page.getByRole("heading", { name: "Konto aktivieren" })).toBeVisible()
      await expect(page).toHaveURL(`${origin}/welcome`)
      expect(await page.evaluate(() => (window as any).events)).toEqual([
        { kind: "page", url: `${origin}/welcome` },
      ])
    }
    expect(restored.filter((url) => url === `${origin}/welcome?${query}`)).toHaveLength(3)
    await expect.poll(() => pageViews.length).toBe(3)
    expect(pageViews).toEqual(Array(3).fill(`${origin}/welcome`))
  })
}

test("@ci blocked browser storage keeps the original return reloadable without analytics", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("blocked")
      },
    })
  })
  const url = `${origin}/welcome?session_id=cs_live_original&paid=1`
  await page.goto(url)
  await expect(page.getByRole("heading", { name: "Konto aktivieren" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Konto aktivieren" })).toBeVisible()
  await expect(page).toHaveURL(url)
  expect(await page.evaluate(() => (window as any).events)).toEqual([])
})

test("@ci bare welcome without proof keeps the landing fallback", async ({ page }) => {
  await page.goto(`${origin}/welcome`)
  await expect(page.getByRole("heading", { name: "Landing" })).toBeVisible()
  await expect(page).toHaveURL(`${origin}/`)
})

test("@ci completed activation clears the pending return", async ({ page }) => {
  await page.goto(`${origin}/welcome?session_id=cs_live_original`)
  await expect(page).toHaveURL(`${origin}/welcome`)
  await page.goto(`${origin}/welcome?session_id=cs_live_original&complete=1`)
  await expect(page.getByRole("heading", { name: "Landing" })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem("chaarlie:welcome-return:v1"))).toBeNull()
})

test("@ci real bare welcome restores the original reference without a server redirect", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL,
    "Run with the built Next app's PLAYWRIGHT_BASE_URL",
  )
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "chaarlie:welcome-return:v1",
      JSON.stringify({
        path: "/welcome?session_id=cs_recovery_fixture",
        savedAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }),
    )
  })
  let restored = false
  await page.route("**/welcome?session_id=cs_recovery_fixture", async (route) => {
    restored = true
    await route.fulfill({ contentType: "text/html", body: "<h1>Original return restored</h1>" })
  })
  await page.goto(`${baseURL}/welcome`)
  await expect(page.getByRole("heading", { name: "Original return restored" })).toBeVisible()
  expect(restored).toBe(true)
})

test("@ci real bare welcome without JavaScript keeps the landing fallback", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL,
    "Run with the built Next app's PLAYWRIGHT_BASE_URL",
  )
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto(`${baseURL}/welcome`)
    await expect(page).toHaveURL(`${baseURL}/`)
  } finally {
    await context.close()
  }
})
