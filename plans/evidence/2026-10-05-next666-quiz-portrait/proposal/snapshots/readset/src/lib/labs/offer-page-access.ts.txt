type OfferPageLabEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "CI" | "CI_OFFER_PAGE_LAB_ENABLED" | "NODE_ENV" | "VERCEL_ENV">
>

export function isOfferPageLabEnabled(environment: OfferPageLabEnvironment): boolean {
  return (
    environment.NODE_ENV === "development" ||
    environment.VERCEL_ENV === "preview" ||
    (environment.CI === "true" && environment.CI_OFFER_PAGE_LAB_ENABLED === "true")
  )
}
