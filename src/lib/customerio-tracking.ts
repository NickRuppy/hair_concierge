import type { CookieConsent } from "@/lib/cookie-consent"

export const CUSTOMERIO_EU_CDN_URL = "https://cdp-eu.customer.io"

const DEFAULT_WRITE_KEY = process.env.NEXT_PUBLIC_CUSTOMERIO_WRITE_KEY ?? ""

type CustomerIoValue = string | number | boolean | null | string[] | number[] | boolean[]
export type CustomerIoProperties = Record<string, CustomerIoValue | undefined>

export type CustomerIoEventName =
  | "checkout_started"
  | "chat_product_recommendation_shown"
  | "first_chat_message"
  | "onboarding_completed"
  | "pricing_viewed"
  | "purchase_completed"
  | "quiz_completed"
  | "quiz_goals_selected"
  | "quiz_lead_captured"
  | "quiz_started"
  | "quiz_step_viewed"
  | "result_page_viewed"
  | "result_shared"
  | "subscription_started"

export type CustomerIoBrowserClient = {
  identify: (userId: string, traits?: Record<string, CustomerIoValue>) => unknown
  page: (
    category: string | null,
    name: string | null,
    properties?: Record<string, CustomerIoValue>,
  ) => unknown
  reset: () => unknown
  track: (eventName: string, properties?: Record<string, CustomerIoValue>) => unknown
}

let browserClient: CustomerIoBrowserClient | null = null

export function canUseCustomerIoBrowserTracking(
  consent: Pick<CookieConsent, "analytics"> | null | undefined,
  writeKey = DEFAULT_WRITE_KEY,
) {
  return Boolean(writeKey && consent?.analytics === true)
}

export function cleanCustomerIoProperties(properties?: CustomerIoProperties) {
  if (!properties) return {}

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, CustomerIoValue>
}

export function setCustomerIoBrowserClient(client: CustomerIoBrowserClient) {
  browserClient = client
}

export function clearCustomerIoBrowserClient() {
  browserClient = null
}

export function resetCustomerIoBrowserClient() {
  if (!browserClient) return false

  browserClient.reset()
  return true
}

export function trackCustomerIoPage(path: string, properties?: CustomerIoProperties) {
  if (!browserClient) return false

  browserClient.page(null, path, cleanCustomerIoProperties(properties))
  return true
}

export function identifyCustomerIoUser(userId: string, traits?: CustomerIoProperties) {
  if (!browserClient) return false

  browserClient.identify(userId, cleanCustomerIoProperties(traits))
  return true
}

export function trackCustomerIoEvent(
  eventName: CustomerIoEventName,
  properties?: CustomerIoProperties,
) {
  if (!browserClient) return false

  browserClient.track(eventName, cleanCustomerIoProperties(properties))
  return true
}
