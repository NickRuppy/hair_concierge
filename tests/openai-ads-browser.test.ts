import assert from "node:assert/strict"
import test from "node:test"

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const context = (revision: number, marketing: boolean) =>
  new Response(JSON.stringify({ revision, marketing, expiresAt: null }), { status: 200 })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function browser(fetchImpl: typeof fetch, pathname = "/") {
  const storage = new Map<string, string>()
  const listeners = new Map<string, Set<(event?: any) => void>>()
  const scripts: any[] = []
  const add = (name: string, fn: (event?: any) => void) => {
    const group = listeners.get(name) ?? new Set()
    group.add(fn)
    listeners.set(name, group)
  }
  const emit = (name: string, event?: any) => listeners.get(name)?.forEach((fn) => fn(event))
  const location = {
    pathname,
    href: `https://chaarlie.de${pathname}`,
    origin: "https://chaarlie.de",
    hostname: "chaarlie.de",
  }
  Object.assign(globalThis, {
    window: {
      location,
      localStorage: { getItem: (key: string) => storage.get(key) ?? null },
      addEventListener: add,
      removeEventListener: () => undefined,
    },
    document: {
      visibilityState: "visible",
      createElement: () => ({ remove: () => undefined }),
      head: { appendChild: (node: any) => scripts.push(node) },
      addEventListener: add,
      removeEventListener: () => undefined,
    },
    fetch: fetchImpl,
  })
  return { storage, scripts, emit, location }
}

async function api() {
  return await import("@/lib/openai-ads/browser")
}
function consent(b: ReturnType<typeof browser>, marketing: boolean) {
  b.storage.set(
    "chaarlie_cookie_consent_v1",
    JSON.stringify({ essential: true, analytics: false, marketing, ts: 1 }),
  )
}
function enable() {
  process.env.NEXT_PUBLIC_OPENAI_ADS_ENABLED = "true"
  process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID = "HQtJsN7wjuS5gYccnqd3vd"
}

test("fails closed when context GET fails", async () => {
  enable()
  const b = browser(async () => {
    throw new Error("offline")
  })
  consent(b, true)
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  await tick()
  assert.equal(b.scripts.length, 0)
})

test("does not load before consent and sends a denial without source URL", async () => {
  enable()
  const calls: RequestInit[] = []
  const b = browser(async (_url, init = {}) => {
    calls.push(init)
    return context(1, false)
  })
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  await tick()
  await tick()
  assert.equal(b.scripts.length, 0)
  const body = JSON.parse(String(calls.find((call) => call.method === "POST")?.body))
  assert.equal(body.marketing, false)
  assert.equal("sourceUrl" in body, false)
})

test("explicit choice can regrant while a background refresh cannot", async () => {
  enable()
  let post = 0
  const b = browser(async (_url, init = {}) => {
    if (init.method === "POST") {
      post += 1
      return context(2, true)
    }
    return context(1, false)
  })
  consent(b, true)
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  await tick()
  await tick()
  assert.equal(post, 0)
  b.emit("chaarlie:consent-change")
  await tick()
  await tick()
  assert.equal(post, 1)
  assert.equal(b.scripts.length, 1)
})

test("late GET cannot resurrect the Pixel after a denial", async () => {
  enable()
  const late = deferred<Response>()
  const b = browser(async () => late.promise)
  consent(b, true)
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  consent(b, false)
  b.emit("chaarlie:consent-change")
  late.resolve(context(1, true))
  await tick()
  await tick()
  assert.equal(b.scripts.length, 0)
})

test("SDK completion after denial never initializes or measures", async () => {
  enable()
  const b = browser(async (_url, init = {}) =>
    init.method === "POST" ? context(1, true) : context(1, true),
  )
  consent(b, true)
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  await tick()
  await tick()
  assert.equal(b.scripts.length, 1)
  consent(b, false)
  b.emit("chaarlie:consent-change")
  b.scripts[0].onload()
  await tick()
  const commands = (globalThis.window as any).oaiq?.q ?? []
  assert.equal(
    commands.some((entry: unknown[]) => entry[0] === "init"),
    false,
  )
})

test("initializes once and does not Pixel-measure private routes", async () => {
  enable()
  const b = browser(async (_url, init = {}) =>
    init.method === "POST" ? context(1, true) : context(1, true),
  )
  consent(b, true)
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  await tick()
  await tick()
  b.scripts[0].onload()
  await tick()
  a.trackOpenAIAdsPage()
  await tick()
  let commands = (globalThis.window as any).oaiq.q
  assert.equal(commands.filter((entry: unknown[]) => entry[0] === "init").length, 1)
  b.location.pathname = "/profile"
  b.location.href = "https://chaarlie.de/profile?secret=x"
  a.trackOpenAIAdsPage()
  await tick()
  commands = (globalThis.window as any).oaiq.q
  assert.equal(commands.filter((entry: unknown[]) => entry[0] === "measure").length, 1)
  b.location.pathname = "/"
  b.location.href = "https://chaarlie.de/"
  a.trackOpenAIAdsPage()
  await tick()
  await tick()
  commands = (globalThis.window as any).oaiq.q
  assert.equal(commands.filter((entry: unknown[]) => entry[0] === "measure").length, 2)
  assert.equal(commands.filter((entry: unknown[]) => entry[0] === "init").length, 1)
})

test("checkout context capture stays bounded when context fetch hangs", async () => {
  enable()
  const b = browser(async () => new Promise<Response>(() => undefined), "/quiz/result")
  consent(b, true)
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  const started = Date.now()
  await a.syncOpenAIAdsBeforeCheckout()
  assert.ok(Date.now() - started < 1_100)
  assert.equal(b.scripts.length, 0)
})

test("cross-tab refusal revokes an already initialized Pixel", async () => {
  enable()
  const b = browser(async (_url, init = {}) =>
    init.method === "POST" ? context(1, true) : context(1, true),
  )
  consent(b, true)
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  await tick()
  await tick()
  b.scripts[0].onload()
  await tick()
  consent(b, false)
  b.emit("storage", { key: "chaarlie_cookie_consent_v1" })
  await tick()
  const commands = (globalThis.window as any).oaiq.q
  assert.equal(commands.at(-1)[0], "consent")
  assert.equal(commands.at(-1)[1], false)
})

test("private-route denial persists without leaking its URL", async () => {
  enable()
  const calls: RequestInit[] = []
  const b = browser(async (_url, init = {}) => {
    calls.push(init)
    return context(3, false)
  }, "/profile")
  const a = await api()
  a.resetOpenAIAdsBrowserForTest()
  a.startOpenAIAds()
  a.trackOpenAIAdsPage()
  await tick()
  await tick()
  const body = JSON.parse(String(calls.find((call) => call.method === "POST")?.body))
  assert.equal(body.marketing, false)
  assert.equal(body.sourceUrl, undefined)
  assert.equal(b.scripts.length, 0)
})
