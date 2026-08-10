export const PAYMENT_FEEDBACK_KINDS = [
  "access_already_active",
  "checkout_not_loaded",
  "details_invalid",
  "card_declined",
  "provider_temporarily_unavailable",
  "payment_not_completed",
  "payment_status_pending",
  "access_activation_delayed",
] as const

export type PaymentFeedbackKind = (typeof PAYMENT_FEEDBACK_KINDS)[number]

export type PaymentTruth = "not_started" | "failed" | "pending" | "succeeded"
export type PaymentProvider = "stripe" | "paypal" | "checkout"
export type PaymentMethod = "card" | "apple_pay" | "paypal" | "unknown"
export type PaymentConfirmationPhase = "before_confirm" | "after_confirm"
export type PaymentErrorFamily =
  | "access"
  | "checkout_load"
  | "details"
  | "decline"
  | "provider"
  | "payment"
  | "pending"
  | "activation"

export type PaymentFeedbackAction =
  | "login"
  | "profile"
  | "reload"
  | "retry"
  | "correct_details"
  | "use_other_card"
  | "use_paypal"
  | "check_status"

export interface PaymentFeedbackActionDescriptor {
  type: PaymentFeedbackAction
  label: string
}

export interface PaymentFeedback {
  kind: PaymentFeedbackKind
  truth: PaymentTruth
  provider: PaymentProvider
  method: PaymentMethod
  confirmationPhase: PaymentConfirmationPhase
  errorFamily: PaymentErrorFamily
  retryable: boolean
  title: string
  description: string
  safetyNote?: string
  primaryAction: PaymentFeedbackActionDescriptor
  secondaryAction?: PaymentFeedbackActionDescriptor
}

type FeedbackOptions = Partial<
  Pick<PaymentFeedback, "provider" | "method" | "confirmationPhase">
> & {
  detailsField?: "Kartennummer" | "Sicherheitscode" | "Ablaufdatum"
  accessAction?: "login" | "profile"
}

const actionLabels: Record<PaymentFeedbackAction, string> = {
  login: "Mit E-Mail einloggen",
  profile: "Zum Profil",
  reload: "Erneut laden",
  retry: "Erneut versuchen",
  correct_details: "Angaben korrigieren",
  use_other_card: "Andere Karte verwenden",
  use_paypal: "Mit PayPal zahlen",
  check_status: "Zahlungsstatus prüfen",
}

function action(type: PaymentFeedbackAction): PaymentFeedbackActionDescriptor {
  return { type, label: actionLabels[type] }
}

/** Builds one of the only eight customer-visible payment states. */
export function paymentFeedback(
  kind: PaymentFeedbackKind,
  options: FeedbackOptions = {},
): PaymentFeedback {
  const provider = options.provider ?? "checkout"
  const method = options.method ?? (provider === "paypal" ? "paypal" : "card")
  const confirmationPhase = options.confirmationPhase ?? "after_confirm"

  switch (kind) {
    case "access_already_active": {
      const accessAction = options.accessAction ?? "login"
      return {
        kind,
        truth: "not_started",
        provider,
        method,
        confirmationPhase: "before_confirm",
        errorFamily: "access",
        retryable: false,
        title: "Zugang bereits aktiv",
        description:
          "Alles ist in Ordnung. Für deine E-Mail ist bereits ein Zugang aktiv. Melde dich jetzt ein.",
        safetyNote: "Keine neue Zahlung gestartet",
        primaryAction: action(accessAction),
      }
    }
    case "checkout_not_loaded":
      return {
        kind,
        truth: "not_started",
        provider,
        method,
        confirmationPhase: "before_confirm",
        errorFamily: "checkout_load",
        retryable: true,
        title: method === "paypal" ? "PayPal nicht geladen" : "Kartenzahlung nicht geladen",
        description:
          "Die Verbindung zur Zahlung konnte nicht geladen werden. Es wurde nichts abgebucht.",
        primaryAction: action("reload"),
        secondaryAction: method === "paypal" ? undefined : action("use_paypal"),
      }
    case "details_invalid": {
      const field = options.detailsField ?? "Angaben"
      const fieldInstruction =
        field === "Angaben"
          ? "deine Zahlungsangaben"
          : field === "Ablaufdatum"
            ? "dein Ablaufdatum"
            : field === "Kartennummer"
              ? "deine Kartennummer"
              : "deinen Sicherheitscode"
      return {
        kind,
        truth: "failed",
        provider,
        method,
        confirmationPhase,
        errorFamily: "details",
        retryable: true,
        title: `${field} prüfen`,
        description: `Bitte prüfe ${fieldInstruction} und versuche es erneut.`,
        primaryAction: action("correct_details"),
      }
    }
    case "card_declined":
      return {
        kind,
        truth: "failed",
        provider,
        method: "card",
        confirmationPhase,
        errorFamily: "decline",
        retryable: true,
        title: "Karte abgelehnt",
        description:
          "Deine Bank hat diese Karte abgelehnt. Versuche eine andere Karte oder PayPal.",
        primaryAction: action("use_other_card"),
        secondaryAction: action("use_paypal"),
      }
    case "provider_temporarily_unavailable":
      return {
        kind,
        truth: confirmationPhase === "before_confirm" ? "not_started" : "failed",
        provider,
        method,
        confirmationPhase,
        errorFamily: "provider",
        retryable: true,
        title: "Zahlung gerade nicht verfügbar",
        description:
          "Die Verbindung zum Zahlungsanbieter ist gerade nicht verfügbar. Versuche es bitte erneut.",
        primaryAction: action("retry"),
        secondaryAction: method === "card" ? action("use_paypal") : undefined,
      }
    case "payment_not_completed":
      return {
        kind,
        truth: "failed",
        provider,
        method,
        confirmationPhase,
        errorFamily: "payment",
        retryable: true,
        title: "Zahlung nicht abgeschlossen",
        description:
          "Die Zahlung wurde nicht abgeschlossen. Versuche es mit einer anderen Zahlungsmethode erneut.",
        primaryAction: method === "card" ? action("use_other_card") : action("retry"),
        secondaryAction: method === "card" ? action("use_paypal") : undefined,
      }
    case "payment_status_pending":
      return {
        kind,
        truth: "pending",
        provider,
        method,
        confirmationPhase,
        errorFamily: "pending",
        retryable: false,
        title: "Zahlungsstatus noch offen",
        description:
          "Der Zahlungsanbieter hat noch kein Ergebnis gesendet. Warte kurz und prüfe den Status.",
        safetyNote: "Bitte nicht erneut zahlen",
        primaryAction: action("check_status"),
      }
    case "access_activation_delayed":
      return {
        kind,
        truth: "succeeded",
        provider,
        method,
        confirmationPhase: "after_confirm",
        errorFamily: "activation",
        retryable: false,
        title: "Zugang wird freigeschaltet",
        description: "Deine Zahlung war erfolgreich. Dein Zugang wird gerade freigeschaltet.",
        safetyNote: "Bitte nicht erneut zahlen",
        primaryAction: action("check_status"),
      }
  }
}

