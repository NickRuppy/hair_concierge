import type { CookieConsent } from "@/lib/cookie-consent"

const DEFAULT_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "988892550357504"
const META_SCRIPT_ID = "meta-pixel-script"
const META_SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js"
const SUBSCRIPTION_TRACKED_STORAGE_PREFIX = "chaarlie_meta_subscribe_tracked:"

type MetaEventValue = string | number | boolean | null | undefined
export type MetaEventProperties = Record<string, MetaEventValue>
export type MetaStandardEvent =
  | "PageView"
  | "Lead"
  | "InitiateCheckout"
  | "Purchase"
  | "Subscribe"
  | "CompleteRegistration"
  | "ViewContent"

type Fbq = ((command: string, ...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  loaded?: boolean
  push?: Fbq
  queue?: unknown[][]
  version?: string
}

type MetaWindow = {
  _fbq?: Fbq
  fbq?: Fbq
}

type BrowserTargets = {
  doc?: Document
  pixelId?: string
  win?: MetaWindow
}

const initializedPixelsByWindow = new WeakMap<object, Set<string>>()
const enabledWindows = new WeakMap<object, boolean>()

function getBrowserTargets(options: BrowserTargets = {}) {
  const win =
    options.win ?? (typeof window === "undefined" ? undefined : (window as unknown as MetaWindow))
  const doc = options.doc ?? (typeof document === "undefined" ? undefined : document)
  return { doc, pixelId: options.pixelId ?? DEFAULT_PIXEL_ID, win }
}

function sanitizeProperties(properties?: MetaEventProperties) {
  if (!properties) return undefined

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null>
}

function installFbq(win: MetaWindow, doc: Document) {
  if (!win.fbq) {
    const fbq = ((command: string, ...args: unknown[]) => {
      if (fbq.callMethod) {
        fbq.callMethod(command, ...args)
        return
      }
      fbq.queue?.push([command, ...args])
    }) as Fbq

    fbq.push = fbq
    fbq.loaded = true
    fbq.version = "2.0"
    fbq.queue = []
    win.fbq = fbq
    win._fbq = fbq
  }

  if (doc.getElementById(META_SCRIPT_ID)) return

  const script = doc.createElement("script")
  script.id = META_SCRIPT_ID
  script.async = true
  script.src = META_SCRIPT_SRC

  const firstScript = doc.getElementsByTagName("script")[0]
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript)
    return
  }

  doc.head.appendChild(script)
}

export function canUseMetaPixel(consent: CookieConsent | null | undefined) {
  return Boolean(DEFAULT_PIXEL_ID && consent?.marketing === true)
}

export function initMetaPixel(options: BrowserTargets = {}) {
  const { doc, pixelId, win } = getBrowserTargets(options)
  if (!pixelId || !win || !doc) return false

  installFbq(win, doc)

  const initializedPixels = initializedPixelsByWindow.get(win) ?? new Set<string>()
  if (!initializedPixels.has(pixelId)) {
    win.fbq?.("init", pixelId)
    initializedPixels.add(pixelId)
    initializedPixelsByWindow.set(win, initializedPixels)
  }

  return true
}

export function isMetaPixelReady(options: Pick<BrowserTargets, "win"> = {}) {
  const win =
    options.win ?? (typeof window === "undefined" ? undefined : (window as unknown as MetaWindow))
  if (!win?.fbq) return false
  return Boolean(initializedPixelsByWindow.get(win)?.size)
}

function isMetaPixelEnabled(win: MetaWindow) {
  return enabledWindows.get(win) === true
}

export function grantMetaPixelConsent(options: Pick<BrowserTargets, "win"> = {}) {
  const win =
    options.win ?? (typeof window === "undefined" ? undefined : (window as unknown as MetaWindow))
  if (!win?.fbq || !isMetaPixelReady({ win })) return false

  enabledWindows.set(win, true)
  win.fbq("consent", "grant")
  return true
}

export function revokeMetaPixelConsent(options: Pick<BrowserTargets, "win"> = {}) {
  const win =
    options.win ?? (typeof window === "undefined" ? undefined : (window as unknown as MetaWindow))
  if (!win?.fbq) return false

  enabledWindows.set(win, false)
  win.fbq("consent", "revoke")
  return true
}

export function trackMetaEvent(
  eventName: MetaStandardEvent,
  properties?: MetaEventProperties,
  options: Pick<BrowserTargets, "win"> = {},
) {
  const win =
    options.win ?? (typeof window === "undefined" ? undefined : (window as unknown as MetaWindow))
  if (!win?.fbq || !isMetaPixelReady({ win }) || !isMetaPixelEnabled(win)) return false

  const cleanProperties = sanitizeProperties(properties)
  if (cleanProperties && Object.keys(cleanProperties).length > 0) {
    win.fbq("track", eventName, cleanProperties)
  } else {
    win.fbq("track", eventName)
  }
  return true
}

export function trackMetaCustomEvent(
  eventName: string,
  properties?: MetaEventProperties,
  options: Pick<BrowserTargets, "win"> = {},
) {
  const win =
    options.win ?? (typeof window === "undefined" ? undefined : (window as unknown as MetaWindow))
  if (!win?.fbq || !isMetaPixelReady({ win }) || !isMetaPixelEnabled(win)) return false

  const cleanProperties = sanitizeProperties(properties)
  if (cleanProperties && Object.keys(cleanProperties).length > 0) {
    win.fbq("trackCustom", eventName, cleanProperties)
  } else {
    win.fbq("trackCustom", eventName)
  }
  return true
}

export function trackMetaPageView(options: Pick<BrowserTargets, "win"> = {}) {
  return trackMetaEvent("PageView", undefined, options)
}

export function trackMetaQuizStarted(stepName: string, stepNumber: number) {
  return trackMetaCustomEvent("QuizStarted", {
    step_name: stepName,
    step_number: stepNumber,
  })
}

export function trackMetaQuizStepViewed(stepName: string, stepNumber: number) {
  return trackMetaCustomEvent("QuizStepViewed", {
    step_name: stepName,
    step_number: stepNumber,
  })
}

export function trackMetaQuizCompleted() {
  const properties = {
    content_name: "quiz",
    funnel_step: "quiz_completed",
  }
  const standardTracked = trackMetaEvent("CompleteRegistration", properties)
  const customTracked = trackMetaCustomEvent("QuizCompleted", properties)
  return standardTracked || customTracked
}

export function trackMetaLeadCaptured(marketingConsent: boolean) {
  return trackMetaEvent("Lead", {
    content_name: "quiz_lead_capture",
    marketing_consent: marketingConsent,
  })
}

export function trackMetaPricingViewed(source: "pricing_page" | "quiz_result_offer_pricing") {
  return trackMetaEvent("ViewContent", {
    content_name: source,
  })
}

export function trackMetaCheckoutStarted(
  source: "pricing_page" | "quiz_result_offer",
  interval: string | null,
) {
  return trackMetaEvent("InitiateCheckout", {
    content_name: source,
    interval,
  })
}

export function trackMetaSubscriptionConfirmed(sessionId: string) {
  let storageKey: string | null = null
  if (typeof window !== "undefined") {
    storageKey = `${SUBSCRIPTION_TRACKED_STORAGE_PREFIX}${sessionId}`
    if (window.sessionStorage.getItem(storageKey) === "1") return false
  }

  const tracked = trackMetaEvent("Subscribe", {
    content_name: "premium_subscription",
  })

  if (tracked && storageKey) {
    window.sessionStorage.setItem(storageKey, "1")
  }

  return tracked
}
