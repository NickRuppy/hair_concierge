import { notFound } from "next/navigation"
import { CheckoutRecoveryPanel } from "@/app/welcome/checkout-recovery-panel"
import { isCheckoutRecoveryCode } from "@/lib/auth/checkout-activation-outcome"

/** Read-only view of the real recovery component. No checkout or account calls. */
export default async function ActivationRecoveryLab({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const code = (await searchParams).code ?? "trial_unavailable"
  if (!isCheckoutRecoveryCode(code)) notFound()
  return <CheckoutRecoveryPanel code={code} />
}
