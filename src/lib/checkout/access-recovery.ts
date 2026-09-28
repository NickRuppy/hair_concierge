export type CheckoutAccessRecovery = {
  status: "existing_access"
  activationPending: boolean
  recovery: "account" | "login"
}

export type CheckoutEligibilityResponse = { status: "eligible" } | CheckoutAccessRecovery

export function buildCheckoutRecoveryHref({
  activationPending,
  recovery,
}: Pick<CheckoutAccessRecovery, "activationPending" | "recovery">): string {
  const destination = activationPending ? "/plan-bereit" : "/chat"
  if (recovery === "account") return destination
  const next = `${destination}?checkout_recovery=1`
  return `/auth?${new URLSearchParams({ force: "login", next })}`
}

/** This intent only prevents quiz projection during account recovery; it grants no access. */
export function isCheckoutRecoveryReturnPath(next: string, origin: string): boolean {
  try {
    const destination = new URL(next, origin)
    return (
      destination.origin === new URL(origin).origin &&
      (destination.pathname === "/chat" || destination.pathname === "/plan-bereit") &&
      destination.searchParams.get("checkout_recovery") === "1"
    )
  } catch {
    return false
  }
}

const ACCESS_RECOVERY_CODE = "checkout_access_recovery"

/** An expected server access conflict, handled by the checkout owner before payment. */
export class CheckoutAccessRecoveryError extends Error {
  readonly code = ACCESS_RECOVERY_CODE

  constructor() {
    super(ACCESS_RECOVERY_CODE)
    this.name = "CheckoutAccessRecoveryError"
  }
}

export function isCheckoutAccessRecoveryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  return candidate.code === ACCESS_RECOVERY_CODE || candidate.message === ACCESS_RECOVERY_CODE
}
