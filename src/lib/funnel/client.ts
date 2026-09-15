"use client"

import type { FunnelTestKind } from "./journey-kind"
import type { FunnelMilestone } from "./server"

export type CurrentFunnelContext = {
  funnelSessionId: string
  funnelPackageKey: string
  analyticsContextReady?: boolean
  entryPath?: string
  issuedAt?: number
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  isInternalTest?: boolean
  testKind?: FunnelTestKind
}

type FetchContext = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type FunnelContextBootstrapOptions = {
  fetchContext?: FetchContext
  maxAttempts?: number
  retryDelayMs?: number
  timeoutMs?: number
  wait?: (ms: number) => Promise<void>
}

const DEFAULT_BOOTSTRAP_OPTIONS = { maxAttempts: 2, retryDelayMs: 150, timeoutMs: 2_000 } as const
const waitFor = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const browserFetch: FetchContext = (...args) => fetch(...args)

function optionalString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength ? value : undefined
}

/** Parse only the small, server-owned analytics envelope. */
export function parseFunnelContext(value: unknown): CurrentFunnelContext | null {
  if (!value || typeof value !== "object") return null
  const body = value as Record<string, unknown>
  const funnelSessionId = optionalString(body.funnelSessionId, 128)
  const funnelPackageKey = optionalString(body.funnelPackageKey, 128)
  if (!funnelSessionId || !funnelPackageKey) return null

  const entryPath = optionalString(body.entryPath, 256)
  const issuedAt =
    typeof body.issuedAt === "number" && Number.isFinite(body.issuedAt) ? body.issuedAt : undefined
  const testKind =
    body.testKind === "field_test" || body.testKind === "partner" ? body.testKind : undefined
  const utmSource = optionalString(body.utmSource, 200)
  const utmMedium = optionalString(body.utmMedium, 200)
  const utmCampaign = optionalString(body.utmCampaign, 200)
  const utmContent = optionalString(body.utmContent, 200)
  const utmTerm = optionalString(body.utmTerm, 200)

  return {
    funnelSessionId,
    funnelPackageKey,
    ...(typeof body.analyticsContextReady === "boolean"
      ? { analyticsContextReady: body.analyticsContextReady }
      : {}),
    ...(entryPath?.startsWith("/") ? { entryPath } : {}),
    ...(issuedAt === undefined ? {} : { issuedAt }),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmContent ? { utmContent } : {}),
    ...(utmTerm ? { utmTerm } : {}),
    ...(typeof body.isInternalTest === "boolean" ? { isInternalTest: body.isInternalTest } : {}),
    ...(testKind ? { testKind } : {}),
  }
}

export function createFunnelContextBootstrap(options: FunnelContextBootstrapOptions = {}) {
  const fetchContext = options.fetchContext ?? browserFetch
  const maxAttempts = options.maxAttempts ?? DEFAULT_BOOTSTRAP_OPTIONS.maxAttempts
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_BOOTSTRAP_OPTIONS.retryDelayMs
  const timeoutMs = options.timeoutMs ?? DEFAULT_BOOTSTRAP_OPTIONS.timeoutMs
  const wait = options.wait ?? waitFor
  let currentContext: CurrentFunnelContext | null = null
  let bootstrapPromise: Promise<CurrentFunnelContext | null> | null = null
  let contextRevision = 0
  let hasBootstrappedContext = false
  const listeners = new Set<(context: CurrentFunnelContext) => void>()

  const setCurrentContext = (context: CurrentFunnelContext) => {
    if (
      currentContext &&
      currentContext.funnelSessionId === context.funnelSessionId &&
      currentContext.funnelPackageKey === context.funnelPackageKey
    ) {
      // A browser milestone POST returns only identity. Keep the durable GET acquisition fields.
      // Subscribers consume identity only; acquisition callers await bootstrap's merged result.
      currentContext = { ...currentContext, ...context }
      return
    }
    currentContext = context
    hasBootstrappedContext = false
    contextRevision += 1
    for (const listener of listeners) listener(currentContext)
  }

  const requestOnce = async () => {
    const controller = typeof AbortController === "undefined" ? null : new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const timeoutPromise = new Promise<null>((resolve) => {
        timeout = setTimeout(() => {
          controller?.abort()
          resolve(null)
        }, timeoutMs)
      })
      return await Promise.race([
        fetchContext("/api/funnel/session", {
          headers: { Accept: "application/json" },
          ...(controller ? { signal: controller.signal } : {}),
        })
          .then(async (response) =>
            response.ok ? parseFunnelContext(await response.json()) : null,
          )
          .catch(() => null),
        timeoutPromise,
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  const bootstrap = () => {
    if (bootstrapPromise) return bootstrapPromise
    if (currentContext && hasBootstrappedContext) return Promise.resolve(currentContext)
    bootstrapPromise = (async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const requestRevision = contextRevision
        const context = await requestOnce()
        if (context) {
          // Never let a slow GET restore an older identity after a newer milestone response.
          if (
            requestRevision !== contextRevision &&
            (currentContext?.funnelSessionId !== context.funnelSessionId ||
              currentContext?.funnelPackageKey !== context.funnelPackageKey)
          )
            return currentContext
          setCurrentContext(context)
          hasBootstrappedContext = context.analyticsContextReady !== false
          if (hasBootstrappedContext) return currentContext
        }
        if (attempt + 1 < maxAttempts) await wait(retryDelayMs)
      }
      // Keep signed identity available to UI callers, but retry acquisition on the next call.
      return currentContext?.analyticsContextReady === false ? currentContext : null
    })().finally(() => {
      // A failed bounded attempt must never poison a later page-event bootstrap.
      bootstrapPromise = null
    })
    return bootstrapPromise
  }

  return {
    bootstrap,
    getCurrentContext: () => currentContext,
    setCurrentContext,
    subscribe(listener: (context: CurrentFunnelContext) => void) {
      listeners.add(listener)
      if (currentContext) listener(currentContext)
      return () => listeners.delete(listener)
    },
  }
}

const funnelContextBootstrap = createFunnelContextBootstrap()

export function getCurrentFunnelContext() {
  return funnelContextBootstrap.getCurrentContext()
}

export function bootstrapFunnelContext() {
  return funnelContextBootstrap.bootstrap()
}

/** Receive a resolved context from later retries or browser milestone responses. */
export function subscribeFunnelContext(listener: (context: CurrentFunnelContext) => void) {
  return funnelContextBootstrap.subscribe(listener)
}

export function recordBrowserFunnelMilestone(
  milestone: FunnelMilestone,
  properties?: Record<string, unknown>,
  eventId = crypto.randomUUID(),
  persist = true,
) {
  const funnelEventId = eventId
  if (persist)
    void fetch("/api/funnel/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: funnelEventId, milestone, properties }),
      keepalive: true,
    })
      .then(async (response) => (response.ok ? parseFunnelContext(await response.json()) : null))
      .then((context) => {
        if (context) funnelContextBootstrap.setCurrentContext(context)
      })
      .catch(() => undefined)

  return { funnelEventId, ...getCurrentFunnelContext() }
}

export function createFunnelEventId() {
  return crypto.randomUUID()
}
