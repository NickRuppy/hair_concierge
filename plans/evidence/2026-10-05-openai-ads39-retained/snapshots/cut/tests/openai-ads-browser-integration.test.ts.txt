import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { chromium, type Browser, type BrowserContext } from "playwright"

// Compiles the actual browser integration and consent/funnel helpers. Every HTTP request
// is fulfilled or aborted locally; this never contacts Chaarlie, OpenAI, or a provider.
const SDK_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js"
const SDK_STUB = `(() => {
 const queued = window.oaiq?.q ?? [];
 window.__sdkCommands = []; window.__sdkEvents = []; let allowed = false;
 window.oaiq = (...args) => {
  window.__sdkCommands.push(args);
  if (args[0] === 'consent') allowed = args[1] === true;
  if (args[0] === 'measure' && allowed) window.__sdkEvents.push(args);
 };
 queued.forEach(args => window.oaiq(...args));
})();`
type Observation = { url: string; method: string; body?: Record<string, unknown> }
async function bundle() {
  const result = await build({
    stdin: {
      contents: `export * from './src/lib/openai-ads/browser'; export {saveConsent} from './src/lib/cookie-consent';`,
      resolveDir: process.cwd(),
      sourcefile: "openai-browser-test.ts",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    globalName: "OpenAIHarness",
    define: {
      "process.env.NEXT_PUBLIC_OPENAI_ADS_ENABLED": '"true"',
      "process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID": '"test-pixel"',
    },
  })
  return result.outputFiles[0].text
}
async function fixture(
  browser: Browser,
  source: string,
  options: { marketing?: boolean; path?: string; holdSdk?: boolean } = {},
) {
  const context = await browser.newContext({ serviceWorkers: "block" })
  const observations: Observation[] = [],
    unexpected: string[] = []
  let releaseSdk!: () => void
  const sdkGate = new Promise<void>((resolve) => {
    releaseSdk = resolve
  })
  if (!options.holdSdk) releaseSdk()
  let state = {
    revision: 0,
    marketing: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  }
  await context.addInitScript((marketing) => {
    localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing, ts: Date.now() }),
    )
  }, options.marketing ?? true)
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = req.url()
    const body =
      req.method() === "POST" ? (req.postDataJSON() as Record<string, unknown>) : undefined
    observations.push({ url, method: req.method(), body })
    if (url === SDK_URL) {
      await sdkGate
      await route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB })
      return
    }
    const parsed = new URL(url)
    if (parsed.origin !== "https://chaarlie.de") {
      unexpected.push(url)
      await route.abort()
      return
    }
    if (parsed.pathname === "/api/openai-ads/context") {
      let status = 200
      if (body?.action === "choice") {
        if (body.marketing === true && body.expectedRevision !== state.revision) status = 409
        else state = { ...state, revision: state.revision + 1, marketing: body.marketing === true }
      } else if (
        body?.action === "context" &&
        (!state.marketing || body.expectedRevision !== state.revision)
      )
        status = 409
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(state) })
      return
    }
    if (parsed.pathname === "/api/funnel/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          funnelSessionId: "22222222-2222-4222-8222-222222222222",
          funnelPackageKey: "scan_v1",
          analyticsContextReady: true,
        }),
      })
      return
    }
    if (parsed.pathname === "/browser-test.js") {
      await route.fulfill({ status: 200, contentType: "application/javascript", body: source })
      return
    }
    if (req.isNavigationRequest()) {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: '<!doctype html><html><head><script src="/browser-test.js"></script></head><body><button id="checkout">Checkout</button><script>window.stopOpenAI=OpenAIHarness.startOpenAIAds(); OpenAIHarness.trackOpenAIAdsPage(); document.getElementById("checkout").onclick=async()=>{await OpenAIHarness.syncOpenAIAdsBeforeCheckout(); window.__checkoutReady=true;};</script></body></html>',
      })
      return
    }
    unexpected.push(url)
    await route.abort()
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`https://chaarlie.de${options.path ?? "/"}`, { waitUntil: "domcontentloaded" })
  return { context, page, observations, unexpected, errors, releaseSdk, state: () => state }
}
async function clean(context: BrowserContext) {
  await context.close()
}

