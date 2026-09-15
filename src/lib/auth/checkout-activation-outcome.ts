export type CheckoutRecoveryCode =
  | "trial_unavailable"
  | "trial_checkout_conflict"
  | "trial_checkout_closed"
  | "trial_reconciliation_required"
  | "checkout_existing_access"
  | "activation_link_invalid"
  | "activation_login_required"
  | "auth_link_send_failed"
  | "activation_pending"
  | "activation_delayed"
  | "checkout_incomplete"
  | "activation_temporary"
  | "password_sign_in_failed"
  | "auth_rate_limited"

type RecoveryAction = "support" | "login" | "existing_login" | "retry_status"
type RecoveryContent = {
  title: string
  message: string
  status: number
  /** Rendering inside an existing activation form; GET failures have no form to retain. */
  presentation: "panel" | "inline"
  primary: RecoveryAction
  secondary?: RecoveryAction
}

const outcomes: Record<CheckoutRecoveryCode, RecoveryContent> = {
  trial_unavailable: {
    title: "Kein weiterer kostenloser Test",
    message:
      "Für dieses Konto oder die Zahlungsmethode gab es bereits einen Test oder ein Abo. Das stimmt nicht? Wir prüfen es für dich.",
    status: 403,
    presentation: "panel",
    primary: "support",
    secondary: "existing_login",
  },
  trial_checkout_conflict: {
    title: "Andere Anmeldung offen",
    message:
      "Fahre in deiner zuvor geöffneten Anmeldung fort. Du findest sie nicht mehr? Kontaktiere unseren Support.",
    status: 409,
    presentation: "panel",
    primary: "support",
    secondary: "existing_login",
  },
  trial_checkout_closed: {
    title: "Anmeldung beendet",
    message:
      "Dieser Link kann deinen Zugang nicht mehr aktivieren. Unser Support hilft dir weiter.",
    status: 409,
    presentation: "panel",
    primary: "support",
    secondary: "existing_login",
  },
  trial_reconciliation_required: {
    title: "Zugang noch nicht bereit",
    message:
      "Wir müssen deinen Zugang und die Zahlungsfreigabe prüfen. Starte bitte keine neue Anmeldung.",
    status: 503,
    presentation: "panel",
    primary: "support",
    secondary: "existing_login",
  },
  checkout_existing_access: {
    title: "Zugang bereits vorhanden",
    message: "Melde dich mit deinem bestehenden Konto an.",
    status: 409,
    presentation: "panel",
    primary: "login",
    secondary: "support",
  },
  activation_link_invalid: {
    title: "Link nicht mehr gültig",
    message:
      "Melde dich mit deinem bestehenden Konto an. Noch kein Zugang? Kontaktiere unseren Support.",
    status: 400,
    presentation: "panel",
    primary: "existing_login",
    secondary: "support",
  },
  // Login recovery also covers accounts that cannot set an initial password.
  // This code does not assert that a prior email was sent or access was granted.
  activation_login_required: {
    title: "Bitte melde dich an",
    message: "Nutze dein Passwort oder fordere im Login einen neuen Login-Link an.",
    status: 409,
    presentation: "panel",
    primary: "login",
    secondary: "support",
  },
  auth_link_send_failed: {
    title: "Login-Link nicht gesendet",
    message:
      "Dein Konto ist bereit. Der Login-Link konnte nicht gesendet werden. Bitte erneut senden.",
    status: 500,
    presentation: "inline",
    primary: "support",
  },
  checkout_incomplete: {
    title: "Checkout noch nicht abgeschlossen",
    message: "Schließe den geöffneten Checkout ab. Prüfe danach den Status hier erneut.",
    status: 403,
    presentation: "panel",
    primary: "retry_status",
    secondary: "support",
  },
  activation_delayed: {
    title: "Die Einrichtung dauert länger",
    message: "Prüfe den Status erneut. Brauchst du Hilfe? Kontaktiere unseren Support.",
    status: 503,
    presentation: "panel",
    primary: "retry_status",
    secondary: "support",
  },
  activation_pending: {
    title: "Zugang wird vorbereitet",
    message: "Die Einrichtung läuft noch. Prüfe den Status gleich erneut.",
    status: 409,
    presentation: "panel",
    primary: "retry_status",
    secondary: "support",
  },
  activation_temporary: {
    title: "Bitte erneut versuchen",
    message: "Das hat gerade nicht geklappt. Bitte versuche es erneut.",
    status: 503,
    presentation: "inline",
    primary: "retry_status",
    secondary: "support",
  },
  password_sign_in_failed: {
    title: "Passwort gespeichert",
    message: "Die Anmeldung hat nicht geklappt. Nutze dein neues Passwort im Login.",
    status: 409,
    presentation: "panel",
    primary: "login",
    secondary: "support",
  },
  auth_rate_limited: {
    title: "Bitte kurz warten",
    message: "Zu viele Versuche. Bitte warte kurz und versuche es erneut.",
    status: 429,
    presentation: "inline",
    primary: "support",
  },
}

export class CheckoutRecoveryError extends Error {
  constructor(
    public readonly code: CheckoutRecoveryCode,
    options?: { cause?: unknown },
  ) {
    super(`Checkout recovery: ${code}`, options)
    this.name = "CheckoutRecoveryError"
  }
}

export function isCheckoutRecoveryCode(value: unknown): value is CheckoutRecoveryCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(outcomes, value)
}

export function getCheckoutRecoveryContent(code: CheckoutRecoveryCode): RecoveryContent {
  return outcomes[code]
}

export function checkoutRecoveryResponse(code: CheckoutRecoveryCode) {
  const content = getCheckoutRecoveryContent(code)
  return { status: content.status, body: { code, error: content.message } }
}

/** A closed row's RPC replay no longer contains its original denial reason. */
export function getPersistedTrialRecoveryCode(row: {
  admission_status?: unknown
  admission_denial_reason?: unknown
  neutralization_required?: unknown
}): CheckoutRecoveryCode | null {
  if (row.admission_status !== "blocked" && row.admission_status !== "released") return null
  if (row.neutralization_required !== false) return "trial_reconciliation_required"
  if (row.admission_denial_reason === "trial_used") return "trial_unavailable"
  if (row.admission_denial_reason === "claim_reserved") return "trial_checkout_conflict"
  return "trial_checkout_closed"
}

export function getCheckoutRecoveryAction(action: RecoveryAction) {
  switch (action) {
    case "support":
      return { label: "Support kontaktieren", href: "/kontakt" }
    case "existing_login":
      return { label: "Ich habe bereits ein Konto", href: "/auth" }
    case "login":
      return { label: "Zum Login", href: "/auth" }
    case "retry_status":
      return { label: "Status prüfen", href: null }
  }
}
