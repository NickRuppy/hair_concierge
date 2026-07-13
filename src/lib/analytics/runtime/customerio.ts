import {
  CUSTOMERIO_EU_CDN_URL,
  disableCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
  type CustomerIoBrowserClient,
} from "@/lib/customerio-tracking"

const CUSTOMERIO_WRITE_KEY = process.env.NEXT_PUBLIC_CUSTOMERIO_WRITE_KEY ?? ""
const CUSTOMERIO_CDN_URL = process.env.NEXT_PUBLIC_CUSTOMERIO_CDN_URL || CUSTOMERIO_EU_CDN_URL

type CustomerIoRuntimeOptions = {
  loadClient: () => Promise<CustomerIoBrowserClient | null>
  onReady?: (client: CustomerIoBrowserClient) => void
  onUnavailable?: () => void
  warn?: (message: string, error: unknown) => void
}

export function createCustomerIoRuntime({
  loadClient,
  onReady = setCustomerIoBrowserClient,
  onUnavailable = disableCustomerIoBrowserClient,
  warn = (message, error) => {
    if (process.env.NODE_ENV !== "production") console.warn(message, error)
  },
}: CustomerIoRuntimeOptions) {
  let startPromise: Promise<boolean> | null = null

  return {
    start() {
      if (startPromise) return startPromise

      startPromise = loadClient()
        .then((client) => {
          if (!client) {
            onUnavailable()
            return false
          }

          onReady(client)
          return true
        })
        .catch((error) => {
          onUnavailable()
          warn("[analytics] Customer.io loader failed", error)
          return false
        })

      return startPromise
    },
  }
}

const runtime = createCustomerIoRuntime({
  loadClient: async () => {
    if (!CUSTOMERIO_WRITE_KEY || typeof window === "undefined") {
      return null
    }

    const { AnalyticsBrowser } = await import("@customerio/cdp-analytics-browser")
    return AnalyticsBrowser.load({
      cdnURL: CUSTOMERIO_CDN_URL,
      writeKey: CUSTOMERIO_WRITE_KEY,
    }) as CustomerIoBrowserClient
  },
})

export function startCustomerIoBrowserTracking() {
  return runtime.start()
}
