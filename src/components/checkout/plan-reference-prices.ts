import type { BillingInterval } from "@/lib/stripe/intervals"

export const QUIZ_RESULT_REFERENCE_PRICES = {
  month: 19.99,
  quarter: 44.49,
  year: 149.99,
} satisfies QuizResultReferencePrices

export const PERSONAL_PLAN_LAUNCH_REFERENCE_PRICES = {
  month: 14.99,
  quarter: 34.99,
  year: 99.99,
} satisfies QuizResultReferencePrices

export type QuizResultReferencePrices = Readonly<Record<BillingInterval, number>>

export function formatQuizResultReferencePrice(amount: number): string {
  return `€${amount.toFixed(2).replace(".", ",")}`
}
