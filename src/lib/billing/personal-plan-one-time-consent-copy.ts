export const PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_TEXT =
  "Für den persönlichen Haarplan gilt ein 14-tägiges Widerrufsrecht. Innerhalb dieses Zeitraums wird der vollständige Kaufpreis auf Wunsch erstattet."

export const PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_COPY_VERSION = "purchase_context_refund_v1"

export function isPersonalPlanOneTimePurchaseContextCopyVersion(version: string): boolean {
  return version === PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_COPY_VERSION
}
