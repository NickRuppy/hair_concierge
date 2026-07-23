type OfferPageLabEnvironment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VERCEL_ENV">>

export function isOfferPageLabEnabled(environment: OfferPageLabEnvironment): boolean {
  return environment.NODE_ENV === "development" || environment.VERCEL_ENV === "preview"
}
