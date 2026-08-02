export type PreparedCheckoutCredential = {
  preparationId: string
  preparationToken: string
}

type CryptoSource = Pick<Crypto, "getRandomValues"> & {
  randomUUID?: () => string
}

function encodeBase64Url(bytes: Uint8Array) {
  let value = ""
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

/** A browser-held bearer credential that stays stable for one prepare generation. */
export function createPreparedCheckoutCredential(
  cryptoSource: CryptoSource | undefined = globalThis.crypto,
): PreparedCheckoutCredential {
  if (!cryptoSource?.getRandomValues) {
    throw new Error("secure checkout credential generation is unavailable")
  }

  const bytes = cryptoSource.getRandomValues(new Uint8Array(32))
  return {
    preparationId:
      cryptoSource.randomUUID?.() ??
      encodeBase64Url(cryptoSource.getRandomValues(new Uint8Array(16))),
    preparationToken: encodeBase64Url(bytes),
  }
}

export type PreparedCheckoutControlOutcome =
  | "duplicate_access"
  | "prepared_checkout_unavailable"
  | "provider_locked"
  | null

/** Expected checkout control responses are recoverable UI state, never payment incidents. */
export function getPreparedCheckoutControlOutcome({
  error,
  providerLocked,
  status,
}: {
  error?: unknown
  providerLocked?: unknown
  status?: unknown
}): PreparedCheckoutControlOutcome {
  if (providerLocked === "paypal" || providerLocked === "stripe") return "provider_locked"
  if (status === "unavailable" || error === "prepared_checkout_unavailable") {
    return "prepared_checkout_unavailable"
  }
  if (error === "checkout_access_already_exists" || error === "checkout already completed") {
    return "duplicate_access"
  }
  return null
}

export function isHandledPreparedCheckoutControlError(error: unknown) {
  return error instanceof Error && error.message.startsWith("prepared_checkout_control:")
}

export function createAlreadyReportedPreparedCheckoutError(error: unknown) {
  const reason = error instanceof Error ? error.message : "initialization_failed"
  return new Error(`prepared_checkout_reported:${reason}`, { cause: error })
}

export function isAlreadyReportedPreparedCheckoutError(error: unknown) {
  return error instanceof Error && error.message.startsWith("prepared_checkout_reported:")
}