export interface StripePaymentFeedbackInput {
  confirmationPhase: PaymentConfirmationPhase
  method?: Exclude<PaymentMethod, "paypal">
  error: {
    code?: string | null
    /** Present in Stripe results but deliberately never read for customer feedback. */
    message?: string | null
    paymentFailed?: { declineCode?: string | null } | null
  } | null
}

const safeDetailCodes: Record<string, FeedbackOptions["detailsField"]> = {
  invalid_number: "Kartennummer",
  invalid_cvc: "Sicherheitscode",
  invalid_expiry_month: "Ablaufdatum",
  invalid_expiry_year: "Ablaufdatum",
  expired_card: "Ablaufdatum",
}
const ordinaryDeclineCodes = new Set([
  "insufficient_funds",
  "card_not_supported",
  "do_not_honor",
  "generic_decline",
  "transaction_not_allowed",
])
const temporaryDeclineCodes = new Set([
  "issuer_not_available",
  "processing_error",
  "try_again_later",
])
const temporaryErrorCodes = new Set([
  "network_error",
  "api_connection_error",
  "provider_unavailable",
])

/** Classifies the installed Stripe Custom Checkout result without examining error prose. */
export function classifyStripePaymentFeedback(input: StripePaymentFeedbackInput): PaymentFeedback {
  const options = {
    provider: "stripe" as const,
    method: input.method ?? "card",
    confirmationPhase: input.confirmationPhase,
  }
  const code = input.error?.code ?? null
  const declineCode =
    code === "paymentFailed" ? (input.error?.paymentFailed?.declineCode ?? null) : null

  if (declineCode && safeDetailCodes[declineCode]) {
    return paymentFeedback("details_invalid", {
      ...options,
      detailsField: safeDetailCodes[declineCode],
    })
  }
  if (declineCode && ordinaryDeclineCodes.has(declineCode))
    return paymentFeedback("card_declined", options)
  if (
    (declineCode && temporaryDeclineCodes.has(declineCode)) ||
    (code && temporaryErrorCodes.has(code))
  ) {
    return paymentFeedback("provider_temporarily_unavailable", options)
  }
  if (
    input.confirmationPhase === "before_confirm" &&
    (code === "checkout_not_loaded" || code === "provider_load_error")
  ) {
    return paymentFeedback("checkout_not_loaded", options)
  }
  return paymentFeedback("payment_not_completed", options)
}

export interface PayPalPaymentFeedbackInput {
  status:
    | "checkout_access_already_exists"
    | "checkout_not_loaded"
    | "pending"
    | "activation_delayed"
    | "network_error"
    | "provider_unavailable"
    | "failed"
    | "cancelled"
  confirmationPhase?: PaymentConfirmationPhase
  accessAction?: "login" | "profile"
}

/** Maps only application-owned PayPal status codes. Cancellation intentionally has no error card. */
export function classifyPayPalPaymentFeedback(
  input: PayPalPaymentFeedbackInput,
): PaymentFeedback | null {
  const options = {
    provider: "paypal" as const,
    method: "paypal" as const,
    confirmationPhase: input.confirmationPhase ?? "after_confirm",
  }
  switch (input.status) {
    case "cancelled":
      return null
    case "checkout_access_already_exists":
      return paymentFeedback("access_already_active", {
        ...options,
        accessAction: input.accessAction,
      })
    case "checkout_not_loaded":
      return paymentFeedback("checkout_not_loaded", options)
    case "pending":
      return paymentFeedback("payment_status_pending", options)
    case "activation_delayed":
      return paymentFeedback("access_activation_delayed", options)
    case "network_error":
    case "provider_unavailable":
      return paymentFeedback("provider_temporarily_unavailable", options)
    case "failed":
      return paymentFeedback("payment_not_completed", options)
  }
}
