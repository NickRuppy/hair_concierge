export type PasswordResetMessage = {
  message: string
  guidance?: string
  actionHref?: string
  actionLabel?: string
}

export type PasswordResetSession = {
  access_token: string
  refresh_token: string
}

export const PASSWORD_RESET_LINK_ERROR: PasswordResetMessage = {
  message: "Der Passwort-Link ist abgelaufen oder wurde schon verwendet.",
  guidance: "Fordere einen neuen Link an und öffne danach den neuesten Link aus deinem Postfach.",
  actionHref: "/auth",
  actionLabel: "Neuen Link anfordern",
}

export const PASSWORD_RESET_GENERIC_ERROR: PasswordResetMessage = {
  message: "Passwort konnte nicht gespeichert werden.",
  guidance: "Bitte versuche es erneut. Wenn es weiter nicht klappt, fordere einen neuen Link an.",
}

export function extractSupabaseHashSession(hash: string): PasswordResetSession | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash
  if (!rawHash) return null

  const params = new URLSearchParams(rawHash)
  const accessToken = params.get("access_token")
  const refreshToken = params.get("refresh_token")
  if (!accessToken || !refreshToken) return null

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  }
}

export function mapPasswordUpdateError(error: unknown): PasswordResetMessage {
  const message = getErrorMessage(error).toLowerCase()
  const code = getErrorCode(error).toLowerCase()
  const combined = `${code} ${message}`

  if (
    combined.includes("session") ||
    combined.includes("jwt") ||
    combined.includes("expired") ||
    combined.includes("invalid token")
  ) {
    return PASSWORD_RESET_LINK_ERROR
  }

  if (
    combined.includes("weak") ||
    combined.includes("password_strength") ||
    combined.includes("password should be") ||
    combined.includes("password must")
  ) {
    return {
      message: "Dieses Passwort ist zu schwach.",
      guidance:
        "Wähle mindestens 8 Zeichen und kombiniere am besten Buchstaben, Zahlen und ein Sonderzeichen.",
    }
  }

  if (
    combined.includes("same") ||
    combined.includes("different from") ||
    combined.includes("different password")
  ) {
    return {
      message: "Dieses Passwort ist bereits für dein Konto gesetzt.",
      guidance:
        "Wähle ein anderes Passwort oder melde dich direkt mit deinem bestehenden Passwort an.",
      actionHref: "/auth",
      actionLabel: "Zur Anmeldung",
    }
  }

  if (
    combined.includes("rate") ||
    combined.includes("too many") ||
    combined.includes("over_email_send_rate_limit")
  ) {
    return {
      message: "Zu viele Versuche in kurzer Zeit.",
      guidance: "Warte kurz und versuche es dann noch einmal.",
    }
  }

  return PASSWORD_RESET_GENERIC_ERROR
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === "string" ? message : ""
  }
  return ""
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === "string" ? code : ""
  }
  return ""
}