test(
  "actual Chromium exercises OpenAI browser consent, navigation and checkout attribution",
  { timeout: 60000, skip: process.env.OPENAI_ADS_BROWSER_TEST_ENABLED !== "true" },
  async (t) => {
    const source = await bundle()
    const browser = await chromium.launch({ headless: true })
    t.after(() => browser.close())
    await t.test(
      "allowed landing initializes once, measures once with opt-out, and captures a safe source before checkout",
      async () => {
        const f = await fixture(browser, source, { path: "/?email=private#secret" })
        try {
          await f.page.waitForFunction("window.__sdkEvents?.length === 1")
          await f.page.evaluate("OpenAIHarness.trackOpenAIAdsPage()")
          await f.page.click("#checkout")
          await f.page.waitForFunction("window.__checkoutReady === true")
          const commands = (await f.page.evaluate("window.__sdkCommands")) as unknown[][]
          const events = (await f.page.evaluate("window.__sdkEvents")) as unknown[][]
          assert.equal(commands.filter((c) => c[0] === "init").length, 1)
          assert.equal(events.length, 1)
          assert.deepEqual(events[0], [
            "measure",
            "page_viewed",
            { type: "contents" },
            { opt_out: true },
          ])
          assert.equal(commands[0][0], "consent")
          assert.equal(commands[0][1], false)
          const posts = f.observations.filter((o) => o.body?.action === "context")
          assert.ok(posts.length >= 1)
          assert.ok(posts.every((o) => o.body?.sourceUrl === "https://chaarlie.de/"))
          assert.ok(
            posts.every(
              (o) =>
                !Object.hasOwn(o.body!, "marketing") && !Object.hasOwn(o.body!, "funnelSessionId"),
            ),
          )
          assert.ok(
            f.observations.findIndex((o) => o.url.endsWith("/api/funnel/session")) <
              f.observations.findIndex((o) => o.body?.action === "context"),
          )
          // The actual offer route binds its own sanitized source before the checkout handler completes.
          await f.page.evaluate(
            'history.pushState({},"","/result?email=private#secret"); window.__checkoutReady=false;',
          )
          await f.page.click("#checkout")
          await f.page.waitForFunction("window.__checkoutReady === true")
          assert.equal(
            f.observations.filter((o) => o.body?.action === "context").at(-1)?.body?.sourceUrl,
            "https://chaarlie.de/result",
          )
          assert.equal(((await f.page.evaluate("window.__sdkEvents")) as unknown[]).length, 1)
          // Actual client navigation into a private surface revokes the SDK and sends no page event.
          await f.page.evaluate(
            'history.pushState({},"","/admin?secret=x"); OpenAIHarness.trackOpenAIAdsPage()',
          )
          await f.page.waitForFunction(
            'window.__sdkCommands.at(-1)?.[0] === "consent" && window.__sdkCommands.at(-1)?.[1] === false',
          )
          assert.equal(((await f.page.evaluate("window.__sdkEvents")) as unknown[]).length, 1)
          assert.deepEqual(f.unexpected, [])
          assert.deepEqual(f.errors, [])
        } finally {
          await clean(f.context)
        }
      },
    )
    await t.test(
      "denied landing and initially private route never load the SDK or measure",
      async () => {
        for (const options of [
          { marketing: false, path: "/" },
          { marketing: true, path: "/admin" },
          { marketing: false, path: "/admin" },
        ]) {
          const f = await fixture(browser, source, options)
          try {
            await f.page.click("#checkout")
            await f.page.waitForFunction("window.__checkoutReady === true")
            assert.equal(
              f.observations.some((o) => o.url === SDK_URL),
              false,
            )
            assert.equal(await f.page.evaluate("window.__sdkEvents?.length ?? 0"), 0)
            if (options.path === "/admin") {
              assert.equal(
                f.observations.some((o) => o.body?.action === "context"),
                false,
              )
            }
            if (!options.marketing) {
              assert.equal(f.state().marketing, false)
              assert.ok(
                f.observations.some(
                  (o) => o.body?.action === "choice" && o.body.marketing === false,
                ),
              )
            }
            assert.deepEqual(f.unexpected, [])
            assert.deepEqual(f.errors, [])
          } finally {
            await clean(f.context)
          }
        }
      },
    )
    await t.test(
      "real saved-consent event during delayed SDK load prevents late init or events",
      async () => {
        const f = await fixture(browser, source, { holdSdk: true })
        try {
          await f.page.waitForFunction(`!!document.querySelector('script[src="${SDK_URL}"]')`)
          const deniedResponse = f.page.waitForResponse(
            (response) =>
              response.url().endsWith("/api/openai-ads/context") &&
              response.request().postDataJSON()?.marketing === false,
          )
          await f.page.evaluate("OpenAIHarness.saveConsent({analytics:false,marketing:false})")
          await deniedResponse
          f.releaseSdk()
          await f.page.waitForFunction("Array.isArray(window.__sdkCommands)")
          await f.page.click("#checkout")
          await f.page.waitForFunction("window.__checkoutReady === true")
          assert.equal(f.state().marketing, false)
          assert.equal(
            await f.page.evaluate(
              'JSON.parse(localStorage.getItem("chaarlie_cookie_consent_v1")).marketing',
            ),
            false,
          )
          const commands = (await f.page.evaluate("window.__sdkCommands")) as unknown[][]
          assert.equal(
            commands.some((c) => c[0] === "init"),
            false,
          )
          assert.equal(await f.page.evaluate("window.__sdkEvents.length"), 0)
          assert.deepEqual(f.unexpected, [])
          assert.deepEqual(f.errors, [])
        } finally {
          f.releaseSdk()
          await clean(f.context)
        }
      },
    )
  },
)
