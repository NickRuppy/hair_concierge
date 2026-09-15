"use client"

import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent } from "@/lib/cookie-consent"
import { bootstrapFunnelContext } from "@/lib/funnel/client"

type Queue = (command: string, ...args: unknown[]) => void
type Context = { revision: number; marketing: boolean; expiresAt: string | null }
type Reason = "background" | "explicit-choice"
const SDK_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js"
let sdkPromise: Promise<void> | null = null
let contextPromise: Promise<Context | null> | null = null
let initialized = false
let generation = 0
let pendingDenial = false
let denialPromise: Promise<boolean> | null = null
let lastMeasuredPath: string | null = null

function pixelId() {
  const value = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID?.trim()
  return process.env.NEXT_PUBLIC_OPENAI_ADS_ENABLED === "true" &&
    value &&
    typeof window !== "undefined" &&
    window.location.origin === "https://chaarlie.de"
    ? value
    : null
}
function publicPath(path: string) {
  return path === "/" || /^\/lp\/[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/i.test(path)
}
function safeSourceUrl() {
  const path = window.location.pathname
  return publicPath(path) || ["/welcome", "/quiz/result", "/result"].includes(path)
    ? `${window.location.origin}${path}`
    : undefined
}
function queue() {
  const target = window as Window & { oaiq?: Queue }
  target.oaiq ??= ((...args: unknown[]) => {
    const queued = target.oaiq as Queue & { q?: unknown[][] }
    queued.q ??= []
    queued.q.push(args)
  }) as Queue
  return target.oaiq
}
function denyPixel() {
  queue()("consent", false)
}
function current(token: number) {
  return (
    token === generation &&
    Boolean(pixelId()) &&
    loadConsent()?.marketing === true &&
    !pendingDenial
  )
}
function parseContext(value: unknown): Context | null {
  if (!value || typeof value !== "object") return null
  const data = value as Record<string, unknown>
  if (
    !Number.isSafeInteger(data.revision) ||
    (data.revision as number) < 0 ||
    typeof data.marketing !== "boolean"
  )
    return null
  return {
    revision: data.revision as number,
    marketing: data.marketing,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
  }
}
async function request(init?: RequestInit) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve(null)
    }, 750)
  })
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch("/api/openai-ads/context", {
          ...init,
          signal: controller.signal,
          cache: "no-store",
        })
        const state = parseContext(await response.json())
        return { status: response.status, state }
      })().catch(() => null),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}
function getContext() {
  contextPromise ??= request()
    .then((result) => (result?.status === 200 ? result.state : null))
    .finally(() => {
      contextPromise = null
    })
  return contextPromise
}
function post(action: "choice" | "context", revision: number, marketing?: boolean) {
  const body: Record<string, unknown> = {
    action,
    requestId: crypto.randomUUID(),
    expectedRevision: revision,
  }
  if (action === "choice") body.marketing = marketing
  const sourceUrl = safeSourceUrl()
  if (sourceUrl && action === "context") body.sourceUrl = sourceUrl
  return request({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
function persistDenial(): Promise<boolean> {
  pendingDenial = true
  denialPromise ??= (async () => {
    const state = await getContext()
    const result = state ? await post("choice", state.revision, false) : null
    const saved = result?.status === 200 && result.state?.marketing === false
    pendingDenial = !saved
    return saved
  })().finally(() => {
    denialPromise = null
  })
  return denialPromise
}
function loadSdk() {
  if (sdkPromise) return sdkPromise
  denyPixel()
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.async = true
    script.src = SDK_URL
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error("Pixel unavailable"))
    }
    document.head.appendChild(script)
  }).catch((error) => {
    sdkPromise = null
    throw error
  })
  return sdkPromise
}
async function capture(state: Context, token: number) {
  if (!safeSourceUrl() || !current(token)) return
  await bootstrapFunnelContext().catch(() => null)
  if (!current(token)) return
  const result = await post("context", state.revision)
  if (current(token) && (result?.status !== 200 || result.state?.marketing !== true)) {
    ++generation
    denyPixel()
  }
}
async function measure(state: Context, token: number) {
  const id = pixelId()
  const path = window.location.pathname
  if (!id || !current(token) || !publicPath(path)) return
  try {
    await loadSdk()
    if (!current(token) || window.location.pathname !== path || !publicPath(path)) return
    const oaiq = queue()
    if (!initialized) {
      oaiq("init", { pixelId: id })
      initialized = true
    }
    oaiq("consent", true)
    if (lastMeasuredPath !== path) {
      lastMeasuredPath = path
      oaiq("measure", "page_viewed", { type: "contents" }, { opt_out: true })
    }
    // The SDK may have established attribution cookies after the first capture.
    await capture(state, token)
  } catch {
    denyPixel()
  }
}
async function synchronize(reason: Reason = "background") {
  if (!pixelId()) return
  const token = ++generation
  if (!publicPath(window.location.pathname)) {
    lastMeasuredPath = null
    denyPixel()
  }
  if (loadConsent()?.marketing !== true) {
    denyPixel()
    await persistDenial()
    return
  }
  if (pendingDenial && !(await persistDenial())) {
    denyPixel()
    return
  }
  const state = await getContext()
  if (!current(token)) return
  if (!state) {
    denyPixel()
    return
  }
  let approved = state
  if (!state.marketing && (reason === "explicit-choice" || state.revision === 0)) {
    const result = await post("choice", state.revision, true)
    if (!current(token)) return
    if (result?.status !== 200 || !result.state?.marketing) {
      denyPixel()
      return
    }
    approved = result.state
  }
  if (!approved.marketing) {
    denyPixel()
    return
  }
  // Checkout never waits for the third-party SDK. Both captures use the same exact session.
  void measure(approved, token)
  await capture(approved, token)
}
export function startOpenAIAds() {
  if (typeof window === "undefined" || !pixelId()) return () => undefined
  const onChoice = () => {
    if (loadConsent()?.marketing !== true) {
      ++generation
      denyPixel()
    }
    void synchronize("explicit-choice")
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === "chaarlie_cookie_consent_v1" || event.key === null) void synchronize()
  }
  const onOnline = () => void synchronize()
  const onVisibility = () => {
    if (document.visibilityState === "visible") void synchronize()
  }
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChoice)
  window.addEventListener("storage", onStorage)
  window.addEventListener("online", onOnline)
  document.addEventListener("visibilitychange", onVisibility)
  return () => {
    ++generation
    denyPixel()
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChoice)
    window.removeEventListener("storage", onStorage)
    window.removeEventListener("online", onOnline)
    document.removeEventListener("visibilitychange", onVisibility)
  }
}
export function trackOpenAIAdsPage() {
  void synchronize()
}
export async function syncOpenAIAdsBeforeCheckout(): Promise<void> {
  if (!pixelId()) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      synchronize(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 1_000)
      }),
    ])
  } catch {
  } finally {
    clearTimeout(timer)
  }
}
export function resetOpenAIAdsBrowserForTest() {
  sdkPromise = null
  contextPromise = null
  initialized = false
  ++generation
  pendingDenial = false
  denialPromise = null
  lastMeasuredPath = null
}
