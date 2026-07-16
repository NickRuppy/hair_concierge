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

type CustomerIoBrowserSdk = {
  AnalyticsBrowser: {
    load: (settings: {
      cdnURL: string
      writeKey: string
    }) => PromiseLike<[CustomerIoBrowserClient, unknown]>
  }
}

type CustomerIoBrowserLoaderOptions = {
  browserAvailable: () => boolean
  cdnURL: string
  importSdk: () => Promise<CustomerIoBrowserSdk>
  writeKey: string
}

export function createCustomerIoBrowserLoader({
  browserAvailable,
  cdnURL,
  importSdk,
  writeKey,
}: CustomerIoBrowserLoaderOptions) {
  return async (): Promise<CustomerIoBrowserClient | null> => {
    if (!writeKey || !browserAvailable()) return null

    const { AnalyticsBrowser } = await importSdk()
    const [client] = await AnalyticsBrowser.load({ cdnURL, writeKey })
    return client
  }
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
  loadClient: createCustomerIoBrowserLoader({
    browserAvailable: () => typeof window !== "undefined",
    cdnURL: CUSTOMERIO_CDN_URL,
    importSdk: () => import("@customerio/cdp-analytics-browser"),
    writeKey: CUSTOMERIO_WRITE_KEY,
  }),
})

export function startCustomerIoBrowserTracking() {
  return runtime.start()
}
