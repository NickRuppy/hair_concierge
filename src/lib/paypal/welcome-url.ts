export type PayPalOneTimeReturnState = "failed_permanent" | "revoked"

export function buildPayPalOneTimeWelcomeUrl(
  token: string,
  returnState?: PayPalOneTimeReturnState,
): string {
  const params = new URLSearchParams({ provider: "paypal", purchase: "one_time", token })
  if (returnState) params.set("return_state", returnState)
  return `/welcome?${params.toString()}`
}
